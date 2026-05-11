// Supabase repository for the Brand entity.
//
// Phase 2 of the backend migration. Reads come from public.brands (RLS
// allows anonymous SELECT so the migration can run even before sign-in),
// writes use the authenticated session (RLS allows UPDATE only when
// `auth.email() = owner_email`). Logo uploads go to the `brand-logos`
// Storage bucket (public read, owner write).
//
// Column mapping: Postgres is snake_case, the TypeScript Brand type is
// camelCase. `toBrand` / `toRowPatch` translate. The Brand type lives
// in `lib/api/types.ts` and is reused unchanged — we keep the shape
// stable so Phase 2 doesn't ripple through the rest of the app.

import type { Brand } from '@/lib/api/types';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';

type Row = {
  id: string;
  user_id: string;
  owner_email: string;
  name: string;
  industry: string;
  hq: string;
  website: string;
  about: string;
  logo_mark: string | null;
  logo_url: string | null;
  preferred_categories: string[];
  preferred_regions: string[];
  wallet_balance: number;
  escrow_held: number;
  verified: boolean;
  saved_creators: string[];
  social_platforms: Brand['socialPlatforms'] | null;
};

// Public-API column list — used for `select('...')`. Centralised so
// adding a column updates every read path at once.
const COLUMNS =
  'id, user_id, owner_email, name, industry, hq, website, about, logo_mark, logo_url, ' +
  'preferred_categories, preferred_regions, wallet_balance, escrow_held, verified, ' +
  'saved_creators, social_platforms';

function toBrand(row: Row): Brand {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    industry: row.industry,
    hq: row.hq,
    website: row.website,
    about: row.about,
    logoMark: row.logo_mark ?? undefined,
    logoUrl: row.logo_url ?? undefined,
    preferredCategories: row.preferred_categories ?? [],
    preferredRegions: row.preferred_regions ?? [],
    walletBalance: row.wallet_balance,
    escrowHeld: row.escrow_held,
    verified: row.verified,
    savedCreators: row.saved_creators ?? [],
    socialPlatforms: row.social_platforms ?? undefined,
  };
}

// Inverse mapper for writes. Only the fields BrandProfile can edit are
// allowed in the patch — the rest (id, userId, wallet, escrow, etc.)
// stay server-controlled.
type EditableFields =
  | 'name' | 'industry' | 'hq' | 'website' | 'about'
  | 'logoMark' | 'logoUrl' | 'preferredCategories' | 'preferredRegions';

function toRowPatch(patch: Partial<Pick<Brand, EditableFields>>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (patch.name !== undefined)               out.name = patch.name;
  if (patch.industry !== undefined)           out.industry = patch.industry;
  if (patch.hq !== undefined)                 out.hq = patch.hq;
  if (patch.website !== undefined)            out.website = patch.website;
  if (patch.about !== undefined)              out.about = patch.about;
  if (patch.logoMark !== undefined)           out.logo_mark = patch.logoMark ?? null;
  if (patch.logoUrl !== undefined)            out.logo_url = patch.logoUrl ?? null;
  if (patch.preferredCategories !== undefined) out.preferred_categories = patch.preferredCategories;
  if (patch.preferredRegions !== undefined)   out.preferred_regions = patch.preferredRegions;
  return out;
}

/** Insert a brand-new Brand row at signup time. The Brand type has no
 *  `ownerEmail` field (it's a server-only RLS gate, not part of the
 *  client model), so callers pass it as a separate parameter. After
 *  insert, RLS lets the signed-in owner update + select normally. */
export async function insertBrandInSupabase(
  brand: Brand,
  ownerEmail: string,
): Promise<Brand> {
  if (!isSupabaseConfigured()) throw new Error('Supabase not configured');
  const sb = getSupabase();
  const row = {
    id: brand.id,
    user_id: brand.userId,
    owner_email: ownerEmail,
    name: brand.name,
    industry: brand.industry,
    hq: brand.hq,
    website: brand.website,
    about: brand.about,
    logo_mark: brand.logoMark ?? null,
    logo_url: brand.logoUrl ?? null,
    preferred_categories: brand.preferredCategories,
    preferred_regions: brand.preferredRegions,
    wallet_balance: brand.walletBalance,
    escrow_held: brand.escrowHeld,
    verified: brand.verified,
    saved_creators: brand.savedCreators,
    social_platforms: brand.socialPlatforms ?? null,
  };
  const { data, error } = await sb
    .from('brands')
    .insert(row)
    .select(COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  if (!data) throw new Error('Insert returned no row');
  return toBrand(data as unknown as Row);
}

/** Fetch every brand row visible to the current session. With the
 *  public SELECT policy this returns the full table for both anon and
 *  authenticated callers. Used by the boot-time hydrate to overlay
 *  fresh server state onto the local Zustand cache. */
export async function fetchAllBrandsFromSupabase(): Promise<Brand[]> {
  if (!isSupabaseConfigured()) return [];
  const sb = getSupabase();
  const { data, error } = await sb.from('brands').select(COLUMNS);
  if (error) {
    // Swallow + log — a Supabase outage shouldn't crash the local
    // experience. The store still has the seed data to fall back on.
    // eslint-disable-next-line no-console
    console.warn('[brandsRepo] fetchAllBrands failed:', error.message);
    return [];
  }
  return (data ?? []).map((r) => toBrand(r as unknown as Row));
}

/** Update a single brand. Caller must be the auth-session owner of the
 *  row (RLS enforces this). Returns the updated row mapped back to the
 *  TypeScript Brand shape. Throws on RLS rejection / network error. */
export async function updateBrandInSupabase(
  brandId: string,
  patch: Partial<Pick<Brand, EditableFields>>,
): Promise<Brand> {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase not configured');
  }
  const sb = getSupabase();
  const rowPatch = toRowPatch(patch);
  if (Object.keys(rowPatch).length === 0) {
    // No-op — caller passed an empty patch.
    const { data, error } = await sb.from('brands').select(COLUMNS).eq('id', brandId).single();
    if (error) throw new Error(error.message);
    return toBrand(data as unknown as Row);
  }
  const { data, error } = await sb
    .from('brands')
    .update(rowPatch)
    .eq('id', brandId)
    .select(COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  if (!data) throw new Error('Brand not found or not editable by this user');
  return toBrand(data as unknown as Row);
}

/** Upload a logo image to the `brand-logos` Storage bucket and return
 *  its public URL. Files are namespaced under `<brand_id>/` so the
 *  RLS policy can validate ownership from the path. */
export async function uploadBrandLogo(
  brandId: string,
  file: File,
): Promise<string> {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase not configured');
  }
  const sb = getSupabase();
  // Use a stable filename so replace-logo flows overwrite the previous
  // file rather than accumulating orphans. Cache-bust via the
  // `?v=<timestamp>` suffix on the returned URL so the new image is
  // picked up immediately by clients.
  const ext = (file.type.split('/')[1] ?? 'png').replace(/[^a-z0-9]/gi, '');
  const path = `${brandId}/logo.${ext}`;
  const { error: uploadError } = await sb
    .storage
    .from('brand-logos')
    .upload(path, file, {
      cacheControl: '3600',
      upsert: true,
      contentType: file.type,
    });
  if (uploadError) throw new Error(uploadError.message);
  const { data } = sb.storage.from('brand-logos').getPublicUrl(path);
  // Cache-bust so a freshly uploaded logo isn't masked by a CDN-cached
  // copy from a previous upload at the same path.
  return `${data.publicUrl}?v=${Date.now()}`;
}

/** Remove a brand's logo from Storage. Called when the user clicks
 *  "Remove" in BrandProfile. Best-effort: silently no-ops if the file
 *  doesn't exist. */
export async function removeBrandLogo(brandId: string): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const sb = getSupabase();
  // Common extensions we might have written — try each.
  const candidates = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'].map((ext) => `${brandId}/logo.${ext}`);
  await sb.storage.from('brand-logos').remove(candidates);
}
