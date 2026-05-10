// Dashboard selectors for money + activity surfaces.
//
// Originally introduced in Phase 7 to back the brand/creator Home
// dashboards (Phase 29 deleted both Home screens). What's left here
// after Phase 30 cleanup:
//
//   - dailySeries()        → sparkline buckets, used by Earnings,
//                            Wallet, Analytics
//   - ActivityEvent shape  → consumed by the dashboard ActivityFeed
//                            (still used by admin/Home) and the
//                            money-metrics → ActivityEvent[] adapter
//
// The brand/creator activity-stream + top-creators + trust-progression
// helpers were unique to the deleted Home screens and have been
// removed in Phase 30 cleanup. If a future polish brings any of those
// surfaces back, recover from `_backup-pre-deal-redesign-2026-05-05/`.

import { REF_DATE } from './campaign-metrics';
import type { Transaction } from '@/lib/api/types';

// ============================================================
// Daily transaction series — sparkline data
// ============================================================

export interface DailyPoint {
  date: string;   // ISO yyyy-mm-dd
  total: number;  // sum of |amount| in $ on that day, signed by direction
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Group transactions into daily buckets over the last `windowDays` ending at `ref`.
 * Returns one entry per day (including zeros) so the sparkline renders smoothly.
 *
 * `select` lets the caller scope to inflows or outflows or specific txn kinds.
 */
export function dailySeries(
  transactions: Transaction[],
  select: (t: Transaction) => number,
  ref: Date = REF_DATE,
  windowDays = 90,
): DailyPoint[] {
  const start = new Date(ref);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (windowDays - 1));

  // Bucket by yyyy-mm-dd
  const buckets = new Map<string, number>();
  for (let d = 0; d < windowDays; d++) {
    const date = new Date(start.getTime() + d * DAY_MS);
    buckets.set(isoDay(date), 0);
  }

  for (const tx of transactions) {
    if (tx.status !== 'cleared') continue;
    const txDate = new Date(tx.at);
    if (txDate < start) continue;
    if (txDate > ref) continue;
    const key = isoDay(txDate);
    if (!buckets.has(key)) continue;
    buckets.set(key, (buckets.get(key) || 0) + select(tx));
  }

  const out: DailyPoint[] = [];
  buckets.forEach((total, date) => out.push({ date, total }));
  out.sort((a, b) => a.date.localeCompare(b.date));
  return out;
}

function isoDay(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// ============================================================
// Activity feed event shape
// ============================================================

export type ActivityEventKind =
  | 'stage'
  | 'application'
  | 'app_decision'
  | 'offer_sent'
  | 'offer_responded'
  | 'submission'
  | 'submission_decision'
  | 'payout'
  | 'review';

export interface ActivityEvent {
  id: string;
  at: string;
  kind: ActivityEventKind;
  campaignId?: string;
  campaignTitle?: string;
  creatorId?: string;
  creatorName?: string;
  brandId?: string;
  brandName?: string;
  text: string;       // human-readable label
  detail?: string;    // optional second line
  amount?: number;    // optional money amount
  href?: string;      // navigation target (workspace path)
}
