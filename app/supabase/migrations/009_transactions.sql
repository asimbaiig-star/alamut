-- Phase 7 — migrate the Transaction entity from local store → Postgres.
-- Transactions are the immutable financial ledger: every escrow_hold,
-- escrow_release, payout, refund, fee, topup, ad_spend, and
-- referral_bonus that flows through the platform. INSERT-only —
-- once written, never updated or deleted.
--
-- Write paths: every `db.transactions.push(...)` in v2 actions
-- (v2CampaignActions + v2DisputeActions + v2CollabActions). Rather
-- than tap each of 13+ push sites, the client mirrors by diffing
-- `db.transactions.length` inside the `tx()` wrapper — anything new
-- since the previous snapshot fires a bulk INSERT.
--
-- Hydration backfill: seed transactions are local-only (most are
-- attached to generated cmp_g* campaigns that don't exist in Postgres,
-- so FK constraints would fail anyway). Postgres only persists txs
-- created by live workflow actions after this migration.

-- =====================================================================
-- 1. transactions table
-- =====================================================================
create table if not exists public.transactions (
  id text primary key,
  -- ISO timestamp at the moment of recording. Kept as timestamptz so
  -- the financial timeline sorts correctly.
  at timestamptz not null,
  user_id text not null,
  kind text not null
    check (kind in ('topup','escrow_hold','escrow_release','payout',
                    'refund','fee','ad_spend','referral_bonus')),
  -- Signed: positive = inflow to user_id's wallet, negative = outflow.
  amount numeric not null,
  status text not null default 'cleared'
    check (status in ('cleared','pending','failed')),
  -- Nullable FK — topups + referral bonuses aren't campaign-scoped.
  -- On delete restrict: deleting a campaign with txs would lose audit
  -- trail, so we'd rather block the delete.
  campaign_id text references public.campaigns(id) on delete restrict,
  counterparty_user_id text,
  note text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists transactions_user_id_idx on public.transactions (user_id);
create index if not exists transactions_campaign_id_idx on public.transactions (campaign_id);
create index if not exists transactions_kind_idx on public.transactions (kind);
create index if not exists transactions_at_desc_idx on public.transactions (at desc);

-- No `transactions_touch` trigger — rows are immutable; updated_at
-- would never advance.

-- =====================================================================
-- 2. RLS
-- =====================================================================
-- SELECT: authenticated. Wallet figures are mildly sensitive — we
-- don't expose the ledger to anonymous public reads (unlike submissions
-- which are explicitly public for storefront discovery).
--
-- INSERT: authenticated. Tighter row-level checks would require a
-- userId → email lookup which the schema doesn't carry yet (users
-- live in auth.users with UUIDs, not in a public.users mirror).
-- The risk surface here is bounded: a malicious INSERT can only
-- create a phantom ledger row visible to other authenticated users —
-- it doesn't move real money (escrow + wallet balances live on the
-- brand/creator rows which DO have proper RLS).
--
-- UPDATE + DELETE: denied (immutable audit log).
alter table public.transactions enable row level security;

drop policy if exists "transactions_select_authenticated" on public.transactions;
create policy "transactions_select_authenticated" on public.transactions
  for select to authenticated using (true);

drop policy if exists "transactions_insert_authenticated" on public.transactions;
create policy "transactions_insert_authenticated" on public.transactions
  for insert to authenticated with check (true);

-- =====================================================================
-- 3. Verification (uncomment to run)
-- =====================================================================
-- select 'rows' as t, count(*)::text as v from public.transactions
-- union all select 'rls_select', (select polname from pg_policies where tablename='transactions' and cmd='SELECT')
-- union all select 'rls_insert', (select polname from pg_policies where tablename='transactions' and cmd='INSERT');
