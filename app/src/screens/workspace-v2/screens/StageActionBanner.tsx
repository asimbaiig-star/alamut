// StageActionBanner — the comprehensive stage-aware action band
// shown right below the timeline on CollabDetail.
//
// Tells the creator exactly what's happening and what they can do
// next. Each stage gets its own banner content: title + body + an
// `actions` slot rendering 1–3 buttons (the verb-led primary CTA + 0–2
// secondary actions). Pre-extraction this was a private function
// inside CollabDetail.tsx; pulled out so it's testable in isolation
// via RTL.
//
// Contract:
//   - Component is purely presentational. Handlers are passed via
//     props; the parent (CollabDetail) owns side effects (mutations,
//     modals, navigation).
//   - Returns null when no stage matches — caller renders nothing.
//   - `tone` (accent | moss | ink) drives the soft background colour;
//     defaults to 'accent' for action-required states, 'moss' for
//     terminal / waiting-on-other-side states.

import type React from 'react';
import { fmtUSD, Icon } from '../lib';
import type { V2CollabStage } from '../data';

export interface StageActionBannerProps {
  stage: V2CollabStage;
  pendingOffer?: { id: string; rate: number; message: string };
  campaignBrand: string;
  campaignName: string;
  campaignPlacement: string;
  myApplicationId?: string;
  myApplicationStatus?: string;
  latestSubmissionStatus?: string;
  livePermalink?: string;
  activeOfferRate?: number;
  latestRevisionNote?: string;
  /** Pitch message from the brand on a cold invite — stored on
   *  `Collaboration.history[].reason` as "brand-invite: <message>".
   *  Surfaced verbatim in the no-offer `invited` branch so the creator
   *  can see why the brand reached out before deciding. Optional —
   *  the branch falls back to a generic prompt when absent. */
  inviteMessage?: string;
  onAccept: () => void;
  onCounter: () => void;
  onUpload: () => void;
  onWithdraw: () => void;
  onMessageBrand: () => void;
  onLeaveReview: () => void;
}

export function StageActionBanner({
  stage, pendingOffer, campaignBrand, campaignName, campaignPlacement,
  myApplicationId, myApplicationStatus, latestSubmissionStatus, livePermalink,
  activeOfferRate, latestRevisionNote, inviteMessage,
  onAccept, onCounter, onUpload, onWithdraw, onMessageBrand,
  onLeaveReview,
}: StageActionBannerProps) {
  // Each stage gets its own banner content. The container uses the same
  // soft-accent gradient so the visual rhythm stays consistent.
  let title = '';
  let body = '';
  let actions: React.ReactNode = null;
  let tone: 'accent' | 'moss' | 'ink' = 'accent';

  if (stage === 'invited' && pendingOffer) {
    title = `${campaignBrand} invited you to ${campaignName}`;
    body = `Offered ${fmtUSD(pendingOffer.rate)} for ${campaignPlacement}. ${pendingOffer.message ? `"${pendingOffer.message}"` : ''}`;
    actions = (
      <>
        <button className="v2-btn v2-btn-outline v2-btn-sm" type="button" onClick={onMessageBrand}>
          Message brand
        </button>
        <button className="v2-btn v2-btn-outline v2-btn-sm" type="button" onClick={onCounter}>
          Counter
        </button>
        <button className="v2-btn v2-btn-primary v2-btn-sm" type="button" onClick={onAccept}>
          {Icon.check} Accept invitation
        </button>
      </>
    );
  } else if (stage === 'invited') {
    // Cold-invite path — brand reached out via InviteCreatorsModal which
    // creates a Collaboration in `invited` stage WITHOUT a corresponding
    // offer (by design — the brand hasn't named a rate yet). Pre-fix this
    // branch was missing, so the no-offer invited collab fell through and
    // the banner rendered nothing. The creator landed on CollabDetail
    // with the timeline + brief but no action affordances — a dead end.
    //
    // We surface the brand's pitch verbatim and let the creator open a
    // thread to negotiate scope + rate. Accept/Counter aren't shown here
    // because there's no offer to accept or counter against — the brand
    // sends a proper offer through the Inbox conversation (or directly
    // from the kanban after the creator engages).
    title = `${campaignBrand} invited you to ${campaignName}`;
    body = inviteMessage
      ? `"${inviteMessage}" — ${campaignBrand} hasn't named a rate yet. Message them to align on scope and price, and a proper offer will follow.`
      : `${campaignBrand} reached out about ${campaignPlacement}. Message them to align on scope and price, and a proper offer will follow.`;
    actions = (
      <button className="v2-btn v2-btn-primary v2-btn-sm" type="button" onClick={onMessageBrand}>
        Message brand
      </button>
    );
  } else if (stage === 'pitched') {
    title = 'Application sent — awaiting brand response';
    // "typically replies within 48 hours" was invented: there is no
    // response-time field on Brand at all, so the figure was attributed to a
    // named brand with nothing behind it. The notification half is real.
    body = `We'll notify you in Inbox as soon as ${campaignBrand} responds.`;
    actions = (
      <>
        {myApplicationId && myApplicationStatus !== 'withdrawn' && (
          <button className="v2-btn v2-btn-outline v2-btn-sm" type="button" onClick={onWithdraw}>
            Withdraw application
          </button>
        )}
        <button className="v2-btn v2-btn-outline v2-btn-sm" type="button" onClick={onMessageBrand}>
          Message brand
        </button>
      </>
    );
  } else if (stage === 'negotiating' && pendingOffer) {
    title = `${campaignBrand} sent an offer`;
    body = `${fmtUSD(pendingOffer.rate)} for ${campaignPlacement}. ${pendingOffer.message ? `"${pendingOffer.message}"` : ''} Your net after fees: ${fmtUSD(Math.round(pendingOffer.rate * 0.85))}.`;
    actions = (
      <>
        <button className="v2-btn v2-btn-outline v2-btn-sm" type="button" onClick={onCounter}>
          Counter
        </button>
        <button className="v2-btn v2-btn-primary v2-btn-sm" type="button" onClick={onAccept}>
          {Icon.check} Accept ({fmtUSD(pendingOffer.rate)})
        </button>
      </>
    );
  } else if (stage === 'confirmed') {
    title = 'Confirmed — start creating';
    body = `${activeOfferRate ? `${fmtUSD(activeOfferRate)} secured in escrow. ` : ''}When your draft is ready, upload it for review.`;
    tone = 'moss';
    actions = (
      <button className="v2-btn v2-btn-primary v2-btn-sm" type="button" onClick={onUpload}>
        {Icon.plus} Upload content
      </button>
    );
  } else if (stage === 'submitted') {
    if (latestRevisionNote) {
      title = `${campaignBrand} requested changes`;
      body = `"${latestRevisionNote}" — address the feedback and resubmit the revised slot.`;
      tone = 'accent';
      actions = (
        <button className="v2-btn v2-btn-primary v2-btn-sm" type="button" onClick={onUpload}>
          {Icon.plus} Resubmit
        </button>
      );
    } else if (latestSubmissionStatus === 'revisions') {
      title = `${campaignBrand} requested changes`;
      body = 'Address the feedback in the deliverables list below and resubmit.';
      tone = 'accent';
      actions = (
        <button className="v2-btn v2-btn-primary v2-btn-sm" type="button" onClick={onUpload}>
          {Icon.plus} Resubmit
        </button>
      );
    } else {
      title = 'Submitted — awaiting brand review';
      body = `${campaignBrand} typically reviews within 24 hours. We'll notify you when they respond.`;
      tone = 'accent';
      actions = (
        <button className="v2-btn v2-btn-outline v2-btn-sm" type="button" onClick={onMessageBrand}>
          Message brand
        </button>
      );
    }
  } else if (stage === 'approved') {
    // P67 — honest copy: v2ApproveContent releases escrow to the wallet
    // in the same mutation as the approval. Pre-fix this banner promised
    // the release would happen later, "once it's marked live."
    title = 'Approved — funds released, post it';
    body = `${campaignBrand} approved your work and your payout is in your wallet. Post the content, then paste the live URL on the deliverable below so ${campaignBrand} can confirm.`;
    tone = 'moss';
    actions = (
      <button className="v2-btn v2-btn-outline v2-btn-sm" type="button" onClick={onMessageBrand}>
        Message brand
      </button>
    );
  } else if (stage === 'live') {
    title = 'Your post is live';
    body = livePermalink ? `Live at ${livePermalink}` : 'Tracking impressions, engagement, and saves now.';
    tone = 'moss';
    actions = livePermalink ? (
      <a
        className="v2-btn v2-btn-outline v2-btn-sm"
        href={livePermalink}
        target="_blank"
        rel="noopener noreferrer"
      >{Icon.external} View post</a>
    ) : null;
  } else if (stage === 'cancelled') {
    // Explicit branch so a terminal collab explains itself. Pre-fix no branch
    // matched, `if (!title) return null` fired, and the creator got a blank
    // space where an explanation belonged.
    title = 'This collaboration isn\'t going ahead';
    body = 'Every offer and application here was declined or withdrawn. Nothing more to do — the record stays for your reference.';
  } else if (stage === 'paid') {
    title = `Paid — ${activeOfferRate ? fmtUSD(Math.round(activeOfferRate * 0.85)) : ''} received`;
    body = 'Funds are in your wallet. Withdraw to bank anytime.';
    tone = 'moss';
    actions = (
      <button className="v2-btn v2-btn-outline v2-btn-sm" type="button" onClick={onLeaveReview}>
        Leave review
      </button>
    );
  }

  if (!title) return null;

  const bg = tone === 'moss' ? 'var(--v2-moss-soft)' : 'var(--v2-accent-soft)';
  const accentColor = tone === 'moss' ? 'var(--v2-moss)' : 'var(--v2-accent)';

  return (
    <div
      className="v2-card v2-card-pad"
      style={{
        marginTop: 18,
        background: bg,
        borderColor: bg,
      }}
    >
      <div className="v2-row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 240 }}>
          <div className="v2-eyebrow" style={{ marginBottom: 4, color: accentColor }}>
            What's next
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>{title}</div>
          {body && (
            <p className="v2-muted" style={{ margin: 0, fontSize: 13, lineHeight: 1.5 }}>
              {body}
            </p>
          )}
        </div>
        <div className="v2-row" style={{ gap: 8 }}>
          {actions}
        </div>
      </div>
    </div>
  );
}
