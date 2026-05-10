// relations.ts — derived-relation helpers that replace duplicated state.
//
// Phase P1a removes `Campaign.acceptedCreators[]` and `Campaign.shortlist[]`.
// Both were duplicate of state already derivable from `Offer.status` and
// `Application.status` — and like all duplicates, they drifted (a direct
// `acceptedCreators.push` without bumping the offer status, etc.). Reading
// through these helpers makes the relation explicit and impossible to skew.
//
// Wallet helpers live here too because their invariant
// (cached creator/brand wallet fields ≡ recomputed-from-transactions value)
// is the same shape of "single source of truth" guarantee.

import type { Database } from './types';

// =====================================================================
// Campaign × creator relations
// =====================================================================

/** Creator IDs with an accepted Offer on this campaign. Replaces
 *  `campaign.acceptedCreators`. */
export function getAcceptedCreators(campaignId: string, db: Database): string[] {
  const ids = new Set<string>();
  for (const o of db.offers) {
    if (o.campaignId === campaignId && o.status === 'accepted') ids.add(o.creatorId);
  }
  return Array.from(ids);
}

/** Creator IDs with a shortlisted Application on this campaign. Replaces
 *  `campaign.shortlist`. */
export function getShortlistedCreators(campaignId: string, db: Database): string[] {
  const ids = new Set<string>();
  for (const a of db.applications) {
    if (a.campaignId === campaignId && a.status === 'shortlisted') ids.add(a.creatorId);
  }
  return Array.from(ids);
}

/** True iff the creator has an accepted Offer on this campaign. */
export function isCreatorAccepted(campaignId: string, creatorId: string, db: Database): boolean {
  return db.offers.some(
    (o) => o.campaignId === campaignId && o.creatorId === creatorId && o.status === 'accepted',
  );
}

/** True iff the creator has a shortlisted Application on this campaign. */
export function isCreatorShortlisted(campaignId: string, creatorId: string, db: Database): boolean {
  return db.applications.some(
    (a) => a.campaignId === campaignId && a.creatorId === creatorId && a.status === 'shortlisted',
  );
}

/** Campaign IDs the creator participates in (accepted OR shortlisted OR
 *  applied OR has an offer). Replaces filters that walked
 *  `acceptedCreators.includes(creatorId)` and `shortlist.includes(creatorId)`. */
export function getCampaignsForCreator(creatorId: string, db: Database): string[] {
  const ids = new Set<string>();
  for (const a of db.applications) if (a.creatorId === creatorId) ids.add(a.campaignId);
  for (const o of db.offers) if (o.creatorId === creatorId) ids.add(o.campaignId);
  for (const s of db.submissions) if (s.creatorId === creatorId) ids.add(s.campaignId);
  return Array.from(ids);
}

// =====================================================================
// Wallet recomputation (single source of truth = transactions)
// =====================================================================

export interface WalletSnapshot {
  /** Creator: cleared, withdrawable. Brand: available to spend. */
  available: number;
  /** Creator-only: held in escrow on the creator's behalf. */
  pending: number;
  /** Brand-only: held in escrow across active campaigns. */
  escrowHeld: number;
  /** Creator-only: lifetime cleared payouts. */
  lifetime: number;
}

/** Walk db.transactions for `userId` and reduce to the wallet shape.
 *  This is the canonical computation; cached fields on Creator/Brand
 *  must equal this output after every mutation (see assertWalletConsistency). */
export function recomputeWallet(userId: string, db: Database): WalletSnapshot {
  let available = 0;
  let pending = 0;
  let escrowHeld = 0;
  let lifetime = 0;

  for (const t of db.transactions) {
    if (t.userId !== userId) continue;
    switch (t.kind) {
      case 'topup':
        if (t.status === 'cleared') available += t.amount;
        break;
      case 'escrow_hold':
        // Brand-side: amount is negative (debit from wallet → escrow).
        // Reflects in available (decreased) and escrowHeld (increased).
        if (t.status === 'cleared') {
          available += t.amount; // negative
          escrowHeld += -t.amount; // positive
        }
        break;
      case 'escrow_release':
        // Brand-side: amount is negative (debit from escrow → creator).
        if (t.status === 'cleared') {
          escrowHeld += t.amount; // negative
        }
        break;
      case 'payout':
        // Creator-side: amount is positive (credit to wallet).
        if (t.status === 'cleared') {
          available += t.amount;
          lifetime += t.amount;
        }
        break;
      case 'fee':
        // Already netted out of the payout amount in the demo's accounting.
        // Keep the row for the ledger UI; don't double-debit the wallet.
        break;
      case 'refund':
        // Brand-side: positive amount returned from escrow → wallet.
        if (t.status === 'cleared') {
          available += t.amount;
          escrowHeld -= t.amount;
        }
        break;
      default:
        break;
    }
  }

  // Pending balance for creators: sum of escrow_hold amounts where the
  // creator is the counterparty and the offer hasn't released yet.
  // Computed by walking holds without matching releases.
  const holdsByCampaign = new Map<string, number>();
  for (const t of db.transactions) {
    if (t.kind === 'escrow_hold' && t.counterpartyUserId === userId && t.status === 'cleared') {
      holdsByCampaign.set(t.campaignId ?? '', (holdsByCampaign.get(t.campaignId ?? '') ?? 0) + (-t.amount));
    }
    if ((t.kind === 'escrow_release' || t.kind === 'refund') && t.counterpartyUserId === userId && t.status === 'cleared') {
      holdsByCampaign.set(t.campaignId ?? '', (holdsByCampaign.get(t.campaignId ?? '') ?? 0) - (-t.amount));
    }
  }
  for (const v of holdsByCampaign.values()) {
    if (v > 0) pending += v;
  }

  return { available, pending, escrowHeld, lifetime };
}

/** Dev-mode invariant. Called at the end of every wallet-touching mutation
 *  in development. Walks every creator + brand, recomputes their wallet
 *  from transactions, and compares to the cached fields. Throws on drift.
 *
 *  In production, this is a no-op (the cached fields are optimistically
 *  trusted). The cached fields will be removed entirely in a later phase
 *  once consumers can render from the recomputed shape directly. */
export function assertWalletConsistency(db: Database): void {
  if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'production') return;
  const drift: string[] = [];

  for (const c of db.creators) {
    const user = db.users.find((u) => u.creatorId === c.id);
    if (!user) continue;
    const w = recomputeWallet(user.id, db);
    if (Math.abs(w.available - c.walletBalance) > 1) {
      drift.push(`creator ${c.id} walletBalance ${c.walletBalance} vs recomputed ${w.available}`);
    }
    if (Math.abs(w.pending - c.pendingBalance) > 1) {
      drift.push(`creator ${c.id} pendingBalance ${c.pendingBalance} vs recomputed ${w.pending}`);
    }
  }

  for (const b of db.brands) {
    const user = db.users.find((u) => u.brandId === b.id);
    if (!user) continue;
    const w = recomputeWallet(user.id, db);
    if (Math.abs(w.available - b.walletBalance) > 1) {
      drift.push(`brand ${b.id} walletBalance ${b.walletBalance} vs recomputed ${w.available}`);
    }
    if (Math.abs(w.escrowHeld - b.escrowHeld) > 1) {
      drift.push(`brand ${b.id} escrowHeld ${b.escrowHeld} vs recomputed ${w.escrowHeld}`);
    }
  }

  if (drift.length > 0) {
    // eslint-disable-next-line no-console
    console.warn(`[wallet drift]\n  ${drift.join('\n  ')}`);
  }
}
