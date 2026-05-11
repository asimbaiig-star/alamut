// Supabase repository for the Review entity (Phase 8 lite).
//
// Reviews are mostly INSERT-then-occasionally-update. The UPDATE
// surface is narrow: reportedBy[] grows when users flag, and the
// trio (hidden, hiddenReason, hiddenAt) flips on moderation. We
// also support setting `response` for a future reviewed-party reply.

import type { Review } from '@/lib/api/types';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';

type Row = {
  id: string;
  campaign_id: string;
  from_user_id: string;
  review_type: 'creator' | 'brand';
  target_id: string;
  rating: number;
  text: string;
  at: string;
  response: { text: string; at: string } | null;
  reported_by: string[];
  hidden: boolean;
  hidden_reason: string | null;
  hidden_at: string | null;
  created_at: string;
  updated_at: string;
};

const COLUMNS =
  'id, campaign_id, from_user_id, review_type, target_id, rating, text, at, ' +
  'response, reported_by, hidden, hidden_reason, hidden_at, created_at, updated_at';

function toReview(row: Row): Review {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    fromUserId: row.from_user_id,
    reviewType: row.review_type,
    targetId: row.target_id,
    rating: row.rating,
    text: row.text,
    at: row.at,
    response: row.response ?? undefined,
    reportedBy: row.reported_by ?? [],
    hidden: row.hidden,
    hiddenReason: row.hidden_reason ?? undefined,
    hiddenAt: row.hidden_at ? +new Date(row.hidden_at) : undefined,
  };
}

function toInsertRow(r: Review): Record<string, unknown> {
  return {
    id: r.id,
    campaign_id: r.campaignId,
    from_user_id: r.fromUserId,
    review_type: r.reviewType,
    target_id: r.targetId,
    rating: r.rating,
    text: r.text,
    at: r.at,
    response: r.response ?? null,
    reported_by: r.reportedBy ?? [],
    hidden: r.hidden ?? false,
    hidden_reason: r.hiddenReason ?? null,
    hidden_at: r.hiddenAt ? new Date(r.hiddenAt).toISOString() : null,
  };
}

type UpdatablePatch = Partial<{
  reportedBy: string[];
  hidden: boolean;
  hiddenReason: string | null;
  hiddenAt: number | null;
  response: Review['response'] | null;
}>;

function toUpdateRowPatch(patch: UpdatablePatch): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (patch.reportedBy !== undefined) out.reported_by = patch.reportedBy;
  if (patch.hidden !== undefined) out.hidden = patch.hidden;
  if (patch.hiddenReason !== undefined) out.hidden_reason = patch.hiddenReason;
  if (patch.hiddenAt !== undefined) {
    out.hidden_at = patch.hiddenAt ? new Date(patch.hiddenAt).toISOString() : null;
  }
  if (patch.response !== undefined) out.response = patch.response;
  return out;
}

export async function fetchAllReviewsFromSupabase(): Promise<Review[]> {
  if (!isSupabaseConfigured()) return [];
  const sb = getSupabase();
  const { data, error } = await sb.from('reviews').select(COLUMNS);
  if (error) {
    // eslint-disable-next-line no-console
    console.warn('[reviewsRepo] fetchAll failed:', error.message);
    return [];
  }
  return (data ?? []).map((r) => toReview(r as unknown as Row));
}

export async function insertReviewInSupabase(r: Review): Promise<Review> {
  if (!isSupabaseConfigured()) throw new Error('Supabase not configured');
  const sb = getSupabase();
  const { data, error } = await sb
    .from('reviews')
    .insert(toInsertRow(r))
    .select(COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  if (!data) throw new Error('Insert returned no row');
  return toReview(data as unknown as Row);
}

export async function updateReviewInSupabase(
  reviewId: string,
  patch: UpdatablePatch,
): Promise<Review> {
  if (!isSupabaseConfigured()) throw new Error('Supabase not configured');
  const sb = getSupabase();
  const rowPatch = toUpdateRowPatch(patch);
  const { data, error } = await sb
    .from('reviews')
    .update(rowPatch)
    .eq('id', reviewId)
    .select(COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  if (!data) throw new Error('Review not found');
  return toReview(data as unknown as Row);
}
