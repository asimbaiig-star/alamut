// Indexed DB lookup cache (Phase 31 perf).
//
// `deriveDeal` originally did linear scans of `db.applications`,
// `db.offers`, `db.submissions`, etc. for every (campaign, creator)
// pair. That made `collectTodayDeals` O(pairs × artifacts) per
// render — at 10,000 pairs and 50,000 artifacts the brand Today
// page took ~3.6 seconds. Lab measurement, Phase 31 baseline.
//
// Fix: build a per-pair index once per Database snapshot, keyed by
// `${campaignId}|${creatorId}`, and reuse it across every deriveDeal
// call within the same render. Zustand replaces the db reference on
// each tx() mutation, so a WeakMap<Database, DbIndex> gives us:
//
//   * Build index lazily on first access for a given db ref
//   * Cache hits for the rest of the render (every other deriveDeal
//     call, the brand campaign roster, the deal page itself)
//   * Automatic GC when the db ref is replaced by a mutation
//
// The index is the only place that knows the storage layout of these
// artifacts — deriveDeal reads through it.

import type {
  Application,
  Brand,
  Campaign,
  Creator,
  Database,
  Dispute,
  Message,
  Offer,
  Submission,
  Thread,
  Transaction,
} from '@/lib/api/types';

export interface DbIndex {
  /** Campaigns by id — replaces .find() over db.campaigns. */
  campaignsById: Map<string, Campaign>;
  /** Creators by id. */
  creatorsById: Map<string, Creator>;
  /** Brands by id. */
  brandsById: Map<string, Brand>;
  /** Applications by `${campaignId}|${creatorId}`. Most pairs have 0-1
   *  applications; for the few that have multiple, we sort newest-last
   *  so callers using `[...arr].reverse().find()` keep working. */
  appsByPair: Map<string, Application[]>;
  /** Offers by pair, in original db order (so reverse().find() returns
   *  the latest record — same semantic as deriveDeal had pre-index). */
  offersByPair: Map<string, Offer[]>;
  /** Submissions by pair, original db order. */
  submissionsByPair: Map<string, Submission[]>;
  /** Open dispute keyed by campaignId. There's normally at most one. */
  openDisputeByCampaign: Map<string, Dispute>;
  /** Threads keyed by campaignId; deriveDeal walks them looking for
   *  one with the right participant pair. */
  threadsByCampaign: Map<string, Thread[]>;
  /** Messages by threadId, sorted oldest-first (same as deriveDeal
   *  produces pre-index). */
  messagesByThread: Map<string, Message[]>;
  /** Transactions by campaignId — deriveDeal then filters by
   *  user/counterparty depending on viewer role. */
  txByCampaign: Map<string, Transaction[]>;
  /** Cleared payouts by `${campaignId}|${creatorUserId}`, only positive
   *  amounts. Pre-summed isn't worth it — the source array is small. */
  payoutsByPairUser: Map<string, Transaction[]>;
  /** All user-ids belonging to a brand (for multi-team brands). */
  brandTeamUserIds: Map<string, Set<string>>;
  /** Creator id → user id. */
  userIdByCreator: Map<string, string>;
}

const cache = new WeakMap<Database, DbIndex>();

function pairKey(campaignId: string, creatorId: string): string {
  return `${campaignId}|${creatorId}`;
}

function buildIndex(db: Database): DbIndex {
  const campaignsById = new Map<string, Campaign>();
  for (const c of db.campaigns) campaignsById.set(c.id, c);

  const creatorsById = new Map<string, Creator>();
  for (const c of db.creators) creatorsById.set(c.id, c);

  const brandsById = new Map<string, Brand>();
  for (const b of db.brands) brandsById.set(b.id, b);

  const appsByPair = new Map<string, Application[]>();
  for (const a of db.applications) {
    const key = pairKey(a.campaignId, a.creatorId);
    const list = appsByPair.get(key);
    if (list) list.push(a);
    else appsByPair.set(key, [a]);
  }

  const offersByPair = new Map<string, Offer[]>();
  for (const o of db.offers) {
    const key = pairKey(o.campaignId, o.creatorId);
    const list = offersByPair.get(key);
    if (list) list.push(o);
    else offersByPair.set(key, [o]);
  }

  const submissionsByPair = new Map<string, Submission[]>();
  for (const s of db.submissions) {
    const key = pairKey(s.campaignId, s.creatorId);
    const list = submissionsByPair.get(key);
    if (list) list.push(s);
    else submissionsByPair.set(key, [s]);
  }

  const openDisputeByCampaign = new Map<string, Dispute>();
  for (const d of db.disputes) {
    if (d.status === 'open') openDisputeByCampaign.set(d.campaignId, d);
  }

  const threadsByCampaign = new Map<string, Thread[]>();
  for (const t of db.threads) {
    if (!t.campaignId) continue;
    const list = threadsByCampaign.get(t.campaignId);
    if (list) list.push(t);
    else threadsByCampaign.set(t.campaignId, [t]);
  }

  // Messages: bucket then sort each bucket once.
  const messagesByThread = new Map<string, Message[]>();
  for (const m of db.messages) {
    const list = messagesByThread.get(m.threadId);
    if (list) list.push(m);
    else messagesByThread.set(m.threadId, [m]);
  }
  for (const list of messagesByThread.values()) {
    list.sort((a, b) => +new Date(a.at) - +new Date(b.at));
  }

  const txByCampaign = new Map<string, Transaction[]>();
  const payoutsByPairUser = new Map<string, Transaction[]>();
  for (const t of db.transactions) {
    if (t.campaignId) {
      const list = txByCampaign.get(t.campaignId);
      if (list) list.push(t);
      else txByCampaign.set(t.campaignId, [t]);
      // Pre-bucket cleared positive payouts for the released-money
      // calculation (deriveDeal hot path).
      if (t.kind === 'payout' && t.status === 'cleared' && t.amount > 0) {
        const key = pairKey(t.campaignId, t.userId);
        const plist = payoutsByPairUser.get(key);
        if (plist) plist.push(t);
        else payoutsByPairUser.set(key, [t]);
      }
    }
  }

  const brandTeamUserIds = new Map<string, Set<string>>();
  const userIdByCreator = new Map<string, string>();
  for (const u of db.users) {
    if (u.brandId) {
      const set = brandTeamUserIds.get(u.brandId);
      if (set) set.add(u.id);
      else brandTeamUserIds.set(u.brandId, new Set([u.id]));
    }
    if (u.creatorId) {
      userIdByCreator.set(u.creatorId, u.id);
    }
  }

  return {
    campaignsById,
    creatorsById,
    brandsById,
    appsByPair,
    offersByPair,
    submissionsByPair,
    openDisputeByCampaign,
    threadsByCampaign,
    messagesByThread,
    txByCampaign,
    payoutsByPairUser,
    brandTeamUserIds,
    userIdByCreator,
  };
}

/** Get the index for this db, building it on first call. The WeakMap
 *  cache is keyed on the db reference — Zustand replaces the ref on
 *  every tx(), so a fresh index gets built exactly once per mutation. */
export function getDbIndex(db: Database): DbIndex {
  let ix = cache.get(db);
  if (ix) return ix;
  ix = buildIndex(db);
  cache.set(db, ix);
  return ix;
}

/** Test-only: discard any cached index for this db. Useful when a test
 *  builds a db, derives a deal, then mutates the db in place (which
 *  doesn't replace the ref — the WeakMap would otherwise return stale
 *  data). Production code never mutates db in place; tx() replaces it. */
export function _clearDbIndexCache(db: Database): void {
  cache.delete(db);
}

/** Test-only helper exposed so the bench can pre-warm the index and
 *  measure steady-state, not first-call cost. */
export { pairKey as _pairKey };
