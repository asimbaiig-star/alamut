// v2EscrowRelease.test.ts — per-deliverable escrow release (audit F30).
//
// The bug: v2ApproveContent released the FULL accepted-offer rate on every
// approval, and its only idempotency guard was per-submission
// (`sub.status === 'approved'`). On a multi-deliverable collab — one offer
// covering "1 IG post + 1 Reel" — approving each deliverable released the
// whole rate again, paying the creator N× the agreed amount and driving
// campaign.spent to N× budget.
//
// The contract these tests pin down:
//   1. Each approved deliverable releases only its share of the rate.
//   2. The shares sum to EXACTLY the agreed rate — no rounding drift, no
//      over- or under-payment, whatever the slot count.
//   3. Escrow still outstanding while slots remain unapproved.

import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from '@/lib/api/store';
import { v2ApproveContent, v2MarkContentLive } from '../v2CampaignActions';
import {
  buildDb, buildCampaign, buildCreator, buildBrand, buildOffer, buildSubmission,
} from '@/lib/utils/__tests__/fixtures';
import type { Deliverable, User, Collaboration } from '@/lib/api/types';

const RATE = 1650; // the audit's real case: $1,650 flat for 2 deliverables

function userBrand(): User {
  return {
    id: 'u_brand', email: 'b@b.com', passwordHash: 'demo', role: 'brand',
    status: 'active', createdAt: '2026-04-01T00:00:00Z', brandId: 'br_1', teamRole: 'admin',
  };
}
function userCreator(): User {
  return {
    id: 'u_creator', email: 'c@c.com', passwordHash: 'demo', role: 'creator',
    status: 'active', createdAt: '2026-04-01T00:00:00Z', creatorId: 'cr_1',
  };
}
function del(index: number): Deliverable {
  return {
    id: `del_cmp_1_${index}`, campaignId: 'cmp_1', index,
    platform: 'instagram', format: 'reel', quantity: 1,
    dueOffsetDays: null, specs: null,
  };
}
function collab(): Collaboration {
  return {
    id: 'col_1', campaignId: 'cmp_1', creatorId: 'cr_1', brandId: 'br_1',
    stage: 'confirmed', createdAt: 1745000000000, updatedAt: 1745000000000,
    agreedRate: RATE, acceptedOfferId: 'off_1', contractId: null,
    cancelledAt: null, cancellationReason: null, history: [],
  };
}

/** Seed a live campaign with `slots` deliverables, one accepted offer at
 *  RATE, and one in_review submission per slot. */
function seed(slots: number) {
  const deliverables = Array.from({ length: slots }, (_, i) => del(i));
  const submissions = deliverables.map((d, i) =>
    buildSubmission({
      id: `sub_${i}`, campaignId: 'cmp_1', creatorId: 'cr_1',
      deliverableId: d.id, status: 'in_review', round: 1,
    }),
  );
  useStore.getState().setDB(buildDb({
    users: [userBrand(), userCreator()],
    creators: [buildCreator({ id: 'cr_1', userId: 'u_creator', walletBalance: 0, pendingBalance: 0, lifetimeEarnings: 0 })],
    brands: [buildBrand({ id: 'br_1', userId: 'u_brand', escrowHeld: RATE, walletBalance: 0 })],
    campaigns: [buildCampaign({ id: 'cmp_1', brandId: 'br_1', escrowHeld: RATE, spent: 0, stage: 'live' })],
    offers: [buildOffer({ id: 'off_1', campaignId: 'cmp_1', creatorId: 'cr_1', rate: RATE, status: 'accepted' })],
    collaborations: [collab()],
    deliverables,
    submissions,
  }));
  useStore.getState().setSession({ userId: 'u_brand', issuedAt: new Date().toISOString() });
  return submissions.map((s) => s.id);
}

/** Gross actually released, summed off the brand-side ledger. */
function releasedGross(): number {
  return -useStore.getState().db.transactions
    .filter((t) => t.kind === 'escrow_release')
    .reduce((sum, t) => sum + t.amount, 0);
}

/**
 * Approve, then have the creator post and the brand verify it.
 *
 * Escrow used to leave at APPROVE, so these tests called `v2ApproveContent`
 * and asserted the money. It now leaves when the brand confirms the post is
 * live, which is the product rule: the creator makes it live and only then
 * is the deal payable. The assertions below are unchanged — the money is the
 * same money; it moves one step later, and this helper walks the real
 * sequence to get there.
 *
 * The permalink write stands in for the creator pasting their post URL,
 * which `v2MarkContentLive` requires before it will do anything.
 */
function approveAndConfirmLive(submissionId: string): void {
  v2ApproveContent(submissionId);
  useStore.setState((s) => ({
    ...s,
    db: {
      ...s.db,
      submissions: s.db.submissions.map((sub) =>
        sub.id === submissionId
          ? { ...sub, permalink: `https://instagram.com/p/${submissionId}` }
          : sub),
    },
  }));
  v2MarkContentLive(submissionId);
}

describe('per-deliverable escrow release on confirm-live (F30)', () => {
  beforeEach(() => { useStore.getState().setSession(null); });

  it('releases only the first slot’s share when one of two deliverables is approved', () => {
    const [sub0] = seed(2);
    approveAndConfirmLive(sub0);

    const camp = useStore.getState().db.campaigns[0];
    // Half of 1650 — NOT the full rate.
    expect(releasedGross()).toBe(825);
    expect(camp.spent).toBe(825);
    // The unapproved Reel still has escrow behind it.
    expect(camp.escrowHeld).toBe(825);
  });

  it('does not overpay when every deliverable is approved', () => {
    const subs = seed(2);
    subs.forEach((id) => approveAndConfirmLive(id));

    const camp = useStore.getState().db.campaigns[0];
    const creator = useStore.getState().db.creators[0];
    // Total released is exactly the agreed rate — the pre-fix bug paid 2×.
    expect(releasedGross()).toBe(RATE);
    expect(camp.spent).toBe(RATE);
    expect(camp.escrowHeld).toBe(0);
    // Creator nets rate minus 10% fee and 5% WHT, once.
    expect(creator.walletBalance).toBe(RATE - Math.round(RATE * 0.10) - Math.round(RATE * 0.05));
  });

  it('splits without rounding drift on a slot count that does not divide evenly', () => {
    // 1650 / 3 = 550 exactly; use 4 slots (412.5) to force rounding.
    const subs = seed(4);
    subs.forEach((id) => approveAndConfirmLive(id));
    expect(releasedGross()).toBe(RATE);
    expect(useStore.getState().db.campaigns[0].escrowHeld).toBe(0);
  });

  it('still releases the whole rate for a single-deliverable collab', () => {
    const [only] = seed(1);
    approveAndConfirmLive(only);
    expect(releasedGross()).toBe(RATE);
    expect(useStore.getState().db.campaigns[0].escrowHeld).toBe(0);
  });

  it('is idempotent — re-approving an approved submission releases nothing more', () => {
    const [sub0] = seed(2);
    approveAndConfirmLive(sub0);
    const afterFirst = releasedGross();
    approveAndConfirmLive(sub0);
    expect(releasedGross()).toBe(afterFirst);
  });
});
