// Money-screen helpers (Phase 10).
//
// Used by /brand/wallet and /creator/earnings to build the year-to-date
// monthly chart, the by-brand breakdown rail, and the transaction ledger.
// Pure — no state.

import { REF_DATE } from './campaign-metrics';
import type { Database, Transaction } from '@/lib/api/types';
import type { ActivityEvent } from './dashboard-metrics';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// ============================================================
// Year-to-date bar chart data
// ============================================================

export interface MonthlyTotals {
  values: number[];        // length 12
  total: number;
  count: number;
  thisMonthIdx: number;
  max: number;
  taxEstimate: number;     // 25% of total (heuristic for the tax-set-aside chip)
}

/**
 * Bucket cleared inflows for a year by month. `transactions` should already
 * be scoped to the user. `year` defaults to the demo's pinned current year.
 */
export function monthlyInflows(
  transactions: Transaction[],
  year: number = REF_DATE.getFullYear(),
  ref: Date = REF_DATE,
): MonthlyTotals {
  const values = new Array(12).fill(0);
  let total = 0;
  let count = 0;
  for (const t of transactions) {
    if (t.status !== 'cleared') continue;
    if (t.amount <= 0) continue;
    const d = new Date(t.at);
    if (d.getFullYear() !== year) continue;
    const m = d.getMonth();
    values[m] += t.amount;
    total += t.amount;
    count++;
  }
  return {
    values,
    total,
    count,
    thisMonthIdx: ref.getFullYear() === year ? ref.getMonth() : -1,
    max: Math.max(1, ...values),
    taxEstimate: Math.round(total * 0.25),
  };
}

export function monthName(i: number): string {
  return MONTHS[i] ?? '';
}

// ============================================================
// Group by brand
// ============================================================

export interface ByBrandRow {
  brandName: string;
  brandId: string | null;
  total: number;
  count: number;
  /** Pct of overall total, 0..100. */
  pct: number;
}

export function inflowsByBrand(
  transactions: Transaction[],
  db: Database,
  year?: number,
): ByBrandRow[] {
  const buckets = new Map<string, { brandId: string | null; total: number; count: number }>();
  let grand = 0;
  for (const t of transactions) {
    if (t.status !== 'cleared') continue;
    if (t.amount <= 0) continue;
    if (year !== undefined && new Date(t.at).getFullYear() !== year) continue;
    const cmp = t.campaignId ? db.campaigns.find((c) => c.id === t.campaignId) : null;
    const brand = cmp ? db.brands.find((b) => b.id === cmp.brandId) : null;
    const name = brand?.name || 'Other';
    const prev = buckets.get(name) || { brandId: brand?.id || null, total: 0, count: 0 };
    buckets.set(name, { brandId: brand?.id || null, total: prev.total + t.amount, count: prev.count + 1 });
    grand += t.amount;
  }
  const rows: ByBrandRow[] = [];
  buckets.forEach((v, brandName) => {
    rows.push({
      brandName,
      brandId: v.brandId,
      total: v.total,
      count: v.count,
      pct: grand > 0 ? (v.total / grand) * 100 : 0,
    });
  });
  rows.sort((a, b) => b.total - a.total);
  return rows;
}

// ============================================================
// Outflow buckets (used by brand wallet for "where did money go")
// ============================================================

export interface ByCampaignRow {
  campaignTitle: string;
  campaignId: string | null;
  total: number;
  count: number;
  pct: number;
}

export function outflowsByCampaign(
  transactions: Transaction[],
  db: Database,
  year?: number,
): ByCampaignRow[] {
  const buckets = new Map<string, { campaignId: string | null; total: number; count: number }>();
  let grand = 0;
  for (const t of transactions) {
    if (t.status !== 'cleared') continue;
    // Outflows from brand POV: escrow_release, ad_spend, fee
    if (!(t.kind === 'escrow_release' || t.kind === 'ad_spend' || t.kind === 'fee')) continue;
    const amt = Math.abs(t.amount);
    if (amt <= 0) continue;
    if (year !== undefined && new Date(t.at).getFullYear() !== year) continue;
    const cmp = t.campaignId ? db.campaigns.find((c) => c.id === t.campaignId) : null;
    const name = cmp?.title || 'Other';
    const prev = buckets.get(name) || { campaignId: cmp?.id || null, total: 0, count: 0 };
    buckets.set(name, { campaignId: cmp?.id || null, total: prev.total + amt, count: prev.count + 1 });
    grand += amt;
  }
  const rows: ByCampaignRow[] = [];
  buckets.forEach((v, campaignTitle) => {
    rows.push({
      campaignTitle,
      campaignId: v.campaignId,
      total: v.total,
      count: v.count,
      pct: grand > 0 ? (v.total / grand) * 100 : 0,
    });
  });
  rows.sort((a, b) => b.total - a.total);
  return rows;
}

// ============================================================
// Transactions → ActivityEvent[] (for the dashboard ActivityFeed)
// ============================================================

export interface TxToActivityOptions {
  /** The current user's POV — needed to label inflows vs outflows. */
  side: 'brand' | 'creator';
  href: string;
  limit?: number;
}

export function transactionsToActivity(
  transactions: Transaction[],
  db: Database,
  opts: TxToActivityOptions,
): ActivityEvent[] {
  const out: ActivityEvent[] = [];
  for (const t of transactions) {
    if (t.status === 'failed') continue;
    const cmp = t.campaignId ? db.campaigns.find((c) => c.id === t.campaignId) : null;
    const counter = t.counterpartyUserId ? db.users.find((u) => u.id === t.counterpartyUserId) : null;
    const counterCreator = counter?.creatorId ? db.creators.find((c) => c.id === counter.creatorId) : null;
    const counterBrand = counter?.brandId ? db.brands.find((b) => b.id === counter.brandId) : null;
    const counterName = counterCreator?.name || counterBrand?.name || counter?.email;

    const text = (() => {
      switch (t.kind) {
        case 'topup':           return 'Wallet topped up';
        case 'escrow_hold':     return cmp ? `Escrow held · ${cmp.title}` : 'Escrow held';
        case 'escrow_release':
          if (opts.side === 'brand') return cmp ? `Released to ${counterName || 'creator'} · ${cmp.title}` : `Released to ${counterName || 'creator'}`;
          return cmp ? `Escrow released · ${cmp.title}` : 'Escrow released';
        case 'payout':          return opts.side === 'creator' ? 'Payout cleared' : `Paid out to ${counterName || 'recipient'}`;
        case 'refund':          return cmp ? `Refunded · ${cmp.title}` : 'Refund';
        case 'fee':             return 'Platform fee';
        case 'ad_spend':        return cmp ? `Ad boost · ${cmp.title}` : 'Ad spend';
        case 'referral_bonus':  return 'Referral bonus';
        default:                return t.note;
      }
    })();

    out.push({
      id: `tx:${t.id}`,
      at: t.at,
      kind: t.amount >= 0 ? (t.kind === 'topup' ? 'payout' : 'app_decision') : 'payout',
      text,
      detail: cmp?.title || t.note,
      amount: Math.abs(t.amount),
      href: opts.href,
    });
  }
  out.sort((a, b) => +new Date(b.at) - +new Date(a.at));
  return opts.limit ? out.slice(0, opts.limit) : out;
}

// ============================================================
// Quick stats
// ============================================================

export function thisMonthInflows(transactions: Transaction[], ref: Date = REF_DATE): { total: number; count: number } {
  let total = 0;
  let count = 0;
  for (const t of transactions) {
    if (t.status !== 'cleared') continue;
    if (t.amount <= 0) continue;
    const d = new Date(t.at);
    if (d.getFullYear() !== ref.getFullYear()) continue;
    if (d.getMonth() !== ref.getMonth()) continue;
    total += t.amount;
    count++;
  }
  return { total, count };
}

export function lastMonthInflows(transactions: Transaction[], ref: Date = REF_DATE): { total: number; count: number } {
  const lastMonth = new Date(ref.getFullYear(), ref.getMonth() - 1, 1);
  let total = 0;
  let count = 0;
  for (const t of transactions) {
    if (t.status !== 'cleared') continue;
    if (t.amount <= 0) continue;
    const d = new Date(t.at);
    if (d.getFullYear() !== lastMonth.getFullYear()) continue;
    if (d.getMonth() !== lastMonth.getMonth()) continue;
    total += t.amount;
    count++;
  }
  return { total, count };
}
