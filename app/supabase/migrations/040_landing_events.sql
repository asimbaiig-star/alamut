-- 040_landing_events.sql
--
-- First-party conversion events for the two landing pages, so "which page,
-- which button" can be answered with data instead of opinion.
--
-- WHAT IS RECORDED
--
--   page           'creators' | 'brands'
--   event          'landing_view' | 'cta_click'
--   cta            the button's data-cta id ('hero-signup', 'final-demo' …)
--   visit          a random id made fresh on every page load, never stored
--                  in the browser — it joins a view to the clicks on that
--                  same view and nothing else
--   viewport       'mobile' | 'tablet' | 'desktop'
--   referrer_host  the referring site's host name only, never its path
--
-- No account, email, IP, user agent, cookie or full URL is stored. Sign-up
-- completion is already recorded by the creator/brand row itself.
--
-- WHO CAN DO WHAT
--
-- Supabase grants every new table in `public` to the API roles in full. That
-- is revoked here and replaced by INSERT on six columns: a visitor can add
-- an event but cannot read any, change any, delete any, or set `id` / `at`
-- (so timestamps can't be forged). Rows are read in the SQL editor.
--
-- The CHECK constraints are the validation: a malformed event is refused by
-- Postgres, not trusted to the client. Anyone can still insert well-formed
-- rows — that is true of any public analytics endpoint — so each row is
-- capped small and nothing here is ever used for anything but counting.
--
-- Re-runnable: nothing is recreated if it exists; grants and the policy
-- are reset to exactly what is described above.

create table if not exists public.landing_events (
  id            bigint generated always as identity primary key,
  at            timestamptz not null default now(),
  page          text not null check (page in ('creators', 'brands')),
  event         text not null check (event in ('landing_view', 'cta_click')),
  cta           text check (cta ~ '^[a-z0-9-]{1,40}$'),
  visit         text not null check (visit ~ '^[a-z0-9]{12,32}$'),
  viewport      text check (viewport in ('mobile', 'tablet', 'desktop')),
  referrer_host text check (char_length(referrer_host) <= 253 and referrer_host ~ '^[a-z0-9.-]+$'),
  -- A click names its button; a view names none.
  constraint landing_events_cta_matches_event
    check ((event = 'cta_click') = (cta is not null))
);

create index if not exists landing_events_page_event_at
  on public.landing_events (page, event, at);

alter table public.landing_events enable row level security;

revoke all on public.landing_events from anon, authenticated;
-- The identity column draws ids without any privilege on its sequence, so
-- the default grant on that is revoked too.
revoke all on sequence public.landing_events_id_seq from anon, authenticated;
grant insert (page, event, cta, visit, viewport, referrer_host)
  on public.landing_events to anon, authenticated;

drop policy if exists "landing_events_insert" on public.landing_events;
create policy "landing_events_insert" on public.landing_events
  for insert to anon, authenticated
  with check (true);

comment on table public.landing_events is
  'Landing page views and CTA clicks. Insert-only for the API roles; no PII. See migration 040.';

-- =====================================================================
-- Verification
-- =====================================================================
-- Expect: rls_on true; table_grants null (no table-wide privilege at all);
-- anon_column_grants INSERT on exactly the six columns above; one policy,
-- for INSERT.
select
  c.relrowsecurity as rls_on,
  (select string_agg(distinct grantee || ':' || privilege_type, ', ' order by grantee || ':' || privilege_type)
     from information_schema.role_table_grants
    where table_schema = 'public' and table_name = 'landing_events'
      and grantee in ('anon', 'authenticated')) as table_grants,
  (select string_agg(distinct grantee || ':' || privilege_type || '(' || column_name || ')', ', ')
     from information_schema.column_privileges
    where table_schema = 'public' and table_name = 'landing_events'
      and grantee = 'anon') as anon_column_grants,
  (select string_agg(policyname || ':' || cmd, ', ')
     from pg_policies where schemaname = 'public' and tablename = 'landing_events') as policies
from pg_class c
where c.oid = 'public.landing_events'::regclass;
