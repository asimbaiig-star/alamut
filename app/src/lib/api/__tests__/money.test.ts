// money.test.ts — invariants for the single source of platform economics.
//
// The point of lib/api/money.ts is that a fee, a tax and a net can only be
// produced one way. These tests pin the properties that made the previous
// scattered arithmetic wrong, so a "simplification" back to `* 0.85` fails
// loudly instead of silently re-introducing the drift.

import { describe, it, expect } from 'vitest';
import {
  PLATFORM_FEE, WHT, splitGross, netOf, slotGross, splitAcrossSlots,
} from '../money';

describe('splitGross', () => {
  it('reconciles exactly for every amount in a wide range', () => {
    // fee + tax + net === gross must hold for EVERY input, not just
    // convenient ones — this identity is what lets a ledger balance.
    for (let gross = 0; gross <= 5000; gross++) {
      const { fee, tax, net } = splitGross(gross);
      expect(fee + tax + net).toBe(gross);
    }
  });

  it('never returns a negative net for a non-negative gross', () => {
    for (let gross = 0; gross <= 500; gross++) {
      expect(splitGross(gross).net).toBeGreaterThanOrEqual(0);
    }
  });

  it('handles zero without producing NaN or negative dust', () => {
    expect(splitGross(0)).toEqual({ gross: 0, fee: 0, tax: 0, net: 0 });
  });
});

describe('netOf vs the old `Math.round(rate * 0.85)`', () => {
  // The reason this module exists. The two formulas are DIFFERENT
  // FUNCTIONS: rounding fee and tax separately is not the same as rounding
  // their combined complement. Every "net to you" preview in the product
  // used the second form while the release path used the first, so a
  // creator could be quoted one number and paid another.
  it('disagrees with the old multiplier at a known rounding boundary', () => {
    // gross 10: fee round(1.0)=1, tax round(0.5)=1 -> net 8
    //           old preview: round(10 * 0.85) = round(8.5) = 9
    expect(netOf(10)).toBe(8);
    expect(Math.round(10 * 0.85)).toBe(9);
    expect(netOf(10)).not.toBe(Math.round(10 * 0.85));
  });

  it('the disagreement is real across the range, not a one-off', () => {
    let divergences = 0;
    for (let gross = 1; gross <= 2000; gross++) {
      if (netOf(gross) !== Math.round(gross * (1 - PLATFORM_FEE - WHT))) divergences++;
    }
    // Documented, not asserted as an exact figure: the point is that this
    // is common enough to have mattered, not that it equals some number.
    expect(divergences).toBeGreaterThan(0);
  });

  it('always agrees with an explicit split, by construction', () => {
    for (let gross = 0; gross <= 1000; gross++) {
      const s = splitGross(gross);
      expect(netOf(gross)).toBe(gross - s.fee - s.tax);
    }
  });
});

describe('slotGross', () => {
  it('sums to the full rate so nothing is stranded in escrow', () => {
    for (const rate of [0, 1, 7, 100, 999, 1500, 3333]) {
      for (const slots of [1, 2, 3, 4, 7]) {
        let total = 0;
        for (let i = 0; i < slots; i++) total += slotGross(rate, slots, i);
        expect(total).toBe(rate);
      }
    }
  });

  it('gives the whole rate to a single-slot collab', () => {
    expect(slotGross(1500, 1, 0)).toBe(1500);
  });

  it('puts the rounding remainder on the last slot', () => {
    // 999 / 4 -> 249, 249, 249, 252
    expect(slotGross(999, 4, 0)).toBe(249);
    expect(slotGross(999, 4, 3)).toBe(252);
  });

  it('gives an unresolvable slot (-1) the conservative base share', () => {
    // Under-releasing leaves money in escrow, which is recoverable.
    // Over-releasing is not.
    expect(slotGross(999, 4, -1)).toBe(249);
  });
});

describe('splitAcrossSlots', () => {
  it('matches the sum of the per-slot releases, not a single-pass split', () => {
    // The bug this replaces: contracts stored a one-pass split of the whole
    // rate while money actually moved per slot with independent rounding.
    const rate = 999;
    const slots = 4;

    let fee = 0, tax = 0, net = 0;
    for (let i = 0; i < slots; i++) {
      const part = splitGross(slotGross(rate, slots, i));
      fee += part.fee; tax += part.tax; net += part.net;
    }

    const stored = splitAcrossSlots(rate, slots);
    expect(stored.fee).toBe(fee);
    expect(stored.tax).toBe(tax);
    expect(stored.net).toBe(net);
    expect(stored.fee + stored.tax + stored.net).toBe(rate);
  });

  it('differs from a single-pass split where rounding makes it differ', () => {
    const onePass = splitGross(999);
    const perSlot = splitAcrossSlots(999, 4);
    expect(perSlot.net).not.toBe(onePass.net);
  });

  it('equals a single-pass split when there is one slot', () => {
    expect(splitAcrossSlots(1500, 1)).toEqual(splitGross(1500));
  });

  it('treats a zero slot count as one slot rather than dividing by zero', () => {
    expect(splitAcrossSlots(500, 0)).toEqual(splitGross(500));
  });
});
