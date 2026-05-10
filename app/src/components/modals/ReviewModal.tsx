import { useState } from 'react';
import { api } from '@/lib/api/client';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { pushToast } from '@/lib/utils/toast';
import { useCapability } from '@/lib/permissions';
import type { Campaign } from '@/lib/api/types';

interface ReviewModalProps {
  open: boolean;
  onClose: () => void;
  campaign: Campaign;
  reviewType: 'creator' | 'brand'; // creator = brand reviewing creator; brand = creator reviewing brand
  targetId: string;
  targetName: string;
}

export function ReviewModal({ open, onClose, campaign, reviewType, targetId, targetName }: ReviewModalProps) {
  const [rating, setRating] = useState(5);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  // Both creators (writing about a brand) and brand admin/ops (writing
  // about a creator) hold `review.write`. Finance + viewer team members
  // see the modal but the submit is gated.
  const canWrite = useCapability('review.write');

  const submit = async () => {
    if (!text.trim()) { pushToast('Add a few words explaining your rating', 'bad'); return; }
    setBusy(true);
    try {
      await api.reviews.leave({ campaignId: campaign.id, reviewType, targetId, rating, text: text.trim() });
      pushToast('Review submitted', 'good');
      setText(''); setRating(5);
      onClose();
    } catch (e) {
      pushToast(e instanceof Error ? e.message : 'Submit failed', 'bad');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Review · ${targetName}`}
      width={520}
      footer={<>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button
          onClick={submit}
          loading={busy}
          disabled={!text.trim() || !canWrite}
          title={!canWrite ? 'Reviews require admin, ops, or creator role' : undefined}
          icon={<Icon.check s={14} />}
        >
          {canWrite ? 'Submit review' : 'Permission required'}
        </Button>
      </>}
    >
      <div className="mono-meta mb-8">Campaign</div>
      <div style={{ fontFamily: 'var(--serif)', fontSize: 22, marginBottom: 18 }}>{campaign.title}</div>

      <div className="form-grid">
        <div className="field full">
          <label className="field-label">Your rating</label>
          <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setRating(n)}
                style={{
                  fontSize: 36,
                  color: n <= rating ? 'var(--accent)' : 'var(--ink-40)',
                  lineHeight: 1,
                  padding: '4px 8px',
                  borderRadius: 4,
                  transition: 'color 0.12s',
                }}
                aria-label={`${n} stars`}
              >★</button>
            ))}
          </div>
          <span className="field-help">{
            rating === 5 ? 'Outstanding — would book/work with again immediately' :
            rating === 4 ? 'Solid — recommend, with one or two notes' :
            rating === 3 ? 'OK — got the job done but rough edges' :
            rating === 2 ? 'Disappointing — would think twice' :
                           'Wouldn\'t work with again'
          }</span>
        </div>
        <div className="field full">
          <label className="field-label">Public review (visible on {reviewType === 'creator' ? 'creator' : 'brand'} profile)</label>
          <textarea
            rows={5}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={reviewType === 'creator'
              ? "What was it like working with this creator? Their professionalism, output, communication."
              : "What was it like working with this brand? Brief clarity, payment timing, communication."}
            autoFocus
          />
          <span className="field-help">Reviews can't be edited once submitted. Be honest, be specific.</span>
        </div>
      </div>
    </Modal>
  );
}
