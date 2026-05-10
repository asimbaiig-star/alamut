# Alamut Portal — Current State PRD

> **Scope:** the post-signin portal experience (creator, brand, admin) and the cross-cutting platform mechanics that power it. **Out of scope:** marketing landing pages (`/`, `/for-brands`, `/c/:handle`, `/tools/*`, `/creators`).
>
> **Purpose:** snapshot of the AS-IS product so a revamp can plan against a real baseline. File paths are inline so anything stated here can be cross-checked.
>
> **Version:** 1.0 · post-Phase 56g (2026-05-07)

---

## 0 · Document map

1. [Product overview](#1--product-overview)
2. [Roles & personas](#2--roles--personas)
3. [System architecture](#3--system-architecture)
4. [Routes & navigation](#4--routes--navigation)
5. [Screen catalogue](#5--screen-catalogue)
6. [Domain entities](#6--domain-entities)
7. [Core workflows](#7--core-workflows)
8. [Cross-cutting features](#8--cross-cutting-features)
9. [Design system](#9--design-system)
10. [Tech stack](#10--tech-stack)
11. [Performance posture](#11--performance-posture)
12. [Known debt & revamp candidates](#12--known-debt--revamp-candidates)
13. [Out-of-scope today](#13--out-of-scope-today)
14. [Appendix · file map](#14--appendix--file-map)
15. [Glossary](#15--glossary)

---

## 1 · Product overview

**What it is.** A two-sided creator–brand marketplace. Brands post campaign briefs; vetted creators apply or get matched in; offers and counters are negotiated inside the platform; brand budgets lock in escrow on offer acceptance; creator deliveries route through revisions until brand approval; payouts release through escrow; both sides leave public reviews on the closed deal.

**Why it exists.** Replace the agency middle layer (15–25% take + retainer) with a flat 5% take rate, AI-assisted matching, and on-platform contracting/escrow.

**Two-sided value:**

| | Creator | Brand |
|---|---|---|
| **Hook** | "Your next brand partnership starts here" — direct access without cold outreach, escrow before you start work, public track record per closed deal | "AI-driven campaigns without compromise" — vetted creators apply within hours, ROAS tracked per UTM, no retainer |
| **Core actions** | browse marketplace · apply · counter · upload · withdraw earnings | post brief · review applications · send offer · approve work · release escrow |
| **Trust signal** | brands are verified before they post; payment is in escrow before work starts | creators are reviewed before they can apply; closed deals leave a public receipt |

**Data-model truth.** A "deal" is the `(campaign × creator)` pair. Almost every screen in the portal renders a list of deals through one or more derivation functions (`computeDealState`, `computeDealAction`, `rankDeals`). The Today queue is the canonical UX — a flat ranked list of every actionable deal pair for the current user.

---

## 2 · Roles & personas

### 2.1 Roles (hard-coded in `User.role`)

| Role | What they do | Primary screens |
|---|---|---|
| **creator** | Operate a storefront, browse briefs, apply to campaigns, deliver work, withdraw earnings | `/creator/today`, `/creator/discover`, `/creator/campaigns`, `/creator/earnings`, `/c/:handle` |
| **brand** | Operate a brand workspace, post briefs, review applicants, send offers, approve submissions, release payment | `/brand/today`, `/brand/campaigns`, `/brand/discover`, `/brand/wallet`, `/brand/inbox` |
| **admin** | Approve creator applications, verify brands, resolve disputes, manage payouts, audit transactions | `/admin/home`, `/admin/queue`, `/admin/payouts`, `/admin/audit` |

### 2.2 Sub-types within roles

- **Creator tier:** `Rising | Specialist | Flagship` (drives ranking weights and trust badge)
- **Creator manager/agent:** `User.managesCreatorIds[]` — one user can administer multiple creator accounts
- **Brand team member:** `User.teamRole?` — multi-seat brand accounts (mostly stub today)
- **Status gates:** `User.status: pending_verification | active | pending_admin_review | suspended` — controls portal access

### 2.3 Authentication

- Mock auth (no real OAuth). Email + password OR magic link (issued in-band in demo mode).
- Session = `{ userId, issuedAt }` in Zustand, persisted to localStorage under key `alamut.v1`.
- `useAuth()` hook (`app/src/lib/auth/useAuth.ts`) returns `{ user, creator?, brand?, isAuthed, isCreator, isBrand, isAdmin }`.
- All authenticated routes wrap in `<ProtectedRoute allow={['role']} />`. Pre-login redirect goes to `/onboarding/{role}` if `User.status === 'pending_verification'`.

---

## 3 · System architecture

### 3.1 Stack at a glance

```
React 18 + TypeScript + Vite
↓
react-router-dom v6 (file-based-ish via router.tsx)
↓
Zustand store (single source of truth, persist middleware → localStorage)
↓
In-memory mock API (app/src/lib/api/client.ts) — async, 280ms simulated latency
↓
Seed dataset (app/src/lib/api/seed.ts) — ~50 brands, ~80 creators, ~30 campaigns
```

### 3.2 State flow

1. **App boot** → Zustand rehydrates from localStorage (`alamut.v1`, version 12). If version mismatch, flush + reseed from `SEED`.
2. **User signs in** → `api.auth.signIn(email, pw)` → mutates `session` in store → useAuth re-renders.
3. **Screen mounts** → reads `db` from Zustand → derives view via pure functions (e.g. `collectTodayDeals(db, userId, role)` for the Today queue).
4. **User acts** → `api.{...}` call → `tx()` wraps mutator, builds new DB snapshot, updates store.
5. **All subscribers re-render** with the new state. Notifications get pushed in the same `tx()` block.

### 3.3 Pure derivation principle

The codebase leans heavily on **pure functions over the DB snapshot** for view derivation:

- `deriveDeal(db, campaignId, creatorId)` → returns a stable Deal shape used by every screen that touches a deal pair.
- `computeDealState(deal, db)` → returns one of 13 deal states (`pending`, `applied`, `shortlisted`, `offered`, `countered`, `accepted`, `in_review`, `revisions`, `approved`, `posted`, `cleared`, `disputed`, `closed`).
- `computeDealAction(state, role)` → returns `{ urgency, primaryCta, secondaryCta }` for the action banner.
- `rankDeals(deals, role)` → orders by urgency, separates actionable (top) from passive (below).

This means **the Today screen, Campaigns screen, Campaign Roster, and Deal page all render the same Deal object** — they just project different subsets.

---

## 4 · Routes & navigation

### 4.1 Route table (full)

Source: `app/src/router.tsx` (lines 136–242)

| Path | Role gate | Component | Lazy | Purpose |
|---|---|---|---|---|
| `/` | public | `Cover` | yes | Creator-facing landing |
| `/for-brands` | public | `BrandLanding` | yes | Brand-facing landing |
| `/c/:handle` | public | `PublicCreator` | yes | Public storefront |
| `/creators` | public | `CreatorsDirectory` | yes | Public creator directory |
| `/tools/instagram-calculator` | public | `RateCalculator` | yes | IG rate tool |
| `/tools/tiktok-calculator` | public | `RateCalculator` | yes | TikTok rate tool |
| `/tools/youtube-calculator` | public | `RateCalculator` | yes | YouTube rate tool |
| `/signin`, `/signup` | public | `SignIn`, `SignUp` | eager | Auth |
| `/onboarding/creator` | creator | `CreatorOnboarding` | yes | 5-step wizard |
| `/onboarding/brand` | brand | `BrandOnboarding` | yes | Brand setup wizard |
| **`/creator`** | creator | redirect → `/creator/today` | — | — |
| `/creator/today` | creator | `Today` | **eager** | Home dashboard (ranked deal queue) |
| `/creator/discover` | creator | `Discover` | yes | Browse live briefs |
| `/creator/campaigns` | creator | `Campaigns` | yes | Pipeline view |
| `/creator/campaigns/:id` | creator | `CampaignDetail` | yes | Single-campaign deep dive |
| `/creator/content` | creator | `Content` | yes | Submissions tracker |
| `/creator/inbox` | creator | `Inbox` | yes | Threaded messages |
| `/creator/earnings` | creator | `Earnings` | yes | Wallet, payouts, advances |
| `/creator/analytics` | creator | `Analytics` | yes | Performance metrics |
| `/creator/profile` | creator | `Profile` | yes | Edit storefront |
| **`/brand`** | brand | redirect → `/brand/today` | — | — |
| `/brand/today` | brand | `Today` | **eager** | Home dashboard |
| `/brand/campaigns` | brand | `Campaigns` | yes | Pipeline view |
| `/brand/campaigns/:id` | brand | `CampaignRoster` | yes | Roster (deals grouped by state) |
| `/brand/discover` | brand | `Discover` | yes | Search creators |
| `/brand/inbox` | brand | `Inbox` | yes | Threaded messages |
| `/brand/wallet` | brand | `Wallet` | yes | Top-up, escrow, ledger |
| `/brand/analytics` | brand | `Analytics` | yes | ROI, creator comparison |
| `/brand/profile` | brand | `Profile` | yes | Edit brand profile |
| **`/admin`** | admin | redirect → `/admin/home` | — | — |
| `/admin/home` | admin | `Home` | **eager** | Admin dashboard |
| `/admin/queue` | admin | `AdminQueueUnified` | yes | Tabs: creators / brands / disputes |
| `/admin/payouts` | admin | `Payouts` | yes | Manage creator payouts |
| `/admin/audit` | admin | `Audit` | yes | Transaction log |
| **`/deal/:dealId`** | any auth | `Deal` | yes | Canonical deal page (cross-role) |

**Eager-loaded:** `Cover`, `BrandLanding`, `SignIn`, `SignUp`, `Today` (creator+brand), `Home` (admin). Everything else lazy-loads with a `RouteFallback` skeleton if the chunk takes >120ms.

**Legacy redirects (Phase 29):**
- `/creator/home` → `/creator/today`
- `/brand/home` → `/brand/today`
- `/brand/approvals` → `/brand/today` (triage merged into Today)
- `/admin/verify`, `/admin/disputes` → `/admin/queue?type=…`

### 4.2 Sidebar navigation

Component: `app/src/components/layout/Sidebar.tsx`. Fixed left rail (`--side-w: 248px`), role-specific menu, notifications bell with unread badge, sign-out at bottom.

| Creator menu | Brand menu | Admin menu |
|---|---|---|
| Today | Today | Home |
| Discover | Campaigns | Queue |
| Campaigns | Discover | Payouts |
| Content | Inbox | Audit |
| Inbox | Wallet | |
| Earnings | Analytics | |
| Analytics | Profile | |
| Profile | | |

---

## 5 · Screen catalogue

For each major screen: purpose · primary actions · data shown · file path.

### 5.1 Creator screens

#### `/creator/today` — Home dashboard
- **File:** `app/src/screens/creator/Today.tsx`
- **Purpose:** ranked queue of every actionable deal for this creator, plus KPI strip.
- **Layout:** KPI tiles (wallet · pending · earned · open offers) → setup-completion banner if profile incomplete → flat list of Deal rows ranked by urgency → "no urgent" empty state if queue is empty.
- **Data shown per row:** brand mark, campaign title, deal state pill, primary action CTA, days to deadline, amount on the line.
- **Primary actions:** click row → `/deal/:id`; quick-actions inline (accept offer, upload, etc.).
- **Derivation:** `collectTodayDeals(db, userId, 'creator')` — enumerates application/offer/submission pairs, derives Deal, ranks by urgency.

#### `/creator/discover` — Marketplace
- **File:** `app/src/screens/creator/Discover.tsx`
- **Purpose:** browse live briefs.
- **Filters:** category multi-select · region · platform · deliverable type · budget range · deadline urgency.
- **Sort:** match score (default) · deadline · most recent · highest budget.
- **Card:** brand mark · title · pitch excerpt · budget · deliverables · deadline · "Apply" CTA.
- **Apply flow:** opens ApplyModal (pitch + optional proposed rate).

#### `/creator/campaigns` — Pipeline
- **File:** `app/src/screens/creator/Campaigns.tsx`
- **Purpose:** all campaigns this creator has touched, grouped by stage.
- **Groups:** Active deals · Pending offers · Submitted applications · Past closed.

#### `/creator/campaigns/:id` — Single campaign deep dive
- **File:** `app/src/screens/creator/CampaignDetail.tsx`

#### `/creator/content` — Submissions tracker
- **File:** `app/src/screens/creator/Content.tsx`
- **Purpose:** every submission across campaigns, status (in review · revisions · approved), inline upload-new-revision button.

#### `/creator/inbox` — Messaging
- **File:** `app/src/screens/creator/Inbox.tsx` + shared `InboxView` component.
- **Purpose:** threaded messages with brand contacts. Auto-thread is created when an offer is sent.

#### `/creator/earnings` — Money
- **File:** `app/src/screens/creator/Earnings.tsx`
- **Purpose:** wallet (available) + pending escrow + transaction history + request advance.
- **Actions:** withdraw to bank · request income advance (RequestAdvanceModal) · download tax docs (stub).

#### `/creator/analytics` — Performance
- **File:** `app/src/screens/creator/Analytics.tsx`
- **Charts:** reach over time, engagement per platform, top campaigns by ROAS, audience demographics.

#### `/creator/profile` — Storefront editor
- **File:** `app/src/screens/creator/Profile.tsx`
- **Sections:** identity (name/handle/bio/portrait/work) · platforms (handle + followers + verified) · rate cards per platform per format · payout method · availability calendar · tax info.

### 5.2 Brand screens

#### `/brand/today` — Home dashboard
- **File:** `app/src/screens/brand/Today.tsx`
- **Purpose:** ranked queue of every actionable deal across all campaigns.
- **KPIs:** wallet balance · escrow held · active campaigns count.
- **Notice block:** orphan campaigns (live, past deadline, zero applications/offers/submissions) flagged separately above the queue.

#### `/brand/campaigns` — Pipeline
- **File:** `app/src/screens/brand/Campaigns.tsx`
- **Purpose:** all campaigns grouped by stage. Has the "+ New campaign" CTA → `NewCampaignModal`.

#### `/brand/campaigns/:id` — Roster
- **File:** `app/src/screens/brand/CampaignRoster.tsx`
- **Bands (state-grouped rows):**
  1. Needs your decision (disputed → countered offers → in-review submissions)
  2. In flight (accepted offers in production)
  3. Shortlist (shortlisted creators awaiting offer)
  4. New applications (incoming pitches)
  5. Past (closed/rejected)
- **Inline modals:** `OfferModal` (send offer to shortlisted creator), `DisputeResolveModal` (admin only), `MessageModal` (start thread with applicant).
- **Deep linking:** `?action=offer&creator=…` opens the offer modal pre-filled.
- **Brief panel:** collapsible at top with budget, deliverables, deadline, escrow held.

#### `/brand/discover` — Creator search
- **File:** `app/src/screens/brand/Discover.tsx`
- **Filters:** tier (Rising/Specialist/Flagship) · category · region · verified · available now · saved-only · min rating · follower band.
- **Sort:** match score · rating · reach · most recent · saved first.
- **Card:** portrait · name · tier pill · category tags · key platform · reach · rating · "Save" + "View profile" + "Send brief" buttons.
- **Modals:** AIMatchModal (rule-based suggestions), CreatorCompareModal, NewCampaignModal (inline brief).

#### `/brand/inbox`, `/brand/wallet`, `/brand/analytics`, `/brand/profile`

Symmetric to creator counterparts. Brand wallet has an additional "ad spend" row (boosted-post mechanic from Tier 2).

### 5.3 Admin screens

#### `/admin/home` — Dashboard
- **File:** `app/src/screens/admin/Home.tsx`
- **KPIs:** pending creator approvals · brands awaiting verification · open disputes · GMV last 30d.

#### `/admin/queue` — Unified triage (tabs)
- **File:** `app/src/screens/admin/AdminQueueUnified.tsx`
- **Tab `creators`:** users with `status='pending_admin_review'` + `creatorId` set. Approve / reject with reason.
- **Tab `brands`:** brands with `verified=false`. Verify or reject.
- **Tab `disputes`:** all disputes with `status='open'`. Open `DisputeResolveModal` to pick resolution + split money.

#### `/admin/payouts` — Payout management
- **File:** `app/src/screens/admin/Payouts.tsx`
- **Purpose:** view pending payouts, mark cleared, audit failures.

#### `/admin/audit` — Transaction log
- **File:** `app/src/screens/admin/Audit.tsx`
- **Purpose:** filterable table of every Transaction: kind, status, parties, amount, date.

### 5.4 Shared cross-role screen

#### `/deal/:dealId` — Canonical deal page
- **File:** `app/src/screens/deal/Deal.tsx`
- **Purpose:** a single deal pair, viewed by any participant (creator owns side · brand owns campaign · admin sees all · viewable read-only by other accounts in some states).
- **Layout (top-to-bottom):**
  1. **DealActionBanner** — primary CTA tied to current state × role (e.g. brand sees "Approve submission" when state=in_review; creator sees "Counter offer" when state=offered).
  2. **Files panel** — submission deliverables in a `Lightbox` viewer with revision history.
  3. **Chat thread** — inline messaging (same data as `/inbox` but scoped to this deal's thread).
  4. **Brief panel** (collapsible) — campaign brief, deliverables, deadline, rights.
  5. **Money summary** — rate, escrow held, fees, net to creator.
  6. **Timeline** — every state transition with timestamps and actor.
- **Modal stack:** `CounterOfferModal` · `UploadDraftModal` · `DisputeModal` · `ReviewModal` · `MessageModal` · `RevisionsModal`.
- **Presence:** PresenceBanner shows "X is also viewing" on disputed deals only (Phase 25 QA fix).

### 5.5 Onboarding wizards

#### `/onboarding/creator` — 5 steps
- **File:** `app/src/screens/onboarding/CreatorOnboarding.tsx`
- **Surface:** `data-surface="airy"` (different from portal's dense default).
- **Steps:** platform pick → channel block (handle/bio/categories) → rates → payout (Stripe Connect placeholder + tax ID) → publish (share storefront link).

#### `/onboarding/brand` — Parallel wizard
- **File:** `app/src/screens/onboarding/BrandOnboarding.tsx`
- **Less developed than creator wizard;** revamp candidate.

---

## 6 · Domain entities

Source: `app/src/lib/api/types.ts` (lines 1–500).

### 6.1 Identity layer

#### `User`
```ts
{
  id, email, passwordHash, role: 'creator' | 'brand' | 'admin',
  status: 'pending_verification' | 'active' | 'pending_admin_review' | 'suspended',
  createdAt,
  // Relations
  creatorId?: string,        // populated when role='creator'
  brandId?: string,          // populated when role='brand'
  managesCreatorIds?: string[], // for managers/agents
  teamRole?: 'owner' | 'manager' | 'viewer', // brand teams
  notificationPrefs: { applications, offers, approvals, payouts, reviews, team, marketing },
  pendingMagicLink?: { token, issuedAt },
}
```

#### `Creator`
```ts
{
  id, userId, name, handle, tagline, bio,
  city, country, languages[], categories[],
  portrait, work[], // string[] of cover URLs
  // Platforms
  platforms: Platform[], // { name, handle, followers, engagement, verified, audience }
  // Monetization
  rateCard: { post, reel, story, longform }, // legacy fallback
  rateCards: RateCardEntry[], // per-platform format+rate+notes
  // Money
  payout: { method, account, currency },
  walletBalance, pendingBalance, lifetimeEarnings,
  // Identity
  tier: 'Rising' | 'Specialist' | 'Flagship',
  rating, reach (sum followers), engagement, responseHrs,
  verified, profileCompletion,
  // Polish
  pressMentions[], pastClients[], availability?: { status, untilDate, note },
  managedByUserId?,
}
```

#### `Brand`
```ts
{
  id, userId, name, industry, hq, website, about,
  logoMark?, // single-char fallback ('A' for Aesop)
  preferredCategories[], preferredRegions[],
  walletBalance, escrowHeld,
  verified, savedCreators[], socialPlatforms: BrandSocial[],
}
```

### 6.2 Transaction layer

#### `Campaign`
```ts
{
  id, brandId, title, pitch, brief, cover,
  budget, spent, escrowHeld,
  region, category, deliverables[], deadline, postedAt?,
  // Lifecycle
  stage: 'draft' | 'live' | 'shortlist' | 'offer' | 'production' | 'posted' | 'reporting' | 'closed',
  history: { stage, at, by }[],
  milestones: { id, stage, amount, releasedAt?, description }[],
  // Roster (creator IDs)
  applications[], shortlist[], offers[], acceptedCreators[],
  // Tier 1 features
  rights?: { exclusivity, whitelistAds, repurpose, derivative, organicOnly },
  tracking?: TrackingLink[], // { creatorId, utm, clicks, conversions, revenueAttributed }
  // Tier 2 features
  kind?: 'one_off' | 'retainer',
  retainer?: { monthlyRate, termMonths, deliverablesPerMonth, startedAt, monthsCompleted },
  boosts?: AdBoost[], // whitelisted-post amplification
  // Tier 3 features
  pricingModel?: 'fixed' | 'outcome',
  outcomePricing?: { baseFloor, perConversion, capPerCreator },
  // Curation
  editorsPick?: boolean,
}
```

#### `Application`
```ts
{
  id, campaignId, creatorId, pitch, proposedRate?,
  status: 'submitted' | 'shortlisted' | 'rejected' | 'withdrawn',
  submittedAt, decidedAt?,
}
```

#### `Offer`
```ts
{
  id, campaignId, creatorId, rate, message,
  status: 'pending' | 'accepted' | 'declined' | 'withdrawn' | 'countered',
  sentAt, respondedAt?,
  counter?: { rate, message, at }, // single-cycle counter
}
```

#### `Submission`
```ts
{
  id, campaignId, creatorId, round, files[], notes,
  status: 'in_review' | 'revisions' | 'approved',
  submittedAt,
  feedback: { from, text, at }[],
}
```

#### `Dispute`
```ts
{
  id, campaignId, openedByUserId, againstUserId,
  reason: 'creator_no_show' | 'brand_no_approval' | 'content_quality' | 'rights_violation' | 'payment_issue' | 'other',
  details, openedAt,
  status: 'open' | 'resolved_for_brand' | 'resolved_for_creator' | 'resolved_split' | 'withdrawn',
  // Resolution
  at?, byUserId?, note?, releasedToCreator?, refundedToBrand?,
}
```

### 6.3 Communication layer

#### `Thread` + `Message`
```ts
Thread { id, participants[], campaignId?, subject, lastMessageAt, unreadFor[] }
Message { id, threadId, fromUserId, text, at, attachments?[] }
```

### 6.4 Money layer

#### `Transaction`
```ts
{
  id, at, userId, kind, amount, status,
  campaignId?, counterpartyUserId?, note,
}

kind: 'topup' | 'escrow_hold' | 'escrow_release' | 'payout' | 'refund' | 'fee' | 'ad_spend' | 'referral_bonus'
status: 'cleared' | 'pending' | 'failed'
```

### 6.5 Trust layer

#### `Review`
```ts
{
  id, campaignId, fromUserId,
  reviewType: 'creator' | 'brand', // who's being reviewed
  targetId,
  rating: 1 | 2 | 3 | 4 | 5,
  text, at,
  response?: { text, at }, // reviewed party's reply
}
```

#### `Notification`
```ts
{ id, userId, text, href?, at, read, meta? }
```

### 6.6 Growth layer

#### `Referral`
```ts
{
  id, fromCreatorId, toCreatorId, noteToReferred,
  recommendedBrandId?, createdAt,
  status: 'invited' | 'active' | 'expired' | 'bonus_paid',
  bonusEarned?, bonusPaidAt?,
}
```

#### `Advance` (income advance against future earnings)
```ts
{
  id, creatorId, requestedAt, amount, feePct, feeAmount,
  collateralPending,
  status: 'active' | 'repaid' | 'defaulted',
  repaidAt?, repaidAmount,
}
```

### 6.7 Marketing layer

#### `Testimonial`
Used only on landing pages. Out of scope for the portal revamp.

---

## 7 · Core workflows

### 7.1 Creator onboarding

| Step | Data collected | Mutation |
|---|---|---|
| 1 · Platform | Primary platform pick (7 options) | Local form state |
| 2 · Channel | Handle, channel name, tagline, bio, city, country, follower count, categories | Local form state |
| 3 · Rates | Per-format rates (post · reel · story · longform), 5% fee transparency | Local form state |
| 4 · Payout | Stripe Connect link (mock), tax ID | Local form state |
| 5 · Publish | Confirms storefront URL `/c/:handle` | `tx()` writes Creator record + flips `User.status` to `active` |

Pre-fills on re-entry (revisits the wizard).

### 7.2 Creator: apply → negotiate → deliver → get paid

```
[browse Discover] →
[click "Apply" on campaign card] → ApplyModal → submit pitch + proposed rate
  ↓ creates Application(status=submitted) + notifies brand

[brand reviews + sends offer] → OfferModal on brand side
  ↓ creates Offer(status=pending) + auto-creates Thread + first Message + notifies creator

[creator opens deal page] → DealActionBanner shows "Accept offer / Counter / Decline"
  ↓ if Counter: CounterOfferModal → sets Offer.counter, brand re-decides
  ↓ if Accept: respondToOffer('accept')
       → creates escrow_hold Transaction (brand wallet → escrow)
       → Campaign.escrowHeld += rate, Brand.escrowHeld += rate
       → Creator.pendingBalance += rate
       → Campaign.stage → 'production'
       → Campaign.acceptedCreators[] += creatorId

[creator uploads work] → UploadDraftModal → submitWork(round, files, notes)
  ↓ creates Submission(round=N, status='in_review')

[brand reviews] → DealActionBanner shows "Approve / Request revisions / Open dispute"
  ↓ if revisions: requestRevisions(submissionId, feedback)
       → Submission.status='revisions', Submission.feedback[] += entry
       → loops back to upload step (round++)
  ↓ if approve: approveSubmission(submissionId)
       → Submission.status='approved'
       → enables "Release payment" CTA

[brand releases payment] → releasePayment(campaignId, creatorId, amount)
  ↓ creates escrow_release Transaction (escrow → creator wallet)
  ↓ Creator.walletBalance += amount, Creator.pendingBalance -= amount
  ↓ Brand.escrowHeld -= amount, Campaign.escrowHeld -= amount

[campaign closes] → both parties leave reviews → ReviewModal
```

API surface: `app/src/lib/api/client.ts` (~280ms simulated latency on every call).

### 7.3 Brand: post brief → review → accept → approve → release

```
[click "+ New campaign"] → NewCampaignModal
  ↓ creates Campaign(stage='draft' or 'live') + auto-creates 50/50 milestones

[campaign goes live] → transitionCampaign(id, 'live')
  ↓ becomes visible in creator Discover

[applications roll in] → CampaignRoster band "New applications"
  ↓ decideApplication(appId, 'shortlist' | 'reject')
  ↓ shortlisted creator → moves to "Shortlist" band

[send offer] → OfferModal → sendOffer(creatorId, rate, message)
  ↓ creates Offer + auto-Thread

[creator counters] → brand sees Offer.counter on deal page
  ↓ acceptCounter(offerId) → updates rate → Offer.status='accepted'
  ↓ OR re-offer at different rate (creates new round)

[creator submits work] → submission appears in "In flight" band, deal page Files panel
  ↓ approve → Submission.status='approved'

[release payment] → escrow_release Transaction
  ↓ campaign moves through stages: production → posted → reporting → closed

[both leave reviews] → public reviews on storefronts
```

### 7.4 Disputes

Either party opens dispute (DisputeModal on Deal page) with reason + details. Campaign stage stays as-is but escrow is **frozen** (no transitions until resolved). State machine: `disputed` beats all other states (deal-state.ts line 86).

Admin resolves via DisputeResolveModal:
- `resolved_for_brand` → refund full amount to brand
- `resolved_for_creator` → release full amount to creator
- `resolved_split` → custom split (releasedToCreator + refundedToBrand)
- `withdrawn` → escrow returns to original holder

Resolution writes appropriate `escrow_release` and/or `refund` transactions atomically.

### 7.5 Wallet / payouts (creator)

- **Available balance** = `Creator.walletBalance` (cleared, withdrawable)
- **Pending escrow** = `Creator.pendingBalance` (in active accepted offers, not yet approved)
- **Withdraw** → creates `payout` Transaction (`status='pending'` → admin clears it → `'cleared'`)
- **Income advance** → RequestAdvanceModal: borrow against pending balance at `feePct` (typically 3%); creates `Advance` record; auto-repays from next cleared payouts

### 7.6 Admin moderation

| Tab | Source | Approve action | Reject action |
|---|---|---|---|
| `creators` | `User.status==='pending_admin_review' && creatorId` | `User.status='active'` | `User.status='suspended'` + reason email mock |
| `brands` | `Brand.verified===false` | `Brand.verified=true` | (no-op; remains unverified) |
| `disputes` | `Dispute.status==='open'` | (resolution modal — split decision) | (resolution modal — pick winner) |

---

## 8 · Cross-cutting features

### 8.1 Escrow (the central money mechanic)

**Trigger:** offer accepted (`respondToOffer('accept')` — `client.ts:356–368`)

**Effects:**
- `escrow_hold` Transaction created: `userId=brand.id`, `kind='escrow_hold'`, `status='cleared'`, `amount=rate`, `counterpartyUserId=creator.userId`.
- `Brand.walletBalance -= rate`
- `Brand.escrowHeld += rate`
- `Campaign.escrowHeld += rate`
- `Creator.pendingBalance += rate`

**Release:** on `releasePayment(...)`:
- `escrow_release` Transaction created.
- `Brand.escrowHeld -= rate`
- `Campaign.escrowHeld -= rate`
- `Creator.pendingBalance -= rate`
- `Creator.walletBalance += rate`

**Frozen during disputes:** no transitions, no release, until admin resolves.

**No separate escrow service.** All logic lives in the API client. A real backend would extract this into a Stripe-Connect-Custom or escrow.com integration.

### 8.2 Notifications

- **Types:** `applications | offers | approvals | payouts | reviews | team | marketing` (per-user toggleable)
- **Display:** bell icon in sidebar (`NotificationsBell` component), unread badge count, dropdown list, click → navigate to `href`
- **Push moment:** inside `tx()` mutator after the relevant state change (e.g. `pushNotification(d, brandUserId, 'applications', '@sarah applied to your spring brief', '/brand/campaigns/cmp_2', { applicationId: 'app_3' })`)
- **Real-time:** mocked via store reactivity; real backend would need WebSocket or polling.

### 8.3 Search & discovery

- **Creator-side discovery** (browse briefs): full-text search on title + pitch, multi-faceted filters, sort by match score. Match score is a simple weighted sum (category fit + region fit + budget band fit). Debounced 220ms.
- **Brand-side discovery** (browse creators): tier + category + region + verified + saved + min-rating + follower-band filters; sort by match score, rating, reach, recency. AI match modal proposes 5 best matches based on current campaign brief.
- **Utilities:** `app/src/lib/utils/discover-metrics.ts`.

### 8.4 Public storefront `/c/:handle`

- Visible without auth.
- Shows: portrait, name, handle, tagline, bio, categories, platform handles + follower counts, rate cards (with 5% fee breakdown), verified badge, rating + review count if any, work samples, public testimonials, "Send a brief" CTA (auth-walled).
- This is the asset creators link to from their bios. Conversion engine for cold inbound.

### 8.5 Ratings & track record

- Reviews tied to closed campaigns (one review per direction per campaign).
- Aggregated `Creator.rating` shown across all surfaces.
- "Trust tier" derived elsewhere (Bronze/Silver/Gold) based on closed-deals × avg-rating × verified.

### 8.6 Pricing & fees

- **Default model:** brand pays creator's accepted rate; platform takes flat **5%** off the top of the creator's payout.
- **Outcome model (Tier 3, opt-in):** `baseFloor` held in escrow; brand pays per-conversion (`perConversion`) up to `capPerCreator`. Used for performance-led campaigns.
- **Advance fee:** `Advance.feePct` (typically 3%) on borrowed amount.
- **Ad boost fee:** `AdBoost.dailyBudget` for whitelisted-post amplification.
- Fees do NOT have explicit deduction transactions today — implicit in payout amount.

---

## 9 · Design system

### 9.1 Surface modes (the `data-surface` system)

Three scoped CSS modes, each with its own typography, spacing, and color cascade:

| Surface | Used by | Character |
|---|---|---|
| **Dense** (default, no attribute) | Workspace portal screens | Compact spacing, small type, hairline borders, minimal air |
| `data-surface="airy"` | Onboarding wizards, auth pages (was) | Generous spacing, larger padding, full-bleed wizard feel |
| `data-surface="landing-light"` | All landing pages, auth pages (now), public storefront | Off-white canvas, sans-serif display, paper grain, dropshadow scale |

The portal lives almost entirely in **Dense** mode today.

### 9.2 Color tokens

Source: `app/src/styles/tokens.css`

OKLCH color space throughout. Semantic palette:

| Token | Hue | Used for |
|---|---|---|
| `--good` | emerald | success, approved, earned |
| `--warn` | amber | pending, in review, waiting |
| `--bad` | coral | error, declined, urgent |
| `--info` | sky | neutral info |
| `--premium` | plum | verified, gold tier |

Background canvas: `--bg-canvas: oklch(0.97 0.005 60)` (warm cream, intentionally not pure white). Three soft radial blobs (peach, coral, sage) at 40–55% opacity provide ambient atmosphere.

Accent variants toggleable via `body[data-accent="..."]`: terracotta, ink, olive, ultramarine, ochre.

Dark theme available via `body[data-theme="dark"]` (inverted palette, not actively used post-Phase 50).

### 9.3 Typography

- `--serif`: **Fraunces** (display headings, editorial moments)
- `--sans`: **Switzer** primary, fallback to Inter / system (body, UI)
- `--mono`: **JetBrains Mono** (code, amounts, metadata)

### 9.4 Component primitives

Source: `app/src/components/`

#### Layout
- `WorkspaceShell` — wraps every authenticated screen. Sidebar + content pane. Mobile nav state. Cursor halo (rAF-throttled pointermove).
- `Sidebar` — fixed left rail, role-specific menu, notifications, sign-out.
- `PageHead` — title + subtitle + optional CTA.
- `TileHalo` — atmospheric cursor-following glow on interactive tiles.

#### Form
- `Button` (primary / secondary / tertiary, sm/md/lg)
- `Label`
- `Modal` (generic wrapper, takes `width: number` prop)

#### Feedback
- `ToastHost` + `pushToast()` API
- `ConfirmHost` + `confirmAction()` API
- `Pill` (inline status / category / tier badge)
- `PresenceBanner` (other users viewing — disputed deals only)

#### Data
- `Card` (generic tile)
- `CreatorHoverCard` (popover with creator details)
- `Lightbox` (file gallery viewer)
- `TrustBadge` (verified mark / tier indicator)
- `TickerNumber` (animated number counter for wallets/metrics)
- `Icon` (SVG library)
- `EmptyArt` (empty state illustration)

#### Charts
- `BarChart`, `Sparkline`, `FunnelChart`, `AudienceCharts`

### 9.5 Patterns

- **Universal tile pattern**: hairline border + inset highlight + soft outer shadow. Hover-lift on interactive tiles.
- **Cursor halo**: every `.kcard`, `.creator-card`, `.tile-interactive` gets a soft accent-glow that follows the cursor, attached to the WorkspaceShell pointermove listener.
- **Banded list**: state-grouped rows with header (used in CampaignRoster).
- **Action banner + body panels**: deal page primary layout.
- **Two-pane editor**: form left + sticky live preview right (used in onboarding, profile editor).

---

## 10 · Tech stack

### 10.1 Core

- **React 18+** (functional components, hooks, Suspense)
- **TypeScript** (strict mode, full type coverage)
- **Vite** (build, route-level code splitting via `lazy()` + Suspense)

### 10.2 State

- **Zustand** with `persist` middleware
- **Storage key:** `alamut.v1` (version 12, bumped on schema breaking changes — current bump caused by adding `testimonials[]` to Database)
- **Store shape:** `{ db: Database, session: Session | null, setDB, setSession, resetAll }`
- **Mutation pattern:** `tx(mutator)` helper shallow-clones every array in the DB, runs the mutator on the new shape, returns result, triggers Zustand re-render.

### 10.3 Routing

- **react-router-dom v6+** (`createBrowserRouter`)
- **`ProtectedRoute`** wrapper checks `useAuth().role` against `allow={[...]}` array; renders `<NotAllowed/>` if mismatch.
- **`RouteFallback`** skeleton on slow chunks (>120ms).
- **Deep linking:** URL params on `/deal/:dealId`, `/brand/campaigns/:id`, `/c/:handle`. Query params on `/admin/queue?type=...` and `/brand/campaigns/:id?action=offer&creator=...`.

### 10.4 Styling

- **No CSS-in-JS.** Raw CSS files cascaded via `:root` + `body[data-theme]` + `body[data-accent]` + `[data-surface]`.
- **Files:**
  - `tokens.css` — design tokens
  - `base.css` — resets
  - `layout.css` — shells, grids, sidebar
  - `components.css` — buttons, modals, cards
  - `screens.css` — screen-specific overrides
  - `landing.css` — public landing pages (post-Phase 56 ~9000 lines)
  - `cinematic.css` — legacy scroll-pinned hero animations
  - `responsive.css` — mobile breakpoints
  - `print.css` — print

### 10.5 API layer

- **In-memory mock client** (`app/src/lib/api/client.ts`) — async, 280ms simulated latency via `delay()`.
- **`ApiError`** thrown with `code` + `message`; screens catch and surface via toast.
- **All mutations atomic via `tx()`.**
- **Designed to swap to real backend** without touching screens — interface is async/promise-based throughout.

### 10.6 Auth

- Mock email/password OR magic link.
- Magic link issued in-band: response includes `token`, user clicks "Verify and sign in" button in the demo UI.
- `useAuth()` hook is the single source of truth for role gating across the app.

### 10.7 Animation

- **`motion/react`** (Framer Motion) — lazy-loaded, chunked separately so it doesn't ship with the initial bundle.
- Pre-Phase 56, the legacy scroll-pin animations lived in `cinematic.css` (now mostly inert).

### 10.8 Utility libraries

- **Formatting:** `app/src/lib/utils/format.ts` (`fmtMoney`, `fmtMoneyFull`, `fmtDate`, `fmtRelative`, `fmtCount`)
- **Deal derivation:** `app/src/lib/api/use-deal.ts` (`deriveDeal()` + hook wrapper)
- **Deal state machine:** `app/src/lib/utils/deal-state.ts` (13 states, pure)
- **Deal actions:** `app/src/lib/utils/deal-action.ts` (urgency scoring, primary CTA per role)
- **Deal ranking:** `app/src/lib/utils/deal-ranking.ts`
- **Today queue:** `app/src/lib/utils/today-deals.ts`
- **Discover metrics:** `app/src/lib/utils/discover-metrics.ts`
- **Toast / confirm:** `app/src/lib/utils/toast.ts`, `app/src/lib/utils/confirm.ts`
- **DB indexing (Phase 31):** `app/src/lib/api/db-index.ts` — WeakMap-cached indexes (`campaignsById`, `creatorsById`, `appsByPair`, etc.) avoid O(N) scans.

---

## 11 · Performance posture

- **Route-level code splitting:** only Today + auth pages eager-load. Everything else lazy. Initial JS bundle ~225 kB / ~68 kB gzipped.
- **DB indexing:** WeakMap-cached indexes mean state derivations (used dozens of times per render) are O(1) lookups, not O(N) scans.
- **Search debounce:** 220ms on Discover.
- **Cursor halo:** rAF-throttled.
- **Memoization:** `useMemo` on deal collections, filter results, KPI rollups.
- **Reduced motion:** every animation respects `prefers-reduced-motion`.
- **Virtualization:** NOT in place today. Campaign rosters and discover lists render every row. Will need attention if a brand has 100+ campaigns or 500+ saved creators.

---

## 12 · Known debt & revamp candidates

### 12.1 Highest-complexity screens (likely to want decomposition)

| Screen | Complexity | Pain point |
|---|---|---|
| `/deal/:dealId` (Deal.tsx) | 13 deal states × 3 roles = 39 action branches; 6 modals stacked | Action banner + modal composition would benefit from extraction |
| `/brand/campaigns/:id` (CampaignRoster.tsx) | 5 state-grouped bands × inline modals × deep-link query handling | Extract `RosterBand` + `RosterRow` components |
| `/brand/discover` (Discover.tsx) | 7 filter facets × URL-synced state × 3 modal variants (AI match / compare / drawer) | Split filters from results into separate components |
| `/admin/queue` (AdminQueueUnified.tsx) | 3 tabs × inline resolution modals × badge aggregation | Extract tab routing to sub-components |

### 12.2 Legacy markers

- **Phase 25–32** is the current canon (deal pages, Today redesign, admin queue consolidation, onboarding wizards).
- **Phases 1–24** are legacy. Some `cinematic.css` rules are still loaded but inert post-Phase 56g.
- **Phase 56g (just completed)** removed broken `opacity:0` reveal defaults that were caused by a dropped `useReveal` hook — was making FAQ + FinalCTA invisible on landings.

### 12.3 QA notes / edge cases

- **Orphan campaigns**: live, past deadline, zero applications/offers/submissions — invisible in deal queues, surfaced as a notice block above the brand Today queue.
- **Presence broadcasting**: limited to disputed deals only (Phase 25 QA).
- **Deal state fallback**: uses explicit `creatorId` from inputs, not application's `creatorId`, to avoid mis-pairing.
- **Persisted state version**: bump on any `Database` shape change — old state flushes + reseeds from `SEED`.

### 12.4 What's not yet good enough

- **Dark theme**: tokens exist, screens don't actively support it post-Phase 50.
- **Mobile**: portal is desktop-first. Mobile breakpoints in `responsive.css` are defensive, not designed.
- **Notifications real-time**: mocked; no actual push channel.
- **Brand onboarding**: less developed than creator onboarding; revamp candidate.
- **Empty states**: inconsistent across screens (some screens have rich `EmptyArt` illustrations, others fall back to plain text).

---

## 13 · Out-of-scope today

These are talked about in the seed / type system but **not actually wired into UI flows**:

- **Retainer campaigns** (`Campaign.kind = 'retainer'`, `retainer.{...}`) — type exists, no creation flow.
- **Outcome pricing** (`Campaign.pricingModel = 'outcome'`) — type exists, no negotiation flow.
- **Whitelisted ad boosts** (`Campaign.boosts[]`) — type exists, no UI.
- **Brand teams / multi-seat** (`User.teamRole`) — partially scaffolded, no invitation/management UI.
- **Manager/agent accounts** (`User.managesCreatorIds[]`) — same — type exists, no flow.
- **Creator referrals** (`Referral` entity) — exists, no UI to send/receive.
- **Income advance approvals**: requested via UI, no admin approval queue.
- **Tax forms 1099/W-9**: collected at onboarding, no admin generation flow.
- **Real OAuth / Stripe Connect / Plaid**: all mocked.
- **Localization**: English only.
- **Accessibility audit**: ad-hoc per phase; no formal audit signed off.

---

## 14 · Appendix · file map

```
app/src/
├── App.tsx                                  # Top-level router host
├── router.tsx                               # All route declarations
├── lib/
│   ├── api/
│   │   ├── client.ts                        # Mock API surface (the brain)
│   │   ├── store.ts                         # Zustand store + tx() helper
│   │   ├── seed.ts                          # 80 creators × 50 brands × 30 campaigns
│   │   ├── types.ts                         # All entity definitions
│   │   ├── db-index.ts                      # Phase 31 WeakMap index cache
│   │   └── use-deal.ts                      # Deal derivation hook
│   ├── auth/
│   │   └── useAuth.ts                       # Single auth hook
│   └── utils/
│       ├── format.ts                        # fmtMoney, fmtDate, fmtCount
│       ├── deal-state.ts                    # 13 states, pure
│       ├── deal-action.ts                   # Urgency scoring per role
│       ├── deal-ranking.ts                  # rankDeals()
│       ├── today-deals.ts                   # collectTodayDeals()
│       ├── discover-metrics.ts              # Filter + ranking
│       ├── toast.ts, confirm.ts             # Imperative APIs
│       └── ...
├── components/
│   ├── layout/                              # Shell, sidebar, page head
│   ├── ui/                                  # Primitives (Button, Modal, Pill, ...)
│   ├── modals/                              # Apply, Counter, Upload, Dispute, Review, ...
│   ├── inbox/                               # InboxView + composer
│   ├── charts/                              # BarChart, Sparkline, FunnelChart
│   └── illustrations/                       # SVG illustration library
├── screens/
│   ├── auth/                                # SignIn, SignUp
│   ├── onboarding/                          # CreatorOnboarding, BrandOnboarding
│   ├── creator/                             # All creator portal screens
│   ├── brand/                               # All brand portal screens
│   ├── admin/                               # All admin portal screens
│   ├── deal/                                # Deal.tsx (cross-role)
│   ├── storefront/                          # PublicCreator (/c/:handle)
│   ├── tools/                               # RateCalculator, CreatorsDirectory
│   └── cover/                               # Cover (creator landing), BrandLanding, scenes
└── styles/
    ├── tokens.css                           # OKLCH design tokens
    ├── base.css, layout.css, components.css # Workspace styling
    ├── screens.css                          # Per-screen overrides
    ├── landing.css                          # Public landing system (~9000 lines)
    ├── cinematic.css                        # Legacy hero animations
    └── responsive.css, print.css

app/docs/
├── phase-49-motion-polish.md
├── phase-50-design-system-refresh.md
└── phase-52-1stcollab-inspired-rebuild.md
```

---

## 15 · Glossary

| Term | Meaning |
|---|---|
| **Deal** | A `(campaign × creator)` pair. The atomic unit of work in the system. |
| **Today queue** | The flat ranked list of every actionable deal for the current user. The canonical UX. |
| **Action banner** | The top-of-page CTA on the Deal page, varying per state × role. |
| **Escrow** | Brand's funds held by the platform between offer-acceptance and submission-approval. |
| **Tier** | `Rising | Specialist | Flagship` — creator level driving ranking weights and trust badges. |
| **Brief** | The brand's campaign description (`Campaign.brief`). |
| **Counter** | Creator's negotiated rate against a brand's offer. Single-cycle only. |
| **Roster** | Brand's deal-grouped view of a single campaign (CampaignRoster). |
| **Storefront** | Public creator profile page at `/c/:handle`. |
| **Trust tier** | Derived bronze/silver/gold rank from completed campaigns × avg rating × verified status. |
| **Outcome pricing** | Pay-per-conversion campaign model (Tier 3, opt-in). |
| **Retainer** | Multi-month creator engagement with fixed monthly rate (Tier 2, opt-in). |
| **Whitelist boost** | Brand-funded paid amplification of creator's organic post (Tier 2 feature). |
| **Phase X** | Internal milestone marker in code comments, indicating which design/build sprint shipped a given feature. Phase 56g is the current latest. |

---

*End of document. To revamp, fork this file as `REVAMP-PORTAL-PRD.md` and edit in place. Track changes in the "what's new vs current" section you'll add at the top.*
