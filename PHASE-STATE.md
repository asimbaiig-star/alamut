# Alamut remediation — working state

**Read this first if picking up cold.** Plan: `~/.claude/plans/shiny-spinning-puddle.md`.
Full findings artifact: https://claude.ai/code/artifact/d4f40542-ed7c-42d3-a2e6-1cc92de80178

## Where we are

13 parallel audits produced ~110 findings (26 critical). Remediation runs in
7 phases, **reviewed one at a time by Asim**. Phases 1–7 are **done** except
the two items Asim reserved for himself (below).

Baseline right now: **717 tests passing, `npx tsc -b --noEmit` clean,
`npm run build` clean.** ~75 files changed, **nothing committed yet** — Asim
has been reviewing each phase from the working tree.

Run commands from `app/`. Every Bash call must source nvm first:
`export NVM_DIR="$HOME/.nvm"; [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"; nvm use default`

Browser verification: `preview_start({name:'alamut'})` (`.claude/launch.json`
exists, gitignored), then `/signin` has one-click demo buttons "Sarah — creator"
and "Aesop — brand". Deep-link with `/v2?tab=<route>` (URL-encode nested
queries). **Do not** set `alamut.v2.route` in localStorage then reload — the app
re-persists its in-memory route over it (this produced a false negative once).

## The organising insight

Almost every critical was **a canonical implementation with a drifted copy
still wired to the UI** — unfinished migrations, not sloppy new code. Several
survivors carried comments confidently asserting correctness they didn't have.
Fix by consolidation, not by patching symptoms.

## Phases 1–6 (done)

1. **One money path.** New `lib/api/money.ts` (`PLATFORM_FEE`, `WHT`,
   `splitGross`, `netOf`, `slotGross`, `splitAcrossSlots`). Deleted
   `decideSubmission`, `respondToOffer`, `resolveDispute` + 2 dead team fns
   from `client.ts` (242 lines). Rewired NotificationsBell (3 sites) and
   DisputeResolveModal to the `v2*` actions; added capability gating there.
   `escrowFrozen` guard on both mutual-cancel paths. Ledger stopped
   reconstructing gross via `/0.85`. KycTax `amount > 0` guard. Restored
   advance repayment into `v2ApproveContent` (it lived only on the deleted path).
   `migrations.ts` deliberately keeps frozen rates — documented.
2. **Persona boundary.** `personaForRoute` / `routeBase` / `CREATOR_ONLY_ROUTES`
   / `BRAND_ONLY_ROUTES` in `Workspace.tsx` — `go()` and `routeFitsPersona` now
   derive from one classifier that understands query strings. Fixed tier-pill
   route, the storefront-preview→brand-drilldown chain, two stranger-profile
   fallbacks, BriefDetail's ownership gate. `CreatorProfile` refuses to render
   for creator viewers. Static sweep test over 108 `onRoute` literals.
3. **Campaign creation.** `v2SaveCampaignDraft` — "Save as draft" persists for
   real and reopens via `campaign-new?draft=<id>`; `Campaign` gained
   `objective`, `audienceGender`, `audienceAge`, `categories`, `placements`.
   Escrow copy corrected, placement gate, `u_hannah` fallback replaced with a
   throw, mirror failures surfaced, double-submit guard, budget/deadline validation.
4. **Notifications fire.** `lib/api/useScheduledNotifications.ts` shared by both
   shells — the queue was only drained by the admin-gated `WorkspaceShell`.
   Bell: header/body counts reconciled, nested-button fixed, <376px overflow fixed.
5. **Honest data.** `derivePerf` DELETED. Performance is stored
   (`db.campaignPerformance`, `CampaignPerformance` type) and read through
   `screens/workspace-v2/performance.ts` (`readPerformance` /
   `aggregatePerformance`). **Demo story preserved**: `buildSamplePerformance()`
   in `seed.ts` authors 151 rows flagged `sample: true`; surfaces render
   `SampleDataBanner`. Removed EMV/ROAS, benchmark deltas, ER chart mode,
   content-mix ER constants, "Spark recommends" (×3), the ASCII Top-Performers
   ranking, `"14 brand deals"`, per-channel deltas, "38% of all impressions".
   `aggregateAudience` returns `null` (was a fixed 60/40 · Lahore). Creator
   score reads live reviews. `v2LeaveReview` gained a duplicate guard + clamp.
   **Also fixed a live bug the tests caught**: `avg` rounded 0–1 fractions to
   integers before ×100, so every seeded creator showed 100% female / 0% male.
6. **Consolidation.** `matching.ts` ← BriefDetail (floored scorer + the
   `campaign.placement` geo bug), sparkEngine (rating sort claiming "fit-score";
   pool now carries `db` + `brandId`), BrandHome ("why this match").
   `getViewerUserId` exported and used by Inbox. `TIMELINE_STAGES` derived from
   `V2_STAGE_META`. `Avatar` on both storefront portraits. **Inbox context band
   fixed** — `deriveCollab` was keyed on the brand's id for creator viewers.
   My regressions: badge granularity, third overdue drift, BrandAnalytics hook
   order. Plus `getLatestSubmissionFor(…, deliverableId?)` and `expectedVersion`
   on 3 writes. Removed more ASCII-derived urgency cues from BriefDetail.

## Phase 7 — DONE

### Actions that now act
- [x] **Spark "Send through Inbox" actually sends.** `sendBrief()` resolves the
      campaign by name, calls `v2EnsureThreadFor` + `v2SendMessage`, routes to
      `deal:<threadId>`; says so and routes to the wizard when no campaign
      matches. "Save edits" edits the same `draft` the send reads.
- [x] **Discover "Brand-safe" filter removed** — declared, toggled, badged,
      chipped, never applied.
- [x] **Spark empty-pool crash**, **`handleSave` no longer truncates to 3**,
      **`handleFind` parses budget**, **12s `fetch` timeout**.
- [x] **Counter-offer banner** — added the `negotiating` fallback branch, and
      rewrote `StageActionBanner.test.tsx`, which had pinned the blank card.
- [x] **Status badges on brief tiles** + **BriefDetail refuses the pitch form**
      on a non-Live brief, with the urgency strip ("Applying early puts you in
      front of the brand…") swapped for status-appropriate copy. Was: write a
      pitch, name a price, then get a toast saying no.
- [x] **`useModalEscape`** on `ContentUploadModal` + `RaiseDisputeModal`.
- [x] **BrandHome "Send brief" is no longer a second "View profile."** Both
      buttons ran the identical `onRoute(\`creator:${creator.id}\`)`. New
      `SendBriefModal` (WorkflowModals.tsx) picks one of the brand's LIVE
      campaigns — drafts are excluded, since a creator can't open one — and
      fires `v2InviteCreator`. Also wired to CreatorProfile (was: opens the
      generic inbox) and Discover cards. **Verified in the browser:** created a
      real `invited` collab for Yuki on cmp_g1.
- [x] **Shortlist + Send brief on Discover cards** — both `stopPropagation`, and
      the modal renders OUTSIDE the clickable `<article>` so its overlay click
      can't bubble into a navigation.
- [x] **Calendar "+N more" opens the day** (`expandedDay` state, "Show less" to
      collapse). Verified: +6 more → 9 entries.
- [x] **Inbox "Detail view" works below 1080px.** The panel it expands was
      `display:none` at that width, so the button did nothing on any laptop
      under 1080. `is-detailed` hands the panel the thread's column. Verified
      at 1024px: panel 504px wide, thread hidden.
- [x] **"Submit content" gated on an accepted offer** (`canSubmitContent`), and
      disabled with a reason when every slot is already filled.
- [x] **Team access moved to `screens/TeamAccess.tsx`** and mounted on
      BrandProfile as well as CampaignDetail's Settings tab. It is brand-scoped,
      not campaign-scoped: a brand with no campaigns could not invite anyone.

### Honest data (continued from Phase 5)
- [x] **"Powered by Persona" removed** — flagged in Phase 5, never actually
      deleted. Found while editing KycTax.
- [x] KYC copy: no invented document upload, no invented payout threshold, no
      "$1,000" unlock (CreatorHome echoed the same figure).
- [x] **CreatorWallet's JazzCash/Easypaisa rails** — named four payout rails
      when `BankAccountModal` offers ACH/Wire/SEPA/Local bank.
- [x] **`V2Audience.age3544` is now populated.** `aggregateAudience` stopped at
      25-34, so Discover's "Gen X · 35–44" filter could never match anyone and
      BrandAnalytics drew 0% for the band while sweeping its real share into
      45+. Verified live: 27 / 38 / 20 / 15.
- [x] **BrandAnalytics excludes creators with no demographics** from the age +
      gender mix. `?? 0` counted them as 0% female and (via the 45+ residual)
      100% over-45. Two denominators now: `totalReach` for cities,
      `audienceReach` for demographics.
- [x] **Storefront + CreatorProfile package cards** hidden when the creator has
      published no rates — the four cards were priced off a flat tier default.
- [x] **CreatorHome "earned this month"** no longer counts withdrawals.
      Withdrawals are `kind: 'payout'` with a negative amount and the code
      `Math.abs`'d them: earn $850, withdraw it, read $1,700.

### The ledger decision (was left open as "a product call")
The creator's payout row carried NET while the fee/withholding rows beside it
described money already removed — so a creator's ledger summed to
(balance − fee − tax) and could never reconcile with the balance above it. It
also disagreed with the seed, which has always written payouts at gross.

**Resolved: the payout row is GROSS and the two deductions do real work.**
- `v2ApproveContent` + `v2ResolveDispute` write `amount: gross`.
- Consequence, stated on the surface: "Lifetime earned" is gross earnings, with
  the deductions itemised one row below and a tooltip saying so. The tax
  statement wants gross anyway.
- `heldInDisputeWindows` (v2Hooks) extracted — both `v2CanWithdraw` and
  `v2RequestWithdrawal` had the same inline calculation reading the payout row
  directly, which after this change would have held back 15% more than was ever
  credited. It now sums every cleared row on the campaign = the real movement.
- **Migration 10 (`migrateP7` / `normalizeLedgerToGross`)** lifts historical net
  rows. Detection is exact (`round(gross×0.10) + round(gross×0.05)` must
  reproduce the stored deductions), so re-running is a no-op; advance
  repayments are excluded by note.
- **The local migrator alone was not enough** — verified in the browser: the
  store overlays every table from Supabase after rehydration, so mirrored net
  rows came back and overwrote it. `normalizeLedgerToGross` now also runs on the
  overlaid ledger in `store.ts`. Verified: the row renders +$600 / -$60 / -$30.
- **`supabase/migrations/031_payout_rows_to_gross.sql` — ASIM'S TO RUN.** Fixes
  the rows at rest in Postgres. Same exactness test, idempotent, reports what
  it changed.

### A11y + responsive
- [x] `label`/`htmlFor` + `id` on all 7 money inputs (none were associated).
      `Field` in NewCampaignWizard takes an optional `htmlFor`.
- [x] `aria-pressed` on the wizard's objective cards, gender segmented control,
      invite rows, and `ChipMulti` — selection was colour-only.
- [x] `.v2-topbar` wraps (its child row already did, with nowhere to go).
- [x] Both wallet ledgers scroll inside their own container.
- [x] Empty states on both wallet ledgers (brand distinguishes "no activity"
      from "nothing matches this filter").
- [x] **Spark's shortlist panel no longer disappears below 1100px.** It holds
      the saved list, the totals, and the ONLY control that removes a creator.
      Now stacks under the chat. (The `position: static` override had to go
      AFTER the base rule — equal specificity, source order decides.)

### Tests
`__tests__/phase7.test.ts` — 37 tests: the gross/net identity incl. the $10
rounding case, `age3544` projection, static guards over each control that used
to lie, money-input label association, and four `migrateP7` cases (rewrite,
idempotency, advance-repayment exclusion, withdrawal left alone).
`migrations.test.ts` version pin updated 9 → 10.

### Recheck pass (after the context expiry) — three things were wrong

Asim asked for a re-verification because the context window expired mid-phase.
It was warranted; the summary overstated three items.

1. **"Submit content" was only half-gated.** The first pass gated the topbar
   button and stopped. But `deriveCollab` synthesizes a pending slot for any
   collab past `invited`, and `DeliverableRow` rendered a live **Upload**
   button on each — the PRIMARY upload path — at `pitched` and `negotiating`,
   where `v2SubmitContent` throws. The `?action=upload` deep link was open too.
   Now: `canSubmit` threaded into `DeliverableRow` (rows stay, since seeing
   what you'd owe while negotiating is useful; the button was the lie), the
   resubmit button gated, and the deep link gated. **Verified on `col_id89h3`
   (`pitched`): 2 live Upload buttons → 0, replaced by "After acceptance".**
2. **That fix introduced a TDZ crash, caught before it shipped.**
   `canSubmitContent` sat below two early returns while the effect reading it
   was registered above them — so a stale `?action=upload` link on an
   unresolvable collab would throw *Cannot access before initialization*.
   Reachable in exactly the case the guard exists for. Declaration hoisted
   above the effect and made null-tolerant; a test pins the ordering.
3. **The same defect existed one surface over.** `CreatorHome`'s Today list
   generated "Submit <deliverable>" tiles for `pitched` collabs, with a
   sub-line claiming the creator's *proposed* rate was "in escrow" when
   nothing was held. Gating the deep link would have downgraded that from an
   error to a tile that silently does nothing. Restricted to `confirmed`.

Also **the a11y claim was incomplete**: the first sweep fixed the modals and
missed every money field reaching its label through a `Field` / `FormField`
wrapper — those render the label as a SIBLING. Nine more inputs associated
(four rate-card ranges, the rate floor, three onboarding rates, the brand's
monthly budget); both wrappers now take `htmlFor`.

Re-verified in the browser this pass: Discover's Send-brief modal opens without
navigating and its overlay dismiss doesn't fall through to the card underneath;
`creator-campaigns?status=Live` really applies the filter; the draft brief drops
the "apply early" urgency line. No console errors on any surface visited.

### The Creator Agreement (was "deliberately not done")
Asim asked for one to be written, so the step is now real.
- `src/lib/legal/creatorAgreement.ts` — the document as data, one copy, 11
  sections. **Fee and withholding percentages are interpolated from
  `money.ts`, never typed as literals**, so the agreement cannot promise a
  rate the release path doesn't take. A test pins that no percentage appears
  in the prose that the constants can't back.
- Says plainly that beta payments are simulated, matching `LegalPage.tsx`.
- `CreatorAgreementModal` in KycTax: read it, tick a box, accept. Re-openable
  afterwards ("Read again"), and a version bump prompts re-acceptance rather
  than silently binding someone to terms they never saw.
- **`Creator.agreementAcceptedAt` + `agreementVersion` are new fields.** The
  step's `verified` state now comes from an actual acceptance. It previously
  read `hasBank && hasPaidCollab` and displayed "Signed via first accepted
  offer" — inferring consent from a payout, for a document that didn't exist.
  `buildSteps`' `hasPaidCollab` param is renamed `_hasPaidCollab` so the
  compiler enforces that nothing reads it for this purpose again.
- **NOT LEGAL ADVICE, and it says so in the file header.** It accurately
  describes what the software does today; it has not been reviewed by a
  lawyer and should be before real money moves.
- Verified in the browser: step goes Action needed → Verified, showing
  "Accepted Aug 14, 2026 · v1.0", persisted on the creator record.

**A bug in the above, caught before it was called done:** `creatorsRepo` has
no columns for the new fields, and the hydration overlay builds each creator
by spreading the REMOTE row — so acceptance was being wiped on the next page
load. Accept, reload, get asked again. `taxForm` had the identical bug and it
predates this work: a submitted W-9 never survived a hydrate either.
- Both overlay sites (bulk hydrate + owner-PII pass) now preserve all three.
  Verified against a real hydrate: acceptance survives.
- ~~`032_creator_kyc_facts.sql`~~ — **APPLIED 2026-08-14**, and the client
  side is now complete:
  - `creatorsRepo` selects, maps, and writes all three columns. They are in
    `COLUMNS` (owner-gated) and deliberately NOT in `PUBLIC_COLUMNS` — the
    `creators_public` view has no such columns, and a tax form is PII.
  - `mirrorCreatorToSupabase` carries them. **This is what was actually
    losing the tax form:** `v2SaveTaxForm` already went through that mirror,
    but `taxForm` wasn't in the request body, so the write silently dropped
    it and the next hydrate erased it.
  - New `v2AcceptCreatorAgreement()` in `v2CreatorActions` — the modal was
    calling `tx()` directly, updating local state and never telling Postgres.
    It now goes through `txCreator`, i.e. the one mirror.
  - **Verified as a true round trip:** accepted, wiped localStorage entirely,
    signed in again — the timestamp came back from Postgres
    (`2026-08-14T23:04:57+00:00`, v1.0). With the cache gone it could not
    have come from anywhere else.

### Deliberately NOT done
- **Spark deploy** — Asim's, by his instruction.

## Pre-commit review — six findings, five of them mine

A `/code-review high` pass over the uncommitted diff, run before committing.
All six fixed; 717 tests green.

1. **store.ts — a failed campaigns fetch silently killed money mirroring.**
   `fetchAllCampaignsFromSupabase` swallows every error and returns `[]`, and
   `recordRemoteCampaigns` was called with it before the empty-result guard.
   That armed the registry with zero ids, so every payout, fee, and
   collaboration write was filtered out BEFORE the try/catch — nothing logged.
   My own 409 fix had introduced a way to lose writes entirely, which is far
   worse than the console noise it removed. Now guarded at the caller AND
   inside `recordRemoteCampaigns`, which refuses to arm on an empty input.
2. **v2Hooks — the dispute-window hold was multiplied by submission count.**
   `heldInDisputeWindows` added a per-campaign total once per in-window
   submission: two approved deliverables on one campaign held $1,700 against
   an $850 balance and blocked a legitimate withdrawal. Campaign ids are
   deduped into a Set first. Multi-deliverable campaigns release per approval,
   so this was the ordinary path.
3. **KycTax — the agreement version was recorded but never compared.** A bump
   would have left every creator reading "Verified" against terms they had
   never seen, while the agreement text promises re-acceptance. Status now
   requires `agreementVersion === CREATOR_AGREEMENT_VERSION`; a stale one
   reopens with "Review updated agreement".
4. **v2Adapters — "Lifetime earned" meant gross or net by data chance.** The
   ledger path sums gross rows; the fallback returned the stored net field,
   15% smaller, under a tooltip claiming gross. `grossFromNet()` makes both
   branches denote the same quantity.
5. **A test pinned the dangerous default.** I had asserted that an empty
   remote set "still counts as hydrated" — encoding finding 1 as correct and
   blocking its fix. Inverted, with the reasoning in the test body.
6. **`normalizeLedgerToGross` was O(n²) on every hydrate.** Fine at 1.3k rows,
   a main-thread stall at 10k. Fee rows are now indexed once by
   `userId|campaignId|at`.

### The standing guard: `src/lib/__tests__/regressionGuards.test.ts`
20 tests encoding these as CLASSES rather than instances — fail-open guards,
per-group totals, version enforcement, one-label-one-quantity, ledger
reconciliation + idempotency, and a timing assertion that fails if the
quadratic scan returns. Run it before every commit. Each block carries the
failure story so a future fix addresses the pattern.

**CLASS 7 — persistence round-trip (added 2026-08-15).** Adding a field to a
persisted interface has five obligations and TypeScript enforces none of them:
the SQL column, the repo `Row` type, the SELECT list, the row→object mapper,
and the object→row mapper. Miss one and the field silently becomes
browser-local. The test derives the field list from the `Collaboration`
interface itself, so a field added later is covered without anyone remembering
to extend the test; a companion assertion catches the reverse (a column
selected that no migration creates). Each arm was mutation-tested — deleting
any one of the four mappings, or migration 033, makes it fail.

The common thread, worth stating plainly: **every one of these shipped because
I verified the thing I changed, not the thing my change touched.**

## Conventions established this session

- **No fabricated data.** If it can't be computed honestly, show nothing plus
  what's missing. Never a plausible-looking default.
- A **header count must use the same predicate AND the same unit** as the body.
- Prefer **deleting a duplicate** over syncing it; export the canonical thing
  if privacy is why the copy exists.
- **Comments that assert correctness are suspect** — several were the tell.
- Tests: structural/static guards catch drift that behavioural tests can't.
  Strip comments before grepping source in tests (own notes tripped it once).
- Verify in the browser, not just by tests. Four times this session a test or
  a verification method was wrong before the code was — including the ledger
  migration, which passed its unit tests while doing nothing to the running
  app, because Supabase re-hydrates over the migrated rows.
- **Seeded ledgers do not reconcile to seeded balances**, and shouldn't be
  expected to: `seed.ts` authors `walletBalance` directly rather than
  accumulating it from transactions. The reconciliation invariant applies to
  money moved by the live code path.

## The sign-in 409s — diagnosed and FIXED

My first explanation was wrong twice over, which is worth recording. I claimed
a wiped localStorage caused a mass re-insert of the seed ledger with
duplicate-key errors. Instrumenting `fetch` showed the truth:

- **Table:** `collaborations`, not `transactions`.
- **Error:** `23503` FOREIGN KEY violation, not `23505` duplicate key.
- **Cause:** `Key is not present in table "campaigns"` — the collabs pointed
  at `cmp_g112` / `cmp_g4`, generated seed campaigns that live only in the
  browser and were never mirrored to Postgres.
- **Not a mass insert:** exactly 2 rows, on sign-in, not on boot. A temporary
  diagnostic proved the transaction mirror never fired at all.

These were the residue of an earlier fix (F1) that cut ~32 doomed writes per
sign-in down to "30×403 + 2×409" — its own comment names them.

**Fix:** `src/lib/data/remoteRegistry.ts`. Boot hydration records which
campaign ids Postgres actually returned; the two FK-bearing mirrors
(collaborations, transactions) skip writes for campaigns it doesn't have.
- **Fails OPEN before hydration** — an unknown world suppresses nothing, so a
  mutation racing the boot fetch still mirrors. Over-skipping would silently
  drop real writes, strictly worse than console noise.
- **Not `isDemoCampaign`**, though it exists and was tempting: `cmp_g4`
  belongs to `b_aesop`, a demo brand that IS in Postgres, so a demo-ness test
  would skip mirrors that should succeed. Presence is the only sound question.
- **Not an id-pattern check** (`cmp_g*`) — `demoData.ts` explains why seed-id
  shapes are a bad discriminator, and that reasoning holds here.
- Verified: clean tab, wiped mirror, full sign-in → **zero console errors**.
  10 tests in `lib/data/__tests__/remoteRegistry.test.ts`.

## Still open — Asim's to run

**All six SQL migrations are applied (030–035 + the earlier set).**

- ~~`035_amendments.sql`~~ — **APPLIED 2026-08-16**, returning the expected
  three rows. Adds `collaborations.amendments`, `contracts.rights_snapshot`,
  `deliverables.creator_id` and a partial index, behind E2/E3.

  Verified against production with RLS in force and **no rows modified**:
  - **Read** — all three columns select `200`.
  - **Write** — a PATCH of each, filtered to an id matching nothing, returns
    `200` with 0 rows. Column existence and privileges are checked at plan
    time, so this proves the write path without touching data.
  - **Negative control** — a column that does not exist returns `400 / 42703`,
    which is what makes the three `200`s above mean something rather than
    PostgREST quietly ignoring unknown names.
  - **Default materialised** — `amendments` is `NOT NULL DEFAULT '[]'`, unlike
    033/034's nullable columns, so this one was checked on real rows: five
    visible collaborations all return `[]`, none null. An empty list and "no
    list" mean the same thing for amendments, and the default is what removes
    the null case the client would otherwise handle everywhere.


- **`034_disputes_proposal.sql` — TO RUN.** Adds `disputes.proposal jsonb`,
  behind the F3 dispute-settlement handshake. Same shape as 033: one
  `add column if not exists`, no backfill, safe to re-run. The verification
  `select` should return one row: `proposal | jsonb | YES`.

  Until it runs, a split proposed inside a dispute is browser-local — the
  identical failure 033 fixed for collaborations, which is why CLASS 7 of
  regressionGuards is now table-driven across both entities rather than
  hardcoded to `Collaboration`. It would not have caught this one otherwise.


- ~~`033_collaborations_settlement_proposal.sql`~~ — **APPLIED 2026-08-15**,
  returning the expected `settlement_proposal | jsonb | YES`. Adds the column
  behind the settlement handshake.

  Verified against production afterwards, with Sarah signed in so RLS was
  actually in force, and **without modifying a single row**:
  - **Read** — the exact 17-column SELECT `collaborationsRepo` issues returned
    `200`, 3 rows, `settlement_proposal` present and `null`. Before the
    migration this same request was a `400 / 42703`.
  - **Write** — a PATCH setting `settlement_proposal`, filtered to an id that
    matches nothing, returned `200` with 0 rows affected. Postgres checks
    column existence and privileges at plan time, so a zero-row UPDATE proves
    the write path without touching data. This was worth checking separately:
    had any migration used **column-level** grants, a newly added column would
    not have been covered by them. It doesn't — all grants here are
    table-level, which cover future columns automatically.

  Found by browser-verifying F1 end-to-end: the UI, the money and the tests
  were all correct, and the column had never been created. Now covered by a
  standing guard — see CLASS 7 under "The standing guard" above.


- ~~`031_payout_rows_to_gross.sql`~~ — **APPLIED 2026-08-14.** Reported
  `rows_rewritten = 4`, `total_restored = 698`, matching the predicted values
  exactly. All four were live-writer rows for `u_sarah` (the seed's own payouts
  have no fee/tax siblings, so they were correctly excluded). Verified after a
  cold hydrate with the local mirror wiped: rows return 600/600/1650/1800 and
  the read-time normalizer correctly no-ops on them.
  - Row 3 (gross 1650) empirically confirmed the rounding semantics match:
    1650 × 0.05 = 82.5, and Postgres `round()` (half away from zero) and JS
    `Math.round` (half up) both give 83. Had they disagreed, that row would
    have been silently skipped rather than corrupted.
- ~~`030_collaborations_dedupe.sql`~~ — **APPLIED 2026-08-14.** One pair was
  duplicated (`cmp_1` × `c_sarah`): the seed row `col_seed_sarah_cmp1` at
  `confirmed` and the client-generated `col_nywf1p` at `approved`. Result:
  `rows_deleted = 1`, survivor `col_nywf1p` at `approved`, 7 collaborations
  remaining.

  **The original script would have failed, and a pre-flight check caught it.**
  `contracts`, `disputes`, and `threads` all carry FKs to
  `collaborations(id)`. The first two are ON DELETE RESTRICT — and a contract
  pointed at the row being deleted, so the DELETE would have aborted the whole
  migration with a raw constraint error. `threads` is ON DELETE SET NULL,
  which would have silently unlinked a deal room instead of failing. The
  rewritten migration repoints all three onto the survivor BEFORE deleting,
  and its self-check now also asserts no contract is left orphaned.

  Rewritten to build the winner map once into a temp table rather than
  re-deriving the same ranked/winners CTE at each step — the earlier draft had
  two copies of the ranking rule, which is the drift this codebase keeps
  paying for.

  **Rehearsed before committing:** the entire transaction was run with
  `rollback;` in place of `commit;`, which executes every statement for real
  and then discards it. It reported the exact expected numbers, so the only
  difference on the real run was the final keyword.

  Verified after: dry run returns zero rows; cold hydrate shows 0 duplicate
  local pairs, the contract on the survivor, and no failed requests on
  sign-in.
- Spark deploy (`ANTHROPIC_API_KEY`, `supabase functions deploy spark-chat`),
  platform OAuth, Supabase Site URL/SMTP — Asim's side, previously marked closed.
