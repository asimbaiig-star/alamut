// realtimeChat.ts — Supabase Realtime subscription for chat (Phase 10).
//
// On boot (after the initial hydration overlays remote rows into the
// local store) we subscribe to `messages` and `threads` change events.
// Inserts/updates are normalised through the repos' row mappers and
// overlayed into useStore by id.
//
// Why subscribe instead of polling: chat is the one surface where
// cross-tab + cross-device freshness matters. Without realtime, a
// message sent from Sarah's phone wouldn't show up on her laptop until
// the next full hydration pass (which only runs on page load).
//
// Local echo handling: when the LOCAL user sends a message, the
// mutation pushes into db.messages immediately (instant UI), then the
// mirror writes to Supabase, then Postgres broadcasts the INSERT back
// to every subscriber including the sender. The overlay-by-id check
// makes the second-arrival a no-op (id already exists locally), so
// there's no duplicate. Same for threads.

import { useStore } from '@/lib/api/store';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';
import type { Message, Thread } from '@/lib/api/types';

type ChannelHandle = { unsubscribe: () => void } | null;

let activeChannel: ChannelHandle = null;

/** Mount the chat subscription. Idempotent — multiple calls return the
 *  same active channel. Auto-no-op when Supabase isn't configured.
 *  Call once at app boot, after initial hydration completes. */
export function mountChatRealtime(): void {
  if (typeof window === 'undefined') return;
  if (activeChannel) return; // already mounted
  if (!isSupabaseConfigured()) return;

  const sb = getSupabase();

  const channel = sb
    .channel('chat')
    .on(
      // postgres_changes payload shape: { eventType, new, old, table, ... }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      'postgres_changes' as any,
      { event: 'INSERT', schema: 'public', table: 'messages' },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      async (payload: any) => {
        try {
          const { rowToMessage } = await import('@/lib/data/messagesRepo');
          const incoming: Message = rowToMessage(payload.new);
          useStore.setState((s) => {
            // Overlay by id — if the message already exists locally
            // (we just sent it ourselves and the round-trip echoed back),
            // this is a no-op.
            if (s.db.messages.some((m) => m.id === incoming.id)) return s;
            return { db: { ...s.db, messages: [...s.db.messages, incoming] } };
          });
        } catch (err) {
          // eslint-disable-next-line no-console
          console.warn('[realtimeChat] message insert overlay failed:', err);
        }
      },
    )
    .on(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      'postgres_changes' as any,
      { event: 'INSERT', schema: 'public', table: 'threads' },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      async (payload: any) => {
        try {
          const { rowToThread } = await import('@/lib/data/threadsRepo');
          const incoming: Thread = rowToThread(payload.new);
          useStore.setState((s) => {
            if (s.db.threads.some((t) => t.id === incoming.id)) return s;
            return { db: { ...s.db, threads: [...s.db.threads, incoming] } };
          });
        } catch (err) {
          // eslint-disable-next-line no-console
          console.warn('[realtimeChat] thread insert overlay failed:', err);
        }
      },
    )
    .on(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      'postgres_changes' as any,
      { event: 'UPDATE', schema: 'public', table: 'threads' },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      async (payload: any) => {
        try {
          const { rowToThread } = await import('@/lib/data/threadsRepo');
          const incoming: Thread = rowToThread(payload.new);
          useStore.setState((s) => {
            // Replace by id. If we don't have the thread yet, append it
            // (the INSERT broadcast might be racing with this UPDATE on a
            // fresh tab).
            let found = false;
            const next = s.db.threads.map((t) => {
              if (t.id === incoming.id) { found = true; return incoming; }
              return t;
            });
            if (!found) next.push(incoming);
            return { db: { ...s.db, threads: next } };
          });
        } catch (err) {
          // eslint-disable-next-line no-console
          console.warn('[realtimeChat] thread update overlay failed:', err);
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
export function unmountChatRealtime(): void {
  if (activeChannel) {
    activeChannel.unsubscribe();
    activeChannel = null;
  }
}
