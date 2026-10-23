// @vitest-environment jsdom
// realtimeProjection.test.ts — live campaign updates after migration 039.
//
// The raw `campaigns` channel now reaches only a campaign's own parties, so
// everyone else follows the marketplace through `campaigns_public`. Its rows
// have no private fields and must merge, not replace. And for a campaign the
// session reads in full it must stand aside: a projection event applied
// first, at the same version, makes the raw event look stale — and the
// owner silently loses its spent / escrow update.

import { describe, it, expect, vi, beforeAll } from 'vitest';

const h = vi.hoisted(() => ({
  handlers: {} as Record<string, (payload: unknown) => Promise<void>>,
}));

vi.mock('@/lib/supabase', () => {
  const channel = {
    on: (_kind: string, filter: { table: string }, cb: (p: unknown) => Promise<void>) => {
      h.handlers[filter.table] = cb;
      return channel;
    },
    subscribe: () => channel,
    unsubscribe: () => undefined,
  };
  return {
    isSupabaseConfigured: () => true,
    getSupabase: () => ({
      channel: () => channel,
      // The store's boot hydration runs on import in jsdom; give it nothing.
      from: () => {
        const b: object = new Proxy({}, { get: (_t, p) => p === 'then'
          ? (ok: (v: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(ok)
          : () => b });
        return b;
      },
      auth: { getSession: async () => ({ data: { session: null } }) },
    }),
  };
});

import { mountWorkflowRealtime } from '@/lib/api/realtimeWorkflow';
import { useStore } from '@/lib/api/store';
import { recordFullAccessCampaigns } from '@/lib/data/campaignsRepo';

const projectionRow = (id: string, version: number, title: string) => ({
  id, brand_id: 'b_aesop', title, pitch: '', brief: '', cover: '', budget: 18000, region: '',
  category: null, stage: 'live', deliverables_text: '', deliverable_ids: [], deadline: '',
  posted_at: null, reach: null, engagement: null, applications: [], offers: [], rights: null,
  kind: null, editors_pick: null, assets: [], version, created_at: '2026-01-01', updated_at: '2026-01-02',
});
const campaign = (id: string) => useStore.getState().db.campaigns.find((c) => c.id === id)!;
const fire = (payload: unknown) => h.handlers['campaigns_public'](payload);

describe('the campaigns_public realtime channel', () => {
  beforeAll(() => {
    mountWorkflowRealtime();
    expect(h.handlers['campaigns_public'], 'no campaigns_public subscription').toBeTypeOf('function');
  });

  // Seed campaigns carry no `version` (only Postgres rows do), so these
  // tests use explicit ones rather than `before.version + 1` — which is NaN,
  // and `NaN <= NaN` is false, so a stale event would look fresh.
  it('merges a public update without erasing private fields', async () => {
    recordFullAccessCampaigns([]);
    const before = campaign('cmp_1');
    expect(before.escrowHeld, 'seed precondition').toBe(5400);
    await fire({ new: projectionRow('cmp_1', 5, 'Renamed live') });
    expect(campaign('cmp_1').title).toBe('Renamed live');
    expect(campaign('cmp_1').escrowHeld).toBe(5400);
    expect(campaign('cmp_1').history.length).toBe(before.history.length);
  });

  it('stands aside for a campaign this session reads in full', async () => {
    recordFullAccessCampaigns(['cmp_3']);
    const before = campaign('cmp_3');
    await fire({ new: projectionRow('cmp_3', 5, 'Should not land') });
    expect(campaign('cmp_3').title).toBe(before.title);
    expect(campaign('cmp_3').version).toBe(before.version);
  });

  it('ignores an event older than what the store holds', async () => {
    recordFullAccessCampaigns([]);
    expect(campaign('cmp_1').version, 'precondition: the first test landed v5').toBe(5);
    await fire({ new: projectionRow('cmp_1', 5, 'Same version') });
    await fire({ new: projectionRow('cmp_1', 4, 'Older version') });
    expect(campaign('cmp_1').title).toBe('Renamed live');
    await fire({ new: projectionRow('cmp_1', 6, 'Newer version') });
    expect(campaign('cmp_1').title).toBe('Newer version');
  });

  it('skips DELETE events, like every workflow table', async () => {
    const n = useStore.getState().db.campaigns.length;
    await fire({ new: {}, old: { id: 'cmp_1' } });
    expect(useStore.getState().db.campaigns.length).toBe(n);
    expect(campaign('cmp_1')).toBeDefined();
  });
});
