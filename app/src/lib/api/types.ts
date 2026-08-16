// Shared domain types — single source of truth across the app.

export type Role = 'creator' | 'brand' | 'admin';

export interface NotificationPrefs {
  applications: boolean; // creator's pitch landed / decided
  offers: boolean;       // offer received / countered / accepted
  approvals: boolean;    // submission to review / decided
  payouts: boolean;      // money moved
  reviews: boolean;      // review left for you
  team: boolean;         // team invites / actions
  marketing: boolean;    // platform announcements
}

/** P5 §4.1 — brand-side team roles. The capability matrix in
 *  `lib/permissions.ts` maps each role to the set of mutations it can
 *  perform (campaign.create, offer.send, wallet.topup, etc.). The
 *  legacy three-value enum gained `'viewer'` in P5 — read-only access
 *  for stakeholders who shouldn't be able to mutate state but should
 *  be able to see everything. */
export type TeamRole = 'admin' | 'ops' | 'finance' | 'viewer';

/** Phase 15 — Spark draft. A saved campaign-planning session: the
 *  AI message history + the working context (shortlist, budget,
 *  brief). Brand can have any number of drafts and switch between
 *  them; loads replace the active Spark state. `history` and
 *  `context` are stored as opaque JSONB matching the runtime
 *  shapes in `screens/workspace-v2/sparkEngine.ts`. */
export interface SparkDraft {
  id: string;
  brandId: string;
  /** Optional human-readable name. UI defaults to "Untitled draft"
   *  when null and offers an auto-suggest from the first prompt. */
  name?: string;
  /** SparkMessage[] — typed at the call site (sparkEngine.ts) since
   *  this module shouldn't depend on a screen-layer type. */
  history: unknown[];
  /** SparkContext — same reasoning. */
  context: Record<string, unknown>;
  lastEditedAt: string;
  createdAt: string;
}

/** Phase 14 — brand-team invite. Brand owner creates one; invitee
 *  redeems via the secret token. Acceptance attaches the user to
 *  the brand with the named role. */
export interface TeamInvite {
  id: string;
  brandId: string;
  invitedByUserId: string;
  invitedEmail: string;
  role: TeamRole;
  /** Secret URL token — used in the accept-invite path. The brand
   *  shares this with the invitee out-of-band (in the demo, copy
   *  from a modal; production would email via SES/SendGrid). */
  token: string;
  createdAt: string;
  /** ISO timestamp at which the token stops being redeemable. Set
   *  to createdAt + 14 days by `v2SendTeamInvite`. Pre-fix tokens
   *  never expired — a leaked never-accepted token was a forever
   *  liability for the brand owner. The accept path rejects with
   *  reason='expired' once `Date.now() > new Date(expiresAt).getTime()`. */
  expiresAt?: string;
  acceptedAt?: string;
  acceptedByUserId?: string;
  revokedAt?: string;
}

/** P5 §4.2 — platform-admin role split. Pre-P5 a `User.role === 'admin'`
 *  was an all-or-nothing super-admin. P5 lets us assign one or more
 *  specialized admin roles per user so the admin queue can filter tabs
 *  by role (a verification admin doesn't need to see disputes). The
 *  `'super'` role is the pre-P5 catchall — has every capability. */
export type AdminRole =
  | 'super'         // catchall — pre-P5 admins migrate to this
  | 'verification'  // brand/creator verification queue
  | 'disputes'      // dispute resolution
  | 'finance'       // platform-level payouts/refunds (different from brand-side `finance`)
  | 'support';      // read-only for support cases

/** P5 §4.1 — capability names used throughout the mutation + UI gating
 *  layer. Each capability is a string union member; the matrix that
 *  maps `TeamRole`/`AdminRole` → capabilities lives in
 *  `lib/permissions.ts`. Naming convention: `<entity>.<action>`. */
export type Capability =
  // Campaign lifecycle
  | 'campaign.create'
  | 'campaign.update'
  | 'campaign.end'
  | 'campaign.pause'
  // Applications + offers
  | 'application.decide'
  | 'application.invite'
  | 'offer.send'
  | 'offer.withdraw'
  | 'offer.counter'
  // Content review
  | 'content.submit'
  | 'content.approve'
  | 'content.revise'
  | 'content.markLive'
  | 'content.setPermalink'
  // Wallet / money
  | 'wallet.topup'
  | 'wallet.withdraw'
  // Team management
  | 'team.manage'
  // Disputes
  | 'dispute.raise'
  | 'dispute.resolve'
  // Reviews
  | 'review.write'
  | 'review.moderate'
  // Admin-only categories
  | 'admin.verify'
  | 'admin.payout'
  // Generic read
  | 'viewer.read';

export interface Availability {
  status: 'open' | 'limited' | 'booked';
  untilDate?: string;  // ISO date — when availability resumes
  note?: string;       // optional explanation visible to brands
  /** Vacation mode. ENFORCED: `v2SendOffer` and `v2InviteCreator` refuse
   *  while it is on, and the offer modal disables its send button with the
   *  reason. Distinct from `booked` because vacation implies "not even
   *  monitoring" rather than "fully scheduled" — and `booked` only warns. */
  vacationMode?: boolean;
  /** Minimum acceptable rate in USD. ADVISORY BY DESIGN, not by omission: a
   *  floor is a negotiating position, and blocking below it would kill
   *  legitimate opening offers that get countered up. Surfaces a warning to
   *  the brand and as "From $X" on the public storefront. */
  minRate?: number;
  /** Categories the creator never wants briefs in. ENFORCED — the mutation
   *  throws and the send button is disabled. It previously did nothing at
   *  all despite the name, so a creator who excluded Gambling still received
   *  gambling offers. See lib/api/availability.ts for why this blocks while
   *  `minRate` warns. */
  autoDeclineCategories?: string[];
}

export type UserStatus =
  | 'pending_verification'   // signed up but email not confirmed
  | 'active'                 // confirmed, full access
  | 'pending_admin_review'   // creator app submitted, awaiting admin
  | 'suspended';

export interface User {
  id: string;
  email: string;
  // Mock-only: plaintext password. Real backend would hash. We're explicit it's mock.
  passwordHash: string;
  role: Role;
  status: UserStatus;
  createdAt: string;
  // Profile pointers (one of these will be set per role)
  creatorId?: string;
  brandId?: string;
  // Mock magic-link token (single-use)
  pendingMagicLink?: { token: string; issuedAt: string };
  // Per-user notification preferences. If undefined, treat as all true.
  notificationPrefs?: NotificationPrefs;
  // Brand-side team membership: when more than one user shares a brandId, they're a team.
  teamRole?: TeamRole; // for users on a brand team
  invitedAt?: string;  // for invited team members

  // Manager / agent — a User who acts on behalf of one or more creators.
  managesCreatorIds?: string[];

  /** P5 §4.2 — when `role === 'admin'`, this lists which specialized
   *  admin roles the user holds (a single user can wear multiple hats).
   *  Migrator 8 stamps `['super']` on every legacy admin who has no
   *  explicit list. Empty arrays / missing field default to `['super']`
   *  in `lib/permissions.ts` so existing flows don't break. */
  adminRoles?: AdminRole[];
}

// Income advance — Stripe-Capital-style. Creator borrows against pending escrow,
// repays automatically as those payouts clear.
export interface Advance {
  id: string;
  creatorId: string;
  requestedAt: string;
  amount: number;          // disbursed to creator wallet
  feePct: number;          // platform fee, e.g. 0.03 for 3%
  feeAmount: number;       // amount * feePct
  collateralPending: number; // pending balance at request time
  status: 'active' | 'repaid' | 'defaulted';
  repaidAt?: string;
  repaidAmount: number;
}

export interface AudienceDemographics {
  ageBuckets: { '13-17'?: number; '18-24': number; '25-34': number; '35-44': number; '45-54': number; '55+': number }; // 0..1
  genderSplit: { female: number; male: number; other: number };  // 0..1
  topCountries: { country: string; pct: number }[];               // top 5
  growthRate30d: number;        // % e.g., 4.2 for +4.2%
  suspiciousFollowerPct: number; // 0..100, lower is better
  audienceCredibilityScore: number; // 0..100, higher is better
}

export interface Platform {
  name: 'Instagram' | 'YouTube' | 'TikTok' | 'Newsletter' | 'X' | 'LinkedIn' | 'Substack';
  handle: string;
  followers: number;
  engagement: number; // pct
  verified: boolean;
  audience?: AudienceDemographics;
}

export type CreatorTier = 'Rising' | 'Specialist' | 'Flagship';

export type RateFormat = 'post' | 'reel' | 'story' | 'longform' | 'bundle';
export type RateCardPlatform = Platform['name'] | 'All platforms';
export interface RateCardEntry {
  id: string;
  platform: RateCardPlatform;
  format: RateFormat;
  rate: string;       // free-form, e.g. "$800–1,500"
  notes?: string;     // useful for bundles
}

export interface Creator {
  id: string;
  userId: string;
  name: string;
  handle: string;
  tagline: string;
  bio: string;
  /** Optional banner image URL — added in workspace-v2 storefront editing.
   *  When unset, the v2 adapter generates a deterministic Unsplash URL from
   *  the creator id so existing seed records still get a usable cover. */
  cover?: string;
  city: string;
  country: string;
  languages: string[];
  categories: string[];
  portrait: string;
  work: string[];
  platforms: Platform[];
  reach: number;          // sum followers
  engagement: number;     // avg %
  rating: number;         // 0–5
  tier: CreatorTier;
  responseHrs: number;
  // Legacy single rate card. Kept as fallback when rateCards[] is empty.
  rateCard: { post: string; reel: string; story: string; longform: string };
  // Per-platform rate cards. Preferred; rendered in storefront and drawers when present.
  rateCards?: RateCardEntry[];
  payout: { method: string; account: string; currency: string };
  walletBalance: number;  // creator's available payout balance
  pendingBalance: number; // in escrow on their behalf
  lifetimeEarnings: number;
  verified: boolean;
  /** P7 — last successful KYC / tax-form verification timestamp (ISO).
   *  Used by the scheduler's `kyc-expired` trigger: when the timestamp
   *  is more than 365 days old AND the creator has pending payouts,
   *  `v2ApproveContent` enqueues a `kyc-expired` reminder. `undefined`
   *  means "never verified" — the trigger doesn't fire (no need to
   *  remind a creator who hasn't gone through KYC yet; the onboarding
   *  flow nudges them separately). Set by the future KycTax submission
   *  flow; demo seed leaves this empty so triggers don't fire by default. */
  kycVerifiedAt?: string;
  /** P6 §5.6 — DEPRECATED. Pre-P6 this was a stored 0–100 number that
   *  drifted from reality (creator updates a field, the stored number
   *  doesn't recompute). Migrator 9 deletes the field; consumers
   *  compute on read via `computeProfileCompletion(creator, db)` from
   *  `lib/utils/profile-completion.ts`. The field stays optional on
   *  the type for one phase of transition compatibility — readers
   *  must use the helper. */
  profileCompletion?: number; // DEPRECATED — use computeProfileCompletion()
  pressMentions: { source: string; title: string; year: number }[];
  pastClients: string[];
  availability?: Availability;
  editorsPick?: boolean;
  /** Review IDs the creator has pinned to the top of their public storefront.
   *  When set, PublicCreator renders these first (in this order) before
   *  filling the rest with the chronological tail. Added in workspace-v2
   *  storefront editor (session 18). */
  featuredReviewIds?: string[];
  /** Campaign IDs the creator has bookmarked from Browse campaigns
   *  (creator-side equivalent of `Brand.savedCreators`). Toggled by
   *  the save chip on the editorial CampaignTile. */
  savedBriefs?: string[];

  // Tier 4+: managed-by-an-agent. When set, the creator's account is operated
  // by a separate User who has role='creator' and managesCreatorIds[] including this id.
  managedByUserId?: string;
  /** Phase 50 — tax form on file (W-9 for US, W-8BEN for international).
   *  Captured via the TaxFormModal in KycTax; consumed by the KYC step
   *  state machine + year-end 1099 generation (latter TODO). */
  taxForm?: TaxFormRecord;
  /** When the creator accepted the Creator Agreement, and which version.
   *  Before this existed, the KYC checklist marked the agreement step
   *  "Signed via first accepted offer" — inferring a signature from an
   *  unrelated event, for a document that did not exist. A signature is
   *  now a fact we record or it hasn't happened. */
  agreementAcceptedAt?: string;
  agreementVersion?: string;
  /** Migration 021 optimistic lock — see Dispute.version for the rationale.
   *  Creator-profile edits and wallet/pending balance updates flow through this lock. */
  version?: number;
  /** ───────────────────────────────────────────────────────────────────
   *  Storefront-pulse demo metrics. In production these come from a real
   *  view-tracking pipeline (analytics events on the public storefront
   *  page + inbound-inquiry rows on the brand outreach table). Until
   *  that pipeline exists, these fields are seeded per-creator so the
   *  CreatorHome StorefrontPulse + brand-viewers strip render real
   *  numbers (just sourced from the seed rather than a literal in JSX).
   *  Demo creators (Sarah, Areeba) get healthy numbers so a recorded
   *  demo looks alive; other seeded creators get varied values.
   *  ─────────────────────────────────────────────────────────────────── */
  /** Public storefront views over the trailing 30 days. */
  storefrontViewsLast30d?: number;
  /** % change in storefront views vs the prior 30d period. Negative if down. */
  storefrontViewsDeltaPct?: number;
  /** Inbound brand inquiries (cold outreach, invites, briefs DM'd) this week. */
  brandInquiriesThisWeek?: number;
  /** New inquiries this week vs last week (raw count, signed). */
  brandInquiriesDelta?: number;
  /** Brand display names that recently viewed the creator's storefront
   *  — surfaced on the CreatorHome viewers strip. Most-recent first.
   *  Stored as strings (not Brand FKs) because the viewer strip is
   *  purely a display affordance and most viewers will be brands NOT
   *  in our own catalog (we'd just be tracking pageviews by org). */
  recentBrandViewerNames?: string[];
  /** Total distinct viewers over the trailing 30d. Used by the viewers
   *  strip "+ N more" tail when `recentBrandViewerNames` is truncated. */
  recentBrandViewerCount?: number;
}

export interface TaxFormRecord {
  kind: 'W-9' | 'W-8BEN';
  legalName: string;
  /** US tax classification (W-9 only). */
  classification?: 'individual' | 'sole-proprietor' | 'llc' | 'corporation';
  /** Last 4 of SSN or full EIN (US). We never want to handle full SSNs
   *  in a prototype; production needs pgsodium / dedicated PII vault. */
  taxIdLast4?: string;
  /** Country of tax residence (W-8BEN). */
  country?: string;
  /** Foreign tax ID number (W-8BEN). */
  foreignTaxId?: string;
  address: string;
  /** Typed signature — the user types their legal name to attest. */
  signature: string;
  signedAt: string;
}

// Lightweight brand-side social presence. No audience demographics — brands don't typically
// have IG/YT insights, just a public-facing handle and a follower count.
export interface BrandSocial {
  name: Platform['name'];
  handle: string;
  url?: string;
  followers: number;
  verified: boolean;
}

export interface Brand {
  id: string;
  userId: string;
  name: string;
  industry: string;
  hq: string;
  website: string;
  about: string;
  logoMark?: string;
  /** Optional uploaded logo image as a data URL (base64-encoded PNG/JPEG).
   *  Stored inline so the entirely-client-side demo persists across
   *  reloads via localStorage. The brand-profile editor downscales to
   *  256×256 before encoding so the payload stays small (~30–60 KB).
   *  When present, every brand-mark surface should render the image
   *  instead of the `logoMark` letter glyph. */
  logoUrl?: string;
  preferredCategories: string[];
  preferredRegions: string[];
  walletBalance: number;     // available, cleared
  escrowHeld: number;        // currently in escrow across campaigns
  verified: boolean;
  savedCreators: string[];   // brand-level shortlist (creator IDs saved for later)
  socialPlatforms?: BrandSocial[];
  /** Phase 50 — saved offer templates per brand. Prefabs the brand can
   *  pick from in SendOfferModal instead of retyping rate + message
   *  per offer. Stored on the brand row (local-only for the prototype;
   *  migrating to a dedicated `offer_templates` table later is straight-
   *  forward — same pattern as `sparkDrafts`). */
  offerTemplates?: OfferTemplate[];
  /** Phase 58 — onboarding-captured matching hints. The brand sets these
   *  during the BrandOnboardingV2 wizard (creator-tier price-band
   *  preference + rough monthly budget). Discover + Spark consume them
   *  to rank creators that fit the brand's size profile. Pre-fix the
   *  wizard captured both fields then dropped them on submit.
   *  Tier uses the price-band glyph the wizard renders, matching the
   *  V2Creator.priceTier shape so filters can compare directly. */
  preferredCreatorTier?: '$' | '$$' | '$$$' | '$$$$';
  monthlyBudgetBand?: string;
  /** Migration 021 optimistic lock — see Dispute.version for the rationale.
   *  Brand-profile edits and wallet balance updates flow through this lock. */
  version?: number;
}

export interface OfferTemplate {
  id: string;
  name: string;
  rate: number;
  message: string;
  /** Optional deliverable hint shown alongside the template name. */
  deliverables?: string;
  createdAt: string;
}

// P1b §1.2 — Campaign stage represents the campaign's own lifecycle, NOT
// its collabs' progress. Per-collab state (pitched / negotiating /
// confirmed / submitted / approved / live / paid) lives on the
// Collaboration entity (P1c), not here. Pre-P1b this enum carried 8
// values that were derived from "highest stage any collab has reached"
// — that was a bug factory. Now the enum is a clean lifecycle.
export type CampaignStage =
  | 'draft'   // brand authoring; not visible to creators
  | 'live'    // accepting applications + active work
  | 'paused'  // brand temporarily suspended; reversible via v2ResumeCampaign
  | 'closed'; // ended; final state

export const STAGES: { id: CampaignStage; label: string; tone: 'neutral' | 'live' | 'work' | 'good' | 'gray' }[] = [
  { id: 'draft',  label: 'Draft',  tone: 'gray' },
  { id: 'live',   label: 'Live',   tone: 'live' },
  { id: 'paused', label: 'Paused', tone: 'work' },
  { id: 'closed', label: 'Closed', tone: 'neutral' },
];

export interface CampaignMilestone {
  id: string;
  /** Which event in the collab lifecycle triggers this payout milestone.
   *  P1b §1.2 separated this from `Campaign.stage` (which is now just the
   *  campaign's own lifecycle). These trigger names are collab-level
   *  events; P1c will tighten the type to `CollabStage` once that exists. */
  stage: 'offer' | 'posted' | 'reporting' | 'closed';
  amount: number;         // payout amount when this milestone clears
  releasedAt?: string;
  description: string;
}

// Content rights granted to the brand. Wider rights → higher rate.
export interface ContentRights {
  exclusivity: 'none' | '30d' | '60d' | '90d';   // creator can't work with competitors during window
  whitelistAds: boolean;          // brand can run paid ads on creator's handle
  repurpose: 'none' | '90d' | '180d' | '365d' | 'perpetual'; // brand can re-use content elsewhere
  derivative: boolean;            // brand can edit/cut/remix the content
  organicOnly: boolean;           // creator's organic post only — no whitelisting/ads
}

// Per-accepted-creator tracking metrics for a campaign. Mocked numbers but
// the structure is real; real backend would back this with a click router.
export interface CampaignTracking {
  creatorId: string;
  trackingUrl: string;            // utm-tagged short link
  clicks: number;
  conversions: number;
  revenueAttributed: number;      // mock $ attributed via UTM-tagged purchases
}

// Whitelisted-ad boost on a creator's posted content. Brand pays platform
// for paid amplification, post stays on the creator's handle.
export interface AdBoost {
  id: string;
  creatorId: string;
  startedAt: string;
  durationDays: number;
  dailyBudget: number;     // USD/day
  totalSpent: number;      // mock — auto-incremented over time
  addedClicks: number;     // mock
  addedConversions: number;
  addedRevenue: number;
  status: 'running' | 'completed' | 'paused';
}

// Recurring retainer config — only set when Campaign.kind === 'retainer'
export interface RetainerConfig {
  monthlyRate: number;             // total $ spent per month across all creators
  termMonths: number;              // 6, 12, etc.
  deliverablesPerMonth: string;    // "2 Reels + 4 stories"
  startedAt?: string;              // ISO when the engagement started
  monthsCompleted: number;         // 0..termMonths
}

export type CampaignKind = 'one_off' | 'retainer';

// Pricing model — fixed (per-deliverable rate) or outcome-based (paid per conversion).
// Outcome-based campaigns still hold a base floor in escrow, plus a per-conversion bonus
// up to a cap. Real backend would meter conversions via Stripe webhooks; here we mock from tracking.
export type PricingModel = 'fixed' | 'outcome';
export interface OutcomePricing {
  baseFloor: number;        // guaranteed minimum per accepted creator
  perConversion: number;    // $ per attributed conversion
  capPerCreator: number;    // total cap per creator
}

// Trust tier — derived from completed campaigns + reviews + verification.
// Bronze:  < 3 completed campaigns
// Silver:  3–9 completed, avg rating >= 4.2
// Gold:    10+ completed, avg rating >= 4.6, verified
export type TrustTier = 'bronze' | 'silver' | 'gold';

// =====================================================================
// Dispute (P2 §1.4)
// =====================================================================
//
// Pre-P2 the Dispute was tied to a campaign + counterparty user, with a
// flat status/reason enum and an inline resolution. P2 retargets it to
// the Collaboration (1:1 with the per-pair work) and grows the shape:
// evidence attachments, an internal message log, an `in-review` admin
// state, partial-resolution amounts, and `updatedAt` for sort/filter.
//
// Field renames (migrator 5 handles):
//   openedByUserId → raisedByUserId
//   openedAt: string → raisedAt: number
//   reason → category   (enum values renamed; see DisputeCategory)
//   details → description
//   status (enum collapse — see DisputeStatus)
//   resolution.at: string → at: number
//   resolution.byUserId → resolution.by
//   resolution.releasedToCreator/refundedToBrand → releaseAmount/refundAmount
//
// `againstUserId` is gone — derived from the Collaboration (the other
// party of the brand-creator pair).

/** P2 §1.4 — broader category set than the pre-P2 reason enum.
 *  Migrator 5 maps old → new (creator_no_show → non-delivery,
 *  content_quality → quality, rights_violation → content-takedown, etc.). */
export type DisputeCategory =
  | 'non-delivery'      // (was: creator_no_show)
  | 'quality'           // (was: content_quality, brand_no_approval)
  | 'scope-creep'       // new in P2
  | 'late-payment'      // (was: payment_issue)
  | 'content-takedown'  // (was: rights_violation)
  | 'other';

/** P2 §1.4 — five-state lifecycle plus withdraw. `in-review` is the
 *  admin-picked-up state between `open` and resolution. The three
 *  resolution variants split out the money path explicitly:
 *  refund (full → brand), release (full → creator), partial (split). */
export type DisputeStatus =
  | 'open'
  | 'in-review'
  | 'resolved-refund'
  | 'resolved-release'
  | 'resolved-partial'
  | 'withdrawn';

export interface DisputeMessage {
  at: number;
  userId: string;
  body: string;
}

export interface DisputeEvidence {
  url: string;
  label: string;
}

export interface Dispute {
  /** ID format: 'dsp_<short>' for net-new rows; pre-existing seed ids
   *  ('disp_seed_1') stay stable through migration. */
  id: string;
  /** P2 §1.4 — the dispute is anchored on the Collaboration, not the
   *  campaign. Migrator 5 derives this from `(campaignId, raised-by-or-against)`. */
  collaborationId: string;
  /** P1c carry-through — kept on the type so legacy admin queue / metrics
   *  can group disputes by campaign without joining through Collaboration. */
  campaignId: string;
  raisedByUserId: string;
  raisedByRole: 'brand' | 'creator';
  category: DisputeCategory;
  description: string;
  evidence: DisputeEvidence[];
  status: DisputeStatus;
  resolution: {
    by: string;                  // admin user id
    at: number;
    note: string;
    refundAmount?: number;       // $ moved brand→wallet
    releaseAmount?: number;      // $ moved brand→creator (net of fees)
  } | null;
  raisedAt: number;
  updatedAt: number;
  messages: DisputeMessage[];
  /** WORKFLOW-GAPS F3 — a split the PARTIES proposed to each other, to settle
   *  without waiting for an arbitrator. Distinct from `resolution`, which is
   *  the outcome: this is an offer that has not been accepted yet, and is
   *  cleared to null on agree, decline, or withdrawal.
   *
   *  Agreement by the other party resolves the dispute and moves the money
   *  through exactly the same path an admin resolution uses — the parties get
   *  a faster route to the same place, not a second implementation of it. */
  proposal?: SettlementTerms | null;
  /** Migration 020 optimistic lock — server row version. Bumped on
   *  every UPDATE; mirror functions pass the prior version as
   *  `expectedVersion` so a cross-tab race lands a StaleVersionError
   *  instead of silently overwriting. Optional on the type so legacy
   *  / generated rows without a server counterpart still type-check. */
  version?: number;
}

// =====================================================================
// Contract (P2 §1.3) — immutable agreement snapshot
// =====================================================================
//
// Pre-P2 there was no first-class agreement record — the "agreement"
// was implicit in the Offer's accepted state plus the live campaign
// brief. Editing the brief retroactively changed what every accepted
// creator was bound to, which is broken: brands could quietly tighten
// scope after acceptance.
//
// P2 makes Contract the explicit, frozen snapshot of what the creator
// agreed to. Created in the same `tx` as `Offer.status='accepted'`
// (v2AcceptOffer + v2AcceptCounter). Append-only — only `status`,
// `fulfilledAt`, `cancelledAt` ever mutate after creation.

export interface ContractDeliverableSnapshot {
  /** FK back to the live `Deliverable` row at acceptance time. The row
   *  itself may later be deleted/changed; this snapshot does not. */
  deliverableId: string;
  index: number;
  platform: DeliverablePlatform;
  format: DeliverableFormat;
  quantity: number;
  dueOffsetDays: number | null;
  specs: string | null;
}

export interface Contract {
  /** ID format: 'ctr_<short>' for net-new; 'ctr_<collabId>' for
   *  migrator-materialized rows (stable across re-migrations). */
  id: string;
  collaborationId: string;
  campaignId: string;
  creatorId: string;
  brandId: string;
  /** Locked at acceptance. Mirrors Collaboration.agreedRate but lives
   *  on Contract too so the audit trail is self-contained. */
  agreedRate: number;
  netToCreator: number;          // rate * (1 - PLATFORM_FEE - WHT)
  platformFee: number;           // rate * 0.10
  withholdingTax: number;        // rate * 0.05
  /** Snapshot of the campaign's structured Deliverable rows at the
   *  moment of acceptance. Editing the campaign's deliverables later
   *  does NOT change this. */
  deliverables: ContractDeliverableSnapshot[];
  /** Snapshot of `Campaign.brief` text at acceptance. Same protection
   *  as `deliverables` — brand editing the brief later does not change
   *  what this creator signed. */
  briefSnapshot: string;
  briefSnapshotAt: number;
  acceptedAt: number;
  /** The user who accepted the offer (creator side for offers,
   *  brand side for counter-acceptance). */
  acceptedByUserId: string;
  status: 'active' | 'fulfilled' | 'cancelled';
  fulfilledAt: number | null;
  cancelledAt: number | null;
}

export interface Campaign {
  id: string;
  brandId: string;
  title: string;
  pitch: string;
  brief: string;          // long-form description
  cover: string;
  budget: number;
  spent: number;          // total released
  escrowHeld: number;     // sitting in escrow
  region: string;
  /** Primary category. Kept as a single value for every existing consumer;
   *  `categories` below carries the brand's full multi-select. */
  category: string;
  /**
   * Targeting the brand entered in the wizard.
   *
   * These four were collected across three wizard steps, echoed back on the
   * "Review & launch" screen as the brand's final confirmation, and then
   * dropped on the floor — `Campaign` had nowhere to put them, so
   * `v2LaunchCampaign` read `categories[0]` and ignored the rest entirely.
   * The step's own copy told the brand Spark would use them to filter
   * creators by audience overlap.
   *
   * Optional so existing rows and migrations are unaffected. Persisting them
   * is the honest floor: the brand's input is kept and shown, rather than
   * confirmed and discarded. Auto-filtering on them is a separate piece of
   * work — until it lands, the wizard says they're recorded on the brief.
   */
  objective?: string;
  audienceGender?: string;
  audienceAge?: string[];
  categories?: string[];
  /** The wizard's structured placement rows, kept so a saved draft reopens
   *  exactly as it was authored. `deliverablesText` is the flattened display
   *  string and `db.deliverables` the materialized rows; neither round-trips
   *  back into the editor cleanly. */
  placements?: { platform: string; format: string; count: number }[];
  stage: CampaignStage;
  /** P1d §1.5/§1.6 — free-form display string ("1 Reel + 3 Stories on Instagram").
   *  Pre-P1d this was named `deliverables`. Migrator 4 renames it and parses
   *  it once into structured `Deliverable` rows; runtime code prefers reading
   *  `db.deliverables.filter(d => d.campaignId === camp.id)` for any per-row
   *  state (status, submissions, etc.). `deliverablesText` is kept around
   *  for brief cards / read-only displays where the original phrasing is
   *  what the brand wrote. */
  deliverablesText: string;
  /** P1d §1.5 — FK list to `Deliverable` rows in `db.deliverables`. Materialized
   *  by migrator 4 from `deliverablesText` on first run; populated directly
   *  by `v2LaunchCampaign` for new campaigns. Order is stable; the array's
   *  index matches the Deliverable's `index` field for stable rendering. */
  deliverableIds: string[];
  deadline: string;       // ISO date or "Tomorrow" etc. for friendly mode
  postedAt?: string;
  reach?: number;
  engagement?: number;
  createdAt: string;
  // Lifecycle history
  history: { stage: CampaignStage; at: string; by: string }[];
  milestones: CampaignMilestone[];
  // Linked creators by their campaign relationship.
  // Note: `shortlist` and `acceptedCreators` were removed in P1a — both
  // were duplicate state derivable from `Application.status === 'shortlisted'`
  // and `Offer.status === 'accepted'` respectively. Use the helpers in
  // `@/lib/api/relations.ts` (`getShortlistedCreators`, `getAcceptedCreators`)
  // instead.
  applications: string[];  // application IDs
  offers: string[];        // offer IDs

  // Tier-1 additions
  rights?: ContentRights;
  tracking?: CampaignTracking[];

  // Tier-2 additions
  kind?: CampaignKind;          // defaults to 'one_off' when undefined
  retainer?: RetainerConfig;    // present iff kind === 'retainer'
  boosts?: AdBoost[];           // whitelisted ad boosts on the campaign's content

  // Polish
  editorsPick?: boolean;        // featured on Discover

  // Tier 3
  pricingModel?: PricingModel;          // defaults to 'fixed'
  outcomePricing?: OutcomePricing;      // present iff pricingModel === 'outcome'

  /** P3 §2.4 — when set, applications whose category-overlap score (creator
   *  primary categories ∩ campaign category) ≥ `threshold` are auto-shortlisted
   *  on submit. `null` (the default) keeps the manual review flow. */
  autoShortlist?: { enabled: boolean; threshold: number } | null;

  /** Phase 13 — brand-uploaded brief assets (PDFs, mood-board images,
   *  reference videos). Stored as a jsonb array on the campaign for
   *  demo simplicity — separate table not justified at this scale. */
  assets?: CampaignAsset[];
  /** Phase 58 — brand-side archive flag. Orthogonal to `stage`: a
   *  closed campaign can still be unarchived and revisited; archive
   *  just hides the row from the default Campaigns list to declutter
   *  long histories. ISO timestamp when archived. Toggle via
   *  v2ArchiveCampaign / v2UnarchiveCampaign. */
  archivedAt?: string;
  /** Migration 020 optimistic lock — see Dispute.version for the rationale. */
  version?: number;
}

/** A single brand-uploaded asset attached to a campaign brief. */
export interface CampaignAsset {
  id: string;
  name: string;
  url: string;
  /** File size in bytes — formatted at render time. */
  sizeBytes: number;
  /** MIME type from the browser at upload time. Empty when unknown. */
  mimeType: string;
  /** ISO timestamp of upload. */
  uploadedAt: string;
  /** User id who uploaded — used for audit / future per-asset
   *  permissions; not displayed in the demo UI. */
  uploadedByUserId?: string;
}

// =====================================================================
// Outreach (P6 §5.3) — brand-side soft contact before an offer
// =====================================================================
//
// Pre-P6 the Spark `send` intent fired `v2SendOffer({ source:
// 'spark-recommendation' })`, which created a real Offer with a rate.
// That's wrong: a brand reaching out from a Spark recommendation
// hasn't agreed on a rate yet — they want to start a conversation.
// Pre-P6 we worked around this by treating spark-sourced offers as
// "soft" in the UI; that's lossy and confused brand-side analytics.
//
// P6 introduces `Outreach` as a first-class entity. The brand sends a
// message to the creator without committing to a rate; the creator
// can reply, decline, or archive. If the conversation progresses, the
// brand sends a real Offer at that point.

export type OutreachStatus =
  | 'sent'      // brand sent the outreach, creator hasn't responded
  | 'replied'   // creator engaged (replied in thread or accepted to talk)
  | 'declined'  // creator declined (not interested)
  | 'archived'; // brand archived the lead

export interface Outreach {
  /** ID format: 'out_<short>' */
  id: string;
  /** Optional — outreach may or may not be tied to a specific campaign.
   *  When `null`, the brand is feeling out a creator before launching. */
  campaignId: string | null;
  brandId: string;
  creatorId: string;
  /** The user (on the brand team) who sent the outreach. */
  sentByUserId: string;
  message: string;
  status: OutreachStatus;
  sentAt: string;
  respondedAt?: string;
  /** Optional sidecar — when the outreach later turns into an offer,
   *  the FK is set so the audit trail joins cleanly. */
  resultingOfferId?: string;
}

// 'accepted' exists because a brand could not previously say yes to a pitch.
// The only forward move was to send a fresh Offer that the creator then had
// to accept — two extra round trips to agree on terms both sides had already
// agreed on, and an asymmetry with the brand-initiated path, which costs the
// creator a single action. `v2AcceptPitch` sets it and creates the accepted
// offer in one step.
export type ApplicationStatus =
  | 'submitted'
  | 'shortlisted'
  | 'accepted'
  | 'rejected'
  | 'withdrawn';

export interface Application {
  id: string;
  campaignId: string;
  creatorId: string;
  pitch: string;
  proposedRate?: number;
  status: ApplicationStatus;
  submittedAt: string;
  decidedAt?: string;
  /** P1c §1.1 — backfilled by migrator 3 + every mutation via ensureCollabState. */
  collaborationId?: string;
  /** Migration 020 optimistic lock — see Dispute.version for the rationale. */
  version?: number;
}

// =====================================================================
// Deliverable (P1d §1.5 / §1.6) — structured replacement for the
// free-form `Campaign.deliverables` string + `[slot:N]` notes encoding.
// =====================================================================
//
// Pre-P1d the campaign's deliverables lived as a single free-form string
// ("1 Reel + 3 Stories on Instagram"). The adapter ran `parseDeliverableSlots`
// on every render to expand it into N slot rows, and submissions were
// routed to the right slot via a `[slot:N]` prefix in `Submission.notes`
// that the adapter re-parsed each time. Three problems:
//   1. Re-parsing on every render is wasted work.
//   2. The string format had no contract — "3 Reels" parsed differently
//      from "Reels x3" from "(3 reels)" — and the parser was lossy on
//      anything it didn't recognize.
//   3. Brand-side editing the deliverables string didn't change in-flight
//      collabs' deliverables (which is correct), but the model had no way
//      to express "this submission belongs to deliverable #2 of 3" — only
//      to a slot index inside the parsed expansion.
//
// P1d makes Deliverable a stored entity. Each row is a single deliverable
// (quantity is always 1 — "3 Stories" expands to 3 rows, each with `index`
// 0/1/2). The brand's free-form string is preserved as `Campaign.deliverablesText`
// for read-only display. Migrator 4 runs the parser once and writes rows.
// `v2LaunchCampaign` will eventually accept structured input from the
// rebuilt wizard step 3 and write the rows directly — until then it
// continues to write the text and lets migrator-4-equivalent code expand
// it (the seed-side helper `materializeDeliverables` mirrors that logic).

export type DeliverablePlatform =
  | 'instagram'
  | 'tiktok'
  | 'youtube'
  | 'linkedin'
  | 'newsletter'
  | 'podcast'
  | 'x';

export type DeliverableFormat =
  | 'reel'      // short-form vertical (Instagram Reel, TikTok native)
  | 'story'     // 24-hour ephemeral
  | 'post'      // permanent feed post
  | 'longform'  // long-form (YouTube long, LinkedIn article)
  | 'short'     // YouTube Short
  | 'episode'   // podcast / video podcast episode
  | 'thread'    // X / Twitter thread
  | 'carousel'  // multi-image post
  | 'live';     // live broadcast

export interface Deliverable {
  /** ID format: 'del_<short>' for net-new rows; 'del_<campaignId>_<index>'
   *  for migrator-materialized rows so re-running the migrator on the
   *  same data produces stable IDs. */
  id: string;
  campaignId: string;
  /** 0-based, stable. Matches the position in `Campaign.deliverableIds`. */
  index: number;
  platform: DeliverablePlatform;
  format: DeliverableFormat;
  /** Always 1 in the new model — "3 stories" expands to 3 rows. Kept on
   *  the type for forward-compat with bulk-quantity authoring (P5 retainer
   *  templates) and to keep the parser's expansion explicit. */
  quantity: number;
  /** Days from contract acceptance. `null` = use campaign-level deadline. */
  dueOffsetDays: number | null;
  /** Free-text per-deliverable spec ("9:16, 30s, hook in first 3s"). */
  specs: string | null;
}

export type OfferStatus =
  | 'pending'
  | 'accepted'
  | 'declined'
  | 'withdrawn'
  | 'countered'
  | 'expired';   // P3 §2.1 — counter cap exceeded (4th counter attempt)

/** P1b §1.7 — provenance of an Offer. Lets the audit log answer
 *  "why was this offer sent?" without ambiguity. */
export type OfferSource =
  | 'application'           // creator pitched first; brand then sent the offer
  | 'cold-outreach'         // no prior application; brand initiated
  | 'invite'                // creator was invited via NewCampaignWizard step 4 / v2InviteCreator (P1c)
  | 'spark-recommendation'; // Spark `send` intent emitted the offer

/** P3 §2.1 — one entry in an Offer's negotiation transcript.
 *  Round 0 is always the brand's initial send; round 1 is typically the
 *  creator's counter; round 2 the brand's counter-counter; etc. Cap at
 *  `MAX_OFFER_ROUNDS` (4 = 1 initial + 3 counters). The 4th counter
 *  throws and the offer flips to `expired`. */
export interface OfferRound {
  by: 'brand' | 'creator';
  at: number;
  rate: number;
  message: string | null;
}

export interface Offer {
  id: string;
  campaignId: string;
  creatorId: string;
  /** Mirrors the latest agreed rate. While `status === 'pending'` this is
   *  the brand's initial offer rate; once a counter is accepted it's
   *  overwritten to the accepted round's rate. Source of truth for the
   *  full negotiation transcript is `rounds[]`. */
  rate: number;
  /** Mirrors the latest message — same provenance as `rate`. */
  message: string;
  status: OfferStatus;
  sentAt: string;
  respondedAt?: string;
  /** P3 §2.1 — full negotiation transcript. Pre-P3 the model carried a
   *  single `counter?: { rate, message, at }` field which lost the
   *  history if a counter was further countered. Migrator 6 expands the
   *  legacy `counter` into a 2-entry `rounds[]` array. New mutations
   *  (`v2CounterOffer`, `v2CounterCounter`) push to this array. The
   *  consumer reads `rounds[rounds.length - 1]` for "current state of
   *  the negotiation" and the full array for the audit trail. */
  rounds: OfferRound[];
  // P1b §1.7 — provenance.
  // - applicationId: link to the Application this offer responds to. `null`
  //   when source !== 'application'. Lets us join offer → application
  //   without time-window heuristics.
  // - source: how the offer was initiated. Backfilled by migrator 2.
  applicationId: string | null;
  source: OfferSource;
  /** P1c §1.1 — backfilled by migrator 3 + every mutation via ensureCollabState. */
  collaborationId?: string;
  /** Migration 020 optimistic lock — see Dispute.version for the rationale. */
  version?: number;
}

// 'rejected' exists because the brand had no middle option. After the
// 3-revision cap their choices were approve work they didn't want, or open a
// dispute — an adversarial move for what is often just "this isn't right and
// we're done trying". Rejecting closes the deliverable unfulfilled; it
// deliberately moves NO money, because a one-sided refund on the brand's say-so
// is exactly what disputes exist to arbitrate.
export type SubmissionStatus = 'in_review' | 'revisions' | 'approved' | 'rejected';

export interface Submission {
  id: string;
  campaignId: string;
  creatorId: string;
  /** Per-deliverable round counter. Computed at submit time as
   *  "submissions for the same `deliverableId` already in db + 1". Pre-P1d
   *  this was scoped via the `[slot:N]` prefix in `notes`; post-P1d it's
   *  scoped via `deliverableId`. The brief recommends dropping this field
   *  entirely and computing on read — that's deferred to a later cleanup
   *  pass since 5+ surfaces still display "Round N" (Analytics, DealRoom,
   *  trust score, adapter labels). Keeping it stored for now. */
  round: number;
  /** Submitted files. `url` is a data URL for inline-stored uploads
   *  (≤25MB) or a Supabase Storage URL once we wire that path. `mime`
   *  + `size` are optional metadata that the brand-side review modal
   *  uses to pick the right preview (image / video / pdf / download). */
  files: { name: string; url: string; mime?: string; size?: number }[];
  notes: string;
  status: SubmissionStatus;
  submittedAt: string;
  feedback: { from: string; text: string; at: string }[];
  /** Public-facing URL of the live post once it's published. Either the
   *  brand sets this via Mark Live (advances stage to reporting) or the
   *  creator sets it themselves via the deliverable inline editor (data
   *  only — no stage change). MarkLiveModal pre-fills from this when
   *  set so the brand doesn't retype what the creator already pasted. */
  permalink?: string;
  /** Set when the brand reports the live post is no longer reachable.
   *
   *  Liveness used to be INFERRED from `permalink` being present, which made
   *  "the post is down" unrepresentable: clearing the link lost the record of
   *  what was posted, and keeping it meant the deliverable still claimed to be
   *  live. Recording the takedown separately lets both facts coexist. */
  postDownAt?: string;
  /** P1c §1.1 — backfilled by migrator 3; eventually required (P2). */
  collaborationId?: string;
  /** P1d §1.5 — FK to the `Deliverable` row this submission fulfils.
   *  Pre-P1d this lived as a `[slot:N]` prefix in `notes` that the adapters
   *  parsed at runtime. Migrator 4 walks the prefix → deliverable mapping
   *  for every existing submission, sets this field, and strips the prefix
   *  from `notes`. Optional during the transition phase (a stray submission
   *  with no FK falls back to the campaign's first Deliverable in the
   *  adapter); `v2SubmitContent` always sets it explicitly post-P1d. */
  deliverableId?: string;
  /** P2 §1.4 — when this submission is approved, set to
   *  `nowMs() + 7 * 86400_000`. After that timestamp the Raise Dispute
   *  CTA on the corresponding Collaboration is no longer eligible —
   *  brand and creator have a 7-day window post-approval to flag
   *  problems before escrow auto-locks. Always undefined for
   *  `in_review` / `revisions` submissions. */
  disputeWindowClosesAt?: number;
  /** Migration 020 optimistic lock — see Dispute.version for the rationale. */
  version?: number;
}

export interface Thread {
  id: string;
  participants: string[]; // user IDs
  campaignId?: string;
  subject: string;
  lastMessageAt: string;
  unreadFor: string[];    // user IDs with unread
  /** P1b §1.9 — placeholder. Set to `null` for every existing thread by
   *  migrator 2. P1c migrator 3 promotes threads to point at their
   *  Collaboration once that entity is materialized. After P1c, a thread
   *  with `collaborationId !== null` shows the collab side panel; a
   *  thread with `null` is a pre-collab DM (e.g. brand pinged from
   *  Discover before any application). */
  collaborationId: string | null;
  // ===== Phase 11 (inbox moderation) =====
  /** User IDs who've muted this thread — notifications are suppressed
   *  for them but the thread still shows in their inbox list. */
  mutedFor?: string[];
  /** User IDs who've archived this thread. Filters the thread out of
   *  the default inbox view; new messages from peers clear the sender
   *  from non-sender participants' archived_for, pulling it back in. */
  archivedFor?: string[];
  /** When the last report was filed against this thread. */
  reportedAt?: number;
  /** User who filed the last report. */
  reportedByUserId?: string;
  /** Free-text reason captured at report time. */
  reportedReason?: string;
  /** Phase 56 — moderation outcome fields. When an admin takes action
   *  on a reported thread (rather than dismissing the report), they
   *  write a short note and the thread is marked suspended. The
   *  Inbox surface should hide / read-only-render a suspended thread
   *  (future work; the flag is the prerequisite). Dismiss = report
   *  cleared, no audit trail. Action taken = these fields set. */
  suspended?: boolean;
  actionTakenAt?: number;
  actionTakenByUserId?: string;
  actionNote?: string;
  /** Phase 58 — snooze. When a participant snoozes a thread it falls
   *  out of the default inbox view until `snoozedUntilMs` passes; new
   *  messages from the counterparty clear the sender's snooze (peers
   *  expect to surface). Stored per-user via `snoozedFor[userId]`. */
  snoozedFor?: Record<string, number>;
}

export interface MessageAttachment {
  name: string;
  url: string;
}

export interface Message {
  id: string;
  threadId: string;
  fromUserId: string;
  text: string;
  at: string;
  attachments?: MessageAttachment[];
}

/**
 * Reported performance for one campaign.
 *
 * Replaces `derivePerf`, which invented these numbers at render time from
 * follower counts (`impressions = reach × 1.4`, a hardcoded engagement rate,
 * a fixed weekly decay curve, `EMV = impressions/1000 × $50`) and presented
 * them to every user as measurements, complete with week-over-week deltas.
 * Nothing in the product measures any of it — there are no platform APIs.
 *
 * Now performance is DATA, not a formula. A campaign either has a row here
 * or it doesn't, and a surface either has numbers to show or says it's
 * waiting on connected channels. No code path can conjure a figure.
 *
 * Seeded demo campaigns carry authored rows with `sample: true` so the
 * product still demonstrates what it looks like fully populated — that story
 * matters, and hand-authored numbers tell it better than an arithmetic
 * accident. Surfaces label those rows as sample data.
 */
export interface CampaignPerformance {
  campaignId: string;
  /** True = authored demo data, not measured. Surfaces MUST label it. */
  sample: boolean;
  impressions: number;
  reach: number;
  engagement: number;
  saves: number;
  shares: number;
  profileVisits: number;
  /** Engagement per week since launch, oldest first. */
  weeklySeries: number[];
  /** Per-creator contribution, for the performance leaderboard. Pre-fix
   *  those rows were derived from the ASCII character codes of the
   *  creator's id, which ranked real named people by how their primary key
   *  happened to spell. */
  byCreator: { creatorId: string; impressions: number; engagement: number }[];
  updatedAt: string;
}

export type TxKind = 'topup' | 'escrow_hold' | 'escrow_release' | 'payout' | 'refund' | 'fee' | 'ad_spend' | 'referral_bonus';
export type TxStatus = 'cleared' | 'pending' | 'failed';

export interface Transaction {
  id: string;
  at: string;
  userId: string;        // owner of the wallet
  kind: TxKind;
  amount: number;        // positive = inflow, negative = outflow (from this user's perspective)
  status: TxStatus;
  campaignId?: string;
  counterpartyUserId?: string;
  note: string;
}

export interface Notification {
  id: string;
  userId: string;
  text: string;
  href?: string;
  at: string;
  read: boolean;
  // Optional related-entity ids so the bell can render quick actions inline
  meta?: {
    offerId?: string;
    submissionId?: string;
    applicationId?: string;
    campaignId?: string;
    reviewId?: string;
    // P1c §1.1 — Collaboration is a first-class entity; some notifications
    // (cold invites, cancellations, etc.) anchor on the Collaboration row
    // rather than on a child app/offer/submission.
    collaborationId?: string;
  };
}

// Creator-to-creator referrals. When a referred creator completes a campaign
// for a brand the referrer has worked with, referrer earns a bonus.
export type ReferralStatus = 'invited' | 'active' | 'expired' | 'bonus_paid';

export interface Referral {
  id: string;
  fromCreatorId: string;       // referrer
  toCreatorId: string;         // referred
  noteToReferred: string;
  recommendedBrandId?: string; // optional: a specific brand they recommend
  createdAt: string;
  status: ReferralStatus;
  bonusEarned?: number;        // mock $; populated when status === 'bonus_paid'
  bonusPaidAt?: string;
}

// Reviews left by either side after a campaign closes.
// reviewType='creator' means brand reviewed the creator; targetId = creator.id
// reviewType='brand'   means creator reviewed the brand;   targetId = brand.id
export interface Review {
  id: string;
  campaignId: string;
  fromUserId: string;
  reviewType: 'creator' | 'brand';
  targetId: string;
  rating: number;   // 1–5
  text: string;
  at: string;
  // Optional public response from the reviewed party.
  response?: { text: string; at: string };
  // ===== P4 §3.2 — Review moderation =====
  /** User IDs who flagged this review for admin attention. Each entry is
   *  a user who clicked Report; the admin queue surfaces reviews where
   *  `reportedBy.length > 0`. Migrator 7 defaults this to `[]`. */
  reportedBy?: string[];
  /** Admin-set flag. When `true` the review is filtered out of every
   *  public storefront read path (PublicCreator, PublicStorefront,
   *  Storefront.tsx, useFeaturedReviews) but stays in the table for
   *  audit. The reviewed party's average rating recomputes accordingly. */
  hidden?: boolean;
  /** Free-text reason captured at hide time (admin's note). */
  hiddenReason?: string;
  /** Numeric ms timestamp when the review was hidden. */
  hiddenAt?: number;
}

// =====================================================================
// ScheduledNotification (P4 §3.1) — time-based notification engine
// =====================================================================
//
// Some notifications fire on a clock, not on a user action: 24h-before
// deadline, overdue follow-up, 30/60/90-day stale-escrow check, dispute-
// window-closing, KYC-expiry. Pre-P4 the codebase only had push-on-action
// notifications (`db.notifications.push(...)` from inside a mutation tx).
//
// P4 adds a queue: mutations that establish a future event (offer accept
// → 24h before deliverable due) push a `ScheduledNotification` with a
// `triggerAt` timestamp. A scheduler heartbeat (hydration + interval)
// processes the queue: any row with `!emitted && triggerAt <= now`
// produces a real Notification and flips the row's `emitted = true`.
//
// Idempotency: the `emitted` flag is the only mutation-on-replay; the
// trigger row itself is never deleted (audit trail). Re-running the
// heartbeat is a no-op once everything pending is emitted.

export type ScheduledNotificationType =
  | 'deadline-24h'           // creator: deliverable due in <24h, not submitted
  | 'deadline-overdue'       // both: deliverable past due, not submitted
  | 'escrow-stale-30d'       // both: collab confirmed for 30+ days, no submission
  | 'review-window-closing'  // brand: approved >5 days, dispute window closes in 48h
  | 'kyc-expired';           // creator: KYC last verified >365 days, has pending payouts

export interface ScheduledNotification {
  /** ID format: 'sched_<short>' for net-new; deterministic
   *  `sched_<type>_<entityId>_<sequence>` for system-enqueued rows so
   *  re-running the enqueue path is idempotent. */
  id: string;
  type: ScheduledNotificationType;
  /** Numeric ms timestamp at which this notification should fire. */
  triggerAt: number;
  /** User ID to notify. Some types fan out (deadline-overdue → both
   *  brand + creator) by enqueuing two rows with the same `entityId`
   *  and sequence so they deduplicate independently. */
  recipientUserId: string;
  /** FKs the trigger ties to. The text/href is built at emit time off
   *  these so we don't snapshot stale strings. */
  campaignId?: string;
  collaborationId?: string;
  submissionId?: string;
  deliverableId?: string;
  /** Once flipped to `true` the heartbeat skips this row. The flag is
   *  the only field that mutates after creation. */
  emitted: boolean;
  /** Numeric ms timestamp when `emitted` was flipped. */
  emittedAt?: number;
  /** When was this row enqueued? Useful for the audit trail. */
  enqueuedAt: number;
  /** Optional sequence index for fan-out triggers (e.g. overdue follows-up:
   *  daily for 3 days → 3 rows with sequence 0, 1, 2). */
  sequence?: number;
}

// Public-page testimonials (Phase 48 · landing rewrite). Each quote
// names a real campaign in the seed so claims are verifiable end-to-
// end. shownTo controls which audience sees the quote on the landing
// page (creator-side voices proof to brands; brand-side voices proof
// to creators).
export interface Testimonial {
  id: string;
  shownTo: 'brand' | 'creator';
  quote: string;
  authorName: string;
  /** "@handle" for creators · "Role, Company" for brand-side speakers. */
  authorSubtitle: string;
  /** Portrait URL — typically a creator's portrait or a brand-contact stock. */
  authorPortrait: string;
  /** Links to a Campaign.id that exists in this seed. */
  campaignId: string;
}

// Toplevel store shape
export interface Database {
  users: User[];
  creators: Creator[];
  brands: Brand[];
  campaigns: Campaign[];
  applications: Application[];
  offers: Offer[];
  submissions: Submission[];
  threads: Thread[];
  messages: Message[];
  transactions: Transaction[];
  notifications: Notification[];
  reviews: Review[];
  disputes: Dispute[];
  referrals: Referral[];
  advances: Advance[];
  testimonials: Testimonial[];
  /** Reported campaign performance. See `CampaignPerformance`. Empty for
   *  every real campaign until platform APIs exist — that emptiness is the
   *  honest state and the surfaces render it as such. */
  campaignPerformance: CampaignPerformance[];
  /** P1c §1.1 — Collaboration is the first-class brand-creator-campaign
   *  relationship. Pre-P1c this was derived on every read via
   *  `deriveCollab(campaignId, creatorId, db)` which made stage the
   *  derived projection of (Application.status, Offer.status, Submission.status,
   *  payout transactions). Now stored directly so subsequent phases
   *  (P2 Contract, P2 Dispute, P3 cancel-collab, P4 scheduled notifs) can
   *  reference it by id. Each row materialized once by migrator 3 and
   *  kept in sync via _ensureCollabState helper called from every
   *  state-transitioning mutation. */
  collaborations: Collaboration[];
  /** P1d §1.5 — structured deliverable rows. One row per individual
   *  deliverable; "3 stories" is 3 rows with `index` 0/1/2 and `quantity: 1`.
   *  Migrator 4 materializes from `Campaign.deliverablesText` on first run.
   *  `Submission.deliverableId` FKs into this table. */
  deliverables: Deliverable[];
  /** P2 §1.3 — immutable agreement snapshot, one per accepted Offer.
   *  Created in the same `tx` as `Offer.status='accepted'` (v2AcceptOffer +
   *  v2AcceptCounter). Migrator 5 backfills one Contract per existing
   *  Collaboration whose stage indicates an accepted offer. Append-only
   *  except for `status`, `fulfilledAt`, `cancelledAt`. */
  contracts: Contract[];
  /** P4 §3.1 — time-based notification queue. Mutations that establish
   *  a future event push rows here with a `triggerAt` timestamp; the
   *  scheduler heartbeat processes any non-emitted row whose
   *  `triggerAt <= now`. Append-only except the `emitted` + `emittedAt`
   *  fields on each row (which the heartbeat flips once). */
  scheduledNotifications: ScheduledNotification[];
  /** P6 §5.3 — brand-side soft outreach before any offer is sent. */
  outreach: Outreach[];
  /** Phase 14 — brand team invites. Brand owner creates rows; invitee
   *  redeems via token URL to join the team with the specified role. */
  teamInvites?: TeamInvite[];
  /** Phase 15 — brand-side Spark planning sessions. One row per saved
   *  draft; brand picks one from the Drafts rail to resume work. */
  sparkDrafts?: SparkDraft[];
  /** Forward-only data-migration version. Bumps with each migration phase
   *  (see `lib/api/migrations.ts`). Hydration runs every migrator from
   *  `version + 1 → CURRENT_MIGRATION_VERSION`. Distinct from Zustand's
   *  persist-middleware `version` which gates schema-shape blow-aways. */
  migrationVersion?: number;
}

// =====================================================================
// Collaboration — P1c §1.1
// =====================================================================

/** The 9-stage collab lifecycle. Matches the kanban columns. Each
 *  stage maps 1:1 to a derivable signal from apps/offers/subs/transactions
 *  pre-P1c. Post-P1c, the stage is stored on Collaboration directly. */
export type CollabStage =
  | 'invited'      // brand-side cold invite (v2InviteCreator); creator hasn't responded
  | 'pitched'      // creator applied (Application.status='submitted')
  | 'negotiating'  // offer or counter on the table (Offer.status='pending'|'countered')
  | 'confirmed'    // offer accepted, escrow held, no submission yet
  | 'submitted'    // creator submitted content for review
  | 'approved'     // brand approved, not yet posted
  | 'live'         // content live (Mark Live confirmed)
  | 'paid'         // funds released to creator wallet
  | 'cancelled';   // any cancellation path (withdraw / decline / reject / collab-cancel)

export interface CollabHistoryEntry {
  at: number;
  from: CollabStage | null;  // null for the creation entry
  to: CollabStage;
  actorUserId: string;
  reason?: string;  // 'campaign-ended', 'creator-withdrew', 'offer-declined', etc.
}

/**
 * A proposed split of held escrow, awaiting the OTHER party's agreement.
 *
 * Cancellation is all-or-nothing: escrow returns to the brand. That is wrong
 * when a creator delivered 3 of 4 slots — the work exists and someone has to
 * be paid for it. A settlement splits the held amount instead.
 *
 * Only `releaseToCreator` is stored, never the refund: the refund is whatever
 * is left, and holding both numbers invites them to disagree.
 *
 * ONE shape, deliberately, for the two places parties negotiate a split:
 *   - `Collaboration.settlementProposal` — WORKFLOW-GAPS F1, outside a dispute.
 *   - `Dispute.proposal` — WORKFLOW-GAPS F3, settling one without an arbitrator.
 * They differ in what agreement DOES (ends the deal vs. resolves the dispute),
 * not in what is being proposed, so the terms are shared and the outcomes are
 * not.
 */
export interface SettlementTerms {
  /** User id of the proposer. They may not agree to their own proposal. */
  by: string;
  at: number;
  /** GROSS to release to the creator; the remainder refunds to the brand. */
  releaseToCreator: number;
  note: string;
}

export interface Collaboration {
  id: string;                      // 'col_<short>'
  campaignId: string;
  creatorId: string;
  brandId: string;                 // denormalized for brand-side queries
  stage: CollabStage;
  createdAt: number;               // earliest event timestamp
  updatedAt: number;               // bumped on every stage transition
  agreedRate: number | null;       // set on offer accept; locked thereafter
  acceptedOfferId: string | null;  // FK to Offer
  contractId: string | null;       // FK to Contract — populated by P2
  cancelledAt: number | null;
  cancellationReason: string | null;
  history: CollabHistoryEntry[];
  // P3 §2.3 — populated when either party requests cancellation post-confirmation:
  cancellationRequest?: { by: string; at: number; reason: string } | null;
  /** WORKFLOW-GAPS F1 — a proposed partial settlement, awaiting the OTHER
   *  party's agreement. See {@link SettlementTerms}. */
  settlementProposal?: SettlementTerms | null;
  // P2 §1.4 — escrow freeze flag for active disputes:
  escrowFrozen?: boolean;
  /** Migration 020 optimistic lock — see Dispute.version for the rationale.
   *  Bumped on every successful UPDATE to Postgres. Used by the
   *  collabSync mirror to gate UPDATEs on `version = expectedVersion`
   *  so cross-tab races land a typed StaleVersionError instead of
   *  silently overwriting. The repo's writeCollabInSupabase falls back
   *  to INSERT when no version is known (first-write path). */
  version?: number;
}

export interface Session {
  userId: string;
  issuedAt: string;
}
