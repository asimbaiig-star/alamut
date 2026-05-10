import { useState } from 'react';
import { useStore } from '@/lib/api/store';
import { api } from '@/lib/api/client';
import { PageHead } from '@/components/layout/PageHead';
import { Button } from '@/components/ui/Button';
import { Pill } from '@/components/ui/Pill';
import { Icon } from '@/components/ui/Icon';
import { fmtRelative, fmtMoneyFull } from '@/lib/utils/format';
import { pushToast } from '@/lib/utils/toast';
import { EmptyArt } from '@/components/ui/EmptyArt';
import { REF_DATE } from '@/lib/utils/campaign-metrics';

const DAY_MS = 24 * 60 * 60 * 1000;

interface AdminVerifyProps {
  /** When true, omit the PageHead (parent page renders shared head). */
  hideHead?: boolean;
}

export function AdminVerify({ hideHead = false }: AdminVerifyProps = {}) {
  const db = useStore((s) => s.db);
  const [tab, setTab] = useState<'unverified' | 'verified'>('unverified');
  const [busy, setBusy] = useState<string | null>(null);

  const filtered = db.brands.filter((b) => tab === 'unverified' ? !b.verified : b.verified);

  const set = async (brandId: string, verified: boolean) => {
    setBusy(brandId);
    try {
      await api.admin.setBrandVerified(brandId, verified);
      pushToast(verified ? 'Brand verified' : 'Verified status removed', 'good');
    } catch (e) {
      pushToast(e instanceof Error ? e.message : 'Action failed', 'bad');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className={hideHead ? '' : 'page'}>
      {!hideHead && (
        <PageHead
          num="A · 02"
          label="Verify brands"
          title={<>Brand <em>verification</em>.</>}
          lede="Verified brands appear with a checkmark in creators' inboxes and unlock higher application volume."
        />
      )}

      <div className="toolbar">
        <div className="tabs">
          <button className={['tab', tab === 'unverified' ? 'is-on' : ''].join(' ')} onClick={() => setTab('unverified')}>
            Unverified ({db.brands.filter((b) => !b.verified).length})
          </button>
          <button className={['tab', tab === 'verified' ? 'is-on' : ''].join(' ')} onClick={() => setTab('verified')}>
            Verified ({db.brands.filter((b) => b.verified).length})
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="empty">
          <EmptyArt kind="general" />
          <div className="empty-h">{tab === 'unverified' ? 'All brands are verified' : 'No verified brands yet'}</div>
          <div>{tab === 'unverified' ? 'New brands signing up will land here for review.' : 'Verified brands appear here once approved.'}</div>
        </div>
      ) : (
        <section className="admin-tbl-tile tile">
          <div className="admin-tbl-h">
            <div>
              <div className="mono-meta">{tab === 'unverified' ? 'Unverified' : 'Verified'}</div>
              <h2 className="home-tile-title">{filtered.length} brand{filtered.length === 1 ? '' : 's'}.</h2>
            </div>
          </div>
          <table className="tbl">
            <thead><tr><th>Brand</th><th>Industry</th><th>HQ</th><th>Joined</th><th style={{ textAlign: 'right' }}>Wallet</th><th style={{ textAlign: 'right' }}>Action</th></tr></thead>
            <tbody>
              {filtered.map((b) => {
                const u = db.users.find((x) => x.id === b.userId);
                const daysOld = u ? Math.max(0, Math.round((+REF_DATE - +new Date(u.createdAt)) / DAY_MS)) : 0;
                const slaBreached = !b.verified && daysOld >= 3;
                return (
                  <tr key={b.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ width: 36, height: 36, borderRadius: 4, background: 'var(--paper-2)', display: 'grid', placeItems: 'center', fontFamily: 'var(--serif)', fontSize: 16 }}>{b.logoMark || b.name.slice(0,1)}</div>
                        <div>
                          <div style={{ fontWeight: 500 }}>{b.name}</div>
                          <div className="mono-meta">{b.website || u?.email}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ fontSize: 13 }}>{b.industry}</td>
                    <td style={{ fontSize: 13 }}>{b.hq}</td>
                    <td className="mono-meta">
                      {u ? fmtRelative(u.createdAt) : '—'}
                      {slaBreached && <Pill tone="bad" className="ml-8">SLA · {daysOld}d</Pill>}
                    </td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--mono)' }}>{fmtMoneyFull(b.walletBalance)}</td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        {b.verified ? (
                          <>
                            <Pill tone="good">Verified</Pill>
                            <Button variant="ghost" size="sm" onClick={() => set(b.id, false)} loading={busy === b.id}>Revoke</Button>
                          </>
                        ) : (
                          <Button size="sm" onClick={() => set(b.id, true)} loading={busy === b.id} icon={<Icon.check s={12} />}>Verify</Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
