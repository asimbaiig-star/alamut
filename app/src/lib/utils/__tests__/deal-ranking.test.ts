// Tests for rankDeals — splits actionable vs passive and sorts each.

import { describe, it, expect } from 'vitest';
import { rankDeals, type RankableDeal } from '@/lib/utils/deal-ranking';
import type { DealAction } from '@/lib/utils/deal-action';

function deal(
  id: string,
  actor: DealAction['actor'],
  urgency: number,
  reason = '',
): RankableDeal<{ id: string }> {
  return {
    payload: { id },
    state: 'applied',
    action: { actor, kind: 'none', urgency, reason },
  };
}

describe('rankDeals — actor split', () => {
  it("puts actor='me' deals into actionable", () => {
    const r = rankDeals([deal('a', 'me', 100)], 'creator');
    expect(r.actionable.map((d) => d.payload.id)).toEqual(['a']);
    expect(r.passive).toEqual([]);
  });

  it("puts actor='them' deals into passive", () => {
    const r = rankDeals([deal('a', 'them', 5)], 'creator');
    expect(r.passive.map((d) => d.payload.id)).toEqual(['a']);
    expect(r.actionable).toEqual([]);
  });

  it("puts actor='neither' (terminal) deals into passive", () => {
    const r = rankDeals([deal('a', 'neither', 0)], 'creator');
    expect(r.passive.map((d) => d.payload.id)).toEqual(['a']);
    expect(r.actionable).toEqual([]);
  });
});

describe('rankDeals — actionable sort', () => {
  it('sorts actionable by urgency descending', () => {
    const r = rankDeals(
      [
        deal('low', 'me', 50),
        deal('high', 'me', 1000),
        deal('mid', 'me', 350),
      ],
      'brand',
    );
    expect(r.actionable.map((d) => d.payload.id)).toEqual(['high', 'mid', 'low']);
  });

  it('breaks ties stably using the reason string', () => {
    const r = rankDeals(
      [
        deal('a', 'me', 100, 'Zebra'),
        deal('b', 'me', 100, 'Apple'),
        deal('c', 'me', 100, 'Mango'),
      ],
      'brand',
    );
    // Same urgency → alphabetical by reason.
    expect(r.actionable.map((d) => d.payload.id)).toEqual(['b', 'c', 'a']);
  });

  it('handles empty input', () => {
    const r = rankDeals([], 'creator');
    expect(r.actionable).toEqual([]);
    expect(r.passive).toEqual([]);
  });
});

describe('rankDeals — passive sort', () => {
  it('sorts passive by urgency descending', () => {
    const r = rankDeals(
      [
        deal('terminal', 'neither', 0, 'Closed'),
        deal('recent', 'them', 50, 'Just uploaded'),
        deal('older', 'them', 10, 'Awaiting'),
      ],
      'brand',
    );
    expect(r.passive.map((d) => d.payload.id)).toEqual(['recent', 'older', 'terminal']);
  });
});

describe('rankDeals — mixed split', () => {
  it('correctly partitions and orders mixed inputs', () => {
    const r = rankDeals(
      [
        deal('disputed', 'me', 1000),
        deal('produce', 'them', 5),
        deal('approve', 'me', 600),
        deal('closed', 'neither', 0),
        deal('shortlist', 'me', 100),
      ],
      'brand',
    );
    expect(r.actionable.map((d) => d.payload.id)).toEqual(['disputed', 'approve', 'shortlist']);
    expect(r.passive.map((d) => d.payload.id)).toEqual(['produce', 'closed']);
  });

  it('preserves payload identity across the rank', () => {
    const inputs = [deal('x', 'me', 100), deal('y', 'them', 50)];
    const r = rankDeals(inputs, 'creator');
    expect(r.actionable[0].payload).toBe(inputs[0].payload);
    expect(r.passive[0].payload).toBe(inputs[1].payload);
  });
});
