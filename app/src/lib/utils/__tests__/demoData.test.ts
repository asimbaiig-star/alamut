// demoData.test.ts — demo/real discrimination (audit F19).
//
// The load-bearing invariant: `deterministicUserId()` is the ONLY source
// of `u_x_`-prefixed user ids, and no seeded user uses that prefix. If a
// future seed change breaks that, the badge silently stops appearing on
// demo content (or worse, starts appearing on real users) — so the seed
// itself is asserted against here, not just the predicate.

import { describe, it, expect } from 'vitest';
import {
  isRealUserId, isDemoBrand, isDemoCreator, isDemoCampaign, REAL_USER_ID_PREFIX,
} from '../demoData';
import { SEED } from '@/lib/api/seed';

describe('isRealUserId', () => {
  it('accepts ids produced by deterministicUserId', () => {
    // FNV-1a base36 output, e.g. the id a real signup gets.
    expect(isRealUserId('u_x_7ajkq49om7hy')).toBe(true);
  });

  it('rejects seeded and generated seed user ids', () => {
    ['u_sarah', 'u_hannah', 'u_admin', 'u_gc07', 'u_gb12', 'u_pend_3'].forEach((id) => {
      expect(isRealUserId(id)).toBe(false);
    });
  });

  it('rejects empty / missing ids', () => {
    expect(isRealUserId(undefined)).toBe(false);
    expect(isRealUserId('')).toBe(false);
  });
});

describe('entity predicates', () => {
  it('flags brands and creators with no real owner as demo', () => {
    expect(isDemoBrand({ userId: 'u_hannah' })).toBe(true);
    expect(isDemoBrand({ userId: 'u_x_abc1234' })).toBe(false);
    expect(isDemoCreator({ userId: 'u_gc03' })).toBe(true);
    expect(isDemoCreator({ userId: 'u_x_abc1234' })).toBe(false);
  });

  it('resolves campaign ownership through the brand', () => {
    const brands = [
      { id: 'b_aesop', userId: 'u_hannah' },
      { id: 'b_real', userId: 'u_x_abc1234' },
    ];
    expect(isDemoCampaign({ brandId: 'b_aesop' }, brands)).toBe(true);
    expect(isDemoCampaign({ brandId: 'b_real' }, brands)).toBe(false);
  });

  it('treats an unresolvable brand as demo (fail safe)', () => {
    expect(isDemoCampaign({ brandId: 'b_missing' }, [])).toBe(true);
  });
});

describe('the seed itself upholds the invariant', () => {
  it('has no user whose id collides with the real-account prefix', () => {
    const colliding = SEED.users.filter((u) => u.id.startsWith(REAL_USER_ID_PREFIX));
    expect(colliding.map((u) => u.id)).toEqual([]);
  });

  it('classifies every seeded brand, creator and campaign as demo', () => {
    const db = SEED;
    expect(db.brands.length).toBeGreaterThan(0);
    expect(db.brands.every((b) => isDemoBrand(b))).toBe(true);
    expect(db.creators.every((c) => isDemoCreator(c))).toBe(true);
    expect(db.campaigns.every((c) => isDemoCampaign(c, db.brands))).toBe(true);
  });
});
