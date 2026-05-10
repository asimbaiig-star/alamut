// Canonical deal aggregator (Phase 24).
//
// One hook to rule them all: given a dealId (composite of campaignId +
// creatorId), produce a single `Deal` value containing everything any
// deal-page consumer could need:
//
//   - the campaign + brand + creator records
//   - the application (if any)
//   - the LATEST offer (post counter+re-offer cycles handled correctly)
//   - the LATEST ACCEPTED offer (separate, for money math)
//   - all submissions sorted newest-first
//   - the open dispute (if any)
//   - the campaign-bound thread (if any)
//   - the messages on that thread
//   - the transactions tied to this deal × this user
//   - the derived state (DealState) and action (DealAction)
//   - released / escrow-held money for the role's perspective
//
// Two design principles enforced here:
//
//   1. NO consumer of /deal/:id needs to re-derive any of this. If the
//      deal page wants "what's the brand thinking?" it asks the hook.
//      If a Today-queue card wants "what's the urgency?" it asks the
//      hook. The hook is the contract.
//
//   2. The pure derive function is exported separately so it can be
//      called from non-React contexts (the Today queue ranks deals
//      without mounting them as components, for example). React-state
//      vs pure-derive is a thin wrapper; the work is in the pure fn.
//
// Performance note: this hook subscribes to `db` and recomputes when it
// changes. For the deal page that's exactly right (one deal per render).
// Today's queue uses the pure deriveDeal directly inside a useMemo over
// the full set of deal pairs — no per-row hook subscription.

import { useStore } from '@/lib/api/store';
import { useAuth } from '@/lib/auth/useAuth';
import { useMemo } from 'react';
import type {
  Application,
  Brand,
  Campaign,
  Creator,
  Database,
  Dispute,
  Message,
  Offer,
  Submission,
  Thread,
  Transaction,
} from '@/lib/api/types';
// Phase 31 perf: per-db index built lazily via WeakMap, reused across
// every deriveDeal call until tx() replaces the db ref. Reduces
// collectTodayDeals from O(pairs × artifacts) to O(pairs + artifacts).
import { getDbIndex } from '@/lib/api/db-index';

import { decodeDealId } from '@/lib/utils/deal-id';
import {
  computeDealState,
  type DealState,
} from '@/lib/utils/deal-state';
import {
  computeDealAction,
  type DealAction,
  type Role,
} from '@/lib/utils/deal-action';

export interface Deal {
  /** Composite deal id (campaignId--creatorId). */
  id: string;
  /** Convenience pointers. */
  campaignId: string;
  creatorId: string;

  // Core entities
  campaign: Campaign;
  creator: Creator;
  brand: Brand;

  // Lifecycle artefacts
  application?: Application;
  /** Latest offer for this creator (any status). */
  offer?: Offer;
  /** Latest ACCEPTED offer — drives money math. */
  acceptedOffer?: Offer;
  /** All submissions, newest-first. */
  submissions: Submission[];
  /** Latest submission for quick access. */
  latestSubmission?: Submission;
  /** Open dispute on the campaign (rare; takes precedence in state). */
  openDispute?: Dispute;

  // Communication
  thread?: Thread;
  messages: Message[];

  // Money — perspective depends on the calling role
  transactions: Transaction[];
  /** Sum of cleared payouts to THIS creator on THIS campaign. */
  released: number;
  /** Accepted rate − released (for accepted deals only). */
  escrowHeld: number;

  // Derived
  state: DealState;
  action: DealAction;
}

interface DeriveInputs {
  db: Database;
  campaignId: string;
  creatorId: string;
  role: Role;
  /** The current user — used to scope which transactions the deal includes
   *  (a creator sees their payouts; a brand sees the escrow-side ledger;
   *  an admin sees everything tied to the campaign). */
  viewerUserId?: string;
  /** Optional pinned "now" — defaults to system clock. Tests pin this. */
  now?: Date;
}

/** Pure derivation — no React. Returns null when the deal can't be built
 *  (campaign / creator / brand missing).
 *
 *  Phase 31 perf: reads through getDbIndex(db). The index is built once
 *  per Database snapshot via WeakMap caching, so callers that derive
 *  many deals against the same db (collectTodayDeals enumerating 10k
 *  pairs, the brand campaign roster building per-creator rows) pay the
 *  index build cost once, then every deriveDeal call is O(1) lookups
 *  instead of O(N) scans.
 */
export function deriveDeal(input: DeriveInputs): Deal | null {
  const { db, campaignId, creatorId, role, viewerUserId, now } = input;
  const ix = getDbIndex(db);

  const campaign = ix.campaignsById.get(campaignId);
  if (!campaign) return null;
  const creator = ix.creatorsById.get(creatorId);
  if (!creator) return null;
  const brand = ix.brandsById.get(campaign.brandId);
  if (!brand) return null;

  const pairKey = `${campaignId}|${creatorId}`;

  // Pick the latest application for this pair (usually one, but defensive).
  // Index buckets preserve insertion order, so the last entry is newest.
  const apps = ix.appsByPair.get(pairKey);
  const application = apps && apps.length > 0 ? apps[apps.length - 1] : undefined;

  // Latest offer (any status) — Phase 20 fix: walk in reverse so a
  // counter + re-offer cycle returns the newer record.
  const offers = ix.offersByPair.get(pairKey);
  const offer = offers && offers.length > 0 ? offers[offers.length - 1] : undefined;

  // Latest accepted offer for money math — separate so a re-offer cycle
  // (latest = pending) doesn't null out the accepted-rate KPIs while
  // escrow is still held from a previous accepted offer. Phase 20 QA.
  let acceptedOffer: Offer | undefined;
  if (offers) {
    for (let i = offers.length - 1; i >= 0; i--) {
      if (offers[i].status === 'accepted') { acceptedOffer = offers[i]; break; }
    }
  }

  // All submissions newest-first. Index buckets are in db order; we
  // reverse-sort once here. Most pairs have ≤3 submissions so this
  // sort is essentially free.
  const subBucket = ix.submissionsByPair.get(pairKey);
  const submissions = subBucket
    ? [...subBucket].sort((a, b) => +new Date(b.submittedAt) - +new Date(a.submittedAt))
    : [];
  const latestSubmission = submissions[0];

  // Open dispute on this campaign — there's usually at most one.
  const openDispute = ix.openDisputeByCampaign.get(campaignId);

  // Campaign-bound thread for the brand × creator participants.
  // Phase 24 QA fix: brands with multi-member teams have N users with the
  // same `brandId`. The thread's brand-side participant could be any of
  // them. Find a thread where ANY team member is a participant alongside
  // the creator's user — not just the FIRST team member returned by find().
  const creatorUserId = ix.userIdByCreator.get(creatorId);
  const brandTeamUserIds = ix.brandTeamUserIds.get(brand.id);
  let thread: Thread | undefined;
  if (creatorUserId && brandTeamUserIds) {
    const candidates = ix.threadsByCampaign.get(campaignId);
    if (candidates) {
      thread = candidates.find((t) =>
        t.participants.includes(creatorUserId)
        && t.participants.some((p) => brandTeamUserIds.has(p)));
    }
  }
  // Messages already sorted by buildIndex().
  const messages = thread ? (ix.messagesByThread.get(thread.id) ?? []) : [];

  // Transactions tied to this deal — scope by role:
  //   creator: payouts INTO their wallet
  //   brand:   escrow-side outflows from theirs
  //   admin:   anything tagged with this campaign
  // The viewer's userId controls "their wallet"; admin sees the union.
  const txBucket = ix.txByCampaign.get(campaignId) ?? [];
  const transactions = txBucket.filter((t) => {
    if (role === 'admin' || !viewerUserId) return true;
    return t.userId === viewerUserId || t.counterpartyUserId === viewerUserId;
  });

  // Released = sum of cleared positive payouts to the creator user on
  // this campaign. Phase 19 fix: derive from transactions, not
  // heuristic. Phase 31 perf: pre-bucketed by `${campaignId}|${userId}`
  // so we don't filter the whole txn array.
  const released = creatorUserId
    ? (ix.payoutsByPairUser.get(`${campaignId}|${creatorUserId}`) ?? [])
        .reduce((sum, t) => sum + t.amount, 0)
    : 0;

  // Escrow held = accepted rate − released. 0 when no accepted offer.
  const escrowHeld = acceptedOffer
    ? Math.max(0, acceptedOffer.rate - released)
    : 0;

  // Derived state + action.
  // Phase 24 QA fix: pass creatorId explicitly so the pre-application
  // shortlist fallback (campaign.shortlist contains the creator without
  // an Application record) can fire correctly.
  const state = computeDealState({ creatorId, campaign, application, offer, submissions, openDispute });
  const action = computeDealAction({
    state,
    role,
    campaign,
    offer,
    acceptedOffer,    // Phase 24 QA: separate so release-amount math uses
                       // the right rate after counter+re-offer cycles.
    latestSubmission,
    now,
  });

  return {
    id: `${campaignId}--${creatorId}`,
    campaignId,
    creatorId,
    campaign,
    creator,
    brand,
    application,
    offer,
    acceptedOffer,
    submissions,
    latestSubmission,
    openDispute,
    thread,
    messages,
    transactions,
    released,
    escrowHeld,
    state,
    action,
  };
}

// ============================================================
// React hook — thin wrapper over deriveDeal
// ============================================================

export interface UseDealResult {
  /** The aggregated deal, or null if not found / not authorized. */
  deal: Deal | null;
  /** True when the dealId param is malformed (caller can show 404). */
  malformed: boolean;
  /** True when the dealId is fine but the deal isn't visible to the
   *  current viewer (caller can show "not found / forbidden"). */
  forbidden: boolean;
}

export function useDealById(dealId: string | undefined): UseDealResult {
  const db = useStore((s) => s.db);
  const { user, isCreator, isBrand, isAdmin, creator, brand } = useAuth();

  return useMemo(() => {
    const parts = decodeDealId(dealId);
    if (!parts) return { deal: null, malformed: true, forbidden: false };

    const role: Role = isAdmin ? 'admin' : isCreator ? 'creator' : 'brand';
    const deal = deriveDeal({
      db,
      campaignId: parts.campaignId,
      creatorId: parts.creatorId,
      role,
      viewerUserId: user?.id,
    });

    if (!deal) return { deal: null, malformed: false, forbidden: false };

    // Authorization: a creator can only see their OWN deals; a brand
    // can only see deals on campaigns they own; admins see everything.
    if (isCreator && creator?.id !== deal.creatorId) {
      return { deal: null, malformed: false, forbidden: true };
    }
    if (isBrand && brand?.id !== deal.brand.id) {
      return { deal: null, malformed: false, forbidden: true };
    }

    return { deal, malformed: false, forbidden: false };
  }, [dealId, db, user?.id, isCreator, isBrand, isAdmin, creator?.id, brand?.id]);
}

/** Re-export the pure helper signature so non-hook callers (like Today's
 *  ranking pass) can derive without coupling to React. */
export { computeDealState, pickLatestSubmission } from '@/lib/utils/deal-state';
export { computeDealAction } from '@/lib/utils/deal-action';
export type { DealState } from '@/lib/utils/deal-state';
export type { DealAction, Role } from '@/lib/utils/deal-action';
