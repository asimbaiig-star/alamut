# Alamut — Product Brief

A complete, designer-ready document covering what Alamut **is** and what
it **does** — feature by feature, surface by surface — for use as
source material when building presentation decks, marketing pages, or
internal walkthroughs. Pulled directly from the live codebase, the
workspace surfaces, the data model, and every workflow that exists in
the product today.

> **How to use this**: Read top to bottom for a complete picture, or
> jump to a section. Every major capability has its own subsection
> with the actions, screens, and data it touches. The deck-flow guide
> at the bottom is a suggested narrative; the body of the document is
> reference material the designer can mine for slide content.

---

## 1. What Alamut is

Alamut is a **two-sided creator-economy operating system** that
combines a marketplace, a CRM, an AI campaign planner, a content
workflow, an escrow-funded payments rail, and a public storefront
network into a single product. Brands and creators both work inside
their own workspace — the same deal lives in both, synchronized in
real time, with the platform handling discovery, contracting,
collaboration, content review, payments, taxes, and dispute
resolution end to end.

A brand can land in the product, describe a campaign to an AI
assistant in plain English, get a vetted creator shortlist with rate +
audience projections, fund a budget into escrow, push outreach,
manage offers and counter-offers in a kanban pipeline, review content
in-browser (with AI pre-checks), confirm content is live, and have
escrow auto-release to the creator — all without leaving the
workspace or sending a single email.

A creator can land in the product, build a public storefront with
their channels, rates, past work, and audience snapshot, browse a
brief marketplace with match scoring, apply with a pitch + rate,
negotiate via inbox, upload drafts for review, mark content live,
get paid the same day, withdraw to their bank, and have closed deals
auto-published as receipts on their storefront — building a public
track record with every deal.

The product is built around the insight that **brand-creator deals
have been an unmanaged, unstructured, untooled workflow** running on
DMs, Google Docs, PDF contracts, and net-60 invoices. Alamut gives
both sides a single source of truth, automates the parts that don't
need a human, and surfaces the parts that do as clear actions.

---

## 2. The two workspaces

The product is structured as two **paired workspaces** sharing a
single contracting layer. The same deal appears in both, scoped to
each side's job-to-be-done.

### 2.1 The brand workspace — left nav, in order

- **Home** — triage queue: what needs your decision right now
- **Spark** — conversational AI campaign planner
- **Discover creators** — search + filter the creator catalog
- **My campaigns** — every campaign you've run, grouped by status
- **Inbox** — 3-pane CRM-style messaging with workflow context
- **Calendar** — every deadline across every active deal
- **Analytics** — performance, audience, ROI across all campaigns
- **Wallet** — escrow balance, ledger, top-ups, tax exports
- **Brand profile** — your verified company page

### 2.2 The creator workspace — left nav, in order

- **Home** — earnings-first dashboard with today's actions
- **My storefront** — the editable public page brands see
- **My collaborations** — every deal, grouped by stage
- **Browse campaigns** — marketplace of open briefs with match scoring
- **Inbox** — mirror of brand-side, persona-aware
- **Calendar** — every deliverable due date
- **Analytics** — reach, engagement, deal close rate, earnings
- **Wallet** — withdrawals, advances, tax docs
- **KYC & Tax** — verification + tax-form collection

### 2.3 Shared chrome

Both workspaces share the same shell with: notifications bell (popup
with quick-action buttons), theme toggle (light / dark), density
toggle, ⌘K command palette (global search), persona switcher, sign-
out, hotkey help, onboarding tour, onboarding checklist, user portrait
+ name footer.

### 2.4 Admin / operator workspace

A third surface for the operations team: console dashboard, unified
queue (applications + verifications + disputes), payout ops, audit log
viewer, dispute mediation, brand + KYC verification, reports.

---

## 3. Brand workspace — capability-by-capability

### 3.1 Home — the "what needs me" triage dashboard

Source: `BrandHome.tsx` (1,041 lines).

A workspace landing page designed around the single question: "what
should I do next?" Built from real store state, not mockups.

**Sections, top to bottom:**

- **Topbar** — "Welcome back, {first name}" with greeting + crumb
  "{N} things need you · {M} live". Primary CTA: "+ New campaign"
- **Spark composer (hero card)** — dark gradient card with prompt
  textarea ("Describe what you want — Spark plans the campaign,
  drafts outreach, runs escrow") + 3 suggestion chips ("Find me 5
  LinkedIn creators in HR for $10K" / "Plan an Eid Reel campaign
  with Karachi mommy creators" / "Who outperformed expectations
  last campaign?") + "Attach brief" link
- **Action inbox ("Needs you")** — scrollable, deep-linked queue of
  every pending decision. Priority order: (a) live-URL submissions
  awaiting verify-and-confirm, (b) creator counter-offers awaiting
  response, (c) content in review, (d) new applicant pitches, (e)
  wallet low-balance warnings. Each row deep-links to the right
  modal on the right surface (e.g., clicking a content-review row
  jumps to `campaign:<id>?tab=content&review=<collabId>` which
  opens the review modal directly)
- **Recent activity feed** — last 6 cross-campaign events with
  color-coded icons (payout = moss wallet, live/posted = accent
  spark, approved = moss check, counter-offer = gold arrow, etc.)
  and routes to the relevant campaign
- **Pacing strip ("Quarter pacing")** — wallet available + in
  escrow + Q2 budget spent / budget % + avg cost per engagement +
  avg ER, plus horizontal progress bar with "today" marker
- **This week's wins** — three outcome cards: top performer (highest
  reach), breakout (second-highest score, "↑ Re-hire?"), engagement
  leader (highest avg ER)
- **Creator of the week** — dark banner with Spark's
  "you'd hit it off with..." pick, including audience-overlap +
  reply-time + history rationale, and View profile / Send brief CTAs
- **Cultural calendar** — Pakistan retail-event countdown: Eid,
  Independence Day, Black Friday PK, Quaid Day · Christmas, each
  with a "Plan →" CTA to a new campaign pre-seeded for that event
- **Active campaigns rail** — the two most recent live campaigns
  with brand label, name, progress bar, spent / budget tabular,
  confirmed-creators + live-placements counters

### 3.2 Spark — AI campaign planner

Source: `Spark.tsx` (1,154 lines) + `sparkEngine.ts` (619 lines).

A conversational two-pane workspace: chat thread on the left,
shortlist canvas on the right. Brands describe a campaign in plain
English; Spark plans it turn by turn and the brand can lock in the
result as a real campaign.

**Topbar:**

- **Saved drafts dropdown** — every Spark conversation auto-saves
  every 1.5s with name + last-edited timestamp; reload with one click
- Auto-save status pill ("Saving…" / "Saved · just now")
- **Save draft / Update draft** + **New plan** + **Lock in campaign**
  (disabled until shortlist has creators; converts to a real campaign)

**Chat thread:**

- Welcome message: "Hi — I'm Spark. Tell me what you want to ship
  and I'll draft the creator list, project the numbers, and prep
  briefs you can send."
- Starter suggestions: "Plan an Eid campaign for Sapphire" / "Find
  Karachi food creators under $500" / "B2B LinkedIn voices in
  Pakistan" / "How does Spark work?"
- Composer with quick-chip suggestions above (from last reply)

**Intent detection (regex-based, supplements remote LLM):**

- Detects plan / find / compare / project / send / save / clear / help
- Extracts: category (Fashion / Beauty / Food / Tech / Travel / Fitness /
  Parenting / Finance / B2B / Lifestyle from keyword map), city
  (Lahore / Karachi / Islamabad / Rawalpindi), budget ($5K / $5,000 /
  5K parsing), creator tier (nano / micro / mid / macro)

**Reply blocks Spark can render:**

- **Text** — body bubble
- **Creator cards** — grid of cards with avatar, name + verified,
  handle, city, Alamut score badge, top 2 channels with follower
  counts, rate in accent color, "Profile" / "Save" actions per card,
  "Save all to shortlist" header button, plus a rationale callout
  ("Why these creators")
- **Comparison table** — side-by-side comparison: score, city,
  categories, followers, avg engagement, top audience demographics,
  going rate, past brands. Save all / Pick {first name} actions
- **Projection** — KPI strip: budget, projected reach (~85% delivery
  factor), avg engagement %, placements (assumes 1 Reel + Stories
  bundle each), CPM. Plus per-creator contribution stack with
  progress bars
- **Brief draft** — to/from header (creator avatar, "To: {name}",
  "From: {brand} · Rate: $X"), editable textarea (Edit / Save /
  Cancel), Send-through-Inbox footer button
- **Shortlist snapshot** — stack of creator rows with avatar, name,
  rate

**Shortlist canvas (right):**

- Eyebrow "Shortlist"
- Empty state: "Save creators here as Spark suggests them. Build up a
  campaign plan turn by turn."
- Loaded: 2×2 KPI grid (saved, total cost, combined reach, avg ER);
  per-creator rows with avatar, name, rate, × to remove; "Project
  this plan" CTA
- The shortlist persists across reloads and syncs with the brand's
  `savedCreators[]` list, so it appears in Discover too

**Remote LLM integration:**

- Edge Function `spark-chat` proxies to Claude when configured
- Scripted reply races against the remote — only the text body is
  substituted if remote returns within delay (~600-1100ms); non-text
  blocks (creator cards, brief drafts) stay scripted for reliability

### 3.3 Spark touchpoints across the rest of the workspace

Spark isn't just one screen — it surfaces contextually throughout:

- **Discover Spark toggle** — flips the search bar to a plain-English
  mode with "Describe who you're looking for in plain English…"
  placeholder
- **Campaign settings auto-shortlist toggle** — "Let Spark auto-
  shortlist applicants" automatically promotes strong matches to
  Pitched stage
- **Storefront pulse Spark suggestion** — surfaces tips like "Add a
  'case study' block — creators with case studies get 2.4× more
  inquiries"
- **Brief detail Spark-flagged clauses** — Exclusivity / Usage /
  Disclosure clauses are auto-flagged for creator review
- **Content upload Spark pre-flight checks** — ratio detection
  (9:16 Reel-ready ✓), campaign hashtag presence, #ad disclosure
  (FTC + Pakistan PCA compliance)
- **Content review Spark auto-check** — 5 automated checks: product
  visible in first 3s, brand hashtag in caption, brand handle
  tagged, #ad disclosure present, caption length recommendation
- **Best-performing format callout** — analytics surface auto-
  generates insights like "Reels with daily-life framing · 2.8×
  higher save rate than studio-styled posts. Spark recommends
  shifting next campaign's mix toward Reels"
- **New campaign wizard** — Spark suggests "Start with 6-8 creators
  across price tiers. We'll auto-shortlist new applicants as they
  apply."

Plus three standalone AI modals:

- **AI Brief Assistant** — generates structured brief from plain-
  English prompt (categories, regions, budgets, deliverables, title,
  pitch, brief copy)
- **AI Content Suggestions** — 4 content hooks per category with
  format, angle, outline, why-it-works, estimated reach + engagement
- **AI Match** — concierge match by keyword overlap with creator
  categories, tagline, bio + tier weighting + region detection

### 3.4 Discover creators — the brand-side CRM search

Source: `Discover.tsx` (1,182 lines).

A search-driven CRM-style creator catalog with multi-faceted filtering,
saved lists, and per-creator action buttons.

**Unified search bar with Spark mode toggle:**

- Default mode: name / niche / keyword text search
- Spark mode: plain-English search ("Find me 5 lifestyle creators in
  Lahore with mostly female audience")
- Three Spark-mode example prompts available when toggled on

**Primary filter chips (multi-select dropdowns):**

- **Platform** — Instagram / TikTok / YouTube / LinkedIn / Newsletter
- **Followers** — Nano (<10K) / Micro (10-100K) / Mid (100-500K) /
  Macro (500K+)
- **Category** — 11 options: Fashion / Lifestyle / Beauty / Food /
  Travel / Tech / Fitness / Finance / B2B / Parenting / Wellness
- **City** — Karachi / Lahore / Islamabad / Rawalpindi / Faisalabad
- **+ More** toggle for advanced filters

**Advanced filters (expanded via + More):**

- **Age band** — Gen Z 18-24 / Millennial 25-34 / Gen X 35-44
- **Gender skew** — Any / Mostly female (60%+) / Mostly male (60%+)
- **Minimum engagement rate** — slider 0-10%, step 0.5
- **Maximum rate** — slider $500-$1,000,000, step $500
- **Verified only** toggle
- **Brand-safe** toggle

**Sort dropdown:** Alamut score / Followers / Engagement / Price low→high
/ Price high→low

**Active filter chips bar** with × clear per filter + "Clear all"

**Result grid (3-column creator cards):**

- Cover band with vacation pill (when applicable)
- Avatar with Alamut score badge top-right
- Name + verified glyph, @handle · city
- Top 3 channel icons with follower counts + dominant ER%
- Audience one-liner: "{female}% female · {age2534}% 25-34 ·
  {topCity}" + slim gender-split bar
- Past brands line ("Worked with {first 2}, +N")
- Footer: total reach + "From $X" price (in accent color)
- Click anywhere → opens full creator profile

### 3.5 Creator profile (brand-viewing)

Source: `CreatorProfile.tsx` (419 lines).

Read-only mirror of the public storefront with brand-only signals + CTAs.

**Topbar actions:**

- Back to Discover
- **Save to shortlist** (toggles persistence)
- **Send brief** → routes to Spark with creator pre-shortlisted

**Hero:** Cover banner + xl avatar + name + verified glyph + Alamut
score + handle / city / tier + bio + category pills. KPI strip with:
total reach (across channels), avg engagement (last 30 days),
**response time** (computed real — walks every thread the creator
participates in and averages reply gap), going rate (per Reel +
Stories), past brands count (with first 2 names).

**Channels section** — list with platform icon, name, handle,
followers, ER%.

**Audience snapshot** — Female / Male / 25-34 / 18-24 bars + Top city.

**Packages & rates** — 4 package cards: Instagram Reel, Story bundle ×3,
Reel+Stories combo (badged "Most booked"), Long-form review.

**Track record:**

- "Working with right now" — active collabs with status pill
- "Past brands" — wordmark wall
- "Recent completed projects" — 3 cards with brand + name + placement
  + paid amount

**Sticky bottom action band:** "Ready to work with {first name}?
Spark drafts the brief for you and routes it through Inbox. {first
name} typically replies within 3 hours." + Open inbox / Draft a brief
with Spark.

### 3.6 My campaigns — the campaign list

Source: `Campaigns.tsx` (355 lines).

Stage-grouped list of every campaign the brand has ever run.

**Topbar:** "{N} total · {M} live · {P} paused" + "+ New campaign"

**Summary band:** total budget, spent (with deployment %), active
creators ("14 across 4 campaigns"), + "View ledger →" link to wallet

**Stage filter chips:** All stages · {N} + Live · {n} + Paused · {n} +
Draft · {n} + Closed · {n}

**Stage-grouped sections** — Live → Paused → Draft → Closed, newest
first. Live and Paused get expanded rows (status pill, brand, name,
brief preview, progress bar, KV stats: Spent / Confirmed creators /
Live placements / Deadline, plus avatar stack). Draft and Closed get
compact rows.

### 3.7 New campaign wizard — the 5-step campaign launcher

Source: `NewCampaignWizard.tsx` (797 lines).

A guided wizard with a sticky live-preview sidebar that updates as
you fill the form.

**Steps:**

1. **Brief** — Campaign name (e.g., "Eid Edit '26 — Sapphire") +
   objective cards (Awareness / Conversion / Brand affinity) + brief
   & creative direction textarea + **placements editor**: multi-row
   editor with count (1-10) × platform select (Instagram / TikTok /
   YouTube / LinkedIn / X / Substack) × format select (per-platform
   options: reel / story / carousel / post / video / live / longform
   / short / article / newsletter / thread). Each row removable;
   "+ Add placement"
2. **Audience** — Cities multi-select (7 cities); Gender segmented
   (Any / Female-leaning / Male-leaning); Age groups multi (4
   bands); Creator categories multi (11 options)
3. **Budget & timeline** — Total budget with quick buttons ($5K /
   $10K / $20K / $50K); Target per-creator price (with "≈ N
   creators at this rate" hint); Deadline date. Estimated breakdown
   shows: creator payouts (gross 87%), platform fee 10% (=8.7%),
   withholding tax 5% (=4.4%), total reserved from wallet
4. **Invite creators** — Spark suggestion banner + recommended
   creators (filtered by category overlap, top 12) with toggle pills
   to add; "Browse all creators" CTA → Discover
5. **Review & launch** — KV summary of every step + invited creator
   stack + final "{Spark icon} Launch campaign" button which
   materializes deliverable slots from the placement string

**Live preview sidebar** — sticky panel showing name, brand,
objective, placements, cities, categories, budget, per-creator,
deadline, invited count, wallet balance after launch.

### 3.8 Campaign detail — the campaign management cockpit

Source: `CampaignDetail.tsx` (2,646 lines — the largest screen in
the product, by design).

The brand owner's command center for a single campaign. Five tabs:
Pipeline, Brief, Content review, Analytics, Settings.

**Topbar lifecycle actions:** Pause (when live) / Resume (when paused)
/ Publish (when draft) / End (with confirm "End campaign and refund
unused escrow?") / "+ Add creators"

**Cockpit hero (top-left):**

- Status pill + placement type + display-serif name + brand + "N
  days left · Deadline {Mon DD}" + budget / spend tabular
- **Pacing bar** — spend fill, time-elapsed marker, color shifts:
  gold (>10% ahead), info-blue (>10% behind), moss (on-pace)
- **Roster lifecycle bar** — 6-phase distribution: Briefed / Invited
  / Confirmed / Producing / Reviewing / Live, each with progress bar
  and count

**Needs-you card (top-right):**

- Header "Needs you now" + total count
- **Pending reviews tile** with avatar stack (clicks → Content tab)
- **Overdue submissions tile** — "Auto-nudge sent · Manual follow-up
  recommended"
- **Live posts tile** — moss dot, count
- Footer mini-stats: "Avg approval time 1.4 days · Reply within 3h
  target"

#### 3.8.1 Pipeline tab — 8-column kanban

The deal pipeline. Every creator on the campaign appears as a card in
one of 8 columns:

`pitched → invited → negotiating → confirmed → submitted → approved →
live → paid`

Each column header shows stage dot, label, item count, **committed
spend total** for that stage.

**Kanban card:**

- Avatar + name + city
- Deliverable count + price
- "Review pending" pill when content is awaiting brand
- Overdue gold-left-border state
- Click → opens content review modal (if review pending) or routes
  to creator profile

**Per-stage inline actions:**

- **`pitched`** — Pass / Send offer (opens Send Offer modal)
- **`invited` / `negotiating`** — three sub-states:
  - Creator countered → accent callout "{first name} countered with
    $X" + optional message + Decline / Counter back / Accept buttons
  - Brand counter sent → "Awaiting reply to your counter" +
    Withdraw
  - Brand offer pending → "Awaiting reply" + Withdraw
- **`submitted`** (with in-review deliverable) — Review submission
- **`approved`** — Mark as live (opens Mark Live modal)
- **`live`** — italic "Live · tracking"
- **`paid`** — italic "Paid out · complete"
- **`confirmed`** — "Awaiting upload" + Cancel collab button
  (prompts for ≥6-char reason)

#### 3.8.2 Brief tab

Two-column: brief content (2fr) + assets sidebar (1fr).

**The brief column:**

- Full brief body
- Edit button (jumps to Settings tab)
- **Brand-safe checklist** (5 hardcoded items): "Show product
  clearly within first 3 seconds" / "Use the campaign hashtag in
  caption" / "Tag the brand and disclose #ad" / "No flashy hard-
  cuts; keep it daily-life" / "Avoid competitor brand mentions"

**Assets sidebar:**

- Per-file row: type icon (PDF / IMG / VID / ZIP / ext), name, file
  size, "Open" external link
- Brand owner sees × remove + "Upload asset" multi-file picker

#### 3.8.3 Content review tab

The hub for approving creator submissions.

**Awaiting your review section:**

- **Bulk-approve controls** (when >1 item): "Select all (N)" → "{N}
  selected · Clear · Approve {N}" buttons. Each approval calls the
  approve-content mutation per-row (escrow release + notifications
  per row)
- Grid of review cards — checkbox top-left, thumbnail with "Review"
  pill + creator avatar / name overlay, label, "Submitted {date} ·
  Due {date}". Click → Content Review modal

**Approved & live table** — columns: Creator (avatar + name),
Deliverable, Status (Approved / Live pill), Live link (permalink ↗),
Action ("View")

#### 3.8.4 Analytics tab

Single-campaign-scoped analytics: 4 KPI tiles + performance chart +
breakdown + leaderboard + audience + content mix + best-format
callout. Empty state: "Analytics unlock once content goes live."

#### 3.8.5 Settings tab

- Campaign name input
- Visibility (read-only callout for now)
- **Auto-shortlist toggle** — "Let Spark auto-shortlist applicants"
- Save button (dirty-state aware)
- **Danger zone** — "End campaign & refund unused funds"
- **Team access aside** — current team list (Owner first), pending
  invites (with copy-link + revoke for owner), "Invite teammate"
  with email + role select (admin / ops / finance / viewer)

### 3.9 Content review modal — the in-browser content review surface

Source: `ContentReviewModal.tsx` (366 lines).

A two-pane modal opened from the Content tab, the inbox, or a
direct deep-link.

**Left media preview** with security guardrails:

- Video → `<video controls>`
- Image → `<img>`
- PDF → strict MIME + .pdf extension check, sandboxed iframe with
  stripped script execution
- Other → "Open file" download button
- Blocks `javascript:`, `vbscript:`, `data:text/html` URLs

**Right review panel:**

- Creator avatar + name + handle / city
- Deliverable label + "Submitted {date} · Due {date}"
- Creator notes block
- **✨ Spark auto-check** — 5 automated checks (product visibility,
  hashtag, brand tag, #ad disclosure, caption length)
- Feedback textarea + 3 quick-fill chips: "+ Praise" / "+ Product
  visibility" / "+ Caption"
- Footer: "Will release on approval $X · Net after fees & WHT $Y"
  + Request revision / Approve & release $X buttons

### 3.10 Workflow modals — the offer / counter / mark-live flows

Source: `WorkflowModals.tsx` (925 lines).

**Send offer modal:**

- Creator avatar + name + "{tier} tier · listed at $X"
- Vacation guardrail callout (when creator is in vacation mode)
- **Offer templates row** — pick from saved templates OR save current
  draft as named template
- Rate input with creator's floor hint + below-floor warning
- Pre-filled message ("Hi {first name} — we'd love to work with you.
  Offering $X…")
- Footer: "Funds reserve to escrow only when {first name} accepts.
  Their net is $X after platform fee + WHT."

**Counter offer modal:**

- "{Other side} offered/countered with $X. Counter with your rate."
- Rate input with delta indicator ("+N%" or "-N%" vs current, gold
  when |%|>100, rejected when >10× the original)
- Net to creator / Escrow held on accept hints
- Message textarea + Decline instead / Send counter buttons

**Mark live modal (brand confirming):**

- "{Confirm content is live / Awaiting live URL}"
- Shows creator-pasted URL OR italic "Awaiting URL from creator…"
- Confirm live / Close buttons

**Invite creators modal:**

- Search by name / handle / category
- Multi-select candidate list (excludes existing applicants / offers
  / collabs)
- Invitation message textarea with brand pre-fill
- "Invite N creator(s)" button

### 3.11 Inbox — 3-pane CRM-style messaging

Source: `Inbox.tsx` (826 lines).

Persona-aware: same component for brand and creator views. Routed via
`forceThreadId` + `forcePanelMode` to support `deal:<convId>` deep-
links that promote the side panel to detailed view.

**Topbar:** "N conversations · M unread" + filter select (All / Unread
/ Archived)

**Left pane — conversation list:**

- Search box ("Search by name or campaign…")
- Per-row: counterparty avatar (creator for brand viewer; brand
  logo for creator viewer), name, message preview, "{brand} ·
  {campaign}" sub, last-message time, muted glyph, unread badge

**Middle pane — thread:**

- Header: counterparty avatar, name, "@handle · {reach} reach"
- Brand viewer: "View profile" CTA
- Creator viewer: "View brief" CTA
- Both: "Open deal room" (deep-links back to inbox with detailed
  side panel)
- **More menu** — Mute / Unmute, Archive / Unarchive, Report
  conversation (≥6-char reason, fires admin notification)
- **Workflow context band** — collab stage pill + per-stage hint
  copy + collab price + "Open campaign/collab" deep-link. Hint is
  persona-aware: brand sees "Awaiting your decision · review
  pitch"; creator sees "Brand invited you · accept or counter"
- Message bubbles aligned by sender, with text + attachment chips
- **Attachments** — up to 8 files per message, multi-file picker,
  pending-attachment preview chips above composer with × to remove
- Composer with 📎 attach + textarea + Send (Enter to send)

**Right pane — collab side panel:**

Two density modes — compact (inbox default) vs detailed (from deal
deep-link).

- **Campaign card** — name + status pill + brand + placement + "Open
  campaign/brief" link
- **Brief excerpt** (detailed only) — 6-line clamp + "View full
  brief →" link
- **Milestones** — 4-step vertical: Brief approved / Content
  submitted / Live on platform / Payment cleared. Each with state
  dot (done / active / pending) + "Now" pill on active. Detailed
  mode adds per-step description
- **This deal money breakdown** — Rate / Platform fee (10%) / Tax
  (5%) / Net to creator (accent, 85% of rate)
- **What's next** (detailed only) — stage × persona one-liner hint

### 3.12 Calendar — persona-aware deadline view

Source: `Calendar.tsx` (383 lines).

Single component, persona-detected. Brand sees deliverables their
creators owe; creator sees deliverables they owe to brands.

**Topbar:** "Calendar · N overdue · M due in next 7 days" + ‹ Today ›
nav controls

**Body:**

- **Month grid** — handwritten 6×7 grid, no date library. Weekday
  header (Sun-Sat). Each cell has date number (today highlighted),
  up to 3 deliverable chips (gold ⚠ prefix when overdue, label
  truncated to 18 chars), "+N more" overflow
- **Upcoming list** — first 12 entries chronological. Each row:
  avatar (creator's, for brand persona only), deliverable label,
  "{campaign} · counterparty for brand", overdue badge + due text

Filters out `paid` collabs and `live` deliverables.

### 3.13 Brand analytics — cross-campaign performance

Source: `BrandAnalytics.tsx` (553 lines).

Aggregates performance across every campaign into a single dashboard.

**Toolbar:** Time-range pills (All campaigns / Last 7d / Last 30d) +
Export CSV (campaign-level rows) + Share report (clipboard text
snapshot)

**4 KPI tiles** with sparklines + deltas:

- Impressions ("+18% wk/wk")
- Engagement rate ("+Npt vs 4.2% category", accent)
- CPM ("± N% vs paid social", $50 benchmark)
- EMV (Earned Media Value) ("$Xk · NX ROAS")

**Performance over time chart** — 3 metric toggles (Impressions /
Engagements / ER %) + weekly series line chart.

**Engagement breakdown card** — Likes / Saves (moss) / Shares (gold) /
Profile visits (info) progress bars + save-rate and share-rate %s

**Top performers across campaigns** — leaderboard table ranked by
engagement contribution.

**Audience reached card** — weighted by reach. By city (top 4 +
Other) / by age (4 bands) / Female / Male split.

**Content mix card** — Reels / Stories / Posts tiles with avg ER
("12.8%" / "6.2%" / "9.1%"). Best-performing-format callout from
Spark.

### 3.14 Brand wallet

Source: `BrandWallet.tsx` (418 lines).

USD-denominated account. Hero balance + ledger + sidebar tools.

**Topbar:** "{brand} · USD account" + Download statement (CSV) + Top
up (admin / finance only)

**Hero balance card** (dark gradient): Available balance + In escrow /
In flight stats + Top up button

**Ledger table:** Date / Description (with kind-tinted dot:
positive=moss, tax=gold, fee=ink-3, other=accent) / Status / Amount
(+ prefix for positive). Type filter dropdown.

**Sidebar:**

- **Top-up methods** — Wire transfer (Chase ••• 4291), ACH (Bank •••
  8830), JazzCash (0345 ••• 4291), Card on file (Visa ending 4242)
- **This month rollup** — Top-ups / Released to creators / Platform
  fees (muted) / Withholding tax (muted) / "Download tax report"
  button (filtered to fee + tax rows)

**Top-up modal:** Amount input with quick buttons ($1K / $5K / $10K /
$25K) + payment method picker (Wire T+1, 0% fee · ACH 2-3 BD, 0% fee ·
JazzCash instant, 0% fee · Debit/Credit instant, 1.5% fee)

### 3.15 Brand profile

Source: `BrandProfile.tsx` (602 lines).

Edit your company's "storefront equivalent" — what creators see when
they get an invite or browse your briefs.

**Identity section:** Brand name + logo upload (PNG/JPEG/WEBP/SVG up to
4MB, downscales to 256×256, uploads to Supabase Storage) + letter
fallback (1-2 chars) + industry + headquarters + website.

**About section:** 4-row textarea + char counter (400 max).

**Preferred categories:** 13-option multi-pill — "Drives Discover
match-scoring + Spark recommendations."

**Preferred regions:** 9-option multi-pill — "Where your audience
lives. Creators in these regions surface higher in your shortlist."

**Sidebar:** Live creator-side preview card + verification card ("✓
Verified" / "Unverified" pill + "Verify to unlock cold outreach"
instructions)

### 3.16 Team management

A 4-role permission system surfaced in Campaign Settings → Team Access:

- **Admin** — full access
- **Ops** — campaign management, no payouts
- **Finance** — payments + wallet only
- **Viewer** — read-only

Invite flow:

- Email input + role select → generates magic link `/accept-invite?
  token=<x>`
- Pending invites visible with copy-link + revoke
- Capability-gated buttons throughout — e.g., wallet top-up is
  admin / finance only; offer send is admin / ops only

---

## 4. Creator workspace — capability-by-capability

### 4.1 Home — money-first, action-second, growth-third

Source: `CreatorHome.tsx` (1,171 lines).

A landing page that puts earnings front and center, then surfaces
today's actions, then growth signals.

**Topbar:** "Hi {first name}" + crumb "Good morning from {city} · $X
ready to withdraw". Primary CTA: "Edit storefront"

**Sections:**

- **Earnings hero** — dark moss gradient, two-pane:
  - Left: eyebrow "This month" + giant amount + delta ("↑ 28% vs
    last month" / "no prior data yet" — computed from real
    transactions) + "ready to withdraw · $pending in escrow" sub +
    Withdraw to bank / View ledger CTAs. 3 mini stats: "Released
    today", "Releases this week", "Avg release time (< 48hr / Nd)"
  - Right: 6-month sparkline bar chart + "Lifetime: $X across
    collabs"
- **Recent activity** (when items > 0) — same component as brand
  side, routes to brief details
- **Today list** — priority-ordered actions:
  1. Deliverables in revision → "Resubmit {label}" + brand request
     copy
  2. Pending deliverable uploads → "Submit {label}" + escrow amount
     + due date
  3. Pending invitations / negotiations (3 sub-cases: brand-
     countered, invited, negotiating) with rate + placement
  4. Approved but not yet live → "Post & mark live" + "paste the
     live URL to release $X"
  5. KYC reminder → "Complete KYC verification · Unlock payouts
     above $1,000 · 2 minutes"
- **Brief matches** — 3 open non-applied campaigns sorted by match
  score, each with brand mark, name, match %, campaign name, per-
  creator price, "Due {date}", Apply button
- **Saved for later** (when applicable) — up to 4 bookmarked briefs
  with deep-link to "View all N saved →"
- **Storefront pulse** — `alamut.co/@{handle}` link + 3 PulseStats
  (views, brand inquiries, avg rating) + recent brand viewers
  strip + Spark suggestion callout
- **Audience pulse** — total reach + "↑ N this week" + Analytics
  CTA + FollowerSparkline + top regions + last post ER + "🎯 Best
  time to post" callout
- **Creator goals** — "You're N% to your monthly target 🎯" + tier
  pill (Bronze / Silver / Gold / Platinum based on lifetime
  earnings) + 3 achievement tiles
- **Creator tip of the day** — Tip card with editorial framing
  ("Brands pay 30% more for creators who reply within 6 hours.
  Your average reply is 18hr. Set up Inbox notifications…")

### 4.2 Storefront — the editable public page

Source: `Storefront.tsx` (1,669 lines).

Block-based editor — each block has its own Edit mode. Every save
cascades via `tx()` to the public-facing surface.

**Topbar:** "alamut.co/@{handle} · last updated 3 days ago" + "View
public" external link + "Done" primary

**9 editable blocks:**

1. **Identity** — Cover banner picker + circular xl avatar picker +
   name + verified pill + handle / city / country + bio + category
   multi-select pills. Edit mode: name input, handle input (lowercase
   only), bio textarea, city/country inputs, category multi-select,
   curated avatar grid, curated cover grid
2. **Channels** — list of channel rows (platform icon + name +
   handle + follower count + ER%). Edit: "+ Add channel" + per-row
   Edit/× buttons. Editor: platform select, handle, followers,
   engagement
3. **Packages** — 4 package cards: Instagram Reel ("60–90s vertical
   · 1 round of revisions"), Story bundle ×3 ("3 stories with link
   sticker · same-day shoot"), Reel+Stories combo ("most popular"),
   Long-form review ("3-min YouTube short · scripted"). Edit: free-
   form rate-range text inputs
4. **Work portfolio** — image grid of past work. Edit: × per tile +
   curated picker grid + paste-URL input
5. **Past collaborations** — brand wordmark wall + recent projects
   tiles. Edit: add brand name + ×
6. **Press & mentions** — list of `{source, title, year}`. Edit:
   common outlets quick-pick + manual inputs
7. **Featured reviews** — list of brand reviews, up to 4 pinnable.
   Each card: brand name, campaign title, "Pinned · #N" when
   pinned, quote, star rating, date. Edit mode: Pin / Unpin / Swap-
   pin per row (when at cap, opens swap modal)
8. **Availability & guardrails** — segmented status (Open /
   Limited / Booked), "Available again on" date, **vacation mode
   toggle** ("Surfaces a clear out-of-office banner"), **minimum
   acceptable rate floor** ("Brands sending offers below this see
   a warning"), **auto-decline categories** multi-select, notes
9. **Audience snapshot** (read-only) — Female / Male / 25-34 / Top
   city, wired to channels' analytics

### 4.3 Public storefront

Source: `PublicStorefront.tsx` (217 lines) + storefront sections.

The page brands and the public see at `alamut.co/c/{handle}`. Mirrors
the editor with the same component library so they cannot drift.

**Sections rendered:**

- Vacation banner (when applicable)
- Hero — name + bio + actions (Brief on Alamut / See work / Copy
  link / Media kit PDF)
- KPI strip — Total reach / Engagement % / Reply hours / Avg rating
  (with review count)
- Work / Audience / Channels / Packages / Reviews / Press
- Bottom CTA — "Ready to collaborate? — {first name} replies within
  {N}h on average. Tell {first name} about your brand and goals."
- Footer — "Powered by Alamut · {handle} · alamut.co/c/{handle}"

**Media kit PDF** — uses `window.print()` with a print stylesheet.

### 4.4 Browse campaigns — the brief marketplace

Source: `BrowseBriefs.tsx` (1,218 lines).

Editorial-style brief tiles with brand-letterhead bands. PKR display
with lakh/crore notation ("Rs 4.6L", "Rs 1.4Cr") for the Pakistan
market.

**Hero search:** Big search input (52px height) over a tinted bg.
Placeholder: "Search N open briefs by brand, category, platform…"

**Filter strip:**

- **Segment** — All / Live (with live-count + accent dot) / Coming
  soon (Planned)
- **Budget** multi-select chip — Under $5K / $5K–$15K / Over $15K
- **Category** multi-select chip — derived from real campaigns
  sorted by frequency
- **Fit for me toggle** — keeps only campaigns where creator is in
  the roster
- **Saved · N toggle** — only saved briefs (disabled when none
  saved; deep-linkable via `?filter=saved` from creator home)
- Sort dropdown — Newest first / Highest budget / Closest deadline
  / Best fit for me

**Campaign tile (the editorial brief card):**

- **Brand letterhead band** — deterministic brand-color background
  (6-palette: navy / cocoa / moss / brick / aubergine / ink),
  diagonal texture, brand mark (uploaded logo or letter fallback),
  brand name + verification meta ("Verified · pays in 3 days" /
  "Unverified brand · use caution"), right side: category + "Posted
  Nd ago"
- **Title row** — display-serif title + 2-line brief blurb, plus a
  **match-card on the right** with match% (computed from creator
  profile × campaign signals: audience, niche, ER, geo, history,
  rate alignment) and 3 bullet fit reasons ("✓ Niche fit", "✓
  Worked with {brand}", "✓ X.X% ER", "✓ {city} audience")
- **Three-pillar data band:**
  - Per-creator price (Rs) with "● Escrow funded" or "Awaiting
    funding"
  - Deliverables parsed from placement string with glyphs per row
    (▶ reel, ○ story, ▦ post/linkedin, ▤ carousel, ✎ newsletter /
    article)
  - Deadline (Nd, urgent in red after ≤5d) + "until {DD MMM}"
- **Footer:**
  - Seat map (filled vs open dots) showing "N of M filled"
  - Applicant avatar stack + "N applied"
  - Save button (bookmark glyph, filled when saved) + "View brief
    →" primary

### 4.5 Brief detail — read + apply flow

Source: `BriefDetail.tsx` (827 lines).

The single-brief surface. Auto-detects existing relationship: if a
collab exists, routes to CollabDetail; if an application exists, jumps
straight to the "Application sent" success state.

**Availability guardrails callout** — gold-bordered card when creator
is in vacation mode or the brief is in an auto-decline category.

**Match hero** (slim moss-gradient):

- 84px score circle
- Tier pill — Excellent (≥90) / Strong (≥75) / Decent (≥60) / Stretch
- 1-line headline ("Your {category} content overlaps with {brand}'s
  direction — {placement}")
- 5 facet bars — Audience / Niche / ER vs niche / Geo / Brand
  history, each computed from real signals
- Payout column flush right — "Pays $X · escrow · released <48h"

**Inline competition strip:** "{N} viewing · {N} applied / {N} spots
open · Closes in Nd · Your rank #N by match · {brand} typically
shortlists within 28h — early applications usually win."

**Brief content:**

- Brand letter mark + display-serif title + brand name + "Posted
  recently"
- "The brief" body
- Two-column **Do / Don't blocks** with checkmark/cross glyphs
- **Spark-flagged clauses** (expandable): Exclusivity, Usage rights,
  Disclosure — each with explanatory copy

**Apply form (when not yet applied):**

- Pitch textarea ("Tell {brand} how you'd approach this — what
  angle, what makes you different")
- Price input with brand range hint, creator's usual rate hint,
  floor hint + below-floor warning
- "Send application →" button (disabled if pitch empty or price ≤ 0)

**Success state (applied):** moss card + "✓ Application sent · {brand}
typically replies within 48 hours" + "Go to my collaborations"

**Sidebar:**

- **Compensation card** — payout amount + "per creator · paid via
  escrow" + Deadline / Placement / Total budget / Spots open KV rows
- **About {brand}** — letter mark + brand name + "Verified brand" +
  Avg payout time / Approval rate / Repeat hire rate / Disputes
  this quarter

### 4.6 My collaborations — the creator tracker

Source: `MyCollabs.tsx` (284 lines).

Splits collabs into two sections:

- **Open offers** — pre-acceptance: invited / pitched / negotiating
- **Collaborations** — post-acceptance: confirmed / submitted /
  approved / live / paid

View toggle: **Kanban / List**

**Kanban view** — per-stage columns with stage dot, label, count.
Each card shows brand name, campaign name, due date, price.

**List view** — table: Brand / Campaign / Stage (pill) / Deliverables
/ Due / Price

**Empty state:** "No active collaborations yet · Browse open briefs
from brands and apply with a pitch…" + "Browse open briefs" CTA

### 4.7 Collab detail — workflow management for a single deal

Source: `CollabDetail.tsx` (1,168 lines).

Two-column workflow surface. Used as deep-link target for
`?action=upload` and `?action=mark-live`.

**Pending cancel banner** — appears when brand has requested cancel,
shows reason + Decline / "Agree & cancel" buttons.

**Topbar:** Campaign name + brand. "Message brand" / "+ Submit
content" actions.

**Status hero** — stage pill + 6-step timeline (pitched /
negotiating / confirmed / submitted / approved / paid)

**Stage action banner** — comprehensive stage-aware action band that
changes based on current state:

- `invited` — "{brand} invited you to {campaign}" · "Offered $X for
  {placement}" + Message brand / Counter / Accept invitation
- `pitched` — "Application sent — awaiting brand response" +
  Withdraw + Message
- `negotiating` — "{brand} sent an offer" · "$X for {placement}" +
  Counter / Accept ($X)
- `confirmed` — "Confirmed — start creating" · "{$X} secured in
  escrow. When your draft is ready, upload it for review" + Upload
  content
- `submitted` with revision note — "{brand} requested changes" ·
  "{note}" + Resubmit
- `submitted` clean — "Submitted — awaiting brand review" + Message
- `approved` — "Approved — awaiting publishing" · "Funds will
  release to your wallet once it's marked live" + Message
- `live` — "Your post is live" · "{permalink}" + View post
- `paid` — "Paid — $X received" · "Funds are in your wallet" +
  Leave review

**Dispute escape hatch** — visible in confirmed / submitted / approved
/ live stages: "Issue with this collab? Raise a dispute" link

**Deliverables list** — header with progress summary (X / Y approved)
+ slim moss progress bar. Per-row Upload / Resubmit actions

**Collapsible brief** — collapsed by default

**Collab activity card** — last 7 days of events

**Right sidebar:**

- **Payout timeline card** — dark hero with net amount + 4-step
  milestone river (Escrow → Submitted → Approved → Wallet release)
  with ETAs or actual dates
- **Brand contact card** — letter mark + brand name + "Marketing
  team" + "Replies in ~28h" + Approval rate tile

**Modals dispatched from this surface:**

- Content upload (with caption, drag-and-drop, file constraints)
- Counter offer (creator-side)
- Leave review (1-5 stars + ≥10-char note)
- Raise dispute (6 categories, ≥20-char description)
- Creator mark-live (URL paste with platform validation)

### 4.8 Content upload modal — creator submits draft

Source: `ContentUploadModal.tsx` (306 lines).

**File constraints:** Max 200MB; allowlist: mp4/mov/webm/png/jpg/jpeg/
heic/gif/pdf.

**Step 0:**

- Header "{Submit content / Resubmit content} for review · {brand} ·
  {campaign} · {deliverable label}"
- Drag-and-drop dropzone
- **Caption textarea** with char count + "Spark recommends 60–120
  words for Reels"
- **Spark pre-flight checks:**
  - Ratio detected (9:16 Reel-ready ✓)
  - Campaign hashtag (regex-based ok/warn)
  - #ad disclosure (FTC + Pakistan PCA compliance)
- Cancel / "Submit for review" buttons

**Step 1 (success):** Moss check icon + "{Deliverable} submitted to
{brand} · You'll be notified when the brand reviews. Most brands
respond within 24 hours."

### 4.9 Creator mark-live modal — pasting the live URL

Two-tier validation:

- Parses as `http(s)`
- Host matches whitelist: Instagram / TikTok / YouTube / X / LinkedIn
  / Threads / Snapchat / Facebook / Pinterest
- Per-state feedback: "That doesn't look like a valid URL…" /
  "Unrecognized host — paste a link to {whitelist}" / "{Platform}
  link detected ✓"

**Confirmation checkbox:** "I confirm the post is live and publicly
accessible. Removing or making it private after marking live can put
the deal in dispute."

### 4.10 Creator analytics

Source: `Analytics.tsx` (526 lines).

**Range filter pills:** 7d / 30d / 90d / 1y. + "View storefront"
external button.

**4 KPI tiles:** Total reach (across N channels, "+8.2%"), Avg
engagement (industry avg 2.4%, "+0.6pt"), Deal close rate (X of Y
applications accepted; ±12pt vs threshold), Earnings ({range} — sum
of windowed payouts, payout count in window)

**Row 1:**

- **Reach over time bar chart** — bucketed from submission activity,
  weighted by status (approved=30, in_review=12, other=8)
- **Brand mix donut** — top 5 categories of accepted/live/approved/
  submitted/confirmed collabs, color-coded segments, center text "N
  brand deals"

**Row 2:**

- **Audience demographics** — Female / Male / 25-34 / 18-24 bars +
  "Top region: {city}, Pakistan · 38%" callout
- **Per-channel performance** — list with platform icon, name,
  handle, Followers / Engagement / Δ vs prior

**Top performing posts** — list from approved submissions with
platform icon, "{campaign} — round N", platform name + submission
date, Reach / ER / Earned stats

### 4.11 Creator wallet

Source: `CreatorWallet.tsx` (422 lines).

**Topbar:** "{creator} · USD account" + "Request advance" (when
eligible) + "Withdraw"

**Hero balance card** (moss-gradient): Available to withdraw + In
escrow / Lifetime earned + Withdraw to bank button

**Ledger table:** Date / Description / Gross / Fee / Net (moss for
positive) / Status pill (Paid moss / Pending draft)

**Sidebar:**

- **Payout method card** — bank logo + "Bank transfer" + "Account
  ending 4291" + Edit (→ KYC)
- **Tax docs card** — "Tax certificates auto-generated quarterly.
  We deduct withholding on each payout." + Download statement

**Withdraw modal:** Amount + "Withdraw max" link + summary (Withdrawing
$X, To Bank ending 4291, Estimated arrival 1–2 business days)

**Advance modal:** "Borrow against pending escrow on accepted offers.
3% flat fee, repays automatically from your next payouts. Max is 80%
of pending balance." Amount input + fee row + net to wallet bold +
"Disburse $X" button

### 4.12 KYC & Tax — 5-step verification

Source: `KycTax.tsx` (573 lines) + `TaxFormModal.tsx` (265 lines).

**Topbar:** "{N} of {M} steps complete · {P}% verified" + Back to
wallet

**Progress card** (accent gradient): "Verification progress · {N} of
{M} steps verified · Finish KYC to unlock instant withdrawals,
international wire transfers, and brand payouts above $1,000." Giant
{P}% display + progress bar.

**5 steps with state machine** (verified / pending / action / locked):

1. **Identity verification** — "Government-issued ID + selfie.
   Powered by Persona — typically clears in under 5 minutes."
2. **Address verification** — "Utility bill or bank statement
   showing your name and current address."
3. **Tax form (W-9 / W-8BEN)** — "Required before your first payout
   clears." Locked until identity verified
4. **Bank account** — Account number / IBAN, method dropdown (ACH /
   Wire / SEPA / Local bank), currency dropdown (USD / EUR / GBP /
   PKR). Locked until identity verified
5. **Creator agreement** — Standard payment + content-rights
   agreement, one-time signature. Verified once first payout clears

**Auto-generated tax documents card** — quarterly statements derived
from real payout transactions, grouped by year + Q. Each row: shield
icon + "{year} Q{q} earnings statement" + "{date} · ${amount}
declared" + Download CSV button + "View all" archive export

**Tax form modal:**

- Step 1: "I'm a US person" (files W-9) vs "I'm a non-US person"
  (files W-8BEN)
- Step 2: Legal name + classification + Tax ID (last 4 SSN only OR
  full EIN for W-9 / Country + foreign tax ID for W-8BEN) +
  Permanent residence address + **typed-signature attestation**
  (must match legal name)

---

## 5. The CRM layer — what makes Alamut a CRM, not just a marketplace

Most marketplaces stop at the transaction. Alamut treats every deal
as a long-running relationship and gives both sides the management
tooling that brand-creator deals have historically lacked.

### 5.1 Saved lists (shortlists / favorites)

- **Brand: `savedCreators[]`** — toggle from any creator profile or
  Discover card; surfaces in: sidebar "Find creators" badge count;
  Brand Home featured "Creator of the week" scoring boost; Spark
  shortlist canvas (synced both ways)
- **Creator: `savedBriefs[]`** — toggle from Browse or any campaign
  tile; surfaces in: Browse "Saved · N" filter chip; Creator Home
  "Saved for later" tile with up to 4 cards + deep-link to full
  saved list

### 5.2 Pipeline / kanban

- **Brand per-campaign pipeline** — 8-column kanban in Campaign
  Detail with per-stage actions, per-column counts, committed-spend
  totals per column
- **Creator cross-campaign tracker** — 2-section kanban (Open offers
  + Collaborations) with Kanban/List toggle

### 5.3 Bulk actions

- **Bulk approve content** — Content tab "Select all (N)", per-item
  checkbox, "Approve {N}" button. Each approval fires the full
  approve flow per-row (escrow release + notifications)
- **Bulk invite creators** — Invite Creators modal with multi-select
  search; "Invite N creator(s)" fires one invite per selection

### 5.4 Templates

- **Offer templates** — per-brand. Saved from Send Offer modal with
  a name; picked from dropdown to pre-fill rate + message (with
  `{firstName}` substitution)
- **Spark drafts** — per-brand conversation drafts with auto-save
  every 1.5s; reload from dropdown with name + last-edited
  timestamp
- **Campaign templates** (legacy modal) — saved campaign drafts
  persisted via localStorage

### 5.5 Activity timelines

- **`useRecentActivity` hook** — derives chronological feed from
  notifications + collab history + transactions + reviews
- **Recent activity card** — reused on both Brand Home and Creator
  Home with kind-color icons + relative-time pills
- **Collab activity card** — last 7 days of events on a single
  collab inside Collab Detail
- **Notifications** — grouped by Today / Yesterday / Earlier this
  week / Older

### 5.6 Relationship history

- **Past brands list** on every creator profile (sourced from
  completed campaigns)
- **Past completed projects** with brand + campaign + placement +
  paid amount on Creator Profile + Storefront
- **Repeat hire rate** + **disputes this quarter** on Brief Detail's
  "About brand" sidebar
- **Verified brand badge** + **avg payout time** + **approval rate**
  on Brief Detail for creator-side trust signals

### 5.7 Workflow context attached to messages

- **Workflow context band** in every inbox thread — collab stage
  pill + per-persona-per-stage hint + collab price + deep-link to
  campaign/collab. The hint is computed from current deal state, so
  a stale conversation always shows the live "what's next" copy
- **Collab side panel** in inbox — campaign card + milestones +
  money breakdown + "what's next" for the active deal

### 5.8 Segmentation via filters

- **Discover** — multi-select platform / followers / category /
  city / age band / gender skew / min ER / max rate + verified +
  brand-safe toggles
- **Browse briefs** — segment + budget + category + fit-for-me +
  saved filters

### 5.9 Reviews + ratings

- 5-star + ≥10-char note via Leave Review modal
- Public on brand and creator surfaces
- **Pinnable on creator storefront** — up to 4 featured. When at
  cap, pinning a new one opens a swap modal to pick which to drop
- Admin can hide reviews (filtered out of storefront)

---

## 6. The AI layer — Spark across the product

Spark is positioned as the **product-wide AI assistant**, not a single
feature. Touchpoints:

- **Standalone planner** at `/spark` — full conversational workspace
- **Brand Home composer** — quick-prompt hero card
- **Discover Spark mode** — plain-English search
- **Campaign auto-shortlist** — auto-promotes strong applicants
- **Brief assistant** — generates structured brief from prompt
- **Content suggestions** — 4 content hooks per category
- **Match modal** — concierge match by keyword overlap
- **Brief-clause flagging** — Exclusivity / Usage / Disclosure
- **Upload pre-flight** — ratio, hashtag, disclosure checks
- **Review auto-check** — 5 checks on submitted content
- **Best-format callout** in analytics — surfaces format-level
  insights ("Reels with daily-life framing · 2.8× higher save rate")
- **Storefront pulse suggestion** — "Add a 'case study' block…"
- **Creator-of-the-week pick** on Brand Home

Architecture: scripted engine with regex intent detection +
deterministic creator ranking, raced against a remote LLM proxy
(Claude via Edge Function) when configured. Only the text reply is
substituted with the remote result; structured blocks (creator cards,
projections, brief drafts) stay scripted for reliability.

---

## 7. The marketplace layer

### 7.1 Public storefronts

Every creator has a public-facing page at `alamut.co/c/{handle}`
that's:

- Branded with cover banner, avatar, name, bio
- Lists their channels with followers + ER
- Shows their packages and rates
- Has a portfolio of past work
- Shows past brand collaborations as receipt cards
- Shows pinned brand reviews
- Has press mentions
- Carries a clear "Send brief" CTA
- Exports to PDF as a media kit

The page is **block-edited by the creator** in the workspace and
**re-rendered identically on the public side** — the editor and the
public surface share the same React components so they can't drift.

### 7.2 Brand profiles (verifiable)

Every brand has a profile creators can review before applying or
accepting:

- Verified badge (admin-handled)
- Industry + HQ + website
- About copy
- Preferred categories + regions (drives match scoring)
- Past payout track record (visible to creators on Brief Detail)

### 7.3 Brief marketplace

Open briefs are publicly browsable by creators with match-scored
tiles, multi-faceted filters, save-for-later, and an editorial card
design. The match score is computed from real signals: audience
overlap, niche fit, ER vs niche average, geo, brand history, rate
alignment.

### 7.4 Discovery in both directions

- Brands discover creators via Discover or Spark
- Creators discover briefs via Browse or via direct brand invitations
  arriving in their inbox
- The match-scoring system runs both directions

---

## 8. The payments + trust layer

### 8.1 Escrow on every deal

- Brands top up their wallet via Wire / ACH / JazzCash / Card
- Campaign creation locks a portion of the wallet
- Offer acceptance locks the creator's specific slice
- Approval releases 50% to the creator
- Mark-live confirmation releases the final 50%
- Creator withdraws to bank instantly

### 8.2 KYC + tax

- 5-step verification flow (Identity / Address / Tax form / Bank /
  Agreement)
- W-9 (US) / W-8BEN (international) with typed-signature
  attestation
- Bank account collection with method + currency (USD / EUR / GBP /
  PKR)
- Auto-generated quarterly tax statements derived from real payout
  data
- 365-day re-verification reminder

### 8.3 Disputes

- 6 categories: non-delivery / scope-creep / late-payment / quality
  / content-takedown / other
- Raising a dispute **freezes escrow** so approve-content refuses
  to release
- Admin Disputes screen mediates with full conversation history +
  audit log
- Dispute resolution modal for admin closure

### 8.4 Cancellation

- Brand requests cancel from kanban (≥6-char reason)
- Creator sees banner in Collab Detail with Agree / Decline
- Mutual agreement releases escrow back to brand

### 8.5 Advances

- Creator can borrow against pending escrow on accepted offers
- 80% of pending balance, 3% flat fee
- Auto-repays from next payouts
- Eligibility: no active advance + ≥$100 capacity

### 8.6 The take rate

- **5% to the brand** on cleared deals (no retainer, no
  subscription, no per-seat)
- **0% to the creator** (they receive 100% of agreed deal value)
- Withholding tax (5% for Pakistan FBR) auto-deducted on payout
- Quarterly tax statements auto-generated

---

## 9. The workflow state machine

Every collaboration moves through a fixed pipeline. Each transition
fires side effects: escrow movements, notifications, audit log
entries, surface re-renders.

**8 v2 pipeline stages:**

`pitched → invited → negotiating → confirmed → submitted → approved →
live → paid`

**4 campaign-level statuses:** Live / Paused / Planned / Completed

**Lifecycle actions** (capability-gated):

- `campaign.pause` (admin / ops)
- `campaign.end` (admin / ops, refunds unused escrow)
- `campaign.update` (admin / ops)
- `application.invite` / `application.decide` (admin / ops)
- `offer.send` / `offer.withdraw` (admin / ops)
- `content.approve` / `content.revise` (admin / ops)
- `content.markLive` / `content.setPermalink` (admin / ops)
- `wallet.topup` (admin / finance)

---

## 10. Notifications system

### Notification kinds

- **offer** — meta.offerId set
- **draft** — meta.submissionId set
- **application** — meta.applicationId set
- **review** — meta.reviewId set
- **collaboration** — cancel-collab requests, mutual agreements,
  dispute-resolved
- **payout** — text matches payout/escrow/paid
- **campaign** — text matches campaign/moved-to
- **team** — text matches team/invited/manages
- **other** — fallback

### Events that fire notifications

- Offer sent / accepted / declined / countered / withdrawn
- Application submitted / accepted / rejected / withdrawn
- Content submitted / approved / revision requested / marked live
- Mutual cancel requested / agreed / declined
- Dispute raised / resolved
- Payout cleared / wallet topped up
- Team invite sent / accepted / revoked
- Brand verification / KYC verification / re-verification reminders
- Campaign launched / paused / resumed / ended

### Bell popup

- All / Unread filter chips
- Grouped sections: Today / Yesterday / Earlier this week / Older
- Kind-tinted dots + 1-line eyebrow per row
- **Inline quick actions** for pending offers (Accept / Decline)
  and in-review submissions (Approve)
- "Mark all read" link
- Cross-device read-state mirror

### Deep linking

Every notification has a deep-link that lands the user on the right
surface with the right modal open — e.g., a pending review
notification lands on Campaign Detail's Content tab with the
ContentReviewModal pre-opened.

---

## 11. Onboarding

### Brand onboarding (3 steps)

- **Company** — name, industry (10 options: Fashion / Beauty / Food /
  Tech / Fintech / Healthcare / Retail / B2B / Media / Other), HQ,
  website, about
- **Preferences** — categories of interest (10 multi), regions (6
  multi), creator tier (4 cards: Nano / Micro / Mid / Macro), typical
  monthly budget
- **Launch** — 3 paths: "Plan a campaign with Spark" (recommended) /
  "Post a brief manually" / "Just look around first"

### Creator onboarding (5 steps)

- **Platform** — primary platform pick (Instagram / TikTok / YouTube
  / LinkedIn / X / Newsletter) with copy per platform
- **Channel** — handle, followers, engagement %, city, primary
  category, bio
- **Rates** — Reel rate, Story bundle rate, Combo rate
- **Payout** — Pakistani bank (same-day) / JazzCash (instant, 1%) /
  International wire (USD 2-3 BD, $25 fee)
- **Publish** — summary + creator agreement checkbox

### Cross-cutting

- Onboarding checklist (post-onboarding nudge)
- First-run guided tour
- Live preview sidebar in both wizards

---

## 12. Admin / operator workspace

- **Console** — admin dashboard
- **Queue** — unified queue (applications + verifications + disputes)
- **Disputes** — mediation surface
- **Payouts** — payout operations
- **Audit log** — every state change
- **Verify** — KYC + brand verification
- **Reports** — admin reports

---

## 13. Landing pages

### Creator landing (`/`)

13 sections:

1. **Hero** — "Your next brand partnership starts here." + 2-min sign-
   up CTA + storefront illustration
2. **Trust bar** — verified creator portrait wall ("From nano (5k
   followers) to mega (1M+) — engagement matters here, not just
   follower count")
3. **Why creators (4 pillars)** — Safety first (verified brands, no
   shady DMs) / Opportunities for every size (engagement-first, not
   follower-first) / Reliable payments (escrow + 4-day median
   payout) / Multi-platform (IG, TikTok, YouTube, Substack, X)
4. **Editorial break** — magazine-style pull quote
5. **Showcase gallery** — 16 real recent closed deals
6. **How it works (4 steps)** — Sign up free / Apply or get
   discovered / Seamless collaboration / Fast secure payouts
7. **Brand authority** — auto-scroll wordmark marquee of 14 brands
8. **Press strip** — fictional editorial citations
9. **Voices** — testimonial wall (creator-shown only)
10. **Pricing** — Flat 5% only on cleared deals
11. **FAQ** — 8 questions
12. **Final CTA** — "Turn your audience into income"
13. **Footer** — 4 columns (brand, for creators, tools, account)

### Brand landing (`/for-brands`)

13 sections including: AI-driven hero, trust bar (brand wordmarks),
Speed (10× / 2× / 20h+), AI matching engine ("Beyond follower count"),
editorial break, control (hands-on or hands-off), case study, press,
brand logo marquee, flat 5% pricing, FAQ, final CTA.

---

## 14. Cross-cutting features (the "many other things")

### Search

- **⌘K global search** — command palette accessible from sidebar
  search button
- Searches across creators / campaigns / threads

### Hotkeys

- Global hotkeys layer with help modal
- ⌘K opens search

### Profile drawer

- Slide-over creator preview for quick-glance from anywhere

### Storefront sharing

- Copy link / Share link via clipboard
- Media kit PDF export
- QR code generation

### Cultural calendar

- Pakistan retail dates baked in (Eid-ul-Adha, Independence Day,
  Black Friday PK, Quaid Day · Christmas)
- Days-until countdown on Brand Home
- "Plan →" CTA to a new campaign pre-seeded for the event

### Theme + density

- Light / Dark theme toggle
- Density toggle for compact vs comfortable UI

### Outreach tools

- Outreach repo + actions
- Outreach lifecycle persistence

### Rate calculator (public tool)

- Public rate calculator for Instagram / TikTok / YouTube
- Public top-creators directory at `/creators`

### Cross-tab sync

- Zustand store with localStorage persist
- Cross-tab broadcast — open the app in two tabs, change something
  in one, it updates in the other

### Real-time messaging

- Supabase Realtime channels per conversation
- Typing indicators, read receipts, deal-state changes propagate
  live to both sides

### Optimistic concurrency control

- Version columns on every mutable entity
- StaleVersionError surfaces a "someone else updated this" toast
  instead of clobbering writes

### Audit log

- Every contract state change, payment, message is append-only
- Auditable by both parties
- Operations team uses for dispute mediation

### Tier system (creator)

- Bronze (<$1K lifetime) / Silver (≥$1K) / Gold (≥$5K) / Platinum
  (≥$15K)
- Tier pill on Creator Home

### Cancellation flow

- Mutual cancel with reason
- Auto-releases escrow back to brand on agreement

### Vacation mode

- Surfaces out-of-office banner on storefront
- Warning callout on briefs from auto-decline categories
- Brand sees vacation pill in Discover cards

### Min rate floor + auto-decline categories

- Creator sets minimum acceptable rate
- Creator sets categories they don't accept
- Both surface as warnings to the brand on Send Offer modal

---

## 15. Data model — what the product persists

### Core entities

- **Creators** — profile, channels, packages, rates, work portfolio,
  past brands, audience snapshot, availability, vacation mode,
  saved briefs, KYC state, tax form
- **Brands** — profile, industry, HQ, website, about, categories,
  regions, saved creators, verification state, team members, wallet
- **Campaigns** — brief, placements, budget, deadline, status,
  pipeline stages, audience targeting, assets, team access settings
- **Collaborations** — the per-deal record (creator × campaign)
  with stage, escrow lock, deliverables, milestones, dispute state
- **Applications** — creator pitches to a brief
- **Offers** — brand offers with rate + message + counter history
- **Submissions** — creator-uploaded content with status + feedback
- **Deliverables** — atomic content pieces per collab
- **Threads + Messages** — inbox conversations with attachments
- **Transactions** — wallet ledger (top-ups, escrow holds, releases,
  fees, withholding tax, withdrawals)
- **Reviews** — 5-star + note brand-on-creator
- **Disputes** — escalations with category + description + resolution
- **Notifications** — per-user event stream with kind + meta
- **Spark drafts** — per-brand AI conversation drafts
- **Offer templates** — per-brand saved offer drafts
- **Contracts** — content rights terms per deal
- **Team invites** — pending + accepted with role
- **Outreach** — outbound contact lifecycle

### Numbers + constants baked into the product

- **8 v2 pipeline stages** — pitched / invited / negotiating /
  confirmed / submitted / approved / live / paid
- **4 campaign-level statuses** — Live / Paused / Planned / Completed
- **5% take rate** to brand
- **10% platform fee** (brand surface accounting)
- **5% withholding tax** (Pakistan FBR)
- **85% net to creator** across the board
- **50/50 escrow release** — 50% on approval, 50% on mark-live
  confirmation
- **3% advance fee**, 80% of pending balance maximum
- **6-brand-color palette** — navy / cocoa / moss / brick /
  aubergine / ink (deterministic per-brand hash)
- **9-platform live-URL whitelist** — Instagram / TikTok / YouTube /
  X / LinkedIn / Threads / Snapchat / Facebook / Pinterest
- **Tier thresholds** — Bronze <$1K / Silver ≥$1K / Gold ≥$5K /
  Platinum ≥$15K (creator lifetime earnings)
- **365-day re-verification** reminder
- **5% flat fee** charged only on cleared deals

---

## 16. Tone + voice for the deck

The product voice is **editorial, not corporate**. We sound like a
serious trade publication writing about ourselves. The product is
built on the principle that the work speaks; the copy should mirror
that.

**Words we use:**

Marketplace · receipts · escrow-funded · on-platform · workspace ·
storefront · pipeline · brief · campaign · countersign · payout ·
verification · flywheel · cleared deal · contract · ledger ·
deliverable · submission · review · approval · mark live · release

**Words we avoid:**

Disrupt · revolutionary · best-in-class · synergy · empower (the
verb) · solutions · ecosystem (for the company) · influencer (we
say "creator" or "creator marketing") · KOL · talent (for creators)

**Pull quotes / one-liners (deck-ready):**

> "The two-sided creator-economy operating system."

> "A workspace for the brand. A storefront for the creator. A
> single contracting layer underneath."

> "Spark plans the campaign. Escrow funds the brief. The receipts
> publish themselves."

> "Brand-creator deals used to live in DMs and Google Docs. Alamut
> gives them a workspace."

> "Every closed deal becomes a receipt on the creator's storefront.
> Discovery is just history made public."

> "Inbox, calendar, pipeline, content review, payouts. One product."

> "5% only when the deal clears. Nothing else."

---

## 17. Visual / UI vocabulary

For the designer translating screens into deck visuals, the
product's visual language is:

- **Editorial-magazine layout** — generous whitespace, large display
  serif type, restrained color
- **Paper-warm neutrals** with a single accent (rust-orange `#c5552b`)
  and a moss-green for "good/paid" signals
- **Mono-spaced metadata** — dates, IDs, version numbers, financial
  figures render in monospace as a tell of trust + precision
- **Receipts-as-cards** — every closed deal looks like an artifact,
  not a list row. Logo + amount band + date + verification badge
- **Two-tone workspace chrome** — left rail (sidebar) is paper-tone,
  main canvas is canvas-tone, separated by a hairline. Pattern
  repeats across brand + creator
- **Editorial brand cards in Browse** — brand-letterhead bands with
  deterministic color palette (6 brand colors hashed per brand)
- **No emoji, no cartoon people** — abstract glyphs, initials, real
  product screens
- **Stage pills** — small color-tinted pills with a leading dot per
  pipeline stage
- **Score badges** — circular badges for Alamut match score
- **Sparklines** — small inline trend lines on KPI tiles
- **Progress bars** — slim moss bars throughout for completion state

---

## 18. Suggested deck flow (18-slide spine)

Each slide title is the takeaway the audience should walk away with —
not a topic label. Map to source sections for content.

| # | Slide takeaway | Source section |
|---|---|---|
| 1 | "A workspace for the brand. A storefront for the creator. One contracting layer." | §1 |
| 2 | "Brand-creator deals have never had a real workspace. Until now." | §1 |
| 3 | "Two paired workspaces, sharing every deal in real time." | §2 |
| 4 | (Brand workspace screenshot, annotated) — "What the brand sees." | §3 |
| 5 | (Creator workspace screenshot, annotated) — "What the creator sees." | §4 |
| 6 | "Spark plans the campaign in plain English." | §3.2, §3.3 |
| 7 | "Discover, filter, save — a real CRM for creator deal pipelines." | §3.4, §5 |
| 8 | "8-stage pipeline with per-stage actions. Bulk approve. Templates. Auto-shortlist." | §3.8.1, §5.3, §5.4 |
| 9 | "Inbox, but with the deal alive inside it." | §3.11 |
| 10 | "Content review with AI pre-checks — in-browser, in 90 seconds." | §3.9 |
| 11 | "Campaign and brand analytics built into the same surface." | §3.13, §4.10 |
| 12 | "Every closed deal becomes a public receipt on the creator's storefront." | §4.2, §4.3, §7.1 |
| 13 | "Brief marketplace with real match scoring. Apply with a pitch in one click." | §4.4, §4.5 |
| 14 | "Escrow on every deal. KYC + W-9 + W-8BEN built in. Quarterly tax docs auto-issued." | §8 |
| 15 | "Disputes, advances, cancellations, team roles — the operational layer is there." | §8.3, §8.4, §8.5, §3.16 |
| 16 | "Notifications, calendar, ⌘K, real-time sync — the modern workspace stack." | §3.12, §10, §14 |
| 17 | "5% only when the deal clears. Nothing else." | §8.6 |
| 18 | Closer + ask. | — |

For investor-specific decks, slide 18 becomes traction + team + ask.
For brand-prospect or creator-prospect decks, slide 18 becomes "how
to get started."

---

## 19. What's intentionally out of scope for this brief

- Fundraising specifics — round size, valuation, runway
- Cap-table / team bios / hiring plan
- Detailed product roadmap with dates
- Competitive matrix with named competitors (positioning here is
  against *categories*: agencies, first-gen marketplaces, DMs +
  spreadsheets)
- Traction / revenue / retention curves — pull separately for
  investor decks

---

*End of brief. Every section is sized for one or more slides. The
deck-flow guide in §18 is a suggested narrative arc; the designer
should compress or expand based on time-in-room. The pull quotes in
§16 are deck-ready. Visual vocabulary in §17 is the design
direction.*
