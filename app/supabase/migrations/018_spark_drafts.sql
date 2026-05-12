-- Migration 018 — Spark drafts
--
-- Spark already persists ONE active session via localStorage, so single-
-- device single-session survives refresh. The gap: brands can't keep
-- multiple work-in-progress drafts, and the session doesn't roam across
-- devices. This table makes both work.
--
-- Each row = one saved Spark session. The brand can have any number of
-- drafts (e.g., "Beauty Q4 push", "Holiday food creators", "Spring 2026
-- editorial wave") and switch between them. Auto-named from the first
-- user prompt when the brand doesn't supply a name.

create table if not exists public.spark_drafts (
  id text primary key,
  brand_id text not null references public.brands(id) on delete cascade,
  /** Optional display name. Defaults to the first user prompt's first
   *  few words when null. */
  name text,
  /** Full SparkMessage[] history as written to localStorage today. */
  history jsonb not null default '[]',
  /** Full SparkContext as written to localStorage today. */
  context jsonb not null default '{}',
  last_edited_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists spark_drafts_brand_id_idx on public.spark_drafts (brand_id);
create index if not exists spark_drafts_last_edited_desc_idx
  on public.spark_drafts (last_edited_at desc);

drop trigger if exists spark_drafts_touch on public.spark_drafts;
create trigger spark_drafts_touch
  before update on public.spark_drafts
  for each row execute function public.touch_updated_at();

-- =====================================================================
-- RLS — brand-owner gated
-- =====================================================================
alter table public.spark_drafts enable row level security;

drop policy if exists "spark_drafts_select" on public.spark_drafts;
create policy "spark_drafts_select" on public.spark_drafts
  for select to authenticated
  using (public.is_brand_owner_of_brand(brand_id));

drop policy if exists "spark_drafts_insert" on public.spark_drafts;
create policy "spark_drafts_insert" on public.spark_drafts
  for insert to authenticated
  with check (public.is_brand_owner_of_brand(brand_id));

drop policy if exists "spark_drafts_update" on public.spark_drafts;
create policy "spark_drafts_update" on public.spark_drafts
  for update to authenticated
  using (public.is_brand_owner_of_brand(brand_id))
  with check (public.is_brand_owner_of_brand(brand_id));

drop policy if exists "spark_drafts_delete" on public.spark_drafts;
create policy "spark_drafts_delete" on public.spark_drafts
  for delete to authenticated
  using (public.is_brand_owner_of_brand(brand_id));

-- Verification:
-- select column_name from information_schema.columns
--   where table_schema='public' and table_name='spark_drafts' order by ordinal_position;
-- select policyname, cmd from pg_policies
--   where schemaname='public' and tablename='spark_drafts';
