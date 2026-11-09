// globalDefaults.test.ts — the portal's defaults and examples are global.
//
// The first version was Pakistan-only. Its defaults outlived it: the wizard
// pre-picked Karachi and Lahore, Discover's city filter offered five
// Pakistani cities to a global roster, Spark suggested an "Eid campaign for
// Sapphire" (a real brand), onboarding offered JazzCash and quoted "FBR",
// and the brand wallet listed JazzCash as a top-up method. Creators who live
// in Karachi are fine; Pakistan as the default is not.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const V2 = join(__dirname, '..');
const files = [
  'sparkEngine.ts',
  'v2CampaignActions.ts',
  ...readdirSync(join(V2, 'screens')).filter((f) => f.endsWith('.tsx')).map((f) => `screens/${f}`),
];
const code = (f: string) => readFileSync(join(V2, f), 'utf8')
  // Comments explain the history; only code and copy count.
  .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

describe('global defaults', () => {
  it('no real brand or Pakistan-only payment rail in portal copy', () => {
    for (const f of files) {
      const src = code(f);
      expect(src, f).not.toMatch(/Sapphire|JazzCash|Easypaisa|\bHBL\b|\bFBR\b/);
    }
  });
  it('no Pakistan default for a region, a placeholder or a city list', () => {
    for (const f of files) {
      const src = code(f);
      expect(src, f).not.toMatch(/\|\|\s*'Pakistan'/);
      expect(src, f).not.toMatch(/placeholder="Pakistan/);
      expect(src, f).not.toMatch(/\['Karachi', 'Lahore'/);
    }
  });
});
