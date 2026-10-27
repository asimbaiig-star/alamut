// landingDraft.test.ts — what a visitor builds on the landing reaches setup
// intact, and nothing else does: not an old draft, not a tampered one, and
// never over something the person already set in the app.

import { describe, it, expect } from 'vitest';
import {
  BRIEF_DRAFT_KEY, clearDraft, DRAFT_TTL_MS, onboardingFromDraft, readBriefDraft, readStorefrontDraft,
  saveDraft, STOREFRONT_DRAFT_KEY, wizardFromDraft, type StorefrontDraft,
} from '../landingDraft';
import { CREATOR_CATEGORIES, PLATFORM_FORMATS } from '../api/marketplaceOptions';

function memory() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => { m.set(k, v); },
    removeItem: (k: string) => { m.delete(k); },
    raw: m,
  };
}

const NOW = 1_800_000_000_000;
const storefront: StorefrontDraft = {
  name: 'Maya Chen', handle: 'maya.makes', niche: 'Beauty', rates: { reel: 900, story: 450, combo: 1250 }, savedAt: NOW,
};

describe('a kept storefront', () => {
  it('reads back what was saved', () => {
    const s = memory();
    saveDraft(s, STOREFRONT_DRAFT_KEY, storefront);
    expect(readStorefrontDraft(s, NOW + 1000)).toEqual(storefront);
  });

  it('is forgotten, and removed, once it is older than a week', () => {
    const s = memory();
    saveDraft(s, STOREFRONT_DRAFT_KEY, storefront);
    expect(readStorefrontDraft(s, NOW + DRAFT_TTL_MS + 1)).toBeNull();
    expect(s.raw.has(STOREFRONT_DRAFT_KEY)).toBe(false);
  });

  it('reads anything malformed as no draft', () => {
    const s = memory();
    s.setItem(STOREFRONT_DRAFT_KEY, '{not json');
    expect(readStorefrontDraft(s, NOW)).toBeNull();
    s.setItem(STOREFRONT_DRAFT_KEY, JSON.stringify({ ...storefront, rates: { reel: 'free', story: 1, combo: 1 } }));
    expect(readStorefrontDraft(s, NOW)).toBeNull();
    s.setItem(STOREFRONT_DRAFT_KEY, JSON.stringify({ ...storefront, savedAt: NOW + 60_000 }));
    expect(readStorefrontDraft(s, NOW), 'a draft from the future').toBeNull();
  });

  it('cleans a handle and bounds every field, whatever was written', () => {
    const s = memory();
    s.setItem(STOREFRONT_DRAFT_KEY, JSON.stringify({ ...storefront, handle: '<b>Maya Chen!</b>', name: 'x'.repeat(500), rates: { reel: 1e12, story: 2.6, combo: 0 } }));
    const d = readStorefrontDraft(s, NOW)!;
    expect(d.handle).toBe('bmayachenb');
    expect(d.name).toHaveLength(40);
    expect(d.rates).toEqual({ reel: 1_000_000, story: 3, combo: 0 });
  });

  it('survives storage that throws', () => {
    const broken = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('full'); }, removeItem: () => { throw new Error('blocked'); } };
    expect(() => saveDraft(broken, STOREFRONT_DRAFT_KEY, storefront)).not.toThrow();
    expect(readStorefrontDraft(broken, NOW)).toBeNull();
    expect(() => clearDraft(broken, STOREFRONT_DRAFT_KEY)).not.toThrow();
  });
});

describe('onboarding, filled from a kept storefront', () => {
  const o = { categories: CREATOR_CATEGORIES, fallback: { reel: '250', story: '180', post: '380' } };

  it('takes the handle, niche and rates over sign-up’s placeholders', () => {
    // What sign-up writes for a new creator: a handle from the name, no
    // categories, and '—' for every rate.
    const fresh = { handle: '@mayachen', category: undefined, reel: '—', story: '—', post: '—' };
    expect(onboardingFromDraft(fresh, storefront, o)).toEqual({
      handle: 'maya.makes', category: 'Beauty', reelRate: '900', storyRate: '450', comboRate: '1250',
    });
  });

  it('never overwrites a price or a category the creator already set', () => {
    const set = { handle: '@maya', category: 'Food', reel: '$700', story: '—', post: '$1,100' };
    const r = onboardingFromDraft(set, storefront, o);
    expect(r.category).toBe('Food');
    expect(r.reelRate).toBe('$700');
    expect(r.storyRate).toBe('450');
    expect(r.comboRate).toBe('$1,100');
  });

  it('changes nothing without a draft, and ignores a niche the app does not list', () => {
    const own = { handle: '@maya', category: undefined, reel: undefined, story: undefined, post: undefined };
    expect(onboardingFromDraft(own, null, o)).toEqual({ handle: 'maya', category: '', reelRate: '250', storyRate: '180', comboRate: '380' });
    expect(onboardingFromDraft(own, { ...storefront, niche: 'Crypto pumps' }, o).category).toBe('');
  });
});

describe('a posted brief', () => {
  it('reads back, and opens in the wizard as its name, placement and rate', () => {
    const s = memory();
    saveDraft(s, BRIEF_DRAFT_KEY, { title: 'Spring drop', platform: 'instagram', format: 'reel', count: 2, perCreator: 1500, savedAt: NOW });
    const w = wizardFromDraft(readBriefDraft(s, NOW), PLATFORM_FORMATS);
    expect(w).toEqual({ name: 'Spring drop', placements: [{ platform: 'instagram', format: 'reel', count: 2 }], perCreator: 1500 });
  });

  it('opens nothing for a platform or format the wizard does not offer', () => {
    const s = memory();
    saveDraft(s, BRIEF_DRAFT_KEY, { title: 'x', platform: 'instagram', format: 'hologram', count: 1, perCreator: 10, savedAt: NOW });
    expect(wizardFromDraft(readBriefDraft(s, NOW), PLATFORM_FORMATS)).toBeNull();
    s.setItem(BRIEF_DRAFT_KEY, JSON.stringify({ title: 'x', platform: '../../etc', format: 'reel', count: 1, perCreator: 10, savedAt: NOW }));
    expect(readBriefDraft(s, NOW)).toBeNull();
  });
});
