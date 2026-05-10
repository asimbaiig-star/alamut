// StorefrontPress · v2 design sync (§5.1)
//
// Press-mention list — source / title / year — rendered in the order
// the creator entered them in the editor. Matches the design's row-
// based pattern (mono eyebrow over title) inside a v2 block.

import type { Creator } from '@/lib/api/types';

interface Props {
  creator: Creator;
  mode: 'preview' | 'public';
}

export function StorefrontPress({ creator }: Props) {
  if (creator.pressMentions.length === 0) return null;

  return (
    <section className="v2-block">
      <div className="v2-block-eyebrow">Press &amp; mentions</div>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {creator.pressMentions.map((p, i) => (
          <div key={i} className="v2-storefront-press-row">
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="v2-storefront-press-source">{p.source}</div>
              <div style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--v2-ink)', lineHeight: 1.45 }}>
                {p.title}
              </div>
            </div>
            <div className="v2-muted" style={{
              fontSize: 12.5,
              fontFamily: 'var(--v2-font-display)',
              fontVariantNumeric: 'tabular-nums',
            }}>
              {p.year}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
