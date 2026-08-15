// acceptPitch.test.ts — a brand can say yes to a pitch.
//
// `ApplicationStatus` had no `accepted`. A brand who wanted to agree to a
// creator's asking price had to send a fresh Offer, which the creator then had
// to accept: two extra round trips to settle terms both sides already agreed
// on. The brand-initiated path costs the creator ONE action; the
// creator-initiated path cost three in total. This closes that asymmetry.

import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from '@/lib/api/store';
import { v2AcceptPitch } from '../v2CampaignActions';
import {
  buildDb, buildCampaign, buildCreator, buildBrand, buildApplication,
} from '@/lib/utils/__tests__/fixtures';
import { splitGross } from '@/lib/api/money';
import type { User } from '@/lib/api/types';

const ASK = 1800;

const userBrand = (): User => ({
  id: 'u_brand', email: 'b@b.com', passwordHash: 'demo', role: 'brand',
  status: 'active', createdAt: '2026-04-01T00:00:00Z', brandId: 'br_1', teamRole: 'admin',
});
const userCreator = (): User => ({
  id: 'u_creator', email: 'c@c.com', passwordHash: 'demo', role: 'creator',
  status: 'active', createdAt: '2026-04-01T00:00:00Z', creatorId: 'cr_1',
});

function seed(opts: { proposedRate?: number } = { proposedRate: ASK }) {
  useStore.getState().setDB(buildDb({
    users: [userBrand(), userCreator()],
    creators: [buildCreator({ id: 'cr_1', userId: 'u_creator', walletBalance: 0, pendingBalance: 0 })],
    brands: [buildBrand({ id: 'br_1', userId: 'u_brand', walletBalance: 50_000, escrowHeld: 0 })],
    campaigns: [buildCampaign({ id: 'cmp_1', brandId: 'br_1', stage: 'live', budget: 50_000, escrowHeld: 0 })],
    applications: [buildApplication({
      id: 'app_1', campaignId: 'cmp_1', creatorId: 'cr_1',
      proposedRate: opts.proposedRate, status: 'submitted',
    })],
  }));
  useStore.getState().setSession({ userId: 'u_brand', issuedAt: new Date().toISOString() });
}

describe('v2AcceptPitch', () => {
  beforeEach(() => seed());

  it('forms an ACCEPTED deal in one step, at the creator’s asking price', () => {
    const offer = v2AcceptPitch('app_1');
    expect(offer.status).toBe('accepted');
    expect(offer.rate).toBe(ASK);
    // The creator never has to act again — that is the entire point.
    const db = useStore.getState().db;
    expect(db.offers.filter((o) => o.status === 'pending')).toHaveLength(0);
  });

  it('marks the application accepted, not merely shortlisted', () => {
    v2AcceptPitch('app_1');
    expect(useStore.getState().db.applications[0].status).toBe('accepted');
  });

  it('links the offer back to the pitch it answers', () => {
    const offer = v2AcceptPitch('app_1');
    expect(offer.applicationId).toBe('app_1');
    expect(offer.source).toBe('application');
  });

  it('reserves escrow, exactly as a normal acceptance does', () => {
    v2AcceptPitch('app_1');
    const db = useStore.getState().db;
    // Gross is committed by the brand; the creator's pending balance is the
    // NET they will actually receive. Asserting gross on both was my error —
    // the split is applied at acceptance, not at payout.
    expect(db.brands[0].escrowHeld).toBe(ASK);
    expect(db.creators[0].pendingBalance).toBe(splitGross(ASK).net);
  });

  it('moves the pair to `confirmed`', () => {
    v2AcceptPitch('app_1');
    const collab = useStore.getState().db.collaborations
      .find((c) => c.campaignId === 'cmp_1' && c.creatorId === 'cr_1');
    expect(collab?.stage).toBe('confirmed');
  });

  it('accepts at a different rate when the brand names one', () => {
    const offer = v2AcceptPitch('app_1', 1500);
    expect(offer.status).toBe('accepted');
    expect(offer.rate).toBe(1500);
    // Still a closed deal, not another negotiation round.
    expect(useStore.getState().db.collaborations[0].stage).toBe('confirmed');
  });

  it('refuses a pitch with no rate rather than inventing one', () => {
    // NB: `seed(undefined)` would hit the default parameter and seed a rate
    // anyway — an options object makes "no rate" expressible.
    seed({});
    expect(() => v2AcceptPitch('app_1')).toThrow(/no rate attached/i);
  });

  it('refuses a withdrawn pitch', () => {
    seed();
    useStore.getState().setDB({
      ...useStore.getState().db,
      applications: [{ ...useStore.getState().db.applications[0], status: 'withdrawn' }],
    });
    expect(() => v2AcceptPitch('app_1')).toThrow(/withdrew/i);
  });

  it('refuses a pitch already passed on', () => {
    seed();
    useStore.getState().setDB({
      ...useStore.getState().db,
      applications: [{ ...useStore.getState().db.applications[0], status: 'rejected' }],
    });
    expect(() => v2AcceptPitch('app_1')).toThrow(/already passed/i);
  });
});
