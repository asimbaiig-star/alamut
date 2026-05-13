// @vitest-environment jsdom
//
// Component test — SendOfferModal.
//
// Pins the rate-validation + below-floor warning behaviour. The
// underlying mutation gates (funds, budget cap, dupe-offer) are
// covered by integration-style tests against `v2SendOffer` itself;
// this test just verifies the modal's UI signals work correctly.

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

vi.mock('../../v2CampaignActions', () => ({
  v2SendOffer: vi.fn(),
  v2CounterOffer: vi.fn(),
  v2CounterCounter: vi.fn(),
  v2DeclineOffer: vi.fn(),
  v2MarkContentLive: vi.fn(),
  v2SetSubmissionPermalink: vi.fn(),
}));
vi.mock('../../v2CollabActions', () => ({ v2InviteCreator: vi.fn() }));
vi.mock('../../v2Hooks', () => ({ useV2Creators: () => [] }));
vi.mock('@/lib/permissions', () => ({
  useCapability: () => true,
  requireCapability: () => undefined,
  getActorUserId: () => 'u_test',
}));

import { SendOfferModal } from '../WorkflowModals';
import type { V2Creator } from '../../data';

afterEach(() => cleanup());

function buildCreator(overrides: Partial<V2Creator> = {}): V2Creator {
  return {
    id: 'cr_test',
    handle: '@test',
    name: 'Test Creator',
    tagline: 'Tagline',
    avatar: '',
    cover: '',
    city: 'Lahore',
    country: 'PK',
    bio: '',
    categories: ['Beauty'],
    score: 80,
    priceTier: '$$',
    priceMin: 500,
    priceMax: 2000,
    verified: true,
    channels: [
      { platform: 'instagram', handle: '@test', followers: 100000, engagement: 4.5 },
    ],
    audience: { female: 60, male: 40, age2534: 35, topCity: 'Lahore' },
    rate: 1500,
    pastBrands: [],
    ...overrides,
  };
}

describe('SendOfferModal', () => {
  it('renders the creator name and default rate', () => {
    render(
      <SendOfferModal
        campaignId="cmp_1"
        creator={buildCreator({ name: 'Sarah Chen' })}
        defaultRate={2000}
        onClose={() => undefined}
      />,
    );
    expect(screen.getByRole('heading', { name: /Send offer/i })).toBeInTheDocument();
    // Rate input prefilled
    expect(screen.getByRole('spinbutton')).toHaveValue(2000);
    // Send button shows fmtUSD(2000) = $2K
    expect(screen.getByRole('button', { name: /Send offer/i })).not.toBeDisabled();
  });

  it('shows the "positive rate" error and disables Send when rate is 0', () => {
    render(
      <SendOfferModal
        campaignId="cmp_1"
        creator={buildCreator()}
        defaultRate={1000}
        onClose={() => undefined}
      />,
    );
    const input = screen.getByRole('spinbutton');
    fireEvent.change(input, { target: { value: '0' } });
    expect(screen.getByText(/Enter a positive rate/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Admin\/ops only|Send offer/i })).toBeDisabled();
  });

  it('shows the below-floor warning when rate < creator.availability.minRate', () => {
    const creatorWithFloor = buildCreator({
      availability: { status: 'open', minRate: 1500 },
    });
    render(
      <SendOfferModal
        campaignId="cmp_1"
        creator={creatorWithFloor}
        defaultRate={1000}
        onClose={() => undefined}
      />,
    );
    // Default rate 1000 < floor 1500 → below-floor warning
    expect(screen.getByText(/Below.*floor/i)).toBeInTheDocument();
  });

  it('does NOT show below-floor warning when rate >= floor', () => {
    const creatorWithFloor = buildCreator({
      availability: { status: 'open', minRate: 1500 },
    });
    render(
      <SendOfferModal
        campaignId="cmp_1"
        creator={creatorWithFloor}
        defaultRate={2000}
        onClose={() => undefined}
      />,
    );
    expect(screen.queryByText(/Below.*floor/i)).not.toBeInTheDocument();
  });

  it('disables Send when the message field is cleared', () => {
    render(
      <SendOfferModal
        campaignId="cmp_1"
        creator={buildCreator()}
        defaultRate={1000}
        onClose={() => undefined}
      />,
    );
    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: '   ' } });
    expect(screen.getByRole('button', { name: /Send offer/i })).toBeDisabled();
  });

  it('calls v2SendOffer with the typed rate when Send is clicked', async () => {
    const onClose = vi.fn();
    const { v2SendOffer } = await import('../../v2CampaignActions');
    render(
      <SendOfferModal
        campaignId="cmp_77"
        creator={buildCreator({ id: 'cr_77', name: 'Picked Creator' })}
        defaultRate={3000}
        onClose={onClose}
      />,
    );
    const input = screen.getByRole('spinbutton');
    fireEvent.change(input, { target: { value: '3500' } });
    fireEvent.click(screen.getByRole('button', { name: /Send offer/i }));
    expect(v2SendOffer).toHaveBeenCalledWith('cmp_77', 'cr_77', 3500, expect.any(String));
    expect(onClose).toHaveBeenCalled();
  });
});
