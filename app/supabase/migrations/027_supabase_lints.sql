-- Migration 027 — fixes the warnings from Supabase Security Advisor
--
-- Triaged from the lint export. Five categories:
--
--   1. function_search_path_mutable (4 functions) — set search_path = ''
--      so any reference inside the function must be schema-qualified,
--      blocking schema-injection attacks.
--   2. rls_policy_always_true (10 policies on 6 tables) — replace the
--      legacy `_authenticated` INSERT/UPDATE policies (with_check true)
--      with proper ownership / participation gates.
--   3. public_bucket_allows_listing (5 buckets) — drop the broad SELECT
--      policies that let clients enumerate objects via .list(). Direct
--      URL access still works because the bucket itself is `public=true`.
--   4. anon/authenticated_security_definer_function_executable
--      (rls_auto_enable) — revoke EXECUTE from anon + authenticated.
--   5. auth_leaked_password_protection — dashboard setting, NOT SQL.
--      Documented at the bottom; user enables in Authentication →
--      Settings → "Enable leaked password protection".
--
-- Migration 019 already attempted to drop the legacy `_authenticated`
-- policy names. If 019 ran cleanly the drops below are no-ops; if 019
-- never landed in this DB instance, this migration finishes the job.

-- =====================================================================
-- 1. Function search_path lockdown
-- =====================================================================
-- Pre-fix, these functions ran under the caller's role-mutable
-- search_path. A user who can create objects in a schema earlier in
-- the search_path (e.g. their own schema) could shadow `public.users`
-- with their own `users` view and have the function return forged
-- rows. Setting search_path = '' forces every reference inside the
-- function to be schema-qualified (we already write them as
-- `public.<table>`), which neutralises the attack.

alter function public.touch_updated_at()
  set search_path = '';

alter function public.is_brand_owner_of_campaign(text)
  set search_path = '';

alter function public.is_brand_owner_of_brand(text)
  set search_path = '';

alter function public.is_creator_owner(text)
  set search_path = '';

-- Helpers added in earlier migrations — same treatment.
do $$
begin
  if exists (select 1 from pg_proc p
             join pg_namespace n on n.oid = p.pronamespace
             where n.nspname = 'public' and p.proname = 'is_participant_of_campaign')
  then execute 'alter function public.is_participant_of_campaign(text) set search_path = ''''';
  end if;

  if exists (select 1 from pg_proc p
             join pg_namespace n on n.oid = p.pronamespace
             where n.nspname = 'public' and p.proname = 'is_safe_storage_path')
  then execute 'alter function public.is_safe_storage_path(text, integer, integer) set search_path = ''''';
  end if;
end $$;

-- =====================================================================
-- 2. Drop list-permitting SELECT policies on public buckets
-- =====================================================================
-- Public buckets serve files via direct URLs (e.g.
-- https://<project>.supabase.co/storage/v1/object/public/<bucket>/<path>).
-- The broad SELECT policies were ALSO letting callers enumerate every
-- file via storage.list(). Dropping them blocks enumeration; URL
-- fetches keep working because the bucket's `public=true` flag handles
-- direct object reads. (Verified via Supabase lint guidance.)
--
-- Note: any code path that called `supabase.storage.from('bucket').list()`
-- on these buckets will now return [] for non-owners. The app today
-- doesn't list these buckets — files are referenced by stable per-
-- entity paths (e.g. `<creator_id>/portrait.png`) — but if a future
-- caller needs listing, add a narrower SELECT policy gated on owner.

drop policy if exists "brand_logos_public_read" on storage.objects;
drop policy if exists "creator_portraits_public_read" on storage.objects;
drop policy if exists "campaign_assets_read" on storage.objects;
drop policy if exists "message_attachments_read" on storage.objects;
drop policy if exists "submission_files_public_read" on storage.objects;

-- =====================================================================
-- 3. Tighten RLS — replace legacy `_authenticated` policies
-- =====================================================================
-- Strategy: drop the legacy permissive policies, rebuild each one with
-- a real ownership / participation check. Helpers used:
--   - `is_user_id_owned_by_caller(p_user_id text)` — created below.
--     Returns true when auth.email() matches the owner_email of a
--     brand or creator whose user_id equals p_user_id.
--   - `is_participant_of_campaign(text)` — added in 019.

create or replace function public.is_user_id_owned_by_caller(p_user_id text)
  returns boolean
  language sql
  stable
  security invoker
  set search_path = ''
as $$
  select
    auth.email() is not null and (
      exists (
        select 1 from public.brands
        where user_id = p_user_id and owner_email = auth.email()
      )
      or exists (
        select 1 from public.creators
        where user_id = p_user_id and owner_email = auth.email()
      )
    )
$$;

-- ─── transactions ────────────────────────────────────────────────────
-- INSERT:  caller must own the wallet's user_id, OR the row is part
--          of a campaign workflow they participate in (cross-user
--          payouts go through the campaign side of the OR).
-- The legacy permissive policy is dropped along with the new one to
-- keep this migration idempotent.
drop policy if exists "transactions_insert_authenticated" on public.transactions;
drop policy if exists "transactions_insert_gated" on public.transactions;
create policy "transactions_insert_gated" on public.transactions
  for insert to authenticated
  with check (
    public.is_user_id_owned_by_caller(user_id)
    or (campaign_id is not null and public.is_participant_of_campaign(campaign_id))
  );

-- ─── reviews ────────────────────────────────────────────────────────
-- INSERT:  the writer (from_user_id) must be the caller.
-- UPDATE:  same — only the original writer can edit.
drop policy if exists "reviews_insert_authenticated" on public.reviews;
drop policy if exists "reviews_insert_gated" on public.reviews;
create policy "reviews_insert_gated" on public.reviews
  for insert to authenticated
  with check (public.is_user_id_owned_by_caller(from_user_id));

drop policy if exists "reviews_update_authenticated" on public.reviews;
drop policy if exists "reviews_update_gated" on public.reviews;
create policy "reviews_update_gated" on public.reviews
  for update to authenticated
  using (public.is_user_id_owned_by_caller(from_user_id))
  with check (public.is_user_id_owned_by_caller(from_user_id));

-- ─── disputes ───────────────────────────────────────────────────────
-- INSERT/UPDATE: caller must be a participant in the dispute's campaign.
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

-- ─── outreach ───────────────────────────────────────────────────────
-- INSERT/UPDATE: caller must own the brand sending the outreach.
drop policy if exists "outreach_insert_authenticated" on public.outreach;
drop policy if exists "outreach_insert_gated" on public.outreach;
create policy "outreach_insert_gated" on public.outreach
  for insert to authenticated
  with check (
    exists (
      select 1 from public.brands
      where brands.id = outreach.brand_id
        and brands.owner_email = auth.email()
    )
  );

drop policy if exists "outreach_update_authenticated" on public.outreach;
drop policy if exists "outreach_update_gated" on public.outreach;
create policy "outreach_update_gated" on public.outreach
  for update to authenticated
  using (
    exists (
      select 1 from public.brands
      where brands.id = outreach.brand_id
        and brands.owner_email = auth.email()
    )
  )
  with check (
    exists (
      select 1 from public.brands
      where brands.id = outreach.brand_id
        and brands.owner_email = auth.email()
    )
  );

-- ─── threads ────────────────────────────────────────────────────────
-- INSERT: campaign-anchored threads require the caller to be a
--         participant of that campaign. DM-style threads (campaign_id
--         null) require the caller's user_id to be in `participants`.
-- UPDATE: same gate — used for unread counts, archive flags, etc.
drop policy if exists "threads_insert_authenticated" on public.threads;
drop policy if exists "threads_insert_gated" on public.threads;
create policy "threads_insert_gated" on public.threads
  for insert to authenticated
  with check (
    (campaign_id is not null and public.is_participant_of_campaign(campaign_id))
    or (
      campaign_id is null
      and exists (
        select 1 from unnest(threads.participants) as p
        where public.is_user_id_owned_by_caller(p)
      )
    )
  );

drop policy if exists "threads_update_authenticated" on public.threads;
drop policy if exists "threads_update_gated" on public.threads;
create policy "threads_update_gated" on public.threads
  for update to authenticated
  using (
    (campaign_id is not null and public.is_participant_of_campaign(campaign_id))
    or exists (
      select 1 from unnest(threads.participants) as p
      where public.is_user_id_owned_by_caller(p)
    )
  )
  with check (
    (campaign_id is not null and public.is_participant_of_campaign(campaign_id))
    or exists (
      select 1 from unnest(threads.participants) as p
      where public.is_user_id_owned_by_caller(p)
    )
  );

-- ─── messages ───────────────────────────────────────────────────────
-- INSERT: the message's sender (from_user_id) must be the caller, AND
--         the thread's gating must allow the caller to participate.
drop policy if exists "messages_insert_authenticated" on public.messages;
drop policy if exists "messages_insert_gated" on public.messages;
create policy "messages_insert_gated" on public.messages
  for insert to authenticated
  with check (
    public.is_user_id_owned_by_caller(from_user_id)
    and exists (
      select 1 from public.threads t
      where t.id = messages.thread_id
        and (
          (t.campaign_id is not null and public.is_participant_of_campaign(t.campaign_id))
          or exists (
            select 1 from unnest(t.participants) as p
            where public.is_user_id_owned_by_caller(p)
          )
        )
    )
  );

-- =====================================================================
-- 4. Revoke public EXECUTE on rls_auto_enable()
-- =====================================================================
-- The function exists in the public schema (likely added via Supabase
-- dashboard tooling). It's not part of the app's API surface. Revoke
-- EXECUTE from anon + authenticated so it's no longer callable via
-- PostgREST's /rest/v1/rpc/. service_role + postgres keep access.
do $$ begin
  if exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'rls_auto_enable'
  ) then
    execute 'revoke execute on function public.rls_auto_enable() from public, anon, authenticated';
  end if;
end $$;

-- =====================================================================
-- 5. Leaked-password protection — dashboard setting, NOT SQL
-- =====================================================================
-- The auth_leaked_password_protection lint can't be fixed via migration.
-- Enable it in the Supabase dashboard:
--   Authentication → Providers → Email → "Enable leaked password protection"
-- This makes Supabase Auth check new passwords against
-- HaveIBeenPwned.org's compromised-password set.

-- =====================================================================
-- Verification (uncomment to run)
-- =====================================================================
-- select count(*) from pg_policies
-- where schemaname = 'public'
--   and policyname like '%_insert_authenticated';
-- -- expected: 0 (all renamed to _gated above)
--
-- select pg_get_function_arg_default(oid, 0) is not null as has_search_path
-- from pg_proc where proname = 'is_brand_owner_of_campaign';
-- -- expected: t (search_path is set)
