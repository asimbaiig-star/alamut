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
import { netOf } from '@/lib/api/money';
import { offerStaleness, applicationLapse, reviewOverdue } from '@/lib/api/staleness';
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
  /** Opens the permalink editor on the first approved deliverable. Optional
   *  so existing call sites keep compiling; when absent the banner falls
   *  back to messaging alone. */
  onAddLiveLink?: () => void;
  /** The rate the creator asked for in their pitch, when they pitched. */
  myProposedRate?: number;
  /** When the pending offer was sent — drives the staleness label. */
  offerSentAt?: string;
  /** When this pitch was submitted — drives "waiting N days" + the lapse warning. */
  applicationSubmittedAt?: string;
  /** When the creator's submission went in — drives the overdue-review note. */
  submissionSubmittedAt?: string;
}

export function StageActionBanner({
  stage, pendingOffer, campaignBrand, campaignName, campaignPlacement,
  myApplicationId, myApplicationStatus, latestSubmissionStatus, livePermalink,
  activeOfferRate, latestRevisionNote, inviteMessage,
  onAccept, onCounter, onUpload, onWithdraw, onMessageBrand,
  onLeaveReview, onAddLiveLink, myProposedRate,
  offerSentAt, applicationSubmittedAt, submissionSubmittedAt,
}: StageActionBannerProps) {
  // Each stage gets its own banner content. The container uses the same
  // soft-accent gradient so the visual rhythm stays consistent.
  let title = '';
  let body = '';
  let actions: React.ReactNode = null;
  // Secondary time-based line, appended under `body` when set.
  let extraNote: string | null = null;
  let tone: 'accent' | 'moss' | 'ink' = 'accent';

  // A2 — the creator's own ask, so an offer is never presented as a neutral
  // number. Pitch $2,000, receive $1,200, and the UI used to show only
  // $1,200; neither side saw that a gap existed.
  // Time-based context. Offers never expire (product call: no deal is lost to
  // a clock) so this LABELS a stale offer rather than blocking it.
  const staleNote = pendingOffer && offerSentAt
    ? offerStaleness(offerSentAt).note
    : null;

  const askLine = myProposedRate && pendingOffer && myProposedRate !== pendingOffer.rate
    ? ` You asked ${fmtUSD(myProposedRate)}${pendingOffer.rate < myProposedRate
        ? ` — this is ${fmtUSD(myProposedRate - pendingOffer.rate)} below it.`
        : ` — this is ${fmtUSD(pendingOffer.rate - myProposedRate)} above it.`}`
    : '';

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
    {
      const lapse = applicationSubmittedAt
        ? applicationLapse({ status: 'submitted', submittedAt: applicationSubmittedAt })
        : null;
      title = lapse && lapse.days > 0
        ? `Application sent — waiting ${lapse.days} ${lapse.days === 1 ? 'day' : 'days'} on ${campaignBrand}`
        : 'Application sent — awaiting brand response';
      if (lapse?.warn) {
        // Silence used to be indistinguishable from a slow reply, forever.
        extraNote = `No reply yet. This pitch closes in ${lapse.daysLeft} ${lapse.daysLeft === 1 ? 'day' : 'days'} so the slot frees up — you can withdraw sooner if you'd rather.`;
      }
    }
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
    body = `${fmtUSD(pendingOffer.rate)} for ${campaignPlacement}. ${pendingOffer.message ? `"${pendingOffer.message}"` : ''} Your net after fees: ${fmtUSD(netOf(pendingOffer.rate))}.${askLine}${staleNote ? ` ${staleNote}` : ''}`;
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
  } else if (stage === 'negotiating') {
    // The creator countered and it's the BRAND's move.
    //
    // `computeCollabStage` puts a pair at 'negotiating' whenever an offer is
    // pending OR countered, regardless of who moved last — but `pendingOffer`
    // only resolves when the ball is in the CREATOR's court. So after
    // countering, no branch matched, the component returned null, and the
    // entire "What's next" card vanished: zero acknowledgement that the
    // counter had been sent. A test pinned that as correct behaviour.
    title = 'Counter sent — waiting on the brand';
    body = `We'll notify you as soon as ${campaignBrand} responds. You can keep talking in the meantime.`;
    actions = (
      <button className="v2-btn v2-btn-outline v2-btn-sm" type="button" onClick={onMessageBrand}>
        Message brand
      </button>
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
    if (submissionSubmittedAt) {
      const rev = reviewOverdue(submissionSubmittedAt);
      if (rev.creatorNote) extraNote = rev.creatorNote;
    }
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
      // No "typically reviews within 24 hours" — nothing measures brand
      // review time. This was written three lines below the comment
      // explaining why the same claim was removed from the pitched branch.
      body = `We'll notify you as soon as ${campaignBrand} responds.`;
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
    // The banner told the creator to paste the live URL and then offered
    // only "Message brand" — the actual move had no CTA at the exact moment
    // they hold the ball. `onAddLiveLink` scrolls/opens the permalink editor
    // on the deliverable; messaging stays as the secondary.
    actions = (
      <>
        {onAddLiveLink && (
          <button className="v2-btn v2-btn-primary v2-btn-sm" type="button" onClick={onAddLiveLink}>
            {Icon.external} Add live link
          </button>
        )}
        <button className="v2-btn v2-btn-outline v2-btn-sm" type="button" onClick={onMessageBrand}>
          Message brand
        </button>
      </>
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
    title = `Paid — ${activeOfferRate ? fmtUSD(netOf(activeOfferRate)) : ''} received`;
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
          {/* Time-based context — a waiting count, a lapse warning, or the
              note that a payout is sitting in escrow because the brand
              hasn't reviewed. Set by the stage branches above. */}
          {extraNote && (
            <p style={{ margin: '6px 0 0', fontSize: 12.5, lineHeight: 1.5, fontWeight: 500 }}>
              {extraNote}
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
