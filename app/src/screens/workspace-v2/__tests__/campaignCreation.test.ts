// campaignCreation.test.ts — the wizard keeps what the brand entered.
//
// Three defects this pins:
//   1. "Save as draft" wrote nothing. The handler was a toast reading
//      "Draft saved · pick it up from Campaigns" plus a navigation, over
//      component-local state. A brand could author a full brief, get a
//      green confirmation naming where to find it, and lose all of it.
//   2. The Review & launch step confirmed objective / gender / age /
//      categories, and `v2LaunchCampaign` read `categories[0]` and dropped
//      the other three — `Campaign` had nowhere to put them.
//   3. `v2LaunchCampaign` fell back to the SEEDED DEMO BRAND when a
//      brand-role user had no `brandId`, so a real user's campaign could be
//      created under a shared demo identity and synced to production.

import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from '@/lib/api/store';
import { v2LaunchCampaign, v2SaveCampaignDraft } from '../v2CampaignActions';
import type { LaunchCampaignInput } from '../v2CampaignActions';
import { buildDb, buildBrand, buildCreator } from '@/lib/utils/__tests__/fixtures';
import type { User } from '@/lib/api/types';

function brandUser(over: Partial<User> = {}): User {
  return {
    id: 'u_brand', email: 'b@b.com', passwordHash: 'demo', role: 'brand',
    status: 'active', createdAt: '2026-04-01T00:00:00Z', brandId: 'br_1',
    teamRole: 'admin', ...over,
  };
}

/** A demo brand owned by the seeded demo user, alongside the real brand. */
function seed(users: User[] = [brandUser()]) {
  useStore.getState().setDB(buildDb({
    users: [
      ...users,
      { id: 'u_hannah', email: 'h@aesop.test', passwordHash: 'demo', role: 'brand',
        status: 'active', createdAt: '2026-01-01T00:00:00Z', brandId: 'br_demo', teamRole: 'admin' },
    ],
    brands: [
      buildBrand({ id: 'br_1', userId: 'u_brand', walletBalance: 50_000 }),
      buildBrand({ id: 'br_demo', userId: 'u_hannah', walletBalance: 50_000 }),
    ],
    creators: [buildCreator({ id: 'cr_1', userId: 'u_creator' })],
    campaigns: [],
  }));
  useStore.getState().setSession({ userId: 'u_brand', issuedAt: new Date().toISOString() });
}

const INPUT: LaunchCampaignInput = {
  name: 'Winter skincare',
  brief: 'Looking for honest routines, shot at home.',
  objective: 'conversion',
  placement: '1 Instagram Reel + 2 Instagram Story',
  placements: [
    { platform: 'instagram', format: 'reel', count: 1 },
    { platform: 'instagram', format: 'story', count: 2 },
  ],
  budget: 12_000,
  perCreator: 800,
  deadline: '2027-01-15',
  audienceCity: ['Karachi', 'Lahore'],
  audienceGender: 'female',
  audienceAge: ['25-34', '18-24'],
  categories: ['Beauty', 'Lifestyle', 'Wellness'],
  invitedCreators: [],
};

describe('v2SaveCampaignDraft', () => {
  beforeEach(() => seed());

  it('actually persists a draft', () => {
    const saved = v2SaveCampaignDraft(INPUT);
    const stored = useStore.getState().db.campaigns.find((c) => c.id === saved.id);
    expect(stored).toBeDefined();
    expect(stored!.stage).toBe('draft');
    expect(stored!.title).toBe('Winter skincare');
    expect(stored!.brief).toBe(INPUT.brief);
  });

  it('round-trips every field the wizard collected', () => {
    const saved = v2SaveCampaignDraft(INPUT);
    expect(saved.objective).toBe('conversion');
    expect(saved.audienceGender).toBe('female');
    expect(saved.audienceAge).toEqual(['25-34', '18-24']);
    expect(saved.categories).toEqual(['Beauty', 'Lifestyle', 'Wellness']);
    expect(saved.placements).toEqual(INPUT.placements);
    expect(saved.budget).toBe(12_000);
    expect(saved.deadline).toBe('2027-01-15');
  });

  it('updates in place rather than piling up copies', () => {
    const first = v2SaveCampaignDraft(INPUT);
    const second = v2SaveCampaignDraft({ ...INPUT, name: 'Winter skincare v2' }, first.id);
    expect(second.id).toBe(first.id);
    const drafts = useStore.getState().db.campaigns.filter((c) => c.stage === 'draft');
    expect(drafts).toHaveLength(1);
    expect(drafts[0].title).toBe('Winter skincare v2');
  });

  it('refuses to rewrite a campaign that already went live', () => {
    const live = v2LaunchCampaign(INPUT);
    expect(() => v2SaveCampaignDraft(INPUT, live.id)).toThrow(/already live/i);
  });

  it('saves without a name or a deadline — a draft is allowed to be partial', () => {
    const saved = v2SaveCampaignDraft({ ...INPUT, name: '', deadline: '' });
    expect(saved.title).toBe('Untitled campaign');
    expect(saved.stage).toBe('draft');
  });
});

describe('v2LaunchCampaign keeps the brand’s targeting', () => {
  beforeEach(() => seed());

  it('persists objective, gender, age and every category', () => {
    const camp = v2LaunchCampaign(INPUT);
    expect(camp.objective).toBe('conversion');
    expect(camp.audienceGender).toBe('female');
    expect(camp.audienceAge).toEqual(['25-34', '18-24']);
    expect(camp.categories).toEqual(['Beauty', 'Lifestyle', 'Wellness']);
    // `category` stays the primary single value every existing consumer reads.
    expect(camp.category).toBe('Beauty');
  });
});

describe('v2LaunchCampaign never attributes work to the demo brand', () => {
  it('throws instead of falling back when the user has no brandId', () => {
    seed([brandUser({ brandId: undefined })]);
    expect(() => v2LaunchCampaign(INPUT)).toThrow(/brand profile/i);
    // And nothing was written under the seeded demo brand.
    expect(useStore.getState().db.campaigns.filter((c) => c.brandId === 'br_demo')).toHaveLength(0);
  });

  it('throws for a draft save too', () => {
    seed([brandUser({ brandId: undefined })]);
    expect(() => v2SaveCampaignDraft(INPUT)).toThrow(/brand profile/i);
  });

  it('attributes to the acting brand when the row is intact', () => {
    seed();
    expect(v2LaunchCampaign(INPUT).brandId).toBe('br_1');
  });
});
