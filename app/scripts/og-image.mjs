// og-image.mjs — renders the link-preview images the landing pages share:
//   public/og-creators.jpg  (index.html)   the moss card, the creator headline
//   public/og-brands.jpg    (for-brands)   the dark card, the brand headline
//   public/og-image.jpg     (app.html)     the creator image, for the app shell
//
// Drawn in the portal's own tokens (styles/v2-tokens.css, read here) and
// typefaces, so a shared link looks like the page it opens. Re-run after
// changing a headline:  node scripts/og-image.mjs
// Uses the Chrome installed on the machine (playwright-core, channel
// "chrome"), so it downloads no browser.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { chromium } from 'playwright-core';

const here = path.dirname(fileURLToPath(import.meta.url));
const tokens = readFileSync(path.join(here, '../src/styles/v2-tokens.css'), 'utf8');
const mark = '<svg width="34" height="34" viewBox="0 0 32 32" aria-hidden="true"><path d="M16 4 L28 26 L22 26 L16 14 L10 26 L4 26 Z" fill="var(--v2-paper)"/><circle cx="16" cy="22" r="2" fill="var(--v2-accent)"/></svg>';

const page = (o) => `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400..600&family=Inter+Tight:wght@400;500;600&display=block">
<style>${tokens}
html, body { margin: 0; width: 1200px; height: 630px; }
.card { position: relative; overflow: hidden; isolation: isolate; box-sizing: border-box; width: 1200px; height: 630px; padding: 64px 72px;
  display: flex; flex-direction: column; color: var(--v2-paper); font-family: var(--v2-font-sans);
  background: ${o.tone === 'moss' ? 'linear-gradient(135deg, var(--v2-moss) 0%, var(--v2-moss-deep) 100%)' : 'linear-gradient(135deg, var(--v2-ink) 0%, var(--v2-ink-deep) 100%)'}; }
.card::before { content: ""; position: absolute; z-index: -1; top: -260px; right: -200px; width: 760px; height: 760px; border-radius: 50%;
  background: radial-gradient(circle, var(--v2-accent) 0%, transparent 70%); opacity: ${o.tone === 'moss' ? '.2' : '.28'}; filter: blur(30px); }
.brand { display: flex; align-items: center; gap: 14px; }
.mark { width: 52px; height: 52px; border-radius: 12px; background: var(--v2-ink); display: grid; place-items: center; box-shadow: 0 0 0 1px color-mix(in srgb, var(--v2-paper) 18%, transparent); }
.name { font-family: var(--v2-font-display); font-weight: 500; font-size: 34px; letter-spacing: -0.02em; }
h1 { margin: auto 0 0; font-family: var(--v2-font-display); font-weight: 500; font-variation-settings: "opsz" 144; font-size: 104px; line-height: 0.98; letter-spacing: -0.025em; }
h1 span { display: block; }
p { margin: 26px 0 0; font-size: 28px; line-height: 1.35; color: color-mix(in srgb, var(--v2-paper) 82%, transparent); max-width: 34em; text-wrap: balance; }
.foot { display: flex; justify-content: space-between; align-items: center; margin-top: 40px; font-size: 22px; color: color-mix(in srgb, var(--v2-paper) 74%, transparent); }
.pill { padding: 8px 18px; border-radius: 999px; background: color-mix(in srgb, var(--v2-paper) 12%, transparent); color: var(--v2-paper); font-weight: 500; }
</style></head><body>
<div class="card" data-surface="v2">
  <div class="brand"><span class="mark">${mark}</span><span class="name">Alamut</span></div>
  <h1><span>${o.h1[0]}</span><span>${o.h1[1]}</span></h1>
  <p>${o.sub}</p>
  <div class="foot"><span>${o.foot}</span><span class="pill">Public beta</span></div>
</div></body></html>`;

const images = [
  { file: 'og-creators.jpg', tone: 'moss', h1: ['Find brand deals.', 'Run them here.'], sub: 'Pitch open briefs at your own rate, or let brands find your storefront.', foot: 'Free to join, with no follower minimum' },
  { file: 'og-brands.jpg', tone: 'ink', h1: ['Find creators.', 'Run the deal here.'], sub: 'Browse storefronts with published rates, or post a brief and get pitched.', foot: 'Free to post, with no subscription' },
];

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const tab = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
for (const img of images) {
  await tab.setContent(page(img), { waitUntil: 'networkidle' });
  await tab.evaluate(() => document.fonts.ready);
  for (const out of img.file === 'og-creators.jpg' ? [img.file, 'og-image.jpg'] : [img.file]) {
    await tab.screenshot({ path: path.join(here, '../public', out), type: 'jpeg', quality: 88 });
    console.log('og-image:', out);
  }
}
await browser.close();
