// DisputeResolveModal — extracted from admin/Disputes (Phase 30).
//
// Admin's resolution form for an open dispute. Used from:
//   - The Disputes table (admin/Disputes.tsx) on "Resolve" button
//   - The deal page's admin-flavoured banner (Deal.tsx) on
//     onResolveDispute, so admin can resolve in place without
//     bouncing to /admin/queue?type=disputes.
//
// Money math validation rules (from Phase 19):
//   * release + refund must equal campaign.escrowHeld
//   * "For creator" → release = full escrow, refund = 0
//   * "For brand"   → release = 0, refund = full escrow
//   * "Split"       → both > 0
//   * Note must be 10+ characters

import { useEffect, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Pill } from '@/components/ui/Pill';
import { Icon } from '@/components/ui/Icon';
import { PresenceBanner } from '@/components/ui/PresenceBanner';
import { usePresence } from '@/lib/utils/usePresence';
import { useAuth } from '@/lib/auth/useAuth';
import { useStore } from '@/lib/api/store';
import { api } from '@/lib/api/client';
import { fmtMoneyFull, fmtRelative } from '@/lib/utils/format';
import { pushToast } from '@/lib/utils/toast';
import { DISPUTE_CATEGORY_LABEL, disputeStatusLabel, disputeStatusTone } from '@/lib/utils/labels';
import type { Campaign, Dispute, DisputeStatus } from '@/lib/api/types';
// P7 — gate the Resolve button by `dispute.resolve` capability (admin
// roles `super` and `disputes` only). The mutation throws via P5's
// `requireCapability`; this is the UI-side disabled state.
import { useCapability } from '@/lib/permissions';

// P2 §1.4 — resolution status enum collapsed to three explicit money-path
// variants. The pre-P2 names (`resolved_for_brand` etc.) are mapped by
// migrator 5 to the new ones below.
type ResolutionType = Extract<DisputeStatus, 'resolved-refund' | 'resolved-release' | 'resolved-partial'>;

/** P7 — Resolve footer is its own component so we can read the
 *  capability hook without refactoring the parent's hook order. */
function ResolveFooter({
  note, busy, resolve, onClose,
}: {
  note: string;
  busy: boolean;
  resolve: () => void;
  onClose: () => void;
}) {
  const canResolve = useCapability('dispute.resolve');
  return (
    <>
      <Button variant="ghost" onClick={onClose}>Close</Button>
      <Button
        onClick={resolve}
        loading={busy}
        disabled={note.trim().length < 10 || !canResolve}
        icon={<Icon.check s={14} />}
        title={!canResolve ? 'Admin only — dispute resolution is gated by AdminRole' : undefined}
      >
        {canResolve ? 'Resolve' : 'Admin only'}
      </Button>
    </>
  );
}

interface Props {
  open: boolean;
  onClose: () => void;
  dispute: Dispute;
  campaign: Campaign;
  /** Optional callback after a successful resolve (e.g. parent refresh). */
  onResolved?: () => void;
}

export function DisputeResolveModal({ open, onClose, dispute, campaign, onResolved }: Props) {
  const { user } = useAuth();
  const db = useStore((s) => s.db);

  const [resolutionType, setResolutionType] = useState<ResolutionType>('resolved-partial');
  const [note, setNote] = useState('');
  const [releaseAmount, setReleaseAmount] = useState(0);
  const [refundAmount, setRefundAmount] = useState(0);
  const [busy, setBusy] = useState(false);

  // Phase 22-style cross-tab presence — warn the operator if another
  // admin is currently looking at the same dispute. Same key shape as
  // AdminDisputes uses, so warnings are shared across surfaces.
  const isPending = dispute.status === 'open' || dispute.status === 'in-review';
  const otherViewers = usePresence(
    open && isPending ? `dispute:${dispute.id}` : null,
    user?.email || 'admin',
    'reviewing',
  );

  // Reset form when the modal opens with a new dispute (or re-opens).
  useEffect(() => {
    if (!open) return;
    const held = campaign.escrowHeld;
    const half = Math.round(held / 2);
    setResolutionType('resolved-partial');
    setReleaseAmount(half);
    setRefundAmount(held - half);
    setNote('');
  }, [open, dispute.id, campaign.escrowHeld]);

  // Display-name lookup for filer / against (admin sees emails as
  // identifiers; matches the Disputes table style).
  const userName = (uid: string) => {
    const u = db.users.find((x) => x.id === uid);
    if (!u) return uid;
    if (u.creatorId) return db.creators.find((c) => c.id === u.creatorId)?.name || u.email;
    if (u.brandId) return db.brands.find((b) => b.id === u.brandId)?.name || u.email;
    return u.email;
  };

  const pickDecision = (next: ResolutionType) => {
    setResolutionType(next);
    const held = campaign.escrowHeld;
    if (next === 'resolved-release') { setReleaseAmount(held); setRefundAmount(0); }
    else if (next === 'resolved-refund') { setReleaseAmount(0); setRefundAmount(held); }
    else { setReleaseAmount(Math.round(held / 2)); setRefundAmount(held - Math.round(held / 2)); }
  };

  const resolve = async () => {
    if (note.trim().length < 10) {
      pushToast('Add a resolution note (10+ chars)', 'bad');
      return;
    }
    const held = campaign.escrowHeld;
    const total = releaseAmount + refundAmount;
    if (releaseAmount < 0 || refundAmount < 0) {
      pushToast('Amounts cannot be negative', 'bad');
      return;
    }
    if (total !== held) {
      pushToast(
        `Release + refund (${fmtMoneyFull(total)}) must equal escrow held (${fmtMoneyFull(held)})`,
        'bad',
      );
      return;
    }
    if (resolutionType === 'resolved-release' && releaseAmount !== held) {
      pushToast('"For creator" must release the full escrow to the creator', 'bad');
      return;
    }
    if (resolutionType === 'resolved-refund' && refundAmount !== held) {
      pushToast('"For brand" must refund the full escrow to the brand', 'bad');
      return;
    }
    if (resolutionType === 'resolved-partial' && (releaseAmount === 0 || refundAmount === 0)) {
      pushToast('"Split" requires non-zero amounts on both sides', 'bad');
      return;
    }

    setBusy(true);
    try {
      await api.disputes.resolve(dispute.id, {
        status: resolutionType,
        note: note.trim(),
        releaseAmount: releaseAmount || undefined,
        refundAmount: refundAmount || undefined,
      });
      pushToast('Dispute resolved', 'good');
      onResolved?.();
      onClose();
    } catch (e) {
      pushToast(e instanceof Error ? e.message : 'Resolve failed', 'bad');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Dispute · ${campaign.title}`}
      width={760}
      footer={
        isPending ? (
          <ResolveFooter note={note} busy={busy} resolve={resolve} onClose={onClose} />
        ) : (
          <Button variant="ghost" onClick={onClose}>Close</Button>
        )
      }
    >
      <div>
        {/* Phase 22 presence — guard against double-resolve from two admins. */}
        <PresenceBanner viewers={otherViewers} />

        <div style={{ background: 'var(--paper-2)', padding: 14, borderRadius: 6, marginBottom: 18 }}>
          <div className="row-between mb-8">
            <Pill>{DISPUTE_CATEGORY_LABEL[dispute.category]}</Pill>
            <Pill tone={disputeStatusTone(dispute.status)}>{disputeStatusLabel(dispute.status)}</Pill>
          </div>
          <div className="mono-meta">Raised by {userName(dispute.raisedByUserId)} · {fmtRelative(new Date(dispute.raisedAt).toISOString())} ({dispute.raisedByRole})</div>
          <div className="mono-meta mt-8">
            Campaign · {campaign.title} · escrow {fmtMoneyFull(campaign.escrowHeld)}
          </div>
        </div>

        <div className="mono-meta mb-8">Filer's account</div>
        <div style={{
          fontSize: 14, lineHeight: 1.6, padding: 14, border: '1px solid var(--rule)',
          borderRadius: 6, background: 'var(--surface)', marginBottom: 18,
        }}>
          {dispute.description}
        </div>

        {isPending ? (
          <div>
            <div className="mono-meta mb-16">Resolution</div>

            <div className="form-grid">
              <div className="field full">
                <label className="field-label">Decision</label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className={['tab', resolutionType === 'resolved-release' ? 'is-on' : ''].join(' ')}
                    onClick={() => pickDecision('resolved-release')}
                  >For creator</button>
                  <button
                    type="button"
                    className={['tab', resolutionType === 'resolved-partial' ? 'is-on' : ''].join(' ')}
                    onClick={() => pickDecision('resolved-partial')}
                  >Split</button>
                  <button
                    type="button"
                    className={['tab', resolutionType === 'resolved-refund' ? 'is-on' : ''].join(' ')}
                    onClick={() => pickDecision('resolved-refund')}
                  >For brand</button>
                </div>
              </div>
              <div className="field">
                <label className="field-label">Release to creator (USD)</label>
                <input
                  type="number"
                  min={0}
                  max={campaign.escrowHeld}
                  step={50}
                  value={releaseAmount}
                  onChange={(e) => setReleaseAmount(Number(e.target.value))}
                />
              </div>
              <div className="field">
                <label className="field-label">Refund to brand (USD)</label>
                <input
                  type="number"
                  min={0}
                  max={campaign.escrowHeld}
                  step={50}
                  value={refundAmount}
                  onChange={(e) => setRefundAmount(Number(e.target.value))}
                />
              </div>
              <div className="field full">
                <label className="field-label">
                  Resolution note (≥10 chars, visible to both parties)
                </label>
                <textarea
                  rows={4}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Reasoning for the call. Both parties will see this."
                />
              </div>
            </div>
          </div>
        ) : dispute.resolution ? (
          <div>
            <div className="mono-meta mb-8">Resolution · {fmtRelative(new Date(dispute.resolution.at).toISOString())}</div>
            <div style={{
              fontSize: 14, padding: 14, border: '1px solid var(--rule)',
              borderRadius: 6, background: 'var(--surface)',
            }}>
              {dispute.resolution.note}
            </div>
            <div style={{ display: 'flex', gap: 18, marginTop: 14, fontSize: 13 }}>
              <div>
                Released to creator: <strong>{fmtMoneyFull(dispute.resolution.releaseAmount || 0)}</strong>
              </div>
              <div>
                Refunded to brand: <strong>{fmtMoneyFull(dispute.resolution.refundAmount || 0)}</strong>
              </div>
            </div>
            <div className="mono-meta mt-8">Resolved by {userName(dispute.resolution.by)}</div>
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
