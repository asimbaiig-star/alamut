-- Migration 013 — RLS policies that signup needs.
--
-- Bugs this fixes:
--
-- 1. public.brands had no INSERT policy at all (migration 001 line 79:
--    "No INSERT / DELETE policies for now — those happen via service_role
--    during admin/migration tasks. Phase 3 will revisit when brand
--    sign-up moves online."). Phase 3 didn't revisit. Brand signup
--    silently fails RLS, the mirror gets eaten by the silence-on-RLS
--    branch in fire-and-forget mirrors, and the brand row never lands
--    in Postgres. Cross-device sign-in (which queries brands.owner_email)
--    then misses, surfacing "no Alamut profile exists".
--
-- 2. public.creators INSERT was `with check (true)` (migration 004
--    line 114). Any authenticated user could insert a creator row
--    with any owner_email — a security hole. Tighten to owner-only.
--
-- After this migration: an auth'd user can INSERT exactly one row
-- with their own email as owner_email. Updates already work because
-- of the existing owner-gated UPDATE policies in 001 and 004.

-- =====================================================================
-- 1. brands INSERT — gate by owner email
-- =====================================================================
drop policy if exists "brands_insert_own" on public.brands;
create policy "brands_insert_own" on public.brands
  for insert to authenticated
  with check (auth.email() = owner_email);

-- =====================================================================
-- 2. creators INSERT — tighten from `true` to owner-email match
-- =====================================================================
drop policy if exists "creators_insert_auth" on public.creators;
drop policy if exists "creators_insert_own" on public.creators;
create policy "creators_insert_own" on public.creators
  for insert to authenticated
  with check (owner_email is not null and auth.email() = owner_email);

-- =====================================================================
-- 3. Verification (uncomment to run)
-- =====================================================================
-- select policyname, cmd, qual, with_check
-- from pg_policies
-- where tablename in ('brands','creators') and cmd = 'INSERT'
-- order by tablename, policyname;
