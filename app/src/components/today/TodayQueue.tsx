// Today — flat ranked queue (Phase 26).
//
// The new Today screen for both creator and brand. Replaces the bucket-
// based Today from Phase 4 (offers / drafts / revisions / matching /
// payouts / disputes / applications) with one ranked queue plus a
// passive "Recent activity" tail.
//
// Architecture:
//   - The page-level screen (creator/Today.tsx, brand/Today.tsx) is a
//     thin wrapper that gathers role context and renders <TodayQueue>.
//   - TodayQueue receives ranked deals (from collectTodayDeals) plus a
//     KPI header configuration object.
//   - Each row is a TodayDealRow → links to /deal/:id.
//
// The KPI strip varies per role but the queue chrome is shared.

import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '@/components/ui/Icon';
import { TodayDealRow } from './TodayDealRow';
import type { RankedDeals } from '@/lib/utils/deal-ranking';
import type { Deal } from '@/lib/api/use-deal';
import type { Role } from '@/lib/utils/deal-action';

export interface TodayKPI {
  label: string;
  value: string;
  detail?: string;
}

interface Props {
  role: Role;
  /** First name of the viewer for the headline ("Sarah Chen" → "Sarah"). */
  viewerName: string;
  /** Ranked output from collectTodayDeals. */
  ranked: RankedDeals<Deal>;
  /** 4-5 KPIs shown across the header strip. */
  kpis: TodayKPI[];
  /** Empty-state CTA destination (/discover for creator, /campaigns for brand). */
  emptyCtaHref?: string;
  emptyCtaLabel?: string;
  /** Optional notice slot rendered between the header and the actionable
   *  queue. Use for campaign-level signals that don't fit the deal model
   *  (Phase 26 QA: orphan overdue briefs with no creators on them). */
  prequel?: ReactNode;
}

export function TodayQueue({ role, viewerName, ranked, kpis, emptyCtaHref, emptyCtaLabel, prequel }: Props) {
  const total = ranked.actionable.length;
  const recentCount = ranked.passive.length;

  // Headline mirrors creator/Today's old pattern but draws from ranked queue.
  const headline = total === 0
    ? `${viewerName.split(' ')[0]} — you're all caught up.`
    : `${total} ${total === 1 ? 'thing needs' : 'things need'} you.`;
  const subhead = total === 0
    ? `${recentCount} recent ${recentCount === 1 ? 'event' : 'events'} below — passive items where the other side is working.`
    : 'Each row clears once you act. Tap to open the full deal.';

  return (
    <div className="page today-page">
      {/* Headline + KPI strip */}
      <header className="today-header">
        <div className="today-headline">
          <h1 className="today-h">{headline}</h1>
          <p className="today-sub">{subhead}</p>
        </div>
        <div className="today-kpis">
          {kpis.map((k, i) => (
            <div className="today-kpi" key={i}>
              <div className="today-kpi-k mono-meta">{k.label}</div>
              <div className="today-kpi-v">{k.value}</div>
              {k.detail && <div className="today-kpi-d mono-meta">{k.detail}</div>}
            </div>
          ))}
        </div>
      </header>

      {/* Optional prequel notice — orphan briefs, campaign-level alerts. */}
      {prequel}

      {/* Empty state */}
      {total === 0 && recentCount === 0 && (
        <div className="today-empty tile">
          <div className="today-empty-mark">
            <svg width={56} height={56} viewBox="0 0 56 56" fill="none" stroke="currentColor" strokeWidth={1.5}>
              <circle cx={28} cy={28} r={24} opacity={0.18} />
              <path d="M18 28 l8 8 l14 -16" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div className="today-empty-h">Inbox zero on your work.</div>
          <div className="today-empty-lede">
            {role === 'creator'
              ? 'Pending offers, drafts due, and disputes will land here as they appear.'
              : 'New applications, drafts to review, and offer responses will land here as they appear.'}
          </div>
          {emptyCtaHref && emptyCtaLabel && (
            <div className="today-empty-cta">
              <Link to={emptyCtaHref} className="btn btn-md btn-solid">
                <Icon.compass s={14} /> {emptyCtaLabel}
              </Link>
            </div>
          )}
        </div>
      )}

      {/* Actionable queue — the primary surface */}
      {total > 0 && (
        <section className="today-section">
          <div className="today-section-h">
            <span className="mono-meta">{total} need{total === 1 ? 's' : ''} you</span>
            {emptyCtaHref && emptyCtaLabel && (
              <Link to={emptyCtaHref} className="today-section-action">
                {emptyCtaLabel} <Icon.arrow s={12} />
              </Link>
            )}
          </div>
          <div className="today-rows">
            {ranked.actionable.map((d) => (
              <TodayDealRow key={d.payload.id} deal={d.payload} role={role} />
            ))}
          </div>
        </section>
      )}

      {/* Passive tail — celebrate / monitor without competing for attention */}
      {recentCount > 0 && (
        <section className="today-section today-section-passive">
          <div className="today-section-h">
            <span className="mono-meta">Recent activity · {recentCount}</span>
          </div>
          <div className="today-rows">
            {ranked.passive.slice(0, 8).map((d) => (
              <TodayDealRow key={d.payload.id} deal={d.payload} role={role} />
            ))}
          </div>
          {recentCount > 8 && (
            <div className="today-section-foot mono-meta">
              + {recentCount - 8} earlier event{recentCount - 8 === 1 ? '' : 's'}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
