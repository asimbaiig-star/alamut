// calendarDates.test.ts — the month grid counts calendar days, not 24h blocks.
//
// November 2026 printed "1" twice and put every later day one column off:
// the grid added 24 hours per cell, and the night daylight saving ends
// (Nov 1 in the US) is 25 hours long, so cell two landed on Nov 1 again.
import { describe, it, expect } from 'vitest';
// A zone with daylight saving, whatever machine runs this.
process.env.TZ = 'America/New_York';
import { addDays, monthGrid } from '../screens/Calendar';

const key = (d: Date) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;

describe('monthGrid', () => {
  for (const [y, m] of [[2026, 10], [2026, 2], [2027, 2], [2027, 10], [2026, 0]] as const) {
    it(`gives each day of ${y}-${m + 1} once, in its weekday column`, () => {
      const grid = monthGrid(new Date(y, m, 1));
      expect(new Set(grid.map(key)).size).toBe(grid.length);
      for (const [i, d] of grid.entries()) expect(d.getDay()).toBe(i % 7);
      const inMonth = grid.filter((d) => d.getMonth() === m).map((d) => d.getDate());
      expect(inMonth[0]).toBe(1);
      expect(inMonth).toEqual(Array.from({ length: inMonth.length }, (_, i) => i + 1));
    });
  }
  it('November 2026 starts on a Sunday and the 9th is a Monday', () => {
    const grid = monthGrid(new Date(2026, 10, 1));
    expect(grid[0].getDate()).toBe(1);
    expect(grid[1].getDate()).toBe(2);
    expect(grid.find((d) => d.getMonth() === 10 && d.getDate() === 9)!.getDay()).toBe(1);
  });
});

describe('addDays', () => {
  it('crosses the end of daylight saving to the next date', () => {
    expect(key(addDays(new Date(2026, 10, 1), 1))).toBe('2026-11-2');
    expect(key(addDays(new Date(2026, 2, 8), 1))).toBe('2026-3-9');
  });
});
