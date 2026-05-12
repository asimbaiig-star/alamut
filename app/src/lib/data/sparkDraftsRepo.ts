// Supabase repository for the SparkDraft entity (Phase 15).
//
// Each row is one saved Spark planning session for a brand. CRUD is
// brand-owner gated by RLS. The `history` + `context` columns are
// opaque JSONB matching the runtime shapes in sparkEngine.ts; the
// repo treats them as unknown so this module doesn't depend on the
// screen layer.

import type { SparkDraft } from '@/lib/api/types';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';

type Row = {
  id: string;
  brand_id: string;
  name: string | null;
  history: unknown[];
  context: Record<string, unknown>;
  last_edited_at: string;
  created_at: string;
  updated_at: string;
};

const COLUMNS =
  'id, brand_id, name, history, context, last_edited_at, created_at, updated_at';

function toDraft(row: Row): SparkDraft {
  return {
    id: row.id,
    brandId: row.brand_id,
    name: row.name ?? undefined,
    history: row.history ?? [],
    context: row.context ?? {},
    lastEditedAt: row.last_edited_at,
    createdAt: row.created_at,
  };
}

function toUpsertRow(d: SparkDraft): Record<string, unknown> {
  return {
    id: d.id,
    brand_id: d.brandId,
    name: d.name ?? null,
    history: d.history,
    context: d.context,
    last_edited_at: d.lastEditedAt,
    created_at: d.createdAt,
  };
}

export async function fetchAllSparkDraftsFromSupabase(): Promise<SparkDraft[]> {
  if (!isSupabaseConfigured()) return [];
  const sb = getSupabase();
  const { data, error } = await sb.from('spark_drafts').select(COLUMNS);
  if (error) {
    // eslint-disable-next-line no-console
    console.warn('[sparkDraftsRepo] fetchAll failed:', error.message);
    return [];
  }
  return (data ?? []).map((r) => toDraft(r as unknown as Row));
}

/** Upsert by primary key — used by the save-or-replace path. Saving a
 *  draft for the first time inserts; saving again overwrites. */
export async function upsertSparkDraftInSupabase(d: SparkDraft): Promise<SparkDraft> {
  if (!isSupabaseConfigured()) throw new Error('Supabase not configured');
  const sb = getSupabase();
  const { data, error } = await sb
    .from('spark_drafts')
    .upsert(toUpsertRow(d), { onConflict: 'id' })
    .select(COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  if (!data) throw new Error('Upsert returned no row');
  return toDraft(data as unknown as Row);
}

export async function deleteSparkDraftInSupabase(draftId: string): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const sb = getSupabase();
  const { error } = await sb.from('spark_drafts').delete().eq('id', draftId);
  if (error) throw new Error(error.message);
}
