// Filter bar for the brand campaign pipeline (Phase 3).
//
// Two layers:
//   1. Always-visible top row: stage chips (multi-select), preset buttons,
//      filter-count badge.
//   2. "More filters" disclosure: region multi, pricing model, attention
//      and overdue toggles, clear-all.
//
// Presets are one-tap shortcuts that wipe other filters and apply a curated
// view: "Active", "Needs me now", "Overdue", "Stuck stages". They mirror
// what a brand actually asks first thing in the morning.

import { useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { STAGES } from '@/lib/api/types';
import {
  type CampaignFilters as Filters,
  emptyFilters,
  activeFilterCount,
} from '@/lib/utils/campaign-metrics';
import type { CampaignStage } from '@/lib/api/types';

interface Props {
  value: Filters;
  onChange: (next: Filters) => void;
  /** All campaign regions present in the dataset, for the region multi-select. */
  regions: string[];
  /** Per-stage counts, used inside the stage chips. */
  stageCounts: Record<CampaignStage, number>;
  /** Optional total — shown as the "All" chip count. */
  total: number;
}

type PresetKey = 'all' | 'active' | 'attention' | 'overdue' | 'stuck';

export function CampaignFilters({ value, onChange, regions, stageCounts, total }: Props) {
  const [moreOpen, setMoreOpen] = useState(false);
  const count = activeFilterCount(value);

  const set = (patch: Partial<Filters>) => onChange({ ...value, ...patch });

  // P1b §1.2: per-collab progress (shortlist / offer / production / posted /
  // reporting) is no longer expressible as a Campaign.stage filter — those
  // values were collapsed into 'live'. Filter by collab-level state lands
  // in P1c when Collaboration becomes a queryable entity. Until then,
  // 'active' just means stage:'live' and the 'stuck' preset relies on the
  // attention flag alone.
  const applyPreset = (preset: PresetKey) => {
    const fresh = emptyFilters();
    fresh.search = value.search;
    if (preset === 'active') {
      fresh.stages = new Set<CampaignStage>(['live']);
    } else if (preset === 'attention') {
      fresh.attention = true;
    } else if (preset === 'overdue') {
      fresh.overdueOnly = true;
    } else if (preset === 'stuck') {
      fresh.stages = new Set<CampaignStage>(['live']);
      fresh.attention = true;
    }
    onChange(fresh);
  };

  const isPresetOn = (preset: PresetKey): boolean => {
    if (preset === 'all') return count === 0;
    if (preset === 'active') {
      return value.stages.size === 1 && value.stages.has('live')
        && !value.attention && !value.overdueOnly && value.regions.size === 0 && value.pricing === 'any';
    }
    if (preset === 'attention') return value.attention && value.stages.size === 0 && !value.overdueOnly;
    if (preset === 'overdue') return value.overdueOnly && value.stages.size === 0 && !value.attention;
    if (preset === 'stuck') {
      return value.attention && value.stages.size === 1 && value.stages.has('live');
    }
    return false;
  };

  const toggleStage = (id: CampaignStage) => {
    const next = new Set(value.stages);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    set({ stages: next });
  };

  const toggleRegion = (r: string) => {
    const next = new Set(value.regions);
    if (next.has(r)) next.delete(r);
    else next.add(r);
    set({ regions: next });
  };

  return (
    <div className="cmp-filters">
      {/* Preset row — one-tap shortcuts */}
      <div className="cmp-filters-presets">
        <button
          className={['filter-preset', isPresetOn('all') ? 'is-on' : ''].join(' ')}
          onClick={() => applyPreset('all')}
        >All <span className="filter-preset-count">{total}</span></button>
        <button
          className={['filter-preset', isPresetOn('active') ? 'is-on' : ''].join(' ')}
          onClick={() => applyPreset('active')}
        >Active</button>
        <button
          className={['filter-preset', isPresetOn('attention') ? 'is-on' : ''].join(' ')}
          onClick={() => applyPreset('attention')}
        >Needs me now</button>
        <button
          className={['filter-preset', isPresetOn('overdue') ? 'is-on' : ''].join(' ')}
          onClick={() => applyPreset('overdue')}
        >Overdue</button>
        <button
          className={['filter-preset', isPresetOn('stuck') ? 'is-on' : ''].join(' ')}
          onClick={() => applyPreset('stuck')}
        >Stuck stages</button>

        <div className="cmp-filters-presets-spacer" />

        <button
          className={['filter-preset', moreOpen ? 'is-on' : ''].join(' ')}
          onClick={() => setMoreOpen((v) => !v)}
          aria-expanded={moreOpen}
          aria-controls="cmp-filters-more"
        >
          <Icon.layers s={12} /> Filters
          {count > 0 && <span className="filter-preset-badge">{count}</span>}
        </button>
      </div>

      {/* Stage chip row — multi-select */}
      <div className="cmp-filters-chips" role="group" aria-label="Filter by stage">
        {STAGES.map((s) => (
          <button
            key={s.id}
            className={[
              'filter-chip',
              `stage-${s.id}`,
              value.stages.has(s.id) ? 'is-on' : '',
            ].join(' ')}
            onClick={() => toggleStage(s.id)}
            aria-pressed={value.stages.has(s.id)}
          >
            <span className="filter-chip-dot" aria-hidden="true" />
            {s.label}
            <span className="filter-chip-count">{stageCounts[s.id] || 0}</span>
          </button>
        ))}
      </div>

      {/* "More filters" disclosure */}
      {moreOpen && (
        <div id="cmp-filters-more" className="cmp-filters-more tile">
          <div className="cmp-filters-section">
            <div className="mono-meta mb-8">Region</div>
            <div className="cmp-filters-chips">
              {regions.map((r) => (
                <button
                  key={r}
                  className={['filter-chip', value.regions.has(r) ? 'is-on' : ''].join(' ')}
                  onClick={() => toggleRegion(r)}
                >{r}</button>
              ))}
              {regions.length === 0 && <span className="text-ink-60" style={{ fontSize: 13 }}>No regions in dataset.</span>}
            </div>
          </div>

          <div className="cmp-filters-section">
            <div className="mono-meta mb-8">Pricing model</div>
            <div className="cmp-filters-chips">
              {(['any', 'fixed', 'outcome', 'retainer'] as const).map((p) => (
                <button
                  key={p}
                  className={['filter-chip', value.pricing === p ? 'is-on' : ''].join(' ')}
                  onClick={() => set({ pricing: p })}
                >
                  {p === 'any' ? 'Any' : p === 'fixed' ? 'Fixed' : p === 'outcome' ? '⚡ Outcome' : '↻ Retainer'}
                </button>
              ))}
            </div>
          </div>

          <div className="cmp-filters-section">
            <div className="mono-meta mb-8">Status</div>
            <div className="cmp-filters-toggles">
              <label className="cmp-filters-toggle">
                <input
                  type="checkbox"
                  checked={value.attention}
                  onChange={(e) => set({ attention: e.target.checked })}
                />
                <span>Needs my attention (counter offers, in-review submissions, disputes, stale stages)</span>
              </label>
              <label className="cmp-filters-toggle">
                <input
                  type="checkbox"
                  checked={value.overdueOnly}
                  onChange={(e) => set({ overdueOnly: e.target.checked })}
                />
                <span>Past deadline only</span>
              </label>
            </div>
          </div>

          <div className="cmp-filters-foot">
            <button
              className="filter-preset"
              onClick={() => onChange({ ...emptyFilters(), search: value.search })}
              disabled={count === 0}
            >Clear all filters</button>
            <span className="text-ink-60" style={{ fontSize: 12 }}>
              {count === 0 ? 'No filters active.' : `${count} active filter${count === 1 ? '' : 's'}.`}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
