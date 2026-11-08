// portalFrame.test.ts — the Round 2 frame and homes keep their promises.
//
//   1. The sidebar and phone-tab badges count from needsYou.ts, the same
//      list the home's pile shows, never from literals in the route tables.
//   2. The home stylesheet takes every colour from the v2 tokens, like the
//      landing, so the portal and the landing can't drift apart.
//   3. The phone tab bar has its own class names: it once borrowed
//      `.v2-tab`, which CampaignDetail's tab strip already owned, and each
//      restyled the other.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const V2 = join(__dirname, '..');
const STYLES = join(__dirname, '../../../styles');
const read = (p: string) => readFileSync(p, 'utf8');
const stripComments = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

describe('the portal frame', () => {
  it('badges count from the shared needs-you list', () => {
    const ws = stripComments(read(join(V2, 'Workspace.tsx')));
    expect(ws).toContain('useCreatorNeedsYou()');
    expect(ws).toContain('useBrandNeedsYou()');
    // No hand-written counts in the route tables.
    const tables = ws.slice(ws.indexOf('const BRAND_ROUTES'), ws.indexOf('const PERSONA_KEY'));
    expect(tables).not.toMatch(/count:\s*\d/);
  });

  it('the home stylesheet uses tokens, not colours of its own', () => {
    const css = stripComments(read(join(STYLES, 'portal-home.css')));
    expect(css).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(css).not.toMatch(/rgba?\(/i);
  });

  it('the phone tab bar does not share class names with page tab strips', () => {
    const ws = read(join(V2, 'Workspace.tsx'));
    expect(ws).not.toMatch(/className=\{?[`'"]v2-tab[`'" $]/);
    const css = read(join(STYLES, 'workspace-v2.css'));
    expect(css).not.toMatch(/\.v2-tab[\s.:{]/);
  });
});
