// contracts.test.ts — P2 §1.3 Contract creation + fulfillment.
//
// `lib/api/contracts.ts` is the runtime path that `v2AcceptOffer` and
// `v2AcceptCounter` call to materialize the immutable agreement
// snapshot in the same `tx` as offer acceptance. The migrator-5 path
// (in `migrations.ts`) mirrors the same logic for pre-existing
// accepted offers; the two stay in lockstep. These tests lock in the
// runtime copy's contract.

import { describe, it, expect } from 'vitest';
import {
  createContractForAcceptedOffer,
  markContractFulfilled,
} from '../contracts';
import type { Database, Collaboration } from '../types';
import {
  buildDb, buildCampaign, buildCreator, buildBrand, buildOffer,
} from '@/lib/utils/__tests__/fixtures';

function makeCollab(p: Partial<Collaboration> = {}): Collaboration {
  return {
    id: 'col_1', campaignId: 'cmp_1', creatorId: 'cr_1', brandId: 'br_1',
    stage: 'confirmed', createdAt: 1745000000000, updatedAt: 1745000000000,
    agreedRate: 1500, acceptedOfferId: 'off_1', contractId: null,
    cancelledAt: null, cancellationReason: null, history: [],
    ...p,
  };
}

function setupDb(extras: Partial<Database> = {}): Database {
  return buildDb({
    creators: [buildCreator({ id: 'cr_1' })],
    brands: [buildBrand({ id: 'br_1' })],
    campaigns: [buildCampaign({
      id: 'cmp_1',
      brandId: 'br_1',
      brief: 'Spring renewal — soft natural light, sustainable tone.',
    })],
    deliverables: [
      {
        id: 'del_1', campaignId: 'cmp_1', index: 0,
        platform: 'instagram', format: 'reel',
        quantity: 1, dueOffsetDays: null, specs: null,
      },
      {
        id: 'del_2', campaignId: 'cmp_1', index: 1,
        platform: 'instagram', format: 'story',
        quantity: 1, dueOffsetDays: null, specs: null,
      },
    ],
    offers: [buildOffer({
      id: 'off_1', campaignId: 'cmp_1', creatorId: 'cr_1',
      rate: 2000, status: 'accepted',
    })],
    collaborations: [makeCollab()],
    ...extras,
  });
}

describe('createContractForAcceptedOffer', () => {
  it('creates a Contract row + sets Collaboration.contractId', () => {
    const db = setupDb();
    const offer = db.offers[0];

    const id = createContractForAcceptedOffer(db, 'col_1', offer, 'u_creator');

    expect(id).toBeTruthy();
    expect(db.contracts.length).toBe(1);
    expect(db.contracts[0].id).toBe(id);
    expect(db.contracts[0].collaborationId).toBe('col_1');
    expect(db.contracts[0].status).toBe('active');
    expect(db.collaborations[0].contractId).toBe(id);
  });

  it('computes net/fee/tax correctly (10% + 5% on $2000 → $1700 net)', () => {
    const db = setupDb();
    createContractForAcceptedOffer(db, 'col_1', db.offers[0], 'u_creator');
    const c = db.contracts[0];
    expect(c.agreedRate).toBe(2000);
    expect(c.platformFee).toBe(200);   // 10%
    expect(c.withholdingTax).toBe(100); // 5%
    expect(c.netToCreator).toBe(1700); // 2000 - 200 - 100
  });

  it('snapshots the campaign brief + deliverables at acceptance time', () => {
    const db = setupDb();
    createContractForAcceptedOffer(db, 'col_1', db.offers[0], 'u_creator');
    const c = db.contracts[0];

    // Brief snapshot frozen.
    expect(c.briefSnapshot).toBe('Spring renewal — soft natural light, sustainable tone.');
    expect(c.briefSnapshotAt).toBeGreaterThan(0);

    // Deliverable snapshot frozen — 2 rows in stable order.
    expect(c.deliverables.length).toBe(2);
    expect(c.deliverables[0].deliverableId).toBe('del_1');
    expect(c.deliverables[0].format).toBe('reel');
    expect(c.deliverables[1].deliverableId).toBe('del_2');
    expect(c.deliverables[1].format).toBe('story');
  });

  it('snapshot is independent — editing the campaign brief later does not change the contract', () => {
    const db = setupDb();
    createContractForAcceptedOffer(db, 'col_1', db.offers[0], 'u_creator');
    const originalBrief = db.contracts[0].briefSnapshot;

    // Brand edits the campaign brief later.
    db.campaigns = db.campaigns.map((c) =>
      c.id === 'cmp_1' ? { ...c, brief: 'A completely different brief' } : c,
    );

    // Contract's snapshot is unaffected.
    expect(db.contracts[0].briefSnapshot).toBe(originalBrief);
    expect(db.contracts[0].briefSnapshot).not.toBe('A completely different brief');
  });

  it('idempotent — re-running on a collab with existing contractId returns the existing id', () => {
    const db = setupDb();
    const id1 = createContractForAcceptedOffer(db, 'col_1', db.offers[0], 'u_creator');
    expect(db.contracts.length).toBe(1);

    // Second call should return the existing id, not create a duplicate.
    const id2 = createContractForAcceptedOffer(db, 'col_1', db.offers[0], 'u_creator');
    expect(id2).toBe(id1);
    expect(db.contracts.length).toBe(1); // still only 1 contract
  });

  it('returns null when the Collaboration does not exist', () => {
    const db = setupDb();
    const result = createContractForAcceptedOffer(db, 'col_does_not_exist', db.offers[0], 'u_creator');
    expect(result).toBeNull();
    expect(db.contracts.length).toBe(0);
  });

  it('returns null when the campaign does not exist', () => {
    // Collab points at a missing campaign — defensive return.
    const db = setupDb({
      collaborations: [makeCollab({ campaignId: 'cmp_missing' })],
      // No campaigns array entry for cmp_missing
    });
    const result = createContractForAcceptedOffer(db, 'col_1', db.offers[0], 'u_creator');
    expect(result).toBeNull();
  });

  it('uses provided acceptedAtMs timestamp (not Date.now) when passed', () => {
    const db = setupDb();
    const fixedTs = 1750000000000; // arbitrary fixed point in the past
    createContractForAcceptedOffer(db, 'col_1', db.offers[0], 'u_creator', fixedTs);
    expect(db.contracts[0].acceptedAt).toBe(fixedTs);
    expect(db.contracts[0].briefSnapshotAt).toBe(fixedTs);
  });

  it('records the actor user id (creator on accept, brand on counter-accept)', () => {
    const db = setupDb();
    createContractForAcceptedOffer(db, 'col_1', db.offers[0], 'u_creator');
    expect(db.contracts[0].acceptedByUserId).toBe('u_creator');
  });

  it('contract id format is stable + recognizable', () => {
    const db = setupDb();
    const id = createContractForAcceptedOffer(db, 'col_1', db.offers[0], 'u_creator');
    expect(id).toMatch(/^ctr_/);
  });

  it('starts in "active" status with fulfilledAt + cancelledAt null', () => {
    const db = setupDb();
    createContractForAcceptedOffer(db, 'col_1', db.offers[0], 'u_creator');
    const c = db.contracts[0];
    expect(c.status).toBe('active');
    expect(c.fulfilledAt).toBeNull();
    expect(c.cancelledAt).toBeNull();
  });
});

describe('markContractFulfilled', () => {
  it('flips status from "active" to "fulfilled" and stamps fulfilledAt', () => {
    const db = setupDb();
    createContractForAcceptedOffer(db, 'col_1', db.offers[0], 'u_creator');
    const ctrId = db.contracts[0].id;

    markContractFulfilled(db, ctrId);

    expect(db.contracts[0].status).toBe('fulfilled');
    expect(db.contracts[0].fulfilledAt).toBeGreaterThan(0);
  });

  it('uses provided fulfilledAtMs timestamp when passed', () => {
    const db = setupDb();
    createContractForAcceptedOffer(db, 'col_1', db.offers[0], 'u_creator');
    const ctrId = db.contracts[0].id;

    const fixedTs = 1760000000000;
    markContractFulfilled(db, ctrId, fixedTs);

    expect(db.contracts[0].fulfilledAt).toBe(fixedTs);
  });

  it('idempotent — re-running on already-fulfilled contract is a no-op (preserves first timestamp)', () => {
    const db = setupDb();
    createContractForAcceptedOffer(db, 'col_1', db.offers[0], 'u_creator');
    const ctrId = db.contracts[0].id;

    markContractFulfilled(db, ctrId, 1760000000000);
    const firstFulfilledAt = db.contracts[0].fulfilledAt;

    markContractFulfilled(db, ctrId, 1770000000000); // different timestamp
    // First timestamp preserved — guard short-circuits second call.
    expect(db.contracts[0].fulfilledAt).toBe(firstFulfilledAt);
    expect(db.contracts[0].status).toBe('fulfilled');
  });

  it('silent no-op when contractId does not exist', () => {
    const db = setupDb();
    expect(() => markContractFulfilled(db, 'ctr_does_not_exist')).not.toThrow();
    expect(db.contracts.length).toBe(0); // unchanged
  });

  it('does not affect a cancelled contract (status stays cancelled, no flip to fulfilled)', () => {
    const db = setupDb();
    createContractForAcceptedOffer(db, 'col_1', db.offers[0], 'u_creator');
    const ctrId = db.contracts[0].id;

    // Manually mark cancelled (mimics what cancelCollabInternal does).
    db.contracts[0] = { ...db.contracts[0], status: 'cancelled', cancelledAt: 1755000000000 };

    markContractFulfilled(db, ctrId);

    // Status preserved — only 'active' contracts can be fulfilled.
    expect(db.contracts[0].status).toBe('cancelled');
    expect(db.contracts[0].fulfilledAt).toBeNull();
  });
});
