import { useState } from 'react';
import { api } from '@/lib/api/client';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { pushToast } from '@/lib/utils/toast';
import { useCapability } from '@/lib/permissions';
import type { Campaign, DisputeCategory } from '@/lib/api/types';

interface DisputeModalProps {
  open: boolean;
  onClose: () => void;
  campaign: Campaign;
  // Caller biases the category set — brand-side and creator-side see different
  // typical issues. Both sides' lists tap the same `DisputeCategory` enum.
  side: 'creator' | 'brand';
}

// P2 §1.4 — categories replaced the pre-P2 reason enum. Mapping:
//   creator: brand_no_approval → quality (brand stalling on review),
//            payment_issue → late-payment, rights_violation → content-takedown
//   brand:   creator_no_show → non-delivery, content_quality → quality,
//            rights_violation → content-takedown
const CATEGORIES_BY_SIDE: Record<'creator' | 'brand', { value: DisputeCategory; label: string; help: string }[]> = {
  creator: [
    { value: 'quality',           label: 'Brand isn\'t approving',  help: 'Submitted drafts but no decision after deadline.' },
    { value: 'late-payment',      label: 'Payment issue',           help: 'Payout overdue or not released after content went live.' },
    { value: 'content-takedown',  label: 'Brand violated rights',   help: 'Brand re-used content beyond agreed terms or ran ads without whitelist.' },
    { value: 'scope-creep',       label: 'Scope creep',             help: 'Brand keeps asking for work outside the original brief.' },
    { value: 'other',             label: 'Other',                   help: 'Anything else worth admin attention.' },
  ],
  brand: [
    { value: 'non-delivery',      label: 'Creator hasn\'t delivered', help: 'No drafts uploaded after deadline; no responses to messages.' },
    { value: 'quality',           label: 'Content doesn\'t match brief', help: 'Output significantly off-spec or below expected quality.' },
    { value: 'content-takedown',  label: 'Creator violated rights',     help: 'Worked with a competitor inside exclusivity window or other rights breach.' },
    { value: 'scope-creep',       label: 'Scope creep',                 help: 'Creator keeps pushing back on the brief or padding scope.' },
    { value: 'other',             label: 'Other',                       help: 'Anything else worth admin attention.' },
  ],
};

export function DisputeModal({ open, onClose, campaign, side }: DisputeModalProps) {
  const categories = CATEGORIES_BY_SIDE[side];
  const [category, setCategory] = useState<DisputeCategory>(categories[0].value);
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  // Both creators and brand admin/ops hold `dispute.raise`. Finance +
  // viewer team members see the modal but cannot file. Resolution is
  // separately gated under `dispute.resolve` in DisputeResolveModal.
  const canRaise = useCapability('dispute.raise');

  const submit = async () => {
    if (details.trim().length < 20) { pushToast('Please add at least 20 characters of detail', 'bad'); return; }
    setBusy(true);
    try {
      await api.disputes.open({ campaignId: campaign.id, category, description: details.trim() });
      pushToast('Dispute filed — admin will review', 'good');
      setDetails(''); setCategory(categories[0].value);
      onClose();
    } catch (e) {
      pushToast(e instanceof Error ? e.message : 'Could not file dispute', 'bad');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Open a dispute"
      width={580}
      footer={<>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button
          variant="danger"
          onClick={submit}
          loading={busy}
          disabled={details.trim().length < 20 || !canRaise}
          title={!canRaise ? 'Disputes require admin, ops, or creator role' : undefined}
          icon={<Icon.arrow s={14} />}
        >
          {canRaise ? 'File dispute' : 'Permission required'}
        </Button>
      </>}
    >
      <div style={{ background: 'var(--warn-bg)', padding: 12, borderRadius: 6, fontSize: 13, color: 'var(--ink-80)', marginBottom: 18 }}>
        <strong>This freezes escrow on this campaign</strong> until an admin reviews. Use only if you've already tried to resolve it with the other party.
      </div>

      <div className="mono-meta mb-8">Campaign</div>
      <div style={{ fontFamily: 'var(--serif)', fontSize: 22, marginBottom: 18 }}>{campaign.title}</div>

      <div className="field full mb-16">
        <label className="field-label">Category</label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
          {categories.map((r) => (
            <label key={r.value} style={{
              display: 'grid', gridTemplateColumns: '20px 1fr', gap: 10, padding: 12,
              border: '1px solid var(--rule)', borderRadius: 6,
              background: category === r.value ? 'color-mix(in oklab, var(--accent) 6%, var(--surface))' : 'var(--surface)',
              cursor: 'pointer',
            }}>
              <input type="radio" name="dispute-category" value={r.value} checked={category === r.value} onChange={() => setCategory(r.value)} style={{ width: 18, height: 18 }} />
              <div>
                <div style={{ fontSize: 14, fontWeight: 500 }}>{r.label}</div>
                <div className="text-ink-60" style={{ fontSize: 12, marginTop: 2 }}>{r.help}</div>
              </div>
            </label>
          ))}
        </div>
      </div>

      <div className="field full">
        <label className="field-label">Details (required, ≥20 characters)</label>
        <textarea
          rows={5}
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          placeholder="What happened, what you've already tried, what outcome you're asking for. The admin only sees this — be specific."
        />
        <span
          className="field-help"
          style={{ color: details.trim().length < 20 && details.length > 0 ? 'var(--accent)' : undefined }}
        >
          {details.trim().length < 20
            ? `${details.trim().length}/20 minimum characters`
            : 'Both parties will be notified. Admin reviews and can release funds, refund, or split.'}
        </span>
      </div>
    </Modal>
  );
}
