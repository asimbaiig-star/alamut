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
    // Listing a channel is a claim; nothing in the app can confirm ownership,
    // so there is no ownership signal to meet at all.
    expect(p.signals.map((s) => s.key)).not.toContain('channel-verified');
  });

  it('separates what we verified from what the creator asserts', () => {
    // This test used to expect 2 — identity and channel ownership counted as
    // "verified by Alamut". Neither is: the identity step verifies itself on
    // click, and no screen can confirm a channel. Every self-service step,
    // done in full, must earn exactly zero Alamut-verified signals.
    const everythingSelfService = computeTrustProfile(bare({
      verified: true, kycVerifiedAt: '2026-01-01',
      platforms: [{ name: 'Instagram', handle: '@x', followers: 1000, engagement: 4, verified: true }],
      bio: 'hi', categories: ['Food'],
      rateCard: { post: '$300', reel: '', story: '', longform: '' },
      work: ['a', 'b', 'c'],
    }), buildDb())!;
    expect(everythingSelfService.met).toBeGreaterThan(3);
    expect(everythingSelfService.verifiedCount).toBe(0);
    // What Alamut does record: a completed collab.
    const withTrackRecord = computeTrustProfile(bare(), buildDb({ collaborations: [collab('paid')] }))!;
    expect(withTrackRecord.verifiedCount).toBe(1);
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
    // Built by hand: no real profile can reach this branch today (the only
    // Alamut-recorded signal is a completed collab, which also means a track
    // record, which silences the summary). It comes alive with a real
    // document-check provider; the wording is what is pinned here.
    const p = { signals: [], met: 3, total: 6, verifiedCount: 1, hasTrackRecord: false };
    expect(trustSummary(p)).toMatch(/verified by Alamut/);
  });

  it('never says "verified by Alamut" for a creator who only did self-service steps', () => {
    const p = computeTrustProfile(bare({
      verified: true, kycVerifiedAt: '2026-01-01', bio: 'hi', categories: ['Food'],
      platforms: [{ name: 'Instagram', handle: '@x', followers: 1000, engagement: 4, verified: true }],
    }), buildDb());
    expect(trustSummary(p)).not.toMatch(/verified by Alamut/);
  });

  it('omits the verified clause when nothing is verified by us', () => {
    const p = computeTrustProfile(bare({ bio: 'hi', categories: ['Food'] }), buildDb());
    expect(trustSummary(p)).toMatch(/profile checks$/);
  });
});
