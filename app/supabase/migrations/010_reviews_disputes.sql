-- Phase 8 lite — migrate Review + Dispute entities from local store → Postgres.
--
-- Reviews are the public storefront artefact (5-star ratings + text).
-- Disputes are the private money-fight artefact (open/in-review/resolved-*).
-- Both have INSERT + UPDATE paths; no DELETE (reviews can be hidden via
-- moderation flags, disputes have a 'withdrawn' status).
--
-- No seed rows: the local seed's disputes (disp_seed_1, disp_seed_2)
-- and most generated reviews are attached to generated cmp_g* campaigns
-- that don't exist in Postgres. Postgres persists rows from live
-- workflow actions going forward.

-- =====================================================================
-- 1. reviews table
-- =====================================================================
create table if not exists public.reviews (
  id text primary key,
  campaign_id text not null references public.campaigns(id) on delete restrict,
  from_user_id text not null,
  review_type text not null check (review_type in ('creator','brand')),
  target_id text not null,
  rating smallint not null check (rating between 1 and 5),
  text text not null default '',
  at timestamptz not null,
  -- Optional public response from the reviewed party.
  response jsonb,
  -- P4 §3.2 — moderation fields.
  reported_by jsonb not null default '[]',
  hidden boolean not null default false,
  hidden_reason text,
  hidden_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists reviews_campaign_id_idx on public.reviews (campaign_id);
create index if not exists reviews_target_id_idx on public.reviews (target_id);
create index if not exists reviews_review_type_idx on public.reviews (review_type);

drop trigger if exists reviews_touch on public.reviews;
create trigger reviews_touch
  before update on public.reviews
  for each row execute function public.touch_updated_at();

-- =====================================================================
-- 2. disputes table
-- =====================================================================
create table if not exists public.disputes (
  id text primary key,
  collaboration_id text not null
    references public.collaborations(id) on delete restrict,
  campaign_id text not null references public.campaigns(id) on delete restrict,
  raised_by_user_id text not null,
  raised_by_role text not null check (raised_by_role in ('brand','creator')),
  category text not null check (category in
    ('non-delivery','quality','scope-creep','late-payment','content-takedown','other')),
  description text not null default '',
  evidence jsonb not null default '[]',
  status text not null default 'open' check (status in
    ('open','in-review','resolved-refund','resolved-release','resolved-partial','withdrawn')),
  resolution jsonb,
  raised_at timestamptz not null,
  -- Conversation transcript appended to during the case lifetime.
  messages jsonb not null default '[]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists disputes_collaboration_id_idx on public.disputes (collaboration_id);
create index if not exists disputes_campaign_id_idx on public.disputes (campaign_id);
create index if not exists disputes_status_idx on public.disputes (status);
create index if not exists disputes_raised_at_desc_idx on public.disputes (raised_at desc);

drop trigger if exists disputes_touch on public.disputes;
create trigger disputes_touch
  before update on public.disputes
  for each row execute function public.touch_updated_at();

-- =====================================================================
-- 3. RLS
-- =====================================================================
-- Reviews
--   SELECT: public (storefronts are anon-readable; client filters hidden).
--   INSERT/UPDATE: authenticated. Per-party gating would need a userId→
--     email mapping which the schema doesn't carry; same trade-off as
--     transactions in Phase 7.
alter table public.reviews enable row level security;

drop policy if exists "reviews_select_all" on public.reviews;
create policy "reviews_select_all" on public.reviews
  for select using (true);

drop policy if exists "reviews_insert_authenticated" on public.reviews;
create policy "reviews_insert_authenticated" on public.reviews
  for insert to authenticated with check (true);

drop policy if exists "reviews_update_authenticated" on public.reviews;
create policy "reviews_update_authenticated" on public.reviews
  for update to authenticated using (true) with check (true);

-- Disputes
--   SELECT: authenticated (not public — these are private cases).
--   INSERT/UPDATE: authenticated. Tighter per-party gating same caveat
--     as reviews/transactions.
alter table public.disputes enable row level security;

drop policy if exists "disputes_select_authenticated" on public.disputes;
create policy "disputes_select_authenticated" on public.disputes
  for select to authenticated using (true);

drop policy if exists "disputes_insert_authenticated" on public.disputes;
create policy "disputes_insert_authenticated" on public.disputes
  for insert to authenticated with check (true);

drop policy if exists "disputes_update_authenticated" on public.disputes;
create policy "disputes_update_authenticated" on public.disputes
  for update to authenticated using (true) with check (true);

-- =====================================================================
-- 4. Verification (uncomment to run)
-- =====================================================================
-- select 'reviews_rows' as t, count(*)::text as v from public.reviews
-- union all select 'disputes_rows', count(*)::text from public.disputes
-- union all select 'reviews_policies', count(*)::text from pg_policies where tablename='reviews'
-- union all select 'disputes_policies', count(*)::text from pg_policies where tablename='disputes';
