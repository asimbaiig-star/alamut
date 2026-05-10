// permissions.test.ts — P5 §4.1 / §4.2 capability matrix gates.
//
// Two layers under test:
//   1. The pure read — `hasCapability(userId, cap, db)` — the source
//      of truth for whether a given user can perform a given action.
//   2. The mutation gate — `requireCapability(userId, cap, db)` —
//      throws `PermissionError` for a denied actor; bypasses for
//      undefined actor (test/seed mode).
//
// The brief's acceptance criteria:
//   - Parametric test: every (teamRole, mutation) pair → correct authorize/deny
//   - Ops user cannot top up the wallet
//   - Finance user cannot send offers
//   - Viewer user cannot mutate anything
//   - Test gate per role × mutation matrix — tabulated below.

import { describe, it, expect } from 'vitest';
import {
  hasCapability,
  requireCapability,
  PermissionError,
  roleCapabilities,
} from '@/lib/permissions';
import type { Capability, Database, TeamRole, AdminRole, User } from '@/lib/api/types';
import { buildDb } from '@/lib/utils/__tests__/fixtures';

function userWithTeamRole(id: string, teamRole: TeamRole): User {
  return {
    id,
    email: `${id}@x.com`,
    passwordHash: 'demo',
    role: 'brand',
    status: 'active',
    createdAt: '2026-04-01T00:00:00Z',
    brandId: 'br_1',
    teamRole,
  };
}

function userWithAdminRoles(id: string, adminRoles: AdminRole[]): User {
  return {
    id,
    email: `${id}@admin.com`,
    passwordHash: 'demo',
    role: 'admin',
    status: 'active',
    createdAt: '2026-04-01T00:00:00Z',
    adminRoles,
  };
}

function userCreator(id: string): User {
  return {
    id,
    email: `${id}@creator.com`,
    passwordHash: 'demo',
    role: 'creator',
    status: 'active',
    createdAt: '2026-04-01T00:00:00Z',
    creatorId: 'cr_1',
  };
}

describe('hasCapability — brand TeamRole matrix', () => {
  // Per the brief §4.1: the four brand-side roles and their capability
  // sets. Every (role, capability) pair is checked explicitly.
  const teamRoles: TeamRole[] = ['admin', 'ops', 'finance', 'viewer'];
  const allCaps: Capability[] = [
    'campaign.create', 'campaign.update', 'campaign.end', 'campaign.pause',
    'application.decide', 'application.invite',
    'offer.send', 'offer.withdraw', 'offer.counter',
    'content.approve', 'content.revise', 'content.markLive',
    'wallet.topup', 'wallet.withdraw',
    'team.manage',
    'dispute.raise',
    'review.write',
    'viewer.read',
  ];

  for (const role of teamRoles) {
    for (const cap of allCaps) {
      const expected = roleCapabilities[role].includes(cap);
      it(`teamRole='${role}' × capability='${cap}' → ${expected ? 'allow' : 'deny'}`, () => {
        const db: Database = buildDb({ users: [userWithTeamRole('u_t', role)] });
        expect(hasCapability('u_t', cap, db)).toBe(expected);
      });
    }
  }
});

describe('hasCapability — specific brief acceptance gates', () => {
  it('ops user cannot top up the wallet', () => {
    const db = buildDb({ users: [userWithTeamRole('u_ops', 'ops')] });
    expect(hasCapability('u_ops', 'wallet.topup', db)).toBe(false);
  });

  it('finance user cannot send offers', () => {
    const db = buildDb({ users: [userWithTeamRole('u_fin', 'finance')] });
    expect(hasCapability('u_fin', 'offer.send', db)).toBe(false);
  });

  it('finance user can top up the wallet', () => {
    const db = buildDb({ users: [userWithTeamRole('u_fin', 'finance')] });
    expect(hasCapability('u_fin', 'wallet.topup', db)).toBe(true);
  });

  it('viewer user cannot mutate anything (only viewer.read)', () => {
    const db = buildDb({ users: [userWithTeamRole('u_view', 'viewer')] });
    expect(hasCapability('u_view', 'viewer.read', db)).toBe(true);
    expect(hasCapability('u_view', 'campaign.create', db)).toBe(false);
    expect(hasCapability('u_view', 'offer.send', db)).toBe(false);
    expect(hasCapability('u_view', 'wallet.topup', db)).toBe(false);
    expect(hasCapability('u_view', 'team.manage', db)).toBe(false);
    expect(hasCapability('u_view', 'dispute.raise', db)).toBe(false);
  });

  it('admin (brand-team) can manage the team; ops cannot', () => {
    const dbAdmin = buildDb({ users: [userWithTeamRole('u_admin', 'admin')] });
    expect(hasCapability('u_admin', 'team.manage', dbAdmin)).toBe(true);
    const dbOps = buildDb({ users: [userWithTeamRole('u_ops', 'ops')] });
    expect(hasCapability('u_ops', 'team.manage', dbOps)).toBe(false);
  });
});

describe('hasCapability — platform AdminRole', () => {
  it("super admin has everything", () => {
    const db = buildDb({ users: [userWithAdminRoles('u_s', ['super'])] });
    expect(hasCapability('u_s', 'campaign.create', db)).toBe(true);
    expect(hasCapability('u_s', 'wallet.topup', db)).toBe(true);
    expect(hasCapability('u_s', 'dispute.resolve', db)).toBe(true);
    expect(hasCapability('u_s', 'review.moderate', db)).toBe(true);
    expect(hasCapability('u_s', 'admin.verify', db)).toBe(true);
  });

  it('verification admin can verify but cannot resolve disputes', () => {
    const db = buildDb({ users: [userWithAdminRoles('u_v', ['verification'])] });
    expect(hasCapability('u_v', 'admin.verify', db)).toBe(true);
    expect(hasCapability('u_v', 'dispute.resolve', db)).toBe(false);
    expect(hasCapability('u_v', 'review.moderate', db)).toBe(false);
  });

  it('disputes admin can resolve disputes + moderate reviews; cannot verify', () => {
    const db = buildDb({ users: [userWithAdminRoles('u_d', ['disputes'])] });
    expect(hasCapability('u_d', 'dispute.resolve', db)).toBe(true);
    expect(hasCapability('u_d', 'review.moderate', db)).toBe(true);
    expect(hasCapability('u_d', 'admin.verify', db)).toBe(false);
  });

  it('legacy admin without adminRoles defaults to super-admin behavior', () => {
    const db = buildDb({
      users: [{
        id: 'u_legacy',
        email: 'legacy@admin.com',
        passwordHash: 'demo',
        role: 'admin',
        status: 'active',
        createdAt: '2026-04-01T00:00:00Z',
        // no adminRoles field at all
      }],
    });
    expect(hasCapability('u_legacy', 'campaign.create', db)).toBe(true);
    expect(hasCapability('u_legacy', 'admin.verify', db)).toBe(true);
  });

  it('admin can hold multiple admin roles (union of capabilities)', () => {
    const db = buildDb({ users: [userWithAdminRoles('u_multi', ['verification', 'disputes'])] });
    expect(hasCapability('u_multi', 'admin.verify', db)).toBe(true);
    expect(hasCapability('u_multi', 'dispute.resolve', db)).toBe(true);
    expect(hasCapability('u_multi', 'review.moderate', db)).toBe(true);
    // Still no super-admin caps the union doesn't grant.
    expect(hasCapability('u_multi', 'campaign.create', db)).toBe(false);
  });
});

describe('hasCapability — creator', () => {
  it('creator can submit + counter + write reviews + raise disputes', () => {
    const db = buildDb({ users: [userCreator('u_c')] });
    expect(hasCapability('u_c', 'content.submit', db)).toBe(true);
    expect(hasCapability('u_c', 'content.setPermalink', db)).toBe(true);
    expect(hasCapability('u_c', 'offer.counter', db)).toBe(true);
    expect(hasCapability('u_c', 'application.invite', db)).toBe(true);
    expect(hasCapability('u_c', 'review.write', db)).toBe(true);
    expect(hasCapability('u_c', 'dispute.raise', db)).toBe(true);
  });

  it('creator cannot send offers, end campaigns, or moderate reviews', () => {
    const db = buildDb({ users: [userCreator('u_c')] });
    expect(hasCapability('u_c', 'offer.send', db)).toBe(false);
    expect(hasCapability('u_c', 'campaign.create', db)).toBe(false);
    expect(hasCapability('u_c', 'campaign.end', db)).toBe(false);
    expect(hasCapability('u_c', 'content.approve', db)).toBe(false);
    expect(hasCapability('u_c', 'review.moderate', db)).toBe(false);
    expect(hasCapability('u_c', 'wallet.topup', db)).toBe(false);
  });
});

describe('requireCapability — mutation-layer gate', () => {
  it('throws PermissionError when actor lacks the capability', () => {
    const db = buildDb({ users: [userWithTeamRole('u_view', 'viewer')] });
    expect(() => requireCapability('u_view', 'campaign.create', db)).toThrow(PermissionError);
  });

  it('does not throw when actor has the capability', () => {
    const db = buildDb({ users: [userWithTeamRole('u_admin', 'admin')] });
    expect(() => requireCapability('u_admin', 'campaign.create', db)).not.toThrow();
  });

  it('bypasses the check when actorUserId is undefined (test/seed mode)', () => {
    const db = buildDb({ users: [userWithTeamRole('u_view', 'viewer')] });
    expect(() => requireCapability(undefined, 'campaign.create', db)).not.toThrow();
  });

  it('bypasses the check when actorUserId is null', () => {
    const db = buildDb({ users: [userWithTeamRole('u_view', 'viewer')] });
    expect(() => requireCapability(null, 'campaign.create', db)).not.toThrow();
  });

  it('throws when actor user does not exist in db', () => {
    const db = buildDb({ users: [] });
    expect(() => requireCapability('u_ghost', 'viewer.read', db)).toThrow(PermissionError);
  });

  it('PermissionError exposes capability + userId', () => {
    const db = buildDb({ users: [userWithTeamRole('u_view', 'viewer')] });
    try {
      requireCapability('u_view', 'campaign.create', db);
      expect.fail('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(PermissionError);
      const pe = err as PermissionError;
      expect(pe.capability).toBe('campaign.create');
      expect(pe.userId).toBe('u_view');
    }
  });
});
