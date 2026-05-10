// StorefrontWork · v2 design sync (§5.1)
//
// Recent-work gallery from `creator.work[]`. Anchor `id="work"` so both
// wrappers can deep-link from the hero CTA row. Square thumbnail grid
// (auto-fill at 160px min) renders cleanly on mobile + desktop.

import type { Creator } from '@/lib/api/types';

interface Props {
  creator: Creator;
  mode: 'preview' | 'public';
}

export function StorefrontWork({ creator }: Props) {
  if (creator.work.length === 0) return null;

  return (
    <section id="work" className="v2-block">
      <div className="v2-block-eyebrow">Recent work</div>
      <h2 className="v2-storefront-section-h">From the archive.</h2>
      <div className="v2-storefront-work-grid">
        {creator.work.map((url, i) => (
          <div
            key={`${url}-${i}`}
            className="v2-storefront-work-cell"
            style={{ backgroundImage: `url(${url})` }}
            aria-label={`Work sample ${i + 1}`}
          />
        ))}
      </div>
    </section>
  );
}
