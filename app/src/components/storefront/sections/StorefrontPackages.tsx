// StorefrontPackages · v2 design sync (§5.1)
//
// Rate cards rendered as design-file Package cards. Prefers the per-
// platform `creator.rateCards[]` (workspace v2 editor populates this);
// falls back to the legacy quartet (`creator.rateCard`) when empty.
// The middle card is highlighted as "Best value" when there are 3+
// rates on offer — matches the design file's `featured` ribbon.

import type { Creator } from '@/lib/api/types';

interface Props {
  creator: Creator;
  mode: 'preview' | 'public';
}

interface PackageRow {
  type: string;
  title: string;
  desc: string;
  rate: string;
  featured?: boolean;
}

function formatRateLabel(format: string): string {
  if (format === 'longform') return 'Long-form video';
  if (format === 'reel') return 'Sponsored Reel';
  if (format === 'story') return 'Story package';
  if (format === 'post') return 'Sponsored post';
  if (format === 'bundle') return 'Bundle';
  return format;
}

export function StorefrontPackages({ creator }: Props) {
  const cards: PackageRow[] = (() => {
    if (creator.rateCards && creator.rateCards.length > 0) {
      // Mid-row gets the featured ribbon when 3+ rates exist — matches
      // the design's "Best value" pattern.
      const featuredIdx = creator.rateCards.length >= 3 ? Math.floor(creator.rateCards.length / 2) : -1;
      return creator.rateCards.map((r, i) => ({
        type: r.platform === 'All platforms' ? 'Single' : r.platform,
        title: formatRateLabel(r.format),
        desc: r.notes || '1 round of edits included.',
        rate: r.rate || '—',
        featured: i === featuredIdx,
      }));
    }
    // Legacy quartet — Reel + Stories + Post + Long-form, with Reel
    // featured (the highest-volume format on Alamut).
    return [
      { type: 'Single',  title: 'Sponsored Reel',     desc: '60s vertical · 1 round of edits.',          rate: creator.rateCard.reel,     featured: true },
      { type: 'Bundle',  title: 'Story package (×3)', desc: '3 stories with link sticker · same-day.',  rate: creator.rateCard.story },
      { type: 'Single',  title: 'Sponsored post',     desc: 'Single feed post · 1 round of edits.',     rate: creator.rateCard.post },
      { type: 'Single',  title: 'Long-form / YouTube', desc: '3-min review · scripted with voiceover.',  rate: creator.rateCard.longform },
    ];
  })();

  return (
    <section id="rates" className="v2-block">
      <div className="v2-block-eyebrow">Work with me</div>
      <h2 className="v2-storefront-section-h">Rates.</h2>
      <p className="v2-muted" style={{ fontSize: 13.5, margin: '0 0 14px' }}>
        Starting points. Final pricing depends on usage rights, exclusivity, and timeline. All bookings clear escrow on Alamut.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {cards.map((card, i) => (
          <div key={i} className={`v2-package-card ${card.featured ? 'is-featured' : ''}`}>
            {card.featured && (
              <div className="v2-package-card-ribbon">Best value</div>
            )}
            <div className="v2-row" style={{ justifyContent: 'space-between', marginBottom: 4 }}>
              <span className="v2-block-eyebrow" style={{ marginBottom: 0 }}>{card.type}</span>
              <span className="v2-package-card-price">{card.rate}</span>
            </div>
            <div style={{ fontWeight: 550, fontSize: 14.5, marginBottom: 4, color: 'var(--v2-ink)' }}>
              {card.title}
            </div>
            <div className="v2-muted" style={{ fontSize: 13 }}>{card.desc}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
