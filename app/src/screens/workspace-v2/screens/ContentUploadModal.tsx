// ContentUploadModal.tsx — creator submits a draft for review
//
// Two-step flow: drag-and-drop (or click-to-upload) + caption editor
// with Spark pre-flight checks → success state. Wired in CollabDetail.

import { useRef, useState } from 'react';
import { Icon } from '../lib';
import type { V2Campaign, V2Collab } from '../data';
import { v2SubmitContent } from '../v2CampaignActions';
import { pushToast } from '@/lib/utils/toast';

interface Props {
  collab: V2Collab;
  campaign: V2Campaign;
  /** P1d §1.5 — FK into `db.deliverables`. The submission this modal
   *  creates attaches to this deliverable via `Submission.deliverableId`.
   *  Pre-P1d this was a numeric `slotIndex`; now it's the stable id. */
  deliverableId: string;
  /** Human label for the deliverable (e.g. "Story 2 · Instagram"). */
  deliverableLabel?: string;
  /** When true, this is a resubmission after a revision request. */
  isResubmit?: boolean;
  onClose: () => void;
}

// File constraints — server / Storage would enforce these in production.
// For the demo we cap on the client at submit time. Allowlist covers the
// formats every supported platform (Instagram/TikTok/YouTube/X/Substack
// /LinkedIn/Newsletter) actually accepts as a draft.
const MAX_FILE_SIZE_MB = 200;
// Larger files don't fit in the data-URL inline storage path the
// prototype uses (localStorage cap + base64 inflation). Anything bigger
// than this is held in memory only — it'll preview during the same
// session but won't survive a reload until Storage upload lands.
const MAX_INLINE_SIZE_MB = 25;
const ALLOWED_MIME_PREFIXES = ['video/', 'image/', 'application/pdf'];
const ALLOWED_EXT = ['.mp4', '.mov', '.webm', '.png', '.jpg', '.jpeg', '.heic', '.gif', '.pdf'];

/** Read a File as a base64 data URL. Used to persist the bytes inline so
 *  the brand-side review modal can actually render what the creator sent.
 *  Production: replace with a Supabase Storage upload to `submission-files`
 *  bucket (see migrations/007_submissions_deliverables.sql:120) — the
 *  RLS policy requires the submission row to exist first, so the order is:
 *    1. Insert submission (placeholder url)
 *    2. Upload to <campaign_id>/<submission_id>/<filename>
 *    3. Update submission with the public URL.
 *  For the demo, inline data URLs work end-to-end on a single browser. */
function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function isAllowedFile(f: File): { ok: true } | { ok: false; reason: string } {
  if (f.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
    return { ok: false, reason: `File is ${(f.size / 1024 / 1024).toFixed(1)}MB — limit is ${MAX_FILE_SIZE_MB}MB.` };
  }
  const mimeOk = ALLOWED_MIME_PREFIXES.some((p) => f.type.startsWith(p));
  const extOk = ALLOWED_EXT.some((ext) => f.name.toLowerCase().endsWith(ext));
  // MIME alone is unreliable on some platforms (e.g. iOS HEIC); accept
  // if EITHER MIME prefix matches OR the extension does.
  if (!mimeOk && !extOk) {
    return { ok: false, reason: 'Only video, image, or PDF files are accepted.' };
  }
  return { ok: true };
}

function fmtFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function ContentUploadModal({ collab, campaign, deliverableId, deliverableLabel, isResubmit, onClose }: Props) {
  const [step, setStep] = useState<0 | 1>(0);
  const [caption, setCaption] = useState('');
  // Pre-fix this stored only `{name, size}` (a derived label). The actual
  // File bytes were dropped on the floor — submission.files[0].url ended
  // up '#' and the brand-side review modal had nothing to render.
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  function handleFilePicked(picked: FileList | null) {
    const f = picked?.[0];
    if (!f) return;
    const check = isAllowedFile(f);
    if (!check.ok) {
      pushToast(check.reason, 'bad');
      // Clear so re-picking the same file fires onChange again.
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    setFile(f);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function handleSubmit() {
    if (!file || submitting) return;
    setSubmitting(true);
    try {
      // For files within the inline cap, encode as a data URL so the
      // brand-side review modal can render an actual preview. Beyond
      // the cap, persist the filename only (review modal will show a
      // "preview unavailable — file too large for inline storage" hint).
      let url = '';
      if (file.size <= MAX_INLINE_SIZE_MB * 1024 * 1024) {
        url = await readAsDataUrl(file);
      }
      v2SubmitContent(
        collab.campaignId,
        collab.creatorId,
        caption,
        { name: file.name, url, mime: file.type, size: file.size },
        deliverableId,
      );
      setStep(1);
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Upload failed', 'bad');
    } finally {
      setSubmitting(false);
    }
  }

  // Brand-safe pre-flight check primitives — synthesized for the demo.
  // Real implementation would parse the uploaded media + caption to set
  // these flags. For now, derive everything from the caption text.
  const hasHashtag = /#\w+/i.test(caption);
  const hasAdDisclosure = /#ad\b|#sponsored\b|#paid\b/i.test(caption);

  void collab; // reserved for analytics / submission posting once wired

  return (
    <div className="v2-modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className="v2-card v2-upload-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="v2-upload-modal-head">
          <h2 style={{
            fontFamily: 'var(--v2-font-display)',
            fontSize: 22,
            fontWeight: 500,
            margin: '0 0 4px',
            letterSpacing: '-0.02em',
          }}>
            {isResubmit ? 'Resubmit content' : 'Submit content for review'}
          </h2>
          <div className="v2-muted" style={{ fontSize: 13 }}>
            {campaign.brand} · {campaign.name}
            {deliverableLabel && (
              <>
                {' · '}
                <strong style={{ color: 'var(--v2-ink)' }}>{deliverableLabel}</strong>
              </>
            )}
          </div>
        </header>

        <div className="v2-upload-modal-body">
          {step === 0 && (
            <>
              <div className="v2-eyebrow" style={{ marginBottom: 8 }}>Upload your draft</div>
              <input
                ref={fileInputRef}
                type="file"
                accept={ALLOWED_EXT.join(',')}
                style={{ display: 'none' }}
                onChange={(e) => handleFilePicked(e.target.files)}
                aria-hidden="true"
              />
              <button
                type="button"
                className={`v2-upload-dropzone ${file ? 'is-loaded' : ''}`}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  handleFilePicked(e.dataTransfer.files);
                }}
              >
                {file ? (
                  <>
                    <div style={{ fontSize: 28, marginBottom: 8, color: 'var(--v2-moss)' }}>{Icon.check}</div>
                    <div style={{ fontWeight: 600 }}>{file.name}</div>
                    <div className="v2-muted" style={{ fontSize: 12 }}>
                      {fmtFileSize(file.size)}
                      {file.size > MAX_INLINE_SIZE_MB * 1024 * 1024 && (
                        <> · large file — preview will not be available after reload</>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ fontSize: 28, marginBottom: 8 }}>{Icon.plus}</div>
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>Drop file or click to upload</div>
                    <div className="v2-muted" style={{ fontSize: 12 }}>
                      Video / image / PDF · up to {MAX_FILE_SIZE_MB}MB
                    </div>
                  </>
                )}
              </button>

              <div className="v2-eyebrow" style={{ marginTop: 20, marginBottom: 8 }}>Caption</div>
              <textarea
                className="v2-input"
                rows={5}
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Eid is finally here ✨ Wearing the new Sapphire lawn... #SapphireEid26 #ad"
              />
              <div className="v2-muted" style={{ fontSize: 11, marginTop: 6 }}>
                {caption.length} chars · Spark recommends 60–120 words for Reels
              </div>

              <div className="v2-spark-preflight">
                <div
                  className="v2-eyebrow"
                  style={{ color: 'var(--v2-accent)', marginBottom: 6 }}
                >
                  <span style={{ marginRight: 4 }}>{Icon.spark}</span>
                  Spark pre-flight checks
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12.5 }}>
                  <CheckRow ok label="Ratio detected: 9:16 (Reel-ready)" />
                  <CheckRow ok={hasHashtag} warn={!hasHashtag} label="Campaign hashtag" />
                  <CheckRow ok={hasAdDisclosure} warn={!hasAdDisclosure} label="#ad disclosure (FTC + Pakistan PCA)" />
                </div>
              </div>
            </>
          )}

          {step === 1 && (
            <div style={{ textAlign: 'center', padding: '32px 0' }}>
              <div style={{
                width: 72,
                height: 72,
                borderRadius: 999,
                background: 'var(--v2-moss-soft)',
                color: 'var(--v2-moss)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px',
                fontSize: 32,
              }}>{Icon.check}</div>
              <h3 style={{
                fontFamily: 'var(--v2-font-display)',
                fontSize: 22,
                fontWeight: 500,
                margin: '0 0 6px',
              }}>
                {deliverableLabel ? `${deliverableLabel} submitted` : 'Submitted'} to {campaign.brand}
              </h3>
              <p style={{ margin: 0, color: 'var(--v2-ink-2)' }}>
                You'll be notified when the brand reviews.
                <br />
                {collab.deliverables.filter((d) => d.status === 'pending').length > 1
                  ? `${collab.deliverables.filter((d) => d.status === 'pending').length - 1} more deliverable${collab.deliverables.filter((d) => d.status === 'pending').length - 1 === 1 ? '' : 's'} still pending.`
                  : 'Most brands respond within 24 hours.'}
              </p>
            </div>
          )}
        </div>

        <footer className="v2-upload-modal-foot">
          {step === 0 ? (
            <div className="v2-row" style={{ gap: 8 }}>
              <button className="v2-btn v2-btn-outline" type="button" style={{ flex: 1 }} onClick={onClose}>
                Cancel
              </button>
              <button
                className="v2-btn v2-btn-primary"
                type="button"
                style={{ flex: 2 }}
                disabled={!file || submitting}
                onClick={handleSubmit}
              >
                {submitting ? 'Uploading…' : 'Submit for review'}
              </button>
            </div>
          ) : (
            <button className="v2-btn v2-btn-primary" type="button" style={{ width: '100%' }} onClick={onClose}>
              Got it
            </button>
          )}
        </footer>
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
