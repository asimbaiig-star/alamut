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

// ─────────────────────────────────────────────────────────────────────
// The messy outcomes — disputes and amendments (WORKFLOW-GAPS F3, E2/E3)
// ─────────────────────────────────────────────────────────────────────
//
// The stage board shows a deal going RIGHT. Nothing showed one going
// sideways, so the dispute and amendment panels were invisible until someone
// thought to create one — a feature nobody can find is a feature nobody has.
//
// The load-bearing property here is that BOTH personas have something to act
// on. A demo where every card is waiting on the other guy demonstrates
// nothing, and that is the easiest thing to get wrong when authoring seed by
// hand.

const AFTER = 'cmp_show_after';

describe('the demo shows deals that went sideways', () => {
  const db = hydrated();
  const sarahUser = db.users.find((u) => u.creatorId === 'c_sarah')?.id;

  const afterCollabs = () => db.collaborations.filter((c) => c.campaignId === AFTER);
  const afterDisputes = () => db.disputes.filter((d) => d.campaignId === AFTER);

  it('ships the campaign, separate from the stage board', () => {
    // Separate on purpose: disputes freeze escrow and amendments reopen
    // stages, so mixing them in would stop the stage board meaning what it
    // says.
    expect(db.campaigns.find((c) => c.id === AFTER)?.stage).toBe('live');
    expect(db.campaigns.find((c) => c.id === AFTER)?.brandId).toBe('b_aesop');
  });

  it('shows a dispute mid-negotiation, with a split actually on the table', () => {
    const withProposal = afterDisputes().filter((d) => d.status === 'open' && d.proposal);
    expect(withProposal.length).toBe(2);
  });

  it('BOTH SIDES HAVE A DECISION WAITING', () => {
    // The one property that makes this seed worth having. One dispute
    // proposal awaits the creator, one awaits the brand.
    const open = afterDisputes().filter((d) => d.proposal);
    const proposers = open.map((d) => d.proposal!.by);
    expect(proposers).toContain('u_hannah');          // brand proposed → creator answers
    expect(proposers.some((p) => p !== 'u_hannah')).toBe(true); // creator proposed → brand answers

    // And an amendment awaiting the brand.
    const pendingAmendment = afterCollabs()
      .flatMap((c) => c.amendments ?? [])
      .filter((a) => a.status === 'proposed');
    expect(pendingAmendment.length).toBe(1);
    expect(pendingAmendment[0].proposedBy).not.toBe('u_hannah');
  });

  it('the demo creator is the one who must answer a settlement', () => {
    // Sarah is who an investor signs in as on the creator side; a dispute she
    // cannot act on teaches them nothing.
    const hers = afterDisputes().find(
      (d) => d.collaborationId === 'col_after_c_sarah',
    );
    expect(hers?.proposal?.by).toBe('u_hannah');
    expect(hers?.status).toBe('open');
    // And her escrow is frozen, which is what a dispute is FOR.
    expect(db.collaborations.find((c) => c.id === 'col_after_c_sarah')?.escrowFrozen).toBe(true);
  });

  it('shows a settled rights extension, not only pending ones', () => {
    const agreed = afterCollabs()
      .flatMap((c) => c.amendments ?? [])
      .filter((a) => a.status === 'agreed' && a.kind === 'rights-extension');
    expect(agreed.length).toBe(1);
    expect(agreed[0].repurposeTo).toBe('365d');
  });

  it('the agreed extension has the ledger rows to match', () => {
    // An amendment that widened rights without paying anybody would be the
    // fiction this project spent six phases removing.
    // Matched by id, not by note text: the fee and withholding rows read
    // "Platform fee (10%)" / "Withholding tax (5%)" — deliberately, since
    // that is what the release path writes — so a note filter silently finds
    // only half the group and any sum over it is wrong by exactly the
    // deductions. (It did, on the first run of this test.)
    const rows = db.transactions.filter((t) => t.id.startsWith('tx_after_rights_'));
    expect(rows).toHaveLength(4);
    expect(rows.find((t) => t.kind === 'payout')?.amount).toBe(900);
    expect(rows.find((t) => t.kind === 'escrow_release')?.amount).toBe(-900);
    // Creator rows sum to the net that reached the wallet.
    const creatorRows = rows.filter((t) => t.userId !== 'u_hannah');
    expect(creatorRows.reduce((s, t) => s + t.amount, 0))
      .toBe(900 - Math.round(900 * 0.10) - Math.round(900 * 0.05));
  });

  it('authored rows survive derivation rather than being overwritten', () => {
    // escrowFrozen and amendments have no application/offer/submission behind
    // them, so P1c cannot derive them — the row has to be authored, and P1c's
    // per-pair idempotency is what lets it survive.
    expect(afterCollabs().length).toBe(4);
    expect(afterCollabs().filter((c) => c.escrowFrozen).length).toBe(2);
    expect(afterCollabs().filter((c) => (c.amendments ?? []).length > 0).length).toBe(2);
    expect(sarahUser).toBeTruthy();
  });

  it('every dispute points at a collaboration that exists', () => {
    for (const d of afterDisputes()) {
      expect(db.collaborations.some((c) => c.id === d.collaborationId)).toBe(true);
    }
  });

  it('escrow adds up: held covers exactly the unsettled deals', () => {
    const camp = db.campaigns.find((c) => c.id === AFTER)!;
    // Three still held (2400 + 1900 + 1700); the fourth is delivered and paid.
    expect(camp.escrowHeld).toBe(2400 + 1900 + 1700);
  });
});
