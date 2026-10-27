// cards-brands.tsx — the brand page's workspace screens: what needs you
// across campaigns, and the pitches a brief brings (see productCards.tsx).

import { Credits, PhotoImg } from './components';
import { usd } from './estimate';
import { APPLICATION_LAPSE_DAYS } from './facts';
import { PHOTOS } from './photos';
import { Window } from './productCards';
import { PlatMark } from './tools-shared';

const BRAND_NAV = ['Home', 'Discover creators', 'My campaigns', 'Inbox', 'Calendar', 'Wallet', 'Brand profile'];

/** Brands: what needs you across campaigns, as BrandHome lists it. */
export function BrandNeedsWindow() {
  const items = [
    { what: 'A creator posted live on Spring launch', action: 'Verify' },
    { what: 'A creator countered at $2,200 on Spring launch', action: 'Respond' },
    { what: 'Round 2 of a Reel is ready for review', action: 'Review' },
    { what: 'A new pitch on Weeknight recipes', action: 'Review pitch' },
  ];
  return (
    <Window nav={BRAND_NAV} active="Home" crumb="Home" title="Needs you">
      <div className="lx-card">
        {items.map((it, i) => (
          <div key={it.what} className="lx-row" style={i ? { borderTop: '1px solid var(--v2-line)' } : undefined}>
            <span className="lx-row-what" style={{ display: 'flex', alignItems: 'center', gap: 10 }}><span className="lx-dot" />{it.what}</span>
            <span className="lx-mini-btn" style={{ gridRow: 1, gridColumn: 2 }}>{it.action} →</span>
          </div>
        ))}
      </div>
    </Window>
  );
}

// Each pitch shows a sample of the creator's work, as pitches in the app link
// to their storefront.
const PITCHES = [
  { work: PHOTOS.makeupTable, who: 'Beauty creator · Instagram', pitch: 'Two Reels built around a morning routine, shot at home.', rate: 1400, age: 'Sent 2 days ago', status: '' },
  { work: PHOTOS.ringLight, who: 'Lifestyle creator · Instagram', pitch: 'A get-ready-with-me Reel, then a before and after a week later.', rate: 1650, age: 'Sent 5 days ago', status: 'Shortlisted' },
  { work: PHOTOS.productSet, who: 'Fitness creator · Instagram', pitch: 'Post-workout skincare. My audience asks about it every week.', rate: 1500, age: 'Sent 19 days ago', status: '' },
];

/** Brands: what arrives after you post a brief. */
export function PitchInbox() {
  return (
    <div className="lx-card lx-pitches" aria-label="Example: pitches on a brief">
      <div className="lx-pitch-row" style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span className="lx-h3">Pitches · Skincare launch</span><span className="lx-pill">Example</span>
      </div>
      {PITCHES.map((p) => (
        <div key={p.who} className="lx-pitch-row">
          <span className="lx-pitch-av"><PhotoImg photo={p.work} width={88} ratio={1} sizes="44px" /></span>
          <div>
            <div className="lx-row-what"><PlatMark of={p.who} />{p.who} {p.status && <span className="lx-pill moss">{p.status}</span>}</div>
            <p>{p.pitch}</p>
            <span className="lx-note">{p.age}</span>
          </div>
          <span className="lx-money lx-row-amt">{usd(p.rate)}</span>
        </div>
      ))}
      <div className="lx-pitch-bar"><span className="lx-mini-btn dark">Accept at their rate</span><span className="lx-mini-btn">Counter</span><span className="lx-mini-btn">Shortlist</span><span className="lx-mini-btn">Pass</span></div>
      <p className="lx-note" style={{ padding: '0 18px 14px', background: 'var(--v2-bg)' }}><Credits photos={PITCHES.map((p) => p.work)} /></p>
    </div>
  );
}

export const LAPSE_LINE = `Pitches nobody answers close after ${APPLICATION_LAPSE_DAYS} days, and the creator is warned before they do.`;
