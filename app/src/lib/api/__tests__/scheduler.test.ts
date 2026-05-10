// scheduler.test.ts — P4 §3.1 acceptance gates.
//
// Covers the two key behaviours from the brief:
//   - "Schedule a `deadline-24h`, advance clock past trigger, exactly
//     one notification emitted."
//   - "Re-run heartbeat → no duplicate."

import { describe, it, expect } from 'vitest';
import {
  enqueueDeadline24h,
  enqueueDeadlineOverdue,
  enqueueReviewWindowClosing,
  processScheduledNotifications,
} from '../scheduler';
import { buildDb, buildCampaign, buildCreator, buildBrand } from '@/lib/utils/__tests__/fixtures';
import type { Database } from '../types';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

function seed(): Database {
  return buildDb({
    // User has no `name` field — display name comes from the linked
    // creator/brand. Email is the user-side identifier.
    users: [
      { id: 'u_creator', email: 'c@x.com', passwordHash: 'demo', role: 'creator', creatorId: 'cr_1', status: 'active', createdAt: '2026-04-01T00:00:00Z' },
      { id: 'u_brand', email: 'b@x.com', passwordHash: 'demo', role: 'brand', brandId: 'br_1', status: 'active', createdAt: '2026-04-01T00:00:00Z' },
    ],
    campaigns: [buildCampaign({ id: 'cmp_1', brandId: 'br_1', title: 'Spring Renewal' })],
    creators: [buildCreator({ id: 'cr_1' })],
    brands: [buildBrand({ id: 'br_1' })],
  });
}

describe('processScheduledNotifications', () => {
  it('emits exactly one Notification when deadline-24h trigger passes', () => {
    const db = seed();
    const dueAt = Date.now() + 2 * DAY;
    enqueueDeadline24h(db, {
      deliverableId: 'del_1',
      creatorUserId: 'u_creator',
      dueAtMs: dueAt,
      campaignId: 'cmp_1',
      collaborationId: 'col_1',
    });
    expect(db.scheduledNotifications.length).toBe(1);
    expect(db.scheduledNotifications[0].emitted).toBe(false);

    // Before trigger — no emit.
    const before = processScheduledNotifications(db, dueAt - DAY - HOUR);
    expect(before).toBe(0);
    expect(db.notifications.length).toBe(0);

    // Past trigger — exactly one Notification, row marked emitted.
    const after = processScheduledNotifications(db, dueAt - DAY + HOUR);
    expect(after).toBe(1);
    expect(db.notifications.length).toBe(1);
    expect(db.notifications[0].userId).toBe('u_creator');
    expect(db.notifications[0].text).toContain('24 hours');
    expect(db.scheduledNotifications[0].emitted).toBe(true);
  });

  it('re-running the heartbeat is a no-op for already-emitted rows', () => {
    const db = seed();
    const dueAt = Date.now() + 2 * DAY;
    enqueueDeadline24h(db, {
      deliverableId: 'del_1',
      creatorUserId: 'u_creator',
      dueAtMs: dueAt,
      campaignId: 'cmp_1',
      collaborationId: 'col_1',
    });
    processScheduledNotifications(db, dueAt - DAY + HOUR);
    expect(db.notifications.length).toBe(1);

    // Same heartbeat at later timestamp — no duplicate.
    const second = processScheduledNotifications(db, dueAt + DAY);
    expect(second).toBe(0);
    expect(db.notifications.length).toBe(1);
  });

  it('enqueue helpers are idempotent on the same identity', () => {
    const db = seed();
    const dueAt = Date.now() + 2 * DAY;
    const enqueueArgs = {
      deliverableId: 'del_1',
      creatorUserId: 'u_creator',
      dueAtMs: dueAt,
      campaignId: 'cmp_1',
      collaborationId: 'col_1',
    };
    enqueueDeadline24h(db, enqueueArgs);
    enqueueDeadline24h(db, enqueueArgs);
    enqueueDeadline24h(db, enqueueArgs);
    expect(db.scheduledNotifications.length).toBe(1);
  });

  it('overdue enqueue fans out 6 rows (3 days × 2 recipients)', () => {
    const db = seed();
    const dueAt = Date.now() + DAY;
    enqueueDeadlineOverdue(db, {
      deliverableId: 'del_1',
      creatorUserId: 'u_creator',
      brandUserId: 'u_brand',
      dueAtMs: dueAt,
      campaignId: 'cmp_1',
      collaborationId: 'col_1',
    });
    expect(db.scheduledNotifications.length).toBe(6);

    // 7 days later — all 6 should fire.
    const emitted = processScheduledNotifications(db, dueAt + 7 * DAY);
    expect(emitted).toBe(6);
    expect(db.notifications.length).toBe(6);
  });

  it('respects user notification preferences (opt-out flips row to emitted but skips push)', () => {
    const db = seed();
    // Mark the creator as opted out of `applications` (the kind for
    // deadline triggers).
    db.users[0].notificationPrefs = {
      applications: false,
      offers: true,
      approvals: true,
      payouts: true,
      reviews: true,
      team: true,
      marketing: true,
    };
    const dueAt = Date.now() + 2 * DAY;
    enqueueDeadline24h(db, {
      deliverableId: 'del_1',
      creatorUserId: 'u_creator',
      dueAtMs: dueAt,
      campaignId: 'cmp_1',
      collaborationId: 'col_1',
    });
    const emitted = processScheduledNotifications(db, dueAt - DAY + HOUR);
    // No push happened …
    expect(emitted).toBe(0);
    expect(db.notifications.length).toBe(0);
    // … but the row is marked emitted so the heartbeat doesn't keep
    // retrying the suppressed row every minute.
    expect(db.scheduledNotifications[0].emitted).toBe(true);
  });

  it('review-window-closing fires 48h before the 7-day window closes', () => {
    const db = seed();
    const closesAt = Date.now() + 7 * DAY;
    enqueueReviewWindowClosing(db, {
      submissionId: 'sub_1',
      brandUserId: 'u_brand',
      disputeWindowClosesAtMs: closesAt,
      campaignId: 'cmp_1',
      collaborationId: 'col_1',
    });
    expect(db.scheduledNotifications.length).toBe(1);
    const trigger = db.scheduledNotifications[0];
    expect(trigger.triggerAt).toBe(closesAt - 2 * DAY);

    const emitted = processScheduledNotifications(db, closesAt - DAY);
    expect(emitted).toBe(1);
    expect(db.notifications[0].text).toContain('Review window closing');
    expect(db.notifications[0].userId).toBe('u_brand');
  });
});
