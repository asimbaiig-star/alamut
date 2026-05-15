-- Migration 025 — PII lockdown on creators + brands (Phase 52, security)
--
-- CRITICAL — pre-fix the `creators_select_all` and `brands_select_all`
-- policies (`for select using (true)`) exposed every column of every
-- row to anonymous + authenticated readers. That includes:
--
--   creators.payout         — bank account / IBAN
--   creators.wallet_balance — current cash
--   creators.pending_balance
--   creators.lifetime_earnings
--   creators.owner_email    — contact email
--   brands.owner_email      — contact email
--   brands.wallet_balance   — escrow available
--   brands.escrow_held      — funds locked in campaigns
--
-- Storefronts + Discover legitimately need most columns of every creator,
-- but they don't need any of those. The fix:
--
--   1. Create `creators_public` + `brands_public` views that omit
--      sensitive columns. Grant SELECT to anon + authenticated.
--   2. Tighten the raw-table SELECT policies to owner-only — only the
--      row owner sees the full record (including their own payout +
--      balances). Other authenticated users can't read the raw table.
--   3. Keep the existing UPDATE / INSERT / DELETE policies untouched —
--      those already gate by `auth.email() = owner_email`.
--
-- Migration is fully reversible. To roll back:
--   alter table public.creators
--     drop policy if exists "creators_select_owner_or_anon_via_view";
--   create policy "creators_select_all" on public.creators
--     for select using (true);
--   drop view if exists public.creators_public;
--   (likewise for brands)

-- =====================================================================
-- 1. Sanitized public views — what storefronts + Discover actually need
-- =====================================================================
-- View has security_invoker=on so the underlying RLS policies still
-- apply when someone queries it. Combined with the new owner-only
-- SELECT policy below, the view exposes only the safe columns.
--
-- security_invoker is the default in Postgres 15+; setting it
-- explicitly so the intent is clear regardless of server version.

drop view if exists public.creators_public;
create view public.creators_public
  with (security_invoker=on) as
  select
    id, user_id, name, handle, tagline, bio, cover, portrait,
    city, country, languages, categories, work, past_clients,
    platforms, reach, engagement, rating, tier, response_hrs,
    rate_card, rate_cards, verified, kyc_verified_at, editors_pick,
    press_mentions, availability, featured_review_ids, saved_briefs,
    version, created_at, updated_at
  from public.creators;

-- Brands view — drop owner_email + wallet_balance + escrow_held.
-- Public surfaces (Discover Brands page, brief headers) need name,
-- industry, logo, about, verified badge — that's it.
drop view if exists public.brands_public;
create view public.brands_public
  with (security_invoker=on) as
  select
    id, user_id, name, industry, hq, website, about, logo_mark, logo_url,
    preferred_categories, preferred_regions, verified, saved_creators,
    social_platforms, version
  from public.brands;

-- =====================================================================
-- 2. Tighten raw-table SELECT policies — owner-only
-- =====================================================================
-- The view bypasses RLS via security_invoker=on still applying the
-- POLICY check on the underlying table. So we need the underlying
-- policy to allow EITHER (owner) OR (read through the view).
-- Postgres can't tell "called from view vs called directly" — so the
-- policy itself stays owner-only, and we expose the view to anon.

drop policy if exists "creators_select_all" on public.creators;
drop policy if exists "creators_select_owner" on public.creators;
create policy "creators_select_owner" on public.creators
  for select using (
    -- Owner sees their own row in full.
    owner_email is not null and auth.email() = owner_email
  );

drop policy if exists "brands_select_all" on public.brands;
drop policy if exists "brands_select_owner" on public.brands;
create policy "brands_select_owner" on public.brands
  for select using (
    -- Owner (or team member resolved by capability layer) sees their
    -- own brand record in full. Cross-brand reads go through brands_public.
    owner_email is not null and auth.email() = owner_email
  );

-- =====================================================================
-- 3. Grant SELECT on the views to public roles
-- =====================================================================
grant select on public.creators_public to anon, authenticated;
grant select on public.brands_public to anon, authenticated;

-- =====================================================================
-- 4. Verification (uncomment to run)
-- =====================================================================
-- As anon: SELECT works on the views, fails on raw tables for sensitive cols.
-- set role anon;
-- select count(*) from public.creators_public;     -- should succeed
-- select count(*) from public.creators;            -- should return 0 rows (RLS blocks)
-- reset role;
