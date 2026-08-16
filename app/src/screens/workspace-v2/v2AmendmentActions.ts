// v2AmendmentActions.ts — changing a deal after it was accepted.
//
// WORKFLOW-GAPS E2 + E3.
//
// Every term was frozen at acceptance, so the two commonest things real deals
// do had no representation:
//
//   E2 — the brand wants to keep running the asset past the licence window.
//        The Creator Agreement grants rights for the brief's duration and
//        there was no way to extend, pay for, or record an extension.
//   E3 — the brand wants one more Story for an agreed bump. Routine
//        everywhere; here it required a whole second campaign.
//
// Both are the F1/F3 handshake again: one side proposes with a figure, the
// OTHER agrees or declines. Three features now share that shape, which is one
// mental model instead of three, and the guards that make it safe — you
// cannot agree to your own proposal, only the two parties can act — are the
// same guards, written once per module because each has a different notion of
// "the parties".
//
// WHERE THE MONEY GOES, and why the two kinds differ:
//
//   rights-extension  PAYS OUT ON AGREEMENT. There is no deliverable to
//                     approve, so escrow would have nothing to release
//                     against; holding the money would freeze it for up to a
//                     year against work already delivered. Net of fee and
//                     withholding, same ledger convention as every release.
//
//   scope-addition    FUNDS ESCROW. It creates real new work, so it flows
//                     through the ordinary submit → approve → pay path and
//                     the deal reopens to `confirmed` until the slot lands.
//                     Anything else would pay for work before it exists.
//
// Both were Asim's calls, made explicitly.

import { tx, useStore } from '@/lib/api/store';
import type {
  Amendment, AmendmentKind, Collaboration, ContentRights, Database, Deliverable,
} from '@/lib/api/types';
import { ensureCollabState } from '@/lib/api/collabSync';
import { netOf, splitGross, PLATFORM_FEE, WHT } from '@/lib/api/money';

function newId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}
const nowIso = () => new Date().toISOString();

/** Widest-first, so "extend to" comparisons are ordinal rather than ad hoc. */
const REPURPOSE_ORDER: ContentRights['repurpose'][] = ['none', '90d', '180d', '365d', 'perpetual'];
const EXCLUSIVITY_ORDER: ContentRights['exclusivity'][] = ['none', '30d', '60d', '90d'];

const DEFAULT_RIGHTS: ContentRights = {
  exclusivity: 'none',
  whitelistAds: false,
  repurpose: 'none',
  derivative: false,
  organicOnly: true,
};

/**
 * The rights actually in force on this deal right now.
 *
 * Order matters: the CONTRACT snapshot wins over the campaign, because the
 * campaign's `rights` can be edited by the brand after acceptance and the
 * snapshot is what the creator signed. Agreed extensions then widen it.
 *
 * Falls back to the campaign for contracts written before `rightsSnapshot`
 * existed, and to a conservative default when there is nothing at all —
 * never to "perpetual", which would invent a licence nobody granted.
 */
export function effectiveRights(db: Database, collab: Collaboration): ContentRights {
  const contract = collab.contractId
    ? db.contracts.find((c) => c.id === collab.contractId)
    : undefined;
  const camp = db.campaigns.find((c) => c.id === collab.campaignId);
  const base: ContentRights = contract?.rightsSnapshot
    ?? camp?.rights
    ?? DEFAULT_RIGHTS;

  let out: ContentRights = { ...base };
  for (const a of collab.amendments ?? []) {
    if (a.status !== 'agreed' || a.kind !== 'rights-extension') continue;
    if (a.repurposeTo
        && REPURPOSE_ORDER.indexOf(a.repurposeTo) > REPURPOSE_ORDER.indexOf(out.repurpose)) {
      out = { ...out, repurpose: a.repurposeTo };
    }
    if (a.exclusivityTo
        && EXCLUSIVITY_ORDER.indexOf(a.exclusivityTo) > EXCLUSIVITY_ORDER.indexOf(out.exclusivity)) {
      out = { ...out, exclusivity: a.exclusivityTo };
    }
  }
  return out;
}

/** Read-only: amendments on a collab, newest first. */
export function v2Amendments(collabId: string): Amendment[] {
  const db = useStore.getState().db;
  const collab = db.collaborations.find((c) => c.id === collabId);
  return [...(collab?.amendments ?? [])].sort((a, b) => b.proposedAt - a.proposedAt);
}

/** The live proposal, if any. Only one may be open at a time. */
export function v2OpenAmendment(collabId: string): Amendment | null {
  return v2Amendments(collabId).find((a) => a.status === 'proposed') ?? null;
}

/** Which side of this deal is this user on? */
function partyRole(db: Database, collab: Collaboration, userId: string): 'brand' | 'creator' | null {
  const u = db.users.find((x) => x.id === userId);
  if (!u) return null;
  if (u.creatorId && u.creatorId === collab.creatorId) return 'creator';
  if (u.brandId && u.brandId === collab.brandId) return 'brand';
  return null;
}

function otherPartyUserId(db: Database, collab: Collaboration, userId: string): string | null {
  const creatorUser = db.users.find((u) => u.creatorId === collab.creatorId);
  const brandUser = db.users.find((u) => u.brandId === collab.brandId);
  if (userId === creatorUser?.id) return brandUser?.id ?? null;
  if (userId === brandUser?.id) return creatorUser?.id ?? null;
  return null;
}

export interface ProposeAmendmentInput {
  kind: AmendmentKind;
  amount: number;
  note: string;
  repurposeTo?: ContentRights['repurpose'];
  exclusivityTo?: ContentRights['exclusivity'];
  addDeliverable?: Amendment['addDeliverable'];
}

/**
 * Propose a change to an accepted deal. Either side may propose — a creator
 * offering wider rights for a fee is as legitimate as a brand asking for them.
 */
export function v2ProposeAmendment(
  collabId: string,
  input: ProposeAmendmentInput,
  byUserId: string,
): Collaboration {
  return tx((db) => {
    const collab = db.collaborations.find((c) => c.id === collabId);
    if (!collab) throw new Error("Couldn't find that collaboration — refresh and try again.");
    if (collab.cancelledAt) throw new Error('This collaboration is closed.');
    if (collab.escrowFrozen) {
      throw new Error('Escrow is frozen while a dispute is open. Settle the dispute first.');
    }
    if (!partyRole(db, collab, byUserId)) {
      throw new Error('Only the brand or the creator on this deal can propose a change.');
    }
    // A deal has to have been agreed before there is anything to amend.
    if (!collab.acceptedOfferId) {
      throw new Error('Nothing to amend yet — this deal has not been accepted.');
    }
    if ((collab.amendments ?? []).some((a) => a.status === 'proposed')) {
      throw new Error('A change is already on the table. Wait for the other side, or withdraw it first.');
    }
    if (!Number.isFinite(input.amount) || input.amount <= 0) {
      throw new Error('Enter an amount greater than $0 — an amendment is a paid change.');
    }
    if (!input.note.trim()) {
      throw new Error('Add a note explaining the change — the other side has to agree to it.');
    }

    if (input.kind === 'rights-extension') {
      if (!input.repurposeTo && !input.exclusivityTo) {
        throw new Error('Pick what to extend — a longer re-use window, a longer exclusivity, or both.');
      }
      // Refuse a "widening" that narrows or does nothing: it would take the
      // creator's money for a licence they already granted.
      const current = effectiveRights(db, collab);
      const widensRepurpose = input.repurposeTo
        && REPURPOSE_ORDER.indexOf(input.repurposeTo) > REPURPOSE_ORDER.indexOf(current.repurpose);
      const widensExclusivity = input.exclusivityTo
        && EXCLUSIVITY_ORDER.indexOf(input.exclusivityTo) > EXCLUSIVITY_ORDER.indexOf(current.exclusivity);
      if (!widensRepurpose && !widensExclusivity) {
        throw new Error('That is not wider than the rights already granted — nothing to pay for.');
      }
    } else if (!input.addDeliverable) {
      throw new Error('Pick the deliverable to add.');
    }

    const amendment: Amendment = {
      id: newId('amd'),
      kind: input.kind,
      proposedBy: byUserId,
      proposedAt: Date.now(),
      amount: Math.round(input.amount),
      note: input.note.trim(),
      repurposeTo: input.repurposeTo,
      exclusivityTo: input.exclusivityTo,
      addDeliverable: input.addDeliverable,
      status: 'proposed',
      decidedAt: null,
      decidedBy: null,
    };
    collab.amendments = [...(collab.amendments ?? []), amendment];
    collab.updatedAt = Date.now();

    const camp = db.campaigns.find((c) => c.id === collab.campaignId);
    const recipient = otherPartyUserId(db, collab, byUserId);
    if (recipient && camp) {
      const what = input.kind === 'rights-extension'
        ? 'a longer usage licence'
        : 'an extra deliverable';
      db.notifications.push({
        id: newId('n'),
        userId: recipient,
        text: `Change proposed on ${camp.title}: ${what} for $${amendment.amount.toLocaleString()} — needs your agreement`,
        href: '/v2',
        at: nowIso(),
        read: false,
        meta: { campaignId: camp.id, collaborationId: collab.id },
      });
    }
    return collab;
  });
}

/**
 * Agree to a proposed change, and move the money.
 *
 * The proposer cannot agree to their own proposal — without that check an
 * amendment is a unilateral charge (or a unilateral raise) dressed as a deal.
 */
export function v2AgreeAmendment(collabId: string, amendmentId: string, byUserId: string): Collaboration {
  return tx((db) => {
    const collab = db.collaborations.find((c) => c.id === collabId);
    if (!collab) throw new Error("Couldn't find that collaboration — refresh and try again.");
    const amendment = (collab.amendments ?? []).find((a) => a.id === amendmentId);
    if (!amendment) throw new Error('There is no such change on this collaboration.');
    if (amendment.status !== 'proposed') throw new Error('That change has already been decided.');
    if (amendment.proposedBy === byUserId) {
      throw new Error('You proposed this change — the other side has to agree to it.');
    }
    if (!partyRole(db, collab, byUserId)) {
      throw new Error('Only the brand or the creator on this deal can agree to a change.');
    }
    if (collab.escrowFrozen) {
      throw new Error('Escrow is frozen while a dispute is open. Settle the dispute first.');
    }

    const camp = db.campaigns.find((c) => c.id === collab.campaignId);
    const brand = db.brands.find((b) => b.id === collab.brandId);
    const creator = db.creators.find((c) => c.id === collab.creatorId);
    if (!camp || !brand || !creator) throw new Error("Couldn't load this deal — refresh and try again.");

    const brandUser = db.users.find((u) => u.brandId === brand.id);
    const creatorUser = db.users.find((u) => u.creatorId === creator.id);
    const gross = amendment.amount;

    // FUNDS GUARD — the same one offer-acceptance carries. Pre-fix elsewhere
    // this clamped to zero while still crediting the creator, letting them
    // withdraw money the brand never funded.
    if (brand.walletBalance < gross) {
      throw new Error(`${brand.name}'s wallet is short for this change. They need to top up first.`);
    }

    const ts = nowIso();

    if (amendment.kind === 'rights-extension') {
      // Paid out now: no deliverable, so nothing to hold it against.
      const { fee, tax, net } = splitGross(gross);
      db.brands = db.brands.map((b) =>
        b.id === brand.id ? { ...b, walletBalance: b.walletBalance - gross } : b,
      );
      db.creators = db.creators.map((c) =>
        c.id === creator.id
          ? {
              ...c,
              walletBalance: c.walletBalance + net,
              lifetimeEarnings: c.lifetimeEarnings + net,
            }
          : c,
      );
      db.campaigns = db.campaigns.map((c) =>
        c.id === camp.id ? { ...c, spent: c.spent + gross } : c,
      );

      if (brandUser && creatorUser) {
        // Brand-side outflow uses `escrow_release`, the ledger's existing
        // category for "paid to a creator", so the brand's spend column
        // stays complete. No `escrow_hold` row is written because nothing
        // was ever held — inventing one to make the pair look symmetrical
        // would be the ledger telling a small lie.
        db.transactions.push({
          id: newId('tx'), at: ts, userId: brandUser.id, kind: 'escrow_release',
          amount: -gross, status: 'cleared', campaignId: camp.id,
          counterpartyUserId: creatorUser.id,
          note: `Usage rights extension · ${camp.title}`,
        });
        db.transactions.push({
          id: newId('tx'), at: ts, userId: creatorUser.id, kind: 'payout',
          amount: gross, status: 'cleared', campaignId: camp.id,
          counterpartyUserId: brandUser.id,
          note: `Rights extension from ${brand.name} · ${camp.title}`,
        });
        db.transactions.push({
          id: newId('tx'), at: ts, userId: creatorUser.id, kind: 'fee',
          amount: -fee, status: 'cleared', campaignId: camp.id,
          note: `Platform fee (${Math.round(PLATFORM_FEE * 100)}%)`,
        });
        db.transactions.push({
          id: newId('tx'), at: ts, userId: creatorUser.id, kind: 'fee',
          amount: -tax, status: 'cleared', campaignId: camp.id,
          note: `Withholding tax (${Math.round(WHT * 100)}%)`,
        });
      }
    } else {
      // Scope addition: fund escrow and add the slot. Releases the normal way.
      db.brands = db.brands.map((b) =>
        b.id === brand.id
          ? { ...b, walletBalance: b.walletBalance - gross, escrowHeld: b.escrowHeld + gross }
          : b,
      );
      db.campaigns = db.campaigns.map((c) =>
        c.id === camp.id ? { ...c, escrowHeld: c.escrowHeld + gross } : c,
      );
      db.creators = db.creators.map((c) =>
        c.id === creator.id ? { ...c, pendingBalance: c.pendingBalance + netOf(gross) } : c,
      );

      // The new slot, scoped to THIS creator. Index continues the campaign's
      // sequence so ordering stays stable; `creatorId` is what stops it
      // landing on everyone else's collab.
      const maxIndex = db.deliverables
        .filter((d) => d.campaignId === camp.id)
        .reduce((m, d) => Math.max(m, d.index), -1);
      const del: Deliverable = {
        id: newId('del'),
        campaignId: camp.id,
        creatorId: creator.id,
        index: maxIndex + 1,
        platform: amendment.addDeliverable!.platform,
        format: amendment.addDeliverable!.format,
        quantity: 1,
        dueOffsetDays: null,
        specs: amendment.addDeliverable!.specs ?? null,
      };
      db.deliverables.push(del);

      if (brandUser && creatorUser) {
        db.transactions.push({
          id: newId('tx'), at: ts, userId: brandUser.id, kind: 'escrow_hold',
          amount: -gross, status: 'cleared', campaignId: camp.id,
          counterpartyUserId: creatorUser.id,
          note: `Escrow held for added deliverable · ${camp.title}`,
        });
      }
    }

    amendment.status = 'agreed';
    amendment.decidedAt = Date.now();
    amendment.decidedBy = byUserId;
    collab.amendments = (collab.amendments ?? []).map((a) => (a.id === amendmentId ? amendment : a));
    collab.updatedAt = Date.now();

    for (const u of [brandUser, creatorUser]) {
      if (!u) continue;
      db.notifications.push({
        id: newId('n'), userId: u.id,
        text: amendment.kind === 'rights-extension'
          ? `Usage rights extended on ${camp.title} — $${gross.toLocaleString()} paid`
          : `Extra deliverable added to ${camp.title} — $${gross.toLocaleString()} held in escrow`,
        href: '/v2', at: ts, read: false,
        meta: { campaignId: camp.id, collaborationId: collab.id },
      });
    }

    // A scope addition reopens the deal: there is unfinished work again, so
    // the recompute pulls the stage back off `approved`/`paid` to `confirmed`.
    // A rights extension changes no slot, so the stage is untouched.
    ensureCollabState(
      collab.campaignId, collab.creatorId, db, byUserId,
      `amendment-agreed:${amendment.kind}`,
    );
    return collab;
  });
}

/** Turn down a proposed change. It stays on the record as declined. */
export function v2DeclineAmendment(
  collabId: string, amendmentId: string, byUserId: string, reason?: string,
): Collaboration {
  return tx((db) => {
    const collab = db.collaborations.find((c) => c.id === collabId);
    if (!collab) throw new Error("Couldn't find that collaboration — refresh and try again.");
    const amendment = (collab.amendments ?? []).find((a) => a.id === amendmentId);
    if (!amendment) throw new Error('There is no such change on this collaboration.');
    if (amendment.status !== 'proposed') throw new Error('That change has already been decided.');
    if (amendment.proposedBy === byUserId) {
      throw new Error('You proposed this — withdraw it rather than declining your own offer.');
    }
    if (!partyRole(db, collab, byUserId)) {
      throw new Error('Only the brand or the creator on this deal can decline a change.');
    }

    amendment.status = 'declined';
    amendment.decidedAt = Date.now();
    amendment.decidedBy = byUserId;
    collab.amendments = (collab.amendments ?? []).map((a) => (a.id === amendmentId ? amendment : a));
    collab.updatedAt = Date.now();

    const camp = db.campaigns.find((c) => c.id === collab.campaignId);
    if (camp) {
      db.notifications.push({
        id: newId('n'), userId: amendment.proposedBy,
        text: `Your proposed change on ${camp.title} was declined${reason ? `: ${reason}` : ''}`,
        href: '/v2', at: nowIso(), read: false,
        meta: { campaignId: camp.id, collaborationId: collab.id },
      });
    }
    return collab;
  });
}

/** Withdraw your own proposal. */
export function v2WithdrawAmendment(collabId: string, amendmentId: string, byUserId: string): Collaboration {
  return tx((db) => {
    const collab = db.collaborations.find((c) => c.id === collabId);
    if (!collab) throw new Error("Couldn't find that collaboration — refresh and try again.");
    const amendment = (collab.amendments ?? []).find((a) => a.id === amendmentId);
    if (!amendment) throw new Error('There is no such change on this collaboration.');
    if (amendment.status !== 'proposed') throw new Error('That change has already been decided.');
    if (amendment.proposedBy !== byUserId) {
      throw new Error("You can't withdraw the other side's proposal — decline it instead.");
    }
    amendment.status = 'withdrawn';
    amendment.decidedAt = Date.now();
    amendment.decidedBy = byUserId;
    collab.amendments = (collab.amendments ?? []).map((a) => (a.id === amendmentId ? amendment : a));
    collab.updatedAt = Date.now();
    return collab;
  });
}
