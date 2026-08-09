# Alamut

Creator–brand marketplace. Brands post briefs and invite creators;
creators apply, negotiate, deliver content, and get paid out of escrow.
Two fully-wired personas (brand and creator) over a real Supabase
backend.

**Status: public beta. Payments are simulated** — wallet balances,
escrow, fees and payouts are play-money mechanics that demonstrate the
real flow. No money moves, no card or bank details are collected. See
[`/terms`](https://alamut-six.vercel.app/terms) and
[`/privacy`](https://alamut-six.vercel.app/privacy).

Live: **https://alamut-six.vercel.app**

The deployable app lives in [`app/`](./app). Everything in the repo root
outside that folder is reference material (design HTML mocks, the
`PROGRESS.md` change log, early JSX prototypes in `alamut/`).

## Stack

- Vite + React 18 + TypeScript
- **Supabase** — Postgres (20 tables, 29 migrations), Auth, Storage,
  Realtime chat, all row-level-security gated
- Zustand store (persisted to `localStorage`) as a local mirror/cache,
  seeded from `app/src/lib/api/seed.ts` and overlaid with Supabase rows
  on boot
- React Router 6 · `motion` for animations
- Vitest — **457 tests**

The store is a local mirror, not the source of truth: real accounts,
profiles and workflow rows live in Postgres, so a signed-in user resolves
identically on any device. Without Supabase env vars the app falls back
to a fully local seed-only mode, which is how the test suite runs.

## Local development

```bash
cd app
npm install
cp .env.example .env.local   # then fill in the two Supabase values
npm run dev          # http://localhost:5173
npm run typecheck    # tsc -b --noEmit
npm test             # vitest run
npm run build        # tsc -b && vite build → app/dist
```

### Environment

`app/.env.local` (gitignored — recover values from the Supabase
dashboard → Project Settings → API):

| Var | Required | Notes |
|---|---|---|
| `VITE_SUPABASE_URL` | yes | Project URL |
| `VITE_SUPABASE_ANON_KEY` | yes | Publishable/anon key — safe in the client, RLS does the gating |
| `VITE_ERROR_WEBHOOK` | no | POST target for captured errors; unset still buffers them to `window.__alamutErrors` |

Both Supabase vars are optional in the sense that the app *runs* without
them — it just runs local-only, with no real auth and nothing persisted
beyond the browser.

## Deploying

Vercel, **auto-deploying from `main`**. Root Directory is `app`;
`app/vercel.json` sets the SPA rewrite so client-side routes
(`/v2`, `/c/sarahstyle`, …) serve `index.html` instead of 404ing. The two
`VITE_SUPABASE_*` vars must be set in the Vercel project.

### Supabase operational notes

- **The free tier pauses a project after 7 days of inactivity**, and a
  paused project becomes deletion-eligible at 90 days. A daily GitHub
  Actions ping keeps it awake:
  [`.github/workflows/supabase-keep-alive.yml`](./.github/workflows/supabase-keep-alive.yml).
  Retire that workflow if the project ever moves to Pro.
- **Auth emails** are capped at 2/hour on Supabase's built-in service
  (their own docs call it unsuitable for production). Custom SMTP raises
  it to 30 new users/hour. With email confirmation switched off, signup
  sends no mail at all and the cap is irrelevant.
- **Site URL / redirect allowlist** must point at the production domain,
  or confirmation and password-reset links resolve to `localhost`.

## Demo accounts

Seeded accounts exist for walkthroughs:

| Role | Email | Password |
|---|---|---|
| Brand admin | `hannah@aesop.test` | `demo1234` |
| Brand ops | `thom@aesop.test` | `demo1234` |
| Creator | `sarah@alamut.test` | `demo1234` |

The one-click quick-fill buttons on `/signin` are **dev-only** — on the
public deployment they'd hand any visitor a seeded account holding
real-looking escrow figures and shared state. Sign in by typing the
credentials to use them in production.

Seeded brands, creators and campaigns are labelled **Demo** in the UI so
a real creator never mistakes a seeded brief for a live opportunity.
Other seeded records live in `app/src/lib/api/seed.ts`.

## Repo layout

```
.
├── app/                      # Vite app — the deployable
│   ├── src/
│   ├── supabase/migrations/  # 29 SQL migrations
│   ├── public/               # robots.txt, sitemap.xml
│   └── vercel.json
├── .github/workflows/        # Supabase keep-alive
├── alamut/                   # Early JSX prototypes (reference only)
├── landing-prototype/        # Separate landing page exploration
├── Alamut*.html              # Design HTML mockups
├── BACKEND_AUDIT_LOG.md      # Running session log — read this first
├── PROGRESS.md               # Frozen history (phases 1–40)
└── README.md                 # You are here
```

**`BACKEND_AUDIT_LOG.md` is the working document.** It carries the
session-by-session log, the architectural conventions, the 2026-08-08
launch-readiness audit (findings F1–F39) and the phased plan that
resolved them. Start there before changing anything.
