// routeFitsPersona — pins the cross-user route-leak fix.
//
// Bug pre-fix: signing in as Hannah (brand) after Sarah (creator) had
// used the workspace would land on `creator-home` because localStorage
// still held that route from the previous session, and `getViewerUserId`
// fell through to the demo creator (Sarah) because the persona was also
// stale. WorkspaceV2 now rejects stored routes that don't match the
// authenticated persona, falling back to the persona's default home.
//
// These tests pin the route classification so a future addition (new
// route id, new prefix) has to consciously decide which persona side
// it belongs to.

import { describe, it, expect } from 'vitest';
import { routeFitsPersona } from '../Workspace';

describe('routeFitsPersona', () => {
  describe('creator-only routes', () => {
    it.each([
      'creator-home',
      'storefront',
      'creator-collabs',
      'creator-campaigns',
      'creator-inbox',
      'analytics',
      'creator-wallet',
      'kyc',
      'onboarding-creator',
    ])('%s is creator-only', (route) => {
      expect(routeFitsPersona(route, 'creator')).toBe(true);
      expect(routeFitsPersona(route, 'brand')).toBe(false);
    });
  });

  describe('brand-only routes', () => {
    it.each([
      'home',
      'spark',
      'discover',
      'campaigns',
      'inbox',
      'wallet',
      'campaign-new',
      'onboarding-brand',
    ])('%s is brand-only', (route) => {
      expect(routeFitsPersona(route, 'brand')).toBe(true);
      expect(routeFitsPersona(route, 'creator')).toBe(false);
    });
  });

  describe('drilldown prefixes', () => {
    it('creator: profile drilldowns are brand-only', () => {
      expect(routeFitsPersona('creator:cr_sarah', 'brand')).toBe(true);
      expect(routeFitsPersona('creator:cr_sarah', 'creator')).toBe(false);
    });

    it('campaign: drilldowns are brand-only', () => {
      expect(routeFitsPersona('campaign:cmp_1', 'brand')).toBe(true);
      expect(routeFitsPersona('campaign:cmp_1', 'creator')).toBe(false);
    });

    it('deal: drilldowns are brand-only', () => {
      // Deal routes resolve through Inbox post-§2.5 collapse, but the
      // entry-point is brand-side (the brand owns the campaign-creator
      // pair the deal page represents).
      expect(routeFitsPersona('deal:conv_1', 'brand')).toBe(true);
      expect(routeFitsPersona('deal:conv_1', 'creator')).toBe(false);
    });

    it('collab: drilldowns are creator-only', () => {
      expect(routeFitsPersona('collab:col_1', 'creator')).toBe(true);
      expect(routeFitsPersona('collab:col_1', 'brand')).toBe(false);
    });

    it('brief: drilldowns are creator-only', () => {
      expect(routeFitsPersona('brief:cmp_1', 'creator')).toBe(true);
      expect(routeFitsPersona('brief:cmp_1', 'brand')).toBe(false);
    });
  });

  describe('cross-persona routes', () => {
    it('public: storefront preview is valid for either persona', () => {
      expect(routeFitsPersona('public:sarah', 'brand')).toBe(true);
      expect(routeFitsPersona('public:sarah', 'creator')).toBe(true);
    });

    it('unknown routes fall through (permissive)', () => {
      // RouteOutlet's final fallback is BrandHome, so an unknown route
      // doesn't crash — it just lands somewhere safe. The helper stays
      // permissive for forward-compat with new routes.
      expect(routeFitsPersona('experimental-new-tab', 'brand')).toBe(true);
      expect(routeFitsPersona('experimental-new-tab', 'creator')).toBe(true);
    });
  });

  describe('regression — the Hannah/Sarah cross-user leak', () => {
    it('brand persona rejects creator-home (was the symptom)', () => {
      // Pre-fix: Hannah signs in, localStorage.route is creator-home
      // from Sarah's prior session, WorkspaceV2 boots into creator-home,
      // useV2CurrentCreator falls through to DEMO_CREATOR_USER_ID, the
      // brand user sees Sarah's dashboard. The helper now rejects this
      // case so the route initializer falls back to brand `home`.
      expect(routeFitsPersona('creator-home', 'brand')).toBe(false);
    });

    it('creator persona rejects brand home (the inverse)', () => {
      expect(routeFitsPersona('home', 'creator')).toBe(false);
    });

    it('creator persona rejects discover (brand-only top-level)', () => {
      expect(routeFitsPersona('discover', 'creator')).toBe(false);
    });
  });
});
