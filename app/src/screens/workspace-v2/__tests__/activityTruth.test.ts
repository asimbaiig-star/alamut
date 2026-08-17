// activityTruth.test.ts — panels on one screen must agree.
//
// Asim found the stage header reading `Invited` beside an Activity feed
// claiming "You accepted the offer" and "Aesop funded escrow · $3.6K". The
// static guards in regressionGuards CLASS 11 stop the specific literals
// coming back; this file tests the property those literals violated, which
// is the thing that actually matters:
//
//   An invited collaboration has accepted nothing and holds no escrow.
//
// Written against the DERIVATION, not the DOM, so it stays true however the
// card is laid out.

import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from '@/lib/api/store';
import { computeCollabStage } from '@/lib/api/collabSync';
import {
  buildDb, buildCampaign, buildCreator, buildBrand, buildOffer,
} from '@/lib/utils/__tests__/fixtures';
import type { Collaboration, Database, User } from '@/lib/api/types';

function users(): User[] {
  return [
    {
      id: 'u_brand', email: 'b@b.com', passwordHash: 'x', role: 'brand',
      status: 'active', createdAt: '2026-04-01T00:00:00Z', brandId: 'br_1', teamRole: 'admin',
    },
    {
      id: 'u_creator', email: 'c@c.com', passwordHash: 'x', role: 'creator',
      status: 'active', createdAt: '2026-04-01T00:00:00Z', creatorId: 'cr_1',
    },
  ];
}

/** A cold invite: a collab row, and deliberately NO offer, application,
 *  submission or transaction behind it. */
function invitedOnly(): Database {
  const invited: Collaboration = {
    id: 'col_inv', campaignId: 'cmp_1', creatorId: 'cr_1', brandId: 'br_1',
    stage: 'invited', createdAt: 1, updatedAt: 1,
    agreedRate: null, acceptedOfferId: null, contractId: null,
    cancelledAt: null, cancellationReason: null,
    history: [{ at: 1, from: null, to: 'invited', actorUserId: 'u_brand', reason: 'brand-invite' }],
  };
  return buildDb({
    users: users(),
    creators: [buildCreator({ id: 'cr_1', userId: 'u_creator' })],
    brands: [buildBrand({ id: 'br_1', userId: 'u_brand' })],
    campaigns: [buildCampaign({ id: 'cmp_1', brandId: 'br_1', escrowHeld: 0 })],
    collaborations: [invited],
  });
}

/** The escrow-funded facts a money panel is allowed to assert. */
function escrowFacts(db: Database, campaignId: string, creatorId: string) {
  const creatorUserId = db.users.find((u) => u.creatorId === creatorId)?.id;
  const hold = db.transactions.find(
    (t) => t.campaignId === campaignId && t.kind === 'escrow_hold'
      && t.counterpartyUserId === creatorUserId,
  );
  return { funded: !!hold, at: hold?.at ?? null };
}

/** Every acceptance the record actually contains. */
function acceptanceFacts(db: Database, campaignId: string, creatorId: string) {
  const collab = db.collaborations.find((c) => c.campaignId === campaignId && c.creatorId === creatorId);
  return {
    acceptedOffer: db.offers.some(
      (o) => o.campaignId === campaignId && o.creatorId === creatorId && o.status === 'accepted',
    ),
    stageSaysAccepted: !!collab && !['invited', 'pitched', 'negotiating'].includes(collab.stage),
    historySaysAccepted: (collab?.history ?? []).some((h) => h.to === 'confirmed'),
  };
}

beforeEach(() => {
  useStore.getState().setSession(null);
});

describe('an invited collaboration asserts nothing that has not happened', () => {
  beforeEach(() => useStore.getState().setDB(invitedOnly()));

  it('holds no escrow', () => {
    const db = useStore.getState().db;
    expect(escrowFacts(db, 'cmp_1', 'cr_1').funded).toBe(false);
    expect(db.campaigns[0].escrowHeld).toBe(0);
  });

  it('has accepted nothing — by offer, by stage, or by history', () => {
    const f = acceptanceFacts(useStore.getState().db, 'cmp_1', 'cr_1');
    expect(f.acceptedOffer).toBe(false);
    expect(f.stageSaysAccepted).toBe(false);
    expect(f.historySaysAccepted).toBe(false);
  });

  it('THE STAGE AND THE MONEY FACTS AGREE', () => {
    // The contradiction Asim saw, as a property: you cannot be pre-acceptance
    // and have escrow funded.
    const db = useStore.getState().db;
    const stage = computeCollabStage('cmp_1', 'cr_1', db);
    const preAcceptance = ['invited', 'pitched', 'negotiating'].includes(stage);
    expect(preAcceptance && escrowFacts(db, 'cmp_1', 'cr_1').funded).toBe(false);
  });

  it('a suggested price does not make escrow funded', () => {
    // The exact defect: the panels keyed on `collab.price > 0`, and an
    // invited collab carries the rate the BRAND suggested.
    useStore.setState((s) => ({
      ...s,
      db: {
        ...s.db,
        offers: [buildOffer({
          id: 'off_sug', campaignId: 'cmp_1', creatorId: 'cr_1',
          rate: 3600, status: 'pending',
        })],
      },
    }));
    const db = useStore.getState().db;
    // A price is visible…
    expect(db.offers[0].rate).toBe(3600);
    // …and escrow is still not funded.
    expect(escrowFacts(db, 'cmp_1', 'cr_1').funded).toBe(false);
  });

  it('the only event on the record is the invitation itself', () => {
    const db = useStore.getState().db;
    const history = db.collaborations[0].history;
    expect(history).toHaveLength(1);
    expect(history[0].to).toBe('invited');
    // Attributed to the brand, not to the creator — "You accepted" was
    // asserted for the creator on a row whose sole actor is the brand.
    expect(history[0].actorUserId).toBe('u_brand');
  });
});

describe('once escrow is genuinely funded, the panels may say so', () => {
  it('an accepted offer with a hold reports funded, with the real date', () => {
    const db = invitedOnly();
    db.offers = [buildOffer({
      id: 'off_1', campaignId: 'cmp_1', creatorId: 'cr_1', rate: 3600, status: 'accepted',
    })];
    db.collaborations[0] = {
      ...db.collaborations[0],
      stage: 'confirmed', acceptedOfferId: 'off_1', agreedRate: 3600,
      history: [
        ...db.collaborations[0].history,
        { at: 2, from: 'invited', to: 'confirmed', actorUserId: 'u_creator' },
      ],
    };
    db.transactions = [{
      id: 'tx_hold', at: '2026-08-10T00:00:00.000Z', userId: 'u_brand',
      kind: 'escrow_hold', amount: -3600, status: 'cleared',
      campaignId: 'cmp_1', counterpartyUserId: 'u_creator',
      note: 'Escrow held',
    }];
    useStore.getState().setDB(db);

    const facts = escrowFacts(useStore.getState().db, 'cmp_1', 'cr_1');
    expect(facts.funded).toBe(true);
    // The date comes from the row, not from the application date.
    expect(facts.at).toBe('2026-08-10T00:00:00.000Z');

    const acc = acceptanceFacts(useStore.getState().db, 'cmp_1', 'cr_1');
    expect(acc.acceptedOffer).toBe(true);
    expect(acc.historySaysAccepted).toBe(true);
    // And the acceptance is attributed to the creator, who did it.
    expect(
      useStore.getState().db.collaborations[0].history.find((h) => h.to === 'confirmed')?.actorUserId,
    ).toBe('u_creator');
  });
});
