// MyCollabs.tsx — the creator's Deals page (portal canvas, Round 3).
//
// Sorted by whose move it is, not by a seven-column board:
//   1. Your move    — what needs.ts says waits on the creator, each with the
//                     button to act (accept in place, resubmit, upload,
//                     paste the live link).
//   2. With brands  — everything else in flight; nothing for you to do.
//   3. Paid         — folded away, with what it earned.
//   4. Didn't go ahead — folded too: kept as a record, never dropped, so a
//                     declined pitch doesn't read as the app losing it.
// The stage tiles on top filter all of it.

import { useMemo, useState } from 'react';
import { useV2AllCampaigns, useV2MyCollabs } from '../v2Hooks';
import { V2_STAGE_META } from '../v2Adapters';
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

type Filter = 'all' | 'offers' | 'pitched' | 'working' | 'releasing' | 'paid';

const FILTERS: { id: Filter; label: string; stages: V2CollabStage[]; tone?: 'hot' | 'done' }[] = [
  { id: 'all', label: 'All deals', stages: [] },
  { id: 'offers', label: 'Offers', stages: ['invited', 'negotiating'], tone: 'hot' },
  { id: 'pitched', label: 'Pitched', stages: ['pitched'] },
  { id: 'working', label: 'Working', stages: ['confirmed', 'submitted'] },
  { id: 'releasing', label: 'Releasing', stages: ['approved', 'live'] },
  { id: 'paid', label: 'Paid', stages: ['paid'], tone: 'done' },
];

const COLS = '40px minmax(0,1.3fr) 132px minmax(0,1.3fr) 110px 120px 168px';
const WITH_BRANDS_PAGE = 8;

export function MyCollabs({ onRoute }: Props) {
  const all = useV2MyCollabs();
  const campaigns = useV2AllCampaigns();
  const needs = useCreatorNeedsYou();
  const db = useStore((s) => s.db);
  const [filter, setFilter] = useState<Filter>('all');
  const [showAllWaiting, setShowAllWaiting] = useState(false);
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
  const stages = FILTERS.find((f) => f.id === filter)!.stages;
  const inFilter = (c: V2Collab) => stages.length === 0 || stages.includes(c.stage);

  // Your move keeps needs.ts's order (most urgent first).
  const mine = needs
    .filter((n) => n.collabId)
    .map((n) => live.find((c) => c.id === n.collabId))
    .filter((c): c is V2Collab => !!c && inFilter(c));
  const waiting = live.filter((c) => c.stage !== 'paid' && !needFor.has(c.id) && inFilter(c));
  const paid = live.filter((c) => c.stage === 'paid' && inFilter(c));
  const earned = paid.reduce((s, c) => s + (c.price > 0 ? splitAcrossSlots(c.price, Math.max(1, c.deliverables.length)).net : 0), 0);

  const count = (f: (typeof FILTERS)[number]) => f.stages.length === 0 ? live.length : live.filter((c) => f.stages.includes(c.stage)).length;
  const yourMove = needs.filter((n) => n.collabId).length;

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
            : `${live.length} deal${live.length === 1 ? '' : 's'}. ${yourMove === 0 ? 'Nothing is your move right now' : `${yourMove === 1 ? 'One is' : `${yourMove} are`} your move`}; the rest are with brands, or paid.`}
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
            <div className="v2-ls-stages" role="group" aria-label="Show deals by stage">
              {FILTERS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  aria-pressed={filter === f.id}
                  data-tone={f.tone && count(f) > 0 ? f.tone : undefined}
                  onClick={() => setFilter(f.id)}
                >
                  <b>{count(f)}</b>
                  <span>{f.label}</span>
                </button>
              ))}
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
                  With brands <span>{waiting.length} · nothing for you to do</span>
                </h2>
                <div className="v2-ls-table" style={{ ['--cols' as string]: COLS }}>
                  {mine.length === 0 && <Head />}
                  {(showAllWaiting ? waiting : waiting.slice(0, WITH_BRANDS_PAGE)).map((c) => row(c))}
                </div>
                {waiting.length > WITH_BRANDS_PAGE && (
                  <div className="v2-ls-foot">
                    <span>Showing <b>{showAllWaiting ? waiting.length : WITH_BRANDS_PAGE}</b> of {waiting.length}</span>
                    <button type="button" className="v2-hm-btn is-sm" onClick={() => setShowAllWaiting((v) => !v)}>
                      {showAllWaiting ? 'Show fewer' : `Show all ${waiting.length}`}
                    </button>
                  </div>
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

            {closed.length > 0 && filter === 'all' && (
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
      <span>Stage</span>
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
  const label = revision ? 'Changes asked' : V2_STAGE_META[c.stage].label;
  const tone = revision ? 'gold' : TONE[c.stage];

  // What happens next, in one line.
  const next = need ? nextForNeed(need) : nextForStage(c, ask, askedAt);

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
        <small>{brand}</small>
      </div>
      <span className="v2-ls-pill v2-ls-hide-sm" data-tone={tone}>{label}</span>
      <span className="v2-ls-hide-md v2-ls-clamp">{next}</span>
      <span className={`v2-ls-hide-sm${soon ? ' v2-ls-soon' : ''}`}>{when}</span>
      <div className="v2-ls-money v2-ls-hide-sm"><b>{money.v}</b>{money.sub && <small>{money.sub}</small>}</div>
      <span className="v2-ls-sm-sub">{label} · {next}</span>
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

function nextForStage(c: V2Collab, ask?: number, askedAt?: string): string {
  switch (c.stage) {
    case 'pitched':
      return `Your pitch${ask ? ` at ${dollars(ask)}` : ''}${askedAt ? ` · sent ${ago(askedAt)}` : ''}`;
    case 'negotiating':
      return 'Your counter is with the brand.';
    case 'invited':
      return 'Invited · open it to pitch.';
    case 'confirmed':
    case 'submitted':
      return 'Your content is with the brand for review.';
    case 'approved':
      return 'Live link sent · the brand confirms it, then releases.';
    case 'live':
      return 'Live · the brand is releasing your payment.';
    case 'paid':
      return 'Paid. Leave the brand a review if you haven’t.';
    case 'cancelled':
      return 'Didn’t go ahead.';
    default:
      return '';
  }
}
