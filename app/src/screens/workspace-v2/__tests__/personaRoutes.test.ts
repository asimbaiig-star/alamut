// personaRoutes.test.ts — a route literal can't send a user into the other
// persona's workspace.
//
// The bug this exists to prevent: `CreatorHome` called `onRoute('wallet')`.
// 'wallet' is BRAND_ONLY, and `go()` silently flips persona for brand
// routes, so tapping a tier badge on the creator's own home screen switched
// the user to the brand persona and rendered BrandWallet — someone else's
// top-ups, escrow and ledger. Nothing failed; it just quietly happened.
//
// Two guards here:
//   1. `personaForRoute` is the single classifier (the guard and the
//      navigator both read it, and it understands query strings).
//   2. A static sweep of the source: no persona-scoped screen may name a
//      route owned by the other side.

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  personaForRoute, routeFitsPersona, routeBase,
  CREATOR_ONLY_ROUTES, BRAND_ONLY_ROUTES,
} from '../Workspace';

describe('personaForRoute', () => {
  it('classifies each side’s top-level routes', () => {
    for (const r of CREATOR_ONLY_ROUTES) expect(personaForRoute(r)).toBe('creator');
    for (const r of BRAND_ONLY_ROUTES) expect(personaForRoute(r)).toBe('brand');
  });

  it('treats drilldown prefixes as shared so they never flip persona', () => {
    for (const r of ['creator:cr_1', 'campaign:cmp_1', 'deal:d1', 'collab:col_1', 'brief:cmp_1', 'public:@sarah']) {
      expect(personaForRoute(r)).toBe('shared');
      expect(routeFitsPersona(r, 'creator')).toBe(true);
      expect(routeFitsPersona(r, 'brand')).toBe(true);
    }
  });

  it('sees through a query string', () => {
    // RouteOutlet parses these with `startsWith`, but the persona logic
    // compared with `===` — so `kyc?action=next-step` matched no rule and
    // skipped persona handling entirely.
    expect(routeBase('kyc?action=next-step')).toBe('kyc');
    expect(personaForRoute('kyc?action=next-step')).toBe('creator');
    expect(personaForRoute('wallet?action=topup')).toBe('brand');
    expect(personaForRoute('spark?prompt=hello%20world')).toBe('brand');
    expect(personaForRoute('campaign-new?from=spark')).toBe('brand');
  });

  it('blocks a mismatched persona from a scoped route', () => {
    expect(routeFitsPersona('wallet', 'creator')).toBe(false);
    expect(routeFitsPersona('creator-wallet', 'brand')).toBe(false);
    expect(routeFitsPersona('kyc?action=next-step', 'brand')).toBe(false);
  });

  it('lets unknown routes through rather than trapping the user', () => {
    expect(personaForRoute('some-future-route')).toBe('shared');
  });

  it('has no route claimed by both sides', () => {
    for (const r of CREATOR_ONLY_ROUTES) expect(BRAND_ONLY_ROUTES.has(r)).toBe(false);
  });
});

// ---------------------------------------------------------------------
// Static sweep
// ---------------------------------------------------------------------

const SCREENS = join(__dirname, '..', 'screens');

/** Screens only ever rendered under one persona. Shared surfaces (Inbox,
 *  Calendar, CollabDetail, BriefDetail, PublicStorefront, CreatorProfile)
 *  are deliberately absent — they serve both sides and must branch at
 *  runtime instead, which the sweep can't judge. */
const CREATOR_SCREENS = [
  'CreatorHome.tsx', 'Storefront.tsx', 'MyCollabs.tsx', 'BrowseBriefs.tsx',
  'CreatorWallet.tsx', 'KycTax.tsx', 'Analytics.tsx', 'CreatorOnboardingV2.tsx',
];
const BRAND_SCREENS = [
  'BrandHome.tsx', 'Spark.tsx', 'Discover.tsx', 'Campaigns.tsx',
  'CampaignDetail.tsx', 'BrandWallet.tsx', 'BrandProfile.tsx',
  'BrandAnalytics.tsx', 'NewCampaignWizard.tsx', 'BrandOnboardingV2.tsx',
];

/** Every `onRoute('literal')` / `onRoute("literal")` in a file. Template
 *  literals (`creator:${id}`) are drilldowns and always shared. */
function routeLiterals(file: string): string[] {
  const src = readFileSync(join(SCREENS, file), 'utf8');
  const out: string[] = [];
  const re = /onRoute\(\s*['"]([^'"]+)['"]\s*\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) out.push(m[1]);
  return out;
}

describe('static sweep — no screen routes into the other persona', () => {
  it('the screen lists still match the files on disk', () => {
    // Keeps the sweep honest if a screen is renamed or added: a stale entry
    // here would silently stop checking a real file.
    const onDisk = new Set(readdirSync(SCREENS).filter((f) => f.endsWith('.tsx')));
    for (const f of [...CREATOR_SCREENS, ...BRAND_SCREENS]) {
      expect(onDisk.has(f), `${f} is listed but not on disk`).toBe(true);
    }
  });

  it.each(CREATOR_SCREENS)('%s names no brand-only route', (file) => {
    const offenders = routeLiterals(file).filter((r) => personaForRoute(r) === 'brand');
    expect(offenders, `${file} routes to brand-only: ${offenders.join(', ')}`).toEqual([]);
  });

  it.each(BRAND_SCREENS)('%s names no creator-only route', (file) => {
    const offenders = routeLiterals(file).filter((r) => personaForRoute(r) === 'creator');
    expect(offenders, `${file} routes to creator-only: ${offenders.join(', ')}`).toEqual([]);
  });

  it('actually finds route literals (the regex still matches)', () => {
    // A sweep that silently matches nothing passes forever. Pin that it
    // sees real call sites.
    expect(routeLiterals('CreatorHome.tsx').length).toBeGreaterThan(3);
    expect(routeLiterals('BrandHome.tsx').length).toBeGreaterThan(3);
  });
});
