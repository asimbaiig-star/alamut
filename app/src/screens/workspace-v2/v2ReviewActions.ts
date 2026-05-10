// v2ReviewActions.ts — P4 §3.2 review moderation mutations.
//
// Reviews are the public-facing trust signal on creator + brand
// storefronts. Pre-P4 anyone could leave a review and it stayed up
// indefinitely; the only filter was rating-based ordering.
//
// P4 adds three lightweight moderation mutations:
//
//   v2ReportReview(reviewId, byUserId, reason?)
//     Either party (or any signed-in user, really) flags a review for
//     admin attention. Pushes the user's id into Review.reportedBy[].
//     Idempotent — re-reporting is a no-op. Notifies admins so the
//     case lands in the admin queue.
//
//   v2HideReview(reviewId, adminUserId, reason)
//     Admin removes a review from the public storefront read paths.
//     Sets `hidden: true` + reason + timestamp. Doesn't delete the
//     row (audit trail preserved); read paths just filter it out.
//
//   v2UnhideReview(reviewId, adminUserId)
//     Admin reverses a hide. Clears `hidden`, `hiddenReason`, `hiddenAt`.
//
// Authorization is at the UI/route layer (admin gates the hide/unhide
// buttons; everyone has access to report). The mutations themselves
// don't enforce — they trust the caller. P5 (permissions) will gate
// them via `requireCapability` properly.

import { tx } from '@/lib/api/store';
import type { Review } from '@/lib/api/types';
// P5 §4.1 — capability gate.
import { requireCapability, getActorUserId } from '@/lib/permissions';

function newId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

/**
 * User flags a review. Pushes their id into `reportedBy[]` if not
 * already present (idempotent). Notifies admins on the first report
 * for this review so the case lands in the queue once, not on every
 * subsequent flag.
 */
export function v2ReportReview(
  reviewId: string,
  byUserId: string,
  reason?: string,
): Review | null {
  return tx((db) => {
    // P5 §4.1 — `viewer.read` is the floor; everyone signed in can
    // report a review they find objectionable. Tightening this gate
    // would prevent legitimate flag traffic.
    requireCapability(getActorUserId(), 'viewer.read', db);

    const review = db.reviews.find((r) => r.id === reviewId);
    if (!review) return null;
    const reportedBy = review.reportedBy ?? [];
    if (reportedBy.includes(byUserId)) return review; // idempotent

    const isFirstReport = reportedBy.length === 0;
    review.reportedBy = [...reportedBy, byUserId];

    // Notify admins on first report so the case lands in /admin/queue
    // exactly once. Subsequent flags from other users still update
    // `reportedBy` (the count surfaces in the queue) but don't spam
    // notifications.
    if (isFirstReport) {
      const camp = db.campaigns.find((c) => c.id === review.campaignId);
      const campTitle = camp?.title ?? 'a campaign';
      const previewReason = reason ? ` — "${reason.slice(0, 80)}${reason.length > 80 ? '…' : ''}"` : '';
      db.users.filter((u) => u.role === 'admin').forEach((adm) => {
        db.notifications.push({
          id: newId('n'),
          userId: adm.id,
          text: `Review reported on ${campTitle}${previewReason}`,
          href: '/admin/queue?type=reviews',
          at: nowIso(),
          read: false,
          meta: { campaignId: review.campaignId, reviewId: review.id },
        });
      });
    }

    return review;
  });
}

/**
 * Admin hides a review. Sets `hidden: true` + reason + timestamp.
 * Storefront read paths filter on `hidden === true` so the review
 * disappears from public surfaces; the row stays in `db.reviews` for
 * audit. Notifies the original reviewer that their review was hidden
 * (with the reason — they have a path to appeal via support).
 */
export function v2HideReview(
  reviewId: string,
  adminUserId: string,
  reason: string,
): Review | null {
  return tx((db) => {
    // P5 §4.1 — `review.moderate` is held by `super` + `disputes`
    // admin roles only. Brand teamRoles never get it.
    requireCapability(getActorUserId(), 'review.moderate', db);

    const review = db.reviews.find((r) => r.id === reviewId);
    if (!review) return null;
    if (review.hidden) return review; // already hidden — no-op

    review.hidden = true;
    review.hiddenReason = reason;
    review.hiddenAt = Date.now();

    // Track who hid it via a notification to the reviewer. The admin's
    // identity isn't on the Review row itself (just `hiddenAt`); the
    // audit trail lives in the notification + the activity feed.
    void adminUserId;

    const camp = db.campaigns.find((c) => c.id === review.campaignId);
    const campTitle = camp?.title ?? 'a campaign';
    db.notifications.push({
      id: newId('n'),
      userId: review.fromUserId,
      text: `Your review on ${campTitle} was hidden by an admin — "${reason.slice(0, 80)}${reason.length > 80 ? '…' : ''}"`,
      href: '/v2',
      at: nowIso(),
      read: false,
      meta: { campaignId: review.campaignId, reviewId: review.id },
    });

    return review;
  });
}

/**
 * Admin reverses a hide. Clears the moderation fields. The review is
 * visible again on public storefronts.
 */
export function v2UnhideReview(reviewId: string, adminUserId: string): Review | null {
  return tx((db) => {
    // P5 §4.1 — same gate as hide.
    requireCapability(getActorUserId(), 'review.moderate', db);

    const review = db.reviews.find((r) => r.id === reviewId);
    if (!review) return null;
    if (!review.hidden) return review; // already visible — no-op

    review.hidden = false;
    review.hiddenReason = undefined;
    review.hiddenAt = undefined;

    void adminUserId;

    const camp = db.campaigns.find((c) => c.id === review.campaignId);
    const campTitle = camp?.title ?? 'a campaign';
    db.notifications.push({
      id: newId('n'),
      userId: review.fromUserId,
      text: `Your review on ${campTitle} was restored.`,
      href: '/v2',
      at: nowIso(),
      read: false,
      meta: { campaignId: review.campaignId, reviewId: review.id },
    });

    return review;
  });
}
