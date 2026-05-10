// scheduler.ts — P4 §3.1 time-based notification engine.
//
// Some notifications fire on a clock, not on a user action: 24h-before
// deadline, overdue follow-up, 30/60/90-day stale-escrow check, dispute-
// window-closing, KYC-expiry. This module is the queue + heartbeat:
//
//   1. Mutations that establish a future event (e.g. v2AcceptOffer →
//      24h before each Deliverable's due date) call an `enqueue*` helper
//      below to push a `ScheduledNotification` row with a `triggerAt`
//      timestamp. The helpers are idempotent — re-enqueuing the same
//      logical event (same type + entity) overwrites instead of
//      duplicating.
//
//   2. The scheduler heartbeat (called on hydration + on a 60s
//      `setInterval` mounted in `WorkspaceShell`, plus opportunistically
//      from a few read hooks) walks `db.scheduledNotifications.filter(
//      n => !n.emitted && n.triggerAt <= now)`, materializes a real
//      `Notification` from the trigger's data, pushes it to
//      `db.notifications`, and flips the trigger's `emitted = true`.
//
// Idempotency: the trigger row's id is the deduplication key. Each
// enqueue helper uses a deterministic id so re-running the enqueue path
// (re-render, re-mount, re-mutation) is a no-op for already-queued
// rows. The `emitted` flag is the only post-creation mutation; the
// heartbeat never deletes triggers (audit trail).
//
// Cost shape: O(n) per heartbeat on the queue. The queue grows at
// roughly N_collabs × deliverable_count × trigger_density. Existing
// seed data has < 50 collabs × ≤ 5 deliverables × ≤ 5 triggers ≈ 1.2k
// rows max — fine for a 60s interval. If growth becomes an issue,
// partition on `min(triggerAt)` to bound the scan.

import { tx, useStore } from './store';
import type {
  Database, ScheduledNotification, ScheduledNotificationType,
  NotificationPrefs,
} from './types';

const DAY_MS = 24 * 60 * 60 * 1000;

function nowIsoFromMs(ms: number): string {
  return new Date(ms).toISOString();
}

// =====================================================================
// Enqueue helpers
// =====================================================================
//
// Each helper computes a deterministic id from the trigger's identity
// (type + entityId + sequence) so calling the helper twice on the same
// logical event is a no-op. Mutations call these inside their own `tx`
// block — `db` is passed in directly, no nested transactions.

/** Compose a stable trigger id. */
function triggerId(
  type: ScheduledNotificationType,
  entityId: string,
  sequence?: number,
): string {
  return sequence !== undefined
    ? `sched_${type}_${entityId}_${sequence}`
    : `sched_${type}_${entityId}`;
}

/** Push a scheduled notification if no row with the same id exists. */
function pushIfNew(db: Database, row: ScheduledNotification): void {
  if (db.scheduledNotifications.some((n) => n.id === row.id)) return;
  db.scheduledNotifications.push(row);
}

/**
 * Enqueue the "deliverable due in 24h" reminder for a creator.
 * Idempotent — re-enqueuing for the same submissionId/deliverableId is
 * a no-op. Caller picks the 24h offset from `Deliverable.dueOffsetDays`
 * relative to contract acceptance.
 */
export function enqueueDeadline24h(
  db: Database,
  params: {
    deliverableId: string;
    creatorUserId: string;
    dueAtMs: number;
    campaignId: string;
    collaborationId: string;
  },
): void {
  const triggerAt = params.dueAtMs - DAY_MS;
  if (triggerAt <= Date.now()) return; // already past — don't enqueue stale rows
  pushIfNew(db, {
    id: triggerId('deadline-24h', params.deliverableId),
    type: 'deadline-24h',
    triggerAt,
    recipientUserId: params.creatorUserId,
    campaignId: params.campaignId,
    collaborationId: params.collaborationId,
    deliverableId: params.deliverableId,
    emitted: false,
    enqueuedAt: Date.now(),
  });
}

/**
 * Enqueue the "deliverable overdue" follow-up. Brief calls for "once,
 * then daily for 3 days" — implementation queues 3 rows, days 0/1/2
 * after the original due date, fanning out to both brand + creator.
 */
export function enqueueDeadlineOverdue(
  db: Database,
  params: {
    deliverableId: string;
    creatorUserId: string;
    brandUserId: string;
    dueAtMs: number;
    campaignId: string;
    collaborationId: string;
  },
): void {
  for (let day = 0; day < 3; day++) {
    const triggerAt = params.dueAtMs + day * DAY_MS;
    if (triggerAt <= Date.now()) continue;
    pushIfNew(db, {
      id: triggerId('deadline-overdue', `${params.deliverableId}_creator`, day),
      type: 'deadline-overdue',
      triggerAt,
      recipientUserId: params.creatorUserId,
      campaignId: params.campaignId,
      collaborationId: params.collaborationId,
      deliverableId: params.deliverableId,
      emitted: false,
      enqueuedAt: Date.now(),
      sequence: day,
    });
    pushIfNew(db, {
      id: triggerId('deadline-overdue', `${params.deliverableId}_brand`, day),
      type: 'deadline-overdue',
      triggerAt,
      recipientUserId: params.brandUserId,
      campaignId: params.campaignId,
      collaborationId: params.collaborationId,
      deliverableId: params.deliverableId,
      emitted: false,
      enqueuedAt: Date.now(),
      sequence: day,
    });
  }
}

/**
 * Enqueue the "stale escrow" follow-up at 30, 60, 90 days post-confirmation.
 * Per the implementation-plan recommendation, three checkpoints rather
 * than the brief's single "once" — the longer the deal stalls, the more
 * insistent the nudge.
 */
export function enqueueEscrowStale(
  db: Database,
  params: {
    collaborationId: string;
    creatorUserId: string;
    brandUserId: string;
    confirmedAtMs: number;
    campaignId: string;
  },
): void {
  for (const day of [30, 60, 90]) {
    const triggerAt = params.confirmedAtMs + day * DAY_MS;
    if (triggerAt <= Date.now()) continue;
    pushIfNew(db, {
      id: triggerId('escrow-stale-30d', `${params.collaborationId}_creator`, day),
      type: 'escrow-stale-30d',
      triggerAt,
      recipientUserId: params.creatorUserId,
      campaignId: params.campaignId,
      collaborationId: params.collaborationId,
      emitted: false,
      enqueuedAt: Date.now(),
      sequence: day,
    });
    pushIfNew(db, {
      id: triggerId('escrow-stale-30d', `${params.collaborationId}_brand`, day),
      type: 'escrow-stale-30d',
      triggerAt,
      recipientUserId: params.brandUserId,
      campaignId: params.campaignId,
      collaborationId: params.collaborationId,
      emitted: false,
      enqueuedAt: Date.now(),
      sequence: day,
    });
  }
}

/**
 * Enqueue the "dispute window closing in 48h" reminder for the brand.
 * Approval stamps `submission.disputeWindowClosesAt = now + 7d`; we
 * schedule the reminder 48h before that, so the brand knows time is
 * running out to flag a problem.
 */
export function enqueueReviewWindowClosing(
  db: Database,
  params: {
    submissionId: string;
    brandUserId: string;
    disputeWindowClosesAtMs: number;
    campaignId: string;
    collaborationId: string;
  },
): void {
  const triggerAt = params.disputeWindowClosesAtMs - 2 * DAY_MS;
  if (triggerAt <= Date.now()) return;
  pushIfNew(db, {
    id: triggerId('review-window-closing', params.submissionId),
    type: 'review-window-closing',
    triggerAt,
    recipientUserId: params.brandUserId,
    campaignId: params.campaignId,
    collaborationId: params.collaborationId,
    submissionId: params.submissionId,
    emitted: false,
    enqueuedAt: Date.now(),
  });
}

/**
 * Enqueue the "KYC expired" prompt for a creator. Caller fires this on
 * a yearly cadence when the creator has pending payouts that would be
 * blocked by expired verification.
 */
export function enqueueKycExpired(
  db: Database,
  params: {
    creatorUserId: string;
    expiresAtMs: number;
  },
): void {
  pushIfNew(db, {
    id: triggerId('kyc-expired', params.creatorUserId),
    type: 'kyc-expired',
    triggerAt: params.expiresAtMs,
    recipientUserId: params.creatorUserId,
    emitted: false,
    enqueuedAt: Date.now(),
  });
}

// =====================================================================
// Heartbeat — process the queue
// =====================================================================
//
// Walks `db.scheduledNotifications` and emits any pending row whose
// `triggerAt <= now`. Returns the number of rows emitted (mainly for
// tests / debug logging). Mutates `db` in place — caller wraps in a
// `tx(...)` if they want the change to persist.

/** Resolve the user's notification preferences for the trigger type.
 *  Same shape as `client.ts:pushNotification`'s `kind`. */
function notifKindFor(type: ScheduledNotificationType): keyof NotificationPrefs {
  switch (type) {
    case 'deadline-24h':
    case 'deadline-overdue':
    case 'escrow-stale-30d':
      return 'applications'; // generic creator-facing channel
    case 'review-window-closing':
      return 'approvals';
    case 'kyc-expired':
      return 'payouts';
  }
}

/** Build the notification text for a trigger. The text is composed at
 *  emit time so the latest entity values flow through (campaign title
 *  changes, creator name updates, etc.). */
function composeNotificationText(
  trigger: ScheduledNotification,
  db: Database,
): string {
  const camp = trigger.campaignId
    ? db.campaigns.find((c) => c.id === trigger.campaignId)
    : null;
  const campTitle = camp?.title ?? 'a campaign';
  const collab = trigger.collaborationId
    ? db.collaborations.find((c) => c.id === trigger.collaborationId)
    : null;
  const creator = collab
    ? db.creators.find((c) => c.id === collab.creatorId)
    : null;
  const brand = collab
    ? db.brands.find((b) => b.id === collab.brandId)
    : null;

  switch (trigger.type) {
    case 'deadline-24h':
      return `Reminder: deadline for ${campTitle} is in 24 hours`;
    case 'deadline-overdue': {
      const days = (trigger.sequence ?? 0) + 1;
      return `${campTitle} is overdue (day ${days})`;
    }
    case 'escrow-stale-30d': {
      const days = trigger.sequence ?? 30;
      const partyName = trigger.recipientUserId === brand?.userId
        ? (creator?.name ?? 'the creator')
        : (brand?.name ?? 'the brand');
      return `${days}-day check-in: ${campTitle} with ${partyName} hasn't moved — anything to nudge?`;
    }
    case 'review-window-closing':
      return `Review window closing in 48h on ${campTitle} — approve or raise a dispute`;
    case 'kyc-expired':
      return 'Your tax/identity verification expired — refresh it to keep payouts flowing';
  }
}

/** Build the deep-link href for a trigger. */
function composeNotificationHref(_trigger: ScheduledNotification): string {
  // All scheduler-emitted notifications currently point at the v2
  // surface; the bell deep-links the user to the relevant screen via
  // the `meta` FKs on the emitted Notification. The trigger argument
  // is reserved for future per-type routing (e.g., kyc-expired could
  // route directly to the settings screen) — kept on the signature so
  // callers don't need to change.
  return '/v2';
}

/**
 * Walk the queue and emit any row whose `triggerAt <= now`. Mutates
 * `db` in place. Returns the number of rows emitted.
 *
 * Idempotency: every emit flips `row.emitted = true` so re-running the
 * heartbeat is a no-op for already-emitted rows.
 */
export function processScheduledNotifications(db: Database, now: number = Date.now()): number {
  let emittedCount = 0;
  for (const row of db.scheduledNotifications) {
    if (row.emitted) continue;
    if (row.triggerAt > now) continue;

    // Respect user preferences. The notification kind maps to one of
    // the user's `NotificationPrefs` flags; if the user opted out, we
    // still flip `emitted = true` so we don't keep retrying the same
    // suppressed row every heartbeat.
    const u = db.users.find((x) => x.id === row.recipientUserId);
    const kind = notifKindFor(row.type);
    const optedOut = u?.notificationPrefs && u.notificationPrefs[kind] === false;

    if (!optedOut) {
      db.notifications.push({
        id: `n_sched_${row.id}`,
        userId: row.recipientUserId,
        text: composeNotificationText(row, db),
        href: composeNotificationHref(row),
        at: nowIsoFromMs(now),
        read: false,
        meta: {
          campaignId: row.campaignId,
          collaborationId: row.collaborationId,
          submissionId: row.submissionId,
        },
      });
      emittedCount += 1;
    }

    row.emitted = true;
    row.emittedAt = now;
  }
  return emittedCount;
}

/**
 * Convenience wrapper: run the heartbeat inside a `tx` so the changes
 * persist to the live store. Safe to call from a React effect / interval
 * / hydration-time pass / opportunistically from any read hook.
 */
export function runScheduledNotifications(now: number = Date.now()): number {
  return tx((db) => processScheduledNotifications(db, now));
}

/** Read-only convenience for tests / debug. */
export function getQueueState(): { pending: number; emitted: number } {
  const queue = useStore.getState().db.scheduledNotifications;
  return {
    pending: queue.filter((n) => !n.emitted).length,
    emitted: queue.filter((n) => n.emitted).length,
  };
}
