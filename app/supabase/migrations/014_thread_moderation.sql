-- Migration 014 — thread moderation columns
--
-- Adds per-thread mute / archive / report state so the Inbox "More"
-- menu can do something real instead of firing a "coming soon" toast.
--
--   muted_for         · text[] of user ids who muted the thread
--                       (suppresses notifications for them).
--   archived_for      · text[] of user ids who archived the thread
--                       (filters out of the default inbox view).
--                       v2SendMessage clears non-sender participants
--                       from this array so a new message brings the
--                       thread back to their inbox (Gmail-style).
--   reported_at       · timestamptz of the last report event.
--   reported_by_user_id · the user who reported.
--   reported_reason   · free-text reason captured at report time
--                       (admin queue surfaces it).
--
-- All four are per-user/event flags; the existing thread-update
-- mirror in v2Hooks.ts handles writes. Realtime broadcasts UPDATE
-- events already (Phase 10) so peer clients see changes live.

alter table public.threads
  add column if not exists muted_for text[] not null default '{}',
  add column if not exists archived_for text[] not null default '{}',
  add column if not exists reported_at timestamptz,
  add column if not exists reported_by_user_id text,
  add column if not exists reported_reason text;

-- GIN indexes — we filter by "is the viewer in archived_for / muted_for"
-- on every inbox load. Without these, the query falls back to seq scan
-- which is fine for the demo but cheap to fix now.
create index if not exists threads_muted_for_gin_idx
  on public.threads using gin (muted_for);
create index if not exists threads_archived_for_gin_idx
  on public.threads using gin (archived_for);

-- Verification:
-- select column_name, data_type from information_schema.columns
--   where table_schema='public' and table_name='threads'
--   and column_name in ('muted_for','archived_for','reported_at','reported_by_user_id','reported_reason')
--   order by column_name;
