// v2CreatorActions.ts — creator self-service mutations
//
// Everything a creator wants to configure on their storefront:
//   - identity      · name, handle, bio, city, categories, country
//   - cover photo   · pick from a curated set or paste an image URL
//   - avatar        · pick from a curated set or paste an image URL
//   - channels      · add / edit / remove a platform handle (IG, TikTok, …)
//   - rate cards    · per-platform rates (Reel, Story, Post, Long-form, Bundle)
//   - past brands   · simple add/remove tags for the logo wall
//   - availability  · open / limited / booked + return-date + note
//
// Every mutation wraps `tx()` so changes propagate atomically. Because
// every v2 surface reads through the live store via hooks, the cascade
// is automatic — Discover cards, kanban avatars, brand-side outcome
// cards, Analytics per-channel rows, BriefDetail brand-range hint,
// SendOfferModal default rate, etc. all re-render on next tick.

import { tx } from '@/lib/api/store';
import type {
  Creator, Platform, RateCardEntry, Availability, Database,
} from '@/lib/api/types';
// Phase 5 — Supabase mirror for creator self-service writes. The
// helper below wraps every tx() so we don't have to thread mirror
// calls through 21 separate mutations.
import { isSupabaseConfigured } from '@/lib/supabase';

/** Fire-and-forget Supabase mirror for any Creator field change.
 *  Sends the full editable surface so the helper doesn't need to
 *  know which mutation called it. RLS on the table enforces that
 *  only the creator (auth.email() = owner_email) can land the
 *  write — anyone else's mirror silently no-ops at the DB layer. */
function mirrorCreatorToSupabase(creator: Creator): void {
  if (!isSupabaseConfigured()) return;
  void (async () => {
    try {
      const { updateCreatorInSupabase } = await import('@/lib/data/creatorsRepo');
      await updateCreatorInSupabase(creator.id, {
        name: creator.name,
        handle: creator.handle,
        tagline: creator.tagline,
        bio: creator.bio,
        cover: creator.cover,
        portrait: creator.portrait,
        city: creator.city,
        country: creator.country,
        languages: creator.languages,
        categories: creator.categories,
        work: creator.work,
        pastClients: creator.pastClients,
        platforms: creator.platforms,
        rateCard: creator.rateCard,
        rateCards: creator.rateCards,
        payout: creator.payout,
        availability: creator.availability ?? null,
        featuredReviewIds: creator.featuredReviewIds,
        savedBriefs: creator.savedBriefs,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // Silence "row not found" (generated creators not in Supabase)
      // and RLS rejections (not the row's owner — e.g. brand-side
      // helpers that touch creator data they don't own).
      if (/no rows|0 rows|not found|JSON object requested|new row violates|row-level security/i.test(msg)) return;
      // eslint-disable-next-line no-console
      console.warn('[creator mirror] failed:', msg);
    }
  })();
}

/** Wrap `tx(...)` so the result also mirrors to Supabase when the
 *  caller produced a non-null Creator. Every v2Creator* mutation
 *  threads through this so the v2CreatorActions API stays sync. */
function txCreator(fn: (db: Database) => Creator | null): Creator | null {
  const r = tx(fn);
  if (r) mirrorCreatorToSupabase(r);
  return r;
}

// =====================================================================
// Identity (name, handle, bio, city, categories, country)
// =====================================================================

export interface IdentityPatch {
  name?: string;
  handle?: string;
  bio?: string;
  tagline?: string;
  city?: string;
  country?: string;
  categories?: string[];
  languages?: string[];
  portrait?: string;   // avatar image URL
  cover?: string;      // banner image URL
}

/**
 * Update identity-level fields on the creator record. Empty string values
 * are treated as "no change" (we never blank out a field by accident).
 * The handle is normalized to start with `@` for consistency with the
 * rest of the schema.
 */
export function v2UpdateCreatorIdentity(creatorId: string, patch: IdentityPatch): Creator | null {
  return txCreator((db) => {
    const idx = db.creators.findIndex((c) => c.id === creatorId);
    if (idx === -1) return null;
    const c = db.creators[idx];
    const handle = patch.handle?.trim();
    db.creators[idx] = {
      ...c,
      name: patch.name?.trim() || c.name,
      handle: handle ? (handle.startsWith('@') ? handle : `@${handle}`) : c.handle,
      bio: patch.bio !== undefined ? patch.bio : c.bio,
      tagline: patch.tagline !== undefined ? patch.tagline : c.tagline,
      city: patch.city?.trim() || c.city,
      country: patch.country?.trim() || c.country,
      categories: patch.categories ?? c.categories,
      languages: patch.languages ?? c.languages,
      portrait: patch.portrait?.trim() || c.portrait,
      cover: patch.cover !== undefined ? patch.cover.trim() || undefined : c.cover,
    };
    return db.creators[idx];
  });
}

// =====================================================================
// Channels — add / edit / remove
// =====================================================================
//
// Channels are stored on Creator.platforms as Platform[]. When channels
// change we also recompute Creator.reach (sum of followers) and
// Creator.engagement (avg %) so the cached metrics line up — these are
// what Discover sort-by-followers and Analytics KPIs read.

function recomputeAggregates(platforms: Platform[]): { reach: number; engagement: number } {
  if (platforms.length === 0) return { reach: 0, engagement: 0 };
  const reach = platforms.reduce((s, p) => s + (p.followers || 0), 0);
  const engagement =
    platforms.reduce((s, p) => s + (p.engagement || 0), 0) / platforms.length;
  return { reach, engagement: Math.round(engagement * 10) / 10 };
}

export function v2AddCreatorChannel(creatorId: string, channel: Platform): Creator | null {
  return txCreator((db) => {
    const idx = db.creators.findIndex((c) => c.id === creatorId);
    if (idx === -1) return null;
    const c = db.creators[idx];
    // P6 §5.5 — newly added channels start unverified. The creator
    // earns the badge by going through the dedicated OAuth flow
    // (`v2VerifyChannel`). Force `verified: false` regardless of what
    // the caller passed so the new-channel flow is consistent.
    const channelUnverified: Platform = { ...channel, verified: false };
    // Idempotent: if the same platform+handle already exists, replace it
    const existing = c.platforms.findIndex(
      (p) => p.name === channel.name && p.handle === channel.handle,
    );
    const next = existing >= 0
      // Re-adding an existing channel preserves its current verified
      // status — we don't reverify on edit.
      ? c.platforms.map((p, i) => (i === existing ? { ...channelUnverified, verified: p.verified } : p))
      : [...c.platforms, channelUnverified];
    const agg = recomputeAggregates(next);
    db.creators[idx] = { ...c, platforms: next, reach: agg.reach, engagement: agg.engagement };
    return db.creators[idx];
  });
}

/**
 * P6 §5.5 — flip a channel's `verified: true` after a successful
 * (mock) OAuth handshake. The brief calls for a 1.5s artificial
 * delay; the UI surface (a verification modal) handles the timing —
 * this mutation is the synchronous data-layer commit.
 *
 * Idempotent — re-verifying an already-verified channel is a no-op.
 */
export function v2VerifyChannel(
  creatorId: string,
  channelIndex: number,
): Creator | null {
  return txCreator((db) => {
    const idx = db.creators.findIndex((c) => c.id === creatorId);
    if (idx === -1) return null;
    const c = db.creators[idx];
    if (channelIndex < 0 || channelIndex >= c.platforms.length) return c;
    const channel = c.platforms[channelIndex];
    if (channel.verified) return c;
    const next = c.platforms.map((p, i) =>
      i === channelIndex ? { ...p, verified: true } : p,
    );
    db.creators[idx] = { ...c, platforms: next };
    return db.creators[idx];
  });
}

export function v2UpdateCreatorChannel(
  creatorId: string,
  channelIndex: number,
  changes: Partial<Platform>,
): Creator | null {
  return txCreator((db) => {
    const idx = db.creators.findIndex((c) => c.id === creatorId);
    if (idx === -1) return null;
    const c = db.creators[idx];
    if (channelIndex < 0 || channelIndex >= c.platforms.length) return c;
    const next = c.platforms.map((p, i) => (i === channelIndex ? { ...p, ...changes } : p));
    const agg = recomputeAggregates(next);
    db.creators[idx] = { ...c, platforms: next, reach: agg.reach, engagement: agg.engagement };
    return db.creators[idx];
  });
}

export function v2RemoveCreatorChannel(creatorId: string, channelIndex: number): Creator | null {
  return txCreator((db) => {
    const idx = db.creators.findIndex((c) => c.id === creatorId);
    if (idx === -1) return null;
    const c = db.creators[idx];
    if (channelIndex < 0 || channelIndex >= c.platforms.length) return c;
    const next = c.platforms.filter((_, i) => i !== channelIndex);
    const agg = recomputeAggregates(next);
    db.creators[idx] = { ...c, platforms: next, reach: agg.reach, engagement: agg.engagement };
    return db.creators[idx];
  });
}

// =====================================================================
// Rate cards
// =====================================================================
//
// Two layers exist:
//   - Creator.rateCard (legacy) — single { post, reel, story, longform }
//     of free-form strings like "$300–500"
//   - Creator.rateCards (preferred) — RateCardEntry[] with platform + format
//
// We update both for backward compatibility with admin screens that
// still read the legacy field.

export function v2UpdateLegacyRateCard(
  creatorId: string,
  patch: Partial<{ post: string; reel: string; story: string; longform: string }>,
): Creator | null {
  return txCreator((db) => {
    const idx = db.creators.findIndex((c) => c.id === creatorId);
    if (idx === -1) return null;
    const c = db.creators[idx];
    db.creators[idx] = {
      ...c,
      rateCard: {
        post: patch.post ?? c.rateCard.post,
        reel: patch.reel ?? c.rateCard.reel,
        story: patch.story ?? c.rateCard.story,
        longform: patch.longform ?? c.rateCard.longform,
      },
    };
    return db.creators[idx];
  });
}

export function v2AddRateCardEntry(creatorId: string, entry: Omit<RateCardEntry, 'id'>): Creator | null {
  return txCreator((db) => {
    const idx = db.creators.findIndex((c) => c.id === creatorId);
    if (idx === -1) return null;
    const c = db.creators[idx];
    const newEntry: RateCardEntry = {
      id: `rc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      ...entry,
    };
    db.creators[idx] = {
      ...c,
      rateCards: [...(c.rateCards ?? []), newEntry],
    };
    return db.creators[idx];
  });
}

export function v2UpdateRateCardEntry(
  creatorId: string,
  entryId: string,
  changes: Partial<RateCardEntry>,
): Creator | null {
  return txCreator((db) => {
    const idx = db.creators.findIndex((c) => c.id === creatorId);
    if (idx === -1) return null;
    const c = db.creators[idx];
    if (!c.rateCards) return c;
    db.creators[idx] = {
      ...c,
      rateCards: c.rateCards.map((r) => (r.id === entryId ? { ...r, ...changes } : r)),
    };
    return db.creators[idx];
  });
}

export function v2RemoveRateCardEntry(creatorId: string, entryId: string): Creator | null {
  return txCreator((db) => {
    const idx = db.creators.findIndex((c) => c.id === creatorId);
    if (idx === -1) return null;
    const c = db.creators[idx];
    if (!c.rateCards) return c;
    db.creators[idx] = { ...c, rateCards: c.rateCards.filter((r) => r.id !== entryId) };
    return db.creators[idx];
  });
}

// =====================================================================
// Past brands (simple string list, used for the logo wall)
// =====================================================================

export function v2AddPastBrand(creatorId: string, brandName: string): Creator | null {
  return txCreator((db) => {
    const idx = db.creators.findIndex((c) => c.id === creatorId);
    if (idx === -1) return null;
    const c = db.creators[idx];
    const trimmed = brandName.trim();
    if (!trimmed || c.pastClients.includes(trimmed)) return c;
    db.creators[idx] = { ...c, pastClients: [...c.pastClients, trimmed] };
    return db.creators[idx];
  });
}

export function v2RemovePastBrand(creatorId: string, brandName: string): Creator | null {
  return txCreator((db) => {
    const idx = db.creators.findIndex((c) => c.id === creatorId);
    if (idx === -1) return null;
    const c = db.creators[idx];
    db.creators[idx] = { ...c, pastClients: c.pastClients.filter((n) => n !== brandName) };
    return db.creators[idx];
  });
}

// =====================================================================
// Availability
// =====================================================================

export function v2UpdateAvailability(creatorId: string, availability: Availability): Creator | null {
  return txCreator((db) => {
    const idx = db.creators.findIndex((c) => c.id === creatorId);
    if (idx === -1) return null;
    db.creators[idx] = { ...db.creators[idx], availability };
    return db.creators[idx];
  });
}

// =====================================================================
// Work portfolio (gallery of past work — image URLs)
// =====================================================================
//
// Creator.work is a string[] of image URLs. Used by the public
// storefront's "Recent work" grid (PublicCreator.tsx) and brand-side
// drilldown thumbnails.

export function v2AddWorkSample(creatorId: string, url: string): Creator | null {
  return txCreator((db) => {
    const idx = db.creators.findIndex((c) => c.id === creatorId);
    if (idx === -1) return null;
    const c = db.creators[idx];
    const trimmed = url.trim();
    if (!trimmed || c.work.includes(trimmed)) return c;
    db.creators[idx] = { ...c, work: [...c.work, trimmed] };
    return db.creators[idx];
  });
}

export function v2RemoveWorkSample(creatorId: string, index: number): Creator | null {
  return txCreator((db) => {
    const idx = db.creators.findIndex((c) => c.id === creatorId);
    if (idx === -1) return null;
    const c = db.creators[idx];
    if (index < 0 || index >= c.work.length) return c;
    db.creators[idx] = { ...c, work: c.work.filter((_, i) => i !== index) };
    return db.creators[idx];
  });
}

export function v2ReorderWorkSamples(creatorId: string, from: number, to: number): Creator | null {
  return txCreator((db) => {
    const idx = db.creators.findIndex((c) => c.id === creatorId);
    if (idx === -1) return null;
    const c = db.creators[idx];
    if (from < 0 || from >= c.work.length || to < 0 || to >= c.work.length) return c;
    const next = c.work.slice();
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    db.creators[idx] = { ...c, work: next };
    return db.creators[idx];
  });
}

// =====================================================================
// Press mentions
// =====================================================================
//
// Creator.pressMentions is a { source, title, year }[] used by the
// public storefront's "Press" section. Year is a number; source/title
// are free-form short strings.

export interface PressMentionPatch {
  source?: string;
  title?: string;
  year?: number;
}

export function v2AddPressMention(
  creatorId: string,
  mention: { source: string; title: string; year: number },
): Creator | null {
  return txCreator((db) => {
    const idx = db.creators.findIndex((c) => c.id === creatorId);
    if (idx === -1) return null;
    const c = db.creators[idx];
    const source = mention.source.trim();
    const title = mention.title.trim();
    if (!source || !title) return c;
    // Idempotent — same source+title+year is treated as no-op
    const dupe = c.pressMentions.some(
      (m) => m.source === source && m.title === title && m.year === mention.year,
    );
    if (dupe) return c;
    db.creators[idx] = {
      ...c,
      pressMentions: [...c.pressMentions, { source, title, year: mention.year }],
    };
    return db.creators[idx];
  });
}

export function v2UpdatePressMention(
  creatorId: string,
  index: number,
  changes: PressMentionPatch,
): Creator | null {
  return txCreator((db) => {
    const idx = db.creators.findIndex((c) => c.id === creatorId);
    if (idx === -1) return null;
    const c = db.creators[idx];
    if (index < 0 || index >= c.pressMentions.length) return c;
    const next = c.pressMentions.map((m, i) =>
      i === index
        ? {
            source: changes.source !== undefined ? changes.source.trim() || m.source : m.source,
            title:  changes.title  !== undefined ? changes.title.trim()  || m.title  : m.title,
            year:   changes.year   !== undefined ? changes.year                       : m.year,
          }
        : m,
    );
    db.creators[idx] = { ...c, pressMentions: next };
    return db.creators[idx];
  });
}

export function v2RemovePressMention(creatorId: string, index: number): Creator | null {
  return txCreator((db) => {
    const idx = db.creators.findIndex((c) => c.id === creatorId);
    if (idx === -1) return null;
    const c = db.creators[idx];
    if (index < 0 || index >= c.pressMentions.length) return c;
    db.creators[idx] = {
      ...c,
      pressMentions: c.pressMentions.filter((_, i) => i !== index),
    };
    return db.creators[idx];
  });
}

// =====================================================================
// Featured reviews — creator pins testimonials to the top of their
// public storefront. Read by PublicCreator: featured first (in this
// order), then the chronological tail to fill the visible cap.
// =====================================================================

export function v2PinReview(creatorId: string, reviewId: string): Creator | null {
  return txCreator((db) => {
    const idx = db.creators.findIndex((c) => c.id === creatorId);
    if (idx === -1) return null;
    const c = db.creators[idx];
    // Validate the review actually targets this creator — never pin a
    // brand-review or someone else's review to your own storefront.
    const review = db.reviews.find(
      (r) => r.id === reviewId && r.reviewType === 'creator' && r.targetId === creatorId,
    );
    if (!review) return c;
    const current = c.featuredReviewIds ?? [];
    if (current.includes(reviewId)) return c;
    db.creators[idx] = { ...c, featuredReviewIds: [...current, reviewId] };
    return db.creators[idx];
  });
}

export function v2UnpinReview(creatorId: string, reviewId: string): Creator | null {
  return txCreator((db) => {
    const idx = db.creators.findIndex((c) => c.id === creatorId);
    if (idx === -1) return null;
    const c = db.creators[idx];
    const current = c.featuredReviewIds ?? [];
    if (!current.includes(reviewId)) return c;
    db.creators[idx] = { ...c, featuredReviewIds: current.filter((id) => id !== reviewId) };
    return db.creators[idx];
  });
}

export function v2ReorderFeaturedReviews(
  creatorId: string,
  from: number,
  to: number,
): Creator | null {
  return txCreator((db) => {
    const idx = db.creators.findIndex((c) => c.id === creatorId);
    if (idx === -1) return null;
    const c = db.creators[idx];
    const current = c.featuredReviewIds ?? [];
    if (from < 0 || from >= current.length || to < 0 || to >= current.length) return c;
    const next = current.slice();
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    db.creators[idx] = { ...c, featuredReviewIds: next };
    return db.creators[idx];
  });
}

// =====================================================================
// Curated picker pools (for portrait + cover swap UI)
// =====================================================================
//
// In a real app, these would be uploaded by the creator. For demo
// purposes, we offer a small curated set of Unsplash photos so the
// picker has something nice to show without needing file upload.

export const COVER_PICKER_OPTIONS: { id: string; url: string; label: string }[] = [
  { id: 'sunny',     url: 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=1200&h=400&fit=crop',  label: 'Sunny portrait' },
  { id: 'workspace', url: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=1200&h=400&fit=crop',  label: 'Workspace' },
  { id: 'mountain',  url: 'https://images.unsplash.com/photo-1606117331085-5760e3b58520?w=1200&h=400&fit=crop',  label: 'Mountain' },
  { id: 'food',      url: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=1200&h=400&fit=crop',  label: 'Food spread' },
  { id: 'tech',      url: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=1200&h=400&fit=crop',  label: 'Tech / lab' },
  { id: 'family',    url: 'https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?w=1200&h=400&fit=crop',  label: 'Family' },
  { id: 'fitness',   url: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=1200&h=400&fit=crop',  label: 'Fitness' },
  { id: 'finance',   url: 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=1200&h=400&fit=crop',     label: 'Finance' },
];

export const AVATAR_PICKER_OPTIONS: { id: string; url: string }[] = [
  { id: 'a1', url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&h=200&fit=crop' },
  { id: 'a2', url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&h=200&fit=crop' },
  { id: 'a3', url: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&h=200&fit=crop' },
  { id: 'a4', url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop' },
  { id: 'a5', url: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200&h=200&fit=crop' },
  { id: 'a6', url: 'https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=200&h=200&fit=crop' },
  { id: 'a7', url: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=200&h=200&fit=crop' },
  { id: 'a8', url: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=200&h=200&fit=crop' },
];

export const ALL_PLATFORMS: Platform['name'][] = [
  'Instagram', 'TikTok', 'YouTube', 'LinkedIn', 'X', 'Newsletter', 'Substack',
];

export const ALL_CATEGORIES = [
  'Fashion', 'Beauty', 'Lifestyle', 'Food', 'Travel', 'Tech', 'Gaming',
  'Fitness', 'Health', 'Parenting', 'Finance', 'B2B', 'Newsletter',
  'Education', 'Music', 'Comedy', 'Photography', 'Design',
];

// =====================================================================
// Curated work-sample picker pool
// =====================================================================
//
// Same pattern as cover/avatar — the demo doesn't ship a real upload
// pipeline, so we offer a small curated stock set the creator can drop
// into their portfolio. Real implementation would replace this with
// signed-URL upload + EXIF strip.

export const WORK_PICKER_OPTIONS: { id: string; url: string; label: string }[] = [
  { id: 'editorial-1', url: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?w=800&h=800&fit=crop', label: 'Editorial flatlay' },
  { id: 'editorial-2', url: 'https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=800&h=800&fit=crop', label: 'Style portrait' },
  { id: 'product-1',   url: 'https://images.unsplash.com/photo-1509631179647-0177331693ae?w=800&h=800&fit=crop', label: 'Product detail' },
  { id: 'travel-1',    url: 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=800&h=800&fit=crop', label: 'Travel scene' },
  { id: 'food-1',      url: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&h=800&fit=crop', label: 'Food styling' },
  { id: 'food-2',      url: 'https://images.unsplash.com/photo-1565958011703-44f9829ba187?w=800&h=800&fit=crop', label: 'Beverage shoot' },
  { id: 'tech-1',      url: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=800&h=800&fit=crop', label: 'Tech / desk setup' },
  { id: 'fitness-1',   url: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=800&h=800&fit=crop', label: 'Fitness shoot' },
  { id: 'beauty-1',    url: 'https://images.unsplash.com/photo-1522335789203-aaa687ad2f4f?w=800&h=800&fit=crop', label: 'Beauty close-up' },
  { id: 'lifestyle-1', url: 'https://images.unsplash.com/photo-1499914485622-a88fac536970?w=800&h=800&fit=crop', label: 'Lifestyle scene' },
];

// Common press outlets — surface as quick-pick chips so the creator
// doesn't have to type names that are usually identical across creators.
export const COMMON_PRESS_OUTLETS = [
  'Vogue', 'Forbes', 'Wired', 'The Cut', 'Bon Appétit', 'GQ',
  'Highsnobiety', 'Dawn', 'Aurora', 'Geo TV', 'Hum News',
  'Buzzfeed', 'TechCrunch', 'Fast Company', 'The Verge',
];
