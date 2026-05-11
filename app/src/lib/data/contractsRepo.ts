// Supabase repository for the Contract entity (Phase 6).
//
// Contracts are the immutable agreement snapshot — created in the same
// tx as offer→accepted, then only their `status` (+ associated terminal
// timestamp) ever changes. Two write paths:
//   - INSERT  · `insertContractInSupabase` — from createContractForAcceptedOffer
//   - UPDATE  · `updateContractInSupabase` — from markContractFulfilled +
//               the cancel-collab path. Narrowed to the fields that
//               actually mutate (status + fulfilled_at + cancelled_at).

import type { Contract, ContractDeliverableSnapshot } from '@/lib/api/types';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';

type Row = {
  id: string;
  collaboration_id: string;
  campaign_id: string;
  creator_id: string;
  brand_id: string;
  agreed_rate: number;
  net_to_creator: number;
  platform_fee: number;
  withholding_tax: number;
  deliverables: ContractDeliverableSnapshot[];
  brief_snapshot: string;
  brief_snapshot_at: string;
  accepted_at: string;
  accepted_by_user_id: string;
  status: Contract['status'];
  fulfilled_at: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
};

const COLUMNS =
  'id, collaboration_id, campaign_id, creator_id, brand_id, ' +
  'agreed_rate, net_to_creator, platform_fee, withholding_tax, ' +
  'deliverables, brief_snapshot, brief_snapshot_at, ' +
  'accepted_at, accepted_by_user_id, status, fulfilled_at, cancelled_at, ' +
  'created_at, updated_at';

function toContract(row: Row): Contract {
  return {
    id: row.id,
    collaborationId: row.collaboration_id,
    campaignId: row.campaign_id,
    creatorId: row.creator_id,
    brandId: row.brand_id,
    agreedRate: row.agreed_rate,
    netToCreator: row.net_to_creator,
    platformFee: row.platform_fee,
    withholdingTax: row.withholding_tax,
    deliverables: row.deliverables ?? [],
    briefSnapshot: row.brief_snapshot,
    briefSnapshotAt: +new Date(row.brief_snapshot_at),
    acceptedAt: +new Date(row.accepted_at),
    acceptedByUserId: row.accepted_by_user_id,
    status: row.status,
    fulfilledAt: row.fulfilled_at ? +new Date(row.fulfilled_at) : null,
    cancelledAt: row.cancelled_at ? +new Date(row.cancelled_at) : null,
  };
}

function toInsertRow(c: Contract): Record<string, unknown> {
  return {
    id: c.id,
    collaboration_id: c.collaborationId,
    campaign_id: c.campaignId,
    creator_id: c.creatorId,
    brand_id: c.brandId,
    agreed_rate: c.agreedRate,
    net_to_creator: c.netToCreator,
    platform_fee: c.platformFee,
    withholding_tax: c.withholdingTax,
    deliverables: c.deliverables,
    brief_snapshot: c.briefSnapshot,
    brief_snapshot_at: new Date(c.briefSnapshotAt).toISOString(),
    accepted_at: new Date(c.acceptedAt).toISOString(),
    accepted_by_user_id: c.acceptedByUserId,
    status: c.status,
    fulfilled_at: c.fulfilledAt ? new Date(c.fulfilledAt).toISOString() : null,
    cancelled_at: c.cancelledAt ? new Date(c.cancelledAt).toISOString() : null,
  };
}

type UpdatablePatch = Partial<{
  status: Contract['status'];
  fulfilledAt: number | null;
  cancelledAt: number | null;
}>;

function toUpdateRowPatch(patch: UpdatablePatch): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (patch.status !== undefined) out.status = patch.status;
  if (patch.fulfilledAt !== undefined) {
    out.fulfilled_at = patch.fulfilledAt ? new Date(patch.fulfilledAt).toISOString() : null;
  }
  if (patch.cancelledAt !== undefined) {
    out.cancelled_at = patch.cancelledAt ? new Date(patch.cancelledAt).toISOString() : null;
  }
  return out;
}

export async function fetchAllContractsFromSupabase(): Promise<Contract[]> {
  if (!isSupabaseConfigured()) return [];
  const sb = getSupabase();
  const { data, error } = await sb.from('contracts').select(COLUMNS);
  if (error) {
    // eslint-disable-next-line no-console
    console.warn('[contractsRepo] fetchAll failed:', error.message);
    return [];
  }
  return (data ?? []).map((r) => toContract(r as unknown as Row));
}

export async function insertContractInSupabase(c: Contract): Promise<Contract> {
  if (!isSupabaseConfigured()) throw new Error('Supabase not configured');
  const sb = getSupabase();
  const { data, error } = await sb
    .from('contracts')
    .insert(toInsertRow(c))
    .select(COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  if (!data) throw new Error('Insert returned no row');
  return toContract(data as unknown as Row);
}

export async function updateContractInSupabase(
  contractId: string,
  patch: UpdatablePatch,
): Promise<Contract> {
  if (!isSupabaseConfigured()) throw new Error('Supabase not configured');
  const sb = getSupabase();
  const rowPatch = toUpdateRowPatch(patch);
  const { data, error } = await sb
    .from('contracts')
    .update(rowPatch)
    .eq('id', contractId)
    .select(COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  if (!data) throw new Error('Contract not found');
  return toContract(data as unknown as Row);
}
