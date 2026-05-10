// Income advance — Stripe-Capital-style. Borrow up to 80% of pending escrow at a 3% fee.
// Auto-repays from the next payouts that clear.
import { useState, useMemo } from 'react';
import { useStore } from '@/lib/api/store';
import { useAuth } from '@/lib/auth/useAuth';
import { api } from '@/lib/api/client';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { fmtMoneyFull } from '@/lib/utils/format';
import { pushToast } from '@/lib/utils/toast';

interface RequestAdvanceModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const LTV = 0.80;
const FEE_PCT = 0.03;

export function RequestAdvanceModal({ open, onClose, onSuccess }: RequestAdvanceModalProps) {
  const { creator } = useAuth();
  const db = useStore((s) => s.db);
  const [amount, setAmount] = useState(0);
  const [busy, setBusy] = useState(false);

  const activeAdvance = useMemo(() => {
    if (!creator) return null;
    return db.advances.find((a) => a.creatorId === creator.id && a.status === 'active');
  }, [db.advances, creator]);

  if (!creator) return null;

  const maxAvailable = Math.floor(creator.pendingBalance * LTV);
  const fee = Math.round(amount * FEE_PCT);
  const netToWallet = amount - fee;
  const valid = amount >= 100 && amount <= maxAvailable && !activeAdvance;

  const submit = async () => {
    if (!valid) return;
    setBusy(true);
    try {
      await api.advances.request(amount);
      pushToast(`Advance approved — ${fmtMoneyFull(netToWallet)} cleared to your wallet`, 'good');
      onSuccess?.();
      onClose();
      setAmount(0);
    } catch (e) {
      pushToast(e instanceof Error ? e.message : 'Advance failed', 'bad');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Request income advance"
      width={560}
      footer={<>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button onClick={submit} loading={busy} disabled={!valid} icon={<Icon.arrow s={14} />}>
          Disburse {amount > 0 ? fmtMoneyFull(netToWallet) : ''}
        </Button>
      </>}
    >
      {activeAdvance ? (
        <div style={{ padding: 18, background: 'var(--paper-2)', borderRadius: 6 }}>
          <div className="mono-meta mb-8">Existing advance · active</div>
          <div style={{ fontSize: 14, lineHeight: 1.55 }}>
            You already have an active advance of <strong>{fmtMoneyFull(activeAdvance.amount)}</strong>.
            It auto-repays from your next payouts ({fmtMoneyFull(activeAdvance.repaidAmount)} of {fmtMoneyFull(activeAdvance.amount)} repaid so far).
            Once it clears, you can request another.
          </div>
          <div style={{ marginTop: 12, height: 6, background: 'var(--paper)', borderRadius: 999, overflow: 'hidden' }}>
            <div style={{ width: `${(activeAdvance.repaidAmount / activeAdvance.amount) * 100}%`, height: '100%', background: 'var(--accent)' }} />
          </div>
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, padding: 14, background: 'var(--paper-2)', borderRadius: 6, marginBottom: 18 }}>
            <div>
              <div className="mono-meta">In escrow</div>
              <div style={{ fontFamily: 'var(--serif)', fontSize: 22, marginTop: 4 }}>{fmtMoneyFull(creator.pendingBalance)}</div>
            </div>
            <div>
              <div className="mono-meta">Max advance</div>
              <div style={{ fontFamily: 'var(--serif)', fontSize: 22, marginTop: 4, color: 'var(--accent)' }}>{fmtMoneyFull(maxAvailable)}</div>
              <div className="mono-meta" style={{ fontSize: 10 }}>80% LTV</div>
            </div>
            <div>
              <div className="mono-meta">Platform fee</div>
              <div style={{ fontFamily: 'var(--serif)', fontSize: 22, marginTop: 4 }}>3%</div>
              <div className="mono-meta" style={{ fontSize: 10 }}>flat</div>
            </div>
          </div>

          <div className="form-grid">
            <div className="field full">
              <label className="field-label">Amount to advance</label>
              <input
                type="number"
                min={100}
                max={maxAvailable}
                step={100}
                value={amount || ''}
                onChange={(e) => setAmount(Number(e.target.value))}
                placeholder={`Up to ${fmtMoneyFull(maxAvailable)}`}
                autoFocus
              />
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                {[0.25, 0.5, 0.75, 1].map((p) => (
                  <button
                    key={p}
                    type="button"
                    className="tab"
                    onClick={() => setAmount(Math.floor(maxAvailable * p / 100) * 100)}
                  >
                    {p === 1 ? 'Max' : `${p * 100}%`}
                  </button>
                ))}
              </div>
              {amount > 0 && amount > maxAvailable && (
                <span className="field-help" style={{ color: 'var(--bad)' }}>Exceeds 80% LTV. Max: {fmtMoneyFull(maxAvailable)}.</span>
              )}
              {amount > 0 && amount < 100 && (
                <span className="field-help" style={{ color: 'var(--bad)' }}>Minimum advance is $100.</span>
              )}
            </div>

            {amount >= 100 && amount <= maxAvailable && (
              <div className="field full">
                <div style={{ padding: 14, background: 'color-mix(in oklch, var(--accent) 6%, var(--paper-2))', borderRadius: 6, fontSize: 13 }}>
                  <div className="mono-meta mb-12">Disbursement</div>
                  <div className="row-between" style={{ marginBottom: 6 }}>
                    <span>Advance amount</span>
                    <span style={{ fontFamily: 'var(--mono)' }}>{fmtMoneyFull(amount)}</span>
                  </div>
                  <div className="row-between" style={{ marginBottom: 6, color: 'var(--ink-60)' }}>
                    <span>Platform fee (3%)</span>
                    <span style={{ fontFamily: 'var(--mono)' }}>− {fmtMoneyFull(fee)}</span>
                  </div>
                  <div className="row-between" style={{ paddingTop: 10, marginTop: 10, borderTop: '1px solid var(--rule)', fontWeight: 500 }}>
                    <span>Cleared to wallet</span>
                    <span style={{ fontFamily: 'var(--mono)' }}>{fmtMoneyFull(netToWallet)}</span>
                  </div>
                </div>
              </div>
            )}

            <div className="field full">
              <div style={{ fontSize: 12, color: 'var(--ink-60)', lineHeight: 1.5 }}>
                <strong>How repayment works.</strong> Your next payouts (from campaigns currently in escrow) automatically deduct toward this advance until it's fully repaid.
                You don't owe anything outside of payouts that clear. If a campaign is disputed and refunded, the advance stays open against future earnings.
              </div>
            </div>
          </div>
        </>
      )}
    </Modal>
  );
}
