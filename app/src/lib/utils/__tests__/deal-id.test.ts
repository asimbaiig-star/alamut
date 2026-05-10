// Tests for deal-id encode/decode.

import { describe, it, expect } from 'vitest';
import { encodeDealId, decodeDealId } from '@/lib/utils/deal-id';

describe('encodeDealId', () => {
  it('joins campaign + creator with the `--` separator', () => {
    expect(encodeDealId('cmp_g0', 'cr_3')).toBe('cmp_g0--cr_3');
  });

  it('preserves underscores within the source ids', () => {
    expect(encodeDealId('cmp_alpha_beta', 'cr_x_y')).toBe('cmp_alpha_beta--cr_x_y');
  });

  it('handles empty strings (caller responsibility, but should not crash)', () => {
    expect(encodeDealId('', '')).toBe('--');
  });
});

describe('decodeDealId', () => {
  it('round-trips an encoded id', () => {
    const slug = encodeDealId('cmp_g0', 'cr_3');
    expect(decodeDealId(slug)).toEqual({ campaignId: 'cmp_g0', creatorId: 'cr_3' });
  });

  it('returns null for undefined input (router missing param)', () => {
    expect(decodeDealId(undefined)).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(decodeDealId('')).toBeNull();
  });

  it('returns null when separator is missing entirely', () => {
    expect(decodeDealId('cmp_g0_cr_3')).toBeNull();
  });

  it('returns null when separator is at the very start (empty campaign)', () => {
    expect(decodeDealId('--cr_3')).toBeNull();
  });

  it('returns null when separator is at the very end (empty creator)', () => {
    expect(decodeDealId('cmp_g0--')).toBeNull();
  });

  it('handles ids that contain a single dash without false-matching it', () => {
    // Single dash should not split — only the double-dash separator.
    // (Our IDs don't actually have single dashes, but this verifies
    // the indexOf logic doesn't trip on adjacent characters.)
    expect(decodeDealId('cmp-g0-cr-3')).toBeNull();
  });

  it('handles ids that contain the separator inside the campaign part', () => {
    // The decoder uses indexOf — first `--` wins. So if a campaign id
    // (mock-only) contained `--`, the creator side would absorb the rest.
    // Documents the current behaviour; not a real scenario in the seed.
    const decoded = decodeDealId('cmp--weird--cr_3');
    expect(decoded).toEqual({ campaignId: 'cmp', creatorId: 'weird--cr_3' });
  });
});
