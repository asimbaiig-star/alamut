// CollabSidePanel — shared inbox/deal right pane.
//
// §2.5 collapse — pre-collapse the workspace had two surfaces showing
// the same collaboration: `Inbox` (3-pane, compact side panel) and
// `DealRoom` (single-pane, detailed brief + timeline aside). The two
// reads of the same collab drifted: a brand could see one set of
// milestones in Inbox and a different set in DealRoom for the same
// deal. This component is the single source of truth — both surfaces
// consume it. The legacy `deal:<convId>` route now redirects to
// `Inbox` with `panelMode='detailed'`, eliminating the second surface.
//
// Mode contract:
//   - 'compact'  — inbox-default. Campaign card + 4-step milestones +
//                  money breakdown + "Open campaign" link.
//   - 'detailed' — opened from a deal link. Compact + brief excerpt
//                  + per-stage action hint + "View full brief" affordance.
//                  Visually richer but ALL the data is the same — the
//                  detailed mode just shows more of it. No drift possible.

import { fmtUSDfull as fmtUSD } from '@/screens/workspace-v2/lib';
import { Icon } from '@/screens/workspace-v2/lib';
import type { V2Campaign, V2Creator, V2Collab } from '@/screens/workspace-v2/data';
import { splitAcrossSlots, PLATFORM_FEE_LABEL, WHT_LABEL } from '@/lib/api/money';

export interface CollabSidePanelProps {
  campaign: V2Campaign;
  counterparty: V2Creator;
  /** The active collaboration, when one exists. Drives stage-aware
   *  hints and milestone state. */
  collab: V2Collab | null;
  persona: 'brand' | 'creator';
  mode: 'compact' | 'detailed';
  onRoute: (r: string) => void;
}

export function CollabSidePanel({
  campaign, counterparty, collab, persona, mode, onRoute,
}: CollabSidePanelProps) {
  // Where THIS deal is. These steps used to read the campaign's counters
  // (any creator's post going live), so a deal still in review showed
  // "Live on platform" as current. They follow the deal's own stage now.
  const ORDER = ['invited', 'pitched', 'negotiating', 'confirmed', 'submitted', 'approved', 'live', 'paid'];
  const at = collab ? ORDER.indexOf(collab.stage) : -1;
  const step = (doneFrom: string, activeAt: string) =>
    at >= ORDER.indexOf(doneFrom) ? 'done' as const : at === ORDER.indexOf(activeAt) ? 'active' as const : 'pending' as const;
  const milestones: { label: string; state: 'done' | 'active' | 'pending'; detail?: string }[] = collab && collab.stage !== 'cancelled' ? [
    { label: 'Agreed, money held', state: at >= ORDER.indexOf('confirmed') ? 'done' : 'active', detail: 'The offer is accepted and the full amount is held in escrow.' },
    { label: 'Content submitted', state: step('submitted', 'confirmed'), detail: 'The creator sends the work for review.' },
    { label: 'Approved', state: step('approved', 'submitted'), detail: 'The brand approves it, or asks for changes.' },
    { label: 'Live and confirmed', state: step('live', 'approved'), detail: 'The creator posts it; the brand confirms the link and that post’s share is released.' },
    { label: 'Paid', state: step('paid', 'live'), detail: 'Every post is released to the creator’s wallet.' },
  ] : [];
  void campaign;

  return (
    <aside className="v2-inbox-side" aria-label="Collaboration details">
      {/* === Detailed-mode header — only renders in 'detailed' mode.
              Tells the user they came from a deal-link entry point so
              the breadcrumb story stays clear. === */}
      {mode === 'detailed' && (
        <div className="v2-inbox-side-section" data-collab-side-section="detail-header">
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: 'var(--v2-accent)',
              marginBottom: 4,
            }}
          >
            Deal · detailed view
          </div>
          <div style={{ fontSize: 13.5, color: 'var(--v2-ink-2)', lineHeight: 1.5 }}>
            {counterparty.name.split(' ')[0]} × {campaign.brand} · {campaign.name}
          </div>
        </div>
      )}

      {/* === Campaign card (both modes). === */}
      <div className="v2-inbox-side-section">
        <div className="v2-inbox-side-section-title">Campaign</div>
        <div
          style={{
            fontFamily: 'var(--v2-font-display)',
            fontSize: 16,
            fontWeight: 500,
            letterSpacing: '-0.014em',
            color: 'var(--v2-ink)',
            marginBottom: 6,
          }}
        >
          {campaign.name}
        </div>
        <div className="v2-row" style={{ gap: 8, marginBottom: 12 }}>
          <span
            className={`v2-pill ${campaign.status === 'Live' ? 'v2-pill-live' : 'v2-pill-draft'}`}
          >
            {campaign.status}
          </span>
          <span className="v2-muted" style={{ fontSize: 11.5 }}>{campaign.brand}</span>
        </div>
        <div className="v2-muted" style={{ fontSize: 12.5, lineHeight: 1.5, marginBottom: 12 }}>
          {campaign.placement}
        </div>
        <button
          className="v2-btn v2-btn-outline v2-btn-sm"
          type="button"
          style={{ width: '100%', justifyContent: 'center' }}
          onClick={() => onRoute(persona === 'brand' ? `campaign:${campaign.id}` : `brief:${campaign.id}`)}
        >
          Open {persona === 'brand' ? 'campaign' : 'brief'} {Icon.arrow}
        </button>
      </div>

      {/* === Brief excerpt (detailed mode only) === */}
      {mode === 'detailed' && campaign.brief && (
        <div className="v2-inbox-side-section">
          <div className="v2-inbox-side-section-title">Brief excerpt</div>
          <p
            style={{
              margin: 0,
              fontSize: 12.5,
              color: 'var(--v2-ink-2)',
              lineHeight: 1.55,
              maxHeight: 8 * 16,
              overflow: 'hidden',
              display: '-webkit-box',
              WebkitLineClamp: 6,
              WebkitBoxOrient: 'vertical',
            }}
          >
            {campaign.brief}
          </p>
          <button
            className="v2-btn v2-btn-ghost v2-btn-sm"
            type="button"
            style={{ marginTop: 8, padding: '4px 0' }}
            onClick={() => onRoute(persona === 'brand' ? `campaign:${campaign.id}` : `brief:${campaign.id}`)}
          >
            View full brief →
          </button>
        </div>
      )}

      {/* === Milestones (both modes; detailed adds per-step descriptions). === */}
      <div className="v2-inbox-side-section">
        <div className="v2-inbox-side-section-title">Milestones</div>
        {milestones.map((m, i) => (
          <div key={i} className={`v2-inbox-milestone ${m.state === 'done' ? 'is-done' : ''}`}>
            <span
              className={`v2-inbox-milestone-dot ${m.state === 'done' ? 'is-done' : m.state === 'active' ? 'is-active' : ''}`}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="v2-row" style={{ justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                <span className="v2-inbox-milestone-label">{m.label}</span>
                {m.state === 'active' && (
                  <span className="v2-pill v2-pill-accent" style={{ fontSize: 10 }}>Now</span>
                )}
              </div>
              {mode === 'detailed' && m.detail && (
                <div className="v2-muted" style={{ fontSize: 11.5, marginTop: 2, lineHeight: 1.45 }}>
                  {m.detail}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* === Money breakdown (both modes). What the creator actually
              pockets on THIS deal — fee + tax + net.

              Pre-fix this read `counterparty.rate`, the creator's generic
              advertised rate, rather than `collab.price`, the negotiated
              figure for this deal (already a prop, never used). For a
              CREATOR viewer `counterparty` is a synthesized brand object
              with `rate: 0`, so the one persona this section exists for
              saw $0 / $0 / $0 / $0 — while the real price sat in the
              context band on the same screen. === */}
      {collab && collab.price > 0 && (
        <div className="v2-inbox-side-section">
          <div className="v2-inbox-side-section-title">This deal</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Row label="Rate"                              value={fmtUSD(collab.price)} />
            {/* Per slot, as the ledger moves it (money.ts). */}
            <Row label={`Platform fee (${PLATFORM_FEE_LABEL})`} value={fmtUSD(splitAcrossSlots(collab.price, Math.max(1, collab.deliverables.length)).fee)} muted />
            <Row label={`Tax (${WHT_LABEL})`}                   value={fmtUSD(splitAcrossSlots(collab.price, Math.max(1, collab.deliverables.length)).tax)} muted />
            <div
              className="v2-row"
              style={{
                justifyContent: 'space-between',
                paddingTop: 8,
                borderTop: '1px solid var(--v2-line)',
              }}
            >
              <span style={{ fontWeight: 600, fontSize: 13 }}>Net to creator</span>
              <span
                className="v2-tabular v2-accent-text"
                style={{ fontWeight: 700, fontSize: 14 }}
              >
                {fmtUSD(splitAcrossSlots(collab.price, Math.max(1, collab.deliverables.length)).net)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* === Stage hint (detailed mode only) — tells the user, in one
              sentence, what the deal is doing right now. Reads from
              the same `collab.stage` the inbox context band uses, so
              the two cannot disagree. === */}
      {mode === 'detailed' && collab && (
        <div className="v2-inbox-side-section">
          <div className="v2-inbox-side-section-title">What's next</div>
          <div style={{ fontSize: 12.5, color: 'var(--v2-ink-2)', lineHeight: 1.5 }}>
            {detailedStageHint(collab.stage, persona, counterparty.name.split(' ')[0])}
          </div>
        </div>
      )}
    </aside>
  );
}

function Row({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="v2-row" style={{ justifyContent: 'space-between', fontSize: 13 }}>
      <span className={muted ? 'v2-muted' : ''}>{label}</span>
      <span className={`v2-tabular ${muted ? 'v2-muted' : ''}`}>{value}</span>
    </div>
  );
}

/** Stage × persona one-liner. Same content the Inbox context band
 *  uses (`contextHint` in Inbox.tsx) but written for the side panel
 *  context — slightly more descriptive since it's not bandwidth-
 *  constrained. If a future refactor wants ONE source for both,
 *  lift this into `v2Adapters.ts` next to `V2_PIPELINE_STAGES`. */
function detailedStageHint(stage: string, persona: 'brand' | 'creator', firstName: string): string {
  if (persona === 'brand') {
    if (stage === 'pitched')     return `${firstName} pitched into the campaign — review their pitch, send an offer with terms, or pass.`;
    if (stage === 'invited')     return `${firstName} has been invited. Awaiting their response — message them to nudge.`;
    if (stage === 'negotiating') return `Offer is on the table. ${firstName} can accept, counter, or decline.`;
    if (stage === 'confirmed')   return `Deal confirmed. ${firstName} is preparing the first draft — funds are reserved in escrow.`;
    if (stage === 'submitted')   return `${firstName} submitted a draft. Review and approve, or request a revision (one round included).`;
    if (stage === 'approved')    return `Approved. Awaiting ${firstName} to mark the content live with the public URL.`;
    if (stage === 'live')        return `Live. Each post you confirm releases its share to ${firstName}.`;
    if (stage === 'paid')        return `Closed. Payment cleared to ${firstName}'s wallet — leave a review when ready.`;
  } else {
    if (stage === 'pitched')     return `Pitch sent — awaiting brand response.`;
    if (stage === 'invited')     return `The brand invited you. If they named a rate, accept or counter; otherwise message back to align on scope and price.`;
    if (stage === 'negotiating') return `Offer received — accept the terms or send a counter.`;
    if (stage === 'confirmed')   return `Deal confirmed. Time to upload your first draft.`;
    if (stage === 'submitted')   return `Draft submitted. Waiting for the brand’s review.`;
    if (stage === 'approved')    return `Approved. Post the content and attach the live URL to release the funds.`;
    if (stage === 'live')        return `Live. Each post’s share is released once the brand confirms it.`;
    if (stage === 'paid')        return `Paid — all done. Leave the brand a review when ready.`;
  }
  return '';
}
