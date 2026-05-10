// Bulk invite — sends an offer per selected creator into a brand-owned campaign.
import { useState } from 'react';
import { useStore } from '@/lib/api/store';
import { useAuth } from '@/lib/auth/useAuth';
import { api, select } from '@/lib/api/client';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { fmtMoneyFull } from '@/lib/utils/format';
import { pushToast } from '@/lib/utils/toast';
import { stageLabel } from '@/lib/utils/labels';
import { useCapability } from '@/lib/permissions';

interface InviteModalProps {
  open: boolean;
  onClose: () => void;
  creatorIds: string[];
  onSent?: () => void;
}

export function InviteModal({ open, onClose, creatorIds, onSent }: InviteModalProps) {
  const { brand } = useAuth();
  const db = useStore((s) => s.db);
  const [campaignId, setCampaignId] = useState('');
  const [rate, setRate] = useState(1500);
  const [message, setMessage] = useState('We loved your work and would love you on this campaign — terms below, accept and we hold escrow.');
  const [busy, setBusy] = useState(false);

  if (!brand) return null;

  // Bulk invite fires `api.offers.send` per creator, so the gate is
  // `offer.send` — admin + ops on the brand team. Finance + viewer
  // see the modal but cannot complete the action.
  const canSend = useCapability('offer.send');

  const campaigns = select.campaignsByBrand(db, brand.id).filter((c) => !['closed', 'reporting'].includes(c.stage));
  const selected = campaigns.find((c) => c.id === campaignId);
  const totalEscrow = rate * creatorIds.length;
  const enoughBalance = brand.walletBalance >= totalEscrow;

  const sendAll = async () => {
    if (!campaignId) { pushToast('Pick a campaign', 'bad'); return; }
    if (!creatorIds.length) { pushToast('No creators selected', 'bad'); return; }
    setBusy(true);
    try {
      for (const cid of creatorIds) {
        await api.offers.send({ campaignId, creatorId: cid, rate, message });
      }
      pushToast(`Sent ${creatorIds.length} offer${creatorIds.length === 1 ? '' : 's'}`, 'good');
      onSent?.();
      onClose();
    } catch (e) {
      pushToast(e instanceof Error ? e.message : 'Send failed', 'bad');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Invite ${creatorIds.length} creator${creatorIds.length === 1 ? '' : 's'} to a campaign`}
      width={620}
      footer={<>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button
          onClick={sendAll}
          loading={busy}
          icon={<Icon.arrow s={14} />}
          disabled={!campaignId || !enoughBalance || !canSend}
          title={!canSend ? 'Sending offers requires admin or ops role' : undefined}
        >
          {canSend ? 'Send offers' : 'Admin/ops only'}
        </Button>
      </>}
    >
      <div className="form-grid">
        <div className="field full">
          <label className="field-label">Campaign</label>
          {campaigns.length === 0 ? (
            <div className="text-ink-60" style={{ fontSize: 13 }}>You have no open campaigns. Create one first from the Campaigns screen.</div>
          ) : (
            <select value={campaignId} onChange={(e) => setCampaignId(e.target.value)} style={{ background: 'var(--surface)', border: '1px solid var(--rule)', borderRadius: 4, padding: '10px 12px' }}>
              <option value="">— pick a campaign —</option>
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>{c.title} · {stageLabel(c.stage)} · budget {fmtMoneyFull(c.budget)}</option>
              ))}
            </select>
          )}
        </div>

        <div className="field full">
          <label className="field-label">Rate per creator (USD)</label>
          <input type="number" min={100} step={100} value={rate} onChange={(e) => setRate(Number(e.target.value))} />
          <span className="field-help">
            Total escrow: <strong>{fmtMoneyFull(totalEscrow)}</strong> · Wallet balance: <strong>{fmtMoneyFull(brand.walletBalance)}</strong>
            {!enoughBalance && <span className="text-bad"> · Not enough balance — top up first.</span>}
          </span>
        </div>

        <div className="field full">
          <label className="field-label">Message to creators</label>
          <textarea rows={4} value={message} onChange={(e) => setMessage(e.target.value)} />
        </div>

        {selected && (
          <div className="field full">
            <div style={{ background: 'var(--paper-2)', padding: 14, borderRadius: 6, fontSize: 13, color: 'var(--ink-80)' }}>
              <div className="mono-meta mb-8">Brief preview</div>
              <div style={{ marginBottom: 6 }}><strong>{selected.title}</strong> — {selected.deliverablesText}</div>
              <div>{selected.brief}</div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
