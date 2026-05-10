// ShareStorefrontModal — Phase 50f follow-up. Distribution helper that
// makes the storefront URL easy to put everywhere it should go: bios,
// pinned posts, email signatures, QR code on a printed business card.
//
// Composes existing Modal primitive + tile/btn classes. QR generated
// via api.qrserver.com (zero dependencies, stable API, public service).
// All copy buttons fall back to a textarea-select-and-copy if the
// Clipboard API isn't available.

import { useMemo, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { pushToast } from '@/lib/utils/toast';

interface Props {
  open: boolean;
  onClose: () => void;
  /** The creator's name — appears in the bio snippet templates. */
  creatorName: string;
  /** "@sarahstyle" — already-prefixed if present. We strip @ for URL. */
  handle: string;
}

export function ShareStorefrontModal({ open, onClose, creatorName, handle }: Props) {
  const handleClean = handle.replace(/^@/, '');
  const url = useMemo(() => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://alamut.co';
    return `${origin}/c/${handleClean}`;
  }, [handleClean]);

  const qrUrl = useMemo(() => {
    return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&margin=8&data=${encodeURIComponent(url)}`;
  }, [url]);

  const snippets = useMemo(() => [
    {
      id: 'ig',
      label: 'Instagram bio',
      hint: 'Compact — fits in 150-char bio with room',
      text: `Brand deals via Alamut → ${url.replace(/^https?:\/\//, '')}`,
    },
    {
      id: 'tt',
      label: 'TikTok / X bio',
      hint: 'Shortest possible — sub-80 chars',
      text: `Book me: ${url.replace(/^https?:\/\//, '')}`,
    },
    {
      id: 'email',
      label: 'Email signature',
      hint: 'For pitch replies and invoice emails',
      text: `${creatorName}\nBrand collaborations: ${url}`,
    },
  ], [creatorName, url]);

  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copy = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1800);
      pushToast('Copied', 'good');
    } catch {
      // Clipboard API unavailable — fall back to a transient textarea.
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); pushToast('Copied', 'good'); }
      catch { pushToast(text, 'default'); }
      document.body.removeChild(ta);
    }
  };

  const downloadQR = async () => {
    try {
      const res = await fetch(qrUrl);
      const blob = await res.blob();
      const dlUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = dlUrl;
      a.download = `${handleClean}-storefront-qr.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(dlUrl);
      pushToast('QR downloaded', 'good');
    } catch {
      pushToast('Could not download — long-press the image to save', 'default');
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Share your storefront" width={640}>
      <div className="storefront-share">
        {/* URL row — primary action */}
        <div className="storefront-share-url-row">
          <code className="storefront-share-url">{url}</code>
          <Button onClick={() => copy('url', url)} variant="ghost" size="sm">
            {copiedId === 'url' ? '✓ Copied' : 'Copy link'}
          </Button>
        </div>

        {/* QR code — for printing on cards, packaging, signage */}
        <div className="storefront-share-qr-block">
          <div className="storefront-share-qr-card tile">
            <img src={qrUrl} alt={`QR code for ${url}`} className="storefront-share-qr-img" />
          </div>
          <div className="storefront-share-qr-text">
            <div className="mono-meta">QR code · scan-to-storefront</div>
            <p>
              Print this on your business card, packaging, or behind-the-counter signage.
              Anyone who scans it lands on your storefront.
            </p>
            <Button onClick={downloadQR} variant="ghost" size="sm" icon={<Icon.download s={14} />}>
              Download PNG
            </Button>
          </div>
        </div>

        {/* Bio snippet templates */}
        <div className="storefront-share-snippets">
          <div className="mono-meta">Bio snippets · paste into the obvious places</div>
          <ul className="storefront-share-snippet-list">
            {snippets.map((s) => (
              <li key={s.id} className="storefront-share-snippet">
                <div className="storefront-share-snippet-head">
                  <div className="storefront-share-snippet-label">{s.label}</div>
                  <div className="storefront-share-snippet-hint">{s.hint}</div>
                </div>
                <div className="storefront-share-snippet-row">
                  <code className="storefront-share-snippet-text">{s.text}</code>
                  <Button onClick={() => copy(s.id, s.text)} variant="ghost" size="sm">
                    {copiedId === s.id ? '✓ Copied' : 'Copy'}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Footer — open the storefront in a new tab */}
        <div className="storefront-share-foot">
          <a
            href={`/c/${handleClean}`}
            target="_blank"
            rel="noreferrer"
            className="btn btn-md btn-solid"
          >
            Open my storefront ↗
          </a>
          <Button variant="plain" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </Modal>
  );
}
