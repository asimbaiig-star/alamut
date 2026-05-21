// v2Hooks.ts — Zustand selectors that return v2-shaped data
//
// Phase B of the migration. v2 components stop importing the V2_*
// sample arrays and instead consume these hooks. Reads are reactive
// (useStore selector subscriptions); mutations go through tx().
//
// Persona resolution:
//   The v2 workspace has its own persona toggle (Brand / Creator) that
//   lives in localStorage as `alamut.v2.persona`. We read that here so
//   the right "viewer" identity is applied — useV2Conversations needs
//   the viewer's userId to attribute messages.
//   When no auth session is set (which is the default during the
//   pre-cutover preview), we resolve the demo viewer from the persona:
//     persona='brand'   → demo brand user (b_aesop / hannah)
//     persona='creator' → demo creator user (c_sarah / sarah)
//   Once Phase C lands real auth, useStore session takes over.

import { useMemo } from 'react';
import { useStore, useDB, tx } from '@/lib/api/store';
import type { Brand, Creator, Database, OfferTemplate } from '@/lib/api/types';
import {
  creatorToV2, campaignToV2, threadToV2,
  brandWalletV2, creatorWalletV2,
  collabsForCampaign, collabsForCreator, deriveCollab,
} from './v2Adapters';
import type { V2Creator, V2Campaign, V2Conversation, V2Collab } from './data';
// Phase 10 — Supabase mirror for thread + message mutations.
import { isSupabaseConfigured } from '@/lib/supabase';

/** Fire-and-forget thread UPDATE mirror (Phase 10). Used by mark-read +
 *  send-message which both touch unread_for / last_message_at. */
function mirrorThreadPatch(
  threadId: string,
  patch: Parameters<typeof import('@/lib/data/threadsRepo').updateThreadInSupabase>[1],
): void {
  if (!isSupabaseConfigured()) return;
  void (async () => {
    try {
      const { updateThreadInSupabase } = await import('@/lib/data/threadsRepo');
      await updateThreadInSupabase(threadId, patch);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/row-level security|no rows|0 rows|not found/i.test(msg)) return;
      // eslint-disable-next-line no-console
      console.warn('[thread update mirror] failed:', msg);
    }
  })();
}

/** Fire-and-forget message INSERT mirror (Phase 10). */
function mirrorMessageInsert(message: import('@/lib/api/types').Message): void {
  if (!isSupabaseConfigured()) return;
  void (async () => {
    try {
      const { insertMessageInSupabase } = await import('@/lib/data/messagesRepo');
      await insertMessageInSupabase(message);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/foreign key|violates|row-level security|duplicate key|no rows|0 rows|not found/i.test(msg)) return;
      // eslint-disable-next-line no-console
      console.warn('[message insert mirror] failed:', msg);
    }
  })();
}

// =====================================================================
// Demo identity fallback (until Phase C auth gating)
// =====================================================================

const DEMO_BRAND_USER_ID = 'u_hannah';      // hannah@aesop.test
const DEMO_CREATOR_USER_ID = 'u_sarah';     // sarah@alamut.test

/**
 * Resolve the user id that owns the current persona view.
 *
 * Auth rules:
 *  1. If a session exists and the user has the matching profile (brand
 *     for brand persona, creator for creator persona), return the
 *     session id. This is the authenticated happy path.
 *  2. If a session exists but the persona doesn't match the user's role
 *     (e.g. a creator session viewing under brand persona — should not
 *     normally happen after the Workspace persona-sync useEffect, but
 *     can transiently during route changes), return EMPTY so downstream
 *     selectors render an empty workspace. Falling back to the demo
 *     account here would expose another real user's data — the bug
 *     that caused "Sarah teleports to Aesop" when persona auto-flipped.
 *  3. Only when there is NO session at all do we use the demo fallback
 *     so unauthenticated preview / development still renders.
 */
function getViewerUserId(db: Database, sessionUserId: string | null, persona: 'brand' | 'creator'): string {
  if (sessionUserId) {
    const me = db.users.find((u) => u.id === sessionUserId);
    if (me) {
      if (persona === 'brand' && me.brandId) return sessionUserId;
      if (persona === 'creator' && me.creatorId) return sessionUserId;
      // MANAGER / AGENT — a user with no own creatorId but who acts on
      // behalf of one or more creators via managesCreatorIds is a
      // legitimate creator-persona viewer. Pre-fix this branch fell
      // through to demo fallback, returning Sarah's userId for every
      // manager session and silently swapping the viewer's identity.
      if (persona === 'creator' && me.managesCreatorIds && me.managesCreatorIds.length > 0) {
        return sessionUserId;
      }
    }
    // Session present but persona doesn't match — don't leak another
    // user's account. Empty string causes lookups to return null and
    // surfaces render their empty states.
    return '';
  }
  // Unauthenticated — demo fallback so the workspace renders for dev.
  if (persona === 'creator') {
    return db.users.find((u) => u.id === DEMO_CREATOR_USER_ID)?.id ?? DEMO_CREATOR_USER_ID;
  }
  return db.users.find((u) => u.id === DEMO_BRAND_USER_ID)?.id ?? DEMO_BRAND_USER_ID;
}

function readPersona(): 'brand' | 'creator' {
  if (typeof window === 'undefined') return 'brand';
  try {
    const v = localStorage.getItem('alamut.v2.persona');
    return v === 'creator' ? 'creator' : 'brand';
  } catch { return 'brand'; }
}

// =====================================================================
// Reads
// =====================================================================

/** All creators, mapped to v2 shape. Memoized on db identity. */
export function useV2Creators(): V2Creator[] {
  const db = useDB();
  return useMemo(() => db.creators.map(creatorToV2), [db.creators]);
}

/** All campaigns visible to the current persona, mapped to v2 shape. */
export function useV2Campaigns(): V2Campaign[] {
  const db = useDB();
  const session = useStore((s) => s.session);
  const persona = readPersona();
  return useMemo(() => {
    const viewerUserId = getViewerUserId(db, session?.userId ?? null, persona);
    const me = db.users.find((u) => u.id === viewerUserId);

    let pool = db.campaigns;
    if (persona === 'brand' && me?.brandId) {
      // Brand sees only their own campaigns
      pool = pool.filter((c) => c.brandId === me.brandId);
    } else if (persona === 'creator' && me?.creatorId) {
      // Creator sees campaigns they're involved in (applied / shortlisted / accepted).
      // Walking applications + offers covers every signal the duplicate
      // acceptedCreators/shortlist fields encoded.
      const myId = me.creatorId;
      pool = pool.filter(
        (c) =>
          db.applications.some((a) => a.campaignId === c.id && a.creatorId === myId) ||
          db.offers.some((o) => o.campaignId === c.id && o.creatorId === myId),
      );
    }
    return pool.map((c) => campaignToV2(c, db));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, session?.userId, persona]);
}

/** All campaigns regardless of persona (for "browse briefs" creator-side). */
export function useV2AllCampaigns(): V2Campaign[] {
  const db = useDB();
  return useMemo(() => db.campaigns.map((c) => campaignToV2(c, db)), [db]);
}

/** Conversations for the current persona viewer. */
export function useV2Conversations(): V2Conversation[] {
  const db = useDB();
  const session = useStore((s) => s.session);
  const persona = readPersona();
  return useMemo(() => {
    const viewerUserId = getViewerUserId(db, session?.userId ?? null, persona);
    return db.threads
      .filter((t) => t.participants.includes(viewerUserId))
      .map((t) => threadToV2(t, db, viewerUserId))
      .filter((c): c is V2Conversation => !!c)
      .sort((a, b) => {
        // Sort by lastMessageAt descending — engineering note: sort by raw
        // timestamp via thread lookup since the v2 lastAt is humanized.
        const ta = db.threads.find((t) => t.id === a.id)!.lastMessageAt;
        const tb = db.threads.find((t) => t.id === b.id)!.lastMessageAt;
        return new Date(tb).getTime() - new Date(ta).getTime();
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, session?.userId, persona]);
}

/** Current brand record (resolved from session or demo fallback). */
export function useV2CurrentBrand(): Brand | null {
  const db = useDB();
  const session = useStore((s) => s.session);
  const viewerUserId = getViewerUserId(db, session?.userId ?? null, 'brand');
  const me = db.users.find((u) => u.id === viewerUserId);
  return me?.brandId ? db.brands.find((b) => b.id === me.brandId) ?? null : null;
}

/** Current creator record (resolved from session or demo fallback).
 *
 * Manager / agent path: when the signed-in user has no own creatorId
 * but has `managesCreatorIds[]`, return the FIRST managed creator so
 * the workspace renders something. A future "switch which creator
 * I'm acting for" picker can promote the selection out of this hook;
 * for now first-managed is the right default. */
export function useV2CurrentCreator(): Creator | null {
  const db = useDB();
  const session = useStore((s) => s.session);
  const viewerUserId = getViewerUserId(db, session?.userId ?? null, 'creator');
  const me = db.users.find((u) => u.id === viewerUserId);
  if (!me) return null;
  if (me.creatorId) {
    return db.creators.find((c) => c.id === me.creatorId) ?? null;
  }
  // Manager / agent — fall back to the first managed creator.
  if (me.managesCreatorIds && me.managesCreatorIds.length > 0) {
    const managedId = me.managesCreatorIds[0];
    return db.creators.find((c) => c.id === managedId) ?? null;
  }
  return null;
}

/** Brand wallet shape derived from the current brand and ledger. */
export function useV2BrandWallet() {
  const db = useDB();
  const brand = useV2CurrentBrand();
  return useMemo(() => {
    if (!brand) {
      return {
        available: 0, reserved: 0, inFlight: 0,
        currency: 'USD' as const, ledger: [],
        thisMonth: { topups: 0, released: 0, fees: 0, adSpend: 0 },
      };
    }
    return brandWalletV2(brand, db);
  }, [brand, db]);
}

/** Creator wallet shape derived from the current creator and ledger. */
export function useV2CreatorWallet() {
  const db = useDB();
  const creator = useV2CurrentCreator();
  return useMemo(() => {
    if (!creator) {
      return { available: 0, pending: 0, lifetime: 0, currency: 'USD' as const, ledger: [] };
    }
    return creatorWalletV2(creator, db);
  }, [creator, db]);
}

/** Lookup a single v2 campaign by id. */
export function useV2CampaignById(campaignId: string): V2Campaign | null {
  const db = useDB();
  return useMemo(() => {
    const c = db.campaigns.find((c) => c.id === campaignId);
    return c ? campaignToV2(c, db) : null;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, campaignId]);
}

/** All collabs for one campaign (brand-side kanban). */
export function useV2CollabsForCampaign(campaignId: string): V2Collab[] {
  const db = useDB();
  return useMemo(() => collabsForCampaign(campaignId, db), [db, campaignId]);
}

/** All collabs for the current creator. */
export function useV2MyCollabs(): V2Collab[] {
  const db = useDB();
  const creator = useV2CurrentCreator();
  return useMemo(() => {
    if (!creator) return [];
    return collabsForCreator(creator.id, db);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, creator?.id]);
}

/** Single collab lookup by synthetic id `collab__<campaignId>__<creatorId>`. */
export function useV2CollabById(collabId: string): V2Collab | null {
  const db = useDB();
  return useMemo(() => {
    // Two id shapes flow through here:
    //   1. Synthetic v2 format: `collab__<campaignId>__<creatorId>` —
    //      what `deriveCollab` returns from `id` so kanban/list cards
    //      can deep-link without a stored Collaboration record.
    //   2. Real DB id: `col_<...>` — the stored Collaboration entity
    //      (P1c §1.1). BriefDetail redirects creators here when an
    //      offer was sent before they applied, so we must look up
    //      the collab row and derive from its campaignId/creatorId.
    const synthetic = collabId.match(/^collab__(.+?)__(.+)$/);
    if (synthetic) {
      const [, campaignId, creatorId] = synthetic;
      return deriveCollab(campaignId, creatorId, db);
    }
    const stored = db.collaborations.find((c) => c.id === collabId);
    if (stored) {
      return deriveCollab(stored.campaignId, stored.creatorId, db);
    }
    return null;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, collabId]);
}

/** Saved-creator IDs for the current brand (brand-side shortlist). */
export function useV2BrandShortlist(): string[] {
  const brand = useV2CurrentBrand();
  return brand?.savedCreators ?? [];
}

// =====================================================================
// Mutations (wrap tx() for v2 surfaces)
// =====================================================================

/** Creator-side bookmarks: add (or remove) a campaign id to/from the
 *  current creator's `savedBriefs` list. Mirrors `v2ToggleSavedCreator`
 *  for the brand-side roster. Powers the save chip on the editorial
 *  CampaignTile. */
export function v2ToggleSavedBrief(campaignId: string) {
  let nextSavedBriefs: string[] | undefined;
  let creatorId: string | undefined;
  let expectedVersion: number | undefined;
  tx((db) => {
    const session = useStore.getState().session;
    const viewerId = getViewerUserId(db, session?.userId ?? null, 'creator');
    const me = db.users.find((u) => u.id === viewerId);
    if (!me?.creatorId) return;
    const idx = db.creators.findIndex((c) => c.id === me.creatorId);
    if (idx === -1) return;
    const creator = db.creators[idx];
    const current = creator.savedBriefs ?? [];
    const has = current.includes(campaignId);
    const next = has ? current.filter((id) => id !== campaignId) : [...current, campaignId];
    db.creators[idx] = { ...creator, savedBriefs: next };
    nextSavedBriefs = next;
    creatorId = creator.id;
    expectedVersion = creator.version;
  });
  // Phase 5 — mirror the savedBriefs column to Supabase. RLS gates
  // by auth.email() = owner_email so only the right creator can
  // land the write.
  //
  // Migration 021 — pass expectedVersion for optimistic locking. On
  // StaleVersionError we silently drop the mirror (the next toggle
  // will re-fetch a fresh version). savedBriefs is a low-stakes
  // bookmark list — no toast needed for a race.
  if (creatorId && nextSavedBriefs !== undefined) {
    void (async () => {
      try {
        const { updateCreatorInSupabase } = await import('@/lib/data/creatorsRepo');
        const updated = await updateCreatorInSupabase(
          creatorId!,
          { savedBriefs: nextSavedBriefs },
          expectedVersion,
        );
        // Write the bumped version back to the local store so the next
        // toggle uses fresh state. Bypass tx() to avoid mirror-loop.
        useStore.setState((s) => ({
          db: {
            ...s.db,
            creators: s.db.creators.map((c) =>
              c.id === creatorId ? { ...c, version: updated.version } : c,
            ),
          },
        }));
      } catch (err) {
        if (err instanceof Error && err.name === 'StaleVersionError') return;
        const msg = err instanceof Error ? err.message : String(err);
        if (/no rows|0 rows|not found|new row violates|row-level security/i.test(msg)) return;
        // eslint-disable-next-line no-console
        console.warn('[v2ToggleSavedBrief mirror] failed:', msg);
      }
    })();
  }
}

/** Add (or remove) a creator id to/from the current brand's saved list. */
export function v2ToggleSavedCreator(creatorId: string) {
  tx((db) => {
    const session = useStore.getState().session;
    const persona = readPersona();
    const viewerId = getViewerUserId(db, session?.userId ?? null, 'brand');
    const me = db.users.find((u) => u.id === viewerId);
    if (!me?.brandId) return;
    const idx = db.brands.findIndex((b) => b.id === me.brandId);
    if (idx === -1) return;
    const brand = db.brands[idx];
    const has = brand.savedCreators.includes(creatorId);
    db.brands[idx] = {
      ...brand,
      savedCreators: has
        ? brand.savedCreators.filter((id) => id !== creatorId)
        : [...brand.savedCreators, creatorId],
    };
    void persona;
  });
}

/** Mark all messages in a thread as read for the current viewer. */
export function v2MarkThreadRead(threadId: string) {
  let nextUnreadFor: string[] | null = null;
  tx((db) => {
    const session = useStore.getState().session;
    const persona = readPersona();
    const viewerId = getViewerUserId(db, session?.userId ?? null, persona);
    const idx = db.threads.findIndex((t) => t.id === threadId);
    if (idx === -1) return;
    const thread = db.threads[idx];
    if (!thread.unreadFor.includes(viewerId)) return;
    nextUnreadFor = thread.unreadFor.filter((u) => u !== viewerId);
    db.threads[idx] = {
      ...thread,
      unreadFor: nextUnreadFor,
    };
  });
  if (nextUnreadFor) mirrorThreadPatch(threadId, { unreadFor: nextUnreadFor });
}

/** Send a message in a thread, from the current viewer.
 *  Phase 11 — new messages clear the recipient(s) from the thread's
 *  `archivedFor` so an archived conversation comes back to their inbox
 *  when the other party speaks up (standard Gmail-style behaviour).
 *  Phase 12 — optional `attachments` carries file metadata uploaded via
 *  uploadMessageAttachment beforehand. */
export function v2SendMessage(
  threadId: string,
  text: string,
  attachments?: import('@/lib/api/types').MessageAttachment[],
) {
  // Allow empty text when attachments are present (drop-only sends).
  const hasText = text.trim().length > 0;
  const hasAttachments = (attachments?.length ?? 0) > 0;
  if (!hasText && !hasAttachments) return;
  let newMsg: import('@/lib/api/types').Message | null = null;
  let threadPatch:
    | { lastMessageAt: string; unreadFor: string[]; archivedFor?: string[] }
    | null = null;
  tx((db) => {
    const session = useStore.getState().session;
    const persona = readPersona();
    const viewerId = getViewerUserId(db, session?.userId ?? null, persona);
    const now = new Date().toISOString();
    const id = `m_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    newMsg = {
      id,
      threadId,
      fromUserId: viewerId,
      text: text.trim(),
      at: now,
      ...(hasAttachments ? { attachments } : {}),
    };
    db.messages.push(newMsg);
    const idx = db.threads.findIndex((t) => t.id === threadId);
    if (idx !== -1) {
      const thread = db.threads[idx];
      // Mark unread for everyone except sender
      const others = thread.participants.filter((p) => p !== viewerId);
      const nextUnreadFor = Array.from(new Set([...thread.unreadFor.filter((u) => u !== viewerId), ...others]));
      // Un-archive for non-sender participants. The sender's own
      // archive state survives — they archived it intentionally and a
      // self-reply shouldn't un-archive (they're catching up on their
      // own end, not getting a new ping).
      const prevArchived = thread.archivedFor ?? [];
      const nextArchived = prevArchived.filter((u) => u === viewerId);
      const archivedChanged = prevArchived.length !== nextArchived.length;
      threadPatch = {
        lastMessageAt: now,
        unreadFor: nextUnreadFor,
        ...(archivedChanged ? { archivedFor: nextArchived } : {}),
      };
      db.threads[idx] = {
        ...thread,
        lastMessageAt: now,
        unreadFor: nextUnreadFor,
        archivedFor: nextArchived,
      };
    }
  });
  if (newMsg) mirrorMessageInsert(newMsg);
  if (threadPatch) mirrorThreadPatch(threadId, threadPatch);
}

/** Phase 11 — toggle viewer membership in `thread.mutedFor`. Notification
 *  delivery should check this list (the bell + recent-activity feed
 *  read it) — for the demo we just persist the flag; consumers can
 *  honour it as they migrate. */
export function v2MuteThread(threadId: string): boolean {
  let nextMuted: string[] | null = null;
  tx((db) => {
    const session = useStore.getState().session;
    const persona = readPersona();
    const viewerId = getViewerUserId(db, session?.userId ?? null, persona);
    const idx = db.threads.findIndex((t) => t.id === threadId);
    if (idx === -1) return;
    const prev = db.threads[idx].mutedFor ?? [];
    nextMuted = prev.includes(viewerId)
      ? prev.filter((u) => u !== viewerId)
      : [...prev, viewerId];
    db.threads[idx] = { ...db.threads[idx], mutedFor: nextMuted };
  });
  if (nextMuted) mirrorThreadPatch(threadId, { mutedFor: nextMuted });
  return nextMuted !== null;
}

/** Phase 11 — toggle viewer membership in `thread.archivedFor`. The
 *  inbox filters out archived threads by default; the dropdown's
 *  "Archived" filter brings them back. */
export function v2ArchiveThread(threadId: string): boolean {
  let nextArchived: string[] | null = null;
  tx((db) => {
    const session = useStore.getState().session;
    const persona = readPersona();
    const viewerId = getViewerUserId(db, session?.userId ?? null, persona);
    const idx = db.threads.findIndex((t) => t.id === threadId);
    if (idx === -1) return;
    const prev = db.threads[idx].archivedFor ?? [];
    nextArchived = prev.includes(viewerId)
      ? prev.filter((u) => u !== viewerId)
      : [...prev, viewerId];
    db.threads[idx] = { ...db.threads[idx], archivedFor: nextArchived };
  });
  if (nextArchived) mirrorThreadPatch(threadId, { archivedFor: nextArchived });
  return nextArchived !== null;
}

/** Phase 11 — report a thread to admin. Stamps reportedAt/by/reason on
 *  the thread + pushes a notification to every admin user so it lands
 *  in the admin queue. Re-reporting overwrites the previous report
 *  (single-row model for the demo; a full implementation would have a
 *  separate `thread_reports` table). */
export function v2ReportThread(threadId: string, reason: string): boolean {
  const trimmed = reason.trim();
  if (!trimmed) return false;
  let patch: {
    reportedAt: number;
    reportedByUserId: string;
    reportedReason: string;
  } | null = null;
  tx((db) => {
    const session = useStore.getState().session;
    const persona = readPersona();
    const viewerId = getViewerUserId(db, session?.userId ?? null, persona);
    const idx = db.threads.findIndex((t) => t.id === threadId);
    if (idx === -1) return;
    const now = Date.now();
    patch = { reportedAt: now, reportedByUserId: viewerId, reportedReason: trimmed };
    db.threads[idx] = {
      ...db.threads[idx],
      reportedAt: now,
      reportedByUserId: viewerId,
      reportedReason: trimmed,
    };
    // Notify admins so the case lands in the admin queue.
    const previewReason = trimmed.length > 80 ? trimmed.slice(0, 80) + '…' : trimmed;
    db.users.filter((u) => u.role === 'admin').forEach((adm) => {
      db.notifications.push({
        id: `n_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        userId: adm.id,
        text: `Thread reported — "${previewReason}"`,
        href: '/admin/queue?type=threads',
        at: new Date(now).toISOString(),
        read: false,
        meta: { },
      });
    });
  });
  if (patch) mirrorThreadPatch(threadId, patch);
  return patch !== null;
}

/** Find-or-create the thread between the brand owner and the creator
 *  for a given campaign. Used by "Message brand" CTAs across the
 *  workspace so a creator can start a conversation even before the
 *  brand has sent an offer (the offer path also auto-creates a thread,
 *  but only at offer-send time — pitched/invited stages had no thread
 *  yet, which is why "Message brand" landed on the wrong inbox row).
 *  Returns the resolved threadId, or null if either party can't be
 *  found in db.users. Idempotent — returns the existing thread id when
 *  one already exists.
 *
 *  Phase 10 mirror: a freshly-created thread is mirrored to Supabase
 *  fire-and-forget so peers see it via the realtime subscription. */
export function v2EnsureThreadFor(
  campaignId: string,
  creatorId: string,
): string | null {
  const db0 = useStore.getState().db;
  const camp = db0.campaigns.find((c) => c.id === campaignId);
  if (!camp) return null;
  const creator = db0.creators.find((c) => c.id === creatorId);
  if (!creator) return null;
  const creatorUser = db0.users.find((u) => u.id === creator.userId);
  const brandUser = db0.users.find((u) => u.brandId === camp.brandId);
  if (!creatorUser || !brandUser) return null;

  // Fast-path: thread already exists.
  const existing = db0.threads.find(
    (t) =>
      t.campaignId === campaignId &&
      t.participants.includes(creatorUser.id) &&
      t.participants.includes(brandUser.id),
  );
  if (existing) return existing.id;

  // Create one.
  let createdThread: import('@/lib/api/types').Thread | null = null;
  tx((db) => {
    // Re-check inside tx in case another mutation in this turn just
    // created it (defensive against double-clicks).
    const inTx = db.threads.find(
      (t) =>
        t.campaignId === campaignId &&
        t.participants.includes(creatorUser.id) &&
        t.participants.includes(brandUser.id),
    );
    if (inTx) { createdThread = inTx; return; }

    const threadId = `t_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const now = new Date().toISOString();
    const t: import('@/lib/api/types').Thread = {
      id: threadId,
      participants: [creatorUser.id, brandUser.id],
      campaignId,
      subject: camp.title,
      lastMessageAt: now,
      // Empty unreadFor — no actual message has been sent yet. The first
      // v2SendMessage in this thread will populate it.
      unreadFor: [],
      collaborationId: null,
    };
    db.threads.push(t);
    createdThread = t;
  });

  // Fire-and-forget mirror so the new thread shows up cross-device.
  if (createdThread) {
    void (async () => {
      try {
        const { isSupabaseConfigured } = await import('@/lib/supabase');
        if (!isSupabaseConfigured()) return;
        const { insertThreadInSupabase } = await import('@/lib/data/threadsRepo');
        await insertThreadInSupabase(createdThread!);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (/foreign key|violates|row-level security|duplicate key|no rows|0 rows|not found/i.test(msg)) return;
        // eslint-disable-next-line no-console
        console.warn('[ensure thread mirror] failed:', msg);
      }
    })();
  }

  return createdThread ? (createdThread as import('@/lib/api/types').Thread).id : null;
}

/** Creator withdraws funds from their wallet to their bank. Decrements
 *  walletBalance and writes a 'payout' transaction so the wallet ledger
 *  shows the outflow. No real bank API — this is the demo's terminal
 *  step for the money story.
 *
 *  Returns true on success, false if the amount is invalid (≤0 or >
 *  available balance). The caller is responsible for input validation
 *  in the UI; this function defends the wallet-balance invariant. */
export function v2RequestWithdrawal(amount: number): boolean {
  if (!Number.isFinite(amount) || amount <= 0) return false;
  let ok = false;
  tx((db) => {
    const session = useStore.getState().session;
    const persona = readPersona();
    const viewerId = getViewerUserId(db, session?.userId ?? null, persona);
    const me = db.users.find((u) => u.id === viewerId);
    if (!me?.creatorId) return;
    const idx = db.creators.findIndex((c) => c.id === me.creatorId);
    if (idx === -1) return;
    const creator = db.creators[idx];
    if (amount > creator.walletBalance) return;

    // CLEARANCE GATE — pre-fix the creator could withdraw any
    // walletBalance the moment it landed, including funds in the
    // 7-day post-approval dispute window. If a dispute landed within
    // that window the platform owed money it had already paid out.
    //
    // Rules:
    //   1. No open disputes the creator is party to.
    //   2. No payouts that cleared within the last 7 days where the
    //      brand could still raise a dispute (submission.disputeWindowClosesAt > now).
    //      Held funds = sum of those payout amounts.
    const nowMs = Date.now();
    const hasOpenDispute = db.disputes.some(
      (d) => d.status === 'open' && d.collaborationId &&
        db.collaborations.some((c) => c.id === d.collaborationId && c.creatorId === creator.id),
    );
    if (hasOpenDispute) return;

    // Sum payouts in the still-open dispute window. These dollars
    // are real but contingently reclaimable, so they can't leave.
    const inWindowHold = db.submissions
      .filter((s) =>
        s.creatorId === creator.id &&
        s.status === 'approved' &&
        typeof s.disputeWindowClosesAt === 'number' &&
        s.disputeWindowClosesAt > nowMs,
      )
      .reduce((sum, s) => {
        // Match the payout transaction by submissionId / campaignId.
        // payouts are positive amounts on the creator's user id.
        const matching = db.transactions.find(
          (t) => t.kind === 'payout' && t.userId === me.id &&
            t.campaignId === s.campaignId && t.amount > 0,
        );
        return sum + (matching?.amount ?? 0);
      }, 0);
    const withdrawable = Math.max(0, creator.walletBalance - inWindowHold);
    if (amount > withdrawable) return;

    db.creators[idx] = {
      ...creator,
      walletBalance: creator.walletBalance - amount,
    };
    db.transactions.push({
      id: `tx_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      at: new Date().toISOString(),
      userId: me.id,
      kind: 'payout',
      // Negative because amount leaves the wallet (matches escrow_release
      // / fee convention in the rest of the seed).
      amount: -amount,
      status: 'cleared',
      note: 'Withdrawal to bank',
    });
    ok = true;
  });
  return ok;
}

/** Phase 13 — upload an asset to a campaign's brief. Writes the file
 *  to Storage, then appends a CampaignAsset record to campaign.assets
 *  and mirrors the patch to Postgres. Returns the new asset (caller
 *  shows a toast or surfaces an error). */
export async function v2AddCampaignAsset(
  campaignId: string,
  file: File,
): Promise<import('@/lib/api/types').CampaignAsset | null> {
  try {
    const { uploadCampaignAssetFile } = await import('@/lib/data/campaignsRepo');
    const { assetId, publicUrl } = await uploadCampaignAssetFile(campaignId, file);
    const session = useStore.getState().session;
    const me = session ? useStore.getState().db.users.find((u) => u.id === session.userId) : null;
    const asset: import('@/lib/api/types').CampaignAsset = {
      id: assetId,
      name: file.name,
      url: publicUrl,
      sizeBytes: file.size,
      mimeType: file.type ?? '',
      uploadedAt: new Date().toISOString(),
      uploadedByUserId: me?.id,
    };
    let mirrored = false;
    tx((db) => {
      const idx = db.campaigns.findIndex((c) => c.id === campaignId);
      if (idx === -1) return;
      const prev = db.campaigns[idx];
      db.campaigns[idx] = { ...prev, assets: [...(prev.assets ?? []), asset] };
      mirrored = true;
    });
    if (mirrored && typeof window !== 'undefined') {
      void (async () => {
        try {
          const { isSupabaseConfigured } = await import('@/lib/supabase');
          if (!isSupabaseConfigured()) return;
          const { updateCampaignInSupabase } = await import('@/lib/data/campaignsRepo');
          const camp = useStore.getState().db.campaigns.find((c) => c.id === campaignId);
          if (!camp) return;
          await updateCampaignInSupabase(campaignId, { assets: camp.assets ?? [] });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          if (/row-level security|no rows|0 rows|not found/i.test(msg)) return;
          // eslint-disable-next-line no-console
          console.warn('[asset add mirror] failed:', msg);
        }
      })();
    }
    return asset;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[v2AddCampaignAsset] failed:', err instanceof Error ? err.message : err);
    return null;
  }
}

/** Phase 13 — remove an asset from a campaign. Strips the entry from
 *  campaign.assets, mirrors the patch, and best-effort deletes the
 *  underlying file from Storage. */
export async function v2RemoveCampaignAsset(
  campaignId: string,
  assetId: string,
): Promise<boolean> {
  let removedAsset: import('@/lib/api/types').CampaignAsset | undefined;
  tx((db) => {
    const idx = db.campaigns.findIndex((c) => c.id === campaignId);
    if (idx === -1) return;
    const prev = db.campaigns[idx];
    removedAsset = (prev.assets ?? []).find((a) => a.id === assetId);
    db.campaigns[idx] = {
      ...prev,
      assets: (prev.assets ?? []).filter((a) => a.id !== assetId),
    };
  });
  if (!removedAsset) return false;
  if (typeof window !== 'undefined') {
    void (async () => {
      try {
        const { isSupabaseConfigured } = await import('@/lib/supabase');
        if (!isSupabaseConfigured()) return;
        const { updateCampaignInSupabase, removeCampaignAssetFile } = await import('@/lib/data/campaignsRepo');
        const camp = useStore.getState().db.campaigns.find((c) => c.id === campaignId);
        if (camp) {
          await updateCampaignInSupabase(campaignId, { assets: camp.assets ?? [] });
        }
        if (removedAsset) {
          await removeCampaignAssetFile(campaignId, removedAsset.id, removedAsset.name);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (/row-level security|no rows|0 rows|not found/i.test(msg)) return;
        // eslint-disable-next-line no-console
        console.warn('[asset remove mirror] failed:', msg);
      }
    })();
  }
  return true;
}

// =====================================================================
// Phase 14 — Team invites
// =====================================================================

/** Brand owner sends a team invite. Generates a token, writes the row
 *  locally, mirrors to Postgres. Returns the new invite so the caller
 *  can immediately display the share URL (the demo flow doesn't email
 *  the invitee; the brand copies the link from a modal). */
export function v2SendTeamInvite(input: {
  brandId: string;
  email: string;
  role: import('@/lib/api/types').TeamRole;
}): import('@/lib/api/types').TeamInvite | null {
  const cleanEmail = input.email.trim().toLowerCase();
  if (!cleanEmail) return null;
  const session = useStore.getState().session;
  const me = session ? useStore.getState().db.users.find((u) => u.id === session.userId) : null;
  if (!me) return null;
  let created: import('@/lib/api/types').TeamInvite | null = null;
  tx((db) => {
    // Idempotent — if a pending invite already exists for this
    // (brand, email), reuse it. Avoids the brand burning multiple
    // tokens by re-clicking Send.
    const existing = (db.teamInvites ?? []).find(
      (i) => i.brandId === input.brandId
        && i.invitedEmail.toLowerCase() === cleanEmail
        && !i.acceptedAt
        && !i.revokedAt,
    );
    if (existing) { created = existing; return; }
    // 14-day expiry window — long enough for a casual recipient, short
    // enough that a leaked unaccepted token doesn't stay redeemable
    // forever. Brand owner can revoke earlier; expired invites cannot
    // be redeemed via v2AcceptTeamInvite.
    const TEAM_INVITE_TTL_DAYS = 14;
    const createdAtIso = new Date().toISOString();
    const expiresAtIso = new Date(
      Date.now() + TEAM_INVITE_TTL_DAYS * 24 * 60 * 60 * 1000,
    ).toISOString();
    const invite: import('@/lib/api/types').TeamInvite = {
      id: `inv_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      brandId: input.brandId,
      invitedByUserId: me.id,
      invitedEmail: cleanEmail,
      role: input.role,
      token: `tk_${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`,
      createdAt: createdAtIso,
      expiresAt: expiresAtIso,
    };
    db.teamInvites = [...(db.teamInvites ?? []), invite];
    created = invite;
  });

  // Fire-and-forget mirror.
  if (created && typeof window !== 'undefined') {
    const inviteToMirror = created;
    void (async () => {
      try {
        const { isSupabaseConfigured } = await import('@/lib/supabase');
        if (!isSupabaseConfigured()) return;
        const { insertTeamInviteInSupabase } = await import('@/lib/data/teamInvitesRepo');
        await insertTeamInviteInSupabase(inviteToMirror);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        // Idempotent re-insert hits duplicate-key; silence.
        if (/duplicate|already|row-level security|no rows|0 rows|not found/i.test(msg)) return;
        // eslint-disable-next-line no-console
        console.warn('[team invite mirror] failed:', msg);
      }
    })();
  }
  return created;
}

/** Brand owner revokes a pending invite (token can no longer be redeemed). */
export function v2RevokeTeamInvite(inviteId: string): boolean {
  let revokedAt: string | null = null;
  tx((db) => {
    const idx = (db.teamInvites ?? []).findIndex((i) => i.id === inviteId);
    if (idx === -1) return;
    const invite = db.teamInvites![idx];
    if (invite.acceptedAt || invite.revokedAt) return; // already terminal
    revokedAt = new Date().toISOString();
    db.teamInvites = [
      ...db.teamInvites!.slice(0, idx),
      { ...invite, revokedAt: revokedAt as string },
      ...db.teamInvites!.slice(idx + 1),
    ];
  });
  if (revokedAt && typeof window !== 'undefined') {
    const stamp = revokedAt;
    void (async () => {
      try {
        const { isSupabaseConfigured } = await import('@/lib/supabase');
        if (!isSupabaseConfigured()) return;
        const { updateTeamInviteInSupabase } = await import('@/lib/data/teamInvitesRepo');
        await updateTeamInviteInSupabase(inviteId, { revokedAt: stamp });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (/row-level security|no rows|0 rows|not found/i.test(msg)) return;
        // eslint-disable-next-line no-console
        console.warn('[team invite revoke mirror] failed:', msg);
      }
    })();
  }
  return revokedAt !== null;
}

/** Invitee accepts an invite by token. Attaches their User to the
 *  brand with the invite's role. Idempotent — re-accepting a
 *  previously-accepted invite returns success without mutating. */
export function v2AcceptTeamInvite(token: string): { ok: boolean; reason?: string } {
  const session = useStore.getState().session;
  if (!session) return { ok: false, reason: 'sign-in-required' };
  const me = useStore.getState().db.users.find((u) => u.id === session.userId);
  if (!me) return { ok: false, reason: 'sign-in-required' };

  let result: { ok: boolean; reason?: string } = { ok: false, reason: 'not-found' };
  tx((db) => {
    const idx = (db.teamInvites ?? []).findIndex((i) => i.token === token);
    if (idx === -1) { result = { ok: false, reason: 'not-found' }; return; }
    const invite = db.teamInvites![idx];
    if (invite.revokedAt) { result = { ok: false, reason: 'revoked' }; return; }
    if (invite.acceptedAt) { result = { ok: true }; return; } // idempotent
    // EXPIRY GATE — invites older than their 14-day window can't be
    // redeemed. Pre-fix tokens were forever-valid; a leaked never-
    // accepted invite was a permanent liability.
    if (invite.expiresAt && Date.now() > new Date(invite.expiresAt).getTime()) {
      result = { ok: false, reason: 'expired' };
      return;
    }
    if (invite.invitedEmail.toLowerCase() !== me.email.toLowerCase()) {
      result = { ok: false, reason: 'wrong-account' };
      return;
    }
    const acceptedAt = new Date().toISOString();
    // Update the invite.
    db.teamInvites = [
      ...db.teamInvites!.slice(0, idx),
      { ...invite, acceptedAt, acceptedByUserId: me.id },
      ...db.teamInvites!.slice(idx + 1),
    ];
    // Attach the user to the brand with the role.
    const uIdx = db.users.findIndex((u) => u.id === me.id);
    if (uIdx !== -1) {
      db.users[uIdx] = {
        ...db.users[uIdx],
        brandId: invite.brandId,
        role: 'brand',
        teamRole: invite.role,
      };
    }
    result = { ok: true };

    // Notify the inviter.
    db.notifications.push({
      id: `n_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      userId: invite.invitedByUserId,
      text: `${me.email} joined your team as ${invite.role}`,
      href: '/v2',
      at: acceptedAt,
      read: false,
      meta: {},
    });
  });

  // Mirror to Supabase if we actually accepted (skip on already-accepted).
  if (result.ok && result.reason !== 'revoked' && result.reason !== 'not-found' && typeof window !== 'undefined') {
    const meId = me.id;
    void (async () => {
      try {
        const { isSupabaseConfigured } = await import('@/lib/supabase');
        if (!isSupabaseConfigured()) return;
        const { updateTeamInviteInSupabase } = await import('@/lib/data/teamInvitesRepo');
        const invite = useStore.getState().db.teamInvites?.find((i) => i.token === token);
        if (invite?.acceptedAt) {
          await updateTeamInviteInSupabase(invite.id, {
            acceptedAt: invite.acceptedAt,
            acceptedByUserId: meId,
          });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (/row-level security|no rows|0 rows|not found/i.test(msg)) return;
        // eslint-disable-next-line no-console
        console.warn('[team invite accept mirror] failed:', msg);
      }
    })();
  }
  return result;
}

// =====================================================================
// Phase 15 — Spark drafts
// =====================================================================

/** Save (or overwrite) a Spark draft. If `draftId` is provided, the
 *  existing row is updated; otherwise a new row is inserted. Returns
 *  the saved draft so the caller can switch its activeDraftId state
 *  to the new id without re-querying the store. */
export function v2SaveSparkDraft(input: {
  brandId: string;
  draftId?: string;
  name?: string;
  history: unknown[];
  context: Record<string, unknown>;
}): import('@/lib/api/types').SparkDraft | null {
  let saved: import('@/lib/api/types').SparkDraft | null = null;
  tx((db) => {
    const now = new Date().toISOString();
    if (input.draftId) {
      const idx = (db.sparkDrafts ?? []).findIndex((d) => d.id === input.draftId);
      if (idx !== -1) {
        saved = {
          ...db.sparkDrafts![idx],
          name: input.name ?? db.sparkDrafts![idx].name,
          history: input.history,
          context: input.context,
          lastEditedAt: now,
        };
        db.sparkDrafts = [
          ...db.sparkDrafts!.slice(0, idx),
          saved,
          ...db.sparkDrafts!.slice(idx + 1),
        ];
        return;
      }
    }
    // New draft.
    saved = {
      id: `sd_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      brandId: input.brandId,
      name: input.name,
      history: input.history,
      context: input.context,
      lastEditedAt: now,
      createdAt: now,
    };
    db.sparkDrafts = [...(db.sparkDrafts ?? []), saved];
  });

  if (saved && typeof window !== 'undefined') {
    const toMirror = saved;
    void (async () => {
      try {
        const { isSupabaseConfigured } = await import('@/lib/supabase');
        if (!isSupabaseConfigured()) return;
        const { upsertSparkDraftInSupabase } = await import('@/lib/data/sparkDraftsRepo');
        await upsertSparkDraftInSupabase(toMirror);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (/row-level security|foreign key|no rows|0 rows|not found/i.test(msg)) return;
        // eslint-disable-next-line no-console
        console.warn('[spark draft save mirror] failed:', msg);
      }
    })();
  }
  return saved;
}

/** Delete a Spark draft. Idempotent — silent no-op on missing row. */
export function v2DeleteSparkDraft(draftId: string): boolean {
  let existed = false;
  tx((db) => {
    const len = db.sparkDrafts?.length ?? 0;
    db.sparkDrafts = (db.sparkDrafts ?? []).filter((d) => d.id !== draftId);
    existed = (db.sparkDrafts.length ?? 0) < len;
  });
  if (existed && typeof window !== 'undefined') {
    void (async () => {
      try {
        const { isSupabaseConfigured } = await import('@/lib/supabase');
        if (!isSupabaseConfigured()) return;
        const { deleteSparkDraftInSupabase } = await import('@/lib/data/sparkDraftsRepo');
        await deleteSparkDraftInSupabase(draftId);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (/row-level security|no rows|0 rows|not found/i.test(msg)) return;
        // eslint-disable-next-line no-console
        console.warn('[spark draft delete mirror] failed:', msg);
      }
    })();
  }
  return existed;
}

/** Helper for Spark: sync its shortlist into the brand's saved list. */
export function v2SyncSparkShortlist(creatorIds: string[]) {
  tx((db) => {
    const session = useStore.getState().session;
    const viewerId = getViewerUserId(db, session?.userId ?? null, 'brand');
    const me = db.users.find((u) => u.id === viewerId);
    if (!me?.brandId) return;
    const idx = db.brands.findIndex((b) => b.id === me.brandId);
    if (idx === -1) return;
    db.brands[idx] = {
      ...db.brands[idx],
      savedCreators: Array.from(new Set([...db.brands[idx].savedCreators, ...creatorIds])),
    };
  });
}

// =====================================================================
// Offer templates (Phase 50) — brand-scoped reusable offer prefabs.
// =====================================================================
//
// Local-only for the prototype: lives on `Brand.offerTemplates`. Same
// pattern as `savedCreators`. SendOfferModal reads them via
// useV2OfferTemplates() and writes through v2SaveOfferTemplate /
// v2DeleteOfferTemplate. Migration to a dedicated `offer_templates`
// table is straightforward when needed (mirror the sparkDrafts shape).

/** Templates for the current brand, sorted newest first. */
export function useV2OfferTemplates(): OfferTemplate[] {
  const brand = useV2CurrentBrand();
  return useMemo(() => {
    const list = brand?.offerTemplates ?? [];
    return [...list].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  }, [brand?.offerTemplates]);
}

/** Save (or update) an offer template on the current brand. */
export function v2SaveOfferTemplate(input: {
  id?: string;
  name: string;
  rate: number;
  message: string;
  deliverables?: string;
}): OfferTemplate | null {
  let saved: OfferTemplate | null = null;
  tx((db) => {
    const session = useStore.getState().session;
    const viewerId = getViewerUserId(db, session?.userId ?? null, 'brand');
    const me = db.users.find((u) => u.id === viewerId);
    if (!me?.brandId) return;
    const idx = db.brands.findIndex((b) => b.id === me.brandId);
    if (idx === -1) return;
    const brand = db.brands[idx];
    const existing = brand.offerTemplates ?? [];
    const id = input.id ?? `tpl_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const next: OfferTemplate = {
      id,
      name: input.name.trim() || 'Untitled template',
      rate: Math.max(0, Math.round(input.rate)),
      message: input.message,
      deliverables: input.deliverables?.trim() || undefined,
      createdAt: existing.find((t) => t.id === id)?.createdAt ?? new Date().toISOString(),
    };
    const merged = input.id
      ? existing.map((t) => (t.id === id ? next : t))
      : [...existing, next];
    db.brands[idx] = { ...brand, offerTemplates: merged };
    saved = next;
  });
  return saved;
}

/** Remove an offer template by id. */
export function v2DeleteOfferTemplate(templateId: string): boolean {
  let removed = false;
  tx((db) => {
    const session = useStore.getState().session;
    const viewerId = getViewerUserId(db, session?.userId ?? null, 'brand');
    const me = db.users.find((u) => u.id === viewerId);
    if (!me?.brandId) return;
    const idx = db.brands.findIndex((b) => b.id === me.brandId);
    if (idx === -1) return;
    const brand = db.brands[idx];
    const list = brand.offerTemplates ?? [];
    const next = list.filter((t) => t.id !== templateId);
    if (next.length === list.length) return;
    db.brands[idx] = { ...brand, offerTemplates: next };
    removed = true;
  });
  return removed;
}
