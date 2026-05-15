-- Migration 028 — perf-warning sweep + creator_channel_verified view
--
-- After 027 the lint count went from 22 → 21. The remaining 21 split:
--   1   ERROR  security_definer_view (creator_channel_verified)
--   19  WARN   auth_rls_initplan — auth.email() called per-row in policies
--   1   WARN   auth_leaked_password_protection (dashboard-only)
--
-- This migration kills both the ERROR and the 19 perf warnings. The
-- one remaining warning after 028 lands is the dashboard toggle.

-- =====================================================================
-- 1. creator_channel_verified — switch to security_invoker
-- =====================================================================
-- Migration 024 created the view without setting security_invoker,
-- which means it runs with the view-owner's privileges (postgres) and
-- bypasses RLS. The view is read-only public data ("does this creator
-- have a non-expired token for this platform"), but defaulting to
-- definer is a footgun. Force invoker so RLS still applies if the
-- underlying table's policies ever change.

alter view public.creator_channel_verified set (security_invoker = on);

-- =====================================================================
-- 2. auth_rls_initplan — wrap auth.email() in (select ...) for caching
-- =====================================================================
-- Postgres re-evaluates `auth.email()` for every row when it appears
-- bare in a policy. Wrapping in `(select auth.email())` lets the
-- planner cache the value once per query (initplan) instead. Same
-- semantics, much faster at scale. Re-create each flagged policy.
--
-- Order: tables first, then storage. Each policy is dropped + recreated
-- with the optimized form. Bodies match what `pg_policies` reports —
-- we've manually swapped every `auth.email()` for `(select auth.email())`.

-- ─── brands ─────────────────────────────────────────────────────────
drop policy if exists "brands_insert_own" on public.brands;
create policy "brands_insert_own" on public.brands
  for insert to authenticated
  with check ((select auth.email()) = owner_email);

drop policy if exists "brands_select_owner" on public.brands;
create policy "brands_select_owner" on public.brands
  for select to authenticated
  using (owner_email is not null and (select auth.email()) = owner_email);

drop policy if exists "brands_update_own" on public.brands;
create policy "brands_update_own" on public.brands
  for update to authenticated
  using ((select auth.email()) = owner_email)
  with check ((select auth.email()) = owner_email);

-- ─── campaigns ──────────────────────────────────────────────────────
drop policy if exists "campaigns_insert_owner" on public.campaigns;
create policy "campaigns_insert_owner" on public.campaigns
  for insert to authenticated
  with check (
    exists (
      select 1 from public.brands
      where brands.id = campaigns.brand_id
        and brands.owner_email = (select auth.email())
    )
  );

drop policy if exists "campaigns_update_owner" on public.campaigns;
create policy "campaigns_update_owner" on public.campaigns
  for update to authenticated
  using (
    exists (
      select 1 from public.brands
      where brands.id = campaigns.brand_id
        and brands.owner_email = (select auth.email())
    )
  )
  with check (
    exists (
      select 1 from public.brands
      where brands.id = campaigns.brand_id
        and brands.owner_email = (select auth.email())
    )
  );

-- ─── creators ───────────────────────────────────────────────────────
drop policy if exists "creators_insert_own" on public.creators;
create policy "creators_insert_own" on public.creators
  for insert to authenticated
  with check (owner_email is not null and (select auth.email()) = owner_email);

drop policy if exists "creators_select_owner" on public.creators;
create policy "creators_select_owner" on public.creators
  for select to authenticated
  using (owner_email is not null and (select auth.email()) = owner_email);

drop policy if exists "creators_update_own" on public.creators;
create policy "creators_update_own" on public.creators
  for update to authenticated
  using (owner_email is not null and (select auth.email()) = owner_email)
  with check (owner_email is not null and (select auth.email()) = owner_email);

-- ─── notifications ──────────────────────────────────────────────────
drop policy if exists "notifications_select_own" on public.notifications;
create policy "notifications_select_own" on public.notifications
  for select to authenticated
  using (owner_email = (select auth.email()));

drop policy if exists "notifications_insert_authenticated" on public.notifications;
create policy "notifications_insert_authenticated" on public.notifications
  for insert to authenticated
  with check ((select auth.email()) is not null);

drop policy if exists "notifications_update_own" on public.notifications;
create policy "notifications_update_own" on public.notifications
  for update to authenticated
  using (owner_email = (select auth.email()))
  with check (owner_email = (select auth.email()));

drop policy if exists "notifications_delete_own" on public.notifications;
create policy "notifications_delete_own" on public.notifications
  for delete to authenticated
  using (owner_email = (select auth.email()));

-- ─── platform_tokens ────────────────────────────────────────────────
drop policy if exists "platform_tokens_select_own" on public.platform_tokens;
create policy "platform_tokens_select_own" on public.platform_tokens
  for select to authenticated
  using (owner_email = (select auth.email()));

drop policy if exists "platform_tokens_update_own" on public.platform_tokens;
create policy "platform_tokens_update_own" on public.platform_tokens
  for update to authenticated
  using (owner_email = (select auth.email()))
  with check (owner_email = (select auth.email()));

drop policy if exists "platform_tokens_delete_own" on public.platform_tokens;
create policy "platform_tokens_delete_own" on public.platform_tokens
  for delete to authenticated
  using (owner_email = (select auth.email()));

-- ─── outreach ───────────────────────────────────────────────────────
drop policy if exists "outreach_insert_gated" on public.outreach;
create policy "outreach_insert_gated" on public.outreach
  for insert to authenticated
  with check (
    exists (
      select 1 from public.brands
      where brands.id = outreach.brand_id
        and brands.owner_email = (select auth.email())
    )
  );

drop policy if exists "outreach_update_gated" on public.outreach;
create policy "outreach_update_gated" on public.outreach
  for update to authenticated
  using (
    exists (
      select 1 from public.brands
      where brands.id = outreach.brand_id
        and brands.owner_email = (select auth.email())
    )
  )
  with check (
    exists (
      select 1 from public.brands
      where brands.id = outreach.brand_id
        and brands.owner_email = (select auth.email())
    )
  );

-- ─── team_invites ───────────────────────────────────────────────────
drop policy if exists "team_invites_select" on public.team_invites;
create policy "team_invites_select" on public.team_invites
  for select to authenticated
  using (
    public.is_brand_owner_of_brand(brand_id)
    or lower(invited_email) = lower((select auth.email()))
  );

drop policy if exists "team_invites_update" on public.team_invites;
create policy "team_invites_update" on public.team_invites
  for update to authenticated
  using (
    public.is_brand_owner_of_brand(brand_id)
    or lower(invited_email) = lower((select auth.email()))
  )
  with check (
    public.is_brand_owner_of_brand(brand_id)
    or lower(invited_email) = lower((select auth.email()))
  );

-- =====================================================================
-- Verification (uncomment to run)
-- =====================================================================
-- select count(*) from pg_policies
-- where schemaname = 'public'
--   and qual::text like '%auth.email()%'
--   and qual::text not like '%(SELECT auth.email())%';
-- expected: 0  (no bare auth.email() left in any policy qual)
--
-- select c.relname, c.reloptions
-- from pg_class c join pg_namespace n on n.oid = c.relnamespace
-- where n.nspname = 'public' and c.relname = 'creator_channel_verified';
-- expected: reloptions includes 'security_invoker=true'
