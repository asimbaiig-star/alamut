// v2DisputeActions.test.ts — P2 §1.4 dispute lifecycle.
//
// Covers raise / withdraw / resolve mutations, escrow-frozen lifecycle,
// money-correctness invariants on each resolution path, and the
// regression for FIX #3 (post-P6 audit): `v2ResolveDispute` must call
// `ensureCollabState` after the release path so `Collaboration.stage`
// transitions to 'paid' instead of staying at the pre-resolve value.

import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from '@/lib/api/store';
import {
  v2RaiseDispute, v2WithdrawDispute, v2ResolveDispute,
} from '../v2DisputeActions';
import {
  buildDb, buildCampaign, buildCreator, buildBrand, buildOffer, buildSubmission,
} from '@/lib/utils/__tests__/fixtures';
import type { Collaboration, Contract, User } from '@/lib/api/types';

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

function makeCollab(stage: Collaboration['stage'] = 'submitted'): Collaboration {
  return {
    id: 'col_1', campaignId: 'cmp_1', creatorId: 'cr_1', brandId: 'br_1',
    stage, createdAt: 1745000000000, updatedAt: 1745000000000,
    agreedRate: 1500, acceptedOfferId: 'off_1', contractId: 'ctr_1',
    cancelledAt: null, cancellationReason: null, history: [],
  };
}
function makeContract(): Contract {
  return {
    id: 'ctr_1', collaborationId: 'col_1', campaignId: 'cmp_1',
    creatorId: 'cr_1', brandId: 'br_1', agreedRate: 1500,
    netToCreator: 1275, platformFee: 150, withholdingTax: 75,
    deliverables: [], briefSnapshot: 'snap', briefSnapshotAt: 1745000000000,
    acceptedAt: 1745000000000, acceptedByUserId: 'u_creator',
    status: 'active', fulfilledAt: null, cancelledAt: null,
  };
}

function setupDb(stage: Collaboration['stage'] = 'submitted') {
  return buildDb({
    users: [userBrand('u_brand', 'br_1'), userCreator('u_creator', 'cr_1'), userAdmin('u_admin')],
    creators: [buildCreator({ id: 'cr_1', userId: 'u_creator', pendingBalance: 1275, walletBalance: 0 })],
    brands: [buildBrand({ id: 'br_1', userId: 'u_brand', escrowHeld: 1500, walletBalance: 0 })],
    campaigns: [buildCampaign({ id: 'cmp_1', brandId: 'br_1', escrowHeld: 1500 })],
    offers: [buildOffer({ id: 'off_1', campaignId: 'cmp_1', creatorId: 'cr_1', rate: 1500, status: 'accepted' })],
    submissions: [buildSubmission({ id: 'sub_1', campaignId: 'cmp_1', creatorId: 'cr_1', status: 'in_review' })],
    collaborations: [makeCollab(stage)],
    contracts: [makeContract()],
  });
}

describe('v2RaiseDispute', () => {
  beforeEach(() => {
    useStore.getState().setDB(setupDb());
    useStore.getState().setSession(null);
  });

  it('creates a Dispute row + sets escrowFrozen on the collab', () => {
    const result = v2RaiseDispute({
      collaborationId: 'col_1',
      raisedByUserId: 'u_creator',
      category: 'quality',
      description: 'Brand stalling on review for 9 days',
    });
    expect(result).toBeDefined();
    const db = useStore.getState().db;
    expect(db.disputes.length).toBe(1);
    expect(db.disputes[0].status).toBe('open');
    expect(db.disputes[0].category).toBe('quality');
    expect(db.disputes[0].raisedByRole).toBe('creator');
    expect(db.collaborations[0].escrowFrozen).toBe(true);
  });

  it('raisedByRole derived from raiser user (brand-side raise)', () => {
    v2RaiseDispute({
      collaborationId: 'col_1',
      raisedByUserId: 'u_brand',
      category: 'non-delivery',
      description: 'Creator hasn\'t delivered',
    });
    const db = useStore.getState().db;
    expect(db.disputes[0].raisedByRole).toBe('brand');
  });

  it('notifies the counterparty + every admin', () => {
    v2RaiseDispute({
      collaborationId: 'col_1',
      raisedByUserId: 'u_creator',
      category: 'quality',
      description: 'reason',
    });
    const db = useStore.getState().db;
    const brandNotifs = db.notifications.filter((n) => n.userId === 'u_brand');
    const adminNotifs = db.notifications.filter((n) => n.userId === 'u_admin');
    expect(brandNotifs.length).toBeGreaterThanOrEqual(1);
    expect(adminNotifs.length).toBeGreaterThanOrEqual(1);
  });
});

describe('v2WithdrawDispute', () => {
  beforeEach(() => {
    useStore.getState().setDB(setupDb());
    useStore.getState().setSession(null);
  });

  it('clears escrowFrozen when raiser withdraws', () => {
    v2RaiseDispute({
      collaborationId: 'col_1',
      raisedByUserId: 'u_creator',
      category: 'quality',
      description: 'reason',
    });
    expect(useStore.getState().db.collaborations[0].escrowFrozen).toBe(true);

    const dispId = useStore.getState().db.disputes[0].id;
    v2WithdrawDispute(dispId, 'u_creator');

    const db = useStore.getState().db;
    expect(db.disputes[0].status).toBe('withdrawn');
    expect(db.collaborations[0].escrowFrozen).toBe(false);
  });

  it('rejects withdrawal by anyone other than the raiser', () => {
    v2RaiseDispute({
      collaborationId: 'col_1',
      raisedByUserId: 'u_creator',
      category: 'quality',
      description: 'reason',
    });
    const dispId = useStore.getState().db.disputes[0].id;
    // P63 — now throws with a clear "only the raiser can withdraw" message
    // instead of silently no-oping. Store state must still be untouched.
    expect(() => v2WithdrawDispute(dispId, 'u_brand')).toThrow(
      /only the person who raised this dispute/i,
    );

    const db = useStore.getState().db;
    expect(db.disputes[0].status).toBe('open'); // still open
    expect(db.collaborations[0].escrowFrozen).toBe(true);
  });
});

describe('v2ResolveDispute — release path (full to creator)', () => {
  beforeEach(() => {
    useStore.getState().setDB(setupDb());
    useStore.getState().setSession(null);
    v2RaiseDispute({
      collaborationId: 'col_1',
      raisedByUserId: 'u_creator',
      category: 'quality',
      description: 'reason',
    });
  });

  it('moves money to creator wallet (net of fees) + clears escrowFrozen', () => {
    const dispId = useStore.getState().db.disputes[0].id;
    v2ResolveDispute(dispId, {
      status: 'resolved-release',
      resolvedByUserId: 'u_admin',
      note: 'Creator was right; release the full escrow.',
      releaseAmount: 1500,
    });

    const db = useStore.getState().db;
    const creator = db.creators[0];
    // Net of 10% platform + 5% WHT = 1275
    expect(creator.walletBalance).toBe(1275);
    expect(creator.lifetimeEarnings).toBe(1275);
    expect(creator.pendingBalance).toBe(0); // 1275 - 1275

    // Escrow drained from campaign + brand
    expect(db.campaigns[0].escrowHeld).toBe(0);
    expect(db.brands[0].escrowHeld).toBe(0);

    // Collab unfrozen
    expect(db.collaborations[0].escrowFrozen).toBe(false);
  });

  it('FIX #3 regression: Collaboration.stage transitions to "approved" via ensureCollabState', () => {
    // Pre-P6 audit fix: v2ResolveDispute pushed a payout but skipped
    // ensureCollabState, leaving collab.stage at 'submitted' even
    // though the runtime recompute would say a different stage.
    //
    // Workflow-audit fix layered on top: 'paid' is no longer triggered
    // by payout alone — it now requires campaign closed + post live.
    // Resolving a dispute in favor of the creator (with the campaign
    // still live and no permalink yet) lands the collab at 'approved':
    // dispute resolution implicitly marks the submission approved
    // (admin overrode the brand's hold), and the post hasn't been
    // marked live yet.
    expect(useStore.getState().db.collaborations[0].stage).toBe('submitted');

    const dispId = useStore.getState().db.disputes[0].id;
    v2ResolveDispute(dispId, {
      status: 'resolved-release',
      resolvedByUserId: 'u_admin',
      note: 'Release.',
      releaseAmount: 1500,
    });

    const db = useStore.getState().db;
    expect(db.collaborations[0].stage).toBe('approved');
    // Submission was flipped to approved as part of the resolution.
    expect(db.submissions[0].status).toBe('approved');
  });

  it('does not auto-fulfill the contract on dispute release while campaign is live', () => {
    // Pre-fix, dispute release flipped the collab stage to 'paid' and
    // the contract immediately marked fulfilled. Post-fix, the contract
    // only fulfills once the deal terminates (campaign closes + post
    // is live). On a live campaign with no permalink, the contract
    // stays 'active' even after a dispute-release payout.
    const dispId = useStore.getState().db.disputes[0].id;
    v2ResolveDispute(dispId, {
      status: 'resolved-release',
      resolvedByUserId: 'u_admin',
      note: 'Release.',
      releaseAmount: 1500,
    });
    const contract = useStore.getState().db.contracts[0];
    expect(contract.status).toBe('active');
    expect(contract.fulfilledAt).toBeNull();
  });

  it('writes balanced ledger entries (escrow_release + payout + fee + tax)', () => {
    const dispId = useStore.getState().db.disputes[0].id;
    v2ResolveDispute(dispId, {
      status: 'resolved-release',
      resolvedByUserId: 'u_admin',
      note: 'Release.',
      releaseAmount: 1500,
    });
    const db = useStore.getState().db;
    const txs = db.transactions.filter((t) => t.campaignId === 'cmp_1');
    expect(txs.find((t) => t.kind === 'escrow_release' && t.amount === -1500)).toBeDefined();
    // Payout is the GROSS release; the two negative rows are the real
    // deductions, so the creator's rows sum to what the wallet gained.
    expect(txs.find((t) => t.kind === 'payout' && t.amount === 1500)).toBeDefined();
    expect(txs.find((t) => t.kind === 'fee' && t.amount === -150)).toBeDefined();
    expect(txs.find((t) => t.kind === 'fee' && t.amount === -75)).toBeDefined();
    const creatorRows = txs
      .filter((t) => t.userId === 'u_creator')
      .reduce((sum, t) => sum + t.amount, 0);
    expect(creatorRows).toBe(1275);
  });
});

describe('v2ResolveDispute — refund path (full to brand)', () => {
  beforeEach(() => {
    useStore.getState().setDB(setupDb());
    useStore.getState().setSession(null);
    v2RaiseDispute({
      collaborationId: 'col_1',
      raisedByUserId: 'u_brand',
      category: 'non-delivery',
      description: 'Creator never delivered',
    });
  });

  it('moves money to brand wallet (full escrow refund)', () => {
    const dispId = useStore.getState().db.disputes[0].id;
    v2ResolveDispute(dispId, {
      status: 'resolved-refund',
      resolvedByUserId: 'u_admin',
      note: 'Brand wins.',
      refundAmount: 1500,
    });
    const brand = useStore.getState().db.brands[0];
    expect(brand.walletBalance).toBe(1500);
    expect(brand.escrowHeld).toBe(0);
  });

  it('does NOT credit creator wallet on refund path', () => {
    const dispId = useStore.getState().db.disputes[0].id;
    v2ResolveDispute(dispId, {
      status: 'resolved-refund',
      resolvedByUserId: 'u_admin',
      note: 'Brand wins.',
      refundAmount: 1500,
    });
    const creator = useStore.getState().db.creators[0];
    expect(creator.walletBalance).toBe(0);
    expect(creator.lifetimeEarnings).toBe(0);
  });

  it('writes a single refund transaction', () => {
    const dispId = useStore.getState().db.disputes[0].id;
    v2ResolveDispute(dispId, {
      status: 'resolved-refund',
      resolvedByUserId: 'u_admin',
      note: 'Brand wins.',
      refundAmount: 1500,
    });
    const refund = useStore.getState().db.transactions.find((t) => t.kind === 'refund' && t.amount === 1500);
    expect(refund).toBeDefined();
  });
});

describe('v2ResolveDispute — partial path (split)', () => {
  beforeEach(() => {
    useStore.getState().setDB(setupDb());
    useStore.getState().setSession(null);
    v2RaiseDispute({
      collaborationId: 'col_1',
      raisedByUserId: 'u_creator',
      category: 'quality',
      description: 'Partial fault on both sides',
    });
  });

  it('splits the escrow per the partial amounts', () => {
    const dispId = useStore.getState().db.disputes[0].id;
    v2ResolveDispute(dispId, {
      status: 'resolved-partial',
      resolvedByUserId: 'u_admin',
      note: '50/50 split.',
      releaseAmount: 750,
      refundAmount: 750,
    });
    const db = useStore.getState().db;
    const brand = db.brands[0];
    const creator = db.creators[0];

    // Brand gets the refund half back
    expect(brand.walletBalance).toBe(750);
    // Creator gets the release-half net of fees:
    // fee = Math.round(750 * 0.10) = 75, tax = Math.round(750 * 0.05) = 38 (37.5 rounds up)
    // net = 750 - 75 - 38 = 637
    expect(creator.walletBalance).toBe(637);
  });

  it('FIX #3 regression also fires on partial path (collab.stage transitions correctly)', () => {
    const dispId = useStore.getState().db.disputes[0].id;
    v2ResolveDispute(dispId, {
      status: 'resolved-partial',
      resolvedByUserId: 'u_admin',
      note: 'Split.',
      releaseAmount: 750,
      refundAmount: 750,
    });
    // Workflow-audit fix: a partial release still pushes a payout +
    // approves the submission, so the collab transitions to 'approved'
    // (post-publication state arrives later via mark-live, and 'paid'
    // is gated on campaign close).
    expect(useStore.getState().db.collaborations[0].stage).toBe('approved');
    expect(useStore.getState().db.submissions[0].status).toBe('approved');
  });
});

describe('v2ResolveDispute — already-resolved guard', () => {
  beforeEach(() => {
    useStore.getState().setDB(setupDb());
    useStore.getState().setSession(null);
    v2RaiseDispute({
      collaborationId: 'col_1',
      raisedByUserId: 'u_creator',
      category: 'quality',
      description: 'reason',
    });
  });

  it('does not double-resolve a closed case', () => {
    const dispId = useStore.getState().db.disputes[0].id;
    v2ResolveDispute(dispId, {
      status: 'resolved-refund',
      resolvedByUserId: 'u_admin',
      note: 'first resolution',
      refundAmount: 1500,
    });
    const brandWalletAfterFirst = useStore.getState().db.brands[0].walletBalance;

    // Try to resolve again — should be a no-op.
    v2ResolveDispute(dispId, {
      status: 'resolved-release',
      resolvedByUserId: 'u_admin',
      note: 'second resolution',
      releaseAmount: 1500,
    });

    // Brand wallet unchanged from the first resolution.
    expect(useStore.getState().db.brands[0].walletBalance).toBe(brandWalletAfterFirst);
    // Resolution note should still reflect the first resolution (the
    // second call short-circuits via the already-resolved guard).
    expect(useStore.getState().db.disputes[0].resolution?.note).toBe('first resolution');
  });
});
