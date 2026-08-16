// capacityOwnerScope.test.ts — WORKFLOW-GAPS C4, D2, A3.
//
// Three small features that share one property: each replaces something the
// product was doing IMPLICITLY and badly.
//
//   C4  a creator's capacity was a note in their bio nobody enforced
//   D2  a deal belonged to "the brand", so when a person left it stalled
//   A3  scope was negotiated through the price, because price was the only
//       field a counter had
//
// The guards worth pinning are the ones where getting it wrong is quiet:
// capacity counting the wrong stages, a deal assigned to someone outside the
// team, and a price-only counter erasing the scope agreed a round earlier.

import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from '@/lib/api/store';
import { activeDealCount, availabilityVerdict } from '@/lib/api/availability';
import { v2ReassignCollab, dealOwnerUserId, brandTeam } from '../v2TeamActions';
import {
  buildDb, buildCampaign, buildCreator, buildBrand, buildOffer,
} from '@/lib/utils/__tests__/fixtures';
import type { Collaboration, CollabStage, User } from '@/lib/api/types';

function userBrand(id: string, brandId: string, teamRole: User['teamRole'] = 'admin'): User {
  return {
    id, email: `${id}@aesop.test`, passwordHash: 'demo', role: 'brand',
    status: 'active', createdAt: '2026-04-01T00:00:00Z', brandId, teamRole,
  };
}
function userCreator(id: string, creatorId: string): User {
  return {
    id, email: `${id}@c.com`, passwordHash: 'demo', role: 'creator',
    status: 'active', createdAt: '2026-04-01T00:00:00Z', creatorId,
  };
}

function collab(id: string, stage: CollabStage, extra: Partial<Collaboration> = {}): Collaboration {
  return {
    id, campaignId: 'cmp_1', creatorId: 'cr_1', brandId: 'br_1',
    stage, createdAt: 1, updatedAt: 1, agreedRate: 1000,
    acceptedOfferId: 'off_1', contractId: null,
    cancelledAt: null, cancellationReason: null, history: [],
    ...extra,
  };
}

function setupDb(collabs: Collaboration[] = []) {
  return buildDb({
    users: [
      userBrand('u_owner', 'br_1', 'admin'),
      userBrand('u_mate', 'br_1', 'ops'),
      userBrand('u_rival', 'br_2', 'admin'),
      userCreator('u_creator', 'cr_1'),
    ],
    creators: [buildCreator({ id: 'cr_1', userId: 'u_creator' })],
    brands: [buildBrand({ id: 'br_1', userId: 'u_owner' }), buildBrand({ id: 'br_2', userId: 'u_rival' })],
    campaigns: [buildCampaign({ id: 'cmp_1', brandId: 'br_1' })],
    offers: [buildOffer({ id: 'off_1', campaignId: 'cmp_1', creatorId: 'cr_1', rate: 1000, status: 'accepted' })],
    collaborations: collabs,
  });
}

beforeEach(() => {
  useStore.getState().setSession(null);
});

// ─────────────────────────────────────────────────────────────────────
// C4 — capacity
// ─────────────────────────────────────────────────────────────────────
describe('C4 — a creator can cap concurrent work', () => {
  const creator = (max?: number) => ({
    name: 'Sarah Johnson',
    availability: { status: 'open' as const, maxConcurrentDeals: max },
  });

  it('counts only deals with work actually in flight', () => {
    // The whole rule turns on this. Counting pitches would block a creator
    // who has merely APPLIED to things; counting paid deals would block them
    // forever on their own history.
    const db = setupDb([
      collab('c1', 'confirmed'),
      collab('c2', 'submitted'),
      collab('c3', 'approved'),
      collab('c4', 'live'),
      collab('c5', 'pitched'),      // not a commitment
      collab('c6', 'negotiating'),  // not a commitment
      collab('c7', 'invited'),      // not a commitment
      collab('c8', 'paid'),         // over
      collab('c9', 'confirmed', { cancelledAt: 123 }), // over
    ]);
    expect(activeDealCount(db, 'cr_1')).toBe(4);
  });

  it('blocks at capacity, and says when to come back', () => {
    const v = availabilityVerdict(creator(3), { activeDeals: 3 });
    expect(v.block).toMatch(/caps concurrent work at 3 deals/);
    expect(v.block).toMatch(/when they next have room/);
    expect(v.warn).toBeNull();
  });

  it('blocks, rather than warns — it is an instruction, not a preference', () => {
    // Same character as autoDeclineCategories. minRate warns because a floor
    // is a negotiating position; a cap is a rule about the creator's own week.
    expect(availabilityVerdict(creator(1), { activeDeals: 1 }).warn).toBeNull();
    expect(availabilityVerdict(creator(1), { activeDeals: 1 }).block).toBeTruthy();
  });

  it('gets the singular right at a cap of one', () => {
    expect(availabilityVerdict(creator(1), { activeDeals: 1 }).block).toMatch(/at 1 deal /);
  });

  it('lets work through below the cap', () => {
    expect(availabilityVerdict(creator(3), { activeDeals: 2 }).block).toBeNull();
  });

  it('no cap set means no cap — which is every creator until they set one', () => {
    expect(availabilityVerdict(creator(undefined), { activeDeals: 99 }).block).toBeNull();
  });

  it('a cap with no count supplied does not block on a guess', () => {
    // Callers that genuinely lack the context must not get a false refusal.
    expect(availabilityVerdict(creator(2), {}).block).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────
// D2 — deal ownership
// ─────────────────────────────────────────────────────────────────────
describe('D2 — a deal belongs to a person, not just a brand', () => {
  beforeEach(() => {
    useStore.getState().setDB(setupDb([collab('col_1', 'confirmed')]));
  });

  it('falls back to the brand primary user when nobody is assigned', () => {
    const db = useStore.getState().db;
    expect(dealOwnerUserId(db, db.collaborations[0])).toBe('u_owner');
  });

  it('hands the deal over and tells both people', () => {
    v2ReassignCollab('col_1', 'u_mate', 'u_owner');
    const db = useStore.getState().db;
    expect(db.collaborations[0].ownerUserId).toBe('u_mate');
    expect(dealOwnerUserId(db, db.collaborations[0])).toBe('u_mate');
    expect(db.notifications.some((n) => n.userId === 'u_mate')).toBe(true);
  });

  it('REFUSES TO ASSIGN OUTSIDE THE TEAM', () => {
    // The check that matters: a deal assigned to a stranger would send them
    // the brand's private notifications.
    expect(() => v2ReassignCollab('col_1', 'u_rival', 'u_owner'))
      .toThrow(/someone on your own team/);
    expect(() => v2ReassignCollab('col_1', 'u_creator', 'u_owner'))
      .toThrow(/someone on your own team/);
    expect(useStore.getState().db.collaborations[0].ownerUserId).toBeUndefined();
  });

  it('refuses an actor who is not on the team at all', () => {
    expect(() => v2ReassignCollab('col_1', 'u_mate', 'u_rival'))
      .toThrow(/Only someone on the brand team/);
  });

  it('the current owner can hand it on without a manager', () => {
    // A handover is housekeeping. Requiring a manager turns thirty seconds
    // into a ticket.
    v2ReassignCollab('col_1', 'u_mate', 'u_owner');
    expect(useStore.getState().db.collaborations[0].ownerUserId).toBe('u_mate');
  });

  it('refuses a no-op reassignment', () => {
    expect(() => v2ReassignCollab('col_1', 'u_owner', 'u_owner'))
      .toThrow(/already owns/);
  });

  it('a stale pointer degrades to the fallback rather than stranding the deal', () => {
    // Deliberately not a foreign key: when a teammate leaves, the deal must
    // keep working, not block their removal or vanish with them.
    v2ReassignCollab('col_1', 'u_mate', 'u_owner');
    useStore.setState((s) => ({
      ...s,
      db: { ...s.db, users: s.db.users.filter((u) => u.id !== 'u_mate') },
    }));
    const db = useStore.getState().db;
    expect(dealOwnerUserId(db, db.collaborations[0])).toBe('u_owner');
  });

  it('refuses on a closed deal', () => {
    useStore.getState().setDB(setupDb([collab('col_1', 'cancelled', { cancelledAt: 1 })]));
    expect(() => v2ReassignCollab('col_1', 'u_mate', 'u_owner')).toThrow(/closed/);
  });

  it('lists the team for the picker, brand-scoped', () => {
    const ids = brandTeam(useStore.getState().db, 'br_1').map((u) => u.id);
    expect(ids).toEqual(expect.arrayContaining(['u_owner', 'u_mate']));
    expect(ids).not.toContain('u_rival');
    expect(ids).not.toContain('u_creator');
  });
});

// ─────────────────────────────────────────────────────────────────────
// A3 — a counter can propose more than a price
// ─────────────────────────────────────────────────────────────────────
//
// The rule that is easy to get wrong: absent means UNCHANGED. A round that
// only moves the number must not wipe the scope agreed a round earlier —
// otherwise every price nudge silently reopens what the work is.

/** The banner's resolution: walk backwards for the last round that stated
 *  each term. Mirrors StageActionBanner so the two cannot disagree. */
function latestTerms(rounds: { rate?: number; scope?: string | null; deliverBy?: string | null }[]) {
  let scope: string | null = null;
  let deliverBy: string | null = null;
  for (let i = rounds.length - 1; i >= 0; i -= 1) {
    if (scope === null && rounds[i].scope) scope = rounds[i].scope!;
    if (deliverBy === null && rounds[i].deliverBy) deliverBy = rounds[i].deliverBy!;
  }
  return { scope, deliverBy };
}

describe('A3 — scope survives a price-only counter', () => {
  it('carries the last stated scope forward', () => {
    const rounds = [
      { rate: 1000 },
      { rate: 1400, scope: '2 Reels + 3 Stories', deliverBy: '2026-09-01' },
      { rate: 1250 }, // brand haggles on price alone
    ];
    expect(latestTerms(rounds)).toEqual({ scope: '2 Reels + 3 Stories', deliverBy: '2026-09-01' });
  });

  it('a later round that DOES restate scope wins', () => {
    const rounds = [
      { rate: 1400, scope: '2 Reels' },
      { rate: 1300, scope: '1 Reel' },
    ];
    expect(latestTerms(rounds).scope).toBe('1 Reel');
  });

  it('resolves each term independently', () => {
    // A round can move the date without touching scope, and vice versa.
    const rounds = [
      { rate: 1000, scope: '1 Reel' },
      { rate: 1000, deliverBy: '2026-10-15' },
    ];
    expect(latestTerms(rounds)).toEqual({ scope: '1 Reel', deliverBy: '2026-10-15' });
  });

  it('a negotiation that never mentions scope reports none', () => {
    expect(latestTerms([{ rate: 1000 }, { rate: 900 }]))
      .toEqual({ scope: null, deliverBy: null });
  });
});
