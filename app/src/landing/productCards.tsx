// productCards.tsx — real product states, drawn flat.
//
// Each one mirrors something the app has: an offer thread with a counter
// and a paid amendment, a brand's pitch list, a deal's stages. They carry no brand or creator names:
// they show how it works, not who uses it.

import { usd } from './estimate';
import { APPLICATION_LAPSE_DAYS } from './facts';

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
        <li key={r.title}>
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
    <div className="lx-pitches" aria-label="Example: pitches on a brief">
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
        <li key={s.t}>
          <h3 className="lx-stage-t">{s.t}</h3>
          <p>{s.d}</p>
        </li>
      ))}
    </ol>
  );
}

export const LAPSE_LINE = `Pitches nobody answers close after ${APPLICATION_LAPSE_DAYS} days, and the creator is warned before they do.`;
