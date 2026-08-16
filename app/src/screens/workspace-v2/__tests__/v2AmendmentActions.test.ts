// v2AmendmentActions.test.ts — WORKFLOW-GAPS E2 + E3.
//
// Two invariants carry most of the weight here.
//
// CONSERVATION, as everywhere money moves: what leaves the brand equals what
// reaches the creator plus the deductions. This codebase has minted phantom
// dollars once already.
//
// BLAST RADIUS, which is specific to E3: a deliverable added for ONE creator
// must not appear on any other creator's collab. Deliverables were uniformly
// campaign-wide and every consumer filtered on campaignId alone, so the
// natural implementation would have put an unfilled slot on everyone — and
// since stage is derived from slot completion, dragged them all backwards out
// of `approved` and `paid`. Several tests exist only to keep that impossible.

import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from '@/lib/api/store';
import {
  v2ProposeAmendment, v2AgreeAmendment, v2DeclineAmendment,
  v2WithdrawAmendment, v2OpenAmendment, v2Amendments, effectiveRights,
} from '../v2AmendmentActions';
import { deliverablesFor, computeSlotStatuses } from '@/lib/api/collabSync';
import { PLATFORM_FEE, WHT } from '@/lib/api/money';
import {
  buildDb, buildCampaign, buildCreator, buildBrand, buildOffer,
} from '@/lib/utils/__tests__/fixtures';
import type { Collaboration, Contract, Deliverable, User } from '@/lib/api/types';

const RATE = 2000;
const WALLET = 50000;

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

function collab(id: string, creatorId: string, offerId: string): Collaboration {
  return {
    id, campaignId: 'cmp_1', creatorId, brandId: 'br_1',
    stage: 'approved', createdAt: 1745000000000, updatedAt: 1745000000000,
    agreedRate: RATE, acceptedOfferId: offerId, contractId: creatorId === 'cr_1' ? 'ctr_1' : null,
    cancelledAt: null, cancellationReason: null, history: [],
  };
}

function contract(): Contract {
  return {
    id: 'ctr_1', collaborationId: 'col_1', campaignId: 'cmp_1',
    creatorId: 'cr_1', brandId: 'br_1', agreedRate: RATE,
    netToCreator: 1700, platformFee: 200, withholdingTax: 100,
    deliverables: [], briefSnapshot: 'snap', briefSnapshotAt: 1745000000000,
    rightsSnapshot: {
      exclusivity: 'none', whitelistAds: false,
      repurpose: '90d', derivative: false, organicOnly: true,
    },
    acceptedAt: 1745000000000, acceptedByUserId: 'u_creator',
    status: 'active', fulfilledAt: null, cancelledAt: null,
  };
}

function del(id: string, index: number, creatorId?: string): Deliverable {
  return {
    id, campaignId: 'cmp_1', creatorId: creatorId ?? null, index,
    platform: 'instagram', format: 'reel', quantity: 1,
    dueOffsetDays: null, specs: null,
  };
}

/** Two creators on one campaign — the second exists purely to prove that
 *  amendments to the first never touch them. */
function setupDb() {
  return buildDb({
    users: [
      userBrand('u_brand', 'br_1'),
      userCreator('u_creator', 'cr_1'),
      userCreator('u_other', 'cr_2'),
    ],
    creators: [
      buildCreator({ id: 'cr_1', userId: 'u_creator', walletBalance: 0, pendingBalance: 0, lifetimeEarnings: 0 }),
      buildCreator({ id: 'cr_2', userId: 'u_other', walletBalance: 0, pendingBalance: 0, lifetimeEarnings: 0 }),
    ],
    brands: [buildBrand({ id: 'br_1', userId: 'u_brand', walletBalance: WALLET, escrowHeld: 0 })],
    campaigns: [buildCampaign({ id: 'cmp_1', brandId: 'br_1', escrowHeld: 0, spent: 0 })],
    offers: [
      buildOffer({ id: 'off_1', campaignId: 'cmp_1', creatorId: 'cr_1', rate: RATE, status: 'accepted' }),
      buildOffer({ id: 'off_2', campaignId: 'cmp_1', creatorId: 'cr_2', rate: RATE, status: 'accepted' }),
    ],
    collaborations: [collab('col_1', 'cr_1', 'off_1'), collab('col_2', 'cr_2', 'off_2')],
    contracts: [contract()],
    deliverables: [del('del_1', 0)],
  });
}

const RIGHTS_EXT = {
  kind: 'rights-extension' as const,
  amount: 500,
  note: 'Keep running the hero cut through Q4.',
  repurposeTo: '365d' as const,
};
const SCOPE_ADD = {
  kind: 'scope-addition' as const,
  amount: 600,
  note: 'One more Story off the back of the Reel.',
  addDeliverable: { platform: 'instagram' as const, format: 'story' as const },
};

beforeEach(() => {
  useStore.getState().setDB(setupDb());
  useStore.getState().setSession(null);
});

describe('proposing', () => {
  it('records the offer without moving money', () => {
    v2ProposeAmendment('col_1', RIGHTS_EXT, 'u_brand');
    const db = useStore.getState().db;
    expect(v2OpenAmendment('col_1')).toMatchObject({ kind: 'rights-extension', amount: 500 });
    expect(db.brands[0].walletBalance).toBe(WALLET);
    expect(db.creators[0].walletBalance).toBe(0);
    expect(db.transactions.length).toBe(0);
  });

  it('notifies the other side, not the proposer', () => {
    v2ProposeAmendment('col_1', RIGHTS_EXT, 'u_brand');
    const ns = useStore.getState().db.notifications;
    expect(ns.some((n) => n.userId === 'u_creator')).toBe(true);
    expect(ns.some((n) => n.userId === 'u_brand')).toBe(false);
  });

  it('either side may propose — a creator can sell wider rights', () => {
    v2ProposeAmendment('col_1', RIGHTS_EXT, 'u_creator');
    expect(v2OpenAmendment('col_1')?.proposedBy).toBe('u_creator');
  });

  it('refuses an outsider', () => {
    expect(() => v2ProposeAmendment('col_1', RIGHTS_EXT, 'u_other'))
      .toThrow(/Only the brand or the creator/);
  });

  it('refuses a second proposal while one is live', () => {
    v2ProposeAmendment('col_1', RIGHTS_EXT, 'u_brand');
    expect(() => v2ProposeAmendment('col_1', SCOPE_ADD, 'u_creator'))
      .toThrow(/already on the table/);
  });

  it('requires a real amount and a note', () => {
    expect(() => v2ProposeAmendment('col_1', { ...RIGHTS_EXT, amount: 0 }, 'u_brand'))
      .toThrow(/greater than \$0/);
    expect(() => v2ProposeAmendment('col_1', { ...RIGHTS_EXT, note: '  ' }, 'u_brand'))
      .toThrow(/Add a note/);
  });

  it('REFUSES A RIGHTS "EXTENSION" THAT IS NOT WIDER', () => {
    // The contract already grants 90d re-use. Charging for 90d — or for 'none'
    // — would take money for a licence the brand already has.
    expect(() => v2ProposeAmendment('col_1', { ...RIGHTS_EXT, repurposeTo: '90d' }, 'u_brand'))
      .toThrow(/not wider than the rights already granted/);
    expect(() => v2ProposeAmendment('col_1', { ...RIGHTS_EXT, repurposeTo: 'none' }, 'u_brand'))
      .toThrow(/not wider than the rights already granted/);
  });

  it('refuses a rights extension that names nothing to extend', () => {
    expect(() => v2ProposeAmendment('col_1', { kind: 'rights-extension', amount: 500, note: 'x' }, 'u_brand'))
      .toThrow(/Pick what to extend/);
  });

  it('refuses while a dispute has frozen escrow', () => {
    useStore.setState((s) => ({
      ...s,
      db: { ...s.db, collaborations: s.db.collaborations.map((c) => ({ ...c, escrowFrozen: true })) },
    }));
    expect(() => v2ProposeAmendment('col_1', RIGHTS_EXT, 'u_brand')).toThrow(/dispute/);
  });
});

describe('E2 — agreeing a rights extension', () => {
  it('pays out immediately, and it conserves', () => {
    v2ProposeAmendment('col_1', RIGHTS_EXT, 'u_brand');
    const id = v2OpenAmendment('col_1')!.id;
    v2AgreeAmendment('col_1', id, 'u_creator');

    const db = useStore.getState().db;
    const gross = 500;
    const fee = Math.round(gross * PLATFORM_FEE);
    const tax = Math.round(gross * WHT);

    expect(db.brands[0].walletBalance).toBe(WALLET - gross);
    expect(db.creators[0].walletBalance).toBe(gross - fee - tax);
    // Nothing is held: there is no deliverable to release against.
    expect(db.brands[0].escrowHeld).toBe(0);
    expect(db.campaigns[0].escrowHeld).toBe(0);
    expect(db.creators[0].pendingBalance).toBe(0);

    // THE INVARIANT.
    expect(db.creators[0].walletBalance + fee + tax).toBe(gross);
  });

  it("the creator's ledger rows sum to what their wallet gained", () => {
    v2ProposeAmendment('col_1', RIGHTS_EXT, 'u_brand');
    v2AgreeAmendment('col_1', v2OpenAmendment('col_1')!.id, 'u_creator');
    const db = useStore.getState().db;
    const rows = db.transactions.filter((t) => t.userId === 'u_creator');
    expect(rows.reduce((s, t) => s + t.amount, 0)).toBe(db.creators[0].walletBalance);
    expect(rows.find((t) => t.kind === 'payout')?.amount).toBe(500);
  });

  it('widens the rights in force', () => {
    const before = effectiveRights(useStore.getState().db, useStore.getState().db.collaborations[0]);
    expect(before.repurpose).toBe('90d');

    v2ProposeAmendment('col_1', RIGHTS_EXT, 'u_brand');
    v2AgreeAmendment('col_1', v2OpenAmendment('col_1')!.id, 'u_creator');

    const db = useStore.getState().db;
    expect(effectiveRights(db, db.collaborations[0]).repurpose).toBe('365d');
  });

  it('leaves the deal stage alone — no new work was created', () => {
    v2ProposeAmendment('col_1', RIGHTS_EXT, 'u_brand');
    v2AgreeAmendment('col_1', v2OpenAmendment('col_1')!.id, 'u_creator');
    expect(useStore.getState().db.deliverables.length).toBe(1);
  });

  it('a declined extension does not widen anything', () => {
    v2ProposeAmendment('col_1', RIGHTS_EXT, 'u_brand');
    v2DeclineAmendment('col_1', v2OpenAmendment('col_1')!.id, 'u_creator');
    const db = useStore.getState().db;
    expect(effectiveRights(db, db.collaborations[0]).repurpose).toBe('90d');
  });

  it('the contract snapshot beats the campaign, so a brand cannot rewrite it', () => {
    // Brand widens the CAMPAIGN's rights after acceptance. The creator signed
    // 90d; that is what must still be in force.
    useStore.setState((s) => ({
      ...s,
      db: {
        ...s.db,
        campaigns: s.db.campaigns.map((c) => ({
          ...c,
          rights: { exclusivity: 'none' as const, whitelistAds: true, repurpose: 'perpetual' as const, derivative: true, organicOnly: false },
        })),
      },
    }));
    const db = useStore.getState().db;
    expect(effectiveRights(db, db.collaborations[0]).repurpose).toBe('90d');
  });
});

describe('E3 — agreeing a scope addition', () => {
  it('funds escrow rather than paying out', () => {
    v2ProposeAmendment('col_1', SCOPE_ADD, 'u_brand');
    v2AgreeAmendment('col_1', v2OpenAmendment('col_1')!.id, 'u_creator');

    const db = useStore.getState().db;
    const gross = 600;
    expect(db.brands[0].walletBalance).toBe(WALLET - gross);
    expect(db.brands[0].escrowHeld).toBe(gross);
    expect(db.campaigns[0].escrowHeld).toBe(gross);
    // Pending, not paid — the work does not exist yet.
    expect(db.creators[0].walletBalance).toBe(0);
    expect(db.creators[0].pendingBalance).toBe(gross - Math.round(gross * PLATFORM_FEE) - Math.round(gross * WHT));
  });

  it('adds the slot to THIS creator only', () => {
    v2ProposeAmendment('col_1', SCOPE_ADD, 'u_brand');
    v2AgreeAmendment('col_1', v2OpenAmendment('col_1')!.id, 'u_creator');

    const db = useStore.getState().db;
    expect(deliverablesFor(db, 'cmp_1', 'cr_1')).toHaveLength(2);
    // The whole point: the other creator on the same campaign is untouched.
    expect(deliverablesFor(db, 'cmp_1', 'cr_2')).toHaveLength(1);
  });

  it("does not disturb the other creator's slot statuses", () => {
    const before = computeSlotStatuses('cmp_1', 'cr_2', useStore.getState().db);
    v2ProposeAmendment('col_1', SCOPE_ADD, 'u_brand');
    v2AgreeAmendment('col_1', v2OpenAmendment('col_1')!.id, 'u_creator');
    const after = computeSlotStatuses('cmp_1', 'cr_2', useStore.getState().db);
    expect(after.length).toBe(before.length);
  });

  it('gives the creator a new pending slot', () => {
    v2ProposeAmendment('col_1', SCOPE_ADD, 'u_brand');
    v2AgreeAmendment('col_1', v2OpenAmendment('col_1')!.id, 'u_creator');
    const slots = computeSlotStatuses('cmp_1', 'cr_1', useStore.getState().db);
    expect(slots).toHaveLength(2);
    expect(slots.some((s) => s.status === 'pending')).toBe(true);
  });

  it('refuses when the brand cannot fund it', () => {
    useStore.setState((s) => ({
      ...s,
      db: { ...s.db, brands: s.db.brands.map((b) => ({ ...b, walletBalance: 100 })) },
    }));
    v2ProposeAmendment('col_1', SCOPE_ADD, 'u_brand');
    expect(() => v2AgreeAmendment('col_1', v2OpenAmendment('col_1')!.id, 'u_creator'))
      .toThrow(/short for this change/);
    // And nothing moved on the refusal.
    expect(useStore.getState().db.campaigns[0].escrowHeld).toBe(0);
    expect(useStore.getState().db.deliverables).toHaveLength(1);
  });
});

describe('authority', () => {
  it('THE PROPOSER CANNOT AGREE TO THEIR OWN PROPOSAL', () => {
    v2ProposeAmendment('col_1', RIGHTS_EXT, 'u_brand');
    const id = v2OpenAmendment('col_1')!.id;
    expect(() => v2AgreeAmendment('col_1', id, 'u_brand'))
      .toThrow(/You proposed this change/);
    expect(useStore.getState().db.brands[0].walletBalance).toBe(WALLET);
  });

  it('an outsider cannot agree on a party\'s behalf', () => {
    v2ProposeAmendment('col_1', RIGHTS_EXT, 'u_brand');
    const id = v2OpenAmendment('col_1')!.id;
    expect(() => v2AgreeAmendment('col_1', id, 'u_other'))
      .toThrow(/Only the brand or the creator/);
    expect(useStore.getState().db.brands[0].walletBalance).toBe(WALLET);
  });

  it('agreeing twice does not charge twice', () => {
    v2ProposeAmendment('col_1', RIGHTS_EXT, 'u_brand');
    const id = v2OpenAmendment('col_1')!.id;
    v2AgreeAmendment('col_1', id, 'u_creator');
    const after = useStore.getState().db.brands[0].walletBalance;
    expect(() => v2AgreeAmendment('col_1', id, 'u_creator')).toThrow(/already been decided/);
    expect(useStore.getState().db.brands[0].walletBalance).toBe(after);
  });

  it('you cannot decline your own proposal, or withdraw the other side\'s', () => {
    v2ProposeAmendment('col_1', RIGHTS_EXT, 'u_brand');
    const id = v2OpenAmendment('col_1')!.id;
    expect(() => v2DeclineAmendment('col_1', id, 'u_brand')).toThrow(/withdraw it/);
    expect(() => v2WithdrawAmendment('col_1', id, 'u_creator')).toThrow(/decline it instead/);
  });
});

describe('the record', () => {
  it('a declined change stays on the record rather than vanishing', () => {
    v2ProposeAmendment('col_1', RIGHTS_EXT, 'u_brand');
    v2DeclineAmendment('col_1', v2OpenAmendment('col_1')!.id, 'u_creator', 'too much');
    const all = v2Amendments('col_1');
    expect(all).toHaveLength(1);
    expect(all[0].status).toBe('declined');
    expect(all[0].decidedBy).toBe('u_creator');
    expect(v2OpenAmendment('col_1')).toBeNull();
  });

  it('a decline clears the floor for a counter-proposal', () => {
    v2ProposeAmendment('col_1', RIGHTS_EXT, 'u_brand');
    v2DeclineAmendment('col_1', v2OpenAmendment('col_1')!.id, 'u_creator');
    v2ProposeAmendment('col_1', { ...RIGHTS_EXT, amount: 300 }, 'u_creator');
    expect(v2OpenAmendment('col_1')?.amount).toBe(300);
    expect(v2Amendments('col_1')).toHaveLength(2);
  });

  it('withdrawing leaves a withdrawn record, not a hole', () => {
    v2ProposeAmendment('col_1', RIGHTS_EXT, 'u_brand');
    v2WithdrawAmendment('col_1', v2OpenAmendment('col_1')!.id, 'u_brand');
    expect(v2Amendments('col_1')[0].status).toBe('withdrawn');
  });
});
