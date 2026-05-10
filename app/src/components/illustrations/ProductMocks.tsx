// ProductMocks · Phase 55
//
// The previous hero compositions were abstract SVG art — orbiting
// avatar dots, halo gradients, generic "tech illustration" idiom.
// Replaced with realistic product-UI mocks: actual-feeling app
// chrome, real seed creator portraits, real numeric data, real
// brand wordmark treatments. The product is the proof.
//
// Two mocks:
//   · BrandProductMock — campaign brief with applicant rows + ROAS
//     dashboard, as a brand would see it
//   · CreatorStorefrontMock — public storefront card with rate cards
//     + recent deal receipt, as a brand visiting the storefront sees it

import { useStore } from '@/lib/api/store';
import { fmtCount, fmtMoneyFull } from '@/lib/utils/format';
import { BrandWordmark } from './BrandWordmarks';
import { CuratedShowcase } from './CuratedShowcase';

interface MockProps {
  className?: string;
}

// =====================================================================
// BrandProductMock — what a brand sees when they're running a campaign
// =====================================================================
export function BrandProductMock({ className }: MockProps) {
  const db = useStore((s) => s.db);
  // Pull real seed creators for the applicant rows.
  const applicants = db.creators
    .filter((c) => c.verified && c.portrait)
    .slice(0, 4);
  // Pull a real seed brand for the brief.
  const sampleBrand = db.brands.find((b) => b.name === 'Aesop') ?? db.brands[0];

  return (
    <div className={['pm-brand', className].filter(Boolean).join(' ')}>
      {/* Window chrome — looks like a real app pane, not a popup. */}
      <div className="pm-brand-window">
        <header className="pm-brand-window-bar">
          <span className="pm-brand-window-dot" />
          <span className="pm-brand-window-dot" />
          <span className="pm-brand-window-dot" />
          <span className="pm-brand-window-title">brand · campaigns</span>
          <span className="pm-brand-window-status">
            <span className="pm-brand-window-status-dot" aria-hidden="true" />
            Live
          </span>
        </header>

        {/* Brief header */}
        <div className="pm-brand-brief">
          <div className="pm-brand-brief-mark">
            <BrandWordmark name={sampleBrand?.name ?? 'Aesop'} />
          </div>
          <div className="pm-brand-brief-meta">
            <div className="pm-brand-brief-title">Spring fragrance launch · EU + UK</div>
            <div className="pm-brand-brief-line">
              <span>$12,400 budget</span>
              <span aria-hidden="true">·</span>
              <span>10 days to close</span>
              <span aria-hidden="true">·</span>
              <span className="pm-brand-brief-pill">Escrow funded</span>
            </div>
          </div>
        </div>

        {/* Two-column body: applicant list + ROAS dashboard */}
        <div className="pm-brand-body">
          <section className="pm-brand-applicants" aria-label="Applicants">
            <header className="pm-brand-applicants-h">
              <span className="pm-brand-applicants-h-label">Applicants</span>
              <span className="pm-brand-applicants-h-count">{applicants.length} · audience-fit ranked</span>
            </header>
            <ul className="pm-brand-applicant-list">
              {applicants.map((c, i) => {
                const score = [96, 92, 88, 84][i] ?? 80;
                const rate = [3400, 2800, 1900, 1600][i] ?? 1500;
                return (
                  <li key={c.id} className="pm-brand-applicant">
                    <img className="pm-brand-applicant-portrait" src={c.portrait} alt="" loading="lazy" decoding="async" />
                    <div className="pm-brand-applicant-text">
                      <div className="pm-brand-applicant-name">{c.name}</div>
                      <div className="pm-brand-applicant-sub">{fmtCount(c.reach)} reach · {c.platforms[0]?.name ?? 'Instagram'}</div>
                    </div>
                    <div className="pm-brand-applicant-rate">{fmtMoneyFull(rate)}</div>
                    <div className="pm-brand-applicant-score">
                      <span className="pm-brand-applicant-score-num">{score}</span>
                      <span className="pm-brand-applicant-score-label">FIT</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="pm-brand-roas" aria-label="ROAS dashboard">
            <header className="pm-brand-roas-h">
              <span className="pm-brand-roas-h-label">Campaign ROAS</span>
              <span className="pm-brand-roas-h-trend">+12% vs avg</span>
            </header>
            <div className="pm-brand-roas-big">
              4.2<span className="pm-brand-roas-big-x">×</span>
            </div>
            <div className="pm-brand-roas-sub">$52,160 attributed · UTM-tracked</div>
            {/* Mini bar chart — real visual, not abstract bars */}
            <svg viewBox="0 0 200 60" className="pm-brand-roas-chart" aria-hidden="true">
              <g>
                {[28, 38, 32, 46, 52, 44, 58].map((h, i) => (
                  <rect key={i} x={i * 28 + 4} y={60 - h} width="20" height={h} rx="3" fill="var(--cn-accent)" opacity={0.3 + i * 0.10} />
                ))}
              </g>
            </svg>
          </section>
        </div>
      </div>

      {/* Floating notification — campaign just got an application */}
      <div className="pm-brand-toast" role="status">
        <span className="pm-brand-toast-dot" aria-hidden="true" />
        <span className="pm-brand-toast-text">
          <strong>New application</strong>
          <span>97 audience-fit · ready to review</span>
        </span>
      </div>
    </div>
  );
}

// =====================================================================
// CreatorStorefrontMock — what a brand sees when they visit a creator's storefront
// =====================================================================
export function CreatorStorefrontMock({ className }: MockProps) {
  const db = useStore((s) => s.db);
  // Pull a real seed creator with a portrait + work samples.
  const creator = db.creators.find((c) => c.verified && c.portrait && c.work && c.work.length >= 3) ?? db.creators[0];
  if (!creator) return null;

  return (
    <div className={['pm-creator', className].filter(Boolean).join(' ')}>
      <div className="pm-creator-window">
        <header className="pm-creator-window-bar">
          <span className="pm-creator-window-dot" />
          <span className="pm-creator-window-dot" />
          <span className="pm-creator-window-dot" />
          <span className="pm-creator-window-title">alamut.co/c/{(creator.handle || creator.name).replace('@', '').toLowerCase()}</span>
        </header>

        {/* Cover band */}
        <div className="pm-creator-cover" aria-hidden="true" />

        {/* Profile header */}
        <div className="pm-creator-profile">
          <img className="pm-creator-portrait" src={creator.portrait} alt="" loading="lazy" decoding="async" />
          <div className="pm-creator-meta">
            <div className="pm-creator-name">{creator.name}</div>
            <div className="pm-creator-handle">{creator.handle}</div>
            <div className="pm-creator-tags">
              {(creator.categories || []).slice(0, 3).map((cat) => (
                <span key={cat} className="pm-creator-tag">{cat}</span>
              ))}
            </div>
          </div>
          <button type="button" className="pm-creator-cta" tabIndex={-1}>
            Send a brief
          </button>
        </div>

        {/* Stat strip */}
        <div className="pm-creator-stats">
          <div className="pm-creator-stat">
            <div className="pm-creator-stat-v">{fmtCount(creator.reach)}</div>
            <div className="pm-creator-stat-l">REACH</div>
          </div>
          <div className="pm-creator-stat">
            <div className="pm-creator-stat-v">{creator.engagement.toFixed(1)}%</div>
            <div className="pm-creator-stat-l">ENG · 30D</div>
          </div>
          <div className="pm-creator-stat">
            <div className="pm-creator-stat-v">{fmtMoneyFull(creator.lifetimeEarnings)}</div>
            <div className="pm-creator-stat-l">EARNED</div>
          </div>
        </div>

        {/* Phase 56b · Work grid uses the hero-grid showcase variant so
            each tile carries its real campaign capture badge (brand
            wordmark + brief title + month tag) — same treatment as the
            full showcase gallery, scaled down for the small storefront
            window. The grid reads as "shot for closed deals", not stock. */}
        <div className="pm-creator-work">
          <CuratedShowcase variant="hero-grid" count={3} />
        </div>
      </div>

      {/* Floating "deal cleared" receipt — proof, not a claim */}
      <div className="pm-creator-receipt">
        <div className="pm-creator-receipt-bar" aria-hidden="true" />
        <div className="pm-creator-receipt-eyebrow">DEAL CLEARED · 2D AGO</div>
        <div className="pm-creator-receipt-amount">+{fmtMoneyFull(2400)}</div>
        <div className="pm-creator-receipt-meta">
          <BrandWordmark name="Aesop" className="pm-creator-receipt-mark" />
          <span>· Spring fragrance · 1 reel + 2 stories</span>
        </div>
      </div>
    </div>
  );
}
