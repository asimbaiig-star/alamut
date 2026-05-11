// v2CampaignActions.ts — campaign workflow mutations
//
// All the verbs the v2 surfaces need to make campaigns "actually work":
//   - applyToCampaign  · creator pitches a brief
//   - sendOffer        · brand offers terms to a pitched creator
//   - acceptOffer      · creator accepts the offer (or counters)
//   - submitContent    · creator uploads a draft for review
//   - approveContent   · brand approves and releases escrow
//   - requestRevision  · brand sends content back for changes
//   - launchCampaign   · brand publishes a campaign draft from the wizard
//
// All wrap `tx()` for atomic mutations on the live store, and create
// the side-effect records the workflow expects (Notifications,
// Transactions, Threads/Messages where appropriate).
//
// Helpers ensure derived counters stay accurate:
//   - Campaign.spent         · grows when payouts release
//   - Campaign.escrowHeld    · grows when offer accepted, shrinks on release
//   - Brand.walletBalance    · decreases when offer accepted
//   - Brand.escrowHeld       · grows on accept, shrinks on release
//   - Creator.walletBalance  · grows when funds released
//   - Creator.pendingBalance · grows on accept, shrinks on release

import { tx, useStore } from '@/lib/api/store';
import type {
  Application, Brand, Campaign, Offer, OfferRound, Submission, Transaction, User,
} from '@/lib/api/types';
import { getAcceptedCreators } from '@/lib/api/relations';
// P1c §1.1 — every mutation that touches an Application/Offer/Submission/payout
// pair calls `ensureCollabState` near the end of its `tx` block. The helper
// finds-or-creates the Collaboration row, recomputes stage from the underlying
// records, and appends a history entry if the stage changed. This is how we
// keep Collaboration.stage in lockstep with the apps/offers/subs source of
// truth without rewriting every mutation to dual-write.
import { ensureCollabState } from '@/lib/api/collabSync';
// P1d §1.5 — net-new campaigns materialize structured Deliverable rows
// from the wizard's free-form `placement` string at create-time, so
// submissions can attach via Submission.deliverableId without waiting
// for migrator 4 to fire on the next hydrate.
import { materializeDeliverablesForCampaign } from '@/lib/api/deliverables';
// P2 §1.3 — when an offer is accepted (or a counter is accepted), we
// create a Contract in the same `tx` that snapshots the brief +
// deliverables at that moment. The Contract is the legally-binding
// record; the Offer just carries the negotiation state.
import { createContractForAcceptedOffer, markContractFulfilled } from '@/lib/api/contracts';
// P3 §2.3 — cancel-collab path used by `v2EndCampaign` to auto-cancel
// in-flight collabs and unwind escrow per-collab. The mutual-consent
// flow lives in `v2CollabActions.ts`.
import { __cancelCollabInternal } from './v2CollabActions';
// P4 §3.1 — time-based notifications. Mutations that establish a
// future event (offer-accept → 24h-before-deliverable, content-approve
// → 48h-before-dispute-window-close) call these enqueue helpers; the
// scheduler heartbeat in `lib/api/scheduler.ts` emits them when the
// `triggerAt` timestamp passes.
import {
  enqueueDeadline24h, enqueueDeadlineOverdue, enqueueEscrowStale,
  enqueueReviewWindowClosing, enqueueKycExpired,
} from '@/lib/api/scheduler';
// P5 §4.1 — capability gate. Every brand-side mutation calls
// `requireCapability(actorUserId, 'capability.name', db)` as the first
// line of its `tx` block. If the actor lacks the capability the helper
// throws; if no actor is set (test/seed mode) the check is bypassed.
import { requireCapability, getActorUserId } from '@/lib/permissions';
// Phase 2 / 3 — Supabase write path for brand + campaign updates.
// Reads continue going through the local store (which is hydrated
// from Supabase at boot in lib/api/store.ts). Writes mirror locally
// first (instant UI), then fire-and-forget against Supabase. The
// helper below centralises the mirror so each action stays terse.
import { isSupabaseConfigured } from '@/lib/supabase';

// Common pattern: every mirror swallows "row not found" silently
// (those are rows that still live only in the local store — e.g.
// generated cmp_g* campaigns whose brand never migrated to Postgres).
// Anything else logs so it's diagnosable without breaking the UI.
function isNotFoundError(msg: string): boolean {
  return /no rows|0 rows|not found|JSON object requested/i.test(msg);
}

/** Fire-and-forget Supabase mirror for a campaign UPDATE. Local
 *  state has already been updated; this hands off the same change
 *  to Postgres. Failures are logged but never propagate. */
function mirrorCampaignToSupabase(
  campaignId: string,
  patch: Parameters<typeof import('@/lib/data/campaignsRepo').updateCampaignInSupabase>[1],
): void {
  if (!isSupabaseConfigured()) return;
  void (async () => {
    try {
      const { updateCampaignInSupabase } = await import('@/lib/data/campaignsRepo');
      await updateCampaignInSupabase(campaignId, patch);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (isNotFoundError(msg)) return;
      // eslint-disable-next-line no-console
      console.warn('[campaign mirror] failed:', msg);
    }
  })();
}

/** Fire-and-forget Supabase mirror for a new Offer INSERT. */
function mirrorOfferInsertToSupabase(offer: Offer): void {
  if (!isSupabaseConfigured()) return;
  void (async () => {
    try {
      const { insertOfferInSupabase } = await import('@/lib/data/offersRepo');
      await insertOfferInSupabase(offer);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // For new offers referencing campaigns that aren't in Supabase
      // (e.g. cmp_g* generated campaigns), the FK fires — silence.
      if (isNotFoundError(msg) || /foreign key|violates/i.test(msg)) return;
      // eslint-disable-next-line no-console
      console.warn('[offer insert mirror] failed:', msg);
    }
  })();
}

/** Fire-and-forget Supabase mirror for an Offer UPDATE. */
function mirrorOfferUpdateToSupabase(
  offerId: string,
  patch: Parameters<typeof import('@/lib/data/offersRepo').updateOfferInSupabase>[1],
): void {
  if (!isSupabaseConfigured()) return;
  void (async () => {
    try {
      const { updateOfferInSupabase } = await import('@/lib/data/offersRepo');
      await updateOfferInSupabase(offerId, patch);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (isNotFoundError(msg)) return;
      // eslint-disable-next-line no-console
      console.warn('[offer update mirror] failed:', msg);
    }
  })();
}

/** Fire-and-forget Supabase mirror for a new Application INSERT. */
function mirrorApplicationInsertToSupabase(application: Application): void {
  if (!isSupabaseConfigured()) return;
  void (async () => {
    try {
      const { insertApplicationInSupabase } = await import('@/lib/data/applicationsRepo');
      await insertApplicationInSupabase(application);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (isNotFoundError(msg) || /foreign key|violates/i.test(msg)) return;
      // eslint-disable-next-line no-console
      console.warn('[application insert mirror] failed:', msg);
    }
  })();
}

/** Fire-and-forget Supabase mirror for an Application UPDATE. */
function mirrorApplicationUpdateToSupabase(
  applicationId: string,
  patch: Parameters<typeof import('@/lib/data/applicationsRepo').updateApplicationInSupabase>[1],
): void {
  if (!isSupabaseConfigured()) return;
  void (async () => {
    try {
      const { updateApplicationInSupabase } = await import('@/lib/data/applicationsRepo');
      await updateApplicationInSupabase(applicationId, patch);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (isNotFoundError(msg)) return;
      // eslint-disable-next-line no-console
      console.warn('[application update mirror] failed:', msg);
    }
  })();
}

/** Fire-and-forget Supabase mirror for a Submission INSERT (Phase 5d). */
function mirrorSubmissionInsertToSupabase(submission: Submission): void {
  if (!isSupabaseConfigured()) return;
  void (async () => {
    try {
      const { insertSubmissionInSupabase } = await import('@/lib/data/submissionsRepo');
      await insertSubmissionInSupabase(submission);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (isNotFoundError(msg) || /foreign key|violates|row-level security/i.test(msg)) return;
      // eslint-disable-next-line no-console
      console.warn('[submission insert mirror] failed:', msg);
    }
  })();
}

/** Fire-and-forget Supabase mirror for a Submission UPDATE (Phase 5d). */
function mirrorSubmissionUpdateToSupabase(
  submissionId: string,
  patch: Parameters<typeof import('@/lib/data/submissionsRepo').updateSubmissionInSupabase>[1],
): void {
  if (!isSupabaseConfigured()) return;
  void (async () => {
    try {
      const { updateSubmissionInSupabase } = await import('@/lib/data/submissionsRepo');
      await updateSubmissionInSupabase(submissionId, patch);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (isNotFoundError(msg) || /row-level security/i.test(msg)) return;
      // eslint-disable-next-line no-console
      console.warn('[submission update mirror] failed:', msg);
    }
  })();
}

/** Fire-and-forget Supabase mirror for a new Review INSERT (Phase 8 lite). */
function mirrorReviewInsertToSupabase(review: import('@/lib/api/types').Review): void {
  if (!isSupabaseConfigured()) return;
  void (async () => {
    try {
      const { insertReviewInSupabase } = await import('@/lib/data/reviewsRepo');
      await insertReviewInSupabase(review);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // Reviews on generated cmp_g* campaigns hit the FK — silence.
      if (isNotFoundError(msg) || /foreign key|violates|row-level security/i.test(msg)) return;
      // eslint-disable-next-line no-console
      console.warn('[review insert mirror] failed:', msg);
    }
  })();
}

/** Fire-and-forget Supabase mirror for a new Thread INSERT (Phase 10). */
function mirrorThreadInsertToSupabase(thread: import('@/lib/api/types').Thread): void {
  if (!isSupabaseConfigured()) return;
  void (async () => {
    try {
      const { insertThreadInSupabase } = await import('@/lib/data/threadsRepo');
      await insertThreadInSupabase(thread);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (isNotFoundError(msg) || /foreign key|violates|row-level security|duplicate key/i.test(msg)) return;
      // eslint-disable-next-line no-console
      console.warn('[thread insert mirror] failed:', msg);
    }
  })();
}

/** Fire-and-forget Supabase mirror for a new Message INSERT (Phase 10). */
function mirrorMessageInsertToSupabase(message: import('@/lib/api/types').Message): void {
  if (!isSupabaseConfigured()) return;
  void (async () => {
    try {
      const { insertMessageInSupabase } = await import('@/lib/data/messagesRepo');
      await insertMessageInSupabase(message);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (isNotFoundError(msg) || /foreign key|violates|row-level security|duplicate key/i.test(msg)) return;
      // eslint-disable-next-line no-console
      console.warn('[message insert mirror] failed:', msg);
    }
  })();
}

const PLATFORM_FEE = 0.10;
const WHT = 0.05;

function newId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

function findUserByCreator(db: ReturnType<typeof useStore.getState>['db'], creatorId: string): User | undefined {
  const c = db.creators.find((x) => x.id === creatorId);
  return c ? db.users.find((u) => u.id === c.userId) : undefined;
}

function findUserByBrand(db: ReturnType<typeof useStore.getState>['db'], brandId: string): User | undefined {
  return db.users.find((u) => u.brandId === brandId);
}

// =====================================================================
// Apply (creator-side)
// =====================================================================

/**
 * P3 §2.4 — score a creator's category overlap with the campaign's
 * primary category. Returns 0–100. Pure function over Creator.categories
 * + Campaign.category so the rule's testable in isolation.
 *
 * Heuristic: exact match → 100. Substring / case-insensitive match → 80.
 * Genre adjacency (e.g. "Beauty" vs "Wellness", same axis) → 50. None → 0.
 * Adjacency table is intentionally small — extend as the seed grows.
 */
function categoryOverlapScore(creatorCategories: string[] | undefined, campaignCategory: string): number {
  if (!creatorCategories || creatorCategories.length === 0) return 0;
  const target = campaignCategory.toLowerCase();
  const ADJACENT: Record<string, string[]> = {
    beauty: ['wellness', 'fashion', 'lifestyle'],
    wellness: ['beauty', 'fitness', 'lifestyle'],
    food: ['lifestyle', 'travel'],
    fashion: ['beauty', 'lifestyle'],
    lifestyle: ['beauty', 'fashion', 'food', 'wellness'],
    travel: ['food', 'lifestyle'],
    fitness: ['wellness'],
    design: ['lifestyle', 'fashion'],
    tech: ['gaming'],
    gaming: ['tech'],
    finance: [],
  };
  let best = 0;
  for (const raw of creatorCategories) {
    const c = raw.toLowerCase();
    if (c === target) { best = Math.max(best, 100); continue; }
    if (c.includes(target) || target.includes(c)) { best = Math.max(best, 80); continue; }
    if ((ADJACENT[target] ?? []).includes(c) || (ADJACENT[c] ?? []).includes(target)) {
      best = Math.max(best, 50);
    }
  }
  return best;
}

/**
 * Creator applies to a brief. Inserts a new Application record and
 * notifies the brand. If an application already exists in 'submitted' or
 * 'shortlisted' state, this is a no-op (idempotent).
 *
 * P3 §2.4 — auto-shortlist: if the campaign opted into auto-shortlist
 * (`Campaign.autoShortlist.enabled === true`) and the applying creator's
 * category-overlap score meets `threshold`, the new Application is
 * created with status `'shortlisted'` instead of `'submitted'`.
 */
export function v2ApplyToCampaign(
  campaignId: string,
  creatorId: string,
  pitch: string,
  proposedRate: number,
): Application | null {
  const result = tx((db) => {
    // P5 §4.1 — `application.invite` is held by creators (self-apply).
    requireCapability(getActorUserId(), 'application.invite', db);

    const camp = db.campaigns.find((c) => c.id === campaignId);
    if (!camp) return null;
    const creator = db.creators.find((c) => c.id === creatorId);
    if (!creator) return null;

    // Idempotent — return existing if creator already pitched
    const existing = db.applications.find(
      (a) => a.campaignId === campaignId && a.creatorId === creatorId &&
             (a.status === 'submitted' || a.status === 'shortlisted'),
    );
    if (existing) return existing;

    // P3 §2.4 — auto-shortlist score check.
    let initialStatus: Application['status'] = 'submitted';
    let decidedAt: string | undefined;
    const auto = camp.autoShortlist;
    if (auto?.enabled) {
      const score = categoryOverlapScore(creator.categories, camp.category);
      if (score >= auto.threshold) {
        initialStatus = 'shortlisted';
        decidedAt = nowIso();
      }
    }

    const app: Application = {
      id: newId('app'),
      campaignId,
      creatorId,
      pitch,
      proposedRate,
      status: initialStatus,
      submittedAt: nowIso(),
      decidedAt,
    };
    db.applications.push(app);
    db.campaigns = db.campaigns.map((c) =>
      c.id === campaignId ? { ...c, applications: [...c.applications, app.id] } : c,
    );

    // Notify the brand owner
    const brand = db.brands.find((b) => b.id === camp.brandId);
    const brandUser = brand ? findUserByBrand(db, brand.id) : null;
    if (brandUser) {
      db.notifications.push({
        id: newId('n'),
        userId: brandUser.id,
        text: `${creator.name} pitched for ${camp.title}`,
        href: `/v2`,
        at: nowIso(),
        read: false,
        meta: { applicationId: app.id, campaignId },
      });
    }

    // P1c §1.1 — sync Collaboration. With a fresh app in 'submitted',
    // computeCollabStage will return 'pitched'.
    const creatorUser = findUserByCreator(db, creatorId);
    ensureCollabState(campaignId, creatorId, db, creatorUser?.id ?? '', 'app-submitted');

    return app;
  });
  // Mirror new application + the campaign's updated applications[] to Supabase.
  if (result) {
    mirrorApplicationInsertToSupabase(result);
    const camp = useStore.getState().db.campaigns.find((c) => c.id === campaignId);
    if (camp) mirrorCampaignToSupabase(campaignId, { applications: camp.applications });
  }
  return result;
}

// =====================================================================
// Send Offer (brand-side)
// =====================================================================

/**
 * Brand sends a terms offer to a pitched creator. Reserves nothing yet
 * — the funds reserve only when the creator accepts. Creates a thread
 * if one doesn't exist, so the negotiation has a place to live.
 */
export function v2SendOffer(
  campaignId: string,
  creatorId: string,
  rate: number,
  message: string,
  /** P1b §1.7 — link to the application this offer responds to (null for
   *  cold-outreach / invite / spark). */
  applicationId: string | null = null,
  /** P1b §1.7 — provenance. Defaults to 'application' when applicationId
   *  is set, 'cold-outreach' otherwise. */
  source?: import('@/lib/api/types').OfferSource,
  /** P7 — when this offer is the follow-up to an existing Outreach
   *  conversation (P6 §5.3), the outreach id flows in here so we can
   *  link the new Offer back to the Outreach via `resultingOfferId`.
   *  Null/undefined for non-outreach paths. */
  outreachId: string | null = null,
): Offer | null {
  const result = tx((db) => {
    // P5 §4.1 — brand-side `offer.send` (admin/ops; not finance/viewer).
    requireCapability(getActorUserId(), 'offer.send', db);

    const camp = db.campaigns.find((c) => c.id === campaignId);
    if (!camp) return null;
    const creator = db.creators.find((c) => c.id === creatorId);
    if (!creator) return null;
    const brand = db.brands.find((b) => b.id === camp.brandId);
    if (!brand) return null;

    const sentAtIso = nowIso();
    const offer: Offer = {
      id: newId('off'),
      campaignId,
      creatorId,
      rate,
      message,
      status: 'pending',
      sentAt: sentAtIso,
      applicationId,
      // P7 — when an outreach is upgraded to an offer, override the
      // default source to 'spark-recommendation' (the natural fit for
      // outreach-originated offers) — caller can still override.
      source: source ?? (applicationId ? 'application' : (outreachId ? 'spark-recommendation' : 'cold-outreach')),
      // P3 §2.1 — round 0 is always the brand's initial send.
      rounds: [
        { by: 'brand', at: +new Date(sentAtIso), rate, message },
      ],
    };
    db.offers.push(offer);
    db.campaigns = db.campaigns.map((c) =>
      c.id === campaignId ? { ...c, offers: [...c.offers, offer.id] } : c,
    );

    // §2.6 thread campaign-tie rule:
    //
    //   `Thread.campaignId`     — the historical anchor. Set at thread
    //                             creation when the conversation begins
    //                             from a campaign context (this site:
    //                             a brand sending an offer for a campaign).
    //                             Persists for the lifetime of the thread,
    //                             even if the campaign closes — the
    //                             conversation history needs the anchor
    //                             to render correctly. Do NOT clear it on
    //                             campaign close.
    //
    //   `Thread.collaborationId` — the operational anchor. Starts null;
    //                             promoted to a real Collab id by
    //                             `ensureCollabState` (collabSync.ts) when
    //                             the brand×creator pair materializes a
    //                             Collaboration on this campaign. Used by
    //                             the inbox right pane (`CollabSidePanel`)
    //                             to look up the active deal state.
    //
    //   Pre-collab DMs (e.g. brand pinged from Discover before any
    //   application) take a different code path that we don't have today
    //   — when we add it, keep `campaignId` UNSET there so a generic
    //   creator-brand DM doesn't get spuriously campaign-tied. The rule:
    //   campaignId is set IFF the thread originates inside a campaign
    //   workflow (offer, application, brand-pipeline DM).
    //
    // Ensure a thread exists between brand owner and creator on this campaign.
    const brandUser = findUserByBrand(db, brand.id);
    const creatorUser = findUserByCreator(db, creator.id);
    if (brandUser && creatorUser) {
      const existing = db.threads.find(
        (t) => t.campaignId === campaignId &&
          t.participants.includes(brandUser.id) &&
          t.participants.includes(creatorUser.id),
      );
      if (!existing) {
        const threadId = newId('t');
        const newThread: import('@/lib/api/types').Thread = {
          id: threadId,
          participants: [brandUser.id, creatorUser.id],
          campaignId, // §2.6 — set at creation; persists for lifetime
          subject: camp.title,
          lastMessageAt: nowIso(),
          unreadFor: [creatorUser.id],
          // §2.6 — operational anchor. Starts null; ensureCollabState
          // promotes to the real Collab id when the pair materializes.
          collaborationId: null,
        };
        db.threads.push(newThread);
        const firstMsg: import('@/lib/api/types').Message = {
          id: newId('m'),
          threadId,
          fromUserId: brandUser.id,
          text: `Hi ${creator.name.split(' ')[0]} — sending an offer of $${rate.toLocaleString()} for ${camp.title}. ${message}`,
          at: nowIso(),
        };
        db.messages.push(firstMsg);
        // Stash on the offer return path so the mirror block below
        // can pick these up without re-querying the local store.
        (offer as Offer & { __newThread?: typeof newThread; __firstMsg?: typeof firstMsg }).__newThread = newThread;
        (offer as Offer & { __newThread?: typeof newThread; __firstMsg?: typeof firstMsg }).__firstMsg = firstMsg;
      }
      // Notify creator
      db.notifications.push({
        id: newId('n'),
        userId: creatorUser.id,
        text: `${brand.name} sent you an offer for ${camp.title}`,
        href: `/v2`,
        at: nowIso(),
        read: false,
        meta: { offerId: offer.id, campaignId },
      });
    }

    // P1c §1.1 — sync Collaboration. Pending offer → 'negotiating'
    // (or 'invited' if source was 'invite' and there's no app yet —
    // computeCollabStage handles both.) Brand user is the actor.
    ensureCollabState(campaignId, creatorId, db, brandUser?.id ?? '', `offer-sent:${offer.source}`);

    // P7 — link the new Offer back to its source Outreach if the offer
    // is upgrading an existing soft-contact conversation. Bidirectional:
    // the Outreach gets `resultingOfferId` so the audit trail joins
    // cleanly. Idempotent — won't double-link if the outreach already
    // points at a different offer (rare; caller bug).
    if (outreachId) {
      const oIdx = db.outreach.findIndex((o) => o.id === outreachId);
      if (oIdx !== -1 && !db.outreach[oIdx].resultingOfferId) {
        db.outreach[oIdx] = {
          ...db.outreach[oIdx],
          resultingOfferId: offer.id,
          // The conversation upgraded to a real offer — close the loop.
          status: db.outreach[oIdx].status === 'sent' ? 'replied' : db.outreach[oIdx].status,
        };
      }
    }

    return offer;
  });
  // Mirror new offer + the campaign's updated offers[] to Supabase.
  if (result) {
    mirrorOfferInsertToSupabase(result);
    const camp = useStore.getState().db.campaigns.find((c) => c.id === result.campaignId);
    if (camp) mirrorCampaignToSupabase(camp.id, { offers: camp.offers });

    // Phase 10 — if v2SendOffer also created the initial thread + message
    // (no prior conversation between brand and creator), mirror both.
    const sidecar = result as Offer & {
      __newThread?: import('@/lib/api/types').Thread;
      __firstMsg?: import('@/lib/api/types').Message;
    };
    if (sidecar.__newThread) mirrorThreadInsertToSupabase(sidecar.__newThread);
    if (sidecar.__firstMsg)  mirrorMessageInsertToSupabase(sidecar.__firstMsg);

    // Phase 9 — if this offer upgraded an existing Outreach, mirror the
    // back-link patch (resulting_offer_id + status flip). The local
    // mutation already updated the row; just hand the same change to
    // Postgres so the audit trail matches.
    if (outreachId) {
      const updatedOutreach = useStore.getState().db.outreach.find((o) => o.id === outreachId);
      if (updatedOutreach && updatedOutreach.resultingOfferId === result.id) {
        void (async () => {
          try {
            const { updateOutreachInSupabase } = await import('@/lib/data/outreachRepo');
            await updateOutreachInSupabase(outreachId, {
              resultingOfferId: result.id,
              status: updatedOutreach.status,
            });
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            if (/row-level security|no rows|0 rows|not found/i.test(msg)) return;
            // eslint-disable-next-line no-console
            console.warn('[outreach back-link mirror] failed:', msg);
          }
        })();
      }
    }
  }
  return result;
}

// =====================================================================
// Accept Offer (creator-side)
// =====================================================================

/**
 * Creator accepts an offer. This is the moment funds are actually
 * reserved into escrow:
 *   - Offer.status → 'accepted'
 *   - Application.status → 'shortlisted' (if there's a matching app)
 *   - Brand wallet decreases by `rate`
 *   - Brand escrowHeld increases by `rate`
 *   - Campaign escrowHeld increases by `rate`
 *   - Creator pendingBalance increases by net (after fee + WHT)
 *   - Transaction (escrow_hold) recorded for both sides
 *   - acceptedCreators list updated on Campaign
 */
export function v2AcceptOffer(offerId: string): Offer | null {
  const result = tx((db) => {
    // P5 §4.1 — accept is a creator-side action (creators have
    // `offer.counter` which covers accept/decline/counter on their
    // own offers).
    requireCapability(getActorUserId(), 'offer.counter', db);

    const offerIdx = db.offers.findIndex((o) => o.id === offerId);
    if (offerIdx === -1) return null;
    const offer = db.offers[offerIdx];
    if (offer.status !== 'pending' && offer.status !== 'countered') return offer;

    const camp = db.campaigns.find((c) => c.id === offer.campaignId);
    const brand = camp ? db.brands.find((b) => b.id === camp.brandId) : undefined;
    const creator = db.creators.find((c) => c.id === offer.creatorId);
    if (!camp || !brand || !creator) return null;

    db.offers[offerIdx] = { ...offer, status: 'accepted', respondedAt: nowIso() };

    // Reserve funds: brand wallet -> escrow
    db.brands = db.brands.map((b) =>
      b.id === brand.id
        ? {
            ...b,
            walletBalance: Math.max(0, b.walletBalance - offer.rate),
            escrowHeld: b.escrowHeld + offer.rate,
          }
        : b,
    );

    // Net to creator (gross - 10% fee - 5% WHT) becomes pending until release
    const netToCreator = Math.round(offer.rate * (1 - PLATFORM_FEE - WHT));
    db.creators = db.creators.map((c) =>
      c.id === creator.id
        ? { ...c, pendingBalance: c.pendingBalance + netToCreator }
        : c,
    );

    // Update campaign — `acceptedCreators` is no longer a stored field
    // (P1a removal); the relation is derivable from the offer status that
    // was just flipped to 'accepted' above.
    // P1b §1.2: campaign stage no longer auto-advances on offer-accept.
    // Per-collab progress is tracked on Collaboration.stage (P1c).
    db.campaigns = db.campaigns.map((c) =>
      c.id === camp.id
        ? {
            ...c,
            escrowHeld: c.escrowHeld + offer.rate,
          }
        : c,
    );

    // Mark application shortlisted
    db.applications = db.applications.map((a) =>
      a.campaignId === offer.campaignId && a.creatorId === offer.creatorId && a.status === 'submitted'
        ? { ...a, status: 'shortlisted', decidedAt: nowIso() }
        : a,
    );

    // Transactions
    const brandUser = findUserByBrand(db, brand.id);
    const creatorUser = findUserByCreator(db, creator.id);
    if (brandUser && creatorUser) {
      const txEscrow: Transaction = {
        id: newId('tx'),
        at: nowIso(),
        userId: brandUser.id,
        kind: 'escrow_hold',
        amount: -offer.rate,
        status: 'cleared',
        campaignId: camp.id,
        counterpartyUserId: creatorUser.id,
        note: `Escrow held for ${creator.name} on ${camp.title}`,
      };
      db.transactions.push(txEscrow);

      // Notify brand the offer was accepted
      db.notifications.push({
        id: newId('n'),
        userId: brandUser.id,
        text: `${creator.name} accepted your offer on ${camp.title}`,
        href: `/v2`,
        at: nowIso(),
        read: false,
        meta: { offerId: offer.id, campaignId: camp.id },
      });
    }

    // P1c §1.1 — accepted offer → 'confirmed' on Collaboration. Creator
    // is the actor (they accepted). The helper also picks up the rate
    // and sets agreedRate + acceptedOfferId.
    const creatorUserForSync = findUserByCreator(db, creator.id);
    const collabAfter = ensureCollabState(camp.id, creator.id, db, creatorUserForSync?.id ?? '', 'offer-accepted');

    // P2 §1.3 — create the immutable Contract snapshot in the same tx.
    // The Contract is what locks brief + deliverables at the moment of
    // acceptance; subsequent edits to the campaign don't affect it.
    if (collabAfter && !collabAfter.contractId) {
      createContractForAcceptedOffer(db, collabAfter.id, db.offers[offerIdx], creatorUserForSync?.id ?? '');
    }

    // P4 §3.1 — schedule deadline reminders + stale-escrow follow-ups.
    // The campaign's structured Deliverable rows give us per-row due
    // offsets; we schedule a 24h-before reminder + 3 daily overdue
    // follow-ups for each. The collab-level stale-escrow check fans
    // out to both parties at 30/60/90 days.
    if (collabAfter && brandUser && creatorUserForSync) {
      const confirmedAt = Date.now();
      const fallbackDueAt = camp.deadline ? +new Date(camp.deadline) : confirmedAt + 14 * 24 * 60 * 60 * 1000;
      const campDeliverables = db.deliverables.filter((d) => d.campaignId === camp.id);
      for (const del of campDeliverables) {
        const dueAtMs = del.dueOffsetDays !== null
          ? confirmedAt + del.dueOffsetDays * 24 * 60 * 60 * 1000
          : (Number.isFinite(fallbackDueAt) ? fallbackDueAt : confirmedAt + 14 * 24 * 60 * 60 * 1000);
        enqueueDeadline24h(db, {
          deliverableId: del.id,
          creatorUserId: creatorUserForSync.id,
          dueAtMs,
          campaignId: camp.id,
          collaborationId: collabAfter.id,
        });
        enqueueDeadlineOverdue(db, {
          deliverableId: del.id,
          creatorUserId: creatorUserForSync.id,
          brandUserId: brandUser.id,
          dueAtMs,
          campaignId: camp.id,
          collaborationId: collabAfter.id,
        });
      }
      enqueueEscrowStale(db, {
        collaborationId: collabAfter.id,
        creatorUserId: creatorUserForSync.id,
        brandUserId: brandUser.id,
        confirmedAtMs: confirmedAt,
        campaignId: camp.id,
      });
    }

    return db.offers[offerIdx];
  });
  // Mirror status flip + the campaign's escrow update.
  if (result) {
    mirrorOfferUpdateToSupabase(offerId, {
      status: result.status,
      rate: result.rate,
      respondedAt: result.respondedAt,
    });
    const camp = useStore.getState().db.campaigns.find((c) => c.id === result.campaignId);
    if (camp) mirrorCampaignToSupabase(camp.id, { escrowHeld: camp.escrowHeld });
  }
  return result;
}

// =====================================================================
// Submit Content (creator-side)
// =====================================================================

/**
 * Creator submits a draft. Creates a Submission with status='in_review'
 * and notifies the brand owner.
 *
 * P1d §1.5/§1.6 — submissions attach to a Deliverable via FK. Pre-P1d
 * this was encoded as a `[slot:N]` prefix in `notes` that the adapters
 * had to re-parse on every render; now it's a stored `deliverableId`.
 *
 * Round counter: number of previous submissions for the same
 * `deliverableId` + 1. Two deliverables on the same campaign can be on
 * round 1 simultaneously; resubmitting a revision bumps the round for
 * THAT deliverable only.
 *
 * If the caller passes an empty `deliverableId`, falls back to the
 * campaign's first Deliverable (legacy ContentUploadModal call sites
 * that haven't been migrated yet).
 */
export function v2SubmitContent(
  campaignId: string,
  creatorId: string,
  caption: string,
  fileName: string,
  deliverableId: string,
): Submission | null {
  const result = tx((db) => {
    // P5 §4.1 — creator-side capability.
    requireCapability(getActorUserId(), 'content.submit', db);

    const camp = db.campaigns.find((c) => c.id === campaignId);
    if (!camp) return null;
    const creator = db.creators.find((c) => c.id === creatorId);
    if (!creator) return null;

    // Resolve the deliverable. Pass-through when caller supplied a real
    // id; fall back to the campaign's first Deliverable if blank.
    let resolvedDelId = deliverableId;
    if (!resolvedDelId) {
      const first = db.deliverables
        .filter((d) => d.campaignId === campaignId)
        .sort((a, b) => a.index - b.index)[0];
      resolvedDelId = first?.id ?? '';
    }

    // Round = previous submissions for THIS deliverable + 1.
    const previousForDeliverable = db.submissions.filter(
      (s) => s.campaignId === campaignId && s.creatorId === creatorId &&
             s.deliverableId === resolvedDelId,
    );
    const round = previousForDeliverable.length + 1;
    const submission: Submission = {
      id: newId('sub'),
      campaignId,
      creatorId,
      round,
      files: [{ name: fileName, url: '#' }],
      notes: caption,
      status: 'in_review',
      submittedAt: nowIso(),
      feedback: [],
      deliverableId: resolvedDelId || undefined,
    };
    db.submissions.push(submission);

    // Notify brand
    const brand = db.brands.find((b) => b.id === camp.brandId);
    const brandUser = brand ? findUserByBrand(db, brand.id) : null;
    if (brandUser) {
      db.notifications.push({
        id: newId('n'),
        userId: brandUser.id,
        text: `${creator.name} submitted a draft for ${camp.title}`,
        href: `/v2`,
        at: nowIso(),
        read: false,
        meta: { submissionId: submission.id, campaignId },
      });
    }

    // P1c §1.1 — fresh in_review submission → 'submitted' on Collaboration.
    const creatorUser = findUserByCreator(db, creatorId);
    ensureCollabState(campaignId, creatorId, db, creatorUser?.id ?? '', 'content-submitted');

    return submission;
  });
  if (result) mirrorSubmissionInsertToSupabase(result);
  return result;
}

// =====================================================================
// Approve Content (brand-side) — releases escrow
// =====================================================================

/**
 * Brand approves a submitted draft. Releases the held escrow:
 *   - Submission.status → 'approved'
 *   - Brand.escrowHeld decreases by `gross`
 *   - Campaign.escrowHeld decreases, Campaign.spent increases
 *   - Creator.pendingBalance decreases by net, walletBalance increases by net
 *   - Creator.lifetimeEarnings increases by net
 *   - Transactions recorded: brand 'escrow_release' + creator 'payout' + 'fee' + 'tax'
 */
/** P2 §1.4 — 7-day post-approval dispute window. */
const DISPUTE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export function v2ApproveContent(submissionId: string): Submission | null {
  const result = tx((db) => {
    // P5 §4.1 — brand-side `content.approve` (admin/ops).
    requireCapability(getActorUserId(), 'content.approve', db);

    const subIdx = db.submissions.findIndex((s) => s.id === submissionId);
    if (subIdx === -1) return null;
    const sub = db.submissions[subIdx];
    if (sub.status === 'approved') return sub;

    const camp = db.campaigns.find((c) => c.id === sub.campaignId);
    const creator = db.creators.find((c) => c.id === sub.creatorId);
    const brand = camp ? db.brands.find((b) => b.id === camp.brandId) : undefined;
    if (!camp || !creator || !brand) return null;

    // P2 §1.4 — block approval if there's an open dispute on this collab.
    // The Collaboration's `escrowFrozen` flag is set when a dispute is
    // raised (and cleared on resolve / withdraw). We surface the block
    // as a no-op return so the caller knows the action didn't take.
    const collab = db.collaborations.find(
      (c) => c.campaignId === sub.campaignId && c.creatorId === sub.creatorId,
    );
    if (collab?.escrowFrozen) {
      // Soft fail — don't throw inside the tx; caller surfaces a toast
      // when the return value indicates no transition.
      return sub;
    }

    // Find the agreed offer rate (latest accepted offer)
    const acceptedOffer = db.offers
      .filter((o) => o.campaignId === sub.campaignId && o.creatorId === sub.creatorId && o.status === 'accepted')
      .sort((a, b) => new Date(b.respondedAt ?? b.sentAt).getTime() - new Date(a.respondedAt ?? a.sentAt).getTime())[0];
    const acceptedCreatorCount = getAcceptedCreators(camp.id, db).length;
    const gross = acceptedOffer?.rate ?? Math.round(camp.budget / Math.max(acceptedCreatorCount || 1, 1));
    const fee = Math.round(gross * PLATFORM_FEE);
    const tax = Math.round(gross * WHT);
    const net = gross - fee - tax;

    // P2 §1.4 — set the 7-day dispute window expiry on approval. UI
    // gates the "Raise dispute" CTA off this; a P4 ScheduledNotification
    // will fire a closing-soon reminder.
    db.submissions[subIdx] = {
      ...sub,
      status: 'approved',
      disputeWindowClosesAt: Date.now() + DISPUTE_WINDOW_MS,
    };

    // Update brand
    db.brands = db.brands.map((b) =>
      b.id === brand.id ? { ...b, escrowHeld: Math.max(0, b.escrowHeld - gross) } : b,
    );

    // Update campaign — P1b §1.2: stage doesn't auto-advance on approve.
    // Per-collab 'approved' / 'live' / 'paid' lives on Collaboration (P1c).
    db.campaigns = db.campaigns.map((c) =>
      c.id === camp.id
        ? {
            ...c,
            escrowHeld: Math.max(0, c.escrowHeld - gross),
            spent: c.spent + gross,
          }
        : c,
    );

    // Update creator
    db.creators = db.creators.map((c) =>
      c.id === creator.id
        ? {
            ...c,
            pendingBalance: Math.max(0, c.pendingBalance - net),
            walletBalance: c.walletBalance + net,
            lifetimeEarnings: c.lifetimeEarnings + net,
          }
        : c,
    );

    const brandUser = findUserByBrand(db, brand.id);
    const creatorUser = findUserByCreator(db, creator.id);
    if (brandUser && creatorUser) {
      const ts = nowIso();
      // Brand-side: escrow_release (negative — leaving brand wallet)
      db.transactions.push({
        id: newId('tx'),
        at: ts,
        userId: brandUser.id,
        kind: 'escrow_release',
        amount: -gross,
        status: 'cleared',
        campaignId: camp.id,
        counterpartyUserId: creatorUser.id,
        note: `Released to ${creator.name} — ${camp.title}`,
      });
      // Creator-side: payout (positive — into creator wallet)
      db.transactions.push({
        id: newId('tx'),
        at: ts,
        userId: creatorUser.id,
        kind: 'payout',
        amount: net,
        status: 'cleared',
        campaignId: camp.id,
        counterpartyUserId: brandUser.id,
        note: `Payout from ${brand.name} — ${camp.title}`,
      });
      // Creator-side: fee (negative — platform's cut)
      db.transactions.push({
        id: newId('tx'),
        at: ts,
        userId: creatorUser.id,
        kind: 'fee',
        amount: -fee,
        status: 'cleared',
        campaignId: camp.id,
        note: `Platform fee (${Math.round(PLATFORM_FEE * 100)}%)`,
      });
      // Creator-side: tax (negative)
      db.transactions.push({
        id: newId('tx'),
        at: ts,
        userId: creatorUser.id,
        kind: 'fee',
        amount: -tax,
        status: 'cleared',
        campaignId: camp.id,
        note: `Withholding tax (${Math.round(WHT * 100)}%)`,
      });
      // Notify creator
      db.notifications.push({
        id: newId('n'),
        userId: creatorUser.id,
        text: `${brand.name} approved your work — $${net.toLocaleString()} released`,
        href: `/v2`,
        at: nowIso(),
        read: false,
        meta: { submissionId: sub.id, campaignId: camp.id },
      });
    }

    // P1c §1.1 — approve also clears escrow → 'paid' (a payout transaction
    // was just pushed). computeCollabStage walks transactions and returns
    // 'paid' when escrow_release/payout is cleared. Brand is the actor.
    const collabAfter = ensureCollabState(camp.id, creator.id, db, brandUser?.id ?? '', 'content-approved');

    // P2 §1.3 — payout cleared means the contract is fulfilled. Mark it.
    if (collabAfter?.contractId) {
      markContractFulfilled(db, collabAfter.contractId);
    }

    // P4 §3.1 — approval stamps `disputeWindowClosesAt = now + 7d` (above).
    // Schedule a 48h-before-close reminder for the brand. (P2's contract
    // already records the dispute window; this just adds the proactive
    // nudge so the brand knows time is running out to flag a problem.)
    const submissionAfter = db.submissions[subIdx];
    if (collabAfter && brandUser && submissionAfter.disputeWindowClosesAt) {
      enqueueReviewWindowClosing(db, {
        submissionId: submissionAfter.id,
        brandUserId: brandUser.id,
        disputeWindowClosesAtMs: submissionAfter.disputeWindowClosesAt,
        campaignId: camp.id,
        collaborationId: collabAfter.id,
      });
    }

    // P7 — KYC-expired trigger. When the brand approves content, a payout
    // will (or just did) clear to the creator. If the creator's KYC was
    // last verified more than 365 days ago, enqueue a reminder to refresh
    // it before future payouts get blocked. The trigger is event-driven
    // (fires once on approval); a periodic sweep would be heavier.
    // `undefined kycVerifiedAt` means "never verified" — no trigger
    // (the onboarding flow handles that nudge separately).
    const creatorUserForKyc = findUserByCreator(db, creator.id);
    if (creator.kycVerifiedAt && creatorUserForKyc) {
      const verifiedAtMs = +new Date(creator.kycVerifiedAt);
      const expiresAtMs = verifiedAtMs + 365 * 24 * 60 * 60 * 1000;
      // Only enqueue if the expiry is in the future (otherwise it's
      // already past — the scheduler's enqueue helper would reject it
      // anyway, but no point queueing).
      if (Number.isFinite(expiresAtMs)) {
        enqueueKycExpired(db, {
          creatorUserId: creatorUserForKyc.id,
          expiresAtMs,
        });
      }
    }

    return db.submissions[subIdx];
  });
  if (result) mirrorSubmissionUpdateToSupabase(submissionId, { status: result.status, feedback: result.feedback });
  return result;
}

// =====================================================================
// Request Revision (brand-side)
// =====================================================================

/**
 * Brand sends content back. Submission.status → 'revisions' with the
 * brand's note appended to the feedback log.
 */
export function v2RequestRevision(submissionId: string, note: string): Submission | null {
  const result = tx((db) => {
    // P5 §4.1 — same role set as content.approve; the brand team that
    // can approve content can also send it back for revision.
    requireCapability(getActorUserId(), 'content.revise', db);

    const subIdx = db.submissions.findIndex((s) => s.id === submissionId);
    if (subIdx === -1) return null;
    const sub = db.submissions[subIdx];
    const camp = db.campaigns.find((c) => c.id === sub.campaignId);
    const brandUser = camp ? findUserByBrand(db, camp.brandId) : null;
    db.submissions[subIdx] = {
      ...sub,
      status: 'revisions',
      feedback: [...sub.feedback, {
        from: brandUser?.id ?? 'brand',
        text: note,
        at: nowIso(),
      }],
    };
    // Notify the creator
    const creator = db.creators.find((c) => c.id === sub.creatorId);
    const creatorUser = creator ? findUserByCreator(db, creator.id) : null;
    if (creatorUser && camp) {
      db.notifications.push({
        id: newId('n'),
        userId: creatorUser.id,
        text: `Revision requested on ${camp.title}`,
        href: `/v2`,
        at: nowIso(),
        read: false,
        meta: { submissionId: sub.id, campaignId: camp.id },
      });
    }

    // P1c §1.1 — revision-requested keeps stage at 'submitted'
    // (computeCollabStage maps both in_review and revisions to 'submitted').
    // Helper still bumps updatedAt so the row reflects activity.
    if (camp) {
      ensureCollabState(camp.id, sub.creatorId, db, brandUser?.id ?? '', 'revision-requested');
    }

    return db.submissions[subIdx];
  });
  if (result) mirrorSubmissionUpdateToSupabase(submissionId, { status: result.status, feedback: result.feedback });
  return result;
}

// =====================================================================
// Launch Campaign (brand-side)
// =====================================================================

/** The shape collected by NewCampaignWizard. */
export interface LaunchCampaignInput {
  name: string;
  brief: string;
  objective: string;
  placement: string;
  budget: number;
  perCreator: number;
  deadline: string;
  audienceCity: string[];
  audienceGender: string;
  audienceAge: string[];
  categories: string[];
  invitedCreators: string[];
}

// =====================================================================
// Decline / Counter / Reject — the "no" or "renegotiate" paths
// =====================================================================

/**
 * Creator declines an offer. Offer.status → declined. Frees up any
 * placeholder reservation (none in our model since we only reserve on
 * accept). Notifies brand.
 */
export function v2DeclineOffer(offerId: string, reason?: string): Offer | null {
  const result = tx((db) => {
    // P5 §4.1 — creator action; same capability as counter.
    requireCapability(getActorUserId(), 'offer.counter', db);

    const idx = db.offers.findIndex((o) => o.id === offerId);
    if (idx === -1) return null;
    const offer = db.offers[idx];
    // Terminal states — can't decline an already-terminal offer.
    // 'expired' (P3 §2.1 counter cap) + 'withdrawn' added to the guard.
    if (
      offer.status === 'accepted'
      || offer.status === 'declined'
      || offer.status === 'expired'
      || offer.status === 'withdrawn'
    ) return offer;

    db.offers[idx] = { ...offer, status: 'declined', respondedAt: nowIso() };

    const camp = db.campaigns.find((c) => c.id === offer.campaignId);
    const brand = camp ? db.brands.find((b) => b.id === camp.brandId) : null;
    const brandUser = brand ? findUserByBrand(db, brand.id) : null;
    const creator = db.creators.find((c) => c.id === offer.creatorId);
    if (brandUser && creator) {
      db.notifications.push({
        id: newId('n'),
        userId: brandUser.id,
        text: `${creator.name} declined your offer${reason ? ` — "${reason}"` : ''}`,
        href: `/v2`,
        at: nowIso(),
        read: false,
        meta: { offerId, campaignId: offer.campaignId },
      });
    }

    // P1c §1.1 — declined offer with no app/other-offer → 'cancelled';
    // otherwise the helper will fall back to whichever stage is current.
    // Creator declined, so creator-user is the actor.
    const creatorUser = creator ? findUserByCreator(db, creator.id) : null;
    ensureCollabState(offer.campaignId, offer.creatorId, db, creatorUser?.id ?? '', reason ? `offer-declined: ${reason}` : 'offer-declined');

    return db.offers[idx];
  });
  if (result) mirrorOfferUpdateToSupabase(offerId, { status: result.status, respondedAt: result.respondedAt });
  return result;
}

/**
 * P3 §2.1 — counter cap. The brief allows the negotiation transcript
 * up to 4 entries: 1 initial brand offer + 3 counters (creator, brand,
 * creator). The 4th counter (a hypothetical 4th counter on top of 3
 * existing rounds) flips the offer to `expired` and refuses to land
 * the new round. Acceptance criteria: "counter 3 times → 4th throws".
 *
 * Reading guidance: rounds[rounds.length - 1] is "current state of
 * negotiation" — that's the round the other side is responding to.
 */
export const MAX_OFFER_ROUNDS = 4;

/**
 * Creator counters a brand-side offer with a different rate / message.
 * Pushes a `creator` round onto `Offer.rounds`. The original offer's
 * top-level `rate`/`message` mirror the latest pending round so legacy
 * read paths keep working. Status flips to `countered`.
 *
 * Cap (P3 §2.1): if `rounds.length >= MAX_OFFER_ROUNDS`, status flips
 * to `expired` and the new round is NOT appended. Application returns
 * to `submitted` so the brand can still re-engage with a fresh Offer.
 */
export function v2CounterOffer(offerId: string, rate: number, message: string): Offer | null {
  const result = tx((db) => {
    // P5 §4.1 — creator-side counter.
    requireCapability(getActorUserId(), 'offer.counter', db);

    const idx = db.offers.findIndex((o) => o.id === offerId);
    if (idx === -1) return null;
    const offer = db.offers[idx];
    if (offer.status !== 'pending' && offer.status !== 'countered') return offer;
    // Creator can only counter when the latest round was a brand round.
    const lastRound = offer.rounds[offer.rounds.length - 1];
    if (lastRound && lastRound.by === 'creator') return offer;

    // Cap check — if we'd exceed MAX_OFFER_ROUNDS, expire instead.
    if (offer.rounds.length >= MAX_OFFER_ROUNDS) {
      db.offers[idx] = {
        ...offer,
        status: 'expired',
        respondedAt: nowIso(),
      };
      // Roll the application back to `submitted` so the brand can
      // re-engage cleanly with a fresh Offer.
      if (offer.applicationId) {
        db.applications = db.applications.map((a) =>
          a.id === offer.applicationId ? { ...a, status: 'submitted', decidedAt: undefined } : a,
        );
      }
      ensureCollabState(offer.campaignId, offer.creatorId, db, '', 'counter-cap-exceeded');
      return db.offers[idx];
    }

    const at = Date.now();
    const newRound: OfferRound = { by: 'creator', at, rate, message };
    db.offers[idx] = {
      ...offer,
      // Mirror the latest round to top-level rate/message so legacy
      // readers (CounterOfferModal, deal-action) keep showing the
      // most recent values without round-aware code.
      rate,
      message,
      status: 'countered',
      respondedAt: nowIso(),
      rounds: [...offer.rounds, newRound],
    };

    const camp = db.campaigns.find((c) => c.id === offer.campaignId);
    const brand = camp ? db.brands.find((b) => b.id === camp.brandId) : null;
    const brandUser = brand ? findUserByBrand(db, brand.id) : null;
    const creator = db.creators.find((c) => c.id === offer.creatorId);
    if (brandUser && creator && camp) {
      db.notifications.push({
        id: newId('n'),
        userId: brandUser.id,
        text: `${creator.name} countered with $${rate.toLocaleString()} on ${camp.title}`,
        href: `/v2`,
        at: nowIso(),
        read: false,
        meta: { offerId, campaignId: offer.campaignId },
      });
    }

    // P1c §1.1 — countered keeps stage 'negotiating'. Creator is actor.
    const creatorUser = creator ? findUserByCreator(db, creator.id) : null;
    ensureCollabState(offer.campaignId, offer.creatorId, db, creatorUser?.id ?? '', 'offer-countered');

    return db.offers[idx];
  });
  if (result) mirrorOfferUpdateToSupabase(offerId, {
    status: result.status, rate: result.rate, message: result.message,
    rounds: result.rounds, respondedAt: result.respondedAt,
  });
  return result;
}

/**
 * P3 §2.1 — brand counters a creator-side counter ("counter-counter").
 * Mirror of `v2CounterOffer` but pushes a `brand` round. Required
 * precondition: the latest round was a creator round. Same cap behavior.
 */
export function v2CounterCounter(offerId: string, rate: number, message: string): Offer | null {
  const result = tx((db) => {
    // P5 §4.1 — brand-side counter-back; admin/ops only.
    requireCapability(getActorUserId(), 'offer.send', db);

    const idx = db.offers.findIndex((o) => o.id === offerId);
    if (idx === -1) return null;
    const offer = db.offers[idx];
    if (offer.status !== 'countered') return offer;
    const lastRound = offer.rounds[offer.rounds.length - 1];
    if (!lastRound || lastRound.by !== 'creator') return offer;

    if (offer.rounds.length >= MAX_OFFER_ROUNDS) {
      db.offers[idx] = { ...offer, status: 'expired', respondedAt: nowIso() };
      if (offer.applicationId) {
        db.applications = db.applications.map((a) =>
          a.id === offer.applicationId ? { ...a, status: 'submitted', decidedAt: undefined } : a,
        );
      }
      ensureCollabState(offer.campaignId, offer.creatorId, db, '', 'counter-cap-exceeded');
      return db.offers[idx];
    }

    const at = Date.now();
    const newRound: OfferRound = { by: 'brand', at, rate, message };
    db.offers[idx] = {
      ...offer,
      rate,
      message,
      // Status stays 'countered' — the creator now owes a response.
      status: 'countered',
      respondedAt: nowIso(),
      rounds: [...offer.rounds, newRound],
    };

    const camp = db.campaigns.find((c) => c.id === offer.campaignId);
    const brand = camp ? db.brands.find((b) => b.id === camp.brandId) : null;
    const creator = db.creators.find((c) => c.id === offer.creatorId);
    const creatorUser = creator ? findUserByCreator(db, creator.id) : null;
    if (creatorUser && brand && camp) {
      db.notifications.push({
        id: newId('n'),
        userId: creatorUser.id,
        text: `${brand.name} countered back at $${rate.toLocaleString()} on ${camp.title}`,
        href: `/v2`,
        at: nowIso(),
        read: false,
        meta: { offerId, campaignId: offer.campaignId },
      });
    }

    const brandUser = brand ? findUserByBrand(db, brand.id) : null;
    ensureCollabState(offer.campaignId, offer.creatorId, db, brandUser?.id ?? '', 'counter-counter');

    return db.offers[idx];
  });
  if (result) mirrorOfferUpdateToSupabase(offerId, {
    status: result.status, rate: result.rate, message: result.message,
    rounds: result.rounds, respondedAt: result.respondedAt,
  });
  return result;
}

/**
 * Brand accepts a counter — promotes the counter rate to the offer's
 * accepted rate and runs the same escrow logic as v2AcceptOffer.
 */
export function v2AcceptCounter(offerId: string): Offer | null {
  const result = tx((db) => {
    // P5 §4.1 — brand-side accept; admin/ops only.
    requireCapability(getActorUserId(), 'offer.send', db);

    const idx = db.offers.findIndex((o) => o.id === offerId);
    if (idx === -1) return null;
    const offer = db.offers[idx];
    if (offer.status !== 'countered') return offer;
    // P3 §2.1 — accept the latest round. Either side can be the
    // "accepter" depending on who sent the latest round.
    const lastRound = offer.rounds[offer.rounds.length - 1];
    if (!lastRound) return offer;

    const newRate = lastRound.rate;
    db.offers[idx] = { ...offer, rate: newRate, status: 'accepted', respondedAt: nowIso() };

    const camp = db.campaigns.find((c) => c.id === offer.campaignId);
    const brand = camp ? db.brands.find((b) => b.id === camp.brandId) : null;
    const creator = db.creators.find((c) => c.id === offer.creatorId);
    if (!camp || !brand || !creator) return null;

    db.brands = db.brands.map((b) =>
      b.id === brand.id
        ? { ...b, walletBalance: Math.max(0, b.walletBalance - newRate), escrowHeld: b.escrowHeld + newRate }
        : b,
    );
    const netToCreator = Math.round(newRate * (1 - PLATFORM_FEE - WHT));
    db.creators = db.creators.map((c) =>
      c.id === creator.id ? { ...c, pendingBalance: c.pendingBalance + netToCreator } : c,
    );
    // P1a: acceptedCreators is no longer stored — derived from offer status.
    // P1b §1.2: campaign stage no longer auto-advances on counter-accept.
    db.campaigns = db.campaigns.map((c) =>
      c.id === camp.id
        ? {
            ...c,
            escrowHeld: c.escrowHeld + newRate,
          }
        : c,
    );
    db.applications = db.applications.map((a) =>
      a.campaignId === offer.campaignId && a.creatorId === offer.creatorId && a.status === 'submitted'
        ? { ...a, status: 'shortlisted', decidedAt: nowIso() }
        : a,
    );

    const brandUser = findUserByBrand(db, brand.id);
    const creatorUser = findUserByCreator(db, creator.id);
    if (brandUser && creatorUser) {
      db.transactions.push({
        id: newId('tx'),
        at: nowIso(),
        userId: brandUser.id,
        kind: 'escrow_hold',
        amount: -newRate,
        status: 'cleared',
        campaignId: camp.id,
        counterpartyUserId: creatorUser.id,
        note: `Escrow held for ${creator.name} on ${camp.title}`,
      });
      // Notify creator that their counter was accepted (s19 — was missing).
      db.notifications.push({
        id: newId('n'),
        userId: creatorUser.id,
        text: `${brand.name} accepted your counter at $${newRate.toLocaleString()} on ${camp.title}`,
        href: `/v2`,
        at: nowIso(),
        read: false,
        meta: { offerId: offer.id, campaignId: camp.id },
      });
    }

    // P1c §1.1 — counter-accept transitions Collaboration to 'confirmed'.
    // Brand is the actor (they accepted the counter).
    const collabAfter = ensureCollabState(camp.id, creator.id, db, brandUser?.id ?? '', 'counter-accepted');

    // P2 §1.3 — same Contract creation pattern as v2AcceptOffer; brand
    // is the actor here (they accepted the counter).
    if (collabAfter && !collabAfter.contractId) {
      createContractForAcceptedOffer(db, collabAfter.id, db.offers[idx], brandUser?.id ?? '');
    }

    // P4 §3.1 — same deadline + stale-escrow scheduling as v2AcceptOffer.
    // Counter-accept lands in the same 'confirmed' state, so the same
    // future events apply.
    const creatorUserForSched = findUserByCreator(db, creator.id);
    if (collabAfter && brandUser && creatorUserForSched) {
      const confirmedAt = Date.now();
      const fallbackDueAt = camp.deadline ? +new Date(camp.deadline) : confirmedAt + 14 * 24 * 60 * 60 * 1000;
      const campDeliverables = db.deliverables.filter((d) => d.campaignId === camp.id);
      for (const del of campDeliverables) {
        const dueAtMs = del.dueOffsetDays !== null
          ? confirmedAt + del.dueOffsetDays * 24 * 60 * 60 * 1000
          : (Number.isFinite(fallbackDueAt) ? fallbackDueAt : confirmedAt + 14 * 24 * 60 * 60 * 1000);
        enqueueDeadline24h(db, {
          deliverableId: del.id,
          creatorUserId: creatorUserForSched.id,
          dueAtMs,
          campaignId: camp.id,
          collaborationId: collabAfter.id,
        });
        enqueueDeadlineOverdue(db, {
          deliverableId: del.id,
          creatorUserId: creatorUserForSched.id,
          brandUserId: brandUser.id,
          dueAtMs,
          campaignId: camp.id,
          collaborationId: collabAfter.id,
        });
      }
      enqueueEscrowStale(db, {
        collaborationId: collabAfter.id,
        creatorUserId: creatorUserForSched.id,
        brandUserId: brandUser.id,
        confirmedAtMs: confirmedAt,
        campaignId: camp.id,
      });
    }

    return db.offers[idx];
  });
  // Mirror counter-accept + campaign escrow update.
  if (result) {
    mirrorOfferUpdateToSupabase(offerId, {
      status: result.status, rate: result.rate, respondedAt: result.respondedAt,
    });
    const camp = useStore.getState().db.campaigns.find((c) => c.id === result.campaignId);
    if (camp) mirrorCampaignToSupabase(camp.id, { escrowHeld: camp.escrowHeld });
  }
  return result;
}

/**
 * Brand rejects a creator's pitch. Application.status → rejected.
 * Notifies creator.
 */
export function v2RejectApplication(applicationId: string): Application | null {
  const result = tx((db) => {
    // P5 §4.1 — brand-side application decision.
    requireCapability(getActorUserId(), 'application.decide', db);

    const idx = db.applications.findIndex((a) => a.id === applicationId);
    if (idx === -1) return null;
    const app = db.applications[idx];
    if (app.status === 'rejected') return app;
    db.applications[idx] = { ...app, status: 'rejected', decidedAt: nowIso() };

    const creator = db.creators.find((c) => c.id === app.creatorId);
    const camp = db.campaigns.find((c) => c.id === app.campaignId);
    const creatorUser = creator ? findUserByCreator(db, creator.id) : null;
    if (creatorUser && camp) {
      db.notifications.push({
        id: newId('n'),
        userId: creatorUser.id,
        text: `${camp.title}: pass for now — keep an eye out for new briefs`,
        href: `/v2`,
        at: nowIso(),
        read: false,
        meta: { applicationId, campaignId: app.campaignId },
      });
    }

    // P1c §1.1 — rejected app with no live offer → 'cancelled'. The helper's
    // computeCollabStage handles the all-declined check.
    const brandUser = camp ? findUserByBrand(db, camp.brandId) : null;
    ensureCollabState(app.campaignId, app.creatorId, db, brandUser?.id ?? '', 'app-rejected');

    return db.applications[idx];
  });
  if (result) mirrorApplicationUpdateToSupabase(applicationId, { status: result.status, decidedAt: result.decidedAt });
  return result;
}

/**
 * Creator withdraws their own application. Application.status → withdrawn.
 * Notifies brand (s19 — was missing).
 */
export function v2WithdrawApplication(applicationId: string): Application | null {
  const result = tx((db) => {
    // P5 §4.1 — creator self-withdrawal; same capability as self-apply.
    requireCapability(getActorUserId(), 'application.invite', db);

    const idx = db.applications.findIndex((a) => a.id === applicationId);
    if (idx === -1) return null;
    const app = db.applications[idx];
    db.applications[idx] = { ...app, status: 'withdrawn', decidedAt: nowIso() };

    const creator = db.creators.find((c) => c.id === app.creatorId);
    const camp = db.campaigns.find((c) => c.id === app.campaignId);
    const brand = camp ? db.brands.find((b) => b.id === camp.brandId) : null;
    const brandUser = brand ? findUserByBrand(db, brand.id) : null;
    if (brandUser && creator && camp) {
      db.notifications.push({
        id: newId('n'),
        userId: brandUser.id,
        text: `${creator.name} withdrew their application from ${camp.title}`,
        href: `/v2`,
        at: nowIso(),
        read: false,
        meta: { applicationId, campaignId: app.campaignId },
      });
    }

    // P1c §1.1 — withdrawn app with no live offer → 'cancelled'. Creator
    // initiated, so the creator-user is the actor.
    const creatorUser = creator ? findUserByCreator(db, creator.id) : null;
    ensureCollabState(app.campaignId, app.creatorId, db, creatorUser?.id ?? '', 'app-withdrawn');

    return db.applications[idx];
  });
  if (result) mirrorApplicationUpdateToSupabase(applicationId, { status: result.status, decidedAt: result.decidedAt });
  return result;
}

/**
 * Brand cancels a sent offer (before acceptance). Useful when they
 * change their mind. Offer.status → withdrawn. Notifies creator
 * (s19 — was missing).
 */
export function v2WithdrawOffer(offerId: string): Offer | null {
  const result = tx((db) => {
    // P5 §4.1 — brand-side withdrawal of a sent offer.
    requireCapability(getActorUserId(), 'offer.withdraw', db);

    const idx = db.offers.findIndex((o) => o.id === offerId);
    if (idx === -1) return null;
    const offer = db.offers[idx];
    // Terminal states — can't withdraw an already-terminal offer.
    if (
      offer.status === 'accepted'
      || offer.status === 'withdrawn'
      || offer.status === 'declined'
      || offer.status === 'expired'
    ) return offer;
    db.offers[idx] = { ...offer, status: 'withdrawn', respondedAt: nowIso() };

    const camp = db.campaigns.find((c) => c.id === offer.campaignId);
    const brand = camp ? db.brands.find((b) => b.id === camp.brandId) : null;
    const creator = db.creators.find((c) => c.id === offer.creatorId);
    const creatorUser = creator ? findUserByCreator(db, creator.id) : null;
    if (creatorUser && brand && camp) {
      db.notifications.push({
        id: newId('n'),
        userId: creatorUser.id,
        text: `${brand.name} withdrew the offer on ${camp.title}`,
        href: `/v2`,
        at: nowIso(),
        read: false,
        meta: { offerId, campaignId: offer.campaignId },
      });
    }

    // P1c §1.1 — brand-withdrawn offer with no app or accepted offer →
    // 'cancelled'. Brand is the actor.
    const brandUser = brand ? findUserByBrand(db, brand.id) : null;
    ensureCollabState(offer.campaignId, offer.creatorId, db, brandUser?.id ?? '', 'offer-withdrawn');

    return db.offers[idx];
  });
  if (result) mirrorOfferUpdateToSupabase(offerId, { status: result.status, respondedAt: result.respondedAt });
  return result;
}

// =====================================================================
// Mark content live (brand-side)
// =====================================================================

/**
 * P3 §2.2 — creator-only Mark Live. The brand confirms the post is live;
 * the URL itself comes from the creator (who pasted it via
 * v2SetSubmissionPermalink). The brand UI reads the existing
 * `submission.permalink` and shows a confirmation modal — it does NOT
 * accept a new URL here. The mutation throws if the permalink is unset
 * (defensive — the UI should never reach this state, but the contract
 * is enforced at the data layer too).
 *
 * Pre-P3 the brand could pass a `permalink` argument here and overwrite
 * whatever the creator had pasted. That's gone — the creator owns the
 * URL field and the brand confirms it's right.
 */
export function v2MarkContentLive(submissionId: string): Submission | null {
  const result = tx((db) => {
    // P5 §4.1 — brand confirmation that the post is live; admin/ops.
    requireCapability(getActorUserId(), 'content.markLive', db);

    const idx = db.submissions.findIndex((s) => s.id === submissionId);
    if (idx === -1) return null;
    const sub = db.submissions[idx];
    if (sub.status !== 'approved') return sub;
    // P3 §2.2 — must have a permalink set by the creator.
    if (!sub.permalink) throw new Error('mark-live requires submission.permalink to be set by the creator first');

    // Append a feedback entry recording the action — the feedback log
    // is the audit trail; `permalink` is the queryable field used by
    // analytics + creator UI (creator already wrote it, we don't touch
    // the value here).
    db.submissions[idx] = {
      ...sub,
      feedback: [...sub.feedback, { from: 'system', text: `LIVE: ${sub.permalink}`, at: nowIso() }],
    };

    // P1b §1.2: campaign stage no longer transitions to 'reporting' on
    // mark-live. The signal "this submission is live" is now
    // submission.permalink + Collaboration.stage='live' (P1c).
    const camp = db.campaigns.find((c) => c.id === sub.campaignId);

    const creator = db.creators.find((c) => c.id === sub.creatorId);
    const creatorUser = creator ? findUserByCreator(db, creator.id) : null;
    if (creatorUser && camp) {
      db.notifications.push({
        id: newId('n'),
        userId: creatorUser.id,
        text: `Your post for ${camp.title} is live`,
        href: `/v2`,
        at: nowIso(),
        read: false,
        meta: { submissionId, campaignId: sub.campaignId },
      });
    }

    // P1c §1.1 — permalink set on an approved submission → 'live'
    // (or stays 'paid' if the payout already cleared on approve).
    // Brand confirmed the post is up, so the brand-user is the actor.
    if (camp) {
      const brandUserForSync = findUserByBrand(db, camp.brandId);
      ensureCollabState(camp.id, sub.creatorId, db, brandUserForSync?.id ?? '', 'marked-live');
    }

    return db.submissions[idx];
  });
  // Phase 5d — mirror the feedback append to Supabase (status + permalink
  // didn't change, but the LIVE: feedback row is what makes the post
  // discoverable in analytics).
  if (result) {
    mirrorSubmissionUpdateToSupabase(submissionId, {
      feedback: result.feedback,
    });
  }
  return result;
}

/**
 * Creator-side counterpart (s18). The creator pastes the live URL on
 * their own approved submission so the brand sees it pre-filled in
 * Mark Live. Pure data write — no stage transition, no notification
 * (the brand is expected to confirm via Mark Live, which DOES advance
 * stage). Pass an empty string to clear.
 *
 * Only allowed on approved submissions: setting a permalink before
 * approval would be premature (content might still be revising).
 */
export function v2SetSubmissionPermalink(
  submissionId: string,
  permalink: string,
): Submission | null {
  const result = tx((db) => {
    // P5 §4.1 — creator-side; the creator owns the URL field.
    requireCapability(getActorUserId(), 'content.setPermalink', db);

    const idx = db.submissions.findIndex((s) => s.id === submissionId);
    if (idx === -1) return null;
    const sub = db.submissions[idx];
    if (sub.status !== 'approved') return sub;
    const trimmed = permalink.trim();
    const wasUnset = !sub.permalink;
    db.submissions[idx] = {
      ...sub,
      permalink: trimmed === '' ? undefined : trimmed,
    };

    // Notify brand when the creator first attaches a URL — gives the
    // brand a clear "ready for Mark Live" signal in the home feed
    // (s19 — was missing). Skip notify when clearing or replacing an
    // existing URL to avoid spam.
    if (wasUnset && trimmed !== '') {
      const camp = db.campaigns.find((c) => c.id === sub.campaignId);
      const brand = camp ? db.brands.find((b) => b.id === camp.brandId) : null;
      const creator = db.creators.find((c) => c.id === sub.creatorId);
      const brandUser = brand ? findUserByBrand(db, brand.id) : null;
      if (brandUser && creator && camp) {
        db.notifications.push({
          id: newId('n'),
          userId: brandUser.id,
          text: `${creator.name} attached the live URL on ${camp.title} — ready to confirm`,
          href: `/v2`,
          at: nowIso(),
          read: false,
          meta: { submissionId, campaignId: sub.campaignId },
        });
      }
    }

    // P1c §1.1 — creator setting the permalink first → 'live'
    // (computeCollabStage detects permalink + approved). Creator-user
    // is actor regardless of whether we notify the brand.
    const creatorUser = findUserByCreator(db, sub.creatorId);
    ensureCollabState(sub.campaignId, sub.creatorId, db, creatorUser?.id ?? '', 'permalink-set');

    return db.submissions[idx];
  });
  // Phase 5d — mirror the URL change to Supabase. `permalink: null` is
  // how the repo encodes "clear it"; map undefined → null at the edge.
  if (result) {
    mirrorSubmissionUpdateToSupabase(submissionId, {
      permalink: result.permalink ?? null,
    });
  }
  return result;
}

// =====================================================================
// Campaign lifecycle: end / archive
// =====================================================================

/**
 * P3 §2.3 — Brand ends a live campaign.
 *
 * Behavior post-P3:
 *   - Iterate Collaborations on the campaign with stage in
 *     {confirmed, submitted}. Each is auto-cancelled via
 *     `__cancelCollabInternal`: per-collab escrow refund,
 *     offer→withdrawn, contract→cancelled, collab.stage→cancelled.
 *   - Approved/live/paid collabs are NOT cancelled — that work is
 *     done; only in-flight commitments unwind.
 *   - Any unallocated escrow on the campaign (rare — would only happen
 *     via direct funding) is refunded to brand wallet.
 *   - Campaign.stage flips to 'closed'.
 *
 * Pre-P3 the function refunded the campaign's bulk escrow without
 * touching individual collabs; that was lossy because per-collab
 * accepted offers stayed 'accepted' even after campaign-end.
 */
export function v2EndCampaign(campaignId: string): Campaign | null {
  const result = tx((db) => {
    // P5 §4.1 — admin/ops only; finance and viewer cannot end campaigns.
    requireCapability(getActorUserId(), 'campaign.end', db);

    const idx = db.campaigns.findIndex((c) => c.id === campaignId);
    if (idx === -1) return null;
    const camp = db.campaigns[idx];
    if (camp.stage === 'closed') return camp;

    const brand = db.brands.find((b) => b.id === camp.brandId);

    // P3 §2.3 — auto-cancel in-flight collabs FIRST, before flipping the
    // campaign stage. Each cancellation pulls its own escrow back to the
    // brand wallet via `__cancelCollabInternal`, so by the time we get
    // to the campaign-level refund below, `camp.escrowHeld` only carries
    // any unallocated amount (typically 0).
    //
    // AUDIT FIX (post-P6) — collabs with `escrowFrozen` (active dispute
    // open) are SKIPPED. Per P2 §1.4 the dispute resolution is the only
    // path that can move that escrow; ending the campaign mid-dispute
    // can't unilaterally release/refund it. The frozen collabs survive
    // the campaign closure and continue to their dispute resolution.
    const inFlightCollabs = db.collaborations.filter(
      (c) =>
        c.campaignId === camp.id &&
        (c.stage === 'confirmed' || c.stage === 'submitted') &&
        !c.escrowFrozen,
    );
    for (const collab of inFlightCollabs) {
      __cancelCollabInternal(db, collab.id, 'campaign-ended', brand?.userId ?? '');
    }
    // For each frozen collab, push a notification so the brand (and the
    // creator) know the campaign closed but their dispute case remains
    // open. The dispute itself isn't touched.
    const frozenCollabs = db.collaborations.filter(
      (c) =>
        c.campaignId === camp.id &&
        c.escrowFrozen &&
        (c.stage === 'confirmed' || c.stage === 'submitted' || c.stage === 'approved'),
    );
    for (const collab of frozenCollabs) {
      const creatorUser = findUserByCreator(db, collab.creatorId);
      if (creatorUser) {
        db.notifications.push({
          id: newId('n'),
          userId: creatorUser.id,
          text: `${brand?.name ?? 'Brand'} closed ${camp.title} but your dispute on this collab remains open — admin will resolve before escrow moves.`,
          href: `/v2`,
          at: nowIso(),
          read: false,
          meta: { campaignId: camp.id, collaborationId: collab.id },
        });
      }
    }

    // Re-read the campaign — auto-cancel mutated `escrowHeld`. The
    // amount left is split into:
    //   - `frozenAllocated` = sum of agreed rates of frozen collabs
    //     (escrow STAYS held until dispute resolution moves it)
    //   - `unallocated` = anything else (typically 0; rare direct
    //     funding shows up here as the brand-recoverable surplus)
    // AUDIT FIX (post-test): pre-fix, `camp.escrowHeld` was unconditionally
    // drained to 0 and the whole amount refunded to the brand. That
    // released frozen-collab money that should have stayed with the
    // dispute. Now we compute `unallocated = escrowHeld - frozenAllocated`
    // and only refund that, leaving the frozen portion in place for
    // the dispute resolution to handle.
    const campAfter = db.campaigns.find((c) => c.id === campaignId);
    const escrowAfter = campAfter?.escrowHeld ?? 0;
    const frozenAllocated = frozenCollabs.reduce((sum, c) => sum + (c.agreedRate ?? 0), 0);
    const refund = Math.max(0, escrowAfter - frozenAllocated);

    db.campaigns = db.campaigns.map((c) =>
      c.id === campaignId
        ? {
            ...c,
            stage: 'closed' as const,
            // Preserve the frozen-collab portion; refund only the surplus.
            escrowHeld: frozenAllocated,
            history: [...c.history, { stage: 'closed' as const, at: nowIso(), by: 'brand' }],
          }
        : c,
    );

    if (brand && refund > 0) {
      db.brands = db.brands.map((b) =>
        b.id === brand.id
          ? {
              ...b,
              walletBalance: b.walletBalance + refund,
              escrowHeld: Math.max(0, b.escrowHeld - refund),
            }
          : b,
      );

      const brandUser = findUserByBrand(db, brand.id);
      if (brandUser) {
        db.transactions.push({
          id: newId('tx'),
          at: nowIso(),
          userId: brandUser.id,
          kind: 'refund',
          amount: refund,
          status: 'cleared',
          campaignId: camp.id,
          note: `Unused escrow refunded — ${camp.title}`,
        });
      }
    }

    // Notify every accepted creator that the campaign closed (s19 — was
    // missing). Critical because creators with pending deliverables
    // need to know the work is no longer expected.
    if (brand) {
      for (const creatorId of getAcceptedCreators(camp.id, db)) {
        const creatorUser = findUserByCreator(db, creatorId);
        if (!creatorUser) continue;
        db.notifications.push({
          id: newId('n'),
          userId: creatorUser.id,
          text: `${brand.name} ended ${camp.title} — any pending deliverables are now closed`,
          href: `/v2`,
          at: nowIso(),
          read: false,
          meta: { campaignId: camp.id },
        });
      }
    }
    return db.campaigns.find((c) => c.id === campaignId) ?? null;
  });
  // Mirror stage + history + escrow to Supabase (Phase 3).
  if (result) {
    mirrorCampaignToSupabase(campaignId, {
      stage: result.stage,
      history: result.history,
      escrowHeld: result.escrowHeld,
    });
  }
  return result;
}

/**
 * Brand pauses a live campaign — stage moves to 'draft' (paused).
 * Resume by calling v2ResumeCampaign. Notifies anyone with a pending
 * application or active offer (s19 — was missing).
 */
export function v2PauseCampaign(campaignId: string): Campaign | null {
  const result = tx((db) => {
    // P5 §4.1 — admin/ops only.
    requireCapability(getActorUserId(), 'campaign.pause', db);

    const idx = db.campaigns.findIndex((c) => c.id === campaignId);
    if (idx === -1) return null;
    const camp = db.campaigns[idx];
    // P1b §1.2: only live campaigns can be paused. Pause moves to the
    // dedicated 'paused' stage (added in P1b) — was 'draft' before.
    if (camp.stage !== 'live') return camp;
    db.campaigns[idx] = {
      ...camp,
      stage: 'paused',
      history: [...camp.history, { stage: 'paused', at: nowIso(), by: 'brand' }],
    };

    const brand = db.brands.find((b) => b.id === camp.brandId);
    if (brand) {
      // Walking applications + offers covers everyone the duplicate
      // acceptedCreators/shortlist sets used to encode (P1a removal).
      const interestedCreatorIds = new Set<string>([
        ...db.applications.filter((a) => a.campaignId === camp.id).map((a) => a.creatorId),
        ...db.offers.filter((o) => o.campaignId === camp.id).map((o) => o.creatorId),
      ]);
      for (const creatorId of interestedCreatorIds) {
        const creatorUser = findUserByCreator(db, creatorId);
        if (!creatorUser) continue;
        db.notifications.push({
          id: newId('n'),
          userId: creatorUser.id,
          text: `${brand.name} paused ${camp.title} — work is on hold until they resume`,
          href: `/v2`,
          at: nowIso(),
          read: false,
          meta: { campaignId: camp.id },
        });
      }
    }
    return db.campaigns[idx];
  });
  // Mirror stage + history to Supabase (Phase 3).
  if (result) mirrorCampaignToSupabase(campaignId, { stage: result.stage, history: result.history });
  return result;
}

export function v2ResumeCampaign(campaignId: string): Campaign | null {
  const result = tx((db) => {
    // P5 §4.1 — same gate as pause.
    requireCapability(getActorUserId(), 'campaign.pause', db);

    const idx = db.campaigns.findIndex((c) => c.id === campaignId);
    if (idx === -1) return null;
    const camp = db.campaigns[idx];
    // P1b §1.2: only paused campaigns can be resumed.
    if (camp.stage !== 'paused') return camp;
    db.campaigns[idx] = {
      ...camp,
      stage: 'live',
      history: [...camp.history, { stage: 'live', at: nowIso(), by: 'brand' }],
    };

    // Symmetric to pause — same set of interested creators get a heads-up
    // that the campaign is moving again (s19 — was missing).
    const brand = db.brands.find((b) => b.id === camp.brandId);
    if (brand) {
      const interestedCreatorIds = new Set<string>([
        ...db.applications.filter((a) => a.campaignId === camp.id).map((a) => a.creatorId),
        ...db.offers.filter((o) => o.campaignId === camp.id).map((o) => o.creatorId),
      ]);
      for (const creatorId of interestedCreatorIds) {
        const creatorUser = findUserByCreator(db, creatorId);
        if (!creatorUser) continue;
        db.notifications.push({
          id: newId('n'),
          userId: creatorUser.id,
          text: `${brand.name} resumed ${camp.title} — back in motion`,
          href: `/v2`,
          at: nowIso(),
          read: false,
          meta: { campaignId: camp.id },
        });
      }
    }
    return db.campaigns[idx];
  });
  // Mirror stage + history to Supabase (Phase 3).
  if (result) mirrorCampaignToSupabase(campaignId, { stage: result.stage, history: result.history });
  return result;
}

// =====================================================================
// Reviews
// =====================================================================

/**
 * Either party leaves a review after the campaign closes.
 */
export function v2LeaveReview(input: {
  campaignId: string;
  fromUserId: string;
  reviewType: 'creator' | 'brand';
  targetId: string;
  rating: number;
  text: string;
}) {
  const result = tx((db) => {
    // P5 §4.1 — both creator and brand teams can write reviews on
    // their own campaigns. Brand-side ops/admin and creator default
    // both have `review.write`.
    requireCapability(getActorUserId(), 'review.write', db);

    const review: import('@/lib/api/types').Review = {
      id: newId('rev'),
      campaignId: input.campaignId,
      fromUserId: input.fromUserId,
      reviewType: input.reviewType,
      targetId: input.targetId,
      rating: input.rating,
      text: input.text,
      at: nowIso(),
    };
    db.reviews.push(review);

    // Notify the reviewed party (s19 — was missing). Reviews go both
    // ways: brand → creator and creator → brand. Resolve the recipient
    // user by reviewType + targetId.
    const camp = db.campaigns.find((c) => c.id === input.campaignId);
    const fromUser = db.users.find((u) => u.id === input.fromUserId);
    let toUserId: string | null = null;
    let fromName = 'Someone';
    if (input.reviewType === 'creator') {
      // Brand reviewed the creator → notify the creator
      const creatorUser = findUserByCreator(db, input.targetId);
      toUserId = creatorUser?.id ?? null;
      const brand = fromUser?.brandId ? db.brands.find((b) => b.id === fromUser.brandId) : null;
      fromName = brand?.name ?? 'A brand';
    } else {
      // Creator reviewed the brand → notify the brand owner
      const brand = db.brands.find((b) => b.id === input.targetId);
      const brandUser = brand ? findUserByBrand(db, brand.id) : null;
      toUserId = brandUser?.id ?? null;
      const creator = fromUser?.creatorId ? db.creators.find((c) => c.id === fromUser.creatorId) : null;
      fromName = creator?.name ?? 'A creator';
    }
    if (toUserId && camp) {
      db.notifications.push({
        id: newId('n'),
        userId: toUserId,
        text: `${fromName} left a ${input.rating}★ review on ${camp.title}`,
        href: `/v2`,
        at: nowIso(),
        read: false,
        meta: { campaignId: input.campaignId },
      });
    }
    return review;
  });
  if (result) mirrorReviewInsertToSupabase(result);
  return result;
}

// =====================================================================
// Helper for v2 surfaces — get the latest active offer for a collab
// =====================================================================

export function getActiveOfferFor(campaignId: string, creatorId: string) {
  const db = useStore.getState().db;
  return db.offers
    .filter((o) => o.campaignId === campaignId && o.creatorId === creatorId)
    .sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime())[0];
}

export function getApplicationFor(campaignId: string, creatorId: string) {
  const db = useStore.getState().db;
  return db.applications
    .filter((a) => a.campaignId === campaignId && a.creatorId === creatorId)
    .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime())[0];
}

export function getLatestSubmissionFor(campaignId: string, creatorId: string) {
  const db = useStore.getState().db;
  return db.submissions
    .filter((s) => s.campaignId === campaignId && s.creatorId === creatorId)
    .sort((a, b) => b.round - a.round)[0];
}

// =====================================================================
// Launch Campaign (brand-side) — kept at the bottom for grouping with
// the original wizard mutation.
// =====================================================================

/**
 * Brand launches a new campaign from the wizard. Inserts a Campaign
 * with stage='live' so creators can apply / be invited. Reserves no
 * funds yet — funds reserve as offers get accepted.
 */
export function v2LaunchCampaign(input: LaunchCampaignInput): Campaign | null {
  const result = tx((db) => {
    // P5 §4.1 — admin/ops only; finance + viewer cannot create campaigns.
    requireCapability(getActorUserId(), 'campaign.create', db);

    const brandUser = useStore.getState().session
      ? db.users.find((u) => u.id === useStore.getState().session!.userId)
      : null;
    const brand = brandUser?.brandId
      ? db.brands.find((b) => b.id === brandUser.brandId)
      : db.brands.find((b) => b.userId === 'u_hannah');
    if (!brand) return null;

    const id = newId('cmp');
    const camp: Campaign = {
      id,
      brandId: brand.id,
      title: input.name || 'Untitled campaign',
      pitch: input.brief.slice(0, 200),
      brief: input.brief,
      cover: `https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=800&h=600&fit=crop`,
      budget: input.budget,
      spent: 0,
      escrowHeld: 0,
      region: input.audienceCity.join(', ') || 'Pakistan',
      category: input.categories[0] ?? 'Lifestyle',
      stage: 'live',
      // P1d §1.5 — `placement` is the wizard's free-form deliverables
      // string; we promote it to `deliverablesText` and materialize
      // structured Deliverable rows below so new campaigns ship with
      // the post-P1d shape (no migrator pass needed for fresh data).
      deliverablesText: input.placement,
      deliverableIds: [],
      deadline: input.deadline,
      createdAt: nowIso(),
      history: [{ stage: 'live', at: nowIso(), by: brand.userId }],
      milestones: [],
      applications: [],
      offers: [],
    };
    db.campaigns.push(camp);

    // P1d §1.5 — materialize structured Deliverable rows from the
    // free-form placement string immediately, so submissions can attach
    // by `deliverableId` without waiting for migrator 4 to fire on the
    // next hydrate.
    camp.deliverableIds = materializeDeliverablesForCampaign(id, input.placement, db);

    // For each invited creator, also create a pending offer with the
    // suggested per-creator rate, so they show up in the kanban with
    // negotiating status from the start.
    for (const creatorId of input.invitedCreators) {
      const offerSentAt = nowIso();
      const offerMessage = `Invited to ${camp.title} — please review the brief.`;
      const offer: Offer = {
        id: newId('off'),
        campaignId: id,
        creatorId,
        rate: input.perCreator,
        message: offerMessage,
        status: 'pending',
        sentAt: offerSentAt,
        // P1b §1.7 — invite-flow offer; no prior application.
        applicationId: null,
        source: 'invite',
        // P3 §2.1 — initial brand round.
        rounds: [
          { by: 'brand', at: +new Date(offerSentAt), rate: input.perCreator, message: offerMessage },
        ],
      };
      db.offers.push(offer);
      camp.offers.push(offer.id);

      // Notify each invited creator
      const creator = db.creators.find((c) => c.id === creatorId);
      const creatorUser = creator ? findUserByCreator(db, creator.id) : null;
      if (creator && creatorUser) {
        db.notifications.push({
          id: newId('n'),
          userId: creatorUser.id,
          text: `${brand.name} invited you to ${camp.title}`,
          href: `/v2`,
          at: nowIso(),
          read: false,
          meta: { campaignId: camp.id, offerId: offer.id },
        });
      }

      // P1c §1.1 — invite-flow offer creates a Collaboration in
      // 'negotiating' (offer.status='pending' + source='invite').
      // Brand owner is the actor (they launched the campaign with invites).
      ensureCollabState(camp.id, creatorId, db, brand.userId, 'launch-invite');
    }

    return camp;
  });
  // Mirror the new row to Supabase (Phase 3). INSERT-only path —
  // updateCampaignInSupabase won't work because the row doesn't
  // exist yet. Falls through silently when Supabase isn't configured.
  // Phase 4 — also mirror any invite-flow offers created inline so
  // the negotiation kanban reads from Postgres immediately.
  if (result && isSupabaseConfigured()) {
    void (async () => {
      try {
        const { insertCampaignInSupabase } = await import('@/lib/data/campaignsRepo');
        await insertCampaignInSupabase(result);
        // Phase 4 — mirror invite-flow offers. These were pushed into
        // db.offers inside the tx block; result.offers carries their IDs.
        if (result.offers.length > 0) {
          const db = useStore.getState().db;
          const newOffers = db.offers.filter((o) => result.offers.includes(o.id));
          for (const o of newOffers) mirrorOfferInsertToSupabase(o);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        // eslint-disable-next-line no-console
        console.warn('[v2LaunchCampaign] Supabase insert failed:', msg);
      }
    })();
  }
  return result;
}

/**
 * Update editable brand-profile fields (name, industry, hq, website,
 * about, logoMark, preferred categories/regions). Powered by the
 * `BrandProfile` settings screen so brands can configure how they
 * appear to creators in Discover, on the brief, and inside the
 * inbox / collab side panel. Requires `campaign.update` (admin/ops
 * on the brand team — same gate as editing any brand-owned record).
 */
// Phase 2 — Supabase is now the source of truth for brand rows that
// have been migrated (Aesop, Le Creuset). When configured, writes hit
// Supabase first (RLS gates by `auth.email() = owner_email`), then
// mirror to the local Zustand store so the rest of the app — which
// still reads from the store — sees the update immediately. For
// brands that don't exist in Supabase yet (the ~78 generated b_gb*
// rows), the Supabase write returns "not found" and we silently fall
// through to a local-only write, preserving the demo experience.
export async function v2UpdateBrand(
  brandId: string,
  patch: Partial<Pick<Brand, 'name' | 'industry' | 'hq' | 'website' | 'about' | 'logoMark' | 'logoUrl' | 'preferredCategories' | 'preferredRegions'>>,
): Promise<Brand | null> {
  // 1. Try the Supabase write first. Anything else (RLS rejection,
  //    network error) we surface — the caller's UI will show the
  //    failure toast. Only "row not in Supabase yet" falls through
  //    silently so generated demo brands stay editable in-store.
  let serverResult: Brand | null = null;
  if (isSupabaseConfigured()) {
    try {
      const { updateBrandInSupabase } = await import('@/lib/data/brandsRepo');
      serverResult = await updateBrandInSupabase(brandId, patch);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // PostgREST shapes "no rows updated" as a generic error; we
      // detect it via the message text and the count check below.
      if (!/no rows|0 rows|not found|JSON object requested/i.test(msg)) {
        throw err;
      }
      // Otherwise: brand isn't in Supabase yet — local-only write.
    }
  }

  // 2. Mirror the change into the local store. With serverResult set,
  //    use the canonical server row; otherwise apply the patch onto
  //    the local row directly.
  return tx((db) => {
    requireCapability(getActorUserId(), 'campaign.update', db);
    const idx = db.brands.findIndex((b) => b.id === brandId);
    if (idx === -1) return null;
    const current = db.brands[idx];
    const next: Brand = serverResult ?? {
      ...current,
      ...patch,
      // Keep array fields as immutable copies so no caller can mutate
      // the live store array by accident.
      preferredCategories: patch.preferredCategories ? [...patch.preferredCategories] : current.preferredCategories,
      preferredRegions: patch.preferredRegions ? [...patch.preferredRegions] : current.preferredRegions,
    };
    db.brands[idx] = next;
    return next;
  });
}
