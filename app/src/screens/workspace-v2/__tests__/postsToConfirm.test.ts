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

import { describe, it, expect } from 'vitest';
import { postsToConfirm } from '../needsYou';
import type { Database, Deliverable, Submission } from '@/lib/api/types';

const del = (id: string, format: string, index: number): Deliverable => ({
  id, campaignId: 'cmp_1', creatorId: null, index, platform: 'instagram', format, quantity: 1, dueOffsetDays: null, specs: null,
} as unknown as Deliverable);

const sub = (id: string, deliverableId: string, round: number, extra: Partial<Submission> = {}): Submission => ({
  id, campaignId: 'cmp_1', creatorId: 'c_sarah', deliverableId, round, files: [], notes: '',
  status: 'approved', submittedAt: '2026-11-01T10:00:00Z', feedback: [], permalink: `https://instagram.com/p/${id}`,
  ...extra,
} as Submission);

const db = (submissions: Submission[]): Database => ({
  submissions,
  deliverables: [del('d_reel', 'reel', 0), del('d_story', 'story', 1)],
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
