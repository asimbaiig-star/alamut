// Month-grid calendar of campaign deadlines.
// Click a day with campaigns → callback fires with campaign IDs (parent opens drawer).
import { useMemo, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { Modal } from '@/components/ui/Modal';
import { Pill } from '@/components/ui/Pill';
import { Button } from '@/components/ui/Button';
import { fmtMoneyFull } from '@/lib/utils/format';
import { STAGES } from '@/lib/api/types';
import type { Campaign } from '@/lib/api/types';

const stageLabel = Object.fromEntries(STAGES.map((s) => [s.id, s.label]));

interface Props {
  campaigns: Campaign[];
  onOpenCampaign: (id: string) => void;
}

// Try to coerce a friendly deadline like "May 12" into a Date in the current/near year.
function parseDeadline(deadline: string, ref: Date): Date | null {
  if (!deadline) return null;
  const lower = deadline.toLowerCase().trim();
  if (lower === 'today') return new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
  if (lower === 'tomorrow') {
    const d = new Date(ref); d.setDate(d.getDate() + 1); return d;
  }
  // "N days" → N days from ref
  const m = lower.match(/^(\d+)\s*days?$/);
  if (m) { const d = new Date(ref); d.setDate(d.getDate() + Number(m[1])); return d; }
  // "Apr 30", "May 12 2025"
  const parsed = new Date(`${deadline} ${ref.getFullYear()}`);
  if (!isNaN(parsed.getTime())) return parsed;
  const parsed2 = new Date(deadline);
  if (!isNaN(parsed2.getTime())) return parsed2;
  return null;
}

const REF_DATE = new Date('2026-04-27');

export function CampaignCalendar({ campaigns, onOpenCampaign }: Props) {
  const [cursor, setCursor] = useState(() => new Date(REF_DATE.getFullYear(), REF_DATE.getMonth(), 1));
  const [dayDetail, setDayDetail] = useState<{ date: Date; items: Campaign[] } | null>(null);

  const byDay = useMemo(() => {
    const map: Record<string, Campaign[]> = {};
    campaigns.forEach((c) => {
      const d = parseDeadline(c.deadline, REF_DATE);
      if (!d) return;
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      (map[key] = map[key] || []).push(c);
    });
    return map;
  }, [campaigns]);

  const monthName = cursor.toLocaleString('en-US', { month: 'long', year: 'numeric' });
  const firstDay = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const lastDay  = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
  const startWeekday = firstDay.getDay(); // 0 = Sun
  const daysInMonth = lastDay.getDate();

  // Build a 6×7 grid of cells (some null for padding)
  const cells: ({ date: Date; key: string } | null)[] = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(cursor.getFullYear(), cursor.getMonth(), d);
    cells.push({ date, key: `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}` });
  }
  while (cells.length % 7 !== 0) cells.push(null);

  const today = new Date(REF_DATE.getFullYear(), REF_DATE.getMonth(), REF_DATE.getDate());
  const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

  const totalThisMonth = Object.entries(byDay).filter(([k]) => {
    const [y, m] = k.split('-').map(Number);
    return y === cursor.getFullYear() && m === cursor.getMonth();
  }).reduce((sum, [, list]) => sum + list.length, 0);

  return (
    <div>
      <div className="cal-head">
        <div>
          <div className="mono-meta mb-8">{totalThisMonth} deadline{totalThisMonth === 1 ? '' : 's'} this month</div>
          <div className="cal-month">{monthName}</div>
        </div>
        <div className="cal-nav">
          <button onClick={() => setCursor((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))} aria-label="Previous month"><Icon.back s={14} /></button>
          <button onClick={() => setCursor(new Date(REF_DATE.getFullYear(), REF_DATE.getMonth(), 1))}>Today</button>
          <button onClick={() => setCursor((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))} aria-label="Next month"><Icon.arrow s={14} /></button>
        </div>
      </div>

      <div className="cal-weekdays">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((w) => <div key={w}>{w}</div>)}
      </div>

      <div className="cal-grid">
        {cells.map((cell, i) => {
          if (!cell) return <div key={i} className="cal-cell is-empty" />;
          const items = byDay[cell.key] || [];
          const isToday = sameDay(cell.date, today);
          const isPast = cell.date < today;
          return (
            <div key={i} className={['cal-cell', isToday ? 'is-today' : '', isPast ? 'is-past' : ''].join(' ')}>
              <div className="cal-cell-d">{cell.date.getDate()}</div>
              {items.slice(0, 3).map((c) => (
                <button key={c.id} onClick={() => onOpenCampaign(c.id)} className={['cal-item', `cal-item-${c.stage}`].join(' ')} title={`${c.title} · ${stageLabel[c.stage]} · ${fmtMoneyFull(c.budget)}`}>
                  <span className="cal-item-dot" />
                  <span className="cal-item-title">{c.title}</span>
                </button>
              ))}
              {items.length > 3 && (
                <button className="cal-more" onClick={() => setDayDetail({ date: cell.date, items })}>+ {items.length - 3} more</button>
              )}
            </div>
          );
        })}
      </div>

      <div className="cal-legend">
        {STAGES.filter((s) => s.id !== 'draft' && s.id !== 'closed').map((s) => (
          <span key={s.id} className="cal-legend-item">
            <span className={`cal-item-dot cal-item-${s.id}`} /> {s.label}
          </span>
        ))}
      </div>

      {dayDetail && (
        <Modal
          open
          onClose={() => setDayDetail(null)}
          title={`${dayDetail.items.length} deadline${dayDetail.items.length === 1 ? '' : 's'} · ${dayDetail.date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`}
          width={520}
          footer={<Button variant="ghost" onClick={() => setDayDetail(null)}>Close</Button>}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {dayDetail.items.map((c) => (
              <button
                key={c.id}
                onClick={() => { onOpenCampaign(c.id); setDayDetail(null); }}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr auto',
                  gap: 12,
                  alignItems: 'center',
                  padding: '12px 14px',
                  border: '1px solid var(--rule)',
                  borderRadius: 6,
                  cursor: 'pointer',
                  background: 'var(--surface)',
                  textAlign: 'left',
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontFamily: 'var(--serif)', fontSize: 17, marginBottom: 4, letterSpacing: '-0.01em' }}>{c.title}</div>
                  <div className="mono-meta">{c.category} · {c.region} · {fmtMoneyFull(c.budget)}</div>
                </div>
                <Pill tone={c.stage === 'live' ? 'info' : c.stage === 'closed' ? 'good' : 'warn'}>
                  {stageLabel[c.stage]}
                </Pill>
              </button>
            ))}
          </div>
        </Modal>
      )}
    </div>
  );
}
