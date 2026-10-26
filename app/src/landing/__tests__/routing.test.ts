// routing.test.ts — the host serves the landing pages and the SPA from
// different HTML files. Get the rewrite wrong and either every app URL
// renders the creators landing (catch-all → /index.html, the old rule) or
// /for-brands renders the SPA, which hands it straight back (LandingRedirect).

import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const APP = join(__dirname, '..', '..', '..');
const vercel = JSON.parse(readFileSync(join(APP, 'vercel.json'), 'utf8')) as {
  rewrites: { source: string; destination: string }[];
};

describe('vercel.json routes pages to the right HTML file', () => {
  it('sends every unknown path to the SPA shell, never to a landing page', () => {
    const last = vercel.rewrites[vercel.rewrites.length - 1]!;
    expect(last).toEqual({ source: '/(.*)', destination: '/app.html' });
    expect(vercel.rewrites.some((r) => r.destination === '/index.html')).toBe(false);
  });

  it('serves /for-brands its own page, before the catch-all can claim it', () => {
    for (const source of ['/for-brands', '/for-brands/']) {
      const i = vercel.rewrites.findIndex((r) => r.source === source);
      expect(i, source).toBeGreaterThanOrEqual(0);
      expect(vercel.rewrites[i]!.destination).toBe('/for-brands/index.html');
      expect(i).toBeLessThan(vercel.rewrites.length - 1);
    }
  });

  it('every destination is an HTML file the build emits', () => {
    // Each is a Vite input: app.html (vite.config.ts), the two landing pages
    // (vite.landing.config.ts).
    for (const r of vercel.rewrites) {
      expect(existsSync(join(APP, r.destination)), r.destination).toBe(true);
    }
  });

  it('the dev and preview servers mirror it', () => {
    const vite = readFileSync(join(APP, 'vite.config.ts'), 'utf8');
    expect(vite).toMatch(/req\.url = `\/for-brands\/index\.html\$\{qs\}`/);
    expect(vite).toMatch(/req\.url = `\/app\.html\$\{qs\}`/);
  });
});
