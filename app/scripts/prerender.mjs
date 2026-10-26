// prerender.mjs — write each landing page's HTML into its shell at build time.
//
// Run after both Vite builds (see package.json "build"). The hero, the copy
// and the calculators' initial state are in the HTML a crawler or a slow phone
// receives; entry-client.tsx then hydrates it.

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const dist = path.resolve('dist');
const ssrDir = path.resolve('dist-ssr');
const entry = fs.readdirSync(ssrDir).find((f) => /^entry-server.*\.m?js$/.test(f));
if (!entry) throw new Error('prerender: no entry-server bundle in dist-ssr/');
const { render } = await import(pathToFileURL(path.join(ssrDir, entry)).href);

const MARKER = '<!--lx-ssr-->';
for (const [page, file] of [['creators', 'index.html'], ['brands', 'for-brands/index.html']]) {
  const target = path.join(dist, file);
  const html = fs.readFileSync(target, 'utf8');
  if (!html.includes(MARKER)) throw new Error(`prerender: ${file} has no ${MARKER} marker`);
  const body = render(page);
  if (!/<h1[\s>]/.test(body)) throw new Error(`prerender: ${page} rendered without an <h1>`);
  fs.writeFileSync(target, html.replace(MARKER, body));
  console.log(`prerender: ${file} · ${(body.length / 1024).toFixed(1)} KB of HTML`);
}
fs.rmSync(ssrDir, { recursive: true, force: true });
