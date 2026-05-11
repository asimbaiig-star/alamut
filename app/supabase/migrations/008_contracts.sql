-- Phase 6 — migrate the Contract entity from local store → Postgres.
-- Contracts are the immutable agreement snapshot created at offer
-- acceptance. They protect the creator from post-acceptance brief
-- edits and form the legal trail behind every paid campaign.
--
-- Write paths in the client:
--   - INSERT  · createContractForAcceptedOffer (called from v2AcceptOffer
--               + v2AcceptCounter — runs in same tx as offer→accepted)
--   - UPDATE  · markContractFulfilled — flips status to 'fulfilled' when
--               payout clears (v2ApproveContent + v2ResolveDispute)
--   - UPDATE  · status → 'cancelled' when collab is cancelled
--               (v2CollabActions cancel paths)

-- =====================================================================
-- 1. contracts table
-- =====================================================================
create table if not exists public.contracts (
  id text primary key,
  collaboration_id text not null
    references public.collaborations(id) on delete restrict,
  campaign_id text not null references public.campaigns(id) on delete restrict,
  creator_id text not null,
  brand_id text not null,
  agreed_rate numeric not null,
  net_to_creator numeric not null,
  platform_fee numeric not null,
  withholding_tax numeric not null,
  -- Snapshot array of deliverables-at-acceptance. Editing the campaign's
  -- live deliverable rows later does NOT change this — that's the whole
  -- point of the snapshot.
  deliverables jsonb not null default '[]',
  brief_snapshot text not null,
  brief_snapshot_at timestamptz not null,
  accepted_at timestamptz not null,
  accepted_by_user_id text not null,
  status text not null default 'active'
    check (status in ('active','fulfilled','cancelled')),
  fulfilled_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists contracts_collaboration_id_idx on public.contracts (collaboration_id);
create index if not exists contracts_campaign_id_idx on public.contracts (campaign_id);
create index if not exists contracts_creator_id_idx on public.contracts (creator_id);
create index if not exists contracts_brand_id_idx on public.contracts (brand_id);
create index if not exists contracts_status_idx on public.contracts (status);

drop trigger if exists contracts_touch on public.contracts;
create trigger contracts_touch
  before update on public.contracts
  for each row execute function public.touch_updated_at();

-- =====================================================================
-- 2. RLS
-- =====================================================================
-- SELECT public — both sides need to see the contract on their dashboards.
-- INSERT + UPDATE: brand owner of the campaign OR creator owner.
-- Reuses helpers from migration 005.
alter table public.contracts enable row level security;

drop policy if exists "contracts_select_all" on public.contracts;
create policy "contracts_select_all" on public.contracts
  for select using (true);

drop policy if exists "contracts_insert_owner_or_creator" on public.contracts;
create policy "contracts_insert_owner_or_creator" on public.contracts
  for insert to authenticated
  with check (
    public.is_brand_owner_of_campaign(campaign_id)
    or public.is_creator_owner(creator_id)
  );

drop policy if exists "contracts_update_owner_or_creator" on public.contracts;
create policy "contracts_update_owner_or_creator" on public.contracts
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
-- 3. Seed demo rows
-- =====================================================================
-- One active contract for Sarah's Spring Renewal (col_seed_sarah_cmp1
-- exists in stage='confirmed' with agreed_rate=1800). Deliverable
-- snapshot mirrors the 3 cmp_1 deliverables seeded in 007.
-- Fees: 1800 * 0.10 = 180 platform, 1800 * 0.05 = 90 wht, net 1530.
--
-- ID MUST be `ctr_<collabId>` — that's the stable format the local
-- migrator (lib/api/migrations.ts migrator 5) uses when materializing
-- contracts for pre-existing accepted offers. Aligning the seed id
-- with the migrator-canonical id prevents duplicate rows in the local
-- store after hydration (overlay-by-id would otherwise treat them as
-- two distinct contracts).
insert into public.contracts (
  id, collaboration_id, campaign_id, creator_id, brand_id,
  agreed_rate, net_to_creator, platform_fee, withholding_tax,
  deliverables, brief_snapshot, brief_snapshot_at,
  accepted_at, accepted_by_user_id, status
) values (
  'ctr_col_seed_sarah_cmp1', 'col_seed_sarah_cmp1', 'cmp_1', 'c_sarah', 'b_aesop',
  1800, 1530, 180, 90,
  '[
    {"deliverableId":"del_cmp_1_0","index":0,"platform":"instagram","format":"reel","quantity":1,"dueOffsetDays":null,"specs":null},
    {"deliverableId":"del_cmp_1_1","index":1,"platform":"instagram","format":"story","quantity":1,"dueOffsetDays":null,"specs":null},
    {"deliverableId":"del_cmp_1_2","index":2,"platform":"instagram","format":"story","quantity":1,"dueOffsetDays":null,"specs":null}
  ]'::jsonb,
  'Spring Renewal campaign brief — capture the seasonal Aesop ritual with one reel + two complementary stories. Emphasis on natural light and product authenticity. No filters, no over-editing.',
  '2026-05-04T09:00:00Z',
  '2026-05-04T09:00:00Z', 'u_sarah', 'active'
)
on conflict (id) do nothing;

-- Backfill the collab's contract_id pointer (idempotent — only writes
-- if currently null, so re-runs don't clobber a different contract).
update public.collaborations
  set contract_id = 'ctr_col_seed_sarah_cmp1'
  where id = 'col_seed_sarah_cmp1' and contract_id is null;

-- =====================================================================
-- 4. Verification (uncomment to run)
-- =====================================================================
-- select 'contracts_count' as t, count(*)::text as v from public.contracts
-- union all select 'sarah_contract_status', status::text from public.contracts where id='ctr_col_seed_sarah_cmp1'
-- union all select 'collab_linked', coalesce(contract_id, 'null') from public.collaborations where id='col_seed_sarah_cmp1';
