// Supabase repository for the Transaction entity (Phase 7).
//
// Transactions are INSERT-only. Two operations:
//   - `fetchAllTransactionsFromSupabase` — boot hydration
//   - `insertTransactionsBatchInSupabase` — bulk insert called from
//     the tx() hook in store.ts when a workflow mutation pushes new
//     rows into db.transactions.

import type { Transaction, TxKind, TxStatus } from '@/lib/api/types';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';

type Row = {
  id: string;
  at: string;
  user_id: string;
  kind: TxKind;
  amount: number;
  status: TxStatus;
  campaign_id: string | null;
  counterparty_user_id: string | null;
  note: string;
  created_at: string;
};

const COLUMNS =
  'id, at, user_id, kind, amount, status, campaign_id, ' +
  'counterparty_user_id, note, created_at';

function toTransaction(row: Row): Transaction {
  return {
    id: row.id,
    at: row.at,
    userId: row.user_id,
    kind: row.kind,
    amount: row.amount,
    status: row.status,
    campaignId: row.campaign_id ?? undefined,
    counterpartyUserId: row.counterparty_user_id ?? undefined,
    note: row.note,
  };
}

function toInsertRow(t: Transaction): Record<string, unknown> {
  return {
    id: t.id,
    at: t.at,
    user_id: t.userId,
    kind: t.kind,
    amount: t.amount,
    status: t.status,
    campaign_id: t.campaignId ?? null,
    counterparty_user_id: t.counterpartyUserId ?? null,
    note: t.note,
  };
}

export async function fetchAllTransactionsFromSupabase(): Promise<Transaction[]> {
  if (!isSupabaseConfigured()) return [];
  const sb = getSupabase();
  const { data, error } = await sb.from('transactions').select(COLUMNS);
  if (error) {
    // eslint-disable-next-line no-console
    console.warn('[transactionsRepo] fetchAll failed:', error.message);
    return [];
  }
  return (data ?? []).map((r) => toTransaction(r as unknown as Row));
}

/** Bulk insert. Called from the tx() hook in store.ts whenever a
 *  workflow mutation appends new rows to db.transactions. Each call
 *  can carry 1–N transactions (a single approve can write 4: escrow
 *  release, payout, fee, possibly referral bonus). */
export async function insertTransactionsBatchInSupabase(
  transactions: Transaction[],
): Promise<void> {
  if (!isSupabaseConfigured() || transactions.length === 0) return;
  const sb = getSupabase();
  const { error } = await sb
    .from('transactions')
    .insert(transactions.map(toInsertRow));
  if (error) throw new Error(error.message);
}
