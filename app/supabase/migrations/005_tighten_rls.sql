-- Phase 5b — tighten RLS on offers + applications now that
-- public.creators carries auth-coupled owner_email values.
--
-- Before this: every authenticated user could write any offer or
-- application (Phase 4 used `with check (true)` because creator
-- owners couldn't be identified yet).
-- After this: per-party gating — brand owner of the campaign OR
-- creator owner of the offer/application — using two reusable
-- security-invoker helper functions.

-- =====================================================================
-- 1. Reusable membership helpers
-- =====================================================================
-- security invoker — runs as the caller, so the helper inherits
-- the caller's RLS context. The brands_select_all + creators_select_all
-- policies from 001/004 mean the inner SELECTs always see their
-- rows; only the join + email check filter the result.

create or replace function public.is_brand_owner_of_campaign(p_campaign_id text)
returns boolean language sql stable security invoker as $$
  select exists (
    select 1
    from public.brands b
    join public.campaigns c on c.brand_id = b.id
    where c.id = p_campaign_id
      and b.owner_email = auth.email()
  );
$$;

create or replace function public.is_creator_owner(p_creator_id text)
returns boolean language sql stable security invoker as $$
  select exists (
    select 1
    from public.creators cr
    where cr.id = p_creator_id
      and cr.owner_email is not null
      and cr.owner_email = auth.email()
  );
$$;

-- =====================================================================
-- 2. Offers — drop broad policies, replace with per-party gates
-- =====================================================================
-- INSERT: only the brand owner of the campaign. Creators never
-- create offers (they apply via applications and accept via update).
drop policy if exists "offers_insert_auth" on public.offers;
drop policy if exists "offers_insert_brand_owner" on public.offers;
create policy "offers_insert_brand_owner" on public.offers
  for insert to authenticated
  with check (public.is_brand_owner_of_campaign(campaign_id));

-- UPDATE: brand owner (counter-back, accept, decline-from-brand,
-- withdraw) OR creator owner (counter, accept, decline-from-creator).
-- Per the Supabase skill, UPDATE needs a SELECT policy too — the
-- public offers_select_all from 003 covers that.
drop policy if exists "offers_update_auth" on public.offers;
drop policy if exists "offers_update_owner_or_creator" on public.offers;
create policy "offers_update_owner_or_creator" on public.offers
  for update to authenticated
  using (
    public.is_brand_owner_of_campaign(campaign_id)
    or public.is_creator_owner(creator_id)
  )
  with check (
    public.is_brand_owner_of_campaign(campaign_id)
    or public.is_creator_owner(creator_id)
  );

-- =====================================================================
-- 3. Applications — same shape
-- =====================================================================
-- INSERT: only the creator (creators apply to briefs).
drop policy if exists "applications_insert_auth" on public.applications;
drop policy if exists "applications_insert_creator_owner" on public.applications;
create policy "applications_insert_creator_owner" on public.applications
  for insert to authenticated
  with check (public.is_creator_owner(creator_id));

-- UPDATE: brand owner (shortlist, reject) OR creator owner (withdraw).
drop policy if exists "applications_update_auth" on public.applications;
drop policy if exists "applications_update_owner_or_creator" on public.applications;
create policy "applications_update_owner_or_creator" on public.applications
  for update to authenticated
  using (
    public.is_brand_owner_of_campaign(campaign_id)
    or public.is_creator_owner(creator_id)
  )
  with check (
    public.is_brand_owner_of_campaign(campaign_id)
    or public.is_creator_owner(creator_id)
  );

-- =====================================================================
-- 4. Verification (uncomment, run while signed in)
-- =====================================================================
-- As hannah@aesop.test:
--   select public.is_brand_owner_of_campaign('cmp_1'); -- true
--   select public.is_brand_owner_of_campaign('cmp_2'); -- false (Le Creuset's)
--   select public.is_creator_owner('c_sarah');         -- false
-- As sarah@alamut.test:
--   select public.is_brand_owner_of_campaign('cmp_1'); -- false
--   select public.is_creator_owner('c_sarah');         -- true
--   select public.is_creator_owner('c_yuki');          -- false
