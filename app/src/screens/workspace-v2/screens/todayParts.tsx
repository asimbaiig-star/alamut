// todayParts.tsx — the pieces Today is built from (portal canvas, Round 8,
// direction B "one deal, one place").
//
// Today used to be a pile: one need open, three as bands with clipped
// titles, the rest behind "See all". Now every need is a row you can act on
// where it stands, the most urgent first and open, with any unread messages
// on the deal beside it. Money is a small card; it's checked weekly, the
// list daily.

import { useState, type ReactNode } from 'react';
import { dollars } from './homeParts';

export interface TaskItem {
  id: string;
  /** The brand's (or the account's) colour, as a stripe and a tile. */
  stripe: string;
  /** One letter, or a logo URL. */
  mark: string;
  title: string;
  sub: ReactNode;
  /** The buttons that answer it, right there. */
  actions: ReactNode;
  /** Where the title goes: the deal, the campaign, the page. */
  route: string;
  unread?: number;
  /** Shown while the row is open: terms, a pitch, a note. */
  detail?: ReactNode;
}

export function TaskList({ items, label, onRoute, limit = 8 }: {
  items: TaskItem[];
  label: string;
  onRoute: (r: string) => void;
  /** Rows shown before "Show all N". */
  limit?: number;
}) {
  // The most urgent row with something to show is open from the start; any
  // other opens on request. Derived, not stored: the list can fill after
  // the first render (live data arrives) or lose the open item when it's
  // answered, and a stored id then left nothing open. Rows without a detail
  // can't open, so they're skipped: a counter at the top of the brand's
  // list left every row shut.
  const [chosen, setOpen] = useState<string | null>(null);
  const openable = items.filter((i) => i.detail);
  const open = chosen && openable.some((i) => i.id === chosen) ? chosen : openable[0]?.id ?? null;
  const [all, setAll] = useState(false);
  const shown = all ? items : items.slice(0, limit);
  return (
    <>
    <ul className="v2-td-list" aria-label={label}>
      {shown.map((it) => {
        const isOpen = open === it.id && !!it.detail;
        return (
          <li key={it.id} className="v2-td-row" data-open={isOpen || undefined}>
            <span className="v2-td-stripe" style={{ background: it.stripe }} aria-hidden="true" />
            <span className="v2-td-mark" style={{ background: it.stripe }} aria-hidden="true">
              {/^(https?:|data:|\/)/.test(it.mark) ? <img src={it.mark} alt="" /> : it.mark}
            </span>
            <div className="v2-td-text">
              <button type="button" className="v2-td-title" onClick={() => onRoute(it.route)}>{it.title}</button>
              <small>{it.sub}</small>
            </div>
            <div className="v2-td-acts">
              {it.unread ? (
                <button type="button" className="v2-td-msg" onClick={() => onRoute(it.route)} aria-label={`${it.unread} new message${it.unread === 1 ? '' : 's'} on this deal`}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true"><path d="M4 5h16v11H8l-4 4z" /></svg>
                  {it.unread} new
                </button>
              ) : null}
              {it.actions}
              {it.detail && !isOpen ? (
                <button type="button" className="v2-td-more" aria-expanded={false} aria-label={`Show details: ${it.title}`} onClick={() => setOpen(it.id)}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
                </button>
              ) : null}
            </div>
            {isOpen && <div className="v2-td-detail">{it.detail}</div>}
          </li>
        );
      })}
    </ul>
    {items.length > limit && (
      <button type="button" className="v2-cal-more" aria-expanded={all} onClick={() => setAll((v) => !v)}>
        {all ? 'Show fewer' : `Show all ${items.length}`}
      </button>
    )}
    </>
  );
}

/** The terms of an offer or a pitch, side by side. */
export function TaskTerms({ cells }: { cells: { label: string; value: string; tone?: 'moss' }[] }) {
  return (
    <div className="v2-td-terms">
      {cells.map((c) => (
        <div key={c.label}><span>{c.label}</span><b data-tone={c.tone}>{c.value}</b></div>
      ))}
    </div>
  );
}

/** Rows shown under "Due this week"; the heading counts them all. */
const SHOWN_DUE = 5;

export interface DueItem {
  id: string;
  date: Date;
  what: string;
  sub: string;
  late: boolean;
  route: string;
  action: string;
}

export function DueSoon({ items, onRoute, calendarRoute, empty }: {
  items: DueItem[];
  onRoute: (r: string) => void;
  calendarRoute: string;
  empty: string;
}) {
  return (
    <section aria-labelledby="td-due">
      <h2 className="v2-hm-h2" id="td-due">
        Due this week <span>{items.length === 0 ? 'nothing' : `${items.length}`}</span>
        <button type="button" className="v2-hm-more" onClick={() => onRoute(calendarRoute)}>Calendar</button>
      </h2>
      {items.length === 0 ? <p className="v2-hm-note">{empty}</p> : (
        <>
        <ul className="v2-td-due">
          {items.slice(0, SHOWN_DUE).map((d) => (
            <li key={d.id} data-late={d.late || undefined}>
              <span className="v2-td-day" aria-hidden="true">
                <b>{d.date.getDate()}</b>
                <small>{d.late ? 'late' : d.date.toLocaleDateString('en-US', { weekday: 'short' })}</small>
              </span>
              <div><b>{d.what}</b><small>{d.sub}</small></div>
              <button type="button" className="v2-hm-btn is-sm" onClick={() => onRoute(d.route)}>{d.action}</button>
            </li>
          ))}
        </ul>
        {items.length > SHOWN_DUE && (
          <button type="button" className="v2-cal-more" onClick={() => onRoute(calendarRoute)}>
            {items.length - SHOWN_DUE} more in the calendar
          </button>
        )}
        </>
      )}
    </section>
  );
}

export function MoneyCard({ title, rows, action }: {
  title: string;
  rows: { label: string; value: number; strong?: boolean }[];
  action: ReactNode;
}) {
  return (
    <section className="v2-td-money" aria-label={title}>
      <h2 className="v2-hm-h2">{title}</h2>
      {rows.map((r) => (
        <div key={r.label} className="v2-td-mrow" data-strong={r.strong || undefined}>
          <span>{r.label}</span><b>{dollars(r.value)}</b>
        </div>
      ))}
      <div className="v2-td-mfoot">
        <span className="v2-hm-test"><i aria-hidden="true" />Beta: payments run in test mode</span>
        {action}
      </div>
    </section>
  );
}
