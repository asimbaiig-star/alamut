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

/** Stale-version detection — translates a thrown StaleVersionError
 *  (from migration 020 optimistic-lock writes) into a boolean the
 *  fire-and-forget mirrors can branch on. Async because the helper
 *  module is dynamic-imported to keep the v2 actions bundle lean. */
async function isStaleVersion(err: unknown): Promise<boolean> {
  if (!(err instanceof Error)) return false;
  if (err.name !== 'StaleVersionError') return false;
  // Defensive runtime check — we don't want a stale class shape from
  // a stale module to false-positive other errors.
  const { StaleVersionError } = await import('@/lib/data/optimisticLock');
  return err instanceof StaleVersionError;
}

/** Single toast helper so every mirror surfaces the same recoverable
 *  copy on a stale-version write. The next read pulls canonical state
 *  from Postgres + storage-event sync rolls it into the local store. */
function toastStaleVersion(entity: string): void {
  void (async () => {
    const { pushToast } = await import('@/lib/utils/toast');
    pushToast(
      `Couldn't save ${entity} — another tab updated it. Refresh to see the latest.`,
      'bad',
    );
  })();
}

/** Write the post-UPDATE version (returned by the repo) back to the
 *  local store so the NEXT mirror call passes the right expectedVersion.
 *  Without this, the local store's `version` would freeze at the
 *  hydration-time value and every subsequent mutation would race-fail
 *  because we'd send a stale expectedVersion to Postgres.
 *
 *  Updates the matching row by id; no-op if the row was deleted
 *  between mirror dispatch and writeback. Doesn't trigger any
 *  downstream effect (it's a synthetic local-only field bump). */
type VersionableTable = 'campaigns' | 'offers' | 'applications' | 'submissions' | 'disputes';
function writeBackVersion(table: VersionableTable, id: string, version: number): void {
  // Use setState directly rather than going through tx() — we don't
  // want this to count as a tx-diffable transaction event (which would
  // re-trigger mirror loops). Same shape as the cross-tab `storage`
  // event sync, which also bypasses tx().
  useStore.setState((s) => {
    const rows = s.db[table];
    if (!Array.isArray(rows)) return s;
    const idx = rows.findIndex((r: { id: string }) => r.id === id);
    if (idx === -1) return s;
    const current = rows[idx];
    // Skip if already up to date (idempotent — handles double-call from
    // multi-mirror-per-mutation tx patterns).
    if (current.version === version) return s;
    const next = rows.slice();
    next[idx] = { ...current, version };
    return { ...s, db: { ...s.db, [table]: next } };
  });
}

/** Fire-and-forget Supabase mirror for a campaign UPDATE. Local
 *  state has already been updated; this hands off the same change
 *  to Postgres. Failures are logged but never propagate. */
function mirrorCampaignToSupabase(
  campaignId: string,
  patch: Parameters<typeof import('@/lib/data/campaignsRepo').updateCampaignInSupabase>[1],
): void {
  if (!isSupabaseConfigured()) return;
  // Read version off the just-committed local state. The local tx
  // doesn't mutate `version` (only the writeBackVersion helper or a
  // server fetch does), so this is the version we believe Postgres
  // currently holds. Pass as expectedVersion to the optimistic-lock
  // UPDATE; if it's stale we get StaleVersionError + toast below.
  const expectedVersion = useStore.getState().db.campaigns
    .find((c) => c.id === campaignId)?.version;
  void (async () => {
    try {
      const { updateCampaignInSupabase } = await import('@/lib/data/campaignsRepo');
      const updated = await updateCampaignInSupabase(campaignId, patch, expectedVersion);
      // Write the new version back to local store so the next mirror
      // call passes the right expectedVersion. Without this, every
      // subsequent UPDATE would race-fail because we'd still send the
      // pre-mutation version while Postgres has already bumped.
      if (typeof updated.version === 'number') {
        writeBackVersion('campaigns', campaignId, updated.version);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (isNotFoundError(msg)) return;
      // Stale-version conflict (migration 020) — another writer
      // updated this row while we were buffering the mirror. Toast
      // the user; the next read will pull canonical state.
      if (await isStaleVersion(err)) {
        toastStaleVersion('campaign');
        return;
      }
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
  const expectedVersion = useStore.getState().db.offers
    .find((o) => o.id === offerId)?.version;
  void (async () => {
    try {
      const { updateOfferInSupabase } = await import('@/lib/data/offersRepo');
      const updated = await updateOfferInSupabase(offerId, patch, expectedVersion);
      if (typeof updated.version === 'number') {
        writeBackVersion('offers', offerId, updated.version);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (isNotFoundError(msg)) return;
      if (await isStaleVersion(err)) {
        toastStaleVersion('offer');
        return;
      }
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
  const expectedVersion = useStore.getState().db.applications
    .find((a) => a.id === applicationId)?.version;
  void (async () => {
    try {
      const { updateApplicationInSupabase } = await import('@/lib/data/applicationsRepo');
      const updated = await updateApplicationInSupabase(applicationId, patch, expectedVersion);
      if (typeof updated.version === 'number') {
        writeBackVersion('applications', applicationId, updated.version);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (isNotFoundError(msg)) return;
      if (await isStaleVersion(err)) {
        toastStaleVersion('application');
        return;
      }
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
  const expectedVersion = useStore.getState().db.submissions
    .find((s) => s.id === submissionId)?.version;
  void (async () => {
    try {
      const { updateSubmissionInSupabase } = await import('@/lib/data/submissionsRepo');
      const updated = await updateSubmissionInSupabase(submissionId, patch, expectedVersion);
      if (typeof updated.version === 'number') {
        writeBackVersion('submissions', submissionId, updated.version);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (isNotFoundError(msg) || /row-level security/i.test(msg)) return;
      if (await isStaleVersion(err)) {
        toastStaleVersion('submission');
        return;
      }
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

    // STAGE GATE — only live campaigns accept new applications.
    // Pre-fix a creator could apply to a draft / paused / closed
    // campaign by calling this mutation directly from BriefDetail
    // (which had no UI gate), materializing a Collaboration row on
    // a campaign that's no longer accepting work.
    if (camp.stage !== 'live') return null;

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

    // CAMPAIGN-STAGE GATE — only live campaigns send new offers.
    // Paused / draft / closed all refuse so brands don't accidentally
    // commit wallet against a campaign they paused or never published.
    if (camp.stage !== 'live') return null;

    // IDEMPOTENCY / DUPE-OFFER GUARD — refuse if there's already a
    // live offer for this (campaign, creator) pair. Pre-fix a brand
    // could send a second offer while the first was still pending,
    // creating two parallel negotiations on the same deal. The brand
    // can withdraw the existing offer first if they want to re-pitch.
    const liveOffer = db.offers.find((o) =>
      o.campaignId === campaignId &&
      o.creatorId === creatorId &&
      (o.status === 'pending' || o.status === 'countered' || o.status === 'accepted'),
    );
    if (liveOffer) return liveOffer;

    // BUDGET CAP — pre-fix a brand could send unlimited offers each at
    // rate > camp.budget; two creators accepting at full budget was
    // fully allowed. Reject sends that would push committed-spend
    // (existing pending+accepted offers + this rate) above the budget.
    // Closed/declined/withdrawn/expired offers don't count.
    const committed = db.offers
      .filter((o) =>
        o.campaignId === campaignId &&
        (o.status === 'pending' || o.status === 'countered' || o.status === 'accepted'),
      )
      .reduce((sum, o) => sum + o.rate, 0);
    if (committed + rate > camp.budget) return null;

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
export function v2AcceptOffer(offerId: string): Offer {
  // P62 — was `Offer | null` with 4 silent failure paths (3× return null,
  // 2× return-the-unchanged-offer). The only caller (CollabDetail) fired
  // and forgot, so a no-op accept (campaign paused, brand short on funds,
  // offer already declined) left the creator clicking with nothing visible
  // happening. Now: throw on every can't-happen with a specific reason;
  // re-clicking on an already-accepted offer is treated as idempotent
  // success (returns the unchanged accepted offer).
  const result = tx((db) => {
    // P5 §4.1 — accept is a creator-side action (creators have
    // `offer.counter` which covers accept/decline/counter on their
    // own offers).
    requireCapability(getActorUserId(), 'offer.counter', db);

    const offerIdx = db.offers.findIndex((o) => o.id === offerId);
    if (offerIdx === -1) throw new Error("Couldn't find that offer — it may have been withdrawn. Refresh the page.");
    const offer = db.offers[offerIdx];
    // Idempotent: if it's already accepted, that's what the user wanted.
    if (offer.status === 'accepted') return offer;
    if (offer.status === 'declined') throw new Error('This offer was already declined. Ask the brand to re-send if you changed your mind.');
    if (offer.status === 'withdrawn') throw new Error('The brand withdrew this offer.');
    if (offer.status === 'expired')  throw new Error('This offer expired. Ask the brand to re-send if you\'re still interested.');
    // Only pending + countered are acceptable at this point.

    const camp = db.campaigns.find((c) => c.id === offer.campaignId);
    const brand = camp ? db.brands.find((b) => b.id === camp.brandId) : undefined;
    const creator = db.creators.find((c) => c.id === offer.creatorId);
    if (!camp) throw new Error("Couldn't find the campaign for this offer. Refresh and try again.");
    if (!brand) throw new Error("Couldn't find the brand on this offer. Refresh and try again.");
    if (!creator) throw new Error("Couldn't find your creator profile. Sign out and back in, then try again.");

    // CAMPAIGN-STAGE GATE — pause / closed campaigns don't accept
    // commitments. The offer stays in its current status; the creator
    // can accept once the brand resumes the campaign.
    if (camp.stage !== 'live') {
      throw new Error(`This campaign is ${camp.stage} — you can accept once the brand reopens it. Message them to nudge.`);
    }

    // FUNDS GUARD — pre-fix this used Math.max(0, walletBalance - rate)
    // which silently clamped underfunded brands to a $0 wallet while
    // crediting the creator's pendingBalance + brand's escrowHeld with
    // the FULL rate. The creator could then withdraw real cash that
    // was never funded by the brand. Refuse the accept instead so the
    // creator sees an error and the brand has to top up first.
    if (brand.walletBalance < offer.rate) {
      throw new Error(`${brand.name}'s wallet is short on funds for this offer. They need to top up before you can accept.`);
    }

    db.offers[offerIdx] = { ...offer, status: 'accepted', respondedAt: nowIso() };

    // Reserve funds: brand wallet -> escrow (full debit; guarded above).
    db.brands = db.brands.map((b) =>
      b.id === brand.id
        ? {
            ...b,
            walletBalance: b.walletBalance - offer.rate,
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
  /** Pre-fix this was just `fileName: string`, with the actual bytes
   *  dropped on the floor and the URL persisted as the placeholder '#'.
   *  Now an object with the real (data-URL or Storage URL) so the brand
   *  can preview the file in the review modal. Backwards-compat: a bare
   *  string is treated as just the filename with no URL. */
  fileMeta: string | { name: string; url: string; mime?: string; size?: number },
  deliverableId: string,
): Submission {
  // P60.1 — was `Submission | null` with 5 silent failure paths. The only
  // caller (ContentUploadModal) didn't check the return, so a returned-null
  // failure showed a "Submitted!" success screen while the submission was
  // dropped on the floor. Now: throw on every failure with a specific
  // message; the modal's existing try/catch surfaces it as a toast.
  const fileObj = typeof fileMeta === 'string'
    ? { name: fileMeta, url: '' }
    : fileMeta;
  const result = tx((db) => {
    // P5 §4.1 — creator-side capability. Throws PermissionError on miss.
    requireCapability(getActorUserId(), 'content.submit', db);

    const camp = db.campaigns.find((c) => c.id === campaignId);
    if (!camp) throw new Error("Couldn't find that campaign — it may have been deleted. Refresh and try again.");
    const creator = db.creators.find((c) => c.id === creatorId);
    if (!creator) throw new Error("Couldn't find your creator profile. Sign out and back in, then try again.");

    // OFFER GATE — submissions are only allowed for creators with an
    // accepted offer on this campaign. Pre-fix anyone holding the
    // `content.submit` capability could post a submission against a
    // campaign they only applied to (or never touched). v2ApproveContent
    // would then pay them via a `camp.budget / acceptedCreatorCount`
    // fallback, draining escrow on unrelated parties.
    const hasAcceptedOffer = db.offers.some(
      (o) => o.campaignId === campaignId && o.creatorId === creatorId && o.status === 'accepted',
    );
    if (!hasAcceptedOffer) {
      throw new Error('You need an accepted offer on this campaign before you can submit work. Check the offer status in your inbox.');
    }

    // CAMPAIGN-STAGE GATE — paused / closed / draft campaigns don't
    // accept new work. Only `live` is active.
    if (camp.stage !== 'live') {
      throw new Error(`This campaign is ${camp.stage} — only live campaigns accept submissions. Message the brand if you think this is a mistake.`);
    }

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
      files: [fileObj],
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

export function v2ApproveContent(submissionId: string): Submission {
  // P62 — was `Submission | null` with 5 silent failure paths (3× return
  // null, 3× return the unchanged submission). The brand-side approve UX
  // (ContentReviewModal + CampaignDetail's "Approve all") fired these
  // without checking the return — so an approve against a paused
  // campaign or a disputed collab silently no-oped and the brand
  // wondered why the submission stayed `in_review`.
  const result = tx((db) => {
    // P5 §4.1 — brand-side `content.approve` (admin/ops).
    requireCapability(getActorUserId(), 'content.approve', db);

    const subIdx = db.submissions.findIndex((s) => s.id === submissionId);
    if (subIdx === -1) throw new Error("Couldn't find that submission — it may have been deleted. Refresh and try again.");
    const sub = db.submissions[subIdx];
    // Idempotent: already-approved is what the user wanted.
    if (sub.status === 'approved') return sub;

    const camp = db.campaigns.find((c) => c.id === sub.campaignId);
    const creator = db.creators.find((c) => c.id === sub.creatorId);
    const brand = camp ? db.brands.find((b) => b.id === camp.brandId) : undefined;
    if (!camp) throw new Error("Couldn't find the campaign for this submission. Refresh and try again.");
    if (!creator) throw new Error("Couldn't find the creator for this submission. Refresh and try again.");
    if (!brand) throw new Error("Couldn't find your brand profile. Sign out and back in, then try again.");

    // CAMPAIGN-STAGE GATE — paused / closed campaigns don't release
    // escrow. The submission stays in_review; brand must resume the
    // campaign before approving. (closed never resumes; that's an
    // explicit terminal state the brand chose.)
    if (camp.stage !== 'live') {
      throw new Error(`This campaign is ${camp.stage} — resume it before approving submissions. The creator stays in review until then.`);
    }

    // P2 §1.4 — block approval if there's an open dispute on this collab.
    // The Collaboration's `escrowFrozen` flag is set when a dispute is
    // raised (and cleared on resolve / withdraw).
    const collab = db.collaborations.find(
      (c) => c.campaignId === sub.campaignId && c.creatorId === sub.creatorId,
    );
    if (collab?.escrowFrozen) {
      throw new Error('Escrow is frozen on this collab — there\'s an open dispute. Resolve or withdraw it before approving.');
    }

    // Find the agreed offer rate (latest accepted offer).
    //
    // PRE-FIX FALLBACK REMOVED — the code previously defaulted to
    // `camp.budget / acceptedCreatorCount` when no accepted offer
    // existed (a race could happen if the offer was withdrawn between
    // submit and approve). That fallback could pay a creator a random
    // share of the campaign budget — drainage of escrow on unrelated
    // parties. The v2SubmitContent stage-gate I added earlier already
    // requires an accepted offer before any submission exists, but the
    // defense-in-depth check stays here: if for any reason we can't
    // find the accepted offer at approve-time, refuse the release.
    const acceptedOffer = db.offers
      .filter((o) => o.campaignId === sub.campaignId && o.creatorId === sub.creatorId && o.status === 'accepted')
      .sort((a, b) => new Date(b.respondedAt ?? b.sentAt).getTime() - new Date(a.respondedAt ?? a.sentAt).getTime())[0];
    if (!acceptedOffer) {
      // No accepted offer = no rate to release against. This should be
      // impossible (v2SubmitContent's offer gate blocks submission without
      // an accepted offer) but guard anyway — releasing without a rate
      // would drain escrow on an arbitrary share of the campaign budget.
      throw new Error("Can't release escrow — no accepted offer found for this creator on this campaign. Check the offer status before approving.");
    }
    const gross = acceptedOffer.rate;
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
 *
 * Revision cap: a single submission cannot be revised more than
 * MAX_REVISIONS times. Each successful `v2RequestRevision` appends one
 * brand-from feedback entry, so we count those to enforce. Pre-fix the
 * brand could grind a creator through unlimited revision cycles on the
 * same escrow.
 */
const MAX_REVISIONS = 3;

export function v2RequestRevision(submissionId: string, note: string): Submission {
  // P63 — was `Submission | null` with silent returns on every guard. Caller
  // (ContentReviewModal) didn't differentiate the no-op cases.
  const result = tx((db) => {
    // P5 §4.1 — same role set as content.approve; the brand team that
    // can approve content can also send it back for revision.
    requireCapability(getActorUserId(), 'content.revise', db);

    const subIdx = db.submissions.findIndex((s) => s.id === submissionId);
    if (subIdx === -1) throw new Error("Couldn't find that submission — it may have been deleted. Refresh and try again.");
    const sub = db.submissions[subIdx];
    const camp = db.campaigns.find((c) => c.id === sub.campaignId);
    if (!camp) throw new Error("Couldn't find the campaign for this submission. Refresh and try again.");
    // CAMPAIGN-STAGE GATE — paused / closed campaigns can't request
    // new revisions. Submission stays in its current state.
    if (camp.stage !== 'live') {
      throw new Error(`This campaign is ${camp.stage} — resume it before requesting revisions.`);
    }
    const brandUser = findUserByBrand(db, camp.brandId);
    // REVISION CAP — count prior brand feedback entries on this
    // submission. brandUser.id may be unstable across team members,
    // so we count "non-creator from" instead — every revision request
    // emits a feedback entry where `from` is a brand-team user id.
    const creatorUserForCount = findUserByCreator(db, sub.creatorId);
    const priorRevisions = sub.feedback.filter(
      (f) => f.from !== creatorUserForCount?.id,
    ).length;
    if (priorRevisions >= MAX_REVISIONS) {
      throw new Error(`This submission has already had ${MAX_REVISIONS} revision rounds — the cap. Approve, reject, or open a dispute instead.`);
    }
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
export function v2DeclineOffer(offerId: string, reason?: string): Offer {
  // P62 — was `Offer | null`. Caller (WorkflowModals) didn't check the
  // return, so declining an already-accepted/expired offer silently
  // returned the unchanged offer and the brand never saw a notification.
  // Now: throw on impossible transitions; idempotent on already-declined.
  const result = tx((db) => {
    // P5 §4.1 — creator action; same capability as counter.
    requireCapability(getActorUserId(), 'offer.counter', db);

    const idx = db.offers.findIndex((o) => o.id === offerId);
    if (idx === -1) throw new Error("Couldn't find that offer — it may have been withdrawn. Refresh the page.");
    const offer = db.offers[idx];
    // Terminal-state guards. Idempotent on declined; the rest are
    // user-visible errors so the creator knows why the action no-oped.
    if (offer.status === 'declined') return offer; // already what they wanted
    if (offer.status === 'accepted') throw new Error('This offer was already accepted — you can\'t decline it now. Open a dispute instead if you need to back out.');
    if (offer.status === 'expired')  throw new Error('This offer already expired — nothing to decline.');
    if (offer.status === 'withdrawn') throw new Error('The brand withdrew this offer — nothing to decline.');

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
export function v2CounterOffer(offerId: string, rate: number, message: string): Offer {
  // P62 — was `Offer | null`. Five silent failure paths swallowed
  // counter-invalid inputs without any signal to the caller.
  const result = tx((db) => {
    // P5 §4.1 — creator-side counter.
    requireCapability(getActorUserId(), 'offer.counter', db);

    const idx = db.offers.findIndex((o) => o.id === offerId);
    if (idx === -1) throw new Error("Couldn't find that offer — it may have been withdrawn. Refresh the page.");
    const offer = db.offers[idx];
    if (offer.status === 'accepted') throw new Error('This offer was already accepted — no more counters.');
    if (offer.status === 'declined') throw new Error('This offer was already declined — nothing to counter.');
    if (offer.status === 'expired')  throw new Error('This offer expired — ask the brand to send a fresh one.');
    if (offer.status === 'withdrawn') throw new Error('The brand withdrew this offer — nothing to counter.');
    // Creator can only counter when the latest round was a brand round.
    const lastRound = offer.rounds[offer.rounds.length - 1];
    if (lastRound && lastRound.by === 'creator') {
      throw new Error("You already sent a counter — waiting on the brand's response.");
    }

    // RATE SANITY BOUND — pre-fix a creator could counter $1M on a $500
    // offer with no warning. The brand would see the absolute number
    // with no context. 10x of the original (round 0) rate is generous
    // enough for legitimate scope-correction counters but rejects
    // typos / abuse. Original rate is offer.rounds[0].rate (always the
    // brand's initial send).
    const originalRate = offer.rounds[0]?.rate ?? offer.rate;
    if (rate <= 0) throw new Error('Counter rate must be greater than $0.');
    if (rate > originalRate * 10) {
      throw new Error(`Counter rate $${rate.toLocaleString()} is more than 10× the original $${originalRate.toLocaleString()} — typo? Bring it down to retry.`);
    }

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
      // Notify BOTH sides so the cap-exceeded state isn't silent.
      // Pre-fix the brand had no signal when an invite-flow offer
      // expired due to too many counters; the creator just stopped
      // hearing back and the brand never knew they could re-engage.
      const campNotify = db.campaigns.find((c) => c.id === offer.campaignId);
      const creatorNotify = db.creators.find((c) => c.id === offer.creatorId);
      const brandUserCap = campNotify ? findUserByBrand(db, campNotify.brandId) : null;
      const creatorUserCap = creatorNotify ? findUserByCreator(db, creatorNotify.id) : null;
      if (brandUserCap && campNotify && creatorNotify) {
        db.notifications.push({
          id: newId('n'),
          userId: brandUserCap.id,
          text: offer.applicationId
            ? `Negotiation with ${creatorNotify.name} hit the counter cap on ${campNotify.title}. Their application is open — re-engage with a fresh offer if you still want them.`
            : `Outreach to ${creatorNotify.name} hit the counter cap on ${campNotify.title}. No pending application — send a new invite if you want to re-engage.`,
          href: `/v2`,
          at: nowIso(),
          read: false,
          meta: { campaignId: campNotify.id, offerId: offer.id },
        });
      }
      if (creatorUserCap && campNotify) {
        db.notifications.push({
          id: newId('n'),
          userId: creatorUserCap.id,
          text: `Offer on ${campNotify.title} closed — too many counters. The brand can re-send if they want to continue.`,
          href: `/v2`,
          at: nowIso(),
          read: false,
          meta: { campaignId: campNotify.id, offerId: offer.id },
        });
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
export function v2CounterCounter(offerId: string, rate: number, message: string): Offer {
  // P63 — symmetric to v2CounterOffer P62 refactor.
  const result = tx((db) => {
    // P5 §4.1 — brand-side counter-back; admin/ops only.
    requireCapability(getActorUserId(), 'offer.send', db);

    const idx = db.offers.findIndex((o) => o.id === offerId);
    if (idx === -1) throw new Error("Couldn't find that offer — it may have been withdrawn. Refresh the page.");
    const offer = db.offers[idx];
    if (offer.status === 'accepted') throw new Error('This offer was already accepted — no more counters.');
    if (offer.status === 'declined') throw new Error('The creator declined this offer — nothing to counter back.');
    if (offer.status === 'expired')  throw new Error('This offer expired — send a fresh one instead.');
    if (offer.status === 'withdrawn') throw new Error('This offer was withdrawn — send a fresh one instead.');
    if (offer.status === 'pending') throw new Error("Counter-back only applies after the creator has countered. They haven't responded yet.");
    const lastRound = offer.rounds[offer.rounds.length - 1];
    if (!lastRound || lastRound.by !== 'creator') {
      throw new Error("Waiting on the creator's response before you can counter back.");
    }

    // RATE SANITY BOUND — symmetric to v2CounterOffer.
    const originalRate = offer.rounds[0]?.rate ?? offer.rate;
    if (rate <= 0) throw new Error('Counter rate must be greater than $0.');
    if (rate > originalRate * 10) {
      throw new Error(`Counter rate $${rate.toLocaleString()} is more than 10× the original $${originalRate.toLocaleString()} — typo? Bring it down to retry.`);
    }

    if (offer.rounds.length >= MAX_OFFER_ROUNDS) {
      db.offers[idx] = { ...offer, status: 'expired', respondedAt: nowIso() };
      if (offer.applicationId) {
        db.applications = db.applications.map((a) =>
          a.id === offer.applicationId ? { ...a, status: 'submitted', decidedAt: undefined } : a,
        );
      }
      // Same dual notification as v2CounterOffer's cap branch — surface
      // the cap-exceeded state to both sides regardless of whether the
      // offer was application-backed or invite-flow.
      const campNotify = db.campaigns.find((c) => c.id === offer.campaignId);
      const creatorNotify = db.creators.find((c) => c.id === offer.creatorId);
      const brandUserCap = campNotify ? findUserByBrand(db, campNotify.brandId) : null;
      const creatorUserCap = creatorNotify ? findUserByCreator(db, creatorNotify.id) : null;
      if (brandUserCap && campNotify && creatorNotify) {
        db.notifications.push({
          id: newId('n'),
          userId: brandUserCap.id,
          text: offer.applicationId
            ? `Counter-negotiation with ${creatorNotify.name} hit the cap on ${campNotify.title}. Application reopened — send a fresh offer if you want them.`
            : `Counter-negotiation with ${creatorNotify.name} hit the cap on ${campNotify.title}. Outreach has no pending application — send a new invite to re-engage.`,
          href: `/v2`,
          at: nowIso(),
          read: false,
          meta: { campaignId: campNotify.id, offerId: offer.id },
        });
      }
      if (creatorUserCap && campNotify) {
        db.notifications.push({
          id: newId('n'),
          userId: creatorUserCap.id,
          text: `Offer on ${campNotify.title} closed — too many counters. The brand can re-send if they want to continue.`,
          href: `/v2`,
          at: nowIso(),
          read: false,
          meta: { campaignId: campNotify.id, offerId: offer.id },
        });
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
export function v2AcceptCounter(offerId: string): Offer {
  // P63 — symmetric to v2AcceptOffer P62 refactor.
  const result = tx((db) => {
    // P5 §4.1 — brand-side accept; admin/ops only.
    requireCapability(getActorUserId(), 'offer.send', db);

    const idx = db.offers.findIndex((o) => o.id === offerId);
    if (idx === -1) throw new Error("Couldn't find that offer — it may have been withdrawn. Refresh the page.");
    const offer = db.offers[idx];
    if (offer.status === 'accepted') return offer; // idempotent
    if (offer.status === 'declined') throw new Error('The creator declined this offer — nothing to accept.');
    if (offer.status === 'expired')  throw new Error('This offer expired — send a fresh one.');
    if (offer.status === 'withdrawn') throw new Error('This offer was withdrawn — send a fresh one.');
    if (offer.status === 'pending') throw new Error("Counter-accept only applies to a creator's counter. Send a fresh offer instead.");
    // P3 §2.1 — accept the latest round. Either side can be the
    // "accepter" depending on who sent the latest round.
    const lastRound = offer.rounds[offer.rounds.length - 1];
    if (!lastRound) throw new Error('Offer has no negotiation history — nothing to accept.');

    const newRate = lastRound.rate;

    const camp = db.campaigns.find((c) => c.id === offer.campaignId);
    const brand = camp ? db.brands.find((b) => b.id === camp.brandId) : null;
    const creator = db.creators.find((c) => c.id === offer.creatorId);
    if (!camp) throw new Error("Couldn't find the campaign for this offer. Refresh and try again.");
    if (!brand) throw new Error("Couldn't find the brand on this offer. Refresh and try again.");
    if (!creator) throw new Error("Couldn't find the creator on this offer. Refresh and try again.");

    // CAMPAIGN-STAGE GATE — pause / closed campaigns don't accept
    // commitments (parallel to v2AcceptOffer).
    if (camp.stage !== 'live') {
      throw new Error(`This campaign is ${camp.stage} — resume it before accepting the counter.`);
    }

    // FUNDS GUARD — same rule as v2AcceptOffer.
    if (brand.walletBalance < newRate) {
      throw new Error(`Your wallet has $${brand.walletBalance.toLocaleString()} — short by $${(newRate - brand.walletBalance).toLocaleString()} for this offer. Top up first.`);
    }

    db.offers[idx] = { ...offer, rate: newRate, status: 'accepted', respondedAt: nowIso() };

    db.brands = db.brands.map((b) =>
      b.id === brand.id
        ? { ...b, walletBalance: b.walletBalance - newRate, escrowHeld: b.escrowHeld + newRate }
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
export function v2RejectApplication(applicationId: string): Application {
  const result = tx((db) => {
    // P5 §4.1 — brand-side application decision.
    requireCapability(getActorUserId(), 'application.decide', db);

    const idx = db.applications.findIndex((a) => a.id === applicationId);
    if (idx === -1) throw new Error("Couldn't find that application — it may have been withdrawn. Refresh and try again.");
    const app = db.applications[idx];
    if (app.status === 'rejected') return app; // idempotent
    if (app.status === 'withdrawn') throw new Error('The creator already withdrew this application — nothing to reject.');
    if (app.status === 'shortlisted') throw new Error("You've already shortlisted this creator — withdraw the offer first if you want to pass.");
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
export function v2WithdrawApplication(applicationId: string): Application {
  const result = tx((db) => {
    // P5 §4.1 — creator self-withdrawal; same capability as self-apply.
    requireCapability(getActorUserId(), 'application.invite', db);

    const idx = db.applications.findIndex((a) => a.id === applicationId);
    if (idx === -1) throw new Error("Couldn't find that application — refresh and try again.");
    const app = db.applications[idx];
    // Idempotent on already-withdrawn; explicit error on rejected.
    if (app.status === 'withdrawn') return app;
    if (app.status === 'rejected') throw new Error('This application was already rejected by the brand.');
    if (app.status === 'shortlisted') throw new Error("You're shortlisted on this brief — message the brand instead of withdrawing.");
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
export function v2WithdrawOffer(offerId: string): Offer {
  const result = tx((db) => {
    // P5 §4.1 — brand-side withdrawal of a sent offer.
    requireCapability(getActorUserId(), 'offer.withdraw', db);

    const idx = db.offers.findIndex((o) => o.id === offerId);
    if (idx === -1) throw new Error("Couldn't find that offer — refresh and try again.");
    const offer = db.offers[idx];
    // Idempotent on already-withdrawn; specific reasons for the other terminals.
    if (offer.status === 'withdrawn') return offer;
    if (offer.status === 'accepted') throw new Error("This offer was already accepted — you can't withdraw it. Open a dispute if you need to back out.");
    if (offer.status === 'declined') throw new Error('The creator already declined this offer — nothing to withdraw.');
    if (offer.status === 'expired')  throw new Error('This offer expired on its own.');
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
export function v2MarkContentLive(submissionId: string): Submission {
  const result = tx((db) => {
    // P5 §4.1 — brand confirmation that the post is live; admin/ops.
    requireCapability(getActorUserId(), 'content.markLive', db);

    const idx = db.submissions.findIndex((s) => s.id === submissionId);
    if (idx === -1) throw new Error("Couldn't find that submission — refresh and try again.");
    const sub = db.submissions[idx];
    if (sub.status === 'in_review') throw new Error('This submission hasn\'t been approved yet — approve it first, then mark live.');
    if (sub.status === 'revisions') throw new Error('This submission is in revisions — wait for the creator to resubmit and approve before marking live.');
    if (sub.status !== 'approved') throw new Error(`Submission status is "${sub.status}" — mark-live only works on approved drafts.`);
    // P3 §2.2 — must have a permalink set by the creator.
    if (!sub.permalink) throw new Error('The creator needs to paste the live URL first. Ask them to set it from their collab page.');

    // IDEMPOTENCY GUARD — already live → return unchanged (no-op).
    if (sub.feedback.some((f) => f.text.startsWith('LIVE: '))) return sub;

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
export function v2EndCampaign(campaignId: string): Campaign {
  const result = tx((db) => {
    // P5 §4.1 — admin/ops only; finance and viewer cannot end campaigns.
    requireCapability(getActorUserId(), 'campaign.end', db);

    const idx = db.campaigns.findIndex((c) => c.id === campaignId);
    if (idx === -1) throw new Error("Couldn't find that campaign — refresh and try again.");
    const camp = db.campaigns[idx];
    if (camp.stage === 'closed') return camp; // idempotent

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

    // PRE-FIX GAP — `pitched` (creator applied) and `negotiating` (offer
    // out) collabs were left intact when the campaign closed. The
    // creator's MyCollabs continued to show them as "awaiting brand
    // response" forever even though the brand had walked away. Now we
    // resolve those rows too:
    //   - Open applications (submitted / shortlisted) → 'rejected'
    //     with reason 'campaign-ended'
    //   - In-flight offers (pending / countered) → 'withdrawn'
    //   - Each creator gets a single notification per campaign
    const notifiedCreatorIds = new Set<string>();
    db.applications = db.applications.map((a) => {
      if (a.campaignId !== camp.id) return a;
      if (a.status !== 'submitted' && a.status !== 'shortlisted') return a;
      notifiedCreatorIds.add(a.creatorId);
      return { ...a, status: 'rejected', decidedAt: nowIso() };
    });
    db.offers = db.offers.map((o) => {
      if (o.campaignId !== camp.id) return o;
      if (o.status !== 'pending' && o.status !== 'countered') return o;
      notifiedCreatorIds.add(o.creatorId);
      return { ...o, status: 'withdrawn', respondedAt: nowIso() };
    });
    if (brand && notifiedCreatorIds.size > 0) {
      for (const creatorId of notifiedCreatorIds) {
        // Don't double-notify accepted creators (the accepted-creator
        // loop above already handled them with deliverable-aware copy).
        const isAccepted = getAcceptedCreators(camp.id, db).includes(creatorId);
        if (isAccepted) continue;
        const creatorUser = findUserByCreator(db, creatorId);
        if (!creatorUser) continue;
        db.notifications.push({
          id: newId('n'),
          userId: creatorUser.id,
          text: `${brand.name} ended ${camp.title} — your application or offer is closed`,
          href: `/v2`,
          at: nowIso(),
          read: false,
          meta: { campaignId: camp.id },
        });
        // Recompute the Collaboration stage so it stops reading as
        // 'pitched' / 'negotiating' on the creator's MyCollabs.
        ensureCollabState(camp.id, creatorId, db, brand.userId, 'campaign-ended');
      }
    }

    const final = db.campaigns.find((c) => c.id === campaignId);
    if (!final) throw new Error("Campaign vanished mid-end. Refresh and check the Campaigns list.");
    return final;
  });
  // Mirror stage + history + escrow to Supabase (Phase 3).
  mirrorCampaignToSupabase(campaignId, {
    stage: result.stage,
    history: result.history,
    escrowHeld: result.escrowHeld,
  });
  return result;
}

/**
 * Brand pauses a live campaign — stage moves to 'draft' (paused).
 * Resume by calling v2ResumeCampaign. Notifies anyone with a pending
 * application or active offer (s19 — was missing).
 */
export function v2PauseCampaign(campaignId: string): Campaign {
  const result = tx((db) => {
    // P5 §4.1 — admin/ops only.
    requireCapability(getActorUserId(), 'campaign.pause', db);

    const idx = db.campaigns.findIndex((c) => c.id === campaignId);
    if (idx === -1) throw new Error("Couldn't find that campaign — refresh and try again.");
    const camp = db.campaigns[idx];
    if (camp.stage === 'paused') return camp; // idempotent
    if (camp.stage !== 'live') {
      throw new Error(`Only live campaigns can be paused — this one is ${camp.stage}.`);
    }
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

export function v2ResumeCampaign(campaignId: string): Campaign {
  const result = tx((db) => {
    // P5 §4.1 — same gate as pause.
    requireCapability(getActorUserId(), 'campaign.pause', db);

    const idx = db.campaigns.findIndex((c) => c.id === campaignId);
    if (idx === -1) throw new Error("Couldn't find that campaign — refresh and try again.");
    const camp = db.campaigns[idx];
    if (camp.stage === 'live') return camp; // idempotent
    if (camp.stage !== 'paused') {
      throw new Error(`Only paused campaigns can be resumed — this one is ${camp.stage}.`);
    }
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

/** Phase 58 — archive a campaign. Hides the row from the default
 *  Campaigns list (Campaigns.tsx filters by `!archivedAt`) without
 *  changing its stage. Reversible via v2UnarchiveCampaign. Useful for
 *  cleaning up a stale roster without losing the history. Requires
 *  the same brand-update capability as other lifecycle mutations.
 *  Local-only mutation — `archivedAt` is a new field not yet in the
 *  Supabase schema; mirror is a no-op for now. */
export function v2ArchiveCampaign(campaignId: string): Campaign {
  return tx((db) => {
    requireCapability(getActorUserId(), 'campaign.pause', db);
    const idx = db.campaigns.findIndex((c) => c.id === campaignId);
    if (idx === -1) throw new Error("Couldn't find that campaign — refresh and try again.");
    db.campaigns[idx] = { ...db.campaigns[idx], archivedAt: nowIso() };
    return db.campaigns[idx];
  });
}

export function v2UnarchiveCampaign(campaignId: string): Campaign {
  return tx((db) => {
    requireCapability(getActorUserId(), 'campaign.pause', db);
    const idx = db.campaigns.findIndex((c) => c.id === campaignId);
    if (idx === -1) throw new Error("Couldn't find that campaign — refresh and try again.");
    const { archivedAt: _drop, ...rest } = db.campaigns[idx];
    void _drop;
    db.campaigns[idx] = rest;
    return db.campaigns[idx];
  });
}

/** Phase 58 — duplicate a campaign as a new draft. Copies the brief,
 *  category, region, budget, preferred deliverables, and rights/
 *  tracking config; resets spend/escrow/history/applications/offers
 *  and starts at stage='draft' so the brand can re-publish at a new
 *  deadline. Returns the new campaign id so the caller can route
 *  into the draft for final edits. */
export function v2DuplicateCampaign(campaignId: string): Campaign {
  return tx((db) => {
    requireCapability(getActorUserId(), 'campaign.create', db);
    const src = db.campaigns.find((c) => c.id === campaignId);
    if (!src) throw new Error("Couldn't find that campaign to duplicate — refresh and try again.");
    const newCampId = newId('cmp');
    // Duplicate the deliverable rows so the new campaign has its own
    // FK list — pre-fix sharing deliverableIds would have caused both
    // campaigns to render the same per-deliverable submissions.
    const newDeliverableIds: string[] = [];
    for (const oldId of src.deliverableIds) {
      const oldDel = db.deliverables.find((d) => d.id === oldId);
      if (!oldDel) continue;
      const dupId = newId('del');
      db.deliverables.push({ ...oldDel, id: dupId, campaignId: newCampId });
      newDeliverableIds.push(dupId);
    }
    const dup: Campaign = {
      ...src,
      id: newCampId,
      title: `${src.title} (copy)`,
      stage: 'draft',
      spent: 0,
      escrowHeld: 0,
      applications: [],
      offers: [],
      history: [{ stage: 'draft', at: nowIso(), by: 'brand' }],
      createdAt: nowIso(),
      postedAt: undefined,
      reach: undefined,
      engagement: undefined,
      milestones: [],
      assets: [],  // assets reference Storage URLs — duplication needs separate copy step
      archivedAt: undefined,
      deliverableIds: newDeliverableIds,
      version: 1,
    };
    db.campaigns.push(dup);
    return dup;
  });
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
export function v2LaunchCampaign(input: LaunchCampaignInput): Campaign {
  const result = tx((db) => {
    // P5 §4.1 — admin/ops only; finance + viewer cannot create campaigns.
    requireCapability(getActorUserId(), 'campaign.create', db);

    const brandUser = useStore.getState().session
      ? db.users.find((u) => u.id === useStore.getState().session!.userId)
      : null;
    const brand = brandUser?.brandId
      ? db.brands.find((b) => b.id === brandUser.brandId)
      : db.brands.find((b) => b.userId === 'u_hannah');
    if (!brand) throw new Error("Couldn't find your brand profile. Sign out and back in, then try again.");

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
  patch: Partial<Pick<Brand, 'name' | 'industry' | 'hq' | 'website' | 'about' | 'logoMark' | 'logoUrl' | 'preferredCategories' | 'preferredRegions' | 'preferredCreatorTier' | 'monthlyBudgetBand'>>,
): Promise<Brand | null> {
  // 1. Try the Supabase write first. Anything else (RLS rejection,
  //    network error) we surface — the caller's UI will show the
  //    failure toast. Only "row not in Supabase yet" falls through
  //    silently so generated demo brands stay editable in-store.
  //
  //    Migration 021: pass `brand.version` as expectedVersion. On
  //    stale-version the StaleVersionError propagates to the caller's
  //    try/catch (BrandProfile / BrandOnboardingV2 both wrap in
  //    try/catch and toast on error), and the user is prompted to
  //    refresh.
  let serverResult: Brand | null = null;
  // Read expected version off pre-mutation local state.
  const expectedVersion = useStore.getState().db.brands
    .find((b) => b.id === brandId)?.version;
  if (isSupabaseConfigured()) {
    try {
      const { updateBrandInSupabase } = await import('@/lib/data/brandsRepo');
      serverResult = await updateBrandInSupabase(brandId, patch, expectedVersion);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // PostgREST shapes "no rows updated" as a generic error; we
      // detect it via the message text and the count check below.
      // StaleVersionError comes through as its own class — let it
      // propagate so the caller can surface a refresh-prompt toast.
      if (err instanceof Error && err.name === 'StaleVersionError') throw err;
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

/**
 * Mutate identity-level fields on a campaign record. Settings tab on
 * CampaignDetail wires uncontrolled-input fields through here.
 *
 * Pre-fix, the Settings inputs had no `onChange` handler so they
 * accepted typing but never persisted; the brand could not change a
 * campaign's name post-publish without leaving the tab. Same Supabase-
 * mirror-with-local-fallback pattern as v2UpdateBrand.
 */
export async function v2UpdateCampaign(
  campaignId: string,
  patch: Partial<Pick<Campaign, 'title' | 'pitch' | 'autoShortlist' | 'category' | 'region'>>,
): Promise<Campaign | null> {
  let serverResult: Campaign | null = null;
  if (isSupabaseConfigured()) {
    try {
      const { updateCampaignInSupabase } = await import('@/lib/data/campaignsRepo');
      serverResult = await updateCampaignInSupabase(campaignId, patch);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!/no rows|0 rows|not found|JSON object requested/i.test(msg)) {
        throw err;
      }
      // Local-only write — generated cmp_g* rows aren't in Supabase.
    }
  }
  return tx((db) => {
    requireCapability(getActorUserId(), 'campaign.update', db);
    const idx = db.campaigns.findIndex((c) => c.id === campaignId);
    if (idx === -1) return null;
    const current = db.campaigns[idx];
    const next: Campaign = serverResult ?? { ...current, ...patch };
    db.campaigns[idx] = next;
    return next;
  });
}

// =====================================================================
// Stale-offer sweep
// =====================================================================

/**
 * One-shot sweep that expires pending/countered offers older than the
 * TTL. Pre-fix offers sat in those statuses forever — clutters the
 * creator's inbox, skews `getActiveOfferFor` (which returns the latest
 * offer regardless of status), and lets a brand "ghost" indefinitely
 * with no signal to the creator that the deal is effectively dead.
 *
 * Called from Workspace.tsx on mount (once per session). Idempotent —
 * safe to call repeatedly; offers already past the TTL still flip to
 * 'expired' if a previous run was interrupted.
 */
const OFFER_TTL_DAYS = 14;

export function v2SweepStaleOffers(): { swept: number } {
  let swept = 0;
  tx((db) => {
    const cutoffMs = Date.now() - OFFER_TTL_DAYS * 24 * 60 * 60 * 1000;
    const expiredIds = new Set<string>();
    db.offers = db.offers.map((offer) => {
      if (offer.status !== 'pending' && offer.status !== 'countered') return offer;
      const sentMs = new Date(offer.sentAt).getTime();
      if (!Number.isFinite(sentMs) || sentMs > cutoffMs) return offer;
      expiredIds.add(offer.id);
      swept++;
      return { ...offer, status: 'expired' as const, respondedAt: nowIso() };
    });
    if (expiredIds.size === 0) return;

    // Roll back any application-backed offers so the brand can re-engage.
    db.applications = db.applications.map((a) => {
      const matchingOffer = db.offers.find((o) =>
        expiredIds.has(o.id) && o.applicationId === a.id,
      );
      if (!matchingOffer) return a;
      // Only roll back to 'submitted' if the application was advanced
      // (shortlisted). Withdrawn / rejected applications stay terminal.
      if (a.status !== 'shortlisted') return a;
      return { ...a, status: 'submitted' as const, decidedAt: undefined };
    });

    // Notify both sides on each expired offer.
    for (const offer of db.offers) {
      if (!expiredIds.has(offer.id)) continue;
      const camp = db.campaigns.find((c) => c.id === offer.campaignId);
      const brand = camp ? db.brands.find((b) => b.id === camp.brandId) : undefined;
      const creator = db.creators.find((c) => c.id === offer.creatorId);
      const brandUser = brand ? findUserByBrand(db, brand.id) : null;
      const creatorUser = creator ? findUserByCreator(db, creator.id) : null;
      if (brandUser && camp && creator) {
        db.notifications.push({
          id: newId('n'),
          userId: brandUser.id,
          text: `Offer to ${creator.name} on ${camp.title} expired after ${OFFER_TTL_DAYS} days. Send a fresh offer if you still want them.`,
          href: `/v2`,
          at: nowIso(),
          read: false,
          meta: { campaignId: camp.id, offerId: offer.id },
        });
      }
      if (creatorUser && camp && brand) {
        db.notifications.push({
          id: newId('n'),
          userId: creatorUser.id,
          text: `${brand.name}'s offer on ${camp.title} expired after ${OFFER_TTL_DAYS} days. The brand can re-send any time.`,
          href: `/v2`,
          at: nowIso(),
          read: false,
          meta: { campaignId: camp.id, offerId: offer.id },
        });
      }
      // Recompute collab stage so kanbans stop showing this as negotiating.
      ensureCollabState(offer.campaignId, offer.creatorId, db, '', 'offer-ttl-expired');
    }
  });
  return { swept };
}
