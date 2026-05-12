-- Migration 015 — message-attachments Storage bucket
--
-- Adds the bucket + RLS the Inbox composer needs to attach files to a
-- message. Public-read so the URLs render without signed-URL juggling
-- (acceptable for demo; tighten with row-level read policies if real
-- private chat ever ships).
--
-- File-path convention: <thread_id>/<message_id>/<filename> so RLS
-- can validate the uploader is a participant in the thread. We
-- enforce that at the API layer rather than in RLS for now (Supabase
-- Storage RLS needs more boilerplate for that pattern); the bucket
-- is gated to authenticated writes only at the policy level.

insert into storage.buckets (id, name, public)
values ('message-attachments', 'message-attachments', true)
on conflict (id) do nothing;

-- Read: public — message URLs are shared in the thread payload.
drop policy if exists "message_attachments_read" on storage.objects;
create policy "message_attachments_read" on storage.objects
  for select using (bucket_id = 'message-attachments');

-- Insert: any authenticated user can upload. (Per-thread-participant
-- gating would require parsing the path; we trust the client to use
-- threads they're a participant in. Same loose-write pattern as
-- transactions in Phase 7.)
drop policy if exists "message_attachments_insert" on storage.objects;
create policy "message_attachments_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'message-attachments');

-- Delete: also authenticated. Lets a sender remove a misclick before
-- the message is sent. Server keeps the original on send-time upload
-- anyway, so this is for the pre-send preview lifecycle.
drop policy if exists "message_attachments_delete" on storage.objects;
create policy "message_attachments_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'message-attachments');

-- Verification:
-- select id, name, public from storage.buckets where id = 'message-attachments';
-- select polname, cmd from pg_policies where tablename = 'objects'
--   and polname like 'message_attachments%';
