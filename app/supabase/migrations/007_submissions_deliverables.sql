-- Phase 5d — migrate Deliverables + Submissions from local store → Postgres.
-- Deliverables are the structured replacement for free-form `deliverablesText`.
-- Submissions are content uploads against a deliverable, with feedback log + permalink.

-- =====================================================================
-- 1. deliverables table
-- =====================================================================
create table if not exists public.deliverables (
  id text primary key,
  campaign_id text not null references public.campaigns(id) on delete cascade,
  -- 0-based, stable. Matches Campaign.deliverableIds[index].
  index integer not null default 0,
  platform text not null
    check (platform in ('instagram','tiktok','youtube','linkedin','newsletter','podcast','x')),
  format text not null
    check (format in ('reel','story','post','longform','short','episode','thread','carousel','live')),
  -- Always 1 in the post-P1d model; quantity > 1 expansions land as
  -- N rows. Kept on the type for forward-compat with bulk authoring.
  quantity integer not null default 1,
  due_offset_days integer,
  specs text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists deliverables_campaign_id_idx on public.deliverables (campaign_id);

drop trigger if exists deliverables_touch on public.deliverables;
create trigger deliverables_touch
  before update on public.deliverables
  for each row execute function public.touch_updated_at();

-- =====================================================================
-- 2. submissions table
-- =====================================================================
create table if not exists public.submissions (
  id text primary key,
  campaign_id text not null references public.campaigns(id) on delete cascade,
  creator_id text not null,
  -- Per-deliverable round counter.
  round integer not null default 1,
  files jsonb not null default '[]',
  notes text not null default '',
  status text not null default 'in_review'
    check (status in ('in_review','revisions','approved')),
  submitted_at timestamptz not null default now(),
  -- Conversation log: { from, text, at }[]
  feedback jsonb not null default '[]',
  -- Public URL when content goes live.
  permalink text,
  -- P1c §1.1 — backfilled by migrator 3.
  collaboration_id text,
  -- P1d §1.5 — FK to the Deliverable this submission fulfils.
  deliverable_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists submissions_campaign_id_idx on public.submissions (campaign_id);
create index if not exists submissions_creator_id_idx on public.submissions (creator_id);
create index if not exists submissions_deliverable_id_idx on public.submissions (deliverable_id);
create index if not exists submissions_status_idx on public.submissions (status);
create index if not exists submissions_submitted_at_desc_idx
  on public.submissions (submitted_at desc);

drop trigger if exists submissions_touch on public.submissions;
create trigger submissions_touch
  before update on public.submissions
  for each row execute function public.touch_updated_at();

-- =====================================================================
-- 3. RLS — both tables
-- =====================================================================
alter table public.deliverables enable row level security;
alter table public.submissions enable row level security;

-- Deliverables: public SELECT (briefs are public); INSERT + UPDATE
-- brand-owner only (these are part of the brief shape).
drop policy if exists "deliverables_select_all" on public.deliverables;
create policy "deliverables_select_all" on public.deliverables
  for select using (true);

drop policy if exists "deliverables_insert_brand_owner" on public.deliverables;
create policy "deliverables_insert_brand_owner" on public.deliverables
  for insert to authenticated
  with check (public.is_brand_owner_of_campaign(campaign_id));

drop policy if exists "deliverables_update_brand_owner" on public.deliverables;
create policy "deliverables_update_brand_owner" on public.deliverables
  for update to authenticated
  using (public.is_brand_owner_of_campaign(campaign_id))
  with check (public.is_brand_owner_of_campaign(campaign_id));

-- Submissions: public SELECT (review pages need them).
-- INSERT: creator owner (creators upload content).
-- UPDATE: brand owner (approve/revise + mark live) OR creator owner
-- (resubmit-into-existing-row paths, set permalink).
drop policy if exists "submissions_select_all" on public.submissions;
create policy "submissions_select_all" on public.submissions
  for select using (true);

drop policy if exists "submissions_insert_creator_owner" on public.submissions;
create policy "submissions_insert_creator_owner" on public.submissions
  for insert to authenticated
  with check (public.is_creator_owner(creator_id));

drop policy if exists "submissions_update_owner" on public.submissions;
create policy "submissions_update_owner" on public.submissions
  for update to authenticated
  using (
    public.is_brand_owner_of_campaign(campaign_id)
    or public.is_creator_owner(creator_id)
  )
  with check (
    public.is_brand_owner_of_campaign(campaign_id)
    or public.is_creator_owner(creator_id)
  );

-- =====================================================================
-- 4. Storage bucket for submission files (drafts + revisions)
-- =====================================================================
-- File-path convention: <campaign_id>/<submission_id>/<filename>.
-- Public read so brand-side review pages can preview without signing.
insert into storage.buckets (id, name, public)
values ('submission-files', 'submission-files', true)
on conflict (id) do nothing;

drop policy if exists "submission_files_public_read" on storage.objects;
create policy "submission_files_public_read" on storage.objects
  for select using (bucket_id = 'submission-files');

drop policy if exists "submission_files_creator_insert" on storage.objects;
create policy "submission_files_creator_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'submission-files'
    -- Path's second segment is the submission_id, first is campaign_id.
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
    and exists (
      select 1 from public.submissions s
      where s.id = split_part(storage.objects.name, '/', 2)
      and public.is_creator_owner(s.creator_id)
    )
  );

-- =====================================================================
-- 5. Seed: deliverables + one submission tied to the migrated set
-- =====================================================================
-- Materialise deliverables for cmp_1 (Spring Renewal — "1 Reel + 2 stories")
-- and cmp_3 (Studio Notes — "1 IG post + 1 Reel"). cmp_2 + cmp_4 are
-- secondary surfaces; their deliverables can be added later.
insert into public.deliverables (
  id, campaign_id, index, platform, format, quantity
) values
  -- cmp_1 — Spring Renewal
  ('del_cmp_1_0', 'cmp_1', 0, 'instagram', 'reel',  1),
  ('del_cmp_1_1', 'cmp_1', 1, 'instagram', 'story', 1),
  ('del_cmp_1_2', 'cmp_1', 2, 'instagram', 'story', 1),
  -- cmp_3 — Studio Notes
  ('del_cmp_3_0', 'cmp_3', 0, 'instagram', 'post', 1),
  ('del_cmp_3_1', 'cmp_3', 1, 'instagram', 'reel', 1)
on conflict (id) do nothing;

-- One in-review submission so the brand-side review surface has
-- something to look at end-to-end. Matches demoSubs[0] from seed.ts.
insert into public.submissions (
  id, campaign_id, creator_id, round, files, notes,
  status, submitted_at, feedback, collaboration_id, deliverable_id
) values
  (
    'sub_1', 'cmp_1', 'c_sarah', 2,
    jsonb_build_array(
      jsonb_build_object('name', 'Reel.mp4',  'url', 'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=400&h=400&fit=crop&auto=format'),
      jsonb_build_object('name', 'Still 01',  'url', 'https://images.unsplash.com/photo-1467043198406-dc953a3defa0?w=400&h=400&fit=crop&auto=format'),
      jsonb_build_object('name', 'Still 02',  'url', 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&h=400&fit=crop&auto=format')
    ),
    'Round 2 — adjusted the candle position per feedback.',
    'in_review',
    now() - interval '2 days',
    jsonb_build_array(
      jsonb_build_object('from', 'u_hannah', 'text', 'Looking great overall — one tiny note on the second still: can we shift the candle ~6 inches further from the window?', 'at', to_char(now() - interval '2 days', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')),
      jsonb_build_object('from', 'u_sarah',  'text', 'Got it — re-shooting Still 02 tonight, will have v2 by tomorrow.', 'at', to_char(now() - interval '2 days', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'))
    ),
    'col_seed_sarah_cmp1',
    'del_cmp_1_0'
  )
on conflict (id) do nothing;

-- =====================================================================
-- 6. Verification
-- =====================================================================
-- select count(*) from public.deliverables;        -- 5
-- select count(*) from public.submissions;         -- 1
-- select id, campaign_id, creator_id, status from public.submissions;
