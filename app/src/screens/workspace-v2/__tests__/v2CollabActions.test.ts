// v2CollabActions.test.ts — P3 §2.3 cancel-collab mutual-consent flow.
//
// Covers: v2RequestCollabCancel + v2AgreeCollabCancel + v2DeclineCollabCancel.
// Each test sets up the live store with a known shape, calls the mutation,
// then asserts the resulting store state. Mutations write through `tx()`
// which goes through `useStore.setDB`, so tests read back from
// `useStore.getState().db` after the call.

import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from '@/lib/api/store';
import {
  v2RequestCollabCancel,
  v2AgreeCollabCancel,
  v2DeclineCollabCancel,
} from '../v2CollabActions';
import {
  buildDb, buildCampaign, buildCreator, buildBrand, buildOffer,
} from '@/lib/utils/__tests__/fixtures';
import type { Collaboration, Contract, User } from '@/lib/api/types';

function userBrand(id: string, brandId: string): User {
  return {
    id, email: `${id}@b.com`, passwordHash: 'demo', role: 'brand',
    status: 'active', createdAt: '2026-04-01T00:00:00Z', brandId,
    teamRole: 'admin',
  };
}
function userCreator(id: string, creatorId: string): User {
  return {
    id, email: `${id}@c.com`, passwordHash: 'demo', role: 'creator',
    status: 'active', createdAt: '2026-04-01T00:00:00Z', creatorId,
  };
}
function makeCollab(p: Partial<Collaboration> = {}): Collaboration {
  return {
    id: 'col_1',
    campaignId: 'cmp_1',
    creatorId: 'cr_1',
    brandId: 'br_1',
    stage: 'confirmed',
    createdAt: 1745000000000,
    updatedAt: 1745000000000,
    agreedRate: 1500,
    acceptedOfferId: 'off_1',
    contractId: 'ctr_1',
    cancelledAt: null,
    cancellationReason: null,
    history: [],
    ...p,
  };
}
function makeContract(p: Partial<Contract> = {}): Contract {
  return {
    id: 'ctr_1',
    collaborationId: 'col_1',
    campaignId: 'cmp_1',
    creatorId: 'cr_1',
    brandId: 'br_1',
    agreedRate: 1500,
    netToCreator: 1275,
    platformFee: 150,
    withholdingTax: 75,
    deliverables: [],
    briefSnapshot: 'Brief snapshot',
    briefSnapshotAt: 1745000000000,
    acceptedAt: 1745000000000,
    acceptedByUserId: 'u_creator',
    status: 'active',
    fulfilledAt: null,
    cancelledAt: null,
    ...p,
  };
}

function setupBaseDb() {
  return buildDb({
    users: [userBrand('u_brand', 'br_1'), userCreator('u_creator', 'cr_1')],
    creators: [buildCreator({ id: 'cr_1', userId: 'u_creator' })],
    brands: [buildBrand({ id: 'br_1', userId: 'u_brand' })],
    campaigns: [buildCampaign({
      id: 'cmp_1',
      brandId: 'br_1',
      title: 'Spring Renewal',
      escrowHeld: 1500,
    })],
    offers: [buildOffer({
      id: 'off_1',
      campaignId: 'cmp_1',
      creatorId: 'cr_1',
      rate: 1500,
      status: 'accepted',
    })],
    collaborations: [makeCollab()],
    contracts: [makeContract()],
  });
}

describe('v2RequestCollabCancel', () => {
  beforeEach(() => {
    useStore.getState().setDB(setupBaseDb());
    useStore.getState().setSession(null); // bypass capability gate
  });

  it('sets cancellationRequest on the collaboration', () => {
    const result = v2RequestCollabCancel('col_1', 'u_creator', 'changed direction');
    expect(result).toBeDefined();
    const db = useStore.getState().db;
    const collab = db.collaborations.find((c) => c.id === 'col_1')!;
    expect(collab.cancellationRequest).toBeDefined();
    expect(collab.cancellationRequest?.by).toBe('u_creator');
    expect(collab.cancellationRequest?.reason).toBe('changed direction');
  });

  it('does NOT change collab.stage on request (still in confirmed/submitted)', () => {
    v2RequestCollabCancel('col_1', 'u_creator', 'reason');
    const db = useStore.getState().db;
    const collab = db.collaborations.find((c) => c.id === 'col_1')!;
    expect(collab.stage).toBe('confirmed');
  });

  it('rejects request on a non-cancellable stage (paid)', () => {
    useStore.getState().setDB({
      ...useStore.getState().db,
      collaborations: [makeCollab({ stage: 'paid' })],
    });
    v2RequestCollabCancel('col_1', 'u_creator', 'too late');
    const db = useStore.getState().db;
    const collab = db.collaborations.find((c) => c.id === 'col_1')!;
    expect(collab.cancellationRequest).toBeFalsy();
  });

  it('rejects double-request (already pending)', () => {
    v2RequestCollabCancel('col_1', 'u_creator', 'first');
    v2RequestCollabCancel('col_1', 'u_brand', 'second');
    const db = useStore.getState().db;
    const collab = db.collaborations.find((c) => c.id === 'col_1')!;
    expect(collab.cancellationRequest?.by).toBe('u_creator'); // first wins
    expect(collab.cancellationRequest?.reason).toBe('first');
  });

  it('notifies the counterpart (brand if creator raised)', () => {
    v2RequestCollabCancel('col_1', 'u_creator', 'family emergency');
    const db = useStore.getState().db;
    const notifs = db.notifications.filter((n) => n.userId === 'u_brand');
    expect(notifs.length).toBeGreaterThanOrEqual(1);
    expect(notifs[0].text).toContain('Cancel request');
    expect(notifs[0].text).toContain('Spring Renewal');
  });
});

describe('v2AgreeCollabCancel — money-correctness', () => {
  beforeEach(() => {
    useStore.getState().setDB(setupBaseDb());
    useStore.getState().setSession(null);
  });

  it('refunds escrow to brand wallet when counterpart agrees', () => {
    // Setup: brand wallet starts at 0, escrowHeld 1500. Capture before-state.
    const dbBefore = useStore.getState().db;
    const brandBefore = dbBefore.brands.find((b) => b.id === 'br_1')!;
    const walletBefore = brandBefore.walletBalance;

    v2RequestCollabCancel('col_1', 'u_creator', 'pulling out');
    v2AgreeCollabCancel('col_1', 'u_brand');

    const dbAfter = useStore.getState().db;
    const brandAfter = dbAfter.brands.find((b) => b.id === 'br_1')!;
    expect(brandAfter.walletBalance).toBe(walletBefore + 1500);
  });

  it('drains campaign.escrowHeld back to 0 (or as low as the refund covers)', () => {
    v2RequestCollabCancel('col_1', 'u_creator', 'pulling out');
    v2AgreeCollabCancel('col_1', 'u_brand');
    const db = useStore.getState().db;
    const camp = db.campaigns.find((c) => c.id === 'cmp_1')!;
    expect(camp.escrowHeld).toBe(0);
  });

  it('marks the contract cancelled', () => {
    v2RequestCollabCancel('col_1', 'u_creator', 'reason');
    v2AgreeCollabCancel('col_1', 'u_brand');
    const db = useStore.getState().db;
    const contract = db.contracts.find((c) => c.id === 'ctr_1')!;
    expect(contract.status).toBe('cancelled');
    expect(contract.cancelledAt).toBeGreaterThan(0);
  });

  it('withdraws the accepted offer', () => {
    v2RequestCollabCancel('col_1', 'u_creator', 'reason');
    v2AgreeCollabCancel('col_1', 'u_brand');
    const db = useStore.getState().db;
    const offer = db.offers.find((o) => o.id === 'off_1')!;
    expect(offer.status).toBe('withdrawn');
  });

  it('transitions Collaboration.stage to "cancelled"', () => {
    v2RequestCollabCancel('col_1', 'u_creator', 'reason');
    v2AgreeCollabCancel('col_1', 'u_brand');
    const db = useStore.getState().db;
    const collab = db.collaborations.find((c) => c.id === 'col_1')!;
    expect(collab.stage).toBe('cancelled');
    expect(collab.cancellationRequest).toBeNull();
  });

  it('records a refund transaction', () => {
    v2RequestCollabCancel('col_1', 'u_creator', 'reason');
    v2AgreeCollabCancel('col_1', 'u_brand');
    const db = useStore.getState().db;
    const refund = db.transactions.find((t) => t.kind === 'refund' && t.campaignId === 'cmp_1');
    expect(refund).toBeDefined();
    expect(refund?.amount).toBe(1500);
  });

  it('rejects self-agree (the original raiser cannot agree to their own request)', () => {
    v2RequestCollabCancel('col_1', 'u_creator', 'reason');
    // Same user trying to agree — should be rejected.
    v2AgreeCollabCancel('col_1', 'u_creator');
    const db = useStore.getState().db;
    const collab = db.collaborations.find((c) => c.id === 'col_1')!;
    // Cancellation request still pending, stage still confirmed.
    expect(collab.cancellationRequest).toBeDefined();
    expect(collab.stage).toBe('confirmed');
  });

  it('no-op when no pending cancellation request exists', () => {
    v2AgreeCollabCancel('col_1', 'u_brand');
    const db = useStore.getState().db;
    const collab = db.collaborations.find((c) => c.id === 'col_1')!;
    expect(collab.stage).toBe('confirmed'); // unchanged
  });
});

describe('v2DeclineCollabCancel', () => {
  beforeEach(() => {
    useStore.getState().setDB(setupBaseDb());
    useStore.getState().setSession(null);
  });

  it('clears cancellationRequest without moving money', () => {
    const dbBefore = useStore.getState().db;
    const escrowBefore = dbBefore.campaigns[0].escrowHeld;

    v2RequestCollabCancel('col_1', 'u_creator', 'reason');
    v2DeclineCollabCancel('col_1', 'u_brand');

    const dbAfter = useStore.getState().db;
    const collab = dbAfter.collaborations.find((c) => c.id === 'col_1')!;
    expect(collab.cancellationRequest).toBeNull();
    expect(collab.stage).toBe('confirmed'); // deal continues
    expect(dbAfter.campaigns[0].escrowHeld).toBe(escrowBefore); // money untouched
  });

  it('notifies the original requester', () => {
    v2RequestCollabCancel('col_1', 'u_creator', 'reason');
    const beforeCount = useStore.getState().db.notifications.filter((n) => n.userId === 'u_creator').length;
    v2DeclineCollabCancel('col_1', 'u_brand');
    const afterCount = useStore.getState().db.notifications.filter((n) => n.userId === 'u_creator').length;
    expect(afterCount).toBeGreaterThan(beforeCount);
    const lastNotif = useStore.getState().db.notifications.filter((n) => n.userId === 'u_creator').slice(-1)[0];
    expect(lastNotif.text).toContain('declined');
  });

  it('rejects self-decline (raiser cannot decline their own request)', () => {
    v2RequestCollabCancel('col_1', 'u_creator', 'reason');
    v2DeclineCollabCancel('col_1', 'u_creator');
    const db = useStore.getState().db;
    const collab = db.collaborations.find((c) => c.id === 'col_1')!;
    expect(collab.cancellationRequest).toBeDefined(); // still there
  });
});
