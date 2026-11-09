// tokensDefined.test.ts — every --v2-* token the portal uses is defined.
//
// --v2-bg-1, --v2-border and --v2-rule were used in 17 files and defined
// nowhere. A var() that doesn't resolve voids its whole declaration, so
// the creator's portfolio (background: url(...), var(--v2-bg-1)) showed six
// blank tiles, and nothing failed: no error, no warning, no test.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const SRC = join(__dirname, '..', '..', '..');
function walk(dir: string, out: string[] = []): string[] {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) { if (f !== 'node_modules') walk(p, out); }
    else if (/\.(tsx?|css)$/.test(f)) out.push(p);
  }
  return out;
}

describe('v2 tokens', () => {
  it('every var(--v2-…) in the app is defined somewhere', () => {
    const files = walk(SRC).filter((f) => !f.includes('__tests__'));
    const defined = new Set<string>();
    const used = new Map<string, string>();
    for (const f of files) {
      const src = readFileSync(f, 'utf8');
      for (const m of src.matchAll(/(--v2-[a-z0-9-]+)\s*:/g)) defined.add(m[1]);
      // Tokens set from code (style={{ ['--v2-x' as string]: … }}) count too.
      for (const m of src.matchAll(/['"](--v2-[a-z0-9-]+)['"]/g)) defined.add(m[1]);
      for (const m of src.matchAll(/var\((--v2-[a-z0-9-]+)\s*\)/g)) if (!used.has(m[1])) used.set(m[1], f.replace(SRC, 'src'));
    }
    const missing = [...used.entries()].filter(([t]) => !defined.has(t)).map(([t, f]) => `${t} (first in ${f})`);
    expect(missing).toEqual([]);
  });
});
