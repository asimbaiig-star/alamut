// listings-briefs.ts — the example open briefs on the creator page's first
// screen, shaped as Browse campaigns lists them (see listings.ts).

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
