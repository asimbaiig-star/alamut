// data.ts — Type definitions for workspace-v2 surfaces
//
// Originally hosted Pakistan-first sample arrays (creators, campaigns,
// conversations, wallet ledgers) for the visual prototype. After
// Phase B wired v2 to the real Zustand store and Phase D cleaned up
// the leftovers, only the type definitions remain — the arrays are
// gone, and v2 surfaces consume `useV2*` hooks from `v2Hooks.ts`
// instead. Mappers in `v2Adapters.ts` derive these shapes from the
// existing domain types (Creator, Campaign, Thread, Transaction).
//
// If you need new sample data for testing, extend the seed
// (`src/lib/api/seed.ts`) so it shows up live across all surfaces
// rather than re-introducing a parallel sample fixture here.

export interface V2Channel {
  platform: 'instagram' | 'tiktok' | 'youtube' | 'linkedin' | 'x' | 'newsletter';
  handle: string;
  followers: number;
  engagement: number;
}

export interface V2Audience {
  female: number;
  male: number;
  age2534: number;
  age1824?: number;
  age3544?: number;
  topCity: string;
}

export interface V2Creator {
  id: string;
  handle: string;
  name: string;
  /** Short tagline under the name on storefront / public preview. */
  tagline?: string;
  avatar: string;
  cover: string;
  city: string;
  /** Country (passed through from raw Creator) — used by PublicStorefront. */
  country?: string;
  bio: string;
  /** Full categories list (no slice). Consumers truncate as needed. */
  categories: string[];
  /** Review rating rescaled to 0-100, or null when the creator has no
   *  reviews yet. NOT a fit score — see matching.ts. */
  score: number | null;
  /** True when this is seeded demo data (nobody real owns it). Demo accounts
   *  are pre-verified for the showcase (see seed.ts), so the surfaces that
   *  show verification or trust signals must label them — otherwise a demo
   *  creator silently outranks a real one on evidence they didn't earn. */
  isDemo?: boolean;
  priceTier: '$' | '$$' | '$$$' | '$$$$';
  priceMin: number;
  priceMax: number;
  verified: boolean;
  channels: V2Channel[];
  audience: V2Audience;
  rate: number;
  /** Full past-brands list (no slice). Consumers truncate as needed. */
  pastBrands: string[];
  /** Work portfolio — image URLs, public storefront "Recent work" grid. */
  work?: string[];
  /** Press & mentions — public storefront editorial credibility section. */
  pressMentions?: { source: string; title: string; year: number }[];
  /** Review IDs the creator has pinned to the top of the public storefront. */
  featuredReviewIds?: string[];
  /** Availability + guardrails — passed through from underlying Creator
   *  so SendOfferModal, kanban tooltips, and Discover can warn brands
   *  about vacation mode or below-floor rates (s18). */
  availability?: {
    status: 'open' | 'limited' | 'booked';
    untilDate?: string;
    note?: string;
    vacationMode?: boolean;
    minRate?: number;
    autoDeclineCategories?: string[];
  };
}

export interface V2Campaign {
  id: string;
  name: string;
  brand: string;
  /** P1b §1.2 — mirrors the post-collapse `Campaign.stage` enum.
   *  'Active' was dropped (it conflated with per-collab progress);
   *  'Paused' added for the dedicated paused state. */
  status: 'Live' | 'Paused' | 'Planned' | 'Completed';
  budget: number;
  spent: number;
  confirmed: number;
  live: number;
  submitted: number;
  paid: number;
  creators: string[];
  placement: string;
  deadline: string;
  brief: string;
  /** Brief category — passed through from underlying Campaign. Used by
   *  BriefDetail to surface auto-decline warnings when a creator has
   *  this category in their availability filters (s18). */
  category?: string;
  /** ISO timestamp from the underlying Campaign. Used by Campaigns and
   *  BrowseBriefs to sort newest-first so freshly-created campaigns
   *  appear at the top of the list rather than the bottom. */
  createdAt: string;
  /** Mirrors `Brand.verified` for the underlying brand. Drives the
   *  "Verified · pays in 3 days" badge on the editorial CampaignTile
   *  so it's data-driven instead of a hardcoded string. */
  brandVerified: boolean;
  /** F19 — true when the posting brand is seeded demo data (nobody real
   *  owns it), so surfaces can label the brief instead of letting a real
   *  creator apply to a brand that will never reply. */
  brandIsDemo?: boolean;
  /** Mirrors `Brand.logoUrl`. When set, the CampaignTile letterhead
   *  band renders the uploaded image instead of the brand-initial
   *  glyph so brand uploads propagate to every creator surface. */
  brandLogoUrl?: string;
  /** Mirrors `Campaign.escrowHeld` (PKR/USD held against the brand
   *  wallet for in-flight collabs). Drives the "● Escrow funded"
   *  indicator on the CampaignTile — green dot when > 0, muted when
   *  unfunded so creators see the difference at a glance. */
  escrowHeld: number;
  /** Phase 13 — brand-uploaded brief assets. Passed through from the
   *  underlying Campaign so CampaignDetail's Brief tab can render the
   *  real list instead of a hardcoded placeholder set. */
  assets?: import('@/lib/api/types').CampaignAsset[];
}

export interface V2Conversation {
  id: string;
  creatorId: string;
  /** Brand party in the thread. Populated alongside creatorId so the
   *  Inbox can resolve the counterparty from EITHER perspective
   *  (brand views the creator; creator views the brand). Empty string
   *  when the brand can't be resolved — defensive fallback so reads
   *  in older call sites don't crash. */
  brandId: string;
  campaignId: string;
  unread: number;
  lastAt: string;
  preview: string;
  messages: { from: 'brand' | 'creator'; text: string; time: string; attachments?: { name: string; url: string }[] }[];
  /** Phase 11 — viewer's mute/archive state on this thread. Computed
   *  by threadToV2 against the requesting `viewerUserId`. */
  isMutedForViewer?: boolean;
  isArchivedForViewer?: boolean;
}

export interface V2WalletLedgerEntry {
  date: string;
  desc: string;
  amount: number;
  type?: 'topup' | 'release' | 'fee' | 'tax' | 'reserve';
  status: string;
  gross?: number;
  fee?: number;
}

// =====================================================================
// Campaign management types (Phase A.10b — campaign workflow per design v2)
// =====================================================================
//
// `V2CollabStage` = the 8-stage pipeline a creator-x-campaign relationship
// progresses through. Derived in v2Adapters from the existing schema:
//   Application / Offer / Submission state combine into a single stage.
//
// `V2Deliverable` represents a piece of content the creator owes for the
// brief — Reel, Stories, Long-form, etc. Each carries its own status that
// is independent of the parent collab stage.

// `invited` and `pitched` are mutually exclusive ENTRY paths, not sequential
// steps — brand-initiated vs creator-initiated — and they converge at
// `negotiating`. `invited` is the fallback the state machine returns when a
// collab row exists but no application and no offer do
// (`lib/api/collabSync.ts` → computeCollabStage). Anything that renders these
// as a linear progression is flattening a branching graph.
export type V2CollabStage =
  | 'invited'      // brand invited, creator hasn't responded
  | 'pitched'      // creator applied / sent a pitch
  | 'negotiating'  // offer or counter on the table
  | 'confirmed'    // offer accepted, work hasn't started
  | 'submitted'    // creator submitted content for review
  | 'approved'     // brand approved, not yet posted
  | 'live'         // content live on creator channels
  | 'paid'         // funds released to creator wallet
  // Terminal, and deliberately NOT a pipeline column: every application and
  // offer was declined or withdrawn, so the pair is out of the running.
  //
  // This was produced by the state machine long before it existed in this
  // union — forced in via `'cancelled' as V2CollabStage` — so the type said 8
  // stages while reality had 9. Nothing caught the divergence, and the value
  // silently fell through five surfaces: invisible on the brand kanban while
  // still inflating its badge, gone from the creator's collab board, and an
  // unreachable CollabDetail that blamed "Campaign data unavailable".
  //
  // Stage metadata now lives in ONE place — `V2_STAGE_META` in v2Adapters,
  // a Record keyed by this union — so adding a stage here is a compile error
  // until every surface's data is filled in. Keep it that way.
  | 'cancelled';

export interface V2Deliverable {
  /** UI identity. Either the underlying Submission.id when the slot has
   *  been filled, or `synth__<campaignId>__<creatorId>__<index>` for an
   *  empty slot. Don't use this for FK lookups — it's a render key. */
  id: string;
  /** P1d §1.5 — FK back into `db.deliverables`. Always a real Deliverable
   *  id post-P1d (the adapter iterates `db.deliverables` so this row
   *  always corresponds to a stored Deliverable). Pass to
   *  `v2SubmitContent(...)` as the `deliverableId` argument. */
  deliverableId: string;
  label: string;        // "Instagram Reel · 60s"
  status: 'pending' | 'in_review' | 'approved' | 'live' | 'revision';
  due: string;          // human date "May 18"
  submittedAt?: string;
  approvedAt?: string;
  liveAt?: string;
  thumb?: string;
  notes?: string;
  permalink?: string;
}

export interface V2Collab {
  id: string;
  campaignId: string;
  creatorId: string;
  stage: V2CollabStage;
  price: number;        // agreed creator rate in USD (0 if not yet negotiated)
  deadline: string;     // human "May 18" or ISO
  appliedAt?: string;
  pitch?: string;
  deliverables: V2Deliverable[];
}

export interface V2PipelineStage {
  id: V2CollabStage;
  label: string;
  color: string;        // CSS color — use design tokens
}

export interface V2CampaignPerf {
  impressions: number;
  reach: number;
  engagement: number;
  er: number;           // %
  cpm: number;          // $ per 1k impressions
  cpe: number;          // $ per engagement
  saves: number;
  shares: number;
  profileVisits: number;
  weeklySeries: number[];
}
