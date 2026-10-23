// campaignsProjection.test.ts — merging the two campaign reads.
//
// After migration 039 a session reads campaigns two ways: the raw table for
// its own campaigns and ones it is party to (every column), and
// `campaigns_public` for the rest (no spent, escrow_held, history, milestones
// or auto_shortlist). The merge decides what the store ends up holding, and
// three different things go wrong if it guesses.

import { describe, it, expect } from 'vitest';
import type { Campaign } from '@/lib/api/types';
import {
  mergeHydratedCampaigns, toPublicCampaign, PRIVATE_FIELD_DEFAULTS, type PublicCampaign,
} from '@/lib/data/campaignsRepo';

const row = (over: Record<string, unknown> = {}) => ({
  id: 'cmp_x', brand_id: 'b_x', title: 'From Postgres', pitch: '', brief: '', cover: '',
  budget: 18000, spent: 1650, escrow_held: 5400, region: '', category: null, stage: 'live',
  deliverables_text: '', deliverable_ids: [], deadline: '', posted_at: null, reach: null,
  engagement: null, history: [{ at: '2026-01-01', by: 'u_x', stage: 'live' }],
  milestones: [{ id: 'm1', stage: 'offer', amount: 900, description: '50% on accept' }],
  applications: ['app_1'], offers: [], rights: null, auto_shortlist: ['c_y'], kind: null,
  editors_pick: null, assets: [], version: 3, created_at: '2026-01-01', updated_at: '2026-01-02',
  ...over,
});
// What the projection actually returns: no private columns at all.
const publicRow = (over: Record<string, unknown> = {}) => {
  const r: Record<string, unknown> = row(over);
  for (const k of ['spent', 'escrow_held', 'history', 'milestones', 'auto_shortlist']) delete r[k];
  return r;
};
const toPub = (over?: Record<string, unknown>) =>
  toPublicCampaign(publicRow(over) as never) as PublicCampaign;

const localCampaign = (over: Partial<Campaign> = {}): Campaign => ({
  id: 'cmp_x', brandId: 'b_x', title: 'Seed title', pitch: '', brief: '', cover: '', budget: 18000,
  spent: 777, escrowHeld: 5400, region: '', category: '', stage: 'live', deliverablesText: '',
  deliverableIds: [], deadline: '', createdAt: '2026-01-01',
  history: [{ at: '2025-12-01', by: 'u_seed', stage: 'draft' }] as Campaign['history'],
  milestones: [], applications: [], offers: [], autoShortlist: null, assets: [], version: 1,
  // Fields with no column in Postgres — only ever local.
  tracking: [{ id: 't1', revenueAttributed: 12000 }] as unknown as Campaign['tracking'],
  archivedAt: '2026-02-02',
  ...over,
} as Campaign);

describe('toPublicCampaign', () => {
  it('carries no private field at all — absent, not zeroed', () => {
    const p = toPub() as Record<string, unknown>;
    for (const f of ['spent', 'escrowHeld', 'history', 'milestones', 'autoShortlist']) {
      expect(f in p, `${f} present on a public row`).toBe(false);
    }
    expect(p.title).toBe('From Postgres');
  });
});

describe('mergeHydratedCampaigns', () => {
  it('a public row keeps the local copy\'s private fields', () => {
    // A zero here would be a lie on the brand's own screens, and a creator
    // flow computing a release against escrowHeld would compute nonsense.
    const [c] = mergeHydratedCampaigns([localCampaign()], [toPub()], []);
    expect(c.title).toBe('From Postgres'); // public fields: remote wins
    expect(c.spent).toBe(777);
    expect(c.escrowHeld).toBe(5400);
    expect(c.history).toHaveLength(1);
  });

  it('a campaign seen only publicly starts at zero, never undefined', () => {
    // LandingV2 skips `c.spent <= 0` and divides by c.spent otherwise.
    // `undefined <= 0` is false, so an undefined spent reaches the page as NaN.
    const [c] = mergeHydratedCampaigns([], [toPub({ id: 'cmp_new' })], []);
    expect(c.id).toBe('cmp_new');
    expect(c).toMatchObject(PRIVATE_FIELD_DEFAULTS);
    expect(c.spent <= 0).toBe(true);
  });

  it('a raw row wins over both the projection and the local copy', () => {
    const [c] = mergeHydratedCampaigns(
      [localCampaign()], [toPub({ title: 'public title' })], [toFull({ title: 'owner title', spent: 1650 })],
    );
    expect(c.title).toBe('owner title');
    expect(c.spent).toBe(1650);
    expect(c.milestones).toHaveLength(1);
  });

  it('neither read erases fields Postgres has no column for', () => {
    // A whole-row replace dropped tracking / archivedAt on every load, for
    // every visitor, while the raw table was world-readable.
    for (const merged of [
      mergeHydratedCampaigns([localCampaign()], [toPub()], []),
      mergeHydratedCampaigns([localCampaign()], [], [toFull()]),
    ]) {
      expect(merged[0].tracking).toHaveLength(1);
      expect(merged[0].archivedAt).toBe('2026-02-02');
    }
  });

  it('keeps local order and appends what is new', () => {
    const a = localCampaign({ id: 'a' }); const b = localCampaign({ id: 'b' });
    const out = mergeHydratedCampaigns([a, b], [toPub({ id: 'c' }), toPub({ id: 'a' })], [toFull({ id: 'd' })]);
    expect(out.map((c) => c.id)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('nothing to merge returns the local list untouched', () => {
    const local = [localCampaign()];
    expect(mergeHydratedCampaigns(local, [], [])).toBe(local);
  });
});

function toFull(over: Record<string, unknown> = {}): Campaign {
  // The raw read maps through toCampaign; toPublicCampaign is toCampaign
  // minus the private keys, so build the full row the same way and restore them.
  const r = row(over);
  const pub = toPublicCampaign(r as never) as Record<string, unknown>;
  return {
    ...pub,
    spent: r.spent, escrowHeld: r.escrow_held, history: r.history,
    milestones: r.milestones, autoShortlist: r.auto_shortlist,
  } as unknown as Campaign;
}
