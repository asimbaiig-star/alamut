// staleness.test.ts — time can only do what we decided it can do.
//
// Section B of WORKFLOW-GAPS: every state was entered by someone acting, and
// nothing ever exited by time passing. The scheduler fired at all the right
// moments and only ever NOTIFIED.
//
// The stance chosen (deliberately conservative for a beta with simulated
// payments) is what these tests pin, because the risk here is not a crash —
// it is money moving, or a live deal dying, because a clock ticked:
//
//   - unreviewed work NEVER auto-approves; escrow does not move
//   - offers NEVER hard-expire; a stale offer is labelled, not killed
//   - the ONLY automatic state change is lapsing a silent application

import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  STALENESS, offerStaleness, applicationLapse, reviewOverdue,
  cancellationChase, ageInDays,
} from '../staleness';
import { lapseSilentApplications } from '../scheduler';
import { useStore } from '../store';
import {
  buildDb, buildCampaign, buildCreator, buildBrand, buildApplication,
} from '@/lib/utils/__tests__/fixtures';
import type { Database, User } from '../types';

const DAY = 86_400_000;
const NOW = +new Date('2026-08-20T12:00:00Z');
const daysAgo = (n: number) => new Date(NOW - n * DAY).toISOString();

describe('offers are labelled, never killed', () => {
  it('says nothing about a fresh offer', () => {
    expect(offerStaleness(daysAgo(1), NOW).level).toBe('fresh');
    expect(offerStaleness(daysAgo(1), NOW).note).toBeNull();
  });

  it('labels a stale one but still describes it as acceptable', () => {
    const s = offerStaleness(daysAgo(10), NOW);
    expect(s.level).toBe('stale');
    expect(s.note).toContain('10 days ago');
    // The wording must not imply the offer is dead — it isn't.
    expect(s.note?.toLowerCase()).not.toContain('expired');
  });

  it('escalates the wording at three weeks without changing anything', () => {
    expect(offerStaleness(daysAgo(30), NOW).level).toBe('very-stale');
  });

  it('exposes no expiry mechanism at all', () => {
    // Guards the product call. If someone later adds hard expiry, this fails
    // and they have to make that decision deliberately.
    const src = readFileSync(join(__dirname, '..', 'staleness.ts'), 'utf8');
    expect(src).not.toMatch(/status\s*=\s*['"]expired['"]/);
  });
});

describe('unreviewed work escalates but never releases', () => {
  it('is silent inside the review window', () => {
    expect(reviewOverdue(daysAgo(2), NOW).level).toBe('ok');
  });

  it('tells BOTH sides once it is overdue', () => {
    const r = reviewOverdue(daysAgo(9), NOW);
    expect(r.level).toBe('overdue');
    // The brand needs to know they are the blocker...
    expect(r.brandNote).toBeTruthy();
    // ...and the creator needs to know it isn't their fault.
    expect(r.creatorNote).toBeTruthy();
  });

  it('escalates at two weeks and names the consequence', () => {
    const r = reviewOverdue(daysAgo(20), NOW);
    expect(r.level).toBe('severe');
    expect(r.creatorNote).toMatch(/escrow|held/i);
  });

  it('never moves money — the module cannot approve or release', () => {
    const src = readFileSync(join(__dirname, '..', 'staleness.ts'), 'utf8');
    for (const forbidden of ['walletBalance', 'escrowHeld', 'pendingBalance', 'v2ApproveContent']) {
      expect(src, `staleness must not touch ${forbidden}`).not.toContain(forbidden);
    }
  });
});

describe('a cancellation request is chased, not resolved', () => {
  it('surfaces after a week', () => {
    expect(cancellationChase(NOW - 8 * DAY, NOW).chasing).toBe(true);
  });
  it('still requires a human — escrow is involved', () => {
    const note = cancellationChase(NOW - 8 * DAY, NOW).note!;
    expect(note).toMatch(/both sides agree/i);
  });
});

describe('lapsing a silent application — the one automatic state change', () => {
  const userCreator = (): User => ({
    id: 'u_creator', email: 'c@c.com', passwordHash: 'demo', role: 'creator',
    status: 'active', createdAt: '2026-01-01T00:00:00Z', creatorId: 'cr_1',
  });

  function seed(apps: ReturnType<typeof buildApplication>[]): Database {
    const db = buildDb({
      users: [userCreator()],
      creators: [buildCreator({ id: 'cr_1', userId: 'u_creator' })],
      brands: [buildBrand({ id: 'br_1' })],
      campaigns: [buildCampaign({ id: 'cmp_1', brandId: 'br_1', stage: 'live' })],
      applications: apps,
    });
    useStore.getState().setDB(db);
    return useStore.getState().db;
  }

  beforeEach(() => useStore.getState().setSession(null));

  it('withdraws a pitch nobody answered', () => {
    const db = seed([buildApplication({
      id: 'app_1', campaignId: 'cmp_1', creatorId: 'cr_1',
      status: 'submitted', submittedAt: daysAgo(STALENESS.applicationLapseDays + 1),
    })]);
    expect(lapseSilentApplications(db, NOW)).toBe(1);
    expect(db.applications[0].status).toBe('withdrawn');
  });

  it('tells the creator why, rather than letting it vanish', () => {
    const db = seed([buildApplication({
      id: 'app_1', campaignId: 'cmp_1', creatorId: 'cr_1',
      status: 'submitted', submittedAt: daysAgo(30),
    })]);
    lapseSilentApplications(db, NOW);
    const note = db.notifications.find((n) => n.userId === 'u_creator');
    expect(note?.text).toMatch(/no reply/i);
  });

  it('leaves a pitch the brand ENGAGED with alone', () => {
    // Shortlisted is a live conversation, not silence. Lapsing it would
    // cancel a deal the brand is actively working.
    const db = seed([buildApplication({
      id: 'app_1', campaignId: 'cmp_1', creatorId: 'cr_1',
      status: 'shortlisted', submittedAt: daysAgo(90),
    })]);
    expect(lapseSilentApplications(db, NOW)).toBe(0);
    expect(db.applications[0].status).toBe('shortlisted');
  });

  it('leaves a recent pitch alone', () => {
    const db = seed([buildApplication({
      id: 'app_1', campaignId: 'cmp_1', creatorId: 'cr_1',
      status: 'submitted', submittedAt: daysAgo(3),
    })]);
    expect(lapseSilentApplications(db, NOW)).toBe(0);
  });

  it('is idempotent — a second sweep changes nothing', () => {
    const db = seed([buildApplication({
      id: 'app_1', campaignId: 'cmp_1', creatorId: 'cr_1',
      status: 'submitted', submittedAt: daysAgo(40),
    })]);
    expect(lapseSilentApplications(db, NOW)).toBe(1);
    expect(lapseSilentApplications(db, NOW)).toBe(0);
  });

  it('warns before it fires, so the lapse is never a surprise', () => {
    const nearly = applicationLapse(
      { status: 'submitted', submittedAt: daysAgo(STALENESS.applicationLapseDays - 2) },
      NOW,
    );
    expect(nearly.warn).toBe(true);
    expect(nearly.shouldLapse).toBe(false);
    expect(nearly.daysLeft).toBe(2);
  });
});

describe('ageInDays', () => {
  it('counts whole days and never goes negative', () => {
    expect(ageInDays(daysAgo(5), NOW)).toBe(5);
    expect(ageInDays(new Date(NOW + 10 * DAY).toISOString(), NOW)).toBe(0);
  });
});
