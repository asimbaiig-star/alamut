// BrowseBriefs.tsx — v2 creator-side brief marketplace
//
// The creator counterpart to brand Discover: live campaigns the
// creator can apply to. Top-of-page search + filter chips
// (category, budget band, fit-for-me) + sort dropdown over a card
// grid. Sidebar surfaces this as "Browse campaigns".

import { useMemo, useState } from 'react';
import { fmtUSD, Icon, Topbar } from '../lib';
import { type V2Campaign } from '../data';
import { useV2AllCampaigns, useV2CurrentCreator } from '../v2Hooks';

interface Props {
  onRoute: (r: string) => void;
}

type Status = 'all' | 'Live' | 'Planned';
type BudgetBand = 'any' | 'under5' | 'mid' | 'over15';
type SortKey = 'newest' | 'budget' | 'deadline' | 'fit';

const BUDGET_BANDS: { id: BudgetBand; label: string; test: (b: number) => boolean }[] = [
  { id: 'any',     label: 'Any budget',         test: () => true },
  { id: 'under5',  label: 'Under $5K',          test: (b) => b < 5_000 },
  { id: 'mid',     label: '$5K – $15K',         test: (b) => b >= 5_000 && b <= 15_000 },
  { id: 'over15',  label: 'Over $15K',          test: (b) => b > 15_000 },
];

const SORT_OPTIONS: { id: SortKey; label: string }[] = [
  { id: 'newest',   label: 'Newest first' },
  { id: 'budget',   label: 'Highest budget' },
  { id: 'deadline', label: 'Closest deadline' },
  { id: 'fit',      label: 'Best fit for me' },
];

export function BrowseBriefs({ onRoute }: Props) {
  const me = useV2CurrentCreator();
  const allCampaigns = useV2AllCampaigns();

  const [query, setQuery] = useState('');
  // P1b §1.2: 'Active' was dropped (it conflated per-collab progress with
  // campaign-level state). 'Live' is the only "currently accepting" filter.
  const [status, setStatus] = useState<Status>('all');
  const [fitOnly, setFitOnly] = useState(false);
  const [category, setCategory] = useState<string>('any');
  const [budget, setBudget] = useState<BudgetBand>('any');
  const [sort, setSort] = useState<SortKey>('newest');

  // Derive category options from the actual campaigns the creator can
  // see — keeps the filter list honest (no empty-result categories) and
  // ranks by frequency so the most-active ones lead.
  const categoryOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const c of allCampaigns) {
      if (c.status === 'Completed') continue;
      const cat = c.category?.trim();
      if (!cat) continue;
      counts.set(cat, (counts.get(cat) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name]) => name);
  }, [allCampaigns]);

  const briefs = useMemo(() => {
    let r = allCampaigns.slice();
    // Hide Completed by default since they're not actionable
    r = r.filter((c) => c.status !== 'Completed');

    if (status !== 'all') r = r.filter((c) => c.status === status);
    if (fitOnly && me) {
      r = r.filter((c) => c.creators.includes(me.id));
    }
    if (category !== 'any') {
      r = r.filter((c) => (c.category ?? '').toLowerCase() === category.toLowerCase());
    }
    const band = BUDGET_BANDS.find((b) => b.id === budget);
    if (band) r = r.filter((c) => band.test(c.budget));
    const q = query.trim().toLowerCase();
    if (q) {
      r = r.filter((c) =>
        c.name.toLowerCase().includes(q) ||
        c.brand.toLowerCase().includes(q) ||
        (c.brief ?? '').toLowerCase().includes(q) ||
        (c.category ?? '').toLowerCase().includes(q) ||
        (c.placement ?? '').toLowerCase().includes(q),
      );
    }
    // Sort
    switch (sort) {
      case 'budget':
        r.sort((a, b) => b.budget - a.budget);
        break;
      case 'deadline': {
        const score = (c: V2Campaign) => {
          const d = +new Date(c.deadline) - Date.now();
          // Past deadlines drop to the back; future closer first.
          return d < 0 ? Number.POSITIVE_INFINITY : d;
        };
        r.sort((a, b) => score(a) - score(b));
        break;
      }
      case 'fit':
        r.sort((a, b) => {
          const aFit = me && a.creators.includes(me.id) ? 1 : 0;
          const bFit = me && b.creators.includes(me.id) ? 1 : 0;
          if (aFit !== bFit) return bFit - aFit;
          return +new Date(b.createdAt) - +new Date(a.createdAt);
        });
        break;
      case 'newest':
      default:
        r.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
    }
    return r;
  }, [allCampaigns, status, fitOnly, category, budget, query, sort, me]);

  const liveCount = allCampaigns.filter((c) => c.status === 'Live').length;

  // Count active non-default filters — used for the "Clear all" affordance.
  const activeFilterCount =
    (status !== 'all' ? 1 : 0) +
    (fitOnly ? 1 : 0) +
    (category !== 'any' ? 1 : 0) +
    (budget !== 'any' ? 1 : 0) +
    (query.trim() ? 1 : 0);

  const clearAll = () => {
    setQuery('');
    setStatus('all');
    setFitOnly(false);
    setCategory('any');
    setBudget('any');
  };

  return (
    <>
      <Topbar
        title="Browse campaigns"
        crumb={`${liveCount} live · matching your audience`}
        actions={
          <select
            className="v2-input"
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            style={{ minWidth: 180 }}
            aria-label="Sort campaigns"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.id} value={o.id}>Sort · {o.label}</option>
            ))}
          </select>
        }
      />
      <div className="v2-content">
        {/* Search + filter bar */}
        <div className="v2-card v2-card-pad" style={{ marginBottom: 20 }}>
          {/* Search input — first visual hit at top, full width */}
          <div style={{ position: 'relative', marginBottom: 12 }}>
            <span
              aria-hidden="true"
              style={{
                position: 'absolute',
                left: 12,
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--v2-ink-3)',
                display: 'flex',
              }}
            >
              {Icon.search}
            </span>
            <input
              type="search"
              className="v2-input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by brand, brief title, category, or platform…"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              style={{
                width: '100%',
                paddingLeft: 38,
                paddingRight: query ? 36 : 12,
                fontSize: 14,
              }}
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                aria-label="Clear search"
                style={{
                  position: 'absolute',
                  right: 10,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--v2-ink-3)',
                  fontSize: 18,
                  lineHeight: 1,
                  padding: 4,
                  fontFamily: 'inherit',
                }}
              >×</button>
            )}
          </div>

          {/* Status pills */}
          <div className="v2-row" style={{ gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
            <FilterPill label="All briefs"   active={status === 'all'}     onClick={() => setStatus('all')} />
            <FilterPill label="Live"         active={status === 'Live'}    onClick={() => setStatus('Live')} dot="var(--v2-accent)" />
            <FilterPill label="Coming soon"  active={status === 'Planned'} onClick={() => setStatus('Planned')} dot="var(--v2-ink-3)" />
            <span className="v2-spacer" />
            <label
              className="v2-row"
              style={{
                gap: 8,
                fontSize: 13,
                padding: '6px 12px',
                background: fitOnly ? 'var(--v2-accent-soft)' : 'var(--v2-bg-2)',
                border: `1px solid ${fitOnly ? 'var(--v2-accent)' : 'var(--v2-line)'}`,
                color: fitOnly ? 'var(--v2-accent)' : 'var(--v2-ink-2)',
                borderRadius: 'var(--v2-r-pill)',
                cursor: 'pointer',
                fontWeight: 500,
                transition: 'all 0.12s',
              }}
            >
              <input
                type="checkbox"
                checked={fitOnly}
                onChange={(e) => setFitOnly(e.target.checked)}
                style={{ margin: 0 }}
              />
              <span>Fit for me</span>
            </label>
          </div>

          {/* Budget bands */}
          <div className="v2-row" style={{ gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
            <span className="v2-eyebrow" style={{ alignSelf: 'center', minWidth: 56, fontSize: 10 }}>BUDGET</span>
            {BUDGET_BANDS.map((b) => (
              <FilterPill
                key={b.id}
                label={b.label}
                active={budget === b.id}
                onClick={() => setBudget(b.id)}
              />
            ))}
          </div>

          {/* Category chips — only render if there's more than one to choose between */}
          {categoryOptions.length > 1 && (
            <div className="v2-row" style={{ gap: 8, flexWrap: 'wrap' }}>
              <span className="v2-eyebrow" style={{ alignSelf: 'center', minWidth: 56, fontSize: 10 }}>CATEGORY</span>
              <FilterPill
                label="All"
                active={category === 'any'}
                onClick={() => setCategory('any')}
              />
              {categoryOptions.map((cat) => (
                <FilterPill
                  key={cat}
                  label={cat}
                  active={category.toLowerCase() === cat.toLowerCase()}
                  onClick={() => setCategory(cat)}
                />
              ))}
            </div>
          )}
        </div>

        <div className="v2-row" style={{ justifyContent: 'space-between', marginBottom: 12, alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <div className="v2-muted" style={{ fontSize: 13 }}>
            {briefs.length} {briefs.length === 1 ? 'campaign' : 'campaigns'}
            {activeFilterCount > 0 && (
              <> · {activeFilterCount} filter{activeFilterCount === 1 ? '' : 's'} active</>
            )}
            {' · '}sorted by {SORT_OPTIONS.find((o) => o.id === sort)?.label.toLowerCase()}
          </div>
          {activeFilterCount > 0 && (
            <button
              type="button"
              className="v2-btn v2-btn-ghost v2-btn-sm"
              onClick={clearAll}
            >
              Clear filters
            </button>
          )}
        </div>

        {briefs.length > 0 ? (
          <div className="v2-grid-2">
            {briefs.map((c) => (
              <BriefCard
                key={c.id}
                campaign={c}
                isInRoster={!!me && c.creators.includes(me.id)}
                onApply={() => onRoute(`brief:${c.id}`)}
              />
            ))}
          </div>
        ) : (
          <div className="v2-card v2-card-pad-lg" style={{ textAlign: 'center', padding: 48 }}>
            <div
              aria-hidden="true"
              style={{
                width: 48,
                height: 48,
                borderRadius: 999,
                background: 'var(--v2-bg-1)',
                color: 'var(--v2-ink-3)',
                margin: '0 auto 12px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {Icon.search}
            </div>
            <div style={{ fontSize: 15, fontWeight: 550, marginBottom: 6 }}>
              No campaigns match your filters
            </div>
            <div className="v2-muted" style={{ fontSize: 13, marginBottom: 14 }}>
              {query.trim() ? `Nothing matches "${query.trim()}". ` : ''}Try widening the filters or clear them to see everything.
            </div>
            {activeFilterCount > 0 && (
              <button type="button" className="v2-btn v2-btn-outline v2-btn-sm" onClick={clearAll}>
                Clear filters
              </button>
            )}
          </div>
        )}
      </div>
    </>
  );
}

function FilterPill({ label, active, onClick, dot }: {
  label: string;
  active: boolean;
  onClick: () => void;
  dot?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '6px 12px',
        background: active ? 'var(--v2-ink)' : 'var(--v2-paper)',
        color: active ? 'var(--v2-paper)' : 'var(--v2-ink-2)',
        border: `1px solid ${active ? 'var(--v2-ink)' : 'var(--v2-line)'}`,
        borderRadius: 'var(--v2-r-pill)',
        fontSize: 13,
        fontWeight: 500,
        cursor: 'pointer',
        fontFamily: 'inherit',
        transition: 'all 0.12s',
      }}
    >
      {dot && (
        <span style={{
          width: 6, height: 6, borderRadius: '50%',
          background: dot,
        }} />
      )}
      {label}
    </button>
  );
}

function BriefCard({ campaign, isInRoster, onApply }: {
  campaign: V2Campaign;
  isInRoster: boolean;
  onApply: () => void;
}) {
  const daysLeft = Math.max(
    0,
    Math.ceil((+new Date(campaign.deadline) - Date.now()) / 86_400_000),
  );

  return (
    <article className="v2-card v2-card-pad">
      <div className="v2-row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
        <span
          className={`v2-pill ${campaign.status === 'Live' ? 'v2-pill-live' : 'v2-pill-draft'}`}
        >
          {campaign.status}
        </span>
        <span className="v2-muted" style={{ fontSize: 12 }}>{campaign.brand}</span>
      </div>

      <h3 style={{
        fontFamily: 'var(--v2-font-display)',
        fontSize: 22,
        fontWeight: 500,
        letterSpacing: '-0.022em',
        margin: '4px 0 8px',
        color: 'var(--v2-ink)',
      }}>
        {campaign.name}
      </h3>

      <p className="v2-muted" style={{
        fontSize: 13.5,
        lineHeight: 1.5,
        margin: '0 0 14px',
        display: '-webkit-box',
        WebkitLineClamp: 2,
        WebkitBoxOrient: 'vertical',
        overflow: 'hidden',
      }}>
        {campaign.brief}
      </p>

      <div className="v2-row" style={{ gap: 14, fontSize: 12.5, marginBottom: 14, flexWrap: 'wrap' }}>
        <Meta label="Placement" value={campaign.placement} />
        <Meta label="Deadline" value={daysLeft > 0 ? `${daysLeft}d left` : 'Ended'} />
        <Meta label="Budget" value={fmtUSD(campaign.budget)} accent />
      </div>

      {isInRoster ? (
        <div className="v2-row" style={{ justifyContent: 'space-between', paddingTop: 14, borderTop: '1px solid var(--v2-line)' }}>
          <span className="v2-pill v2-pill-confirmed">
            ✓ You're on this brief
          </span>
          <button className="v2-btn v2-btn-primary v2-btn-sm" type="button" onClick={onApply}>
            Open thread {Icon.arrow}
          </button>
        </div>
      ) : (
        <div className="v2-row" style={{ justifyContent: 'space-between', paddingTop: 14, borderTop: '1px solid var(--v2-line)' }}>
          <button className="v2-btn v2-btn-ghost v2-btn-sm" type="button" onClick={onApply}>
            View brief
          </button>
          <button className="v2-btn v2-btn-accent v2-btn-sm" type="button" onClick={onApply}>
            Apply {Icon.arrow}
          </button>
        </div>
      )}
    </article>
  );
}

function Meta({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <div
        className="v2-muted"
        style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}
      >{label}</div>
      <div
        className={`v2-tabular ${accent ? 'v2-accent-text' : ''}`}
        style={{ fontSize: 13.5, fontWeight: accent ? 600 : 500 }}
      >{value}</div>
    </div>
  );
}
