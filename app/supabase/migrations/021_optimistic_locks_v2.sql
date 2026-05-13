-- Migration 021 — optimistic locking on brands + creators (parity
-- with migration 020 which covered the 6 highest-risk mutation tables).
--
-- These two tables were deferred from migration 020 because the race
-- surface is smaller (own-profile edits are rare, single-user) and a
-- last-write-wins overwrite is mostly cosmetic. But after wiring locks
-- on every other UPDATE-able table, the inconsistency was the only
-- thing left — easy to close and removes a class of "why doesn't this
-- behave like the other repos?" questions.
--
-- Same shape as 020: `version integer not null default 0`, repos
-- accept optional `expectedVersion`, mirrors read + writeBack.

alter table public.brands   add column if not exists version integer not null default 0;
alter table public.creators add column if not exists version integer not null default 0;

-- =====================================================================
-- Verification (uncomment to run)
-- =====================================================================
-- select table_name, column_name, data_type, column_default
--   from information_schema.columns
--   where table_schema = 'public' and column_name = 'version'
--   order by table_name;
-- expected: 8 rows total (6 from 020 + brands + creators), all integer
