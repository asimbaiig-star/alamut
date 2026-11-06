// listings-creators.ts — the example storefronts on the brand page's first
// screen, shaped as Discover lists them (see listings.ts).

import type { PackageKey } from './listings';
import { PHOTOS, type Photo } from './photos';

export interface CreatorChannel { platform: 'Instagram' | 'TikTok' | 'YouTube'; followers: string }

export interface CreatorListing {
  niche: string;
  category: string;
  channels: CreatorChannel[];
  engagement: number;
  packages: { key: PackageKey; rate: number }[];
  photo: Photo;
  /** The colour this storefront's sheet floods the hero with. */
  ground: string;
}

export const CREATORS: CreatorListing[] = [
  { niche: 'Beauty creator', category: 'Beauty', channels: [{ platform: 'Instagram', followers: '48K' }, { platform: 'TikTok', followers: '12K' }], engagement: 5.2,
    packages: [{ key: 'reel', rate: 900 }, { key: 'story', rate: 450 }, { key: 'combo', rate: 1250 }], photo: PHOTOS.makeupTutorial, ground: 'var(--v2-band-aubergine)' },
  { niche: 'Home cook', category: 'Food', channels: [{ platform: 'TikTok', followers: '120K' }, { platform: 'Instagram', followers: '36K' }], engagement: 7.1,
    packages: [{ key: 'reel', rate: 1200 }, { key: 'story', rate: 550 }, { key: 'combo', rate: 1600 }], photo: PHOTOS.foodTutorial, ground: 'var(--v2-band-ink)' },
  { niche: 'Tech reviewer', category: 'Tech', channels: [{ platform: 'YouTube', followers: '210K' }], engagement: 4.3,
    packages: [{ key: 'longform', rate: 3500 }], photo: PHOTOS.cameraRed, ground: 'var(--v2-band-navy)' },
  { niche: 'Lifestyle creator', category: 'Fashion', channels: [{ platform: 'Instagram', followers: '31K' }], engagement: 6.4,
    packages: [{ key: 'reel', rate: 650 }, { key: 'story', rate: 300 }, { key: 'combo', rate: 850 }], photo: PHOTOS.pinkBlue, ground: 'var(--v2-band-brick)' },
];

/** A storefront's lowest package, as Discover shows "from". */
export const fromRate = (c: CreatorListing) => Math.min(...c.packages.map((p) => p.rate));
