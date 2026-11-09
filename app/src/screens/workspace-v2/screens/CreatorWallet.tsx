// CreatorWallet.tsx — v2 creator-side wallet
//
// Creator-flavored wallet: available · pending · lifetime stat strip,
// ledger of cleared payouts + withdrawals, withdraw flow modal.

import { useState } from 'react';
import { fmtUSDfull } from '../lib';
import { HomeHead, MoneyStrip, dollars } from './homeParts';
import { LedgerList } from './walletParts';
import { PLATFORM_FEE_LABEL, WHT_LABEL } from '@/lib/api/money';
import { useV2CreatorWallet, useV2CurrentCreator, v2RequestWithdrawal, v2CanWithdraw, withdrawalRejectionMessage } from '../v2Hooks';
import { useStore } from '@/lib/api/store';
import { api } from '@/lib/api/client';
import { pushToast } from '@/lib/utils/toast';
import { downloadCSV } from '@/lib/utils/csv';
import { parseNumberInput } from '@/lib/utils/format';
import { useModalEscape } from '@/lib/utils/useModalEscape';

interface Props {
  onRoute: (r: string) => void;
  /** `creator-wallet?action=withdraw` (the home's Withdraw) opens the form. */
  initialAction?: 'withdraw';
}

export function CreatorWallet({ onRoute, initialAction }: Props) {
  const [showWithdraw, setShowWithdraw] = useState(initialAction === 'withdraw');
  const [showAdvance, setShowAdvance] = useState(false);
  const W = useV2CreatorWallet();
  const creator = useV2CurrentCreator();
  const db = useStore((s) => s.db);
  // Raw DB Creator (the V2 adapter strips `payout`). We read it to drive
  // the Payout method sidebar block — pre-fix that block displayed a
  // hardcoded "Bank transfer · Account ending 4291" for everyone,
  // including creators with no bank account on file yet.
  const dbCreator = creator ? db.creators.find((c) => c.id === creator.id) : undefined;
  const payoutAccount = dbCreator?.payout?.account?.trim() || '';
  const payoutMethod = dbCreator?.payout?.method?.trim() || '';
  const hasPayoutAccount = payoutAccount.length > 0;
  const payoutLast4 = hasPayoutAccount
    ? payoutAccount.replace(/\s+/g, '').slice(-4)
    : '';
  const activeAdvance = creator
    ? db.advances?.find((a) => a.creatorId === creator.id && a.status === 'active')
    : undefined;
  const advanceCapacity = creator
    ? Math.floor(creator.pendingBalance * 0.8)
    : 0;
  const canRequestAdvance = !!creator && !activeAdvance && advanceCapacity >= 100;

  const exportStatement = () => {
    const rows = W.ledgerAll ?? W.ledger;
    if (rows.length === 0) {
      pushToast('No wallet activity to export yet');
      return;
    }
    downloadCSV(
      `alamut-creator-statement-${new Date().toISOString().slice(0, 10)}`,
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
            sub="Money from your deals, after fees, and where it goes."
            actions={<button type="button" className="v2-hm-btn" onClick={exportStatement}>Download statement</button>}
          />
          <MoneyStrip
            label="Ready to withdraw"
            figure={W.available}
            tone="moss"
            rows={[
              { label: 'Held in escrow for your deals', value: W.pending },
              // Gross: what deals paid before the fee and withholding rows.
              { label: 'Earned so far, before fees', value: W.lifetime },
            ]}
            action={
              <button type="button" className="v2-hm-btn is-fill" onClick={() => setShowWithdraw(true)} disabled={W.available === 0}>
                Withdraw
              </button>
            }
          />
        </div>

        <div className="v2-hm-cols">
          <section aria-labelledby="wl-moves">
            <h2 className="v2-hm-h2" id="wl-moves">Money in and out</h2>
            <LedgerList
              label="movements"
              entries={W.ledgerAll ?? W.ledger}
              filters={[
                { id: 'in', label: 'Released to you', test: (e) => e.amount > 0 },
                { id: 'fees', label: 'Fees and tax', test: (e) => e.type === 'fee' || e.type === 'tax' },
                // Withdrawals are payouts out of the wallet: negative, not fees.
                { id: 'out', label: 'Withdrawals', test: (e) => e.amount < 0 && e.type === 'release' },
              ]}
              emptyTitle="Nothing here yet."
              emptyBody="When a brand confirms a post, its share lands here after fees, with the fee and withholding as their own lines."
            />
          </section>

          <aside className="v2-hm-right">
            <section className="v2-wl-card" aria-labelledby="wl-method">
              <span className="v2-wl-eyebrow" id="wl-method">Paid out to</span>
              {hasPayoutAccount ? (
                <div className="v2-wl-method">
                  <i aria-hidden="true">{(payoutMethod || 'Bank').slice(0, 4).toUpperCase()}</i>
                  <div><b>Bank account ending {payoutLast4}</b><small>Withdrawals arrive in 1–2 business days</small></div>
                </div>
              ) : (
                <div className="v2-wl-method">
                  <i aria-hidden="true">+</i>
                  <div><b>No bank account yet</b><small>Add one before your first withdrawal</small></div>
                </div>
              )}
              <button type="button" className="v2-hm-btn is-sm" onClick={() => onRoute('kyc')}>
                {hasPayoutAccount ? 'Change in KYC & Tax' : 'Add one in KYC & Tax'}
              </button>
            </section>

            <section className="v2-wl-card" aria-labelledby="wl-fees">
              <span className="v2-wl-eyebrow" id="wl-fees">How fees work</span>
              <div className="v2-hm-ledger">
                <div className="v2-hm-lrow"><span>Platform fee</span><b>{PLATFORM_FEE_LABEL}</b></div>
                <div className="v2-hm-lrow"><span>Withholding tax</span><b>{WHT_LABEL}</b></div>
              </div>
              <p>Both come off each release, never off what you withdraw. Withdrawals are free. Formal tax certificates aren’t issued yet; the statement lists every deduction.</p>
            </section>

            {canRequestAdvance && (
              <section className="v2-wl-card" aria-labelledby="wl-adv">
                <span className="v2-wl-eyebrow" id="wl-adv">Advance</span>
                <p>Borrow up to {dollars(advanceCapacity)} against money held in escrow. 3% fee, repaid automatically as your posts release.</p>
                <button type="button" className="v2-hm-btn is-sm" onClick={() => setShowAdvance(true)}>Request an advance</button>
              </section>
            )}
          </aside>
        </div>
      </div>

      {showWithdraw && (
        <WithdrawModal
          available={W.available}
          payoutLabel={
            hasPayoutAccount
              ? `${payoutMethod || 'Bank'} ending ${payoutLast4}`
              : 'No bank account on file'
          }
          onClose={() => setShowWithdraw(false)}
          onConfirm={(amount) => {
            // Pre-check via v2CanWithdraw so the user sees a SPECIFIC
            // failure reason (KYC not done, no bank, dispute window
            // still open) instead of a generic "Withdrawal failed".
            const check = v2CanWithdraw(amount);
            if (!check.ok) {
              pushToast(withdrawalRejectionMessage(check.reason), 'bad');
              return;
            }
            const ok = v2RequestWithdrawal(amount);
            if (ok) {
              pushToast(`Withdrawal of $${amount.toLocaleString()} initiated · 1–2 business days to your bank`);
              setShowWithdraw(false);
            } else {
              pushToast('Withdrawal failed — please try again', 'bad');
            }
          }}
        />
      )}
      {showAdvance && creator && (
        <AdvanceModal
          pendingBalance={creator.pendingBalance}
          maxAdvance={advanceCapacity}
          onClose={() => setShowAdvance(false)}
          onConfirm={async (amount) => {
            try {
              await api.advances.request(amount);
              pushToast(`Advance of $${amount.toLocaleString()} disbursed · auto-repays from next payout`, 'good');
              setShowAdvance(false);
            } catch (err) {
              pushToast(err instanceof Error ? err.message : 'Could not request advance', 'bad');
            }
          }}
        />
      )}
    </>
  );
}

function AdvanceModal({ pendingBalance, maxAdvance, onClose, onConfirm }: {
  pendingBalance: number;
  maxAdvance: number;
  onClose: () => void;
  onConfirm: (amount: number) => Promise<void>;
}) {
  useModalEscape(onClose);
  const [amount, setAmount] = useState<number>(Math.min(maxAdvance, 1000));
  const [busy, setBusy] = useState(false);
  const fee = Math.round(amount * 0.03);
  const net = amount - fee;
  const valid = amount >= 100 && amount <= maxAdvance && !busy;

  async function submit() {
    if (!valid) return;
    setBusy(true);
    try {
      await onConfirm(amount);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="v2-modal-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div
        className="v2-card v2-card-pad-lg v2-modal"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 480 }}
      >
        <h2 style={{
          fontFamily: 'var(--v2-font-display)', fontSize: 22, fontWeight: 500,
          margin: '0 0 6px', letterSpacing: '-0.02em',
        }}>Request an advance</h2>
        <p className="v2-muted" style={{ margin: '0 0 14px', fontSize: 13 }}>
          Borrow against pending escrow on accepted offers. 3% flat fee, repays automatically from your next payouts. Max is 80% of pending balance.
        </p>
        <div style={{ marginBottom: 16, padding: 12, background: 'var(--v2-bg-1)', borderRadius: 'var(--v2-r-md)', fontSize: 12.5 }}>
          <div className="v2-row" style={{ justifyContent: 'space-between', marginBottom: 4 }}>
            <span className="v2-muted">In escrow (pending)</span>
            <span className="v2-tabular">{fmtUSDfull(pendingBalance)}</span>
          </div>
          <div className="v2-row" style={{ justifyContent: 'space-between' }}>
            <span className="v2-muted">Max advance (80%)</span>
            <span className="v2-tabular">{fmtUSDfull(maxAdvance)}</span>
          </div>
        </div>
        <label className="v2-eyebrow" htmlFor="v2-advance-amount" style={{ display: 'block', marginBottom: 6 }}>Amount (USD)</label>
        <div className="v2-onboarding-rate" style={{ marginBottom: 12 }}>
          <span className="v2-onboarding-rate-prefix">$</span>
          <input
            id="v2-advance-amount"
            type="number"
            value={amount}
            min={100}
            max={maxAdvance}
            onChange={(e) => setAmount(parseNumberInput(e.target.value, { min: 0, max: maxAdvance }))}
          />
        </div>
        <div style={{ marginBottom: 16, fontSize: 12.5 }}>
          <div className="v2-row" style={{ justifyContent: 'space-between', marginBottom: 2 }}>
            <span className="v2-muted">3% fee</span>
            <span className="v2-tabular">−{fmtUSDfull(fee)}</span>
          </div>
          <div className="v2-row" style={{ justifyContent: 'space-between', fontWeight: 600 }}>
            <span>Net to wallet</span>
            <span className="v2-tabular">{fmtUSDfull(net)}</span>
          </div>
        </div>
        <div className="v2-row" style={{ justifyContent: 'flex-end', gap: 8 }}>
          <button className="v2-btn v2-btn-ghost" type="button" onClick={onClose} disabled={busy}>Cancel</button>
          <button
            className="v2-btn v2-btn-primary"
            type="button"
            disabled={!valid}
            onClick={submit}
          >{busy ? 'Processing…' : `Disburse ${fmtUSDfull(net)}`}</button>
        </div>
      </div>
    </div>
  );
}

function WithdrawModal({ available, payoutLabel, onClose, onConfirm }: {
  available: number;
  /** Display label for the destination bank — e.g. "ACH · Chase ••• 4421".
   *  Pre-fix this modal hardcoded "Bank ending 4291" regardless of the
   *  creator's actual account, contradicting the wallet sidebar which
   *  reads `creator.payout.account` correctly. */
  payoutLabel: string;
  onClose: () => void;
  onConfirm: (amount: number) => void;
}) {
  useModalEscape(onClose);
  // P5 capability gap (Tier 2 follow-up):
  //   The capability matrix has `wallet.withdraw` (brand-side) but no
  //   creator-side equivalent — creators withdraw their earnings via
  //   their implicit creator role, not through a named capability.
  //   When manager-acting-on-behalf-of-creator lands (Tier 4 managed
  //   accounts), add `creator.payout` and gate this modal with it.
  //   For now the gate is a no-op; the creator role itself is the gate.
  const [amount, setAmount] = useState(available);

  return (
    <div className="v2-modal-overlay" role="dialog" aria-modal="true" aria-label="Withdraw to your bank" onClick={onClose}>
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

        <label className="v2-eyebrow" htmlFor="v2-withdraw-amount" style={{ display: 'block', marginBottom: 6 }}>
          Amount
        </label>
        <div style={{ position: 'relative', marginBottom: 12 }}>
          <span style={{
            position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
            color: 'var(--v2-ink-3)',
          }}>$</span>
          <input
            id="v2-withdraw-amount"
            type="number"
            value={amount}
            onChange={(e) => setAmount(parseNumberInput(e.target.value, { min: 0, max: available }))}
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
            <span style={{ fontWeight: 600 }}>{payoutLabel}</span>
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
