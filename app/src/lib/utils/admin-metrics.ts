// Admin console selectors (Phase 8).
//
// The admin role manages five queues plus an audit log. These helpers
// surface what an admin needs at-a-glance: per-queue counts, oldest
// pending item per queue, SLA breaches, recent platform-wide events.
//
// Pure read-only — admin actions still flow through `api.*` for real
// state changes.

import { REF_DATE } from './campaign-metrics';
import { getAcceptedCreators } from '@/lib/api/relations';
import type { Database, Dispute, Transaction, User } from '@/lib/api/types';

const DAY_MS = 24 * 60 * 60 * 1000;

// Per-queue SLA in days (heuristics, tuned so a healthy backlog never lights up)
const SLA = {
  creatorApp: 2,    // creator applications shouldn't sit > 2d
  brandVerify: 3,   // brand verifications shouldn't sit > 3d
  dispute: 4,       // disputes shouldn't sit open > 4d
};

// ============================================================
// Queue summaries
// ============================================================

export interface QueueStats {
  count: number;
  oldestPending?: Date;
  oldestPendingDays?: number;
  slaBreached: boolean;
  recentResolved: number;  // resolved/cleared in last 7 days
}

export interface AdminQueueSummary {
  creatorApplications: QueueStats;
  brandVerifications: QueueStats;
  openDisputes: QueueStats;
  escrowInFlight: { count: number; total: number };
  pendingPayouts: { count: number; total: number };
}

export function adminQueueSummary(db: Database, ref: Date = REF_DATE): AdminQueueSummary {
  // Creator applications awaiting review
  const pendingCreators = db.users.filter((u) => u.status === 'pending_admin_review' && u.creatorId);
  const oldestCreator = pendingCreators
    .map((u) => new Date(u.createdAt))
    .sort((a, b) => +a - +b)[0];
  const creatorRecent7 = db.users.filter((u) =>
    u.role === 'creator' && u.status === 'active'
    && +new Date(u.createdAt) >= ref.getTime() - 7 * DAY_MS,
  ).length;

  // Brand verifications
  const unverifiedBrands = db.brands.filter((b) => !b.verified);
  const oldestBrand = unverifiedBrands
    .map((b) => {
      const u = db.users.find((x) => x.id === b.userId);
      return u ? new Date(u.createdAt) : null;
    })
    .filter((d): d is Date => !!d)
    .sort((a, b) => +a - +b)[0];
  const brandsVerifiedRecent7 = db.brands.filter((b) => b.verified).length; // we don't track verifiedAt; approximate
  // (For demo data this is fine — in real backend we'd add a `verifiedAt` field.)

  // Open disputes (P2 §1.4 — `open` and `in-review` are both pending)
  const openDisputes = db.disputes.filter((d) => d.status === 'open' || d.status === 'in-review');
  const oldestDispute = openDisputes
    .map((d) => new Date(d.raisedAt))
    .sort((a, b) => +a - +b)[0];
  const disputesResolvedRecent7 = db.disputes.filter((d) =>
    d.status !== 'open' && d.resolution
    && +new Date(d.resolution.at) >= ref.getTime() - 7 * DAY_MS,
  ).length;

  // Escrow in flight (campaigns with money held)
  const inEscrow = db.campaigns.filter((c) => c.escrowHeld > 0);
  const escrowTotal = inEscrow.reduce((sum, c) => sum + c.escrowHeld, 0);

  // Pending payouts (transactions queued)
  const pendingPay = db.transactions.filter((t) => t.kind === 'payout' && t.status === 'pending');
  const pendingPayTotal = pendingPay.reduce((sum, t) => sum + Math.abs(t.amount), 0);

  return {
    creatorApplications: queueStats(pendingCreators.length, oldestCreator, ref, SLA.creatorApp, creatorRecent7),
    brandVerifications: queueStats(unverifiedBrands.length, oldestBrand, ref, SLA.brandVerify, brandsVerifiedRecent7),
    openDisputes: queueStats(openDisputes.length, oldestDispute, ref, SLA.dispute, disputesResolvedRecent7),
    escrowInFlight: { count: inEscrow.length, total: escrowTotal },
    pendingPayouts: { count: pendingPay.length, total: pendingPayTotal },
  };
}

function queueStats(count: number, oldest: Date | undefined, ref: Date, slaDays: number, recentResolved: number): QueueStats {
  const stats: QueueStats = { count, slaBreached: false, recentResolved };
  if (oldest && count > 0) {
    stats.oldestPending = oldest;
    stats.oldestPendingDays = Math.max(0, Math.round((+ref - +oldest) / DAY_MS));
    stats.slaBreached = (stats.oldestPendingDays || 0) >= slaDays;
  }
  return stats;
}

export function totalActionableCount(s: AdminQueueSummary): number {
  return s.creatorApplications.count + s.brandVerifications.count + s.openDisputes.count;
}

// ============================================================
// Admin activity feed — what admins (and the platform) recently did
// ============================================================

export type AdminEventKind =
  | 'creator_decision'   // admin approved/rejected a creator
  | 'brand_verified'     // admin set verified
  | 'dispute_resolved'   // admin resolved a dispute
  | 'campaign_milestone' // significant platform event (campaign closed, large payout)
  | 'payout'             // a payout cleared
  | 'large_escrow';      // a notable escrow hold

export interface AdminEvent {
  id: string;
  at: string;
  kind: AdminEventKind;
  text: string;
  detail?: string;
  amount?: number;
  href?: string;
}

const ACTIVITY_LIMIT = 20;

export function adminActivity(db: Database, limit = ACTIVITY_LIMIT): AdminEvent[] {
  const out: AdminEvent[] = [];

  // Resolved disputes (P2 §1.4 — `resolution` is non-null only on resolved cases)
  db.disputes
    .filter((d) => d.resolution && d.status !== 'open' && d.status !== 'in-review')
    .forEach((d) => {
      const c = db.campaigns.find((cc) => cc.id === d.campaignId);
      const r = d.resolution!;
      out.push({
        id: `dispute:${d.id}`,
        // `at` is now ms; admin event format expects ISO. Convert here.
        at: new Date(r.at).toISOString(),
        kind: 'dispute_resolved',
        text: `Dispute resolved · ${c?.title || 'campaign'}`,
        detail: r.note.slice(0, 110) + (r.note.length > 110 ? '…' : ''),
        amount: (r.releaseAmount || 0) + (r.refundAmount || 0),
        href: '/admin/queue?type=disputes',
      });
    });

  // Active creators (proxy for "approved")
  db.users
    .filter((u) => u.role === 'creator' && u.status === 'active' && u.creatorId)
    .forEach((u) => {
      const c = db.creators.find((cr) => cr.id === u.creatorId);
      if (!c) return;
      out.push({
        id: `creator:${u.id}`,
        at: u.createdAt,
        kind: 'creator_decision',
        text: `${c.name} joined as a creator`,
        detail: `${c.handle} · ${c.tier} · ${c.city}`,
        href: '/admin/queue',
      });
    });

  // Verified brands (no `verifiedAt`, approximate using user.createdAt)
  db.brands
    .filter((b) => b.verified)
    .forEach((b) => {
      const u = db.users.find((x) => x.id === b.userId);
      if (!u) return;
      out.push({
        id: `verify:${b.id}`,
        at: u.createdAt,
        kind: 'brand_verified',
        text: `${b.name} verified`,
        detail: b.industry,
        href: '/admin/queue?type=brands',
      });
    });

  // Closed campaigns
  db.campaigns
    .filter((c) => c.stage === 'closed')
    .forEach((c) => {
      const lastClose = [...c.history].reverse().find((h) => h.stage === 'closed');
      if (!lastClose) return;
      const brand = db.brands.find((b) => b.id === c.brandId);
      const acceptedCount = getAcceptedCreators(c.id, db).length;
      out.push({
        id: `closed:${c.id}`,
        at: lastClose.at,
        kind: 'campaign_milestone',
        text: `${brand?.name || 'Brand'} closed ${c.title}`,
        detail: `${acceptedCount} creator${acceptedCount === 1 ? '' : 's'} · ${formatMoneyShort(c.spent)} paid`,
        amount: c.spent,
        href: '/admin/audit',
      });
    });

  // Large payouts (above $1k)
  db.transactions
    .filter((t) => t.kind === 'payout' && Math.abs(t.amount) >= 1000)
    .forEach((t) => {
      const u = db.users.find((x) => x.id === t.userId);
      const cr = u?.creatorId ? db.creators.find((c) => c.id === u.creatorId) : null;
      out.push({
        id: `pay:${t.id}`,
        at: t.at,
        kind: 'payout',
        text: `Payout cleared to ${cr?.name || u?.email || 'user'}`,
        detail: t.note,
        amount: Math.abs(t.amount),
        href: '/admin/payouts',
      });
    });

  out.sort((a, b) => +new Date(b.at) - +new Date(a.at));
  return out.slice(0, limit);
}

function formatMoneyShort(n: number): string {
  if (n >= 1000) return `$${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return `$${n}`;
}

// ============================================================
// Per-stage escrow snapshot — for the payouts page
// ============================================================

export interface StageEscrow {
  stage: string;
  count: number;
  total: number;
}

export function escrowByStage(db: Database): StageEscrow[] {
  const inFlight = db.campaigns.filter((c) => c.escrowHeld > 0);
  const map = new Map<string, { count: number; total: number }>();
  for (const c of inFlight) {
    const prev = map.get(c.stage) || { count: 0, total: 0 };
    map.set(c.stage, { count: prev.count + 1, total: prev.total + c.escrowHeld });
  }
  const order = ['offer', 'production', 'posted', 'reporting', 'closed', 'shortlist', 'live', 'draft'];
  const arr: StageEscrow[] = [];
  for (const stage of order) {
    if (map.has(stage)) {
      const v = map.get(stage)!;
      arr.push({ stage, count: v.count, total: v.total });
    }
  }
  return arr;
}

// ============================================================
// Daily admin transaction series for sparklines
// ============================================================

export function platformSeries(
  db: Database,
  kindFilter: (t: Transaction) => boolean,
  ref: Date = REF_DATE,
  windowDays = 30,
): { date: string; total: number }[] {
  const start = new Date(ref);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (windowDays - 1));

  const buckets = new Map<string, number>();
  for (let i = 0; i < windowDays; i++) {
    const d = new Date(start.getTime() + i * DAY_MS);
    buckets.set(isoDay(d), 0);
  }

  for (const t of db.transactions) {
    if (t.status !== 'cleared') continue;
    if (!kindFilter(t)) continue;
    const d = new Date(t.at);
    if (d < start || d > ref) continue;
    const key = isoDay(d);
    if (!buckets.has(key)) continue;
    buckets.set(key, (buckets.get(key) || 0) + Math.abs(t.amount));
  }

  const out: { date: string; total: number }[] = [];
  buckets.forEach((total, date) => out.push({ date, total }));
  out.sort((a, b) => a.date.localeCompare(b.date));
  return out;
}

function isoDay(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

// Re-export types so consumers don't need to chase down core types
export type { Dispute, Transaction, User };
