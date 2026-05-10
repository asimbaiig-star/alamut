// Mock API client. Same shape we'd use against a real backend — async, returns
// promises, throws typed errors. Swap implementations later without touching screens.

import type {
  Advance, Application, Availability, Brand, Campaign, CampaignStage, Creator, Database,
  Dispute, DisputeCategory, DisputeStatus, Message, NotificationPrefs, Offer, Platform, Review,
  Submission, SubmissionStatus, TeamRole, Thread, Transaction, User,
} from './types';
import { tx, useStore } from './store';
import { isCreatorAccepted, getAcceptedCreators } from './relations';
// P1c §1.1 — Collaboration is a stored entity. Each mutation that flips
// app/offer/submission/payout state calls `ensureCollabState` once at the
// end of its tx block to keep Collaboration.stage + history in sync with
// the underlying records. See `lib/api/collabSync.ts`.
import { ensureCollabState } from './collabSync';
// P1d §1.5 — net-new campaigns materialize structured Deliverable rows
// from `deliverablesText` at create-time so submissions can attach via
// `Submission.deliverableId` immediately.
import { materializeDeliverablesForCampaign } from './deliverables';

const LATENCY = 280; // ms — feel of a real network call
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const id = (prefix: string) => `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
const nowISO = () => new Date().toISOString();

export class ApiError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

// Push a notification respecting the user's preferences. Pass the kind so we
// can check user.notificationPrefs[kind]. If unset, default to allow.
function pushNotification(d: Database, userId: string, kind: keyof NotificationPrefs, text: string, href?: string, meta?: import('./types').Notification['meta']) {
  const u = d.users.find((x) => x.id === userId);
  if (u?.notificationPrefs && u.notificationPrefs[kind] === false) return;
  d.notifications.push({
    id: id('n'), userId, text, href, meta,
    at: nowISO(), read: false,
  });
}

// ============ AUTH ============

interface SignUpInput {
  email: string;
  password: string;
  role: 'creator' | 'brand';
  name: string;
  // Brand-only
  brandName?: string;
  industry?: string;
  // Creator-only — basic, full onboarding happens in profile
  city?: string;
  country?: string;
}

async function signUp(input: SignUpInput) {
  await sleep(LATENCY);
  const email = input.email.trim().toLowerCase();
  if (!email || !input.password) throw new ApiError('invalid_input', 'Email and password are required.');
  if (input.password.length < 6) throw new ApiError('weak_password', 'Password must be at least 6 characters.');

  const db = useStore.getState().db;
  if (db.users.some((u) => u.email === email)) {
    throw new ApiError('email_taken', 'An account with that email already exists.');
  }

  const user = tx<User>((d) => {
    const userId = id('u');
    let creatorId: string | undefined;
    let brandId: string | undefined;
    if (input.role === 'creator') {
      creatorId = id('c');
      const newCreator: Creator = {
        id: creatorId, userId,
        name: input.name, handle: '@' + input.name.toLowerCase().replace(/\s+/g, ''),
        tagline: '', bio: '', city: input.city || '', country: input.country || '',
        languages: [], categories: [],
        portrait: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=600&h=750&fit=crop',
        work: [], platforms: [],
        reach: 0, engagement: 0, rating: 0, tier: 'Rising',
        responseHrs: 24,
        rateCard: { post: '—', reel: '—', story: '—', longform: '—' },
        payout: { method: '', account: '', currency: 'USD' },
        walletBalance: 0, pendingBalance: 0, lifetimeEarnings: 0,
        // P6 §5.6 — `profileCompletion` removed; computed on read via
        // `lib/utils/profile-completion.ts`.
        verified: false,
        pressMentions: [], pastClients: [],
      };
      d.creators.push(newCreator);
    } else {
      brandId = id('b');
      const newBrand: Brand = {
        id: brandId, userId,
        name: input.brandName || input.name, industry: input.industry || '',
        hq: '', website: '', about: '',
        preferredCategories: [], preferredRegions: [],
        walletBalance: 0, escrowHeld: 0,
        verified: false,
        savedCreators: [],
      };
      d.brands.push(newBrand);
    }
    const u: User = {
      id: userId, email, passwordHash: input.password, role: input.role,
      status: 'active', createdAt: nowISO(),
      creatorId, brandId,
    };
    d.users.push(u);
    return u;
  });

  // Auto sign-in on signup
  useStore.getState().setSession({ userId: user.id, issuedAt: nowISO() });
  return user;
}

async function signIn(email: string, password: string) {
  await sleep(LATENCY);
  const db = useStore.getState().db;
  const user = db.users.find((u) => u.email === email.trim().toLowerCase());
  if (!user) throw new ApiError('not_found', 'No account found with that email.');
  if (user.passwordHash !== password) throw new ApiError('bad_password', 'Wrong password. Try again or use a magic link.');
  if (user.status === 'suspended') throw new ApiError('suspended', 'This account is suspended. Contact support.');
  useStore.getState().setSession({ userId: user.id, issuedAt: nowISO() });
  return user;
}

async function requestMagicLink(email: string) {
  await sleep(LATENCY);
  const db = useStore.getState().db;
  const user = db.users.find((u) => u.email === email.trim().toLowerCase());
  if (!user) throw new ApiError('not_found', 'No account found with that email.');
  const token = id('mlnk');
  tx((d) => {
    const u = d.users.find((x) => x.id === user.id)!;
    u.pendingMagicLink = { token, issuedAt: nowISO() };
  });
  // In a real backend this would be emailed. We surface it in the UI.
  return { token, devHint: `Magic link issued for ${email}. Token: ${token}` };
}

async function verifyMagicLink(email: string, token: string) {
  await sleep(LATENCY);
  const db = useStore.getState().db;
  const user = db.users.find((u) => u.email === email.trim().toLowerCase());
  if (!user || !user.pendingMagicLink) throw new ApiError('invalid', 'Invalid or expired link.');
  if (user.pendingMagicLink.token !== token) throw new ApiError('invalid', 'Invalid token.');
  tx((d) => {
    const u = d.users.find((x) => x.id === user.id)!;
    u.pendingMagicLink = undefined;
  });
  useStore.getState().setSession({ userId: user.id, issuedAt: nowISO() });
  return user;
}

async function signOut() {
  await sleep(80);
  useStore.getState().setSession(null);
}

function currentUser(): User | null {
  const { db, session } = useStore.getState();
  if (!session) return null;
  return db.users.find((u) => u.id === session.userId) || null;
}

function profileForUser(user: User): { creator?: Creator; brand?: Brand } {
  const db = useStore.getState().db;
  return {
    creator: user.creatorId ? db.creators.find((c) => c.id === user.creatorId) : undefined,
    brand: user.brandId ? db.brands.find((b) => b.id === user.brandId) : undefined,
  };
}

// ============ CAMPAIGNS ============

async function createCampaign(input: Omit<Campaign, 'id' | 'history' | 'spent' | 'escrowHeld' | 'applications' | 'offers' | 'createdAt' | 'milestones' | 'deliverableIds'> & { milestones?: Campaign['milestones'] }) {
  await sleep(LATENCY);
  return tx<Campaign>((d) => {
    const cmpId = id('cmp');
    const cmp: Campaign = {
      ...input,
      id: cmpId,
      spent: 0, escrowHeld: 0,
      applications: [], offers: [],
      // P1d §1.5 — populated below from `deliverablesText` so the new
      // campaign ships with structured Deliverable rows (no migrator
      // pass needed for net-new data).
      deliverableIds: [],
      milestones: input.milestones || [
        { id: id('m'), stage: 'offer', amount: Math.round(input.budget * 0.5), description: '50% on offer accept' },
        { id: id('m'), stage: 'posted', amount: Math.round(input.budget * 0.5), description: '50% on post live' },
      ],
      createdAt: nowISO(),
      history: [{ stage: input.stage, at: nowISO(), by: useStore.getState().session?.userId || 'system' }],
    };
    d.campaigns.push(cmp);

    // P1d §1.5 — materialize structured Deliverable rows from the text.
    cmp.deliverableIds = materializeDeliverablesForCampaign(cmpId, input.deliverablesText, d);

    return cmp;
  });
}

async function updateCampaign(id: string, patch: Partial<Campaign>) {
  await sleep(LATENCY);
  return tx<Campaign>((d) => {
    const i = d.campaigns.findIndex((c) => c.id === id);
    if (i < 0) throw new ApiError('not_found', 'Campaign not found.');
    d.campaigns[i] = { ...d.campaigns[i], ...patch };
    return d.campaigns[i];
  });
}

async function transitionCampaign(campaignId: string, to: CampaignStage) {
  await sleep(LATENCY);
  return tx<Campaign>((d) => {
    const c = d.campaigns.find((x) => x.id === campaignId);
    if (!c) throw new ApiError('not_found', 'Campaign not found.');
    c.stage = to;
    c.history = [...c.history, { stage: to, at: nowISO(), by: useStore.getState().session?.userId || 'system' }];
    // P1b §1.2: postedAt was triggered by the old 'posted' stage which no
    // longer exists. v2MarkContentLive in v2CampaignActions handles the
    // submission-level permalink + collab-level live state. The legacy
    // postedAt is best stamped at first content-live event.
    return c;
  });
}

// ============ APPLICATIONS ============

async function applyToCampaign(input: { campaignId: string; pitch: string; proposedRate?: number }) {
  await sleep(LATENCY);
  const me = currentUser();
  if (!me?.creatorId) throw new ApiError('unauthorized', 'Sign in as a creator to apply.');
  return tx<Application>((d) => {
    const cmp = d.campaigns.find((c) => c.id === input.campaignId);
    if (!cmp) throw new ApiError('not_found', 'Campaign not found.');
    // P1b §1.2: applications are open whenever the campaign is live
    // (the old 'shortlist' stage was a per-collab signal that's now in
    // Application.status / Collaboration.stage).
    if (cmp.stage !== 'live') throw new ApiError('closed', 'Applications are closed for this campaign.');
    if (d.applications.some((a) => a.campaignId === cmp.id && a.creatorId === me.creatorId && a.status === 'submitted')) {
      throw new ApiError('duplicate', 'You already applied to this campaign.');
    }
    const app: Application = {
      id: id('app'), campaignId: cmp.id, creatorId: me.creatorId!,
      pitch: input.pitch, proposedRate: input.proposedRate,
      status: 'submitted', submittedAt: nowISO(),
    };
    d.applications.push(app);
    cmp.applications = [...cmp.applications, app.id];
    // Notify the brand
    const brand = d.brands.find((b) => b.id === cmp.brandId);
    if (brand) pushNotification(d, brand.userId, 'applications', `New application on ${cmp.title}`, '/brand/campaigns', { applicationId: app.id, campaignId: cmp.id });

    // P1c §1.1 — sync Collaboration: 'submitted' app → 'pitched'.
    ensureCollabState(cmp.id, me.creatorId!, d, me.id, 'app-submitted');

    return app;
  });
}

async function decideApplication(appId: string, decision: 'shortlist' | 'reject') {
  await sleep(LATENCY);
  return tx<Application>((d) => {
    const app = d.applications.find((a) => a.id === appId);
    if (!app) throw new ApiError('not_found', 'Application not found.');
    app.status = decision === 'shortlist' ? 'shortlisted' : 'rejected';
    app.decidedAt = nowISO();
    // P1a: shortlist is no longer a stored field on Campaign — the
    // relation is derived from `Application.status === 'shortlisted'`,
    // which the line above already wrote.
    // Notify the creator
    const creator = d.creators.find((c) => c.id === app.creatorId);
    const cmp = d.campaigns.find((c) => c.id === app.campaignId);
    if (creator && cmp) {
      pushNotification(d, creator.userId, 'applications',
        `Your application for ${cmp.title} was ${decision === 'shortlist' ? 'shortlisted' : 'declined'}`,
        '/creator/campaigns');
    }

    // P1c §1.1 — shortlist keeps stage 'pitched'; reject can drive
    // 'cancelled' if there's no live offer either way. Brand is actor.
    if (cmp) {
      const brand = d.brands.find((b) => b.id === cmp.brandId);
      ensureCollabState(cmp.id, app.creatorId, d, brand?.userId ?? '', `app-${decision}`);
    }

    return app;
  });
}

// ============ OFFERS ============

async function sendOffer(
  input: {
    campaignId: string; creatorId: string; rate: number; message: string;
    /** P1b §1.7 — link to the application this offer responds to (if any). */
    applicationId?: string | null;
    /** P1b §1.7 — provenance. Defaults to 'application' when applicationId set,
     *  'cold-outreach' otherwise. */
    source?: import('./types').OfferSource;
  },
) {
  await sleep(LATENCY);
  return tx<Offer>((d) => {
    const cmp = d.campaigns.find((c) => c.id === input.campaignId);
    if (!cmp) throw new ApiError('not_found', 'Campaign not found.');
    const sentAtIso = nowISO();
    const off: Offer = {
      id: id('off'), campaignId: input.campaignId, creatorId: input.creatorId,
      rate: input.rate, message: input.message,
      status: 'pending', sentAt: sentAtIso,
      applicationId: input.applicationId ?? null,
      source: input.source ?? (input.applicationId ? 'application' : 'cold-outreach'),
      // P3 §2.1 — initial brand round.
      rounds: [
        { by: 'brand', at: +new Date(sentAtIso), rate: input.rate, message: input.message },
      ],
    };
    d.offers.push(off);
    cmp.offers = [...cmp.offers, off.id];
    // P1b §1.2: campaign stage no longer auto-advances on offer-sent.
    // The campaign stays 'live' until brand explicitly closes/pauses.
    const creator = d.creators.find((c) => c.id === input.creatorId);
    const brand = d.brands.find((b) => b.id === cmp.brandId);
    if (creator) {
      pushNotification(d, creator.userId, 'offers',
        `New offer from ${brand?.name}: ${cmp.title} · $${input.rate.toLocaleString()}`,
        '/creator/campaigns',
        { offerId: off.id, campaignId: cmp.id });
    }
    // Auto-create a thread between brand and creator so both sides can message each other
    // about this offer immediately. The first message captures the offer details.
    if (brand && creator) {
      let thread = d.threads.find((t) =>
        t.campaignId === cmp.id &&
        t.participants.includes(brand.userId) &&
        t.participants.includes(creator.userId)
      );
      if (!thread) {
        thread = {
          id: id('t'),
          participants: [brand.userId, creator.userId],
          campaignId: cmp.id,
          subject: `${cmp.title} · offer`,
          lastMessageAt: nowISO(),
          unreadFor: [creator.userId],
          // P1b §1.9 — placeholder; P1c migrator promotes to real Collab id.
          collaborationId: null,
        };
        d.threads.push(thread);
        d.messages.push({
          id: id('msg'), threadId: thread.id, fromUserId: brand.userId,
          text: `Offer: $${input.rate.toLocaleString()}\n\n${input.message}`,
          at: nowISO(),
        });
      }
    }

    // P1c §1.1 — pending offer → 'negotiating' (or 'invited' for invite-flow
    // with no app yet — computeCollabStage handles both). Brand is actor.
    ensureCollabState(cmp.id, input.creatorId, d, brand?.userId ?? '', `offer-sent:${off.source}`);

    return off;
  });
}

async function counterOffer(offerId: string, counterRate: number, counterMessage: string) {
  await sleep(LATENCY);
  return tx<Offer>((d) => {
    const off = d.offers.find((o) => o.id === offerId);
    if (!off) throw new ApiError('not_found', 'Offer not found.');
    if (off.status !== 'pending' && off.status !== 'countered') {
      throw new ApiError('already_decided', 'This offer was already responded to.');
    }
    // P3 §2.1 — only the side opposite of the latest round may counter.
    const lastRound = off.rounds[off.rounds.length - 1];
    if (lastRound && lastRound.by === 'creator') {
      throw new ApiError('invalid_state', 'Awaiting creator response — brand cannot counter again.');
    }
    if (off.rounds.length >= 4) {
      // 4th counter — flip to expired.
      off.status = 'expired';
      off.respondedAt = nowISO();
      throw new ApiError('counter_cap', 'Counter cap reached — start a new offer instead.');
    }
    off.status = 'countered';
    off.respondedAt = nowISO();
    // Mirror to top-level rate/message (latest round's terms) and append.
    off.rate = counterRate;
    off.message = counterMessage;
    off.rounds = [...off.rounds, { by: 'creator', at: Date.now(), rate: counterRate, message: counterMessage }];
    const cmp = d.campaigns.find((c) => c.id === off.campaignId);
    const brand = cmp ? d.brands.find((b) => b.id === cmp.brandId) : undefined;
    const creator = d.creators.find((c) => c.id === off.creatorId);
    if (brand && cmp && creator) {
      pushNotification(d, brand.userId, 'offers',
        `${creator.name} countered your offer on ${cmp.title}: $${counterRate.toLocaleString()}`,
        '/brand/campaigns');
    }

    // P1c §1.1 — countered keeps stage 'negotiating'. Creator is actor.
    if (cmp) ensureCollabState(cmp.id, off.creatorId, d, creator?.userId ?? '', 'offer-countered');

    return off;
  });
}

async function acceptCounter(offerId: string) {
  await sleep(LATENCY);
  // Brand accepts the counter — update offer to accepted at the latest
  // round's rate, hold escrow.
  return tx<Offer>((d) => {
    const off = d.offers.find((o) => o.id === offerId);
    if (!off) throw new ApiError('not_found', 'Offer not found.');
    if (off.status !== 'countered') throw new ApiError('invalid_state', 'Not in counter state.');
    // P3 §2.1 — accept the latest round (the side opposite of the
    // accepter sent it; in legacy client that was always the creator).
    const lastRound = off.rounds[off.rounds.length - 1];
    if (!lastRound) throw new ApiError('invalid_state', 'No counter round to accept.');
    off.status = 'accepted';
    off.rate = lastRound.rate;
    off.respondedAt = nowISO();
    const cmp = d.campaigns.find((c) => c.id === off.campaignId);
    if (!cmp) return off;
    // P1a: acceptedCreators is no longer stored — derived from offer status.
    // P1b §1.2: campaign stage no longer auto-advances on offer-accept.
    // The collab-level stage (P1c Collaboration entity) tracks per-pair progress.
    const brand = d.brands.find((b) => b.id === cmp.brandId);
    if (brand && brand.walletBalance >= off.rate) {
      brand.walletBalance -= off.rate;
      brand.escrowHeld += off.rate;
      cmp.escrowHeld += off.rate;
      d.transactions.push({
        id: id('tx'), at: nowISO(), userId: brand.userId,
        kind: 'escrow_hold', amount: -off.rate, status: 'cleared',
        campaignId: cmp.id, counterpartyUserId: d.creators.find((c) => c.id === off.creatorId)?.userId,
        note: `Escrow · ${cmp.title}`,
      });
      const creator = d.creators.find((c) => c.id === off.creatorId);
      if (creator) creator.pendingBalance += off.rate;
    }
    const creator = d.creators.find((c) => c.id === off.creatorId);
    if (creator) {
      pushNotification(d, creator.userId, 'offers',
        `Your counter-offer on ${cmp.title} was accepted — $${off.rate.toLocaleString()} held in escrow`,
        '/creator/campaigns');
    }

    // P1c §1.1 — accepted offer → 'confirmed'. Brand is actor (accepted
    // the counter). Helper also picks up agreedRate + acceptedOfferId.
    const brandForSync = d.brands.find((b) => b.id === cmp.brandId);
    ensureCollabState(cmp.id, off.creatorId, d, brandForSync?.userId ?? '', 'counter-accepted');

    return off;
  });
}

async function respondToOffer(offerId: string, decision: 'accept' | 'decline') {
  await sleep(LATENCY);
  return tx<Offer>((d) => {
    const off = d.offers.find((o) => o.id === offerId);
    if (!off) throw new ApiError('not_found', 'Offer not found.');
    if (off.status !== 'pending') throw new ApiError('already_decided', 'This offer was already responded to.');
    off.status = decision === 'accept' ? 'accepted' : 'declined';
    off.respondedAt = nowISO();
    const cmp = d.campaigns.find((c) => c.id === off.campaignId);
    if (!cmp) return off;
    if (decision === 'accept') {
      // P1a: acceptedCreators is no longer stored — derived from offer status.
      // P1b §1.2: campaign stage no longer auto-advances on offer-accept.
      // Hold escrow for the offer rate
      const brand = d.brands.find((b) => b.id === cmp.brandId);
      if (brand && brand.walletBalance >= off.rate) {
        brand.walletBalance -= off.rate;
        brand.escrowHeld += off.rate;
        cmp.escrowHeld += off.rate;
        d.transactions.push({
          id: id('tx'), at: nowISO(), userId: brand.userId,
          kind: 'escrow_hold', amount: -off.rate, status: 'cleared',
          campaignId: cmp.id, counterpartyUserId: d.creators.find((c) => c.id === off.creatorId)?.userId,
          note: `Escrow · ${cmp.title}`,
        });
        const creator = d.creators.find((c) => c.id === off.creatorId);
        if (creator) creator.pendingBalance += off.rate;
      }
    }

    // P1c §1.1 — accept → 'confirmed'; decline with no other live signals
    // → 'cancelled'. Creator is the actor (they responded).
    const creatorForSync = d.creators.find((c) => c.id === off.creatorId);
    ensureCollabState(cmp.id, off.creatorId, d, creatorForSync?.userId ?? '', `offer-${decision}d`);

    return off;
  });
}

// ============ SUBMISSIONS ============

async function submitDraft(input: { campaignId: string; round: number; files: { name: string; url: string }[]; notes: string }) {
  await sleep(LATENCY);
  const me = currentUser();
  if (!me?.creatorId) throw new ApiError('unauthorized', 'Creator only.');
  return tx<Submission>((d) => {
    const sub: Submission = {
      id: id('sub'), campaignId: input.campaignId, creatorId: me.creatorId!,
      round: input.round, status: 'in_review',
      files: input.files, notes: input.notes,
      submittedAt: nowISO(), feedback: [],
    };
    d.submissions.push(sub);
    const cmp = d.campaigns.find((c) => c.id === input.campaignId);
    if (cmp) {
      const brand = d.brands.find((b) => b.id === cmp.brandId);
      // Phase 29: deep-link to Today's queue (was /brand/approvals).
      if (brand) pushNotification(d, brand.userId, 'approvals', `New draft submitted for ${cmp.title}`, '/brand/today', { submissionId: sub.id, campaignId: cmp.id });
    }

    // P1c §1.1 — fresh in_review submission → 'submitted'. Creator is actor.
    ensureCollabState(input.campaignId, me.creatorId!, d, me.id, 'content-submitted');

    return sub;
  });
}

async function decideSubmission(subId: string, decision: SubmissionStatus, feedbackText?: string) {
  await sleep(LATENCY);
  return tx<Submission>((d) => {
    const sub = d.submissions.find((s) => s.id === subId);
    if (!sub) throw new ApiError('not_found', 'Submission not found.');
    sub.status = decision;
    if (feedbackText) {
      sub.feedback = [...sub.feedback, { from: useStore.getState().session?.userId || 'system', text: feedbackText, at: nowISO() }];
    }
    const cmp = d.campaigns.find((c) => c.id === sub.campaignId);
    if (cmp && decision === 'approved') {
      // Move to posted, release the second milestone.
      // Phase 20: walk offers in reverse so we use the LATEST accepted
      // offer's rate (post counter+re-offer cycles), not a stale early one.
      // Otherwise the on-approve payout could release an OLD rate.
      const offerForCreator = [...d.offers].reverse().find((o) => o.campaignId === cmp.id && o.creatorId === sub.creatorId && o.status === 'accepted');
      if (offerForCreator) {
        const releaseAmt = Math.round(offerForCreator.rate); // release full remaining for this creator
        const brand = d.brands.find((b) => b.id === cmp.brandId);
        if (brand) {
          brand.escrowHeld = Math.max(0, brand.escrowHeld - releaseAmt);
          cmp.escrowHeld = Math.max(0, cmp.escrowHeld - releaseAmt);
          cmp.spent += releaseAmt;
          d.transactions.push({
            id: id('tx'), at: nowISO(), userId: brand.userId,
            kind: 'escrow_release', amount: -releaseAmt, status: 'cleared',
            campaignId: cmp.id, counterpartyUserId: d.creators.find((c) => c.id === sub.creatorId)?.userId,
            note: `Payout · ${cmp.title}`,
          });
          const creator = d.creators.find((c) => c.id === sub.creatorId);
          if (creator) {
            creator.pendingBalance = Math.max(0, creator.pendingBalance - releaseAmt);
            creator.walletBalance += releaseAmt;
            creator.lifetimeEarnings += releaseAmt;
            // If creator has an active income advance, auto-repay from this payout.
            const netToWallet = applyAdvanceRepayment(d, creator.id, releaseAmt);
            d.transactions.push({
              id: id('tx'), at: nowISO(), userId: creator.userId,
              kind: 'payout', amount: releaseAmt, status: 'cleared',
              campaignId: cmp.id, counterpartyUserId: brand.userId,
              note: netToWallet < releaseAmt ? `Payout · ${cmp.title} (advance auto-repaid $${(releaseAmt - netToWallet).toLocaleString()})` : `Payout · ${cmp.title}`,
            });
            pushNotification(d, creator.userId, 'payouts',
              netToWallet < releaseAmt
                ? `Payout cleared: $${netToWallet.toLocaleString()} (after advance repayment) · ${cmp.title}`
                : `Payout cleared: $${releaseAmt.toLocaleString()} · ${cmp.title}`,
              '/creator/earnings');
          }
        }
      }
      // P1b §1.2: campaign stage no longer auto-advances on
      // submission-approval. The collab-level stage (P1c Collaboration)
      // tracks per-pair progress; campaign stage stays 'live' until
      // brand explicitly closes/pauses.
      if (!cmp.postedAt) cmp.postedAt = nowISO();
    }

    // P1c §1.1 — approval drives 'approved' (or 'paid' if escrow released
    // above). Revisions keep stage 'submitted'. Brand is actor.
    if (cmp) {
      const brandForSync = d.brands.find((b) => b.id === cmp.brandId);
      ensureCollabState(cmp.id, sub.creatorId, d, brandForSync?.userId ?? '', `submission-${decision}`);
    }

    return sub;
  });
}

// ============ MESSAGING ============

async function sendMessage(input: { threadId?: string; toUserId?: string; campaignId?: string; subject?: string; text: string; attachments?: { name: string; url: string }[] }) {
  await sleep(LATENCY);
  const me = currentUser();
  if (!me) throw new ApiError('unauthorized', 'Sign in.');
  return tx<{ thread: Thread; message: Message }>((d) => {
    let thread = input.threadId ? d.threads.find((t) => t.id === input.threadId) : undefined;
    if (!thread) {
      const participants = [me.id, input.toUserId!].filter(Boolean);
      const newThread: Thread = {
        id: id('t'), participants, campaignId: input.campaignId,
        subject: input.subject || 'Conversation',
        lastMessageAt: nowISO(), unreadFor: [input.toUserId!].filter(Boolean) as string[],
        // P1b §1.9 — placeholder; P1c migrator promotes to real Collab id.
        collaborationId: null,
      };
      d.threads.push(newThread);
      thread = newThread;
    } else {
      thread.lastMessageAt = nowISO();
      thread.unreadFor = thread.participants.filter((p) => p !== me.id);
    }
    // After this point thread is guaranteed defined.
    const t = thread;
    const msg: Message = {
      id: id('msg'), threadId: t.id, fromUserId: me.id,
      text: input.text, at: nowISO(),
      attachments: input.attachments && input.attachments.length ? input.attachments : undefined,
    };
    d.messages.push(msg);
    return { thread: t, message: msg };
  });
}

async function markThreadRead(threadId: string) {
  await sleep(40);
  const me = currentUser();
  if (!me) return;
  tx((d) => {
    const t = d.threads.find((x) => x.id === threadId);
    if (t) t.unreadFor = t.unreadFor.filter((u) => u !== me.id);
  });
}

// ============ WALLET ============

async function topUp(amount: number, source: string) {
  await sleep(LATENCY);
  const me = currentUser();
  if (!me?.brandId) throw new ApiError('unauthorized', 'Brand only.');
  return tx<Transaction>((d) => {
    const brand = d.brands.find((b) => b.id === me.brandId);
    if (!brand) throw new ApiError('not_found', 'Brand profile missing.');
    brand.walletBalance += amount;
    const tx_: Transaction = {
      id: id('tx'), at: nowISO(), userId: me.id,
      kind: 'topup', amount, status: 'cleared',
      note: `Top-up · ${source}`,
    };
    d.transactions.push(tx_);
    return tx_;
  });
}

async function withdraw(amount: number) {
  await sleep(LATENCY);
  const me = currentUser();
  if (!me?.creatorId) throw new ApiError('unauthorized', 'Creator only.');
  return tx<Transaction>((d) => {
    const c = d.creators.find((x) => x.id === me.creatorId);
    if (!c) throw new ApiError('not_found', 'Creator profile missing.');
    if (c.walletBalance < amount) throw new ApiError('insufficient', 'Not enough cleared balance.');
    c.walletBalance -= amount;
    const tx_: Transaction = {
      id: id('tx'), at: nowISO(), userId: me.id,
      kind: 'payout', amount: -amount, status: 'cleared',
      note: `Withdraw to ${c.payout.method || 'bank'}`,
    };
    d.transactions.push(tx_);
    return tx_;
  });
}

// Brand-side withdraw — pulls available balance back to a connected source.
async function withdrawBrand(amount: number, destination: string) {
  await sleep(LATENCY);
  const me = currentUser();
  if (!me?.brandId) throw new ApiError('unauthorized', 'Brand only.');
  if (amount <= 0) throw new ApiError('invalid', 'Enter a positive amount.');
  return tx<Transaction>((d) => {
    const b = d.brands.find((x) => x.id === me.brandId);
    if (!b) throw new ApiError('not_found', 'Brand profile missing.');
    if (b.walletBalance < amount) throw new ApiError('insufficient', 'Not enough available balance. (Escrow holds are separate.)');
    b.walletBalance -= amount;
    const tx_: Transaction = {
      id: id('tx'), at: nowISO(), userId: me.id,
      kind: 'payout', amount: -amount, status: 'cleared',
      note: `Withdraw to ${destination}`,
    };
    d.transactions.push(tx_);
    return tx_;
  });
}

// ============ REVIEWS ============

async function leaveReview(input: { campaignId: string; reviewType: 'creator' | 'brand'; targetId: string; rating: number; text: string }) {
  await sleep(LATENCY);
  const me = currentUser();
  if (!me) throw new ApiError('unauthorized', 'Sign in.');
  return tx<Review>((d) => {
    // Prevent duplicate reviews from same user on same campaign
    const dupe = d.reviews.find((r) => r.campaignId === input.campaignId && r.fromUserId === me.id);
    if (dupe) throw new ApiError('duplicate', 'You already reviewed this campaign.');
    const cmp = d.campaigns.find((c) => c.id === input.campaignId);
    if (!cmp) throw new ApiError('not_found', 'Campaign not found.');

    const review: Review = {
      id: id('rv'), campaignId: input.campaignId,
      fromUserId: me.id,
      reviewType: input.reviewType,
      targetId: input.targetId,
      rating: Math.max(1, Math.min(5, input.rating)),
      text: input.text.trim(),
      at: nowISO(),
    };
    d.reviews.push(review);

    // Update aggregate rating on creator if applicable
    if (input.reviewType === 'creator') {
      const allFor = d.reviews.filter((r) => r.reviewType === 'creator' && r.targetId === input.targetId);
      const c = d.creators.find((x) => x.id === input.targetId);
      if (c) c.rating = +(allFor.reduce((s, r) => s + r.rating, 0) / allFor.length).toFixed(2);
    }

    // Notify the reviewed party
    let toUserId: string | undefined;
    if (input.reviewType === 'creator') toUserId = d.creators.find((c) => c.id === input.targetId)?.userId;
    else                                 toUserId = d.brands.find((b) => b.id === input.targetId)?.userId;
    if (toUserId) {
      pushNotification(d, toUserId, 'reviews',
        `New review on ${cmp.title} · ${input.rating} stars`,
        input.reviewType === 'creator' ? '/creator/profile' : '/brand/profile');
    }
    return review;
  });
}

async function respondToReview(reviewId: string, text: string) {
  await sleep(LATENCY);
  const me = currentUser();
  if (!me) throw new ApiError('unauthorized', 'Sign in.');
  if (text.trim().length < 5) throw new ApiError('weak_response', 'Add a few words.');
  return tx<Review>((d) => {
    const r = d.reviews.find((x) => x.id === reviewId);
    if (!r) throw new ApiError('not_found', 'Review not found.');
    // Reviewed party = brand owner if reviewType='brand', creator's user if reviewType='creator'
    let allowed = false;
    if (r.reviewType === 'brand' && me.brandId) {
      const b = d.brands.find((x) => x.id === r.targetId);
      allowed = !!b && b.userId === me.id;
    } else if (r.reviewType === 'creator' && me.creatorId) {
      const c = d.creators.find((x) => x.id === r.targetId);
      allowed = !!c && c.userId === me.id;
    }
    if (!allowed) throw new ApiError('forbidden', 'Only the reviewed party can respond.');
    if (r.response) throw new ApiError('already_responded', 'You already responded.');
    r.response = { text: text.trim(), at: nowISO() };
    pushNotification(d, r.fromUserId, 'reviews', `${me.brandId ? d.brands.find((b) => b.id === me.brandId)?.name : d.creators.find((c) => c.id === me.creatorId)?.name} responded to your review`,
      r.reviewType === 'brand' ? '/brand/profile' : '/creator/profile');
    return r;
  });
}

// ============ SAVED CREATORS (brand-level shortlist) ============

async function toggleSavedCreator(creatorId: string) {
  await sleep(80);
  const me = currentUser();
  if (!me?.brandId) throw new ApiError('unauthorized', 'Brand only.');
  return tx<boolean>((d) => {
    const b = d.brands.find((x) => x.id === me.brandId);
    if (!b) throw new ApiError('not_found', 'Brand not found.');
    const existing = b.savedCreators.includes(creatorId);
    b.savedCreators = existing
      ? b.savedCreators.filter((x) => x !== creatorId)
      : [...b.savedCreators, creatorId];
    return !existing;
  });
}

// ============ PLATFORM CONNECTION (mock OAuth) ============

async function connectPlatform(input: {
  platformName: Platform['name']; handle: string;
  followers: number; engagement: number;
  audience?: Platform['audience'];
}) {
  await sleep(LATENCY * 3); // a bit longer to feel like an OAuth round-trip
  const me = currentUser();
  if (!me?.creatorId) throw new ApiError('unauthorized', 'Creator only.');
  return tx<Platform>((d) => {
    const c = d.creators.find((x) => x.id === me.creatorId);
    if (!c) throw new ApiError('not_found', 'Creator not found.');
    // Replace if exists, else append.
    // P6 §5.5 — `verified` defaults to `false` on connect. The
    // creator earns the badge by going through the dedicated OAuth
    // flow (`v2VerifyChannel`) which simulates a 1.5s round-trip
    // before flipping the flag. Connect just records the channel.
    const existing = c.platforms.find((p) => p.name === input.platformName);
    const newP: Platform = {
      name: input.platformName,
      handle: input.handle,
      followers: input.followers,
      engagement: input.engagement,
      verified: false,
      audience: input.audience,
    };
    if (existing) {
      Object.assign(existing, newP);
    } else {
      c.platforms = [...c.platforms, newP];
    }
    // Recompute aggregate reach + engagement
    c.reach = c.platforms.reduce((s, p) => s + p.followers, 0);
    c.engagement = +(c.platforms.reduce((s, p) => s + p.engagement, 0) / c.platforms.length).toFixed(1);
    return newP;
  });
}

// ============ SETTINGS / PROFILE ============

async function setNotificationPrefs(prefs: NotificationPrefs) {
  await sleep(80);
  const me = currentUser();
  if (!me) throw new ApiError('unauthorized', 'Sign in.');
  return tx<NotificationPrefs>((d) => {
    const u = d.users.find((x) => x.id === me.id);
    if (!u) throw new ApiError('not_found', 'User missing.');
    u.notificationPrefs = { ...prefs };
    return u.notificationPrefs;
  });
}

async function setAvailability(availability: Availability) {
  await sleep(80);
  const me = currentUser();
  if (!me?.creatorId) throw new ApiError('unauthorized', 'Creator only.');
  return tx<Availability>((d) => {
    const c = d.creators.find((x) => x.id === me.creatorId);
    if (!c) throw new ApiError('not_found', 'Creator not found.');
    c.availability = { ...availability };
    return c.availability;
  });
}

async function updatePortfolio(work: string[]) {
  await sleep(80);
  const me = currentUser();
  if (!me?.creatorId) throw new ApiError('unauthorized', 'Creator only.');
  return tx<string[]>((d) => {
    const c = d.creators.find((x) => x.id === me.creatorId);
    if (!c) throw new ApiError('not_found', 'Creator not found.');
    c.work = [...work];
    return c.work;
  });
}

// ============ TEAM ============

async function inviteTeamMember(input: { email: string; teamRole: TeamRole }) {
  await sleep(LATENCY);
  const me = currentUser();
  if (!me?.brandId) throw new ApiError('unauthorized', 'Brand only.');
  const email = input.email.trim().toLowerCase();
  if (!email.includes('@')) throw new ApiError('invalid_email', 'Enter a real email.');
  return tx<User>((d) => {
    if (d.users.some((u) => u.email === email)) {
      throw new ApiError('email_taken', 'A user with that email already exists.');
    }
    const newUser: User = {
      id: id('u'), email,
      passwordHash: 'demo1234',
      role: 'brand', status: 'active',
      createdAt: nowISO(),
      brandId: me.brandId,
      teamRole: input.teamRole,
      invitedAt: nowISO(),
    };
    d.users.push(newUser);
    pushNotification(d, newUser.id, 'team', `You've been invited to a team. Sign in with this email and password "demo1234".`, '/brand/today');
    return newUser;
  });
}

async function removeTeamMember(userId: string) {
  await sleep(LATENCY);
  const me = currentUser();
  if (!me?.brandId) throw new ApiError('unauthorized', 'Brand only.');
  if (userId === me.id) throw new ApiError('self', 'You cannot remove yourself.');
  return tx<void>((d) => {
    const u = d.users.find((x) => x.id === userId);
    if (!u || u.brandId !== me.brandId) throw new ApiError('not_found', 'Team member not found.');
    d.users = d.users.filter((x) => x.id !== userId);
  });
}

// ============ REFERRALS (creator network) ============

async function createReferral(input: { toCreatorId: string; recommendedBrandId?: string; noteToReferred: string }) {
  await sleep(LATENCY);
  const me = currentUser();
  if (!me?.creatorId) throw new ApiError('unauthorized', 'Creator only.');
  if (input.toCreatorId === me.creatorId) throw new ApiError('self_referral', "You can't refer yourself.");
  if (input.noteToReferred.trim().length < 10) throw new ApiError('weak_note', 'Add a few words about why you\'re recommending them.');
  return tx<import('./types').Referral>((d) => {
    if (d.referrals.some((r) => r.fromCreatorId === me.creatorId && r.toCreatorId === input.toCreatorId && r.recommendedBrandId === input.recommendedBrandId && r.status !== 'expired')) {
      throw new ApiError('duplicate', 'You already referred this creator for this brand.');
    }
    const ref: import('./types').Referral = {
      id: id('ref'),
      fromCreatorId: me.creatorId!,
      toCreatorId: input.toCreatorId,
      recommendedBrandId: input.recommendedBrandId,
      noteToReferred: input.noteToReferred.trim(),
      createdAt: nowISO(),
      status: 'invited',
    };
    d.referrals.push(ref);

    const referredCreator = d.creators.find((c) => c.id === input.toCreatorId);
    if (referredCreator) {
      const meCreator = d.creators.find((c) => c.id === me.creatorId);
      pushNotification(d, referredCreator.userId, 'team',
        `${meCreator?.name || 'A creator'} recommended you${input.recommendedBrandId ? ` to ${d.brands.find((b) => b.id === input.recommendedBrandId)?.name}` : ''}`,
        '/creator/profile');
    }
    return ref;
  });
}

// ============ AD BOOSTS (whitelisted ads) ============

async function startAdBoost(input: { campaignId: string; creatorId: string; durationDays: number; dailyBudget: number }) {
  await sleep(LATENCY);
  const me = currentUser();
  if (!me?.brandId) throw new ApiError('unauthorized', 'Brand only.');
  const totalBudget = input.durationDays * input.dailyBudget;
  return tx<{ campaignId: string; boostId: string }>((d) => {
    const cmp = d.campaigns.find((c) => c.id === input.campaignId);
    if (!cmp) throw new ApiError('not_found', 'Campaign not found.');
    if (cmp.brandId !== me.brandId) throw new ApiError('forbidden', 'Not your campaign.');
    if (!cmp.rights?.whitelistAds) throw new ApiError('not_allowed', 'This campaign was not granted whitelisted-ads rights.');
    if (!isCreatorAccepted(cmp.id, input.creatorId, d)) throw new ApiError('not_allowed', 'Creator not on this campaign.');
    const brand = d.brands.find((b) => b.id === me.brandId);
    if (!brand) throw new ApiError('not_found', 'Brand not found.');
    if (brand.walletBalance < totalBudget) throw new ApiError('insufficient', 'Top up wallet — not enough balance.');

    // Mock returns: 0.5–2× spend in extra revenue, 6–10x spend in clicks
    const addedClicks = Math.round(totalBudget * (6 + Math.random() * 4));
    const addedConversions = Math.round(addedClicks * (0.02 + Math.random() * 0.04));
    const addedRevenue = Math.round(totalBudget * (0.5 + Math.random() * 1.5));

    const boost = {
      id: id('boost'),
      creatorId: input.creatorId,
      startedAt: nowISO(),
      durationDays: input.durationDays,
      dailyBudget: input.dailyBudget,
      totalSpent: totalBudget,
      addedClicks, addedConversions, addedRevenue,
      status: 'running' as const,
    };
    cmp.boosts = [...(cmp.boosts || []), boost];

    // Bump tracking aggregate for this creator
    if (cmp.tracking) {
      const t = cmp.tracking.find((x) => x.creatorId === input.creatorId);
      if (t) {
        t.clicks += addedClicks;
        t.conversions += addedConversions;
        t.revenueAttributed += addedRevenue;
      }
    }

    // Move money — debit wallet
    brand.walletBalance -= totalBudget;
    d.transactions.push({
      id: id('tx'), at: nowISO(), userId: brand.userId,
      kind: 'ad_spend', amount: -totalBudget, status: 'cleared',
      campaignId: cmp.id, counterpartyUserId: d.creators.find((c) => c.id === input.creatorId)?.userId,
      note: `Whitelisted ad boost · ${cmp.title}`,
    });

    pushNotification(d, brand.userId, 'payouts', `Boost started · $${totalBudget.toLocaleString()} on ${cmp.title}`, '/brand/wallet');
    const creatorUserId = d.creators.find((c) => c.id === input.creatorId)?.userId;
    if (creatorUserId) {
      pushNotification(d, creatorUserId, 'team', `${brand.name} started a whitelisted ad boost on your post (${cmp.title})`, '/creator/campaigns');
    }
    return { campaignId: cmp.id, boostId: boost.id };
  });
}

// ============ INCOME ADVANCES ============
// Creator borrows up to 80% of pending escrow at a 3% platform fee.
// Auto-repays when those payouts clear.

const ADVANCE_LTV = 0.80;
const ADVANCE_FEE_PCT = 0.03;

async function requestAdvance(amount: number) {
  await sleep(LATENCY);
  const me = currentUser();
  if (!me?.creatorId) throw new ApiError('unauthorized', 'Creator only.');
  return tx<Advance>((d) => {
    const c = d.creators.find((x) => x.id === me.creatorId);
    if (!c) throw new ApiError('not_found', 'Creator profile missing.');

    const activeAdvance = d.advances.find((a) => a.creatorId === c.id && a.status === 'active');
    if (activeAdvance) throw new ApiError('existing_advance', 'You already have an active advance. It auto-repays from your next payout.');

    const maxAvailable = Math.floor(c.pendingBalance * ADVANCE_LTV);
    if (amount > maxAvailable) throw new ApiError('exceeds_ltv', `Maximum advance is $${maxAvailable.toLocaleString()} (80% of $${c.pendingBalance.toLocaleString()} pending).`);
    if (amount < 100) throw new ApiError('too_small', 'Minimum advance is $100.');

    const fee = Math.round(amount * ADVANCE_FEE_PCT);
    const advance: Advance = {
      id: id('adv'), creatorId: c.id, requestedAt: nowISO(),
      amount, feePct: ADVANCE_FEE_PCT, feeAmount: fee,
      collateralPending: c.pendingBalance,
      status: 'active', repaidAmount: 0,
    };
    d.advances.push(advance);

    // Disburse to wallet, debit fee
    c.walletBalance += amount - fee;

    d.transactions.push(
      { id: id('tx'), at: nowISO(), userId: me.id, kind: 'topup', amount: amount - fee, status: 'cleared', note: `Advance disbursement (advance ${advance.id})` },
      { id: id('tx'), at: nowISO(), userId: me.id, kind: 'fee', amount: -fee, status: 'cleared', note: `Advance fee · ${(ADVANCE_FEE_PCT * 100).toFixed(1)}%` },
    );

    pushNotification(d, me.id, 'payouts', `Advance disbursed · $${(amount - fee).toLocaleString()} cleared to wallet`, '/creator/earnings');
    return advance;
  });
}

// Hook — call on every payout to auto-repay any active advance.
function applyAdvanceRepayment(d: Database, creatorId: string, payoutAmount: number) {
  const active = d.advances.find((a) => a.creatorId === creatorId && a.status === 'active');
  if (!active) return payoutAmount;
  const c = d.creators.find((x) => x.id === creatorId);
  if (!c) return payoutAmount;

  const owedTotal = active.amount;
  const remaining = owedTotal - active.repaidAmount;
  const takeFromPayout = Math.min(remaining, payoutAmount);
  active.repaidAmount += takeFromPayout;
  // Net what reaches the wallet
  const net = payoutAmount - takeFromPayout;
  c.walletBalance -= takeFromPayout; // rollback the bit that went to wallet via the upstream payout call

  if (active.repaidAmount >= owedTotal) {
    active.status = 'repaid';
    active.repaidAt = nowISO();
    pushNotification(d, c.userId, 'payouts', `Advance repaid · $${owedTotal.toLocaleString()} cleared`, '/creator/earnings');
  }
  return net;
}

// ============ MANAGER SEATS ============
async function inviteManager(input: { email: string }) {
  await sleep(LATENCY);
  const me = currentUser();
  if (!me?.creatorId) throw new ApiError('unauthorized', 'Creator only.');
  const email = input.email.trim().toLowerCase();
  if (!email.includes('@')) throw new ApiError('invalid_email', 'Enter a real email.');

  return tx<User>((d) => {
    const existing = d.users.find((u) => u.email === email);
    if (existing) {
      // Add this creator to their managed list
      existing.managesCreatorIds = Array.from(new Set([...(existing.managesCreatorIds || []), me.creatorId!]));
      pushNotification(d, existing.id, 'team', `You've been added as manager for ${d.creators.find((c) => c.id === me.creatorId)?.name}`, '/creator/today');
      return existing;
    }
    const newU: User = {
      id: id('u'), email, passwordHash: 'demo1234',
      role: 'creator', status: 'active',
      createdAt: nowISO(),
      managesCreatorIds: [me.creatorId!],
      invitedAt: nowISO(),
    };
    d.users.push(newU);
    return newU;
  });
}

async function removeManager(managerUserId: string) {
  await sleep(LATENCY);
  const me = currentUser();
  if (!me?.creatorId) throw new ApiError('unauthorized', 'Creator only.');
  return tx<void>((d) => {
    const m = d.users.find((u) => u.id === managerUserId);
    if (!m) throw new ApiError('not_found', 'Manager not found.');
    m.managesCreatorIds = (m.managesCreatorIds || []).filter((cid) => cid !== me.creatorId);
    if (m.managesCreatorIds.length === 0 && !m.creatorId) {
      // Manager has no other creators and no own creator profile — remove the user
      d.users = d.users.filter((x) => x.id !== managerUserId);
    }
  });
}

// ============ DISPUTES ============

async function openDispute(input: { campaignId: string; category: DisputeCategory; description: string }) {
  await sleep(LATENCY);
  const me = currentUser();
  if (!me) throw new ApiError('unauthorized', 'Sign in.');
  return tx<Dispute>((d) => {
    const cmp = d.campaigns.find((c) => c.id === input.campaignId);
    if (!cmp) throw new ApiError('not_found', 'Campaign not found.');

    // P2 §1.4 — disputes anchor on the Collaboration. Resolve the
    // (campaignId, creator-side) pair from the actor's role.
    let creatorId: string | undefined;
    let counterpartyUserId: string | undefined;
    if (me.creatorId) {
      // Creator opening against brand — they're the creator side.
      creatorId = me.creatorId;
      counterpartyUserId = d.brands.find((b) => b.id === cmp.brandId)?.userId;
    } else if (me.brandId) {
      // Brand opening against the (first) accepted creator on the campaign.
      const cid = getAcceptedCreators(cmp.id, d)[0];
      creatorId = cid;
      if (cid) counterpartyUserId = d.creators.find((c) => c.id === cid)?.userId;
    }
    if (!counterpartyUserId || !creatorId) throw new ApiError('no_counterparty', 'No counterparty to dispute against.');

    const collab = d.collaborations.find((c) =>
      c.campaignId === cmp.id && c.creatorId === creatorId,
    );
    if (!collab) throw new ApiError('no_collab', 'No collaboration to dispute on this campaign.');

    const now = Date.now();
    const dispute: Dispute = {
      id: id('disp'),
      collaborationId: collab.id,
      campaignId: cmp.id,
      raisedByUserId: me.id,
      raisedByRole: me.creatorId ? 'creator' : 'brand',
      category: input.category,
      description: input.description,
      evidence: [],
      status: 'open',
      resolution: null,
      raisedAt: now,
      updatedAt: now,
      messages: [],
    };
    d.disputes.push(dispute);

    // P2 §1.4 — raising freezes the collab's escrow. v2ApproveContent
    // checks this flag and throws.
    collab.escrowFrozen = true;

    // Notify the other side + every admin
    pushNotification(d, counterpartyUserId, 'team',
      `Dispute opened on ${cmp.title}`,
      me.creatorId ? '/brand/campaigns' : '/creator/campaigns');
    d.users.filter((u) => u.role === 'admin').forEach((adm) => {
      pushNotification(d, adm.id, 'team', `New dispute filed: ${cmp.title}`, '/admin/queue?type=disputes');
    });
    return dispute;
  });
}

async function resolveDispute(disputeId: string, input: {
  status: Extract<DisputeStatus, 'resolved-refund' | 'resolved-release' | 'resolved-partial'>;
  note: string;
  releaseAmount?: number;  // brand→creator
  refundAmount?: number;   // brand→wallet
}) {
  await sleep(LATENCY);
  const me = currentUser();
  if (me?.role !== 'admin') throw new ApiError('forbidden', 'Admin only.');
  return tx<Dispute>((d) => {
    const disp = d.disputes.find((x) => x.id === disputeId);
    if (!disp) throw new ApiError('not_found', 'Dispute not found.');
    if (disp.status !== 'open' && disp.status !== 'in-review') throw new ApiError('already_resolved', 'Already resolved.');
    const cmp = d.campaigns.find((c) => c.id === disp.campaignId);
    if (!cmp) throw new ApiError('not_found', 'Campaign not found.');
    const brand = d.brands.find((b) => b.id === cmp.brandId);
    const collab = d.collaborations.find((c) => c.id === disp.collaborationId);

    const now = Date.now();
    disp.status = input.status;
    disp.resolution = {
      by: me.id,
      at: now,
      note: input.note,
      releaseAmount: input.releaseAmount,
      refundAmount: input.refundAmount,
    };
    disp.updatedAt = now;

    // Move money based on resolution
    if (brand && (input.releaseAmount || input.refundAmount)) {
      // Pull from campaign escrow first, then brand escrow account
      const totalMoved = (input.releaseAmount || 0) + (input.refundAmount || 0);
      const fromCampaign = Math.min(cmp.escrowHeld, totalMoved);
      cmp.escrowHeld -= fromCampaign;
      brand.escrowHeld = Math.max(0, brand.escrowHeld - fromCampaign);

      if (input.refundAmount && input.refundAmount > 0) {
        brand.walletBalance += input.refundAmount;
        d.transactions.push({
          id: id('tx'), at: nowISO(), userId: brand.userId,
          kind: 'refund', amount: input.refundAmount, status: 'cleared',
          campaignId: cmp.id, note: `Dispute refund · ${cmp.title}`,
        });
      }
      if (input.releaseAmount && input.releaseAmount > 0) {
        // The creator counterparty is the collab's creator.
        const creator = collab ? d.creators.find((c) => c.id === collab.creatorId) : null;
        if (creator) {
          creator.walletBalance += input.releaseAmount;
          creator.lifetimeEarnings += input.releaseAmount;
          creator.pendingBalance = Math.max(0, creator.pendingBalance - input.releaseAmount);
          cmp.spent += input.releaseAmount;
          d.transactions.push({
            id: id('tx'), at: nowISO(), userId: brand.userId,
            kind: 'escrow_release', amount: -input.releaseAmount, status: 'cleared',
            campaignId: cmp.id, counterpartyUserId: creator.userId,
            note: `Dispute release · ${cmp.title}`,
          });
          d.transactions.push({
            id: id('tx'), at: nowISO(), userId: creator.userId,
            kind: 'payout', amount: input.releaseAmount, status: 'cleared',
            campaignId: cmp.id, counterpartyUserId: brand.userId,
            note: `Dispute payout · ${cmp.title}`,
          });
        }
      }
    }

    // P2 §1.4 — resolution unfreezes escrow on the collab.
    if (collab) collab.escrowFrozen = false;

    // Notify both parties — raised-by side + the counter party (derived
    // from the collab's brand-creator pair).
    pushNotification(d, disp.raisedByUserId, 'team', `Dispute resolved on ${cmp.title}`,
      d.users.find((u) => u.id === disp.raisedByUserId)?.creatorId ? '/creator/campaigns' : '/brand/campaigns');
    if (collab) {
      const creatorUser = d.users.find((u) => u.creatorId === collab.creatorId);
      const brandUser = brand ? d.users.find((u) => u.id === brand.userId) : null;
      const counter = disp.raisedByRole === 'brand' ? creatorUser : brandUser;
      if (counter && counter.id !== disp.raisedByUserId) {
        pushNotification(d, counter.id, 'team', `Dispute resolved on ${cmp.title}`,
          counter.creatorId ? '/creator/campaigns' : '/brand/campaigns');
      }
    }

    return disp;
  });
}

// ============ ADMIN ============

async function decideCreatorApplication(userId: string, decision: 'approve' | 'reject', reason?: string) {
  await sleep(LATENCY);
  const me = currentUser();
  if (me?.role !== 'admin') throw new ApiError('forbidden', 'Admin only.');
  if (decision === 'reject' && (!reason || reason.trim().length < 10)) {
    throw new ApiError('validation', 'A rejection reason of at least 10 characters is required.');
  }
  return tx<User>((d) => {
    const u = d.users.find((x) => x.id === userId);
    if (!u) throw new ApiError('not_found', 'User not found.');
    u.status = decision === 'approve' ? 'active' : 'suspended';
    if (decision === 'approve' && u.creatorId) {
      const c = d.creators.find((x) => x.id === u.creatorId);
      if (c) c.verified = true;
      pushNotification(d, u.id, 'applications', 'Your application has been approved — welcome to Alamut.', '/creator/today');
    } else if (decision === 'reject') {
      // Phase 21: include the rejection reason in the notification so the
      // creator knows why and what to fix before reapplying.
      pushNotification(d, u.id, 'applications', `Your application was not approved at this time. Reason: ${reason}`);
    }
    return u;
  });
}

async function setBrandVerified(brandId: string, verified: boolean) {
  await sleep(LATENCY);
  const me = currentUser();
  if (me?.role !== 'admin') throw new ApiError('forbidden', 'Admin only.');
  return tx<Brand>((d) => {
    const b = d.brands.find((x) => x.id === brandId);
    if (!b) throw new ApiError('not_found', 'Brand not found.');
    b.verified = verified;
    pushNotification(d, b.userId, 'marketing',
      verified ? 'Your brand has been verified by Alamut.' : 'Your verified status has been removed.',
      '/brand/profile');
    return b;
  });
}

// ============ NOTIFICATIONS ============

async function markAllNotificationsRead() {
  await sleep(40);
  const me = currentUser();
  if (!me) return;
  tx((d) => {
    d.notifications.forEach((n) => { if (n.userId === me.id) n.read = true; });
  });
}

// ============ EXPORT ============

export const api = {
  auth: { signUp, signIn, requestMagicLink, verifyMagicLink, signOut, currentUser, profileForUser },
  campaigns: { create: createCampaign, update: updateCampaign, transition: transitionCampaign },
  applications: { apply: applyToCampaign, decide: decideApplication },
  offers: { send: sendOffer, respond: respondToOffer, counter: counterOffer, acceptCounter },
  submissions: { submit: submitDraft, decide: decideSubmission },
  messages: { send: sendMessage, markRead: markThreadRead },
  wallet: { topUp, withdraw, withdrawBrand },
  notifications: { markAllRead: markAllNotificationsRead },
  reviews: { leave: leaveReview, respond: respondToReview },
  brand: { toggleSavedCreator, inviteTeamMember, removeTeamMember },
  platforms: { connect: connectPlatform },
  settings: { setNotificationPrefs, setAvailability, updatePortfolio },
  disputes: { open: openDispute, resolve: resolveDispute },
  ads: { startBoost: startAdBoost },
  referrals: { create: createReferral },
  advances: { request: requestAdvance },
  manager: { invite: inviteManager, remove: removeManager },
  admin: { decideCreatorApplication, setBrandVerified },
};

// Selector helpers (synchronous reads)
export const select = {
  user: (db: Database, userId: string) => db.users.find((u) => u.id === userId),
  creator: (db: Database, id: string) => db.creators.find((c) => c.id === id),
  brand: (db: Database, id: string) => db.brands.find((b) => b.id === id),
  campaignsByBrand: (db: Database, brandId: string) => db.campaigns.filter((c) => c.brandId === brandId),
  campaignsForCreator: (db: Database, creatorId: string) => {
    const apps = db.applications.filter((a) => a.creatorId === creatorId).map((a) => a.campaignId);
    const offers = db.offers.filter((o) => o.creatorId === creatorId).map((o) => o.campaignId);
    const directIds = new Set([...apps, ...offers]);
    // P1a: acceptedCreators is no longer stored. apps + offers walks above
    // already cover every campaign the creator is on (an accepted offer
    // requires a prior offer record on the campaign).
    return db.campaigns.filter((c) => directIds.has(c.id));
  },
  liveCampaigns: (db: Database) => db.campaigns.filter((c) => c.stage === 'live'),
  threadsForUser: (db: Database, userId: string) => db.threads
    .filter((t) => t.participants.includes(userId))
    .sort((a, b) => +new Date(b.lastMessageAt) - +new Date(a.lastMessageAt)),
  messagesInThread: (db: Database, threadId: string) => db.messages
    .filter((m) => m.threadId === threadId)
    .sort((a, b) => +new Date(a.at) - +new Date(b.at)),
  notificationsForUser: (db: Database, userId: string) => db.notifications
    .filter((n) => n.userId === userId)
    .sort((a, b) => +new Date(b.at) - +new Date(a.at)),
  transactionsForUser: (db: Database, userId: string) => db.transactions
    .filter((t) => t.userId === userId)
    .sort((a, b) => +new Date(b.at) - +new Date(a.at)),
  applicationsForCampaign: (db: Database, campaignId: string) => db.applications.filter((a) => a.campaignId === campaignId),
  applicationsByCreator: (db: Database, creatorId: string) => db.applications
    .filter((a) => a.creatorId === creatorId)
    .sort((a, b) => +new Date(b.submittedAt) - +new Date(a.submittedAt)),
  submissionsPendingForBrand: (db: Database, brandId: string) => {
    const cmps = new Set(db.campaigns.filter((c) => c.brandId === brandId).map((c) => c.id));
    return db.submissions.filter((s) => cmps.has(s.campaignId) && s.status === 'in_review');
  },
  // P4 §3.2 — admin-hidden reviews are filtered out of the public-facing
  // selectors. Tools that need the full list (e.g. admin moderation
  // queue) read `db.reviews` directly.
  reviewsForCreator: (db: Database, creatorId: string) => db.reviews
    .filter((r) => r.reviewType === 'creator' && r.targetId === creatorId && !r.hidden)
    .sort((a, b) => +new Date(b.at) - +new Date(a.at)),
  reviewsForBrand: (db: Database, brandId: string) => db.reviews
    .filter((r) => r.reviewType === 'brand' && r.targetId === brandId && !r.hidden)
    .sort((a, b) => +new Date(b.at) - +new Date(a.at)),
  teamForBrand: (db: Database, brandId: string) => db.users
    .filter((u) => u.role === 'brand' && u.brandId === brandId),
  disputeForCampaign: (db: Database, campaignId: string) => db.disputes.find((d) => d.campaignId === campaignId && d.status === 'open'),
  openDisputes: (db: Database) => db.disputes.filter((d) => d.status === 'open' || d.status === 'in-review').sort((a, b) => b.raisedAt - a.raisedAt),
  allDisputes: (db: Database) => [...db.disputes].sort((a, b) => b.raisedAt - a.raisedAt),
  referralsFromCreator: (db: Database, creatorId: string) => db.referrals
    .filter((r) => r.fromCreatorId === creatorId)
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)),
  referralsToCreator: (db: Database, creatorId: string) => db.referrals
    .filter((r) => r.toCreatorId === creatorId)
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)),
  // Pending reviews that the user owes (closed campaigns they haven't reviewed yet)
  pendingReviewsForUser: (db: Database, userId: string) => {
    const u = db.users.find((x) => x.id === userId);
    if (!u) return [];
    const closedRelevant = db.campaigns.filter((c) => {
      if (c.stage !== 'closed') return false;
      if (u.brandId) return c.brandId === u.brandId;
      if (u.creatorId) return isCreatorAccepted(c.id, u.creatorId, db);
      return false;
    });
    return closedRelevant.filter((c) => !db.reviews.some((r) => r.campaignId === c.id && r.fromUserId === userId));
  },
};
