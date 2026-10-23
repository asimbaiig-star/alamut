// hydration.test.ts — hydrateFromSupabase under more than one identity.
//
// It now runs at page load AND on every sign-in, so two runs can overlap: the
// signed-out boot fetch is often still in flight when the visitor clicks a
// demo button. Whichever run finishes last must not decide what the store
// holds — the newest identity's must.

import { describe, it, expect, vi, beforeEach } from 'vitest';

type Gate = { table: string; who: string | null; resolve: (rows: unknown[]) => void };
const h = vi.hoisted(() => ({
  email: null as string | null,
  gates: [] as Gate[],
  calls: [] as string[],
}));

vi.mock('@/lib/supabase', () => {
  const client = {
    from: (table: string) => {
      const who = h.email; // identity at the moment the request was issued
      const settle = () => new Promise((res) => {
        h.calls.push(`${who}:${table}`);
        if (table === 'brands_public') {
          h.gates.push({ table, who, resolve: (rows) => res({ data: rows, error: null }) });
        } else {
          res({ data: [], error: null });
        }
      });
      // Any chained filter (.select / .eq / .order / …) returns the builder;
      // awaiting it settles. A fixed method list missed `.order`, every run
      // threw, and one test here passed without hydration ever applying.
      const builder: object = new Proxy({}, {
        get: (_t, prop) => {
          if (prop === 'then') {
            return (ok: (v: unknown) => unknown, bad: (e: unknown) => unknown) => settle().then(ok, bad);
          }
          if (prop === 'maybeSingle' || prop === 'single') {
            return async () => ({ data: null, error: null });
          }
          return () => builder;
        },
      });
      return builder;
    },
    channel: () => {
      const ch = { on: () => ch, subscribe: () => ch, unsubscribe: () => undefined };
      return ch;
    },
    auth: {
      getSession: async () => ({
        data: { session: h.email ? { user: { email: h.email } } : null },
      }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => undefined } } }),
    },
  };
  return { isSupabaseConfigured: () => true, getSupabase: () => client };
});

import { hydrateFromSupabase, getHydratedIdentity, useStore } from '@/lib/api/store';

const aesopRow = (name: string) => ({
  id: 'b_aesop', user_id: 'u_hannah', name, industry: 'Beauty', hq: 'Melbourne',
  website: 'aesop.com', about: '', logo_mark: null, logo_url: null,
  preferred_categories: [], preferred_regions: [], verified: true,
  saved_creators: [], social_platforms: null, version: 3,
});
const gateFor = (who: string | null) => h.gates.find((g) => g.who === who);
const aesop = () => useStore.getState().db.brands.find((b) => b.id === 'b_aesop')!;

describe('hydrateFromSupabase', () => {
  beforeEach(() => {
    h.gates.length = 0;
    h.calls.length = 0;
  });

  it('a superseded run cannot overwrite the newer identity\'s data', async () => {
    h.email = null; // the page loads signed out
    const boot = hydrateFromSupabase();
    await vi.waitFor(() => expect(gateFor(null)).toBeDefined());

    h.email = 'hannah@aesop.test'; // the visitor signs in mid-flight
    const signedIn = hydrateFromSupabase();
    await vi.waitFor(() => expect(gateFor('hannah@aesop.test')).toBeDefined());
    expect(getHydratedIdentity()).toBe('hannah@aesop.test');

    // The signed-in run lands first…
    gateFor('hannah@aesop.test')!.resolve([aesopRow('As Hannah sees it')]);
    await signedIn;
    // …then the stale signed-out run. It must be discarded, not applied.
    gateFor(null)!.resolve([aesopRow('Signed-out snapshot')]);
    await boot;

    expect(aesop().name).toBe('As Hannah sees it');
  });

  it('a second call for the identity already loading joins that run', async () => {
    h.email = 'sarah@alamut.test';
    const a = hydrateFromSupabase();
    const b = hydrateFromSupabase();
    await vi.waitFor(() => expect(gateFor('sarah@alamut.test')).toBeDefined());
    gateFor('sarah@alamut.test')!.resolve([]);
    await Promise.all([a, b]);
    expect(h.calls.filter((c) => c === 'sarah@alamut.test:brands_public')).toHaveLength(1);
  });

  it('keeps brand fields that have no column in Postgres', async () => {
    // toBrand never sets offerTemplates / preferredCreatorTier /
    // monthlyBudgetBand, so a whole-row replace erased them on every load.
    expect(aesop().offerTemplates?.length, 'seed precondition').toBeGreaterThan(0);
    const before = aesop().offerTemplates;
    h.email = 'hannah@aesop.test';
    const run = hydrateFromSupabase();
    await vi.waitFor(() => expect(gateFor('hannah@aesop.test')).toBeDefined());
    gateFor('hannah@aesop.test')!.resolve([aesopRow('Aesop — from Postgres')]);
    await run;
    // A value only the remote row carries, so this cannot pass on the seed.
    expect(aesop().name).toBe('Aesop — from Postgres'); // remote fields win…
    expect(aesop().offerTemplates).toEqual(before);    // …local-only ones survive
  });
});
