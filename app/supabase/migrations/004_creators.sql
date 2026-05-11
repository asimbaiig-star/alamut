-- Phase 5 — migrate the Creator entity from Zustand seed → Postgres.
-- Run once in Supabase SQL Editor. Idempotent.
--
-- Standalone schema-wise (no FK dependencies), but conceptually paired
-- with offers + applications which already reference creator_id as
-- text. After this migration we can tighten Phase 4's broad RLS to
-- per-party rules ('the offer's creator can counter / withdraw').

-- =====================================================================
-- 1. creators table
-- =====================================================================
create table if not exists public.creators (
  -- Keep text id format ('c_sarah', 'c_g42') matching local seed +
  -- existing offer/application/collab references.
  id text primary key,

  -- Legacy local user id (e.g. u_sarah). Not used for auth.
  user_id text not null,

  -- Email of the auth.users row that owns this creator profile.
  -- Same pattern as brands.owner_email — coordinate by email since
  -- Phase 1's sign-in bridge maps Supabase auth users → local seed
  -- via email. Nullable so generated creator rows whose users don't
  -- yet exist in auth.users can still be seeded.
  owner_email text,

  -- Identity / public profile
  name text not null,
  handle text not null,
  tagline text not null default '',
  bio text not null default '',
  cover text,
  portrait text not null default '',
  city text not null default '',
  country text not null default '',

  -- Arrays — small + flat, fine as text[]
  languages text[] not null default '{}',
  categories text[] not null default '{}',
  work text[] not null default '{}',
  past_clients text[] not null default '{}',

  -- Platforms + their per-platform audience demographics. Stored as
  -- JSONB so the nested `audience` object (age buckets, gender split,
  -- top countries, growth, suspicious follower %) round-trips
  -- without flattening.
  platforms jsonb not null default '[]',

  -- Aggregate metrics
  reach integer not null default 0,
  engagement numeric not null default 0,
  rating numeric not null default 0,
  tier text not null default 'Rising'
    check (tier in ('Rising', 'Specialist', 'Flagship')),
  response_hrs numeric not null default 0,

  -- Rate cards — legacy single-card object + the newer per-platform array
  rate_card jsonb not null default '{}',
  rate_cards jsonb,

  -- Payout config
  payout jsonb not null default '{}',

  -- Balances
  wallet_balance numeric not null default 0,
  pending_balance numeric not null default 0,
  lifetime_earnings numeric not null default 0,

  -- Status flags
  verified boolean not null default false,
  kyc_verified_at timestamptz,
  editors_pick boolean default false,

  -- Soft data
  press_mentions jsonb not null default '[]',
  availability jsonb,
  featured_review_ids text[] not null default '{}',

  -- Creator-side saved briefs (Phase 2 added this to the Brand type)
  saved_briefs text[] not null default '{}',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists creators_handle_idx on public.creators (handle);
create index if not exists creators_owner_email_idx on public.creators (owner_email);
create index if not exists creators_tier_idx on public.creators (tier);
create index if not exists creators_categories_gin on public.creators using gin (categories);

drop trigger if exists creators_touch on public.creators;
create trigger creators_touch
  before update on public.creators
  for each row execute function public.touch_updated_at();

-- =====================================================================
-- 2. Row Level Security
-- =====================================================================
-- Creators are public-readable (storefronts are public, brand-side
-- Discover needs the full set).
-- INSERT + UPDATE: authenticated; UPDATE additionally gated on
-- `auth.email() = owner_email` so only the creator themselves can
-- edit their profile. Per the Supabase skill the UPDATE policy
-- depends on the SELECT policy returning the row, which the public
-- SELECT covers.
alter table public.creators enable row level security;

drop policy if exists "creators_select_all" on public.creators;
create policy "creators_select_all" on public.creators
  for select using (true);

drop policy if exists "creators_insert_auth" on public.creators;
create policy "creators_insert_auth" on public.creators
  for insert to authenticated with check (true);

drop policy if exists "creators_update_own" on public.creators;
create policy "creators_update_own" on public.creators
  for update to authenticated
  using (owner_email is not null and auth.email() = owner_email)
  with check (owner_email is not null and auth.email() = owner_email);

-- =====================================================================
-- 3. Storage bucket for creator portraits
-- =====================================================================
-- Public bucket so portrait URLs render without signed-URL juggling.
-- File-path convention: <creator_id>/portrait.<ext>. RLS scopes
-- write access to the creator who owns the row.
insert into storage.buckets (id, name, public)
values ('creator-portraits', 'creator-portraits', true)
on conflict (id) do nothing;

drop policy if exists "creator_portraits_public_read" on storage.objects;
create policy "creator_portraits_public_read" on storage.objects
  for select using (bucket_id = 'creator-portraits');

drop policy if exists "creator_portraits_owner_insert" on storage.objects;
create policy "creator_portraits_owner_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'creator-portraits'
    and exists (
      select 1 from public.creators
      where creators.id = split_part(storage.objects.name, '/', 1)
      and creators.owner_email = auth.email()
    )
  );

drop policy if exists "creator_portraits_owner_update" on storage.objects;
create policy "creator_portraits_owner_update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'creator-portraits'
    and exists (
      select 1 from public.creators
      where creators.id = split_part(storage.objects.name, '/', 1)
      and creators.owner_email = auth.email()
    )
  );

drop policy if exists "creator_portraits_owner_delete" on storage.objects;
create policy "creator_portraits_owner_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'creator-portraits'
    and exists (
      select 1 from public.creators
      where creators.id = split_part(storage.objects.name, '/', 1)
      and creators.owner_email = auth.email()
    )
  );

-- =====================================================================
-- 4. Seed: 3 hand-authored creators that hand-authored campaigns/offers
--    already reference (Sarah on cmp_1/off_1, Yuki on cmp_3/app_2,
--    Amir on cmp_4/off_4). Only Sarah has an auth user (sarah@alamut.test
--    was created in Phase 1); Yuki + Amir get owner_email = null which
--    leaves their rows read-only (no real owner to authorise edits).
-- =====================================================================
insert into public.creators (
  id, user_id, owner_email,
  name, handle, tagline, bio,
  city, country, languages, categories, portrait,
  platforms, reach, engagement, rating, tier, response_hrs,
  rate_card, payout,
  wallet_balance, pending_balance, lifetime_earnings,
  verified, press_mentions, past_clients, availability
) values
  (
    'c_sarah', 'u_sarah', 'sarah@alamut.test',
    'Sarah Johnson', '@sarahstyle',
    'Sustainable fashion & conscious living.',
    'Editor-turned-creator building a community around quiet luxury, slow fashion, and things worth keeping.',
    'New York', 'USA',
    array['English'],
    array['Fashion','Lifestyle','Sustainability'],
    'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=600&h=750&fit=crop&auto=format',
    jsonb_build_array(
      jsonb_build_object(
        'name', 'Instagram', 'handle', '@sarahstyle',
        'followers', 142000, 'engagement', 5.2, 'verified', true
      ),
      jsonb_build_object(
        'name', 'TikTok', 'handle', '@sarahstyle',
        'followers', 58000, 'engagement', 7.1, 'verified', true
      ),
      jsonb_build_object(
        'name', 'Newsletter', 'handle', 'sarahstyle.substack.com',
        'followers', 8400, 'engagement', 42, 'verified', false
      )
    ),
    208400, 5.2, 4.9, 'Flagship', 3,
    jsonb_build_object(
      'post', '$800–1,500', 'reel', '$1,000–2,000',
      'story', '$300–600', 'longform', '—'
    ),
    jsonb_build_object('method', 'ACH', 'account', 'Chase ••• 4421', 'currency', 'USD'),
    4200, 3400, 47800,
    true,
    jsonb_build_array(
      jsonb_build_object('source', 'Vogue', 'title', 'The new wave of sustainable creators', 'year', 2025)
    ),
    array['Aesop','Glossier','Le Labo'],
    jsonb_build_object(
      'status', 'limited',
      'untilDate', to_char((now() + interval '30 days')::date, 'YYYY-MM-DD'),
      'note', 'Booked for May — open from June 1.'
    )
  ),
  (
    'c_amir', 'u_amir', null,
    'Amir Hussain', '@amircooks',
    'Modern South Asian food, properly made.',
    'Karachi-born, London-trained chef sharing recipes from the home kitchens I grew up in.',
    'Lahore', 'Pakistan',
    array['English','Urdu'],
    array['Food','Lifestyle','Travel'],
    'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=600&h=750&fit=crop&auto=format',
    jsonb_build_array(
      jsonb_build_object('name', 'Instagram', 'handle', '@amircooks', 'followers', 89000, 'engagement', 6.4, 'verified', true),
      jsonb_build_object('name', 'YouTube',   'handle', 'AmirCooks',  'followers', 24000, 'engagement', 4.1, 'verified', true)
    ),
    113000, 5.6, 4.8, 'Specialist', 6,
    jsonb_build_object(
      'post', '$500–900', 'reel', '$700–1,400',
      'story', '$200–400', 'longform', '$2,000+'
    ),
    jsonb_build_object('method', 'Wise', 'account', 'Wise USD ••• 8821', 'currency', 'USD'),
    1800, 2200, 18400,
    true,
    jsonb_build_array(
      jsonb_build_object('source', 'Dawn', 'title', 'Recipes worth keeping', 'year', 2024)
    ),
    array['Le Creuset','National Foods'],
    null
  ),
  (
    'c_yuki', 'u_yuki', null,
    'Yuki Tanaka', '@yuki.makes',
    'Quiet objects, considered design.',
    'Industrial designer documenting workshop life and the things that come out of it.',
    'Kyoto', 'Japan',
    array['Japanese','English'],
    array['Design','Lifestyle','Interiors'],
    'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=600&h=750&fit=crop&auto=format',
    jsonb_build_array(
      jsonb_build_object('name', 'Instagram', 'handle', '@yuki.makes', 'followers', 64000, 'engagement', 8.1, 'verified', true),
      jsonb_build_object('name', 'YouTube',   'handle', 'YukiMakes',   'followers', 18000, 'engagement', 6.5, 'verified', true)
    ),
    82000, 7.3, 4.95, 'Specialist', 8,
    jsonb_build_object(
      'post', '$600–1,100', 'reel', '$900–1,800',
      'story', '$250–500', 'longform', '$2,500+'
    ),
    jsonb_build_object('method', 'Stripe', 'account', 'Stripe Connect (JP)', 'currency', 'JPY'),
    0, 1500, 9800,
    true,
    jsonb_build_array(
      jsonb_build_object('source', 'Apartamento', 'title', 'Workshop in Kyoto', 'year', 2024)
    ),
    array['Muji'],
    jsonb_build_object('status', 'open', 'note', 'Open for design + lifestyle briefs through Q2.')
  )
on conflict (id) do nothing;

-- =====================================================================
-- 5. Verification (uncomment to run after migration)
-- =====================================================================
-- select id, name, handle, owner_email, tier,
--   jsonb_array_length(platforms) as platform_count,
--   array_length(categories, 1) as cat_count
-- from public.creators order by created_at;
