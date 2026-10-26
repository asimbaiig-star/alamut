// channels.test.ts — a creator with no channels must not break a screen.
//
// Found 2026-10-26: two real accounts with no channels reached Discover once
// 038's public projection returned rows, and every brand's Discover crashed
// on `topChannel.engagement` (`reduce(…, channels[0])` returns undefined for
// an empty list). Averages divided by `channels.length` rendered NaN.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { avgEngagement, bestEngagement, topChannel } from '../channels';
import type { V2Channel } from '../data';

const ch = (followers: number, engagement: number, platform: V2Channel['platform'] = 'instagram'): V2Channel =>
  ({ platform, handle: 'h', followers, engagement });

describe('channel summaries', () => {
  it('handle a creator with no channels', () => {
    expect(topChannel([])).toBeNull();
    expect(avgEngagement([])).toBe(0);
    expect(bestEngagement([])).toBe(0);
  });

  it('pick the biggest channel, as Discover did before', () => {
    const a = ch(10, 4, 'instagram'); const b = ch(30, 2, 'tiktok'); const c = ch(20, 9, 'youtube');
    expect(topChannel([a, b, c])).toBe(b);
    expect(topChannel([a])).toBe(a);
  });

  it('average and best engagement', () => {
    expect(avgEngagement([ch(1, 4), ch(1, 6)])).toBe(5);
    expect(bestEngagement([ch(1, 4), ch(1, 6)])).toBe(6);
  });
});

describe('screens summarise channels through the safe helpers', () => {
  const src = (rel: string) => readFileSync(join(__dirname, '..', rel), 'utf8');
  const files = ['screens/Discover.tsx', 'screens/Spark.tsx', 'sparkEngine.ts'];

  it('no screen seeds a reduce with channels[0] or divides by channels.length', () => {
    for (const f of files) {
      const s = src(f);
      expect(s, f).not.toMatch(/channels\.reduce\([\s\S]{0,80}channels\[0\]/);
      expect(s, f).not.toMatch(/\/\s*\w+\.channels\.length/);
      expect(s, f).not.toMatch(/Math\.max\(\.\.\.\w+\.channels\.map/);
    }
  });
});
