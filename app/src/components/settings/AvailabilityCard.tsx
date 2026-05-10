import { useState } from 'react';
import { useAuth } from '@/lib/auth/useAuth';
import { api } from '@/lib/api/client';
import type { Availability } from '@/lib/api/types';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Pill } from '@/components/ui/Pill';
import { Icon } from '@/components/ui/Icon';
import { pushToast } from '@/lib/utils/toast';

export function AvailabilityCard() {
  const { creator } = useAuth();
  const init: Availability = creator?.availability || { status: 'open', note: '' };
  const [status, setStatus] = useState<Availability['status']>(init.status);
  const [untilDate, setUntilDate] = useState(init.untilDate?.slice(0, 10) || '');
  const [note, setNote] = useState(init.note || '');
  const [busy, setBusy] = useState(false);
  if (!creator) return null;

  const save = async () => {
    setBusy(true);
    try {
      await api.settings.setAvailability({
        status,
        untilDate: untilDate ? new Date(untilDate).toISOString() : undefined,
        note: note.trim() || undefined,
      });
      pushToast('Availability updated', 'good');
    } catch (e) {
      pushToast(e instanceof Error ? e.message : 'Save failed', 'bad');
    } finally {
      setBusy(false);
    }
  };

  const tone = status === 'open' ? 'good' : status === 'limited' ? 'warn' : 'bad';
  const label = status === 'open' ? 'Open for work' : status === 'limited' ? 'Limited capacity' : 'Booked / paused';

  return (
    <Card title="Availability" link={
      <Button variant="ghost" size="sm" onClick={save} loading={busy} icon={<Icon.check s={12} />}>Save</Button>
    }>
      <div className="row-between mb-16">
        <div>
          <div className="mono-meta">Current</div>
          <div className="mt-8"><Pill tone={tone}>{label}</Pill></div>
        </div>
        <div className="text-ink-60" style={{ fontSize: 12, maxWidth: 240, textAlign: 'right' }}>
          Visible on your profile to brands. Helps avoid offers when you can't deliver.
        </div>
      </div>

      <div className="form-grid">
        <div className="field full">
          <label className="field-label">Status</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {(['open', 'limited', 'booked'] as const).map((s) => (
              <button key={s} type="button" className={['tab', status === s ? 'is-on' : ''].join(' ')} onClick={() => setStatus(s)}>
                {s === 'open' ? 'Open' : s === 'limited' ? 'Limited' : 'Booked'}
              </button>
            ))}
          </div>
        </div>
        {status !== 'open' && (
          <div className="field">
            <label className="field-label">Available again from (optional)</label>
            <input type="date" value={untilDate} onChange={(e) => setUntilDate(e.target.value)} />
          </div>
        )}
        <div className={status !== 'open' ? 'field' : 'field full'}>
          <label className="field-label">Note (optional, public)</label>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={status === 'open' ? 'Open for selective lifestyle briefs.' : 'Booked through May. Available June 1.'} />
        </div>
      </div>
    </Card>
  );
}
