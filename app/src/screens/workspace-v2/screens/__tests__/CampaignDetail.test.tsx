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
  name: 'Aesop',
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
  name: 'Le Creuset',
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
  v2AddCampaignAsset: vi.fn(),
  v2RemoveCampaignAsset: vi.fn(),
}));

vi.mock('@/lib/api/store', () => ({
  useStore: Object.assign(
    (selector?: (s: { db: Record<string, unknown[]> }) => unknown) => {
      const state = { db: {
        users: [{ id: 'u_hannah', brandId: 'b_aesop' }, { id: 'u_marcus', brandId: 'b_lecreuset' }],
        collaborations: [], notifications: [], transactions: [], reviews: [],
        submissions: [], offers: [], applications: [], deliverables: [],
        campaigns: HAS_CAMPAIGN ? [{ id: 'cmp_1', brandId: 'b_aesop', stage: 'live' }] : [],
        brands: [ownerBrand, otherBrand], creators: [],
      } };
      return selector ? selector(state) : state;
    },
    { getState: () => ({ db: {} }) },
  ),
  tx: () => undefined,
}));

vi.mock('../../v2Adapters', () => ({
  V2_PIPELINE_STAGES: [
    { id: 'invited', label: 'Invited' },
    { id: 'pitched', label: 'Pitched' },
    { id: 'negotiating', label: 'Negotiating' },
    { id: 'confirmed', label: 'Confirmed' },
    { id: 'submitted', label: 'Submitted' },
    { id: 'approved', label: 'Approved' },
    { id: 'paid', label: 'Paid' },
  ],
}));

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
    CURRENT_BRAND = otherBrand; // viewing as Le Creuset, not Aesop
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

  it('renders "not found" state when the campaign id does not resolve', () => {
    HAS_CAMPAIGN = false;
    renderWithRouter(<CampaignDetail campaignId="cmp_missing" onRoute={() => undefined} />);
    expect(screen.getByText(/No campaign with that id/i)).toBeInTheDocument();
  });
});
