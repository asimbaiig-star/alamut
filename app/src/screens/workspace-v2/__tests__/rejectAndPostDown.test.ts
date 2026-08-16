// rejectAndPostDown.test.ts — the middle option, and an honest takedown path.
//
// F2: the revision cap told the brand to "Approve, reject, or open a dispute
// instead" and `reject` did not exist. After three rounds their real choices
// were to approve work they didn't want or escalate — adversarial, for what is
// often just "this isn't right and we're done trying".
//
// E1: automatic permalink re-verification is NOT buildable here — no crawler,
// and the browser cannot fetch instagram.com. Claiming to verify would be the
// same class of lie as the analytics that used to be invented at render time.
// A human reports it instead.
//
// The constraint both share, and the one worth pinning hardest: NEITHER MOVES
// MONEY. A one-sided refund on the brand's say-so is exactly what disputes
// exist to arbitrate.

import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from '@/lib/api/store';
import { v2RejectSubmission, v2ReportPostDown } from '../v2CampaignActions';
import { computeCollabStage } from '@/lib/api/collabSync';
import {
  buildDb, buildCampaign, buildCreator, buildBrand, buildOffer, buildSubmission,
} from '@/lib/utils/__tests__/fixtures';
import type { User, Deliverable, Collaboration } from '@/lib/api/types';

const RATE = 1500;

const userBrand: User = {
  id: 'u_brand', email: 'b@b.com', passwordHash: 'demo', role: 'brand',
  status: 'active', createdAt: '2026-01-01T00:00:00Z', brandId: 'br_1', teamRole: 'admin',
};
const userCreator: User = {
  id: 'u_creator', email: 'c@c.com', passwordHash: 'demo', role: 'creator',
  status: 'active', createdAt: '2026-01-01T00:00:00Z', creatorId: 'cr_1',
};

function seed(subPatch: Parameters<typeof buildSubmission>[0] = {}) {
  const del: Deliverable = {
    id: 'del_0', campaignId: 'cmp_1', index: 0,
    platform: 'instagram', format: 'reel', quantity: 1,
    dueOffsetDays: null, specs: null,
  };
  const collab: Collaboration = {
    id: 'col_1', campaignId: 'cmp_1', creatorId: 'cr_1', brandId: 'br_1',
    stage: 'submitted', createdAt: 1745000000000, updatedAt: 1745000000000,
    agreedRate: RATE, acceptedOfferId: 'off_1', contractId: null,
    cancelledAt: null, cancellationReason: null, history: [],
  };
  useStore.getState().setDB(buildDb({
    users: [userBrand, userCreator],
    creators: [buildCreator({ id: 'cr_1', userId: 'u_creator', walletBalance: 0, pendingBalance: RATE })],
    brands: [buildBrand({ id: 'br_1', userId: 'u_brand', escrowHeld: RATE, walletBalance: 10_000 })],
    campaigns: [buildCampaign({ id: 'cmp_1', brandId: 'br_1', stage: 'live', escrowHeld: RATE })],
    offers: [buildOffer({ id: 'off_1', campaignId: 'cmp_1', creatorId: 'cr_1', rate: RATE, status: 'accepted' })],
    collaborations: [collab],
    deliverables: [del],
    submissions: [buildSubmission({
      id: 'sub_0', campaignId: 'cmp_1', creatorId: 'cr_1',
      deliverableId: 'del_0', status: 'in_review', round: 1, ...subPatch,
    })],
  }));
  useStore.getState().setSession({ userId: 'u_brand', issuedAt: new Date().toISOString() });
}

describe('v2RejectSubmission — the option between approve and dispute', () => {
  beforeEach(() => seed());

  it('marks the deliverable rejected', () => {
    v2RejectSubmission('sub_0', 'Not the direction we agreed, and we are out of rounds.');
    expect(useStore.getState().db.submissions[0].status).toBe('rejected');
  });

  it('MOVES NO MONEY — escrow and balances are untouched', () => {
    // The constraint that makes this safe to hand a brand. A refund here
    // would be one-sided; that is what disputes are for.
    v2RejectSubmission('sub_0', 'Not what we agreed.');
    const db = useStore.getState().db;
    expect(db.brands[0].escrowHeld).toBe(RATE);
    expect(db.creators[0].walletBalance).toBe(0);
    expect(db.creators[0].pendingBalance).toBe(RATE);
  });

  it('demands a reason — the creator did work and deserves to know why', () => {
    expect(() => v2RejectSubmission('sub_0', '   ')).toThrow(/reason/i);
  });

  it('records the reason as feedback the creator can read', () => {
    v2RejectSubmission('sub_0', 'Lighting never matched the brief.');
    const fb = useStore.getState().db.submissions[0].feedback;
    expect(fb[fb.length - 1].text).toBe('Lighting never matched the brief.');
  });

  it('notifies the creator, and says escrow is still held', () => {
    v2RejectSubmission('sub_0', 'Not what we agreed.');
    const n = useStore.getState().db.notifications.find((x) => x.userId === 'u_creator');
    expect(n?.text).toMatch(/escrow stays held/i);
  });

  it('refuses to reject work already approved and paid', () => {
    seed({ status: 'approved' });
    expect(() => v2RejectSubmission('sub_0', 'changed my mind')).toThrow(/already approved/i);
  });

  it('is idempotent', () => {
    v2RejectSubmission('sub_0', 'Not what we agreed.');
    const before = useStore.getState().db.submissions[0].feedback.length;
    v2RejectSubmission('sub_0', 'again');
    expect(useStore.getState().db.submissions[0].feedback.length).toBe(before);
  });

  it('does not leave the collab waiting on a deliverable that is never coming', () => {
    // A rejected slot must not read as "in review" forever.
    v2RejectSubmission('sub_0', 'Not what we agreed.');
    const db = useStore.getState().db;
    expect(computeCollabStage('cmp_1', 'cr_1', db)).not.toBe('submitted');
  });
});

describe('v2ReportPostDown — the honest version of re-verification', () => {
  beforeEach(() => seed({ status: 'approved', permalink: 'https://instagram.com/p/X/' }));

  it('stops the deliverable claiming to be live', () => {
    v2ReportPostDown('sub_0', 'Link 404s.');
    const db = useStore.getState().db;
    expect(computeCollabStage('cmp_1', 'cr_1', db)).not.toBe('live');
  });

  it('KEEPS the permalink — the record of what was posted survives a takedown', () => {
    v2ReportPostDown('sub_0', 'Link 404s.');
    expect(useStore.getState().db.submissions[0].permalink).toBe('https://instagram.com/p/X/');
  });

  it('moves no money — the work was accepted and paid for', () => {
    const before = useStore.getState().db.creators[0].walletBalance;
    v2ReportPostDown('sub_0', 'Link 404s.');
    expect(useStore.getState().db.creators[0].walletBalance).toBe(before);
  });

  it('asks the creator to restore it', () => {
    v2ReportPostDown('sub_0', 'Link 404s.');
    const n = useStore.getState().db.notifications.find((x) => x.userId === 'u_creator');
    expect(n?.text).toMatch(/no longer live/i);
  });

  it('refuses when there is no live link to report', () => {
    seed({ status: 'approved' });
    expect(() => v2ReportPostDown('sub_0', 'gone')).toThrow(/no live link/i);
  });
});
