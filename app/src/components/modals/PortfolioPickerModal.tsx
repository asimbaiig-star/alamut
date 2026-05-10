// Portfolio picker — multi-select stock images, save as creator's work[].
import { useState } from 'react';
import { api } from '@/lib/api/client';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { pushToast } from '@/lib/utils/toast';

interface PortfolioPickerModalProps {
  open: boolean;
  onClose: () => void;
  initial: string[];
}

const STOCK_POOL = [
  'photo-1556228720-195a672e8a03', 'photo-1556909114-f6e7ad7d3136', 'photo-1505693416388-ac5ce068fe85',
  'photo-1574781330855-d0db8cc6a79c', 'photo-1469334031218-e382a71b716b', 'photo-1490481651871-ab68de25d43d',
  'photo-1551803091-e20673f15770', 'photo-1487222477894-8943e31ef7b2', 'photo-1546069901-ba9599a7e63c',
  'photo-1565299624946-b28f40a0ae38', 'photo-1565958011703-44f9829ba187', 'photo-1493663284031-b7e3aefcae8e',
  'photo-1509631179647-0177331693ae', 'photo-1515886657613-9f3515b0c78f', 'photo-1542838132-92c53300491e',
  'photo-1519681393784-d120267933ba', 'photo-1542038784456-1ea8e935640e', 'photo-1452860606245-08befc0ff44b',
  'photo-1441986300917-64674bd600d8', 'photo-1532453288672-3a27e9be9efd',
];
const url = (id: string) => `https://images.unsplash.com/${id}?w=600&h=600&fit=crop&auto=format`;
const MAX = 12;

export function PortfolioPickerModal({ open, onClose, initial }: PortfolioPickerModalProps) {
  const [picked, setPicked] = useState<string[]>(initial);
  const [busy, setBusy] = useState(false);

  const toggle = (u: string) => {
    setPicked((arr) => arr.includes(u)
      ? arr.filter((x) => x !== u)
      : arr.length < MAX ? [...arr, u] : (pushToast(`Max ${MAX} pieces`, 'bad'), arr)
    );
  };

  const save = async () => {
    setBusy(true);
    try {
      await api.settings.updatePortfolio(picked);
      pushToast(`Saved ${picked.length} portfolio piece${picked.length === 1 ? '' : 's'}`, 'good');
      onClose();
    } catch (e) {
      pushToast(e instanceof Error ? e.message : 'Save failed', 'bad');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Portfolio · ${picked.length}/${MAX} selected`}
      width={760}
      footer={<>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button onClick={save} loading={busy} icon={<Icon.check s={14} />}>Save portfolio</Button>
      </>}
    >
      <p style={{ marginTop: 0, fontSize: 13, color: 'var(--ink-80)' }}>
        Pick from the stock library below to populate your portfolio. Real upload arrives with file storage.
        Click again to remove.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginTop: 16 }}>
        {STOCK_POOL.map((id) => {
          const u = url(id);
          const i = picked.indexOf(u);
          const isOn = i >= 0;
          return (
            <button
              key={id}
              onClick={() => toggle(u)}
              style={{
                aspectRatio: '1/1',
                background: `url(${u}) center/cover`,
                position: 'relative',
                border: isOn ? '2px solid var(--accent)' : '2px solid transparent',
                borderRadius: 4,
                cursor: 'pointer',
                outline: 'none',
              }}
            >
              {isOn && (
                <span style={{
                  position: 'absolute', top: 6, right: 6,
                  background: 'var(--accent)',
                  color: 'var(--paper)',
                  width: 22, height: 22, borderRadius: '50%',
                  display: 'grid', placeItems: 'center',
                  fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 600,
                }}>{i + 1}</span>
              )}
            </button>
          );
        })}
      </div>
    </Modal>
  );
}
