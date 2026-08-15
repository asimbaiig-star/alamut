// staleness.ts — what the passage of time means.
//
// THE GAP THIS CLOSES
//
// Every state in this product was entered by someone doing something. There
// was no path out of a state by time passing. The scheduler existed and fired
// at all the right moments — `deadline-24h`, `deadline-overdue`,
// `escrow-stale-30d`, `review-window-closing` — but every one of them only
// NOTIFIED. Nothing ever changed, so nothing ever resolved:
//
//   - an offer could be accepted six months later at a price and brief that
//     no longer meant anything;
//   - a creator could pitch into silence forever;
//   - a brand could sit on delivered work indefinitely with the creator's
//     money frozen in escrow;
//   - a cancellation request the other side ignored froze the deal for good.
//
// THE STANCE (Asim's calls, deliberately conservative)
//
// This is a beta with SIMULATED payments, and the decisions that move money
// were made accordingly:
//
//   - Unreviewed work does NOT auto-approve. Escrow never moves without a
//     human. The product escalates and marks the deal overdue on both sides,
//     and that is all. (Rejected: auto-release after 14 days. It resolves the
//     deadlock but pays a creator because a brand was slow, which is a stance
//     to take once payments are real, not before.)
//   - Offers do NOT hard-expire. A stale offer is LABELLED as stale and stays
//     acceptable. No deal is ever lost to a clock.
//   - The only automatic state change in the whole module is lapsing a dead
//     application, because an unanswered pitch costs nobody anything and
//     leaving it open costs the creator hope.
//
// Everything here is pure and side-effect free: callers decide what to do
// with the answer. Thresholds live here so the banner, the kanban card, the
// scheduler and the tests cannot disagree about what "stale" means — which is
// exactly how the fee constants drifted before `money.ts` existed.

const DAY_MS = 86_400_000;

/** Every age threshold in the product, in days. One table, on purpose. */
export const STALENESS = {
  /** An offer this old is labelled "may no longer be current". Still
   *  acceptable — labelling is the whole intervention. */
  offerStaleDays: 7,
  /** Second, firmer label. */
  offerVeryStaleDays: 21,
  /** A pitch with no brand response is auto-withdrawn at this age. The ONLY
   *  automatic state change in this module. */
  applicationLapseDays: 21,
  /** The creator is warned the lapse is coming this many days before it. */
  applicationLapseWarningDays: 3,
  /** Delivered work unreviewed this long is flagged overdue to BOTH sides.
   *  Nothing moves; the flag is the intervention. */
  reviewOverdueDays: 7,
  /** Escalated flag — same mechanism, stronger copy. */
  reviewSeverelyOverdueDays: 14,
  /** A cancellation request unanswered this long is surfaced as chasing.
   *  A human still has to act; escrow is involved. */
  cancellationChaseDays: 7,
} as const;

export type StaleLevel = 'fresh' | 'stale' | 'very-stale';

function daysBetween(fromIso: string | number, now: number): number {
  const t = typeof fromIso === 'number' ? fromIso : +new Date(fromIso);
  if (!Number.isFinite(t)) return 0;
  return Math.max(0, Math.floor((now - t) / DAY_MS));
}

/** Whole days since `at`. Exported because several surfaces want to say
 *  "waiting N days" and should not each re-derive it. */
export function ageInDays(at: string | number, now: number = Date.now()): number {
  return daysBetween(at, now);
}

/**
 * How stale a pending offer is.
 *
 * Never blocks acceptance — `staleLevel` drives copy, not permission. A
 * creator who has been offline for three weeks should come back to a warning,
 * not to a dead offer.
 */
export function offerStaleness(sentAt: string, now: number = Date.now()): {
  level: StaleLevel;
  days: number;
  note: string | null;
} {
  const days = daysBetween(sentAt, now);
  if (days >= STALENESS.offerVeryStaleDays) {
    return {
      level: 'very-stale',
      days,
      note: `Sent ${days} days ago — the brief or budget may have moved on. Worth confirming before you accept.`,
    };
  }
  if (days >= STALENESS.offerStaleDays) {
    return {
      level: 'stale',
      days,
      note: `Sent ${days} days ago — check it still stands.`,
    };
  }
  return { level: 'fresh', days, note: null };
}

/**
 * Whether a pitch has gone unanswered long enough to lapse, and how the
 * creator should be told before it does.
 *
 * `shouldLapse` is the one thing in this module that authorises a state
 * change. It is deliberately narrow: only applications still in `submitted`
 * (a shortlisted or accepted pitch is a live conversation, not silence).
 */
export function applicationLapse(
  app: { status: string; submittedAt: string },
  now: number = Date.now(),
): { shouldLapse: boolean; warn: boolean; days: number; daysLeft: number } {
  const days = daysBetween(app.submittedAt, now);
  const daysLeft = Math.max(0, STALENESS.applicationLapseDays - days);
  // Only genuine silence lapses. Shortlisted means the brand engaged.
  const eligible = app.status === 'submitted';
  return {
    shouldLapse: eligible && days >= STALENESS.applicationLapseDays,
    warn: eligible && daysLeft > 0 && daysLeft <= STALENESS.applicationLapseWarningDays,
    days,
    daysLeft,
  };
}

/**
 * Delivered work waiting on a brand.
 *
 * Returns a flag and copy for BOTH sides — the creator needs to know their
 * money is stuck and that it isn't their fault, and the brand needs to know
 * they are the blocker. Escrow does not move: see the stance above.
 */
export function reviewOverdue(submittedAt: string, now: number = Date.now()): {
  level: 'ok' | 'overdue' | 'severe';
  days: number;
  brandNote: string | null;
  creatorNote: string | null;
} {
  const days = daysBetween(submittedAt, now);
  if (days >= STALENESS.reviewSeverelyOverdueDays) {
    return {
      level: 'severe',
      days,
      brandNote: `Unreviewed for ${days} days — the creator's payout is held until you approve or request changes.`,
      creatorNote: `Waiting ${days} days on review. Your payout is held in escrow until the brand responds — chase them, or raise a dispute if it stays stuck.`,
    };
  }
  if (days >= STALENESS.reviewOverdueDays) {
    return {
      level: 'overdue',
      days,
      brandNote: `Waiting ${days} days on your review.`,
      creatorNote: `Submitted ${days} days ago — the brand hasn't reviewed it yet.`,
    };
  }
  return { level: 'ok', days, brandNote: null, creatorNote: null };
}

/**
 * A cancellation request the other party hasn't answered.
 *
 * Surfaces only. Cancelling returns escrow, so a human agrees to it — that
 * was an explicit product call, not an oversight.
 */
export function cancellationChase(requestedAt: number, now: number = Date.now()): {
  chasing: boolean;
  days: number;
  note: string | null;
} {
  const days = daysBetween(requestedAt, now);
  if (days >= STALENESS.cancellationChaseDays) {
    return {
      chasing: true,
      days,
      note: `Cancellation requested ${days} days ago with no reply. Escrow stays held until both sides agree — message them, or raise a dispute.`,
    };
  }
  return { chasing: false, days, note: null };
}
