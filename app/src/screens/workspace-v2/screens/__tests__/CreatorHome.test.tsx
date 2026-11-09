// @vitest-environment jsdom
//
// Component smoke test — CreatorHome (portal canvas, Round 2).
//
// Hooks are mocked to controlled shapes. What we pin:
//   - no creator on the account renders a plain message, not a crash
//   - the greeting uses the first name; the money strip shows what's ready
//     to withdraw, with the test-mode line, and Withdraw opens the form
//   - an offer on top of the pile is accepted in place via v2AcceptOffer,
//     "You'd keep" is the money module's net (never a local 0.85), and
//     Counter opens the deal with the counter form
//   - deals in motion counts each stage from the creator's collabs

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { splitAcrossSlots } from '@/lib/api/money';

function renderWithRouter(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

const mockCreator = { id: 'c_sarah', userId: 'u_sarah', name: 'Sarah Johnson' };
const mockWallet = { available: 4200, pending: 3400, lifetime: 47800, currency: 'USD' as const, ledger: [] };

let CURRENT_CREATOR: typeof mockCreator | null = mockCreator;
let NEEDS: unknown[] = [];
let COLLABS: { campaignId: string; stage: string; price?: number; deliverables?: { id: string; status: string }[] }[] = [];

vi.mock('../../v2Hooks', () => ({
  useV2CurrentCreator: () => CURRENT_CREATOR,
  useV2CreatorWallet: () => mockWallet,
  useV2AllCampaigns: () => [],
  useV2MyCollabs: () => COLLABS,
}));

vi.mock('../../needsYou', () => ({
  useCreatorNeedsYou: () => NEEDS,
}));

vi.mock('../../v2CampaignActions', () => ({
  v2AcceptOffer: vi.fn(),
}));

vi.mock('@/lib/api/store', () => ({
  useStore: Object.assign(
    (selector?: (s: { db: Record<string, unknown[]>; session: null }) => unknown) => {
      const state = { db: { creators: [], campaigns: [], notifications: [], users: [], offers: [], applications: [] }, session: null };
      return selector ? selector(state) : state;
    },
    { getState: () => ({ db: {}, session: null }) },
  ),
  tx: () => undefined,
}));

import { CreatorHome } from '../CreatorHome';
import { v2AcceptOffer } from '../../v2CampaignActions';

const offer = {
  id: 'offer_x',
  kind: 'offer',
  title: 'Oakmoss sent an offer',
  sub: 'Spring serum launch · reply to keep it open',
  route: 'collab:col_1',
  brand: 'Oakmoss',
  campaignName: 'Spring serum launch',
  collabId: 'col_1',
  offerId: 'off_1',
  rate: 1800,
  asked: 2000,
  slots: 2,
  deliverable: '1 Reel + 3 Stories',
};

afterEach(() => {
  cleanup();
  CURRENT_CREATOR = mockCreator;
  NEEDS = [];
  COLLABS = [];
  vi.clearAllMocks();
});

describe('CreatorHome (smoke)', () => {
  it('says so plainly when the account has no creator profile', () => {
    CURRENT_CREATOR = null;
    renderWithRouter(<CreatorHome onRoute={() => undefined} />);
    expect(screen.getByText(/couldn’t find a creator profile/i)).toBeInTheDocument();
  });

  it('greets by first name and shows the money ready to withdraw', () => {
    const onRoute = vi.fn();
    renderWithRouter(<CreatorHome onRoute={onRoute} />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toMatch(/, Sarah\.$/);
    expect(screen.getByText('$4,200')).toBeInTheDocument();
    expect(screen.getByText(/payments run in test mode/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Withdraw' }));
    expect(onRoute).toHaveBeenCalledWith('creator-wallet?action=withdraw');
  });

  it('accepts an offer in place and shows the real net', () => {
    NEEDS = [offer];
    const onRoute = vi.fn();
    renderWithRouter(<CreatorHome onRoute={onRoute} />);

    const net = splitAcrossSlots(1800, 2).net;
    expect(screen.getByText(`$${net.toLocaleString('en-US')}`)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Accept $1,800' }));
    expect(v2AcceptOffer).toHaveBeenCalledWith('off_1');

    fireEvent.click(screen.getByRole('button', { name: 'Counter' }));
    expect(onRoute).toHaveBeenCalledWith('collab:col_1?action=counter');
  });

  it('shows deals in motion as money by stage, net of fees once agreed', () => {
    const d = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `d${i}`, status: 'pending' }));
    COLLABS = [
      { campaignId: 'a', stage: 'invited', price: 0, deliverables: d(1) },
      { campaignId: 'b', stage: 'negotiating', price: 0, deliverables: d(1) },
      { campaignId: 'c', stage: 'confirmed', price: 1000, deliverables: d(1) },
      { campaignId: 'd', stage: 'paid', price: 2000, deliverables: d(2) },
      { campaignId: 'e', stage: 'cancelled', price: 500, deliverables: d(1) },
    ];
    renderWithRouter(<CreatorHome onRoute={() => undefined} />);
    expect(screen.getByRole('button', { name: /^Offers: 2 deals, \$0 you’d keep/ })).toBeInTheDocument();
    // $1,000 less the 10% fee and 5% withholding.
    expect(screen.getByRole('button', { name: /^Working: 1 deal, \$850 held, you keep/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Paid: 1 deal, \$1,700 after fees/ })).toBeInTheDocument();
  });
});
