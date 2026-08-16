// DisputePanel.tsx — the open dispute, for BOTH parties.
//
// WORKFLOW-GAPS F3.
//
// Two separate holes met here:
//
//  1. `v2AddDisputeMessage`, `v2WithdrawDispute` and `getOpenDisputeForCollab`
//     were implemented, tested, and called from no screen at all. A party
//     could file a dispute, watch their escrow freeze, and find nothing on
//     the page acknowledging it existed.
//
//  2. The brand had NO dispute surface anywhere. `CollabDetail` is creator-
//     only by design — it is the creator's mutation surface, and it hard-
//     refuses a brand with "belongs to a different account". `CampaignDetail`
//     never mentioned disputes. So the brand was told by notification that a
//     dispute existed and had nowhere to go.
//
// That second one is why this component lives in its own file rather than
// inside CollabDetail: a settlement is a handshake, and shipping it on one
// party's screen only is precisely the F1 mistake — the person who has to
// respond being the one person who cannot see it. Caught by clicking through
// as the brand, not by any test.
//
// Persona-agnostic on purpose: it reads `session.userId` and lets the action
// layer decide what that user is allowed to do, so the same component serves
// the creator on CollabDetail and the brand on CampaignDetail.

import { useState } from 'react';
import { fmtUSD } from '../lib';
import { useStore } from '@/lib/api/store';
import { pushToast } from '@/lib/utils/toast';
import { parseNumberInput } from '@/lib/utils/format';
import {
  v2AddDisputeMessage, v2WithdrawDispute,
  v2ProposeDisputeSplit, v2AgreeDisputeSplit, v2DeclineDisputeSplit,
  v2WithdrawDisputeSplit, v2DisputeSettleableAmount,
} from '../v2DisputeActions';

// =====================================================================
// THE OPEN DISPUTE (WORKFLOW-GAPS F3)
// =====================================================================
//
// `v2RaiseDispute` had a caller. `v2AddDisputeMessage`, `v2WithdrawDispute`
// and `getOpenDisputeForCollab` did not — all three were implemented, tested,
// and unreachable from any screen. So a party could file a dispute, watch
// their escrow freeze, and then find nothing on the page acknowledging it
// existed: no thread, no status, and no exit that did not require an admin.
//
// This panel is that missing surface, and F3's split proposal is the exit.

export function DisputePanel({ collabId }: { collabId: string }) {
  const db = useStore((s) => s.db);
  const session = useStore((s) => s.session);
  const [message, setMessage] = useState('');
  const [proposing, setProposing] = useState(false);
  const [amount, setAmount] = useState(0);
  const [note, setNote] = useState('');

  const dispute = collabId
    ? db.disputes.find(
        (d) => d.collaborationId === collabId && (d.status === 'open' || d.status === 'in-review'),
      )
    : undefined;
  if (!dispute) return null;

  const meId = session?.userId ?? '';
  const available = v2DisputeSettleableAmount(dispute.id);
  const proposal = dispute.proposal ?? null;
  const iRaised = dispute.raisedByUserId === meId;

  const act = (fn: () => void, ok: string) => {
    try {
      fn();
      pushToast(ok, 'good');
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Something went wrong', 'bad');
    }
  };

  return (
    <div
      className="v2-card v2-card-pad"
      style={{ marginTop: 10, borderLeft: '3px solid var(--v2-danger, #c0392b)' }}
    >
      <div className="v2-row" style={{ justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
        <div className="v2-eyebrow">Dispute open · {dispute.category}</div>
        <span className="v2-muted" style={{ fontSize: 12 }}>
          {iRaised ? 'You raised this' : `Raised by the ${dispute.raisedByRole}`}
        </span>
      </div>
      <p style={{ fontSize: 13.5, margin: '0 0 8px', lineHeight: 1.5 }}>{dispute.description}</p>
      <p className="v2-muted" style={{ fontSize: 12.5, margin: '0 0 12px', lineHeight: 1.5 }}>
        {fmtUSD(available)} is frozen in escrow until this is resolved. You can
        settle it between yourselves below, or wait for a reviewer.
      </p>

      {/* ── The thread ─────────────────────────────────────────────── */}
      {dispute.messages.length > 0 && (
        <div style={{ marginBottom: 10, display: 'grid', gap: 6 }}>
          {dispute.messages.map((m) => (
            <div key={`${m.userId}-${m.at}`} style={{ fontSize: 12.5, lineHeight: 1.45 }}>
              <span className="v2-muted">{m.userId === meId ? 'You' : 'Them'}: </span>
              {m.body}
            </div>
          ))}
        </div>
      )}
      <div className="v2-row" style={{ gap: 8, marginBottom: 12 }}>
        <label className="v2-sr-only" htmlFor="v2-dispute-msg">Add a message to the dispute</label>
        <input
          id="v2-dispute-msg"
          className="v2-input"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Add context for the other side…"
          style={{ flex: 1 }}
        />
        <button
          className="v2-btn v2-btn-outline v2-btn-sm"
          type="button"
          disabled={!message.trim()}
          onClick={() => act(() => {
            v2AddDisputeMessage(dispute.id, meId, message.trim());
            setMessage('');
          }, 'Message added')}
        >Send</button>
      </div>

      {/* ── The split: propose / agree / decline ───────────────────── */}
      {proposal ? (
        <div style={{ borderTop: '1px solid var(--v2-rule)', paddingTop: 10 }}>
          <div className="v2-eyebrow" style={{ marginBottom: 6 }}>Settlement proposed</div>
          <p style={{ fontSize: 13.5, margin: '0 0 4px' }}>
            {fmtUSD(Math.min(proposal.releaseToCreator, available))} to the creator,{' '}
            {fmtUSD(Math.max(0, available - proposal.releaseToCreator))} refunded to the brand.
          </p>
          <p className="v2-muted" style={{ fontSize: 12.5, margin: '0 0 10px' }}>“{proposal.note}”</p>
          {proposal.by === meId ? (
            <div className="v2-row" style={{ gap: 8, alignItems: 'center' }}>
              <span className="v2-muted" style={{ fontSize: 12 }}>
                Waiting on the other side to agree.
              </span>
              <button
                className="v2-link-btn v2-muted"
                type="button"
                style={{ fontSize: 12 }}
                onClick={() => act(() => v2WithdrawDisputeSplit(dispute.id, meId), 'Proposal withdrawn')}
              >Withdraw</button>
            </div>
          ) : (
            <div className="v2-row" style={{ gap: 8 }}>
              <button
                className="v2-btn v2-btn-primary v2-btn-sm"
                type="button"
                onClick={() => act(
                  () => v2AgreeDisputeSplit(dispute.id, meId),
                  'Settled — the dispute is closed and the split has been paid out',
                )}
              >Agree and close the dispute</button>
              <button
                className="v2-btn v2-btn-outline v2-btn-sm"
                type="button"
                onClick={() => act(
                  () => v2DeclineDisputeSplit(dispute.id, meId),
                  'Proposal declined — the dispute stays open',
                )}
              >Decline</button>
            </div>
          )}
        </div>
      ) : proposing ? (
        <div style={{ borderTop: '1px solid var(--v2-rule)', paddingTop: 10 }}>
          <div className="v2-eyebrow" style={{ marginBottom: 8 }}>Propose a split</div>
          <p className="v2-muted" style={{ fontSize: 12.5, margin: '0 0 10px', lineHeight: 1.5 }}>
            {fmtUSD(available)} is held. Whatever you don't send to the creator
            refunds to the brand. Agreeing closes the dispute — no reviewer needed.
          </p>
          <label className="v2-eyebrow" htmlFor="v2-dispute-split" style={{ display: 'block', marginBottom: 6 }}>
            To the creator
          </label>
          <div className="v2-onboarding-rate" style={{ marginBottom: 10 }}>
            <span className="v2-onboarding-rate-prefix">$</span>
            <input
              id="v2-dispute-split"
              type="number"
              min={0}
              max={available}
              value={amount}
              onChange={(e) => setAmount(parseNumberInput(e.target.value, { min: 0, max: available }))}
            />
          </div>
          <label className="v2-sr-only" htmlFor="v2-dispute-split-note">Why this split</label>
          <textarea
            id="v2-dispute-split-note"
            className="v2-input"
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Why this split — the other side has to agree to it."
            style={{ width: '100%', marginBottom: 10, resize: 'vertical' }}
          />
          <div className="v2-row" style={{ gap: 8, justifyContent: 'flex-end' }}>
            <button className="v2-btn v2-btn-outline v2-btn-sm" type="button" onClick={() => setProposing(false)}>
              Cancel
            </button>
            <button
              className="v2-btn v2-btn-primary v2-btn-sm"
              type="button"
              disabled={!note.trim()}
              onClick={() => act(() => {
                v2ProposeDisputeSplit(dispute.id, amount, note, meId);
                setProposing(false);
                setNote('');
              }, 'Split proposed — waiting on the other side')}
            >Propose</button>
          </div>
        </div>
      ) : (
        <div
          className="v2-row"
          style={{ gap: 12, justifyContent: 'flex-end', borderTop: '1px solid var(--v2-rule)', paddingTop: 10 }}
        >
          {iRaised && (
            <button
              className="v2-link-btn v2-muted"
              type="button"
              style={{ fontSize: 12 }}
              onClick={() => act(
                () => v2WithdrawDispute(dispute.id, meId),
                'Dispute withdrawn — escrow unfrozen',
              )}
            >Withdraw the dispute</button>
          )}
          {available > 0 && (
            <button
              className="v2-link-btn"
              type="button"
              style={{ fontSize: 12 }}
              onClick={() => { setAmount(Math.round(available / 2)); setProposing(true); }}
            >Propose a split to end this</button>
          )}
        </div>
      )}
    </div>
  );
}
