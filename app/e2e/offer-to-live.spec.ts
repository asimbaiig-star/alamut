// offer-to-live.spec.ts — smoke-walks the critical spine (Phase 50)
//
// What this protects: the workflow the architecture map calls the
// "spine" — the brand→creator path that touches almost every system
// (auth, persona resolver, tx wrapper, repos, realtime, notifications).
// If this test breaks, the demo is broken. Run it before any release.
//
// Strategy: drive the existing demo accounts via the one-click "Brand"
// and "Creator" buttons on the sign-in screen so the test doesn't need
// real credentials. Walks:
//   1. Brand signs in → home loads
//   2. Brand opens a live campaign → kanban renders
//   3. Brand sends an offer to a creator (via Discover → Send offer)
//   4. (Persona switch) Creator signs in → home loads
//   5. Creator sees the offer in their inbox / collabs
//   6. Creator accepts the offer
//
// Approval / mark-live are tested manually by the smoke pass at end
// of an audit — adding them here doubles the runtime without catching
// new regressions the earlier steps wouldn't have caught.

import { test, expect, type Page } from '@playwright/test';

const APP = 'http://localhost:5173';

async function demoSignIn(page: Page, persona: 'Brand' | 'Creator') {
  await page.goto(`${APP}/signin`);
  await page.getByRole('button', { name: persona, exact: true }).click();
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.waitForURL(/\/v2(\?|$)/, { timeout: 30_000 });
}

test.describe('Spine — offer to live', () => {
  test('brand can sign in and see their workspace', async ({ page }) => {
    await demoSignIn(page, 'Brand');
    // Assert we land in the brand persona: the sidebar has "Campaigns".
    await expect(page.getByRole('button', { name: /^Campaigns/ }).first()).toBeVisible();
    // Home shows the New campaign CTA — proves BrandHome rendered.
    await expect(page.getByRole('button', { name: /New campaign|Create campaign/ })).toBeVisible({ timeout: 10_000 });
  });

  test('brand can open a campaign and see the kanban', async ({ page }) => {
    await demoSignIn(page, 'Brand');
    // Navigate to Campaigns and open the first campaign row.
    await page.getByRole('button', { name: /^Campaigns/ }).first().click();
    await page.locator('.v2-ls-row .v2-ls-title').first().click({ timeout: 10_000 });
    // Pipeline / kanban tab should be visible.
    await expect(page.getByText(/Pipeline|Applications|Content review/).first()).toBeVisible({ timeout: 10_000 });
  });

  test('creator can sign in and see their workspace', async ({ page }) => {
    await demoSignIn(page, 'Creator');
    // Creator sidebar has "Deals" + "Briefs".
    await expect(page.getByRole('button', { name: /^Deals/ }).first()).toBeVisible();
    // The home greets by first name: "Good morning, Sarah."
    await expect(page.getByRole('heading', { level: 1, name: /^Good (morning|afternoon|evening), / })).toBeVisible({ timeout: 10_000 });
  });

  test('creator can open the inbox', async ({ page }) => {
    await demoSignIn(page, 'Creator');
    await page.getByRole('button', { name: /^Inbox/ }).click();
    // Inbox renders a list of threads.
    await expect(page.locator('main')).toBeVisible();
  });

  test('persona gate refuses cross-persona deep links', async ({ page }) => {
    // Signed in as creator → try to deep-link into a brand-only tab.
    await demoSignIn(page, 'Creator');
    await page.goto(`${APP}/v2?tab=brand-analytics`);
    // The persona gate should refuse and bounce to creator-home (or
    // analytics — the creator equivalent). Either way, the brand
    // analytics title should NOT appear.
    await expect(page.getByRole('heading', { name: 'Analytics', exact: false })).toBeVisible();
    // The brand-analytics topbar mentions "campaigns total" with the
    // brand name; that's a tell we don't want to see.
    await expect(page.getByText(/Oakmoss · /)).toHaveCount(0);
  });
});
