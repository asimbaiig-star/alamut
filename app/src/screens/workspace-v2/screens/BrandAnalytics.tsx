// BrandAnalytics.tsx · top-level brand-side analytics dashboard
//
// The Claude Design `AnalyticsTab` (campaign-v2.jsx) lives inside a
// single campaign view. For a brand-wide pulse — "how is everything
// performing right now?" — we render the same component vocabulary
// against an aggregated perf object that sums across every campaign
// the brand has in flight or recently closed.
//
// Same six-block layout as the per-campaign tab: time-range toolbar
// → 4 KPI tiles → big perf chart + engagement breakdown → top
// performers leaderboard → audience reached + content mix.

import { useMemo, useState } from 'react';
import { fmtFollowers, fmtUSD, Icon, Topbar } from '../lib';
import { useV2Campaigns, useV2Creators, useV2CurrentBrand } from '../v2Hooks';
import { collabsForCampaign } from '../v2Adapters';
import { useStore } from '@/lib/api/store';
import type { V2CampaignPerf, V2Collab } from '../data';
import { pushToast } from '@/lib/utils/toast';
import {
  derivePerf, KpiTile, BigPerfChart, BreakdownBar,
  TopPerformersTable, ContentTypeTile,
} from './CampaignDetail';

interface Props {
  onRoute: (r: string) => void;
}

type Range = 'campaign' | '7d' | '30d';
type Metric = 'impressions' | 'engagement' | 'er';

export function BrandAnalytics({ onRoute }: Props) {
  void onRoute;
  const brand = useV2CurrentBrand();
  const campaigns = useV2Campaigns();
  const creators = useV2Creators();
  const db = useStore((s) => s.db);

  const [range, setRange] = useState<Range>('campaign');
  const [metric, setMetric] = useState<Metric>('engagement');
  void range; // visual-only filter on the demo perf series

  // Pull every collab across the brand's campaigns into a flat list so
  // the leaderboard + content mix can see them without re-walking the
  // store. Aggregated below into the campaign-shaped perf object the
  // design's components consume.
  const { aggregatedPerf, allCollabs, totalSpent, totalBudget, liveCount } = useMemo(() => {
    const allCollabsAcc: V2Collab[] = [];
    let agg: V2CampaignPerf | null = null;
    let _liveCount = 0;
    let _spent = 0;
    let _budget = 0;
    for (const camp of campaigns) {
      _spent += camp.spent;
      _budget += camp.budget;
      const collabs = collabsForCampaign(camp.id, db);
      allCollabsAcc.push(...collabs);
      const perf = derivePerf(camp, collabs);
      if (!perf) continue;
      _liveCount += 1;
      if (!agg) {
        // Clone so we don't mutate the per-campaign object.
        agg = {
          impressions: perf.impressions,
          reach: perf.reach,
          engagement: perf.engagement,
          er: perf.er,
          cpm: perf.cpm,
          cpe: perf.cpe,
          saves: perf.saves,
          shares: perf.shares,
          profileVisits: perf.profileVisits,
          weeklySeries: perf.weeklySeries.slice(),
        };
      } else {
        agg.impressions    += perf.impressions;
        agg.reach          += perf.reach;
        agg.engagement     += perf.engagement;
        agg.saves          += perf.saves;
        agg.shares         += perf.shares;
        agg.profileVisits  += perf.profileVisits;
        // Stretch each weekly series to the longest-so-far length.
        const longer = perf.weeklySeries.length > agg.weeklySeries.length
          ? perf.weeklySeries : agg.weeklySeries;
        const shorter = perf.weeklySeries.length > agg.weeklySeries.length
          ? agg.weeklySeries : perf.weeklySeries;
        agg.weeklySeries = longer.map((v, i) => v + (shorter[i] ?? 0));
      }
    }
    if (agg) {
      // Recompute derived rates on the aggregate so they don't carry
      // the (averaged) value of any single campaign.
      agg.er  = agg.impressions > 0
        ? Number(((agg.engagement / agg.impressions) * 100).toFixed(1))
        : 0;
      agg.cpm = agg.impressions > 0
        ? Math.round((_spent / agg.impressions) * 1000) : 0;
      agg.cpe = agg.engagement > 0
        ? Math.round(_spent / agg.engagement) : 0;
    }
    return {
      aggregatedPerf: agg,
      allCollabs: allCollabsAcc,
      totalSpent: _spent,
      totalBudget: _budget,
      liveCount: _liveCount,
    };
  }, [campaigns, db]);

  // Empty state — no campaigns have any live placements yet, so there's
  // nothing to chart. Soft prompt to launch a campaign or look at the
  // creator-side analytics for benchmark-style numbers.
  if (!aggregatedPerf) {
    return (
      <>
        <Topbar
          title="Analytics"
          crumb={`${brand?.name ?? 'Brand'} · ${campaigns.length} campaigns total`}
        />
        <div className="v2-content">
          <div className="v2-card v2-card-pad-lg" style={{ textAlign: 'center', maxWidth: 540, margin: '40px auto' }}>
            <div style={{ fontSize: 28, marginBottom: 10, opacity: 0.4 }}>◐</div>
            <div style={{
              fontFamily: 'var(--v2-font-display)',
              fontSize: 20,
              fontWeight: 500,
              marginBottom: 6,
              letterSpacing: '-0.014em',
            }}>
              Analytics unlock once content goes live
            </div>
            <div className="v2-muted" style={{ fontSize: 13.5, lineHeight: 1.6, marginBottom: 18 }}>
              You'll see impressions, engagement, audience and ROI here as
              creators on your campaigns publish their content. Per-campaign
              numbers also surface on each campaign's Analytics tab.
            </div>
            <button
              type="button"
              className="v2-btn v2-btn-primary v2-btn-sm"
              onClick={() => onRoute('campaigns')}
            >
              View my campaigns {Icon.arrow}
            </button>
          </div>
        </div>
      </>
    );
  }

  // Earned media value benchmark — same calc as the per-campaign tab.
  const benchCPM = 50; // USD, paid social benchmark
  const emv = Math.round((aggregatedPerf.impressions / 1000) * benchCPM);
  const roas = totalSpent > 0 ? (emv / totalSpent).toFixed(2) : '—';
  const cpmDeltaPositive = aggregatedPerf.cpm < benchCPM;
  const cpmDeltaPct = Math.round(Math.abs(benchCPM - aggregatedPerf.cpm) / benchCPM * 100);

  return (
    <>
      <Topbar
        title="Analytics"
        crumb={`${brand?.name ?? 'Brand'} · ${liveCount} active ${liveCount === 1 ? 'campaign' : 'campaigns'} · ${fmtUSD(totalSpent)} spent of ${fmtUSD(totalBudget)}`}
      />
      <div className="v2-content">
        {/* Toolbar — time range + Export/Share actions. */}
        <div
          className="v2-row"
          style={{ justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}
        >
          <div className="v2-row" style={{ gap: 6 }}>
            {([
              { id: 'campaign', label: 'All campaigns' },
              { id: '7d',       label: 'Last 7d' },
              { id: '30d',      label: 'Last 30d' },
            ] as const).map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setRange(r.id)}
                className="v2-btn v2-btn-sm"
                style={{
                  background: range === r.id ? 'var(--v2-ink)' : 'transparent',
                  color: range === r.id ? 'var(--v2-paper)' : 'var(--v2-ink-2)',
                  border: `1px solid ${range === r.id ? 'var(--v2-ink)' : 'var(--v2-line)'}`,
                }}
              >
                {r.label}
              </button>
            ))}
          </div>
          <div className="v2-row" style={{ gap: 8 }}>
            <button
              className="v2-btn v2-btn-sm v2-btn-outline"
              type="button"
              onClick={() => pushToast('Brand-wide CSV export queued — full archive in 2 min', 'good')}
            >
              {Icon.external} Export CSV
            </button>
            <button
              className="v2-btn v2-btn-sm v2-btn-outline"
              type="button"
              onClick={() => pushToast('Shareable analytics report copied to clipboard', 'good')}
            >
              Share report
            </button>
          </div>
        </div>

        {/* KPI tiles — 4 across with sparklines + deltas. */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 12,
            marginBottom: 20,
          }}
        >
          <KpiTile
            label="Impressions"
            value={fmtFollowers(aggregatedPerf.impressions)}
            delta="+18% wk/wk"
            deltaPositive
            spark={aggregatedPerf.weeklySeries}
          />
          <KpiTile
            label="Engagement rate"
            value={`${aggregatedPerf.er}%`}
            delta={`+${(aggregatedPerf.er - 4.2).toFixed(1)}pt vs 4.2% category`}
            deltaPositive
            accent
          />
          <KpiTile
            label="CPM"
            value={`$${(aggregatedPerf.cpm / 1000).toFixed(1)}k`}
            delta={`${cpmDeltaPositive ? '−' : '+'}${cpmDeltaPct}% vs paid social`}
            deltaPositive={cpmDeltaPositive}
          />
          <KpiTile
            label="EMV"
            value={`$${(emv / 1_000).toFixed(1)}k`}
            delta={`${roas}× ROAS`}
            deltaPositive
          />
        </div>

        {/* Big perf chart + engagement breakdown row. */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1.6fr 1fr',
            gap: 16,
            marginBottom: 20,
          }}
        >
          <div className="v2-card v2-card-pad-lg">
            <div className="v2-row" style={{ justifyContent: 'space-between', marginBottom: 16 }}>
              <h3 style={{
                fontFamily: 'var(--v2-font-display)',
                fontSize: 19, fontWeight: 500, margin: 0, letterSpacing: '-0.02em',
              }}>
                Performance over time
              </h3>
              <div className="v2-row" style={{ gap: 4 }}>
                {([
                  { id: 'impressions', label: 'Impressions' },
                  { id: 'engagement',  label: 'Engagements' },
                  { id: 'er',          label: 'ER %' },
                ] as const).map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setMetric(m.id)}
                    style={{
                      padding: '5px 10px',
                      fontSize: 12,
                      fontWeight: 550,
                      background: metric === m.id ? 'var(--v2-bg-2)' : 'transparent',
                      border: `1px solid ${metric === m.id ? 'var(--v2-line-2)' : 'transparent'}`,
                      borderRadius: 6,
                      color: metric === m.id ? 'var(--v2-ink)' : 'var(--v2-ink-3)',
                      cursor: 'pointer',
                    }}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
            <BigPerfChart points={aggregatedPerf.weeklySeries} metric={metric} perf={aggregatedPerf} />
          </div>

          <div className="v2-card v2-card-pad-lg">
            <h3 style={{
              fontFamily: 'var(--v2-font-display)',
              fontSize: 19, fontWeight: 500, margin: '0 0 16px', letterSpacing: '-0.02em',
            }}>
              Engagement breakdown
            </h3>
            <BreakdownBar
              label="Likes"
              value={aggregatedPerf.engagement - aggregatedPerf.saves - aggregatedPerf.shares}
              total={aggregatedPerf.engagement}
              color="var(--v2-accent)"
            />
            <BreakdownBar
              label="Saves"
              value={aggregatedPerf.saves}
              total={aggregatedPerf.engagement}
              color="var(--v2-moss)"
            />
            <BreakdownBar
              label="Shares"
              value={aggregatedPerf.shares}
              total={aggregatedPerf.engagement}
              color="var(--v2-gold)"
            />
            <BreakdownBar
              label="Profile visits"
              value={aggregatedPerf.profileVisits}
              total={aggregatedPerf.engagement}
              color="var(--v2-info)"
            />
            <hr style={{ border: 0, borderTop: '1px solid var(--v2-line)', margin: '12px 0' }} />
            <div className="v2-row" style={{ justifyContent: 'space-between', fontSize: 12.5, marginTop: 8 }}>
              <span className="v2-muted">Save rate</span>
              <span className="v2-tabular" style={{ fontWeight: 600 }}>
                {(aggregatedPerf.saves / Math.max(1, aggregatedPerf.impressions) * 100).toFixed(2)}%
              </span>
            </div>
            <div className="v2-row" style={{ justifyContent: 'space-between', fontSize: 12.5, marginTop: 6 }}>
              <span className="v2-muted">Share rate</span>
              <span className="v2-tabular" style={{ fontWeight: 600 }}>
                {(aggregatedPerf.shares / Math.max(1, aggregatedPerf.impressions) * 100).toFixed(2)}%
              </span>
            </div>
          </div>
        </div>

        {/* Top performers leaderboard — across all campaigns. */}
        <div className="v2-card v2-card-pad-lg" style={{ marginBottom: 20 }}>
          <div className="v2-row" style={{ justifyContent: 'space-between', marginBottom: 16 }}>
            <h3 style={{
              fontFamily: 'var(--v2-font-display)',
              fontSize: 19, fontWeight: 500, margin: 0, letterSpacing: '-0.02em',
            }}>
              Top performers across campaigns
            </h3>
            <span className="v2-muted" style={{ fontSize: 12 }}>
              ranked by engagement contribution
            </span>
          </div>
          <TopPerformersTable
            collabs={allCollabs}
            creators={creators}
            totalEngagement={aggregatedPerf.engagement}
            totalImpressions={aggregatedPerf.impressions}
          />
        </div>

        {/* Audience reached + content mix. */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div className="v2-card v2-card-pad-lg">
            <h3 style={{
              fontFamily: 'var(--v2-font-display)',
              fontSize: 19, fontWeight: 500, margin: '0 0 16px', letterSpacing: '-0.02em',
            }}>
              Audience reached
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              <div>
                <div className="v2-eyebrow" style={{ marginBottom: 8 }}>By city</div>
                <BreakdownBar label="New York"      value={42} total={100} color="var(--v2-ink)"   pct />
                <BreakdownBar label="Los Angeles"   value={31} total={100} color="var(--v2-ink-2)" pct />
                <BreakdownBar label="London"        value={14} total={100} color="var(--v2-ink-3)" pct />
                <BreakdownBar label="Toronto"       value={7}  total={100} color="var(--v2-ink-4)" pct />
                <BreakdownBar label="Other"         value={6}  total={100} color="var(--v2-line-2)" pct />
              </div>
              <div>
                <div className="v2-eyebrow" style={{ marginBottom: 8 }}>By age</div>
                <BreakdownBar label="18–24" value={28} total={100} color="var(--v2-accent)" pct />
                <BreakdownBar label="25–34" value={46} total={100} color="var(--v2-accent)" pct />
                <BreakdownBar label="35–44" value={19} total={100} color="var(--v2-accent)" pct />
                <BreakdownBar label="45+"   value={7}  total={100} color="var(--v2-accent)" pct />
                <hr style={{ border: 0, borderTop: '1px solid var(--v2-line)', margin: '12px 0' }} />
                <div className="v2-row" style={{ justifyContent: 'space-between', fontSize: 12, marginTop: 6 }}>
                  <span className="v2-muted">Female</span>
                  <span className="v2-tabular" style={{ fontWeight: 600 }}>78%</span>
                </div>
              </div>
            </div>
          </div>

          <div className="v2-card v2-card-pad-lg">
            <h3 style={{
              fontFamily: 'var(--v2-font-display)',
              fontSize: 19, fontWeight: 500, margin: '0 0 16px', letterSpacing: '-0.02em',
            }}>
              Content mix
            </h3>
            <div className="v2-row" style={{ gap: 12, marginBottom: 16 }}>
              <ContentTypeTile
                icon="▶"
                label="Reels"
                count={countDeliverables(allCollabs, /reel/i)}
                avgEr="12.8%"
              />
              <ContentTypeTile
                icon="◯"
                label="Stories"
                count={countDeliverables(allCollabs, /stor/i)}
                avgEr="6.2%"
              />
              <ContentTypeTile
                icon="▦"
                label="Posts"
                count={countDeliverables(allCollabs, /post/i)}
                avgEr="9.1%"
              />
            </div>
            <div className="v2-eyebrow" style={{ marginBottom: 8 }}>Best-performing format</div>
            <div
              style={{
                padding: 12,
                background: 'var(--v2-bg)',
                borderRadius: 'var(--v2-r-md)',
                borderLeft: '3px solid var(--v2-moss)',
              }}
            >
              <div style={{ fontSize: 13.5, fontWeight: 600 }}>Reels with daily-life framing</div>
              <div className="v2-muted" style={{ fontSize: 12, marginTop: 2, lineHeight: 1.5 }}>
                2.8× higher save rate than studio-styled posts. Spark recommends shifting
                next campaign's mix toward Reels.
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function countDeliverables(collabs: V2Collab[], rx: RegExp): number {
  return collabs.reduce(
    (sum, c) => sum + c.deliverables.filter((d) => rx.test(d.label)).length,
    0,
  );
}
