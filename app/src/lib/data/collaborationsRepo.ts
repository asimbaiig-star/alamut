// Supabase repository for the Collaboration entity (Phase 5c).
//
// Collaborations are the cross-table join: campaign × creator + stage
// + audit history. Every offer/application/submission mutation that
// changes a collab's stage funnels through `ensureCollabState`
// (lib/api/collabSync.ts), so that's the single chokepoint we tap to
// mirror writes — see the mirror call sites there.

import type { Collaboration, CollabStage, CollabHistoryEntry } from '@/lib/api/types';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';

type Row = {
  id: string;
  campaign_id: string;
  creator_id: string;
  brand_id: string;
  stage: CollabStage;
  agreed_rate: number | null;
  accepted_offer_id: string | null;
  contract_id: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  history: CollabHistoryEntry[];
  cancellation_request: Collaboration['cancellationRequest'] | null;
  escrow_frozen: boolean;
  created_at: string;
  updated_at: string;
};

const COLUMNS =
  'id, campaign_id, creator_id, brand_id, stage, agreed_rate, ' +
  'accepted_offer_id, contract_id, cancelled_at, cancellation_reason, ' +
  'history, cancellation_request, escrow_frozen, created_at, updated_at';

function toCollab(row: Row): Collaboration {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    creatorId: row.creator_id,
    brandId: row.brand_id,
    stage: row.stage,
    agreedRate: row.agreed_rate,
    acceptedOfferId: row.accepted_offer_id,
    contractId: row.contract_id,
    cancelledAt: row.cancelled_at ? +new Date(row.cancelled_at) : null,
    cancellationReason: row.cancellation_reason,
    createdAt: +new Date(row.created_at),
    updatedAt: +new Date(row.updated_at),
    history: row.history ?? [],
    cancellationRequest: row.cancellation_request ?? null,
    escrowFrozen: row.escrow_frozen,
  };
}

function toUpsertRow(c: Collaboration): Record<string, unknown> {
  return {
    id: c.id,
    campaign_id: c.campaignId,
    creator_id: c.creatorId,
    brand_id: c.brandId,
    stage: c.stage,
    agreed_rate: c.agreedRate,
    accepted_offer_id: c.acceptedOfferId,
    contract_id: c.contractId,
    cancelled_at: c.cancelledAt ? new Date(c.cancelledAt).toISOString() : null,
    cancellation_reason: c.cancellationReason,
    history: c.history,
    cancellation_request: c.cancellationRequest ?? null,
    escrow_frozen: c.escrowFrozen ?? false,
  };
}

export async function fetchAllCollabsFromSupabase(): Promise<Collaboration[]> {
  if (!isSupabaseConfigured()) return [];
  const sb = getSupabase();
  const { data, error } = await sb.from('collaborations').select(COLUMNS);
  if (error) {
    // eslint-disable-next-line no-console
    console.warn('[collaborationsRepo] fetchAll failed:', error.message);
    return [];
  }
  return (data ?? []).map((r) => toCollab(r as unknown as Row));
}

/** Upsert by primary key — used by the ensureCollabState mirror.
 *  Collab rows are created the first time a (campaign, creator) pair
 *  has a workflow signal, then updated on every stage transition. */
export async function upsertCollabInSupabase(c: Collaboration): Promise<Collaboration> {
  if (!isSupabaseConfigured()) throw new Error('Supabase not configured');
  const sb = getSupabase();
  const { data, error } = await sb
    .from('collaborations')
    .upsert(toUpsertRow(c), { onConflict: 'id' })
    .select(COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  if (!data) throw new Error('Upsert returned no row');
  return toCollab(data as unknown as Row);
}
