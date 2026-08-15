// @vitest-environment jsdom
//
// jsdom because the selection lives in localStorage: it must survive a reload,
// exactly like the persona toggle. The module guards `typeof window` so it
// degrades safely under SSR/node, which is why the file-inspection tests below
// pass without it.
// managerSwitcher.test.ts — a manager must act for the client they chose.
//
// `useV2CurrentCreator` returned `managesCreatorIds[0]` unconditionally. An
// agency with two clients could only ever reach the first, and every earnings
// figure, deal and payout on screen belonged to that creator regardless of who
// the manager meant to be looking at.
//
// That is worse than a missing feature. A missing switcher is a gap you can
// see; showing one client's money under another client's name is a
// correctness bug you cannot.
//
// The selection is also an AUTHORIZATION boundary, not a UI preference —
// localStorage is user-writable and this value decides whose financial data
// renders — so it is re-validated on every read.

import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { v2SetActingForCreator, readActingForCreatorId } from '../v2Hooks';
import { useStore } from '@/lib/api/store';
import { buildDb, buildCreator } from '@/lib/utils/__tests__/fixtures';
import type { User } from '@/lib/api/types';

const manager = (): User => ({
  id: 'u_mgr', email: 'm@m.com', passwordHash: 'demo', role: 'creator',
  status: 'active', createdAt: '2026-01-01T00:00:00Z',
  managesCreatorIds: ['cr_a', 'cr_b'],
});

function seed() {
  useStore.getState().setDB(buildDb({
    users: [manager()],
    creators: [
      buildCreator({ id: 'cr_a', userId: 'u_a', name: 'Client A' }),
      buildCreator({ id: 'cr_b', userId: 'u_b', name: 'Client B' }),
      buildCreator({ id: 'cr_other', userId: 'u_o', name: 'Not Their Client' }),
    ],
  }));
  useStore.getState().setSession({ userId: 'u_mgr', issuedAt: new Date().toISOString() });
}

describe('selecting who to act for', () => {
  beforeEach(() => {
    localStorage.clear();
    seed();
  });

  it('accepts a creator the manager actually represents', () => {
    expect(v2SetActingForCreator('cr_b')).toBe(true);
    expect(readActingForCreatorId()).toBe('cr_b');
  });

  it('REFUSES a creator they do not represent', () => {
    // The guard that makes this an authorization boundary rather than a
    // preference. Without it, editing one localStorage key would show a
    // stranger's earnings, deals and payout details.
    expect(v2SetActingForCreator('cr_other')).toBe(false);
    expect(readActingForCreatorId()).toBeNull();
  });

  it('refuses an id that does not exist at all', () => {
    expect(v2SetActingForCreator('cr_nonexistent')).toBe(false);
  });
});

describe('resolving the acting creator', () => {
  it('re-validates the stored value on every read, not just on write', () => {
    // A stale selection (client since dropped) or a hand-edited localStorage
    // value must fall back to a creator they DO represent, never resolve to
    // an arbitrary one.
    const src = readFileSync(join(__dirname, '..', 'v2Hooks.ts'), 'utf8');
    const fn = src.slice(src.indexOf('export function useV2CurrentCreator'));
    const body = fn.slice(0, fn.indexOf('\n}'));
    expect(body).toContain('managed.includes(selected)');
    expect(body).toContain('managed[0]');
  });

  it('no longer reads managesCreatorIds[0] unconditionally', () => {
    const src = readFileSync(join(__dirname, '..', 'v2Hooks.ts'), 'utf8')
      .split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
    const fn = src.slice(src.indexOf('export function useV2CurrentCreator'));
    const body = fn.slice(0, fn.indexOf('\n}'));
    expect(body).not.toMatch(/const managedId = me\.managesCreatorIds\[0\]/);
  });
});

describe('the switcher is reachable', () => {
  it('renders in the sidebar only when there is a real choice', () => {
    const src = readFileSync(join(__dirname, '..', 'Workspace.tsx'), 'utf8');
    // An ordinary creator must never see it.
    expect(src).toContain('managedCreators.length > 1');
    expect(src).toContain('v2SetActingForCreator');
  });

  it('the sign-in screen does not offer an account that cannot sign in', () => {
    // A demo button that returns `invalid_credentials` is worse than no
    // button, especially on a screen an investor may open. The manager
    // account exists in the seed but has no Supabase Auth user, so it is
    // deliberately absent here until one is created.
    const signIn = readFileSync(
      join(__dirname, '..', '..', 'auth', 'SignIn.tsx'), 'utf8',
    );
    const decl = signIn.slice(signIn.indexOf('const DEMO_ACCOUNTS'), signIn.indexOf('} as const;'));
    expect(decl).not.toMatch(/^\s*manager:/m);
  });

  it('the seed contains a multi-client manager to exercise it', () => {
    // Without one, the manager path is unexercised — which is precisely how
    // the [0] bug survived this long.
    const seedSrc = readFileSync(
      join(__dirname, '..', '..', '..', 'lib', 'api', 'seed.ts'), 'utf8',
    );
    const m = /managesCreatorIds:\s*\[([^\]]*)\]/.exec(seedSrc);
    expect(m).not.toBeNull();
    expect(m![1].split(',').length).toBeGreaterThan(1);
  });
});
