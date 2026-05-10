// contracts.ts — runtime helper for creating Contract rows.
//
// P2 §1.3 — Contract is the immutable agreement snapshot. Created in
// the same `tx` as `Offer.status = 'accepted'` (v2AcceptOffer +
// v2AcceptCounter). The migrator-5 path mirrors this logic for
// pre-existing accepted offers; this is the runtime path for net-new
// acceptances.
//
// The two stay in lockstep — when the agreement shape changes, both
// migrator 5 and this helper update.

import type {
  Database, Contract, ContractDeliverableSnapshot, Offer,
} from './types';

const PLATFORM_FEE_RATE = 0.10;
const WHT_RATE = 0.05;

function newContractId(collabId: string): string {
  // Random short suffix so net-new contracts don't collide with the
  // migrator's stable `ctr_<collabId>` ids (the migrator only writes
  // for collabs that don't have a contractId yet).
  const rand = Math.random().toString(36).slice(2, 7);
  return `ctr_${collabId.replace(/^col_/, '')}_${rand}`;
}

/** Build a Contract from an accepted Offer + the campaign at acceptance
 *  time. Pushes the row into `db.contracts` and returns the new id.
 *  Callers should also set `Collaboration.contractId = <returned id>`. */
export function createContractForAcceptedOffer(
  db: Database,
  collabId: string,
  acceptedOffer: Offer,
  acceptedByUserId: string,
  acceptedAtMs: number = Date.now(),
): string | null {
  const collab = db.collaborations.find((c) => c.id === collabId);
  if (!collab) return null;
  // Defensive: don't double-create. If the collab already has a contract,
  // return the existing id so the caller can wire it idempotently.
  if (collab.contractId) return collab.contractId;

  const camp = db.campaigns.find((c) => c.id === collab.campaignId);
  if (!camp) return null;

  const rate = acceptedOffer.rate;
  const platformFee = Math.round(rate * PLATFORM_FEE_RATE);
  const withholdingTax = Math.round(rate * WHT_RATE);
  const netToCreator = rate - platformFee - withholdingTax;

  const deliverableSnapshots: ContractDeliverableSnapshot[] = db.deliverables
    .filter((d) => d.campaignId === collab.campaignId)
    .sort((a, b) => a.index - b.index)
    .map((d) => ({
      deliverableId: d.id,
      index: d.index,
      platform: d.platform,
      format: d.format,
      quantity: d.quantity,
      dueOffsetDays: d.dueOffsetDays,
      specs: d.specs,
    }));

  const id = newContractId(collabId);
  const contract: Contract = {
    id,
    collaborationId: collabId,
    campaignId: collab.campaignId,
    creatorId: collab.creatorId,
    brandId: collab.brandId,
    agreedRate: rate,
    netToCreator,
    platformFee,
    withholdingTax,
    deliverables: deliverableSnapshots,
    briefSnapshot: camp.brief,
    briefSnapshotAt: acceptedAtMs,
    acceptedAt: acceptedAtMs,
    acceptedByUserId,
    status: 'active',
    fulfilledAt: null,
    cancelledAt: null,
  };
  db.contracts.push(contract);
  collab.contractId = id;
  return id;
}

/** Mark a contract fulfilled when payout clears.
 *
 *  Defensive contract:
 *    - Idempotent — re-running on an already-fulfilled contract is a
 *      no-op (preserves the original `fulfilledAt` timestamp).
 *    - Refuses to flip a `cancelled` contract to `fulfilled`. A
 *      cancelled contract represents an aborted agreement; payout
 *      and dispute paths should never call this on one, but the
 *      guard makes the function safe regardless. The two call sites
 *      today (`v2ApproveContent` payout, `v2ResolveDispute`) gate on
 *      collab stage well before this runs, so the guard is cover for
 *      future call sites where the precondition is harder to see.
 *    - Silent no-op when contractId doesn't resolve. */
export function markContractFulfilled(
  db: Database,
  contractId: string,
  fulfilledAtMs: number = Date.now(),
): void {
  const c = db.contracts.find((x) => x.id === contractId);
  if (!c || c.status === 'fulfilled' || c.status === 'cancelled') return;
  c.status = 'fulfilled';
  c.fulfilledAt = fulfilledAtMs;
}
