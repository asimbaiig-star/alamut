// CreatorWallet.tsx — v2 creator-side wallet
//
// Creator-flavored wallet: available · pending · lifetime stat strip,
// ledger of cleared payouts + withdrawals, withdraw flow modal.

import { useState } from 'react';
import { fmtUSD, fmtUSDfull, Icon, Topbar } from '../lib';
import { useV2CreatorWallet, useV2CurrentCreator, v2RequestWithdrawal } from '../v2Hooks';
import { pushToast } from '@/lib/utils/toast';
import { downloadCSV } from '@/lib/utils/csv';

interface Props {
  onRoute: (r: string) => void;
}

export function CreatorWallet({ onRoute }: Props) {
  const [showWithdraw, setShowWithdraw] = useState(false);
  const W = useV2CreatorWallet();
  const creator = useV2CurrentCreator();

  return (
    <>
      <Topbar
        title="Wallet"
        crumb={`${creator?.name ?? 'Creator'} · USD account`}
        actions={
          <button
            className="v2-btn v2-btn-accent"
            type="button"
            onClick={() => setShowWithdraw(true)}
            disabled={W.available === 0}
          >
            {Icon.send}<span>Withdraw</span>
          </button>
        }
      />
      <div className="v2-content">
        {/* Hero balance card — moss-gradient variant per the design.
            The brand wallet uses the terracotta ink→accent gradient
            (money flowing OUT to creators); the creator wallet uses
            moss green (money flowing IN as earnings). Both share
            the same shape so the wallet pattern reads consistently. */}
        <div className="v2-wallet-hero is-creator" style={{ marginBottom: 24 }}>
          <div className="v2-wallet-hero-glow" aria-hidden="true" />
          <div className="v2-eyebrow" style={{ color: 'rgba(251,247,238,0.6)', marginBottom: 12 }}>
            Available to withdraw
          </div>
          <div className="v2-wallet-hero-amount v2-tabular">{fmtUSDfull(W.available)}</div>
          <div className="v2-row v2-wallet-hero-stats">
            <div>
              <div className="v2-wallet-hero-stat-label">In escrow</div>
              <div className="v2-wallet-hero-stat-value v2-tabular">{fmtUSD(W.pending)}</div>
            </div>
            <div>
              <div className="v2-wallet-hero-stat-label">Lifetime earned</div>
              <div className="v2-wallet-hero-stat-value v2-tabular">{fmtUSD(W.lifetime)}</div>
            </div>
            <span className="v2-spacer" />
            <button
              className="v2-btn"
              type="button"
              style={{ background: 'var(--v2-paper)', color: 'var(--v2-ink)' }}
              onClick={() => setShowWithdraw(true)}
              disabled={W.available === 0}
            >
              {Icon.send}<span>Withdraw to bank</span>
            </button>
          </div>
        </div>

        <div className="v2-wallet-grid">
          {/* Ledger */}
          <div className="v2-card" style={{ overflow: 'hidden' }}>
            <div className="v2-card-pad" style={{ borderBottom: '1px solid var(--v2-line)' }}>
              <h3 className="v2-section-title" style={{ fontSize: 22, margin: 0 }}>Recent payouts</h3>
              <p className="v2-muted" style={{ margin: '6px 0 0', fontSize: 13 }}>
                Net amount lands in your wallet after platform fee + tax. Withholding handled per-deal.
              </p>
            </div>
            <table className="v2-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Description</th>
                  <th style={{ textAlign: 'right' }}>Gross</th>
                  <th style={{ textAlign: 'right' }}>Fee</th>
                  <th style={{ textAlign: 'right' }}>Net</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {W.ledger.map((l, i) => {
                  const isPositive = l.amount > 0;
                  return (
                    <tr key={i}>
                      <td className="v2-muted" style={{ fontSize: 12.5 }}>{l.date}</td>
                      <td style={{ fontSize: 13.5 }}>{l.desc}</td>
                      <td className="v2-tabular v2-muted" style={{ textAlign: 'right', fontSize: 12.5 }}>
                        {l.gross != null ? fmtUSD(l.gross) : '—'}
                      </td>
                      <td className="v2-tabular v2-muted" style={{ textAlign: 'right', fontSize: 12.5 }}>
                        {l.fee != null ? fmtUSD(l.fee) : '—'}
                      </td>
                      <td
                        className="v2-tabular"
                        style={{
                          textAlign: 'right',
                          fontWeight: 600,
                          color: isPositive ? 'var(--v2-moss)' : 'var(--v2-ink)',
                        }}
                      >
                        {isPositive ? '+' : ''}{fmtUSD(l.amount)}
                      </td>
                      <td>
                        <span
                          className={`v2-pill ${l.status === 'Paid' ? 'v2-pill-moss' : 'v2-pill-draft'}`}
                          style={{ fontSize: 10.5 }}
                        >
                          {l.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Sidebar */}
          <div>
            <div className="v2-card v2-card-pad" style={{ marginBottom: 16 }}>
              <div className="v2-eyebrow" style={{ marginBottom: 12 }}>Payout method</div>
              <div className="v2-row" style={{ gap: 10 }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 8,
                  background: '#1B3D88', color: 'white',
                  display: 'grid', placeItems: 'center',
                  fontWeight: 700, fontSize: 12,
                }}>BA</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600 }}>Bank transfer</div>
                  <div className="v2-muted" style={{ fontSize: 11.5 }}>Account ending 4291</div>
                </div>
                <button
                  className="v2-btn v2-btn-sm v2-btn-ghost"
                  type="button"
                  onClick={() => onRoute('kyc')}
                  title="Manage payout methods in KYC settings"
                >
                  Edit
                </button>
              </div>
              <hr style={{ height: 1, background: 'var(--v2-line)', margin: '12px 0', border: 'none' }} />
              <p className="v2-muted" style={{ fontSize: 12, lineHeight: 1.5, margin: 0 }}>
                Add wire, ACH, JazzCash, or Easypaisa as a backup payout rail in your KYC settings.
              </p>
            </div>

            <div className="v2-card v2-card-pad">
              <div className="v2-eyebrow" style={{ marginBottom: 8 }}>Tax docs</div>
              <p className="v2-muted" style={{ fontSize: 12.5, lineHeight: 1.5, margin: '0 0 12px' }}>
                Tax certificates auto-generated quarterly. We deduct withholding on each payout.
              </p>
              <button
                className="v2-btn v2-btn-outline"
                type="button"
                style={{ width: '100%', justifyContent: 'center' }}
                onClick={() => {
                  if (W.ledger.length === 0) {
                    pushToast('No wallet activity to export yet');
                    return;
                  }
                  downloadCSV(
                    `alamut-creator-statement-${new Date().toISOString().slice(0, 10)}`,
                    W.ledger.map((l) => ({
                      date: l.date,
                      description: l.desc,
                      status: l.status,
                      amount: l.amount,
                      type: l.type ?? '',
                    })),
                  );
                  pushToast(`Statement exported · ${W.ledger.length} rows`);
                }}
              >
                Download statement
              </button>
            </div>
          </div>
        </div>
      </div>

      {showWithdraw && (
        <WithdrawModal
          available={W.available}
          onClose={() => setShowWithdraw(false)}
          onConfirm={(amount) => {
            const ok = v2RequestWithdrawal(amount);
            if (ok) {
              pushToast(`Withdrawal of $${amount.toLocaleString()} initiated · 1–2 business days to your bank`);
              setShowWithdraw(false);
            } else {
              pushToast('Withdrawal failed — check amount and try again');
            }
          }}
        />
      )}
    </>
  );
}

function WithdrawModal({ available, onClose, onConfirm }: {
  available: number;
  onClose: () => void;
  onConfirm: (amount: number) => void;
}) {
  // P5 capability gap (Tier 2 follow-up):
  //   The capability matrix has `wallet.withdraw` (brand-side) but no
  //   creator-side equivalent — creators withdraw their earnings via
  //   their implicit creator role, not through a named capability.
  //   When manager-acting-on-behalf-of-creator lands (Tier 4 managed
  //   accounts), add `creator.payout` and gate this modal with it.
  //   For now the gate is a no-op; the creator role itself is the gate.
  const [amount, setAmount] = useState(available);

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
          margin: '0 0 6px',
          letterSpacing: '-0.02em',
          color: 'var(--v2-ink)',
        }}>Withdraw to bank</h2>
        <p className="v2-muted" style={{ margin: '0 0 16px', fontSize: 13 }}>
          Funds typically arrive in 1–2 business days. No fee on withdrawals.
        </p>

        <label className="v2-eyebrow" style={{ display: 'block', marginBottom: 6 }}>
          Amount
        </label>
        <div style={{ position: 'relative', marginBottom: 12 }}>
          <span style={{
            position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
            color: 'var(--v2-ink-3)',
          }}>$</span>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(parseInt(e.target.value || '0'))}
            max={available}
            className="v2-input"
            style={{ paddingLeft: 28, fontSize: 22, fontWeight: 500, padding: '14px 14px 14px 28px' }}
          />
        </div>
        <div className="v2-muted" style={{ fontSize: 12, marginBottom: 16 }}>
          Available: {fmtUSDfull(available)} · {' '}
          <button
            type="button"
            onClick={() => setAmount(available)}
            style={{ background: 'none', border: 'none', color: 'var(--v2-accent)', fontWeight: 600, cursor: 'pointer', padding: 0, fontFamily: 'inherit', fontSize: 12 }}
          >
            Withdraw max
          </button>
        </div>

        <div style={{ padding: 14, background: 'var(--v2-bg-2)', borderRadius: 'var(--v2-r-md)', marginBottom: 20 }}>
          <div className="v2-row" style={{ justifyContent: 'space-between', fontSize: 13 }}>
            <span className="v2-muted">Withdrawing</span>
            <span className="v2-tabular" style={{ fontWeight: 600 }}>{fmtUSDfull(amount)}</span>
          </div>
          <div className="v2-row" style={{ justifyContent: 'space-between', fontSize: 13, marginTop: 4 }}>
            <span className="v2-muted">To</span>
            <span style={{ fontWeight: 600 }}>Bank ending 4291</span>
          </div>
          <div className="v2-row" style={{ justifyContent: 'space-between', fontSize: 13, marginTop: 4 }}>
            <span className="v2-muted">Estimated arrival</span>
            <span style={{ fontWeight: 600 }}>1–2 business days</span>
          </div>
        </div>

        <div className="v2-row" style={{ justifyContent: 'flex-end', gap: 8 }}>
          <button className="v2-btn v2-btn-ghost" type="button" onClick={onClose}>Cancel</button>
          <button
            className="v2-btn v2-btn-primary"
            type="button"
            disabled={amount <= 0 || amount > available}
            onClick={() => onConfirm(amount)}
          >
            Confirm withdrawal
          </button>
        </div>
      </div>
    </div>
  );
}
