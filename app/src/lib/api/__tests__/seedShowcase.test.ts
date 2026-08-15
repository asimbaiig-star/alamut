// seedShowcase.test.ts — the demo must show the whole pipeline.
//
// Profiling found `confirmed` appearing ONCE across the entire product and
// `live` never at all: the generator accepts an offer and creates submissions
// in the same step (skipping `confirmed`), and its reporting campaigns don't
// reliably land every slot on a permalink (skipping `live`). Someone opening
// the demo could not see the pipeline the product is built around.
//
// The two showcase campaigns fix that by construction. This pins it, because
// a seed regression is invisible — nothing breaks, the demo just quietly
// stops demonstrating anything.

import { describe, it, expect } from 'vitest';
import { SEED } from '../seed';
import { runPendingMigrations } from '../migrations';
import { computeCollabStage } from '../collabSync';
import type { Database, CollabStage } from '../types';

/** The seed ships `collaborations: []`; migrator P1c derives them. */
function hydrated(): Database {
  return runPendingMigrations(JSON.parse(JSON.stringify(SEED)) as Database);
}

const LIVE = 'cmp_show_live';
const CLOSED = 'cmp_show_closed';

describe('the showcase campaigns exist', () => {
  const db = hydrated();

  it('ships both — a live one and a closed twin', () => {
    // TWO because `paid` requires `campIsClosed`, so a single live campaign
    // structurally cannot display it.
    expect(db.campaigns.find((c) => c.id === LIVE)?.stage).toBe('live');
    expect(db.campaigns.find((c) => c.id === CLOSED)?.stage).toBe('closed');
  });

  it('puts them on the demo brand an investor signs in as', () => {
    expect(db.campaigns.find((c) => c.id === LIVE)?.brandId).toBe('b_aesop');
    expect(db.campaigns.find((c) => c.id === CLOSED)?.brandId).toBe('b_aesop');
  });
});

describe('every collaboration stage is represented', () => {
  const db = hydrated();
  const stagesOn = (campaignId: string): CollabStage[] =>
    db.collaborations
      .filter((c) => c.campaignId === campaignId)
      .map((c) => computeCollabStage(c.campaignId, c.creatorId, db));

  it('the live board covers invited through live', () => {
    const stages = new Set(stagesOn(LIVE));
    for (const expected of ['invited', 'pitched', 'negotiating', 'confirmed', 'submitted', 'approved', 'live'] as CollabStage[]) {
      expect(stages.has(expected), `missing ${expected} on the showcase board`).toBe(true);
    }
  });

  it('`invited` is authored, because it cannot be derived', () => {
    // An invite is a collaboration with NO application, offer or submission
    // behind it — there is nothing for migrator P1c to build it from. It has
    // to ship as a row, which is why that migrator's idempotency had to
    // become per-pair rather than "return if any row exists".
    const invited = db.collaborations.filter((c) => c.stage === 'invited');
    expect(invited.length).toBeGreaterThan(0);
    const seeded = db.collaborations.find((c) => c.id === 'col_show_invited');
    expect(seeded).toBeDefined();
    expect(db.applications.some((a) => a.campaignId === seeded!.campaignId && a.creatorId === seeded!.creatorId)).toBe(false);
    expect(db.offers.some((o) => o.campaignId === seeded!.campaignId && o.creatorId === seeded!.creatorId)).toBe(false);
  });

  it('the demo creator holds an invite she can actually answer', () => {
    // `pitched` is the BRAND's move, so Sarah sitting there gave the creator
    // demo nothing to do. She holds `invited` instead — hers to accept or
    // decline.
    const sarah = db.collaborations.find((c) => c.creatorId === 'c_sarah' && c.stage === 'invited');
    expect(sarah).toBeDefined();
  });

  it('seeding an invite does not suppress derivation of everything else', () => {
    // The failure mode of the old all-or-nothing guard: one seeded row meant
    // ZERO derived collaborations product-wide.
    expect(db.collaborations.length).toBeGreaterThan(400);
  });

  it('the closed twin carries `paid`', () => {
    expect(stagesOn(CLOSED)).toContain('paid');
  });

  it('`confirmed` and `live` exist product-wide, which they did not before', () => {
    const all = db.collaborations.map((c) => computeCollabStage(c.campaignId, c.creatorId, db));
    expect(all.filter((s) => s === 'confirmed').length).toBeGreaterThan(1);
    expect(all.filter((s) => s === 'live').length).toBeGreaterThan(0);
  });

  it('shows a revision in flight — the case the brand card rendered blank for', () => {
    const sub = db.submissions.find((s) => s.campaignId === LIVE && s.status === 'revisions');
    expect(sub).toBeDefined();
  });
});

describe('the clutter stays cut', () => {
  const db = hydrated();

  it('keeps the campaign list readable', () => {
    // Was 248. A visitor scrolls past a wall rather than reading it.
    expect(db.campaigns.length).toBeLessThan(140);
  });

  it('does not drown the board in pitches and dead deals', () => {
    const stages = db.collaborations.map((c) => computeCollabStage(c.campaignId, c.creatorId, db));
    const noise = stages.filter((s) => s === 'pitched' || s === 'cancelled').length;
    // Was 3,152 of 3,575 — 88% of every collab in the product.
    expect(noise / stages.length).toBeLessThan(0.75);
  });

  it('exercises the income-advance feature, which had zero rows', () => {
    expect(db.advances.some((a) => a.status === 'active')).toBe(true);
    expect(db.advances.some((a) => a.status === 'repaid')).toBe(true);
  });
});
