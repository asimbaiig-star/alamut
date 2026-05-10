// Perf bench for deriveDeal + collectTodayDeals (Phase 31).
//
// What we measure:
//   1. Single deriveDeal call against dbs of varying sizes — the hot
//      path inside Today's queue, the brand campaign roster, and the
//      single deal page.
//   2. End-to-end collectTodayDeals for a brand with N campaigns each
//      having M creators on them — the realistic worst-case for the
//      brand Today screen.
//
// The deal page redesign scales linearly with (artifacts on this
// pair) at the deriveDeal level, but with (artifacts × pairs) at the
// collectTodayDeals level. Phase 31 fixed the latter via a
// WeakMap-keyed indexed lookup.
//
// Usage: `npm run bench` (vitest bench mode).

import { bench, describe } from 'vitest';
import { deriveDeal } from '@/lib/api/use-deal';
import { collectTodayDeals } from '@/lib/utils/today-deals';
import {
  buildBrand,
  buildCampaign,
  buildCreator,
  buildUser,
  buildApplication,
  buildOffer,
  buildSubmission,
  buildDb,
} from '../__tests__/fixtures';
import type { Database } from '@/lib/api/types';

/** Build a Database with `numCampaigns` × `creatorsPerCampaign` deals. */
function buildScaledDb(numCampaigns: number, creatorsPerCampaign: number): Database {
  const brand = buildBrand({ id: 'br_1' });
  const campaigns = [];
  const creators = [];
  const users = [];
  const applications = [];
  const offers = [];
  const submissions = [];

  for (let c = 0; c < numCampaigns; c++) {
    const campaignId = `cmp_${c}`;
    campaigns.push(buildCampaign({
      id: campaignId,
      brandId: 'br_1',
      stage: 'live',
    }));
  }

  for (let r = 0; r < creatorsPerCampaign; r++) {
    const creatorId = `cr_${r}`;
    creators.push(buildCreator({ id: creatorId, userId: `u_cr_${r}` }));
    users.push(buildUser({ id: `u_cr_${r}`, creatorId, role: 'creator' }));
  }

  // Distribute artifacts across the (campaign × creator) grid so each
  // pair has a realistic mix.
  for (let c = 0; c < numCampaigns; c++) {
    for (let r = 0; r < creatorsPerCampaign; r++) {
      const campaignId = `cmp_${c}`;
      const creatorId = `cr_${r}`;
      const slot = (c + r) % 4;
      if (slot === 0) {
        applications.push(buildApplication({
          id: `app_${c}_${r}`, campaignId, creatorId, status: 'submitted',
        }));
      } else if (slot === 1) {
        offers.push(buildOffer({
          id: `off_${c}_${r}`, campaignId, creatorId, status: 'pending',
        }));
      } else if (slot === 2) {
        offers.push(buildOffer({
          id: `off_${c}_${r}`, campaignId, creatorId, status: 'accepted',
        }));
        submissions.push(buildSubmission({
          id: `sub_${c}_${r}`, campaignId, creatorId, status: 'in_review',
        }));
      } else {
        applications.push(buildApplication({
          id: `app_${c}_${r}`, campaignId, creatorId, status: 'shortlisted',
        }));
      }
    }
  }

  return buildDb({
    users: [...users, buildUser({ id: 'u_brand_1', brandId: 'br_1', role: 'brand' })],
    brands: [{ ...brand, userId: 'u_brand_1' }],
    creators,
    campaigns,
    applications,
    offers,
    submissions,
  });
}

const SMALL = buildScaledDb(10, 20);    // 200 pairs
const MEDIUM = buildScaledDb(50, 50);   // 2,500 pairs
const LARGE = buildScaledDb(100, 100);  // 10,000 pairs

describe('deriveDeal — single call', () => {
  bench('small db (200 pairs)', () => {
    deriveDeal({ db: SMALL, campaignId: 'cmp_5', creatorId: 'cr_10', role: 'brand' });
  });

  bench('medium db (2,500 pairs)', () => {
    deriveDeal({ db: MEDIUM, campaignId: 'cmp_25', creatorId: 'cr_25', role: 'brand' });
  });

  bench('large db (10,000 pairs)', () => {
    deriveDeal({ db: LARGE, campaignId: 'cmp_50', creatorId: 'cr_50', role: 'brand' });
  });
});

describe('collectTodayDeals — brand role', () => {
  bench('small db (200 pairs)', () => {
    collectTodayDeals({ db: SMALL, role: 'brand', brandId: 'br_1', viewerUserId: 'u_brand_1' });
  });

  bench('medium db (2,500 pairs)', () => {
    collectTodayDeals({ db: MEDIUM, role: 'brand', brandId: 'br_1', viewerUserId: 'u_brand_1' });
  });

  bench('large db (10,000 pairs)', () => {
    collectTodayDeals({ db: LARGE, role: 'brand', brandId: 'br_1', viewerUserId: 'u_brand_1' });
  });
});

describe('collectTodayDeals — creator role', () => {
  // A creator has ~N campaigns at most (vs brand's N×M); these are
  // small-sized intentionally to reflect realistic load.
  bench('creator with 10 deals', () => {
    collectTodayDeals({ db: SMALL, role: 'creator', creatorId: 'cr_5', viewerUserId: 'u_cr_5' });
  });

  bench('creator with 50 deals', () => {
    collectTodayDeals({ db: MEDIUM, role: 'creator', creatorId: 'cr_25', viewerUserId: 'u_cr_25' });
  });
});
