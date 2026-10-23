-- 038_public_projections.sql
--
-- Public profiles and briefs that actually return rows, and nothing in them
-- that should not.
--
-- WHAT WAS WRONG (SUPABASE-AUDIT.md §3)
--
-- `creators_public` and `brands_public` were created by 025 with
-- `security_invoker=on`, over base tables whose SELECT policy is owner-only.
-- An invoker view applies the base table's RLS to the caller, so an
-- anonymous visitor matched no owner and the views returned ZERO rows to
-- everyone, always — while 025's own comments say "anonymous and
-- authenticated non-owners can read it". The public directory has been
-- rendering seed profiles over an empty result since.
--
-- The textbook fix is a security-definer view. It is not used here: the
-- Supabase advisor reports `security_definer_view` as an ERROR, and 028
-- already removed one such view for exactly that reason. Instead each
-- public surface becomes a real table — a projection — kept in sync by a
-- trigger. Same names, so the app's reads do not change.
--
-- WHAT EACH PROJECTION LEAVES OUT
--
-- The views being dead meant their columns were private by accident. A live
-- projection makes every column world-readable for the first time, so each
-- one was re-examined rather than carried over:
--
--   creators_public   drops saved_briefs     — which briefs a creator is eyeing
--   brands_public     drops saved_creators   — who a brand is shortlisting
--   campaigns_public  drops spent, escrow_held, history, milestones,
--                     auto_shortlist — and carries no draft campaigns
--
-- `spent` deserves the note: on a single-creator campaign it EQUALS that
-- creator's fee, the figure 037 exists to protect. `milestones` holds payment
-- amounts ("50% on offer accept", $900). `history` names who moved each
-- stage. `auto_shortlist` lists the creators a brand's matcher picked.
-- Drafts are unannounced campaigns — brief, budget and all.
--
-- (Owner-only figures — payout, wallet, lifetime earnings, owner_email, the
-- tax form — were already excluded by 025 and still are.)
--
-- SAFE TO RUN BEFORE OR AFTER THE APP DEPLOY
--
--   * Before: the deployed app still selects saved_briefs / saved_creators,
--     so its public read fails and falls back to seed — exactly what it does
--     today against the dead views. Nothing regresses.
--   * After: the new app selects the reduced column sets and gets rows.
--   * `campaigns_public` is new; the old app never reads it, and the raw
--     `campaigns` table is untouched here. Tightening that is 039, which
--     must wait for the deploy.
--
-- HOW THE SYNC WORKS
--
-- One trigger function, `private.sync_projection(target, keep)`, maps a row
-- onto the projection BY COLUMN NAME (jsonb_populate_record), so a column
-- exists in a projection only if the projection's own definition lists it —
-- nothing leaks in because the source table grew. It runs SECURITY DEFINER so
-- the writer needs no privileges on the projection, and lives in a schema
-- PostgREST does not expose, with EXECUTE revoked, so it cannot be called
-- over the API. Projections grant SELECT only: there are no write policies,
-- so a creator cannot set `verified = true` on their public row directly.
--
-- Re-runnable. A re-run recreates nothing that exists and fully resyncs
-- every projection from its source. The script runs as one transaction in
-- the SQL editor, so a failure leaves the database as it was.

-- =====================================================================
-- 1. The sync function
-- =====================================================================

create schema if not exists private;
revoke all on schema private from public;

create or replace function private.sync_projection()
returns trigger language plpgsql security definer
set search_path = '' as $$
declare
  target regclass := tg_argv[0]::regclass;
  keep   text     := coalesce(tg_argv[1], 'true');
begin
  if tg_op in ('UPDATE', 'DELETE') then
    execute format('delete from %s where id = $1', target) using old.id;
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    execute format(
      'insert into %1$s select r.* from jsonb_populate_record(null::%1$s, $1) r where %2$s',
      target, keep
    ) using to_jsonb(new);
  end if;
  return null;
end $$;

revoke all on function private.sync_projection() from public, anon, authenticated;

comment on function private.sync_projection() is
  'Keeps a *_public projection in sync with its source table. Arguments: target projection, and a filter over projection columns (default true). Maps by column name, so only columns the projection defines are copied.';

-- =====================================================================
-- 2. creators_public
-- =====================================================================

do $$ begin
  if exists (select 1 from pg_views where schemaname = 'public' and viewname = 'creators_public') then
    drop view public.creators_public;
  end if;
end $$;

create table if not exists public.creators_public as
  select
    id, user_id, name, handle, tagline, bio, cover, portrait,
    city, country, languages, categories, work, past_clients,
    platforms, reach, engagement, rating, tier, response_hrs,
    rate_card, rate_cards, verified, kyc_verified_at, editors_pick,
    press_mentions, availability, featured_review_ids,
    version, created_at, updated_at
  from public.creators
  with no data;

do $$ begin
  if not exists (select 1 from pg_constraint
                 where conrelid = 'public.creators_public'::regclass and contype = 'p') then
    alter table public.creators_public add primary key (id);
  end if;
end $$;

alter table public.creators_public enable row level security;
drop policy if exists "creators_public_select" on public.creators_public;
create policy "creators_public_select" on public.creators_public
  for select using (true);
revoke all on public.creators_public from anon, authenticated;
grant select on public.creators_public to anon, authenticated;

drop trigger if exists creators_public_sync on public.creators;
create trigger creators_public_sync
  after insert or update or delete on public.creators
  for each row execute function private.sync_projection('public.creators_public');

delete from public.creators_public;
insert into public.creators_public
  select r.* from public.creators c,
    lateral jsonb_populate_record(null::public.creators_public, to_jsonb(c)) r;

-- =====================================================================
-- 3. brands_public
-- =====================================================================

do $$ begin
  if exists (select 1 from pg_views where schemaname = 'public' and viewname = 'brands_public') then
    drop view public.brands_public;
  end if;
end $$;

create table if not exists public.brands_public as
  select
    id, user_id, name, industry, hq, website, about, logo_mark, logo_url,
    preferred_categories, preferred_regions, verified,
    social_platforms, version
  from public.brands
  with no data;

do $$ begin
  if not exists (select 1 from pg_constraint
                 where conrelid = 'public.brands_public'::regclass and contype = 'p') then
    alter table public.brands_public add primary key (id);
  end if;
end $$;

alter table public.brands_public enable row level security;
drop policy if exists "brands_public_select" on public.brands_public;
create policy "brands_public_select" on public.brands_public
  for select using (true);
revoke all on public.brands_public from anon, authenticated;
grant select on public.brands_public to anon, authenticated;

drop trigger if exists brands_public_sync on public.brands;
create trigger brands_public_sync
  after insert or update or delete on public.brands
  for each row execute function private.sync_projection('public.brands_public');

delete from public.brands_public;
insert into public.brands_public
  select r.* from public.brands b,
    lateral jsonb_populate_record(null::public.brands_public, to_jsonb(b)) r;

-- =====================================================================
-- 4. campaigns_public — published campaigns only
-- =====================================================================
-- `stage <> 'draft'` is evaluated on every write, so a campaign appears when
-- it is published and disappears again if it is moved back to draft.

create table if not exists public.campaigns_public as
  select
    id, brand_id, title, pitch, brief, cover, budget, region, category,
    stage, deliverables_text, deliverable_ids, deadline, posted_at,
    reach, engagement, applications, offers, rights, kind, editors_pick,
    assets, version, created_at, updated_at
  from public.campaigns
  with no data;

do $$ begin
  if not exists (select 1 from pg_constraint
                 where conrelid = 'public.campaigns_public'::regclass and contype = 'p') then
    alter table public.campaigns_public add primary key (id);
  end if;
end $$;

alter table public.campaigns_public enable row level security;
drop policy if exists "campaigns_public_select" on public.campaigns_public;
create policy "campaigns_public_select" on public.campaigns_public
  for select using (true);
revoke all on public.campaigns_public from anon, authenticated;
grant select on public.campaigns_public to anon, authenticated;

drop trigger if exists campaigns_public_sync on public.campaigns;
create trigger campaigns_public_sync
  after insert or update or delete on public.campaigns
  for each row execute function private.sync_projection('public.campaigns_public', 'stage <> ''draft''');

delete from public.campaigns_public;
insert into public.campaigns_public
  select r.* from public.campaigns c,
    lateral jsonb_populate_record(null::public.campaigns_public, to_jsonb(c)) r
  where r.stage <> 'draft';

-- Realtime: the marketplace listens to campaign changes, and after 039 the
-- raw table only broadcasts to a campaign's own parties.
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables
                     where pubname = 'supabase_realtime'
                       and schemaname = 'public' and tablename = 'campaigns_public') then
    alter publication supabase_realtime add table public.campaigns_public;
  end if;
end $$;

-- =====================================================================
-- Verification
-- =====================================================================
-- Expect three rows, kind 'r' (a table, not a view 'v'), RLS on, and a
-- row count: creators and brands match their source tables; campaigns_public
-- matches the source minus drafts.
select
  c.relname                                   as projection,
  c.relkind                                   as kind,
  c.relrowsecurity                            as rls_on,
  (select count(*) from public.creators_public)  as creators_public_rows,
  (select count(*) from public.creators)         as creators_rows,
  (select count(*) from public.brands_public)    as brands_public_rows,
  (select count(*) from public.brands)           as brands_rows,
  (select count(*) from public.campaigns_public) as campaigns_public_rows,
  (select count(*) from public.campaigns where stage <> 'draft') as published_campaigns
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('creators_public', 'brands_public', 'campaigns_public')
order by c.relname;
