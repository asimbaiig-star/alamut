// realtimeWorkflow.ts — Supabase Realtime subscription for the 6
// workflow tables (campaigns / offers / applications / submissions /
// collaborations / disputes).
//
// Companion to realtimeChat.ts (Phase 10). Migration 022 added these
// tables to the supabase_realtime publication. This file subscribes
// to INSERT + UPDATE events and overlays the incoming rows into the
// local Zustand store by id, mirroring the local-echo dedupe pattern.
//
// Why six tables: the audit + optimistic-lock work hardens the write
// path against races, but the read path was still polling-on-page-load.
// A brand accepting an offer in tab A should propagate to tab B (or
// the creator's session on another device) within seconds, not on next
// reload. This closes that gap.
//
// DELETE events are intentionally skipped — none of the 6 tables get
// hard-deleted by the app (stage transitions use status columns, not
// row removal). If we ever add a delete path we can extend here.

import { useStore } from '@/lib/api/store';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';
import type {
  Application, Campaign, Collaboration, Dispute, Offer, Submission,
} from '@/lib/api/types';

type ChannelHandle = { unsubscribe: () => void } | null;

let activeChannel: ChannelHandle = null;

/** Mount the workflow-table subscriptions. Idempotent — multiple calls
 *  return the same active channel. Auto-no-op when Supabase isn't
 *  configured. Call once at app boot, after initial hydration. */
export function mountWorkflowRealtime(): void {
  if (typeof window === 'undefined') return;
  if (activeChannel) return;
  if (!isSupabaseConfigured()) return;

  const sb = getSupabase();

  // Single channel multiplexes all 6 tables — cheaper than 6 channels.
  const channel = sb.channel('workflow');

  // ─── campaigns ────────────────────────────────────────────────────────
  channel
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .on('postgres_changes' as any,
      { event: '*', schema: 'public', table: 'campaigns' },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      async (payload: any) => {
        try {
          const { toCampaign } = await import('@/lib/data/campaignsRepo');
          const next: Campaign = toCampaign(payload.new);
          useStore.setState((s) => overlay(s, 'campaigns', next));
        } catch (err) {
          // eslint-disable-next-line no-console
          console.warn('[realtimeWorkflow] campaigns overlay failed:', err);
        }
      },
    )
    // ─── offers ───────────────────────────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .on('postgres_changes' as any,
      { event: '*', schema: 'public', table: 'offers' },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      async (payload: any) => {
        try {
          const { toOffer } = await import('@/lib/data/offersRepo');
          const next: Offer = toOffer(payload.new);
          useStore.setState((s) => overlay(s, 'offers', next));
        } catch (err) {
          // eslint-disable-next-line no-console
          console.warn('[realtimeWorkflow] offers overlay failed:', err);
        }
      },
    )
    // ─── applications ────────────────────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .on('postgres_changes' as any,
      { event: '*', schema: 'public', table: 'applications' },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      async (payload: any) => {
        try {
          const { toApplication } = await import('@/lib/data/applicationsRepo');
          const next: Application = toApplication(payload.new);
          useStore.setState((s) => overlay(s, 'applications', next));
        } catch (err) {
          // eslint-disable-next-line no-console
          console.warn('[realtimeWorkflow] applications overlay failed:', err);
        }
      },
    )
    // ─── submissions ─────────────────────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .on('postgres_changes' as any,
      { event: '*', schema: 'public', table: 'submissions' },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      async (payload: any) => {
        try {
          const { toSubmission } = await import('@/lib/data/submissionsRepo');
          const next: Submission = toSubmission(payload.new);
          useStore.setState((s) => overlay(s, 'submissions', next));
        } catch (err) {
          // eslint-disable-next-line no-console
          console.warn('[realtimeWorkflow] submissions overlay failed:', err);
        }
      },
    )
    // ─── collaborations ──────────────────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .on('postgres_changes' as any,
      { event: '*', schema: 'public', table: 'collaborations' },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      async (payload: any) => {
        try {
          const { toCollab } = await import('@/lib/data/collaborationsRepo');
          const next: Collaboration = toCollab(payload.new);
          useStore.setState((s) => overlay(s, 'collaborations', next));
        } catch (err) {
          // eslint-disable-next-line no-console
          console.warn('[realtimeWorkflow] collaborations overlay failed:', err);
        }
      },
    )
    // ─── disputes ────────────────────────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .on('postgres_changes' as any,
      { event: '*', schema: 'public', table: 'disputes' },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      async (payload: any) => {
        try {
          const { toDispute } = await import('@/lib/data/disputesRepo');
          const next: Dispute = toDispute(payload.new);
          useStore.setState((s) => overlay(s, 'disputes', next));
        } catch (err) {
          // eslint-disable-next-line no-console
          console.warn('[realtimeWorkflow] disputes overlay failed:', err);
        }
      },
    )
    .subscribe();

  activeChannel = {
    unsubscribe: () => {
      void sb.removeChannel(channel);
    },
  };
}

/** Tear down the subscription. Used in tests + hot-reload. */
export function unmountWorkflowRealtime(): void {
  if (activeChannel) {
    activeChannel.unsubscribe();
    activeChannel = null;
  }
}

// =====================================================================
// Helpers
// =====================================================================

/** Replace-or-append by id. Versioned tables (all six are post-020/021)
 *  carry a `version` field — when the incoming row has a strictly older
 *  version than the local copy, we drop it; otherwise we replace. This
 *  protects the local optimistic-lock writeBack from being clobbered
 *  by an out-of-order broadcast. */
type Versioned = { id: string; version?: number };
type WorkflowKey = 'campaigns' | 'offers' | 'applications' | 'submissions' | 'collaborations' | 'disputes';

function overlay<K extends WorkflowKey>(
  state: ReturnType<typeof useStore.getState>,
  table: K,
  incoming: Versioned,
): Partial<ReturnType<typeof useStore.getState>> {
  const list = state.db[table] as Versioned[];
  const idx = list.findIndex((r) => r.id === incoming.id);
  if (idx === -1) {
    return { db: { ...state.db, [table]: [...list, incoming] } } as Partial<ReturnType<typeof useStore.getState>>;
  }
  const existing = list[idx];
  // Skip older-or-equal versions to preserve local writeBack ordering.
  if (
    typeof existing.version === 'number' &&
    typeof incoming.version === 'number' &&
    incoming.version <= existing.version
  ) {
    return state;
  }
  const next = list.slice();
  next[idx] = incoming;
  return { db: { ...state.db, [table]: next } } as Partial<ReturnType<typeof useStore.getState>>;
}
