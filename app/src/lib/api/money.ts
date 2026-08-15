// money.ts — the single source of truth for platform economics.
//
// Before this module the two rates were redeclared in five files
// (v2CampaignActions, v2CollabActions, v2DisputeActions, contracts,
// migrations) and the net multiplier was hardcoded as `* 0.85` in six more
// UI call sites. Everything agreed by luck, not by construction.
//
// It also wasn't purely a duplication problem. `Math.round(rate * 0.85)`
// and the release path's `gross - round(gross*0.10) - round(gross*0.05)`
// are DIFFERENT FUNCTIONS. They diverge whenever a rounding boundary falls
// between them — e.g. gross = 10:
//
//     release:  fee round(1.0)=1, tax round(0.5)=1  ->  net 8
//     preview:  round(10 * 0.85) = round(8.5)       ->  net 9
//
// so the creator was quoted $9 during negotiation and paid $8 on approval.
// Every "net to you" preview in the product had that class of error.
//
// Rule for callers: never recompute a fee, a tax, or a net. Ask here.

/** Platform's cut of the agreed rate. */
export const PLATFORM_FEE = 0.10;

/** Withholding tax deducted from the creator's side. */
export const WHT = 0.05;

export interface MoneySplit {
  /** Amount leaving brand escrow. */
  gross: number;
  /** Platform fee, a positive number (callers negate it for ledger rows). */
  fee: number;
  /** Withholding tax, positive. */
  tax: number;
  /** What actually lands in the creator's wallet. */
  net: number;
}

/**
 * Split a gross amount into fee / tax / net.
 *
 * `net` is deliberately derived by subtraction rather than by its own
 * `Math.round`, so `fee + tax + net === gross` holds exactly for every
 * input. That identity is what makes a ledger reconcile, and it is the
 * behaviour `v2ApproveContent` has always had — this is that logic, moved,
 * not a reimplementation of it.
 */
export function splitGross(gross: number): MoneySplit {
  const fee = Math.round(gross * PLATFORM_FEE);
  const tax = Math.round(gross * WHT);
  return { gross, fee, tax, net: gross - fee - tax };
}

/** What the creator receives from a gross amount. Use for every "net to you". */
export function netOf(gross: number): number {
  return splitGross(gross).net;
}

/**
 * The gross belonging to one deliverable slot of a multi-deliverable collab.
 *
 * Each slot takes `floor(rate / slotCount)` and the LAST slot absorbs the
 * remainder, so summing every slot returns exactly `rate` with nothing
 * stranded in escrow. An unresolvable slot index (-1) takes the base share:
 * under-releasing leaves money in escrow, which is recoverable; the reverse
 * is not.
 */
export function slotGross(rate: number, slotCount: number, slotIndex: number): number {
  if (slotCount <= 1) return rate;
  const base = Math.floor(rate / slotCount);
  return slotIndex === slotCount - 1 ? rate - base * (slotCount - 1) : base;
}

/**
 * The fee/tax/net a collab will ACTUALLY accrue once every slot is approved.
 *
 * Needed because rounding is applied per slot at release time, so a
 * single-pass split of the whole rate can disagree with the sum of the
 * parts. `createContractForAcceptedOffer` stored the single-pass figures
 * while the money moved per slot — e.g. $999 over 4 slots stored a net of
 * $849 against $850 actually paid. Contracts are what a finance export
 * would treat as ground truth, so they have to match the movement.
 */
export function splitAcrossSlots(rate: number, slotCount: number): MoneySplit {
  const slots = Math.max(1, slotCount);
  let fee = 0;
  let tax = 0;
  let net = 0;
  for (let i = 0; i < slots; i++) {
    const part = splitGross(slotGross(rate, slots, i));
    fee += part.fee;
    tax += part.tax;
    net += part.net;
  }
  return { gross: rate, fee, tax, net };
}

/** "10%" — for copy that quotes the rate, so labels can't drift from the maths. */
export const PLATFORM_FEE_LABEL = `${Math.round(PLATFORM_FEE * 100)}%`;

/** "5%" */
export const WHT_LABEL = `${Math.round(WHT * 100)}%`;
