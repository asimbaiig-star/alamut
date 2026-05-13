# Backend Migration + Workspace Audit Log

**Purpose:** Cumulative record of the Supabase migration and workspace
functionality audits, kept separate from `PROGRESS.md` (which tracks
the pre-migration design phases 1–40). Append new sessions at the
bottom. Designed to be read into a fresh context window to recover
state quickly after a reset.

**Last updated:** 2026-05-13

---

## Current state — one paragraph

Alamut has migrated from a Zustand-only client-side prototype to a real
Supabase backend across 17 tables + 4 Storage buckets + Realtime chat,
with full RLS gating, cross-device auth (signup/signin/team-invite),
and end-to-end persistence for every meaningful action. Two completed
audits have hardened the workspace UI: a 40-item functional sweep
shipped real validation/wiring across most modal flows + home
dashboards, and a follow-up modal sweep added input validation +
data-loss guards across ten dialogs.

---

## What changed in the 2026-05-13 audit (high-impact tldr)

The original 17 backend-migration phases shipped a working server.
The 2026-05-13 session ran a structural audit across the entire
campaign-management pipeline, caught two user-reported bugs (Sarah
self-msg in inbox + Aesop workspace teleport on deal-room open) and
~80 latent findings. 24 mutations updated, 2 new migrations (019
RLS-tighten + 020 optimistic-locks), 49 new tests, 3 modal/component
extractions for testability, 3 orphan files deleted. Full ledger in
"Session log" below.

**Most important behaviour change:** v2 mutations now refuse rather
than silently producing inconsistent state. Pre-fix a brand could
accept an offer with $0 wallet (Math.max clamp → phantom escrow);
a creator could apply to a draft campaign; submissions could land
on campaigns the creator had no offer on. All such paths now hard-
return on the gate. Toasts surface where the UI needed them.

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

After the 2026-05-13 workflow-audit slices, the remaining items are:

_(collaborations refactor done in slice 9 — see Session log below)_
- **Larger parent-screen RTL tests** — BrandHome, CreatorHome,
  CampaignDetail (Pipeline tab + kanban). Each ~600 lines with heavy
  store deps; diminishing returns vs the modal-extraction approach
  unless specific user demand.
- **Notifications migration** — local-only by design. Cross-device
  notification badges would need it.
- **Realtime for non-chat tables** — only threads + messages are on
  the realtime publication. Contract / collab changes would benefit.
- **Spark draft auto-save** — currently explicit Save button.
- **ConnectPlatformModal mock OAuth** — still 100% mock.
- **Real-money infra** — Stripe Connect, real OAuth (IG/TikTok/YT/
  Substack/X), SES for email digests. Out of scope for the prototype.

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
