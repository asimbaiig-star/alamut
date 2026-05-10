// StorefrontAudience · v2 design sync (§5.1)
//
// Demographics from the primary platform with audience data attached
// (typically the largest channel by followers). Renders three audience
// stat tiles for at-a-glance reading + a small breakdown panel for
// gender + age + top countries. Returns null if no platform carries
// audience demographics, so wrappers can drop it in unconditionally.

import type { Creator } from '@/lib/api/types';
import { fmtCount } from '@/lib/utils/format';

interface Props {
  creator: Creator;
  mode: 'preview' | 'public';
}

export function StorefrontAudience({ creator }: Props) {
  const primary =
    creator.platforms.find((p) => p.audience) || creator.platforms[0];
  const audience = primary?.audience;
  if (!audience || !primary) return null;

  // Headline tiles — three at-a-glance stats matching the design's
  // grid-3 audience pattern in creator-screens.jsx.
  const female = audience.genderSplit.female;
  const age2534 = audience.ageBuckets['25-34'];
  const topCountry = audience.topCountries[0];

  return (
    <section id="audience" className="v2-block">
      <div className="v2-block-eyebrow">About my audience</div>
      <h2 className="v2-storefront-section-h">Who's watching.</h2>
      <div className="v2-row" style={{ justifyContent: 'space-between', marginBottom: 14 }}>
        <span className="v2-muted" style={{ fontSize: 12 }}>
          {primary.name} · {fmtCount(primary.followers)} reach
        </span>
        <span
          className={`v2-pill ${audience.audienceCredibilityScore >= 80 ? 'v2-pill-moss' : audience.audienceCredibilityScore >= 60 ? 'v2-pill-draft' : 'v2-pill-live'}`}
          style={{ fontSize: 11 }}
        >
          {audience.audienceCredibilityScore} credibility
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 14 }}>
        <div className="v2-audience-stat">
          <div className="v2-audience-stat-v">{female}%</div>
          <div className="v2-audience-stat-l">Female</div>
        </div>
        <div className="v2-audience-stat">
          <div className="v2-audience-stat-v">{age2534}%</div>
          <div className="v2-audience-stat-l">Age 25–34</div>
        </div>
        <div className="v2-audience-stat">
          <div className="v2-audience-stat-v">{topCountry?.country ?? '—'}</div>
          <div className="v2-audience-stat-l">Top country</div>
        </div>
      </div>

      {/* Country breakdown — slim bars for the top 5 origins. */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {audience.topCountries.slice(0, 5).map((c) => (
          <div key={c.country} className="v2-row" style={{ gap: 10, alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: 'var(--v2-ink-2)', flexBasis: 110 }}>{c.country}</span>
            <div style={{
              flex: 1,
              height: 6,
              background: 'var(--v2-bg-2)',
              borderRadius: 999,
              overflow: 'hidden',
            }}>
              <div style={{
                width: `${c.pct}%`,
                height: '100%',
                background: 'var(--v2-ink-3)',
              }} />
            </div>
            <span className="v2-tabular v2-muted" style={{ fontSize: 11.5, minWidth: 36, textAlign: 'right' }}>
              {c.pct}%
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
