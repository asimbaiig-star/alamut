// v2CampaignActions.test.ts — campaign-level mutation tests.
//
// Covers:
//   - v2EndCampaign auto-cancel pass + FIX #5 (skip escrow-frozen collabs)
//   - P3 §2.1 counter cap — 4th counter expires the offer
//   - v2ApplyToCampaign auto-shortlist (P3 §2.4)

import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from '@/lib/api/store';
import {
  v2EndCampaign, v2CounterOffer, v2CounterCounter,
  v2ApplyToCampaign, v2SendOffer,
} from '../v2CampaignActions';
import {
  buildDb, buildCampaign, buildCreator, buildBrand, buildOffer,
} from '@/lib/utils/__tests__/fixtures';
import type { Collaboration, Contract, User, OfferRound } from '@/lib/api/types';

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
    stage: 'confirmed', createdAt: 1745000000000, updatedAt: 1745000000000,
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

describe('v2EndCampaign — auto-cancel pass', () => {
  beforeEach(() => {
    useStore.getState().setDB(buildDb({
      users: [userBrand('u_brand', 'br_1'), userCreator('u_creator', 'cr_1')],
      creators: [buildCreator({ id: 'cr_1', userId: 'u_creator', pendingBalance: 1275 })],
      brands: [buildBrand({ id: 'br_1', userId: 'u_brand', escrowHeld: 1500, walletBalance: 0 })],
      campaigns: [buildCampaign({ id: 'cmp_1', brandId: 'br_1', escrowHeld: 1500, stage: 'live' })],
      offers: [buildOffer({ id: 'off_1', campaignId: 'cmp_1', creatorId: 'cr_1', rate: 1500, status: 'accepted' })],
      collaborations: [makeCollab()],
      contracts: [makeContract()],
    }));
    useStore.getState().setSession(null);
  });

  it('flips campaign.stage to closed', () => {
    v2EndCampaign('cmp_1');
    const camp = useStore.getState().db.campaigns[0];
    expect(camp.stage).toBe('closed');
  });

  it('auto-cancels confirmed in-flight collabs', () => {
    v2EndCampaign('cmp_1');
    const collab = useStore.getState().db.collaborations[0];
    expect(collab.stage).toBe('cancelled');
  });

  it('refunds escrow back to brand wallet via the per-collab cancellation path', () => {
    v2EndCampaign('cmp_1');
    const brand = useStore.getState().db.brands[0];
    expect(brand.walletBalance).toBe(1500);
    expect(brand.escrowHeld).toBe(0);
  });

  it('marks the contract cancelled', () => {
    v2EndCampaign('cmp_1');
    const ctr = useStore.getState().db.contracts[0];
    expect(ctr.status).toBe('cancelled');
    expect(ctr.cancelledAt).toBeGreaterThan(0);
  });

  it('FIX #5 regression: SKIPS collabs with escrowFrozen=true (open dispute)', () => {
    // Mark the collab as having an open dispute (escrow frozen).
    useStore.getState().setDB({
      ...useStore.getState().db,
      collaborations: [makeCollab({ escrowFrozen: true })],
    });
    const brandBefore = useStore.getState().db.brands[0].walletBalance;
    const escrowBefore = useStore.getState().db.brands[0].escrowHeld;

    v2EndCampaign('cmp_1');

    const db = useStore.getState().db;
    // Campaign closes …
    expect(db.campaigns[0].stage).toBe('closed');
    // … but the frozen collab survives unmodified — its escrow stays.
    expect(db.collaborations[0].stage).toBe('confirmed');
    expect(db.brands[0].walletBalance).toBe(brandBefore); // no refund
    expect(db.brands[0].escrowHeld).toBe(escrowBefore);   // escrow still held
    expect(db.collaborations[0].escrowFrozen).toBe(true);
  });

  it('notifies the creator on the frozen collab', () => {
    useStore.getState().setDB({
      ...useStore.getState().db,
      collaborations: [makeCollab({ escrowFrozen: true })],
    });
    v2EndCampaign('cmp_1');
    const creatorNotifs = useStore.getState().db.notifications.filter((n) => n.userId === 'u_creator');
    const frozenNote = creatorNotifs.find((n) => n.text.includes('dispute'));
    expect(frozenNote).toBeDefined();
  });

  it('does not auto-cancel already-paid collabs (work is closed)', () => {
    // For a paid collab, the escrow was drained at approval time — set
    // up the test consistently with that real-world state (campaign
    // escrow=0, brand escrow=0, creator wallet has the net).
    useStore.getState().setDB({
      ...useStore.getState().db,
      brands: [buildBrand({ id: 'br_1', userId: 'u_brand', escrowHeld: 0, walletBalance: 0 })],
      campaigns: [buildCampaign({ id: 'cmp_1', brandId: 'br_1', escrowHeld: 0, stage: 'live' })],
      collaborations: [makeCollab({ stage: 'paid' })],
    });
    v2EndCampaign('cmp_1');
    const db = useStore.getState().db;
    // Paid collab is NOT auto-cancelled (work is done)
    expect(db.collaborations[0].stage).toBe('paid');
    // Contract still active or fulfilled — not cancelled
    expect(db.contracts[0].status).not.toBe('cancelled');
    // Campaign still closes
    expect(db.campaigns[0].stage).toBe('closed');
  });
});

describe('v2EndCampaign — capability gate', () => {
  it('skips when no actor (test/seed mode)', () => {
    useStore.getState().setDB(buildDb({
      brands: [buildBrand({ id: 'br_1' })],
      campaigns: [buildCampaign({ id: 'cmp_1', brandId: 'br_1', stage: 'live' })],
    }));
    useStore.getState().setSession(null);
    expect(() => v2EndCampaign('cmp_1')).not.toThrow();
  });
});

describe('counter cap (P3 §2.1) — MAX_OFFER_ROUNDS = 4', () => {
  function rounds(arr: { by: 'brand' | 'creator'; rate: number }[]): OfferRound[] {
    return arr.map((r, i) => ({ by: r.by, at: 1745000000000 + i * 1000, rate: r.rate, message: 'msg' }));
  }

  beforeEach(() => {
    useStore.getState().setDB(buildDb({
      users: [userBrand('u_brand', 'br_1'), userCreator('u_creator', 'cr_1')],
      creators: [buildCreator({ id: 'cr_1', userId: 'u_creator' })],
      brands: [buildBrand({ id: 'br_1', userId: 'u_brand' })],
      campaigns: [buildCampaign({ id: 'cmp_1', brandId: 'br_1' })],
      applications: [{
        id: 'app_1', campaignId: 'cmp_1', creatorId: 'cr_1',
        pitch: 'Pitch', proposedRate: 1500, status: 'shortlisted',
        submittedAt: '2026-04-05T00:00:00Z',
      }],
    }));
    useStore.getState().setSession(null);
  });

  it('a counter at rounds.length === 3 (creator’s 3rd round) succeeds; the 4th expires', () => {
    // Setup: rounds[] already has 3 entries (initial + 2 counters).
    useStore.getState().setDB({
      ...useStore.getState().db,
      offers: [buildOffer({
        id: 'off_1',
        campaignId: 'cmp_1',
        creatorId: 'cr_1',
        applicationId: 'app_1',
        status: 'countered',
        rate: 1700,
        rounds: rounds([
          { by: 'brand', rate: 1500 },
          { by: 'creator', rate: 1800 },
          { by: 'brand', rate: 1700 },
        ]),
      })],
    });

    // Creator counters again → 4 entries, succeeds.
    v2CounterOffer('off_1', 1750, 'creator counter');
    expect(useStore.getState().db.offers[0].rounds.length).toBe(4);
    expect(useStore.getState().db.offers[0].status).toBe('countered');

    // Brand tries to counter-counter → would be 5th entry, exceeds cap.
    v2CounterCounter('off_1', 1720, 'brand back');
    const offer = useStore.getState().db.offers[0];
    expect(offer.status).toBe('expired');
    // Round count stayed at 4 (no append on expire).
    expect(offer.rounds.length).toBe(4);
  });

  it('on cap-exceeded, the linked Application rolls back to "submitted"', () => {
    useStore.getState().setDB({
      ...useStore.getState().db,
      offers: [buildOffer({
        id: 'off_1',
        campaignId: 'cmp_1',
        creatorId: 'cr_1',
        applicationId: 'app_1',
        status: 'countered',
        rate: 1700,
        rounds: rounds([
          { by: 'brand', rate: 1500 },
          { by: 'creator', rate: 1800 },
          { by: 'brand', rate: 1700 },
          { by: 'creator', rate: 1750 },
        ]),
      })],
    });

    v2CounterCounter('off_1', 1720, 'brand back'); // 5th attempt, blocks

    const db = useStore.getState().db;
    expect(db.offers[0].status).toBe('expired');
    const app = db.applications.find((a) => a.id === 'app_1');
    expect(app?.status).toBe('submitted'); // rolled back
    expect(app?.decidedAt).toBeUndefined();
  });

  it('mirrors the latest round terms to top-level offer.rate / offer.message', () => {
    useStore.getState().setDB({
      ...useStore.getState().db,
      offers: [buildOffer({
        id: 'off_1',
        campaignId: 'cmp_1',
        creatorId: 'cr_1',
        applicationId: 'app_1',
        status: 'pending',
        rate: 1500,
        rounds: rounds([{ by: 'brand', rate: 1500 }]),
      })],
    });
    v2CounterOffer('off_1', 2000, 'higher please');
    const offer = useStore.getState().db.offers[0];
    expect(offer.rate).toBe(2000);
    expect(offer.message).toBe('higher please');
  });

  it('refuses to land a creator-counter when the latest round was already a creator round', () => {
    useStore.getState().setDB({
      ...useStore.getState().db,
      offers: [buildOffer({
        id: 'off_1',
        campaignId: 'cmp_1',
        creatorId: 'cr_1',
        applicationId: 'app_1',
        status: 'countered',
        rate: 2000,
        rounds: rounds([
          { by: 'brand', rate: 1500 },
          { by: 'creator', rate: 2000 },
        ]),
      })],
    });
    // P62 — v2CounterOffer now throws instead of silently no-oping so
    // the UI can surface "You already sent a counter — waiting on the
    // brand". The store should still be untouched (no new round) which
    // is the original behavioral guarantee this test exists for.
    expect(() => v2CounterOffer('off_1', 2200, 'creator again')).toThrow(
      /already sent a counter/i,
    );
    const offer = useStore.getState().db.offers[0];
    // No new round appended (still 2 entries).
    expect(offer.rounds.length).toBe(2);
  });
});

describe('v2ApplyToCampaign — auto-shortlist (P3 §2.4)', () => {
  beforeEach(() => {
    useStore.getState().setDB(buildDb({
      users: [userCreator('u_creator', 'cr_1'), userBrand('u_brand', 'br_1')],
      creators: [buildCreator({ id: 'cr_1', userId: 'u_creator', categories: ['Beauty'] })],
      brands: [buildBrand({ id: 'br_1', userId: 'u_brand' })],
      campaigns: [buildCampaign({
        id: 'cmp_1',
        brandId: 'br_1',
        category: 'Beauty',
        autoShortlist: { enabled: true, threshold: 70 },
      })],
    }));
    useStore.getState().setSession(null);
  });

  it('exact category match (score=100) auto-shortlists when threshold=70', () => {
    const app = v2ApplyToCampaign('cmp_1', 'cr_1', 'pitch', 1500);
    expect(app?.status).toBe('shortlisted');
    expect(app?.decidedAt).toBeTruthy();
  });

  it('non-matching category stays in submitted', () => {
    useStore.getState().setDB({
      ...useStore.getState().db,
      creators: [buildCreator({ id: 'cr_1', userId: 'u_creator', categories: ['Finance'] })],
    });
    const app = v2ApplyToCampaign('cmp_1', 'cr_1', 'pitch', 1500);
    expect(app?.status).toBe('submitted');
    expect(app?.decidedAt).toBeUndefined();
  });

  it('autoShortlist null/undefined keeps the manual review flow', () => {
    useStore.getState().setDB({
      ...useStore.getState().db,
      campaigns: [buildCampaign({ id: 'cmp_1', brandId: 'br_1', category: 'Beauty', autoShortlist: null })],
    });
    const app = v2ApplyToCampaign('cmp_1', 'cr_1', 'pitch', 1500);
    expect(app?.status).toBe('submitted');
  });

  it('adjacent category (score=50) is below the 70 threshold', () => {
    useStore.getState().setDB({
      ...useStore.getState().db,
      // Tech is adjacent to Gaming per ADJACENT table; threshold 70 → no auto-shortlist.
      creators: [buildCreator({ id: 'cr_1', userId: 'u_creator', categories: ['Tech'] })],
      campaigns: [buildCampaign({
        id: 'cmp_1',
        brandId: 'br_1',
        category: 'Gaming',
        autoShortlist: { enabled: true, threshold: 70 },
      })],
    });
    const app = v2ApplyToCampaign('cmp_1', 'cr_1', 'pitch', 1500);
    expect(app?.status).toBe('submitted');
  });

  it('adjacent category is enough when threshold is lowered to 50', () => {
    useStore.getState().setDB({
      ...useStore.getState().db,
      creators: [buildCreator({ id: 'cr_1', userId: 'u_creator', categories: ['Tech'] })],
      campaigns: [buildCampaign({
        id: 'cmp_1',
        brandId: 'br_1',
        category: 'Gaming',
        autoShortlist: { enabled: true, threshold: 50 },
      })],
    });
    const app = v2ApplyToCampaign('cmp_1', 'cr_1', 'pitch', 1500);
    expect(app?.status).toBe('shortlisted');
  });
});

// Touch v2SendOffer just to keep its imports referenced (no test yet —
// covered by ensure-collab-state and downstream contract creation).
void v2SendOffer;
