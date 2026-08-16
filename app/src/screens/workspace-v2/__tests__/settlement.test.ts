// settlement.test.ts — splitting escrow when a deal ends half-delivered.
//
// Cancellation is all-or-nothing: escrow returns to the brand. That is the
// wrong answer when a creator delivered 3 of 4 slots and went quiet — the work
// exists, someone has to be paid for it, and the fourth slot sat forever with
// the money frozen behind it.
//
// It requires BOTH parties (Asim's call). The escrow is money both have a
// claim on, so the tests that matter most are not the happy path — they are
// the ones proving nobody can move it alone, and that no dollar is invented or
// lost in the split.

import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from '@/lib/api/store';
import {
  v2ProposeSettlement, v2AgreeSettlement, v2DeclineSettlement, v2SettleableAmount,
} from '../v2CollabActions';
import { splitGross, netOf } from '@/lib/api/money';
import { computeCollabStage } from '@/lib/api/collabSync';
import {
  buildDb, buildCampaign, buildCreator, buildBrand, buildOffer,
} from '@/lib/utils/__tests__/fixtures';
import type { User, Collaboration } from '@/lib/api/types';

const HELD = 2000;
const BRAND_WALLET = 5000;

const userBrand: User = {
  id: 'u_brand', email: 'b@b.com', passwordHash: 'demo', role: 'brand',
  status: 'active', createdAt: '2026-01-01T00:00:00Z', brandId: 'br_1', teamRole: 'admin',
};
const userCreator: User = {
  id: 'u_creator', email: 'c@c.com', passwordHash: 'demo', role: 'creator',
  status: 'active', createdAt: '2026-01-01T00:00:00Z', creatorId: 'cr_1',
};

function seed(patch: Partial<Collaboration> = {}) {
  const collab: Collaboration = {
    id: 'col_1', campaignId: 'cmp_1', creatorId: 'cr_1', brandId: 'br_1',
    stage: 'submitted', createdAt: 1745000000000, updatedAt: 1745000000000,
    agreedRate: HELD, acceptedOfferId: 'off_1', contractId: null,
    cancelledAt: null, cancellationReason: null, history: [], ...patch,
  };
  useStore.getState().setDB(buildDb({
    users: [userBrand, userCreator],
    creators: [buildCreator({
      id: 'cr_1', userId: 'u_creator',
      walletBalance: 0, pendingBalance: netOf(HELD), lifetimeEarnings: 0,
    })],
    brands: [buildBrand({ id: 'br_1', userId: 'u_brand', escrowHeld: HELD, walletBalance: BRAND_WALLET })],
    campaigns: [buildCampaign({ id: 'cmp_1', brandId: 'br_1', stage: 'live', escrowHeld: HELD, spent: 0 })],
    offers: [buildOffer({ id: 'off_1', campaignId: 'cmp_1', creatorId: 'cr_1', rate: HELD, status: 'accepted' })],
    collaborations: [collab],
  }));
  useStore.getState().setSession({ userId: 'u_brand', issuedAt: new Date().toISOString() });
}

describe('nobody settles alone', () => {
  beforeEach(() => seed());

  it('the proposer cannot accept their own proposal', () => {
    // Without this, a "settlement" is a unilateral escrow withdrawal wearing
    // a handshake's clothes.
    v2ProposeSettlement('col_1', 1200, '3 of 4 delivered', 'u_brand');
    expect(() => v2AgreeSettlement('col_1', 'u_brand')).toThrow(/other side has to agree/i);
  });

  it('the other party can', () => {
    v2ProposeSettlement('col_1', 1200, '3 of 4 delivered', 'u_brand');
    const c = v2AgreeSettlement('col_1', 'u_creator');
    expect(c.cancelledAt).toBeTruthy();
  });

  it('either side may PROPOSE — a creator can offer to hand money back', () => {
    v2ProposeSettlement('col_1', 800, 'I only got two of them done', 'u_creator');
    expect(useStore.getState().db.collaborations[0].settlementProposal?.by).toBe('u_creator');
  });

  it('declining clears the proposal and moves nothing', () => {
    v2ProposeSettlement('col_1', 1200, 'note', 'u_brand');
    v2DeclineSettlement('col_1', 'u_creator', 'too low');
    const db = useStore.getState().db;
    expect(db.collaborations[0].settlementProposal).toBeNull();
    expect(db.brands[0].escrowHeld).toBe(HELD);
    expect(db.creators[0].walletBalance).toBe(0);
  });

  it('refuses a second proposal while one is live', () => {
    v2ProposeSettlement('col_1', 1200, 'note', 'u_brand');
    expect(() => v2ProposeSettlement('col_1', 900, 'other', 'u_creator')).toThrow(/already on the table/i);
  });
});

describe('the split is exact — no dollar invented or lost', () => {
  beforeEach(() => seed());

  it('releases gross to the creator and refunds the remainder', () => {
    v2ProposeSettlement('col_1', 1200, '3 of 4 delivered', 'u_brand');
    v2AgreeSettlement('col_1', 'u_creator');
    const db = useStore.getState().db;
    const { net } = splitGross(1200);
    expect(db.creators[0].walletBalance).toBe(net);
    expect(db.brands[0].walletBalance).toBe(BRAND_WALLET + 800);
  });

  it('clears the escrow hold completely on both sides', () => {
    v2ProposeSettlement('col_1', 1200, 'note', 'u_brand');
    v2AgreeSettlement('col_1', 'u_creator');
    const db = useStore.getState().db;
    expect(db.brands[0].escrowHeld).toBe(0);
    expect(db.campaigns[0].escrowHeld).toBe(0);
    expect(db.creators[0].pendingBalance).toBe(0);
  });

  it('conserves value: released gross + refund === what was held', () => {
    // The invariant that catches a phantom-dollar bug, which this codebase has
    // already had once in the cancellation path.
    v2ProposeSettlement('col_1', 750, 'note', 'u_brand');
    v2AgreeSettlement('col_1', 'u_creator');
    const db = useStore.getState().db;
    const refunded = db.brands[0].walletBalance - BRAND_WALLET;
    const { net, fee, tax } = splitGross(750);
    expect(refunded + net + fee + tax).toBe(HELD);
  });

  it("writes a ledger whose creator rows sum to the creator's gain", () => {
    v2ProposeSettlement('col_1', 1200, 'note', 'u_brand');
    v2AgreeSettlement('col_1', 'u_creator');
    const db = useStore.getState().db;
    const creatorRows = db.transactions
      .filter((t) => t.userId === 'u_creator')
      .reduce((s, t) => s + t.amount, 0);
    expect(creatorRows).toBe(db.creators[0].walletBalance);
  });

  it('handles an all-to-brand settlement (creator delivered nothing usable)', () => {
    v2ProposeSettlement('col_1', 0, 'nothing delivered', 'u_brand');
    v2AgreeSettlement('col_1', 'u_creator');
    const db = useStore.getState().db;
    expect(db.brands[0].walletBalance).toBe(BRAND_WALLET + HELD);
    expect(db.creators[0].walletBalance).toBe(0);
  });

  it('handles an all-to-creator settlement', () => {
    v2ProposeSettlement('col_1', HELD, 'they did the work, we changed our mind', 'u_brand');
    v2AgreeSettlement('col_1', 'u_creator');
    const db = useStore.getState().db;
    expect(db.creators[0].walletBalance).toBe(netOf(HELD));
    expect(db.brands[0].walletBalance).toBe(BRAND_WALLET);
  });
});

describe('guards', () => {
  beforeEach(() => seed());

  it('refuses more than is actually held', () => {
    expect(() => v2ProposeSettlement('col_1', HELD + 1, 'note', 'u_brand')).toThrow(/between \$0 and/i);
  });

  it('refuses a negative amount', () => {
    expect(() => v2ProposeSettlement('col_1', -100, 'note', 'u_brand')).toThrow(/between \$0 and/i);
  });

  it('demands a note — the other side has to agree to it', () => {
    expect(() => v2ProposeSettlement('col_1', 900, '   ', 'u_brand')).toThrow(/note/i);
  });

  it('refuses while a dispute has frozen escrow', () => {
    // A split under dispute is the arbitrator's call, not the parties'.
    seed({ escrowFrozen: true });
    expect(() => v2ProposeSettlement('col_1', 900, 'note', 'u_brand')).toThrow(/frozen/i);
  });

  it('reports what is on the table', () => {
    expect(v2SettleableAmount('col_1')).toBe(HELD);
  });
});

describe('after settling', () => {
  beforeEach(() => seed());

  it('the deal is closed, not left half-open', () => {
    v2ProposeSettlement('col_1', 1200, 'note', 'u_brand');
    v2AgreeSettlement('col_1', 'u_creator');
    const db = useStore.getState().db;
    expect(computeCollabStage('cmp_1', 'cr_1', db)).toBe('cancelled');
    expect(db.offers[0].status).toBe('withdrawn');
  });

  it('records what was agreed, so the ledger can be explained later', () => {
    v2ProposeSettlement('col_1', 1200, 'note', 'u_brand');
    v2AgreeSettlement('col_1', 'u_creator');
    const c = useStore.getState().db.collaborations[0];
    expect(c.cancellationReason).toMatch(/settled/);
    expect(c.settlementProposal).toBeNull();
  });

  it('tells both parties', () => {
    v2ProposeSettlement('col_1', 1200, 'note', 'u_brand');
    v2AgreeSettlement('col_1', 'u_creator');
    const ns = useStore.getState().db.notifications.filter((n) => /settled/i.test(n.text));
    expect(ns.map((n) => n.userId).sort()).toEqual(['u_brand', 'u_creator']);
  });
});
