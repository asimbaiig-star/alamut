// Vitest config.
//
// Reuses the project's `vite.config.ts` plugin + alias setup so test
// imports of `@/lib/...` resolve identically to runtime imports.
//
// Test layout convention:
//   `__tests__/<basename>.test.ts`  — pure-function unit tests (node env)
//   `__tests__/<basename>.test.tsx` — RTL component tests (jsdom env)
// Bench files live in `__bench__/` so the `test` script doesn't pull
// them into the regular run.

import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    include: [
      'src/**/__tests__/**/*.test.ts',
      'src/**/__tests__/**/*.test.tsx',
    ],
    benchmark: {
      include: ['src/**/__bench__/**/*.bench.ts'],
    },
    // Pure-function tests run in node (no DOM globals needed).
    // Component tests opt into jsdom via the `.test.tsx` glob below,
    // and pull in `@testing-library/jest-dom` matchers via setup.
    environment: 'node',
    environmentMatchGlobs: [
      ['src/**/__tests__/**/*.test.tsx', 'jsdom'],
    ],
    setupFiles: ['./src/test-setup.ts'],
    globals: false,
    pool: 'threads',
  },
});
