// Shared test fixtures (Phase 31).
//
// Minimal builders for the entity types the deal-page redesign reads.
// Each builder accepts a partial override so tests can name the fields
// that matter and let everything else default to "valid but boring".
//
// We don't use the real seed.ts data because:
//   1. It's huge (~1500 lines) and pulls in dates/relations we don't
//      want to think about per-test.
//   2. Tests should declare their own scenarios — relying on incidental
//      seed details makes failures hard to diagnose.

import type {
  Application,
  Brand,
  Campaign,
  CampaignStage,
  ContentRights,
  Creator,
  Database,
  Dispute,
  Message,
  Offer,
  OfferStatus,
  Submission,
  Thread,
  Transaction,
  User,
} from '@/lib/api/types';

const DEFAULT_RIGHTS: ContentRights = {
  exclusivity: 'none',
  whitelistAds: false,
  repurpose: 'none',
  derivative: false,
  organicOnly: false,
};

let nextId = 1;
const id = (prefix: string) => `${prefix}_${nextId++}`;

/** Reset the auto-id counter. Call from beforeEach to keep ids stable
 *  across tests within one file. */
export function resetIds() {
  nextId = 1;
}

export function buildCampaign(p: Partial<Campaign> = {}): Campaign {
  return {
    id: p.id ?? id('cmp'),
    brandId: p.brandId ?? 'br_1',
    title: 'Spring Renewal',
    pitch: 'A focused beauty drop',
    brief: 'Long-form brief',
    cover: 'https://example.com/cover.jpg',
    budget: 5000,
    spent: 0,
    escrowHeld: 0,
    region: 'Global',
    category: 'Beauty',
    stage: 'live' as CampaignStage,
    // P1d §1.5 — `deliverablesText` is the free-form display string;
    // structured rows live in `db.deliverables` and are addressed via
    // `deliverableIds` (left empty here so tests opt in explicitly).
    deliverablesText: '1 Reel + 2 stories',
    deliverableIds: [],
    deadline: '2026-06-30',
    createdAt: '2026-04-01T00:00:00.000Z',
    history: [],
    milestones: [],
    applications: [],
    offers: [],
    rights: DEFAULT_RIGHTS,
    ...p,
  };
}

export function buildBrand(p: Partial<Brand> = {}): Brand {
  return {
    id: p.id ?? 'br_1',
    userId: 'u_brand',
    name: 'Aesop',
    industry: 'Beauty',
    hq: 'NYC',
    website: 'https://example.com',
    about: 'About',
    preferredCategories: ['Beauty'],
    preferredRegions: ['Global'],
    walletBalance: 10000,
    escrowHeld: 0,
    verified: true,
    savedCreators: [],
    ...p,
  };
}

export function buildCreator(p: Partial<Creator> = {}): Creator {
  return {
    id: p.id ?? 'cr_1',
    userId: 'u_creator',
    name: 'Sarah Chen',
    handle: '@sarah',
    tagline: 'Beauty + minimal living',
    bio: 'Bio',
    city: 'NYC',
    country: 'US',
    languages: ['English'],
    categories: ['Beauty'],
    portrait: 'https://example.com/sarah.jpg',
    work: [],
    platforms: [],
    reach: 100_000,
    engagement: 4.2,
    rating: 4.5,
    tier: 'Specialist',
    responseHrs: 6,
    rateCard: { post: '$500', reel: '$1500', story: '$300', longform: '$3000' },
    payout: { method: 'wise', account: '••', currency: 'USD' },
    walletBalance: 0,
    pendingBalance: 0,
    lifetimeEarnings: 0,
    verified: true,
    // P6 §5.6 — profileCompletion is now computed via
    // `computeProfileCompletion(creator, db)`. The field stays
    // optional on the type for one phase of compat; tests that pin
    // the value can still pass it through `p`. Default omitted.
    pressMentions: [],
    pastClients: [],
    ...p,
  };
}

export function buildUser(p: Partial<User> = {}): User {
  return {
    id: p.id ?? 'u_1',
    email: 'user@example.com',
    passwordHash: 'demo',
    role: 'creator',
    status: 'active',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...p,
  };
}

export function buildApplication(p: Partial<Application> = {}): Application {
  return {
    id: p.id ?? id('app'),
    campaignId: 'cmp_1',
    creatorId: 'cr_1',
    pitch: 'Pitch text',
    status: 'submitted',
    submittedAt: '2026-04-05T00:00:00.000Z',
    ...p,
  };
}

export function buildOffer(p: Partial<Offer> = {}): Offer {
  // P3 §2.1 — `rounds[]` carries the negotiation transcript; the
  // fixture seeds it with the brand's initial round to mirror the
  // real shape produced by `v2SendOffer`. Tests that exercise counter
  // flows pass a fuller `rounds` array via `p`.
  const sentAt = '2026-04-10T00:00:00.000Z';
  const rate = p.rate ?? 1500;
  const message = p.message ?? 'Excited to work together';
  return {
    id: p.id ?? id('off'),
    campaignId: 'cmp_1',
    creatorId: 'cr_1',
    rate,
    message,
    status: 'pending' as OfferStatus,
    sentAt,
    // P1b §1.7 — fixture defaults to cold-outreach so callers don't need
    // to wire an Application.
    applicationId: null,
    source: 'cold-outreach',
    rounds: [
      { by: 'brand', at: +new Date(sentAt), rate, message },
    ],
    ...p,
  };
}

export function buildSubmission(p: Partial<Submission> = {}): Submission {
  return {
    id: p.id ?? id('sub'),
    campaignId: 'cmp_1',
    creatorId: 'cr_1',
    round: 1,
    files: [{ name: 'reel.mp4', url: 'https://example.com/reel.mp4' }],
    notes: 'First draft',
    status: 'in_review',
    submittedAt: '2026-04-15T00:00:00.000Z',
    feedback: [],
    ...p,
  };
}

export function buildDispute(p: Partial<Dispute> = {}): Dispute {
  // P2 §1.4 — new field shape. `collaborationId` anchors the dispute on
  // the per-pair work, not the campaign. Tests can override any field
  // via `p`; the defaults give a minimal "open / brand-raised" scenario.
  return {
    id: p.id ?? id('disp'),
    collaborationId: 'col_test',
    campaignId: 'cmp_1',
    raisedByUserId: 'u_brand',
    raisedByRole: 'brand',
    category: 'non-delivery',
    description: 'Creator missed the deadline.',
    evidence: [],
    status: 'open',
    resolution: null,
    raisedAt: 1745107200000, // 2026-04-20
    updatedAt: 1745107200000,
    messages: [],
    ...p,
  };
}

export function buildThread(p: Partial<Thread> = {}): Thread {
  return {
    id: p.id ?? id('th'),
    participants: ['u_brand', 'u_creator'],
    campaignId: 'cmp_1',
    subject: 'Spring Renewal · Aesop · Sarah Chen',
    lastMessageAt: '2026-04-12T00:00:00.000Z',
    unreadFor: [],
    // P1b §1.9 — placeholder; tests can override.
    collaborationId: null,
    ...p,
  };
}

export function buildMessage(p: Partial<Message> = {}): Message {
  return {
    id: p.id ?? id('msg'),
    threadId: 'th_1',
    fromUserId: 'u_creator',
    text: 'Hello',
    at: '2026-04-12T00:00:00.000Z',
    ...p,
  };
}

export function buildTransaction(p: Partial<Transaction> = {}): Transaction {
  return {
    id: p.id ?? id('tx'),
    userId: 'u_creator',
    counterpartyUserId: 'u_brand',
    campaignId: 'cmp_1',
    kind: 'payout',
    amount: 750,
    status: 'cleared',
    at: '2026-04-22T00:00:00.000Z',
    note: '',
    ...p,
  };
}

/** Build a Database with the rows you specify; everything else defaults
 *  to empty arrays. Matches the production Database shape exactly. */
export function buildDb(parts: Partial<Database> = {}): Database {
  return {
    users: [],
    creators: [],
    brands: [],
    campaigns: [],
    applications: [],
    offers: [],
    submissions: [],
    threads: [],
    messages: [],
    transactions: [],
    notifications: [],
    reviews: [],
    disputes: [],
    referrals: [],
    advances: [],
    testimonials: [],
    campaignPerformance: [],
    // (collaborations + deliverables + contracts defaults follow below)
    // P1c §1.1 — Collaboration is a stored entity. Tests that exercise
    // collab-stage transitions can pass `collaborations: [...]` in `parts`;
    // the buildDb default keeps it empty so tests opt in explicitly.
    collaborations: [],
    // P1d §1.5 — structured deliverables. Tests that exercise per-slot
    // submission state pass `deliverables: [...]` in `parts`.
    deliverables: [],
    // P2 §1.3 — Contracts table. Tests that exercise the post-acceptance
    // path pass `contracts: [...]` in `parts`.
    contracts: [],
    // P4 §3.1 — Scheduled notification queue. Tests opt in via `parts`.
    scheduledNotifications: [],
    // P6 §5.3 — brand-side outreach.
    outreach: [],
    ...parts,
  };
}
