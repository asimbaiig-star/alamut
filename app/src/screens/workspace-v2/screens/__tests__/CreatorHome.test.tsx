// @vitest-environment jsdom
//
// Component smoke test — CreatorHome, the creator's Today (Round 8, B).
//
// Hooks are mocked to controlled shapes. What we pin:
//   - no creator on the account renders a plain message, not a crash
//   - the greeting uses the first name; the money card shows what's ready
//     to withdraw, with the test-mode line, and Withdraw opens the form
//   - every need is a row with its own buttons: an offer is accepted in
//     place via v2AcceptOffer, "You'd keep" is the money module's net, and
//     Counter opens the deal with the counter form
//   - unread messages on the deal show beside its row
//   - the header says what's on its way, from the creator's own deals

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
let COLLABS: { id?: string; campaignId: string; creatorId?: string; stage: string; price?: number; deliverables?: { id: string; status: string }[] }[] = [];
let CONVERSATIONS: { campaignId: string; creatorId: string; unread: number }[] = [];

vi.mock('../../v2Hooks', () => ({
  useV2CurrentCreator: () => CURRENT_CREATOR,
  useV2CreatorWallet: () => mockWallet,
  useV2AllCampaigns: () => [],
  useV2MyCollabs: () => COLLABS,
  useV2Conversations: () => CONVERSATIONS,
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
  CONVERSATIONS = [];
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

  it('shows unread messages on the deal beside its row', () => {
    NEEDS = [offer];
    COLLABS = [{ id: 'col_1', campaignId: 'cmp_1', creatorId: 'c_sarah', stage: 'negotiating', price: 0, deliverables: [] }];
    CONVERSATIONS = [{ campaignId: 'cmp_1', creatorId: 'c_sarah', unread: 2 }];
    const onRoute = vi.fn();
    renderWithRouter(<CreatorHome onRoute={onRoute} />);
    fireEvent.click(screen.getByRole('button', { name: '2 new messages on this deal' }));
    expect(onRoute).toHaveBeenCalledWith('collab:col_1');
  });

  it('says in the header what is on its way, net of fees', () => {
    const d = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `d${i}`, status: 'pending' }));
    COLLABS = [
      { campaignId: 'c', stage: 'confirmed', price: 1000, deliverables: d(1) },
      { campaignId: 'e', stage: 'cancelled', price: 500, deliverables: d(1) },
    ];
    renderWithRouter(<CreatorHome onRoute={() => undefined} />);
    // $1,000 less the 10% fee and 5% withholding; the cancelled deal doesn't count.
    expect(screen.getByText(/\$850 is on its way to you\./)).toBeInTheDocument();
  });

});
