// BrandWallet.tsx — v2 brand-side wallet
//
// Mirrors the Claude Design handoff (Wallet in brand-comms.jsx):
// hero balance card (gradient ink→accent), ledger table, payment-
// methods sidebar, this-month rollup, top-up modal.

import { useEffect, useState } from 'react';
import { fmtUSD, fmtUSDfull, Icon } from '../lib';
import { HomeHead, MoneyStrip, dollars } from './homeParts';
import { LedgerList } from './walletParts';
import { useV2BrandWallet } from '../v2Hooks';
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
  // P5 gating — admin + finance hold `wallet.topup`. Ops + viewer see
  // the buttons but can't activate them. The button stays visible so
  // the user knows top-up exists; the disabled state + tooltip explains
  // why their role can't run it.
  const canTopup = useCapability('wallet.topup');
  void onRoute;

  // Ledger type filter — narrows the visible rows by type. 'all' keeps
  // every entry. The set of available types is derived from the live
  // ledger so the dropdown stays honest if the data shape evolves.


  const exportStatement = () => {
    const rows = W.ledgerAll ?? W.ledger;
    if (rows.length === 0) {
      pushToast('No wallet activity to export yet');
      return;
    }
    downloadCSV(
      `alamut-brand-statement-${new Date().toISOString().slice(0, 10)}`,
      rows.map((l) => ({ date: l.date, description: l.desc, status: l.status, amount: l.amount, type: l.type ?? '' })),
    );
    pushToast(`Statement exported · ${rows.length} rows`);
  };

  return (
    <>
      <div className="v2-hm">
        <div className="v2-hm-ground">
          <HomeHead
            title="Wallet"
            sub="Your balance, what’s held for creators, and every movement."
            actions={<button type="button" className="v2-hm-btn" onClick={exportStatement}>Download statement</button>}
          />
          <MoneyStrip
            label="Available to spend"
            figure={W.available}
            rows={[
              { label: 'Held for your creators', value: W.reserved },
              { label: 'Released this month', value: W.thisMonth.released },
            ]}
            action={
              <button
                type="button"
                className="v2-hm-btn is-fill"
                onClick={() => setShowTopup(true)}
                disabled={!canTopup}
                title={!canTopup ? 'Only admins and finance on your team can top up' : undefined}
              >Top up</button>
            }
          />
        </div>

        <div className="v2-hm-cols">
          <section aria-labelledby="wl-moves">
            <h2 className="v2-hm-h2" id="wl-moves">Every movement</h2>
            <LedgerList
              label="movements"
              entries={W.ledgerAll ?? W.ledger}
              filters={[
                { id: 'held', label: 'Held', test: (e) => e.type === 'reserve' },
                { id: 'released', label: 'Released', test: (e) => e.type === 'release' },
                { id: 'topup', label: 'Top-ups', test: (e) => e.type === 'topup' },
                { id: 'fee', label: 'Fees and rights', test: (e) => e.type === 'fee' },
              ]}
              emptyTitle="Nothing here yet."
              emptyBody="Top up to fund your first offer. Accepting an offer holds its full amount here until each post goes live."
            />
          </section>

          <aside className="v2-hm-right">
            <section className="v2-wl-card" aria-labelledby="wl-month">
              <span className="v2-wl-eyebrow" id="wl-month">This month</span>
              <div className="v2-hm-ledger">
                <div className="v2-hm-lrow"><span>Top-ups</span><b>{dollars(W.thisMonth.topups)}</b></div>
                <div className="v2-hm-lrow"><span>Released to creators</span><b>{dollars(W.thisMonth.released)}</b></div>
                <div className="v2-hm-lrow"><span>Platform fees to you</span><b>{dollars(W.thisMonth.fees)}</b></div>
              </div>
              <p>You pay the rate you agree. The platform fee comes off the creator’s side, never yours.</p>
              <button
                type="button"
                className="v2-hm-btn is-sm"
                onClick={() => {
                  // Every fee and withholding row in the full history, not the
                  // recent slice.
                  const taxRows = (W.ledgerAll ?? W.ledger)
                    .filter((l) => l.type === 'fee' || l.type === 'tax')
                    .map((l) => ({ date: l.date, description: l.desc, type: l.type ?? '', amount: l.amount }));
                  if (taxRows.length === 0) {
                    pushToast('No fee or withholding entries on this account yet');
                    return;
                  }
                  downloadCSV(`alamut-tax-report-${new Date().toISOString().slice(0, 10)}`, taxRows);
                  pushToast(`Tax report exported · ${taxRows.length} rows`);
                }}
              >Download tax report</button>
            </section>
            <section className="v2-wl-card" aria-labelledby="wl-methods">
              <span className="v2-wl-eyebrow" id="wl-methods">Top up from</span>
              {/* Seeded methods: there's no self-service add or remove yet
                  (it needs a real payment processor), so say who to ask. */}
              <div className="v2-wl-method"><i aria-hidden="true">WIRE</i><div><b>Wire transfer</b><small>Account ending 4291</small></div></div>
              <div className="v2-wl-method"><i aria-hidden="true">ACH</i><div><b>ACH</b><small>Account ending 8830</small></div></div>
              <div className="v2-wl-method"><i aria-hidden="true">CARD</i><div><b>Card</b><small>Ending 4242</small></div></div>
              <p>To add or remove a method, ask your account manager.</p>
            </section>
          </aside>
        </div>
      </div>

      {showTopup && <TopupModal onClose={() => setShowTopup(false)} />}
    </>
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
        card: 'Card payment',
      } as const)[method as 'wire' | 'ach' | 'card'] ?? 'Top-up';
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
    <div className="v2-modal-overlay" role="dialog" aria-modal="true" aria-label="Top up your wallet" onClick={onClose}>
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
