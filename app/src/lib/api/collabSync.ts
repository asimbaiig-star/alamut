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
} from './types';

function newCollabId(campaignId: string, creatorId: string): string {
  const idHash = (campaignId + ':' + creatorId)
    .split('')
    .reduce((h, c) => ((h * 31 + c.charCodeAt(0)) >>> 0), 0)
    .toString(36);
  return `col_${idHash}`;
}

/** Same logic as pre-P1c `deriveCollab` — but consumes the typed Database
 *  directly so it can be called from any tx context. Mirrors the copy
 *  inside migrator 3 (`_legacyComputeCollabStage`). The two stay in
 *  lockstep — when the rules change, both update. */
export function computeCollabStage(
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
  const allDeclined =
    apps.every((a) => a.status === 'rejected' || a.status === 'withdrawn') &&
    offers.every((o) => o.status === 'declined' || o.status === 'withdrawn');
  if ((apps.length > 0 || offers.length > 0)
    && allDeclined && !acceptedOffer && subs.length === 0) return 'cancelled';

  if (acceptedOffer) {
    // BUG FIX (workflow audit): pre-fix this short-circuited to 'paid'
    // the moment the escrow release cleared on approve — which made
    // the kanban skip past 'approved' AND past 'live'. Correct flow:
    //
    //   confirmed → submitted (in_review)
    //             → approved (brand approved, payout cleared, but
    //                          content is NOT yet posted on platform)
    //             → live      (creator marked the post live with a
    //                          permalink — submission.status='live'
    //                          OR a 'LIVE:' feedback entry)
    //             → paid      (terminal — only when the campaign is
    //                          closed AND the payout has cleared)
    //
    // The payout signal alone is no longer sufficient to flip past
    // 'approved' — the post-publication signal (live + permalink)
    // and campaign close are both required.
    if (latestSub) {
      const isLive = !!latestSub.permalink ||
        latestSub.feedback?.some((f) => f.text.startsWith('LIVE: '));
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

  return collab;
}
