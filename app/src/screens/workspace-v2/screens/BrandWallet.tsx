// BrandWallet.tsx — v2 brand-side wallet
//
// Mirrors the Claude Design handoff (Wallet in brand-comms.jsx):
// hero balance card (gradient ink→accent), ledger table, payment-
// methods sidebar, this-month rollup, top-up modal.

import { useEffect, useMemo, useState } from 'react';
import { fmtUSD, fmtUSDfull, Icon, Topbar } from '../lib';
import { useV2BrandWallet, useV2CurrentBrand } from '../v2Hooks';
import { api } from '@/lib/api/client';
import { pushToast } from '@/lib/utils/toast';
import { downloadCSV } from '@/lib/utils/csv';
import { parseNumberInput } from '@/lib/utils/format';
import { useModalEscape } from '@/lib/utils/useModalEscape';
import { useCapability } from '@/lib/permissions';

interface Props {
  onRoute: (r: string) => void;
  /** When the route arrived as `wallet?action=topup` (BrandHome's
   *  "Needs you" tile direct-jump), pop the top-up modal on mount so
   *  the brand lands inside the action rather than on the wallet page
   *  they could reach via the sidebar. */
  initialAction?: 'topup';
}

export function BrandWallet({ onRoute, initialAction }: Props) {
  const [showTopup, setShowTopup] = useState(false);
  useEffect(() => {
    if (initialAction === 'topup') setShowTopup(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialAction]);
  const W = useV2BrandWallet();
  const brand = useV2CurrentBrand();
  // P5 gating — admin + finance hold `wallet.topup`. Ops + viewer see
  // the buttons but can't activate them. The button stays visible so
  // the user knows top-up exists; the disabled state + tooltip explains
  // why their role can't run it.
  const canTopup = useCapability('wallet.topup');
  void onRoute;

  // Ledger type filter — narrows the visible rows by type. 'all' keeps
  // every entry. The set of available types is derived from the live
  // ledger so the dropdown stays honest if the data shape evolves.
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const availableTypes = useMemo(
    () => Array.from(new Set(W.ledger.map((l) => l.type).filter((t): t is NonNullable<typeof t> => !!t))).sort(),
    [W.ledger],
  );
  const filteredLedger = useMemo(
    () => typeFilter === 'all' ? W.ledger : W.ledger.filter((l) => l.type === typeFilter),
    [W.ledger, typeFilter],
  );

  return (
    <>
      <Topbar
        title="Wallet"
        crumb={`${brand?.name ?? 'Brand'} · USD account`}
        actions={
          <>
            <button
              className="v2-btn v2-btn-outline"
              type="button"
              onClick={() => {
                downloadCSV(
                  `alamut-wallet-statement-${new Date().toISOString().slice(0, 10)}`,
                  // `ledgerAll`, not the 10-row display slice.
                  W.ledgerAll.map((l) => ({
                    date: l.date,
                    description: l.desc,
                    status: l.status,
                    amount: l.amount,
                    type: l.type ?? '',
                  })),
                );
                pushToast(`Wallet statement exported · ${W.ledgerAll.length} rows`);
              }}
            >
              Download statement
            </button>
            <button
              className="v2-btn v2-btn-accent"
              type="button"
              onClick={() => setShowTopup(true)}
              disabled={!canTopup}
              title={!canTopup ? 'Top-up requires admin or finance role' : undefined}
            >
              {Icon.plus}<span>{canTopup ? 'Top up' : 'Admin/finance only'}</span>
            </button>
          </>
        }
      />
      <div className="v2-content">
        {/* Hero balance card */}
        <div className="v2-wallet-hero">
          <div className="v2-wallet-hero-glow" aria-hidden="true" />
          <div className="v2-eyebrow" style={{ color: 'rgba(251,247,238,0.6)', marginBottom: 12 }}>
            Available balance
          </div>
          <div className="v2-wallet-hero-amount v2-tabular">
            {fmtUSDfull(W.available)}
          </div>
          <div className="v2-row v2-wallet-hero-stats">
            <div>
              <div className="v2-wallet-hero-stat-label">In escrow</div>
              <div className="v2-wallet-hero-stat-value v2-tabular">{fmtUSD(W.reserved)}</div>
            </div>
            <div>
              <div className="v2-wallet-hero-stat-label">In flight</div>
              <div className="v2-wallet-hero-stat-value v2-tabular">{fmtUSD(W.inFlight)}</div>
            </div>
            <span className="v2-spacer" />
            <button
              className="v2-btn"
              type="button"
              style={{ background: 'var(--v2-paper)', color: 'var(--v2-ink)' }}
              onClick={() => setShowTopup(true)}
              disabled={!canTopup}
              title={!canTopup ? 'Top-up requires admin or finance role' : undefined}
            >
              {Icon.plus}<span>{canTopup ? 'Top up wallet' : 'Admin/finance only'}</span>
            </button>
          </div>
        </div>

        <div className="v2-wallet-grid">
          {/* Ledger */}
          <div className="v2-card" style={{ overflow: 'hidden' }}>
            <div
              className="v2-card-pad"
              style={{ borderBottom: '1px solid var(--v2-line)' }}
            >
              <div className="v2-row" style={{ justifyContent: 'space-between' }}>
                <h3 className="v2-section-title" style={{ fontSize: 22, margin: 0 }}>
                  Recent activity
                </h3>
                <select
                  className="v2-select v2-btn-sm"
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  style={{
                    fontFamily: 'inherit', fontSize: 12.5,
                    padding: '4px 8px', borderRadius: 'var(--v2-r-pill)',
                    border: '1px solid var(--v2-line)',
                    background: 'var(--v2-paper)', color: 'var(--v2-ink-2)',
                  }}
                  aria-label="Filter ledger by type"
                >
                  <option value="all">All types ({W.ledger.length})</option>
                  {availableTypes.map((t) => (
                    <option key={t} value={t}>
                      {t} ({W.ledger.filter((l) => l.type === t).length})
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {/* Same as the creator ledger: no wrapper meant the whole
                page scrolled sideways on a narrow viewport. */}
            <div style={{ overflowX: 'auto' }}>
            <table className="v2-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Description</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {filteredLedger.map((l, i) => {
                  const isPositive = l.amount > 0;
                  const dotColor = isPositive
                    ? 'var(--v2-moss)'
                    : l.type === 'tax'
                      ? 'var(--v2-gold)'
                      : l.type === 'fee'
                        ? 'var(--v2-ink-3)'
                        : 'var(--v2-accent)';
                  return (
                    <tr key={i}>
                      <td className="v2-muted" style={{ fontSize: 12.5 }}>{l.date}</td>
                      <td>
                        <div className="v2-row" style={{ gap: 8 }}>
                          <span style={{
                            width: 4, height: 4, borderRadius: 2,
                            background: dotColor,
                          }} />
                          <span style={{ fontSize: 13.5 }}>{l.desc}</span>
                        </div>
                      </td>
                      <td>
                        <span className="v2-muted" style={{ fontSize: 12 }}>{l.status}</span>
                      </td>
                      <td
                        className="v2-tabular"
                        style={{
                          textAlign: 'right',
                          fontWeight: 550,
                          color: isPositive ? 'var(--v2-moss)' : 'var(--v2-ink)',
                        }}
                      >
                        {isPositive ? '+' : ''}{fmtUSD(l.amount).replace('$', '$')}
                      </td>
                    </tr>
                  );
                })}
                {filteredLedger.length === 0 && (
                  <tr>
                    <td colSpan={4} style={{ padding: '28px 16px', textAlign: 'center' }}>
                      <div style={{ fontSize: 13.5, marginBottom: 4 }}>
                        {W.ledger.length === 0 ? 'No wallet activity yet' : 'Nothing matches this filter'}
                      </div>
                      <div className="v2-muted" style={{ fontSize: 12.5, lineHeight: 1.5 }}>
                        {W.ledger.length === 0
                          ? 'Top-ups, escrow reserves, and creator payouts all appear here.'
                          : 'Pick a different type to see the rest of the ledger.'}
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            </div>
          </div>

          {/* Sidebar */}
          <div>
            <div className="v2-card v2-card-pad" style={{ marginBottom: 16 }}>
              <div className="v2-eyebrow" style={{ marginBottom: 12 }}>Top-up methods on file</div>
              {/* Methods shown are seed data — there's no self-service
                  add/remove flow yet (would need a real payment-
                  processor integration). Footnote sets accurate
                  expectations rather than implying an "Add method" CTA
                  that doesn't exist. */}
              <PaymentMethod name="Wire transfer" sub="Chase ••• 4291" color="#1B3D88" />
              <PaymentMethod name="ACH" sub="Bank ••• 8830" color="#00B14F" />
              <PaymentMethod name="JazzCash" sub="0345 ••• 4291" color="#F7941D" />
              <PaymentMethod name="Card on file" sub="Visa ending 4242" color="#635BFF" last />
              <p className="v2-muted" style={{ fontSize: 11.5, lineHeight: 1.5, marginTop: 10, marginBottom: 0 }}>
                To add, replace, or remove a method, contact your ops manager.
              </p>
            </div>

            <div className="v2-card v2-card-pad">
              <div className="v2-eyebrow" style={{ marginBottom: 8 }}>This month</div>
              {/* Pre-fix these four rows were hardcoded ($23k / $8.4k /
                  $890 / $445). They now sum the brand's cleared txns in
                  the current month, computed in `brandWalletV2`. The
                  withholding-tax row is removed because `Transaction.kind`
                  has no `'tax'` member — the seed never wrote that
                  category in the first place. */}
              <SidebarRow label="Top-ups" value={fmtUSD(W.thisMonth.topups)} />
              <SidebarRow label="Released to creators" value={fmtUSD(W.thisMonth.released)} />
              <SidebarRow label="Platform fees" value={fmtUSD(W.thisMonth.fees)} muted />
              {W.thisMonth.adSpend > 0 && (
                <SidebarRow label="Ad spend" value={fmtUSD(W.thisMonth.adSpend)} muted />
              )}
              <hr style={{ height: 1, background: 'var(--v2-line)', margin: '14px 0', border: 'none' }} />
              <button
                className="v2-btn v2-btn-outline"
                type="button"
                style={{ width: '100%', justifyContent: 'center' }}
                onClick={() => {
                  // Tax report = every fee + withholding row in the account's
                  // FULL history. This read the 10-row display slice, so the
                  // report covered whatever happened to be recent — and the
                  // "no entries in current ledger window" message quietly
                  // admitted it while still being labelled a tax report.
                  const taxRows = W.ledgerAll
                    .filter((l) => l.type === 'fee' || l.type === 'tax')
                    .map((l) => ({
                      date: l.date,
                      description: l.desc,
                      type: l.type ?? '',
                      amount: l.amount,
                    }));
                  if (taxRows.length === 0) {
                    pushToast('No fee or withholding entries on this account yet');
                    return;
                  }
                  downloadCSV(
                    `alamut-tax-report-${new Date().toISOString().slice(0, 10)}`,
                    taxRows,
                  );
                  pushToast(`Tax report exported · ${taxRows.length} rows`);
                }}
              >
                Download tax report
              </button>
            </div>
          </div>
        </div>
      </div>

      {showTopup && <TopupModal onClose={() => setShowTopup(false)} />}
    </>
  );
}

function SidebarRow({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="v2-row" style={{ justifyContent: 'space-between', marginBottom: 4, fontSize: 13 }}>
      <span className={muted ? 'v2-muted' : ''}>{label}</span>
      <span className={`v2-tabular ${muted ? 'v2-muted' : ''}`}>{value}</span>
    </div>
  );
}

function PaymentMethod({ name, sub, color, last }: {
  name: string; sub: string; color: string; last?: boolean;
}) {
  return (
    <div
      className="v2-row"
      style={{
        padding: '8px 0',
        borderBottom: last ? 'none' : '1px solid var(--v2-line)',
        gap: 10,
      }}
    >
      <div
        style={{
          width: 32, height: 32, borderRadius: 8,
          background: color, color: 'white',
          display: 'grid', placeItems: 'center',
          fontWeight: 700, fontSize: 11,
        }}
      >{name.slice(0, 2).toUpperCase()}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 550 }}>{name}</div>
        <div className="v2-muted" style={{ fontSize: 11 }}>{sub}</div>
      </div>
    </div>
  );
}

function TopupModal({ onClose }: { onClose: () => void }) {
  useModalEscape(onClose);
  const [method, setMethod] = useState('wire');
  const [amount, setAmount] = useState(5000);
  const [submitting, setSubmitting] = useState(false);
  // Modal opens through gated entry buttons in the parent, so the
  // submit gate is mostly defense-in-depth (e.g. role changes mid-
  // session). Same `wallet.topup` capability for consistency.
  const canTopup = useCapability('wallet.topup');

  // Pre-fix this modal's "Top up" submit just called onClose — brand
  // filled the form, clicked, nothing happened. `api.wallet.topUp`
  // exists and writes a real topup transaction + credits walletBalance;
  // wire to it. No real payment-processor integration (out of scope
  // for the prototype) — the transaction is the demo-relevant outcome.
  const handleSubmit = async () => {
    if (!canTopup || amount <= 0 || submitting) return;
    setSubmitting(true);
    try {
      const methodLabel = ({
        wire: 'Wire transfer',
        ach: 'ACH transfer',
        jazzcash: 'JazzCash',
        card: 'Card payment',
      } as const)[method as 'wire' | 'ach' | 'jazzcash' | 'card'] ?? 'Top-up';
      await api.wallet.topUp(amount, methodLabel);
      pushToast(`Top-up of ${fmtUSDfull(amount)} cleared · available now`, 'good');
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Top-up failed';
      pushToast(msg, 'bad');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="v2-modal-overlay" onClick={onClose}>
      <div
        className="v2-card v2-card-pad-lg v2-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{
          fontFamily: 'var(--v2-font-display)',
          fontSize: 26,
          fontWeight: 500,
          margin: '0 0 16px',
          letterSpacing: '-0.02em',
          color: 'var(--v2-ink)',
        }}>Top up wallet</h2>

        {/* Every money input in v2 rendered its label as a plain sibling
            <label> with no `htmlFor`, so a screen reader announced the
            field as an unnamed spin button. */}
        <label className="v2-eyebrow" htmlFor="v2-topup-amount" style={{ display: 'block', marginBottom: 6 }}>
          Amount
        </label>
        <div style={{ position: 'relative', marginBottom: 16 }}>
          <span style={{
            position: 'absolute',
            left: 14,
            top: '50%',
            transform: 'translateY(-50%)',
            color: 'var(--v2-ink-3)',
          }}>$</span>
          <input
            id="v2-topup-amount"
            type="number"
            value={amount}
            onChange={(e) => setAmount(parseNumberInput(e.target.value, { min: 0 }))}
            className="v2-input"
            style={{
              paddingLeft: 28,
              fontSize: 22,
              fontWeight: 500,
              padding: '14px 14px 14px 28px',
            }}
          />
        </div>
        <div className="v2-row" style={{ gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
          {[1000, 5000, 10000, 25000].map((n) => (
            <button
              key={n}
              type="button"
              className="v2-btn v2-btn-sm v2-btn-outline"
              onClick={() => setAmount(n)}
            >+ {fmtUSD(n)}</button>
          ))}
        </div>

        <label className="v2-eyebrow" style={{ display: 'block', marginBottom: 6 }}>
          Pay with
        </label>
        <div className="v2-col" style={{ gap: 8, marginBottom: 20 }}>
          {[
            ['wire',     'Wire transfer',   'T+1 settlement · 0% fee',     '#1B3D88'],
            ['ach',      'ACH (US bank)',   '2–3 business days · 0% fee',  '#00B14F'],
            ['jazzcash', 'JazzCash',        'Instant · 0% fee · PK',       '#F7941D'],
            ['card',     'Debit / Credit',  'Instant · 1.5% fee',          '#635BFF'],
          ].map(([id, label, sub, color]) => {
            const isOn = method === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setMethod(id as string)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '12px 14px',
                  border: `1px solid ${isOn ? 'var(--v2-ink)' : 'var(--v2-line)'}`,
                  borderRadius: 'var(--v2-r-md)',
                  background: isOn ? 'var(--v2-bg-2)' : 'var(--v2-paper)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontFamily: 'inherit',
                }}
              >
                <div style={{
                  width: 32, height: 32, borderRadius: 8,
                  background: color as string, color: 'white',
                  display: 'grid', placeItems: 'center',
                  fontWeight: 700, fontSize: 11,
                }}>{(label as string).slice(0, 2).toUpperCase()}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600 }}>{label}</div>
                  <div className="v2-muted" style={{ fontSize: 11.5 }}>{sub}</div>
                </div>
                {isOn && (
                  <span style={{ color: 'var(--v2-ink)', display: 'flex' }}>{Icon.check}</span>
                )}
              </button>
            );
          })}
        </div>

        <div className="v2-row" style={{ justifyContent: 'flex-end', gap: 8 }}>
          <button className="v2-btn v2-btn-ghost" type="button" onClick={onClose}>Cancel</button>
          <button
            className="v2-btn v2-btn-primary"
            type="button"
            onClick={handleSubmit}
            disabled={!canTopup || amount <= 0 || submitting}
            title={!canTopup ? 'Top-up requires admin or finance role' : undefined}
          >
            {!canTopup ? 'Admin/finance only' : submitting ? 'Processing…' : `Top up ${fmtUSDfull(amount)}`}
          </button>
        </div>
      </div>
    </div>
  );
}
