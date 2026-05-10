// v2OutreachActions.test.ts — P6 §5.3 brand-side soft contact lifecycle.

import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from '@/lib/api/store';
import {
  v2SendOutreach, v2RespondOutreach, v2ArchiveOutreach,
} from '../v2OutreachActions';
import {
  buildDb, buildCampaign, buildCreator, buildBrand,
} from '@/lib/utils/__tests__/fixtures';
import type { User } from '@/lib/api/types';

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

function setupDb() {
  return buildDb({
    users: [userBrand('u_brand', 'br_1'), userCreator('u_creator', 'cr_1')],
    creators: [buildCreator({ id: 'cr_1', userId: 'u_creator', name: 'Sarah Chen' })],
    brands: [buildBrand({ id: 'br_1', userId: 'u_brand', name: 'Aesop' })],
    campaigns: [buildCampaign({ id: 'cmp_1', brandId: 'br_1', title: 'Spring Renewal' })],
  });
}

describe('v2SendOutreach', () => {
  beforeEach(() => {
    useStore.getState().setDB(setupDb());
    useStore.getState().setSession(null);
  });

  it('creates an Outreach row with status="sent"', () => {
    const result = v2SendOutreach({
      campaignId: 'cmp_1',
      creatorId: 'cr_1',
      message: 'Loved your aesthetic — would you be open to a Spring brief?',
      sentByUserId: 'u_brand',
    });
    expect(result).toBeDefined();
    const db = useStore.getState().db;
    expect(db.outreach.length).toBe(1);
    expect(db.outreach[0].status).toBe('sent');
    expect(db.outreach[0].brandId).toBe('br_1');
    expect(db.outreach[0].creatorId).toBe('cr_1');
    expect(db.outreach[0].sentByUserId).toBe('u_brand');
  });

  it('supports campaign-less outreach (campaignId: null)', () => {
    v2SendOutreach({
      campaignId: null,
      creatorId: 'cr_1',
      message: 'Pre-launch — want to talk?',
      sentByUserId: 'u_brand',
    });
    const db = useStore.getState().db;
    expect(db.outreach[0].campaignId).toBeNull();
  });

  it('notifies the creator with a preview of the message', () => {
    v2SendOutreach({
      campaignId: 'cmp_1',
      creatorId: 'cr_1',
      message: 'A specific hook line that should appear in the bell',
      sentByUserId: 'u_brand',
    });
    const notif = useStore.getState().db.notifications.find((n) => n.userId === 'u_creator');
    expect(notif).toBeDefined();
    expect(notif?.text).toContain('Spring Renewal');
    expect(notif?.text).toContain('reach-out from Aesop');
    expect(notif?.text).toContain('A specific hook line');
  });

  it('returns null when sender has no brand', () => {
    // Use the creator user as sender — has no brandId.
    const result = v2SendOutreach({
      campaignId: 'cmp_1',
      creatorId: 'cr_1',
      message: 'msg',
      sentByUserId: 'u_creator',
    });
    expect(result).toBeNull();
    expect(useStore.getState().db.outreach.length).toBe(0);
  });
});

describe('v2RespondOutreach', () => {
  beforeEach(() => {
    useStore.getState().setDB(setupDb());
    useStore.getState().setSession(null);
    v2SendOutreach({
      campaignId: 'cmp_1',
      creatorId: 'cr_1',
      message: 'Want to chat?',
      sentByUserId: 'u_brand',
    });
  });

  it('creator engages → status=replied + notifies sender', () => {
    const id = useStore.getState().db.outreach[0].id;
    v2RespondOutreach(id, 'replied');
    const db = useStore.getState().db;
    expect(db.outreach[0].status).toBe('replied');
    expect(db.outreach[0].respondedAt).toBeTruthy();
    const senderNotif = db.notifications.find((n) => n.userId === 'u_brand' && n.text.includes('wants to talk'));
    expect(senderNotif).toBeDefined();
  });

  it('creator declines → status=declined', () => {
    const id = useStore.getState().db.outreach[0].id;
    v2RespondOutreach(id, 'declined');
    const db = useStore.getState().db;
    expect(db.outreach[0].status).toBe('declined');
    const senderNotif = db.notifications.find((n) => n.userId === 'u_brand' && n.text.includes("isn't interested"));
    expect(senderNotif).toBeDefined();
  });

  it('only "sent" outreach can be responded to (already-replied is no-op)', () => {
    const id = useStore.getState().db.outreach[0].id;
    v2RespondOutreach(id, 'replied');
    v2RespondOutreach(id, 'declined'); // try to flip
    expect(useStore.getState().db.outreach[0].status).toBe('replied');
  });
});

describe('v2ArchiveOutreach', () => {
  beforeEach(() => {
    useStore.getState().setDB(setupDb());
    useStore.getState().setSession(null);
    v2SendOutreach({
      campaignId: 'cmp_1',
      creatorId: 'cr_1',
      message: 'msg',
      sentByUserId: 'u_brand',
    });
  });

  it('archives a stale outreach', () => {
    const id = useStore.getState().db.outreach[0].id;
    v2ArchiveOutreach(id);
    expect(useStore.getState().db.outreach[0].status).toBe('archived');
  });

  it('idempotent on already-archived rows', () => {
    const id = useStore.getState().db.outreach[0].id;
    v2ArchiveOutreach(id);
    const respondedAtAfterFirst = useStore.getState().db.outreach[0].respondedAt;
    v2ArchiveOutreach(id);
    expect(useStore.getState().db.outreach[0].respondedAt).toBe(respondedAtAfterFirst);
  });

  it('does not push a notification on archive (tidy-up action)', () => {
    const beforeCount = useStore.getState().db.notifications.length;
    const id = useStore.getState().db.outreach[0].id;
    v2ArchiveOutreach(id);
    expect(useStore.getState().db.notifications.length).toBe(beforeCount);
  });
});
