// BrowseBriefs.tsx — the creator's Briefs page (portal canvas, Round 3).
//
// The open briefs a creator can pitch: the three that fit best as
// letterheads, then every brief as one row, ten at a time. One row of
// chips filters (all, open now, fits you, saved, closing this week, opens
// soon), with category, budget and sort beside them. Dollars only.
//
// Fit comes from the one matcher (matching.ts). "Fits you" means the
// matcher scores the brief at FIT_FLOOR or more; it used to mean "briefs
// you're already on", which is not what the chip said.

import { perCreatorTarget } from '../campaignTarget';
import { useMemo, useState } from 'react';
import { Icon } from '../lib';
import { type V2Campaign } from '../data';
import { useV2AllCampaigns, useV2CurrentCreator, v2ToggleSavedBrief } from '../v2Hooks';
import { brandAccent } from '../brandPalette';
import { matchCreatorToCampaign } from '../matching';
import { useStore } from '@/lib/api/store';
import { HomeHead, dollars } from './homeParts';

interface Props {
  onRoute: (r: string) => void;
  /** `creator-campaigns?filter=saved` lands inside the saved briefs. */
  initialFilter?: 'saved';
  /** `creator-campaigns?status=Live`: BriefDetail sends creators here when
   *  the brief they opened isn't taking pitches, so they land among the
   *  ones that are. */
  /** Kept for old deep links (`creator-campaigns?status=…`); only live briefs are listed. */
  initialStatus?: 'all' | 'Live' | 'Planned';
}

type View = 'all' | 'fits' | 'saved' | 'closing';
type BudgetBand = 'any' | 'under5' | 'mid' | 'over15';
type SortKey = 'fit' | 'newest' | 'budget' | 'deadline';

/** A brief "fits you" from this score up. */
export const FIT_FLOOR = 60;
const PAGE = 10;
const DAY = 86_400_000;

const BUDGETS: { id: BudgetBand; label: string; test: (perCreator: number) => boolean }[] = [
  { id: 'any', label: 'Any budget', test: () => true },
  { id: 'under5', label: 'Under $5K a creator', test: (b) => b < 5_000 },
  { id: 'mid', label: '$5K to $15K', test: (b) => b >= 5_000 && b <= 15_000 },
  { id: 'over15', label: 'Over $15K', test: (b) => b > 15_000 },
];

const SORTS: { id: SortKey; label: string }[] = [
  { id: 'fit', label: 'Best fit first' },
  { id: 'newest', label: 'Newest first' },
  { id: 'budget', label: 'Highest pay first' },
  { id: 'deadline', label: 'Closing soonest' },
];

/** Per-creator pay: the budget over the roster, at least four ways, so a
 *  brief with one confirmed creator doesn't look like it pays the lot. */
export const perCreatorOf = (c: V2Campaign) => perCreatorTarget(c);
const daysLeft = (c: V2Campaign) => Math.ceil((+new Date(c.deadline) - Date.now()) / DAY);

interface Scored {
  c: V2Campaign;
  pay: number;
  score: number | null;
  reason?: string;
  left: number;
  /** Already yours: a deal in play, or a pitch waiting on the brand. */
  mine?: 'deal' | 'pitched';
}

export function BrowseBriefs({ onRoute, initialFilter }: Props) {
  const me = useV2CurrentCreator();
  const all = useV2AllCampaigns();
  const db = useStore((s) => s.db);
  const meRaw = me ? db.creators.find((c) => c.id === me.id) : undefined;
  const saved = useMemo(() => new Set(meRaw?.savedBriefs ?? []), [meRaw?.savedBriefs]);

  const [query, setQuery] = useState('');
  const [view, setView] = useState<View>(
    initialFilter === 'saved' ? 'saved' : 'all',
  );
  const [category, setCategory] = useState('any');
  const [budget, setBudget] = useState<BudgetBand>('any');
  const [sort, setSort] = useState<SortKey>('fit');
  const [shown, setShown] = useState(PAGE);

  // Score every open brief once. Live only: a draft is the brand's
  // unpublished work (CampaignStage: "not visible to creators"), and the
  // live database never sends one; listing them as "Opens soon" here showed
  // other brands' drafts in demo mode.
  const open: Scored[] = useMemo(() => all
    .filter((c) => c.status === 'Live')
    .map((c) => {
      const pay = perCreatorOf(c);
      const m = matchCreatorToCampaign(meRaw, db.campaigns.find((x) => x.id === c.id), db, pay);
      // A pitch makes a collaboration at stage 'pitched', so the stage says
      // which: still a pitch, or a deal under way.
      const collab = meRaw ? db.collaborations.find((x) => x.campaignId === c.id && x.creatorId === meRaw.id && x.stage !== 'cancelled') : undefined;
      const pitched = !!meRaw && db.applications.some((a) => a.campaignId === c.id && a.creatorId === meRaw.id && (a.status === 'submitted' || a.status === 'shortlisted'));
      const mine: Scored['mine'] = collab && collab.stage !== 'pitched' ? 'deal' : collab || pitched ? 'pitched' : undefined;
      return { c, pay, score: m.score, reason: m.reasons[0], left: daysLeft(c), mine };
    }), [all, meRaw, db]);

  const categories = useMemo(() => {
    const n = new Map<string, number>();
    for (const { c } of open) if (c.category?.trim()) n.set(c.category.trim(), (n.get(c.category.trim()) ?? 0) + 1);
    return [...n.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k);
  }, [open]);

  const inView = (s: Scored, v: View) => {
    switch (v) {
      case 'fits': return (s.score ?? 0) >= FIT_FLOOR;
      case 'saved': return saved.has(s.c.id);
      case 'closing': return s.left >= 0 && s.left <= 7;
      default: return true;
    }
  };
  const counts: Record<View, number> = {
    all: open.length,
    fits: open.filter((s) => inView(s, 'fits')).length,
    saved: open.filter((s) => inView(s, 'saved')).length,
    closing: open.filter((s) => inView(s, 'closing')).length,
  };
  const rankable = open.some((s) => s.score !== null);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    const band = BUDGETS.find((b) => b.id === budget)!;
    const r = open.filter((s) =>
      inView(s, view)
      && (category === 'any' || (s.c.category ?? '').toLowerCase() === category.toLowerCase())
      && band.test(s.pay)
      && (!q || [s.c.name, s.c.brand, s.c.brief, s.c.category, s.c.placement].some((t) => (t ?? '').toLowerCase().includes(q))));
    const by = sort === 'fit' && !rankable ? 'newest' : sort;
    r.sort((a, b) => {
      if (by === 'fit') return (b.score ?? -1) - (a.score ?? -1);
      if (by === 'budget') return b.pay - a.pay;
      if (by === 'deadline') return (a.left < 0 ? Infinity : a.left) - (b.left < 0 ? Infinity : b.left);
      return +new Date(b.c.createdAt) - +new Date(a.c.createdAt);
    });
    // Briefs you're already in go last: this page is for finding new work.
    // (Saved shows them in place; you saved them to come back to.)
    if (view !== 'saved') return [...r.filter((s) => !s.mine), ...r.filter((s) => s.mine)];
    return r;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, view, category, budget, query, sort, rankable, saved]);

  const filtered = view !== 'all' || category !== 'any' || budget !== 'any' || query.trim() !== '';
  // The three best fits lead the page only on the unfiltered view.
  const best = !filtered && rankable
    // New openings only: a brief already in your deals isn't a lead.
    ? [...open].filter((s) => s.score !== null && !s.mine).sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).slice(0, 3)
    : [];
  const bestIds = new Set(best.map((s) => s.c.id));
  const rows = list.filter((s) => !bestIds.has(s.c.id));

  const change = <T,>(set: (v: T) => void) => (v: T) => { set(v); setShown(PAGE); };
  const toggleSave = (id: string) => v2ToggleSavedBrief(id);

  return (
    <div className="v2-hm">
      <div className="v2-hm-ground">
        <HomeHead
          title="Briefs"
          sub={`${counts.all} open brief${counts.all === 1 ? '' : 's'}.${counts.fits ? ` ${counts.fits} fit your channels and niche` : ''}${counts.saved ? `${counts.fits ? ';' : ''} ${counts.saved} saved` : ''}${counts.fits || counts.saved ? '.' : ''}`}
        />
        <div className="v2-ls-bar v2-ls-ground-bar">
          <label className="v2-ls-search">
            {Icon.search}
            <span className="v2-sr-only">Search briefs</span>
            <input
              type="search"
              value={query}
              onChange={(e) => { setQuery(e.target.value); setShown(PAGE); }}
              placeholder="Search briefs, brands or platforms"
            />
          </label>
        </div>
      </div>

      <div className="v2-ls-body">
        <div className="v2-ls-bar is-scroll" role="group" aria-label="Filter briefs">
          {([
            ['all', 'All open'], ['fits', 'Fits you'], ['saved', 'Saved'], ['closing', 'Closing this week'],
          ] as [View, string][]).filter(([v]) => v === 'all' || counts[v] > 0 || v === view).map(([v, label]) => (
            <button key={v} type="button" className="v2-ls-chip" aria-pressed={view === v} onClick={() => change(setView)(v)}>
              {label} <b>{counts[v]}</b>
            </button>
          ))}
          <span className="v2-ls-sep" aria-hidden="true" />
          <select className="v2-ls-chip" aria-label="Category" value={category} onChange={(e) => change(setCategory)(e.target.value)}>
            <option value="any">Any category</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select className="v2-ls-chip" aria-label="Pay per creator" value={budget} onChange={(e) => change(setBudget)(e.target.value as BudgetBand)}>
            {BUDGETS.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
          </select>
        </div>

        {best.length > 0 && (
          <section aria-labelledby="br-best">
            <h2 className="v2-hm-h2" id="br-best">Fits you best <span>ranked by your niche, channels and past brands</span></h2>
            <div className="v2-br-best">
              {best.map((s) => (
                <BestCard key={s.c.id} s={s} saved={saved.has(s.c.id)} onSave={() => toggleSave(s.c.id)} onOpen={() => onRoute(`brief:${s.c.id}`)} />
              ))}
            </div>
          </section>
        )}

        <section aria-labelledby="br-all">
          <h2 className="v2-hm-h2" id="br-all">
            {best.length > 0 ? 'Every open brief' : filtered ? 'Matching briefs' : 'Open briefs'}
            <span>{best.length > 0 ? `${rows.length} more` : `${rows.length}`}</span>
            <select className="v2-ls-chip v2-ls-push" aria-label="Sort briefs" value={sort} onChange={(e) => change(setSort)(e.target.value as SortKey)}>
              {SORTS.map((o) => <option key={o.id} value={o.id} disabled={o.id === 'fit' && !rankable}>{o.label}</option>)}
            </select>
          </h2>
          {rows.length === 0 ? (
            <div className="v2-ls-empty">
              <b>{view === 'saved' ? 'Nothing saved yet.' : 'No briefs match.'}</b>
              <p>{view === 'saved' ? 'Save a brief with its bookmark and it waits for you here.' : 'Try another filter, or clear the search.'}</p>
              {filtered && (
                <button type="button" className="v2-hm-btn is-sm" onClick={() => { setView('all'); setCategory('any'); setBudget('any'); setQuery(''); setShown(PAGE); }}>
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="v2-ls-table" style={{ ['--cols' as string]: '40px minmax(0,1.5fr) minmax(0,1.1fr) 116px 110px 64px 132px' }}>
                <div className="v2-ls-head">
                  <span /><span>Brief</span><span className="v2-ls-hide-md">Deliverables</span><span>Per creator</span><span>Left to pitch</span><span>Fit</span><span />
                </div>
                {rows.slice(0, shown).map((s) => (
                  <BriefRow key={s.c.id} s={s} saved={saved.has(s.c.id)} onSave={() => toggleSave(s.c.id)} onOpen={() => onRoute(`brief:${s.c.id}`)} />
                ))}
              </div>
              <div className="v2-ls-foot">
                <span>Showing <b>{Math.min(shown, rows.length) + best.length}</b> of {list.length}</span>
                {rows.length > shown && (
                  <button type="button" className="v2-hm-btn" onClick={() => setShown((n) => n + 20)}>
                    Show {Math.min(20, rows.length - shown)} more
                  </button>
                )}
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

function leftLabel(s: Scored): { text: string; soon: boolean } {
  if (s.left < 0) return { text: 'Closed', soon: false };
  if (s.left === 0) return { text: 'Closes today', soon: true };
  return { text: `${s.left} day${s.left === 1 ? '' : 's'}`, soon: s.left <= 7 };
}

function SaveButton({ saved, onSave, name }: { saved: boolean; onSave: () => void; name: string }) {
  return (
    <button
      type="button"
      className="v2-ls-ibtn"
      aria-pressed={saved}
      aria-label={saved ? `Saved: ${name}` : `Save ${name}`}
      title={saved ? 'Saved' : 'Save for later'}
      onClick={(e) => { e.stopPropagation(); onSave(); }}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill={saved ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true"><path d="M7 4h10v16l-5-4-5 4z" /></svg>
    </button>
  );
}

function BestCard({ s, saved, onSave, onOpen }: { s: Scored; saved: boolean; onSave: () => void; onOpen: () => void }) {
  const { c } = s;
  const band = brandAccent(c.brand);
  const left = leftLabel(s);
  return (
    <article className="v2-br-card">
      <div className="v2-br-band" style={{ background: band.bg, color: band.ink }}>
        <i aria-hidden="true">{c.brandLogoUrl ? <img src={c.brandLogoUrl} alt="" /> : c.brand[0]?.toUpperCase()}</i>
        <span>{c.brand}</span>
        {/* F19: a sample brand won't answer a pitch, so say so. */}
        {c.brandIsDemo && <em title="Sample brief: nobody real will answer a pitch">Sample</em>}
      </div>
      <div className="v2-br-body">
        <h3>{c.name}</h3>
        {s.score !== null && (
          <p className="v2-br-why"><b>{s.score}% fit</b>{s.reason ? ` · ${s.reason}` : ''}</p>
        )}
        <div className="v2-br-facts">
          <div><span className="v2-ls-price">{dollars(s.pay)}</span><small>per creator{c.placement ? ` · ${c.placement}` : ''}</small></div>
          <div className="r"><b className={left.soon ? 'v2-ls-soon' : undefined}>{left.text}</b><small>left to pitch</small></div>
        </div>
        <div className="v2-br-acts">
          <button type="button" className="v2-hm-btn is-sm is-dark" onClick={onOpen}>Pitch your rate</button>
          <SaveButton saved={saved} onSave={onSave} name={c.name} />
        </div>
      </div>
    </article>
  );
}

function BriefRow({ s, saved, onSave, onOpen }: { s: Scored; saved: boolean; onSave: () => void; onOpen: () => void }) {
  const { c } = s;
  const left = leftLabel(s);
  return (
    <div className="v2-ls-row" data-href onClick={onOpen}>
      <span className="v2-ls-tile" style={{ background: brandAccent(c.brand).bg }} aria-hidden="true">
        {c.brandLogoUrl ? <img src={c.brandLogoUrl} alt="" /> : c.brand[0]?.toUpperCase()}
      </span>
      <div className="v2-ls-main">
        <a className="v2-ls-title" href={`/v2?tab=${encodeURIComponent(`brief:${c.id}`)}`} onClick={(e) => { e.preventDefault(); e.stopPropagation(); onOpen(); }}>{c.name}</a>
        <small>{c.brand}{c.brandIsDemo ? ' · sample brief' : ''}</small>
      </div>
      <span className="v2-ls-hide-md v2-ls-clamp">{c.placement || '—'}</span>
      <span className="v2-ls-price v2-ls-hide-sm">{dollars(s.pay)}</span>
      <span className={`v2-ls-hide-sm${left.soon ? ' v2-ls-soon' : ''}`}>{left.text}</span>
      <span className="v2-ls-hide-sm v2-br-fit">{s.score === null ? '—' : `${s.score}%`}</span>
      <span className="v2-ls-sm-sub">{dollars(s.pay)} · {left.text}{s.score !== null ? ` · ${s.score}% fit` : ''}</span>
      <div className="v2-ls-act">
        {s.mine ? (
          <span className="v2-ls-dot" data-tone={s.mine === 'deal' ? 'moss' : undefined}>{s.mine === 'deal' ? 'In your deals' : 'You pitched'}</span>
        ) : (
          <>
            <SaveButton saved={saved} onSave={onSave} name={c.name} />
            <button type="button" className="v2-hm-btn is-sm v2-ls-hide-sm" onClick={(e) => { e.stopPropagation(); onOpen(); }}>View</button>
          </>
        )}
      </div>
    </div>
  );
}
