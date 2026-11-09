// campaignTarget.test.ts — one answer to "what does this brand pay a creator".
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { perCreatorTarget, campaignPlaces, hasOwnTarget } from '../campaignTarget';

const V2 = join(__dirname, '..');

describe('perCreatorTarget', () => {
  it("uses the brand's own target when the campaign kept it", () => {
    expect(perCreatorTarget({ budget: 9000, perCreator: 2250, creators: [] })).toBe(2250);
    expect(hasOwnTarget({ budget: 9000, perCreator: 2250 })).toBe(true);
  });
  it('falls back to the budget split four ways, or across everyone booked when more', () => {
    expect(perCreatorTarget({ budget: 3000, creators: [] })).toBe(750);
    expect(perCreatorTarget({ budget: 3000, creators: [1, 2] })).toBe(750);
    expect(perCreatorTarget({ budget: 3000, creators: [1, 2, 3, 4, 5, 6] })).toBe(500);
    expect(hasOwnTarget({ budget: 3000 })).toBe(false);
  });
});

describe('campaignPlaces', () => {
  it('is how many the budget covers at the target, never fewer than booked', () => {
    expect(campaignPlaces({ budget: 9000, perCreator: 2250, creators: [] })).toBe(4);
    expect(campaignPlaces({ budget: 9000, perCreator: 2000, creators: [] })).toBe(4);
    expect(campaignPlaces({ budget: 1000, perCreator: 2000, creators: [1, 2] })).toBe(2);
    expect(campaignPlaces({ budget: 3000, creators: [] })).toBe(4);
  });
});

describe('one definition', () => {
  it('no screen divides a budget into a per-creator target by itself', () => {
    // The home said one target and the campaign page another, because five
    // files each did their own sum. They all go through campaignTarget.ts.
    const files = [
      'needsYou.ts',
      ...readdirSync(join(V2, 'screens')).filter((f) => f.endsWith('.tsx')).map((f) => `screens/${f}`),
    ];
    for (const f of files) {
      // The wizard's "≈ N creators at this rate" divides by the rate the
      // brand is typing, which is the inverse sum, not a target.
      if (f.endsWith('NewCampaignWizard.tsx')) continue;
      const src = readFileSync(join(V2, f), 'utf8');
      expect(src, f).not.toMatch(/budget\s*\/\s*Math\.max\(/);
    }
  });
});
