import { useState } from 'react';
import { useAuth } from '@/lib/auth/useAuth';
import { api } from '@/lib/api/client';
import type { NotificationPrefs } from '@/lib/api/types';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { EmailDigestPreviewModal } from '@/components/modals/EmailDigestPreviewModal';
import { pushToast } from '@/lib/utils/toast';

const DEFAULTS: NotificationPrefs = {
  applications: true, offers: true, approvals: true, payouts: true, reviews: true, team: true, marketing: false,
};

const ROWS_BY_ROLE: Record<'creator' | 'brand', { key: keyof NotificationPrefs; label: string; help: string }[]> = {
  creator: [
    { key: 'applications', label: 'Application updates',  help: 'When a brand shortlists, declines, or withdraws.' },
    { key: 'offers',       label: 'Offers',                help: 'New offers, counters, and accept/decline events.' },
    { key: 'approvals',    label: 'Brand feedback',         help: 'When the brand approves a draft or requests revisions.' },
    { key: 'payouts',      label: 'Payouts',                help: 'When escrow releases to your wallet.' },
    { key: 'reviews',      label: 'Reviews',                help: 'When a brand leaves a review for you.' },
    { key: 'marketing',    label: 'Platform announcements', help: 'New features, opportunities, occasional updates.' },
    { key: 'team',         label: 'Team',                   help: 'Team-related events. (Brand-side mostly.)' },
  ],
  brand: [
    { key: 'applications', label: 'New applications',       help: 'When creators apply to your live campaigns.' },
    { key: 'offers',       label: 'Offer responses',        help: 'When a creator accepts, declines, or counters.' },
    { key: 'approvals',    label: 'Drafts to review',       help: 'When a creator submits a draft for approval.' },
    { key: 'payouts',      label: 'Wallet & payouts',       help: 'When escrow holds, releases, or top-ups complete.' },
    { key: 'reviews',      label: 'Reviews',                help: 'When a creator leaves a review for your brand.' },
    { key: 'team',         label: 'Team',                   help: 'When a teammate joins or makes a campaign-level change.' },
    { key: 'marketing',    label: 'Platform announcements', help: 'New features, opportunities, occasional updates.' },
  ],
};

export function NotificationPrefsCard() {
  const { user, isCreator } = useAuth();
  const [prefs, setPrefs] = useState<NotificationPrefs>(user?.notificationPrefs || DEFAULTS);
  const [busy, setBusy] = useState(false);
  const [digestOpen, setDigestOpen] = useState(false);
  if (!user) return null;
  const rows = ROWS_BY_ROLE[isCreator ? 'creator' : 'brand'];

  const toggle = (k: keyof NotificationPrefs) => setPrefs((p) => ({ ...p, [k]: !p[k] }));

  const save = async () => {
    setBusy(true);
    try {
      await api.settings.setNotificationPrefs(prefs);
      pushToast('Notification preferences saved', 'good');
    } catch (e) {
      pushToast(e instanceof Error ? e.message : 'Save failed', 'bad');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card title="Notification preferences" link={
      <div style={{ display: 'flex', gap: 6 }}>
        <Button variant="plain" size="sm" onClick={() => setDigestOpen(true)} icon={<Icon.inbox s={12} />}>Preview email digest</Button>
        <Button variant="ghost" size="sm" onClick={save} loading={busy} icon={<Icon.check s={12} />}>Save</Button>
      </div>
    }>
      {rows.map((r) => (
        <label key={r.key} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, padding: '12px 0', borderTop: '1px solid var(--rule)', cursor: 'pointer' }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 500 }}>{r.label}</div>
            <div className="text-ink-60" style={{ fontSize: 12, marginTop: 2 }}>{r.help}</div>
          </div>
          <span
            role="switch"
            aria-checked={prefs[r.key]}
            tabIndex={0}
            onClick={() => toggle(r.key)}
            onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); toggle(r.key); } }}
            style={{
              width: 36, height: 20,
              borderRadius: 999,
              background: prefs[r.key] ? 'var(--ink)' : 'var(--rule)',
              position: 'relative',
              cursor: 'pointer',
              transition: 'background 0.15s',
              alignSelf: 'center',
            }}
          >
            <span style={{
              position: 'absolute',
              top: 2, left: prefs[r.key] ? 18 : 2,
              width: 16, height: 16,
              borderRadius: '50%',
              background: 'var(--paper)',
              transition: 'left 0.15s',
            }} />
          </span>
        </label>
      ))}
      <EmailDigestPreviewModal open={digestOpen} onClose={() => setDigestOpen(false)} />
    </Card>
  );
}
