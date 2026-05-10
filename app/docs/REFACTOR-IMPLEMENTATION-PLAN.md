# Alamut Refactor — Implementation Plan

> Companion to `alamut-fix-doc.md`. The brief defines **what** to change. This document defines **how to ship it without breaking the running prototype** — migration gating, phase ordering, dependency mapping, and per-phase deliverables.
>
> Last updated: 2026-05-08

---

## 1 · Operating principles

These are non-negotiable for the migration. Every phase obeys them.

1. **Lossless migration.** The persisted localStorage store of an existing user must upgrade in place. We never wipe seed; we transform it.
2. **Migration version gating.** A single integer `db.migrationVersion` lives in the persisted store. On hydration the migration runner walks `version + 1 → CURRENT` and runs each migrator. Forward-only — no down-migrations.
3. **Atomic phase delivery.** Each phase ships with: (a) typecheck passing on the whole repo, (b) every documented mutation flow verified end-to-end, (c) seed loadable on first boot AND on upgrade-from-prior-version, (d) one new entry in `V2-MIGRATION-PROGRESS.md`.
4. **Dual-shape reads during cutover.** When a field/entity is being introduced, consumers read the new shape with a fallback to the old. The old shape is removed only in a later phase, never in the same one that introduced the new shape. This gives one full release of soak time.
5. **`tx((db) => …)` is the only mutation surface.** Any direct write to `db.*` outside `tx` is a bug. New mutations follow this pattern.
6. **Notification coverage is monotonic.** Phases can ADD notifications, never remove. The current 19/19 cross-persona coverage is the floor.
7. **No public marketing surface is touched** until §5.7 (P6). The landing pages, calculators, and `/c/:handle` storefront keep their current chrome through the entire model migration.
8. **TypeScript strict mode stays on.** Every phase ends with `npx tsc --noEmit` clean. Lint warnings tolerated; errors not.
9. **Seed determinism preserved.** `mulberry32(20260427)` stays the random seed. NOW = `new Date()` at module load (added s19). Migration logic is deterministic — same input store always produces same output.
10. **Documentation is part of the deliverable.** Updates to `V2-MIGRATION-PROGRESS.md` and (post-migration) `MODEL.md` ship in the same commit as the code, not after.

---

## 2 · Migration runner architecture

A single registry. Add this in P1a, then every later phase appends one row.

```ts
// app/src/lib/api/migrations.ts (NEW)
import type { Database } from './types';

export const CURRENT_MIGRATION_VERSION = 9; // bumps with each phase below

type Migrator = (db: Database) => void;

const migrations: Record<number, Migrator> = {
  1: migrateP1a, // §1.8 (drop duplicates) + §5.1 (single storefront)
  2: migrateP1b, // §1.2 (Campaign stages) + §1.7 (Offer.applicationId) + §1.9 (Thread.collaborationId)
  3: migrateP1c, // §1.1 (Collaboration as first-class)
  4: migrateP1d, // §1.5 + §1.6 (structured Deliverable, drop slot-index)
  5: migrateP2,  // §1.3 (Contract) + §1.4 (Dispute)
  6: migrateP3,  // workflow fixes — schema bits only (counter rounds, cancellation field)
  7: migrateP4,  // scheduled notifications + review moderation fields
  8: migrateP5,  // permissions + admin role split
  9: migrateP6,  // quality fixes — verified=false default reset
};

export function runPendingMigrations(db: Database): Database {
  const start = (db.migrationVersion ?? 0) + 1;
  for (let v = start; v <= CURRENT_MIGRATION_VERSION; v++) {
    const m = migrations[v];
    if (m) m(db);
  }
  db.migrationVersion = CURRENT_MIGRATION_VERSION;
  return db;
}
```

Wired into `app/src/lib/api/store.ts` Zustand `persist` middleware via the `onRehydrateStorage` hook. On first-boot (no persisted state) the migration runner does nothing — `seed.ts` already produces the latest shape because seed code is updated to match the post-migration model in the same commit.

**Critical invariant:** seed and migrator must stay in lockstep. After any phase ships:
- Hydrating an empty store loads seed at the latest shape (no migration runs).
- Hydrating an old persisted store runs migrators forward to current and arrives at the same shape.
- Both paths end in equivalent stores (modulo IDs).

A seed-vs-migration parity test runs in CI: build a v0 seed snapshot (committed), migrate forward, compare against the latest seed. Diff reflects only timestamps + non-deterministic IDs.

---

## 3 · Phase ordering — adjusted from §6 of the brief

The brief's order is mostly right but two reorderings make the migration safer:

- **§1.8 (remove duplicate state) and §5.1 (single storefront component) move to P1a, ahead of everything else.** Both are pure refactors with no behavior change. Doing them first means subsequent model changes only need to be wired in one place per surface, not two. This is the difference between a clean migration and one where bugs slip through the storefront-drift gap that bit s19.
- **§1.5 (structured Deliverable) moves AFTER §1.1 (Collaboration).** The brief says they can be parallel but Collaboration is the hub — every other entity grows a `collaborationId` FK. Build the hub first, then attach Deliverable.

Final order:

| Phase | Sections | Blocks | Bumps version to |
|---|---|---|---|
| **P1a** Cleanup baseline | §1.8 (drop duplicates), §5.1 (single storefront) | — | 1 |
| **P1b** Small-additive model | §1.2, §1.7, §1.9 | P1a | 2 |
| **P1c** Collaboration | §1.1 | P1b | 3 |
| **P1d** Deliverable | §1.5, §1.6 | P1c | 4 |
| **P2** Contract + Dispute | §1.3, §1.4 | P1c | 5 |
| **P3** Workflow fixes | §2.1, §2.2, §2.3, §2.4, §2.5, §2.6 | P1, P2 | 6 |
| **P4** Scheduled + moderation | §3.1, §3.2, §3.3 | P1 | 7 |
| **P5** Permissions | §4.1, §4.2, §4.3 | P1 | 8 |
| **P6** Quality | §5.2 – §5.7 (5.1 already done in P1a) | P1, P2, P3 | 9 |

P4–P6 can run in parallel after P3 lands.

---

## 4 · Phase-by-phase plan

Each phase below documents: scope, file changes, mutations, migration script, risk, verification.

---

### Phase P1a · Cleanup baseline

**Goal:** Remove the bug factories. No new behavior, no new entities. Pure refactor + consolidation.

**Scope:** §1.8 (remove `Campaign.acceptedCreators`, `Campaign.shortlist`, set up wallet-consistency invariant), §5.1 (extract `<CreatorStorefrontView>`).

**Order within phase:**
1. Wallet invariant first (`assertWalletConsistency`) — establishes guardrail used by later mutations
2. Remove duplicate fields with replacement helpers (`getAcceptedCreators`, `getShortlistedCreators`)
3. Storefront component extraction last — easier when the data shape is stable

**File changes:**

| Path | Change |
|---|---|
| `app/src/lib/api/types.ts` | Drop `acceptedCreators`, `shortlist` from `Campaign` |
| `app/src/lib/api/migrations.ts` (NEW) | Migration runner + migrator 1 (no-op for these fields — they were derived in code, not persisted; just the wallet-invariant init) |
| `app/src/screens/workspace-v2/v2Adapters.ts` | Add `getAcceptedCreators(campaignId, db)`, `getShortlistedCreators(campaignId, db)` |
| `app/src/screens/workspace-v2/v2CampaignActions.ts` | Replace every `acceptedCreators` and `shortlist` mutation with the new derivation; add `assertWalletConsistency(db)` and `recomputeWallet(userId, db)` helpers |
| 14 call sites (grep `acceptedCreators` / `shortlist`) | Replace with helper calls |
| `app/src/components/storefront/CreatorStorefrontView.tsx` (NEW) | Extracted render component, takes `{ creator, mode: 'public' \| 'preview' }` |
| `app/src/screens/storefront/PublicCreator.tsx` | Becomes a thin wrapper |
| `app/src/screens/workspace-v2/screens/PublicStorefront.tsx` | Becomes a thin wrapper |

**Mutations added:** `recomputeWallet`, `assertWalletConsistency` (debug-only guard, called at the end of every `tx` in dev mode).

**Mutations changed:** every wallet-touching mutation (apply/accept/approve/end-campaign/withdraw/etc. — ~12 of them) now calls `recomputeWallet` for both counterparties immediately before `tx` returns, ensuring cached fields can't drift.

**Migration script:** trivial — set `migrationVersion = 1`. `acceptedCreators` and `shortlist` were already living on Campaign objects in seed; migration walks each campaign and deletes those keys to keep persisted blobs lean.

**Risk:** the storefront extraction touches both surfaces simultaneously. Risk of visual regression on `/c/:handle` (the public airy surface) since it's used outside the workspace. Mitigation: snapshot test of rendered DOM for two seed creators (Sarah Johnson, Yuki) — diff must be empty modulo random IDs.

**Tests:**
- Snapshot: `PublicCreator(seedCreator) ≡ PublicStorefront(seedCreator)` excluding `<EditingBanner>` in preview mode.
- Wallet invariant: 100 random mutations against seed, `assertWalletConsistency(db)` after each.
- No regression: every screen loads and the existing mutation flows (apply → offer → accept → submit → approve) execute end-to-end.

**Doc:** add `Session 20a · P1a baseline` entry to `V2-MIGRATION-PROGRESS.md`.

---

### Phase P1b · Small-additive model changes

**Goal:** Land the type changes that have no migration logic — just additive fields + an enum simplification.

**Scope:** §1.2 (CampaignStage → 4 values), §1.7 (`Offer.applicationId` + `source`), §1.9 (`Thread.collaborationId` set to `null` for now; populated in P1c).

**File changes:**

| Path | Change |
|---|---|
| `app/src/lib/api/types.ts` | `CampaignStage = 'draft' \| 'live' \| 'paused' \| 'closed'`; add `Offer.applicationId: string \| null`, `Offer.source`; add `Thread.collaborationId: string \| null` |
| `app/src/lib/api/migrations.ts` | Migrator 2: walk campaigns and remap stage; walk offers and infer applicationId/source per §1.7; set every existing thread's `collaborationId = null` |
| `app/src/screens/workspace-v2/v2CampaignActions.ts` | `v2SendOffer` signature: add `applicationId \| null, source` params; `v2LaunchCampaign` flips draft→live; `v2EndCampaign` any→closed; `v2PauseCampaign` live→paused; `v2ResumeCampaign` paused→live. Remove every implicit campaign-stage transition. |
| `app/src/screens/workspace-v2/screens/Campaigns.tsx` | Re-bucket sections: Live / Paused / Draft / Closed. Update copy. |
| `app/src/screens/workspace-v2/screens/CampaignDetail.tsx` | Remove all `campaign.stage`-based logic that was inferring collab state. Pipeline tab unchanged (groups by collab stage). |
| `app/src/screens/workspace-v2/screens/SendOfferModal.tsx` | Pass `applicationId` (when opened from applicant card) or `null` + `source: 'cold-outreach'` (when from CreatorProfile/Discover) |
| All `v2SendOffer` call sites (~5) | Update to new signature |

**Migration script (migrator 2):**

```ts
function migrateP1b(db: Database) {
  // §1.2 — Campaign stage enum collapse
  db.campaigns = db.campaigns.map((c) => {
    const newStage =
      c.stage === 'draft' ? 'draft' :
      c.stage === 'closed' ? 'closed' :
      // 'paused' not in current enum but check for safety
      (c.stage as string) === 'paused' ? 'paused' :
      'live';
    return { ...c, stage: newStage as CampaignStage };
  });

  // §1.7 — Backfill Offer.applicationId
  db.offers = db.offers.map((o) => {
    const matchingApp = db.applications
      .filter((a) =>
        a.campaignId === o.campaignId &&
        a.creatorId === o.creatorId &&
        new Date(a.submittedAt).getTime() < new Date(o.sentAt).getTime() &&
        (a.status === 'submitted' || a.status === 'shortlisted')
      )
      .sort((a, b) => +new Date(b.submittedAt) - +new Date(a.submittedAt))[0];
    return {
      ...o,
      applicationId: matchingApp?.id ?? null,
      source: matchingApp ? 'application' : 'cold-outreach',
    };
  });

  // §1.9 — All threads start with null collaborationId; P1c populates them
  db.threads = db.threads.map((t) => ({ ...t, collaborationId: null }));
}
```

**Risk:**
- Anything that buckets campaigns by old 8-stage enum will break. The risk is highest in analytics-style screens. Run a grep for `'shortlist' | 'offer' | 'production' | 'posted' | 'reporting'` and audit each hit.
- `v2SendOffer` signature change ripples into 5+ call sites; TypeScript will catch them, but missing one is a runtime error.

**Mitigation:**
- Add `// @deprecated — was 'shortlist' / 'offer' / 'production' / 'posted' / 'reporting'` comments at the migrator so future readers understand the mapping.
- TypeScript strict mode will flag every unmigrated call site.

**Tests:**
- Migration parity: load v1 seed snapshot, migrate to v2, every campaign has stage ∈ 4-set.
- `v2SendOffer` from applicant card creates an Offer with `applicationId` set + `source='application'`.
- `v2SendOffer` from CreatorProfile creates an Offer with `applicationId=null` + `source='cold-outreach'`.

**Doc:** Session 20b entry. Note the renamed sections in Campaigns.tsx ("Active" → "Live", "Planned" → "Draft", "Completed" → "Closed").

---

### Phase P1c · Collaboration as first-class entity

**Goal:** Materialize Collaboration into the store. This is the most invasive phase.

**Scope:** §1.1 (Collaboration entity), updating all consumers (Inbox side panel, MyCollabs, CampaignDetail Pipeline tab, CollabDetail, BrandHome action inbox, CreatorHome today list).

**Order within phase:**
1. Type + store schema added (Collaboration[] with empty default)
2. Migration script populates from existing applications/offers/submissions
3. `deriveCollab` becomes a wrapper that just looks up `db.collaborations.find(...)` (intermediate state)
4. Mutations updated to write to Collaboration.stage + push to .history (still keep deriveCollab compat layer)
5. Consumers migrated one screen at a time over a few commits — read directly from Collaboration table
6. `deriveCollab` deleted, only `db.collaborations` remains

**File changes:**

| Path | Change |
|---|---|
| `app/src/lib/api/types.ts` | Add `Collaboration` interface, `Database.collaborations: Collaboration[]` |
| `app/src/lib/api/migrations.ts` | Migrator 3: materialize collabs from applications + offers + submissions |
| `app/src/screens/workspace-v2/v2Adapters.ts` | `deriveCollab` becomes lookup-then-fallback; ~20 call sites read same way during transition |
| `app/src/screens/workspace-v2/v2CampaignActions.ts` | Every stage-transitioning mutation writes to Collaboration.stage + appends to history inside same tx |
| `app/src/screens/workspace-v2/v2CollabActions.ts` (NEW) | New file consolidating collab-level mutations: `v2InviteCreator` (gap from P1c that was implicit), `v2SetCollabStage` (low-level), and stub for `v2RequestCollabCancel` (filled in P3) |
| `app/src/screens/workspace-v2/screens/MyCollabs.tsx` | `useV2MyCollabs()` hook reads from `db.collaborations` directly |
| `app/src/screens/workspace-v2/screens/CampaignDetail.tsx` | Pipeline kanban groups `db.collaborations.filter(c => c.campaignId === id)` |
| `app/src/screens/workspace-v2/screens/CollabDetail.tsx` | Reads collab from `db.collaborations.find(c => c.id === collabId)`; uses new id format `col_<short>` |
| `app/src/screens/workspace-v2/screens/Inbox.tsx` | Reads `db.collaborations.find(c => c.id === thread.collaborationId)` (now that threads are linked) |
| All `deriveCollab(...)` call sites | Migrate one at a time |

**Migration script (migrator 3):**

```ts
function migrateP1c(db: Database) {
  if (db.collaborations && db.collaborations.length > 0) return; // idempotent
  db.collaborations = [];

  // Group applications + offers + submissions by (campaignId, creatorId)
  const pairs = new Set<string>();
  for (const a of db.applications) pairs.add(`${a.campaignId}:${a.creatorId}`);
  for (const o of db.offers) pairs.add(`${o.campaignId}:${o.creatorId}`);
  for (const s of db.submissions) pairs.add(`${s.campaignId}:${s.creatorId}`);

  for (const pair of pairs) {
    const [campaignId, creatorId] = pair.split(':');
    const camp = db.campaigns.find((c) => c.id === campaignId);
    if (!camp) continue;

    // Compute current stage using the existing logic (last call site of deriveCollab)
    const stage = legacyDeriveCollabStage(campaignId, creatorId, db);

    const apps = db.applications.filter((a) => a.campaignId === campaignId && a.creatorId === creatorId);
    const offers = db.offers.filter((o) => o.campaignId === campaignId && o.creatorId === creatorId);
    const acceptedOffer = offers.find((o) => o.status === 'accepted');

    const id = `col_${pair.replace(/[:_]/g, '').slice(0, 12)}_${Date.now().toString(36)}`;
    const earliestEvent = Math.min(
      ...apps.map((a) => +new Date(a.submittedAt)),
      ...offers.map((o) => +new Date(o.sentAt)),
      Date.now(),
    );
    const latestEvent = Math.max(
      ...apps.map((a) => +new Date(a.decidedAt ?? a.submittedAt)),
      ...offers.map((o) => +new Date(o.respondedAt ?? o.sentAt)),
      ...db.submissions.filter((s) => s.campaignId === campaignId && s.creatorId === creatorId).map((s) => +new Date(s.submittedAt)),
      earliestEvent,
    );

    db.collaborations.push({
      id,
      campaignId,
      creatorId,
      brandId: camp.brandId,
      stage,
      createdAt: earliestEvent,
      updatedAt: latestEvent,
      agreedRate: acceptedOffer?.rate ?? null,
      acceptedOfferId: acceptedOffer?.id ?? null,
      contractId: null, // populated in P2
      cancelledAt: null,
      cancellationReason: null,
      history: buildHistoryFromEvents(apps, offers, db.submissions.filter((s) => s.campaignId === campaignId && s.creatorId === creatorId)),
    });

    // Backfill collaborationId on related entities
    for (const a of apps) (a as any).collaborationId = id;
    for (const o of offers) (o as any).collaborationId = id;
    for (const s of db.submissions.filter((s) => s.campaignId === campaignId && s.creatorId === creatorId)) (s as any).collaborationId = id;
  }

  // §1.9 — promote any thread that matches a (campaignId, creatorId) collab
  for (const t of db.threads) {
    if (!t.campaignId) continue;
    const participantIds = new Set(t.participants);
    const matchingCollab = db.collaborations.find((col) => {
      if (col.campaignId !== t.campaignId) return false;
      const creatorUser = db.users.find((u) => u.creatorId === col.creatorId);
      const brandUsers = db.users.filter((u) => u.brandId === col.brandId);
      return creatorUser && brandUsers.some((bu) => participantIds.has(bu.id) && participantIds.has(creatorUser.id));
    });
    if (matchingCollab) (t as any).collaborationId = matchingCollab.id;
  }
}
```

**Mutations added:**
- `v2InviteCreator(campaignId, creatorId, message)` — creates Collaboration at `invited` stage, no offer/application required. Notifies creator.

**Mutations changed:**
- `v2ApplyToCampaign` — also creates a `Collaboration{stage:'pitched'}` + writes `application.collaborationId`
- `v2SendOffer` — looks up collab (or creates one if cold-outreach), updates `stage:'negotiating'`, history entry
- `v2AcceptOffer`, `v2AcceptCounter` — `stage:'confirmed'`, `agreedRate` set, `acceptedOfferId` set, history entry
- `v2SubmitContent` — `stage:'submitted'` if first slot in_review (collab-level), history entry
- `v2ApproveContent` — when ALL deliverables approved, `stage:'approved'`; if payout, `stage:'paid'`
- `v2MarkContentLive` — `stage:'live'`, history entry
- `v2WithdrawApplication`, `v2WithdrawOffer`, `v2DeclineOffer`, `v2RejectApplication` — `stage:'cancelled'`, set cancelledAt + cancellationReason

**Risk:**
- This is the largest migration. The risk is that legacyDeriveCollabStage() and the new mutation-driven stage management diverge. Mitigation: keep `deriveCollab` available as a verifier function (not consumed in production code) that recomputes from scratch and is asserted equal to `db.collaborations.find(...).stage` in dev mode. Drift = throw.
- Cold-outreach path (offer without prior application) — currently the code didn't create an Application implicitly. Now it must create a Collaboration with `acceptedOfferId` but no associated Application. The migration handles this.

**Tests:**
- Migration parity: hand-curated v0 seed → migrate → diff each collab's stage against `legacyDeriveCollab` output. Empty diff required.
- Round-trip: every old `deriveCollab(campaignId, creatorId)` call site, both before and after migration, returns equivalent stage.
- New mutation flow: `v2InviteCreator` produces collab in `invited` state.

**Doc:** Session 20c. This is the big one — link to migration script for reference.

---

### Phase P1d · Structured Deliverable

**Goal:** Replace free-form deliverables string + slot-index hack with structured Deliverable rows.

**Scope:** §1.5, §1.6.

**File changes:**

| Path | Change |
|---|---|
| `app/src/lib/api/types.ts` | Add `Deliverable` interface; `Submission.deliverableId: string` (replaces slot-index encoding); `Campaign.deliverableIds: string[]`, `Campaign.deliverablesText: string` (renamed from `deliverables`) |
| `app/src/lib/api/migrations.ts` | Migrator 4: walk campaigns, parse deliverables string with `parseDeliverableSlots`, expand into Deliverable rows (one per slot, quantity:1 always), persist; walk submissions, parse `[slot:N]` from notes, map to `deliverableId`, strip prefix from notes |
| `app/src/screens/workspace-v2/v2Adapters.ts` | Drop `[slot:N]` parsing; `deliverableFromSubmission` becomes `getDeliverable(s.deliverableId, db)` |
| `app/src/screens/workspace-v2/v2CampaignActions.ts` | `v2SubmitContent` signature: `slotIndex` → `deliverableId`; drop `[slot:N]` prefix encoding |
| `app/src/screens/workspace-v2/screens/NewCampaignWizard.tsx` | Step 3 (Brief) replaced with structured deliverable builder UI |
| `app/src/screens/workspace-v2/screens/ContentUploadModal.tsx` | Takes `{deliverableId, deliverableLabel}` instead of `{slotIndex, slotLabel}` |
| `app/src/screens/workspace-v2/screens/CollabDetail.tsx` | Iterates `campaign.deliverableIds` and looks up each Deliverable; per-row state from submissions filtered by `deliverableId` |
| `app/src/screens/workspace-v2/screens/CampaignDetail.tsx` | Content tab — same iteration pattern |

**Migration script (migrator 4):**

```ts
function migrateP1d(db: Database) {
  if (!db.deliverables) (db as any).deliverables = [];

  for (const camp of db.campaigns) {
    if ((camp as any).deliverableIds?.length > 0) continue;

    const text = (camp as any).deliverables || (camp as any).deliverablesText || '';
    if (typeof (camp as any).deliverablesText !== 'string') {
      (camp as any).deliverablesText = text;
    }

    const slots = parseDeliverableSlots(text);
    const ids: string[] = [];
    for (const slot of slots) {
      const id = `del_${camp.id}_${slot.index}`;
      const platform = inferPlatform(slot.label) ?? 'instagram';
      const format = inferFormat(slot.label, slot.type);
      db.deliverables.push({
        id,
        campaignId: camp.id,
        index: slot.index,
        platform,
        format,
        quantity: 1,
        dueOffsetDays: null,
        specs: null,
      });
      ids.push(id);
    }
    (camp as any).deliverableIds = ids;
  }

  // Migrate submissions: parse [slot:N] from notes, map to deliverableId
  for (const s of db.submissions) {
    const m = s.notes.match(/^\[slot:(\d+)\]\s*/);
    if (!m) continue;
    const slotIdx = parseInt(m[1], 10);
    const camp = db.campaigns.find((c) => c.id === s.campaignId);
    if (!camp) continue;
    const matchingDeliverable = db.deliverables.find((d) => d.campaignId === camp.id && d.index === slotIdx);
    if (matchingDeliverable) {
      (s as any).deliverableId = matchingDeliverable.id;
    }
    s.notes = s.notes.replace(/^\[slot:\d+\]\s*/, '');
  }
}
```

**UI change — NewCampaignWizard Step 3:** replace the free-form textarea with a structured row builder per §1.5. UI: each row has Platform select (instagram/tiktok/youtube/linkedin/newsletter/podcast/x) + Format select (varies by platform) + free-text Specs textarea. "Add deliverable" button at the bottom. Auto-renders an aggregated string ("1 Reel + 3 Stories on Instagram + 1 Long-form on YouTube") under the rows for at-a-glance verification. Saves as Deliverable rows directly — no parsing on read anywhere in the codebase post-migration.

**Risk:**
- The slot-parser is a fallback for legacy data only. Future callers should never invoke it. To prevent this, mark `parseDeliverableSlots` as `@deprecated` and add a `// MIGRATION-ONLY` comment.
- Tests that exercised `[slot:N]` notes encoding need updating.

**Tests:**
- Migration parity: parse a representative campaign string ("1 YouTube + 1 IG post + 3 stories"), verify 5 Deliverable rows with correct platform/format.
- Round-trip: submit content for deliverable id `del_X`, observe `submission.deliverableId === 'del_X'` and `submission.notes` contains no `[slot:N]` prefix.
- All call sites that previously read `s.notes.match(/\[slot:\d+\]/)` — there should be ZERO such call sites post-phase. Grep gate.

**Doc:** Session 20d. Note the breaking change to `v2SubmitContent` signature.

---

### Phase P2 · Contract + Dispute

**Goal:** Add immutable agreement snapshot (Contract) and the missing dispute lifecycle.

**Scope:** §1.3 (Contract), §1.4 (Dispute).

**File changes:**

| Path | Change |
|---|---|
| `app/src/lib/api/types.ts` | Add `Contract` and `Dispute` interfaces; add to `Database` |
| `app/src/lib/api/migrations.ts` | Migrator 5: backfill Contract for every accepted offer; Disputes start empty |
| `app/src/screens/workspace-v2/v2CampaignActions.ts` | `v2AcceptOffer` and `v2AcceptCounter` create a Contract row inside the same tx; sets `Collaboration.contractId` |
| `app/src/screens/workspace-v2/v2DisputeActions.ts` (NEW) | `v2RaiseDispute`, `v2WithdrawDispute`, `v2AddDisputeMessage`, `v2ResolveDispute`. Each pushes notification to counterparty + admin queue. |
| `app/src/screens/workspace-v2/screens/CollabDetail.tsx` | "Raise dispute" CTA gated by stage ∈ {confirmed, submitted, approved, live}; brief panel reads `Contract.briefSnapshot` if available, falls back to `Campaign.brief` |
| `app/src/screens/workspace-v2/screens/CampaignDetail.tsx` | Brief edit warning banner: "N creators have signed contracts on the current brief — your edits only apply to new applicants" |
| `app/src/screens/admin/AdminQueueUnified.tsx` | Add disputes type tab; render dispute rows with resolve modal |
| `app/src/screens/workspace-v2/screens/DisputeModal.tsx` (NEW) | Raise + view dispute UI |

**Migration script (migrator 5):**

```ts
function migrateP2(db: Database) {
  if (!db.contracts) db.contracts = [];
  if (!db.disputes) db.disputes = [];

  // Backfill Contract for every accepted offer
  for (const offer of db.offers.filter((o) => o.status === 'accepted')) {
    const collab = db.collaborations.find((c) => c.acceptedOfferId === offer.id);
    if (!collab || collab.contractId) continue;
    const camp = db.campaigns.find((c) => c.id === offer.campaignId);
    if (!camp) continue;

    const contract: Contract = {
      id: `ctr_${offer.id}`,
      collaborationId: collab.id,
      campaignId: offer.campaignId,
      creatorId: offer.creatorId,
      brandId: camp.brandId,
      agreedRate: offer.rate,
      netToCreator: Math.round(offer.rate * 0.85),
      platformFee: Math.round(offer.rate * 0.10),
      withholdingTax: Math.round(offer.rate * 0.05),
      deliverables: db.deliverables.filter((d) => d.campaignId === offer.campaignId),
      briefSnapshot: camp.brief,
      briefSnapshotAt: +new Date(offer.respondedAt ?? offer.sentAt),
      acceptedAt: +new Date(offer.respondedAt ?? offer.sentAt),
      acceptedByUserId: db.users.find((u) => u.creatorId === offer.creatorId)?.id ?? '',
      status: collab.stage === 'paid' ? 'fulfilled' : collab.stage === 'cancelled' ? 'cancelled' : 'active',
      fulfilledAt: collab.stage === 'paid' ? collab.updatedAt : null,
      cancelledAt: collab.stage === 'cancelled' ? (collab.cancelledAt ?? null) : null,
    };
    db.contracts.push(contract);
    collab.contractId = contract.id;
  }
}
```

**Mutations added/changed:**
- `v2AcceptOffer` and `v2AcceptCounter` create a Contract in the same `tx`. Sets `Collaboration.contractId`. The Contract's deliverables are a snapshot of `db.deliverables.filter(d => d.campaignId === ...)` at acceptance time (immutable once written).
- `v2RaiseDispute(collaborationId, raisedByUserId, category, description, evidence)`: gated by stage; creates Dispute; flips the `Collaboration` to a "frozen" state (we add a transient flag `Collaboration.escrowFrozen: boolean = true` while dispute is open); notifies counterparty + admin.
- `v2WithdrawDispute`, `v2AddDisputeMessage`, `v2ResolveDispute` per §1.4. `v2ResolveDispute` performs ledger entries via `tx`: refund moves money to brand wallet; release moves money to creator wallet (net of fees); partial does both proportionally.

**Workflow rules wired:**
- `v2ApproveContent` checks `Collaboration.escrowFrozen` and throws if true.
- `v2EndCampaign` for a campaign with frozen collabs cannot refund their portions — those stay locked until dispute resolves.
- 7-day post-approval auto-lock (§1.4 rules): added to scheduled notifications in P4 — for now, manual flag `submission.disputeWindowClosesAt` set on approval; UI reads it to gate the Raise dispute button.

**Risk:**
- Contract immutability is enforced at the type level (readonly fields) but TypeScript can't prevent runtime mutation. Add a guard: every Contract write goes through `v2CreateContract(input)`; once written, no `v2UpdateContract` exists. Manual mutation outside `tx` is caught by lint. Document the invariant prominently.
- Edge case: brand edits brief AFTER some collabs accepted. The migration backfill snapshots the CURRENT brief. New collabs from this point on snapshot the new brief. Confirm UI clearly conveys this.

**Tests:**
- Accept offer → Contract created → Collaboration.contractId set.
- Edit campaign brief → existing Contracts unchanged → new applicants get the new brief on accept.
- Raise dispute → `escrowFrozen=true` → `v2ApproveContent` throws.
- Resolve dispute partial → ledger entries balance.

**Doc:** Session 20e. Document the immutability invariant and the dispute escrow-freeze contract.

---

### Phase P3 · Workflow fixes

**Goal:** Land the behavior changes that build on the new model.

**Scope:** §2.1 (counter cap), §2.2 (creator-only Mark Live), §2.3 (cancel collab + end-mid-revision), §2.4 (auto-shortlist), §2.5 (Inbox + DealRoom collapse), §2.6 (thread campaign-tie rules).

**Order within phase:**
1. §2.6 first — thread rules underpin §2.5
2. §2.5 — Inbox/DealRoom collapse
3. §2.1 — counter cap (small, contained)
4. §2.2 — Mark Live (creator-only)
5. §2.3 — cancel-collab + end-mid-revision
6. §2.4 — auto-shortlist (last; depends on match-score formula being committed)

**Sub-phase 3.1 (§2.6 + §2.5):**
- New component `CollabSidePanel` extracts DealRoom's milestone timeline + money strip + Mark Live confirmation
- `Inbox` 3-pane shell renders `CollabSidePanel` in the right pane when `thread.collaborationId !== null`, falls back to a "no active collaboration" placeholder otherwise
- Add redirect: any link to `deal:<convId>` finds the matching thread + redirects to `inbox?thread=<id>&panel=detailed`
- Delete `app/src/screens/workspace-v2/screens/DealRoom.tsx` after redirect ships
- Notification meta gains `threadId?: string` for direct thread linking; recent-activity feed clicks become `inbox?thread=<id>` instead of `campaign:<id>` where applicable
- Update §2.6 thread-promotion logic: when a Collaboration is created and a matching DM thread exists, set `thread.collaborationId`

**Sub-phase 3.2 (§2.1):**
- Schema change: `Offer.rounds: {by, at, rate, message}[]` (max 3 entries); `Offer.counter` removed; status enum gains 'expired'
- Migrator 6 walks existing offers, builds `rounds[]` from initial offer + counter (when present); deletes `counter`
- `v2CounterOffer` and a new `v2CounterCounter` (brand-side) push to rounds; `v2AcceptCounter` does not push, just flips status
- `CounterOfferModal` redesigned to show the negotiation timeline; gates the counter button at `rounds.length >= 3`
- After 3 rounds, `Offer.status = 'expired'` and the application returns to `submitted`

**Sub-phase 3.3 (§2.2):**
- `MarkLiveModal` becomes a confirmation modal (no URL input)
- `v2MarkContentLive(submissionId)` signature change — drops `permalink` param, throws if `submission.permalink` is unset
- `v2SetSubmissionPermalink` stays — the only path to attach a URL is creator-side
- Update brand-side CollabRow CTAs: "Mark live" only appears when submission.permalink is set; otherwise "Awaiting URL from {creator name}"
- Update CampaignDetail call site for MarkLiveModal — drop the initialPermalink pre-fill (no longer relevant; the permalink is the source of truth, brand can't edit)

**Sub-phase 3.4 (§2.3):**
- Schema: `Collaboration.cancellationRequest: { by, at, reason } | null`
- New mutations: `v2RequestCollabCancel`, `v2AgreeCollabCancel`, `v2DeclineCollabCancel`
- `v2EndCampaign` rewritten: iterate active Collaborations on the campaign with stage ∈ {confirmed, submitted}, auto-cancel each via internal helper `_cancelCollabInternal(collabId, reason: 'campaign-ended')`, refund respective escrow amounts, push notification per cancelled collab
- UI: "Cancel collaboration" button on CollabDetail (creator) + per-row in CampaignDetail Pipeline (brand); banner on CollabDetail when `cancellationRequest` set with Agree / Decline / Raise Dispute buttons

**Sub-phase 3.5 (§2.4):**
- Schema: `Campaign.autoShortlist: { enabled: boolean; threshold: number } | null` (default null = disabled)
- UI: Settings tab toggle + threshold input
- `v2ApplyToCampaign` checks `campaign.autoShortlist`, computes match score (formula in `v2Adapters.ts`, documented inline), promotes to shortlisted if score ≥ threshold
- Match-score formula: `(overlapping_categories / total_campaign_categories) * 100`, documented in code

**Migration (migrator 6):**

```ts
function migrateP3(db: Database) {
  // §2.1 — Offer.counter → Offer.rounds[]
  db.offers = db.offers.map((o) => {
    if (o.rounds) return o; // already migrated
    const rounds: { by: 'brand' | 'creator'; at: number; rate: number; message: string | null }[] = [
      { by: 'brand', at: +new Date(o.sentAt), rate: o.rate, message: o.message },
    ];
    const counter = (o as any).counter;
    if (counter) {
      rounds.push({ by: 'creator', at: counter.at ?? +new Date(o.respondedAt ?? o.sentAt), rate: counter.rate, message: counter.message });
    }
    return { ...o, rounds };
  });

  // §2.4 — autoShortlist defaults to null on existing campaigns
  for (const camp of db.campaigns) {
    if ((camp as any).autoShortlist === undefined) {
      (camp as any).autoShortlist = null;
    }
  }
}
```

**Risk:**
- §2.5 (Inbox/DealRoom collapse) is a major UX change. Risk of breaking deep links to `deal:<convId>`. Mitigation: keep a redirect mapper in Workspace.tsx route resolver indefinitely.
- §2.2 (creator-only Mark Live) breaks an existing brand workflow. Mitigation: add a clear UI banner on the CampaignDetail Pipeline kanban: "Waiting on [creator name] to attach the live URL."

**Tests:**
- Counter 3 times — 4th throws.
- Offer expires after 3 rounds → application returns to submitted.
- Submit content, attach permalink as creator, brand confirms via MarkLiveModal — works.
- Brand attempts to MarkLive with no permalink — throws + UI shows "Awaiting URL".
- Cancel collab via mutual agreement — escrow refunds.
- End campaign with 2 in-flight collabs — both cancelled, refunds correctly distributed.
- Auto-shortlist on (threshold 70) — apply with score 75 lands in shortlisted; score 65 lands in submitted.

**Doc:** Sessions 20f-20j (split per sub-phase).

---

### Phase P4 · Scheduled notifications + moderation

**Goal:** Time-based notifications and review moderation. Quality-of-life additions; not load-bearing.

**Scope:** §3.1 (Scheduled notifications), §3.2 (Review moderation), §3.3 (Featured limit UX).

**File changes:**

| Path | Change |
|---|---|
| `app/src/lib/api/types.ts` | `ScheduledNotification` interface; `Review.reportedBy[]`, `hidden`, `hiddenReason`, `hiddenAt` |
| `app/src/lib/api/migrations.ts` | Migrator 7: empty `scheduledNotifications` table; existing reviews get `reportedBy: []`, `hidden: false` |
| `app/src/lib/api/scheduler.ts` (NEW) | `processScheduledNotifications(db, now)` — runs every 60s via `setInterval` mounted in WorkspaceShell, plus once on hydration |
| `app/src/screens/workspace-v2/v2CampaignActions.ts` | Mutations that create deliverables (offer accept) also enqueue `deadline-24h` and `deadline-overdue` triggers |
| `app/src/screens/workspace-v2/v2ReviewActions.ts` (NEW) | `v2ReportReview`, `v2HideReview`, `v2UnhideReview` |
| `app/src/screens/workspace-v2/screens/Storefront.tsx` | ReviewsBlock: 5th-pin opens swap modal; auto-skip hidden reviews from UI |
| `app/src/screens/storefront/PublicCreator.tsx` + `app/src/components/storefront/CreatorStorefrontView.tsx` | Filter `hidden: true` reviews; report link visible on each review row |
| `app/src/screens/admin/AdminQueueUnified.tsx` | Add reviews queue tab |

**Scheduler behavior:**
- On hydration, `processScheduledNotifications(db, Date.now())` runs once to catch up missed events
- A `useScheduledNotifications` hook in `WorkspaceShell` mounts a `setInterval(60_000)` and clears on unmount
- Each trigger is idempotent — checks `emitted: false && triggerAt <= now`, emits, sets `emitted: true`
- Reminders that should repeat (e.g., overdue daily for 3 days) enqueue the next instance after emitting

**Risk:**
- Long-lived idle tabs accumulate scheduled reminders. Periodic cleanup: every 24h, drop `emitted: true && triggerAt < now - 30d`.
- The `escrow-stale-30d` notification per the §3.1 brief fires once. Per discussion, fire repeatedly at 30/60/90 (this is a hardening move — implement with multiple ScheduledNotification rows enqueued at acceptance).

**Tests:**
- Schedule a `deadline-24h` notification, advance clock past trigger, exactly one notification emitted. Re-run heartbeat — no duplicate.
- Hide a pinned review — disappears from public + featured slot empty.
- Report a review — appears in admin queue with reportedBy populated.
- 5th pin attempt opens swap modal.

**Doc:** Session 20k.

---

### Phase P5 · Permissions

**Goal:** Enforce team-role and admin-role capabilities.

**Scope:** §4.1, §4.2, §4.3.

**File changes:**

| Path | Change |
|---|---|
| `app/src/lib/api/types.ts` | `TeamRole = 'admin' \| 'ops' \| 'finance' \| 'viewer'`; `AdminRole` union; `User.adminRoles?: AdminRole[]` |
| `app/src/lib/permissions.ts` (NEW) | `Capability` enum, `roleCapabilities` map, `requireCapability(userId, capability, db)` helper, `useCapability(capability)` React hook |
| `app/src/lib/api/migrations.ts` | Migrator 8: existing brand admin users (the only `teamRole: 'admin'`) keep their role; existing `role: 'admin'` users get `adminRoles: ['super-admin']` |
| `app/src/screens/workspace-v2/v2CampaignActions.ts` and others | Wrap every brand-side mutation with `requireCapability` as the first line |
| `app/src/screens/workspace-v2/screens/*.tsx` | Disable buttons / inputs based on `useCapability`; show a tooltip explaining why |
| `app/src/screens/admin/*.tsx` | Filter admin queue tabs by admin role |

**Migrator 8:**

```ts
function migrateP5(db: Database) {
  for (const u of db.users) {
    if (u.role === 'admin' && !(u as any).adminRoles) {
      (u as any).adminRoles = ['super-admin'];
    }
  }
}
```

**Risk:**
- Permission checks added to mutations — risk of locking out demo accounts. Verify Hannah (admin), Thom (ops), Finn (finance) flows still work as expected.
- UI-only gating (button disabled) is necessary but not sufficient — every mutation must also throw on unauthorized call. Both layers required.

**Tests:**
- Parametric: every (teamRole, mutation) pair — assert correct authorize/deny.
- Auditor cannot mutate; can read.
- Verification admin sees creators+brands queues, not disputes or payouts.

**Doc:** Session 20l.

---

### Phase P6 · Quality fixes

**Goal:** Polish, documentation, generic-shapes pass.

**Scope:** §5.2 (onboarding consolidation — already mostly done; just delete legacy components), §5.3 (Spark intent definitions), §5.4 (Calculator formula docs), §5.5 (Channel verification), §5.6 (Profile completion formula), §5.7 (Logo permissions).

§5.1 (single storefront component) was done in P1a.

**File changes per sub-section:**

§5.2 — delete `src/screens/onboarding/CreatorOnboarding.tsx` and `BrandOnboarding.tsx`; add redirects in `router.tsx`.

§5.3 — `app/src/screens/workspace-v2/sparkEngine.ts` adds intent docs as comments + a unit-test stub asserting intent classification per documented keyword. New `v2SendOutreach(creatorIds[], message)` mutation creates an Outreach entity (new) — NOT phantom Application rows.

§5.4 — extract calculator constants to `app/src/screens/tools/calculatorConstants.ts`; update RateCalculator to render the formula in the methodology `<details>` panel verbatim. Replace the existing `basePerThousand` with the brief's formulas exactly (`followers * engagementRate * 0.10` for IG/TikTok, CPM-based for YT).

§5.5 — `Platform.verified` defaults to false on new channels (changed from true in seed); migrator 9 sets verified to false on every existing channel; new `v2VerifyChannel(channelId)` opens stub OAuth modal with 1.5s artificial delay; Discover sort downranks unverified channels (× 0.7); public storefront shows "Unverified" pill.

§5.6 — `app/src/screens/workspace-v2/v2Adapters.ts` adds `computeProfileCompletion(creator, db): number` per the brief's weighted formula; remove the persisted `Creator.profileCompletion` field; consumers compute on read.

§5.7 — replace `BrandWordmark` and `PressStrip` imports with generic shapes (rounded rectangles with category labels). Touches `app/src/components/illustrations/BrandWordmarks.tsx`, `app/src/components/illustrations/PressStrip.tsx`. No real-brand SVGs in the codebase.

**Migration script (migrator 9):**

```ts
function migrateP6(db: Database) {
  // §5.5 — reset all channel verified to false
  for (const c of db.creators) {
    c.platforms = c.platforms.map((p) => ({ ...p, verified: false }));
  }
  // §5.6 — drop persisted profileCompletion
  for (const c of db.creators) {
    delete (c as any).profileCompletion;
  }
}
```

**Risk:**
- §5.5 resets every channel to unverified — Sarah and other demo creators temporarily lose their verified-via-OAuth glow. Demo-flow must include the "verify via mock OAuth" step at start of any walkthrough.
- §5.7 — generic shapes need to look intentional, not broken. Review with design eye. Consider hiring a quick illustration pass.

**Tests:**
- Tweaking a constant in `calculatorConstants.ts` changes the calculator output.
- Snapshot test: `PublicCreator(seedCreator) === PublicStorefront(seedCreator)` — empty diff.
- Profile completion of a junk-filled creator with no verified channel and no work caps at ~30%.
- Spark `clear` intent wipes session shortlist; subsequent `find` shows no Saved-all carryover.

**Doc:** Session 20m. Final docs deliverable: `MODEL.md` at repo root with Mermaid diagram of the post-migration entity relationships.

---

## 5 · Cross-cutting concerns

### 5.1 Notification coverage maintenance

Through every phase, the 19/19 cross-persona coverage is the floor. New mutations introduced (e.g., `v2InviteCreator`, `v2RaiseDispute`, `v2RequestCollabCancel`) bring the count up. After P3 + P5 ships, expected coverage is ~28/28.

The maintenance rule: every new mutation that touches a Collaboration or Contract must push at least one notification before the `tx` returns. Code review gate.

### 5.2 Documentation cadence

- After each phase: 1 entry in `V2-MIGRATION-PROGRESS.md`, 1 short paragraph + bullet list of files touched + acceptance criteria checked.
- After P6: rewrite `CURRENT-PORTAL-PRD.md` (or replace with `PRD.md` since the prior is stale) — replace "Collab is derived" language, replace 8-stage Campaign enum with 4-stage, document Contract + Dispute. Add `MODEL.md` entity-relationship diagram.

### 5.3 Type safety as the migration guide

TypeScript strict mode is the migration-correctness floor. Every breaking schema change propagates as compile errors that pinpoint the call sites. Don't soften types to make migrations easier — keep the compiler honest.

### 5.4 Seed-vs-migration parity test

Add a CI test that:
1. Loads a snapshot of the v0 seed (committed)
2. Runs every migrator forward to current
3. Loads a fresh seed (latest)
4. Diffs the two, ignoring random IDs and timestamps
5. Asserts equivalence

Without this test, seed and migrator drift silently.

### 5.5 Demo-flow walkthrough doc

Maintain a short `DEMO-FLOW.md` that's the script for showing the platform end-to-end. Update at the end of each phase to reflect new affordances (e.g., post-P3, the demo includes a counter-offer round; post-P5, the demo includes role-switching between brand admin and ops).

### 5.6 No-regression guarantee for storefront edits

The storefront editor → public-storefront cascade was the s19 bug. After P1a (single component) and P1d (structured deliverables), every storefront change must update the public surface. Add an integration test: each block edit triggers a re-render of the public surface within the same React tick.

---

## 6 · Risk register

| Risk | Phase | Mitigation |
|---|---|---|
| Migration ordering wrong → store corrupts | All | `migrationVersion` gate; idempotent migrators; CI parity test |
| `deriveCollab` removal misses a call site → runtime error | P1c | Type-check enforced; deprecation warning during transition; grep gate before deletion |
| Contract immutability violated at runtime | P2 | All Contract writes through `v2CreateContract`; no `v2UpdateContract`; lint rule prohibits `db.contracts[i] = ...` outside `tx` |
| Dispute escrow-freeze logic skipped → double payout | P2 | `v2ApproveContent` checks `escrowFrozen` first thing; integration test with frozen collab |
| Counter-rounds cap bypassed via direct mutation | P3 | `v2CounterOffer` checks `rounds.length < 3`; throws on violation |
| Inbox/DealRoom collapse breaks bookmarks | P3 | Permanent redirect mapper for `deal:<convId>`; smoke test on common deep links |
| Permission enforcement leaks → finance user calls send-offer mutation directly | P5 | Two-layer enforcement (UI disabled + mutation throws); parametric test |
| Logo replacement ships visually broken | P6 | Design pre-review on the new placeholder shapes |
| Real-brand-logo IP risk persists in lazy-loaded chunks | P6 | Grep for known brand names in `src/components/illustrations/` after the swap |

---

## 7 · Out-of-brief considerations (deferred to a later cycle, NOT P1–P6)

These are real product gaps but not in the current brief. Document them as "P7 candidates" so they don't get lost:

- Read state on notifications + bell-icon notification panel
- Notification preferences per user (otherwise scheduled notifications = spam)
- Brand-initiated invitations as a first-class flow (`v2InviteCreator` gets stub coverage in P1c but the wizard's invite step needs full wiring)
- Re-hire / re-book flow promised by brand FAQ
- Time zones on deadlines
- Content rights / usage rights snapshot in Contract (paid amplification, whitelisting, exclusivity)
- Post-payment dispute / chargeback flow
- Mobile responsiveness pass
- Accessibility hardening (`<main>` landmarks, skip-links, scroll-margin, contrast token deepening)
- Empty-state UX for first-experience surfaces (zero campaigns, zero collabs, zero earnings)
- Multi-language (Urdu primary)

These get a §P7 section in this plan once the in-brief work lands.

---

## 8 · Sequencing summary (the at-a-glance plan)

```
Week 1 ─ P1a ── baseline cleanup ─────── version 1
Week 1 ─ P1b ── small additive ────────── version 2
Week 2 ─ P1c ── Collaboration ─────────── version 3   (the big one)
Week 2 ─ P1d ── Deliverable ────────────── version 4
Week 3 ─ P2 ─── Contract + Dispute ─────── version 5
Week 3 ─ P3 ─── Workflow fixes ─────────── version 6
Week 4 ─ P4 ─── Scheduled + moderation ── version 7  ┐
Week 4 ─ P5 ─── Permissions ──────────────  version 8  │ parallel
Week 4 ─ P6 ─── Quality + docs ───────────  version 9  ┘
                                                    
Week 5 ─ Bake + verification + DEMO-FLOW.md update
```

Each "week" is loosely a few sessions. The actual cadence depends on testing depth — phases P1c and P3 will eat the most time.

---

## 9 · Definition of done

The refactor is done when:

1. `db.migrationVersion === 9` after all migrations run on a v0-seeded store
2. Every section in the brief has its acceptance criteria met (the bulleted lists at the bottom of each §)
3. `npx tsc --noEmit` passes from a clean checkout
4. The end-to-end demo flow (Hannah → Sarah → Hannah) executes through every workflow without UI breaks
5. `V2-MIGRATION-PROGRESS.md` has 9 new session entries
6. `MODEL.md` exists and is current
7. `CURRENT-PORTAL-PRD.md` (or successor) reflects the new model
8. The seed-vs-migration parity CI test passes
9. The 19/19 baseline notification coverage is at least maintained (expected: 28+/28+)
10. No file in the repo references `acceptedCreators`, `Campaign.shortlist`, `[slot:N]` parsing, `Offer.counter`, or the legacy 8-stage CampaignStage enum

---

End of plan.
