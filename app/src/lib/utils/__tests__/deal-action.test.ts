// Tests for computeDealAction — the (state × role) → action verb/kind/
// actor/urgency dispatcher (Phase 24).
//
// Strategy: one or two tests per (state, role) combo. Where urgency
// depends on time, we pin `now` so the math is deterministic.

import { describe, it, expect, beforeEach } from 'vitest';
import { computeDealAction } from '@/lib/utils/deal-action';
import { buildCampaign, buildOffer, buildSubmission, resetIds } from './fixtures';

const NOW = new Date('2026-04-15T12:00:00.000Z');

beforeEach(() => resetIds());

describe('computeDealAction — disputed', () => {
  it('admin gets resolve-dispute with urgency 1000', () => {
    const a = computeDealAction({
      state: 'disputed',
      role: 'admin',
      campaign: buildCampaign(),
      now: NOW,
    });
    expect(a.actor).toBe('me');
    expect(a.kind).toBe('resolve-dispute');
    expect(a.verb).toBe('Resolve dispute');
    expect(a.urgency).toBe(1000);
  });

  it('creator gets add-evidence with actor=me (so disputed surfaces in actionable queue)', () => {
    const a = computeDealAction({
      state: 'disputed',
      role: 'creator',
      campaign: buildCampaign(),
      now: NOW,
    });
    expect(a.actor).toBe('me');
    expect(a.kind).toBe('add-evidence');
    expect(a.urgency).toBe(700);
  });

  it('brand gets add-evidence with actor=me', () => {
    const a = computeDealAction({
      state: 'disputed',
      role: 'brand',
      campaign: buildCampaign(),
      now: NOW,
    });
    expect(a.actor).toBe('me');
    expect(a.urgency).toBe(700);
  });
});

describe('computeDealAction — offer-pending', () => {
  it('creator with offer expiring soon gets a high-urgency accept-offer with money in verb', () => {
    const offer = buildOffer({
      rate: 1500,
      // Sent 6 days ago, expires in 1 day → < 24h urgency
      sentAt: '2026-04-09T12:00:00.000Z',
    });
    const a = computeDealAction({
      state: 'offer-pending',
      role: 'creator',
      campaign: buildCampaign(),
      offer,
      now: NOW,
    });
    expect(a.actor).toBe('me');
    expect(a.kind).toBe('accept-offer');
    expect(a.verb).toContain('Accept');
    expect(a.verb).toContain('1,500');
    expect(a.secondary).toContain('counter-offer');
    expect(a.secondary).toContain('decline-offer');
    expect(a.urgency).toBeGreaterThanOrEqual(400);
    expect(a.reason).toMatch(/h$|d$/);
  });

  it('creator with fresh offer (5d to expiry) is medium urgency', () => {
    const offer = buildOffer({ sentAt: '2026-04-13T12:00:00.000Z' }); // 2 days ago
    const a = computeDealAction({
      state: 'offer-pending',
      role: 'creator',
      campaign: buildCampaign(),
      offer,
      now: NOW,
    });
    expect(a.actor).toBe('me');
    expect(a.urgency).toBeGreaterThan(0);
    // 5 days remaining → "Expires in 5d" reason
    expect(a.reason).toMatch(/d$/);
  });

  it('brand-side offer-pending is passive (waiting on creator)', () => {
    const offer = buildOffer();
    const a = computeDealAction({
      state: 'offer-pending',
      role: 'brand',
      campaign: buildCampaign(),
      offer,
      now: NOW,
    });
    expect(a.actor).toBe('them');
    expect(a.kind).toBe('send-reminder');
    expect(a.urgency).toBeLessThanOrEqual(50);
  });
});

describe('computeDealAction — offer-countered', () => {
  it('brand sees the counter rate in the verb', () => {
    // P3 §2.1 — `Offer.counter` was a single slot pre-P3; the
    // negotiation transcript is now `Offer.rounds[]`. Round 0 is the
    // brand's initial; round 1 is the creator's counter.
    const offer = buildOffer({
      status: 'countered',
      rate: 2000,  // mirrors the latest round's rate (post-P3 contract)
      message: 'higher please',
      rounds: [
        { by: 'brand', at: +new Date('2026-04-10T00:00:00Z'), rate: 1500, message: 'initial offer' },
        { by: 'creator', at: +new Date('2026-04-12T00:00:00Z'), rate: 2000, message: 'higher please' },
      ],
    });
    const a = computeDealAction({
      state: 'offer-countered',
      role: 'brand',
      campaign: buildCampaign(),
      offer,
      now: NOW,
    });
    expect(a.actor).toBe('me');
    expect(a.kind).toBe('accept-offer');
    expect(a.verb).toContain('2,000');
    expect(a.urgency).toBe(400);
  });

  it('creator-side offer-countered is passive (awaiting brand)', () => {
    const a = computeDealAction({
      state: 'offer-countered',
      role: 'creator',
      campaign: buildCampaign(),
      now: NOW,
    });
    expect(a.actor).toBe('them');
    expect(a.kind).toBe('withdraw-counter');
  });
});

describe('computeDealAction — accepted-production', () => {
  it('creator gets upload-draft (Round 1), urgency depends on deadline', () => {
    const c = buildCampaign({ deadline: '2026-04-30' }); // ~15 days out
    const a = computeDealAction({
      state: 'accepted-production',
      role: 'creator',
      campaign: c,
      now: NOW,
    });
    expect(a.actor).toBe('me');
    expect(a.kind).toBe('upload-draft');
    expect(a.verb).toBe('Upload Round 1');
    expect(a.urgency).toBeGreaterThan(0);
  });

  it('brand-side waits while creator works (when on schedule)', () => {
    const c = buildCampaign({ deadline: '2026-04-30' });
    const a = computeDealAction({
      state: 'accepted-production',
      role: 'brand',
      campaign: c,
      now: NOW,
    });
    expect(a.actor).toBe('them');
    expect(a.kind).toBe('wait-for-upload');
    expect(a.urgency).toBeLessThan(50);
  });

  it('brand-side flips to actor=me when deadline is past (Phase 24 QA)', () => {
    const c = buildCampaign({ deadline: '2026-04-10' }); // 5d ago
    const a = computeDealAction({
      state: 'accepted-production',
      role: 'brand',
      campaign: c,
      now: NOW,
    });
    expect(a.actor).toBe('me');
    expect(a.kind).toBe('send-reminder');
    expect(a.urgency).toBe(450);
    expect(a.reason).toContain('past deadline');
  });
});

describe('computeDealAction — in-review', () => {
  it('brand uses the ACCEPTED offer rate for the approve verb (Phase 24 QA)', () => {
    // Simulates a counter+re-offer cycle: latest offer is pending (new
    // proposal), but the previously accepted offer's rate is what's
    // actually held in escrow.
    const accepted = buildOffer({ status: 'accepted', rate: 1500 });
    const latestPending = buildOffer({ status: 'pending', rate: 1800 });
    const sub = buildSubmission({
      status: 'in_review',
      submittedAt: '2026-04-14T12:00:00.000Z',
    });
    const a = computeDealAction({
      state: 'in-review',
      role: 'brand',
      campaign: buildCampaign({ stage: 'live' }),
      offer: latestPending,
      acceptedOffer: accepted,
      latestSubmission: sub,
      now: NOW,
    });
    expect(a.actor).toBe('me');
    expect(a.kind).toBe('approve-submission');
    expect(a.verb).toContain('1,500');
    expect(a.verb).not.toContain('1,800');
    expect(a.secondary).toContain('request-revisions');
  });

  it('creator-side in-review is passive', () => {
    const a = computeDealAction({
      state: 'in-review',
      role: 'creator',
      campaign: buildCampaign(),
      now: NOW,
    });
    expect(a.actor).toBe('them');
    expect(a.kind).toBe('wait-for-review');
  });
});

describe('computeDealAction — revisions-requested', () => {
  it('creator gets upload-draft (next round)', () => {
    const a = computeDealAction({
      state: 'revisions-requested',
      role: 'creator',
      campaign: buildCampaign(),
      now: NOW,
    });
    expect(a.actor).toBe('me');
    expect(a.kind).toBe('upload-draft');
    expect(a.verb).toBe('Upload next round');
    expect(a.urgency).toBe(350);
  });

  it('brand-side revisions-requested is passive', () => {
    const a = computeDealAction({
      state: 'revisions-requested',
      role: 'brand',
      campaign: buildCampaign(),
      now: NOW,
    });
    expect(a.actor).toBe('them');
    expect(a.kind).toBe('wait-for-upload');
  });
});

describe('computeDealAction — post-flow states', () => {
  it("'approved' is passive for both sides (urgency 0)", () => {
    for (const role of ['creator', 'brand', 'admin'] as const) {
      const a = computeDealAction({
        state: 'approved',
        role,
        campaign: buildCampaign(),
        now: NOW,
      });
      expect(a.actor).toBe('neither');
      expect(a.urgency).toBe(0);
    }
  });

  it("'posted' shows 'Live on channels' reason", () => {
    const a = computeDealAction({
      state: 'posted',
      role: 'creator',
      campaign: buildCampaign({ stage: 'live' }),
      now: NOW,
    });
    expect(a.reason).toBe('Live on channels');
  });

  it("'closed' offers a review CTA labelled per role", () => {
    expect(
      computeDealAction({ state: 'closed', role: 'creator', campaign: buildCampaign({ stage: 'closed' }), now: NOW }).verb,
    ).toBe('Review brand');
    expect(
      computeDealAction({ state: 'closed', role: 'brand', campaign: buildCampaign({ stage: 'closed' }), now: NOW }).verb,
    ).toBe('Review creator');
  });
});

describe('computeDealAction — applied / shortlisted', () => {
  it('brand applied → shortlist-applicant kind', () => {
    const a = computeDealAction({
      state: 'applied',
      role: 'brand',
      campaign: buildCampaign(),
      now: NOW,
    });
    expect(a.actor).toBe('me');
    expect(a.kind).toBe('shortlist-applicant');
    expect(a.urgency).toBe(80);
  });

  it('brand shortlisted → send-offer kind (Phase 24 QA: distinct from applied)', () => {
    const a = computeDealAction({
      state: 'shortlisted',
      role: 'brand',
      campaign: buildCampaign(),
      now: NOW,
    });
    expect(a.actor).toBe('me');
    expect(a.kind).toBe('send-offer');
    expect(a.urgency).toBe(100);
  });

  it('creator-side applied is passive (actor=them, urgency 0)', () => {
    const a = computeDealAction({
      state: 'applied',
      role: 'creator',
      campaign: buildCampaign(),
      now: NOW,
    });
    expect(a.actor).toBe('them');
    expect(a.kind).toBe('withdraw-application');
    expect(a.urgency).toBe(0);
  });

  it('creator-side shortlisted is passive', () => {
    const a = computeDealAction({
      state: 'shortlisted',
      role: 'creator',
      campaign: buildCampaign(),
      now: NOW,
    });
    expect(a.actor).toBe('them');
    expect(a.urgency).toBe(0);
  });
});

describe('computeDealAction — declined / withdrawn (terminal)', () => {
  it('declined returns kind=none, actor=neither, urgency 0', () => {
    const a = computeDealAction({
      state: 'declined',
      role: 'creator',
      campaign: buildCampaign(),
      now: NOW,
    });
    expect(a.actor).toBe('neither');
    expect(a.kind).toBe('none');
    expect(a.urgency).toBe(0);
    expect(a.reason).toBe('Declined');
  });

  it('withdrawn shows the right reason', () => {
    const a = computeDealAction({
      state: 'withdrawn',
      role: 'brand',
      campaign: buildCampaign(),
      now: NOW,
    });
    expect(a.kind).toBe('none');
    expect(a.reason).toBe('Withdrawn');
  });
});
