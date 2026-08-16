// v2DisputeActions.ts — P2 §1.4 dispute lifecycle mutations.
//
// Disputes are the formal complaint channel between a brand and a
// creator on a single Collaboration. Pre-P2 they lived per-campaign;
// post-P2 they're scoped to the (brand × creator × campaign) collab so
// other in-flight collabs on the same campaign aren't affected by one
// pair's dispute.
//
// State machine:
//   raised → open → in-review → resolved-{refund,release,partial}
//                           ↘  withdrawn (raiser pulls before resolution)
//
// Money invariants:
//   - Raising sets `Collaboration.escrowFrozen = true`. v2ApproveContent
//     refuses to clear escrow while frozen. Other collabs on the same
//     campaign are unaffected.
//   - Resolving with `refundAmount` moves money brand→wallet (positive
//     `refund` ledger entry).
//   - Resolving with `releaseAmount` moves money brand→creator (mirrors
//     v2ApproveContent's escrow_release + payout pair, minus fee/tax).
//   - Withdrawal clears `escrowFrozen` without moving money — the
//     normal approval path resumes.
//
// Consumers:
//   - CollabDetail "Raise dispute" CTA gated on Collaboration.stage ∈
//     {confirmed, submitted, approved, live} AND submission.disputeWindowClosesAt
//     not yet passed (post-approval window). The latter is enforced
//     by the UI; the mutations themselves accept any pending stage.
//   - Admin queue / DisputeResolveModal call resolve.

import { tx, useStore } from '@/lib/api/store';
import type {
  Database, Dispute, DisputeCategory, DisputeStatus, DisputeEvidence,
} from '@/lib/api/types';
// P5 §4.1 — capability gate.
import { requireCapability, getActorUserId } from '@/lib/permissions';
// AUDIT FIX (post-P6) — dispute resolution can release escrow which
// changes the underlying transaction state. The Collaboration.stage
// must recompute (it might transition to 'paid'); this is the same
// helper every other money-moving mutation calls.
import { ensureCollabState } from '@/lib/api/collabSync';
import { markContractFulfilled } from '@/lib/api/contracts';
// Phase 8 lite — Supabase mirror for dispute mutations.
import { isSupabaseConfigured } from '@/lib/supabase';

// Fee/withholding rates come from one module — see lib/api/money.ts.
import { PLATFORM_FEE, WHT, netOf, splitGross } from '@/lib/api/money';
// F3 — one definition of "how much escrow is on the table", shared with the
// settlement handshake rather than copied. See its export note.
import { settleableEscrow } from './v2CollabActions';
import { dealOwnerUserId } from './v2TeamActions';

/** Fire-and-forget mirror for a new Dispute INSERT. Silenced on FK
 *  (collab/campaign tied to generated rows) + RLS. */
function mirrorDisputeInsertToSupabase(d: Dispute): void {
  if (!isSupabaseConfigured()) return;
  void (async () => {
    try {
      const { insertDisputeInSupabase } = await import('@/lib/data/disputesRepo');
      await insertDisputeInSupabase(d);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/foreign key|violates|row-level security|no rows|0 rows|not found/i.test(msg)) return;
      // eslint-disable-next-line no-console
      console.warn('[dispute insert mirror] failed:', msg);
    }
  })();
}

/** Fire-and-forget mirror for a Dispute UPDATE. */
function mirrorDisputeUpdateToSupabase(
  disputeId: string,
  patch: Parameters<typeof import('@/lib/data/disputesRepo').updateDisputeInSupabase>[1],
): void {
  if (!isSupabaseConfigured()) return;
  // Read pre-mutation version off local state — the local tx doesn't
  // touch `version` (only writeBack from a successful mirror does).
  const expectedVersion = useStore.getState().db.disputes
    .find((d) => d.id === disputeId)?.version;
  void (async () => {
    try {
      const { updateDisputeInSupabase } = await import('@/lib/data/disputesRepo');
      const updated = await updateDisputeInSupabase(disputeId, patch, expectedVersion);
      // Write the new version back to local store so subsequent
      // UPDATEs on the same dispute pass the right expectedVersion.
      // Same shape as v2CampaignActions.writeBackVersion but inlined
      // to avoid a circular import.
      if (typeof updated.version === 'number') {
        useStore.setState((s) => {
          const idx = s.db.disputes.findIndex((d) => d.id === disputeId);
          if (idx === -1 || s.db.disputes[idx].version === updated.version) return s;
          const next = s.db.disputes.slice();
          next[idx] = { ...next[idx], version: updated.version };
          return { ...s, db: { ...s.db, disputes: next } };
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/row-level security|no rows|0 rows|not found/i.test(msg)) return;
      if (err instanceof Error && err.name === 'StaleVersionError') {
        const { pushToast } = await import('@/lib/utils/toast');
        pushToast(
          `Couldn't save dispute — another tab updated it. Refresh to see the latest.`,
          'bad',
        );
        return;
      }
      // eslint-disable-next-line no-console
      console.warn('[dispute update mirror] failed:', msg);
    }
  })();
}

function newId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function nowMs(): number {
  return Date.now();
}

function findUserId(db: Database, userId: string): { id: string; isCreator: boolean; isBrand: boolean } | null {
  const u = db.users.find((x) => x.id === userId);
  if (!u) return null;
  return { id: u.id, isCreator: !!u.creatorId, isBrand: !!u.brandId };
}

/**
 * Raise a new Dispute on a Collaboration. The actor's role is derived
 * from their User profile (creatorId vs brandId). Sets the collab's
 * `escrowFrozen` flag so v2ApproveContent refuses to release escrow
 * until resolution.
 *
 * Stage gate: caller is responsible for checking that the collab's
 * stage is one of {confirmed, submitted, approved, live}. The mutation
 * itself doesn't fail-fast on stage — it lets admin tooling raise on
 * any stage if needed.
 */
export function v2RaiseDispute(input: {
  collaborationId: string;
  raisedByUserId: string;
  category: DisputeCategory;
  description: string;
  evidence?: DisputeEvidence[];
}): Dispute | null {
  const result = tx((db) => {
    // P5 §4.1 — both sides have `dispute.raise`. Brand viewer/finance
    // can't raise; creators can.
    requireCapability(getActorUserId(), 'dispute.raise', db);

    const collab = db.collaborations.find((c) => c.id === input.collaborationId);
    if (!collab) return null;
    const raiser = findUserId(db, input.raisedByUserId);
    if (!raiser) return null;
    const raisedByRole: 'brand' | 'creator' = raiser.isCreator ? 'creator' : 'brand';

    // IDEMPOTENCY GUARD — pre-fix a fast double-submit on the dispute
    // modal could push two open Dispute rows on the same collab. Both
    // would set `escrowFrozen = true` (a no-op the second time), but
    // the admin queue would show two cases for one issue, and resolve
    // flows for either could move the same escrow twice. Returns the
    // existing open dispute on collision so the caller knows it landed.
    const existing = db.disputes.find(
      (d) =>
        d.collaborationId === collab.id &&
        (d.status === 'open' || d.status === 'in-review'),
    );
    if (existing) return existing;

    const now = nowMs();
    const dispute: Dispute = {
      id: newId('dsp'),
      collaborationId: collab.id,
      campaignId: collab.campaignId,
      raisedByUserId: input.raisedByUserId,
      raisedByRole,
      category: input.category,
      description: input.description,
      evidence: input.evidence ?? [],
      status: 'open',
      resolution: null,
      raisedAt: now,
      updatedAt: now,
      messages: [],
    };
    db.disputes.push(dispute);

    // Freeze escrow on the collab. v2ApproveContent checks this flag.
    collab.escrowFrozen = true;

    // Notify the counter party + every admin.
    const camp = db.campaigns.find((c) => c.id === collab.campaignId);
    const creator = db.creators.find((c) => c.id === collab.creatorId);
    const brand = db.brands.find((b) => b.id === collab.brandId);
    const creatorUser = creator ? db.users.find((u) => u.id === creator.userId) : null;
    const brandUser = brand ? db.users.find((u) => u.id === brand.userId) : null;
    const counterUser = raisedByRole === 'creator' ? brandUser : creatorUser;
    if (counterUser && camp) {
      db.notifications.push({
        id: newId('n'),
        userId: counterUser.id,
        text: `Dispute opened on ${camp.title}`,
        href: '/v2',
        at: new Date(now).toISOString(),
        read: false,
        meta: { campaignId: camp.id, collaborationId: collab.id },
      });
    }
    db.users.filter((u) => u.role === 'admin').forEach((adm) => {
      db.notifications.push({
        id: newId('n'),
        userId: adm.id,
        text: `New dispute filed: ${camp?.title ?? 'campaign'}`,
        href: '/admin/queue?type=disputes',
        at: new Date(now).toISOString(),
        read: false,
        meta: { campaignId: collab.campaignId, collaborationId: collab.id },
      });
    });

    return dispute;
  });
  if (result) mirrorDisputeInsertToSupabase(result);
  return result;
}

/**
 * Raiser withdraws a still-open Dispute. Clears `escrowFrozen` on the
 * collab so the normal approval path resumes. Resolved disputes can't
 * be withdrawn (use `resolveDispute` to issue a corrective resolution).
 */
export function v2WithdrawDispute(disputeId: string, byUserId: string): Dispute {
  const result = tx((db) => {
    // P5 §4.1 — same gate as raise. Only the original raiser can
    // withdraw (data-layer check below); the cap gate catches viewer/
    // finance users early.
    requireCapability(getActorUserId(), 'dispute.raise', db);

    const disp = db.disputes.find((d) => d.id === disputeId);
    if (!disp) throw new Error("Couldn't find that dispute — refresh and try again.");
    if (disp.status === 'withdrawn') return disp; // idempotent
    if (disp.status === 'resolved-refund' || disp.status === 'resolved-release' || disp.status === 'resolved-partial') {
      throw new Error('This dispute has already been resolved by admin — can\'t withdraw it now.');
    }
    if (disp.raisedByUserId !== byUserId) {
      throw new Error('Only the person who raised this dispute can withdraw it.');
    }

    const now = nowMs();
    disp.status = 'withdrawn';
    disp.updatedAt = now;

    const collab = db.collaborations.find((c) => c.id === disp.collaborationId);
    if (collab) collab.escrowFrozen = false;

    // Notify admins that the case is off the queue.
    const camp = db.campaigns.find((c) => c.id === disp.campaignId);
    db.users.filter((u) => u.role === 'admin').forEach((adm) => {
      db.notifications.push({
        id: newId('n'),
        userId: adm.id,
        text: `Dispute withdrawn: ${camp?.title ?? 'campaign'}`,
        href: '/admin/queue?type=disputes',
        at: new Date(now).toISOString(),
        read: false,
        meta: { campaignId: disp.campaignId, collaborationId: disp.collaborationId },
      });
    });

    return disp;
  });
  if (result && result.status === 'withdrawn') {
    mirrorDisputeUpdateToSupabase(disputeId, { status: 'withdrawn' });
  }
  return result;
}

/**
 * Append a message to the dispute thread. Anyone involved (raiser,
 * counter party, admin) can post. The message log is the audit trail
 * the admin reads when deciding the resolution.
 */
export function v2AddDisputeMessage(disputeId: string, fromUserId: string, body: string): Dispute {
  const result = tx((db) => {
    // P5 §4.1 — viewer/finance can read but can't post into a dispute.
    requireCapability(getActorUserId(), 'dispute.raise', db);

    const disp = db.disputes.find((d) => d.id === disputeId);
    if (!disp) throw new Error("Couldn't find that dispute — refresh and try again.");
    if (disp.status === 'withdrawn') throw new Error('This dispute was withdrawn — can\'t post messages on it.');
    if (disp.status === 'resolved-refund' || disp.status === 'resolved-release' || disp.status === 'resolved-partial') {
      throw new Error('This dispute is already resolved — can\'t post new messages on it.');
    }
    if (!body.trim()) throw new Error('Message body is empty.');

    const now = nowMs();
    disp.messages = [...disp.messages, { at: now, userId: fromUserId, body: body.trim() }];
    disp.updatedAt = now;
    return disp;
  });
  if (result) mirrorDisputeUpdateToSupabase(disputeId, { messages: result.messages });
  return result;
}

/**
 * Admin resolves the dispute with one of three money paths:
 *   - 'resolved-refund'   — full escrow back to brand (releaseAmount = 0)
 *   - 'resolved-release'  — full escrow to creator     (refundAmount = 0)
 *   - 'resolved-partial'  — split (both > 0)
 *
 * Money math: `releaseAmount + refundAmount` must equal the campaign's
 * current `escrowHeld`. Admin tooling enforces; the mutation trusts
 * its inputs but defends the negative-balance invariants.
 *
 * Clears `Collaboration.escrowFrozen` so the normal flow can resume on
 * any sibling submissions (rare but possible — e.g. a partial resolve
 * still leaves room for the creator to deliver further work).
 */
export interface DisputeOutcome {
  status: Extract<DisputeStatus, 'resolved-refund' | 'resolved-release' | 'resolved-partial'>;
  /** Whoever's decision this was: an admin, or the party who agreed. */
  by: string;
  note: string;
  releaseAmount?: number;
  refundAmount?: number;
}

/**
 * Apply a dispute outcome: move the money, unfreeze escrow, terminalize a
 * dead deal, notify both sides, recompute the collab stage.
 *
 * WORKFLOW-GAPS F3 — extracted from `v2ResolveDispute` so that the parties
 * agreeing a split and an admin imposing one land in EXACTLY the same place.
 * The alternative was a second implementation of the dispute money path, and
 * this codebase has already paid for that mistake five times over: every
 * money operation here once had a correct version and a drifted copy still
 * wired to the UI.
 *
 * Deliberately carries no capability check. The two callers gate differently
 * — admin capability vs. being the non-proposing party — and burying either
 * rule in here would make the other caller's gate invisible.
 */
function applyDisputeResolution(
  db: Database,
  disp: Dispute,
  input: DisputeOutcome,
  notifyText: (campaignTitle: string) => string,
): Dispute | null {
    const camp = db.campaigns.find((c) => c.id === disp.campaignId);
    const collab = db.collaborations.find((c) => c.id === disp.collaborationId);
    if (!camp || !collab) return null;
    const brand = db.brands.find((b) => b.id === camp.brandId);
    const creator = db.creators.find((c) => c.id === collab.creatorId);

    const now = nowMs();
    disp.status = input.status;
    disp.resolution = {
      by: input.by,
      at: now,
      note: input.note,
      releaseAmount: input.releaseAmount,
      refundAmount: input.refundAmount,
    };
    disp.updatedAt = now;

    // Move money. Pull from campaign escrow first; whatever's left
    // comes from brand-level escrow (mirrors legacy resolveDispute).
    if (brand && (input.releaseAmount || input.refundAmount)) {
      const totalMoved = (input.releaseAmount || 0) + (input.refundAmount || 0);
      const fromCampaign = Math.min(camp.escrowHeld, totalMoved);

      db.campaigns = db.campaigns.map((c) =>
        c.id === camp.id ? { ...c, escrowHeld: c.escrowHeld - fromCampaign } : c,
      );
      db.brands = db.brands.map((b) =>
        b.id === brand.id ? { ...b, escrowHeld: Math.max(0, b.escrowHeld - fromCampaign) } : b,
      );

      const ts = new Date(now).toISOString();

      if (input.refundAmount && input.refundAmount > 0) {
        db.brands = db.brands.map((b) =>
          b.id === brand.id ? { ...b, walletBalance: b.walletBalance + input.refundAmount! } : b,
        );
        db.transactions.push({
          id: newId('tx'),
          at: ts,
          userId: brand.userId,
          kind: 'refund',
          amount: input.refundAmount,
          status: 'cleared',
          campaignId: camp.id,
          note: `Dispute refund · ${camp.title}`,
        });
        // P67 — reverse the creator's pending hold for the refunded
        // portion. The accept-time hold credited pendingBalance with
        // net(rate); the release leg (below) decrements pending by
        // net(release), but pre-fix the refund leg decremented nothing —
        // after a full refund the creator's wallet showed pending money
        // that would never arrive, forever.
        if (creator) {
          const refundNet = netOf(input.refundAmount);
          db.creators = db.creators.map((c) =>
            c.id === creator.id
              ? { ...c, pendingBalance: Math.max(0, c.pendingBalance - refundNet) }
              : c,
          );
        }
      }
      if (input.releaseAmount && input.releaseAmount > 0 && creator) {
        // Mirror v2ApproveContent's release path: net to creator after
        // platform fee + WHT. `releaseAmount` is gross (admin's input).
        const releaseGross = input.releaseAmount;
        const { fee, tax, net } = splitGross(releaseGross);

        // WORKFLOW AUDIT — admin resolved the dispute in the creator's
        // favor, so the relevant submission is implicitly approved.
        // Without this, the submission stays at `in_review` even after
        // money clears, and `computeCollabStage` would render the
        // collab as still 'submitted' on the kanban. Mirrors what
        // would happen if the brand had approved the content directly.
        db.submissions = db.submissions.map((s) =>
          s.campaignId === camp.id
          && s.creatorId === creator.id
          && (s.status === 'in_review' || s.status === 'revisions')
            ? { ...s, status: 'approved' as const, disputeWindowClosesAt: now + (7 * 24 * 60 * 60 * 1000) }
            : s,
        );

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
        db.campaigns = db.campaigns.map((c) =>
          c.id === camp.id ? { ...c, spent: c.spent + releaseGross } : c,
        );

        // Brand-side escrow_release + creator-side payout + fee + tax
        // (same shape as v2ApproveContent so the ledger reconciles).
        db.transactions.push({
          id: newId('tx'),
          at: ts,
          userId: brand.userId,
          kind: 'escrow_release',
          amount: -releaseGross,
          status: 'cleared',
          campaignId: camp.id,
          counterpartyUserId: creator.userId,
          note: `Dispute release · ${camp.title}`,
        });
        db.transactions.push({
          id: newId('tx'),
          at: ts,
          userId: creator.userId,
          kind: 'payout',
          // Gross, matching v2ApproveContent — the fee and withholding
          // rows below are the deductions, so these rows sum to the
          // wallet movement.
          amount: releaseGross,
          status: 'cleared',
          campaignId: camp.id,
          counterpartyUserId: brand.userId,
          note: `Dispute payout · ${camp.title}`,
        });
        db.transactions.push({
          id: newId('tx'), at: ts, userId: creator.userId,
          kind: 'fee', amount: -fee, status: 'cleared',
          campaignId: camp.id,
          note: `Platform fee (${Math.round(PLATFORM_FEE * 100)}%)`,
        });
        db.transactions.push({
          id: newId('tx'), at: ts, userId: creator.userId,
          kind: 'fee', amount: -tax, status: 'cleared',
          campaignId: camp.id,
          note: `Withholding tax (${Math.round(WHT * 100)}%)`,
        });
      }
    }

    // P67 — a refund-only resolution means the deal is dead: the brand
    // got the escrow back and no work will be paid for. Pre-fix the
    // accepted offer stayed 'accepted' and the submission stayed
    // 'in_review', so the recompute below left the collab parked at
    // 'submitted' indefinitely — an un-cancellable zombie on both
    // kanbans. Withdraw the offer + terminalize open apps so
    // computeCollabStage's all-declined rule lands 'cancelled'.
    // Release + partial resolutions keep the deal alive (work was paid).
    if (input.status === 'resolved-refund') {
      db.offers = db.offers.map((o) =>
        o.campaignId === collab.campaignId &&
        o.creatorId === collab.creatorId &&
        o.status === 'accepted'
          ? { ...o, status: 'withdrawn' as const, respondedAt: new Date(now).toISOString() }
          : o,
      );
      db.applications = db.applications.map((a) =>
        a.campaignId === collab.campaignId &&
        a.creatorId === collab.creatorId &&
        (a.status === 'submitted' || a.status === 'shortlisted')
          ? { ...a, status: 'rejected' as const, decidedAt: new Date(now).toISOString() }
          : a,
      );
    }

    // Resolution unfreezes the collab.
    collab.escrowFrozen = false;

    // Notify both parties.
    const ts = new Date(now).toISOString();
    db.notifications.push({
      id: newId('n'),
      userId: disp.raisedByUserId,
      text: notifyText(camp.title),
      href: '/v2',
      at: ts,
      read: false,
      meta: { campaignId: camp.id, collaborationId: collab.id },
    });
    const counterUserId = disp.raisedByRole === 'brand'
      ? creator && db.users.find((u) => u.creatorId === creator.id)?.id
      : brand?.userId;
    if (counterUserId && counterUserId !== disp.raisedByUserId) {
      db.notifications.push({
        id: newId('n'),
        userId: counterUserId,
        text: notifyText(camp.title),
        href: '/v2',
        at: ts,
        read: false,
        meta: { campaignId: camp.id, collaborationId: collab.id },
      });
    }

    // AUDIT FIX — when the resolution releases money to the creator,
    // a payout transaction is pushed (above). `computeCollabStage`
    // checks for cleared payout/escrow_release transactions and
    // returns 'paid' when it finds one. Without this call,
    // `Collaboration.stage` would stay at its pre-resolve value
    // (typically 'submitted' or 'approved') even though the runtime
    // recompute would say 'paid'. Same pattern as `v2ApproveContent`.
    const collabAfter = ensureCollabState(
      collab.campaignId,
      collab.creatorId,
      db,
      input.by,
      `dispute-resolved:${input.status}`,
    );
    // P2 §1.3 — if the contract should now be marked fulfilled (full
    // release on a resolved-release path), do so.
    if (collabAfter?.contractId && collabAfter.stage === 'paid') {
      markContractFulfilled(db, collabAfter.contractId);
    }
  return disp;
}

/**
 * Admin resolution. The arbitrated path: an admin decides the split.
 */
export function v2ResolveDispute(disputeId: string, input: {
  status: Extract<DisputeStatus, 'resolved-refund' | 'resolved-release' | 'resolved-partial'>;
  resolvedByUserId: string;
  note: string;
  releaseAmount?: number;
  refundAmount?: number;
}): Dispute | null {
  const result = tx((db) => {
    // P5 §4.1 — admin-only. The `dispute.resolve` capability is held
    // by the `super` and `disputes` AdminRoles; brand-side teamRoles
    // never get it.
    requireCapability(getActorUserId(), 'dispute.resolve', db);

    const disp = db.disputes.find((d) => d.id === disputeId);
    if (!disp) return null;
    if (disp.status !== 'open' && disp.status !== 'in-review') return disp;

    // An admin ruling overrides any split the parties were still discussing.
    disp.proposal = null;

    return applyDisputeResolution(db, disp, {
      status: input.status,
      by: input.resolvedByUserId,
      note: input.note,
      releaseAmount: input.releaseAmount,
      refundAmount: input.refundAmount,
    }, (title) => `Dispute resolved on ${title}`);
  });
  if (result) {
    mirrorDisputeUpdateToSupabase(disputeId, {
      status: result.status,
      resolution: result.resolution,
      proposal: result.proposal ?? null,
    });
  }
  return result;
}

// Read-only convenience helpers

// =====================================================================
// PARTY-PROPOSED SETTLEMENT INSIDE A DISPUTE (WORKFLOW-GAPS F3)
// =====================================================================
//
// A dispute could only be ended by an admin. The two people who actually know
// what happened had no way to say "call it 60/40 and we're done", so every
// disagreement — however small, however willing both sides were to split the
// difference — queued behind an arbitrator with the escrow frozen throughout.
//
// This is the same handshake as F1's settlement, and deliberately so: propose
// → the OTHER side agrees or declines. What differs is only what agreement
// DOES. F1 settles a live deal and closes it; here it resolves the dispute,
// through the identical money path an admin resolution uses.
//
// F1's own error message already promised this door existed — "Resolve the
// dispute instead — that is where a split gets arbitrated." It did not. Now
// it does, and it does not require an arbitrator to open it.

/** Which side of this dispute is this user on, if any? */
function partyRole(db: Database, disp: Dispute, userId: string): 'brand' | 'creator' | null {
  const collab = db.collaborations.find((c) => c.id === disp.collaborationId);
  if (!collab) return null;
  const u = db.users.find((x) => x.id === userId);
  if (!u) return null;
  if (u.creatorId && u.creatorId === collab.creatorId) return 'creator';
  if (u.brandId && u.brandId === collab.brandId) return 'brand';
  return null;
}

/** How much escrow this dispute can actually split, for the UI to bound its
 *  input. Uses the SAME helper as F1's settlement — see the note on its
 *  export in v2CollabActions. */
export function v2DisputeSettleableAmount(disputeId: string): number {
  const db = useStore.getState().db;
  const disp = db.disputes.find((d) => d.id === disputeId);
  if (!disp) return 0;
  const collab = db.collaborations.find((c) => c.id === disp.collaborationId);
  return collab ? settleableEscrow(db, collab) : 0;
}

/**
 * Offer the other party a split, to end the dispute without an arbitrator.
 *
 * `releaseToCreator` is GROSS — the creator receives it net of fee and
 * withholding, exactly as an approval would pay, because it IS payment for
 * work done rather than a special case.
 */
export function v2ProposeDisputeSplit(
  disputeId: string,
  releaseToCreator: number,
  note: string,
  byUserId: string,
): Dispute {
  const result = tx((db) => {
    const disp = db.disputes.find((d) => d.id === disputeId);
    if (!disp) throw new Error("Couldn't find that dispute — refresh and try again.");
    if (disp.status !== 'open' && disp.status !== 'in-review') {
      throw new Error('This dispute is already resolved.');
    }
    // Only the two parties. An admin who wants a split imposes one through
    // v2ResolveDispute; letting them "propose" would create a proposal the
    // other side could accept on an arbitrator's behalf.
    if (!partyRole(db, disp, byUserId)) {
      throw new Error('Only the brand or the creator on this deal can propose a settlement.');
    }
    if (disp.proposal) {
      throw new Error('A settlement is already on the table. Wait for the other side, or withdraw it first.');
    }

    const collab = db.collaborations.find((c) => c.id === disp.collaborationId);
    const available = collab ? settleableEscrow(db, collab) : 0;
    if (available <= 0) {
      throw new Error('There is no escrow held on this deal to split.');
    }
    if (!Number.isFinite(releaseToCreator) || releaseToCreator < 0 || releaseToCreator > available) {
      throw new Error(`Enter an amount between $0 and $${available.toLocaleString()} — that is what is actually held.`);
    }
    if (!note.trim()) {
      throw new Error('Add a note explaining the split — the other side has to agree to it.');
    }

    const now = nowMs();
    disp.proposal = {
      by: byUserId,
      at: now,
      releaseToCreator: Math.round(releaseToCreator),
      note: note.trim(),
    };
    disp.updatedAt = now;

    const camp = db.campaigns.find((c) => c.id === disp.campaignId);
    const other = otherPartyUserId(db, disp, byUserId);
    if (other && camp) {
      db.notifications.push({
        id: newId('n'),
        userId: other,
        text: `Settlement proposed to end the dispute on ${camp.title}: $${Math.round(releaseToCreator).toLocaleString()} to the creator, the rest refunded — needs your agreement`,
        href: '/v2',
        at: new Date(now).toISOString(),
        read: false,
        meta: { campaignId: disp.campaignId, collaborationId: disp.collaborationId },
      });
    }
    return disp;
  });
  if (result) {
    mirrorDisputeUpdateToSupabase(disputeId, { proposal: result.proposal ?? null });
  }
  return result;
}

/** The party on the other side of this dispute from `userId`. */
function otherPartyUserId(db: Database, disp: Dispute, userId: string): string | null {
  const collab = db.collaborations.find((c) => c.id === disp.collaborationId);
  if (!collab) return null;
  const creatorUser = db.users.find((u) => u.creatorId === collab.creatorId);
  // D2 — route to the deal's OWNER, not just whoever holds the brandId.
  // Without this, reassignment would be cosmetic: the new owner would see
  // the deal on their board and none of its notifications.
  const brandUser = db.users.find((u) => u.id === dealOwnerUserId(db, collab));
  if (userId === creatorUser?.id) return brandUser?.id ?? null;
  if (userId === brandUser?.id) return creatorUser?.id ?? null;
  return null;
}

/**
 * Agree to the proposed split. Resolves the dispute and moves the money.
 *
 * The proposer cannot accept their own proposal — without that check this is
 * a unilateral escrow withdrawal wearing a handshake's clothes.
 */
export function v2AgreeDisputeSplit(disputeId: string, byUserId: string): Dispute {
  const result = tx((db) => {
    const disp = db.disputes.find((d) => d.id === disputeId);
    if (!disp) throw new Error("Couldn't find that dispute — refresh and try again.");
    if (disp.status !== 'open' && disp.status !== 'in-review') {
      throw new Error('This dispute is already resolved.');
    }
    const proposal = disp.proposal;
    if (!proposal) throw new Error('There is no settlement proposal on this dispute.');
    if (proposal.by === byUserId) {
      throw new Error('You proposed this settlement — the other side has to agree to it.');
    }
    if (!partyRole(db, disp, byUserId)) {
      throw new Error('Only the brand or the creator on this deal can agree to a settlement.');
    }

    const collab = db.collaborations.find((c) => c.id === disp.collaborationId);
    if (!collab) throw new Error("Couldn't find the collaboration behind this dispute.");

    // Re-clamp at agreement time: escrow may have moved since the proposal.
    const available = settleableEscrow(db, collab);
    const releaseAmount = Math.min(proposal.releaseToCreator, available);
    const refundAmount = available - releaseAmount;

    // The outcome describes what the split actually was, so the admin queue
    // and every metric that reads `status` sees the truth rather than a
    // blanket "partial". An agreed 100%-to-creator IS a release.
    const status = releaseAmount <= 0
      ? 'resolved-refund' as const
      : refundAmount <= 0
        ? 'resolved-release' as const
        : 'resolved-partial' as const;

    disp.proposal = null;

    return applyDisputeResolution(db, disp, {
      status,
      by: byUserId,
      note: `Settled by agreement: $${releaseAmount.toLocaleString()} to the creator, $${refundAmount.toLocaleString()} refunded. ${proposal.note}`,
      releaseAmount,
      refundAmount,
    }, (title) => `Dispute on ${title} settled by agreement — $${releaseAmount.toLocaleString()} released, $${refundAmount.toLocaleString()} refunded`);
  });
  if (!result) throw new Error("Couldn't settle this dispute — refresh and try again.");
  mirrorDisputeUpdateToSupabase(disputeId, {
    status: result.status,
    resolution: result.resolution,
    proposal: null,
  });
  return result;
}

/** Turn down a proposed split. Clears it so either side can make a different
 *  one; the dispute stays open and nothing moves. */
export function v2DeclineDisputeSplit(disputeId: string, byUserId: string, reason?: string): Dispute {
  const result = tx((db) => {
    const disp = db.disputes.find((d) => d.id === disputeId);
    if (!disp) throw new Error("Couldn't find that dispute — refresh and try again.");
    const proposal = disp.proposal;
    if (!proposal) throw new Error('There is no settlement proposal to decline.');
    if (proposal.by === byUserId) {
      throw new Error('You proposed this — withdraw it rather than declining your own offer.');
    }
    if (!partyRole(db, disp, byUserId)) {
      throw new Error('Only the brand or the creator on this deal can decline a settlement.');
    }

    disp.proposal = null;
    disp.updatedAt = nowMs();

    const camp = db.campaigns.find((c) => c.id === disp.campaignId);
    if (camp) {
      db.notifications.push({
        id: newId('n'),
        userId: proposal.by,
        text: `Your settlement proposal on ${camp.title} was declined${reason ? `: ${reason}` : ''} — the dispute stays open`,
        href: '/v2',
        at: new Date(nowMs()).toISOString(),
        read: false,
        meta: { campaignId: disp.campaignId, collaborationId: disp.collaborationId },
      });
    }
    return disp;
  });
  if (result) {
    mirrorDisputeUpdateToSupabase(disputeId, { proposal: null });
  }
  return result;
}

/** Withdraw your own proposal. The mirror image of declining. */
export function v2WithdrawDisputeSplit(disputeId: string, byUserId: string): Dispute {
  const result = tx((db) => {
    const disp = db.disputes.find((d) => d.id === disputeId);
    if (!disp) throw new Error("Couldn't find that dispute — refresh and try again.");
    if (!disp.proposal) throw new Error('There is no settlement proposal to withdraw.');
    if (disp.proposal.by !== byUserId) {
      throw new Error("You can't withdraw the other side's proposal — decline it instead.");
    }
    disp.proposal = null;
    disp.updatedAt = nowMs();
    return disp;
  });
  if (result) {
    mirrorDisputeUpdateToSupabase(disputeId, { proposal: null });
  }
  return result;
}

export function getOpenDisputeForCollab(collabId: string): Dispute | null {
  const db = useStore.getState().db;
  return db.disputes.find(
    (d) => d.collaborationId === collabId && (d.status === 'open' || d.status === 'in-review'),
  ) ?? null;
}
