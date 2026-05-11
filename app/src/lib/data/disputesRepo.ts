// Supabase repository for the Dispute entity (Phase 8 lite).
//
// Disputes have an INSERT (raise) plus three UPDATE paths:
//   - withdraw   (status → withdrawn)
//   - message    (messages[] append, updatedAt bumps)
//   - resolve    (status → resolved-*, resolution populated)

import type {
  Dispute, DisputeStatus, DisputeCategory, DisputeMessage, DisputeEvidence,
} from '@/lib/api/types';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';

type Row = {
  id: string;
  collaboration_id: string;
  campaign_id: string;
  raised_by_user_id: string;
  raised_by_role: 'brand' | 'creator';
  category: DisputeCategory;
  description: string;
  evidence: DisputeEvidence[];
  status: DisputeStatus;
  resolution: Dispute['resolution'];
  raised_at: string;
  messages: DisputeMessage[];
  created_at: string;
  updated_at: string;
};

const COLUMNS =
  'id, collaboration_id, campaign_id, raised_by_user_id, raised_by_role, ' +
  'category, description, evidence, status, resolution, raised_at, ' +
  'messages, created_at, updated_at';

function toDispute(row: Row): Dispute {
  return {
    id: row.id,
    collaborationId: row.collaboration_id,
    campaignId: row.campaign_id,
    raisedByUserId: row.raised_by_user_id,
    raisedByRole: row.raised_by_role,
    category: row.category,
    description: row.description,
    evidence: row.evidence ?? [],
    status: row.status,
    resolution: row.resolution ?? null,
    raisedAt: +new Date(row.raised_at),
    updatedAt: +new Date(row.updated_at),
    messages: row.messages ?? [],
  };
}

function toInsertRow(d: Dispute): Record<string, unknown> {
  return {
    id: d.id,
    collaboration_id: d.collaborationId,
    campaign_id: d.campaignId,
    raised_by_user_id: d.raisedByUserId,
    raised_by_role: d.raisedByRole,
    category: d.category,
    description: d.description,
    evidence: d.evidence,
    status: d.status,
    resolution: d.resolution,
    raised_at: new Date(d.raisedAt).toISOString(),
    messages: d.messages,
  };
}

type UpdatablePatch = Partial<{
  status: DisputeStatus;
  resolution: Dispute['resolution'];
  messages: DisputeMessage[];
}>;

function toUpdateRowPatch(patch: UpdatablePatch): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (patch.status !== undefined) out.status = patch.status;
  if (patch.resolution !== undefined) out.resolution = patch.resolution;
  if (patch.messages !== undefined) out.messages = patch.messages;
  return out;
}

export async function fetchAllDisputesFromSupabase(): Promise<Dispute[]> {
  if (!isSupabaseConfigured()) return [];
  const sb = getSupabase();
  const { data, error } = await sb.from('disputes').select(COLUMNS);
  if (error) {
    // eslint-disable-next-line no-console
    console.warn('[disputesRepo] fetchAll failed:', error.message);
    return [];
  }
  return (data ?? []).map((r) => toDispute(r as unknown as Row));
}

export async function insertDisputeInSupabase(d: Dispute): Promise<Dispute> {
  if (!isSupabaseConfigured()) throw new Error('Supabase not configured');
  const sb = getSupabase();
  const { data, error } = await sb
    .from('disputes')
    .insert(toInsertRow(d))
    .select(COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  if (!data) throw new Error('Insert returned no row');
  return toDispute(data as unknown as Row);
}

export async function updateDisputeInSupabase(
  disputeId: string,
  patch: UpdatablePatch,
): Promise<Dispute> {
  if (!isSupabaseConfigured()) throw new Error('Supabase not configured');
  const sb = getSupabase();
  const rowPatch = toUpdateRowPatch(patch);
  const { data, error } = await sb
    .from('disputes')
    .update(rowPatch)
    .eq('id', disputeId)
    .select(COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  if (!data) throw new Error('Dispute not found');
  return toDispute(data as unknown as Row);
}
