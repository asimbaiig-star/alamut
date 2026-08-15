// availability.test.ts — a field that names a behaviour must perform it.
//
// `autoDeclineCategories` declined nothing. `vacationMode` stopped nothing.
// Both had type comments admitting it ("auto-decline is advisory in the
// demo"), which makes this a naming failure as much as a missing feature: the
// creator was told they were protected and they were not.
//
// The split under test — two of the three enforce, one advises — is a
// deliberate product line, not an accident, so it is pinned here.

import { describe, it, expect, beforeEach } from 'vitest';
import { availabilityVerdict, availabilityBlock } from '../availability';
import { v2SendOffer } from '@/screens/workspace-v2/v2CampaignActions';
import { v2InviteCreator } from '@/screens/workspace-v2/v2CollabActions';
import { useStore } from '../store';
import {
  buildDb, buildCampaign, buildCreator, buildBrand,
} from '@/lib/utils/__tests__/fixtures';
import type { User, Availability } from '../types';

const creatorNamed = (availability?: Availability) => ({
  name: 'Yuki Tanaka',
  availability,
});

describe('standing instructions BLOCK', () => {
  it('refuses a category the creator auto-declines', () => {
    const v = availabilityVerdict(
      creatorNamed({ status: 'open', autoDeclineCategories: ['Gambling'] }),
      { category: 'Gambling' },
    );
    expect(v.block).toContain('Gambling');
  });

  it('matches the category case-insensitively', () => {
    // 'gambling' vs 'Gambling' must not be the difference between protected
    // and not.
    const v = availabilityVerdict(
      creatorNamed({ status: 'open', autoDeclineCategories: ['Gambling'] }),
      { category: 'gambling' },
    );
    expect(v.block).toBeTruthy();
  });

  it('allows categories they did not exclude', () => {
    const v = availabilityVerdict(
      creatorNamed({ status: 'open', autoDeclineCategories: ['Gambling'] }),
      { category: 'Beauty' },
    );
    expect(v.block).toBeNull();
  });

  it('refuses while vacation mode is on, and says when they are back', () => {
    const v = availabilityVerdict(
      creatorNamed({ status: 'open', vacationMode: true, untilDate: '2026-09-01' }),
    );
    expect(v.block).toMatch(/away/i);
    // A date-only string must render as THAT day. `new Date('2026-09-01')`
    // parses as UTC midnight, so a naive toLocaleDateString shows "Aug 31"
    // anywhere west of UTC — an off-by-one on "when am I back".
    expect(v.block).toMatch(/Sep 1/);
  });
});

describe('judgement calls only WARN', () => {
  it('warns below the floor but does not block — a floor is a negotiating position', () => {
    const v = availabilityVerdict(
      creatorNamed({ status: 'open', minRate: 2000 }),
      { rate: 1200 },
    );
    expect(v.block).toBeNull();
    expect(v.warn).toContain('2,000');
  });

  it('says nothing when the rate clears the floor', () => {
    const v = availabilityVerdict(creatorNamed({ status: 'open', minRate: 2000 }), { rate: 2500 });
    expect(v.warn).toBeNull();
  });

  it('warns on booked without blocking — booked now is not uninterested later', () => {
    const v = availabilityVerdict(creatorNamed({ status: 'booked' }));
    expect(v.block).toBeNull();
    expect(v.warn).toMatch(/booked/i);
  });

  it('is silent for a creator who set nothing', () => {
    expect(availabilityVerdict(creatorNamed(undefined))).toEqual({ block: null, warn: null });
    expect(availabilityBlock(null)).toBeNull();
  });
});

describe('enforced at the mutation, not just in a screen', () => {
  const userBrand: User = {
    id: 'u_brand', email: 'b@b.com', passwordHash: 'demo', role: 'brand',
    status: 'active', createdAt: '2026-01-01T00:00:00Z', brandId: 'br_1', teamRole: 'admin',
  };

  function seed(availability: Availability) {
    useStore.getState().setDB(buildDb({
      users: [userBrand],
      creators: [buildCreator({ id: 'cr_1', userId: 'u_creator', availability })],
      brands: [buildBrand({ id: 'br_1', userId: 'u_brand', walletBalance: 50_000 })],
      campaigns: [buildCampaign({ id: 'cmp_1', brandId: 'br_1', stage: 'live', category: 'Gambling' })],
    }));
    useStore.getState().setSession({ userId: 'u_brand', issuedAt: new Date().toISOString() });
  }

  beforeEach(() => seed({ status: 'open', autoDeclineCategories: ['Gambling'] }));

  it('v2SendOffer refuses an excluded category', () => {
    // The whole point: it holds for EVERY caller, not for whichever screen
    // remembered to check.
    expect(() => v2SendOffer('cmp_1', 'cr_1', 1500, 'hi')).toThrow(/Gambling/);
  });

  it('v2InviteCreator refuses it too — a cold invite is still a brief', () => {
    expect(() => v2InviteCreator('cmp_1', 'cr_1', 'come work with us', 'u_brand')).toThrow(/Gambling/);
  });

  it('v2SendOffer refuses while the creator is away', () => {
    seed({ status: 'open', vacationMode: true });
    expect(() => v2SendOffer('cmp_1', 'cr_1', 1500, 'hi')).toThrow(/away/i);
  });

  it('a below-floor offer still sends — advisory means advisory', () => {
    seed({ status: 'open', minRate: 5000 });
    const offer = v2SendOffer('cmp_1', 'cr_1', 1000, 'opening number');
    expect(offer.rate).toBe(1000);
  });
});
