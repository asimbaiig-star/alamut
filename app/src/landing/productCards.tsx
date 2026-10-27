// productCards.tsx — the portal's own screens, drawn small and static.
//
// Each mirrors something the workspace shows: a deal's thread (offer,
// counter, a paid change, the review), a brand's "Needs you" list, the
// pitches on a brief. They carry no brand or creator names: they show how
// it works, not who uses it.

import type { ReactNode } from 'react';
import { Brand, Credits, PhotoImg } from './components';
import { usd } from './estimate';
import { APPLICATION_LAPSE_DAYS } from './facts';
import { BRIEFS } from './listings';
import { PHOTOS } from './photos';

/** The workspace shell: the sidebar as the portal draws it, and one screen. */
function Window({ nav, active, crumb, title, children }: {
  nav: string[]; active: string; crumb: string; title: string; children: ReactNode;
}) {
  return (
    <div className="lx-window" aria-label={`Example: the ${active} screen in the workspace`}>
      <aside className="lx-window-side" aria-hidden="true">
        <Brand />
        {nav.map((n) => <span key={n} className={n === active ? 'lx-window-nav on' : 'lx-window-nav'}>{n}</span>)}
      </aside>
      <div className="lx-window-main">
        <div className="lx-window-top">
          <div><div className="lx-window-crumb">{crumb}</div><div className="lx-window-title">{title}</div></div>
          <span className="lx-pill">Example</span>
        </div>
        {children}
      </div>
    </div>
  );
}

const CREATOR_NAV = ['Home', 'My storefront', 'My collaborations', 'Browse campaigns', 'Inbox', 'Calendar', 'Wallet'];
const BRAND_NAV = ['Home', 'Discover creators', 'My campaigns', 'Inbox', 'Calendar', 'Wallet', 'Brand profile'];

/** Creators: one deal from offer to review. */
export function CreatorDealWindow() {
  return (
    <Window nav={CREATOR_NAV} active="My collaborations" crumb={`My collaborations · ${BRIEFS[0]!.brand}`} title="Skincare launch">
      <div className="lx-card">
        <div className="lx-row">
          <span className="lx-row-who">The brand offered</span>
          <span className="lx-row-what">2 × Instagram Reel</span>
          <span className="lx-money lx-row-amt struck">{usd(1500)}</span>
        </div>
      </div>
      <div className="lx-card">
        <div className="lx-row">
          <span className="lx-row-who">You countered at your Reel rate · <span className="lx-pill moss">Agreed</span></span>
          <span className="lx-row-what">2 × Reel at {usd(900)}</span>
          <span className="lx-money lx-row-amt">{usd(1800)}</span>
        </div>
      </div>
      <div className="lx-card">
        <div className="lx-row">
          <span className="lx-row-who">The brand proposed a paid change</span>
          <span className="lx-row-what">Add 1 Story</span>
          <span className="lx-money lx-row-amt accent">+{usd(250)}</span>
          <div className="lx-row-actions"><span className="lx-mini-btn dark">Accept</span><span className="lx-mini-btn">Decline</span></div>
        </div>
      </div>
      <div className="lx-card">
        <div className="lx-row">
          <span className="lx-row-who">After the deal</span>
          <span className="lx-row-what"><span className="lx-stars" aria-label="Five stars">★★★★★</span> Review pinned to your storefront</span>
        </div>
      </div>
    </Window>
  );
}

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
            <div className="lx-row-what">{p.who} {p.status && <span className="lx-pill moss">{p.status}</span>}</div>
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

/** The way it's done now, beside the way the workspace does it. Every
 *  right-hand cell is something the product does today; the left is the
 *  status quo it replaces, not a competitor. */
export function Compare({ caption, before, rows }: {
  caption: string; before: string; rows: [string, string][];
}) {
  return (
    <div className="lx-compare-wrap">
      <table className="lx-compare">
        <caption className="lx-sr">{caption}</caption>
        <thead>
          <tr><th scope="col">{before}</th><th scope="col">On Alamut</th></tr>
        </thead>
        <tbody>
          {rows.map(([was, now]) => (
            <tr key={now}>
              <td data-label={before}>{was}</td>
              <td data-label="On Alamut">{now}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
