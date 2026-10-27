// estimate.test.ts — the landing's numbers are the product's numbers.
//
// The old pages quoted a 5% fee against a PLATFORM_FEE of 0.10. These pin
// the landing to the product by identity (facts.ts re-exports, it doesn't
// copy) and by behaviour (each calculator agrees with the ledger maths for
// every rounding case the slots produce).

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as money from '@/lib/api/money';
import * as options from '@/lib/api/marketplaceOptions';
import { STALENESS } from '@/lib/api/staleness';
import * as facts from '../facts';
import { brandEstimate, clampMoney, creatorEstimate, usd } from '../estimate';
import { toHandle } from '../tools-creators';
import { BRIEFS, BRIEF_FILTERS, CREATORS, CREATOR_FILTERS } from '../listings';

const SRC = join(__dirname, '..', '..');
const read = (rel: string) => readFileSync(join(SRC, rel), 'utf8');

const RATES = [0, 1, 7, 99, 250, 999, 1000, 1800, 12_345, 999_999];

describe('facts.ts re-exports the product, it does not restate it', () => {
  it('fees, labels and split maths are the same objects as money.ts', () => {
    expect(facts.PLATFORM_FEE).toBe(money.PLATFORM_FEE);
    expect(facts.WHT).toBe(money.WHT);
    expect(facts.PLATFORM_FEE_LABEL).toBe(money.PLATFORM_FEE_LABEL);
    expect(facts.WHT_LABEL).toBe(money.WHT_LABEL);
    expect(facts.splitAcrossSlots).toBe(money.splitAcrossSlots);
    expect(facts.slotGross).toBe(money.slotGross);
  });

  it('the lapse window is the scheduler’s', () => {
    expect(facts.APPLICATION_LAPSE_DAYS).toBe(STALENESS.applicationLapseDays);
  });

  it('the builders offer exactly what the product offers', () => {
    expect(facts.PLATFORM_FORMATS).toBe(options.PLATFORM_FORMATS);
    expect(facts.CREATOR_CATEGORIES).toBe(options.CREATOR_CATEGORIES);
    // …and the product reads the same lists, rather than a copy that drifts.
    const wizard = read('screens/workspace-v2/screens/NewCampaignWizard.tsx');
    expect(wizard).toMatch(/import \{ PLATFORM_FORMATS \} from '@\/lib\/api\/marketplaceOptions'/);
    expect(wizard).not.toMatch(/const PLATFORM_FORMATS/);
    const onboarding = read('screens/workspace-v2/screens/CreatorOnboardingV2.tsx');
    expect(onboarding).toMatch(/const CATEGORIES = CREATOR_CATEGORIES;/);
  });
});

describe('creatorEstimate agrees with the ledger', () => {
  it('for every rate and post count, rounding included', () => {
    for (const rate of RATES) {
      for (let posts = 1; posts <= 10; posts++) {
        const e = creatorEstimate(rate, posts);
        const split = money.splitAcrossSlots(rate, posts);
        expect(e.held).toBe(rate);
        expect(e.releases).toEqual(Array.from({ length: posts }, (_, i) => money.slotGross(rate, posts, i)));
        // Every dollar held is released — none lost to per-slot rounding.
        expect(e.releases.reduce((a, b) => a + b, 0)).toBe(rate);
        expect([e.fee, e.tax, e.net]).toEqual([split.fee, split.tax, split.net]);
      }
    }
  });

  it('clamps what a visitor can type', () => {
    expect(creatorEstimate(500, 0).releases).toHaveLength(1);
    expect(creatorEstimate(500, 99).releases).toHaveLength(10);
    expect(creatorEstimate(Number.NaN, 2).held).toBe(0);
  });
});

describe('brandEstimate agrees with the ledger', () => {
  it('holds rate × creators, releases per slot, charges the brand nothing', () => {
    for (const rate of RATES) {
      for (const creators of [1, 3, 50]) {
        for (const posts of [1, 3, 7]) {
          const e = brandEstimate(rate, creators, posts);
          expect(e.held).toBe(rate * creators);
          expect(e.perPost).toEqual(Array.from({ length: posts }, (_, i) => money.slotGross(rate, posts, i)));
          expect(e.brandFee).toBe(0);
          expect(e.perCreatorNet).toBe(money.splitAcrossSlots(rate, posts).net);
        }
      }
    }
  });

  it('clamps creators to the stepper’s range', () => {
    expect(brandEstimate(100, 500, 1).held).toBe(100 * 50);
    expect(brandEstimate(100, 0, 1).held).toBe(100);
  });
});

describe('input handling', () => {
  it('clampMoney keeps whole dollars between 0 and 1,000,000', () => {
    expect(clampMoney(Number.NaN)).toBe(0);
    expect(clampMoney(-5)).toBe(0);
    expect(clampMoney(1.6)).toBe(2);
    expect(clampMoney(2_000_000)).toBe(1_000_000);
  });

  it('usd formats whole dollars with separators', () => {
    expect(usd(0)).toBe('$0');
    expect(usd(1530)).toBe('$1,530');
    expect(usd(999_999.4)).toBe('$999,999');
  });

  it('toHandle makes something sign-up would accept', () => {
    expect(toHandle('Maya Chen')).toBe('mayachen');
    expect(toHandle('  Ana-María Ö! ')).toBe('anamara');
    expect(toHandle('dot.and_under')).toBe('dot.and_under');
    expect(toHandle('x'.repeat(40))).toHaveLength(24);
  });
});

describe('the example boards only offer what the product has', () => {
  it('brief and creator categories are the product’s categories', () => {
    for (const c of [...BRIEF_FILTERS.filter((f) => f !== 'All'), ...BRIEFS.map((b) => b.category), ...CREATORS.map((c) => c.category)]) {
      expect(options.CREATOR_CATEGORIES, c).toContain(c);
    }
  });

  it('platforms and formats are the product’s', () => {
    const labels = options.PLATFORM_FORMATS.map((p) => p.label);
    for (const p of [...CREATOR_FILTERS.filter((f) => f !== 'All'), ...CREATORS.flatMap((c) => c.channels.map((ch) => ch.platform))]) {
      expect(labels, p).toContain(p);
    }
    for (const d of BRIEFS.flatMap((b) => b.deliverables)) {
      const [, platform, format] = /^\d+ × (\S+) (.+)$/.exec(d) ?? [];
      const def = options.PLATFORM_FORMATS.find((p) => p.label === platform);
      expect(def, d).toBeDefined();
      expect(def!.formats.map((f) => f.label), d).toContain(format);
    }
  });

  it('describes brands, never names one', () => {
    for (const b of BRIEFS) expect(b.brand, b.brand).toMatch(/^An? /);
  });
});
