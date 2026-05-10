// Admin disputes queue (Phase 5 origin · Phase 28 made it embeddable
// in AdminQueueUnified · Phase 30 lifted the resolve form into a
// standalone DisputeResolveModal so the deal page can use it too).
//
// This screen renders the table; resolution lives in DisputeResolveModal.

import { useState } from 'react';
import { useStore } from '@/lib/api/store';
import { select } from '@/lib/api/client';
import { PageHead } from '@/components/layout/PageHead';
import { Button } from '@/components/ui/Button';
import { Pill } from '@/components/ui/Pill';
import { Icon } from '@/components/ui/Icon';
import { fmtRelative, fmtMoneyFull } from '@/lib/utils/format';
import { REF_DATE } from '@/lib/utils/campaign-metrics';
import { DISPUTE_CATEGORY_LABEL, disputeStatusLabel, disputeStatusTone, stageLabel } from '@/lib/utils/labels';
import { EmptyArt } from '@/components/ui/EmptyArt';
import { DisputeResolveModal } from '@/components/modals/DisputeResolveModal';

const DAY_MS = 24 * 60 * 60 * 1000;
// P2 §1.4 — `category` replaced `reason` on the type; the category map
// here is the same shape (Record<DisputeCategory, string>) so the table
// just uses it under a friendly local alias.
const CATEGORY_LABEL = DISPUTE_CATEGORY_LABEL;

interface AdminDisputesProps {
  /** When true, omit the PageHead (parent page renders shared head). */
  hideHead?: boolean;
}

export function AdminDisputes({ hideHead = false }: AdminDisputesProps = {}) {
  const db = useStore((s) => s.db);
  const [tab, setTab] = useState<'open' | 'all'>('open');
  const [activeId, setActiveId] = useState<string | null>(null);

  const all = select.allDisputes(db);
  const list = tab === 'open' ? all.filter((d) => d.status === 'open') : all;
  const active = activeId ? all.find((d) => d.id === activeId) : null;
  const activeCmp = active ? db.campaigns.find((c) => c.id === active.campaignId) : null;

  const userName = (uid: string) => {
    const u = db.users.find((x) => x.id === uid);
    if (!u) return uid;
    if (u.creatorId) return db.creators.find((c) => c.id === u.creatorId)?.name || u.email;
    if (u.brandId) return db.brands.find((b) => b.id === u.brandId)?.name || u.email;
    return u.email;
  };

  return (
    <div className={hideHead ? '' : 'page'}>
      {!hideHead && (
        <PageHead
          num="A · 05"
          label="Disputes"
          title={<>Dispute <em>queue</em>.</>}
          lede="Filed by either party when a campaign goes off-track. Escrow is frozen on the campaign until resolved. Resolutions move money between brand wallet and creator wallet according to your call."
        />
      )}

      <div className="kpi-strip mb-24">
        <div>
          <div className="kpi-k">Open</div>
          <div className="kpi-v" style={{ color: all.filter((d) => d.status === 'open').length > 0 ? 'var(--bad)' : 'var(--ink)' }}>
            {all.filter((d) => d.status === 'open').length}
          </div>
          <div className="kpi-d">awaiting review</div>
        </div>
        <div>
          <div className="kpi-k">Resolved · all time</div>
          <div className="kpi-v">{all.filter((d) => d.status !== 'open').length}</div>
        </div>
        <div>
          <div className="kpi-k">Median resolution</div>
          <div className="kpi-v">2.3<span className="u">d</span></div>
          <div className="kpi-d">across closed cases</div>
        </div>
        <div>
          <div className="kpi-k">Funds in dispute</div>
          <div className="kpi-v">
            {fmtMoneyFull(all.filter((d) => d.status === 'open').reduce((s, d) => {
              const c = db.campaigns.find((x) => x.id === d.campaignId);
              return s + (c?.escrowHeld || 0);
            }, 0))}
          </div>
          <div className="kpi-d">currently frozen</div>
        </div>
      </div>

      <div className="toolbar">
        <div className="tabs">
          <button className={['tab', tab === 'open' ? 'is-on' : ''].join(' ')} onClick={() => setTab('open')}>
            Open ({all.filter((d) => d.status === 'open').length})
          </button>
          <button className={['tab', tab === 'all' ? 'is-on' : ''].join(' ')} onClick={() => setTab('all')}>
            All ({all.length})
          </button>
        </div>
      </div>

      {list.length === 0 ? (
        <div className="empty">
          <EmptyArt kind="general" />
          <div className="empty-h">{tab === 'open' ? 'No open disputes' : 'No disputes filed yet'}</div>
          <div>{tab === 'open' ? 'Escrow flows freely. Filed disputes will appear here for review.' : 'When either party files a dispute, the case shows up here.'}</div>
        </div>
      ) : (
        <section className="admin-tbl-tile tile">
          <div className="admin-tbl-h">
            <div>
              <div className="mono-meta">{tab === 'open' ? 'Open' : 'All disputes'}</div>
              <h2 className="home-tile-title">{list.length} case{list.length === 1 ? '' : 's'}.</h2>
            </div>
          </div>
          <table className="tbl">
            <thead><tr>
              <th>Campaign</th>
              <th>Filed by</th>
              <th>Side</th>
              <th>Category</th>
              <th>Filed</th>
              <th>Status</th>
              <th style={{ textAlign: 'right' }}>Action</th>
            </tr></thead>
            <tbody>
              {list.map((d) => {
                const c = db.campaigns.find((x) => x.id === d.campaignId);
                const daysOld = Math.max(0, Math.round((+REF_DATE - d.raisedAt) / DAY_MS));
                const slaBreached = d.status === 'open' && daysOld >= 4;
                return (
                  <tr key={d.id}>
                    <td>
                      <div style={{ fontWeight: 500 }}>{c?.title || '—'}</div>
                      <div className="mono-meta">{c ? stageLabel(c.stage) : '—'} · escrow {fmtMoneyFull(c?.escrowHeld || 0)}</div>
                    </td>
                    <td style={{ fontSize: 13 }}>{userName(d.raisedByUserId)}</td>
                    <td style={{ fontSize: 13 }}>{d.raisedByRole}</td>
                    <td><Pill>{CATEGORY_LABEL[d.category]}</Pill></td>
                    <td className="mono-meta">
                      {fmtRelative(new Date(d.raisedAt).toISOString())}
                      {slaBreached && <Pill tone="bad" className="ml-8">SLA · {daysOld}d</Pill>}
                    </td>
                    <td><Pill tone={disputeStatusTone(d.status)} pulse={d.status === 'open'}>{disputeStatusLabel(d.status)}</Pill></td>
                    <td style={{ textAlign: 'right' }}>
                      <Button
                        variant={d.status === 'open' ? 'solid' : 'ghost'}
                        size="sm"
                        onClick={() => setActiveId(d.id)}
                        icon={d.status === 'open' ? <Icon.check s={12} /> : undefined}
                      >
                        {d.status === 'open' ? 'Resolve' : 'View'}
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}

      {/* Phase 30: standalone resolve modal — same component used on
          the deal page so admin can resolve without bouncing here. */}
      {active && activeCmp && (
        <DisputeResolveModal
          open={!!active}
          onClose={() => setActiveId(null)}
          dispute={active}
          campaign={activeCmp}
        />
      )}
    </div>
  );
}
