// Triage selectors for the Today surface (Phase 4).
//
// "What changed since I last looked?" — the question every brand and
// creator opens the workspace asking. The Today page is built around
// answering that with five-to-six clearly named sections, each driven by
// one of these pure selectors.
//
// All functions are read-only; the Today screens dispatch real actions
// through the existing api client. We intentionally reuse Phase 3's
// `attentionFlags` / `funnelMetrics` machinery from `campaign-metrics.ts`
// so the brand triage stays consistent with the campaign list.

import { isStale, isOverdue, attentionFlags, REF_DATE } from './campaign-metrics';
import type {
  Application, Campaign, Creator, Database, Dispute, Offer, Submission, Transaction,
} from '@/lib/api/types';

// ============================================================
// Brand triage
// ============================================================

export interface BrandTriage {
  /** Submissions awaiting the brand's approve/revise decision. */
  awaitingDecision: { submission: Submission; campaign: Campaign }[];
  /** Counter offers from creators the brand needs to accept/decline/re-offer. */
  counterOffers: { offer: Offer; campaign: Campaign }[];
  /** New applications submitted, not yet shortlisted or rejected. */
  newApplications: { application: Application; campaign: Campaign }[];
  /** Campaigns sitting in their current stage longer than the SLA. */
  stuckCampaigns: { campaign: Campaign; daysInStage: number }[];
  /** Open disputes affecting the brand. */
  openDisputes: { dispute: Dispute; campaign: Campaign }[];
  /** Past-deadline campaigns (excluding closed/draft). */
  overdueCampaigns: Campaign[];
}

export function brandTriage(db: Database, brandId: string, ref: Date = REF_DATE): BrandTriage {
  const myCampaigns = db.campaigns.filter((c) => c.brandId === brandId);
  const myCampaignIds = new Set(myCampaigns.map((c) => c.id));

  const awaitingDecision = db.submissions
    .filter((s) => myCampaignIds.has(s.campaignId) && s.status === 'in_review')
    .sort((a, b) => +new Date(a.submittedAt) - +new Date(b.submittedAt))
    .map((submission) => ({ submission, campaign: myCampaigns.find((c) => c.id === submission.campaignId)! }))
    .filter((row) => !!row.campaign);

  const counterOffers = db.offers
    .filter((o) => myCampaignIds.has(o.campaignId) && o.status === 'countered')
    .sort((a, b) => +new Date(a.sentAt) - +new Date(b.sentAt))
    .map((offer) => ({ offer, campaign: myCampaigns.find((c) => c.id === offer.campaignId)! }))
    .filter((row) => !!row.campaign);

  const newApplications = db.applications
    .filter((a) => myCampaignIds.has(a.campaignId) && a.status === 'submitted')
    .sort((a, b) => +new Date(a.submittedAt) - +new Date(b.submittedAt))
    .map((application) => ({ application, campaign: myCampaigns.find((c) => c.id === application.campaignId)! }))
    .filter((row) => !!row.campaign);

  const stuckCampaigns = myCampaigns
    .filter((c) => isStale(c, ref))
    .map((c) => ({ campaign: c, daysInStage: attentionFlags(c, db, ref) ? 0 : 0 })) // daysInStage filled below
    .map(({ campaign }) => {
      const flags = attentionFlags(campaign, db, ref);
      return { campaign, daysInStage: 0, flags };
    })
    // We need daysInStage from campaign-metrics — recompute cheaply
    .map(({ campaign }) => {
      // Inline daysInCurrentStage — avoid extra import
      const matching = campaign.history
        .filter((h) => h.stage === campaign.stage)
        .sort((a, b) => +new Date(b.at) - +new Date(a.at));
      const entered = matching[0] ? new Date(matching[0].at) : new Date(campaign.createdAt);
      const days = Math.max(
        0,
        Math.round((ref.getTime() - entered.getTime()) / (24 * 60 * 60 * 1000)),
      );
      return { campaign, daysInStage: days };
    })
    .sort((a, b) => b.daysInStage - a.daysInStage);

  const openDisputes = db.disputes
    .filter((d) => (d.status === 'open' || d.status === 'in-review') && myCampaignIds.has(d.campaignId))
    .sort((a, b) => a.raisedAt - b.raisedAt)
    .map((dispute) => ({ dispute, campaign: myCampaigns.find((c) => c.id === dispute.campaignId)! }))
    .filter((row) => !!row.campaign);

  const overdueCampaigns = myCampaigns
    .filter((c) => isOverdue(c, ref))
    // Filter out ones already covered by stuck/dispute to avoid double-noise
    .filter((c) => !openDisputes.find((d) => d.campaign.id === c.id))
    .sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt));

  return {
    awaitingDecision,
    counterOffers,
    newApplications,
    stuckCampaigns,
    openDisputes,
    overdueCampaigns,
  };
}

export function brandTriageCount(t: BrandTriage): number {
  return (
    t.awaitingDecision.length
    + t.counterOffers.length
    + t.newApplications.length
    + t.stuckCampaigns.length
    + t.openDisputes.length
    + t.overdueCampaigns.length
  );
}

// ============================================================
// Creator triage
// ============================================================

export interface CreatorTriage {
  /** Pending or countered offers awaiting the creator's response. */
  activeOffers: { offer: Offer; campaign: Campaign }[];
  /** Accepted offers where the creator hasn't submitted a draft yet. */
  draftsToSubmit: { campaign: Campaign; offer: Offer; deadline: string }[];
  /** Submissions returned with `revisions` status. */
  revisionsRequested: { submission: Submission; campaign: Campaign }[];
  /** Live campaigns matching creator categories/region they haven't applied to. */
  matchingCampaigns: { campaign: Campaign; reason: string }[];
  /** Recently cleared payouts the creator may want to acknowledge. */
  recentPayouts: { tx: Transaction; campaign?: Campaign }[];
  /** Open disputes affecting the creator. */
  openDisputes: { dispute: Dispute; campaign: Campaign }[];
  /** Pending applications still awaiting brand response (passive but informative). */
  pendingApplications: { application: Application; campaign: Campaign }[];
}

const RECENT_PAYOUT_DAYS = 14;

export function creatorTriage(
  db: Database,
  creator: Creator,
  ref: Date = REF_DATE,
): CreatorTriage {
  const creatorId = creator.id;
  const userId = db.users.find((u) => u.creatorId === creatorId)?.id;

  // Active offers — pending OR countered
  const activeOffers = db.offers
    .filter((o) => o.creatorId === creatorId && (o.status === 'pending' || o.status === 'countered'))
    .sort((a, b) => +new Date(a.sentAt) - +new Date(b.sentAt))
    .map((offer) => ({ offer, campaign: db.campaigns.find((c) => c.id === offer.campaignId)! }))
    .filter((row) => !!row.campaign);

  // Drafts to submit — accepted offers with no submission yet, on production-or-prior stage
  const draftsToSubmit = db.offers
    .filter((o) => o.creatorId === creatorId && o.status === 'accepted')
    .map((offer) => {
      const campaign = db.campaigns.find((c) => c.id === offer.campaignId);
      if (!campaign) return null;
      // Skip if already submitted at least once (creator has work in flight)
      const hasSubmission = db.submissions.find(
        (s) => s.campaignId === campaign.id && s.creatorId === creatorId,
      );
      if (hasSubmission) return null;
      // Only when campaign is currently in production (or earlier; brand may have moved it back)
      if (!['production', 'offer'].includes(campaign.stage)) return null;
      return { campaign, offer, deadline: campaign.deadline };
    })
    .filter((row): row is { campaign: Campaign; offer: Offer; deadline: string } => row !== null);

  // Revisions — latest submission per campaign that's currently in `revisions`
  const revisionsRequested = (() => {
    const byCampaign: Record<string, Submission> = {};
    for (const s of db.submissions) {
      if (s.creatorId !== creatorId) continue;
      const prev = byCampaign[s.campaignId];
      if (!prev || +new Date(s.submittedAt) > +new Date(prev.submittedAt)) {
        byCampaign[s.campaignId] = s;
      }
    }
    return Object.values(byCampaign)
      .filter((s) => s.status === 'revisions')
      .sort((a, b) => +new Date(a.submittedAt) - +new Date(b.submittedAt))
      .map((submission) => ({ submission, campaign: db.campaigns.find((c) => c.id === submission.campaignId)! }))
      .filter((row) => !!row.campaign);
  })();

  // Matching campaigns — live campaigns in creator's categories or region, not yet applied to
  const myAppliedCampaignIds = new Set(
    db.applications.filter((a) => a.creatorId === creatorId).map((a) => a.campaignId),
  );
  const myCategories = new Set(creator.categories.map((c) => c.toLowerCase()));
  const matchingCampaigns: CreatorTriage['matchingCampaigns'] = [];
  for (const c of db.campaigns) {
    if (c.stage !== 'live') continue;
    if (myAppliedCampaignIds.has(c.id)) continue;
    const catMatch = myCategories.has(c.category.toLowerCase());
    const regionMatch = c.region === creator.country || c.region === creator.city;
    if (!catMatch && !regionMatch) continue;
    const reason = catMatch && regionMatch
      ? `Matches your category & region`
      : catMatch
        ? `Matches ${c.category}`
        : `In ${c.region}`;
    matchingCampaigns.push({ campaign: c, reason });
  }
  // Cap at 5 to keep the section glanceable
  matchingCampaigns.sort((a, b) => +new Date(b.campaign.createdAt) - +new Date(a.campaign.createdAt));
  const cappedMatching = matchingCampaigns.slice(0, 5);

  // Recent payouts — userId scoped, kind=payout|escrow_release within window
  const cutoff = new Date(ref.getTime() - RECENT_PAYOUT_DAYS * 24 * 60 * 60 * 1000);
  const recentPayouts = userId
    ? db.transactions
      .filter((t) => t.userId === userId && (t.kind === 'payout' || t.kind === 'escrow_release'))
      .filter((t) => new Date(t.at) >= cutoff)
      .sort((a, b) => +new Date(b.at) - +new Date(a.at))
      .map((tx) => ({ tx, campaign: tx.campaignId ? db.campaigns.find((c) => c.id === tx.campaignId) : undefined }))
    : [];

  // Open disputes affecting the creator. Pre-P2 the dispute had a
  // `(openedByUserId, againstUserId)` pair — post-P2 the counterparty
  // is derived from the Collaboration. The `raisedByUserId === userId`
  // captures their direct involvement; the `db.collaborations` join
  // catches the opposite side (where they're the counter-party).
  const openDisputes = db.disputes
    .filter((d) => {
      if (d.status !== 'open' && d.status !== 'in-review') return false;
      if (d.raisedByUserId === userId) return true;
      const collab = db.collaborations.find((c) => c.id === d.collaborationId);
      if (!collab) return false;
      const creatorUser = db.users.find((u) => u.creatorId === collab.creatorId);
      const brand = db.brands.find((b) => b.id === collab.brandId);
      return creatorUser?.id === userId || brand?.userId === userId;
    })
    .sort((a, b) => a.raisedAt - b.raisedAt)
    .map((dispute) => ({ dispute, campaign: db.campaigns.find((c) => c.id === dispute.campaignId)! }))
    .filter((row) => !!row.campaign);

  // Pending applications — passive but informative
  const pendingApplications = db.applications
    .filter((a) => a.creatorId === creatorId && a.status === 'submitted')
    .sort((a, b) => +new Date(a.submittedAt) - +new Date(b.submittedAt))
    .map((application) => ({ application, campaign: db.campaigns.find((c) => c.id === application.campaignId)! }))
    .filter((row) => !!row.campaign);

  return {
    activeOffers,
    draftsToSubmit,
    revisionsRequested,
    matchingCampaigns: cappedMatching,
    recentPayouts,
    openDisputes,
    pendingApplications,
  };
}

export function creatorTriageCount(t: CreatorTriage): number {
  // Only "actionable" sections count toward the badge — don't nag with passive lists.
  return (
    t.activeOffers.length
    + t.draftsToSubmit.length
    + t.revisionsRequested.length
    + t.openDisputes.length
  );
}
