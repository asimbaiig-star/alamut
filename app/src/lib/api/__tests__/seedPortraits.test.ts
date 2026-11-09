// seedPortraits.test.ts — sample creators wear a face, and one that fits.
//
// Generated creators took PORTRAITS[idx] whatever their name: "Arjun Reddy"
// wore a woman's portrait on Discover, and some "portraits" were a product
// flat-lay, an empty road, distant figures, or images that no longer load.
import { describe, it, expect } from 'vitest';
import { SEED, PORTRAIT_POOLS } from '../seed';

const NOT_FACES = [
  'photo-1492707892479-7bc8d5a4ee93', // flat-lay
  'photo-1523251343397-9225e4cb6319', // road
  'photo-1488161628813-04466f872be2', // distant figure
  'photo-1499714608240-22fc6ad53fb2', // distant figure
  'photo-1604004215423-09e771b1b6db', // no longer loads
  'photo-1601758174026-c1d4d6f4e0f4', // no longer loads
  'photo-1542385151-efd9bc7a8552',    // no longer loads
];
const id = (url: string) => url.match(/photo-[0-9a-f-]+/)?.[0] ?? '';

describe('sample creator portraits', () => {
  const generated = SEED.creators.filter((c) => /^c_g|^c_new/.test(c.id));

  it('none is a non-face or a broken image', () => {
    expect(generated.length).toBeGreaterThan(50);
    for (const c of generated) expect(NOT_FACES, `${c.name}`).not.toContain(id(c.portrait));
  });

  it("a man's name gets a man's portrait, a woman's a woman's", () => {
    const men = new Set(PORTRAIT_POOLS.men.map(id));
    const women = new Set(PORTRAIT_POOLS.women.map(id));
    for (const c of generated) {
      const isMan = PORTRAIT_POOLS.menNames.has(c.name.split(/\s+/)[0]);
      expect((isMan ? men : women).has(id(c.portrait)), `${c.name}`).toBe(true);
    }
  });

  it('the two pools share no photo', () => {
    const men = new Set(PORTRAIT_POOLS.men);
    for (const w of PORTRAIT_POOLS.women) expect(men.has(w)).toBe(false);
  });
});

describe('portrait spread', () => {
  it('a photo repeats only after its whole pool is used', () => {
    const gen = SEED.creators.filter((c) => /^c_gc/.test(c.id));
    for (const sex of ['men', 'women'] as const) {
      const pool = PORTRAIT_POOLS[sex].length;
      const seq = gen.filter((c) => PORTRAIT_POOLS.menNames.has(c.name.split(/\s+/)[0]) === (sex === 'men')).map((c) => c.portrait);
      for (let i = 0; i + 1 < seq.length; i++) {
        const window = seq.slice(i, i + pool);
        expect(new Set(window).size, `${sex} at ${i}`).toBe(window.length);
      }
    }
  });
});

describe('showcase faces are their own', () => {
  it('no generated creator wears Sarah, Amir or Yuki’s portrait', () => {
    const showcase = new Set(['c_sarah', 'c_amir', 'c_yuki'].map((cid) => SEED.creators.find((c) => c.id === cid)?.portrait).filter(Boolean).map((u) => id(u!)));
    expect(showcase.size).toBeGreaterThan(0);
    for (const c of SEED.creators.filter((x) => /^c_gc/.test(x.id))) expect(showcase.has(id(c.portrait)), c.name).toBe(false);
  });
});
