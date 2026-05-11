-- Phase 4 — migrate Offers + Applications from Zustand seed → Postgres.
-- Run once in Supabase SQL Editor. Idempotent.
--
-- Depends on 002_campaigns.sql (both tables FK to public.campaigns).
-- Creator IDs remain as plain text references for now — creators
-- migrate in Phase 5 when we set up the creators table.

-- =====================================================================
-- 1. applications table
-- =====================================================================
create table if not exists public.applications (
  id text primary key,
  campaign_id text not null references public.campaigns(id) on delete cascade,
  -- Text reference to a creator row that still lives in the local
  -- store. No FK constraint until Phase 5 migrates `creators`.
  creator_id text not null,
  pitch text not null default '',
  proposed_rate numeric,
  status text not null default 'submitted'
    check (status in ('submitted', 'shortlisted', 'rejected', 'withdrawn')),
  submitted_at timestamptz not null default now(),
  decided_at timestamptz,
  -- P1c §1.1 — backfilled by migrator 3 / live by ensureCollabState.
  collaboration_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists applications_campaign_id_idx on public.applications (campaign_id);
create index if not exists applications_creator_id_idx on public.applications (creator_id);
create index if not exists applications_status_idx on public.applications (status);
create index if not exists applications_submitted_at_desc_idx
  on public.applications (submitted_at desc);

drop trigger if exists applications_touch on public.applications;
create trigger applications_touch
  before update on public.applications
  for each row execute function public.touch_updated_at();

alter table public.applications enable row level security;

-- SELECT: public-readable for the same reason campaigns are — the
-- creator-side Browse + the brand-side kanban both want all rows.
-- INSERT + UPDATE: authenticated, broadly. Tighter per-party gating
-- (brand vs creator) lands in Phase 5 once creators are in auth.
drop policy if exists "applications_select_all" on public.applications;
create policy "applications_select_all" on public.applications
  for select using (true);

drop policy if exists "applications_insert_auth" on public.applications;
create policy "applications_insert_auth" on public.applications
  for insert to authenticated with check (true);

drop policy if exists "applications_update_auth" on public.applications;
create policy "applications_update_auth" on public.applications
  for update to authenticated using (true) with check (true);

-- =====================================================================
-- 2. offers table
-- =====================================================================
create table if not exists public.offers (
  id text primary key,
  campaign_id text not null references public.campaigns(id) on delete cascade,
  creator_id text not null,
  -- Always-fresh "latest agreed rate" — see Offer.rate in
  -- lib/api/types.ts. Source of truth for the negotiation transcript
  -- is the `rounds` JSONB column below.
  rate numeric not null default 0,
  message text not null default '',
  status text not null default 'pending'
    check (status in ('pending','accepted','declined','withdrawn','countered','expired')),
  sent_at timestamptz not null default now(),
  responded_at timestamptz,
  -- P1b §1.7 — provenance. Soft FK (no constraint yet) since the
  -- application_id may reference a row that's still in the local
  -- store for generated cmp_g* campaigns.
  application_id text,
  source text not null default 'cold-outreach'
    check (source in ('application','cold-outreach','invite','spark-recommendation')),
  -- P3 §2.1 — full negotiation transcript as a JSONB array.
  -- Each round: { by, at, rate, message }.
  rounds jsonb not null default '[]',
  collaboration_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists offers_campaign_id_idx on public.offers (campaign_id);
create index if not exists offers_creator_id_idx on public.offers (creator_id);
create index if not exists offers_status_idx on public.offers (status);
create index if not exists offers_sent_at_desc_idx on public.offers (sent_at desc);

drop trigger if exists offers_touch on public.offers;
create trigger offers_touch
  before update on public.offers
  for each row execute function public.touch_updated_at();

alter table public.offers enable row level security;

drop policy if exists "offers_select_all" on public.offers;
create policy "offers_select_all" on public.offers
  for select using (true);

drop policy if exists "offers_insert_auth" on public.offers;
create policy "offers_insert_auth" on public.offers
  for insert to authenticated with check (true);

drop policy if exists "offers_update_auth" on public.offers;
create policy "offers_update_auth" on public.offers
  for update to authenticated using (true) with check (true);

-- =====================================================================
-- 3. Seed: the four hand-authored apps/offers for Aesop + Le Creuset
-- =====================================================================
-- Mirrors the seed.ts demoApps + demoOffers arrays. Only the rows
-- whose campaign exists in Supabase (cmp_1..cmp_4) are inserted.
-- Generated app_g* / off_g* rows stay in the local store.

insert into public.applications (
  id, campaign_id, creator_id, pitch, proposed_rate, status, submitted_at, decided_at
) values
  (
    'app_1', 'cmp_1', 'c_sarah',
    'Soft morning light, sustainable tone — natural fit for my audience.',
    1800, 'shortlisted',
    now() - interval '20 days', now() - interval '18 days'
  ),
  (
    'app_2', 'cmp_3', 'c_yuki',
    'Studio shots from Kyoto workshop, quiet palette.',
    1400, 'shortlisted',
    now() - interval '5 days', now() - interval '3 days'
  )
on conflict (id) do nothing;

insert into public.offers (
  id, campaign_id, creator_id, rate, message, status,
  sent_at, responded_at, application_id, source, rounds
) values
  (
    'off_1', 'cmp_1', 'c_sarah',
    1800, 'Loved your pitch. Standard 50/50 escrow, post by Apr 30.',
    'accepted',
    now() - interval '15 days', now() - interval '14 days',
    'app_1', 'application',
    jsonb_build_array(
      jsonb_build_object(
        'by', 'brand',
        'at', extract(epoch from (now() - interval '15 days')) * 1000,
        'rate', 1800,
        'message', 'Loved your pitch. Standard 50/50 escrow, post by Apr 30.'
      )
    )
  ),
  (
    'off_4', 'cmp_4', 'c_amir',
    3000, 'Long-form holiday hosting feature.',
    'accepted',
    now() - interval '140 days', now() - interval '139 days',
    null, 'cold-outreach',
    jsonb_build_array(
      jsonb_build_object(
        'by', 'brand',
        'at', extract(epoch from (now() - interval '140 days')) * 1000,
        'rate', 3000,
        'message', 'Long-form holiday hosting feature.'
      )
    )
  )
on conflict (id) do nothing;

-- =====================================================================
-- 4. Verification (uncomment to run after migration)
-- =====================================================================
-- select id, campaign_id, creator_id, status, proposed_rate from public.applications;
-- select id, campaign_id, creator_id, status, rate, source from public.offers;
