// rateGuidance.ts — shared rate-band estimate (product audit T3.1).
//
// The public /tools/*-calculator pages have always been able to turn a
// follower count + engagement rate into a defensible price band, but that
// maths was trapped inside the marketing page. Signed-in creators — the
// people who actually have to name a number — got no guidance at the two
// moments it matters: onboarding step 3 ("Set your rates", three empty
// fields) and editing rate cards on the storefront.
//
// This re-exposes the same formula for in-app use so there is exactly one
// definition of a fair band. Tuning `calculatorConstants` moves both.
//
// HONESTY RULE (consistent with matching.ts): only three platforms have a
// benchmark. For LinkedIn / X / Newsletter we return `null` rather than
// inventing a number — no guidance is better than confident guidance we
// can't support.

import { PLATFORMS, LOW_RATIO, HIGH_RATIO, type PlatformConfig } from './calculatorConstants';

export interface RateBand {
  low: number;
  median: number;
  high: number;
  /** The platform the band was computed for — worth naming in the UI, since
   *  a creator on several channels shouldn't assume it covers all of them. */
  platform: string;
}

/** Platforms we have a published benchmark for. */
export type BenchmarkedPlatform = PlatformConfig['id'];

const ALIASES: Record<string, BenchmarkedPlatform> = {
  instagram: 'instagram',
  tiktok: 'tiktok',
  youtube: 'youtube',
};

/** True when we can produce a band for this platform at all. */
export function hasRateBenchmark(platform: string): boolean {
  return !!ALIASES[platform.toLowerCase()];
}

/**
 * Fair-rate band for one deliverable on `platform`.
 *
 * Returns `null` when there's no benchmark for the platform, or when the
 * inputs are missing/implausible — callers should then show nothing rather
 * than a zeroed band.
 */
export function suggestRateBand(
  platform: string,
  followers: number,
  engagementPct: number,
): RateBand | null {
  const id = ALIASES[platform.toLowerCase()];
  if (!id) return null;
  if (!Number.isFinite(followers) || followers <= 0) return null;

  const config = PLATFORMS[id];

  // Engagement acts as a multiplier against the platform average, clamped
  // so an outlier (or a mistyped 90%) can't produce a silly number.
  const engRatio = Number.isFinite(engagementPct) && engagementPct > 0
    ? engagementPct / config.avgEngagementPct
    : 1;
  const engClamped = Math.max(
    config.minEngMultiplier,
    Math.min(config.maxEngMultiplier, engRatio),
  );

  const median = (followers / 1000) * config.basePerThousand * engClamped;
  if (!Number.isFinite(median) || median <= 0) return null;

  return {
    low: Math.round(median * LOW_RATIO),
    median: Math.round(median),
    high: Math.round(median * HIGH_RATIO),
    platform: config.name,
  };
}
