// CollabDetail.tsx — v2 creator-side collaboration detail
//
// What a creator sees when they click into one of their collabs from
// MyCollabs. Two-column layout:
//   left:  status hero (timeline) · deliverables list · brief
//   right: compensation breakdown (gross → fees → net) · brand contact

import { useEffect, useState } from 'react';
import { fmtUSD, Icon, Topbar } from '../lib';
import { useV2AllCampaigns, useV2CollabById, useV2Conversations, useV2CurrentCreator, v2EnsureThreadFor } from '../v2Hooks';
import { V2_STAGE_META } from '../v2Adapters';
import type { V2Collab, V2CollabStage, V2Deliverable } from '../data';
import { DealConversation } from './dealConversation';
import { ContentUploadModal } from './ContentUploadModal';
import { CounterOfferModal, CreatorMarkLiveModal } from './WorkflowModals';
import {
  v2AcceptOffer, v2WithdrawApplication, getApplicationFor, getActiveOfferFor,
  getLatestSubmissionFor, v2SetSubmissionPermalink, v2LeaveReview,
} from '../v2CampaignActions';
import { relativeTime } from '../v2Adapters';
import { v2RaiseDispute } from '../v2DisputeActions';
import { DisputePanel } from './DisputePanel';
import { AmendmentPanel } from './AmendmentPanel';
import { v2AgreeCollabCancel, v2DeclineCollabCancel,
  v2ProposeSettlement, v2AgreeSettlement, v2DeclineSettlement, v2SettleableAmount,
} from '../v2CollabActions';
import { useStore } from '@/lib/api/store';
import { parseNumberInput } from '@/lib/utils/format';
import { pushToast } from '@/lib/utils/toast';
import { LeaveReviewModal } from './LeaveReviewModal';
import { RaiseDisputeModal } from './RaiseDisputeModal';
import { StageActionBanner } from './StageActionBanner';
import { HomeHead, dollars } from './homeParts';
import { PLATFORM_FEE_LABEL, WHT_LABEL, slotGross, splitAcrossSlots, splitGross } from '@/lib/api/money';

interface Props {
  collabId: string;
  onRoute: (r: string) => void;
  /** §needs-you-direct-jump — when CreatorHome's Today list passes
   *  `?action=upload`, the upload modal opens on mount so the creator
   *  can submit content in one click from the home tile. */
  initialAction?: 'upload' | 'mark-live' | 'counter';
}

/**
 * Timeline steps, derived from `V2_STAGE_META`.
 *
 * This was a hand-written array of 6 of the 9 stages, maintained
 * independently of the Record that v2Adapters explicitly warns must not be
 * duplicated ("do not replace this Record with a plain array"). Two
 * consequences: `live` needed a special-case remap onto `approved`, and
 * `invited` was simply absent — `indexOf('invited')` returned -1, so
 * `currentIdx` was -1 and NO step rendered as done or active. A creator
 * opening a cold invite, the most common first touch, saw a timeline with
 * nothing highlighted at all.
 *
 * Deriving it means a new stage appears here automatically.
 */
const TIMELINE_STAGES: V2CollabStage[] = (Object.keys(V2_STAGE_META) as V2CollabStage[])
  .filter((s) => V2_STAGE_META[s].inPipeline)
  .sort((a, b) => V2_STAGE_META[a].order - V2_STAGE_META[b].order);

export function CollabDetail({ collabId, onRoute, initialAction }: Props) {
  const collab = useV2CollabById(collabId);
  const campaigns = useV2AllCampaigns();
  const db = useStore((s) => s.db);
  const currentCreator = useV2CurrentCreator();

  // Resolve "Message brand" → deal:<threadId> so the Inbox auto-selects
  // the right conversation. If no thread exists yet (creator hasn't
  // received an offer, so v2SendOffer never auto-created one), we
  // create one inline via v2EnsureThreadFor — the creator can then
  // start a fresh conversation. Falls back to plain inbox only if we
  // can't resolve creator + brand users at all.
  function openConversationForCollab() {
    if (!collab) { onRoute('creator-inbox'); return; }
    const threadId = v2EnsureThreadFor(collab.campaignId, collab.creatorId);
    if (!threadId) { onRoute('creator-inbox'); return; }
    // The conversation is on this page now (Round 8): go to it, not away.
    // On a phone it's behind the Messages switch, so show that first.
    setPhoneTab('messages');
    setTimeout(() => {
      const box = document.querySelector<HTMLTextAreaElement>('.v2-dc textarea');
      if (box) { box.scrollIntoView({ block: 'center', behavior: 'smooth' }); box.focus({ preventScroll: true }); }
      else onRoute(`deal:${threadId}`);
    }, 50);
  }
  // P1d §1.5 — track which deliverable is being uploaded as the FK id
  // (was a numeric slot index pre-P1d). The label is computed by the
  // adapter from platform/format and passed through for the modal title.
  const [uploadSlot, setUploadSlot] = useState<{ deliverableId: string; label: string; isResubmit: boolean } | null>(null);
  const [counterOpen, setCounterOpen] = useState(false);
  // Phones (Round 8, B): one of the deal's three parts at a time, so the
  // conversation isn't a long scroll below the next step. Desktop shows
  // all three; the switch is hidden there.
  const [phoneTab, setPhoneTab] = useState<'move' | 'messages' | 'money'>('move');
  const allConversations = useV2Conversations();
  // Paid-stage review modal. Pre-fix the "Leave review" button in the
  // banner just opened the inbox (v2LeaveReview existed but wasn't
  // reachable from any v2 surface). Now wired through this state.
  const [reviewOpen, setReviewOpen] = useState(false);
  // Money-at-stake dispute modal. Pre-fix v2RaiseDispute had no v2 caller.
  const [disputeOpen, setDisputeOpen] = useState(false);
  // Creator-side mark-live modal target. Set by the `?action=mark-live`
  // route param (CreatorHome's Today tile) or by the inline action on
  // an approved-but-not-yet-live deliverable.
  const [markLiveTarget, setMarkLiveTarget] = useState<{
    submissionId: string;
    deliverableLabel: string;
    initialPermalink?: string;
  } | null>(null);

  // Find an offer the creator should respond to. Two shapes count:
  //   1. status='pending'  — brand's first offer, no creator response yet
  //   2. status='countered' AND last round was the brand — brand counter-
  //      backed the creator's counter, so the ball is in the creator's
  //      court again. Without (2) the creator-side StageActionBanner
  //      would show no Accept/Counter buttons after a brand counter-back.
  const pendingOffer = collab
    ? db.offers
        .filter((o) => {
          if (o.campaignId !== collab.campaignId || o.creatorId !== collab.creatorId) return false;
          if (o.status === 'pending') return true;
          if (o.status === 'countered') {
            const last = o.rounds[o.rounds.length - 1];
            return last?.by === 'brand';
          }
          return false;
        })
        .sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime())[0]
    : undefined;

  // Pick the first deliverable that needs work — for the topbar "Submit
  // content" shortcut and the StageActionBanner's upload CTA. Revisions
  // take priority (brand is waiting); then pending slots in adapter order.
  const firstRevisionIdx = collab?.deliverables.findIndex((d) => d.status === 'revision') ?? -1;
  const firstPendingIdx = collab?.deliverables.findIndex((d) => d.status === 'pending') ?? -1;
  const nextSlot = firstRevisionIdx >= 0
    ? {
        deliverableId: collab!.deliverables[firstRevisionIdx].deliverableId,
        label: collab!.deliverables[firstRevisionIdx].label,
        isResubmit: true,
      }
    : firstPendingIdx >= 0
    ? {
        deliverableId: collab!.deliverables[firstPendingIdx].deliverableId,
        label: collab!.deliverables[firstPendingIdx].label,
        isResubmit: false,
      }
    : null;

  // Content can only be submitted once an offer is accepted — the stages at
  // or past `confirmed`. `v2SubmitContent` enforces this and throws
  // otherwise; the UI reflects the same rule.
  //
  // Declared HERE, above the effect that reads it, and not below with the
  // other derived values: this component early-returns twice (no collab, no
  // campaign) before that point, and the effect below is registered before
  // those returns. A `const` read from an effect closure in a render that
  // bailed out early would hit the temporal dead zone — reachable in exactly
  // the case the guard is for, a stale `?action=upload` link on a collab that
  // no longer resolves. `collab` is nullable here, hence the `!!collab`.
  const canSubmitContent =
    !!collab && ['confirmed', 'submitted', 'approved', 'live'].includes(collab.stage);

  // §needs-you-direct-jump — when the route arrived with `?action=upload`
  // (CreatorHome's Today list jumping into here), pop the upload modal
  // on mount. Only fires once per `initialAction` value to avoid re-
  // popping when the same collab is reopened later.
  useEffect(() => {
    // `canSubmitContent` gates the deep link too. A stale notification or a
    // shared `collab:<id>?action=upload` URL opened the modal on a collab
    // that couldn't accept a submission, with no button pressed at all.
    if (initialAction === 'upload' && canSubmitContent && nextSlot && !uploadSlot) {
      setUploadSlot(nextSlot);
      return;
    }
    // `?action=counter`: the home's open offer sheet sends "Counter" here.
    if (initialAction === 'counter' && pendingOffer) {
      setCounterOpen(true);
      return;
    }
    if (initialAction === 'mark-live' && collab && !markLiveTarget) {
      // Find an approved submission for this collab whose permalink isn't
      // set yet — that's the one the creator needs to paste a URL for.
      const target = db.submissions
        .filter((s) =>
          s.campaignId === collab.campaignId &&
          s.creatorId === collab.creatorId &&
          s.status === 'approved' &&
          !s.permalink,
        )
        .sort((a, b) => +new Date(b.submittedAt) - +new Date(a.submittedAt))[0];
      if (target) {
        const del = collab.deliverables.find((d) => d.deliverableId === target.deliverableId);
        setMarkLiveTarget({
          submissionId: target.id,
          deliverableLabel: del?.label ?? 'Deliverable',
          initialPermalink: target.permalink,
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialAction]);

  // For paid stage, find the actual approved+live submission.
  // P67 — also read the dedicated `permalink` field: the creator-paste
  // path sets ONLY that field (the LIVE: feedback entry is appended
  // later when the brand confirms via Mark Live). Pre-fix a collab at
  // stage 'live' via creator-pasted permalink rendered the banner's
  // generic copy instead of the actual URL + View-post button.
  const latestSubmission = collab ? getLatestSubmissionFor(collab.campaignId, collab.creatorId) : undefined;
  const liveFeedback = latestSubmission?.feedback?.find((f) => f.text?.startsWith('LIVE: '));
  const livePermalink = latestSubmission?.permalink
    ?? (liveFeedback ? liveFeedback.text.replace('LIVE: ', '') : undefined);
  const myApplication = collab ? getApplicationFor(collab.campaignId, collab.creatorId) : undefined;
  const activeOffer = collab ? getActiveOfferFor(collab.campaignId, collab.creatorId) : undefined;

  if (!collab) {
    return (
      <>
        <Topbar title="Collaboration" crumb="Not found" />
        <div className="v2-content"><p className="v2-muted">No collaboration with that id.</p></div>
      </>
    );
  }
  // Ownership gate — only the creator who owns the collab can see this
  // mutation surface (upload draft, accept offer, mark live). A brand
  // deep-linking here via stale state would otherwise hit creator-only
  // handlers.
  if (!currentCreator || collab.creatorId !== currentCreator.id) {
    return (
      <>
        <Topbar title="Collaboration" crumb="Access" />
        <div className="v2-content">
          {/* F27 — this used to be a terminal dead-end: no nav, no CTA. A
              brand landing here from a stale creator route had to edit the
              URL or clear storage to escape. */}
          <p className="v2-muted">
            You don't have access to this collaboration — it belongs to a
            different account.
          </p>
          <button
            className="v2-btn v2-btn-primary"
            type="button"
            style={{ marginTop: 12 }}
            // Persona-aware: 'home' is the brand dashboard, so a creator
            // viewing someone else's collab needs 'creator-home' instead.
            onClick={() => onRoute(currentCreator ? 'creator-home' : 'home')}
          >
            Go to my workspace
          </button>
        </div>
      </>
    );
  }
  const camp = campaigns.find((c) => c.id === collab.campaignId);
  // Two different failures used to share one message here. `stageMeta` came
  // from a `V2_PIPELINE_STAGES.find()`, which returns undefined for any
  // terminal stage — so a cancelled collab hit this branch and reported
  // "Campaign data unavailable" even though the campaign was perfectly fine.
  // The record was simply unreachable behind a misleading error.
  //
  // Stage metadata now comes from V2_STAGE_META, which covers EVERY stage by
  // construction, so this guard is only about genuinely missing campaign data.
  const stageMeta = V2_STAGE_META[collab.stage];
  if (!camp) {
    return (
      <>
        <Topbar title="Collaboration" crumb="Campaign missing" />
        <div className="v2-content">
          <p className="v2-muted">
            This collaboration points at a campaign that no longer exists.
          </p>
        </div>
      </>
    );
  }
  const isClosed = !V2_STAGE_META[collab.stage].inPipeline;

  // Net to creator after platform fee + WHT. P67 — must match the
  // data layer's actual rates (PLATFORM_FEE 10% + WHT 5% in
  // v2CampaignActions); pre-fix this card used 5%+5% so "You'll
  // receive" overstated the payout by 5 points vs what v2ApproveContent
  // actually credits the wallet.
  // The fee and withholding as the ledger will actually move them: per
  // deliverable, rounded per slot (money.ts). They used to be worked out
  // here with their own rounding, which can disagree with what's paid.
  const split = splitAcrossSlots(collab.price, Math.max(1, collab.deliverables.length));
  const platformFee = split.fee;
  const wht = split.tax;
  const net = split.net;

  // Pending mutual-cancel request from the brand. Pre-fix the creator
  // had no UI affordance to respond; the brand's v2RequestCollabCancel
  // wrote `Collaboration.cancellationRequest` but no surface read it.
  const collabRow = db.collaborations.find(
    (c) => c.campaignId === collab.campaignId && c.creatorId === collab.creatorId,
  );
  const cancelRequest = collabRow?.cancellationRequest ?? null;
  // The real escrow_hold row for this pair, if one exists. Money events are
  // read from the ledger — never inferred from a stage or a price.
  const escrowFundedAt = (() => {
    const creatorUserId = db.users.find((u) => u.creatorId === collab.creatorId)?.id;
    const row = db.transactions.find(
      (t) => t.campaignId === collab.campaignId
        && t.kind === 'escrow_hold'
        && t.counterpartyUserId === creatorUserId,
    );
    return row?.at ?? null;
  })();
  // F3 — an open dispute suppresses the "raise a dispute" link and drives
  // the panel below it.
  const openDispute = collabRow
    ? db.disputes.find(
        (d) => d.collaborationId === collabRow.id && (d.status === 'open' || d.status === 'in-review'),
      ) ?? null
    : null;

  // Cold-invite pitch — `v2InviteCreator` writes the brand's invitation
  // message into history as `"brand-invite: <message>"`. We surface it
  // verbatim on the no-offer `invited` banner so the creator can see why
  // the brand reached out before deciding to engage. Walk history in
  // reverse so a re-invite (would-be future case) finds the latest one.
  const inviteMessage = (() => {
    if (collab.stage !== 'invited' || !collabRow?.history) return undefined;
    for (let i = collabRow.history.length - 1; i >= 0; i--) {
      const h = collabRow.history[i];
      if (typeof h.reason === 'string' && h.reason.startsWith('brand-invite: ')) {
        return h.reason.slice('brand-invite: '.length).trim() || undefined;
      }
    }
    return undefined;
  })();

  return (
    <>
      <div className="v2-hm v2-dl">
      <div className="v2-hm-ground">
        <HomeHead
          crumb={<><button type="button" className="v2-hm-crumb-link" onClick={() => onRoute('creator-collabs')}>Deals</button> · {camp.brand}</>}
          title={camp.name}
          sub={`${camp.placement ? `${camp.placement} · ` : ''}${stageMeta.label}`}
          actions={
            <>
              <button type="button" className="v2-hm-btn" onClick={openConversationForCollab}>Message {camp.brand}</button>
              {/* Only when there is something to submit: before an offer is
                  accepted v2SubmitContent refuses, and once every slot is in
                  there's nothing left to send. */}
              {canSubmitContent && nextSlot && (
                <button type="button" className="v2-hm-btn is-dark" onClick={() => setUploadSlot(nextSlot)}>
                  {nextSlot.isResubmit ? 'Resubmit' : 'Submit'} {nextSlot.label}
                </button>
              )}
            </>
          }
        />
        {!isClosed && <CollabTimeline stage={collab.stage} />}
      </div>
      <div className="v2-ls-body">
        {cancelRequest && collabRow && currentCreator && (
          <div
            className="v2-card v2-card-pad"
            style={{
              marginBottom: 14,
              borderLeft: '3px solid var(--v2-accent)',
              background: 'var(--v2-accent-soft)',
            }}
            role="status"
          >
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>
              {camp.brand} requested to cancel this collab
            </div>
            <div className="v2-muted" style={{ fontSize: 12.5, marginBottom: 8 }}>
              "{cancelRequest.reason}" — agree to release the held escrow back to the brand; decline to keep working.
            </div>
            <div className="v2-row" style={{ gap: 8 }}>
              <button
                className="v2-btn v2-btn-sm v2-btn-outline"
                type="button"
                onClick={() => {
                  const meUser = db.users.find((u) => u.id === currentCreator.userId);
                  if (!meUser) return;
                  try {
                    v2DeclineCollabCancel(collabRow.id, meUser.id);
                    pushToast('Cancel request declined · collab continues', 'good');
                  } catch (err) {
                    pushToast(err instanceof Error ? err.message : 'Decline failed', 'bad');
                  }
                }}
              >Decline</button>
              <button
                className="v2-btn v2-btn-sm v2-btn-primary"
                type="button"
                onClick={() => {
                  const meUser = db.users.find((u) => u.id === currentCreator.userId);
                  if (!meUser) return;
                  if (!window.confirm('Agree to cancel? Escrow returns to the brand. This cannot be undone.')) return;
                  try {
                    v2AgreeCollabCancel(collabRow.id, meUser.id);
                    pushToast('Collab cancelled · escrow returned to brand', 'good');
                  } catch (err) {
                    pushToast(err instanceof Error ? err.message : 'Agree failed', 'bad');
                  }
                }}
              >Agree &amp; cancel</button>
            </div>
          </div>
        )}
        {(() => {
          const unread = collab
            ? allConversations.filter((c) => c.campaignId === collab.campaignId && c.creatorId === collab.creatorId).reduce((n, c) => n + c.unread, 0)
            : 0;
          return (
            <div className="v2-dl-seg" role="group" aria-label="Show">
              {([['move', 'Next step'], ['messages', unread ? `Messages ${unread}` : 'Messages'], ['money', 'Money']] as const).map(([id, label]) => (
                <button key={id} type="button" aria-pressed={phoneTab === id} onClick={() => setPhoneTab(id)}>{label}</button>
              ))}
            </div>
          );
        })()}
        <div className="v2-dl-cols" data-tab={phoneTab}>
          <div className="v2-dl-main">
            {/* What's next: the open sheet. The stage track sits in the header. */}
            <section className="v2-dl-next">
              {/* A stage timeline is meaningless for a terminal collab — it
                  would render progress through a pipeline this pair has left.
                  Suppressed rather than replaced: StageActionBanner directly
                  below already explains the outcome, and it serves four
                  surfaces, so duplicating the message here just said the same
                  thing twice in one card. */}

              <StageActionBanner
                stage={collab.stage}
                pendingOffer={pendingOffer}
                inviteMessage={inviteMessage}
                wasInvited={(collabRow?.history ?? []).some(
                  (h) => typeof h.reason === 'string' && h.reason.startsWith('brand-invite'),
                )}
                campaignBrand={camp.brand}
                campaignName={camp.name}
                campaignPlacement={camp.placement}
                myApplicationId={myApplication?.id}
                myApplicationStatus={myApplication?.status}
                latestSubmissionStatus={latestSubmission?.status}
                livePermalink={livePermalink}
                // Timing context. Without these the staleness labels are
                // inert — the whole intervention for stale offers and
                // unreviewed work is saying how long it has been.
                myProposedRate={myApplication?.proposedRate}
                offerSentAt={pendingOffer?.sentAt}
                applicationSubmittedAt={myApplication?.submittedAt}
                submissionSubmittedAt={latestSubmission?.submittedAt}
                onAccept={() => {
                  if (!pendingOffer) return;
                  try {
                    v2AcceptOffer(pendingOffer.id);
                    pushToast(`Offer accepted — ${camp.brand} just got the notification`, 'good');
                  } catch (err) {
                    pushToast(err instanceof Error ? err.message : 'Accept failed', 'bad');
                  }
                }}
                onCounter={() => setCounterOpen(true)}
                onUpload={() => nextSlot && setUploadSlot(nextSlot)}
                onWithdraw={() => {
                  if (!myApplication) return;
                  try {
                    v2WithdrawApplication(myApplication.id);
                    pushToast(`Application withdrawn from ${camp.brand}`, 'good');
                  } catch (err) {
                    pushToast(err instanceof Error ? err.message : 'Withdraw failed', 'bad');
                  }
                }}
                onMessageBrand={openConversationForCollab}
                onLeaveReview={() => setReviewOpen(true)}
                activeOfferRate={activeOffer?.rate}
                latestRevisionNote={
                  collab.deliverables.find((d) => d.status === 'revision')?.notes
                }
              />
              {/* Partial settlement (WORKFLOW-GAPS F1). Sits directly above
                  the dispute escape hatch on purpose: it is the step BEFORE
                  escalating. Cancelling returns everything to the brand,
                  which is the wrong answer when work was part-delivered. */}
              {/* WORKFLOW-GAPS E2/E3 — extend the licence, or add a
                  deliverable for an agreed bump. Both were impossible: every
                  term was frozen at acceptance. */}
              <AmendmentPanel collabId={collabRow?.id ?? ''} />
              <SettlementBlock collabId={collabRow?.id ?? ''} stage={collab.stage} />
              {/* WORKFLOW-GAPS F3 — the open dispute itself. Before this, a
                  party could FILE a dispute and then see nothing at all: no
                  thread, no status, no way out except an admin, with their
                  escrow frozen and no explanation on the page. */}
              <DisputePanel collabId={collabRow?.id ?? ''} />
              {/* Dispute escape hatch — visible in money-at-stake stages
                  so the creator can flag an issue with the brand. Pre-fix
                  v2RaiseDispute was unreachable from any v2 surface. Hidden
                  once one is open: you cannot raise a second. */}
              {!openDispute && ['confirmed', 'submitted', 'approved', 'live'].includes(collab.stage) && (
                <div style={{ marginTop: 10, textAlign: 'right' }}>
                  <button
                    type="button"
                    onClick={() => setDisputeOpen(true)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--v2-ink-3)',
                      fontSize: 12,
                      fontFamily: 'inherit',
                      cursor: 'pointer',
                      textDecoration: 'underline',
                      padding: 4,
                    }}
                  >
                    Issue with this collab? Raise a dispute
                  </button>
                </div>
              )}
            </section>

            {/* Deliverables — per-slot rows with progress summary +
                slim progress bar so the creator sees X/Y approved at
                a glance without reading numbers. */}
            <section className="v2-card v2-card-pad-lg" style={{ marginBottom: 16 }}>
              <div className="v2-row" style={{ justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 12 }}>
                <h3 style={{
                  fontFamily: 'var(--v2-font-display)',
                  fontSize: 20,
                  fontWeight: 500,
                  margin: 0,
                  letterSpacing: '-0.02em',
                }}>Deliverables</h3>
                <DeliverableProgressSummary deliverables={collab.deliverables} />
              </div>
              {collab.deliverables.length > 0 && (() => {
                const completed = collab.deliverables.filter((d) =>
                  ['approved', 'live'].includes(d.status),
                ).length;
                const pct = (completed / collab.deliverables.length) * 100;
                return (
                  <div
                    style={{
                      height: 4,
                      background: 'var(--v2-bg-2)',
                      borderRadius: 2,
                      overflow: 'hidden',
                      marginBottom: 16,
                    }}
                    aria-label={`${completed} of ${collab.deliverables.length} deliverables approved`}
                  >
                    <div
                      style={{
                        width: `${pct}%`,
                        height: '100%',
                        background: 'var(--v2-moss)',
                        transition: 'width .3s',
                      }}
                    />
                  </div>
                );
              })()}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {/* `canSubmit` matters here, not just on the topbar button.
                    The adapter synthesizes a pending slot for any collab past
                    `invited` — including `pitched` and `negotiating` — so
                    every unaccepted deal rendered a row with a live "Upload"
                    button on it. `v2SubmitContent` refuses without an accepted
                    offer, so the only possible outcome was an error toast.
                    The rows stay (seeing what you'd owe while negotiating is
                    useful); the button is what was lying. */}
                {collab.deliverables.map((d) => (
                  <DeliverableRow
                    key={d.id}
                    deliverable={d}
                    canSubmit={canSubmitContent}
                    onUpload={() => setUploadSlot({
                      deliverableId: d.deliverableId,
                      label: d.label,
                      isResubmit: d.status === 'revision',
                    })}
                  />
                ))}
                {collab.deliverables.length === 0 && (
                  <div className="v2-muted" style={{ fontSize: 13, padding: 24, textAlign: 'center' }}>
                    No deliverables yet — they'll appear once the brief is confirmed.
                  </div>
                )}
              </div>
            </section>

            {/* Brief — collapsed by default ("already approved when you
                applied"). Reduces noise on a screen the creator visits
                daily after the brief is locked in. */}
            <CollapsibleBrief brief={camp.brief} />

            {/* Activity — last 7 days of brand/creator events. Quick
                pulse-check so the creator sees what's been happening. */}
            <CollabActivityCard
              collabId={collabRow?.id ?? ''}
              campaignId={collab.campaignId}
              creatorId={collab.creatorId}
              brand={camp.brand}
            />
          </div>

          {/* Sidebar */}
          <aside className="v2-dl-side">
            {/* Round 8 (B): the deal's conversation, beside "Your move".
                It replaces a "Brand contact" card whose one button took you
                to Inbox to talk about the deal you were looking at. */}
            <DealConversation
              campaignId={collab.campaignId}
              creatorId={collab.creatorId}
              persona="creator"
              name={camp.brand}
              onRoute={onRoute}
            />
            {/* Payout timeline — dark hero card with the net amount,
                then 4-step milestone river: Escrow → Submitted →
                Approved → Wallet release, each with an ETA or actual
                date. Replaces the older Compensation block; the
                breakdown rows live above the milestone river. */}
            <PayoutTimelineCard
              brand={camp.brand}
              collab={collab}
              escrowFundedAt={escrowFundedAt}
              gross={collab.price}
              platformFee={platformFee}
              wht={wht}
              net={net}
            />

          </aside>
        </div>
      </div>
      </div>

      {uploadSlot && (
        <ContentUploadModal
          collab={collab}
          campaign={camp}
          deliverableId={uploadSlot.deliverableId}
          deliverableLabel={uploadSlot.label}
          isResubmit={uploadSlot.isResubmit}
          onClose={() => setUploadSlot(null)}
        />
      )}
      {counterOpen && pendingOffer && (
        <CounterOfferModal
          offerId={pendingOffer.id}
          brandName={camp.brand}
          currentRate={pendingOffer.rate}
          onClose={() => setCounterOpen(false)}
        />
      )}
      {markLiveTarget && (
        <CreatorMarkLiveModal
          submissionId={markLiveTarget.submissionId}
          deliverableLabel={markLiveTarget.deliverableLabel}
          campaignName={camp.name}
          brandName={camp.brand}
          initialPermalink={markLiveTarget.initialPermalink}
          onClose={() => setMarkLiveTarget(null)}
        />
      )}
      {disputeOpen && currentCreator && (
        <RaiseDisputeModal
          brandName={camp.brand}
          campaignName={camp.name}
          onClose={() => setDisputeOpen(false)}
          onSubmit={(category, description) => {
            const creatorUser = db.users.find((u) => u.id === currentCreator.userId);
            if (!creatorUser) {
              pushToast('Could not identify your account', 'bad');
              return;
            }
            // Find or skip — collab row should exist by now (every
            // mutation runs ensureCollabState). If somehow null we
            // can't raise the dispute against an unspecific id.
            const collabRow = db.collaborations.find(
              (c) => c.campaignId === collab.campaignId && c.creatorId === collab.creatorId,
            );
            if (!collabRow) {
              pushToast('Collab record missing — try refreshing', 'bad');
              return;
            }
            const result = v2RaiseDispute({
              collaborationId: collabRow.id,
              raisedByUserId: creatorUser.id,
              category,
              description,
            });
            if (result) {
              pushToast('Dispute filed — escrow frozen pending review', 'good');
              setDisputeOpen(false);
            } else {
              pushToast('Could not file dispute', 'bad');
            }
          }}
        />
      )}
      {reviewOpen && currentCreator && (
        <LeaveReviewModal
          subjectName={camp.brand}
          subjectKind="brand"
          campaignName={camp.name}
          onClose={() => setReviewOpen(false)}
          onSubmit={(rating, text) => {
            const creatorUser = db.users.find((u) => u.id === currentCreator.userId);
            if (!creatorUser) {
              pushToast('Could not identify your account', 'bad');
              return;
            }
            // brand userId for targetId — review is OF the brand,
            // BY the creator.
            const brandRecord = db.brands.find((b) =>
              db.campaigns.some((c) => c.id === collab.campaignId && c.brandId === b.id),
            );
            if (!brandRecord) {
              pushToast('Brand record missing', 'bad');
              return;
            }
            v2LeaveReview({
              campaignId: collab.campaignId,
              fromUserId: creatorUser.id,
              reviewType: 'brand',
              targetId: brandRecord.id,
              rating,
              text,
            });
            pushToast('Review submitted', 'good');
            setReviewOpen(false);
          }}
        />
      )}
    </>
  );
}

// =====================================================================
// Timeline strip (visual progress through pipeline stages)
// =====================================================================

function CollabTimeline({ stage }: { stage: V2CollabStage }) {
  // Position by the stage's own `order`, so every stage lands somewhere real.
  const currentIdx = TIMELINE_STAGES.indexOf(stage);
  return (
    <ol className="v2-dl-track" aria-label="Where this deal is">
      {TIMELINE_STAGES.map((s, i) => (
        <li key={s} data-state={i < currentIdx ? 'done' : i === currentIdx ? 'now' : 'next'} aria-current={i === currentIdx ? 'step' : undefined}>
          <i aria-hidden="true" />
          {V2_STAGE_META[s].label}
        </li>
      ))}
    </ol>
  );
}

// =====================================================================
// Deliverable row
// =====================================================================

function DeliverableRow({ deliverable, canSubmit, onUpload }: {
  deliverable: V2Deliverable;
  /** False until an offer is accepted — see the note at the call site. */
  canSubmit: boolean;
  onUpload: () => void;
}) {
  const statusColors: Record<V2Deliverable['status'], string> = {
    pending: 'var(--v2-ink-3)',
    in_review: 'var(--v2-accent)',
    approved: 'var(--v2-moss)',
    live: 'var(--v2-moss)',
    revision: 'var(--v2-gold)',
    rejected: 'var(--v2-ink-3)',
  };
  const statusLabels: Record<V2Deliverable['status'], string> = {
    pending: 'Pending upload',
    in_review: 'In review',
    approved: 'Approved',
    live: 'Live',
    revision: 'Revision requested',
    rejected: 'Declined',
  };

  return (
    <div
      className="v2-deliverable-row"
      style={deliverable.status === 'revision' ? {
        borderColor: 'var(--v2-gold)',
        background: 'rgba(184, 144, 47, 0.05)',
      } : undefined}
    >
      {deliverable.thumb ? (
        <div
          className="v2-deliverable-thumb"
          style={{ backgroundImage: `url(${deliverable.thumb})` }}
        />
      ) : (
        <div className="v2-deliverable-thumb v2-deliverable-thumb-empty">
          {Icon.edit}
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{deliverable.label}</div>
        <div className="v2-muted" style={{ fontSize: 12 }}>Due {deliverable.due}</div>
        {deliverable.submittedAt && (
          <div className="v2-muted" style={{ fontSize: 11, marginTop: 2 }}>
            Submitted {deliverable.submittedAt}
          </div>
        )}
        {deliverable.status === 'revision' && deliverable.notes && (
          <div style={{
            marginTop: 8,
            padding: '6px 10px',
            background: 'var(--v2-paper)',
            borderRadius: 6,
            border: '1px solid var(--v2-gold)',
            fontSize: 12,
            color: 'var(--v2-ink-2)',
            lineHeight: 1.45,
          }}>
            <strong style={{ color: 'var(--v2-gold)', textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: 10 }}>
              Brand feedback
            </strong>
            <div style={{ marginTop: 2 }}>{deliverable.notes}</div>
          </div>
        )}
        {(deliverable.status === 'approved' || deliverable.status === 'live') && (
          <PermalinkEditor
            submissionId={deliverable.id}
            initial={deliverable.permalink}
            isLive={deliverable.status === 'live'}
          />
        )}
      </div>
      <div style={{ textAlign: 'right' }}>
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            color: statusColors[deliverable.status],
          }}
        >
          {statusLabels[deliverable.status]}
        </span>
        <div style={{ marginTop: 8 }}>
          {deliverable.status === 'pending' && (
            canSubmit ? (
              <button className="v2-btn v2-btn-sm v2-btn-primary" type="button" onClick={onUpload}>Upload</button>
            ) : (
              <span className="v2-muted" style={{ fontSize: 11.5 }}>
                After acceptance
              </span>
            )
          )}
          {deliverable.status === 'in_review' && deliverable.thumb && (
            <button
              className="v2-btn v2-btn-sm v2-btn-ghost"
              type="button"
              onClick={() => window.open(deliverable.thumb, '_blank', 'noopener,noreferrer')}
            >View submission</button>
          )}
          {deliverable.status === 'revision' && canSubmit && (
            <button className="v2-btn v2-btn-sm v2-btn-primary" type="button" onClick={onUpload}>Resubmit</button>
          )}
          {(deliverable.status === 'approved' || deliverable.status === 'live') && deliverable.permalink && (
            <button
              className="v2-btn v2-btn-sm v2-btn-ghost"
              type="button"
              onClick={() => window.open(deliverable.permalink, '_blank', 'noopener,noreferrer')}
              aria-label="Open live post"
            >{Icon.external}</button>
          )}
        </div>
      </div>
    </div>
  );
}

// =====================================================================
// PermalinkEditor — creator pastes the live URL on an approved deliverable
// =====================================================================
//
// Once a submission is approved, the creator can attach the live URL
// before the brand marks it live. The URL flows through to MarkLiveModal
// (initialPermalink prop) so the brand sees it pre-filled. Pure data
// write — no stage transition; the brand still confirms via Mark Live.
// On a live deliverable the editor flips read-only with an "Open" link.

function PermalinkEditor({ submissionId, initial, isLive }: {
  submissionId: string;
  initial?: string;
  isLive: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(initial ?? '');

  // Re-sync local draft if the underlying value changes (brand marked
  // live on a different surface, etc.)
  if (!editing && draft !== (initial ?? '') && initial !== undefined) {
    setDraft(initial);
  }

  const valid = /^https?:\/\//i.test(draft) || draft.includes('.');

  if (isLive && initial) {
    // Live state — read-only with an external link
    return (
      <div style={{
        marginTop: 8,
        padding: '6px 10px',
        background: 'rgba(89, 130, 86, 0.08)',
        borderRadius: 6,
        border: '1px solid var(--v2-moss)',
        fontSize: 12,
        lineHeight: 1.45,
      }}>
        <strong style={{ color: 'var(--v2-moss)', textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: 10 }}>
          Live URL
        </strong>
        <div style={{ marginTop: 2 }}>
          <a
            href={initial}
            target="_blank"
            rel="noreferrer noopener"
            style={{ color: 'var(--v2-ink-2)', textDecoration: 'underline', wordBreak: 'break-all' }}
          >
            {initial}
          </a>
        </div>
      </div>
    );
  }

  if (!editing) {
    return (
      <div style={{ marginTop: 8 }}>
        {initial ? (
          <div className="v2-row" style={{ gap: 8, alignItems: 'center', fontSize: 12 }}>
            <span className="v2-muted" style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>
              Live URL
            </span>
            <a
              href={initial}
              target="_blank"
              rel="noreferrer noopener"
              style={{
                color: 'var(--v2-ink-2)',
                textDecoration: 'underline',
                wordBreak: 'break-all',
                flex: 1,
                minWidth: 0,
              }}
            >
              {initial.length > 56 ? `${initial.slice(0, 56)}…` : initial}
            </a>
            <button
              type="button"
              className="v2-btn v2-btn-sm v2-btn-ghost"
              onClick={() => setEditing(true)}
              aria-label="Edit live URL"
              style={{ flexShrink: 0 }}
            >
              {Icon.edit}
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="v2-btn v2-btn-sm v2-btn-outline"
            onClick={() => setEditing(true)}
          >
            {Icon.plus} Add live URL
          </button>
        )}
      </div>
    );
  }

  return (
    <div style={{
      marginTop: 8,
      padding: 10,
      background: 'var(--v2-bg-1)',
      borderRadius: 8,
      border: '1px solid var(--v2-line)',
    }}>
      <label className="v2-eyebrow" style={{ display: 'block', marginBottom: 6, fontSize: 10 }}>
        Live URL
      </label>
      <input
        className="v2-input"
        type="url"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="https://instagram.com/p/..."
        autoFocus
        style={{ marginBottom: 8 }}
      />
      <div className="v2-muted" style={{ fontSize: 11, marginBottom: 8 }}>
        Paste the URL where your post is live. The brand sees it pre-filled in their Mark Live confirmation — saves them re-typing.
      </div>
      <div className="v2-row" style={{ gap: 6, justifyContent: 'flex-end' }}>
        {initial && (
          <button
            type="button"
            className="v2-btn v2-btn-sm v2-btn-ghost"
            onClick={() => {
              v2SetSubmissionPermalink(submissionId, '');
              setDraft('');
              setEditing(false);
            }}
          >
            Remove
          </button>
        )}
        <button
          type="button"
          className="v2-btn v2-btn-sm v2-btn-outline"
          onClick={() => {
            setDraft(initial ?? '');
            setEditing(false);
          }}
        >
          Cancel
        </button>
        <button
          type="button"
          className="v2-btn v2-btn-sm v2-btn-primary"
          disabled={!valid}
          onClick={() => {
            v2SetSubmissionPermalink(submissionId, draft);
            setEditing(false);
          }}
        >
          {Icon.check} Save
        </button>
      </div>
    </div>
  );
}

// =====================================================================
// DeliverableProgressSummary — shows "1 of 4 done · 1 in review · 2 to go"
// rolled up from the per-slot statuses. Sits next to the Deliverables
// heading so the creator (and brand) see at-a-glance progress.
// =====================================================================

function DeliverableProgressSummary({ deliverables }: { deliverables: V2Deliverable[] }) {
  if (deliverables.length === 0) return null;
  const counts = deliverables.reduce((acc, d) => {
    acc[d.status] = (acc[d.status] ?? 0) + 1;
    return acc;
  }, {} as Record<V2Deliverable['status'], number>);
  const done = (counts.approved ?? 0) + (counts.live ?? 0);
  const total = deliverables.length;
  const parts: string[] = [];
  if (done > 0) parts.push(`${done} of ${total} done`);
  else parts.push(`${total} deliverable${total === 1 ? '' : 's'}`);
  if (counts.in_review) parts.push(`${counts.in_review} in review`);
  if (counts.revision) parts.push(`${counts.revision} need revision`);
  if (counts.pending) parts.push(`${counts.pending} pending`);
  return (
    <div className="v2-muted" style={{ fontSize: 12.5 }}>
      {parts.join(' · ')}
    </div>
  );
}

// =====================================================================
// PayoutTimelineCard — dark hero card replacing the old Compensation
// block. Shows the creator's net at the top, the gross / fee / WHT
// breakdown beneath, then a 4-step milestone river:
//   Escrow funded → Draft submitted → Approved → Wallet release
// Each milestone shows an ETA or the actual date once the stage is
// reached. The "instant withdrawal to JazzCash" line at the foot
// closes the loop on the payout story.
// =====================================================================

function PayoutTimelineCard({
  brand, collab, escrowFundedAt, gross, platformFee, wht, net,
}: {
  brand: string;
  collab: V2Collab;
  /** ISO date of the real `escrow_hold` row, or null when none exists. */
  escrowFundedAt: string | null;
  gross: number;
  platformFee: number;
  wht: number;
  net: number;
}) {
  const short = (iso?: string | null) => iso
    ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : null;

  // A deal that didn't go ahead has no terms to offer. This card used to
  // say "If you accept... You'd keep $2,685" on it, with the escrow steps.
  if (collab.stage === 'cancelled') {
    return (
      <section className="v2-card v2-dl-money" aria-label="This deal's money">
        <span className="v2-wl-eyebrow">This deal</span>
        <p>It didn’t go ahead, so nothing was held and nothing is owed{gross > 0 ? `. The last price on the table was ${dollars(gross)}` : ''}.</p>
        <span className="v2-hm-test"><i aria-hidden="true" />Beta: payments run in test mode</span>
      </section>
    );
  }

  if (gross <= 0) {
    return (
      <section className="v2-card v2-dl-money" aria-label="This deal's money">
        <span className="v2-wl-eyebrow">This deal</span>
        <p>No price agreed yet. Once you accept an offer, or {brand} accepts your counter, the rate, the fees and what you keep show here.</p>
        <span className="v2-hm-test"><i aria-hidden="true" />Beta: payments run in test mode</span>
      </section>
    );
  }

  const n = Math.max(1, collab.deliverables.length);
  // Until an offer is accepted the price is on the table, not agreed.
  const agreed = !['invited', 'pitched', 'negotiating', 'cancelled'].includes(collab.stage);
  return (
    <>
      <section className="v2-card v2-dl-money" aria-label="This deal's money">
        <span className="v2-wl-eyebrow">{agreed ? 'This deal' : 'If you accept'}</span>
        <div className="v2-hm-ledger">
          <div className="v2-hm-lrow"><span>{agreed ? 'Agreed rate' : 'On the table'}</span><b>{dollars(gross)}</b></div>
          <div className="v2-hm-lrow" data-neg><span>Platform fee ({PLATFORM_FEE_LABEL})</span><b>−{dollars(platformFee)}</b></div>
          <div className="v2-hm-lrow" data-neg><span>Withholding tax ({WHT_LABEL})</span><b>−{dollars(wht)}</b></div>
          <div className="v2-hm-lrow v2-dl-keep"><span>{agreed ? 'You keep' : 'You’d keep'}</span><b>{dollars(net)}</b></div>
        </div>
        <span className="v2-hm-test"><i aria-hidden="true" />Beta: payments run in test mode</span>
      </section>

      <section className="v2-card v2-dl-money" aria-labelledby="dl-paid">
        <h3 id="dl-paid">When you get paid</h3>
        <ol className="v2-dl-steps">
          <li data-done={escrowFundedAt ? true : undefined}>
            <i aria-hidden="true" />
            <div><b>Held in escrow</b><small>{escrowFundedAt ? `${short(escrowFundedAt)} · the full ${dollars(gross)}` : 'When you accept, the full amount is held'}</small></div>
          </li>
          {collab.deliverables.map((d, i) => {
            // Money moves when the brand confirms the post is live
            // (v2MarkContentLive), not at approval.
            const released = d.status === 'live';
            return (
              <li key={d.id} data-done={released || undefined}>
                <i aria-hidden="true" />
                <div>
                  <b>{d.label} goes live</b>
                  <small>{released ? `Released${d.liveAt ? ` ${d.liveAt}` : ''}` : `${brand} confirms the link`}</small>
                </div>
                <em>{dollars(splitGross(slotGross(gross, n, i)).net)}</em>
              </li>
            );
          })}
        </ol>
        <p>Each post releases its share, after fees, when {brand} confirms it’s live. Withdraw from your wallet whenever you like; banks take 1–2 business days.</p>
      </section>
    </>
  );
}

// =====================================================================

function CollapsibleBrief({ brief }: { brief: string }) {
  const [open, setOpen] = useState(false);
  return (
    <section className="v2-card v2-card-pad-lg" style={{ marginBottom: 16 }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'transparent',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
        }}
        aria-expanded={open}
      >
        <div style={{ textAlign: 'left' }}>
          <h3
            style={{
              fontFamily: 'var(--v2-font-display)',
              fontSize: 20,
              fontWeight: 500,
              margin: 0,
              letterSpacing: '-0.02em',
            }}
          >
            The brief
          </h3>
          <div className="v2-muted" style={{ fontSize: 12, marginTop: 2 }}>
            {open ? 'Tap header to collapse' : 'Tap to expand · already approved when you applied'}
          </div>
        </div>
        <span aria-hidden="true" style={{ fontSize: 13, color: 'var(--v2-ink-3)' }}>
          {open ? '▾' : '▸'}
        </span>
      </button>
      {open && (
        <div style={{ marginTop: 14 }}>
          <p style={{ lineHeight: 1.65, color: 'var(--v2-ink-2)', margin: '0 0 16px' }}>
            {brief}
          </p>
          <button
            className="v2-btn v2-btn-sm v2-btn-outline"
            type="button"
            onClick={() => window.print()}
          >
            {Icon.external} Download brief PDF
          </button>
        </div>
      )}
    </section>
  );
}

// =====================================================================
// CollabActivityCard — the real event feed for this collaboration.
// collab's lifecycle: stage transitions, deliverable submits/approvals,
// payout. Demo data — a real implementation would read from a
// dedicated activity log table.
// =====================================================================

function CollabActivityCard({
  collabId, campaignId, creatorId, brand,
}: {
  collabId: string;
  campaignId: string;
  creatorId: string;
  brand: string;
}) {
  const db = useStore((s) => s.db);

  type Event = { at: number; who: string; what: string; icon: string; color: string };
  const events: Event[] = [];

  const row = db.collaborations.find((c) => c.id === collabId)
    ?? db.collaborations.find((c) => c.campaignId === campaignId && c.creatorId === creatorId);
  const creatorUserId = db.users.find((u) => u.creatorId === creatorId)?.id;

  // Derived from the SIGNALS — applications, offers, submissions, ledger —
  // not from `Collaboration.history`.
  //
  // History looked like the obvious source and is the wrong one here: for
  // rows the P1c migrator derived, every entry carries the DERIVATION
  // timestamp and an actor that is whoever ran the migration, so the feed
  // read "Oakmoss sent a pitch · just now" on a collab whose stage is
  // `invited` — a real record, rendered into a false sentence. Pitches are
  // the creator's move and offers are the brand's; the signals say which
  // happened, when, and by whom, without inference.
  //
  // History is used only for `invited`, which by definition has no signal
  // behind it.

  for (const h of row?.history ?? []) {
    if (h.to !== 'invited') continue;
    events.push({ at: h.at, who: brand, what: 'invited you to the campaign', icon: '✉', color: 'var(--v2-ink-3)' });
  }

  for (const a of db.applications) {
    if (a.campaignId !== campaignId || a.creatorId !== creatorId) continue;
    const at = +new Date(a.submittedAt);
    if (Number.isFinite(at)) {
      events.push({ at, who: 'You', what: 'sent a pitch', icon: '→', color: 'var(--v2-ink-3)' });
    }
    // Terminal outcomes matter as much as openings. Without these the feed
    // showed a pitch and an offer with no ending, reading as live activity
    // on a pair where the pitch had lapsed and the offer had expired.
    const decided = a.decidedAt ? +new Date(a.decidedAt) : NaN;
    if (Number.isFinite(decided)) {
      if (a.status === 'withdrawn') {
        // A lapse (scheduler.ts) and the creator withdrawing store the same
        // row, so this says what is known: the pitch closed. It used to say
        // "lapsed with no reply" for both. Subject-less on purpose.
        events.push({ at: decided, who: '', what: 'Your pitch closed', icon: '×', color: 'var(--v2-ink-3)' });
      } else if (a.status === 'rejected') {
        events.push({ at: decided, who: brand, what: 'passed on your pitch', icon: '×', color: 'var(--v2-ink-3)' });
      }
    }
  }

  for (const o of db.offers) {
    if (o.campaignId !== campaignId || o.creatorId !== creatorId) continue;
    // Every round, attributed to the side that actually sent it.
    o.rounds?.forEach((rd, i) => {
      if (!Number.isFinite(rd.at)) return;
      const mine = rd.by === 'creator';
      events.push({
        at: rd.at,
        who: mine ? 'You' : brand,
        what: i === 0 && !mine
          ? `sent an offer · ${fmtUSD(rd.rate)}`
          : `countered at ${fmtUSD(rd.rate)}`,
        icon: '↔',
        color: 'var(--v2-ink-3)',
      });
    });
    const responded = o.respondedAt ? +new Date(o.respondedAt) : NaN;
    if (Number.isFinite(responded)) {
      if (o.status === 'accepted') {
        events.push({ at: responded, who: 'You', what: 'accepted the offer', icon: '✓', color: 'var(--v2-moss)' });
      } else if (o.status === 'declined') {
        events.push({ at: responded, who: 'You', what: 'declined the offer', icon: '×', color: 'var(--v2-ink-3)' });
      } else if (o.status === 'withdrawn') {
        events.push({ at: responded, who: brand, what: 'withdrew the offer', icon: '×', color: 'var(--v2-ink-3)' });
      } else if (o.status === 'expired') {
        events.push({ at: responded, who: '', what: 'The offer expired with no response', icon: '×', color: 'var(--v2-ink-3)' });
      }
    }
  }

  // Money, from the ledger rather than from the stage or the price. An
  // escrow line is only claimed when a row exists for it.
  for (const t of db.transactions) {
    if (t.campaignId !== campaignId) continue;
    const at = +new Date(t.at);
    if (!Number.isFinite(at)) continue;
    if (t.kind === 'escrow_hold' && t.counterpartyUserId === creatorUserId) {
      events.push({ at, who: brand, what: `funded escrow · ${fmtUSD(Math.abs(t.amount))}`, icon: '$', color: 'var(--v2-ink)' });
    }
    if (t.kind === 'payout' && t.userId === creatorUserId) {
      events.push({ at, who: brand, what: `released ${fmtUSD(t.amount)} · gross, before fee and withholding`, icon: '$', color: 'var(--v2-moss)' });
    }
    if (t.kind === 'refund' && t.counterpartyUserId === creatorUserId) {
      events.push({ at, who: brand, what: `refunded ${fmtUSD(t.amount)} to their wallet`, icon: '↩', color: 'var(--v2-ink-3)' });
    }
  }

  // Submissions and brand feedback.
  for (const sub of db.submissions) {
    if (sub.campaignId !== campaignId || sub.creatorId !== creatorId) continue;
    const at = +new Date(sub.submittedAt);
    if (Number.isFinite(at)) {
      events.push({ at, who: 'You', what: `submitted round ${sub.round} for review`, icon: '→', color: 'var(--v2-ink-3)' });
    }
    for (const f of sub.feedback ?? []) {
      const fAt = +new Date(f.at);
      if (!Number.isFinite(fAt)) continue;
      events.push({ at: fAt, who: brand, what: 'left feedback on your draft', icon: '✎', color: 'var(--v2-ink-3)' });
    }
  }

  events.sort((a, b) => b.at - a.at);

  // Nothing invented means some collabs genuinely have no activity — a cold
  // invite that nobody has answered has exactly one event, and a brand-new
  // pair may have none. Say so rather than filling the card.
  if (events.length === 0) return null;

  return (
    <section className="v2-card v2-card-pad-lg">
      <div className="v2-row" style={{ justifyContent: 'space-between', marginBottom: 14 }}>
        <h3
          style={{
            fontFamily: 'var(--v2-font-display)',
            fontSize: 18,
            fontWeight: 500,
            margin: 0,
            letterSpacing: '-0.02em',
          }}
        >
          Activity
        </h3>
        {/* Was "last 7 days" — a window nothing filtered on. */}
        <span className="v2-muted" style={{ fontSize: 11 }}>newest first</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {events.slice(0, 8).map((e, i) => (
          <div key={`${e.at}-${i}`} className="v2-row" style={{ gap: 10, alignItems: 'flex-start' }}>
            <div
              style={{
                width: 22, height: 22, borderRadius: '50%',
                background: 'var(--v2-bg)', color: e.color,
                display: 'grid', placeItems: 'center',
                fontSize: 11, fontWeight: 700, flexShrink: 0,
              }}
            >
              {e.icon}
            </div>
            <div style={{ flex: 1, fontSize: 13 }}>
              {e.who && <><span style={{ fontWeight: 550 }}>{e.who}</span>{' '}</>}
              <span style={{ color: 'var(--v2-ink-2)' }}>{e.what}</span>
              <div className="v2-muted" style={{ fontSize: 11, marginTop: 1 }}>
                {relativeTime(new Date(e.at).toISOString())}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// =====================================================================
// SettlementBlock — propose / agree a partial split of held escrow
// =====================================================================
//
// The deal ended half-delivered. Cancelling refunds everything to the brand
// and paying in full rewards work that wasn't done, so the parties agree a
// split. BOTH must agree — the escrow is money both have a claim on — which
// is why this renders an Agree/Decline pair for the party who did NOT
// propose, and a read-only "waiting" state for the one who did.

function SettlementBlock({ collabId, stage }: { collabId: string; stage: V2CollabStage }) {
  const db = useStore((s) => s.db);
  const session = useStore((s) => s.session);
  const [proposing, setProposing] = useState(false);
  const [amount, setAmount] = useState(0);
  const [note, setNote] = useState('');

  const collabRow = db.collaborations.find((c) => c.id === collabId);
  const proposal = collabRow?.settlementProposal;
  const available = collabId ? v2SettleableAmount(collabId) : 0;
  const meId = session?.userId ?? '';

  // Only while money is actually held and the deal is still open.
  const settleable = ['confirmed', 'submitted'].includes(stage)
    && available > 0 && !collabRow?.escrowFrozen && !collabRow?.cancelledAt;
  if (!collabId || (!settleable && !proposal)) return null;

  if (proposal) {
    const mine = proposal.by === meId;
    const refund = Math.max(0, available - proposal.releaseToCreator);
    return (
      <div className="v2-card v2-card-pad" style={{ marginTop: 10, borderLeft: '3px solid var(--v2-gold)' }}>
        <div className="v2-eyebrow" style={{ marginBottom: 6 }}>Settlement proposed</div>
        <p style={{ fontSize: 13.5, margin: '0 0 4px' }}>
          {fmtUSD(proposal.releaseToCreator)} to the creator, {fmtUSD(refund)} refunded to the brand.
        </p>
        <p className="v2-muted" style={{ fontSize: 12.5, margin: '0 0 10px' }}>“{proposal.note}”</p>
        {mine ? (
          <p className="v2-muted" style={{ fontSize: 12, margin: 0 }}>
            Waiting on the other side to agree. Escrow stays held until they do.
          </p>
        ) : (
          <div className="v2-row" style={{ gap: 8 }}>
            <button
              className="v2-btn v2-btn-primary v2-btn-sm"
              type="button"
              onClick={() => {
                try {
                  v2AgreeSettlement(collabId, meId);
                  pushToast('Settled — the split has been paid out', 'good');
                } catch (err) {
                  pushToast(err instanceof Error ? err.message : 'Could not settle', 'bad');
                }
              }}
            >Agree to this split</button>
            <button
              className="v2-btn v2-btn-outline v2-btn-sm"
              type="button"
              onClick={() => {
                try {
                  v2DeclineSettlement(collabId, meId);
                  pushToast('Proposal declined');
                } catch (err) {
                  pushToast(err instanceof Error ? err.message : 'Could not decline', 'bad');
                }
              }}
            >Decline</button>
          </div>
        )}
      </div>
    );
  }

  if (!proposing) {
    return (
      <div style={{ marginTop: 10, textAlign: 'right' }}>
        <button
          type="button"
          className="v2-link-btn v2-muted"
          style={{ fontSize: 12 }}
          onClick={() => { setAmount(Math.round(available / 2)); setProposing(true); }}
        >
          Propose a settlement
        </button>
      </div>
    );
  }

  return (
    <div className="v2-card v2-card-pad" style={{ marginTop: 10 }}>
      <div className="v2-eyebrow" style={{ marginBottom: 8 }}>Propose a settlement</div>
      <p className="v2-muted" style={{ fontSize: 12.5, margin: '0 0 10px', lineHeight: 1.5 }}>
        {fmtUSD(available)} is held on this deal. Split it: the rest refunds to
        the brand. Both sides have to agree before anything moves.
      </p>
      <label className="v2-eyebrow" htmlFor="v2-settle-amount" style={{ display: 'block', marginBottom: 6 }}>
        To the creator
      </label>
      <div className="v2-onboarding-rate" style={{ marginBottom: 10 }}>
        <span className="v2-onboarding-rate-prefix">$</span>
        <input
          id="v2-settle-amount"
          type="number"
          min={0}
          max={available}
          value={amount}
          onChange={(e) => setAmount(parseNumberInput(e.target.value, { min: 0, max: available }))}
        />
      </div>
      <textarea
        className="v2-input"
        rows={2}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Why this split — e.g. three of four deliverables landed."
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
          onClick={() => {
            try {
              v2ProposeSettlement(collabId, amount, note, meId);
              pushToast('Settlement proposed — waiting on the other side', 'good');
              setProposing(false);
            } catch (err) {
              pushToast(err instanceof Error ? err.message : 'Could not propose', 'bad');
            }
          }}
        >Propose</button>
      </div>
    </div>
  );
}
