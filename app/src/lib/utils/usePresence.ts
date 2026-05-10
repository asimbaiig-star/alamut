// Cross-tab presence via BroadcastChannel (Phase 22).
//
// Built for the admin moderation flow — two ops opening the same dispute
// at the same time would race to resolve, releasing or refunding the same
// escrow twice. Real backend would gate this server-side; in our local-
// first demo we use BroadcastChannel to detect when another tab on the
// same origin is "viewing" the same entity, and surface a banner so the
// human ops can coordinate.
//
// Design:
//   - Each viewer has a stable `selfId` (random per tab) + a friendly label
//     (the user's email or display name).
//   - When a component mounts on an entity (e.g. dispute "d_42"), it
//     broadcasts a `present` message and starts a heartbeat (5s).
//   - When it unmounts (or the page closes), it broadcasts `leave`.
//   - Other tabs maintain a viewers map keyed by `entityId → viewerId →
//     { label, lastSeen }` and prune entries older than 12s.
//   - A new tab joining shouts `whois?` and existing viewers re-broadcast
//     so the new tab sees them immediately.
//
// Falls back gracefully to a no-op when BroadcastChannel isn't available
// (older Safari, IE, or Node SSR).

import { useEffect, useRef, useState } from 'react';

const CHANNEL = 'alamut:presence';
const HEARTBEAT_MS = 5_000;
const STALE_MS = 12_000;

interface Msg {
  type: 'present' | 'leave' | 'whois';
  entityId: string;
  viewerId: string;
  label?: string;
  /** Free-form context shown in the presence banner (e.g. "reviewing"). */
  intent?: string;
  at: number;
}

export interface Viewer {
  viewerId: string;
  label: string;
  intent?: string;
  lastSeen: number;
}

// Module-level singleton channel so multiple useEffects share the same socket.
let channel: BroadcastChannel | null = null;
function getChannel(): BroadcastChannel | null {
  if (typeof BroadcastChannel === 'undefined') return null;
  if (!channel) channel = new BroadcastChannel(CHANNEL);
  return channel;
}

// Stable per-tab id — random; survives only the tab session.
const SELF_ID =
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `v_${Math.random().toString(36).slice(2)}_${Date.now()}`;

/**
 * Broadcast that THIS tab is viewing `entityId`, and observe other tabs
 * doing the same. Returns the list of OTHER viewers (i.e. excluding self).
 *
 * @param entityId  Domain key like `dispute:d_42` or `creator:c_77`.
 * @param label     Display name for this viewer (typically user's email).
 * @param intent    Optional context string ("reviewing", "resolving").
 */
export function usePresence(
  entityId: string | null,
  label: string,
  intent?: string,
): Viewer[] {
  const [others, setOthers] = useState<Viewer[]>([]);
  // Phase 22 QA fix: stash label/intent in a ref so the effect doesn't
  // tear down + re-subscribe (with present/leave flapping visible to other
  // tabs as flicker) on every render. The handler closures read the
  // current values via `.current` at fire time.
  const metaRef = useRef({ label, intent });
  metaRef.current = { label, intent };

  useEffect(() => {
    if (!entityId) return;
    const ch = getChannel();
    if (!ch) return; // No BroadcastChannel — silently no-op.

    // Map of OTHER viewers we've heard from for this entityId.
    const viewers = new Map<string, Viewer>();
    const flush = () => {
      const now = Date.now();
      // Drop entries older than STALE_MS (the other tab probably closed).
      for (const [id, v] of viewers) {
        if (now - v.lastSeen > STALE_MS) viewers.delete(id);
      }
      setOthers(Array.from(viewers.values()));
    };

    const onMsg = (ev: MessageEvent<Msg>) => {
      const m = ev.data;
      if (!m || m.entityId !== entityId) return;
      if (m.viewerId === SELF_ID) return; // Ignore self echoes (just in case).
      if (m.type === 'leave') {
        viewers.delete(m.viewerId);
        flush();
        return;
      }
      if (m.type === 'whois') {
        // Someone just joined — re-announce so they pick us up immediately.
        const { label: l, intent: i } = metaRef.current;
        ch.postMessage({ type: 'present', entityId, viewerId: SELF_ID, label: l, intent: i, at: Date.now() } satisfies Msg);
        return;
      }
      // 'present'
      viewers.set(m.viewerId, {
        viewerId: m.viewerId,
        label: m.label || 'Someone',
        intent: m.intent,
        lastSeen: m.at,
      });
      flush();
    };

    ch.addEventListener('message', onMsg);

    // Announce ourselves + ask who else is on this entity.
    const announce = () => {
      const { label: l, intent: i } = metaRef.current;
      ch.postMessage({ type: 'present', entityId, viewerId: SELF_ID, label: l, intent: i, at: Date.now() } satisfies Msg);
    };
    ch.postMessage({ type: 'whois', entityId, viewerId: SELF_ID, at: Date.now() } satisfies Msg);
    announce();

    const heartbeat = setInterval(announce, HEARTBEAT_MS);
    const prune = setInterval(flush, HEARTBEAT_MS);

    // Window close / route change cleanup
    const onBeforeUnload = () => ch.postMessage({ type: 'leave', entityId, viewerId: SELF_ID, at: Date.now() } satisfies Msg);
    window.addEventListener('beforeunload', onBeforeUnload);

    return () => {
      clearInterval(heartbeat);
      clearInterval(prune);
      ch.removeEventListener('message', onMsg);
      // Phase 22 QA fix: this WAS already removing the listener — keeping
      // the explicit removal here, plus posting `leave` so other tabs prune.
      window.removeEventListener('beforeunload', onBeforeUnload);
      ch.postMessage({ type: 'leave', entityId, viewerId: SELF_ID, at: Date.now() } satisfies Msg);
    };
    // Phase 22 QA fix: only `entityId` triggers re-subscribe. Label/intent
    // changes are observed via metaRef without rebinding listeners.
  }, [entityId]);

  return others;
}
