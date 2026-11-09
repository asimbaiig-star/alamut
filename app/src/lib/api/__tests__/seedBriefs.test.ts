// seedBriefs.test.ts — sample briefs read like briefs, and are the ones shown.
import { describe, it, expect } from 'vitest';
import { SEED } from '../seed';
import { campaignToV2 } from '@/screens/workspace-v2/v2Adapters';

const generated = SEED.campaigns.filter((c) => /^cmp_g/.test(c.id));

describe('generated briefs', () => {
  it('say something about the work, in grammar', () => {
    expect(generated.length).toBeGreaterThan(20);
    for (const c of generated) {
      expect(c.brief.length, c.id).toBeGreaterThan(80);
      expect(c.brief, c.id).not.toMatch(/\b1 [a-z]+ creators\b|\{\w+\}/);
    }
  });
  it('fit their category (no morning routines on a tech brief)', () => {
    for (const c of generated.filter((x) => /tech|finance|b2b/i.test(x.category))) {
      expect(c.brief, c.id).not.toMatch(/morning routine/i);
    }
  });
  it('the portal shows the full brief, not the one-line pitch', () => {
    const c = generated[0];
    expect(campaignToV2(c, SEED).brief).toBe(c.brief);
  });
});
