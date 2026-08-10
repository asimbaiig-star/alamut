import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Database, Session } from './types';
import { isDemoCreator } from '@/lib/utils/demoData';
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


// Demo creators are showcase data and the SEED is their authority — Postgres
// holds rows that were pushed before these fields existed, which is why the
// overlay below already prefers local `work` / `pressMentions` / rate cards.
// Verification is the same class of staleness: the remote rows carry
// `verified: false` on platforms, so a plain remote-wins merge silently
// un-verifies Sarah's channels on every page load and the seed's
// pre-verification never shows up. Only demo rows are touched; a real
// creator's verification always comes from the server.
function preferSeedVerification<T extends { verified?: boolean }>(
  merged: T[],
  local: T[] | undefined,
  isDemo: boolean,
): T[] {
  if (!isDemo) return merged;
  return merged.map((p, i) => ({ ...p, verified: local?.[i]?.verified ?? p.verified }));
}

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
      // 15 — Phase 59 demo-coverage seed pass:
      //   - Sarah: work[] (6 portfolio images), rateCards[] (6 per-
      //     platform packages), featuredReviewIds[] (3 pinned),
      //     savedBriefs[] (5 bookmarks), 2 extra press mentions
      //   - Aesop: offerTemplates[] (3), expanded savedCreators[] (8),
      //     preferredCreatorTier + monthlyBudgetBand
      //   - 3 new Aesop campaigns: draft + paused + archived
      //   - 4 new offers: 2 pending + 2 countered (Sarah + Yuki) so
      //     the Accept/Counter/Decline flow has live demo data
      //   - Smart-merge overlay extended to preserve work/pressMentions
      //     /featuredReviewIds/savedBriefs/rateCards/pastClients when
      //     Supabase returns empty arrays for them
      // Existing v14 state doesn't have any of these; bumping flushes.
      // (14 was Phase 56 audience + storefront-pulse seed.)
      //
      // v16 (F21/F28) — flush stale seed dates. The seed computes every
      // date relative to `NOW` at module-load, but a persisted store
      // freezes whatever was computed the day it was first written. A
      // store seeded in May 2026 still served May deadlines in August:
      // 75 of 138 "live" campaigns showed a deadline already in the past,
      // and briefs read "Due May 20" months later. Bumping regenerates
      // the seed against today, and picks up the per-brand unique titles
      // from the same finding.
      //
      // Safe to flush now in a way it wasn't before Phase A: real
      // accounts' profiles live in Postgres, so a wipe re-hydrates them
      // on next sign-in instead of destroying them.
      version: 16,
      // Forward-only data migrations layered on top of Zustand's persist
      // versioning. After rehydration, walk `db.migrationVersion + 1` to
      // CURRENT_MIGRATION_VERSION and run each migrator. Idempotent;
      // re-running on an already-current store is a no-op. See
      // `lib/api/migrations.ts` for the registry.
      onRehydrateStorage: () => (state) => {
        if (state?.db) {
          runPendingMigrations(state.db);
          // Phase 53 in-place URL fix — pre-fix `upx()` naively prepended
          // the Unsplash base URL to inputs that were already full URLs,
          // producing `https://images.unsplash.com/https://images.unsplash.com/...`
          // strings that landed in seed.testimonials.authorPortrait.
          // The persisted localStorage carries those broken URLs; the
          // upx() fix only helps fresh seeds. This sweeps existing rows.
          if (Array.isArray(state.db.testimonials)) {
            state.db.testimonials = state.db.testimonials.map((t) => {
              if (typeof t.authorPortrait === 'string' && t.authorPortrait.includes('images.unsplash.com/https://')) {
                return {
                  ...t,
                  authorPortrait: t.authorPortrait.replace(/^https:\/\/images\.unsplash\.com\/https:\/\//, 'https://'),
                };
              }
              return t;
            });
          }
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
      teamInvites: [...(s.db.teamInvites ?? [])],
      sparkDrafts: [...(s.db.sparkDrafts ?? [])],
      migrationVersion: s.db.migrationVersion,
    };
    runPendingMigrations(next);
    return { db: next };
  });
}

// Helper: hand a fresh DB clone to mutate
export function tx<T>(mutator: (db: Database) => T): T {
  let result!: T;
  // Phase 7 — snapshot the transaction count BEFORE the mutation so we
  // can diff the tail after commit and fire a fire-and-forget bulk INSERT
  // for any new rows the mutation appended. Centralising here avoids
  // tapping each of 13+ `db.transactions.push(...)` call sites and
  // guarantees every new tx is mirrored regardless of which action
  // created it.
  const prevTxCount = useStore.getState().db.transactions.length;
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
      teamInvites: [...(prev.teamInvites ?? [])],       // Phase 14 — same
      sparkDrafts: [...(prev.sparkDrafts ?? [])],       // Phase 15 — same
      migrationVersion: prev.migrationVersion,
    };
    result = mutator(next);
    return next;
  });

  // Phase 7 — mirror any newly-appended transactions in one bulk INSERT.
  // Same fire-and-forget pattern as other mirrors: env-gated, dynamic
  // import, silenced on RLS / FK / not-found for rows tied to generated
  // cmp_g* campaigns that live only locally.
  const newTxs = useStore.getState().db.transactions.slice(prevTxCount);
  if (newTxs.length > 0 && typeof window !== 'undefined') {
    void (async () => {
      try {
        const { isSupabaseConfigured } = await import('@/lib/supabase');
        if (!isSupabaseConfigured()) return;
        const { insertTransactionsBatchInSupabase } = await import('@/lib/data/transactionsRepo');
        await insertTransactionsBatchInSupabase(newTxs);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (/row-level security|new row violates|foreign key|duplicate key|no rows|0 rows|not found/i.test(msg)) return;
        // eslint-disable-next-line no-console
        console.warn('[transactions mirror] failed:', msg);
      }
    })();
  }

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
      const [brandsMod, campaignsMod, applicationsMod, offersMod, creatorsMod, collabsMod, submissionsMod, deliverablesMod, contractsMod, transactionsMod, reviewsMod, disputesMod, outreachMod, threadsMod, messagesMod, teamInvitesMod, sparkDraftsMod, notificationsMod] = await Promise.all([
        import('@/lib/data/brandsRepo'),
        import('@/lib/data/campaignsRepo'),
        import('@/lib/data/applicationsRepo'),
        import('@/lib/data/offersRepo'),
        import('@/lib/data/creatorsRepo'),
        import('@/lib/data/collaborationsRepo'),
        import('@/lib/data/submissionsRepo'),
        import('@/lib/data/deliverablesRepo'),
        import('@/lib/data/contractsRepo'),
        import('@/lib/data/transactionsRepo'),
        import('@/lib/data/reviewsRepo'),
        import('@/lib/data/disputesRepo'),
        import('@/lib/data/outreachRepo'),
        import('@/lib/data/threadsRepo'),
        import('@/lib/data/messagesRepo'),
        import('@/lib/data/teamInvitesRepo'),
        import('@/lib/data/sparkDraftsRepo'),
        import('@/lib/data/notificationsRepo'),
      ]);
      const [brands, campaigns, applications, offers, creators, collaborations, submissions, deliverables, contracts, transactions, reviews, disputes, outreach, threads, messages, teamInvites, sparkDrafts, notifications] = await Promise.all([
        brandsMod.fetchAllBrandsFromSupabase(),
        campaignsMod.fetchAllCampaignsFromSupabase(),
        applicationsMod.fetchAllApplicationsFromSupabase(),
        offersMod.fetchAllOffersFromSupabase(),
        creatorsMod.fetchAllCreatorsFromSupabase(),
        collabsMod.fetchAllCollabsFromSupabase(),
        submissionsMod.fetchAllSubmissionsFromSupabase(),
        deliverablesMod.fetchAllDeliverablesFromSupabase(),
        contractsMod.fetchAllContractsFromSupabase(),
        transactionsMod.fetchAllTransactionsFromSupabase(),
        reviewsMod.fetchAllReviewsFromSupabase(),
        disputesMod.fetchAllDisputesFromSupabase(),
        outreachMod.fetchAllOutreachFromSupabase(),
        threadsMod.fetchAllThreadsFromSupabase(),
        messagesMod.fetchAllMessagesFromSupabase(),
        teamInvitesMod.fetchAllTeamInvitesFromSupabase(),
        sparkDraftsMod.fetchAllSparkDraftsFromSupabase(),
        notificationsMod.fetchAllNotificationsFromSupabase(),
      ]);
      // Phase 10 — mount the realtime chat subscription once initial
      // hydration is complete. The subscription itself is idempotent
      // so calling it twice is safe.
      void (async () => {
        try {
          const { mountChatRealtime } = await import('@/lib/realtimeChat');
          mountChatRealtime();
        } catch (err) {
          // eslint-disable-next-line no-console
          console.warn('[realtimeChat] mount skipped:', err);
        }
      })();
      // Migration 022 — same pattern for the 6 workflow tables
      // (campaigns / offers / applications / submissions /
      // collaborations / disputes). Closes the read-side gap so a
      // brand-side acceptance reaches the creator's open tab without
      // a reload.
      void (async () => {
        try {
          const { mountWorkflowRealtime } = await import('@/lib/api/realtimeWorkflow');
          mountWorkflowRealtime();
        } catch (err) {
          // eslint-disable-next-line no-console
          console.warn('[realtimeWorkflow] mount skipped:', err);
        }
      })();
      if (
        brands.length === 0 && campaigns.length === 0 &&
        applications.length === 0 && offers.length === 0 &&
        creators.length === 0 && collaborations.length === 0 &&
        submissions.length === 0 && deliverables.length === 0 &&
        contracts.length === 0 && transactions.length === 0 &&
        reviews.length === 0 && disputes.length === 0 &&
        outreach.length === 0 &&
        threads.length === 0 && messages.length === 0 &&
        notifications.length === 0
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
        // Smart-merge overlay for creators: Supabase carries the core
        // fields but NOT the demo-fixture extras (per-platform audience,
        // storefront-pulse counters, recent-viewer names). When we
        // overlay we'd otherwise blow those away on every boot. Pre-fix
        // Sarah's seeded audience + storefront views disappeared the
        // moment Supabase's hydration completed.
        const overlayCreators = (local: typeof s.db.creators, remote: typeof creators) => {
          if (remote.length === 0) return local;
          const byId = new Map(remote.map((r) => [r.id, r]));
          const next = local.map((row) => {
            const r = byId.get(row.id);
            if (!r) return row;
            // Per-platform: keep the locally-seeded `audience` whenever
            // the Supabase platform doesn't carry it.
            const mergedPlatforms = r.platforms.map((rp, i) => {
              const lp = row.platforms[i];
              if (!lp) return rp;
              if (rp.audience || !lp.audience) return rp;
              if (rp.name !== lp.name) return rp;
              return { ...rp, audience: lp.audience };
            });
            // Helper: keep local array when remote is empty/missing.
            // Supabase rows for demo creators frequently have empty
            // arrays for these "storefront content" fields because the
            // seeded data was pushed to Postgres before these features
            // existed. Without this guard the overlay blows away
            // Sarah's portfolio + rate cards + pinned reviews + saved
            // briefs on every page load.
            const arr = <T,>(remoteVal: T[] | undefined, localVal: T[] | undefined): T[] | undefined =>
              (remoteVal && remoteVal.length > 0) ? remoteVal : (localVal && localVal.length > 0 ? localVal : remoteVal);
            return {
              ...r,
              verified: isDemoCreator(row) ? row.verified : r.verified,
              kycVerifiedAt: isDemoCreator(row) ? (row.kycVerifiedAt ?? r.kycVerifiedAt) : r.kycVerifiedAt,
              platforms: preferSeedVerification(mergedPlatforms, row.platforms, isDemoCreator(row)),
              // Storefront content arrays — seed only.
              work: arr(r.work, row.work) ?? [],
              pressMentions: arr(r.pressMentions, row.pressMentions) ?? [],
              featuredReviewIds: arr(r.featuredReviewIds, row.featuredReviewIds),
              savedBriefs: arr(r.savedBriefs, row.savedBriefs),
              rateCards: arr(r.rateCards, row.rateCards),
              pastClients: arr(r.pastClients, row.pastClients) ?? [],
              // Demo-only fields — keep local if remote is empty / undefined.
              storefrontViewsLast30d: r.storefrontViewsLast30d ?? row.storefrontViewsLast30d,
              storefrontViewsDeltaPct: r.storefrontViewsDeltaPct ?? row.storefrontViewsDeltaPct,
              brandInquiriesThisWeek: r.brandInquiriesThisWeek ?? row.brandInquiriesThisWeek,
              brandInquiriesDelta: r.brandInquiriesDelta ?? row.brandInquiriesDelta,
              recentBrandViewerNames: r.recentBrandViewerNames ?? row.recentBrandViewerNames,
              recentBrandViewerCount: r.recentBrandViewerCount ?? row.recentBrandViewerCount,
            };
          });
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
            creators: overlayCreators(s.db.creators, creators),
            collaborations: overlay(s.db.collaborations ?? [], collaborations),
            submissions: overlay(s.db.submissions, submissions),
            deliverables: overlay(s.db.deliverables ?? [], deliverables),
            contracts: overlay(s.db.contracts ?? [], contracts),
            transactions: overlay(s.db.transactions, transactions),
            reviews: overlay(s.db.reviews, reviews),
            disputes: overlay(s.db.disputes, disputes),
            outreach: overlay(s.db.outreach ?? [], outreach),
            threads: overlay(s.db.threads, threads),
            messages: overlay(s.db.messages, messages),
            teamInvites: overlay(s.db.teamInvites ?? [], teamInvites),
            sparkDrafts: overlay(s.db.sparkDrafts ?? [], sparkDrafts),
            notifications: overlay(s.db.notifications, notifications),
          },
        };
      });
      // Phase 52 — owner-only PII overlay. The list fetches above pull
      // from creators_public + brands_public (no payout / wallet). Now
      // fetch the signed-in user's OWN row from the raw tables (RLS
      // gates by owner_email) so their wallet + payout cards have real
      // numbers. Fire-and-forget; failure leaves the public-view zeros.
      void (async () => {
        try {
          const ownCreator = await creatorsMod.fetchOwnCreatorFromSupabase();
          const ownBrand = await brandsMod.fetchOwnBrandFromSupabase();
          if (!ownCreator && !ownBrand) return;
          useStore.setState((s) => ({
            db: {
              ...s.db,
              // Same smart-merge as the bulk overlay above — keep the
              // locally-seeded demo-fixture fields (per-platform
              // audience + storefront-pulse counters + recent viewers)
              // that Supabase doesn't carry.
              creators: ownCreator
                ? s.db.creators.map((c) => {
                    if (c.id !== ownCreator.id) return c;
                    const mergedPlatforms = ownCreator.platforms.map((rp, i) => {
                      const lp = c.platforms[i];
                      if (!lp) return rp;
                      if (rp.audience || !lp.audience) return rp;
                      if (rp.name !== lp.name) return rp;
                      return { ...rp, audience: lp.audience };
                    });
                    // Same array-preserve helper as the bulk overlay
                    // above — keep local storefront content when
                    // Supabase row returns empty arrays.
                    const arr = <T,>(remoteVal: T[] | undefined, localVal: T[] | undefined): T[] | undefined =>
                      (remoteVal && remoteVal.length > 0) ? remoteVal : (localVal && localVal.length > 0 ? localVal : remoteVal);
                    return {
                      ...ownCreator,
                      verified: isDemoCreator(c) ? c.verified : ownCreator.verified,
                      kycVerifiedAt: isDemoCreator(c) ? (c.kycVerifiedAt ?? ownCreator.kycVerifiedAt) : ownCreator.kycVerifiedAt,
                      platforms: preferSeedVerification(mergedPlatforms, c.platforms, isDemoCreator(c)),
                      work: arr(ownCreator.work, c.work) ?? [],
                      pressMentions: arr(ownCreator.pressMentions, c.pressMentions) ?? [],
                      featuredReviewIds: arr(ownCreator.featuredReviewIds, c.featuredReviewIds),
                      savedBriefs: arr(ownCreator.savedBriefs, c.savedBriefs),
                      rateCards: arr(ownCreator.rateCards, c.rateCards),
                      pastClients: arr(ownCreator.pastClients, c.pastClients) ?? [],
                      storefrontViewsLast30d: ownCreator.storefrontViewsLast30d ?? c.storefrontViewsLast30d,
                      storefrontViewsDeltaPct: ownCreator.storefrontViewsDeltaPct ?? c.storefrontViewsDeltaPct,
                      brandInquiriesThisWeek: ownCreator.brandInquiriesThisWeek ?? c.brandInquiriesThisWeek,
                      brandInquiriesDelta: ownCreator.brandInquiriesDelta ?? c.brandInquiriesDelta,
                      recentBrandViewerNames: ownCreator.recentBrandViewerNames ?? c.recentBrandViewerNames,
                      recentBrandViewerCount: ownCreator.recentBrandViewerCount ?? c.recentBrandViewerCount,
                    };
                  })
                : s.db.creators,
              brands: ownBrand
                ? s.db.brands.map((b) => b.id === ownBrand.id ? ownBrand : b)
                : s.db.brands,
            },
          }));
        } catch (err) {
          // eslint-disable-next-line no-console
          console.warn('[store] own-pii overlay skipped:', err);
        }
      })();
    } catch (e) {
      // Network down / Supabase outage — local store stays as-is.
      // eslint-disable-next-line no-console
      console.warn('[store] hydration skipped:', e);
    }
  })();
}
