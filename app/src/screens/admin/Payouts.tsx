import { useMemo } from 'react';
import { useStore } from '@/lib/api/store';
import { PageHead } from '@/components/layout/PageHead';
import { Pill } from '@/components/ui/Pill';
import { fmtMoney, fmtMoneyFull, fmtDate, fmtRelative } from '@/lib/utils/format';
import { Sparkline } from '@/components/charts/Sparkline';
import { escrowByStage, platformSeries } from '@/lib/utils/admin-metrics';
import { stageLabel, stageTone, txStatusLabel, txStatusTone } from '@/lib/utils/labels';
import { EmptyArt } from '@/components/ui/EmptyArt';

export function AdminPayouts() {
  const db = useStore((s) => s.db);

  // Payouts in flight = campaigns with escrow held (money holding for an accepted offer)
  const inEscrow = db.campaigns.filter((c) => c.escrowHeld > 0);
  const totalEscrow = inEscrow.reduce((s, c) => s + c.escrowHeld, 0);
  const totalPaid = db.transactions.filter((t) => t.kind === 'payout' && t.amount > 0).reduce((s, t) => s + t.amount, 0);

  const recentPayouts = db.transactions
    .filter((t) => t.kind === 'payout' && t.amount > 0)
    .sort((a, b) => +new Date(b.at) - +new Date(a.at))
    .slice(0, 30);

  const recentReleases = db.transactions
    .filter((t) => t.kind === 'escrow_release')
    .sort((a, b) => +new Date(b.at) - +new Date(a.at))
    .slice(0, 30);

  const stageEscrow = useMemo(() => escrowByStage(db), [db]);
  const releaseSeries = useMemo(
    () => platformSeries(db, (t) => t.kind === 'escrow_release' || t.kind === 'payout', undefined, 30),
    [db],
  );
  const releaseValues = releaseSeries.map((p) => p.total);
  const releaseTotal = releaseValues.reduce((a, b) => a + b, 0);

  return (
    <div className="page">
      <PageHead
        num="A · 03"
        label="Payouts"
        title={<>Payout <em>queue</em>.</>}
        lede="Money currently in escrow, recent releases, and payouts cleared to creators. Monitor — payouts auto-release when a brand approves a submission."
      />

      <div className="kpi-strip mb-24">
        <div>
          <div className="kpi-k">In escrow</div>
          <div className="kpi-v">{fmtMoneyFull(totalEscrow)}</div>
          <div className="kpi-d">across {inEscrow.length} campaigns</div>
        </div>
        <div>
          <div className="kpi-k">Paid lifetime</div>
          <div className="kpi-v">{fmtMoneyFull(totalPaid)}</div>
          <div className="kpi-d">{db.transactions.filter((t) => t.kind === 'payout' && t.amount > 0).length} payouts</div>
        </div>
        <div>
          <div className="kpi-k">Recent releases</div>
          <div className="kpi-v">{recentReleases.length}</div>
          <div className="kpi-d">last 30</div>
        </div>
        <div>
          <div className="kpi-k">Health</div>
          <div className="kpi-v">100<span className="u">%</span></div>
          <div className="kpi-d up">no disputes open</div>
        </div>
      </div>

      <div className="home-row home-row-2col">
        <section className="admin-tbl-tile tile">
          <div className="admin-tbl-h">
            <div>
              <div className="mono-meta">Released · last 30 days</div>
              <div className="home-spend-amount" style={{ marginTop: 6 }}>{fmtMoney(releaseTotal)}</div>
              <div className="mono-meta">Escrow releases + payouts cleared</div>
            </div>
          </div>
          <div className="home-spend-chart"><Sparkline values={releaseValues} height={88} ariaLabel="Released funds last 30 days" /></div>
        </section>

        <section className="admin-tbl-tile tile">
          <div className="admin-tbl-h">
            <div>
              <div className="mono-meta">Escrow by stage</div>
              <h2 className="home-tile-title">Where the <em>money sits</em>.</h2>
            </div>
          </div>
          {stageEscrow.length === 0 ? (
            <div className="text-ink-60" style={{ fontSize: 13 }}>No escrow currently held.</div>
          ) : (
            <ul className="admin-escrow-stages">
              {stageEscrow.map((s) => (
                <li key={s.stage} className={['admin-escrow-stage', `stage-${s.stage}`].join(' ')}>
                  <span className="admin-escrow-stage-dot" />
                  <span className="admin-escrow-stage-name">{stageLabel(s.stage)}</span>
                  <span className="admin-escrow-stage-count">{s.count} cmpn</span>
                  <span className="admin-escrow-stage-total">{fmtMoneyFull(s.total)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="admin-tbl-tile tile">
        <div className="admin-tbl-h">
          <div>
            <div className="mono-meta">Currently in escrow</div>
            <h2 className="home-tile-title">{inEscrow.length} campaign{inEscrow.length === 1 ? '' : 's'}.</h2>
          </div>
        </div>
        {inEscrow.length === 0 ? (
          <div className="empty" style={{ margin: '8px 0' }}>
            <EmptyArt kind="wallet" size={100} />
            <div className="empty-h">No escrow holds</div>
            <div>All cleared.</div>
          </div>
        ) : (
          <table className="tbl">
            <thead><tr><th>Campaign</th><th>Brand</th><th>Stage</th><th style={{ textAlign: 'right' }}>Held</th><th>Created</th></tr></thead>
            <tbody>
              {inEscrow.map((c) => {
                const brand = db.brands.find((b) => b.id === c.brandId);
                return (
                  <tr key={c.id}>
                    <td style={{ fontWeight: 500 }}>{c.title}</td>
                    <td>{brand?.name}</td>
                    <td><Pill tone={stageTone(c.stage)}>{stageLabel(c.stage)}</Pill></td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--mono)' }}>{fmtMoneyFull(c.escrowHeld)}</td>
                    <td className="mono-meta">{fmtDate(c.createdAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      <section className="admin-tbl-tile tile">
        <div className="admin-tbl-h">
          <div>
            <div className="mono-meta">Recent payouts</div>
            <h2 className="home-tile-title">Last <em>30</em>.</h2>
          </div>
        </div>
        {recentPayouts.length === 0 ? (
          <div className="empty" style={{ margin: '8px 0' }}>
            <EmptyArt kind="wallet" size={100} />
            <div className="empty-h">No payouts yet</div>
          </div>
        ) : (
          <table className="tbl">
            <thead><tr><th>When</th><th>To creator</th><th>Campaign</th><th style={{ textAlign: 'right' }}>Amount</th><th>Status</th></tr></thead>
            <tbody>
              {recentPayouts.map((t) => {
                const u = db.users.find((x) => x.id === t.userId);
                const c = u?.creatorId ? db.creators.find((cr) => cr.id === u.creatorId) : null;
                const cmp = t.campaignId ? db.campaigns.find((x) => x.id === t.campaignId) : null;
                return (
                  <tr key={t.id}>
                    <td className="mono-meta">{fmtRelative(t.at)}</td>
                    <td>{c?.name || u?.email || '—'}</td>
                    <td style={{ fontSize: 13 }}>{cmp?.title || '—'}</td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--mono)' }}>{fmtMoneyFull(t.amount)}</td>
                    <td><Pill tone={txStatusTone(t.status)}>{txStatusLabel(t.status)}</Pill></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
