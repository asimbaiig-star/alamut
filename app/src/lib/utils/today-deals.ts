// Today-queue deal collection (Phase 26).
//
// Today's redesigned screen ranks deals by urgency. To do that, we need
// a deterministic way to enumerate the (campaignId, creatorId) pairs
// that constitute "this viewer's deals" — the inputs to deriveDeal.
//
// For a CREATOR:
//   - Every campaign they have an Application or Offer or Submission on
//   - Plus campaigns they're in `acceptedCreators[]` for (defensive)
//
// For a BRAND:
//   - Every campaign owned by their brand
//   - For each campaign, every creator who has an Application, Offer,
//     or Submission OR is in shortlist[] / acceptedCreators[]
//
// We deliberately DON'T include passive observers (e.g. an admin viewing
// the platform). Admin's Today is a different surface (Phase 28).
//
// The output is the input shape `RankableDeal<Deal>[]` that rankDeals()
// expects — deals already aggregated, state + action computed.

import type { Database } from '@/lib/api/types';
import type { Role } from '@/lib/utils/deal-action';
import { deriveDeal } from '@/lib/api/use-deal';
import { rankDeals } from '@/lib/utils/deal-ranking';
import type { RankableDeal, RankedDeals } from '@/lib/utils/deal-ranking';
import type { Deal } from '@/lib/api/use-deal';

interface CollectInputs {
  db: Database;
  role: Role;
  /** Creator ID (when role === 'creator'). */
  creatorId?: string;
  /** Brand ID (when role === 'brand'). */
  brandId?: string;
  /** Viewer's user id — drives transaction filtering inside deriveDeal. */
  viewerUserId?: string;
  /** Pinned "now" — defaults to system clock; tests pin this. */
  now?: Date;
}

/** Enumerate the (campaignId, creatorId) pairs the viewer has deals on. */
function collectDealPairs(input: CollectInputs): { campaignId: string; creatorId: string }[] {
  const { db, role, creatorId, brandId } = input;
  const pairs = new Set<string>();   // serialized "campaignId|creatorId" for dedup
  const out: { campaignId: string; creatorId: string }[] = [];
  const add = (campaignId: string, cid: string) => {
    const key = `${campaignId}|${cid}`;
    if (pairs.has(key)) return;
    pairs.add(key);
    out.push({ campaignId, creatorId: cid });
  };

  if (role === 'creator' && creatorId) {
    // All applications by this creator
    db.applications
      .filter((a) => a.creatorId === creatorId)
      .forEach((a) => add(a.campaignId, creatorId));
    // All offers to this creator (includes counter+re-offer)
    db.offers
      .filter((o) => o.creatorId === creatorId)
      .forEach((o) => add(o.campaignId, creatorId));
    // All submissions by this creator
    db.submissions
      .filter((s) => s.creatorId === creatorId)
      .forEach((s) => add(s.campaignId, creatorId));
    // P1a: acceptedCreators / shortlist removed — applications + offers
    // walks above already cover every campaign the creator participates in.
    return out;
  }

  if (role === 'brand' && brandId) {
    // Every campaign this brand owns
    const myCampaigns = db.campaigns.filter((c) => c.brandId === brandId);
    for (const c of myCampaigns) {
      // Every creator with an application on this campaign
      db.applications
        .filter((a) => a.campaignId === c.id)
        .forEach((a) => add(c.id, a.creatorId));
      // Every creator with an offer on this campaign
      db.offers
        .filter((o) => o.campaignId === c.id)
        .forEach((o) => add(c.id, o.creatorId));
      // Every creator with a submission
      db.submissions
        .filter((s) => s.campaignId === c.id)
        .forEach((s) => add(c.id, s.creatorId));
      // P1a: acceptedCreators + shortlist removed — applications + offers
      // walks above already cover every creator on this campaign.
    }
    return out;
  }

  return out;
}

/** Top-level entry point: collect, derive, rank. Returns the actionable
 *  + passive split that Today's UI renders directly. */
export function collectTodayDeals(input: CollectInputs): RankedDeals<Deal> {
  const pairs = collectDealPairs(input);

  const rankable: RankableDeal<Deal>[] = [];
  for (const { campaignId, creatorId } of pairs) {
    const deal = deriveDeal({
      db: input.db,
      campaignId,
      creatorId,
      role: input.role,
      viewerUserId: input.viewerUserId,
      now: input.now,
    });
    if (!deal) continue;
    rankable.push({ payload: deal, state: deal.state, action: deal.action });
  }

  return rankDeals(rankable, input.role);
}
