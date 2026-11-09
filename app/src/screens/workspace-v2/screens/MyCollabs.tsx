// MyCollabs.tsx — the creator's Deals page (portal canvas, Round 3).
//
// One way of sorting: by whose move it is (Round 6). The page used to carry
// stage tiles AND whose-move sections, two taxonomies over the same deals.
//   - The money pipeline on top says where the money is, stage by stage,
//     and each stage filters the list (dealPipeline.tsx).
//   1. Your move    — what needsYou.ts says waits on the creator, each with
//                     the button to act (accept, resubmit, upload, paste link).
//   2. Waiting on brands — split into "with the brand" (in review, your
//                     counter) and "pitches out", which are many and quiet.
//   3. Paid, and Didn't go ahead — folded, kept as a record.

import { useMemo, useState } from 'react';
import { useV2AllCampaigns, useV2MyCollabs } from '../v2Hooks';
import { V2_STAGE_META } from '../v2Adapters';
import { DealPipeline, STAGE_GROUPS, stageTotals, type StageGroup } from './dealPipeline';
import { useStore } from '@/lib/api/store';
import { v2AcceptOffer } from '../v2CampaignActions';
import { splitAcrossSlots } from '@/lib/api/money';
import { pushToast } from '@/lib/utils/toast';
import type { V2Campaign, V2Collab, V2CollabStage } from '../data';
import { useCreatorNeedsYou, type CreatorNeed } from '../needsYou';
import { brandAccent } from '../brandPalette';
import { Icon } from '../lib';
import { HomeHead, ago, dollars } from './homeParts';

interface Props {
  onRoute: (r: string) => void;
}

const COLS = '40px minmax(0,1.05fr) minmax(0,1.7fr) 112px 120px 156px';
const PITCHES_PAGE = 6;
const PITCH_STAGES: V2CollabStage[] = ['pitched', 'invited'];

export function MyCollabs({ onRoute }: Props) {
  const all = useV2MyCollabs();
  const campaigns = useV2AllCampaigns();
  const needs = useCreatorNeedsYou();
  const db = useStore((s) => s.db);
  const [filter, setFilter] = useState<StageGroup | null>(null);
  const [showAllPitches, setShowAllPitches] = useState(false);
  const [showPaid, setShowPaid] = useState(false);
  const [showClosed, setShowClosed] = useState(false);

  const campaignOf = (c: V2Collab) => campaigns.find((x) => x.id === c.campaignId);
  const needFor = useMemo(() => {
    const m = new Map<string, CreatorNeed>();
    for (const n of needs) if (n.collabId && !m.has(n.collabId)) m.set(n.collabId, n);
    return m;
  }, [needs]);
  // What the creator asked for when they pitched, for rows with no agreed price.
  const askFor = (c: V2Collab) => db.applications
    .filter((a) => a.campaignId === c.campaignId && a.creatorId === c.creatorId)
    .sort((a, b) => +new Date(b.submittedAt) - +new Date(a.submittedAt))[0];

  const live = all.filter((c) => c.stage !== 'cancelled');
  const closed = all.filter((c) => c.stage === 'cancelled');
  const stages = filter ? STAGE_GROUPS.find((g) => g.id === filter)!.stages : [];
  const inFilter = (c: V2Collab) => stages.length === 0 || stages.includes(c.stage);

  // Your move keeps needs.ts's order (most urgent first).
  const mine = needs
    .filter((n) => n.collabId)
    .map((n) => live.find((c) => c.id === n.collabId))
    .filter((c): c is V2Collab => !!c && inFilter(c));
  const waiting = live.filter((c) => c.stage !== 'paid' && !needFor.has(c.id) && inFilter(c));
  const withBrand = waiting.filter((c) => !PITCH_STAGES.includes(c.stage));
  const pitchesOut = waiting.filter((c) => PITCH_STAGES.includes(c.stage));
  const paid = live.filter((c) => c.stage === 'paid' && inFilter(c));
  const earned = paid.reduce((s, c) => s + (c.price > 0 ? splitAcrossSlots(c.price, Math.max(1, c.deliverables.length)).net : 0), 0);

  const yourMove = needs.filter((n) => n.collabId).length;
  // Money already agreed and on its way: working plus releasing.
  const totals = stageTotals(live, db);
  const onWay = totals.filter((t) => t.id === 'working' || t.id === 'releasing').reduce((n, t) => n + t.amount, 0);

  const row = (c: V2Collab, need?: CreatorNeed) => (
    <DealRow
      key={c.id}
      collab={c}
      camp={campaignOf(c)}
      need={need}
      ask={askFor(c)?.proposedRate}
      askedAt={askFor(c)?.submittedAt}
      onRoute={onRoute}
    />
  );

  return (
    <div className="v2-hm">
      <div className="v2-hm-ground">
        <HomeHead
          title="Deals"
          sub={live.length === 0
            ? 'No deals yet. Pitch a brief, or let brands find your storefront.'
            : `${yourMove === 0 ? 'Nothing needs you right now' : `${yourMove} need${yourMove === 1 ? 's' : ''} you`}.${onWay > 0 ? ` ${dollars(onWay)} is on its way to you as posts go live.` : ''}`}
          actions={<button type="button" className="v2-hm-btn is-dark" onClick={() => onRoute('creator-campaigns')}>Find briefs</button>}
        />
      </div>

      <div className="v2-ls-body">
        {all.length === 0 ? (
          <div className="v2-ls-empty">
            <b>No deals yet.</b>
            <p>Pitch an open brief, or let brands find your storefront. Anything you accept shows up here as it moves.</p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button type="button" className="v2-hm-btn is-dark" onClick={() => onRoute('creator-campaigns')}>Find briefs</button>
              <button type="button" className="v2-hm-btn" onClick={() => onRoute('storefront')}>Polish your storefront</button>
            </div>
          </div>
        ) : (
          <>
            <div className="v2-pipe-wrap">
              <DealPipeline collabs={live} db={db} selected={filter} onPick={(g) => { setFilter(g); setShowAllPitches(false); }} />
              <p className="v2-pipe-note">
                {filter
                  ? <>Showing {STAGE_GROUPS.find((g) => g.id === filter)!.label.toLowerCase()} only. <button type="button" className="v2-hm-link" onClick={() => setFilter(null)}>Show every deal</button></>
                  : 'Each stage filters the list. What you keep is after the platform fee and withholding.'}
              </p>
            </div>

            <section aria-labelledby="dl-mine">
              <h2 className="v2-hm-h2" id="dl-mine">Your move <span>{mine.length === 0 ? 'nothing waiting on you' : `${mine.length}, most urgent first`}</span></h2>
              {mine.length > 0 && (
                <div className="v2-ls-table" style={{ ['--cols' as string]: COLS }}>
                  <Head />
                  {mine.map((c) => row(c, needFor.get(c.id)))}
                </div>
              )}
            </section>

            {waiting.length > 0 && (
              <section aria-labelledby="dl-wait">
                <h2 className="v2-hm-h2" id="dl-wait">
                  Waiting on brands <span>{waiting.length} · nothing for you to do</span>
                </h2>
                {withBrand.length > 0 && (
                  <>
                    <div className="v2-dl-subhead">
                      <b>With the brand</b>
                      <small>Your content is in review, your counter is with them, or a post is waiting to be confirmed.</small>
                    </div>
                    <div className="v2-ls-table" style={{ ['--cols' as string]: COLS }}>
                      {mine.length === 0 && <Head />}
                      {withBrand.map((c) => row(c))}
                    </div>
                  </>
                )}
                {pitchesOut.length > 0 && (
                  <>
                    <div className="v2-dl-subhead">
                      <b>Pitches out</b>
                      <small>{pitchesOut.length} · the brand answers, or the brief closes. Nothing is held until they accept.</small>
                    </div>
                    <div className="v2-ls-table" style={{ ['--cols' as string]: COLS }}>
                      {(showAllPitches ? pitchesOut : pitchesOut.slice(0, PITCHES_PAGE)).map((c) => row(c))}
                    </div>
                    {pitchesOut.length > PITCHES_PAGE && (
                      <div className="v2-ls-foot">
                        <span>Showing <b>{showAllPitches ? pitchesOut.length : PITCHES_PAGE}</b> of {pitchesOut.length} pitches</span>
                        <button type="button" className="v2-hm-btn is-sm" onClick={() => setShowAllPitches((v) => !v)}>
                          {showAllPitches ? 'Show fewer' : `Show all ${pitchesOut.length}`}
                        </button>
                      </div>
                    )}
                  </>
                )}
              </section>
            )}

            {paid.length > 0 && (
              <section aria-label="Paid deals">
                <div className="v2-ls-fold">
                  <span>Paid · {paid.length} deal{paid.length === 1 ? '' : 's'} · {dollars(earned)} after fees</span>
                  <button type="button" className="v2-hm-btn is-sm" aria-expanded={showPaid} onClick={() => setShowPaid((v) => !v)}>
                    {showPaid ? 'Hide paid deals' : 'Show paid deals'}
                  </button>
                </div>
                {showPaid && (
                  <div className="v2-ls-table" style={{ ['--cols' as string]: COLS }}>
                    {paid.map((c) => row(c))}
                  </div>
                )}
              </section>
            )}

            {closed.length > 0 && !filter && (
              <section aria-label="Deals that didn't go ahead">
                <div className="v2-ls-fold" style={{ borderTop: paid.length > 0 ? 0 : undefined }}>
                  <span>Didn’t go ahead · {closed.length} · the brand passed or the offer was withdrawn</span>
                  <button type="button" className="v2-hm-btn is-sm" aria-expanded={showClosed} onClick={() => setShowClosed((v) => !v)}>
                    {showClosed ? 'Hide' : 'Show'}
                  </button>
                </div>
                {showClosed && (
                  <div className="v2-ls-table" style={{ ['--cols' as string]: COLS }}>
                    {closed.map((c) => row(c))}
                  </div>
                )}
              </section>
            )}

            {mine.length === 0 && waiting.length === 0 && paid.length === 0 && (
              <p className="v2-hm-empty">No deals at this stage.</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Head() {
  return (
    <div className="v2-ls-head">
      <span />
      <span>Deal</span>
      <span className="v2-ls-hide-md">What’s next</span>
      <span>When</span>
      <span className="r">Money</span>
      <span />
    </div>
  );
}

const TONE: Partial<Record<V2CollabStage, 'hot' | 'moss' | 'gold' | 'muted'>> = {
  invited: 'hot', negotiating: 'hot', approved: 'moss', live: 'moss', paid: 'moss', cancelled: 'muted',
};

function DealRow({ collab: c, camp, need, ask, askedAt, onRoute }: {
  collab: V2Collab;
  camp?: V2Campaign;
  need?: CreatorNeed;
  ask?: number;
  askedAt?: string;
  onRoute: (r: string) => void;
}) {
  const brand = camp?.brand ?? 'Brand';
  const href = `collab:${c.id}`;
  const slots = Math.max(1, c.deliverables.length);
  const revision = need?.kind === 'revision';
  // Named from the creator's side: an offer waiting on them is an "Offer",
  // not "Negotiating".
  const label = revision ? 'Changes asked'
    : need?.kind === 'offer' && need.offerId ? 'Offer'
    : V2_STAGE_META[c.stage].label;
  const tone = revision ? 'gold' : TONE[c.stage];

  // What happens next, in one line.
  const next = need ? nextForNeed(need) : nextForStage(c, brand, ask, askedAt);

  // When. Before a deal is agreed the date is when the brief closes.
  const agreed = !['invited', 'pitched', 'negotiating', 'cancelled'].includes(c.stage);
  const when = need?.due ? `Due ${need.due}` : c.deadline ? `${agreed ? 'Due' : 'Closes'} ${c.deadline}` : '—';
  const soon = !!need && (need.kind === 'offer' || need.kind === 'revision');

  // Money: once a price is agreed, what the creator keeps after fees; while
  // an offer is open, what they'd keep if they accept; before that, what
  // they asked for. Never "you keep" on a number nobody has agreed to.
  const askNow = ask ?? (c.price > 0 ? c.price : undefined);
  const money = agreed && c.price > 0
    ? { v: dollars(splitAcrossSlots(c.price, slots).net), sub: c.stage === 'paid' ? 'paid to you' : 'you keep' }
    : need?.kind === 'offer' && need.offerId && need.rate
      ? { v: dollars(splitAcrossSlots(need.rate, slots).net), sub: 'you’d keep' }
      : askNow
        ? { v: dollars(askNow), sub: 'your ask' }
        : { v: '—', sub: c.stage === 'invited' ? 'pitch your rate' : '' };

  const accept = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!need?.offerId) return;
    try {
      v2AcceptOffer(need.offerId);
      pushToast(`Offer accepted. ${brand} has been told.`, 'good');
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Couldn’t accept the offer', 'bad');
    }
  };
  const go = (route: string) => (e: React.MouseEvent) => { e.stopPropagation(); onRoute(route); };

  let action: React.ReactNode = <span className="v2-ls-chev" aria-hidden="true">{Icon.arrow}</span>;
  if (need) {
    if (need.kind === 'offer' && need.offerId && need.rate) {
      action = <button type="button" className="v2-hm-btn is-sm is-dark" onClick={accept}>Accept {dollars(need.rate)}</button>;
    } else if (need.kind === 'offer') {
      action = <button type="button" className="v2-hm-btn is-sm" onClick={go(need.route)}>Pitch</button>;
    } else if (need.kind === 'revision') {
      action = <button type="button" className="v2-hm-btn is-sm is-dark" onClick={go(need.route)}>Resubmit</button>;
    } else if (need.kind === 'upload') {
      action = <button type="button" className="v2-hm-btn is-sm is-dark" onClick={go(need.route)}>Upload</button>;
    } else if (need.kind === 'live') {
      action = <button type="button" className="v2-hm-btn is-sm" onClick={go(need.route)}>Paste link</button>;
    }
  }

  return (
    <div
      className="v2-ls-row"
      data-href={href}
      onClick={() => onRoute(href)}
    >
      <span className="v2-ls-tile" style={{ background: brandAccent(brand).bg }} aria-hidden="true">
        {camp?.brandLogoUrl ? <img src={camp.brandLogoUrl} alt="" /> : brand[0]?.toUpperCase()}
      </span>
      <div className="v2-ls-main">
        {/* The row's link for keyboards and screen readers; the row itself is a mouse target. */}
        <a className="v2-ls-title" href={`/v2?tab=${encodeURIComponent(href)}`} onClick={(e) => { e.preventDefault(); e.stopPropagation(); onRoute(href); }}>
          {camp?.name ?? 'Deal'}
        </a>
        {/* The stage sits with the deal; the next step gets the room. */}
        <small>{brand} · <span className="v2-ls-dot" data-tone={tone}>{label}</span></small>
      </div>
      <span className="v2-ls-hide-md v2-ls-clamp">{next}</span>
      <span className={`v2-ls-hide-sm${soon ? ' v2-ls-soon' : ''}`}>{when}</span>
      <div className="v2-ls-money v2-ls-hide-sm"><b>{money.v}</b>{money.sub && <small>{money.sub}</small>}</div>
      <span className="v2-ls-sm-sub">{next}</span>
      <div className="v2-ls-act">{action}</div>
    </div>
  );
}

function nextForNeed(n: CreatorNeed): string {
  switch (n.kind) {
    case 'offer':
      return n.offerId && n.rate
        ? `They offered ${dollars(n.rate)}. Accept, or counter at your rate.`
        : 'Invited you to pitch. Open it to send your rate.';
    case 'revision':
      return n.note ? `“${n.note}” Resubmit the ${n.deliverable ?? 'post'}.` : `Resubmit the ${n.deliverable ?? 'post'}.`;
    case 'upload':
      return `Submit your ${n.deliverable ?? 'content'}.`;
    case 'live':
      return 'Post it, then paste the live link to get paid.';
    default:
      return n.sub;
  }
}

function nextForStage(c: V2Collab, brand: string, ask?: number, askedAt?: string): string {
  switch (c.stage) {
    case 'pitched':
      return `Your pitch${ask ? ` at ${dollars(ask)}` : ''}${askedAt ? ` · sent ${ago(askedAt)}` : ''}`;
    case 'negotiating':
      return `Your counter is with ${brand}.`;
    case 'invited':
      return `${brand} invited you. Open it to pitch.`;
    case 'confirmed':
      // Agreed, nothing uploaded yet (an upload need would be "your move").
      return 'Agreed and held. Upload when it’s ready.';
    case 'submitted':
      return `${brand} is reviewing your content.`;
    case 'approved':
      return `Live link sent. ${brand} confirms it, then that post’s share is released.`;
    case 'live':
      return `Live. ${brand} confirms each post, then releases its share.`;
    case 'paid':
      return 'Paid. Leave the brand a review if you haven’t.';
    case 'cancelled':
      return 'Didn’t go ahead.';
    default:
      return '';
  }
}
