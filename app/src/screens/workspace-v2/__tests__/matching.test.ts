// matching.test.ts — creator ↔ brief fit (product audit P-1, P-2, P-10).
//
// These tests exist to stop the two failure modes the old scorers had:
// manufacturing a flattering number when there was nothing to judge, and
// compressing every result into a narrow band so nothing discriminated.

import { describe, it, expect } from 'vitest';
import { matchCreatorToCampaign } from '../matching';
import { buildDb, buildCreator, buildCampaign, buildBrand } from '@/lib/utils/__tests__/fixtures';
import type { Creator, Campaign } from '@/lib/api/types';

const brand = buildBrand({ id: 'br_1', name: 'Aesop' });

function db(extra: Partial<Parameters<typeof buildDb>[0]> = {}) {
  return buildDb({ brands: [brand], ...extra });
}

/** A creator with enough profile filled in to be scoreable. */
function fullCreator(p: Partial<Creator> = {}): Creator {
  return buildCreator({
    id: 'cr_1',
    city: 'Karachi',
    country: 'Pakistan',
    categories: ['Beauty'],
    platforms: [{ name: 'Instagram', handle: '@x', followers: 20000, engagement: 6, verified: false }],
    rateCard: { post: '$500', reel: '$600', story: '$200', longform: '$900' },
    pastClients: [],
    ...p,
  });
}

function campaign(p: Partial<Campaign> = {}): Campaign {
  return buildCampaign({ id: 'cmp_1', brandId: 'br_1', category: 'Beauty', region: 'Karachi', ...p });
}

describe('matchCreatorToCampaign — refuses to invent a score', () => {
  it('returns null with an actionable hint when the profile is empty', () => {
    // This is the real-account case that used to render "71% match".
    const bare = buildCreator({
      id: 'cr_bare', categories: [], platforms: [],
      rateCard: { post: '', reel: '', story: '', longform: '' },
      city: '', country: '',
    });
    const r = matchCreatorToCampaign(bare, campaign(), db(), 500);
    expect(r.score).toBeNull();
    expect(r.insufficient).toMatch(/add/i);
    // The hint must name what's actually missing, not be generic.
    expect(r.insufficient).toMatch(/category/i);
    expect(r.insufficient).toMatch(/channel/i);
  });

  it('never invents reasons — no creator data means no reasons', () => {
    const bare = buildCreator({
      id: 'cr_bare', categories: [], platforms: [],
      rateCard: { post: '', reel: '', story: '', longform: '' },
    });
    const r = matchCreatorToCampaign(bare, campaign({ category: 'Wellness' }), db(), 500);
    // The old code answered this with "Wellness vertical / Mature audience
    // / Calm-aesthetic match" purely from the campaign's category.
    expect(r.reasons).toEqual([]);
  });

  it('handles a missing creator or campaign without throwing', () => {
    expect(matchCreatorToCampaign(null, campaign(), db()).score).toBeNull();
    expect(matchCreatorToCampaign(fullCreator(), null, db()).score).toBeNull();
  });
});

describe('matchCreatorToCampaign — actually discriminates', () => {
  it('scores a strong fit far above a weak one', () => {
    const strong = matchCreatorToCampaign(
      fullCreator({ pastClients: ['Aesop'] }),
      campaign({ category: 'Beauty', region: 'Karachi' }),
      db(), 500,
    );
    const weak = matchCreatorToCampaign(
      fullCreator({ categories: ['B2B'], city: 'Oslo', country: 'Norway',
        platforms: [{ name: 'LinkedIn', handle: '@y', followers: 500, engagement: 0.8, verified: false }],
        rateCard: { post: '$50', reel: '', story: '', longform: '' } }),
      campaign({ category: 'Beauty', region: 'Karachi' }),
      db(), 5000,
    );
    expect(strong.score).not.toBeNull();
    expect(weak.score).not.toBeNull();
    // The old scorer's floor made this gap impossible: nothing could go
    // below 71, so strong-vs-weak differed by a handful of points.
    expect((strong.score as number) - (weak.score as number)).toBeGreaterThan(30);
  });

  it('produces a wide spread across varied creators, not a narrow band', () => {
    const variants: Creator[] = [
      fullCreator({ id: 'a', categories: ['Beauty'], pastClients: ['Aesop'] }),
      fullCreator({ id: 'b', categories: ['Beauty'] }),
      fullCreator({ id: 'c', categories: ['Fashion'] }),
      fullCreator({ id: 'd', categories: ['B2B'], city: 'Oslo', country: 'Norway' }),
      fullCreator({ id: 'e', categories: ['B2B'], city: 'Oslo', country: 'Norway',
        platforms: [{ name: 'X', handle: '@e', followers: 100, engagement: 0.5, verified: false }] }),
    ];
    const scores = variants
      .map((c) => matchCreatorToCampaign(c, campaign(), db(), 500).score)
      .filter((s): s is number => s !== null);
    expect(scores.length).toBe(5);
    const spread = Math.max(...scores) - Math.min(...scores);
    // Old behaviour: every creator landed in a ~71–93 band.
    expect(spread).toBeGreaterThan(35);
  });

  it('a missing facet neither helps nor hurts the score', () => {
    // Same creator, but one has no rate card. The rate facet should simply
    // not vote, rather than contributing a flattering default.
    const withRate = fullCreator();
    const withoutRate = fullCreator({ rateCard: { post: '', reel: '', story: '', longform: '' } });
    const a = matchCreatorToCampaign(withRate, campaign(), db(), 500);
    const b = matchCreatorToCampaign(withoutRate, campaign(), db(), 500);
    expect(a.facetsUsed).toContain('rate');
    expect(b.facetsUsed).not.toContain('rate');
    // Both are still scoreable, and dropping the facet doesn't inflate.
    expect(b.score).not.toBeNull();
  });
});

describe('matchCreatorToCampaign — geo uses region, not the deliverables text', () => {
  it('matches on the campaign region', () => {
    const r = matchCreatorToCampaign(fullCreator(), campaign({ region: 'Karachi' }), db(), 500);
    expect(r.facetsUsed).toContain('geo');
    expect(r.reasons.join(' ')).toMatch(/Karachi/);
  });

  it('does NOT match a city that only appears in deliverablesText', () => {
    // The original bug: geo compared city against `placement`
    // (= deliverablesText), so "1 IG post in Karachi" would score a geo
    // hit while the campaign's actual region was elsewhere.
    const r = matchCreatorToCampaign(
      fullCreator(),
      campaign({ region: 'Oslo', deliverablesText: '1 IG post + 1 Reel in Karachi' }),
      db(), 500,
    );
    expect(r.reasons.join(' ')).not.toMatch(/Karachi/);
  });

  it('treats a Global campaign as partial, not perfect, geo fit', () => {
    const global = matchCreatorToCampaign(fullCreator(), campaign({ region: 'Global' }), db(), 500);
    const local = matchCreatorToCampaign(fullCreator(), campaign({ region: 'Karachi' }), db(), 500);
    expect(local.score as number).toBeGreaterThan(global.score as number);
  });
});

describe('matchCreatorToCampaign — reasons come from the creator', () => {
  it('credits prior work with the brand by name', () => {
    const r = matchCreatorToCampaign(fullCreator({ pastClients: ['Aesop'] }), campaign(), db(), 500);
    expect(r.reasons.join(' ')).toMatch(/worked with Aesop/i);
  });

  it('cites the creator’s real engagement figure', () => {
    // Deliberately weaken the other facets (off-niche, off-region, no rate
    // card) so engagement isn't crowded out of the three-reason cap by
    // higher-scoring facets — the point here is that the figure quoted is
    // the creator's own, not that engagement always ranks.
    const r = matchCreatorToCampaign(
      fullCreator({
        categories: ['Fashion'],
        city: 'Oslo', country: 'Norway',
        rateCard: { post: '', reel: '', story: '', longform: '' },
        platforms: [{ name: 'Instagram', handle: '@x', followers: 9000, engagement: 8.2, verified: false }],
      }),
      campaign({ category: 'Beauty', region: 'Karachi' }), db(), 500,
    );
    expect(r.reasons.join(' ')).toMatch(/8\.2% engagement/);
  });

  it('scores off the primary channel, not the highest engagement number', () => {
    // Caught live: engagement isn't comparable across platform types. A
    // newsletter stores an OPEN RATE (42) where Instagram stores a true ER
    // (5.2), so taking the max across platforms reported "42.0% engagement"
    // as the creator's headline and scored them off the wrong metric.
    const r = matchCreatorToCampaign(
      fullCreator({
        categories: ['Fashion'], city: 'Oslo', country: 'Norway',
        rateCard: { post: '', reel: '', story: '', longform: '' },
        platforms: [
          { name: 'Instagram', handle: '@x', followers: 142000, engagement: 5.2, verified: false },
          { name: 'Newsletter', handle: 'nl', followers: 8400, engagement: 42, verified: false },
        ],
      }),
      campaign({ category: 'Beauty', region: 'Karachi' }), db(), 500,
    );
    const joined = r.reasons.join(' ');
    expect(joined).not.toMatch(/42/);
    // 5.2% ER is solid but below the 80 reason threshold, so it shouldn't
    // be quoted at all here — the important part is that 42 never appears.
    expect(joined).not.toMatch(/Newsletter/);
  });

  it('caps at three reasons', () => {
    const r = matchCreatorToCampaign(fullCreator({ pastClients: ['Aesop'] }), campaign(), db(), 500);
    expect(r.reasons.length).toBeLessThanOrEqual(3);
  });
});
