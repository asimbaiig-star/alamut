// useScheduledNotifications.ts — the heartbeat that drains the scheduled
// notification queue.
//
// This effect used to live inline in `WorkspaceShell`, and `WorkspaceShell`
// is mounted ONLY under `<ProtectedRoute allow={['admin']} />` (router.tsx).
// The `/v2` workspace — the surface every brand and creator actually uses —
// has its own shell and never called the scheduler. So every row enqueued by
// `enqueueDeadline24h`, `enqueueDeadlineOverdue`, `enqueueEscrowStale`,
// `enqueueReviewWindowClosing` and `enqueueKycExpired` sat with
// `emitted: false` forever: deadline reminders, overdue follow-ups,
// stale-escrow nudges, "your dispute window is closing" and "your KYC
// expired" never reached anyone, unless that same browser session happened
// to sit on an /admin route for a full minute.
//
// Extracted into one hook rather than copied into the second shell — a
// duplicated heartbeat is precisely how the two drift again.

import { useEffect } from 'react';
import { useStore } from './store';
import { runScheduledNotifications } from './scheduler';

/** How often the queue is re-scanned while a workspace is open. */
const TICK_MS = 60_000;

/**
 * Runs the scheduled-notification queue on mount (catching up anything that
 * came due while the tab was closed) and every 60s thereafter.
 *
 * Idempotent by construction: each tick materializes due rows and flips
 * their `emitted` flag, so the next tick is a no-op for rows already fired.
 * Call this once per shell.
 */
export function useScheduledNotifications(): void {
  const hasHydrated = useStore.persist.hasHydrated();
  useEffect(() => {
    // Waiting for hydration matters: before it lands the store still holds
    // the default DB, so a tick would scan an empty queue and — worse —
    // could emit against seed rows that the persisted state replaces a
    // moment later.
    if (!hasHydrated) return;
    runScheduledNotifications();
    const intervalId = window.setInterval(() => {
      runScheduledNotifications();
    }, TICK_MS);
    return () => window.clearInterval(intervalId);
  }, [hasHydrated]);
}
