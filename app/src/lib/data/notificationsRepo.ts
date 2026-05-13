// Supabase repository for the Notification entity (Migration 023).
//
// Reads: only your own (RLS gates by `auth.email() = owner_email`).
// Writes: any authenticated session can INSERT — the workflow layer
// gates which mutations push notifications, so trust-the-mutation is
// the security model for the prototype.
//
// The TS Notification type doesn't carry `ownerEmail` (it's a server-
// side RLS gate, not part of the client model), so insertNotification
// takes it as a separate parameter — same shape as brandsRepo.insert.

import type { Notification } from '@/lib/api/types';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';

type Row = {
  id: string;
  user_id: string;
  owner_email: string;
  text: string;
  href: string | null;
  at: string;
  read: boolean;
  meta: Notification['meta'] | null;
  created_at: string;
  updated_at: string;
};

const COLUMNS =
  'id, user_id, owner_email, text, href, at, read, meta, created_at, updated_at';

export function toNotification(row: Row): Notification {
  return {
    id: row.id,
    userId: row.user_id,
    text: row.text,
    href: row.href ?? undefined,
    at: row.at,
    read: row.read,
    meta: row.meta ?? undefined,
  };
}

/** Fetch every notification visible to the current session. With the
 *  owner-only SELECT policy this is "my notifications". The bell UI
 *  reads from the local store, so this is the boot-time overlay
 *  that lets a second-device sign-in see the user's history. */
export async function fetchAllNotificationsFromSupabase(): Promise<Notification[]> {
  if (!isSupabaseConfigured()) return [];
  const sb = getSupabase();
  const { data, error } = await sb
    .from('notifications')
    .select(COLUMNS)
    .order('at', { ascending: false });
  if (error) {
    // eslint-disable-next-line no-console
    console.warn('[notificationsRepo] fetchAll failed:', error.message);
    return [];
  }
  return (data ?? []).map((r) => toNotification(r as unknown as Row));
}

/** Insert a notification row. ownerEmail is the recipient's email
 *  (the RLS SELECT gate, not in the Notification TS type). The
 *  INSERT policy allows any authenticated session, so user A can
 *  write a notification for user B — required for offer-sent,
 *  application-decided, etc. workflows. */
export async function insertNotificationInSupabase(
  n: Notification,
  ownerEmail: string,
): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const sb = getSupabase();
  const row = {
    id: n.id,
    user_id: n.userId,
    owner_email: ownerEmail,
    text: n.text,
    href: n.href ?? null,
    at: n.at,
    read: n.read,
    meta: n.meta ?? null,
  };
  const { error } = await sb.from('notifications').insert(row);
  // Duplicate-id (unique violation) is a harmless retry — silently swallow.
  if (error && !/duplicate|unique/i.test(error.message)) {
    throw new Error(error.message);
  }
}

/** Mark one or more notifications as read. Used by the bell click +
 *  mark-all flows. RLS UPDATE policy gates this to the owner's
 *  notifications only, so a leaked id from another user is a no-op. */
export async function markNotificationsReadInSupabase(
  ids: string[],
): Promise<void> {
  if (!isSupabaseConfigured()) return;
  if (ids.length === 0) return;
  const sb = getSupabase();
  const { error } = await sb
    .from('notifications')
    .update({ read: true })
    .in('id', ids);
  if (error) {
    // eslint-disable-next-line no-console
    console.warn('[notificationsRepo] markRead failed:', error.message);
  }
}
