# Workspace v2 — Phase 57 handoff

The Pakistan-first revamp from the Claude Design bundle, now mounted as a parallel preview surface inside the running codebase.

> **Live preview:** [http://localhost:5173/v2](http://localhost:5173/v2)
> **Status:** foundation shipped. Two screens live (Brand Home, Creator Home). Twelve more screens scaffolded with `<ComingSoon />` placeholders. Existing portal at `/creator/*`, `/brand/*`, `/admin/*` is untouched.

---

## What shipped this session

### 1 · Design tokens (`app/src/styles/workspace-v2.css`, ~480 lines)

Scoped under `[data-surface="v2"]` so the new system lives alongside the existing portal without conflicts.

- **Surfaces** — refined cream (`#F6F1E8` / `#FBF7EE`), inky text (`#1C1A15`), warm ledger lines (`#E4DCC8` / `#D7CCB1`)
- **Accents** — terracotta primary (`#C5552B`), softer terracotta (`#E2784D`), pale terracotta wash (`#F4D9C7`), moss secondary (`#2D4A35`), gold + plum accents
- **Status palette** — positive moss / warning gold / negative coral / info navy
- **Typography** — Fraunces (display), Inter Tight (body), JetBrains Mono (data) — Inter Tight added to `index.html` Google Fonts link
- **Radii** — 8 / 12 / 18 / 24 / pill
- **Shadows** — three-step soft shadow ladder + paper-edge inset
- **Components** — buttons (primary / accent / ghost / outline), cards, pills (live / confirmed / draft / accent / moss), avatars (sm/md/lg/xl), filter chips, search input, tables, stats, channel chips, score badges, progress bars

### 2 · Sample data (`app/src/screens/workspace-v2/data.ts`)

Pakistan-first seed lifted directly from the design's `data.jsx`:

- **8 creators** — Hira (Lahore lifestyle), Bilal (Karachi B2B/HR), Zenith (Islamabad travel/YouTube 512K), Mahnoor (Karachi food), Ahmer (Islamabad tech), Anum (Lahore parenting), Fahad (Karachi fitness), Saadia (Karachi finance) — all with PKR rates, audience demographics, past-brand lists
- **4 campaigns** — Eid Edit '26 (Sapphire), PostEx LinkedIn thought-leadership, Hunza Travel Series (PIA), Daraz Mobile Week
- **Brand wallet** — Rs 28.4L available, Rs 16.2L in escrow, ledger with JazzCash/Raast top-ups + WHT/fee deductions
- **Creator wallet** — Rs 1.9L available, Rs 78K pending, Rs 29.4L lifetime
- **1 conversation** — multi-turn brand→creator thread between Sapphire and Hira

### 3 · Component library (`app/src/screens/workspace-v2/lib.tsx`)

- **24 inline SVG icons** — search, home, compass, campaign, inbox, wallet, spark, store, chart, shield, settings, bell, plus, arrow, filter, check, more, edit, external, send, plus IG / TikTok / YouTube / LinkedIn / X / Newsletter brand glyphs
- **PKR formatters** — `fmtPKR` (compact: Rs 1.5L / Rs 2.4cr), `fmtPKRfull` (Rs 1,500,000), `fmtFollowers` (1.2M / 86K)
- **Primitives** — `<PlatformChip />`, `<ScoreBadge />`, `<StagePill />`, `<StatCard />`, `<CampaignCard />`, `<Topbar />`
- **Platform meta** — color + name + icon for IG / TikTok / YouTube / LinkedIn / X / Newsletter

### 4 · Workspace shell (`app/src/screens/workspace-v2/Workspace.tsx`)

- **Sidebar** with the brand mark + Alamut wordmark + persona toggle (Brand / Creator) + role-specific nav + pinned user card at bottom
- **Persona toggle** persists to localStorage (`alamut.v2.persona`) so the user lands back where they were
- **Route state** internal to the shell (single URL: `/v2`) — promotion to nested URLs is a one-line change later
- **Brand routes** — Home, Spark (AI badge), Discover, Campaigns, Inbox (3 unread), Wallet
- **Creator routes** — Home, My storefront, Browse briefs, Inbox (2 unread), Analytics, Wallet, KYC & Tax
- **Auto-flip** — clicking a creator-side route auto-switches the persona (and vice versa)

### 5 · Two live screens

**Brand Home** (`screens/BrandHome.tsx`):
- Topbar: *"Welcome back, Sara · Sapphire Fashion · Pro"* + primary CTA *"New plan with Spark"*
- Four KPI tiles: **Rs 28.4L** wallet · **Rs 16.2L** in escrow · **14** active creators · **Rs 21.8L** spend this month
- Active campaigns row (2 cards from seed: *Eid Edit '26 — Sapphire*, *PostEx LinkedIn Thought-Leadership*) with progress bars
- Suggested creators tile — 5 overlapping avatars + *"5 creators matched your Eid Edit brief"* CTA
- Spark teaser card (dark gradient) — *"Plan your next campaign in a sentence"* + sample query

**Creator Home** (`screens/CreatorHome.tsx`):
- Topbar: *"Salaam, Hira · @hira.styles · Verified"* + primary CTA *"Edit storefront"*
- Four KPI tiles: **Rs 1.9L** available · **Rs 78K** in escrow · **Rs 29.4L** lifetime · **40K** audience reach
- Your briefs row (2 active: Eid Edit '26, Hunza Travel Series) with status pills
- Storefront preview tile — `alamut.pk/@hira.styles` + Edit / View buttons
- Recent payouts tile — latest 3 cleared transactions with PKR amounts

### 6 · ComingSoon placeholder (`screens/ComingSoon.tsx`)

Every nav item routes to a real screen — not a 404. The placeholder is itself well-designed (terracotta-soft tile, Spark icon, eyebrow, headline, sub-copy, two CTAs) so unbuilt routes look intentional rather than broken. Each placeholder has copy specific to that surface so the user understands what's coming.

### 7 · Router wiring (`app/src/router.tsx`)

- New lazy import: `WorkspaceV2`
- Two new routes: `/v2` and `/v2/*` — both render the workspace shell
- **No auth gate** during preview — anyone can hit `/v2` and explore both personas
- **Existing portal untouched** — `/creator/*`, `/brand/*`, `/admin/*` still work as they did

---

## Live verification (preview at desktop 1440×900)

**`/v2` brand side:**
| Check | Result |
|---|---|
| `data-surface="v2"` applied | ✅ |
| Sidebar + brand wordmark | ✅ "Alamut" in Fraunces 22px |
| Persona toggle, Brand active | ✅ |
| 6 brand nav items | ✅ Home / Spark / Discover / Campaigns / Inbox / Wallet |
| Topbar title + crumb | ✅ "Welcome back, Sara" / "Sapphire Fashion · Pro" |
| 4 KPI values | ✅ Rs 28.4L · Rs 16.2L · 14 · Rs 21.8L |
| Spark teaser card | ✅ Dark gradient, terracotta CTA |

**`/v2` creator side (after persona toggle click):**
| Check | Result |
|---|---|
| Active persona | ✅ "Creator" |
| 7 creator nav items | ✅ Home / My storefront / Browse briefs / Inbox / Analytics / Wallet / KYC & Tax |
| Topbar | ✅ "Salaam, Hira" / "@hira.styles · Verified" |
| 4 KPI values | ✅ Rs 1.9L · Rs 78K · Rs 29.4L · 40K |
| Sidebar foot | ✅ Hira Mansoor + handle + verified |
| Storefront URL | ✅ `alamut.pk/@hira.styles` |

**Build:** `tsc --noEmit` clean · `vite build` clean in 16.09s.

---

## What's pending — the rest of the system

The design has 14 distinct screens; we've built the home pair. Twelve remain, ordered by impact:

| Priority | Screen | Why next | Where in design |
|---|---|---|---|
| 1 | **Spark AI** (brand) | Centerpiece feature; conversational planner with inline interactive tables. Differentiator. | `spark.jsx` (the most code in the bundle) |
| 2 | **Discover creators** (brand) | Highest-traffic surface for paying user. Faceted filters + creator cards. | `brand-screens.jsx → Discover` |
| 3 | **Inbox** (shared, 3-pane) | Conversations · thread · collaboration side-panel. Used by both personas. | `brand-comms.jsx → Inbox` |
| 4 | **Storefront editor** (creator) | The asset creators link from their bios. Block-based editor. | `creator-screens.jsx → Storefront` |
| 5 | **Wallet** (brand) | Top-up · escrow · WHT · ledger. PKR-native ledger view. | `brand-comms.jsx → Wallet` |
| 6 | **Wallet** (creator) | Available · pending · lifetime · withdraw. Cleaner than brand wallet. | `creator-screens.jsx → CreatorWallet` |
| 7 | **Browse briefs** (creator) | Counterpart to brand Discover; live brief marketplace. | `creator-screens.jsx → CreatorCampaigns` |
| 8 | **Campaigns pipeline** (brand) | Roster view of every campaign × stage. Detail page beneath. | `brand-screens.jsx → Campaigns / CampaignDetail` |
| 9 | **Creator profile** (brand-side) | Full profile drill-down from Discover card click. | `brand-screens.jsx → CreatorProfile` |
| 10 | **KYC & Tax** (creator) | NADRA verification, FBR registration, auto tax certificate. PK-specific surface. | `creator-screens.jsx → KYC` |
| 11 | **Analytics** (creator) | Reach, engagement, audience, deal close-rate. | `creator-screens.jsx → Analytics` |
| 12 | **Public storefront preview** (`/c/:handle` v2) | The page brands see when they click a creator. Already partially exists in v1; needs reskinning. | `creator-screens.jsx → Storefront` (with `editing={false}`) |

Plus the **landing page** for the v2 era (currently exists for the v1 era at `/` and `/for-brands`) — a Pakistan-first hero with PKR / Raast / NADRA messaging, three pillars (Storefront / Spark / Wallet), brand vs creator split, big stats. Lower priority than the workspace itself.

---

## Migration strategy

The v2 surface is a **parallel preview**, not a replacement yet. That's deliberate:

1. **Iterate without disrupting users.** The existing portal keeps working. Anyone hitting `/v2` sees the new direction; everyone else sees the old portal.
2. **Promote when ready.** Once 8+ screens are built and the experience is stable, we flip the routes:
   - `/creator/*`, `/brand/*` → permanent redirects to `/v2` with persona pinned
   - The Workspace v2 shell becomes the only authenticated workspace
   - Existing screens stay in code for one phase as a fallback, then deleted
3. **Auth integration.** `/v2` is currently unauthenticated for preview. Wrap in `<ProtectedRoute allow={['creator', 'brand']} />` once the system is real, with persona auto-selected from `User.role`.
4. **State integration.** `/v2` currently uses sample data from `data.ts`. Wire to the real Zustand store (`useStore((s) => s.db)`) and adapt the selectors. The PKR formatting + Pakistan vocabulary will need a localization pass on the existing seed (which is currently global / USD).

---

## Files added this session

```
app/
├── docs/
│   └── WORKSPACE-V2-HANDOFF.md             ← this file
├── index.html                              ← +Inter Tight Google Fonts link
├── src/
│   ├── router.tsx                          ← +/v2 + /v2/* routes
│   ├── styles/
│   │   └── workspace-v2.css                ← v2 design tokens + components
│   └── screens/
│       └── workspace-v2/
│           ├── Workspace.tsx               ← shell · sidebar · persona toggle · routing
│           ├── data.ts                     ← Pakistan-first seed
│           ├── lib.tsx                     ← icons · formatters · primitives
│           └── screens/
│               ├── BrandHome.tsx
│               ├── CreatorHome.tsx
│               └── ComingSoon.tsx
```

Existing files modified: `index.html` (Inter Tight) and `router.tsx` (v2 lazy + routes). Nothing else touched.

Design import staging: `app/.design-import/alamut-revamped/` (the unzipped design bundle — keep around as the spec source of truth while we build the rest).
