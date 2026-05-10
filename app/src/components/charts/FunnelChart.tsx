// Pipeline funnel chart for the brand Home dashboard (Phase 7).
//
// Renders one horizontal bar per campaign stage, sized proportionally to
// either the count of campaigns or the budget at that stage. Uses the
// Phase-1 chromatic stage palette so the funnel looks like the rest of the
// product. Each row has count + sum + clickable label that filters the
// campaigns list.

import { Link } from 'react-router-dom';
import { fmtMoney } from '@/lib/utils/format';
import { funnelMetrics } from '@/lib/utils/campaign-metrics';
import { useStore } from '@/lib/api/store';
import { STAGES } from '@/lib/api/types';
import type { Campaign, CampaignStage } from '@/lib/api/types';

interface Props {
  campaigns: Campaign[];
  /** Whether to size bars by 'count' (default) or 'budget'. */
  weight?: 'count' | 'budget';
  /** Stages to skip (e.g. exclude draft/closed for "active funnel" views). */
  hideStages?: CampaignStage[];
}

export function FunnelChart({ campaigns, weight = 'budget', hideStages = ['draft', 'closed'] }: Props) {
  const db = useStore((s) => s.db);

  const visibleStages = STAGES.filter((s) => !hideStages.includes(s.id));
  const byStage = Object.fromEntries(visibleStages.map((s) => [s.id, [] as Campaign[]])) as Record<CampaignStage, Campaign[]>;
  campaigns.forEach((c) => {
    if (byStage[c.stage]) byStage[c.stage].push(c);
  });

  // Determine the max we're scaling to — biggest stage's count or budget.
  let max = 1;
  visibleStages.forEach((s) => {
    const list = byStage[s.id];
    const v = weight === 'count' ? list.length : list.reduce((sum, c) => sum + c.budget, 0);
    if (v > max) max = v;
  });

  const total = campaigns.filter((c) => !hideStages.includes(c.stage));
  if (total.length === 0) {
    return (
      <div className="funnel-empty">
        <div className="mono-meta">No campaigns in this funnel</div>
        <div className="text-ink-60" style={{ fontSize: 13, marginTop: 4 }}>
          Active campaigns (Live → Reporting) will plot here once you start one.
        </div>
      </div>
    );
  }

  return (
    <div className="funnel-chart" role="figure" aria-label="Pipeline funnel by stage">
      {visibleStages.map((s) => {
        const list = byStage[s.id];
        const count = list.length;
        const sum = list.reduce((acc, c) => acc + c.budget, 0);
        const v = weight === 'count' ? count : sum;
        const pct = max > 0 ? (v / max) * 100 : 0;
        const f = funnelMetrics(list, db);
        return (
          <Link
            key={s.id}
            to={`/brand/campaigns?stages=${s.id}`}
            className={['funnel-row', `stage-${s.id}`, count === 0 ? 'is-empty' : ''].join(' ')}
            aria-label={`${s.label}: ${count} campaign${count === 1 ? '' : 's'}, ${fmtMoney(sum)}`}
          >
            <div className="funnel-row-label">
              <span className="funnel-row-dot" />
              <span className="funnel-row-name">{s.label}</span>
              <span className="funnel-row-count">{count}</span>
            </div>
            <div className="funnel-row-track">
              <div className="funnel-row-bar" style={{ width: `${pct}%` }}>
                {pct > 24 && (
                  <span className="funnel-row-bar-label">
                    {weight === 'budget' ? fmtMoney(sum) : `${count} campaign${count === 1 ? '' : 's'}`}
                  </span>
                )}
              </div>
            </div>
            <div className="funnel-row-meta">
              {pct <= 24 && weight === 'budget' && fmtMoney(sum)}
              {f.medianDaysInStage > 0 && (
                <span className="funnel-row-median" title="Median days in stage">
                  {f.medianDaysInStage}d
                </span>
              )}
            </div>
          </Link>
        );
      })}
    </div>
  );
}
