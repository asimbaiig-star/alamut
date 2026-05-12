# Backend Migration + Workspace Audit Log

**Purpose:** Cumulative record of the Supabase migration and workspace
functionality audits, kept separate from `PROGRESS.md` (which tracks
the pre-migration design phases 1–40). Append new sessions at the
bottom. Designed to be read into a fresh context window to recover
state quickly after a reset.

**Last updated:** 2026-05-12

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

Nothing critical. Bookmark list of "could-do-next" if a future session
wants to keep going:

- **Notifications migration** — currently local-only by design (per-
  device). Could migrate if cross-device notification badges matter.
- **Tighten transactions RLS** — currently `with check (true)`. Needs a
  userId→email mapping in the schema (users live in auth.users with
  UUIDs vs our local text ids).
- **Realtime for non-chat tables** — could broadcast contract/collab
  changes too. Today only threads + messages are on the realtime
  publication.
- **Spark draft auto-save** — currently explicit Save button. Auto-save
  on every meaningful edit with debounce would be nicer UX.
- **ConnectPlatformModal mock OAuth** — still 100% mock; would need a
  real OAuth flow when ready.

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

---

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
