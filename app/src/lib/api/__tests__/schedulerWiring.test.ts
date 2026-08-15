// schedulerWiring.test.ts — the notification queue is actually drained.
//
// `processScheduledNotifications` was correct the whole time. The defect was
// wiring: `runScheduledNotifications` had exactly one caller, an effect
// inside `WorkspaceShell`, and `WorkspaceShell` is mounted only under
// `<ProtectedRoute allow={['admin']} />`. The `/v2` workspace — where every
// brand and creator lives — has its own shell and never called it.
//
// So the queue filled up and nothing ever came out: deadline reminders,
// overdue follow-ups, stale-escrow nudges, review-window warnings and
// KYC-expiry prompts were all enqueued with `emitted: false` and stayed
// that way, unless the same browser session happened to sit on an /admin
// route for a full minute.
//
// These tests cover the behaviour (drain once, exactly once). The wiring
// itself — that both shells mount the shared hook — is asserted statically
// at the bottom, because a hook that nobody calls is precisely the failure
// mode being fixed.

import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { useStore } from '../store';
import { tx } from '../store';
import {
  enqueueDeadline24h, enqueueDeadlineOverdue, enqueueReviewWindowClosing,
  enqueueKycExpired, runScheduledNotifications, getQueueState,
} from '../scheduler';
import { buildDb, buildCampaign, buildCreator, buildBrand } from '@/lib/utils/__tests__/fixtures';
import type { User } from '@/lib/api/types';

const DAY = 24 * 60 * 60 * 1000;

function creatorUser(): User {
  return {
    id: 'u_creator', email: 'c@c.com', passwordHash: 'demo', role: 'creator',
    status: 'active', createdAt: '2026-04-01T00:00:00Z', creatorId: 'cr_1',
  };
}

function seed() {
  useStore.getState().setDB(buildDb({
    users: [creatorUser()],
    creators: [buildCreator({ id: 'cr_1', userId: 'u_creator' })],
    brands: [buildBrand({ id: 'br_1', userId: 'u_brand' })],
    campaigns: [buildCampaign({ id: 'cmp_1', brandId: 'br_1', stage: 'live' })],
    scheduledNotifications: [],
    notifications: [],
  }));
}

describe('the queue drains', () => {
  beforeEach(() => seed());

  it('emits a due row and delivers a notification to the recipient', () => {
    const dueAt = Date.now() + 2 * DAY;
    tx((db) => {
      enqueueDeadline24h(db, {
        deliverableId: 'del_1', creatorUserId: 'u_creator',
        dueAtMs: dueAt, campaignId: 'cmp_1', collaborationId: 'col_1',
      });
      return null;
    });
    expect(getQueueState().pending).toBe(1);

    // Nothing is due yet.
    runScheduledNotifications(Date.now());
    expect(getQueueState().pending).toBe(1);
    expect(useStore.getState().db.notifications).toHaveLength(0);

    // Advance past the trigger (24h before the deadline).
    const emitted = runScheduledNotifications(dueAt - DAY + 1000);
    expect(emitted).toBe(1);
    expect(getQueueState().pending).toBe(0);

    const notes = useStore.getState().db.notifications;
    expect(notes).toHaveLength(1);
    expect(notes[0].userId).toBe('u_creator');
  });

  it('never emits the same row twice, however often it ticks', () => {
    const dueAt = Date.now() + 2 * DAY;
    tx((db) => {
      enqueueDeadline24h(db, {
        deliverableId: 'del_1', creatorUserId: 'u_creator',
        dueAtMs: dueAt, campaignId: 'cmp_1', collaborationId: 'col_1',
      });
      return null;
    });
    const at = dueAt - DAY + 1000;
    expect(runScheduledNotifications(at)).toBe(1);
    // The heartbeat ticks every 60s forever; re-running must be a no-op.
    expect(runScheduledNotifications(at + 60_000)).toBe(0);
    expect(runScheduledNotifications(at + 120_000)).toBe(0);
    expect(useStore.getState().db.notifications).toHaveLength(1);
  });

  it('drains every enqueue type, not just the one that was easy to test', () => {
    const now = Date.now();
    tx((db) => {
      enqueueDeadlineOverdue(db, {
        deliverableId: 'del_2', creatorUserId: 'u_creator', brandUserId: 'u_brand',
        dueAtMs: now + DAY, campaignId: 'cmp_1', collaborationId: 'col_1',
      });
      // Goes to the BRAND — they're the one who must approve or dispute
      // before the window shuts.
      enqueueReviewWindowClosing(db, {
        submissionId: 'sub_1', brandUserId: 'u_brand',
        disputeWindowClosesAtMs: now + 5 * DAY, campaignId: 'cmp_1', collaborationId: 'col_1',
      });
      enqueueKycExpired(db, { creatorUserId: 'u_creator', expiresAtMs: now + 10 * DAY });
      return null;
    });
    const queued = getQueueState().pending;
    expect(queued).toBeGreaterThanOrEqual(3);

    // Far enough forward that everything is due.
    runScheduledNotifications(now + 60 * DAY);
    expect(getQueueState().pending).toBe(0);
    expect(useStore.getState().db.notifications.length).toBeGreaterThanOrEqual(queued);
  });
});

describe('both shells run the heartbeat', () => {
  // The behavioural tests above passed before the fix too — the queue logic
  // was never broken. What was broken is that nobody called it from the
  // surface real users see. Assert the wiring itself.
  const read = (p: string) => readFileSync(join(__dirname, '..', '..', '..', p), 'utf8');

  it('the v2 workspace shell calls useScheduledNotifications', () => {
    const src = read('screens/workspace-v2/Workspace.tsx');
    expect(src).toContain('useScheduledNotifications()');
  });

  it('the admin workspace shell calls it too', () => {
    const src = read('components/layout/WorkspaceShell.tsx');
    expect(src).toContain('useScheduledNotifications()');
  });

  it('neither shell hand-rolls its own copy of the interval', () => {
    // A second inline heartbeat is how these two drifted apart originally.
    for (const p of ['screens/workspace-v2/Workspace.tsx', 'components/layout/WorkspaceShell.tsx']) {
      expect(read(p)).not.toContain('runScheduledNotifications(');
    }
  });
});
