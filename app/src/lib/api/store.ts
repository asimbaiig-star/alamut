import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Database, Session } from './types';
import { SEED } from './seed';
import { runPendingMigrations, CURRENT_MIGRATION_VERSION } from './migrations';

interface StoreState {
  db: Database;
  session: Session | null;
  setDB: (db: Database | ((prev: Database) => Database)) => void;
  setSession: (s: Session | null) => void;
  resetAll: () => void;
}

const STORAGE_KEY = 'alamut.v1';

// localStorage is unavailable or throws on write in some environments —
// most notably iOS Safari Private Browsing (0-quota writes throw
// QuotaExceededError) and embedded webviews with site-data restrictions.
// When that happens, an unwrapped `setSession` write would propagate up
// through `signIn`, get caught as a generic non-ApiError in the form
// handler, and surface as "Sign in failed."
//
// `createSafeStorage` returns a Storage-shaped object that:
//   1. Probes localStorage with a write-then-remove on first call.
//   2. If the probe succeeds, returns a wrapped localStorage where every
//      method swallows runtime errors so a single failed write never
//      breaks the calling code path. Persistence still works.
//   3. If the probe fails, returns an in-memory Storage shim. Sessions
//      and store state work for the lifetime of the tab but won't
//      survive a refresh — acceptable degraded experience for a demo.
function createSafeStorage(): Storage {
  let backing: Storage;
  try {
    const probe = '__alamut_storage_probe__';
    localStorage.setItem(probe, '1');
    localStorage.removeItem(probe);
    backing = localStorage;
  } catch {
    const mem = new Map<string, string>();
    return {
      getItem: (k) => (mem.has(k) ? mem.get(k)! : null),
      setItem: (k, v) => { mem.set(k, String(v)); },
      removeItem: (k) => { mem.delete(k); },
      clear: () => { mem.clear(); },
      key: (i) => Array.from(mem.keys())[i] ?? null,
      get length() { return mem.size; },
    } as Storage;
  }
  return {
    getItem: (k) => { try { return backing.getItem(k); } catch { return null; } },
    setItem: (k, v) => { try { backing.setItem(k, v); } catch { /* quota / disabled — silently drop */ } },
    removeItem: (k) => { try { backing.removeItem(k); } catch { /* ignore */ } },
    clear: () => { try { backing.clear(); } catch { /* ignore */ } },
    key: (i) => { try { return backing.key(i); } catch { return null; } },
    get length() { try { return backing.length; } catch { return 0; } },
  } as Storage;
}

const safeStorage = createSafeStorage();

export const useStore = create<StoreState>()(
  persist(
    (set) => ({
      db: SEED,
      session: null,
      setDB: (next) =>
        set((state) => ({
          db: typeof next === 'function' ? (next as (p: Database) => Database)(state.db) : next,
        })),
      setSession: (s) => set({ session: s }),
      resetAll: () => set({ db: SEED, session: null }),
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => safeStorage),
      // 12 — Phase 48 added `testimonials[]` to Database. Old persisted
      // state from v11 doesn't include this field, so any code reading
      // db.testimonials crashes with "Cannot read properties of undefined
      // (reading 'filter')". Bumping the version flushes old state and
      // rehydrates from the current SEED.
      version: 12,
      // Forward-only data migrations layered on top of Zustand's persist
      // versioning. After rehydration, walk `db.migrationVersion + 1` to
      // CURRENT_MIGRATION_VERSION and run each migrator. Idempotent;
      // re-running on an already-current store is a no-op. See
      // `lib/api/migrations.ts` for the registry.
      onRehydrateStorage: () => (state) => {
        if (state?.db) {
          runPendingMigrations(state.db);
        }
      },
    },
  ),
);

// First-load (no persisted state) path: SEED ships with the latest field
// shape, but some migrators (e.g. P1c migrator 3) materialize derived
// rows the seed leaves empty by design (Collaboration is materialized
// from apps/offers/subs, not hand-authored in the seed). Run pending
// migrations once on first load so those rows exist before the UI reads
// them. Migrators are idempotent — re-running on already-current data
// is a no-op for migrator 1/2 (defensive existence checks) and short-
// circuits in migrator 3 (length-based guard).
if (useStore.getState().db.migrationVersion !== CURRENT_MIGRATION_VERSION) {
  useStore.setState((s) => {
    const next: Database = {
      users: [...s.db.users],
      creators: [...s.db.creators],
      brands: [...s.db.brands],
      campaigns: [...s.db.campaigns],
      applications: [...s.db.applications],
      offers: [...s.db.offers],
      submissions: [...s.db.submissions],
      threads: [...s.db.threads],
      messages: [...s.db.messages],
      transactions: [...s.db.transactions],
      notifications: [...s.db.notifications],
      reviews: [...s.db.reviews],
      disputes: [...s.db.disputes],
      referrals: [...s.db.referrals],
      advances: [...s.db.advances],
      testimonials: [...s.db.testimonials],
      collaborations: [...(s.db.collaborations ?? [])],
      deliverables: [...(s.db.deliverables ?? [])],
      contracts: [...(s.db.contracts ?? [])],
      scheduledNotifications: [...(s.db.scheduledNotifications ?? [])],
      outreach: [...(s.db.outreach ?? [])],
      migrationVersion: s.db.migrationVersion,
    };
    runPendingMigrations(next);
    return { db: next };
  });
}

// Helper: hand a fresh DB clone to mutate
export function tx<T>(mutator: (db: Database) => T): T {
  let result!: T;
  useStore.getState().setDB((prev) => {
    // Shallow-clone arrays for cheap immutability; mutator returns a new shape.
    const next: Database = {
      users: [...prev.users],
      creators: [...prev.creators],
      brands: [...prev.brands],
      campaigns: [...prev.campaigns],
      applications: [...prev.applications],
      offers: [...prev.offers],
      submissions: [...prev.submissions],
      threads: [...prev.threads],
      messages: [...prev.messages],
      transactions: [...prev.transactions],
      notifications: [...prev.notifications],
      reviews: [...prev.reviews],
      disputes: [...prev.disputes],
      referrals: [...prev.referrals],
      advances: [...prev.advances],
      testimonials: [...prev.testimonials],
      collaborations: [...(prev.collaborations ?? [])], // P1c — defensive against pre-migration stores
      deliverables: [...(prev.deliverables ?? [])],     // P1d — same defensive guard
      contracts: [...(prev.contracts ?? [])],           // P2 — same defensive guard
      scheduledNotifications: [...(prev.scheduledNotifications ?? [])], // P4 — same
      outreach: [...(prev.outreach ?? [])],             // P6 §5.3 — same
      migrationVersion: prev.migrationVersion,
    };
    result = mutator(next);
    return next;
  });
  return result;
}

// Convenience selector hooks (re-exported in slim form so screens stay tidy)
export const useDB = () => useStore((s) => s.db);
export const useSession = () => useStore((s) => s.session);

// Cross-tab sync — when another tab writes to localStorage, rehydrate this tab's store.
// Mounted once at module load. Cheap: a `storage` event only fires on OTHER tabs.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY && e.newValue !== null) {
      // Trigger Zustand persist rehydrate — pulls latest state from localStorage.
      void useStore.persist.rehydrate();
    }
  });
}

// Phase 2/3 — Supabase boot hydration. When Supabase is configured we
// fetch every migrated table once at startup and overlay returned
// rows onto the local Zustand cache by id. Rows that don't exist in
// Supabase yet (e.g. generated b_gb* brands, cmp_g* campaigns) keep
// their seed values. Reads elsewhere in the app continue going
// through `useStore` unchanged — they just see fresh data for
// migrated rows. Phase 4+ adds offers, applications, etc. to the
// same list.
if (typeof window !== 'undefined') {
  void (async () => {
    try {
      const [brandsMod, campaignsMod, applicationsMod, offersMod, creatorsMod] = await Promise.all([
        import('@/lib/data/brandsRepo'),
        import('@/lib/data/campaignsRepo'),
        import('@/lib/data/applicationsRepo'),
        import('@/lib/data/offersRepo'),
        import('@/lib/data/creatorsRepo'),
      ]);
      const [brands, campaigns, applications, offers, creators] = await Promise.all([
        brandsMod.fetchAllBrandsFromSupabase(),
        campaignsMod.fetchAllCampaignsFromSupabase(),
        applicationsMod.fetchAllApplicationsFromSupabase(),
        offersMod.fetchAllOffersFromSupabase(),
        creatorsMod.fetchAllCreatorsFromSupabase(),
      ]);
      if (
        brands.length === 0 && campaigns.length === 0 &&
        applications.length === 0 && offers.length === 0 &&
        creators.length === 0
      ) return;
      useStore.setState((s) => {
        // Overlay helper — same pattern for every table.
        const overlay = <T extends { id: string }>(local: T[], remote: T[]): T[] => {
          if (remote.length === 0) return local;
          const byId = new Map(remote.map((r) => [r.id, r]));
          const next = local.map((row) => byId.get(row.id) ?? row);
          const localIds = new Set(local.map((row) => row.id));
          for (const row of remote) if (!localIds.has(row.id)) next.push(row);
          return next;
        };
        return {
          db: {
            ...s.db,
            brands: overlay(s.db.brands, brands),
            campaigns: overlay(s.db.campaigns, campaigns),
            applications: overlay(s.db.applications, applications),
            offers: overlay(s.db.offers, offers),
            creators: overlay(s.db.creators, creators),
          },
        };
      });
    } catch (e) {
      // Network down / Supabase outage — local store stays as-is.
      // eslint-disable-next-line no-console
      console.warn('[store] hydration skipped:', e);
    }
  })();
}
