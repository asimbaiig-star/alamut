// useFeaturedReviews.ts — single source of truth for storefront review ordering.
//
// PublicCreator (`/c/:handle`) and PublicStorefront (`public:<handle>`)
// must agree on which reviews surface and in which order. Pre-P1a both
// implemented the same featured-pinned-first / chronological-tail logic
// inline; in s19 PublicStorefront drifted out of sync. This hook is the
// canonical implementation — both surfaces consume it.

import { useMemo } from 'react';
import type { Creator, Database, Review } from '@/lib/api/types';

export interface FeaturedReviewsResult {
  /** Reviews shown on the storefront, capped at `cap`. */
  reviews: Review[];
  /** True when the creator has pinned at least one review. */
  hasFeatured: boolean;
  /** Total review count across all status (used for "X reviews" copy). */
  total: number;
}

export function useFeaturedReviews(
  creator: Creator | null,
  db: Database,
  cap = 4,
): FeaturedReviewsResult {
  return useMemo(() => {
    if (!creator) return { reviews: [], hasFeatured: false, total: 0 };

    // P4 §3.2 — admin-hidden reviews are filtered out of every public
    // storefront read path. The row stays in `db.reviews` for audit;
    // the filter just removes it from anything user-visible.
    const all = db.reviews.filter(
      (r) => r.reviewType === 'creator' && r.targetId === creator.id && !r.hidden,
    );
    const featuredIds = creator.featuredReviewIds ?? [];

    // Pinned reviews in pin order (skip any whose id no longer resolves
    // — a brand-side review removal would orphan a pin).
    const featured = featuredIds
      .map((id) => all.find((r) => r.id === id))
      .filter((r): r is Review => Boolean(r));

    // Tail = chronological, excluding already-pinned ids.
    const tail = all
      .filter((r) => !featuredIds.includes(r.id))
      .sort((a, b) => +new Date(b.at) - +new Date(a.at));

    return {
      reviews: [...featured, ...tail].slice(0, cap),
      hasFeatured: featured.length > 0,
      total: all.length,
    };
  }, [creator, db, cap]);
}
