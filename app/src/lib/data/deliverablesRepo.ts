// Supabase repository for the Deliverable entity (Phase 5d).
// Deliverables are part of the brief shape — brand-owner write only.

import type { Deliverable, DeliverablePlatform, DeliverableFormat } from '@/lib/api/types';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';

type Row = {
  id: string;
  campaign_id: string;
  index: number;
  platform: DeliverablePlatform;
  format: DeliverableFormat;
  quantity: number;
  due_offset_days: number | null;
  specs: string | null;
  created_at: string;
  updated_at: string;
};

const COLUMNS =
  'id, campaign_id, index, platform, format, quantity, due_offset_days, specs, created_at, updated_at';

function toDeliverable(row: Row): Deliverable {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    index: row.index,
    platform: row.platform,
    format: row.format,
    quantity: row.quantity,
    dueOffsetDays: row.due_offset_days,
    specs: row.specs,
  };
}

function toInsertRow(d: Deliverable): Record<string, unknown> {
  return {
    id: d.id,
    campaign_id: d.campaignId,
    index: d.index,
    platform: d.platform,
    format: d.format,
    quantity: d.quantity,
    due_offset_days: d.dueOffsetDays,
    specs: d.specs,
  };
}

export async function fetchAllDeliverablesFromSupabase(): Promise<Deliverable[]> {
  if (!isSupabaseConfigured()) return [];
  const sb = getSupabase();
  const { data, error } = await sb.from('deliverables').select(COLUMNS);
  if (error) {
    // eslint-disable-next-line no-console
    console.warn('[deliverablesRepo] fetchAll failed:', error.message);
    return [];
  }
  return (data ?? []).map((r) => toDeliverable(r as unknown as Row));
}

/** Bulk-insert deliverables. Called by materializeDeliverablesForCampaign
 *  whenever a new campaign launches (one INSERT per slot in the
 *  free-form placement string). Returns the persisted rows. */
export async function insertDeliverablesInSupabase(
  deliverables: Deliverable[],
): Promise<Deliverable[]> {
  if (!isSupabaseConfigured() || deliverables.length === 0) return [];
  const sb = getSupabase();
  const { data, error } = await sb
    .from('deliverables')
    .insert(deliverables.map(toInsertRow))
    .select(COLUMNS);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => toDeliverable(r as unknown as Row));
}
