// dueDates.ts — deliverable deadlines as calendar days. Shared by the
// Calendar and Today's "Due this week".

export const DAY_MS = 24 * 60 * 60 * 1000;
export const TODAY = (() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; })();

/** Calendar days, not 24-hour blocks: adding 24h across the end of
 *  daylight saving (Nov 1 2026 in the US) lands on the same date, which
 *  printed "1" twice and put every later day one column off. */
export function addDays(d: Date, n: number): Date { return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); }
/** Whole days from a to b, rounded so a DST hour can't make it 6.96. */
export function daysBetween(a: Date, b: Date): number { return Math.round((+b - +a) / DAY_MS); }


/**
 * The deadline for a deliverable.
 *
 * Reads `dueAt` (a real ISO date) and only falls back to parsing the human
 * `due` string for rows persisted before that field existed.
 *
 * The fallback keeps a year guess because "Jun 5" genuinely doesn't carry
 * one — but the guess no longer decides anything for current data, and the
 * old rule is gone: it assumed that anything landing >30 days in the past
 * must have meant NEXT year, so a deliverable 31+ days overdue was pushed
 * ~11 months into the future. It disappeared from the overdue count, the
 * 7-day list and the grid — the most neglected work was the work that
 * vanished. Now a past date stays past.
 */
export function parseDue(del: { due?: string; dueAt?: string }): Date | null {
  if (del.dueAt) {
    const d = new Date(del.dueAt);
    if (!Number.isNaN(+d)) { d.setHours(0, 0, 0, 0); return d; }
  }
  const due = del.due;
  if (!due) return null;
  if (/^today$/i.test(due)) return TODAY;
  if (/^tomorrow$/i.test(due)) return addDays(TODAY, 1);
  // Legacy rows only: "Mon DD" with the current year. If that lands in the
  // past it IS in the past — we don't roll it forward.
  const tryFull = new Date(`${due}, ${TODAY.getFullYear()}`);
  if (!Number.isNaN(+tryFull)) return tryFull;
  const raw = new Date(due);
  return Number.isNaN(+raw) ? null : raw;
}

