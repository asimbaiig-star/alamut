// v2VerifyChannel.test.ts — P6 §5.5 channel verification + profile-completion edge cases.

import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from '@/lib/api/store';
import { v2VerifyChannel, v2AddCreatorChannel } from '../v2CreatorActions';
import { computeProfileCompletion, profileCompletionBreakdown } from '@/lib/utils/profile-completion';
import {
  buildDb, buildCreator,
} from '@/lib/utils/__tests__/fixtures';
import type { Creator, Platform } from '@/lib/api/types';

function makePlatform(p: Partial<Platform> = {}): Platform {
  return {
    name: 'Instagram',
    handle: '@test',
    followers: 50_000,
    engagement: 3.2,
    verified: false,
    ...p,
  };
}

describe('v2VerifyChannel', () => {
  beforeEach(() => {
    useStore.getState().setDB(buildDb({
      creators: [buildCreator({
        id: 'cr_1',
        platforms: [makePlatform({ name: 'Instagram', verified: false })],
      })],
    }));
    useStore.getState().setSession(null);
  });

  it('flips verified=true on a previously unverified channel', () => {
    v2VerifyChannel('cr_1', 0);
    const c = useStore.getState().db.creators[0];
    expect(c.platforms[0].verified).toBe(true);
  });

  it('idempotent on already-verified channel', () => {
    v2VerifyChannel('cr_1', 0); // first
    v2VerifyChannel('cr_1', 0); // second — no-op
    const c = useStore.getState().db.creators[0];
    expect(c.platforms[0].verified).toBe(true);
  });

  it('does not affect other channels', () => {
    useStore.getState().setDB({
      ...useStore.getState().db,
      creators: [buildCreator({
        id: 'cr_1',
        platforms: [
          makePlatform({ name: 'Instagram', verified: false }),
          makePlatform({ name: 'YouTube', verified: false }),
        ],
      })],
    });
    v2VerifyChannel('cr_1', 0); // verify only IG
    const c = useStore.getState().db.creators[0];
    expect(c.platforms[0].verified).toBe(true);
    expect(c.platforms[1].verified).toBe(false);
  });

  it('returns the unchanged creator when index is out of bounds', () => {
    const result = v2VerifyChannel('cr_1', 99);
    expect(result?.platforms[0].verified).toBe(false);
  });
});

describe('v2AddCreatorChannel — defaults verified=false', () => {
  beforeEach(() => {
    useStore.getState().setDB(buildDb({
      creators: [buildCreator({ id: 'cr_1', platforms: [] })],
    }));
    useStore.getState().setSession(null);
  });

  it('newly added channel starts unverified even if caller passes verified=true', () => {
    v2AddCreatorChannel('cr_1', makePlatform({
      name: 'TikTok',
      verified: true,  // caller asserts true …
    }));
    // … but the mutation forces false (P6 §5.5 — verification is earned).
    expect(useStore.getState().db.creators[0].platforms[0].verified).toBe(false);
  });

  it('re-adding an existing channel preserves its verified state', () => {
    // Set up a verified IG channel first.
    useStore.getState().setDB({
      ...useStore.getState().db,
      creators: [buildCreator({
        id: 'cr_1',
        platforms: [makePlatform({ name: 'Instagram', handle: '@same', verified: true })],
      })],
    });
    // Re-add the same name+handle; only fields like followers update.
    v2AddCreatorChannel('cr_1', makePlatform({
      name: 'Instagram',
      handle: '@same',
      followers: 80_000,
      verified: true,
    }));
    const c = useStore.getState().db.creators[0];
    // Followers updated; verified preserved (still true from the earlier OAuth).
    expect(c.platforms[0].followers).toBe(80_000);
    expect(c.platforms[0].verified).toBe(true);
  });
});

describe('computeProfileCompletion — P6 §5.6 acceptance', () => {
  function junkCreator(): Creator {
    // Junk-filled creator: minimal fields, no verified channel, no work.
    return buildCreator({
      id: 'cr_junk',
      tagline: '',
      bio: '',
      city: '',
      portrait: '',
      cover: undefined,
      categories: [],
      languages: [],
      platforms: [],
      work: [],
      pastClients: [],
      pressMentions: [],
      responseHrs: 999,
      verified: false,
      payout: { method: '', account: '', currency: 'USD' },
      rateCard: { post: '', reel: '', story: '', longform: '' },
    });
  }

  it('junk creator caps at ~30% per the brief acceptance criterion', () => {
    const db = buildDb({});
    const score = computeProfileCompletion(junkCreator(), db);
    expect(score).toBeLessThanOrEqual(30);
    expect(score).toBeGreaterThanOrEqual(0);
  });

  it('fully-filled creator can reach 90+', () => {
    const polished: Creator = buildCreator({
      id: 'cr_polished',
      tagline: 'Beauty creator from Karachi',
      bio: 'A bio that is well over the 40-character minimum, written with care and full sentences.',
      city: 'Karachi',
      portrait: 'https://example.com/portrait.jpg',
      cover: 'https://example.com/cover.jpg',
      categories: ['Beauty', 'Lifestyle'],
      languages: ['en', 'ur'],
      platforms: [
        makePlatform({ name: 'Instagram', verified: true, followers: 250_000 }),
        makePlatform({ name: 'TikTok', verified: true, followers: 800_000 }),
      ],
      work: ['url1', 'url2', 'url3'],
      pastClients: ['Aesop', 'Glossier', 'Le Creuset'],
      pressMentions: [{ source: 'Vogue', title: 'Profile', year: 2024 }],
      responseHrs: 6,
      verified: true,
      payout: { method: 'wise', account: '••', currency: 'USD' },
      rateCard: { post: '$500', reel: '$1500', story: '$300', longform: '$3000' },
    });
    const db = buildDb({});
    const score = computeProfileCompletion(polished, db);
    expect(score).toBeGreaterThanOrEqual(90);
  });

  it('verifying a channel bumps the score', () => {
    const half: Creator = buildCreator({
      id: 'cr_half',
      tagline: 'a tagline',
      bio: 'A reasonable bio that meets the forty-character minimum threshold here.',
      portrait: 'https://example.com/p.jpg',
      categories: ['Beauty'],
      languages: ['en'],
      platforms: [makePlatform({ verified: false })], // unverified
      work: ['url'],
      pastClients: [],
      pressMentions: [],
      responseHrs: 24,
      verified: false,
      payout: { method: '', account: '', currency: 'USD' },
      rateCard: { post: '$500', reel: '', story: '', longform: '' },
    });
    const db = buildDb({});
    const beforeScore = computeProfileCompletion(half, db);
    const after = { ...half, platforms: [{ ...half.platforms[0], verified: true }] };
    const afterScore = computeProfileCompletion(after, db);
    // Verifying earns 10 points (the "≥1 verified platform" slice).
    expect(afterScore).toBeGreaterThan(beforeScore);
    expect(afterScore - beforeScore).toBeGreaterThanOrEqual(10);
  });

  it('breakdown helper returns slices with score', () => {
    const c = junkCreator();
    const db = buildDb({});
    const { score, slices } = profileCompletionBreakdown(c, db);
    expect(score).toBeLessThanOrEqual(30);
    expect(slices.length).toBeGreaterThan(10);
    expect(slices.every((s) => typeof s.weight === 'number' && typeof s.earned === 'boolean')).toBe(true);
  });

  it('caps at 100, never above', () => {
    // Even if every slice is true, the total should be ≤ 100.
    const polished: Creator = buildCreator({
      tagline: 't', bio: 'a'.repeat(50),
      city: 'X', portrait: 'p', cover: 'c',
      categories: ['Beauty'], languages: ['en'],
      platforms: [
        makePlatform({ verified: true }), makePlatform({ verified: true }),
      ],
      work: ['a', 'b'], pastClients: ['x', 'y', 'z'],
      pressMentions: [{ source: 'V', title: 'T', year: 2024 }],
      responseHrs: 2, verified: true,
      payout: { method: 'wise', account: 'acc', currency: 'USD' },
      rateCard: { post: '$X', reel: '', story: '', longform: '' },
    });
    const score = computeProfileCompletion(polished, buildDb({}));
    expect(score).toBeLessThanOrEqual(100);
  });
});
