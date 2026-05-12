// Creator-side: apply to a live campaign with a pitch + proposed rate.
import { useState } from 'react';
import { api } from '@/lib/api/client';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { fmtMoneyFull } from '@/lib/utils/format';
import { pushToast } from '@/lib/utils/toast';
import type { Campaign, Brand } from '@/lib/api/types';

interface ApplyModalProps {
  open: boolean;
  onClose: () => void;
  campaign: Campaign;
  brand?: Brand;
  onApplied?: () => void;
}

const PITCH_MIN_CHARS = 40;

export function ApplyModal({ open, onClose, campaign, brand, onApplied }: ApplyModalProps) {
  const suggestedRate = Math.round(campaign.budget / 4);
  const [pitch, setPitch] = useState('');
  const [rate, setRate] = useState(suggestedRate);
  const [busy, setBusy] = useState(false);

  const pitchLen = pitch.trim().length;
  const pitchValid = pitchLen >= PITCH_MIN_CHARS;

  const submit = async () => {
    if (!pitchValid) {
      pushToast(`Pitch needs at least ${PITCH_MIN_CHARS} characters (you have ${pitchLen})`, 'bad');
      return;
    }
    setBusy(true);
    try {
      await api.applications.apply({ campaignId: campaign.id, pitch: pitch.trim(), proposedRate: rate });
      pushToast(`Applied to ${campaign.title}`, 'good');
      onApplied?.();
      onClose();
      setPitch('');
    } catch (e) {
      pushToast(e instanceof Error ? e.message : 'Apply failed', 'bad');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Apply to ${campaign.title}`}
      width={620}
      footer={<>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button onClick={submit} loading={busy} disabled={!pitchValid} icon={<Icon.arrow s={14} />}>Submit application</Button>
      </>}
    >
      <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 18, paddingBottom: 18, borderBottom: '1px solid var(--rule)' }}>
        <img src={campaign.cover} alt="" style={{ width: 80, height: 60, objectFit: 'cover', borderRadius: 4 }} />
        <div>
          <div className="mono-meta">{brand?.name} · {campaign.category} · {campaign.region}</div>
          <div style={{ fontFamily: 'var(--serif)', fontSize: 22, marginTop: 4 }}>{campaign.title}</div>
          <div style={{ fontSize: 13, color: 'var(--ink-80)', marginTop: 4 }}>{campaign.deliverablesText} · budget {fmtMoneyFull(campaign.budget)} · apply by {campaign.deadline}</div>
        </div>
      </div>

      {campaign.pricingModel === 'outcome' && campaign.outcomePricing && (
        <div style={{ marginBottom: 18, padding: 14, borderRadius: 6, background: 'color-mix(in oklch, var(--accent) 8%, var(--paper-2))', border: '1px solid color-mix(in oklch, var(--accent) 30%, transparent)' }}>
          <div className="mono-meta mb-8">⚡ Outcome-based campaign</div>
          <div style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--ink-80)' }}>
            You get a guaranteed <strong>${campaign.outcomePricing.baseFloor.toLocaleString()}</strong> base.
            On top of that, you earn <strong>${campaign.outcomePricing.perConversion}</strong> per attributed conversion (UTM-tracked sale),
            up to a cap of <strong>${campaign.outcomePricing.capPerCreator.toLocaleString()}</strong>. Your final earnings depend on performance.
          </div>
        </div>
      )}

      <div className="form-grid">
        <div className="field full">
          <label className="field-label">Your pitch</label>
          <textarea
            rows={5}
            value={pitch}
            onChange={(e) => setPitch(e.target.value)}
            placeholder="Why you, what's your angle, anything specific you'd bring. 2–4 sentences works."
            autoFocus
          />
          <span className="field-help" style={{ color: pitchValid ? undefined : 'var(--accent)' }}>
            {pitchValid
              ? `${pitchLen} characters · looking good`
              : `Be specific. Brands review fast. Minimum ${PITCH_MIN_CHARS} characters (${PITCH_MIN_CHARS - pitchLen} to go).`}
          </span>
        </div>
        <div className="field full">
          <label className="field-label">Proposed rate (USD)</label>
          <input type="number" min={100} step={100} value={rate} onChange={(e) => setRate(Number(e.target.value))} />
          <span className="field-help">Suggested: {fmtMoneyFull(suggestedRate)} (~25% of campaign budget). Negotiable after shortlist.</span>
        </div>
        <div className="field full">
          <div style={{ background: 'var(--paper-2)', padding: 14, borderRadius: 6, fontSize: 13, color: 'var(--ink-80)' }}>
            <div className="mono-meta mb-8">Brief preview</div>
            <div>{campaign.brief}</div>
          </div>
        </div>

        {campaign.rights && (
          <div className="field full">
            <div style={{ border: '1px solid var(--rule)', padding: 14, borderRadius: 6, fontSize: 13 }}>
              <div className="mono-meta mb-8">Rights you'd be granting</div>
              <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
                <li>· <strong>Exclusivity:</strong> {campaign.rights.exclusivity === 'none' ? 'None — you can work with competitors' : `No competing brands for ${campaign.rights.exclusivity}`}</li>
                <li>· <strong>Repurpose:</strong> {campaign.rights.repurpose === 'none' ? 'Organic post only — no re-use' : campaign.rights.repurpose === 'perpetual' ? 'Brand can re-use perpetually' : `Brand can re-use for ${campaign.rights.repurpose}`}</li>
                <li>· <strong>Whitelisted ads:</strong> {campaign.rights.whitelistAds ? 'Yes — brand can run paid ads on your handle' : 'No'}</li>
                <li>· <strong>Derivative:</strong> {campaign.rights.derivative ? 'Brand can edit/cut/remix' : 'Original cuts only'}</li>
              </ul>
              <div className="text-ink-60 mt-8" style={{ fontSize: 11 }}>Adjust your proposed rate to reflect what you're granting.</div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
