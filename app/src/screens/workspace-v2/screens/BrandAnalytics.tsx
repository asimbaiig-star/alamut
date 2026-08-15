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
import { collabsForCampaign, isActiveCollab } from '../v2Adapters';
import { useStore } from '@/lib/api/store';
import type { V2Collab, V2Creator } from '../data';
import { readPerformance, aggregatePerformance } from '../performance';
import { pushToast } from '@/lib/utils/toast';
import { downloadCSV } from '@/lib/utils/csv';
import {
  KpiTile, BigPerfChart, BreakdownBar,
  TopPerformersTable, ContentTypeTile, SampleDataBanner,
} from './CampaignDetail';

interface Props {
  onRoute: (r: string) => void;
}

type Range = 'campaign' | '7d' | '30d';
// 'er' dropped: that chart mode was `6 + v * 0.2` over the engagement
// series — the same curve restretched, unrelated to the real ER figure.
type Metric = 'impressions' | 'engagement';

export function BrandAnalytics({ onRoute }: Props) {
  void onRoute;
  const brand = useV2CurrentBrand();
  const campaigns = useV2Campaigns();
  const creators = useV2Creators();
  const db = useStore((s) => s.db);

  const [range, setRange] = useState<Range>('campaign');
  const [metric, setMetric] = useState<Metric>('engagement');

  // Pull every collab across the brand's campaigns into a flat list so
  // the leaderboard + content mix can see them without re-walking the
  // store. Aggregated below into the campaign-shaped perf object the
  // design's components consume.
  const { aggregatedPerf, allCollabs, totalSpent, totalBudget, reportingCount } = useMemo(() => {
    const allCollabsAcc: V2Collab[] = [];
    let _spent = 0;
    let _budget = 0;
    for (const camp of campaigns) {
      _spent += camp.spent;
      _budget += camp.budget;
      // Active only. Portfolio aggregates shouldn't count creators who are out
      // of the running — cancelled rows were filtered out upstream before, so
      // this accumulator never used to see them.
      allCollabsAcc.push(...collabsForCampaign(camp.id, db).filter(isActiveCollab));
    }
    // Summing + rate recomputation now live in `aggregatePerformance`, so the
    // portfolio view and a single campaign can't disagree about how a total
    // is built. This was ~60 lines of hand-rolled accumulation over numbers
    // `derivePerf` had invented per campaign.
    const agg = aggregatePerformance(campaigns.map((c) => ({ id: c.id, spent: c.spent })), db);
    // Campaigns that HAVE reported performance — not the same as campaigns
    // that are live. The crumb used to say "active campaigns", disagreeing
    // with the live count in this same file and with My campaigns' "13 live".
    const _reportingCount = campaigns
      .filter((c) => readPerformance(c.id, c.spent, db) !== null).length;
    return {
      aggregatedPerf: agg,
      allCollabs: allCollabsAcc,
      totalSpent: _spent,
      totalBudget: _budget,
      reportingCount: _reportingCount,
    };
  }, [campaigns, db]);

  // These two useMemo calls MUST run before the early return below.
  // They used to sit after it, so the hook count differed between the
  // "no data" render and the "has data" render — and the store is
  // reactive, so a brand whose first campaign started reporting while
  // they were on this page hit React's "rendered more hooks than during
  // the previous render" and the screen crashed.
  // Pre-fix the range chip group (All campaigns / 7d / 30d) was a dead
  // control — `setRange` flipped state, the data ignored it. Wired now:
  // we clip the aggregated weeklySeries to the window the user picked
  // and recompute wk/wk delta + chart payload off the clipped series.
  // Each `weeklySeries` entry represents one week of impressions, so
  // "7d" reads the most recent entry, "30d" reads the most recent 4,
  // "campaign" reads everything.
  const windowedSeries = useMemo(() => {
    const s = aggregatedPerf?.weeklySeries ?? [];
    if (range === '7d') return s.slice(-1);
    if (range === '30d') return s.slice(-4);
    return s;
  }, [aggregatedPerf, range]);

  // wk/wk impressions delta — uses the last two entries of the windowed
  // series. Pre-fix this was a hardcoded "+18% wk/wk" string that didn't
  // move regardless of state. Falls back to '' (no chip) when we don't
  // have at least 2 comparable weeks.
  const impressionsWkDelta = useMemo(() => {
    const s = windowedSeries.length >= 2 ? windowedSeries : (aggregatedPerf?.weeklySeries ?? []);
    if (s.length < 2) return null;
    const cur = s[s.length - 1];
    const prev = s[s.length - 2];
    if (prev === 0) return null;
    const pct = Math.round(((cur - prev) / prev) * 100);
    return { pct, positive: pct >= 0 };
  }, [windowedSeries, aggregatedPerf]);


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
              No performance reported yet
            </div>
            <div className="v2-muted" style={{ fontSize: 13.5, lineHeight: 1.6, marginBottom: 18 }}>
              {/* Matched to the per-campaign empty state. Content going live
                  isn't the trigger — reach and engagement come from platform
                  accounts, which nothing connects to yet — and "ROI" named
                  the EMV/ROAS tiles that were removed for being invented. */}
              Reach and engagement come from creators’ connected platform
              accounts. Spend and roster progress are on each campaign in the
              meantime — those are measured.
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
  // EMV / ROAS removed — see the note on the CPM tile below.

  return (
    <>
      <Topbar
        title="Analytics"
        crumb={`${brand?.name ?? 'Brand'} · ${reportingCount} ${reportingCount === 1 ? 'campaign' : 'campaigns'} reporting · ${fmtUSD(totalSpent)} spent of ${fmtUSD(totalBudget)}`}
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
              onClick={() => {
                const rows = campaigns.map((c) => ({
                  campaign: c.name,
                  status: c.status,
                  budget: c.budget,
                  spent: c.spent,
                  escrow: c.escrowHeld,
                  category: c.category,
                  deadline: c.deadline ?? '',
                  creators: c.creators.length,
                }));
                if (rows.length === 0) {
                  pushToast('No campaigns to export yet');
                  return;
                }
                downloadCSV(
                  `${brand?.name?.toLowerCase().replace(/\s+/g, '-') ?? 'brand'}-analytics-${new Date().toISOString().slice(0, 10)}`,
                  rows,
                );
                pushToast(`Analytics exported · ${rows.length} campaigns`);
              }}
            >
              {Icon.external} Export CSV
            </button>
            <button
              className="v2-btn v2-btn-sm v2-btn-outline"
              type="button"
              onClick={async () => {
                // Copy a shareable summary string to the clipboard. Real
                // share-link generation would require a server endpoint;
                // for now we ship a self-contained text summary the brand
                // can paste into Slack / email.
                const live = campaigns.filter((c) => c.status === 'Live').length;
                const completed = campaigns.filter((c) => c.status === 'Completed').length;
                const totalBudget = campaigns.reduce((s, c) => s + c.budget, 0);
                const totalSpent = campaigns.reduce((s, c) => s + c.spent, 0);
                const summary = [
                  `${brand?.name ?? 'Brand'} · Analytics snapshot`,
                  `${live} live · ${completed} completed`,
                  `Budget: ${fmtUSD(totalBudget)} · Spent: ${fmtUSD(totalSpent)}`,
                  `As of ${new Date().toLocaleDateString()}`,
                ].join('\n');
                try {
                  await navigator.clipboard.writeText(summary);
                  pushToast('Analytics summary copied to clipboard');
                } catch {
                  pushToast('Could not access clipboard — try Export CSV instead');
                }
              }}
            >
              Share report
            </button>
          </div>
        </div>

        {aggregatedPerf.sample && <SampleDataBanner />}

        {/* KPI tiles. */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 12,
            marginBottom: 20,
          }}
        >
          <KpiTile
            label="Impressions"
            value={fmtFollowers(aggregatedPerf.impressions)}
            delta={
              impressionsWkDelta
                ? `${impressionsWkDelta.positive ? '+' : ''}${impressionsWkDelta.pct}% wk/wk`
                : 'wk/wk —'
            }
            deltaPositive={impressionsWkDelta?.positive ?? true}
            spark={windowedSeries}
          />
          <KpiTile
            label="Engagement rate"
            value={`${aggregatedPerf.er}%`}
            // Pre-fix this delta read `+${aggregatedPerf.er - 4.2}pt vs
            // 4.2% category` — the "4.2% category" was synthetic. We
            // drop the made-up benchmark and just show the live ER tile
            // without a delta chip until we have a real comparison
            // dataset to compute against.
            delta=""
            deltaPositive
            accent
          />
          {/* CPM is spend ÷ impressions — real money over a reported count.
              The EMV and ROAS tiles that sat here are gone: both were built
              on a `benchCPM = 50` constant invented in this file, over
              impressions that were themselves invented. Also note this tile
              used to divide CPM by 1000 and suffix "k", rendering "$0.0k"
              for every realistic value. */}
          <KpiTile
            label="CPM"
            value={aggregatedPerf.cpm !== null ? `$${aggregatedPerf.cpm.toLocaleString()}` : '—'}
            delta={aggregatedPerf.cpm !== null ? 'spend ÷ impressions' : 'needs spend + impressions'}
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
            <BigPerfChart points={windowedSeries} metric={metric} perf={aggregatedPerf} />
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
            byCreator={aggregatedPerf.byCreator}
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
            <AudienceBreakdown collabs={allCollabs} creators={creators} />
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
              />
              <ContentTypeTile
                icon="◯"
                label="Stories"
                count={countDeliverables(allCollabs, /stor/i)}
              />
              <ContentTypeTile
                icon="▦"
                label="Posts"
                count={countDeliverables(allCollabs, /post/i)}
              />
            </div>
                      {/* A "Best-performing format" callout used to sit here: static
                JSX reading "Reels with daily-life framing — 2.8x higher save
                rate than studio-styled posts. Spark recommends shifting next
                campaign's mix toward Reels." Identical on every campaign and
                every brand, attributed by name to the AI feature as though it
                were a generated, data-backed recommendation. Nothing measures
                save rate by format. Removed rather than reworded. */}

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

/** Audience breakdown computed from the actual accepted creators on
 *  this brand's collabs. Aggregates city distribution (weighted by
 *  reach) and age + gender from each creator's `audience` field. */
function AudienceBreakdown({ collabs, creators }: { collabs: V2Collab[]; creators: V2Creator[] }) {
  const involvedCreatorIds = new Set(collabs.map((c) => c.creatorId));
  const involved = creators.filter((c) => involvedCreatorIds.has(c.id));

  // Weight by total reach so a 2M-follower creator counts more than a 50K one.
  type Bucket = { weight: number; label: string };
  const cityWeights = new Map<string, number>();
  // Two denominators on purpose. `totalReach` covers every involved
  // creator and drives the city split; `audienceReach` covers only the
  // ones whose channels report demographics and drives age + gender.
  // Sharing one denominator would either scale the city bars past 100%
  // or fold unknowns into the age mix.
  let totalReach = 0;
  let audienceReach = 0;
  let weightedFemale = 0;
  let weightedAge2534 = 0;
  let weightedAge1824 = 0;
  let weightedAge3544 = 0;
  let weightedAge45plus = 0;

  for (const cr of involved) {
    const reach = cr.channels.reduce((s, ch) => s + ch.followers, 0);
    if (reach <= 0) continue;
    // Creators whose channels report no demographics are excluded from the
    // age/gender mix — `?? 0` counted them as 0% female and, because the
    // 45+ bar is a residual, as 100% over-45. One unprofiled creator with
    // real reach could therefore hand a brand an audience that was mostly
    // male and mostly 45+ purely because nothing was known about them.
    // They still count toward city weighting, which comes from `cr.city`
    // and doesn't depend on the audience block.
    const city = cr.city || 'Other';
    totalReach += reach;
    cityWeights.set(city, (cityWeights.get(city) ?? 0) + reach);
    if (!cr.audience) continue;
    audienceReach += reach;
    weightedFemale += cr.audience.female * reach;
    const a25 = cr.audience.age2534;
    const a18 = cr.audience.age1824 ?? 0;
    const a35 = cr.audience.age3544 ?? 0;
    weightedAge2534 += a25 * reach;
    weightedAge1824 += a18 * reach;
    weightedAge3544 += a35 * reach;
    // Anything left over → 45+ bucket.
    weightedAge45plus += Math.max(0, 100 - a25 - a18 - a35) * reach;
  }

  if (totalReach === 0) {
    return (
      <p className="v2-muted" style={{ fontSize: 13, margin: 0 }}>
        No accepted collabs yet — audience reach will populate once creators are confirmed on a campaign.
      </p>
    );
  }

  const cityBuckets: Bucket[] = Array.from(cityWeights.entries())
    .map(([label, weight]) => ({ label, weight }))
    .sort((a, b) => b.weight - a.weight);
  const topCities = cityBuckets.slice(0, 4);
  const otherWeight = cityBuckets.slice(4).reduce((s, b) => s + b.weight, 0);
  if (otherWeight > 0) topCities.push({ label: 'Other', weight: otherWeight });

  const pct = (w: number) => Math.round((w / totalReach) * 100);
  const cityColors = ['var(--v2-ink)', 'var(--v2-ink-2)', 'var(--v2-ink-3)', 'var(--v2-ink-4)', 'var(--v2-line-2)'];

  const hasAudience = audienceReach > 0;
  const femalePct = hasAudience ? Math.round(weightedFemale / audienceReach) : 0;
  const age2534Pct = hasAudience ? Math.round(weightedAge2534 / audienceReach) : 0;
  const age1824Pct = hasAudience ? Math.round(weightedAge1824 / audienceReach) : 0;
  const age3544Pct = hasAudience ? Math.round(weightedAge3544 / audienceReach) : 0;
  const age45Pct = Math.max(0, 100 - age2534Pct - age1824Pct - age3544Pct);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
      <div>
        <div className="v2-eyebrow" style={{ marginBottom: 8 }}>By city</div>
        {topCities.map((b, i) => (
          <BreakdownBar key={b.label} label={b.label} value={pct(b.weight)} total={100} color={cityColors[i] ?? 'var(--v2-line-2)'} pct />
        ))}
      </div>
      <div>
        <div className="v2-eyebrow" style={{ marginBottom: 8 }}>By age</div>
        {!hasAudience ? (
          <p className="v2-muted" style={{ fontSize: 12.5, margin: 0, lineHeight: 1.5 }}>
            None of these creators' channels report audience demographics yet,
            so there's no age or gender split to show.
          </p>
        ) : (
          <>
        <BreakdownBar label="18–24" value={age1824Pct} total={100} color="var(--v2-accent)" pct />
        <BreakdownBar label="25–34" value={age2534Pct} total={100} color="var(--v2-accent)" pct />
        <BreakdownBar label="35–44" value={age3544Pct} total={100} color="var(--v2-accent)" pct />
        <BreakdownBar label="45+"   value={age45Pct}   total={100} color="var(--v2-accent)" pct />
        <hr style={{ border: 0, borderTop: '1px solid var(--v2-line)', margin: '12px 0' }} />
        <div className="v2-row" style={{ justifyContent: 'space-between', fontSize: 12, marginTop: 6 }}>
          <span className="v2-muted">Female</span>
          <span className="v2-tabular" style={{ fontWeight: 600 }}>{femalePct}%</span>
        </div>
        <div className="v2-row" style={{ justifyContent: 'space-between', fontSize: 12, marginTop: 4 }}>
          <span className="v2-muted">Male</span>
          <span className="v2-tabular" style={{ fontWeight: 600 }}>{100 - femalePct}%</span>
        </div>
          </>
        )}
      </div>
    </div>
  );
}
