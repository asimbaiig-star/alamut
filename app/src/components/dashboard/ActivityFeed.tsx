// Unified activity feed for brand + creator Home (Phase 7).
//
// Renders a vertical timeline of merged events from `brandActivity` /
// `creatorActivity`. Each event has a kind-tinted dot, primary text,
// optional detail line, optional money amount, and a relative timestamp.
// Click the row to navigate to the canonical place to act.

import { Link } from 'react-router-dom';
import { fmtMoney, fmtRelative } from '@/lib/utils/format';
import type { ActivityEvent, ActivityEventKind } from '@/lib/utils/dashboard-metrics';

interface Props {
  events: ActivityEvent[];
  /** Optional copy override for the empty state. */
  emptyHint?: string;
}

const ICON_FOR: Record<ActivityEventKind, string> = {
  stage:               '◆',
  application:         '↗',
  app_decision:        '✓',
  offer_sent:          '$',
  offer_responded:     '↩',
  submission:          '⤴',
  submission_decision: '✓',
  payout:              '$',
  review:              '★',
};

const TONE_FOR: Record<ActivityEventKind, string> = {
  stage:               'info',
  application:         'info',
  app_decision:        'good',
  offer_sent:          'warn',
  offer_responded:     'warn',
  submission:          'info',
  submission_decision: 'good',
  payout:              'good',
  review:              'accent',
};

export function ActivityFeed({ events, emptyHint = 'No activity yet.' }: Props) {
  if (events.length === 0) {
    return (
      <div className="activity-empty">
        <div className="mono-meta">{emptyHint}</div>
      </div>
    );
  }

  return (
    <ol className="activity-feed">
      {events.map((e) => {
        const inner = (
          <>
            <span className={['activity-dot', `tone-${TONE_FOR[e.kind]}`].join(' ')} aria-hidden="true">
              {ICON_FOR[e.kind]}
            </span>
            <span className="activity-line" aria-hidden="true" />
            <div className="activity-body">
              <div className="activity-row">
                <span className="activity-text">{e.text}</span>
                {e.amount !== undefined && (
                  <span className="activity-amount">{fmtMoney(e.amount)}</span>
                )}
                <span className="activity-time">{fmtRelative(e.at)}</span>
              </div>
              {e.detail && <div className="activity-detail">{e.detail}</div>}
            </div>
          </>
        );
        return (
          <li key={e.id} className={['activity-event', `kind-${e.kind}`].join(' ')}>
            {e.href
              ? <Link to={e.href} className="activity-link">{inner}</Link>
              : <div className="activity-link">{inner}</div>}
          </li>
        );
      })}
    </ol>
  );
}
