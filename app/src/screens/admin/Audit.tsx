import { useEffect, useMemo, useState } from 'react';
import { useStore } from '@/lib/api/store';
import { PageHead } from '@/components/layout/PageHead';
import { Pill } from '@/components/ui/Pill';
import { Icon } from '@/components/ui/Icon';
import { fmtRelative, fmtMoneyFull, fmtDate } from '@/lib/utils/format';
import { downloadCSV } from '@/lib/utils/csv';
import { pushToast } from '@/lib/utils/toast';
import { Button } from '@/components/ui/Button';
import { stageLabel, txLabel, txTone } from '@/lib/utils/labels';
import { useDebouncedValue } from '@/lib/utils/useDebouncedValue';

// Phase 21: redact emails to "j••@example.com" for compliance-safe export.
function maskEmail(s: string): string {
  return s.replace(/([a-z0-9._%+-]{1,2})[a-z0-9._%+-]*@([a-z0-9.-]+\.[a-z]{2,})/gi, '$1••@$2');
}

// Phase 21 QA fix: union now matches every TxKind from types.ts so cast at
// line 65 doesn't silently widen unknown kinds. `transition` is admin-only.
interface AuditEvent {
  id: string;
  at: string;
  kind: 'transition' | 'topup' | 'escrow_hold' | 'escrow_release' | 'payout' | 'fee' | 'refund' | 'ad_spend' | 'referral_bonus';
  actor: string;
  summary: string;
  meta?: string;
  amount?: number;
}

const PAGE_SIZE = 100;

export function AdminAudit() {
  const db = useStore((s) => s.db);
  const [filter, setFilter] = useState<'all' | 'campaigns' | 'money'>('all');
  const [search, setSearch] = useState('');
  // Phase 21: debounce so each keystroke doesn't recompute the whole list.
  const debouncedSearch = useDebouncedValue(search, 220);
  const [page, setPage] = useState(0);
  const [maskEmails, setMaskEmails] = useState(false);

  // Reset to page 0 whenever filter/search changes.
  useEffect(() => { setPage(0); }, [filter, debouncedSearch]);

  const events: AuditEvent[] = useMemo(() => {
    const out: AuditEvent[] = [];
    // Campaign transitions
    db.campaigns.forEach((c) => {
      const brand = db.brands.find((b) => b.id === c.brandId);
      c.history.forEach((h, i) => {
        out.push({
          id: `ct_${c.id}_${i}`,
          at: h.at,
          kind: 'transition',
          actor: db.users.find((u) => u.id === h.by)?.email || h.by,
          summary: `${brand?.name || 'Brand'} · ${c.title} → ${stageLabel(h.stage)}`,
          meta: `campaign_id=${c.id}`,
        });
      });
    });
    // Transactions
    db.transactions.forEach((t) => {
      const user = db.users.find((u) => u.id === t.userId);
      const counter = t.counterpartyUserId ? db.users.find((u) => u.id === t.counterpartyUserId) : null;
      out.push({
        id: `tx_${t.id}`,
        at: t.at,
        kind: t.kind as AuditEvent['kind'],
        actor: user?.email || t.userId,
        amount: t.amount,
        summary: t.note + (counter ? ` · ↔ ${counter.email}` : ''),
        meta: t.campaignId ? `campaign_id=${t.campaignId}` : undefined,
      });
    });
    out.sort((a, b) => +new Date(b.at) - +new Date(a.at));
    return out;
  }, [db]);

  const filtered = useMemo(() => events.filter((e) => {
    if (filter === 'campaigns' && e.kind !== 'transition') return false;
    if (filter === 'money' && e.kind === 'transition') return false;
    const q = debouncedSearch.trim().toLowerCase();
    if (q) {
      if (![e.summary, e.actor, e.meta || ''].join(' ').toLowerCase().includes(q)) return false;
    }
    return true;
  }), [events, filter, debouncedSearch]);

  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  return (
    <div className="page">
      <PageHead
        num="A · 04"
        label="Audit log"
        title={<>Audit <em>timeline</em>.</>}
        lede="Every campaign transition, escrow hold, release, and payout — derived from canonical store state. Append-only."
        actions={<Button variant="ghost" onClick={() => {
          // Phase 21: respect the maskEmails toggle in CSV export so
          // compliance shares can leave the screen with PII redacted.
          downloadCSV(`alamut-audit-${new Date().toISOString().slice(0, 10)}${maskEmails ? '-masked' : ''}`, filtered.map((e) => ({
            timestamp: e.at,
            kind: e.kind,
            actor: maskEmails ? maskEmail(e.actor) : e.actor,
            summary: maskEmails ? maskEmail(e.summary) : e.summary,
            amount: e.amount ?? '',
            meta: e.meta || '',
          })));
          pushToast(`Exported ${filtered.length} events${maskEmails ? ' (emails masked)' : ''}`, 'good');
        }}>Export CSV</Button>}
      />

      <div className="kpi-strip mb-24">
        <div><div className="kpi-k">Events · all time</div><div className="kpi-v">{events.length}</div><div className="kpi-d">since launch</div></div>
        <div><div className="kpi-k">Campaign transitions</div><div className="kpi-v">{events.filter((e) => e.kind === 'transition').length}</div></div>
        <div><div className="kpi-k">Money events</div><div className="kpi-v">{events.filter((e) => e.kind !== 'transition').length}</div></div>
        <div><div className="kpi-k">Last event</div><div className="kpi-v" style={{ fontSize: 18 }}>{events[0] ? fmtRelative(events[0].at) : '—'}</div></div>
      </div>

      <div className="toolbar">
        <div className="tabs">
          <button className={['tab', filter === 'all' ? 'is-on' : ''].join(' ')} onClick={() => setFilter('all')}>All</button>
          <button className={['tab', filter === 'campaigns' ? 'is-on' : ''].join(' ')} onClick={() => setFilter('campaigns')}>Campaign transitions</button>
          <button className={['tab', filter === 'money' ? 'is-on' : ''].join(' ')} onClick={() => setFilter('money')}>Money</button>
        </div>
        <div className="search">
          <Icon.search s={14} />
          <input placeholder="Search by summary, actor, campaign id…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        {/* Phase 21: mask-emails toggle for compliance-safe display + export. */}
        <button
          className={['chip', maskEmails ? 'is-on' : ''].join(' ')}
          onClick={() => setMaskEmails((v) => !v)}
          title="Mask emails to first 1-2 chars + ••@domain. Helps when sharing screenshots or CSVs."
          aria-pressed={maskEmails}
        >
          <Icon.lock s={11} /> {maskEmails ? 'Emails masked' : 'Mask emails'}
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="empty"><div className="empty-h">No events match</div></div>
      ) : (
        <section className="admin-tbl-tile tile">
          <div className="admin-tbl-h">
            <div>
              <div className="mono-meta">Audit log</div>
              <h2 className="home-tile-title">{filtered.length} event{filtered.length === 1 ? '' : 's'}.</h2>
            </div>
          </div>
          <table className="tbl">
            <thead><tr><th style={{ width: 120 }}>When</th><th style={{ width: 100 }}>Kind</th><th>Summary</th><th>Actor</th><th style={{ width: 120, textAlign: 'right' }}>Amount</th></tr></thead>
            <tbody>
              {paged.map((e) => (
                <tr key={e.id}>
                  <td className="mono-meta" title={fmtDate(e.at)}>{fmtRelative(e.at)}</td>
                  <td><Pill tone={e.kind === 'transition' ? 'info' : txTone(e.kind)}>{e.kind === 'transition' ? 'Transition' : txLabel(e.kind)}</Pill></td>
                  <td style={{ fontSize: 13 }}>
                    {maskEmails ? maskEmail(e.summary) : e.summary}
                    {e.meta && <div className="mono-meta" style={{ marginTop: 4, fontSize: 10 }}>{e.meta}</div>}
                  </td>
                  <td className="mono-meta">{maskEmails ? maskEmail(e.actor) : e.actor}</td>
                  <td style={{ textAlign: 'right', fontFamily: 'var(--mono)' }}>{e.amount !== undefined ? `${e.amount > 0 ? '+' : '−'}${fmtMoneyFull(Math.abs(e.amount))}` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {totalPages > 1 && (
            <div className="ledger-pagination">
              <Button size="sm" variant="ghost" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
                ← Previous
              </Button>
              <span className="mono-meta">
                Page {page + 1} of {totalPages} · {filtered.length} events
              </span>
              <Button size="sm" variant="ghost" disabled={page >= totalPages - 1} onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}>
                Next →
              </Button>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
