-- 033_collaborations_settlement_proposal.sql
--
-- Adds the column behind the settlement handshake (WORKFLOW-GAPS F1).
--
-- WHY THIS EXISTS
--
-- `v2ProposeSettlement` writes `collab.settlementProposal`, and
-- `v2AgreeSettlement` reads it back to decide the split. Both worked
-- perfectly — in one browser. The column was never added, so the field
-- was dropped on every mirror to Supabase and never rehydrated.
--
-- A settlement is a HANDSHAKE: one party proposes, the OTHER agrees. If
-- the proposal only exists in the proposer's localStorage, the one person
-- who has to see it is the one person who never will. The feature could
-- not work across two devices, which is the only way it is ever used.
--
-- `cancellation_request` — the same shape of thing, a pending two-party
-- request parked on the collab — has been a jsonb column since 006. This
-- brings settlement in line with it.
--
-- SHAPE (mirrors Collaboration['settlementProposal'] in types.ts):
--   { "by": "u_hannah", "at": 1755..., "releaseToCreator": 1288, "note": "..." }
--   or SQL NULL when there is no live proposal.
--
-- Safe and re-runnable: adds a nullable column, no backfill, no data
-- touched. Existing rows get NULL, which is exactly "no live proposal".

alter table public.collaborations
  add column if not exists settlement_proposal jsonb;

comment on column public.collaborations.settlement_proposal is
  'Pending settlement offer: {by, at, releaseToCreator, note}. NULL when none is live. Cleared when agreed or declined.';

-- Verification — expect one row: settlement_proposal | jsonb | YES
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'collaborations'
  and column_name = 'settlement_proposal';
