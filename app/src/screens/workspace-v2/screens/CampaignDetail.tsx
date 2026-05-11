// CampaignDetail.tsx — v2 brand-side campaign management surface
//
// The marquee screen for the campaign workflow. Mirrors the Claude
// Design handoff `CampaignDetailV2`:
//
//   ┌────────────────────────────────────────────────────────────┐
//   │ Topbar · campaign name · Pause · + Add creators            │
//   ├────────────────────────────────────────────────────────────┤
//   │ Hero stats · Budget · Pipeline · Awaiting review · Days    │
//   ├────────────────────────────────────────────────────────────┤
//   │ Tabs · Pipeline · Brief · Content review · Perf · Settings │
//   ├────────────────────────────────────────────────────────────┤
//   │ Active tab content                                          │
//   └────────────────────────────────────────────────────────────┘
//
// Pipeline tab is the 8-column Kanban (one column per V2_PIPELINE_STAGES
// entry). Cards show creator avatar, name, city, deliverable count,
// price, and a "Review pending" pill when content is in review. Clicking
// a card with a review opens the ContentReviewModal; otherwise drills
// into the creator profile.

import { useEffect, useState } from 'react';
import { fmtUSD, fmtFollowers, Icon, StagePill, Topbar } from '../lib';
import {
  useV2CampaignById, useV2CollabsForCampaign, useV2Creators,
} from '../v2Hooks';
import { V2_PIPELINE_STAGES } from '../v2Adapters';
import type {
  V2Campaign, V2Collab, V2Creator, V2CampaignPerf, V2Deliverable,
} from '../data';
import { ContentReviewModal } from './ContentReviewModal';
import { SendOfferModal, MarkLiveModal, CounterOfferModal, InviteCreatorsModal } from './WorkflowModals';
import {
  v2EndCampaign, v2PauseCampaign, v2RejectApplication, v2ResumeCampaign,
  v2WithdrawOffer, v2AcceptCounter, v2DeclineOffer,
  getApplicationFor, getActiveOfferFor, getLatestSubmissionFor,
} from '../v2CampaignActions';
import { useStore } from '@/lib/api/store';
import { pushToast } from '@/lib/utils/toast';
// P7 — UI gating for campaign-lifecycle buttons.
import { useCapability } from '@/lib/permissions';

interface Props {
  campaignId: string;
  onRoute: (r: string) => void;
  /** Optional initial tab — driven by `?tab=...` on the route, so the
   *  Needs-you-now tiles can land directly on Content review. */
  initialTab?: TabId;
  /** Optional collab id whose review modal should open on mount.
   *  Powered by `?review=<collabId>` so a single click from a home
   *  tile opens the campaign on the right tab AND the right modal. */
  initialReviewCollabId?: string;
  /** Optional submission id whose MarkLiveModal should open on mount.
   *  Powered by `?action=verify-live&sub=<id>` so the BrandHome
   *  "<creator> posted live on <campaign> — verify and confirm" tile
   *  lands the brand directly in the verify-and-confirm modal. */
  initialVerifyLiveSubmissionId?: string;
}

type TabId = 'pipeline' | 'brief' | 'content' | 'analytics' | 'settings';

const VALID_TABS: TabId[] = ['pipeline', 'brief', 'content', 'analytics', 'settings'];

export function CampaignDetail({
  campaignId, onRoute, initialTab, initialReviewCollabId,
  initialVerifyLiveSubmissionId,
}: Props) {
  const campaign = useV2CampaignById(campaignId);
  const collabs = useV2CollabsForCampaign(campaignId);
  const creators = useV2Creators();
  const db = useStore((s) => s.db);
  const [tab, setTab] = useState<TabId>(
    initialTab && VALID_TABS.includes(initialTab) ? initialTab : 'pipeline',
  );
  const [reviewing, setReviewing] = useState<V2Collab | null>(null);

  // §needs-you-direct-jump — when a home tile passes `?review=<collabId>`,
  // open the corresponding ContentReviewModal on mount. Runs once when
  // the prop is first present so reopening the same campaign without
  // the suffix doesn't re-pop the modal.
  useEffect(() => {
    if (!initialReviewCollabId) return;
    const target = collabs.find((c) => c.id === initialReviewCollabId);
    if (target) setReviewing(target);
  }, [initialReviewCollabId, collabs]);
  const [offering, setOffering] = useState<{ creator: V2Creator; defaultRate: number } | null>(null);
  const [markingLive, setMarkingLive] = useState<{ submissionId: string; campaignName: string } | null>(null);
  // §needs-you-direct-jump — when BrandHome's "posted live — verify and
  // confirm" tile passes `?action=verify-live&sub=<id>`, pop the
  // MarkLiveModal for that submission on mount. Reads campaign.name once
  // collab data is available so the modal title is correct.
  useEffect(() => {
    if (!initialVerifyLiveSubmissionId || !campaign) return;
    const sub = db.submissions.find((s) => s.id === initialVerifyLiveSubmissionId);
    if (!sub || sub.campaignId !== campaignId) return;
    setMarkingLive({ submissionId: sub.id, campaignName: campaign.name });
  }, [initialVerifyLiveSubmissionId, campaign, campaignId, db.submissions]);
  // Brand-side counter response — when the creator counters an offer,
  // the brand needs Accept / Counter back / Decline. Inline buttons
  // live on the kanban card; "Counter back" pops this modal.
  const [counterBack, setCounterBack] = useState<{ offerId: string; counterRate: number; creatorName: string } | null>(null);
  // In-place creator invite modal — replaces the old "kicked out to /discover"
  // path so the brand can multi-select + send invitations without leaving
  // the campaign context.
  const [inviteOpen, setInviteOpen] = useState(false);

  // Pull the raw campaign for stage controls (Pause/Resume/End)
  const rawCampaign = db.campaigns.find((c) => c.id === campaignId);

  if (!campaign) {
    return (
      <>
        <Topbar title="Campaign" crumb="Not found" />
        <div className="v2-content"><p className="v2-muted">No campaign with that id.</p></div>
      </>
    );
  }

  const awaitingReview = collabs.filter((c) =>
    c.deliverables.some((d) => d.status === 'in_review'),
  ).length;
  const daysLeft = Math.max(0, Math.ceil((+new Date(campaign.deadline) - Date.now()) / 86_400_000));

  const tabs: { id: TabId; label: string; count?: number }[] = [
    { id: 'pipeline',    label: 'Pipeline',       count: collabs.length },
    { id: 'brief',       label: 'Brief' },
    { id: 'content',     label: 'Content review', count: awaitingReview },
    { id: 'analytics', label: 'Analytics' },
    { id: 'settings',    label: 'Settings' },
  ];

  return (
    <>
      <Topbar
        title={campaign.name}
        crumb={
          <span>
            <button
              type="button"
              className="v2-link-btn"
              onClick={() => onRoute('campaigns')}
            >Campaigns</button>
            {' · '}
            {campaign.brand}
            {' · '}
            <span className={`v2-pill ${campaign.status === 'Live' ? 'v2-pill-live' : 'v2-pill-moss'}`} style={{ fontSize: 10 }}>
              {campaign.status}
            </span>
          </span>
        }
        actions={
          <CampaignLifecycleActions
            stage={rawCampaign?.stage}
            campaignId={campaignId}
            onAddCreators={() => setInviteOpen(true)}
          />
        }
      />
      <div className="v2-content">
        {/* Cockpit hero — campaign card with pacing + lifecycle bar
            on the left, "Needs you now" sidebar on the right. Replaces
            the older 4-stat-card grid: a single dense surface that
            answers "where am I, what's the spend look like, who's
            blocking me right now?" without scanning four separate tiles. */}
        <div className="v2-campaign-cockpit" style={{ marginBottom: 20 }}>
          <CockpitHero
            campaign={campaign}
            collabs={collabs}
            daysLeft={daysLeft}
          />
          <NeedsYouCard
            collabs={collabs}
            creators={creators}
            awaitingReview={awaitingReview}
            onJumpToContent={() => setTab('content')}
          />
        </div>

        {/* Tabs */}
        <div className="v2-tabs">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`v2-tab ${tab === t.id ? 'is-active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
              {t.count !== undefined && t.count > 0 && (
                <span className="v2-tab-count">{t.count}</span>
              )}
            </button>
          ))}
        </div>

        {tab === 'pipeline' && (
          <PipelineKanban
            collabs={collabs}
            creators={creators}
            onReview={setReviewing}
            onRoute={onRoute}
            onSendOffer={(creator, defaultRate) => setOffering({ creator, defaultRate })}
            onMarkLive={(submissionId, name) => setMarkingLive({ submissionId, campaignName: name })}
            onCounterBack={(offerId, counterRate, creatorName) =>
              setCounterBack({ offerId, counterRate, creatorName })}
            campaignName={campaign.name}
          />
        )}
        {tab === 'brief' && <BriefView campaign={campaign} onEditSettings={() => setTab('settings')} />}
        {tab === 'content' && (
          <ContentReviewTab
            collabs={collabs}
            creators={creators}
            onReview={setReviewing}
            onRoute={onRoute}
          />
        )}
        {tab === 'analytics' && (
          <AnalyticsTab
            perf={derivePerf(campaign, collabs)}
            campaign={campaign}
            collabs={collabs}
            creators={creators}
          />
        )}
        {tab === 'settings' && <SettingsTab campaign={campaign} />}
      </div>

      {reviewing && (
        <ContentReviewModal
          collab={reviewing}
          creators={creators}
          onClose={() => setReviewing(null)}
        />
      )}
      {offering && (
        <SendOfferModal
          campaignId={campaignId}
          creator={offering.creator}
          defaultRate={offering.defaultRate}
          onClose={() => setOffering(null)}
        />
      )}
      {markingLive && (
        // Pre-fill from any creator-attached permalink so the brand
        // doesn't retype what the creator already pasted on their side.
        <MarkLiveModal
          submissionId={markingLive.submissionId}
          campaignName={markingLive.campaignName}
          initialPermalink={db.submissions.find((s) => s.id === markingLive.submissionId)?.permalink}
          onClose={() => setMarkingLive(null)}
        />
      )}
      {counterBack && (
        <CounterOfferModal
          offerId={counterBack.offerId}
          counterpartyName={counterBack.creatorName}
          currentRate={counterBack.counterRate}
          side="brand"
          onClose={() => setCounterBack(null)}
        />
      )}
      {inviteOpen && (
        <InviteCreatorsModal
          campaignId={campaignId}
          campaignTitle={campaign.name}
          excludeCreatorIds={Array.from(new Set([
            // Anyone with an application, offer, or collab on this campaign
            // is already "in flight" and shouldn't be re-invited.
            ...db.applications.filter((a) => a.campaignId === campaignId).map((a) => a.creatorId),
            ...db.offers.filter((o) => o.campaignId === campaignId).map((o) => o.creatorId),
            ...db.collaborations.filter((c) => c.campaignId === campaignId).map((c) => c.creatorId),
          ]))}
          onClose={() => setInviteOpen(false)}
        />
      )}
    </>
  );
}

// =====================================================================
// Cockpit hero — campaign-status card with pacing bar + lifecycle.
// Replaces the older 4-stat-card grid. Three pieces stack vertically:
//   1. Status header — stage pill, name, brand, days-left meta
//   2. Pacing bar — spend % filled bar with a time-elapsed marker; the
//      fill color flips ahead-of-pace / behind / on-pace
//   3. Lifecycle bar — distribution of creators across briefed →
//      invited → confirmed → producing → reviewing → live
// =====================================================================

function CockpitHero({
  campaign, collabs, daysLeft,
}: {
  campaign: V2Campaign;
  collabs: V2Collab[];
  daysLeft: number;
}) {
  const TOTAL_DAYS = 30; // demo assumption — most live campaigns are 4 weeks
  const elapsed = Math.max(0, TOTAL_DAYS - daysLeft);
  const timePct = Math.min(1, elapsed / TOTAL_DAYS);
  const spendPct = campaign.budget > 0 ? Math.min(1, campaign.spent / campaign.budget) : 0;
  const pacing = spendPct - timePct; // + = ahead, - = behind

  const fillColor =
    pacing > 0.10 ? 'var(--v2-gold)'
    : pacing < -0.10 ? 'var(--v2-info)'
    : 'var(--v2-moss)';

  const pacingLabel =
    Math.abs(pacing) < 0.10 ? 'On pace'
    : pacing > 0 ? 'Ahead of pace'
    : 'Behind pace';

  return (
    <div
      className="v2-card"
      style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
    >
      <div
        style={{
          padding: '22px 24px',
          background: 'linear-gradient(135deg, var(--v2-paper) 0%, var(--v2-bg) 100%)',
          borderBottom: '1px solid var(--v2-line)',
        }}
      >
        <div
          className="v2-row"
          style={{
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: 14,
            gap: 16,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ minWidth: 0, flex: '1 1 280px' }}>
            <div className="v2-row" style={{ gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
              <span
                className={`v2-pill ${campaign.status === 'Live' ? 'v2-pill-live' : 'v2-pill-moss'}`}
                style={{ fontSize: 10 }}
              >
                {campaign.status}
              </span>
              <span className="v2-muted" style={{ fontSize: 12 }}>·</span>
              <span className="v2-muted" style={{ fontSize: 12 }}>
                {campaign.placement || 'Awareness'}
              </span>
            </div>
            <h2
              style={{
                fontFamily: 'var(--v2-font-display)',
                fontSize: 26,
                fontWeight: 500,
                margin: 0,
                letterSpacing: '-0.02em',
                color: 'var(--v2-ink)',
              }}
            >
              {campaign.name}
            </h2>
            <div className="v2-muted" style={{ fontSize: 13, marginTop: 4 }}>
              {campaign.brand} · {daysLeft > 0 ? `${daysLeft} days left` : 'Deadline passed'}
              {' · '}Deadline {new Date(campaign.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </div>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0, whiteSpace: 'nowrap' }}>
            <div className="v2-eyebrow" style={{ marginBottom: 4 }}>Budget · spend</div>
            <div
              className="v2-tabular"
              style={{
                fontFamily: 'var(--v2-font-display)',
                fontSize: 22,
                fontWeight: 500,
                letterSpacing: '-0.02em',
              }}
            >
              {fmtUSD(campaign.spent)}
              <span className="v2-muted" style={{ fontSize: 14, fontWeight: 400 }}>
                {' '}/ {fmtUSD(campaign.budget)}
              </span>
            </div>
          </div>
        </div>

        {/* Pacing bar — fill = spend, marker = time elapsed. */}
        <div style={{ position: 'relative', marginTop: 14 }}>
          <div
            style={{
              height: 8,
              background: 'var(--v2-bg-2)',
              borderRadius: 4,
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            <div
              style={{
                width: `${spendPct * 100}%`,
                height: '100%',
                background: fillColor,
                transition: 'width .3s',
              }}
            />
            <div
              aria-hidden="true"
              title={`Time elapsed: ${Math.round(timePct * 100)}%`}
              style={{
                position: 'absolute',
                left: `${timePct * 100}%`,
                top: -3,
                bottom: -3,
                width: 2,
                background: 'var(--v2-ink)',
                borderRadius: 1,
              }}
            />
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginTop: 6,
              fontSize: 11,
              gap: 12,
              flexWrap: 'wrap',
            }}
          >
            <span className="v2-muted" style={{ whiteSpace: 'nowrap' }}>
              {Math.round(spendPct * 100)}% spent · {Math.round(timePct * 100)}% time elapsed
            </span>
            <span
              style={{
                color: Math.abs(pacing) < 0.10
                  ? 'var(--v2-moss)'
                  : pacing > 0 ? 'var(--v2-gold)' : 'var(--v2-info)',
                fontWeight: 600,
                whiteSpace: 'nowrap',
              }}
            >
              {pacingLabel}
            </span>
          </div>
        </div>
      </div>

      <div style={{ padding: '16px 24px' }}>
        <RosterLifecycle collabs={collabs} />
      </div>
    </div>
  );
}

// =====================================================================
// Roster lifecycle — slim distribution bar showing how many creators
// have made it to each lifecycle stage. Stages collapse the 8-stage
// pipeline into 6 readable phases for the cockpit summary.
// =====================================================================

function RosterLifecycle({ collabs }: { collabs: V2Collab[] }) {
  const stages: { id: string; label: string; reach: V2Collab['stage'][] }[] = [
    { id: 'briefed',   label: 'Briefed',    reach: ['pitched', 'invited', 'negotiating', 'confirmed', 'submitted', 'approved', 'live', 'paid'] },
    { id: 'invited',   label: 'Invited',    reach: ['invited', 'negotiating', 'confirmed', 'submitted', 'approved', 'live', 'paid'] },
    { id: 'confirmed', label: 'Confirmed',  reach: ['confirmed', 'submitted', 'approved', 'live', 'paid'] },
    { id: 'producing', label: 'Producing',  reach: ['submitted', 'approved', 'live', 'paid'] },
    { id: 'reviewing', label: 'Reviewing',  reach: ['approved', 'live', 'paid'] },
    { id: 'live',      label: 'Live',       reach: ['live', 'paid'] },
  ];
  const total = collabs.length || 1;

  return (
    <div>
      <div className="v2-row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
        <div className="v2-eyebrow">Roster lifecycle</div>
        <div className="v2-muted" style={{ fontSize: 11 }}>
          {collabs.length} {collabs.length === 1 ? 'creator' : 'creators'}
        </div>
      </div>
      <div style={{ overflowX: 'auto', paddingBottom: 2, marginInline: -4, paddingInline: 4 }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${stages.length}, minmax(60px, 1fr))`,
            gap: 6,
            minWidth: 380,
          }}
        >
          {stages.map((s) => {
            const count = collabs.filter((c) => s.reach.includes(c.stage)).length;
            const pct = count / total;
            const fill =
              pct === 1 ? 'var(--v2-moss)'
              : pct > 0 ? 'var(--v2-accent)'
              : 'var(--v2-bg-2)';
            return (
              <div key={s.id}>
                <div
                  style={{
                    height: 6,
                    background: 'var(--v2-bg-2)',
                    borderRadius: 3,
                    overflow: 'hidden',
                    marginBottom: 6,
                  }}
                >
                  <div
                    style={{
                      width: `${pct * 100}%`,
                      height: '100%',
                      background: fill,
                      transition: 'width .3s',
                    }}
                  />
                </div>
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    color: pct > 0 ? 'var(--v2-ink-2)' : 'var(--v2-ink-4)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {s.label}
                </div>
                <div className="v2-tabular" style={{ fontSize: 11, color: 'var(--v2-ink-3)', marginTop: 2 }}>
                  {count}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// =====================================================================
// "Needs you now" sidebar — the answer to "what's blocking me?"
// Header flips accent-bg when there are actions; idle state shows a
// caught-up confirmation. Three blocks: pending reviews (accent),
// overdue submissions (gold left border), live posts.
// =====================================================================

function NeedsYouCard({
  collabs, creators, awaitingReview, onJumpToContent,
}: {
  collabs: V2Collab[];
  creators: V2Creator[];
  awaitingReview: number;
  onJumpToContent: () => void;
}) {
  const reviewItems = collabs.filter((c) => c.deliverables.some((d) => d.status === 'in_review'));
  const overdueItems = collabs.filter((c) =>
    c.deliverables.some((d) => d.status === 'pending' && cv2DaysUntil(d.due) < 0),
  );
  const liveItems = collabs.filter((c) => c.deliverables.some((d) => d.status === 'live'));
  const totalActions = reviewItems.length + overdueItems.length;
  void awaitingReview; // exposed prop for parity with the header counters

  return (
    <div
      className="v2-card"
      style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
    >
      <div
        style={{
          padding: '14px 18px',
          background: totalActions > 0 ? 'var(--v2-accent)' : 'var(--v2-bg)',
          color: totalActions > 0 ? 'var(--v2-paper)' : 'var(--v2-ink-2)',
          borderBottom: '1px solid var(--v2-line)',
        }}
      >
        <div className="v2-row" style={{ justifyContent: 'space-between' }}>
          <div
            className="v2-eyebrow"
            style={{ color: 'inherit', opacity: totalActions > 0 ? 0.85 : 1 }}
          >
            Needs you now
          </div>
          {totalActions > 0 && (
            <div
              className="v2-tabular"
              style={{ fontSize: 18, fontWeight: 700, fontFamily: 'var(--v2-font-display)' }}
            >
              {totalActions}
            </div>
          )}
        </div>
      </div>

      <div style={{ flex: 1, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {reviewItems.length > 0 && (
          <button
            type="button"
            onClick={onJumpToContent}
            style={{
              textAlign: 'left',
              padding: '10px 12px',
              background: 'var(--v2-accent-soft)',
              border: '1px solid var(--v2-accent-soft)',
              borderRadius: 'var(--v2-r-md)',
              cursor: 'pointer',
              width: '100%',
            }}
          >
            <div className="v2-row" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--v2-accent)' }}>
                ⊙ {reviewItems.length} content review{reviewItems.length === 1 ? '' : 's'} pending
              </span>
              <span className="v2-muted" style={{ fontSize: 11 }}>→</span>
            </div>
            <div className="v2-row" style={{ gap: -4 }}>
              {reviewItems.slice(0, 4).map((x) => {
                const cr = creators.find((c) => c.id === x.creatorId);
                return cr ? (
                  <div
                    key={x.id}
                    className="v2-avatar v2-avatar-xs"
                    style={{
                      backgroundImage: `url(${cr.avatar})`,
                      marginLeft: -4,
                      boxShadow: '0 0 0 2px var(--v2-accent-soft)',
                    }}
                    aria-label={cr.name}
                  />
                ) : null;
              })}
              {reviewItems.length > 4 && (
                <span style={{
                  fontSize: 11,
                  color: 'var(--v2-accent)',
                  marginLeft: 6,
                  alignSelf: 'center',
                }}>
                  +{reviewItems.length - 4}
                </span>
              )}
            </div>
          </button>
        )}

        {overdueItems.length > 0 && (
          <div
            style={{
              padding: '10px 12px',
              border: '1px solid var(--v2-line)',
              borderLeft: '3px solid var(--v2-gold)',
              borderRadius: 'var(--v2-r-md)',
            }}
          >
            <div className="v2-row" style={{ justifyContent: 'space-between' }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--v2-ink)' }}>
                ⏱ {overdueItems.length} overdue submission{overdueItems.length === 1 ? '' : 's'}
              </span>
            </div>
            <div className="v2-muted" style={{ fontSize: 11, marginTop: 3 }}>
              Auto-nudge sent · Manual follow-up recommended
            </div>
          </div>
        )}

        {liveItems.length > 0 && (
          <div
            style={{
              padding: '10px 12px',
              border: '1px solid var(--v2-line)',
              borderRadius: 'var(--v2-r-md)',
            }}
          >
            <div className="v2-row" style={{ gap: 8 }}>
              <span
                aria-hidden="true"
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: 'var(--v2-moss)',
                  boxShadow: '0 0 0 3px color-mix(in oklab, var(--v2-moss) 25%, transparent)',
                }}
              />
              <span style={{ fontSize: 12, fontWeight: 600 }}>
                {liveItems.length} post{liveItems.length === 1 ? '' : 's'} live
              </span>
            </div>
          </div>
        )}

        {totalActions === 0 && liveItems.length === 0 && (
          <div style={{ padding: '20px 8px', textAlign: 'center' }}>
            <div style={{ fontSize: 24, marginBottom: 6 }}>✓</div>
            <div className="v2-muted" style={{ fontSize: 12 }}>You're all caught up.</div>
          </div>
        )}

        <div
          style={{
            marginTop: 'auto',
            paddingTop: 10,
            borderTop: '1px solid var(--v2-line)',
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 8,
          }}
        >
          <div>
            <div className="v2-muted" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Avg approval time
            </div>
            <div className="v2-tabular" style={{ fontSize: 13, fontWeight: 600 }}>
              1.4 days
            </div>
          </div>
          <div>
            <div className="v2-muted" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Reply within
            </div>
            <div className="v2-tabular" style={{ fontSize: 13, fontWeight: 600 }}>
              3h target
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Days until a human-format `due` string ("May 18"). Returns negative
 *  numbers when the date has passed. We anchor the year to the current
 *  year so demo data doesn't read as decades old. */
function cv2DaysUntil(due: string): number {
  if (!due) return 0;
  const withYear = /\d{4}/.test(due) ? due : `${new Date().getFullYear()} ${due}`;
  const ms = new Date(withYear).getTime();
  if (Number.isNaN(ms)) return 0;
  return Math.round((ms - Date.now()) / 86_400_000);
}


// =====================================================================
// Pipeline Kanban (8 columns)
// =====================================================================

function PipelineKanban({ collabs, creators, onReview, onRoute, onSendOffer, onMarkLive, onCounterBack, campaignName }: {
  collabs: V2Collab[];
  creators: V2Creator[];
  onReview: (c: V2Collab) => void;
  onRoute: (r: string) => void;
  onSendOffer: (creator: V2Creator, defaultRate: number) => void;
  onMarkLive: (submissionId: string, campaignName: string) => void;
  onCounterBack: (offerId: string, counterRate: number, creatorName: string) => void;
  campaignName: string;
}) {
  return (
    <div className="v2-kanban">
      {V2_PIPELINE_STAGES.map((stage) => {
        const items = collabs.filter((c) => c.stage === stage.id);
        // Per-column committed spend — sum of agreed rates for collabs
        // currently in this stage. Helps the brand see at a glance how
        // much escrow is parked in each phase of the pipeline.
        const columnSpend = items.reduce((s, c) => s + (c.price || 0), 0);
        return (
          <div key={stage.id} className="v2-kanban-col">
            <div className="v2-kanban-col-head">
              <span className="v2-kanban-dot" style={{ background: stage.color }} />
              <span className="v2-kanban-col-label">{stage.label}</span>
              <span className="v2-kanban-col-count">{items.length}</span>
              {columnSpend > 0 && (
                <span
                  className="v2-kanban-col-spend"
                  title={`${fmtUSD(columnSpend)} committed across this column`}
                >
                  {fmtUSD(columnSpend)}
                </span>
              )}
            </div>
            <div className="v2-kanban-list">
              {items.map((collab) => {
                const creator = creators.find((c) => c.id === collab.creatorId);
                if (!creator) return null;
                return (
                  <KanbanCollabCard
                    key={collab.id}
                    collab={collab}
                    creator={creator}
                    campaignName={campaignName}
                    onReview={onReview}
                    onRoute={onRoute}
                    onSendOffer={onSendOffer}
                    onMarkLive={onMarkLive}
                    onCounterBack={onCounterBack}
                  />
                );
              })}
              {items.length === 0 && <div className="v2-kanban-empty">Empty</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// =====================================================================
// KanbanCollabCard — stage-appropriate inline actions
// =====================================================================

function KanbanCollabCard({ collab, creator, campaignName, onReview, onRoute, onSendOffer, onMarkLive, onCounterBack }: {
  collab: V2Collab;
  creator: V2Creator;
  campaignName: string;
  onReview: (c: V2Collab) => void;
  onRoute: (r: string) => void;
  onSendOffer: (creator: V2Creator, defaultRate: number) => void;
  onMarkLive: (submissionId: string, campaignName: string) => void;
  onCounterBack: (offerId: string, counterRate: number, creatorName: string) => void;
}) {
  const hasReview = collab.deliverables.some((d) => d.status === 'in_review');
  // Overdue: any pending deliverable whose human-format `due` is past.
  // Drives the gold left-border indicator on the kanban card.
  const isOverdue = collab.deliverables.some(
    (d) => d.status === 'pending' && cv2DaysUntil(d.due) < 0,
  );
  const handleCardClick = () => {
    if (hasReview) onReview(collab);
    else onRoute(`creator:${creator.id}`);
  };

  // Per-stage inline action button
  let stageAction: React.ReactNode = null;
  const stop = (e: React.MouseEvent) => e.stopPropagation();
  // P5 gating — Pass + Withdraw are decision/lifecycle actions on
  // applications and offers respectively. Admin + ops on the brand
  // team hold both; finance + viewer see the buttons but can't fire.
  const canDecide = useCapability('application.decide');
  const canWithdraw = useCapability('offer.withdraw');

  if (collab.stage === 'pitched') {
    const rate = collab.price > 0 ? collab.price : creator.rate;
    const application = getApplicationFor(collab.campaignId, collab.creatorId);
    stageAction = (
      <div className="v2-row" style={{ gap: 6, marginTop: 8 }}>
        {application && (
          <button
            type="button"
            className="v2-btn v2-btn-sm v2-btn-ghost"
            style={{ flex: 1, justifyContent: 'center', fontSize: 11 }}
            onClick={(e) => { stop(e); v2RejectApplication(application.id); }}
            disabled={!canDecide}
            title={!canDecide ? 'Admin or ops only' : undefined}
          >
            {canDecide ? 'Pass' : 'Locked'}
          </button>
        )}
        <button
          type="button"
          className="v2-btn v2-btn-sm v2-btn-primary"
          style={{ flex: 2, justifyContent: 'center', fontSize: 11 }}
          onClick={(e) => { stop(e); onSendOffer(creator, rate); }}
        >
          Send offer
        </button>
      </div>
    );
  } else if (collab.stage === 'invited' || collab.stage === 'negotiating') {
    const offer = getActiveOfferFor(collab.campaignId, collab.creatorId);
    // Three sub-states share this stage; the right CTA depends on
    // who owes the next move:
    //
    //  (a) status='pending' — brand sent an offer, creator hasn't
    //      replied yet. Brand can Withdraw. ("Awaiting reply")
    //
    //  (b) status='countered' AND lastRound.by='creator' — creator
    //      countered, brand owes a response. Surface the counter
    //      rate + Accept/Counter back/Decline. THIS is the bug-fix
    //      path: pre-fix the kanban kept saying "Awaiting reply"
    //      and the brand had no way to act.
    //
    //  (c) status='countered' AND lastRound.by='brand' — brand
    //      countered, creator owes a response. Brand sees "Awaiting
    //      reply" again with a Withdraw CTA. Same as (a) materially.
    const lastRound = offer?.rounds?.[offer.rounds.length - 1];
    const creatorCounteredPending = offer
      && offer.status === 'countered'
      && lastRound?.by === 'creator';
    const counterRate = lastRound?.rate ?? offer?.rate ?? 0;

    if (creatorCounteredPending && offer) {
      stageAction = (
        <div style={{ marginTop: 8 }}>
          <div
            style={{
              padding: '6px 8px',
              background: 'var(--v2-accent-soft)',
              borderRadius: 6,
              fontSize: 11,
              color: 'var(--v2-ink-2)',
              marginBottom: 6,
              lineHeight: 1.4,
            }}
          >
            <strong style={{ color: 'var(--v2-accent)' }}>{creator.name.split(' ')[0]} countered</strong>
            {' '}with <strong>{fmtUSD(counterRate)}</strong>
            {lastRound?.message ? <span className="v2-muted"> — {String(lastRound.message).slice(0, 60)}{String(lastRound.message).length > 60 ? '…' : ''}</span> : null}
          </div>
          <div className="v2-row" style={{ gap: 6 }}>
            <button
              type="button"
              className="v2-btn v2-btn-sm v2-btn-ghost"
              style={{ flex: 1, justifyContent: 'center', fontSize: 11 }}
              onClick={(e) => { stop(e); v2DeclineOffer(offer.id); }}
              disabled={!canWithdraw}
              title={!canWithdraw ? 'Admin or ops only' : undefined}
            >
              Decline
            </button>
            <button
              type="button"
              className="v2-btn v2-btn-sm v2-btn-outline"
              style={{ flex: 1, justifyContent: 'center', fontSize: 11 }}
              onClick={(e) => { stop(e); onCounterBack(offer.id, counterRate, creator.name); }}
              disabled={!canWithdraw}
              title={!canWithdraw ? 'Admin or ops only' : undefined}
            >
              Counter back
            </button>
            <button
              type="button"
              className="v2-btn v2-btn-sm v2-btn-primary"
              style={{ flex: 1.4, justifyContent: 'center', fontSize: 11 }}
              onClick={(e) => { stop(e); v2AcceptCounter(offer.id); }}
              disabled={!canWithdraw}
              title={!canWithdraw ? 'Admin or ops only' : undefined}
            >
              Accept ({fmtUSD(counterRate)})
            </button>
          </div>
        </div>
      );
    } else {
      stageAction = (
        <div className="v2-row" style={{ gap: 6, marginTop: 8, alignItems: 'center' }}>
          <span className="v2-muted" style={{ fontSize: 11, flex: 1 }}>
            {offer?.status === 'countered' ? 'Awaiting reply to your counter' : 'Awaiting reply'}
          </span>
          {offer && (offer.status === 'pending' || offer.status === 'countered') && (
            <button
              type="button"
              className="v2-btn v2-btn-sm v2-btn-ghost"
              style={{ fontSize: 11 }}
              onClick={(e) => { stop(e); v2WithdrawOffer(offer.id); }}
              disabled={!canWithdraw}
              title={!canWithdraw ? 'Admin or ops only' : undefined}
            >
              {canWithdraw ? 'Withdraw' : 'Locked'}
            </button>
          )}
        </div>
      );
    }
  } else if (collab.stage === 'submitted' && hasReview) {
    stageAction = (
      <button
        type="button"
        className="v2-btn v2-btn-sm v2-btn-primary"
        style={{ width: '100%', justifyContent: 'center', marginTop: 8, fontSize: 11 }}
        onClick={(e) => { stop(e); onReview(collab); }}
      >
        Review submission
      </button>
    );
  } else if (collab.stage === 'approved') {
    const latest = getLatestSubmissionFor(collab.campaignId, collab.creatorId);
    if (latest) {
      stageAction = (
        <button
          type="button"
          className="v2-btn v2-btn-sm v2-btn-primary"
          style={{ width: '100%', justifyContent: 'center', marginTop: 8, fontSize: 11 }}
          onClick={(e) => { stop(e); onMarkLive(latest.id, campaignName); }}
        >
          Mark as live
        </button>
      );
    }
  } else if (collab.stage === 'live') {
    stageAction = (
      <div className="v2-muted" style={{ fontSize: 11, marginTop: 8, textAlign: 'center', fontStyle: 'italic' }}>
        Live · tracking
      </div>
    );
  } else if (collab.stage === 'paid') {
    stageAction = (
      <div className="v2-muted" style={{ fontSize: 11, marginTop: 8, textAlign: 'center', fontStyle: 'italic' }}>
        Paid out · complete
      </div>
    );
  } else if (collab.stage === 'confirmed') {
    stageAction = (
      <div className="v2-muted" style={{ fontSize: 11, marginTop: 8, textAlign: 'center', fontStyle: 'italic' }}>
        Awaiting upload
      </div>
    );
  }

  return (
    <article
      className={[
        'v2-kanban-card',
        hasReview ? 'is-review is-review-pending' : '',
        isOverdue ? 'is-overdue' : '',
      ].filter(Boolean).join(' ')}
      onClick={handleCardClick}
    >
      <div className="v2-row" style={{ gap: 8, marginBottom: 8 }}>
        <div
          className="v2-avatar v2-avatar-sm"
          style={{ backgroundImage: `url(${creator.avatar})` }}
          aria-hidden="true"
        />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="v2-kanban-card-name">{creator.name}</div>
          <div className="v2-muted" style={{ fontSize: 11 }}>{creator.city}</div>
        </div>
      </div>
      {collab.price > 0 && (
        <div className="v2-row" style={{ justifyContent: 'space-between', fontSize: 12 }}>
          <span className="v2-muted">
            {collab.deliverables.length} deliverable{collab.deliverables.length !== 1 ? 's' : ''}
          </span>
          <span className="v2-tabular" style={{ fontWeight: 550 }}>{fmtUSD(collab.price)}</span>
        </div>
      )}
      {hasReview && <div className="v2-kanban-review-pill">Review pending</div>}
      {stageAction}
    </article>
  );
}

// =====================================================================
// Brief tab
// =====================================================================

function BriefView({ campaign, onEditSettings }: { campaign: V2Campaign; onEditSettings: () => void }) {
  return (
    <div className="v2-row" style={{ gap: 24, alignItems: 'flex-start', flexWrap: 'wrap' }}>
      <section className="v2-card v2-card-pad-lg" style={{ flex: '2 1 480px' }}>
        <div className="v2-row" style={{ justifyContent: 'space-between', marginBottom: 16 }}>
          <h3 style={{
            fontFamily: 'var(--v2-font-display)',
            fontSize: 22,
            fontWeight: 500,
            margin: 0,
            letterSpacing: '-0.02em',
          }}>The brief</h3>
          <button
            className="v2-btn v2-btn-sm v2-btn-outline"
            type="button"
            onClick={onEditSettings}
          >{Icon.edit} Edit</button>
        </div>
        <p style={{ lineHeight: 1.65, color: 'var(--v2-ink-2)', margin: '0 0 24px', fontSize: 15 }}>
          {campaign.brief}
        </p>

        <h4 style={{
          fontFamily: 'var(--v2-font-display)',
          fontSize: 16,
          fontWeight: 500,
          margin: '20px 0 10px',
        }}>
          Brand-safe checklist
        </h4>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[
            'Show product clearly within first 3 seconds',
            `Use the campaign hashtag in caption`,
            `Tag the brand and disclose #ad`,
            'No flashy hard-cuts; keep it daily-life',
            'Avoid competitor brand mentions',
          ].map((s) => (
            <li key={s} className="v2-row" style={{ gap: 8, fontSize: 14 }}>
              <span style={{ color: 'var(--v2-moss)', display: 'flex' }}>{Icon.check}</span>
              {s}
            </li>
          ))}
        </ul>
      </section>

      <aside className="v2-card v2-card-pad" style={{ flex: '1 1 280px' }}>
        <div className="v2-eyebrow" style={{ marginBottom: 12 }}>Brief assets</div>
        {[
          { name: 'Brand guidelines.pdf', size: '2.4 MB' },
          { name: 'Product shot pack.zip', size: '18 MB' },
          { name: 'Caption examples.docx', size: '84 KB' },
        ].map((f) => (
          <div key={f.name} className="v2-row v2-asset-row">
            <div className="v2-asset-icon">PDF</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="v2-asset-name">{f.name}</div>
              <div className="v2-muted" style={{ fontSize: 11 }}>{f.size}</div>
            </div>
            <button
              className="v2-icon-btn"
              type="button"
              aria-label={`Open ${f.name}`}
              onClick={() => pushToast(`Asset preview not wired in demo · ${f.name}`, 'default')}
            >{Icon.external}</button>
          </div>
        ))}
        <button
          className="v2-btn v2-btn-sm v2-btn-outline"
          type="button"
          style={{ width: '100%', marginTop: 10 }}
          onClick={() => pushToast('Asset upload coming soon — paste a Drive / Dropbox link in the brief for now', 'default')}
        >
          {Icon.plus} Upload asset
        </button>
      </aside>
    </div>
  );
}

// =====================================================================
// Content Review tab
// =====================================================================

function ContentReviewTab({ collabs, creators, onReview, onRoute }: {
  collabs: V2Collab[];
  creators: V2Creator[];
  onReview: (c: V2Collab) => void;
  onRoute: (r: string) => void;
}) {
  const inReview = collabs.flatMap((c) =>
    c.deliverables
      .filter((d) => d.status === 'in_review')
      .map((d) => ({ collab: c, deliverable: d })),
  );
  const live = collabs.flatMap((c) =>
    c.deliverables
      .filter((d) => d.status === 'approved' || d.status === 'live')
      .map((d) => ({ collab: c, deliverable: d })),
  );

  return (
    <div>
      <h3 style={{
        fontFamily: 'var(--v2-font-display)',
        fontSize: 22,
        fontWeight: 500,
        margin: '0 0 12px',
        letterSpacing: '-0.02em',
      }}>
        Awaiting your review
      </h3>
      {inReview.length === 0 && (
        <div className="v2-card v2-card-pad-lg" style={{ textAlign: 'center', color: 'var(--v2-ink-3)', marginBottom: 24 }}>
          All caught up — no submissions awaiting review.
        </div>
      )}
      <div className="v2-grid-3" style={{ gap: 12, marginBottom: 32 }}>
        {inReview.map(({ collab, deliverable }) => {
          const creator = creators.find((c) => c.id === collab.creatorId);
          if (!creator) return null;
          return (
            <article
              key={deliverable.id}
              className="v2-review-card"
              onClick={() => onReview(collab)}
            >
              <div
                className="v2-review-thumb"
                style={{
                  backgroundImage: deliverable.thumb ? `url(${deliverable.thumb})` : undefined,
                  background: !deliverable.thumb ? 'var(--v2-bg-2)' : undefined,
                }}
              >
                <span className="v2-review-pill">Review</span>
                <div className="v2-review-creator">
                  <div
                    className="v2-avatar v2-avatar-sm"
                    style={{ backgroundImage: `url(${creator.avatar})`, border: '2px solid white' }}
                    aria-hidden="true"
                  />
                  <span>{creator.name}</span>
                </div>
              </div>
              <div className="v2-card-pad" style={{ padding: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>{deliverable.label}</div>
                <div className="v2-muted" style={{ fontSize: 11.5 }}>
                  Submitted {deliverable.submittedAt} · Due {deliverable.due}
                </div>
              </div>
            </article>
          );
        })}
      </div>

      <h3 style={{
        fontFamily: 'var(--v2-font-display)',
        fontSize: 22,
        fontWeight: 500,
        margin: '0 0 12px',
        letterSpacing: '-0.02em',
      }}>
        Approved & live
      </h3>
      <div className="v2-card" style={{ overflow: 'hidden' }}>
        <table className="v2-table">
          <thead>
            <tr>
              <th>Creator</th>
              <th>Deliverable</th>
              <th>Status</th>
              <th>Live link</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {live.map(({ collab, deliverable }) => {
              const creator = creators.find((c) => c.id === collab.creatorId);
              if (!creator) return null;
              return (
                <tr key={deliverable.id}>
                  <td>
                    <div className="v2-row" style={{ gap: 8 }}>
                      <div
                        className="v2-avatar v2-avatar-sm"
                        style={{ backgroundImage: `url(${creator.avatar})` }}
                        aria-hidden="true"
                      />
                      <span style={{ fontWeight: 550 }}>{creator.name}</span>
                    </div>
                  </td>
                  <td>{deliverable.label}</td>
                  <td><StagePill stage={deliverable.status === 'live' ? 'Live' : 'Approved'} /></td>
                  <td className="v2-muted" style={{ fontSize: 12 }}>
                    {deliverable.permalink ? (
                      <span style={{ color: 'var(--v2-info)' }}>{deliverable.permalink} ↗</span>
                    ) : '—'}
                  </td>
                  <td>
                    <button
                      className="v2-btn v2-btn-sm v2-btn-ghost"
                      type="button"
                      onClick={() => {
                        // Open the live URL in a new tab when set; otherwise
                        // route to the brand-side creator profile so the
                        // brand can drill into work history + book again.
                        if (deliverable.permalink) {
                          window.open(deliverable.permalink, '_blank', 'noopener,noreferrer');
                        } else {
                          onRoute(`creator:${creator.id}`);
                        }
                      }}
                    >View</button>
                  </td>
                </tr>
              );
            })}
            {live.length === 0 && (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', color: 'var(--v2-ink-3)', padding: 32 }}>
                  No approved content yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// =====================================================================
// Analytics tab — replaces the older Performance tab. Per the design's
// brief: 4 KPI tiles with sparklines + deltas, time-range toolbar +
// Export/Share actions, big perf chart with axis grid + 3 metric
// toggles, engagement breakdown bars + save/share rates, top
// performers leaderboard with medal ranks, audience reached card,
// content mix card with best-performing-format callout.
// =====================================================================

export function derivePerf(campaign: V2Campaign, collabs: V2Collab[]): V2CampaignPerf | null {
  // Synthesize from the campaign reach + engagement fields. Live
  // placements are the multiplier — no live = no perf yet.
  const liveCount = collabs.filter((c) => c.stage === 'live' || c.stage === 'paid').length;
  if (liveCount === 0) return null;

  const reach = campaign.spent > 0 ? campaign.spent * 18 : 0;
  const engagement = Math.round(reach * 0.115);
  const impressions = Math.round(reach * 1.3);
  const er = 11.5;
  const cpm = reach > 0 ? Math.round((campaign.spent / reach) * 1000) : 0;
  const cpe = engagement > 0 ? Math.round(campaign.spent / engagement) : 0;
  return {
    impressions,
    reach,
    engagement,
    er,
    cpm,
    cpe,
    saves: Math.round(engagement * 0.15),
    shares: Math.round(engagement * 0.07),
    profileVisits: Math.round(reach * 0.05),
    weeklySeries: [12, 18, 14, 22, 28, 31, 38].map((n) => Math.round(n * (liveCount / 3))),
  };
}

function AnalyticsTab({
  perf, campaign, collabs, creators,
}: {
  perf: V2CampaignPerf | null;
  campaign: V2Campaign;
  collabs: V2Collab[];
  creators: V2Creator[];
}) {
  const [metric, setMetric] = useState<'impressions' | 'engagement' | 'er'>('engagement');
  const [range, setRange] = useState<'campaign' | '7d' | 'live'>('campaign');
  void range; // visual-only filter; the demo perf series is rangeless

  if (!perf) {
    return (
      <div className="v2-card v2-card-pad-lg" style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 28, marginBottom: 10, opacity: 0.4 }}>◐</div>
        <div style={{
          fontFamily: 'var(--v2-font-display)',
          fontSize: 18,
          fontWeight: 500,
          marginBottom: 6,
        }}>
          Analytics unlock once content goes live
        </div>
        <div className="v2-muted" style={{ fontSize: 13 }}>
          You'll see impressions, engagement, audience, and ROI here as posts publish.
        </div>
      </div>
    );
  }

  // Earned Media Value: industry-benchmark CPM × impressions.
  const benchCPM = 50; // USD — paid social benchmark
  const emv = Math.round((perf.impressions / 1000) * benchCPM);
  const roas = (emv / Math.max(1, campaign.spent)).toFixed(2);
  const cpmDeltaPositive = perf.cpm < benchCPM;
  const cpmDeltaPct = Math.round(Math.abs(benchCPM - perf.cpm) / benchCPM * 100);

  return (
    <div>
      {/* Toolbar — time range + Export/Share actions. */}
      <div
        className="v2-row"
        style={{ justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}
      >
        <div className="v2-row" style={{ gap: 6 }}>
          {([
            { id: 'campaign', label: 'Campaign-to-date' },
            { id: '7d',       label: 'Last 7d' },
            { id: 'live',     label: 'Since live' },
          ] as const).map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setRange(r.id)}
              className="v2-btn v2-btn-sm"
              style={{
                background: range === r.id ? 'var(--v2-ink)' : 'transparent',
                color: range === r.id ? 'var(--v2-paper)' : 'var(--v2-ink-2)',
                border: `1px solid ${range === r.id ? 'var(--v2-ink)' : 'var(--v2-line)'}`,
              }}
            >
              {r.label}
            </button>
          ))}
        </div>
        <div className="v2-row" style={{ gap: 8 }}>
          <button className="v2-btn v2-btn-sm v2-btn-outline" type="button">
            {Icon.external} Export CSV
          </button>
          <button className="v2-btn v2-btn-sm v2-btn-outline" type="button">
            Share report
          </button>
        </div>
      </div>

      {/* KPI tiles — 4-up with sparklines + deltas. */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 12,
          marginBottom: 20,
        }}
      >
        <KpiTile
          label="Impressions"
          value={fmtFollowers(perf.impressions)}
          delta="+18% wk/wk"
          deltaPositive
          spark={perf.weeklySeries}
        />
        <KpiTile
          label="Engagement rate"
          value={`${perf.er}%`}
          delta={`+${(perf.er - 4.2).toFixed(1)}pt vs 4.2% category`}
          deltaPositive
          accent
        />
        <KpiTile
          label="CPM"
          value={`$${(perf.cpm / 1000).toFixed(1)}k`}
          delta={`${cpmDeltaPositive ? '−' : '+'}${cpmDeltaPct}% vs paid social`}
          deltaPositive={cpmDeltaPositive}
        />
        <KpiTile
          label="EMV"
          value={`$${(emv / 1_000).toFixed(1)}k`}
          delta={`${roas}× ROAS`}
          deltaPositive
        />
      </div>

      {/* Chart + breakdown row. */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1.6fr 1fr',
          gap: 16,
          marginBottom: 20,
        }}
      >
        <div className="v2-card v2-card-pad-lg">
          <div className="v2-row" style={{ justifyContent: 'space-between', marginBottom: 16 }}>
            <h3 style={{
              fontFamily: 'var(--v2-font-display)',
              fontSize: 19, fontWeight: 500, margin: 0, letterSpacing: '-0.02em',
            }}>
              Performance over time
            </h3>
            <div className="v2-row" style={{ gap: 4 }}>
              {([
                { id: 'impressions', label: 'Impressions' },
                { id: 'engagement',  label: 'Engagements' },
                { id: 'er',          label: 'ER %' },
              ] as const).map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMetric(m.id)}
                  style={{
                    padding: '5px 10px',
                    fontSize: 12,
                    fontWeight: 550,
                    background: metric === m.id ? 'var(--v2-bg-2)' : 'transparent',
                    border: `1px solid ${metric === m.id ? 'var(--v2-line-2)' : 'transparent'}`,
                    borderRadius: 6,
                    color: metric === m.id ? 'var(--v2-ink)' : 'var(--v2-ink-3)',
                    cursor: 'pointer',
                  }}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>
          <BigPerfChart points={perf.weeklySeries} metric={metric} perf={perf} />
        </div>

        <div className="v2-card v2-card-pad-lg">
          <h3 style={{
            fontFamily: 'var(--v2-font-display)',
            fontSize: 19, fontWeight: 500, margin: '0 0 16px', letterSpacing: '-0.02em',
          }}>
            Engagement breakdown
          </h3>
          <BreakdownBar
            label="Likes"
            value={perf.engagement - perf.saves - perf.shares}
            total={perf.engagement}
            color="var(--v2-accent)"
          />
          <BreakdownBar label="Saves" value={perf.saves} total={perf.engagement} color="var(--v2-moss)" />
          <BreakdownBar label="Shares" value={perf.shares} total={perf.engagement} color="var(--v2-gold)" />
          <BreakdownBar
            label="Profile visits"
            value={perf.profileVisits}
            total={perf.engagement}
            color="var(--v2-info)"
          />
          <hr style={{ border: 0, borderTop: '1px solid var(--v2-line)', margin: '12px 0' }} />
          <div className="v2-row" style={{ justifyContent: 'space-between', fontSize: 12.5, marginTop: 8 }}>
            <span className="v2-muted">Save rate</span>
            <span className="v2-tabular" style={{ fontWeight: 600 }}>
              {(perf.saves / Math.max(1, perf.impressions) * 100).toFixed(2)}%
            </span>
          </div>
          <div className="v2-row" style={{ justifyContent: 'space-between', fontSize: 12.5, marginTop: 6 }}>
            <span className="v2-muted">Share rate</span>
            <span className="v2-tabular" style={{ fontWeight: 600 }}>
              {(perf.shares / Math.max(1, perf.impressions) * 100).toFixed(2)}%
            </span>
          </div>
        </div>
      </div>

      {/* Top performers leaderboard. */}
      <div className="v2-card v2-card-pad-lg" style={{ marginBottom: 20 }}>
        <div className="v2-row" style={{ justifyContent: 'space-between', marginBottom: 16 }}>
          <h3 style={{
            fontFamily: 'var(--v2-font-display)',
            fontSize: 19, fontWeight: 500, margin: 0, letterSpacing: '-0.02em',
          }}>
            Top performers
          </h3>
          <span className="v2-muted" style={{ fontSize: 12 }}>
            ranked by engagement contribution
          </span>
        </div>
        <TopPerformersTable
          collabs={collabs}
          creators={creators}
          totalEngagement={perf.engagement}
          totalImpressions={perf.impressions}
        />
      </div>

      {/* Audience + content mix. */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div className="v2-card v2-card-pad-lg">
          <h3 style={{
            fontFamily: 'var(--v2-font-display)',
            fontSize: 19, fontWeight: 500, margin: '0 0 16px', letterSpacing: '-0.02em',
          }}>
            Audience reached
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            <div>
              <div className="v2-eyebrow" style={{ marginBottom: 8 }}>By city</div>
              <BreakdownBar label="New York"      value={42} total={100} color="var(--v2-ink)"   pct />
              <BreakdownBar label="Los Angeles"   value={31} total={100} color="var(--v2-ink-2)" pct />
              <BreakdownBar label="London"        value={14} total={100} color="var(--v2-ink-3)" pct />
              <BreakdownBar label="Toronto"       value={7}  total={100} color="var(--v2-ink-4)" pct />
              <BreakdownBar label="Other"         value={6}  total={100} color="var(--v2-line-2)" pct />
            </div>
            <div>
              <div className="v2-eyebrow" style={{ marginBottom: 8 }}>By age</div>
              <BreakdownBar label="18–24" value={28} total={100} color="var(--v2-accent)" pct />
              <BreakdownBar label="25–34" value={46} total={100} color="var(--v2-accent)" pct />
              <BreakdownBar label="35–44" value={19} total={100} color="var(--v2-accent)" pct />
              <BreakdownBar label="45+"   value={7}  total={100} color="var(--v2-accent)" pct />
              <hr style={{ border: 0, borderTop: '1px solid var(--v2-line)', margin: '12px 0' }} />
              <div className="v2-row" style={{ justifyContent: 'space-between', fontSize: 12, marginTop: 6 }}>
                <span className="v2-muted">Female</span>
                <span className="v2-tabular" style={{ fontWeight: 600 }}>78%</span>
              </div>
            </div>
          </div>
        </div>

        <div className="v2-card v2-card-pad-lg">
          <h3 style={{
            fontFamily: 'var(--v2-font-display)',
            fontSize: 19, fontWeight: 500, margin: '0 0 16px', letterSpacing: '-0.02em',
          }}>
            Content mix
          </h3>
          <div className="v2-row" style={{ gap: 12, marginBottom: 16 }}>
            <ContentTypeTile
              icon="▶"
              label="Reels"
              count={collabs.reduce((s, x) => s + x.deliverables.filter((d) => /reel/i.test(d.label)).length, 0)}
              avgEr="12.8%"
            />
            <ContentTypeTile
              icon="◯"
              label="Stories"
              count={collabs.reduce((s, x) => s + x.deliverables.filter((d) => /stor/i.test(d.label)).length, 0)}
              avgEr="6.2%"
            />
            <ContentTypeTile
              icon="▦"
              label="Posts"
              count={collabs.reduce((s, x) => s + x.deliverables.filter((d) => /post/i.test(d.label)).length, 0)}
              avgEr="9.1%"
            />
          </div>
          <div className="v2-eyebrow" style={{ marginBottom: 8 }}>Best-performing format</div>
          <div
            style={{
              padding: 12,
              background: 'var(--v2-bg)',
              borderRadius: 'var(--v2-r-md)',
              borderLeft: '3px solid var(--v2-moss)',
            }}
          >
            <div style={{ fontSize: 13.5, fontWeight: 600 }}>Reels with daily-life framing</div>
            <div className="v2-muted" style={{ fontSize: 12, marginTop: 2, lineHeight: 1.5 }}>
              2.8× higher save rate than studio-styled posts. Spark recommends shifting
              next campaign's mix toward Reels.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── KPI tile with sparkline + delta
export function KpiTile({
  label, value, delta, deltaPositive, spark, accent,
}: {
  label: string;
  value: string;
  delta: string;
  deltaPositive: boolean;
  spark?: number[];
  accent?: boolean;
}) {
  return (
    <div
      className="v2-card v2-card-pad"
      style={accent ? {
        background: 'var(--v2-accent-soft)',
        borderColor: 'var(--v2-accent-soft)',
      } : undefined}
    >
      <div className="v2-stat-label">{label}</div>
      <div className="v2-row" style={{ justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 4 }}>
        <div className="v2-stat-value v2-tabular">{value}</div>
        {spark && <Sparkline points={spark} />}
      </div>
      <div className="v2-row" style={{ gap: 6, marginTop: 6 }}>
        <span style={{
          fontSize: 11,
          fontWeight: 600,
          color: deltaPositive ? 'var(--v2-moss)' : 'var(--v2-gold)',
        }}>
          {deltaPositive ? '▲' : '▼'} {delta}
        </span>
      </div>
    </div>
  );
}

function Sparkline({ points }: { points: number[] }) {
  if (points.length < 2) return null;
  const max = Math.max(...points);
  const min = Math.min(...points);
  const w = 64;
  const h = 22;
  const path = points.map((v, i) => {
    const x = (i / (points.length - 1)) * w;
    const y = h - ((v - min) / Math.max(1, max - min)) * h;
    return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
  }).join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: w, height: h, opacity: 0.7 }} aria-hidden="true">
      <path d={path} fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

// ── Big perf chart — area under line, axis grid, 3 metric modes
export function BigPerfChart({
  points, metric, perf,
}: {
  points: number[];
  metric: 'impressions' | 'engagement' | 'er';
  perf: V2CampaignPerf;
}) {
  const scaled = metric === 'impressions'
    ? points.map((v) => v * (perf.impressions / Math.max(1, points.reduce((a, b) => a + b, 0))))
    : metric === 'er'
      ? points.map((v) => 6 + v * 0.2)
      : points;

  const max = Math.max(...scaled, 1);
  const w = 600;
  const h = 200;
  const pad = 28;
  const path = scaled.map((v, i) => {
    const x = pad + (i / (scaled.length - 1)) * (w - pad * 2);
    const y = h - pad - (v / max) * (h - pad * 2);
    return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
  }).join(' ');
  const area = `${path} L ${pad + (w - pad * 2)} ${h - pad} L ${pad} ${h - pad} Z`;

  const yLabels = [0, 0.25, 0.5, 0.75, 1].map((p) => ({
    y: h - pad - p * (h - pad * 2),
    label:
      metric === 'er' ? `${(p * max).toFixed(1)}%`
      : metric === 'impressions' ? fmtFollowers(Math.round(p * max))
      : Math.round(p * max).toLocaleString(),
  }));
  const xLabels = ['W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7'];

  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: 220 }} aria-hidden="true">
      <defs>
        <linearGradient id="v2-perf-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--v2-accent)" stopOpacity="0.25" />
          <stop offset="100%" stopColor="var(--v2-accent)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {yLabels.map((l, i) => (
        <g key={i}>
          <line
            x1={pad}
            y1={l.y}
            x2={w - pad}
            y2={l.y}
            stroke="var(--v2-line)"
            strokeWidth="1"
            strokeDasharray="2 4"
            opacity="0.5"
          />
          <text x={pad - 6} y={l.y + 3} fontSize="10" fill="var(--v2-ink-3)" textAnchor="end">
            {l.label}
          </text>
        </g>
      ))}
      <path d={area} fill="url(#v2-perf-grad)" />
      <path d={path} fill="none" stroke="var(--v2-accent)" strokeWidth="2" />
      {scaled.map((v, i) => {
        const x = pad + (i / (scaled.length - 1)) * (w - pad * 2);
        const y = h - pad - (v / max) * (h - pad * 2);
        return (
          <circle
            key={i}
            cx={x}
            cy={y}
            r="3"
            fill="var(--v2-paper)"
            stroke="var(--v2-accent)"
            strokeWidth="2"
          />
        );
      })}
      {xLabels.map((l, i) => {
        const x = pad + (i / (xLabels.length - 1)) * (w - pad * 2);
        return (
          <text
            key={i}
            x={x}
            y={h - 8}
            fontSize="10"
            fill="var(--v2-ink-3)"
            textAnchor="middle"
          >
            {l}
          </text>
        );
      })}
    </svg>
  );
}

// ── Breakdown bar (used in engagement breakdown + audience by-city/age)
export function BreakdownBar({
  label, value, total, color, pct,
}: {
  label: string;
  value: number;
  total: number;
  color: string;
  pct?: boolean;
}) {
  const ratio = value / Math.max(1, total);
  return (
    <div style={{ marginBottom: 10 }}>
      <div className="v2-row" style={{ justifyContent: 'space-between', marginBottom: 4, fontSize: 12 }}>
        <span style={{ color: 'var(--v2-ink-2)' }}>{label}</span>
        <span className="v2-tabular" style={{ fontWeight: 600 }}>
          {pct ? `${value}%` : value.toLocaleString()}
        </span>
      </div>
      <div style={{ height: 5, background: 'var(--v2-bg-2)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ width: `${ratio * 100}%`, height: '100%', background: color }} />
      </div>
    </div>
  );
}

// ── Top performers leaderboard with medal-rank icons
export function TopPerformersTable({
  collabs, creators, totalEngagement, totalImpressions,
}: {
  collabs: V2Collab[];
  creators: V2Creator[];
  totalEngagement: number;
  totalImpressions: number;
}) {
  const rows = collabs
    .filter((x) => ['live', 'paid', 'approved'].includes(x.stage))
    .map((x) => {
      const cr = creators.find((c) => c.id === x.creatorId);
      if (!cr) return null;
      const seedNum = (cr.id.charCodeAt(0) + (cr.id.charCodeAt(1) || 0)) / 200;
      const share = 0.1 + seedNum;
      const imp = Math.round(totalImpressions * share / Math.max(1, collabs.length) * 1.5);
      const eng = Math.round(totalEngagement * share / Math.max(1, collabs.length) * 1.5);
      const er = (eng / Math.max(1, imp) * 100).toFixed(1);
      const cpe = Math.round(x.price / Math.max(1, eng));
      return { x, cr, imp, eng, er, cpe };
    })
    .filter((r): r is NonNullable<typeof r> => Boolean(r))
    .sort((a, b) => b.eng - a.eng);

  if (rows.length === 0) {
    return (
      <div className="v2-muted" style={{ textAlign: 'center', padding: 20, fontSize: 13 }}>
        No live posts yet.
      </div>
    );
  }

  return (
    <table className="v2-table" style={{ width: '100%' }}>
      <thead>
        <tr>
          <th style={{ width: 40 }} />
          <th>Creator</th>
          <th style={{ textAlign: 'right' }}>Impressions</th>
          <th style={{ textAlign: 'right' }}>Engagement</th>
          <th style={{ textAlign: 'right' }}>ER</th>
          <th style={{ textAlign: 'right' }}>CPE</th>
          <th style={{ textAlign: 'right' }}>Spend</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={r.x.id}>
            <td>
              <div
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: '50%',
                  background:
                    i === 0 ? 'var(--v2-gold)'
                    : i === 1 ? 'var(--v2-bg-2)'
                    : i === 2 ? 'color-mix(in oklab, var(--v2-gold) 30%, var(--v2-bg-2))'
                    : 'transparent',
                  border: i > 2 ? '1px solid var(--v2-line)' : 'none',
                  display: 'grid',
                  placeItems: 'center',
                  fontSize: 11,
                  fontWeight: 700,
                  color: i === 0 ? 'var(--v2-paper)' : 'var(--v2-ink-2)',
                }}
              >
                {i + 1}
              </div>
            </td>
            <td>
              <div className="v2-row" style={{ gap: 8 }}>
                <div
                  className="v2-avatar v2-avatar-xs"
                  style={{ backgroundImage: `url(${r.cr.avatar})` }}
                  aria-label={r.cr.name}
                />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 550 }}>{r.cr.name}</div>
                  <div className="v2-muted" style={{ fontSize: 11 }}>@{r.cr.handle}</div>
                </div>
              </div>
            </td>
            <td className="v2-tabular" style={{ textAlign: 'right' }}>{fmtFollowers(r.imp)}</td>
            <td className="v2-tabular" style={{ textAlign: 'right' }}>{fmtFollowers(r.eng)}</td>
            <td className="v2-tabular" style={{ textAlign: 'right' }}>
              <span style={{
                fontWeight: 600,
                color:
                  parseFloat(r.er) > 8 ? 'var(--v2-moss)'
                  : parseFloat(r.er) > 5 ? 'var(--v2-ink)'
                  : 'var(--v2-ink-3)',
              }}>
                {r.er}%
              </span>
            </td>
            <td className="v2-tabular" style={{ textAlign: 'right' }}>${r.cpe}</td>
            <td className="v2-tabular" style={{ textAlign: 'right' }}>{fmtUSD(r.x.price)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ── Content type tile — single Reels/Stories/Posts cell
export function ContentTypeTile({
  icon, label, count, avgEr,
}: {
  icon: string;
  label: string;
  count: number;
  avgEr: string;
}) {
  return (
    <div
      style={{
        flex: 1,
        padding: 12,
        border: '1px solid var(--v2-line)',
        borderRadius: 'var(--v2-r-md)',
      }}
    >
      <div className="v2-row" style={{ justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 14, color: 'var(--v2-ink-3)' }}>{icon}</span>
        <span className="v2-tabular" style={{ fontSize: 18, fontWeight: 600 }}>{count}</span>
      </div>
      <div style={{ fontSize: 12, fontWeight: 550, color: 'var(--v2-ink-2)' }}>{label}</div>
      <div className="v2-muted" style={{ fontSize: 11, marginTop: 2 }}>{avgEr} avg ER</div>
    </div>
  );
}

// =====================================================================
// Settings tab
// =====================================================================

function SettingsTab({ campaign }: { campaign: V2Campaign }) {
  // Local UI state for the form. Visibility + auto-shortlist are demo
  // controls (no backing field on the seed Campaign yet) but at minimum
  // the buttons need to actually toggle so the surface doesn't read inert.
  const [visibility, setVisibility] = useState<'public' | 'private'>('public');
  const [autoShortlist, setAutoShortlist] = useState(true);
  return (
    <div className="v2-row" style={{ gap: 24, alignItems: 'flex-start', flexWrap: 'wrap' }}>
      <section className="v2-card v2-card-pad-lg" style={{ flex: '2 1 480px' }}>
        <h3 style={{
          fontFamily: 'var(--v2-font-display)',
          fontSize: 20, fontWeight: 500, margin: '0 0 16px', letterSpacing: '-0.02em',
        }}>
          Campaign settings
        </h3>
        <div style={{ marginBottom: 18 }}>
          <label className="v2-eyebrow" style={{ display: 'block', marginBottom: 6 }}>Campaign name</label>
          <input className="v2-input" defaultValue={campaign.name} />
        </div>
        <div style={{ marginBottom: 18 }}>
          <label className="v2-eyebrow" style={{ display: 'block', marginBottom: 6 }}>Visibility</label>
          <div className="v2-segmented">
            <button
              className={`v2-segmented-btn ${visibility === 'public' ? 'is-on' : ''}`}
              type="button"
              onClick={() => {
                setVisibility('public');
                pushToast('Visibility set to public', 'good');
              }}
            >Public — listed in briefs</button>
            <button
              className={`v2-segmented-btn ${visibility === 'private' ? 'is-on' : ''}`}
              type="button"
              onClick={() => {
                setVisibility('private');
                pushToast('Visibility set to private — invite only', 'good');
              }}
            >Private — invite only</button>
          </div>
        </div>
        <div style={{ marginBottom: 18 }}>
          <label className="v2-eyebrow" style={{ display: 'block', marginBottom: 6 }}>Auto-shortlist</label>
          <label className="v2-row" style={{ gap: 10, padding: 12, background: 'var(--v2-bg-1)', borderRadius: 'var(--v2-r-md)', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={autoShortlist}
              onChange={(e) => setAutoShortlist(e.target.checked)}
            />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 550, fontSize: 14 }}>Let Spark auto-shortlist applicants</div>
              <div className="v2-muted" style={{ fontSize: 12 }}>Spark will move strong matches to "Pitched" automatically.</div>
            </div>
          </label>
        </div>
        <hr style={{ border: 0, borderTop: '1px solid var(--v2-line)', margin: '20px 0' }} />
        <h4 style={{
          fontFamily: 'var(--v2-font-display)',
          fontSize: 16, fontWeight: 500, margin: '0 0 12px', color: 'var(--v2-accent)',
        }}>Danger zone</h4>
        <button
          className="v2-btn v2-btn-outline"
          type="button"
          style={{ borderColor: 'var(--v2-accent)', color: 'var(--v2-accent)' }}
          onClick={() => {
            if (window.confirm('End campaign and refund unused escrow back to your wallet?')) {
              v2EndCampaign(campaign.id);
              pushToast('Campaign ended · unused escrow refunded', 'good');
            }
          }}
        >
          End campaign & refund unused funds
        </button>
      </section>

      <aside className="v2-card v2-card-pad" style={{ flex: '1 1 280px' }}>
        <div className="v2-eyebrow" style={{ marginBottom: 10 }}>Team access</div>
        <div className="v2-row" style={{ padding: '8px 0', borderBottom: '1px solid var(--v2-line)', gap: 10 }}>
          <div
            className="v2-avatar v2-avatar-sm"
            style={{ background: 'var(--v2-accent-soft)' }}
            aria-hidden="true"
          />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 550 }}>You</div>
            <div className="v2-muted" style={{ fontSize: 11 }}>Owner</div>
          </div>
        </div>
        <button
          className="v2-btn v2-btn-sm v2-btn-outline"
          type="button"
          style={{ width: '100%', marginTop: 10 }}
          onClick={() => pushToast('Team invites coming soon — for now, share the campaign link', 'default')}
        >
          {Icon.plus} Invite teammate
        </button>
      </aside>
    </div>
  );
}

// Re-export for completeness in case external tests need them
export type { V2Deliverable };

/**
 * P7 — capability-gated lifecycle controls in the page header. Pause /
 * Resume / End buttons stay visible (so ops/finance/viewer see the
 * actions exist) but are disabled with an "Admin/ops only" hint when
 * the actor lacks the relevant capability. Add Creators routes to
 * Discover and is open to anyone.
 *
 * Extracted to its own component because the gating uses 3 hooks
 * (`useCapability` × pause / end / send-offer-equivalent) which would
 * clutter the parent component's already-busy state.
 */
function CampaignLifecycleActions({
  stage,
  campaignId,
  onAddCreators,
}: {
  stage: string | undefined;
  campaignId: string;
  onAddCreators: () => void;
}) {
  const canPause = useCapability('campaign.pause');
  const canEnd = useCapability('campaign.end');
  return (
    <>
      {stage === 'live' ? (
        <button
          className="v2-btn v2-btn-outline"
          type="button"
          disabled={!canPause}
          title={!canPause ? 'Admin or ops only' : undefined}
          onClick={() => v2PauseCampaign(campaignId)}
        >
          {canPause ? 'Pause campaign' : 'Pause (admin/ops)'}
        </button>
      ) : stage === 'paused' ? (
        // BUG FIX: pre-fix this branch checked `stage === 'draft'` but
        // `v2PauseCampaign` sets stage to 'paused', so the Resume button
        // never showed up. Paused → Resume calls `v2ResumeCampaign`
        // which flips stage back to 'live'.
        <button
          className="v2-btn v2-btn-primary"
          type="button"
          disabled={!canPause}
          title={!canPause ? 'Admin or ops only' : undefined}
          onClick={() => v2ResumeCampaign(campaignId)}
        >
          {canPause ? 'Resume campaign' : 'Resume (admin/ops)'}
        </button>
      ) : stage === 'draft' ? (
        // Draft campaigns get a Publish CTA via `v2ResumeCampaign` —
        // same mutation, just different label since the campaign was
        // never live to begin with.
        <button
          className="v2-btn v2-btn-primary"
          type="button"
          disabled={!canPause}
          title={!canPause ? 'Admin or ops only' : undefined}
          onClick={() => v2ResumeCampaign(campaignId)}
        >
          {canPause ? 'Publish campaign' : 'Publish (admin/ops)'}
        </button>
      ) : null}
      {stage !== 'closed' && (
        <button
          className="v2-btn v2-btn-outline"
          type="button"
          disabled={!canEnd}
          title={!canEnd ? 'Admin or ops only' : undefined}
          onClick={() => {
            if (window.confirm('End campaign and refund unused escrow?')) v2EndCampaign(campaignId);
          }}
        >
          {canEnd ? 'End' : 'End (admin/ops)'}
        </button>
      )}
      <button className="v2-btn v2-btn-primary" type="button" onClick={onAddCreators}>
        {Icon.plus}<span>Add creators</span>
      </button>
    </>
  );
}
