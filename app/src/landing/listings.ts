// listings.ts — the example listings on each page's first screen.
//
// Examples, and labelled as such on the page: no brand, no creator and no
// figure here is a real account. They show the shape of what each side
// browses in the app (BrowseBriefs for creators, Discover for brands).
// Categories and platforms come from the product's own lists.

import { PHOTOS, type Photo } from './photos';

export interface BriefListing { title: string; category: string; deliverables: string; perCreator: number }

export const BRIEFS: BriefListing[] = [
  { title: 'Skincare launch', category: 'Beauty', deliverables: '2 × Instagram Reel', perCreator: 1500 },
  { title: 'Weeknight recipes', category: 'Food', deliverables: '3 × TikTok Video', perCreator: 900 },
  { title: 'Trail running shoe', category: 'Fitness', deliverables: '1 × YouTube Long-form', perCreator: 2400 },
  { title: 'Budget phone review', category: 'Tech', deliverables: '1 × YouTube Long-form', perCreator: 1800 },
  { title: 'City break guide', category: 'Travel', deliverables: '4 × Instagram Story', perCreator: 600 },
  { title: 'Lip tint drop', category: 'Beauty', deliverables: '1 × TikTok Video', perCreator: 700 },
  { title: 'Protein snack range', category: 'Fitness', deliverables: '2 × Instagram Reel', perCreator: 1100 },
  { title: 'Street food series', category: 'Food', deliverables: '1 × YouTube Short', perCreator: 450 },
];

export const BRIEF_FILTERS = ['All', 'Beauty', 'Food', 'Fitness', 'Tech', 'Travel'] as const;

export interface CreatorListing { niche: string; platform: string; followers: string; rate: number; per: string; photo: Photo }

export const CREATORS: CreatorListing[] = [
  { niche: 'Beauty creator', platform: 'Instagram', followers: '48K followers', rate: 900, per: 'per Reel', photo: PHOTOS.makeupTable },
  { niche: 'Food creator', platform: 'TikTok', followers: '120K followers', rate: 1200, per: 'per video', photo: PHOTOS.kitchenShoot },
  { niche: 'Tech reviewer', platform: 'YouTube', followers: '210K subscribers', rate: 3500, per: 'per long-form', photo: PHOTOS.editTimeline },
  { niche: 'Lifestyle creator', platform: 'Instagram', followers: '31K followers', rate: 650, per: 'per Reel', photo: PHOTOS.ringLight },
  { niche: 'Product stylist', platform: 'TikTok', followers: '76K followers', rate: 800, per: 'per video', photo: PHOTOS.productSet },
  { niche: 'Desk setup creator', platform: 'YouTube', followers: '54K subscribers', rate: 1400, per: 'per long-form', photo: PHOTOS.phoneOnTripod },
];

export const CREATOR_FILTERS = ['All', 'Instagram', 'TikTok', 'YouTube'] as const;
