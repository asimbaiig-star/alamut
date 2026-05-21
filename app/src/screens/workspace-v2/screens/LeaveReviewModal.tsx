// LeaveReviewModal — minimal 1-5 star + textarea review form.
//
// Wired into the paid-stage banner on CollabDetail so v2LeaveReview is
// reachable from the v2 surface (it was a dead helper pre-fix). Kept
// as a standalone component so it's testable in isolation via RTL.
//
// Contract:
//   - User picks a star rating (1-5) and types a note ≥ 10 chars.
//   - Submit calls `onSubmit(rating, text)` with the trimmed text.
//   - The parent owns the side effects (toast, v2LeaveReview call).

import { useState } from 'react';

export interface LeaveReviewModalProps {
  /** Name of the entity being reviewed. Creator-side reviews pass the
   *  brand name; brand-side reviews pass the creator name. */
  subjectName: string;
  /** Type of subject — used to tailor the copy. Defaults to 'brand'
   *  so the existing creator-side call sites keep working unchanged. */
  subjectKind?: 'brand' | 'creator';
  campaignName: string;
  onClose: () => void;
  onSubmit: (rating: number, text: string) => void;
}

export function LeaveReviewModal({
  subjectName, subjectKind = 'brand', campaignName, onClose, onSubmit,
}: LeaveReviewModalProps) {
  const [rating, setRating] = useState(0);
  const [text, setText] = useState('');
  const canSubmit = rating > 0 && text.trim().length >= 10;
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
        style={{ maxWidth: 480 }}
      >
        <h2 style={{
          fontFamily: 'var(--v2-font-display)', fontSize: 22, fontWeight: 500,
          margin: '0 0 6px', letterSpacing: '-0.02em',
        }}>Review {subjectName}</h2>
        <p className="v2-muted" style={{ margin: '0 0 14px', fontSize: 13 }}>
          How was the collaboration on {campaignName}? Your review is public on the
          {subjectKind === 'creator' ? " creator's storefront." : " brand's profile."}
        </p>
        <label className="v2-eyebrow" style={{ display: 'block', marginBottom: 6 }}>Rating</label>
        <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setRating(n)}
              aria-label={`${n} star${n === 1 ? '' : 's'}`}
              style={{
                width: 36, height: 36, borderRadius: 6,
                border: '1px solid var(--v2-line)',
                background: n <= rating ? 'var(--v2-accent)' : 'transparent',
                color: n <= rating ? 'white' : 'var(--v2-ink-3)',
                fontSize: 18, cursor: 'pointer', fontFamily: 'inherit',
              }}
            >★</button>
          ))}
        </div>
        <label className="v2-eyebrow" style={{ display: 'block', marginBottom: 6 }}>Notes</label>
        <textarea
          className="v2-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="What went well? Anything they could improve? (≥10 characters)"
          rows={4}
          style={{ width: '100%', fontFamily: 'inherit', fontSize: 13.5, padding: 10, marginBottom: 14 }}
        />
        <div className="v2-row" style={{ justifyContent: 'flex-end', gap: 8 }}>
          <button className="v2-btn v2-btn-ghost" type="button" onClick={onClose}>Cancel</button>
          <button
            className="v2-btn v2-btn-primary"
            type="button"
            disabled={!canSubmit}
            onClick={() => onSubmit(rating, text.trim())}
          >Submit review</button>
        </div>
      </div>
    </div>
  );
}
