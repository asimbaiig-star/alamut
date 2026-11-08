// demoNames.test.ts — the demo world's companies are invented.
//
// The sample data used to borrow ~90 real companies (and real magazines for
// press articles nobody wrote) and present them as Alamut customers, all the
// way into the live demo. They were replaced with invented names in the
// portal revamp; this keeps them out. The lists are the names that were
// removed. Common words among them (Hay, Calm, Apple…) are only checked as
// quoted names, so ordinary sentences can still use the word.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SRC = join(__dirname, '../..');
const read = (p: string) => readFileSync(join(SRC, p), 'utf8');
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const REMOVED = [
    'Ace Hotel', 'Aesop', 'Airbnb', 'Allbirds', 'Allset', 'Alo Yoga', 'Aman Resorts',
    'Apartamento', 'Blue Bottle', 'Boll & Branch', 'Bombas', 'Bose', 'Brilliant Earth',
    'Brooklinen', 'Buffy', 'Business of Fashion', 'Bykea', 'Byredo', 'Careem', 'Casper',
    'Catbird', 'Cuyana', 'D&Department', 'Daraz', 'Death Wish', 'Diptyque', 'Drunk Elephant',
    'Everlane', 'Faherty', 'Foodpanda', 'Foodpanda PK', 'Glossier', 'Great Jones', 'Gymshark',
    'Hender Scheme', 'Iittala', 'Khaadi', 'Kinfolk', 'Krave Mart', 'Le Creuset', 'Le Labo',
    'Leica', 'Linum & Co', 'Liquid Death', 'Lululemon', 'Made.com', 'Magic Spoon',
    'Maison Margiela', 'Maria B', 'Mejuri', 'Muji', 'National Foods', 'Net-a-Porter',
    'Norm Architects', 'Notpla', 'OATLY', 'Olaplex', 'Olipop', 'On Running', 'Our Place',
    'Outdoor Voices', 'Outerknown', 'Patagonia', 'Peak Design', 'Postalco', 'Reformation',
    'Salt & Stone', 'Sania Maskatiya', 'Sapphire Home', 'Skin + Me', 'Smeg', 'Snow Peak',
    'Soho House', 'Sonos', 'Sézane', 'Tata Harper', 'Teenage Eng.', 'TenThousand',
    'Thousand Fell', 'Tibi', 'Tossdown', 'Tracksmith', 'Trade Coffee', 'Universal Standard',
    'Vitra', 'Vogue', 'Vuori', 'West Elm',
];
const REMOVED_WORDS = [
    'Apple', 'Arc', 'Article', 'Beams', 'Beats', 'COS', 'Calm', 'Cereal', 'Dawn', 'Generation',
    'Hay', 'KIND', 'Linear', 'Notion', 'Parachute', 'Quince', 'Recess', 'Sapphire', 'The Cut',
];

describe('the demo data names no real company', () => {
  for (const file of ['lib/api/seed.ts', 'screens/workspace-v2/sparkEngine.ts']) {
    it(file, () => {
      const src = read(file);
      for (const n of REMOVED) {
        expect(src, `${file} names "${n}"`).not.toMatch(new RegExp(`(?<![\\w@.])${esc(n)}(?!\\w)`));
      }
      for (const n of REMOVED_WORDS) {
        expect(src, `${file} names "${n}"`).not.toMatch(new RegExp(`['"]${esc(n)}['"]`));
      }
    });
  }

  it('generated brands get a reserved domain, not one a real company may own', () => {
    expect(read('lib/api/seed.ts')).toMatch(/\+ '\.example',/);
  });

  it('returning visitors drop their cached copy of the old names', () => {
    const v = Number(read('lib/api/store.ts').match(/^\s*version:\s*(\d+),/m)?.[1]);
    expect(v).toBeGreaterThanOrEqual(17);
  });
});
