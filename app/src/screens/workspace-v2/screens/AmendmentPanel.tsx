// AmendmentPanel.tsx — changing a deal after acceptance, for BOTH parties.
//
// WORKFLOW-GAPS E2 + E3.
//
// Persona-agnostic by construction: it reads `session.userId` and lets the
// action layer decide what that user may do, so the same component serves the
// creator on CollabDetail and the brand on CampaignDetail. That is not a
// stylistic preference — shipping a handshake on one party's screen only is
// the exact bug F1 and F3 each hit, where the person who has to respond was
// the one person who could not see the proposal.

import { useState } from 'react';
import { fmtUSD } from '../lib';
import { useStore } from '@/lib/api/store';
import { pushToast } from '@/lib/utils/toast';
import { parseNumberInput } from '@/lib/utils/format';
import type { ContentRights, DeliverableFormat, DeliverablePlatform } from '@/lib/api/types';
import {
  v2ProposeAmendment, v2AgreeAmendment, v2DeclineAmendment,
  v2WithdrawAmendment, effectiveRights,
} from '../v2AmendmentActions';

const REPURPOSE_LABEL: Record<ContentRights['repurpose'], string> = {
  none: 'no re-use',
  '90d': '90 days',
  '180d': '180 days',
  '365d': '12 months',
  perpetual: 'perpetual',
};

/** Only the options that are actually wider than what is already granted —
 *  the action layer refuses the rest, so offering them would be a trap. */
const REPURPOSE_ORDER: ContentRights['repurpose'][] = ['none', '90d', '180d', '365d', 'perpetual'];

// `Record<Union, …>` rather than a hand-listed array: my first pass wrote
// `['reel','story','post','video','short']` and 'video' is not a format at
// all, while five real ones were missing. As a Record, adding a platform or
// format to the union is a COMPILE ERROR here instead of an option that
// quietly never appears in the picker.
const PLATFORM_LABEL: Record<DeliverablePlatform, string> = {
  instagram: 'Instagram',
  tiktok: 'TikTok',
  youtube: 'YouTube',
  linkedin: 'LinkedIn',
  newsletter: 'Newsletter',
  podcast: 'Podcast',
  x: 'X',
};
const FORMAT_LABEL: Record<DeliverableFormat, string> = {
  reel: 'Reel',
  story: 'Story',
  post: 'Post',
  longform: 'Long-form',
  short: 'Short',
  episode: 'Episode',
  thread: 'Thread',
  carousel: 'Carousel',
  live: 'Live',
};
const PLATFORMS = Object.keys(PLATFORM_LABEL) as DeliverablePlatform[];
const FORMATS = Object.keys(FORMAT_LABEL) as DeliverableFormat[];

export function AmendmentPanel({ collabId }: { collabId: string }) {
  const db = useStore((s) => s.db);
  const session = useStore((s) => s.session);
  const [mode, setMode] = useState<null | 'rights' | 'scope'>(null);
  const [amount, setAmount] = useState(0);
  const [note, setNote] = useState('');
  const [repurposeTo, setRepurposeTo] = useState<ContentRights['repurpose']>('365d');
  const [platform, setPlatform] = useState<DeliverablePlatform>('instagram');
  const [format, setFormat] = useState<DeliverableFormat>('story');

  const collab = db.collaborations.find((c) => c.id === collabId);
  if (!collab || collab.cancelledAt || !collab.acceptedOfferId) return null;

  const meId = session?.userId ?? '';
  const open = (collab.amendments ?? []).find((a) => a.status === 'proposed') ?? null;
  const rights = effectiveRights(db, collab);
  const wider = REPURPOSE_ORDER.slice(REPURPOSE_ORDER.indexOf(rights.repurpose) + 1);

  const act = (fn: () => void, ok: string) => {
    try {
      fn();
      pushToast(ok, 'good');
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Something went wrong', 'bad');
    }
  };

  // ── A change is on the table ────────────────────────────────────────
  if (open) {
    const mine = open.proposedBy === meId;
    const what = open.kind === 'rights-extension'
      ? `Extend re-use to ${open.repurposeTo ? REPURPOSE_LABEL[open.repurposeTo] : 'a longer window'}`
      : `Add one ${open.addDeliverable ? FORMAT_LABEL[open.addDeliverable.format] : 'deliverable'} on ${open.addDeliverable ? PLATFORM_LABEL[open.addDeliverable.platform] : ''}`;
    return (
      <div className="v2-card v2-card-pad" style={{ marginTop: 10, borderLeft: '3px solid var(--v2-gold)' }}>
        <div className="v2-eyebrow" style={{ marginBottom: 6 }}>Change proposed</div>
        <p style={{ fontSize: 13.5, margin: '0 0 4px' }}>
          {what} — {fmtUSD(open.amount)}
        </p>
        <p className="v2-muted" style={{ fontSize: 12.5, margin: '0 0 6px' }}>“{open.note}”</p>
        <p className="v2-muted" style={{ fontSize: 12, margin: '0 0 10px' }}>
          {open.kind === 'rights-extension'
            ? 'Paid out on agreement — there is no new work to review.'
            : 'Held in escrow on agreement, and released when the extra deliverable is approved.'}
        </p>
        {mine ? (
          <div className="v2-row" style={{ gap: 8, alignItems: 'center' }}>
            <span className="v2-muted" style={{ fontSize: 12 }}>Waiting on the other side.</span>
            <button
              className="v2-link-btn v2-muted"
              type="button"
              style={{ fontSize: 12 }}
              onClick={() => act(() => v2WithdrawAmendment(collabId, open.id, meId), 'Proposal withdrawn')}
            >Withdraw</button>
          </div>
        ) : (
          <div className="v2-row" style={{ gap: 8 }}>
            <button
              className="v2-btn v2-btn-primary v2-btn-sm"
              type="button"
              onClick={() => act(
                () => v2AgreeAmendment(collabId, open.id, meId),
                open.kind === 'rights-extension'
                  ? 'Agreed — the extension has been paid'
                  : 'Agreed — the deliverable is added and funded',
              )}
            >Agree</button>
            <button
              className="v2-btn v2-btn-outline v2-btn-sm"
              type="button"
              onClick={() => act(() => v2DeclineAmendment(collabId, open.id, meId), 'Change declined')}
            >Decline</button>
          </div>
        )}
      </div>
    );
  }

  // ── Compose ─────────────────────────────────────────────────────────
  if (mode) {
    const isRights = mode === 'rights';
    return (
      <div className="v2-card v2-card-pad" style={{ marginTop: 10 }}>
        <div className="v2-eyebrow" style={{ marginBottom: 8 }}>
          {isRights ? 'Extend the usage licence' : 'Add a deliverable'}
        </div>
        <p className="v2-muted" style={{ fontSize: 12.5, margin: '0 0 10px', lineHeight: 1.5 }}>
          {isRights
            ? `Re-use is currently ${REPURPOSE_LABEL[rights.repurpose]}. Paid out on agreement.`
            : 'Funded into escrow on agreement, and released when the new deliverable is approved.'}
        </p>

        {isRights ? (
          <>
            <label className="v2-eyebrow" htmlFor="v2-amd-repurpose" style={{ display: 'block', marginBottom: 6 }}>
              Extend re-use to
            </label>
            <select
              id="v2-amd-repurpose"
              className="v2-input"
              value={repurposeTo}
              onChange={(e) => setRepurposeTo(e.target.value as ContentRights['repurpose'])}
              style={{ width: '100%', marginBottom: 10 }}
            >
              {wider.map((r) => <option key={r} value={r}>{REPURPOSE_LABEL[r]}</option>)}
            </select>
          </>
        ) : (
          <div className="v2-row" style={{ gap: 8, marginBottom: 10 }}>
            <div style={{ flex: 1 }}>
              <label className="v2-eyebrow" htmlFor="v2-amd-platform" style={{ display: 'block', marginBottom: 6 }}>
                Platform
              </label>
              <select
                id="v2-amd-platform"
                className="v2-input"
                value={platform}
                onChange={(e) => setPlatform(e.target.value as DeliverablePlatform)}
                style={{ width: '100%' }}
              >
                {PLATFORMS.map((p) => <option key={p} value={p}>{PLATFORM_LABEL[p]}</option>)}
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label className="v2-eyebrow" htmlFor="v2-amd-format" style={{ display: 'block', marginBottom: 6 }}>
                Format
              </label>
              <select
                id="v2-amd-format"
                className="v2-input"
                value={format}
                onChange={(e) => setFormat(e.target.value as DeliverableFormat)}
                style={{ width: '100%' }}
              >
                {FORMATS.map((f) => <option key={f} value={f}>{FORMAT_LABEL[f]}</option>)}
              </select>
            </div>
          </div>
        )}

        <label className="v2-eyebrow" htmlFor="v2-amd-amount" style={{ display: 'block', marginBottom: 6 }}>
          Fee
        </label>
        <div className="v2-onboarding-rate" style={{ marginBottom: 10 }}>
          <span className="v2-onboarding-rate-prefix">$</span>
          <input
            id="v2-amd-amount"
            type="number"
            min={0}
            value={amount}
            onChange={(e) => setAmount(parseNumberInput(e.target.value, { min: 0 }))}
          />
        </div>
        <label className="v2-sr-only" htmlFor="v2-amd-note">Why this change</label>
        <textarea
          id="v2-amd-note"
          className="v2-input"
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Why this change — the other side has to agree to it."
          style={{ width: '100%', marginBottom: 10, resize: 'vertical' }}
        />
        <div className="v2-row" style={{ gap: 8, justifyContent: 'flex-end' }}>
          <button className="v2-btn v2-btn-outline v2-btn-sm" type="button" onClick={() => setMode(null)}>
            Cancel
          </button>
          <button
            className="v2-btn v2-btn-primary v2-btn-sm"
            type="button"
            disabled={!note.trim() || amount <= 0}
            onClick={() => act(() => {
              v2ProposeAmendment(collabId, isRights
                ? { kind: 'rights-extension', amount, note, repurposeTo }
                : { kind: 'scope-addition', amount, note, addDeliverable: { platform, format } },
              meId);
              setMode(null);
              setNote('');
            }, 'Change proposed — waiting on the other side')}
          >Propose</button>
        </div>
      </div>
    );
  }

  // ── Entry points ────────────────────────────────────────────────────
  return (
    <div className="v2-row" style={{ gap: 12, justifyContent: 'flex-end', marginTop: 10 }}>
      {/* Only offered when there is actually something wider to sell. */}
      {wider.length > 0 && (
        <button
          className="v2-link-btn v2-muted"
          type="button"
          style={{ fontSize: 12 }}
          onClick={() => { setMode('rights'); setRepurposeTo(wider[wider.length - 1]); setAmount(0); }}
        >Extend usage rights</button>
      )}
      <button
        className="v2-link-btn v2-muted"
        type="button"
        style={{ fontSize: 12 }}
        onClick={() => { setMode('scope'); setAmount(0); }}
      >Add a deliverable</button>
    </div>
  );
}
