// collabSync.ts — keep Collaboration.stage + history in sync with the
// underlying apps / offers / submissions / transactions.
//
// P1c §1.1 lands Collaboration as a stored entity. The naive approach
// would be: every mutation that transitions stage writes to
// Collaboration.stage explicitly. The problem: ~15 mutations touch the
// (campaign, creator) pair and each would have to know which CollabStage
// to set. Drift risk is high.
//
// This module's contract: source of truth for collab stage stays in
// applications + offers + submissions + transactions. Mutations call
// `ensureCollabState(campaignId, creatorId, db, actorUserId, reason?)`
// at the end of their `tx` block. The helper:
//   1. Finds or creates the Collaboration row for the pair.
//   2. Recomputes stage from the pair's records using the same logic as
//      pre-P1c `deriveCollab` (and migrator 3's `_legacyComputeCollabStage`).
//   3. If stage changed, appends a history entry + bumps updatedAt.
//   4. Updates `agreedRate` and `acceptedOfferId` to track the latest
//      accepted offer.
//
// This means mutations stay simple — they just update the underlying
// apps/offers/subs as before, then call ensureCollabState. The
// invariant "Collaboration.stage matches what deriveCollab would
// have computed" is the test gate.

import type {
  Database, Collaboration, CollabStage, CollabHistoryEntry, Offer, Application, Submission,
  Deliverable,
} from './types';
// Status classification lives in ONE place, exhaustively — see the note in
// collabLifecycle.ts on how a missing `expired` became a fake invitation.
import {
  applicationIsDead, applicationIsLive, offerIsDead, offerIsLive,
} from './collabLifecycle';

function newCollabId(campaignId: string, creatorId: string): string {
  const idHash = (campaignId + ':' + creatorId)
    .split('')
    .reduce((h, c) => ((h * 31 + c.charCodeAt(0)) >>> 0), 0)
    .toString(36);
  return `col_${idHash}`;
}

/** True when an approved submission carries the post-publication signal:
 *  the creator-pasted `permalink` field, or the legacy `LIVE: <url>`
 *  feedback entry appended by v2MarkContentLive. Payout state is
 *  deliberately NOT part of this — escrow releases at approve-time in
 *  this model, so "money moved" says nothing about "post is up". */
export function submissionIsLive(s: Submission): boolean {
  // A reported takedown wins over the permalink. Liveness was previously
  // inferred purely from the link existing, so a post that had been deleted
  // still read as live — and the only way to stop it was to delete the
  // record of what had been posted.
  if (s.postDownAt) return false;
  return s.status === 'approved' && (
    !!s.permalink || (s.feedback ?? []).some((f) => f.text.startsWith('LIVE: '))
  );
}

/** Resolve the Deliverable a submission belongs to. Same rule as the
 *  v2 adapter (`deliverableForSubmission`): direct FK first, then the
 *  legacy `[slot:N]` notes prefix, then slot 0. Shared here so the
 *  stored-stage computation and the UI projection group submissions
 *  identically. */
export function deliverableIdForSubmission(s: Submission, db: Database): string | undefined {
  if (s.deliverableId && db.deliverables.some((d) => d.id === s.deliverableId)) {
    return s.deliverableId;
  }
  const m = s.notes?.match(/^\[slot:(\d+)\]/);
  const slotIdx = m ? parseInt(m[1], 10) : 0;
  return db.deliverables.find(
    (d) => d.campaignId === s.campaignId && d.index === slotIdx,
  )?.id;
}

export type SlotStatus = 'pending' | 'in_review' | 'revision' | 'approved' | 'live' | 'rejected';

export interface CollabSlot {
  deliverable: Deliverable;
  status: SlotStatus;
  /** Latest-round submission filling this slot, if any. */
  latestSubmission: Submission | null;
}

/** Per-deliverable slot statuses for one (campaign, creator) pair —
 *  the shared building block for stage computation. `deriveCollab`
 *  (v2Adapters) renders its deliverable chips from these SAME statuses,
 *  so the stored Collaboration.stage and the kanban projection cannot
 *  drift (P67 — pre-fix the two sides grouped/coerced independently:
 *  the adapter flipped approved→live on any payout, the stored side
 *  only looked at the single latest submission across all slots). */
/**
 * The deliverables ONE creator owes on a campaign, in slot order.
 *
 * WORKFLOW-GAPS E3. Campaign-wide rows (`creatorId` null — every row that
 * existed before amendments) are owed by everyone; rows added by an agreed
 * scope amendment are owed by that creator alone.
 *
 * Every consumer must go through here. Filtering on `campaignId` alone was
 * correct only while deliverables were uniformly campaign-wide, and the
 * failure mode is quiet and severe: one creator's extra slot appears on
 * every other creator's collab, and because stage is derived from slot
 * completion, it drags them all backwards out of `approved` and `paid`.
 */
export function deliverablesFor(
  db: Database,
  campaignId: string,
  creatorId: string,
): Deliverable[] {
  return db.deliverables
    .filter((d) => d.campaignId === campaignId
      && (d.creatorId == null || d.creatorId === creatorId))
    .sort((a, b) => a.index - b.index);
}

export function computeSlotStatuses(
  campaignId: string,
  creatorId: string,
  db: Database,
): CollabSlot[] {
  const campDeliverables = deliverablesFor(db, campaignId, creatorId);
  if (campDeliverables.length === 0) return [];
  const subs = db.submissions.filter(
    (s) => s.campaignId === campaignId && s.creatorId === creatorId,
  );
  const subsByDel = new Map<string, Submission[]>();
  for (const s of subs) {
    const delId = deliverableIdForSubmission(s, db);
    if (!delId) continue;
    const list = subsByDel.get(delId) ?? [];
    list.push(s);
    subsByDel.set(delId, list);
  }
  return campDeliverables.map((del) => {
    const latest = (subsByDel.get(del.id) ?? [])
      .sort((a, b) => b.round - a.round)[0] ?? null;
    let status: SlotStatus = 'pending';
    if (latest) {
      status =
        latest.status === 'in_review' ? 'in_review' :
        latest.status === 'revisions' ? 'revision' :
        // Terminal for this slot: the brand said no and stopped trying.
        // Deliberately NOT 'pending' — the deliverable isn't waiting on the
        // creator, it's closed unfulfilled.
        latest.status === 'rejected' ? 'rejected' :
        submissionIsLive(latest) ? 'live' : 'approved';
    }
    return { deliverable: del, status, latestSubmission: latest };
  });
}

/** Single source of truth for collab stage. Consumed by both the
 *  stored-side (`ensureCollabState`) and the UI projection
 *  (`deriveCollab` in v2Adapters) — P67 collapsed the two parallel
 *  derivations into this one function so they can't drift.
 *  (`_legacyComputeCollabStage` in migrations.ts stays frozen at its
 *  migration-time logic by design; it only runs once per legacy store.) */
export function computeCollabStage(
  campaignId: string,
  creatorId: string,
  db: Database,
): CollabStage {
  const apps = db.applications.filter((a) => a.campaignId === campaignId && a.creatorId === creatorId);
  const offers = db.offers.filter((o) => o.campaignId === campaignId && o.creatorId === creatorId);
  const subs = db.submissions.filter((s) => s.campaignId === campaignId && s.creatorId === creatorId);

  const acceptedOffer = offers.find((o) => o.status === 'accepted');
  const creator = db.creators.find((c) => c.id === creatorId);

  const hasPayout = creator
    ? db.transactions.some(
        (t) =>
          (t.kind === 'escrow_release' || t.kind === 'payout') &&
          t.campaignId === campaignId &&
          (t.userId === creator.userId || t.counterpartyUserId === creator.userId) &&
          t.status === 'cleared',
      )
    : false;

  // Cancelled = the only signals are declined/withdrawn/rejected.
  //
  // P67 — dropped the old `subs.length === 0` requirement. A submission
  // can only exist under an accepted offer (v2SubmitContent gates on it);
  // if that offer has since been withdrawn (mutual cancel, end-campaign
  // auto-cancel, refund-only dispute resolution), the deal IS cancelled
  // regardless of the submission history. Pre-fix those flows left the
  // pair stuck at 'pitched'/'invited' and the dead deal re-entered the
  // kanban funnel as a ghost row.
  // Dead is dead, by every route. This used to spell the terminal sets out
  // inline as `rejected|withdrawn` for applications and `declined|withdrawn`
  // for offers — and `OfferStatus` also has `expired`. A pair whose pitch had
  // lapsed and whose offer had expired therefore matched NO branch and fell
  // through to `return 'invited'` at the bottom, which is a real stage whose
  // banner tells the creator a brand reached out. `collabLifecycle` now
  // classifies every status exhaustively, so adding a status is a compile
  // error rather than a silent hole.
  const allDeclined =
    apps.every((a) => applicationIsDead(a.status)) &&
    offers.every((o) => offerIsDead(o.status));
  if ((apps.length > 0 || offers.length > 0)
    && allDeclined && !acceptedOffer) return 'cancelled';

  if (acceptedOffer) {
    // Post-acceptance flow:
    //
    //   confirmed → submitted (any slot in_review / revision)
    //             → approved (every slot approved, payout may have
    //                          cleared, content NOT yet on platform)
    //             → live      (every slot live — permalink set or
    //                          LIVE: feedback)
    //             → paid      (terminal — campaign closed AND payout
    //                          cleared AND at least one slot live)
    //
    // P67 — rolls up across ALL the campaign's Deliverable slots
    // instead of reading the single latest submission. With the old
    // latest-sub rule a 2-deliverable collab with one slot approved
    // and one untouched stored 'approved' while the kanban (which
    // already rolled up per-slot) showed 'confirmed'.
    const slots = computeSlotStatuses(campaignId, creatorId, db);
    if (slots.length > 0) {
      const statuses = slots.map((s) => s.status);
      const anyInReviewOrRevision = statuses.some((s) => s === 'in_review' || s === 'revision');
      // A rejected slot is closed, so it must not hold the collab at
      // `confirmed` forever waiting for work that is never coming. It counts
      // as settled-for-rollup purposes; the money for it stays held until the
      // parties settle or cancel (see WORKFLOW-GAPS F1).
      const allApproved = statuses.every((s) => s === 'approved' || s === 'live' || s === 'rejected');
      const allLive = statuses.every((s) => s === 'live');
      if (anyInReviewOrRevision) return 'submitted';
      if (allApproved) {
        // `paid` = the creator posted, the BRAND verified it, and the money
        // has cleared.
        //
        // Asim's rule: "creator has to make the post live and then only can
        // the brand check make it payable". `allLive` IS that check —
        // `v2MarkContentLive` is a brand capability (`content.markLive`,
        // admin/ops) and refuses until the creator has pasted the permalink.
        // So the gate is already the one he described.
        //
        // What used to sit here as well was `campIsClosed`. Closing a campaign
        // is unrelated brand admin — a creator whose post was verified and
        // whose money had cleared still read as `live` until someone tidied up
        // the campaign, which might never happen. It was also the reason the
        // showcase needed a second closed campaign to display `paid` at all.
        if (allLive && hasPayout) return 'paid';
        if (allLive) return 'live';
        return 'approved';
      }
      return 'confirmed';
    }
    // Legacy fallback — campaigns with no structured Deliverable rows
    // (pre-migrator-4 test fixtures, edge seeds). Latest submission
    // drives the stage, same rules as above scoped to one slot.
    const latestSub = subs.sort((a, b) => +new Date(b.submittedAt) - +new Date(a.submittedAt))[0];
    if (latestSub) {
      const isLive = submissionIsLive(latestSub);
      // Same rule as the slot rollup above — kept identical on purpose.
      if (latestSub.status === 'approved' && isLive && hasPayout) return 'paid';
      if (latestSub.status === 'approved' && isLive) return 'live';
      if (latestSub.status === 'approved') return 'approved';
      if (latestSub.status === 'in_review' || latestSub.status === 'revisions') return 'submitted';
    }
    return 'confirmed';
  }
  if (offers.some((o) => offerIsLive(o.status))) return 'negotiating';
  if (apps.some((a) => applicationIsLive(a.status))) return 'pitched';

  // An ACCEPTED application with no accepted offer.
  //
  // Worth spelling out, because it is the one way signals can exist and still
  // reach the bottom of this function. Every status is classified live /
  // accepted / dead, so: all-dead exits above as `cancelled`, a live offer is
  // `negotiating`, a live application is `pitched`, and an accepted offer goes
  // down the post-acceptance path. That leaves `Application.status ===
  // 'accepted'` without a matching accepted offer — which A1's `v2AcceptPitch`
  // should never produce, since it writes both in one transaction.
  //
  // If it happens anyway, the pair pitched and was told yes; the offer and the
  // escrow are what is missing. `pitched` is the honest answer and leaves the
  // ball with the brand. It previously fell through to `invited`, which told
  // the creator a brand had reached out — and my first pass at this replaced
  // that with `cancelled`, which would have been worse: a deal the brand had
  // just accepted, reported dead.
  if (apps.some((a) => a.status === 'accepted')) return 'pitched';

  // Nothing has happened on this pair: no application, no offer. That is a
  // cold invite, whether or not the history records the message.
  //
  // `invited` is a STAGE and not a fallback — but note the real fix for the
  // fabricated-invitation bug was classifying `expired` as dead ABOVE, not
  // anything here. Reaching this line now means there genuinely are no
  // signals, which is what `invited` describes.
  return 'invited';
}

/** Find or create the Collaboration for `(campaignId, creatorId)`, recompute
 *  its stage, and append a history entry if the stage changed. Returns the
 *  (now-current) Collaboration. Expected to run inside a `tx(...)` block —
 *  mutates `db.collaborations` in place.
 *
 *  `actorUserId` records which user caused the transition (creator user
 *  for accept/withdraw, brand user for offer-send/approve, system for
 *  scheduled events). `reason` is an optional free-form annotation
 *  ('campaign-ended', 'dispute-raised', etc.). */
/** Canonical stage ordering for the pipeline, owned by the data layer that
 *  produces these stages. `V2_STAGE_META.order` in v2Adapters mirrors this for
 *  UI purposes; a test asserts the two agree so they cannot drift. */
export const COLLAB_STAGE_ORDER: CollabStage[] = [
  'invited', 'pitched', 'negotiating', 'confirmed',
  'submitted', 'approved', 'live', 'paid',
];

const stageRank = (s: CollabStage): number => {
  const i = COLLAB_STAGE_ORDER.indexOf(s);
  // 'cancelled' (and anything unlisted) ranks below every pipeline stage, so
  // merging never lets a terminal row mask real progress.
  return i === -1 ? -1 : i;
};

/** Merge two Collaboration rows that describe the SAME (campaign, creator).
 *
 *  Duplicates exist because `store.ts`'s overlay merges remote rows by `id`,
 *  while a collaboration is logically keyed by (campaignId, creatorId): the
 *  locally-materialized row (migrator 3, generated id) and the Supabase row
 *  (its own id) describe one pair under two ids, so the remote one was
 *  appended rather than merged.
 *
 *  That is actively harmful, not cosmetic: `ensureCollabState` below finds by
 *  pair and updates only the FIRST match, so the other row never advances and
 *  the two disagree about stage forever — observed live as one row at
 *  'confirmed' and its twin at 'submitted' for the same pair. Both then get
 *  mirrored to Postgres under separate ids.
 *
 *  Nothing is discarded: the furthest stage wins, histories are unioned and
 *  re-sorted, the earliest creation and latest update are kept, and a set
 *  value beats a null on every nullable field. Deleting a row outright would
 *  risk losing whichever history fragment only it carried.
 */
export function mergeCollabRows(a: Collaboration, b: Collaboration): Collaboration {
  const primary = stageRank(b.stage) > stageRank(a.stage) ? b : a;
  const other = primary === a ? b : a;

  const seen = new Set<string>();
  const history = [...(a.history ?? []), ...(b.history ?? [])]
    .filter((h) => {
      // Same transition recorded in both rows — keep one.
      const key = `${h.at}|${h.from ?? ''}|${h.to}|${h.actorUserId}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((x, y) => x.at - y.at);

  return {
    ...primary,
    // Prefer the primary's identity so whichever row the rest of the store
    // already references stays valid.
    createdAt: Math.min(a.createdAt, b.createdAt),
    updatedAt: Math.max(a.updatedAt, b.updatedAt),
    agreedRate: primary.agreedRate || other.agreedRate,
    acceptedOfferId: primary.acceptedOfferId ?? other.acceptedOfferId,
    contractId: primary.contractId ?? other.contractId,
    cancelledAt: primary.cancelledAt ?? other.cancelledAt,
    cancellationReason: primary.cancellationReason ?? other.cancellationReason,
    cancellationRequest: primary.cancellationRequest ?? other.cancellationRequest,
    // Set-beats-null, same as every other nullable here. A resurrected stale
    // proposal is harmless — the UI only offers it on a live, uncancelled
    // deal, and either party can decline. Silently dropping a live one is not.
    settlementProposal: primary.settlementProposal ?? other.settlementProposal,
    escrowFrozen: primary.escrowFrozen || other.escrowFrozen,
    history,
  };
}

/** Collapse every duplicate (campaignId, creatorId) pair down to one row.
 *  Order-stable: the first occurrence of a pair keeps its position. */
export function dedupeCollabRows(rows: Collaboration[]): Collaboration[] {
  const byPair = new Map<string, number>();
  const out: Collaboration[] = [];
  for (const row of rows) {
    const key = `${row.campaignId}|${row.creatorId}`;
    const at = byPair.get(key);
    if (at === undefined) {
      byPair.set(key, out.length);
      out.push(row);
    } else {
      out[at] = mergeCollabRows(out[at], row);
    }
  }
  return out;
}

export function ensureCollabState(
  campaignId: string,
  creatorId: string,
  db: Database,
  actorUserId: string,
  reason?: string,
): Collaboration | null {
  const camp = db.campaigns.find((c) => c.id === campaignId);
  if (!camp) return null;
  const newStage = computeCollabStage(campaignId, creatorId, db);
  const now = Date.now();

  let collab = db.collaborations.find(
    (c) => c.campaignId === campaignId && c.creatorId === creatorId,
  );
  if (!collab) {
    collab = {
      id: newCollabId(campaignId, creatorId),
      campaignId,
      creatorId,
      brandId: camp.brandId,
      stage: newStage,
      createdAt: now,
      updatedAt: now,
      agreedRate: null,
      acceptedOfferId: null,
      contractId: null,
      cancelledAt: newStage === 'cancelled' ? now : null,
      cancellationReason: newStage === 'cancelled' ? reason ?? null : null,
      history: [{
        at: now,
        from: null,
        to: newStage,
        actorUserId,
        reason,
      }],
    };
    db.collaborations.push(collab);
  } else if (collab.stage !== newStage) {
    const entry: CollabHistoryEntry = {
      at: now,
      from: collab.stage,
      to: newStage,
      actorUserId,
      reason,
    };
    collab.stage = newStage;
    collab.updatedAt = now;
    collab.history = [...collab.history, entry];
    if (newStage === 'cancelled' && !collab.cancelledAt) {
      collab.cancelledAt = now;
      collab.cancellationReason = reason ?? null;
    }
  } else {
    collab.updatedAt = now;
  }

  // Track the latest accepted offer + agreed rate.
  const acceptedOffer = db.offers
    .filter((o) => o.campaignId === campaignId && o.creatorId === creatorId && o.status === 'accepted')
    .sort((a, b) => +new Date(b.respondedAt ?? b.sentAt) - +new Date(a.respondedAt ?? a.sentAt))[0];
  if (acceptedOffer && (collab.agreedRate !== acceptedOffer.rate || collab.acceptedOfferId !== acceptedOffer.id)) {
    collab.agreedRate = acceptedOffer.rate;
    collab.acceptedOfferId = acceptedOffer.id;
  }

  // Backfill collaborationId on the underlying entities so later phases
  // (P2 Contract, P3 cancel) can reference Collaboration directly.
  for (const a of db.applications) {
    if (a.campaignId === campaignId && a.creatorId === creatorId) {
      (a as Application & { collaborationId?: string }).collaborationId = collab.id;
    }
  }
  for (const o of db.offers) {
    if (o.campaignId === campaignId && o.creatorId === creatorId) {
      (o as Offer & { collaborationId?: string }).collaborationId = collab.id;
    }
  }
  for (const s of db.submissions) {
    if (s.campaignId === campaignId && s.creatorId === creatorId) {
      (s as Submission & { collaborationId?: string }).collaborationId = collab.id;
    }
  }

  // Phase 5c — mirror the resulting collab to Supabase. Fire-and-forget
  // so the local tx() commits regardless of network conditions.
  // Wrapped in dynamic import to avoid pulling Supabase into hot paths
  // when env vars aren't set (the helper short-circuits anyway).
  //
  // Migration 020 (slice 8 follow-up): the repo now uses an explicit
  // update-with-version → insert-on-miss two-step instead of a blind
  // upsert. We pass the local row's `version` (read after the local tx
  // committed) as `expectedVersion`; on stale-version a StaleVersionError
  // surfaces a toast. Successful writes write the bumped version back
  // into the local store so subsequent mirrors stay in sync.
  if (typeof window !== 'undefined') {
    const collabSnapshot = collab; // captured for the closure
    const expectedVersion = collabSnapshot.version;
    void (async () => {
      try {
        const { isSupabaseConfigured } = await import('@/lib/supabase');
        if (!isSupabaseConfigured()) return;

        // F1 — only mirror rows the signed-in user actually owns.
        //
        // RLS lets a user write a collaboration only when they're the
        // brand side or the creator side of it. Every other row is
        // guaranteed to come back 403, so attempting them was pure noise:
        // a single sign-in fired ~32 doomed writes (30×403 + 2×409) that
        // filled the console with red and made real failures impossible
        // to spot. Deciding ownership here — rather than at each of the
        // ~15 call sites — keeps the guarantee in one place.
        //
        // `store` is imported dynamically (like the version write-back
        // below) because store.ts pulls in this module.
        const { useStore: store } = await import('@/lib/api/store');
        const { db: liveDb, session } = store.getState();
        const me = session ? liveDb.users.find((u) => u.id === session.userId) : undefined;
        const owns = !!me && (
          (!!me.creatorId && me.creatorId === collabSnapshot.creatorId) ||
          (!!me.brandId && me.brandId === collabSnapshot.brandId)
        );
        if (!owns) return;

        // Second gate: the row must also have a campaign Postgres knows
        // about. `collaborations.campaign_id` is an FK, and the generated
        // seed campaigns (`cmp_g*`) were never mirrored — so these writes
        // came back `23503 Key is not present in table "campaigns"`. The
        // ownership gate above cut ~32 doomed writes per sign-in to 2;
        // these were those 2. See lib/data/remoteRegistry.ts.
        const { mayMirrorForCampaign } = await import('@/lib/data/remoteRegistry');
        if (!mayMirrorForCampaign(collabSnapshot.campaignId)) return;

        const { writeCollabInSupabase } = await import('@/lib/data/collaborationsRepo');
        const updated = await writeCollabInSupabase(collabSnapshot, expectedVersion);
        // Write the bumped version back to local state so the next
        // mirror call sends the right expectedVersion. Bypass tx() —
        // this is a synthetic field bump, not a workflow event.
        if (typeof updated.version === 'number') {
          const { useStore } = await import('@/lib/api/store');
          useStore.setState((s) => {
            const idx = s.db.collaborations.findIndex((c) => c.id === collabSnapshot.id);
            if (idx === -1 || s.db.collaborations[idx].version === updated.version) return s;
            const next = s.db.collaborations.slice();
            next[idx] = { ...next[idx], version: updated.version };
            return { ...s, db: { ...s.db, collaborations: next } };
          });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        // Silence RLS rejections (not the row's owner) + FK violations
        // (campaign/creator not in Postgres yet for generated cmp_g* etc.)
        if (/row-level security|new row violates|foreign key|no rows|0 rows|not found/i.test(msg)) return;
        // Stale-version conflict — another tab/device updated this
        // collab while we were buffering. Toast + the next read pulls
        // canonical state.
        if (err instanceof Error && err.name === 'StaleVersionError') {
          const { pushToast } = await import('@/lib/utils/toast');
          pushToast(
            `Couldn't save collaboration — another tab updated it. Refresh to see the latest.`,
            'bad',
          );
          return;
        }
        // eslint-disable-next-line no-console
        console.warn('[collab mirror] failed:', msg);
      }
    })();
  }

  return collab;
}
