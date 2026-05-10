// Deal state machine (Phase 24).
//
// Each (campaign, creator) pair can be in one of N "deal states" — a
// derived value computed from the application/offer/submission/dispute
// records. This module owns the precedence rules so every consumer of
// the deal page gets the same answer for "what state am I in?".
//
// Precedence (highest first):
//   1. Disputed     — open dispute beats every other state
//   2. Closed       — campaign stage closed (paid out, archived)
//   3. Withdrawn    — creator pulled the application/counter
//   4. Declined     — either party declined the latest offer
//   5. Submission-driven (in_review / revisions / approved+posted/closed)
//   6. Production   — offer accepted, no submission yet
//   7. Offer-pending / countered — pre-acceptance negotiation
//   8. Shortlisted  — brand picked but no offer yet
//   9. Applied      — application submitted, no decision
//
// The state is a pure function of the inputs — no React, no store
// reads. That makes it easy to test, easy to reason about, and easy
// to consume from both the deal page (single deal) and Today's queue
// (rank N deals at once without coupling).
//
// IMPORTANT: this function does NOT enforce that the records are
// internally consistent (e.g., it doesn't check that the offer's
// creatorId matches the submission's). Callers prefilter to the
// pair they care about; we just classify the resulting state.

import type {
  Application,
  Campaign,
  Dispute,
  Offer,
  Submission,
} from '@/lib/api/types';

export type DealState =
  /** Application submitted, brand hasn't decided. */
  | 'applied'
  /** Brand shortlisted, no offer yet. */
  | 'shortlisted'
  /** Brand sent offer, creator hasn't responded. */
  | 'offer-pending'
  /** Creator countered, brand hasn't responded. */
  | 'offer-countered'
  /** Either party declined the latest offer. */
  | 'declined'
  /** Application withdrawn (creator pulled out before acceptance). */
  | 'withdrawn'
  /** Offer accepted, escrow placed, no submission uploaded yet. */
  | 'accepted-production'
  /** Latest submission status === 'in_review' — brand is reviewing. */
  | 'in-review'
  /** Brand sent revisions; creator needs to upload next round. */
  | 'revisions-requested'
  /** Latest submission approved; campaign hasn't moved to posted yet. */
  | 'approved'
  /** Campaign stage === 'posted' or 'reporting' — content is live. */
  | 'posted'
  /** Campaign stage === 'closed' — paid out, archived. */
  | 'closed'
  /** Open dispute on this campaign — escrow frozen. */
  | 'disputed';

export interface DealInputs {
  /** Campaign id is implied by `campaign.id`, but creatorId isn't carried
   *  by any of the other fields when application/offer/submissions are
   *  all empty (e.g. a pre-application invitation). Required for the
   *  pre-application shortlist fallback at the bottom of the classifier. */
  creatorId: string;
  campaign: Campaign;
  application?: Application;
  /** The LATEST offer for this creator — must be picked by caller. */
  offer?: Offer;
  /** All submissions for this creator on this campaign, any order. */
  submissions: Submission[];
  /** The OPEN dispute for this campaign, if any. */
  openDispute?: Dispute;
  /** P1a: caller-precomputed shortlisted flag (formerly read from
   *  `campaign.shortlist`, which was removed). Compute via
   *  `isCreatorShortlisted` from `@/lib/api/relations` and pass through. */
  shortlisted?: boolean;
}

/** Pure deal-state classifier. See module header for precedence. */
export function computeDealState(input: DealInputs): DealState {
  const { campaign, application, offer, submissions, openDispute } = input;

  // 1. Disputed always wins — money is frozen, action is for admin.
  if (openDispute) return 'disputed';

  // 2. Closed — terminal state regardless of substate (a closed campaign
  //    with no submission is still closed; the row just shows "no work").
  if (campaign.stage === 'closed') return 'closed';

  // 3. Latest submission carries the most recent signal — but only
  //    matters once an offer has been accepted. A "stray" submission
  //    without an accepted offer would be a data inconsistency.
  const latestSub = pickLatestSubmission(submissions);
  if (offer?.status === 'accepted' && latestSub) {
    if (latestSub.status === 'in_review') return 'in-review';
    if (latestSub.status === 'revisions') return 'revisions-requested';
    if (latestSub.status === 'approved') {
      // P1b §1.2: campaign-stage no longer encodes 'posted' vs 'reporting'.
      // The "is the post live publicly?" signal is now `submission.permalink`
      // being set (creator pasted the URL) — see P3 §2.2 for the cleaner
      // version. Until P3 lands, fall back to checking permalink presence.
      if (latestSub.permalink) return 'posted';
      return 'approved';
    }
  }

  // 4. Offer accepted but no submission yet → in-flight production.
  if (offer?.status === 'accepted') return 'accepted-production';

  // 5. Offer pre-acceptance negotiation states.
  if (offer?.status === 'pending')   return 'offer-pending';
  if (offer?.status === 'countered') return 'offer-countered';
  if (offer?.status === 'declined')  return 'declined';
  if (offer?.status === 'withdrawn') return 'withdrawn';
  // P3 §2.1 — `expired` is the post-counter-cap terminal state. Treat
  // the same as `declined` from the deal-state perspective: the deal
  // is over, no money moved, application returned to `submitted`.
  if (offer?.status === 'expired')   return 'declined';

  // 6. No offer yet — the application carries the state.
  if (application?.status === 'shortlisted') return 'shortlisted';
  if (application?.status === 'submitted')   return 'applied';
  if (application?.status === 'rejected')    return 'declined';
  if (application?.status === 'withdrawn')   return 'withdrawn';

  // 7. Fallback: brand shortlisted the creator but no application exists
  //    yet (rare — pre-application invitation flow).
  // P1a: caller pre-computes via `isCreatorShortlisted` and passes through.
  if (input.shortlisted) return 'shortlisted';

  // No application, no offer, no submission, no dispute — the deal hasn't
  // really started. Default to 'applied' as the friendliest empty state;
  // callers should rarely hit this branch in practice.
  return 'applied';
}

/** Pick the latest submission by submittedAt (newest first).
 *  Returns undefined if the array is empty. */
export function pickLatestSubmission(subs: Submission[]): Submission | undefined {
  if (subs.length === 0) return undefined;
  return [...subs].sort((a, b) => +new Date(b.submittedAt) - +new Date(a.submittedAt))[0];
}

/** Convenience predicate: does this state mean money is in flight? */
export function dealStateHasEscrow(state: DealState): boolean {
  return state === 'accepted-production'
    || state === 'in-review'
    || state === 'revisions-requested'
    || state === 'approved'
    || state === 'posted'
    || state === 'disputed';
}

/** Convenience predicate: is the deal terminal (no further user action)? */
export function dealStateIsTerminal(state: DealState): boolean {
  return state === 'closed' || state === 'declined' || state === 'withdrawn';
}
