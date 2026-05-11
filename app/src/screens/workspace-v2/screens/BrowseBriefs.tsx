// BrowseBriefs.tsx — v2 creator-side brief marketplace
//
// The creator counterpart to brand Discover: live campaigns the
// creator can apply to. Top-of-page search + filter chips
// (category, budget band, fit-for-me) + sort dropdown over a card
// grid. Sidebar surfaces this as "Browse campaigns".

import { useEffect, useMemo, useRef, useState } from 'react';
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

  // Active filter chips — only present ones the user has narrowed.
  // Used by the "what's applied" strip above the results so the
  // current view is legible at a glance + one-click removable.
  const activeChips: { key: string; label: string; clear: () => void }[] = [];
  if (query.trim())     activeChips.push({ key: 'q',   label: `“${query.trim()}”`,                                clear: () => setQuery('') });
  if (status !== 'all') activeChips.push({ key: 's',   label: status === 'Live' ? 'Live only' : 'Coming soon',     clear: () => setStatus('all') });
  if (fitOnly)          activeChips.push({ key: 'fit', label: 'Fit for me',                                        clear: () => setFitOnly(false) });
  if (budget !== 'any') activeChips.push({ key: 'b',   label: BUDGET_BANDS.find((b) => b.id === budget)?.label ?? '', clear: () => setBudget('any') });
  if (category !== 'any') activeChips.push({ key: 'c', label: category,                                            clear: () => setCategory('any') });

  return (
    <>
      <Topbar
        title="Browse campaigns"
        crumb={`${liveCount} live briefs · matching your audience`}
      />
      <div className="v2-content">
        {/* Hero search — dominant first-touch element. Soft tinted
            surface so it reads as the primary affordance and the chip
            rows underneath stay quiet by comparison. */}
        <div
          style={{
            background: 'linear-gradient(180deg, var(--v2-bg-1) 0%, var(--v2-paper) 100%)',
            border: '1px solid var(--v2-line)',
            borderRadius: 'var(--v2-r-lg)',
            padding: 22,
            marginBottom: 16,
          }}
        >
          <div style={{ position: 'relative' }}>
            <span
              aria-hidden="true"
              style={{
                position: 'absolute',
                left: 18,
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
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Search ${allCampaigns.filter((c) => c.status !== 'Completed').length} open briefs by brand, category, platform…`}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              aria-label="Search briefs"
              style={{
                width: '100%',
                paddingLeft: 48,
                paddingRight: query ? 44 : 16,
                fontSize: 15,
                lineHeight: '1.4',
                height: 52,
                background: 'var(--v2-paper)',
                border: '1px solid var(--v2-line)',
                borderRadius: 'var(--v2-r-md)',
                fontFamily: 'inherit',
                color: 'var(--v2-ink)',
                boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                outline: 'none',
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--v2-accent)'; e.currentTarget.style.boxShadow = '0 0 0 3px var(--v2-accent-soft)'; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--v2-line)'; e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.04)'; }}
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                aria-label="Clear search"
                style={{
                  position: 'absolute',
                  right: 12,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  background: 'var(--v2-bg-1)',
                  border: '1px solid var(--v2-line)',
                  cursor: 'pointer',
                  color: 'var(--v2-ink-2)',
                  fontSize: 16,
                  lineHeight: 1,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: 'inherit',
                  padding: 0,
                }}
              >×</button>
            )}
          </div>
        </div>

        {/* Filter strip — compact, single visual block, no eyebrows.
            Status pills get tonal weight (accent for Live, paper for
            inactive). Budget and Category drop into native-feeling
            chip-dropdowns (compact buttons with caret) instead of
            wall-of-chips. Sort sits at the right end so the visual
            line reads "narrow ← then → reorder". */}
        <div
          className="v2-card"
          style={{
            padding: 12,
            marginBottom: activeChips.length > 0 ? 12 : 16,
            display: 'flex',
            gap: 8,
            alignItems: 'center',
            flexWrap: 'wrap',
          }}
        >
          <Segment
            options={[
              { id: 'all',     label: 'All',         count: allCampaigns.filter((c) => c.status !== 'Completed').length },
              { id: 'Live',    label: 'Live',        count: allCampaigns.filter((c) => c.status === 'Live').length,    dot: 'var(--v2-accent)' },
              { id: 'Planned', label: 'Coming soon', count: allCampaigns.filter((c) => c.status === 'Planned').length, dot: 'var(--v2-ink-3)' },
            ]}
            value={status}
            onChange={(v) => setStatus(v as Status)}
          />

          <span style={{ width: 1, height: 22, background: 'var(--v2-line)', margin: '0 4px' }} aria-hidden="true" />

          <ChipDropdown
            label="Budget"
            value={budget === 'any' ? null : BUDGET_BANDS.find((b) => b.id === budget)?.label ?? null}
            options={BUDGET_BANDS.map((b) => ({ id: b.id, label: b.label }))}
            onChange={(id) => setBudget(id as BudgetBand)}
          />

          {categoryOptions.length > 0 && (
            <ChipDropdown
              label="Category"
              value={category === 'any' ? null : category}
              options={[{ id: 'any', label: 'All categories' }, ...categoryOptions.map((c) => ({ id: c, label: c }))]}
              onChange={(id) => setCategory(id)}
            />
          )}

          <ToggleChip
            label="Fit for me"
            active={fitOnly}
            onChange={() => setFitOnly((v) => !v)}
          />

          <span className="v2-spacer" />

          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            aria-label="Sort campaigns"
            style={{
              border: '1px solid var(--v2-line)',
              background: 'var(--v2-paper)',
              color: 'var(--v2-ink)',
              padding: '7px 32px 7px 12px',
              borderRadius: 'var(--v2-r-pill)',
              fontSize: 13,
              fontFamily: 'inherit',
              cursor: 'pointer',
              appearance: 'none',
              backgroundImage: 'linear-gradient(45deg, transparent 50%, var(--v2-ink-3) 50%), linear-gradient(135deg, var(--v2-ink-3) 50%, transparent 50%)',
              backgroundPosition: 'calc(100% - 14px) 50%, calc(100% - 9px) 50%',
              backgroundSize: '5px 5px, 5px 5px',
              backgroundRepeat: 'no-repeat',
            }}
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.id} value={o.id}>Sort · {o.label}</option>
            ))}
          </select>
        </div>

        {/* Active filter chips — only when something is narrowed.
            Each chip shows what's applied + a one-click remove. Gives
            users a clear "what am I looking at" header without making
            them scan the filter bar. */}
        {activeChips.length > 0 && (
          <div
            className="v2-row"
            style={{
              gap: 6,
              flexWrap: 'wrap',
              marginBottom: 16,
              alignItems: 'center',
            }}
          >
            <span className="v2-muted" style={{ fontSize: 12, marginRight: 4 }}>
              Filtered by:
            </span>
            {activeChips.map((chip) => (
              <button
                key={chip.key}
                type="button"
                onClick={chip.clear}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '4px 6px 4px 10px',
                  background: 'var(--v2-accent-soft)',
                  color: 'var(--v2-accent)',
                  border: '1px solid transparent',
                  borderRadius: 'var(--v2-r-pill)',
                  fontSize: 12,
                  fontWeight: 550,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
                aria-label={`Remove filter ${chip.label}`}
              >
                <span>{chip.label}</span>
                <span
                  aria-hidden="true"
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: '50%',
                    background: 'rgba(0,0,0,0.06)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 13,
                    lineHeight: 1,
                  }}
                >×</span>
              </button>
            ))}
            <button
              type="button"
              onClick={clearAll}
              style={{
                marginLeft: 4,
                padding: '4px 8px',
                background: 'transparent',
                border: 'none',
                color: 'var(--v2-ink-2)',
                fontSize: 12,
                fontWeight: 550,
                cursor: 'pointer',
                textDecoration: 'underline',
                fontFamily: 'inherit',
              }}
            >
              Clear all
            </button>
          </div>
        )}

        {/* Result count row */}
        <div className="v2-row" style={{ justifyContent: 'space-between', marginBottom: 12, alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <div className="v2-muted" style={{ fontSize: 13 }}>
            <strong style={{ color: 'var(--v2-ink)', fontWeight: 600 }}>
              {briefs.length}
            </strong>
            {' '}
            {briefs.length === 1 ? 'campaign' : 'campaigns'}
            {' · '}
            sorted by {SORT_OPTIONS.find((o) => o.id === sort)?.label.toLowerCase()}
          </div>
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

// Segmented status control — three exclusive options rendered as a
// single connected pill cluster (Apple-style segmented control). Counts
// are baked in for at-a-glance scale. The active option uses the paper
// surface with an accent underline so it doesn't dominate visually the
// way a solid-ink fill did before.
function Segment<T extends string>({ options, value, onChange }: {
  options: { id: T; label: string; count?: number; dot?: string }[];
  value: T;
  onChange: (id: T) => void;
}) {
  return (
    <div
      role="tablist"
      style={{
        display: 'inline-flex',
        background: 'var(--v2-bg-1)',
        border: '1px solid var(--v2-line)',
        borderRadius: 'var(--v2-r-pill)',
        padding: 3,
        gap: 2,
      }}
    >
      {options.map((opt) => {
        const active = opt.id === value;
        return (
          <button
            key={opt.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.id)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '5px 11px',
              background: active ? 'var(--v2-paper)' : 'transparent',
              color: active ? 'var(--v2-ink)' : 'var(--v2-ink-2)',
              border: 'none',
              borderRadius: 'var(--v2-r-pill)',
              fontSize: 13,
              fontWeight: active ? 600 : 500,
              cursor: 'pointer',
              fontFamily: 'inherit',
              transition: 'background 120ms ease, color 120ms ease',
              boxShadow: active ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
            }}
          >
            {opt.dot && (
              <span
                aria-hidden="true"
                style={{ width: 6, height: 6, borderRadius: '50%', background: opt.dot }}
              />
            )}
            {opt.label}
            {typeof opt.count === 'number' && (
              <span
                className="v2-tabular"
                style={{
                  fontSize: 11,
                  color: active ? 'var(--v2-ink-3)' : 'var(--v2-ink-3)',
                  fontWeight: 500,
                }}
              >
                {opt.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// Compact filter chip that doubles as a dropdown trigger. Closed state
// shows "Budget" when nothing's selected, "Under $5K" when something
// is. Opens a small floating menu of options. Replaces the wall-of-
// chips treatment for any filter dimension with more than ~4 options.
function ChipDropdown({ label, value, options, onChange }: {
  label: string;
  value: string | null;
  options: { id: string; label: string }[];
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  // Click-outside dismiss
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);
  const active = value !== null;
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 10px 6px 12px',
          background: active ? 'var(--v2-accent-soft)' : 'var(--v2-paper)',
          color: active ? 'var(--v2-accent)' : 'var(--v2-ink-2)',
          border: `1px solid ${active ? 'var(--v2-accent)' : 'var(--v2-line)'}`,
          borderRadius: 'var(--v2-r-pill)',
          fontSize: 13,
          fontWeight: active ? 600 : 500,
          cursor: 'pointer',
          fontFamily: 'inherit',
          transition: 'all 120ms ease',
        }}
      >
        <span>{active ? value : label}</span>
        <span
          aria-hidden="true"
          style={{
            display: 'inline-block',
            width: 0,
            height: 0,
            borderLeft: '4px solid transparent',
            borderRight: '4px solid transparent',
            borderTop: `4px solid ${active ? 'var(--v2-accent)' : 'var(--v2-ink-3)'}`,
            transform: open ? 'rotate(180deg)' : 'none',
            transition: 'transform 120ms ease',
          }}
        />
      </button>
      {open && (
        <div
          role="listbox"
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            zIndex: 30,
            minWidth: 200,
            background: 'var(--v2-paper)',
            border: '1px solid var(--v2-line)',
            borderRadius: 'var(--v2-r-md)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.10)',
            padding: 4,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {options.map((opt) => {
            const selected = opt.id === (value ?? 'any');
            return (
              <button
                key={opt.id}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => { onChange(opt.id); setOpen(false); }}
                style={{
                  textAlign: 'left',
                  padding: '8px 10px',
                  background: selected ? 'var(--v2-accent-soft)' : 'transparent',
                  color: selected ? 'var(--v2-accent)' : 'var(--v2-ink)',
                  border: 'none',
                  borderRadius: 6,
                  fontSize: 13,
                  fontWeight: selected ? 600 : 500,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                }}
                onMouseEnter={(e) => { if (!selected) e.currentTarget.style.background = 'var(--v2-bg-1)'; }}
                onMouseLeave={(e) => { if (!selected) e.currentTarget.style.background = 'transparent'; }}
              >
                <span>{opt.label}</span>
                {selected && (
                  <span aria-hidden="true" style={{ display: 'flex' }}>{Icon.check}</span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Single-action toggle chip — for binary filters like "Fit for me".
// Soft-accent fill when on; outline when off. Smaller checkbox-as-pill
// pattern than the old inline label.
function ToggleChip({ label, active, onChange }: {
  label: string;
  active: boolean;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onChange}
      aria-pressed={active}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '6px 12px',
        background: active ? 'var(--v2-accent-soft)' : 'var(--v2-paper)',
        color: active ? 'var(--v2-accent)' : 'var(--v2-ink-2)',
        border: `1px solid ${active ? 'var(--v2-accent)' : 'var(--v2-line)'}`,
        borderRadius: 'var(--v2-r-pill)',
        fontSize: 13,
        fontWeight: active ? 600 : 500,
        cursor: 'pointer',
        fontFamily: 'inherit',
        transition: 'all 120ms ease',
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 14,
          height: 14,
          borderRadius: 4,
          border: `1.5px solid ${active ? 'var(--v2-accent)' : 'var(--v2-ink-3)'}`,
          background: active ? 'var(--v2-accent)' : 'transparent',
          color: 'var(--v2-paper)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 10,
          lineHeight: 1,
        }}
      >
        {active ? '✓' : ''}
      </span>
      <span>{label}</span>
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
