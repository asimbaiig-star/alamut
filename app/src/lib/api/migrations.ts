// migrations.ts — forward-only data-migration runner for the persisted store.
//
// Companion to `REFACTOR-IMPLEMENTATION-PLAN.md`. Hydration of the Zustand
// store calls `runPendingMigrations(db)` once on every load. The runner
// walks `db.migrationVersion + 1 → CURRENT_MIGRATION_VERSION` and runs
// each migrator in order, then writes the new version back to the store.
//
// Rules:
//   - Migrators are PURE in-place transforms over `db`. Never delete data.
//   - Migrators are IDEMPOTENT — running twice must produce the same shape.
//   - Each phase appends ONE migrator; never edits a prior one. If a prior
//     migrator was wrong, write a NEW migrator that fixes the breakage.
//   - Seed (`seed.ts`) is always at the latest shape. A fresh empty store
//     hydrates to seed and the runner is a no-op (version already current).
//
// This is distinct from Zustand's persist-middleware `version`, which is
// for nuke-and-reseed scenarios. We never nuke; we transform.

import type {
  Database, CampaignStage, Offer, OfferSource, OfferRound, Thread,
  CollabStage, CollabHistoryEntry, Application, Submission,
  Campaign, DeliverablePlatform, DeliverableFormat,
  Contract, ContractDeliverableSnapshot, Dispute, DisputeCategory, DisputeStatus,
  Review, AdminRole, User, Creator,
} from './types';

export const CURRENT_MIGRATION_VERSION = 9;

type Migrator = (db: Database) => void;

// =====================================================================
// Migrator 1 — P1a: drop Campaign.acceptedCreators, Campaign.shortlist
// =====================================================================
//
// Both fields were duplicating state already derivable from offers
// (acceptedCreators ≡ Offer{status: 'accepted'}.creatorId) and applications
// (shortlist ≡ Application{status: 'shortlisted'}.creatorId). Keeping
// them produced consistency bugs (e.g., direct `acceptedCreators.push`
// without bumping the offer status). Helpers `getAcceptedCreators` and
// `getShortlistedCreators` in `v2Adapters.ts` are the new readers.
//
// This migrator strips the fields from any persisted Campaign blob.
// Seed already produces campaigns without them at this version.

function migrateP1a(db: Database): void {
  for (let i = 0; i < db.campaigns.length; i++) {
    // Cast through `unknown` so the optional `delete` is well-typed even
    // though the post-migration Campaign type doesn't carry the fields.
    const c = db.campaigns[i] as unknown as Record<string, unknown>;
    delete c.acceptedCreators;
    delete c.shortlist;
  }
}

// =====================================================================
// Migrator 2 — P1b: Campaign stage enum collapse (8→4),
//              Offer.applicationId + source backfill,
//              Thread.collaborationId initialized to null.
// =====================================================================
//
// §1.2 — old enum had 8 values that conflated campaign lifecycle with
// "highest collab stage." Per-collab progress now lives on Collaboration
// (P1c). Mapping:
//   draft                                                 → draft
//   live | shortlist | offer | production | posted | reporting → live
//   paused (if v2PauseCampaign was called pre-P1b)        → paused
//   closed                                                → closed
//
// §1.7 — every Offer gains applicationId (FK to the Application that
// triggered it; null when source !== 'application') + source. Backfilled
// by finding the most recent Application{campaignId, creatorId, status:
// submitted|shortlisted} whose submittedAt < offer.sentAt. If none, the
// offer is treated as cold-outreach.
//
// §1.9 — every Thread gets collaborationId = null. P1c migrator 3 is
// what promotes them to point at their Collaboration once the entity
// is materialized.

function migrateP1b(db: Database): void {
  // §1.2 — collapse stage enum
  for (const c of db.campaigns) {
    const old = c.stage as unknown as string;
    const next: CampaignStage =
      old === 'draft' ? 'draft' :
      old === 'closed' ? 'closed' :
      old === 'paused' ? 'paused' :
      'live'; // live | shortlist | offer | production | posted | reporting
    c.stage = next;
    // History entries can keep their old stage strings — we don't rewrite
    // history. The `stage` field on history entries is informational, not
    // queryable.
  }

  // §1.7 — backfill Offer.applicationId + source
  for (const o of db.offers) {
    const oExt = o as Offer & { applicationId?: string | null; source?: OfferSource };
    if (oExt.applicationId !== undefined && oExt.source !== undefined) continue;
    const matchingApp = db.applications
      .filter((a) =>
        a.campaignId === o.campaignId &&
        a.creatorId === o.creatorId &&
        new Date(a.submittedAt).getTime() < new Date(o.sentAt).getTime() &&
        (a.status === 'submitted' || a.status === 'shortlisted'),
      )
      .sort((a, b) => +new Date(b.submittedAt) - +new Date(a.submittedAt))[0];
    oExt.applicationId = matchingApp?.id ?? null;
    oExt.source = matchingApp ? 'application' : 'cold-outreach';
  }

  // §1.9 — placeholder collaborationId on every thread
  for (const t of db.threads) {
    const tExt = t as Thread & { collaborationId?: string | null };
    if (tExt.collaborationId === undefined) tExt.collaborationId = null;
  }
}

// =====================================================================
// Migrator 3 — P1c: Collaboration as first-class entity.
// =====================================================================
//
// §1.1 — materialize Collaboration rows from existing applications,
// offers, and submissions. Backfill collaborationId FKs on those entities
// so subsequent phases (P2 Contract / Dispute, P3 cancel-collab) can
// reference Collaboration by id.
//
// Per-pair stage is computed by `_legacyComputeCollabStage` — a
// self-contained copy of pre-P1c `deriveCollab`'s stage logic. The
// migrator is the only consumer of that function; runtime code reads
// `collab.stage` directly from now on.
//
// Plus §1.9 — promote threads to point at their matching Collaboration
// once it exists (every thread with `campaignId` set + matching brand×
// creator participant pair gets `collaborationId` populated).

function _legacyComputeCollabStage(
  campaignId: string,
  creatorId: string,
  db: Database,
): CollabStage {
  const apps = db.applications.filter((a) => a.campaignId === campaignId && a.creatorId === creatorId);
  const offers = db.offers.filter((o) => o.campaignId === campaignId && o.creatorId === creatorId);
  const subs = db.submissions.filter((s) => s.campaignId === campaignId && s.creatorId === creatorId);

  const acceptedOffer = offers.find((o) => o.status === 'accepted');
  const latestSub = subs.sort((a, b) => +new Date(b.submittedAt) - +new Date(a.submittedAt))[0];
  const creator = db.creators.find((c) => c.id === creatorId);

  // Has any payout cleared for this (campaign, creator) pair?
  const hasPayout = creator
    ? db.transactions.some(
        (t) =>
          (t.kind === 'escrow_release' || t.kind === 'payout') &&
          t.campaignId === campaignId &&
          (t.userId === creator.userId || t.counterpartyUserId === creator.userId) &&
          t.status === 'cleared',
      )
    : false;

  // Cancelled signals — no live offer/app, only declined/withdrawn/rejected.
  const allDeclined =
    apps.every((a) => a.status === 'rejected' || a.status === 'withdrawn') &&
    offers.every((o) => o.status === 'declined' || o.status === 'withdrawn');
  if (apps.length > 0 || offers.length > 0) {
    if (allDeclined && !acceptedOffer && subs.length === 0) return 'cancelled';
  }

  // Most-progressed signal wins (paid > live > approved > submitted > confirmed > negotiating > pitched > invited).
  if (acceptedOffer) {
    if (hasPayout) return 'paid';
    if (latestSub) {
      // Brand "marked live" via permalink set OR via legacy 'LIVE: ...' feedback line.
      const isLive = !!latestSub.permalink ||
        latestSub.feedback?.some((f) => f.text.startsWith('LIVE: '));
      if (latestSub.status === 'approved' && isLive) return 'live';
      if (latestSub.status === 'approved') return 'approved';
      if (latestSub.status === 'in_review') return 'submitted';
      if (latestSub.status === 'revisions') return 'submitted'; // still under review per brief
    }
    return 'confirmed';
  }
  if (offers.some((o) => o.status === 'pending' || o.status === 'countered')) return 'negotiating';
  if (apps.some((a) => a.status === 'submitted' || a.status === 'shortlisted')) return 'pitched';
  // No apps, no offers, but creator was somehow associated (e.g., invite-flow
  // pre-P1c didn't have a clean shape — defaults to invited).
  return 'invited';
}

function migrateP1c(db: Database): void {
  if (!db.collaborations) (db as Database).collaborations = [];
  if (db.collaborations.length > 0) return; // idempotent — already migrated

  // 1. Group existing applications + offers + submissions by (campaignId, creatorId)
  const pairs = new Set<string>();
  for (const a of db.applications) pairs.add(`${a.campaignId}|${a.creatorId}`);
  for (const o of db.offers) pairs.add(`${o.campaignId}|${o.creatorId}`);
  for (const s of db.submissions) pairs.add(`${s.campaignId}|${s.creatorId}`);

  for (const pair of pairs) {
    const [campaignId, creatorId] = pair.split('|');
    const camp = db.campaigns.find((c) => c.id === campaignId);
    if (!camp) continue;

    const stage = _legacyComputeCollabStage(campaignId, creatorId, db);

    const apps = db.applications.filter((a) => a.campaignId === campaignId && a.creatorId === creatorId);
    const offers = db.offers.filter((o) => o.campaignId === campaignId && o.creatorId === creatorId);
    const subs = db.submissions.filter((s) => s.campaignId === campaignId && s.creatorId === creatorId);
    const acceptedOffer = offers.find((o) => o.status === 'accepted');

    // ID format: col_<base36-of-campaign-creator-hash>
    const idHash = (campaignId + ':' + creatorId)
      .split('')
      .reduce((h, c) => ((h * 31 + c.charCodeAt(0)) >>> 0), 0)
      .toString(36);
    const id = `col_${idHash}`;

    // Earliest event determines createdAt; latest updates updatedAt.
    const eventTimes: number[] = [
      ...apps.map((a) => +new Date(a.submittedAt)),
      ...offers.map((o) => +new Date(o.sentAt)),
      ...subs.map((s) => +new Date(s.submittedAt)),
    ];
    const fallbackTime = +new Date(camp.createdAt);
    const createdAt = eventTimes.length > 0 ? Math.min(...eventTimes) : fallbackTime;
    const updatedAt = eventTimes.length > 0 ? Math.max(...eventTimes) : fallbackTime;

    // Build coarse history from the events we can date. Best-effort —
    // exact transition timestamps aren't always reconstructable.
    const history: CollabHistoryEntry[] = [];
    const earliestApp = apps.sort((a, b) => +new Date(a.submittedAt) - +new Date(b.submittedAt))[0];
    if (earliestApp) {
      history.push({
        at: +new Date(earliestApp.submittedAt),
        from: null,
        to: 'pitched',
        actorUserId: db.users.find((u) => u.creatorId === creatorId)?.id ?? '',
      });
    }
    const earliestOffer = offers.sort((a, b) => +new Date(a.sentAt) - +new Date(b.sentAt))[0];
    if (earliestOffer) {
      history.push({
        at: +new Date(earliestOffer.sentAt),
        from: history[history.length - 1]?.to ?? null,
        to: 'negotiating',
        actorUserId: db.users.find((u) => u.brandId === camp.brandId && u.teamRole === 'admin')?.id ?? '',
      });
    }
    if (acceptedOffer) {
      history.push({
        at: +new Date(acceptedOffer.respondedAt ?? acceptedOffer.sentAt),
        from: history[history.length - 1]?.to ?? null,
        to: 'confirmed',
        actorUserId: db.users.find((u) => u.creatorId === creatorId)?.id ?? '',
      });
    }
    if (subs.length > 0) {
      const earliestSub = subs.sort((a, b) => +new Date(a.submittedAt) - +new Date(b.submittedAt))[0];
      history.push({
        at: +new Date(earliestSub.submittedAt),
        from: history[history.length - 1]?.to ?? null,
        to: 'submitted',
        actorUserId: db.users.find((u) => u.creatorId === creatorId)?.id ?? '',
      });
    }
    // Final stage entry only if it differs from the last recorded transition.
    if (history.length === 0 || history[history.length - 1].to !== stage) {
      history.push({
        at: updatedAt,
        from: history[history.length - 1]?.to ?? null,
        to: stage,
        actorUserId: '',
      });
    }

    db.collaborations.push({
      id,
      campaignId,
      creatorId,
      brandId: camp.brandId,
      stage,
      createdAt,
      updatedAt,
      agreedRate: acceptedOffer?.rate ?? null,
      acceptedOfferId: acceptedOffer?.id ?? null,
      contractId: null, // P2 populates
      cancelledAt: stage === 'cancelled' ? updatedAt : null,
      cancellationReason: null,
      history,
    });

    // Backfill collaborationId on related entities. Cast through `unknown`
    // because the field is optional during the transition phase but the
    // production code will tighten in P2.
    for (const a of apps) (a as Application & { collaborationId?: string }).collaborationId = id;
    for (const o of offers) (o as Offer & { collaborationId?: string }).collaborationId = id;
    for (const s of subs) (s as Submission & { collaborationId?: string }).collaborationId = id;
  }

  // 2. §1.9 — promote threads to their matching Collaboration. A thread
  // with campaignId + matching brand-user × creator-user participants
  // points at the corresponding Collaboration.
  for (const t of db.threads) {
    if (t.collaborationId !== null) continue;
    if (!t.campaignId) continue;
    const participantIds = new Set(t.participants);
    const matching = db.collaborations.find((col) => {
      if (col.campaignId !== t.campaignId) return false;
      const creatorUser = db.users.find((u) => u.creatorId === col.creatorId);
      const brandUsers = db.users.filter((u) => u.brandId === col.brandId);
      return !!creatorUser
        && brandUsers.some((bu) => participantIds.has(bu.id) && participantIds.has(creatorUser.id));
    });
    if (matching) t.collaborationId = matching.id;
  }
}

// =====================================================================
// Migrator 4 — P1d: Structured Deliverable.
// =====================================================================
//
// §1.5/§1.6 — replaces `Campaign.deliverables` (free-form string) +
// `[slot:N]` notes encoding with structured `Deliverable[]` rows.
//
// Steps for each campaign:
//   1. If `deliverableIds` is already set, skip (idempotent).
//   2. Read text from either `deliverablesText` (post-migration shape) or
//      legacy `deliverables` field (pre-migration shape). Whichever wins,
//      promote into `deliverablesText`. Delete the legacy `deliverables`
//      key so subsequent reads can't accidentally consume it.
//   3. Parse the text into N slots via `_legacyParseDeliverableSlots` —
//      a self-contained copy of the pre-P1d `parseDeliverableSlots`
//      regex from `v2Adapters.ts`. The runtime version is stripped from
//      that file in the same phase; the migrator's copy stays as the
//      bootstrap path.
//   4. For each slot, create a `Deliverable` row. Platform + format are
//      inferred from the slot label via the keyword maps below.
//   5. Push every row's `id` into `Campaign.deliverableIds`.
//
// Then for each submission:
//   1. If `deliverableId` is already set, skip.
//   2. Match `^\[slot:(\d+)\]\s*` in `notes`. If matched, look up the
//      Deliverable for `(campaignId, index)` and set `deliverableId`,
//      then strip the prefix from `notes`.
//   3. If unmatched (legacy untagged submission), default to slot 0
//      of the campaign — same fallback the adapter used.
//
// Both passes are idempotent: re-running on already-migrated state
// short-circuits at step 1 of each loop.

function _legacyParseDeliverableSlots(
  s: string | undefined,
): { index: number; label: string; type: string }[] {
  if (!s) return [{ index: 0, label: 'Deliverable', type: 'deliverable' }];
  const slots: { index: number; label: string; type: string }[] = [];
  const segments = s.split(/\s*\+\s*|\s+and\s+/i);
  for (const raw of segments) {
    const seg = raw.trim();
    if (!seg) continue;

    // Same patterns as the runtime parser was: "3 Stories", "Stories ×3",
    // "Stories x 3", "(3 episodes)".
    let count = 1;
    let label = seg;
    const leading = seg.match(/^(\d+)\s+(.+)$/);
    const trailing = seg.match(/^(.+?)\s*[×x]\s*(\d+)$/i);
    const parens = seg.match(/^(.+?)\s*\(\s*(\d+)\s+([a-z]+)s?\s*\)$/i);
    if (leading) { count = parseInt(leading[1], 10); label = leading[2].trim(); }
    else if (trailing) { count = parseInt(trailing[2], 10); label = trailing[1].trim(); }
    else if (parens) { count = parseInt(parens[2], 10); label = parens[1].trim() + ' ' + parens[3]; }

    count = Math.min(Math.max(count, 1), 10);

    const type = label.toLowerCase().split(/\s+/).slice(-1)[0] || 'deliverable';
    for (let i = 0; i < count; i++) {
      slots.push({
        index: slots.length,
        label: count > 1 ? `${label} ${i + 1}` : label,
        type,
      });
    }
  }
  if (slots.length === 0) {
    slots.push({ index: 0, label: 'Deliverable', type: 'deliverable' });
  }
  return slots;
}

function inferPlatform(label: string): DeliverablePlatform {
  const l = label.toLowerCase();
  // Order matters: more specific keywords first so "youtube short" doesn't
  // match the bare "short" → platform mapping (it doesn't have one anyway,
  // but keeps the intent clear).
  if (l.includes('tiktok') || l.includes('tik tok')) return 'tiktok';
  if (l.includes('youtube') || l.includes('yt ') || l.includes(' yt')) return 'youtube';
  if (l.includes('linkedin')) return 'linkedin';
  if (l.includes('newsletter') || l.includes('substack')) return 'newsletter';
  if (l.includes('podcast') || l.includes('episode')) return 'podcast';
  if (l.includes('twitter') || l.includes('thread') || l.startsWith('x ') || l === 'x') return 'x';
  if (l.includes('reel') || l.includes('story') || l.includes('insta') || l.includes('ig ')) return 'instagram';
  // Default fallback — Instagram is the most common platform in the seed.
  return 'instagram';
}

function inferFormat(label: string, type: string): DeliverableFormat {
  // Compare against both the type word (last token) and the full label.
  const t = type.toLowerCase();
  const l = label.toLowerCase();
  if (t.includes('reel') || l.includes('reel')) return 'reel';
  if (t.includes('story') || l.includes('story') || l.includes('stories')) return 'story';
  if (t.includes('long') || l.includes('long')) return 'longform';
  if (t.includes('short') || l.includes('youtube short') || l.includes('yt short')) return 'short';
  if (t.includes('episode') || l.includes('episode')) return 'episode';
  if (t.includes('thread') || l.includes('thread')) return 'thread';
  if (t.includes('carousel') || l.includes('carousel')) return 'carousel';
  if (t.includes('live') || l.includes('live')) return 'live';
  return 'post';
}

function migrateP1d(db: Database): void {
  if (!db.deliverables) (db as Database).deliverables = [];

  // 1. Walk campaigns: rename field if needed, materialize Deliverable[].
  for (const camp of db.campaigns) {
    const cTyped = camp as Campaign & { deliverables?: string };
    if (cTyped.deliverableIds && cTyped.deliverableIds.length > 0) continue;

    const text = cTyped.deliverablesText ?? cTyped.deliverables ?? '';
    cTyped.deliverablesText = text;
    delete cTyped.deliverables;

    const slots = _legacyParseDeliverableSlots(text);
    const ids: string[] = [];
    for (const slot of slots) {
      const id = `del_${camp.id}_${slot.index}`;
      // Skip if already exists (defensive — partial reruns).
      if (db.deliverables.some((d) => d.id === id)) {
        ids.push(id);
        continue;
      }
      db.deliverables.push({
        id,
        campaignId: camp.id,
        index: slot.index,
        platform: inferPlatform(slot.label),
        format: inferFormat(slot.label, slot.type),
        quantity: 1,
        dueOffsetDays: null,
        specs: null,
      });
      ids.push(id);
    }
    cTyped.deliverableIds = ids;
  }

  // 2. Walk submissions: parse [slot:N] from notes, map to deliverableId.
  for (const s of db.submissions) {
    const sTyped = s as Submission;
    if (sTyped.deliverableId) continue;

    const m = sTyped.notes.match(/^\[slot:(\d+)\]\s*/);
    if (m) {
      const slotIdx = parseInt(m[1], 10);
      const matching = db.deliverables.find(
        (d) => d.campaignId === sTyped.campaignId && d.index === slotIdx,
      );
      if (matching) sTyped.deliverableId = matching.id;
      sTyped.notes = sTyped.notes.replace(/^\[slot:\d+\]\s*/, '');
    }
    // Legacy untagged submissions → slot 0 of the campaign.
    if (!sTyped.deliverableId) {
      const fallback = db.deliverables.find(
        (d) => d.campaignId === sTyped.campaignId && d.index === 0,
      );
      if (fallback) sTyped.deliverableId = fallback.id;
    }
  }
}

// =====================================================================
// Migrator 5 — P2: Contract + Dispute reshape.
// =====================================================================
//
// §1.3 — Contract is the immutable agreement snapshot. One Contract
// per accepted offer. Migrator 5 walks every Collaboration whose stage
// indicates an accepted offer (`confirmed | submitted | approved | live | paid`)
// and materializes a Contract from the latest accepted Offer + the
// campaign's brief/deliverables at the time of migration. The
// `Collaboration.contractId` FK is set to the new row.
//
// §1.4 — Dispute reshape. Pre-P2 the Dispute was tied to a
// (campaignId, openedByUserId, againstUserId) triple with a flat
// status/reason enum. Post-P2 it's tied to the Collaboration with
// `(raisedByUserId, raisedByRole, category)` and a richer state
// machine. Migrator 5 reshapes every existing Dispute:
//   - Find the Collaboration via (campaignId, creator-side party). The
//     creator side is whichever of the pre-P2 (openedByUserId,
//     againstUserId) maps to a User with a creatorId.
//   - Translate field names (openedByUserId → raisedByUserId, etc).
//   - Map the legacy reason enum to the new category enum.
//   - Map the legacy status enum to the new status enum.
//   - Coerce string timestamps to numeric (milliseconds since epoch).
//   - Add empty `evidence: []` and `messages: []`.
//   - Set `updatedAt` to the resolution timestamp (if resolved) or the
//     raised timestamp (still open).
//
// Migrator 5 is destructive on the legacy Dispute fields: after this
// migration, `openedByUserId`, `openedAt`, `againstUserId`, `reason`,
// `details`, and the old `resolution.byUserId/at(string)/releasedToCreator/
// refundedToBrand` keys are deleted off the records to keep the type
// honest. The new fields are populated in-place on the same row id.
//
// Idempotent guard: presence of `db.contracts.length > 0` short-circuits
// the contract pass. The dispute reshape is idempotent because reshaped
// rows already have `raisedByUserId` set (= short-circuit guard).

const LEGACY_DISPUTE_REASON_TO_CATEGORY: Record<string, DisputeCategory> = {
  creator_no_show:   'non-delivery',
  brand_no_approval: 'quality', // closest fit — brand stalling on review
  content_quality:   'quality',
  rights_violation:  'content-takedown',
  payment_issue:     'late-payment',
  other:             'other',
};

const LEGACY_DISPUTE_STATUS_TO_NEW: Record<string, DisputeStatus> = {
  open:                  'open',
  resolved_for_brand:    'resolved-refund',
  resolved_for_creator:  'resolved-release',
  resolved_split:        'resolved-partial',
  withdrawn:             'withdrawn',
};

const PLATFORM_FEE_RATE = 0.10;
const WHT_RATE = 0.05;

function coerceNumericTimestamp(v: unknown, fallback: number): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const t = +new Date(v);
    return Number.isFinite(t) ? t : fallback;
  }
  return fallback;
}

function migrateP2(db: Database): void {
  if (!db.contracts) (db as Database).contracts = [];

  // 1. §1.3 — backfill Contracts for every Collaboration with an
  //    accepted offer. Idempotent via `Collaboration.contractId` check.
  const acceptedStages: CollabStage[] = [
    'confirmed', 'submitted', 'approved', 'live', 'paid',
  ];
  for (const collab of db.collaborations) {
    if (collab.contractId) continue;
    if (!acceptedStages.includes(collab.stage)) continue;

    const camp = db.campaigns.find((c) => c.id === collab.campaignId);
    if (!camp) continue;

    // Pick the latest accepted offer (post counter-then-reaccept cycles
    // the latest is the one that locked the rate).
    const acceptedOffer = db.offers
      .filter((o) =>
        o.campaignId === collab.campaignId &&
        o.creatorId === collab.creatorId &&
        o.status === 'accepted',
      )
      .sort((a, b) => +new Date(b.respondedAt ?? b.sentAt) - +new Date(a.respondedAt ?? a.sentAt))[0];
    if (!acceptedOffer) continue;

    const rate = acceptedOffer.rate;
    const platformFee = Math.round(rate * PLATFORM_FEE_RATE);
    const withholdingTax = Math.round(rate * WHT_RATE);
    const netToCreator = rate - platformFee - withholdingTax;

    const acceptedAt = coerceNumericTimestamp(
      acceptedOffer.respondedAt ?? acceptedOffer.sentAt,
      collab.createdAt,
    );

    // Snapshot the campaign's structured Deliverable rows at this
    // moment. Editing the campaign's deliverables later doesn't change
    // the snapshot.
    const deliverableSnapshots: ContractDeliverableSnapshot[] = db.deliverables
      .filter((d) => d.campaignId === collab.campaignId)
      .sort((a, b) => a.index - b.index)
      .map((d) => ({
        deliverableId: d.id,
        index: d.index,
        platform: d.platform,
        format: d.format,
        quantity: d.quantity,
        dueOffsetDays: d.dueOffsetDays,
        specs: d.specs,
      }));

    // Find who accepted — creator-side user is the natural actor
    // (offers get accepted by the creator). Fallback to the campaign
    // owner if we can't resolve.
    const creatorUser = db.users.find((u) => u.creatorId === collab.creatorId);
    const acceptedByUserId = creatorUser?.id ?? camp.brandId;

    const contractId = `ctr_${collab.id}`;
    const contract: Contract = {
      id: contractId,
      collaborationId: collab.id,
      campaignId: collab.campaignId,
      creatorId: collab.creatorId,
      brandId: collab.brandId,
      agreedRate: rate,
      netToCreator,
      platformFee,
      withholdingTax,
      deliverables: deliverableSnapshots,
      briefSnapshot: camp.brief,
      briefSnapshotAt: acceptedAt,
      acceptedAt,
      acceptedByUserId,
      // 'paid' collabs already fulfilled the contract; everything else
      // active until campaign-end / cancellation (future P3 work).
      status: collab.stage === 'paid' ? 'fulfilled' : 'active',
      fulfilledAt: collab.stage === 'paid' ? collab.updatedAt : null,
      cancelledAt: null,
    };
    db.contracts.push(contract);
    collab.contractId = contractId;
  }

  // 2. §1.4 — reshape existing Disputes. Pre-P2 fields → P2 names.
  //    Idempotent via `raisedByUserId` presence check.
  //
  //    Audit fix: the reshape used to skip when `raisedByUserId` was
  //    set, but seeded disputes ship with `raisedByUserId` AND an
  //    intentionally-empty `collaborationId: ''` (placeholder for the
  //    migrator to fill from the campaign + creator pair). The skip
  //    was leaving the placeholder un-populated. Now we backfill the
  //    `collaborationId` independently of the field reshape — even if
  //    the dispute is already in the new shape, an empty FK gets
  //    resolved.
  for (const d of db.disputes) {
    const dTyped = d as Dispute & {
      openedByUserId?: string;
      openedAt?: string | number;
      againstUserId?: string;
      reason?: string;
      details?: string;
    };

    // Always backfill an empty `collaborationId` from the campaign +
    // creator side, regardless of whether the rest of the row was
    // already reshaped.
    if (!dTyped.collaborationId || dTyped.collaborationId === '') {
      const candidates = [dTyped.raisedByUserId, dTyped.openedByUserId, dTyped.againstUserId]
        .filter((id): id is string => !!id);
      let derivedCreatorId: string | undefined;
      for (const uid of candidates) {
        const u = db.users.find((x) => x.id === uid);
        if (u?.creatorId) {
          derivedCreatorId = u.creatorId;
          break;
        }
      }
      if (derivedCreatorId) {
        const matchedCollab = db.collaborations.find(
          (c) => c.campaignId === d.campaignId && c.creatorId === derivedCreatorId,
        );
        if (matchedCollab) dTyped.collaborationId = matchedCollab.id;
      }
    }

    if (dTyped.raisedByUserId) continue; // already reshaped

    // The pre-P2 dispute had `(openedByUserId, againstUserId)`. Find
    // the Collaboration by matching on (campaignId, creator side).
    const candidates = [dTyped.openedByUserId, dTyped.againstUserId]
      .filter((id): id is string => !!id);
    let creatorUserId: string | undefined;
    let creatorId: string | undefined;
    for (const uid of candidates) {
      const u = db.users.find((x) => x.id === uid);
      if (u?.creatorId) {
        creatorUserId = uid;
        creatorId = u.creatorId;
        break;
      }
    }
    const collab = creatorId
      ? db.collaborations.find((c) =>
          c.campaignId === d.campaignId && c.creatorId === creatorId,
        )
      : undefined;

    const raisedByUserId = dTyped.openedByUserId ?? '';
    const raisedByUser = db.users.find((u) => u.id === raisedByUserId);
    const raisedByRole: 'brand' | 'creator' = raisedByUser?.creatorId ? 'creator' : 'brand';

    const category = LEGACY_DISPUTE_REASON_TO_CATEGORY[dTyped.reason ?? 'other'] ?? 'other';
    const newStatus = LEGACY_DISPUTE_STATUS_TO_NEW[d.status] ?? 'open';
    const raisedAt = coerceNumericTimestamp(dTyped.openedAt, Date.now());

    // Resolution shape change.
    const legacyResolution = d.resolution as
      | undefined
      | (Dispute['resolution'] & { byUserId?: string; at?: string | number; releasedToCreator?: number; refundedToBrand?: number });
    const newResolution: Dispute['resolution'] = legacyResolution
      ? {
          by: legacyResolution.byUserId ?? legacyResolution.by ?? '',
          at: coerceNumericTimestamp(legacyResolution.at, raisedAt),
          note: legacyResolution.note,
          refundAmount: legacyResolution.refundAmount ?? legacyResolution.refundedToBrand,
          releaseAmount: legacyResolution.releaseAmount ?? legacyResolution.releasedToCreator,
        }
      : null;

    // Stamp the new fields onto the row in-place; clear the legacy ones.
    dTyped.collaborationId = collab?.id ?? '';
    dTyped.raisedByUserId = raisedByUserId;
    dTyped.raisedByRole = raisedByRole;
    dTyped.category = category;
    dTyped.description = dTyped.details ?? '';
    dTyped.evidence = dTyped.evidence ?? [];
    dTyped.status = newStatus;
    dTyped.resolution = newResolution;
    dTyped.raisedAt = raisedAt;
    dTyped.updatedAt = newResolution?.at ?? raisedAt;
    dTyped.messages = dTyped.messages ?? [];

    // Clear pre-P2 fields off the record so post-migration types are honest.
    delete dTyped.openedByUserId;
    delete dTyped.openedAt;
    delete dTyped.againstUserId;
    delete dTyped.reason;
    delete dTyped.details;
    if (legacyResolution) {
      const r = dTyped.resolution as unknown as Record<string, unknown>;
      delete r.byUserId;
      delete r.releasedToCreator;
      delete r.refundedToBrand;
    }

    // If the dispute is currently open or in-review, mirror to
    // Collaboration.escrowFrozen so v2ApproveContent guards correctly.
    if (collab && (newStatus === 'open' || newStatus === 'in-review')) {
      collab.escrowFrozen = true;
    }

    // creatorUserId is a tracing only var — touch to satisfy noUnusedLocals
    void creatorUserId;
  }
}

// =====================================================================
// Migrator 6 — P3: workflow fixes — counter rounds + autoShortlist default.
// =====================================================================
//
// §2.1 — `Offer.counter?: { rate, message, at }` (single counter slot)
// is replaced by `Offer.rounds: OfferRound[]` so the full negotiation
// transcript survives counter-counter cycles. Cap is enforced at the
// mutation layer (`MAX_OFFER_ROUNDS` in v2CampaignActions).
//
// §2.4 — `Campaign.autoShortlist` defaults to `null` on every existing
// campaign so the manual-review flow keeps working.
//
// Idempotency: presence of `Offer.rounds` short-circuits the offer
// pass; presence of `autoShortlist === undefined` is the exact opt-in
// guard for the campaign pass.

function migrateP3(db: Database): void {
  // §2.1 — promote `counter` into `rounds[]`.
  for (const o of db.offers) {
    const oTyped = o as Offer & {
      counter?: { rate: number; message: string; at?: string };
      rounds?: OfferRound[];
    };
    if (oTyped.rounds && oTyped.rounds.length > 0) continue;

    // Round 0 is always the brand's initial send.
    const initialAt = +new Date(o.sentAt);
    oTyped.rounds = [
      { by: 'brand', at: Number.isFinite(initialAt) ? initialAt : Date.now(), rate: o.rate, message: o.message ?? null },
    ];
    if (oTyped.counter) {
      const counterAt = oTyped.counter.at ? +new Date(oTyped.counter.at) : Number.NaN;
      const respondedAt = o.respondedAt ? +new Date(o.respondedAt) : Number.NaN;
      const at = Number.isFinite(counterAt)
        ? counterAt
        : (Number.isFinite(respondedAt) ? respondedAt : initialAt);
      oTyped.rounds.push({
        by: 'creator',
        at,
        rate: oTyped.counter.rate,
        message: oTyped.counter.message ?? null,
      });
      delete oTyped.counter;
    }
  }

  // §2.4 — default `autoShortlist: null` on existing campaigns. Setting
  // explicit `null` (not `undefined`) lets the type widen to optional
  // without callers having to handle the missing-key case.
  for (const c of db.campaigns) {
    const cTyped = c as Campaign & { autoShortlist?: object | null };
    if (cTyped.autoShortlist === undefined) {
      cTyped.autoShortlist = null;
    }
  }
}

// =====================================================================
// Migrator 7 — P4: scheduled notifications + review moderation defaults.
// =====================================================================
//
// §3.1 — `scheduledNotifications: ScheduledNotification[]` table is
// added to Database. Existing stores from before P4 don't have the
// field; the migrator ensures it's present (empty) so `tx()` clones
// + scheduler heartbeats find a real array.
//
// §3.2 — every Review gains optional moderation fields. Migrator 7
// stamps `reportedBy: []` and `hidden: false` defaults so consumers
// can read without optional-chaining everywhere. (Storefront filters
// look for `hidden === true` explicitly so missing fields are safe;
// the defaults are belt-and-suspenders.)

function migrateP4(db: Database): void {
  // §3.1 — scheduledNotifications table.
  if (!db.scheduledNotifications) {
    (db as Database).scheduledNotifications = [];
  }

  // §3.2 — Review moderation defaults.
  for (const r of db.reviews) {
    const rTyped = r as Review;
    if (rTyped.reportedBy === undefined) rTyped.reportedBy = [];
    if (rTyped.hidden === undefined) rTyped.hidden = false;
  }
}

// =====================================================================
// Migrator 8 — P5: capability matrix prep — adminRoles defaults.
// =====================================================================
//
// §4.2 — `User.adminRoles?: AdminRole[]` is added to the User type.
// Pre-P5, every platform admin was implicitly a super-admin (any
// `role === 'admin'` user could do everything). P5 lets us assign
// specialized admin roles per user; the migrator stamps `['super']`
// on every existing platform admin so existing behavior is preserved.
//
// Brand-side `teamRole` is not touched — pre-P5 brand users without
// an explicit teamRole defaulted to full mutation access; the
// `lib/permissions.ts` reader keeps that compatibility by treating a
// missing teamRole as `'admin'`. We DON'T retroactively stamp
// `teamRole: 'admin'` on legacy brand users because the brand-team
// flow distinguishes "owner with no explicit role" from "owner
// onboarded as admin" elsewhere (notification preferences, etc.).
//
// Idempotent guard: `User.adminRoles !== undefined` skips the row.

function migrateP5(db: Database): void {
  for (const u of db.users) {
    const uTyped = u as User;
    if (uTyped.role !== 'admin') continue;
    if (uTyped.adminRoles !== undefined) continue;
    uTyped.adminRoles = ['super'] as AdminRole[];
  }
}

// =====================================================================
// Migrator 9 — P6 §5.5 + §5.6: channel verification reset + drop
// persisted profileCompletion.
// =====================================================================
//
// §5.5 — pre-P6 every Platform on every Creator was seeded with
// `verified: true` (the demo wanted to look polished). P6 makes
// `verified` an earned signal: new channels start unverified, the
// creator earns the badge through a stub OAuth flow (`v2VerifyChannel`).
// To keep the demo honest, migrator 9 resets every existing Platform
// to `verified: false`. Existing creators have to re-verify (which is
// a 1.5s mock click in the storefront editor — they'll bear it).
//
// §5.6 — `Creator.profileCompletion` was a stored 0–100 number that
// drifted from reality. Migrator 9 deletes the field; consumers
// compute on read via `lib/utils/profile-completion.ts`.
//
// Idempotent: re-running on already-migrated data is a no-op
// (verified=false stays false; deleted profileCompletion stays gone).

function migrateP6(db: Database): void {
  for (const c of db.creators) {
    // §5.5 — reset every Platform's verified flag.
    if (c.platforms && c.platforms.length > 0) {
      c.platforms = c.platforms.map((p) => ({ ...p, verified: false }));
    }
    // §5.6 — drop the stored profileCompletion field. Optional cast
    // because the type is `?: number` post-P6 — TS would let us
    // assign undefined directly, but `delete` makes the persisted
    // shape match the type exactly.
    delete (c as Creator & { profileCompletion?: number }).profileCompletion;
  }
  // §5.3 — initialize the outreach table if absent (defensive against
  // older persisted shapes).
  if (!db.outreach) (db as Database).outreach = [];
}

const migrations: Record<number, Migrator> = {
  1: migrateP1a,
  2: migrateP1b,
  3: migrateP1c,
  4: migrateP1d,
  5: migrateP2,
  6: migrateP3,
  7: migrateP4,
  8: migrateP5,
  9: migrateP6,
};

/**
 * Run any migrators between the persisted store's current version and
 * `CURRENT_MIGRATION_VERSION`. Mutates `db` in place. Idempotent — calling
 * twice is a no-op because the version is bumped after each run.
 *
 * Returns the same `db` reference for chaining.
 */
export function runPendingMigrations(db: Database): Database {
  const start = (db.migrationVersion ?? 0) + 1;
  for (let v = start; v <= CURRENT_MIGRATION_VERSION; v++) {
    const m = migrations[v];
    if (m) m(db);
  }
  db.migrationVersion = CURRENT_MIGRATION_VERSION;
  return db;
}
