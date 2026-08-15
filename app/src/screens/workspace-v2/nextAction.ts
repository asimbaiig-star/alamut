// nextAction.ts — whose turn is it, and what is the move?
//
// THE PROBLEM THIS SOLVES
//
// A collaboration only advances when someone acts. Walking both sides stage
// by stage turned up four places where that broke down:
//
//   1. `approved` — the creator holds the ball ("post it, then paste the
//      URL") and the only button on their next-action card was "Message
//      brand". The actual move had no CTA where the product told them to
//      make it.
//   2. `submitted` with a slot in revision — the brand's kanban card matched
//      no branch and rendered NOTHING. Not "waiting on the creator": blank.
//   3. `live` — both sides read as finished, but `paid` needs the campaign
//      closed, and nothing told the brand that closing it is what completes
//      the deal. Deals sat in `live` forever with everyone believing they
//      were done.
//   4. `invited` with no offer attached — the creator's only move was to
//      message, because there was no rate to accept.
//
// The root cause is structural: `StageActionBanner` is creator-only. No
// brand surface had a component whose job was to answer "what do I do next?",
// so brand-side gaps showed up as silence rather than as wrong text.
//
// THE SHAPE
//
// One resolver, keyed by a `Record<V2CollabStage, …>` so adding a stage is a
// COMPILE ERROR here until its owner and CTA are defined — the same guarantee
// `V2_STAGE_META` gives for stage metadata. Both personas render from this,
// so "every stage has an owner and an action" stops being something we
// re-audit and becomes something the compiler enforces.
//
// This module is pure: no store access, no React. Callers pass what they
// know; surfaces own the side effects.

import type { V2CollabStage } from './data';

/** Who must act for the deal to advance. `nobody` is a real answer — a
 *  terminal stage, or one waiting on a scheduled event rather than a person. */
export type ActionOwner = 'brand' | 'creator' | 'nobody';

/** Stable identifier for the move. Surfaces map this to a handler; keeping
 *  it symbolic means the copy can change without touching wiring. */
export type NextActionIntent =
  | 'accept-or-counter-offer'   // creator: an offer is on the table
  | 'respond-to-invite'         // creator: invited with no rate attached yet
  | 'decide-on-pitch'           // brand: accept the pitch or send an offer
  | 'reply-to-counter'          // brand: creator countered, brand's move
  | 'upload-content'            // creator: work is due
  | 'review-submission'         // brand: content is waiting on review
  | 'resubmit-content'          // creator: revisions were requested
  | 'add-live-link'             // creator: approved, needs the public URL
  | 'confirm-live'              // brand: verify the link and mark it live
  | 'close-campaign'            // brand: end the campaign so the deal settles
  | 'none';                     // terminal or externally blocked

export interface NextAction {
  owner: ActionOwner;
  intent: NextActionIntent;
  /** Imperative, for the party who must act. */
  label: string;
  /** Shown to the OTHER party. Never blank — "not your turn" is information,
   *  and its absence is what made the brand card render nothing. */
  waitingLabel: string;
}

/** What the resolver needs to disambiguate stages that branch. */
export interface NextActionContext {
  /** An offer awaiting the CREATOR's response (pending, or countered by the
   *  brand). When false at `negotiating`, the ball is with the brand. */
  offerAwaitingCreator?: boolean;
  /** Any offer at all on this pair — distinguishes a cold invite (no rate to
   *  accept) from an invite that carries one. */
  hasOffer?: boolean;
  /** At least one deliverable sitting in `in_review`. */
  hasSlotInReview?: boolean;
  /** At least one deliverable sent back for revision. */
  hasSlotInRevision?: boolean;
  /** Every approved slot has a public URL attached. */
  allSlotsHavePermalink?: boolean;
  /** The parent campaign is `closed`. `paid` requires it. */
  campaignClosed?: boolean;
}

type Resolver = (ctx: NextActionContext) => NextAction;

/**
 * Keyed by stage — deliberately a Record so the union and this table cannot
 * drift. Do not replace with a switch that has a default case; the default is
 * what let stages fall through to silence in the first place.
 */
const RESOLVERS: Record<V2CollabStage, Resolver> = {
  // Brand reached out. If they attached a rate the creator can act on it;
  // a bare invite has nothing to accept, which is gap 4.
  invited: (ctx) => ctx.hasOffer
    ? {
      owner: 'creator',
      intent: 'accept-or-counter-offer',
      label: 'Accept or counter the offer',
      waitingLabel: 'Offer sent · awaiting the creator',
    }
    : {
      owner: 'creator',
      intent: 'respond-to-invite',
      label: 'Accept at the posted rate, or reply',
      waitingLabel: 'Invitation sent · awaiting the creator',
    },

  // Creator pitched. The brand decides — and can now accept the pitch
  // outright rather than being forced through a fresh offer round trip.
  pitched: () => ({
    owner: 'brand',
    intent: 'decide-on-pitch',
    label: 'Accept the pitch or send an offer',
    waitingLabel: 'Pitch sent · awaiting the brand',
  }),

  // Alternates. `offerAwaitingCreator` is what decides, not the stage.
  negotiating: (ctx) => ctx.offerAwaitingCreator
    ? {
      owner: 'creator',
      intent: 'accept-or-counter-offer',
      label: 'Accept or counter the offer',
      waitingLabel: 'Awaiting the creator’s reply',
    }
    : {
      owner: 'brand',
      intent: 'reply-to-counter',
      label: 'Accept or counter back',
      waitingLabel: 'Counter sent · awaiting the brand',
    },

  confirmed: () => ({
    owner: 'creator',
    intent: 'upload-content',
    label: 'Upload your content',
    waitingLabel: 'Confirmed · awaiting the creator’s upload',
  }),

  // GAP 2 lived here. Revision-in-flight is the creator's move, and the
  // brand card used to render nothing at all in that case.
  submitted: (ctx) => ctx.hasSlotInReview
    ? {
      owner: 'brand',
      intent: 'review-submission',
      label: 'Review the submission',
      waitingLabel: 'Submitted · awaiting the brand’s review',
    }
    : ctx.hasSlotInRevision
      ? {
        owner: 'creator',
        intent: 'resubmit-content',
        label: 'Address the feedback and resubmit',
        waitingLabel: 'Changes requested · awaiting the creator',
      }
      : {
        owner: 'brand',
        intent: 'review-submission',
        label: 'Review the submission',
        waitingLabel: 'Submitted · awaiting the brand’s review',
      },

  // GAP 1 lived here. The creator has been paid and must post; once the URL
  // is on every slot it becomes the brand's job to verify it.
  approved: (ctx) => ctx.allSlotsHavePermalink
    ? {
      owner: 'brand',
      intent: 'confirm-live',
      label: 'Confirm the post is live',
      waitingLabel: 'Link added · awaiting the brand’s confirmation',
    }
    : {
      owner: 'creator',
      intent: 'add-live-link',
      label: 'Add the live post link',
      waitingLabel: 'Approved · awaiting the creator’s post',
    },

  // GAP 3 lived here. `paid` needs the campaign closed, and nothing said so,
  // so deals sat in `live` with both sides believing they were finished.
  live: (ctx) => ctx.campaignClosed
    ? {
      owner: 'nobody',
      intent: 'none',
      label: 'Settling — the payout is clearing',
      waitingLabel: 'Settling — the payout is clearing',
    }
    : {
      owner: 'brand',
      intent: 'close-campaign',
      label: 'End the campaign to close this deal out',
      waitingLabel: 'Live · the brand closes the campaign to settle',
    },

  paid: () => ({
    owner: 'nobody',
    intent: 'none',
    label: 'Complete',
    waitingLabel: 'Complete',
  }),

  cancelled: () => ({
    owner: 'nobody',
    intent: 'none',
    label: 'Cancelled',
    waitingLabel: 'Cancelled',
  }),
};

/** Resolve the next action for a stage. Never returns null — a stage with no
 *  pending move says so explicitly. */
export function nextAction(stage: V2CollabStage, ctx: NextActionContext = {}): NextAction {
  return RESOLVERS[stage](ctx);
}

/** What THIS viewer should read: the imperative when it's their move, the
 *  waiting line otherwise. */
export function nextActionFor(
  stage: V2CollabStage,
  viewer: 'brand' | 'creator',
  ctx: NextActionContext = {},
): { isYourMove: boolean; text: string; action: NextAction } {
  const action = nextAction(stage, ctx);
  const isYourMove = action.owner === viewer;
  return {
    isYourMove,
    text: isYourMove ? action.label : action.waitingLabel,
    action,
  };
}
