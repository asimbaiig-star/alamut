-- 034_disputes_proposal.sql
--
-- Adds the column behind party-proposed dispute settlement (WORKFLOW-GAPS F3).
--
-- WHY THIS EXISTS
--
-- A dispute could only be ended by an admin. The parties who actually know
-- what happened had no way to say "call it 60/40 and we're done" — so every
-- disagreement, however small, queued behind an arbitrator, with the escrow
-- frozen the whole time.
--
-- `Dispute.proposal` holds a split one party has offered the other. It is NOT
-- `resolution`: that column is the outcome and is written once, at the end.
-- This one is a live offer, cleared back to NULL on agree, decline, or
-- withdrawal. Keeping them separate is what makes "proposed but not agreed"
-- representable at all.
--
-- SHAPE (SettlementTerms in types.ts — shared with
-- collaborations.settlement_proposal, added in 033):
--   { "by": "u_hannah", "at": 1755..., "releaseToCreator": 1288, "note": "..." }
--   or SQL NULL when no offer is live.
--
-- Safe and re-runnable: adds a nullable column, no backfill, no data touched.

alter table public.disputes
  add column if not exists proposal jsonb;

comment on column public.disputes.proposal is
  'Live settlement offer from one party to the other: {by, at, releaseToCreator, note}. NULL when none. Distinct from resolution, which is the final outcome.';

-- Verification — expect one row: proposal | jsonb | YES
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'disputes'
  and column_name = 'proposal';
