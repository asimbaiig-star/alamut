// creatorTrust.test.ts — cold-start trust signals (T3.2).

import { describe, it, expect } from 'vitest';
import { computeTrustProfile, trustSummary } from '../creatorTrust';
import { buildDb, buildCreator } from '@/lib/utils/__tests__/fixtures';
import type { Creator, Collaboration } from '@/lib/api/types';

function bare(p: Partial<Creator> = {}): Creator {
  return buildCreator({
    id: 'cr_1', bio: '', categories: [], platforms: [], work: [],
    rateCard: { post: '', reel: '', story: '', longform: '' },
    verified: false,
    ...p,
  });
}

function collab(stage: Collaboration['stage']): Collaboration {
  return {
    id: 'col_1', campaignId: 'cmp_1', creatorId: 'cr_1', brandId: 'br_1',
    stage, createdAt: 1, updatedAt: 1, agreedRate: 100, acceptedOfferId: null,
    contractId: null, cancelledAt: null, cancellationReason: null, history: [],
  };
}

describe('computeTrustProfile', () => {
  it('reports nothing met for a brand-new empty profile', () => {
    const p = computeTrustProfile(bare(), buildDb())!;
    expect(p.met).toBe(0);
    expect(p.hasTrackRecord).toBe(false);
  });

  it('counts each signal the creator has actually satisfied', () => {
    const p = computeTrustProfile(bare({
      verified: true,
      bio: 'I make things',
      categories: ['Beauty'],
      platforms: [{ name: 'Instagram', handle: '@x', followers: 1000, engagement: 4, verified: false }],
      rateCard: { post: '$300', reel: '', story: '', longform: '' },
    }), buildDb())!;
    const met = p.signals.filter((s) => s.met).map((s) => s.key);
    expect(met).toContain('identity');
    expect(met).toContain('brief-ready');
    expect(met).toContain('rates');
    expect(met).toContain('channel');
    // Listing a channel is a claim; ownership hasn't been confirmed.
    expect(met).not.toContain('channel-verified');
  });

  it('separates what we verified from what the creator asserts', () => {
    const p = computeTrustProfile(bare({
      verified: true,
      platforms: [{ name: 'Instagram', handle: '@x', followers: 1000, engagement: 4, verified: true }],
      bio: 'hi', categories: ['Food'],
    }), buildDb())!;
    // identity + channel-verified are ours; brief-ready/channel are theirs.
    expect(p.verifiedCount).toBe(2);
    expect(p.met).toBeGreaterThan(p.verifiedCount);
  });

  it('requires three portfolio samples, not one', () => {
    const two = computeTrustProfile(bare({ work: ['a', 'b'] }), buildDb())!;
    const three = computeTrustProfile(bare({ work: ['a', 'b', 'c'] }), buildDb())!;
    expect(two.signals.find((s) => s.key === 'portfolio')!.met).toBe(false);
    expect(three.signals.find((s) => s.key === 'portfolio')!.met).toBe(true);
  });

  it('recognises a track record from completed collabs', () => {
    const p = computeTrustProfile(bare(), buildDb({ collaborations: [collab('paid')] }))!;
    expect(p.hasTrackRecord).toBe(true);
    expect(p.signals.find((s) => s.key === 'track-record')!.met).toBe(true);
  });

  it('does not count in-flight collabs as a track record', () => {
    const p = computeTrustProfile(bare(), buildDb({ collaborations: [collab('confirmed')] }))!;
    expect(p.hasTrackRecord).toBe(false);
  });

  it('gives every unmet signal an actionable todo', () => {
    const p = computeTrustProfile(bare(), buildDb())!;
    p.signals.filter((s) => !s.met).forEach((s) => {
      expect(s.todo.length).toBeGreaterThan(0);
      // Should read as an instruction, not a label.
      expect(s.todo).not.toBe(s.label);
    });
  });

  it('returns null without a creator', () => {
    expect(computeTrustProfile(null, buildDb())).toBeNull();
  });
});

describe('trustSummary', () => {
  it('says nothing when no signals are met — "0 of 7" reads as a verdict', () => {
    expect(trustSummary(computeTrustProfile(bare(), buildDb()))).toBeNull();
  });

  it('stays quiet once there is a real track record', () => {
    const p = computeTrustProfile(bare({ verified: true }), buildDb({ collaborations: [collab('paid')] }));
    // Reviews and history are better evidence at that point.
    expect(trustSummary(p)).toBeNull();
  });

  it('credits Alamut-verified signals distinctly', () => {
    const p = computeTrustProfile(bare({ verified: true, bio: 'hi', categories: ['Food'] }), buildDb());
    expect(trustSummary(p)).toMatch(/verified by Alamut/);
  });

  it('omits the verified clause when nothing is verified by us', () => {
    const p = computeTrustProfile(bare({ bio: 'hi', categories: ['Food'] }), buildDb());
    expect(trustSummary(p)).toMatch(/profile checks$/);
  });
});
