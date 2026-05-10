// Integration tests for deriveDeal — the pure aggregator that the
// React hook (useDealById) thinly wraps.
//
// We test deriveDeal directly because it's pure (just db + ids in,
// Deal | null out) — no React renderer needed.

import { describe, it, expect, beforeEach } from 'vitest';
import { deriveDeal } from '@/lib/api/use-deal';
import {
  buildBrand,
  buildCampaign,
  buildCreator,
  buildUser,
  buildApplication,
  buildOffer,
  buildSubmission,
  buildDispute,
  buildThread,
  buildMessage,
  buildTransaction,
  buildDb,
  resetIds,
} from '@/lib/utils/__tests__/fixtures';

beforeEach(() => resetIds());

describe('deriveDeal — basic resolution', () => {
  it('returns null when the campaign id is unknown', () => {
    const db = buildDb({
      campaigns: [buildCampaign({ id: 'cmp_1' })],
      creators: [buildCreator({ id: 'cr_1' })],
      brands: [buildBrand({ id: 'br_1' })],
    });
    expect(deriveDeal({ db, campaignId: 'cmp_missing', creatorId: 'cr_1', role: 'brand' })).toBeNull();
  });

  it('returns null when the creator id is unknown', () => {
    const db = buildDb({
      campaigns: [buildCampaign({ id: 'cmp_1' })],
      creators: [buildCreator({ id: 'cr_1' })],
      brands: [buildBrand({ id: 'br_1' })],
    });
    expect(deriveDeal({ db, campaignId: 'cmp_1', creatorId: 'cr_missing', role: 'brand' })).toBeNull();
  });

  it('returns null when the brand attached to the campaign is missing', () => {
    const db = buildDb({
      campaigns: [buildCampaign({ id: 'cmp_1', brandId: 'br_orphan' })],
      creators: [buildCreator({ id: 'cr_1' })],
      brands: [], // no brand record matches
    });
    expect(deriveDeal({ db, campaignId: 'cmp_1', creatorId: 'cr_1', role: 'brand' })).toBeNull();
  });

  it('builds a Deal with state=applied when only an application exists', () => {
    const db = buildDb({
      campaigns: [buildCampaign({ id: 'cmp_1', brandId: 'br_1' })],
      creators: [buildCreator({ id: 'cr_1' })],
      brands: [buildBrand({ id: 'br_1' })],
      applications: [buildApplication({ campaignId: 'cmp_1', creatorId: 'cr_1', status: 'submitted' })],
    });
    const deal = deriveDeal({ db, campaignId: 'cmp_1', creatorId: 'cr_1', role: 'brand' });
    expect(deal).not.toBeNull();
    expect(deal!.state).toBe('applied');
    expect(deal!.action.kind).toBe('shortlist-applicant');
    expect(deal!.id).toBe('cmp_1--cr_1');
  });
});

describe('deriveDeal — counter+re-offer cycle', () => {
  it('picks the LATEST offer regardless of insertion order (Phase 20 fix)', () => {
    const old = buildOffer({
      id: 'off_old', campaignId: 'cmp_1', creatorId: 'cr_1',
      status: 'declined', sentAt: '2026-04-01T00:00:00Z',
    });
    const fresh = buildOffer({
      id: 'off_new', campaignId: 'cmp_1', creatorId: 'cr_1',
      status: 'pending', sentAt: '2026-04-10T00:00:00Z',
    });
    const db = buildDb({
      campaigns: [buildCampaign({ id: 'cmp_1', brandId: 'br_1' })],
      creators: [buildCreator({ id: 'cr_1' })],
      brands: [buildBrand({ id: 'br_1' })],
      offers: [old, fresh],
    });
    const deal = deriveDeal({ db, campaignId: 'cmp_1', creatorId: 'cr_1', role: 'creator' });
    expect(deal!.offer?.id).toBe('off_new');
    expect(deal!.state).toBe('offer-pending');
  });

  it('exposes acceptedOffer separately from offer (Phase 20 fix)', () => {
    // Real-world: offer1 was accepted, then a new pending re-offer exists.
    // Money math should use offer1's rate even though latest offer = re-offer.
    const accepted = buildOffer({
      id: 'off_accepted', campaignId: 'cmp_1', creatorId: 'cr_1',
      status: 'accepted', rate: 1500, sentAt: '2026-04-01T00:00:00Z',
    });
    const reoffer = buildOffer({
      id: 'off_reoffer', campaignId: 'cmp_1', creatorId: 'cr_1',
      status: 'pending', rate: 1800, sentAt: '2026-04-10T00:00:00Z',
    });
    const db = buildDb({
      campaigns: [buildCampaign({ id: 'cmp_1', brandId: 'br_1' })],
      creators: [buildCreator({ id: 'cr_1' })],
      brands: [buildBrand({ id: 'br_1' })],
      offers: [accepted, reoffer],
    });
    const deal = deriveDeal({ db, campaignId: 'cmp_1', creatorId: 'cr_1', role: 'creator' });
    expect(deal!.offer?.id).toBe('off_reoffer');
    expect(deal!.acceptedOffer?.id).toBe('off_accepted');
    expect(deal!.acceptedOffer?.rate).toBe(1500);
  });
});

describe('deriveDeal — submissions', () => {
  it('sorts submissions newest-first and exposes latestSubmission', () => {
    const db = buildDb({
      campaigns: [buildCampaign({ id: 'cmp_1', brandId: 'br_1', stage: 'live' })],
      creators: [buildCreator({ id: 'cr_1' })],
      brands: [buildBrand({ id: 'br_1' })],
      offers: [buildOffer({ campaignId: 'cmp_1', creatorId: 'cr_1', status: 'accepted' })],
      submissions: [
        buildSubmission({ id: 'sub_round1', round: 1, status: 'revisions', submittedAt: '2026-04-10T00:00:00Z' }),
        buildSubmission({ id: 'sub_round2', round: 2, status: 'in_review', submittedAt: '2026-04-15T00:00:00Z' }),
      ],
    });
    const deal = deriveDeal({ db, campaignId: 'cmp_1', creatorId: 'cr_1', role: 'brand' });
    expect(deal!.submissions[0].id).toBe('sub_round2'); // newest first
    expect(deal!.submissions[1].id).toBe('sub_round1');
    expect(deal!.latestSubmission?.id).toBe('sub_round2');
    expect(deal!.state).toBe('in-review');
  });
});

describe('deriveDeal — disputes', () => {
  it('open dispute drives state and exposes openDispute', () => {
    const db = buildDb({
      campaigns: [buildCampaign({ id: 'cmp_1', brandId: 'br_1' })],
      creators: [buildCreator({ id: 'cr_1' })],
      brands: [buildBrand({ id: 'br_1' })],
      disputes: [buildDispute({ campaignId: 'cmp_1', status: 'open' })],
    });
    const deal = deriveDeal({ db, campaignId: 'cmp_1', creatorId: 'cr_1', role: 'admin' });
    expect(deal!.state).toBe('disputed');
    expect(deal!.openDispute).toBeDefined();
    expect(deal!.action.kind).toBe('resolve-dispute');
  });

  it('resolved dispute does not affect state', () => {
    const db = buildDb({
      campaigns: [buildCampaign({ id: 'cmp_1', brandId: 'br_1', stage: 'closed' })],
      creators: [buildCreator({ id: 'cr_1' })],
      brands: [buildBrand({ id: 'br_1' })],
      disputes: [buildDispute({ campaignId: 'cmp_1', status: 'resolved-partial' })],
    });
    const deal = deriveDeal({ db, campaignId: 'cmp_1', creatorId: 'cr_1', role: 'admin' });
    expect(deal!.state).toBe('closed');
    expect(deal!.openDispute).toBeUndefined();
  });
});

describe('deriveDeal — thread / messages', () => {
  it('finds thread when ANY brand-team user participates (Phase 24 QA)', () => {
    // Multi-member brand team: 3 users on the same brandId. The thread
    // links u_brand_2 + u_creator. We must still find it when looking up
    // by the brand id (not just by the first user).
    const db = buildDb({
      users: [
        buildUser({ id: 'u_brand_1', brandId: 'br_1', role: 'brand' }),
        buildUser({ id: 'u_brand_2', brandId: 'br_1', role: 'brand' }),
        buildUser({ id: 'u_brand_3', brandId: 'br_1', role: 'brand' }),
        buildUser({ id: 'u_creator', creatorId: 'cr_1', role: 'creator' }),
      ],
      campaigns: [buildCampaign({ id: 'cmp_1', brandId: 'br_1' })],
      creators: [buildCreator({ id: 'cr_1', userId: 'u_creator' })],
      brands: [buildBrand({ id: 'br_1', userId: 'u_brand_1' })],
      threads: [
        buildThread({
          id: 'th_1',
          participants: ['u_brand_2', 'u_creator'], // not the first brand user
          campaignId: 'cmp_1',
        }),
      ],
      messages: [buildMessage({ threadId: 'th_1', text: 'hello' })],
    });
    const deal = deriveDeal({
      db, campaignId: 'cmp_1', creatorId: 'cr_1', role: 'brand', viewerUserId: 'u_brand_1',
    });
    expect(deal!.thread?.id).toBe('th_1');
    expect(deal!.messages.length).toBe(1);
  });

  it('returns no thread / empty messages when no thread exists', () => {
    const db = buildDb({
      users: [
        buildUser({ id: 'u_brand', brandId: 'br_1', role: 'brand' }),
        buildUser({ id: 'u_creator', creatorId: 'cr_1', role: 'creator' }),
      ],
      campaigns: [buildCampaign({ id: 'cmp_1', brandId: 'br_1' })],
      creators: [buildCreator({ id: 'cr_1', userId: 'u_creator' })],
      brands: [buildBrand({ id: 'br_1', userId: 'u_brand' })],
    });
    const deal = deriveDeal({ db, campaignId: 'cmp_1', creatorId: 'cr_1', role: 'brand' });
    expect(deal!.thread).toBeUndefined();
    expect(deal!.messages).toEqual([]);
  });

  it('sorts messages chronologically', () => {
    const db = buildDb({
      users: [
        buildUser({ id: 'u_brand', brandId: 'br_1', role: 'brand' }),
        buildUser({ id: 'u_creator', creatorId: 'cr_1', role: 'creator' }),
      ],
      campaigns: [buildCampaign({ id: 'cmp_1', brandId: 'br_1' })],
      creators: [buildCreator({ id: 'cr_1', userId: 'u_creator' })],
      brands: [buildBrand({ id: 'br_1', userId: 'u_brand' })],
      threads: [buildThread({ id: 'th_1', participants: ['u_brand', 'u_creator'], campaignId: 'cmp_1' })],
      messages: [
        buildMessage({ id: 'm3', threadId: 'th_1', text: 'third', at: '2026-04-12T03:00:00Z' }),
        buildMessage({ id: 'm1', threadId: 'th_1', text: 'first', at: '2026-04-12T01:00:00Z' }),
        buildMessage({ id: 'm2', threadId: 'th_1', text: 'second', at: '2026-04-12T02:00:00Z' }),
      ],
    });
    const deal = deriveDeal({ db, campaignId: 'cmp_1', creatorId: 'cr_1', role: 'brand' });
    expect(deal!.messages.map((m) => m.id)).toEqual(['m1', 'm2', 'm3']);
  });
});

describe('deriveDeal — money math', () => {
  it('computes released as sum of cleared payouts to the creator user', () => {
    const db = buildDb({
      users: [
        buildUser({ id: 'u_creator', creatorId: 'cr_1', role: 'creator' }),
        buildUser({ id: 'u_brand', brandId: 'br_1', role: 'brand' }),
      ],
      campaigns: [buildCampaign({ id: 'cmp_1', brandId: 'br_1', stage: 'live' })],
      creators: [buildCreator({ id: 'cr_1', userId: 'u_creator' })],
      brands: [buildBrand({ id: 'br_1', userId: 'u_brand' })],
      offers: [buildOffer({ campaignId: 'cmp_1', creatorId: 'cr_1', status: 'accepted', rate: 1500 })],
      transactions: [
        // Cleared payout = counts
        buildTransaction({ campaignId: 'cmp_1', userId: 'u_creator', kind: 'payout', status: 'cleared', amount: 750 }),
        // Pending payout = does NOT count
        buildTransaction({ campaignId: 'cmp_1', userId: 'u_creator', kind: 'payout', status: 'pending', amount: 750 }),
        // Different campaign = does NOT count
        buildTransaction({ campaignId: 'cmp_other', userId: 'u_creator', kind: 'payout', status: 'cleared', amount: 5000 }),
        // Different user = does NOT count
        buildTransaction({ campaignId: 'cmp_1', userId: 'u_brand', kind: 'topup', status: 'cleared', amount: 10000 }),
        // Negative amount (refund-like) = filtered by amount > 0 guard
        buildTransaction({ campaignId: 'cmp_1', userId: 'u_creator', kind: 'payout', status: 'cleared', amount: -100 }),
      ],
    });
    const deal = deriveDeal({ db, campaignId: 'cmp_1', creatorId: 'cr_1', role: 'creator' });
    expect(deal!.released).toBe(750);
    expect(deal!.escrowHeld).toBe(750); // 1500 accepted - 750 released
  });

  it('escrowHeld is 0 when no accepted offer exists', () => {
    const db = buildDb({
      campaigns: [buildCampaign({ id: 'cmp_1', brandId: 'br_1' })],
      creators: [buildCreator({ id: 'cr_1' })],
      brands: [buildBrand({ id: 'br_1' })],
      offers: [buildOffer({ campaignId: 'cmp_1', creatorId: 'cr_1', status: 'pending', rate: 1500 })],
    });
    const deal = deriveDeal({ db, campaignId: 'cmp_1', creatorId: 'cr_1', role: 'creator' });
    expect(deal!.escrowHeld).toBe(0);
  });

  it('clamps escrowHeld at zero (over-payment safety)', () => {
    // Hypothetical: more was released than accepted (data anomaly).
    // escrowHeld should not go negative.
    const db = buildDb({
      users: [buildUser({ id: 'u_creator', creatorId: 'cr_1', role: 'creator' })],
      campaigns: [buildCampaign({ id: 'cmp_1', brandId: 'br_1', stage: 'live' })],
      creators: [buildCreator({ id: 'cr_1', userId: 'u_creator' })],
      brands: [buildBrand({ id: 'br_1' })],
      offers: [buildOffer({ campaignId: 'cmp_1', creatorId: 'cr_1', status: 'accepted', rate: 1000 })],
      transactions: [
        buildTransaction({ campaignId: 'cmp_1', userId: 'u_creator', kind: 'payout', status: 'cleared', amount: 1500 }),
      ],
    });
    const deal = deriveDeal({ db, campaignId: 'cmp_1', creatorId: 'cr_1', role: 'creator' });
    expect(deal!.escrowHeld).toBe(0);
  });
});

describe('deriveDeal — transaction scoping by role', () => {
  it('scopes transactions to the viewer user (non-admin)', () => {
    const db = buildDb({
      users: [
        buildUser({ id: 'u_creator', creatorId: 'cr_1', role: 'creator' }),
        buildUser({ id: 'u_brand', brandId: 'br_1', role: 'brand' }),
      ],
      campaigns: [buildCampaign({ id: 'cmp_1', brandId: 'br_1' })],
      creators: [buildCreator({ id: 'cr_1', userId: 'u_creator' })],
      brands: [buildBrand({ id: 'br_1', userId: 'u_brand' })],
      transactions: [
        buildTransaction({ id: 'tx_creator', campaignId: 'cmp_1', userId: 'u_creator' }),
        buildTransaction({ id: 'tx_brand',   campaignId: 'cmp_1', userId: 'u_brand' }),
        buildTransaction({ id: 'tx_other',   campaignId: 'cmp_1', userId: 'u_other' }),
      ],
    });
    const deal = deriveDeal({
      db, campaignId: 'cmp_1', creatorId: 'cr_1', role: 'creator', viewerUserId: 'u_creator',
    });
    const ids = deal!.transactions.map((t) => t.id);
    expect(ids).toContain('tx_creator');
    expect(ids).not.toContain('tx_other');
  });

  it('admin sees all transactions for the campaign', () => {
    const db = buildDb({
      campaigns: [buildCampaign({ id: 'cmp_1', brandId: 'br_1' })],
      creators: [buildCreator({ id: 'cr_1' })],
      brands: [buildBrand({ id: 'br_1' })],
      transactions: [
        buildTransaction({ id: 'tx_a', campaignId: 'cmp_1', userId: 'u_a' }),
        buildTransaction({ id: 'tx_b', campaignId: 'cmp_1', userId: 'u_b' }),
        buildTransaction({ id: 'tx_other', campaignId: 'cmp_other', userId: 'u_a' }),
      ],
    });
    const deal = deriveDeal({ db, campaignId: 'cmp_1', creatorId: 'cr_1', role: 'admin' });
    const ids = deal!.transactions.map((t) => t.id).sort();
    expect(ids).toEqual(['tx_a', 'tx_b']);
  });
});

describe('deriveDeal — composite id', () => {
  it('Deal.id is the composite slug', () => {
    const db = buildDb({
      campaigns: [buildCampaign({ id: 'cmp_g0', brandId: 'br_1' })],
      creators: [buildCreator({ id: 'cr_3' })],
      brands: [buildBrand({ id: 'br_1' })],
    });
    const deal = deriveDeal({ db, campaignId: 'cmp_g0', creatorId: 'cr_3', role: 'admin' });
    expect(deal!.id).toBe('cmp_g0--cr_3');
  });
});
