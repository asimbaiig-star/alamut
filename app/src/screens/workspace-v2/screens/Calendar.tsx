// Calendar.tsx — persona-aware deadline calendar (Round 7).
//
// What's due comes first, as a list: overdue, this week, next week, later,
// each with the move it needs (upload, resubmit, paste the link; for a
// brand, review). The month sits beside it, small, with a dot per thing
// due; picking a day narrows the list to it. The full grid of truncated
// chips it replaced answered "what's next" badly and was unreadable on a
// phone. Brand sees deliverables on their campaigns; creator sees the ones
// they owe.
//
// Reads:
//   - useV2AllCampaigns / useV2AllCreators
//   - useV2CurrentBrand / useV2CurrentCreator (persona detection)
//   - deriveCollab via collabsForCampaign / collabsForCreator
//
// Hand-written month grid (no date library) — the surrounding app is
// vanilla and we want to keep dependencies thin.

import { useMemo, useState } from 'react';
import { Topbar } from '../lib';
import {
  useV2CurrentBrand, useV2CurrentCreator,
  useV2Campaigns, useV2Creators,
} from '../v2Hooks';
import { useStore } from '@/lib/api/store';
import { collabsForCampaign, collabsForCreator, isActiveCollab } from '../v2Adapters';
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

import { TODAY, parseDue, addDays, daysBetween } from '../dueDates';
export { addDays };

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
export function monthGrid(month: Date): Date[] {
  const first = startOfMonth(month);
  const firstWeekday = first.getDay();              // 0 = Sun
  const start = addDays(first, -firstWeekday);
  const grid: Date[] = [];
  for (let i = 0; i < 42; i++) grid.push(addDays(start, i));
  // Drop a sixth row that is all next month.
  return grid[35].getMonth() !== first.getMonth() ? grid.slice(0, 35) : grid;
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
  // A day picked on the month narrows the list to it.
  const [picked, setPicked] = useState<string | null>(null);
  // Each group shows its first few; the rest open on request, so a brand
  // with dozens of creators doesn't get a page of hundreds of rows.
  const [opened, setOpened] = useState<Record<string, boolean>>({});

  /** Flatten every (collab × deliverable) into a single calendar entry. */
  const entries = useMemo<CalendarEntry[]>(() => {
    const list: CalendarEntry[] = [];
    if (persona === 'brand' && brand) {
      for (const camp of campaigns) {
        const collabs = collabsForCampaign(camp.id, db);
        for (const collab of collabs) {
          // Skip terminal stages: 'paid' is finished, and a cancelled collab
          // isn't going ahead — its deliverable dates aren't real deadlines
          // for anyone. Cancelled rows used to be filtered out upstream so
          // this gate only needed 'paid'; they're surfaced now, so it needs
          // both.
          if (collab.stage === 'paid' || !isActiveCollab(collab)) continue;
          for (const del of collab.deliverables) {
            if (del.status === 'live') continue;
            const date = parseDue(del);
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
        // Same as the brand branch above — a terminal collab carries no live
        // deadlines.
        if (collab.stage === 'paid' || !isActiveCollab(collab)) continue;
        const camp = campaigns.find((c) => c.id === collab.campaignId);
        for (const del of collab.deliverables) {
          if (del.status === 'live') continue;
          const date = parseDue(del);
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

  /** Is this entry genuinely late? Shared by the topbar crumb and the calendar
   *  cell highlight so the two cannot disagree.
   *
   *  Pre-fix the crumb counted EVERY past-dated entry while the cell (below)
   *  excluded approved and live work — so the header claimed "288 overdue"
   *  while the grid highlighted far fewer, and neither number could be
   *  reconciled with the other. Approved work isn't late; it's done. */
  const isOverdueEntry = (e: CalendarEntry): boolean =>
    +e.date < +TODAY
    && e.deliverable.status !== 'approved'
    && e.deliverable.status !== 'live';

  /** Counts for the head. */
  const overdueCount = entries.filter(isOverdueEntry).length;
  const thisWeek = entries.filter((e) => !isOverdueEntry(e) && daysBetween(TODAY, e.date) <= 6);
  const nextWeek = entries.filter((e) => { const n = daysBetween(TODAY, e.date); return n >= 7 && n <= 13; });
  const later = entries.filter((e) => daysBetween(TODAY, e.date) >= 14);
  const late = entries.filter(isOverdueEntry);
  const grid = monthGrid(cursor);
  const empty = entries.length === 0;
  const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  const row = (e: CalendarEntry) => (
    <AgendaRow key={`${e.collab.id}-${e.deliverable.id}`} e={e} persona={persona} overdue={isOverdueEntry(e)} onRoute={onRoute} />
  );
  const LIMIT = 6;
  const rows = (id: string, list: CalendarEntry[], noun: string) => (
    <>
      {(opened[id] ? list : list.slice(0, LIMIT)).map(row)}
      {list.length > LIMIT && (
        <button type="button" className="v2-cal-more" aria-expanded={!!opened[id]} onClick={() => setOpened((o) => ({ ...o, [id]: !o[id] }))}>
          {opened[id] ? 'Show fewer' : `Show ${list.length - LIMIT} more ${noun}`}
        </button>
      )}
    </>
  );
  const pickedEntries = picked ? byDay.get(picked) ?? [] : [];
  const pickedDate = picked ? grid.find((d) => dayKey(d) === picked) : undefined;

  return (
    <>
      <Topbar
        title="Calendar"
        crumb={<button type="button" className="v2-link-btn" onClick={() => onRoute(persona === 'brand' ? 'campaigns' : 'creator-collabs')}>{persona === 'brand' ? 'Campaigns' : 'Deals'}</button>}
        sub={
          empty
            ? (persona === 'brand' ? 'Deadlines from your creators’ deals appear here.' : 'Deadlines from your deals appear here.')
            : [
                overdueCount > 0 ? `${overdueCount} overdue` : null,
                `${thisWeek.length} due this week`,
              ].filter(Boolean).join('. ') + '.'
        }
      />
      <div className="v2-content v2-cal">
        <div className="v2-cal-list">
          {empty && (
            <div className="v2-ls-empty">
              <b>Nothing due.</b>
              <p>{persona === 'brand'
                ? 'When a creator agrees a deal, each post’s deadline shows up here.'
                : 'When you agree a deal, each post’s deadline shows up here.'}</p>
            </div>
          )}
          {picked && pickedDate && (
            <section className="v2-cal-grp" aria-labelledby="cal-picked">
              <h2 className="v2-hm-h2" id="cal-picked">
                {pickedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                <span>{pickedEntries.length === 0 ? 'nothing due' : `${pickedEntries.length} due`}</span>
                <button type="button" className="v2-hm-more" onClick={() => setPicked(null)}>Show everything</button>
              </h2>
              {rows('picked', pickedEntries, 'that day')}
            </section>
          )}
          {!picked && late.length > 0 && (
            <section className="v2-cal-grp" aria-labelledby="cal-late">
              <h2 className="v2-hm-h2" id="cal-late" data-tone="late">
                Overdue <span>{late.length} · {persona === 'brand' ? 'creators are behind' : 'the brand is waiting'}</span>
              </h2>
              {rows('late', late, 'overdue')}
            </section>
          )}
          {!picked && thisWeek.length > 0 && (
            <section className="v2-cal-grp" aria-labelledby="cal-week">
              <h2 className="v2-hm-h2" id="cal-week">This week <span>{fmt(TODAY)} to {fmt(addDays(TODAY, 6))} · {thisWeek.length}</span></h2>
              {rows('week', thisWeek, 'this week')}
            </section>
          )}
          {!picked && nextWeek.length > 0 && (
            <section className="v2-cal-grp" aria-labelledby="cal-next">
              <h2 className="v2-hm-h2" id="cal-next">Next week <span>{fmt(addDays(TODAY, 7))} to {fmt(addDays(TODAY, 13))} · {nextWeek.length}</span></h2>
              {rows('next', nextWeek, 'next week')}
            </section>
          )}
          {!picked && later.length > 0 && (
            <section className="v2-cal-grp" aria-labelledby="cal-later">
              <h2 className="v2-hm-h2" id="cal-later">Later <span>{later.length}</span></h2>
              {rows('later', later, 'later')}
            </section>
          )}
        </div>

        <aside className="v2-cal-side">
          <div className="v2-cal-month">
            <header>
              <h2>{monthLabel(cursor)}</h2>
              <div>
                <button type="button" onClick={() => setCursor(addMonths(cursor, -1))} aria-label="Previous month">‹</button>
                <button type="button" onClick={() => { setCursor(startOfMonth(TODAY)); setPicked(null); }} aria-label="This month">•</button>
                <button type="button" onClick={() => setCursor(addMonths(cursor, 1))} aria-label="Next month">›</button>
              </div>
            </header>
            <div className="v2-cal-grid" role="group" aria-label={`${monthLabel(cursor)}: pick a day`}>
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => <span key={i} aria-hidden="true">{d}</span>)}
              {grid.map((d) => {
                const key = dayKey(d);
                const list = byDay.get(key) ?? [];
                const lateN = list.filter(isOverdueEntry).length;
                const label = `${d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}${list.length ? `, ${list.length} due${lateN ? `, ${lateN} overdue` : ''}` : ''}`;
                return (
                  <button
                    key={key}
                    type="button"
                    aria-label={label}
                    aria-pressed={picked === key}
                    data-out={d.getMonth() !== cursor.getMonth() || undefined}
                    data-today={key === dayKey(TODAY) || undefined}
                    onClick={() => setPicked(picked === key ? null : key)}
                  >
                    {d.getDate()}
                    {list.length > 0 && (
                      <i aria-hidden="true">
                        {list.slice(0, 3).map((e, j) => <em key={j} data-late={isOverdueEntry(e) || undefined} />)}
                      </i>
                    )}
                  </button>
                );
              })}
            </div>
            <p className="v2-cal-key"><span><i /> Due</span><span><i data-late /> Overdue</span></p>
          </div>
          <p className="v2-cal-note">Pick a day to see only what’s due then. Dates are the deals’ deadlines; they change when both sides agree a new one.</p>
        </aside>
      </div>
    </>
  );
}

function AgendaRow({ e, persona, overdue, onRoute }: {
  e: CalendarEntry;
  persona: 'brand' | 'creator';
  overdue: boolean;
  onRoute: (r: string) => void;
}) {
  const days = daysBetween(TODAY, e.date);
  const st = e.deliverable.status;
  const href = `collab:${e.collab.id}`;
  const when = days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : days > 1 ? `In ${days} days` : `${-days} day${days === -1 ? '' : 's'} late`;
  let status = when;
  let action: { label: string; route: string; dark?: boolean } = { label: 'Open', route: href };
  if (persona === 'creator') {
    if (st === 'revision') { status = 'Changes asked'; action = { label: 'Resubmit', route: `${href}?action=upload`, dark: true }; }
    else if (st === 'in_review') { status = 'With the brand'; }
    else if (st === 'approved') { status = 'Approved, post it'; action = { label: 'Paste link', route: `${href}?action=mark-live` }; }
    else if (overdue) { action = { label: 'Upload', route: `${href}?action=upload`, dark: true }; }
  } else {
    if (st === 'in_review') { status = 'Waiting for your review'; action = { label: 'Review', route: `campaign:${e.collab.campaignId}?tab=content`, dark: true }; }
    else if (st === 'revision') { status = 'Changes asked, with the creator'; }
    else if (st === 'approved') { status = 'Approved, waiting for the post'; }
  }
  const dateTop = days < 0 || days > 13
    ? e.date.toLocaleDateString('en-US', { month: 'short' })
    : e.date.toLocaleDateString('en-US', { weekday: 'short' });
  return (
    <div className="v2-cal-row" data-late={overdue || undefined}>
      <div className="v2-cal-date" aria-hidden="true"><b>{e.date.getDate()}</b><small>{dateTop}</small></div>
      <div className="v2-cal-what">
        <button type="button" className="v2-cd-name" onClick={() => onRoute(href)}>
          {e.deliverable.label}
          <span className="v2-sr-only">, due {e.date.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}</span>
        </button>
        <small>{e.campaignTitle} · {e.counterpartyName}</small>
      </div>
      <span className="v2-cal-st" data-late={overdue || undefined}>{status}</span>
      <button type="button" className={`v2-hm-btn is-sm${action.dark ? ' is-dark' : ''}`} onClick={() => onRoute(action.route)}>{action.label}</button>
    </div>
  );
}
