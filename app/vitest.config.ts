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
    // The suite must never reach a real Supabase project. Vite loads
    // `.env.local` in test mode too, so without this every test ran with
    // `isSupabaseConfigured() === true` against PRODUCTION: each jsdom
    // file hydrated the store from it on import, and any test reaching a
    // repository issued real requests. All of them anonymous — no test
    // signs in, and RLS refuses every anon write — so nothing was ever
    // mutated, but a test result must not depend on a live database, and
    // one sign-in test would have made them authenticated writes. Tests
    // that need Supabase behaviour mock '@/lib/supabase' explicitly.
    env: {
      VITE_SUPABASE_URL: '',
      VITE_SUPABASE_ANON_KEY: '',
    },
    globals: false,
    pool: 'threads',
  },
});
