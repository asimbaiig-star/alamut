// campaignTarget.ts — what a brand means to pay one creator, in one place.
//
// The portal used to work this out five ways: the brand home and the
// creator home split the budget across the booked creators (so a campaign
// with two booked showed half its budget as the target), while Briefs, the
// brief page and the campaign page split it at least four ways. The same
// campaign showed two different targets depending on where you looked.
//
// The wizard asks the brand for "Target price per creator"; when the
// campaign kept it, that is the answer. Older campaigns never stored it, so
// they fall back to the budget split four ways, or across everyone booked
// when more than four are.

interface Targetable {
  budget: number;
  perCreator?: number;
  /** Booked creators (V2Campaign.creators). */
  creators?: readonly unknown[];
}

const FALLBACK_PLACES = 4;

/** The per-creator target, in whole dollars. */
export function perCreatorTarget(c: Targetable): number {
  if (c.perCreator && c.perCreator > 0) return Math.round(c.perCreator);
  const booked = c.creators?.length ?? 0;
  return Math.round(c.budget / Math.max(booked, FALLBACK_PLACES));
}

/** How many creators the budget covers at that target (never fewer than
 *  are already booked). */
export function campaignPlaces(c: Targetable): number {
  const booked = c.creators?.length ?? 0;
  const target = perCreatorTarget(c);
  const fits = target > 0 ? Math.floor(c.budget / target) : FALLBACK_PLACES;
  return Math.max(booked, fits, 1);
}

/** True when the target is the brand's own figure, not the estimate. */
export const hasOwnTarget = (c: Targetable) => !!c.perCreator && c.perCreator > 0;
