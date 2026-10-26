// identityPurge.ts — what of the last person stays in the browser.
//
// Since migration 037 every table answers according to who is asking, and the
// store persists to localStorage. So after a sign-out the store still held
// the previous person's view of Postgres. Verified live: after Hannah signed
// out, her $1,050 offer to Amir, three of her collaborations and her thread
// with him were still in localStorage when Sarah signed in on the same
// browser. Not rendered — the UI filters by viewer — but readable in devtools
// on a shared device, which is everything RLS exists to prevent.
//
// The purge removes that, and only that. Browser-only demo state stays:
// generated campaigns (`cmp_g*`) are never in Postgres, and switching
// between the demo accounts on one device must keep what was done on them.
//
// A row of a mirrored table is the previous person's if:
//   * a hydration returned it                       (ledger.ids)
//   * it is attached to a campaign Postgres holds   (rows created and
//                                                     mirrored this session,
//                                                     not yet re-fetched)
//   * it is a wallet row or notification of theirs  (ledger.userIds)
//   * it is a message in a thread being purged
// Such a row goes back to its seed version, or goes. Anything else is kept.
//
// Tables never mirrored (users, advances, referrals, testimonials,
// campaignPerformance, scheduledNotifications) are browser-only by
// construction and are left alone.

import type { Database } from './types';

export const MIRRORED_TABLES = [
  'brands', 'creators', 'campaigns', 'applications', 'offers', 'submissions',
  'collaborations', 'deliverables', 'contracts', 'transactions', 'reviews',
  'disputes', 'outreach', 'threads', 'messages', 'notifications',
  'teamInvites', 'sparkDrafts',
] as const;
export type MirroredTable = (typeof MIRRORED_TABLES)[number];

/** Whose Postgres data the persisted store holds, and which rows. */
export interface RemoteLedger {
  /** Lower-cased email; null = signed out; undefined = never recorded (a
   *  store persisted before the ledger existed — its origin is unknown). */
  identity: string | null | undefined;
  ids: Partial<Record<MirroredTable, string[]>>;
  /** App-level user ids (u_*) of that identity. */
  userIds: string[];
}

export const EMPTY_LEDGER: RemoteLedger = { identity: undefined, ids: {}, userIds: [] };

type Row = {
  id: string; campaignId?: string | null; userId?: string; threadId?: string;
  meta?: { campaignId?: string };
};

/** The campaign a row belongs to. Notifications carry it in `meta`; reading
 *  the top-level field there silently exempted every one of them. */
const campaignOf = (t: MirroredTable, r: Row) =>
  t === 'notifications' ? r.meta?.campaignId : r.campaignId;

/** The store with the previous identity's Postgres rows removed.
 *  `remoteCampaignIds`: campaigns Postgres is known to hold right now — the
 *  write registry's set. It covers a store cached before the ledger existed,
 *  whose rows have no record of where they came from. */
export function purgeIdentityData(
  db: Database,
  ledger: RemoteLedger,
  seed: Database,
  remoteCampaignIds: Iterable<string>,
): Database {
  const remoteCampaigns = new Set([...(ledger.ids.campaigns ?? []), ...remoteCampaignIds]);
  const theirUsers = new Set(ledger.userIds);
  const fetched = (t: MirroredTable) => new Set(ledger.ids[t] ?? []);

  const purge = <R extends Row>(t: MirroredTable, rows: R[] | undefined, extra?: (r: R) => boolean): R[] | undefined => {
    if (!rows) return rows;
    const got = fetched(t);
    const seedRows = new Map(((seed[t] as unknown as R[] | undefined) ?? []).map((r) => [r.id, r]));
    const out: R[] = [];
    for (const r of rows) {
      const theirs = got.has(r.id)
        || (t === 'campaigns' ? remoteCampaigns.has(r.id) : !!campaignOf(t, r) && remoteCampaigns.has(campaignOf(t, r)!))
        || (!!extra && extra(r));
      if (!theirs) out.push(r);
      else if (seedRows.has(r.id)) out.push(seedRows.get(r.id)!);
      // else: theirs and not seed — dropped.
    }
    return out;
  };

  const next: Database = { ...db };
  for (const t of MIRRORED_TABLES) {
    if (t === 'messages') continue; // follows its thread, below
    const byUser = t === 'transactions' || t === 'notifications'
      ? (r: Row) => !!r.userId && theirUsers.has(r.userId)
      : undefined;
    (next as unknown as Record<string, Row[] | undefined>)[t] =
      purge(t, (db as unknown as Record<string, Row[] | undefined>)[t], byUser);
  }
  // A message goes with a thread that was purged: kept threads keep theirs.
  const keptThreads = new Set((next.threads ?? []).map((th) => th.id));
  const purgedThreads = new Set((db.threads ?? []).map((th) => th.id).filter((id) => {
    const after = (next.threads ?? []).find((th) => th.id === id);
    const before = (db.threads ?? []).find((th) => th.id === id);
    return !after || after !== before; // dropped, or reset to seed
  }));
  next.messages = purge('messages', db.messages, (m) =>
    !!m.threadId && (purgedThreads.has(m.threadId) || !keptThreads.has(m.threadId))) ?? [];
  return next;
}
