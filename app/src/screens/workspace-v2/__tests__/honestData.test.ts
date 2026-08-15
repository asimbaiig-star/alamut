// honestData.test.ts — a number is either measured, stored, or absent.
//
// The rule this pins: no code path may CONJURE a figure. Performance used to
// be computed at render time from follower counts (`impressions = reach ×
// 1.4`, a hardcoded ER, a fixed decay curve, `EMV = impressions/1000 × $50`)
// and shown to every user as measurement. Audience demographics fell back to
// a fixed 60/40 · Lahore. Trust metrics were arithmetic on the review
// average. The creator score read a field nothing writes.
//
// Performance is now DATA: a campaign has a stored row or it has nothing.

import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { useStore } from '@/lib/api/store';
import { readPerformance, aggregatePerformance } from '../performance';
import { creatorToV2 } from '../v2Adapters';
import { v2LeaveReview } from '../v2CampaignActions';
import { buildDb, buildCampaign, buildCreator, buildBrand } from '@/lib/utils/__tests__/fixtures';
import type { CampaignPerformance, Review, User, Platform } from '@/lib/api/types';

function perfRow(over: Partial<CampaignPerformance> = {}): CampaignPerformance {
  return {
    campaignId: 'cmp_1', sample: true,
    impressions: 100_000, reach: 62_000, engagement: 5_200,
    saves: 700, shares: 300, profileVisits: 2_500,
    weeklySeries: [800, 1600, 1400, 1400], byCreator: [],
    updatedAt: '2026-08-01T00:00:00Z', ...over,
  };
}

describe('readPerformance', () => {
  it('returns null when a campaign has no stored row — never a computed stand-in', () => {
    const db = { campaignPerformance: [] };
    expect(readPerformance('cmp_1', 5000, db)).toBeNull();
  });

  it('reads stored counts verbatim', () => {
    const db = { campaignPerformance: [perfRow()] };
    const p = readPerformance('cmp_1', 5000, db)!;
    expect(p.impressions).toBe(100_000);
    expect(p.reach).toBe(62_000);
    expect(p.engagement).toBe(5_200);
  });

  it('derives CPM and CPE from REAL spend over stored counts', () => {
    const db = { campaignPerformance: [perfRow()] };
    const p = readPerformance('cmp_1', 5000, db)!;
    expect(p.cpm).toBe(Math.round((5000 / 100_000) * 1000)); // $50
    expect(p.cpe).toBe(Math.round(5000 / 5_200));            // $1
    expect(p.er).toBeCloseTo(5.2, 1);
  });

  it('returns null CPM/CPE rather than 0 when there is nothing to divide', () => {
    // A "$0 CPM" reads as spectacular efficiency. "Unknown" is the truth.
    const db = { campaignPerformance: [perfRow()] };
    expect(readPerformance('cmp_1', 0, db)!.cpm).toBeNull();
    expect(readPerformance('cmp_1', 0, db)!.cpe).toBeNull();
  });

  it('carries the sample flag so surfaces can label authored data', () => {
    const db = { campaignPerformance: [perfRow({ sample: true })] };
    expect(readPerformance('cmp_1', 100, db)!.sample).toBe(true);
  });
});

describe('aggregatePerformance', () => {
  it('returns null when no campaign in the set reports anything', () => {
    const db = { campaignPerformance: [] };
    expect(aggregatePerformance([{ id: 'cmp_1', spent: 500 }], db)).toBeNull();
  });

  it('sums counts and recomputes rates on the total', () => {
    const db = {
      campaignPerformance: [
        perfRow({ campaignId: 'a', impressions: 100_000, engagement: 5_000 }),
        perfRow({ campaignId: 'b', impressions: 300_000, engagement: 9_000 }),
      ],
    };
    const agg = aggregatePerformance([{ id: 'a', spent: 1000 }, { id: 'b', spent: 3000 }], db)!;
    expect(agg.impressions).toBe(400_000);
    expect(agg.engagement).toBe(14_000);
    // Rate is recomputed on the aggregate, not averaged from the parts.
    expect(agg.er).toBeCloseTo(3.5, 1);
    expect(agg.cpm).toBe(Math.round((4000 / 400_000) * 1000));
  });

  it('aligns weekly series of different lengths instead of dropping one', () => {
    const db = {
      campaignPerformance: [
        perfRow({ campaignId: 'a', weeklySeries: [10, 20] }),
        perfRow({ campaignId: 'b', weeklySeries: [1, 2, 3] }),
      ],
    };
    const agg = aggregatePerformance([{ id: 'a', spent: 1 }, { id: 'b', spent: 1 }], db)!;
    expect(agg.weeklySeries).toEqual([11, 22, 3]);
  });

  it('marks the total as sample when ANY part is authored', () => {
    const db = {
      campaignPerformance: [
        perfRow({ campaignId: 'a', sample: false }),
        perfRow({ campaignId: 'b', sample: true }),
      ],
    };
    const agg = aggregatePerformance([{ id: 'a', spent: 1 }, { id: 'b', spent: 1 }], db)!;
    expect(agg.sample).toBe(true);
  });
});

describe('audience demographics', () => {
  it('is null when no channel reports it — not a plausible default', () => {
    // Previously returned { female: 60, male: 40, age2534: 40, topCity:
    // 'Lahore' }, permanently, for every real signup.
    const c = buildCreator({ id: 'cr_1', platforms: [] });
    expect(creatorToV2(c).audience).toBeNull();
  });

  it('aggregates when channels do report it', () => {
    const platform = {
      platform: 'instagram', handle: '@x', followers: 1000, engagement: 4,
      verified: true,
      audience: {
        genderSplit: { female: 0.7, male: 0.3 },
        ageBuckets: { '18-24': 0.3, '25-34': 0.5 },
        topCountries: [{ country: 'Pakistan', pct: 0.8 }],
      },
    } as unknown as Platform;
    const c = buildCreator({ id: 'cr_1', platforms: [platform] });
    const a = creatorToV2(c).audience;
    expect(a).not.toBeNull();
    expect(a!.female).toBe(70);
  });
});

describe('creator score follows real reviews', () => {
  it('is null with no reviews', () => {
    const c = buildCreator({ id: 'cr_1', rating: 4.6 });
    // Even with a stale stored rating, no reviews means no score.
    expect(creatorToV2(c, { reviews: [] }).score).toBeNull();
  });

  it('tracks the live review average, not the stored field', () => {
    // `Creator.rating` is written ONLY by a dead legacy function, so it
    // never moves. Reading it froze the badge at its seeded value while
    // TrustBadge computed a different number from the same reviews.
    const c = buildCreator({ id: 'cr_1', rating: 1 });
    const reviews = [
      { reviewType: 'creator', targetId: 'cr_1', rating: 5, hidden: false },
      { reviewType: 'creator', targetId: 'cr_1', rating: 4, hidden: false },
    ] as unknown as Review[];
    expect(creatorToV2(c, { reviews }).score).toBe(90); // avg 4.5 × 20
  });

  it('ignores hidden reviews and other creators’ reviews', () => {
    const c = buildCreator({ id: 'cr_1', rating: 0 });
    const reviews = [
      { reviewType: 'creator', targetId: 'cr_1', rating: 5, hidden: false },
      { reviewType: 'creator', targetId: 'cr_1', rating: 1, hidden: true },
      { reviewType: 'creator', targetId: 'cr_2', rating: 1, hidden: false },
      { reviewType: 'brand',   targetId: 'cr_1', rating: 1, hidden: false },
    ] as unknown as Review[];
    expect(creatorToV2(c, { reviews }).score).toBe(100);
  });
});

describe('v2LeaveReview', () => {
  const user: User = {
    id: 'u_creator', email: 'c@c.com', passwordHash: 'demo', role: 'creator',
    status: 'active', createdAt: '2026-04-01T00:00:00Z', creatorId: 'cr_1',
  };
  beforeEach(() => {
    useStore.getState().setDB(buildDb({
      users: [user],
      creators: [buildCreator({ id: 'cr_1', userId: 'u_creator' })],
      brands: [buildBrand({ id: 'br_1', userId: 'u_brand' })],
      campaigns: [buildCampaign({ id: 'cmp_1', brandId: 'br_1', stage: 'closed' })],
      reviews: [],
    }));
    useStore.getState().setSession({ userId: 'u_creator', issuedAt: new Date().toISOString() });
  });

  const input = {
    campaignId: 'cmp_1', fromUserId: 'u_creator',
    reviewType: 'brand' as const, targetId: 'br_1', rating: 5, text: 'Great',
  };

  it('accepts one review per party per campaign', () => {
    v2LeaveReview(input);
    expect(useStore.getState().db.reviews).toHaveLength(1);
  });

  it('refuses a second — the rating average is public and gameable', () => {
    v2LeaveReview(input);
    expect(() => v2LeaveReview({ ...input, rating: 1 })).toThrow(/already reviewed/i);
    expect(useStore.getState().db.reviews).toHaveLength(1);
  });

  it('clamps an out-of-range rating rather than skewing every average', () => {
    v2LeaveReview({ ...input, rating: 99 });
    expect(useStore.getState().db.reviews[0].rating).toBe(5);
  });
});

describe('no surface reintroduces a fabricated constant', () => {
  // These exact strings were shipped as data. A grep guard is blunt, but it
  // fails loudly if any of them is pasted back in.
  const SCREENS = join(__dirname, '..', 'screens');
  const BANNED = [
    'Ratio detected',            // hardcoded ok=true pre-flight check
    'industry avg 2.4%',         // unsourced benchmark
    '38% of all impressions',    // invented share
    'Spark recommends',          // static text attributed to the AI feature
    'vs paid social',            // delta against a $50 constant
    'typically reviews within',  // invented brand review time
    'typically shortlists',      // invented brand shortlist time
  ];

  /** Strip comments so the notes explaining each removal don't trip the
   *  guard — a mention in prose is the opposite of a regression. */
  function stripComments(src: string): string {
    return src
      .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, '')  // JSX comment blocks
      .replace(/\/\*[\s\S]*?\*\//g, '')            // block comments
      .replace(/^\s*\/\/.*$/gm, '');               // line comments
  }

  it.each(BANNED)('%s appears nowhere in the workspace screens', (needle) => {
    const offenders = readdirSync(SCREENS)
      .filter((f) => f.endsWith('.tsx'))
      .filter((f) => stripComments(readFileSync(join(SCREENS, f), 'utf8')).includes(needle));
    expect(offenders, `still present in: ${offenders.join(', ')}`).toEqual([]);
  });
});
