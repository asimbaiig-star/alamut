// Vitest config (Phase 31).
//
// Reuses the project's `vite.config.ts` plugin + alias setup so test
// imports of `@/lib/...` resolve identically to runtime imports.
//
// Test layout convention: `__tests__/<source-basename>.test.ts` colocated
// next to the file under test. Bench files live in `__bench__/` so the
// `test` script doesn't pull them into the regular run.

import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    include: ['src/**/__tests__/**/*.test.ts'],
    benchmark: {
      include: ['src/**/__bench__/**/*.bench.ts'],
    },
    // Pure-function test surface — no DOM, no browser globals needed.
    environment: 'node',
    globals: false,
    // Pin the clock-sensitive helpers in the redesign (deal-action's
    // urgency math reads "now" from a parameter, not Date.now()) — but
    // the underlying API client's pushNotification() does call
    // Date.now() / new Date(). Tests don't exercise the API client
    // directly, so leave clock alone.
    pool: 'threads',
  },
});
