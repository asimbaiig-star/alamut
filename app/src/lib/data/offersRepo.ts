// Supabase repository for the Offer entity (Phase 4).
//
// Reads come from public.offers (public SELECT policy).
// Writes are gated by `to authenticated`. Negotiation rounds live
// inside the JSONB `rounds` column — append-only audit trail.

import type { Offer, OfferRound, OfferSource, OfferStatus } from '@/lib/api/types';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';

type Row = {
  id: string;
  campaign_id: string;
  creator_id: string;
  rate: number;
  message: string;
  status: OfferStatus;
  sent_at: string;
  responded_at: string | null;
  application_id: string | null;
  source: OfferSource;
  rounds: OfferRound[];
  collaboration_id: string | null;
  created_at: string;
  updated_at: string;
};

const COLUMNS =
  'id, campaign_id, creator_id, rate, message, status, sent_at, ' +
  'responded_at, application_id, source, rounds, collaboration_id, ' +
  'created_at, updated_at';

function toOffer(row: Row): Offer {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    creatorId: row.creator_id,
    rate: row.rate,
    message: row.message,
    status: row.status,
    sentAt: row.sent_at,
    respondedAt: row.responded_at ?? undefined,
    rounds: row.rounds ?? [],
    applicationId: row.application_id,
    source: row.source,
    collaborationId: row.collaboration_id ?? undefined,
  };
}

function toInsertRow(o: Offer): Record<string, unknown> {
  return {
    id: o.id,
    campaign_id: o.campaignId,
    creator_id: o.creatorId,
    rate: o.rate,
    message: o.message,
    status: o.status,
    sent_at: o.sentAt,
    responded_at: o.respondedAt ?? null,
    application_id: o.applicationId,
    source: o.source,
    rounds: o.rounds,
    collaboration_id: o.collaborationId ?? null,
  };
}

type UpdatablePatch = Partial<{
  status: OfferStatus;
  rate: number;
  message: string;
  rounds: OfferRound[];
  respondedAt: string;
  collaborationId: string;
}>;

function toUpdateRowPatch(patch: UpdatablePatch): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (patch.status !== undefined)          out.status = patch.status;
  if (patch.rate !== undefined)            out.rate = patch.rate;
  if (patch.message !== undefined)         out.message = patch.message;
  if (patch.rounds !== undefined)          out.rounds = patch.rounds;
  if (patch.respondedAt !== undefined)     out.responded_at = patch.respondedAt;
  if (patch.collaborationId !== undefined) out.collaboration_id = patch.collaborationId;
  return out;
}

export async function fetchAllOffersFromSupabase(): Promise<Offer[]> {
  if (!isSupabaseConfigured()) return [];
  const sb = getSupabase();
  const { data, error } = await sb.from('offers').select(COLUMNS);
  if (error) {
    // eslint-disable-next-line no-console
    console.warn('[offersRepo] fetchAll failed:', error.message);
    return [];
  }
  return (data ?? []).map((r) => toOffer(r as unknown as Row));
}

export async function insertOfferInSupabase(o: Offer): Promise<Offer> {
  if (!isSupabaseConfigured()) throw new Error('Supabase not configured');
  const sb = getSupabase();
  const { data, error } = await sb
    .from('offers')
    .insert(toInsertRow(o))
    .select(COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  if (!data) throw new Error('Insert returned no row');
  return toOffer(data as unknown as Row);
}

export async function updateOfferInSupabase(
  offerId: string,
  patch: UpdatablePatch,
): Promise<Offer> {
  if (!isSupabaseConfigured()) throw new Error('Supabase not configured');
  const sb = getSupabase();
  const rowPatch = toUpdateRowPatch(patch);
  const { data, error } = await sb
    .from('offers')
    .update(rowPatch)
    .eq('id', offerId)
    .select(COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  if (!data) throw new Error('Offer not found');
  return toOffer(data as unknown as Row);
}
