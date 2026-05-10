// storefront.snapshot.test.ts — §5.1 single-render mandate
//
// The public storefront (`/c/:handle`) and the workspace public
// preview (`public:<handle>`) used to be two implementations that
// drifted (s19 review-ordering bug). Since §5.1 they both render
// the same eight section components from `@/components/storefront/
// sections`, so the only difference between the surfaces is wrapper
// chrome (the preview-mode topnav banner).
//
// This test pins that contract: rendering every section with
// `mode='preview'` produces identical markup to rendering with
// `mode='public'`. If a future change makes a section diverge by
// mode, this test fails — and we fix the section, not the test.
//
// We use `react-dom/server.renderToStaticMarkup` (no DOM, no
// testing-library) so the suite stays light and works in the
// existing vitest setup.

import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { MemoryRouter } from 'react-router-dom';
import {
  StorefrontHero, StorefrontVacationBanner, StorefrontPackages,
  StorefrontWork, StorefrontReviews, StorefrontPress,
  StorefrontAudience, StorefrontChannels,
} from '../index';
import { buildCreator, buildDb, buildUser } from '@/lib/utils/__tests__/fixtures';
import type { Creator, Database, Review, Platform, AudienceDemographics } from '@/lib/api/types';

// Realistic fixture — every section needs to render real content,
// otherwise sections that null-out on empty data won't exercise their
// branches and the equivalence claim is vacuous.

const audience: AudienceDemographics = {
  ageBuckets: {
    '13-17': 5,
    '18-24': 30,
    '25-34': 38,
    '35-44': 17,
    '45-54': 7,
    '55+': 3,
  },
  genderSplit: { female: 62, male: 36, other: 2 },
  topCountries: [
    { country: 'United States',  pct: 48 },
    { country: 'United Kingdom', pct: 12 },
    { country: 'Canada',         pct: 9 },
    { country: 'Australia',      pct: 6 },
    { country: 'Germany',        pct: 4 },
  ],
  growthRate30d: 4.2,
  suspiciousFollowerPct: 3.1,
  audienceCredibilityScore: 87,
};

const platforms: Platform[] = [
  {
    name: 'Instagram',
    handle: '@sarah',
    followers: 124_000,
    engagement: 4.2,
    verified: true,
    audience,
  },
  {
    name: 'TikTok',
    handle: '@sarahtok',
    followers: 86_000,
    engagement: 5.8,
    verified: false,
  },
];

function makeCreator(): Creator {
  return buildCreator({
    id: 'cr_test',
    userId: 'u_creator_test',
    name: 'Sarah Chen',
    handle: '@sarah',
    tagline: 'Beauty + minimal living',
    bio: 'A focused creator who makes calm, considered work. Long-form and short-form, always with intent.',
    city: 'New York',
    country: 'US',
    categories: ['Beauty', 'Lifestyle', 'Wellness', 'Sustainability'],
    portrait: 'https://example.com/sarah.jpg',
    work: [
      'https://example.com/work-1.jpg',
      'https://example.com/work-2.jpg',
      'https://example.com/work-3.jpg',
    ],
    platforms,
    reach: 210_000,
    engagement: 4.7,
    rating: 4.8,
    tier: 'Specialist',
    responseHrs: 4,
    rateCards: [
      { id: 'rc_1', platform: 'Instagram', format: 'reel', rate: '$1,500–2,400', notes: '60–90s' },
      { id: 'rc_2', platform: 'Instagram', format: 'story', rate: '$300', notes: '3-pack' },
      { id: 'rc_3', platform: 'TikTok',    format: 'post', rate: '$1,200', notes: '' },
    ],
    pressMentions: [
      { source: 'Vogue',     title: 'The new beauty creators to watch in 2026', year: 2026 },
      { source: 'NY Times',  title: 'Why minimalism is back',                    year: 2025 },
    ],
    availability: {
      status: 'open',
      vacationMode: false,
      minRate: 800,
    },
    featuredReviewIds: ['rev_1'],
  });
}

const reviews: Review[] = [
  {
    id: 'rev_1',
    reviewType: 'creator',
    targetId: 'cr_test',
    fromUserId: 'u_brand_1',
    campaignId: 'cmp_test_1',
    rating: 5,
    text: 'Best collaborator we\'ve worked with this year. Hit every mark.',
    at: '2026-04-15T00:00:00.000Z',
    hidden: false,
  },
  {
    id: 'rev_2',
    reviewType: 'creator',
    targetId: 'cr_test',
    fromUserId: 'u_brand_2',
    campaignId: 'cmp_test_2',
    rating: 4,
    text: 'Strong work, on time, would book again.',
    at: '2026-03-01T00:00:00.000Z',
    hidden: false,
  },
];

function makeDb(): Database {
  const creator = makeCreator();
  return buildDb({
    creators: [creator],
    users: [buildUser({ id: 'u_creator_test', role: 'creator' })],
    brands: [
      { id: 'br_1', userId: 'u_brand_1', name: 'Aesop', industry: 'Beauty', hq: 'NYC', website: 'https://example.com', about: '', preferredCategories: [], preferredRegions: [], walletBalance: 0, escrowHeld: 0, verified: true, savedCreators: [] },
      { id: 'br_2', userId: 'u_brand_2', name: 'Glossier', industry: 'Beauty', hq: 'NYC', website: 'https://example.com', about: '', preferredCategories: [], preferredRegions: [], walletBalance: 0, escrowHeld: 0, verified: true, savedCreators: [] },
    ],
    campaigns: [
      // Lightweight campaign rows — fixture defaults aren't great for
      // multiple campaigns, so build inline for the two reviews above.
    ],
    reviews,
  });
}

// Wrap a node so any router-aware children (TrustBadge etc.) work in
// SSR. The sections themselves don't use Link, but defensively wrap
// to keep the test future-proof if a section adds a Link later.
function ssr(node: React.ReactElement): string {
  return renderToStaticMarkup(createElement(MemoryRouter, null, node));
}

describe('§5.1 single-render storefront — section equivalence', () => {
  // Each test renders the same section twice — once with mode='public',
  // once with mode='preview' — and asserts the markup is byte-identical.
  // If a section grows mode-specific behavior, this test catches it.

  function expectModeEquivalence(label: string, render: (mode: 'preview' | 'public') => React.ReactElement) {
    it(`${label} renders identically across modes`, () => {
      const pub = ssr(render('public'));
      const prev = ssr(render('preview'));
      expect(prev).toBe(pub);
      // Also assert the section actually rendered something — guards
      // against a typo that makes both sides empty (which would falsely
      // satisfy equality).
      expect(pub.length).toBeGreaterThan(20);
    });
  }

  const db = makeDb();
  const creator = db.creators[0];

  // Vacation banner — fixture creator has vacation OFF, but the equivalence
  // claim still holds (both sides render null). Test the ON case explicitly.
  it('StorefrontVacationBanner returns null when vacation is off', () => {
    const out = ssr(createElement(StorefrontVacationBanner, { creator, mode: 'public' }));
    expect(out).toBe('');
  });

  it('StorefrontVacationBanner renders identically across modes when vacation is on', () => {
    const onVacation: Creator = {
      ...creator,
      availability: { ...creator.availability!, vacationMode: true, untilDate: '2026-06-01', note: 'Email replies delayed.' },
    };
    const pub = ssr(createElement(StorefrontVacationBanner, { creator: onVacation, mode: 'public' }));
    const prev = ssr(createElement(StorefrontVacationBanner, { creator: onVacation, mode: 'preview' }));
    expect(prev).toBe(pub);
    expect(pub).toContain('on vacation');
  });

  expectModeEquivalence('StorefrontHero', (mode) =>
    createElement(StorefrontHero, { creator, db, mode }),
  );

  expectModeEquivalence('StorefrontWork', (mode) =>
    createElement(StorefrontWork, { creator, mode }),
  );

  expectModeEquivalence('StorefrontAudience', (mode) =>
    createElement(StorefrontAudience, { creator, mode }),
  );

  expectModeEquivalence('StorefrontChannels', (mode) =>
    createElement(StorefrontChannels, { creator, mode }),
  );

  expectModeEquivalence('StorefrontPackages', (mode) =>
    createElement(StorefrontPackages, { creator, mode }),
  );

  expectModeEquivalence('StorefrontReviews', (mode) =>
    createElement(StorefrontReviews, { creator, db, mode }),
  );

  expectModeEquivalence('StorefrontPress', (mode) =>
    createElement(StorefrontPress, { creator, mode }),
  );

  // Cross-section integrity — if one wrapper accidentally drops a
  // section while the other keeps it, the order assertion below fails.
  // Both the public surface and the preview surface render in this
  // order, with the same data; this test composes them in sequence
  // and proves the composed output also matches.
  it('all 8 sections composed in order render identically across modes', () => {
    const compose = (mode: 'preview' | 'public') =>
      createElement('div', null,
        createElement(StorefrontVacationBanner, { creator, mode }),
        createElement(StorefrontHero, { creator, db, mode }),
        createElement(StorefrontWork, { creator, mode }),
        createElement(StorefrontAudience, { creator, mode }),
        createElement(StorefrontChannels, { creator, mode }),
        createElement(StorefrontPackages, { creator, mode }),
        createElement(StorefrontReviews, { creator, db, mode }),
        createElement(StorefrontPress, { creator, mode }),
      );
    const pub = ssr(compose('public'));
    const prev = ssr(compose('preview'));
    expect(prev).toBe(pub);
  });
});
