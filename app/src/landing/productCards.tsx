// productCards.tsx — real product states, drawn flat.
//
// Each one mirrors something the app has: an open brief and its apply form,
// an offer with accept / counter / decline, an offer thread with a paid
// amendment, a brand's pitch list. They carry no brand or creator names:
// they show how it works, not who uses it.

import { Photo } from './components';
import { usd } from './estimate';
import { APPLICATION_LAPSE_DAYS, SAMPLE_STOREFRONT_HREF } from './facts';
import { PHOTOS } from './photos';

const HALF = '(min-width: 900px) 50vw, 100vw';

/** Creators: the two ways a deal reaches you. */
export function WaysIn() {
  return (
    <div className="lx-pair">
      <article>
        <Photo photo={PHOTOS.makeupTable} ratio={3 / 2} sizes={HALF} />
        <h3>Pitch their briefs</h3>
        <p className="lx-text">Open briefs show the deliverables and the rate the brand plans to pay. Send a short pitch with your own price.</p>
        <div className="lx-ui" aria-label="Example: an open brief and your application" data-reveal="">
          <div className="lx-row"><span className="lx-ui-title">Skincare launch</span><span>Open brief</span></div>
          <div className="lx-row"><span>Deliverables</span><b>2 × Instagram Reel</b></div>
          <div className="lx-row"><span>Target rate</span><b>{usd(1500)} per creator</b></div>
          <p className="lx-quote"><small>Your pitch</small>Two Reels built around my morning routine, filmed at home.</p>
          <div className="lx-row"><span>Your rate</span><b className="lx-money-t">{usd(1600)}</b></div>
        </div>
      </article>
      <article>
        <Photo photo={PHOTOS.ringLight} ratio={3 / 2} sizes={HALF} />
        <h3>Get briefed from your page</h3>
        <p className="lx-text">
          Brands who find your storefront can send you a brief or an offer straight away.{' '}
          <a className="lx-link" href={SAMPLE_STOREFRONT_HREF} data-cta="ways-storefront">See a live storefront</a>
        </p>
        <div className="lx-ui" aria-label="Example: an offer from a brand" data-reveal="">
          <div className="lx-row"><span className="lx-ui-title">New offer</span><span>From a skincare brand</span></div>
          <div className="lx-row"><span>For</span><b>2 × Instagram Reel</b></div>
          <div className="lx-row"><span>Rate</span><b className="lx-money-t">{usd(1800)}</b></div>
          <div className="lx-actions"><span className="on">Accept</span><span>Counter</span><span>Decline</span></div>
        </div>
      </article>
    </div>
  );
}

/** Creators: one deal from offer to review, each step beside its note. */
export function OfferThread() {
  const rows = [
    {
      turn: (
        <div className="lx-turn">
          <span className="lx-turn-who">The brand offered</span>
          <span className="lx-turn-what">2 × Instagram Reel</span>
          <span className="lx-money-t struck">{usd(1500)}</span>
        </div>
      ),
      title: 'Your rate card comes first',
      body: 'Brands see your packages and prices before they make an offer.',
    },
    {
      turn: (
        <div className="lx-turn">
          <span className="lx-turn-who">You countered at your Reel rate. <span className="lx-ok">Agreed.</span></span>
          <span className="lx-turn-what">2 × Reel at {usd(900)}</span>
          <span className="lx-money-t">{usd(1800)}</span>
        </div>
      ),
      title: 'Counter anything',
      body: 'Accept, counter or decline every offer. Each round stays on the deal, so nobody argues later about what was agreed.',
    },
    {
      turn: (
        <div className="lx-turn">
          <span className="lx-turn-who">The brand proposed a change</span>
          <span className="lx-turn-what">Add 1 Story</span>
          <span className="lx-money-t">+{usd(250)}</span>
          <div className="lx-actions"><span className="on">Accept</span><span>Decline</span></div>
        </div>
      ),
      title: 'Changes need your yes',
      body: 'Adding a deliverable or extending usage after the deal is a paid change. Nothing applies until you accept it.',
    },
    {
      turn: (
        <div className="lx-turn">
          <span className="lx-turn-who">After the deal</span>
          <span className="lx-turn-what"><span className="lx-stars" aria-label="Five stars">★★★★★</span> Pinned to your storefront</span>
        </div>
      ),
      title: 'Reviews follow you',
      body: 'Brands review you once a deal is done. Pin the best ones to your storefront.',
    },
  ];
  return (
    <ol className="lx-annot" aria-label="Example deal, step by step">
      {rows.map((r) => (
        <li key={r.title} data-reveal="">
          {r.turn}
          <div className="lx-annot-note"><h3>{r.title}</h3><p>{r.body}</p></div>
        </li>
      ))}
    </ol>
  );
}

const PITCHES = [
  { initial: 'B', who: 'Beauty · Instagram', pitch: 'Two Reels built around a morning routine, shot at home.', rate: 1400, age: 'Sent 2 days ago', status: '' },
  { initial: 'L', who: 'Lifestyle · Instagram', pitch: 'A get-ready-with-me Reel, then a before and after a week later.', rate: 1650, age: 'Sent 5 days ago', status: 'Shortlisted' },
  { initial: 'F', who: 'Fitness · Instagram', pitch: 'Post-workout skincare. My audience asks about it every week.', rate: 1500, age: 'Sent 19 days ago', status: '' },
] as const;

/** Brands: what arrives after you post a brief. */
export function PitchInbox() {
  return (
    <div className="lx-pitches" aria-label="Example: pitches on a brief" data-reveal="">
      {PITCHES.map((p) => (
        <div key={p.who} className="lx-pitch">
          <span className="lx-pitch-av" aria-hidden="true">{p.initial}</span>
          <div>
            <div className="lx-pitch-who">{p.who}{p.status && <span className="lx-ok">{p.status}</span>}</div>
            <p>{p.pitch}</p>
            <p className="lx-note">{p.age}</p>
          </div>
          <span className="lx-money-t">{usd(p.rate)}</span>
        </div>
      ))}
      <div className="lx-pitch-bar lx-actions"><span className="on">Accept at their rate</span><span>Counter</span><span>Shortlist</span><span>Pass</span></div>
    </div>
  );
}

export function PitchPoints() {
  const points = [
    { t: 'Accept at their rate', d: 'Each pitch carries the creator’s own price. Accept it as it stands in one step.' },
    { t: 'Shortlist and decide later', d: 'Keep the ones you like together while more pitches come in.' },
    { t: 'Counter or pass', d: 'Reply with your number, or pass. Every round stays on the deal.' },
    { t: 'The list stays current', d: `Pitches nobody answers close after ${APPLICATION_LAPSE_DAYS} days, and the creator is warned first.` },
  ];
  return (
    <div className="lx-points">
      {points.map((p) => <div key={p.t}><h3 className="lx-h3">{p.t}</h3><p>{p.d}</p></div>)}
    </div>
  );
}

/** Brands: the deal from brief to paid, left to right. */
export function DealStages() {
  const stages = [
    { t: 'Brief', d: 'Deliverables per platform, timing and a target rate on one page.' },
    { t: 'Pitches and offers', d: 'Creators pitch you, or you offer to a creator you found. Counter until you both accept.' },
    { t: 'Review', d: 'Creators submit each deliverable. Ask for revisions before you sign it off.' },
    { t: 'Live', d: 'The creator posts and links it, and you check that it’s up.' },
    { t: 'Paid', d: 'Confirming the post releases its share from escrow.' },
  ];
  return (
    <ol className="lx-stages" aria-label="A deal from brief to paid">
      {stages.map((s) => (
        <li key={s.t} data-reveal="">
          <h3 className="lx-stage-t">{s.t}</h3>
          <p>{s.d}</p>
        </li>
      ))}
    </ol>
  );
}
