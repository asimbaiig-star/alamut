// v2DisputeSplit.test.ts — WORKFLOW-GAPS F3: the parties settle a dispute
// between themselves, without an arbitrator.
//
// Weighted toward invariants rather than the happy path, and the one that
// matters most is CONSERVATION: released + refunded + fee + tax must equal
// exactly what was held. This codebase has already minted phantom dollars
// once, in the cancellation path, by crediting a full rate while debiting a
// clamped one — so every money path here gets that assertion.
//
// The second theme is AUTHORITY. A settlement is only meaningful because the
// other side agreed to it; a proposer who can accept their own proposal has
// just withdrawn escrow unilaterally. Several tests exist solely to keep that
// impossible.

import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from '@/lib/api/store';
import {
  v2RaiseDispute,
  v2ProposeDisputeSplit,
  v2AgreeDisputeSplit,
  v2DeclineDisputeSplit,
  v2WithdrawDisputeSplit,
  v2DisputeSettleableAmount,
  v2ResolveDispute,
} from '../v2DisputeActions';
import { v2ProposeSettlement } from '../v2CollabActions';
import { PLATFORM_FEE, WHT } from '@/lib/api/money';
import {
  buildDb, buildCampaign, buildCreator, buildBrand, buildOffer, buildSubmission,
} from '@/lib/utils/__tests__/fixtures';
import type { Collaboration, User } from '@/lib/api/types';

const HELD = 1500;

function userBrand(id: string, brandId: string): User {
  return {
    id, email: `${id}@b.com`, passwordHash: 'demo', role: 'brand',
    status: 'active', createdAt: '2026-04-01T00:00:00Z', brandId, teamRole: 'admin',
  };
}
function userCreator(id: string, creatorId: string): User {
  return {
    id, email: `${id}@c.com`, passwordHash: 'demo', role: 'creator',
    status: 'active', createdAt: '2026-04-01T00:00:00Z', creatorId,
  };
}
function userAdmin(id: string): User {
  return {
    id, email: `${id}@admin.com`, passwordHash: 'demo', role: 'admin',
    status: 'active', createdAt: '2026-04-01T00:00:00Z', adminRoles: ['super'],
  };
}

function makeCollab(): Collaboration {
  return {
    id: 'col_1', campaignId: 'cmp_1', creatorId: 'cr_1', brandId: 'br_1',
    stage: 'submitted', createdAt: 1745000000000, updatedAt: 1745000000000,
    agreedRate: HELD, acceptedOfferId: 'off_1', contractId: null,
    cancelledAt: null, cancellationReason: null, history: [],
  };
}

function setupDb() {
  return buildDb({
    users: [
      userBrand('u_brand', 'br_1'),
      userCreator('u_creator', 'cr_1'),
      userAdmin('u_admin'),
      // A second creator, on no deal here — used for the outsider check.
      userCreator('u_stranger', 'cr_2'),
    ],
    creators: [
      buildCreator({ id: 'cr_1', userId: 'u_creator', pendingBalance: 1275, walletBalance: 0 }),
      buildCreator({ id: 'cr_2', userId: 'u_stranger' }),
    ],
    brands: [buildBrand({ id: 'br_1', userId: 'u_brand', escrowHeld: HELD, walletBalance: 0 })],
    campaigns: [buildCampaign({ id: 'cmp_1', brandId: 'br_1', escrowHeld: HELD })],
    offers: [buildOffer({ id: 'off_1', campaignId: 'cmp_1', creatorId: 'cr_1', rate: HELD, status: 'accepted' })],
    submissions: [buildSubmission({ id: 'sub_1', campaignId: 'cmp_1', creatorId: 'cr_1', status: 'in_review' })],
    collaborations: [makeCollab()],
  });
}

/** Raise a dispute and return its id. */
function openDispute(byUserId = 'u_creator'): string {
  const d = v2RaiseDispute({
    collaborationId: 'col_1',
    raisedByUserId: byUserId,
    category: 'quality',
    description: 'Three of four deliverables landed.',
  });
  return d!.id;
}

beforeEach(() => {
  useStore.getState().setDB(setupDb());
  useStore.getState().setSession(null);
});

describe('proposing a split', () => {
  it('reports what is actually on the table', () => {
    const id = openDispute();
    expect(v2DisputeSettleableAmount(id)).toBe(HELD);
  });

  it('records the offer without moving a cent', () => {
    const id = openDispute();
    v2ProposeDisputeSplit(id, 900, 'Three of four landed.', 'u_brand');

    const db = useStore.getState().db;
    expect(db.disputes[0].proposal).toMatchObject({ by: 'u_brand', releaseToCreator: 900 });
    // Nothing moves on a proposal — that is the entire distinction between
    // proposing and agreeing.
    expect(db.campaigns[0].escrowHeld).toBe(HELD);
    expect(db.brands[0].walletBalance).toBe(0);
    expect(db.creators[0].walletBalance).toBe(0);
    expect(db.transactions.length).toBe(0);
    expect(db.disputes[0].status).toBe('open');
  });

  it('notifies the other side, not the proposer', () => {
    const id = openDispute();
    const before = useStore.getState().db.notifications.length;
    v2ProposeDisputeSplit(id, 900, 'note', 'u_brand');
    const fresh = useStore.getState().db.notifications.slice(before);
    expect(fresh.some((n) => n.userId === 'u_creator')).toBe(true);
    expect(fresh.some((n) => n.userId === 'u_brand')).toBe(false);
  });

  it('refuses an amount above what is held', () => {
    const id = openDispute();
    expect(() => v2ProposeDisputeSplit(id, HELD + 1, 'note', 'u_brand'))
      .toThrow(/between \$0 and/);
  });

  it('refuses a negative amount', () => {
    const id = openDispute();
    expect(() => v2ProposeDisputeSplit(id, -100, 'note', 'u_brand'))
      .toThrow(/between \$0 and/);
  });

  it('requires a note — the other side has to judge the offer', () => {
    const id = openDispute();
    expect(() => v2ProposeDisputeSplit(id, 900, '   ', 'u_brand'))
      .toThrow(/Add a note/);
  });

  it('refuses a second proposal while one is live', () => {
    const id = openDispute();
    v2ProposeDisputeSplit(id, 900, 'note', 'u_brand');
    expect(() => v2ProposeDisputeSplit(id, 700, 'other', 'u_creator'))
      .toThrow(/already on the table/);
  });

  it('refuses someone who is not on the deal', () => {
    const id = openDispute();
    expect(() => v2ProposeDisputeSplit(id, 900, 'note', 'u_stranger'))
      .toThrow(/Only the brand or the creator/);
  });

  it('refuses an admin — they impose a resolution, they do not offer one', () => {
    // Otherwise a party could "agree" to an arbitrator's proposal, which is
    // neither a settlement nor a ruling.
    const id = openDispute();
    expect(() => v2ProposeDisputeSplit(id, 900, 'note', 'u_admin'))
      .toThrow(/Only the brand or the creator/);
  });

  it('refuses once the dispute is resolved', () => {
    const id = openDispute();
    useStore.getState().setSession({ userId: 'u_admin' } as never);
    v2ResolveDispute(id, {
      status: 'resolved-refund', resolvedByUserId: 'u_admin',
      note: 'ruled', refundAmount: HELD,
    });
    expect(() => v2ProposeDisputeSplit(id, 900, 'note', 'u_brand'))
      .toThrow(/already resolved/);
  });
});

describe('agreeing to a split', () => {
  it('moves money, and it conserves', () => {
    const id = openDispute();
    v2ProposeDisputeSplit(id, 900, 'Three of four landed.', 'u_brand');
    v2AgreeDisputeSplit(id, 'u_creator');

    const db = useStore.getState().db;
    const release = 900;
    const refund = HELD - release;
    const fee = Math.round(release * PLATFORM_FEE);
    const tax = Math.round(release * WHT);

    // Escrow fully cleared on both sides.
    expect(db.campaigns[0].escrowHeld).toBe(0);
    expect(db.brands[0].escrowHeld).toBe(0);
    // Brand got the unreleased remainder back.
    expect(db.brands[0].walletBalance).toBe(refund);
    // Creator got the release, net of deductions.
    expect(db.creators[0].walletBalance).toBe(release - fee - tax);

    // THE INVARIANT: nothing was created and nothing vanished.
    expect(db.creators[0].walletBalance + fee + tax + refund).toBe(HELD);
  });

  it("the creator's ledger rows sum to what their wallet gained", () => {
    const id = openDispute();
    v2ProposeDisputeSplit(id, 900, 'note', 'u_brand');
    v2AgreeDisputeSplit(id, 'u_creator');

    const db = useStore.getState().db;
    const creatorRows = db.transactions.filter((t) => t.userId === 'u_creator');
    const sum = creatorRows.reduce((s, t) => s + t.amount, 0);
    expect(sum).toBe(db.creators[0].walletBalance);
    // The payout row carries GROSS, with the deductions doing real work —
    // the convention every other release in this codebase follows.
    expect(creatorRows.find((t) => t.kind === 'payout')?.amount).toBe(900);
  });

  it('resolves the dispute and unfreezes escrow', () => {
    const id = openDispute();
    v2ProposeDisputeSplit(id, 900, 'note', 'u_brand');
    v2AgreeDisputeSplit(id, 'u_creator');

    const db = useStore.getState().db;
    expect(db.disputes[0].status).toBe('resolved-partial');
    expect(db.disputes[0].proposal).toBeNull();
    expect(db.disputes[0].resolution?.by).toBe('u_creator');
    expect(db.collaborations[0].escrowFrozen).toBe(false);
  });

  it('records the outcome truthfully at the extremes, not a blanket "partial"', () => {
    // All to the creator IS a release; all back IS a refund. Metrics and the
    // admin queue read `status`, so it has to mean what it says.
    const id = openDispute();
    v2ProposeDisputeSplit(id, HELD, 'all theirs', 'u_brand');
    v2AgreeDisputeSplit(id, 'u_creator');
    expect(useStore.getState().db.disputes[0].status).toBe('resolved-release');

    useStore.getState().setDB(setupDb());
    const id2 = openDispute();
    v2ProposeDisputeSplit(id2, 0, 'nothing delivered', 'u_creator');
    v2AgreeDisputeSplit(id2, 'u_brand');
    expect(useStore.getState().db.disputes[0].status).toBe('resolved-refund');
  });

  it('a full refund kills the deal rather than leaving a zombie', () => {
    // The offer must be withdrawn for computeCollabStage to reach 'cancelled';
    // without it the collab parks at 'submitted' forever on both kanbans.
    const id = openDispute();
    v2ProposeDisputeSplit(id, 0, 'nothing delivered', 'u_creator');
    v2AgreeDisputeSplit(id, 'u_brand');
    const db = useStore.getState().db;
    expect(db.offers[0].status).toBe('withdrawn');
  });

  it('THE PROPOSER CANNOT AGREE TO THEIR OWN PROPOSAL', () => {
    // Without this, a settlement is a unilateral escrow withdrawal wearing a
    // handshake's clothes.
    const id = openDispute();
    v2ProposeDisputeSplit(id, 900, 'note', 'u_brand');
    expect(() => v2AgreeDisputeSplit(id, 'u_brand'))
      .toThrow(/You proposed this settlement/);
    // And nothing moved on the failed attempt.
    expect(useStore.getState().db.campaigns[0].escrowHeld).toBe(HELD);
  });

  it('an outsider cannot agree on a party\'s behalf', () => {
    const id = openDispute();
    v2ProposeDisputeSplit(id, 900, 'note', 'u_brand');
    expect(() => v2AgreeDisputeSplit(id, 'u_stranger'))
      .toThrow(/Only the brand or the creator/);
    expect(useStore.getState().db.campaigns[0].escrowHeld).toBe(HELD);
  });

  it('refuses when there is nothing to agree to', () => {
    const id = openDispute();
    expect(() => v2AgreeDisputeSplit(id, 'u_creator'))
      .toThrow(/no settlement proposal/);
  });

  it('re-clamps if escrow shrank between proposal and agreement', () => {
    // The proposal is not a lock on the money. If escrow moved, the agreement
    // settles what is actually there — never more.
    const id = openDispute();
    v2ProposeDisputeSplit(id, HELD, 'all of it', 'u_brand');

    useStore.setState((s) => ({
      ...s,
      db: {
        ...s.db,
        campaigns: s.db.campaigns.map((c) => ({ ...c, escrowHeld: 400 })),
      },
    }));

    v2AgreeDisputeSplit(id, 'u_creator');
    const db = useStore.getState().db;
    const fee = Math.round(400 * PLATFORM_FEE);
    const tax = Math.round(400 * WHT);
    expect(db.creators[0].walletBalance).toBe(400 - fee - tax);
    // Still conserves, against the smaller pot.
    expect(db.creators[0].walletBalance + fee + tax).toBe(400);
  });

  it('agreeing twice does not pay twice', () => {
    const id = openDispute();
    v2ProposeDisputeSplit(id, 900, 'note', 'u_brand');
    v2AgreeDisputeSplit(id, 'u_creator');
    const after = useStore.getState().db.creators[0].walletBalance;
    expect(() => v2AgreeDisputeSplit(id, 'u_creator')).toThrow();
    expect(useStore.getState().db.creators[0].walletBalance).toBe(after);
  });
});

describe('declining and withdrawing', () => {
  it('declining clears the offer, keeps the dispute open, moves nothing', () => {
    const id = openDispute();
    v2ProposeDisputeSplit(id, 900, 'note', 'u_brand');
    v2DeclineDisputeSplit(id, 'u_creator', 'too low');

    const db = useStore.getState().db;
    expect(db.disputes[0].proposal).toBeNull();
    expect(db.disputes[0].status).toBe('open');
    expect(db.campaigns[0].escrowHeld).toBe(HELD);
    expect(db.transactions.length).toBe(0);
    // The proposer learns why.
    expect(db.notifications.some((n) => n.userId === 'u_brand' && /declined/.test(n.text))).toBe(true);
  });

  it('a decline reopens the floor for a counter-offer', () => {
    const id = openDispute();
    v2ProposeDisputeSplit(id, 900, 'note', 'u_brand');
    v2DeclineDisputeSplit(id, 'u_creator');
    // The other side can now propose their own number.
    v2ProposeDisputeSplit(id, 1200, 'counter', 'u_creator');
    expect(useStore.getState().db.disputes[0].proposal?.releaseToCreator).toBe(1200);
  });

  it('you cannot decline your own proposal — withdraw it', () => {
    const id = openDispute();
    v2ProposeDisputeSplit(id, 900, 'note', 'u_brand');
    expect(() => v2DeclineDisputeSplit(id, 'u_brand')).toThrow(/withdraw it/);
  });

  it('you cannot withdraw the other side\'s proposal', () => {
    const id = openDispute();
    v2ProposeDisputeSplit(id, 900, 'note', 'u_brand');
    expect(() => v2WithdrawDisputeSplit(id, 'u_creator')).toThrow(/decline it instead/);
  });

  it('withdrawing clears your own offer', () => {
    const id = openDispute();
    v2ProposeDisputeSplit(id, 900, 'note', 'u_brand');
    v2WithdrawDisputeSplit(id, 'u_brand');
    expect(useStore.getState().db.disputes[0].proposal).toBeNull();
  });
});

describe('the two settlement paths do not collide', () => {
  it('an admin ruling clears a proposal the parties were still discussing', () => {
    const id = openDispute();
    v2ProposeDisputeSplit(id, 900, 'note', 'u_brand');

    useStore.getState().setSession({ userId: 'u_admin' } as never);
    v2ResolveDispute(id, {
      status: 'resolved-release', resolvedByUserId: 'u_admin',
      note: 'ruled for the creator', releaseAmount: HELD,
    });

    const db = useStore.getState().db;
    expect(db.disputes[0].proposal).toBeNull();
    expect(db.disputes[0].resolution?.by).toBe('u_admin');
  });

  it('F1 settlement stays blocked while a dispute freezes escrow, and says where to go', () => {
    // The two handshakes must not both be live on the same money. F1 defers
    // to the dispute — and now names the door that actually exists.
    openDispute();
    expect(() => v2ProposeSettlement('col_1', 900, 'note', 'u_brand'))
      .toThrow(/inside the dispute/);
  });
});
