// collabLifecycle.test.ts — the CRM backbone, enforced.
//
// Asim's ask, in his words: know exactly what stage any collaboration is in,
// which actions precede it, which follow, and who performs them — and stop
// making silly mistakes in the backbone.
//
// The three tests that would each have caught a real bug from this session:
//
//   1. NO DRIFT — stored stage equals derived stage for every pair in the
//      seed. The lapse scheduler wrote `withdrawn` without recomputing, so a
//      row said `pitched` while the UI derived `invited`, and two panels on
//      one screen disagreed.
//
//   2. NO STAGE LIES — every derived stage's own preconditions hold. A pair
//      whose pitch lapsed and whose offer expired derived `invited`, because
//      `expired` was missing from the offer terminal set and `invited` was
//      the function's fallback. The banner then told the creator a brand had
//      invited them.
//
//   3. NO ILLEGAL TRANSITIONS — every history entry moves between stages the
//      lifecycle permits, so "live before confirmed" cannot appear.

import { describe, it, expect } from 'vitest';
import { SEED } from '../seed';
import { runPendingMigrations } from '../migrations';
import { computeCollabStage, computeSlotStatuses } from '../collabSync';
import {
  APPLICATION_STATE, OFFER_STATE, SUBMISSION_STATE,
  LEGAL_REVERSALS, STAGE_ORDER, STAGE_REQUIREMENTS,
  explainStage, isLegalTransition, stageFacts,
} from '../collabLifecycle';
import type { ApplicationStatus, CollabStage, Database, OfferStatus, SubmissionStatus } from '../types';

function hydrated(): Database {
  return runPendingMigrations(JSON.parse(JSON.stringify(SEED)) as Database);
}

const ALL_STAGES: CollabStage[] = [
  'invited', 'pitched', 'negotiating', 'confirmed',
  'submitted', 'approved', 'live', 'paid', 'cancelled',
];

// ─────────────────────────────────────────────────────────────────────
// The classification tables
// ─────────────────────────────────────────────────────────────────────
describe('every status is classified, and dead means dead', () => {
  it('covers every OfferStatus', () => {
    const all: OfferStatus[] = ['pending', 'accepted', 'declined', 'withdrawn', 'countered', 'expired'];
    for (const s of all) expect(OFFER_STATE[s], `OfferStatus '${s}' unclassified`).toBeTruthy();
    expect(Object.keys(OFFER_STATE).sort()).toEqual([...all].sort());
  });

  it('covers every ApplicationStatus', () => {
    const all: ApplicationStatus[] = ['submitted', 'shortlisted', 'accepted', 'rejected', 'withdrawn'];
    for (const s of all) expect(APPLICATION_STATE[s], `ApplicationStatus '${s}' unclassified`).toBeTruthy();
    expect(Object.keys(APPLICATION_STATE).sort()).toEqual([...all].sort());
  });

  it('covers every SubmissionStatus', () => {
    const all: SubmissionStatus[] = ['in_review', 'revisions', 'approved', 'rejected'];
    expect(Object.keys(SUBMISSION_STATE).sort()).toEqual([...all].sort());
  });

  it('EXPIRED IS DEAD — the omission that caused the bug', () => {
    // `allDeclined` checked declined|withdrawn and not expired, so a pair
    // with an expired offer matched no branch and fell through to `invited`.
    expect(OFFER_STATE.expired).toBe('dead');
    expect(OFFER_STATE.declined).toBe('dead');
    expect(OFFER_STATE.withdrawn).toBe('dead');
  });

  it('a rejected slot is settled, not open', () => {
    // Otherwise a rejected deliverable holds the deal at `confirmed` forever,
    // waiting for work nobody is going to send.
    expect(SUBMISSION_STATE.rejected).toBe('settled');
    expect(SUBMISSION_STATE.in_review).toBe('open');
  });
});

// ─────────────────────────────────────────────────────────────────────
// The transition graph
// ─────────────────────────────────────────────────────────────────────
describe('the funnel only runs forwards, except where the product goes back', () => {
  it('every stage has an order', () => {
    for (const s of ALL_STAGES) expect(STAGE_ORDER[s], `${s} has no order`).toBeDefined();
  });

  it('FORWARD SKIPS ARE LEGAL — history records recomputes, not steps', () => {
    // My first version of this model forbade them, and the seed's legitimate
    // `submitted → paid` entries failed it. Approving the last slot of a deal
    // whose content is already live, on a closed campaign, lands `paid` in one
    // recompute. The stage is a derived value; history logs where it landed.
    expect(isLegalTransition('submitted', 'paid')).toBe(true);
    expect(isLegalTransition('confirmed', 'live')).toBe(true);
    expect(isLegalTransition('pitched', 'confirmed')).toBe(true);
  });

  it('but a stage never walks backwards on its own', () => {
    expect(isLegalTransition('paid', 'submitted')).toBe(false);
    expect(isLegalTransition('live', 'approved')).toBe(false);
    expect(isLegalTransition('confirmed', 'negotiating')).toBe(false);
    expect(isLegalTransition('approved', 'pitched')).toBe(false);
  });

  it('a cancelled deal never resumes', () => {
    for (const s of ALL_STAGES) {
      if (s === 'cancelled') continue;
      expect(isLegalTransition('cancelled', s), `cancelled → ${s} must be illegal`).toBe(false);
    }
  });

  it('the only declared reversal is E3 reopening a finished deal', () => {
    expect(LEGAL_REVERSALS.confirmed).toEqual(['approved', 'live', 'paid']);
    expect(Object.keys(LEGAL_REVERSALS)).toEqual(['confirmed']);
  });

  it('a finished deal may reopen — that is E3, deliberately', () => {
    // An agreed scope amendment pulls a paid deal back to confirmed. This is
    // the one backwards move the product actually performs.
    expect(isLegalTransition('paid', 'confirmed')).toBe(true);
    expect(isLegalTransition('live', 'confirmed')).toBe(true);
  });

  it('cancelled is reachable from every live stage and from none of the dead ones', () => {
    for (const s of ALL_STAGES) {
      if (s === 'cancelled' || s === 'paid') continue;
      expect(isLegalTransition(s, 'cancelled'), `${s} cannot cancel`).toBe(true);
    }
    // A paid deal is done; cancelling it would mean clawing back a payout.
    expect(isLegalTransition('paid', 'cancelled')).toBe(false);
  });

  it('a recompute landing on the same stage is not a transition', () => {
    for (const s of ALL_STAGES) expect(isLegalTransition(s, s)).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────
// The three invariants, against the real seeded world
// ─────────────────────────────────────────────────────────────────────
describe('the seeded world obeys the lifecycle', () => {
  const db = hydrated();

  it('NO DRIFT: stored stage equals derived stage for every pair', () => {
    const drifted = db.collaborations
      .map((c) => ({
        id: c.id,
        campaignId: c.campaignId,
        creatorId: c.creatorId,
        stored: c.stage,
        derived: computeCollabStage(c.campaignId, c.creatorId, db),
      }))
      .filter((r) => r.stored !== r.derived);

    expect(
      drifted,
      `stored and derived stage disagree — the UI shows one and the row says the other:\n${
        drifted.map((d) => `  ${d.id}  stored=${d.stored}  derived=${d.derived}`).join('\n')}`,
    ).toEqual([]);
  });

  it('NO STAGE LIES: every derived stage satisfies its own preconditions', () => {
    const lying: string[] = [];
    for (const c of db.collaborations) {
      const slots = computeSlotStatuses(c.campaignId, c.creatorId, db);
      const facts = stageFacts(c.campaignId, c.creatorId, db, slots);
      const stage = computeCollabStage(c.campaignId, c.creatorId, db);
      const { violations } = explainStage(stage, facts);
      for (const v of violations) lying.push(`  ${c.id} (${stage}): ${v}`);
    }
    expect(lying, `stages asserting things the data does not support:\n${lying.join('\n')}`).toEqual([]);
  });

  it('NO ILLEGAL TRANSITIONS in any recorded history', () => {
    const illegal: string[] = [];
    for (const c of db.collaborations) {
      for (const h of c.history) {
        if (h.from === null) continue;
        if (!isLegalTransition(h.from, h.to)) {
          illegal.push(`  ${c.id}: ${h.from} → ${h.to}`);
        }
      }
    }
    expect(illegal, `history contains transitions the lifecycle forbids:\n${illegal.join('\n')}`).toEqual([]);
  });

  it('and there is enough of a world here for those checks to mean something', () => {
    // Guards the three above from passing vacuously on an empty set.
    expect(db.collaborations.length).toBeGreaterThan(50);
    const stages = new Set(db.collaborations.map((c) => computeCollabStage(c.campaignId, c.creatorId, db)));
    expect(stages.size).toBeGreaterThanOrEqual(6);
  });
});

// ─────────────────────────────────────────────────────────────────────
// `invited` is a stage, not a shrug
// ─────────────────────────────────────────────────────────────────────
describe('invited requires an invitation', () => {
  it('a pair whose pitch lapsed and whose offer expired is cancelled, not invited', () => {
    // The exact shape Asim found on cmp_g4 × c_sarah.
    const db = hydrated();
    const camp = db.campaigns[0];
    const creator = db.creators[0];
    db.applications = [{
      id: 'app_x', campaignId: camp.id, creatorId: creator.id,
      pitch: 'hi', proposedRate: 1000, status: 'withdrawn',
      submittedAt: '2026-07-14T00:00:00Z', decidedAt: '2026-08-04T00:00:00Z',
    }];
    db.offers = [{
      id: 'off_x', campaignId: camp.id, creatorId: creator.id, rate: 3553,
      message: '', status: 'expired', sentAt: '2026-07-19T00:00:00Z',
      respondedAt: '2026-08-17T00:00:00Z',
      rounds: [{ by: 'brand', at: 1, rate: 3553, message: null }],
      applicationId: 'app_x', source: 'application',
    }];
    db.collaborations = [];
    db.submissions = [];

    expect(computeCollabStage(camp.id, creator.id, db)).toBe('cancelled');
  });

  it('but a genuine cold invite still reads as invited', () => {
    const db = hydrated();
    const camp = db.campaigns[0];
    const creator = db.creators[0];
    db.applications = [];
    db.offers = [];
    db.submissions = [];
    db.collaborations = [{
      id: 'col_x', campaignId: camp.id, creatorId: creator.id, brandId: camp.brandId,
      stage: 'invited', createdAt: 1, updatedAt: 1,
      agreedRate: null, acceptedOfferId: null, contractId: null,
      cancelledAt: null, cancellationReason: null,
      history: [{ at: 1, from: null, to: 'invited', actorUserId: 'u_hannah', reason: 'brand-invite: hello' }],
    }];

    expect(computeCollabStage(camp.id, creator.id, db)).toBe('invited');
  });

  it('an accepted pitch without an offer reads as pitched, not invited or cancelled', () => {
    // The one remaining way to reach the bottom of the derivation. Falling
    // through to `invited` claimed an invitation; my first fix would have
    // called it `cancelled`, reporting a just-accepted deal as dead.
    const db = hydrated();
    const camp = db.campaigns[0];
    const creator = db.creators[0];
    db.applications = [{
      id: 'app_a', campaignId: camp.id, creatorId: creator.id,
      pitch: 'hi', proposedRate: 900, status: 'accepted',
      submittedAt: '2026-07-01T00:00:00Z', decidedAt: '2026-07-02T00:00:00Z',
    }];
    db.offers = [];
    db.submissions = [];
    db.collaborations = [];
    expect(computeCollabStage(camp.id, creator.id, db)).toBe('pitched');
  });

  it('PAID REQUIRES THE POST LIVE AND THE BRAND\'S CHECK', () => {
    // Asim, verbatim: "creator has to make the post live and then only can
    // the brand check make it payable."
    //
    // `allSlotsLive` IS that check. `v2MarkContentLive` carries the
    // `content.markLive` capability, which only brand admin/ops hold, and it
    // refuses until the creator has pasted the permalink. So reaching `live`
    // already means the creator posted and the brand verified.
    const base = {
      hasInvite: false, hasLiveApplication: false, hasLiveOffer: false,
      hasAcceptedOffer: true, hasAnySignal: true, allSignalsDead: false,
      slotCount: 2, anySlotOpen: false, allSlotsSettled: true,
      allSlotsLive: true, anySlotLive: true, payoutCleared: true,
      campaignClosed: false, escrowFrozen: false, cancelledAt: null,
    };
    // Money cleared + every slot verified live → paid, campaign open or not.
    expect(explainStage('paid', base).violations).toEqual([]);
    expect(explainStage('paid', { ...base, campaignClosed: true }).violations).toEqual([]);

    // Money cleared but the post is NOT verified live → not paid.
    expect(explainStage('paid', { ...base, allSlotsLive: false }).violations)
      .toContain('`paid` without every slot verified live by the brand');

    // Verified live but the money has not cleared → not paid.
    expect(explainStage('paid', { ...base, payoutCleared: false }).violations)
      .toContain('`paid` without a cleared payout');

    // ONE of three posts verified is not a finished deal.
    expect(explainStage('paid', { ...base, allSlotsLive: false, anySlotLive: true }).violations)
      .not.toEqual([]);
  });

  it('THE DERIVATION honours it too, not just the requirements table', () => {
    // Mutation-testing caught this gap: replacing the rollup with
    // `if (hasPayout) return \'paid\'` — skipping the live check entirely —
    // left every test green, because the existing derivation tests all use
    // the legacy no-deliverables path. This one drives the slot rollup.
    const db = hydrated();
    const camp = db.campaigns[0];
    const creator = db.creators[0];
    const creatorUser = db.users.find((u) => u.creatorId === creator.id)!;

    db.applications = [];
    db.collaborations = [];
    db.offers = [{
      id: 'off_p', campaignId: camp.id, creatorId: creator.id, rate: 1000,
      message: '', status: 'accepted', sentAt: '2026-07-01T00:00:00Z',
      respondedAt: '2026-07-02T00:00:00Z',
      rounds: [{ by: 'brand', at: 1, rate: 1000, message: null }],
      applicationId: null, source: 'cold-outreach',
    }];
    db.deliverables = [{
      id: 'del_p', campaignId: camp.id, creatorId: null, index: 0,
      platform: 'instagram', format: 'reel', quantity: 1,
      dueOffsetDays: null, specs: null,
    }];
    // Approved, money cleared — but the creator has NOT posted, so the brand
    // has nothing to verify.
    db.submissions = [{
      id: 'sub_p', campaignId: camp.id, creatorId: creator.id, round: 1,
      files: [], notes: '', status: 'approved',
      submittedAt: '2026-07-05T00:00:00Z', feedback: [], deliverableId: 'del_p',
    }];
    db.transactions = [{
      id: 'tx_p', at: '2026-07-06T00:00:00Z', userId: creatorUser.id,
      kind: 'payout', amount: 1000, status: 'cleared', campaignId: camp.id,
      note: 'payout',
    }];

    // Money moved at approval, but no post is up: this is `approved`.
    expect(computeCollabStage(camp.id, creator.id, db)).toBe('approved');

    // The creator posts and the brand verifies → now it is paid.
    db.submissions[0] = { ...db.submissions[0], permalink: 'https://instagram.com/p/live' };
    expect(computeCollabStage(camp.id, creator.id, db)).toBe('paid');
  });

  it('and a closed campaign alone never makes a deal paid', () => {
    // The old rule made closure necessary; it was never sufficient, and it is
    // now not required either. Closing a campaign is admin, not payment.
    const facts = {
      hasInvite: false, hasLiveApplication: false, hasLiveOffer: false,
      hasAcceptedOffer: true, hasAnySignal: true, allSignalsDead: false,
      slotCount: 1, anySlotOpen: false, allSlotsSettled: true,
      allSlotsLive: false, anySlotLive: false, payoutCleared: false,
      campaignClosed: true, escrowFrozen: false, cancelledAt: null,
    };
    expect(explainStage('paid', facts).violations.length).toBeGreaterThan(0);
  });

  it('every stage has a requirement function, so a tenth stage must declare one', () => {
    for (const s of ALL_STAGES) {
      expect(typeof STAGE_REQUIREMENTS[s], `${s} has no requirements`).toBe('function');
    }
  });
});

// ─────────────────────────────────────────────────────────────────────
// Whose move is it — and does the ball ever go missing?
// ─────────────────────────────────────────────────────────────────────
//
// The other half of Asim's ask: at every point, one side owes an action, and
// it must be the side that can actually perform it. A stage with no owner is
// a deal that stops moving with nobody told; a stage whose owner cannot act
// is worse, because the product is waiting on someone it never asked.
//
// `nextAction.ts` owns this and is keyed `Record<V2CollabStage, Resolver>`, so
// a new stage is a compile error there. What that cannot check is whether the
// owner it names makes SENSE for the stage, which is what these assert.

describe('every stage has an owner, and it is the side that can act', () => {
  it('resolves an owner for all nine stages', async () => {
    const { nextAction } = await import('@/screens/workspace-v2/nextAction');
    for (const stage of ALL_STAGES) {
      const na = nextAction(stage as never, {} as never);
      expect(na, `${stage} has no next action`).toBeTruthy();
      // The union is 'brand' | 'creator' | 'nobody' — read from nextAction.ts
      // rather than guessed. My first pass here asserted 'none' and failed.
      expect(['brand', 'creator', 'nobody'], `${stage} owner is not a valid party`)
        .toContain(na.owner);
    }
  });

  it('the party who owes the work owns the stages where work is owed', async () => {
    const { nextAction } = await import('@/screens/workspace-v2/nextAction');
    // `confirmed` means accepted with nothing submitted — the creator owes
    // content. `submitted` means it is in review — the brand owes a decision.
    expect(nextAction('confirmed' as never, {} as never).owner).toBe('creator');
    expect(nextAction('submitted' as never, {} as never).owner).toBe('brand');
  });

  it('terminal stages own nothing, because nobody owes anything', async () => {
    const { nextAction } = await import('@/screens/workspace-v2/nextAction');
    for (const stage of ['paid', 'cancelled'] as CollabStage[]) {
      expect(nextAction(stage as never, {} as never).owner, `${stage} should be terminal`).toBe('nobody');
    }
  });

  it('and no live stage is ownerless — that is a stalled deal nobody chases', async () => {
    const { nextAction } = await import('@/screens/workspace-v2/nextAction');
    const live: CollabStage[] = ['invited', 'pitched', 'negotiating', 'confirmed', 'submitted', 'approved', 'live'];
    for (const stage of live) {
      expect(nextAction(stage as never, {} as never).owner, `${stage} is live but ownerless`).not.toBe('nobody');
    }
  });
});
