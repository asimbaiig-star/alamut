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

describe('avgEngagement is weighted by followers', () => {
  it('a small newsletter does not swamp a large social channel', () => {
    // 142K at 5.2%, 58K at 7.1%, 8.4K at 42%: the plain mean said 18.1%.
    const chans = [
      { engagement: 5.2, followers: 142_000 },
      { engagement: 7.1, followers: 58_000 },
      { engagement: 42, followers: 8_400 },
    ];
    expect(+avgEngagement(chans as never).toFixed(1)).toBe(7.2);
  });

  it('is the one way engagement is averaged: no screen does its own mean', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { readdirSync, readFileSync } = require('node:fs') as typeof import('node:fs');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { join } = require('node:path') as typeof import('node:path');
    const dir = join(__dirname, '..', 'screens');
    for (const f of readdirSync(dir).filter((x: string) => x.endsWith('.tsx'))) {
      expect(readFileSync(join(dir, f), 'utf8'), f).not.toMatch(/\.engagement,\s*0\)\s*\//);
    }
  });
});
