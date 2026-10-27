// check-landing.mjs — fail the build if a landing page regresses on what the
// revamp was for: prerendered content, a small payload, no app code.
//
// The old landing made every visitor download the whole app (~356 KB gzip,
// the 2 MB seed, 20 Supabase calls) before the hero painted. Budgets below
// are for everything a landing HTML file references.

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const BUDGET = { js: 60 * 1024, css: 15 * 1024 }; // gzip bytes, per page
const dist = path.resolve('dist');
// Strings that only exist in app code. Finding one in a landing asset means
// the landing bundle pulled in the store, the seed or supabase-js.
const APP_ONLY = ['createClient(', 'alamut.v1', 'u_hannah', 'b_aesop', 'mountSessionSync'];

let failed = false;
const fail = (msg) => { failed = true; console.error(`check-landing: FAIL ${msg}`); };

for (const file of ['index.html', 'for-brands/index.html']) {
  const html = fs.readFileSync(path.join(dist, file), 'utf8');
  if (html.includes('<!--lx-ssr-->')) fail(`${file} was never prerendered`);
  if (!/<div id="lx-root"[^>]*><div class="lx" data-surface="v2">/.test(html)) fail(`${file} has no prerendered page in #lx-root, on the v2 surface`);
  if (!/<h1[\s>]/.test(html)) fail(`${file} has no <h1> in its HTML`);
  if (/assets\/(vendor|index)-[\w-]+\.js/.test(html)) fail(`${file} references the app bundle`);

  const refs = [...html.matchAll(/(?:src|href)="\/(assets\/lx-[^"]+\.(js|css))"/g)].map((m) => [m[1], m[2]]);
  const size = { js: 0, css: 0 };
  for (const [ref, kind] of new Map(refs)) {
    const buf = fs.readFileSync(path.join(dist, ref));
    size[kind] += zlib.gzipSync(buf, { level: 9 }).length;
    const text = buf.toString('utf8');
    for (const s of APP_ONLY) if (text.includes(s)) fail(`${file} → ${ref} contains app-only "${s}"`);
  }
  for (const kind of ['js', 'css']) {
    const kb = (size[kind] / 1024).toFixed(1);
    if (size[kind] > BUDGET[kind]) fail(`${file} ${kind} is ${kb} KB gzip (budget ${BUDGET[kind] / 1024} KB)`);
    else console.log(`check-landing: ${file} ${kind} ${kb} KB gzip (budget ${BUDGET[kind] / 1024} KB)`);
  }
  if (size.js === 0) fail(`${file} references no landing JS — the page would never hydrate`);
}
if (failed) process.exit(1);
console.log('check-landing: ok');
