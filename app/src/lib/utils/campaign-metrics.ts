// Pure helpers for the brand campaign list (Phase 3).
//
// Given a Campaign and the rest of the database, derive the metrics that
// pipeline-view UIs need: how long has this been in its current stage, is
// it overdue, does it need the brand's attention right now, and what is
// the funnel-header summary across a slice of campaigns.
//
// All of these are pure functions — no state, no side effects. They take a
// `ref` Date so demo data with fixed "today" stays predictable across
// renders.

import type { Application, Campaign, CampaignStage, Database, Offer, Submission } from '@/lib/api/types';
import { getAcceptedCreators } from '@/lib/api/relations';

// Demo seeding pinned "today" to late April 2026. We honour that as the
// reference date so things like "5 days in stage" line up with seed data.
// Real backend would use Date.now(); this is a demo affordance.
export const REF_DATE = new Date('2026-04-27');

// --- Stage SLA thresholds — days after which a stage is "stale". ---
// P1b §1.2 collapsed CampaignStage to 4 values, so the SLA window is
// also coarser. Per-collab SLAs (offer-pending → 3d, production → 14d,
// etc.) belong on Collaboration (P1c) once that ships.
const STALE_DAYS: Record<CampaignStage, number> = {
  draft:   14,
  live:    21,
  paused:  30,
  closed:  Infinity, // terminal — never stale
};

const DAY_MS = 24 * 60 * 60 * 1000;

/** Try to coerce a friendly deadline like "May 12" or "Tomorrow" into a Date. */
export function parseDeadline(deadline: string, ref: Date = REF_DATE): Date | null {
  if (!deadline) return null;
  const lower = deadline.toLowerCase().trim();
  if (lower === 'today') return new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
  if (lower === 'tomorrow') {
    const d = new Date(ref); d.setDate(d.getDate() + 1); return d;
  }
  const m = lower.match(/^(\d+)\s*days?$/);
  if (m) { const d = new Date(ref); d.setDate(d.getDate() + Number(m[1])); return d; }
  // "Apr 30" → 2026-04-30
  const parsed = new Date(`${deadline} ${ref.getFullYear()}`);
  if (!isNaN(parsed.getTime())) return parsed;
  // Fall back to ISO parsing
  const parsed2 = new Date(deadline);
  if (!isNaN(parsed2.getTime())) return parsed2;
  return null;
}

/** Day diff with sign — positive if `b` is after `a`. Date-only, time-zoned. */
export function daysBetween(a: Date, b: Date): number {
  const aD = new Date(a.getFullYear(), a.getMonth(), a.getDate());
  const bD = new Date(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((bD.getTime() - aD.getTime()) / DAY_MS);
}

/**
 * When did the campaign enter its CURRENT stage? Returns the latest
 * history entry whose stage matches the campaign's current stage. If no
 * matching history entry exists (older campaigns, missing trail), we
 * fall back to `createdAt`.
 */
export function stageEnteredAt(c: Campaign): Date {
  const matching = c.history
    .filter((h) => h.stage === c.stage)
    .sort((a, b) => +new Date(b.at) - +new Date(a.at));
  if (matching[0]) return new Date(matching[0].at);
  return new Date(c.createdAt);
}

/** Days the campaign has been sitting in its current stage as of `ref`. */
export function daysInCurrentStage(c: Campaign, ref: Date = REF_DATE): number {
  const entered = stageEnteredAt(c);
  return Math.max(0, daysBetween(entered, ref));
}

/** True if the campaign has been in its current stage longer than the SLA. */
export function isStale(c: Campaign, ref: Date = REF_DATE): boolean {
  if (c.stage === 'closed') return false;
  return daysInCurrentStage(c, ref) >= STALE_DAYS[c.stage];
}

/** True if the campaign's parsed deadline is in the past. Drafts never overdue. */
export function isOverdue(c: Campaign, ref: Date = REF_DATE): boolean {
  if (c.stage === 'closed' || c.stage === 'draft') return false;
  const d = parseDeadline(c.deadline, ref);
  if (!d) return false;
  return d < new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
}

/**
 * "Weighted" budget — how much of the campaign budget is committed
 * (escrow held + already spent), as opposed to the gross budget figure
 * which may include unallocated headroom.
 */
export function weightedBudget(c: Campaign): number {
  return c.spent + c.escrowHeld;
}

/** Median across an array of numbers. Returns 0 for an empty input. */
export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[mid]
    : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

// --- Per-campaign attention signals ---

export interface AttentionFlags {
  /** Submissions in `in_review` for this campaign. */
  inReviewCount: number;
  /** Offers in `countered` status — brand needs to decide. */
  counterOfferCount: number;
  /** Newly submitted applications awaiting decision. */
  pendingApplicationCount: number;
  /** Open dispute. */
  hasOpenDispute: boolean;
  /** Past deadline. */
  overdue: boolean;
  /** Sat in stage longer than the SLA. */
  stale: boolean;
}

export function attentionFlags(c: Campaign, db: Database, ref: Date = REF_DATE): AttentionFlags {
  const inReviewCount = db.submissions.filter(
    (s) => s.campaignId === c.id && s.status === 'in_review',
  ).length;
  const counterOfferCount = db.offers.filter(
    (o) => o.campaignId === c.id && o.status === 'countered',
  ).length;
  const pendingApplicationCount = db.applications.filter(
    (a) => a.campaignId === c.id && a.status === 'submitted',
  ).length;
  const hasOpenDispute = !!db.disputes.find((d) => d.campaignId === c.id && d.status === 'open');
  return {
    inReviewCount,
    counterOfferCount,
    pendingApplicationCount,
    hasOpenDispute,
    overdue: isOverdue(c, ref),
    stale: isStale(c, ref),
  };
}

/** True if any attention signal demands the brand's eyes. */
export function needsAttention(flags: AttentionFlags): boolean {
  return (
    flags.inReviewCount > 0 ||
    flags.counterOfferCount > 0 ||
    flags.hasOpenDispute ||
    flags.overdue ||
    flags.stale
  );
}

// --- Funnel-header metrics for a slice of campaigns in one stage ---

export interface FunnelMetrics {
  count: number;
  totalBudget: number;
  weightedBudget: number;
  medianDaysInStage: number;
  overdueCount: number;
  staleCount: number;
  attentionCount: number;
  totalApplicants: number;
  totalAccepted: number;
}

export function funnelMetrics(
  campaigns: Campaign[],
  db: Database,
  ref: Date = REF_DATE,
): FunnelMetrics {
  if (campaigns.length === 0) {
    return {
      count: 0, totalBudget: 0, weightedBudget: 0, medianDaysInStage: 0,
      overdueCount: 0, staleCount: 0, attentionCount: 0,
      totalApplicants: 0, totalAccepted: 0,
    };
  }
  const days = campaigns.map((c) => daysInCurrentStage(c, ref));
  let overdueCount = 0;
  let staleCount = 0;
  let attentionCount = 0;
  let totalApplicants = 0;
  let totalAccepted = 0;
  let totalBudget = 0;
  let weighted = 0;
  for (const c of campaigns) {
    const f = attentionFlags(c, db, ref);
    if (f.overdue) overdueCount++;
    if (f.stale) staleCount++;
    if (needsAttention(f)) attentionCount++;
    totalApplicants += db.applications.filter((a) => a.campaignId === c.id).length;
    totalAccepted += getAcceptedCreators(c.id, db).length;
    totalBudget += c.budget;
    weighted += weightedBudget(c);
  }
  return {
    count: campaigns.length,
    totalBudget,
    weightedBudget: weighted,
    medianDaysInStage: median(days),
    overdueCount,
    staleCount,
    attentionCount,
    totalApplicants,
    totalAccepted,
  };
}

// --- Filter predicates ---

export interface CampaignFilters {
  stages: Set<CampaignStage>;
  regions: Set<string>;
  pricing: 'any' | 'fixed' | 'outcome' | 'retainer';
  attention: boolean;     // only show campaigns needing attention
  overdueOnly: boolean;
  search: string;
}

export function emptyFilters(): CampaignFilters {
  return {
    stages: new Set<CampaignStage>(),
    regions: new Set<string>(),
    pricing: 'any',
    attention: false,
    overdueOnly: false,
    search: '',
  };
}

export function applyFilters(
  campaigns: Campaign[],
  db: Database,
  filters: CampaignFilters,
  ref: Date = REF_DATE,
): Campaign[] {
  const q = filters.search.trim().toLowerCase();
  return campaigns.filter((c) => {
    if (filters.stages.size > 0 && !filters.stages.has(c.stage)) return false;
    if (filters.regions.size > 0 && !filters.regions.has(c.region)) return false;
    if (filters.pricing === 'fixed' && c.pricingModel === 'outcome') return false;
    if (filters.pricing === 'outcome' && c.pricingModel !== 'outcome') return false;
    if (filters.pricing === 'retainer' && c.kind !== 'retainer') return false;
    if (q) {
      const hay = `${c.title} ${c.pitch} ${c.category} ${c.region}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (filters.attention || filters.overdueOnly) {
      const flags = attentionFlags(c, db, ref);
      if (filters.attention && !needsAttention(flags)) return false;
      if (filters.overdueOnly && !flags.overdue) return false;
    }
    return true;
  });
}

/** Count of active filter dimensions. Used for the badge on the filters button. */
export function activeFilterCount(filters: CampaignFilters): number {
  let n = 0;
  if (filters.stages.size > 0) n++;
  if (filters.regions.size > 0) n++;
  if (filters.pricing !== 'any') n++;
  if (filters.attention) n++;
  if (filters.overdueOnly) n++;
  return n;
}

/** Encode filters to URL search params. Search is intentionally *not* serialized. */
export function filtersToSearchParams(filters: CampaignFilters): URLSearchParams {
  const p = new URLSearchParams();
  if (filters.stages.size > 0) p.set('stages', [...filters.stages].join(','));
  if (filters.regions.size > 0) p.set('regions', [...filters.regions].join(','));
  if (filters.pricing !== 'any') p.set('pricing', filters.pricing);
  if (filters.attention) p.set('attention', '1');
  if (filters.overdueOnly) p.set('overdue', '1');
  return p;
}

export function filtersFromSearchParams(p: URLSearchParams): CampaignFilters {
  const f = emptyFilters();
  const s = p.get('stages');
  if (s) s.split(',').forEach((x) => f.stages.add(x as CampaignStage));
  const r = p.get('regions');
  if (r) r.split(',').forEach((x) => f.regions.add(x));
  const pricing = p.get('pricing');
  if (pricing === 'fixed' || pricing === 'outcome' || pricing === 'retainer') f.pricing = pricing;
  if (p.get('attention') === '1') f.attention = true;
  if (p.get('overdue') === '1') f.overdueOnly = true;
  return f;
}

// --- Aux helpers used by the list row UI ---

/**
 * Latest-application date — the most recent `Application.submittedAt` for
 * a campaign, or null if none. Useful for sorting "active" campaigns by
 * recency of inbound interest.
 */
export function latestApplicationAt(c: Campaign, db: Database): string | null {
  const apps = db.applications
    .filter((a) => a.campaignId === c.id)
    .sort((a, b) => +new Date(b.submittedAt) - +new Date(a.submittedAt));
  return apps[0]?.submittedAt ?? null;
}

/** Per-campaign aggregates used by the list row. Fast read; no allocations. */
export interface CampaignRowMetrics {
  applicationCount: number;
  acceptedCount: number;
  daysInStage: number;
  flags: AttentionFlags;
  parsedDeadline: Date | null;
}

export function rowMetrics(c: Campaign, db: Database, ref: Date = REF_DATE): CampaignRowMetrics {
  const applicationCount = db.applications.filter((a) => a.campaignId === c.id).length;
  const acceptedCount = getAcceptedCreators(c.id, db).length;
  return {
    applicationCount,
    acceptedCount,
    daysInStage: daysInCurrentStage(c, ref),
    flags: attentionFlags(c, db, ref),
    parsedDeadline: parseDeadline(c.deadline, ref),
  };
}

// Lint-bait imports — kept so consumers can `import type` cleanly.
export type { Application, Offer, Submission };
