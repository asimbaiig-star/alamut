// v2ReviewActions.test.ts — P4 §3.2 review moderation lifecycle.

import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from '@/lib/api/store';
import {
  v2ReportReview, v2HideReview, v2UnhideReview,
} from '../v2ReviewActions';
import { trustForCreator } from '@/lib/utils/trust';
import {
  buildDb, buildCampaign, buildCreator, buildBrand,
} from '@/lib/utils/__tests__/fixtures';
import type { Review, User } from '@/lib/api/types';

function userBrand(id: string, brandId: string): User {
  return {
    id, email: `${id}@b.com`, passwordHash: 'demo', role: 'brand',
    status: 'active', createdAt: '2026-04-01T00:00:00Z', brandId, teamRole: 'admin',
  };
}
function userCreator(id: string, creatorId: string): User {
  return {
    id, email: `${id}@c.com`, passwordHash: 'demo', role: 'creator',
    status: 'active', createdAt: '2026-04-01T00:00:00Z', creatorId,
  };
}
function userAdmin(id: string): User {
  return {
    id, email: `${id}@admin.com`, passwordHash: 'demo', role: 'admin',
    status: 'active', createdAt: '2026-04-01T00:00:00Z', adminRoles: ['super'],
  };
}
function makeReview(p: Partial<Review> = {}): Review {
  return {
    id: 'rv_1',
    campaignId: 'cmp_1',
    fromUserId: 'u_brand',
    reviewType: 'creator',
    targetId: 'cr_1',
    rating: 5,
    text: 'Great work',
    at: '2026-04-22T00:00:00Z',
    reportedBy: [],
    hidden: false,
    ...p,
  };
}

function setupDb(reviewOverride: Partial<Review> = {}) {
  return buildDb({
    users: [userBrand('u_brand', 'br_1'), userCreator('u_creator', 'cr_1'), userAdmin('u_admin')],
    creators: [buildCreator({ id: 'cr_1', userId: 'u_creator' })],
    brands: [buildBrand({ id: 'br_1', userId: 'u_brand' })],
    campaigns: [buildCampaign({ id: 'cmp_1', brandId: 'br_1' })],
    reviews: [makeReview(reviewOverride)],
  });
}

describe('v2ReportReview', () => {
  beforeEach(() => {
    useStore.getState().setDB(setupDb());
    useStore.getState().setSession(null);
  });

  it('pushes the user id into reportedBy[]', () => {
    v2ReportReview('rv_1', 'u_creator', 'unfair review');
    const review = useStore.getState().db.reviews[0];
    expect(review.reportedBy).toContain('u_creator');
  });

  it('idempotent — re-reporting by the same user is a no-op', () => {
    v2ReportReview('rv_1', 'u_creator', 'reason');
    v2ReportReview('rv_1', 'u_creator', 'reason');
    expect(useStore.getState().db.reviews[0].reportedBy).toEqual(['u_creator']);
  });

  it('multiple users can report the same review (count grows)', () => {
    v2ReportReview('rv_1', 'u_creator', 'r1');
    v2ReportReview('rv_1', 'u_brand', 'r2');
    expect(useStore.getState().db.reviews[0].reportedBy).toEqual(['u_creator', 'u_brand']);
  });

  it('notifies admins on FIRST report only (not on subsequent flags)', () => {
    v2ReportReview('rv_1', 'u_creator', 'first');
    const adminCountAfterFirst = useStore.getState().db.notifications.filter((n) => n.userId === 'u_admin').length;

    v2ReportReview('rv_1', 'u_brand', 'second');
    const adminCountAfterSecond = useStore.getState().db.notifications.filter((n) => n.userId === 'u_admin').length;

    expect(adminCountAfterFirst).toBe(1);
    expect(adminCountAfterSecond).toBe(1); // no spam
  });
});

describe('v2HideReview', () => {
  beforeEach(() => {
    useStore.getState().setDB(setupDb());
    useStore.getState().setSession(null);
  });

  it('sets hidden + reason + timestamp', () => {
    v2HideReview('rv_1', 'u_admin', 'Defamatory content');
    const review = useStore.getState().db.reviews[0];
    expect(review.hidden).toBe(true);
    expect(review.hiddenReason).toBe('Defamatory content');
    expect(review.hiddenAt).toBeGreaterThan(0);
  });

  it('notifies the original reviewer with the reason', () => {
    v2HideReview('rv_1', 'u_admin', 'Defamatory content here');
    const notif = useStore.getState().db.notifications.find((n) => n.userId === 'u_brand');
    expect(notif).toBeDefined();
    expect(notif?.text).toContain('hidden');
    expect(notif?.text).toContain('Defamatory content here');
  });

  it('idempotent on already-hidden review', () => {
    v2HideReview('rv_1', 'u_admin', 'first reason');
    const firstAt = useStore.getState().db.reviews[0].hiddenAt;
    v2HideReview('rv_1', 'u_admin', 'second reason');
    expect(useStore.getState().db.reviews[0].hiddenAt).toBe(firstAt);
    expect(useStore.getState().db.reviews[0].hiddenReason).toBe('first reason');
  });
});

describe('v2UnhideReview', () => {
  beforeEach(() => {
    useStore.getState().setDB(setupDb());
    useStore.getState().setSession(null);
    v2HideReview('rv_1', 'u_admin', 'reason');
  });

  it('clears hidden + hiddenReason + hiddenAt', () => {
    v2UnhideReview('rv_1', 'u_admin');
    const review = useStore.getState().db.reviews[0];
    expect(review.hidden).toBe(false);
    expect(review.hiddenReason).toBeUndefined();
    expect(review.hiddenAt).toBeUndefined();
  });

  it('notifies the reviewer their review was restored', () => {
    v2UnhideReview('rv_1', 'u_admin');
    const notif = useStore.getState().db.notifications.find(
      (n) => n.userId === 'u_brand' && n.text.includes('restored'),
    );
    expect(notif).toBeDefined();
  });

  it('idempotent on already-visible review', () => {
    v2UnhideReview('rv_1', 'u_admin'); // first call clears
    const beforeCount = useStore.getState().db.notifications.length;
    v2UnhideReview('rv_1', 'u_admin'); // second call no-op
    expect(useStore.getState().db.notifications.length).toBe(beforeCount);
  });
});

describe('hidden reviews filter from public read paths', () => {
  it('trustForCreator excludes hidden rows from rating + count', () => {
    // Two reviews: one visible 5-star, one hidden 1-star.
    // Without filter: avg = 3.0, count = 2.
    // With filter:    avg = 5.0, count = 1.
    useStore.getState().setDB(buildDb({
      users: [userBrand('u_brand', 'br_1'), userCreator('u_creator', 'cr_1')],
      creators: [buildCreator({ id: 'cr_1', userId: 'u_creator' })],
      brands: [buildBrand({ id: 'br_1', userId: 'u_brand' })],
      campaigns: [buildCampaign({ id: 'cmp_1', brandId: 'br_1' })],
      reviews: [
        makeReview({ id: 'rv_visible', rating: 5, hidden: false }),
        makeReview({ id: 'rv_hidden',  rating: 1, hidden: true }),
      ],
    }));
    const db = useStore.getState().db;
    const creator = db.creators[0];
    const trust = trustForCreator(db, creator);
    expect(trust.reviewCount).toBe(1);
    expect(trust.avgRating).toBe(5);
  });

  it('hide flips a review out of trust calc; unhide brings it back', () => {
    useStore.getState().setDB(buildDb({
      users: [userBrand('u_brand', 'br_1'), userCreator('u_creator', 'cr_1'), userAdmin('u_admin')],
      creators: [buildCreator({ id: 'cr_1', userId: 'u_creator' })],
      brands: [buildBrand({ id: 'br_1', userId: 'u_brand' })],
      campaigns: [buildCampaign({ id: 'cmp_1', brandId: 'br_1' })],
      reviews: [makeReview({ id: 'rv_1', rating: 5 })],
    }));
    let db = useStore.getState().db;
    expect(trustForCreator(db, db.creators[0]).reviewCount).toBe(1);

    v2HideReview('rv_1', 'u_admin', 'reason');
    db = useStore.getState().db;
    expect(trustForCreator(db, db.creators[0]).reviewCount).toBe(0);

    v2UnhideReview('rv_1', 'u_admin');
    db = useStore.getState().db;
    expect(trustForCreator(db, db.creators[0]).reviewCount).toBe(1);
  });
});
