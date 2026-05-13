-- Migration 022 — broadcast workflow-table changes via Supabase Realtime
--
-- The 2026-05-13 audit shipped optimistic locks (020 + 021) so that
-- concurrent writers see StaleVersionError instead of silently
-- overwriting each other. That handles the *write* race. The *read*
-- side still suffers: tab A updates an offer, tab B doesn't know until
-- the next full hydration pass (page load). Result: stale UI, surprise
-- conflicts, "why isn't my acceptance showing up" support tickets.
--
-- This migration extends the Phase 10 chat-realtime pattern
-- (`012_threads_messages.sql`) to the six workflow tables. Once added
-- to the supabase_realtime publication, Postgres broadcasts every
-- INSERT/UPDATE/DELETE; the JS client subscribes via
-- `supabase.channel(...).on('postgres_changes', ...)` and overlays the
-- new rows into the local Zustand store by id.
--
-- RLS still gates which rows each client receives, so broadcasts don't
-- leak — the same SELECT policies that govern the initial hydrate
-- also govern the realtime stream.
--
-- Local-echo handling: when the local tab is the writer, the mutation
-- pushes into useStore immediately for instant UI; the mirror writes
-- to Supabase; Postgres broadcasts back to every subscriber including
-- the sender. The overlay-by-id check makes the second-arrival a
-- no-op, so no duplicate.

do $$ begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'campaigns'
  ) then
    alter publication supabase_realtime add table public.campaigns;
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'offers'
  ) then
    alter publication supabase_realtime add table public.offers;
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'applications'
  ) then
    alter publication supabase_realtime add table public.applications;
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'submissions'
  ) then
    alter publication supabase_realtime add table public.submissions;
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'collaborations'
  ) then
    alter publication supabase_realtime add table public.collaborations;
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'disputes'
  ) then
    alter publication supabase_realtime add table public.disputes;
  end if;
end $$;

-- =====================================================================
-- Verification (uncomment to run)
-- =====================================================================
-- select tablename from pg_publication_tables
-- where pubname = 'supabase_realtime' order by tablename;
