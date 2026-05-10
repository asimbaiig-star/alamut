// Preview what an email digest will look like — built from real activity in the store
// so users see what they'd actually receive based on the last 7 days of notifications.
import { useMemo, useState } from 'react';
import { useStore } from '@/lib/api/store';
import { useAuth } from '@/lib/auth/useAuth';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { fmtRelative } from '@/lib/utils/format';

interface EmailDigestPreviewModalProps {
  open: boolean;
  onClose: () => void;
}

type Cadence = 'daily' | 'weekly';

export function EmailDigestPreviewModal({ open, onClose }: EmailDigestPreviewModalProps) {
  const { user, isCreator, isBrand, creator, brand } = useAuth();
  const db = useStore((s) => s.db);
  const [cadence, setCadence] = useState<Cadence>('weekly');

  const periodDays = cadence === 'daily' ? 1 : 7;
  const cutoff = useMemo(() => new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000), [periodDays]);

  const items = useMemo(() => {
    if (!user) return [];
    return db.notifications
      .filter((n) => n.userId === user.id && new Date(n.at) > cutoff)
      .sort((a, b) => +new Date(b.at) - +new Date(a.at));
  }, [db.notifications, user, cutoff]);

  // Aggregate counts from real DB state
  const stats = useMemo(() => {
    if (!user) return { newApplications: 0, newOffers: 0, draftsAwaiting: 0, payoutsCleared: 0, payoutAmount: 0 };
    const newApps = db.applications.filter((a) => new Date(a.submittedAt) > cutoff && (
      isBrand && brand ? db.campaigns.some((c) => c.id === a.campaignId && c.brandId === brand.id) :
      isCreator && creator ? a.creatorId === creator.id : false
    )).length;
    const newOffers = db.offers.filter((o) => new Date(o.sentAt) > cutoff && (
      isCreator && creator ? o.creatorId === creator.id : false
    )).length;
    const draftsAwaiting = db.submissions.filter((s) => s.status === 'in_review' && (
      isBrand && brand ? db.campaigns.some((c) => c.id === s.campaignId && c.brandId === brand.id) : false
    )).length;
    const payoutTxs = db.transactions.filter((t) => t.userId === user.id && t.kind === 'payout' && new Date(t.at) > cutoff && t.amount > 0);
    return {
      newApplications: newApps,
      newOffers,
      draftsAwaiting,
      payoutsCleared: payoutTxs.length,
      payoutAmount: payoutTxs.reduce((s, t) => s + t.amount, 0),
    };
  }, [db, user, cutoff, isBrand, isCreator, brand, creator]);

  if (!user) return null;
  const subjectLine = isCreator
    ? `Alamut ${cadence} · ${stats.newOffers} new offer${stats.newOffers === 1 ? '' : 's'}, ${stats.payoutsCleared} payout${stats.payoutsCleared === 1 ? '' : 's'}`
    : `Alamut ${cadence} · ${stats.newApplications} application${stats.newApplications === 1 ? '' : 's'}, ${stats.draftsAwaiting} draft${stats.draftsAwaiting === 1 ? '' : 's'} to review`;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Email digest preview"
      width={680}
      footer={<Button onClick={onClose} icon={<Icon.check s={14} />}>Close</Button>}
    >
      <div className="row-between mb-16">
        <div className="mono-meta">Preview cadence</div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button type="button" className={['tab', cadence === 'daily' ? 'is-on' : ''].join(' ')} onClick={() => setCadence('daily')}>Daily</button>
          <button type="button" className={['tab', cadence === 'weekly' ? 'is-on' : ''].join(' ')} onClick={() => setCadence('weekly')}>Weekly</button>
        </div>
      </div>

      {/* Email frame mock */}
      <div style={{ border: '1px solid var(--rule)', borderRadius: 6, overflow: 'hidden', background: 'var(--paper)' }}>
        <div style={{ padding: '10px 16px', background: 'var(--paper-2)', borderBottom: '1px solid var(--rule)', fontSize: 12, color: 'var(--ink-60)', fontFamily: 'var(--mono)' }}>
          From: Alamut &lt;digest@alamut.co&gt;<br />
          To: {user.email}<br />
          Subject: {subjectLine}
        </div>
        <div style={{ padding: '24px 28px' }}>
          <div style={{ fontFamily: 'var(--serif)', fontSize: 28, lineHeight: 1.15, letterSpacing: '-0.01em', marginBottom: 4 }}>
            {isCreator ? `Hi ${creator?.name?.split(' ')[0] || 'there'},` : `Hi ${brand?.name || 'team'},`}
          </div>
          <div style={{ fontFamily: 'var(--serif)', fontSize: 20, fontStyle: 'italic', color: 'var(--ink-80)', marginBottom: 18 }}>
            here's your {cadence === 'daily' ? 'last 24 hours' : 'last 7 days'} on Alamut.
          </div>

          {/* Stats grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, padding: '14px 0', borderTop: '1px solid var(--rule)', borderBottom: '1px solid var(--rule)', marginBottom: 18 }}>
            {isCreator && (
              <>
                <Stat k="New offers" v={stats.newOffers} />
                <Stat k="Payouts cleared" v={stats.payoutsCleared} extra={stats.payoutAmount > 0 ? `$${stats.payoutAmount.toLocaleString()}` : '—'} />
              </>
            )}
            {isBrand && (
              <>
                <Stat k="New applications" v={stats.newApplications} />
                <Stat k="Drafts to review" v={stats.draftsAwaiting} accent />
              </>
            )}
          </div>

          <div className="mono-meta mb-8">Activity</div>
          {items.length === 0 ? (
            <div style={{ padding: 18, fontSize: 13, color: 'var(--ink-60)', textAlign: 'center', background: 'var(--paper-2)', borderRadius: 4 }}>
              Nothing happened in the last {cadence === 'daily' ? 'day' : 'week'}. We won't send an empty digest.
            </div>
          ) : (
            <div>
              {items.slice(0, 8).map((n) => (
                <div key={n.id} style={{ padding: '10px 0', borderTop: '1px solid var(--rule)', display: 'flex', gap: 10 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', marginTop: 7, flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, lineHeight: 1.4 }}>{n.text}</div>
                    <div className="mono-meta" style={{ marginTop: 2 }}>{fmtRelative(n.at)}</div>
                  </div>
                </div>
              ))}
              {items.length > 8 && (
                <div style={{ padding: '10px 0', fontSize: 12, color: 'var(--ink-60)', borderTop: '1px solid var(--rule)' }}>
                  + {items.length - 8} more · open Alamut to see all
                </div>
              )}
            </div>
          )}

          <div style={{ marginTop: 24, padding: '14px 16px', background: 'var(--paper-2)', borderRadius: 4, fontSize: 13, textAlign: 'center' }}>
            <a href="#" style={{ color: 'var(--accent)', fontWeight: 500, textDecoration: 'none' }}>Open your workspace ↗</a>
          </div>

          <div style={{ marginTop: 18, fontSize: 11, color: 'var(--ink-60)', textAlign: 'center' }}>
            You're receiving this because email digests are enabled. Manage preferences in Profile → Notifications.
          </div>
        </div>
      </div>

      <div style={{ marginTop: 14, padding: 12, background: 'var(--paper-2)', borderRadius: 4, fontSize: 12, color: 'var(--ink-60)', lineHeight: 1.5 }}>
        Email delivery isn't enabled in this build — this is a faithful preview of what you'd get once we wire up SendGrid / Postmark.
        Cadence and on/off settings save with your notification preferences above.
      </div>
    </Modal>
  );
}

function Stat({ k, v, extra, accent }: { k: string; v: number; extra?: string; accent?: boolean }) {
  return (
    <div style={{ padding: '4px 8px' }}>
      <div className="mono-meta">{k}</div>
      <div style={{ fontFamily: 'var(--serif)', fontSize: 28, lineHeight: 1.1, marginTop: 2, color: accent && v > 0 ? 'var(--accent)' : 'var(--ink)' }}>
        {v}{extra && <span style={{ fontSize: 14, fontFamily: 'var(--mono)', color: 'var(--ink-60)', marginLeft: 8 }}>{extra}</span>}
      </div>
    </div>
  );
}
