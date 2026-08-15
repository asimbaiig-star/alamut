// performance.ts — the one way to get campaign performance.
//
// This replaces `derivePerf`, which manufactured numbers at render time:
//
//     reach        = Σ follower counts of live creators
//     impressions  = reach × 1.4
//     er           = average of profile-level engagement rates
//     saves/shares = engagement × 0.15 / × 0.07
//     weeklySeries = a fixed decay curve [0.08, 0.18, 0.16, …]
//     fallback     = spent × 18, er 11.5
//
// …then surfaced them as IMPRESSIONS / CPM / EMV / ROAS with week-over-week
// deltas, for every brand, indistinguishable from measurement. None of it is
// measured; the product has no platform integrations.
//
// The rule now: performance is stored, never computed. `readPerformance`
// returns `null` when there's no row, and every surface treats null as
// "nothing to report yet" rather than reaching for a formula.
//
// CPM, CPE and ER are still derived here — but only from a stored count and
// real money, which is division, not invention.

import type { Database, CampaignPerformance } from '@/lib/api/types';

/** Performance figures a surface can render, or `null` if there are none. */
export interface PerfView {
  /** Authored demo data rather than measured — surfaces must label it. */
  sample: boolean;
  impressions: number;
  reach: number;
  engagement: number;
  saves: number;
  shares: number;
  profileVisits: number;
  weeklySeries: number[];
  byCreator: { creatorId: string; impressions: number; engagement: number }[];
  /** Engagement ÷ impressions, as a percentage. */
  er: number;
  /** Real spend ÷ stored impressions × 1000. `null` when either is 0. */
  cpm: number | null;
  /** Real spend ÷ stored engagement. `null` when either is 0. */
  cpe: number | null;
}

/**
 * Stored performance for a campaign, with money-derived ratios attached.
 *
 * `spent` comes from the ledger and is real, so CPM and CPE are real
 * divisions of a real numerator by a stored denominator. They return `null`
 * rather than 0 when there's nothing to divide — a $0 CPM reads as
 * "extremely efficient", which is the opposite of "unknown".
 */
export function readPerformance(
  campaignId: string,
  spent: number,
  db: Pick<Database, 'campaignPerformance'>,
): PerfView | null {
  const row: CampaignPerformance | undefined =
    db.campaignPerformance?.find((p) => p.campaignId === campaignId);
  if (!row) return null;

  return {
    sample: row.sample,
    impressions: row.impressions,
    reach: row.reach,
    engagement: row.engagement,
    saves: row.saves,
    shares: row.shares,
    profileVisits: row.profileVisits,
    weeklySeries: row.weeklySeries,
    byCreator: row.byCreator,
    er: row.impressions > 0
      ? Number(((row.engagement / row.impressions) * 100).toFixed(1))
      : 0,
    cpm: row.impressions > 0 && spent > 0
      ? Math.round((spent / row.impressions) * 1000)
      : null,
    cpe: row.engagement > 0 && spent > 0
      ? Math.round(spent / row.engagement)
      : null,
  };
}

/**
 * Sum stored performance across several campaigns, for the brand-wide view.
 *
 * Returns `null` when no campaign in the set has a row, so Brand analytics
 * shows its empty state instead of a page of zeroes.
 */
export function aggregatePerformance(
  campaigns: { id: string; spent: number }[],
  db: Pick<Database, 'campaignPerformance'>,
): PerfView | null {
  const rows = campaigns
    .map((c) => ({ perf: readPerformance(c.id, c.spent, db), spent: c.spent }))
    .filter((r): r is { perf: PerfView; spent: number } => r.perf !== null);
  if (rows.length === 0) return null;

  const sum = (pick: (p: PerfView) => number) => rows.reduce((s, r) => s + pick(r.perf), 0);
  const impressions = sum((p) => p.impressions);
  const engagement = sum((p) => p.engagement);
  const spent = rows.reduce((s, r) => s + r.spent, 0);

  // Week i across all campaigns. Series can differ in length (campaigns
  // launch at different times), so align on the longest and treat missing
  // weeks as zero rather than dropping the campaign.
  const weeks = Math.max(...rows.map((r) => r.perf.weeklySeries.length), 0);
  const weeklySeries = Array.from({ length: weeks }, (_, i) =>
    rows.reduce((s, r) => s + (r.perf.weeklySeries[i] ?? 0), 0));

  return {
    // Mixed real and sample data still has to be labelled — if any part is
    // authored, the total is not a measurement.
    sample: rows.some((r) => r.perf.sample),
    impressions,
    reach: sum((p) => p.reach),
    engagement,
    saves: sum((p) => p.saves),
    shares: sum((p) => p.shares),
    profileVisits: sum((p) => p.profileVisits),
    weeklySeries,
    byCreator: rows.flatMap((r) => r.perf.byCreator),
    er: impressions > 0 ? Number(((engagement / impressions) * 100).toFixed(1)) : 0,
    cpm: impressions > 0 && spent > 0 ? Math.round((spent / impressions) * 1000) : null,
    cpe: engagement > 0 && spent > 0 ? Math.round(spent / engagement) : null,
  };
}
