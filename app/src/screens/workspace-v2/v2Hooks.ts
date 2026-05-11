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
import type { Brand, Creator, Database } from '@/lib/api/types';
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

function getViewerUserId(db: Database, sessionUserId: string | null, persona: 'brand' | 'creator'): string {
  // 1. If we have a session AND the user has the right kind of profile for
  //    the active persona, use the session identity.
  if (sessionUserId) {
    const me = db.users.find((u) => u.id === sessionUserId);
    if (me) {
      if (persona === 'brand' && me.brandId) return sessionUserId;
      if (persona === 'creator' && me.creatorId) return sessionUserId;
    }
    // Session exists but the persona doesn't match the role (cross-persona
    // preview — e.g. a brand user flipped to "creator" view). Fall through
    // to the demo identity for that persona so the surfaces still render.
  }
  // 2. Demo fallback by persona — only reachable in unauthenticated dev
  //    contexts or during cross-persona view. After Phase C lands real
  //    auth, the unauthenticated branch never fires because the route is
  //    gated by ProtectedRoute.
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

/** Current creator record (resolved from session or demo fallback). */
export function useV2CurrentCreator(): Creator | null {
  const db = useDB();
  const session = useStore((s) => s.session);
  const viewerUserId = getViewerUserId(db, session?.userId ?? null, 'creator');
  const me = db.users.find((u) => u.id === viewerUserId);
  return me?.creatorId ? db.creators.find((c) => c.id === me.creatorId) ?? null : null;
}

/** Brand wallet shape derived from the current brand and ledger. */
export function useV2BrandWallet() {
  const db = useDB();
  const brand = useV2CurrentBrand();
  return useMemo(() => {
    if (!brand) {
      return { available: 0, reserved: 0, inFlight: 0, currency: 'USD' as const, ledger: [] };
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
  });
  // Phase 5 — mirror the savedBriefs column to Supabase. RLS gates
  // by auth.email() = owner_email so only the right creator can
  // land the write.
  if (creatorId && nextSavedBriefs !== undefined) {
    void (async () => {
      try {
        const { updateCreatorInSupabase } = await import('@/lib/data/creatorsRepo');
        await updateCreatorInSupabase(creatorId!, { savedBriefs: nextSavedBriefs });
      } catch (err) {
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

/** Send a message in a thread, from the current viewer. */
export function v2SendMessage(threadId: string, text: string) {
  if (!text.trim()) return;
  let newMsg: import('@/lib/api/types').Message | null = null;
  let threadPatch: { lastMessageAt: string; unreadFor: string[] } | null = null;
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
    };
    db.messages.push(newMsg);
    const idx = db.threads.findIndex((t) => t.id === threadId);
    if (idx !== -1) {
      const thread = db.threads[idx];
      // Mark unread for everyone except sender
      const others = thread.participants.filter((p) => p !== viewerId);
      const nextUnreadFor = Array.from(new Set([...thread.unreadFor.filter((u) => u !== viewerId), ...others]));
      threadPatch = { lastMessageAt: now, unreadFor: nextUnreadFor };
      db.threads[idx] = {
        ...thread,
        lastMessageAt: now,
        unreadFor: nextUnreadFor,
      };
    }
  });
  if (newMsg) mirrorMessageInsert(newMsg);
  if (threadPatch) mirrorThreadPatch(threadId, threadPatch);
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
