# Alamut — Product Requirements Document (PRD)
**A marketplace + CRM platform connecting brands with content creators for sponsored collaborations — Pakistan-first, globally scalable.**

---

## TL;DR
- **Build Alamut as a Passionfroot-style two-sided marketplace + CRM** with creator storefronts, brand discovery, AI-assisted campaign planning ("Spark"), conversational inbox, and an escrow wallet — but localized for Pakistan with JazzCash, Easypaisa, Raast, NADRA-based KYC, and FBR-compliant tax handling, then expanded globally via Stripe Connect.
- **The recommended stack is Next.js 14 + TypeScript on Vercel for the front end; NestJS (Node 20) on AWS Karachi/Mumbai region for the API; PostgreSQL 16 with pgvector for primary data and semantic creator search; Redis + BullMQ for queues; Typesense for keyword/faceted discovery; Pusher (later self-hosted Soketi) for realtime chat; and Anthropic Claude Sonnet for the Spark agent with tool calling.** A custodial wallet built on a double-entry ledger settles funds via JazzCash/Easypaisa REST APIs (PKR) and Stripe Connect (USD).
- **Phase the rollout in five stages over ~18 months**: (1) Foundation = storefronts + discovery + inbox; (2) Campaigns + PKR payments + KYC; (3) Spark AI planner + analytics; (4) Global scaling on Stripe + multi-currency; (5) Native mobile apps + agency/multi-brand tooling. The biggest risks to plan against are SBP PSO/PSP licensing scope (mitigated by partnering with a licensed PSP rather than holding funds directly at launch), fake-creator fraud (mitigated by NADRA Verisys + social-graph verification), and the new FBR SRO 545/546 (2026) tax-withholding regime on creator income (mitigated by automated 5% WHT deduction at payout and digital tax certificates).

---

## SECTION A — STRATEGIC PRODUCT PRD

### A.1 Executive Summary

**Vision.** Alamut is the operating system for Pakistan's creator economy: a marketplace where brands discover, hire, manage, pay, and measure content creators across every platform (Instagram, TikTok, YouTube, LinkedIn, Newsletter, Podcast, X) — and a CRM where creators run their entire sponsorship business from a single inbox.

**Problem.** Pakistan's influencer marketing is a ~US$13.5M ad-spend market in 2025 (Statista), growing at ~11% CAGR with 70M+ social media users and 60M+ TikTok users — yet the workflow is broken. Brands rely on WhatsApp groups, agencies that mark up 30–50%, and Excel sheets. Creators are paid late or in cash, can't prove audience demographics, and have no protected escrow. Internationally, Passionfroot, Aspire, Grin and Modash solve this for US/EU brands but cannot pay creators in PKR, do not integrate JazzCash/Easypaisa, and do not handle FBR tax compliance.

**Solution.** A unified, AI-native platform with six tightly coupled surfaces:
1. **Creator Storefronts** — block-based public pages with packages, channels, prices, past collabs.
2. **Discovery Engine** — searchable, scored, semantic database of creators with audience analytics.
3. **Campaign Management** — lifecycle (Planned → Active → Completed) with deliverables, tasks, budget tracking.
4. **Inbox** — unified messaging with collaboration side-panel, attachments, AI assistant.
5. **FrootWallet-equivalent ("Alamut Wallet")** — escrow with JazzCash/Easypaisa top-up, milestone release, automated tax deduction.
6. **Spark AI Planner** — conversational campaign builder ("Find me 30 LinkedIn creators in Pakistan with 20K+ HR-professional audiences for $5K") that proposes plans, refines via chat, and triggers bulk outreach.

**Target market.** Phase 1: Pakistani SMBs, D2C e-commerce brands (Sapphire, Khaadi, Daraz sellers), SaaS startups, and agencies; Phase 4: South Asia (Bangladesh, Sri Lanka), GCC, then global B2B/SaaS brands like Passionfroot's existing clientele.

**Competitive positioning.** "Passionfroot for South Asia." Unlike Walee (agency-led, opaque), Bradri (small network), and global tools (no PKR rails), Alamut combines a self-serve marketplace + CRM + AI planner + locally compliant wallet. Take rate: 10% on network-sourced deals (vs. Passionfroot's 15%), 5% on direct deals, plus tiered SaaS subscriptions for brands.

### A.2 Problem Statement

**Brand-side pains (validated against interviews and 2025 market data):**
- Creator discovery is manual: scrolling Instagram, asking agencies, no way to filter by audience demographics or topical relevance.
- No price discovery: a 50K-follower Pakistani fashion creator's rate can vary from PKR 15K to PKR 200K with no benchmark.
- Outreach is one-by-one DM/WhatsApp, with ~15–20% response rates and no tracking.
- Payments are friction-heavy: bank transfers require IBAN, invoices, and 5% withholding tax compliance under FBR's 2026 SRO 545/546 regime.
- Fraud is rampant: fake followers, ghost engagement, no-show creators after partial payment.
- ROI is opaque: no centralized impressions/engagement/CPM tracking.

**Creator-side pains:**
- Brands ghost mid-deal; no escrow protection.
- Creators receive dollar payments via Payoneer/Wise that incur FX losses, or PKR cash without documentation needed for FBR filings.
- No professional storefront — DMs drown sponsorship inquiries.
- No CRM: collab history, deliverable deadlines, payment status all in WhatsApp.
- Agencies take 30–50% cuts.
- After FBR SRO 545/546 (April 2026), creators with >50K subscribers must register, file quarterly advance tax, and have their income benchmarked against an Rs. 195/1000-views formula — an administrative burden Alamut can automate.

### A.3 Market Analysis

**Pakistan creator economy (2025–2030):**
- Influencer ad spend: US$13.49M (2025) → US$22.89M (2030) at 11.16% CAGR (Statista).
- 70M+ social-media users; 60M+ TikTok; 70M+ YouTube reach; 57% internet penetration.
- 65% of population under 30; PTA reports creator-economy as fastest-growing youth career path.
- Top spenders: FMCG (Nestlé, Unilever), telecoms (Jazz, Ufone), banks (HBL, Meezan), fashion (Sapphire, Khaadi, Outfitters), e-commerce (Daraz, Foodpanda), mobile (Samsung, Infinix), edtech.

**Global TAM.** Global influencer marketing reached ~US$32.55B in 2025 (Influencer Marketing Hub). Creator-economy TAM projected at US$480B by 2027 (Goldman Sachs).

**Competitor landscape:**

| Competitor | Model | Pricing | PKR support | Strengths | Weaknesses for Pakistan |
|---|---|---|---|---|---|
| Passionfroot | Creator-first storefront + AI agent (Zest) + ad network | Free for creators; 5% direct / 15% network | None | Best-in-class UX, B2B focus, AI agent | No PKR rails, no local creators |
| Aspire | Creator marketplace + Shopify integrations | ~$2,300/mo + onboarding | None | 1M+ creator marketplace, gifting | Enterprise pricing, US-centric |
| Grin | Pure CRM + Shopify | ~$2,500/mo, annual | None | E-commerce attribution | Discovery weak, no Pakistan creators |
| Modash | Discovery DB (380M profiles) | $199–$599/mo | Limited | Massive DB, transparent pricing | Discovery-only, no payments rails |
| Upfluence | All-in-one + Amazon attribution | Custom, $2K+/mo | No | Affiliate tracking | Costly, smaller DB |
| CreatorIQ | Enterprise OS | Custom, 5-figure | No | Brand-safety, large global teams | Overkill for SMB |
| Walee (PK) | Agency + tech | Custom | Yes | Local relationships, 50K+ creators registered | Agency-mediated, opaque, weak self-serve UX |
| Bradri (PK) | Network/community | Project-based | Limited | Local creator community | Small, no AI/CRM |
| Topline PR (PK) | Agency | Project | Yes | Celebrity access | Pure services, no platform |

**White-space.** No competitor offers a self-serve Pakistani marketplace + CRM + AI planner + JazzCash/Easypaisa escrow. This is Alamut's wedge.

### A.4 Target Users & Personas

**Brand Personas**

1. **"Sara, Marketing Lead at a Karachi D2C fashion brand"** — 28, manages PKR 500K–2M monthly creator budget across 20–50 micro-influencers. JTBD: "Find Karachi/Lahore fashion creators with female 18–34 audiences, ship them sample products, track Instagram Stories, pay in PKR within 48 hours of delivery." Currently: Excel + WhatsApp groups + manual JazzCash transfers. Pain: cannot prove ROI, fake followers, late delivery.
2. **"Ahmed, Growth Manager at a Pakistani SaaS startup (e.g., fintech)"** — 32, B2B audience, US$3K–10K monthly budget, mostly LinkedIn + Newsletter sponsorships. JTBD: "Find Pakistani CFOs/founders building thought leadership; sponsor their newsletters and LinkedIn posts; track inbound leads." Currently: Cold DMs + agency. Pain: no creator data, hard to negotiate, payment friction.
3. **"Priya, Head of Influencer at a global beauty brand entering Pakistan"** — 35, in Singapore, runs APAC. Budget: US$50K/quarter for Pakistan. JTBD: "Run a regional campaign with 50 Pakistani micro-influencers without setting up a local entity; pay them in PKR; meet KYC and tax compliance." Currently: hires a Pakistani agency at 30% markup. Pain: no transparency, slow.

**Creator Personas**

1. **"Hira, lifestyle nano-influencer in Lahore"** — 22, 8K Instagram followers, charges Rs. 5K–15K/post. JTBD: "Get discovered by local fashion brands without DMing them; get paid securely on JazzCash; build a portfolio of past brand collabs."
2. **"Bilal, mid-tier B2B creator on LinkedIn + Newsletter"** — 31, 45K LinkedIn + 8K newsletter, charges $500–$2,000 per sponsorship; works with global SaaS clients via Passionfroot today. JTBD: "Centralize US$/PKR income; comply with FBR; reduce DM clutter; offer multi-product bundles."
3. **"Zenith, top-tier YouTuber/travel creator"** — 28, 500K YouTube + 200K Instagram, charges PKR 300K–800K per integration. JTBD: "Have a professional storefront; gate inbound requests with a brief; manage a team; protect against ghosting brands; one ledger for taxes."

### A.5 User Journeys & Flows

**Brand journey (end-to-end):**

```
Sign up → Workspace setup → Onboarding (industry, budget, ICP)
   │
   ▼
Discovery (search/filters) ──or──► Spark AI ("plan a $20K LinkedIn campaign")
   │                                    │
   │                                    ▼
   │                         Spark proposes 30 creators + budget table
   │                                    │
   ▼                                    ▼
Shortlist creators ─────────► Create Campaign (name, budget, brief)
   │                                    │
   ▼                                    ▼
Send outreach (bulk) ◄───── Review outreach (preview, edit, response-rate prediction)
   │
   ▼
Negotiate in Inbox ──► Lock terms (placement, deliverables, price, milestones)
   │
   ▼
Top up Wallet (JazzCash/Easypaisa/Raast/Card) → Funds locked in escrow
   │
   ▼
Creator submits draft → Brand approves → Goes Live
   │
   ▼
Brand verifies live → Wallet auto-releases payment (minus 5% WHT, platform fee)
   │
   ▼
Reporting (impressions, engagement, CPM, ROI) → Export → Pay tax certificate
```

**Creator journey:**

```
Sign up → Connect socials (OAuth: Instagram/YouTube/TikTok/LinkedIn) → KYC (CNIC + NADRA Verisys)
   │
   ▼
Build storefront (blocks: channels, packages, gallery, about, past collabs)
   │
   ▼
Publish → /alamut.pk/@hira ── shareable
   │
   ├──► Inbound: Brand books "Sponsored Reel — Rs. 25K"  ──┐
   ├──► Apply to live campaigns from Discover tab          │
   └──► Receive Spark-mediated outreach                    │
                                                            ▼
                                                  Negotiate in Inbox
                                                            │
                                                            ▼
                                              Accept → Sign contract → Deliver
                                                            │
                                                            ▼
                                Brand approves → Wallet credit (PKR, minus WHT/fees)
                                                            │
                                                            ▼
                                          Withdraw to JazzCash / Easypaisa / Bank (Raast)
```

### A.6 Detailed Feature Specifications

**1. Creator Storefront Builder.** Block-based editor (drag-drop). Block types:
- **Channels** (Instagram, TikTok, YouTube, LinkedIn, Newsletter, Podcast, X) — auto-pulled follower counts via OAuth.
- **Products & Packages** — Single product (e.g., "Sponsored Reel — Rs. 25K"), Product bundle (3 stories + 1 reel), Multi-product bundle (cross-platform).
- **Brand Collaborations** — past collabs with brand logos and outcomes.
- **Images** — About my audience (demographics infographic), Sponsorship example (case-study card), Gallery.
- **Text** — About me, What I need from you, My workflow.
- **Links** — external URLs.
Public URL `alamut.pk/@username` with SEO meta tags, Open Graph image, schema.org Person markup. Mobile-responsive, custom theme colors (cream/orange/green default palette inherited from Passionfroot aesthetic).

**2. Brand Onboarding & Workspace.** Multi-step signup: company name → website → platforms of interest → monthly budget (PKR/USD toggle) → industry → how-they-found-us → invite teammates. Workspace = multi-tenant org with members, roles, shared wallet, shared campaigns.

**3. Discovery Engine.** Searchable creator DB filtered by:
- Topic / niche (semantic search via pgvector embeddings of creator bio + recent content).
- Platform, follower band, engagement rate, open rate (newsletter), CTR.
- Top audience locations, age/gender, language.
- Categories, price range (PKR & USD), "New to me", "Recently added".
- Each card: Alamut Score (0–100, composite of engagement, growth, fit), price tier ($–$$$$), top metrics.
Saved searches, daily-digest emails of new matches.

**4. Campaign Management.** Lifecycle:
- **Planned** → drafting outreach (auto-archive after 7 days inactivity).
- **Active** → at least one creator confirmed (auto-archive after 15 days inactivity).
- **Live** → content posted; never auto-archived.
- **Completed** → all deliverables done.
Campaign detail page shows: Filters/Display | Budget / Est. Spend / Confirmed / Paid / To-allocate counters | Tasks / Negotiating / Confirmed / Live posts / Submitted reports counters | creator table with Placement and Stage columns. Briefs in rich text + file attachments.

**5. Inbox & Messaging.** Unified per-workspace inbox. Conversation list (left), message thread (center), Collaboration side-panel (right) showing status, placement, deliverables, payment progress. Attachments (S3-signed URLs), proposal cards, contract PDFs, payment-request cards. **Conversation Assistant Agent** (Claude-powered) flags "Follow-up needed", "Review content", "Approve deliverable", drafts replies on demand.

**6. Spark AI Campaign Planner (Zest equivalent).** Conversational planner with tool calling:
- Tools: `search_creators(filters)`, `score_audience_fit(creator_id, ICP)`, `estimate_budget(creators, deliverables)`, `save_campaign_plan(plan)`, `generate_outreach(creator_id, campaign)`, `send_outreach(creator_ids, message_templates)`.
- Persona: brief-collector → list-curator → budget-optimizer → outreach-drafter.
- Sample interaction: "Find me 30 Pakistani LinkedIn creators talking about HR with 20K+ followers. Budget: $5K." → proposes table with Creator | Audience breakdown | Impressions | Engagements | CPM | CPE | Price | actions (remove, swap). User: "Trim to fit $4K." → re-optimizes. User: "Send outreach." → opens "Review outreach before sending" modal with response-rate predictions and per-creator preview.

**7. Outreach & Application System.** Bulk outreach with templated messages, response tracking. Per-creator: response-rate prediction ("<48hr · ~70%"), edit message, exclude. Application flow (creator → brand): Sent → Saved for later → Accepted / Declined. Live campaigns appear on creator-facing /campaigns discover page; creators apply with pitch.

**8. Payments & Wallet.** **Alamut Wallet** is custodial escrow:
- **Top-up** via JazzCash Mobile Account, Easypaisa, Raast (1GO P2M QR), bank transfer (1LINK IBFT), debit/credit card (via JazzCash/Easypaisa hosted checkout); USD via Stripe.
- **Hold** in escrow when creator accepts deal; visible balance, in-flight, reserved, available.
- **Release** on milestone (manual approval or auto on deliverable verification). Auto-deduct: 5% FBR WHT (digital creator income, per 2025–26 budget), 10% platform fee on network-sourced / 5% on direct, applicable WhatsApp/SMS notifications.
- **Payout** to creator: JazzCash/Easypaisa wallet (instant), bank Raast (instant), or USD Stripe Connect Express (international creators).
- **Reconciliation** via webhooks (JazzCash IPN, Easypaisa IPN, Stripe events).

**9. Reviews/Ratings & Trust.** Mutual post-collab reviews (1–5 stars + text). Creator score = composite of engagement quality, on-time delivery, brand reviews, fake-follower score, NADRA-verified badge. Brand verification: NTN + domain DNS + payment-method verified. Dispute flow: 7-day dispute window; Alamut mediation; arbitrator can refund, partial-release, or release-with-warning.

**10. Analytics & Reporting.** Per-campaign dashboard: spend, impressions (pulled via social APIs), engagements, CPM, CPE, ROI (if tracked link/promo code), creator performance ranking. Per-creator: lifetime stats. Exportable CSV/PDF; "FBR Tax Certificate" downloadable per fiscal year.

**11. Notifications.** Multi-channel:
- In-app (websocket).
- Email (Resend, transactional templates).
- WhatsApp Business API (for high-priority: payment received, deliverable due, message from brand) — via local BSP (WeTarseel/Convex Interactive at ~PKR 1.80–2.50/utility message).
- SMS (Twilio fallback or local provider for OTP).
Per-channel preferences in settings.

### A.7 Roles & Permissions Matrix

| Capability | Brand Owner | Brand Admin | Brand Member | Creator | Creator Manager | Alamut Admin |
|---|---|---|---|---|---|---|
| Create campaigns | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ |
| Apply/enrol in campaigns | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| Edit storefront | ❌ | ❌ | ❌ | ✅ | ✅ (with permission) | ✅ |
| View workspace billing | ✅ | ✅ | ❌ | n/a | n/a | ✅ |
| Top up wallet | ✅ | ✅ | ❌ | n/a | n/a | ✅ |
| Approve payouts | ✅ | ✅ | ❌ | n/a | n/a | ✅ |
| Send outreach | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ |
| Invite team | ✅ | ✅ | ❌ | ✅ (own org) | ❌ | ✅ |
| Withdraw funds | n/a | n/a | n/a | ✅ | ❌ | ✅ |
| Resolve disputes | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Access KYC docs | ❌ | ❌ | ❌ | ❌ (own only) | ❌ | ✅ (audit) |

### A.8 Pricing & Business Model

**Brand subscriptions (PKR / USD):**
- **Free** — 1 active campaign, 25 outreach/mo, basic discovery, 10% transaction fee.
- **Starter** — PKR 15,000/mo (~$50) — 5 campaigns, 250 outreach/mo, Spark AI (50 prompts/mo), 8% fee.
- **Pro** — PKR 50,000/mo (~$170) — unlimited campaigns, 1,500 outreach/mo, Spark unlimited, 6% fee, multi-seat (5 members), priority support.
- **Enterprise** — Custom — agencies, multi-brand workspaces, SSO, custom contracts, 4% fee.

**Creator side** — Free to set up storefront; Alamut takes 5% on direct booking (creator pays), 10% on Alamut-sourced (Spark/Discovery) deals — competitive vs. Passionfroot's 15%.

**Other revenue:** featured creator placements (PKR 5K/week boost), premium analytics for top creators (PKR 2K/mo), agency white-label (custom).

**Unit economics target.** Average campaign GMV: PKR 80K. Take rate blended: ~9%. Contribution margin per campaign: ~PKR 5K after payment processing (~1.5%) and infra costs.

### A.9 Success Metrics / KPIs

- **North Star:** Monthly GMV (PKR processed through Alamut Wallet).
- **Activation:** % of brands that complete first campaign within 14 days; % of creators that publish storefront within 7 days.
- **Engagement:** Weekly Active Brands, Weekly Active Creators, messages/week.
- **Retention:** Brand 90-day GMV retention; creator 90-day storefront-bookings retention.
- **Marketplace health:** Liquidity ratio (campaigns matched within 48h ÷ campaigns posted); response rate on outreach (target >35% by Spark mediation).
- **Take rate:** blended platform fee % (target 8–10%).
- **Trust:** Dispute rate (<2% of campaigns), creator-verification rate (>70% NADRA Verisys).
- **AI impact:** % of campaigns originating from Spark; lift in response rate when Spark suggests vs. cold outreach.

### A.10 Go-to-Market Strategy

**Phase 1 — Pakistan launch (months 0–6):**
- Seed 500 creators across Karachi/Lahore/Islamabad via founder-led outreach + creator referral bounty (PKR 2K per onboarded creator who completes 1 collab).
- Pilot with 30 Pakistani SMBs and 5 D2C brands (Sapphire/Khaadi-tier waitlist) — free Pro tier for 6 months in exchange for case studies.
- Content: SEO-optimized blog ("Top fashion influencers in Karachi 2026"), creator interviews, FBR tax-compliance toolkit.
- Partnership with Walee/Bradri's competing communities — recruit creators who are tired of agency cuts.
- Launch event in Karachi + Lahore.

**Phase 2 — Pakistan scale (months 6–12):**
- WhatsApp Business outreach to Daraz/Foodpanda/Daraz-seller communities.
- Agency partnerships (offer Enterprise white-label).
- University ambassador program (LUMS, IBA, NUST) for creator-side acquisition.
- Performance marketing on Meta/TikTok ads.

**Phase 3 — Regional + global (months 12–18):**
- Expand to Bangladesh (bKash), Sri Lanka.
- Launch Stripe Connect for global brands hiring Pakistani creators (cross-border).
- Inbound: ProductHunt, target Passionfroot's gap in emerging markets.

### A.11 Roadmap

| Phase | Timeline | Scope | T-shirt size |
|---|---|---|---|
| **P1 — Foundation** | M0–4 | Auth + roles, creator storefront builder, public storefront pages, basic discovery (keyword + filters), inbox (websocket chat), brand workspace | L |
| **P2 — Campaigns + PKR Payments** | M4–8 | Campaign CRUD, outreach (bulk), application flow, Alamut Wallet (JazzCash + Easypaisa + Raast top-up), KYC (NADRA Verisys), milestone-release escrow, FBR WHT automation | XL |
| **P3 — AI + Analytics** | M8–12 | Spark AI planner (Claude tool-calling), pgvector semantic search, Conversation Assistant, analytics dashboard, exportable reports, WhatsApp notifications | L |
| **P4 — Global Scaling** | M12–15 | Stripe Connect Express for international creators, multi-currency wallet, USD pricing, Bangladesh/SL localization, sales-tax handling | M |
| **P5 — Mobile + Agency** | M15–18 | iOS + Android apps (React Native), agency multi-brand workspaces, advanced AI (auto-content-review), API for partners | L |

### A.12 Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| **SBP PSO/PSP licensing scope** | High | Critical | Do not hold customer funds directly at launch — partner with a licensed PSP (e.g., NIFT, Avanza, Foree, or 1LINK) as the regulated entity; Alamut Wallet balances are reflected positions on the partner's account, similar to FINJA's SimSim/FINCA model. Apply for own EMI license once GMV exceeds PKR 200M/year. |
| **FBR SRO 545/546 (2026) creator income tax** | Certain | Medium | Build automated 5% WHT deduction on every payout; issue digital tax certificates; provide creator dashboard showing estimated quarterly advance tax based on RPM benchmark formula. |
| **Fake creator fraud** | High | High | Mandatory NADRA Verisys for payouts >PKR 25K; OAuth verification for connected social accounts; HypeAuditor-style fake-follower detection (reuse open APIs); creator score penalties; community reporting. |
| **Payment disputes** | Medium | Medium | Escrow + 7-day dispute window + admin mediation queue; mandatory contract acceptance before fund release; recorded chat as evidence. |
| **Competition (Walee, agencies)** | Medium | Medium | Out-execute on UX + AI; lower take rate; transparent pricing; no agency markup. |
| **Currency volatility (PKR/USD)** | Medium | Medium | Hedge via short USD holding period; show real-time FX in wallet; charge brands FX spread of 1.5%. |
| **Social platform API changes (Instagram, TikTok)** | High | Medium | Use OAuth for verification only; allow manual screenshot upload as fallback; cache demographics quarterly. |
| **WhatsApp BSP costs** | Medium | Low | Cap WhatsApp to high-priority utility messages; use email for low-priority; negotiate volume tier with BSP. |
| **Regulatory scrutiny on content moderation** | Low | High | NCCIA-aligned content policy; mandatory disclosure tags ("#sponsored"); brand-safety filters in Spark. |

---

## SECTION B — TECHNICAL BUILD SPECIFICATION

### B.1 System Architecture Overview

**Recommendation: Modular monolith → microservices migration path.** Start as a NestJS modular monolith with clearly separated bounded contexts (Identity, Storefront, Discovery, Campaign, Messaging, Wallet, AI, Notifications). Extract to microservices only when scale demands (Wallet first, due to compliance isolation).

```
┌─────────────────────────────────────────────────────────────────────┐
│                          CLIENT LAYER                                │
│  Web (Next.js 14 / React)    Mobile P5 (React Native / Expo)        │
└──────────────┬──────────────────────────────┬───────────────────────┘
               │ HTTPS / WSS                  │
               ▼                              ▼
       ┌────────────────────────────────────────────┐
       │   Edge / CDN (Vercel + Cloudflare)         │
       │   - Static SSG/ISR pages (storefronts)     │
       │   - API edge routing                       │
       └────────────┬───────────────────────────────┘
                    ▼
       ┌────────────────────────────────────────────┐
       │   API Gateway (NestJS, AWS ap-south-1)     │
       │   - REST + tRPC + GraphQL (federation)     │
       │   - Authn: JWT (Clerk/Auth0)               │
       └─┬─────┬─────┬─────┬─────┬─────┬─────┬──────┘
         │     │     │     │     │     │     │
   ┌─────▼┐  ┌▼────┐│ ┌───▼─┐ ┌─▼──┐ ┌▼────┐│ ┌───▼──┐
   │ IDM  │  │STOR ││ │DISC │ │CAMP│ │MSG  ││ │WALLET│
   │      │  │EFRT ││ │OVER │ │AIGN│ │     ││ │(svc) │
   └──────┘  └─────┘│ └─────┘ └────┘ └─────┘│ └──────┘
                    │                       │
                  ┌─▼────────────────────┐  ┌▼──────────┐
                  │ AI SVC (Spark/Asst)  │  │ NOTIF SVC │
                  │ Claude API / OpenAI  │  │ Resend/WA │
                  └──────────────────────┘  └───────────┘
                              │
       ┌──────────────────────┼─────────────────────────┐
       ▼                      ▼                         ▼
┌──────────────┐      ┌────────────────┐       ┌────────────────┐
│ PostgreSQL16 │      │ Redis (cache,  │       │ Typesense /    │
│ + pgvector   │      │ pub/sub, queue)│       │ Meilisearch    │
│ (RDS multi-  │      │ ElastiCache    │       │ (faceted srch) │
│ AZ, Karachi/ │      └────────────────┘       └────────────────┘
│ Mumbai)      │      ┌────────────────┐       ┌────────────────┐
└──────────────┘      │ S3 / R2        │       │ External APIs: │
                      │ (media, KYC)   │       │ JazzCash,      │
                      └────────────────┘       │ Easypaisa,     │
                                               │ NADRA,Stripe,  │
                                               │ Meta,TikTok,   │
                                               │ YouTube,LI     │
                                               └────────────────┘
```

### B.2 Recommended Tech Stack with Justification

**Frontend**
- **Next.js 14 (App Router) + TypeScript** — SSG for public storefronts (SEO-critical), SSR for dashboards, edge rendering for low-latency. Vercel hosting for global edge.
- **TailwindCSS + shadcn/ui** — fastest path to polished, Passionfroot-like aesthetic; cream/orange/green tokens.
- **Zustand** for client state (lighter than Redux), **TanStack Query** for server-state caching.
- **Lucide icons**, **Framer Motion** for micro-interactions.

**Backend**
- **NestJS (Node 20, TypeScript)** — modular DI, easy to start as monolith with bounded modules, scales to microservices later. Justification over FastAPI: shared TypeScript types with frontend (via tRPC or generated SDK).
- **REST + tRPC hybrid** — REST for external/webhook endpoints, tRPC for internal frontend↔backend (type-safe).
- **GraphQL** considered but rejected for v1: extra complexity, REST+tRPC sufficient.

**Database & Search**
- **PostgreSQL 16** on AWS RDS (Mumbai `ap-south-1` for Pakistan latency) — primary OLTP store.
- **pgvector extension** — semantic search embeddings for creator matching ("creators who talk about X").
- **Prisma ORM** — type-safe schema, migrations, fast DX.
- **Redis (ElastiCache)** — session cache, rate limiting, BullMQ queue backing.
- **Typesense** (self-hosted) — faceted creator search (filters: location, category, price band, follower band) — faster and cheaper than Elasticsearch for this scale; Meilisearch is a viable alternative.

**Storage**
- **Cloudflare R2** for media (cheaper egress than S3, S3-compatible API). KYC docs in a separate isolated R2 bucket with stricter access policies.

**Realtime**
- **Pusher Channels** for v1 (managed, fast to ship); migrate to **Soketi** (self-hosted Pusher-compatible) when message volume justifies cost.

**Auth**
- **Clerk** (managed, supports multi-role, social logins, organizations) — fastest path. Alternative: **Auth0** if enterprise requirements emerge. Custom JWT for service-to-service.

**AI**
- **Anthropic Claude Sonnet 4.5** as primary LLM for Spark + Conversation Assistant (best tool-calling, large context). **OpenAI GPT-4o** as fallback.
- **OpenAI text-embedding-3-small** (1536 dim) for creator/content embeddings, stored in pgvector.

**Background Jobs**
- **BullMQ** (Redis-backed) for outreach sends, KYC checks, payment reconciliation, embedding generation, social-API sync.

**Hosting / Infra**
- **Frontend:** Vercel (global edge).
- **Backend:** AWS ECS Fargate in `ap-south-1` (Mumbai) — closest AWS region to Pakistan, ~30–60ms latency to Karachi/Lahore.
- **DB:** AWS RDS Multi-AZ Postgres in `ap-south-1` with read replica.
- **CDN:** Cloudflare in front for images, DDoS protection.

### B.3 Data Models & Database Schema

Provided in Prisma syntax; condensed to core entities.

```prisma
// USERS & ORGS
model User {
  id            String    @id @default(cuid())
  email         String    @unique
  phone         String?   @unique
  name          String
  avatarUrl     String?
  role          UserRole  // BRAND_USER | CREATOR | ADMIN
  createdAt     DateTime  @default(now())
  workspaces    WorkspaceMember[]
  creator       CreatorProfile?
  kyc           KycRecord?
  notifications Notification[]
}

enum UserRole { BRAND_USER  CREATOR  ADMIN }

model Workspace {                       // Brand org
  id          String   @id @default(cuid())
  name        String
  websiteUrl  String?
  industry    String?
  monthlyBudgetUsd Int?
  ntn         String?     // Pakistan tax #
  members     WorkspaceMember[]
  campaigns   Campaign[]
  walletId    String   @unique
  wallet      Wallet   @relation(fields: [walletId], references: [id])
  plan        PlanTier @default(FREE)
}
model WorkspaceMember {
  id          String  @id @default(cuid())
  userId      String
  workspaceId String
  role        WorkspaceRole // OWNER | ADMIN | MEMBER
  user        User      @relation(fields: [userId], references: [id])
  workspace   Workspace @relation(fields: [workspaceId], references: [id])
  @@unique([userId, workspaceId])
}

// CREATOR
model CreatorProfile {
  id            String   @id @default(cuid())
  userId        String   @unique
  user          User     @relation(fields: [userId], references: [id])
  handle        String   @unique           // /@hira
  city          String?
  country       String   @default("PK")
  bio           String?
  categories    String[]                    // ["fashion","lifestyle"]
  priceTierMin  Int?                        // PKR
  priceTierMax  Int?
  alamutScore   Float    @default(0)
  channels      Channel[]
  storefront    Storefront?
  walletId      String   @unique
  wallet        Wallet   @relation(fields: [walletId], references: [id])
  embedding     Unsupported("vector(1536)") // pgvector
}
model Channel {
  id           String  @id @default(cuid())
  creatorId    String
  platform     Platform   // INSTAGRAM | TIKTOK | YOUTUBE | LINKEDIN | NEWSLETTER | PODCAST | X
  handle       String
  followers    Int
  engagementRate Float?
  verified     Boolean    @default(false)   // OAuth-verified
  audienceJson Json?                        // demographics blob
  creator      CreatorProfile @relation(fields: [creatorId], references: [id])
}

// STOREFRONT
model Storefront {
  id          String  @id @default(cuid())
  creatorId   String  @unique
  themeColor  String  @default("#F5E6D3")
  publishedAt DateTime?
  blocks      StorefrontBlock[]
  creator     CreatorProfile @relation(fields: [creatorId], references: [id])
}
model StorefrontBlock {
  id           String  @id @default(cuid())
  storefrontId String
  type         BlockType  // CHANNELS | PACKAGE | PAST_COLLAB | IMAGE | TEXT | LINK
  position     Int
  contentJson  Json                          // schema varies by type
  storefront   Storefront @relation(fields: [storefrontId], references: [id])
}
model Package {
  id           String  @id @default(cuid())
  creatorId    String
  type         PackageType // SINGLE | BUNDLE | MULTI_BUNDLE
  title        String
  description  String
  priceMinor   Int                            // PKR paisa or USD cents
  currency     String   @default("PKR")
  deliverables Json                            // [{platform, format, qty}]
}

// CAMPAIGN & COLLAB
model Campaign {
  id            String   @id @default(cuid())
  workspaceId   String
  name          String
  description   String?                          // private
  brief         String?                          // shared
  totalBudgetMinor Int
  currency      String   @default("PKR")
  status        CampaignStatus // PLANNED|ACTIVE|LIVE|COMPLETED|ARCHIVED
  visibility    Visibility @default(PRIVATE)    // PRIVATE | PUBLIC (for application)
  createdAt     DateTime  @default(now())
  lastActivityAt DateTime @default(now())
  workspace     Workspace @relation(fields: [workspaceId], references: [id])
  collaborations Collaboration[]
  applications  CampaignApplication[]
}
model Collaboration {
  id           String  @id @default(cuid())
  campaignId   String
  creatorId    String
  packageId    String?
  placement    String                            // "Newsletter sponsor" etc.
  stage        CollabStage // CONTACTED | NEGOTIATING | CONFIRMED | LIVE | COMPLETED | CANCELLED
  agreedPriceMinor Int?
  conversationId String? @unique
  deliverables Deliverable[]
  payments     Payment[]
  campaign     Campaign  @relation(fields: [campaignId], references: [id])
  creator      CreatorProfile @relation(fields: [creatorId], references: [id])
}
model Deliverable {
  id              String   @id @default(cuid())
  collaborationId String
  type            String                          // "Instagram Reel"
  dueAt           DateTime?
  submittedUrl    String?
  status          DeliverableStatus // PENDING | SUBMITTED | APPROVED | REJECTED
  collaboration   Collaboration @relation(fields: [collaborationId], references: [id])
}
model CampaignApplication {
  id          String   @id @default(cuid())
  campaignId  String
  creatorId   String
  pitch       String?
  status      AppStatus // SENT | SAVED | ACCEPTED | DECLINED
  createdAt   DateTime  @default(now())
  campaign    Campaign  @relation(fields: [campaignId], references: [id])
}

// MESSAGING
model Conversation {
  id              String   @id @default(cuid())
  workspaceId     String
  creatorId       String
  collaborationId String?  @unique
  lastMessageAt   DateTime @default(now())
  messages        Message[]
}
model Message {
  id             String   @id @default(cuid())
  conversationId String
  senderUserId   String
  body           String
  attachments    Json?                           // [{url,type,size}]
  type           MessageType // TEXT | PROPOSAL | PAYMENT_REQUEST | SYSTEM
  createdAt      DateTime @default(now())
  readBy         Json?                           // {userId: timestamp}
  conversation   Conversation @relation(fields: [conversationId], references: [id])
}

// PAYMENTS — Double-entry ledger
model Wallet {
  id             String   @id @default(cuid())
  ownerType      OwnerType  // WORKSPACE | CREATOR | PLATFORM
  ownerId        String
  currency       String     @default("PKR")
  // Balances are derived views from Ledger; cached here for speed
  availableMinor BigInt   @default(0)
  reservedMinor  BigInt   @default(0)
}
model LedgerEntry {                              // immutable, append-only
  id             String   @id @default(cuid())
  txnId          String                           // groups debit+credit
  walletId       String
  accountType    AccountType // ASSET|LIABILITY|EQUITY|REVENUE|EXPENSE
  direction      Direction   // DEBIT | CREDIT
  amountMinor    BigInt
  currency       String
  reason         String                           // "TOPUP_JAZZCASH" etc.
  metadata       Json?
  createdAt      DateTime @default(now())
  @@index([walletId, createdAt])
  @@index([txnId])
}
model Payment {                                  // external payment intent
  id             String   @id @default(cuid())
  collaborationId String?
  walletId       String
  provider       PaymentProvider // JAZZCASH|EASYPAISA|RAAST|STRIPE|CARD
  providerRef    String?  @unique
  type           PaymentType  // TOPUP | PAYOUT | REFUND | FEE | TAX
  amountMinor    BigInt
  currency       String
  status         PaymentStatus // INITIATED|PENDING|SUCCESS|FAILED|REVERSED
  rawWebhook     Json?
  createdAt      DateTime @default(now())
}

// KYC
model KycRecord {
  id           String  @id @default(cuid())
  userId       String  @unique
  cnic         String?                            // 13-digit
  cnicLast6    String?
  verisysStatus VerisysStatus  // PENDING|VERIFIED|FAILED|EXPIRED
  verisysAt    DateTime?
  bankIban     String?
  jazzcashMsisdn String?
  easypaisaMsisdn String?
  documentsR2Keys Json?                           // [paths]
}

// REVIEWS
model Review {
  id           String  @id @default(cuid())
  collaborationId String
  reviewerType ReviewerType   // BRAND | CREATOR
  rating       Int            // 1..5
  text         String?
  createdAt    DateTime @default(now())
}

// AUDIT
model AuditLog {
  id        String   @id @default(cuid())
  actorId   String?
  action    String
  entity    String
  entityId  String
  diffJson  Json?
  ip        String?
  createdAt DateTime @default(now())
  @@index([entity, entityId])
}

// NOTIFICATION
model Notification {
  id         String  @id @default(cuid())
  userId     String
  type       String
  payload    Json
  channels   Json                                 // ["INAPP","EMAIL","WHATSAPP"]
  readAt     DateTime?
  createdAt  DateTime @default(now())
}
```

### B.4 API Design (REST examples; tRPC mirrors internally)

**Auth**
- `POST /v1/auth/signup` `{email, password, role: "BRAND"|"CREATOR"}`
- `POST /v1/auth/login` → `{accessToken, refreshToken}`

**Storefront**
- `GET /v1/creators/:handle/storefront` (public) → blocks, channels, packages
- `PATCH /v1/me/storefront/blocks/:id` (auth, creator) → update block

**Discovery**
- `POST /v1/discovery/search`
  ```json
  { "q": "fashion creators with female 18-34 audience in Karachi",
    "filters": {"platform":["INSTAGRAM"],"followersMin":10000,"city":"Karachi"},
    "page": 1, "limit": 20, "mode": "hybrid" }
  ```
  → `{ results: [{creatorId, handle, score, priceTier, channels, audienceSummary}], facets: {...} }`

**Campaign**
- `POST /v1/campaigns` `{name, description, brief, totalBudgetMinor, currency}`
- `POST /v1/campaigns/:id/outreach` `{creatorIds:[...], templateId, perCreatorOverrides:[{}] }`
- `GET /v1/campaigns/:id` → with collaborations + metrics

**Application**
- `POST /v1/campaigns/:id/apply` (creator) `{pitch}`
- `PATCH /v1/applications/:id` (brand) `{status:"ACCEPTED"|"SAVED"|"DECLINED"}`

**Messaging**
- `POST /v1/conversations/:id/messages` `{body, attachments?}`
- WebSocket: subscribe `conversation:{id}` → `message.created`, `typing`, `read`

**Wallet & Payments**
- `POST /v1/wallet/topup` `{amountMinor, currency, provider:"JAZZCASH"}` → returns hosted-checkout URL
- `POST /v1/webhooks/jazzcash` (signed) — receives IPN, updates Payment + LedgerEntry
- `POST /v1/wallet/payout` (creator) `{amountMinor, destination:{type:"JAZZCASH", msisdn}}`
- `POST /v1/collaborations/:id/release` (brand) — triggers escrow release: debit Workspace.reserved → credit Creator.available (minus 5% WHT to Platform Tax account, minus fee to Platform Revenue)

**Spark AI**
- `POST /v1/spark/sessions` → returns `{sessionId}`
- `POST /v1/spark/sessions/:id/messages` `{role:"user", content}` → SSE stream of assistant tokens + tool-use events

### B.5 Discovery & Search Architecture

**Hybrid search:** combine Typesense keyword/faceted + pgvector semantic.

1. **Indexing pipeline.** On creator profile change or every 24h sync: pull recent posts (Instagram/YouTube/TikTok APIs), generate text summary ("Bilal posts about HR analytics, recruiter tools, mental health at work"), embed via OpenAI `text-embedding-3-small` (1536-dim), store in `creator_profiles.embedding`. Also push structured fields to Typesense (handle, categories, location, follower buckets, price tier, alamut_score).
2. **Query pipeline.** User query → run in parallel:
   - Typesense for filter+keyword candidates (top 200).
   - pgvector cosine-similarity vs query embedding for semantic candidates (top 200).
   Merge, dedupe, then rerank using:
3. **Ranking score (weighted):**
   ```
   score = 0.35 * semantic_similarity
         + 0.25 * filter_relevance
         + 0.15 * alamut_score (engagement, on-time, reviews)
         + 0.10 * recency (active in last 30d)
         + 0.10 * audience_fit (overlap with stated ICP)
         + 0.05 * verified (NADRA + OAuth)
   ```
4. **"New to me" filter** = exclude creators in any prior workspace conversation.
5. **Caching:** Redis cache results per (workspaceId, query-hash) for 60s.

### B.6 Spark AI Architecture

**Pattern: ReAct-style agent with tool calling on Anthropic Claude.**

**System prompt (excerpt):**
> You are Spark, the campaign-planning agent for Alamut. Your job is to help brands plan creator marketing campaigns in Pakistan. You have access to tools to search creators, score audience fit, estimate budget, and send outreach. Always: (1) clarify ICP and budget before searching, (2) propose a draft plan with creator table including projected impressions/engagement/CPM, (3) refine via user feedback, (4) confirm before sending outreach. Currency default: PKR. Respect brand-safety rules. Never invent creator data — always call `search_creators` first.

**Tool registry (JSON schemas passed to Claude tool-use):**
- `search_creators(query, filters, limit)` → returns ranked list with metrics.
- `get_creator_details(creatorId)` → full profile + audience.
- `estimate_engagement(creatorIds[], placement)` → projected impressions/engagement.
- `optimize_budget(creators[], targetBudgetMinor, currency)` → returns trimmed/expanded list.
- `save_campaign_plan(workspaceId, name, creators[], briefDraft)` → creates draft Campaign.
- `generate_outreach(campaignId, creatorIds[], tone)` → returns per-creator drafted messages.
- `send_outreach(campaignId, creatorIds[], messages[])` → sends, returns response-rate prediction.

**Conversation state:** persisted per `spark_session_id` in Redis (TTL 24h) + Postgres for replay. State includes: collected ICP, locked budget, current creator shortlist, refinement history.

**Refinement loop:** after each user turn, if user says "trim to $4K", call `optimize_budget`, render new table; if "remove creator X", call again with updated list.

**Fallbacks:** if Claude tool-call fails or returns invalid args, retry with structured-output mode; if 3 retries fail, surface "I couldn't complete that — please refine your request" and log to Sentry.

**Cost control:** max 20 tool calls per session; truncate conversation history to last 8 turns + summary; cache tool results within session.

### B.7 Payments Architecture

**Compliance posture (critical).** SBP rules require any entity that holds customer funds to be a licensed PSO/PSP/EMI (PKR 200M paid-up capital). At launch, **Alamut partners with a licensed PSO/PSP** (e.g., Foree, NIFT, Avanza, or 1LINK) — funds legally sit in the partner's segregated account; Alamut Wallet shows a reflection. This is the same pattern FINJA used with FINCA Microfinance Bank for SimSim. Apply for own EMI license once Phase 4.

**Double-entry ledger.** Every money movement = at least one DEBIT and one CREDIT, totals balanced. Accounts:
- `wallet:workspace:<id>` (LIABILITY — Alamut owes brand)
- `wallet:creator:<id>` (LIABILITY)
- `escrow:reserved:<collabId>` (LIABILITY, sub-account)
- `cash:jazzcash` / `cash:easypaisa` / `cash:stripe` / `cash:bank_raast` (ASSETS)
- `revenue:platform_fee` (REVENUE)
- `liability:tax_payable_fbr` (LIABILITY)
- `expense:psp_fees` (EXPENSE)

**Example flows:**

*Top-up (brand pays PKR 100,000 via JazzCash):*
```
DR cash:jazzcash         100,000
  CR wallet:workspace:42  100,000
```

*Reserve for collab (PKR 50,000):*
```
DR wallet:workspace:42       50,000
  CR escrow:reserved:c-9001   50,000
```

*Release on milestone (brand approves; 5% WHT, 10% platform fee):*
```
DR escrow:reserved:c-9001       50,000
  CR wallet:creator:hira         42,500   (net to creator)
  CR liability:tax_payable_fbr    2,500   (5% WHT)
  CR revenue:platform_fee         5,000   (10% take)
```

*Payout (creator withdraws Rs. 42,500 to JazzCash):*
```
DR wallet:creator:hira      42,500
  CR cash:jazzcash           42,500   (deducted from Alamut's JC merchant account)
```

**JazzCash integration.**
- Use REST `DoMWalletTransaction v2.0` for direct mobile-wallet pull (requires `pp_CNIC` last 6 digits).
- For card payments: hosted checkout via `pp_TxnType=MIGS` redirect.
- For payouts to creator JazzCash wallets: use JazzCash B2C/disbursement API (requires merchant agreement extension).
- HMAC-SHA256 hash on every request using shared `IntegritySalt`.
- Webhook (IPN) on `pp_ResponseCode` — verify hash, update `Payment.status`, post Ledger entries idempotently using `txnId` dedup.
- Settlement: T+1 for mobile wallet to Alamut's account.

**Easypaisa integration.**
- Use Easypay OPS REST APIs: `Initiate MA Transaction` and `Inquire Transaction Status`.
- For OTC (over-the-counter) top-ups: token model, customer pays at any of 75K+ Easypaisa shops within 7 days.
- Hosted checkout via Easypay portal redirect.
- Settlement: instant for MA, 7 working days for OTC.

**Raast (via 1LINK 1GO P2M).**
- Integrate with 1LINK's 1GO Raast P2M for static + dynamic QR, Request-to-Pay (Now/Later).
- ISO 20022 message format.
- Use case: brand initiates Request-to-Pay for top-up; instant credit on settlement.
- Requires onboarding via 1LINK as merchant aggregator partner.

**Stripe Connect (Phase 4 — global).**
- **Connect Express accounts** for international creators — Stripe handles KYC, 135+ currencies, payouts to 46 countries.
- Brand pays via Stripe Checkout in USD; funds split via Connect (creator account + platform fee + tax).
- Cannot use Connect to onboard Pakistani creators directly (Stripe doesn't operate in Pakistan); Pakistani creators stay on local rails.

**KYC: NADRA Verisys.**
- Integration: API access requires institutional onboarding agreement with NADRA (banks, fintechs, regulated entities). Alamut's PSP partner can sponsor access, OR use third-party aggregators (Aqsa Technologies, etc.).
- Flow: collect CNIC + name + DOB → call Verisys → returns `verified|mismatch|expired`.
- Tier 1 KYC (basic, payouts ≤ PKR 25K/month): name + CNIC + phone OTP.
- Tier 2 (full, unlimited): CNIC + selfie liveness + Verisys biometric match (via Nishan Pakistan platform launched Feb 2026).
- Re-verify annually.

**FBR tax handling.**
- Auto-deduct 5% WHT (Section 153 / SRO 545–546 of 2026) on every creator payout >0.
- Maintain creator's annual income running total; if exceeds basic exemption, prompt to file return.
- Generate digital tax certificate (PDF) per fiscal year (July–June) downloadable from creator dashboard.
- Quarterly bulk WHT remittance to FBR via licensed tax intermediary.
- For brand-side: 18% GST on Alamut platform fee (per ICT Sales Tax on Services Ordinance) — collected and remitted by Alamut.

**Refund / dispute flow.** 7-day dispute window post-deliverable. Funds remain in escrow during dispute. Admin mediator can: full refund (reverse ledger), partial release (split debit), or full release. All actions audited.

### B.8 Real-time Messaging Architecture

- **Transport:** WebSockets via Pusher Channels (managed) for v1; migrate to self-hosted Soketi at ~1M msg/day.
- **Channel naming:** `private-conversation-{convId}` (auth gated by membership), `presence-workspace-{wsId}` for online presence.
- **Storage:** every message persisted in `Message` table; attachments → R2 with signed URLs (1-hour expiry).
- **Read receipts:** stored in `Message.readBy` JSON, updated via debounced API call on scroll-into-view.
- **Typing indicators:** ephemeral pubsub event, not persisted.
- **AI Conversation Assistant:** background BullMQ job watches new messages; runs Claude classification → if "follow-up needed" / "review content" / etc., creates a Notification + injects a system-card into the conversation thread. User can click "Draft reply with AI" → SSE response into compose box.
- **Attachments:** max 25MB; types: image, pdf, video, doc; virus-scan via ClamAV Lambda.

### B.9 Notification System

| Channel | Provider | Use case | Cost (PK) |
|---|---|---|---|
| In-app | Pusher / WS | All notifications | n/a |
| Email | Resend (or SendGrid) | Transactional, digests | $0.0004/email |
| WhatsApp | Meta Business API via WeTarseel/Convex Interactive (BSP) | Payment received, deliverable due, message from brand | ~PKR 1.80–2.50/utility msg |
| SMS | Twilio / local (Veevotech) | OTP, payment failed | ~PKR 1.20/SMS |
| Push (Phase 5) | FCM / APNs | Mobile app | n/a |

**Templating:** Handlebars-like; per-locale (English only at launch). Per-user channel preferences in settings. Quiet hours: no WhatsApp/SMS between 11pm–7am PKT.

### B.10 Security & Compliance

- **Authn:** Clerk JWT (RS256), short-lived access (15min) + refresh (30d).
- **Authz:** CASL.js (Node) / row-level checks via Prisma middleware; permission matrix from §A.7 enforced at service layer.
- **Encryption at rest:** AWS RDS KMS; KYC bucket uses customer-managed key, separate IAM role.
- **In transit:** TLS 1.3 everywhere, HSTS preload.
- **PII handling:** CNIC + KYC docs in isolated R2 bucket, accessed only via signed URL for compliance review; never returned in API.
- **PCI scope:** Alamut never stores card PANs — all card flows go through JazzCash hosted checkout / Stripe Elements. Scope: SAQ A.
- **PDP Act (Pakistan Personal Data Protection Bill, expected 2026):** consent collection at signup, data export + delete endpoints (GDPR-style), data residency in `ap-south-1`.
- **Rate limiting:** per-IP and per-user via Redis (e.g., 100 req/min per user, 1000 per IP).
- **Abuse:** Cloudflare WAF + bot management; CAPTCHA on signup and outreach send.
- **Fake-account detection:** OAuth verification (must connect at least one social), follower-anomaly scoring, IP/device fingerprinting (FingerprintJS), manual review queue for suspicious creators.
- **Content moderation:** brief + storefront text scanned by Claude moderation classifier; flag illegal-content (gambling per NCCIA rules, etc.); manual review queue.
- **Audit log:** every state-changing action → `AuditLog` row with actor, IP, diff.

### B.11 DevOps / Infrastructure

- **Source:** GitHub monorepo (`/web`, `/api`, `/shared-types`, `/infra`).
- **CI/CD:** GitHub Actions — lint, type-check, unit + integration tests, Prisma migration check, deploy.
- **Deploy:** Vercel for `/web` (preview per PR). API to AWS ECS Fargate via container image; blue/green via CodeDeploy.
- **Environments:** `dev` (single small RDS), `staging` (mirrors prod, anonymized seed data), `prod`.
- **IaC:** Terraform for AWS resources.
- **Observability:**
  - **Sentry** — error tracking (frontend + backend).
  - **Datadog** OR **Grafana Cloud** — APM, infra metrics, logs.
  - **PostHog** — product analytics, session replay (creator + brand funnels), feature flags.
  - **OpenTelemetry** instrumentation in NestJS.
- **Logging:** structured JSON to Datadog; PII-redacted.
- **Backups:** RDS automated daily snapshot + 7-day PITR; cross-region snapshot weekly. R2 versioning enabled on KYC bucket.
- **Disaster recovery:** RPO 1h, RTO 4h; multi-AZ RDS; documented runbooks.
- **Cost (rough monthly est. at 1K active brands + 10K creators):** Vercel $250, ECS $400, RDS $400, Redis $80, Typesense $100, R2 $50, Pusher $200, OpenAI/Claude $1,500, Resend $50, WhatsApp ~$300, Sentry/Datadog $300 → **~$3,600/mo**.

### B.12 Design System & UI Guidelines

**Brand palette (inspired by Passionfroot's cream/orange/green aesthetic):**
- Cream `#F5E6D3` (background)
- Warm orange `#E97B3A` (primary CTA)
- Forest green `#2F5D3A` (secondary/success)
- Charcoal `#1F1F1F` (text)
- Soft gray `#E8E2D7` (borders, surfaces)
- Accent gold `#D4A574`

**Typography:** Inter for UI body (400/500/600), Söhne or Instrument Serif for storefront headlines (creator-facing whimsy).

**Spacing:** 4px base; 8/12/16/24/32/48/64.

**Component library:** shadcn/ui base, customized tokens; documented in Storybook.

**Accessibility:** WCAG 2.2 AA — color contrast ≥4.5:1, keyboard nav, ARIA labels, focus rings, prefers-reduced-motion.

**Responsive:** mobile (≤640) → tablet (≤1024) → desktop. Storefronts must look pristine on mobile (~70% of viewer traffic).

**Mobile strategy:** responsive web at launch; React Native Expo apps in Phase 5 for creators (push notifications, easier mobile media upload).

### B.13 Third-Party Integrations List

| Category | Service | Purpose | Phase |
|---|---|---|---|
| Payments PK | JazzCash REST API | MA top-up, card, payouts | 2 |
| Payments PK | Easypaisa OPS / Open API | MA, OTC top-up, payouts | 2 |
| Payments PK | 1LINK 1GO Raast P2M | Instant QR & R2P | 2 |
| Payments Global | Stripe Connect Express | International creators | 4 |
| KYC | NADRA Verisys / Nishan Pakistan | CNIC + biometric | 2 |
| Auth | Clerk | Identity, orgs, OAuth | 1 |
| Email | Resend | Transactional | 1 |
| WhatsApp | Meta Business API via WeTarseel BSP | Notifications | 3 |
| SMS | Twilio / Veevotech | OTP, fallback | 1 |
| Storage | Cloudflare R2 | Media, KYC | 1 |
| Realtime | Pusher → Soketi | Chat | 1 |
| AI | Anthropic Claude API | Spark, Assistant | 3 |
| AI | OpenAI Embeddings | Semantic search | 1 |
| Analytics | PostHog | Product analytics | 1 |
| Errors | Sentry | Frontend + backend | 1 |
| APM | Datadog | Infra, traces | 2 |
| Search | Typesense | Faceted creator search | 1 |
| Social APIs | Instagram Graph API, YouTube Data v3, TikTok Display API, LinkedIn API | Verify channels, pull metrics | 1 |
| Bot/WAF | Cloudflare | Security | 1 |
| Tax | Local FBR-licensed agent (e.g., Befiler, Taxationpk) | WHT remittance | 2 |

### B.14 Phased Engineering Roadmap (effort sizing)

| Module | Phase | Effort | Notes |
|---|---|---|---|
| Auth + Workspace | 1 | M (4 wk, 2 eng) | Clerk integration |
| Storefront builder + public pages | 1 | L (8 wk, 2 eng + 1 design) | Block editor, SEO |
| Discovery (Typesense + filters) | 1 | M (4 wk, 1 eng) | |
| Inbox + WebSocket chat | 1 | L (6 wk, 2 eng) | Pusher |
| Social OAuth + channel sync | 1 | M (4 wk, 1 eng) | |
| pgvector embeddings pipeline | 1 | S (2 wk) | |
| Campaign CRUD + lifecycle | 2 | L (6 wk, 2 eng) | |
| Outreach + bulk send | 2 | M (4 wk, 1 eng) | |
| Application flow | 2 | S (2 wk) | |
| Wallet + Ledger | 2 | XL (10 wk, 2 eng + 1 PM) | Double-entry, idempotent |
| JazzCash integration | 2 | L (6 wk, 1 eng) | Hash, IPN, sandbox-to-prod |
| Easypaisa integration | 2 | L (6 wk, 1 eng) | OPS APIs |
| 1GO Raast integration | 2 | M (4 wk) | Through 1LINK partnership |
| KYC NADRA Verisys | 2 | M (4 wk) | Via PSP partner sponsorship |
| FBR WHT automation | 2 | M (4 wk) | |
| Spark AI agent + tools | 3 | XL (10 wk, 2 eng + 1 prompt-eng) | |
| Conversation Assistant | 3 | M (4 wk) | |
| Analytics dashboard | 3 | L (6 wk) | |
| WhatsApp notifications | 3 | M (3 wk) | |
| Stripe Connect (global) | 4 | L (6 wk) | |
| Multi-currency wallet | 4 | M (4 wk) | |
| Bangladesh/SL localization | 4 | M (4 wk) | |
| iOS + Android (RN) | 5 | XL (12 wk, 3 eng) | |
| Agency multi-brand workspaces | 5 | L (6 wk) | |
| Public API for partners | 5 | M (4 wk) | |

**Team needed (steady-state):** 6 engineers (2 frontend, 3 backend, 1 mobile from Phase 5), 1 product designer, 1 PM, 1 prompt/AI engineer, 1 DevOps (shared), plus 1 community manager + 1 BD for creator/brand outreach.

---

## Recommendations (decision-ready next steps)

1. **Immediately (week 1–2):** Lock the brand name "Alamut," register `alamut.pk` and `alamut.app`, incorporate a Pakistani SMC-Pvt Ltd, open a corporate bank account, and begin discussions with 2–3 licensed PSPs (Foree, NIFT, Avanza, 1LINK directly) to determine which will sponsor your wallet operations and Verisys access. The PSP partner is the critical-path dependency for Phase 2 — engage them before writing code.
2. **Weeks 3–8:** Hire founding engineering team (CTO + 2 senior full-stack) and design lead. Build clickable Figma prototype of storefront + brand discovery + inbox; user-test with 10 creators and 5 brands in Karachi/Lahore. Apply for JazzCash + Easypaisa merchant sandbox accounts (free, self-serve).
3. **Months 2–6 (Phase 1):** Ship storefronts, discovery, inbox, OAuth as a free product. Recruit 500 creators with referral bounty and 20 pilot brands.
4. **Months 6–8:** Layer in Wallet + JazzCash + Easypaisa via PSP partner; run private beta of paid campaigns with 5 trusted brands; resolve dispute/edge-case bugs before opening payments to all.
5. **Months 8–12 (Phase 3):** Ship Spark AI + analytics; this is the wedge that differentiates from Walee/Bradri and justifies pricing tiers.
6. **Trigger to expand globally (Phase 4):** Hit ≥PKR 100M monthly GMV in Pakistan AND >40% of brands asking for international creators. Begin Stripe Connect work.
7. **Trigger to apply for own EMI license:** Annual GMV exceeds PKR 2B (~$7M) AND PSP-partner fees become >2% of revenue. At that point, raise a Series A and pursue PKR 200M paid-up capital + SBP licensing.
8. **Ongoing benchmarks that would change strategy:**
   - If FBR rules tighten further on creator income (e.g., raises WHT to 10%), build an in-product tax-filing helper to retain creators on the platform.
   - If a major competitor (Modash, Aspire) launches in Pakistan with PKR rails before month 12, accelerate the AI moat (Spark) and double down on creator NPS.
   - If JazzCash/Easypaisa fees exceed 1.5% per transaction, prioritize Raast (which is free) as the default top-up rail and incentivize brands to use it.

## Caveats

- **Regulatory ambiguity.** Pakistan's PSO/PSP rules technically apply to any platform that "settles transactions," which could include online marketplaces (per *Courting The Law* analysis). Multiple e-commerce platforms operate in regulatory grey, but Alamut should obtain explicit legal opinion from a Pakistani fintech counsel (e.g., Josh and Mak International) before public launch and clearly position as a software platform with payment partners — not a payment processor.
- **NADRA Verisys access** requires institutional onboarding; budget 8–12 weeks for sponsorship via PSP partner. Mitigation if delayed: launch with self-attested KYC + manual document review; restrict payouts to verified accounts only.
- **FBR SRO 545 / SRO 546 (2026)** are still in their finalization window as of May 2026; the Rs. 195/1000-views benchmark and 5% WHT may be revised. Build the tax engine to be parameter-driven.
- **Passionfroot feature parity.** Some Passionfroot specifics (e.g., precise auto-archive thresholds at 7/15 days, exact Zest tool interfaces) are described in this PRD based on the screenshots provided by the user; the public Passionfroot site emphasizes the agent-driven CTA but does not document every UI mechanic. Final UX should be validated with a fresh round of competitor walkthroughs before specs are frozen.
- **AI cost projections** assume Claude Sonnet pricing at May 2026 rates (~$3 / $15 per M input/output tokens). At ~50 Spark sessions/day with avg 8K tokens each, expect ~$1,000–$2,000/mo; could rise sharply with adoption — cap with token budgets per workspace plan tier.
- **WhatsApp Business pricing in Pakistan** rose for utility/authentication categories on April 1, 2026 (per Meta pricing notice). Re-validate per-message cost with chosen BSP before launch.
- **Modash and Aspire database sizes** (350M+, 1M+) are vendor-claimed; treat as marketing figures for competitive positioning, not verified.
- **The recommendation to start as a modular monolith** is a defensible default but assumes a small founding engineering team (≤6); if you hire 15+ engineers in year one, microservices may be appropriate sooner.
- **Creator-payment regulation in Pakistan is evolving** (SRO 545/546 was published April 2026 and is technically still in feedback window per *bisp8171check.com*); some creator-tax mechanics in this document may shift.