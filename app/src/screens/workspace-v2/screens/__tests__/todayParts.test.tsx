// @vitest-environment jsdom
//
// TaskList and DueSoon, the two lists on Today (Round 8, B).
//
// What we pin:
//   - the first row that has a detail is open at load, even when the rows
//     above it have none (a counter at the top of the brand's list left
//     every row shut)
//   - answering the open row opens the next one, rather than none
//   - "Due this week" counts every item, shows five, and points at the
//     calendar for the rest

import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { TaskList, DueSoon, type TaskItem, type DueItem } from '../todayParts';

afterEach(cleanup);

const row = (id: string, detail?: string): TaskItem => ({
  id,
  stripe: '#333',
  mark: id[0],
  title: `Row ${id}`,
  sub: '',
  actions: null,
  route: `deal:${id}`,
  detail: detail ? <p>{detail}</p> : undefined,
});

describe('TaskList', () => {
  it('opens the first row that has something to show', () => {
    render(<TaskList items={[row('a'), row('b', 'B detail'), row('c', 'C detail')]} label="Needs you" onRoute={() => {}} />);
    expect(screen.getByText('B detail')).toBeTruthy();
    expect(screen.queryByText('C detail')).toBeNull();
  });

  it('opens the next row once the open one is answered', () => {
    const { rerender } = render(<TaskList items={[row('a', 'A detail'), row('b', 'B detail')]} label="Needs you" onRoute={() => {}} />);
    expect(screen.getByText('A detail')).toBeTruthy();
    rerender(<TaskList items={[row('b', 'B detail')]} label="Needs you" onRoute={() => {}} />);
    expect(screen.getByText('B detail')).toBeTruthy();
  });

  it('opens a row when the list fills after the first render', () => {
    const { rerender } = render(<TaskList items={[]} label="Needs you" onRoute={() => {}} />);
    rerender(<TaskList items={[row('a', 'A detail')]} label="Needs you" onRoute={() => {}} />);
    expect(screen.getByText('A detail')).toBeTruthy();
  });
});

describe('DueSoon', () => {
  it('counts every item, shows five, and sends the rest to the calendar', () => {
    const items: DueItem[] = Array.from({ length: 8 }, (_, i) => ({
      id: `d${i}`,
      date: new Date(2026, 10, 10 + i),
      what: `Post ${i}`,
      sub: '',
      late: false,
      action: 'Open',
      route: `deal:d${i}`,
    }));
    render(<DueSoon items={items} onRoute={() => {}} calendarRoute="creator-calendar" empty="Nothing due" />);
    expect(screen.getByText('8')).toBeTruthy();
    expect(screen.getAllByRole('listitem')).toHaveLength(5);
    expect(screen.getByRole('button', { name: '3 more in the calendar' })).toBeTruthy();
  });
});
