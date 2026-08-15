// moneyPaths.test.ts — there is exactly ONE way for money to move.
//
// Before this, three operations each had two implementations and the UI was
// wired to the wrong one in every case:
//
//   approve content  ->  v2ApproveContent   vs  client.ts decideSubmission
//   accept/decline   ->  v2AcceptOffer      vs  client.ts respondToOffer
//   resolve dispute  ->  v2ResolveDispute   vs  client.ts resolveDispute
//
// The legacy trio skipped the capability check, the dispute freeze, the
// campaign-stage gate and the already-approved guard, released gross with no
// fee or withholding, and accepted offers the brand could not fund without
// telling anyone. They are deleted. These tests keep them deleted and pin
// the guards that replaced them.

import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from '@/lib/api/store';
import { api } from '@/lib/api/client';
import { v2ApproveContent } from '../v2CampaignActions';
import { v2RequestCollabCancel, v2AgreeCollabCancel } from '../v2CollabActions';
import { splitGross } from '@/lib/api/money';
import {
  buildDb, buildCampaign, buildCreator, buildBrand, buildOffer, buildSubmission,
} from '@/lib/utils/__tests__/fixtures';
import type { Deliverable, User, Collaboration, Advance } from '@/lib/api/types';

const RATE = 1500;

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
function collab(p: Partial<Collaboration> = {}): Collaboration {
  return {
    id: 'col_1', campaignId: 'cmp_1', creatorId: 'cr_1', brandId: 'br_1',
    stage: 'confirmed', createdAt: 1745000000000, updatedAt: 1745000000000,
    agreedRate: RATE, acceptedOfferId: 'off_1', contractId: null,
    cancelledAt: null, cancellationReason: null, history: [], ...p,
  };
}

function seed(opts: { advances?: Advance[]; collabPatch?: Partial<Collaboration> } = {}) {
  const deliverables = [del(0)];
  useStore.getState().setDB(buildDb({
    users: [userBrand(), userCreator()],
    creators: [buildCreator({ id: 'cr_1', userId: 'u_creator', walletBalance: 0, pendingBalance: 0, lifetimeEarnings: 0 })],
    brands: [buildBrand({ id: 'br_1', userId: 'u_brand', escrowHeld: RATE, walletBalance: 0 })],
    campaigns: [buildCampaign({ id: 'cmp_1', brandId: 'br_1', escrowHeld: RATE, spent: 0, stage: 'live' })],
    offers: [buildOffer({ id: 'off_1', campaignId: 'cmp_1', creatorId: 'cr_1', rate: RATE, status: 'accepted' })],
    collaborations: [collab(opts.collabPatch)],
    deliverables,
    submissions: [buildSubmission({
      id: 'sub_0', campaignId: 'cmp_1', creatorId: 'cr_1',
      deliverableId: 'del_cmp_1_0', status: 'in_review', round: 1,
    })],
    advances: opts.advances ?? [],
  }));
  useStore.getState().setSession({ userId: 'u_brand', issuedAt: new Date().toISOString() });
}

describe('the legacy money surface is gone', () => {
  // A deleted function is only deleted until someone re-adds it "for
  // convenience". These assertions make that a failing test rather than a
  // quiet regression back to a fee-free payout path.
  it('api.offers exposes no accept/decline', () => {
    expect('respond' in api.offers).toBe(false);
  });
  it('api.submissions exposes no approve/decide', () => {
    expect('decide' in api.submissions).toBe(false);
  });
  it('api.disputes exposes no resolve', () => {
    expect('resolve' in api.disputes).toBe(false);
  });
  it('api.brand exposes no team mutations', () => {
    expect('inviteTeamMember' in api.brand).toBe(false);
    expect('removeTeamMember' in api.brand).toBe(false);
  });
});

describe('v2ApproveContent — fee and withholding are always taken', () => {
  beforeEach(() => seed());

  it('credits the creator net, not gross', () => {
    v2ApproveContent('sub_0');
    const { net } = splitGross(RATE);
    const creator = useStore.getState().db.creators.find((c) => c.id === 'cr_1')!;
    expect(creator.walletBalance).toBe(net);
    expect(creator.walletBalance).toBeLessThan(RATE);
  });

  it('records the payout at gross and deducts fee + withholding from it', () => {
    v2ApproveContent('sub_0');
    const txs = useStore.getState().db.transactions.filter((t) => t.userId === 'u_creator');
    const payout = txs.filter((t) => t.kind === 'payout').reduce((s, t) => s + t.amount, 0);
    const deducted = txs.filter((t) => t.kind === 'fee').reduce((s, t) => s + Math.abs(t.amount), 0);
    expect(payout).toBe(RATE);
    expect(deducted).toBe(RATE - splitGross(RATE).net);
  });

  it('reconciles: the creator ledger sums to the wallet balance', () => {
    v2ApproveContent('sub_0');
    const db = useStore.getState().db;
    // The invariant the old net-payout convention could not satisfy — it
    // came up short by exactly fee + tax, because those rows described
    // money that had already been removed before the payout was written.
    const ledgerSum = db.transactions
      .filter((t) => t.userId === 'u_creator')
      .reduce((s, t) => s + t.amount, 0);
    expect(ledgerSum).toBe(db.creators.find((c) => c.id === 'cr_1')!.walletBalance);
  });

  it('is idempotent — approving twice does not pay twice', () => {
    v2ApproveContent('sub_0');
    const after1 = useStore.getState().db.creators.find((c) => c.id === 'cr_1')!.walletBalance;
    try { v2ApproveContent('sub_0'); } catch { /* already-approved may throw; either is fine */ }
    const after2 = useStore.getState().db.creators.find((c) => c.id === 'cr_1')!.walletBalance;
    expect(after2).toBe(after1);
  });
});

describe('v2ApproveContent — outstanding income advances are repaid', () => {
  // This logic lived ONLY inside the legacy decideSubmission, so approving
  // through the campaign UI — the path the product actually uses — repaid
  // nothing and the advance stayed `active` forever.
  const advance: Advance = {
    id: 'adv_1', creatorId: 'cr_1', requestedAt: '2026-04-01T00:00:00Z',
    amount: 300, feePct: 0.03, feeAmount: 9, collateralPending: 1000,
    status: 'active', repaidAmount: 0,
  };

  it('withholds the outstanding amount from the payout', () => {
    seed({ advances: [{ ...advance }] });
    v2ApproveContent('sub_0');
    const { net } = splitGross(RATE);
    const creator = useStore.getState().db.creators.find((c) => c.id === 'cr_1')!;
    expect(creator.walletBalance).toBe(net - 300);
  });

  it('marks the advance repaid and still credits full lifetime earnings', () => {
    seed({ advances: [{ ...advance }] });
    v2ApproveContent('sub_0');
    const { net } = splitGross(RATE);
    const db = useStore.getState().db;
    expect(db.advances[0].status).toBe('repaid');
    expect(db.advances[0].repaidAmount).toBe(300);
    // They earned the full net; part of it serviced a debt.
    expect(db.creators.find((c) => c.id === 'cr_1')!.lifetimeEarnings).toBe(net);
  });

  it('records the repayment as its own ledger row', () => {
    seed({ advances: [{ ...advance }] });
    v2ApproveContent('sub_0');
    const db = useStore.getState().db;
    const repayment = db.transactions.find((t) => t.note === 'Income advance repayment');
    expect(repayment).toBeDefined();
    expect(repayment!.amount).toBe(-300);
    // Every creator row — gross payout, platform fee, withholding, and this
    // repayment — sums to the wallet balance.
    const ledgerSum = db.transactions
      .filter((t) => t.userId === 'u_creator')
      .reduce((s, t) => s + t.amount, 0);
    const walletBalance = db.creators.find((c) => c.id === 'cr_1')!.walletBalance;
    expect(ledgerSum).toBe(walletBalance);
  });

  it('does nothing when the advance is already repaid', () => {
    seed({ advances: [{ ...advance, status: 'repaid', repaidAmount: 300 }] });
    v2ApproveContent('sub_0');
    const { net } = splitGross(RATE);
    expect(useStore.getState().db.creators.find((c) => c.id === 'cr_1')!.walletBalance).toBe(net);
  });
});

describe('mutual cancel respects an open dispute', () => {
  // A mutual cancel refunds escrow immediately. With a dispute open that
  // routes around the admin decision entirely and orphans the dispute row.
  // v2EndCampaign already filtered on escrowFrozen; the consent path didn't.
  it('refuses to open a cancel request while escrow is frozen', () => {
    seed({ collabPatch: { escrowFrozen: true } });
    expect(() => v2RequestCollabCancel('col_1', 'u_brand', 'changed our mind'))
      .toThrow(/frozen/i);
  });

  it('refuses to agree to a cancel raised before the dispute', () => {
    seed({
      collabPatch: {
        cancellationRequest: { by: 'u_creator', reason: 'scope', at: 1745000000000 },
        escrowFrozen: true,
      },
    });
    expect(() => v2AgreeCollabCancel('col_1', 'u_brand')).toThrow(/frozen/i);
  });

  it('still allows a mutual cancel when no dispute is open', () => {
    seed({ collabPatch: { cancellationRequest: { by: 'u_creator', reason: 'scope', at: 1745000000000 } } });
    expect(() => v2AgreeCollabCancel('col_1', 'u_brand')).not.toThrow();
  });
});
