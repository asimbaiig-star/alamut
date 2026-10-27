// listings.ts — the example listings on each page's first screen.
//
// Examples, and labelled as such on the page: no brand, no creator and no
// figure here is a real account. They take the shape of what each side
// browses in the portal: campaign tiles in Browse campaigns, creator cards
// in Discover. Categories, platforms and formats come from the product's own
// lists (tested), and brands are described, never named.

import { PHOTOS, type Photo } from './photos';

export interface BriefListing {
  brand: string;        // a description, never a company name
  title: string;
  blurb: string;
  category: string;
  deliverables: string[];
  perCreator: number;
  deadlineDays: number;
}

export const BRIEFS: BriefListing[] = [
  { brand: 'A skincare company', title: 'Skincare launch', blurb: 'A new serum, shown in a real morning routine.', category: 'Beauty', deliverables: ['2 × Instagram Reel'], perCreator: 1500, deadlineDays: 14 },
  { brand: 'A meal-kit company', title: 'Weeknight recipes', blurb: 'Three quick dinners from one box.', category: 'Food', deliverables: ['3 × TikTok Video'], perCreator: 900, deadlineDays: 21 },
  { brand: 'A running-shoe brand', title: 'Trail running shoe', blurb: 'A long-form review after a month of runs.', category: 'Fitness', deliverables: ['1 × YouTube Long-form'], perCreator: 2400, deadlineDays: 30 },
  { brand: 'A phone maker', title: 'Budget phone review', blurb: 'An honest take on the camera and battery.', category: 'Tech', deliverables: ['1 × YouTube Long-form', '1 × YouTube Short'], perCreator: 1800, deadlineDays: 18 },
  { brand: 'A city tourism board', title: 'City break guide', blurb: 'Two days, four neighbourhoods, one guide.', category: 'Travel', deliverables: ['4 × Instagram Story', '1 × Instagram Reel'], perCreator: 1200, deadlineDays: 25 },
  { brand: 'A cosmetics brand', title: 'Lip tint drop', blurb: 'Five shades, swatched on camera.', category: 'Beauty', deliverables: ['1 × TikTok Video'], perCreator: 700, deadlineDays: 10 },
  { brand: 'A snack company', title: 'Protein snack range', blurb: 'What you eat after training, honestly.', category: 'Fitness', deliverables: ['2 × Instagram Reel'], perCreator: 1100, deadlineDays: 16 },
  { brand: 'A street-food chain', title: 'Street food series', blurb: 'A short tour of the menu.', category: 'Food', deliverables: ['1 × YouTube Short'], perCreator: 450, deadlineDays: 12 },
];

export const BRIEF_FILTERS = ['All', 'Beauty', 'Food', 'Fitness', 'Tech', 'Travel'] as const;

export interface CreatorChannel { platform: 'Instagram' | 'TikTok' | 'YouTube'; followers: string }

export interface CreatorListing {
  niche: string;
  category: string;
  channels: CreatorChannel[];
  engagement: number;
  from: number;
  photo: Photo;
}

export const CREATORS: CreatorListing[] = [
  { niche: 'Beauty creator', category: 'Beauty', channels: [{ platform: 'Instagram', followers: '48K' }, { platform: 'TikTok', followers: '12K' }], engagement: 5.2, from: 900, photo: PHOTOS.makeupTable },
  { niche: 'Home cook', category: 'Food', channels: [{ platform: 'TikTok', followers: '120K' }, { platform: 'Instagram', followers: '36K' }], engagement: 7.1, from: 1200, photo: PHOTOS.kitchenShoot },
  { niche: 'Tech reviewer', category: 'Tech', channels: [{ platform: 'YouTube', followers: '210K' }], engagement: 4.3, from: 3500, photo: PHOTOS.editTimeline },
  { niche: 'Lifestyle creator', category: 'Fashion', channels: [{ platform: 'Instagram', followers: '31K' }], engagement: 6.4, from: 650, photo: PHOTOS.ringLight },
  { niche: 'Product stylist', category: 'Beauty', channels: [{ platform: 'TikTok', followers: '76K' }], engagement: 8.0, from: 800, photo: PHOTOS.productSet },
  { niche: 'Desk setup creator', category: 'Tech', channels: [{ platform: 'YouTube', followers: '54K' }, { platform: 'Instagram', followers: '9K' }], engagement: 3.9, from: 1400, photo: PHOTOS.phoneOnTripod },
];

export const CREATOR_FILTERS = ['All', 'Instagram', 'TikTok', 'YouTube'] as const;
