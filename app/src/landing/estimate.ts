// estimate.ts — the maths behind the two landing calculators.
//
// Both are thin wrappers over the functions the product moves money with, so
// a calculator can never promise a figure the ledger won't produce. The
// creator tool reports exactly what `splitAcrossSlots` accrues; the brand
// tool reports what `v2AcceptOffer` holds and what `releaseSlotEscrow`
// releases per confirmed post.

import { splitAcrossSlots, slotGross } from './facts';

export interface CreatorEstimate {
  /** Held in escrow the moment the brand accepts. */
  held: number;
  /** Released as each post goes live and the brand confirms it. */
  releases: number[];
  fee: number;
  tax: number;
  /** What reaches the creator's wallet across every post. */
  net: number;
}

export function creatorEstimate(rate: number, posts: number): CreatorEstimate {
  const r = clampMoney(rate);
  const n = clampCount(posts, 10);
  const split = splitAcrossSlots(r, n);
  return {
    held: r,
    releases: Array.from({ length: n }, (_, i) => slotGross(r, n, i)),
    fee: split.fee,
    tax: split.tax,
    net: split.net,
  };
}

export interface BrandEstimate {
  /** Held across all creators once every offer is accepted. */
  held: number;
  /** What leaves escrow each time you confirm one post live, per creator. */
  perPost: number[];
  /** Platform fees charged to the brand. The fee is deducted on the creator's
   *  side of the ledger, so this is always zero — stated, not implied. */
  brandFee: 0;
  /** What each creator receives across their posts. */
  perCreatorNet: number;
}

export function brandEstimate(ratePerCreator: number, creators: number, postsEach: number): BrandEstimate {
  const r = clampMoney(ratePerCreator);
  const c = clampCount(creators, 50);
  const p = clampCount(postsEach, 10);
  return {
    held: r * c,
    perPost: Array.from({ length: p }, (_, i) => slotGross(r, p, i)),
    brandFee: 0,
    perCreatorNet: splitAcrossSlots(r, p).net,
  };
}

/** Whole dollars, 0 … 1,000,000. Anything unparseable reads as 0. */
export function clampMoney(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.min(1_000_000, Math.max(0, Math.round(v)));
}

function clampCount(v: number, max: number): number {
  if (!Number.isFinite(v)) return 1;
  return Math.min(max, Math.max(1, Math.round(v)));
}

export const usd = (n: number) =>
  `$${Math.round(n).toLocaleString('en-US')}`;
