# Backend Migration + Workspace Audit Log

**Purpose:** Cumulative record of the Supabase migration and workspace
functionality audits, kept separate from `PROGRESS.md` (which tracks
the pre-migration design phases 1–40). Append new sessions at the
bottom. Designed to be read into a fresh context window to recover
state quickly after a reset.

**Last updated:** 2026-08-08 (Phases 58-67 reconstructed from git
history — see the 2026-05-22 → 2026-06-13 session entry. Code through
`d5201d0` / Phase 67 is the current `origin/main`.)

---

## Current state — one paragraph

Alamut has migrated from a Zustand-only client-side prototype to a real
Supabase backend across 17 tables + 4 Storage buckets + Realtime chat,
with full RLS gating, cross-device auth (signup/signin/team-invite),
and end-to-end persistence for every meaningful action. Two completed
audits have hardened the workspace UI: a 40-item functional sweep
shipped real validation/wiring across most modal flows + home
dashboards, and a follow-up modal sweep added input validation +
data-loss guards across ten dialogs. Phases 54-67 then ran a long
consistency + honesty campaign over workspace-v2: fake/literal data
replaced with live derivations, ~35 surface mismatches fixed, **every
`v2*` mutation converted from silent `return null` to specific thrown
errors with toasting callers** (Phases 62-64), a shared `<Avatar>`,
and finally a single source of truth for collab-stage computation plus
the 10%/5% fee and escrow-copy corrections (Phase 67). Suite is at
**444 tests**, persist schema **v15**. Still deliberately absent: real
platform OAuth, real-money infra, realtime presence, SSR/OG tags,
observability.

---

## What changed in the 2026-05-13 → 2026-05-15 work (high-impact tldr)

The original 17 backend-migration phases shipped a working server.
The 2026-05-13 session ran a structural audit across the campaign
pipeline (slices 1-10 + items 1-4). The 2026-05-14 → 2026-05-15
window added Phases 50-53 + a Supabase advisor sweep + landing-page
polish.

**By the numbers (2026-05-13 → 2026-05-15):**
- 11 new migrations (019 → 029), all applied to remote via
  `supabase db query --linked`
- 22 Security Advisor warnings → 1 (dashboard-only password toggle)
- 64 Performance Advisor INFOs triaged → 2 real fixes shipped
  (outreach FK indexes), 62 documented as expected on a low-traffic DB
- Workflow polish: Calendar tab, bulk approve, offer templates,
  admin reports queue, KYC + W-9/W-8BEN capture, OAuth wiring,
  Spark LLM Edge Function, Playwright e2e
- Security hardening: 3 CRITICAL fixes (PII leak via public Creator/
  Brand SELECT, XSS via MIME-spoofed PDF iframe, OAuth postMessage
  origin) + 1 HIGH (storage path-traversal)
- Bug-bash from real testing: file upload + view, modal-reopen loop,
  Needs-you tile cap (290 of 294 items hidden), duplicate React keys
- Landing polish: hero size, mood overlay, capture badge,
  recent-placements masonry, press strip names, broken portrait URLs
- Architecture map: single-file interactive HTML diagram (86 nodes /
  183 edges)

**Most important behaviour change:** v2 mutations now refuse rather
than silently producing inconsistent state. Pre-fix a brand could
accept an offer with $0 wallet (Math.max clamp → phantom escrow);
a creator could apply to a draft campaign; submissions could land
on campaigns the creator had no offer on. All such paths now hard-
return on the gate. Toasts surface where the UI needed them.

**Most important security change:** the public.creators + public.brands
tables previously exposed every column (including bank account / IBAN
+ wallet balance + owner_email) to anonymous readers via
`for select using (true)`. Migration 025 splits into a public view
(no PII) + owner-only raw-table SELECT.

---

## Architectural conventions (pattern library)

Every backend migration phase follows the same recipe — if you're
adding a new entity, mirror this exactly:

1. **SQL migration** at `app/supabase/migrations/NNN_name.sql`
   - `create table if not exists public.X (…)`
   - `create index if not exists X_field_idx on public.X (…)`
   - `touch_updated_at` trigger via the shared helper
   - `alter table … enable row level security` + 3-4 policies
   - Optional seed inserts (one-row demo data)
   - Verification queries commented at the bottom
2. **Type** in `app/src/lib/api/types.ts` — interface matching the
   table; field names are camelCase even though columns are snake_case.
3. **Repo** in `app/src/lib/data/NRepo.ts`
   - `Row` type matching snake_case columns
   - `COLUMNS` const (centralised so adding columns updates every
     read path at once)
   - `toX(row)` / `toInsertRow(x)` / `toUpdateRowPatch(patch)` mappers
   - `fetchAllXFromSupabase()` + `insertXInSupabase(x)` /
     `updateXInSupabase(id, patch)` / `upsertXInSupabase(x)`
4. **Database** type extended in `types.ts` (`X[]` on the interface)
5. **Hydration overlay** in `app/src/lib/api/store.ts` — add the import,
   the Promise.all entry, and an `overlay(s.db.X ?? [], remoteX)` line
6. **tx() clone** in `app/src/lib/api/store.ts` — add `X: [...(prev.X ?? [])]`
   in both clone sites (boot reconciliation + tx wrapper)
7. **Seed default** — `X: []` in the `SEED` const in `app/src/lib/api/seed.ts`
8. **Mutations** — fire-and-forget mirror pattern:

   ```ts
   const result = tx((db) => { /* mutate */ return value; });
   if (result && typeof window !== 'undefined') {
     void (async () => {
       try {
         const { isSupabaseConfigured } = await import('@/lib/supabase');
         if (!isSupabaseConfigured()) return;
         const { insertXInSupabase } = await import('@/lib/data/NRepo');
         await insertXInSupabase(result);
       } catch (err) {
         const msg = err instanceof Error ? err.message : String(err);
         // Silence RLS / FK / not-found for rows that live only locally
         // (generated cmp_g* etc.)
         if (/row-level security|new row violates|foreign key|no rows|0 rows|not found/i.test(msg)) return;
         console.warn('[X mirror] failed:', msg);
       }
     })();
   }
   return result;
   ```

**RLS gate helpers** in migration 005 + 017:
- `is_brand_owner_of_campaign(p_campaign_id text)` — Phase 5b
- `is_creator_owner(p_creator_id text)` — Phase 5b
- `is_brand_owner_of_brand(p_brand_id text)` — Phase 14

**Storage buckets** all follow the public-read + authenticated-write
pattern (see migrations 002, 005, 015, 016). Path convention:
`<entityId>/<deterministic-prefix>-<sanitized-name>`.

**Auth flow:** Supabase handles credentials in `auth.users`. The local
`db.users` table carries role + brand/creator pointers. Cross-device
sign-in falls back to `brands.owner_email` / `creators.owner_email`
lookup and synthesizes a deterministic User row (`u_x_<djb2(email)>`).
See `client.ts:resolveUserFromSupabaseByEmail` + `lib/auth/sessionSync.ts`.

**Mutation chokepoints to remember:**
- Every collab stage transition → `ensureCollabState` in `lib/api/collabSync.ts`
- Every contract action → helpers in `lib/api/contracts.ts`
- Every transaction (db.transactions.push) → auto-mirrored via the
  `tx()` diff hook in `lib/api/store.ts` (Phase 7)

---

## Backend migration ledger — Phases 1–10

All migrations live at `app/supabase/migrations/NNN_*.sql`. All commits
are on origin/main. The Database type now has 17 entities.

| Phase | Migration | Entity | Commit | Notes |
|---|---|---|---|---|
| 1 | n/a (Supabase Auth config) | Auth wiring | `7ac75ee` | Maps Supabase auth.users → local seed by email; local-only fallback when env unset |
| 2 | 001_brands.sql | Brands + logo Storage | `9a244e6`, `4848ff0` | brand-logos bucket; `owner_email` for RLS |
| 3 | 002_campaigns.sql | Campaigns | `b18a17e`, `b5405e2` | FK to brands; cascade on delete |
| 4 | 003_offers_applications.sql | Offers + Applications | `94daa68`, `27238ed` | Mirror on every mutation; Phase 4 used `with check (true)` (tightened in 5b) |
| 5a | 004_creators.sql | Creators + portrait Storage | `1ff3484`, `2b855b6` | `owner_email` + creator-portraits bucket |
| 5b | 005_tighten_rls.sql | RLS hardening | `8e19651` | Adds `is_brand_owner_of_campaign` + `is_creator_owner` helpers; per-party gates |
| 5c | 006_collaborations.sql | Collaborations | `f577913` | 9-stage enum; `ensureCollabState` chokepoint mirrors |
| 5d | 007_submissions_deliverables.sql | Submissions + Deliverables + submission-files bucket | `f577913` | 5 submission mutations wired |
| 6 | 008_contracts.sql | Contracts | `0d5b001` | Immutable agreement snapshot; ctr_<collabId> id matches migrator |
| 7 | 009_transactions.sql | Transactions | `7a797bb` | `tx()` hook in store.ts diffs and mirrors new rows — one chokepoint for 13+ push sites |
| 8 lite | 010_reviews_disputes.sql | Reviews + Disputes | `b231150` | INSERT + UPDATE mutations on both |
| 9 | 011_outreach.sql | Outreach (brand soft-contact) | `a735cfc` | resulting_offer_id FK; 4 mutations |
| 10 | 012_threads_messages.sql | Threads + Messages + Realtime | `3e0a70c` | `lib/realtimeChat.ts` subscribes to postgres_changes; mount in main.tsx |

**Skipped by design (local-only):** notifications, scheduledNotifications,
referrals, advances, testimonials.

---

## Workspace audit shipments — Phases 11–15

Substantial new features built on top of the migration. Each ships
schema + repo + mutations + UI in one phase.

| Phase | Migration | What | Commit |
|---|---|---|---|
| 11 | 014_thread_moderation.sql | Inbox mute / archive / report | `f8eb1c8` |
| 12 | 015_message_attachments.sql | Inbox file attachments (Storage bucket + composer) | `b8a17e7` |
| 13 | 016_campaign_assets.sql | CampaignDetail asset upload (Storage bucket + brand-owner UI) | `dd701a6` |
| 14 | 017_team_invites.sql | Brand team invites (send / accept / revoke via token URL) | `2887a5b` |
| 15 | 018_spark_drafts.sql | Spark draft persistence (multi-draft, save/load/delete) | `c3a49f6` |

Note: migration 013 was `013_signup_rls.sql` (RLS fix for brand/creator
INSERT). It's an inline fix, not a phase.

---

## 40-item functional audit (Phases 11-prep)

Triaged into priorities; 39/40 shipped across ~10 commits before
Phases 11–15. Key impact areas:

- **Dead buttons** wired: Save to shortlist, withdrawal modal, More tips,
  Attach brief, multiple Inbox CTAs
- **Hardcoded data** replaced with derived signals: BrandHome avg ER +
  cost/engagement, audience charts, creator response time, KYC status,
  tier badges, sparkline months, earnings deltas
- **"Coming soon" toasts** replaced with real features: CSV exports on
  wallet/analytics, KYC bank-account modal, ledger filter, statement
  download, quarterly tax docs
- **Match facets on BriefDetail** wired to real Creator + Campaign signals
- **Seed augmentation:** 15 testimonials (was 8), pastClients tier-weighted
  on 110 creators, 21 editor-picks (was 6), availability for all creators,
  10 more demo reviews

---

## Modal audit (post-15)

10 modals improved across 2 commits.

**Batch 1 — validation + UX hints (S-effort):** `cf7c105`
- SendOfferModal — inline error for rate ≤ 0
- ApplyModal — char counter + pre-disable on pitch < 40 chars
- MessageComposeModal — toast on blank send
- ReviewModal — default rating 0 (force pick)
- DisputeModal — live char counter
- RequestAdvanceModal — help text shown upfront

**Batch 2 — data preservation + smart validation (M-effort):** `c6239ef`
- NewCampaignModal — "Discard draft?" confirm on dirty close
- InviteModal — per-creator success/fail accounting + partial-failure handling
- CreatorMarkLiveModal — two-tier URL check (parse + 9-platform whitelist)
- BoostPostModal — platform-specific min daily budgets ($5 IG, $10 YT/LI/X, $20 TT)

---

## File map — where things live

```
app/supabase/migrations/    SQL — 18 migration files (001 through 018)
app/src/lib/api/
  types.ts                  All entity types + Database
  store.ts                  Zustand store, tx() wrapper, boot hydration
  seed.ts                   Local seed (Database constant)
  client.ts                 Auth (signIn / signUp / resolveUserFromSupabaseByEmail)
  collabSync.ts             ensureCollabState chokepoint
  contracts.ts              Contract create/fulfill helpers
  scheduler.ts              ScheduledNotification queue (local-only)
  migrations.ts             Forward-only local migrators (idempotent)
app/src/lib/data/           One repo per migrated entity (16 files)
app/src/lib/auth/
  useAuth.ts                Hook for components
  sessionSync.ts            Reconciles local session with Supabase auth
app/src/lib/realtimeChat.ts Phase 10 — Postgres changes subscription
app/src/lib/utils/csv.ts    downloadCSV helper used by exports
app/src/lib/supabase.ts     Supabase client + isSupabaseConfigured
app/src/screens/auth/
  SignIn.tsx / SignUp.tsx
  AcceptInvite.tsx          Phase 14 accept-invite landing
app/src/screens/workspace-v2/
  Workspace.tsx             Shell + tab routing (URL-based, post-Phase 11 fix)
  v2Hooks.ts                Mutations + selectors (v2SendOffer, v2AcceptOffer, etc.)
  v2CampaignActions.ts      The big mutation file (offers, submissions, payouts)
  v2CollabActions.ts        Cancel-collab path
  v2DisputeActions.ts       Dispute lifecycle
  v2OutreachActions.ts      Outreach lifecycle (Phase 9)
  v2ReviewActions.ts        Review moderation
  v2Adapters.ts             Database → V2* projection (threadToV2 etc.)
  sparkEngine.ts            Mocked LLM engine for Spark
  useRecentActivity.ts      Derives the home activity feed from server state
  screens/                  All workspace screens (BrandHome, CreatorHome, Inbox, ...)
```

---

## Environment & gotchas

- **Vite env vars:** `VITE_SUPABASE_URL` + `VITE_SUPABASE_PUBLISHABLE_KEY`
  in `app/.env.local`. The `NEXT_PUBLIC_*` names are wrong — this is
  Vite, not Next.
- **Test domain rejection:** Supabase auth rejects `.test` and other
  fake-looking emails. Use real-looking domains (`@example.com` also
  fails; use `@gmail.com` for tests).
- **Email rate limit:** Free-tier Supabase SMTP caps at 3-4 confirmation
  emails/hour. Disable "Confirm email" in Supabase Studio → Auth →
  Sign In/Up for smoother demo, or wire custom SMTP.
- **Stale-bundle errors after Vercel deploy:** `main.tsx` listens for
  `vite:preloadError` and reloads once. Sessionstorage marker prevents
  reload loops.

---

## Outstanding / deferred items

After the 2026-05-13 → 2026-05-15 work (slices 1-10 + items 1-4 +
Phases 50-53 + Supabase advisor sweep), the remaining items are:

_(parent-screen RTL + collaborations refactor done in slice 9)_
_(Spark auto-save shipped — see Session log "post-audit item 1")_
_(realtime non-chat shipped — migration 022, item 2)_
_(notifications migration shipped — migration 023, item 3)_
_(OAuth scaffolding shipped — migration 024 + Edge Function + client
helper; ConnectPlatformModal wired in Phase 50 — falls back to mock
when env vars missing, real flow activates once dev-portal apps are
registered)_
_(All Supabase Security Advisor warnings cleared except the
dashboard-only "leaked password protection" toggle — see migration
027 + 028)_
_(All Supabase Performance Advisor "real" warnings cleared — only the
INFO-level "unused index" findings remain, intentionally; see
migration 029 for the policy)_

- **Per-platform OAuth registration** — `connectPlatform()` is wired
  but throws `OAuthNotConfiguredError` until each platform's
  `VITE_<PLATFORM>_CLIENT_ID` env var is set + the matching app is
  registered on its dev portal (Meta / TikTok / Google / X). Each
  platform can land independently. Substack has no public OAuth — see
  `app/supabase/functions/oauth-callback/README.md` for the per-platform
  steps + the RSS-verification workaround.
- **Spark LLM Edge Function deployment** — `spark-chat` Edge Function
  is scaffolded; activates once `ANTHROPIC_API_KEY` is set in
  Supabase secrets and the function is deployed. Without it, Spark
  falls back cleanly to the scripted engine.
- **Leaked-password protection toggle** — Supabase dashboard →
  Authentication → Providers → Email → "Enable leaked password
  protection". Cannot be done via SQL; one-click toggle.
- **scheduledNotifications migration** — the heartbeat queue is still
  local-only. Lower priority than notifications proper because the
  queue is regenerated from current state on every boot.
- **1099 generation** — W-9 / W-8BEN capture shipped (Phase 50 item
  #9 + TaxFormModal). Year-end IRS form generation needs Stripe
  Connect's tax-reporting endpoints, blocked on real-money infra.
- **Real-money infra** — Stripe Connect for actual escrow + payouts,
  SES/SendGrid for real email delivery. Out of scope for the
  prototype.
- **Sentry / observability** — flagged in the architecture-map's
  product-readiness recap. Zero observability today; first prod bug
  is invisible. ~30-min wire-up; should ship before paying customers.
- **Dead-code purge candidate** — _partially resolved. `ComingSoon.tsx`
  deleted (Phase 55 C-batch); Phase 58 separately purged 24 other dead
  files (~4,500 lines — 22 unused modals + `InboxView` +
  `CreatorProfileDrawer` + `NotificationPrefsCard`)._ Still standing from
  the original Phase 53 finding: `CampaignCalendar.tsx` +
  `CampaignTimeline.tsx` (2 orphan files unused since initial commit) +
  7 dead exports across `v2CreatorActions.ts` (rate-card
  add/update/remove, work/review reorder) and `v2DisputeActions.ts`.
  Left in place because the user may still ship those features.

---

## Session log

Append a one-line entry here per session so future sessions see what
was just shipped.

- **2026-05-11 → 2026-05-12 (this thread)** —
  - Phases 1–10 backend migration (auth through realtime chat)
  - Phase 6 contracts, Phase 7 transactions, Phase 8 lite reviews/disputes,
    Phase 9 outreach, Phase 10 threads/messages + realtime
  - Workspace audit: 39/40 functional items shipped
  - Phases 11–15 audit follow-ups: thread moderation, message attachments,
    campaign assets, team invites, spark drafts
  - Modal audit: batch 1 (validation hints) + batch 2 (data preservation)
  - Cross-device auth fix: sessionSync.ts + brands/creators owner_email fallback
  - Browser back-button fix: workspace URL-based tab routing
  - Stale-bundle recovery via vite:preloadError listener
  - This log file created

- **2026-05-13 (workflow audit — 7 slices, ~24 mutations updated, +49 tests, 2 new migrations)** —
  - **User-reported bugs fixed** (verified end-to-end in browser):
    - Sarah self-message in inbox — ConversationList row label was using
      creator.name unconditionally; now persona-aware (Inbox.tsx)
    - Aesop workspace teleport on deal/campaign open — Workspace.go()
      auto-flipped persona to brand on drilldown routes; getViewerUserId
      then fell back to DEMO_BRAND_USER_ID (Hannah). Both fixed:
      drilldowns no longer flip persona; getViewerUserId returns empty
      when persona doesn't match instead of leaking another user's id.
  - **Critical audit findings closed:**
    - Escrow phantom — v2AcceptOffer/v2AcceptCounter clamped wallet via
      `Math.max(0, wallet - rate)` but credited full escrow regardless.
      Now refuses the accept when wallet < rate.
    - Stage gates — v2ApplyToCampaign rejects unless `camp.stage='live'`;
      v2SubmitContent requires an accepted offer + live campaign;
      v2AcceptOffer/Counter/ApproveContent/RequestRevision/SendOffer
      all live-only.
    - Budget cap — v2SendOffer refuses when `committed + rate > budget`.
    - Revision cap — MAX_REVISIONS=3 enforced via brand-feedback count.
    - Withdraw clearance gate — refuses if open dispute OR submission
      still in 7-day dispute window.
    - Counter-rate sanity bound — refuses rate > 10× original; UI shows
      "+N% vs $X" delta hint.
    - Budget edit floor — `api.campaigns.update` rejects when proposed
      budget < spent+escrow+open-offers.
    - Cancel-collab UX wired both sides (brand request button +
      creator agree/decline banner) — v2RequestCollabCancel was
      previously unreachable from any UI.
    - v2ApproveContent fallback rate removed — was `camp.budget / N`
      when no accepted offer; could drain unrelated escrow.
    - cancelCollabInternal refund symmetry — both legs use fromCampaign
      (no more phantom dollars on partial-escrow edge case).
    - Dual-stage `paid` drift — deriveCollab now matches computeCollabStage
      (latestSub.status='approved' && isLive && hasPayout && campIsClosed).
    - v2EndCampaign cleanup — pitched/negotiating collabs no longer
      stranded as "awaiting brand response" forever.
    - Stale-offer auto-expiry — v2SweepStaleOffers fires on Workspace
      mount, flips pending/countered offers older than 14 days to expired.
  - **Ownership / cross-account fixes:**
    - CampaignDetail + CollabDetail enforce ownership before rendering
      mutation UI (brand must own the campaign; creator must own the
      collab).
    - View profile button for creator persona now routes to brief view
      instead of the broken `creator:<brandId>` path.
    - djb2 → FNV-1a 64-bit deterministic user-id hash (collision-free
      at platform scale; identical formula in client.ts + sessionSync.ts).
  - **Settings + persistence + onboarding:**
    - Settings tab on CampaignDetail now persists via new v2UpdateCampaign
      mutation; campaignsRepo UpdatablePatch extended with title /
      pitch / category / region / autoShortlist columns.
    - BrandOnboardingV2 + CreatorOnboardingV2 now persist their wizard
      fields via v2UpdateBrand / v2UpdateCreatorIdentity + v2AddCreatorChannel
      (pre-fix the "Get started" / "Publish" buttons just routed,
      discarding everything typed).
    - KYC verification now writes `kycVerifiedAt` ISO timestamp so the
      scheduler's 365-day reminder actually enqueues.
    - NaN guards — new `parseNumberInput` helper in `format.ts` applied
      to all money-bearing numeric inputs (SendOfferModal, CounterOfferModal,
      BrandWallet, CreatorWallet, NewCampaignWizard, BriefDetail).
    - Team-invite expiry — 14-day TTL via `expiresAt` column +
      v2AcceptTeamInvite rejection with reason='expired'.
    - Manager seats in v2 — getViewerUserId + useV2CurrentCreator now
      accept users with `managesCreatorIds[]` (fall back to first
      managed creator).
  - **New v2 surfaces (modals previously unreachable):**
    - LeaveReviewModal — wired to paid-stage banner on CollabDetail.
    - RaiseDisputeModal — wired to a "raise dispute" link on CollabDetail
      stages confirmed/submitted/approved/live.
    - AdvanceModal — wired to CreatorWallet topbar when pendingBalance
      × 0.8 ≥ $100 AND no active advance.
    - Counter-cap dual-side notifications (v2CounterOffer / v2CounterCounter
      both notify brand + creator when 4-round cap exceeded).
  - **Migration 019 — tighten_rls.sql:**
    - Added `is_participant_of_campaign(p_campaign_id)` helper.
    - transactions INSERT now gated on auth-is-participant for
      non-topup/non-referral kinds.
    - reviews INSERT + UPDATE gated on participant.
    - disputes INSERT + UPDATE gated on participant.
    - campaign-assets bucket INSERT/DELETE gated on
      is_brand_owner_of_campaign(path-first-segment).
    - message-attachments bucket INSERT/DELETE gated on
      is_participant_of_campaign(thread.campaign_id).
    - team_invites.expires_at column added (14-day TTL).
  - **Migration 020 — optimistic_locks.sql:**
    - `version integer not null default 0` added to campaigns / offers
      / applications / submissions / collaborations / disputes (the
      six highest-risk mutation tables).
    - Shared helper `src/lib/data/optimisticLock.ts` exports
      `StaleVersionError` + `isNoRowsError`.
    - 5 of 6 repos (collaborations uses upsert — out of scope for this
      pass) accept optional `expectedVersion?: number` parameter; the
      UPDATE gates on `version = expectedVersion` and bumps to
      `version + 1`. PostgREST "no rows" responses translate to typed
      `StaleVersionError`.
    - Mirror functions (campaign / offer / application / submission)
      catch StaleVersionError and surface a toast: *"Couldn't save X
      — another tab updated it. Refresh to see the latest."*
    - Caller wiring (passing expectedVersion through every v2 mutation
      site) is the next slice — infrastructure is in place but the
      mirrors still call without the version param.
  - **Idempotency audit — 5 mutations had missing guards, all fixed:**
    - v2WithdrawApplication — early-return on `status === 'withdrawn'`
    - v2MarkContentLive — early-return when LIVE: feedback exists
    - v2RaiseDispute — single-open-dispute-per-collab guard
    - v2InviteCreator — no-dupe-brand-invite-history guard
    - v2SendOffer — no-parallel-pending-offers guard
  - **RTL component-test infrastructure + 49 new tests:**
    - Added `@testing-library/react` + `@testing-library/jest-dom` + jsdom
    - vitest.config.ts now matches `.test.tsx` glob; jsdom env per file
      via `@vitest-environment jsdom` docblock; setup file loads
      jest-dom matchers
    - New tests:
      - CounterOfferModal (7) — delta hint + 10× cap + dispatch
      - SendOfferModal (6) — rate validation + below-floor warning
      - threadToV2 (5) — Sarah self-msg regression at adapter layer
      - LeaveReviewModal (6) — star + textarea gating
      - RaiseDisputeModal (6) — category + description gating
      - StageActionBanner (19) — full state × sub-state banner matrix
  - **Modal + component extractions (testability):**
    - LeaveReviewModal extracted from CollabDetail.tsx
    - RaiseDisputeModal extracted from CollabDetail.tsx
    - StageActionBanner extracted from CollabDetail.tsx (~190 lines)
    - CollabDetail.tsx net ~340 lines smaller
  - **Dead-code cleanup:**
    - Deleted src/screens/deal/DealActionBanner.tsx (Phase 25 redesign;
      superseded by workspace-v2)
    - Deleted src/components/today/TodayQueue.tsx +
      TodayDealRow.tsx (Phase 26 rebuild; superseded by BrandHome/
      CreatorHome). 3 files + 2 empty directories purged.
  - **Test count delta:** 377 → 426 (49 new tests, all passing). TSC clean.

- **2026-05-13 (slice 8 — optimistic-lock caller wiring)** —
  - Added `version?: number` to Campaign / Offer / Application /
    Submission / Dispute types in `src/lib/api/types.ts`.
  - 5 repos (`campaignsRepo`, `offersRepo`, `applicationsRepo`,
    `submissionsRepo`, `disputesRepo`) updated `toX` row mappers to
    surface `version` from server reads. Hydration overlay flows it
    into the local store automatically.
  - 4 mirror functions in `v2CampaignActions.ts` (campaign / offer /
    application / submission) + 1 in `v2DisputeActions.ts` now look
    up `expectedVersion` internally via `useStore.getState().db.<table>.
    find(...)?.version` (zero caller changes across ~22 mirror sites).
  - On successful mirror UPDATE, the returned row's new `version` is
    written back to local state via a new `writeBackVersion(table, id,
    version)` helper that bypasses `tx()` (synthetic local-only field
    bump — no mirror loop). Same shape inlined in v2DisputeActions for
    the dispute mirror to avoid a circular import.
  - Behaviour: lock is fully wired. In local-only dev (no Supabase
    configured) mirrors early-return so the lock is dormant. Against
    a live Supabase that has migration 020 applied, cross-tab races
    surface as `StaleVersionError` → toast: *"Couldn't save X — another
    tab updated it. Refresh to see the latest."*
  - Tests + TSC: still 426/426 green; no regressions.

- **2026-05-13 (slice 9 — collaborations refactor + parent-screen RTL)** —
  - **Collaborations repo refactored** — `upsertCollabInSupabase` was
    the only mutation path left without an optimistic lock (the upsert
    pattern doesn't naturally accept a `where version = ?` predicate).
    Replaced with `writeCollabInSupabase(c, expectedVersion?)` that
    does an explicit two-step:
    1. If expectedVersion is known: UPDATE with `where id AND version`.
       On no-rows: probe whether the row exists. Exists with different
       version → StaleVersionError. Doesn't exist → fall to step 2.
    2. INSERT with version=0. Duplicate-key races translate to
       StaleVersionError for uniform caller handling.
    Original `upsertCollabInSupabase` symbol kept as a deprecated alias
    so existing imports don't break.
  - **Collab mirror in collabSync.ts** now reads `collab.version` as
    expectedVersion, passes through to writeCollabInSupabase, catches
    StaleVersionError → toast, and writeBacks the bumped version to
    the local store via setState (bypassing tx() — synthetic field bump).
  - **Collaboration type** got `version?: number`; toCollab maps it.
  - **Parent-screen RTL smoke tests** — 12 new tests across 3 screens:
    - BrandHome (4): topbar chrome, live-count crumb, New campaign +
      Spark Send CTA dispatch
    - CreatorHome (3): empty state when no creator, `Hi <FirstName>`
      title, lifetime earnings render
    - CampaignDetail (5): owner sees campaign; **ownership gate refuses
      non-owner** with 3 variants (other brand, no brand, "View public
      brief" CTA dispatch); not-found state. The gate was the slice-1
      cross-account leak fix; tests now pin it permanently.
  - Test count delta: 426 → 438 (+12). TSC clean.

- **2026-05-13 (slice 10 — brands + creators optimistic locks)** —
  - **Migration 021** (`app/supabase/migrations/021_optimistic_locks_v2.sql`) —
    adds `version integer not null default 0` to `public.brands` and
    `public.creators`. The other 6 versioned tables already shipped in
    migration 020; this slice closes the parity gap.
  - **`Brand` + `Creator` types** got `version?: number` (optional so
    pre-migration rows keep type-checking). Both repos extended their
    `Row` type, `COLUMNS` const, and `toX` mapper to surface it.
  - **`updateBrandInSupabase` + `updateCreatorInSupabase`** now accept
    `expectedVersion?: number` and gate the UPDATE on `where id AND
    version`. PostgREST no-rows is translated to `StaleVersionError`
    using the same `isNoRowsError` helper from `optimisticLock.ts`.
  - **Call-site wiring**:
    - `v2UpdateBrand` (in `v2CampaignActions.ts`) reads
      `useStore.getState().db.brands.find(b => b.id === brandId)?.version`
      as expectedVersion, passes to repo. On success, `serverResult` is
      written back into the local tx so the next edit uses the bumped
      version. `StaleVersionError` propagates to `BrandProfile` /
      `BrandOnboardingV2`, where the existing `catch (e) → pushToast`
      blocks surface "Stale version on brand:... — another writer
      updated this row." to the user. No new catch wiring needed.
    - `mirrorCreatorToSupabase` (in `v2CreatorActions.ts`) reads
      `creator.version` post-tx, calls repo with expectedVersion, and on
      success writes the bumped version back to the local store via
      direct `useStore.setState` (bypassing `tx()` — synthetic field
      bump, not a workflow event). `StaleVersionError` → friendly toast
      *"Couldn't save creator profile — another tab updated it. Refresh
      to see the latest."*
    - `v2ToggleSavedBrief` (in `v2Hooks.ts`) captures `creator.version`
      inside the tx, passes through, writeBacks the new version. Low-
      stakes bookmark list — StaleVersionError silently dropped (next
      toggle will read fresh state and succeed).
  - Behaviour: full parity with the 6-table slice 8. Cross-tab races on
    brand profile / creator storefront / savedBriefs all funnel through
    `StaleVersionError`. Local-only dev still works (mirrors early-
    return when Supabase isn't configured).
  - TSC clean. Tests 438/438 green — no regressions, no new tests
    required because the mirror functions are already covered by the
    slice-8 conformance pattern and direct write integrations.

- **2026-05-13 (post-audit item 1 — Spark draft auto-save)** —
  `Spark.tsx` previously only persisted on explicit "Save draft"
  click; tab-close lost in-progress plans. Added a 1500ms-debounced
  auto-save that fires `v2SaveSparkDraft` silently after the last
  history/context mutation. New helpers:
  - `runSave(showToast: boolean)` factors the save logic so both the
    manual button (toasts) and the auto-save (silent) share the path
  - `lastSavedSignatureRef` (JSON of `{history, context}`) suppresses
    redundant writes after a load
  - `mountedRef` skips the very first effect run so the welcome
    message doesn't auto-save itself
  - Topbar shows a `Saving… / Saved · just now` pill that auto-reverts
    to idle 3s after success
  - `handleSaveDraft` cancels any pending debounce so an explicit
    click takes precedence
  - `handleLoadDraft` + `handleReset` seed/clear the signature so
    cross-load behaviour stays clean

  Commit `f2437a4`. Browser-verified: send a message, draft persists
  in the dropdown within ~2-3s without clicking Save.

- **2026-05-13 (post-audit item 2 — realtime for workflow tables)** —
  Migration `022_realtime_workflow.sql` adds campaigns / offers /
  applications / submissions / collaborations / disputes to the
  `supabase_realtime` publication. Companion `realtimeWorkflow.ts`
  subscribes via `supabase.channel('workflow').on('postgres_changes',
  ...)` for each table, normalises rows through the (newly exported)
  `toX` mappers, and overlays into useStore by id. Includes a
  version-aware overlay (`incoming.version <= existing.version` →
  skip) so an out-of-order broadcast can't clobber a freshly applied
  optimistic-lock writeBack. Mounted at boot in `store.ts` alongside
  `mountChatRealtime`. RLS still gates which rows each subscriber
  receives, so broadcasts respect the SELECT policies.

  Commit `8ead617`. 438/438 tests passing.

- **2026-05-13 (post-audit item 3 — notifications migration)** —
  Migration `023_notifications.sql` ports `db.notifications` from
  Zustand-only to Postgres. Schema mirrors the TS Notification type
  with `owner_email` as the RLS gate (same pattern as brands /
  creators). INSERT is permissive (any authenticated session) because
  user A sending an offer needs to write a notification row for user
  B; SELECT/UPDATE are restricted to the owner. Realtime added so a
  notification written on Device A reaches Device B without a reload.
  Wiring:
  - `notificationsRepo.ts` with `toNotification`,
    `fetchAllNotificationsFromSupabase`, `insertNotificationInSupabase`,
    `markNotificationsReadInSupabase`
  - `client.ts pushNotification`: queueMicrotask mirror after the
    parent `tx()` commits, so all 25+ call sites get cross-device
    notifications for free
  - `client.ts markAllNotificationsRead` + `NotificationsBell.tsx
    onItem` / `ackOne`: mirror the read-state flip
  - `realtimeWorkflow.ts` subscribes to notifications too (no version
    check — append-only + idempotent read flip)
  - `store.ts` hydration joins notifications in the boot Promise.all
    + overlay

  Commit `35fb76f`. 438/438 tests passing.

- **2026-05-13 (post-audit item 4 — OAuth scaffolding)** —
  Infrastructure-only — real flow needs the user to register apps on
  each dev portal. Delivered:
  - Migration `024_platform_tokens.sql`: per-creator-per-platform
    token storage with RLS (SELECT own only; INSERT blocked from
    non-service-role since the Edge Function uses service_role).
    Includes a read-only `creator_channel_verified` view that
    exposes a verified-boolean without leaking tokens
  - `supabase/functions/oauth-callback/index.ts`: Deno Edge Function
    that handles the redirect, exchanges the auth code for tokens
    per platform (IG / TikTok / YouTube / X fleshed out; newsletter
    stubbed — Substack has no public OAuth), upserts into
    platform_tokens via service_role, then postMessages
    success/failure back to the opener window
  - `oauth-callback/README.md`: step-by-step per-platform dev-portal
    setup, secret-key names, authorize-URL templates,
    token-rotation guidance
  - `src/lib/oauth/connectPlatform.ts`: client-side popup helper
    that opens the platform's authorize URL with base64-encoded
    state, listens for the postMessage. Throws
    `OAuthNotConfiguredError` when the client_id env var isn't set
    so `ConnectPlatformModal` can fall back to the mock
    `v2VerifyChannel` path

  Not yet wired into `ConnectPlatformModal` (still calling the mock).
  Each platform can land independently once its dev-portal app is
  registered + secrets set + Edge Function deployed.

  Commit `b5e0dc7`. 438/438 tests passing.

- **2026-05-14 (Phase 50 — workflow polish + admin moderation +
  KYC capture + OAuth wiring)** —
  Six features bundled because they share the v2-actions / hooks
  surface. Items #4-#7 + #9 from the post-architecture-map roadmap.
  - **#4 ConnectPlatformModal wired to `connectPlatform()`** —
    real OAuth popup for IG/TikTok/YT/X, falls back to existing
    mock flow on `OAuthNotConfiguredError` or for Newsletter /
    LinkedIn (no OAuth scaffold). Reads ownerEmail from session
    for the state payload.
  - **#5 Admin reports queue** — new `AdminReports.tsx` tab in
    `/admin/queue?type=reports`. Lists every Thread with
    `reportedAt != null` (Phase 11's report flow finally has a
    resolver surface). Dismiss / Action-taken buttons clear the
    report fields. Tab counts roll into the unified-queue total.
  - **#6a Bulk approve in CampaignDetail content-review** —
    per-card checkbox + selection ring + sticky "Approve N" button.
    Each approval still goes through `v2ApproveContent` (escrow
    release + notifications fire per-row).
  - **#6b Saved offer templates** — `Brand.offerTemplates:
    OfferTemplate[]`. `useV2OfferTemplates` + `v2SaveOfferTemplate`
    + `v2DeleteOfferTemplate` hooks. Picker + "Save as template"
    in `SendOfferModal` with `{firstName}` token substitution.
  - **#7 Calendar view** — new persona-aware tab. Hand-rolled
    month grid, deadline chips per day, click → routes to
    `collab:<id>`. Reads `useV2Campaigns` +
    `collabsForCampaign / collabsForCreator`. Topbar crumb shows
    "N overdue · M due in next 7 days". `Icon.calendar` added.
  - **#9 Tax form capture** — `TaxFormRecord` on `Creator.taxForm`.
    `TaxFormModal`: pick-form (W-9 vs W-8BEN) → fields → typed-
    signature attestation. `v2SaveTaxForm` action. `KycTax`
    `buildSteps` flips the tax-form step from locked → action →
    verified.
  - Commit `7a5f6bc`. TSC clean. 438/438 tests.

- **2026-05-14 (Phase 50 item #8 — Spark LLM Edge Function)** —
  Replaced the scripted-only reply path with a hybrid: scripted
  engine still runs for context updates + non-text blocks (creator
  cards, brief drafts), and the prose text block is substituted
  with a real Claude completion when the Edge Function is reachable.
  - `supabase/functions/spark-chat/index.ts` — Deno proxy to
    Anthropic `/v1/messages` with `claude-sonnet-4-6` + brand /
    category / budget context. Returns SparkBlock-shaped JSON.
    503 with `code: missing_key` when `ANTHROPIC_API_KEY` isn't
    set so the client falls back cleanly.
  - `sparkEngine.ts tryRemoteText(input, history, context)` helper.
    Always swallows errors; never throws.
  - `Spark.tsx handleSend` races scripted + remote. Scripted reply
    renders at the thinkingDelay tick; remote text replaces the
    text body if it returned within the window.
  - Commit `7e9e62a`.

- **2026-05-14 (Phase 50 item #10 — Playwright e2e)** —
  5 tests covering the spine. `@playwright/test` devDep,
  `playwright.config.ts` chromium-only single-worker reusing
  `npm run dev`, `e2e/offer-to-live.spec.ts`. npm scripts:
  `e2e`, `e2e:headed`, `e2e:install`. Approve / mark-live skipped
  in suite — covered by the manual smoke pass.
  Commit `0b7d9a4`.

- **2026-05-14 (architecture-map.html)** —
  Single-file interactive diagram of the system at the repo root
  (also copied to `app/public/`). 6 clusters · 86 nodes · 183
  edges · 25 critical-path nodes. Filter chips: Overview / Offer→
  Live spine / Auth / Discover / Inbox / Analytics / Spark /
  Wallet / Realtime / All wires / Roadmap & bugs. Pan + zoom +
  Fit/+/-. Click node → sidebar with role + plain-English + path
  + notes + every incoming / outgoing edge. Default sidebar
  surfaces "Notable findings" — critical seam, dual stage-
  computation paths, pushNotification fan-out, mock OAuth still
  live, realtime cohort growth, scripted Spark engine, zero dead
  exports. FIXES + KNOWN_BUGS registries populated from this log.
  Commit `8cf22b2`.

- **2026-05-14 (Phase 51 — bug-bash from real testing pass)** —
  Five user-reported bugs (and one related class).
  - **#1 Brand couldn't open submitted file.** Whole upload→review
    path was broken: `ContentUploadModal` stored only `{name, size}`
    metadata and dropped the actual `File`; `v2SubmitContent`
    persisted `{name, url: '#'}`; `ContentReviewModal` had no
    file-rendering logic. Fix: keep real File in state, encode as
    base64 data URL on submit (cap 25MB inline), widen
    `v2SubmitContent` signature to `string | {name, url, mime?,
    size?}`, render proper preview (`<video>` / `<img>` /
    `<iframe pdf>` / download link) based on MIME or extension.
    Multi-file thumbnail strip. Production note: real flow needs
    Supabase Storage upload to `submission-files` bucket.
  - **#2 Confirm-live modal kept re-opening.** Root cause:
    CampaignDetail's auto-open useEffect for `?action=verify-live`
    had `db.submissions` in its deps. `v2MarkContentLive` mutates
    that → effect re-fires → modal reopens. Same bug class on
    `?review=<collabId>`. Fix: ref-guard pattern
    (`verifyLiveAutoOpened` / `reviewAutoOpened`) bails when same
    ID is already opened.
  - **#3 "Needs you" tile didn't disappear items.** Symptom of
    #2 — the tile IS reactive. With the modal-reopen loop fixed,
    items disappear correctly.
  - **#4 "Needs you" tile capped at 4.** Hard 4-item cap embedded
    across every collection loop in BrandHome's `inboxItems` and
    CreatorHome's `todoItems`. On Aesop's pipeline, 290 of 294
    items were silently hidden. Fix: removed every
    `items.length < 4` gate + added `max-height: 360px;
    overflow-y: auto` to the row containers.
  - **#5 Hunt for related bugs.** Audited every `useEffect` with
    `db.X` deps, every URL-action auto-open, every placeholder URL
    site. Found one extra (CampaignDetail auto-open) and fixed it.
    `CollabDetail` and `BrandWallet` auto-opens use
    `[initialAction]` deps only — already safe.

  Browser-verified: Aesop home shows 294 items in scrollable
  Needs-you tile; clicking a verify-live opens the modal;
  confirming dismisses cleanly with no re-open.
  Commit `73c3fd5`. 438/438 tests passing.

- **2026-05-14 (Phase 52 — security hardening pass)** —
  Manual security review across the codebase. Three CRITICAL +
  one HIGH finding fixed.
  - **CRITICAL — PII leak via public Creator + Brand SELECT.**
    `001`/`004` policies were `for select using (true)` exposing
    every column to anon: bank account / IBAN, wallet balance,
    pending balance, lifetime earnings, owner email — and the
    `BankAccountModal` even claimed "encrypted at rest, never
    shared with brands" while writing the raw IBAN to a
    publicly-readable column. Fix: migration `025_pii_lockdown`
    creates `creators_public` + `brands_public` views with
    `security_invoker=on`. Anon + authenticated SELECT on the
    views only. Raw-table SELECT tightened to owner-only
    (`auth.email() = owner_email`). Repos: `fetchAll` reads from
    public view with `PUBLIC_COLUMNS` (no PII); zeros fill
    private fields. New `fetchOwnCreatorFromSupabase` +
    `fetchOwnBrandFromSupabase` pull the signed-in user's own row
    from the raw table. `store.ts` boot hydration overlays.
  - **CRITICAL — XSS via MIME-spoofed PDF in iframe.**
    `ContentReviewModal` rendered submission files as `<iframe>`
    when extension OR MIME claimed PDF; a creator could upload
    `evil.pdf` whose bytes are HTML and execute scripts against
    the brand's session. Fix: `previewKind()` requires PDF MIME
    AND extension to agree, OR a self-describing data URL whose
    declared MIME is `application/pdf`. `<iframe sandbox="">`
    explicitly drops same-origin + script execution. New
    `isSafeFileUrl()` blocks `javascript:` / `vbscript:` /
    `data:text/html`.
  - **CRITICAL — OAuth postMessage origin not validated.**
    `connectPlatform.ts` accepted any-origin `{type: 'alamut-oauth',
    ok: true}` postMessage; an attacker could open the popup
    themselves + forge success. Fix: derive `expectedOrigin` from
    the Edge Function URL via `new URL()`, reject any message
    where `e.origin !== expectedOrigin`. Belt-and-suspenders
    `e.source === popup`.
  - **HIGH — Storage path-traversal in INSERT/UPDATE/DELETE.**
    The brand-logos / creator-portraits / submission-files /
    campaign-assets / message-attachments policies used
    `split_part(name, '/', N)` but didn't reject `..`. Fix:
    migration `026_storage_path_validation` — new
    `is_safe_storage_path(name, expected_segment,
    expected_total_segments)` helper rejects `..`, backslashes,
    leading slashes, empty segments, wrong segment counts.
    Re-applied every storage policy on top of the helper.

  Documented MED findings (deferred — accepted demo-mode
  trade-offs): permissive notifications INSERT, persona resolver
  fallback to demo user, localStorage session trust for client
  checks (RLS is the actual defense layer).
  Commits `462e227` (the four fixes) + migrations `025_*` + `026_*`.

- **2026-05-15 (Supabase Security Advisor lint sweep — migration 027)** —
  User downloaded the Security Advisor lint CSV and asked to
  triage. 22 warnings, all addressed in `027_supabase_lints.sql`:
  - `function_search_path_mutable` (4) — `ALTER FUNCTION ... SET
    search_path = ''` on `touch_updated_at`,
    `is_brand_owner_of_campaign`, `is_brand_owner_of_brand`,
    `is_creator_owner` + the helpers added later
    (`is_participant_of_campaign`, `is_safe_storage_path`).
    Blocks schema-injection via earlier-search-path schemas.
  - `rls_policy_always_true` (10) — replaced legacy
    `_authenticated` INSERT/UPDATE policies on transactions /
    reviews / disputes / outreach / threads / messages with
    `_gated` versions using a new `is_user_id_owned_by_caller(text)`
    helper that joins to brands+creators on
    `owner_email = auth.email()`. Per-table gates: caller owns
    wallet OR participates in campaign; from_user_id matches
    caller; campaign-anchored or participants[] includes caller;
    etc. Migration 019 had attempted some of these but evidently
    never landed in the cloud DB — 027 finishes the job
    idempotently.
  - `public_bucket_allows_listing` (5) — dropped
    `brand_logos_public_read` / `creator_portraits_public_read`
    / `campaign_assets_read` / `message_attachments_read` /
    `submission_files_public_read`. Direct URL fetches still work
    (bucket `public=true` flag); enumeration via `.list()` is
    blocked.
  - `*_security_definer_function_executable` (1+1) — `REVOKE
    EXECUTE on rls_auto_enable() from public, anon,
    authenticated`.
  - `auth_leaked_password_protection` (1) — dashboard-only
    toggle; documented.
  Commit `13f39a7`.

- **2026-05-15 (Supabase CLI wiring + applying 019-027 to remote)** —
  User asked to apply migrations via CLI. Set up:
  - `supabase` devDep in `app/package.json`. New scripts:
    `sb`, `sb:login`, `sb:link`, `sb:diff`, `sb:push`, `sb:lint`.
  - `app/supabase/config.toml` via `supabase init`.
  - First install accidentally landed at repo root; cleaned up
    + reinstalled inside `app/`.
  - **Migration history was missing on the linked DB** — the
    Security Advisor lint had flagged `transactions_insert_authenticated`
    etc. that 019 was supposed to have killed. Confirmed: the
    `supabase_migrations.schema_migrations` table didn't exist on
    remote, meaning the cloud schema had been built ad-hoc via
    dashboard SQL without the CLI ever tracking it.
  - **Workaround:** applied each pending migration via
    `npx supabase db query --linked -f supabase/migrations/<file>.sql`.
    Ran 019 → 027 in order. All clean.
  - Re-running `supabase db advisors security --linked` post-apply
    showed: 22 warnings → 1 (the leaked-password dashboard
    toggle).
  Commits `26a0050` (CLI scripts) + `2a546ed` (cleanup) +
  `1a17924` (gitignore .temp).

- **2026-05-15 (Migration 028 — perf-warning sweep + view security_invoker)** —
  After 027 landed, advisor count went 22 → 21. Of the 21:
  1 ERROR `security_definer_view` (`creator_channel_verified`),
  19 WARN `auth_rls_initplan` (auth.email() called per-row),
  1 WARN dashboard toggle.
  - **`creator_channel_verified` view** — migration 024 created
    it without `security_invoker=on`, defaulted to definer (ran
    with view-owner privileges, bypassed RLS). Read-only public
    data but the wrong default is a footgun. Fixed via
    `ALTER VIEW ... SET (security_invoker = on)`.
  - **19 × auth_rls_initplan** — Postgres re-evaluates
    `auth.email()` per row when bare in a policy. Wrapping in
    `(select auth.email())` lets the planner cache it once per
    query. Same semantics, much faster at scale. Recreated 19
    policies across 7 tables (brands / campaigns / creators /
    notifications / platform_tokens / outreach / team_invites)
    with the optimized form. Bodies copied verbatim from
    `pg_policies`; only the auth call rewrapped.
  Final advisor count: 1 (dashboard toggle).
  Commit `fe1954d`.

- **2026-05-15 (Migration 029 — perf advisor: FK indexes + unused-index policy)** —
  Performance Advisor flagged 64 INFO findings.
  - **2 × `unindexed_foreign_keys`** — REAL FIX.
    `outreach.campaign_id` + `outreach.resulting_offer_id` had
    FK constraints but no covering indexes. Added partial
    indexes (`where ... is not null`).
  - **62 × `unused_index`** — INTENTIONALLY KEPT.
    The advisor reads `pg_stat_user_indexes.idx_scan` since stats
    reset; on a near-zero-traffic cloud DB, every index reads as
    "unused" — including FK indexes that back RLS policy lookups
    + JOINs, status / stage / kind indexes that back filtered
    workflow queries, `*_at_desc` indexes that back ORDER BY ...
    DESC LIMIT N feeds, GIN array indexes for `array @> ARRAY[...]`,
    owner_email indexes that back `auth.email() = owner_email`
    on every authenticated SELECT. Dropping any would create
    silent perf cliffs once real users land. Revisit after 4+
    weeks of real traffic.
  Commit `dc45b92`.

- **2026-05-15 (full-product audit — Phase 53)** —
  User asked for a complete audit. Ran build + tests in parallel
  with three Explore-agent sweeps + browser smoke on both
  personas.
  - **Build / tests / TSC:** clean, 13s production build, 545KB
    vendor + 534KB workspace gzipped to 163KB + 129KB. 438/438
    unit tests passing.
  - **Spine end-to-end:** intact. All 9 workflow actions verified
    (signature, capability gate, mirror, notification, collab-
    stage rollup). `v2SubmitContent`'s recent signature change
    correctly handled at every call site. `deriveCollab` (read)
    and `computeCollabStage` (write) still in lockstep.
  - **Schema vs TS types:** no drift. Only minor note —
    `Submission.disputeWindowClosesAt` is local-only (set by
    `v2ApproveContent`, never persisted). Tracked.
  - **Browser smoke (both personas, all 18 tabs):** all render,
    no crashes. Console: zero TypeError / ReferenceError / RLS
    errors. **30 instances of one duplicate-key React warning**
    — `key={ch.platform}` at 4 sites, all when a creator has
    multiple channels on same platform. Fixed with composite
    `${ch.platform}-${i}` keys at `Discover.tsx:1088`,
    `Analytics.tsx:287`, `CreatorProfile.tsx:188`, `Spark.tsx:682`.
  - **Dead code (noted, not fixed):** 3 orphan files unused
    since initial commit + 7 dead exports. Don't break anything,
    left in for possible future use.
  Commit `a09b7fe` (key fix).

- **2026-05-15 (Phase 53 — landing page polish pass)** —
  Five visual / UX bugs the user spotted on the marketing surface.
  - **Showcase mood-overlay obscured photos.** Pre-fix opacity
    0.30 with `mix-blend-mode: multiply` washed warm-toned photos
    out almost completely. Fix: opacity 0.30 → 0.18 default,
    0.16 → 0.10 hover. Added `isolation: isolate` on
    `.showcase-tile` so multiply blends only against the tile's
    own image (consistent across browsers). Commit `7d8bd79`.
  - **Showcase capture badge covered 99% of small tiles.** In the
    hero-grid variant tiles render at 42×42 px but the badge text
    "Spring drop · MAR '25" is wider than the tile, expanding
    the badge to cover the photo. The "//" the user reported was
    the `·` separator at small font size; the "yellow house" was
    a brand wordmark glyph. Fix: `display: none` on
    `.showcase-hero-grid .showcase-capture-badge`. Mood overlay
    still tints for brand signal. Commit `699ea91`.
  - **Hero overflowed viewport.** `.creator-hero-v2-h` and
    `.brand-hero-v2-h` declared `clamp(40px, 6vw, 84px)` but lost
    the cascade to `.cn-h-display`'s `clamp(56px, 9.5vw, 168px)`
    — same specificity, declaration order won. Computed
    font-size was 121.6px per line at 1280px. Total hero ≈ 876px
    on 800px viewport. Fix: chained the parent class to bump
    specificity to (0,2,0). Cap lowered to `clamp(40px, 5vw,
    68px)`, line-height 1.0, hero padding `clamp(48px, 7vw, 96px)`
    → `clamp(40px, 5vw, 72px)`. Both hero pages now fit (590px /
    683px on 800px viewport). Commit `73a5914`.
  - **Recent-placements masonry: column 4 short by 630px.**
    `column-count: 4` with `column-fill: balance` + 18 indivisible
    tiles of mixed aspects → cols 1-3 took 5 tiles each
    (~5.13 height units), col 4 got the leftover 3. Fix: lowered
    count from 18 → 16 (4 per column avg). Cols now 1138 / 1208
    / 1138 / 1138 (5% variance, was 42%). Headline copy changed
    "Eighteen closed deals" → "Recent closed deals" so it
    survives future tuning. Commit `d37a594`.
  - **PressStrip "Publication 1 / 2 / 3 …" placeholders + broken
    testimonial portraits.** §5.7 had replaced real publication
    names with `Publication N` on IP grounds — looked unfinished.
    Replaced with fictional-but-plausible trade-press names
    (Marketplaces Brief, Stack Daily, Markets Wire, Signal
    Quarterly, Compounding, The Briefing, Founders Edition, Pro
    Markets, Sector Letter, Industry Desk). For the broken
    portraits: `upx()` helper naively prepended the Unsplash base
    URL to inputs that were already full URLs, producing
    `https://images.unsplash.com/https://images.unsplash.com/...`
    (`naturalWidth: 0`). Fix: detect full URLs in `upx()` + an
    in-place sweep in `store.ts onRehydrateStorage` that
    rewrites the bad pattern in already-persisted localStorage
    (avoids bumping store version + flushing user state).
    Commit `ba9290c`.

---

### 2026-05-21 → 2026-05-22 — Phase 54-57 — workspace-v2 consistency sweep (35+ surface fixes)

A 6-commit run through the v2 workspace eliminating literal/fake data,
unwired CTAs, copy that misrepresented features, and cross-surface
mismatches. Worked within the project constraint that real external
APIs (platform OAuth, payment processor, view tracking, etc.) cannot
be wired right now — seed data was extended where deletion would gut
demo visual richness.

**Cumulative surface count touched: 35.**

#### Buckets

1. **A-batch (bug fixes)** — commit `289c023`, 14 files +392/-95:
   - A2: sidebar inbox count live from `useV2Conversations` (was literal 3/2)
   - A3: KYC tile renders only when `buildSteps()` reports pending
   - A4: CreatorWallet payout method reads real `creator.payout.account`
   - A5: Campaigns "active creators" derived from Live+Paused rosters
   - A6: BrandHome pacing pill computes drift (On plan / Over pace / Behind pace)
   - A7: Storefront crumb dropped fake "last updated 3 days ago"
   - A8: CreatorHome Achievement tiles from real myCollabs + channels
   - A9: Inbox conversation-list search input wired to filter
   - A10: BrandWallet "This month" sums cleared transactions
   - A11: OutcomeCard deltas from real weeklySeries
   - A12+A13: BrandAnalytics wk/wk delta + range filter wired

2. **C-batch (copy honesty + seed)** — commit `a5fe844`, 9 files +260/-148:
   - 3 new Creator seed fields: `storefrontViewsLast30d`,
     `brandInquiriesThisWeek`, `recentBrandViewerNames` (+ deltas + count)
   - StorefrontPulse + viewers strip read from seed (Sarah: 2,140 views,
     14 inquiries, Aesop/Glossier/Le Labo viewers); generated creators
     get tier-scaled values via `genCreator`
   - Tip of the day rotates from 5-tip array keyed by creator-id hash
   - ContentReviewModal: interactive checklist (was fake "Spark
     auto-check" rows)
   - Discover "Ask Spark" → "Quick prompts" with keyword chips that
     actually match the substring filter
   - Storefront channels tip reworded (no more "auto-pull metrics" lie)
   - Campaign Settings "Visibility" pseudo-control deleted
   - ComingSoon.tsx deleted (76 lines dead)

3. **B-batch (wiring gaps)** — commit `d633c0f`, 17 files +544/-78:
   - Brand-side reviews wired (LeaveReviewModal generalized
     `brandName` → `subjectName` + `subjectKind`; CTA on paid kanban
     cards; checks for already-reviewed)
   - KYC withdrawal gate: new `v2CanWithdraw()` returns structured
     rejection reason (kyc-not-verified, no-bank-account,
     open-dispute, in-dispute-window); modal surfaces specific copy
   - Spark "Lock in campaign" serializes shortlist + brief + projection
     into `campaign-new?…` query string
   - BrandHome SparkComposer passes typed prompt via `spark?prompt=…`
   - Cultural Calendar "Plan" CTAs pre-seed wizard with event
     name/deadline/category/brief
   - BriefMatches scores via `computeMatchScore()` (extracted from
     BriefDetail into v2Adapters)
   - "Send brief" CTA on Creator-of-the-Week → `creator:<id>`
   - PublicStorefront "Brief on Alamut" → `creator:<id>`
   - "Open deal room" hidden when already in detailed inbox mode
   - Admin Reports: new `Thread.suspended` + `actionTakenAt` +
     `actionTakenByUserId` + `actionNote` fields; "Action taken"
     button prompts for note + suspends thread; "Dismiss" stays as
     no-action path

4. **Adapter terminal-stage fix** — commit `ee8e82f`, 1 file +31/-2:
   - `deriveCollab` honors `Collaboration.stage === 'paid'` as a
     terminal override (signal-based derivation requires
     camp.stage='closed' + live submission + payout — seed data has
     none, so paid collabs were coerced to 'live' or 'approved')
   - Cancelled rows filtered from `collabsForCampaign` +
     `collabsForCreator` so they don't show up as ghost invites

5. **H-batch (high-severity cross-surface mismatches)** — commit `917cd55`, 7 files +258/-48:
   - H1 WithdrawModal accepts `payoutLabel` prop (was hardcoded "Bank
     ending 4291" for every creator)
   - H2 Calendar deliverable `due` = campaign deadline (was
     `submittedAt` — the whole Calendar overdue/next-7-days lied)
   - H3 BriefDetail applicants from `db.applications` (was
     deterministic hash random)
   - H4 AudiencePulse reads real per-platform audience seed
     (topCountries, growthRate30d, credibility) instead of hardcoded
     Karachi/Lahore/Islamabad
   - H5 derivePerf computes from accepted creators' actual reach + ER
     (was `reach = spent × 18`, `er = 11.5` literal)
   - H6 Wallet "Lifetime" = Σ cleared payouts (was seeded random
     `creator.lifetimeEarnings`)
   - **Bonus critical fix**: Supabase boot overlay in `store.ts:328`
     was blowing away locally-seeded `platforms[*].audience` +
     storefront-pulse fields on every page load. Added smart-merge
     overlay (`overlayCreators`) that preserves local-only demo
     fields when remote rows don't carry them. Owner-only PII overlay
     had same bug — same fix.
   - Persist schema bumped 13 → 14 to flush stale cached state

6. **M-batch (medium-severity alignments)** — commit `97926be`, 3 files +55/-13:
   - M7 BrandHome pacing "across N campaigns" plural fix
   - M8 BrandHome topbar crumb "X things need you" matches ActionInbox
     "X things blocking" (urgent shown as secondary stat)
   - M9 V2Campaign.live counts collabs at stage='live' or 'paid'
     (was approved-submissions count — diverged from kanban Live col)
   - M10 CreatorHome "X deliverables pending" from real
     myCollabs.deliverables (was `wallet.pending / 200`)
   - M11 CreatorHome BriefMatches "N brand(s)" plural fix
   - Also killed a stray "deliverables pending pending" double-word

#### Verified live (Sarah + Hannah demo accounts)

- StorefrontPulse: 2,140 views ↑28%, 14 brand inquiries ↑4
- Brand viewers strip: Aesop, Glossier, Le Labo, Reformation + 8 more
- AudiencePulse: 208K · ↑2,188 this week · USA 52%, UK 16%, Canada 10%
  · 18.1% ER · ✓ Audience credibility 96/100
- Achievement tiles: 25 collabs / 18.1% ER / Top tier reached
- Wallet: real account 4421 · lifetime from ledger · KYC-gated withdrawals
- Brand kanban: Pipeline 2 · Invited 1 with "Invitation sent · awaiting
  creator" + Send-offer fast-path
- Brand topbar: "Good afternoon · 328 things need you · 121 urgent · 13 live"
- Brand pacing: "In escrow $19.5K · across 13 campaigns"
- Spark composer round-trip: typed prompt → spark?prompt= → engine parses
  "Lifestyle · Lahore" facets
- Cultural Calendar Plan → wizard pre-seeded "Eid-ul-Adha '26"
- Pipeline Paid column: 3 cards each with "Leave review" CTA (cmp_g8)
- 438/438 tests pass; typecheck clean across all 6 commits

#### Final audit (2026-05-22) — 31 remaining findings

A focused agent sweep identified the items below as still-broken or
unwired, all distinct from what shipped in A/B/C/H/M. **In progress:**
fixing all local-fixable items now (Phase 58). See "Outstanding /
deferred items" section above for items that need backend connections
the prototype intentionally lacks.

**CRITICAL (fixing now, except #1 NotificationsBell which user
explicitly deferred pending a decision on whether notifications +
Recent Activity + Needs-you tile consolidate into one feature):**
- #2 TopupModal submit is a no-op (`BrandWallet.tsx:421-430`)
- #3 RouteOutlet fall-through to BrandHome on unknown route
  (`Workspace.tsx:499`) — creator persona can land on brand home
- #4 Inbox conversation list `display: none` at <760px
  (`workspace-v2.css:1028`) — mobile creator can't switch threads

**HIGH (fixing now):**
- #5 ConnectPlatformModal unmounted — delete (no real OAuth to wire)
- #6 Storefront audience block read-only — relabel honest
- #7 BrandOnboarding drops `creatorTier` + `monthlyBudget`

**MEDIUM (fixing the local-fixable ones now):**
- Archive / duplicate campaign (new mutations)
- Snooze thread (new mutation)
- Bulk-decline applicants
- Inbox: message-body search (LOCAL — fix)
- Inbox: typing indicator + read receipts (BACKEND — skip; document)
- realtimeWorkflow only INSERT (BACKEND — skip; document)
- New message toast (LOCAL — fix)
- /p/<campaignId> public route + robots + sitemap + OG SSR (DEPLOY —
  skip; document)
- Empty states for 0 campaigns / 0 collabs / 0 ledger (LOCAL — fix)
- A11y ESC handler on modals (LOCAL — single shared hook)
- Initial-boot loading skeleton (LOCAL — fix)
- StaleVersionError UX (LOCAL — small reload prompt)
- Mobile pipeline kanban (LOCAL — significant — fix as stack-on-mobile)
- Mobile wizard sticky preview (LOCAL — fix collapse)
- Mobile upload modal (LOCAL — fix padding)

**LOW (fixing local-fixable ones now):**
- 22 dead modal files in `components/modals/` + 3 legacy components —
  bulk delete
- Topbar `search` prop decorative on most call sites — make functional
  where wired, drop on others
- Ledger pagination (brand + creator)
- Edit-payout-method routes to `/kyc` (no anchor) — add scroll target
- Advance modal `purpose` captured but not sent — pass it
- ContentUpload >25MB silent break — add "Pending upload" pill on
  submission card
- MarkLive URL allowlist out of sync with `Platform` type union
- CreatorOnboardingV2 saves `payout.method` without `payout.account`
- Tax cert PDF generation (BACKEND — skip; document)
- Real platform OAuth via ConnectPlatformModal (BACKEND — skip;
  delete the modal)
- Stale-route teleport (covered by #3 fix above)

#### What's intentionally NOT fixed (backend / deployment dependencies)

The prototype runs without real external APIs by design. These items
need integrations that aren't in scope:

| Item | Why it needs backend |
|---|---|
| ~~NotificationsBell mount~~ | ~~User deferred pending feature consolidation decision~~ — **RESOLVED in Phase 64** (`5eafaef`): real bell now mounted in v2 `lib.tsx`, replacing the stub that toasted "all caught up" |
| Real platform OAuth (Instagram / TikTok / YouTube / etc.) | Each platform's OAuth + insights API; ConnectPlatformModal has the scaffolding but no real provider credentials |
| Realtime presence (typing indicator, online status) | Supabase Realtime presence channel — adds latency + reconnect logic |
| Realtime workflow UPDATE subscriptions | Currently INSERT-only; UPDATEs work in same-tab via store mutations, only matters cross-tab |
| Per-message read receipts | Schema + per-recipient state; deferred |
| SSR for `/c/<handle>` + `/p/<campaignId>` OG tags | Vercel page config / `next/head`; current OG tags set client-side won't render in FB/LinkedIn crawler previews |
| robots.txt + sitemap.xml | Deployment-time generation |
| Quarterly tax-cert PDF download | Server-side render (pdf-lib or similar) |
| File uploads >25MB | Supabase Storage path works; modal has known gap on URL persistence (file name kept, URL empty); demo accounts stay under the limit |

#### Tooling / approach notes (for future sessions)

- **Smart-merge overlay pattern (`store.ts:overlayCreators`)** is the
  pattern to use for any future Creator/Brand demo-only field. Adding
  a new field to types.ts + seed.ts is now sufficient; the overlay
  preserves local seed when Supabase doesn't carry the column.
- **Schema version bump (`store.ts:82`)** is required whenever a new
  Creator/Brand/etc. seeded field is added — Zustand persist won't
  flush stale state without it. Current: **v15** (Phase 59 storefront
  content preservation — work / rateCards / featuredReviewIds /
  savedBriefs / pressMentions / pastClients; v14 was Phase 56 audience +
  storefront-pulse seed).
- **`computeMatchScore` in v2Adapters** is the shared helper for any
  brief↔creator match scoring across surfaces (BriefDetail,
  CreatorHome BriefMatches; future: Discover ranking).
- **`v2CanWithdraw` + `withdrawalRejectionMessage`** pattern is
  reusable for any other mutation that needs to surface a specific
  rejection reason instead of a generic "failed" toast (e.g.
  application accept might benefit from this for "no escrow funds
  available" / "campaign closed" / etc.).
- **The `LeaveReviewModal`** now supports both `subjectKind: 'brand'`
  and `subjectKind: 'creator'`. Both directions of review fire
  `v2LeaveReview` with the right `reviewType`; surfaces consume via
  `db.reviews.filter(r => r.targetId === ...)`.

---

### 2026-05-22 → 2026-06-13 — Phases 58-67 — post-migration sweep + Fable-5 audit

> _Reconstructed 2026-08-08 from git history (`dc6c958..d5201d0`, 14
> commits). These sessions shipped and were pushed to `origin/main` but
> were never written up in the log before the working laptop was lost;
> the entries below are recovered from commit messages + diffstats, so
> they summarise **what** landed without the usual live-verification
> colour. Test counts are as stated in each commit (438 through P66,
> 444 after P67)._

A four-week run that executed the Phase 58 punch list, hardened every
`v2*` mutation against silent failure, unified collab-stage computation,
and did one aborted landing-page experiment. Net direction: no new
backend surface (still no real OAuth / payments / realtime presence),
but the client got materially more honest — actions now throw
user-readable errors instead of no-oping, and money/stage math was
reconciled to a single source of truth.

#### Phase 58 — 15-item bug-fix sweep — commit `0e7b9b2`, 40 files

Closed the 31-item audit list except the intentionally-deferred backend
items (real platform OAuth, realtime presence, SSR, PDF gen, >25 MB
uploads).

- **Critical:** TopupModal submit was a no-op (button closed the modal,
  no transaction) → wired to `api.wallet.topUp`; RouteOutlet now
  branches on persona (a creator with a stale route could land on
  brand chrome); mobile inbox drawer added (at <760px the conversation
  list was `display:none`, stranding the user on one thread).
- **High:** dead-code purge — **24 files / ~4,500 net lines removed**
  (22 unused modals + `InboxView` + `CreatorProfileDrawer` +
  `NotificationPrefsCard`); Storefront audience honest-copy;
  `Brand.preferredCreatorTier` + `Brand.monthlyBudgetBand` added to
  schema and actually persisted by the onboarding wizard (was collected
  then dropped).
- **Medium:** `v2ArchiveCampaign` / `v2UnarchiveCampaign` /
  `v2DuplicateCampaign` + Settings UI; `Thread.snoozedFor` +
  `v2SnoozeThread` (1h / until-tomorrow / unsnooze); bulk "Decline all"
  on the Pitched column; inbox message-**body** search; shared
  `<EmptyState>` wired into Campaigns + MyCollabs; `useModalEscape(onClose)`
  hook applied across 10 modals; initial-boot loading skeleton.
- **Low / mobile:** decorative Topbar `search` prop removed; MarkLive
  URL allowlist realigned to the `Platform` union; upload-modal + wizard
  responsive fixes. (Full single-column pipeline-kanban deferred.)

#### Phase 59 — seed augmentation for demo coverage — commit `201b0b5`, 2 files (seed +192 / store +52)

Closed data-shape gaps so every feature has live demo material on the
Sarah + Hannah accounts.

- Sarah: `work[6]`, `rateCards[6]`, `featuredReviewIds[3]`,
  `savedBriefs[5]`, `pressMentions[3]`, `pastClients[6]`.
- Aesop: `offerTemplates[3]`, `savedCreators[8]`, tier `$$$`, budget
  band, + 3 lifecycle campaigns (draft / paused / archived) to demo the
  wizard-publish, pause-resume, and "Archived (1)" toggle flows.
- **Demo-flow offers (the big one):** 2 pending + 2 countered offers
  seeded (were 0 of each) so the Accept / Counter / Decline modals, the
  `StageActionBanner` branches, and the brand-kanban "creator countered"
  affordance all render against live data.
- **Critical overlay fix:** `store.ts` `overlayCreators` + own-PII
  overlay now preserve local `work` / `pressMentions` /
  `featuredReviewIds` / `savedBriefs` / `rateCards` / `pastClients`
  when the Supabase row returns empty arrays (same pattern as Phase 56's
  audience preservation — otherwise every page load wiped Sarah's
  portfolio). **Persist bumped 14 → 15.**

#### Phases 60 + 61 — landing-page hero experiment — ⟲ REVERTED

Shipped then discarded within the same day:

- `a7d07a9` P60 — `/landing-preview` animated-SVG hero (motion/react
  draw-on, count-up, real cleared-payout anchor card, rotating
  creator×brand pairs).
- `db8890f` P61 — `/landing-preview-video` Remotion hero loop (new
  sibling `/marketing` project, rendered webm/mp4/poster into
  `app/public/`).
- `4581c1b` P61.1 — imperative `.play()` autoplay fix for the video.
- **`35ddf5e` REVERT** — per product call the new hero direction wasn't
  a fit. Removed both preview routes, `AnimatedHeroIllustration`,
  `CoverPreview`, the entire `/marketing` Remotion project, and the
  committed video assets. **Production `/` (Cover.tsx) was never touched
  across P60/P61, so the live landing is exactly as it was.** Original
  commits remain in history if the direction is ever resurrected.

#### Analytics — commit `cf7acf2`

`@vercel/analytics` `<Analytics />` mounted at the App root — auto-tracks
pageviews on deployed builds only (gated on production hostname, no-op
in `npm run dev`).

#### Phase 62 — silent-failure fixes (round 1) — commits `20bf8a5`, `21a2e66`

Root anti-pattern: actions returned `Foo | null` with multiple silent
`return null` paths, and callers fired-and-forgot with no toast — so a
failed submit showed a **fake success screen**.

- `20bf8a5` — `v2SubmitContent`: 5 silent paths → specific thrown
  errors; return type tightened to `Submission`; ContentUploadModal no
  longer advances to "Submitted!" on a null; success toast added.
- `21a2e66` — same treatment for `v2AcceptOffer`, `v2DeclineOffer`,
  `v2CounterOffer`, `v2ApproveContent` (incl. the escrow-drain
  no-accepted-offer fallback); callers in CollabDetail / CampaignDetail
  / WorkflowModals / ContentReviewModal wrapped with try/catch + success
  toast; one test flipped from asserting silent no-op to asserting throw.

#### Phase 63 — silent-failure sweep (round 2) — commit `80b1f42`, 10 files

Systematic follow-up: **15 more `v2*` mutations** converted to throw
specific messages, across submission/offer workflow (`v2RequestRevision`,
`v2WithdrawApplication`, `v2WithdrawOffer`, `v2AcceptCounter`,
`v2CounterCounter`, `v2RejectApplication`, `v2MarkContentLive`),
campaign lifecycle (`v2EndCampaign`, `v2Pause/Resume/Archive/Unarchive/
Duplicate/LaunchCampaign`), and collab/dispute/outreach
(`v2RequestCollabCancel`, `v2Agree/DeclineCollabCancel`,
`v2WithdrawDispute`, `v2AddDisputeMessage`, `v2ArchiveOutreach`). All
callers wrapped; dispute + collab tests flipped from no-op to `.toThrow()`.

#### Phase 64 — 14-item product audit — commit `5eafaef`, 7 files

- **Fixed:** the v2 Topbar mounted a **stub bell** that toasted "all
  caught up" regardless of real `db.notifications` — the actual
  `NotificationsBell` (deep-linking + unread badge + grouped display) is
  now wired into `lib.tsx` (closes the long-standing "NotificationsBell
  mount" deferral). Also: `v2SendOffer` silent paths → thrown messages
  (budget-cap error even reports remaining commit headroom); Storefront
  identity + legacy rate-card edits now toast; InviteCreatorsModal
  per-creator try/catch.
- **Verified OK (no change):** capability gating on approve/revise,
  `v2CanWithdraw` pre-checks, submission-viewer URL-scheme safety,
  `deriveCollab` paid-vs-live guards, money math (`net = round(rate ×
  0.85)`), archive-vs-end semantics, empty states.

#### Phase 65 — shared `<Avatar>` component — commit `b027498`, 6 files

Brand/creator pictures were inconsistent (real image on some surfaces,
a bare letter or empty circle on others). New
`app/src/components/ui/Avatar.tsx`: renders `<img>` for a real
URL (http/https/data/blob/path), else a deterministic name-hash colored
circle with initials; detects bare-letter `src` as no-image (legacy
guard). Fixes the v2 Inbox `backgroundImage: url("A")` empty-circle bug
and kills the per-render **dicebear external call** in the sidebar.
Migrated the 5 highest-impact sites; several already-working creator
portrait surfaces left for a follow-up.

#### Phase 66 — Kanban/List segmented toggle styling — commit `001cfce`, 3 files

`.v2-segmented` / `.v2-segmented-btn` were referenced across 3 surfaces
but had **zero CSS defined** — rendering as bare browser buttons. Added
pill-track styling (active/inactive/hover/focus-visible states, press
scale, icon slot) to `workspace-v2-campaign-mgmt.css`; MyCollabs toggle
gets kanban/list icons + `aria-pressed` + `role="group"`. Storefront
status and wizard gender-skew toggles inherit the polish for free.

#### Phase 67 — Fable-5 audit — commit `d5201d0`, 13 files — **444 tests**

The most structural fix of the run.

- **Unified stage computation (core):** two parallel derivations existed
  — stored `Collaboration.stage` (`collabSync.computeCollabStage`) and
  the kanban projection (`v2Adapters.deriveCollab`) — and drifted three
  ways (approved→live coercion on any payout tx, single-latest-submission
  rollup, dropped cleared-status gate). `collabSync` now owns the single
  source of truth (`computeCollabStage` + `computeSlotStatuses`);
  `deriveCollab` delegates. Verified: a {approved 2, pitched 4, cancelled
  5} campaign renders exactly {Approved 2, Pitched 4}, column count ==
  card count.
- **Dead-deal cancellation:** all-declined rule no longer requires zero
  submissions — a withdrawn offer (mutual cancel / end-campaign /
  refund-only dispute) resolves to `cancelled` even with a submission on
  file, killing zombie `submitted` rows on both kanbans.
- **Money correctness:** CollabDetail payout card used 5%+5% fees; data
  layer charges **10%+5%** — card now matches ($354 fee on $3,538, not
  $177). Refund path reverses the creator's pending hold (full refund
  previously left phantom pending balance forever). `in-review` disputes
  now block withdrawal alongside `open`.
- **Honest copy:** escrow releases **at approve**, not at mark-live —
  StageActionBanner, CreatorMarkLiveModal, CreatorHome tile, MarkLive
  toast and the payout-timeline all rewritten; fictional `releaseAmount`
  prop dropped.
- **Functional:** `v2ResumeCampaign` accepts `draft` (Publish works);
  CampaignDetail analytics CPM `$0.0k`→`$12`, wk/wk delta computed from
  series, audience roster-derived, Export CSV / Share report wired;
  CancelCollabButton uses the signed-in user as actor; `v2SendMessage`
  clears recipient snooze; live-permalink reads `submission.permalink`.

---

### 2026-08-08 — Launch-readiness audit (Fable-5) — full app vs "public beta" bar

> **Target agreed with Asim:** public beta, self-launchable — real
> Supabase auth + real strangers using it end-to-end, investor-grade
> polish, payments simulated. Everything below is judged against that
> bar, not the old "prototype" bar. Audit ran live against the restored
> Supabase project (`iddpnsnlmfhnxyhbhyvx`, un-paused 2026-08-08 after
> ~8 weeks asleep; laptop loss meant `.env.local` was recreated from
> the dashboard the same day).

#### Verified healthy (worth protecting)

- Real Supabase auth works end-to-end (demo accounts exist in hosted
  GoTrue; token grant verified live). All 20 tables hydrate on boot.
- RLS **proven** live: anon reads of creators/transactions/messages
  return empty; cross-owner writes rejected (403s). No
  `dangerouslySetInnerHTML`/`eval` anywhere; no service keys in the
  bundle; Supabase-path signups store `passwordHash: ''` locally.
- Core deal spine works: accept offer → escrow funded → submit
  content → brand review (checklist modal) → approve → ledger writes
  −$1,650 / +$1,402 / −$165 (10%) / −$83 (5% WHT), balanced to the
  cent (P67 math holding live).
- Both onboarding wizards are investor-grade (live preview panes);
  fresh-account empty states honest; ErrorBoundary wraps App;
  typecheck/build/444 tests clean; storefront public page polished
  with proper per-page titles + handle-level 404.

#### Findings — 🔴 launch blockers

| # | Finding |
|---|---|
| F11 | **Every new signup is trapped in one browser.** Profile writes fire without a session → RLS rejects → creator/brand row never reaches Postgres. Return visit (other device / cleared storage): auth 200, then "no Alamut profile exists" → forced logout. Verified live with a real test signup. Root cause: signup continues on local state without awaiting a Supabase session. |
| F24 | **Brand onboarding dead-ends at "Get started"** — awaits the Supabase brand row that F11 never wrote (`406` on `.single()`), fails silently; button does nothing. "Skip for now" accidentally rescues. |
| F10 | Signup never shows a "check your email" step though Supabase sends a confirmation email. |
| F22 | Supabase Site URL is `localhost:5173` — every auth email link redirects somewhere real users can't reach (verified from Asim's phone). |
| F39 | Supabase built-in SMTP is rate-limited to a handful of emails/hour — public signups will stop receiving confirmations almost immediately. Custom SMTP (e.g. Resend/Postmark) required, or disable confirmations for beta. |
| F17 | Signup terms checkbox links ("creator agreement", "payment terms") are `href="#"` — the legal docs don't exist. Real emails are being collected with no ToS/privacy policy. |
| F19 | **Seed-world collision (product decision):** real creators can apply to fake campaigns whose fake brands never respond. Label demo content, wall it off, or curate a real launch state. |
| F7 | Free-tier Supabase pauses after ~1wk idle (this is how the project was found). Pro upgrade or keep-alive needed before strangers arrive. |
| F30 | **Full escrow release on partial approval.** Multi-deliverable collab (1 post + 1 Reel, $1,650 flat): approving the first deliverable released the full $1,650; the outstanding Reel now has zero escrow behind it, and the kanban still shows the deal in Confirmed · $1.6K. Release policy needs per-slot logic (release on all-approved, or pro-rata). |

#### Findings — 🟠 high

| # | Finding |
|---|---|
| F13 | Silent validation blocks strand users mid-wizard on both personas (empty bio / brand description → Continue silently no-ops, no message, no field highlight). |
| F1 | ~32 doomed `collaborations` mirror writes per signin (403/409 spam) — boot-time stage recompute mirrors every seed collab instead of only owned rows. |
| F2/F3 | Signin: raw GoTrue error copy ("missing email or phone") on empty submit; stale error not cleared when demo buttons fill the form. |
| F9/F16/F23 | Honesty gaps: "passwords stored locally in plain text" copy on signup (stale — untrue for real signups); payout step promises real KYC/settlement ("CNIC + selfie clears in under 5 minutes", "$25 wire fee"); brand onboarding threatens "$5K minimum wallet funding". All fiction during a simulated-payments beta. |
| F27 | Cross-persona route restore: brand signin lands on creator's last route → full-page "You don't have access" dead-end with no way home. Reset route on persona change + add a Go-home CTA. |
| F28 | Seed generator title collisions: nine "Studio Notes"-family campaigns, including two live ones under the same brand — the brand's own campaign list is ambiguous (audit walked into the wrong twin). |
| F34 | Public one-click **Admin** demo access on `/signin` — remove for launch. |
| F38 | `public/architecture-map.html` ships to production — internal architecture disclosure. |

#### Findings — 🟡 medium/polish

F4 signin "no real auth" copy (stale) · F5 README "no backend" (stale) ·
F6 Workspace chunk 557KB (split later) · F8 signup "data stays in this
browser" copy · F12 onboarding platform cards + footer buttons have no
accessible names · F14 self-reported follower/ER numbers presented
unlabeled · F15 creator city list Pakistan-only (make market focus
explicit) · F18 publish step renders literal `alamut.co/@{handle}` ·
F20 phantom bars in 6-month chart on all-$0 fresh accounts · F21 stale
seed dates everywhere ("Due May 20" in August, "Deadline passed" on
live campaigns, "Spring Capsule 2025") · F25 "Welcome back" greeting
for first-time brand · F26 kanban cards not keyboard-accessible ·
F29 escrow-committed funds invisible in campaign Budget·Spend ("0%
spent" with $1.6K in escrow) · F31 storefront top-nav overflows on
mobile (no collapse) · F32 campaign-header action buttons clip on
mobile · F33 unknown top-level routes silently redirect to `/` (no 404
surface; storefront handles do have one) · F35 no favicon · F36 no
meta description/OG/Twitter tags at all · F37 no robots.txt/sitemap.

#### Revamp plan (phased, sized for sessions)

- **Phase A — un-brick real users (blockers, ~1-2 sessions):**
  rework signup to await/handle the Supabase session: email-confirm
  screen + resend + unconfirmed-signin handling (F10); write
  creator/brand profile rows *after* a session exists, with retry on
  first confirmed signin so F11's stranded auth users self-heal; fix
  brand Get-started await (F24); set Site URL + redirect allowlist to
  the prod domain (F22); wire custom SMTP or disable confirmations
  (F39); minimal ToS + privacy pages and real links (F17); remove
  admin quick-pick (F34) + architecture-map from public/ (F38);
  Supabase Pro / keep-alive decision (F7).
- **Phase B — beta-honest product (decisions + copy, ~1 session):**
  seed-world strategy (label demo brands/campaigns "Demo", or
  segregate); escrow release policy for multi-slot collabs (F30);
  honesty sweep across F4/F8/F9/F16/F23; demo-account buttons gated to
  non-production; currency + market-focus decisions (F14/F15).
- **Phase C — flow correctness (~1-2 sessions):** inline validation
  messages in both wizards (F13); signin error UX (F2/F3); persona
  route reset + access-denied CTA (F27); gate collab mirror to owned
  rows (F1); seed regeneration — unique titles, future-dated deadlines
  (F21/F28); escrow visibility in Budget·Spend (F29); F18/F20/F25
  fixes.
- **Phase D — polish/a11y/mobile (~1 session):** a11y names +
  keyboard cards (F12/F26); mobile overflows (F31/F32); 404 surface
  (F33); favicon + OG/meta + robots (F35-37); phantom-bars fix.
- **Phase E — ops (~half session):** Sentry wire-up; README refresh
  (F5); bundle split (F6) when convenient.

Suggested order: A → B → C → D → E. A alone makes real signups viable;
A+B is a defensible soft launch to friendlies; through D is the
investor-grade public beta.

## Commit hashes for traceability

Recent commits in chronological order — all on origin/main:

| Hash | Phase | Notes |
|---|---|---|
| `7ac75ee` | 1 | Auth wiring |
| `9a244e6`, `4848ff0` | 2 | Brands schema + client |
| `b18a17e`, `b5405e2` | 3 | Campaigns |
| `94daa68`, `27238ed` | 4 | Offers + applications |
| `1ff3484`, `2b855b6` | 5a | Creators |
| `8e19651` | 5b/c/d | RLS + collaborations + submissions/deliverables schemas |
| `f577913` | 5c/d client | Mirrors + hydration |
| `0d5b001` | 6 | Contracts |
| `7a797bb` | 7 | Transactions |
| `b231150` | 8 lite | Reviews + disputes |
| `a735cfc` | 9 | Outreach |
| `3e0a70c` | 10 | Threads + messages + realtime |
| `efa92fc` | 13 (RLS) | Signup INSERT policies fix |
| `ad236df` | post-10 | useRecentActivity (Recent Activity from server state) |
| `2b7dac5`, `6b083eb` | post-10 | Cross-device sign-in + sign-up |
| `ae6f0a1` | post-10 | Stale-chunk recovery |
| `c84a898` | post-10 | Continue CTA visibility + session sync |
| `4a2f9e7` | post-10 | Message Brand routing + workspace back button |
| `5289ebc` | post-10 | Creator-side inbox fix (threadToV2 + brandId field) |
| `d0131f0` | post-10 | Filter dropdown overflow fix |
| `4ebc242` | post-10 | Browse Campaigns multi-select filters |
| `a1501ff` → `fe8512d` | Audit | 10 commits shipping 39 audit items |
| `f8eb1c8` | 11 | Inbox mute / archive / report |
| `b8a17e7` | 12 | Message attachments |
| `dd701a6` | 13 | Campaign assets upload |
| `2887a5b` | 14 | Team invites |
| `c3a49f6` | 15 | Spark drafts |
| `cf7c105` | Modal batch 1 | Validation hints |
| `c6239ef` | Modal batch 2 | Data preservation + smart validation |
| `c8e80e1` | Audit | 2026-05-13 slices 1-10 (RLS + locks + extractions + RTL) |
| `f2437a4` | Post-audit 1 | Spark auto-save |
| `8ead617` | Post-audit 2 | Migration 022 — realtime for 6 workflow tables |
| `35fb76f` | Post-audit 3 | Migration 023 — cross-device notifications |
| `b5e0dc7` | Post-audit 4 | Migration 024 — OAuth scaffolding (platform_tokens + Edge Function) |
| `9b87046` | Post-audit log | Audit log session entries for items 1-4 |
| `7a5f6bc` | Phase 50 | Workflow polish + admin moderation + KYC capture + OAuth wiring |
| `7e9e62a` | Phase 50 #8 | Spark — real LLM proxy via Edge Function |
| `0b7d9a4` | Phase 50 #10 | Playwright e2e — spine smoke test |
| `8cf22b2` | Doc | Architecture map (single-file interactive diagram) |
| `73c3fd5` | Phase 51 | Bug-bash from real testing pass (file upload + modal reopen + Needs-you) |
| `462e227` | Phase 52 | Security hardening + migrations 025 (PII lockdown) + 026 (storage path validation) |
| `13f39a7` | Lint sweep | Migration 027 — Supabase Security Advisor (function search_path + RLS gates + bucket listing) |
| `26a0050`, `2a546ed`, `1a17924` | CLI | Supabase CLI wired as devDep + cleanup + gitignore .temp |
| `fe1954d` | Lint sweep | Migration 028 — perf-warning sweep + creator_channel_verified security_invoker |
| `dc45b92` | Lint sweep | Migration 029 — perf advisor: outreach FK indexes + unused-index policy |
| `a09b7fe` | Phase 53 audit | Fix duplicate React keys at 4 sites |
| `7d8bd79` | Phase 53 polish | Showcase mood-overlay opacity 0.30 → 0.18 + isolation: isolate |
| `699ea91` | Phase 53 polish | Showcase capture badge hidden in hero-grid (was covering 99% of tile) |
| `73a5914` | Phase 53 polish | Hero specificity bump + tighten so it fits in viewport |
| `d37a594` | Phase 53 polish | Recent placements gallery — count 18 → 16 to balance masonry |
| `ba9290c` | Phase 53 polish | PressStrip names + fix doubled portrait URLs |
| `84b7071` | Audit log | Catch up 2026-05-14 → 2026-05-15 work |
| `26f1e10` | Investor brief | Product brief markdown for designer hand-off |
| `9dc696c` | Phase 54 | Brand cold-invite workflow + adapter visibility |
| `03b4313` | Phase 54 | Mobile nav drawer (hamburger + slide-in sidebar) |
| `289c023` | Phase 55 A-batch | 13 bug fixes — live data into surfaces that already had it |
| `a5fe844` | Phase 55 C-batch | Copy honesty + 3 Creator seed fields |
| `d633c0f` | Phase 55 B-batch | 10 wiring fixes (CTA → existing actions) |
| `ee8e82f` | Phase 56 | Adapter honors paid/cancelled terminal stages |
| `917cd55` | Phase 56 H-batch | 6 cross-surface mismatches + Supabase overlay race fix |
| `97926be` | Phase 57 M-batch | 5 medium-severity consistency alignments |
| `0e7b9b2` | Phase 58 | 15-item bug-fix sweep (Topup wire, mobile drawer, 24-file dead-code purge, archive/duplicate/snooze, empty states, modal ESC) |
| `201b0b5` | Phase 59 | Seed augmentation — Sarah/Aesop demo data + pending/countered offers + overlay preservation fix (persist 14→15) |
| `a7d07a9` | Phase 60 | ⟲ reverted — /landing-preview animated-SVG hero |
| `db8890f` | Phase 61 | ⟲ reverted — /landing-preview-video Remotion loop |
| `4581c1b` | Phase 61.1 | ⟲ reverted — Remotion autoplay fix |
| `35ddf5e` | Revert | Discards P60 + P61 + P61.1 (production `/` was never touched) |
| `cf7acf2` | Analytics | @vercel/analytics pageview tracking (production-only) |
| `20bf8a5` | Phase 62 | Fix silent submit-content failure + success toast |
| `21a2e66` | Phase 62 | Surface silent failures — Accept / Counter / Decline / Approve |
| `80b1f42` | Phase 63 | Silent-failure sweep — 15 more v2 actions throw specific messages |
| `5eafaef` | Phase 64 | 14-item product audit — NotificationsBell wired + v2SendOffer/storefront/invite toasts + 8 verifications |
| `b027498` | Phase 65 | Shared `<Avatar>` component — logoUrl surfaces everywhere; kills dicebear external call |
| `001cfce` | Phase 66 | Style the `.v2-segmented` Kanban/List toggle (had zero CSS) |
| `d5201d0` | Phase 67 | Fable-5 audit — unify collab stage computation + 10%/5% fee fix + honest escrow copy (444 tests) |
