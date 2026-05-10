# Alamut — Progress, Architecture, Next Steps

## What Alamut is

A two-sided marketplace connecting creators and brands. Brands run campaigns end-to-end (brief, shortlist, offer, produce, post, pay) without an agency markup. Creators apply to live campaigns, manage drafts, and get paid through escrow. Editorial visual identity (Fraunces + Inter + JetBrains Mono, terracotta accent on cool-paper or warm-ink). South Asia / Pakistan-aware data model.

The current build is a **fully wired prototype** — everything looks and behaves like a production app, but mocks the backend (in-memory + localStorage Zustand store, mock OAuth, mock Stripe/escrow, mock LLM endpoints). The mock API surface is signature-stable so a real backend swap requires changing only `lib/api/client.ts` internals.

---

## 🎯 Deal-page redesign — phase tracker

After Phases 19-23 closed out 95+ original audit findings, a structural
UX problem remained: a single deal lives across 5-7 surfaces
(CampaignDetail / Today / Inbox / Content / Approvals / Earnings /
Wallet), each rendering ~80% of the same data differently. The redesign
treats the **deal** (campaign × creator pair, post-offer) as the
primary unit of UX, replacing those scattered surfaces with one
canonical deal page.

**Current state at a glance:**

| Phase | Theme | Status |
|---|---|---|
| **24** | Foundations: deal-id, state machine, action verbs, ranking, hook, stub route | ✅ Shipped |
| **25** | Deal page implementation: action banner per state × role, files, chat, brief, money, timeline | ✅ Shipped |
| **26** | Today rebuild: flat ranked queue (rebuilds creator/brand Today screens) | ✅ Shipped |
| **27** | Brand campaign roster: replaces 4-tab CampaignDetail with deal-row list | ✅ Shipped |
| **28** | Admin unified queue: queue/verify/disputes merge under one tabbed surface | ✅ Shipped |
| **29** | Delete dead screens: brand/CampaignDetail, brand/Home, brand/Approvals, creator/Home; sidebar nav simplified | ✅ Shipped |
| **30** | Final polish: orphan cleanup, inline OfferModal + DisputeResolveModal on deal page, click-count comparison, screen map | ✅ Shipped |
| **31** | Tests + perf: 101 pure-function tests via vitest, indexed db cache cuts collectTodayDeals from 3,665ms → 507ms at 10k deals | ✅ Shipped |
| **32** | Landing page upgrade: motion library + Upfluence-inspired patterns (flywheel stats, results grid, brand carousel, trust badges) | ✅ Shipped |
| **33** | Direction-B prototype: two self-contained HTML hi-fi mocks (cinematic hero + Act II money flow) via huashu-design skill, visual direction locked | ✅ Shipped |
| **34** | Cinematic foundation: palette + atmospheric backdrop + drift motes + `<CinematicScene>` scroll-pin engine + persona-morph context | ✅ Shipped |
| **35** | Hero scene + Act I (Discovery) constellation: real-seed stat strip, persona-aware copy, 18-item haystack narrowing to 5 fits | ✅ Shipped |
| **36** | Act II (Workflow) horizontal-rail timeline + Act III (Multi-platform) tiles + dashboard with SVG traces, all real seed data | ✅ Shipped |
| **37** | Act IV (Receipts) ROAS+rating+money panels + Coda (3 voices, brand strip, FAQ, final CTA) | ✅ Shipped |
| **38** | Atmosphere & polish: ::selection, focus rings, smooth scroll, dark scrollbar, scroll-snap, Hero TOC sweep underlines, final-CTA accent ring | ✅ Shipped |
| **39** | Performance + mobile: CinematicScene static fallback at <=720px (no scroll-pin), DriftMotes DPR cap, comprehensive reduced-motion guards across HeroScene + Coda | ✅ Shipped |
| **40** | Final QA: legacy CoverLegacy.tsx + 15 Phase-18 landing components deleted, build clean, 101 tests passing | ✅ Shipped |
| **30** | Final QA + polish + before/after click-count comparison + PROGRESS doc rollup | ⏳ Pending |

**Backup snapshot** of pre-redesign state at
`_backup-pre-deal-redesign-2026-05-05/` (2.3 MB, with `RESTORE.md`
containing copy-paste revert commands). The redesign is fully
revertible at any point.

**Net route count:** 30 → 22 routes (≈27% fewer), but the qualitative
win is bigger — any deal lives on one canonical surface vs scattered
across 5-7 today.

**Nothing built in Phases 19-23 is wasted** — Lightbox, presence, diff
view, hotkeys, undo toasts, label maps, EmptyArt, tax bands, templates,
outcome forecast, multi-format Lightbox, PDF media kit all repurpose
naturally onto the new surfaces.

---

## Progress summary

### Phase 0–2 · Foundation
- Vite + React 18 + TypeScript scaffold at `/app/`
- Editorial design tokens ported from the original HTML/CSS prototype (`tokens.css`, `base.css`, `components.css`, `layout.css`)
- Single source of truth: Zustand store with localStorage persist + cross-tab sync via storage events
- Mock API client (`api.auth`, `api.campaigns`, `api.applications`, `api.offers`, `api.submissions`, `api.messages`, `api.wallet`, `api.notifications`, `api.reviews`, `api.brand`, `api.platforms`, `api.settings`, `api.disputes`, `api.ads`, `api.referrals`, `api.advances`, `api.manager`, `api.admin`)
- Auth: email/password + magic-link mock, session persistence, role-gated routes (creator / brand / admin)

### Phase 3 · Brand workspace
8 fully wired brand screens:
- **Home** — KPIs from real wallet/escrow/spend, active campaigns list, pending approvals, recent applications, quick actions
- **Campaigns** — 8-column kanban, search + tabs, calendar tab, **New campaign builder** (4 steps: brief / budget / rights / review), per-campaign **detail drawer** with brief / applications / shortlist & offers / tracking / history
- **Find creators** — filter by tier + verified, multi-select shortlist, **AI Match concierge**, per-card and bulk **Send offer**, **Compare** modal (2–5 creators side-by-side)
- **Approvals** — pending/all tabs, per-submission review modal, approve releases escrow + advances to Posted
- **Inbox** — shared two-pane chat, attachments + saved-replies templates
- **Wallet** — balance + escrow KPIs, top-up modal, ledger, CSV export
- **Analytics** — aggregate KPIs, per-campaign table, top creators by reach delivered, CSV export
- **Profile** — sectioned (Company / Preferences / Team / Verification), team-seats invite/remove, NotificationPrefsCard

### Phase 4 · Creator workspace
8 fully wired creator screens:
- **Home** — KPIs, active campaigns, pending invites, recommended live, profile completion, inbox preview, performance
- **Discover** — live-campaign filter + search, **Apply modal** with rights preview
- **My campaigns** — kanban (Offer / Production / Posted / Reporting / Closed), Applications tab, drawer with **Accept / Decline / Counter** offer flow, **Open dispute** + **Message brand** buttons
- **Content** — per-campaign deliverables tracker (8 lifecycle steps), **AI concepts** generator, upload draft modal, feedback threading
- **Inbox** — shared with brand side
- **Earnings** — KPIs, Tax/YTD card with bar chart + tax estimate, per-brand breakdown, full ledger, **Withdraw** modal, per-payout **Invoice** PDF generator (printable HTML)
- **Analytics** — KPIs, per-platform breakdown, recent campaigns performance
- **Profile** — sectioned (Identity / Audience / Categories / Portfolio / Rates / Verification), portfolio picker, channel-connection mock OAuth, **My Network** referrals card, AvailabilityCard, NotificationPrefsCard

### Phase 5 · Admin
- **Application queue** — review pending creators, approve/reject
- **Verify brands** — toggle verified status
- **Disputes** — full queue + resolution flow (released-to-creator + refunded-to-brand + note)
- **Payouts** — escrow-in-flight monitor + recent releases
- **Audit log** — derived timeline of every campaign transition + transaction, search/filter, CSV export

### Phase 6 · Polish
- Dark mode (theme toggle in sidebar, OKLCH-based dark tokens, color-scheme hints)
- Notification preferences enforced via `pushNotification(d, userId, kind, ...)` helper across all API methods
- Portfolio uploader (stock-picker modal, max 12)
- Availability status (open / limited / booked)
- Tax/YTD view + invoice PDF generation
- Team seats (multi-user per brand, admin/ops/finance roles)
- Global search (⌘K / Ctrl+K, scoped across campaigns/creators/brands/threads/notifications)
- Cross-tab sync (storage event → rehydrate)
- CSV exports (wallet, earnings, audit, analytics)
- Campaign clone, calendar view, comparison modal
- Inbox saved replies + file attachments
- Promise-based Confirm modal (replaced native dialogs)
- Stage-pill loading shimmer
- App-root ErrorBoundary with recovery panel

### Tier 1 · Trust + measurement
- **Audience demographics + fraud detection** — `Platform.audience: AudienceDemographics` (age buckets / gender split / top countries / 30d growth / suspicious-follower % / credibility score 0–100). Visualised on brand-side `CreatorProfileDrawer` and pulled live in `ConnectPlatformModal` review step.
- **UTM-tracked links + conversion analytics** — `Campaign.tracking: CampaignTracking[]` (per accepted creator: tracking URL, clicks, conversions, revenue attributed). New **Tracking tab** on brand campaign drawer with KPI strip + per-creator table including ROAS.
- **Content rights & licensing** — `Campaign.rights: ContentRights` (exclusivity / whitelistAds / repurpose / derivative / organicOnly). New **Step 3** in NewCampaignModal, displayed in apply modal + brand brief tab.
- **Disputes & arbitration** — `Dispute` entity, **DisputeModal** (both sides), **AdminDisputes screen** with resolution form that moves money (escrow → creator wallet, escrow → brand refund, or split). Sidebar badge for open disputes.

### Tier 2 · Growth multipliers
- **AI brief assistant** — pattern-based mock LLM that turns plain-English campaign descriptions into structured briefs (title / pitch / brief / category / region / budget / deliverables). Wired into NewCampaignModal step 1.
- **AI content suggestions** — generates 4 content concepts per active production campaign for creators, with format / angle / outline / why-this-works / reach estimates. Templates differ by category.
- **Whitelisted ads / paid amplification** — when a brand has whitelistAds rights, they can launch a **BoostPostModal** that debits wallet, runs a mock ad campaign, and bumps the creator's tracking metrics. New `ad_spend` transaction kind. History table in Tracking tab.
- **Recurring retainers** — `Campaign.kind: 'one_off' | 'retainer'` + `RetainerConfig` (monthlyRate / termMonths / deliverablesPerMonth / monthsCompleted). New engagement-type toggle in NewCampaignModal step 2 with term-length picker. Retainer banner in brand drawer brief tab. Kanban cards show retainer indicator + months progress.
- **Creator referrals** — `Referral` entity with status flow (invited → active → bonus_paid). New **My Network** card on creator profile (referrals sent + received with bonus tracking). **ReferCreatorModal** with creator search + brand picker + personal note. New `referral_bonus` transaction kind.

### Full QA pass (after skill audit)
Spawned a thorough Explore agent to audit the entire codebase for runtime bugs, cascade conflicts, dead-end UX, recent skill-audit regressions, and empty-state crashes. Findings triaged:

- **False positives discounted**: agent claimed `api.reviews.respond` was missing from the export — verified it IS exported at `client.ts:1042` (`reviews: { leave: leaveReview, respond: respondToReview }`). Also flagged `body::before` grain z-index as potentially overlaying modals — verified modal/drawer/toast/cmdk all have z-index ≥ 80, which sits above the grain (z-index 1). Working as intended.

- **Real fixes shipped (4)**:
  1. **Brand Wallet dead buttons** (`screens/brand/Wallet.tsx`) — `Withdraw` and `Auto-fund settings` were `disabled` with hover-only tooltips. Replaced with a plain "coming next" caption so they don't look broken.
  2. **CSS cascade fix on `.creator-card` transition** — base.css declared `transition: transform, box-shadow, border-color`, but screens.css redeclared `transition: border-color 0.15s` later in the cascade, dropping the new properties. Moved the full transition into screens.css's `.creator-card` definition so the hover lift now smoothly animates.
  3. **Onboarding tour now requires explicit dismissal** — added `blockBackdropDismiss` prop to Modal. When set, backdrop clicks and Escape don't close the modal (Skip / Got it / Next remain). Tour uses this so users can't accidentally swipe past it without seeing the four steps.
  4. **Notifications bell — inline action acknowledgement** — after Accept / Decline / Approve fires successfully, the targeted notification is now marked read in the store and the dropdown auto-closes. Previously the dropdown stayed open with the same notification still visible, creating ambiguity about whether the action worked.

### Frontend-design skill audit (visual-craft pass)
Pulled the [Anthropic frontend-design skill](https://github.com/anthropics/skills/tree/main/skills/frontend-design) and saved a copy at `app/.skills/frontend-design/`. The skill emphasizes: bold aesthetic direction, distinctive typography (explicitly avoid Inter/Roboto/Arial), motion as **one well-orchestrated page-load** rather than scattered micro-interactions, atmospheric backgrounds (grain/texture/depth, not solid color), spatial drama, and never converging on common font choices.

Audit verdict: Alamut's editorial direction is correct but **undercommitted in execution**. Five concrete changes shipped:

1. **Body font: Inter → Switzer** (Fontshare). Switzer is editorially-tuned and pairs with Fraunces. Inter was on the skill's explicit avoid-list. CDN-loaded via `api.fontshare.com`. Inter kept as fallback.
2. **Paper-grain overlay** — fixed-position SVG noise at body::before, ~4.5% opacity light / ~8% dark, `mix-blend-mode: multiply` on light and `screen` on dark. Adds newsprint atmosphere without affecting contrast or clickability (`pointer-events: none`).
3. **Orchestrated page entrance** — staged fade+rise on `.page-head` (0ms) → KPI strip (80ms) → toolbar (120ms) → grids (180–220ms) → cards (240ms). 520ms easing, ~360ms total stagger. Drawers slide-in from right (280ms), modals fade+scale (200ms). Hover-lift on creator cards. Arrow-slide on primary buttons.
4. **Editorial label kicker rule** — every `.label` now ends with a hairline rule that fades into the page (the magazine-section convention). Implemented via `::after` pseudo-element with linear gradient.
5. **Bigger display + drop-cap utility** — `.display` pushed from `clamp(36, 4.4vw, 56)` → `clamp(40, 5vw, 64)` with tighter tracking. New `.dropcap` utility class for long-form briefs/bios (4.4em accent-coloured first letter, classic editorial drop cap).
6. **`prefers-reduced-motion: reduce`** honoured globally — all animations collapse to ~0ms.

The aesthetic direction (editorial talent agency · Fraunces + accent + paper) didn't change. The execution did. Pages now feel intentionally staged, the page has paper feel, and Inter is no longer the body font flagged by the skill.

### Tier 3 · Differentiation
- **Industry rate benchmarks** — `IndustryBenchmarks` widget on Brand Discover. Aggregates accepted-offer rates by `tier × category`, surfaces median + P25–P75 band + sample size. Anonymized; only published when ≥2 deals exist for a (tier, category) bucket. Cuts brand price-discovery cost and creates a defensible data moat.
- **Outcome-based pricing** — new `Campaign.pricingModel: 'fixed' | 'outcome'` + `OutcomePricing { baseFloor, perConversion, capPerCreator }`. Toggle added to NewCampaignModal step 2 with editable structure. Outcome banner rendered in `CampaignDetailDrawer` brief tab and `ApplyModal` so creators see the deal terms before applying. Conversion bonuses release as UTM-tracked sales clear (Tier 1 tracking is the foundation).
- **Creator income protection / advances** — new `Advance` entity + `db.advances[]`. `RequestAdvanceModal` on creator Earnings: borrow up to 80% of pending escrow at a flat 3% fee. `applyAdvanceRepayment(d, creatorId, amount)` is called inside `decideSubmission`'s payout block — every cleared payout auto-deducts toward the active advance until repaid. Active-advance card on Earnings shows progress bar + remaining balance. Notifications: "Advance disbursed", "Payout cleared (after advance repayment)", "Advance repaid".
- **Manager / agent seats** — `Creator.managedByUserId?` + `User.managesCreatorIds?: string[]`. `InviteManagerModal` on creator Profile (new section A · 06 Managers & agents). `api.manager.invite/remove` create or extend a User with role='creator' and `managesCreatorIds[]` including the inviter's creator id. `ManagerActingBanner` in `WorkspaceShell` surfaces a sticky top banner whenever the signed-in user has `managesCreatorIds.length > 0`, listing every creator they're acting on behalf of.

### Tier 4+ · Platform-level improvements
- **Trust score tiers** — new `lib/utils/trust.ts` with `trustForCreator(db, creator)` and `trustForBrand(db, brand)`. Bronze (default), Silver (3+ closed campaigns + 4.2★ avg), Gold (10+ closed + 4.6★ avg + verified). Surfaced as a `TrustBadge` (with hand-drawn gold star / silver check / bronze shield glyphs) in: brand-side `CreatorProfileDrawer` hero, Brand Profile (own trust signals), Creator Profile (own trust signals + storefront link), and the public storefront. Detailed `TrustMetricsCard` exposes completed-campaigns / avg-rating / reply-time / on-time delivery rate / avg revision rounds (creator) or payout reliability % (brand).
- **Public ratings beyond stars** — TrustSnapshot now derives `responseHrs`, `onTimeRatePct` (heuristic from rating), `avgRevisionRounds` (computed from submission rounds), and `payoutReliabilityPct`. All shown in the trust card.
- **Email digest preview UI** — new `EmailDigestPreviewModal` accessible from `NotificationPrefsCard` ("Preview email digest" button). Renders a faithful email frame (From/To/Subject + body) populated from real activity windowed to last 24h or last 7d. Stat tiles count new applications / offers / drafts / payouts. Links to actual notifications. Cadence toggle, empty-state copy ("we won't send an empty digest"), production note about SendGrid wiring.
- **Storefront pages** — public, unauthenticated route `/c/:handle`. `PublicCreator` screen at `screens/storefront/PublicCreator.tsx`. Editorial layout (Fraunces hero with drop cap, KPI strip, trust signals, work archive, audience demographics, channels, rate card, reviews-as-pull-quotes, press, CTA). 404 state for unknown handles. Top-nav has "Brief {first name} on Alamut" CTA targeting `/signup?role=brand`. Footer shows the public URL `alamut.co/c/{handle}`. Navigable from creator's own profile via "Open storefront ↗" link.

### UX/a11y audit pass (skill-driven, 4 priority batches)
Pulled the [ui-ux-pro-max skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) (`.claude/skills/ui-ux-pro-max/`) and ran a structured audit across the platform: navigation, forms, feedback, mobile, accessibility, discoverability. Findings triaged into CRITICAL / HIGH / MEDIUM / LOW. All four batches shipped, then the whole batch was re-audited and 2 follow-up bugs caught + fixed.

#### CRITICAL — keyboard / a11y / mobile blockers (5)
- **Global `:focus-visible` rings** — appended to `base.css`. 2px accent outline with 2px offset on tab-navigated elements; in-set on inputs/textareas/selects so layout doesn't shift. `:focus { outline: none }` keeps the editorial aesthetic clean for mouse users. Specificity-bump rule for `[aria-invalid="true"]:focus-visible` keeps the red error indicator dominant when an invalid field is focused (post-audit fix).
- **Toast ARIA** — `ToastHost.tsx` host gets `role="region"`, bad toasts get `role="alert" + aria-live="assertive"`, others get `role="status" + aria-live="polite"`. Dismiss button bumped to 44×44 hit area. Screen readers now announce errors and successes properly.
- **Touch targets ≥44px** — bell, theme toggle, density toggle, sign-out button all hit WCAG 2.5.5. New `.icon-btn-ghost` utility for modal/drawer close X buttons (4 sites). Hit area expanded; visible icon size unchanged so the editorial feel survives.
- **Mobile sidebar (hamburger + slide-in drawer)** — `WorkspaceShell.tsx` manages a `navOpen` state with route-change auto-close, body-scroll lock, Escape-to-close, and a `alamut:nav-close` window event the sidebar's mobile-only X button fires. Below 900px viewport the sidebar slides in from `transform: translateX(-100%)` to `0`, with a backdrop at z:70 / drawer at z:80 (modals/toasts at 100/200 stay above). Hamburger toggle pinned `position: fixed; top: 14px; left: 14px;`.
- **Form labels associated** — every input in SignIn, SignUp, and the brief/budget steps of NewCampaignModal now has `htmlFor`/`id` pairs. Email inputs got `inputMode="email" autoComplete="email"`; password fields got `autoComplete="current-password"` / `"new-password"`. Errors got `role="alert"` and inputs got `aria-invalid` when validation fails.

#### HIGH — feedback gaps (4)
- **`aria-busy` + spinner on loading buttons** — `Button.tsx` adds `aria-busy={loading}`, swaps the icon for a spinning `.btn-spinner`, applies `is-loading` class with `cursor: wait`. Honors `prefers-reduced-motion`.
- **Step progress in NewCampaignModal** — replaced text-only step row with editorial numbered circles + connector lines. Done = ink fill + check icon, current = accent fill with halo glow, pending = hollow ring. `<ol>` with `aria-current="step"` on the active item. Step names collapse on <600px; circles + connectors stay.
- **Empty-state CTAs standardized** — Brand Approvals, Brand Home (3 cards: Pending approvals, Recent applications, Inbox), Brand Profile (team), Creator Profile (portfolio), Creator Home (invites). Every dead-end "Nothing here" got a button to the next logical action. Approvals also offers "See all submissions" if there are non-pending ones.
- **Inline form errors + on-blur validation** — new `field-error` style with ⚠ glyph; `aria-invalid="true"` triggers a red border + 1px shadow. NewCampaignModal has `errors` map state, title field validates on blur, inline error renders, submit auto-focuses the title field. SignIn + SignUp have email regex on-blur, SignUp adds password length on-blur. Errors clear on next keystroke.

#### MEDIUM — cognitive load + discoverability (5)
- **Search debounce** — new `useDebouncedValue` hook (220ms). Wired into Brand Campaigns, Creator Campaigns, Brand Discover, Creator Discover, Inbox. Filtering no longer fires on every keystroke.
- **Drawer/toolbar tabs on mobile** — below 700px, `.drawer .tabs` and `.toolbar .tabs` switch from `flex-wrap` to horizontal scroll with `scroll-snap-type: x proximity`. Right-edge fade via `mask-image` cues that more tabs are off-screen. Desktop unchanged.
- **Storefront link in brand-side drawer** — accent-coloured "View public storefront ↗" link in the hero column of brand-side `CreatorProfileDrawer`. Brand users now have an obvious path to the public profile they share externally.
- **Income advance discoverability** — Earnings page now shows a prominent accent-bordered card ("You can borrow up to $X against your pending escrow · 3% fee · auto-repays") between the page head and KPI strip when `pendingBalance ≥ 200` and no active advance. The buried "Advance" button in the actions row stays for redundancy.
- **Creator Profile section grouping** — sections declare a `group` (`public` / `business` / `account`). TOC renders 3 group headers with hairline rules between. On mobile the groups flow inline. Same 7 sections, just visually organized.

#### LOW — polish (4)
- **Toast keyboard inset** — `bottom: calc(24px + env(keyboard-inset-height, 0px))` lifts toasts above the on-screen keyboard on iOS 17+ / Chrome Android. Falls back to 24px elsewhere. `padding-bottom: env(safe-area-inset-bottom)` for notched devices. Below 500px viewport, toasts span left-to-right.
- **Modal footer stacking** — below 400px viewport, `.modal-foot` switches to `flex-direction: column; gap: 8px;` with full-width buttons. Plain `column` (not reverse) so DOM order matches visual order — primary stays at the bottom for thumb reach (post-audit fix).
- **Alt text on submission images** — descriptive alt strings on the 3 places that mattered (`Round X preview from {creator} for {campaign}` etc.). Decorative `row-img` thumbnails accompanied by visible row titles correctly remain `alt=""` per WCAG.
- **NotificationsBell quick actions** — Accept / Decline / Approve buttons converted from `<span onClick>` to real `<button type="button">` with new `.notif-quick-action[data-variant="ghost"|"solid"]` class. Now keyboard-focusable, screen-reader-announced as buttons, with hover states and `cursor: pointer`.

#### Audit-of-the-audit (post-batch)
Spawned a follow-up audit to catch what the original could not. Two real bugs caught:
1. The `:focus-visible` accent ring overrode the `[aria-invalid="true"]` red border when an invalid field got keyboard focus — fixed with a more-specific `[aria-invalid="true"]:focus-visible` rule that locks the colour to `var(--bad)`.
2. The narrow-screen modal footer used `flex-direction: column-reverse` which split DOM order from visual order (tab/SR went Cancel→Confirm but visually Confirm appeared first) — switched to plain `column` so primary action sits at the bottom, in DOM order.

False positives discounted: hooks-order in WorkspaceShell (all hooks above any return), missing `useNavigate` in NewCampaignModal (it doesn't navigate, parent does), SignIn ID collision (modes are mutually exclusive due to conditional rendering), z-index conflict between mobile-nav and modal (modal z-index 100 > sidebar 80, layers correctly).

### Dangling-UI sweep (completion pass)
After the UX/a11y audit, the user flagged that several UI surfaces *looked* interactive but didn't actually persist or display correctly end-to-end (e.g. rate card edits not reflecting). Spawned a thorough hunt across every screen + modal for the anti-patterns: fake-toast handlers, disabled buttons with stub captions, form fields that update local state but never save, save buttons that skip fields, display-vs-edit source mismatches, stub screens, modal flows that close without committing. Fixed all 9 categories found:

- **Rate card display priority** — when `rateCards[]` has rows, the legacy 4-row simple rate card now hides entirely (it was visually competing with the per-platform table). Replaced with a green confirmation card: "Per-platform rates are active. Brands see N rows on your profile and storefront." Eliminates the "I edited but it doesn't reflect" confusion.
- **Discard buttons** (creator + brand profile) — were `pushToast('Discarded')` no-ops; now actually reset every local form field back to the current store values (name, handle, bio, categories, rate cards, payout, brand socials, etc.) and confirm with a toast.
- **Notification deep-links extended** — `resolveHref(n)` in `NotificationsBell` now handles three additional meta types: `applicationId` (looks up the parent campaign and routes there), `reviewId` (appends `#reviews` hash for scroll target), and the existing campaignId/submissionId still work. Coverage went from 2 → 4 meta types.
- **Earnings → Edit payout** — was `pushToast('Edit on the Profile screen')`; now navigates to `/creator/profile?section=verification`. Profile screen reads the `?section` query param and auto-opens that section.
- **Verification flow now working** — Government ID + Tax form `<input disabled>` placeholders replaced with real upload affordances. Local state tracks the mock file URLs; "Submit for verification" CTA is enabled only when both are uploaded; on submit it flips `User.status` to `pending_admin_review` and pushes a notification to every admin so it surfaces in the queue. Status banner reflects current state (Verified / Awaiting review / Not started).
- **Brand wallet withdraw** — "Withdraw + auto-fund · coming next" caption replaced with a working Withdraw button + modal. New `api.wallet.withdrawBrand(amount, destination)` mirrors the creator-side withdraw: validates available balance vs. escrow holds, pushes a `payout` transaction, decrements wallet. Destination dropdown (Wise / HBL / Stripe Connect). Auto-fund deferred (genuine new feature, not a fix).
- **Brand socials surfaced** in `CreatorCampaignDrawer` — creators viewing a brand's campaign now see an "About this brand" block with logo, about copy, industry/HQ, website link, and clickable social handles (with verified ✓). Closes the loop: brand edits social platforms in their profile → creator sees them when vetting an offer.
- **Real charts** — `chart-area` placeholder divs in Brand + Creator Analytics replaced with a new `<BarChart>` component (no dependencies, ~120 lines). Brand Analytics: top 8 campaigns by reach. Creator Analytics: monthly reach over the last 12 months from `postedAt` of completed campaigns. Smooth 360ms height transition on mount.
- **Stub.tsx removed** — orphaned placeholder component, no imports anywhere. Outdated "Seats coming next" copy on Brand Profile team section updated to reflect that team seats are live.

Net effect: every clickable surface in the app now does something meaningful, and every editable surface persists + propagates to the places it should display. ~700 lines added across 11 files; build size 714 KB JS / 67 KB CSS.

### Simplification pass — reduce cognitive load for solo creators
Feedback from real users: the platform feels "complicated and cluttered," especially for solo creators trying to find their way around. Ran a structured clutter audit using ui-ux-pro-max + own analysis to identify density problems by category (structural, density, deferral, consistency). Six surgical changes — no features removed, just collapsed / deferred / quieter:

- **Sidebar smart-badge on Content** — new `production` badge counts campaigns where the creator has work pending (no submission yet OR last one needs revisions). Sits silent when there's nothing to do; lights up with a count when there is. Solo creators glance at the sidebar and immediately see what needs their attention without opening every screen.
- **Creator Home: 4 KPIs → 3 + conditional cards** — dropped "Lifetime" KPI (vanity, lives in Earnings YTD), swapped "Reach" for "Active campaigns" (more action-oriented). "Recommended for you" card now hides when the creator has 3+ active campaigns (don't push more work on someone already busy). "Profile · Verification" card hides at 100% completion. Removed the "Performance · Last 30 days" card entirely (duplicate of Analytics). Net: first-load card count drops from 6 to 3–4 depending on state.
- **Earnings YTD collapsible** — the year-to-date breakdown + by-brand split + monthly bar chart used to occupy ~480px of vertical space above the transactions table. Now wrapped in a `<details>` disclosure that defaults closed, with a one-line summary visible (`$X · 12 payouts · est. tax $Y`). The day-to-day view stays focused on cleared/pending balance + advance hint + active advance + transactions.
- **Profile "More settings" disclosure** — Referrals, Availability, Notification preferences moved into a collapsed `<details>` block at the bottom of the page. They were 3 full-width cards taking ~600px. Now one summary line: "Referrals · availability · notification preferences". Most creators don't touch these daily.
- **Page lede tightening** — every creator screen had 1–2 sentence ledes that added ceremony without info. Trimmed to one tight sentence each. Profile: "What brands see when they shortlist you." Discover: "Apply to live briefs. Your profile is your application — no PDFs." Reduces page-head height on every screen by ~14px.
- **Rate card progressive disclosure** (already shipped previously, confirmed working) — when no per-platform rows exist, only the simple 4-field card shows. The moment a creator adds their first row, the simple card hides and a green confirmation appears: "Per-platform rates are active · brands see N rows." No dual-source confusion, complexity revealed only when wanted.

Net effect: same features, ~30% fewer visible elements on first-load home/earnings/profile. The path through the app for "I'm a creator with active work" is: sidebar shows what needs attention → Home shows balance + active count → Campaigns → Content → upload. Everything else (analytics, referrals, settings) is one click away but doesn't compete for attention.

### Visual personality pass (4 batches, ~24 changes)
After feedback that the platform felt "easy to use but visually plain," shipped a deliberate visual overhaul in four batches. Goal: editorial soul stays, but the interface feels alive — chromatic per stage, animated where it adds delight, illustrated where it was bland. All work pure CSS / SVG / vanilla DOM — no new dependencies.

#### Batch 1 · High-impact visual lift
- **Chromatic stage palette** — each campaign lifecycle stage now has its own warm OKLCH hue. Draft (gray), Live (sage), Shortlist (peach), Offer (amber), Production (coral), Posted (sky), Reporting (plum), Closed (warm gray). Drives kanban column accents, name colors, count badges, and card hover tints. Both brand + creator kanbans tag columns with `stage-{id}` classes, columns export `--stage-hue` + `--stage-tint` as CSS vars consumed by descendants.
- **Aurora hero on landing** — three soft warm gradient orbs (peach, coral, sage) drift slowly behind the landing hero. Pure CSS via `::before`/`::after` + one injected element, GPU-cheap, dark mode adjusts saturation, `prefers-reduced-motion` honored.
- **Bento grid product showcase** — replaced the linear "How it works" 4-step strip with a 6-tile varied-size grid: 8-stage lifecycle (large 2x2) + Trust badges + Escrow flow + AI Match + Storefront preview + Performance mini-chart. Each tile has a per-tile warm radial-gradient tint and hover lift + scale.
- **Editorial confetti** — paper-scrap palette (peach, coral, amber, sage, sky, terracotta), 36 pieces, randomized fall trajectory + rotation. Triggers on creator offer-accept, brand draft-approve (= payout cleared), admin verification approve. Auto-cleans after 1.6s, respects `prefers-reduced-motion`.
- **Onboarding checklist** — floating bottom-left widget for new creators only. Live progress ring (computed from store, not state) showing N/5 done. 5 deep-linked steps: tagline+bio · connect channel · 3 portfolio pieces · set rates · apply to a campaign. Collapsible header, dismissible (persists per-user to localStorage), auto-hides at 5/5.
- **Creator hover preview** — wrap any element with `<CreatorHoverCard>` to add a portal-positioned preview on hover/focus. 260ms open delay, 140ms close delay (lets users move into the card). Shows portrait + handle + tagline + trust badge + tier + verified ✓ + reach/engagement/rating mini-strip + "Open storefront" CTA. Auto-flips above the trigger if it would clip below-fold.

#### Batch 2 · Motion + identity
- **Status pill pulse** — `<Pill pulse>` prop. Animated dot before the label with a glow + radiating ring (1.6s loop). Wired to "Live", "Shortlisting", "Production" stages on both campaign drawers — at-a-glance sense that something's actively happening.
- **Gem-tone semantic palette** — refreshed `--good`/`--warn`/`--bad`/`--info` to richer OKLCH values (emerald / amber / coral / sky), added `--premium` (plum) for verified / Gold-tier surfaces. New `pill-premium` class. Status differences readable at a glance instead of all reading like beige.
- **Toast with undo** — new `pushUndoToast(text, { onUndo, label }, tone, ms)` API. Toast renders an inline Undo button. Click → fires callback, dismisses immediately. Wired into Brand Profile's team-member remove flow — replaced confirm-modal with optimistic remove + 5s reversible toast (Gmail pattern).
- **Branded loader** — replaced generic shimmer skeleton on cold rehydrate with a Fraunces-flavored "A" mark. Two SVG strokes draw in sequence with `stroke-dashoffset` animation, looping every 1.6s. ALAMUT wordmark below pulses in opacity.
- **Kinetic hero type** — second adjective in the landing hero cycles every 3.6s through `serious / paying / vetted / global / closing`. Each new word fades up with a 6px blur clearing to zero in 700ms. Reduced-motion skips the interval entirely.
- **Drawer breadcrumbs** — both Brand and Creator campaign drawers got a breadcrumb above the title: `CAMPAIGNS › {title} › {active tab}`. The tab segment updates live as user clicks tabs. First crumb is clickable (closes the drawer to return to the list), tab segment in accent color.

#### Batch 3 · Visual completion across the platform
- **Per-section ambient hue** — `<div class="shell" data-section="...">` resolves the active workspace area from the route. Each section paints a 1200×600px radial-gradient warm wash at the top of `<main>`, calibrated to ~3-4% saturation. Home/peach · Discover/sage · Campaigns/coral · Content/amber · Inbox/sky · Earnings+Wallet/amber · Analytics+Profile/plum · Approvals/sage · admin queues each get their own. 400ms ease transition between sections, dark mode dials saturation back.
- **Stage-tinted kanban card edges** — every `.kcard` gets a 3px left border using `var(--stage-hue)` from its parent column. Hover lifts (`translateY(-1px)`) with a stage-coloured drop shadow. Coupled with the chromatic palette, the kanban reads as a colour-coded chord at-a-glance.
- **Number ticker** — new `TickerNumber.tsx` (IntersectionObserver-based count-up animation, 900ms ease-out-cubic). Wired into 11 KPIs across Creator Home, Brand Home, and Creator Earnings. Money values use `format={fmtMoneyFull}`, counts use `fmtCount`. Animates exactly once when scrolled into view, never replays.
- **Magic gradient border** — conic gradient ring using `@property --angle` with a 6s linear rotation, paper-warm OKLCH stops (peach → coral → plum → sage → peach), `mask-composite: exclude` for clean rounded corners. Applied to Editor's picks tiles on Brand Discover (replaces static accent border) and Gold tier `<TrustBadge>` — verified Gold creators visibly *earned* that tier.
- **Empty state line-art illustrations** — new `EmptyArt.tsx` with 8 original SVG scenes drawn at 200×200 with hand-stroked feel: inbox, campaigns, approvals, portfolio, team, discover, wallet, general. All `stroke="currentColor"` so they tint with the surrounding ink. 8s subtle drift animation. Wired into 5 most-hit empty states (Approvals, Inbox, Brand Campaigns, Creator Campaigns, both Discovers).
- **Mesh gradient hover on creator cards** — three-stop radial mesh (peach top-left, coral bottom-right, sage top-right) fades in + scales 6% + rotates 2° on hover. Subtle, warm, doesn't fight the editorial direction.

#### Batch 4 · Sticky footer + command palette upgrade
- **Sticky action footer** — `.sticky-action-footer` class with `position: sticky; bottom: 0; backdrop-filter: blur(8px); z-index: 5`. Wraps Save/Discard at the bottom of Creator + Brand Profile so they're always reachable while editing. Includes a meta line ("Edits stay local until you save") and stacks vertically below 700px viewport.
- **Command palette upgrade** — `GlobalSearch.tsx` got a quick-actions group. Role-aware: brand sees New campaign / Top up wallet / Find creators etc.; creator sees Browse live campaigns / My campaigns / Earnings + withdraw / View public storefront (when handle set); admin sees Application queue / Disputes / Audit log. Universal: Toggle theme · Toggle density · Sign out. Actions match against query alongside index hits. Clicking dispatches `onAction()` (imperative, async-aware via Promise.catch) or navigates to `href`. Action items get tinted icon backgrounds. Empty palette shows actions immediately — placeholder updated to "Search or run a command…".

#### Audit-of-the-audit (post-batch QA)
Spawned a thorough Explore agent to audit all 4 batches. Two real bugs caught + fixed:
1. **Conditional false push** in storefront action — `creator?.handle && {...}` would shove falsy values into the actions array if handle was unset. Replaced with explicit `if (creator?.handle) list.push(...)`.
2. **Async action race** in `runHit` — Sign out is async but the palette closed before the promise resolved. Wrapped with `Promise.resolve(...).catch(...)` so errors don't break the UI.

False positives discounted: theme/density subtitle staleness (palette closes after action anyway), sticky footer z-index conflicts (verified non-overlapping with manager banner), 16 NIT items the agent flagged were "verified working" notes.

### Profile + workflow polish (testing pass)
9 fixes from a hands-on testing review:

- **Creator Content tab redesign** — was a single long-scroll dump of every active production campaign with the full 8-step tracker per card. Now: work-state filter tabs (`To upload / In review / Revisions / Approved / Posted`) + accordion-style rows (one campaign expanded at a time). Each row shows campaign + brand + status pill on the collapsed line; full tracker, submission history, AI concepts, and upload action live in the expanded body. Counts update per state.
- **Drawer → Content deep-link** — `CreatorCampaignDrawer`'s "Open Content" CTA now navigates to `/creator/content?cid={campaignId}`. Content reads the param and (a) auto-expands that campaign, (b) switches to "All" tab if the campaign isn't in the current filter, (c) `scrollIntoView` smooth-scrolls.
- **Inbox compose pinned to bottom** — was `height: calc(100vh - 280px); overflow: hidden;` which clipped the compose box on shorter viewports. Now `calc(100vh - 220px)` with `min-height: 600px; max-height: 880px;` so the compose always stays in view. Compose layout restructured: textarea is the visual anchor (raised border, focus ring), templates+attach buttons stack to the right of the Send button. Placeholder names the recipient ("Write a message to {name}…").
- **Creator profile picture upload** — generic `ImagePickerModal` (curated stock pool + paste-URL field) wired into a tappable portrait at the top of Creator Profile. Click portrait → opens picker → updates `creator.portrait` via `tx()`.
- **Per-platform rate cards** — new `RateCardEntry { id, platform, format, rate, notes }` schema. New `Creator.rateCards: RateCardEntry[]` + add/remove row editor on Profile → Rate card section. Storefront, brand-side `CreatorProfileDrawer`, and creator profile fall through to the legacy 4-row `rateCard` only when `rateCards` is empty. Bundle format gets a free-text notes column ("1 Reel + 2 stories + 1 post").
- **Brand logo upload** — same `ImagePickerModal` (kind="logo") on Brand Profile. Click logo → picker → updates `brand.logoMark`.
- **Brand social platforms** — new `Brand.socialPlatforms: BrandSocial[]` + `BrandSocial { name, handle, url, followers, verified }` schema (no audience demographics — brands don't typically have IG insights). New "Social presence" section (A · 03) on Brand Profile with row-by-row editor.
- **Kanban hides empty stages** — both Brand and Creator Campaigns kanban now filter `STAGES.filter(s => byStage[s.id].length > 0)` before rendering. Empty trailing stages disappear when a search/tab combo doesn't have campaigns there. Creator-side dynamic `gridTemplateColumns` recalculates so visible columns expand to fill width.
- **Notification deep-links** — `NotificationsBell.resolveHref(n)` now reads `n.meta` and constructs the right query string before navigating. `meta.campaignId` → `?cid=X` (works on both brand and creator Campaigns); `meta.submissionId` on `/brand/approvals` → `?sid=X`. `BrandApprovals` now reads `?sid` to pre-select the submission and auto-jumps to "All" tab if the submission is outside the current filter. The clicked notification is also marked read on click.

### Polish week (UX improvements)
- **Drawer ↔ URL sync** on Brand + Creator Campaigns. Opening a campaign drawer pushes `?cid=X` to the URL; closing clears it. Browser back/forward and external deep-links both work. Campaigns are now shareable by URL.
- **Density toggle** — sidebar control next to theme + bell. Compact mode tightens page padding, card padding, KPI sizing, kanban cards, table rows, dashboard gaps. Persists to localStorage. Power users with 25+ campaigns / 49+ threads benefit immediately.
- **Brand response to reviews** — `Review.response?: { text, at }` field. New **BrandReviewsCard** on Brand Profile listing every review about the brand with average rating + count of pending responses. Inline respond form per review. Below-4-star reviews flagged with a "worth addressing" pill. Responses display under the original review on the public CreatorProfileDrawer reviews list.
- **Inline notification actions** — `Notification.meta` field carrying `offerId / submissionId / applicationId / campaignId / reviewId`. Quick-action buttons in the notifications dropdown: **Accept / Decline** for pending offers, **Approve** for in-review submissions. Actions fire without navigating away. Wired into `pushNotification(...)` helper for the three highest-traffic notification kinds (new offer, new draft, new application).
- **Recommended-for-you rails on Discover** — at the top of both Discover screens (only when no filter/search is active):
  - **Creator Discover**: ★ Editor's picks (4) + Recommended for you (4 matched to creator's categories), then "All live campaigns" below the rule
  - **Brand Discover**: ★ Editor's picks creators (4 top-tier) + Recommended creators (matched to past campaign categories), then "All creators" below
- **Editor's picks** — `Campaign.editorsPick` and `Creator.editorsPick` flags. Seeded on 4 most recent live campaigns + 3 demo creators (Sarah/Amir/Yuki) + 3 generated Flagship creators. Render with accent border on Discover rails.
- **Onboarding tour** — first-sign-in 4-step modal per role (creator and brand). Step indicator dots, Skip / Back / Next + role-specific deep-link CTA at each step ("Browse Discover", "Start a campaign"). Persists `alamut.tour.{userId}.{role}.done` so it shows once per user per role.
- **Skeleton loading** — CSS `.skeleton` class with shimmer animation. PageSkeleton component wraps Outlet during the brief Zustand persist-rehydrate window. Replaces blank flash on cold loads.

### Seed data
The platform seeds with a deterministic mock dataset designed to feel like 14+ months of activity:

| Entity | Count |
|---|---|
| Users | 214 |
| Creators | 115 (3 demo + 5 pending review + 107 generated) |
| Brands | 96 |
| Campaigns | 245 (across all 8 lifecycle stages, 95 closed) |
| Applications | 3,542 |
| Offers | 414 |
| Submissions | 79 |
| Threads | 371 |
| Messages | 2,032 |
| Transactions | 1,309 |
| Reviews | 490 |
| Notifications | 65 |
| Disputes | 2 (1 open, 1 resolved) |
| Retainer campaigns | 7 |
| Referrals | 8 |

Demo accounts (all `demo1234`):
- `hannah@aesop.test` — primary brand demo (25 campaigns · 336 applications · $48k wallet · $17k escrow · 3 team members)
- `marcus@lecreuset.test` — secondary brand demo (19 campaigns · 280 applications)
- `sarah@alamut.test` — primary creator demo (26 accepted campaigns · 84 applications · $107k lifetime earnings · audience demographics on Instagram + TikTok)
- `amir@alamut.test` — Le Creuset food creator
- `yuki@alamut.test` — Aesop design creator
- `admin@alamut.test` — admin role (~2,000 audit events visible)

---

## Current architecture

```
alamut/
├── PROGRESS.md                    ← this file
├── README.md                      ← original handoff bundle README
├── Alamut Roster Redesign.html    ← original prototype (kept as design reference)
├── Alamut.html                    ← original v3 unified workspace prototype
├── Alamut Design System.html      ← original design system doc
├── Alamut Storefront.html         ← original storefront prototype
├── alamut/                        ← original prototype JSX modules (reference)
│   ├── styles.css
│   ├── data.jsx, shared.jsx, ...
│   └── v3/...
├── chats/chat1.md                 ← original handoff conversation
└── app/                           ← THE LIVE BUILD
    ├── package.json
    ├── vite.config.ts
    ├── tsconfig.json
    ├── index.html
    └── src/
        ├── main.tsx
        ├── App.tsx                ← <ErrorBoundary><RouterProvider/><ToastHost/><ConfirmHost/></...>
        ├── router.tsx             ← createBrowserRouter, role-gated route trees
        ├── styles/                ← tokens, base, components, layout, landing, screens, responsive
        ├── lib/
        │   ├── api/
        │   │   ├── types.ts       ← single source of truth for domain types
        │   │   ├── seed.ts        ← deterministic seed generator (mulberry32 PRNG)
        │   │   ├── store.ts       ← Zustand persist + cross-tab sync + tx<T>() helper
        │   │   └── client.ts      ← mock API client + select{} read helpers
        │   ├── auth/
        │   │   └── useAuth.ts
        │   └── utils/
        │       ├── format.ts             ← fmtMoney, fmtCount, fmtRelative, initials
        │       ├── csv.ts                ← downloadCSV() utility
        │       ├── invoice.ts            ← printable-HTML invoice generator
        │       ├── confirm.ts            ← promise-based confirm bus
        │       ├── toast.ts              ← pub/sub toast bus
        │       ├── trust.ts              ← trustForCreator/trustForBrand + tier metadata
        │       ├── useDebouncedValue.ts  ← debounce hook for search inputs
        │       └── confetti.ts           ← editorial paper-scrap celebration on key moments
        ├── components/
        │   ├── ui/                ← Button, Card, Pill (with `pulse` prop), Modal, Logo, Label, Icon,
        │   │                        ToastHost (with undo support), ConfirmHost, TrustBadge (Gold gets magic-border),
        │   │                        TickerNumber (count-up animation), EmptyArt (8 line-art SVG scenes),
        │   │                        CreatorHoverCard (portal preview)
        │   ├── layout/            ← WorkspaceShell (+ ManagerActingBanner + section ambient hue + branded loader),
        │   │                        Sidebar, ProtectedRoute, NotificationsBell, ThemeToggle, ErrorBoundary,
        │   │                        PageHead, OnboardingTour, OnboardingChecklist (creator new-user widget),
        │   │                        DensityToggle
        │   ├── inbox/             ← InboxView (shared two-pane)
        │   ├── search/            ← GlobalSearch (CmdK + role-aware quick actions: theme, density, sign-out, role-specific shortcuts)
        │   ├── charts/            ← AudienceCharts (age bars, gender split, geo list, credibility badge), BarChart (analytics)
        │   ├── campaign/          ← CampaignDetailDrawer (with breadcrumbs + tab-aware), CreatorCampaignDrawer (with breadcrumbs + brand about block), CampaignCalendar
        │   ├── profile/           ← CreatorProfileDrawer (with storefront link)
        │   ├── widgets/           ← IndustryBenchmarks
        │   ├── settings/          ← NotificationPrefsCard, AvailabilityCard, BrandReviewsCard
        │   └── modals/            ← NewCampaignModal (with step progress + outcome pricing),
        │                            ApplyModal, InviteModal, CounterOfferModal,
        │                            ReviewModal, AIMatchModal, AIBriefAssistantModal,
        │                            AIContentSuggestionsModal, BoostPostModal, ReferCreatorModal,
        │                            DisputeModal, MessageComposeModal, ConnectPlatformModal,
        │                            UploadDraftModal, PortfolioPickerModal, InviteTeamModal,
        │                            CompareCreatorsModal, RequestAdvanceModal, ImagePickerModal,
        │                            InviteManagerModal, EmailDigestPreviewModal
        └── screens/
            ├── cover/Cover.tsx                    ← landing page
            ├── storefront/PublicCreator.tsx       ← public /c/:handle (no auth)
            ├── auth/                              ← SignUp, SignIn (with magic-link mock)
            ├── brand/                             ← Home, Campaigns, Discover, Approvals, Inbox, Wallet, Analytics, Profile
            ├── creator/                           ← Home, Discover, Campaigns, Content, Inbox, Earnings, Analytics, Profile
            └── admin/                             ← Queue, Verify, Disputes, Payouts, Audit
```

### Key architectural decisions

- **No backend yet, but signature-stable mock**: every read goes through `select.*(db, ...)` selectors and every write through `api.*` async functions. Replacing them with real `fetch()` calls is a one-file change.
- **Single Zustand store** persisted to localStorage. Mutations flow through the `tx<T>()` helper that shallow-clones arrays so React re-renders. Cross-tab sync via `storage` event triggers `useStore.persist.rehydrate()`.
- **Notification preferences enforced at the API layer** via `pushNotification(d, userId, kind, text, href)` helper. Every original `d.notifications.push()` call site was migrated.
- **Role gating** done in `ProtectedRoute`. Each role has its own nav config (`CREATOR_NAV`, `BRAND_NAV`, `ADMIN_NAV`).
- **Drawer/modal state isolation**: `key={campaign.id}` on each drawer instance forces remount when the parent's selection changes, preventing offer/message state leaks across campaigns.
- **Notification dropdown via `createPortal`** to escape sidebar overflow.
- **Editorial CSS uses OKLCH + color-mix** — modern browser only. Falls back gracefully on old browsers but the design assumes Chrome 111+ / Safari 16.4+ / Firefox 113+.
- **Build hygiene**: `noUnusedLocals`, `noUnusedParameters`, `strict`. 0 type errors at every checkpoint.

### Build stats (current)

- 134 modules transformed
- 735 KB JS / 204 KB gzipped (+21 KB JS over previous: TickerNumber, EmptyArt, CreatorHoverCard, OnboardingChecklist, confetti utility, command palette actions, undo toast, kinetic hero, sticky footer)
- 88 KB CSS / 16 KB gzipped (+21 KB CSS for: chromatic stages, aurora hero, bento grid, pill pulse, gem-tone palette, branded loader, drawer breadcrumbs, section ambient hue, magic gradient border, mesh hover, empty-art drift, sticky footer, kinetic hero rotator)
- 4–9 second cold builds with Vite
- Store schema version: 11

---

## What's deliberately deferred

These are valid platform features but not yet implemented:

- **Real backend** — would need auth provider (Supabase/Clerk), Stripe Connect for escrow + payouts, real OAuth for IG/YT/TT/Substack, file storage for uploads, websocket for real-time. Mock layer is signature-stable so screens won't change.
- **Multi-currency + i18n** — platform is USD-only and English-only. Pakistan-focused so PKR + Urdu would be the natural first additions.
- **Mobile native app** — responsive web works, but creators mostly work from phones; native experience would be the next significant push.
- **Email + push notifications** — currently bell-only. Real product needs digest emails for both sides.
- **Real LLM integration** — AI Match, AI brief, AI content suggestions all use pattern-based mocks. Hooking up Claude/OpenAI would dramatically improve quality.
- **Real audience analytics OAuth** — pulled metrics are mocked. Real Instagram Graph API + YouTube Analytics + TikTok Business API integrations are hours of work each.

---

## Next steps

> **Note** · This section captures the roadmap as it existed at the start
> of the visual-rework arc. Most of these items shipped across Phases 1–17
> below — see those phase logs for what was actually built and how. The
> truly-remaining items are consolidated in the **Open follow-ups** section
> at the very bottom of this file.

### Tier 3 · Differentiation — done (this pass)

4 of 5 shipped (industry rate benchmarks, outcome-based pricing, income advances, manager seats). The fifth — **verified audience demographics via real OAuth** — is the only Tier 3 item that requires a real backend (IG Graph API + YT Analytics + TT Business API), so it's deferred with the rest of the OAuth work.

### Platform-level improvements (Tier 4+) — done (this pass)

4 of 6 shipped (trust score tiers, public ratings beyond stars, email digest preview, storefront pages). The remaining 2 require real backend / native build:

- **Mobile native app** — bottom nav, swipe gestures, offline drafts (deferred; needs React Native or Capacitor build)
- **API access for enterprise** — pull campaign data into MMM models / BI dashboards (deferred; needs real backend with API keys, rate limiting, OpenAPI spec)

### UX polish week — done (this pass)

All 8 items shipped (see "Polish week" under Progress summary above).

### Remaining UX polish ideas (future)

- **Inline counter-offer** in the notifications bell (currently only Accept/Decline; a Counter button that opens the existing CounterOfferModal would close the loop)
- **Bulk actions** on Approvals (multi-select drafts → approve in one go)
- **Saved filter views** on Find creators ("Top food creators in Pakistan, 100k+ reach")
- **Comparison persistence** — currently the compare modal is ephemeral; a saved comparison lets a brand revisit
- **Email digest preview** in NotificationPrefsCard so users see what their digest would look like
- **Theme persistence per device, not per user** (currently global) — system-respect option
- **Reduce motion** preference for users with vestibular sensitivity
- **More aggressive empty-state CTAs** on screens that depend on prior actions (Content with no production, Earnings with $0 lifetime, etc.)

### UI improvement backlog (status updated after Phase 17.5)

| # | Item | Status | Notes |
|---|---|---|---|
| 1 | Display moments / bigger page heads | ✅ DONE | h1 pushed to clamp(40, 5vw, 64), tighter tracking |
| 2 | Real charts replacing placeholders | ✅ DONE | Phase 7 added `Sparkline`; Phase 12 fully reworked Brand + Creator Analytics with sparklines + chromatic monthly bars + horizontal-bar breakdowns |
| 3 | Motion (drawers, modals, hovers) | ✅ DONE | Orchestrated page entrance + drawer slide + modal fade-scale + hover lift + arrow slide; reduced-motion guards everywhere |
| 4 | Empty-state illustrations | ✅ DONE | `EmptyArt` SVG line-art used across Discover / Approvals / Inbox / Campaigns; per-context empty copy throughout |
| 5 | Cards differentiated by type | ✅ DONE | Phase 1 chromatic stage palette → kcards have stage-hue left border; Phase 3 list rows + Phase 11 approval tiles + Phase 17 AI rank rows all pick up stage hue |
| 6 | Data viz in tables | ✅ DONE | Phase 12 Analytics + Phase 10 money screens use horizontal bars; Phase 9 Discover ranks with score meters; Phase 7 funnel chart |
| 7 | Custom sidebar icons | ✅ DONE | Editorial-weight `Icon.*` set in `Icon.tsx`; replaced Lucide-style |
| 8 | Button + form polish (focus rings, press states) | ✅ DONE | Phase 16 a11y pass — `:focus-visible` rings on every interactive element via base.css; Phase 17.5 added Modal focus trap + drawer Escape |
| 9 | Photography curation | 🟡 PARTIAL | Existing Unsplash pool used consistently; not actively re-curated but feels coherent |
| 10 | Mobile UI redesigned (not just responsive) | 🟡 RESPONSIVE | All workspace surfaces collapse cleanly at ≤700/800/1100px breakpoints (Phase 14 mobile audit). Native bottom-nav / sheet patterns deferred to a real product build |
| — | Body font swap (Inter → Switzer) | ✅ DONE |
| — | Paper-grain atmospheric overlay | ✅ DONE | Phase 1 |
| — | Editorial label kicker rule | ✅ DONE |
| — | Drop-cap utility for long-form | ✅ DONE |
| — | `prefers-reduced-motion` guard | ✅ DONE |
| — | Universal tile pattern with cursor halo | ✅ DONE | Phase 1 + 6 |
| — | Drag-and-drop kanban + keyboard fallback | ✅ DONE | Phase 13 + 16 |
| — | Bulk actions + saved views | ✅ DONE | Phase 13 |
| — | AI assist (rank, pricing, TL;DR) | ✅ DONE | Phase 17 |

Items 9-10 are not blocking — the platform looks and works great as-is.
A real production build would invest in 9 (curated photography) and 10
(native mobile shell).

### Production readiness path

If a real backend is the next milestone, recommended order:

1. Stand up Supabase or similar — replicate the `Database` interface from `types.ts` as Postgres tables, add RLS policies for role-based access, mirror the seed via a one-time migration
2. Replace `lib/api/client.ts` internals with real `fetch()` calls (signatures unchanged → screens untouched)
3. Add Stripe Connect for actual escrow + payouts
4. Replace mock OAuth flows in `ConnectPlatformModal` with real provider integrations
5. Add S3/R2 file storage to replace stock-picker mocks in `UploadDraftModal` and `PortfolioPickerModal`
6. Add a websocket layer (or Supabase realtime) for live updates beyond the current cross-tab `storage` event

The mock store + mock API give you a head start on shape and behavior; what remains is the wiring.

---

## Running locally

```bash
cd alamut/app
npm install        # one-time
npm run dev        # starts Vite at http://localhost:5173
```

Sign in via the demo buttons on the sign-in page, or create a fresh account.

To reset state: dev tools → Application → Local Storage → delete the `alamut.v1` key → refresh.

To bump the data version (forces re-seed for everyone): increment the `version` in `src/lib/api/store.ts`.

---

# Visual & Architectural Rework — phased log

This section tracks a four-phase rework triggered by three user-flagged
problems with the workspace:

1. **The kanban for campaign management felt sparse and untrustworthy** for
   real pipeline triage. We wanted the density of Linear / Pipedrive /
   HubSpot, not a wireframe-grade trello clone.
2. **The whole platform felt paper-flat** — solid black or white surfaces,
   nothing dimensional. Brief: *"every UI element is purposefully divided
   into any size of tiles … on a cool modern background … be very
   minimalist of course nothing flashy."*
3. **The 480px right-side drawer was too cramped** to manage 8 campaign
   stages × dozens of applicants per campaign.

Phases 1 and 2 are shipped. Phases 3 and 4 are designed and queued.

---

## ✅ Phase 1 — Atmospheric canvas + universal tile pattern (shipped)

**Goal.** Unify the whole platform under a single 3D treatment: opaque
tiles floating on an atmospheric background, with cursor-aware halos and
per-section ambient hue. Glass effects reserved for floating chrome
(modals, drawers, sticky headers, search) — never for content tiles
where they tank Fraunces serif contrast.

### Tokens (`app/src/styles/tokens.css`)

Added atmospheric + tile elevation tokens for both themes:

```css
/* Light theme */
--bg-canvas: oklch(0.97 0.005 60);
--bg-mesh-1: oklch(0.93 0.07 60  / 0.55);   /* warm */
--bg-mesh-2: oklch(0.92 0.08 30  / 0.45);   /* coral */
--bg-mesh-3: oklch(0.93 0.06 145 / 0.40);   /* sage */
--tile-surface: var(--surface);
--tile-border:  color-mix(in oklab, var(--ink) 7%, transparent);
--tile-highlight: color-mix(in oklab, white 70%, transparent);
--tile-shadow:
  0 1px 0 var(--tile-highlight) inset,
  0 1px 2px -1px color-mix(in oklab, var(--ink) 10%, transparent),
  0 8px 24px -16px color-mix(in oklab, var(--ink) 28%, transparent);
--tile-shadow-hover:
  0 1px 0 var(--tile-highlight) inset,
  0 2px 4px -1px color-mix(in oklab, var(--ink) 12%, transparent),
  0 16px 40px -20px color-mix(in oklab, var(--ink) 36%, transparent);

/* Dark theme overrides */
--bg-canvas: oklch(0.16 0.012 270);
--bg-mesh-1: oklch(0.28 0.07 60  / 0.45);
--bg-mesh-2: oklch(0.26 0.08 30  / 0.40);
--bg-mesh-3: oklch(0.28 0.06 145 / 0.30);
--tile-surface: oklch(0.22 0.010 270);
--tile-border:  color-mix(in oklab, white 8%, transparent);
--tile-highlight: color-mix(in oklab, white 8%, transparent);
--tile-shadow:
  0 1px 0 var(--tile-highlight) inset,
  0 1px 2px -1px color-mix(in oklab, black 50%, transparent),
  0 12px 28px -18px color-mix(in oklab, black 70%, transparent);
```

### Atmospheric body canvas (`app/src/styles/base.css`)

Removed solid `var(--paper)` from `html / body / #root`; body now paints a
fixed-attached three-blob radial-gradient mesh over `--bg-canvas`. Tiles
sit *above* this layer with their own opaque surfaces, so text contrast
is never compromised.

```css
body {
  background:
    radial-gradient(ellipse 800px 600px at 10% -10%, var(--bg-mesh-1) 0%, transparent 60%),
    radial-gradient(ellipse 700px 600px at 95% 30%, var(--bg-mesh-2) 0%, transparent 65%),
    radial-gradient(ellipse 900px 700px at 30% 110%, var(--bg-mesh-3) 0%, transparent 65%),
    var(--bg-canvas);
  background-attachment: fixed;
}
```

### Universal tile utility (`app/src/styles/components.css`)

```css
.tile {
  background: var(--tile-surface);
  border: 1px solid var(--tile-border);
  border-radius: var(--radius-md);
  box-shadow: var(--tile-shadow);
  position: relative;
}
.tile-interactive {
  transition: transform 0.18s cubic-bezier(.22,.8,.15,1), box-shadow 0.18s, border-color 0.15s;
  isolation: isolate;
}
.tile-interactive::after {
  content: "";
  position: absolute; inset: 0;
  border-radius: inherit;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.32s ease;
  background: radial-gradient(
    240px circle at var(--mx, 50%) var(--my, 50%),
    color-mix(in oklab, var(--accent) 18%, transparent) 0%,
    transparent 65%
  );
  z-index: 1;
}
.tile-interactive:hover {
  transform: translateY(-2px);
  box-shadow: var(--tile-shadow-hover);
  border-color: color-mix(in oklab, var(--accent) 35%, var(--tile-border));
}
.tile-interactive:hover::after { opacity: 1; }
```

### Surfaces converted to tiles

| Surface              | File                   | Notes                                                  |
| -------------------- | ---------------------- | ------------------------------------------------------ |
| `.card`              | components.css         | Now uses tile tokens; previously flat                  |
| `.empty`             | components.css         | Empty states are tiles                                 |
| `.kpi-strip`         | layout.css             | KPI strips are tiles                                   |
| `.page-head`         | layout.css             | Page head is a tile (was flat-with-bottom-rule)        |
| `.side` (sidebar)    | layout.css             | Inset right-edge highlight + soft drop shadow          |
| `.kcard` (kanban)    | screens.css            | Per-stage `--stage-hue`, cursor-aware tinted halo      |
| `.inbox` panes       | screens.css            | Tile tokens                                            |
| `.onb-section`       | screens.css            | Each onboarding block is its own raised tile           |

### Cursor-aware halo (`app/src/components/layout/WorkspaceShell.tsx`)

A single delegated `pointermove` listener writes `--mx`/`--my` CSS vars to
whichever tile the cursor is over. CSS reads those vars to render a soft
accent halo following the cursor — `.kcard::after`, `.creator-card::before`,
`.tile-interactive::after`. rAF-throttled.

```ts
const TILE_SEL = '.kcard, .creator-card, .tile-interactive, .bento-tile';
const onMove = (e: PointerEvent) => {
  if (rafId) return;
  rafId = requestAnimationFrame(() => {
    const tile = (e.target as HTMLElement | null)?.closest(TILE_SEL) as HTMLElement | null;
    if (!tile) return;
    const r = tile.getBoundingClientRect();
    tile.style.setProperty('--mx', `${((e.clientX - r.left) / r.width) * 100}%`);
    tile.style.setProperty('--my', `${((e.clientY - r.top) / r.height) * 100}%`);
  });
};
```

### Per-section ambient hue

`data-section` on `.shell` (set from the route) tints each workspace area
with a barely-there hue: home / discover / campaigns / content / inbox /
earnings / wallet / analytics / profile / approvals / queue / disputes /
payouts / audit / verify. The body atmospheric mesh shows through under
the per-section tint by removing the solid `var(--paper)` from
`.shell[data-section] .main` (both light and dark variants).

### Chromatic stage palette (`app/src/styles/screens.css`)

```css
.stage-draft      { --stage-hue: oklch(0.65 0.01 70);  --stage-tint: oklch(0.96 0.005 70); }
.stage-live       { --stage-hue: oklch(0.55 0.13 145); --stage-tint: oklch(0.95 0.05 145); }
.stage-shortlist  { --stage-hue: oklch(0.60 0.13 60);  --stage-tint: oklch(0.95 0.06 60); }
.stage-offer      { --stage-hue: oklch(0.60 0.15 80);  --stage-tint: oklch(0.95 0.08 80); }
.stage-production { --stage-hue: oklch(0.60 0.16 30);  --stage-tint: oklch(0.95 0.06 30); }
.stage-posted     { --stage-hue: oklch(0.55 0.12 220); --stage-tint: oklch(0.95 0.05 220); }
.stage-reporting  { --stage-hue: oklch(0.55 0.10 320); --stage-tint: oklch(0.95 0.05 320); }
.stage-closed     { --stage-hue: oklch(0.55 0.01 70);  --stage-tint: oklch(0.94 0.005 70); }
```

Each kanban column wears its stage hue on the top border + col name + count
pill. Each `.kcard` wears it on a 3px left border + a stage-tinted
cursor-aware halo. Subliminal wayfinding across stages without shouting.

### Phase 1 build size (snapshot)

`736 KB JS / 92 KB CSS / 134 modules`

---

## ✅ Phase 2 — Full-page campaign detail + applicant kanban (shipped)

**Goal.** Replace the cramped 480px right-side drawer with a dedicated
route `/brand/campaigns/:id` that gives brands room to manage every
applicant across the campaign lifecycle. Inspired by GitHub/Linear's
"metadata sidebar + body discussion" template and HubSpot/Salesforce's
"related list" pattern for high-cardinality associations.

### New screen — `app/src/screens/brand/CampaignDetail.tsx`

A three-zone layout:

1. **Sticky header** — glassy chrome that floats above body atmosphere:
   - Breadcrumb (`Campaigns › {title}`)
   - Cover thumb + title + status pill (with `pulse` for live/shortlist/
     production stages) + edition meta
   - 6-cell KPI strip: budget · spent · escrow · applicants · accepted ·
     ⚡ awaiting-you (only when in-review submissions exist; pulses)
   - 8-stage progress strip (clickable to advance, busy shimmer when
     transitioning)
   - Tab strip: Overview · Pipeline · Files · History (with counts)
   - Rail toggle button
   - Stage-tinted hairline at top edge as chromatic wayfinding

2. **Main body** (tabbed, default tab depends on campaign stage):
   - `draft` → Overview
   - `live / shortlist / offer / production` → Pipeline
   - `posted / reporting` → Overview
   - `closed` → History

3. **Right rail** (collapsible, sticky on >1100px viewports):
   - Brief excerpt + "read full brief →"
   - Deliverables
   - Pipeline counts (with stage-tinted dots)
   - Escrow held / released / of budget + dual-bar progress
   - Quick links to Approvals · Wallet · Analytics filtered to this
     campaign

### Pipeline tab — applicant kanban (centerpiece)

Six columns derived per-applicant from `applications + offers + submissions
+ acceptedCreators`:

| Stage         | Hue                        | Source                                                    | Card actions                            |
| ------------- | -------------------------- | --------------------------------------------------------- | --------------------------------------- |
| Applied       | warm gray (oklch 0.65 70)  | `application.status === 'submitted'`                      | Decline · Shortlist                     |
| Shortlisted   | gold (oklch 0.60 60)       | `status === 'shortlisted'` AND no offer yet               | Send offer                              |
| Offer out     | amber (oklch 0.60 80)      | `offer.status === 'pending' OR 'countered'`               | Re-offer / Accept counter               |
| Accepted      | sage (oklch 0.55 145)      | `offer.status === 'accepted'` AND no submission yet       | (passive) Escrow held pill              |
| In review     | coral (oklch 0.60 30)      | latest submission `in_review` OR `revisions`              | Request revisions · Approve             |
| Delivered     | blue (oklch 0.55 220)      | latest submission `approved` OR campaign closed           | (terminal) Approved · paid              |

`ApplicantCard` is a single component that renders different bodies and
actions per stage — pitch preview for Applied, status pill + counter UI
for Offer, file count + decision buttons for In review, etc. Each card is
an opaque tile with a 3px left border in the column's stage hue. Click
the portrait/name → existing `CreatorProfileDrawer` slides over (peek
without losing context).

Rejected applicants don't appear in any column — they're filtered at the
row build step.

### Overview tab

- Retainer card (when `kind === 'retainer'`) with monthly / total / months-
  done / cadence + progress bar
- Outcome-pricing card (when `pricingModel === 'outcome'`) with base floor
  / per-conversion / cap
- Brief tile with deliverables + dropcapped long brief + content rights
  table
- Milestones table (stage triggers, descriptions, amounts, release dates)
- Accepted creators list (with review CTA when campaign closed)
- UTM-attributed performance KPI strip + per-creator tracking table with
  ROAS and copy-tracking-URL action
- Whitelisted ad boosts table (when rights granted)

### Files tab

Submissions grouped by creator, latest first. Each block is a tile with
the creator portrait header, a row per submission round showing status
pill, file links, notes, and a feedback trail.

### History tab

Merged audit trail combining stage transitions, applications, application
decisions, and offer events. Sorted reverse-chronological with date column
+ label + meta.

### Modals reused

- `Modal` — for Send-offer (rate + message) and Request-revisions (feedback
  text)
- `CreatorProfileDrawer` — peek
- `ReviewModal` — closed-campaign per-creator review
- `MessageComposeModal` — message any applicant inline
- `DisputeModal` — open dispute when accepted creators exist
- `BoostPostModal` — whitelisted ad boost
- `NewCampaignModal` — clone-as-new

### Routing

```tsx
// app/src/router.tsx
{ path: '/brand/campaigns', element: <BrandCampaigns /> },
{ path: '/brand/campaigns/:id', element: <BrandCampaignDetail /> },
```

### Click wiring

- `app/src/screens/brand/Campaigns.tsx` — kanban `kcard` and calendar
  `onOpenCampaign` now navigate to `/brand/campaigns/${id}` instead of
  setting local state to open the drawer.
- New campaign modal redirects to the new full-page route on creation.
- Clone modal does the same.
- Backward-compat: legacy `/brand/campaigns?cid=X` deep links auto-bounce
  to the new route on mount.

### URL state

- `?tab=overview|pipeline|files|history` (omitted when on the per-stage
  default tab to keep URLs clean)

### Removed / orphaned

- `CampaignDetailDrawer` is no longer imported by `Campaigns.tsx`. The file
  remains in the tree (unreferenced) for now in case we want drawer-mode
  back for a quick peek (e.g. from the Inbox). Safe to delete in a
  follow-up cleanup.

### Styles added (`app/src/styles/screens.css`)

~470 lines under the `FULL-PAGE CAMPAIGN DETAIL` section header:

- `.cmp-detail-header` — sticky glassy chrome (one of the few approved
  uses of `backdrop-filter`, reserved for floating chrome). Stage-tinted
  hairline.
- `.cmp-detail-kpis` — 6-cell strip with `.kpi-flag` accent variant for
  the awaiting-you count.
- `.cmp-detail-grid` — main + rail layout, collapses on <1100px.
- `.cmp-detail-rail` — tile sticky to viewport.
- `.pipeline-board` / `.pipeline-col` — 6-column kanban with per-stage
  hue via `--app-stage-hue`.
- `.applicant-card` — opaque tile with stage-coloured left border, hover
  lift, body adapts per stage.
- `.overview-section` / `.retainer-card` / `.outcome-card` — overview
  tiles.
- `.files-list` / `.files-creator-block` / `.files-sub-row` — per-creator
  submission groups.
- `.history-list` / `.history-row` — merged audit trail rows.

### Phase 2 build size (snapshot)

`747 KB JS / 105 KB CSS / 141 modules`
(+11 KB JS, +13 KB CSS, +7 modules over Phase 1.)

---

## ✅ Phase 3 — Campaign list rework + 4-view toggle (shipped)

**Goal.** Replace the all-in-one kanban-only list with the density
treatment Pipedrive / Linear / HubSpot use for pipeline overviews. The
kanban is fine for *seeing across* the lifecycle, but under-serves common
tasks like "what's overdue" and "which campaigns need me right now."

### New utilities — `app/src/lib/utils/campaign-metrics.ts`

Pure helpers shared by every Phase-3 view:

- `parseDeadline(deadline, ref)` — coerces "Today" / "Tomorrow" / "5 days"
  / "Apr 30" / ISO into a Date. Pulled out of `CampaignCalendar` so all
  views agree on deadline parsing.
- `stageEnteredAt(c)` — finds the latest `history` entry matching the
  campaign's current stage; falls back to `createdAt`.
- `daysInCurrentStage(c, ref)` — day-diff from `stageEnteredAt` to ref.
- `isStale(c, ref)` — true when days-in-stage exceeds per-stage SLA:
  `draft 14, live 21, shortlist 5, offer 3, production 14, posted 7,
  reporting 14, closed ∞`.
- `isOverdue(c, ref)` — parsed deadline is in the past (drafts and closed
  excluded).
- `weightedBudget(c)` — `spent + escrowHeld`. The "committed" figure that
  matters more than gross budget when triaging.
- `attentionFlags(c, db, ref)` — `{ inReviewCount, counterOfferCount,
  pendingApplicationCount, hasOpenDispute, overdue, stale }`.
- `needsAttention(flags)` — true if any of the above warrants a glance.
- `funnelMetrics(campaigns, db, ref)` — full per-slice summary: count,
  total/weighted budget, median days, overdue/stale/attention counts,
  total applicants, total accepted.
- `applyFilters / emptyFilters / activeFilterCount` — filter machinery,
  including URL serialization (`filtersToSearchParams` /
  `filtersFromSearchParams`).
- `rowMetrics(c, db, ref)` — packed bundle for a single list row.
- `REF_DATE = 2026-04-27` — the demo's pinned "today" so seed data lines
  up across renders. Real backend would use `Date.now()`.

### New view — `app/src/components/campaign/CampaignListGrouped.tsx`

Stage-grouped list. Each group is a tile with a chromatic 3px left edge
in the stage hue:

```
▾ Live  · 4 · Total budget $42k · Committed $18.5k · Median in stage 3d   [3 need you] [1 overdue]
─────────────────────────────────────────────────────────────────────────────────────
[Cover] Spring drop          12 applicants · 3 accepted · 3d · Apr 30   $12k    [⚠ 2 to review]
[Cover] Newsletter blast      7 applicants · 0 accepted · 1d · In 5d     $5k
[Cover] TikTok hook test ⚡   18 applicants · 4 accepted · 5d · 2d overdue  $15k  [counter] →
```

- Groups collapse on header click. Header is a single `<button>` so the
  whole row is keyboard-accessible.
- Each row navigates to `/brand/campaigns/:id`.
- Days-in-stage colours up: warm at ≥5d, red when stale.
- Deadline column auto-formats to `Today` / `Tomorrow` / `In Nd` /
  `Nd overdue` / raw "Apr 30" depending on proximity.
- Status flags column surfaces dispute, in-review submissions (pulsing),
  and counter offers as inline pills.
- Hidden `is-attention` accent (2px left bar) when any flag fires —
  subtle but noticeable when scanning a long list.
- Responsive — drops Accepted + Deadline columns at ≤1200px, then
  collapses to cover + title + flags at ≤800px (phones).

### New view — `app/src/components/campaign/CampaignTimeline.tsx`

Gantt-by-deadline. One row per campaign, bar from `createdAt` (clamped)
to parsed deadline. Bar coloured by stage hue:

- Three zoom levels: **Month** (7d ticks), **Quarter** (14d ticks, default),
  **Half** (30d ticks).
- Anchor day is "today minus 7" by default so the today-line sits ~25%
  in, giving look-back context.
- A glowing vertical accent line marks "Today" with a pinned label.
- Pan controls (`◀ Today ▶`) shift the window by half its zoom.
- Stage-hue legend at the bottom + "N in view · quarter" pill.
- Bar shows `fmtMoney(budget)` inline when there's room.
- Click → detail page.

### New filter bar — `app/src/components/campaign/CampaignFilters.tsx`

Two-tier control:

1. **Always-visible top row — preset buttons** (one-tap views):
   - **All** — clears all filters
   - **Active** — `live, shortlist, offer, production, posted, reporting`
   - **Needs me now** — `attention=true`
   - **Overdue** — `overdueOnly=true`
   - **Stuck stages** — `shortlist + offer + production` AND attention
   - "Filters [N]" — toggles the more-filters disclosure with badge
     showing active filter count

2. **Stage chip row** (multi-select):
   - 8 chips, each tinted by `--stage-hue`. Active chip wears a
     stage-coloured ring + 3px outline glow. Count next to label.

3. **More-filters disclosure** (tile):
   - Region multi-select (chips)
   - Pricing model: Any · Fixed · ⚡ Outcome · ↻ Retainer
   - "Needs my attention" toggle
   - "Past deadline only" toggle
   - "Clear all filters" button + active-count footer

All filter state syncs to URL: `?stages=live,shortlist&pricing=outcome&attention=1`.
Search is intentionally NOT serialized (stays local).

### Refactored — `app/src/screens/brand/Campaigns.tsx`

- Added `view: 'list' | 'board' | 'calendar' | 'timeline'` URL-synced state
  (`?view=`). `list` is the default and is omitted from URL when active.
- Removed the old `tab: all|active|archive` — its job is now done by the
  preset row in `CampaignFilters` ("All", "Active", "Stuck stages", etc).
- Added a top-of-page mini KPI strip below the page-head: `N campaigns ·
  $X total budget · $Y committed · Z applicants · [N need you]`. Updates
  live as filters change so the brand always knows what slice they're
  looking at.
- The kanban renderer is now an internal `BoardView` component inside
  the same file (the board view is intentionally *not* a separate file —
  it's a fallback view for users who prefer the lifecycle layout).
- Empty states branch on context: zero campaigns, zero matches, or only
  search active. Each has a different CTA (new campaign vs clear
  filters).
- New campaign + clone flows now redirect to the full-page detail.
- Backward-compat redirect: `?cid=X` legacy URL → `/brand/campaigns/:id`.

### CSS appended to `screens.css` (~640 lines)

Under the `PHASE 3 · Campaign pipeline rework` section header:

- `.cmp-page-mini` — top-of-page mini KPI strip with attention flag
- `.cmp-toolbar` / `.cmp-toolbar-right` / `.cmp-view-toggle` — toolbar
  layout
- `.filter-preset` / `.filter-preset.is-on` / `.filter-preset-badge` —
  preset buttons (ink-on-paper when active)
- `.filter-chip` / `.filter-chip.is-on` — stage chips with hue ring +
  outline glow
- `.cmp-filters-more` / `.cmp-filters-section` / `.cmp-filters-toggles` —
  disclosure
- `.cmp-list` / `.cmp-list-group` (with chromatic 3px left edge) /
  `.cmp-list-funnel-h` / `.cmp-list-funnel-name-row` /
  `.cmp-list-funnel-stat` / `.cmp-list-funnel-flags`
- `.cmp-list-row` / `.cmp-list-row.is-attention::before` — 8-column row
  with grid layout that responsively collapses
- `.cmp-list-row-days.is-stale` / `.cmp-list-row-deadline.is-overdue` —
  red signals
- `.cmp-timeline-wrap` / `.cmp-timeline-axis` / `.cmp-timeline-tick` /
  `.cmp-timeline-today` / `.cmp-timeline-todayline` (glowing accent
  bar) / `.cmp-timeline-row` / `.cmp-timeline-bar` / `.cmp-timeline-legend`
- `.cmp-funnel-summary` — inline funnel summary tile (exported helper for
  later reuse)

### Phase 3 build size (snapshot)

`766 KB JS / 119 KB CSS / 145 modules`
(+19 KB JS, +14 KB CSS, +4 modules over Phase 2.)

### Phase 3 verification checklist

- [x] List view groups campaigns by stage, each with funnel header
- [x] Funnel metrics: count, total budget, weighted (committed) budget,
      median days-in-stage, overdue & stale & attention counts
- [x] Rows show: cover, title (+ kind badges), region/category, applicant
      count, accepted count, days-in-stage (coloured), deadline (with
      overdue formatting), budget, status flags
- [x] Preset row: All / Active / Needs me now / Overdue / Stuck stages
- [x] Stage chip row: 8 chips, multi-select, hue-tinted
- [x] More-filters disclosure: region, pricing, attention/overdue toggles
- [x] Active-filter count badge on the Filters button
- [x] Filter state in URL (`?stages=...&pricing=...&attention=1`)
- [x] 4-view toggle: List (default) · Board · Timeline · Calendar
- [x] View persisted to URL (`?view=`)
- [x] Timeline: 3 zoom levels, today-line, pan controls, per-stage hue bars
- [x] Build clean, no TS errors

---

## ✅ Phase 4 — Triage surface (`/brand/today` + `/creator/today`, shipped)

**Goal.** A "needs me right now" inbox for both brands and creators —
the Linear triage / GitHub mentions equivalent. Most days a user opens
the platform asking *"what changed since I last looked?"* The home +
inbox + approvals split made that question hard to answer in one view.

### New utility — `app/src/lib/utils/triage-metrics.ts`

Two pure selectors that aggregate the database into role-specific section
lists:

```ts
brandTriage(db, brandId, ref): {
  awaitingDecision,    // submissions in_review for my campaigns
  counterOffers,       // offers with status='countered' for my campaigns
  newApplications,     // applications with status='submitted'
  stuckCampaigns,      // isStale === true (Phase-3 helper)
  openDisputes,        // status='open' on my campaigns
  overdueCampaigns,    // isOverdue but not already in disputes
}

creatorTriage(db, creator, ref): {
  activeOffers,        // pending or countered for me
  draftsToSubmit,      // accepted offers, no submission yet
  revisionsRequested,  // latest submission status='revisions'
  matchingCampaigns,   // live, my categories/region, not applied (capped 5)
  recentPayouts,       // last 14d of payout|escrow_release
  openDisputes,        // status='open' I'm party to
  pendingApplications, // submitted, awaiting brand decision
}
```

Plus `brandTriageCount` / `creatorTriageCount` — only the *actionable*
sections count toward the sidebar badge (passive lists like "matching
campaigns" don't nag).

### Brand Today — `app/src/screens/brand/Today.tsx`

Six sections:

1. **Awaiting your decision** (warn) — submissions in_review with inline
   approve/request-revisions buttons.
2. **Counter offers received** (warn) — pending counters with inline
   accept-counter.
3. **New applications** (info) — submitted pitches with inline
   shortlist/decline. Capped at 6 with "+ N more in pipeline →" link.
4. **Stuck stages** (warn) — campaigns sitting longer than per-stage SLA.
5. **Open disputes** (bad) — unresolved disputes with details preview.
6. **Past deadline** (bad) — overdue campaigns excluding ones already
   surfaced in disputes.

### Creator Today — `app/src/screens/creator/Today.tsx`

Seven sections (last two only show when populated, not in count):

1. **Active offers** (warn) — pending/countered offers, inline
   decline/counter/accept.
2. **Drafts to submit** (warn) — accepted, no draft yet.
3. **Revisions requested** (warn) — last brand feedback inline.
4. **Open disputes** (bad).
5. **Recent payouts** (good) — last 14d.
6. **New campaigns matching you** (info) — by category or region.
7. **Awaiting brand response** (info) — pending applications.

### Page chrome

- Headline copy bifurcates: "You're all caught up" vs "N things need you"
- Inbox-zero tile with checkmark mark when actionable count == 0
- Each section is a `.triage-section` tile with a 3px coloured stripe
  (`accent-info | accent-warn | accent-bad | accent-good`) matching
  semantics
- Empty section has `✓` toggle prefix and italic empty-hint inline
- Triage rows have cover thumb / id block / actions, with `triage-row-pitch`
  rendering quoted feedback or pitch text in italic with a left rule
- Inline modals reused: `Modal` (request revisions), `CounterOfferModal`,
  `ApplyModal`, `ReviewModal`, `MessageComposeModal`, `DisputeModal`

### Routing & navigation

- Routes: `/brand/today` and `/creator/today`
- Default landing redirected from base paths: `/brand` → `/brand/today`,
  `/creator` → `/creator/today`
- Sidebar adds "Today" as the first item (group: main, icon: spark) with
  `badgeKey: 'today'`
- Sidebar badge driven by `brandTriageCount` / `creatorTriageCount` —
  one number for "what needs me right now"

### CSS

`PHASE 4 · Triage surface` block in `screens.css`:

- `.today-page` — flex-column container with 14px gap between sections
- `.today-zero` — inbox-zero state with branded SVG checkmark
- `.triage-section` with `--accent-hue` driven by `.accent-{info|warn|bad|good}`
- `.triage-section-h` — clickable single-button header with toggle, name,
  count pill, intro
- `.triage-section.is-empty` — softened bg + ink-40 colours
- `.triage-row` / `.triage-row-cover` / `.triage-row-id` /
  `.triage-row-actions` — dense row layout, responsive single-column on
  ≤800px
- `.triage-row-pitch` — italic blockquote-style pitch / feedback display
- `.triage-row-cover-icon` / `.triage-row-cover-good` — for non-image
  rows (disputes, payouts)

---

## ✅ Phase 5 — Creator full-page campaign mirror (shipped)

**Goal.** Symmetry play. Phase 2 gave brands a dedicated full-page route
for managing applicants per campaign. Phase 5 does the same for the
creator side: `/creator/campaigns/:id`, replacing the cramped right-side
`CreatorCampaignDrawer`.

### New screen — `app/src/screens/creator/CampaignDetail.tsx`

Same 3-zone layout (sticky header / main / collapsible right rail), but
the body tabs and rail are flipped to creator priorities:

**Tabs:** `Brief · My drafts · Payouts · History`

**Default tab routing:**
- `closed` → Payouts
- accepted with submission → Drafts
- accepted without submission → Drafts
- has offer (pending/countered) → Brief
- otherwise → Brief

**Top-of-body banner** — surfaces the single most-pressing thing inline
between header and grid:
- Pending offer: amount + message + Decline / Counter / Accept buttons
  (Accept fires confetti + escrow toast)
- Counter sent: counter amount + "awaiting brand response"
- Closed + accepted + not reviewed: review prompt with "Leave review" CTA

**Header KPIs adapt to creator's relationship:**
- Accepted: `My rate · Released · In escrow · Drafts · Action needed flag`
- Has offer (not accepted): `Offer · Status · Drafts`
- Browsing: `Budget · Region · Drafts`

**Brief tab:**
- Retainer / outcome cards (when present)
- "Your application" preview (when applied)
- Brief tile with deliverables + dropcapped long brief + content rights
  table (rephrased for creator: "rights you'd grant" vs "granted to brand")
- "Ready to pitch" CTA when can-apply (live + no app + no offer)

**My drafts tab:**
- Empty state with "Time to ship round 1" CTA → opens Content
- Per-round submission cards with status pill, files list, brand feedback
  trail
- New round button at the top

**Payouts tab:**
- Pre-acceptance: campaign milestone structure with explainer copy
  ("Once accepted, half goes into escrow on accept…")
- Post-acceptance: 4-cell payout strip (Accepted rate · Released · In
  escrow · % complete) + milestone table with release dates

**History tab:** stage transitions reverse-chronological.

**Right rail:**
- About this brand block (logo, about copy, industry/HQ pills,
  verified badge, website link, social platform chips)
- Deliverables
- Your payouts breakdown + release progress bar (only when accepted)
- Quick links: Upload draft (when production), Inbox, Earnings ledger

### Routing

- Route: `/creator/campaigns/:id`
- `creator/Campaigns.tsx` kanban kcard click + applications-table row
  click both navigate to the new route instead of opening the drawer
- Backward-compat: legacy `?cid=X` redirect → `/creator/campaigns/:id`
- `CreatorCampaignDrawer.tsx` deleted (was orphaned after the wire-up)
- `CampaignDetailDrawer.tsx` (Phase 2's predecessor) also deleted

### CSS

`PHASE 5 · Creator full-page campaign mirror` block in `screens.css`,
~95 lines. Reuses the entire `.cmp-detail-*` chrome from Phase 2; adds:

- `.creator-detail-banner` — top banner with `--banner-hue` driven by
  `.accent-warn | .accent-info | .accent-good`
- `.creator-detail-banner-h` / `.creator-detail-banner-amount` /
  `.creator-detail-banner-msg` / `.creator-detail-banner-actions`
- `.rail-brand-logo` — 56px logo
- `.rail-brand-meta` — pills row (industry · HQ · ✓ verified)
- `.rail-brand-socials` / `.rail-brand-social` — clickable social chips

### Phase 4 + 5 build size (snapshot)

`806 KB JS / 126 KB CSS / 148 modules`
(+40 KB JS, +7 KB CSS, +3 modules over Phase 3.)

The two orphaned drawer files were deleted in this phase since they were
already tree-shaken; the bundle size held steady after deletion.

### Verification checklist

- [x] `/brand/today` shows 6 sections with inline actions
- [x] `/creator/today` shows up to 7 sections with inline actions
- [x] Sidebar Today link present with badge driven by triage count
- [x] Default landing redirects to Today for both roles
- [x] Inbox-zero state when no actionable items
- [x] `/creator/campaigns/:id` route works with all 4 tabs
- [x] Top banner adapts to offer state (pending / countered / closed-review)
- [x] Header KPIs adapt to relationship state
- [x] Pre-acceptance payouts tab shows campaign milestones with explainer
- [x] Post-acceptance payouts tab shows creator-specific breakdown
- [x] Counter / accept / decline / review modals all wire correctly
- [x] CreatorCampaignDrawer + CampaignDetailDrawer deleted
- [x] Build clean, no TS errors

### Routes

- `/brand/today`
- `/creator/today`

### Brand sections

1. **Awaiting your decision** — submissions in `in_review` for any campaign
   you own, sorted by oldest first. One-click approve / request-revisions
   inline.
2. **Counter offers received** — `offer.status === 'countered'` for your
   campaigns. Inline accept-counter / re-offer.
3. **New applications** — `application.status === 'submitted'` since you
   last visited (track `lastTriageAt` per user in store). Inline shortlist /
   decline.
4. **Stale stages** — campaigns sitting in a stage for > N days (N varies
   by stage: shortlist=5d, offer=3d, production=10d). Helps unstick the
   pipeline.
5. **Disputes opened against you** — link straight to the dispute view.
6. **Mentions** — messages where someone @-pinged you (future, requires
   message text parsing).

### Creator sections

1. **Active offers** — pending / countered offers awaiting your response.
2. **Drafts due** — accepted campaigns where you haven't submitted a draft
   yet, sorted by deadline.
3. **Revisions requested** — submissions returned with `revisions` status.
4. **New campaigns matching you** — live campaigns in your categories /
   region you haven't applied to.
5. **Payouts cleared** — recent transactions you may want to acknowledge.

### Files to touch

- New `app/src/screens/brand/Today.tsx`
- New `app/src/screens/creator/Today.tsx`
- `app/src/router.tsx` — two new routes, marked as default landing pages.
- `app/src/components/layout/Sidebar.tsx` — add "Today" link at top with
  badge counter.
- `app/src/lib/api/store.ts` — add `lastTriageAt: { [userId]: string }`
  to track "since you last looked".
- New select helpers in `app/src/lib/api/client.ts`:
  - `select.brandTriageItems(db, brandId, lastTriageAt)`
  - `select.creatorTriageItems(db, creatorId, lastTriageAt)`

### UI

Each section is a collapsible tile (default: open if items > 0) with
inline actions on each row. Empty state per section ("All caught up
here") so an empty Today page is satisfying, not depressing.

---

## Open follow-ups (small, do anytime — most resolved)

- ~~The build warns about `toast.ts` being both statically and dynamically
  imported~~ — *resolved by Phase 14 lazy chunks; toast now sits in the
  shared chunk that every route uses.*
- ~~The chunk is 806 KB (gzipped 222 KB). Apply `manualChunks` to split
  vendor from app code.~~ — *resolved by Phase 14 vendor chunking +
  lazy routes; initial download now 243 KB / 69 KB gzipped.*
- Sidebar Today badge currently re-evaluates on every store change (it
  walks every campaign + every submission for the brand triage count).
  Cheap enough at demo scale; for real data, memoize via a Zustand
  selector or compute on a worker.
- Triage "matching campaigns" caps at 5 by recency. Could be smarter —
  surface ones expiring soonest, or with budgets matching creator's
  typical rate.

## ✅ Phase 6 — Public surfaces under tile pattern (shipped)

**Goal.** Phase 1 stopped at the workspace shell — the cover, storefront,
and auth screens were still flat paper. Phase 6 brings the same
atmospheric body + tile elevation + cursor-aware halo treatment to the
four entry surfaces so first-impression and post-auth feel coherent.

### New utility — `app/src/components/layout/TileHalo.tsx`

A standalone version of the cursor-halo wiring that
`WorkspaceShell.tsx` already runs for authenticated pages. Public pages
don't render the workspace shell, so they drop a `<TileHalo />` at their
root. Same delegated `pointermove` + rAF + `--mx`/`--my` pattern.

Selectors covered: `.tile-interactive, .bento-tile, .land-live-card,
.land-feat-card, .land-quote-card, .pcr-tile, .auth-tile`.

### Atmospheric mesh now visible on public pages

`landing.css` `.land { background: transparent; }` (was `var(--paper)`).
The body's three-blob radial-gradient mesh now shows through under the
landing, storefront, and auth shells, matching the workspace.

### `Cover` (landing page) — surfaces upgraded to tile tokens

| Surface              | Treatment                                                                                |
| -------------------- | ---------------------------------------------------------------------------------------- |
| `.land-top`          | Glassy chrome (saturate 140% blur 14px, was a flat paper bar)                            |
| `.land-hero-portrait`| Inset highlight + soft warm shadow                                                       |
| `.land-trust-ribbon` | Pill-shaped tile with shadow (was a top/bottom hairline strip)                           |
| `.land-kpis`         | Single raised tile with internal hairline dividers (was top-of-page rule + bottom rule)  |
| `.land-live-card`    | Tile + cursor halo + accent border on hover (was flat surface)                           |
| `.land-feat-card`    | Tile + cursor halo + accent border on hover                                              |
| `.land-quote-card`   | Tile + cursor halo (was hairline-bordered card)                                          |
| `.bento-tile`        | Tile shadow + cursor halo on top of existing colour-tinted backgrounds                   |
| `.land-twoup`        | Single tile container with internal split (was paper-2 background on right side)         |
| `.land-usp-grid`     | Tile container with internal hairline 3-column grid + cell hover background              |
| `.land-brands-grid`  | Tile container with rounded inner cells (was edge-to-edge bordered grid)                 |
| `.land-faq-list`     | Tile container with internal hairline rows + open-state subtle accent tint               |
| `.land-final`        | Raised tile with top accent gradient (was paper-2 background block)                      |

### `PublicCreator` (storefront) — refactored to `.pcr-*` classes

New CSS block in `landing.css`:

- `.pcr-hero` — single raised tile holding the portrait + bio
- `.pcr-hero-portrait` — strong inset highlight + 28px warm drop shadow
- `.pcr-tile` — generic raised tile with cursor halo (used by review cards)
- `.pcr-work-grid` + `.pcr-work-cell` — cells become hover-lifty
  individual tiles with stage-tinted halos and `tile-interactive` class
- `.pcr-reviews` + `.pcr-review-card` — tile cards with serif-italic
  blockquote
- `.pcr-press` — tile container with internal hairline cells

Inline styles dropped in favour of class-based rules (cleaner cascade,
dark-theme-safe).

### `SignIn` + `SignUp` — split-shell tile upgrade

- `.auth-shell` background made transparent so body mesh shows through
- `.auth-side` now wears a soft accent tint (`color-mix(in oklab,
  var(--accent) 5%, var(--tile-surface))`) plus a top-left aurora orb
  positioned absolutely with `filter: blur(60px)` — matches the editorial
  warmth of the landing hero
- `.auth-side.is-brand` — slightly stronger tint variant
- `.auth-main` — replaces the inline-styled `<main>` wrapper; clean class
- `.auth-tile` — form card now a real raised tile with `--tile-shadow` +
  a 2px top-edge accent gradient (visual continuity with the workspace
  campaign-detail header)
- `.auth-tab` and `.auth-or` — borders / dividers swapped from
  `var(--rule)` to `var(--tile-border)` so they fade naturally over the
  atmospheric mesh
- Mobile breakpoint adjusted to use side bottom-border instead of
  right-border, with corrected paddings

### Files touched

- New: `app/src/components/layout/TileHalo.tsx` (~33 lines)
- Modified: `app/src/styles/landing.css` (~270 lines added under
  `PHASE 6 · …` section, plus ~150 surgical edits to existing rules)
- Modified: `app/src/screens/cover/Cover.tsx` (TileHalo import + render)
- Modified: `app/src/screens/auth/SignIn.tsx` (TileHalo + `.auth-tile`
  class + `.auth-main` class)
- Modified: `app/src/screens/auth/SignUp.tsx` (same)
- Modified: `app/src/screens/storefront/PublicCreator.tsx` (TileHalo +
  `.pcr-hero`, `.pcr-hero-portrait`, `.pcr-work-grid`, `.pcr-work-cell`,
  `.pcr-reviews`, `.pcr-review-card`, `.pcr-press` classes; inline
  styles dropped)

### Phase 6 build size (snapshot)

`806 KB JS / 134 KB CSS / 149 modules`
(+0 KB JS, +8 KB CSS, +1 module over Phase 5 — almost entirely CSS work.)

### Verification checklist

- [x] Body atmospheric mesh visible behind Cover / PublicCreator / Auth
- [x] Cover hero portraits get inset highlight + warm shadow
- [x] Trust ribbon is now a pill-shaped tile
- [x] KPI strip is a unified raised tile
- [x] Bento + live + feat + quote cards all show cursor halo on hover
- [x] FAQ accordion sits in one tile container with internal hairlines
- [x] Two-up creator/brand block is a unified tile
- [x] USP 6-cell grid is a tile container with hover row tint
- [x] Brand wall is rounded tile with internal cells
- [x] PublicCreator hero is a tile, work cells lift on hover
- [x] PublicCreator reviews are raised tile cards with halo
- [x] SignIn/SignUp form is a real raised tile with top accent gradient
- [x] Auth side panel has a warm aurora orb behind the copy
- [x] Build clean, no TS errors, dark-theme parity (all rules use OKLCH
      `color-mix` over tokens, not hard-coded colours)

---

## ✅ Phase 7 — Home dashboards reimagined (shipped)

**Goal.** With Today (Phase 4) handling triage, Home was free to pivot
from "kpi-strip + row-list cards" to a real portfolio / state-of-the-
business overview. Brand Home becomes the Linear-project view + Stripe
balance dashboard. Creator Home becomes a creator's studio: earnings
sparkline, trust ladder, recent reviews, storefront preview.

### New utilities — `app/src/lib/utils/dashboard-metrics.ts`

Pure helpers for the dashboard surfaces:

- `dailySeries(transactions, select, ref, windowDays=90)` — bucket
  transactions into daily totals over a rolling window. Used by both
  spend (brand) and earnings (creator) sparklines.
- `brandActivity(db, brandId, limit)` — merged event stream pulling
  from `history` (stage transitions), `applications` (new + decisions),
  `offers` (sent + responded), `submissions`, `transactions` (escrow
  release / payout). Sorted reverse-chronological. Each event has a
  navigation `href` to the canonical place to act.
- `creatorActivity(db, creatorId, limit)` — same shape, scoped to a
  creator's applications, offers received, submissions made, payouts
  cleared, and reviews received.
- `topCreatorsForBrand(db, brandId, limit=5)` — aggregates accepted
  campaigns + estimated paid amount + avg rating per creator the brand
  has worked with. Sorted by total paid.
- `creatorTrustProgression(db, creator)` — bronze → silver → gold ladder.
  Returns current tier, next tier, 0..1 progress, and per-requirement
  breakdown (`completed`, `rating`, `verified`).

### New components

**`app/src/components/charts/Sparkline.tsx`** — inline-SVG sparkline.
Smoothed cubic-Bezier path, optional area fill (linear gradient under
the line), optional terminal dot, customizable color/height. Sized by
container via `width: 100%` + `preserveAspectRatio="none"`.

**`app/src/components/charts/FunnelChart.tsx`** — pipeline funnel for
brand Home. One row per stage with `--stage-hue` dot + count pill +
proportional horizontal bar (sized by budget or by count). Each row is
a `Link` to `/brand/campaigns?stages=:id` for one-click filter into the
Phase-3 list view. Reuses `funnelMetrics` from Phase 3 to surface
median-days-in-stage as a tail meta chip.

**`app/src/components/dashboard/ActivityFeed.tsx`** — vertical timeline
of merged events. Per-kind tinted dot (`info`/`warn`/`good`/`accent`),
text + amount + relative time, optional detail line, vertical connecting
hairline between dots. Clickable rows wired through to canonical
destinations (`/brand/campaigns/:id`, `/creator/campaigns/:id`,
`/brand/wallet`, etc).

**`app/src/components/dashboard/TrustProgression.tsx`** — 3-step ladder
visualization. Active tier badge gets the chromatic palette + scale up;
reached tiers stay solid; unreached fade. Progress bar to next tier
with tier-coloured fill. Requirements list with `✓`/`○` per item showing
current vs target.

### `BrandHome` refactored

Layout (top → bottom):

1. PageHead with "N active · M closed · $X held in escrow" lede
2. **KPI strip** (4 cells): Wallet cleared · Escrow held · Spent all-time
   · Reach delivered (with `TickerNumber` smooth count-up animation)
3. **Pipeline funnel + Spend last 90d** — 50/50 row of tiles
   - Funnel tile: `<FunnelChart>` + footer summary "N applicants · $X
     committed · median Nd in stage"
   - Spend tile: 30d total + ▲/▼ trend pill vs prior 30 + sparkline
4. **Activity feed + Top creators** — 50/50 row
   - Activity tile: 14 most recent events, scrollable
   - Top creators tile: 5 ranked by total paid, with portrait + accepted
     count + last-worked + paid sum + rating
5. **Quick actions + Drafts + Saved creators** — 3-col row
   - Quick actions: 4 vertical buttons (new campaign, browse, top up,
     edit profile)
   - Drafts: list with title + saved-relative + category, links to
     campaign detail
   - Saved creators: 3-col grid of portrait tiles, hover-lift

### `CreatorHome` refactored

Layout (top → bottom):

1. PageHead with "N active · M closed · $X in escrow" lede
2. **KPI strip** (4 cells): Cleared · Pending · Lifetime · Reach
3. **Earnings 90d + Trust ladder** — 50/50 row
   - Earnings tile: 30d total + ▲/▼ trend + sparkline (payouts +
     escrow_release + referral_bonus)
   - Trust tile: `<TrustProgression>` ladder + progress bar +
     requirements list
4. **Activity feed + Recent reviews** — 50/50 row
   - Activity tile: 14 events including reviews received
   - Reviews tile: top 3 with stars + serif-italic blockquote + brand +
     campaign + relative time
5. **Active work + Storefront + Quick actions** — 3-col row
   - Active work: rich list rows with cover thumb + brand + deliverables
     + stage pill + due date, links to creator campaign detail
   - Storefront preview: portrait + handle + tier + tagline + 4 work
     thumbs + `alamut.co/c/handle` link
   - Quick actions: 4 vertical buttons (browse, upload, withdraw, edit)
     + profile-completion mini-progress (only shown when < 100%)

Both home pages use a new generic `home-tile` class for sections — same
`--tile-shadow` as everywhere else in the app — sitting on the
atmospheric body mesh.

### CSS

`PHASE 7 · Home dashboards (brand + creator)` block in `screens.css`
(~640 lines):

- `.home-page` / `.home-row` / `.home-row-2col` / `.home-row-3col` —
  layout primitives, responsive collapse to 1col at ≤800px
- `.home-tile` / `.home-tile-h` / `.home-tile-title` / `.home-tile-foot`
  — generic tile section primitives
- `.home-spend-amount` / `.home-spend-trend.is-up|.is-down` — large
  serif amount + trend pill
- `.funnel-row` / `.funnel-row-track` / `.funnel-row-bar` — chart row
  with chromatic stage hue, hover background tint, click-through to
  list filter
- `.activity-feed` / `.activity-event` / `.activity-link` /
  `.activity-dot.tone-{info|warn|good|accent}` / `.activity-line` —
  unified timeline with per-kind colour
- `.top-creators` / `.top-creator-row` / `.top-creator-link` — ranked
  list with portrait + name + meta + paid + rating
- `.quick-actions` — flex-column button stack with full-width left-aligned
- `.home-list` / `.home-list-link-rich` — generic list row variants
- `.saved-creator-grid` / `.saved-creator-tile` — portrait grid with
  hover lift + name overlay
- `.trust-progression` / `.trust-ladder` / `.trust-tier-badge` /
  `.trust-progress-bar` / `.trust-reqs` — full trust visualization
- `.home-reviews` / `.home-review` — italic blockquote review cards
- `.home-storefront` + thumbs grid — public profile preview
- `.home-profile-progress` — completion bar at bottom of creator home

### Files touched

- New: `app/src/lib/utils/dashboard-metrics.ts` (~370 lines)
- New: `app/src/components/charts/Sparkline.tsx` (~95 lines)
- New: `app/src/components/charts/FunnelChart.tsx` (~75 lines)
- New: `app/src/components/dashboard/ActivityFeed.tsx` (~75 lines)
- New: `app/src/components/dashboard/TrustProgression.tsx` (~55 lines)
- Rewritten: `app/src/screens/brand/Home.tsx`
- Rewritten: `app/src/screens/creator/Home.tsx`
- Modified: `app/src/styles/screens.css` (+~640 lines)

### Phase 7 build size (snapshot)

`825 KB JS / 147 KB CSS / 154 modules`
(+19 KB JS, +13 KB CSS, +5 modules over Phase 6.)

### Verification checklist

- [x] Brand Home: KPI strip + funnel + spend sparkline render
- [x] Brand Home: activity feed shows merged events with chromatic dots
- [x] Brand Home: top creators ranked by total paid, click-through to
      Discover
- [x] Brand Home: quick actions + drafts + saved creators all wire
- [x] Creator Home: KPI strip + earnings sparkline + trust ladder
- [x] Creator Home: trust progression shows current tier + progress bar
      + per-requirement breakdown
- [x] Creator Home: activity feed includes reviews received
- [x] Creator Home: recent reviews block with serif-italic blockquotes
- [x] Creator Home: storefront preview tile with public link + work
      thumbs
- [x] Creator Home: profile completion mini bar shown only when < 100%
- [x] Both pages: new `home-tile` class uses `--tile-shadow` consistent
      with the rest of the app
- [x] Build clean, no TS errors, dark-theme parity

---

## ✅ Phase 8 — Admin console (shipped)

**Goal.** The five admin screens (Queue, Verify, Disputes, Payouts,
Audit) had been left at the Phase-1 token swap — all wrapped in `Card`
components with hairline-rule headers, and the role had no overview
landing. Phase 8 adds a real `/admin/home` console plus the tile pattern
across all five queue screens.

### New utilities — `app/src/lib/utils/admin-metrics.ts`

Pure helpers for the admin role:

- `adminQueueSummary(db, ref)` — single object with `creatorApplications`,
  `brandVerifications`, `openDisputes`, `escrowInFlight`, `pendingPayouts`.
  Each queue stat carries `count`, `oldestPending`, `oldestPendingDays`,
  `slaBreached`, `recentResolved`. Per-queue SLA thresholds in days:
  creator app 2d, brand verify 3d, dispute 4d.
- `totalActionableCount(summary)` — single number for the sidebar badge.
- `adminActivity(db, limit)` — merged platform-wide event stream:
  resolved disputes, joined creators, verified brands, closed campaigns,
  large payouts (≥$1k).
- `escrowByStage(db)` — group campaigns with active escrow by their
  stage. Used on the Home and Payouts pages.
- `platformSeries(db, kindFilter, ref, windowDays)` — daily transaction
  totals (used by the releases sparkline).

### New screen — `app/src/screens/admin/Home.tsx` (`/admin/home`)

Single-pane console. Layout (top → bottom):

1. **PageHead** with role-aware lede ("All queues clear" vs "N items
   need review")
2. **KPI strip** (4 cells): creator queue count + oldest, brand
   verifications count + oldest, open disputes count + oldest, escrow
   held total. Counts go red when SLA-breached.
3. **Queue tiles** — 4-up grid. Each tile is a chromatic-accent `Link`
   tile with: queue icon + name + SLA pill (when breached) + big serif
   count + meta line ("Oldest 3d" / "✓ Clear") + "N approved this week"
   foot. Cursor halo on hover, arrow slides in. Per-queue hue:
   - Creators: sage (`oklch(0.55 0.13 145)`)
   - Brands: blue (`oklch(0.55 0.12 220)`)
   - Disputes: red (`oklch(0.55 0.18 25)`)
   - Escrow: gold (`oklch(0.60 0.16 60)`)
4. **Releases sparkline + Activity feed** — 50/50 row
   - Releases tile: 30-day total + sparkline + per-stage escrow list
     showing where money sits in the pipeline
   - Activity tile: reuses the Phase-7 `ActivityFeed` component (admin
     events mapped into the generic `ActivityEvent` shape)
5. **Up next** — merged shortlist sorted oldest-first across all three
   actionable queues (creator apps + brand verifications + open
   disputes). Each row gets the queue's hue as a left-border accent on
   hover. SLA-old items (≥3d) get a red age pill.

### Refactored existing admin screens

All five now use the new `.admin-tbl-tile` wrapper instead of `Card`:

- **Queue** — pending creators in a tile with header. Adds inline
  **Approve** button alongside Review (was Review-only behind a modal).
  Per-row SLA pill when ≥2d old.
- **Verify** — brands list in a tile. Verified brands show `Verified`
  pill + Revoke; unverified show inline Verify button. Per-row SLA pill
  when ≥3d old.
- **Disputes** — case list in a tile. Open disputes pulse the status
  pill; primary button on each open row is now solid `Resolve` instead
  of ghost `Review`. Per-row SLA pill when ≥4d old.
- **Payouts** — split into 3 tile sections: 30-day releases sparkline +
  escrow-by-stage list (50/50 row), then in-escrow campaigns list, then
  recent payouts list.
- **Audit** — events list in a tile, otherwise unchanged (already had
  good filter chips).

### Routing & navigation

- Route: `/admin/home` added; `/admin` now redirects to `/admin/home`
  (was `/admin/queue`)
- Sidebar: new "Console" item at top of admin nav (icon: spark, group:
  main) with `badgeKey: 'adminQueue'` driven by `totalActionableCount`
- All five existing admin nav items kept intact for direct access

### CSS

`PHASE 8 · Admin console` block in `screens.css` (~340 lines):

- `.admin-tbl-tile` + `.admin-tbl-h` — generic table-tile with header
  band that has its own subtle background and bottom hairline
- `.admin-queues` — 4-up grid that collapses to 2 then 1 col
- `.admin-queue-tile` — interactive Link tile with chromatic 3px left
  border, cursor halo, arrow slides in on hover, `is-empty` softening,
  `is-breached` red border + count
- `.admin-queue-tile-icon` / `.admin-queue-tile-name` /
  `.admin-queue-tile-count` / `.admin-queue-tile-meta` /
  `.admin-queue-tile-foot` — internal bits with monospace eyebrow +
  serif count
- `.admin-escrow-stages` / `.admin-escrow-stage` — list with chromatic
  per-stage hues, count + total per row
- `.admin-upnext` / `.admin-upnext-link` / `.admin-upnext-age.is-old` —
  shortlist with hover left-border accent in queue hue, red age pill
  when ≥3 days old

### Files touched

- New: `app/src/lib/utils/admin-metrics.ts` (~250 lines)
- New: `app/src/screens/admin/Home.tsx` (~270 lines)
- Modified: `app/src/screens/admin/Queue.tsx` (Card → tile, inline
  Approve, SLA pill)
- Modified: `app/src/screens/admin/Verify.tsx` (Card → tile, SLA pill)
- Modified: `app/src/screens/admin/Disputes.tsx` (Card → tile, pulse
  open, solid Resolve, SLA pill)
- Modified: `app/src/screens/admin/Payouts.tsx` (Card → tile, sparkline,
  escrow-by-stage)
- Modified: `app/src/screens/admin/Audit.tsx` (Card → tile)
- Modified: `app/src/router.tsx` (`/admin/home` route, `/admin`
  redirect)
- Modified: `app/src/components/layout/nav.ts` (Console nav item +
  `adminQueue` badge key)
- Modified: `app/src/components/layout/Sidebar.tsx` (compute
  `adminQueueCount` for the badge)
- Modified: `app/src/styles/screens.css` (+~340 lines)

### Phase 8 build size (snapshot)

`842 KB JS / 153 KB CSS / 156 modules`
(+17 KB JS, +6 KB CSS, +2 modules over Phase 7.)

### Verification checklist

- [x] `/admin` redirects to `/admin/home`
- [x] Sidebar shows "Console" with badge driven by total queue count
- [x] Admin Home shows 4-tile queue overview with chromatic accents
- [x] SLA-breached queues turn the count red + show SLA pill
- [x] Empty queues show ✓ + softened opacity
- [x] Releases sparkline + escrow-by-stage list render
- [x] Activity feed shows merged platform events
- [x] Up-next shortlist mixes creators, brands, disputes by oldest
- [x] Queue: inline Approve button works alongside Review
- [x] Verify: inline Verify button works
- [x] Disputes: pulse on open status, primary Resolve button
- [x] Payouts: 30-day sparkline + escrow-by-stage tile + in-escrow + recent
- [x] All 5 screens wrap data in `.admin-tbl-tile` (no more `Card` shadows
      mismatching the rest of the app)
- [x] Build clean, no TS errors

---

## ✅ Phase 9 — Discover screens reworked (shipped)

**Goal.** Both Discover screens (`/brand/discover`, `/creator/discover`)
were the most-used surfaces still on the older Card-based pattern.
Phase 9 brings them up to par with Phase 3 / 7 / 8: tile pattern with
cursor halos, transparent match-score rail, preset row, chip filters,
sort dropdown, and URL-synced filter state.

### New utilities — `app/src/lib/utils/discover-metrics.ts`

Pure helpers for both sides of discovery:

**Brand → Creator**
- `CreatorFilters` shape: tiers · categories · regions · verifiedOnly ·
  availableOnly · savedOnly · minRating · search
- `applyCreatorFilters(creators, filters, savedSet)` — predicate-based filtering
- `creatorFiltersToParams` / `creatorFiltersFromParams` — URL serialization
- `activeCreatorFilterCount` — for the "Filters [N]" badge
- `sortCreators(list, 'recommended' | 'reach' | 'engagement' | 'rating' | 'reply', scoreFn?)`
- `creatorMatchForBrand(creator, brand, db)` → `{ score: 0..1, reasons: string[] }`.
  Factors: brand-cat overlap (0.35), region (0.20), tier (0.06–0.15),
  verified (0.10), rating (0.06–0.10), availability (0.05), small
  novelty discount for already-worked-with creators.
- `rankedCreatorsForBrand(brand, db, limit=6)` — top-K with score ≥ 0.25

**Creator → Campaign**
- `CampaignDiscoverFilters` shape: categories · regions · pricing
  ('any'|'fixed'|'outcome'|'retainer') · closingSoon · minBudget ·
  hideApplied · search
- `applyCampaignFilters` / `*ToParams` / `*FromParams` / `activeCount`
- `sortCampaigns(list, 'recommended' | 'budget' | 'deadline' | 'recent' | 'applicants')`
- `campaignMatchForCreator(campaign, creator)` → `{ score, reasons }`.
  Factors: creator-cat match (0.40), region (0.20), editor's pick (0.15),
  budget tier (0.05–0.10), retainer (0.05), recency (0.05–0.10).
- `rankedCampaignsForCreator(creator, campaigns, applied, limit=6)` —
  filters out closed/applied, ranks by score ≥ 0.25

Plus helpers: `uniqueCategories`, `uniqueRegions`,
`uniqueCampaignCategories`, `uniqueCampaignRegions`,
`parseDeadlineSafe` (re-exported).

### Brand Discover refactored

- **Recommended rail tile** at the top — match-scored cards with
  portrait, name, score percentage, and reasons inline (`"75% · Beauty
  · In UK · Verified"`). Each card has cursor halo, save button (★
  toggle), and "Send offer" CTA. Uses `tile-interactive` class so the
  workspace shell halo listener picks it up.
- **Preset row**: ★ Recommended · Top by reach · Available now · ✓
  Verified · ★ Shortlist (with count badge). One-tap presets clear all
  other filters.
- **Stage of chip rows**: Tier chips · Category chips (top 10) ·
  Region chips. Multi-select.
- **Sort dropdown** styled as a pill with mono label ("Sort
  RECOMMENDED").
- **Main grid** — new `.discover-card` design: 56px portrait + name +
  handle + ★-save button (large pill); tagline; pills row (categories,
  Verified, tier, availability); 4-cell stats strip (Reach / Eng /
  Rating / Reply) with hairline dividers; foot row (View profile link
  + Send offer button). Match-flagged cards get `is-recommended`
  border + corner chip "★ Match".
- **Sticky shortlist actions bar** kept (compare 2–5, bulk invite).
- **All filter state syncs to URL**: `?tiers=Flagship,Specialist&cats=Beauty&regions=UK`.
- AI Match concierge button moved from ghost to solid (it's the brand's
  primary discovery hook).

### Creator Discover refactored

- **Recommended rail tile** at the top — match-scored campaign cards
  with cover thumb (100px), brand + category eyebrow, title, score,
  reasons, budget + region foot, Apply button.
- **Preset row**: ★ Recommended · Closing soon · $5k+ budgets · ↻
  Retainers · Just posted.
- **Chip rows**: Hide-applied toggle + 4 pricing chips (Any / Fixed / ⚡
  Outcome / ↻ Retainer); category chips; region chips.
- **Sort dropdown**: Recommended / Budget high-low / Deadline soonest /
  Recently posted / Less competition.
- **Main grid** — new `.discover-card-campaign` variant: 140px cover
  image; padded body with brand eyebrow + status pill (or "✓ Applied" /
  "★ Picked"); serif title (clickable to detail); pitch line-clamp-2;
  pills row (category, region, retainer/outcome flags); 4-cell stats
  (Budget / Apply by / Applicants / Posted relative); foot (deliverables
  + Apply or View button). Match-flagged cards get the same `is-
  recommended` corner chip.
- **All filter state syncs to URL**.
- Card click on cover or title → `/creator/campaigns/:id` (full-page
  Phase-5 detail). Apply button still opens `ApplyModal` inline.

### CSS

`PHASE 9 · Discover screens` block in `screens.css` (~440 lines):

- `.discover-page` / `.discover-toolbar` — page-level layout
- `.discover-sort` / `.discover-sort-select` — pill-shaped sort dropdown
  with reset of base form styling
- `.discover-rec` (tile) + `.discover-rec-h` + `.discover-rec-grid` —
  recommended rail container with 3px accent left border
- `.discover-rec-card` + `.discover-rec-portrait-btn` +
  `.discover-rec-body` + `.discover-rec-match` (score + reasons row) +
  `.discover-rec-actions` — brand-side rec card
- `.discover-rec-grid-campaigns` + `.discover-rec-campaign` (column
  layout with cover at top) — creator-side rec card
- `.discover-grid` / `.discover-grid-campaigns` — responsive grid
- `.discover-card` (with `is-recommended`, `is-saved`, `is-applied`
  variants) + `.discover-card-rec-flag` (corner chip) +
  `.discover-card-h`, `.discover-card-stats` (4-col with hairline
  internals + responsive 2x2 collapse on mobile)
- `.discover-card-campaign` + `.discover-card-campaign-cover` +
  `.discover-card-campaign-body` — cover-on-top variant
- `.discover-card-save` + `.discover-card-save.is-saved` — circular
  save button (28–32px) with accent fill when saved

### Files touched

- New: `app/src/lib/utils/discover-metrics.ts` (~310 lines)
- Rewritten: `app/src/screens/brand/Discover.tsx` (~340 lines)
- Rewritten: `app/src/screens/creator/Discover.tsx` (~290 lines)
- Modified: `app/src/styles/screens.css` (+~440 lines)

### Phase 9 build size (snapshot)

`849 KB JS / 162 KB CSS / 156 modules`
(+7 KB JS, +9 KB CSS, modules unchanged because the new util got
inlined into the chunk.)

### Verification checklist

- [x] Brand Discover: recommended rail with match-scored creator cards
- [x] Creator Discover: recommended rail with match-scored campaign
      cards
- [x] Both: preset row clears other filters in one tap
- [x] Both: stage-grouped chip rows for tier/category/region/etc.
- [x] Both: sort dropdown with sensible options
- [x] Both: filter state syncs to URL (shareable views)
- [x] Brand cards have inline ★ save button + Send offer
- [x] Creator cards have inline Apply button + cover-click → detail page
- [x] Match-recommended cards get a corner chip + accent border
- [x] All cards use `tile-interactive` so cursor halo follows from the
      workspace shell pointermove listener
- [x] Empty states branch on saved-only vs filter vs full empty
- [x] Sticky shortlist bar still works on Brand side
- [x] Build clean, no TS errors

---

## ✅ Phase 10 — Money screens reborn (shipped)

**Goal.** `/brand/wallet` and `/creator/earnings` were the trust-building
surfaces (where users see money flow through escrow) but had been left at
the older `Card`-wrapped table layout, with the YTD breakdown buried
behind a `<details>` disclosure. Phase 10 brings them up to the Phase-7
dashboard standard: tile pattern, sparklines, a chromatic monthly bar
chart, by-brand/by-campaign breakdown rails, and a polished active-
advance tile.

### New utility — `app/src/lib/utils/money-metrics.ts`

Pure helpers shared by both money screens:

- `monthlyInflows(transactions, year, ref)` → `{ values[12], total,
  count, thisMonthIdx, max, taxEstimate }`. The 25% tax estimate is a
  heuristic chip displayed alongside YTD total.
- `inflowsByBrand(transactions, db, year?)` — group cleared inflows by
  brand with count + total + pct of overall.
- `outflowsByCampaign(transactions, db, year?)` — brand-side equivalent:
  group `escrow_release / ad_spend / fee` outflows by campaign.
- `transactionsToActivity(txs, db, opts)` — convert `Transaction[]` into
  the generic `ActivityEvent[]` shape understood by Phase-7's
  `ActivityFeed`. Handles all 8 transaction kinds with side-aware copy
  ("Released to Sarah · Spring drop" vs "Escrow released · Spring drop").
- `thisMonthInflows(txs, ref)` / `lastMonthInflows(txs, ref)` — used by
  the trend pill.
- `monthName(i)` — localized 3-letter month label.

### Brand Wallet refactored

Layout (top → bottom):

1. PageHead with single-line summary lede ("$X cleared · $Y held · Z
   campaigns")
2. **Hero row** (50/50):
   - Available balance tile — big serif amount + USD chip + Top-up /
     Withdraw inline + 90-day top-up sparkline foot (when applicable, in
     `--good` colour)
   - Escrow held tile — list of allocations with name + stage + bar
     showing % of total escrow + amount, click-through to campaign
     detail
3. **Spend + Outflow row** (50/50):
   - Spend last 90 days: 30d total + ▲/▼ trend pill vs prior 30 +
     sparkline
   - Where the money went · by campaign: top 6 with horizontal
     ink-to-accent bars + count + pct meta
4. **Ledger** — full-width tile with header, CSV export link, and the
   transaction table. Uses `fmtRelative` for date column (more scannable
   than absolute dates).

### Creator Earnings refactored

Layout (top → bottom):

1. PageHead with single-line summary lede
2. **Discoverable advance hint banner** (only when applicable) — tile
   with circular accent icon + serif headline + Request advance CTA
3. **KPI strip** (4 cells): This month (with trend pill) · Cleared ·
   Pending · Lifetime
4. **Earnings + YTD row** (50/50):
   - Earnings 90d: sparkline + 30-day total + "N this month" pill
   - YTD: chromatic monthly bar chart with current-month highlighted in
     accent + glow, hover scaleY for hint of dynamism, tax-estimate chip
     in eyebrow. Always visible (was hidden behind disclosure).
5. **By brand + Payout method row** (50/50):
   - By brand YTD: top 6 with horizontal bars
   - Payout method: clean key-value table; surfaces a "Set up" prompt
     tile if the creator hasn't filled this in yet
6. **Active advance tile** (when present) — 2-cell breakdown (borrowed /
   repaid) + progress bar + auto-repay note. Now a proper tile instead
   of an inline `Card`.
7. **Ledger** — same pattern as Brand Wallet, with per-row Invoice
   button on cleared payouts (kept the existing `openInvoice` integration).

### Both screens share

- New shared CSS classes in the `PHASE 10 · Money screens` block
- New `home-tile` pattern (Phase 7) instead of `Card`
- `Sparkline` (Phase 7) for time series
- `admin-tbl-tile` (Phase 8) for the ledger table

### CSS

`PHASE 10 · Money screens` block in `screens.css` (~280 lines):

- `.money-balance-tile` (3px good-tone left border) +
  `.money-balance-amount` (clamp 36–52px serif) + `.money-balance-currency`
- `.money-escrow-list` / `.money-escrow-link` / `.money-escrow-bar`
  (gradient ink-to-accent fill) — tile-internal escrow allocation list
  with click-through
- `.money-bybrand-list` / `.money-bybrand-row` / `.money-bybrand-bar` —
  shared between brand "by campaign" and creator "by brand" breakdowns
- `.money-monthly` / `.money-monthly-bars` / `.money-monthly-bar.is-current`
  — chromatic monthly bar chart with hover scaleY effect; current month
  uses accent gradient + 12px glow
- `.money-payout-method` / `.money-payout-empty` — payout method key-
  value layout with empty-state prompt
- `.money-advance-hint` — discoverable advance banner with circular accent
  icon
- `.money-advance-active` / `.money-advance-grid` / `.money-advance-bar`
  — active advance tile with progress

### Files touched

- New: `app/src/lib/utils/money-metrics.ts` (~210 lines)
- Rewritten: `app/src/screens/brand/Wallet.tsx` (~330 lines)
- Rewritten: `app/src/screens/creator/Earnings.tsx` (~340 lines)
- Modified: `app/src/styles/screens.css` (+~280 lines)

### Phase 10 build size (snapshot)

`855 KB JS / 167 KB CSS / 156 modules`
(+6 KB JS, +5 KB CSS, modules unchanged — money-metrics inlined into
chunk.)

### Verification checklist

- [x] Brand Wallet: hero row with balance + escrow allocations
- [x] Brand Wallet: 90-day spend sparkline + by-campaign breakdown
- [x] Brand Wallet: ledger uses `admin-tbl-tile` with CSV export
- [x] Brand Wallet: top-up sparkline shows in foot of balance tile when applicable
- [x] Creator Earnings: advance hint banner shows only when applicable
- [x] Creator Earnings: KPI strip with month-trend pill
- [x] Creator Earnings: 90-day earnings sparkline
- [x] Creator Earnings: 12-month bar chart with current-month highlighted
- [x] Creator Earnings: by-brand horizontal bars
- [x] Creator Earnings: payout method tile with set-up prompt when empty
- [x] Creator Earnings: active advance tile with progress bar (when present)
- [x] Both screens use the same `home-row home-row-2col` layout primitive
- [x] Both screens use `home-tile` for sections (consistent shadow with rest of app)
- [x] All inline-styled blocks replaced with class-based tiles
- [x] Build clean, no TS errors, dark-theme parity (all rules use OKLCH `color-mix` over tokens)

---

## ✅ Phase 11 — Action surfaces (Inbox · Approvals · Content) shipped

**Goal.** The three daily-grind surfaces where real work happens between
brand and creator hadn't been touched since Phase 1. Bundled them as one
phase since they form a coherent triad: brands review drafts in
Approvals, creators upload in Content, both message in Inbox.

### Inbox polish — `app/src/components/inbox/InboxView.tsx`

Shared by `/brand/inbox` and `/creator/inbox`. Targeted improvements:

- **Filter chips** at top of thread list: All · Unread · On a campaign,
  with live counts. Disabled when count is 0 (e.g. "Unread" when inbox
  zero).
- **Stronger active-thread state** — chromatic 3px accent left border
  + soft accent-tinted background (was just `paper-2`).
- **Unread treatment** — bold name + 10px accent dot on portrait corner
  with 2px ring.
- **Inline campaign chip** in each thread row with stage hue dot +
  truncated title. Brand can scan threads by campaign at a glance.
- **Last-message previews** improved: `📎` prefix when attachment, `You:`
  prefix when you sent it (Slack/Linear-style).
- **Pane header** now has a circular portrait + stage-tinted dot beside
  the campaign breadcrumb. "Open campaign" button now navigates to the
  Phase-2/5 full-page detail (was the old list page).
- **Bubble polish** — soft inset highlight + accent gradient on
  `.from-me` bubbles (was solid `var(--ink)`).
- Empty states branch by filter ("Inbox zero" for unread, "No campaign
  threads" for that filter, regular onboarding text for full empty).

### Approvals reborn — `app/src/screens/brand/Approvals.tsx`

Full rewrite. Layout (top → bottom):

1. **PageHead** with action-aware title ("N drafts to review" vs "Caught
   up — nothing waiting")
2. **KPI strip** (only when pending > 0): Pending count (red when
   oldest ≥ 3d) · Escrow ready to release · Median round number · In
   revision count
3. **Filter chips** (presets): Pending · In revision · Approved · All —
   each with count, disabled when 0
4. **Approval tiles** — full new design:
   - 140px cover thumb (with `+N` overlay when multiple files)
   - chromatic stage-hue 3px left border (matches campaign)
   - Creator name (CreatorHoverCard, dashed-underline) + campaign link
   - Pulsing "Awaiting you" pill on pending rows
   - Meta line: round, file count, relative time, escrow at stake, SLA
     badge when ≥3d old
   - Notes block (italic blockquote) or last-feedback summary
   - **Inline action buttons** for pending: Review (opens modal) ·
     Request revisions (opens revision modal) · **Approve · $X** (solid,
     fires confetti, releases payout). Most rows can be cleared
     without ever opening the modal.
   - Cursor-aware halo on tile (uses workspace shell pointermove).
- The full review modal is now reserved for "I want to see all the files"
  cases — most decisions are inline.
- Quick-revision modal (separate from the full review modal) lets you
  send feedback in one click → write notes → send.

### Content reborn — `app/src/screens/creator/Content.tsx`

Full rewrite. Layout:

1. **PageHead** — action-aware title ("N things need you" vs "Drafts &
   revisions")
2. **KPI strip**: Needs me (accent when > 0) · At brand · In escrow ·
   Releases on review
3. **Filter chips** with new "★ Needs me" preset (default when present)
   filtering to `to_upload + revisions`. Auto-falls back to `all` when
   the needs-me bucket is empty.
4. **Campaign tiles** — chromatic stage-hue 3px left border, expanded
   view with:
   - Cover thumb + brand + deliverables + due date + offer rate
   - Status pill (pulse on `needs-me` states)
   - "needs-me" tiles get an extra 1px accent ring around the shadow
   - Click → expand. URL syncs `?cid=`
5. **Polished tracker** — 8 steps (Invitation → Accepted → Briefed →
   Rounds → Brand review → Approval → Posted → Payout). Each step is a
   tile-bordered dot with state colours: `is-done` ink, `is-current`
   accent + 4px glow ring, `is-pending` softened. 4-col grid (dot, name,
   detail, time) collapses to 2-col stack on mobile.
6. **Submission strip** — per-round mini-cards with cover thumb + status
   pill + last-feedback blockquote
7. **Tile actions** — AI concepts (ghost) + Upload Round N (solid,
   disabled when in_review)

### CSS

`PHASE 11 · Action surfaces` block in `screens.css` (~510 lines):

- **Inbox**: `.inbox-filters` / `.inbox-filter-chip` / `.inbox-thread.is-unread`
  / `.inbox-thread-unread-dot` / `.inbox-thread-cmp` / `.inbox-pane-h-id`
  / `.inbox-pane-portrait` / refined bubble shadows
- **Approvals**: `.approvals-list` / `.approval-tile` (cursor halo +
  stage-hue left border) / `.approval-tile-cover-btn` /
  `.approval-tile-count` / `.approval-tile-creator` /
  `.approval-tile-cmp` / `.approval-tile-notes` /
  `.approval-tile-feedback` / `.approval-tile-actions` / responsive
  collapse at ≤700px
- **Content**: `.content-list` / `.content-tile` (with `.needs-me`
  accent ring, `.is-open` accent border) / `.content-tile-h` (clickable
  collapsed header) / `.content-tile-body` / `.content-tracker` /
  `.content-tracker-step.is-done|is-current|is-pending` /
  `.content-tracker-dot` / `.content-subs` / `.content-sub-row` /
  `.content-sub-feedback` / responsive 2-col on mobile

### Files touched

- Modified: `app/src/components/inbox/InboxView.tsx` (filter chips,
  unread treatment, campaign chip, polished pane header)
- Rewritten: `app/src/screens/brand/Approvals.tsx` (~310 lines)
- Rewritten: `app/src/screens/creator/Content.tsx` (~280 lines)
- Modified: `app/src/styles/screens.css` (+~510 lines)

### Phase 11 build size (snapshot)

`864 KB JS / 177 KB CSS / 156 modules`
(+9 KB JS, +10 KB CSS, modules unchanged.)

### Verification checklist

- [x] Inbox: filter chips (All / Unread / On campaign) with counts
- [x] Inbox: chromatic active state (accent left border + tint)
- [x] Inbox: unread dot on portrait + bolder name
- [x] Inbox: campaign chip with stage hue inline in thread row
- [x] Inbox: portrait + stage dot in pane header, "Open campaign" routes
      to full-page detail
- [x] Inbox: bubble shadow polish + accent gradient on sent bubbles
- [x] Approvals: KPI strip with SLA color on pending count
- [x] Approvals: filter chip row (Pending / Revisions / Approved / All)
- [x] Approvals: tile pattern with stage hue + cursor halo
- [x] Approvals: inline Approve / Request revisions / Review on each row
- [x] Approvals: pulsing "Awaiting you" pill on pending rows
- [x] Approvals: SLA pill when row sat ≥ 3 days
- [x] Content: KPI strip (Needs me / At brand / In escrow / Releases)
- [x] Content: "★ Needs me" preset, default when applicable
- [x] Content: tile pattern with stage hue + needs-me accent ring
- [x] Content: polished tracker with chromatic dot states
- [x] Content: per-round submission strip with feedback blockquotes
- [x] Build clean, no TS errors

---

## ✅ Phase 12 — Identity + Insight surfaces (Profile · Company · Analytics) shipped

**Goal.** The four "self-reflection" surfaces (where users edit their
public-facing data and look at their numbers) had been left at the older
`Card`/inline-styled pattern. Phase 12 brings them up to par with the
Phase-7 dashboard model and tile pattern, while preserving the heavy
form logic that lives inside the Profile/Company sections.

### Brand Analytics reborn — `app/src/screens/brand/Analytics.tsx`

Full rewrite. Layout (top → bottom):

1. **PageHead** with single-line lede ("N closed · X reach delivered ·
   $Y spent") and Export CSV button
2. **KPI strip** (4 cells): Total reach · Avg engagement · Cost / campaign
   · Completion %
3. **Spend sparkline + Reach by category** (50/50 row):
   - 90-day spend tile with sparkline + 30-day total + Wallet link
   - Reach-by-category tile with horizontal accent bars + count + spent
     + percentage
4. **Top campaigns + Top creators** (50/50 row):
   - Top 8 campaigns by reach with chromatic stage-hue accent left
     border on hover, click-through to detail
   - Top 5 creators ranked by reach delivered (count + paid + reach),
     reuses `top-creators` styles from Phase 7
5. **Per-campaign breakdown** — full-width tile-wrapped table with
   campaign-row click-through

### Creator Analytics reborn — `app/src/screens/creator/Analytics.tsx`

Mirror layout, flipped to creator priorities:

1. **PageHead** + KPI strip (4 cells): Total reach · Avg engagement ·
   Completion · Avg response time
2. **12-month reach bar chart + Audience platforms** (50/50 row):
   - Chromatic monthly bar chart (current month highlighted in accent +
     glow, reuses Phase-10 `.money-monthly-*` classes for visual
     continuity)
   - Per-platform horizontal bars with handle + engagement + verified
     status
3. **Top campaigns + Reach trajectory** (50/50 row):
   - Top campaigns by reach (chromatic stage-hue), click-through to
     detail
   - 12-month sparkline trajectory with current-month label
4. **Per-platform breakdown** — full-width tile-wrapped table with
   "Manage" link to Profile section
5. **Recent campaigns · performance** — full-width tile with reach +
   engagement + earned per closed campaign

### Profile heroes polished

Surgical edits to the inline-styled hero strips at the top of
`/creator/profile` and `/brand/profile`. The deeper form logic + 7-section
TOC navigation pattern stays untouched (works fine after Phase-1 token
swap).

**Hero strip becomes a real tile** with three columns:

- 120×150 portrait button (creator) or 120×120 logo button (brand) with
  inset highlight + soft warm shadow + hover lift; gradient "Change"
  overlay reveals on hover
- Identity block (name + handle/HQ + meta + Upload button)
- Trust column (TrustBadge + Verified pill stack)

**Completion bar becomes a real tile** with:

- "Profile completion" eyebrow + serif percent value
- Ink-to-accent gradient progress bar
- Right-aligned hint copy ("✓ All sections done" or "A complete profile
  gets ~3× more inbound")
- Mobile breakpoint stacks the trust column under the identity block

### CSS

`PHASE 12 · Identity + Insight surfaces` block in `screens.css`
(~280 lines):

- `.profile-hero` — 3-col grid (120px portrait + 1fr id + auto trust)
  collapsing to 2-col on mobile
- `.profile-hero-portrait-btn` / `.profile-hero-logo` — clickable image
  buttons with inset highlight + soft shadow + hover gradient overlay
- `.profile-hero-name` / `.profile-hero-meta` / `.profile-hero-trust` —
  identity + trust columns
- `.profile-completion` — 3-col tile: meta + bar + hint
- `.profile-completion-bar-fill` — ink-to-accent gradient
- `.analytics-page` — flex-column layout primitive
- `.analytics-bars` / `.analytics-bar-row` / `.analytics-bar-link` —
  top-N list with chromatic stage hue (Phase-3 palette) + accent left
  border on hover

### Files touched

- Rewritten: `app/src/screens/brand/Analytics.tsx` (~270 lines)
- Rewritten: `app/src/screens/creator/Analytics.tsx` (~250 lines)
- Modified: `app/src/screens/creator/Profile.tsx` (hero + completion
  blocks → class-based tiles)
- Modified: `app/src/screens/brand/Profile.tsx` (hero block → class-based
  tile + added TrustBadge to hero)
- Modified: `app/src/styles/screens.css` (+~280 lines)

### Phase 12 build size (snapshot)

`872 KB JS / 182 KB CSS / 156 modules`
(+8 KB JS, +5 KB CSS, modules unchanged.)

### Verification checklist

- [x] Brand Analytics: KPI strip + spend sparkline + reach-by-category
- [x] Brand Analytics: top campaigns by reach with stage-hue accent rows
- [x] Brand Analytics: top creators leaderboard
- [x] Brand Analytics: per-campaign breakdown table in tile
- [x] Creator Analytics: 12-month chromatic bar chart with current-month
      highlighted
- [x] Creator Analytics: per-platform breakdown with verified badge
- [x] Creator Analytics: top campaigns by reach + reach trajectory
      sparkline
- [x] Creator Analytics: recent campaigns table with earned column
- [x] Creator Profile: hero is a tile with portrait + name + trust
- [x] Brand Profile: hero is a tile with logo + name + trust
- [x] Profile: completion bar is a tile with hint copy
- [x] Build clean, no TS errors

---

## ✅ Phase 13 — Workflow power features (shipped)

**Goal.** Three power features to make existing workflows faster:
drag-and-drop on the kanban (advance stages without leaving the board),
multi-select bulk actions on the campaign list (export / clone / close),
and saved views (name + persist filter combinations).

### Drag-and-drop kanban

Refactored `BoardView` inside `app/src/screens/brand/Campaigns.tsx`:

- `kcard` is now `draggable`. `dragstart` writes the campaign id +
  source stage to `dataTransfer`.
- Each `kanban-col` is a drop target — `dragover` (preventDefault)
  highlights it; `drop` calls `api.campaigns.transition(id, target)`
  with optimistic toast.
- **All eight stages appear while dragging** (even empty ones) so drops
  are unambiguous. Empty columns get a soft tinted background; the
  current drop target gets a 2px stage-hue ring + soft glow.
- Empty columns also show a dashed "Drop to move here" placeholder
  during a drag.
- The card being dragged dims (opacity 0.45) and gets a subtle
  −1.5deg rotation + lifted shadow — the magazine "card in motion" feel.
- Cursor is `grab` / `grabbing` per state.

### Multi-select bulk actions

`CampaignListGrouped` now optionally renders a checkbox overlay on each
row when the parent passes `selectedIds` + `onToggleSelect`:

- Checkbox sits on the cover thumbnail, hidden until the row is hovered
  or already selected (so the list stays clean by default).
- Selected rows get accent-tinted background + faded cover.
- Click body still navigates to the detail page (checkbox uses
  `stopPropagation`).

A new sticky **bulk-action bar** appears at the bottom of the page when
`selectedIds.size > 0`:

- Pill-shaped on desktop (centered), full-width tile on mobile
- "N selected" with serif count
- **Export CSV** — exports id + title + stage + cat + region + budget +
  spent + escrow + applicants + accepted + deadline + created
- **Clone** — only enabled with exactly 1 selection; opens
  `NewCampaignModal` with cloneFrom prefill
- **Close** — destructive action with confirmation modal; transitions
  every selected campaign to `closed` stage in sequence; toast reports
  done/failed counts
- Clear button (X) on the right

### Saved views

A row of pill chips appears above the list (always visible — shows
"No saved views yet…" when empty). Each chip:

- Click to apply: replaces URL search params with the saved snapshot
  (filters + sort + view)
- "×" remove button on the chip (stopPropagation guard)

A **+ Save view** button opens `SaveViewModal`:

- Prefills a sensible name from active filters ("Needs my attention",
  "Past deadline", "Live view", "3-stage view", or "Custom view")
- Saves to `localStorage` keyed by brand id (`alamut.savedViews.{brandId}`)
- Persisted as an array of `{ id, name, view, query, createdAt }`

### CSS

`PHASE 13 · Workflow Power Features` block in `screens.css` (~270 lines):

- `.kcard.is-dragging` — opacity dim + subtle rotation + lifted shadow
- `.kanban-col.is-drop-target` — 2px stage-hue ring + glow
- `.kanban-col.is-empty` — softened receptive state during drag
- `.kanban-empty-drop` — dashed placeholder inside empty columns when
  drag is active
- `.saved-views` — dashed-border tile container holding chips
- `.saved-view-chip` / `.saved-view-chip-x` / `.saved-view-add` — pill
  chips
- `.cmp-list-row-checkbox` — overlay on cover with backdrop tint, fade
  in on hover or selection
- `.cmp-list-row.is-selected` — accent-tinted background + faded cover
- `.bulk-bar` — pill-shaped fixed-bottom action bar with custom
  `bulk-bar-rise` animation, ink-coloured background with white-tinted
  buttons, mobile breakpoint that converts to full-width tile

### Files touched

- Modified: `app/src/screens/brand/Campaigns.tsx` (drag-and-drop
  BoardView, bulk state, saved views state, sticky bar, save modal)
- Modified: `app/src/components/campaign/CampaignListGrouped.tsx`
  (optional selection props + checkbox overlay; row element changed
  from `<button>` to `<div role="button">` to allow nested label)
- Modified: `app/src/styles/screens.css` (+~270 lines)

---

## ✅ Phase 14 — Polish & Performance (shipped)

**Goal.** Two big perf wins (vendor chunking + lazy-loaded routes) plus
a soft skeleton fallback for fast subsequent navigation.

### Vendor chunking — `app/vite.config.ts`

`build.rollupOptions.output.manualChunks` splits `node_modules` deps
into named chunks:

- `vendor-react` — react + react-dom (~138 KB / 44 KB gzip)
- `vendor-router` — react-router-dom (~16 KB / 5.5 KB gzip)
- `vendor-state` — zustand (~2.7 KB / 1.3 KB gzip)
- `vendor` — everything else from `node_modules` (~52 KB / 18.5 KB gzip)

Pre-Phase-14, all of these were inlined into the single index chunk.
Splitting them lets browsers cache vendor chunks across deploys (they
change much less often than app code).

`chunkSizeWarningLimit` raised from default 500 KB to 700 KB —
acceptable for this single-page workspace once vendor chunks are split
out.

### Route lazy-loading — `app/src/router.tsx`

Strategy: **eagerly import the role-default landing screens** (Today
for creator + brand, Home for admin) so the first authenticated paint
doesn't wait on a chunk fetch. **Lazy everything else.**

```tsx
// Eager (in the initial bundle)
- Cover / SignIn / SignUp        — /
- CreatorToday                   — /creator/today
- BrandToday                     — /brand/today
- AdminHome                      — /admin/home

// Lazy (loaded on first navigation to that route)
- All Home / Discover / Campaigns / Inbox / Earnings / Wallet /
  Analytics / Profile / Approvals / Content / CampaignDetail screens
  for both creator + brand
- Public Creator storefront
- Admin Queue / Verify / Disputes / Payouts / Audit
```

Each lazy screen wraps in a `<Suspense fallback={<RouteFallback />}>`
boundary at the route element level (rather than tree-wide) so a
lazy-loaded screen can render its own skeleton without unmounting the
workspace shell.

### Soft skeleton fallback

`.route-skeleton` — a 60vh tile-shaped block with shimmer animation.
Critical detail: the appear-in animation has a **120ms delay** (`animation:
route-skeleton-in 320ms 120ms forwards`). This means on a fast network /
warm cache the skeleton **never visibly flashes** — it stays at opacity 0
through the entire load. Slower loads see it fade in at 120ms with a
soft shimmer.

Reduced-motion users get the appear immediately, no shimmer.

### Mobile audit

Spot-checked the new Phase-13 surfaces on narrow viewports:

- `.bulk-bar` collapses to full-width tile at ≤700px (already in CSS)
- `.saved-views` uses `flex-wrap: wrap` so chips stack
- `.kanban` keeps its horizontal scroll behaviour (Phase 1)
- `.cmp-list-row-checkbox` appears centered on the cover thumb regardless
  of viewport
- All Phase-7+ home dashboards already collapse 2-col / 3-col rows to
  single column at ≤800px (Phase 7)

No additional CSS needed — the responsive primitives we built in
earlier phases cover the new pieces.

### Build size — final snapshot

| Chunk type | Pre-14   | Post-14 (initial only)  |
| ---------- | -------- | ----------------------- |
| Total JS   | 872 KB   | 444 KB initial          |
| Gzip       | 238 KB   | **135 KB initial**      |
| Total CSS  | 182 KB   | 187 KB                  |

Lazy chunks total ~422 KB but only ~10–40 KB loads per route navigation,
and they cache independently.

**~43% reduction in initial gzipped JS payload** vs Phase 12 baseline.

Per-route chunk sizes (gzipped):

```
Earnings        6.6 KB    Approvals     3.8 KB
Content         7.9 KB    Discover      7.5 KB / 2.9 KB
CampaignDetail  9.5 KB / 6.1 KB
Profile         11.6 KB / 5.4 KB
Campaigns       9.0 KB    Wallet        3.4 KB
Analytics       2.9 KB / 2.7 KB        Inbox  4.1 KB (shared component)
PublicCreator   3.5 KB    Home          3.2 KB / 3.3 KB
```

Each route fetches its own ~3-12 KB chunk on first visit, then is cached.

### Files touched

- Rewritten: `app/src/router.tsx` (lazy imports + Suspense wrappers +
  RouteFallback component)
- Modified: `app/vite.config.ts` (manualChunks)
- Modified: `app/src/styles/screens.css` (+~30 lines for `.route-skeleton`)

### Verification checklist (Phase 13)

- [x] Kanban: cards draggable, columns drop-targets
- [x] Kanban: drop fires `api.campaigns.transition` + toast
- [x] Kanban: empty stage columns appear during drag with placeholder
- [x] Kanban: drop-target ring uses stage-hue + glow
- [x] List: checkbox overlay appears on hover or when selected
- [x] List: selected rows get accent-tinted background
- [x] Bulk bar: rises with animation when first row selected
- [x] Bulk bar: Export CSV produces correct file
- [x] Bulk bar: Clone enabled only with exactly 1 selection
- [x] Bulk bar: Close prompts confirm + transitions all selected
- [x] Bulk bar: Clear (X) wipes selection
- [x] Saved views: chip row above list with empty-state hint
- [x] Saved views: + Save view modal with smart default name
- [x] Saved views: persists per-brand in localStorage
- [x] Saved views: applying restores filters + view

### Verification checklist (Phase 14)

- [x] Vendor chunks split (react / router / state / general)
- [x] Initial gzipped JS ≤ 150 KB
- [x] Today screens stay eager (no flash on auth → workspace transition)
- [x] AdminHome stays eager
- [x] All other screens lazy with per-route chunks
- [x] `.route-skeleton` invisible on fast loads (120ms appear delay)
- [x] Reduced-motion users get instant appear without shimmer
- [x] Build clean, no TS errors

---

## ✅ Phase 15 — Notifications bell + Onboarding (shipped)

**Goal.** Two "first-mile" surfaces hadn't been touched since Phase 1:
the notifications dropdown (used daily) and the onboarding tour (first
impression for new sign-ups). Both got the tile-pattern polish + the
chromatic accents the rest of the app uses.

### Notifications bell reborn — `app/src/components/layout/NotificationsBell.tsx`

Full rewrite of the bell + dropdown. Inline `style={{...}}` blocks
replaced with proper CSS classes; new behaviour:

- **Filter chips** at top of the popup: All · Unread (with disabled
  state when nothing's unread).
- **Time grouping** — Today · Yesterday · Earlier this week · Older.
  Each group has a mono-meta header; empty groups are hidden.
- **Per-kind chromatic dots** — each notification is classified
  (`offer / draft / application / review / payout / campaign / team /
  other`) by its meta + text. The dot picks up that hue:
  - Offer: amber (oklch 0.60 80)
  - Draft: coral (oklch 0.60 30)
  - Application: sage (oklch 0.55 145)
  - Review: accent
  - Payout: good (sage-green)
  - Campaign: blue (oklch 0.55 220)
  - Team: violet (oklch 0.55 320)
  - Other: ink-60 fallback
- **Per-kind eyebrow** — each row has a 1-line "Offer" / "Payout" / etc.
  monospace label above the body so the row scans even when the body
  text is generic.
- **Unread states** — unread rows get a subtle accent-tinted background
  and a filled-not-outlined dot. Read rows are softened.
- **Sticky popup header** — glassy chrome with `backdrop-filter` so the
  filter chips stay visible while scrolling long lists.
- **Hover treatment** — left border lights up in the row's kind hue.
- **Inline actions** kept (Accept/Decline for pending offers; Approve
  for in-review submissions). Accept now fires confetti.
- **Polished bell button** — pulses subtly when unread; badge has a 2px
  accent-tinted ring.
- **Escape key closes** the popup (was outside-click only).

### Onboarding tour polished — `app/src/components/layout/OnboardingTour.tsx`

The 4-step welcome modal got per-step chromatic accents and inline
visuals:

- Each step now carries a `hue` (sage / amber / coral / blue / violet)
  and a `visual` key driving an inline-SVG figure.
- **Inline figures** rendered per step:
  - `wave` (welcome) — a soft accent-gradient flowing line with three
    nodes
  - `discover` — 4 mock campaign cards with the second highlighted
  - `lifecycle` — the 8-stage timeline with current step highlighted
    + glow
  - `wallet` — a wallet card with a payout chip on the right
  - `brief` — a campaign brief mock with a CTA chip
  - `shortlist` — 3 creator cards with the middle one highlighted
  - `roas` — bar chart with one bar emphasized
- Visuals sit in a chromatic-tinted top tile with a 2px accent gradient
  hairline at the top.
- **Eyebrow** has a chromatic accent dot + "C · 02 · Step 2 of 4" mono
  label.
- **Step indicators** swapped from flat 3px bars to dynamic dots with
  `is-done` (ink), `is-current` (chromatic + scaleY 1.5x glow), and
  `is-pending` (rule) states. Reduced-motion users see static states.
- Modal width up from 520 → 560 to fit the visual.

### Onboarding checklist polish — `app/src/components/layout/OnboardingChecklist.tsx`

Light edits via CSS only:

- "Next:" line in the collapsed header now serif (was monospace —
  reads more like a friendly suggestion than a system label).
- Active checklist row gets a 2px accent left border on hover, plus
  accent-tinted background fill — pulls the eye to the next action.

### CSS

`PHASE 15 · Notifications bell + Onboarding polish` block in
`screens.css` (~430 lines):

- `.notif-bell` / `.notif-bell-badge` / `.notif-bell.is-open` — the
  trigger button
- `.notif-popup` (raised tile shadow with double-layer drop), with
  `notif-popup-in` keyframe for the open animation
- `.notif-popup-h` (sticky glassy header), `.notif-popup-filters`,
  `.notif-filter-chip[.is-on]`, `.notif-filter-count[.is-accent]`
- `.notif-list`, `.notif-group` (with hairline divider between groups),
  `.notif-group-h`
- `.notif-row` (2px transparent left border that lights up in
  `--kind-hue` on hover), `.notif-row.is-unread` (accent-tinted bg),
  per-kind `--kind-hue` rules
- `.notif-row-dot` (24px circle with kind hue, switches between
  outline-on-read and filled-on-unread)
- `.notif-row-kind` / `.notif-row-text` / `.notif-row-time` /
  `.notif-row-actions` — body bits
- `.notif-quick-action[data-variant=…]` — inline action pill buttons
- `.onb-tour` / `.onb-tour-visual` (accent-tinted top tile with
  hairline gradient) / `.onb-tour-svg` / `.onb-tour-eyebrow` /
  `.onb-tour-eyebrow-dot` / `.onb-tour-title` / `.onb-tour-body` /
  `.onb-tour-dots` (sliding chromatic dot indicator)
- `.onboarding-checklist-next` (now serif) / `.onboarding-checklist-item`
  hover (2px accent left border)

### Files touched

- Rewritten: `app/src/components/layout/NotificationsBell.tsx` (~290 lines)
- Rewritten: `app/src/components/layout/OnboardingTour.tsx` (~280 lines,
  with 7 inline-SVG visual components)
- Modified: `app/src/styles/screens.css` (+~430 lines)

### Phase 15 build size (snapshot)

`242 KB initial / 68 KB gzip` (was 236 KB / 67 KB at end of Phase 14)
Per-route lazy chunks unchanged.

### Verification checklist

- [x] Bell badge pulses with accent-tinted ring when unread
- [x] Bell button has hover + open states with subtle bg tint
- [x] Popup opens with smooth fade-in + slight slide animation
- [x] Filter chips (All / Unread) work, Unread disabled at zero
- [x] Notifications grouped by Today / Yesterday / Earlier / Older
- [x] Each row has chromatic kind dot + kind eyebrow
- [x] Unread rows get accent-tinted background + filled dot
- [x] Hover lights up left border in kind hue
- [x] Inline Accept fires confetti, Decline + Approve still work
- [x] Sticky glassy header keeps filters visible while scrolling
- [x] Escape closes the popup
- [x] Tour: per-step chromatic accents + inline visual
- [x] Tour: 7 distinct visual variants render correctly
- [x] Tour: dot indicators with sliding active marker
- [x] Tour: reduced-motion users get static state
- [x] Checklist: active row gets accent left border on hover
- [x] Build clean, no TS errors

---

## ✅ Phase 16 — Quality pass: a11y + dark-mode + keyboard kanban (shipped)

**Goal.** A foundational quality pass after 15 phases of feature work.
Audit existing surfaces for accessibility gaps, verify dark-mode survives
the OKLCH discipline we've held, and address the one big a11y debt
introduced by Phase 13: the keyboard-inaccessible drag-and-drop kanban.

### Skip-to-content link

`app/src/components/layout/WorkspaceShell.tsx` now renders
`<a href="#main-content" class="skip-link">Skip to main content</a>` as
the first child of the `.shell`, before the sidebar.

The `<main>` element gets `id="main-content"` + `tabIndex={-1}` so the
anchor target is focusable.

CSS keeps the link off-screen via `transform: translateY(-200%)` and
slides it into view only on `:focus-visible`. Reduced-motion users get
no transition. Hidden visually but always announceable to screen
readers.

### Keyboard fallback for the kanban — "Move to…" menu

Phase 13's drag-and-drop kanban is fast for mouse users but completely
keyboard-inaccessible (HTML5 native DnD has no keyboard equivalent).
Phase 16 adds a parallel keyboard pathway:

- Each `kcard` gets a small `⋮` button at the top-right corner. Hidden
  visually until the card is hovered or focused, but always present in
  the DOM with `aria-haspopup="menu"` + `aria-expanded` + clear
  `aria-label="Move {title} to another stage"`.
- Click (or Enter) opens a `kcard-move-menu` popover listing every
  stage other than the current one, each with a chromatic stage-hue
  dot.
- Click a stage → `api.campaigns.transition()` + toast (same handler as
  drop).
- Outside-click + Escape close the menu.

To support nesting the menu trigger inside the kcard, the kcard itself
changed from a `<button>` (which can't contain another button) to a
`<div role="listitem">` wrapping a `<button class="kcard-body-btn">`
for the click target. Drag handlers stay on the wrapper; click handler
stays on the inner button. Visual styling unchanged — `.kcard-body-btn`
resets all button defaults (border, padding, background, cursor) so the
inner button is visually invisible.

The kanban column also picks up `role="list"` + `aria-label={stage
label}` for screen-reader navigation.

### Dark-mode audit

Grepped the entire `app/src` for hard-coded hex / rgb / named colors in
inline styles — **zero matches**. The OKLCH `color-mix` over tokens
discipline we've held since Phase 1 means every surface adapts to the
dark theme via the `body[data-theme="dark"]` token overrides.

Confirmed dark-mode tokens still match the production set:
- `--bg-canvas: oklch(0.16 0.012 270)` — the cool indigo body base
- `--tile-surface: oklch(0.22 0.010 270)` — slightly raised tile fill
- `--tile-border: color-mix(in oklab, white 8%, transparent)` — subtle
  edge
- The three `--bg-mesh-*` radial-gradient blobs use lower-chroma OKLCH
  values for the dark theme

No fixes required — dark mode "just works" because we never broke the
discipline.

### Aria sweep

Quick audit of icon-only buttons across the workspace:
- `Sidebar` mobile-close + sign-out → both have `aria-label` ✓
- `WorkspaceShell` mobile-nav-toggle → has `aria-label` ✓
- `bulk-bar-clear` (Phase 13) → has `aria-label` ✓
- `kcard-move-trigger` (Phase 16, just added) → has descriptive
  `aria-label` ✓
- Notifications bell button → has `aria-label` and `aria-haspopup` ✓
- All filter chips have `aria-pressed` via `is-on` class plus visible
  text labels

Existing focus-visible styles (`base.css` line 199-237) cover all
interactive elements with a 2px accent outline; no additions needed.

### Files touched

- Modified: `app/src/components/layout/WorkspaceShell.tsx` (skip link
  + `id="main-content"` + tabIndex for focus target)
- Modified: `app/src/screens/brand/Campaigns.tsx` (kcard restructure
  to `<div>` wrapper + `<button class="kcard-body-btn">` + new
  `kcard-move-trigger` and `kcard-move-menu` popover with outside-
  click/Escape close, role="list/listitem" on column/cards)
- Modified: `app/src/styles/screens.css` (+~150 lines for `.skip-link`,
  `.kcard-body-btn`, `.kcard-move-trigger`, `.kcard-move-menu`,
  `.kcard-move-option` with chromatic stage hue)

### Phase 16 build size (snapshot)

`242 KB initial / 68 KB gzip` (unchanged from Phase 15 — additions are
mostly in the lazy `Campaigns` chunk which grew 29.6 → 31.1 KB / +0.4 KB
gzip).

### Verification checklist

- [x] Skip-to-content link present, hidden until keyboard-focused
- [x] Skip link target (`#main-content`) is focusable via tabIndex={-1}
- [x] Reduced-motion users get instant skip-link reveal
- [x] Kanban kcard has visible ⋮ trigger on hover/focus
- [x] Kanban move menu opens on click/Enter, closes on Escape/outside
- [x] Move menu lists every stage *other than* the current one
- [x] Each menu option has a chromatic stage-hue dot
- [x] Move action uses the same `api.campaigns.transition` + toast as
      drop
- [x] Kcard structure (div + inner button) preserves visual styling
- [x] Kanban column has `role="list"` + stage `aria-label`
- [x] Kcard has `role="listitem"` + `aria-grabbed`
- [x] No hex / rgb / named colors anywhere in inline styles
- [x] All icon-only buttons in workspace have `aria-label`
- [x] Build clean, no TS errors

---

## ✅ Phase 17 — AI-assist surfaces (shipped) · Ship phase

**Goal.** Surface AI helpers at the moments they actually help — not as
a separate "AI features" page, but inline at the friction points of the
existing workflow. Three additions, all transparent (no black-box
scores), all calling out their reasoning.

### New utility — `app/src/lib/utils/ai-helpers.ts`

Three pure helpers (mocked, transparent scoring — the pattern that
matches the existing `AIMatchModal` style):

- **`rankApplicants(campaign, applications, db)`** → 0-100 fit score
  per applicant + ordered `reasons[]` + optional `flags[]`. Factors:
  category fit (40) · region (15) · tier-vs-budget (12) · rating (12) ·
  verified (8) · engagement (8) · reply time (5) · availability /
  proposed-rate sanity adjustments. Returns sorted highest-first.

- **`suggestRate(creator, campaign, brand, db)`** → `{ recommended,
  lower, upper, reasons, confidence }`. Anchors on tier band
  (Rising $1.2k / Specialist $3.5k / Flagship $8k mid), scales by
  reach (clamped 0.6–1.6×), blends with past accepted-offer rates
  from this brand × creator's tier when ≥ 2 datapoints exist
  (confidence flips to `high`), caps at 60% of remaining budget.
  Round to $50.

- **`summarizeThread(thread, messages, db, forUserId)`** → `{ summary,
  highlights[], nextAction? }`. Mock NLP: extracts amounts, names,
  campaign, last-replier; produces a 1-line summary, a chip strip
  (Campaign / Stage / Amounts / Last reply / Messages count), and a
  next-action heuristic ("Answer their question", "Decide on the rate",
  "Review their submission").

### Surface 1 — AI applicant ranker in Pipeline tab

`/brand/campaigns/:id` → Pipeline tab. When the **Applied** column has
≥ 3 applicants, a dismissable banner above the board:

> **N applicants in *Applied*. Want help triaging?**
> AI ranks each by category × tier × rating × engagement, with reasoning per row.
> [ Rank with AI ]

Clicking opens **AIRankModal** — a 760px-wide modal with:

- An intro chip explaining the scoring weights (transparent: "category
  fit (40), region (15), tier-vs-budget (12), rating (12), verified (8),
  engagement (8), reply (5)")
- Ranked rows, each with:
  - Rank number (#1, #2…)
  - Portrait button (click → opens `CreatorProfileDrawer`)
  - Name (click → profile)
  - **Reason chips** in tier-coloured fill ("Matches Beauty category",
    "★ 4.8 rating", "Verified profile")
  - **Concern flags** in red ("Currently booked", "Low engagement
    (1.2%)")
  - Big serif **score 0-100** with a tier-coloured meter (great ≥ 75 ·
    good ≥ 50 · fair ≥ 30 · low otherwise)
  - **Shortlist** button (calls existing `decideApp` handler, removes
    them from the Applied column, modal stays open so brand can
    quickly batch-shortlist)

### Surface 2 — AI pricing suggestion in offer modal

When the brand opens "Send offer to {creator}" anywhere in the
campaign-detail page, the modal now has a chromatic accent block at
the top of the form:

> ⚡ AI rate suggestion · {confidence}
> **[$3,500]** Range $2,800 – $4,200
> *Specialist tier baseline · Avg of 4 past Specialist accepts · Reach 480k*

Clicking the recommended-rate pill applies it to the rate input. The
3 reasons show the math the suggestion used. `confidence: 'high'` when
≥ 2 past accepted-offer datapoints exist for this brand × creator's
tier. Reasoning is short and concrete — no marketing-speak.

### Surface 3 — Inbox TL;DR for long threads

In `InboxView`, when a thread has **≥ 8 messages**, an AI summary block
appears between the pane header and the message bubbles:

> ⚡ AI summary · 14 messages
> **Sarah on "Spring drop" — at the offer stage. Awaiting your reply.**
> [ Campaign: Spring drop ] [ Stage: offer ] [ Amounts: $3,500, $4,000 ]
> [ Last reply: Sarah ] [ Messages: 14 ]
> **Next:** Decide on the rate

Collapsible via a ▾ toggle (state local to the open thread). Hidden for
short threads (where it'd just be noise).

### CSS

`PHASE 17 · AI-assist surfaces` block in `screens.css` (~370 lines):

- `.pipeline-ai-bar` — 3-col tile with chromatic 3px left border, accent
  circle icon, serif nudge, action button
- `.ai-rank-list` / `.ai-rank-row` (with `.tier-{great|good|fair|low}`
  variants) / `.ai-rank-rank` / `.ai-rank-portrait-btn` /
  `.ai-rank-name-btn` / `.ai-rank-reasons` (chip strip in tier-coloured
  fill) / `.ai-rank-flags` (red chip strip) / `.ai-rank-score` (big
  serif + meter) / `.ai-rank-actions`
- `.ai-pricing` — accent-tinted block with 3px left border / `.ai-pricing-pill`
  (clickable serif amount in pill form) / `.ai-pricing-band` /
  `.ai-pricing-reasons` (mono meta line)
- `.inbox-tldr` — accent-tinted block with 3px left border /
  `.inbox-tldr-icon` (circular accent) / `.inbox-tldr-toggle` /
  `.inbox-tldr-summary` (serif body) / `.inbox-tldr-highlights`
  (key/value chips) / `.inbox-tldr-next` (with accent "Next:" prefix)

### Files touched

- New: `app/src/lib/utils/ai-helpers.ts` (~280 lines)
- Modified: `app/src/screens/brand/CampaignDetail.tsx` (Pipeline AI bar
  + AIRankModal + AI pricing block in offer modal)
- Modified: `app/src/components/inbox/InboxView.tsx` (TL;DR widget for
  long threads)
- Modified: `app/src/styles/screens.css` (+~370 lines)

### Phase 17 build size (snapshot)

`242 KB initial / 68 KB gzip` (initial unchanged — AI lands in lazy
chunks):
- Brand `CampaignDetail`: 37.7 → 41.4 KB (+4 KB) for AI rank modal +
  pricing block
- `InboxView`: 11.7 → 12.8 KB (+1 KB) for TL;DR widget

### Verification checklist

- [x] AI rank bar appears when Applied column has ≥3 applicants
- [x] AI rank modal lists every Applied applicant ranked highest-first
- [x] Each row shows score, reasons, concerns, with tier colour-coding
- [x] Inline Shortlist button dispatches existing handler
- [x] Pricing suggestion appears in offer modal with confidence chip
- [x] Click suggested-rate pill applies it to the input
- [x] Confidence flips to "high" when past data exists
- [x] Inbox TL;DR shows on threads with ≥8 messages
- [x] TL;DR collapsible via ▾ toggle
- [x] Highlights surface campaign + stage + amounts + last replier + count
- [x] Next-action heuristic varies by content (question / counter /
      revision / production / generic)
- [x] All AI surfaces transparent — show their reasoning
- [x] Build clean, no TS errors

---

## ✅ Phase 17.5 — Final QA pass (shipped)

After 17 feature phases, ran a real bug hunt. Build was clean
(zero warnings) but several issues lurked in cross-phase interactions
that no individual phase had reason to test.

### Bugs found and fixed

**1. Phase-16 kcard restructure regression** (high-impact, visual)

The Phase-16 split of `<button class="kcard">` into `<div class="kcard">`
+ inner `<button class="kcard-body-btn">` (to allow nested move-trigger)
broke two layout properties that lived on the original button:

- `padding: 12px 12px` stayed on the wrapper. Inner button got
  `padding: 0`. Result: the 12px padding ring was un-clickable — clicks
  on the visible edge of the card hit the wrapper which had no onClick.
- `display: flex; flex-direction: column; gap: 6px` stayed on the
  wrapper. Inner content (meta / title / foot) was now nested in a
  `display: block` button, so the 6px gaps collapsed and the rows
  visually crammed together.

**Fix.** Moved both properties to `.kcard-body-btn`:
```css
.kcard { padding: 0; display: block; }
.kcard-body-btn {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px 12px;
}
```
Wrapper is now an unstyled box for layout / drag-handle / position
context; inner button is the visible padded card. `.kcard-move-trigger`
position (6px from corner) was unchanged; it now sits 6px from the
absolute corner instead of 18px (was inside the wrapper's padding-box),
which is actually closer to the Linear / Notion overflow-menu
convention.

**2. Five places redirected to `/home` instead of `/today`** (high-impact, UX)

Phase 4 (Today screens) made `/today` the role-default landing.
Phase 14 (lazy routes) kept `/today` eager and made `/home` lazy. But
five places in the auth + role-switch + role-bounce flows still hard-
coded `/home`:

- `SignIn.tsx` `goAfterAuth()` — sign in → `/creator/home` or `/brand/home`
- `SignUp.tsx` after `signUp()` — same pattern
- `Cover.tsx` `continueHref` — the "Continue to workspace" button shown
  to already-signed-in users hitting `/`
- `Sidebar.tsx` `switchRole()` — when a user switches creator ↔ brand
  via the demo role-switch, target was `/home`
- `ProtectedRoute.tsx` wrong-role bounce — when an authenticated user
  with the wrong role hits a route, we redirect to their own role's
  default; was `/home`, should be `/today`

User impact: every authenticated-render path triggered an extra lazy-
chunk fetch (Home is lazy) to land somewhere that isn't the canonical
default. The Today eagerness from Phase 14 was wasted — nobody was
landing there from auth.

**Fix.** Updated all five to redirect to `/today` for creator/brand
and `/admin/home` for admin (eagerly loaded in all three cases).
First authenticated paint is now instant — no skeleton flash.

**3. Vestigial `(savedViews.length > 0 || true)` always-true guard**
(low-impact, code hygiene)

Phase 13's saved-views row had a misleading `||  true` that made the
whole conditional always evaluate to `true`. Cleaned up to express
the always-render intent directly.

### Confirmed not bugs (during the sweep)

- Remaining `/creator/home` / `/brand/home` references in `nav.ts` (the
  sidebar Home item) and `client.ts` (notification deep-links for team
  invite, manager add, application approval) are deliberate — Home is a
  real, separate destination from Today and the notifications point to
  it as the role's "welcome screen."
- All `useEffect` hooks have correct dep arrays (re-checked).
- All icon-only buttons have `aria-label`.
- No hard-coded hex / rgb / named colors anywhere — Phase 1's OKLCH-
  over-tokens discipline held across all 17 phases.
- `useState` initializer for saved-views wraps `JSON.parse` in try/catch
  for SSR / private-mode / quota cases.
- AI rank modal correctly re-computes when applications array mutates
  mid-modal (after a shortlist action).
- All Phase 9+ filter URL state round-trips correctly.

### Build (post-QA)

`242 KB initial / 68 KB gzip / 0 warnings / 50 chunks / 157 modules`

### Second pass (deeper sweep)

After fixing the first round of bugs, did a second pass focused on
async cleanup, modal/drawer a11y, form double-submit, and z-index
conflicts. Three more issues found and fixed:

**4. `Modal` was missing `role="dialog"` / `aria-modal="true"` / focus
trap / focus return** (medium-high impact, a11y)

The shared Modal component had a real Escape handler and body scroll
lock, but no proper dialog semantics. Screen readers treated it as
generic content; keyboard users could Tab into elements behind the
backdrop; closing didn't return focus to the trigger.

**Fix.** Rewrote `Modal.tsx`:
- Added `role="dialog"`, `aria-modal="true"`, `aria-labelledby="modal-title"`
- Implemented focus trap on `Tab` / `Shift+Tab` — cycles within the
  dialog using a `FOCUSABLE_SELECTORS` list
- Auto-focus first focusable on open (skips the close × so first
  content focus is more useful)
- Snapshot the opener element on open (`document.activeElement`),
  return focus to it on close via `setTimeout(0)` so React unmounts first
- Wrapped Escape preventDefault so it doesn't bubble to other handlers

**5. `CreatorProfileDrawer` had no Escape handler, no dialog role, no
body scroll lock** (medium impact, a11y + UX)

The remaining drawer in the app (after Phase 5 deleted the campaign-
detail drawers) was click-outside-only. Keyboard users had no way to
dismiss; screen readers got no dialog signal; underlying page kept
scrolling.

**Fix.** Added a `useEffect` that:
- Listens for `Escape` → calls `onClose`
- Sets `document.body.style.overflow = 'hidden'` on mount, restores
  prior value on cleanup
- Added `role="dialog"`, `aria-modal="true"`, `aria-label={creator.name + ' profile'}`
  to the `.drawer` element

**6. Z-index hierarchy verified — no actual conflicts** (none, audit only)

Audited every `z-index` declaration in `app/src/styles`:
- Skip-link: 9999 (above everything, intentional)
- Notifications popup: 300
- Modal backdrop: 100
- Bulk-bar (sticky bottom): 80
- Sticky landing top nav: 50
- Campaign-detail sticky header: 30
- Workspace shell sticky elements: 1-2

The only stack that could conflict: notifications popup (300) opens
*above* an open modal (100). That's intentional — notifications need to
remain reachable from any state. Click-through is impossible because
modal-backdrop blocks the bell.

### Confirmed during second pass (not bugs)

- All `addEventListener` (15 total) have matching `removeEventListener`
  (14 component-scoped + 1 module-level for cross-tab store sync that
  intentionally persists).
- All async action handlers in screens (sendOffer, decideApp,
  approveSubmission, etc.) gate on `busy` state to prevent double-
  submit. Buttons set `disabled={busy}` via the Button component.
- `tx()` wrapper in store.ts properly clones every array each
  transaction. The two raw `setDB` calls in NotificationsBell only
  update the `notifications` array which is functionally equivalent
  but stylistically inconsistent — left as-is since it works.
- Error boundary at app root catches lazy chunk failures with a
  recovery panel (Try again / Go home / Hard reset).
- Toast pub/sub bus is leak-free: subscribers cleaned up in `useEffect`,
  setTimeout dismissals are idempotent (filter by id).

### Build (post-second-pass)

`243 KB initial / 69 KB gzip / 0 warnings / 50 chunks / 157 modules`
(+1 KB for Modal focus trap + a11y additions)

---

## ✅ Phase 18 — Landing page reborn (shipped)

**Goal.** The landing was editorial-beautiful but suffered from three
problems: one-size-fits-all copy (sophisticated marketers AND under-
educated creators read the same words), static (readable but not
mesmerizing), and information overload (13 sections of text-heavy
content). User asked for outside-the-box ideas to mesmerize, retain,
and push exploration — with simpler language for creators and sharper
value props for brands.

Used the **`ui-ux-pro-max` skill** to anchor the design strategy:
hybrid of "Product Demo + Features" (Pattern 1: "interactive mockup
increases engagement") and "Hero + Features + CTA" (Pattern 4) with
the warm-editorial style we already have.

### Five new components

**`usePersona` hook** — `app/src/lib/utils/usePersona.ts`
- Persisted to `localStorage` AND mirrored to `?p=creator|brand` URL
  param, so links shared from social default to the right slant.
- Default `creator` (the harder audience to land — easier copy needed).
- `popstate` listener keeps in sync with browser back/forward.

**`PersonaToggle`** — `app/src/components/landing/PersonaToggle.tsx`
- Pill-shaped segmented control "I'm a [Creator | Brand]"
- Active option fills with ink; subtly tinted (warm for creator, cool
  for brand) via gradient
- `role="radiogroup"` with proper `aria-checked` per option
- Sits at the top of the hero, sets the page persona

**`LiveTicker`** — `app/src/components/landing/LiveTicker.tsx`
- Marquee-style horizontal scroll of mock activity (60s loop)
- Pulls real seed data: top payouts ("Sarah got paid $1,200"), recent
  applications, just-posted campaigns, top reviews
- Items shuffled per render so it feels fresh
- "Live now" pulse-dot label with chromatic accent
- Pauses on hover; respects `prefers-reduced-motion`
- Items duplicated once for seamless loop without visible jump

**`AnimatedCounter`** — `app/src/components/landing/AnimatedCounter.tsx`
- Counts from 0 to target value when scrolled into view
- `IntersectionObserver` (threshold 0.4) fires once per mount
- `requestAnimationFrame` with cubic-out ease for smooth landing
- Optional `delay` for staggered KPI rows
- Reduced-motion users see final value immediately
- Used for the 4 trust-counter KPIs under the hero

**`DealDemo`** — `app/src/components/landing/DealDemo.tsx`
- The centerpiece. Interactive "Watch a deal happen" demo.
- 5-stage horizontal timeline: Brief → Apply → Offer → Make → Paid
- Each stage has a chromatic dot with done/current/pending state and
  a connector line that fills as we progress
- Auto-advances every 4.5s, pauses on hover or click, restarts after
  8s of inactivity
- **POV toggle** flips between Creator and Brand perspective — the
  visuals AND captions completely change
- Per-stage mini-mockups (no images, all styled divs / inline SVG):
  - **Brief:** brand-side shows a populated brief form with pulsing
    Publish button; creator-side shows discoverable campaign cards
    with the active one sliding into highlight
  - **Apply:** creator-side has typing-animation pitch + rate;
    brand-side has a stack of incoming applicants with a NEW pill
    sliding in
  - **Offer:** offer card with rate, italic message, Counter/Accept
    buttons (creator) or status badge (brand) + trust note
  - **Make:** round-1-approved + round-2-in-progress with a fill bar
    + escrow money-held line
  - **Paid:** creator-side wallet ticking $0 → $2,500 with bounce
    animation; brand-side ROAS panel with 4-cell stats + 9.9× return
- All animations respect `prefers-reduced-motion`

**`EarningsCalculator`** — `app/src/components/landing/EarningsCalculator.tsx`
- Persona-aware sliders + tier chips
- **Creator side**: "How much could I earn?" — sliders for follower
  count (5k–2M) + posts/month (1–10) + tier chips. Output: monthly
  earnings band ($X–$Y) with 3 reason chips ("Specialist tier
  baseline", "150k reach × 4 posts", "Pakistan rates skew 0.7×").
- **Brand side**: "What's a fair budget?" — chips for goal (reach /
  sales / retainer), region (PK/IN/USA/EU/global), creator size
  (rising/specialist/flagship). Output: budget band with reasoning.
- Heuristics: tier baseline × reach/region/goal multipliers, rounded
  to clean numbers ($50 / $500 increments). Same math style as the
  Phase-17 `suggestRate` helper but exposed at the marketing surface.
- Chromatic accent left border (3px) on the calculator tile for
  visual prominence.
- Custom-styled range inputs with accent-coloured thumb (22px) +
  cross-browser fallbacks (`-webkit-`, `-moz-`).

### Cover.tsx restructured

Old: 13 sections of mixed-density text. New: 11 sections, all driven
by persona, with the dense ones broken into interactive surfaces.

```
1. Sticky glass nav
2. Hero — persona toggle + dynamic headline + lede + dual CTA + trust
   mini-row + portrait wall
3. Live ticker (full-width, glass, marquee)
4. 4 animated KPI counters with persona-aware first column ($ paid to
   creators / count of verified creators)
5. Interactive Deal Demo (id="deal-demo")
6. Persona-aware 3-bullet value props (in plain language for creators,
   sharp for brands)
7. Earnings/Budget Calculator (id="calc")
8. Live now (existing — campaigns + creators)
9. Voices (testimonials filtered by persona — different quotes,
   different photos)
10. Brand wall
11. FAQ — tightened to 4 essential questions, persona-specific copy
12. Final CTA — persona-aware headline + "I'm a {other}" toggle CTA
13. Footer
```

### Plain-language copy for creators

Replaced jargon with plain words on the creator-facing variant:
- "escrow" → "money held safe" / "money is held safe"
- "brief" → "campaign details" / "what they want"
- "ROAS" → just dropped (creators don't need this)
- "shortlist" → kept (common word)
- "deliverables" → kept in inputs (industry standard)

Creator hero: **"Get paid for your work. Easy."** → "Brands send you
offers. We hold the money. They pay you when you're done. That's it."

Brand hero: **"Brief in 5 minutes. Pay only what works."** → "Real
creators apply within the hour. Escrow holds your money until they
deliver. Track every result."

Creator FAQ has its own 4 questions (How does Alamut make money? When
do I get paid? What if work isn't approved? Do I need a media kit?).
Brand FAQ has different 4 (Cost? Escrow protection? Bad work? Team
seats?).

### Visual polish

- Hero: persona toggle warmly tinted (warm gradient when creator
  selected, cool when brand)
- Headline morphs with a 520ms blur-in animation on persona swap
- Trust mini-row under CTA shows green checkmarks: "Free to sign up ·
  No card required · You keep 100% of the rate" (creator) or
  "5% platform fee, no agency markup" (brand)
- Live ticker has a chromatic accent gradient mask so items fade in
  from the right
- KPI counters use serif Fraunces with `font-feature-settings: "tnum"`
  for tabular numerals (no width jiggle as digits change)
- Deal demo has a subtle accent radial-gradient backdrop
- Calculator result has a chromatic glow + tabular numerals
- All new tiles have cursor halo via the existing `TileHalo`
  component (registered via the `.land-bullet` selector)

### CSS

`PHASE 18 · Landing page reborn` block in `landing.css` (~870 lines):

- `.persona-toggle` (with `.persona-toggle-lg` size + warm/cool active
  variants per persona)
- `.land-hero-h` headline morph keyframe
- `.land-hero-cta-secondary` (dashed-underline link with arrow slide)
- `.land-hero-trust` (green-checkmark mini row)
- `.live-ticker` + `.live-ticker-track` 60s scroll keyframe + label
  pulse + hover-pause
- `.land-kpis-new` 4-column grid + `.land-kpi-new-v` serif huge number
- `.deal-demo` + timeline + per-stage dot states + connector fill +
  caption fade-in + stage frame radial gradient
- `.dd-*` per-stage mockup classes (brief / discover / apply /
  applicants / offer / make / paid / roas) with their own animations
  (typing, slide-in, bar-fill, pop-in)
- `.land-bullets-3` value-prop grid with cursor halo
- `.calc` calculator with custom-styled range inputs + tier chips +
  result panel with radial-gradient glow
- All animations respect `prefers-reduced-motion`
- Mobile breakpoint at 700px collapses gridded elements to single column

### Files touched

- New: `app/src/lib/utils/usePersona.ts` (~55 lines)
- New: `app/src/components/landing/PersonaToggle.tsx` (~40 lines)
- New: `app/src/components/landing/LiveTicker.tsx` (~95 lines)
- New: `app/src/components/landing/AnimatedCounter.tsx` (~65 lines)
- New: `app/src/components/landing/DealDemo.tsx` (~370 lines, 6 inline
  mockup components + dispatch + auto-advance)
- New: `app/src/components/landing/EarningsCalculator.tsx` (~210 lines,
  creator + brand variants + heuristic functions)
- Rewritten: `app/src/screens/cover/Cover.tsx` (~370 lines, persona-
  aware throughout)
- Modified: `app/src/styles/landing.css` (+~870 lines)

### Phase 18 build size (snapshot)

`260 KB initial / 73 KB gzip / 0 warnings / 51 chunks / 158 modules`
(+17 KB JS / +5 KB gzip from 243/68 baseline)

The new components live in the eagerly-loaded `index` chunk because
Cover is the root route. 17 KB is reasonable for a first-impression
surface that gets every cold visit. The deal-demo alone (~10 KB) is
the biggest single addition and arguably the most retentive feature
on the entire site.

### Verification checklist

- [x] Persona toggle changes hero headline, lede, CTA labels, trust
      mini-row, value-prop bullets, calculator, voices, FAQ, final CTA
- [x] Persona persisted to localStorage + URL ?p= param
- [x] Headline morphs with blur-fade animation on persona swap
- [x] Live ticker pulls real seed activity, scrolls smoothly, pauses
      on hover, loops seamlessly via doubled item list
- [x] KPI counters animate from 0 on scroll-into-view, ease-out cubic
- [x] Deal demo: 5 stages, dots fill as we progress, auto-advances
      every 4.5s, pauses on hover, restarts after 8s of inactivity
- [x] POV toggle inside deal demo flips visuals + captions per stage
- [x] All 5 stages have their own mini-mockups with stage-specific
      animations (typing, sliding, bar-fill, pop)
- [x] Calculator sliders work with keyboard, reasoning chips update
- [x] FAQ: 4 questions per persona, different content
- [x] Voices: 3 testimonials per persona with different photos
- [x] Final CTA has "I'm a {other}" cross-link to flip persona
- [x] All copy on creator side avoids jargon (escrow → money held
      safe, etc.)
- [x] Mobile-responsive at ≤700/800px breakpoints
- [x] All animations respect `prefers-reduced-motion`
- [x] Build clean, no TS errors, no warnings

---

## ✅ Phase 18.5 — Editorial chrome, infographics, comparison (shipped)

A second pass on the landing page after the user feedback _"add elements
that are creative out of the box that includes cool animations. also the
'I'm brand'/'creator' toggle font is weird — it needs to sync with the
rest of the font."_

The Phase 18 page worked but felt flat between the deal-demo and the
calculator. This pass adds editorial structure, two retention-driving
marquees, an animated "how the money moves" infographic, and a
side-by-side comparison of Alamut vs the alternative. The result is a
chaptered scroll that earns each section's space rather than flowing as
one undifferentiated stream.

### What shipped

**1. Persona-toggle font fix** — the toggle was using Fraunces serif at
16-18px next to a mono uppercase "I'm a" label, creating a typographic
clash. Switched both label and options to Switzer sans (`var(--sans)`),
unified weight 500, removed uppercase + letterspacing on the label,
sized 13/14px for visual rhythm with the rest of the page.

**2. ScrollProgress** (`ScrollChrome.tsx`) — chromatic 2px line at the
top of the viewport that fills as you scroll. Five-stop OKLCH gradient
(coral → amber → sage → blue → magenta) cycling slowly so the bar feels
alive even when stationary. rAF-throttled scroll listener.

**3. StickyMiniCta** (`ScrollChrome.tsx`) — small floating "Sign up
free" / "Start a campaign" pill bottom-right, fades in past 0.85
viewport scroll, dismissable. Persona-aware label + href. Stays out of
the way until the visitor is engaged enough to convert.

**4. EditorialDivider** — magazine-style numbered chapter heads. Big
italic Fraunces "01" with an accent-colored chapter title, optional
subtitle, and a hairline rule that scales in. Five chapters now
structure the scroll: 01 How a deal works · 02 Why Alamut · 03 Run the
numbers · 04 A living marketplace · 05 In their own words. Reveals via
new shared `useInView` hook.

**5. CreatorMarquee** — replaces the static 6-portrait row in the hero
with two counter-scrolling bands of 16 top creators (sorted by
`lifetimeEarnings`). Hover reveals an overlay with name + earnings or
reach. Doubled list for seamless looping. Pauses on hover. Faded edges
via CSS mask.

**6. CategoryRibbon** — auto-scrolling chromatic band of 14 creator
categories under the live ticker (Beauty, Fashion, Food, Wellness,
Travel, Design, Lifestyle, Tech, Sustainability, Interiors,
Photography, Music, Newsletter, Gaming). Each tag is tinted with its
own OKLCH stage hue, with a glowing dot. Communicates breadth at a
visual glance, no reading required.

**7. MoneyFlow** — animated 3-node infographic: _Brand puts money in →
We hold it safe → You get it_. Inline SVGs (briefcase, vault, wallet),
each node colored by hue (sky / coral / emerald). Three flowing dots
travel between nodes on a 2.4s loop, color-matched to the destination.
A pulsing ring around the central vault emphasizes "money is held
safe." Three numbered captions below restate the flow in plain
language — specifically built for low-literacy creators who'd glaze
over at the word "escrow." Reveals stagger via `useInView`.

**8. ComparisonStrip** — persona-aware side-by-side table:
   - Brand persona: vs traditional agency (markup, time-to-creator,
     money safety, ROAS, contracts, switch costs)
   - Creator persona: vs DMs / cold email (how brands find you, money
     before work, time to get paid, contracts, negotiation, disputes)

   Six rows each. Alamut column tinted emerald, alternative column
   tinted coral. Rows stagger in (60ms apart) on viewport entry via
   `--row-delay` CSS variable.

**9. useInView hook** — `lib/utils/useInView.ts`. Shared
IntersectionObserver hook used by EditorialDivider, MoneyFlow, and
ComparisonStrip. Disconnects after first intersection, returns visible
immediately for `prefers-reduced-motion` users.

### Page structure (Phase 18.5)

    Hero (persona toggle + headline + CTA + creator-marquee replacing portraits)
    Live ticker
    Category ribbon ✨ NEW
    KPI counters
    Editorial 01 / How a deal works ✨ NEW
    Deal demo
    Money flow ✨ NEW
    Editorial 02 / Why Alamut ✨ NEW
    3-bullet value props
    Comparison strip ✨ NEW
    Editorial 03 / Run the numbers ✨ NEW
    Earnings calculator
    Editorial 04 / A living marketplace ✨ NEW
    Live now (campaigns + creators)
    Editorial 05 / In their own words ✨ NEW
    Voices
    Brand wall · FAQ · Final CTA · Footer
    Sticky mini CTA (floats throughout) ✨ NEW

### Files added (Phase 18.5)

- `app/src/lib/utils/useInView.ts` (~45 lines)
- `app/src/components/landing/ScrollChrome.tsx` (~95 lines, 2 components)
- `app/src/components/landing/EditorialDivider.tsx` (~30 lines)
- `app/src/components/landing/CreatorMarquee.tsx` (~75 lines)
- `app/src/components/landing/MoneyFlow.tsx` (~90 lines)
- `app/src/components/landing/CategoryRibbon.tsx` (~50 lines)
- `app/src/components/landing/ComparisonStrip.tsx` (~95 lines)
- `app/src/styles/landing.css` (+~600 lines, Phase 18.5 block)
- Modified: `app/src/screens/cover/Cover.tsx` (chapter wiring, marquee
  swap, MoneyFlow + ComparisonStrip insertions)

### Phase 18.5 build size

`273 KB initial / 76 KB gzip · 248 KB CSS / 38 KB gzip · 0 warnings`
(+13 KB JS / +3 KB gzip from Phase 18). Six new components and
five hundred-plus lines of CSS for ~3 KB additional gzipped is the
right tradeoff for a first-impression surface — every retention
addition pays for itself if it earns one extra signup per thousand
visitors.

### Verification checklist (Phase 18.5)

- [x] Persona toggle font now matches body sans (Switzer 14px medium)
      with a quiet "I'm a" label in 13px ink-60
- [x] Scroll progress bar fills smoothly with chromatic cycling hue
- [x] Sticky mini CTA appears past hero, dismissable, persona-aware
- [x] Five editorial chapter dividers reveal sequentially on scroll
      (numbered serif italic + accent title + scaling rule)
- [x] Creator marquee scrolls in opposite directions, pauses on hover,
      reveals earnings overlay on hover, loops seamlessly
- [x] Category ribbon scrolls left → right, each tag tinted by its
      stage hue with a glowing chromatic dot
- [x] Money flow's three dots animate continuously between nodes,
      vault has pulsing ring, captions reveal staggered on entry
- [x] Comparison strip persona-aware (agency for brand, DMs for
      creator), six rows stagger in 60ms apart
- [x] All animations respect `prefers-reduced-motion`
- [x] Mobile responsive at ≤700/800px (money-flow goes vertical with
      animated dots traveling top→bottom; comparison stacks columns)
- [x] Build clean: `tsc -b && vite build` 3.93s, 0 warnings, 0 errors

### Phase 18.5 follow-up — QA defects fixed

A parallel deep-audit agent reviewed every landing component after
shipping and surfaced concrete defects. The high-impact fixes were
applied immediately:

**Critical (a11y / correctness)**
- `AnimatedCounter` — when `delay > 0`, the `setTimeout` ID was being
  passed to `cancelAnimationFrame` on cleanup, leaking the timer and
  potentially calling `setState` on an unmounted component. Now tracks
  `timeoutId` separately and clears with `clearTimeout`.
- `PersonaToggle` — `role="radiogroup"` previously had no keyboard
  navigation. Per WAI-ARIA Radio Group pattern: now uses roving
  `tabIndex` (only the checked option is in the tab order), and Arrow
  keys / Home / End cycle through and select options.
- `DealDemo` POV toggle — same WAI-ARIA radiogroup fix applied.
- `DealDemo` — `onMouseLeave` was unconditionally resuming autoplay,
  killing the 8-second click-restart window. Now bails when
  `restartRef` is set (post-click protection).
- `DealDemo` tab dot — `aria-labelledby` referenced an `id` that never
  existed. Added `id={\`deal-demo-tab-${stage.id}\`}` to the dot
  button + roving `tabIndex` for the tablist.
- `LiveTicker` — `role="marquee"` is not a valid ARIA role. Removed
  (the visually-hidden "Live now" label conveys intent).

**Major**
- `Cover.tsx` value-prop bullets — keys changed from array index to
  `${persona}-${b.t}` so React doesn't reuse DOM nodes across persona
  swaps (which would skip animation and create stale visuals).
- `Cover.tsx` live-now campaign cards — aria-label said "View {title}"
  but the click navigated to signup. Now says "Apply to {title} —
  sign up as creator", matching the actual action.
- `Cover.tsx` redundant section-heads — removed the duplicate
  "Live right now" and "In their words" sub-heads since the editorial
  chapter dividers above already speak for those sections.
- `CreatorMarquee` — when `ranked.length` was small, the second row
  could render empty. Now collapses to a single row when fewer than
  4 creators exist.

**Minor polish**
- `category-tag` had a hover transform but tags aren't interactive —
  removed the misleading lift effect and added `user-select: none`.

Build still clean: `tsc -b && vite build` 5.66s, 0 warnings, 0 errors.

---

## ✅ Phase 19 — Platform-wide critical bug fixes (shipped)

After the landing-page work, three parallel deep-audit agents reviewed
the rest of the platform — all 28 in-app screens (creator × 10, brand
× 10, admin × 6, auth × 2, public storefront), shared layout shell,
shared UI components, design tokens, and cross-cutting concerns
(accessibility, mobile, dark mode, performance). The audits surfaced
~95 distinct findings; 9 critical defects were fixed in this phase.

### What shipped

**1. Creator escrow math now handles every payment model**
(`creator/CampaignDetail.tsx:160-163`) — the previous binary heuristic
(`mySubs.find(approved) ? full : half`) only worked for fixed-rate
deals. Milestone deals (e.g. 30/50/20) and outcome/retainer payouts
showed wrong "Released" and "In escrow" KPIs across the page. Now
sums actual cleared `payout` transactions for this campaign + this
creator's user — works for every pricing model.

**2. Rules of Hooks violation in brand campaign detail**
(`brand/CampaignDetail.tsx:151`) — `useMemo` was being called after
the early returns on `!brand` and `!fresh`. If a campaign was deleted
mid-session, React would throw "fewer hooks rendered than expected."
Hoisted the memo above the early returns and pushed the missing-data
guard inside the memo body.

**3. Stage-jump confirmation for risky transitions**
(`brand/CampaignDetail.tsx:327-339`) — the campaign stage progress bar
let a brand click any stage to advance, including jumping multiple
stages forward or *backward*, with no confirmation, even when escrow
was in flight. Adjacent forward jumps stay click-only (the common
case). Backward jumps and skip-aheads now route through `confirmAction`
with money-aware copy ("$X is held in escrow — make sure obligations
are settled").

**4. Dispute resolution money validation + auto-fill**
(`admin/Disputes.tsx`) — the form previously accepted "resolve for
creator" with $0 released, or release+refund amounts that didn't sum
to the held escrow. Added validation:
   - Negative amounts rejected
   - Release + refund must equal escrow held
   - "For creator" requires full release; "for brand" requires full refund
   - "Split" requires non-zero on both sides

   Plus pre-fill: clicking a decision auto-populates the amounts based
on the chosen outcome, and opening the modal pre-fills a 50/50 split.
Operator can still adjust, but no longer types the escrow figure
manually each time.

**5. Latest-offer bug** (`brand/Approvals.tsx:107, 114`) — `find()`
returned the FIRST accepted offer instead of the latest. After a
counter+re-offer flow, the approval modal showed the stale original
rate. Walks offers in reverse now: `[...db.offers].reverse().find(...)`.

**6. Per-decision busy state on application triage**
(`brand/Today.tsx:241-249`) — Decline and Shortlist buttons shared
`busy === \`app-${id}\``, so both spun together regardless of which
was clicked. Busy key is now `app-${id}-${decision}`, so only the
clicked button spins. Both disable while either is in flight to
prevent double-decide races.

**7. Safe URLSearchParams mutation** (`brand/Wallet.tsx:38-44`) — the
`?topup=1` cleanup was mutating the `URLSearchParams` instance returned
by `useSearchParams` directly, which is unsafe with React state and
can cause stale renders. Now builds a fresh `new URLSearchParams(params)`
copy before passing to `setParams`.

**8. `aria-current="page"` on active sidebar nav**
(`layout/Sidebar.tsx:178`) — the visual `is-on` class was the only
"active" cue. Screen-reader users had no signal indicating the current
page. Added `aria-current={active ? 'page' : undefined}` to NavLinkItem.

**9. Subject-verb agreement** (`creator/Today.tsx:64-66`) — "1 thing
**need** you" now reads "1 thing **needs** you" / "5 things **need**
you" via `total === 1 ? 'needs' : 'need'`.

### Audit framework deliverable

The Phase 19 work was triggered by — and produced — a structured
platform-wide audit report. See the synthesis at the end of session
chapter "Platform-wide UX audit" for the full prioritized improvement
plan, including:

- **Phase 20 (cross-vertical patterns)** — centralize label maps (kills
  ~20 raw-enum-leak findings), `find()` → `findLast()` audit, build
  `useHotkeys` + `?` overlay, propagate `pushUndoToast`, propagate
  bulk-select pattern, inbox keyboard nav, modal a11y fixes.
- **Phase 21 (vertical polish)** — Brand approvals files lightbox,
  admin Queue risk flags + reason capture + bulk approve, creator
  storefront polish, empty-state pass.
- **Phase 22 (strategic features)** — risk flags, cross-tab moderation
  presence, saved searches, diff view, campaign templates.

### Phase 19 build size

`273 KB initial / 76.77 KB gzip · 0 warnings · 0 errors · built in 5.67s`
(no meaningful change from Phase 18.5 — these are correctness fixes,
not feature additions).

### Verification checklist (Phase 19)

- [x] Creator with a milestone deal sees correct Released / In Escrow
      KPIs that match the sum of actual payouts
- [x] Brand on a campaign that's deleted between renders no longer
      crashes; sees "Campaign not found" empty state
- [x] Backward stage jump or skip-ahead requires confirmation; single-
      step forward stays click-only
- [x] Admin cannot resolve a dispute with mismatched release+refund
      amounts; cannot resolve "for creator" with $0 released
- [x] Brand on Approvals after a counter+re-offer sees the LATEST
      accepted rate in the modal
- [x] Brand on Today applications: clicking Decline only spins Decline,
      clicking Shortlist only spins Shortlist
- [x] Wallet `?topup=1` deep-link opens the topup modal and cleans
      the URL without stale-render issues
- [x] Screen-reader user navigating the sidebar hears the current
      nav item announced as "current page"
- [x] Today.tsx headline grammatically correct for 1 vs N things
- [x] Build clean, 0 warnings, 0 errors

---

## ✅ Phase 20 — Cross-vertical platform patterns (shipped)

The Phase 19 audit produced a prioritized improvement plan grouped by
effort × impact. This phase shipped the **cross-vertical patterns** —
the highest-leverage tier, where a single piece of work knocks out
5-15 findings across creator, brand, and admin surfaces.

### What shipped — foundations

**`lib/utils/labels.ts`** — single source of truth for every domain
enum's user-facing label and Pill tone. Exports typed `Record<>` maps
plus convenience helpers (`stageLabel(s)`, `txTone(k)`,
`offerStatusLabel(o)`, `disputeReasonLabel(r)`, `applicationStatusTone(s)`,
etc.) for all 12 domain enums (CampaignStage, ApplicationStatus,
OfferStatus, SubmissionStatus, TxKind, TxStatus, DisputeStatus,
DisputeReason, CreatorTier, TrustTier, CampaignKind, PricingModel,
UserStatus, ReferralStatus). Each helper title-cases unknown values as
a defensive fallback. `Pill` now imports its `Tone` union from this
module so they stay in lockstep.

**`lib/utils/useHotkeys.ts`** — keyboard-shortcut hook with two-key
sequence support (`g t` style with a 1s window), input-focus guards,
modifier-key reservation, and a doc registry for the help overlay.
Module-level `globalLeader` so `g X` sequences from `GlobalHotkeys`
don't double-fire with single-key `a` handlers on a page; auto-suspends
all bindings (except `?`) while a modal is open.

**`components/layout/HotkeysHelp.tsx`** — `?` overlay listing all
registered shortcuts grouped by intent (Navigation, Approvals, Inbox,
General). Uses `<kbd>` styling and the doc registry.

**`components/layout/GlobalHotkeys.tsx`** — role-aware navigation
shortcuts mounted in WorkspaceShell. Creators get `g t/d/c/w/i/e/a/p`,
brands get `g t/d/c/a/i/w/n/p`, admins get `g h/q/v/d/p/a`. Auto-publishes
to the help registry when role flips.

**Modal a11y fixes** — auto-focus prefers `<input>`/`<textarea>`/`<select>`
over buttons (so opening a dispute resolution modal no longer focuses a
tab button that Space/Enter would accidentally toggle); accepts an
`initialFocusSelector` prop for explicit caller control; backdrop
dismiss requires both `mousedown` and `mouseup` on the backdrop (no
more accidental dismiss on drag-from-dialog text selections);
`downOnBackdropRef` resets cleanly between opens.

**ConfirmHost** — Enter listener no longer fires when focus is in
`<input>`/`<textarea>` (Modal already handles Escape).

### What shipped — propagation

**Labels everywhere** — every raw-enum render the audit found is now
routed through the canonical labels:
- creator: `Today`, `Content`, `Earnings`, `Profile`, `CampaignDetail`,
  `Campaigns`, `Discover`
- brand: `Today`, `Approvals`, `Wallet`, `CampaignDetail`
- admin: `Audit`, `Disputes`, `Home`, `Payouts`
- shared: `InboxView`, `GlobalSearch`, `InviteModal`, `ai-helpers.ts`

No more `"in_review"`, `"escrow_release"`, `"bonus_paid"`, `"production"`,
`"countered"`, `"resolved_for_creator"` leaking unedited to users.
Same applies to transaction status: every ledger now reads `txStatusLabel`
+ `txStatusTone` instead of inlining `t.status === 'cleared'` ternaries.

**`find()` → `findLast()` audit** — a parallel audit agent scanned every
`.find()` call against `db.offers`/`db.submissions` etc. for the
"latest X after counter+re-offer" pattern. Ten LIKELY-BUG sites fixed:
- `lib/api/client.ts:451` (financial correctness — submission approval
  was releasing the OLD rate, not the latest accepted)
- `creator/CampaignDetail.tsx`, `creator/Campaigns.tsx`, `creator/Content.tsx`,
  `creator/Analytics.tsx`
- `brand/CampaignDetail.tsx` (ROAS), `brand/Approvals.tsx` (escrow at stake +
  approval modal), `brand/Analytics.tsx` (top creators)
- `lib/utils/dashboard-metrics.ts` (top-creators-for-brand)

Where the value represents a paid rate, the predicate now also includes
`o.status === 'accepted'`. `creator/CampaignDetail` got a dedicated
`myAcceptedOffer` lookup separate from `myOffer`, so a brand re-offer
(latest = pending) doesn't null out the accepted-rate KPIs while escrow
is still held from the previous accepted offer.

**Page-level hotkeys**:
- `brand/Approvals.tsx` — `j/k` row nav, `a` approve, `r` request
  revisions, `Escape` close
- `components/inbox/InboxView.tsx` — `j/k` thread nav, `m` mark all
  read, `r` focus composer

**Undo on destructive actions** — `pushUndoToast` already existed; now
wired into `brand/Today.tsx` application-decline. Snapshots prior status
and gates restoration on the application still being in `rejected`
state to prevent two stacked toasts from overwriting newer decisions.

**Cleanup**:
- `lib/utils/queue-hues.ts` — admin `QUEUE_HUE` extracted from
  `admin/Home.tsx` to a shared module
- `ToastHost.tsx` — hardcoded OKLCH replaced with `color-mix(in oklab,
  var(--good)/var(--bad), var(--ink) 20%)` so toasts follow theme
- `Sidebar.tsx` + `GlobalSearch.tsx` — fragile fake-`KeyboardEvent`
  dispatch replaced with `alamut:open-search` custom event
- `WorkspaceShell.tsx` — `OnboardingChecklist` is creator-only gated;
  `.admin-queue-tile` added to halo selector for visual consistency
- Dead `responsive.css:251` rule (matched a portaled element via DOM
  sibling) removed

**Bonus**: creator-side accept-toast copy fix — "brand placed $X in
escrow" instead of "$X held in escrow" (the latter was confusing about
whose money).

### Phase 20 QA pass + fixes

A parallel deep-audit agent reviewed Phase 20 and surfaced 4 critical
+ several major findings, all fixed before ship:

1. **Hotkey collision** — pressing `g a` to navigate to Approvals
   while already there silently approved the active submission.
   Fixed by sharing leader state across all `useHotkeys` instances at
   module level + `e.stopImmediatePropagation()` after firing.
2. **Hotkeys fired through open modals** — pressing `a` inside the
   help overlay or revisions modal triggered the page's approve handler.
   Fixed: `useHotkeys` now suspends all non-`?` bindings while
   `[role="dialog"][aria-modal="true"]` is in the DOM.
3. **Modal `downOnBackdropRef` never reset** — after the first
   backdrop-dismiss, the ref stayed `true`; subsequent drag-out gestures
   would dismiss the next modal incorrectly. Fixed: reset on modal
   open, on every click handler exit, and on dialog `onMouseDown`.
4. **`find()` regressions on money-bearing rate displays** —
   `brand/CampaignDetail.tsx:1129` (ROAS) and `creator/Campaigns.tsx:147`
   (kanban amount) had their `'accepted'` filter dropped during the
   first pass; re-added. `creator/CampaignDetail.tsx` split into
   `myOffer` (latest, drives state) + `myAcceptedOffer` (latest accepted,
   drives money).
5. **Remaining raw-enum leaks** — 10+ sites the first label pass
   missed (`creator/Campaigns:117`, `admin/Payouts:122`, `brand/Wallet:171`,
   `GlobalSearch:194`, `InviteModal:72`, `InboxView:311`, `ai-helpers:284`,
   `brand/CampaignDetail:1290/1296`, `admin/Disputes:161`,
   `creator/Discover:295`) all migrated.
6. **`txStatusLabel`/`txStatusTone` were exported but unused** — every
   ledger (Earnings, Wallet, Payouts) still had inline `t.status === 'cleared'`
   ternaries. Now consume the helpers.
7. **Undo race in `brand/Today` decline** — fixed by gating the
   `tx()` restore on `a.status === 'rejected'`.
8. **Pill `Tone` was duplicated** — Pill now imports its `Tone` union
   from `lib/utils/labels` so future enum additions ripple cleanly.

### Phase 20 build size

`281.76 KB initial / 79.62 KB gzip · 0 warnings · 0 errors · 3.96s`
(+~3 KB JS / +~0.4 KB gzip from Phase 19 — all consistency + correctness
work, no feature additions). The label module is ~3 KB minified; the
hotkey infra is ~1.5 KB; the rest is net-zero (label imports replaced
inline ternaries roughly 1:1).

### Files added (Phase 20)

- `app/src/lib/utils/labels.ts` (~280 lines)
- `app/src/lib/utils/useHotkeys.ts` (~150 lines)
- `app/src/lib/utils/queue-hues.ts` (~15 lines)
- `app/src/components/layout/HotkeysHelp.tsx` (~95 lines)
- `app/src/components/layout/GlobalHotkeys.tsx` (~75 lines)

### Files modified (Phase 20)

23 screens / shared components touched for label propagation, find()
fixes, hotkey wiring, and cleanup. Net diff is mostly reductions
(inline ternaries → helper calls, duplicated maps → shared imports).

### Verification checklist (Phase 20)

- [x] Status pills, ledger types, dispute reasons all render with
      proper labels (no more `"escrow_release"` / `"bonus_paid"`)
- [x] Brand on Approvals presses `g a` — only navigates, doesn't
      silently approve
- [x] Pressing `a` inside the revisions modal doesn't fire approve
- [x] `?` opens the help overlay even from within other modals
- [x] Drag-from-dialog text selection that ends on the backdrop
      doesn't dismiss the modal
- [x] Submission approval releases the LATEST accepted offer's rate
      (verified `lib/api/client.ts:451`)
- [x] ROAS table on brand campaign detail divides by paid rate only
- [x] Two-stage app decline: undo on the older toast doesn't restore
      over a newer decision
- [x] Build clean, 0 warnings, 0 errors

---

## ✅ Phase 21 — Vertical polish (shipped)

After Phase 20 cross-cutting consistency, Phase 21 fixes the per-screen
UX gaps each vertical's audit had flagged. These don't generalize as
platform-wide patterns — they're specific surfaces where the brand's,
creator's, or admin's job was friction-blocked.

### Brand polish

**Files lightbox in Approvals** (`Approvals.tsx`) — the heart of the brand
job. Files in the review modal were rendered as `<div>` with
`backgroundImage` — no zoom, no carousel, no full-resolution view.
Brand reviewers were approving content blind. Now:
- New shared `components/ui/Lightbox.tsx` — fullscreen carousel, click
  to toggle fit-to-screen vs 100% zoom, ←/→ between files, Esc close,
  thumbnail strip, mobile responsive
- Click any file thumbnail → opens Lightbox at that index
- Caption shows `Round N · Creator Name`
- Reused on admin Queue's portfolio thumbs in the review modal

**Wallet ledger filters + pagination** (`Wallet.tsx`) — brands with
many transactions couldn't find specific ones. Added:
- Debounced search (notes, campaign titles, type labels, amounts)
- Type chips (all 8 TxKind values + "All")
- Status chips (cleared / pending / failed / All)
- Date-range chips (last 7d / 30d / 90d / All time)
- 50-row pagination with "Page N of M · X rows" indicator
- Filter-aware CSV export ("Exported {N} transactions")
- Header reads "{filtered} of {total} transactions" when filters active

**NewCampaignModal date picker** (`NewCampaignModal.tsx`) — replaced
free-text `placeholder="May 31"` with HTML5 `<input type="date">`.
Default = REF_DATE + 14d. Min = today (no past dates). Required.
Validation on submit bounces back to Step 2 if cleared. Step 3 review
uses `fmtDate()`.

### Admin polish

**Required rejection reason** (`Queue.tsx` + `lib/api/client.ts`) —
rejecting a creator silently was a real compliance issue. Now:
- API throws on `reason.length < 10` for `decision === 'reject'`
- Separate "Reject…" modal with a required textarea (min 10 chars)
- Live char counter ("23 characters · ready" / "5 more needed")
- Reason flows into the creator's notification: "Your application was
  not approved at this time. Reason: ___"
- Inline row Approve demoted to ghost; Review is the primary action
- Portfolio thumbs in review modal now wired to Lightbox

**Audit polish** (`Audit.tsx`) — 200-row hard cap removed. Added:
- Debounced search (220ms via `useDebouncedValue`) — stops jitter on a
  large platform
- 100-row pagination
- Mask-emails toggle (chip in toolbar) — propagates to display + CSV
  filename suffix `-masked`
- Kind union expanded to include all `TxKind` values (no more silent
  cast widening)
- `maskEmail()` helper handles common email patterns

**Empty-state pass** (`Queue` / `Verify` / `Disputes` / `Payouts`) —
adopted `EmptyArt` line-art illustrations on every plain `.empty` div,
each with a contextual sub-line.

### Creator polish

**Public storefront** (`PublicCreator.tsx`) — the front door creators
share on social. Three fixes:
- Hardcoded `scrollTo({top: 800})` → `getElementById('work').scrollIntoView()`
  (lands correctly on every viewport)
- New "Copy link" button with `navigator.clipboard` + fallback toast
- Document title + OG/Twitter meta tags set on mount: `og:title`,
  `og:description`, `og:image`, `og:type`, `og:url`, `twitter:card`,
  `twitter:title`, `twitter:description`, `twitter:image`. Cleanup
  removes tags we created and restores original content for tags
  that already existed (no leak across navigations).

**Earnings empty-state** (`Earnings.tsx`) — fresh creators landing on
"$0 cleared · $0 in escrow · 0 payouts YTD" was a bleak first
impression. New `isFresh` branch when wallet+pending+lifetime+txs all
zero — shows "Your first deal starts here" + onboarding lede.

**Profile "Reset form"** (`Profile.tsx`) — old "Discard" button
implied it would reverse all edits, but modal-driven changes (work,
platforms, rate cards) save immediately. Renamed to "Reset form" with
a tooltip + footer disclosure clarifying scope.

**Analytics percentile claim removed** (`Analytics.tsx`) — "faster than
80% of creators" was hardcoded copy with no real percentile
calculation. Replaced with a factual "to brand messages" sub-line.

**Campaigns tab rename** (`Campaigns.tsx`) — "Posted + Closed" (internal
stage jargon) → "Past campaigns".

### QA round (8 critical/major fixes after parallel deep audit)

1. **Empty deadline submit** (`NewCampaignModal.tsx`) — date picker
   could submit with `value=""`. Now validates, bounces to Step 2,
   focuses the picker.
2. **Lightbox + Modal Esc double-close** — opening Lightbox from inside
   the Approvals review Modal kept Modal mounted underneath; pressing
   Esc closed BOTH. Lightbox now registers its keydown at capture phase
   and calls `stopImmediatePropagation()`.
3. **Wallet missing `referral_bonus` chip** — added to the kind filter
   set so referral inflows are filterable.
4. **NewCampaignModal min date** — was `REF_DATE - 1 day`, allowing
   yesterday. Now `REF_DATE` exactly.
5. **Audit kind union** — didn't include `ad_spend` / `referral_bonus`,
   silently casting to a narrower type. Expanded to match all `TxKind`.
6. **Earnings `isFresh` predicate** — now also gates on
   `lifetimeEarnings === 0` so creators with seeded lifetime totals
   don't see "first deal" copy alongside a non-zero KPI strip.
7. **PublicCreator OG meta leak** — original meta content was never
   restored on cleanup; navigating storefront → home stamped the
   previous creator's tags into `<head>`. Now snapshots originals,
   removes tags we created, reverts content for pre-existing tags.
8. **Lightbox stale state on filter change** (`Approvals.tsx`) — when
   a filter change nulled out `active` mid-zoom, Lightbox could persist
   with a stale index. Added `useEffect` to reset `lightboxIdx` on
   `activeId` change.

### Files added (Phase 21)

- `app/src/components/ui/Lightbox.tsx` (~125 lines)

### Files heavily modified (Phase 21)

- `app/src/screens/brand/{Approvals, Wallet}.tsx`
- `app/src/screens/admin/{Queue, Audit, Verify, Disputes, Payouts}.tsx`
- `app/src/screens/creator/{Earnings, Analytics, Profile, Campaigns}.tsx`
- `app/src/screens/storefront/PublicCreator.tsx`
- `app/src/components/modals/NewCampaignModal.tsx`
- `app/src/lib/api/client.ts` (rejection reason validation)
- `app/src/styles/components.css` (Lightbox + chip + ledger-filters CSS)
- `app/src/styles/screens.css` (interactive approval-file)

### Phase 21 build size

`281.95 KB initial / 79.71 KB gzip · 0 warnings · 0 errors · 3.61s`
(+~0.1 KB JS / negligible gzip change from Phase 20 — mostly UX
restructuring, not new feature payload).

### Verification checklist (Phase 21)

- [x] Brand reviewer can click any file thumb to expand fullscreen,
      arrow-key between files, zoom on click, escape to close
- [x] Pressing Esc inside Lightbox closes ONLY Lightbox (not the
      underlying review modal)
- [x] Admin can't reject a creator without typing ≥10 chars; reason
      flows into the rejection notification
- [x] Brand can search/filter/paginate the wallet ledger; CSV export
      respects active filters
- [x] Admin Audit search debounces; pagination works; mask-emails
      toggle redacts both display and CSV
- [x] NewCampaignModal date picker has min=today, required, validates
      on submit
- [x] Storefront `See work` button scrolls to the actual #work section
- [x] Storefront Copy-link button works (with toast fallback)
- [x] Navigating storefront → home doesn't leave OG meta stamped
- [x] Fresh creator on Earnings sees the welcoming empty-state, not
      triple-zero
- [x] Build clean, 0 warnings, 0 errors

---

## ✅ Phase 22 — Strategic features (shipped)

After three phases of bug fixes + cross-cutting consistency + vertical
polish, Phase 22 ships **net-new capability** — the strategic items
that unlock real workflow value rather than just smoothing existing
ones.

### Cross-tab moderation presence

**`lib/utils/usePresence.ts`** — generic BroadcastChannel-based hook for
"who else is viewing this entity right now?" Each viewer broadcasts
`present` + heartbeats every 5s, prunes stale entries after 12s, sends
`whois?` on join so existing viewers re-announce. SELF_ID is a
crypto-random per-tab UUID. Channel singleton; module-level so
multiple components share one socket. Falls back to no-op when
BroadcastChannel is unavailable. Returns the array of OTHER viewers
(self excluded).

**`components/ui/PresenceBanner.tsx`** — pulse + pluralized name list
+ "Coordinate before you decide" microcopy. Mounted inline at the top
of high-stakes modals.

**Wired into:**
- `admin/Disputes.tsx` review modal — keyed on `dispute:${activeId}`.
  Two ops opening the same dispute now see each other before they
  release escrow.
- `admin/Queue.tsx` review modal — keyed on `applicant:${reviewId}`.
  Same protection for approve/reject decisions.

### Risk signals on admin Queue

**`lib/utils/risk-signals.ts`** — pure heuristic module computing 8
signal kinds against a creator + their user record + the rest of the
DB:

| Kind | Severity | Trigger |
|---|---|---|
| `duplicate_handle` | high | Another creator (different id) shares the same `@handle` |
| `fresh_account` | medium | User created < 7 days ago |
| `sparse_profile` | medium | profileCompletion < 50% |
| `no_work` | high | Zero portfolio samples |
| `unverified_platforms` | medium | Every platform handle is self-reported |
| `low_audience_credibility` | high | Lowest `audienceCredibilityScore` < 60 |
| `high_suspicious_followers` | high | Max `suspiciousFollowerPct` > 25% |
| `incomplete_payout` | low | No payout destination configured |

Each returns `{ kind, severity, label, message }` so the UI can render
chips with severity tones + tooltips with the full sentence.

**`screens/admin/Queue.tsx`** integrations:
- New "Risk" column with `RiskSummary` chips (top 2 by severity, "+N"
  overflow)
- `RiskPanel` in the review modal — full list with severity + message
- Inline row Approve button DISABLED when high-severity signals exist
  (forces operator into Review-first path with full context)
- Memoized via `useMemo(riskByUser, [db, pending])` so 8 rules × N
  applicants × 5 platforms each don't re-run every render

### Diff view in brand Approvals

**`components/ui/Lightbox.tsx`** extended with `compareFiles` +
`compareCaption` props. When provided, switches to a side-by-side
two-pane view with synced index. Missing files on either side render
"No file at this index" placeholders. Stacks vertically on ≤800px.

**`screens/brand/Approvals.tsx`** computes the previous round's
submission via `useMemo` and exposes a "Compare with Round N-1" button
in the files modal that opens Lightbox in diff mode. Brand reviewer
can now scrub round-by-round to see what actually changed across
revisions — previously they were comparing memories.

### Saved searches on creator Discover

**`lib/utils/useSavedSearches.ts`** — generic localStorage-backed hook,
versioned schema (`version: 1` for forward-compat migrations), capped
at 12 saved entries per scope (newest-first), cross-tab synced via
`storage` event.

**`screens/creator/Discover.tsx`** wires it up:
- Saved-search strip above the toolbar shows named chips
- "Save current" button (only visible when filters active)
- Save dialog with auto-name suggestion derived from filters
- Click chip → applies both filters + search box; click X → removes

**Storage format:** filter state is serialized via the existing
`campaignDiscoverFiltersToParams()` helper (URLSearchParams string).
This avoids the JSON.stringify-can't-handle-Set issue with `Set<string>`
filter dimensions (categories/regions). Round-trips through
`fromParams()` on load.

### Per-region tax estimate on Earnings

**`lib/utils/tax-estimate.ts`** — `TAX_BANDS` map of named effective
rates (Pakistan low/mid, India presumptive, UK basic/higher, US 22/24,
EU avg, UAE 0%, plus 25% default). `defaultBandKey()` sniffs from
`creator.country` with broad name matching (Britain/England, America,
Holland, Eire, etc.).

**`screens/creator/Earnings.tsx`** replaces the flat 25% with the
selected band, persisted to localStorage as `alamut.taxBand`. Inline
`<select>` dropdown lets the creator override; `title` shows the band's
explanatory note.

### QA round (8 fixes after parallel deep audit)

1. **`usePresence` re-subscribe flapping** — label/intent in deps tore
   down + re-subscribed on every render. Now stashed in `useRef`
   pattern; only `entityId` triggers resubscribe.
2. **Saved-search hover crash** — `s.filters` is now a URLSearchParams
   string, not a CampaignDiscoverFilters object. `autoNameFromFilters`
   would `TypeError` on hover. Now rehydrates via `fromParams()` first.
   *(This was caught proactively before the QA agent reported.)*
3. **Risk-signal recompute every render** — 8 rules × N applicants ×
   5 platforms per render compounded fast. Now memoized via
   `useMemo(riskByUser, [db, pending])`.
4. **Lightbox `navLen === 0` NaN** — guard added so empty-on-both-sides
   diff mode doesn't divide by zero.
5. **Lightbox dark-mode color literal** — `.lightbox-diff-pane` was
   `color-mix(white 4%)` — light tint on dark theme. Now mixes from
   `var(--paper)`.
6. **Approvals `prevRound` duplicated** — was computed inline twice in
   IIFEs. Hoisted to a single `useMemo` keyed on
   `[active, db.submissions]`.
7. **Risk payout check edge case** — `creator.payout?.account === '—'`
   only caught the legacy sentinel, not empty string. Now explicit:
   `acct === '' || acct === '—'`.
8. **TAX_BANDS country sniffer + dead "Custom" option** — added Britain,
   England, America, Holland, Eire, Austria, Denmark, Finland, Czech
   to the matchers; removed "Custom" since selecting it was identical
   to "Default" (no UI to set a rate).

### Files added (Phase 22)

- `app/src/lib/utils/usePresence.ts` (~150 lines)
- `app/src/lib/utils/risk-signals.ts` (~125 lines)
- `app/src/lib/utils/useSavedSearches.ts` (~95 lines)
- `app/src/lib/utils/tax-estimate.ts` (~55 lines)
- `app/src/components/ui/PresenceBanner.tsx` (~30 lines)

### Files modified (Phase 22)

- `app/src/components/ui/Lightbox.tsx` — diff mode props + render
- `app/src/screens/admin/Disputes.tsx` — presence wiring
- `app/src/screens/admin/Queue.tsx` — presence + risk-flag column +
  RiskSummary/RiskPanel + memoization
- `app/src/screens/brand/Approvals.tsx` — diff-view button + Lightbox
  diff props + prevRound useMemo
- `app/src/screens/creator/Discover.tsx` — saved-search strip + Save
  dialog + URL-params serialization round-trip
- `app/src/screens/creator/Earnings.tsx` — tax-band picker
- `app/src/styles/components.css` — presence-banner, risk-chip,
  risk-panel, lightbox-diff, saved-search-strip CSS

### Phase 22 build size

`281.99 KB initial / 79.73 KB gzip · 0 warnings · 0 errors · 4.73s`
(+~0.04 KB JS / negligible gzip change from Phase 21 — most additions
are in lazy-loaded route chunks rather than the eager bundle).

### Verification checklist (Phase 22)

- [x] Two browser tabs opening the same dispute see each other's
      presence banner with a pulsing dot
- [x] Closing one tab removes the banner from the other within 12s
- [x] BroadcastChannel-less browsers silently no-op (no crash)
- [x] Admin Queue row chips show 0-3 risk-signal labels by severity
- [x] Inline Approve disabled when high-severity signals exist
- [x] Review modal shows full RiskPanel with messages
- [x] Brand reviewer can click "Compare with Round N-1" → side-by-side
      Lightbox; arrow keys advance both panes
- [x] Diff mode handles missing files on either side gracefully
- [x] Creator can save current Discover filters with a name; chip
      appears in the strip; click applies; X removes
- [x] Saved searches survive page reload (localStorage round-trip
      preserves Set<string> via URLSearchParams string form)
- [x] Tax-band picker on Earnings shows ten regional options + Default
- [x] Picked band persists to localStorage as `alamut.taxBand`
- [x] Build clean, 0 warnings, 0 errors

---

## ✅ Phase 23 — Long-term backlog cleanup (shipped)

Phase 23 wraps the long-term feature backlog in a single pass: every
item that was on the strategic shortlist but punted on (because it
wasn't in scope for prior phases) now ships.

### Multi-format Lightbox

`components/ui/Lightbox.tsx` extended beyond images. New
`detectAssetKind()` helper inspects the URL's last path segment for an
extension (carefully: only the last dot AFTER the last slash counts, so
`https://cdn.example.com/file` doesn't get treated as having extension
"com"). Returns one of `image | video | pdf | text | unknown`.

A new `<AssetView>` dispatcher renders:
- **image** — `<img>` (click-to-zoom toggle preserved)
- **video** — `<video controls playsInline>` with native controls
- **pdf** — `<iframe sandbox="allow-same-origin allow-scripts">`
  (sandboxed to block top-level navigation/popups/forms from
  untrusted CDN-hosted PDFs)
- **text** (csv/txt/md/json/log/yaml) — fetched and rendered in a
  `<pre>` capped at 16KB. Uses `AbortController` so arrow-key
  scrubbing through many files cancels in-flight fetches instead of
  racing them.
- **unknown** — download card with "Open in new tab" CTA

Diff mode also routes through `AssetView` so non-image diffs (e.g.
two video drafts) work side-by-side. Thumbnail strip uses
kind-specific glyphs (PDF / TXT / video) for non-image entries.

### Outcome-pricing forecast

`lib/utils/outcome-forecast.ts` — `forecastOutcome(db, category,
pricing, accepted = DEFAULT_ACCEPTED)` samples conversion data from
completed outcome campaigns and projects p25 / p50 / p75 per-creator
payouts. Two-tier matching: same category if ≥2 samples, else falls
back to all outcome campaigns. When zero historical samples exist,
synthesizes a 50%-cap heuristic with NaN-safe clamps (perConversion = 1
floor, cap-floor = 0 floor).

Wired into NewCampaignModal: when `pricingModel === 'outcome' && kind
=== 'one_off'`, renders a 3-band forecast card (low/mid/high) under
the inputs, with reasoning chips ("Modeled on N samples from past
{category} outcome campaigns" or fallback). The "{N} creators" label
references the exported `DEFAULT_ACCEPTED` constant so math + label
stay aligned if the default ever changes.

### Campaign templates library

`lib/utils/campaign-templates.ts` — two-tier template system:

**Platform templates** (3 curated, bundled with the app):
- "Spring product launch" — fixed-rate, 30-day exclusivity, perpetual
  repurpose, Lifestyle, $12k median
- "Brand-awareness reel series" — retainer, 3-month, 4 reels/month,
  organic-only, Design, EU
- "Outcome-based affiliate" — outcome pricing, $12/conversion, $8k
  cap, Beauty, US

**Brand templates** (user-saved, localStorage, capped 20 per brand):
versioned schema, `console.warn` on schema mismatch, removable.

Wired into NewCampaignModal:
- **Step 1 picker grid** — visible only when not cloning. Brand
  templates show on top, platform underneath. Each card shows name,
  description, source tag, and category/kind/pricing badges.
- **Step 4 "Save as template"** — review-stage button with name dialog,
  auto-suggested from current title + category + kind.

### Storefront PDF media-kit export

`screens/storefront/PublicCreator.tsx` — new "Media kit (PDF)" button
toggles `body.is-printing-mediakit` + sets `body.dataset.printUrl`,
calls `window.print()`. Uses `afterprint` event for cleanup (more
reliable than fixed setTimeout) with a 60-second safety fallback so
the class can never get stuck.

`styles/print.css` — print stylesheet hides chrome (nav, footer,
buttons, CTAs, marketing sections), normalizes colors for print,
scales typography for A4 (28pt H1, 18pt H2, 10pt body), forces page
break before #work, and stamps the live storefront URL in a printed
footer via `attr(data-print-url)`. Page size: A4, 14mm margin.

The browser's "Save as PDF" destination handles the rest — no JS PDF
library, no bundle bloat.

### Cleanup MINORs

- `useSavedSearches` schema mismatch now `console.warn`s with the
  scope name + version delta so future migrations don't silently
  drop saved data.

### QA round (8 fixes)

1. **`TextPreview` AbortController** — fetches now cancel on user
   navigation; no more orphan requests racing the user.
2. **PDF iframe sandbox** — added `sandbox="allow-same-origin
   allow-scripts"` so embedded PDFs can't run top-level navigation /
   popups / forms.
3. **Templates state stale on brand flip** — added a `useEffect`
   keyed on `brand?.id` so lazy auth resolution refreshes the picker.
4. **`applyTemplate` resets errors** — stale field errors no longer
   stick around after applying a template.
5. **Outcome-forecast "5 creators" hardcoded label** — extracted to
   exported `DEFAULT_ACCEPTED` constant; UI uses the constant in
   JSX so math + label stay in lockstep.
6. **Outcome NaN guards** — `Math.max(1, perConversion)` prevents
   divide-by-zero; `Math.max(0, cap - floor)` prevents negatives.
7. **`reset()` covers all branch state** — also resets `cover`,
   `rights`, `kind`, `retainerTerm` so closing the modal mid-flow
   doesn't leak into the next campaign.
8. **`detectAssetKind` extension parsing** — only treats a dot as an
   extension boundary when it's after the last slash, so URLs
   without extensions don't collect host names as the "extension".

Print URL footer was proactively migrated from `data-print-path` to
`data-print-url` before the QA agent reported the mismatch — same fix.

### Files added (Phase 23)

- `app/src/lib/utils/outcome-forecast.ts` (~110 lines)
- `app/src/lib/utils/campaign-templates.ts` (~165 lines)
- `app/src/styles/print.css` (~115 lines)

### Files modified (Phase 23)

- `app/src/components/ui/Lightbox.tsx` — multi-format dispatch +
  AbortController + iframe sandbox
- `app/src/components/modals/NewCampaignModal.tsx` — outcome
  forecast card + templates picker + save-template dialog +
  reset() coverage + applyTemplate error reset
- `app/src/screens/storefront/PublicCreator.tsx` — PDF media-kit
  button with afterprint cleanup
- `app/src/lib/utils/useSavedSearches.ts` — schema-version warn
- `app/src/main.tsx` — print.css import
- `app/src/styles/components.css` — outcome-forecast / template
  / lightbox-non-image / template-card CSS

### Phase 23 build size

`281.99 KB initial / 79.73 KB gzip · 0 warnings · 0 errors · 5.54s`
(no measurable change from Phase 22 — most additions are in lazy-loaded
route chunks: `NewCampaignModal-*.js` grew from ~25 KB to ~36 KB which
is where the templates/forecast UI lives).

### Verification checklist (Phase 23)

- [x] Lightbox renders MP4 video with native controls
- [x] Lightbox renders PDF in a sandboxed iframe
- [x] Lightbox previews .csv/.txt inline (16KB cap, AbortController
      cancels on next-file navigation)
- [x] Unknown file types show a download card with "Open in new tab"
- [x] Diff-mode handles non-image files via `AssetView` (not just `<img>`)
- [x] Outcome forecast card renders for `pricingModel === 'outcome' &&
      kind === 'one_off'` with three bands + reasoning chips
- [x] Forecast handles zero-history fallback without NaN
- [x] NewCampaignModal Step 1 shows template picker (when not cloning)
- [x] Picking a template fills the form and clears stale field errors
- [x] Saving a template appears in the picker on next open
- [x] Brand-saved templates have an `X` to remove; platform templates
      don't (read-only)
- [x] Public storefront "Media kit (PDF)" button opens browser print
      dialog with the page reformatted as a clean A4 layout
- [x] `afterprint` cleans up the body class even when the user cancels
      the dialog
- [x] Build clean, 0 warnings, 0 errors

---

## ✅ Phase 24 — Deal-page foundations (shipped, no UI changes)

After Phases 19-23 closed out the original audit backlog, the user
flagged numerous remaining UX problems and asked for a complete mental
wireframe of every interaction. The conclusion: the platform's biggest
structural issue is that **a single deal lives across 5-7 surfaces** —
CampaignDetail, Today, Inbox, Content, Approvals, Earnings, Wallet —
each rendering ~80% of the same data differently.

The proposed fix is to make the **deal** (a campaign × creator pair
once an offer exists) the primary unit of UX, not the screen. Phases
24-30 implement that redesign. Phase 24 ships the foundations only —
no user-visible changes.

A snapshot of the current state was saved to
`_backup-pre-deal-redesign-2026-05-05/` (2.3 MB, source + configs +
PROGRESS.md, with restore commands in `RESTORE.md`) so the redesign
is fully revertible.

### What shipped

**`lib/utils/deal-id.ts`** — composite ID encode/decode for the deal-
page route. A deal's slug is `${campaignId}--${creatorId}`. The `--`
separator was chosen because no existing ID format uses it, no URL
escaping is needed, and the format is human-readable in the address
bar. All consumers go through `encodeDealId()` / `decodeDealId()`.

**`lib/utils/deal-state.ts`** — pure state-machine classifier. A
`DealState` is one of 13 values:

| State | When |
|---|---|
| `applied` | Application submitted, brand hasn't decided |
| `shortlisted` | Brand picked, no offer yet |
| `offer-pending` | Brand sent offer, creator hasn't responded |
| `offer-countered` | Creator countered, brand hasn't responded |
| `declined` | Either side declined |
| `withdrawn` | Application/counter withdrawn |
| `accepted-production` | Offer accepted, no submission yet |
| `in-review` | Submission uploaded, brand reviewing |
| `revisions-requested` | Brand asked for changes |
| `approved` | Submission approved (escrow released) |
| `posted` | Content live on creator channels |
| `closed` | Campaign closed, paid out |
| `disputed` | Open dispute (precedence: beats every other state) |

`computeDealState({ creatorId, campaign, application, offer,
submissions, openDispute })` is a pure function with explicit
precedence rules.

**`lib/utils/deal-action.ts`** — for each `(state, role)` pair,
computes:
- `actor` — whose action moves things forward (`'me' | 'them' | 'neither'`)
- `kind` — stable `DealActionKind` enum the UI dispatches on
- `verb` — human label for the primary CTA, with `$` baked in
- `secondary[]` — additional kinds (counter / decline alongside accept)
- `urgency` — 0-1000 score for ranking
- `reason` — short why-now string ("expires in 4h", "uploaded 4h ago")

Urgency scoring distinguishes self-blocked items (high score, ratchets
with deadline closeness) from other-blocked items (low score, mostly
passive). The split lets Today's queue separate "what to do" from
"what's been happening."

**`lib/utils/deal-ranking.ts`** — `rankDeals()` splits a deal list
into `actionable` (sorted high-urgency-first) and `passive` (other-
blocked or terminal). Today's queue uses these as separate sections.

**`lib/api/use-deal.ts`** — the canonical aggregator:
- `deriveDeal({ db, campaignId, creatorId, role, viewerUserId })` —
  pure function that produces a complete `Deal` value with everything
  any consumer needs (campaign + brand + creator records, application,
  latest offer, latest accepted offer, all submissions, open dispute,
  thread, messages, transactions, derived state, action, released
  amount, escrow held).
- `useDealById(dealId)` — React hook wrapping `deriveDeal` with
  authorization (creators can only see their deals; brands only their
  own campaigns; admins see everything) plus malformed/forbidden flags.

The pure derivation is exported separately so non-React contexts (the
Today queue ranking pass, future server-side rendering) can derive
without React subscription overhead.

**`screens/deal/Deal.tsx`** — Phase 24 stub page. Renders the deal's
header, action banner, money summary, and a chronological timeline.
Files / Brief / Chat side panels are placeholder details — Phase 25
mounts the actual content (Lightbox, brief view, chat composer).

**`router.tsx`** — `/deal/:dealId` route, lazy-loaded, gated by
`ProtectedRoute allow={['creator', 'brand', 'admin']}`. The page itself
filters by ownership.

### QA round (4 critical + 2 major + 3 minor fixes)

A parallel deep-audit agent stress-tested the abstractions before any
downstream phase builds on them. Findings, all fixed:

**CRITICAL:**

1. **Dead shortlist branch** — `computeDealState`'s pre-application
   shortlist fallback used `application?.creatorId || ''` which
   couldn't ever match a campaign's shortlist (the application was
   undefined exactly when this branch was needed). Fixed by adding
   `creatorId: string` to `DealInputs` and using it directly.

2. **Action-kind collision** — both `'applied'` (verb: "Shortlist")
   and `'shortlisted'` (verb: "Send offer") emitted
   `kind: 'shortlist-applicant'`. Phase 25's dispatch table would
   route both to the same handler. Added `'send-offer'` as a distinct
   kind for the shortlisted branch.

3. **Disputed deals ranked into passive bucket** — `actor: 'neither'`
   meant `rankDeals` filed disputes under "Recent activity" instead
   of the actionable queue. But disputes are among the most-actionable
   things in either party's queue (escrow frozen, evidence to provide).
   Changed non-admin disputed actor to `'me'`, urgency 700.

4. **Brand-team thread lookup picked first team member** — for brands
   with multiple users (`u.brandId === brand.id`), `db.users.find(...)`
   returned only the first; if the actual thread participant was a
   different teammate, `participants.includes(brandUser.id)` returned
   false and the thread was hidden. Fixed by collecting all brand-team
   user IDs into a Set and matching ANY in the thread participants.

**MAJOR:**

5. **Friendly-string deadlines collapsed to medium urgency** — a
   "Tomorrow" deadline that didn't parse as ISO routed through a 14-day
   fallback, scoring urgency 150. Now parses "today" / "tomorrow" /
   "in N days" explicitly, and the unparseable fallback is 1 day
   (defensive: assume worst case).

6. **Brand-side production lacked deadline urgency** — when a creator
   went silent past deadline, the brand's row showed urgency 10
   (passive). Now bumps to 450 with `actor: 'me'` and verb "Send a
   nudge" once `daysToDeadline < 0`.

**MINOR:**

7. **Deal state strings leaked to UI** — `Deal.tsx` rendered
   `deal.state.replace(/-/g, ' ').toUpperCase()` directly. Phase 20
   established that no raw enum should be user-visible. Added
   `DEAL_STATE_LABEL` + `DEAL_STATE_TONE` to `labels.ts` and routed
   the page through `dealStateLabel()` / `dealStateTone()`.

8. **`navigate(-1)` stranded deep-linkers** — opening `/deal/X` in a
   fresh tab and clicking back was a no-op. Falls back to role's home
   when `window.history.length <= 1`.

9. **`computeDealAction` used `offer.rate` for release amount** — a
   pending re-offer with a different rate would have shown the wrong
   approve-button label. Threaded `acceptedOffer` separately so the
   `in-review` brand branch reads the canonical money.

### Files added (Phase 24)

- `app/src/lib/utils/deal-id.ts` (~30 lines)
- `app/src/lib/utils/deal-state.ts` (~135 lines)
- `app/src/lib/utils/deal-action.ts` (~315 lines)
- `app/src/lib/utils/deal-ranking.ts` (~60 lines)
- `app/src/lib/api/use-deal.ts` (~225 lines)
- `app/src/screens/deal/Deal.tsx` (~225 lines)

### Files modified

- `app/src/lib/utils/labels.ts` — added `DEAL_STATE_LABEL` /
  `DEAL_STATE_TONE` + helpers
- `app/src/router.tsx` — new `/deal/:dealId` route, lazy-loaded

### Phase 24 build size

`282.94 KB initial / 79.96 KB gzip · 0 warnings · 0 errors · 3.76s`
(+~0.16 KB gzip from Phase 23 — the new utility modules and labels
extension are imported eagerly through the hook). The deal stub page
itself is a 13.43 KB / 4.16 KB gzip lazy chunk — paid only by users
who navigate to a deal.

### Verification checklist (Phase 24)

- [x] `/deal/:dealId` route reachable for all 3 roles
- [x] Deal page handles malformed slug, forbidden access, and missing
      campaign/creator with appropriate empty states
- [x] All 13 `DealState` values labelled via `dealStateLabel()`
- [x] Brand-team threads with N members find the message thread
      regardless of which teammate is the participant
- [x] Disputed deals appear in actionable queue (will surface in
      Phase 26's Today rebuild)
- [x] `'send-offer'` and `'shortlist-applicant'` kinds are distinct
- [x] `urgency` scoring tested in head against the 13 states × 3 roles
      grid; ranking produces sensible top-N
- [x] No raw enum strings in deal-page UI
- [x] Existing 30 routes unaffected — Phase 24 is purely additive
- [x] Build clean, 0 warnings, 0 errors

### What's next (Phase 25)

Build out the deal page itself against the 7 lifecycle-state wireframes
from the design pass. Files panel mounts the multi-format Lightbox
(Phase 23). Diff view (Phase 22) handles the revisions state. Chat
composer goes inline. Action banner dispatches on `DealActionKind`
to the right modal/handler. All 7 states get their own action surface.

The existing screens stay untouched in Phase 25 — both
`/creator/campaigns/:id` and `/deal/:id` exist in parallel so users
can dogfood the new surface without losing access to the old.

---

## ✅ Phase 25 — Deal page implementation (shipped)

The redesigned deal page now exists end-to-end, replacing the work
that previously lived across 5 surfaces (CampaignDetail, Today triage
row, Approvals card, Content tile, Inbox thread) with one canvas.

### What shipped

**`screens/deal/DealActionBanner.tsx`** (~480 lines) — dispatcher +
14 sub-banners covering every (DealState × Role) combination. The
banner is the loudest surface on the page; all other panels orbit it.

| State | Creator banner | Brand banner | Admin banner |
|---|---|---|---|
| `applied` | "Application in" + withdraw | "New application" + Shortlist/Decline | observer |
| `shortlisted` | "On their shortlist" | "Send {Creator} an offer" | observer |
| `offer-pending` | "Offered $X" + Accept/Counter/Decline | "Awaiting reply" | observer |
| `offer-countered` | "Counter sent" + withdraw | "Countered $X→$Y" + Accept/Counter | observer |
| `accepted-production` | "Upload Round N" + escrow info | "Working" or "Past deadline · nudge" | observer |
| `in-review` | "Brand reviewing" | "Round N awaiting review" + Approve/Revisions | observer |
| `revisions-requested` | "Upload Round N+1" + last feedback | "Revising" | observer |
| `approved` / `posted` | shipped, performance loading | shipped, performance loading | observer |
| `closed` | "Earned $X" + Review brand | "Spent $X" + Review creator | observer |
| `disputed` | "Send context to support" + presence | same | "Resolve dispute" + presence |
| `declined` / `withdrawn` | terminal copy | terminal copy | observer |

Each sub-banner is a presentational component receiving handlers via
props — the deal page owns the controllers, the banner is dumb UI.

**`screens/deal/Deal.tsx`** (~470 lines) — the orchestrator. Resolves
the deal via `useDealById`, owns 6 modals (CounterOffer, UploadDraft,
Dispute, Review, MessageCompose, inline Revisions), wires every verb
to a real API call, integrates Phase 22 cross-tab presence on
disputed deals only, and renders four panels below the banner:

- **Files panel** — submission rounds with Lightbox (Phase 21+22) +
  diff (Phase 22). "Compare with Round N" uses the highest-prior-round
  pattern so non-contiguous round sets work.
- **Chat panel** — inline thread + composer with `Cmd+Enter` send,
  auto-mark-read on view, attachment chips.
- **Brief panel** — collapsible: brief text, KPI grid (budget /
  apply-by / region / category), full content rights breakdown.
- **Timeline panel** — chronological events: campaign post, application,
  offer, counter, submission rounds, feedback, dispute, payouts.

Plus a **Money KPI strip** in the header (only when there's something
to summarize: rate / released / in-escrow).

**`styles/screens.css`** (+~370 lines) — full `deal-page-*`,
`deal-banner-*`, `deal-rounds-*`, `deal-chat-*`, `deal-brief-*`,
`deal-timeline-*` class system. Three banner variants:
`-action` (warm accent border), `-passive` (calmer paper-2 tint, no
shadow, dimmer text), `-disputed` (red-tinted border).
Mobile responsive at 800px breakpoint.

### QA round (3 critical + 6 major + 5 minor fixes)

A parallel deep-audit agent reviewed every (state × role) combo plus
handler wiring, modal contracts, and CSS rendering. All findings fixed:

**CRITICAL:**

1. **Admin viewing non-disputed deals got brand-side banners with
   broken CTAs** — clicking "Open dispute" or "Send a message" routed
   to modals gated `(role === 'creator' || 'brand')`, silently
   swallowing the click. Added an explicit `<AdminObserverBanner>`
   that admins always see for non-disputed states.

2. **`MessageComposePicker` returned null when `open=true`** — for
   data inconsistencies (missing user record), the modal silently
   didn't render while the calling state thought it was open. Now
   surfaces a `pushToast('Couldn\'t find counterparty…')` and auto-
   closes the calling state.

3. **`onSendOffer` deep link was dead** — navigated to
   `/brand/campaigns/:id?action=offer&creator=X` but
   `brand/CampaignDetail.tsx` never read those query params. Added a
   `useEffect` that auto-opens the offer modal with the creator
   pre-selected, then strips the params so refresh doesn't re-fire.

**MAJOR:**

4. **Presence broadcast on every deal page** — `usePresence` was
   firing for every deal even though the banner only renders on
   disputed. Now gated: `usePresence(deal && deal.state === 'disputed'
   ? \`deal:${id}\` : null, …)`.

5. **Presence label leaked emails cross-role** — creators and brands
   would see each other's literal emails in the banner. Now uses
   creator/brand display names; admins still see emails (they ID each
   other that way internally).

6. **Round-N-1 lookup used exact-match** — broke on non-contiguous
   round sets (e.g. rounds 1, 3 — Compare for Round 3 vanished).
   Switched both Lightbox and FilesPanel `prevRound` lookups to the
   highest-prior pattern: `submissions.filter(s.round < r).sort(desc)[0]`.

7. **Lightbox didn't reset on submission mutation** — a new
   submission landing mid-zoom would leave the user on stale data.
   Effect deps now include `submissions.length`.

8. **"Upload Round X" formula used `submissions.length + 1`** — wrong
   for re-offer cycles where prior submissions exist alongside a
   fresh accepted-production state. Switched to
   `(latestSubmission?.round ?? 0) + 1` everywhere.

9. **"Add evidence" verb was misleading** — handler routed to chat,
   not a real evidence flow. Relabeled "Send context to support"
   until Phase 27/28 ships the evidence uploader.

10. **`onWithdrawCounter` was a stub toast** — left the creator
    stranded. Now wired via `tx()` to flip `offer.status = 'withdrawn'`
    with a `confirmAction` prompt.

**MINOR:**

11. **`onDeclineOffer` had no undo** — inconsistent with
    `onDeclineApplicant`. Added `pushUndoToast` with 5s window.

12. **`TerminalBanner` copy assumed "declined"** — confusing for
    `withdrawn`. Branched per state.

13. **`ClosedBanner` showed "earned $0"** — jarring for outcome
    campaigns with no conversions. Special-case "no payout this cycle".

14. **`.deal-banner-passive` was visually indistinguishable** — same
    shadow/border as base. Now no shadow + dimmer text + softer
    border so passive reads as "calm" vs "actionable".

15. **Mobile chat composer had `resize: vertical`** — awkward touch
    handle. Locked to `resize: none` at the 800px breakpoint.

### Files added (Phase 25)

- `app/src/screens/deal/DealActionBanner.tsx` (~480 lines)

### Files modified (Phase 25)

- `app/src/screens/deal/Deal.tsx` — full rebuild from Phase 24 stub
- `app/src/screens/brand/CampaignDetail.tsx` — `?action=offer&creator=X`
  query-param consumption (will be removed when Phase 27 absorbs)
- `app/src/styles/screens.css` — full deal-page CSS system

### Phase 25 build size

`283.00 KB initial / 80.00 KB gzip · 0 warnings · 0 errors · 5.55s`
(+0.00 KB gzip from Phase 24 — the deal page is lazy-loaded).
Deal chunk: 38.37 KB / 9.98 KB gzip (lazy).

### Phase 25 verification

- [x] All 13 deal states render with appropriate banners for each role
- [x] Admin viewing any non-disputed deal sees an observer banner
- [x] Disputed banner pulses with cross-tab presence when other admins
      are viewing the same case
- [x] All modal handlers wired: counter / upload / dispute / review /
      message; inline accept / approve / shortlist / decline / withdraw
- [x] Phase 21 Lightbox + Phase 22 diff view work for non-contiguous rounds
- [x] Chat composer sends with `Cmd+Enter`, auto-mark-read on view
- [x] Brief panel collapses cleanly; rights breakdown shows all 5 fields
- [x] Timeline merges campaign / application / offer / submission /
      feedback / dispute / payout events chronologically
- [x] Mobile (≤800px) layout stacks topbar, narrows chat thread height,
      locks composer resize
- [x] Brand campaign-detail consumes deep-link query params
- [x] Build clean, 0 warnings, 0 errors

### What's next

Phase 26 — Today rebuild for both creator and brand. The action queue
becomes the new home screen. Foundation for this lives at
`app/src/lib/utils/today-deals.ts` (already shipped at the close of
Phase 25 prep) which collects (campaignId, creatorId) pairs for a
viewer and runs them through `deriveDeal` + `rankDeals`. Phase 26
builds the UI: a flat ranked queue replacing the bucket-based Today
screens, plus row-level inline CTAs that dispatch to the deal page.

---

## ✅ Phase 26 — Today rebuild: flat ranked queue (shipped)

The bucketed Today (Phase 4) split work into 6–7 typed sections per
role: offers, drafts, revisions, payouts, disputes, matching campaigns,
applications. Each row had inline accept/decline/approve CTAs, which
sounded efficient but in practice meant the same deal could appear in
two sections (e.g. an offer the creator countered shows in "active
offers" AND requires brand response → "counter offers" on the brand
side), and the inline actions duplicated the deal-page chrome we just
built in Phase 25. The buckets also forced the user to decide priority
themselves: a 30-min-old approval, a 2-day-old draft due, and a fresh
dispute all sat in different sections at equal visual weight.

Phase 26 collapses the buckets into a single ranked queue. Every deal
goes through `computeDealAction` (Phase 24) which assigns an urgency
score (1000 disputed admin → 50 closed). `rankDeals()` sorts and splits
into `actionable` (the viewer needs to act) vs `passive` (the other
side is working). The Today UI presents one ordered list of actionable
deals — the most urgent thing on top, no bucket-hopping — and a passive
"recent activity" tail for the other-blocked stuff.

Each row is a Link to `/deal/:dealId`. No inline CTAs. The deal page
already has every action surface; duplicating them here was the bug.

### Files added (Phase 26)

```
app/src/components/today/TodayQueue.tsx        # shared presenter
app/src/components/today/TodayDealRow.tsx      # single deal row
```

(`app/src/lib/utils/today-deals.ts` was added during Phase 25 prep.)

### Files modified (Phase 26)

```
app/src/screens/creator/Today.tsx              # 411 → 84 lines
app/src/screens/brand/Today.tsx                # 437 → 132 lines
app/src/styles/screens.css                     # +260 lines (Phase 26 block)
PROGRESS.md                                    # this section + tracker
```

The two screen files are now thin wrappers — they assemble role context
(creator/brand record, viewer userId) and build a 4-KPI strip, then
hand off to `<TodayQueue />`. The shared presenter handles headline,
KPI strip, empty state, actionable section, passive recent-activity
tail, and a generic `prequel` slot for campaign-level alerts that don't
fit the deal model.

### Phase 26 architecture

```
collectTodayDeals (today-deals.ts)
  ↓ enumerates (campaignId, creatorId) pairs from db
  ↓ for each: deriveDeal → state + action + ranked
  ↓ rankDeals splits actionable vs passive
RankedDeals<Deal>
  ↓
TodayQueue presenter
  ├── Headline ("3 things need you" / "Sarah — you're caught up")
  ├── KPI strip (wallet · escrow · last 30 days · lifetime — creator;
  │              escrow · wallet · live briefs · active — brand)
  ├── Optional prequel slot (orphan brief notice for brand)
  ├── Empty state (only when total=0 AND recentCount=0)
  ├── Actionable rows (sorted by urgency score, no cap)
  └── Passive tail (capped at 8, "+N earlier" footer for the rest)

TodayDealRow
  ├── urgency icon (🔥 ≥800 / ⚠️ ≥400 / 📄 ≥100 / 💬 <100)
  ├── verb (deal.action.verb — "Approve $1,500", "Send draft", etc.)
  ├── subtitle (counterparty · campaign · why-now)
  ├── money halo (escrowHeld → acceptedOffer.rate → offer.rate)
  ├── state pill (existing dealStateLabel + dealStateTone)
  └── chevron → /deal/:dealId
```

### KPI strip per role

The headline + queue answer "what needs me?" — the KPI strip is a calm
money/momentum signal alongside, never duplicating that question.

**Creator KPIs** — wallet (cleared), in escrow (held while drafts
review), last 30 days payouts cleared, lifetime earnings + tier + star
rating.

**Brand KPIs** — in escrow (held across deals), wallet (available to
fund offers), live briefs (with pending pitches count as detail),
active campaigns in flight.

### Phase 26 QA findings + fixes

QA via parallel audit agent. Fixes:

- **CRITICAL · Brand `LIVE BRIEFS` detail had a broken ternary**
  returning identical string in both branches. Replaced with a useful
  signal: "X new pitches" (count of pending applications) so the KPI
  strip surfaces real pipeline activity.
- **HIGH · Deal-only model loses orphan overdue briefs.** A live brief
  with no creators on it (zero applications, empty shortlist) doesn't
  produce any (campaign × creator) pair, so it's invisible in
  `collectTodayDeals`. Phase 4 handled this via separate "Past
  deadline" / "Stuck stages" sections. Phase 26 fix: brand/Today.tsx
  computes `orphanOverdue` count and renders a small
  `.today-notice` strip via TodayQueue's new `prequel` slot, deep-
  linking to `/brand/campaigns?attention=1` (the pipeline kanban that
  already surfaces these via `attentionFlags`).
- **MEDIUM · Money halo on closed deals** — for a closed deal where
  escrow was fully released, the halo shows acceptedOffer.rate. This
  reads as "the deal value was $X" (deliberate). Documented in
  `TodayDealRow.tsx`; no behaviour change.
- **MEDIUM · Urgency emojis** vs ui-ux-pro-max "no emojis as icons"
  rule. Kept as a deliberate semantic choice — the four bands carry
  cross-platform meaning (🔥/⚠️/📄/💬) that's hard to replicate with
  custom SVG, and the desaturate-filter softens them visually. Worth
  revisiting if the design system tightens.
- **LOW · Mobile subtitle wraps to 2 lines** (vs desktop 1-line
  ellipsis) — intentional readability choice on small screens, kept
  as-is.

### Phase 26 build size

```
index-…js 269.79 KB / 78.95 KB gzip   (was 283.00 KB / 80.00 KB after Phase 25)
```

Net **−13.21 KB / −1.05 KB gzip** from collapsing the bucketed Today
screens. The new screens carry far less code: creator Today went from
411 → 84 lines, brand Today went from 437 → 132 lines.

### Phase 26 verification

- [x] `npm run build` clean, 0 warnings, 0 errors
- [x] Both Today routes mount under existing ProtectedRoute
- [x] Creator queue ranks: disputed > revisions > drafts > offers,
      with passive applications-in-review and brand-reviewing-work in
      the recent activity tail
- [x] Brand queue ranks: disputed > counters > drafts to review > new
      applications, with passive in-production deals in recent activity
- [x] Empty state shows only when both actionable and passive are
      empty (5 in-flight pitches still hides empty state)
- [x] Orphan overdue brief notice appears for brand when applicable,
      links to pipeline view
- [x] KPI strip mobile reflows to 2x2 grid at ≤700px
- [x] Row hover lifts subtly, chevron slides 3px on hover, focus-
      visible outlines remain

### What's next

Phase 27 — Brand campaign roster. Replaces the 4-tab brand
CampaignDetail (Brief / Pipeline / Files / Logs) with a deal-row list:
the campaign brief stays as a collapsible header card, and the body
becomes a list of deal rows (one per accepted creator + one per
shortlisted creator + one per pending application), each linking to
the canonical deal page. The kanban view stays untouched at
`/brand/campaigns` for pipeline-mode browsing.

---

## ✅ Phase 27 — Brand campaign roster (shipped)

The old brand `CampaignDetail.tsx` was a 1,339-line 4-tab page
(Overview / Pipeline / Files / History) where each tab re-rendered the
same applicants from a different angle. The Pipeline tab's 6-stage
applicant kanban was the centerpiece — every creator's lifecycle on
this campaign visible at once — but it duplicated every action that
now lives on the deal page (shortlist, send offer, accept counter,
approve draft, request revisions). Files tab also let you approve /
revise submissions per-creator. So a single deal could be acted on
from three different surfaces, and the brand had to remember which
view they were looking at to make sense of "where does this creator
sit?"

Phase 27 collapses all four tabs into one canonical view: a deal-row
roster grouped into 5 state bands. The campaign brief stays at the top
as a collapsible card; the body is a flat list. Each row is a Link to
`/deal/:dealId` — no inline action duplication. The one inline button
is "Send offer" on shortlisted-band rows, since clicking through to a
deal page just to compose an offer would be friction.

### Files added (Phase 27)

```
app/src/screens/brand/CampaignRoster.tsx          # ~330 lines (orchestrator)
app/src/components/campaign/RosterRow.tsx         # ~85 lines (single row)
app/src/components/modals/OfferModal.tsx          # ~115 lines (extracted)
```

### Files modified (Phase 27)

```
app/src/router.tsx                                # /brand/campaigns/:id swap
app/src/styles/screens.css                        # +280 lines (.roster-* block)
PROGRESS.md                                       # this section + tracker
```

### Files deprecated (will be deleted in Phase 29)

```
app/src/screens/brand/CampaignDetail.tsx          # 1,339 lines, dead code
```

The old file is unreachable from any route (audit confirmed: no
`BrandCampaignDetail` imports remain in `src/`). Phase 29 deletes it
alongside other dead screens.

### Phase 27 architecture

```
deriveDeal × every (campaignId, creatorId) pair on this campaign
  → state + action + ranked
  → group by 5-band state map (bandFor)

CampaignRoster
  ├── Sticky header (cmp-detail-* CSS reused)
  │   ├── Breadcrumb · Campaigns ›
  │   ├── Title row · pills · cover
  │   ├── KPI strip · Budget · Spent · Escrow · Applicants · Accepted · Needs you
  │   ├── Stage progress bar (clickable, confirm on backward / skip-ahead)
  │   └── Header actions · Open dispute · Clone · Move to next stage
  └── Body
      ├── Brief card (collapsible — pitch, deliverables, rights, schedule)
      └── Bands
          ├── Needs your decision  · disputed · in-review · offer-countered
          ├── In flight             · offer-pending · accepted-production · revisions-requested
          ├── Shortlist             · shortlisted        (inline "Send offer" button)
          ├── New applications      · applied
          └── Past                  · approved · posted · closed · declined · withdrawn

RosterRow (creator-led)
  ├── Portrait
  ├── Name — verb (e.g., "Sarah Chen — Approve $1,500")
  ├── Reason ("Round 2 · uploaded 4h ago")
  ├── Money halo (escrowHeld → acceptedOffer.rate → offer.rate)
  ├── State pill
  ├── Optional inline action button (e.g., "Send offer" on shortlist)
  └── Chevron → /deal/:id
```

### Deep-link bridge (Phase 25 → 27)

The deal page's `onSendOffer` handler (Phase 25 stub at
`Deal.tsx:275`) navigates to
`/brand/campaigns/:id?action=offer&creator=X`. Originally that opened
the offer modal on the old CampaignDetail. The new CampaignRoster
preserves the same param contract — it auto-opens OfferModal with the
target creator pre-selected, then strips the params from the URL so
refresh doesn't re-fire. This means Deal.tsx didn't need to change in
this phase; the deep link still works.

(A nicer pattern would be to render OfferModal directly on the deal
page for shortlisted brand views, eliminating the round-trip. That's
deferred to a polish pass — out of Phase 27 scope.)

### Phase 27 QA findings + fixes

QA via parallel audit agent. Fixes:

- **HIGH · Empty-state link to dead route.** The "Find creators" CTA
  on the no-applicants empty state pointed to `/brand/find-creators`,
  which doesn't exist; correct route is `/brand/discover`. Fixed.
- **MEDIUM · OfferModal effect deps too broad.** The rate-reset
  `useEffect` depended on `[creatorId, campaign, brand, db]`. The
  store's `db` and `brand` object refs change on every state tick
  (Zustand selector returns the live object, not a stable
  reference), so the effect was thrashing. Tightened to
  `[creatorId, campaign.id, brand?.id]` with an
  exhaustive-deps disable comment, since `db` and `brand` are read
  fresh inside but identity-stable across the relevant id changes.

### What the new roster loses (acceptable trades)

- **Campaign-wide audit log** — moved to per-deal Timeline panel on
  `/deal/:id`. Brand-level history is no longer visible on this
  surface. Trade: less observability, more focus.
- **Tracking metrics** (`CampaignTracking[]`) — old Overview tab
  visualized per-creator clicks/conversions. The roster shows the
  rolled-up KPIs (Budget · Spent · Escrow) but not per-creator
  tracking. If a brand wants per-creator post-flow performance, the
  /deal/:id page exposes it. Acceptable.
- **Cross-creator file browsing** — Files tab let brands triage
  every creator's submissions in one place. Now each creator's
  submissions live on their /deal/:id page. Acceptable: drafts to
  review surface in the "Needs your decision" band, and clicking
  through is one tap to the canonical files panel.

### Phase 27 build size

```
CampaignRoster chunk: 13.67 KB / 4.49 KB gzip
(was) CampaignDetail: 42.26 KB / 10.82 KB gzip   (still in dist; deleted in Phase 29)
index bundle:        269.69 KB / 78.92 KB gzip   (was 269.79 KB after Phase 26)
```

### Phase 27 verification

- [x] `npm run build` clean, 0 warnings, 0 errors
- [x] `/brand/campaigns/:id` routes to BrandCampaignRoster
- [x] All 13 DealStates mapped to one of 5 bands; no fallthrough
- [x] Deep link `?action=offer&creator=X` consumed correctly,
      params stripped after consumption
- [x] OfferModal correctly extracted, used by both roster (inline
      Send offer button on shortlisted rows + deep link) and
      CreatorProfileDrawer's existing Send offer flow
- [x] Stage progress bar with backward/skip-ahead confirmAction
      preserved from old CampaignDetail
- [x] Mobile (≤800px) reflows: portrait shrinks to 36px, meta wraps
      below name line, brief card narrows, band help text drops
      below count

### What's next

Phase 28 — Admin unified queue. Today admin work splits across three
screens: `/admin/queue` (creator applications), `/admin/verify`
(brand verification), `/admin/disputes` (dispute resolution). All
three are queue-shaped. Phase 28 merges them into one
`/admin/queue?type=...` surface with a tab switcher, plus an
admin-flavoured dispute case page that reuses the deal page chrome
with admin-only resolution controls layered on top.

---

## ✅ Phase 28 — Admin unified queue (shipped)

Admin had three sibling screens that all said "things waiting on you":
`/admin/queue` (pending creators), `/admin/verify` (unverified
brands), `/admin/disputes` (open cases). Each lived at a different
URL, had its own sidebar entry, its own header, its own count badge.
Admins triaging a busy day were essentially context-switching three
times to ask the same question (what's overdue?).

Phase 28 collapses these into one `/admin/queue?type=...` page with
three tabs. Each tab carries a count pill in a severity colour
(orange for creators, blue for brands, red for disputes), so a glance
at the tab strip tells the admin where the day's pressure is. The old
sidebar's three entries (Application queue / Verify brands /
Disputes) become one "Queue" entry with the combined badge.

The implementation reuses the existing screens as embedded children
via a new `hideHead` prop, so each tab still renders the
field-tested triage UI (creator-card review modal with risk signals,
brand verify toggle table, dispute resolution form with money math)
— it's the chrome around them that unified.

### Files added (Phase 28)

```
app/src/screens/admin/AdminQueueUnified.tsx     # ~120 lines
```

### Files modified (Phase 28)

```
app/src/screens/admin/Queue.tsx                 # added hideHead? prop
app/src/screens/admin/Verify.tsx                # added hideHead? prop
app/src/screens/admin/Disputes.tsx              # added hideHead? prop
app/src/router.tsx                              # /admin/queue → unified;
                                                  /admin/verify, /admin/disputes redirect
app/src/components/layout/nav.ts                # 3 admin entries → 1 "Queue"
app/src/components/layout/Sidebar.tsx           # cleaned 'disputes' badge note
app/src/components/layout/GlobalHotkeys.tsx     # `g v` and `g d` now jump tabs
app/src/components/search/GlobalSearch.tsx      # 3 admin search items
app/src/lib/api/client.ts                       # dispute notification deep link
app/src/lib/utils/admin-metrics.ts              # activity feed hrefs
app/src/screens/admin/Home.tsx                  # console queue tile hrefs
app/src/screens/deal/Deal.tsx                   # admin onResolveDispute target
app/src/styles/screens.css                      # +50 lines (.admin-unified-* + tab severity hues)
PROGRESS.md                                     # this section + tracker
```

### Phase 28 architecture

```
/admin/queue                          → AdminQueueUnified (default tab=creators)
/admin/queue?type=brands              → AdminQueueUnified (tab=brands)
/admin/queue?type=disputes            → AdminQueueUnified (tab=disputes)
/admin/verify                         → Navigate to /admin/queue?type=brands
/admin/disputes                       → Navigate to /admin/queue?type=disputes

AdminQueueUnified
  ├── Single PageHead (title varies per tab; "X items need review" headline)
  ├── Tab strip · Creators · Brands · Disputes
  │     each with a count pill in severity hue
  └── Body
      └── Switch on tab:
          tab === 'creators' → <AdminQueue hideHead />
          tab === 'brands'   → <AdminVerify hideHead />
          tab === 'disputes' → <AdminDisputes hideHead />
```

The dispute-case-page-as-deal-page concept (originally part of the
Phase 28 plan) was deferred. The deal page's admin-flavoured banner
(Phase 25) already handles the case-view UI, but the inline
resolve-money form (release/refund split with validation) lives only
on the AdminDisputes table modal and was non-trivial to lift onto
the deal page in this phase. Deal.tsx's admin `onResolveDispute`
handler now navigates to `/admin/queue?type=disputes` where the
operator can pick the case and resolve. A future polish pass can
absorb the resolve modal directly onto the deal page.

### Phase 28 QA findings + fixes

QA via parallel audit agent found 3 HIGH-priority stale references
to the now-redirected old admin paths. All fixed in this phase rather
than relying on redirect bounces:

- **`src/lib/utils/admin-metrics.ts`** activity feed: dispute-resolved
  events linked to `/admin/disputes`; brand-verified events linked
  to `/admin/verify`. Updated to deep-link directly to the unified
  page with the right tab.
- **`src/components/layout/GlobalHotkeys.tsx`**: `g v` and `g d`
  hotkeys navigated to old paths. Updated to land on the right tab
  directly. Hotkey labels also clarified ("Go to Queue · brands").
- **`src/components/search/GlobalSearch.tsx`**: admin search row for
  "Open disputes" pointed at `/admin/disputes`. Replaced with three
  scoped search rows for the three admin queue tabs.
- **`src/lib/api/client.ts`** dispute-filed notification: the deep
  link in the team notification was `/admin/disputes`. Updated.
- **`src/screens/admin/Home.tsx`** console queue tiles: linked to
  old paths. Updated.
- **`src/screens/deal/Deal.tsx`** admin observer banner's
  onResolveDispute: navigated to `/admin/disputes`. Updated.
- Cleaned up the orphan `'disputes'` value from the `badgeKey`
  union in `nav.ts` and the unused `disputes` key from Sidebar's
  `badges` map.

### Phase 28 build size

```
AdminQueueUnified chunk: 27.97 KB / 7.61 KB gzip
(replaces) Queue + Verify + Disputes individual chunks
index bundle:           269.58 KB / 78.84 KB gzip   (was 269.69 KB after Phase 27)
```

The unified chunk bundles all 3 screens together (since they're
imported by the unified page). Net effect on initial load is
neutral — admins were already loading at most one of these at a
time; now they load one chunk that contains all three.

### Phase 28 verification

- [x] `npm run build` clean, 0 warnings, 0 errors
- [x] `/admin/queue` defaults to creators tab
- [x] `/admin/verify` redirects to `/admin/queue?type=brands`
- [x] `/admin/disputes` redirects to `/admin/queue?type=disputes`
- [x] Tab switching updates URL via setParams (replace mode); back-
      forward works
- [x] Tab counts update live as the underlying queue mutates
- [x] PageHead label and lede swap per tab
- [x] All 6 stale references to old paths (admin-metrics activity
      feed, GlobalHotkeys, GlobalSearch, client.ts notifications,
      admin Home tiles, Deal.tsx admin banner) updated
- [x] Sidebar collapses 3 entries into 1 "Queue" with combined badge
- [x] No remaining direct refs to `/admin/verify` or `/admin/disputes`
      in app code (router redirects keep typed-URL navigation working)

### What's next

Phase 29 — delete dead screens. After Phases 26-28 the following old
files are unreachable from any route or import: creator/Today (old
bucketed version is the file we replaced in place — keep), brand/Today
(same — kept in place, replaced), brand/CampaignDetail.tsx (1,339
lines, replaced by CampaignRoster), brand/Approvals.tsx (replaced by
Today's queue), creator/Home.tsx + brand/Home.tsx (Today now plays
the home role), creator/Content.tsx (deal-page Files panel covers
this). Phase 29 deletes the dead files and simplifies sidebar nav.

---

## ✅ Phase 29 — Delete dead screens (shipped)

After Phases 26-28 swept Today, Campaign Roster, and Admin Queue into
their canonical surfaces, four screens had no users:

- `brand/CampaignDetail.tsx` (1,339 lines) — replaced wholesale by
  the new `CampaignRoster` in Phase 27. Already unreachable from
  router after that swap.
- `brand/Home.tsx` (277 lines) — Today (Phase 26) is the new home.
  KPI strip on Today already shows escrow/wallet/live briefs/active
  campaigns; trust-tier and activity-feed signals can be re-surfaced
  in a future polish if missed.
- `brand/Approvals.tsx` (534 lines) — Today's "Needs your decision"
  band shows in-review submissions ranked by urgency; per-submission
  review happens on `/deal/:id`. The 'all' tab in Approvals (history
  of past approvals) is mildly missed but not load-bearing.
- `creator/Home.tsx` (292 lines) — Today is creator's home now. The
  Earnings page already covers the money story; trust-tier and
  storefront preview can be re-surfaced if missed.

Phase 29 also keeps `creator/Content.tsx`, `creator/Campaigns.tsx`,
`creator/CampaignDetail.tsx` because each has unique value the deal
page doesn't cover (AI concept generator, applications kanban, full-
page brief view). Aggressive merging of those is deferred to Phase 30
polish.

### Files deleted (Phase 29)

```
app/src/screens/brand/CampaignDetail.tsx   # 1,339 lines
app/src/screens/brand/Home.tsx              #   277 lines
app/src/screens/brand/Approvals.tsx         #   534 lines
app/src/screens/creator/Home.tsx            #   292 lines
                                            # ─────────
                                            # 2,442 lines deleted
```

### Files modified (Phase 29)

```
app/src/router.tsx                            # 4 lazy imports removed; 3 redirects added
app/src/components/layout/nav.ts              # CREATOR_NAV: -1 entry; BRAND_NAV: -2; badgeKey union pruned
app/src/components/layout/Sidebar.tsx         # dropped 'approvals' badge computation
app/src/components/layout/GlobalHotkeys.tsx   # 'g a' brand → Analytics; 'g n' kept as alias
app/src/components/search/GlobalSearch.tsx    # a_appr → /brand/today
app/src/lib/api/client.ts                     # 4 notification deep-links retargeted
app/src/lib/api/seed.ts                       # 3 notification deep-links retargeted
PROGRESS.md                                   # this section + tracker
```

### Phase 29 architecture: redirect strategy

```
GET /brand/home       → 301 → /brand/today
GET /brand/approvals  → 301 → /brand/today    (query string dropped — old ?cid= deep links lose pinpoint)
GET /creator/home     → 301 → /creator/today

Direct typed-URL navigation (e.g. user has a /brand/approvals bookmark)
still works via the React Router <Navigate replace /> elements.
Notification deep-links are now generated pointing at the new paths so
new notifications don't bounce.
```

### Phase 29 QA findings + fixes

QA via parallel audit agent. Two HIGH-priority issues fixed:

- **HIGH · `'g n'` hotkey alias missing.** A comment said 'g n' was
  kept as an alias for Analytics (since 'g a' was repurposed from
  Approvals), but no `map['g n']` entry was added. Users who had
  muscle memory for 'g n' would silently get nothing. Fixed by
  adding the binding without re-documenting it (kept off the help
  dialog so 'g a' remains the canonical entry).
- **HIGH · Stale `'approvals'` badgeKey enum.** The `badgeKey`
  union in `nav.ts` still listed `'approvals'`, and Sidebar.tsx still
  computed `badges.approvals` even though no nav item used it.
  Pruned both. Same cleanup applied to `'disputes'` (Phase 28 fix
  rolled into here).

### Phase 29 build size

```
index bundle:  268.75 KB / 78.59 KB gzip   (was 269.58 KB after Phase 28)
```

Plus the 4 lazy chunks for the deleted screens are gone from the
output. ~75 KB of unloaded chunk code no longer ships. Minor net
saving on initial bundle (the chunks were lazy anyway), but cleaner
build output.

### Phase 29 verification

- [x] `npm run build` clean, 0 warnings, 0 errors
- [x] Old paths redirect cleanly: `/brand/home`, `/brand/approvals`,
      `/creator/home` all 301 to their respective `/today` surface
- [x] Sidebar shows the simplified nav: creator has 8 entries (was 9),
      brand has 7 entries (was 9)
- [x] No active code references to deleted files
- [x] All notification deep-links point at the new paths
- [x] Hotkey help dialog reflects the renamed 'g a' binding (Analytics)
- [x] `'g n'` still navigates to Analytics for backward compat

### What's next

The deal-page redesign is structurally complete. Phase 30 — final QA
and polish — is the optional final pass:

- **Component cleanup**: TrustProgression and `creatorActivity()` /
  `creatorTrustProgression()` helpers still ship but aren't used by
  any active screen. Remove or archive.
- **Inline OfferModal on the deal page**: Phase 27 deferred
  building an inline OfferModal on the deal page for shortlisted
  brand-side deals. Currently the deal page deep-links to
  `/brand/campaigns/:id?action=offer&creator=X` (the roster handles
  it). Lifting this to the deal page itself eliminates the round-trip.
- **Inline dispute resolve on the deal page**: Same shape — admin's
  resolve flow lives on `/admin/queue?type=disputes`; could be
  absorbed into the deal page's admin banner.
- **Before/after click-count comparison**: Document the click-count
  reductions for canonical journeys (e.g., "creator approves a
  draft" went from 5 clicks across 3 surfaces to 2 clicks on one
  surface).
- **Updated screen map**: Refresh the surface-by-surface coverage
  table in this PROGRESS doc to reflect the post-redesign layout.

The redesign treated the deal as the unit of UX. Five phases of
disciplined work and ~3,800 lines of dead code purged. Net route
count: 30 → 22 (≈27% fewer). Most importantly: any deal lives on
one canonical surface instead of being scattered across 5-7 today.

---

## ✅ Phase 30 — Final polish (shipped)

Phase 30 closed the four polish items left at the end of Phase 29.
Each one is a small, contained change; together they round out the
deal-page-as-canonical-surface story.

### A · Orphan component & helper cleanup

After Phase 29 deleted creator/Home and brand/Home, three helpers and
one component had no callers but kept shipping:

- `TrustProgression.tsx` — bronze/silver/gold tier progression card,
  used only by the deleted creator/Home.
- `creatorActivity()`, `brandActivity()` — activity-stream selectors
  that both Home pages consumed.
- `topCreatorsForBrand()` + `TopCreatorRow` — used only by deleted
  brand/Home.
- `creatorTrustProgression()` + `TrustProgressionInfo` — used only by
  deleted TrustProgression component.

All deleted. `dashboard-metrics.ts` now retains just `dailySeries`
(used by Earnings/Wallet/Analytics for sparklines) and the
`ActivityEvent` shape (still consumed by admin/Home's activity feed +
the money-metrics → ActivityEvent[] adapter).

```
DELETED: app/src/components/dashboard/TrustProgression.tsx
TRIMMED: app/src/lib/utils/dashboard-metrics.ts (532 → 110 lines)
```

If a future polish brings the Home dashboards back, recover from
`_backup-pre-deal-redesign-2026-05-05/`.

### B · Inline OfferModal on the deal page

The Phase 27 plan put the offer-composer modal on the brand campaign
roster. The deal page's `onSendOffer` handler navigated to
`/brand/campaigns/:id?action=offer&creator=X`, where the roster's
useEffect auto-opened the modal. It worked, but added a navigation
hop for what should be a one-click action on the same surface.

Phase 30 inlines OfferModal on the deal page itself. When a brand
clicks "Send offer" on a shortlisted deal, the modal pops in place;
after send, the deal state transitions shortlisted → offer-pending
and DealActionBanner re-renders with the post-offer CTAs (now waiting
on creator response) — all without a page navigation.

The deep link to the roster is kept working for backward compat (any
external bookmark of `?action=offer&creator=X` still auto-opens the
modal there); the deal page just stops generating new ones.

### C · Inline DisputeResolveModal on the deal page

Same shape as B but for admin's dispute resolution. Phase 28's
unified queue had the resolve form embedded inline in `Disputes.tsx`.
The deal page's admin observer banner had a "Resolve" button that
navigated to `/admin/queue?type=disputes` — useful but also a
navigation hop that shouldn't be needed.

Phase 30 extracts the resolve form into a standalone
`DisputeResolveModal.tsx` (`~270 lines`). Both surfaces now mount the
same component:

- `admin/Disputes.tsx` (the queue table) — clicking "Resolve" sets
  `activeId`, modal opens.
- `deal/Deal.tsx` (the per-deal page) — clicking "Resolve" in the
  admin observer banner sets `resolveOpen`, modal opens with the
  same form, same validation, same Phase 22 cross-tab presence
  signal so two admins on the same dispute see each other.

`admin/Disputes.tsx` shrank from 281 to 156 lines. The form state +
money-math validation now lives once, in one place, used by both
surfaces.

### D · Click-count comparison

The redesign's UX promise: "any deal lives on one canonical surface
instead of being scattered across 5-7 today." Here's what that
means in concrete clicks for the most common journeys.

| Journey | Pre-Phase 24 (bucketed Today + 4-tab CampaignDetail) | Post-Phase 30 |
|---|---|---|
| **Brand approves a creator's draft** | open Today → click "Awaiting decision" row → land on `/brand/approvals` (or CampaignDetail Files tab) → find submission → click "Approve" → confirm | Today → row → /deal/:id (banner shows "Approve $X") → Approve |
| Total | **~5 clicks across 2-3 surfaces** | **2 clicks on 1 surface** |
| **Creator counter-offers an offer** | Today → row → /creator/campaigns/:id (drawer) → "Counter" → modal → submit | /creator/today → row → /deal/:id → "Counter" in banner → modal → submit |
| Total | **5 clicks across 2 surfaces** | **4 clicks on 1 surface (modal in place)** |
| **Brand sends first offer to a shortlisted creator** | /brand/campaigns/:id → Pipeline tab → shortlist column → click creator → "Send offer" → modal | /brand/campaigns/:id (Roster) → shortlist row → "Send offer" inline button → modal in place |
| Total (Phase 27) | **5 clicks across 2 tabs** | **3 clicks on 1 surface** |
| Total (Phase 30, from Discover) | n/a | **3 clicks** (Discover → creator → /deal/:id → Send offer) |
| **Admin resolves a dispute** | /admin/disputes → "Resolve" → inline modal | Either: /admin/queue?type=disputes → "Resolve" → modal · OR · /deal/:id → "Resolve" in banner → modal |
| Total | **2 clicks** | **2 clicks (no surface change required)** |
| **Brand morning routine** (review all overnight activity) | /brand/home → /brand/today → /brand/approvals → /brand/inbox | /brand/today (one screen, ranked queue + KPI strip + recent activity tail) |
| Page loads | **4** | **1** |
| **Creator checks "what needs me"** | /creator/today → scan 6-7 bucketed sections to find priority | /creator/today → top of one ranked list = highest urgency |
| Cognitive load | high (decide section first, then row) | low (scan top-down) |

The numerical reductions matter, but the bigger UX win is **one mental
model**. Every deal lives at `/deal/:id`. Every queue row is a deal
row. Every action surface either lives on the deal page or pops a
modal on top of it. There's no "which view should I be in?" question.

### E · Updated screen map

After Phase 30 the surface-by-surface picture is:

| Role | Today | Discover | Campaigns/Deal | Money | Profile |
|---|---|---|---|---|---|
| **Creator** | ✅ Phase 26 — flat ranked queue (the home) | ✅ Phase 9 — live campaigns | ✅ /creator/campaigns kanban → ✅ /deal/:id (Phase 25) | ✅ Earnings (Phase 10) | ✅ Profile (Phase 12) |
| **Brand** | ✅ Phase 26 — flat ranked queue (the home) | ✅ Phase 9 — find creators | ✅ /brand/campaigns kanban → ✅ /brand/campaigns/:id Roster (Phase 27) → ✅ /deal/:id | ✅ Wallet (Phase 10) | ✅ Profile (Phase 12) |
| **Admin** | ✅ /admin/queue?type=… (Phase 28 unified) | — | ✅ /deal/:id with admin banner (Phase 25) — disputed deals get inline Resolve (Phase 30) | ✅ Payouts (Phase 8) | — |

Plus shared surfaces: Inbox (Phase 11), Analytics (Phase 12),
public storefront (Phase 6), notifications + onboarding (Phase 15),
AI-assist (Phase 17). The deal page absorbed Approvals, Content
production-tracker, the per-creator drawer, and the Files tab.

### Files added (Phase 30)

```
app/src/components/modals/DisputeResolveModal.tsx   # ~270 lines (extracted)
```

### Files modified (Phase 30)

```
app/src/lib/utils/dashboard-metrics.ts   # 532 → 110 lines (dead helpers removed)
app/src/screens/deal/Deal.tsx             # OfferModal + DisputeResolveModal mounted inline; 2 navigate() handlers replaced with setOpen state
app/src/screens/admin/Disputes.tsx        # 281 → 156 lines (inline form lifted into shared modal)
PROGRESS.md                                # this section + tracker
```

### Files deleted (Phase 30)

```
app/src/components/dashboard/TrustProgression.tsx
```

### Phase 30 build size

```
DisputeResolveModal extracted into its own chunk → reused by
admin queue and deal page (no duplication).

AdminQueueUnified chunk:  27.93 KB → 23.28 KB    (resolve modal lifted out)
Deal chunk:               30.85 KB → 31.06 KB    (modals mounted inline)
index bundle:            268.75 KB / 78.59 KB → 268.80 KB / 78.61 KB gzip
                          (essentially unchanged; trade-off was a wash)
```

### Phase 30 verification

- [x] `npm run build` clean, 0 warnings, 0 errors
- [x] Deal page mounts OfferModal for brand role; "Send offer" opens
      it in place; no navigation
- [x] Deal page mounts DisputeResolveModal for admin role + open
      dispute; "Resolve dispute" opens it in place; no navigation
- [x] AdminDisputes table still renders correctly via shared modal;
      validation rules + presence + UX preserved
- [x] No active imports of deleted helpers (TrustProgression,
      creatorActivity, brandActivity, topCreatorsForBrand, etc.)
- [x] dashboard-metrics.ts down to 110 lines from 532

### What was accomplished — full redesign ledger

Seven phases (24–30). The deal-page redesign is complete.

| Metric | Before | After | Delta |
|---|---|---|---|
| Routes | 30 | 22 | −27% |
| Lines deleted | — | ~3,800 | (CampaignDetail 1339 + Approvals 534 + 2× Home 569 + dashboard-metrics 422 + Today rewrites ~700 + smaller bits) |
| Lines added | — | ~2,600 | (Deal page chrome 470 + DealActionBanner 480 + roster 415 + today components 250 + admin unified 120 + 2 modals 385 + CSS ~700) |
| Net change | — | −1,200 lines | (less code, more capability) |
| Initial JS bundle | 283.00 KB / 80.00 KB gzip | 268.80 KB / 78.61 KB gzip | −14.20 KB / −1.39 KB |
| Surfaces a deal lives on | 5–7 (CampaignDetail + Today bucket + Inbox thread + Approvals card + Content tile + Earnings row) | **1** (`/deal/:id`) | — |
| Triage screens for admin | 3 separate paths | 1 unified `/admin/queue` | −2 |
| Sidebar entries (creator) | 9 | 8 | −1 |
| Sidebar entries (brand) | 9 | 7 | −2 |

The redesign treated the deal — the (campaign × creator) pair — as
the primary unit of UX. Everything follows from that:

- **One state machine** (Phase 24) replaces ad-hoc state checks
  scattered across screens.
- **One ranked queue** (Phase 26) replaces 6-bucket Today screens on
  both sides.
- **One canonical deal page** (Phase 25) absorbs CampaignDetail
  drawers, Approvals cards, Content tiles, Inbox threads, and
  Earnings rows for a given deal.
- **One brand campaign roster** (Phase 27) replaces 4-tab
  CampaignDetail with state-banded deal rows.
- **One admin queue** (Phase 28) replaces 3 sibling triage screens.
- **Dead screens deleted** (Phase 29).
- **Modals lifted in place** (Phase 30) so common flows don't
  navigate.

If the user is asking themselves "what does this deal need from me?"
they go to `/deal/:id`. If they're asking "what needs me right now?"
they go to Today. If a brand wants the bird's-eye view of one
campaign, they go to `/brand/campaigns/:id`. Three surfaces, three
clean questions, answered without ever asking "which tab?".

---

## ✅ Phase 31 — Tests + perf (shipped)

The redesign was structurally complete after Phase 30, but two real
production gaps remained: zero unit tests for the load-bearing pure
functions, and a `collectTodayDeals` hot path that took **3.6 seconds**
on 10,000 deals. Phase 31 closes both.

### A · Tests — vitest setup + 101 unit tests

Installed vitest (chosen over jest because it inherits the project's
existing `vite.config.ts` plugin + alias setup with zero extra config).
Added `vitest.config.ts` that pins `src/**/__tests__/**/*.test.ts` for
the test glob and `src/**/__bench__/**/*.bench.ts` for benchmarks.

```
npm run test         # one-shot
npm run test:watch   # watch mode
npm run bench        # vitest bench mode
```

Wrote 101 tests across 6 files covering the load-bearing pure
functions of the redesign:

```
src/lib/utils/__tests__/fixtures.ts            # shared minimal builders
src/lib/utils/__tests__/deal-id.test.ts         # 11 tests · encode/decode
src/lib/utils/__tests__/deal-state.test.ts      # 28 tests · 13 states + precedence
src/lib/utils/__tests__/deal-action.test.ts     # 24 tests · (state × role) → verb/kind/actor
src/lib/utils/__tests__/deal-ranking.test.ts    #  9 tests · actor split + sort
src/lib/utils/__tests__/today-deals.test.ts     # 11 tests · pair enumeration + ranking
src/lib/api/__tests__/use-deal.test.ts          # 18 tests · deriveDeal integration
                                                # ─────────
                                                # 101 tests, ~1s total runtime
```

Coverage philosophy:
- **Pure functions only.** No React component renders, no DOM, no
  store mocks. Every test is a unit input → output assertion.
- **Minimal fixtures.** A shared `fixtures.ts` exports `buildCampaign`,
  `buildCreator`, `buildOffer`, etc. — each takes a `Partial<T>` so
  tests name only the fields that matter.
- **Deterministic time.** Tests that exercise time-dependent urgency
  math pin `now: new Date('2026-04-15T12:00:00Z')`.
- **Real bug regression coverage.** Every Phase 24/25 QA fix has a
  test (counter+re-offer cycle keeps acceptedOffer separate, brand-
  team thread lookup walks all team userIds, disputed routes to
  actionable for non-admin, etc.).

### B · Perf — indexed db cache

The hot path was `collectTodayDeals`: it enumerates (campaign × creator)
pairs and calls `deriveDeal` for each. Each `deriveDeal` did its own
linear scans of `db.applications`, `db.offers`, `db.submissions`, etc.
That's O(pairs × artifacts), which compounds badly:

| db scale | Phase 30 baseline | Phase 31 after | Speedup |
|---|---:|---:|---:|
| 200 pairs (small brand) | 6.29 ms | 4.39 ms | 1.4× |
| 2,500 pairs (mid-size brand) | 200 ms | 49.7 ms | **4.0×** |
| 10,000 pairs (very large brand) | **3,665 ms** | **507 ms** | **7.2×** |
| Single deriveDeal call (10k) | 0.40 ms | 0.0012 ms | 333× (cache warm) |

The fix: a per-`Database` index built lazily on first read and cached
in a `WeakMap<Database, DbIndex>`. Zustand replaces the `db` reference
on every `tx()` mutation, so the WeakMap gives us "build once per
mutation, reuse for the rest of the render, GC when stale" for free.

```
src/lib/api/db-index.ts       # NEW · ~150 lines · indexed lookup cache
src/lib/api/use-deal.ts       # MOD · deriveDeal reads through getDbIndex(db)
```

The index buckets every artifact by the lookup key it'll be queried
by:

```typescript
interface DbIndex {
  campaignsById:        Map<string, Campaign>;
  creatorsById:         Map<string, Creator>;
  brandsById:           Map<string, Brand>;
  appsByPair:           Map<string, Application[]>;       // ${campaignId}|${creatorId}
  offersByPair:         Map<string, Offer[]>;
  submissionsByPair:    Map<string, Submission[]>;
  openDisputeByCampaign:Map<string, Dispute>;
  threadsByCampaign:    Map<string, Thread[]>;
  messagesByThread:     Map<string, Message[]>;           // pre-sorted by `at`
  txByCampaign:         Map<string, Transaction[]>;
  payoutsByPairUser:    Map<string, Transaction[]>;       // pre-filtered to cleared+positive
  brandTeamUserIds:     Map<string, Set<string>>;
  userIdByCreator:      Map<string, string>;
}
```

Total cost dropped from O(pairs × artifacts) to O(artifacts) once per
db snapshot, plus O(1) per pair lookup. Index build is a single linear
sweep of each db array — at 10k pairs the index for buildScaledDb(100,
100) builds in ~150ms; subsequent reads are essentially free.

`deriveDeal` API is unchanged. Same inputs, same `Deal` output, same
public signature. The 18 deriveDeal integration tests passed before
and after the optimization with no test changes — so we know the
behaviour is preserved.

### Bench scenarios

```
src/lib/utils/__bench__/today-deals.bench.ts
```

Three scenarios:

1. **Single `deriveDeal`** at small/medium/large scale — measures the
   per-pair cost (the deal page itself, the brand campaign roster
   building per-creator rows).
2. **Brand `collectTodayDeals`** at 200 / 2,500 / 10,000 pairs —
   measures the brand Today render.
3. **Creator `collectTodayDeals`** with 10 / 50 deals — creator scales
   are smaller in the wild.

Run with `npm run bench`. Bench file lives in `__bench__/` so the
regular `test` script doesn't pull benchmarks into normal runs.

### What this unlocks

A brand with 100 campaigns × 100 creators across them can now load
Today in ~500ms instead of ~3.6s. That's still not blazing fast (a
real production-grade view would target <100ms via virtualized lists
+ paginated db queries), but it's now in the "feels OK on first paint"
zone instead of "user thinks the page is broken." For typical brands
(under 1,000 deals total) the queue renders in under 50ms.

Single deal page loads (`/deal/:id`) are now O(1) lookups against the
warm cache — sub-millisecond after the first deriveDeal in a render.

### Phase 31 build size

```
index bundle:  268.80 KB / 78.61 KB gzip  →  270.30 KB / 79.15 KB gzip
                                              (+1.50 KB / +0.54 KB for db-index)
```

Tiny size cost, big runtime payoff.

### Phase 31 verification

- [x] `npm run test` — 101 / 101 passing in ~1.1s
- [x] `npm run build` — clean, 0 warnings, 0 errors
- [x] `npm run bench` — 7.2× speedup at 10k pairs, no regression at
      small scale
- [x] Existing useDealById hook and CampaignRoster + TodayQueue still
      pass their integration paths (manual verification — tests cover
      the shared deriveDeal interface)
- [x] WeakMap caching is invisible to callers — tx() mutations
      generate a fresh `db` ref, so the cache is naturally invalidated

### What's still open

A genuine production cutover would also want:

- React component tests via `@testing-library/react` for DealActionBanner,
  TodayQueue, CampaignRoster — verify the rendered DOM matches the
  state→action mapping. Out of scope here; pure functions are tested
  and components are thin.
- E2E tests via Playwright for the canonical journeys ("brand approves
  draft", "creator counter-offers", "admin resolves dispute"). Worth
  doing before any real backend integration.
- Virtualized list rendering on Today and the brand roster for 1,000+
  deal cases. The deriveDeal layer is now fast enough that the
  bottleneck would shift to React's reconciler — react-window or
  similar would handle that.
- Per-campaign txn slice in `deriveDeal` — currently we filter the
  campaign's whole txn bucket per (campaign, creator) pair when role
  ≠ admin. For a 10k-pair brand with avg 10 txns/campaign, that's
  100k filter ops per render. A second-tier index by
  `${campaignId}|${userId}|${counterpartyUserId}` would close that.

These are real-backend-cutover tasks, not prototype gaps. The deal-
page redesign with tests + perf is now production-shaped.

---

## ✅ Phase 32 — Landing page upgrade (shipped)

The Phase 18 landing page already had the foundations: persona toggle,
live ticker, animated counters, scrubbable deal demo, earnings
calculator, comparison strip. Phase 32 layered four
Upfluence-inspired patterns on top, plus motion-library polish on the
existing animations — all gated behind a `prefers-reduced-motion`
check so accessibility-first users don't feel stagger thrash.

The two competitor pages we drew from:

- `upfluence.com/upfluence-marketplace-creators` (creator-side)
- `upfluence.com/creator-marketplace` (brand-side)

Upfluence runs two separate pages. Alamut runs **one** page that
addresses both audiences via a persona toggle — and beats Upfluence
on the patterns the user is most likely to remember from each side.

### A · Motion library installed

```
npm install motion        # ^12.38.0 · the library formerly known as Framer Motion
```

Cover page lazy-loaded so the motion vendor chunk (60.84 KB gzip)
ships only when someone actually visits `/`. Signed-in users hitting
`/<role>/today` directly never download it. Initial bundle dropped
from 268.75 KB → **218.07 KB / 65.97 KB gzip** (−12.6 KB gzip from
the Cover split alone).

### B · Four new components

```
src/components/landing/FlywheelStats.tsx     # mirror-image marketplace stats (hero)
src/components/landing/ResultsGrid.tsx       # quantified case-study cards
src/components/landing/BrandCarousel.tsx     # auto-scroll brand wordmark strip
src/components/landing/TrustBadges.tsx       # G2-style credibility cluster
```

**FlywheelStats** — sits below the trust mini-row in the hero. Shows
TWO marketplace numbers side-by-side with an animated flywheel arrow
between them. Critically, the stats shown are **opposite-side**: a
creator visiting the page sees "X live briefs, $Y paid out", a brand
sees "Z verified creators, A.B M combined reach". The visitor's
biggest unanswered question — *is the other side really here?* — is
answered before they scroll.

**ResultsGrid** — quantified case-study cards in a new "The receipts"
section. Persona-aware: brands see ROAS / deals / revenue / lift
percentages with partner badges (Le Creuset · 9.9× ROAS, Aesop · 12
deals last quarter). Creators see earnings stories with platform
context (Sarah Chen · $12k last month, Maya Patel · 3 active retainers).
Each card stagger-fades in via motion's `useInView`; the big stat
itself uses a spring to settle into place.

**BrandCarousel** — replaces the static 10-cell brand wall with an
auto-scrolling infinite strip of 18 editorial-warm wordmarks
(Aesop / Le Creuset / Everlane / Peak Design / Leica / Muji / Hay /
Diptyque / Stüssy / Glossier / Aritzia, etc.). Pauses on hover via
motion's `useAnimationControls` `.stop()` / `.start()`. Edge-faded so
wordmarks soften in/out. Honors `prefers-reduced-motion`.

**TrustBadges** — small G2-style credibility cluster below the brand
carousel: Escrow.com, Stripe Connect, Wise, security audit, GDPR.
Defensible claims only — no overstated certifications.

### C · Motion polish on existing animations

- **Persona-toggle cross-fade.** Wrapped headline + lede in
  `AnimatePresence mode="wait"` + `motion.div` with `key={persona}`.
  Replaces the old `headlineKey` state hack with proper exit/enter
  choreography. `initial={false}` so the first paint isn't faded in
  (only the toggle action triggers the transition).
- **Three-bullet stagger reveal.** The "What you actually get" /
  "How it adds up" value props now stagger-fade in 80 ms apart as
  they enter the viewport via motion's `whileInView` + variants.
  Replaces a simultaneous appear with a more editorial reveal rhythm.

### D · Upfluence-pattern coverage map

What we stole from each Upfluence page:

| Pattern | Upfluence source | Alamut implementation |
|---|---|---|
| Big number hero stat | "$1B paid to creators" | FlywheelStats — but mirror-image, both numbers |
| Quantified case-study cards | "14× ROI · Valabasas" / "$1.4M sales · BeautyLab" | ResultsGrid — persona-aware, big stat → outcome → partner |
| 30-slide brand logo carousel | Auto-scroll, no nav | BrandCarousel — 18 wordmarks, paused on hover, edge-faded |
| G2 / award badge cluster | Bottom of each page | TrustBadges — defensible-only claims |
| Empathy-stinger copy ("ghosted, chasing late payments") | Creator page | Already present in Phase 18 hero copy ("don't need being overlooked, ghosted, or chasing late payments") |
| Persona-aware FAQ | Page-by-page in Upfluence | Already present in Phase 18 (FAQ filter by persona) |
| "Hands-on or Automated, you decide" reframe | Brand page | Comparison strip already does this work |
| Same-side voice testimonial | (Missing on Upfluence creator page!) | Already present in Phase 18 — testimonials filter by persona |

Three patterns we did NOT copy:

- Upfluence's static photo-free aesthetic (we kept Alamut's
  editorial-warm OKLCH palette + Fraunces serif)
- The dual-page navigation pattern (we use a persona toggle)
- The webinar pulse-bar at the top (it's marketing-y; would clash
  with our editorial tone)

### E · Phase 32 QA findings + fixes

Audit via parallel sub-agent. Three valid issues fixed:

- **HIGH · BrandCarousel pause-on-hover fragility.** The original
  implementation re-issued the transition with `duration: 999999` to
  halt the loop — undocumented, would visually stutter on rapid
  hover toggles. Replaced with `useAnimationControls()` + explicit
  `.stop()` / `.start()`. Clean hand-off, no stutter.
- **HIGH · Reduced-motion timing stack.** Motion 12 auto-respects
  `prefers-reduced-motion` for transition *durations*, but the
  delay chains (`index * 0.08`) still fire — producing a fast
  cascade of pop-ins instead of a single appear. Added explicit
  `useReducedMotion()` checks to ResultsGrid, the bullet-stagger
  variants, and the persona cross-fade — reduced-motion users now
  see all three of these as instant final-state appearances.
- **MEDIUM · TrustBadges SOC 2 overclaim.** Original copy claimed
  "SOC 2 Type I · Audited platform controls · 2026" — implies a
  certification we don't have. Reworded to "Security audit ·
  Independent review · annual cadence" — defensible.

Skipped:

- **MEDIUM · Persona-toggle debounce** (rapid toggle queues
  transitions). In practice users don't rapid-toggle; the cost of
  adding a debounce wasn't worth the rare edge case.

### Files added (Phase 32)

```
app/src/components/landing/FlywheelStats.tsx     # ~95 lines
app/src/components/landing/ResultsGrid.tsx       # ~135 lines
app/src/components/landing/BrandCarousel.tsx     # ~105 lines (after QA fix)
app/src/components/landing/TrustBadges.tsx       # ~30 lines
```

### Files modified (Phase 32)

```
app/src/screens/cover/Cover.tsx                  # AnimatePresence on hero, stagger
                                                 #   on bullets, integrated 4 new components
app/src/router.tsx                               # Cover lazy-loaded
app/src/styles/landing.css                       # +280 lines (.land-flywheel,
                                                 #   .land-results, .land-brand-carousel,
                                                 #   .land-trust-badges)
app/package.json                                 # motion ^12.38.0
PROGRESS.md                                      # this section + tracker
```

### Phase 32 build size

```
index (initial bundle):  268.75 KB / 78.59 KB gzip  →  218.07 KB / 65.97 KB gzip   (−12.6 KB)
Cover (lazy chunk):                              —  →   58.89 KB / 15.84 KB gzip   (new)
vendor-…js (motion):                             —  →  182.14 KB / 60.84 KB gzip   (new, lazy)
```

Net effect: signed-in users get a **smaller** initial bundle (Cover
was previously bundled with everything else). Public-landing visitors
download Cover + motion together as a single second-tier fetch.

### Phase 32 verification

- [x] `npm run build` — clean, 0 warnings, 0 errors
- [x] `npm run test` — 101 / 101 still passing
- [x] Persona toggle cross-fades headline + lede smoothly; reduced-
      motion users see instant swap with no fade
- [x] Hero shows FlywheelStats with mirror-image numbers + animated
      arrow; collapses to single column on mobile (arrow rotates 90°)
- [x] BrandCarousel auto-scrolls; pauses cleanly on hover; honors
      reduced-motion
- [x] ResultsGrid stagger-fades cards into view, persona-aware
- [x] TrustBadges render with no overstated certifications
- [x] Cover lazy-loaded — confirmed via build chunk inspection

### What this unlocks

A landing page that:

1. Answers "is the other side really here?" within 5 seconds via
   FlywheelStats (the hardest objection to clear in a two-sided
   marketplace)
2. Shows real receipts (ResultsGrid) instead of just claiming
   outcomes — borrowed from the strongest pattern on Upfluence's
   brand page
3. Reads as legitimate at a glance (logo carousel + trust badges
   together do the work that a 30-slide carousel does on Upfluence)
4. Keeps Alamut's editorial-warm voice — Fraunces serif headlines,
   OKLCH atmospheric mesh, italicized brand wordmarks — instead of
   defaulting to the Upfluence safe-corporate aesthetic
5. Beats Upfluence on UX with a persona toggle that swaps just
   the deltas (hero stats / value props / testimonials / FAQ /
   case studies) while keeping the chrome stable

### Skill provenance

Phase 32 used both newly-installed skills:

- **`motion`** (npm) — directly. Drives the persona cross-fade,
  bullet stagger, brand carousel, results grid spring, flywheel
  arrow pulse.
- **`huashu-design`** (Claude Code skill) — its principles informed
  the design direction (junior-designer workflow, anti-AI-slop
  checklist, editorial typography hierarchy). Not directly invoked
  in this phase since it's targeted at HTML hi-fi prototyping, not
  React production-app polish — but its design philosophy shaped
  the choices.

---

## ✅ Phases 33–40 — Cinematic landing rebuild (shipped)

After Phase 32's incremental landing improvements, we faced an honest
problem: the page still felt like a generic SaaS landing page with
nice typography. The user pushed for a **complete rethink** —
"doesn't look like a generic AI made landing page... every word and
number on the landing page needs to serve a purpose." Phases 33-40
delivered that rethink as a single cinematic scroll narrative, where
the page IS a four-act tour through the four real problems Alamut
solves.

### The pivotal critique (Phase 35 mid-flight)

After the first pass at the four acts, the user flagged that three of
four were about money. **Payments aren't the story** — they're table
stakes inside trust. The real story:

1. **Discovery** — finding the few who fit out of millions
2. **Workflow** — running campaigns end-to-end in one tab
3. **Multi-platform** — managing creator life across IG/TikTok/YT/Substack/X
4. **Receipts** — measurement, reputation, payment as proof

Every act was rebuilt around those four problems. Real seed data was
audited so every number on the page traces back to the platform —
no inflation, no vanity stats. Phase 32 had already added Upfluence-
inspired patterns; the rebuild kept what worked there and rebuilt
the rest.

### What shipped

```
landing-prototype/                              # Phase 33 — visual lock
  ├ 01-hero-offer-arrives.html
  ├ 02-act-money-flow.html
  └ README.md

app/src/styles/cinematic.css                    # ~2,000 lines — cinematic palette,
                                                #   scene primitives, atmosphere,
                                                #   per-act styles, mobile bypass

app/src/screens/cover/Cover.tsx                 # Lazy-loaded landing page (Phase 32)
app/src/screens/cover/scenes/                   # 11 components
  ├ PersonaPalette.tsx                          # Phase 34: data-persona cascade
  ├ AtmosphericBackdrop.tsx                     # Phase 34: two-source radial light
  ├ DriftMotes.tsx                              # Phase 34: canvas particle layer
  ├ CinematicScene.tsx                          # Phase 34: scroll-pin engine
  ├ CinematicPersonaToggle.tsx                  # Phase 34: top-center glass toggle
  ├ TopNav.tsx                                  # Phase 34: magazine masthead
  ├ HeroScene.tsx                               # Phase 35b: real-seed stat strip
  ├ ActDiscovery.tsx                            # Phase 35c: constellation narrowing
  ├ ActWorkflow.tsx                             # Phase 36a: 7-stage timeline rail
  ├ ActMultiplatform.tsx                        # Phase 36b: tiles → traces → dashboard
  ├ ActReceipts.tsx                             # Phase 37a: ROAS/rating/money panels
  └ Coda.tsx                                    # Phase 37b: voices/brand/FAQ/CTA
```

### What was deleted (Phase 40 cleanup)

```
app/src/screens/cover/CoverLegacy.tsx           # the Phase 18 + Phase 32 landing
app/src/components/landing/*.tsx                # 15 Phase-18 components (all orphan)
app/src/screens/cover/scenes/ActPlaceholder.tsx # phase-34 scaffold, retired
```

### Real-seed numbers surfaced on the live page

Every number below is read from `useStore(s => s.db)` at render time —
no constants, no inflation:

| Surface | Number | Source |
|---|---|---|
| Hero · Verified brands | 79 | `db.brands.filter(b => b.verified).length` |
| Hero · Live briefs | 65 | `db.campaigns.filter(c => c.stage in ('live','shortlist')).length` |
| Hero · Paid to creators | $373,715 | sum of `kind=payout, status=cleared, amount > 0` transactions |
| Hero · Avg rating | 4.4★ | mean of `db.creators[].rating` |
| Hero · Total creators (brand persona) | 110+ | `db.creators.length` |
| Hero · Multi-platform creators (brand) | 81 | creators with ≥2 platforms |
| Hero · Platforms | 5 | distinct platform names across all creators (capped to top 5) |
| Act I · Items in haystack | 18 | first 18 from `db.campaigns` (creator) or `db.creators` (brand) |
| Act I · Fits in cluster | 5 | filtered by editorsPick / Flagship / verified, capped 5 |
| Act II · Running example | Aesop · Spring Renewal | seed cmp_1 demo or first closed campaign with tracking |
| Act II · Stage data | dynamic | per-stage real values: applicant count, shortlist count, offer rate, accepted creator name + reach, draft round count |
| Act III · Per-platform creators | 27–56 each | per `c.platforms[].name` filter |
| Act III · Top creator per platform | live | highest follower count on each platform |
| Act III · Combined reach | 28.0M | sum of every creator's `platforms[].followers` |
| Act IV · Median ROAS | 16.1× | median across closed-campaign-with-tracking, capped 25× per outlier |
| Act IV · Total revenue attributed | $27.5M | sum of `tracking[].revenueAttributed` |
| Act IV · Total reviews | 150+ | `db.reviews.length` |
| Act IV · Median time to payout | 8 days | median(payout.at − offer.respondedAt) across cleared payouts |
| Coda · Voices | Sarah Johnson, Amir Hussain, Yuki Tanaka | demo seed creators by name lookup |
| Coda · Brand strip | 18 verified brands | first 18 from `db.brands.filter(b => b.verified)` |

### Phase-by-phase summary

**Phase 33 · Direction lock.** Two single-file HTML hi-fi prototypes
demonstrating the cinematic feel — atmospheric backdrop, Fraunces
italic at clamp(56px, 9.5vw, 168px), drifting motes, scroll-driven
money particles. User signed off on the direction.

**Phase 34 · Foundation.** Built the cinematic palette as CSS custom
properties driven by `[data-persona]` cascade. Built
`<AtmosphericBackdrop>` (two radial gradients tracking persona),
`<DriftMotes>` (canvas particle layer), `<CinematicScene>`
(motion's `useScroll` + sticky-pin), `<CinematicPersonaToggle>`,
`<TopNav>`, `<PersonaPalette>` wrapper. Discovered the existing
`usePersona` hook had separate state per consumer — refactored to a
`useSyncExternalStore` singleton so every hook call shares one
source of truth (was a real bug, not just landing-page).

**Phase 35 · Hero + Act I.** Hero with real-seed stat strip, four-act
TOC tease, persona-aware headline word-stagger. Act I (Discovery)
constellation: 18 real seed items scattered randomly, narrowing on
scroll to 5 fits with detail captions. Caught the
"`item.isFit` flagged ~85% of items" bug and tightened to the
authoritative 5-cap via `fitOrder` Map.

**Phase 36 · Acts II + III.** Act II (Workflow) horizontal rail with
7 stage nodes; a playhead glides as you scroll, the closest stage's
detail card surfaces with real data from one running example deal
(Aesop / Sarah Chen / $1,500 lifecycle). Act III (Multi-platform)
five tiles fanning across the top, SVG traces drawing toward a
center-bottom dashboard, all backed by per-platform creator counts
+ top creator + combined reach.

**Phase 37 · Act IV + Coda.** Three-panel receipts dashboard
(Performance / Reputation / Money) with stagger-in + spring on the
big numbers. Caught the seed-outlier ROAS of 365× and switched to
median (capped at 25× per outlier) for credibility. Coda with
voices (resolved by name to seed creators), auto-scroll brand strip,
collapsible FAQ, persona-aware final CTA.

**Phase 38 · Atmosphere & polish.** Cinematic-tinted ::selection,
accent focus rings, smooth scroll for TOC anchors, dark scrollbar,
gentle scroll-snap proximity (desktop only), Hero TOC links with
sweep underline on hover, accent-glow ring on the final CTA hover,
press feedback on persona toggle. Cross-act handoff hairlines.

**Phase 39 · Performance + mobile + reduced-motion.**
- `<CinematicScene>` detects `<= 720px` viewport OR
  `prefers-reduced-motion: reduce` and bypasses scroll-pinning,
  rendering each act inline at `STATIC_PROGRESS = 0.85` (visual peak,
  not the tail-fade end).
- `DriftMotes` caps DPR at 1.5 on mobile (vs 2 on desktop), reduces
  particle target from 60 → 24 max on small viewports.
- Comprehensive reduced-motion guards added to HeroScene
  (word-stagger, stat-strip stagger, TOC fade) + Coda (voice
  cards, FAQ items) + ActDiscovery (already in Phase 32 polish).
- Per-act mobile column-stack rules for Act III's platforms +
  dashboard. Scroll-snap disabled below 720px.

**Phase 40 · Final QA + cleanup.**
- Deleted `CoverLegacy.tsx` and 15 Phase-18 landing components
  (all orphan after the cinematic Cover took over).
- 101/101 tests still passing.
- Build clean: 218.10 KB / 65.99 KB gzip initial bundle.
- Cover lazy chunk: 41.87 KB / 12.94 KB gzip — only loads when
  someone visits `/`.

### Build size after the rebuild

```
index (initial):     218.10 KB / 65.99 KB gzip   (vs 218.07 KB after Phase 32 — unchanged)
Cover (lazy chunk):   41.87 KB / 12.94 KB gzip   (vs 58.59 KB after Phase 32 — −16.7 KB)
motion vendor:       185.19 KB / 61.85 KB gzip   (lazy; ships with Cover only)
```

The cinematic landing is *smaller* than the Phase 32 landing (16.7
KB less in the Cover chunk) because it deleted ~3,000 lines of
legacy components. Initial bundle is unchanged because Cover is
lazy-loaded; signed-in users never download it.

### What this earns

The page now answers, in scroll order, the four questions both
audiences actually ask before signing up:

1. *Who are these people, and is the other side actually here?* → Hero stat strip + Discovery constellation.
2. *How does the work actually flow once I'm in?* → Workflow rail with one running example.
3. *Will it cover the platforms I care about?* → Multi-platform dashboard.
4. *What's the proof?* → Receipts dashboard.

Every visual element traces to a real seed value. Every act
visualises a problem we explicitly solve. The cinematic atmosphere
+ Fraunces italic + persona-morph palette belong only to Alamut —
nothing in the creator-marketplace category looks like this.

The huashu-design skill informed the editorial / scroll-narrative
voice (Locomotive #05 stream + Pentagram #01 typography). The
motion library powered every scroll-driven choreography. The
ui-ux-pro-max search confirmed "Exaggerated Minimalism" as the
right pattern for editorial / luxury landing pages and shaped the
typographic restraint.

---

## Final summary — what was built

Seventeen phases. A paper-flat marketplace prototype reborn into a
shippable demo with parity across creator, brand, and admin roles.

**By the numbers**
- Initial JS: **242 KB / 68 KB gzipped** (was 872 KB / 238 KB pre-Phase
  14 vendor split + lazy routes — ~71% reduction in initial download)
- Total CSS: 187 KB / 28 KB gzipped
- 17 lazy-loaded route chunks, each 3–12 KB gzipped
- 4 vendor chunks (react / router / state / general) for cache stability

**Visual language**
- Atmospheric body canvas with three OKLCH radial-gradient blobs
- Universal `.tile` pattern with cursor-aware halos via delegated
  `pointermove`
- Per-section ambient hue via `data-section` on the shell
- Chromatic stage palette (8 OKLCH hues for the campaign lifecycle)
- Glass effects reserved for floating chrome only (sticky headers,
  modals, drawers, search)

**Surface-by-surface coverage**

| Role     | Today (triage) | Home (overview) | Campaigns list  | Campaign detail | Discover | Money screen   | Profile |
| -------- | -------------- | --------------- | --------------- | --------------- | -------- | -------------- | ------- |
| Creator  | ✓ Phase 4      | ✓ Phase 7       | ✓ Phase 5 link-out | ✓ Phase 5 (full-page) | ✓ Phase 9 | ✓ Phase 10 (Earnings) | ✓ Phase 12 hero polish |
| Brand    | ✓ Phase 4      | ✓ Phase 7       | ✓ Phase 3 (4-view + bulk + saved) | ✓ Phase 2 (full-page + AI rank) | ✓ Phase 9 | ✓ Phase 10 (Wallet) | ✓ Phase 12 hero polish |
| Admin    | —              | ✓ Phase 8 (console) | ✓ Phase 8 (5 queue screens) | —          | —        | ✓ Phase 8 (payouts) | —     |

Plus public surfaces (Phase 6: Cover, PublicCreator, SignIn, SignUp),
action surfaces (Phase 11: Inbox, Approvals, Content), Analytics
(Phase 12), Notifications + Onboarding (Phase 15), accessibility +
keyboard fallback (Phase 16), AI-assist (Phase 17).

**Workflow features**
- Drag-and-drop kanban with keyboard "Move to…" fallback
- Multi-select bulk actions (export · clone · close) with sticky bar
- Saved views (named filter combos persisted per brand)
- 4-view toggle on the campaign list (List / Board / Timeline / Calendar)
- Filter chips with URL sync across Campaigns / Discover / Approvals /
  Content / Inbox

**AI helpers** (transparent, mocked)
- Applicant ranking with reasoning chips + concern flags
- Pricing suggestion when sending offers, confidence-flagged
- Long-thread TL;DR with highlights + next-action

---

## Open follow-ups (truly optional)

The platform is shippable as-is. These remain as ideas only:

- **Demo data refresh** — current seed has ~25 creators, ~15
  campaigns. Could expand to 50/30 for richer rails. Mostly cosmetic.
- **Playwright smoke tests** — would set up E2E for the auth →
  workspace → "send offer" → "approve draft" happy path. Worthwhile
  if this becomes a real product, scope is non-trivial.
- **Real backend swap** — `lib/api/client.ts` is signature-stable;
  swapping the mock for real fetch calls is a single-file refactor.
  Schema-wise: `Database` types in `lib/api/types.ts` are already
  written like a backend response shape.
- **Localization** — currency / date / number formatting already use
  `Intl.*`. Wrapping copy in an `i18n.t(...)` would be straightforward
  but mostly redundant work for a single-locale demo.
- **Real LLM behind the AI helpers** — Phase 17's `ai-helpers.ts`
  has a clean signature; swap the body of `rankApplicants` /
  `suggestRate` / `summarizeThread` for an API call without touching
  any caller. The reasoning chips already match what an LLM would
  return as structured output.
- **Store schema migration** — `version: 11` in `store.ts` has no
  `migrate` function, so older cached states get wiped on bump. Fine
  for demo; real product would migrate.
- **Focus trap on `CreatorProfileDrawer`** — Phase 17.5 added Escape
  + role="dialog" but Tab can still escape the drawer. Modal already
  has the trap; could be extracted into a shared hook.

### Already shipped — items that were on the roadmap and are now done

- ~~Kanban drag-and-drop~~ — shipped Phase 13, with keyboard "Move to…"
  fallback in Phase 16
- ~~Bulk actions in the list view~~ — shipped Phase 13 (export · clone · close)
- ~~Saved views~~ — shipped Phase 13 (named filter combos persisted per brand)
- ~~Admin surface polish~~ — shipped Phase 8 (5 queue screens + new console)
- ~~AI assist~~ — shipped Phase 17 (applicant ranker, pricing suggestion,
  inbox TL;DR)
- ~~Vendor chunking + lazy routes~~ — shipped Phase 14 (43% reduction
  in initial gzipped JS)
- ~~Onboarding tour polish~~ — shipped Phase 15 (chromatic per-step
  visuals, sliding-dot indicators)
- ~~Notifications bell rework~~ — shipped Phase 15 (kind grouping,
  filter chips, time-bucketed sections)
- ~~Mobile responsiveness audit~~ — shipped Phase 14 (all new surfaces
  collapse cleanly at ≤700/800/1100px breakpoints)
- ~~Accessibility audit~~ — shipped Phase 16 + Phase 17.5 (skip link,
  keyboard kanban, Modal/Drawer dialog semantics + focus trap)
- ~~Dark-mode polish~~ — shipped Phase 16 (verified zero hardcoded
  colors; OKLCH tokens cascade correctly)
