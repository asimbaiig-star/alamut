// Trust tier derivation. Pure function — no state.
import type { Brand, Campaign, Creator, Database, Review, TrustTier } from '@/lib/api/types';
import { isCreatorAccepted } from '@/lib/api/relations';

export interface TrustSnapshot {
  tier: TrustTier;
  completedCampaigns: number;
  avgRating: number;
  reviewCount: number;
  verified: boolean;
  // Public-facing micro-metrics
  responseHrs: number;
  onTimeRatePct: number;        // % of accepted campaigns delivered before deadline
  avgRevisionRounds: number;    // average submission rounds per closed campaign
  payoutReliabilityPct: number; // brand-side: % of campaigns with on-time payout
}

const closedStages = new Set(['closed', 'reporting', 'posted']);

export function trustForCreator(db: Database, creator: Creator): TrustSnapshot {
  const closed = db.campaigns.filter((c) => isCreatorAccepted(c.id, creator.id, db) && closedStages.has(c.stage));
  // P4 §3.2 — exclude admin-hidden reviews from the trust calculation.
  // The creator's average rating + count both reflect what's publicly
  // visible; hidden rows don't count.
  const reviewsForC: Review[] = db.reviews.filter((r) => r.reviewType === 'creator' && r.targetId === creator.id && !r.hidden);
  const avg = reviewsForC.length > 0 ? reviewsForC.reduce((s, r) => s + r.rating, 0) / reviewsForC.length : creator.rating || 0;

  // Tier rules (creator side)
  let tier: TrustTier = 'bronze';
  if (closed.length >= 10 && avg >= 4.6 && creator.verified) tier = 'gold';
  else if (closed.length >= 3 && avg >= 4.2) tier = 'silver';

  const submissions = db.submissions.filter((s) => closed.some((c) => c.id === s.campaignId) && s.creatorId === creator.id);
  const subsByCampaign: Record<string, number> = {};
  submissions.forEach((s) => { subsByCampaign[s.campaignId] = Math.max(subsByCampaign[s.campaignId] || 0, s.round); });
  const totalRounds = Object.values(subsByCampaign).reduce((a, b) => a + b, 0);
  const avgRevisionRounds = closed.length > 0 ? +(totalRounds / Math.max(closed.length, 1)).toFixed(1) : 0;

  // On-time delivery rate — mock heuristic: assume 88-98% based on rating
  const onTimeRatePct = avg > 0 ? Math.min(100, Math.round(85 + avg * 3)) : 95;

  return {
    tier,
    completedCampaigns: closed.length,
    avgRating: +avg.toFixed(2),
    reviewCount: reviewsForC.length,
    verified: creator.verified,
    responseHrs: creator.responseHrs,
    onTimeRatePct,
    avgRevisionRounds,
    payoutReliabilityPct: 0, // creator-side N/A
  };
}

export function trustForBrand(db: Database, brand: Brand): TrustSnapshot {
  const myCampaigns: Campaign[] = db.campaigns.filter((c) => c.brandId === brand.id);
  const closed = myCampaigns.filter((c) => closedStages.has(c.stage));
  // P4 §3.2 — same hidden-review filter as the creator-side calc.
  const reviewsForB: Review[] = db.reviews.filter((r) => r.reviewType === 'brand' && r.targetId === brand.id && !r.hidden);
  const avg = reviewsForB.length > 0 ? reviewsForB.reduce((s, r) => s + r.rating, 0) / reviewsForB.length : 0;

  let tier: TrustTier = 'bronze';
  if (closed.length >= 10 && avg >= 4.6 && brand.verified) tier = 'gold';
  else if (closed.length >= 3 && avg >= 4.2) tier = 'silver';

  // Payout reliability: % of releases that happened within 2 days of submission approval (mock)
  const releases = db.transactions.filter((t) => t.kind === 'escrow_release' && t.userId === brand.userId);
  const payoutReliabilityPct = releases.length > 0 ? Math.min(100, 88 + Math.round(avg * 2)) : 95;

  return {
    tier,
    completedCampaigns: closed.length,
    avgRating: +avg.toFixed(2),
    reviewCount: reviewsForB.length,
    verified: brand.verified,
    responseHrs: 0,
    onTimeRatePct: 0,
    avgRevisionRounds: 0,
    payoutReliabilityPct,
  };
}

export function tierLabel(t: TrustTier): string {
  return t === 'gold' ? 'Gold' : t === 'silver' ? 'Silver' : 'Bronze';
}
export function tierColor(t: TrustTier): { bg: string; fg: string } {
  if (t === 'gold')   return { bg: 'oklch(0.92 0.10 80)',  fg: 'oklch(0.40 0.12 80)' };
  if (t === 'silver') return { bg: 'oklch(0.94 0.005 240)', fg: 'oklch(0.40 0.005 240)' };
  return                       { bg: 'oklch(0.92 0.04 40)',  fg: 'oklch(0.40 0.10 40)' };
}
