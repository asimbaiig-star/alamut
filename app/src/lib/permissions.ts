// permissions.ts — P5 §4.1 / §4.2 capability matrix.
//
// Goal: every brand-side mutation knows which TeamRole(s) are allowed
// to call it, every brand-side UI button can ask "can I do this?", and
// the admin queue can filter tabs by AdminRole. The matrix lives here
// so both the mutation layer (data) and the UI layer (read-only gating)
// share one source of truth.
//
// Design:
//   - `Capability` is a string union that names every gated action.
//   - `roleCapabilities` maps brand `TeamRole` → list of capabilities
//     that role can perform.
//   - `adminRoleCapabilities` maps `AdminRole` → admin capabilities.
//   - `creatorCapabilities` is a flat list — creators all get the same
//     set (apply, counter offers, submit content, set permalink, leave
//     reviews, viewer.read).
//   - `hasCapability(userId, cap, db)` is the pure read.
//   - `requireCapability(userId | undefined, cap, db)` throws if the
//     check fails. **Important:** if `userId` is undefined (no session
//     was set), the check is bypassed — this is the test/seed path.
//     Production always runs with a session, so the bypass is invisible
//     in real flows but lets fixtures call mutations without setup.
//   - `useCapability(cap)` is the React hook — reads session userId
//     from the store, returns boolean. UI buttons use it to gate
//     `disabled` state (NOT to hide the button — visibility tells the
//     user the action exists, the disabled state tells them why they
//     can't do it).
//
// Auth bypass for missing session (test mode) is documented and tested.
// Production tightens this by always having a session at app boot.

import { useStore } from './api/store';
import type {
  AdminRole, Capability, Database, TeamRole,
} from './api/types';

// =====================================================================
// Capability matrix
// =====================================================================

/**
 * The full set of brand-side capabilities. Each capability names a
 * mutation or read. Naming convention: `<entity>.<action>`. The full
 * list lives on the type so TS catches typos at every call site.
 */
const ALL_CAPABILITIES: Capability[] = [
  // Campaign lifecycle
  'campaign.create',
  'campaign.update',
  'campaign.end',
  'campaign.pause',
  // Applications + offers
  'application.decide',
  'application.invite',
  'offer.send',
  'offer.withdraw',
  'offer.counter',
  // Content review
  'content.submit',
  'content.approve',
  'content.revise',
  'content.markLive',
  'content.setPermalink',
  // Wallet / money
  'wallet.topup',
  'wallet.withdraw',
  // Team management
  'team.manage',
  // Disputes
  'dispute.raise',
  'dispute.resolve',
  // Reviews
  'review.write',
  'review.moderate',
  // Admin-only categories
  'admin.verify',
  'admin.payout',
  // Generic read access — every authenticated user has this.
  'viewer.read',
];

/**
 * Brand-side TeamRole → capabilities mapping. Per the brief's §4.1
 * matrix:
 *   - admin (brand-team admin): everything brand-side
 *   - ops: campaign + offer + content + dispute.raise (no wallet, no team)
 *   - finance: wallet only (no campaign, no offers, no content)
 *   - viewer: viewer.read only
 *
 * Note: `admin` here is the BRAND-TEAM admin (a user on a brand's team
 * who has full mutation rights for that brand). It is NOT the same as
 * `User.role === 'admin'` (which is the platform admin).
 */
export const roleCapabilities: Record<TeamRole, Capability[]> = {
  admin: [
    'campaign.create', 'campaign.update', 'campaign.end', 'campaign.pause',
    'application.decide', 'application.invite',
    'offer.send', 'offer.withdraw', 'offer.counter',
    'content.approve', 'content.revise', 'content.markLive',
    'wallet.topup', 'wallet.withdraw',
    'team.manage',
    'dispute.raise',
    'viewer.read',
  ],
  ops: [
    'campaign.create', 'campaign.update', 'campaign.end', 'campaign.pause',
    'application.decide', 'application.invite',
    'offer.send', 'offer.withdraw', 'offer.counter',
    'content.approve', 'content.revise', 'content.markLive',
    'dispute.raise',
    'viewer.read',
  ],
  finance: [
    'wallet.topup', 'wallet.withdraw',
    'viewer.read',
  ],
  viewer: [
    'viewer.read',
  ],
};

/**
 * Platform AdminRole → capabilities mapping. Each admin role grants a
 * narrow set; `super` is the catch-all that gets everything. Multiple
 * roles on a single User are unioned.
 */
export const adminRoleCapabilities: Record<AdminRole, Capability[]> = {
  super: ALL_CAPABILITIES.slice(),
  verification: ['admin.verify', 'viewer.read'],
  disputes: ['dispute.resolve', 'review.moderate', 'viewer.read'],
  finance: ['admin.payout', 'wallet.topup', 'wallet.withdraw', 'viewer.read'],
  support: ['viewer.read'],
};

/**
 * Capabilities every authenticated creator has. Creators don't have
 * team roles; they use this fixed set. Includes their own content
 * lifecycle (submit, set permalink) + counter-offer + review-writing.
 */
export const creatorCapabilities: Capability[] = [
  'content.submit', 'content.setPermalink',
  'offer.counter', 'offer.withdraw',
  'application.invite', // creators can self-apply
  'review.write',
  'dispute.raise',
  'viewer.read',
];

// =====================================================================
// Read API
// =====================================================================

/**
 * Pure read. Returns `true` iff the user has the capability via any
 * of: brand teamRole, admin adminRoles, creator default. Returns
 * `false` if the user is missing or has no matching role.
 */
export function hasCapability(userId: string, cap: Capability, db: Database): boolean {
  const u = db.users.find((x) => x.id === userId);
  if (!u) return false;

  // Platform admin path: union of capabilities across adminRoles.
  // Legacy admins (no `adminRoles` field set, or empty array) default
  // to `super` so existing flows don't break.
  if (u.role === 'admin') {
    const roles = u.adminRoles && u.adminRoles.length > 0 ? u.adminRoles : (['super'] as AdminRole[]);
    for (const r of roles) {
      if (adminRoleCapabilities[r].includes(cap)) return true;
    }
    return false;
  }

  // Brand path: teamRole → capabilities. Legacy brand users without
  // teamRole default to `admin` (the strongest brand-side role) for
  // backwards compatibility — pre-P5 brand users had implicit full
  // access; P5 introduces the gate without retroactively locking
  // existing accounts out.
  if (u.role === 'brand') {
    const role = (u.teamRole ?? 'admin') as TeamRole;
    return roleCapabilities[role].includes(cap);
  }

  // Creator path.
  if (u.role === 'creator') {
    return creatorCapabilities.includes(cap);
  }

  return false;
}

// =====================================================================
// Mutation-layer enforcement
// =====================================================================

/**
 * Throw if `userId` lacks `cap`. Mutations call this as the first line
 * inside their `tx` block.
 *
 * Bypass rule: if `userId` is undefined or empty, the check skips
 * entirely. This is the test/seed path — fixtures and migrations don't
 * set a session, so they shouldn't trip the gate. Production always
 * supplies an actor (resolved from `useStore.getState().session`).
 *
 * Throws with a structured message so the UI can surface a useful
 * "Permission denied" toast.
 */
export class PermissionError extends Error {
  capability: Capability;
  userId: string;
  constructor(userId: string, capability: Capability) {
    super(`User ${userId} lacks capability: ${capability}`);
    this.name = 'PermissionError';
    this.capability = capability;
    this.userId = userId;
  }
}

export function requireCapability(
  userId: string | undefined | null,
  cap: Capability,
  db: Database,
): void {
  if (!userId) return; // test/seed bypass
  if (!hasCapability(userId, cap, db)) {
    throw new PermissionError(userId, cap);
  }
}

// =====================================================================
// React hook
// =====================================================================

/**
 * Returns `true` iff the current session user has `cap`. UI buttons
 * use this to drive their `disabled` prop. The button stays visible —
 * the user can hover for a "Permission required" tooltip — but cannot
 * be activated.
 *
 * Returns `false` when there's no session (signed-out flow). Callers
 * that want a different default during sign-out should branch above.
 */
export function useCapability(cap: Capability): boolean {
  const session = useStore((s) => s.session);
  const db = useStore((s) => s.db);
  if (!session?.userId) return false;
  return hasCapability(session.userId, cap, db);
}

/**
 * Multi-cap variant — true iff ALL passed caps are held. Useful for
 * compound buttons ("Approve & mark live" needs both content.approve
 * AND content.markLive).
 */
export function useCapabilities(...caps: Capability[]): boolean {
  const session = useStore((s) => s.session);
  const db = useStore((s) => s.db);
  if (!session?.userId) return false;
  return caps.every((cap) => hasCapability(session.userId, cap, db));
}

/**
 * Convenience: read the current session user's userId. Mutations call
 * this when they want to thread the actor through `requireCapability`
 * + downstream entities (notifications, history actor, etc.).
 */
export function getActorUserId(): string | undefined {
  return useStore.getState().session?.userId;
}
