// Supabase repository for the Creator entity (Phase 5).
//
// Reads come from public.creators (public SELECT policy — storefronts
// + Discover need every row). Writes use the authenticated session
// and RLS gates by `auth.email() = owner_email`, so only the creator
// themselves can edit their profile.

import type { Availability, Creator, CreatorTier, Platform } from '@/lib/api/types';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';
import { StaleVersionError, isNoRowsError } from './optimisticLock';

type Row = {
  id: string;
  user_id: string;
  owner_email: string | null;
  name: string;
  handle: string;
  tagline: string;
  bio: string;
  cover: string | null;
  portrait: string;
  city: string;
  country: string;
  languages: string[];
  categories: string[];
  work: string[];
  past_clients: string[];
  platforms: Platform[];
  reach: number;
  engagement: number;
  rating: number;
  tier: CreatorTier;
  response_hrs: number;
  rate_card: Creator['rateCard'];
  rate_cards: Creator['rateCards'] | null;
  payout: Creator['payout'];
  wallet_balance: number;
  pending_balance: number;
  lifetime_earnings: number;
  verified: boolean;
  kyc_verified_at: string | null;
  editors_pick: boolean | null;
  press_mentions: Creator['pressMentions'];
  availability: Availability | null;
  featured_review_ids: string[];
  saved_briefs: string[];
  version: number;
  created_at: string;
  updated_at: string;
};

// Full column set — owner-only reads (their own row + all PII columns).
// Migration 025 restricted SELECT on the raw `creators` table to the
// row owner; this set is what the owner pulls back when they edit
// their profile, view their wallet, etc.
const COLUMNS =
  'id, user_id, owner_email, name, handle, tagline, bio, cover, portrait, ' +
  'city, country, languages, categories, work, past_clients, platforms, ' +
  'reach, engagement, rating, tier, response_hrs, rate_card, rate_cards, ' +
  'payout, wallet_balance, pending_balance, lifetime_earnings, verified, ' +
  'kyc_verified_at, editors_pick, press_mentions, availability, ' +
  'featured_review_ids, saved_briefs, version, created_at, updated_at';

// Public column set — no PII (no payout, no wallet/pending/lifetime,
// no owner_email). Storefronts + Discover pull this via the
// `creators_public` view (migration 025). Anonymous and authenticated
// non-owners can read it; the raw `creators` table is owner-only.
const PUBLIC_COLUMNS =
  'id, user_id, name, handle, tagline, bio, cover, portrait, ' +
  'city, country, languages, categories, work, past_clients, platforms, ' +
  'reach, engagement, rating, tier, response_hrs, rate_card, rate_cards, ' +
  'verified, kyc_verified_at, editors_pick, press_mentions, availability, ' +
  'featured_review_ids, saved_briefs, version, created_at, updated_at';

function toCreator(row: Row): Creator {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    handle: row.handle,
    tagline: row.tagline,
    bio: row.bio,
    cover: row.cover ?? undefined,
    portrait: row.portrait,
    city: row.city,
    country: row.country,
    languages: row.languages ?? [],
    categories: row.categories ?? [],
    work: row.work ?? [],
    pastClients: row.past_clients ?? [],
    platforms: row.platforms ?? [],
    reach: row.reach,
    engagement: row.engagement,
    rating: row.rating,
    tier: row.tier,
    responseHrs: row.response_hrs,
    rateCard: row.rate_card,
    rateCards: row.rate_cards ?? undefined,
    payout: row.payout,
    walletBalance: row.wallet_balance,
    pendingBalance: row.pending_balance,
    lifetimeEarnings: row.lifetime_earnings,
    verified: row.verified,
    kycVerifiedAt: row.kyc_verified_at ?? undefined,
    editorsPick: row.editors_pick ?? undefined,
    pressMentions: row.press_mentions ?? [],
    availability: row.availability ?? undefined,
    featuredReviewIds: row.featured_review_ids ?? undefined,
    savedBriefs: row.saved_briefs ?? undefined,
    version: row.version,
  };
}

// Editable fields — what the storefront editor can touch.
type UpdatablePatch = Partial<{
  name: string;
  handle: string;
  tagline: string;
  bio: string;
  cover: string;
  portrait: string;
  city: string;
  country: string;
  languages: string[];
  categories: string[];
  work: string[];
  pastClients: string[];
  platforms: Platform[];
  rateCard: Creator['rateCard'];
  rateCards: Creator['rateCards'];
  payout: Creator['payout'];
  availability: Availability | null;
  featuredReviewIds: string[];
  savedBriefs: string[];
}>;

function toUpdateRowPatch(patch: UpdatablePatch): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (patch.name !== undefined)              out.name = patch.name;
  if (patch.handle !== undefined)            out.handle = patch.handle;
  if (patch.tagline !== undefined)           out.tagline = patch.tagline;
  if (patch.bio !== undefined)               out.bio = patch.bio;
  if (patch.cover !== undefined)             out.cover = patch.cover;
  if (patch.portrait !== undefined)          out.portrait = patch.portrait;
  if (patch.city !== undefined)              out.city = patch.city;
  if (patch.country !== undefined)           out.country = patch.country;
  if (patch.languages !== undefined)         out.languages = patch.languages;
  if (patch.categories !== undefined)        out.categories = patch.categories;
  if (patch.work !== undefined)              out.work = patch.work;
  if (patch.pastClients !== undefined)       out.past_clients = patch.pastClients;
  if (patch.platforms !== undefined)         out.platforms = patch.platforms;
  if (patch.rateCard !== undefined)          out.rate_card = patch.rateCard;
  if (patch.rateCards !== undefined)         out.rate_cards = patch.rateCards;
  if (patch.payout !== undefined)            out.payout = patch.payout;
  if (patch.availability !== undefined)      out.availability = patch.availability;
  if (patch.featuredReviewIds !== undefined) out.featured_review_ids = patch.featuredReviewIds;
  if (patch.savedBriefs !== undefined)       out.saved_briefs = patch.savedBriefs;
  return out;
}

/** Insert a brand-new Creator row at signup time. owner_email is the
 *  RLS gate (auth.email() = owner_email) — callers pass it separately
 *  because the Creator TS type doesn't carry it. */
export async function insertCreatorInSupabase(
  creator: Creator,
  ownerEmail: string,
): Promise<Creator> {
  if (!isSupabaseConfigured()) throw new Error('Supabase not configured');
  const sb = getSupabase();
  const row = {
    id: creator.id,
    user_id: creator.userId,
    owner_email: ownerEmail,
    name: creator.name,
    handle: creator.handle,
    tagline: creator.tagline,
    bio: creator.bio,
    cover: creator.cover ?? null,
    portrait: creator.portrait,
    city: creator.city,
    country: creator.country,
    languages: creator.languages,
    categories: creator.categories,
    work: creator.work,
    past_clients: creator.pastClients,
    platforms: creator.platforms,
    reach: creator.reach,
    engagement: creator.engagement,
    rating: creator.rating,
    tier: creator.tier,
    response_hrs: creator.responseHrs,
    rate_card: creator.rateCard,
    rate_cards: creator.rateCards ?? null,
    payout: creator.payout,
    wallet_balance: creator.walletBalance,
    pending_balance: creator.pendingBalance,
    lifetime_earnings: creator.lifetimeEarnings,
    verified: creator.verified,
    kyc_verified_at: null,
    editors_pick: false,
    press_mentions: creator.pressMentions,
    availability: null,
    featured_review_ids: [],
    saved_briefs: [],
  };
  const { data, error } = await sb
    .from('creators')
    .insert(row)
    .select(COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  if (!data) throw new Error('Insert returned no row');
  return toCreator(data as unknown as Row);
}

export async function fetchAllCreatorsFromSupabase(): Promise<Creator[]> {
  if (!isSupabaseConfigured()) return [];
  const sb = getSupabase();
  // Phase 52 — read from the public view (migration 025) so we don't
  // pull PII (payout / wallet / owner_email) for every creator. The
  // owner re-fetches their own row via fetchOwnCreatorFromSupabase to
  // hydrate the private columns into the local store.
  const { data, error } = await sb.from('creators_public').select(PUBLIC_COLUMNS);
  if (error) {
    // eslint-disable-next-line no-console
    console.warn('[creatorsRepo] fetchAll failed:', error.message);
    return [];
  }
  // PUBLIC rows lack payout / wallet — fill with zeros so the type
  // stays consistent. The owner's row gets overlaid with the real
  // values via fetchOwnCreatorFromSupabase in the boot hydration.
  return (data ?? []).map((r) => {
    const row = r as unknown as Record<string, unknown>;
    return toCreator({
      ...(row as unknown as Row),
      owner_email: null,
      payout: { method: '', account: '', currency: 'USD' },
      wallet_balance: 0,
      pending_balance: 0,
      lifetime_earnings: 0,
    });
  });
}

/** Owner-only read — fetches the row's full PII columns directly from
 *  the raw `creators` table (RLS enforces auth.email() = owner_email).
 *  Boot hydration calls this once per signed-in creator so the private
 *  columns aren't missing from their own profile / wallet view. */
export async function fetchOwnCreatorFromSupabase(): Promise<Creator | null> {
  if (!isSupabaseConfigured()) return null;
  const sb = getSupabase();
  const { data, error } = await sb.from('creators').select(COLUMNS);
  if (error || !data || data.length === 0) return null;
  // RLS limits this to the owner's own rows — typically 1 row.
  return toCreator(data[0] as unknown as Row);
}

export async function updateCreatorInSupabase(
  creatorId: string,
  patch: UpdatablePatch,
  expectedVersion?: number,
): Promise<Creator> {
  if (!isSupabaseConfigured()) throw new Error('Supabase not configured');
  const sb = getSupabase();
  const rowPatch = toUpdateRowPatch(patch);
  if (Object.keys(rowPatch).length === 0) {
    const { data, error } = await sb.from('creators').select(COLUMNS).eq('id', creatorId).single();
    if (error) throw new Error(error.message);
    return toCreator(data as unknown as Row);
  }
  let q = sb
    .from('creators')
    .update({ ...rowPatch, version: (expectedVersion ?? 0) + 1 })
    .eq('id', creatorId);
  if (expectedVersion !== undefined) q = q.eq('version', expectedVersion);
  try {
    const { data, error } = await q.select(COLUMNS).single();
    if (error) {
      if (expectedVersion !== undefined && isNoRowsError(error)) {
        throw new StaleVersionError('creator', creatorId);
      }
      throw new Error(error.message);
    }
    if (!data) throw new Error('Creator not found or not editable by this user');
    return toCreator(data as unknown as Row);
  } catch (err) {
    if (err instanceof StaleVersionError) throw err;
    if (expectedVersion !== undefined && isNoRowsError(err)) {
      throw new StaleVersionError('creator', creatorId);
    }
    throw err;
  }
}

/** Upload a portrait image to the `creator-portraits` Storage bucket
 *  and return its public URL. Files are namespaced by creator id so
 *  the RLS policy can validate ownership from the path. */
export async function uploadCreatorPortrait(
  creatorId: string,
  file: File,
): Promise<string> {
  if (!isSupabaseConfigured()) throw new Error('Supabase not configured');
  const sb = getSupabase();
  const ext = (file.type.split('/')[1] ?? 'png').replace(/[^a-z0-9]/gi, '');
  const path = `${creatorId}/portrait.${ext}`;
  const { error: uploadError } = await sb
    .storage
    .from('creator-portraits')
    .upload(path, file, {
      cacheControl: '3600',
      upsert: true,
      contentType: file.type,
    });
  if (uploadError) throw new Error(uploadError.message);
  const { data } = sb.storage.from('creator-portraits').getPublicUrl(path);
  return `${data.publicUrl}?v=${Date.now()}`;
}
