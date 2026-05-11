// Supabase repository for the Message entity (Phase 10).
//
// Messages are INSERT-only — no edit, no delete. Realtime broadcasts
// INSERT events; the chat subscription overlays them into the local
// store so peer clients see messages without polling.

import type { Message, MessageAttachment } from '@/lib/api/types';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';

type Row = {
  id: string;
  thread_id: string;
  from_user_id: string;
  text: string;
  at: string;
  attachments: MessageAttachment[] | null;
  created_at: string;
};

const COLUMNS = 'id, thread_id, from_user_id, text, at, attachments, created_at';

function toMessage(row: Row): Message {
  return {
    id: row.id,
    threadId: row.thread_id,
    fromUserId: row.from_user_id,
    text: row.text,
    at: row.at,
    attachments: row.attachments ?? undefined,
  };
}

function toInsertRow(m: Message): Record<string, unknown> {
  return {
    id: m.id,
    thread_id: m.threadId,
    from_user_id: m.fromUserId,
    text: m.text,
    at: m.at,
    attachments: m.attachments ?? null,
  };
}

export async function fetchAllMessagesFromSupabase(): Promise<Message[]> {
  if (!isSupabaseConfigured()) return [];
  const sb = getSupabase();
  const { data, error } = await sb.from('messages').select(COLUMNS);
  if (error) {
    // eslint-disable-next-line no-console
    console.warn('[messagesRepo] fetchAll failed:', error.message);
    return [];
  }
  return (data ?? []).map((r) => toMessage(r as unknown as Row));
}

export async function insertMessageInSupabase(m: Message): Promise<Message> {
  if (!isSupabaseConfigured()) throw new Error('Supabase not configured');
  const sb = getSupabase();
  const { data, error } = await sb
    .from('messages')
    .insert(toInsertRow(m))
    .select(COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  if (!data) throw new Error('Insert returned no row');
  return toMessage(data as unknown as Row);
}

/** Row mapper exposed for the realtime subscription. */
export function rowToMessage(row: Record<string, unknown>): Message {
  return toMessage(row as unknown as Row);
}
