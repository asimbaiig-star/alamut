// Tests for computeDealState — the deal-state classifier (Phase 24).
//
// Coverage strategy: one test per state, plus precedence tests for the
// rules that override (disputed wins everything, closed wins most,
// submission status wins offer.accepted, etc.).

import { describe, it, expect, beforeEach } from 'vitest';
import {
  computeDealState,
  pickLatestSubmission,
  dealStateHasEscrow,
  dealStateIsTerminal,
} from '@/lib/utils/deal-state';
import {
  buildCampaign,
  buildApplication,
  buildOffer,
  buildSubmission,
  buildDispute,
  resetIds,
} from './fixtures';

const CREATOR_ID = 'cr_1';

beforeEach(() => resetIds());

describe('computeDealState — single-record states', () => {
  it("returns 'applied' when the only signal is a submitted application", () => {
    const state = computeDealState({
      creatorId: CREATOR_ID,
      campaign: buildCampaign(),
      application: buildApplication({ status: 'submitted' }),
      submissions: [],
    });
    expect(state).toBe('applied');
  });

  it("returns 'shortlisted' when application status is shortlisted", () => {
    const state = computeDealState({
      creatorId: CREATOR_ID,
      campaign: buildCampaign(),
      application: buildApplication({ status: 'shortlisted' }),
      submissions: [],
    });
    expect(state).toBe('shortlisted');
  });

  it("returns 'shortlisted' via the precomputed input flag (pre-application invite)", () => {
    // P1a: campaign.shortlist was removed; the flag is now caller-provided.
    const state = computeDealState({
      creatorId: CREATOR_ID,
      campaign: buildCampaign(),
      submissions: [],
      shortlisted: true,
    });
    expect(state).toBe('shortlisted');
  });

  it("returns 'declined' for rejected applications", () => {
    const state = computeDealState({
      creatorId: CREATOR_ID,
      campaign: buildCampaign(),
      application: buildApplication({ status: 'rejected' }),
      submissions: [],
    });
    expect(state).toBe('declined');
  });

  it("returns 'withdrawn' for withdrawn applications", () => {
    const state = computeDealState({
      creatorId: CREATOR_ID,
      campaign: buildCampaign(),
      application: buildApplication({ status: 'withdrawn' }),
      submissions: [],
    });
    expect(state).toBe('withdrawn');
  });
});

describe('computeDealState — offer states (pre-acceptance)', () => {
  it("returns 'offer-pending' when latest offer is pending", () => {
    const state = computeDealState({
      creatorId: CREATOR_ID,
      campaign: buildCampaign(),
      offer: buildOffer({ status: 'pending' }),
      submissions: [],
    });
    expect(state).toBe('offer-pending');
  });

  it("returns 'offer-countered' when latest offer is countered", () => {
    const state = computeDealState({
      creatorId: CREATOR_ID,
      campaign: buildCampaign(),
      // P3 §2.1 — `Offer.rounds[]` carries the negotiation transcript.
      offer: buildOffer({
        status: 'countered',
        rate: 1800,
        message: 'higher pls',
        rounds: [
          { by: 'brand', at: +new Date('2026-04-09T00:00:00Z'), rate: 1500, message: 'initial' },
          { by: 'creator', at: +new Date('2026-04-11T00:00:00Z'), rate: 1800, message: 'higher pls' },
        ],
      }),
      submissions: [],
    });
    expect(state).toBe('offer-countered');
  });

  it("returns 'declined' when latest offer is declined (overrides applied)", () => {
    const state = computeDealState({
      creatorId: CREATOR_ID,
      campaign: buildCampaign(),
      application: buildApplication({ status: 'submitted' }),
      offer: buildOffer({ status: 'declined' }),
      submissions: [],
    });
    expect(state).toBe('declined');
  });

  it("returns 'withdrawn' when latest offer is withdrawn", () => {
    const state = computeDealState({
      creatorId: CREATOR_ID,
      campaign: buildCampaign(),
      offer: buildOffer({ status: 'withdrawn' }),
      submissions: [],
    });
    expect(state).toBe('withdrawn');
  });
});

describe('computeDealState — post-acceptance states', () => {
  it("returns 'accepted-production' when offer accepted and no submission yet", () => {
    const state = computeDealState({
      creatorId: CREATOR_ID,
      campaign: buildCampaign({ stage: 'live' }),
      offer: buildOffer({ status: 'accepted' }),
      submissions: [],
    });
    expect(state).toBe('accepted-production');
  });

  it("returns 'in-review' when latest submission status is in_review", () => {
    const state = computeDealState({
      creatorId: CREATOR_ID,
      campaign: buildCampaign({ stage: 'live' }),
      offer: buildOffer({ status: 'accepted' }),
      submissions: [buildSubmission({ status: 'in_review' })],
    });
    expect(state).toBe('in-review');
  });

  it("returns 'revisions-requested' when latest submission status is revisions", () => {
    const state = computeDealState({
      creatorId: CREATOR_ID,
      campaign: buildCampaign({ stage: 'live' }),
      offer: buildOffer({ status: 'accepted' }),
      submissions: [buildSubmission({ status: 'revisions' })],
    });
    expect(state).toBe('revisions-requested');
  });

  it("returns 'approved' when latest submission is approved but campaign hasn't moved to posted", () => {
    const state = computeDealState({
      creatorId: CREATOR_ID,
      campaign: buildCampaign({ stage: 'live' }),
      offer: buildOffer({ status: 'accepted' }),
      submissions: [buildSubmission({ status: 'approved' })],
    });
    expect(state).toBe('approved');
  });

  // P1b §1.2 — campaign-stage no longer carries 'posted'/'reporting'.
  // The "post is live publicly" signal is now Submission.permalink being
  // set (creator pasted the URL into the deal page; brand confirms via
  // Mark Live which writes to the same field). The campaign itself just
  // stays 'live' — close/pause is owned by the brand explicitly.
  it("returns 'posted' when submission approved and has a permalink set", () => {
    const state = computeDealState({
      creatorId: CREATOR_ID,
      campaign: buildCampaign({ stage: 'live' }),
      offer: buildOffer({ status: 'accepted' }),
      submissions: [buildSubmission({ status: 'approved', permalink: 'https://instagram.com/p/abc123' })],
    });
    expect(state).toBe('posted');
  });

  it("stays 'approved' when submission approved but no permalink yet (URL not posted)", () => {
    const state = computeDealState({
      creatorId: CREATOR_ID,
      campaign: buildCampaign({ stage: 'live' }),
      offer: buildOffer({ status: 'accepted' }),
      submissions: [buildSubmission({ status: 'approved' })],
    });
    expect(state).toBe('approved');
  });
});

describe('computeDealState — terminal/override states', () => {
  it("returns 'closed' when campaign stage is closed (regardless of submissions)", () => {
    const state = computeDealState({
      creatorId: CREATOR_ID,
      campaign: buildCampaign({ stage: 'closed' }),
      offer: buildOffer({ status: 'accepted' }),
      submissions: [buildSubmission({ status: 'in_review' })],
    });
    expect(state).toBe('closed');
  });

  it("returns 'disputed' when an open dispute exists (highest precedence)", () => {
    // Even with a closed campaign, an open dispute wins.
    const state = computeDealState({
      creatorId: CREATOR_ID,
      campaign: buildCampaign({ stage: 'closed' }),
      openDispute: buildDispute({ status: 'open' }),
      submissions: [],
    });
    expect(state).toBe('disputed');
  });

  it("returns 'disputed' even if every other state would be terminal", () => {
    const state = computeDealState({
      creatorId: CREATOR_ID,
      campaign: buildCampaign({ stage: 'live' }),
      offer: buildOffer({ status: 'accepted' }),
      submissions: [buildSubmission({ status: 'approved' })],
      openDispute: buildDispute({ status: 'open' }),
    });
    expect(state).toBe('disputed');
  });
});

describe('computeDealState — fallback / edge cases', () => {
  it("returns 'applied' as a final fallback when nothing is set", () => {
    const state = computeDealState({
      creatorId: CREATOR_ID,
      campaign: buildCampaign(),
      submissions: [],
    });
    // No application, no offer, no submission, no shortlist match — friendly default.
    expect(state).toBe('applied');
  });

  it('latest submission wins over older ones', () => {
    const state = computeDealState({
      creatorId: CREATOR_ID,
      campaign: buildCampaign({ stage: 'live' }),
      offer: buildOffer({ status: 'accepted' }),
      submissions: [
        buildSubmission({ round: 1, status: 'revisions', submittedAt: '2026-04-10T00:00:00Z' }),
        buildSubmission({ round: 2, status: 'in_review', submittedAt: '2026-04-15T00:00:00Z' }),
      ],
    });
    expect(state).toBe('in-review');
  });

  it('ignores submissions when offer is not accepted (data inconsistency guard)', () => {
    // A submission without an accepted offer is a data anomaly; classifier
    // should fall through to offer-pending, not mis-classify as in-review.
    const state = computeDealState({
      creatorId: CREATOR_ID,
      campaign: buildCampaign(),
      offer: buildOffer({ status: 'pending' }),
      submissions: [buildSubmission({ status: 'in_review' })],
    });
    expect(state).toBe('offer-pending');
  });
});

describe('pickLatestSubmission', () => {
  it('returns undefined for empty array', () => {
    expect(pickLatestSubmission([])).toBeUndefined();
  });

  it('returns the only element when array has length 1', () => {
    const sub = buildSubmission({ submittedAt: '2026-04-15T00:00:00Z' });
    expect(pickLatestSubmission([sub])).toBe(sub);
  });

  it('picks the newest by submittedAt', () => {
    const a = buildSubmission({ id: 'a', submittedAt: '2026-04-10T00:00:00Z' });
    const b = buildSubmission({ id: 'b', submittedAt: '2026-04-20T00:00:00Z' });
    const c = buildSubmission({ id: 'c', submittedAt: '2026-04-15T00:00:00Z' });
    expect(pickLatestSubmission([a, b, c])).toBe(b);
    expect(pickLatestSubmission([c, b, a])).toBe(b);
  });
});

describe('dealStateHasEscrow', () => {
  it('returns true for states where money is held', () => {
    expect(dealStateHasEscrow('accepted-production')).toBe(true);
    expect(dealStateHasEscrow('in-review')).toBe(true);
    expect(dealStateHasEscrow('revisions-requested')).toBe(true);
    expect(dealStateHasEscrow('approved')).toBe(true);
    expect(dealStateHasEscrow('posted')).toBe(true);
    expect(dealStateHasEscrow('disputed')).toBe(true);
  });

  it('returns false for pre-acceptance and terminal states', () => {
    expect(dealStateHasEscrow('applied')).toBe(false);
    expect(dealStateHasEscrow('shortlisted')).toBe(false);
    expect(dealStateHasEscrow('offer-pending')).toBe(false);
    expect(dealStateHasEscrow('offer-countered')).toBe(false);
    expect(dealStateHasEscrow('declined')).toBe(false);
    expect(dealStateHasEscrow('withdrawn')).toBe(false);
    expect(dealStateHasEscrow('closed')).toBe(false);
  });
});

describe('dealStateIsTerminal', () => {
  it('returns true for terminal states', () => {
    expect(dealStateIsTerminal('closed')).toBe(true);
    expect(dealStateIsTerminal('declined')).toBe(true);
    expect(dealStateIsTerminal('withdrawn')).toBe(true);
  });

  it('returns false for in-flight states', () => {
    expect(dealStateIsTerminal('applied')).toBe(false);
    expect(dealStateIsTerminal('shortlisted')).toBe(false);
    expect(dealStateIsTerminal('offer-pending')).toBe(false);
    expect(dealStateIsTerminal('offer-countered')).toBe(false);
    expect(dealStateIsTerminal('accepted-production')).toBe(false);
    expect(dealStateIsTerminal('in-review')).toBe(false);
    expect(dealStateIsTerminal('revisions-requested')).toBe(false);
    expect(dealStateIsTerminal('approved')).toBe(false);
    expect(dealStateIsTerminal('posted')).toBe(false);
    expect(dealStateIsTerminal('disputed')).toBe(false);
  });
});
