// Deal page action banner (Phase 25).
//
// THE most important UX element on the redesigned deal page. Replaces
// the scattered "respond to offer" / "approve draft" / "upload Round X"
// surfaces from the old Today / Approvals / Content screens with one
// canonical "what should I do right now?" panel.
//
// Architecture:
//   - <DealActionBanner> is a pure dispatcher. It reads `deal.action.kind`
//     and renders the matching sub-banner.
//   - Each sub-banner is a presentational component receiving handlers
//     via props. The deal page owns the handlers (it knows about modals,
//     toasts, navigation); the banner only knows what to display.
//   - The same dispatcher serves all 13 deal states × 3 roles. Adding a
//     new state means adding one sub-banner; the kind→banner table
//     grows but every other consumer stays untouched.
//
// Banner copy guidelines (from Phase 23 wireframe pass):
//   1. Verb-led: "Approve $1,500" beats "Production stage"
//   2. One primary CTA per banner, max 2 secondaries
//   3. State pill + reason at top — answers "why am I seeing this?"
//   4. The passive variant tells the user nothing's blocked (with the
//      counterparty's typical response time, when known) so silence
//      feels normal, not concerning.

import type { Deal } from '@/lib/api/use-deal';
import type { Role } from '@/lib/utils/deal-action';
import { Button } from '@/components/ui/Button';
import { Pill } from '@/components/ui/Pill';
import { Icon } from '@/components/ui/Icon';
import { dealStateLabel, dealStateTone } from '@/lib/utils/labels';
import { fmtMoneyFull } from '@/lib/utils/format';
import { PresenceBanner } from '@/components/ui/PresenceBanner';
import type { Viewer } from '@/lib/utils/usePresence';

// Handlers that sub-banners can invoke. The deal page wires these to
// their actual implementations (modals, API calls, toasts).
export interface DealActionHandlers {
  onAcceptOffer: () => void;
  onCounterOffer: () => void;
  onDeclineOffer: () => void;
  onWithdrawCounter: () => void;
  onUploadDraft: () => void;
  onApproveSubmission: () => void;
  onRequestRevisions: () => void;
  onOpenDispute: () => void;
  onAddEvidence: () => void;
  onResolveDispute: () => void;
  onSendMessage: () => void;
  onReviewCounterparty: () => void;
  onShortlistApplicant: () => void;
  onDeclineApplicant: () => void;
  onSendOffer: () => void;
  onWithdrawApplication: () => void;
}

interface Props {
  deal: Deal;
  role: Role;
  handlers: DealActionHandlers;
  /** Other tabs/admins viewing this deal — surfaced inline on disputed deals. */
  presenceViewers?: Viewer[];
  /** Set true while any handler is in-flight to disable buttons. */
  busy?: boolean;
}

export function DealActionBanner({ deal, role, handlers, presenceViewers, busy }: Props) {
  // Disputed always wins — same banner regardless of state precedence.
  // Phase 25 QA fix: admin gets the resolve action; creator/brand get add-evidence.
  if (deal.state === 'disputed') {
    return <DisputedBanner deal={deal} role={role} handlers={handlers} presenceViewers={presenceViewers} busy={busy} />;
  }

  // Phase 25 QA fix: admin viewing a non-disputed deal must get a passive
  // observer banner — NOT the brand-side banners with destructive CTAs
  // that gate on `role === 'creator' || 'brand'` and silently swallow clicks.
  // Admins navigate to the deal page primarily for monitoring, not to act.
  if (role === 'admin') {
    return <AdminObserverBanner deal={deal} />;
  }

  // Closed → review prompts + performance link
  if (deal.state === 'closed') {
    return <ClosedBanner deal={deal} role={role} handlers={handlers} busy={busy} />;
  }

  // Pre-offer states — applied / shortlisted / declined / withdrawn
  if (deal.state === 'applied' || deal.state === 'shortlisted') {
    return <ApplicationBanner deal={deal} role={role} handlers={handlers} busy={busy} />;
  }
  if (deal.state === 'declined' || deal.state === 'withdrawn') {
    return <TerminalBanner deal={deal} />;
  }

  // Offer negotiation
  if (deal.state === 'offer-pending') {
    return role === 'creator'
      ? <PendingOfferCreatorBanner deal={deal} handlers={handlers} busy={busy} />
      : <OfferAwaitingBrandBanner deal={deal} handlers={handlers} busy={busy} />;
  }
  if (deal.state === 'offer-countered') {
    return role === 'brand'
      ? <CounterReviewBrandBanner deal={deal} handlers={handlers} busy={busy} />
      : <CounterAwaitingCreatorBanner deal={deal} handlers={handlers} busy={busy} />;
  }

  // Production / review / revisions
  if (deal.state === 'accepted-production') {
    return role === 'creator'
      ? <UploadDraftCreatorBanner deal={deal} handlers={handlers} busy={busy} />
      : <ProductionBrandBanner deal={deal} handlers={handlers} busy={busy} />;
  }
  if (deal.state === 'in-review') {
    return role === 'brand'
      ? <ReviewSubmissionBrandBanner deal={deal} handlers={handlers} busy={busy} />
      : <InReviewCreatorBanner deal={deal} handlers={handlers} busy={busy} />;
  }
  if (deal.state === 'revisions-requested') {
    return role === 'creator'
      ? <RevisionsCreatorBanner deal={deal} handlers={handlers} busy={busy} />
      : <RevisionsBrandBanner deal={deal} handlers={handlers} busy={busy} />;
  }

  // Approved / posted — passive, content lives on the channels
  if (deal.state === 'approved' || deal.state === 'posted') {
    return <ShippedBanner deal={deal} handlers={handlers} />;
  }

  // Defensive — should never hit since the switch above is exhaustive.
  return <TerminalBanner deal={deal} />;
}

// ============================================================
// Admin observer — read-only banner for non-disputed deals
// ============================================================

function AdminObserverBanner({ deal }: { deal: Deal }) {
  return (
    <section className="deal-banner deal-banner-passive">
      <BannerHeader deal={deal} />
      <div className="deal-banner-msg">
        Observer view · {dealStateLabel(deal.state)} between {deal.brand.name} and {deal.creator.name}.
        {deal.escrowHeld > 0 && <> {fmtMoneyFull(deal.escrowHeld)} in escrow.</>}
      </div>
    </section>
  );
}

// ============================================================
// Shared header — used by every banner so the visual rhythm is
// consistent across the 13 states. Subtle but important.
// ============================================================

function BannerHeader({ deal }: { deal: Deal }) {
  return (
    <div className="deal-banner-h">
      <Pill tone={dealStateTone(deal.state)}>{dealStateLabel(deal.state)}</Pill>
      {deal.action.reason && <span className="deal-banner-reason">{deal.action.reason}</span>}
    </div>
  );
}

// ============================================================
// Pre-offer — applied, shortlisted
// ============================================================

function ApplicationBanner({ deal, role, handlers, busy }: { deal: Deal; role: Role; handlers: DealActionHandlers; busy?: boolean }) {
  if (role === 'creator') {
    return (
      <section className="deal-banner deal-banner-passive">
        <BannerHeader deal={deal} />
        <div className="deal-banner-msg">
          {deal.state === 'shortlisted'
            ? `${deal.brand.name} added you to the shortlist for this campaign — they're reviewing options.`
            : `Your application is in. ${deal.brand.name} typically reviews within 2 days.`}
        </div>
        <div className="deal-banner-actions">
          <Button variant="ghost" size="sm" onClick={handlers.onSendMessage} icon={<Icon.inbox s={12} />}>
            Send a message
          </Button>
          <Button variant="plain" size="sm" onClick={handlers.onWithdrawApplication}>
            Withdraw
          </Button>
        </div>
      </section>
    );
  }

  // Brand
  if (deal.state === 'shortlisted') {
    return (
      <section className="deal-banner deal-banner-action">
        <BannerHeader deal={deal} />
        <div className="deal-banner-verb">Send {deal.creator.name.split(' ')[0]} an offer</div>
        <div className="deal-banner-msg">
          On your shortlist for this campaign. {deal.application?.proposedRate
            ? <>They proposed <strong>{fmtMoneyFull(deal.application.proposedRate)}</strong>.</>
            : <>They didn't propose a rate.</>}
        </div>
        <div className="deal-banner-actions">
          <Button onClick={handlers.onSendOffer} disabled={busy} icon={<Icon.spark s={14} />}>
            Send offer
          </Button>
          <Button variant="ghost" onClick={handlers.onSendMessage} icon={<Icon.inbox s={12} />}>
            Message first
          </Button>
        </div>
      </section>
    );
  }
  // applied
  return (
    <section className="deal-banner deal-banner-action">
      <BannerHeader deal={deal} />
      <div className="deal-banner-verb">New application — review</div>
      <div className="deal-banner-msg">
        {deal.creator.name} applied. Pitch: <em>"{deal.application?.pitch?.slice(0, 140) || '—'}"</em>
      </div>
      <div className="deal-banner-actions">
        <Button onClick={handlers.onShortlistApplicant} disabled={busy} icon={<Icon.check s={12} />}>
          Shortlist
        </Button>
        <Button variant="ghost" onClick={handlers.onDeclineApplicant} disabled={busy}>
          Decline
        </Button>
        <Button variant="plain" onClick={handlers.onSendMessage} icon={<Icon.inbox s={12} />}>
          Message
        </Button>
      </div>
    </section>
  );
}

// ============================================================
// Offer states
// ============================================================

function PendingOfferCreatorBanner({ deal, handlers, busy }: { deal: Deal; handlers: DealActionHandlers; busy?: boolean }) {
  const offer = deal.offer;
  return (
    <section className="deal-banner deal-banner-action">
      <BannerHeader deal={deal} />
      <div className="deal-banner-verb">
        {deal.brand.name} offered you {offer ? fmtMoneyFull(offer.rate) : '—'}
      </div>
      {offer?.message && (
        <div className="deal-banner-quote">"{offer.message}"</div>
      )}
      <div className="deal-banner-msg">
        Accepting places <strong>{fmtMoneyFull((offer?.rate || 0) / 2)}</strong> in escrow on your behalf — brand can't take it back.
      </div>
      <div className="deal-banner-actions">
        <Button onClick={handlers.onAcceptOffer} disabled={busy} icon={<Icon.check s={12} />}>
          Accept {offer ? fmtMoneyFull(offer.rate) : ''}
        </Button>
        <Button variant="ghost" onClick={handlers.onCounterOffer} disabled={busy}>
          Counter
        </Button>
        <Button variant="plain" onClick={handlers.onDeclineOffer} disabled={busy}>
          Decline
        </Button>
      </div>
    </section>
  );
}

function OfferAwaitingBrandBanner({ deal, handlers, busy }: { deal: Deal; handlers: DealActionHandlers; busy?: boolean }) {
  return (
    <section className="deal-banner deal-banner-passive">
      <BannerHeader deal={deal} />
      <div className="deal-banner-msg">
        Offer sent {deal.action.reason ? deal.action.reason.toLowerCase() : ''}. {deal.creator.name} typically responds within 4-24 hours.
      </div>
      <div className="deal-banner-actions">
        <Button variant="ghost" size="sm" onClick={handlers.onSendMessage} disabled={busy} icon={<Icon.inbox s={12} />}>
          Send a reminder
        </Button>
      </div>
    </section>
  );
}

function CounterReviewBrandBanner({ deal, handlers, busy }: { deal: Deal; handlers: DealActionHandlers; busy?: boolean }) {
  // P3 §2.1 — `Offer.counter` was a single-counter slot pre-P3; now
  // `Offer.rounds[]` carries the full transcript. The "current counter
  // to respond to" is the latest round; the "original" the brand sent
  // is round 0.
  const rounds = deal.offer?.rounds ?? [];
  const counter = rounds.length >= 2 ? rounds[rounds.length - 1] : undefined;
  const original = rounds[0]?.rate ?? deal.offer?.rate;
  return (
    <section className="deal-banner deal-banner-action">
      <BannerHeader deal={deal} />
      <div className="deal-banner-verb">
        {deal.creator.name.split(' ')[0]} countered{counter ? <> at <strong>{fmtMoneyFull(counter.rate)}</strong></> : ''}
      </div>
      {original !== undefined && counter && (
        <div className="deal-banner-msg">
          You offered <strong>{fmtMoneyFull(original)}</strong> · they're asking for <strong>{fmtMoneyFull(counter.rate)}</strong>
          {counter.rate > original ? <> ({fmtMoneyFull(counter.rate - original)} more)</> : <> ({fmtMoneyFull(original - counter.rate)} less)</>}.
        </div>
      )}
      {counter?.message && (
        <div className="deal-banner-quote">"{counter.message}"</div>
      )}
      <div className="deal-banner-actions">
        <Button onClick={handlers.onAcceptOffer} disabled={busy} icon={<Icon.check s={12} />}>
          {counter ? `Accept ${fmtMoneyFull(counter.rate)}` : 'Accept counter'}
        </Button>
        <Button variant="ghost" onClick={handlers.onCounterOffer} disabled={busy}>
          Counter again
        </Button>
        <Button variant="plain" onClick={handlers.onDeclineOffer} disabled={busy}>
          Decline counter
        </Button>
      </div>
    </section>
  );
}

function CounterAwaitingCreatorBanner({ deal, handlers, busy }: { deal: Deal; handlers: DealActionHandlers; busy?: boolean }) {
  // P3 §2.1 — same `rounds[]` read as CounterReviewBrandBanner.
  const rounds = deal.offer?.rounds ?? [];
  const counter = rounds.length >= 2 ? rounds[rounds.length - 1] : undefined;
  return (
    <section className="deal-banner deal-banner-passive">
      <BannerHeader deal={deal} />
      <div className="deal-banner-msg">
        Counter sent{counter ? <> at <strong>{fmtMoneyFull(counter.rate)}</strong></> : ''}. {deal.brand.name} typically replies within 24 hours.
      </div>
      <div className="deal-banner-actions">
        <Button variant="plain" size="sm" onClick={handlers.onWithdrawCounter} disabled={busy}>
          Withdraw counter
        </Button>
      </div>
    </section>
  );
}

// ============================================================
// Production / Review / Revisions
// ============================================================

function UploadDraftCreatorBanner({ deal, handlers, busy }: { deal: Deal; handlers: DealActionHandlers; busy?: boolean }) {
  const escrowAmount = deal.escrowHeld;
  // Phase 25 QA fix: use the latest round number, not submission count.
  // A re-offer cycle could have prior submissions alongside a fresh
  // accepted-production state; "next round" is always latestRound + 1.
  const nextRound = (deal.latestSubmission?.round ?? 0) + 1;
  return (
    <section className="deal-banner deal-banner-action">
      <BannerHeader deal={deal} />
      <div className="deal-banner-verb">
        {nextRound === 1 ? 'Upload Round 1' : `Upload Round ${nextRound}`}
      </div>
      <div className="deal-banner-msg">
        {fmtMoneyFull(escrowAmount)} in escrow · pays on approval. {deal.campaign.deliverablesText}
      </div>
      <div className="deal-banner-actions">
        <Button onClick={handlers.onUploadDraft} disabled={busy} icon={<Icon.spark s={14} />}>
          Upload files
        </Button>
        <Button variant="ghost" onClick={handlers.onSendMessage} icon={<Icon.inbox s={12} />}>
          Ask a question
        </Button>
      </div>
    </section>
  );
}

function ProductionBrandBanner({ deal, handlers, busy }: { deal: Deal; handlers: DealActionHandlers; busy?: boolean }) {
  // Phase 24 QA fix: brand banner becomes "send a nudge" when overdue.
  const isOverdue = deal.action.kind === 'send-reminder';
  return (
    <section className={['deal-banner', isOverdue ? 'deal-banner-action' : 'deal-banner-passive'].join(' ')}>
      <BannerHeader deal={deal} />
      <div className="deal-banner-msg">
        {isOverdue
          ? <>{deal.creator.name} hasn't uploaded yet — past the deadline.</>
          : <>{deal.creator.name} is producing the work. {fmtMoneyFull(deal.escrowHeld)} in escrow.</>}
      </div>
      <div className="deal-banner-actions">
        {isOverdue && (
          <Button onClick={handlers.onSendMessage} disabled={busy} icon={<Icon.inbox s={12} />}>
            Send a nudge
          </Button>
        )}
        {!isOverdue && (
          <Button variant="ghost" size="sm" onClick={handlers.onSendMessage} disabled={busy} icon={<Icon.inbox s={12} />}>
            Send a message
          </Button>
        )}
        <Button variant="plain" size="sm" onClick={handlers.onOpenDispute} disabled={busy}>
          Open dispute
        </Button>
      </div>
    </section>
  );
}

function ReviewSubmissionBrandBanner({ deal, handlers, busy }: { deal: Deal; handlers: DealActionHandlers; busy?: boolean }) {
  const releaseAmount = deal.acceptedOffer?.rate;
  const sub = deal.latestSubmission;
  return (
    <section className="deal-banner deal-banner-action">
      <BannerHeader deal={deal} />
      <div className="deal-banner-verb">
        Round {sub?.round ?? '?'} awaiting your review
      </div>
      <div className="deal-banner-msg">
        {sub?.files.length ?? 0} file{sub?.files.length === 1 ? '' : 's'}
        {releaseAmount && <> · approving releases <strong>{fmtMoneyFull(releaseAmount)}</strong> to {deal.creator.name}</>}.
        {sub?.notes && <span className="deal-banner-notes"> · "{sub.notes.slice(0, 100)}{sub.notes.length > 100 ? '…' : ''}"</span>}
      </div>
      <div className="deal-banner-actions">
        <Button onClick={handlers.onApproveSubmission} disabled={busy} icon={<Icon.check s={12} />}>
          Approve {releaseAmount ? fmtMoneyFull(releaseAmount) : ''}
        </Button>
        <Button variant="ghost" onClick={handlers.onRequestRevisions} disabled={busy}>
          Request revisions
        </Button>
      </div>
    </section>
  );
}

function InReviewCreatorBanner({ deal, handlers, busy }: { deal: Deal; handlers: DealActionHandlers; busy?: boolean }) {
  return (
    <section className="deal-banner deal-banner-passive">
      <BannerHeader deal={deal} />
      <div className="deal-banner-msg">
        {deal.brand.name} is reviewing your latest round. Typical turnaround: 1-2 days.
      </div>
      <div className="deal-banner-actions">
        <Button variant="ghost" size="sm" onClick={handlers.onSendMessage} disabled={busy} icon={<Icon.inbox s={12} />}>
          Add a follow-up
        </Button>
      </div>
    </section>
  );
}

function RevisionsCreatorBanner({ deal, handlers, busy }: { deal: Deal; handlers: DealActionHandlers; busy?: boolean }) {
  // Show the most recent feedback so creator knows what to address.
  const lastFeedback = deal.latestSubmission?.feedback?.slice(-1)[0];
  return (
    <section className="deal-banner deal-banner-action">
      <BannerHeader deal={deal} />
      <div className="deal-banner-verb">
        Upload Round {(deal.latestSubmission?.round ?? 1) + 1}
      </div>
      {lastFeedback && (
        <div className="deal-banner-quote">
          "{lastFeedback.text}"
        </div>
      )}
      <div className="deal-banner-actions">
        <Button onClick={handlers.onUploadDraft} disabled={busy} icon={<Icon.spark s={14} />}>
          Upload next round
        </Button>
        <Button variant="ghost" onClick={handlers.onSendMessage} icon={<Icon.inbox s={12} />}>
          Reply in chat
        </Button>
      </div>
    </section>
  );
}

function RevisionsBrandBanner({ deal, handlers, busy }: { deal: Deal; handlers: DealActionHandlers; busy?: boolean }) {
  const round = deal.latestSubmission?.round ?? 1;
  return (
    <section className="deal-banner deal-banner-passive">
      <BannerHeader deal={deal} />
      <div className="deal-banner-msg">
        {deal.creator.name.split(' ')[0]} is working on revisions. Round {round + 1} expected within 48h.
      </div>
      <div className="deal-banner-actions">
        <Button variant="ghost" size="sm" onClick={handlers.onSendMessage} disabled={busy} icon={<Icon.inbox s={12} />}>
          Add a follow-up
        </Button>
      </div>
    </section>
  );
}

// ============================================================
// Disputed
// ============================================================

function DisputedBanner({ deal, role, handlers, presenceViewers, busy }: {
  deal: Deal; role: Role; handlers: DealActionHandlers; presenceViewers?: Viewer[]; busy?: boolean;
}) {
  return (
    <section className="deal-banner deal-banner-disputed">
      <BannerHeader deal={deal} />
      <div className="deal-banner-verb">
        🛡 Dispute open · escrow frozen
      </div>
      <div className="deal-banner-msg">
        {deal.openDispute?.description ? <>"{deal.openDispute.description.slice(0, 200)}{deal.openDispute.description.length > 200 ? '…' : ''}"</> : 'Filed for review.'}
      </div>

      {/* Phase 22 presence — surface other admins reviewing the same dispute. */}
      {presenceViewers && presenceViewers.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <PresenceBanner viewers={presenceViewers} />
        </div>
      )}

      <div className="deal-banner-actions">
        {role === 'admin' ? (
          <Button onClick={handlers.onResolveDispute} disabled={busy} icon={<Icon.check s={12} />}>
            Resolve dispute
          </Button>
        ) : (
          <>
            {/* Phase 25 QA fix: relabel "Add evidence" → "Send context" since
                the handler currently routes to chat, not a real evidence flow.
                Phase 27/28 will replace with an actual evidence uploader. */}
            <Button onClick={handlers.onAddEvidence} disabled={busy} icon={<Icon.inbox s={12} />}>
              Send context to support
            </Button>
          </>
        )}
      </div>
    </section>
  );
}

// ============================================================
// Closed / Approved / Posted
// ============================================================

function ShippedBanner({ deal, handlers }: { deal: Deal; handlers: DealActionHandlers }) {
  return (
    <section className="deal-banner deal-banner-passive">
      <BannerHeader deal={deal} />
      <div className="deal-banner-msg">
        {deal.state === 'posted'
          ? <>Live on channels. Performance data flowing in.</>
          : <>Approved. Payout {deal.released > 0 ? <>cleared <strong>{fmtMoneyFull(deal.released)}</strong></> : 'queued'}.</>}
      </div>
      <div className="deal-banner-actions">
        <Button variant="ghost" size="sm" onClick={handlers.onSendMessage} icon={<Icon.inbox s={12} />}>
          Send a message
        </Button>
      </div>
    </section>
  );
}

function ClosedBanner({ deal, role, handlers, busy }: { deal: Deal; role: Role; handlers: DealActionHandlers; busy?: boolean }) {
  // Phase 25 QA fix: $0 payout (e.g. outcome campaign with no
  // conversions) shouldn't read as "earned $0" — that's jarring.
  const noPayout = deal.released === 0;
  const verb = noPayout
    ? '✓ Deal complete · no payout this cycle'
    : `✓ Deal complete · ${role === 'creator' ? `earned ${fmtMoneyFull(deal.released)}` : `spent ${fmtMoneyFull(deal.released)}`}`;
  return (
    <section className="deal-banner deal-banner-passive">
      <BannerHeader deal={deal} />
      <div className="deal-banner-verb">{verb}</div>
      <div className="deal-banner-actions">
        <Button onClick={handlers.onReviewCounterparty} disabled={busy} icon={<Icon.spark s={12} />}>
          Review {role === 'creator' ? deal.brand.name : deal.creator.name.split(' ')[0]}
        </Button>
      </div>
    </section>
  );
}

// Terminal states with no action — declined / withdrawn
// Phase 25 QA fix: friendlier copy that matches the actual state.
function TerminalBanner({ deal }: { deal: Deal }) {
  const isDeclined = deal.state === 'declined';
  const isWithdrawn = deal.state === 'withdrawn';
  return (
    <section className="deal-banner deal-banner-passive">
      <BannerHeader deal={deal} />
      <div className="deal-banner-msg">
        {isDeclined && 'This offer was declined. The campaign may still be live for new applications.'}
        {isWithdrawn && 'This application or counter was withdrawn. No further action on this surface.'}
        {!isDeclined && !isWithdrawn && `Deal in ${dealStateLabel(deal.state)} state — no further action available.`}
      </div>
    </section>
  );
}
