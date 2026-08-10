// rateGuidance.test.ts — in-app fair-rate band (T3.1).

import { describe, it, expect } from 'vitest';
import { suggestRateBand, hasRateBenchmark } from '../rateGuidance';

describe('suggestRateBand — only speaks when it can', () => {
  it('returns null for platforms with no published benchmark', () => {
    // The wizard offers LinkedIn / X / Newsletter, but only three platforms
    // have a benchmark. Inventing a band for the rest would be exactly the
    // habit this whole pass is removing.
    ['linkedin', 'x', 'newsletter'].forEach((p) => {
      expect(suggestRateBand(p, 50_000, 4)).toBeNull();
      expect(hasRateBenchmark(p)).toBe(false);
    });
  });

  it('returns null when followers are missing or nonsensical', () => {
    expect(suggestRateBand('instagram', 0, 4)).toBeNull();
    expect(suggestRateBand('instagram', -100, 4)).toBeNull();
    expect(suggestRateBand('instagram', NaN, 4)).toBeNull();
  });

  it('produces a band for the benchmarked platforms', () => {
    ['instagram', 'tiktok', 'youtube'].forEach((p) => {
      expect(hasRateBenchmark(p)).toBe(true);
      expect(suggestRateBand(p, 50_000, 4)).not.toBeNull();
    });
  });
});

describe('suggestRateBand — the numbers behave sensibly', () => {
  it('orders low < median < high', () => {
    const b = suggestRateBand('instagram', 50_000, 3)!;
    expect(b.low).toBeLessThan(b.median);
    expect(b.median).toBeLessThan(b.high);
  });

  it('scales with audience size', () => {
    const small = suggestRateBand('instagram', 10_000, 3)!;
    const large = suggestRateBand('instagram', 200_000, 3)!;
    expect(large.median).toBeGreaterThan(small.median);
  });

  it('rewards higher engagement at the same audience size', () => {
    const low = suggestRateBand('instagram', 50_000, 1)!;
    const high = suggestRateBand('instagram', 50_000, 8)!;
    expect(high.median).toBeGreaterThan(low.median);
  });

  it('clamps absurd engagement so a typo cannot produce a silly rate', () => {
    // Someone entering "90" (meaning 9.0%) shouldn't get a 30x rate.
    const sane = suggestRateBand('instagram', 50_000, 8)!;
    const typo = suggestRateBand('instagram', 50_000, 90)!;
    expect(typo.median).toBeLessThanOrEqual(sane.median * 2);
  });

  it('names the platform it computed for', () => {
    expect(suggestRateBand('tiktok', 50_000, 5)!.platform).toBe('TikTok');
  });

  it('returns whole currency numbers, not fractions', () => {
    const b = suggestRateBand('youtube', 33_333, 3.7)!;
    [b.low, b.median, b.high].forEach((n) => expect(Number.isInteger(n)).toBe(true));
  });
});
