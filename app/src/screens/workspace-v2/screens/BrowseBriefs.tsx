// BrowseBriefs.tsx — v2 creator-side brief marketplace
//
// The creator counterpart to brand Discover: live campaigns the
// creator can apply to. Top-of-page search + filter chips
// (category, budget band, fit-for-me) + sort dropdown over a card
// grid. Sidebar surfaces this as "Browse campaigns".

import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon, Topbar } from '../lib';
import { type V2Campaign } from '../data';
import { useV2AllCampaigns, useV2CurrentCreator, v2ToggleSavedBrief } from '../v2Hooks';
import { useStore } from '@/lib/api/store';
import type { Creator } from '@/lib/api/types';

interface Props {
  onRoute: (r: string) => void;
  /** Optional preset filter applied on mount. When the route arrives
   *  as `creator-campaigns?filter=saved` (from CreatorHome's "Saved
   *  for later" tile), the saved-only filter starts active so the
   *  creator lands directly inside their bookmark list. */
  initialFilter?: 'saved';
}

type Status = 'all' | 'Live' | 'Planned';
type BudgetBand = 'under5' | 'mid' | 'over15';
type SortKey = 'newest' | 'budget' | 'deadline' | 'fit';

const BUDGET_BANDS: { id: BudgetBand; label: string; test: (b: number) => boolean }[] = [
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

export function BrowseBriefs({ onRoute, initialFilter }: Props) {
  const me = useV2CurrentCreator();
  const allCampaigns = useV2AllCampaigns();
  const db = useStore((s) => s.db);
  // Resolve the raw Creator row so we can read savedBriefs[].
  // useV2CurrentCreator returns the V2Creator projection.
  const meRaw = me ? db.creators.find((c) => c.id === me.id) : undefined;

  const [query, setQuery] = useState('');
  // P1b §1.2: 'Active' was dropped (it conflated per-collab progress with
  // campaign-level state). 'Live' is the only "currently accepting" filter.
  const [status, setStatus] = useState<Status>('all');
  const [fitOnly, setFitOnly] = useState(false);
  // Saved-only filter — toggled via the chip in the filter strip, or
  // pre-set by the `?filter=saved` deep-link from CreatorHome.
  const [savedOnly, setSavedOnly] = useState(initialFilter === 'saved');
  // Multi-select filters — empty array means "no filter applied" (so
  // the user picks ANY combination they want). Replaces the prior
  // single-select state where 'any' was the no-filter sentinel.
  const [categories, setCategories] = useState<string[]>([]);
  const [budgets, setBudgets] = useState<BudgetBand[]>([]);
  const [sort, setSort] = useState<SortKey>('newest');

  // Helpers — toggle a value in/out of the multi-select array.
  const toggleCategory = (id: string) => {
    if (id === 'any') { setCategories([]); return; }
    setCategories((curr) => curr.includes(id) ? curr.filter((c) => c !== id) : [...curr, id]);
  };
  const toggleBudget = (id: BudgetBand) => {
    setBudgets((curr) => curr.includes(id) ? curr.filter((b) => b !== id) : [...curr, id]);
  };

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
    if (savedOnly) {
      const saved = new Set(meRaw?.savedBriefs ?? []);
      r = r.filter((c) => saved.has(c.id));
    }
    if (categories.length > 0) {
      const catSet = new Set(categories.map((c) => c.toLowerCase()));
      r = r.filter((c) => catSet.has((c.category ?? '').toLowerCase()));
    }
    if (budgets.length > 0) {
      const activeBands = BUDGET_BANDS.filter((b) => budgets.includes(b.id));
      r = r.filter((c) => activeBands.some((band) => band.test(c.budget)));
    }
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
  }, [allCampaigns, status, fitOnly, savedOnly, meRaw, categories, budgets, query, sort, me]);

  const liveCount = allCampaigns.filter((c) => c.status === 'Live').length;

  // Count active non-default filters — used for the "Clear all" affordance.
  const activeFilterCount =
    (status !== 'all' ? 1 : 0) +
    (fitOnly ? 1 : 0) +
    (savedOnly ? 1 : 0) +
    categories.length +
    budgets.length +
    (query.trim() ? 1 : 0);

  const savedCount = meRaw?.savedBriefs?.length ?? 0;

  const clearAll = () => {
    setQuery('');
    setStatus('all');
    setFitOnly(false);
    setSavedOnly(false);
    setCategories([]);
    setBudgets([]);
  };

  // Active filter chips — one chip per selected value for the multi-
  // select dimensions, so the user can drop a single budget/category
  // without nuking the whole filter.
  const activeChips: { key: string; label: string; clear: () => void }[] = [];
  if (query.trim())     activeChips.push({ key: 'q',   label: `“${query.trim()}”`,                                clear: () => setQuery('') });
  if (status !== 'all') activeChips.push({ key: 's',   label: status === 'Live' ? 'Live only' : 'Coming soon',     clear: () => setStatus('all') });
  if (fitOnly)          activeChips.push({ key: 'fit', label: 'Fit for me',                                        clear: () => setFitOnly(false) });
  if (savedOnly)        activeChips.push({ key: 'sv',  label: 'Saved only',                                        clear: () => setSavedOnly(false) });
  for (const b of budgets) {
    const band = BUDGET_BANDS.find((x) => x.id === b);
    if (band) activeChips.push({
      key: `b:${b}`, label: band.label, clear: () => toggleBudget(b),
    });
  }
  for (const c of categories) {
    activeChips.push({ key: `c:${c}`, label: c, clear: () => toggleCategory(c) });
  }

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
            // .v2-card globally has `overflow: hidden` (for border-radius
            // clipping on content cards). That clips the Budget/Category
            // dropdown panels — they only show the first option then get
            // cut off. Override here since this card only holds filter
            // chips; nothing inside needs clipping.
            overflow: 'visible',
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

          <MultiChipDropdown
            label="Budget"
            values={budgets}
            options={BUDGET_BANDS.map((b) => ({ id: b.id, label: b.label }))}
            onToggle={(id) => toggleBudget(id as BudgetBand)}
            onClear={() => setBudgets([])}
            summary={
              budgets.length === 0 ? 'Any'
              : budgets.length === 1 ? BUDGET_BANDS.find((b) => b.id === budgets[0])?.label ?? ''
              : `${budgets.length} bands`
            }
          />

          {categoryOptions.length > 0 && (
            <MultiChipDropdown
              label="Category"
              values={categories}
              options={categoryOptions.map((c) => ({ id: c, label: c }))}
              onToggle={toggleCategory}
              onClear={() => setCategories([])}
              summary={
                categories.length === 0 ? 'All'
                : categories.length === 1 ? categories[0]
                : `${categories.length} selected`
              }
            />
          )}

          <ToggleChip
            label="Fit for me"
            active={fitOnly}
            onChange={() => setFitOnly((v) => !v)}
          />

          {/* Saved-only toggle. Disabled when the creator hasn't saved
              anything yet (the chip stays inactive + tooltip explains).
              Active state matches Fit-for-me visually for consistency. */}
          <ToggleChip
            label={savedCount > 0 ? `Saved · ${savedCount}` : 'Saved'}
            active={savedOnly}
            onChange={() => setSavedOnly((v) => !v)}
            disabled={savedCount === 0}
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
              <CampaignTile
                key={c.id}
                campaign={c}
                onOpen={() => onRoute(`brief:${c.id}`)}
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

// Multi-select dropdown chip — same shape as the brand-side Discover
// MultiChipDropdown. Each option is a checkbox row; click toggles it
// in/out of `values` without closing the panel. Closed-state shows
// "<label> · <summary>" where summary is "Any" when empty, the single
// option's label when one is picked, or "N selected" for many.
function MultiChipDropdown({ label, values, options, onToggle, onClear, summary }: {
  label: string;
  values: string[];
  options: { id: string; label: string }[];
  onToggle: (id: string) => void;
  onClear: () => void;
  summary: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);
  const active = values.length > 0;
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
        <span>{label}</span>
        <span style={{ fontWeight: 500, opacity: 0.85 }}>·</span>
        <span style={{ fontWeight: active ? 700 : 500 }}>{summary}</span>
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
            marginLeft: 2,
          }}
        />
      </button>
      {open && (
        <div
          role="listbox"
          aria-multiselectable="true"
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            zIndex: 30,
            minWidth: 220,
            maxHeight: 340,
            overflowY: 'auto',
            background: 'var(--v2-paper)',
            border: '1px solid var(--v2-line)',
            borderRadius: 'var(--v2-r-md)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.10)',
            padding: 4,
          }}
        >
          {options.map((opt) => {
            const selected = values.includes(opt.id);
            return (
              <button
                key={opt.id}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => onToggle(opt.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  textAlign: 'left',
                  width: '100%',
                  padding: '8px 10px',
                  background: selected ? 'var(--v2-accent-soft)' : 'transparent',
                  color: selected ? 'var(--v2-accent)' : 'var(--v2-ink)',
                  border: 'none',
                  borderRadius: 6,
                  fontSize: 13,
                  fontWeight: selected ? 600 : 500,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
                onMouseEnter={(e) => { if (!selected) e.currentTarget.style.background = 'var(--v2-bg-1)'; }}
                onMouseLeave={(e) => { if (!selected) e.currentTarget.style.background = 'transparent'; }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: 4,
                    border: `1.5px solid ${selected ? 'var(--v2-accent)' : 'var(--v2-line-2)'}`,
                    background: selected ? 'var(--v2-accent)' : 'transparent',
                    color: 'var(--v2-paper)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 11,
                    lineHeight: 1,
                    flexShrink: 0,
                  }}
                >
                  {selected ? '✓' : ''}
                </span>
                <span>{opt.label}</span>
              </button>
            );
          })}
          {active && (
            <>
              <hr style={{ border: 'none', borderTop: '1px solid var(--v2-line)', margin: '4px 0' }} />
              <button
                type="button"
                onClick={onClear}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: '7px 10px',
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--v2-ink-2)',
                  fontSize: 12.5,
                  fontWeight: 500,
                  cursor: 'pointer',
                  borderRadius: 6,
                  fontFamily: 'inherit',
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--v2-bg-1)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                Clear {values.length}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// Single-action toggle chip — for binary filters like "Fit for me".
// Soft-accent fill when on; outline when off. Smaller checkbox-as-pill
// pattern than the old inline label.
function ToggleChip({ label, active, onChange, disabled }: {
  label: string;
  active: boolean;
  onChange: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onChange}
      disabled={disabled}
      aria-pressed={active}
      title={disabled ? 'Save a brief from any tile to enable this filter' : undefined}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '6px 12px',
        background: active ? 'var(--v2-accent-soft)' : 'var(--v2-paper)',
        color: active ? 'var(--v2-accent)' : disabled ? 'var(--v2-ink-3)' : 'var(--v2-ink-2)',
        border: `1px solid ${active ? 'var(--v2-accent)' : 'var(--v2-line)'}`,
        borderRadius: 'var(--v2-r-pill)',
        fontSize: 13,
        fontWeight: active ? 600 : 500,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.55 : 1,
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

// =====================================================================
// CampaignTile — editorial brief card per Claude Design handoff
// =====================================================================
//
// Replaces the older minimal BriefCard. Layout:
//   1. Brand letterhead band  — deterministic brand colour + diagonal
//      texture + brand mark + "Verified · pays in 3 days" meta on left,
//      category + posted-N-days-ago on right.
//   2. Title row              — display-serif title + 2-line brief blurb
//      on the left, compact match-score card on the right with three
//      fit reasons.
//   3. Three-pillar data band — Per-creator price (with subtle gold
//      wash to anchor the eye), Deliverables (icon + label per
//      placement), Deadline (Nd left, urgent in red after ≤5d).
//   4. Footer                  — seat-map dots showing filled/open
//      spots + applicant avatar stack + applied count, then save chip
//      and "View brief →" primary CTA.
//
// All data comes from V2Campaign + a small set of derived values:
//   - matchPct, postedDays, applied → deterministic synthesised numbers
//     keyed off campaign.id (idempotent across renders).
//   - applicantCount → real count from db.applications.
//   - applicantAvatars → first three creators on the campaign roster.
//   - fitReasons → keyed off the campaign's category.

// Brand colour palette — deterministic per-brand letterhead. Same six
// values as the design's brandAccent() helper; the hash picks one and
// stays consistent for that brand across the surface.
const BRAND_PALETTE: { bg: string; ink: string }[] = [
  { bg: '#2A3F6E', ink: '#FBF7EE' }, // navy
  { bg: '#5C2A1E', ink: '#FBF7EE' }, // cocoa
  { bg: '#1F3527', ink: '#FBF7EE' }, // moss
  { bg: '#7A2B22', ink: '#FBF7EE' }, // brick
  { bg: '#3E2F4A', ink: '#FBF7EE' }, // aubergine
  { bg: '#1C1A15', ink: '#FBF7EE' }, // ink
];
function brandAccent(name: string): { bg: string; ink: string } {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return BRAND_PALETTE[Math.abs(h) % BRAND_PALETTE.length];
}

// PKR amount formatter — lakh/crore notation per the design philosophy
// (Pakistan-first product). The data layer carries USD-shaped numbers,
// so we apply a notional USD→PKR factor at display time. 1 USD ≈ 280
// PKR puts seed budgets into the lakh range the design renders against
// ("Rs 4.6L" / "Rs 1.4L") without rewriting every USD-shaped value in
// the store.
const USD_TO_PKR = 280;
function fmtPKR(usd: number): string {
  const n = Math.round(usd * USD_TO_PKR);
  if (n >= 10_000_000) return `Rs ${(n / 10_000_000).toFixed(n % 10_000_000 === 0 ? 0 : 1)}Cr`;
  if (n >= 100_000)    return `Rs ${(n / 100_000).toFixed(n % 100_000 === 0 ? 0 : 1)}L`;
  if (n >= 1000)       return `Rs ${Math.round(n / 1000)}K`;
  return `Rs ${n.toLocaleString()}`;
}

// Pick a deliverable icon glyph from the placement string. Maps to the
// platforms our launch action's parser recognises (Reel / Story /
// Carousel / LinkedIn post / TikTok video / Newsletter / generic).
function deliverableGlyph(placement: string): string {
  const p = placement.toLowerCase();
  if (p.includes('reel'))      return '▶';
  if (p.includes('stor'))      return '○';
  if (p.includes('linkedin'))  return '▦';
  if (p.includes('post'))      return '▦';
  if (p.includes('carousel'))  return '▤';
  if (p.includes('tiktok') || p.includes('video')) return '▶';
  if (p.includes('newsletter') || p.includes('article')) return '✎';
  return '◆';
}

// Per-category fallback reasons — used when there's no signed-in
// creator or insufficient data for a personal match score. The real
// `computeMatch()` below produces creator-specific reasons whenever
// the viewer is a creator.
function fallbackReasonsFor(category: string | undefined): string[] {
  const c = (category ?? '').toLowerCase();
  if (c.includes('fashion'))   return ['Fashion audience', 'Lahore 18–34 women', 'Mid-tier rate'];
  if (c.includes('beauty'))    return ['Beauty audience', 'High craft signal', 'Mid-tier rate'];
  if (c.includes('lifestyle')) return ['Lifestyle voice', 'City match', 'Aligned rate'];
  if (c.includes('food'))      return ['Food vertical', 'High ER', 'Rate aligned'];
  if (c.includes('tech'))      return ['Tech voice', 'B2C audience', 'Premium tier'];
  if (c.includes('b2b') || c.includes('finance')) return ['LinkedIn voice', 'Karachi pros', 'Thought-leader tier'];
  if (c.includes('wellness'))  return ['Wellness vertical', 'Mature audience', 'Calm-aesthetic match'];
  return ['Niche fit', 'City match', 'Rate aligned'];
}

// Real creator-vs-campaign match. Ports BriefDetail's `facets` logic
// (audience/niche/ER/geo/history) and adds rate alignment. Returns the
// overall %, plus the top 3 *qualifying* reasons in priority order so
// the tile's "why this match" list is personalised to the viewer.
function computeMatch(
  creator: Creator | undefined,
  campaign: V2Campaign,
  perCreator: number,
): { overall: number; reasons: string[] } {
  if (!creator) {
    // No creator context — fall back to the synthesised score the
    // pre-personalised tile used (88 + id-hash modulo).
    return {
      overall: 88 + ((campaign.id.charCodeAt(0) || 0) % 10),
      reasons: fallbackReasonsFor(campaign.category),
    };
  }
  const myCats = creator.categories ?? [];
  // Audience: heuristic that scales with how rich the creator profile
  // signal is (proxy via number of categories).
  const audience = Math.min(98, 75 + myCats.length * 2);
  // Niche: 92 if any creator category matches the campaign category.
  const niche = campaign.category && myCats.some((c) => c.toLowerCase() === campaign.category!.toLowerCase())
    ? 92
    : 70;
  // Engagement: scaled off the creator's top channel ER (0–10% range).
  const erPct = creator.platforms?.[0]?.engagement ?? 0;
  const er = erPct > 0 ? Math.min(96, 60 + Math.round(erPct * 6)) : 75;
  // Geo: 90 if the campaign placement text mentions the creator's city.
  const geo = creator.city && (campaign.placement ?? '').toLowerCase().includes(creator.city.toLowerCase())
    ? 90
    : 78;
  // History: 95 if they've worked with this brand before.
  const history = (creator.pastClients ?? []).includes(campaign.brand) ? 95 : 60;
  // Rate alignment: 90 if the per-creator allocation matches the
  // creator's rate-card ballpark (within 25%); 60 otherwise. We pull a
  // representative number off rateCard.post when available.
  const ratePost = parseInt((creator.rateCard?.post ?? '').replace(/[^0-9]/g, ''), 10);
  const rateAligned = !Number.isNaN(ratePost) && ratePost > 0
    ? Math.abs(perCreator - ratePost) / ratePost <= 0.25
    : false;
  const rate = rateAligned ? 90 : 65;

  const overall = Math.round((audience + niche + er + geo + history + rate) / 6);

  // Pick the top three reasons that pass a "qualifies" threshold so we
  // only surface positive signals (not "you don't match"). Each reason
  // has a one-line label keyed off the campaign + creator.
  const candidates: { score: number; label: string }[] = [];
  if (niche >= 90)    candidates.push({ score: niche, label: `${campaign.category ?? 'Niche'} fit` });
  if (history >= 90)  candidates.push({ score: history, label: `Worked with ${campaign.brand}` });
  if (er >= 90)       candidates.push({ score: er, label: `${erPct.toFixed(1)}% ER` });
  if (geo >= 85)      candidates.push({ score: geo, label: `${creator.city} audience` });
  if (audience >= 92) candidates.push({ score: audience, label: 'Audience overlap' });
  if (rateAligned)    candidates.push({ score: rate, label: 'Rate aligned' });

  // Fill in with category fallbacks if fewer than three qualified.
  const reasons = candidates
    .sort((a, b) => b.score - a.score)
    .map((c) => c.label);
  while (reasons.length < 3) {
    const filler = fallbackReasonsFor(campaign.category)[reasons.length];
    if (!filler || reasons.includes(filler)) break;
    reasons.push(filler);
  }
  return { overall, reasons: reasons.slice(0, 3) };
}

function CampaignTile({ campaign, onOpen }: {
  campaign: V2Campaign;
  onOpen: () => void;
}) {
  const db = useStore((s) => s.db);
  const me = useV2CurrentCreator();
  // Resolve the underlying Creator object to feed into the match
  // helper. useV2CurrentCreator returns a V2Creator (projection); we
  // want the raw Creator so we can read platforms/categories/etc.
  const meRaw: Creator | undefined = me ? db.creators.find((c) => c.id === me.id) : undefined;
  const isSaved = !!meRaw?.savedBriefs?.includes(campaign.id);

  const accent = brandAccent(campaign.brand);
  // Per-creator price; min divisor 4 so a tiny roster doesn't inflate.
  const perCreator = Math.round(campaign.budget / Math.max(campaign.creators.length, 4));
  // Days until deadline.
  const daysLeft = Math.max(
    0,
    Math.ceil((+new Date(campaign.deadline) - Date.now()) / 86_400_000),
  );
  const urgent = daysLeft <= 5;

  // Real match — driven by creator profile signal against the campaign.
  // Falls back to the synthesised hash-based score for non-creator viewers.
  const { overall: matchPct, reasons: fitReasons } = useMemo(
    () => computeMatch(meRaw, campaign, perCreator),
    [meRaw, campaign, perCreator],
  );

  // Posted-days-ago — uses real createdAt if available, otherwise a
  // small synthesised number (1–5d).
  const postedDays = (() => {
    if (!campaign.createdAt) return ((campaign.id.charCodeAt(0) || 0) % 5) + 1;
    const d = Math.floor((Date.now() - +new Date(campaign.createdAt)) / 86_400_000);
    return Math.max(1, d);
  })();

  // Seat map — total spots from roster size + 2 buffer; filled = confirmed.
  const totalSpots = Math.max(campaign.creators.length + 2, campaign.confirmed + 1);
  const filledSpots = Math.min(campaign.confirmed, totalSpots);

  // Real applicant count from store + synthesised baseline so freshly-
  // seeded campaigns still show numbers.
  const realAppCount = db.applications.filter((a) => a.campaignId === campaign.id).length;
  const applied = realAppCount > 0
    ? realAppCount
    : Math.round(totalSpots * 1.8 + ((campaign.id.charCodeAt(1) || 0) % 5));

  // Avatars — pull from creators who have applied / been accepted on
  // this campaign. Fall back to the brand's roster.
  const applicantAvatars: string[] = (() => {
    const appCreatorIds = db.applications
      .filter((a) => a.campaignId === campaign.id)
      .map((a) => a.creatorId)
      .slice(0, 3);
    const ids = appCreatorIds.length > 0
      ? appCreatorIds
      : campaign.creators.slice(0, 3);
    return ids
      .map((id) => db.creators.find((c) => c.id === id)?.portrait)
      .filter((a): a is string => !!a);
  })();

  const seats = Array.from({ length: totalSpots }, (_, i) =>
    i < filledSpots ? 'is-filled' : 'is-open',
  );

  const placements = (campaign.placement ?? '').split(/\s*\+\s*/).filter(Boolean);

  // Deadline display: "22 May" (Pakistan-friendly DD MMM).
  const deadlineStr = new Date(campaign.deadline).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
  });

  return (
    <article
      className="v2-campaign-tile"
      onClick={onOpen}
      role="link"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(); } }}
    >
      {/* Brand letterhead band */}
      <div className="v2-ct-band" style={{ background: accent.bg, color: accent.ink }}>
        <span className="v2-ct-band-tex" aria-hidden="true" />
        <div className="v2-row" style={{ gap: 11, alignItems: 'center', minWidth: 0, position: 'relative' }}>
          {/* Brand mark — uploaded image when set, brand initial otherwise.
              The image override flips the chip's bg to paper-white (so a
              dark logo reads) and contains the image to preserve aspect. */}
          {campaign.brandLogoUrl ? (
            <div
              className="v2-ct-mark"
              style={{ background: 'var(--v2-paper)', color: accent.bg, padding: 2 }}
              aria-hidden="true"
            >
              <img
                src={campaign.brandLogoUrl}
                alt=""
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              />
            </div>
          ) : (
            <div className="v2-ct-mark" style={{ color: accent.bg, background: accent.ink }} aria-hidden="true">
              {campaign.brand[0]}
            </div>
          )}
          <div style={{ minWidth: 0 }}>
            <div className="v2-ct-brand">{campaign.brand}</div>
            <div className="v2-ct-brand-meta">
              {campaign.brandVerified
                ? 'Verified · pays in 3 days'
                : 'Unverified brand · use caution'}
            </div>
          </div>
        </div>
        <div className="v2-ct-band-right">
          <div className="v2-ct-band-cat">{campaign.category ?? 'Lifestyle'}</div>
          <div className="v2-ct-band-posted">Posted {postedDays}d ago</div>
        </div>
      </div>

      {/* Body */}
      <div className="v2-ct-body">
        {/* Title row with match-reason card */}
        <div className="v2-ct-titlerow">
          <div style={{ minWidth: 0, flex: 1 }}>
            <h3 className="v2-ct-title">{campaign.name}</h3>
            <p className="v2-ct-blurb">{campaign.brief}</p>
          </div>
          <div className="v2-ct-match-card">
            <div className="v2-ct-match-top">
              <span className="v2-ct-match-pct v2-tabular">
                {matchPct}
                <span className="v2-ct-match-pct-pct">%</span>
              </span>
              <span className="v2-ct-match-label">match</span>
            </div>
            <ul className="v2-ct-match-reasons">
              {fitReasons.map((r, i) => (
                <li key={i}><span className="v2-ct-check">✓</span>{r}</li>
              ))}
            </ul>
          </div>
        </div>

        {/* Three-pillar data band */}
        <div className="v2-ct-pillars">
          <div className="v2-ct-pillar v2-ct-pillar-money">
            <div className="v2-ct-pillar-label">Per creator</div>
            <div className="v2-ct-money-val">
              <span className="v2-ct-money-cur">Rs</span>
              <span className="v2-tabular">{fmtPKR(perCreator).replace(/^Rs\s*/, '')}</span>
            </div>
            <div
              className="v2-ct-pillar-sub"
              style={{ color: campaign.escrowHeld > 0 ? 'var(--v2-moss)' : 'var(--v2-ink-3)' }}
            >
              ● {campaign.escrowHeld > 0 ? 'Escrow funded' : 'Awaiting funding'}
            </div>
          </div>
          <div className="v2-ct-pillar">
            <div className="v2-ct-pillar-label">Deliverables</div>
            <div className="v2-ct-pillar-stack">
              {placements.length === 0 ? (
                <div className="v2-ct-pillar-row">
                  <span className="v2-ct-deliv-mark">◆</span>
                  <span>{campaign.placement || 'TBD'}</span>
                </div>
              ) : placements.map((p, i) => (
                <div key={i} className="v2-ct-pillar-row">
                  <span className="v2-ct-deliv-mark">{deliverableGlyph(p)}</span>
                  <span>{p}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="v2-ct-pillar">
            <div className="v2-ct-pillar-label">Deadline</div>
            <div className={`v2-ct-deadline-val v2-tabular ${urgent ? 'is-urgent' : ''}`}>
              {daysLeft}
              <span className="v2-ct-deadline-unit">d</span>
            </div>
            <div className="v2-ct-pillar-sub">until {deadlineStr}</div>
          </div>
        </div>

        {/* Footer */}
        <div className="v2-ct-foot">
          <div className="v2-ct-spots">
            <div className="v2-ct-seats">
              {seats.map((s, i) => (
                <span key={i} className={`v2-ct-seat ${s}`} aria-hidden="true" />
              ))}
              <span className="v2-ct-spots-text">
                <strong>{filledSpots}</strong> of {totalSpots} filled
              </span>
            </div>
            <div className="v2-ct-applicants">
              <div className="v2-ct-avstack" aria-hidden="true">
                {applicantAvatars.map((a, i) => (
                  <span key={i} className="v2-ct-av" style={{ backgroundImage: `url(${a})` }} />
                ))}
              </div>
              <span className="v2-ct-applicants-text">{applied} applied</span>
            </div>
          </div>
          <div className="v2-row" style={{ gap: 6 }}>
            <button
              type="button"
              className="v2-ct-save"
              title={isSaved ? 'Saved · click to remove' : 'Save brief for later'}
              aria-label={isSaved ? 'Remove saved brief' : 'Save brief'}
              aria-pressed={isSaved}
              onClick={(e) => {
                e.stopPropagation();
                v2ToggleSavedBrief(campaign.id);
              }}
              style={isSaved ? {
                color: 'var(--v2-accent)',
                borderColor: 'var(--v2-accent)',
                background: 'var(--v2-accent-soft)',
              } : undefined}
            >
              {/* Bookmark glyph — filled when saved, outlined when not */}
              <svg width="14" height="14" viewBox="0 0 24 24" fill={isSaved ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
              </svg>
            </button>
            <button
              type="button"
              className="v2-btn v2-btn-primary v2-btn-sm v2-ct-cta"
              onClick={(e) => { e.stopPropagation(); onOpen(); }}
            >
              View brief <span className="v2-ct-cta-arrow">→</span>
            </button>
          </div>
        </div>
      </div>

      {/* Bottom-right corner clip — editorial flourish */}
      <span className="v2-ct-corner" aria-hidden="true" />
    </article>
  );
}
