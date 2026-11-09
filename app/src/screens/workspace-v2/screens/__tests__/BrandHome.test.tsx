// @vitest-environment jsdom
//
// Component smoke test — BrandHome (portal canvas, Round 2).
//
// The hooks are mocked to controlled shapes; real-store behaviour is
// covered by the v2 mutation tests. What we pin:
//   - the greeting names the brand, and "New campaign" routes to the wizard
//   - the money strip shows what's held, with the test-mode line beside it
//   - a pitch on top of the pile is answered in place: Accept calls
//     v2AcceptPitch with its application, Pass calls v2RejectApplication,
//     Save toggles the creator, and Counter opens the pipeline
//   - an empty pile says so instead of rendering an empty card

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// The greeting row mounts the real NotificationsBell (uses useNavigate).
function renderWithRouter(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

const mockBrand = {
  id: 'b_oak',
  userId: 'u_oak',
  name: 'Oakmoss',
  industry: 'Beauty',
  verified: true,
  savedCreators: [],
};

const mockCampaign = {
  id: 'cmp_1',
  brand: 'Oakmoss',
  name: 'Spring serum launch',
  status: 'Live',
  placement: '1 Reel + 2 Stories',
  creators: ['c_ana'],
  budget: 9000,
  spent: 4500,
  live: 2,
};

const mockCreator = {
  id: 'c_ana',
  name: 'Ana Ruiz',
  avatar: '',
  channels: [{ platform: 'instagram', handle: '@ana', followers: 48000, engagement: 5.2 }],
};

let NEEDS: unknown[] = [];

vi.mock('../../v2Hooks', () => ({
  useV2BrandWallet: () => ({
    available: 48200, reserved: 38600, inFlight: 0, currency: 'USD', ledger: [],
    thisMonth: { topups: 0, released: 9450, fees: 0, adSpend: 0 },
  }),
  useV2Campaigns: () => [mockCampaign],
  useV2Creators: () => [mockCreator],
  useV2CurrentBrand: () => mockBrand,
  useV2BrandShortlist: () => [],
  v2ToggleSavedCreator: vi.fn(),
}));

vi.mock('../../needsYou', () => ({
  useBrandNeedsYou: () => NEEDS,
}));

vi.mock('../../v2CampaignActions', () => ({
  v2AcceptPitch: vi.fn(),
  v2RejectApplication: vi.fn(),
}));

vi.mock('@/lib/permissions', () => ({
  useCapability: () => true,
}));

vi.mock('@/lib/api/store', () => ({
  useStore: Object.assign(
    (selector?: (s: { db: Record<string, unknown[]>; session: null }) => unknown) => {
      const state = { db: { notifications: [], users: [] }, session: null };
      return selector ? selector(state) : state;
    },
    { getState: () => ({ db: { notifications: [], users: [] }, session: null }) },
  ),
  tx: () => undefined,
}));

import { BrandHome } from '../BrandHome';
import { v2AcceptPitch, v2RejectApplication } from '../../v2CampaignActions';
import { v2ToggleSavedCreator } from '../../v2Hooks';

const pitch = {
  id: 'pitch_x',
  kind: 'pitch',
  title: 'Ana Ruiz pitched at $1,400',
  sub: 'Spring serum launch · your target $1,500',
  route: 'campaign:cmp_1?tab=pipeline',
  campaignId: 'cmp_1',
  campaignName: 'Spring serum launch',
  creatorId: 'c_ana',
  creatorName: 'Ana Ruiz',
  applicationId: 'app_1',
  pitch: 'Two Reels built around a morning routine.',
  rate: 1400,
  target: 1500,
};

afterEach(() => {
  cleanup();
  NEEDS = [];
  vi.clearAllMocks();
});

describe('BrandHome (smoke)', () => {
  it('greets the brand and routes "New campaign" to the wizard', () => {
    const onRoute = vi.fn();
    renderWithRouter(<BrandHome onRoute={onRoute} />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toMatch(/, Oakmoss\.$/);
    fireEvent.click(screen.getAllByRole('button', { name: 'New campaign' })[0]!);
    expect(onRoute).toHaveBeenCalledWith('campaign-new');
  });

  it('shows the money held for creators with the test-mode line beside Top up', () => {
    const onRoute = vi.fn();
    renderWithRouter(<BrandHome onRoute={onRoute} />);
    expect(screen.getByText('$38,600')).toBeInTheDocument();
    expect(screen.getByText(/payments run in test mode/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Top up' }));
    expect(onRoute).toHaveBeenCalledWith('wallet?action=topup');
  });

  it('says it is caught up when nothing is waiting', () => {
    renderWithRouter(<BrandHome onRoute={() => undefined} />);
    expect(screen.getByText(/all caught up/i)).toBeInTheDocument();
  });

  it('answers a pitch in place: accept, pass, save and counter', () => {
    NEEDS = [pitch];
    const onRoute = vi.fn();
    renderWithRouter(<BrandHome onRoute={onRoute} />);

    fireEvent.click(screen.getByRole('button', { name: 'Accept $1,400' }));
    expect(v2AcceptPitch).toHaveBeenCalledWith('app_1');

    fireEvent.click(screen.getByRole('button', { name: 'Pass' }));
    expect(v2RejectApplication).toHaveBeenCalledWith('app_1');

    fireEvent.click(screen.getByRole('button', { name: 'Save creator' }));
    expect(v2ToggleSavedCreator).toHaveBeenCalledWith('c_ana');

    fireEvent.click(screen.getByRole('button', { name: 'Counter' }));
    expect(onRoute).toHaveBeenCalledWith('campaign:cmp_1?tab=pipeline');
  });

  it("gathers a campaign's pitches into one sheet that opens the comparison", () => {
    const onRoute = vi.fn();
    NEEDS = [
      { id: 'ctr', kind: 'counter', title: 'Lena countered at $2,200', sub: 'accept, counter back or decline', route: 'campaign:cmp_1?tab=pipeline', campaignId: 'cmp_1', campaignName: 'Spring serum launch', creatorName: 'Lena Ortiz', rate: 2200 },
      { ...pitch, id: 'p1', rate: 1400 },
      { ...pitch, id: 'p2', creatorName: 'Noor Aziz', rate: 1650 },
      { ...pitch, id: 'p3', creatorName: 'Ziad Park', rate: 2600 },
    ];
    renderWithRouter(<BrandHome onRoute={onRoute} />);
    // One thing plus three pitches, said as such, not "4 things need you".
    expect(screen.getByText(/One thing needs you, and 3 pitches are waiting on 1 campaign\./)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Needs you/ })).toHaveTextContent('2,');
    // The counter is on top; the pitch group is the band behind it.
    fireEvent.click(screen.getByRole('button', { name: /3 pitches on Spring serum launch/ }));
    expect(screen.getByText('3 creators pitched for Spring serum launch')).toBeInTheDocument();
    // The asks, summarised for the decision.
    expect(screen.getByText('Lowest ask').nextSibling).toHaveTextContent('$1,400');
    expect(screen.getByText('Highest ask').nextSibling).toHaveTextContent('$2,600');
    fireEvent.click(screen.getByRole('button', { name: 'Compare 3 pitches' }));
    expect(onRoute).toHaveBeenCalledWith('campaign:cmp_1?tab=pipeline');
  });

  it('lists live campaigns with what they have spent', () => {
    renderWithRouter(<BrandHome onRoute={() => undefined} />);
    expect(screen.getByText('Spring serum launch')).toBeInTheDocument();
    expect(screen.getByText('$4,500')).toBeInTheDocument();
  });
});
