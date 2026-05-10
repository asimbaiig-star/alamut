// CuratedShowcase · Phase 56
//
// A curated editorial-quality photo gallery that breaks the
// "card grid of icons" rhythm with actual photography. The images
// are hand-picked Unsplash IDs across the registers a real Alamut
// creator portfolio would carry: editorial fashion, beauty, food
// styling, design objects, lifestyle, travel. Each image gets a
// subtle warm-grade treatment + ambient drop shadow + hover scale
// so the wall reads as "curated by a human" rather than stock.
//
// The component is layout-flexible: pass `variant="hero-grid"` for
// the mock work-grid in the storefront mock (3 tiles), or
// `variant="full"` for the full-bleed showcase section (12 tiles).

import type { CSSProperties } from 'react';
import { BrandWordmark } from './BrandWordmarks';

interface CampaignTie {
  brand: string;     // Seed brand name (also drives wordmark treatment)
  brief: string;     // Short campaign label
  date: string;      // Month tag (e.g. "MAR '25")
  cleared?: number;  // Cleared payout for this deal (USD)
  days?: number;     // Days from accept to cleared
  creators?: number; // Number of creators on this campaign
}

interface ShowcaseImage {
  id: string;        // Unsplash photo ID (already in project seed license pool)
  category: 'fashion' | 'beauty' | 'food' | 'design' | 'lifestyle' | 'travel';
  caption?: string;  // Short caption (revealed on hover)
  aspect?: 'tall' | 'square' | 'wide';
  campaign?: CampaignTie;
  /** Brand mood — drives a subtle color tint overlay matching the
      brand's signature palette (Le Creuset blue, Aesop amber, Hay
      sage, etc.). Reads as "this photo carries the brand's mood",
      not stock. */
  mood?: 'amber' | 'navy' | 'sage' | 'rose' | 'sand' | 'slate' | 'olive' | 'cream';
}

// Each tile is tied to a real seed brand + campaign + cleared deal
// stat. Capture badge reads as a marketplace deal record (brand
// wordmark · brief · month · cleared amount). Brand-mood color token
// drives a subtle multiply-blend tint matching the brand's signature
// palette so the wall reads as a moodboard of actual placements.
//
// Photo IDs are picked for brand-category fit (cookware close-ups for
// Le Creuset, amber bottles for Aesop, modern chair for Hay, mountain
// shot for Patagonia, fabric texture for Khaadi heritage). Eighteen
// placements total, multiple per major brand so the wall has rhythm
// and density rather than reading as one-photo-per-brand.
export const CURATED_WORK: ShowcaseImage[] = [
  { id: 'photo-1469334031218-e382a71b716b', category: 'fashion',   caption: 'Spring drop · @sarahstyle',          aspect: 'tall',   mood: 'amber', campaign: { brand: 'Khaadi',     brief: 'Spring drop',         date: "MAR '25", cleared:  4200, days: 4,  creators: 3 } },
  { id: 'photo-1556909114-f6e7ad7d3136',   category: 'food',      caption: 'Heritage cookware · @amircooks',     aspect: 'square', mood: 'navy',  campaign: { brand: 'Le Creuset', brief: 'Heritage cookware',   date: "FEB '25", cleared: 18500, days: 7,  creators: 5 } },
  { id: 'photo-1505740420928-5e560c06d30e', category: 'beauty',    caption: 'Cheek edit · @priyamoves',           aspect: 'square', mood: 'rose',  campaign: { brand: 'Glossier',   brief: 'Cheek edit',          date: "APR '25", cleared:  8400, days: 5,  creators: 4 } },
  { id: 'photo-1567538096631-e0c55bd6374c', category: 'design',    caption: 'Office reset · @marcusphoto',        aspect: 'wide',   mood: 'sage',  campaign: { brand: 'Hay',        brief: 'Office reset',        date: "MAY '25", cleared:  6200, days: 6,  creators: 3 } },
  { id: 'photo-1483985988355-763728e1935b', category: 'lifestyle', caption: 'Quiet hours · @yuki.makes',          aspect: 'tall',   mood: 'cream', campaign: { brand: 'Muji',       brief: 'Quiet hours',         date: "JAN '25", cleared:  3800, days: 4,  creators: 2 } },
  { id: 'photo-1556228720-195a672e8a03',   category: 'food',      caption: 'Cast-iron series · @lena.cooks',     aspect: 'square', mood: 'navy',  campaign: { brand: 'Le Creuset', brief: 'Cast-iron series',    date: "FEB '25", cleared: 12400, days: 8,  creators: 4 } },
  { id: 'photo-1551632811-561732d1e306',   category: 'travel',    caption: 'Field gear FW25 · @sarahstyle',      aspect: 'wide',   mood: 'olive', campaign: { brand: 'Patagonia',  brief: 'Field gear FW25',     date: "JUN '25", cleared:  9800, days: 6,  creators: 3 } },
  { id: 'photo-1571781926291-c477ebfd024b', category: 'beauty',    caption: 'Apothecary range · @priyamoves',     aspect: 'tall',   mood: 'amber', campaign: { brand: 'Aesop',      brief: 'Apothecary range',    date: "MAR '25", cleared: 11200, days: 5,  creators: 3 } },
  { id: 'photo-1542838132-92c53300491e',   category: 'food',      caption: 'Quarterly commission · @amircooks',  aspect: 'square', mood: 'slate', campaign: { brand: 'Kinfolk',    brief: 'Quarterly commission',date: "APR '25", cleared:  5400, days: 14, creators: 1 } },
  { id: 'photo-1490481651871-ab68de25d43d', category: 'fashion',   caption: 'Heritage capsule · @yuki.makes',     aspect: 'tall',   mood: 'sand',  campaign: { brand: 'Khaadi',     brief: 'Heritage capsule',    date: "MAR '25", cleared:  7800, days: 5,  creators: 4 } },
  { id: 'photo-1556228453-efd6c1ff04f6',   category: 'design',    caption: 'Side chair series · @marcusphoto',   aspect: 'square', mood: 'sage',  campaign: { brand: 'Hay',        brief: 'Side chair series',   date: "MAY '25", cleared: 14200, days: 9,  creators: 2 } },
  { id: 'photo-1485518882345-15568b007407', category: 'lifestyle', caption: 'Garden capture · @lena.cooks',       aspect: 'wide',   mood: 'amber', campaign: { brand: 'Aesop',      brief: 'Garden capture',      date: "MAY '25", cleared:  6900, days: 4,  creators: 2 } },
  // Phase 56d · Six additional placements pushing density (12 → 18)
  // so each major brand has multiple tiles. Wall reads as moodboard.
  { id: 'photo-1493244040629-496f6d136e80', category: 'design',    caption: 'Desk study · @marcusphoto',          aspect: 'square', mood: 'cream', campaign: { brand: 'Muji',       brief: 'Desk study',          date: "FEB '25", cleared:  4600, days: 5,  creators: 2 } },
  { id: 'photo-1488554378835-f7acf46e6c98', category: 'travel',    caption: 'Alpine field test · @sarahstyle',    aspect: 'tall',   mood: 'olive', campaign: { brand: 'Patagonia',  brief: 'Alpine field test',   date: "JUL '25", cleared:  7200, days: 7,  creators: 2 } },
  { id: 'photo-1487412947147-5cebf100ffc2', category: 'beauty',    caption: 'Brow product · @priyamoves',         aspect: 'square', mood: 'rose',  campaign: { brand: 'Glossier',   brief: 'Brow product launch', date: "MAY '25", cleared:  5800, days: 4,  creators: 3 } },
  { id: 'photo-1571513800374-df1bbe650e56', category: 'fashion',   caption: 'Block print revival · @yuki.makes',  aspect: 'wide',   mood: 'sand',  campaign: { brand: 'Khaadi',     brief: 'Block print revival', date: "APR '25", cleared:  6400, days: 6,  creators: 4 } },
  { id: 'photo-1505691938895-1758d7feb511', category: 'design',    caption: 'Showroom Tokyo · @marcusphoto',      aspect: 'tall',   mood: 'sage',  campaign: { brand: 'Hay',        brief: 'Showroom Tokyo',      date: "JUN '25", cleared: 16800, days: 11, creators: 3 } },
  { id: 'photo-1620916566398-39f1143ab7be', category: 'beauty',    caption: 'Hand wash range · @lena.cooks',      aspect: 'square', mood: 'amber', campaign: { brand: 'Aesop',      brief: 'Hand wash range',     date: "JUN '25", cleared:  9100, days: 5,  creators: 3 } },
];

function buildUrl(id: string, w = 800, h = 800): string {
  return `https://images.unsplash.com/${id}?w=${w}&h=${h}&fit=crop&auto=format`;
}

interface ShowcaseProps {
  className?: string;
  style?: CSSProperties;
  /** Number of tiles to render. */
  count?: number;
  /** Layout variant. */
  variant?: 'hero-grid' | 'full';
}

export function CuratedShowcase({ className, style, count, variant = 'full' }: ShowcaseProps) {
  const tiles = CURATED_WORK.slice(0, count ?? CURATED_WORK.length);
  return (
    <div className={['showcase', `showcase-${variant}`, className].filter(Boolean).join(' ')} style={style}>
      <div className="showcase-grid">
        {tiles.map((t, i) => (
          <figure
            key={t.id + i}
            className={[
              'showcase-tile',
              `showcase-tile-${t.aspect ?? 'square'}`,
              t.mood ? `showcase-mood-${t.mood}` : '',
            ].filter(Boolean).join(' ')}
          >
            <img
              className="showcase-img"
              src={buildUrl(t.id, 800, t.aspect === 'tall' ? 1000 : 800)}
              alt=""
              loading="lazy"
              decoding="async"
            />
            {/* Brand-mood tint overlay — drives a subtle color veil
                matching the brand's signature palette so each tile
                carries the brand's mood, not stock neutrality. */}
            {t.mood && <div className="showcase-mood-overlay" aria-hidden="true" />}

            {/* Capture badge — marketplace deal record (brand wordmark
                + brief + month + cleared). Reads as a real placement
                log entry, not a stock photo thumbnail. */}
            {t.campaign && (
              <div className="showcase-capture-badge" aria-hidden="true">
                <span className="showcase-capture-dot" />
                <span className="showcase-capture-text">
                  <BrandWordmark name={t.campaign.brand} className="showcase-capture-mark" />
                  <span className="showcase-capture-meta">{t.campaign.brief} · {t.campaign.date}</span>
                </span>
              </div>
            )}

            {/* Deal-stat strip — bottom-right of full-variant tiles.
                Cleared amount + days-to-close + creator count. Real
                marketplace metrics, presented compactly. */}
            {variant === 'full' && t.campaign?.cleared && (
              <div className="showcase-deal-strip" aria-hidden="true">
                <span className="showcase-deal-amount">${formatK(t.campaign.cleared)}</span>
                <span className="showcase-deal-meta">
                  {t.campaign.days}d · {t.campaign.creators ?? 1} creator{(t.campaign.creators ?? 1) === 1 ? '' : 's'}
                </span>
              </div>
            )}

            {variant === 'full' && t.caption && (
              <figcaption className="showcase-caption">
                <span className="showcase-cat mono-meta">{t.category}</span>
                <span className="showcase-cap-text">{t.caption}</span>
              </figcaption>
            )}
          </figure>
        ))}
      </div>
    </div>
  );
}

// Compact dollar formatting for the deal-stat strip ($18,500 → $18.5k).
function formatK(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k`;
  return String(n);
}
