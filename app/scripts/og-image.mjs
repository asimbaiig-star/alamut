// og-image.mjs — renders the link-preview images the landing pages share:
//   public/og-creators.jpg  (index.html)   the creator hero: headline and pile
//   public/og-brands.jpg    (for-brands)   the brand hero: headline and pile
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
const mark = '<svg width="34" height="34" viewBox="0 0 32 32" aria-hidden="true"><path d="M16 4 L28 26 L22 26 L16 14 L10 26 L4 26 Z" fill="var(--v2-ink)"/><circle cx="16" cy="22" r="2" fill="var(--v2-accent)"/></svg>';

const page = (o) => `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400..600&family=Inter+Tight:wght@400;500;600&display=block">
<style>${tokens}
html, body { margin: 0; width: 1200px; height: 630px; }
.card { position: relative; overflow: hidden; box-sizing: border-box; width: 1200px; height: 630px; padding: 56px 64px; color: var(--v2-paper); font-family: var(--v2-font-sans); background: ${o.ground}; }
.brand { display: flex; align-items: center; gap: 14px; }
.mark { width: 52px; height: 52px; border-radius: 12px; background: var(--v2-paper); display: grid; place-items: center; }
.name { font-family: var(--v2-font-display); font-weight: 500; font-size: 36px; letter-spacing: -0.02em; }
h1 { position: absolute; left: 60px; bottom: 150px; margin: 0; font-family: var(--v2-font-display); font-weight: 400; font-variation-settings: "opsz" 144; font-size: ${o.size}px; line-height: .96; letter-spacing: -.04em; }
h1 span { display: block; white-space: nowrap; }
p { position: absolute; left: 64px; bottom: 58px; margin: 0; width: 640px; font-size: 27px; line-height: 1.3; color: color-mix(in srgb, var(--v2-paper) 86%, transparent); }
.pile { position: absolute; right: 56px; top: 56px; width: 348px; }
.band { display: flex; justify-content: space-between; align-items: flex-start; height: 76px; margin-bottom: -22px; padding: 15px 20px 0; border-radius: 16px 16px 0 0; font-size: 21px; font-weight: 500; box-shadow: 0 -8px 20px -8px color-mix(in srgb, var(--v2-ink) 50%, transparent); }
.band b { font-family: var(--v2-font-display); font-weight: 500; font-size: 25px; }
.sheet { position: relative; height: 560px; padding: 24px 24px; border-radius: 18px; background: var(--v2-paper); color: var(--v2-ink); box-shadow: 0 -10px 30px color-mix(in srgb, var(--v2-ink) 20%, transparent); }
.sheet small { display: flex; justify-content: space-between; font-size: 15px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; color: ${o.print}; }
.sheet small i { font-style: normal; font-weight: 500; letter-spacing: 0; text-transform: none; color: var(--v2-ink-3); }
.sheet h2 { margin: 14px 0 6px; font-family: var(--v2-font-display); font-weight: 500; font-size: 38px; line-height: 1.05; letter-spacing: -.02em; }
.sheet div { margin-top: 22px; padding-top: 16px; border-top: 1px solid var(--v2-line); font-size: 19px; font-weight: 500; color: var(--v2-ink-2); }
.sheet b { display: block; font-family: var(--v2-font-display); font-weight: 500; font-size: 62px; line-height: 1.05; letter-spacing: -.025em; color: var(--v2-moss); }
</style></head><body>
<div class="card" data-surface="v2">
  <div class="brand"><span class="mark">${mark}</span><span class="name">Alamut</span></div>
  <h1><span>${o.h1[0]}</span><span>${o.h1[1]}</span></h1>
  <p>${o.sub}</p>
  <div class="pile">
    ${o.bands.map(([bg, name, rate]) => `<div class="band" style="background:${bg}"><span>${name}</span><b>${rate}</b></div>`).join('')}
    <div class="sheet"><small>${o.sheet.who}<i>Example</i></small><h2>${o.sheet.title}</h2><div>${o.sheet.label}<b>${o.sheet.figure}</b></div></div>
  </div>
</div></body></html>`;

const images = [
  {
    file: 'og-creators.jpg', ground: 'var(--v2-band-navy)', print: 'var(--v2-band-navy)', size: 112,
    h1: ['Find brand deals.', 'Run them here.'], sub: 'Pitch open briefs at your own rate, or let brands find your storefront.',
    bands: [['var(--v2-band-aubergine)', 'Weeknight recipes', '$900'], ['var(--v2-band-brick)', 'Trail running shoe', '$2,400'], ['var(--v2-band-moss)', 'City break guide', '$1,200']],
    sheet: { who: 'A skincare company', title: 'Skincare launch', label: 'You keep', figure: '$1,275' },
  },
  {
    file: 'og-brands.jpg', ground: 'var(--v2-band-aubergine)', print: 'var(--v2-band-aubergine)', size: 100,
    h1: ['Find creators.', 'Run the deal here.'], sub: 'Browse storefronts with published rates, or post a brief and get pitched.',
    bands: [['var(--v2-band-ink)', 'Home cook', '$550'], ['var(--v2-band-navy)', 'Tech reviewer', '$3,500'], ['var(--v2-band-brick)', 'Lifestyle creator', '$300']],
    sheet: { who: 'Beauty creator', title: 'Instagram Reel', label: 'You pay', figure: '$900' },
  },
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
