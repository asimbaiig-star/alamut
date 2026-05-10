// Fullscreen image viewer with carousel + zoom (Phase 21).
//
// Built specifically for the brand-Approvals review flow — the heart of
// the brand UX, where the previous "click → nothing happens" experience
// forced reviewers to approve work blind. Now click any file to expand;
// arrow keys move between files; click the image to toggle fit/100%;
// Esc to close.
//
// Generic enough to use anywhere there's a file gallery — Content
// drafts, Boost-post review, etc.

import { useCallback, useEffect, useState } from 'react';
import { Icon } from './Icon';

export interface LightboxFile {
  name: string;
  url: string;
  /** Optional explicit override; otherwise inferred from URL extension. */
  kind?: AssetKind;
}

// Phase 23: explicit kinds the Lightbox knows how to render.
export type AssetKind = 'image' | 'video' | 'pdf' | 'text' | 'unknown';

const VIDEO_EXTS = ['mp4', 'mov', 'webm', 'm4v', 'ogv'];
const TEXT_EXTS = ['csv', 'txt', 'md', 'json', 'log', 'yaml', 'yml'];

/** Best-effort kind detection from a file's url + name. */
export function detectAssetKind(file: LightboxFile): AssetKind {
  if (file.kind) return file.kind;
  // Pull a candidate path from the url (strip query/hash) or fall back to name.
  const path = (file.url.split(/[?#]/)[0] || file.name || '').toLowerCase();
  // Phase 23 QA fix: only treat the last segment as an "extension" if the
  // dot is AFTER the last slash. Otherwise URLs like
  // `https://cdn.example.com/file` (no extension) would have `pop()` return
  // the whole host, which would trip every membership check below.
  const lastDot = path.lastIndexOf('.');
  const lastSlash = path.lastIndexOf('/');
  const ext = lastDot > lastSlash ? path.slice(lastDot + 1) : '';
  if (ext === 'pdf') return 'pdf';
  if (VIDEO_EXTS.includes(ext)) return 'video';
  if (TEXT_EXTS.includes(ext)) return 'text';
  // Image: catch the common ones plus any unsplash-style URLs without extensions.
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif', 'svg', 'heic'].includes(ext)) return 'image';
  if (file.url.includes('images.unsplash.com')) return 'image';
  return 'unknown';
}

interface Props {
  files: LightboxFile[];
  /** Index to start at when opened. */
  startIndex: number;
  open: boolean;
  onClose: () => void;
  /** Optional caption rendered under the index pill (e.g. "Round 2 · Sarah Chen"). */
  caption?: string;
  /** Phase 22: optional comparison set rendered side-by-side. When provided
   *  the viewer enters diff mode — left pane = `files`, right pane = `compareFiles`.
   *  Index syncs across both panes; missing files on either side show a placeholder.
   */
  compareFiles?: LightboxFile[];
  /** Caption for the comparison pane (e.g. "Round 1 · Sarah Chen"). */
  compareCaption?: string;
}

export function Lightbox({ files, startIndex, open, onClose, caption, compareFiles, compareCaption }: Props) {
  const [idx, setIdx] = useState(startIndex);
  const [zoomed, setZoomed] = useState(false);
  const isDiff = !!compareFiles && compareFiles.length > 0;
  // Total nav range = max of both panes (so user can reach files only on one side).
  const navLen = isDiff ? Math.max(files.length, compareFiles.length) : files.length;

  // Sync idx when caller changes startIndex (e.g. user clicked a different thumb)
  useEffect(() => { setIdx(startIndex); setZoomed(false); }, [startIndex, open]);

  const next = useCallback(() => {
    setIdx((i) => (i + 1) % navLen);
    setZoomed(false);
  }, [navLen]);

  const prev = useCallback(() => {
    setIdx((i) => (i - 1 + navLen) % navLen);
    setZoomed(false);
  }, [navLen]);

  // Keyboard navigation: ←/→ between files, Esc to close, Space to zoom-toggle.
  // Phase 21 QA fix: register at the CAPTURE phase and call
  // stopImmediatePropagation so an underlying Modal's window-level Esc
  // listener doesn't ALSO fire and close the dialog beneath us.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopImmediatePropagation();
        onClose();
        return;
      }
      if (e.key === 'ArrowRight') { e.preventDefault(); e.stopImmediatePropagation(); next(); return; }
      if (e.key === 'ArrowLeft')  { e.preventDefault(); e.stopImmediatePropagation(); prev(); return; }
      if (e.key === ' ' || e.key === 'Enter') {
        // Don't fight typing in any future text inputs in the lightbox.
        const t = e.target as HTMLElement | null;
        if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        setZoomed((z) => !z);
      }
    };
    // Capture phase so we run BEFORE Modal's listener (registered at bubble).
    window.addEventListener('keydown', onKey, true);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey, true);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, next, prev, onClose]);

  // Phase 22 QA fix: in diff mode with both panes empty, navLen is 0 and
  // `% navLen` returns NaN — bail to prevent a degenerate render.
  if (!open) return null;
  if (!isDiff && files.length === 0) return null;
  if (isDiff && navLen === 0) return null;
  const file = files[idx];
  const compareFile = isDiff ? compareFiles![idx] : undefined;

  return (
    <div
      className={['lightbox-backdrop', isDiff ? 'is-diff' : ''].join(' ')}
      role="dialog"
      aria-modal="true"
      aria-label={isDiff ? 'File comparison viewer' : 'File viewer'}
      onClick={onClose}
    >
      {/* Top chrome — counter + caption + close */}
      <div className="lightbox-chrome lightbox-chrome-top" onClick={(e) => e.stopPropagation()}>
        <div className="lightbox-counter">
          <span className="lightbox-counter-num">{idx + 1}</span>
          <span className="lightbox-counter-of">/ {navLen}</span>
          {file?.name && !isDiff && <span className="lightbox-counter-name">{file.name}</span>}
          {isDiff && <span className="lightbox-counter-name">Diff view</span>}
        </div>
        {caption && !isDiff && <div className="lightbox-caption">{caption}</div>}
        <button className="lightbox-close" onClick={onClose} aria-label="Close (Esc)" title="Close (Esc)">
          <Icon.x s={16} />
        </button>
      </div>

      {/* Main stage — single asset, OR side-by-side diff. Phase 23: AssetView
          dispatches on file kind (image / video / pdf / text / unknown). */}
      {isDiff ? (
        <div className="lightbox-diff-stage" onClick={(e) => e.stopPropagation()}>
          <div className="lightbox-diff-pane">
            <div className="lightbox-diff-pane-h">{compareCaption || 'Previous'}</div>
            {compareFile
              ? <AssetView file={compareFile} fallbackAlt={`Previous file ${idx + 1}`} />
              : <div className="lightbox-diff-missing">No file at this index</div>}
          </div>
          <div className="lightbox-diff-pane">
            <div className="lightbox-diff-pane-h">{caption || 'Current'}</div>
            {file
              ? <AssetView file={file} fallbackAlt={`Current file ${idx + 1}`} />
              : <div className="lightbox-diff-missing">No file at this index</div>}
          </div>
        </div>
      ) : detectAssetKind(file) === 'image' ? (
        // Image-only path keeps the click-to-zoom affordance.
        <button
          className={['lightbox-stage', zoomed ? 'is-zoomed' : ''].join(' ')}
          onClick={(e) => { e.stopPropagation(); setZoomed((z) => !z); }}
          aria-label={zoomed ? 'Zoom out (Space)' : 'Zoom in (Space)'}
        >
          <img src={file.url} alt={file.name || `File ${idx + 1}`} />
        </button>
      ) : (
        // Non-image (video, pdf, text, unknown) — no zoom affordance, the
        // browser-native control surface handles interaction.
        <div className="lightbox-stage" onClick={(e) => e.stopPropagation()}>
          <AssetView file={file} fallbackAlt={`File ${idx + 1}`} />
        </div>
      )}

      {/* Prev/next chrome — only when there's more than one file */}
      {navLen > 1 && (
        <>
          <button
            className="lightbox-arrow lightbox-arrow-prev"
            onClick={(e) => { e.stopPropagation(); prev(); }}
            aria-label="Previous file (←)"
            title="Previous (←)"
          >
            <Icon.arrow s={20} />
          </button>
          <button
            className="lightbox-arrow lightbox-arrow-next"
            onClick={(e) => { e.stopPropagation(); next(); }}
            aria-label="Next file (→)"
            title="Next (→)"
          >
            <Icon.arrow s={20} />
          </button>
        </>
      )}

      {/* Thumbnail strip — only in single mode (diff has its own pane headers).
          Phase 23: thumbs render a kind-specific glyph for non-image files
          since you can't show a raw video/pdf as a 56px square thumb. */}
      {!isDiff && files.length > 1 && (
        <div className="lightbox-thumbs" onClick={(e) => e.stopPropagation()}>
          {files.map((f, i) => (
            <button
              key={i}
              className={['lightbox-thumb', i === idx ? 'is-on' : ''].join(' ')}
              onClick={() => { setIdx(i); setZoomed(false); }}
              aria-label={`Go to file ${i + 1}`}
              aria-current={i === idx ? 'true' : undefined}
            >
              <Thumb file={f} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================
// Phase 23: AssetView — dispatches on file kind so the Lightbox can
// render videos, PDFs, csv/txt, and unknown types alongside images.
// ============================================================

function AssetView({ file, fallbackAlt }: { file: LightboxFile; fallbackAlt: string }) {
  const kind = detectAssetKind(file);
  if (kind === 'image') {
    return <img src={file.url} alt={file.name || fallbackAlt} />;
  }
  if (kind === 'video') {
    return (
      <video
        src={file.url}
        controls
        playsInline
        className="lightbox-video"
        aria-label={file.name || fallbackAlt}
      />
    );
  }
  if (kind === 'pdf') {
    return (
      <iframe
        src={file.url}
        className="lightbox-pdf"
        title={file.name || fallbackAlt}
        // Phase 23 QA fix: sandbox the iframe — embedded PDFs from untrusted
        // CDNs shouldn't be able to run arbitrary JS in the parent context.
        // Allow scripts (PDF.js viewers need them) but block top-level
        // navigation, popups, and form submission.
        sandbox="allow-same-origin allow-scripts"
      />
    );
  }
  if (kind === 'text') {
    return <TextPreview file={file} />;
  }
  // unknown — render a download card
  return (
    <div className="lightbox-unknown">
      <div className="lightbox-unknown-icon" aria-hidden="true">
        <Icon.layers s={32} />
      </div>
      <div className="lightbox-unknown-name">{file.name || 'Untitled file'}</div>
      <div className="lightbox-unknown-hint">Preview unavailable for this file type.</div>
      <a
        href={file.url}
        target="_blank"
        rel="noopener noreferrer"
        className="lightbox-unknown-link"
      >
        <Icon.arrow s={14} /> Open in new tab
      </a>
    </div>
  );
}

// Inline text-preview — fetches the first ~16KB so giant logs don't tank
// the lightbox. Falls back to a download link on fetch failure (typical
// for cross-origin URLs without CORS).
//
// Phase 23 QA fix: use AbortController so arrow-key scrubbing through
// many text files cancels the in-flight fetch instead of leaving N
// concurrent requests racing the user.
function TextPreview({ file }: { file: LightboxFile }) {
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    setText(null);
    setError(false);
    const controller = new AbortController();
    fetch(file.url, { signal: controller.signal })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.text();
      })
      .then((body) => {
        // 16KB cap — past that, show a truncated preview marker.
        const MAX = 16 * 1024;
        setText(body.length > MAX ? body.slice(0, MAX) + '\n\n… (truncated · open in new tab for full file)' : body);
      })
      .catch((err) => {
        // AbortError on user navigation — silent; everything else surfaces.
        if (err && err.name === 'AbortError') return;
        setError(true);
      });
    return () => { controller.abort(); };
  }, [file.url]);
  if (error) {
    return (
      <div className="lightbox-unknown">
        <div className="lightbox-unknown-icon" aria-hidden="true"><Icon.layers s={32} /></div>
        <div className="lightbox-unknown-name">{file.name}</div>
        <div className="lightbox-unknown-hint">Preview blocked (probably CORS).</div>
        <a href={file.url} target="_blank" rel="noopener noreferrer" className="lightbox-unknown-link">
          <Icon.arrow s={14} /> Open in new tab
        </a>
      </div>
    );
  }
  return (
    <pre className="lightbox-text">
      {text === null ? 'Loading…' : text}
    </pre>
  );
}

// Thumbnail dispatcher — images get a real <img>, others get a kind glyph.
function Thumb({ file }: { file: LightboxFile }) {
  const kind = detectAssetKind(file);
  if (kind === 'image') return <img src={file.url} alt="" />;
  return (
    <div className={`lightbox-thumb-glyph lightbox-thumb-glyph-${kind}`} aria-hidden="true">
      {kind === 'video' && <Icon.spark s={16} />}
      {kind === 'pdf' && <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.04em' }}>PDF</span>}
      {kind === 'text' && <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.04em' }}>TXT</span>}
      {kind === 'unknown' && <Icon.layers s={14} />}
    </div>
  );
}
