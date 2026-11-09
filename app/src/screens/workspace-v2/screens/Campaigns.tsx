// Campaigns.tsx — the brand's Campaigns page (portal canvas, Round 3).
//
// One row per campaign: status, pitches waiting (the number that matters
// most, in coral), creators on it, posts live, spend against budget, and
// when it ends. Above it, the money across campaigns, each figure saying
// which period it covers, so the totals and the rows can't contradict each
// other (the old page put "$162.5K spent" over fifteen rows of $0: closed
// campaigns held the spend and weren't shown).

import { useMemo, useState } from 'react';
import { type V2Campaign } from '../data';
import { useV2BrandWallet, useV2Campaigns, useV2Creators } from '../v2Hooks';
import { useStore } from '@/lib/api/store';
import { useBrandNeedsYou } from '../needsYou';
import { brandAccent } from '../brandPalette';
import { Avatar } from '@/components/ui/Avatar';
import { Icon } from '../lib';
import { HomeHead, ago, dollars } from './homeParts';

interface Props {
  onRoute: (r: string) => void;
}

type View = 'all' | 'needs' | V2Campaign['status'] | 'archived';
type SortKey = 'pitches' | 'newest' | 'ending' | 'budget';

const STATUS_LABEL: Record<V2Campaign['status'], string> = {
  Live: 'Live', Paused: 'Paused', Planned: 'Draft', Completed: 'Closed',
};
const STATUS_TONE: Record<V2Campaign['status'], 'moss' | 'gold' | 'muted'> = {
  Live: 'moss', Paused: 'gold', Planned: 'muted', Completed: 'muted',
};
const PAGE = 10;
const DAY = 86_400_000;
const COLS = '40px minmax(0,1.5fr) 92px 128px minmax(0,1fr) 96px minmax(0,1.2fr) 84px 20px';

export function Campaigns({ onRoute }: Props) {
  const all = useV2Campaigns();
  const creators = useV2Creators();
  const wallet = useV2BrandWallet();
  const needs = useBrandNeedsYou();
  const dbCampaigns = useStore((s) => s.db.campaigns);
  const archivedIds = useMemo(() => new Set(dbCampaigns.filter((c) => c.archivedAt).map((c) => c.id)), [dbCampaigns]);

  const [view, setView] = useState<View>('all');
  const [sort, setSort] = useState<SortKey>('pitches');
  const [shown, setShown] = useState(PAGE);

  const active = all.filter((c) => !archivedIds.has(c.id));
  const pitchesFor = (id: string) => needs.filter((n) => n.kind === 'pitch' && n.campaignId === id);
  const needsFor = (id: string) => needs.filter((n) => n.campaignId === id).length;

  const live = active.filter((c) => c.status === 'Live');
  const pitchesAll = needs.filter((n) => n.kind === 'pitch');
  const oldestPitch = pitchesAll.map((n) => n.at).filter(Boolean).sort()[0];
  const releasedAllTime = all.reduce((s, c) => s + c.spent, 0);

  const counts: Record<View, number> = {
    all: active.length,
    needs: active.filter((c) => needsFor(c.id) > 0).length,
    Live: live.length,
    Paused: active.filter((c) => c.status === 'Paused').length,
    Planned: active.filter((c) => c.status === 'Planned').length,
    Completed: active.filter((c) => c.status === 'Completed').length,
    archived: archivedIds.size,
  };

  const list = useMemo(() => {
    const base = view === 'archived' ? all.filter((c) => archivedIds.has(c.id))
      : view === 'all' ? active
      : view === 'needs' ? active.filter((c) => needsFor(c.id) > 0)
      : active.filter((c) => c.status === view);
    const left = (c: V2Campaign) => +new Date(c.deadline) - Date.now();
    return [...base].sort((a, b) => {
      if (sort === 'pitches') return pitchesFor(b.id).length - pitchesFor(a.id).length || +new Date(b.createdAt) - +new Date(a.createdAt);
      if (sort === 'ending') return (left(a) < 0 ? Infinity : left(a)) - (left(b) < 0 ? Infinity : left(b));
      if (sort === 'budget') return b.budget - a.budget;
      return +new Date(b.createdAt) - +new Date(a.createdAt);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [all, active, view, sort, needs, archivedIds]);

  const pick = (v: View) => { setView(v); setShown(PAGE); };
  const parts = [`${counts.Live} live`];
  if (counts.Paused) parts.push(`${counts.Paused} paused`);
  if (counts.Planned) parts.push(`${counts.Planned} draft`);

  return (
    <div className="v2-hm">
      <div className="v2-hm-ground">
        <HomeHead
          title="Campaigns"
          // Same total as the sidebar badge, with the pitches broken out.
          sub={`${parts.join(', ')}.${needs.length
            ? ` ${needs.length} thing${needs.length === 1 ? ' is' : 's are'} waiting on you${pitchesAll.length ? `, ${pitchesAll.length === needs.length ? 'all' : pitchesAll.length} of them pitches` : ''}.`
            : ' Nothing is waiting on you.'}`}
          actions={
            <>
              <button type="button" className="v2-hm-btn" onClick={() => onRoute('wallet')}>View ledger</button>
              <button type="button" className="v2-hm-btn is-dark" onClick={() => onRoute('campaign-new')}>New campaign</button>
            </>
          }
        />
      </div>

      <div className="v2-ls-body">
        <section className="v2-cp-ledger" aria-label="Across your campaigns">
          <div><span>Budget on live campaigns</span><b>{dollars(live.reduce((s, c) => s + c.budget, 0))}</b><small>{live.length} campaign{live.length === 1 ? '' : 's'}</small></div>
          <div><span>Held for creators</span><b>{dollars(wallet.reserved)}</b><small>released as posts go live</small></div>
          <div><span>Released this month</span><b>{dollars(wallet.thisMonth.released)}</b><small>{dollars(releasedAllTime)} across every campaign</small></div>
          <div data-tone={pitchesAll.length ? 'hot' : undefined}><span>Pitches to review</span><b>{pitchesAll.length}</b><small>{oldestPitch ? `oldest from ${ago(oldestPitch)}` : 'none waiting'}</small></div>
        </section>

        <div className="v2-ls-bar is-scroll" role="group" aria-label="Show campaigns">
          {([
            ['all', 'All'], ['Live', 'Live'], ['needs', 'Needs you'], ['Paused', 'Paused'], ['Planned', 'Draft'], ['Completed', 'Closed'], ['archived', 'Archived'],
          ] as [View, string][]).filter(([v]) => v === 'all' || counts[v] > 0 || v === view).map(([v, label]) => (
            <button key={v} type="button" className="v2-ls-chip" aria-pressed={view === v} onClick={() => pick(v)}>
              {label} <b>{counts[v]}</b>
            </button>
          ))}
          <select className="v2-ls-chip v2-ls-push" aria-label="Sort campaigns" value={sort} onChange={(e) => { setSort(e.target.value as SortKey); setShown(PAGE); }}>
            <option value="pitches">Most pitches first</option>
            <option value="newest">Newest first</option>
            <option value="ending">Ending soonest</option>
            <option value="budget">Biggest budget</option>
          </select>
        </div>

        {all.length === 0 ? (
          <div className="v2-ls-empty">
            <b>No campaigns yet.</b>
            <p>Post a brief and creators can start pitching, or invite creators you found on Discover.</p>
            <button type="button" className="v2-hm-btn is-dark" onClick={() => onRoute('campaign-new')}>New campaign</button>
          </div>
        ) : list.length === 0 ? (
          <p className="v2-hm-empty">No campaigns here.</p>
        ) : (
          <section aria-label="Campaigns">
            <div className="v2-ls-table" style={{ ['--cols' as string]: COLS }}>
              <div className="v2-ls-head">
                <span /><span>Campaign</span><span>Status</span><span>Pitches</span><span className="v2-ls-hide-md">Creators</span><span className="v2-ls-hide-md">Posts</span><span>Spend</span><span>Ends</span><span />
              </div>
              {list.slice(0, shown).map((c) => (
                <CampaignRow
                  key={c.id}
                  c={c}
                  pitches={pitchesFor(c.id).length}
                  faces={c.creators.map((id) => creators.find((x) => x.id === id)).filter((x): x is NonNullable<typeof x> => !!x)}
                  onOpen={() => onRoute(`campaign:${c.id}`)}
                  onPitches={() => onRoute(`campaign:${c.id}?tab=pipeline`)}
                />
              ))}
            </div>
            <div className="v2-ls-foot">
              <span>Showing <b>{Math.min(shown, list.length)}</b> of {list.length}</span>
              {list.length > shown && (
                <button type="button" className="v2-hm-btn" onClick={() => setShown((n) => n + PAGE)}>Show {Math.min(PAGE, list.length - shown)} more</button>
              )}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function CampaignRow({ c, pitches, faces, onOpen, onPitches }: {
  c: V2Campaign;
  pitches: number;
  faces: { id: string; name: string; avatar: string }[];
  onOpen: () => void;
  onPitches: () => void;
}) {
  const pct = c.budget > 0 ? Math.min(100, Math.round((c.spent / c.budget) * 100)) : 0;
  const days = Math.ceil((+new Date(c.deadline) - Date.now()) / DAY);
  const ends = c.status === 'Paused' ? 'Paused'
    : c.status === 'Completed' ? 'Ended'
    : c.status === 'Planned' ? '—'
    : days < 0 ? 'Past due' : days === 0 ? 'Today' : `${days} day${days === 1 ? '' : 's'}`;
  const soon = c.status === 'Live' && days >= 0 && days <= 5;
  const posts = c.live > 0 ? `${c.live} live` : c.submitted > 0 ? 'In review' : '—';

  return (
    <div className="v2-ls-row" data-href onClick={onOpen}>
      <span className="v2-ls-tile" style={{ background: brandAccent(c.name).bg }} aria-hidden="true">{c.name[0]?.toUpperCase()}</span>
      <div className="v2-ls-main">
        <a className="v2-ls-title" href={`/v2?tab=${encodeURIComponent(`campaign:${c.id}`)}`} onClick={(e) => { e.preventDefault(); e.stopPropagation(); onOpen(); }}>{c.name}</a>
        <small>{[c.category, c.placement].filter(Boolean).join(' · ') || 'No deliverables set'}</small>
      </div>
      <span className="v2-ls-pill v2-ls-hide-sm" data-tone={STATUS_TONE[c.status]}>{STATUS_LABEL[c.status]}</span>
      <span className="v2-ls-hide-sm">
        {pitches > 0
          ? <button type="button" className="v2-cp-new" onClick={(e) => { e.stopPropagation(); onPitches(); }}><i>{pitches}</i>to review</button>
          : <span className="v2-cp-none">—</span>}
      </span>
      <span className="v2-ls-hide-md v2-cp-faces">
        {faces.length > 0 && (
          <span className="v2-cp-stack" aria-hidden="true">
            {faces.slice(0, 3).map((f) => <Avatar key={f.id} src={f.avatar} name={f.name} size={28} />)}
          </span>
        )}
        <span>{faces.length === 0 ? (c.status === 'Live' ? 'Taking pitches' : '—') : `${faces.length} creator${faces.length === 1 ? '' : 's'}`}</span>
      </span>
      <span className="v2-ls-hide-md">{posts}</span>
      <div className="v2-cp-spend v2-ls-hide-sm">
        <div><span><b>{dollars(c.spent)}</b> of {dollars(c.budget)}</span><span>{pct}%</span></div>
        <i role="presentation"><em style={{ width: `${pct}%` }} /></i>
      </div>
      <span className={`v2-ls-hide-sm${soon ? ' v2-ls-soon' : ''}`}>{ends}</span>
      <span className="v2-ls-sm-sub">{STATUS_LABEL[c.status]}{pitches ? ` · ${pitches} pitch${pitches === 1 ? '' : 'es'} to review` : ''} · {dollars(c.spent)} of {dollars(c.budget)}</span>
      <span className="v2-ls-act v2-ls-chev" aria-hidden="true">{Icon.arrow}</span>
    </div>
  );
}
