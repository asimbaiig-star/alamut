// productCards.tsx — compact recreations of real product states.
//
// Each card mirrors something the app actually has: an open brief and its
// apply form, an offer with accept / counter / decline, a brand's pitch list
// with shortlist / accept / counter / pass. They are labelled "Example" and
// carry no brand or creator names: they show the mechanism, not a customer.

import { usd } from './estimate';
import { APPLICATION_LAPSE_DAYS, SAMPLE_STOREFRONT_HREF } from './facts';

/** Creators, section 2: the two ways a deal reaches you. */
export function WaysIn() {
  return (
    <div className="lx-ways">
      <article className="lx-way">
        <div className="lx-ui" aria-label="Example brief">
          <div className="lx-ui-row"><span className="lx-ui-title">Skincare launch</span><span className="lx-pill">Open to apply</span></div>
          <div className="lx-ui-row"><span>Deliverables</span><b>2 × Instagram Reel</b></div>
          <div className="lx-ui-row"><span>Target rate</span><b>{usd(1500)} per creator</b></div>
          <div className="lx-ui-field"><span>Your pitch</span><i>Two Reels built around a morning routine…</i></div>
          <div className="lx-ui-row"><span>Your rate</span><b>{usd(1600)}</b></div>
        </div>
        <h3 className="lx-h3">Apply to briefs</h3>
        <p>Open briefs show what the brand wants and what it plans to pay. Apply with a short pitch and the rate you want.</p>
      </article>
      <article className="lx-way">
        <div className="lx-ui" aria-label="Example offer">
          <div className="lx-ui-row"><span className="lx-ui-title">Offer from a brand</span><span className="lx-pill money">New</span></div>
          <div className="lx-ui-row"><span>For</span><b>2 × Instagram Reel</b></div>
          <div className="lx-ui-row"><span>Rate</span><b>{usd(1800)}</b></div>
          <div className="lx-ui-actions"><span className="on">Accept</span><span>Counter</span><span>Decline</span></div>
        </div>
        <h3 className="lx-h3">Get briefed from your page</h3>
        <p>
          Brands who find your storefront can brief you or send an offer straight away.{' '}
          <a className="lx-link" href={SAMPLE_STOREFRONT_HREF} data-cta="ways-storefront">See a live storefront</a>
        </p>
      </article>
    </div>
  );
}

const PITCHES = [
  { initial: 'B', who: 'Beauty · Instagram', pitch: 'Two Reels built around a morning routine, shot at home.', rate: 1400, status: 'New' },
  { initial: 'L', who: 'Lifestyle · Instagram', pitch: 'A get-ready-with-me Reel, then a before/after the week after.', rate: 1650, status: 'Shortlisted' },
  { initial: 'F', who: 'Fitness · Instagram', pitch: 'Post-workout skincare — my audience asks about it weekly.', rate: 1500, status: 'New' },
] as const;

/** Brands, section 2: what arrives after you post a brief. */
export function PitchInbox() {
  return (
    <div className="lx-panel" aria-label="Example pitches on a brief">
      <div className="lx-panel-head"><span className="lx-kicker">Pitches · Skincare launch</span><span className="lx-example">Example</span></div>
      <ul className="lx-pitches">
        {PITCHES.map((p) => (
          <li key={p.who}>
            <span className="lx-pitch-av" aria-hidden="true">{p.initial}</span>
            <div className="lx-pitch-body">
              <div className="lx-pitch-top"><b>{p.who}</b><span className={p.status === 'Shortlisted' ? 'lx-pill money' : 'lx-pill'}>{p.status}</span></div>
              <p>“{p.pitch}”</p>
            </div>
            <span className="lx-pitch-rate tnum">{usd(p.rate)}</span>
          </li>
        ))}
      </ul>
      <div className="lx-ui-actions lx-pitch-actions"><span className="on">Accept at their rate</span><span>Counter</span><span>Shortlist</span><span>Pass</span></div>
    </div>
  );
}

export const LAPSE_LINE = `Pitches nobody answers close after ${APPLICATION_LAPSE_DAYS} days, with a warning first — your inbox doesn't silt up.`;
