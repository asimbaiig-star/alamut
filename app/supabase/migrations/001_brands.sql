-- Phase 2 — migrate the Brand entity from Zustand seed → Postgres.
-- Run this once in Supabase SQL Editor (Dashboard → SQL Editor → New query).
-- Idempotent: every CREATE / INSERT is guarded so re-running is safe.

-- =====================================================================
-- 1. brands table
-- =====================================================================
create table if not exists public.brands (
  -- Keep the legacy text id format ("b_aesop") so we don't need to
  -- coordinate UUIDs across the local seed and existing campaign FKs
  -- during the migration. Phase 3 will keep the same pattern.
  id text primary key,
  -- Legacy local user id (e.g. u_hannah) for forward compat with the
  -- in-store data; not used for auth.
  user_id text not null,
  -- Email of the auth.users row that owns this brand. RLS uses this
  -- as the join key — see policy below. We use email (not user id)
  -- because the local seed and Supabase auth users are coordinated
  -- by email in Phase 1's sign-in bridge.
  owner_email text not null,
  name text not null,
  industry text not null default '',
  hq text not null default '',
  website text not null default '',
  about text not null default '',
  logo_mark text,
  logo_url text,
  preferred_categories text[] not null default '{}',
  preferred_regions text[] not null default '{}',
  wallet_balance numeric not null default 0,
  escrow_held numeric not null default 0,
  verified boolean not null default false,
  saved_creators text[] not null default '{}',
  social_platforms jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Helpful indexes — owner_email for RLS lookups, name for case-insensitive
-- brand search later.
create index if not exists brands_owner_email_idx on public.brands (owner_email);
create index if not exists brands_name_lower_idx on public.brands (lower(name));

-- =====================================================================
-- 2. updated_at auto-touch
-- =====================================================================
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists brands_touch on public.brands;
create trigger brands_touch
  before update on public.brands
  for each row execute function public.touch_updated_at();

-- =====================================================================
-- 3. Row Level Security
-- =====================================================================
-- Brand pages are public-readable (creators on Browse campaigns need
-- to see brand info on every tile). Only the owner can edit. Per the
-- Supabase skill: UPDATE policy needs a SELECT policy too — the
-- brands_select_all policy below covers that.
alter table public.brands enable row level security;

drop policy if exists "brands_select_all" on public.brands;
create policy "brands_select_all" on public.brands
  for select using (true);

drop policy if exists "brands_update_own" on public.brands;
create policy "brands_update_own" on public.brands
  for update to authenticated
  using (auth.email() = owner_email)
  with check (auth.email() = owner_email);

-- No INSERT / DELETE policies for now — those happen via service_role
-- during admin/migration tasks. Phase 3 will revisit when brand sign-up
-- moves online.

-- =====================================================================
-- 4. Storage bucket for brand logos
-- =====================================================================
-- Public bucket so the logo URL renders without signed-URL juggling on
-- the client. Files are namespaced by brand id: e.g. b_aesop/logo.png.
insert into storage.buckets (id, name, public)
values ('brand-logos', 'brand-logos', true)
on conflict (id) do nothing;

-- Storage RLS: public read (bucket is public anyway, but the policy
-- is required for the Data API to serve files). Owner writes for
-- INSERT / UPDATE / DELETE — file path's first segment must match a
-- brand the auth.email owns.
drop policy if exists "brand_logos_public_read" on storage.objects;
create policy "brand_logos_public_read" on storage.objects
  for select using (bucket_id = 'brand-logos');

drop policy if exists "brand_logos_owner_insert" on storage.objects;
create policy "brand_logos_owner_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'brand-logos'
    and exists (
      select 1 from public.brands
      where brands.id = split_part(storage.objects.name, '/', 1)
      and brands.owner_email = auth.email()
    )
  );

drop policy if exists "brand_logos_owner_update" on storage.objects;
create policy "brand_logos_owner_update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'brand-logos'
    and exists (
      select 1 from public.brands
      where brands.id = split_part(storage.objects.name, '/', 1)
      and brands.owner_email = auth.email()
    )
  );

drop policy if exists "brand_logos_owner_delete" on storage.objects;
create policy "brand_logos_owner_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'brand-logos'
    and exists (
      select 1 from public.brands
      where brands.id = split_part(storage.objects.name, '/', 1)
      and brands.owner_email = auth.email()
    )
  );

-- =====================================================================
-- 5. Seed the two hand-authored demo brands
-- =====================================================================
-- The local seed has ~80 brands but only Aesop and Le Creuset have
-- hand-authored profiles + real auth users created in Phase 1.
-- Generated brands (b_gb*) live only in the local store for now and
-- will migrate when their owners exist in auth.users.
insert into public.brands (
  id, user_id, owner_email,
  name, industry, hq, website, about, logo_mark,
  preferred_categories, preferred_regions,
  wallet_balance, escrow_held, verified, saved_creators
) values
  (
    'b_aesop', 'u_hannah', 'hannah@aesop.test',
    'Aesop', 'Beauty / Personal care', 'Melbourne, AU', 'aesop.com',
    'Aesop has carefully curated a range of skin, hair and body care formulations.',
    'A',
    array['Lifestyle','Beauty','Wellness','Design'],
    array['US','UK','EU','APAC'],
    48200, 5400, true,
    array['c_sarah','c_yuki']
  ),
  (
    'b_lecreuset', 'u_marcus', 'marcus@lecreuset.test',
    'Le Creuset', 'Home / Kitchenware', 'Fresnoy-le-Grand, FR', 'lecreuset.com',
    'Cast iron cookware and culinary tools handcrafted in France since 1925.',
    'L',
    array['Food','Lifestyle','Design'],
    array['US','UK','EU','LATAM'],
    22800, 0, true,
    array['c_amir']
  )
on conflict (id) do nothing;

-- =====================================================================
-- 6. Verification queries (uncomment to test)
-- =====================================================================
-- Sanity-check after running:
--   select id, name, owner_email, verified, array_length(preferred_categories, 1) as cat_count
--     from public.brands order by created_at;
-- RLS check (run as authenticated hannah@aesop.test — should return only b_aesop on update path):
--   select id from public.brands where auth.email() = owner_email;
