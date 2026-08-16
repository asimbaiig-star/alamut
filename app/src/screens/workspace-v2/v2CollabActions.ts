// v2CollabActions.ts — collaboration-level mutations
//
// P1c §1.1 lands Collaboration as a first-class entity. Most state
// transitions still happen via the existing v2CampaignActions mutations
// (apply / send-offer / accept / submit / approve / mark-live / etc.) —
// those write to apps/offers/subs as before, then call
// `ensureCollabState` from `@/lib/api/collabSync` to keep the
// Collaboration row in sync.
//
// This file holds collab-level mutations that DON'T fit into the
// per-entity mutation pattern:
//   - v2InviteCreator — brand cold-invites a creator to a campaign.
//     Creates Collaboration{stage: 'invited'} directly. No application
//     and no offer at this point. The creator can accept (which auto-fires
//     v2SendOffer with source: 'invite' under the hood) or pass.
//   - v2RequestCollabCancel / v2AgreeCollabCancel / v2DeclineCollabCancel
//     (P3 §2.3) — mutual-consent cancellation flow for confirmed collabs.
//     Either side can request; the other agrees or declines. On agree,
//     escrow is refunded to the brand, the collab moves to 'cancelled'.

import { tx, useStore } from '@/lib/api/store';
import { availabilityBlock } from '@/lib/api/availability';
import type { Collaboration, Database } from '@/lib/api/types';
import { ensureCollabState } from '@/lib/api/collabSync';
// Fee/withholding rates come from one module — see lib/api/money.ts.
import { netOf, splitGross, PLATFORM_FEE, WHT } from '@/lib/api/money';
// P5 §4.1 — capability gate. See `lib/permissions.ts` for the matrix.
import { requireCapability, getActorUserId } from '@/lib/permissions';

function newId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}
function nowIso(): string {
  return new Date().toISOString();
}

/**
 * Brand invites a creator to a campaign without going through the
 * application-first flow. Creates a Collaboration in `invited` stage.
 * Notifies the creator. The creator can then accept (which auto-fires
 * an offer with `source: 'invite'`) or pass.
 */
export function v2InviteCreator(
  campaignId: string,
  creatorId: string,
  message: string,
  invitedByUserId: string,
): Collaboration | null {
  return tx((db) => {
    // P5 §4.1 — brand-side cold invite; admin/ops only.
    requireCapability(getActorUserId(), 'application.invite', db);

    const camp = db.campaigns.find((c) => c.id === campaignId);
    const creator = db.creators.find((c) => c.id === creatorId);
    if (!camp || !creator) return null;

    // Same standing instructions as v2SendOffer. A cold invite carries no
    // rate, so only the category and vacation blocks can apply — but those
    // are exactly the two that are instructions rather than judgement calls.
    const inviteBlocked = availabilityBlock(creator, { category: camp.category });
    if (inviteBlocked) throw new Error(inviteBlocked);

    // IDEMPOTENCY GUARD — pre-fix a double-click on Invite pushed a
    // fresh notification + a duplicate `brand-invite` history entry on
    // every call. The collab row itself is found-or-created by
    // ensureCollabState, but the side effects (notification, history)
    // accumulated. Refuse if the collab already exists and has a
    // brand-invite history entry to its name.
    const existingCollab = db.collaborations.find(
      (c) => c.campaignId === campaignId && c.creatorId === creatorId,
    );
    if (existingCollab && existingCollab.history.some(
      (h) => typeof h.reason === 'string' && h.reason.startsWith('brand-invite'),
    )) {
      return existingCollab;
    }

    // ensureCollabState computes stage from existing artifacts. With no
    // application or offer yet, it defaults to 'invited'. We pass the
    // brand user as actor so the history entry attributes correctly.
    // The invite message itself is captured as the history `reason` so
    // the creator-side UI can surface it without a separate Application.
    const collab = ensureCollabState(
      campaignId,
      creatorId,
      db,
      invitedByUserId,
      message ? `brand-invite: ${message.slice(0, 240)}` : 'brand-invite',
    );
    if (!collab) return null;

    // Notify creator. The notification body shows the brand's hook line
    // (truncated) so the creator can decide-at-a-glance from the bell
    // whether to open the campaign.
    const creatorUser = db.users.find((u) => u.creatorId === creatorId);
    if (creatorUser) {
      const brandName = db.brands.find((b) => b.id === camp.brandId)?.name ?? 'a brand';
      const preview = message ? ` — "${message.slice(0, 80)}${message.length > 80 ? '…' : ''}"` : '';
      db.notifications.push({
        id: newId('n'),
        userId: creatorUser.id,
        text: `${camp.title}: invitation from ${brandName}${preview}`,
        href: `/v2`,
        at: nowIso(),
        read: false,
        meta: { campaignId, collaborationId: collab.id },
      });
    }

    return collab;
  });
}

// =====================================================================
// P3 §2.3 — Cancel-collab (mutual-consent flow)
// =====================================================================
//
// Either side of a confirmed collab (stage in {confirmed, submitted})
// can request cancellation. The request lives on
// `Collaboration.cancellationRequest = { by, at, reason }` until the
// other side agrees or declines.
//
// On agree:
//   - Active escrow on the collab is refunded to the brand wallet
//     (mirror of v2EndCampaign's per-collab refund logic).
//   - Any in-flight Offer flips to 'withdrawn' so it doesn't stay
//     pending; in-flight Submission stays as historical record.
//   - Contract.status flips to 'cancelled', Contract.cancelledAt set.
//   - Collaboration.stage transitions to 'cancelled', cancelledAt + cancellationReason set.
//   - cancellationRequest cleared.
//
// On decline:
//   - cancellationRequest cleared.
//   - Collab stays in its current stage; the deal continues.
//
// Stage guard: only collabs with stage in {confirmed, submitted} can
// have a request raised. After 'approved' the brand has already approved
// the work; cancellation is a different beast (escrow already moved or
// is moving) and shouldn't run through this flow.

const CANCELLABLE_STAGES = new Set(['confirmed', 'submitted']);

/**
 * Internal helper: cancel a Collaboration in-place. Refunds escrow,
 * withdraws in-flight offers, marks contract cancelled, sets stage.
 * Used by `v2AgreeCollabCancel` and `v2EndCampaign` (auto-cancel path).
 */
function cancelCollabInternal(
  db: Database,
  collabId: string,
  reason: string,
  actorUserId: string,
): Collaboration | null {
  const collab = db.collaborations.find((c) => c.id === collabId);
  if (!collab) return null;
  const camp = db.campaigns.find((c) => c.id === collab.campaignId);
  const brand = camp ? db.brands.find((b) => b.id === camp.brandId) : null;
  const creator = db.creators.find((c) => c.id === collab.creatorId);

  // Find the accepted offer so we know how much escrow was held.
  const acceptedOffer = db.offers.find(
    (o) => o.campaignId === collab.campaignId && o.creatorId === collab.creatorId && o.status === 'accepted',
  );
  const refundAmount = acceptedOffer?.rate ?? 0;

  if (brand && refundAmount > 0) {
    // Pull escrow back to brand wallet — mirror of v2EndCampaign's
    // per-campaign refund logic but scoped to this single collab.
    //
    // BUG FIX: pre-fix this credited `walletBalance += refundAmount`
    // (full rate) but debited `escrowHeld -= fromCampaign` (potentially
    // smaller when escrow was partially drained — e.g. multi-collab
    // campaign with mis-accounted state, or dispute partial resolution
    // edge cases). The asymmetry created phantom dollars in the brand
    // wallet — credit > debit. Both legs now use `fromCampaign` so the
    // refund matches the actual recoverable amount. The creator's
    // pendingBalance reversal uses the same actual amount.
    const fromCampaign = camp ? Math.min(camp.escrowHeld, refundAmount) : 0;
    if (camp) {
      db.campaigns = db.campaigns.map((c) =>
        c.id === camp.id ? { ...c, escrowHeld: c.escrowHeld - fromCampaign } : c,
      );
    }
    db.brands = db.brands.map((b) =>
      b.id === brand.id
        ? {
            ...b,
            walletBalance: b.walletBalance + fromCampaign,
            escrowHeld: Math.max(0, b.escrowHeld - fromCampaign),
          }
        : b,
    );
    // Reverse the creator's pending balance hold using the SAME actual
    // refundable amount so the creator's pending drops match what the
    // brand recovered.
    if (creator) {
      const netHeld = netOf(fromCampaign);
      db.creators = db.creators.map((c) =>
        c.id === creator.id
          ? { ...c, pendingBalance: Math.max(0, c.pendingBalance - netHeld) }
          : c,
      );
    }
    db.transactions.push({
      id: newId('tx'),
      at: nowIso(),
      userId: brand.userId,
      kind: 'refund',
      amount: fromCampaign,
      status: 'cleared',
      campaignId: collab.campaignId,
      counterpartyUserId: creator?.userId,
      note: camp ? `Collab cancelled · ${camp.title}` : 'Collab cancelled',
    });
  }

  // Withdraw the in-flight offer so its status reflects the cancellation.
  if (acceptedOffer) {
    const idx = db.offers.findIndex((o) => o.id === acceptedOffer.id);
    if (idx !== -1) {
      db.offers[idx] = { ...db.offers[idx], status: 'withdrawn', respondedAt: nowIso() };
    }
  }

  // P67 — terminalize any still-open application on the pair. Pre-fix
  // the application stayed 'submitted'/'shortlisted' after a cancel,
  // so the ensureCollabState recompute below saw a live app signal and
  // rolled the stage back to 'pitched' instead of 'cancelled' — the
  // dead deal re-entered both kanbans as a ghost pitch. With the app
  // rejected + offer withdrawn, computeCollabStage's all-declined rule
  // lands 'cancelled' as this function always intended.
  db.applications = db.applications.map((a) =>
    a.campaignId === collab.campaignId &&
    a.creatorId === collab.creatorId &&
    (a.status === 'submitted' || a.status === 'shortlisted')
      ? { ...a, status: 'rejected' as const, decidedAt: nowIso() }
      : a,
  );

  // Mark contract cancelled.
  if (collab.contractId) {
    const ctr = db.contracts.find((x) => x.id === collab.contractId);
    if (ctr && ctr.status === 'active') {
      ctr.status = 'cancelled';
      ctr.cancelledAt = Date.now();
      // Phase 6 — fire-and-forget mirror of the cancel flip to Supabase.
      const cancelledAtMs = ctr.cancelledAt;
      const ctrId = ctr.id;
      if (typeof window !== 'undefined') {
        void (async () => {
          try {
            const { isSupabaseConfigured } = await import('@/lib/supabase');
            if (!isSupabaseConfigured()) return;
            const { updateContractInSupabase } = await import('@/lib/data/contractsRepo');
            await updateContractInSupabase(ctrId, {
              status: 'cancelled',
              cancelledAt: cancelledAtMs,
            });
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            if (/row-level security|no rows|0 rows|not found/i.test(msg)) return;
            // eslint-disable-next-line no-console
            console.warn('[contract cancelled mirror] failed:', msg);
          }
        })();
      }
    }
  }

  // Clear the request and recompute the stage. computeCollabStage will
  // see all-declined apps + withdrawn offer → 'cancelled'.
  collab.cancellationRequest = null;
  ensureCollabState(collab.campaignId, collab.creatorId, db, actorUserId, reason);

  // Notify both sides.
  const creatorUser = creator ? db.users.find((u) => u.id === creator.userId) : null;
  const brandUser = brand ? db.users.find((u) => u.id === brand.userId) : null;
  if (creatorUser && camp) {
    db.notifications.push({
      id: newId('n'),
      userId: creatorUser.id,
      text: `Collaboration cancelled · ${camp.title}`,
      href: `/v2`,
      at: nowIso(),
      read: false,
      meta: { campaignId: camp.id, collaborationId: collab.id },
    });
  }
  if (brandUser && camp && brandUser.id !== actorUserId) {
    db.notifications.push({
      id: newId('n'),
      userId: brandUser.id,
      text: `Collaboration cancelled · ${camp.title}`,
      href: `/v2`,
      at: nowIso(),
      read: false,
      meta: { campaignId: camp.id, collaborationId: collab.id },
    });
  }

  return collab;
}

/**
 * Either side requests collab cancellation. Sets `cancellationRequest`
 * on the Collaboration; the counterpart agrees via `v2AgreeCollabCancel`
 * or rejects via `v2DeclineCollabCancel`. Stage stays where it was —
 * just `cancellationRequest` flips from null to populated.
 */
export function v2RequestCollabCancel(
  collaborationId: string,
  byUserId: string,
  reason: string,
): Collaboration {
  return tx((db) => {
    // P5 §4.1 — both creator and brand-side admin/ops can request a
    // cancel. `application.invite` is held by both sides and is the
    // closest existing cap; if a brand-side viewer or finance user
    // tries this, the gate trips.
    requireCapability(getActorUserId(), 'application.invite', db);

    const collab = db.collaborations.find((c) => c.id === collaborationId);
    if (!collab) throw new Error("Couldn't find that collaboration — refresh and try again.");
    if (!CANCELLABLE_STAGES.has(collab.stage)) {
      throw new Error(`Can't cancel a collab in "${collab.stage}" — it's already past the cancellable window.`);
    }
    // A mutual cancel refunds escrow immediately, which would route around
    // an open dispute entirely — the admin decision is what's meant to
    // settle the money, and the dispute row would be left orphaned against
    // a cancelled collab. `v2EndCampaign` already filters on this; the
    // consent path never did.
    if (collab.escrowFrozen) {
      throw new Error('Escrow is frozen while a dispute is open on this collab. Resolve or withdraw the dispute first.');
    }
    if (collab.cancellationRequest) {
      throw new Error('A cancel request is already pending on this collab. Wait for the other side to respond.');
    }

    collab.cancellationRequest = {
      by: byUserId,
      at: Date.now(),
      reason,
    };
    collab.updatedAt = Date.now();

    // Notify the counterpart.
    const camp = db.campaigns.find((c) => c.id === collab.campaignId);
    const brand = db.brands.find((b) => b.id === collab.brandId);
    const creator = db.creators.find((c) => c.id === collab.creatorId);
    const requester = db.users.find((u) => u.id === byUserId);
    const requesterIsCreator = !!requester?.creatorId;
    const counterUserId = requesterIsCreator ? brand?.userId : creator?.userId;
    if (counterUserId && camp) {
      db.notifications.push({
        id: newId('n'),
        userId: counterUserId,
        text: `Cancel request · ${camp.title}${reason ? ` — "${reason.slice(0, 80)}${reason.length > 80 ? '…' : ''}"` : ''}`,
        href: `/v2`,
        at: nowIso(),
        read: false,
        meta: { campaignId: camp.id, collaborationId: collab.id },
      });
    }

    return collab;
  });
}

/**
 * Counterpart agrees to a pending cancellation request. Refunds escrow,
 * withdraws the offer, cancels the contract, transitions the collab.
 */
export function v2AgreeCollabCancel(
  collaborationId: string,
  byUserId: string,
): Collaboration {
  return tx((db) => {
    // P5 §4.1 — same gate as request.
    requireCapability(getActorUserId(), 'application.invite', db);

    const collab = db.collaborations.find((c) => c.id === collaborationId);
    if (!collab) throw new Error("Couldn't find that collaboration — refresh and try again.");
    if (!collab.cancellationRequest) {
      throw new Error('No pending cancel request on this collab — nothing to agree to.');
    }
    if (collab.cancellationRequest.by === byUserId) {
      throw new Error("You opened this cancel request — you can't agree to it yourself. Wait for the other side.");
    }
    // Same guard as the request side: a dispute can be raised after the
    // request was opened, so agreeing must re-check rather than trust it.
    if (collab.escrowFrozen) {
      throw new Error('Escrow is frozen while a dispute is open on this collab. Resolve or withdraw the dispute first.');
    }

    const reason = `mutual-cancel: ${collab.cancellationRequest.reason}`;
    const updated = cancelCollabInternal(db, collaborationId, reason, byUserId);
    if (!updated) throw new Error('Cancellation failed mid-flight. Refresh and check the collab state.');
    return updated;
  });
}

/**
 * Counterpart declines a pending cancellation request. Clears the
 * request; the collab continues from where it was.
 */
export function v2DeclineCollabCancel(
  collaborationId: string,
  byUserId: string,
): Collaboration {
  return tx((db) => {
    // P5 §4.1 — same gate as request/agree.
    requireCapability(getActorUserId(), 'application.invite', db);

    const collab = db.collaborations.find((c) => c.id === collaborationId);
    if (!collab) throw new Error("Couldn't find that collaboration — refresh and try again.");
    if (!collab.cancellationRequest) {
      throw new Error('No pending cancel request on this collab — nothing to decline.');
    }
    if (collab.cancellationRequest.by === byUserId) {
      throw new Error("You opened this cancel request — you can't decline it yourself. Withdraw the request instead.");
    }

    const requesterUserId = collab.cancellationRequest.by;
    collab.cancellationRequest = null;
    collab.updatedAt = Date.now();

    // Notify the original requester that their request was declined.
    const camp = db.campaigns.find((c) => c.id === collab.campaignId);
    if (camp) {
      db.notifications.push({
        id: newId('n'),
        userId: requesterUserId,
        text: `Cancel request declined · ${camp.title}`,
        href: `/v2`,
        at: nowIso(),
        read: false,
        meta: { campaignId: camp.id, collaborationId: collab.id },
      });
    }

    return collab;
  });
}

/** Internal export — also used by v2EndCampaign's auto-cancel pass. */
// =====================================================================
// PARTIAL SETTLEMENT (WORKFLOW-GAPS F1)
// =====================================================================
//
// Cancellation is all-or-nothing: escrow returns to the brand. That is the
// wrong answer when a creator delivered 3 of 4 slots and then went quiet —
// the work exists, someone has to be paid for it, and today the fourth slot
// simply sits forever with the money frozen behind it.
//
// A settlement splits the held amount. It requires BOTH parties to agree
// (Asim's call): the escrow is money both have a claim on, so neither side
// gets to decide unilaterally, and the platform does not arbitrate — that is
// what disputes are for.
//
// Shape mirrors the cancellation handshake deliberately: propose → the OTHER
// party agrees or declines. Reusing the pattern means one mental model for
// "we need to agree on something", not two.

/** Escrow actually recoverable for this pair, clamped to the campaign's
 *  remaining hold.
 *
 *  The clamp is not defensive noise: `cancelCollabInternal` carries a bug-fix
 *  note about crediting the full rate while debiting a smaller campaign hold,
 *  which minted phantom dollars. Same trap here, so the same clamp. */
function settleableEscrow(db: Database, collab: Collaboration): number {
  const acceptedOffer = db.offers.find(
    (o) => o.campaignId === collab.campaignId && o.creatorId === collab.creatorId && o.status === 'accepted',
  );
  const held = acceptedOffer?.rate ?? 0;
  const camp = db.campaigns.find((c) => c.id === collab.campaignId);
  return camp ? Math.min(camp.escrowHeld, held) : 0;
}

/** How much is on the table, for the UI to bound its input. */
export function v2SettleableAmount(collabId: string): number {
  const db = useStore.getState().db;
  const collab = db.collaborations.find((c: Collaboration) => c.id === collabId);
  return collab ? settleableEscrow(db, collab) : 0;
}

/**
 * Propose splitting the held escrow. Either side may propose.
 *
 * `releaseToCreator` is GROSS — the creator receives it net of fee and
 * withholding, exactly as an approval would pay, because it IS a payment for
 * work done rather than a special case.
 */
export function v2ProposeSettlement(
  collabId: string,
  releaseToCreator: number,
  note: string,
  byUserId: string,
): Collaboration {
  return tx((db) => {
    const collab = db.collaborations.find((c) => c.id === collabId);
    if (!collab) throw new Error("Couldn't find that collaboration — refresh and try again.");
    if (collab.escrowFrozen) {
      throw new Error('Escrow is frozen while a dispute is open. Resolve the dispute instead — that is where a split gets arbitrated.');
    }
    if (collab.cancelledAt) throw new Error('This collaboration is already closed.');
    if (collab.settlementProposal) {
      throw new Error('A settlement is already on the table. Wait for the other side, or withdraw it first.');
    }

    const available = settleableEscrow(db, collab);
    if (available <= 0) {
      throw new Error('There is no escrow held on this collaboration to settle.');
    }
    if (!Number.isFinite(releaseToCreator) || releaseToCreator < 0 || releaseToCreator > available) {
      throw new Error(`Enter an amount between $0 and $${available.toLocaleString()} — that is what is actually held.`);
    }
    if (!note.trim()) {
      throw new Error('Add a note explaining the split — the other side has to agree to it.');
    }

    collab.settlementProposal = {
      by: byUserId,
      at: Date.now(),
      releaseToCreator: Math.round(releaseToCreator),
      note: note.trim(),
    };
    collab.updatedAt = Date.now();

    const camp = db.campaigns.find((c) => c.id === collab.campaignId);
    const creatorUser = db.users.find((u) => u.creatorId === collab.creatorId);
    const brandUser = db.users.find((u) => u.brandId === collab.brandId);
    // Notify whoever did NOT propose.
    const recipient = byUserId === creatorUser?.id ? brandUser : creatorUser;
    if (recipient && camp) {
      db.notifications.push({
        id: newId('n'),
        userId: recipient.id,
        text: `Settlement proposed on ${camp.title}: $${Math.round(releaseToCreator).toLocaleString()} to the creator, the rest refunded — needs your agreement`,
        href: '/creator/collabs',
        at: nowIso(),
        read: false,
      });
    }
    return collab;
  });
}

/**
 * Agree to the proposed split, and move the money.
 *
 * The proposer cannot accept their own proposal — that is the entire point of
 * requiring agreement, and without the check a settlement would be a
 * unilateral escrow withdrawal wearing a handshake's clothes.
 */
export function v2AgreeSettlement(collabId: string, byUserId: string): Collaboration {
  return tx((db) => {
    const collab = db.collaborations.find((c) => c.id === collabId);
    if (!collab) throw new Error("Couldn't find that collaboration — refresh and try again.");
    const proposal = collab.settlementProposal;
    if (!proposal) throw new Error('There is no settlement proposal on this collaboration.');
    if (proposal.by === byUserId) {
      throw new Error("You proposed this settlement — the other side has to agree to it.");
    }
    if (collab.escrowFrozen) {
      throw new Error('Escrow is frozen while a dispute is open. Resolve the dispute instead.');
    }

    const camp = db.campaigns.find((c) => c.id === collab.campaignId);
    const brand = db.brands.find((b) => b.id === collab.brandId);
    const creator = db.creators.find((c) => c.id === collab.creatorId);

    // Re-clamp at agreement time: escrow may have moved since the proposal.
    const available = settleableEscrow(db, collab);
    const releaseGross = Math.min(proposal.releaseToCreator, available);
    const refund = available - releaseGross;
    const { fee, tax, net } = splitGross(releaseGross);

    if (camp) {
      db.campaigns = db.campaigns.map((c) =>
        c.id === camp.id
          ? { ...c, escrowHeld: Math.max(0, c.escrowHeld - available), spent: c.spent + releaseGross }
          : c,
      );
    }
    if (brand) {
      db.brands = db.brands.map((b) =>
        b.id === brand.id
          ? {
              ...b,
              escrowHeld: Math.max(0, b.escrowHeld - available),
              walletBalance: b.walletBalance + refund,
            }
          : b,
      );
    }
    if (creator) {
      db.creators = db.creators.map((c) =>
        c.id === creator.id
          ? {
              ...c,
              // The whole hold clears; only the settled part becomes wallet.
              pendingBalance: Math.max(0, c.pendingBalance - netOf(available)),
              walletBalance: c.walletBalance + net,
              lifetimeEarnings: c.lifetimeEarnings + net,
            }
          : c,
      );
    }

    const ts = nowIso();
    const title = camp?.title ?? 'collaboration';
    if (brand && releaseGross > 0) {
      // Same ledger convention as every other release: the payout row carries
      // GROSS and the deductions do real work, so the creator's rows sum to
      // what their wallet actually gained.
      db.transactions.push({
        id: newId('tx'), at: ts, userId: brand.userId, kind: 'escrow_release',
        amount: -releaseGross, status: 'cleared', campaignId: collab.campaignId,
        counterpartyUserId: creator?.userId, note: `Settlement · ${title}`,
      });
      if (creator) {
        db.transactions.push({
          id: newId('tx'), at: ts, userId: creator.userId, kind: 'payout',
          amount: releaseGross, status: 'cleared', campaignId: collab.campaignId,
          counterpartyUserId: brand.userId, note: `Settlement from ${brand.name} · ${title}`,
        });
        db.transactions.push({
          id: newId('tx'), at: ts, userId: creator.userId, kind: 'fee',
          amount: -fee, status: 'cleared', campaignId: collab.campaignId,
          note: `Platform fee (${Math.round(PLATFORM_FEE * 100)}%)`,
        });
        db.transactions.push({
          id: newId('tx'), at: ts, userId: creator.userId, kind: 'fee',
          amount: -tax, status: 'cleared', campaignId: collab.campaignId,
          note: `Withholding tax (${Math.round(WHT * 100)}%)`,
        });
      }
    }
    if (brand && refund > 0) {
      db.transactions.push({
        id: newId('tx'), at: ts, userId: brand.userId, kind: 'refund',
        amount: refund, status: 'cleared', campaignId: collab.campaignId,
        counterpartyUserId: creator?.userId, note: `Settlement refund · ${title}`,
      });
    }

    // Close the deal out. Offer withdrawn + open applications terminalized is
    // what lets `computeCollabStage` reach `cancelled` — the same treatment a
    // cancellation gets, because a settled deal is equally finished.
    const acceptedOffer = db.offers.find(
      (o) => o.campaignId === collab.campaignId && o.creatorId === collab.creatorId && o.status === 'accepted',
    );
    if (acceptedOffer) {
      const idx = db.offers.findIndex((o) => o.id === acceptedOffer.id);
      if (idx !== -1) db.offers[idx] = { ...db.offers[idx], status: 'withdrawn', respondedAt: ts };
    }
    db.applications = db.applications.map((a) =>
      a.campaignId === collab.campaignId && a.creatorId === collab.creatorId &&
      (a.status === 'submitted' || a.status === 'shortlisted')
        ? { ...a, status: 'rejected' as const, decidedAt: ts }
        : a,
    );

    collab.settlementProposal = null;
    collab.cancelledAt = Date.now();
    collab.cancellationReason = `settled · $${releaseGross.toLocaleString()} released, $${refund.toLocaleString()} refunded`;
    collab.updatedAt = Date.now();

    const creatorUser = db.users.find((u) => u.creatorId === collab.creatorId);
    const brandUser = db.users.find((u) => u.brandId === collab.brandId);
    for (const u of [creatorUser, brandUser]) {
      if (!u) continue;
      db.notifications.push({
        id: newId('n'), userId: u.id,
        text: `${title} settled — $${releaseGross.toLocaleString()} released to the creator, $${refund.toLocaleString()} refunded`,
        href: u.id === creatorUser?.id ? '/creator/earnings' : '/brand/wallet',
        at: ts, read: false,
      });
    }

    ensureCollabState(collab.campaignId, collab.creatorId, db, byUserId, 'settled');
    return collab;
  });
}

/** Turn down a proposed split. Clears the proposal so either side can make a
 *  different one; nothing moves. */
export function v2DeclineSettlement(collabId: string, byUserId: string, reason?: string): Collaboration {
  return tx((db) => {
    const collab = db.collaborations.find((c) => c.id === collabId);
    if (!collab) throw new Error("Couldn't find that collaboration — refresh and try again.");
    const proposal = collab.settlementProposal;
    if (!proposal) throw new Error('There is no settlement proposal to decline.');
    if (proposal.by === byUserId) {
      throw new Error('You proposed this — withdraw it rather than declining your own offer.');
    }
    collab.settlementProposal = null;
    collab.updatedAt = Date.now();

    const camp = db.campaigns.find((c) => c.id === collab.campaignId);
    const proposerUser = db.users.find((u) => u.id === proposal.by);
    if (proposerUser && camp) {
      db.notifications.push({
        id: newId('n'), userId: proposerUser.id,
        text: `Your settlement proposal on ${camp.title} was declined${reason ? `: ${reason}` : ''}`,
        href: '/creator/collabs', at: nowIso(), read: false,
      });
    }
    return collab;
  });
}

export const __cancelCollabInternal = cancelCollabInternal;
