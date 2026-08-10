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

// =====================================================================
// Demo pre-verification (seed.ts) — the safety property
// =====================================================================
//
// Seeded demo accounts are pre-verified so the showcase looks coherent.
// The pass is gated on isDemoCreator/isDemoBrand, and these tests pin the
// property that actually matters: it can only ever touch seeded rows. If
// someone widens the gate, or the real-user prefix drifts, this fails.

describe('SEED demo pre-verification', () => {
  it('marks every seeded creator verified, including their channels', () => {
    const demo = SEED.creators.filter((c) => isDemoCreator(c));
    expect(demo.length).toBeGreaterThan(50); // the seeded network
    demo.forEach((c) => {
      expect(c.verified).toBe(true);
      expect(c.kycVerifiedAt).toBeTruthy();
      (c.platforms ?? []).forEach((p) => {
        expect(p.verified).toBe(true);
      });
    });
  });

  it("verifies Sarah's newsletter, which the raw seed left unverified", () => {
    const sarah = SEED.creators.find((c) => c.id === 'c_sarah')!;
    const newsletter = sarah.platforms.find((p) => p.name === 'Newsletter')!;
    expect(newsletter.verified).toBe(true);
  });

  it('marks every seeded brand verified', () => {
    SEED.brands.filter((b) => isDemoBrand(b)).forEach((b) => {
      expect(b.verified).toBe(true);
    });
  });

  it('never touches a real account — the whole safety property', () => {
    // No row carrying the real-user prefix may appear in the seed at all,
    // so the pass has nothing real to reach. This is the invariant that
    // keeps "pre-verified demo data" from ever meaning "verified stranger".
    const realCreators = SEED.creators.filter((c) => !isDemoCreator(c));
    const realBrands = SEED.brands.filter((b) => !isDemoBrand(b));
    expect(realCreators).toEqual([]);
    expect(realBrands).toEqual([]);
  });
});
