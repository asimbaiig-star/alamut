// @vitest-environment jsdom
//
// Component smoke test — CampaignDetail.
//
// The most important thing to pin here is the OWNERSHIP GATE that
// shipped in slice 1 (the cross-account leak fix). When a user who is
// NOT the brand owner of the campaign opens this surface, they should
// see an access-denied screen + a "View public brief" CTA — never the
// mutation UI.
//
// Other behaviour we pin (smoke level):
//   - Owner sees the campaign name in the topbar
//   - Tab strip renders with the expected 5 tabs
//   - "Campaign not found" empty state when the id doesn't resolve

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// P64 — Topbar now mounts the real NotificationsBell (uses useNavigate).
function renderWithRouter(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}


const ownerBrand = {
  id: 'b_aesop',
  userId: 'u_hannah',
  name: 'Oakmoss',
  industry: 'Beauty',
  hq: 'Melbourne',
  website: '',
  about: '',
  preferredCategories: [],
  preferredRegions: [],
  walletBalance: 50000,
  escrowHeld: 0,
  verified: true,
  savedCreators: [],
};

const otherBrand = {
  ...ownerBrand,
  id: 'b_lecreuset',
  userId: 'u_marcus',
  name: 'Kettle & Ember',
};

const mockCampaign = {
  id: 'cmp_1',
  brand: 'Oakmoss',
  brandId: 'b_aesop',
  name: 'Spring Renewal',
  status: 'Live',
  placement: '1 Reel + 2 Stories',
  creators: [],
  budget: 12000,
  spent: 0,
  region: 'Global',
  category: 'Beauty',
  deadline: '2026-06-30',
  deliverables: '1 Reel + 2 Stories',
  cover: '',
  brief: '',
  pitch: '',
  rights: undefined,
  outcomePricing: undefined,
  retainer: undefined,
  pricingModel: 'fixed',
  kind: 'one_off',
  shortlist: [],
  acceptedCreators: [],
  applications: [],
  offers: [],
  history: [],
  milestones: [],
  spent_at: undefined,
  reach: 0,
  engagement: 0,
};

// Toggle for ownership tests
let CURRENT_BRAND: typeof ownerBrand | null = ownerBrand;
let HAS_CAMPAIGN = true;

vi.mock('../../v2Hooks', () => ({
  useV2CampaignById: () => HAS_CAMPAIGN ? mockCampaign : null,
  useV2CollabsForCampaign: () => [],
  useV2Creators: () => [],
  useV2CurrentBrand: () => CURRENT_BRAND,
  useV2BrandShortlist: () => [],
  v2AddCampaignAsset: vi.fn(),
  v2RemoveCampaignAsset: vi.fn(),
}));

// What waits on the brand comes from the one shared list (needsYou.ts).
let NEEDS: Array<Record<string, unknown>> = [];
vi.mock('../../needsYou', () => ({
  useBrandNeedsYou: () => NEEDS,
}));

// The open sheet is the home's own component; its behaviour is pinned in
// BrandHome.test.tsx, so here it only has to show which item is on top.
vi.mock('../BrandHome', () => ({
  BrandSheet: ({ item }: { item: { title: string } }) => <p>sheet: {item.title}</p>,
}));

vi.mock('@/lib/api/store', () => ({
  useStore: Object.assign(
    (selector?: (s: { db: Record<string, unknown[]> }) => unknown) => {
      const state = { db: {
        users: [{ id: 'u_hannah', brandId: 'b_aesop' }, { id: 'u_marcus', brandId: 'b_lecreuset' }],
        collaborations: [], notifications: [], transactions: [], reviews: [],
        submissions: [], offers: [], applications: [], deliverables: [],
        // `Database.disputes` is non-optional and the real store always
        // populates it; this hand-listed mock had simply drifted behind the
        // type — the same failure the v2Adapters note below describes.
        disputes: [],
        campaigns: HAS_CAMPAIGN ? [{ id: 'cmp_1', brandId: 'b_aesop', stage: 'live' }] : [],
        brands: [ownerBrand, otherBrand], creators: [],
      } };
      return selector ? selector(state) : state;
    },
    { getState: () => ({ db: {} }) },
  ),
  tx: () => undefined,
}));

// Spread the REAL module rather than hand-listing stages. The previous mock
// enumerated its own stage array that had already drifted from the source (it
// was missing 'live'), which is the same class of bug this suite now guards
// against: stage knowledge must have exactly one definition.
vi.mock('../../v2Adapters', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../v2Adapters')>();
  return { ...actual };
});

vi.mock('../../v2CampaignActions', () => ({
  v2EndCampaign: vi.fn(),
  v2PauseCampaign: vi.fn(),
  v2RejectApplication: vi.fn(),
  v2ResumeCampaign: vi.fn(),
  v2WithdrawOffer: vi.fn(),
  v2AcceptCounter: vi.fn(),
  v2DeclineOffer: vi.fn(),
  v2UpdateCampaign: vi.fn(),
  getApplicationFor: () => undefined,
  getActiveOfferFor: () => undefined,
  getLatestSubmissionFor: () => undefined,
}));

vi.mock('../../v2CollabActions', () => ({
  v2RequestCollabCancel: vi.fn(),
}));

vi.mock('@/lib/permissions', () => ({
  useCapability: () => true,
  requireCapability: () => undefined,
  getActorUserId: () => 'u_hannah',
}));

vi.mock('@/lib/utils/toast', () => ({
  pushToast: vi.fn(),
}));

vi.mock('./WorkflowModals', () => ({
  SendOfferModal: () => null,
  MarkLiveModal: () => null,
  CounterOfferModal: () => null,
  InviteCreatorsModal: () => null,
}));

vi.mock('./ContentReviewModal', () => ({
  ContentReviewModal: () => null,
}));

import { CampaignDetail } from '../CampaignDetail';

afterEach(() => {
  cleanup();
  CURRENT_BRAND = ownerBrand;
  HAS_CAMPAIGN = true;
  NEEDS = [];
});

describe('CampaignDetail (smoke)', () => {
  it('renders the campaign name in the topbar for the owner brand', () => {
    renderWithRouter(<CampaignDetail campaignId="cmp_1" onRoute={() => undefined} />);
    // Campaign name appears in topbar + breadcrumb. At least one match
    // confirms the owner-side render path took (vs the access-denied
    // branch which has no campaign name visible).
    expect(screen.getAllByText(/Spring Renewal/i).length).toBeGreaterThan(0);
  });

  it('OWNERSHIP GATE — refuses access when current brand is NOT the owner', () => {
    CURRENT_BRAND = otherBrand; // viewing as Kettle & Ember, not Oakmoss
    renderWithRouter(<CampaignDetail campaignId="cmp_1" onRoute={() => undefined} />);
    expect(screen.getByText(/don't have access to this campaign's management view/i)).toBeInTheDocument();
    // The "View public brief" fallback CTA must be present.
    expect(screen.getByRole('button', { name: /View public brief/i })).toBeInTheDocument();
  });

  it('OWNERSHIP GATE — "View public brief" routes to the brief view', () => {
    CURRENT_BRAND = otherBrand;
    const onRoute = vi.fn();
    renderWithRouter(<CampaignDetail campaignId="cmp_1" onRoute={onRoute} />);
    fireEvent.click(screen.getByRole('button', { name: /View public brief/i }));
    expect(onRoute).toHaveBeenCalledWith('brief:cmp_1');
  });

  it('OWNERSHIP GATE — refuses when no brand is signed in (currentBrand=null)', () => {
    CURRENT_BRAND = null;
    renderWithRouter(<CampaignDetail campaignId="cmp_1" onRoute={() => undefined} />);
    expect(screen.getByText(/don't have access/i)).toBeInTheDocument();
  });

  it('the pile holds this campaign\'s non-pitch work; pitches go to the table', () => {
    NEEDS = [
      { id: 'n1', kind: 'review', campaignId: 'cmp_1', title: 'Sana sent her Reel for review', creatorName: 'Sana Miller' },
      { id: 'n2', kind: 'pitch', campaignId: 'cmp_1', title: 'Noor Aziz pitched at $900', creatorName: 'Noor Aziz', rate: 900 },
      { id: 'n3', kind: 'review', campaignId: 'cmp_other', title: 'Someone else sent a Story', creatorName: 'Someone' },
    ];
    renderWithRouter(<CampaignDetail campaignId="cmp_1" onRoute={() => undefined} />);
    expect(screen.getByRole('heading', { name: /Needs you/i })).toHaveTextContent('1 on this campaign');
    expect(screen.getByText('sheet: Sana sent her Reel for review')).toBeInTheDocument();
    // Not duplicated in the pile: pitches are compared in the table.
    expect(screen.queryByText(/sheet: Noor Aziz/)).toBeNull();
    expect(screen.queryByText(/Someone else/)).toBeNull();
    // The places-left cell still counts this campaign's pitches.
    expect(screen.getByText('1 pitch waiting')).toBeInTheDocument();
  });

  it('has no needs-you section when nothing waits on this campaign', () => {
    renderWithRouter(<CampaignDetail campaignId="cmp_1" onRoute={() => undefined} />);
    expect(screen.queryByRole('heading', { name: /Needs you/i })).toBeNull();
    expect(screen.getByText('no pitches waiting')).toBeInTheDocument();
  });

  it('tabs follow the tab pattern: one selected, arrow keys move it', () => {
    renderWithRouter(<CampaignDetail campaignId="cmp_1" onRoute={() => undefined} />);
    const tabs = screen.getAllByRole('tab');
    expect(tabs.map((t) => t.textContent)).toEqual(['Creators', 'Content', 'Results', 'Brief', 'Settings']);
    expect(screen.getByRole('tab', { selected: true })).toHaveTextContent('Creators');
    expect(screen.getByRole('tabpanel')).toHaveAttribute('aria-labelledby', 'cd-tab-pipeline');
    fireEvent.keyDown(screen.getByRole('tablist'), { key: 'ArrowRight' });
    expect(screen.getByRole('tab', { selected: true })).toHaveTextContent('Content');
    expect(document.activeElement).toBe(screen.getByRole('tab', { selected: true }));
    fireEvent.keyDown(screen.getByRole('tablist'), { key: 'End' });
    expect(screen.getByRole('tab', { selected: true })).toHaveTextContent('Settings');
    fireEvent.keyDown(screen.getByRole('tablist'), { key: 'ArrowRight' });
    expect(screen.getByRole('tab', { selected: true })).toHaveTextContent('Creators');
  });

  it('renders "not found" state when the campaign id does not resolve', () => {
    HAS_CAMPAIGN = false;
    renderWithRouter(<CampaignDetail campaignId="cmp_missing" onRoute={() => undefined} />);
    expect(screen.getByText(/No campaign with that id/i)).toBeInTheDocument();
  });
});
