// migrations.test.ts — end-to-end migrator chain regression coverage.
//
// Builds a minimal pre-migration store (a v0-shaped Database with a
// few apps/offers/submissions to exercise the materialization paths)
// then walks runPendingMigrations from undefined → CURRENT_MIGRATION_VERSION.
// Asserts that each migrator's effect is observable on the resulting
// store.
//
// This catches the kind of bug FIX #7 fixed (seeded disputes with
// empty `collaborationId` weren't getting backfilled because migrator
// 5's reshape pass had an over-aggressive skip guard). A full chain
// test would have surfaced that on the first run.
//
// Idempotency check: running runPendingMigrations twice produces the
// same result as running it once.

import { describe, it, expect } from 'vitest';
import { runPendingMigrations, CURRENT_MIGRATION_VERSION } from '../migrations';
import type { Database } from '../types';

/** Build a "v0-ish" Database — pre-migration shape, with the absolute
 *  minimum data needed to exercise each migrator's materialization
 *  path. We use `as Database` to bypass the type checker since the
 *  shape intentionally lacks post-P1c/P1d/etc. fields that would be
 *  required at compile time. */
function makePreMigrationDb(): Database {
  // Two timestamps — the application MUST be submitted strictly before
  // the offer.sentAt for migrator 2's `applicationId` backfill to match
  // (the migrator filters `new Date(a.submittedAt).getTime() < new Date(o.sentAt).getTime()`).
  const tApp = '2026-04-01T00:00:00.000Z';
  const tOffer = '2026-04-02T00:00:00.000Z';
  const now = tOffer;
  // Cast through `unknown` to placate the post-P9 Database shape —
  // the migrator's job is exactly to fill in the missing fields.
  return {
    users: [
      {
        id: 'u_creator', email: 'c@x.com', passwordHash: 'demo',
        role: 'creator', status: 'active', createdAt: now, creatorId: 'cr_1',
      },
      {
        id: 'u_brand', email: 'b@x.com', passwordHash: 'demo',
        role: 'brand', status: 'active', createdAt: now, brandId: 'br_1',
        teamRole: 'admin',
      },
      // Admin user without `adminRoles` — migrator 8 should backfill ['super'].
      {
        id: 'u_admin', email: 'admin@x.com', passwordHash: 'demo',
        role: 'admin', status: 'active', createdAt: now,
        // no adminRoles
      },
    ],
    creators: [
      {
        id: 'cr_1', userId: 'u_creator', name: 'Sarah Chen', handle: '@sarah',
        tagline: 'beauty creator', bio: 'forty plus character bio for the test',
        city: 'Karachi', country: 'PK', languages: ['en'],
        categories: ['Beauty'], portrait: 'p.jpg', work: ['w1.jpg'],
        platforms: [
          // Pre-P6 every channel was verified by default.
          { name: 'Instagram', handle: '@sarah', followers: 50_000, engagement: 3.2, verified: true },
        ],
        reach: 50_000, engagement: 3.2, rating: 4.8, tier: 'Specialist',
        responseHrs: 6,
        rateCard: { post: '$500', reel: '$1500', story: '$300', longform: '$3000' },
        payout: { method: 'wise', account: '••', currency: 'USD' },
        walletBalance: 0, pendingBalance: 0, lifetimeEarnings: 0,
        verified: true,
        // Pre-P6: profileCompletion was a stored field. Cast to assign.
        ...(({ profileCompletion: 75 } as unknown) as { profileCompletion: number }),
        pressMentions: [], pastClients: [],
      },
    ],
    brands: [
      {
        id: 'br_1', userId: 'u_brand', name: 'Aesop',
        industry: 'Beauty', hq: 'Sydney', website: 'aesop.com',
        about: '', preferredCategories: [], preferredRegions: [],
        walletBalance: 5000, escrowHeld: 1500,
        verified: true, savedCreators: [],
      },
    ],
    campaigns: [
      // Pre-P1b shape: stage was an 8-value enum. Use 'production' which
      // the migrator collapses to 'live'. Pre-P1d shape: `deliverables`
      // is a free-form string that migrator 4 expands.
      // Cast through `unknown` to set ONLY the legacy `deliverables`
      // field (string). Migrator 4 will fill in `deliverablesText` +
      // `deliverableIds` from the legacy text. The Campaign type
      // requires those fields post-P1d, but pre-migration data
      // legitimately doesn't have them yet.
      ({
        id: 'cmp_1', brandId: 'br_1',
        title: 'Spring Renewal', pitch: 'p', brief: 'b',
        cover: 'c.jpg', budget: 5000, spent: 0, escrowHeld: 1500,
        region: 'Global', category: 'Beauty',
        stage: 'production', // pre-P1b 8-stage value; migrator 2 collapses
        deliverables: '1 Reel + 3 stories', // pre-P1d free-form string
        // No `deliverablesText` / `deliverableIds` — migrator 4 fills.
        deadline: '2026-06-30', createdAt: now, history: [],
        milestones: [], applications: ['app_1'], offers: ['off_1'],
      } as unknown) as Database['campaigns'][number],
    ],
    applications: [
      {
        id: 'app_1', campaignId: 'cmp_1', creatorId: 'cr_1',
        pitch: 'pitch', proposedRate: 1500, status: 'shortlisted',
        submittedAt: tApp, decidedAt: tApp,
      },
    ],
    offers: [
      // Pre-P1b: no applicationId/source. Pre-P3: legacy `counter`
      // shape (no `rounds[]`). Migrators 2 + 6 will backfill both.
      {
        id: 'off_1', campaignId: 'cmp_1', creatorId: 'cr_1',
        rate: 1500, message: 'msg', status: 'accepted',
        sentAt: tOffer, respondedAt: tOffer,
        // Cast assignments for pre-migration fields:
        ...(({
          counter: { rate: 1700, message: 'higher', at: tOffer },
        } as unknown) as { counter: { rate: number; message: string; at: string } }),
      } as unknown as Database['offers'][number],
    ],
    submissions: [
      // Pre-P1d: deliverableId encoded in `[slot:N]` notes prefix.
      // Migrator 4 strips the prefix and sets the FK.
      {
        id: 'sub_1', campaignId: 'cmp_1', creatorId: 'cr_1', round: 1,
        files: [{ name: 'draft.mp4', url: '#' }],
        notes: '[slot:0] Caption text',
        status: 'in_review', submittedAt: now, feedback: [],
      },
    ],
    threads: [
      // Pre-P1b: no `collaborationId`. Migrator 2 sets to null;
      // migrator 3 promotes to a real id once Collaborations exist.
      {
        id: 't_1',
        participants: ['u_brand', 'u_creator'],
        campaignId: 'cmp_1',
        subject: 'Spring Renewal',
        lastMessageAt: now, unreadFor: [],
      } as unknown as Database['threads'][number],
    ],
    messages: [],
    transactions: [],
    notifications: [],
    reviews: [
      // Pre-P4: no reportedBy/hidden. Migrator 7 sets defaults.
      {
        id: 'rv_1', campaignId: 'cmp_1', fromUserId: 'u_brand',
        reviewType: 'creator', targetId: 'cr_1', rating: 5, text: 'great', at: now,
      },
    ],
    disputes: [
      // Pre-P2: legacy dispute shape. Migrator 5 reshapes.
      ...(([{
        id: 'disp_1',
        campaignId: 'cmp_1',
        openedByUserId: 'u_creator',
        openedAt: now,
        againstUserId: 'u_brand',
        reason: 'brand_no_approval',
        details: 'Stalled review',
        status: 'open',
      }] as unknown) as Database['disputes']),
    ],
    referrals: [],
    advances: [],
    testimonials: [],
    // Pre-P1c: collaborations table didn't exist on the type. Cast
    // through unknown to omit it from the v0-shaped object.
    ...(({} as unknown) as { collaborations: never }),
    collaborations: [],
    deliverables: [],
    contracts: [],
    scheduledNotifications: [],
    outreach: [],
    // No migrationVersion → starts at undefined → first run walks 1..9.
  };
}

describe('runPendingMigrations — full chain v0 → v9', () => {
  it('walks every migrator from undefined to CURRENT_MIGRATION_VERSION', () => {
    const db = makePreMigrationDb();
    expect(db.migrationVersion).toBeUndefined();

    runPendingMigrations(db);

    expect(db.migrationVersion).toBe(CURRENT_MIGRATION_VERSION);
    expect(db.migrationVersion).toBe(9);
  });

  it('migrator 1 (P1a) — drops Campaign.acceptedCreators / shortlist', () => {
    const db = makePreMigrationDb();
    // Inject the legacy fields onto cmp_1 (cast through unknown).
    (db.campaigns[0] as unknown as Record<string, unknown>).acceptedCreators = ['cr_1'];
    (db.campaigns[0] as unknown as Record<string, unknown>).shortlist = ['cr_1'];

    runPendingMigrations(db);

    const camp = db.campaigns[0] as unknown as Record<string, unknown>;
    expect(camp.acceptedCreators).toBeUndefined();
    expect(camp.shortlist).toBeUndefined();
  });

  it('migrator 2 (P1b) — collapses 8-value stage to 4 + backfills offer.applicationId/source', () => {
    const db = makePreMigrationDb();
    runPendingMigrations(db);

    // Stage 'production' was collapsed to 'live'.
    expect(db.campaigns[0].stage).toBe('live');
    // Offer gained applicationId + source from migrator 2's backfill.
    const offer = db.offers[0];
    expect(offer.applicationId).toBe('app_1');
    expect(offer.source).toBe('application');
  });

  it('migrator 3 (P1c) — materializes Collaborations from apps/offers/subs + promotes threads', () => {
    const db = makePreMigrationDb();
    expect(db.collaborations.length).toBe(0);
    runPendingMigrations(db);

    expect(db.collaborations.length).toBeGreaterThan(0);
    const collab = db.collaborations.find((c) => c.campaignId === 'cmp_1' && c.creatorId === 'cr_1');
    expect(collab).toBeDefined();
    // Stage rolled up from accepted offer + in_review submission → 'submitted'.
    expect(collab!.stage).toBe('submitted');

    // Thread promoted to point at the new collab.
    expect(db.threads[0].collaborationId).toBe(collab!.id);
  });

  it('migrator 4 (P1d) — materializes Deliverables + sets Submission.deliverableId + strips [slot:N] prefix', () => {
    const db = makePreMigrationDb();
    runPendingMigrations(db);

    // Deliverables materialized from "1 Reel + 3 stories" → 4 rows.
    const campDels = db.deliverables.filter((d) => d.campaignId === 'cmp_1');
    expect(campDels.length).toBe(4);

    // deliverablesText preserved on the campaign.
    expect(db.campaigns[0].deliverablesText).toBe('1 Reel + 3 stories');
    // deliverableIds populated.
    expect(db.campaigns[0].deliverableIds.length).toBe(4);

    // Submission's [slot:0] prefix stripped + deliverableId set.
    const sub = db.submissions[0];
    expect(sub.notes).toBe('Caption text'); // prefix gone
    expect(sub.deliverableId).toBeDefined();
    // FK resolves to the slot-0 Deliverable.
    const matchedDel = db.deliverables.find((d) => d.id === sub.deliverableId);
    expect(matchedDel?.index).toBe(0);
  });

  it('migrator 5 (P2) — backfills Contracts for accepted-offer Collabs + reshapes Disputes', () => {
    const db = makePreMigrationDb();
    runPendingMigrations(db);

    // Contract materialized for the confirmed/submitted/etc. collab.
    expect(db.contracts.length).toBeGreaterThan(0);
    const contract = db.contracts[0];
    expect(contract.collaborationId).toBeDefined();
    expect(contract.agreedRate).toBe(1500);
    expect(contract.briefSnapshot).toBeDefined();

    // Collab.contractId points back at the new contract.
    const collab = db.collaborations.find((c) => c.campaignId === 'cmp_1' && c.creatorId === 'cr_1');
    expect(collab!.contractId).toBe(contract.id);

    // Dispute reshaped: legacy `openedByUserId/reason/details/openedAt`
    // → new `raisedByUserId/category/description/raisedAt`.
    const disp = db.disputes[0];
    expect(disp.raisedByUserId).toBe('u_creator');
    expect(disp.raisedByRole).toBe('creator');
    // 'brand_no_approval' (legacy) → 'quality' (new).
    expect(disp.category).toBe('quality');
    expect(disp.description).toBe('Stalled review');
    expect(disp.evidence).toEqual([]);
    expect(disp.messages).toEqual([]);
    expect(typeof disp.raisedAt).toBe('number');

    // FIX #7 regression — `collaborationId` populated from candidate users.
    expect(disp.collaborationId).toBe(collab!.id);
    expect(disp.collaborationId).not.toBe('');

    // Open dispute mirrors to escrowFrozen=true on the collab.
    expect(collab!.escrowFrozen).toBe(true);
  });

  it('migrator 6 (P3) — promotes Offer.counter to Offer.rounds[] + defaults Campaign.autoShortlist', () => {
    const db = makePreMigrationDb();
    runPendingMigrations(db);

    // Offer.rounds[] backfilled: round 0 = brand initial, round 1 = creator counter.
    const offer = db.offers[0];
    expect(offer.rounds.length).toBe(2);
    expect(offer.rounds[0].by).toBe('brand');
    expect(offer.rounds[0].rate).toBe(1500);
    expect(offer.rounds[1].by).toBe('creator');
    expect(offer.rounds[1].rate).toBe(1700);
    expect(offer.rounds[1].message).toBe('higher');

    // Legacy `counter` field deleted off the row.
    expect((offer as unknown as Record<string, unknown>).counter).toBeUndefined();

    // Campaign.autoShortlist defaulted to null.
    expect(db.campaigns[0].autoShortlist).toBeNull();
  });

  it('migrator 7 (P4) — initializes scheduledNotifications + defaults Review.reportedBy/hidden', () => {
    const db = makePreMigrationDb();
    runPendingMigrations(db);

    // Reviews stamped with defaults.
    const r = db.reviews[0];
    expect(r.reportedBy).toEqual([]);
    expect(r.hidden).toBe(false);

    // scheduledNotifications table exists (already empty in our seed).
    expect(Array.isArray(db.scheduledNotifications)).toBe(true);
  });

  it('migrator 8 (P5) — defaults adminRoles=[\'super\'] on legacy admins', () => {
    const db = makePreMigrationDb();
    const adminBefore = db.users.find((u) => u.id === 'u_admin');
    expect(adminBefore?.adminRoles).toBeUndefined();

    runPendingMigrations(db);

    const adminAfter = db.users.find((u) => u.id === 'u_admin');
    expect(adminAfter?.adminRoles).toEqual(['super']);
  });

  it('migrator 9 (P6) — resets Platform.verified to false + drops profileCompletion', () => {
    const db = makePreMigrationDb();
    // Pre-migration: every channel verified=true (per the seed at top).
    expect(db.creators[0].platforms[0].verified).toBe(true);

    runPendingMigrations(db);

    // Reset to false — creator has to re-verify via the OAuth flow.
    expect(db.creators[0].platforms[0].verified).toBe(false);

    // profileCompletion field deleted (was 75 before).
    expect(db.creators[0].profileCompletion).toBeUndefined();
  });

  it('idempotent — running the chain twice produces the same result as once', () => {
    const dbOnce = makePreMigrationDb();
    const dbTwice = makePreMigrationDb();

    runPendingMigrations(dbOnce);
    runPendingMigrations(dbTwice);
    runPendingMigrations(dbTwice); // second pass should be a no-op

    // Snapshot key fields that the migrators wrote.
    expect(dbTwice.migrationVersion).toBe(dbOnce.migrationVersion);
    expect(dbTwice.collaborations.length).toBe(dbOnce.collaborations.length);
    expect(dbTwice.deliverables.length).toBe(dbOnce.deliverables.length);
    expect(dbTwice.contracts.length).toBe(dbOnce.contracts.length);
    expect(dbTwice.offers[0].rounds.length).toBe(dbOnce.offers[0].rounds.length);
    expect(dbTwice.disputes[0].raisedByUserId).toBe(dbOnce.disputes[0].raisedByUserId);
    expect(dbTwice.disputes[0].collaborationId).toBe(dbOnce.disputes[0].collaborationId);
  });

  it('starting from a partially-migrated v5 store walks only the remaining migrators', () => {
    const db = makePreMigrationDb();
    // Pretend the store is already at v5 (post-Contract-reshape). The
    // chain should run only migrators 6 → 9.
    db.migrationVersion = 5;
    // Pre-populate the post-v5 fields the test scenarios above set:
    db.collaborations.push({
      id: 'col_x', campaignId: 'cmp_1', creatorId: 'cr_1', brandId: 'br_1',
      stage: 'submitted', createdAt: 1745000000000, updatedAt: 1745000000000,
      agreedRate: 1500, acceptedOfferId: 'off_1', contractId: null,
      cancelledAt: null, cancellationReason: null, history: [],
    });

    runPendingMigrations(db);

    // Migrator 6 ran (offer.rounds[] now populated).
    expect(db.offers[0].rounds.length).toBeGreaterThan(0);
    // Migrator 8 ran (admin user has adminRoles).
    expect(db.users.find((u) => u.id === 'u_admin')?.adminRoles).toEqual(['super']);
    // Migrator 9 ran (platform.verified = false).
    expect(db.creators[0].platforms[0].verified).toBe(false);

    expect(db.migrationVersion).toBe(9);
  });
});
