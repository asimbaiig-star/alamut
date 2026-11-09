// @vitest-environment jsdom
//
// postsToConfirm — the brand's "Confirm X's post is live" rows.
//
// What we pin:
//   - each post is named, so two from one creator read differently
//     (the live demo showed two identical "Confirm Sarah Johnson's post
//     is live" rows)
//   - one row per post: an older approved round doesn't add a second
//   - the latest round decides: a newer round still in review means
//     nothing to confirm yet
//   - confirmed posts and other brands' campaigns stay out
//   - each row carries what confirming releases, from slotReleaseGross
//     (the sum the release itself moves): the post's share of the agreed
//     rate, shares summing to the rate, nothing for a slot already paid
//   - no row confirming can't pay: no accepted offer, or a cancelled deal
//     (the live demo asked to confirm posts on a cancelled deal, and the
//     release failed with "no accepted offer found")

import { describe, it, expect } from 'vitest';
import { postsToConfirm } from '../needsYou';
import { slotReleaseGross } from '@/lib/api/collabSync';
import type { Database, Deliverable, Offer, Submission } from '@/lib/api/types';

const del = (id: string, format: string, index: number): Deliverable => ({
  id, campaignId: 'cmp_1', creatorId: null, index, platform: 'instagram', format, quantity: 1, dueOffsetDays: null, specs: null,
} as unknown as Deliverable);

const sub = (id: string, deliverableId: string, round: number, extra: Partial<Submission> = {}): Submission => ({
  id, campaignId: 'cmp_1', creatorId: 'c_sarah', deliverableId, round, files: [], notes: '',
  status: 'approved', submittedAt: '2026-11-01T10:00:00Z', feedback: [], permalink: `https://instagram.com/p/${id}`,
  ...extra,
} as Submission);

const offer = (rate: number): Offer => ({
  id: 'o1', campaignId: 'cmp_1', creatorId: 'c_sarah', status: 'accepted', rate,
  sentAt: '2026-10-20T10:00:00Z', respondedAt: '2026-10-21T10:00:00Z', rounds: [],
} as unknown as Offer);

const db = (submissions: Submission[], offers: Offer[] = [offer(1200)], deliverables = [del('d_reel', 'reel', 0), del('d_story', 'story', 1)], collaborations: { campaignId: string; creatorId: string; stage: string }[] = []): Database => ({
  submissions,
  offers,
  deliverables,
  collaborations,
} as unknown as Database);

const camps = new Set(['cmp_1']);

describe('postsToConfirm', () => {
  it('names each post', () => {
    const out = postsToConfirm(db([sub('s1', 'd_reel', 1), sub('s2', 'd_story', 1)]), camps);
    expect(out.map((o) => o.what)).toEqual(['Reel', 'Story']);
  });

  it('gives one row per post, from the latest round', () => {
    const out = postsToConfirm(db([sub('s1', 'd_reel', 1), sub('s2', 'd_reel', 2)]), camps);
    expect(out.map((o) => o.sub.id)).toEqual(['s2']);
  });

  it('waits while the latest round is still in review', () => {
    const out = postsToConfirm(db([sub('s1', 'd_reel', 1), sub('s2', 'd_reel', 2, { status: 'in_review', permalink: undefined })]), camps);
    expect(out).toEqual([]);
  });

  it('leaves out confirmed posts and other campaigns', () => {
    const live = sub('s1', 'd_reel', 1, { feedback: [{ from: 'system', text: 'LIVE: https://instagram.com/p/s1', at: '2026-11-02T10:00:00Z' }] });
    const other = sub('s2', 'd_story', 1, { campaignId: 'cmp_other' });
    expect(postsToConfirm(db([live, other]), camps)).toEqual([]);
  });
});

describe('what confirming releases', () => {
  it('splits the agreed rate across the posts, summing to it exactly', () => {
    const out = postsToConfirm(db([sub('s1', 'd_reel', 1), sub('s2', 'd_story', 1)], [offer(1651)]), camps);
    expect(out.map((o) => o.releases)).toEqual([825, 826]);
  });

  it('releases the whole rate for a single post', () => {
    expect(slotReleaseGross(sub('s1', 'd_reel', 1), db([sub('s1', 'd_reel', 1)], [offer(1200)], [del('d_reel', 'reel', 0)]))).toBe(1200);
  });

  it('releases nothing for a post already paid on an earlier round', () => {
    const paid = sub('s1', 'd_reel', 1, { feedback: [{ from: 'system', text: 'LIVE: x', at: '2026-11-02T10:00:00Z' }] });
    const again = sub('s2', 'd_reel', 2);
    expect(slotReleaseGross(again, db([paid, again], [offer(1200)]))).toBe(0);
  });

  it('is null with no accepted offer', () => {
    expect(slotReleaseGross(sub('s1', 'd_reel', 1), db([sub('s1', 'd_reel', 1)], []))).toBeNull();
  });
});

describe("posts confirming can't pay", () => {
  it('leaves out a deal with no accepted offer', () => {
    expect(postsToConfirm(db([sub('s1', 'd_reel', 1)], []), camps)).toEqual([]);
  });

  it('leaves out a cancelled deal', () => {
    const cancelled = [{ campaignId: 'cmp_1', creatorId: 'c_sarah', stage: 'cancelled' }];
    expect(postsToConfirm(db([sub('s1', 'd_reel', 1)], [offer(1200)], undefined, cancelled), camps)).toEqual([]);
  });
});
