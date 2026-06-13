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

import { tx } from '@/lib/api/store';
import type { Collaboration, Database } from '@/lib/api/types';
import { ensureCollabState } from '@/lib/api/collabSync';
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
      const PLATFORM_FEE = 0.10;
      const WHT = 0.05;
      const netHeld = Math.round(fromCampaign * (1 - PLATFORM_FEE - WHT));
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
export const __cancelCollabInternal = cancelCollabInternal;
