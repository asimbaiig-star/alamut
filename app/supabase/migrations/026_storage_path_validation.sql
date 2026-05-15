-- Migration 026 — storage path-traversal hardening (Phase 52, security)
--
-- The existing storage RLS policies extract an entity id from the
-- object's path via `split_part(storage.objects.name, '/', N)` and
-- check the caller owns that entity. That's correct for the happy
-- path, but `split_part` doesn't reject path-traversal sequences:
--
--   path "b_aesop/../b_lecreuset/logo.png"
--     split_part('/', 1) → 'b_aesop'                ← caller owns this
--     actual storage path → b_lecreuset/logo.png    ← writes here
--
-- Postgres + Supabase Storage path resolution doesn't *currently*
-- normalise `..` segments at insert time, so the check passes and the
-- write lands in the wrong folder. Even if Storage normalises today,
-- relying on that is fragile.
--
-- Fix: add a helper that requires the path to be exactly
-- `<entity_id>/<filename>` with no slashes in the filename and no
-- `..` segments anywhere. Each storage policy below checks the helper
-- before the existing ownership check.

create or replace function public.is_safe_storage_path(
  obj_name text,
  expected_segment integer,  -- which segment the entity_id sits in (1-based)
  expected_total_segments integer  -- exact segment count required
) returns boolean
  language sql
  immutable
  security invoker
as $$
  select
    obj_name is not null
    and position('..' in obj_name) = 0       -- no parent-directory escape
    and position(E'\\' in obj_name) = 0      -- no Windows-style separators
    and obj_name !~ '^/'                     -- no absolute paths
    and obj_name !~ '//'                     -- no empty segments
    and array_length(string_to_array(obj_name, '/'), 1) = expected_total_segments
    and split_part(obj_name, '/', expected_segment) <> ''
$$;

-- ─── brand-logos (path: <brand_id>/<filename>) ─────────────────────
drop policy if exists "brand_logos_owner_insert" on storage.objects;
create policy "brand_logos_owner_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'brand-logos'
    and public.is_safe_storage_path(name, 1, 2)
    and exists (
      select 1 from public.brands
      where brands.id = split_part(storage.objects.name, '/', 1)
        and brands.owner_email = auth.email()
    )
  );

drop policy if exists "brand_logos_owner_update" on storage.objects;
create policy "brand_logos_owner_update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'brand-logos'
    and public.is_safe_storage_path(name, 1, 2)
    and exists (
      select 1 from public.brands
      where brands.id = split_part(storage.objects.name, '/', 1)
        and brands.owner_email = auth.email()
    )
  );

drop policy if exists "brand_logos_owner_delete" on storage.objects;
create policy "brand_logos_owner_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'brand-logos'
    and public.is_safe_storage_path(name, 1, 2)
    and exists (
      select 1 from public.brands
      where brands.id = split_part(storage.objects.name, '/', 1)
        and brands.owner_email = auth.email()
    )
  );

-- ─── creator-portraits (path: <creator_id>/<filename>) ─────────────
drop policy if exists "creator_portraits_owner_insert" on storage.objects;
create policy "creator_portraits_owner_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'creator-portraits'
    and public.is_safe_storage_path(name, 1, 2)
    and exists (
      select 1 from public.creators
      where creators.id = split_part(storage.objects.name, '/', 1)
        and creators.owner_email = auth.email()
    )
  );

drop policy if exists "creator_portraits_owner_update" on storage.objects;
create policy "creator_portraits_owner_update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'creator-portraits'
    and public.is_safe_storage_path(name, 1, 2)
    and exists (
      select 1 from public.creators
      where creators.id = split_part(storage.objects.name, '/', 1)
        and creators.owner_email = auth.email()
    )
  );

drop policy if exists "creator_portraits_owner_delete" on storage.objects;
create policy "creator_portraits_owner_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'creator-portraits'
    and public.is_safe_storage_path(name, 1, 2)
    and exists (
      select 1 from public.creators
      where creators.id = split_part(storage.objects.name, '/', 1)
        and creators.owner_email = auth.email()
    )
  );

-- ─── submission-files (path: <campaign_id>/<submission_id>/<filename>) ─
drop policy if exists "submission_files_creator_insert" on storage.objects;
create policy "submission_files_creator_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'submission-files'
    and public.is_safe_storage_path(name, 2, 3)
    and exists (
      select 1 from public.submissions s
      where s.id = split_part(storage.objects.name, '/', 2)
        and public.is_creator_owner(s.creator_id)
    )
  );

drop policy if exists "submission_files_creator_update" on storage.objects;
create policy "submission_files_creator_update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'submission-files'
    and public.is_safe_storage_path(name, 2, 3)
    and exists (
      select 1 from public.submissions s
      where s.id = split_part(storage.objects.name, '/', 2)
        and public.is_creator_owner(s.creator_id)
    )
  );

drop policy if exists "submission_files_creator_delete" on storage.objects;
create policy "submission_files_creator_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'submission-files'
    and public.is_safe_storage_path(name, 2, 3)
    and exists (
      select 1 from public.submissions s
      where s.id = split_part(storage.objects.name, '/', 2)
        and public.is_creator_owner(s.creator_id)
    )
  );

-- ─── campaign-assets (path: <campaign_id>/<filename>) ──────────────
-- Migration 019 already wired path-based ownership via
-- is_brand_owner_of_campaign — but it didn't check path safety.
-- Re-create those policies on top of the helper.

drop policy if exists "campaign_assets_insert_gated" on storage.objects;
create policy "campaign_assets_insert_gated" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'campaign-assets'
    and public.is_safe_storage_path(name, 1, 2)
    and public.is_brand_owner_of_campaign(split_part(name, '/', 1))
  );

drop policy if exists "campaign_assets_delete_gated" on storage.objects;
create policy "campaign_assets_delete_gated" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'campaign-assets'
    and public.is_safe_storage_path(name, 1, 2)
    and public.is_brand_owner_of_campaign(split_part(name, '/', 1))
  );

-- ─── message-attachments (path: <thread_id>/<filename>) ────────────
-- Migration 019 wired participant gates; re-applied with path safety.
-- Reproduces the same fallback shape as 019 (campaign-anchored vs
-- dm-style threads) so we don't regress that logic.

drop policy if exists "message_attachments_insert_gated" on storage.objects;
create policy "message_attachments_insert_gated" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'message-attachments'
    and public.is_safe_storage_path(name, 1, 2)
    and (
      exists (
        select 1 from public.threads t
        where t.id = split_part(name, '/', 1)
          and t.campaign_id is not null
          and public.is_participant_of_campaign(t.campaign_id)
      )
      or exists (
        select 1 from public.threads t
        where t.id = split_part(name, '/', 1)
          and t.campaign_id is null
      )
    )
  );

drop policy if exists "message_attachments_delete_gated" on storage.objects;
create policy "message_attachments_delete_gated" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'message-attachments'
    and public.is_safe_storage_path(name, 1, 2)
    and exists (
      select 1 from public.threads t
      where t.id = split_part(name, '/', 1)
        and (
          (t.campaign_id is not null and public.is_participant_of_campaign(t.campaign_id))
          or t.campaign_id is null
        )
    )
  );

-- =====================================================================
-- Verification (uncomment to run)
-- =====================================================================
-- select public.is_safe_storage_path('b_aesop/logo.png', 1, 2);                        -- t
-- select public.is_safe_storage_path('b_aesop/../b_lecreuset/logo.png', 1, 2);         -- f
-- select public.is_safe_storage_path('b_aesop/sub/extra/logo.png', 1, 2);              -- f (3 segs)
-- select public.is_safe_storage_path('/b_aesop/logo.png', 1, 2);                       -- f
