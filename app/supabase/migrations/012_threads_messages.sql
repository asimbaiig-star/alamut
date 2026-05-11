-- Phase 10 — migrate Thread + Message entities from local store → Postgres.
--
-- Chat is the last big workflow surface. Threads anchor on a (campaign,
-- participants) pair; messages append to threads. Both are append-mostly
-- with one UPDATE path on threads (last_message_at + unread_for change
-- on every send and on read-receipt).
--
-- Mutations:
--   v2SendOffer  (rare INSERT path) · thread + first message when
--                 the brand sends an offer on a creator they haven't
--                 messaged before
--   v2SendMessage · INSERT message + UPDATE thread.last_message_at +
--                 thread.unread_for
--   v2MarkThreadRead · UPDATE thread.unread_for (remove viewer)
--
-- Realtime: both tables are added to the supabase_realtime publication
-- so the client can subscribe via `lib/realtimeChat.ts`. Cross-device /
-- cross-tab chat works because the subscription overlays remote rows
-- into the local store as they arrive.
--
-- No seed: existing local threads/messages are mostly tied to generated
-- cmp_g* campaigns with no Postgres FK target.

-- =====================================================================
-- 1. threads table
-- =====================================================================
create table if not exists public.threads (
  id text primary key,
  -- text[] of user ids. NOT a FK target; users live in auth.users with
  -- UUIDs vs our local text ids.
  participants text[] not null default '{}',
  -- Optional campaign anchor. on delete set null — closing a campaign
  -- doesn't drop the chat history.
  campaign_id text references public.campaigns(id) on delete set null,
  subject text not null default '',
  last_message_at timestamptz not null,
  unread_for text[] not null default '{}',
  -- P1c carry-through — set when the (campaign, creator) pair materializes
  -- a Collaboration. on delete set null for the same reason as campaign.
  collaboration_id text references public.collaborations(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists threads_campaign_id_idx on public.threads (campaign_id);
create index if not exists threads_collaboration_id_idx on public.threads (collaboration_id);
create index if not exists threads_last_message_at_desc_idx on public.threads (last_message_at desc);
-- GIN index on participants for "threads where I'm a participant" queries.
create index if not exists threads_participants_gin_idx on public.threads using gin (participants);

drop trigger if exists threads_touch on public.threads;
create trigger threads_touch
  before update on public.threads
  for each row execute function public.touch_updated_at();

-- =====================================================================
-- 2. messages table
-- =====================================================================
create table if not exists public.messages (
  id text primary key,
  thread_id text not null references public.threads(id) on delete cascade,
  from_user_id text not null,
  text text not null default '',
  at timestamptz not null,
  attachments jsonb,
  created_at timestamptz not null default now()
);

create index if not exists messages_thread_id_idx on public.messages (thread_id);
create index if not exists messages_at_desc_idx on public.messages (at desc);

-- No touch trigger on messages — they're INSERT-only (edits + deletes
-- aren't part of the workflow).

-- =====================================================================
-- 3. RLS
-- =====================================================================
-- SELECT: authenticated. Tight per-participant gating would require a
--   userId→email mapping. Demo trade-off.
-- INSERT/UPDATE: authenticated.
-- DELETE: denied (no policy).
alter table public.threads enable row level security;

drop policy if exists "threads_select_authenticated" on public.threads;
create policy "threads_select_authenticated" on public.threads
  for select to authenticated using (true);

drop policy if exists "threads_insert_authenticated" on public.threads;
create policy "threads_insert_authenticated" on public.threads
  for insert to authenticated with check (true);

drop policy if exists "threads_update_authenticated" on public.threads;
create policy "threads_update_authenticated" on public.threads
  for update to authenticated using (true) with check (true);

alter table public.messages enable row level security;

drop policy if exists "messages_select_authenticated" on public.messages;
create policy "messages_select_authenticated" on public.messages
  for select to authenticated using (true);

drop policy if exists "messages_insert_authenticated" on public.messages;
create policy "messages_insert_authenticated" on public.messages
  for insert to authenticated with check (true);

-- =====================================================================
-- 4. Realtime publication
-- =====================================================================
-- Enable Supabase Realtime on both tables. supabase_realtime is the
-- managed publication; rows added to it broadcast change events that
-- the JS client can subscribe to via `supabase.channel(...).on(
-- 'postgres_changes', ...)`. RLS still gates which rows each client
-- sees, so the broadcast respects the SELECT policies above.
do $$ begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'threads'
  ) then
    alter publication supabase_realtime add table public.threads;
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
end $$;

-- =====================================================================
-- 5. Verification (uncomment to run)
-- =====================================================================
-- select 'threads_rows' as t, count(*)::text as v from public.threads
-- union all select 'messages_rows', count(*)::text from public.messages
-- union all select 'threads_policies', count(*)::text from pg_policies where tablename='threads'
-- union all select 'messages_policies', count(*)::text from pg_policies where tablename='messages'
-- union all select 'realtime_threads', count(*)::text from pg_publication_tables where pubname='supabase_realtime' and tablename='threads'
-- union all select 'realtime_messages', count(*)::text from pg_publication_tables where pubname='supabase_realtime' and tablename='messages';
