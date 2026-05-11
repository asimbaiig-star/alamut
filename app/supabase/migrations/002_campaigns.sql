-- Phase 3 — migrate the Campaign entity from Zustand seed → Postgres.
-- Run once in Supabase SQL Editor. Idempotent.
--
-- Depends on 001_brands.sql (campaigns reference public.brands).

-- =====================================================================
-- 1. campaigns table
-- =====================================================================
create table if not exists public.campaigns (
  -- Keep text id format ('cmp_1', 'cmp_g42') matching the local seed
  -- and existing offer/application/collab references. Phase 4+ will
  -- continue this pattern as offers and applications migrate.
  id text primary key,

  -- FK to brands. cascade so closing a brand removes its campaigns
  -- (this is the demo behaviour; real product would soft-delete).
  brand_id text not null references public.brands(id) on delete cascade,

  -- Content
  title text not null,
  pitch text not null default '',
  brief text not null default '',
  cover text not null default '',

  -- Money
  budget numeric not null default 0,
  spent numeric not null default 0,
  escrow_held numeric not null default 0,

  -- Reach / targeting
  region text not null default '',
  category text,

  -- Lifecycle (4-state per P1b §1.2)
  stage text not null default 'draft'
    check (stage in ('draft', 'live', 'paused', 'closed')),

  -- Deliverables. `deliverables_text` is the free-form display string
  -- the brand authored ("1 Reel + 2 stories"). `deliverable_ids` holds
  -- the FK list to the future deliverables table; left as text[] in
  -- Phase 3 since deliverables migrate later.
  deliverables_text text not null default '',
  deliverable_ids text[] not null default '{}',

  -- Dates
  deadline text not null default '',
  posted_at timestamptz,

  -- Performance (populated post-launch by analytics jobs)
  reach integer,
  engagement numeric,

  -- Lifecycle audit trail
  history jsonb not null default '[]',
  milestones jsonb not null default '[]',

  -- Cross-table references — text arrays for Phase 3. Phase 4 will
  -- migrate applications + offers and these arrays will then point at
  -- real DB rows. No FK constraints because the referenced tables
  -- don't exist in Postgres yet.
  applications text[] not null default '{}',
  offers text[] not null default '{}',

  -- Optional flags / config
  rights jsonb,
  auto_shortlist jsonb,
  kind text default 'one_off' check (kind in ('one_off', 'retainer')),
  editors_pick boolean default false,

  -- Timestamps
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Indexes for the read paths we know about:
--   - brand_id: brand-side "My campaigns" list filter
--   - stage:    creator-side Browse + brand-side stage chip filter
--   - created_at desc: newest-first sort everywhere
create index if not exists campaigns_brand_id_idx on public.campaigns (brand_id);
create index if not exists campaigns_stage_idx on public.campaigns (stage);
create index if not exists campaigns_created_at_desc_idx on public.campaigns (created_at desc);

-- =====================================================================
-- 2. updated_at trigger (reuses public.touch_updated_at from 001)
-- =====================================================================
drop trigger if exists campaigns_touch on public.campaigns;
create trigger campaigns_touch
  before update on public.campaigns
  for each row execute function public.touch_updated_at();

-- =====================================================================
-- 3. Row Level Security
-- =====================================================================
-- Campaign briefs are public-readable (creators on Browse campaigns
-- need every row). Per the Supabase skill, UPDATE policies need a
-- SELECT policy too — brands_select_all from 001 wouldn't help here,
-- so we add campaigns_select_all explicitly.
alter table public.campaigns enable row level security;

drop policy if exists "campaigns_select_all" on public.campaigns;
create policy "campaigns_select_all" on public.campaigns
  for select using (true);

-- INSERT / UPDATE policies gate on brand ownership: the brand
-- referenced by `brand_id` must have `owner_email = auth.email()`.
-- The subquery against public.brands works because brands_select_all
-- (from 001) lets authenticated users see brand rows.
drop policy if exists "campaigns_insert_owner" on public.campaigns;
create policy "campaigns_insert_owner" on public.campaigns
  for insert to authenticated
  with check (
    exists (
      select 1 from public.brands
      where brands.id = brand_id and brands.owner_email = auth.email()
    )
  );

drop policy if exists "campaigns_update_owner" on public.campaigns;
create policy "campaigns_update_owner" on public.campaigns
  for update to authenticated
  using (
    exists (
      select 1 from public.brands
      where brands.id = brand_id and brands.owner_email = auth.email()
    )
  )
  with check (
    exists (
      select 1 from public.brands
      where brands.id = brand_id and brands.owner_email = auth.email()
    )
  );

-- No DELETE policy. Closing a campaign uses stage = 'closed' so the
-- audit trail survives.

-- =====================================================================
-- 4. Seed: the four hand-authored campaigns for Aesop + Le Creuset
-- =====================================================================
-- Generated campaigns (cmp_g*) stay in the local store. Their brands
-- aren't in Supabase either, so the RLS join would fail.

insert into public.campaigns (
  id, brand_id, title, pitch, brief, cover,
  budget, spent, escrow_held,
  region, category, stage,
  deliverables_text, deliverable_ids,
  deadline, posted_at, reach, engagement,
  history, milestones, applications, offers,
  created_at
) values
(
  'cmp_1', 'b_aesop', 'Spring Renewal',
  'A mindful skincare moment for the change of season.',
  'We are looking for 3–5 lifestyle creators to feature our new Spring Renewal kit through one Reel + 2 stories. Soft, natural light. Authentic morning routines preferred.',
  'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=800&h=600&fit=crop&auto=format',
  8000, 0, 5400,
  'US/UK', 'Beauty', 'live',
  '1 Reel + 2 stories', array[]::text[],
  to_char((now() + interval '7 days')::date, 'YYYY-MM-DD'),
  null, null, null,
  jsonb_build_array(
    jsonb_build_object('stage', 'draft', 'at', to_char(now() - interval '28 days', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'), 'by', 'u_hannah'),
    jsonb_build_object('stage', 'live',  'at', to_char(now() - interval '24 days', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'), 'by', 'u_hannah')
  ),
  jsonb_build_array(
    jsonb_build_object('id', 'm_1a', 'stage', 'offer',  'amount', 900, 'description', '50% on offer accept'),
    jsonb_build_object('id', 'm_1b', 'stage', 'posted', 'amount', 900, 'description', '50% on post live')
  ),
  array['app_1']::text[],
  array['off_1']::text[],
  now() - interval '28 days'
),
(
  'cmp_2', 'b_lecreuset', 'Slow Sundays',
  'Long-form weekend cooking content with our new Dutch oven.',
  'Looking for 2 food creators (South Asian or Mediterranean cuisine) for a 6-minute YouTube cooking feature. Brand mention in title and description; 1 dedicated IG post; 3 stories.',
  'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800&h=600&fit=crop&auto=format',
  6000, 0, 0,
  'Global', 'Food', 'live',
  '1 YouTube + 1 IG post + 3 stories', array[]::text[],
  to_char((now() + interval '14 days')::date, 'YYYY-MM-DD'),
  null, null, null,
  jsonb_build_array(
    jsonb_build_object('stage', 'draft', 'at', to_char(now() - interval '6 days', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'), 'by', 'u_marcus'),
    jsonb_build_object('stage', 'live',  'at', to_char(now() - interval '4 days', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'), 'by', 'u_marcus')
  ),
  jsonb_build_array(
    jsonb_build_object('id', 'm_2a', 'stage', 'offer',  'amount', 1500, 'description', '50% on offer accept'),
    jsonb_build_object('id', 'm_2b', 'stage', 'posted', 'amount', 1500, 'description', '50% on post live')
  ),
  array[]::text[],
  array[]::text[],
  now() - interval '6 days'
),
(
  'cmp_3', 'b_aesop', 'Studio Notes',
  'Quiet, considered home rituals — for our new home line.',
  'Design and lifestyle creators only. 1 IG post + 1 Reel showcasing the new Aesop home candle and room spray in their own space.',
  'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?w=800&h=600&fit=crop&auto=format',
  5000, 0, 0,
  'EU/JP', 'Design', 'live',
  '1 IG post + 1 Reel', array[]::text[],
  to_char((now() + interval '10 days')::date, 'YYYY-MM-DD'),
  null, null, null,
  jsonb_build_array(
    jsonb_build_object('stage', 'draft', 'at', to_char(now() - interval '12 days', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'), 'by', 'u_hannah'),
    jsonb_build_object('stage', 'live',  'at', to_char(now() - interval '10 days', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'), 'by', 'u_hannah')
  ),
  jsonb_build_array(
    jsonb_build_object('id', 'm_3a', 'stage', 'offer',  'amount', 1250, 'description', '50% on offer accept'),
    jsonb_build_object('id', 'm_3b', 'stage', 'posted', 'amount', 1250, 'description', '50% on post live')
  ),
  array['app_2']::text[],
  array[]::text[],
  now() - interval '12 days'
),
(
  'cmp_4', 'b_lecreuset', 'Holiday Tables',
  'Hosting season — 4 creators, 4 cuisines.',
  'Past campaign — included for reporting reference.',
  'https://images.unsplash.com/photo-1574781330855-d0db8cc6a79c?w=800&h=600&fit=crop&auto=format',
  12000, 12000, 0,
  'US', 'Food', 'closed',
  '4 creator features', array[]::text[],
  '2025-12-20',
  now() - interval '120 days', 1400000, 6.2,
  jsonb_build_array(
    jsonb_build_object('stage', 'draft',  'at', to_char(now() - interval '160 days', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'), 'by', 'u_marcus'),
    jsonb_build_object('stage', 'live',   'at', to_char(now() - interval '150 days', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'), 'by', 'u_marcus'),
    jsonb_build_object('stage', 'closed', 'at', to_char(now() - interval '90 days',  'YYYY-MM-DD"T"HH24:MI:SS"Z"'), 'by', 'u_marcus')
  ),
  '[]'::jsonb,
  array[]::text[],
  array['off_4']::text[],
  now() - interval '160 days'
)
on conflict (id) do nothing;

-- =====================================================================
-- 5. Verification (uncomment to run after migration)
-- =====================================================================
-- select id, brand_id, title, stage, deadline, array_length(offers, 1) as offer_count
--   from public.campaigns order by created_at;
--
-- RLS sanity (run as authenticated hannah@aesop.test):
--   select id from public.campaigns where exists (
--     select 1 from public.brands b
--     where b.id = campaigns.brand_id and b.owner_email = auth.email()
--   );
-- → should return cmp_1, cmp_3 only (Aesop's two campaigns)
