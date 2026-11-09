// campaignsExtraColumns.test.ts — reads and writes work before and after 043.
//
// Selecting or inserting a column the database doesn't have fails the
// whole request. Before the migration runs, asking for per_creator would
// empty the marketplace and stop every launch being saved. The repo asks
// once, and on "column does not exist" carries on without it.
import { describe, it, expect, vi, beforeEach } from 'vitest';

const calls: { table: string; cols: string; inserted?: Record<string, unknown> }[] = [];
let HAS_COLUMN = false;
const missing = { code: '42703', message: 'column campaigns.per_creator does not exist' };

function builder(table: string) {
  let inserted: Record<string, unknown> | undefined;
  const api = {
    insert(row: Record<string, unknown>) { inserted = row; return api; },
    select(cols: string) {
      calls.push({ table, cols, inserted });
      const bad = (!HAS_COLUMN && cols.includes('per_creator')) || (!HAS_COLUMN && inserted && 'per_creator' in inserted);
      const res = bad ? { data: null, error: missing } : { data: inserted ? { ...inserted, version: 1, created_at: 'x', updated_at: 'x' } : [], error: null };
      const p = Promise.resolve(res) as Promise<typeof res> & { single: () => Promise<typeof res>; eq: () => unknown };
      p.single = () => Promise.resolve(res);
      return p;
    },
  };
  return api;
}

vi.mock('@/lib/supabase', () => ({
  isSupabaseConfigured: () => true,
  getSupabase: () => ({ from: (t: string) => builder(t) }),
}));

import { readCampaignsInFull, readPublicCampaigns, insertCampaignInSupabase, resetExtraColumnsProbe } from '../campaignsRepo';
import { buildCampaign } from '@/lib/utils/__tests__/fixtures';

beforeEach(() => { calls.length = 0; resetExtraColumnsProbe(); });

describe('before 043', () => {
  beforeEach(() => { HAS_COLUMN = false; });
  it('reads still return rows, asking again without the column', async () => {
    expect((await readCampaignsInFull()).status).toBe('ok');
    expect(calls.map((c) => c.cols.includes('per_creator'))).toEqual([true, false]);
    // And it remembers: the next read doesn't ask twice.
    expect((await readPublicCampaigns()).status).toBe('ok');
    expect(calls.slice(2).map((c) => c.cols.includes('per_creator'))).toEqual([false]);
  });
  it('a launch is still saved, without the target', async () => {
    const saved = await insertCampaignInSupabase(buildCampaign({ id: 'cmp_n', perCreator: 2500 }));
    expect(saved.id).toBe('cmp_n');
    expect(calls.at(-1)!.inserted).not.toHaveProperty('per_creator');
  });
});

describe('after 043', () => {
  beforeEach(() => { HAS_COLUMN = true; });
  it('the target is written and read back', async () => {
    const saved = await insertCampaignInSupabase(buildCampaign({ id: 'cmp_n', perCreator: 2500 }));
    expect(calls[0].inserted).toHaveProperty('per_creator', 2500);
    expect(saved.perCreator).toBe(2500);
  });
});
