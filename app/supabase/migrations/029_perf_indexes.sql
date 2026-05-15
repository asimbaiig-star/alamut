-- Migration 029 — performance advisor sweep (FK indexes + unused-index policy)
--
-- Performance Advisor lint export (2026-05-15) flagged 64 INFOs:
--
--   2  × unindexed_foreign_keys  — real, fixed below
--   62 × unused_index            — informational only, kept (see notes)
--
-- All findings are level=INFO, not WARN/ERROR. The Performance
-- Advisor's `unused_index` check looks at idx_scan in
-- pg_stat_user_indexes since the stats were last reset. On a fresh
-- database with little query traffic, EVERY index reads as "unused"
-- — including ones that are vital for RLS policy lookups, JOIN
-- performance, ORDER BY clauses, and GIN array-contains queries.
--
-- Dropping any of those now would create silent performance cliffs
-- once real users hit the system. Right time to revisit is after a
-- few weeks of real traffic when actual query patterns are visible.
-- Until then, every existing index stays.

-- =====================================================================
-- 1. Add covering indexes for the 2 missing FK constraints on outreach
-- =====================================================================
-- Postgres doesn't auto-index FK columns. Without a covering index,
-- two operations get slow:
--   1. The FK constraint check on cascading deletes / updates of the
--      referenced row (campaigns / offers) does a sequential scan of
--      `outreach` to find dependent rows.
--   2. JOINs from outreach to its parent are slower (no index lookup).
-- Cost of the indexes: tiny (~few KB each). Benefit: real.

create index if not exists outreach_campaign_id_idx
  on public.outreach (campaign_id)
  where campaign_id is not null;

create index if not exists outreach_resulting_offer_id_idx
  on public.outreach (resulting_offer_id)
  where resulting_offer_id is not null;

-- =====================================================================
-- 2. (No-op) — documented decision on the 62 "unused" indexes
-- =====================================================================
-- The advisor flagged these as candidates for removal. They are NOT
-- removed because:
--
--   a. Foreign-key indexes (e.g. campaigns_brand_id_idx,
--      submissions_creator_id_idx, applications_campaign_id_idx, ...)
--      are required for RLS policy lookups that JOIN to brands /
--      creators on owner_email. Dropping them turns every RLS check
--      into a sequential scan.
--
--   b. Status / stage / kind / review_type indexes back the WHERE
--      clauses in workflow queries ("show me all offers in
--      'pending' status", "show me all submissions in_review", etc.).
--      The local UI already filters by these — query traffic just
--      hasn't accumulated against the cloud DB yet.
--
--   c. *_at_desc_idx indexes back ORDER BY ... DESC LIMIT N queries
--      that drive the inbox feeds, kanban stages, and Recent Activity.
--
--   d. GIN array indexes (creators_categories_gin, threads_*_gin_idx)
--      back `array @> ARRAY[...]` containment queries used by Discover
--      filters and inbox mute/archive lookups.
--
--   e. owner_email indexes (creators_owner_email_idx,
--      platform_tokens_owner_email_idx, notifications_owner_email_at_idx)
--      back the `auth.email() = owner_email` RLS check on every
--      authenticated SELECT.
--
-- Revisit after real production traffic accumulates (4+ weeks). Run
-- `select schemaname, relname, indexrelname, idx_scan
-- from pg_stat_user_indexes where idx_scan = 0` to see what's still
-- unused at that point. Anything still 0-scans after real usage is
-- a genuine candidate for removal.

-- =====================================================================
-- Verification (uncomment to run)
-- =====================================================================
-- select indexname, tablename
-- from pg_indexes
-- where schemaname='public' and tablename='outreach'
-- order by indexname;
-- expected: outreach_brand_id_idx + outreach_campaign_id_idx (NEW) +
--           outreach_creator_id_idx + outreach_resulting_offer_id_idx (NEW)
--           + outreach_sent_at_desc_idx + outreach_status_idx + pkey
