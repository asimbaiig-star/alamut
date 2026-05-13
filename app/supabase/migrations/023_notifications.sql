-- Migration 023 — notifications table (cross-device bell)
--
-- Pre-migration: notifications were stored only in `useStore.db.notifications`
-- (Zustand + localStorage). Result: the bell badge worked great inside a
-- single browser tab, but the same user signing in on a second device
-- saw an empty bell because notifications were never synced.
--
-- This migration moves notifications to Postgres so the bell pulls a
-- consistent unread count on every device. Local-store stays as the
-- read path (the bell selector reads useStore) — Supabase is the
-- canonical store + realtime broadcast source.
--
-- ---------------------------------------------------------------------
-- Identity model
-- ---------------------------------------------------------------------
-- The Notification TS type uses `userId` = the FNV-1a hash of the
-- user's email (the local User.id convention). That's not the
-- Supabase auth.uid (a uuid), so we can't RLS on user_id directly.
-- Instead we carry `owner_email` (the recipient's email) and gate on
-- `auth.email() = owner_email` — same pattern as brands.owner_email
-- and creators.owner_email.
--
-- ---------------------------------------------------------------------
-- INSERT policy is permissive — any authenticated session can write a
-- notification row, because user A sending an offer needs to be able
-- to write a notification for user B. The auth helper restricts to
-- "must have a session" so anonymous clients can't spam. A real
-- production system would replace this with `security definer`
-- trigger functions that fire from the workflow tables; the prototype
-- accepts the trust-the-authenticated-user trade-off.

create table if not exists public.notifications (
  id           text primary key,
  user_id      text not null,
  owner_email  text not null,
  text         text not null,
  href         text,
  at           timestamptz not null default now(),
  read         boolean not null default false,
  meta         jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Bell query reads "my recent notifications" — index supports it.
create index if not exists notifications_owner_email_at_idx
  on public.notifications (owner_email, at desc);

create index if not exists notifications_user_id_idx
  on public.notifications (user_id);

-- Shared touch_updated_at trigger
drop trigger if exists notifications_touch_updated_at on public.notifications;
create trigger notifications_touch_updated_at
  before update on public.notifications
  for each row execute function public.touch_updated_at();

alter table public.notifications enable row level security;

-- SELECT: only your own.
drop policy if exists notifications_select_own on public.notifications;
create policy notifications_select_own
  on public.notifications
  for select
  using (owner_email = auth.email());

-- INSERT: any authenticated session. RLS for cross-user writes is
-- enforced at the workflow-mutation layer (capability checks), not here.
drop policy if exists notifications_insert_authenticated on public.notifications;
create policy notifications_insert_authenticated
  on public.notifications
  for insert
  with check (auth.email() is not null);

-- UPDATE: only your own (used by mark-read).
drop policy if exists notifications_update_own on public.notifications;
create policy notifications_update_own
  on public.notifications
  for update
  using (owner_email = auth.email())
  with check (owner_email = auth.email());

-- DELETE: only your own. Not currently used by the UI but available.
drop policy if exists notifications_delete_own on public.notifications;
create policy notifications_delete_own
  on public.notifications
  for delete
  using (owner_email = auth.email());

-- ---------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------
-- Add to the supabase_realtime publication so a notification written
-- on Device A appears on Device B without a page reload.
do $$ begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- Verification (uncomment to run)
-- ---------------------------------------------------------------------
-- select 'notifications_rows' as t, count(*)::text as v from public.notifications
-- union all select 'notifications_policies', count(*)::text from pg_policies where tablename='notifications'
-- union all select 'realtime_notifications', count(*)::text from pg_publication_tables where pubname='supabase_realtime' and tablename='notifications';
