// cards-brands.tsx — the brand page's workspace screens: what needs you across
// campaigns, one row per step of the story on the page, and the pitches a
// brief brings (see productCards.tsx).

import { Credits, PhotoImg } from './components';
import { usd } from './estimate';
import { APPLICATION_LAPSE_DAYS } from './facts';
import { PHOTOS } from './photos';
import type { WorkspaceScreen } from './productCards';
import { PlatMark } from './tools-shared';

const need = (what: string, action: string) => (
  <div className="lx-row" key={what}>
    <span className="lx-row-what lx-need"><span className="lx-dot" />{what}</span>
    <span className="lx-mini-btn lx-need-btn lx-if-open">{action} →</span>
    <span className="lx-pill moss lx-need-btn lx-if-done">Done</span>
  </div>
);

/** What needs you across campaigns, as BrandHome lists it. */
export const BRAND_DEAL: WorkspaceScreen = {
  persona: 'brand',
  nav: ['Today', 'Campaigns', 'Creators', 'Inbox', 'Wallet'],
  active: 'Home',
  crumb: 'Home',
  title: 'Needs you',
  rows: [
    need('A new pitch on Weeknight recipes', 'Review pitch'),
    need('Round 2 of a Reel is ready for review', 'Review'),
    need('A creator posted live on Spring launch', 'Verify'),
    need(`${usd(4500)} held on Spring launch`, 'Open ledger'),
    need(`A creator countered at ${usd(2200)} on Spring launch`, 'Respond'),
  ],
};

// Each pitch shows a sample of the creator's work, as pitches in the app link
// to their storefront.
const PITCHES = [
  { work: PHOTOS.makeupTutorial, who: 'Beauty creator · Instagram', pitch: 'Two Reels built around a morning routine, shot at home.', rate: 1400, age: 'Sent 2 days ago', status: '' },
  { work: PHOTOS.pinkBlue, who: 'Lifestyle creator · Instagram', pitch: 'A get-ready-with-me Reel, then a before and after a week later.', rate: 1650, age: 'Sent 5 days ago', status: 'Shortlisted' },
  { work: PHOTOS.dumbbells, who: 'Fitness creator · Instagram', pitch: 'Post-workout skincare. My audience asks about it every week.', rate: 1500, age: 'Sent 19 days ago', status: '' },
];

/** Brands: what arrives after you post a brief. */
export function PitchInbox() {
  return (
    <div className="lx-card lx-pitches" role="group" aria-label="Example: pitches on a brief">
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
