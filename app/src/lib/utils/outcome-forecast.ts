// Outcome-pricing forecast (Phase 23).
//
// When a brand chooses outcome-based pricing in the New Campaign flow,
// they're committing to baseFloor + perConversion × N (capped per creator).
// This module turns that into a "what does this typically pay out?"
// projection by sampling completed outcome-priced campaigns from the
// store — same category if available, otherwise across categories — and
// computing low / mid / high-percentile expected payouts.
//
// Real backend would model this on actual conversion rates from prior
// campaigns; here we approximate by sampling `tracking[].conversions`
// from closed campaigns of similar shape.

import type { Database, OutcomePricing } from './../api/types';

export interface OutcomeForecast {
  /** Sampled per-creator conversions, sorted ascending. */
  samples: number[];
  /** Sample size — informs caller about confidence. */
  sampleCount: number;
  /** Whether we matched on category (true) or fell back to all-categories. */
  matchedCategory: boolean;
  /** Per-creator payout at p25 / p50 / p75 conversion rates. */
  perCreator: { low: number; mid: number; high: number };
  /** Estimated total spend (per-creator × accepted-creator estimate). */
  totalEstimate: { low: number; mid: number; high: number };
  /** Reasoning chips the UI can show. */
  reasons: string[];
}

/** Default number of accepted creators per outcome campaign — exported so
 *  UI labels stay aligned with the math when the default changes. */
export const DEFAULT_ACCEPTED = 5;

export function forecastOutcome(
  db: Database,
  category: string,
  pricing: OutcomePricing,
  acceptedCreatorEstimate: number = DEFAULT_ACCEPTED,
): OutcomeForecast {
  // Pull conversion samples from completed outcome campaigns.
  const sameCat = db.campaigns.filter(
    (c) => c.pricingModel === 'outcome' && c.tracking && c.tracking.length > 0 && c.category === category,
  );
  const allOutcome = db.campaigns.filter(
    (c) => c.pricingModel === 'outcome' && c.tracking && c.tracking.length > 0,
  );
  const matched = sameCat.length >= 2 ? sameCat : allOutcome;
  const matchedCategory = sameCat.length >= 2;

  const samples: number[] = [];
  matched.forEach((c) => {
    c.tracking!.forEach((t) => samples.push(t.conversions));
  });
  samples.sort((a, b) => a - b);

  // Defensive fallback when there's no historical data at all.
  // Phase 23 QA fix: clamp inputs so divide-by-zero (perConversion === 0)
  // or negative ranges (cap < floor) can't produce NaN/Infinity.
  if (samples.length === 0) {
    const perConv = Math.max(1, pricing.perConversion);
    const room = Math.max(0, pricing.capPerCreator - pricing.baseFloor);
    const conv = Math.max(0, Math.floor(room / perConv / 2));
    const synthetic = [Math.max(0, conv - 5), conv, conv + 5];
    return forecastFromConversions(synthetic, pricing, acceptedCreatorEstimate, false, [
      'No prior outcome campaigns yet — forecast is a 50% mid-cap heuristic.',
    ]);
  }

  return forecastFromConversions(samples, pricing, acceptedCreatorEstimate, matchedCategory, [
    matchedCategory
      ? `Modeled on ${samples.length} samples from past ${category} outcome campaigns.`
      : `Modeled on ${samples.length} samples across all outcome categories (no ${category} data).`,
    `Cap per creator: $${pricing.capPerCreator.toLocaleString()}; floor: $${pricing.baseFloor.toLocaleString()}.`,
  ]);
}

function forecastFromConversions(
  samples: number[],
  pricing: OutcomePricing,
  acceptedCreatorEstimate: number,
  matchedCategory: boolean,
  reasons: string[],
): OutcomeForecast {
  const p = (pct: number) => {
    if (samples.length === 0) return 0;
    const i = Math.min(samples.length - 1, Math.floor((samples.length - 1) * pct));
    return samples[i];
  };
  const lowConv = p(0.25);
  const midConv = p(0.5);
  const highConv = p(0.75);

  const payoutFor = (conv: number) =>
    Math.min(pricing.capPerCreator, pricing.baseFloor + conv * pricing.perConversion);

  return {
    samples,
    sampleCount: samples.length,
    matchedCategory,
    perCreator: {
      low:  payoutFor(lowConv),
      mid:  payoutFor(midConv),
      high: payoutFor(highConv),
    },
    totalEstimate: {
      low:  payoutFor(lowConv)  * acceptedCreatorEstimate,
      mid:  payoutFor(midConv)  * acceptedCreatorEstimate,
      high: payoutFor(highConv) * acceptedCreatorEstimate,
    },
    reasons,
  };
}
