// OfferModal — extracted from brand/CampaignDetail (Phase 27).
//
// First-offer modal: rate + message + AI rate suggestion (Phase 17).
// Used from:
//   - The new brand campaign roster page (Phase 27): "Send offer" inline
//     button on shortlisted rows, plus the ?action=offer&creator=X deep
//     link consumed from the deal page's onSendOffer handler.
//   - The CreatorProfileDrawer's "Send offer" button (existing flow).
//
// Phase 27 stays compatible with the existing CampaignDetail until that
// file is deleted in Phase 29.

import { useEffect, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { api } from '@/lib/api/client';
import { useStore } from '@/lib/api/store';
import { useAuth } from '@/lib/auth/useAuth';
import { suggestRate } from '@/lib/utils/ai-helpers';
import { fmtMoneyFull } from '@/lib/utils/format';
import { pushToast } from '@/lib/utils/toast';
import type { Campaign } from '@/lib/api/types';

interface Props {
  open: boolean;
  onClose: () => void;
  campaign: Campaign;
  /** Creator the offer is for; null closes the modal in the caller. */
  creatorId: string | null;
  /** Optional callback after a successful send (e.g., toast or navigate). */
  onSent?: () => void;
}

export function OfferModal({ open, onClose, campaign, creatorId, onSent }: Props) {
  const db = useStore((s) => s.db);
  const { brand } = useAuth();
  const [rate, setRate] = useState(1500);
  const [message, setMessage] = useState(
    'Loved your work — escrow held on accept, post by deadline.',
  );
  const [busy, setBusy] = useState(false);

  // Reset rate to suggested or fallback when target creator changes.
  // Phase 27 QA fix: depend on stable id keys instead of the brand/db
  // object refs (which mutate on every store tick) to avoid effect thrash.
  useEffect(() => {
    if (!creatorId || !brand) return;
    const target = db.creators.find((c) => c.id === creatorId);
    if (!target) return;
    const suggestion = suggestRate(target, campaign, brand, db);
    setRate(suggestion?.recommended ?? 1500);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [creatorId, campaign.id, brand?.id]);

  if (!brand) return null;
  const targetCreator = creatorId ? db.creators.find((c) => c.id === creatorId) : undefined;
  const suggestion = targetCreator ? suggestRate(targetCreator, campaign, brand, db) : null;

  const send = async () => {
    if (!creatorId) return;
    setBusy(true);
    try {
      await api.offers.send({ campaignId: campaign.id, creatorId, rate, message });
      pushToast('Offer sent', 'good');
      onSent?.();
      onClose();
    } catch (e) {
      pushToast(e instanceof Error ? e.message : 'Could not send offer', 'bad');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Send offer to ${targetCreator?.name || 'creator'}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={send} loading={busy} icon={<Icon.arrow s={14} />}>
            Send offer
          </Button>
        </>
      }
    >
      <div className="form-grid">
        {suggestion && (
          <div className="field full">
            <div className="ai-pricing">
              <div className="ai-pricing-h">
                <span className="ai-pricing-icon"><Icon.spark s={12} /></span>
                <span className="mono-meta">
                  AI rate suggestion · {suggestion.confidence} confidence
                </span>
              </div>
              <div className="ai-pricing-amount">
                <button
                  type="button"
                  className="ai-pricing-pill"
                  onClick={() => setRate(suggestion.recommended)}
                  title={`Apply ${fmtMoneyFull(suggestion.recommended)}`}
                >
                  {fmtMoneyFull(suggestion.recommended)}
                </button>
                <span className="ai-pricing-band">
                  Range {fmtMoneyFull(suggestion.lower)} – {fmtMoneyFull(suggestion.upper)}
                </span>
              </div>
              <div className="ai-pricing-reasons mono-meta">
                {suggestion.reasons.join(' · ')}
              </div>
            </div>
          </div>
        )}
        <div className="field full">
          <label className="field-label">Rate (USD)</label>
          <input
            type="number"
            min={100}
            step={100}
            value={rate}
            onChange={(e) => setRate(Number(e.target.value))}
          />
          <span className="field-help">
            50% will be held in escrow on accept; 50% on post live.
          </span>
        </div>
        <div className="field full">
          <label className="field-label">Message</label>
          <textarea
            rows={4}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
        </div>
      </div>
    </Modal>
  );
}
