// @vitest-environment jsdom
//
// Component smoke test — CreatorHome.
//
// Mirrors the BrandHome smoke pattern: mock the v2 hooks + store
// to controlled shapes, render, assert chrome + primary CTA dispatch.
//
// What we pin:
//   - Renders the empty state when no creator profile is linked
//     (`me` falls through to null) — most defensive path
//   - Renders the greeting with the creator's first name when a creator
//     IS linked
//   - Renders the earnings hero when wallet has lifetime > 0

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// P64 — Topbar now mounts the real NotificationsBell (uses useNavigate).
function renderWithRouter(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

const mockCreator = {
  id: 'c_sarah',
  userId: 'u_sarah',
  name: 'Sarah Johnson',
  handle: '@sarahstyle',
  tagline: 'Beauty + lifestyle',
  bio: '',
  city: 'Lahore',
  country: 'PK',
  languages: ['en'],
  categories: ['Beauty'],
  portrait: '',
  work: [],
  platforms: [],
  reach: 100000,
  engagement: 4.5,
  rating: 4.7,
  tier: 'Specialist' as const,
  responseHrs: 2,
  rateCard: { post: '', reel: '', story: '', longform: '' },
  payout: { method: 'bank', account: '', currency: 'USD' },
  walletBalance: 4200,
  pendingBalance: 3400,
  lifetimeEarnings: 47800,
  verified: true,
  pressMentions: [],
  pastClients: [],
};

const mockWallet = {
  available: 4200,
  pending: 3400,
  lifetime: 47800,
  currency: 'USD' as const,
  ledger: [],
};

// Toggle to test the empty path
let CURRENT_CREATOR: typeof mockCreator | null = mockCreator;

vi.mock('../../v2Hooks', () => ({
  useV2CurrentCreator: () => CURRENT_CREATOR,
  useV2Creators: () => (CURRENT_CREATOR ? [CURRENT_CREATOR] : []),
  useV2CreatorWallet: () => mockWallet,
  useV2AllCampaigns: () => [],
  useV2MyCollabs: () => [],
}));

vi.mock('@/lib/api/store', () => ({
  useStore: Object.assign(
    (selector?: (s: { db: Record<string, unknown[]> }) => unknown) => {
      const state = { db: {
        users: CURRENT_CREATOR ? [{ id: 'u_sarah', creatorId: CURRENT_CREATOR.id }] : [],
        collaborations: [], notifications: [], transactions: [], reviews: [],
        submissions: [], offers: [], applications: [], deliverables: [],
        campaigns: [], brands: [], creators: CURRENT_CREATOR ? [CURRENT_CREATOR] : [],
      } };
      return selector ? selector(state) : state;
    },
    { getState: () => ({ db: {} }) },
  ),
  tx: () => undefined,
}));

// Spread the REAL module and override only what this suite needs. The old
// mock enumerated its exports, so every new adapter export broke it — the
// same drift hazard the stage model itself was fixed for.
vi.mock('../../v2Adapters', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../v2Adapters')>()),
  creatorToV2: (c: typeof mockCreator) => ({
    id: c.id,
    handle: c.handle,
    name: c.name,
    tagline: c.tagline,
    avatar: c.portrait,
    cover: '',
    city: c.city,
    country: c.country,
    bio: c.bio,
    categories: c.categories,
    score: 85,
    priceTier: '$$',
    priceMin: 500,
    priceMax: 2000,
    verified: c.verified,
    channels: [],
    audience: { female: 60, male: 40, age2534: 35, topCity: c.city },
    rate: 1500,
    pastBrands: [],
  }),
}));

vi.mock('../../useRecentActivity', () => ({
  useRecentActivity: () => [],
}));

// CreatorHome imports RecentActivityCard from BrandHome — stub that too
vi.mock('../BrandHome', () => ({
  RecentActivityCard: () => null,
  BrandHome: () => null,
}));

import { CreatorHome } from '../CreatorHome';

afterEach(() => {
  cleanup();
  CURRENT_CREATOR = mockCreator; // reset to default
});

describe('CreatorHome (smoke)', () => {
  it('renders empty state when no creator + no allCreators fallback', () => {
    CURRENT_CREATOR = null;
    renderWithRouter(<CreatorHome onRoute={() => undefined} />);
    expect(screen.getByText(/No creator profile resolved yet/i)).toBeInTheDocument();
  });

  it('renders the creator first name in the topbar when a creator is linked', () => {
    renderWithRouter(<CreatorHome onRoute={() => undefined} />);
    // Topbar title is `Hi ${firstName}`
    expect(screen.getByText(/^Hi Sarah$/)).toBeInTheDocument();
  });

  it('renders the lifetime earnings number in the hero', () => {
    renderWithRouter(<CreatorHome onRoute={() => undefined} />);
    // Wallet lifetime = $47,800 → fmtUSD renders "$47.8K" or similar
    // Use a flexible matcher — the number could be formatted as "$47.8K"
    // or in a fmtUSDfull variant.
    const dollarMatches = screen.queryAllByText(/\$47/);
    expect(dollarMatches.length).toBeGreaterThan(0);
  });
});
