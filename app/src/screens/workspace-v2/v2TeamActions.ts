// v2TeamActions.ts — who inside a brand owns a deal.
//
// WORKFLOW-GAPS D2.
//
// A brand is a team, but a deal belonged to the brand as a WHOLE. Every
// notification, every "your move" prompt, every chase went to whichever user
// happened to hold the `brandId`. When that person left, changed roles, or
// went on leave, the deal had no human attached to it and simply stopped
// moving — which is precisely the failure the demo's own seeded dispute
// describes: "this sat with someone who has left".
//
// Reassignment is deliberately NOT a capability-gated admin action alone: the
// person who most often needs to hand a deal over is the person holding it,
// and requiring a manager for that turns a thirty-second handover into a
// ticket. Either the current owner or someone with `team.manage` can move it.

import { tx, useStore } from '@/lib/api/store';
import type { Collaboration, Database } from '@/lib/api/types';
import { hasCapability } from '@/lib/permissions';

function newId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * The user on the brand side responsible for this deal.
 *
 * ONE definition, because the alternative is that a notification goes to the
 * owner while the UI shows the primary user as responsible — the "one label,
 * two quantities" class this codebase has already paid for.
 *
 * Falls back to the brand's primary user, which is correct for every deal
 * nobody has explicitly assigned.
 */
export function dealOwnerUserId(db: Database, collab: Pick<Collaboration, 'brandId' | 'ownerUserId'>): string | null {
  if (collab.ownerUserId) {
    // Guard against a stale pointer: a user removed from the team should not
    // silently keep receiving a live deal's notifications.
    const still = db.users.find((u) => u.id === collab.ownerUserId && u.brandId === collab.brandId);
    if (still) return still.id;
  }
  return db.users.find((u) => u.brandId === collab.brandId)?.id ?? null;
}

/** Everyone on this brand's team, for the assignee picker. */
export function brandTeam(db: Database, brandId: string): { id: string; email: string; teamRole?: string }[] {
  return db.users
    .filter((u) => u.brandId === brandId && u.status === 'active')
    .map((u) => ({ id: u.id, email: u.email, teamRole: u.teamRole }));
}

/** Hand a deal to a teammate. */
export function v2ReassignCollab(collabId: string, toUserId: string, byUserId: string): Collaboration {
  return tx((db) => {
    const collab = db.collaborations.find((c) => c.id === collabId);
    if (!collab) throw new Error("Couldn't find that collaboration — refresh and try again.");
    if (collab.cancelledAt) throw new Error('This collaboration is closed.');

    const actor = db.users.find((u) => u.id === byUserId);
    if (!actor || actor.brandId !== collab.brandId) {
      throw new Error('Only someone on the brand team can reassign this deal.');
    }
    const target = db.users.find((u) => u.id === toUserId);
    if (!target || target.brandId !== collab.brandId) {
      // The check that matters: without it, a deal could be assigned to a
      // stranger, who would then receive the brand's private notifications.
      throw new Error('You can only assign a deal to someone on your own team.');
    }
    if (target.status !== 'active') {
      throw new Error('That teammate’s account is not active.');
    }

    const currentOwner = dealOwnerUserId(db, collab);
    if (currentOwner === toUserId) {
      throw new Error('That teammate already owns this deal.');
    }
    // Either the person holding it, or someone who manages the team.
    if (currentOwner !== byUserId && !hasCapability(byUserId, 'team.manage', db)) {
      throw new Error('Only the current owner or a team manager can reassign this deal.');
    }

    collab.ownerUserId = toUserId;
    collab.updatedAt = Date.now();

    const camp = db.campaigns.find((c) => c.id === collab.campaignId);
    const creator = db.creators.find((c) => c.id === collab.creatorId);
    const title = camp?.title ?? 'a campaign';
    const at = new Date().toISOString();

    db.notifications.push({
      id: newId('n'), userId: toUserId,
      text: `${creator?.name ?? 'A creator'} on ${title} is now yours to run`,
      href: '/v2', at, read: false,
      meta: { campaignId: collab.campaignId, collaborationId: collab.id },
    });
    // Tell the person who had it, unless they handed it over themselves.
    if (currentOwner && currentOwner !== byUserId) {
      db.notifications.push({
        id: newId('n'), userId: currentOwner,
        text: `${title} · ${creator?.name ?? 'a creator'} was reassigned to ${target.email}`,
        href: '/v2', at, read: false,
        meta: { campaignId: collab.campaignId, collaborationId: collab.id },
      });
    }

    collab.history = [
      ...collab.history,
      { at: Date.now(), from: collab.stage, to: collab.stage, actorUserId: byUserId, reason: `reassigned:${toUserId}` },
    ];
    return collab;
  });
}

/** Read-only: the owner's display handle, for the card. */
export function dealOwnerLabel(collabId: string): string | null {
  const db = useStore.getState().db;
  const collab = db.collaborations.find((c) => c.id === collabId);
  if (!collab) return null;
  const id = dealOwnerUserId(db, collab);
  return db.users.find((u) => u.id === id)?.email ?? null;
}
