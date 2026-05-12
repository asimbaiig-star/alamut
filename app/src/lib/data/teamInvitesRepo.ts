// Supabase repository for the TeamInvite entity (Phase 14).
//
// Lifecycle:
//   - INSERT: brand owner creates an invite (v2SendTeamInvite)
//   - SELECT: brand owner sees all their pending/accepted/revoked
//             invites; invitee (by email match) sees their pending ones
//   - UPDATE: brand owner can revoke; invitee (matching email) can
//             accept. RLS enforces both.

import type { TeamInvite, TeamRole } from '@/lib/api/types';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';

type Row = {
  id: string;
  brand_id: string;
  invited_by_user_id: string;
  invited_email: string;
  role: TeamRole;
  token: string;
  created_at: string;
  accepted_at: string | null;
  accepted_by_user_id: string | null;
  revoked_at: string | null;
  updated_at: string;
};

const COLUMNS =
  'id, brand_id, invited_by_user_id, invited_email, role, token, ' +
  'created_at, accepted_at, accepted_by_user_id, revoked_at, updated_at';

function toInvite(row: Row): TeamInvite {
  return {
    id: row.id,
    brandId: row.brand_id,
    invitedByUserId: row.invited_by_user_id,
    invitedEmail: row.invited_email,
    role: row.role,
    token: row.token,
    createdAt: row.created_at,
    acceptedAt: row.accepted_at ?? undefined,
    acceptedByUserId: row.accepted_by_user_id ?? undefined,
    revokedAt: row.revoked_at ?? undefined,
  };
}

function toInsertRow(t: TeamInvite): Record<string, unknown> {
  return {
    id: t.id,
    brand_id: t.brandId,
    invited_by_user_id: t.invitedByUserId,
    invited_email: t.invitedEmail.toLowerCase(),
    role: t.role,
    token: t.token,
    created_at: t.createdAt,
    accepted_at: t.acceptedAt ?? null,
    accepted_by_user_id: t.acceptedByUserId ?? null,
    revoked_at: t.revokedAt ?? null,
  };
}

type UpdatablePatch = Partial<{
  acceptedAt: string | null;
  acceptedByUserId: string | null;
  revokedAt: string | null;
}>;

function toUpdateRowPatch(patch: UpdatablePatch): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (patch.acceptedAt !== undefined) out.accepted_at = patch.acceptedAt;
  if (patch.acceptedByUserId !== undefined) out.accepted_by_user_id = patch.acceptedByUserId;
  if (patch.revokedAt !== undefined) out.revoked_at = patch.revokedAt;
  return out;
}

export async function fetchAllTeamInvitesFromSupabase(): Promise<TeamInvite[]> {
  if (!isSupabaseConfigured()) return [];
  const sb = getSupabase();
  const { data, error } = await sb.from('team_invites').select(COLUMNS);
  if (error) {
    // eslint-disable-next-line no-console
    console.warn('[teamInvitesRepo] fetchAll failed:', error.message);
    return [];
  }
  return (data ?? []).map((r) => toInvite(r as unknown as Row));
}

/** Look up an invite by its token — used by the AcceptInvite page when
 *  the user arrives via the share URL. SELECT is RLS-gated so an
 *  unauthenticated user can't read invites unless their email matches;
 *  in practice the accept page should be auth-gated first. */
export async function fetchInviteByToken(token: string): Promise<TeamInvite | null> {
  if (!isSupabaseConfigured()) return null;
  const sb = getSupabase();
  const { data, error } = await sb.from('team_invites').select(COLUMNS).eq('token', token).maybeSingle();
  if (error || !data) return null;
  return toInvite(data as unknown as Row);
}

export async function insertTeamInviteInSupabase(t: TeamInvite): Promise<TeamInvite> {
  if (!isSupabaseConfigured()) throw new Error('Supabase not configured');
  const sb = getSupabase();
  const { data, error } = await sb
    .from('team_invites')
    .insert(toInsertRow(t))
    .select(COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  if (!data) throw new Error('Insert returned no row');
  return toInvite(data as unknown as Row);
}

export async function updateTeamInviteInSupabase(
  inviteId: string,
  patch: UpdatablePatch,
): Promise<TeamInvite> {
  if (!isSupabaseConfigured()) throw new Error('Supabase not configured');
  const sb = getSupabase();
  const { data, error } = await sb
    .from('team_invites')
    .update(toUpdateRowPatch(patch))
    .eq('id', inviteId)
    .select(COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  if (!data) throw new Error('Invite not found');
  return toInvite(data as unknown as Row);
}
