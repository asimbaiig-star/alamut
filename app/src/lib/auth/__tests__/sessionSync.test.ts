// @vitest-environment jsdom
// sessionSync.test.ts — signing in must re-fetch as the person who signed in.
//
// Hydration used to run once, at page load. Since migration 037 every table
// is gated on who is asking, so that one run is a snapshot of whoever was
// signed in at load — for a visitor arriving at /signin, nobody. Verified
// live before this fix: twelve seconds after the demo-button sign-in, Sarah's
// own contract was missing from the store and her home showed the seed
// balance, $33,143, instead of her real $4,200 until a manual refresh.

import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';

const h = vi.hoisted(() => ({
  hydratedFor: undefined as string | null | undefined,
  authCb: null as null | ((event: string, session: unknown) => void),
}));

vi.mock('@/lib/supabase', () => {
  // Any chained filter returns the builder; awaiting it yields no rows.
  const builder: object = new Proxy({}, {
    get: (_t, prop) => {
      if (prop === 'then') {
        return (ok: (v: unknown) => unknown, bad: (e: unknown) => unknown) =>
          Promise.resolve({ data: [], error: null }).then(ok, bad);
      }
      if (prop === 'maybeSingle' || prop === 'single') {
        return async () => ({ data: null, error: null });
      }
      return () => builder;
    },
  });
  const client = {
    from: () => builder,
    channel: () => {
      const ch = { on: () => ch, subscribe: () => ch, unsubscribe: () => undefined };
      return ch;
    },
    auth: {
      getSession: async () => ({ data: { session: null } }),
      onAuthStateChange: (cb: (event: string, session: unknown) => void) => {
        h.authCb = cb;
        return { data: { subscription: { unsubscribe: () => undefined } } };
      },
    },
  };
  return { isSupabaseConfigured: () => true, getSupabase: () => client };
});

vi.mock('@/lib/api/store', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/api/store')>();
  return {
    ...real,
    hydrateFromSupabase: vi.fn(async () => undefined),
    getHydratedIdentity: () => h.hydratedFor,
  };
});

import { mountSessionSync, needsRehydrate } from '@/lib/auth/sessionSync';
import { hydrateFromSupabase, useStore } from '@/lib/api/store';
import { recordRemoteCampaigns } from '@/lib/data/remoteRegistry';

const signIn = (email: string) => h.authCb!('SIGNED_IN', { user: { email } });

describe('signing in re-fetches as the person who signed in', () => {
  beforeAll(async () => {
    await mountSessionSync();
    expect(h.authCb, 'sessionSync never subscribed to auth changes').not.toBeNull();
  });
  beforeEach(() => {
    vi.mocked(hydrateFromSupabase).mockClear();
    useStore.getState().setSession(null);
  });

  it('the demo-button path re-fetches, though the local session already matches', () => {
    // The sign-in form sets the local session itself, so the handler's
    // "already matches, do nothing" early return is what every demo visitor
    // hits. That return is exactly where the re-fetch used to be skipped.
    h.hydratedFor = null; // the page loaded signed out
    useStore.getState().setSession({ userId: 'u_sarah', issuedAt: new Date().toISOString() });
    signIn('sarah@alamut.test');
    expect(hydrateFromSupabase).toHaveBeenCalledTimes(1);
  });

  it('switching accounts re-fetches as the new one', () => {
    h.hydratedFor = 'hannah@aesop.test';
    signIn('sarah@alamut.test');
    expect(hydrateFromSupabase).toHaveBeenCalledTimes(1);
  });

  it('signing in as the identity already loaded does not fetch twice', () => {
    h.hydratedFor = 'sarah@alamut.test';
    signIn('Sarah@Alamut.test');
    expect(hydrateFromSupabase).not.toHaveBeenCalled();
  });

  it('an hourly token refresh is the same person and does not re-fetch', () => {
    h.hydratedFor = null;
    h.authCb!('TOKEN_REFRESHED', { user: { email: 'sarah@alamut.test' } });
    expect(hydrateFromSupabase).not.toHaveBeenCalled();
  });

  it('identity comparison ignores case and treats signed-out as its own identity', () => {
    expect(needsRehydrate('Sarah@Alamut.test', 'sarah@alamut.test')).toBe(false);
    expect(needsRehydrate('sarah@alamut.test', null)).toBe(true);
    expect(needsRehydrate('sarah@alamut.test', undefined)).toBe(true);
  });

  it('signing out removes the previous person\'s Postgres rows from the browser', () => {
    // Found live: after Hannah signed out, her offer to Amir was still in
    // localStorage when Sarah signed in on the same machine.
    const st = useStore.getState();
    st.setDB((db) => ({
      ...db,
      offers: [...db.offers, { ...db.offers[0], id: 'off_left_behind', campaignId: 'cmp_g0' }],
    }));
    useStore.setState({ remote: { identity: 'hannah@aesop.test', ids: { offers: ['off_left_behind'] }, userIds: ['u_hannah'] } });
    h.authCb!('SIGNED_OUT', null);
    expect(useStore.getState().db.offers.some((o) => o.id === 'off_left_behind')).toBe(false);
    expect(useStore.getState().remote.identity).toBeNull();
  });

  it('…including from a store persisted before the ledger existed', () => {
    // Every browser that visited before this shipped has a store with no
    // record of where its rows came from. The write registry's campaign set
    // is what identifies them: a row on a real campaign is someone's.
    recordRemoteCampaigns(['cmp_1']);
    useStore.getState().setDB((db) => ({
      ...db,
      offers: [...db.offers,
        { ...db.offers[0], id: 'off_cached_long_ago', campaignId: 'cmp_1' },
        { ...db.offers[0], id: 'off_demo_generated', campaignId: 'cmp_g0' }],
    }));
    useStore.setState({ remote: { identity: undefined, ids: {}, userIds: [] } });
    h.authCb!('SIGNED_OUT', null);
    const offers = useStore.getState().db.offers.map((o) => o.id);
    expect(offers).not.toContain('off_cached_long_ago');
    expect(offers).toContain('off_demo_generated');
  });
});

