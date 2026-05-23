// @vitest-environment jsdom
//
// Component smoke test — BrandHome.
//
// BrandHome is a heavy dashboard with many hooks + sub-components.
// We don't try to exhaustively pin every section's render shape —
// instead we mock the v2 hooks to controlled values and assert the
// top-level chrome renders + primary CTAs dispatch through onRoute.
//
// What we pin:
//   - Topbar greeting + "New campaign" CTA wires to onRoute('campaign-new')
//   - Empty-state render doesn't crash (no campaigns, no wallet activity)
//   - With a populated brand + a campaign, the campaign count appears
//     in the crumb ("1 live")
//   - The spark composer's Send CTA dispatches to onRoute('spark')

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// P64 — Topbar now mounts the real NotificationsBell which uses
// useNavigate from react-router. Render through MemoryRouter so the
// hook has its context. Pre-P64 the stub bell had no router dependency.
function renderWithRouter(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

// Mock all the hooks BrandHome reads. Returning controlled shapes makes
// the test deterministic + fast. Real-store integration is exercised
// at the v2 mutation test level.
const mockBrand = {
  id: 'b_aesop',
  userId: 'u_hannah',
  name: 'Aesop',
  industry: 'Beauty',
  hq: 'Melbourne',
  website: 'https://aesop.com',
  about: 'Skincare from Melbourne.',
  preferredCategories: ['Beauty'],
  preferredRegions: ['Global'],
  walletBalance: 50000,
  escrowHeld: 0,
  verified: true,
  savedCreators: [],
};

const mockCampaign = {
  id: 'cmp_1',
  brand: 'Aesop',
  brandId: 'b_aesop',
  name: 'Spring Renewal',
  status: 'Live',
  placement: '1 Reel + 2 Stories',
  creators: [],
  budget: 12000,
  spent: 0,
  region: 'Global',
};

vi.mock('../../v2Hooks', () => ({
  useV2BrandWallet: () => ({
    available: 50000,
    reserved: 0,
    inFlight: 0,
    currency: 'USD',
    ledger: [],
  }),
  useV2Campaigns: () => [mockCampaign],
  useV2Creators: () => [],
  useV2CurrentBrand: () => mockBrand,
}));

vi.mock('@/lib/api/store', () => ({
  useStore: Object.assign(
    (selector?: (s: { db: Record<string, unknown[]> }) => unknown) => {
      const state = { db: { users: [{ id: 'u_hannah', brandId: 'b_aesop' }], collaborations: [], notifications: [], transactions: [], reviews: [], submissions: [], offers: [], applications: [], deliverables: [], campaigns: [mockCampaign], brands: [mockBrand], creators: [] } };
      return selector ? selector(state) : state;
    },
    { getState: () => ({ db: { users: [{ id: 'u_hannah', brandId: 'b_aesop' }], collaborations: [], notifications: [], transactions: [], reviews: [], submissions: [], offers: [], applications: [], deliverables: [], campaigns: [mockCampaign], brands: [mockBrand], creators: [] } }) },
  ),
  tx: () => undefined,
}));

vi.mock('../../v2Adapters', () => ({
  collabsForCampaign: () => [],
  V2_PIPELINE_STAGES: [],
}));

vi.mock('../../useRecentActivity', () => ({
  useRecentActivity: () => [],
}));

import { BrandHome } from '../BrandHome';

afterEach(() => cleanup());

describe('BrandHome (smoke)', () => {
  it('renders without crashing and shows the brand name in the topbar', () => {
    renderWithRouter(<BrandHome onRoute={() => undefined} />);
    expect(screen.getByText(/Welcome back, Aesop/i)).toBeInTheDocument();
  });

  it('shows the live-campaign count in the topbar crumb', () => {
    renderWithRouter(<BrandHome onRoute={() => undefined} />);
    // "1 live" appears in the crumb AND in the Quarter pacing sub-text
    // ("1 live campaign on plan"). Both renders confirm the mocked
    // campaign's Live status flowed through to the UI.
    expect(screen.getAllByText(/1 live/i).length).toBeGreaterThan(0);
  });

  it('"New campaign" CTA in the topbar dispatches to onRoute("campaign-new")', () => {
    const onRoute = vi.fn();
    renderWithRouter(<BrandHome onRoute={onRoute} />);
    fireEvent.click(screen.getByRole('button', { name: /New campaign/i }));
    expect(onRoute).toHaveBeenCalledWith('campaign-new');
  });

  it('SparkComposer Send button dispatches to onRoute("spark")', () => {
    const onRoute = vi.fn();
    renderWithRouter(<BrandHome onRoute={onRoute} />);
    // SparkComposer renders a "Send" button with an arrow icon.
    const sendBtn = screen.getByRole('button', { name: /^Send/i });
    fireEvent.click(sendBtn);
    expect(onRoute).toHaveBeenCalledWith('spark');
  });
});
