-- Migration 016 — campaign-assets Storage bucket + assets column
--
-- Brand uploads brief reference files (PDFs, mood-board images, video
-- references) and attaches them to a campaign so creators can pull the
-- full context when reviewing the brief.
--
-- Data model: simplest workable shape — store as a jsonb array on the
-- campaign row. Avoids a separate table + new repo file + hydration
-- extension. Demo campaigns rarely carry >10 assets so array bloat
-- isn't a concern.
--
-- Each asset: { id, name, url, sizeBytes, mimeType, uploadedAt }

alter table public.campaigns
  add column if not exists assets jsonb not null default '[]';

-- Storage bucket. Public-read so the URLs render in <a> tags without
-- signed URLs (creators viewing a brief need direct access). Write-RLS
-- gates by the path's first segment matching a campaign owned by the
-- caller's brand (enforced at app layer for simplicity, same as the
-- message-attachments pattern from Phase 12).
insert into storage.buckets (id, name, public)
values ('campaign-assets', 'campaign-assets', true)
on conflict (id) do nothing;

drop policy if exists "campaign_assets_read" on storage.objects;
create policy "campaign_assets_read" on storage.objects
  for select using (bucket_id = 'campaign-assets');

drop policy if exists "campaign_assets_insert" on storage.objects;
create policy "campaign_assets_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'campaign-assets');

drop policy if exists "campaign_assets_delete" on storage.objects;
create policy "campaign_assets_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'campaign-assets');

-- Verification:
-- select column_name from information_schema.columns
--   where table_schema='public' and table_name='campaigns' and column_name='assets';
-- select id, public from storage.buckets where id='campaign-assets';
-- select policyname, cmd from pg_policies where schemaname='storage' and tablename='objects'
--   and policyname like 'campaign_assets%';
