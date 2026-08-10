// matching.ts — the single source of truth for creator ↔ brief fit.
//
// WHY THIS EXISTS (product audit P-1, P-2, P-10)
//
// There were two separate scorers that disagreed with each other, and both
// were built to flatter rather than to inform:
//
//   • `BrowseBriefs.computeMatch` gave every facet a floor — audience ≥75,
//     niche ≥70, ER ≥75, geo ≥78, history ≥60, rate ≥65. The minimum
//     achievable score was therefore (75+70+75+78+60+65)/6 = 71, which is
//     exactly why all 152 briefs displayed "71% match". The number could
//     not go lower no matter how badly a creator fit.
//   • `v2Adapters.computeMatchScore` used different floors and different
//     field names (`channels[0]` vs `platforms[0]`), so the same creator
//     saw 48% for a brief on Home and 71% on Browse.
//   • Neither could score a real account: `audience` read
//     `audience.age2534`, which only seeded creators have, and one used
//     "number of category tags" as an audience proxy.
//   • `geo` compared the creator's city against `campaign.placement` —
//     which is the DELIVERABLES string ("1 IG post + 1 Reel"), not a
//     location. That facet could essentially never match. The campaign's
//     real location is `region`.
//   • "Why this match" reasons fell back to a lookup keyed only on
//     campaign category, so a creator with no categories, channels or
//     audience was told "✓ Wellness vertical ✓ Mature audience
//     ✓ Calm-aesthetic match".
//
// THE RULES THIS MODULE FOLLOWS
//
//  1. A missing signal returns `null` — it never contributes a flattering
//     default. Absence of data reduces *confidence*, it never inflates the
//     score.
//  2. Too little signal to be meaningful ⇒ `score: null` plus a concrete
//     `insufficient` message telling the creator what to add. Saying "we
//     can't tell yet, here's how to fix that" beats printing a confident
//     number. This mirrors what brand Analytics already does correctly.
//  3. Facets use their full range, so scores actually discriminate.
//  4. Reasons are derived from facets that genuinely qualified. If none
//     qualify, we return none rather than inventing them.

import type { Campaign, Creator, Database } from '@/lib/api/types';

/** Minimum number of scoreable facets before we'll show a number at all. */
const MIN_FACETS_TO_SCORE = 2;

export interface MatchResult {
  /** 0–100, or null when there isn't enough signal to score honestly. */
  score: number | null;
  /** Human reasons drawn from facets that actually qualified. May be empty. */
  reasons: string[];
  /** Present when `score` is null: what the creator should add, in plain words. */
  insufficient?: string;
  /** Which facets contributed — useful for tests and debugging. */
  facetsUsed: string[];
}

interface Facet {
  key: string;
  /** 0–100, or null when the underlying data isn't there. */
  value: number | null;
  weight: number;
  /** Shown when this facet scores well. */
  reason?: string;
}

/** Engagement rate → score. Benchmarks against typical influencer ER:
 *  ~1–2% is weak, 3–4% solid, 6%+ strong. Full range, no floor. */
function scoreEngagement(erPct: number): number {
  if (erPct <= 0) return 0;
  if (erPct >= 9) return 98;
  // Piecewise-linear through (1,20) (3,55) (6,85) (9,98).
  if (erPct < 3) return Math.round(20 + ((erPct - 1) / 2) * 35);
  if (erPct < 6) return Math.round(55 + ((erPct - 3) / 3) * 30);
  return Math.round(85 + ((erPct - 6) / 3) * 13);
}

/** How close the money on offer is to what the creator charges. */
function scoreRate(perCreatorBudget: number, creatorRate: number): number {
  if (creatorRate <= 0 || perCreatorBudget <= 0) return 0;
  const delta = Math.abs(perCreatorBudget - creatorRate) / creatorRate;
  if (delta <= 0.1) return 96;   // essentially on the nose
  if (delta <= 0.25) return 80;
  if (delta <= 0.5) return 55;
  if (delta <= 1) return 30;
  return 12;                      // an order of magnitude off
}

function parseRate(raw: string | undefined): number {
  if (!raw) return 0;
  const n = parseInt(raw.replace(/[^0-9]/g, ''), 10);
  return Number.isNaN(n) ? 0 : n;
}

/**
 * Score how well `creator` fits `campaign`.
 *
 * `perCreatorBudget` is the slice of budget one creator would receive —
 * callers already compute this for display, so it's passed in rather than
 * re-derived here.
 */
export function matchCreatorToCampaign(
  creator: Creator | null | undefined,
  campaign: Campaign | null | undefined,
  db: Database,
  perCreatorBudget = 0,
): MatchResult {
  if (!creator || !campaign) {
    return {
      score: null,
      reasons: [],
      facetsUsed: [],
      insufficient: 'Sign in to see how well this brief matches you.',
    };
  }

  const facets: Facet[] = [];

  // ---- Niche: the strongest available signal, so the heaviest weight.
  const myCats = (creator.categories ?? []).map((c) => c.toLowerCase()).filter(Boolean);
  const campCat = (campaign.category ?? '').toLowerCase();
  if (myCats.length > 0 && campCat) {
    const exact = myCats.includes(campCat);
    // Adjacent: shares a word, e.g. "Beauty" vs "Beauty / Skincare".
    const adjacent = !exact && myCats.some((c) =>
      campCat.split(/[\s/&]+/).some((w) => w.length > 2 && c.includes(w)));
    facets.push({
      key: 'niche',
      value: exact ? 100 : adjacent ? 65 : 20,
      weight: 0.35,
      reason: exact ? `${campaign.category} is your niche`
        : adjacent ? `Adjacent to your ${creator.categories?.[0]} work`
        : undefined,
    });
  }

  // ---- Engagement: from the creator's PRIMARY channel, meaning the one
  //      with the largest audience — not the highest engagement number.
  //
  //      Engagement isn't comparable across platform types: a newsletter
  //      stores an open rate (Sarah's seeded newsletter is 42) while
  //      Instagram stores a true ER (5.2). Taking the max across platforms
  //      therefore surfaced "42.0% engagement" as her headline figure and
  //      scored her off a metric that means something different. The
  //      largest-audience channel is both the honest headline and
  //      comparable to the benchmarks in `scoreEngagement`.
  const primary = (creator.platforms ?? [])
    .slice()
    .sort((a, b) => (b.followers ?? 0) - (a.followers ?? 0))[0];
  const primaryEr = primary?.engagement ?? 0;
  if (primary && primaryEr > 0) {
    const v = scoreEngagement(primaryEr);
    facets.push({
      key: 'engagement',
      value: v,
      weight: 0.2,
      reason: v >= 80 ? `${primaryEr.toFixed(1)}% engagement on ${primary.name}` : undefined,
    });
  }

  // ---- Geo: against the campaign's REGION (not `placement`, which is the
  //      deliverables text — the original bug).
  const region = (campaign.region ?? '').toLowerCase();
  const city = (creator.city ?? '').toLowerCase();
  const country = (creator.country ?? '').toLowerCase();
  if (region && (city || country)) {
    const global = region.includes('global');
    const cityHit = !!city && region.includes(city);
    const countryHit = !!country && region.includes(country);
    facets.push({
      key: 'geo',
      value: cityHit ? 100 : countryHit ? 75 : global ? 60 : 25,
      weight: 0.15,
      reason: cityHit ? `Targeting ${creator.city}`
        : countryHit ? `Targeting ${creator.country}`
        : undefined,
    });
  }

  // ---- Rate alignment: is the money in the creator's ballpark?
  const myRate = parseRate(creator.rateCard?.post) || parseRate(creator.rateCard?.reel);
  if (myRate > 0 && perCreatorBudget > 0) {
    const v = scoreRate(perCreatorBudget, myRate);
    facets.push({
      key: 'rate',
      value: v,
      weight: 0.15,
      reason: v >= 80 ? 'Budget matches your rate' : undefined,
    });
  }

  // ---- History: a bonus when it exists. Never a penalty — having not
  //      worked with a brand says nothing about fit, so no-history is
  //      excluded rather than scored low.
  const brand = db.brands.find((b) => b.id === campaign.brandId);
  const workedBefore = !!brand && (
    (creator.pastClients ?? []).includes(brand.name) ||
    db.offers.some((o) =>
      o.creatorId === creator.id &&
      o.status === 'accepted' &&
      db.campaigns.find((c) => c.id === o.campaignId)?.brandId === brand.id)
  );
  if (workedBefore) {
    facets.push({
      key: 'history',
      value: 100,
      weight: 0.15,
      reason: `You've worked with ${brand!.name}`,
    });
  }

  const scored = facets.filter((f) => f.value !== null);
  if (scored.length < MIN_FACETS_TO_SCORE) {
    return {
      score: null,
      reasons: [],
      facetsUsed: scored.map((f) => f.key),
      insufficient: insufficiencyHint(creator),
    };
  }

  // Weighted mean over the facets we actually have, so a missing facet
  // neither helps nor hurts — it just doesn't vote.
  const totalWeight = scored.reduce((s, f) => s + f.weight, 0);
  const score = Math.round(
    scored.reduce((s, f) => s + (f.value as number) * f.weight, 0) / totalWeight,
  );

  const reasons = scored
    .filter((f) => f.reason && (f.value as number) >= 65)
    .sort((a, b) => (b.value as number) - (a.value as number))
    .map((f) => f.reason as string)
    .slice(0, 3);

  return { score, reasons, facetsUsed: scored.map((f) => f.key) };
}

/**
 * Score how well `creator` fits a BRAND's stated preferences — the brand
 * side of Discover, where there's no single campaign to match against.
 *
 * Why this exists (P-10): Discover's "Alamut score" was
 * `Math.round((creator.rating ?? 4.5) * 20)` — the creator's star rating
 * rescaled, not a fit score at all. Ratings sit around 3.8–5.0, which is
 * why 110 of 115 creators scored 76–99, and an **unrated** creator
 * defaulted to 4.5 → a flattering 90. A brand sorting by it was sorting by
 * review average, mislabelled as fit, with newcomers given an unearned 90.
 *
 * Same rules as `matchCreatorToCampaign`: absent signal never flatters,
 * and too little signal returns `null` rather than a confident number.
 */
export function matchCreatorToBrand(
  creator: Creator | null | undefined,
  brandId: string | null | undefined,
  db: Database,
): MatchResult {
  const brand = brandId ? db.brands.find((b) => b.id === brandId) : undefined;
  if (!creator || !brand) {
    return { score: null, reasons: [], facetsUsed: [], insufficient: 'No brand context.' };
  }

  const facets: Facet[] = [];

  // ---- Category overlap against what the brand says it wants.
  const myCats = (creator.categories ?? []).map((c) => c.toLowerCase());
  const wantCats = (brand.preferredCategories ?? []).map((c) => c.toLowerCase());
  if (myCats.length > 0 && wantCats.length > 0) {
    const hits = myCats.filter((c) => wantCats.includes(c)).length;
    facets.push({
      key: 'category',
      value: hits >= 2 ? 100 : hits === 1 ? 80 : 20,
      weight: 0.4,
      reason: hits > 0 ? `Works in ${brand.preferredCategories.find((c) => myCats.includes(c.toLowerCase()))}` : undefined,
    });
  }

  // ---- Region: does the creator sit in a market the brand targets?
  const regions = (brand.preferredRegions ?? []).map((r) => r.toLowerCase());
  const city = (creator.city ?? '').toLowerCase();
  const country = (creator.country ?? '').toLowerCase();
  if (regions.length > 0 && (city || country)) {
    const cityHit = !!city && regions.some((r) => r.includes(city));
    const countryHit = !!country && regions.some((r) => r.includes(country) || r.includes('wide') || r.includes('international'));
    facets.push({
      key: 'region',
      value: cityHit ? 100 : countryHit ? 70 : 25,
      weight: 0.25,
      reason: cityHit ? `Based in ${creator.city}` : undefined,
    });
  }

  // ---- Engagement on the creator's primary (largest) channel.
  const primary = (creator.platforms ?? []).slice()
    .sort((a, b) => (b.followers ?? 0) - (a.followers ?? 0))[0];
  if (primary && (primary.engagement ?? 0) > 0) {
    const v = scoreEngagement(primary.engagement);
    facets.push({
      key: 'engagement',
      value: v,
      weight: 0.2,
      reason: v >= 80 ? `${primary.engagement.toFixed(1)}% engagement on ${primary.name}` : undefined,
    });
  }

  // ---- Prior work with this brand — a bonus only, never a penalty.
  if ((creator.pastClients ?? []).includes(brand.name)) {
    facets.push({ key: 'history', value: 100, weight: 0.15, reason: `Has worked with ${brand.name}` });
  }

  const scored = facets.filter((f) => f.value !== null);
  if (scored.length < MIN_FACETS_TO_SCORE) {
    return {
      score: null,
      reasons: [],
      facetsUsed: scored.map((f) => f.key),
      insufficient: wantCats.length === 0
        ? 'Set your preferred categories and regions in Brand profile to rank creators by fit.'
        : "This creator's profile is too sparse to judge fit.",
    };
  }

  const totalWeight = scored.reduce((s, f) => s + f.weight, 0);
  const score = Math.round(
    scored.reduce((s, f) => s + (f.value as number) * f.weight, 0) / totalWeight,
  );
  const reasons = scored
    .filter((f) => f.reason && (f.value as number) >= 65)
    .sort((a, b) => (b.value as number) - (a.value as number))
    .map((f) => f.reason as string)
    .slice(0, 3);

  return { score, reasons, facetsUsed: scored.map((f) => f.key) };
}

/** Tell the creator exactly what to add to unlock matching. */
function insufficiencyHint(creator: Creator): string {
  const missing: string[] = [];
  if ((creator.categories ?? []).length === 0) missing.push('a category');
  if ((creator.platforms ?? []).length === 0) missing.push('a channel');
  if (!creator.rateCard?.post && !creator.rateCard?.reel) missing.push('your rates');
  if (missing.length === 0) return "Not enough on this brief to judge fit yet.";
  const list = missing.length === 1
    ? missing[0]
    : `${missing.slice(0, -1).join(', ')} and ${missing[missing.length - 1]}`;
  return `Add ${list} to your storefront to see how well briefs match you.`;
}
