// threadToV2 adapter — regression test for the "Sarah self-message"
// bug.
//
// Pre-fix the Inbox conversation list rendered the THREAD's creator
// participant as the row label, regardless of viewer persona. For a
// creator viewer (Sarah signed in as a creator), every thread row
// labeled "Sarah" because she IS the creator participant on every
// thread. The actual fix was in `Inbox.tsx` (the row label now uses
// `counterparty` derived from persona), but the adapter is what feeds
// it the data. These tests pin the adapter's contract:
//
//   - threadToV2 returns a stable shape with `creatorId` and `brandId`
//     populated correctly from the participant list
//   - Messages are tagged `from: 'brand'` when the sender matches the
//     viewer (= "this is me"), `from: 'creator'` when not (= "this is
//     the other side"). The label is a UI convention, NOT a role —
//     and applies symmetrically to brand and creator viewers.
//   - A thread between a creator and a brand-team viewer maps with the
//     correct directional labels regardless of which side is signed in.

import { describe, it, expect } from 'vitest';
import { threadToV2 } from '../v2Adapters';
import type { Database, Thread, User, Creator, Brand, Message } from '@/lib/api/types';

// Minimal Database fixture — only fills the slices threadToV2 reads.
function emptyDb(overrides: Partial<Database> = {}): Database {
  return {
    users: [],
    creators: [],
    brands: [],
    campaigns: [],
    applications: [],
    offers: [],
    submissions: [],
    threads: [],
    messages: [],
    transactions: [],
    notifications: [],
    reviews: [],
    disputes: [],
    referrals: [],
    advances: [],
    testimonials: [],
    collaborations: [],
    deliverables: [],
    contracts: [],
    scheduledNotifications: [],
    outreach: [],
    teamInvites: [],
    sparkDrafts: [],
    migrationVersion: 0,
    ...overrides,
  };
}

function buildUser(over: Partial<User> = {}): User {
  return {
    id: 'u_x',
    email: 'x@x.test',
    passwordHash: '',
    role: 'creator',
    status: 'active',
    createdAt: '2026-01-01T00:00:00Z',
    ...over,
  };
}
function buildCreator(over: Partial<Creator> = {}): Creator {
  return {
    id: 'cr_x',
    userId: 'u_x',
    name: 'X',
    handle: '@x',
    tagline: '',
    bio: '',
    city: 'Lahore',
    country: 'PK',
    languages: ['en'],
    categories: [],
    portrait: '',
    work: [],
    platforms: [],
    reach: 0,
    engagement: 0,
    rating: 5,
    tier: 'Rising',
    responseHrs: 2,
    rateCard: { post: '', reel: '', story: '', longform: '' },
    payout: { method: 'bank', account: '', currency: 'USD' },
    walletBalance: 0,
    pendingBalance: 0,
    lifetimeEarnings: 0,
    verified: false,
    pressMentions: [],
    pastClients: [],
    ...over,
  };
}
function buildBrand(over: Partial<Brand> = {}): Brand {
  return {
    id: 'b_x',
    userId: 'u_b',
    name: 'X Brand',
    industry: '',
    hq: '',
    website: '',
    about: '',
    preferredCategories: [],
    preferredRegions: [],
    walletBalance: 0,
    escrowHeld: 0,
    verified: false,
    savedCreators: [],
    ...over,
  };
}

const sarahUser = buildUser({ id: 'u_sarah', email: 'sarah@alamut.test', role: 'creator', creatorId: 'cr_sarah' });
const sarah = buildCreator({ id: 'cr_sarah', userId: 'u_sarah', name: 'Sarah Johnson', handle: '@sarah' });
const hannahUser = buildUser({ id: 'u_hannah', email: 'hannah@aesop.test', role: 'brand', brandId: 'b_aesop' });
const aesop = buildBrand({ id: 'b_aesop', userId: 'u_hannah', name: 'Aesop' });

const thread: Thread = {
  id: 't_1',
  participants: ['u_sarah', 'u_hannah'],
  campaignId: 'cmp_1',
  collaborationId: null,
  unreadFor: [],
  mutedFor: [],
  archivedFor: [],
  lastMessageAt: '2026-05-13T10:00:00Z',
  subject: '',
};

const messages: Message[] = [
  // Sarah sends "Hi" — from Sarah's POV this is "me" (right-aligned).
  { id: 'm_1', threadId: 't_1', fromUserId: 'u_sarah', text: 'Hi', at: '2026-05-13T09:00:00Z' },
  // Hannah replies "Welcome" — from Sarah's POV this is the counterparty.
  { id: 'm_2', threadId: 't_1', fromUserId: 'u_hannah', text: 'Welcome', at: '2026-05-13T10:00:00Z' },
];

const db: Database = emptyDb({
  users: [sarahUser, hannahUser],
  creators: [sarah],
  brands: [aesop],
  threads: [thread],
  messages,
});

describe('threadToV2', () => {
  it('resolves creatorId + brandId from participants regardless of viewer', () => {
    const brandView = threadToV2(thread, db, 'u_hannah');
    const creatorView = threadToV2(thread, db, 'u_sarah');
    expect(brandView?.creatorId).toBe('cr_sarah');
    expect(brandView?.brandId).toBe('b_aesop');
    expect(creatorView?.creatorId).toBe('cr_sarah');
    expect(creatorView?.brandId).toBe('b_aesop');
  });

  it('tags messages "brand" when sender = viewer (Sarah POV: her own messages are "me")', () => {
    // Bug pre-fix: Inbox treated `m.from === 'brand'` as the viewer-side
    // bubble regardless. That part was correct; the bug was that the
    // CONVERSATION LIST row label used creator.name unconditionally. The
    // adapter contract here is: `from` is relative to viewerUserId.
    const sarahView = threadToV2(thread, db, 'u_sarah');
    expect(sarahView?.messages).toEqual([
      expect.objectContaining({ text: 'Hi',      from: 'brand' }),   // Sarah's own msg
      expect.objectContaining({ text: 'Welcome', from: 'creator' }), // Hannah's msg
    ]);
  });

  it('flips the from-direction when the brand viewer is signed in', () => {
    const hannahView = threadToV2(thread, db, 'u_hannah');
    expect(hannahView?.messages).toEqual([
      expect.objectContaining({ text: 'Hi',      from: 'creator' }), // Sarah's msg = "them"
      expect.objectContaining({ text: 'Welcome', from: 'brand' }),   // Hannah's own msg
    ]);
  });

  it('returns null for a thread with no creator-side participant (skips legacy data)', () => {
    const brokenThread: Thread = {
      ...thread,
      id: 't_legacy',
      participants: ['u_hannah', 'u_other_brand'],
    };
    const result = threadToV2(brokenThread, db, 'u_hannah');
    expect(result).toBeNull();
  });

  it('preserves the directionality contract for a unread-flagged thread', () => {
    const unreadThread: Thread = { ...thread, unreadFor: ['u_sarah'] };
    const dbWithUnread = emptyDb({ ...db, threads: [unreadThread] });
    const sarahView = threadToV2(unreadThread, dbWithUnread, 'u_sarah');
    expect(sarahView?.unread).toBe(1);
    // Direction tags still correct
    expect(sarahView?.messages[0]?.from).toBe('brand'); // her own msg
    expect(sarahView?.messages[1]?.from).toBe('creator'); // counterparty
  });
});
