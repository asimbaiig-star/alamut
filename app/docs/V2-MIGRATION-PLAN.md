# Workspace v2 — Migration Plan

> **Goal:** make `/v2` the production post-signin portal for both creator and brand users. No regressions, no broken sessions, no broken deals, marketing landings untouched.
>
> **Status:** Phase 0 complete. Phase A in progress (2 of 14 screens shipped).
>
> **Owner:** edit this doc as the source of truth as we move through phases.

---

## Goals & non-goals

### Goals
- **Replace** the post-signin portal (`/creator/*`, `/brand/*`) with the v2 workspace
- **Preserve** all existing functionality — nothing the user can do today should disappear
- **Preserve** existing user sessions, persisted state, deal data, transactions, reviews
- **Preserve** the marketing landings at `/`, `/for-brands`, `/c/:handle`, `/tools/*`, `/creators`
- **Preserve** the existing onboarding wizards (`/onboarding/creator`, `/onboarding/brand`) — they already use the airy surface and don't conflict with v2 visually
- **Preserve** the shared deal page at `/deal/:dealId` (cross-role, used from many entry points)
- **Preserve** the admin portal at `/admin/*` — out of scope for the v2 design today; migration happens in a later phase

### Non-goals (this migration)
- Don't redesign marketing landings (user explicitly out of scope)
- Don't migrate the admin portal in this round (its volume is much lower; lower priority)
- Don't ship a real LLM-backed Spark AI in the first cut — start with a scripted prototype that demonstrates the UX
- Don't change the underlying domain model (Creator, Brand, Campaign, Application, Offer, etc.) — only the views
- Don't change escrow / dispute / review mechanics — only their UI surfaces

---

## Risk register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Currency mismatch (USD seed vs. PKR design) breaks number formatting in screens | High | Medium | Phase D: introduce a per-user `currency` field with `formatMoney()` adapter, OR localize seed to PKR with a one-time migration script |
| v2 sample data shape (`V2Creator`) differs from real `Creator` type → screen breaks when wired | High | High | Phase B: introduce adapter functions `toV2Creator(creator)`, `toV2Campaign(campaign)` that map real entities to v2 props. Adapters live alongside lib.tsx |
| Persona toggle confuses real authenticated users (e.g. brand user clicks "Creator" tab and sees blank state) | Medium | Medium | Phase C: hide the persona toggle when authenticated as a single-role user; show only as a debug toggle in admin/dev mode |
| Persisted localStorage state from current portal collides with v2 routes after cutover (e.g. `lastVisited='/creator/today'` no longer valid) | Medium | Low | Phase F: bump Zustand store version (12 → 13), flush stale `lastVisited` keys |
| Deal page deep-links from notifications break if URL scheme changes | High | High | Keep `/deal/:dealId` route exactly as is; v2 sidebar's "Inbox" links to deals via the same URL |
| Bundle size balloons (two design systems shipped) | Medium | Low | Phase G: delete legacy after 1-phase soak. Until then, both ship — tolerable since v2 is small (~480 lines CSS, 6 small TS files) |
| Brand users complain that creator content is too prominent (or vice versa) | Low | Low | Persona auto-pinned from `User.role`; only one role's nav visible by default |
| Spark AI feels broken if it's just hardcoded responses | Medium | Medium | Phase E: ship "scripted" Spark with believable canned responses tied to the demo data; clearly labeled as preview. Real LLM integration is a follow-up, not a blocker |
| Onboarding wizards break because they redirect to old `/{role}/today` URLs | Low | High | Phase F: update `/onboarding/creator` and `/onboarding/brand` final-step redirects to `/v2` |

---

## Migration phases

Each phase is independently shippable. After each phase, the app builds clean, all existing routes still work, and we can decide whether to advance or hold.

### Phase A · Visual parity build (in progress)

**Goal:** every screen in the v2 design is implemented, using sample data, with persona toggle working.

**Status:** 2 of 14 screens done (BrandHome, CreatorHome). 12 screens pending — see WORKSPACE-V2-HANDOFF.md for the priority list.

**Steps (per remaining screen):**
1. Read the corresponding section in the design's `brand-screens.jsx` / `creator-screens.jsx` / `spark.jsx` / `brand-comms.jsx`
2. Create `app/src/screens/workspace-v2/screens/{ScreenName}.tsx`
3. Use the existing `lib.tsx` primitives (Topbar, StatCard, CampaignCard, PlatformChip, ScoreBadge, StagePill, fmtPKR)
4. Wire to sample data from `data.ts`
5. Add the route case in `Workspace.tsx → RouteOutlet`
6. Replace the `<ComingSoon />` for that route

**Gate to advance to Phase B:** all 14 screens render at desktop with sample data. Build clean. User has reviewed each visually.

**Estimated complexity per screen:**
| Screen | Complexity | Notes |
|---|---|---|
| Spark AI (brand) | **Large** | The most code in the design (`spark.jsx` is ~700 lines); inline interactive tables, conversation log, chat composer. May ship in two parts: (a) shell + history pane, (b) conversation flow with scripted responses |
| Discover (brand) | Medium | Faceted filter bar + creator card grid. Filters wire to `applyCreatorFilters()` once we hit Phase B |
| Inbox (3-pane, shared) | Medium | Conversations list + thread + collaboration side panel. Used by both personas; one component, persona-aware framing |
| Storefront editor (creator) | Medium | Block-based editor — bio block / channel block / package block / collab block. Each block has edit affordance |
| Wallet (brand) | Small-Medium | Stat cards + ledger table. Top-up flow modal |
| Wallet (creator) | Small | Stat cards + ledger + withdraw modal. Smaller surface than brand wallet |
| Browse briefs (creator) | Small | Card grid of live campaigns; reuses CampaignCard |
| Campaigns pipeline (brand) | Medium | Stage-grouped list + drill-down to detail |
| Creator profile (brand-side) | Medium | Full profile drill-down. Gets re-used for storefront preview |
| KYC & Tax (creator) | Small | Step list (NADRA / FBR / certificates). Static for now |
| Analytics (creator) | Small | Reach / engagement charts. Reuse existing chart components |
| Storefront public preview (`/c/:handle` v2) | Small | The page brands see. Read-only version of storefront editor |

**Total Phase A:** ~12 screens, mostly small-medium each, plus Spark which is its own beast. Realistic plan: 2–3 sessions for the small/medium screens, 1 dedicated session for Spark.

---

### Phase B · Data layer integration

**Goal:** v2 screens read from the real Zustand store, not from `data.ts`.

**Steps:**
1. **Build adapters** in `app/src/screens/workspace-v2/adapters.ts`:
   - `toV2Creator(creator: Creator, db: Database): V2Creator`
   - `toV2Campaign(campaign: Campaign, db: Database): V2Campaign`
   - `toV2Wallet(user: User, db: Database): V2Wallet`
   - `toV2Conversation(thread: Thread, db: Database): V2Conversation`
2. **Replace sample-data imports** in each v2 screen with `useStore` selectors that go through adapters
3. **Persona-aware data hooks**:
   - `useBrandKpis()` returns wallet/escrow/campaigns counts from real data
   - `useCreatorKpis()` returns available/pending/lifetime/audience
   - `useV2Voices(persona)` for testimonial selectors
4. **Keep `data.ts` around** as fallback for screens that haven't been migrated yet — both can coexist via a feature flag during this phase
5. **Verify each screen still looks the same** when wired to real data (the seed is rich enough that screens should populate)

**Gate to advance to Phase C:** every v2 screen renders correctly using the real DB; no more imports from `data.ts`.

**Estimated complexity:** medium. The adapter pattern is straightforward; the work is in the volume (14 screens × ~3 selectors each = ~40 selectors). One session.

---

### Phase C · Auth integration

**Goal:** `/v2` is auth-gated. Persona is pinned from `User.role`. Persona toggle becomes admin/dev-only.

**Steps:**
1. **Wrap v2 routes** in `<ProtectedRoute allow={['creator', 'brand']} />` in `router.tsx`
2. **Update Workspace.tsx**:
   ```tsx
   const { user } = useAuth();
   const persona: Persona = user?.role === 'creator' ? 'creator' : 'brand';
   // Persona toggle:
   const showToggle = user?.role === 'admin' || import.meta.env.DEV;
   ```
3. **Sidebar avatar** reads from `useAuth().creator` or `useAuth().brand` instead of hardcoded "Sara Kazmi" / "Hira Mansoor"
4. **Persona toggle visibility**: only renders for admin or in dev. For real users, the persona is locked to their role.
5. **Sign-out wiring** in the sidebar foot's settings icon → goes to `/signin` after `signOut()`
6. **Notification badge counts** read from real `db.notifications` filtered by user

**Gate to advance to Phase D:** real users with valid sessions land at `/v2` after signing in and see only their role's UI. Sign-out works. No persona-toggle for non-admin users.

**Estimated complexity:** small-medium. Mostly wiring. One session.

---

### Phase D · Currency formatting (USD — locked)

**Goal:** v2 formatters render existing seed amounts as USD (not PKR) so all numbers across the workspace stay consistent with the rest of the codebase.

**Direction (locked):** keep the existing USD-feeling seed as the source of truth. v2 formatters adapt to USD output. PKR-specific copy in the design (Raast, JazzCash, FBR WHT) is handled per surface — kept as flavor where it adds character (e.g. wallet ledger entries naming JazzCash as a payment method) or neutralized to generic banking language where it would confuse a global audience (e.g. tax certificate copy).

**Steps:**
1. Rename `fmtPKR` → `fmtUSD` in `workspace-v2/lib.tsx`. New thresholds: `$2.4M / $185K / $1.5K / $25` instead of crores/lakhs.
2. Rename `fmtPKRfull` → `fmtUSDfull`.
3. Update `data.ts` sample amounts to USD scale (the design's PKR amounts ÷ ~280 to keep proportions: Rs 28.4L → ~$10K is too small, so re-pick at USD-natural scales: Rs 28.4L → $25,000 is more realistic).
4. Update wallet ledger entries to USD-native: "Top-up via JazzCash" stays as flavor, but amounts read $500, $1,500, etc.
5. Search-replace any remaining `Rs`, `cr`, `L` in v2 copy strings.
6. Wallet → Wire (USA), ACH, JazzCash for Pakistan support — keep the multi-rail story but USD-formatted amounts.

**Gate to advance to Phase E:** every money number in v2 shows USD. No `Rs` characters. Sample data feels realistic for the existing seed scale.

**Estimated complexity:** small. Grep + replace + sample-data rebalance. Half a session.

---

### Phase E · Spark AI (scripted, fully working)

**Goal:** Spark AI is a fully developed feature integrated with the entire workspace. The brain is scripted (no LLM call), but every interaction works as it would in the real product — clicking suggested creators navigates to their profile, "Save shortlist" persists, "Send brief" opens the campaign composer, "Edit shortlist" triggers a refinement turn.

**Locked direction:** scripted full working prototype. No real LLM routing. But it must integrate with the workspace as if the LLM were live.

**Approach:** keyword-matched scripted responses + workspace integration. The user types a brief; Spark detects key tokens (platform, follower band, category, budget) and renders a believable shortlist using real seed data. Tables in responses are interactive — clicking through to creator profiles, campaigns, etc.

**Steps:**
1. **Spark shell** — dedicated full-bleed page (no main sidebar), conversation log, composer at bottom, history sidebar on left. Reuses v2 tokens and components.
2. **Conversation engine** — `app/src/screens/workspace-v2/screens/spark/engine.ts`:
   - `parseQuery(text)` extracts entities: platform (IG/YT/LI/TT/Newsletter), followerBand (nano/micro/mid/macro), category, budget, region
   - `respondTo(query, db)` returns a structured response: { intro, table, followups, actions }
   - 6+ scripted patterns matching the design's history items + a generic fallback
3. **Inline interactive tables** — every creator row in a response has working actions:
   - Click row → navigate to that creator's profile (existing `/v2` internal route)
   - "Save" → adds to shortlist (persisted in store under spark.shortlists[])
   - "Compare" → opens compare drawer
   - "Send brief" → opens NewCampaignModal pre-filled with the matched creators
4. **Conversation persistence** — every Spark session is saved as a record so the history sidebar shows real entries (not just the 4 hardcoded ones from the design)
5. **Refinement turns** — after a shortlist, user can type "remove the macro creators" or "add 5 more in Lahore" and Spark re-renders the table
6. **"Send all" fast-path** — bottom of every shortlist response: "Send brief to all 5 →" creates a campaign + offers in one click
7. **Edge handling** — empty matches show a graceful fallback "I couldn't find creators matching X — would you like me to widen the search?"

**Gate to advance to Phase F:** Spark is a primary path the user can demo end-to-end: type a brief → see scripted response → save shortlist → send brief → land in campaign composer with the creators pre-attached. Every interactive element works.

**Estimated complexity:** large (the centerpiece). One dedicated session minimum.

**What "fully working" means here:**
- Conversation log with multi-turn history
- Scripted responses that vary by detected intent
- Interactive tables that actually mutate state
- History sidebar with real saved sessions
- Empty / error states handled
- Reduced-motion respected for typing animations
- Mobile responsive (defensive)

---

### Phase F · Cutover

**Goal:** flip the production routes. `/creator/*` and `/brand/*` redirect into `/v2`. The old portal stops being the default.

**Steps:**
1. **Add permanent redirects** in `router.tsx`:
   ```ts
   { path: '/creator', element: <Navigate to="/v2" replace /> },
   { path: '/creator/today', element: <Navigate to="/v2" replace /> },
   { path: '/creator/discover', element: <Navigate to="/v2" replace /> },
   // ...etc for every old creator + brand route
   ```
2. **Add deep-link translation** for any URL pattern that needs to map. Most v2 routing is internal state, but for high-traffic routes:
   - `/creator/campaigns/:id` → `/v2` with internal route `creator-campaigns` + selected campaign in localStorage
   - `/brand/campaigns/:id` → `/v2` with internal route `campaigns` + selected campaign id
   - `/deal/:dealId` → **stays exactly as is** (cross-role, deep-linked from notifications)
3. **Update onboarding finals**:
   - `CreatorOnboarding.tsx` final step → `navigate('/v2')` (was `/creator/today`)
   - `BrandOnboarding.tsx` final step → `navigate('/v2')` (was `/brand/today`)
4. **Update auth post-signin redirect**:
   - `SignIn.tsx` → after success, `navigate('/v2')` (was role-specific)
5. **Update sidebar references** in v2 to deep-link to `/deal/:dealId` for deals (already correct — keep)
6. **Update tool-link footer in landings** that point to `/creator/today` etc. → none currently, just verify
7. **Bump Zustand version** (12 → 13) — any persisted "lastVisited" key gets cleared

**Gate to advance to Phase G:** every old `/creator/*` and `/brand/*` URL redirects cleanly to `/v2`. Deep-links into `/deal/*` still work. Sign-in flow lands users correctly. Onboarding wizards complete and land at `/v2`.

**Rollback strategy:** every change in this phase is a one-commit reversion. The redirects are just `<Navigate>` swaps — flip them back, the old portal is back in place. Old screen components are still in the codebase (deletion is Phase G).

**Estimated complexity:** small. The work is mostly verification. One session.

---

### Phase G · Cleanup

**Goal:** delete legacy screens, prune unused tokens, tighten bundle size.

**Steps:**
1. **Wait one phase** after Phase F before deleting anything (≥ 1 week of v2 in production)
2. **Delete legacy screens:**
   - `app/src/screens/creator/Today.tsx`, `Discover.tsx`, `Campaigns.tsx`, `CampaignDetail.tsx`, `Content.tsx`, `Inbox.tsx`, `Earnings.tsx`, `Analytics.tsx`, `Profile.tsx`
   - `app/src/screens/brand/Today.tsx`, `Campaigns.tsx`, `CampaignRoster.tsx`, `Discover.tsx`, `Inbox.tsx`, `Wallet.tsx`, `Analytics.tsx`, `Profile.tsx`
   - `app/src/components/layout/WorkspaceShell.tsx` (only the workspace-v2 shell remains)
3. **Delete legacy CSS:**
   - Most of `app/src/styles/screens.css` (keep only what onboarding + auth + admin still use)
   - Surface-mode CSS for `data-surface="airy"` / `data-surface="dense"` if not needed elsewhere
4. **Delete unused legacy modals:**
   - `ApplyModal.tsx`, `OfferModal.tsx`, `CounterOfferModal.tsx`, `UploadDraftModal.tsx`, `DisputeModal.tsx`, `ReviewModal.tsx`, `RevisionsModal.tsx`, `MessageModal.tsx`, `NewCampaignModal.tsx`, `RequestAdvanceModal.tsx`, `DisputeResolveModal.tsx`, `ShareStorefrontModal.tsx`
   - **Caveat:** v2 may rebuild some of these as inline composers or side panels rather than modals. Decision per modal during Phase A.
5. **Remove unused redirects** from Phase F if traffic confirms zero hits over the soak period
6. **Bundle audit:** `npx vite build` and inspect chunk sizes. Expected savings: ~40–60 kB after legacy is removed
7. **Update PRD:** `app/docs/CURRENT-PORTAL-PRD.md` becomes the v2 PRD — strikethrough anything that's now gone, add the v2 sections

**Gate to consider migration "done":** legacy folders are empty or deleted; bundle size dropped; PRD updated.

**Estimated complexity:** small (mechanical deletion + verification). One session.

---

## Per-phase verification checklist

After every phase, before advancing:

- [ ] `npx tsc --noEmit` exits 0
- [ ] `npx vite build` exits cleanly
- [ ] `/v2` renders at desktop (verified via preview_inspect)
- [ ] All existing routes still work (`/`, `/for-brands`, `/c/:handle`, `/tools/*`, `/creators`, `/signin`, `/signup`, `/admin/*`, `/deal/:dealId`)
- [ ] No new console errors or warnings introduced
- [ ] Manual smoke test: sign in → land on `/v2` → toggle persona → click each nav item → verify each screen renders

---

## Rollback strategy

Each phase is independently revertable:

| Phase | How to roll back |
|---|---|
| A | Delete the new screens + revert Workspace.tsx route map; back to `<ComingSoon />` placeholders |
| B | Revert adapter imports in screens; back to `data.ts` |
| C | Remove `<ProtectedRoute>` wrapper; remove auth wiring; persona toggle back to public |
| D | Revert seed migration; flip Zustand version back to 12 |
| E | Replace Spark route with `<ComingSoon />` |
| F | Remove `<Navigate>` redirects; old `/creator/*` and `/brand/*` routes work again |
| G | Restore deleted files from git (this is the only phase that genuinely deletes — must be done after a soak) |

The most defensive cutover is **F before G**. Once F is in for a week without complaints, G can run safely.

---

## Decisions — LOCKED 2026-05-07

The user has confirmed direction on all six open questions:

1. **Currency** — **USD** (keep the existing seed as is; v2 formatters adapt to USD instead of PKR). The design's PKR-flavored copy ("FBR WHT", "Raast", "JazzCash") needs to be either neutralized or kept-as-flavor depending on context — see Phase D below.
2. **Spark AI** — **scripted full working prototype**. No real LLM call. But: must be a fully developed feature that integrates with the entire workspace as intended — clicking suggested creators navigates to their profile, "Save shortlist" persists, "Send brief" opens the campaign composer, etc. The brain is hardcoded, the UX is real.
3. **Admin portal** — **deferred** as a follow-up phase. See Phase H (added below) so it doesn't get forgotten.
4. **Persona toggle** — **visible to everyone, always**. Not auth-gated. Role is set at signup, but the toggle stays as a navigation/testing convenience. Ships as a clear "view as" affordance with both states equal.
5. **Deal page** — **keep `/deal/:dealId` URL stable; reskin contents to v2**. The deal IS the campaign workspace from a user's perspective; URL stability matters because notifications and deep-links point to it. New phase added: Phase A.13 — Deal page reskin.
6. **Onboarding wizards** — **migrate to v2 surface**. The whole product is reskinning; nothing should be left on the old (airy) surface. New phase added: Phase A.14 — Onboarding reskin.

### Framing shift

This is **not a parallel `/v2` preview anymore**. It's a **full product reskin** where the entire post-signin experience moves to v2. After cutover (Phase F), the only routes still on legacy CSS are:
- Marketing landings (`/`, `/for-brands`, `/c/:handle`, `/tools/*`, `/creators`) — explicitly out of scope per user
- Admin portal (`/admin/*`) — deferred to Phase H

Everything else — onboarding, signin/signup, workspace, deal page — uses v2.

### Imagery & assets

Per user direction: any clipart, illustrations, or imagery the new design needs are sourced from free web resources (Unsplash, Simple Icons, etc.) — same approach already in use across the existing seed.

### Phase A — additions

The original Phase A had 12 screens. Two more added per the locked decisions:

| # | Screen | Why |
|---|---|---|
| 13 | **Deal page reskin** (`/deal/:dealId`) | Decision 5: URL stays, contents reskin to v2 |
| 14 | **Onboarding reskin** (`/onboarding/creator`, `/onboarding/brand`) | Decision 6: full product reskin, nothing left on airy |

Both are medium-complexity. Schedule: between Phase F (cutover) and the Wallet/Storefront screens, fit them into the rotation so the cutover lands a fully-skinned product.

### Phase H — Admin migration (NEW, deferred)

**Goal:** the admin portal at `/admin/*` moves to v2.

**Why deferred:** admin traffic is low; existing admin works; the design bundle didn't cover admin screens. Risk of building an admin reskin without a design source is high — speculative work.

**Steps when we get here:**
1. Mock up admin screens in a follow-up Claude Design session OR adapt the existing v2 patterns (sidebar + topbar + tables) to admin
2. Reskin: `/admin/home`, `/admin/queue`, `/admin/payouts`, `/admin/audit`
3. Persona toggle hidden in admin context (role is fixed)
4. Reuse v2 tables, pills, stat cards, modals

**Trigger:** schedule once admin user count grows OR a design pass for admin lands.

**Estimated complexity:** medium. 4 screens, mostly tables.

---

## Timeline estimate

Conservative, assuming one focused session per phase block:

| Phase | Sessions | Notes |
|---|---|---|
| A — Visual parity | 3–4 | 12 screens, plus dedicated Spark session |
| B — Data integration | 1 | Adapter pattern is repetitive |
| C — Auth | 1 | Mostly wiring |
| D — Localization (PKR) | 1 | Grep + replace |
| E — Spark scripted | 1 | Conversation tree authoring |
| F — Cutover | 1 | Routes + verification |
| G — Cleanup | 1 (after soak) | Deletion + bundle audit |
| **Total** | **9–10 sessions** | Plus a 1-week soak between F and G |

---

## Files this plan touches (preview)

```
app/
├── docs/
│   ├── V2-MIGRATION-PLAN.md                  ← this file
│   ├── WORKSPACE-V2-HANDOFF.md               ← Phase 0 status (already shipped)
│   └── CURRENT-PORTAL-PRD.md                 ← updated at end of Phase G
├── src/
│   ├── App.tsx                               ← maybe touched in C (auth)
│   ├── router.tsx                            ← C, F (redirects)
│   ├── lib/
│   │   ├── api/seed.ts                       ← D (PKR migration)
│   │   ├── api/store.ts                      ← D (version bump), F (lastVisited cleanup)
│   │   └── auth/useAuth.ts                   ← C (potentially)
│   ├── styles/
│   │   ├── workspace-v2.css                  ← A (screen-specific additions)
│   │   ├── screens.css                       ← G (legacy purge)
│   │   └── tokens.css                        ← G (legacy purge)
│   └── screens/
│       ├── workspace-v2/                     ← A, B, E (active build)
│       │   ├── Workspace.tsx
│       │   ├── adapters.ts                   ← B (new)
│       │   ├── data.ts                       ← deleted in G
│       │   ├── lib.tsx                       ← A (extended per screen)
│       │   └── screens/
│       │       ├── BrandHome.tsx             ✅ already shipped
│       │       ├── CreatorHome.tsx           ✅ already shipped
│       │       ├── ComingSoon.tsx            ← deleted in A as screens land
│       │       ├── Spark.tsx                 ← E (new)
│       │       ├── Discover.tsx              ← A
│       │       ├── Inbox.tsx                 ← A (shared)
│       │       ├── Storefront.tsx            ← A (creator-side)
│       │       ├── Wallet.tsx                ← A (brand)
│       │       ├── CreatorWallet.tsx         ← A
│       │       ├── BrowseBriefs.tsx          ← A
│       │       ├── Campaigns.tsx             ← A (brand)
│       │       ├── CampaignDetail.tsx        ← A
│       │       ├── CreatorProfile.tsx        ← A
│       │       ├── KYC.tsx                   ← A
│       │       └── Analytics.tsx             ← A
│       ├── creator/                          ← deleted in G
│       ├── brand/                            ← deleted in G (except admin)
│       ├── admin/                            ← untouched until follow-up migration
│       ├── auth/                             ← signin redirect updated in F
│       └── onboarding/                       ← finalize redirect updated in F
```

---

## What I need from you to start Phase A continuation

1. **Confirm or adjust the open decisions above** (currency, Spark scope, admin, persona toggle, deal page, onboarding) — answer in-line in this doc or in chat.
2. **Confirm the priority order of remaining screens.** Default order suggested in Phase A; happy to reshuffle if Spark or another screen matters more for an upcoming demo.
3. **Confirm the sample data is acceptable for Phase A.** The design's seed has 8 specific Pakistani creators with full profiles. We can extend or swap during Phase B when we wire to real data.

Once those are answered, I can execute Phase A's next batch in the next session.
