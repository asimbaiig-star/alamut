-- 037_read_authorization.sql
--
-- Closes the read side of RLS. Every migration named `tighten_rls` so far
-- (005, 019, 027) tightened INSERT and WITH CHECK — 019's own header says the
-- threat it closes is that a user could *plant* a row. The only SELECT
-- lockdown was 025, and it covered exactly two tables, `creators` and
-- `brands`. Thirteen tables were left where they started.
--
-- WHAT WAS OPEN
--
-- Eight tables carried `for select using (true)` with NO role clause, so the
-- `anon` role was included. The publishable key ships in the public JS bundle
-- by design, which made these world-readable with one curl:
--
--   contracts, offers, applications, collaborations, submissions,
--   deliverables, reviews, campaigns
--
-- `contracts` returned agreed_rate, platform_fee, net_to_creator and
-- withholding_tax for every deal on the platform. `offers` returned the pitch
-- message and every counter-offer round; `submissions` the creator's notes and
-- permalinks. `reviews` was open and merely empty — latent, not safe.
--
-- Five more were scoped `to authenticated` but still `using (true)`, so the
-- gate was "do you have an account", not "is this yours". Signup is open:
--
--   transactions, messages, threads, disputes, outreach
--
-- Any account could read every direct message, every wallet movement and
-- every dispute on the platform.
--
-- WHY THIS IS SAFE FOR THE APP
--
-- Every repository reads unfiltered — `sb.from('contracts').select(COLUMNS)`
-- with no `.eq()` — and boot hydration in `store.ts` runs for signed-out
-- visitors too. Neither matters:
--
--   1. An unfiltered SELECT under scoped RLS returns the caller's own rows.
--      The client-side filtering the app already does then runs over a
--      smaller set. No query needed rewriting.
--   2. `overlay()` (store.ts) opens with `if (remote.length === 0) return
--      local;`. A signed-out visitor now gets [] for these tables, which
--      leaves the local seed store untouched — the public pages render
--      exactly as before.
--
-- Writes are unaffected. Where a repository writes and then reads the row
-- back (`.select(...).single()`), the party doing the write is always one
-- the SELECT policy admits: for the five deal tables the new SELECT predicate
-- is identical to the UPDATE predicate live since 005/019, so every write
-- that already succeeded in production passes it. Ledger rows go in through
-- a plain `.insert()` with no read-back, so the transactions SELECT policy
-- only governs who can see them afterwards.
--
-- NO POLICY RECURSION
--
-- The 005/019 helpers are `security invoker`, so the base tables' RLS applies
-- to them. That makes the choice of predicate load-bearing: a policy on table
-- T must never need to read T. Every predicate below resolves through
-- `brands`, `creators` and `campaigns` only — never back through the table it
-- guards. `is_participant_of_campaign` reads `applications` and `offers`, so
-- it is used for `deliverables` and `disputes` but NOT for applications or
-- offers themselves, which would recurse.
--
-- Note also that 005's helper comments claim the open `brands_select_all` /
-- `creators_select_all` policies let their inner SELECTs see every row. 025
-- replaced both with owner-only policies, so the helpers now see only the
-- caller's own brand/creator row. That is exactly what they test for
-- (`owner_email = auth.email()`), so they still return the right answer —
-- but the comment is now wrong and should not be trusted on the next read.
--
-- CAMPAIGNS IS DELIBERATELY UNTOUCHED
--
-- `campaigns_select_all` stays. A public marketplace needs anonymous brief
-- reads, so the policy is right; the COLUMN SET is not — budget, spent,
-- escrow_held, history, milestones and auto_shortlist are all world-readable
-- today. Trimming them needs a `campaigns_public` view, which belongs with
-- the `creators_public` / `brands_public` fix (those two return zero rows to
-- anon because `security_invoker=on` applies the owner-only base policy to
-- the caller). That is a separate migration, not an oversight here.
--
-- `auth.email()` is wrapped as `(select auth.email())` throughout, per the
-- initplan optimisation 028 applied for the Supabase performance lint.
--
-- Safe and re-runnable: drops are `if exists`, functions are `or replace`.

-- =====================================================================
-- 1. Identity helpers
-- =====================================================================
-- The app's own notion of wallet ownership is
-- `db.transactions.filter((t) => t.userId === brand.userId)`
-- (v2Adapters.ts). `transactions.user_id` and `threads.participants` hold
-- those legacy app-level ids (`u_sarah`), not auth uids — so authorization
-- has to map auth.email() -> the user_ids this caller owns. One place,
-- reused by both.
--
-- security invoker: reading `brands`/`creators` under the caller's own RLS
-- returns their row and no one else's, which is precisely the lookup.
-- search_path = '' per 027, so every reference is schema-qualified.

create or replace function public.own_user_ids()
returns setof text language sql stable security invoker
set search_path = '' as $$
  select b.user_id
  from public.brands b
  where b.owner_email is not null
    and b.owner_email = (select auth.email())
  union
  select c.user_id
  from public.creators c
  where c.owner_email is not null
    and c.owner_email = (select auth.email())
$$;

comment on function public.own_user_ids() is
  'App-level user_ids (u_*) owned by the calling auth user. Bridges auth.email() to the legacy ids carried by transactions.user_id and threads.participants.';

create or replace function public.is_own_user_id(p_user_id text)
returns boolean language sql stable security invoker
set search_path = '' as $$
  select p_user_id is not null
     and exists (select 1 from public.own_user_ids() u where u = p_user_id);
$$;

-- Brand ownership by brand id. 005 only shipped the by-CAMPAIGN form, and
-- `outreach` rows carry brand_id with a nullable campaign_id.
create or replace function public.is_brand_owner(p_brand_id text)
returns boolean language sql stable security invoker
set search_path = '' as $$
  select exists (
    select 1
    from public.brands b
    where b.id = p_brand_id
      and b.owner_email is not null
      and b.owner_email = (select auth.email())
  );
$$;

-- Thread membership, for the messages policy. Checks the participants array
-- itself rather than leaning on the `threads` policy to have filtered the
-- row: an `exists (select 1 from threads where id = $1)` would be correct
-- today and would silently open `messages` to everyone the day the threads
-- policy was loosened. Used by `messages` and never by `threads`, which
-- would recurse.
create or replace function public.is_thread_participant(p_thread_id text)
returns boolean language sql stable security invoker
set search_path = '' as $$
  select exists (
    select 1
    from public.threads t
    where t.id = p_thread_id
      and t.participants && coalesce(
        (select array_agg(u) from public.own_user_ids() u), '{}'::text[]
      )
  );
$$;

-- =====================================================================
-- 2. Deal tables — the two parties to the deal, nobody else
-- =====================================================================
-- Brand owner of the campaign, or the creator the row is about. Both
-- predicates resolve through brands/campaigns/creators only.

drop policy if exists "applications_select_all" on public.applications;
drop policy if exists "applications_select_party" on public.applications;
create policy "applications_select_party" on public.applications
  for select to authenticated
  using (
    public.is_brand_owner_of_campaign(campaign_id)
    or public.is_creator_owner(creator_id)
  );

drop policy if exists "offers_select_all" on public.offers;
drop policy if exists "offers_select_party" on public.offers;
create policy "offers_select_party" on public.offers
  for select to authenticated
  using (
    public.is_brand_owner_of_campaign(campaign_id)
    or public.is_creator_owner(creator_id)
  );

drop policy if exists "collaborations_select_all" on public.collaborations;
drop policy if exists "collaborations_select_party" on public.collaborations;
create policy "collaborations_select_party" on public.collaborations
  for select to authenticated
  using (
    public.is_brand_owner_of_campaign(campaign_id)
    or public.is_creator_owner(creator_id)
  );

drop policy if exists "contracts_select_all" on public.contracts;
drop policy if exists "contracts_select_party" on public.contracts;
create policy "contracts_select_party" on public.contracts
  for select to authenticated
  using (
    public.is_brand_owner_of_campaign(campaign_id)
    or public.is_creator_owner(creator_id)
  );

drop policy if exists "submissions_select_all" on public.submissions;
drop policy if exists "submissions_select_party" on public.submissions;
create policy "submissions_select_party" on public.submissions
  for select to authenticated
  using (
    public.is_brand_owner_of_campaign(campaign_id)
    or public.is_creator_owner(creator_id)
  );

-- Deliverables are campaign-level specs: migration 035 added `creator_id`
-- but left it nullable, so the per-creator predicate alone would hide the
-- brief's own deliverable list from the creator who has to deliver it.
-- Participation is the right test here, and `deliverables` is not one of the
-- tables the helper reads, so there is no recursion.
drop policy if exists "deliverables_select_all" on public.deliverables;
drop policy if exists "deliverables_select_participant" on public.deliverables;
create policy "deliverables_select_participant" on public.deliverables
  for select to authenticated
  using (public.is_participant_of_campaign(campaign_id));

-- Reviews stay publicly readable — they appear on creator storefronts, and
-- `creators_public` exposes `featured_review_ids` for exactly that. What was
-- wrong is that MODERATED rows were public too. No role clause, by intent.
-- (The moderation columns — reported_by, hidden_reason, hidden_at — are still
-- in the public column set; they belong in the `campaigns_public`-style view
-- migration, not here.)
drop policy if exists "reviews_select_all" on public.reviews;
drop policy if exists "reviews_select_visible" on public.reviews;
create policy "reviews_select_visible" on public.reviews
  for select
  using (hidden = false);

-- =====================================================================
-- 3. Private tables — an account is not a relationship
-- =====================================================================

-- The row's own wallet, or its counterparty. That covers every reader in the
-- app: both wallets filter on `t.userId`, and the `paid` stage derivation
-- (collabSync.ts) and escrowFundedAt (CollabDetail.tsx) match on userId OR
-- counterpartyUserId. Escrow rows are userId = brand, counterparty = creator;
-- payout rows are the reverse.
--
-- The third arm, the campaign's brand owner, is not required by any reader.
-- Its only effect is that the brand can also see the creator-side `fee` rows
-- on its own campaign (platform fee, withholding tax), which carry no
-- counterparty. Those figures are already on the contract the brand can
-- read, so it exposes nothing new. Kept rather than shipping a second
-- migration for no change in what anyone can learn; drop it if strict
-- least privilege matters more.
drop policy if exists "transactions_select_authenticated" on public.transactions;
drop policy if exists "transactions_select_party" on public.transactions;
create policy "transactions_select_party" on public.transactions
  for select to authenticated
  using (
    public.is_own_user_id(user_id)
    or public.is_own_user_id(counterparty_user_id)
    or public.is_brand_owner_of_campaign(campaign_id)
  );

-- Threads: membership by user_id overlap. Inlined rather than routed through
-- is_thread_participant, which reads this table.
drop policy if exists "threads_select_authenticated" on public.threads;
drop policy if exists "threads_select_participant" on public.threads;
create policy "threads_select_participant" on public.threads
  for select to authenticated
  using (
    participants && coalesce(
      (select array_agg(u) from public.own_user_ids() u), '{}'::text[]
    )
  );

drop policy if exists "messages_select_authenticated" on public.messages;
drop policy if exists "messages_select_participant" on public.messages;
create policy "messages_select_participant" on public.messages
  for select to authenticated
  using (public.is_thread_participant(thread_id));

-- Disputes carry both campaign_id and collaboration_id; participation on the
-- campaign covers the brand owner and any creator with an application or
-- offer on it, which every collaborating creator has by construction.
drop policy if exists "disputes_select_authenticated" on public.disputes;
drop policy if exists "disputes_select_participant" on public.disputes;
create policy "disputes_select_participant" on public.disputes
  for select to authenticated
  using (public.is_participant_of_campaign(campaign_id));

-- Outreach: the brand that sent it, or the creator it was sent to.
-- campaign_id is nullable here, hence is_brand_owner by brand id.
drop policy if exists "outreach_select_authenticated" on public.outreach;
drop policy if exists "outreach_select_party" on public.outreach;
create policy "outreach_select_party" on public.outreach
  for select to authenticated
  using (
    public.is_brand_owner(brand_id)
    or public.is_creator_owner(creator_id)
  );

-- =====================================================================
-- Verification
-- =====================================================================
-- Expect 12 rows, one per policy created above. Every `roles` should be
-- {authenticated} except reviews_select_visible, which is {public} by
-- intent, and no `qual` should be the bare word `true`.
select
  tablename,
  policyname,
  roles::text as roles,
  qual
from pg_policies
where schemaname = 'public'
  and cmd = 'SELECT'
  and tablename in (
    'applications','offers','collaborations','contracts','submissions',
    'deliverables','reviews','transactions','threads','messages',
    'disputes','outreach'
  )
order by tablename;

-- And this one should return ZERO rows — any SELECT policy still open to
-- anon with a bare `true` predicate. `campaigns` is the intended exception.
select tablename, policyname, roles::text, qual
from pg_policies
where schemaname = 'public'
  and cmd = 'SELECT'
  and qual = 'true'
  and ('anon' = any(roles) or roles = '{public}')
  and tablename <> 'campaigns';
