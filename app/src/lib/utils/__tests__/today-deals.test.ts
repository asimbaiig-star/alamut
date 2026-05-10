// Tests for collectTodayDeals — enumerates (campaign, creator) pairs
// per role and runs them through deriveDeal + rankDeals.

import { describe, it, expect, beforeEach } from 'vitest';
import { collectTodayDeals } from '@/lib/utils/today-deals';
import {
  buildBrand,
  buildCampaign,
  buildCreator,
  buildUser,
  buildApplication,
  buildOffer,
  buildSubmission,
  buildDispute,
  buildDb,
  resetIds,
} from './fixtures';

beforeEach(() => resetIds());

describe('collectTodayDeals — creator role', () => {
  it('returns empty when creatorId is missing', () => {
    const db = buildDb();
    const result = collectTodayDeals({ db, role: 'creator' });
    expect(result.actionable).toEqual([]);
    expect(result.passive).toEqual([]);
  });

  it('enumerates pairs from applications, offers, submissions', () => {
    const db = buildDb({
      campaigns: [
        buildCampaign({ id: 'cmp_a', brandId: 'br_1' }),
        buildCampaign({ id: 'cmp_b', brandId: 'br_1' }),
        buildCampaign({ id: 'cmp_c', brandId: 'br_1', stage: 'live' }),
      ],
      brands: [buildBrand({ id: 'br_1' })],
      creators: [buildCreator({ id: 'cr_1' })],
      applications: [buildApplication({ campaignId: 'cmp_a', creatorId: 'cr_1', status: 'submitted' })],
      offers: [buildOffer({ campaignId: 'cmp_b', creatorId: 'cr_1', status: 'pending' })],
      submissions: [buildSubmission({ campaignId: 'cmp_c', creatorId: 'cr_1', status: 'in_review' })],
    });
    const result = collectTodayDeals({ db, role: 'creator', creatorId: 'cr_1' });
    const ids = [...result.actionable, ...result.passive].map((d) => d.payload.id).sort();
    expect(ids).toEqual(['cmp_a--cr_1', 'cmp_b--cr_1', 'cmp_c--cr_1']);
  });

  it("includes campaigns where creator has a shortlisted application", () => {
    // P1a: shortlist is now derived from Application.status === 'shortlisted'
    // — there is no campaign.shortlist field anymore.
    const db = buildDb({
      campaigns: [buildCampaign({ id: 'cmp_a', brandId: 'br_1' })],
      brands: [buildBrand({ id: 'br_1' })],
      creators: [buildCreator({ id: 'cr_1' })],
      applications: [buildApplication({ campaignId: 'cmp_a', creatorId: 'cr_1', status: 'shortlisted' })],
    });
    const result = collectTodayDeals({ db, role: 'creator', creatorId: 'cr_1' });
    const ids = [...result.actionable, ...result.passive].map((d) => d.payload.id);
    expect(ids).toContain('cmp_a--cr_1');
  });

  it('deduplicates pairs across multiple artifact sources', () => {
    // Same pair appears in applications + offers + submissions; should
    // only produce one Deal in the output.
    const db = buildDb({
      campaigns: [buildCampaign({ id: 'cmp_a', brandId: 'br_1', stage: 'live' })],
      brands: [buildBrand({ id: 'br_1' })],
      creators: [buildCreator({ id: 'cr_1' })],
      applications: [buildApplication({ campaignId: 'cmp_a', creatorId: 'cr_1', status: 'shortlisted' })],
      offers: [buildOffer({ campaignId: 'cmp_a', creatorId: 'cr_1', status: 'accepted' })],
      submissions: [buildSubmission({ campaignId: 'cmp_a', creatorId: 'cr_1', status: 'in_review' })],
    });
    const result = collectTodayDeals({ db, role: 'creator', creatorId: 'cr_1' });
    const all = [...result.actionable, ...result.passive];
    expect(all.length).toBe(1);
  });

  it("doesn't include other creators' deals", () => {
    const db = buildDb({
      campaigns: [buildCampaign({ id: 'cmp_a', brandId: 'br_1' })],
      brands: [buildBrand({ id: 'br_1' })],
      creators: [buildCreator({ id: 'cr_1' }), buildCreator({ id: 'cr_2' })],
      applications: [
        buildApplication({ campaignId: 'cmp_a', creatorId: 'cr_1', status: 'submitted' }),
        buildApplication({ campaignId: 'cmp_a', creatorId: 'cr_2', status: 'submitted' }),
      ],
    });
    const result = collectTodayDeals({ db, role: 'creator', creatorId: 'cr_1' });
    const ids = [...result.actionable, ...result.passive].map((d) => d.payload.id);
    expect(ids).toContain('cmp_a--cr_1');
    expect(ids).not.toContain('cmp_a--cr_2');
  });
});

describe('collectTodayDeals — brand role', () => {
  it('returns empty when brandId is missing', () => {
    const db = buildDb();
    const result = collectTodayDeals({ db, role: 'brand' });
    expect(result.actionable).toEqual([]);
    expect(result.passive).toEqual([]);
  });

  it("enumerates every creator with any artifact on the brand's campaigns", () => {
    const db = buildDb({
      campaigns: [
        buildCampaign({ id: 'cmp_a', brandId: 'br_1' }),
        buildCampaign({ id: 'cmp_b', brandId: 'br_1' }),
        // Different brand - should NOT appear
        buildCampaign({ id: 'cmp_other', brandId: 'br_2' }),
      ],
      brands: [buildBrand({ id: 'br_1' }), buildBrand({ id: 'br_2' })],
      creators: [
        buildCreator({ id: 'cr_1' }),
        buildCreator({ id: 'cr_2' }),
        buildCreator({ id: 'cr_3' }),
      ],
      applications: [
        buildApplication({ campaignId: 'cmp_a', creatorId: 'cr_1', status: 'submitted' }),
        buildApplication({ campaignId: 'cmp_a', creatorId: 'cr_2', status: 'submitted' }),
      ],
      offers: [
        buildOffer({ campaignId: 'cmp_b', creatorId: 'cr_3', status: 'pending' }),
        buildOffer({ campaignId: 'cmp_other', creatorId: 'cr_1', status: 'pending' }), // wrong brand
      ],
    });
    const result = collectTodayDeals({ db, role: 'brand', brandId: 'br_1' });
    const ids = [...result.actionable, ...result.passive].map((d) => d.payload.id).sort();
    expect(ids).toEqual(['cmp_a--cr_1', 'cmp_a--cr_2', 'cmp_b--cr_3']);
  });

  it('includes shortlisted application + accepted offer creators', () => {
    // P1a: shortlist + acceptedCreators are derived from
    // Application.status / Offer.status. Test the new shape directly.
    const db = buildDb({
      campaigns: [buildCampaign({ id: 'cmp_a', brandId: 'br_1' })],
      brands: [buildBrand({ id: 'br_1' })],
      creators: [buildCreator({ id: 'cr_1' }), buildCreator({ id: 'cr_2' })],
      applications: [
        buildApplication({ campaignId: 'cmp_a', creatorId: 'cr_1', status: 'shortlisted' }),
      ],
      offers: [
        buildOffer({ campaignId: 'cmp_a', creatorId: 'cr_2', status: 'accepted' }),
      ],
    });
    const result = collectTodayDeals({ db, role: 'brand', brandId: 'br_1' });
    const ids = [...result.actionable, ...result.passive].map((d) => d.payload.id).sort();
    expect(ids).toEqual(['cmp_a--cr_1', 'cmp_a--cr_2']);
  });
});

describe('collectTodayDeals — ranking integration', () => {
  it('disputed deals rank into actionable for creator role (Phase 24 QA)', () => {
    const db = buildDb({
      campaigns: [buildCampaign({ id: 'cmp_a', brandId: 'br_1' })],
      brands: [buildBrand({ id: 'br_1' })],
      creators: [buildCreator({ id: 'cr_1' })],
      applications: [buildApplication({ campaignId: 'cmp_a', creatorId: 'cr_1' })],
      disputes: [buildDispute({ campaignId: 'cmp_a', status: 'open' })],
    });
    const result = collectTodayDeals({ db, role: 'creator', creatorId: 'cr_1' });
    expect(result.actionable.length).toBe(1);
    expect(result.actionable[0].state).toBe('disputed');
  });

  it('passive deals (in-review for creator) land in passive bucket', () => {
    const db = buildDb({
      campaigns: [buildCampaign({ id: 'cmp_a', brandId: 'br_1', stage: 'live' })],
      brands: [buildBrand({ id: 'br_1' })],
      creators: [buildCreator({ id: 'cr_1' })],
      offers: [buildOffer({ campaignId: 'cmp_a', creatorId: 'cr_1', status: 'accepted' })],
      submissions: [buildSubmission({ campaignId: 'cmp_a', creatorId: 'cr_1', status: 'in_review' })],
    });
    const result = collectTodayDeals({ db, role: 'creator', creatorId: 'cr_1' });
    expect(result.actionable).toEqual([]);
    expect(result.passive.length).toBe(1);
    expect(result.passive[0].state).toBe('in-review');
  });

  it('actionable list is sorted by urgency descending', () => {
    // Build two creator-side deals: one offer-pending (high urgency on
    // close-to-expiry) and one accepted-production (medium urgency).
    const db = buildDb({
      users: [buildUser({ id: 'u_creator', creatorId: 'cr_1', role: 'creator' })],
      campaigns: [
        buildCampaign({ id: 'cmp_offer', brandId: 'br_1' }),
        buildCampaign({ id: 'cmp_prod', brandId: 'br_1', stage: 'live', deadline: '2026-12-31' }),
      ],
      brands: [buildBrand({ id: 'br_1' })],
      creators: [buildCreator({ id: 'cr_1', userId: 'u_creator' })],
      offers: [
        buildOffer({
          campaignId: 'cmp_offer', creatorId: 'cr_1',
          status: 'pending', sentAt: '2026-04-09T12:00:00Z', // expiring soon
        }),
        buildOffer({
          campaignId: 'cmp_prod', creatorId: 'cr_1',
          status: 'accepted',
        }),
      ],
    });
    const result = collectTodayDeals({
      db, role: 'creator', creatorId: 'cr_1',
      now: new Date('2026-04-15T12:00:00Z'),
    });
    expect(result.actionable.length).toBeGreaterThanOrEqual(1);
    // The expiring offer should outrank the production deal
    const ids = result.actionable.map((d) => d.payload.id);
    expect(ids[0]).toBe('cmp_offer--cr_1');
  });
});
