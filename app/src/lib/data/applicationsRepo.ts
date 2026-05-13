// Supabase repository for the Application entity (Phase 4).
//
// Reads come from public.applications (public SELECT policy).
// Writes are gated by `to authenticated`. Phase 5 will tighten RLS
// to per-party rules once creators are in auth.users.

import type { Application, ApplicationStatus } from '@/lib/api/types';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';
import { StaleVersionError, isNoRowsError } from './optimisticLock';

type Row = {
  id: string;
  campaign_id: string;
  creator_id: string;
  pitch: string;
  proposed_rate: number | null;
  status: ApplicationStatus;
  submitted_at: string;
  decided_at: string | null;
  collaboration_id: string | null;
  version: number;
  created_at: string;
  updated_at: string;
};

const COLUMNS =
  'id, campaign_id, creator_id, pitch, proposed_rate, status, ' +
  'submitted_at, decided_at, collaboration_id, version, created_at, updated_at';

export function toApplication(row: Row): Application {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    creatorId: row.creator_id,
    pitch: row.pitch,
    proposedRate: row.proposed_rate ?? undefined,
    status: row.status,
    submittedAt: row.submitted_at,
    decidedAt: row.decided_at ?? undefined,
    collaborationId: row.collaboration_id ?? undefined,
    version: row.version,
  };
}

function toInsertRow(a: Application): Record<string, unknown> {
  return {
    id: a.id,
    campaign_id: a.campaignId,
    creator_id: a.creatorId,
    pitch: a.pitch,
    proposed_rate: a.proposedRate ?? null,
    status: a.status,
    submitted_at: a.submittedAt,
    decided_at: a.decidedAt ?? null,
    collaboration_id: a.collaborationId ?? null,
  };
}

type UpdatablePatch = Partial<{
  status: ApplicationStatus;
  decidedAt: string;
  pitch: string;
  proposedRate: number;
  collaborationId: string;
}>;

function toUpdateRowPatch(patch: UpdatablePatch): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (patch.status !== undefined)          out.status = patch.status;
  if (patch.decidedAt !== undefined)       out.decided_at = patch.decidedAt;
  if (patch.pitch !== undefined)           out.pitch = patch.pitch;
  if (patch.proposedRate !== undefined)    out.proposed_rate = patch.proposedRate;
  if (patch.collaborationId !== undefined) out.collaboration_id = patch.collaborationId;
  return out;
}

export async function fetchAllApplicationsFromSupabase(): Promise<Application[]> {
  if (!isSupabaseConfigured()) return [];
  const sb = getSupabase();
  const { data, error } = await sb.from('applications').select(COLUMNS);
  if (error) {
    // eslint-disable-next-line no-console
    console.warn('[applicationsRepo] fetchAll failed:', error.message);
    return [];
  }
  return (data ?? []).map((r) => toApplication(r as unknown as Row));
}

export async function insertApplicationInSupabase(a: Application): Promise<Application> {
  if (!isSupabaseConfigured()) throw new Error('Supabase not configured');
  const sb = getSupabase();
  const { data, error } = await sb
    .from('applications')
    .insert(toInsertRow(a))
    .select(COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  if (!data) throw new Error('Insert returned no row');
  return toApplication(data as unknown as Row);
}

export async function updateApplicationInSupabase(
  applicationId: string,
  patch: UpdatablePatch,
  expectedVersion?: number,
): Promise<Application> {
  if (!isSupabaseConfigured()) throw new Error('Supabase not configured');
  const sb = getSupabase();
  const rowPatch = toUpdateRowPatch(patch);
  let q = sb
    .from('applications')
    .update({ ...rowPatch, version: (expectedVersion ?? 0) + 1 })
    .eq('id', applicationId);
  if (expectedVersion !== undefined) q = q.eq('version', expectedVersion);
  try {
    const { data, error } = await q.select(COLUMNS).single();
    if (error) {
      if (expectedVersion !== undefined && isNoRowsError(error)) {
        throw new StaleVersionError('application', applicationId);
      }
      throw new Error(error.message);
    }
    if (!data) throw new Error('Application not found');
    return toApplication(data as unknown as Row);
  } catch (err) {
    if (err instanceof StaleVersionError) throw err;
    if (expectedVersion !== undefined && isNoRowsError(err)) {
      throw new StaleVersionError('application', applicationId);
    }
    throw err;
  }
}
