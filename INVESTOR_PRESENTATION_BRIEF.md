# Alamut — Investor Presentation Brief

A designer-ready product brief. Pulled from the live product (workspace
v2, landing pages, deal-flow primitives), the codebase voice, and the
trust + economics layer baked into the platform. Intentionally excludes
fundraising specifics — round size, valuation, traction numbers — so
this document survives across decks and audiences.

> **How to use this**: Each top-level section is a candidate deck
> chapter. Sub-sections are slide-sized ideas. Pull quotes are pre-cut
> for hero slides. The "Suggested deck flow" at the bottom is a 15-slide
> spine that strings the chapters together.

---

## 1. The one-liner

**Alamut is the marketplace where brands and creators close deals
directly — with escrow on every contract, a 5% flat fee, and instant
payouts.**

If a slide needs a shorter version:

> *"The marketplace that turned brand-creator deals into a primitive."*

If a slide needs the long version:

> *"Alamut is a contracting layer for the creator economy. Brands post
> briefs, creators apply or get invited, and every accepted deal is
> escrow-funded, on-platform, and paid out the day the work goes live.
> No retainers. No agency middle layer. A 5% flat fee instead of the
> 20-30% the agency stack charges. Closed deals leave public, immutable
> receipts on the creator's storefront — the trust primitive that
> compounds into a moat."*

---

## 2. The problem

The brand-creator economy is a $20B+ category running on Google
spreadsheets, DMs, PDF contracts, and net-90 invoices. Three pains
converge:

### 2.1 The agency tax

Brands working with creators today have three options, all bad:

| Path | What it costs | What it breaks |
|---|---|---|
| **Agencies / creator shops** | 20-30% take rate, $5k-50k retainers | Speed (12-week deal cycles), margin, control |
| **Direct outreach** | "Free" but $80-120/hr in ops time per deal | Doesn't scale past 3-5 creators |
| **First-gen marketplaces (Aspire, Grin, etc.)** | $1k-3k/month SaaS + still negotiate off-platform | Workflow lives in the tool, money lives outside it |

The deal *closes* off-platform every time. That's the unfixed bug.

### 2.2 The trust gap

A brand reaching out to a creator with 50k followers today has no way to
verify that the creator (a) responds to brands at all, (b) has shipped
comparable work, (c) was paid for it, (d) hit the brief. Every deal
starts at zero trust, which is why every deal needs a contract, a
retainer, a manager-in-the-middle, and net-60 terms.

A creator getting a DM from a brand has the mirror version of the same
problem. No way to know if the brand actually pays, on time, in full.
The default answer is "ask for a managed-deal through an agency" — and
the agency takes 25%.

### 2.3 The cash-flow death spiral

The industry standard payout is net-60 to net-120 from delivery.
Creators ship work in March, send an invoice in April, get paid in
August. Half their PnL is accounts-receivable they may never collect.
This is the single biggest reason creator businesses cap out at one
person and never become real companies.

---

## 3. The Alamut bet

The insight that drives the product:

> **If escrow is built into the marketplace primitive — not bolted on as
> a feature — then the entire deal cycle collapses. Trust stops being
> negotiated and starts being structural. The middle layer becomes the
> contract.**

Three things have to be true at the same time for this to work, and the
product is engineered to make all three true by default:

1. **Money is on-platform before work starts.** A brand can't post a
   brief without funding the budget into escrow. A creator can't be
   asked to "trust us, the PO is coming." The cash is already there.

2. **Payouts are instant on delivery.** When a creator marks content
   live and the brand verifies, the escrow releases the same day.
   Creators don't carry net-60 receivables. Brands don't run an AP
   process. The marketplace pays out.

3. **Every closed deal becomes a public receipt.** The brand's logo,
   the deal size band, the deliverables, the date, the verification
   status — pinned to the creator's storefront permanently. New brands
   reading a creator's storefront see actual history, not a media kit.
   That's the trust primitive.

---

## 4. Who it's for

### 4.1 Creators

The wedge is **mid-tier independent creators (10k-500k followers)** who
are too big to ignore and too small to retain a manager. They're
running a real business with no infrastructure. Specifically:

- **Solo operators** (no manager, no agent) doing 5-30 brand deals/year
- **Niche creators** (B2B, finance, sport, food) where the brand
  audience is more valuable than raw reach
- **Emerging full-timers** in the messy middle — making $30k-200k/year
  on brand deals, would make 2x with better infrastructure

Why these creators: agency representation isn't economic at this tier
(agents need $5k+ deal sizes to justify the take), but the deal volume
is real, the cash-flow pain is acute, and there's no incumbent. We
expand up-market as the storefront receipt stack compounds.

### 4.2 Brands

The wedge is **growth teams at digitally-native consumer companies** —
DTC, SaaS, fintech, marketplaces, consumer apps — running performance-
oriented creator programs. Specifically:

- Teams running **10-100 creator deals/quarter**, not the one-off
  brand-campaign teams running 2-3 mega-deals/year
- **In-house growth marketers** who already do paid acquisition and
  understand unit economics
- **Performance-led teams** that need closed-loop attribution and don't
  trust the agency reporting layer

Why these teams: they already have the operational maturity to run
creator marketing as a channel, but they're paying agency middleman
rates because the alternative is unmanageable. We give them the
alternative. As volume compounds, we move up to enterprise.

### 4.3 The two-sided economics

A platform that's 5% to the brand and 0% to the creator (creator
receives 100% of the agreed brief budget; brand pays brief budget +
5%) is a fundamentally different value proposition on each side:

- For the brand: **20-25% cheaper than agency-managed**, with faster
  deal cycles and direct creator relationships
- For the creator: **higher take-home per deal**, 4-day payout vs
  net-60, and a storefront that compounds into demand

---

## 5. What we built

The product is structured as **two paired workspaces** sharing a single
contracting layer. The same deal lives in both — synchronized in real
time — with surfaces sized to each side's job-to-be-done.

### 5.1 Brand workspace

Top-level navigation (left rail in the live product):

- **Home** — needs-you queue (action items requiring brand decision:
  applications to review, content to verify-live, wallet top-ups due,
  contracts to countersign), recent campaign activity, pipeline health
- **Spark** — AI assistant for drafting briefs from a goal description.
  Turns "I want to launch our protein bar to female endurance athletes"
  into a structured brief with budget, deliverables, target creator
  profile, success metrics
- **Discover creators** — search + filter the creator catalog by
  audience demographics, content category, past brand work, deal size
  history, verification status
- **My campaigns** — kanban of every active brief, grouped by stage
  (drafting, live, in production, wrapping up, closed)
- **Inbox** — three-pane chat (threads / messages / deal panel) with
  every creator in the pipeline. The deal panel surfaces the contract
  state, the escrow status, the deliverable checklist, the live links
- **Calendar** — every deadline across every active deal in one view
- **Analytics** — campaign-level + creator-level performance, ROI,
  audience-fit scoring
- **Wallet** — escrow balance, recent fundings, payouts, the audit
  trail
- **Brand profile** — verification status, team members, public-facing
  brand page

### 5.2 Creator workspace

Top-level navigation:

- **Home** — today's actions (offers awaiting response, content due,
  payouts incoming, new opportunities matching saved filters)
- **My storefront** — the creator's public page. Pinned closed deals,
  bio, rate band, audience snapshot, contact CTA. This is the
  flywheel — every closed deal feeds back in
- **My collaborations** — every deal in flight, grouped by stage
- **Browse campaigns** — search the live brief catalog. Filter by
  budget, deliverables, category, deadline. Save briefs to come back to
- **Inbox** — mirror of the brand-side inbox, persona-aware
- **Calendar** — every content deadline + payout date
- **Analytics** — performance across closed deals, audience health,
  earnings trends
- **Wallet** — payout history, withdrawal methods, tax docs
- **KYC & Tax** — identity verification + tax-form collection. Required
  before first payout. Step-gated wizard so it never blocks discovery

### 5.3 Shared infrastructure (the contracting layer)

Both workspaces sit on top of a single shared system:

- **Deal state machine** — every collaboration moves through a fixed
  set of stages: `invited → applied → offered → accepted → in
  production → submitted → revisions → live → verified → paid`. Each
  stage is a database state with rules for who can advance it and what
  side effects fire (escrow movements, notifications, audit log
  entries)
- **Escrow ledger** — brand-funded balances per campaign, locked on
  offer acceptance, released on verification. Full double-entry
  bookkeeping
- **Real-time messaging** — Supabase Realtime channels per
  conversation; both sides see typing indicators, read receipts, deal-
  state changes in the same view
- **Notifications** — every state change generates a notification with
  a deep-link back to the action point. Cross-tab synchronized
- **Public storefronts** — every creator has a public-facing page at a
  stable URL. Closed deals appear automatically as receipt cards
- **Audit log** — every contract state change, every payment, every
  message is immutable and append-only. Auditable by both parties

---

## 6. How a deal actually flows

A canonical campaign, end to end, from a brand's perspective:

1. **Brand drafts a brief** in Spark (or from scratch). Defines goal,
   budget, deliverables (e.g., "1 Instagram reel + 3 stories"), target
   creator profile, content guidelines, deadline
2. **Brand funds the campaign budget into escrow** from their wallet.
   This is the moment the brief becomes "live" — it cannot be posted
   without funded escrow
3. **Discovery** happens both ways. The brand can directly invite
   creators (from Discover) — those invites land in the creator's inbox
   as an offer. Or the brand can post the brief publicly to the Browse
   Campaigns feed — creators apply
4. **The brand reviews applications**, advances the strongest to an
   offer (with a proposed deal value pulled from the campaign budget)
5. **The creator accepts** (or counters with a different value /
   deliverables). On acceptance, that creator's slice of the campaign
   escrow is locked
6. **Production begins**. The creator drafts content, shares with the
   brand for review in the deal-panel side of the inbox. Revisions
   happen in-thread
7. **The creator marks content live**, pasting the public URLs. The
   brand verifies (or requests changes)
8. **On verification, escrow releases instantly** to the creator's
   wallet. The deal moves to "closed" and a receipt card is pinned to
   the creator's public storefront
9. **The brand can re-engage** the creator on a new campaign with one
   click. The history compounds

**Total elapsed time on a clean deal**: 8-15 days versus the industry
standard of 8-12 weeks. The compression comes from removing serial
handoffs — no agency-in-the-middle, no AP cycle, no contract redlines
(the contract is the platform's terms-of-service, signed on signup).

---

## 7. The trust layer

This is the section that earns the right to call the product a
marketplace primitive rather than a feature. Each of these is
engineered into the system, not bolted on:

### 7.1 Escrow on every deal

Money moves through the platform's ledger, not direct from brand to
creator. The brand funds escrow before posting. The creator's payout is
guaranteed by the platform from the moment the offer is accepted —
they're not chasing an invoice on net-60 anymore.

Mechanically: brands top up their wallet with verified payment methods.
Campaign creation locks a portion of that balance. Offer acceptance
locks the creator's specific slice. Verification triggers an atomic
ledger transfer to the creator's wallet. The creator can withdraw
instantly to their verified bank account.

### 7.2 KYC + tax compliance

Creators complete KYC + tax-form collection (W-9 / W-8BEN equivalents)
before the first payout. This is what unlocks the "we are the
contracting party" model — the platform can issue tax documents to
both sides, eliminating the brand's AP burden entirely. The KYC flow
is step-gated so it never blocks discovery or browsing — it gates
withdrawal, not exploration.

### 7.3 Verified brand badges

Brands go through their own verification (business documents, payment
method, optional brand-team review). Verified status appears as a
badge in inbox, on briefs, in discovery. New creators evaluating an
offer can tell at a glance whether they're talking to a real company.

### 7.4 Closed-deal receipts (the moat)

Every closed deal generates a permanent, public, immutable receipt card
on the creator's storefront. The card carries:

- The brand's logo + verified status
- The deal value band (precise number optional; band shown by default)
- The deliverables
- The completion date
- A snippet from the brand's optional testimonial

Why this is the moat: discovery for a new creator on any platform is
"can I trust your media kit?" Discovery for a creator on Alamut is
"here are 23 closed deals with verified brands, with verified
deliverables, with verified payouts." A platform like ours could be
copied. The accumulated public receipt history of every creator on the
platform cannot — and it gets stronger every week the platform is
alive.

### 7.5 Audit log + dispute infrastructure

Every action on a deal is timestamped and append-only. If a dispute
arises, both sides have a complete record of what was agreed, when
content was delivered, what was approved, when payment moved.
Operations team can step in with the full context, not a he-said-she-
said reconstruction from screenshots.

---

## 8. The economics

The pricing model is intentionally radical, because the unit economics
of the agency stack are what we're displacing.

### 8.1 The fee

- **5% take rate, charged to the brand** (creator receives 100% of the
  agreed deal value)
- **No retainer**, no SaaS subscription, no per-seat
- **No fee on the creator side** — payout is instant and complete

Comparison to the alternatives:

| Path | Brand pays | Creator nets |
|---|---|---|
| Agency-managed | $10,000 brief budget + $2,500 fee (25%) | $7,500 (after agent cut) on net-60 |
| Direct + ops | $10,000 + $1,000 internal ops | $10,000 on net-60 |
| **Alamut** | **$10,000 + $500 fee (5%)** | **$10,000 same-day** |

The creator earns more. The brand pays less. The platform takes 5%.
The number this displaces is the agency margin, not the creator margin.

### 8.2 Why a flat 5% holds up

A common objection: "won't a flat 5% race-to-zero?" Three reasons it
won't:

1. **Infrastructure costs justify it.** Escrow, KYC, tax issuance,
   real-time messaging, dispute ops, storefront hosting — these are not
   free, and 5% of a $10k deal is $500, which funds them comfortably
2. **The receipt stack is the lock-in.** A creator who has 50 closed
   deals on Alamut can't move to a 3% competitor without losing the
   storefront that drives 60% of their inbound
3. **Up-market expansion compounds.** A 5% take on a $100k brand deal
   is $5k — and the brand-side infrastructure (multi-seat workspaces,
   campaign analytics, attribution) is what unlocks those deals. The
   take rate is constant; the deal size grows

### 8.3 The cash-flow story for creators

If a creator does $80k/year in brand deals on Alamut versus the
industry-standard net-60:

- **Receivables-eliminated**: $13.3k of revenue is no longer trapped in
  AR cycles at any given moment
- **Time-to-cash on a new deal**: 4 days vs ~67 days. That's a 16x
  improvement in working-capital velocity
- **Effective annual hourly rate**: rises ~20% just from not chasing
  invoices

For creators considering hiring a manager or going full-time, this is
the difference between "I might have to wait" and "I know when I'm
getting paid."

---

## 9. Why now

Three macro forces converge:

1. **The agency tax has become indefensible.** Creator marketing went
   from experimental to performance-channel inside 5 years. Growth
   teams that wouldn't accept 25% margin loss on paid social are
   accepting it on creator. The contradiction is breaking
2. **Creators have professionalized faster than their infrastructure.**
   The mid-tier creator running 30 brand deals/year is a real business
   running on personal Venmo and Google Docs. The tooling gap is wider
   every quarter
3. **Stripe-class fintech primitives finally make instant payouts +
   escrow + KYC composable.** What would have been a 3-year
   infrastructure build in 2018 is a 6-month build on top of modern
   primitives in 2026. The technical moat has moved from infrastructure
   to network

---

## 10. The moat (compounding loops)

Two flywheels compound, and they reinforce each other:

### 10.1 The receipt flywheel (creator side)

A creator closes a deal → receipt pins to storefront → new brands
browsing the creator find the receipts → more inbound offers → more
closed deals → more receipts. Every week the platform is alive, the
average creator's storefront becomes harder to leave behind.

### 10.2 The contracting flywheel (brand side)

A brand runs a campaign through Alamut → ops cost drops 10x → they
run more campaigns → they develop a roster of creators they've
worked with on-platform → re-engagement is one click → switching to a
competing platform means rebuilding the roster + relationship history.

### 10.3 The cross-side flywheel

Brands attract creators (because creators want deal flow). Creators
attract brands (because brands want vetted talent with proof of work).
The marketplace gets denser, the matching gets better, the average
deal closes faster. Standard marketplace dynamics, except the receipt
substrate makes the density visible — and visible density is what
breaks the cold-start problem for new entrants.

---

## 11. Tone + brand voice

Pulling from the in-product copy and landing-page voice. The brand is:

- **Editorial, not corporate.** We sound like a serious trade
  publication writing about ourselves — not like a startup explaining
  itself
- **Receipts-first.** When we make a claim, we surface the evidence.
  The product is built around this, the copy should reflect it
- **Operator-aware.** We're talking to people who run things — growth
  marketers, creators-as-CEOs. They want sharp specifics, not
  inspirational fluff
- **Confident-quiet.** We don't shout. The work speaks. The
  contradiction we're resolving (agency speed AND direct margin) is
  itself the headline

### Pull quotes the designer can use

These are voice-true, deck-ready lines pulled or distilled from the
product copy:

> "Alamut is rewriting the playbook on creator-brand contracting —
> escrow on every deal, a flat 5% fee, no retainer."

> "What Shopify did for direct-to-consumer commerce, Alamut is quietly
> doing for influencer marketing — flatten the supply chain, surface
> the receipts, get out of the way."

> "Brands are running three campaigns through Alamut where they'd run
> one with an agency."

> "Creators with 10k followers closing $2k deals, brands paying out in
> four days, no agencies in sight. The receipts are public for the
> first time."

> "Their bet — that creators want autonomy and brands want speed — is
> paying off. The closed-deal receipts on every storefront are the
> moat. You can't fake those."

> "When escrow is built into the marketplace primitive, a 12-week
> brand-creator deal cycle compresses to 12 days. That's a full quarter
> of campaign throughput, recovered."

> "Brand-side teams used to pick between agency speed and direct-
> creator margin. Alamut quietly resolves the tradeoff by making the
> marketplace itself the contracting layer."

### Words we use

Marketplace primitive · contracting layer · take rate · receipts ·
escrow-funded · on-platform · throughput · deal cycle · audit trail ·
storefront · pipeline · brief · countersign · payout · verification ·
flywheel.

### Words we avoid

Disrupt · revolutionary · best-in-class · synergy · empower (the
verb) · solutions · ecosystem (for the company) · influencer
marketing (we say "creator marketing" or "brand-creator deals"
instead).

---

## 12. Visual / UI vocabulary

For the designer translating screens into deck visuals, the product's
visual language is:

- **Editorial-magazine layout** — generous whitespace, large display
  type, restrained color
- **Paper-warm neutrals** with a single accent (rust-orange `#c5552b`).
  Not "tech blue"
- **Mono-spaced metadata** — dates, version numbers, IDs render in
  monospace as a tell of trust + precision
- **Receipts-as-cards** — every closed deal looks like an artifact, not
  a list row. Logo + amount band + date + verification badge
- **Two-tone workspace chrome** — left rail is one color, main canvas
  is another, separated by a hairline. The pattern repeats across both
  brand and creator surfaces
- **No emoji, no illustration of cartoon people.** Abstract marks,
  initials, real product screens

---

## 13. Suggested deck flow (15-slide spine)

A working outline the designer can adapt. Each slide title is the
takeaway the audience should walk away with — not a topic label.

| # | Slide takeaway | Source section |
|---|---|---|
| 1 | "The marketplace where brand-creator deals close in 12 days, not 12 weeks." | §1 |
| 2 | "Brand-creator deals today run on spreadsheets, DMs, and net-60 invoices." | §2 |
| 3 | "The middle layer is the contract. That's the bet." | §3 |
| 4 | "Two paired workspaces. One shared contracting layer." | §5.1, §5.2, §5.3 |
| 5 | (Brand workspace screen, annotated) — "What the growth team sees" | §5.1 |
| 6 | (Creator workspace screen, annotated) — "What the creator sees" | §5.2 |
| 7 | "Every deal moves through one state machine. Escrow follows automatically." | §6 |
| 8 | "Trust is structural, not negotiated." (escrow + KYC + verification + audit log, four-up) | §7 |
| 9 | "Closed deals leave permanent public receipts. That's the moat." (storefront mockup with receipt cards) | §7.4 |
| 10 | "5% to the brand. Zero to the creator. Same-day payout." (the economics comparison table) | §8 |
| 11 | "16x faster time-to-cash for creators. 25% lower take for brands." | §8.3 |
| 12 | "Two flywheels. They reinforce each other." | §10 |
| 13 | "Why this only works in 2026, not 2020." | §9 |
| 14 | (Product roadmap or what's been built — depends on audience) | — |
| 15 | One-line closer + ask | §1 |

For an investor-specific cut, slides 14-15 become traction + ask +
team. For a brand-prospect or creator-prospect deck, they become "how
to get started."

---

## 14. Things explicitly out of scope for this brief

(So nothing surprises in revisions:)

- Specific traction numbers, revenue, retention curves — request these
  separately when the deck audience requires them
- Cap-table / funding-round structure
- Roadmap dates and quarterly commitments
- Team bios — slot in separately
- Competitive landscape with named competitors (the brief positions
  against *categories* — agencies, first-gen marketplaces, direct DMs —
  not against named platforms). For investor decks, a competitive
  matrix is usually a separate slide

---

## 15. Quick reference — the numbers and claims that ARE in the product

These are baked into product copy, surfaces, or unit economics
already, so they're safe to use in any deck:

- **5% flat take rate**, charged to brand
- **0% creator-side fee**
- **Same-day payouts** on verification (industry: net-60 to net-120)
- **~12-day end-to-end deal cycle** on a clean campaign (industry:
  8-12 weeks)
- **3x campaign throughput** for brands vs agency-managed
- **Public closed-deal receipts** on every creator storefront
- **Escrow funding required** before brief goes live
- **KYC + tax issuance** built in (W-9 / W-8BEN equivalent)

---

*End of brief. Hand this off — every section is sized for a slide or a
section divider. The pull quotes in §11 are deck-ready. The 15-slide
spine in §13 is the suggested narrative arc; the designer should feel
free to compress or expand sections based on time-in-room.*
