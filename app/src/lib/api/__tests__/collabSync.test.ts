// collabSync.test.ts — P1c stage-computation rules + ensureCollabState
// invariants. The pure function `computeCollabStage` is called from 35+
// mutations; locking in its output is the central contract that keeps
// `Collaboration.stage` in lockstep with the underlying app/offer/sub
// records.
//
// `_legacyComputeCollabStage` (inside `migrations.ts`) is supposed to
// mirror this same logic — when these tests change, the migrator copy
// has to change in lockstep too.

import { describe, it, expect } from 'vitest';
import { computeCollabStage, ensureCollabState } from '../collabSync';
import type { Database } from '../types';
import {
  buildDb, buildCampaign, buildCreator, buildBrand,
  buildOffer, buildApplication, buildSubmission, buildTransaction,
} from '@/lib/utils/__tests__/fixtures';

function setupBaseDb(extras: Partial<Database> = {}): Database {
  return buildDb({
    users: [
      {
        id: 'u_creator', email: 'c@x.com', passwordHash: 'demo',
        role: 'creator', status: 'active', createdAt: '2026-04-01T00:00:00Z',
        creatorId: 'cr_1',
      },
      {
        id: 'u_brand', email: 'b@x.com', passwordHash: 'demo',
        role: 'brand', status: 'active', createdAt: '2026-04-01T00:00:00Z',
        brandId: 'br_1', teamRole: 'admin',
      },
    ],
    creators: [buildCreator({ id: 'cr_1', userId: 'u_creator' })],
    brands: [buildBrand({ id: 'br_1', userId: 'u_brand' })],
    campaigns: [buildCampaign({ id: 'cmp_1', brandId: 'br_1' })],
    ...extras,
  });
}

describe('computeCollabStage — 9 stage rules', () => {
  it('returns "invited" when no apps/offers/subs exist', () => {
    const db = setupBaseDb();
    expect(computeCollabStage('cmp_1', 'cr_1', db)).toBe('invited');
  });

  it('returns "pitched" when an Application is submitted (no offer yet)', () => {
    const db = setupBaseDb({
      applications: [buildApplication({
        id: 'app_1', campaignId: 'cmp_1', creatorId: 'cr_1', status: 'submitted',
      })],
    });
    expect(computeCollabStage('cmp_1', 'cr_1', db)).toBe('pitched');
  });

  it('returns "pitched" when an Application is shortlisted', () => {
    const db = setupBaseDb({
      applications: [buildApplication({
        id: 'app_1', campaignId: 'cmp_1', creatorId: 'cr_1', status: 'shortlisted',
      })],
    });
    expect(computeCollabStage('cmp_1', 'cr_1', db)).toBe('pitched');
  });

  it('returns "negotiating" when an Offer is pending', () => {
    const db = setupBaseDb({
      offers: [buildOffer({
        id: 'off_1', campaignId: 'cmp_1', creatorId: 'cr_1', status: 'pending',
      })],
    });
    expect(computeCollabStage('cmp_1', 'cr_1', db)).toBe('negotiating');
  });

  it('returns "negotiating" when an Offer is countered', () => {
    const db = setupBaseDb({
      offers: [buildOffer({
        id: 'off_1', campaignId: 'cmp_1', creatorId: 'cr_1', status: 'countered',
      })],
    });
    expect(computeCollabStage('cmp_1', 'cr_1', db)).toBe('negotiating');
  });

  it('returns "confirmed" when an Offer is accepted (no submission yet)', () => {
    const db = setupBaseDb({
      offers: [buildOffer({
        id: 'off_1', campaignId: 'cmp_1', creatorId: 'cr_1', status: 'accepted',
      })],
    });
    expect(computeCollabStage('cmp_1', 'cr_1', db)).toBe('confirmed');
  });

  it('returns "submitted" when latest submission is in_review', () => {
    const db = setupBaseDb({
      offers: [buildOffer({
        id: 'off_1', campaignId: 'cmp_1', creatorId: 'cr_1', status: 'accepted',
      })],
      submissions: [buildSubmission({
        id: 'sub_1', campaignId: 'cmp_1', creatorId: 'cr_1', status: 'in_review',
      })],
    });
    expect(computeCollabStage('cmp_1', 'cr_1', db)).toBe('submitted');
  });

  it('returns "submitted" when latest submission is revisions (still under review per brief)', () => {
    const db = setupBaseDb({
      offers: [buildOffer({
        id: 'off_1', campaignId: 'cmp_1', creatorId: 'cr_1', status: 'accepted',
      })],
      submissions: [buildSubmission({
        id: 'sub_1', campaignId: 'cmp_1', creatorId: 'cr_1', status: 'revisions',
      })],
    });
    expect(computeCollabStage('cmp_1', 'cr_1', db)).toBe('submitted');
  });

  it('returns "approved" when submission approved but no permalink', () => {
    const db = setupBaseDb({
      offers: [buildOffer({
        id: 'off_1', campaignId: 'cmp_1', creatorId: 'cr_1', status: 'accepted',
      })],
      submissions: [buildSubmission({
        id: 'sub_1', campaignId: 'cmp_1', creatorId: 'cr_1',
        status: 'approved',
        // no permalink, no LIVE feedback
      })],
    });
    expect(computeCollabStage('cmp_1', 'cr_1', db)).toBe('approved');
  });

  it('returns "live" when approved submission has a permalink', () => {
    const db = setupBaseDb({
      offers: [buildOffer({
        id: 'off_1', campaignId: 'cmp_1', creatorId: 'cr_1', status: 'accepted',
      })],
      submissions: [buildSubmission({
        id: 'sub_1', campaignId: 'cmp_1', creatorId: 'cr_1',
        status: 'approved',
        permalink: 'https://instagram.com/p/abc123',
      })],
    });
    expect(computeCollabStage('cmp_1', 'cr_1', db)).toBe('live');
  });

  it('returns "live" when approved submission has legacy LIVE: feedback (pre-permalink-field path)', () => {
    const db = setupBaseDb({
      offers: [buildOffer({
        id: 'off_1', campaignId: 'cmp_1', creatorId: 'cr_1', status: 'accepted',
      })],
      submissions: [buildSubmission({
        id: 'sub_1', campaignId: 'cmp_1', creatorId: 'cr_1',
        status: 'approved',
        feedback: [{ from: 'system', text: 'LIVE: https://x.com/p/y', at: '2026-04-22T00:00:00Z' }],
      })],
    });
    expect(computeCollabStage('cmp_1', 'cr_1', db)).toBe('live');
  });

  it('returns "paid" only when campaign is closed AND payout cleared AND submission is live', () => {
    // Workflow audit: pre-fix `computeCollabStage` flipped to 'paid'
    // the moment any cleared payout existed — which made the kanban
    // skip past 'approved' AND past 'live' the instant the brand
    // approved content. Correct behavior: 'paid' is terminal and
    // requires (a) campaign closed, (b) payout cleared, AND
    // (c) submission is live (permalink set or LIVE feedback).
    const db = setupBaseDb({
      campaigns: [buildCampaign({ id: 'cmp_1', brandId: 'br_1', stage: 'closed' })],
      offers: [buildOffer({
        id: 'off_1', campaignId: 'cmp_1', creatorId: 'cr_1', status: 'accepted',
      })],
      submissions: [buildSubmission({
        id: 'sub_1', campaignId: 'cmp_1', creatorId: 'cr_1', status: 'approved',
        permalink: 'https://instagram.com/p/x',
      })],
      transactions: [buildTransaction({
        id: 'tx_1',
        campaignId: 'cmp_1',
        userId: 'u_creator',
        counterpartyUserId: 'u_brand',
        kind: 'payout',
        amount: 1275,
        status: 'cleared',
      })],
    });
    expect(computeCollabStage('cmp_1', 'cr_1', db)).toBe('paid');
  });

  it('returns "approved" when payout cleared but campaign is still live (post not yet up)', () => {
    // Regression for the workflow audit: a cleared payout no longer
    // implies 'paid' on its own. The submission is approved but no
    // permalink is set yet — stage should be 'approved' so the
    // creator knows the post still needs to go up.
    const db = setupBaseDb({
      offers: [buildOffer({
        id: 'off_1', campaignId: 'cmp_1', creatorId: 'cr_1', status: 'accepted',
      })],
      submissions: [buildSubmission({
        id: 'sub_1', campaignId: 'cmp_1', creatorId: 'cr_1', status: 'approved',
      })],
      transactions: [buildTransaction({
        id: 'tx_1',
        campaignId: 'cmp_1',
        userId: 'u_brand',
        counterpartyUserId: 'u_creator',
        kind: 'escrow_release',
        amount: -1500,
        status: 'cleared',
      })],
    });
    expect(computeCollabStage('cmp_1', 'cr_1', db)).toBe('approved');
  });

  it('returns "live" when submission has permalink + payout cleared but campaign still live', () => {
    // Post is up + payout cleared but campaign hasn't been closed
    // yet — stage is 'live', not 'paid'. The 'paid' transition is
    // gated on campaign close so the kanban accurately reflects that
    // the deal is still in flight.
    const db = setupBaseDb({
      offers: [buildOffer({
        id: 'off_1', campaignId: 'cmp_1', creatorId: 'cr_1', status: 'accepted',
      })],
      submissions: [buildSubmission({
        id: 'sub_1', campaignId: 'cmp_1', creatorId: 'cr_1', status: 'approved',
        permalink: 'https://instagram.com/p/y',
      })],
      transactions: [buildTransaction({
        id: 'tx_1',
        campaignId: 'cmp_1',
        userId: 'u_brand',
        counterpartyUserId: 'u_creator',
        kind: 'escrow_release',
        amount: -1500,
        status: 'cleared',
      })],
    });
    expect(computeCollabStage('cmp_1', 'cr_1', db)).toBe('live');
  });

  it('returns "cancelled" when ALL apps + offers are declined/withdrawn/rejected (no submissions)', () => {
    const db = setupBaseDb({
      applications: [buildApplication({
        id: 'app_1', campaignId: 'cmp_1', creatorId: 'cr_1', status: 'rejected',
      })],
      offers: [buildOffer({
        id: 'off_1', campaignId: 'cmp_1', creatorId: 'cr_1', status: 'declined',
      })],
    });
    expect(computeCollabStage('cmp_1', 'cr_1', db)).toBe('cancelled');
  });

  it('does NOT return "cancelled" when there is also an accepted offer (mixed history)', () => {
    // A pair could have: declined first offer + new accepted offer.
    // Most-progressed signal (accepted) wins — collab is 'confirmed'.
    const db = setupBaseDb({
      offers: [
        buildOffer({ id: 'off_old', campaignId: 'cmp_1', creatorId: 'cr_1', status: 'declined' }),
        buildOffer({ id: 'off_new', campaignId: 'cmp_1', creatorId: 'cr_1', status: 'accepted' }),
      ],
    });
    expect(computeCollabStage('cmp_1', 'cr_1', db)).toBe('confirmed');
  });

  it('most-progressed signal wins (accepted > pending > app)', () => {
    // Concurrent: app shortlisted + offer accepted → confirmed wins.
    const db = setupBaseDb({
      applications: [buildApplication({
        id: 'app_1', campaignId: 'cmp_1', creatorId: 'cr_1', status: 'shortlisted',
      })],
      offers: [buildOffer({
        id: 'off_1', campaignId: 'cmp_1', creatorId: 'cr_1', status: 'accepted',
      })],
    });
    expect(computeCollabStage('cmp_1', 'cr_1', db)).toBe('confirmed');
  });
});

describe('ensureCollabState — find-or-create + history append', () => {
  it('creates a new Collaboration row when none exists, with current stage + initial history entry', () => {
    const db = setupBaseDb({
      offers: [buildOffer({
        id: 'off_1', campaignId: 'cmp_1', creatorId: 'cr_1', status: 'pending',
      })],
    });
    expect(db.collaborations.length).toBe(0);

    const collab = ensureCollabState('cmp_1', 'cr_1', db, 'u_brand', 'offer-sent');
    expect(collab).not.toBeNull();
    expect(db.collaborations.length).toBe(1);
    expect(collab!.stage).toBe('negotiating');
    expect(collab!.brandId).toBe('br_1');
    expect(collab!.history.length).toBe(1);
    expect(collab!.history[0].from).toBeNull();
    expect(collab!.history[0].to).toBe('negotiating');
    expect(collab!.history[0].actorUserId).toBe('u_brand');
    expect(collab!.history[0].reason).toBe('offer-sent');
  });

  it('updates existing Collaboration when stage changes + appends history entry', () => {
    const db = setupBaseDb({
      offers: [buildOffer({
        id: 'off_1', campaignId: 'cmp_1', creatorId: 'cr_1', status: 'pending',
      })],
    });
    ensureCollabState('cmp_1', 'cr_1', db, 'u_brand', 'offer-sent');
    expect(db.collaborations[0].history.length).toBe(1);

    // Now flip the offer to accepted and re-run.
    db.offers[0] = { ...db.offers[0], status: 'accepted' };
    ensureCollabState('cmp_1', 'cr_1', db, 'u_creator', 'offer-accepted');

    const collab = db.collaborations[0];
    expect(collab.stage).toBe('confirmed');
    expect(collab.history.length).toBe(2);
    expect(collab.history[1].from).toBe('negotiating');
    expect(collab.history[1].to).toBe('confirmed');
    expect(collab.history[1].actorUserId).toBe('u_creator');
  });

  it('does NOT append history when the stage is unchanged (idempotent re-run)', () => {
    const db = setupBaseDb({
      offers: [buildOffer({
        id: 'off_1', campaignId: 'cmp_1', creatorId: 'cr_1', status: 'pending',
      })],
    });
    ensureCollabState('cmp_1', 'cr_1', db, 'u_brand', 'first');
    ensureCollabState('cmp_1', 'cr_1', db, 'u_brand', 'second-call-same-stage');
    ensureCollabState('cmp_1', 'cr_1', db, 'u_brand', 'third');

    expect(db.collaborations[0].history.length).toBe(1); // not 3
  });

  it('returns null when the campaign does not exist', () => {
    const db = setupBaseDb();
    const collab = ensureCollabState('cmp_does_not_exist', 'cr_1', db, 'u_brand');
    expect(collab).toBeNull();
    expect(db.collaborations.length).toBe(0);
  });

  it('tracks agreedRate and acceptedOfferId from the latest accepted offer', () => {
    const db = setupBaseDb({
      offers: [
        buildOffer({ id: 'off_1', campaignId: 'cmp_1', creatorId: 'cr_1', rate: 1500, status: 'declined' }),
        buildOffer({
          id: 'off_2', campaignId: 'cmp_1', creatorId: 'cr_1',
          rate: 1800, status: 'accepted',
          sentAt: '2026-04-15T00:00:00Z', respondedAt: '2026-04-16T00:00:00Z',
        }),
      ],
    });
    const collab = ensureCollabState('cmp_1', 'cr_1', db, 'u_creator');
    expect(collab!.agreedRate).toBe(1800);
    expect(collab!.acceptedOfferId).toBe('off_2');
  });

  it('backfills collaborationId on Application/Offer/Submission rows (P1c FK invariant)', () => {
    const db = setupBaseDb({
      applications: [buildApplication({
        id: 'app_1', campaignId: 'cmp_1', creatorId: 'cr_1', status: 'submitted',
      })],
      offers: [buildOffer({
        id: 'off_1', campaignId: 'cmp_1', creatorId: 'cr_1', status: 'pending',
      })],
      submissions: [buildSubmission({
        id: 'sub_1', campaignId: 'cmp_1', creatorId: 'cr_1', status: 'in_review',
      })],
    });
    const collab = ensureCollabState('cmp_1', 'cr_1', db, 'u_creator');

    // All three child entities now point at the new Collaboration.
    expect(db.applications[0].collaborationId).toBe(collab!.id);
    expect(db.offers[0].collaborationId).toBe(collab!.id);
    expect(db.submissions[0].collaborationId).toBe(collab!.id);
  });

  it('sets cancelledAt + cancellationReason when computed stage becomes "cancelled"', () => {
    const db = setupBaseDb({
      offers: [buildOffer({
        id: 'off_1', campaignId: 'cmp_1', creatorId: 'cr_1', status: 'declined',
      })],
    });
    const collab = ensureCollabState('cmp_1', 'cr_1', db, 'u_creator', 'creator-declined');
    expect(collab!.stage).toBe('cancelled');
    expect(collab!.cancelledAt).toBeGreaterThan(0);
    expect(collab!.cancellationReason).toBe('creator-declined');
  });

  it('uses deterministic id format col_<base36(hash)> so re-runs find the same row', () => {
    const db = setupBaseDb({
      offers: [buildOffer({
        id: 'off_1', campaignId: 'cmp_1', creatorId: 'cr_1', status: 'pending',
      })],
    });
    const c1 = ensureCollabState('cmp_1', 'cr_1', db, 'u_brand');
    const id1 = c1!.id;
    expect(id1).toMatch(/^col_[a-z0-9]+$/);

    // Re-run on a fresh db with the same ids — should generate the same hash.
    const db2 = setupBaseDb({
      offers: [buildOffer({
        id: 'off_1', campaignId: 'cmp_1', creatorId: 'cr_1', status: 'pending',
      })],
    });
    const c2 = ensureCollabState('cmp_1', 'cr_1', db2, 'u_brand');
    expect(c2!.id).toBe(id1); // same (campaignId, creatorId) → same hash
  });

  it('different (campaignId, creatorId) pairs produce different ids', () => {
    const db = setupBaseDb({
      creators: [
        buildCreator({ id: 'cr_1', userId: 'u_creator' }),
        buildCreator({ id: 'cr_2', userId: 'u_creator2' }),
      ],
      offers: [
        buildOffer({ id: 'off_1', campaignId: 'cmp_1', creatorId: 'cr_1', status: 'pending' }),
        buildOffer({ id: 'off_2', campaignId: 'cmp_1', creatorId: 'cr_2', status: 'pending' }),
      ],
    });
    const c1 = ensureCollabState('cmp_1', 'cr_1', db, '');
    const c2 = ensureCollabState('cmp_1', 'cr_2', db, '');
    expect(c1!.id).not.toBe(c2!.id);
  });
});
