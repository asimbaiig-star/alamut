# Alamut

Creator–brand marketplace prototype. Brands post briefs and invite creators;
creators apply, negotiate, deliver content, and get paid out of escrow. Two
fully-wired personas (brand and creator) share the same data store.

The deployable app lives in [`app/`](./app). Everything in the repo root
outside that folder is reference material (design HTML mocks, the
`PROGRESS.md` change log, early JSX prototypes in `alamut/`).

## Stack

- Vite + React 18 + TypeScript
- Zustand store (persisted to `localStorage`) seeded from `app/src/lib/api/seed.ts`
- React Router 6 for routing
- `motion` for animations
- Vitest for the test suite (377 tests at last count)

The store is fully client-side — no backend, no env vars, no API calls.
Everything runs against the in-memory database hydrated from the seed.

## Local development

```bash
cd app
npm install
npm run dev          # http://localhost:5173
npm run typecheck    # tsc -b --noEmit
npm test             # vitest run
npm run build        # tsc -b && vite build → app/dist
```

## Deploying to Vercel

The repo is structured for Vercel's "subdirectory" deploys.

1. Push this repo to GitHub.
2. Create a new Vercel project from the repo.
3. In **Project Settings → General**, set:
   - **Framework Preset**: `Vite` (usually auto-detected)
   - **Root Directory**: `app`
   - **Build Command**: `npm run build` (default)
   - **Output Directory**: `dist` (default)
   - **Install Command**: `npm install` (default)
4. Deploy.

`app/vercel.json` already configures the SPA rewrite so direct hits to
client-side routes (e.g. `/v2`, `/c/sarahstyle`) serve `index.html` instead
of 404'ing.

No environment variables are required.

## Demo accounts

After deploying, sign in at `/signin` with any of these:

| Role       | Email                  | Password   |
|------------|------------------------|------------|
| Brand admin | `hannah@aesop.test`    | `demo1234` |
| Brand ops   | `thom@aesop.test`      | `demo1234` |
| Creator     | `sarah@alamut.test`    | `demo1234` |

Other seeded brands and creators live in `app/src/lib/api/seed.ts`.

## Repo layout

```
.
├── app/                      # Vite app — the deployable
│   ├── src/
│   ├── public/
│   ├── package.json
│   └── vercel.json
├── alamut/                   # Early JSX prototypes (reference only)
├── landing-prototype/        # Separate landing page exploration
├── Alamut*.html              # Design HTML mockups
├── PROGRESS.md               # Running change log
└── README.md                 # You are here
```
