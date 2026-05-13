-- Migration 019 — tighten RLS on transactions, reviews, disputes,
-- and storage buckets for message-attachments + campaign-assets.
--
-- Backfills the per-party gating that earlier migrations explicitly
-- deferred (009/010/015/016 each carry a comment acknowledging the
-- `with check (true)` looseness as a known gap pending a userId→email
-- mapping).
--
-- Threat closed: pre-fix, any authenticated user could plant a
-- transactions / reviews / disputes row tied to a campaign or
-- collaboration they had no relationship with. Wallet balances stayed
-- safe (they live on properly-gated brand/creator rows), but planted
-- ledger rows showed up in another user's wallet view, planted
-- disputes could freeze another collab's escrow via the
-- `escrowFrozen` UI flag, and storage uploads to message-attachments /
-- campaign-assets accepted any path including paths owned by other
-- brands/threads.
--
-- Strategy: a new `is_participant_of_campaign(p_campaign_id text)`
-- helper that returns true when `auth.email()` matches either the
-- brand owner of the campaign OR a creator with an offer on it.
-- This is the same access boundary the existing brand-side and
-- creator-side workflows operate within.
--
-- TOPUPS exception: the only client-driven INSERT pattern that
-- legitimately has no campaign_id is `kind='topup'` (brand wallet
-- top-up via legacy `client.ts:topUpWallet`). We accept these without
-- a campaign gate — the worst case is a planted ledger row in
-- someone's view, since wallet balances are computed from the
-- properly-gated brand/creator rows, not from the ledger itself.
-- `referral_bonus` shares this carve-out (paid out by the legacy
-- referral path with no campaign association).

-- =====================================================================
-- 1. New helper — auth user is a campaign participant
-- =====================================================================
-- `is_participant_of_campaign` returns true when `auth.email()` matches:
--   (a) the campaign's brand owner, OR
--   (b) any creator that has either an application or an offer
--       on the campaign (i.e. a creator with any relationship to it).
--
-- Pre-existing helpers from migration 005 are reused; this just adds
-- the union behaviour.
create or replace function public.is_participant_of_campaign(p_campaign_id text)
returns boolean language sql stable security invoker as $$
  select exists (
    select 1
    from public.campaigns c
    join public.brands b on b.id = c.brand_id
    where c.id = p_campaign_id
      and b.owner_email = auth.email()
  )
  or exists (
    select 1
    from public.applications a
    join public.creators cr on cr.id = a.creator_id
    where a.campaign_id = p_campaign_id
      and cr.owner_email is not null
      and cr.owner_email = auth.email()
  )
  or exists (
    select 1
    from public.offers o
    join public.creators cr on cr.id = o.creator_id
    where o.campaign_id = p_campaign_id
      and cr.owner_email is not null
      and cr.owner_email = auth.email()
  );
$$;

-- =====================================================================
-- 2. Transactions — replace open INSERT policy with participant gate
-- =====================================================================
-- Allow rows with kind in (topup, referral_bonus) regardless of
-- campaign_id (legacy wallet paths). All other kinds require the
-- caller to be a participant on the linked campaign.
drop policy if exists "transactions_insert_authenticated" on public.transactions;
drop policy if exists "transactions_insert_gated" on public.transactions;
create policy "transactions_insert_gated" on public.transactions
  for insert to authenticated
  with check (
    -- Wallet top-ups + referral bonuses don't anchor on a campaign.
    (kind in ('topup', 'referral_bonus'))
    or
    -- Everything else (escrow_hold, escrow_release, payout, refund,
    -- fee, ad_spend) must reference a campaign the caller participates
    -- in. NULL campaign_id on these kinds is rejected.
    (campaign_id is not null and public.is_participant_of_campaign(campaign_id))
  );

-- =====================================================================
-- 3. Reviews — gate INSERT + UPDATE on participant
-- =====================================================================
drop policy if exists "reviews_insert_authenticated" on public.reviews;
drop policy if exists "reviews_insert_gated" on public.reviews;
create policy "reviews_insert_gated" on public.reviews
  for insert to authenticated
  with check (public.is_participant_of_campaign(campaign_id));

drop policy if exists "reviews_update_authenticated" on public.reviews;
drop policy if exists "reviews_update_gated" on public.reviews;
create policy "reviews_update_gated" on public.reviews
  for update to authenticated
  using (public.is_participant_of_campaign(campaign_id))
  with check (public.is_participant_of_campaign(campaign_id));

-- =====================================================================
-- 4. Disputes — gate INSERT + UPDATE on participant
-- =====================================================================
-- Also restrict UPDATE to the open / in-review states being mutated
-- by participants. Once a dispute is resolved-* or withdrawn it's
-- effectively immutable from the client side; admin updates would
-- bypass via service-role.
drop policy if exists "disputes_insert_authenticated" on public.disputes;
drop policy if exists "disputes_insert_gated" on public.disputes;
create policy "disputes_insert_gated" on public.disputes
  for insert to authenticated
  with check (public.is_participant_of_campaign(campaign_id));

drop policy if exists "disputes_update_authenticated" on public.disputes;
drop policy if exists "disputes_update_gated" on public.disputes;
create policy "disputes_update_gated" on public.disputes
  for update to authenticated
  using (public.is_participant_of_campaign(campaign_id))
  with check (public.is_participant_of_campaign(campaign_id));

-- =====================================================================
-- 5. Storage — campaign-assets bucket
-- =====================================================================
-- Path convention: `<campaign_id>/<filename>` (per migration 016
-- comment). Only the brand owner of `<campaign_id>` may write.
-- Read stays public (storefront-style consumption).
drop policy if exists "campaign_assets_insert" on storage.objects;
drop policy if exists "campaign_assets_insert_gated" on storage.objects;
create policy "campaign_assets_insert_gated" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'campaign-assets'
    and public.is_brand_owner_of_campaign(split_part(name, '/', 1))
  );

drop policy if exists "campaign_assets_delete" on storage.objects;
drop policy if exists "campaign_assets_delete_gated" on storage.objects;
create policy "campaign_assets_delete_gated" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'campaign-assets'
    and public.is_brand_owner_of_campaign(split_part(name, '/', 1))
  );

-- =====================================================================
-- 6. Storage — message-attachments bucket
-- =====================================================================
-- Path convention: `<thread_id>/<message_id>/<filename>`. Gate by
-- thread participant (campaign-derived: thread.campaign_id). For
-- threads without a campaign anchor (rare; dm-style messaging) the
-- existing authenticated-only check is preserved as a fallback.
drop policy if exists "message_attachments_insert" on storage.objects;
drop policy if exists "message_attachments_insert_gated" on storage.objects;
create policy "message_attachments_insert_gated" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'message-attachments'
    and (
      -- Thread-with-campaign: caller must participate in the campaign.
      exists (
        select 1 from public.threads t
        where t.id = split_part(name, '/', 1)
          and t.campaign_id is not null
          and public.is_participant_of_campaign(t.campaign_id)
      )
      or
      -- Thread-without-campaign (dm/cold-outreach): fall back to the
      -- authenticated-only behaviour. We can tighten this further once
      -- a userId→email mapping lands and we can verify the caller is
      -- in `t.participants`.
      exists (
        select 1 from public.threads t
        where t.id = split_part(name, '/', 1)
          and t.campaign_id is null
      )
    )
  );

drop policy if exists "message_attachments_delete" on storage.objects;
drop policy if exists "message_attachments_delete_gated" on storage.objects;
create policy "message_attachments_delete_gated" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'message-attachments'
    and exists (
      select 1 from public.threads t
      where t.id = split_part(name, '/', 1)
        and (
          (t.campaign_id is not null and public.is_participant_of_campaign(t.campaign_id))
          or t.campaign_id is null
        )
    )
  );

-- =====================================================================
-- 7. team_invites — add expires_at column
-- =====================================================================
-- Pre-fix tokens never expired — a leaked never-accepted invite was
-- a permanent liability for the brand owner. Client now stamps
-- createdAt + 14d on send and the v2AcceptTeamInvite mutation rejects
-- past-expiry tokens. Existing rows without `expires_at` are treated
-- as legacy / non-expiring at the app layer (the check skips when
-- the column is null), so this is a backwards-compatible addition.
alter table public.team_invites
  add column if not exists expires_at timestamptz;

-- =====================================================================
-- 8. Verification (uncomment to run while signed in)
-- =====================================================================
-- As hannah@aesop.test (brand owner of cmp_1):
--   select public.is_participant_of_campaign('cmp_1'); -- true
--   select public.is_participant_of_campaign('cmp_2'); -- false (Le Creuset)
-- As sarah@alamut.test (creator with offer on cmp_1):
--   select public.is_participant_of_campaign('cmp_1'); -- true (via offer)
--   select public.is_participant_of_campaign('cmp_2'); -- depends on her offers
--
-- Try a forbidden write as Sarah:
--   insert into public.transactions (id, at, user_id, kind, amount, campaign_id)
--   values ('tx_fake', now(), 'u_sarah', 'escrow_release', 500, 'cmp_2');
--   -- expected: row violates row-level security policy
--
-- Try a permitted write as Sarah on cmp_1 (she has an offer):
--   insert into public.transactions (id, at, user_id, kind, amount, campaign_id)
--   values ('tx_legit', now(), 'u_sarah', 'escrow_release', 500, 'cmp_1');
--   -- expected: success
--
-- Storage:
--   storage.foldername('cmp_1/brief.pdf')  -- ['cmp_1']
--   storage.foldername('thr_1/msg_1/x.png') -- ['thr_1','msg_1']
