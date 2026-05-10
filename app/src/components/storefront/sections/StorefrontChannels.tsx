// StorefrontChannels · v2 design sync (§5.1)
//
// Platform identity table — handle, followers, engagement, verified
// status — rendered as channel chips (one row per platform). The
// verified column is the trust cue: post-P6 it's an opt-in OAuth flag,
// so the pill genuinely differentiates connected from claimed.

import type { Creator, Platform } from '@/lib/api/types';
import { fmtCount } from '@/lib/utils/format';

interface Props {
  creator: Creator;
  mode: 'preview' | 'public';
}

const PLATFORM_GLYPHS: Record<Platform['name'], { color: string; mark: string }> = {
  Instagram:  { color: '#E1306C', mark: 'IG' },
  YouTube:    { color: '#FF0000', mark: 'YT' },
  TikTok:     { color: '#000000', mark: 'TT' },
  Newsletter: { color: '#5A3B47', mark: 'NL' },
  X:          { color: '#000000', mark: 'X' },
  LinkedIn:   { color: '#0A66C2', mark: 'in' },
  Substack:   { color: '#FF6719', mark: 'S' },
};

export function StorefrontChannels({ creator }: Props) {
  if (creator.platforms.length === 0) return null;

  return (
    <section className="v2-block">
      <div className="v2-block-eyebrow">Where I post</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
        {creator.platforms.map((p) => {
          const meta = PLATFORM_GLYPHS[p.name];
          return (
            <div key={p.name} className="v2-channel-chip">
              <div className="v2-channel-chip-icon" style={{ background: meta.color }}>
                {meta.mark}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--v2-ink)' }}>
                  {p.name}
                </div>
                <div className="v2-muted" style={{ fontSize: 11.5 }}>{p.handle}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="v2-tabular" style={{
                  fontFamily: 'var(--v2-font-display)',
                  fontSize: 16,
                  fontWeight: 500,
                  letterSpacing: '-0.014em',
                  color: 'var(--v2-ink)',
                }}>
                  {fmtCount(p.followers)}
                </div>
                <div className="v2-muted" style={{ fontSize: 11 }}>
                  {p.engagement}% eng
                </div>
              </div>
              {!p.verified && (
                <span className="v2-pill v2-pill-draft" style={{ fontSize: 10 }}>
                  Self-reported
                </span>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
