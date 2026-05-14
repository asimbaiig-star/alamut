// playwright.config.ts — e2e config for the offer→live spine.
//
// One project (chromium) is enough for the prototype. The webServer
// block reuses `npm run dev` (Vite) so the same dev server the human
// uses is what Playwright drives.
//
// Tests live in app/e2e/ — they navigate the demo (brand vs creator
// persona) and walk a campaign from creation to live.

import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: process.env.CI ? 'github' : 'list',
  timeout: 60_000,
  expect: { timeout: 8_000 },
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    actionTimeout: 8_000,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'npm run dev -- --port 5173',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
