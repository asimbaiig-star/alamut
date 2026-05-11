// Supabase repository for the Outreach entity (Phase 9).
//
// Outreach is INSERT + a small set of UPDATE paths: respond, archive,
// upgrade-to-offer (sets resulting_offer_id + flips sent→replied).

import type { Outreach, OutreachStatus } from '@/lib/api/types';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';

type Row = {
  id: string;
  campaign_id: string | null;
  brand_id: string;
  creator_id: string;
  sent_by_user_id: string;
  message: string;
  status: OutreachStatus;
  sent_at: string;
  responded_at: string | null;
  resulting_offer_id: string | null;
  created_at: string;
  updated_at: string;
};

const COLUMNS =
  'id, campaign_id, brand_id, creator_id, sent_by_user_id, message, ' +
  'status, sent_at, responded_at, resulting_offer_id, created_at, updated_at';

function toOutreach(row: Row): Outreach {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    brandId: row.brand_id,
    creatorId: row.creator_id,
    sentByUserId: row.sent_by_user_id,
    message: row.message,
    status: row.status,
    sentAt: row.sent_at,
    respondedAt: row.responded_at ?? undefined,
    resultingOfferId: row.resulting_offer_id ?? undefined,
  };
}

function toInsertRow(o: Outreach): Record<string, unknown> {
  return {
    id: o.id,
    campaign_id: o.campaignId,
    brand_id: o.brandId,
    creator_id: o.creatorId,
    sent_by_user_id: o.sentByUserId,
    message: o.message,
    status: o.status,
    sent_at: o.sentAt,
    responded_at: o.respondedAt ?? null,
    resulting_offer_id: o.resultingOfferId ?? null,
  };
}

type UpdatablePatch = Partial<{
  status: OutreachStatus;
  respondedAt: string | null;
  resultingOfferId: string | null;
}>;

function toUpdateRowPatch(patch: UpdatablePatch): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (patch.status !== undefined) out.status = patch.status;
  if (patch.respondedAt !== undefined) out.responded_at = patch.respondedAt;
  if (patch.resultingOfferId !== undefined) out.resulting_offer_id = patch.resultingOfferId;
  return out;
}

export async function fetchAllOutreachFromSupabase(): Promise<Outreach[]> {
  if (!isSupabaseConfigured()) return [];
  const sb = getSupabase();
  const { data, error } = await sb.from('outreach').select(COLUMNS);
  if (error) {
    // eslint-disable-next-line no-console
    console.warn('[outreachRepo] fetchAll failed:', error.message);
    return [];
  }
  return (data ?? []).map((r) => toOutreach(r as unknown as Row));
}

export async function insertOutreachInSupabase(o: Outreach): Promise<Outreach> {
  if (!isSupabaseConfigured()) throw new Error('Supabase not configured');
  const sb = getSupabase();
  const { data, error } = await sb
    .from('outreach')
    .insert(toInsertRow(o))
    .select(COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  if (!data) throw new Error('Insert returned no row');
  return toOutreach(data as unknown as Row);
}

export async function updateOutreachInSupabase(
  outreachId: string,
  patch: UpdatablePatch,
): Promise<Outreach> {
  if (!isSupabaseConfigured()) throw new Error('Supabase not configured');
  const sb = getSupabase();
  const rowPatch = toUpdateRowPatch(patch);
  const { data, error } = await sb
    .from('outreach')
    .update(rowPatch)
    .eq('id', outreachId)
    .select(COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  if (!data) throw new Error('Outreach not found');
  return toOutreach(data as unknown as Row);
}
