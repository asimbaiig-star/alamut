// availability.ts — a creator's standing instructions, enforced.
//
// THE BUG THIS FIXES
//
// `Creator.availability` carried three fields that named behaviours the code
// did not implement. The type's own comments admitted it — "auto-decline is
// advisory in the demo", "warn (but don't block)" — which makes it a naming
// problem as much as a missing feature: a creator who excluded "Gambling"
// still received gambling offers, and nothing anywhere auto-declined them.
//
// A field called `autoDeclineCategories` that declines nothing is worse than
// no field at all. It tells the creator they are protected when they are not.
//
// WHAT ENFORCES AND WHAT ADVISES — and why they differ
//
//   autoDeclineCategories  BLOCKS.  A standing "never send me this" is an
//                                   instruction, not a preference to weigh.
//   vacationMode           BLOCKS.  An explicit "I am not working right now",
//                                   with the return date offered to the brand
//                                   so they can come back.
//   minRate                WARNS.   A floor is a NEGOTIATING position. Blocking
//                                   would kill legitimate opening offers that
//                                   get countered up, and the creator can
//                                   always decline. Advisory on purpose, and
//                                   the docs now say so instead of implying
//                                   enforcement.
//   status: 'booked'       WARNS.   Fully scheduled now ≠ uninterested in work
//                                   next month.
//
// The split matters: blocking everything would make the platform hostile to
// brands, and blocking nothing is what we had. Enforce the instructions;
// advise on the judgement calls.
//
// Pure and side-effect free — callers decide what to do with the answer, and
// both the mutation guard and the UI read the same function so a disabled
// button and a thrown error can never disagree about why.

import type { Creator } from './types';

export interface AvailabilityVerdict {
  /** Non-null = the send must not proceed. Message is shown to the BRAND. */
  block: string | null;
  /** Non-null = proceed, but surface this first. */
  warn: string | null;
}

function firstName(creator: Pick<Creator, 'name'>): string {
  return creator.name.split(' ')[0] || 'This creator';
}

function whenBack(untilDate?: string): string {
  if (!untilDate) return '';
  // `untilDate` is a DATE, not an instant. `new Date('2026-09-01')` parses as
  // UTC midnight and `toLocaleDateString` then renders it in local time — so
  // west of UTC a creator who returns on 1 Sep is shown as "Aug 31". Build
  // the date from its parts so it means the day it says.
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(untilDate);
  const d = m
    ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
    : new Date(untilDate);
  if (Number.isNaN(+d)) return '';
  return ` They're back on ${d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}.`;
}

/**
 * Can this brand send this creator an offer, and should anything be said
 * first?
 *
 * `category` is the campaign's category; `rate` the proposed amount. Both are
 * optional so callers with only partial context (a cold invite carries no
 * rate) still get the checks that apply.
 */
export function availabilityVerdict(
  creator: Pick<Creator, 'name' | 'availability'> | undefined | null,
  opts: { category?: string; rate?: number } = {},
): AvailabilityVerdict {
  const a = creator?.availability;
  if (!creator || !a) return { block: null, warn: null };

  // ── Blocks ────────────────────────────────────────────────────────────
  const excluded = (a.autoDeclineCategories ?? [])
    .find((c) => opts.category && c.toLowerCase() === opts.category.toLowerCase());
  if (excluded) {
    return {
      block: `${firstName(creator)} doesn't take ${excluded} briefs — they've set that category to auto-decline.`,
      warn: null,
    };
  }

  if (a.vacationMode) {
    return {
      block: `${firstName(creator)} is away and not accepting briefs.${whenBack(a.untilDate)}`,
      warn: null,
    };
  }

  // ── Warnings ──────────────────────────────────────────────────────────
  if (typeof a.minRate === 'number' && typeof opts.rate === 'number'
      && opts.rate > 0 && opts.rate < a.minRate) {
    return {
      block: null,
      warn: `Below ${firstName(creator)}'s stated floor of $${a.minRate.toLocaleString()}. You can still send it — they set a floor, not a wall — but expect a counter.`,
    };
  }

  if (a.status === 'booked') {
    return {
      block: null,
      warn: `${firstName(creator)} is marked fully booked${whenBack(a.untilDate)} They may still take future work.`,
    };
  }

  if (a.status === 'limited') {
    return {
      block: null,
      warn: `${firstName(creator)} has limited availability right now.`,
    };
  }

  return { block: null, warn: null };
}

/** Convenience for mutation guards: the block message, or null. */
export function availabilityBlock(
  creator: Pick<Creator, 'name' | 'availability'> | undefined | null,
  opts: { category?: string; rate?: number } = {},
): string | null {
  return availabilityVerdict(creator, opts).block;
}
