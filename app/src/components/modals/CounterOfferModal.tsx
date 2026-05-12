import { useState } from 'react';
import { api } from '@/lib/api/client';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { fmtMoneyFull } from '@/lib/utils/format';
import { pushToast } from '@/lib/utils/toast';
import type { Offer, Campaign } from '@/lib/api/types';

interface CounterOfferModalProps {
  open: boolean;
  onClose: () => void;
  offer: Offer;
  campaign: Campaign;
}

export function CounterOfferModal({ open, onClose, offer, campaign }: CounterOfferModalProps) {
  // Creator counters UP by 10% by default (matches CounterOfferModal in
  // WorkflowModals.tsx). Rounded to nearest $50 so the suggestion looks
  // like a reasonable negotiation step, not arithmetic noise.
  const [rate, setRate] = useState(
    Math.round((offer.rate * 1.1) / 50) * 50 || Math.round(offer.rate * 1.1),
  );
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!message.trim()) { pushToast('Add a short note explaining your counter', 'bad'); return; }
    if (rate <= 0) { pushToast('Counter rate must be positive', 'bad'); return; }
    setBusy(true);
    try {
      await api.offers.counter(offer.id, rate, message.trim());
      pushToast(`Counter sent: ${fmtMoneyFull(rate)}`, 'good');
      onClose();
    } catch (e) {
      pushToast(e instanceof Error ? e.message : 'Counter failed', 'bad');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Counter the offer"
      width={560}
      footer={<>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button onClick={submit} loading={busy} disabled={!message.trim() || rate <= 0} icon={<Icon.arrow s={14} />}>Send counter</Button>
      </>}
    >
      <div style={{ background: 'var(--paper-2)', padding: 14, borderRadius: 6, marginBottom: 18 }}>
        <div className="mono-meta mb-8">Original offer</div>
        <div style={{ fontFamily: 'var(--serif)', fontSize: 22 }}>{fmtMoneyFull(offer.rate)} for {campaign.title}</div>
        <div className="text-ink-80" style={{ fontSize: 13, marginTop: 8 }}>{offer.message}</div>
      </div>

      <div className="form-grid">
        <div className="field full">
          <label className="field-label">Your counter rate (USD)</label>
          <input type="number" min={100} step={100} value={rate} onChange={(e) => setRate(Number(e.target.value))} autoFocus />
          <span className="field-help">
            {rate > offer.rate ? `Asking +${fmtMoneyFull(rate - offer.rate)} above the original` :
             rate < offer.rate ? `Below original — usually for scope changes` : 'Same as original'}
          </span>
        </div>
        <div className="field full">
          <label className="field-label">Your note (required)</label>
          <textarea
            rows={4}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="e.g. Happy to do this — but I'd want to bump to $2,200 to cover the second still day. Everything else looks good."
          />
          <span className="field-help">Brand will see this alongside your counter rate. Be direct.</span>
        </div>
      </div>
    </Modal>
  );
}
