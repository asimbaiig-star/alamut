// StorefrontReviews · v2 design sync (§5.1)
//
// Featured-pinned-first ordering capped at 4. Consumes
// `useFeaturedReviews` (the canonical ordering hook from P1a) — both
// surfaces have always read it. Now that the ordering AND the render
// both live in shared code, the surfaces cannot drift again.

import type { Creator, Database } from '@/lib/api/types';
import { useFeaturedReviews } from '@/components/storefront/useFeaturedReviews';

interface Props {
  creator: Creator;
  db: Database;
  mode: 'preview' | 'public';
}

export function StorefrontReviews({ creator, db }: Props) {
  const { reviews } = useFeaturedReviews(creator, db);
  if (reviews.length === 0) return null;

  return (
    <section id="reviews" className="v2-block">
      <div className="v2-block-eyebrow">From the brands</div>
      <h2 className="v2-storefront-section-h">In their own words.</h2>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {reviews.map((r) => {
          const fromUser = db.users.find((u) => u.id === r.fromUserId);
          const brand = fromUser?.brandId
            ? db.brands.find((b) => b.id === fromUser.brandId)
            : undefined;
          const cmp = db.campaigns.find((c) => c.id === r.campaignId);
          const fullStars = Math.round(r.rating);
          return (
            <figure key={r.id} className="v2-storefront-review">
              <div className="v2-storefront-review-stars">
                {'★'.repeat(fullStars)}{'☆'.repeat(5 - fullStars)}
              </div>
              <blockquote className="v2-storefront-review-quote">
                &ldquo;{r.text}&rdquo;
              </blockquote>
              <figcaption className="v2-storefront-review-cap">
                {brand?.name ?? 'Brand'}
                {cmp ? ` · ${cmp.title}` : ''}
                {' · '}
                {new Date(r.at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
              </figcaption>
            </figure>
          );
        })}
      </div>
    </section>
  );
}
