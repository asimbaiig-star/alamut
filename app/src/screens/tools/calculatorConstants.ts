// calculatorConstants.ts — P6 §5.4 extracted constants.
//
// Pre-P6 the rate calculator's per-platform tuning lived inline in
// `RateCalculator.tsx`. The brief mandates extracting the constants so
// (a) future tuning changes a single file, not the calculator UI; and
// (b) the methodology panel renders the actual formulas verbatim — no
// risk of the explanation drifting from the math.
//
// Each `PlatformConfig` defines: base $ per 1,000 of the input metric,
// the platform's "average" engagement rate, the engagement multiplier
// floor/ceiling, and a methodology blurb. The calculator reads
// `PLATFORMS[platformId]`; the methodology panel reads
// `PLATFORMS[platformId].methodology` so any tuning change appears in
// both places at once.
//
// Tuning these numbers changes the calculator output. Acceptance test:
// halving `tiktok.basePerThousand` halves every tiktok bucket (low,
// median, high).

export interface PlatformConfig {
  id: 'tiktok' | 'instagram' | 'youtube';
  name: string;
  /** Display label for the rate input (followers vs avg views). */
  inputLabel: string;
  /** Placeholder for the input. */
  inputPlaceholder: string;
  /** Base $ rate per 1,000 of the input metric. */
  basePerThousand: number;
  /** What an "average" engagement rate looks like on this platform. */
  avgEngagementPct: number;
  /** Floor / ceiling for the engagement multiplier. */
  minEngMultiplier: number;
  maxEngMultiplier: number;
  /** Reasonable engagement input range (UI hint). */
  engagementHint: string;
  /** What kind of post the rate covers. */
  unitLabel: string;
  /** Why this platform's economics are different — methodology note. */
  methodology: string;
}

/** Per-platform tuning. Changing a value here changes the calculator
 *  output AND the methodology panel copy in lockstep. */
export const PLATFORMS: Record<PlatformConfig['id'], PlatformConfig> = {
  tiktok: {
    id: 'tiktok',
    name: 'TikTok',
    inputLabel: 'Followers',
    inputPlaceholder: 'e.g. 250000',
    basePerThousand: 20,         // ~$0.020 per follower at 1.0× engagement
    avgEngagementPct: 5.5,
    minEngMultiplier: 0.5,
    maxEngMultiplier: 2.5,
    engagementHint: 'Range: 1–15%. Healthy TikTok avg sits around 5–8%.',
    unitLabel: 'sponsored video',
    methodology: 'TikTok deals are typically priced on followers × engagement, not views. The platform\'s short-form virality means even a mid-tier creator with high engagement can outperform a flagship account with low engagement. We weight engagement heavily here.',
  },
  instagram: {
    id: 'instagram',
    name: 'Instagram',
    inputLabel: 'Followers',
    inputPlaceholder: 'e.g. 80000',
    basePerThousand: 10,         // ~$0.010 per follower at 1.0× engagement
    avgEngagementPct: 2.5,
    minEngMultiplier: 0.6,
    maxEngMultiplier: 2.2,
    engagementHint: 'Range: 0.5–8%. Typical Instagram engagement sits around 2–4%.',
    unitLabel: 'sponsored Reel + post',
    methodology: 'Instagram has the most mature creator economy. Brands typically pay ~$0.01 per follower for a Reel + grid post bundle, with engagement as a multiplier. Story-only deals run about 30–40% of this.',
  },
  youtube: {
    id: 'youtube',
    name: 'YouTube',
    inputLabel: 'Average views per video',
    inputPlaceholder: 'e.g. 50000',
    basePerThousand: 30,         // ~$30 CPM (cost per thousand views)
    avgEngagementPct: 4.0,
    minEngMultiplier: 0.7,
    maxEngMultiplier: 1.8,
    engagementHint: 'Range: 1–10%. Healthy YouTube avg sits around 3–6% (likes + comments / views).',
    unitLabel: 'integrated sponsorship segment',
    methodology: 'YouTube sponsorships are CPM-based — brands pay per thousand views, not followers. Long-form attention is the asset. We use $25–35 CPM as a baseline; integrated 60-second segments price at the high end, pre-roll mentions at the low end.',
  },
};

/** Multiplier range used for the low / high spread. Median is `basePerThousand × engClamped`;
 *  low = median × `LOW_RATIO`; high = median × `HIGH_RATIO`. Tuning these
 *  changes the bucket spread; tuning `basePerThousand` shifts the entire band. */
export const LOW_RATIO = 0.7;
export const HIGH_RATIO = 1.5;

/** Resolve a platform id from a `/tools/<x>-calculator` URL pathname. */
export function platformFromPath(pathname: string): PlatformConfig['id'] {
  if (pathname.includes('tiktok')) return 'tiktok';
  if (pathname.includes('youtube')) return 'youtube';
  return 'instagram';
}
