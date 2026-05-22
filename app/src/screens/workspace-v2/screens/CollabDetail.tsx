// CollabDetail.tsx — v2 creator-side collaboration detail
//
// What a creator sees when they click into one of their collabs from
// MyCollabs. Two-column layout:
//   left:  status hero (timeline) · deliverables list · brief
//   right: compensation breakdown (gross → fees → net) · brand contact

import { useEffect, useState } from 'react';
import { fmtUSD, Icon, StagePill, Topbar } from '../lib';
import { useV2AllCampaigns, useV2CollabById, useV2CurrentCreator, v2EnsureThreadFor } from '../v2Hooks';
import { V2_PIPELINE_STAGES } from '../v2Adapters';
import type { V2Collab, V2CollabStage, V2Deliverable } from '../data';
import { ContentUploadModal } from './ContentUploadModal';
import { CounterOfferModal, CreatorMarkLiveModal } from './WorkflowModals';
import {
  v2AcceptOffer, v2WithdrawApplication, getApplicationFor, getActiveOfferFor,
  getLatestSubmissionFor, v2SetSubmissionPermalink, v2LeaveReview,
} from '../v2CampaignActions';
import { v2RaiseDispute } from '../v2DisputeActions';
import { v2AgreeCollabCancel, v2DeclineCollabCancel } from '../v2CollabActions';
import { useStore } from '@/lib/api/store';
import { pushToast } from '@/lib/utils/toast';
import { LeaveReviewModal } from './LeaveReviewModal';
import { RaiseDisputeModal } from './RaiseDisputeModal';
import { StageActionBanner } from './StageActionBanner';

interface Props {
  collabId: string;
  onRoute: (r: string) => void;
  /** §needs-you-direct-jump — when CreatorHome's Today list passes
   *  `?action=upload`, the upload modal opens on mount so the creator
   *  can submit content in one click from the home tile. */
  initialAction?: 'upload' | 'mark-live';
}

const TIMELINE_ORDER: V2CollabStage[] = [
  'pitched', 'negotiating', 'confirmed', 'submitted', 'approved', 'paid',
];

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
    onRoute(threadId ? `deal:${threadId}` : 'creator-inbox');
  }
  // P1d §1.5 — track which deliverable is being uploaded as the FK id
  // (was a numeric slot index pre-P1d). The label is computed by the
  // adapter from platform/format and passed through for the modal title.
  const [uploadSlot, setUploadSlot] = useState<{ deliverableId: string; label: string; isResubmit: boolean } | null>(null);
  const [counterOpen, setCounterOpen] = useState(false);
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

  // §needs-you-direct-jump — when the route arrived with `?action=upload`
  // (CreatorHome's Today list jumping into here), pop the upload modal
  // on mount. Only fires once per `initialAction` value to avoid re-
  // popping when the same collab is reopened later.
  useEffect(() => {
    if (initialAction === 'upload' && nextSlot && !uploadSlot) {
      setUploadSlot(nextSlot);
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

  // For paid stage, find the actual approved+live submission
  const latestSubmission = collab ? getLatestSubmissionFor(collab.campaignId, collab.creatorId) : undefined;
  const liveFeedback = latestSubmission?.feedback?.find((f) => f.text?.startsWith('LIVE: '));
  const livePermalink = liveFeedback ? liveFeedback.text.replace('LIVE: ', '') : undefined;
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
          <p className="v2-muted">You don't have access to this collaboration.</p>
        </div>
      </>
    );
  }
  const camp = campaigns.find((c) => c.id === collab.campaignId);
  const stageMeta = V2_PIPELINE_STAGES.find((s) => s.id === collab.stage);
  if (!camp || !stageMeta) {
    return (
      <>
        <Topbar title="Collaboration" crumb="Campaign missing" />
        <div className="v2-content"><p className="v2-muted">Campaign data unavailable.</p></div>
      </>
    );
  }

  // Net to creator after platform fee + WHT (5% + 5% in v2 design)
  const platformFee = Math.round(collab.price * 0.05);
  const wht = Math.round(collab.price * 0.05);
  const net = collab.price - platformFee - wht;

  // Pending mutual-cancel request from the brand. Pre-fix the creator
  // had no UI affordance to respond; the brand's v2RequestCollabCancel
  // wrote `Collaboration.cancellationRequest` but no surface read it.
  const collabRow = db.collaborations.find(
    (c) => c.campaignId === collab.campaignId && c.creatorId === collab.creatorId,
  );
  const cancelRequest = collabRow?.cancellationRequest ?? null;

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
      <Topbar
        title={camp.name}
        crumb={
          <span>
            <button
              type="button"
              className="v2-link-btn"
              onClick={() => onRoute('creator-collabs')}
            >Collaborations</button>
            {' · '}{camp.brand}
          </span>
        }
        actions={
          <>
            <button
              className="v2-btn v2-btn-outline"
              type="button"
              onClick={openConversationForCollab}
            >
              {Icon.inbox} Message brand
            </button>
            <button
              className="v2-btn v2-btn-primary"
              type="button"
              onClick={() => nextSlot && setUploadSlot(nextSlot)}
            >
              {Icon.plus} Submit content
            </button>
          </>
        }
      />
      <div className="v2-content">
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
                  v2DeclineCollabCancel(collabRow.id, meUser.id);
                  pushToast('Cancel request declined · collab continues');
                }}
              >Decline</button>
              <button
                className="v2-btn v2-btn-sm v2-btn-primary"
                type="button"
                onClick={() => {
                  const meUser = db.users.find((u) => u.id === currentCreator.userId);
                  if (!meUser) return;
                  if (!window.confirm('Agree to cancel? Escrow returns to the brand. This cannot be undone.')) return;
                  v2AgreeCollabCancel(collabRow.id, meUser.id);
                  pushToast('Collab cancelled · escrow returned to brand', 'good');
                }}
              >Agree &amp; cancel</button>
            </div>
          </div>
        )}
        <div className="v2-row" style={{ gap: 24, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div style={{ flex: '2 1 480px', minWidth: 0 }}>
            {/* Status hero with timeline */}
            <section className="v2-card v2-card-pad-lg" style={{ marginBottom: 16 }}>
              <div className="v2-row" style={{ justifyContent: 'space-between', marginBottom: 16 }}>
                <div className="v2-eyebrow">Current stage</div>
                <StagePill stage={stageMeta.label} />
              </div>
              <CollabTimeline stage={collab.stage} />

              <StageActionBanner
                stage={collab.stage}
                pendingOffer={pendingOffer}
                inviteMessage={inviteMessage}
                campaignBrand={camp.brand}
                campaignName={camp.name}
                campaignPlacement={camp.placement}
                myApplicationId={myApplication?.id}
                myApplicationStatus={myApplication?.status}
                latestSubmissionStatus={latestSubmission?.status}
                livePermalink={livePermalink}
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
                onWithdraw={() => myApplication && v2WithdrawApplication(myApplication.id)}
                onMessageBrand={openConversationForCollab}
                onLeaveReview={() => setReviewOpen(true)}
                activeOfferRate={activeOffer?.rate}
                latestRevisionNote={
                  collab.deliverables.find((d) => d.status === 'revision')?.notes
                }
              />
              {/* Dispute escape hatch — visible in money-at-stake stages
                  so the creator can flag an issue with the brand. Pre-fix
                  v2RaiseDispute was unreachable from any v2 surface. */}
              {['confirmed', 'submitted', 'approved', 'live'].includes(collab.stage) && (
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
                {collab.deliverables.map((d) => (
                  <DeliverableRow
                    key={d.id}
                    deliverable={d}
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
            <CollabActivityCard collab={collab} brand={camp.brand} />
          </div>

          {/* Sidebar */}
          <aside style={{ flex: '1 1 280px' }}>
            {/* Payout timeline — dark hero card with the net amount,
                then 4-step milestone river: Escrow → Submitted →
                Approved → Wallet release, each with an ETA or actual
                date. Replaces the older Compensation block; the
                breakdown rows live above the milestone river. */}
            <PayoutTimelineCard
              collab={collab}
              gross={collab.price}
              platformFee={platformFee}
              wht={wht}
              net={net}
            />

            {/* Brand contact — upgraded with reply-time + approval-rate
                stats so the creator knows what to expect. */}
            <div className="v2-card v2-card-pad">
              <div className="v2-eyebrow" style={{ marginBottom: 12 }}>Brand contact</div>
              <div className="v2-row" style={{ gap: 10, marginBottom: 12 }}>
                <div className="v2-brand-mark-lg" style={{ width: 40, height: 40, fontSize: 18 }}>
                  {camp.brand[0]?.toUpperCase()}
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13.5 }}>{camp.brand}</div>
                  <div className="v2-muted" style={{ fontSize: 11 }}>Marketing team</div>
                </div>
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 8,
                  marginBottom: 12,
                  padding: '10px 0',
                  borderTop: '1px solid var(--v2-line)',
                  borderBottom: '1px solid var(--v2-line)',
                }}
              >
                <div>
                  <div className="v2-muted" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Replies in
                  </div>
                  <div className="v2-tabular" style={{ fontSize: 13, fontWeight: 600 }}>~28h</div>
                </div>
                <div>
                  <div className="v2-muted" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Approval rate
                  </div>
                  <div className="v2-tabular" style={{ fontSize: 13, fontWeight: 600 }}>92%</div>
                </div>
              </div>
              <button
                className="v2-btn v2-btn-sm v2-btn-outline"
                type="button"
                style={{ width: '100%' }}
                onClick={openConversationForCollab}
              >
                {Icon.inbox} Open conversation
              </button>
            </div>
          </aside>
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
          // Final 50% of escrow releases on brand-confirmed live (the
          // milestone schema is 50/50 across approve and live).
          releaseAmount={Math.round(collab.price * 0.5)}
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
  const currentIdx = TIMELINE_ORDER.indexOf(stage === 'live' ? 'approved' : stage);
  return (
    <div className="v2-collab-timeline">
      {TIMELINE_ORDER.map((s, i) => {
        const done = i < currentIdx;
        const active = i === currentIdx;
        return (
          <div key={s} className={`v2-collab-timeline-step ${done ? 'is-done' : ''} ${active ? 'is-active' : ''}`}>
            {i > 0 && <div className="v2-collab-timeline-line" />}
            <div className="v2-collab-timeline-dot">{done ? Icon.check : i + 1}</div>
            <div className="v2-collab-timeline-label">
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// =====================================================================
// Deliverable row
// =====================================================================

function DeliverableRow({ deliverable, onUpload }: {
  deliverable: V2Deliverable;
  onUpload: () => void;
}) {
  const statusColors: Record<V2Deliverable['status'], string> = {
    pending: 'var(--v2-ink-3)',
    in_review: 'var(--v2-accent)',
    approved: 'var(--v2-moss)',
    live: 'var(--v2-moss)',
    revision: 'var(--v2-gold)',
  };
  const statusLabels: Record<V2Deliverable['status'], string> = {
    pending: 'Pending upload',
    in_review: 'In review',
    approved: 'Approved',
    live: 'Live',
    revision: 'Revision requested',
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
            <button className="v2-btn v2-btn-sm v2-btn-primary" type="button" onClick={onUpload}>Upload</button>
          )}
          {deliverable.status === 'in_review' && deliverable.thumb && (
            <button
              className="v2-btn v2-btn-sm v2-btn-ghost"
              type="button"
              onClick={() => window.open(deliverable.thumb, '_blank', 'noopener,noreferrer')}
            >View submission</button>
          )}
          {deliverable.status === 'revision' && (
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
  collab, gross, platformFee, wht, net,
}: {
  collab: V2Collab;
  gross: number;
  platformFee: number;
  wht: number;
  net: number;
}) {
  type Milestone = { id: string; label: string; date: string; done: boolean };
  const submittedReached = ['submitted', 'approved', 'live', 'paid'].includes(collab.stage);
  const approvedReached  = ['approved', 'live', 'paid'].includes(collab.stage);
  const paidReached      = collab.stage === 'paid';
  const submittedAt = collab.deliverables.find((d) => d.submittedAt)?.submittedAt;
  const approvedAt  = collab.deliverables.find((d) => d.approvedAt)?.approvedAt;

  const milestones: Milestone[] = [
    { id: 'escrow',   label: 'Escrow funded',   date: collab.appliedAt ?? 'On confirm', done: collab.price > 0 },
    { id: 'submit',   label: 'Draft submitted', date: submittedAt ?? (submittedReached ? 'Recently' : 'Pending submit'), done: submittedReached },
    { id: 'approve',  label: 'Approved',        date: approvedAt ?? (approvedReached ? 'Recently' : 'ETA on approve'),    done: approvedReached },
    { id: 'wallet',   label: 'Wallet release',  date: paidReached ? 'Released' : 'ETA · 48h after approval',              done: paidReached },
  ];

  return (
    <div className="v2-card" style={{ padding: 0, overflow: 'hidden', marginBottom: 16 }}>
      <div style={{ padding: '16px 18px 14px', background: 'var(--v2-ink)', color: 'var(--v2-paper)' }}>
        <div className="v2-eyebrow" style={{ color: 'rgba(255,255,255,.7)', marginBottom: 6 }}>
          You'll receive
        </div>
        <div className="v2-row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
          <div
            className="v2-tabular"
            style={{
              fontFamily: 'var(--v2-font-display)',
              fontSize: 28,
              fontWeight: 500,
              letterSpacing: '-0.02em',
            }}
          >
            {fmtUSD(net)}
          </div>
          <div style={{ fontSize: 11, opacity: 0.7 }}>net of fees &amp; WHT</div>
        </div>
        <div style={{ fontSize: 11, opacity: 0.7, marginTop: 4 }}>
          {fmtUSD(gross)} gross · −{fmtUSD(platformFee)} fee · −{fmtUSD(wht)} WHT
        </div>
      </div>

      <div style={{ padding: '16px 18px' }}>
        <div className="v2-eyebrow" style={{ marginBottom: 12 }}>Payout timeline</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {milestones.map((m, i) => {
            const isLast = i === milestones.length - 1;
            return (
              <div key={m.id} style={{ display: 'flex', gap: 10, position: 'relative' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div
                    style={{
                      width: 14,
                      height: 14,
                      borderRadius: '50%',
                      background: m.done ? 'var(--v2-moss)' : 'var(--v2-bg-2)',
                      border: m.done ? 'none' : '1.5px dashed var(--v2-line-2)',
                      display: 'grid',
                      placeItems: 'center',
                      color: 'var(--v2-paper)',
                      fontSize: 9,
                      fontWeight: 700,
                      flexShrink: 0,
                    }}
                  >
                    {m.done ? '✓' : ''}
                  </div>
                  {!isLast && (
                    <div
                      style={{
                        width: 1.5,
                        flex: 1,
                        minHeight: 22,
                        background: m.done ? 'var(--v2-moss)' : 'var(--v2-line-2)',
                        marginTop: 2,
                      }}
                    />
                  )}
                </div>
                <div style={{ paddingBottom: isLast ? 0 : 14, flex: 1 }}>
                  <div
                    style={{
                      fontSize: 12.5,
                      fontWeight: m.done ? 600 : 500,
                      color: m.done ? 'var(--v2-ink)' : 'var(--v2-ink-2)',
                    }}
                  >
                    {m.label}
                  </div>
                  <div className="v2-muted" style={{ fontSize: 11 }}>{m.date}</div>
                </div>
              </div>
            );
          })}
        </div>
        <div
          style={{
            marginTop: 12,
            padding: '8px 10px',
            background: 'var(--v2-bg)',
            borderRadius: 'var(--v2-r-md)',
            fontSize: 11.5,
            color: 'var(--v2-ink-2)',
          }}
        >
          ⚡ Instant withdrawal to your bank on release
        </div>
      </div>
    </div>
  );
}

// =====================================================================
// CollapsibleBrief — wraps the brief in a tap-to-expand block. Default
// closed with the hint "already approved when you applied" so the
// creator isn't re-reading the brief on every visit.
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
// CollabActivityCard — synthesizes a 7-day event feed from the
// collab's lifecycle: stage transitions, deliverable submits/approvals,
// payout. Demo data — a real implementation would read from a
// dedicated activity log table.
// =====================================================================

function CollabActivityCard({
  collab, brand,
}: {
  collab: V2Collab;
  brand: string;
}) {
  type Event = { when: string; who: string; what: string; icon: string; color: string };
  const events: Event[] = [];

  // Build events backwards from current stage so the most recent is at top.
  if (collab.stage === 'paid') {
    events.push({ when: 'today', who: brand, what: 'released payout · funds in your wallet', icon: '₨', color: 'var(--v2-moss)' });
  }
  if (['approved', 'live', 'paid'].includes(collab.stage)) {
    events.push({ when: '2d ago', who: brand, what: 'approved your draft', icon: '✓', color: 'var(--v2-moss)' });
  }
  if (['submitted', 'approved', 'live', 'paid'].includes(collab.stage)) {
    events.push({ when: '3d ago', who: 'You', what: 'submitted draft for review', icon: '→', color: 'var(--v2-ink-3)' });
  }
  if (collab.price > 0) {
    events.push({ when: '5d ago', who: brand, what: `funded escrow · ${fmtUSD(collab.price)}`, icon: '$', color: 'var(--v2-ink)' });
  }
  events.push({ when: '6d ago', who: 'You', what: 'accepted the offer', icon: '✓', color: 'var(--v2-moss)' });

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
        <span className="v2-muted" style={{ fontSize: 11 }}>last 7 days</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {events.map((e, i) => (
          <div key={i} className="v2-row" style={{ gap: 10, alignItems: 'flex-start' }}>
            <div
              style={{
                width: 22,
                height: 22,
                borderRadius: '50%',
                background: 'var(--v2-bg)',
                color: e.color,
                display: 'grid',
                placeItems: 'center',
                fontSize: 11,
                fontWeight: 700,
                flexShrink: 0,
              }}
            >
              {e.icon}
            </div>
            <div style={{ flex: 1, fontSize: 13 }}>
              <span style={{ fontWeight: 550 }}>{e.who}</span>{' '}
              <span style={{ color: 'var(--v2-ink-2)' }}>{e.what}</span>
              <div className="v2-muted" style={{ fontSize: 11, marginTop: 1 }}>{e.when}</div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
