// Gantt-style timeline of campaign briefs over the next ~quarter (Phase 3).
//
// One row per campaign. Each bar runs from the campaign's createdAt
// (clamped to the visible window) to its parsed deadline. Bar color is
// the stage hue. A "today" line glows down the chart so the brand can
// see at a glance what's ahead vs behind.
//
// This is deliberately read-only — clicking a bar opens the campaign
// detail page. Drag-to-reschedule is out of scope for the demo.

import { useMemo, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { Pill } from '@/components/ui/Pill';
import { fmtMoney } from '@/lib/utils/format';
import { REF_DATE, parseDeadline } from '@/lib/utils/campaign-metrics';
import { STAGES } from '@/lib/api/types';
import type { Campaign } from '@/lib/api/types';

interface Props {
  campaigns: Campaign[];
  onOpen: (id: string) => void;
}

const stageLabel = Object.fromEntries(STAGES.map((s) => [s.id, s.label]));

const DAY_MS = 24 * 60 * 60 * 1000;

// How many days the visible window spans, by zoom level
const ZOOMS = {
  'month':   { days: 30,  label: 'Month',   tickEvery: 7 },
  'quarter': { days: 90,  label: 'Quarter', tickEvery: 14 },
  'half':    { days: 180, label: 'Half',    tickEvery: 30 },
} as const;
type ZoomKey = keyof typeof ZOOMS;

interface Bar {
  campaign: Campaign;
  startPct: number;     // 0..100
  endPct: number;       // 0..100
  durationDays: number;
}

export function CampaignTimeline({ campaigns, onOpen }: Props) {
  const [zoom, setZoom] = useState<ZoomKey>('quarter');
  const [anchor, setAnchor] = useState<Date>(() => {
    // Anchor = today minus 7 days, so "today" line sits ~25% in (gives lookback context)
    const a = new Date(REF_DATE);
    a.setDate(a.getDate() - 7);
    return a;
  });
  const days = ZOOMS[zoom].days;
  const windowEnd = new Date(anchor.getTime() + days * DAY_MS);

  const bars: Bar[] = useMemo(() => {
    return campaigns
      .map((c) => {
        const start = new Date(c.createdAt);
        const end = parseDeadline(c.deadline, REF_DATE) || new Date(start.getTime() + 14 * DAY_MS);
        // Clamp to visible window
        const clampedStart = start < anchor ? anchor : start;
        const clampedEnd = end > windowEnd ? windowEnd : end;
        if (clampedEnd <= anchor || clampedStart >= windowEnd) return null;
        const startPct = ((clampedStart.getTime() - anchor.getTime()) / (days * DAY_MS)) * 100;
        const endPct = ((clampedEnd.getTime() - anchor.getTime()) / (days * DAY_MS)) * 100;
        return {
          campaign: c,
          startPct: Math.max(0, startPct),
          endPct: Math.min(100, endPct),
          durationDays: Math.max(1, Math.round((clampedEnd.getTime() - clampedStart.getTime()) / DAY_MS)),
        };
      })
      .filter((b): b is Bar => b !== null)
      // Sort by deadline ascending so urgent stuff floats to the top
      .sort((a, b) => {
        const ad = parseDeadline(a.campaign.deadline, REF_DATE) || new Date(0);
        const bd = parseDeadline(b.campaign.deadline, REF_DATE) || new Date(0);
        return +ad - +bd;
      });
  }, [campaigns, anchor, days, windowEnd]);

  // Today position
  const todayPct =
    REF_DATE > anchor && REF_DATE < windowEnd
      ? ((REF_DATE.getTime() - anchor.getTime()) / (days * DAY_MS)) * 100
      : null;

  // Tick marks
  const ticks: { pct: number; label: string }[] = [];
  const tickEvery = ZOOMS[zoom].tickEvery;
  for (let d = 0; d <= days; d += tickEvery) {
    const date = new Date(anchor.getTime() + d * DAY_MS);
    ticks.push({
      pct: (d / days) * 100,
      label: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    });
  }

  const shift = (n: number) => setAnchor((a) => new Date(a.getTime() + n * DAY_MS));

  return (
    <div className="cmp-timeline-wrap">
      {/* Toolbar */}
      <div className="cmp-timeline-toolbar">
        <div className="cmp-timeline-zoom">
          {(Object.keys(ZOOMS) as ZoomKey[]).map((z) => (
            <button
              key={z}
              className={['tab', zoom === z ? 'is-on' : ''].join(' ')}
              onClick={() => setZoom(z)}
            >
              {ZOOMS[z].label}
            </button>
          ))}
        </div>
        <div className="cmp-timeline-nav">
          <button onClick={() => shift(-Math.floor(days / 2))} aria-label="Earlier"><Icon.back s={14} /></button>
          <button onClick={() => {
            const a = new Date(REF_DATE);
            a.setDate(a.getDate() - 7);
            setAnchor(a);
          }}>Today</button>
          <button onClick={() => shift(Math.floor(days / 2))} aria-label="Later"><Icon.arrow s={14} /></button>
        </div>
      </div>

      {bars.length === 0 ? (
        <div className="empty">
          <div className="empty-h">No campaigns in this window</div>
          <div>Try a different zoom or scroll the timeline forward.</div>
        </div>
      ) : (
        <div className="cmp-timeline" role="figure" aria-label="Campaign timeline">
          {/* Header — date axis */}
          <div className="cmp-timeline-axis">
            {ticks.map((t, i) => (
              <div key={i} className="cmp-timeline-tick" style={{ left: `${t.pct}%` }}>
                <div className="cmp-timeline-tick-label">{t.label}</div>
              </div>
            ))}
            {todayPct !== null && (
              <div className="cmp-timeline-today" style={{ left: `${todayPct}%` }}>
                <div className="cmp-timeline-today-pin">Today</div>
              </div>
            )}
          </div>

          {/* Rows */}
          <div className="cmp-timeline-rows">
            {/* Vertical grid lines */}
            <div className="cmp-timeline-grid" aria-hidden="true">
              {ticks.map((t, i) => (
                <div key={i} className="cmp-timeline-gridline" style={{ left: `${t.pct}%` }} />
              ))}
              {todayPct !== null && (
                <div className="cmp-timeline-todayline" style={{ left: `${todayPct}%` }} />
              )}
            </div>

            {bars.map((b) => (
              <button
                key={b.campaign.id}
                className="cmp-timeline-row"
                onClick={() => onOpen(b.campaign.id)}
                title={`${b.campaign.title} · ${stageLabel[b.campaign.stage]} · ${b.durationDays}d`}
              >
                <div className="cmp-timeline-label">
                  <span className="cmp-timeline-label-title">{b.campaign.title}</span>
                  <span className="cmp-timeline-label-meta">
                    {stageLabel[b.campaign.stage]} · {b.campaign.region}
                  </span>
                </div>
                <div className="cmp-timeline-track">
                  <div
                    className={['cmp-timeline-bar', `stage-${b.campaign.stage}`].join(' ')}
                    style={{ left: `${b.startPct}%`, width: `${Math.max(0.5, b.endPct - b.startPct)}%` }}
                  >
                    <span className="cmp-timeline-bar-label">{fmtMoney(b.campaign.budget)}</span>
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* Legend */}
          <div className="cmp-timeline-legend">
            {STAGES.filter((s) => s.id !== 'draft' && s.id !== 'closed').map((s) => (
              <span key={s.id} className={['cmp-timeline-legend-item', `stage-${s.id}`].join(' ')}>
                <span className="cmp-timeline-legend-swatch" />
                {s.label}
              </span>
            ))}
            <span className="cmp-timeline-legend-spacer" />
            <Pill tone="info">{bars.length} in view · {ZOOMS[zoom].label.toLowerCase()}</Pill>
          </div>
        </div>
      )}
    </div>
  );
}
