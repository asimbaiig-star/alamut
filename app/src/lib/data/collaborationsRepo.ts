// Supabase repository for the Collaboration entity (Phase 5c).
//
// Collaborations are the cross-table join: campaign × creator + stage
// + audit history. Every offer/application/submission mutation that
// changes a collab's stage funnels through `ensureCollabState`
// (lib/api/collabSync.ts), so that's the single chokepoint we tap to
// mirror writes — see the mirror call sites there.

import type { Collaboration, CollabStage, CollabHistoryEntry } from '@/lib/api/types';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';
import { StaleVersionError, isNoRowsError } from './optimisticLock';

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
  version: number;
  created_at: string;
  updated_at: string;
};

const COLUMNS =
  'id, campaign_id, creator_id, brand_id, stage, agreed_rate, ' +
  'accepted_offer_id, contract_id, cancelled_at, cancellation_reason, ' +
  'history, cancellation_request, escrow_frozen, version, created_at, updated_at';

export function toCollab(row: Row): Collaboration {
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
    version: row.version,
  };
}

function toRowFields(c: Collaboration): Record<string, unknown> {
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

/**
 * Write a Collaboration to Supabase. Replaces the original `upsert`
 * pattern (which couldn't carry an optimistic lock) with an explicit
 * UPDATE-with-version → INSERT-on-miss two-step:
 *
 *   1. If `expectedVersion` is provided AND > 0 (we believe the row
 *      exists with a known version), try UPDATE with `where id = ?
 *      and version = ?`. On match → success, returns the bumped row.
 *      On no-rows-matched → check whether the row exists at all:
 *        - exists with different version → StaleVersionError (cross-tab
 *          race, surface toast)
 *        - doesn't exist → fall through to INSERT
 *
 *   2. If no `expectedVersion` (first write for this collab) OR the
 *      UPDATE matched zero rows because the row is new, INSERT with
 *      `version=0`. Returns the inserted row.
 *
 * The two-step costs at most two round-trips on race; the common path
 * (steady-state UPDATE on an existing row) is one. Same StaleVersionError
 * shape as the other 5 repos so the mirror layer can branch uniformly.
 */
export async function writeCollabInSupabase(
  c: Collaboration,
  expectedVersion?: number,
): Promise<Collaboration> {
  if (!isSupabaseConfigured()) throw new Error('Supabase not configured');
  const sb = getSupabase();
  const rowFields = toRowFields(c);

  // Step 1 — attempt UPDATE if we believe the row exists.
  if (expectedVersion !== undefined) {
    try {
      const { data, error } = await sb
        .from('collaborations')
        .update({ ...rowFields, version: expectedVersion + 1 })
        .eq('id', c.id)
        .eq('version', expectedVersion)
        .select(COLUMNS)
        .single();
      if (!error && data) {
        return toCollab(data as unknown as Row);
      }
      // Update returned no rows. Could be:
      //   (a) row exists but version moved on (cross-tab race) → StaleVersionError
      //   (b) row doesn't exist → fall through to INSERT
      if (isNoRowsError(error)) {
        const { data: probe } = await sb
          .from('collaborations')
          .select('id, version')
          .eq('id', c.id)
          .maybeSingle();
        if (probe) {
          // Row exists but version mismatched
          throw new StaleVersionError('collaboration', c.id);
        }
        // Row doesn't exist — proceed to INSERT.
      } else if (error) {
        throw new Error(error.message);
      }
    } catch (err) {
      if (err instanceof StaleVersionError) throw err;
      // Network errors etc. propagate; isNoRowsError fallthrough was handled above.
      const msg = err instanceof Error ? err.message : String(err);
      if (!isNoRowsError(msg)) throw err;
      // No-rows on the SELECT probe means we'd already chosen to INSERT — fall through.
    }
  }

  // Step 2 — INSERT (either no expectedVersion, or update found no row).
  const { data, error } = await sb
    .from('collaborations')
    .insert({ ...rowFields, version: 0 })
    .select(COLUMNS)
    .single();
  if (error) {
    // Insert can fail if another writer raced us between our UPDATE
    // probe and now (created the row). Re-translate to StaleVersionError
    // so the caller refreshes — the row exists, our local snapshot is
    // stale.
    if (/duplicate|violates unique|already exists/i.test(error.message)) {
      throw new StaleVersionError('collaboration', c.id);
    }
    throw new Error(error.message);
  }
  if (!data) throw new Error('Insert returned no row');
  return toCollab(data as unknown as Row);
}

/** @deprecated Use `writeCollabInSupabase` instead. Kept as an alias
 *  during the migration so existing callers don't break. */
export const upsertCollabInSupabase = writeCollabInSupabase;
