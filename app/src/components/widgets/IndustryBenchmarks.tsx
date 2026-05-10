// Industry rate benchmarks. Aggregates accepted-offer rates from the seed/db
// across creator tier × campaign category. The data moat: only Alamut sees this.
import { useMemo, useState } from 'react';
import { useStore } from '@/lib/api/store';
import { Icon } from '@/components/ui/Icon';
import type { CreatorTier } from '@/lib/api/types';

const TIERS: CreatorTier[] = ['Rising', 'Specialist', 'Flagship'];

interface BenchmarkRow {
  tier: CreatorTier;
  category: string;
  count: number;
  median: number;
  p25: number;
  p75: number;
}

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  const idx = (sorted.length - 1) * q;
  const low = Math.floor(idx);
  const high = Math.ceil(idx);
  if (low === high) return sorted[low];
  return sorted[low] + (sorted[high] - sorted[low]) * (idx - low);
}

export function IndustryBenchmarks() {
  const db = useStore((s) => s.db);
  const [open, setOpen] = useState(true);
  const [filterCategory, setFilterCategory] = useState<string>('all');

  const allCategories = useMemo(() => {
    const set = new Set<string>();
    db.campaigns.forEach((c) => set.add(c.category));
    return Array.from(set).sort();
  }, [db.campaigns]);

  const rows = useMemo<BenchmarkRow[]>(() => {
    // Build (tier, category) => rates[] using accepted offers.
    const buckets = new Map<string, number[]>();
    db.offers.forEach((o) => {
      if (o.status !== 'accepted') return;
      const cmp = db.campaigns.find((c) => c.id === o.campaignId);
      if (!cmp) return;
      const cr = db.creators.find((c) => c.id === o.creatorId);
      if (!cr) return;
      const key = `${cr.tier}|${cmp.category}`;
      const list = buckets.get(key) || [];
      list.push(o.rate);
      buckets.set(key, list);
    });

    const out: BenchmarkRow[] = [];
    buckets.forEach((rates, key) => {
      if (rates.length < 2) return; // need >=2 deals for a credible band
      const sorted = [...rates].sort((a, b) => a - b);
      const [tier, category] = key.split('|');
      out.push({
        tier: tier as CreatorTier,
        category,
        count: rates.length,
        median: Math.round(quantile(sorted, 0.5)),
        p25: Math.round(quantile(sorted, 0.25)),
        p75: Math.round(quantile(sorted, 0.75)),
      });
    });

    return out
      .filter((r) => filterCategory === 'all' || r.category === filterCategory)
      .sort((a, b) => {
        const ti = TIERS.indexOf(a.tier) - TIERS.indexOf(b.tier);
        if (ti !== 0) return ti;
        return a.category.localeCompare(b.category);
      });
  }, [db.offers, db.campaigns, db.creators, filterCategory]);

  const totalDeals = useMemo(() => db.offers.filter((o) => o.status === 'accepted').length, [db.offers]);

  return (
    <div style={{ marginBottom: 24, border: '1px solid var(--rule)', borderRadius: 6, background: 'var(--surface)' }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          width: '100%', padding: '12px 16px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
          background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="mono-meta">📊 Industry rate benchmarks</span>
          <span style={{ fontSize: 12, color: 'var(--ink-60)' }}>
            · Aggregated from {totalDeals.toLocaleString()} accepted offers across the platform
          </span>
        </div>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-60)' }}>
          {open ? '▼ Hide' : '▶ Show'}
        </span>
      </button>

      {open && (
        <div style={{ borderTop: '1px solid var(--rule)', padding: '14px 16px' }}>
          <div className="row-between mb-12">
            <div style={{ fontSize: 13, color: 'var(--ink-80)' }}>
              Median accepted rate per <strong>tier × category</strong>. P25–P75 shows the typical band.
              Use these to price your campaign — rates outside the band may signal under- or over-budget.
            </div>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              style={{ padding: '6px 10px', border: '1px solid var(--rule)', background: 'var(--paper)', fontFamily: 'var(--mono)', fontSize: 12 }}
            >
              <option value="all">All categories</option>
              {allCategories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {rows.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--ink-60)', padding: '12px 0' }}>
              Not enough deals yet to publish a credible benchmark. Need at least 2 accepted offers per tier × category.
            </div>
          ) : (
            <table className="tbl">
              <thead>
                <tr>
                  <th>Tier</th>
                  <th>Category</th>
                  <th style={{ textAlign: 'right' }}>Median</th>
                  <th style={{ textAlign: 'right' }}>P25 – P75</th>
                  <th style={{ textAlign: 'right' }}>Sample size</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={`${r.tier}-${r.category}`}>
                    <td><span className="mono-meta">{r.tier}</span></td>
                    <td>{r.category}</td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--mono)', fontWeight: 500 }}>
                      ${r.median.toLocaleString()}
                    </td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--mono)', color: 'var(--ink-60)' }}>
                      ${r.p25.toLocaleString()} – ${r.p75.toLocaleString()}
                    </td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--mono)', color: 'var(--ink-60)' }}>
                      n = {r.count}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 10, fontSize: 12, color: 'var(--ink-60)' }}>
            <Icon.spark s={12} />
            Anonymized · No individual deal is identifiable. Updated continuously.
          </div>
        </div>
      )}
    </div>
  );
}
