// ContentReviewModal.tsx — brand reviews creator's submission
//
// Mirrors the design's `ContentReviewModal`: 9:16 video preview on the
// left, review panel on the right with creator info, deliverable
// details, ✨ Spark auto-checks, feedback textarea, approve/revise
// actions. Approve releases escrow.

import { useState } from 'react';
import { fmtUSD, Icon } from '../lib';
import type { V2Collab, V2Creator } from '../data';
import { v2ApproveContent, v2RequestRevision } from '../v2CampaignActions';
// P7 — gate the approve / request-revision buttons by capability so
// finance + viewer team members see the actions exist (disabled) but
// can't fire them. The mutations themselves still throw via
// `requireCapability` (P5) — this is the UI-side feedback layer.
import { useCapability } from '@/lib/permissions';

interface Props {
  collab: V2Collab;
  creators: V2Creator[];
  onClose: () => void;
}

export function ContentReviewModal({ collab, creators, onClose }: Props) {
  const creator = creators.find((c) => c.id === collab.creatorId);
  const deliverable =
    collab.deliverables.find((d) => d.status === 'in_review') ?? collab.deliverables[0];
  const [feedback, setFeedback] = useState('');
  const canApprove = useCapability('content.approve');
  const canRevise = useCapability('content.revise');

  if (!creator || !deliverable) {
    return null;
  }

  return (
    <div className="v2-modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className="v2-card v2-review-modal"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Left: media preview */}
        <div className="v2-review-modal-media">
          {deliverable.thumb ? (
            <div
              className="v2-review-modal-video"
              style={{ backgroundImage: `url(${deliverable.thumb})` }}
            >
              <button
                className="v2-review-modal-play"
                type="button"
                aria-label="Play"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="var(--v2-ink)">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </button>
            </div>
          ) : (
            <div style={{ color: 'rgba(255,255,255,0.5)' }}>No preview available</div>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="v2-review-modal-close"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Right: review panel */}
        <div className="v2-review-modal-panel">
          <header className="v2-review-modal-head">
            <div className="v2-row" style={{ marginBottom: 12, gap: 10 }}>
              <div
                className="v2-avatar v2-avatar-md"
                style={{ backgroundImage: `url(${creator.avatar})` }}
                aria-hidden="true"
              />
              <div>
                <div style={{ fontWeight: 600 }}>{creator.name}</div>
                <div className="v2-muted" style={{ fontSize: 12 }}>
                  @{creator.handle} · {creator.city}
                </div>
              </div>
            </div>
            <h2 style={{
              fontFamily: 'var(--v2-font-display)',
              fontSize: 22,
              fontWeight: 500,
              margin: '0 0 4px',
              letterSpacing: '-0.02em',
            }}>
              {deliverable.label}
            </h2>
            <div className="v2-muted" style={{ fontSize: 13 }}>
              Submitted {deliverable.submittedAt ?? '—'} · Due {deliverable.due}
            </div>
          </header>

          <div className="v2-review-modal-body">
            {deliverable.notes && (
              <div className="v2-review-modal-notes">
                <div className="v2-eyebrow" style={{ marginBottom: 6 }}>Creator notes</div>
                {deliverable.notes}
              </div>
            )}

            <div className="v2-eyebrow" style={{ marginBottom: 8 }}>
              <span style={{ color: 'var(--v2-accent)' }}>{Icon.spark}</span> Spark auto-check
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 20 }}>
              <CheckRow ok label="Product visible in first 3s" />
              <CheckRow ok label="Brand hashtag in caption" />
              <CheckRow ok label="Brand handle tagged" />
              <CheckRow ok label="#ad disclosure present" />
              <CheckRow warn label="Caption length: 48 words (rec. 60+)" />
            </div>

            <div className="v2-eyebrow" style={{ marginBottom: 8 }}>Your feedback</div>
            <textarea
              className="v2-input"
              rows={4}
              placeholder="Comments for the creator..."
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              style={{ marginBottom: 12 }}
            />
            <div className="v2-row" style={{ gap: 6, flexWrap: 'wrap' }}>
              <button
                className="v2-btn v2-btn-sm v2-btn-ghost"
                type="button"
                onClick={() => setFeedback('Love this! Lighting and styling are spot on.')}
              >+ Praise</button>
              <button
                className="v2-btn v2-btn-sm v2-btn-ghost"
                type="button"
                onClick={() => setFeedback((f) => f + '\nCan we make the product 1–2s longer in the opening?')}
              >+ Product visibility</button>
              <button
                className="v2-btn v2-btn-sm v2-btn-ghost"
                type="button"
                onClick={() => setFeedback((f) => f + '\nCould you adjust the caption to mention the collection by name?')}
              >+ Caption</button>
            </div>
          </div>

          <footer className="v2-review-modal-foot">
            <div className="v2-review-modal-comp">
              <div className="v2-row" style={{ justifyContent: 'space-between' }}>
                <span className="v2-muted">Will release on approval</span>
                <span className="v2-tabular" style={{ fontWeight: 600 }}>{fmtUSD(collab.price)}</span>
              </div>
              <div className="v2-row" style={{ justifyContent: 'space-between' }}>
                <span className="v2-muted">Net after fees & WHT</span>
                <span className="v2-tabular" style={{ color: 'var(--v2-moss)' }}>
                  {fmtUSD(Math.round(collab.price * 0.85))}
                </span>
              </div>
            </div>
            <div className="v2-row" style={{ gap: 8 }}>
              <button
                className="v2-btn v2-btn-outline"
                type="button"
                style={{ flex: 1 }}
                disabled={!canRevise}
                title={!canRevise ? 'Admin or ops only' : undefined}
                onClick={() => {
                  v2RequestRevision(deliverable.id, feedback || 'Revision requested.');
                  onClose();
                }}
              >
                {canRevise ? 'Request revision' : 'Admin/ops only'}
              </button>
              <button
                className="v2-btn v2-btn-primary"
                type="button"
                style={{ flex: 2 }}
                disabled={!canApprove}
                title={!canApprove ? 'Admin or ops only' : undefined}
                onClick={() => {
                  v2ApproveContent(deliverable.id);
                  onClose();
                }}
              >
                {Icon.check} {canApprove ? `Approve & release ${fmtUSD(collab.price)}` : 'Admin/ops only'}
              </button>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}

function CheckRow({ ok, warn, label }: { ok?: boolean; warn?: boolean; label: string }) {
  const color = ok ? 'var(--v2-moss)' : warn ? 'var(--v2-gold)' : 'var(--v2-accent)';
  return (
    <div className="v2-row" style={{ gap: 8, fontSize: 13 }}>
      <span style={{ color, display: 'flex', flexShrink: 0 }}>
        {ok ? Icon.check : '⚠'}
      </span>
      <span>{label}</span>
    </div>
  );
}
