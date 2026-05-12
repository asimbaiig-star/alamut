// Supabase repository for the Campaign entity.
//
// Phase 3. Reads + writes mirror the brandsRepo pattern. Campaigns
// reference brands via FK (on-delete cascade), and RLS gates write
// access by brand ownership: the campaign's brand_id must point at a
// brand whose owner_email = auth.email().
//
// Cross-table reference arrays (applications, offers) stay as text[]
// in Phase 3. Phase 4 will migrate those tables and the arrays will
// then point at real DB rows.

import type { Campaign, CampaignAsset, CampaignStage } from '@/lib/api/types';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';

type Row = {
  id: string;
  brand_id: string;
  title: string;
  pitch: string;
  brief: string;
  cover: string;
  budget: number;
  spent: number;
  escrow_held: number;
  region: string;
  category: string | null;
  stage: CampaignStage;
  deliverables_text: string;
  deliverable_ids: string[];
  deadline: string;
  posted_at: string | null;
  reach: number | null;
  engagement: number | null;
  history: Campaign['history'];
  milestones: Campaign['milestones'];
  applications: string[];
  offers: string[];
  rights: Campaign['rights'] | null;
  auto_shortlist: Campaign['autoShortlist'] | null;
  kind: Campaign['kind'] | null;
  editors_pick: boolean | null;
  assets: CampaignAsset[] | null;
  created_at: string;
  updated_at: string;
};

const COLUMNS =
  'id, brand_id, title, pitch, brief, cover, budget, spent, escrow_held, ' +
  'region, category, stage, deliverables_text, deliverable_ids, deadline, ' +
  'posted_at, reach, engagement, history, milestones, applications, offers, ' +
  'rights, auto_shortlist, kind, editors_pick, assets, created_at, updated_at';

function toCampaign(row: Row): Campaign {
  return {
    id: row.id,
    brandId: row.brand_id,
    title: row.title,
    pitch: row.pitch,
    brief: row.brief,
    cover: row.cover,
    budget: row.budget,
    spent: row.spent,
    escrowHeld: row.escrow_held,
    region: row.region,
    category: row.category ?? '',
    stage: row.stage,
    deliverablesText: row.deliverables_text,
    deliverableIds: row.deliverable_ids ?? [],
    deadline: row.deadline,
    postedAt: row.posted_at ?? undefined,
    reach: row.reach ?? undefined,
    engagement: row.engagement ?? undefined,
    createdAt: row.created_at,
    history: row.history ?? [],
    milestones: row.milestones ?? [],
    applications: row.applications ?? [],
    offers: row.offers ?? [],
    rights: row.rights ?? undefined,
    autoShortlist: row.auto_shortlist ?? null,
    kind: row.kind ?? undefined,
    editorsPick: row.editors_pick ?? undefined,
    assets: row.assets ?? [],
  };
}

// Insert payload — full Campaign minus the columns the DB owns
// (created_at, updated_at). Caller passes a Campaign-shaped object.
function toInsertRow(c: Campaign): Record<string, unknown> {
  return {
    id: c.id,
    brand_id: c.brandId,
    title: c.title,
    pitch: c.pitch,
    brief: c.brief,
    cover: c.cover,
    budget: c.budget,
    spent: c.spent,
    escrow_held: c.escrowHeld,
    region: c.region,
    category: c.category,
    stage: c.stage,
    deliverables_text: c.deliverablesText,
    deliverable_ids: c.deliverableIds,
    deadline: c.deadline,
    posted_at: c.postedAt ?? null,
    reach: c.reach ?? null,
    engagement: c.engagement ?? null,
    history: c.history,
    milestones: c.milestones,
    applications: c.applications,
    offers: c.offers,
    rights: c.rights ?? null,
    auto_shortlist: c.autoShortlist ?? null,
    kind: c.kind ?? 'one_off',
    editors_pick: c.editorsPick ?? false,
    created_at: c.createdAt,
  };
}

// Patch type — what UPDATE callers can change. Stage flips dominate
// (pause / resume / end); other fields are edit-from-detail-page.
type UpdatablePatch = Partial<{
  stage: CampaignStage;
  spent: number;
  escrowHeld: number;
  deliverableIds: string[];
  deliverablesText: string;
  history: Campaign['history'];
  applications: string[];
  offers: string[];
  reach: number;
  engagement: number;
  postedAt: string;
  assets: CampaignAsset[];
}>;

function toUpdateRowPatch(patch: UpdatablePatch): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (patch.stage !== undefined)             out.stage = patch.stage;
  if (patch.spent !== undefined)             out.spent = patch.spent;
  if (patch.escrowHeld !== undefined)        out.escrow_held = patch.escrowHeld;
  if (patch.deliverableIds !== undefined)    out.deliverable_ids = patch.deliverableIds;
  if (patch.deliverablesText !== undefined)  out.deliverables_text = patch.deliverablesText;
  if (patch.history !== undefined)           out.history = patch.history;
  if (patch.applications !== undefined)      out.applications = patch.applications;
  if (patch.offers !== undefined)            out.offers = patch.offers;
  if (patch.reach !== undefined)             out.reach = patch.reach;
  if (patch.engagement !== undefined)        out.engagement = patch.engagement;
  if (patch.postedAt !== undefined)          out.posted_at = patch.postedAt;
  if (patch.assets !== undefined)            out.assets = patch.assets;
  return out;
}

/** Upload an asset file to the campaign-assets Storage bucket. Returns
 *  the public URL + the safe-path id used as the asset's stable
 *  identifier across remove/replace flows. Path convention:
 *  <campaignId>/<assetId>-<safeName> so we can delete by prefix later. */
export async function uploadCampaignAssetFile(
  campaignId: string,
  file: File,
): Promise<{ assetId: string; publicUrl: string }> {
  if (!isSupabaseConfigured()) throw new Error('Supabase not configured');
  const sb = getSupabase();
  const assetId = `ast_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80);
  const path = `${campaignId}/${assetId}-${safeName}`;
  const { error: uploadError } = await sb
    .storage
    .from('campaign-assets')
    .upload(path, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type || undefined,
    });
  if (uploadError) throw new Error(uploadError.message);
  const { data } = sb.storage.from('campaign-assets').getPublicUrl(path);
  return { assetId, publicUrl: data.publicUrl };
}

/** Remove an asset's underlying file from Storage. Best-effort — silent
 *  on not-found so calling this after a partial state is safe. */
export async function removeCampaignAssetFile(
  campaignId: string,
  assetId: string,
  fileName: string,
): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const sb = getSupabase();
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80);
  const path = `${campaignId}/${assetId}-${safeName}`;
  await sb.storage.from('campaign-assets').remove([path]);
}

/** Fetch every campaign visible to the current session. Public SELECT
 *  policy means anon + authenticated both see the full set. */
export async function fetchAllCampaignsFromSupabase(): Promise<Campaign[]> {
  if (!isSupabaseConfigured()) return [];
  const sb = getSupabase();
  const { data, error } = await sb.from('campaigns').select(COLUMNS);
  if (error) {
    // eslint-disable-next-line no-console
    console.warn('[campaignsRepo] fetchAll failed:', error.message);
    return [];
  }
  return (data ?? []).map((r) => toCampaign(r as unknown as Row));
}

/** Insert a brand-new campaign. RLS requires the auth user to own
 *  the brand referenced by brand_id. Returns the persisted row. */
export async function insertCampaignInSupabase(c: Campaign): Promise<Campaign> {
  if (!isSupabaseConfigured()) throw new Error('Supabase not configured');
  const sb = getSupabase();
  const { data, error } = await sb
    .from('campaigns')
    .insert(toInsertRow(c))
    .select(COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  if (!data) throw new Error('Insert returned no row');
  return toCampaign(data as unknown as Row);
}

/** Patch an existing campaign. Caller must own the brand (RLS). */
export async function updateCampaignInSupabase(
  campaignId: string,
  patch: UpdatablePatch,
): Promise<Campaign> {
  if (!isSupabaseConfigured()) throw new Error('Supabase not configured');
  const sb = getSupabase();
  const rowPatch = toUpdateRowPatch(patch);
  if (Object.keys(rowPatch).length === 0) {
    const { data, error } = await sb.from('campaigns').select(COLUMNS).eq('id', campaignId).single();
    if (error) throw new Error(error.message);
    return toCampaign(data as unknown as Row);
  }
  const { data, error } = await sb
    .from('campaigns')
    .update(rowPatch)
    .eq('id', campaignId)
    .select(COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  if (!data) throw new Error('Campaign not found or not editable by this user');
  return toCampaign(data as unknown as Row);
}
