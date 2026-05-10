// Creator-side: refer another creator to a brand. When the referred creator
// completes a campaign, referrer earns a bonus (~5% of completed deal value).
import { useMemo, useState } from 'react';
import { useStore } from '@/lib/api/store';
import { isCreatorAccepted } from '@/lib/api/relations';
import { useAuth } from '@/lib/auth/useAuth';
import { api } from '@/lib/api/client';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { fmtCount } from '@/lib/utils/format';
import { pushToast } from '@/lib/utils/toast';

interface ReferCreatorModalProps {
  open: boolean;
  onClose: () => void;
}

export function ReferCreatorModal({ open, onClose }: ReferCreatorModalProps) {
  const { creator } = useAuth();
  const db = useStore((s) => s.db);
  const [search, setSearch] = useState('');
  const [picked, setPicked] = useState<string | null>(null);
  const [brandId, setBrandId] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  // Brands the current creator has worked with (so referral feels grounded)
  const myBrands = useMemo(() => {
    if (!creator) return [];
    const brandIds = new Set<string>();
    db.campaigns.forEach((c) => {
      if (isCreatorAccepted(c.id, creator.id, db)) brandIds.add(c.brandId);
    });
    return Array.from(brandIds).map((id) => db.brands.find((b) => b.id === id)).filter((b): b is NonNullable<typeof b> => !!b);
  }, [db, creator]);

  const candidates = useMemo(() => {
    if (!creator) return [];
    const q = search.trim().toLowerCase();
    return db.creators
      .filter((c) => c.id !== creator.id)
      .filter((c) => !q || [c.name, c.handle, c.tagline, c.city, ...c.categories].join(' ').toLowerCase().includes(q))
      .slice(0, 12);
  }, [db.creators, creator, search]);

  const submit = async () => {
    if (!picked) { pushToast('Pick a creator', 'bad'); return; }
    if (note.trim().length < 10) { pushToast('Add a brief note (10+ chars)', 'bad'); return; }
    setBusy(true);
    try {
      await api.referrals.create({
        toCreatorId: picked,
        recommendedBrandId: brandId || undefined,
        noteToReferred: note.trim(),
      });
      pushToast('Referral sent', 'good');
      setPicked(null); setBrandId(''); setNote(''); setSearch('');
      onClose();
    } catch (e) {
      pushToast(e instanceof Error ? e.message : 'Referral failed', 'bad');
    } finally {
      setBusy(false);
    }
  };

  if (!creator) return null;
  const pickedCreator = picked ? db.creators.find((c) => c.id === picked) : null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Refer a creator"
      width={620}
      footer={<>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button onClick={submit} loading={busy} disabled={!picked || note.trim().length < 10} icon={<Icon.arrow s={14} />}>Send referral</Button>
      </>}
    >
      <div style={{ background: 'var(--paper-2)', padding: 12, borderRadius: 6, fontSize: 13, color: 'var(--ink-80)', marginBottom: 18 }}>
        Refer a creator you trust to a brand you've worked with. When they complete a campaign with that brand, you earn a <strong>5% referral bonus</strong> on their payout.
      </div>

      <div className="form-grid">
        <div className="field full">
          <label className="field-label">Pick a creator</label>
          <div className="search" style={{ marginBottom: 10 }}>
            <Icon.search s={14} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name, handle, category…" />
          </div>
          <div style={{ maxHeight: 220, overflowY: 'auto', border: '1px solid var(--rule)', borderRadius: 6 }}>
            {candidates.map((c) => (
              <button
                key={c.id}
                onClick={() => setPicked(c.id)}
                style={{
                  display: 'grid', gridTemplateColumns: '40px 1fr auto', gap: 12, alignItems: 'center',
                  padding: '10px 12px',
                  background: picked === c.id ? 'color-mix(in oklab, var(--accent) 8%, transparent)' : 'transparent',
                  borderBottom: '1px solid var(--rule)',
                  width: '100%', textAlign: 'left', cursor: 'pointer',
                }}
              >
                <img src={c.portrait} alt="" style={{ width: 36, height: 44, objectFit: 'cover', borderRadius: 4 }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{c.name}</div>
                  <div className="mono-meta">{c.handle} · {c.tier} · {fmtCount(c.reach)} reach</div>
                </div>
                {picked === c.id && <Icon.check s={14} />}
              </button>
            ))}
            {candidates.length === 0 && (
              <div className="text-ink-60" style={{ padding: 14, textAlign: 'center', fontSize: 13 }}>No matches</div>
            )}
          </div>
        </div>

        <div className="field full">
          <label className="field-label">Recommend for brand (optional)</label>
          {myBrands.length === 0 ? (
            <div className="text-ink-60" style={{ fontSize: 13 }}>You haven't worked with any brand on Alamut yet — referrals without a brand link still count when the referred creator gets shortlisted.</div>
          ) : (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button type="button" className={['tab', !brandId ? 'is-on' : ''].join(' ')} onClick={() => setBrandId('')}>None</button>
              {myBrands.map((b) => (
                <button key={b.id} type="button" className={['tab', brandId === b.id ? 'is-on' : ''].join(' ')} onClick={() => setBrandId(b.id)}>{b.name}</button>
              ))}
            </div>
          )}
        </div>

        <div className="field full">
          <label className="field-label">Note to {pickedCreator ? pickedCreator.name.split(' ')[0] : 'them'} (≥10 chars)</label>
          <textarea
            rows={4}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={`Why you think ${pickedCreator ? pickedCreator.name.split(' ')[0] : 'they'} would be a good fit. They'll see this in their notifications.`}
          />
        </div>
      </div>
    </Modal>
  );
}
