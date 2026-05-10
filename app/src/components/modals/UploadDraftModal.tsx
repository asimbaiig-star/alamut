// Creator-side: submit a draft for an in-production campaign.
import { useState } from 'react';
import { api } from '@/lib/api/client';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { pushToast } from '@/lib/utils/toast';
import type { Campaign } from '@/lib/api/types';

interface UploadDraftModalProps {
  open: boolean;
  onClose: () => void;
  campaign: Campaign;
  nextRound: number;
}

const STOCK_ASSETS = [
  { name: 'Reel.mp4', url: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=400&h=400&fit=crop&auto=format' },
  { name: 'Still 01', url: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=400&h=400&fit=crop&auto=format' },
  { name: 'Still 02', url: 'https://images.unsplash.com/photo-1509631179647-0177331693ae?w=400&h=400&fit=crop&auto=format' },
  { name: 'BTS 01', url: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=400&h=400&fit=crop&auto=format' },
  { name: 'Hero shot', url: 'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?w=400&h=400&fit=crop&auto=format' },
];

export function UploadDraftModal({ open, onClose, campaign, nextRound }: UploadDraftModalProps) {
  const [picked, setPicked] = useState<Record<number, boolean>>({ 0: true, 1: true });
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const files = STOCK_ASSETS.filter((_, i) => picked[i]);
    if (files.length === 0) { pushToast('Pick at least one file', 'bad'); return; }
    setBusy(true);
    try {
      await api.submissions.submit({ campaignId: campaign.id, round: nextRound, files, notes });
      pushToast(`Round ${nextRound} submitted — brand will review`, 'good');
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
      title={`Submit Round ${nextRound} · ${campaign.title}`}
      width={620}
      footer={<>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button onClick={submit} loading={busy} icon={<Icon.upload s={14} />}>Submit for review</Button>
      </>}
    >
      <div className="form-grid">
        <div className="field full">
          <label className="field-label">Files</label>
          <div className="approval-files">
            {STOCK_ASSETS.map((a, i) => (
              <button key={a.name} type="button" className="approval-file" style={{ backgroundImage: `url(${a.url})`, border: picked[i] ? '2px solid var(--ink)' : '2px solid transparent', cursor: 'pointer' }} onClick={() => setPicked((p) => ({ ...p, [i]: !p[i] }))}>
                <span className="approval-file-name">{picked[i] ? '✓ ' : ''}{a.name}</span>
              </button>
            ))}
          </div>
          <span className="field-help">Demo mode: pick from stock to simulate uploads. Real flow would use file storage.</span>
        </div>
        <div className="field full">
          <label className="field-label">Notes for the brand (optional)</label>
          <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything the reviewer should know about this round." />
        </div>
      </div>
    </Modal>
  );
}
