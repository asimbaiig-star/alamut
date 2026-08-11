// @vitest-environment jsdom
//
// Component test — StageActionBanner.
//
// Pins the (stage × sub-state) banner matrix. The 8 active stages
// + the submitted-stage's 3 sub-branches (revision-note, revisions
// status, awaiting-review) give ~10 distinct banner shapes. Each test
// asserts the right title + the right buttons render + clicks dispatch
// the correct handler.
//
// The banner is purely presentational — no store, no mutations. The
// parent (CollabDetail) wires the handlers. We pass jest.fn() spies
// and assert dispatch correctness without rendering anything else.

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

import { StageActionBanner, type StageActionBannerProps } from '../StageActionBanner';

afterEach(() => cleanup());

const noop = () => undefined;

function buildHandlers(): Pick<
  StageActionBannerProps,
  'onAccept' | 'onCounter' | 'onUpload' | 'onWithdraw' | 'onMessageBrand' | 'onLeaveReview'
> {
  return {
    onAccept: vi.fn(),
    onCounter: vi.fn(),
    onUpload: vi.fn(),
    onWithdraw: vi.fn(),
    onMessageBrand: vi.fn(),
    onLeaveReview: vi.fn(),
  };
}

function baseProps(over: Partial<StageActionBannerProps> = {}): StageActionBannerProps {
  return {
    stage: 'pitched',
    campaignBrand: 'Aesop',
    campaignName: 'Spring Renewal',
    campaignPlacement: '1 Reel + 2 Stories',
    onAccept: noop,
    onCounter: noop,
    onUpload: noop,
    onWithdraw: noop,
    onMessageBrand: noop,
    onLeaveReview: noop,
    ...over,
  };
}

describe('StageActionBanner', () => {
  describe('invited stage', () => {
    it('renders invite copy + Accept/Counter/Message brand actions when pendingOffer is present', () => {
      const h = buildHandlers();
      render(<StageActionBanner {...baseProps({
        stage: 'invited',
        pendingOffer: { id: 'off_1', rate: 1500, message: 'love your work' },
        ...h,
      })} />);
      expect(screen.getByText(/Aesop invited you to Spring Renewal/i)).toBeInTheDocument();
      // Net-aware copy
      expect(screen.getByText(/love your work/i)).toBeInTheDocument();
      // All three CTAs present
      expect(screen.getByRole('button', { name: /Accept invitation/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Counter/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Message brand/i })).toBeInTheDocument();
    });

    it('renders no-offer invited branch with Message-brand CTA (cold invite)', () => {
      // Phase 56 — pre-fix this returned null, leaving cold-invited
      // creators with no action affordance on CollabDetail. Now the
      // banner surfaces a "message brand to align on rate" prompt.
      const h = buildHandlers();
      render(<StageActionBanner {...baseProps({
        stage: 'invited',
        // No pendingOffer; brand cold-invited without naming a rate.
        inviteMessage: 'We loved your last Eid edit — want to be on Studio Notes?',
        ...h,
      })} />);
      expect(screen.getByText(/invited you/i)).toBeInTheDocument();
      // The brand's pitch is surfaced verbatim
      expect(screen.getByText(/loved your last Eid edit/i)).toBeInTheDocument();
      // Only Message-brand CTA — no Accept/Counter (there's nothing to accept)
      expect(screen.getByRole('button', { name: /Message brand/i })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Accept invitation/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /^Counter$/i })).not.toBeInTheDocument();
    });

    it('dispatches onAccept / onCounter / onMessageBrand on click', () => {
      const h = buildHandlers();
      render(<StageActionBanner {...baseProps({
        stage: 'invited',
        pendingOffer: { id: 'off_1', rate: 1500, message: '' },
        ...h,
      })} />);
      fireEvent.click(screen.getByRole('button', { name: /Accept invitation/i }));
      fireEvent.click(screen.getByRole('button', { name: /^Counter$/i }));
      fireEvent.click(screen.getByRole('button', { name: /Message brand/i }));
      expect(h.onAccept).toHaveBeenCalledTimes(1);
      expect(h.onCounter).toHaveBeenCalledTimes(1);
      expect(h.onMessageBrand).toHaveBeenCalledTimes(1);
    });
  });

  describe('pitched stage', () => {
    it('renders awaiting-response copy + Message brand', () => {
      render(<StageActionBanner {...baseProps({ stage: 'pitched' })} />);
      expect(screen.getByText(/Application sent — awaiting brand response/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Message brand/i })).toBeInTheDocument();
    });

    it('shows Withdraw application when myApplicationId is set + status is not withdrawn', () => {
      render(<StageActionBanner {...baseProps({
        stage: 'pitched',
        myApplicationId: 'app_1',
        myApplicationStatus: 'submitted',
      })} />);
      expect(screen.getByRole('button', { name: /Withdraw application/i })).toBeInTheDocument();
    });

    it('hides Withdraw application when status is already withdrawn', () => {
      render(<StageActionBanner {...baseProps({
        stage: 'pitched',
        myApplicationId: 'app_1',
        myApplicationStatus: 'withdrawn',
      })} />);
      expect(screen.queryByRole('button', { name: /Withdraw application/i })).not.toBeInTheDocument();
    });

    it('dispatches onWithdraw + onMessageBrand correctly', () => {
      const h = buildHandlers();
      render(<StageActionBanner {...baseProps({
        stage: 'pitched',
        myApplicationId: 'app_1',
        myApplicationStatus: 'submitted',
        ...h,
      })} />);
      fireEvent.click(screen.getByRole('button', { name: /Withdraw application/i }));
      fireEvent.click(screen.getByRole('button', { name: /Message brand/i }));
      expect(h.onWithdraw).toHaveBeenCalledTimes(1);
      expect(h.onMessageBrand).toHaveBeenCalledTimes(1);
    });
  });

  describe('negotiating stage', () => {
    it('renders offer rate + net + Accept/Counter CTAs', () => {
      render(<StageActionBanner {...baseProps({
        stage: 'negotiating',
        pendingOffer: { id: 'off_2', rate: 2000, message: 'best we can do' },
      })} />);
      expect(screen.getByText(/Aesop sent an offer/i)).toBeInTheDocument();
      // Rate appears in the body
      expect(screen.getByText(/best we can do/i)).toBeInTheDocument();
      // Both CTAs
      expect(screen.getByRole('button', { name: /^Counter$/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Accept \(/i })).toBeInTheDocument();
    });

    it('returns null when negotiating stage has no pendingOffer', () => {
      const { container } = render(<StageActionBanner {...baseProps({ stage: 'negotiating' })} />);
      expect(container.firstChild).toBeNull();
    });
  });

  describe('confirmed stage', () => {
    it('renders moss tone + Upload content button', () => {
      const h = buildHandlers();
      render(<StageActionBanner {...baseProps({
        stage: 'confirmed',
        activeOfferRate: 1500,
        ...h,
      })} />);
      expect(screen.getByText(/Confirmed — start creating/i)).toBeInTheDocument();
      expect(screen.getByText(/secured in escrow/i)).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: /Upload content/i }));
      expect(h.onUpload).toHaveBeenCalledTimes(1);
    });

    it('omits the "secured in escrow" copy when activeOfferRate is unset', () => {
      render(<StageActionBanner {...baseProps({ stage: 'confirmed' })} />);
      expect(screen.queryByText(/secured in escrow/i)).not.toBeInTheDocument();
      expect(screen.getByText(/When your draft is ready/i)).toBeInTheDocument();
    });
  });

  describe('submitted stage — 3 sub-branches', () => {
    it('renders revision-note copy + Resubmit when latestRevisionNote present (highest priority)', () => {
      render(<StageActionBanner {...baseProps({
        stage: 'submitted',
        latestRevisionNote: 'Brighter lighting please',
        // latestSubmissionStatus is irrelevant when revisionNote wins
        latestSubmissionStatus: 'in_review',
      })} />);
      expect(screen.getByText(/requested changes/i)).toBeInTheDocument();
      expect(screen.getByText(/Brighter lighting please/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Resubmit/i })).toBeInTheDocument();
    });

    it('renders revisions-status copy + Resubmit when latestSubmissionStatus === "revisions"', () => {
      render(<StageActionBanner {...baseProps({
        stage: 'submitted',
        latestSubmissionStatus: 'revisions',
      })} />);
      expect(screen.getByText(/requested changes/i)).toBeInTheDocument();
      expect(screen.getByText(/Address the feedback in the deliverables/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Resubmit/i })).toBeInTheDocument();
    });

    it('renders awaiting-review default copy + Message brand when no revision signal', () => {
      render(<StageActionBanner {...baseProps({
        stage: 'submitted',
        latestSubmissionStatus: 'in_review',
      })} />);
      expect(screen.getByText(/Submitted — awaiting brand review/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Message brand/i })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Resubmit/i })).not.toBeInTheDocument();
    });
  });

  describe('approved stage', () => {
    it('renders moss-tone funds-released copy + Message brand (P67 honest-copy)', () => {
      // P67 — escrow releases AT approve (v2ApproveContent). The old
      // banner promised "Funds will release ... once it's marked live",
      // which contradicted the wallet the creator was looking at.
      const h = buildHandlers();
      render(<StageActionBanner {...baseProps({ stage: 'approved', ...h })} />);
      expect(screen.getByText(/Approved — funds released, post it/i)).toBeInTheDocument();
      expect(screen.getByText(/payout is in your wallet/i)).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: /Message brand/i }));
      expect(h.onMessageBrand).toHaveBeenCalledTimes(1);
    });
  });

  describe('live stage', () => {
    it('renders permalink + "View post" link when livePermalink is set', () => {
      render(<StageActionBanner {...baseProps({
        stage: 'live',
        livePermalink: 'https://instagram.com/p/abc123',
      })} />);
      expect(screen.getByText(/Your post is live/i)).toBeInTheDocument();
      const link = screen.getByRole('link', { name: /View post/i });
      expect(link).toHaveAttribute('href', 'https://instagram.com/p/abc123');
      expect(link).toHaveAttribute('target', '_blank');
    });

    it('renders "Tracking" fallback copy + no CTA when livePermalink is missing', () => {
      render(<StageActionBanner {...baseProps({ stage: 'live' })} />);
      expect(screen.getByText(/Tracking impressions/i)).toBeInTheDocument();
      expect(screen.queryByRole('link', { name: /View post/i })).not.toBeInTheDocument();
    });
  });

  describe('paid stage', () => {
    it('renders the creator net (gross × 0.85) + Leave review CTA', () => {
      const h = buildHandlers();
      render(<StageActionBanner {...baseProps({
        stage: 'paid',
        activeOfferRate: 1000,
        ...h,
      })} />);
      // 1000 * 0.85 = 850; fmtUSD($850) renders as "$850" (under 1000 threshold)
      expect(screen.getByText(/Paid — \$850 received/)).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: /Leave review/i }));
      expect(h.onLeaveReview).toHaveBeenCalledTimes(1);
    });
  });

  describe('catch-all', () => {
    it('explains a cancelled collab instead of rendering nothing', () => {
      // This test previously asserted the OPPOSITE, with a comment claiming
      // "'cancelled' is a real V2CollabStage but the banner has no branch for
      // it (caller filters cancelled collabs earlier)". Both claims were
      // false: cancelled was not in the union (it was forced in with a cast),
      // and no caller filtered it — so the creator got a blank space where an
      // explanation belonged, and this test locked that in.
      const { container } = render(<StageActionBanner {...baseProps({
        stage: 'cancelled',
      })} />);
      expect(container.firstChild).not.toBeNull();
      expect(container.textContent).toMatch(/isn't going ahead/i);
    });

    it('returns null for a genuinely unrecognised stage (defensive)', () => {
      // A value outside the union entirely — the real defensive case.
      const { container } = render(<StageActionBanner {...baseProps({
        stage: 'not-a-stage' as never,
      })} />);
      expect(container.firstChild).toBeNull();
    });
  });
});
