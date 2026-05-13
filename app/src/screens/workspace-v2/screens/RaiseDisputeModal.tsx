// RaiseDisputeModal — minimal category + description form.
//
// Wired into the StageActionBanner so v2RaiseDispute is reachable from
// v2. Sets `Collaboration.escrowFrozen` so v2ApproveContent refuses to
// release escrow until the dispute resolves. Standalone component so
// the form validation + dispatch is testable in isolation via RTL.
//
// Contract:
//   - User picks a category from the 6-option dropdown.
//   - Types a description ≥ 20 characters.
//   - Submit calls `onSubmit(category, description)` with trimmed text.
//   - Parent owns the side effects (v2RaiseDispute, toast, close).

import { useState } from 'react';
import type { DisputeCategory } from '@/lib/api/types';

const DISPUTE_CATEGORIES: { value: DisputeCategory; label: string }[] = [
  { value: 'non-delivery',     label: 'Brand stopped responding' },
  { value: 'scope-creep',      label: 'Brand changing scope after accept' },
  { value: 'late-payment',     label: 'Payment delayed beyond agreed' },
  { value: 'quality',          label: 'Disagreement on quality / acceptance' },
  { value: 'content-takedown', label: 'Content takedown / rights issue' },
  { value: 'other',            label: 'Something else' },
];

export interface RaiseDisputeModalProps {
  brandName: string;
  campaignName: string;
  onClose: () => void;
  onSubmit: (category: DisputeCategory, description: string) => void;
}

export function RaiseDisputeModal({
  brandName, campaignName, onClose, onSubmit,
}: RaiseDisputeModalProps) {
  const [category, setCategory] = useState<DisputeCategory>('non-delivery');
  const [description, setDescription] = useState('');
  const canSubmit = description.trim().length >= 20;
  return (
    <div
      className="v2-modal-overlay"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="v2-card v2-card-pad-lg v2-modal"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 520 }}
      >
        <h2 style={{
          fontFamily: 'var(--v2-font-display)', fontSize: 22, fontWeight: 500,
          margin: '0 0 6px', letterSpacing: '-0.02em',
        }}>Raise a dispute</h2>
        <p className="v2-muted" style={{ margin: '0 0 14px', fontSize: 13 }}>
          Filing a dispute on {campaignName} with {brandName} freezes the
          escrow while admin reviews. Use this only after trying to resolve
          via inbox first.
        </p>
        <label className="v2-eyebrow" style={{ display: 'block', marginBottom: 6 }}>Reason</label>
        <select
          className="v2-input"
          value={category}
          onChange={(e) => setCategory(e.target.value as DisputeCategory)}
          style={{ width: '100%', marginBottom: 14, fontFamily: 'inherit' }}
        >
          {DISPUTE_CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
        <label className="v2-eyebrow" style={{ display: 'block', marginBottom: 6 }}>What happened?</label>
        <textarea
          className="v2-input"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Walk admin through what went wrong. Include dates, what was promised vs. delivered, and any context you'd want a reviewer to know. (≥20 characters)"
          rows={6}
          style={{ width: '100%', fontFamily: 'inherit', fontSize: 13.5, padding: 10, marginBottom: 14 }}
        />
        <div className="v2-row" style={{ justifyContent: 'flex-end', gap: 8 }}>
          <button className="v2-btn v2-btn-ghost" type="button" onClick={onClose}>Cancel</button>
          <button
            className="v2-btn v2-btn-primary"
            type="button"
            disabled={!canSubmit}
            onClick={() => onSubmit(category, description.trim())}
          >File dispute</button>
        </div>
      </div>
    </div>
  );
}
