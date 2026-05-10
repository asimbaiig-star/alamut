// Stage-grouped list view for the brand campaign pipeline (Phase 3).
//
// Industry references: Pipedrive's pipeline overview, Linear's project list,
// HubSpot's deal list. The kanban is good for *seeing* across the lifecycle
// in parallel; this list is good for *reading* the pipeline like a balance
// sheet — funnel-header KPIs at the top of each stage, dense rows below
// each row, scannable status flags on the right.
//
// Each stage group is its own collapsible tile with a funnel header showing
// count · total budget · weighted budget · median time-in-stage. Stale and
// overdue counts surface as inline accents.
//
// Rows show: cover thumbnail, title, region/category, applicants, accepted,
// budget, days-in-stage, deadline, status flags. Click navigates to the
// full-page campaign detail.

import { useState } from 'react';
import { useStore } from '@/lib/api/store';
import { Pill } from '@/components/ui/Pill';
import { Icon } from '@/components/ui/Icon';
import { fmtMoney, fmtMoneyFull } from '@/lib/utils/format';
import {
  REF_DATE, funnelMetrics, rowMetrics, needsAttention,
} from '@/lib/utils/campaign-metrics';
import { STAGES } from '@/lib/api/types';
import type { Campaign, CampaignStage } from '@/lib/api/types';

interface Props {
  campaigns: Campaign[];
  onOpen: (id: string) => void;
  /** Optional bulk-select mode. When provided, each row gets a checkbox. */
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
}

const stageLabel = Object.fromEntries(STAGES.map((s) => [s.id, s.label]));

export function CampaignListGrouped({ campaigns, onOpen, selectedIds, onToggleSelect }: Props) {
  const db = useStore((s) => s.db);
  const selectable = !!onToggleSelect;

  // Group by stage
  const byStage: Record<string, Campaign[]> = Object.fromEntries(STAGES.map((s) => [s.id, []]));
  campaigns.forEach((c) => byStage[c.stage].push(c));

  // Sort within each stage: stalest first (helps the brand triage).
  for (const id of Object.keys(byStage)) {
    byStage[id].sort((a, b) => {
      const aDays = rowMetrics(a, db).daysInStage;
      const bDays = rowMetrics(b, db).daysInStage;
      return bDays - aDays;
    });
  }

  // Collapse state — by stage. Default open if non-empty.
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const toggle = (id: string) => {
    setCollapsed((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  // Hide stages with zero rows entirely (so an active-only filter is clean).
  const visibleStages = STAGES.filter((s) => byStage[s.id].length > 0);

  if (visibleStages.length === 0) {
    return null;
  }

  return (
    <div className="cmp-list">
      {visibleStages.map((s) => {
        const list = byStage[s.id];
        const metrics = funnelMetrics(list, db);
        const isCollapsed = collapsed.has(s.id);
        return (
          <section
            key={s.id}
            className={['cmp-list-group', `stage-${s.id}`, isCollapsed ? 'is-collapsed' : ''].join(' ')}
          >
            <button
              className="cmp-list-funnel-h"
              onClick={() => toggle(s.id)}
              aria-expanded={!isCollapsed}
            >
              <span className="cmp-list-funnel-toggle" aria-hidden="true">{isCollapsed ? '▸' : '▾'}</span>

              <div className="cmp-list-funnel-name-row">
                <span className="cmp-list-funnel-dot" />
                <span className="cmp-list-funnel-name">{s.label}</span>
                <span className="cmp-list-funnel-count">{metrics.count}</span>
              </div>

              <FunnelStat k="Total budget" v={fmtMoneyFull(metrics.totalBudget)} />
              <FunnelStat k="Committed"     v={fmtMoneyFull(metrics.weightedBudget)} hint="spent + escrow" />
              <FunnelStat k="Median in stage" v={`${metrics.medianDaysInStage}d`} />

              <div className="cmp-list-funnel-flags">
                {metrics.attentionCount > 0 && (
                  <Pill tone="warn" pulse>
                    {metrics.attentionCount} need{metrics.attentionCount === 1 ? 's' : ''} you
                  </Pill>
                )}
                {metrics.overdueCount > 0 && (
                  <Pill tone="bad">{metrics.overdueCount} overdue</Pill>
                )}
                {metrics.staleCount > 0 && metrics.attentionCount === 0 && (
                  <Pill tone="warn">{metrics.staleCount} stale</Pill>
                )}
              </div>
            </button>

            {!isCollapsed && (
              <div className="cmp-list-rows">
                <div className="cmp-list-row cmp-list-row-h" aria-hidden="true">
                  <div /> {/* cover */}
                  <div>Title</div>
                  <div>Applicants</div>
                  <div>Accepted</div>
                  <div>Days in stage</div>
                  <div>Deadline</div>
                  <div style={{ textAlign: 'right' }}>Budget</div>
                  <div>{/* flags */}</div>
                </div>
                {list.map((c) => (
                  <CampaignRow
                    key={c.id}
                    c={c}
                    onOpen={onOpen}
                    selectable={selectable}
                    isSelected={selectedIds?.has(c.id) ?? false}
                    onToggleSelect={onToggleSelect}
                  />
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

function FunnelStat({ k, v, hint }: { k: string; v: string; hint?: string }) {
  return (
    <div className="cmp-list-funnel-stat" title={hint}>
      <div className="cmp-list-funnel-stat-k">{k}</div>
      <div className="cmp-list-funnel-stat-v">{v}</div>
    </div>
  );
}

function CampaignRow({
  c, onOpen, selectable = false, isSelected = false, onToggleSelect,
}: {
  c: Campaign;
  onOpen: (id: string) => void;
  selectable?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (id: string) => void;
}) {
  const db = useStore((s) => s.db);
  const m = rowMetrics(c, db);
  const attention = needsAttention(m.flags);

  // Deadline copy + tone
  let deadlineCopy = c.deadline;
  let deadlineTone: 'normal' | 'soon' | 'overdue' = 'normal';
  if (m.parsedDeadline) {
    const today = new Date(REF_DATE.getFullYear(), REF_DATE.getMonth(), REF_DATE.getDate());
    const daysLeft = Math.round((m.parsedDeadline.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
    if (daysLeft < 0) { deadlineTone = 'overdue'; deadlineCopy = `${Math.abs(daysLeft)}d overdue`; }
    else if (daysLeft === 0) { deadlineTone = 'soon'; deadlineCopy = 'Today'; }
    else if (daysLeft === 1) { deadlineTone = 'soon'; deadlineCopy = 'Tomorrow'; }
    else if (daysLeft <= 3)  { deadlineTone = 'soon'; deadlineCopy = `In ${daysLeft}d`; }
    else if (daysLeft < 30)  { deadlineCopy = `In ${daysLeft}d`; }
    // else: keep raw deadline string, e.g. "Jun 12"
  }

  // Days-in-stage tone
  let dayClass = '';
  if (m.flags.stale)   dayClass = 'is-stale';
  else if (m.daysInStage >= 5) dayClass = 'is-warm';

  return (
    <div
      className={['cmp-list-row', `stage-${c.stage}`, attention ? 'is-attention' : '', selectable ? 'is-selectable' : '', isSelected ? 'is-selected' : ''].join(' ')}
      onClick={() => onOpen(c.id)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(c.id); } }}
    >
      <div className="cmp-list-row-cover">
        {selectable && (
          <label
            className="cmp-list-row-checkbox"
            onClick={(e) => e.stopPropagation()}
            aria-label={`Select ${c.title}`}
          >
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => onToggleSelect?.(c.id)}
            />
          </label>
        )}
        <img src={c.cover} alt="" loading="lazy" />
      </div>

      <div className="cmp-list-row-id">
        <div className="cmp-list-row-title">
          {c.title}
          {c.kind === 'retainer' && <span className="cmp-list-row-kind">↻ Retainer</span>}
          {c.pricingModel === 'outcome' && <span className="cmp-list-row-kind">⚡ Outcome</span>}
          {c.editorsPick && <span className="cmp-list-row-kind">★ Featured</span>}
        </div>
        <div className="cmp-list-row-meta">
          <span>{c.category}</span>
          <span>·</span>
          <span>{c.region}</span>
        </div>
      </div>

      <div className="cmp-list-row-num">
        <span className="num-v">{m.applicationCount}</span>
        {m.flags.pendingApplicationCount > 0 && (
          <span className="num-flag" title="Pending decisions">
            {m.flags.pendingApplicationCount} new
          </span>
        )}
      </div>

      <div className="cmp-list-row-num">
        <span className="num-v">{m.acceptedCount}</span>
      </div>

      <div className={['cmp-list-row-days', dayClass].join(' ')}>
        <span className="num-v">{m.daysInStage}d</span>
        {m.flags.stale && <span className="num-flag">stale</span>}
      </div>

      <div className={['cmp-list-row-deadline', `is-${deadlineTone}`].join(' ')}>
        {deadlineCopy}
      </div>

      <div className="cmp-list-row-budget">
        <span className="num-v">{fmtMoney(c.budget)}</span>
        {c.spent > 0 && <span className="num-flag">{fmtMoney(c.spent)} spent</span>}
      </div>

      <div className="cmp-list-row-flags">
        {m.flags.hasOpenDispute && <Pill tone="bad">⚠ Dispute</Pill>}
        {m.flags.inReviewCount > 0 && (
          <Pill tone="warn" pulse>{m.flags.inReviewCount} to review</Pill>
        )}
        {m.flags.counterOfferCount > 0 && (
          <Pill tone="warn">{m.flags.counterOfferCount} counter</Pill>
        )}
        <span className="cmp-list-row-arrow"><Icon.arrow s={14} /></span>
      </div>
    </div>
  );
}

// Allow consumers to render only the funnel summary (used by Today triage if added later)
export function CampaignFunnelSummary({ campaigns, stage }: { campaigns: Campaign[]; stage?: CampaignStage }) {
  const db = useStore((s) => s.db);
  const list = stage ? campaigns.filter((c) => c.stage === stage) : campaigns;
  const m = funnelMetrics(list, db);
  return (
    <div className="cmp-funnel-summary">
      <FunnelStat k="Campaigns" v={String(m.count)} />
      <FunnelStat k="Total" v={fmtMoneyFull(m.totalBudget)} />
      <FunnelStat k="Committed" v={fmtMoneyFull(m.weightedBudget)} />
      <FunnelStat k="Median in stage" v={`${m.medianDaysInStage}d`} />
      {m.attentionCount > 0 && <Pill tone="warn">{m.attentionCount} attention</Pill>}
      {/* stageLabel imported but only used when stage prop is set */}
      {stage && <span className="mono-meta">{stageLabel[stage]}</span>}
    </div>
  );
}
