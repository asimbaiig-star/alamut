// Supabase repository for the Thread entity (Phase 10).
//
// Threads are INSERT-once + UPDATE for last_message_at + unread_for.
// Realtime broadcasts UPDATE events on this table so peer clients
// can refresh their unread counts as messages flow.

import type { Thread } from '@/lib/api/types';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';

type Row = {
  id: string;
  participants: string[];
  campaign_id: string | null;
  subject: string;
  last_message_at: string;
  unread_for: string[];
  collaboration_id: string | null;
  created_at: string;
  updated_at: string;
};

const COLUMNS =
  'id, participants, campaign_id, subject, last_message_at, ' +
  'unread_for, collaboration_id, created_at, updated_at';

function toThread(row: Row): Thread {
  return {
    id: row.id,
    participants: row.participants ?? [],
    campaignId: row.campaign_id ?? undefined,
    subject: row.subject,
    lastMessageAt: row.last_message_at,
    unreadFor: row.unread_for ?? [],
    collaborationId: row.collaboration_id ?? null,
  };
}

function toInsertRow(t: Thread): Record<string, unknown> {
  return {
    id: t.id,
    participants: t.participants,
    campaign_id: t.campaignId ?? null,
    subject: t.subject,
    last_message_at: t.lastMessageAt,
    unread_for: t.unreadFor,
    collaboration_id: t.collaborationId,
  };
}

type UpdatablePatch = Partial<{
  lastMessageAt: string;
  unreadFor: string[];
  collaborationId: string | null;
}>;

function toUpdateRowPatch(patch: UpdatablePatch): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (patch.lastMessageAt !== undefined) out.last_message_at = patch.lastMessageAt;
  if (patch.unreadFor !== undefined) out.unread_for = patch.unreadFor;
  if (patch.collaborationId !== undefined) out.collaboration_id = patch.collaborationId;
  return out;
}

export async function fetchAllThreadsFromSupabase(): Promise<Thread[]> {
  if (!isSupabaseConfigured()) return [];
  const sb = getSupabase();
  const { data, error } = await sb.from('threads').select(COLUMNS);
  if (error) {
    // eslint-disable-next-line no-console
    console.warn('[threadsRepo] fetchAll failed:', error.message);
    return [];
  }
  return (data ?? []).map((r) => toThread(r as unknown as Row));
}

export async function insertThreadInSupabase(t: Thread): Promise<Thread> {
  if (!isSupabaseConfigured()) throw new Error('Supabase not configured');
  const sb = getSupabase();
  const { data, error } = await sb
    .from('threads')
    .insert(toInsertRow(t))
    .select(COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  if (!data) throw new Error('Insert returned no row');
  return toThread(data as unknown as Row);
}

export async function updateThreadInSupabase(
  threadId: string,
  patch: UpdatablePatch,
): Promise<Thread> {
  if (!isSupabaseConfigured()) throw new Error('Supabase not configured');
  const sb = getSupabase();
  const rowPatch = toUpdateRowPatch(patch);
  const { data, error } = await sb
    .from('threads')
    .update(rowPatch)
    .eq('id', threadId)
    .select(COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  if (!data) throw new Error('Thread not found');
  return toThread(data as unknown as Row);
}

/** Row mapper exposed so the realtime subscription can hand its raw
 *  postgres_changes payload through the same toThread() normaliser
 *  the fetch path uses. */
export function rowToThread(row: Record<string, unknown>): Thread {
  return toThread(row as unknown as Row);
}
