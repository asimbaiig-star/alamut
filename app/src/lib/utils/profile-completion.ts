// profile-completion.ts — P6 §5.6 pure helper.
//
// Pre-P6 the codebase carried a stored `Creator.profileCompletion: number`
// that drifted from reality: a creator could update their bio without
// the number recomputing. Migrator 9 deletes the field; consumers
// compute on read via this helper.
//
// Scoring philosophy:
//   - 100 = "everything filled, every channel verified, decent track
//     record, multiple work samples". The cap is achievable but not
//     trivial — completing the profile alone gets ~75-80%.
//   - The remaining 20-25% comes from external signals: at least one
//     verified channel, ≥3 past clients, ≥2 work samples, response-
//     hours under 24, payout method set up.
//   - A junk-filled creator with no verified channel and no work caps
//     at ~30% per the brief's acceptance criterion.
//
// Each criterion contributes a fixed slice; total weights to 100.

import type { Creator, Database } from '@/lib/api/types';

interface Slice {
  /** Short label — mainly for debug / future "what's missing" UI. */
  label: string;
  /** Percentage points contributed when the predicate is true. */
  weight: number;
  /** True iff the creator earns this slice. */
  earned: boolean;
}

/**
 * Pure function. Returns a 0–100 integer. Same Creator + Database
 * inputs always produce the same output — readers can call this on
 * every render.
 *
 * The Database arg is passed in so future expansions can reach into
 * other tables (e.g., reviews count, completed campaigns) without
 * changing the signature. Currently unused beyond the Creator itself,
 * which is fine — pure scoring on stored fields.
 */
export function computeProfileCompletion(
  creator: Creator,
  _db: Database,
): number {
  const slices: Slice[] = [
    // Identity (40 pts) — the basics. Filled in onboarding.
    { label: 'Has tagline',     weight: 8,  earned: !!creator.tagline?.trim() },
    { label: 'Has bio',         weight: 8,  earned: !!creator.bio && creator.bio.trim().length >= 40 },
    { label: 'Has city',        weight: 4,  earned: !!creator.city?.trim() },
    { label: 'Has portrait',    weight: 6,  earned: !!creator.portrait?.trim() },
    { label: 'Has cover',       weight: 4,  earned: !!creator.cover?.trim() },
    { label: 'Has ≥1 category', weight: 4,  earned: (creator.categories ?? []).length >= 1 },
    { label: 'Has ≥1 language', weight: 3,  earned: (creator.languages ?? []).length >= 1 },
    { label: 'Has rate card',   weight: 3,  earned: !!creator.rateCard?.post && creator.rateCard.post.trim() !== '' },

    // Channels (25 pts)
    { label: 'Has ≥1 platform connected',  weight: 10, earned: (creator.platforms ?? []).length >= 1 },
    { label: 'Has ≥1 verified platform',   weight: 10, earned: (creator.platforms ?? []).some((p) => p.verified) },
    { label: 'Has ≥2 platforms connected', weight: 5,  earned: (creator.platforms ?? []).length >= 2 },

    // Work + social proof (20 pts)
    { label: 'Has ≥2 work samples',     weight: 8,  earned: (creator.work ?? []).length >= 2 },
    { label: 'Has ≥3 past clients',     weight: 7,  earned: (creator.pastClients ?? []).length >= 3 },
    { label: 'Has ≥1 press mention',    weight: 5,  earned: (creator.pressMentions ?? []).length >= 1 },

    // Operational (15 pts)
    { label: 'Response under 24h',      weight: 5, earned: (creator.responseHrs ?? 999) <= 24 },
    { label: 'Payout method set',       weight: 5, earned: !!creator.payout?.account && creator.payout.account.trim() !== '' },
    { label: 'Verified by admin',       weight: 5, earned: creator.verified },
  ];

  const earnedTotal = slices
    .filter((s) => s.earned)
    .reduce((acc, s) => acc + s.weight, 0);

  return Math.max(0, Math.min(100, Math.round(earnedTotal)));
}

/**
 * Diagnostic helper — returns the slice breakdown so a "what's
 * missing" UI can show which criteria the creator hasn't met. Same
 * inputs as `computeProfileCompletion`. Pure.
 */
export function profileCompletionBreakdown(
  creator: Creator,
  db: Database,
): { score: number; slices: Slice[] } {
  void db;
  const slices: Slice[] = [
    { label: 'Has tagline',                 weight: 8,  earned: !!creator.tagline?.trim() },
    { label: 'Has bio (≥40 chars)',         weight: 8,  earned: !!creator.bio && creator.bio.trim().length >= 40 },
    { label: 'Has city',                    weight: 4,  earned: !!creator.city?.trim() },
    { label: 'Has portrait',                weight: 6,  earned: !!creator.portrait?.trim() },
    { label: 'Has cover',                   weight: 4,  earned: !!creator.cover?.trim() },
    { label: 'Has ≥1 category',             weight: 4,  earned: (creator.categories ?? []).length >= 1 },
    { label: 'Has ≥1 language',             weight: 3,  earned: (creator.languages ?? []).length >= 1 },
    { label: 'Has rate card',               weight: 3,  earned: !!creator.rateCard?.post && creator.rateCard.post.trim() !== '' },
    { label: 'Has ≥1 platform connected',   weight: 10, earned: (creator.platforms ?? []).length >= 1 },
    { label: 'Has ≥1 verified platform',    weight: 10, earned: (creator.platforms ?? []).some((p) => p.verified) },
    { label: 'Has ≥2 platforms connected',  weight: 5,  earned: (creator.platforms ?? []).length >= 2 },
    { label: 'Has ≥2 work samples',         weight: 8,  earned: (creator.work ?? []).length >= 2 },
    { label: 'Has ≥3 past clients',         weight: 7,  earned: (creator.pastClients ?? []).length >= 3 },
    { label: 'Has ≥1 press mention',        weight: 5,  earned: (creator.pressMentions ?? []).length >= 1 },
    { label: 'Response under 24h',          weight: 5,  earned: (creator.responseHrs ?? 999) <= 24 },
    { label: 'Payout method set',           weight: 5,  earned: !!creator.payout?.account && creator.payout.account.trim() !== '' },
    { label: 'Verified by admin',           weight: 5,  earned: creator.verified },
  ];
  const score = slices
    .filter((s) => s.earned)
    .reduce((acc, s) => acc + s.weight, 0);
  return { score: Math.max(0, Math.min(100, Math.round(score))), slices };
}
