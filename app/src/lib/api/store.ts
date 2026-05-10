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
      storage: createJSONStorage(() => localStorage),
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
