// Single-image picker — used for creator portrait + brand logo.
// Stock pool + paste-URL field. In production this is replaced by a file uploader to S3/R2.
import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';

const PORTRAIT_STOCK = [
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=600&h=750&fit=crop',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=600&h=750&fit=crop',
  'https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=600&h=750&fit=crop',
  'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=600&h=750&fit=crop',
  'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=600&h=750&fit=crop',
  'https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=600&h=750&fit=crop',
  'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=600&h=750&fit=crop',
  'https://images.unsplash.com/photo-1607746882042-944635dfe10e?w=600&h=750&fit=crop',
  'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=600&h=750&fit=crop',
  'https://images.unsplash.com/photo-1502823403499-6ccfcf4fb453?w=600&h=750&fit=crop',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600&h=750&fit=crop',
  'https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?w=600&h=750&fit=crop',
];

const LOGO_STOCK = [
  'https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=400&h=400&fit=crop',
  'https://images.unsplash.com/photo-1611605698335-8b1569810432?w=400&h=400&fit=crop',
  'https://images.unsplash.com/photo-1622547748225-3fc4abd2cca0?w=400&h=400&fit=crop',
  'https://images.unsplash.com/photo-1599305445671-ac291c95aaa9?w=400&h=400&fit=crop',
  'https://images.unsplash.com/photo-1572044162444-ad60f128bdea?w=400&h=400&fit=crop',
  'https://images.unsplash.com/photo-1622547748225-3fc4abd2cca0?w=400&h=400&fit=crop',
  'https://images.unsplash.com/photo-1620207418302-439b387441b0?w=400&h=400&fit=crop',
  'https://images.unsplash.com/photo-1583912267550-d44c9486e8d4?w=400&h=400&fit=crop',
  'https://images.unsplash.com/photo-1633409361618-c73427e4e206?w=400&h=400&fit=crop',
  'https://images.unsplash.com/photo-1599305090598-fe179d501227?w=400&h=400&fit=crop',
];

interface ImagePickerModalProps {
  open: boolean;
  onClose: () => void;
  onPick: (url: string) => void;
  current?: string;
  kind: 'portrait' | 'logo';
}

export function ImagePickerModal({ open, onClose, onPick, current, kind }: ImagePickerModalProps) {
  const stock = kind === 'portrait' ? PORTRAIT_STOCK : LOGO_STOCK;
  const [picked, setPicked] = useState<string | null>(current || null);
  const [customUrl, setCustomUrl] = useState('');

  const apply = () => {
    const final = customUrl.trim() || picked;
    if (!final) return;
    onPick(final);
    onClose();
    setCustomUrl('');
  };

  const aspect = kind === 'portrait' ? '4/5' : '1/1';
  const title = kind === 'portrait' ? 'Profile picture' : 'Brand logo';

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      width={680}
      footer={<>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button onClick={apply} disabled={!picked && !customUrl.trim()} icon={<Icon.check s={14} />}>
          Use this image
        </Button>
      </>}
    >
      <div className="form-grid">
        <div className="field full">
          <label className="field-label">Pick from stock</label>
          <div style={{ display: 'grid', gridTemplateColumns: kind === 'portrait' ? 'repeat(4, 1fr)' : 'repeat(5, 1fr)', gap: 8 }}>
            {stock.map((url) => (
              <button
                key={url}
                type="button"
                onClick={() => { setPicked(url); setCustomUrl(''); }}
                style={{
                  width: '100%', aspectRatio: aspect,
                  backgroundImage: `url(${url})`, backgroundSize: 'cover', backgroundPosition: 'center',
                  borderRadius: kind === 'portrait' ? 4 : 6,
                  border: picked === url && !customUrl.trim() ? '2px solid var(--accent)' : '1px solid var(--rule)',
                  cursor: 'pointer',
                  position: 'relative',
                  outline: 'none',
                  padding: 0,
                  transition: 'border-color 0.15s, transform 0.15s',
                }}
                aria-label="Select image"
              >
                {picked === url && !customUrl.trim() && (
                  <span style={{
                    position: 'absolute', top: 6, right: 6,
                    background: 'var(--accent)', color: 'var(--paper)',
                    width: 22, height: 22, borderRadius: '50%',
                    display: 'grid', placeItems: 'center',
                  }}>
                    <Icon.check s={12} />
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="field full">
          <label className="field-label">Or paste your own URL</label>
          <input
            type="url"
            placeholder="https://…"
            value={customUrl}
            onChange={(e) => setCustomUrl(e.target.value)}
          />
          <span className="field-help">Real upload (S3 / R2) lands with file storage. For now, paste any direct image URL.</span>
        </div>

        {customUrl.trim() && (
          <div className="field full">
            <label className="field-label">Preview</label>
            <div
              style={{
                width: kind === 'portrait' ? 160 : 120,
                aspectRatio: aspect,
                backgroundImage: `url(${customUrl})`,
                backgroundSize: 'cover', backgroundPosition: 'center',
                borderRadius: kind === 'portrait' ? 4 : 6,
                border: '2px solid var(--accent)',
              }}
            />
          </div>
        )}
      </div>
    </Modal>
  );
}
