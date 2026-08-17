// collabLifecycle.ts — the CRM backbone, written down.
//
// WHY THIS FILE EXISTS
//
// A collaboration's stage was knowable only by reading `computeCollabStage`
// and inferring the rules from its control flow. That worked until it didn't,
// and the way it failed is instructive:
//
//   `allDeclined` classified an offer as dead when its status was `declined`
//   or `withdrawn`. `OfferStatus` also has `expired`. So a pair whose pitch
//   had lapsed and whose offer had expired matched no branch at all and fell
//   through to the final `return 'invited'` — and `invited` is a REAL stage,
//   with its own banner telling the creator a brand had reached out and "a
//   proper offer will follow". A missing entry in an implicit set became a
//   fabricated invitation.
//
// Two lessons are encoded here as structure rather than as care:
//
//   1. Every status union is classified EXHAUSTIVELY, through
//      `Record<Union, …>`. Adding `expired` to `OfferStatus` today would be
//      a compile error until it is classified, which is the only kind of
//      reminder that works.
//
//   2. `invited` stops being the fallback. A fallback stage is a value that
//      means "I could not tell", and this codebase has already learned once
//      (regressionGuards CLASS 1) that a value meaning "unknown" must never
//      be treated as fact. `invited` now requires evidence of an invitation;
//      a pair with only dead signals is `cancelled`, which is what it is.
//
// WHAT LIVES HERE, AND WHAT DELIBERATELY DOES NOT
//
//   here  · how a status is classified (live / accepted / dead)
//         · the stage order, and which stages may legally precede which
//         · the FACTS a stage asserts, so a stage can be checked rather
//           than trusted (`explainStage`)
//
//   not here · the derivation itself — `computeCollabStage` in collabSync.ts
//              stays the single implementation, and now reads these tables
//   not here · whose move it is — `screens/workspace-v2/nextAction.ts` owns
//              ball-in-court, and duplicating it here is exactly the
//              two-sources-of-truth mistake this project spent six phases
//              undoing

import type {
  ApplicationStatus, CollabStage, Database, OfferStatus, SubmissionStatus,
} from './types';

// =====================================================================
// 1. Status classification — exhaustive by construction
// =====================================================================

/** What an offer's status means for the deal. */
export type SignalState = 'live' | 'accepted' | 'dead';

/**
 * `live`     — in play; someone owes a response.
 * `accepted` — the deal is on; escrow follows.
 * `dead`     — over, by any route. Declining, withdrawing and expiring are
 *              different stories with the same consequence, and treating
 *              them differently is what produced the `invited` bug.
 */
export const OFFER_STATE: Record<OfferStatus, SignalState> = {
  pending: 'live',
  countered: 'live',
  accepted: 'accepted',
  declined: 'dead',
  withdrawn: 'dead',
  expired: 'dead',
};

export const APPLICATION_STATE: Record<ApplicationStatus, SignalState> = {
  submitted: 'live',
  shortlisted: 'live',
  accepted: 'accepted',
  rejected: 'dead',
  withdrawn: 'dead',
};

/** A slot's submission status, for the post-acceptance rollup. `rejected` is
 *  SETTLED, not live: the brand said no and stopped asking, so it must not
 *  hold the collaboration at `confirmed` waiting for work nobody will send.
 *  The money for it stays held until the parties settle (WORKFLOW-GAPS F1). */
export const SUBMISSION_STATE: Record<SubmissionStatus, 'open' | 'settled'> = {
  in_review: 'open',
  revisions: 'open',
  approved: 'settled',
  rejected: 'settled',
};

export const offerIsDead = (s: OfferStatus) => OFFER_STATE[s] === 'dead';
export const offerIsLive = (s: OfferStatus) => OFFER_STATE[s] === 'live';
export const applicationIsDead = (s: ApplicationStatus) => APPLICATION_STATE[s] === 'dead';
export const applicationIsLive = (s: ApplicationStatus) => APPLICATION_STATE[s] === 'live';

// =====================================================================
// 2. Order, and what may legally precede what
// =====================================================================

/** Position in the funnel. `cancelled` is terminal and sits outside the
 *  ordering — it is reachable from anywhere and leads nowhere. */
export const STAGE_ORDER: Record<CollabStage, number> = {
  invited: 0,
  pitched: 1,
  negotiating: 2,
  confirmed: 3,
  submitted: 4,
  approved: 5,
  live: 6,
  paid: 7,
  cancelled: -1,
};

/**
 * Stages a deal may move BACKWARDS into, and from where.
 *
 * Forward moves need no table — see `isLegalTransition`. Only reversals are
 * enumerated, because each one is a deliberate product decision rather than a
 * consequence of the funnel.
 */
export const LEGAL_REVERSALS: Partial<Record<CollabStage, readonly CollabStage[]>> = {
  // WORKFLOW-GAPS E3 — an agreed scope amendment reopens a finished deal:
  // there is new work owed, so the deal is `confirmed` again.
  confirmed: ['approved', 'live', 'paid'],
};

/**
 * Is `to` a legal stage to move into from `from`?
 *
 * FORWARD SKIPS ARE LEGAL, and getting that wrong was my own first mistake
 * here. `ensureCollabState` recomputes the stage and stores the RESULT, so a
 * single mutation can satisfy several conditions at once: approving the last
 * slot on a deal whose content is already live, on a closed campaign, moves a
 * pair from `submitted` straight to `paid`. History records recompute
 * outcomes, not individual steps, and the seed is full of legitimate
 * `submitted → paid` entries.
 *
 * So this function polices the two things that ARE errors:
 *
 *   - going backwards, except where the product deliberately does
 *     (`LEGAL_REVERSALS`);
 *   - resuming a cancelled deal, or cancelling a paid one.
 *
 * "Live before confirmed" is caught by `STAGE_REQUIREMENTS` instead, which is
 * the stronger check: it asks whether the FACTS support the stage, rather than
 * whether the path looked plausible.
 */
export function isLegalTransition(from: CollabStage, to: CollabStage): boolean {
  if (from === to) return true;
  // A cancelled deal is over. Nothing resumes it; a fresh pitch or invite
  // starts a new one.
  if (from === 'cancelled') return false;
  // Cancelling is available from any live stage — but not after payout, which
  // would mean clawing money back out of a creator's wallet.
  if (to === 'cancelled') return from !== 'paid';
  // Forward, including skips.
  if (STAGE_ORDER[to] > STAGE_ORDER[from]) return true;
  // Backwards, only where declared.
  return (LEGAL_REVERSALS[to] ?? []).includes(from);
}

// =====================================================================
// 3. The facts a stage asserts
// =====================================================================

/**
 * Everything the derivation looks at, gathered once and named.
 *
 * The point is that a stage becomes CHECKABLE: `explainStage` can say not
 * just which stage a pair is in but which facts put it there, and which
 * facts contradict it. A stage nobody can check is a stage that drifts.
 */
export interface StageFacts {
  /** A `brand-invite` entry on the collaboration's history. */
  hasInvite: boolean;
  hasLiveApplication: boolean;
  hasLiveOffer: boolean;
  hasAcceptedOffer: boolean;
  /** Any application or offer at all, in any state. */
  hasAnySignal: boolean;
  /** Every application AND every offer is dead. */
  allSignalsDead: boolean;
  slotCount: number;
  anySlotOpen: boolean;
  allSlotsSettled: boolean;
  allSlotsLive: boolean;
  anySlotLive: boolean;
  payoutCleared: boolean;
  campaignClosed: boolean;
  escrowFrozen: boolean;
  cancelledAt: number | null;
}

/** Gather the facts. Pure; no derivation, no opinions. */
export function stageFacts(
  campaignId: string,
  creatorId: string,
  db: Database,
  slots: { status: string }[],
): StageFacts {
  const apps = db.applications.filter((a) => a.campaignId === campaignId && a.creatorId === creatorId);
  const offers = db.offers.filter((o) => o.campaignId === campaignId && o.creatorId === creatorId);
  const row = db.collaborations.find((c) => c.campaignId === campaignId && c.creatorId === creatorId);
  const creator = db.creators.find((c) => c.id === creatorId);

  const statuses = slots.map((s) => s.status);

  return {
    hasInvite: (row?.history ?? []).some(
      (h) => typeof h.reason === 'string' && h.reason.startsWith('brand-invite'),
    ),
    hasLiveApplication: apps.some((a) => applicationIsLive(a.status)),
    hasLiveOffer: offers.some((o) => offerIsLive(o.status)),
    hasAcceptedOffer: offers.some((o) => o.status === 'accepted'),
    hasAnySignal: apps.length > 0 || offers.length > 0,
    allSignalsDead:
      (apps.length > 0 || offers.length > 0)
      && apps.every((a) => applicationIsDead(a.status))
      && offers.every((o) => offerIsDead(o.status)),
    slotCount: slots.length,
    anySlotOpen: statuses.some((s) => s === 'in_review' || s === 'revision'),
    allSlotsSettled: statuses.length > 0
      && statuses.every((s) => s === 'approved' || s === 'live' || s === 'rejected'),
    allSlotsLive: statuses.length > 0 && statuses.every((s) => s === 'live'),
    anySlotLive: statuses.some((s) => s === 'live'),
    payoutCleared: !!creator && db.transactions.some(
      (t) => (t.kind === 'escrow_release' || t.kind === 'payout')
        && t.campaignId === campaignId
        && (t.userId === creator.userId || t.counterpartyUserId === creator.userId)
        && t.status === 'cleared',
    ),
    campaignClosed: db.campaigns.find((c) => c.id === campaignId)?.stage === 'closed',
    escrowFrozen: !!row?.escrowFrozen,
    cancelledAt: row?.cancelledAt ?? null,
  };
}

/**
 * What each stage CLAIMS. Returns the claims that do not hold.
 *
 * `Record<CollabStage, …>` so a tenth stage cannot be added without deciding
 * what it asserts — the same completeness guard that has caught a missing
 * case here three times.
 */
export const STAGE_REQUIREMENTS: Record<
  CollabStage,
  (f: StageFacts) => string[]
> = {
  invited: (f) => {
    const bad: string[] = [];
    // The fix at the heart of this file: `invited` means invited.
    if (!f.hasInvite && f.hasAnySignal) {
      bad.push('stage is `invited` but there is no invitation on the history — it was reached by elimination');
    }
    if (f.hasAcceptedOffer) bad.push('`invited` with an accepted offer');
    return bad;
  },
  pitched: (f) => {
    const bad: string[] = [];
    if (!f.hasLiveApplication) bad.push('`pitched` without a live application');
    if (f.hasAcceptedOffer) bad.push('`pitched` with an accepted offer');
    return bad;
  },
  negotiating: (f) => {
    const bad: string[] = [];
    if (!f.hasLiveOffer) bad.push('`negotiating` without a pending or countered offer');
    if (f.hasAcceptedOffer) bad.push('`negotiating` with an accepted offer');
    return bad;
  },
  confirmed: (f) => {
    const bad: string[] = [];
    // The rule the user named: nothing past acceptance without an acceptance.
    if (!f.hasAcceptedOffer) bad.push('`confirmed` without an accepted offer');
    if (f.anySlotOpen) bad.push('`confirmed` while a slot is in review');
    return bad;
  },
  submitted: (f) => {
    const bad: string[] = [];
    if (!f.hasAcceptedOffer) bad.push('`submitted` without an accepted offer');
    if (!f.anySlotOpen) bad.push('`submitted` with no slot in review or revision');
    return bad;
  },
  approved: (f) => {
    const bad: string[] = [];
    if (!f.hasAcceptedOffer) bad.push('`approved` without an accepted offer');
    if (!f.allSlotsSettled) bad.push('`approved` with an unsettled slot');
    if (f.allSlotsLive) bad.push('`approved` when every slot is already live — that is `live`');
    return bad;
  },
  live: (f) => {
    const bad: string[] = [];
    if (!f.hasAcceptedOffer) bad.push('`live` without an accepted offer');
    if (!f.allSlotsLive) bad.push('`live` without every slot live');
    return bad;
  },
  paid: (f) => {
    const bad: string[] = [];
    if (!f.hasAcceptedOffer) bad.push('`paid` without an accepted offer');
    if (!f.payoutCleared) bad.push('`paid` without a cleared payout');
    if (!f.anySlotLive) bad.push('`paid` without any slot live');
    if (!f.campaignClosed) bad.push('`paid` while the campaign is still open');
    return bad;
  },
  cancelled: (f) => {
    const bad: string[] = [];
    // Either the signals are all dead, or a human closed it explicitly.
    if (!f.allSignalsDead && !f.cancelledAt) {
      bad.push('`cancelled` with a live signal and no cancellation on the row');
    }
    return bad;
  },
};

/**
 * The stage, the facts behind it, and anything it claims that is not true.
 *
 * Used by the lifecycle tests and available for a dev-time assertion. A
 * non-empty `violations` means the derivation and the data disagree — which
 * is precisely the class of bug that put "Aesop invited you" on a deal whose
 * offer had expired.
 */
export function explainStage(
  stage: CollabStage,
  facts: StageFacts,
): { stage: CollabStage; facts: StageFacts; violations: string[] } {
  return { stage, facts, violations: STAGE_REQUIREMENTS[stage](facts) };
}
