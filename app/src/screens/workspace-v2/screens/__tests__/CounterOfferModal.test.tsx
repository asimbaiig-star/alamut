// @vitest-environment jsdom
//
// Component test — CounterOfferModal.
//
// Pins two behaviours added in the MEDIUM-tier slice:
//   1. "+N% vs $X" delta hint renders correctly for both positive and
//      negative directions, and surfaces the "over 10× — rejected on
//      submit" copy at the extreme.
//   2. Send button disables when rate > 10× current (the sanity bound
//      that was added to both `v2CounterOffer` and `v2CounterCounter`).
//
// The modal's Send / Decline / Send-counter buttons fire v2 mutations
// on click. We mock those mutations so this stays a pure UI test —
// rendering doesn't depend on a populated store. Capability gating is
// not exercised here; `useCapability` is for `MarkLiveModal` and
// `SendOfferModal`, not `CounterOfferModal`.

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Mock the mutations so the test is pure UI — no store dependency.
vi.mock('../../v2CampaignActions', () => ({
  v2CounterOffer: vi.fn(),
  v2CounterCounter: vi.fn(),
  v2DeclineOffer: vi.fn(),
  v2MarkContentLive: vi.fn(),
  v2SendOffer: vi.fn(),
  v2SetSubmissionPermalink: vi.fn(),
}));

// `useCapability` is also imported by SendOfferModal / MarkLiveModal in
// the same file. Stub it to always return true so the buttons render
// in their "enabled" form. CounterOfferModal itself doesn't call it
// — but the module import resolves all named imports up front.
vi.mock('@/lib/permissions', () => ({
  useCapability: () => true,
  requireCapability: () => undefined,
  getActorUserId: () => 'u_test',
}));

// `v2InviteCreator` import inside WorkflowModals lives in v2CollabActions.
vi.mock('../../v2CollabActions', () => ({
  v2InviteCreator: vi.fn(),
}));

// `useV2Creators` is imported but only used by InviteCreatorsModal.
vi.mock('../../v2Hooks', () => ({
  useV2Creators: () => [],
}));

import { CounterOfferModal } from '../WorkflowModals';

afterEach(() => cleanup());

describe('CounterOfferModal', () => {
  it('renders with a positive delta hint when the default counter is above current', () => {
    // Creator side: default counter = 110% of current.
    render(
      <CounterOfferModal
        offerId="off_1"
        currentRate={1000}
        counterpartyName="Aesop"
        side="creator"
        onClose={() => undefined}
      />,
    );
    // Default rate is round(1000 * 1.1) = 1100. Hint should be +10%.
    expect(screen.getByText(/\+10%/)).toBeInTheDocument();
    // fmtUSD(1000) renders "$1K" (uppercase K). Use a flexible matcher
    // that accommodates either case + adjacent whitespace nodes.
    expect(screen.getByText(/vs \$1/i)).toBeInTheDocument();
  });

  it('renders a negative delta hint when the brand counters down', () => {
    // Brand side: default counter = 90% of current.
    render(
      <CounterOfferModal
        offerId="off_1"
        currentRate={1000}
        counterpartyName="Sarah"
        side="brand"
        onClose={() => undefined}
      />,
    );
    // Default rate = round(1000 * 0.9) = 900 → -10%.
    expect(screen.getByText(/-10%/)).toBeInTheDocument();
  });

  it('disables Send when rate exceeds 10× current (sanity bound)', () => {
    render(
      <CounterOfferModal
        offerId="off_1"
        currentRate={500}
        counterpartyName="Aesop"
        side="creator"
        onClose={() => undefined}
      />,
    );
    const input = screen.getByRole('spinbutton');
    // Type an extreme counter — 6000 is 12× the original $500.
    fireEvent.change(input, { target: { value: '6000' } });
    // The "rejected on submit" hint should surface.
    expect(screen.getByText(/over 10×/i)).toBeInTheDocument();
    // The send button should be disabled.
    const sendBtn = screen.getByRole('button', { name: /Send counter/i });
    expect(sendBtn).toBeDisabled();
  });

  it('keeps Send enabled at a normal counter rate (under 10×)', () => {
    render(
      <CounterOfferModal
        offerId="off_1"
        currentRate={500}
        counterpartyName="Aesop"
        side="creator"
        onClose={() => undefined}
      />,
    );
    const input = screen.getByRole('spinbutton');
    fireEvent.change(input, { target: { value: '750' } });
    const sendBtn = screen.getByRole('button', { name: /Send counter/i });
    expect(sendBtn).not.toBeDisabled();
    // +50% hint
    expect(screen.getByText(/\+50%/)).toBeInTheDocument();
  });

  it('disables Send when rate is 0', () => {
    render(
      <CounterOfferModal
        offerId="off_1"
        currentRate={500}
        side="creator"
        onClose={() => undefined}
      />,
    );
    const input = screen.getByRole('spinbutton');
    fireEvent.change(input, { target: { value: '0' } });
    const sendBtn = screen.getByRole('button', { name: /Send counter/i });
    expect(sendBtn).toBeDisabled();
  });

  it('calls v2CounterOffer (creator side) and closes when Send is clicked', async () => {
    const onClose = vi.fn();
    const { v2CounterOffer } = await import('../../v2CampaignActions');
    render(
      <CounterOfferModal
        offerId="off_42"
        currentRate={500}
        side="creator"
        onClose={onClose}
      />,
    );
    const input = screen.getByRole('spinbutton');
    fireEvent.change(input, { target: { value: '600' } });
    const sendBtn = screen.getByRole('button', { name: /Send counter/i });
    fireEvent.click(sendBtn);
    expect(v2CounterOffer).toHaveBeenCalledWith('off_42', 600, expect.any(String));
    expect(onClose).toHaveBeenCalled();
  });

  it('calls v2CounterCounter (brand side) when Send is clicked', async () => {
    const onClose = vi.fn();
    const { v2CounterCounter } = await import('../../v2CampaignActions');
    render(
      <CounterOfferModal
        offerId="off_99"
        currentRate={2000}
        side="brand"
        onClose={onClose}
      />,
    );
    const input = screen.getByRole('spinbutton');
    fireEvent.change(input, { target: { value: '1500' } });
    const sendBtn = screen.getByRole('button', { name: /Send counter/i });
    fireEvent.click(sendBtn);
    expect(v2CounterCounter).toHaveBeenCalledWith('off_99', 1500, expect.any(String));
    expect(onClose).toHaveBeenCalled();
  });
});
