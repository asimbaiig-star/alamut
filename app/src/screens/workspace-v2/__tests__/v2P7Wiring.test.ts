// v2P7Wiring.test.ts — P7 polish & loose-ends regression coverage.
//
// Three small wirings shipped in P7 with their own test surfaces:
//   1. v2SendOffer's `outreachId` param links the new Offer back to
//      the Outreach via `resultingOfferId` and bumps the outreach
//      status from 'sent' to 'replied'.
//   2. v2ApproveContent enqueues `kyc-expired` ONLY when the creator's
//      `kycVerifiedAt` is set (otherwise the trigger doesn't fire).
//   3. NotificationsBell `classify` returns 'collaboration' for
//      notifications that carry only `meta.collaborationId` (no more
//      specific FK).

import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from '@/lib/api/store';
import { v2SendOffer, v2ApproveContent } from '../v2CampaignActions';
import { v2SendOutreach } from '../v2OutreachActions';
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
function makeCollab(p: Partial<Collaboration> = {}): Collaboration {
  return {
    id: 'col_1', campaignId: 'cmp_1', creatorId: 'cr_1', brandId: 'br_1',
    stage: 'submitted', createdAt: 1745000000000, updatedAt: 1745000000000,
    agreedRate: 1500, acceptedOfferId: 'off_1', contractId: 'ctr_1',
    cancelledAt: null, cancellationReason: null, history: [], ...p,
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

describe('P7: v2SendOffer outreachId → Outreach.resultingOfferId link', () => {
  beforeEach(() => {
    useStore.getState().setDB(buildDb({
      users: [userBrand('u_brand', 'br_1'), userCreator('u_creator', 'cr_1')],
      creators: [buildCreator({ id: 'cr_1', userId: 'u_creator' })],
      brands: [buildBrand({ id: 'br_1', userId: 'u_brand' })],
      campaigns: [buildCampaign({ id: 'cmp_1', brandId: 'br_1' })],
    }));
    useStore.getState().setSession(null);
  });

  it('links the new Offer back to the source Outreach', () => {
    // Step 1: Brand sends an outreach.
    const outreach = v2SendOutreach({
      campaignId: 'cmp_1',
      creatorId: 'cr_1',
      message: 'Soft contact first',
      sentByUserId: 'u_brand',
    });
    expect(outreach).toBeDefined();
    const outreachId = outreach!.id;

    // Step 2: Brand follows up with a real offer, passing the outreach id.
    const offer = v2SendOffer('cmp_1', 'cr_1', 1500, 'firm offer', null, undefined, outreachId);
    expect(offer).toBeDefined();

    // Outreach should now point at the new offer.
    const db = useStore.getState().db;
    const o = db.outreach.find((x) => x.id === outreachId)!;
    expect(o.resultingOfferId).toBe(offer!.id);
  });

  it('bumps outreach status from "sent" to "replied" when the offer follows up', () => {
    const outreach = v2SendOutreach({
      campaignId: 'cmp_1',
      creatorId: 'cr_1',
      message: 'msg',
      sentByUserId: 'u_brand',
    });
    expect(outreach!.status).toBe('sent');

    v2SendOffer('cmp_1', 'cr_1', 1500, 'offer', null, undefined, outreach!.id);
    const db = useStore.getState().db;
    expect(db.outreach[0].status).toBe('replied');
  });

  it('preserves a non-"sent" outreach status if it was already replied/declined', () => {
    const outreach = v2SendOutreach({
      campaignId: 'cmp_1', creatorId: 'cr_1', message: 'msg', sentByUserId: 'u_brand',
    });
    // Manually flip to declined in the store.
    useStore.getState().setDB({
      ...useStore.getState().db,
      outreach: [{ ...useStore.getState().db.outreach[0], status: 'declined' }],
    });
    v2SendOffer('cmp_1', 'cr_1', 1500, 'offer', null, undefined, outreach!.id);
    // Status preserved, but resultingOfferId still set.
    const db = useStore.getState().db;
    expect(db.outreach[0].status).toBe('declined');
    expect(db.outreach[0].resultingOfferId).toBeTruthy();
  });

  it('non-outreach offer (no outreachId) leaves outreach table untouched', () => {
    v2SendOutreach({
      campaignId: 'cmp_1', creatorId: 'cr_1', message: 'msg', sentByUserId: 'u_brand',
    });
    v2SendOffer('cmp_1', 'cr_1', 1500, 'cold offer'); // no outreachId
    const db = useStore.getState().db;
    expect(db.outreach[0].status).toBe('sent'); // unchanged
    expect(db.outreach[0].resultingOfferId).toBeUndefined();
  });

  it('outreach-originated offer defaults source to "spark-recommendation"', () => {
    const outreach = v2SendOutreach({
      campaignId: 'cmp_1', creatorId: 'cr_1', message: 'msg', sentByUserId: 'u_brand',
    });
    const offer = v2SendOffer('cmp_1', 'cr_1', 1500, 'follow-up', null, undefined, outreach!.id);
    expect(offer?.source).toBe('spark-recommendation');
  });
});

describe('P7: v2ApproveContent enqueues kyc-expired only when verified', () => {
  function setupApproveDb(creatorOverride: { kycVerifiedAt?: string } = {}) {
    return buildDb({
      users: [userBrand('u_brand', 'br_1'), userCreator('u_creator', 'cr_1')],
      creators: [buildCreator({
        id: 'cr_1',
        userId: 'u_creator',
        pendingBalance: 1275,
        ...creatorOverride,
      })],
      brands: [buildBrand({ id: 'br_1', userId: 'u_brand', escrowHeld: 1500 })],
      campaigns: [buildCampaign({ id: 'cmp_1', brandId: 'br_1', escrowHeld: 1500 })],
      offers: [buildOffer({ id: 'off_1', campaignId: 'cmp_1', creatorId: 'cr_1', rate: 1500, status: 'accepted' })],
      submissions: [buildSubmission({ id: 'sub_1', campaignId: 'cmp_1', creatorId: 'cr_1', status: 'in_review' })],
      collaborations: [makeCollab()],
      contracts: [makeContract()],
    });
  }

  it('does NOT enqueue kyc-expired when kycVerifiedAt is undefined', () => {
    useStore.getState().setDB(setupApproveDb({}));
    useStore.getState().setSession(null);
    v2ApproveContent('sub_1');
    const db = useStore.getState().db;
    const kyc = db.scheduledNotifications.find((n) => n.type === 'kyc-expired');
    expect(kyc).toBeUndefined();
  });

  it('enqueues kyc-expired when kycVerifiedAt is set, with expiry 365d in the future', () => {
    // KYC verified yesterday → expiry is +364 days from now → trigger queues.
    const yesterdayIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    useStore.getState().setDB(setupApproveDb({ kycVerifiedAt: yesterdayIso }));
    useStore.getState().setSession(null);
    v2ApproveContent('sub_1');
    const db = useStore.getState().db;
    const kyc = db.scheduledNotifications.find((n) => n.type === 'kyc-expired');
    expect(kyc).toBeDefined();
    expect(kyc!.recipientUserId).toBe('u_creator');
    // triggerAt should be ~364 days from now.
    const expectedExpiry = +new Date(yesterdayIso) + 365 * 24 * 60 * 60 * 1000;
    expect(Math.abs(kyc!.triggerAt - expectedExpiry)).toBeLessThan(1000);
  });

  it('queues an immediately-fireable trigger when kycVerifiedAt is already past 365 days', () => {
    // Verified 400 days ago → expiry was 35 days ago. The enqueue
    // helper accepts any valid timestamp; past-expiry rows fire on
    // the next heartbeat, which is the right "your KYC has lapsed"
    // nudge behavior. Approval still completes normally.
    const tooOld = new Date(Date.now() - 400 * 24 * 60 * 60 * 1000).toISOString();
    useStore.getState().setDB(setupApproveDb({ kycVerifiedAt: tooOld }));
    useStore.getState().setSession(null);
    v2ApproveContent('sub_1');
    const db = useStore.getState().db;
    expect(db.submissions[0].status).toBe('approved');

    // KYC expiry trigger queued; triggerAt is in the past so the next
    // heartbeat will emit it.
    const kyc = db.scheduledNotifications.find((n) => n.type === 'kyc-expired');
    expect(kyc).toBeDefined();
    expect(kyc!.triggerAt).toBeLessThan(Date.now());
    expect(kyc!.emitted).toBe(false);
  });
});
