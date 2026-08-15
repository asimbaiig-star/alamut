-- 031_payout_rows_to_gross.sql
--
-- HOW TO RUN
-- ----------
-- Supabase dashboard → your project → SQL Editor → New query → paste this
-- file → Run. Nothing else is needed; no CLI, no connection string, no
-- credentials to copy anywhere.
--
-- Run STEP 1 on its own first if you want to see what would change without
-- changing it. STEP 2 does the work and prints the same report.
--
-- NOTE ON PERMISSIONS: `transactions` has SELECT and INSERT policies only —
-- it is deliberately an append-only ledger (see 020_optimistic_locks.sql).
-- The SQL Editor connects as `postgres`, which bypasses RLS, so this UPDATE
-- succeeds there and only there. That is intentional: this is a one-off
-- correction of rows written under a superseded accounting convention, not a
-- new write path. Nothing in the app can perform this update.
--
--
-- WHY
-- ---
-- Until the P7 change, `v2ApproveContent` and `v2ResolveDispute` wrote the
-- creator's payout row at NET, while the platform-fee and withholding rows
-- beside it merely described money that had already been removed. A creator's
-- ledger therefore summed to (wallet balance − fee − tax) and could never
-- reconcile with the balance printed directly above it.
--
-- Both writers now record GROSS and let the two deduction rows do real work,
-- which is what the seed has always done and what the brand's mirror row
-- (`escrow_release: -gross`) has always meant.
--
-- The client normalizes rows as it reads them, so the UI is already correct
-- with or without this migration. This fixes the rows AT REST, so SQL
-- reporting, exports, and any future consumer agree with the app.
--
--
-- SAFETY
-- ------
-- Only rows provably net under the rates in force are rewritten:
--     payout + |fee| + |withholding| = gross
--     AND round(gross * 0.10) = |fee|
--     AND round(gross * 0.05) = |withholding|
-- A row already stored at gross fails that test, so re-running is a no-op.
-- Advance repayments share `kind = 'fee'` and are excluded by note — they
-- debit the wallet under BOTH conventions and must not be folded in.
-- Withdrawals are `kind = 'payout'` with a negative amount and no campaign_id,
-- so they never match.
--
-- Rates are literals on purpose. If the platform fee changes later, history
-- must not be retroactively rewritten at the new rate.
--
-- `amount` is `numeric` and Postgres `round()` rounds half away from zero;
-- every value here is positive, so it agrees exactly with the JS `Math.round`
-- the app used when it wrote these rows. The two classify identically.


-- ─────────────────────────────────────────────────────────────────────
-- STEP 1 — DRY RUN. Read-only. Shows every row that STEP 2 would rewrite.
-- Safe to run as often as you like.
-- ─────────────────────────────────────────────────────────────────────
select
  p.id                       as payout_id,
  p.user_id,
  p.campaign_id,
  p.at,
  p.amount                   as stored_net,
  (p.amount + d.fee_total)   as will_become_gross,
  d.fee_total                as deductions
from transactions p
join lateral (
  select coalesce(sum(abs(f.amount)), 0) as fee_total
  from transactions f
  where f.kind = 'fee'
    and f.user_id = p.user_id
    and f.campaign_id = p.campaign_id
    and f.at = p.at
    and f.amount < 0
    and coalesce(f.note, '') <> 'Income advance repayment'
) d on true
where p.kind = 'payout'
  and p.status = 'cleared'
  and p.amount > 0
  and p.campaign_id is not null
  and d.fee_total > 0
  and round((p.amount + d.fee_total) * 0.10)
    + round((p.amount + d.fee_total) * 0.05) = d.fee_total
order by p.at desc;


-- ─────────────────────────────────────────────────────────────────────
-- STEP 2 — THE MIGRATION. One statement, so it is atomic on its own: it
-- either rewrites every matching row or none. The final SELECT is part of
-- the same statement, so the editor shows you the report (an earlier draft
-- put the report before a COMMIT, where the editor never displayed it).
--
-- Expected output: one row, `rows_rewritten` and `total_restored`. Both 0
-- means there was nothing to fix — including on a second run.
-- ─────────────────────────────────────────────────────────────────────
with candidates as (
  select
    p.id                      as payout_id,
    p.amount                  as net_amount,
    (p.amount + d.fee_total)  as implied_gross
  from transactions p
  join lateral (
    select coalesce(sum(abs(f.amount)), 0) as fee_total
    from transactions f
    where f.kind = 'fee'
      and f.user_id = p.user_id
      and f.campaign_id = p.campaign_id
      and f.at = p.at
      and f.amount < 0
      and coalesce(f.note, '') <> 'Income advance repayment'
  ) d on true
  where p.kind = 'payout'
    and p.status = 'cleared'
    and p.amount > 0
    and p.campaign_id is not null
    and d.fee_total > 0
    -- The exactness test. Both rounding steps must reproduce the stored
    -- deductions, or this is not a net row from the old writer.
    and round((p.amount + d.fee_total) * 0.10)
      + round((p.amount + d.fee_total) * 0.05) = d.fee_total
),
updated as (
  update transactions t
  set amount = c.implied_gross
  from candidates c
  where t.id = c.payout_id
  returning c.net_amount, c.implied_gross
)
select
  count(*)                                              as rows_rewritten,
  coalesce(sum(implied_gross - net_amount), 0)          as total_restored
from updated;
