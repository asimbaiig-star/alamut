-- Phase 5c — migrate the Collaboration entity from local store →
-- Postgres. Collaborations are the cross-table join of campaign +
-- creator + offer + stage. They drive the kanban + creator's My
-- Collabs surface.

-- =====================================================================
-- 1. collaborations table
-- =====================================================================
create table if not exists public.collaborations (
  id text primary key,
  campaign_id text not null references public.campaigns(id) on delete cascade,
  creator_id text not null,
  brand_id text not null,   -- denormalized for brand-side queries
  stage text not null default 'invited'
    check (stage in ('invited','pitched','negotiating','confirmed',
                     'submitted','approved','live','paid','cancelled')),
  -- Locked once an offer is accepted; null in pre-acceptance stages.
  agreed_rate numeric,
  accepted_offer_id text,
  contract_id text,
  cancelled_at timestamptz,
  cancellation_reason text,
  -- Full audit transcript of stage transitions.
  history jsonb not null default '[]',
  -- P3 §2.3 — populated when either party requests post-confirmation cancel
  cancellation_request jsonb,
  -- P2 §1.4 — escrow freeze flag for active disputes
  escrow_frozen boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists collaborations_campaign_id_idx on public.collaborations (campaign_id);
create index if not exists collaborations_creator_id_idx on public.collaborations (creator_id);
create index if not exists collaborations_brand_id_idx on public.collaborations (brand_id);
create index if not exists collaborations_stage_idx on public.collaborations (stage);
create index if not exists collaborations_updated_at_desc_idx
  on public.collaborations (updated_at desc);

drop trigger if exists collaborations_touch on public.collaborations;
create trigger collaborations_touch
  before update on public.collaborations
  for each row execute function public.touch_updated_at();

-- =====================================================================
-- 2. RLS
-- =====================================================================
-- SELECT public — brand kanban + creator My Collabs both need full visibility.
-- INSERT + UPDATE: brand owner of the campaign OR creator owner.
-- Uses the helpers from 005_tighten_rls.sql.
alter table public.collaborations enable row level security;

drop policy if exists "collaborations_select_all" on public.collaborations;
create policy "collaborations_select_all" on public.collaborations
  for select using (true);

drop policy if exists "collaborations_insert_owner" on public.collaborations;
create policy "collaborations_insert_owner" on public.collaborations
  for insert to authenticated
  with check (
    public.is_brand_owner_of_campaign(campaign_id)
    or public.is_creator_owner(creator_id)
  );

drop policy if exists "collaborations_update_owner" on public.collaborations;
create policy "collaborations_update_owner" on public.collaborations
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
-- 3. Seed: collaborations matching the migrated offers/applications
-- =====================================================================
-- Sarah (c_sarah) on Aesop's Spring Renewal (cmp_1) — offer accepted.
-- Yuki (c_yuki) on Aesop's Studio Notes (cmp_3) — application shortlisted, no offer yet.
-- Amir (c_amir) on Le Creuset's Holiday Tables (cmp_4) — offer accepted, campaign closed.
insert into public.collaborations (
  id, campaign_id, creator_id, brand_id, stage,
  agreed_rate, accepted_offer_id,
  cancelled_at, cancellation_reason,
  history, created_at
) values
  (
    'col_seed_sarah_cmp1', 'cmp_1', 'c_sarah', 'b_aesop', 'confirmed',
    1800, 'off_1',
    null, null,
    jsonb_build_array(
      jsonb_build_object(
        'at', extract(epoch from (now() - interval '14 days')) * 1000,
        'from', null, 'to', 'confirmed',
        'actorUserId', 'u_hannah', 'reason', 'offer-accepted'
      )
    ),
    now() - interval '14 days'
  ),
  (
    'col_seed_yuki_cmp3', 'cmp_3', 'c_yuki', 'b_aesop', 'pitched',
    null, null,
    null, null,
    jsonb_build_array(
      jsonb_build_object(
        'at', extract(epoch from (now() - interval '5 days')) * 1000,
        'from', null, 'to', 'pitched',
        'actorUserId', 'u_yuki', 'reason', 'app-submitted'
      )
    ),
    now() - interval '5 days'
  ),
  (
    'col_seed_amir_cmp4', 'cmp_4', 'c_amir', 'b_lecreuset', 'paid',
    3000, 'off_4',
    null, null,
    jsonb_build_array(
      jsonb_build_object(
        'at', extract(epoch from (now() - interval '139 days')) * 1000,
        'from', null, 'to', 'paid',
        'actorUserId', 'u_marcus', 'reason', 'historical-seed'
      )
    ),
    now() - interval '139 days'
  )
on conflict (id) do nothing;

-- =====================================================================
-- 4. Verification
-- =====================================================================
-- select id, campaign_id, creator_id, brand_id, stage, agreed_rate from public.collaborations;
