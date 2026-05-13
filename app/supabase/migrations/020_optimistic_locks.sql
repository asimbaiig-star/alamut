-- Migration 020 — optimistic locking on the five highest-risk mutation tables.
--
-- Problem: pre-fix two browser tabs racing the same UPDATE both pass
-- their app-layer idempotency guards against stale in-memory snapshots,
-- then both commit to Postgres — the second overwrites the first
-- silently. For money-bearing rows (campaigns.escrow_held, offers.status,
-- submissions.status, etc.) that's a real divergence.
--
-- Fix: every UPDATE-able row carries an integer `version` column.
-- Repos read it on fetch, then issue UPDATEs gated on `where id = ?
-- and version = ?` (with `version = version + 1` in the SET clause).
-- When two tabs race, the second tab's UPDATE matches 0 rows; the
-- caller surfaces a stale-version error and the next read pulls the
-- current row from Postgres. Local Zustand state eventually catches
-- up via the cross-tab `storage` event sync that already exists.
--
-- This is the prototype-grade defence. A real production system would
-- also add retry-with-merge in the mirror layer; for the demo a single
-- conflict toast + auto-refresh on next read is enough.
--
-- Tables in scope (mutated by the v2 actions audited in slice 5):
--   - campaigns       (budget / escrow / stage / settings)
--   - offers          (status flips during negotiation)
--   - applications    (status: submitted/shortlisted/rejected/withdrawn)
--   - submissions     (status flips on review)
--   - collaborations  (stage + cancellation request)
--   - disputes        (status flips on resolve/withdraw)
--
-- Skipped:
--   - transactions   — append-only, no UPDATE path (immutable ledger)
--   - threads/messages — append-only message log; thread metadata
--                        races are low-impact (read receipts, mute flags)
--   - brands / creators — UPDATE-able but the cross-tab race surface
--                        is small (own-profile edits); could be added in
--                        a follow-up if profile-edit conflicts become
--                        a real problem.

-- =====================================================================
-- 1. Add version columns (default 0 for backfill of existing rows)
-- =====================================================================
alter table public.campaigns       add column if not exists version integer not null default 0;
alter table public.offers          add column if not exists version integer not null default 0;
alter table public.applications    add column if not exists version integer not null default 0;
alter table public.submissions     add column if not exists version integer not null default 0;
alter table public.collaborations  add column if not exists version integer not null default 0;
alter table public.disputes        add column if not exists version integer not null default 0;

-- =====================================================================
-- 2. Verification (uncomment to run)
-- =====================================================================
-- select column_name, data_type, column_default
--   from information_schema.columns
--   where table_schema = 'public' and column_name = 'version'
--   order by table_name;
-- expected: 6 rows, all integer, default 0
