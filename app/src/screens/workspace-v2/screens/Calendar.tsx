// Calendar.tsx — persona-aware deadline calendar (Phase 50)
//
// Pulls every active collab's deliverables and renders them in a
// month-grid with day chips. Brand sees deliverables from their
// campaigns; creator sees the deliverables they owe. Click a chip
// → routes into the corresponding collab.
//
// Reads:
//   - useV2AllCampaigns / useV2AllCreators
//   - useV2CurrentBrand / useV2CurrentCreator (persona detection)
//   - deriveCollab via collabsForCampaign / collabsForCreator
//
// Hand-written month grid (no date library) — the surrounding app is
// vanilla and we want to keep dependencies thin.

import { useMemo, useState } from 'react';
import { Icon, Topbar } from '../lib';
import {
  useV2CurrentBrand, useV2CurrentCreator,
  useV2Campaigns, useV2Creators,
} from '../v2Hooks';
import { useStore } from '@/lib/api/store';
import { collabsForCampaign, collabsForCreator } from '../v2Adapters';
import type { V2Collab, V2Deliverable } from '../data';

interface Props { onRoute: (r: string) => void; }

type CalendarEntry = {
  date: Date;           // due date (parsed)
  deliverable: V2Deliverable;
  collab: V2Collab;
  campaignTitle: string;
  counterpartyName: string;
  counterpartyAvatar?: string;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const TODAY = (() => { const d = new Date(); d.setHours(0,0,0,0); return d; })();

function parseDue(due: string | undefined): Date | null {
  if (!due) return null;
  // V2Deliverable.due is a short-format string like "Jun 5" or "today".
  // The underlying submission/campaign carries the real ISO via deadline;
  // we get there via campaign deadline as a fallback.
  if (/^today$/i.test(due)) return TODAY;
  if (/^tomorrow$/i.test(due)) return new Date(TODAY.getTime() + DAY_MS);
  // Try Date.parse on a "Mon DD" string with current year prepended.
  const year = TODAY.getFullYear();
  const tryFull = new Date(`${due}, ${year}`);
  if (!Number.isNaN(+tryFull)) {
    // If parsing comes out > 11 months in the past, assume next year.
    if (tryFull.getTime() < TODAY.getTime() - 30 * DAY_MS) {
      return new Date(`${due}, ${year + 1}`);
    }
    return tryFull;
  }
  // Last resort: native parse on whatever raw string we have.
  const raw = new Date(due);
  return Number.isNaN(+raw) ? null : raw;
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function monthLabel(month: Date): string {
  return month.toLocaleString(undefined, { month: 'long', year: 'numeric' });
}

function startOfMonth(d: Date): Date { return new Date(d.getFullYear(), d.getMonth(), 1); }
function addMonths(d: Date, n: number): Date { return new Date(d.getFullYear(), d.getMonth() + n, 1); }

/** Build the 6×7 grid of dates that cover the month (with leading/trailing
 *  days from the neighbouring months so weeks line up). */
function monthGrid(month: Date): Date[] {
  const first = startOfMonth(month);
  const firstWeekday = first.getDay();              // 0 = Sun
  const start = new Date(first.getTime() - firstWeekday * DAY_MS);
  const grid: Date[] = [];
  for (let i = 0; i < 42; i++) {
    grid.push(new Date(start.getTime() + i * DAY_MS));
  }
  return grid;
}

export function Calendar({ onRoute }: Props) {
  const brand = useV2CurrentBrand();
  const creator = useV2CurrentCreator();
  const persona: 'brand' | 'creator' = brand ? 'brand' : 'creator';
  // useV2Campaigns is persona-scoped (brand: own campaigns; creator: campaigns
  // they're involved in) — no need to filter by brandId here.
  const campaigns = useV2Campaigns();
  const creators = useV2Creators();
  const db = useStore((s) => s.db);

  const [cursor, setCursor] = useState<Date>(startOfMonth(TODAY));

  /** Flatten every (collab × deliverable) into a single calendar entry. */
  const entries = useMemo<CalendarEntry[]>(() => {
    const list: CalendarEntry[] = [];
    if (persona === 'brand' && brand) {
      for (const camp of campaigns) {
        const collabs = collabsForCampaign(camp.id, db);
        for (const collab of collabs) {
          if (collab.stage === 'paid') continue;
          for (const del of collab.deliverables) {
            if (del.status === 'live') continue;
            const date = parseDue(del.due);
            if (!date) continue;
            const cr = creators.find((x) => x.id === collab.creatorId);
            list.push({
              date,
              deliverable: del,
              collab,
              campaignTitle: camp.name,
              counterpartyName: cr?.name ?? 'Unknown',
              counterpartyAvatar: cr?.avatar,
            });
          }
        }
      }
    } else if (persona === 'creator' && creator) {
      const collabs = collabsForCreator(creator.id, db);
      for (const collab of collabs) {
        if (collab.stage === 'paid') continue;
        const camp = campaigns.find((c) => c.id === collab.campaignId);
        for (const del of collab.deliverables) {
          if (del.status === 'live') continue;
          const date = parseDue(del.due);
          if (!date) continue;
          list.push({
            date,
            deliverable: del,
            collab,
            campaignTitle: camp?.name ?? 'Unknown campaign',
            counterpartyName: camp?.brand ?? 'Brand',
          });
        }
      }
    }
    return list.sort((a, b) => +a.date - +b.date);
  }, [persona, brand, creator, campaigns, creators, db]);

  /** Bucket entries by yyyy-mm-dd for O(1) day lookup. */
  const byDay = useMemo(() => {
    const m = new Map<string, CalendarEntry[]>();
    for (const e of entries) {
      const k = dayKey(e.date);
      const list = m.get(k) ?? [];
      list.push(e);
      m.set(k, list);
    }
    return m;
  }, [entries]);

  /** Counts for the topbar crumb. */
  const overdueCount = entries.filter((e) => +e.date < +TODAY).length;
  const next7 = entries.filter((e) => {
    const days = (+e.date - +TODAY) / DAY_MS;
    return days >= 0 && days <= 7;
  }).length;

  const grid = monthGrid(cursor);
  const empty = entries.length === 0;

  return (
    <>
      <Topbar
        title="Calendar"
        crumb={
          empty
            ? 'Deadlines from your active collabs will appear here'
            : `${overdueCount} overdue · ${next7} due in next 7 days`
        }
        actions={
          <>
            <button
              className="v2-btn v2-btn-outline"
              type="button"
              onClick={() => setCursor(addMonths(cursor, -1))}
              aria-label="Previous month"
            >
              ‹
            </button>
            <button
              className="v2-btn v2-btn-outline"
              type="button"
              onClick={() => setCursor(startOfMonth(TODAY))}
            >
              Today
            </button>
            <button
              className="v2-btn v2-btn-outline"
              type="button"
              onClick={() => setCursor(addMonths(cursor, 1))}
              aria-label="Next month"
            >
              ›
            </button>
          </>
        }
      />
      <div className="v2-content">
        <div className="v2-card v2-card-pad" style={{ marginBottom: 16 }}>
          <h2 style={{
            fontFamily: 'var(--v2-font-display)',
            fontSize: 24, fontWeight: 500, margin: '0 0 4px', letterSpacing: '-0.02em',
          }}>
            {monthLabel(cursor)}
          </h2>
          <div className="v2-muted" style={{ fontSize: 12.5, marginBottom: 14 }}>
            {persona === 'brand'
              ? 'Deliverables owed by creators on your campaigns.'
              : 'Deliverables you owe across your active collabs.'}
          </div>

          {/* Weekday header */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(7, 1fr)',
              fontSize: 11,
              fontWeight: 600,
              color: 'var(--v2-ink-3)',
              textTransform: 'uppercase',
              letterSpacing: '.1em',
              padding: '6px 0',
              borderBottom: '1px solid var(--v2-line)',
            }}
          >
            {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((d) => (
              <div key={d} style={{ textAlign: 'center' }}>{d}</div>
            ))}
          </div>

          {/* 6 × 7 grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(7, 1fr)',
              gridAutoRows: 'minmax(96px, auto)',
            }}
          >
            {grid.map((d, i) => {
              const key = dayKey(d);
              const sameMonth = d.getMonth() === cursor.getMonth();
              const isToday = key === dayKey(TODAY);
              const isPast = +d < +TODAY;
              const dayEntries = byDay.get(key) ?? [];
              return (
                <div
                  key={i}
                  style={{
                    border: '1px solid var(--v2-line)',
                    borderRight: (i % 7 === 6) ? '1px solid var(--v2-line)' : '0',
                    borderBottom: '0',
                    padding: '6px 6px 8px',
                    background: isToday
                      ? 'rgba(206, 90, 70, 0.05)'
                      : sameMonth ? 'transparent' : 'rgba(0,0,0,0.025)',
                    minHeight: 96,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4,
                  }}
                >
                  <div
                    style={{
                      fontSize: 11.5,
                      fontWeight: isToday ? 700 : 500,
                      color: isToday ? 'var(--v2-accent)' : sameMonth ? 'var(--v2-ink-2)' : 'var(--v2-ink-3)',
                    }}
                  >
                    {d.getDate()}
                    {isToday && <span style={{ fontSize: 10, marginLeft: 4 }}>· today</span>}
                  </div>
                  {dayEntries.slice(0, 3).map((e) => {
                    const overdue = isPast && !isToday && e.deliverable.status !== 'approved' && e.deliverable.status !== 'live';
                    return (
                      <button
                        key={e.deliverable.id}
                        type="button"
                        onClick={() => onRoute(`collab:${e.collab.id}`)}
                        title={`${e.campaignTitle} · ${e.deliverable.label} · ${e.counterpartyName}`}
                        style={{
                          display: 'block',
                          fontSize: 10.5,
                          padding: '3px 6px',
                          borderRadius: 4,
                          background: overdue ? 'rgba(206, 90, 70, 0.12)' : 'var(--v2-bg-2)',
                          color: overdue ? 'var(--v2-accent)' : 'var(--v2-ink-2)',
                          border: '0',
                          textAlign: 'left',
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          fontWeight: 500,
                        }}
                      >
                        {overdue ? '⚠ ' : ''}{e.deliverable.label.slice(0, 18)}
                      </button>
                    );
                  })}
                  {dayEntries.length > 3 && (
                    <div className="v2-muted" style={{ fontSize: 10 }}>
                      +{dayEntries.length - 3} more
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Upcoming list */}
        <div className="v2-card v2-card-pad">
          <h3 style={{
            fontFamily: 'var(--v2-font-display)',
            fontSize: 18, fontWeight: 500, margin: '0 0 10px', letterSpacing: '-0.02em',
          }}>
            Upcoming
          </h3>
          {empty && (
            <div className="v2-muted" style={{ fontSize: 13 }}>
              No active deliverables. Once a collab is in motion, deadlines show up here.
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {entries.slice(0, 12).map((e) => {
              const overdue = +e.date < +TODAY;
              return (
                <button
                  key={e.deliverable.id}
                  type="button"
                  onClick={() => onRoute(`collab:${e.collab.id}`)}
                  className="v2-row"
                  style={{
                    justifyContent: 'space-between',
                    padding: '10px 12px',
                    background: 'var(--v2-bg-2)',
                    border: '1px solid var(--v2-line)',
                    borderRadius: 'var(--v2-r-md)',
                    cursor: 'pointer',
                    textAlign: 'left',
                    gap: 12,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
                    {e.counterpartyAvatar && (
                      <div
                        className="v2-avatar v2-avatar-sm"
                        style={{ backgroundImage: `url(${e.counterpartyAvatar})` }}
                        aria-hidden="true"
                      />
                    )}
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{e.deliverable.label}</div>
                      <div className="v2-muted" style={{ fontSize: 11.5 }}>
                        {e.campaignTitle}{persona === 'brand' ? ` · ${e.counterpartyName}` : ''}
                      </div>
                    </div>
                  </div>
                  <div
                    style={{
                      fontSize: 11.5,
                      color: overdue ? 'var(--v2-accent)' : 'var(--v2-ink-2)',
                      fontWeight: overdue ? 600 : 500,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {overdue ? '⚠ overdue · ' : ''}{e.deliverable.due}
                    <span style={{ marginLeft: 8 }}>{Icon.arrow}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}
