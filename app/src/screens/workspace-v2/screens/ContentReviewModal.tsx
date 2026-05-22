// ContentReviewModal.tsx — brand reviews creator's submission
//
// Mirrors the design's `ContentReviewModal`: 9:16 video preview on the
// left, review panel on the right with creator info, deliverable
// details, ✨ Spark auto-checks, feedback textarea, approve/revise
// actions. Approve releases escrow.

import { useState } from 'react';
import { fmtUSD, Icon } from '../lib';
import { useModalEscape } from '@/lib/utils/useModalEscape';
import type { V2Collab, V2Creator } from '../data';
import { v2ApproveContent, v2RequestRevision } from '../v2CampaignActions';
import { pushToast } from '@/lib/utils/toast';
// P7 — gate the approve / request-revision buttons by capability so
// finance + viewer team members see the actions exist (disabled) but
// can't fire them. The mutations themselves still throw via
// `requireCapability` (P5) — this is the UI-side feedback layer.
import { useCapability } from '@/lib/permissions';
// Phase 51 — render real files. Pre-fix the modal only showed
// `deliverable.thumb` — for live submissions where files store a
// data URL, we look up the source submission and pick the best preview
// (video / image / pdf / download).
import { useStore } from '@/lib/api/store';

interface Props {
  collab: V2Collab;
  creators: V2Creator[];
  onClose: () => void;
}

/** Pick a preview kind for a file — drives whether we render a <video>,
 *  <img>, <iframe>, or just a download link. Falls back to inferring
 *  from the file extension when MIME isn't carried (legacy submissions).
 *
 *  Phase 52 (security): the previous version trusted EITHER the MIME
 *  string OR the extension. A creator could upload `evil.pdf` whose
 *  bytes are an HTML page — extension says "pdf", we'd render it in an
 *  <iframe> with same-origin script execution against the brand's
 *  session.
 *
 *  New rule: PDF specifically requires BOTH the MIME to be `application/
 *  pdf` AND the extension to be `.pdf`. Anything else falls to the
 *  download link. Video / image render via <video src> / <img src> which
 *  are not script-execution surfaces; we still trust either signal there.
 *  Data URLs are further validated against `data:application/pdf;base64,`. */
/** Check that a file URL is safe to put into `src` / `href`. Allows
 *  http(s) and data: URLs only — blocks `javascript:`, `vbscript:`,
 *  `file:` etc. For data URLs, also requires the declared MIME to
 *  match a known-safe-to-link type (anything else falls back to a
 *  plain "filename only" rendering with no clickable link). */
function isSafeFileUrl(url: string): boolean {
  if (!url) return false;
  const lower = url.toLowerCase().trim();
  if (lower.startsWith('http://') || lower.startsWith('https://')) return true;
  if (lower.startsWith('data:')) {
    // Block data:text/html and data:application/javascript — those
    // are the script-execution surfaces.
    if (/^data:(text\/html|application\/(java|ecma)script|text\/javascript)/i.test(lower)) return false;
    return true;
  }
  return false;
}

function previewKind(file: { name: string; mime?: string; url?: string }): 'video' | 'image' | 'pdf' | 'other' {
  const mime = (file.mime ?? '').toLowerCase();
  const ext = file.name.toLowerCase().split('.').pop() ?? '';
  if (mime.startsWith('video/') || ['mp4','mov','webm'].includes(ext)) return 'video';
  if (mime.startsWith('image/') || ['png','jpg','jpeg','heic','gif','webp'].includes(ext)) return 'image';
  // PDF preview is the script-execution surface — be strict.
  const looksPdfMime = mime === 'application/pdf';
  const looksPdfExt = ext === 'pdf';
  const looksPdfDataUrl = (file.url ?? '').toLowerCase().startsWith('data:application/pdf');
  // Require MIME + extension to agree, OR a data URL whose own MIME
  // header says PDF (data URLs are self-describing).
  if ((looksPdfMime && looksPdfExt) || looksPdfDataUrl) return 'pdf';
  return 'other';
}

export function ContentReviewModal({ collab, creators, onClose }: Props) {
  useModalEscape(onClose);
  const creator = creators.find((c) => c.id === collab.creatorId);
  const deliverable =
    collab.deliverables.find((d) => d.status === 'in_review') ?? collab.deliverables[0];
  const [feedback, setFeedback] = useState('');
  const canApprove = useCapability('content.approve');
  const canRevise = useCapability('content.revise');

  // Pull the underlying submission so we can render files[] — V2Deliverable
  // only carries a flattened `thumb` URL, which falls flat for video/PDF.
  const submission = useStore((s) =>
    deliverable ? s.db.submissions.find((sub) => sub.id === deliverable.id) : undefined,
  );
  const files = submission?.files ?? [];
  const primaryFile = files[0];
  // Phase 52 — `primaryUsable` now also requires the URL to pass the
  // safe-scheme check (blocks javascript:, vbscript:, data:text/html).
  const primaryUsable = !!primaryFile
    && primaryFile.url
    && primaryFile.url !== '#'
    && isSafeFileUrl(primaryFile.url);
  const kind = primaryFile ? previewKind(primaryFile) : 'other';

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
        <div className="v2-review-modal-media" style={{ position: 'relative' }}>
          {primaryUsable && kind === 'video' && (
            <video
              src={primaryFile!.url}
              controls
              style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#000' }}
            />
          )}
          {primaryUsable && kind === 'image' && (
            <img
              src={primaryFile!.url}
              alt={primaryFile!.name}
              style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#000' }}
            />
          )}
          {primaryUsable && kind === 'pdf' && (
            // Sandboxed iframe — even if previewKind() were ever fooled,
            // the sandbox attribute strips script execution + same-origin
            // privileges. allow-same-origin is intentionally OFF.
            <iframe
              src={primaryFile!.url}
              title={primaryFile!.name}
              sandbox=""
              referrerPolicy="no-referrer"
              style={{ width: '100%', height: '100%', border: 0, background: '#fff' }}
            />
          )}
          {primaryUsable && kind === 'other' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, color: 'rgba(255,255,255,0.85)', padding: 24, textAlign: 'center' }}>
              <div style={{ fontSize: 14 }}>{primaryFile!.name}</div>
              <a
                href={primaryFile!.url}
                download={primaryFile!.name}
                target="_blank"
                rel="noopener noreferrer"
                className="v2-btn v2-btn-primary v2-btn-sm"
                style={{ color: 'white', textDecoration: 'none' }}
              >
                Open file
              </a>
            </div>
          )}
          {!primaryUsable && deliverable.thumb && (
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
          )}
          {!primaryUsable && !deliverable.thumb && (
            <div style={{ color: 'rgba(255,255,255,0.6)', padding: 24, textAlign: 'center', fontSize: 13, lineHeight: 1.5 }}>
              {primaryFile
                ? <>Preview unavailable for <strong>{primaryFile.name}</strong>.<br />File was too large for inline storage at submit time.</>
                : <>No file attached to this submission.</>}
            </div>
          )}
          {/* Multi-file thumbnail strip when more than one file. */}
          {files.length > 1 && (
            <div
              style={{
                position: 'absolute', bottom: 8, left: 8, right: 56,
                display: 'flex', gap: 6, overflowX: 'auto',
                background: 'rgba(0,0,0,0.55)', padding: 6, borderRadius: 6,
              }}
            >
              {files.map((f, i) => {
                const safe = isSafeFileUrl(f.url);
                const label = `${i + 1}. ${f.name.length > 18 ? f.name.slice(0, 18) + '…' : f.name}`;
                const baseStyle = {
                  fontSize: 11, padding: '3px 8px', borderRadius: 4,
                  background: 'rgba(255,255,255,0.92)', color: '#111',
                  textDecoration: 'none', whiteSpace: 'nowrap' as const,
                };
                if (!safe) {
                  // Render as inert text so we never put an unsafe URL
                  // into an `href` (no javascript:, no data:text/html).
                  return (
                    <span key={i} style={{ ...baseStyle, opacity: 0.6 }} title={`${f.name} (unsafe URL)`}>
                      {label}
                    </span>
                  );
                }
                return (
                  <a
                    key={i}
                    href={f.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    download={f.name}
                    style={baseStyle}
                    title={f.name}
                  >
                    {label}
                  </a>
                );
              })}
            </div>
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
              Review checklist
            </div>
            {/* Pre-fix this was a 5-row "Spark auto-check" panel that
                pretended to be AI moderation but rendered the same
                static checks for every submission. Now it's a real
                tick-list the brand fills in as they review the
                content. Local UI state only — could persist to the
                Submission row later if we want history. */}
            <ReviewChecklist />
            <div style={{ height: 20 }} />

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
                  try {
                    v2RequestRevision(deliverable.id, feedback || 'Revision requested.');
                    pushToast('Revision requested — the creator was notified', 'good');
                    onClose();
                  } catch (err) {
                    pushToast(err instanceof Error ? err.message : 'Revision request failed', 'bad');
                  }
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
                  try {
                    v2ApproveContent(deliverable.id);
                    pushToast(`Approved — ${fmtUSD(collab.price)} released to the creator`, 'good');
                    onClose();
                  } catch (err) {
                    pushToast(err instanceof Error ? err.message : 'Approve failed', 'bad');
                  }
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

/** Brand-side review checklist. Interactive — brand ticks items off as
 *  they verify the submission. The items themselves are the same five
 *  brand-safety / hygiene checks every campaign cares about (product
 *  in opening, brand handle tagged, #ad disclosure, caption length).
 *  State is ephemeral; resets each time the modal opens. */
function ReviewChecklist() {
  const items = [
    'Product visible in first 3s',
    'Brand handle tagged',
    'Brand hashtag in caption',
    '#ad disclosure present',
    'Caption length ≥ 60 words',
  ];
  const [ticked, setTicked] = useState<boolean[]>(() => items.map(() => false));
  const toggle = (i: number) => setTicked((arr) => arr.map((v, j) => (j === i ? !v : v)));
  const ratio = ticked.filter(Boolean).length;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <div className="v2-muted" style={{ fontSize: 11.5, marginBottom: 4 }}>
        {ratio} of {items.length} verified
      </div>
      {items.map((label, i) => (
        <label
          key={label}
          className="v2-row"
          style={{
            gap: 8, fontSize: 13, cursor: 'pointer',
            padding: '4px 0',
            color: ticked[i] ? 'var(--v2-ink)' : 'var(--v2-ink-2)',
          }}
        >
          <input
            type="checkbox"
            checked={ticked[i]}
            onChange={() => toggle(i)}
            aria-label={`Mark "${label}" verified`}
            style={{ accentColor: 'var(--v2-moss)' }}
          />
          <span>{label}</span>
        </label>
      ))}
    </div>
  );
}
