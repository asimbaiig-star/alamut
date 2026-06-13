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
  return s.status === 'approved' && (
    !!s.permalink || (s.feedback ?? []).some((f) => f.text.startsWith('LIVE: '))
  );
}

/** Resolve the Deliverable a submission belongs to. Same rule as the
 *  v2 adapter (`deliverableForSubmission`): direct FK first, then the
 *  legacy `[slot:N]` notes prefix, then slot 0. Shared here so the
 *  stored-stage computation and the UI projection group submissions
 *  identically. */
function deliverableIdForSubmission(s: Submission, db: Database): string | undefined {
  if (s.deliverableId && db.deliverables.some((d) => d.id === s.deliverableId)) {
    return s.deliverableId;
  }
  const m = s.notes?.match(/^\[slot:(\d+)\]/);
  const slotIdx = m ? parseInt(m[1], 10) : 0;
  return db.deliverables.find(
    (d) => d.campaignId === s.campaignId && d.index === slotIdx,
  )?.id;
}

export type SlotStatus = 'pending' | 'in_review' | 'revision' | 'approved' | 'live';

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
export function computeSlotStatuses(
  campaignId: string,
  creatorId: string,
  db: Database,
): CollabSlot[] {
  const campDeliverables = db.deliverables
    .filter((d) => d.campaignId === campaignId)
    .sort((a, b) => a.index - b.index);
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
  const allDeclined =
    apps.every((a) => a.status === 'rejected' || a.status === 'withdrawn') &&
    offers.every((o) => o.status === 'declined' || o.status === 'withdrawn');
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
      const allApproved = statuses.every((s) => s === 'approved' || s === 'live');
      const allLive = statuses.every((s) => s === 'live');
      const anyLive = statuses.some((s) => s === 'live');
      if (anyInReviewOrRevision) return 'submitted';
      if (allApproved) {
        const campIsClosed = db.campaigns.find((c) => c.id === campaignId)?.stage === 'closed';
        if (anyLive && hasPayout && campIsClosed) return 'paid';
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
      const campIsClosed = db.campaigns.find((c) => c.id === campaignId)?.stage === 'closed';
      if (latestSub.status === 'approved' && isLive && hasPayout && campIsClosed) return 'paid';
      if (latestSub.status === 'approved' && isLive) return 'live';
      if (latestSub.status === 'approved') return 'approved';
      if (latestSub.status === 'in_review' || latestSub.status === 'revisions') return 'submitted';
    }
    return 'confirmed';
  }
  if (offers.some((o) => o.status === 'pending' || o.status === 'countered')) return 'negotiating';
  if (apps.some((a) => a.status === 'submitted' || a.status === 'shortlisted')) return 'pitched';
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
