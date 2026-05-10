// Deal-action computation (Phase 24).
//
// For each (DealState × role) we compute:
//   - actor:    who is BLOCKED (the side whose action moves things forward)
//   - kind:     a stable enum the UI uses to pick the right CTA component
//   - verb:     human label for the primary CTA (e.g. "Approve $1,500")
//   - urgency:  ranking score for Today's flat queue (0..1000+)
//   - reason:   short why-now string ("uploaded 4h ago", "expires in 4h")
//
// The action separates KIND (a stable identifier the deal page uses to
// route to the right modal/handler) from VERB (the user-facing label,
// which depends on $ amounts and may be persona-specific copy). That
// split is important: kind drives wiring, verb drives UI.
//
// Urgency scoring is a simple formula:
//   * Disputed                 → 1000 (always top)
//   * Hard-deadline approaching → 500-900 based on hours-to-deadline
//   * Self-blocked > 24h        → 300-500 based on days-blocked
//   * Self-blocked recent       → 100-300
//   * Other-blocked (passive)   → 0-50 (passive items)
//   * Terminal                  → 0 (sorted to the bottom)
//
// The actual numbers are tuned for "feels right when ranked together",
// not for any precise SLA. Today's queue caller can override if needed.

import type { DealState } from './deal-state';
import type { Campaign, Offer, Submission } from '@/lib/api/types';
import { fmtMoneyFull } from './format';

export type Role = 'creator' | 'brand' | 'admin';

/** Stable enum of action kinds the deal-page UI dispatches on. */
export type DealActionKind =
  // Offer states
  | 'accept-offer'
  | 'counter-offer'
  | 'decline-offer'
  | 'withdraw-counter'
  | 'send-reminder'
  // Production
  | 'upload-draft'
  | 'wait-for-upload'
  // Review
  | 'approve-submission'
  | 'request-revisions'
  | 'wait-for-review'
  // Post-flow
  | 'review-counterparty'
  | 'view-performance'
  // Disputed
  | 'resolve-dispute'         // admin only
  | 'add-evidence'
  | 'wait-for-resolution'
  // Application
  | 'shortlist-applicant'     // brand · move applicant from "applied" → "shortlisted"
  | 'decline-applicant'       // brand
  | 'send-offer'              // brand · send first offer to a shortlisted creator (Phase 24 QA: was overloading shortlist-applicant)
  | 'withdraw-application'    // creator
  // Terminal — nothing to do
  | 'none';

export interface DealAction {
  /** Who is blocked (whose action moves the state forward). */
  actor: 'me' | 'them' | 'neither';
  /** Stable kind for UI dispatch. */
  kind: DealActionKind;
  /** Optional secondary kinds (e.g., counter / decline alongside accept). */
  secondary?: DealActionKind[];
  /** Human-readable primary CTA label, with money baked in where useful. */
  verb?: string;
  /** Short why-now string for ranking display ("expires in 4h"). */
  reason?: string;
  /** 0..1000+; higher = more urgent. */
  urgency: number;
}

interface ActionInputs {
  state: DealState;
  role: Role;
  campaign: Campaign;
  /** The LATEST offer for this creator (any status). Drives offer-state
   *  branches — pending / countered / declined / withdrawn. */
  offer?: Offer;
  /** Phase 24 QA: separate from `offer`. The LATEST ACCEPTED offer drives
   *  money math (release amount in `in-review`) — `offer` could be a
   *  pending re-offer with a different rate. */
  acceptedOffer?: Offer;
  /** The LATEST submission. */
  latestSubmission?: Submission;
  /** Reference "now" — defaults to system clock; tests can pin it. */
  now?: Date;
}

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/** Default offer expiry — 7 days from sentAt. Real backend would store
 *  this on the offer; we infer for the demo. */
const OFFER_EXPIRY_DAYS = 7;

export function computeDealAction(input: ActionInputs): DealAction {
  const { state, role, campaign, offer, acceptedOffer, latestSubmission } = input;
  const now = input.now ?? new Date();

  switch (state) {
    // ============================================================
    // DISPUTED — admin resolves; both parties can/should add evidence
    // ============================================================
    case 'disputed': {
      if (role === 'admin') {
        return {
          actor: 'me',
          kind: 'resolve-dispute',
          verb: 'Resolve dispute',
          urgency: 1000,
          reason: 'Escrow frozen pending review',
        };
      }
      // Phase 24 QA fix: actor is 'me' for non-admin disputes so the deal
      // surfaces in Today's actionable queue (rankDeals filters by actor).
      // The work — adding evidence, monitoring resolution — is real even if
      // the final decision is admin's.
      return {
        actor: 'me',
        kind: 'add-evidence',
        verb: 'Add evidence',
        urgency: 700,    // below hard-deadline offers, above most queues
        reason: 'Escrow frozen — admin reviewing',
      };
    }

    // ============================================================
    // OFFER NEGOTIATION
    // ============================================================
    case 'offer-pending': {
      if (role === 'creator') {
        const hoursLeft = offer ? hoursUntilOfferExpiry(offer, now) : 24;
        return {
          actor: 'me',
          kind: 'accept-offer',
          secondary: ['counter-offer', 'decline-offer'],
          verb: offer ? `Accept ${fmtMoneyFull(offer.rate)}` : 'Respond to offer',
          urgency: urgencyFromHours(hoursLeft, /*selfBlocked*/ true),
          reason: hoursLeft < 24
            ? `Expires in ${Math.max(1, Math.round(hoursLeft))}h`
            : `Expires in ${Math.round(hoursLeft / 24)}d`,
        };
      }
      // Brand sent offer; brand is "waiting on them"
      return {
        actor: 'them',
        kind: 'send-reminder',
        verb: 'Send a reminder',
        urgency: 30,
        reason: offer ? `Sent ${ageDescription(new Date(offer.sentAt), now)} ago` : 'Awaiting reply',
      };
    }

    case 'offer-countered': {
      // P3 §2.1 — read from rounds[]. The latest round is the
      // counter the brand needs to respond to.
      const lastRound = offer?.rounds?.[offer.rounds.length - 1];
      if (role === 'brand') {
        const counterRate = lastRound?.rate;
        return {
          actor: 'me',
          kind: 'accept-offer',
          secondary: ['counter-offer', 'decline-offer'],
          verb: counterRate ? `Accept ${fmtMoneyFull(counterRate)}` : 'Review counter',
          urgency: 400,
          reason: lastRound ? `Countered ${ageDescription(new Date(lastRound.at), now)} ago` : 'Counter received',
        };
      }
      // Creator countered; creator is waiting
      return {
        actor: 'them',
        kind: 'withdraw-counter',
        verb: 'Withdraw counter',
        urgency: 20,
        reason: 'Awaiting brand response',
      };
    }

    // ============================================================
    // PRODUCTION
    // ============================================================
    case 'accepted-production': {
      const daysToDeadline = daysUntilDeadline(campaign, now);
      if (role === 'creator') {
        return {
          actor: 'me',
          kind: 'upload-draft',
          verb: 'Upload Round 1',
          urgency: urgencyFromHours(daysToDeadline * 24, /*selfBlocked*/ true),
          reason: deadlineReason(daysToDeadline),
        };
      }
      // Phase 24 QA fix: brand also gets urgency when deadline elapses —
      // creator going silent past deadline is a real problem the brand
      // should see in their queue (nudge / consider dispute).
      const overdue = daysToDeadline < 0;
      return {
        actor: overdue ? 'me' : 'them',
        kind: overdue ? 'send-reminder' : 'wait-for-upload',
        verb: overdue ? 'Send a nudge' : 'Send a message',
        urgency: overdue ? 450 : 10,
        reason: overdue ? `${Math.abs(Math.round(daysToDeadline))}d past deadline` : 'Creator is working',
      };
    }

    // ============================================================
    // REVIEW
    // ============================================================
    case 'in-review': {
      if (role === 'brand') {
        const sub = latestSubmission;
        const hoursOld = sub ? (+now - +new Date(sub.submittedAt)) / HOUR_MS : 0;
        // Phase 24 QA fix: use the LATEST ACCEPTED offer for the release
        // amount, not the latest offer — a pending re-offer could exist
        // alongside the original accepted offer with a different rate.
        const releaseAmount = acceptedOffer?.rate;
        return {
          actor: 'me',
          kind: 'approve-submission',
          secondary: ['request-revisions'],
          verb: releaseAmount ? `Approve ${fmtMoneyFull(releaseAmount)}` : 'Approve',
          urgency: urgencyFromAge(hoursOld, /*selfBlocked*/ true),
          reason: sub ? `Uploaded ${ageDescription(new Date(sub.submittedAt), now)} ago` : 'Awaiting your review',
        };
      }
      return {
        actor: 'them',
        kind: 'wait-for-review',
        verb: 'Add a follow-up',
        urgency: 5,
        reason: 'Brand is reviewing',
      };
    }

    case 'revisions-requested': {
      if (role === 'creator') {
        return {
          actor: 'me',
          kind: 'upload-draft',
          verb: 'Upload next round',
          urgency: 350,
          reason: 'Brand requested changes',
        };
      }
      return {
        actor: 'them',
        kind: 'wait-for-upload',
        verb: 'Send a message',
        urgency: 8,
        reason: 'Creator is revising',
      };
    }

    // ============================================================
    // POST-FLOW
    // ============================================================
    case 'approved':
    case 'posted': {
      // Mostly passive — money has cleared (approved) or content is live
      // (posted). Nothing for the user to do; both sides may want to
      // surface the win in Today's "recent activity" rather than its
      // action queue.
      return {
        actor: 'neither',
        kind: 'view-performance',
        verb: 'View performance',
        urgency: 0,
        reason: state === 'posted' ? 'Live on channels' : 'Approved',
      };
    }

    case 'closed': {
      return {
        actor: 'neither',
        kind: 'review-counterparty',
        verb: role === 'creator' ? 'Review brand' : 'Review creator',
        urgency: 0,
        reason: 'Deal complete',
      };
    }

    // ============================================================
    // PRE-OFFER
    // ============================================================
    case 'applied': {
      if (role === 'brand') {
        return {
          actor: 'me',
          kind: 'shortlist-applicant',
          secondary: ['decline-applicant'],
          verb: 'Shortlist',
          urgency: 80,
          reason: 'New applicant',
        };
      }
      return {
        actor: 'them',
        kind: 'withdraw-application',
        verb: 'Withdraw',
        urgency: 0,
        reason: 'Awaiting brand decision',
      };
    }

    case 'shortlisted': {
      if (role === 'brand') {
        return {
          actor: 'me',
          // Phase 24 QA fix: distinct kind from 'applied' branch so Phase 25
          // dispatch can route shortlisted → OfferModal vs applied → shortlist-action.
          kind: 'send-offer',
          verb: 'Send offer',
          urgency: 100,
          reason: 'On your shortlist',
        };
      }
      return {
        actor: 'them',
        kind: 'wait-for-review',
        verb: 'Send a message',
        urgency: 0,
        reason: 'Shortlisted by brand',
      };
    }

    case 'declined':
    case 'withdrawn': {
      return {
        actor: 'neither',
        kind: 'none',
        urgency: 0,
        reason: state === 'declined' ? 'Declined' : 'Withdrawn',
      };
    }
  }
}

// ============================================================
// Internal helpers
// ============================================================

function hoursUntilOfferExpiry(offer: Offer, now: Date): number {
  const expiresAt = +new Date(offer.sentAt) + OFFER_EXPIRY_DAYS * DAY_MS;
  return Math.max(0, (expiresAt - +now) / HOUR_MS);
}

function daysUntilDeadline(campaign: Campaign, now: Date): number {
  const d = parseDeadline(campaign.deadline, now);
  // Phase 24 QA fix: when the deadline can't be parsed, ASSUME WORST
  // case (1 day) rather than the forgiving 14-day fallback. Better UX
  // for creators with friendly-string deadlines that we can't pin down
  // — a "Tomorrow" deal should rank close to high-urgency, not idle.
  if (!d) return 1;
  return (+d - +now) / DAY_MS;
}

function parseDeadline(raw: string, now: Date): Date | null {
  // Accepts ISO ("2026-05-15") and a few common phrases. We deliberately
  // keep this small — production should standardize on ISO at write time.
  // Phase 24 QA: handle "Today" / "Tomorrow" / "in N days" so friendly
  // copy doesn't collapse to MEDIUM urgency in the ranking pass.
  if (!raw) return null;
  const trimmed = raw.trim().toLowerCase();
  if (trimmed === 'today')    return now;
  if (trimmed === 'tomorrow') return new Date(+now + DAY_MS);
  const inN = /^in (\d+)\s*(day|days|d)$/.exec(trimmed);
  if (inN) return new Date(+now + Number(inN[1]) * DAY_MS);
  // ISO 8601 / RFC 2822 / browser-recognized date strings.
  const d = new Date(raw);
  if (!isNaN(+d)) return d;
  return null;
}

/** Urgency score from "hours until a deadline."
 *  Same curve, two contexts: when YOU are blocked (selfBlocked=true) the
 *  numbers ratchet higher; when THEY are blocked, the score collapses. */
function urgencyFromHours(hoursLeft: number, selfBlocked: boolean): number {
  if (!selfBlocked) return Math.min(50, Math.max(0, 50 - hoursLeft / 24));
  if (hoursLeft <= 0)   return 950;
  if (hoursLeft <= 6)   return 900;
  if (hoursLeft <= 24)  return 750;
  if (hoursLeft <= 72)  return 500;
  if (hoursLeft <= 168) return 300; // 1 week
  return 150;
}

/** Urgency score from "hours since the user was blocked."
 *  Inverse of the deadline scoring — newer items rank lower until they
 *  cross the SLA threshold. */
function urgencyFromAge(hoursOld: number, selfBlocked: boolean): number {
  if (!selfBlocked) return 5;
  if (hoursOld < 4)   return 250; // fresh — visible but not pressing
  if (hoursOld < 24)  return 400; // same day
  if (hoursOld < 72)  return 600; // older than 3 days = SLA risk
  return 800;                     // > 3d uncovered = high pressure
}

/** Friendly age string ("4h", "3d", "2w"). */
function ageDescription(then: Date, now: Date): string {
  const ms = +now - +then;
  const hours = ms / HOUR_MS;
  if (hours < 1)  return `${Math.max(1, Math.round(ms / 60000))}m`;
  if (hours < 24) return `${Math.round(hours)}h`;
  const days = hours / 24;
  if (days < 7)   return `${Math.round(days)}d`;
  return `${Math.round(days / 7)}w`;
}

function deadlineReason(daysToDeadline: number): string {
  if (daysToDeadline < 0) return 'Past deadline';
  if (daysToDeadline < 1) return 'Due today';
  if (daysToDeadline < 2) return 'Due tomorrow';
  if (daysToDeadline < 14) return `Due in ${Math.round(daysToDeadline)}d`;
  return `Due in ${Math.round(daysToDeadline / 7)}w`;
}
