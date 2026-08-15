// Rich demo seed — 60+ creators, 55+ brands, ~40 campaigns and all derived entities.
// Generated deterministically (mulberry32 PRNG with fixed seed) so runs are stable.
//
// Demo accounts (password `demo1234` for all):
//   creator: sarah@alamut.test  (Flagship · NYC)
//   creator: amir@alamut.test   (Specialist · Lahore)
//   creator: yuki@alamut.test   (Specialist · Kyoto)
//   brand:   hannah@aesop.test
//   brand:   marcus@lecreuset.test
//   admin:   admin@alamut.test

import type {
  Application, AudienceDemographics, Brand, Campaign, CampaignPerformance,
  CampaignStage, CampaignTracking, ContentRights, Creator, Database, Dispute,
  Offer, Platform, Referral, RetainerConfig, Submission, Thread,
  Transaction, User,
} from './types';
// Demo predicates — the single definition of "nobody real owns this row".
// Used by the pre-verification pass at the bottom of this file so it can only
// ever touch seeded accounts.
import { isDemoCreator, isDemoBrand } from '@/lib/utils/demoData';

// ============ PRNG (deterministic) ============
function mulberry32(seed: number) {
  let t = seed;
  return () => {
    t = (t + 0x6d2b79f5) | 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = mulberry32(20260427);
const pick = <T,>(arr: T[]) => arr[Math.floor(rng() * arr.length)];
const range = (min: number, max: number) => Math.floor(rng() * (max - min + 1)) + min;
const chance = (p: number) => rng() < p;

// ============ DATE HELPERS ============
// NOW is anchored to whenever the seed module loads — keeps demo data
// always-fresh so deadlines / created-at relative dates never drift into
// the past as the codebase ages. Determinism of the random pool comes
// from the mulberry32 seed below, not from NOW (so different load times
// still produce the same campaign mix; only the timestamps shift).
const NOW = new Date();
const dayAgo = (d: number) => new Date(NOW.getTime() - d * 86_400_000).toISOString();
const dayAhead = (d: number) => new Date(NOW.getTime() + d * 86_400_000).toISOString();

/** F28 — keep generated campaign titles distinct within a single brand.
 *  Keyed `brandId::title`; on a collision we append an edition qualifier
 *  (and fall back to a numeric suffix if those run out) so a brand's own
 *  campaign list is never ambiguous. */
const usedCampaignTitles = new Set<string>(
  // Pre-register the hand-written campaigns (cmp_1..4 + the three
  // cmp_aesop_* lifecycle demos) so the generator can't reuse one of
  // their titles for the same brand. Without this, generated `cmp_g0`
  // took "Studio Notes" on b_aesop — the exact collision with cmp_3 that
  // made Aesop's own campaign list ambiguous.
  [
    'b_aesop::Spring Renewal',
    'b_lecreuset::Slow Sundays',
    'b_aesop::Studio Notes',
    'b_lecreuset::Holiday Tables',
    'b_aesop::Quiet Hours',
    'b_aesop::Second Light',
    'b_aesop::Quiet Objects 2026 — Q3 (draft)',
    'b_aesop::Reset Skincare — Spring',
    'b_aesop::Hand-care kit · launch teaser',
  ],
);
const TITLE_QUALIFIERS = [
  'Spring', 'Summer', 'Autumn', 'Winter', 'Vol. II', 'Vol. III',
  'Encore', 'Reprise', 'Late Edition',
];
function uniqueCampaignTitle(brandId: string, base: string): string {
  const key = (t: string) => `${brandId}::${t}`;
  if (!usedCampaignTitles.has(key(base))) {
    usedCampaignTitles.add(key(base));
    return base;
  }
  for (const q of TITLE_QUALIFIERS) {
    const candidate = `${base} · ${q}`;
    if (!usedCampaignTitles.has(key(candidate))) {
      usedCampaignTitles.add(key(candidate));
      return candidate;
    }
  }
  let n = 2;
  while (usedCampaignTitles.has(key(`${base} (${n})`))) n++;
  const fallback = `${base} (${n})`;
  usedCampaignTitles.add(key(fallback));
  return fallback;
}
// Deadlines are stored as ISO date strings (YYYY-MM-DD) so consumers can
// `new Date(d)` for math + formatting. Display sites format with locale.
const friendlyDeadline = (offsetDays: number) => {
  const d = new Date(NOW.getTime() + offsetDays * 86_400_000);
  return d.toISOString().slice(0, 10);
};
const futureDeadline = (offsetDays: number) => {
  const d = new Date(NOW.getTime() + offsetDays * 86_400_000);
  return d.toISOString().slice(0, 10);
};

// ============ ASSET POOLS ============
const PORTRAITS = [
  'photo-1494790108377-be9c29b29330', 'photo-1500648767791-00dcc994a43e', 'photo-1438761681033-6461ffad8d80',
  'photo-1507003211169-0a1dd7228f2d', 'photo-1544005313-94ddf0286df2', 'photo-1463453091185-61582044d556',
  'photo-1517841905240-472988babdf9', 'photo-1506794778202-cad84cf45f1d', 'photo-1521119989659-a83eee488004',
  'photo-1531123897727-8f129e1688ce', 'photo-1573496359142-b8d87734a5a2', 'photo-1558203728-00f45181dd84',
  'photo-1485875437342-9b39470b3d95', 'photo-1539571696357-5a69c17a67c6', 'photo-1502323777036-f29e3972d82f',
  'photo-1492562080023-ab3db95bfbce', 'photo-1554384645-13eab165c24b', 'photo-1523824921871-d6f1a15151f1',
  'photo-1531746020798-e6953c6e8e04', 'photo-1529626455594-4ff0802cfb7e', 'photo-1488426862026-3ee34a7d66df',
  'photo-1527980965255-d3b416303d12', 'photo-1532170579297-281918c8ae72', 'photo-1542327897-d73f4005b533',
  'photo-1496440737103-cd596325d314', 'photo-1542178243-bc20204b769f', 'photo-1573497019940-1c28c88b4f3e',
  'photo-1492707892479-7bc8d5a4ee93', 'photo-1535713875002-d1d0cf377fde', 'photo-1517365830460-955ce3ccd263',
  // 30 more for variety
  'photo-1564564321837-a57b7070ac4f', 'photo-1488161628813-04466f872be2', 'photo-1542596594-649edbc13630',
  'photo-1523251343397-9225e4cb6319', 'photo-1488161628813-04466f872be2', 'photo-1542740348-39501cd6e2b4',
  'photo-1499714608240-22fc6ad53fb2', 'photo-1554151228-14d9def656e4', 'photo-1502685104226-ee32379fefbe',
  'photo-1607746882042-944635dfe10e', 'photo-1522075469751-3a6694fb2f61', 'photo-1601412436009-d964bd02edbc',
  'photo-1604004215423-09e771b1b6db', 'photo-1611432579402-7037e3e2c1e4', 'photo-1601758174026-c1d4d6f4e0f4',
  'photo-1531427186611-ecfd6d936c79', 'photo-1614283233556-f35b0c801ef1', 'photo-1542385151-efd9bc7a8552',
  'photo-1611432579699-484f7990b127', 'photo-1438761681033-6461ffad8d80', 'photo-1601412436009-d964bd02edbc',
  'photo-1593104547489-5cfb3839a3b5', 'photo-1547425260-76bcadfb4f2c', 'photo-1610276198568-eb6d0ff53e48',
  'photo-1545167622-3a6ac756afa4', 'photo-1545996124-0501ebae84d0', 'photo-1576828831022-ca41d3905fb7',
];

const COVERS = [
  'photo-1556228720-195a672e8a03', // skincare
  'photo-1556909114-f6e7ad7d3136', // food bowl
  'photo-1505693416388-ac5ce068fe85', // cozy
  'photo-1574781330855-d0db8cc6a79c', // table setting
  'photo-1469334031218-e382a71b716b', // fashion
  'photo-1490481651871-ab68de25d43d', // editorial
  'photo-1551803091-e20673f15770', // model
  'photo-1487222477894-8943e31ef7b2', // outdoors
  'photo-1546069901-ba9599a7e63c', // food plate
  'photo-1565299624946-b28f40a0ae38', // pizza
  'photo-1565958011703-44f9829ba187', // burger
  'photo-1493663284031-b7e3aefcae8e', // workshop
  'photo-1509631179647-0177331693ae', // shoes
  'photo-1515886657613-9f3515b0c78f', // bottle still
  'photo-1542838132-92c53300491e', // travel
  'photo-1519681393784-d120267933ba', // landscape
  'photo-1542038784456-1ea8e935640e', // home
  'photo-1452860606245-08befc0ff44b', // cafe
  'photo-1441986300917-64674bd600d8', // shop
  'photo-1532453288672-3a27e9be9efd', // beauty
  'photo-1485518882345-15568b007407', // tech
  'photo-1542219550-37153d387c27', // wellness
];

// Phase 53 — `upx` previously naively concatenated `https://images.unsplash.com/`
// with whatever was passed. A few testimonials in seed pass FULL Unsplash URLs
// (legacy from a copy-paste pass) which produced `https://images.unsplash.com/
// https://images.unsplash.com/photo-...` — broken portraits on the creator
// landing testimonial wall. Detect and pass through full URLs directly.
const upx = (id: string, w = 800, h = 600) => {
  if (id.startsWith('http://') || id.startsWith('https://')) {
    // Already a full URL. Strip any existing query string, append our params.
    const base = id.split('?')[0];
    return `${base}?w=${w}&h=${h}&fit=crop&auto=format`;
  }
  return `https://images.unsplash.com/${id}?w=${w}&h=${h}&fit=crop&auto=format`;
};

// ============ NAME / BRAND POOLS ============
const FIRST_NAMES = [
  // Pakistani / South Asian
  'Aisha', 'Imran', 'Fatima', 'Hassan', 'Zara', 'Bilal', 'Mariam', 'Usman', 'Sara', 'Farhan',
  'Nadia', 'Kamran', 'Sana', 'Ahsan', 'Rabia', 'Saad', 'Aaliyah', 'Tariq', 'Hira', 'Asim',
  // Indian
  'Priya', 'Rohan', 'Ananya', 'Vikram', 'Meera', 'Arjun', 'Isha', 'Karan', 'Pooja', 'Devansh',
  // East Asian
  'Hiroshi', 'Min-jun', 'Ji-eun', 'Mei', 'Wei', 'Aiko', 'Kenji', 'Yuna', 'Lin', 'Haruki',
  // Western / European
  'Liam', 'Emma', 'Oliver', 'Sophia', 'Noah', 'Charlotte', 'Lucas', 'Ava', 'Elena', 'Mateo',
  // Latin
  'Carlos', 'Sofia', 'Lucia', 'Diego', 'Camila', 'Mateus', 'Valentina', 'Sebastián', 'Isabela', 'Tomás',
  // MENA
  'Layla', 'Omar', 'Yasmin', 'Khalid', 'Salma', 'Tariq', 'Nour', 'Adam', 'Maya', 'Ziad',
  // African
  'Adaeze', 'Kwame', 'Zanele', 'Tunde', 'Amara', 'Kofi',
];

const LAST_NAMES = [
  'Khan', 'Hussain', 'Sheikh', 'Malik', 'Ahmad', 'Raza', 'Siddiqui', 'Qureshi', 'Akhtar', 'Iqbal',
  'Sharma', 'Mehta', 'Reddy', 'Patel', 'Singh', 'Kapoor', 'Verma', 'Iyer', 'Joshi', 'Nair',
  'Tanaka', 'Yamada', 'Park', 'Kim', 'Chen', 'Wang', 'Liu', 'Suzuki', 'Lee',
  'Johnson', 'Brown', 'Wilson', 'Smith', 'Davis', 'Miller', 'Wilson', 'Anderson',
  'Mendoza', 'Reyes', 'Vargas', 'Rivera', 'García', 'Castro', 'Santos',
  'Al-Rashid', 'Mansour', 'Hafez', 'Najjar', 'Saleh', 'Khalil',
  'Okafor', 'Mensah', 'Osei', 'Mbeki',
];

const CITIES = [
  ['Karachi', 'Pakistan'], ['Lahore', 'Pakistan'], ['Islamabad', 'Pakistan'],
  ['Mumbai', 'India'], ['Delhi', 'India'], ['Bangalore', 'India'],
  ['Dubai', 'UAE'], ['Abu Dhabi', 'UAE'],
  ['Tokyo', 'Japan'], ['Kyoto', 'Japan'], ['Seoul', 'South Korea'],
  ['Singapore', 'Singapore'], ['Bangkok', 'Thailand'], ['Jakarta', 'Indonesia'],
  ['London', 'UK'], ['Manchester', 'UK'], ['Berlin', 'Germany'], ['Paris', 'France'], ['Amsterdam', 'Netherlands'],
  ['Milan', 'Italy'], ['Lisbon', 'Portugal'], ['Stockholm', 'Sweden'], ['Copenhagen', 'Denmark'],
  ['New York', 'USA'], ['Los Angeles', 'USA'], ['Brooklyn', 'USA'], ['Austin', 'USA'], ['Portland', 'USA'],
  ['Toronto', 'Canada'], ['Montreal', 'Canada'],
  ['Mexico City', 'Mexico'], ['São Paulo', 'Brazil'], ['Buenos Aires', 'Argentina'],
  ['Lagos', 'Nigeria'], ['Cape Town', 'South Africa'], ['Nairobi', 'Kenya'],
  ['Cairo', 'Egypt'], ['Istanbul', 'Türkiye'], ['Beirut', 'Lebanon'],
];

const CATEGORIES_POOL = ['Fashion', 'Lifestyle', 'Sustainability', 'Travel', 'Beauty', 'Food', 'Design', 'Wellness', 'Tech', 'Interiors'];
const LANGUAGES_POOL = ['English', 'Urdu', 'Hindi', 'Arabic', 'Japanese', 'Korean', 'Mandarin', 'Spanish', 'Portuguese', 'French', 'German'];

const PLATFORM_NAMES: Platform['name'][] = ['Instagram', 'YouTube', 'TikTok', 'Newsletter', 'X', 'LinkedIn', 'Substack'];

const TAGLINES_BY_CAT: Record<string, string[]> = {
  Fashion: [
    'Slow style and the things worth keeping.',
    'Quiet luxury for the everyday.',
    'Tailoring, textiles, and timeless pieces.',
    'Wardrobe rules I made up myself.',
  ],
  Food: [
    'Modern South Asian food, properly made.',
    'Cooking the way grandmothers did, with one or two tricks.',
    'Plant-forward, butter-friendly.',
    'Recipes you can actually finish on a Tuesday.',
  ],
  Beauty: [
    'Skincare for people who are tired.',
    'Honest reviews, no affiliate bait.',
    'Minimalist routines, maximum repair.',
    'Beauty in a hurry — and slow.',
  ],
  Travel: [
    'Off-the-strip cities, on-the-strip notes.',
    'How to spend a weekend properly.',
    'Hotels worth the flight.',
    'Local food, local people, no influencer hotels.',
  ],
  Design: [
    'Quiet objects, considered design.',
    'Workshop notes from the bench.',
    'Furniture I would actually live with.',
    'Visual essays on built things.',
  ],
  Lifestyle: [
    'Rituals, rooms, and small joys.',
    'Editor-turned-creator. Slow internet.',
    'Mornings, evenings, and the in-between.',
    'A practice of staying interested.',
  ],
  Sustainability: [
    'Buy less, choose well, mend often.',
    'Repair stories, second-hand wins.',
    'Climate-aware, not climate-anxious.',
    'Documenting the long use of things.',
  ],
  Wellness: [
    'Daily practice over occasional reset.',
    'Movement that fits a real life.',
    'Sleep, light, breath — in that order.',
    'Quiet wellness, no $200 supplements.',
  ],
  Tech: [
    'Workflow, tools, and good defaults.',
    'Honest software reviews.',
    'Setup tours that aren’t cluttered.',
    'Building things, in public.',
  ],
  Interiors: [
    'Small flats, considered choices.',
    'Older homes, modern hands.',
    'Renovations on a real budget.',
    'Light, air, restraint.',
  ],
};

// ============ BRANDS POOL ============
interface BrandSpec { name: string; industry: string; hq: string; about: string; mark: string; cats: string[]; }
const BRAND_POOL: BrandSpec[] = [
  // Beauty
  { name: 'Aesop',         industry: 'Beauty / Personal care', hq: 'Melbourne, AU',     mark: 'A', about: 'Aesop has carefully curated a range of skin, hair and body care formulations.', cats: ['Beauty', 'Lifestyle', 'Wellness', 'Design'] },
  { name: 'Glossier',      industry: 'Beauty',                 hq: 'New York, USA',     mark: 'G', about: 'Skin first, then makeup. People-powered beauty.',                              cats: ['Beauty', 'Lifestyle'] },
  { name: 'Le Labo',       industry: 'Fragrance',              hq: 'New York, USA',     mark: 'L', about: 'Soulful and crafted perfumery from Grasse to Brooklyn.',                       cats: ['Beauty', 'Lifestyle'] },
  { name: 'Tata Harper',   industry: 'Beauty',                 hq: 'Vermont, USA',      mark: 'T', about: 'Farm-to-face, formulated in our Vermont laboratory.',                          cats: ['Beauty', 'Wellness'] },
  { name: 'Drunk Elephant',industry: 'Beauty',                 hq: 'Houston, USA',      mark: 'D', about: 'Clean-clinical skincare without the suspicious six.',                          cats: ['Beauty', 'Wellness'] },
  // Home / Kitchen
  { name: 'Le Creuset',    industry: 'Home / Kitchen',         hq: 'Fresnoy, FR',       mark: 'L', about: 'Cast iron cookware handcrafted in France since 1925.',                          cats: ['Food', 'Lifestyle', 'Design'] },
  { name: 'Hay',           industry: 'Furniture',              hq: 'Copenhagen, DK',    mark: 'H', about: 'Contemporary furniture and accessories from Denmark.',                          cats: ['Design', 'Interiors', 'Lifestyle'] },
  { name: 'Vitra',         industry: 'Furniture',              hq: 'Basel, CH',         mark: 'V', about: 'Designs by the most important designers of our time.',                          cats: ['Design', 'Interiors'] },
  { name: 'Muji',          industry: 'Lifestyle',              hq: 'Tokyo, JP',         mark: 'M', about: 'Quality everyday products at fair prices.',                                     cats: ['Lifestyle', 'Design', 'Interiors', 'Sustainability'] },
  { name: 'Iittala',       industry: 'Glassware',              hq: 'Helsinki, FI',      mark: 'I', about: 'Timeless Finnish design for everyday tables.',                                  cats: ['Design', 'Interiors', 'Food'] },
  { name: 'Norm Architects',industry: 'Architecture',          hq: 'Copenhagen, DK',    mark: 'N', about: 'Quiet, considered design for living and working.',                              cats: ['Interiors', 'Design'] },
  { name: 'Made.com',      industry: 'Furniture',              hq: 'London, UK',        mark: 'M', about: 'Original design, fair prices.',                                                 cats: ['Interiors', 'Design'] },
  // Fashion
  { name: 'Everlane',      industry: 'Fashion',                hq: 'San Francisco, USA',mark: 'E', about: 'Modern essentials. Radically transparent.',                                     cats: ['Fashion', 'Sustainability'] },
  { name: 'COS',           industry: 'Fashion',                hq: 'Stockholm, SE',     mark: 'C', about: 'Modern, functional, considered design.',                                        cats: ['Fashion', 'Lifestyle'] },
  { name: 'Net-a-Porter',  industry: 'Fashion (luxury)',       hq: 'London, UK',        mark: 'N', about: 'Considered curation of luxury fashion.',                                        cats: ['Fashion'] },
  { name: 'Khaadi',        industry: 'Fashion',                hq: 'Karachi, PK',       mark: 'K', about: 'Pakistan’s most loved fashion house, crafted in our looms.',                    cats: ['Fashion', 'Lifestyle'] },
  { name: 'Generation',    industry: 'Fashion',                hq: 'Lahore, PK',        mark: 'G', about: 'Contemporary South Asian fashion with a conscience.',                          cats: ['Fashion', 'Sustainability'] },
  { name: 'Sapphire',      industry: 'Fashion',                hq: 'Lahore, PK',        mark: 'S', about: 'Festive and ready-to-wear, made in Pakistan.',                                 cats: ['Fashion', 'Lifestyle'] },
  { name: 'Maria B',       industry: 'Fashion',                hq: 'Lahore, PK',        mark: 'M', about: 'Couture and prêt for the modern South Asian woman.',                           cats: ['Fashion'] },
  { name: 'Sania Maskatiya',industry: 'Fashion',               hq: 'Karachi, PK',       mark: 'S', about: 'Hand-painted and embroidered women’s wear.',                                   cats: ['Fashion'] },
  // Food / Bev
  { name: 'Blue Bottle',   industry: 'Coffee',                 hq: 'Oakland, USA',      mark: 'B', about: 'Specialty coffee roasted within 48 hours of shipping.',                        cats: ['Food', 'Lifestyle'] },
  { name: 'OATLY',         industry: 'Plant milk',             hq: 'Malmö, SE',         mark: 'O', about: 'A company built around oats, not cows.',                                        cats: ['Food', 'Sustainability'] },
  { name: 'Notpla',        industry: 'Food packaging',         hq: 'London, UK',        mark: 'N', about: 'Packaging that disappears.',                                                   cats: ['Sustainability', 'Food'] },
  { name: 'KIND',          industry: 'Snacks',                 hq: 'New York, USA',     mark: 'K', about: 'Whole nuts. Whole fruit. Whole grains.',                                        cats: ['Food', 'Wellness'] },
  { name: 'Olipop',        industry: 'Beverages',              hq: 'California, USA',   mark: 'O', about: 'A new kind of soda — gut healthy, prebiotic.',                                  cats: ['Food', 'Wellness'] },
  // Travel / Hospitality
  { name: 'Airbnb',        industry: 'Travel',                 hq: 'San Francisco, USA',mark: 'A', about: 'Belong anywhere.',                                                              cats: ['Travel', 'Lifestyle'] },
  { name: 'Soho House',    industry: 'Hospitality',            hq: 'London, UK',        mark: 'S', about: 'Members\' clubs and hotels for creative people.',                              cats: ['Travel', 'Lifestyle'] },
  { name: 'Ace Hotel',     industry: 'Hospitality',            hq: 'Portland, USA',     mark: 'A', about: 'Hotels for the curious and creative.',                                         cats: ['Travel', 'Lifestyle', 'Design'] },
  { name: 'Aman Resorts',  industry: 'Hospitality',            hq: 'Singapore',         mark: 'A', about: 'Quiet, considered hospitality in extraordinary places.',                       cats: ['Travel', 'Wellness'] },
  // Tech / Gear
  { name: 'Peak Design',   industry: 'Photography gear',       hq: 'San Francisco, USA',mark: 'P', about: 'Carry solutions for working photographers.',                                   cats: ['Tech', 'Travel', 'Design'] },
  { name: 'Leica',         industry: 'Cameras',                hq: 'Wetzlar, DE',       mark: 'L', about: 'The decisive moment, since 1914.',                                              cats: ['Tech', 'Design'] },
  { name: 'Teenage Eng.',  industry: 'Audio gear',             hq: 'Stockholm, SE',     mark: 'T', about: 'Pocket synths and beautiful electronics.',                                     cats: ['Tech', 'Design'] },
  { name: 'Notion',        industry: 'Software',               hq: 'San Francisco, USA',mark: 'N', about: 'Connected workspace where better, faster work happens.',                       cats: ['Tech'] },
  { name: 'Linear',        industry: 'Software',               hq: 'San Francisco, USA',mark: 'L', about: 'Built for high-performance product teams.',                                    cats: ['Tech'] },
  { name: 'Arc',           industry: 'Software',               hq: 'New York, USA',     mark: 'A', about: 'A browser that thinks like you.',                                              cats: ['Tech'] },
  // Wellness
  { name: 'Lululemon',     industry: 'Athletic apparel',       hq: 'Vancouver, CA',     mark: 'L', about: 'Technical apparel for yoga, training, and life.',                              cats: ['Wellness', 'Fashion'] },
  { name: 'Alo Yoga',      industry: 'Athletic apparel',       hq: 'Beverly Hills, USA',mark: 'A', about: 'Yoga to street style.',                                                        cats: ['Wellness', 'Fashion'] },
  { name: 'On Running',    industry: 'Athletic shoes',         hq: 'Zurich, CH',        mark: 'O', about: 'Cloud-tec running shoes engineered in Switzerland.',                          cats: ['Wellness', 'Travel'] },
  { name: 'Calm',          industry: 'App',                    hq: 'San Francisco, USA',mark: 'C', about: 'The #1 app for meditation and sleep.',                                          cats: ['Wellness', 'Tech'] },
  // Sustainability / Conscious
  { name: 'Patagonia',     industry: 'Outdoor apparel',        hq: 'Ventura, USA',      mark: 'P', about: 'In business to save our home planet.',                                         cats: ['Sustainability', 'Travel'] },
  { name: 'Allbirds',      industry: 'Footwear',               hq: 'San Francisco, USA',mark: 'A', about: 'Naturally low carbon, super comfortable shoes.',                              cats: ['Sustainability', 'Fashion'] },
  { name: 'Thousand Fell', industry: 'Footwear',               hq: 'New York, USA',     mark: 'T', about: 'Recyclable sneakers, made to last.',                                          cats: ['Sustainability', 'Fashion'] },
  { name: 'Reformation',   industry: 'Fashion',                hq: 'Los Angeles, USA',  mark: 'R', about: 'Sustainable women\'s clothing, killer dresses.',                              cats: ['Fashion', 'Sustainability'] },
  // Lifestyle / Magazine-y
  { name: 'Kinfolk',       industry: 'Publishing',             hq: 'Copenhagen, DK',    mark: 'K', about: 'Quiet quarterly on essays, design, and food.',                                cats: ['Lifestyle', 'Design'] },
  { name: 'Cereal',        industry: 'Publishing',             hq: 'Bath, UK',          mark: 'C', about: 'Travel and style magazine.',                                                  cats: ['Travel', 'Lifestyle', 'Design'] },
  { name: 'Apartamento',   industry: 'Publishing',             hq: 'Barcelona, ES',     mark: 'A', about: 'An everyday-life interiors magazine.',                                        cats: ['Interiors', 'Lifestyle'] },
  // Pakistani / Regional consumer
  { name: 'National Foods',industry: 'Food (CPG)',             hq: 'Karachi, PK',       mark: 'N', about: 'Spices, recipes, and ready-to-cook for South Asian kitchens.',               cats: ['Food', 'Lifestyle'] },
  { name: 'Daraz',         industry: 'E-commerce',             hq: 'Karachi, PK',       mark: 'D', about: 'Online shopping in South Asia.',                                              cats: ['Lifestyle', 'Tech'] },
  { name: 'Foodpanda PK',  industry: 'Food delivery',          hq: 'Lahore, PK',        mark: 'F', about: 'Hot food delivered fast.',                                                    cats: ['Food', 'Tech'] },
  { name: 'Careem',        industry: 'Mobility',               hq: 'Dubai, UAE',        mark: 'C', about: 'Move people, things and money in the region.',                              cats: ['Tech', 'Lifestyle'] },
  // Made-up boutique
  { name: 'Studio Loma',   industry: 'Interiors',              hq: 'Lisbon, PT',        mark: 'S', about: 'Considered furniture for small homes.',                                       cats: ['Interiors', 'Design'] },
  { name: 'Salt & Stone',  industry: 'Personal care',          hq: 'Los Angeles, USA',  mark: 'S', about: 'Naturally-derived deodorant, body care.',                                     cats: ['Beauty', 'Wellness'] },
  { name: 'Linum & Co',    industry: 'Home textiles',          hq: 'Berlin, DE',        mark: 'L', about: 'Linen for your bedroom and table.',                                           cats: ['Interiors', 'Sustainability'] },
  { name: 'Ocre',          industry: 'Ceramics',               hq: 'Mexico City, MX',   mark: 'O', about: 'Hand-thrown stoneware from Oaxaca.',                                          cats: ['Design', 'Interiors'] },
  { name: 'Vento Cycle',   industry: 'Cycling',                hq: 'Milan, IT',         mark: 'V', about: 'Steel road frames built in Lombardy.',                                        cats: ['Tech', 'Travel', 'Wellness'] },
  { name: 'Nord & Pine',   industry: 'Outdoor apparel',        hq: 'Oslo, NO',          mark: 'N', about: 'Wool layers for cold mornings.',                                              cats: ['Travel', 'Sustainability'] },

  // === Additional 32 brands across all categories for a fuller marketplace feel ===
  { name: 'Byredo',           industry: 'Fragrance',          hq: 'Stockholm, SE',     mark: 'B', about: 'Niche fragrance, modern lifestyle accessories.',                cats: ['Beauty', 'Lifestyle'] },
  { name: 'Diptyque',         industry: 'Home & fragrance',   hq: 'Paris, FR',         mark: 'D', about: 'Parisian house of perfume, candles, and personal care.',       cats: ['Beauty', 'Interiors', 'Lifestyle'] },
  { name: 'Maison Margiela',  industry: 'Fragrance',          hq: 'Paris, FR',         mark: 'M', about: 'Replica scents and quietly disruptive ready-to-wear.',         cats: ['Beauty', 'Fashion'] },
  { name: 'Olaplex',          industry: 'Hair care',          hq: 'Los Angeles, USA',  mark: 'O', about: 'Bond-building hair repair, salon-grade.',                       cats: ['Beauty'] },
  { name: 'Skin + Me',        industry: 'Personal care',      hq: 'London, UK',        mark: 'S', about: 'Personalised prescription skincare delivered monthly.',         cats: ['Beauty', 'Wellness'] },
  { name: 'Faherty',          industry: 'Fashion',            hq: 'New York, USA',     mark: 'F', about: 'Modern American style. Built to last, made for any place.',    cats: ['Fashion', 'Travel'] },
  { name: 'Outerknown',       industry: 'Fashion',            hq: 'Culver City, USA',  mark: 'O', about: 'Sustainable surf-inspired apparel for men and women.',         cats: ['Fashion', 'Sustainability', 'Travel'] },
  { name: 'Tibi',             industry: 'Fashion',            hq: 'New York, USA',     mark: 'T', about: 'Creative pragmatism — modern wardrobe staples.',                cats: ['Fashion', 'Lifestyle'] },
  { name: 'Sézane',           industry: 'Fashion',            hq: 'Paris, FR',         mark: 'S', about: 'French-girl fashion, made responsibly.',                        cats: ['Fashion', 'Lifestyle'] },
  { name: 'Universal Standard', industry: 'Fashion',          hq: 'New York, USA',     mark: 'U', about: 'Size-inclusive apparel for everyone, sized 00–40.',            cats: ['Fashion', 'Lifestyle'] },
  { name: 'Outdoor Voices',   industry: 'Athletic apparel',   hq: 'Austin, USA',       mark: 'O', about: 'Doing things, together.',                                       cats: ['Wellness', 'Fashion'] },
  { name: 'Gymshark',         industry: 'Athletic apparel',   hq: 'Solihull, UK',      mark: 'G', about: 'Conditioning apparel for the strongest version of you.',       cats: ['Wellness', 'Fashion'] },
  { name: 'Beats',            industry: 'Audio',              hq: 'Los Angeles, USA',  mark: 'B', about: 'Sound-engineered for everyday and elite athletes.',             cats: ['Tech'] },
  { name: 'Sonos',            industry: 'Audio',              hq: 'Santa Barbara, USA',mark: 'S', about: 'Smart home audio designed for great sound.',                    cats: ['Tech', 'Interiors'] },
  { name: 'Bose',             industry: 'Audio',              hq: 'Framingham, USA',   mark: 'B', about: 'Better sound through research.',                                 cats: ['Tech'] },
  { name: 'Apple',            industry: 'Tech',               hq: 'Cupertino, USA',    mark: 'A', about: 'Designed in California.',                                        cats: ['Tech', 'Lifestyle'] },
  { name: 'Brilliant Earth',  industry: 'Jewelry',            hq: 'San Francisco, USA',mark: 'B', about: 'Beyond conflict-free fine jewelry, ethically sourced.',         cats: ['Fashion', 'Sustainability'] },
  { name: 'Mejuri',           industry: 'Jewelry',            hq: 'Toronto, CA',       mark: 'M', about: 'Fine jewelry for everyday wear.',                                cats: ['Fashion', 'Lifestyle'] },
  { name: 'Catbird',          industry: 'Jewelry',            hq: 'Brooklyn, USA',     mark: 'C', about: 'Brooklyn-made jewelry and gifts.',                               cats: ['Fashion', 'Lifestyle'] },
  { name: 'Smeg',             industry: 'Appliances',         hq: 'Reggio Emilia, IT', mark: 'S', about: 'Italian-designed kitchen appliances.',                           cats: ['Food', 'Interiors', 'Design'] },
  { name: 'Our Place',        industry: 'Cookware',           hq: 'Los Angeles, USA',  mark: 'O', about: 'Modern cookware made for the way you cook today.',              cats: ['Food', 'Lifestyle'] },
  { name: 'Great Jones',      industry: 'Cookware',           hq: 'New York, USA',     mark: 'G', about: 'Direct-to-consumer cookware for home cooks.',                   cats: ['Food', 'Lifestyle'] },
  { name: 'Trade Coffee',     industry: 'Coffee',             hq: 'Brooklyn, USA',     mark: 'T', about: 'Personalised coffee subscriptions from top roasters.',          cats: ['Food', 'Lifestyle'] },
  { name: 'Death Wish',       industry: 'Coffee',             hq: 'New York, USA',     mark: 'D', about: 'World\'s strongest coffee.',                                    cats: ['Food'] },
  { name: 'Magic Spoon',      industry: 'Snacks',             hq: 'New York, USA',     mark: 'M', about: 'High-protein cereals that taste like the box.',                cats: ['Food', 'Wellness'] },
  { name: 'Liquid Death',     industry: 'Beverages',          hq: 'Los Angeles, USA',  mark: 'L', about: 'Mountain water in a tall boy can. Murder your thirst.',         cats: ['Food', 'Lifestyle'] },
  { name: 'Recess',           industry: 'Beverages',          hq: 'Los Angeles, USA',  mark: 'R', about: 'Calm cans with adaptogens and hemp.',                            cats: ['Wellness', 'Food'] },
  { name: 'Boll & Branch',    industry: 'Home textiles',      hq: 'Summit, USA',       mark: 'B', about: 'Organic cotton bedding and bath, ethically made.',              cats: ['Interiors', 'Sustainability'] },
  { name: 'Brooklinen',       industry: 'Home textiles',      hq: 'Brooklyn, USA',     mark: 'B', about: 'Direct-to-consumer luxury sheets and towels.',                  cats: ['Interiors', 'Lifestyle'] },
  { name: 'Parachute',        industry: 'Home',               hq: 'Los Angeles, USA',  mark: 'P', about: 'Premium home essentials made from natural materials.',          cats: ['Interiors', 'Sustainability', 'Lifestyle'] },
  { name: 'Article',          industry: 'Furniture',          hq: 'Vancouver, CA',     mark: 'A', about: 'Modern furniture designed for everyday life.',                  cats: ['Interiors', 'Design'] },
  { name: 'West Elm',         industry: 'Furniture',          hq: 'Brooklyn, USA',     mark: 'W', about: 'Modern furniture and home decor.',                              cats: ['Interiors', 'Design'] },
  { name: 'Casper',           industry: 'Sleep',              hq: 'New York, USA',     mark: 'C', about: 'Sleep solutions for the better mornings ahead.',                cats: ['Wellness', 'Interiors'] },
  { name: 'Bombas',           industry: 'Apparel',            hq: 'New York, USA',     mark: 'B', about: 'Comfort-first socks and tees that give back.',                  cats: ['Fashion', 'Sustainability'] },
  { name: 'Vuori',            industry: 'Athletic apparel',   hq: 'Encinitas, USA',    mark: 'V', about: 'Performance apparel inspired by the active coastal lifestyle.', cats: ['Wellness', 'Fashion'] },
  { name: 'Tracksmith',       industry: 'Athletic apparel',   hq: 'Boston, USA',       mark: 'T', about: 'Running apparel with a literary soul.',                          cats: ['Wellness', 'Fashion'] },
  { name: 'TenThousand',      industry: 'Athletic apparel',   hq: 'Los Angeles, USA',  mark: 'T', about: 'Training-grade apparel built for the work.',                     cats: ['Wellness'] },
  { name: 'Allset',           industry: 'Tech / Lifestyle',   hq: 'Lahore, PK',        mark: 'A', about: 'Local startups and apps made in Pakistan.',                      cats: ['Tech', 'Lifestyle'] },
  { name: 'Bykea',            industry: 'Mobility',           hq: 'Karachi, PK',       mark: 'B', about: 'Karachi\'s favourite ride-and-delivery app.',                    cats: ['Tech', 'Lifestyle'] },
  { name: 'Sapphire Home',    industry: 'Home textiles',      hq: 'Lahore, PK',        mark: 'S', about: 'Pakistan\'s home and lifestyle line from the Sapphire group.', cats: ['Interiors', 'Lifestyle'] },
];

// ============ CAMPAIGN TITLE TEMPLATES ============
const CAMPAIGN_TEMPLATES: Record<string, string[]> = {
  Beauty:        ['Spring Renewal', 'Daily Ritual', 'Glow Up', 'Quiet Mornings', 'Restore Edit', 'New Skin Notes'],
  Food:          ['Slow Sundays', 'Heritage Recipes', 'Weeknight Wonders', 'Garden Dinners', 'Sunday Suppers', 'Pantry Pulls'],
  Fashion:       ['Spring Capsule', 'Holiday Wardrobe', 'Slow Style', 'Weekday Closet', 'Editorial Drop', 'Made to Last'],
  Travel:        ['Hidden Cities', 'Local Favourites', 'Long Weekend', 'Off-Map Notes', 'Stay Slow'],
  Design:        ['Studio Notes', 'Quiet Objects', 'Considered Spaces', 'Workshop Stories', 'Hand & Eye'],
  Lifestyle:     ['Morning Pages', 'Evening Hours', 'The Slow Edit', 'Small Joys', 'Indoor Days'],
  Wellness:      ['Daily Practice', 'Reset Week', 'Restore Routine', 'Mindful Mondays'],
  Sustainability:['Buy Less Better', 'Repair Stories', 'Long Use Diaries', 'Mend Notes'],
  Tech:          ['Workflow', 'Setup Tour', 'Tool Notes', 'Built in Public'],
  Interiors:     ['Small Flats', 'Older Homes', 'Light & Air', 'Considered Rooms'],
};

const BRIEF_TEMPLATES = [
  'We\'re looking for {n} {category} creators to feature {pkg} through {deliv}. Soft, natural light. Authentic morning routines preferred.',
  'A {n}-creator campaign for {pkg}. Brand mention in caption only — no hashtags forced. Looking for {category} creators with strong visual style.',
  'Looking for one creator to anchor a {category} feature for {pkg}. {deliv}. Long-form storytelling preferred over flashy.',
  'Studio shots and lifestyle context for {pkg}. {deliv}. Quiet palette, no neon, no maximalism.',
  'For our {pkg} launch we want {n} {category} creators. {deliv}. Authentic use over polished review.',
];

// ============ HAND-CURATED DEMO ACCOUNTS ============
const DEMO_USERS: User[] = [
  { id: 'u_sarah',  email: 'sarah@alamut.test',  passwordHash: 'demo1234', role: 'creator', status: 'active', createdAt: dayAgo(120), creatorId: 'c_sarah' },
  { id: 'u_amir',   email: 'amir@alamut.test',   passwordHash: 'demo1234', role: 'creator', status: 'active', createdAt: dayAgo(90),  creatorId: 'c_amir' },
  { id: 'u_yuki',   email: 'yuki@alamut.test',   passwordHash: 'demo1234', role: 'creator', status: 'active', createdAt: dayAgo(60),  creatorId: 'c_yuki' },
  { id: 'u_hannah', email: 'hannah@aesop.test',  passwordHash: 'demo1234', role: 'brand',   status: 'active', createdAt: dayAgo(180), brandId: 'b_aesop',     teamRole: 'admin' },
  { id: 'u_thom',   email: 'thom@aesop.test',    passwordHash: 'demo1234', role: 'brand',   status: 'active', createdAt: dayAgo(60),  brandId: 'b_aesop',     teamRole: 'ops',    invitedAt: dayAgo(60) },
  { id: 'u_finn',   email: 'finance@aesop.test', passwordHash: 'demo1234', role: 'brand',   status: 'active', createdAt: dayAgo(45),  brandId: 'b_aesop',     teamRole: 'finance', invitedAt: dayAgo(45) },
  { id: 'u_marcus', email: 'marcus@lecreuset.test', passwordHash: 'demo1234', role: 'brand', status: 'active', createdAt: dayAgo(140), brandId: 'b_lecreuset', teamRole: 'admin' },
  // P5 §4.2 — platform admin gets the 'super' role explicitly so the
  // permissions module's seed-time check resolves to all capabilities.
  // The migrator backfills this for any pre-P5 admin without the field.
  { id: 'u_admin',  email: 'admin@alamut.test',  passwordHash: 'demo1234', role: 'admin',   status: 'active', createdAt: dayAgo(365), adminRoles: ['super'] },
];

const DEMO_CREATORS: Creator[] = [
  {
    id: 'c_sarah', userId: 'u_sarah',
    name: 'Sarah Johnson', handle: '@sarahstyle',
    tagline: 'Sustainable fashion & conscious living.',
    bio: 'Editor-turned-creator building a community around quiet luxury, slow fashion, and things worth keeping.',
    city: 'New York', country: 'USA', languages: ['English'],
    categories: ['Fashion', 'Lifestyle', 'Sustainability'],
    portrait: upx(PORTRAITS[0], 600, 750),
    platforms: [
      { name: 'Instagram', handle: '@sarahstyle', followers: 142_000, engagement: 5.2, verified: true,
        audience: {
          ageBuckets: { '13-17': 0.02, '18-24': 0.28, '25-34': 0.41, '35-44': 0.18, '45-54': 0.08, '55+': 0.03 },
          genderSplit: { female: 0.78, male: 0.18, other: 0.04 },
          topCountries: [
            { country: 'United States', pct: 0.52 }, { country: 'United Kingdom', pct: 0.16 },
            { country: 'Canada', pct: 0.10 }, { country: 'Australia', pct: 0.08 }, { country: 'Germany', pct: 0.06 },
          ],
          growthRate30d: 4.2, suspiciousFollowerPct: 1.8, audienceCredibilityScore: 96,
        }
      },
      { name: 'TikTok', handle: '@sarahstyle', followers: 58_000, engagement: 7.1, verified: true,
        audience: {
          ageBuckets: { '13-17': 0.08, '18-24': 0.42, '25-34': 0.32, '35-44': 0.12, '45-54': 0.04, '55+': 0.02 },
          genderSplit: { female: 0.71, male: 0.25, other: 0.04 },
          topCountries: [
            { country: 'United States', pct: 0.48 }, { country: 'United Kingdom', pct: 0.14 },
            { country: 'Canada', pct: 0.12 }, { country: 'Mexico', pct: 0.07 }, { country: 'Brazil', pct: 0.05 },
          ],
          growthRate30d: 11.6, suspiciousFollowerPct: 3.2, audienceCredibilityScore: 92,
        }
      },
      { name: 'Newsletter', handle: 'sarahstyle.substack.com', followers: 8_400, engagement: 42, verified: false },
    ],
    reach: 208_400, engagement: 5.2, rating: 4.9, tier: 'Flagship',
    responseHrs: 3,
    rateCard: { post: '$800–1,500', reel: '$1,000–2,000', story: '$300–600', longform: '—' },
    // Phase 59 — per-platform rate cards for the Storefront packages
    // block. Pre-fix Sarah's storefront fell through to the legacy
    // single `rateCard` field above, so the brand viewing her public
    // page saw only one row.
    rateCards: [
      { id: 'rc_sarah_1', platform: 'Instagram', format: 'reel', rate: '$1,400–2,000', notes: '90-second narrative · 9:16 · 1 round of revisions included' },
      { id: 'rc_sarah_2', platform: 'Instagram', format: 'story', rate: '$300–500', notes: '3-frame swipe-up · brand handle + #ad' },
      { id: 'rc_sarah_3', platform: 'Instagram', format: 'post', rate: '$900–1,400', notes: 'Carousel up to 8 frames · permanent grid placement' },
      { id: 'rc_sarah_4', platform: 'TikTok',    format: 'reel', rate: '$1,100–1,800', notes: 'Hook-led, sound-on, max 60s · platform-native edit' },
      { id: 'rc_sarah_5', platform: 'Newsletter', format: 'longform', rate: '$2,200',     notes: 'Dedicated send to 8.4k engaged subscribers · 1 main link' },
      { id: 'rc_sarah_6', platform: 'All platforms', format: 'bundle',  rate: '$3,800',     notes: 'Reel + 3 stories + carousel · best value combo' },
    ],
    payout: { method: 'ACH', account: 'Chase ••• 4421', currency: 'USD' },
    walletBalance: 4200, pendingBalance: 3400, lifetimeEarnings: 47_800,
    verified: true,
    pressMentions: [
      { source: 'Vogue', title: 'The new wave of sustainable creators', year: 2025 },
      { source: 'The Cut', title: '10 creators changing fashion media', year: 2024 },
      { source: 'Business of Fashion', title: 'Closet refresh: lasting style picks', year: 2024 },
    ],
    pastClients: ['Aesop', 'Glossier', 'Le Labo', 'Reformation', 'Everlane', 'Mejuri'],
    availability: { status: 'limited', untilDate: dayAhead(30), note: 'Booked for May — open from June 1.' },
    // Phase 59 — Sarah's storefront portfolio (was getting nuked by
    // Supabase overlay; overlay now preserves local). 6 representative
    // shots that mirror what a fashion creator would publish.
    work: [
      upx(COVERS[0], 600, 600), upx(COVERS[1], 600, 600), upx(COVERS[2], 600, 600),
      upx(COVERS[3], 600, 600), upx(COVERS[4], 600, 600), upx(COVERS[5], 600, 600),
    ],
    // Phase 59 — top 3 reviews pinned to Sarah's public storefront so
    // the "Featured" carousel renders something on first paint.
    // These IDs reference reviews seeded later in this file.
    featuredReviewIds: ['rv_s1', 'rv_s2', 'rv_s3'],
    // Phase 59 — saved briefs so CreatorHome's "Saved for later" tile
    // surfaces (was hidden when empty). Mix of Aesop + Le Creuset
    // briefs + a couple of generated campaigns to show variety.
    savedBriefs: ['cmp_3', 'cmp_4', 'cmp_g8', 'cmp_g10', 'cmp_g12'],
    // Demo-seed storefront pulse — Sarah is our hero creator account so
    // these numbers are tuned to look healthy in any walkthrough. The
    // brand-viewer names mix real catalog brands with plausible cold
    // viewers (PR agencies / brand-side teams that read storefronts
    // before reaching out).
    storefrontViewsLast30d: 2140,
    storefrontViewsDeltaPct: 28,
    brandInquiriesThisWeek: 14,
    brandInquiriesDelta: 4,
    recentBrandViewerNames: ['Aesop', 'Glossier', 'Le Labo', 'Reformation', 'Everlane', 'Mejuri', 'Cuyana', 'Outdoor Voices', 'Sézane', 'Vuori', 'Quince', 'Buffy'],
    recentBrandViewerCount: 12,
  },
  {
    id: 'c_amir', userId: 'u_amir',
    name: 'Amir Hussain', handle: '@amircooks',
    tagline: 'Modern South Asian food, properly made.',
    bio: 'Karachi-born, London-trained chef sharing recipes from the home kitchens I grew up in.',
    city: 'Lahore', country: 'Pakistan', languages: ['English', 'Urdu'],
    categories: ['Food', 'Lifestyle', 'Travel'],
    portrait: upx(PORTRAITS[1], 600, 750),
    work: [upx(COVERS[8], 600, 600), upx(COVERS[9], 600, 600), upx(COVERS[10], 600, 600)],
    platforms: [
      { name: 'Instagram', handle: '@amircooks', followers: 89_000, engagement: 6.4, verified: true },
      { name: 'YouTube',   handle: 'AmirCooks',  followers: 24_000, engagement: 4.1, verified: true },
    ],
    reach: 113_000, engagement: 5.6, rating: 4.8, tier: 'Specialist',
    responseHrs: 6,
    rateCard: { post: '$500–900', reel: '$700–1,400', story: '$200–400', longform: '$2,000+' },
    payout: { method: 'Wise', account: 'Wise USD ••• 8821', currency: 'USD' },
    walletBalance: 1800, pendingBalance: 2200, lifetimeEarnings: 18_400,
    verified: true,
    pressMentions: [{ source: 'Dawn', title: 'Recipes worth keeping', year: 2024 }],
    pastClients: ['Le Creuset', 'National Foods'],
    storefrontViewsLast30d: 1480,
    storefrontViewsDeltaPct: 12,
    brandInquiriesThisWeek: 8,
    brandInquiriesDelta: 2,
    recentBrandViewerNames: ['Le Creuset', 'National Foods', 'Foodpanda', 'Daraz', 'Krave Mart', 'Tossdown', 'Khaadi'],
    recentBrandViewerCount: 7,
  },
  {
    id: 'c_yuki', userId: 'u_yuki',
    name: 'Yuki Tanaka', handle: '@yuki.makes',
    tagline: 'Quiet objects, considered design.',
    bio: 'Industrial designer documenting workshop life and the things that come out of it.',
    city: 'Kyoto', country: 'Japan', languages: ['Japanese', 'English'],
    categories: ['Design', 'Lifestyle', 'Interiors'],
    portrait: upx(PORTRAITS[2], 600, 750),
    work: [upx(COVERS[11], 600, 600), upx(COVERS[12], 600, 600)],
    platforms: [
      { name: 'Instagram', handle: '@yuki.makes', followers: 64_000, engagement: 8.1, verified: true },
      { name: 'YouTube',   handle: 'YukiMakes',   followers: 18_000, engagement: 6.5, verified: true },
    ],
    reach: 82_000, engagement: 7.3, rating: 4.95, tier: 'Specialist',
    responseHrs: 8,
    rateCard: { post: '$600–1,100', reel: '$900–1,800', story: '$250–500', longform: '$2,500+' },
    payout: { method: 'Stripe', account: 'Stripe Connect (JP)', currency: 'JPY' },
    walletBalance: 0, pendingBalance: 1500, lifetimeEarnings: 9_800,
    verified: true,
    pressMentions: [{ source: 'Apartamento', title: 'Workshop in Kyoto', year: 2024 }],
    pastClients: ['Muji'],
    availability: { status: 'open', note: 'Open for design + lifestyle briefs through Q2.' },
    storefrontViewsLast30d: 920,
    storefrontViewsDeltaPct: 41,
    brandInquiriesThisWeek: 6,
    brandInquiriesDelta: 3,
    recentBrandViewerNames: ['Muji', 'Snow Peak', 'Postalco', 'Hender Scheme', 'D&Department', 'Beams', 'Aesop'],
    recentBrandViewerCount: 7,
  },
];

const DEMO_BRANDS: Brand[] = [
  {
    id: 'b_aesop', userId: 'u_hannah',
    name: 'Aesop', industry: 'Beauty / Personal care', hq: 'Melbourne, AU',
    website: 'aesop.com', logoMark: 'A',
    about: 'Aesop has carefully curated a range of skin, hair and body care formulations.',
    preferredCategories: ['Lifestyle', 'Beauty', 'Wellness', 'Design'],
    preferredRegions: ['US', 'UK', 'EU', 'APAC'],
    walletBalance: 48_200, escrowHeld: 5_400,
    verified: true,
    // Phase 59 — expanded shortlist so Discover's "favorites" filter +
    // Spark's seeded shortlist context have meaningful content for a
    // demo walk-through. Mixes the named demo creators (Sarah, Yuki)
    // with generated ones so cross-section coverage is real.
    savedCreators: ['c_sarah', 'c_yuki', 'c_gc01', 'c_gc05', 'c_gc12', 'c_gc18', 'c_gc24', 'c_gc31'],
    // Phase 59 — offer templates so the brand-side SendOffer modal's
    // templates dropdown isn't empty on first open. Three common shapes
    // covering single-reel deals, multi-deliverable packs, and the
    // newsletter sponsor format Aesop runs quarterly.
    offerTemplates: [
      {
        id: 'tpl_aesop_1',
        name: 'Standard Reel',
        rate: 1500,
        message: 'We\'d love to have you on this campaign. Standard rate for a 1 Reel + 2 Stories deliverable — let me know if it\'s a fit.',
        deliverables: '1 Reel + 2 Stories',
        createdAt: dayAgo(45),
      },
      {
        id: 'tpl_aesop_2',
        name: 'Premium Story Pack',
        rate: 2400,
        message: 'Premium package: 1 Reel + 5 Stories + 1 carousel post, with a 1-week exclusivity window in the beauty category. Higher rate to match.',
        deliverables: '1 Reel + 5 Stories + 1 Post',
        createdAt: dayAgo(30),
      },
      {
        id: 'tpl_aesop_3',
        name: 'Newsletter Sponsor',
        rate: 3200,
        message: 'Dedicated newsletter feature with a main link + 2-paragraph editorial. Premium rate for primary sponsor placement.',
        deliverables: '1 Newsletter feature + 1 IG Story',
        createdAt: dayAgo(14),
      },
    ],
    // Phase 58 — preferred-tier + budget signals captured from
    // BrandOnboardingV2. Aesop targets the Flagship segment for its
    // premium positioning; monthly budget anchors the campaign budget
    // defaults the wizard suggests.
    preferredCreatorTier: '$$$',
    monthlyBudgetBand: '$20k–50k / month',
  },
  {
    id: 'b_lecreuset', userId: 'u_marcus',
    name: 'Le Creuset', industry: 'Home / Kitchenware', hq: 'Fresnoy-le-Grand, FR',
    website: 'lecreuset.com', logoMark: 'L',
    about: 'Cast iron cookware and culinary tools handcrafted in France since 1925.',
    preferredCategories: ['Food', 'Lifestyle', 'Design'],
    preferredRegions: ['US', 'UK', 'EU', 'LATAM'],
    walletBalance: 22_800, escrowHeld: 0,
    verified: true,
    savedCreators: ['c_amir'],
  },
];

// ============ GENERATE EXTRA CREATORS ============

const TIERS_DIST = [
  { tier: 'Flagship' as const,  count: 14 },
  { tier: 'Specialist' as const, count: 38 },
  { tier: 'Rising' as const,    count: 55 },
];

function genHandle(name: string): string {
  const parts = name.toLowerCase().replace(/[^a-z\s-]/g, '').split(/\s+/);
  if (chance(0.3)) return '@' + parts.join('');
  if (chance(0.5)) return '@' + parts[0] + '.' + (parts[1] || '');
  return '@' + parts[0] + (parts[1] ? parts[1].slice(0, 4) : '');
}

// Generate realistic audience demographics for a connected platform.
// Fraud/quality skews by tier — flagship tier has cleaner audiences on average.
function genAudience(tier: 'Rising' | 'Specialist' | 'Flagship', country: string): AudienceDemographics {
  const ages = (() => {
    const buckets: AudienceDemographics['ageBuckets'] = {
      '13-17': +(rng() * 0.05).toFixed(2),
      '18-24': +(0.20 + rng() * 0.15).toFixed(2),
      '25-34': +(0.30 + rng() * 0.15).toFixed(2),
      '35-44': +(0.15 + rng() * 0.10).toFixed(2),
      '45-54': +(0.05 + rng() * 0.08).toFixed(2),
      '55+':   +(0.02 + rng() * 0.05).toFixed(2),
    };
    // normalize to sum to 1
    const sum = Object.values(buckets).reduce((s, v) => s + (v || 0), 0);
    Object.keys(buckets).forEach((k) => {
      const key = k as keyof AudienceDemographics['ageBuckets'];
      const v = buckets[key]; if (v != null) buckets[key] = +(v / sum).toFixed(3);
    });
    return buckets;
  })();
  const female = +(0.40 + rng() * 0.50).toFixed(2);
  const male   = +((1 - female) * (0.85 + rng() * 0.13)).toFixed(2);
  const other  = +(1 - female - male).toFixed(2);

  const homeCountries: Record<string, string[]> = {
    Pakistan: ['Pakistan', 'United Arab Emirates', 'Saudi Arabia', 'United Kingdom', 'United States'],
    India:    ['India', 'United States', 'United Arab Emirates', 'United Kingdom', 'Canada'],
    USA:      ['United States', 'United Kingdom', 'Canada', 'Australia', 'Germany'],
    UK:       ['United Kingdom', 'United States', 'Ireland', 'Canada', 'Australia'],
    Japan:    ['Japan', 'United States', 'South Korea', 'Taiwan', 'United Kingdom'],
  };
  const home = homeCountries[country] || homeCountries.USA;
  const homePcts = [0.55, 0.18, 0.12, 0.08, 0.07];
  const topCountries = home.map((c, i) => ({ country: c, pct: +homePcts[i].toFixed(2) }));

  const baseSuspicious = tier === 'Flagship' ? 2 : tier === 'Specialist' ? 5 : 9;
  const suspiciousFollowerPct = +(baseSuspicious + rng() * 6).toFixed(1);
  const audienceCredibilityScore = Math.round(100 - suspiciousFollowerPct * 1.8);

  return {
    ageBuckets: ages,
    genderSplit: { female, male, other },
    topCountries,
    growthRate30d: +(-2 + rng() * 9).toFixed(1),
    suspiciousFollowerPct,
    audienceCredibilityScore,
  };
}

function genPlatforms(tier: 'Rising' | 'Specialist' | 'Flagship', country = 'USA'): Platform[] {
  const sizes: Record<string, [number, number]> = {
    Rising:     [3_000, 30_000],
    Specialist: [25_000, 150_000],
    Flagship:   [120_000, 900_000],
  };
  const [min, max] = sizes[tier];
  const numPlatforms = tier === 'Flagship' ? range(2, 4) : range(1, 3);
  const picked = [...PLATFORM_NAMES].sort(() => rng() - 0.5).slice(0, numPlatforms);
  return picked.map((p) => ({
    name: p,
    handle: '@' + ('user' + range(100, 9999)),
    followers: range(min, max),
    engagement: +(rng() * 7 + 1).toFixed(1),
    verified: tier === 'Flagship' ? chance(0.9) : chance(0.5),
    audience: chance(0.85) ? genAudience(tier, country) : undefined,
  }));
}

function genCreator(idx: number, name: string, tier: 'Rising' | 'Specialist' | 'Flagship'): { user: User; creator: Creator } {
  const userId = `u_gc${idx.toString().padStart(2, '0')}`;
  const creatorId = `c_gc${idx.toString().padStart(2, '0')}`;
  const [city, country] = pick(CITIES);
  const cats = [...CATEGORIES_POOL].sort(() => rng() - 0.5).slice(0, range(2, 3));
  const langs = [...LANGUAGES_POOL].sort(() => rng() - 0.5).slice(0, range(1, 3));
  const platforms = genPlatforms(tier, country);
  const reach = platforms.reduce((s, p) => s + p.followers, 0);
  const engagement = +(platforms.reduce((s, p) => s + p.engagement, 0) / platforms.length).toFixed(1);
  const portrait = upx(PORTRAITS[idx % PORTRAITS.length], 600, 750);
  const workCount = tier === 'Rising' ? range(1, 3) : tier === 'Specialist' ? range(3, 5) : range(4, 6);
  const work = Array.from({ length: workCount }, (_, i) => upx(COVERS[(idx + i) % COVERS.length], 600, 600));
  const rateBase = tier === 'Rising' ? 250 : tier === 'Specialist' ? 700 : 1500;
  const rateCard = {
    post: `$${rateBase}–${rateBase * 2}`,
    reel: `$${Math.round(rateBase * 1.4)}–${rateBase * 3}`,
    story: `$${Math.round(rateBase * 0.4)}–${Math.round(rateBase * 0.7)}`,
    longform: tier === 'Rising' ? '—' : `$${rateBase * 3}+`,
  };
  const lifetimeEarnings = tier === 'Rising' ? range(0, 6_000) : tier === 'Specialist' ? range(8_000, 35_000) : range(35_000, 200_000);
  const tagline = pick(TAGLINES_BY_CAT[cats[0]] || TAGLINES_BY_CAT.Lifestyle);

  return {
    user: {
      id: userId, email: `${name.toLowerCase().replace(/\s+/g, '.').replace(/[^a-z.-]/g, '')}@alamut.test`,
      passwordHash: 'demo1234', role: 'creator', status: 'active',
      createdAt: dayAgo(range(15, 540)), creatorId,
    },
    creator: {
      id: creatorId, userId,
      name, handle: genHandle(name),
      tagline,
      bio: tagline + ' Based in ' + city + '. Open to selective brand work.',
      city, country, languages: langs, categories: cats,
      portrait, work, platforms,
      reach, engagement,
      rating: +(3.8 + rng() * 1.2).toFixed(2),
      tier, responseHrs: range(1, tier === 'Flagship' ? 12 : 24),
      rateCard,
      payout: chance(0.5)
        ? { method: 'Wise', account: 'Wise ••• ' + range(1000, 9999), currency: 'USD' }
        : { method: 'ACH', account: 'Bank ••• ' + range(1000, 9999), currency: 'USD' },
      walletBalance: 0, pendingBalance: 0, lifetimeEarnings,
      verified: tier === 'Flagship' ? true : chance(0.6),
      // P6 §5.6 — `profileCompletion` is computed on read via
      // `lib/utils/profile-completion.ts`; no longer stored.
      pressMentions: [],
      // pastClients seeded by tier so storefronts feel populated.
      // Rising: 1–2 brands, Specialist: 2–4, Flagship: 3–5. Dedupe so
      // we don't show the same brand twice when picks collide.
      pastClients: (() => {
        const targetCount = tier === 'Flagship' ? range(3, 5)
          : tier === 'Specialist' ? range(2, 4)
          : range(1, 2);
        const picked = new Set<string>();
        for (let i = 0; i < targetCount * 3 && picked.size < targetCount; i++) {
          picked.add(pick(BRAND_POOL).name);
        }
        return Array.from(picked);
      })(),
      // Availability seeded for every creator so the brand-side
      // "open / limited / booked" filter on Discover has real signal
      // to work with. 70/20/10 split mirrors the audit recommendation.
      availability: (() => {
        const r = rng();
        if (r < 0.7) return { status: 'open' as const, note: 'Open for briefs' };
        if (r < 0.9) return { status: 'limited' as const, untilDate: dayAhead(range(7, 45)), note: 'Limited slots — book early' };
        return { status: 'booked' as const, untilDate: dayAhead(range(20, 90)), note: 'Fully booked this period' };
      })(),
      // Storefront-pulse demo metrics — scaled by tier so the CreatorHome
      // pulse tiles tell a credible story per creator. Flagship creators
      // get the biggest view + inquiry numbers; Rising creators get
      // smaller but non-zero ones so the UI never shows an empty pulse.
      ...(() => {
        const tierMul = tier === 'Flagship' ? 1 : tier === 'Specialist' ? 0.45 : 0.18;
        const views = Math.round((800 + rng() * 2400) * tierMul);
        const viewerCount = Math.max(2, Math.round((4 + rng() * 16) * tierMul));
        const viewerSample = [...BRAND_POOL].sort(() => rng() - 0.5).slice(0, Math.min(viewerCount, 12)).map((b) => b.name);
        return {
          storefrontViewsLast30d: views,
          storefrontViewsDeltaPct: Math.round(-10 + rng() * 60),
          brandInquiriesThisWeek: Math.max(1, Math.round((3 + rng() * 14) * tierMul)),
          brandInquiriesDelta: Math.round(-2 + rng() * 8),
          recentBrandViewerNames: viewerSample,
          recentBrandViewerCount: viewerCount,
        };
      })(),
    },
  };
}

// Build name pool, dedupe, pick one per generated creator
const allCreatorNames: string[] = [];
for (const f of FIRST_NAMES) {
  for (const l of LAST_NAMES) {
    allCreatorNames.push(`${f} ${l}`);
  }
}
allCreatorNames.sort(() => rng() - 0.5);

const generatedCreators: { user: User; creator: Creator }[] = [];
let nameIdx = 0;
TIERS_DIST.forEach(({ tier, count }) => {
  for (let i = 0; i < count; i++) {
    generatedCreators.push(genCreator(generatedCreators.length, allCreatorNames[nameIdx++], tier));
  }
});

// ============ GENERATE EXTRA BRANDS ============
function genBrand(spec: BrandSpec, idx: number): { user: User; brand: Brand } {
  const userId = `u_gb${idx.toString().padStart(2, '0')}`;
  const brandId = `b_gb${idx.toString().padStart(2, '0')}`;
  const balance = range(5_000, 80_000);
  return {
    user: {
      id: userId,
      email: `ops@${spec.name.toLowerCase().replace(/[^a-z]/g, '')}.test`,
      passwordHash: 'demo1234', role: 'brand', status: 'active',
      createdAt: dayAgo(range(30, 720)), brandId,
    },
    brand: {
      id: brandId, userId,
      name: spec.name, industry: spec.industry, hq: spec.hq,
      website: spec.name.toLowerCase().replace(/[^a-z]/g, '') + '.com',
      about: spec.about, logoMark: spec.mark,
      preferredCategories: spec.cats,
      preferredRegions: ['US', 'UK', 'EU', 'APAC'].slice(0, range(2, 4)),
      walletBalance: balance, escrowHeld: 0,
      verified: chance(0.85),
      savedCreators: [],
    },
  };
}

const generatedBrands: { user: User; brand: Brand }[] = BRAND_POOL
  .filter((b) => b.name !== 'Aesop' && b.name !== 'Le Creuset')
  .map((spec, i) => genBrand(spec, i));

// ============ GENERATE CAMPAIGNS ============
// Internal progress driver — pre-P1b 8-stage values. Used by `genCampaign`
// to decide how deep to populate apps/offers/submissions/transactions.
// NOT the same as `Campaign.stage` (P1b §1.2 collapsed that to 4 values).
type InternalProgress =
  | 'draft' | 'live' | 'shortlist' | 'offer'
  | 'production' | 'posted' | 'reporting' | 'closed';

// Year+ of activity. Heavy on closed (historical activity), substantial on
// live (current activity), so the demo has both depth and forward motion.
//
// P1b §1.2 collapsed the stage enum from 8 values to 4: per-collab progress
// (shortlist / offer / production / posted / reporting) now lives on
// Collaboration (P1c). Generated campaigns keep the same TOTAL count
// (~205) so demo density doesn't change; the old stage columns are
// re-pooled into 'live'. Each generated campaign still carries an
// `internalProgress` hint that genCampaign uses to populate apps/offers/
// submissions/transactions at the right depth — that's how a "production"
// campaign still ends up with submissions even though Campaign.stage is
// now just 'live'.
const STAGE_DISTRIBUTION: Array<{ stage: CampaignStage; internalProgress: InternalProgress; count: number }> = [
  // Halved-and-then-some. 205 background campaigns (138 live) made Browse
  // Briefs a wall a visitor scrolls past rather than reads, and buried the
  // hand-authored demo campaigns that actually tell the story. The mix is
  // preserved — every progress level still appears — only the volume drops.
  { stage: 'draft',  internalProgress: 'draft',      count: 5 },
  { stage: 'live',   internalProgress: 'live',       count: 12 },
  { stage: 'live',   internalProgress: 'shortlist',  count: 9 },
  { stage: 'live',   internalProgress: 'offer',      count: 7 },
  { stage: 'live',   internalProgress: 'production', count: 9 },
  { stage: 'live',   internalProgress: 'posted',     count: 6 },
  { stage: 'live',   internalProgress: 'reporting',  count: 5 },
  { stage: 'closed', internalProgress: 'closed',     count: 22 },
];

// Pitch + message templates for richer text.
const PITCH_TEMPLATES = [
  '{cat} feels like a natural fit for my audience — strong overlap with my recent {kind} work. Could deliver in 7 days.',
  'Loved your last campaign — happy to bring that same considered energy to mine. 2 concept directions inside.',
  'I run a {place}-based audience that over-indexes on {cat}. Engagement consistently above 6%.',
  'Open to your direction; have run similar formats with adjacent brands and shipped on time every time.',
  'Pitching a sit-down feature with the product, not a flashy unboxing. Quieter, higher trust.',
  'Recent reel for a similar brand pulled 2.4M views. Happy to share private analytics.',
  'Cinematic shot list, natural light. I\'ll work to your brand book — share style refs with the offer.',
  'Three concepts inside: at-home routine, gift moment, before-bed ritual. Pick one or run all three.',
  'Multi-creator collab if interested — can co-shoot with two other creators in my circle to amplify reach.',
  'Long-form deep-dive YouTube format — 8 min cut + IG carousel + 3 stories. Tight turnaround.',
];

const MESSAGE_TEMPLATES = [
  'Hey — wanted to confirm receipt of the brief. Reading now, will revert by EOD with any questions.',
  'Quick question on the deliverable spec — should the IG carousel match the reel\'s palette or stand alone?',
  'Working on the second still tonight — should have v2 by tomorrow morning.',
  'Sent the moodboard — let me know if direction lands.',
  'Going to push the post by 24h — talent travel issue. Ok?',
  'Approved on our side — push live whenever you\'re ready.',
  'Got the payout cleared — thanks, easy as ever.',
  'Loved the final cut. Sharing internally — likely some commentary by Friday.',
  'Could you tighten the framing on the second story? Brand guideline asks for 1-inch margin.',
  'Final question — preferred caption tone? More editorial vs more conversational?',
  'Brilliant. Final assets uploaded to the campaign. Closing this out shortly.',
  'Thanks for the smooth turn — would love to keep you in the loop on Q3 work as it firms up.',
];

function templateBrief(category: string, brandName: string, deliv: string, n: number): string {
  return pick(BRIEF_TEMPLATES)
    .replace('{n}', String(n))
    .replace('{category}', category.toLowerCase())
    .replace('{pkg}', `the new ${brandName} ${category.toLowerCase()} line`)
    .replace('{deliv}', deliv);
}

const allBrands = [...DEMO_BRANDS, ...generatedBrands.map((b) => b.brand)];
const allCreators = [...DEMO_CREATORS, ...generatedCreators.map((c) => c.creator)];

interface CampaignSeed {
  campaign: Campaign;
  /** Internal progress driver from genCampaign — pre-P1b 8-stage value
   *  used to drive seed depth + downstream notification generation.
   *  Not stored on Campaign; lives only in this seed-side tuple. */
  progress: InternalProgress;
  applications: Application[];
  offers: Offer[];
  submissions: Submission[];
  transactions: Transaction[];
  threads: Thread[];
  messages: import('./types').Message[];
  reviews: import('./types').Review[];
}

// Internal progress driver — pre-P1b 8-stage values. Used by `genCampaign`
// to decide how deep to populate apps/offers/submissions/transactions for
// each generated campaign. NOT the same as `Campaign.stage` (P1b §1.2
// collapsed that to 4 values). Declared locally above STAGE_DISTRIBUTION
// since both reference it.

// How long ago to seed each campaign based on its internal progress.
// Older for closed/reporting, recent for live/shortlist. ~14-month spread.
function seedAgeRange(progress: InternalProgress): [number, number] {
  switch (progress) {
    case 'draft':      return [1, 14];
    case 'live':       return [2, 22];
    case 'shortlist':  return [10, 35];
    case 'offer':      return [18, 50];
    case 'production': return [25, 70];
    case 'posted':     return [35, 110];
    case 'reporting':  return [60, 180];
    case 'closed':     return [70, 420];
  }
}

// Map an internal-progress value to its post-P1b 4-value campaign stage.
function progressToStage(progress: InternalProgress): CampaignStage {
  if (progress === 'draft') return 'draft';
  if (progress === 'closed') return 'closed';
  return 'live'; // live | shortlist | offer | production | posted | reporting
}

/** Count the deliverable slots that migrator 4 will materialize from a
 *  free-form deliverables string ("1 Reel + 2 stories" → 3). Mirrors
 *  `_legacyParseDeliverableSlots` in migrations.ts — only the count
 *  matters here, not the labels, so we keep this minimal instead of
 *  importing the full parser. Used by the posted/reporting/closed
 *  submission seeder to emit one approved submission per slot. */
function countDeliverableSlots(deliv: string | undefined): number {
  if (!deliv) return 1;
  const segments = deliv.split(/\s*\+\s*|\s+and\s+/i);
  let total = 0;
  for (const raw of segments) {
    const seg = raw.trim();
    if (!seg) continue;
    const leading = seg.match(/^(\d+)\s+/);
    const trailing = seg.match(/[×x]\s*(\d+)$/i);
    const parens = seg.match(/\(\s*(\d+)\s+[a-z]+s?\s*\)$/i);
    const count = leading ? parseInt(leading[1], 10)
                : trailing ? parseInt(trailing[1], 10)
                : parens ? parseInt(parens[1], 10)
                : 1;
    total += Math.min(Math.max(count, 1), 10);
  }
  return Math.max(total, 1);
}

function genCampaign(
  idx: number,
  stage: CampaignStage,
  forcedBrand?: Brand,
  preferredApplicantIds?: string[],
  /** Internal progress driver. Defaults to mapping `stage` back to its
   *  old equivalent — but callers (STAGE_DISTRIBUTION, AESOP_PLAN, etc.)
   *  pass an explicit progress so that 'live'-stage campaigns can have
   *  varying depth (some at shortlist depth, some at production depth, etc.). */
  progress: InternalProgress = stage === 'draft' ? 'draft' :
                                stage === 'closed' ? 'closed' :
                                stage === 'paused' ? 'live' : 'live',
): CampaignSeed {
  const brand = forcedBrand || pick(allBrands);
  const cat = pick(brand.preferredCategories.length ? brand.preferredCategories : CATEGORIES_POOL);
  const titles = CAMPAIGN_TEMPLATES[cat] || CAMPAIGN_TEMPLATES.Lifestyle;
  // F28 — de-duplicate per brand, and never date a campaign in the past.
  //
  // Pre-fix the title was `pick(titles)` plus an optional year from
  // `2025 + range(0, 2)`, which produced two problems: the small template
  // pool collided constantly (nine "Studio Notes"-family campaigns
  // existed, including two LIVE ones under the same brand — the brand's
  // own campaign list couldn't be told apart), and the year could land on
  // 2025, so briefs read "Spring Capsule 2025" in 2026.
  //
  // Dedup is per brand on purpose: two different brands both running a
  // "Studio Notes" campaign is realistic, one brand running two is not.
  const title = uniqueCampaignTitle(
    brand.id,
    `${pick(titles)}${chance(0.3) ? ' ' + (NOW.getFullYear() + range(0, 1)) : ''}`,
  );
  const numTargetCreators = range(1, 4);
  const deliv = pick([
    '1 Reel + 2 stories',
    '1 IG post + 1 Reel',
    '1 YouTube long-form + 1 IG post',
    '2 Reels + 4 stories',
    '1 IG carousel + 2 stories',
    '3 stories + 1 IG post',
    '1 long-form blog + 1 IG carousel',
    '4 short videos + 2 stills',
  ]);
  const baseRate = brand.preferredCategories.includes('Beauty') || brand.preferredCategories.includes('Fashion') ? 1500 : 900;
  const budget = baseRate * numTargetCreators * range(2, 6);
  const [ageLow, ageHigh] = seedAgeRange(progress);
  const createdAtAge = range(ageLow, ageHigh);
  const createdAt = dayAgo(createdAtAge);
  const progressOrder: InternalProgress[] = ['draft', 'live', 'shortlist', 'offer', 'production', 'posted', 'reporting', 'closed'];
  const stageIdx = progressOrder.indexOf(progress);

  // History entries — distributed across the campaign's lifetime.
  // P1b §1.2 collapsed Campaign.stage to 4 values, so we map each internal
  // progress step to its 4-value equivalent and dedupe consecutive entries
  // (so a campaign that progressed live → shortlist → offer → production
  // → posted → reporting becomes a single 'live' history entry, since all
  // map to 'live'). The dedupe keeps history readable.
  const progressesSoFar = progressOrder.slice(0, stageIdx + 1);
  const stageStep = createdAtAge / Math.max(progressesSoFar.length, 1);
  const histRaw: Campaign['history'] = progressesSoFar.map((p, i) => ({
    stage: progressToStage(p),
    at: dayAgo(Math.max(1, Math.round(createdAtAge - i * stageStep))),
    by: brand.userId,
  }));
  const hist: Campaign['history'] = histRaw.filter((h, i) => i === 0 || h.stage !== histRaw[i - 1].stage);

  const apps: Application[] = [];
  const offers: Offer[] = [];
  const submissions: Submission[] = [];
  const transactions: Transaction[] = [];
  const threads: Thread[] = [];
  const messages: import('./types').Message[] = [];
  const reviews: import('./types').Review[] = [];
  let acceptedCreators: string[] = [];
  let escrowHeld = 0;
  let spent = 0;
  let postedAt: string | undefined;
  let reach: number | undefined;
  let engagement: number | undefined;

  // ============ APPLICATIONS — much richer (10-25 per campaign) ============
  if (progress !== 'draft') {
    // Was `range(8,18)` / `range(10,25)`, which produced 2,084 `pitched`
    // collaborations — 58% of every collab in the seed — and buried the
    // stages that actually demonstrate the product. A brand kanban should
    // read as a pipeline, not as an inbox of 200 applicants.
    const numApps = progress === 'closed' ? range(3, 6) : range(3, 8);
    // Push preferred applicants (e.g. demo creators) to the front so they're frequently shortlisted/accepted.
    const preferred = (preferredApplicantIds || [])
      .map((id) => allCreators.find((c) => c.id === id))
      .filter((x): x is Creator => !!x);
    const others = [...allCreators]
      .filter((c) => !preferred.some((p) => p.id === c.id))
      .sort(() => rng() - 0.5);
    const applicants = [...preferred, ...others].slice(0, numApps);
    applicants.forEach((cr, i) => {
      const submittedAt = dayAgo(range(Math.max(1, createdAtAge - 8), createdAtAge));
      // First numTargetCreators are shortlisted; rest split between rejected/submitted/withdrawn
      const status: Application['status'] =
        stageIdx >= 2 && i < numTargetCreators + range(1, 3) ? 'shortlisted' :
        // 0.55/0.2 left 1,068 `cancelled` collaborations — 30% of the
        // whole board, and every one of them a dead end a visitor can
        // click into and learn nothing from. Enough remain to show the
        // state exists.
        stageIdx >= 3 && chance(0.25) ? 'rejected' :
        stageIdx >= 4 && chance(0.08) ? 'withdrawn' :
        'submitted';
      const placeStr = cr.country.length > 8 ? cr.city : cr.country;
      apps.push({
        id: `app_g${idx}_${i}`,
        campaignId: `cmp_g${idx}`,
        creatorId: cr.id,
        pitch: pick(PITCH_TEMPLATES)
          .replace('{cat}', cat)
          .replace('{kind}', deliv.split(' ').slice(1).join(' ').toLowerCase().split('+')[0].trim())
          .replace('{place}', placeStr),
        proposedRate: cr.tier === 'Flagship' ? range(1500, 4500) : cr.tier === 'Specialist' ? range(800, 2400) : range(300, 1100),
        status,
        submittedAt,
        decidedAt: status !== 'submitted' ? dayAgo(range(1, Math.max(2, createdAtAge - 5))) : undefined,
      });
    });
  }

  // ============ OFFERS — to shortlisted creators ============
  if (stageIdx >= 3) {
    const offered = apps.filter((a) => a.status === 'shortlisted').slice(0, numTargetCreators);
    offered.forEach((a, i) => {
      const accepted = stageIdx >= 4;
      const rate = a.proposedRate || baseRate;
      const sentAtIso = dayAgo(range(Math.max(2, createdAtAge - 12), createdAtAge - 4));
      const message = 'Loved the pitch. Standard 50/50 escrow on accept and on-post.';
      offers.push({
        id: `off_g${idx}_${i}`,
        campaignId: `cmp_g${idx}`,
        creatorId: a.creatorId,
        rate,
        message,
        status: accepted ? 'accepted' : 'pending',
        sentAt: sentAtIso,
        respondedAt: accepted ? dayAgo(range(1, Math.max(2, createdAtAge - 3))) : undefined,
        // P1b §1.7 — provenance: every generated offer responds to a
        // shortlisted application above (offered.filter on a.status='shortlisted').
        applicationId: a.id,
        source: 'application',
        // P3 §2.1 — `rounds[]` carries the negotiation transcript.
        // Generated offers don't simulate counter-cycles; they go
        // brand-initial → accept directly, so `rounds` is just the
        // initial round.
        rounds: [
          { by: 'brand', at: +new Date(sentAtIso), rate, message },
        ],
      });
      if (accepted) {
        acceptedCreators.push(a.creatorId);
        const creatorUserId = allCreators.find((c) => c.id === a.creatorId)?.userId;

        if (stageIdx === 4 || stageIdx === 5) {
          // Currently in escrow
          escrowHeld += rate;
          transactions.push({
            id: `tx_g${idx}_h${i}`, at: dayAgo(range(1, createdAtAge - 2)),
            userId: brand.userId, kind: 'escrow_hold', amount: -rate,
            status: 'cleared', campaignId: `cmp_g${idx}`, counterpartyUserId: creatorUserId,
            note: `Escrow · ${title}`,
          });
        } else if (stageIdx >= 6) {
          // Released
          spent += rate;
          const holdAge = createdAtAge - range(2, 5);
          const releaseAge = Math.max(1, holdAge - range(5, 20));
          transactions.push(
            { id: `tx_g${idx}_h${i}`, at: dayAgo(holdAge), userId: brand.userId, kind: 'escrow_hold', amount: -rate, status: 'cleared', campaignId: `cmp_g${idx}`, counterpartyUserId: creatorUserId, note: `Escrow · ${title}` },
            { id: `tx_g${idx}_r${i}`, at: dayAgo(releaseAge), userId: brand.userId, kind: 'escrow_release', amount: -rate, status: 'cleared', campaignId: `cmp_g${idx}`, counterpartyUserId: creatorUserId, note: `Payout · ${title}` },
            { id: `tx_g${idx}_p${i}`, at: dayAgo(releaseAge), userId: creatorUserId || '', kind: 'payout', amount: rate, status: 'cleared', campaignId: `cmp_g${idx}`, counterpartyUserId: brand.userId, note: `Payout · ${title}` },
          );
        }

        // Generate a thread + 3-7 messages between brand & creator
        if (creatorUserId) {
          const tId = `t_g${idx}_${i}`;
          const lastMsgAge = stageIdx === 4 ? range(0, 3) : stageIdx === 5 ? range(2, 12) : range(15, 90);
          threads.push({
            id: tId,
            participants: [brand.userId, creatorUserId],
            campaignId: `cmp_g${idx}`,
            subject: `${title} · ${stageIdx >= 6 ? 'wrap-up' : 'production'}`,
            lastMessageAt: dayAgo(lastMsgAge),
            unreadFor: stageIdx === 4 && chance(0.4) ? [brand.userId] : [],
            // P1b §1.9 — placeholder. P1c migrator 3 promotes this to the
            // real Collaboration id once that entity is materialized.
            collaborationId: null,
          });
          const numMsgs = range(3, 8);
          for (let m = 0; m < numMsgs; m++) {
            const fromBrand = m % 2 === 0;
            messages.push({
              id: `msg_g${idx}_${i}_${m}`,
              threadId: tId,
              fromUserId: fromBrand ? brand.userId : creatorUserId,
              text: pick(MESSAGE_TEMPLATES),
              at: dayAgo(lastMsgAge + (numMsgs - m) * range(1, 5)),
            });
          }
        }
      }
    });
  }

  // ============ SUBMISSIONS — production stage (1-2 rounds per accepted creator) ============
  if (progress === 'production') {
    acceptedCreators.forEach((cid, i) => {
      const numRounds = chance(0.6) ? 1 : 2;
      for (let r = 1; r <= numRounds; r++) {
        const isLastRound = r === numRounds;
        const subStatus = isLastRound ? (chance(0.5) ? 'in_review' : 'revisions') : 'revisions';
        submissions.push({
          id: `sub_g${idx}_${i}_r${r}`,
          campaignId: `cmp_g${idx}`,
          creatorId: cid,
          round: r,
          files: [
            { name: `Reel_v${r}.mp4`,  url: upx(COVERS[(idx + i + r) % COVERS.length], 400, 400) },
            { name: `Still_${r}_01`,   url: upx(COVERS[(idx + i + r + 5) % COVERS.length], 400, 400) },
            { name: `Still_${r}_02`,   url: upx(COVERS[(idx + i + r + 9) % COVERS.length], 400, 400) },
          ],
          notes: r === 1 ? 'First cut for review — open to direction on the second still.' : 'Round 2 — addressed lighting + framing notes.',
          status: subStatus as import('./types').SubmissionStatus,
          submittedAt: dayAgo(range(1, 8) + (numRounds - r) * 4),
          feedback: r === 1 || subStatus === 'revisions' ? [
            { from: brand.userId, text: 'Loving the second still. The reel needs the brand mark visible at 0:08 — can you reframe?', at: dayAgo(range(0, 6)) },
            { from: allCreators.find((c) => c.id === cid)?.userId || '', text: 'Got it — re-cutting tonight.', at: dayAgo(range(0, 4)) },
          ] : [],
        });
      }
    });
  }

  if (stageIdx >= 5) postedAt = dayAgo(range(2, Math.max(3, createdAtAge - 30)));
  if (stageIdx >= 6) {
    reach = range(80_000, 3_500_000);
    engagement = +(2.5 + rng() * 6).toFixed(1);
  }

  // ============ SUBMISSIONS — posted / reporting / closed (Phase 49) ============
  //
  // Pre-fix, only `production`-stage campaigns got seeded submissions
  // (in_review / revisions). Anything past that — posted / reporting /
  // closed — had accepted offers + payouts but ZERO submissions,
  // which left `deriveCollab` rolling up to `confirmed` instead of
  // `live` / `paid`. Result: Aesop's 14 closed campaigns showed as
  // "Analytics unlock once content goes live" because no collab ever
  // crossed the live threshold.
  //
  // For each accepted creator on a posted/reporting/closed campaign,
  // emit ONE approved submission per deliverable slot, with a
  // permalink for stageIdx >= 6 (where escrow has been released, so
  // `hasPayout` is true → deliverable.status rolls up to 'live' →
  // collab.stage = 'live' for reporting, 'paid' for closed).
  if (stageIdx >= 5 && acceptedCreators.length > 0) {
    const slotCount = countDeliverableSlots(deliv);
    acceptedCreators.forEach((cid, i) => {
      for (let slot = 0; slot < slotCount; slot++) {
        const submittedAge = Math.max(2, createdAtAge - range(8, 25));
        const approvedAge = Math.max(1, submittedAge - range(2, 6));
        submissions.push({
          id: `sub_g${idx}_${i}_done_s${slot}`,
          campaignId: `cmp_g${idx}`,
          creatorId: cid,
          round: 1,
          files: [
            { name: `Final_s${slot}.mp4`, url: upx(COVERS[(idx + i + slot) % COVERS.length], 400, 400) },
            { name: `Final_s${slot}_alt`,  url: upx(COVERS[(idx + i + slot + 4) % COVERS.length], 400, 400) },
          ],
          // `[slot:N]` prefix wires the submission to deliverable index N
          // via migrator 4's matcher. Standard convention used by the
          // production-stage block above.
          notes: `[slot:${slot}] Final cut — approved & live.`,
          status: 'approved',
          submittedAt: dayAgo(submittedAge),
          feedback: [
            {
              from: brand.userId,
              text: 'Looks great — approving for live.',
              at: dayAgo(approvedAge),
            },
          ],
          // Permalink only for stageIdx >= 6 (reporting, closed). For
          // posted (stageIdx === 5) the content is approved but not
          // yet pointed at a live URL — keeps the collab at 'approved'.
          permalink: stageIdx >= 6
            ? `https://www.instagram.com/p/D_g${idx}_${i}_${slot}/`
            : undefined,
        });
      }
    });
  }

  // ============ REVIEWS — closed campaigns get reviews from both sides ============
  if (progress === 'closed') {
    acceptedCreators.forEach((cid, i) => {
      const creatorUserId = allCreators.find((c) => c.id === cid)?.userId;
      if (!creatorUserId) return;
      const reviewAge = Math.max(1, createdAtAge - range(50, 100));
      reviews.push(
        {
          id: `rv_g${idx}_${i}_b`,
          campaignId: `cmp_g${idx}`,
          fromUserId: brand.userId,
          reviewType: 'creator',
          targetId: cid,
          rating: range(4, 5),
          text: pick([
            'Strong delivery on time, clear comms throughout. Would absolutely book again.',
            'Excellent visual instincts — output exceeded the brief. Highly recommend.',
            'Took feedback well, shipped on time, brand voice nailed. ★★★★★',
            'Great creator to work with — proactive, professional, on-trend. Solid result.',
            'Met every milestone. Output landed in our top 5 for the quarter.',
          ]),
          at: dayAgo(reviewAge),
        },
        {
          id: `rv_g${idx}_${i}_c`,
          campaignId: `cmp_g${idx}`,
          fromUserId: creatorUserId,
          reviewType: 'brand',
          targetId: brand.id,
          rating: range(4, 5),
          text: pick([
            'Brief was sharp, payment cleared on time, feedback was constructive. Easy collab.',
            'Loved working with this team — clear voice, fair rates, smooth process.',
            'Quick to brief, quick to approve, quick to pay. Brand on my "always yes" list.',
            'One of the smoothest brand collabs I\'ve done. Would jump on the next one.',
            'Great brief, supportive review process, on-time payout. Recommend without reservation.',
          ]),
          at: dayAgo(reviewAge - range(0, 3)),
        },
      );
    });
  }

  // Tier-1: rights — varied by stage, more aggressive on closed/posted (historical wins)
  const rights: ContentRights = {
    exclusivity: pick(['none', 'none', '30d', '60d', '90d']) as ContentRights['exclusivity'],
    whitelistAds: chance(0.45),
    repurpose: pick(['none', '90d', '180d', '180d', '365d']) as ContentRights['repurpose'],
    derivative: chance(0.3),
    organicOnly: chance(0.15),
  };

  // Tier-1: tracking — only meaningful for posted/reporting/closed
  let tracking: CampaignTracking[] | undefined;
  if (stageIdx >= 5 && acceptedCreators.length > 0) {
    tracking = acceptedCreators.map((cid) => {
      const reachShare = Math.floor((reach || 500_000) / acceptedCreators.length);
      const baseClicks = Math.round(reachShare * (0.012 + rng() * 0.04)); // 1.2-5.2% CTR
      const conv = Math.round(baseClicks * (0.018 + rng() * 0.06)); // 1.8-7.8% conversion
      return {
        creatorId: cid,
        trackingUrl: `alamut.co/c/cmp_g${idx}/${cid}?utm_source=alamut&utm_medium=creator&utm_campaign=cmp_g${idx}&utm_content=${cid}`,
        clicks: baseClicks + range(-200, 200),
        conversions: conv,
        revenueAttributed: conv * range(40, 120),
      };
    });
  }

  const halfMs = Math.round(budget * 0.5 / Math.max(numTargetCreators, 1));
  const campaign: Campaign = {
    id: `cmp_g${idx}`,
    brandId: brand.id,
    title,
    pitch: `A ${cat.toLowerCase()} campaign with ${numTargetCreators} creator${numTargetCreators === 1 ? '' : 's'}.`,
    brief: templateBrief(cat, brand.name, deliv, numTargetCreators),
    cover: upx(COVERS[idx % COVERS.length], 800, 600),
    budget, spent, escrowHeld,
    region: pick(['Global', 'US', 'UK', 'EU', 'APAC', 'US/UK', 'EU/JP', 'MENA', 'LATAM']),
    category: cat,
    stage,
    // P1d §1.5 — `deliverablesText` is the free-form display string;
    // `deliverableIds` stays empty here and is populated by migrator 4
    // (which fires once on first hydrate to materialize Deliverable rows
    // from `deliverablesText` and write the FK list back).
    deliverablesText: deliv,
    deliverableIds: [],
    // F21 — key the deadline off the campaign's real 4-value `stage`, not
    // the internal pipeline depth. `stageIdx` counts production progress
    // (draft→live→shortlist→offer→production→posted→reporting→closed), and
    // everything from 'shortlist' onward collapses to stage='live' — so any
    // campaign past the offer step got a deadline in the PAST while still
    // advertising itself as Live and accepting applications. 75 of 138 live
    // campaigns read "Deadline passed", which made the whole marketplace
    // look abandoned to a browsing creator. Only closed campaigns should
    // sit in the past.
    deadline: friendlyDeadline(stage === 'closed' ? -range(1, 30) : range(3, 30)),
    postedAt, reach, engagement,
    createdAt,
    history: hist,
    milestones: [
      { id: `m_g${idx}_a`, stage: 'offer',  amount: halfMs, description: '50% on offer accept' },
      { id: `m_g${idx}_b`, stage: 'posted', amount: halfMs, description: '50% on post live' },
    ],
    applications: apps.map((a) => a.id),
    offers: offers.map((o) => o.id),
    rights,
    tracking,
  };

  return { campaign, progress, applications: apps, offers, submissions, transactions, threads, messages, reviews };
}

const generatedCampaigns: CampaignSeed[] = [];
let cmpIdx = 0;

// Weight the demo brands so they end up with rich histories — Aesop gets ~22 campaigns
// across the year, Le Creuset ~14. The rest are spread across the wider brand pool.
const aesopBrand = DEMO_BRANDS[0];
const lecreusetBrand = DEMO_BRANDS[1];

// P1b §1.2 — these plans now feed both `stage` (the post-collapse 4-value
// Campaign.stage) and `progress` (the internal driver for how deep to
// populate apps/offers/submissions). All non-draft, non-closed progress
// values map to stage='live'.
const AESOP_PLAN: { stage: CampaignStage; progress: InternalProgress; count: number }[] = [
  { stage: 'live',   progress: 'live',       count: 2 },
  { stage: 'live',   progress: 'shortlist',  count: 2 },
  { stage: 'live',   progress: 'offer',      count: 1 },
  { stage: 'live',   progress: 'production', count: 2 },
  { stage: 'live',   progress: 'posted',     count: 1 },
  { stage: 'live',   progress: 'reporting',  count: 2 },
  { stage: 'closed', progress: 'closed',     count: 5 },
];
AESOP_PLAN.forEach(({ stage, progress, count }) => {
  for (let i = 0; i < count; i++) {
    // Sarah is a recurring Aesop creator — present on most campaigns past draft.
    // Yuki appears on design-leaning ones (every 3rd).
    const preferred: string[] = ['c_sarah'];
    if (i % 3 === 0) preferred.push('c_yuki');
    generatedCampaigns.push(genCampaign(cmpIdx++, stage, aesopBrand, preferred, progress));
  }
});

const LECREUSET_PLAN: { stage: CampaignStage; progress: InternalProgress; count: number }[] = [
  { stage: 'live',   progress: 'live',       count: 2 },
  { stage: 'live',   progress: 'shortlist',  count: 1 },
  { stage: 'live',   progress: 'production', count: 2 },
  { stage: 'live',   progress: 'posted',     count: 1 },
  { stage: 'live',   progress: 'reporting',  count: 1 },
  { stage: 'closed', progress: 'closed',     count: 4 },
];
LECREUSET_PLAN.forEach(({ stage, progress, count }) => {
  for (let i = 0; i < count; i++) {
    // Amir is the recurring food creator for Le Creuset.
    const preferred = ['c_amir'];
    generatedCampaigns.push(genCampaign(cmpIdx++, stage, lecreusetBrand, preferred, progress));
  }
});

STAGE_DISTRIBUTION.forEach(({ stage, internalProgress, count }) => {
  for (let i = 0; i < count; i++) {
    generatedCampaigns.push(genCampaign(cmpIdx++, stage, undefined, undefined, internalProgress));
  }
});

// ============ SHOWCASE — every collaboration stage, on purpose ============
//
// WHY THIS EXISTS
//
// Profiling the seed found that `confirmed` appeared ONCE across the entire
// product and `live` never at all, because the generator accepts an offer and
// creates submissions in the same step (skipping `confirmed`), and its
// "reporting" campaigns don't reliably land every slot on a permalink
// (skipping `live`). Someone exploring the demo could not see the pipeline
// the product is built around.
//
// These two campaigns fix that by construction rather than by chance. Each
// creator below is engineered into exactly one stage, following the rules in
// `computeCollabStage`:
//
//   pitched      application, no offer
//   negotiating  offer pending (or countered)
//   confirmed    offer accepted, NO submission
//   submitted    accepted + submission in_review  (and one in `revisions`,
//                which is the same stage but the creator's move)
//   approved     accepted + submission approved, NO permalink
//   live         accepted + submission approved WITH permalink
//   paid         all of the above + a cleared payout + campaign CLOSED
//
// TWO campaigns because `paid` requires `campIsClosed` — a single live
// campaign structurally cannot display it, so a one-screen "every stage"
// board is impossible and the closed twin carries the settled deal.
//
// Deliverables are a single slot ('1 IG Reel') on purpose: with one slot per
// creator, one submission fully determines the stage, so these stay readable
// and cannot drift into a half-approved multi-slot state.
const SHOWCASE_LIVE_ID = 'cmp_show_live';
const SHOWCASE_CLOSED_ID = 'cmp_show_closed';

/** Cast picked from the seeded creator pool, one per stage. */
const showcaseCast = {
  // Sarah is deliberately NOT the pitcher: `pitched` is the BRAND's move, so
  // the demo creator would have nothing to do on it. She holds the `invited`
  // row below instead, which is hers to accept or decline.
  pitched:     generatedCreators[5]?.creator.id ?? 'c_yuki',
  negotiating: 'c_yuki',
  confirmed:   'c_amir',
  inReview:    generatedCreators[0]?.creator.id,
  revision:    generatedCreators[1]?.creator.id,
  approved:    generatedCreators[2]?.creator.id,
  live:        generatedCreators[3]?.creator.id,
} as const;

function showcaseUser(creatorId: string | undefined): string {
  return allCreators.find((c) => c.id === creatorId)?.userId ?? '';
}

const showcaseApps: Application[] = [];
const showcaseOffers: Offer[] = [];
const showcaseSubs: Submission[] = [];

/** Every stage past `pitched` still has an application behind it — that is
 *  how a real deal starts, and it keeps the brand's Applicants tab honest. */
function showcaseApply(creatorId: string, rate: number, status: Application['status'], daysAgo: number) {
  showcaseApps.push({
    id: `app_show_${creatorId}`,
    campaignId: SHOWCASE_LIVE_ID,
    creatorId,
    pitch: 'Quiet, unhurried footage — morning light, no voiceover. Two concept directions attached.',
    proposedRate: rate,
    status,
    submittedAt: dayAgo(daysAgo),
    decidedAt: status === 'submitted' ? undefined : dayAgo(Math.max(1, daysAgo - 2)),
  });
}

function showcaseOffer(creatorId: string, rate: number, status: Offer['status'], daysAgo: number, countered = false) {
  showcaseOffers.push({
    id: `off_show_${creatorId}`,
    campaignId: SHOWCASE_LIVE_ID,
    creatorId,
    rate,
    message: 'Would love to have you on this one — the brief is deliberately light on direction.',
    status,
    sentAt: dayAgo(daysAgo),
    respondedAt: status === 'pending' ? undefined : dayAgo(Math.max(1, daysAgo - 1)),
    rounds: countered
      ? [
        { by: 'brand',   at: +new Date(dayAgo(daysAgo)),     rate,           message: 'Opening offer.' },
        { by: 'creator', at: +new Date(dayAgo(daysAgo - 1)), rate: rate + 400, message: 'Close — could you meet me at this?' },
      ]
      : [{ by: 'brand', at: +new Date(dayAgo(daysAgo)), rate, message: 'Opening offer.' }],
    applicationId: `app_show_${creatorId}`,
    source: 'application',
  });
}

function showcaseSubmission(
  creatorId: string,
  status: import('./types').SubmissionStatus,
  daysAgo: number,
  permalink?: string,
) {
  showcaseSubs.push({
    id: `sub_show_${creatorId}`,
    campaignId: SHOWCASE_LIVE_ID,
    creatorId,
    round: 1,
    files: [{ name: 'Reel_v1.mp4', url: upx(COVERS[2], 400, 400) }],
    notes: '[slot:0] Single Reel, 42s, natural audio.',
    status,
    submittedAt: dayAgo(daysAgo),
    feedback: status === 'revisions'
      ? [{ from: 'u_hannah', text: 'Beautiful — but the product needs to read in the first three seconds. Can you recut the open?', at: dayAgo(Math.max(0, daysAgo - 1)) }]
      : status === 'approved'
        ? [{ from: 'u_hannah', text: 'Approved — exactly the tone we wanted.', at: dayAgo(Math.max(0, daysAgo - 1)) }]
        : [],
    permalink,
  });
}

// pitched — applied, brand hasn't responded. The "Accept pitch" CTA lands here.
showcaseApply(showcaseCast.pitched, 2400, 'submitted', 6);

// negotiating — the creator countered, so it is the BRAND's move.
showcaseApply(showcaseCast.negotiating, 2600, 'shortlisted', 12);
showcaseOffer(showcaseCast.negotiating, 2200, 'countered', 9, true);

// confirmed — accepted, work not started. The stage that was missing entirely.
if (showcaseCast.confirmed) {
  showcaseApply(showcaseCast.confirmed, 1800, 'shortlisted', 16);
  showcaseOffer(showcaseCast.confirmed, 1800, 'accepted', 13);
}

// submitted — content in review, the brand's move.
if (showcaseCast.inReview) {
  showcaseApply(showcaseCast.inReview, 1600, 'shortlisted', 20);
  showcaseOffer(showcaseCast.inReview, 1600, 'accepted', 18);
  // Aged past `reviewOverdueDays` on purpose: the overdue-review warning is
  // the entire intervention for unreviewed work (escrow deliberately never
  // auto-releases), so the showcase has to actually show it firing.
  showcaseSubmission(showcaseCast.inReview, 'in_review', 9);
}

// submitted (revision) — same stage, but the CREATOR's move. Worth showing
// separately: it is the case the brand kanban used to render blank for.
if (showcaseCast.revision) {
  showcaseApply(showcaseCast.revision, 1500, 'shortlisted', 22);
  showcaseOffer(showcaseCast.revision, 1500, 'accepted', 19);
  showcaseSubmission(showcaseCast.revision, 'revisions', 4);
}

// approved — paid out, awaiting the public link. The creator's move.
if (showcaseCast.approved) {
  showcaseApply(showcaseCast.approved, 2000, 'shortlisted', 26);
  showcaseOffer(showcaseCast.approved, 2000, 'accepted', 24);
  showcaseSubmission(showcaseCast.approved, 'approved', 6);
}

// live — posted, link attached. Never occurred anywhere in the old seed.
if (showcaseCast.live) {
  showcaseApply(showcaseCast.live, 2200, 'shortlisted', 30);
  showcaseOffer(showcaseCast.live, 2200, 'accepted', 28);
  showcaseSubmission(showcaseCast.live, 'approved', 9, 'https://www.instagram.com/p/DShowcaseLive/');
}

const showcaseLive: CampaignSeed = {
  campaign: {
    id: SHOWCASE_LIVE_ID, brandId: 'b_aesop', title: 'Quiet Hours',
    pitch: 'One Reel each. Morning light, no voiceover, no hard sell.',
    brief: 'A deliberately open brief: one Instagram Reel, 30–60s, shot in natural morning light. No voiceover, no script. Show the product in use rather than in frame. We review within 48 hours.',
    cover: upx(COVERS[4], 800, 600),
    budget: 14_000,
    spent: 0,
    // Escrow for the four accepted-and-unsettled deals.
    escrowHeld: 1800 + 1600 + 1500 + 2000 + 2200,
    region: 'US/UK', category: 'Beauty',
    stage: 'live', deliverablesText: '1 IG Reel', deliverableIds: [],
    deadline: futureDeadline(12),
    createdAt: dayAgo(34),
    history: [
      { stage: 'draft', at: dayAgo(34), by: 'u_hannah' },
      { stage: 'live',  at: dayAgo(31), by: 'u_hannah' },
    ],
    milestones: [],
    applications: showcaseApps.map((a) => a.id),
    offers: showcaseOffers.map((o) => o.id),
  },
  progress: 'production',
  applications: showcaseApps,
  offers: showcaseOffers,
  submissions: showcaseSubs,
  transactions: [],
  threads: [],
  messages: [],
  reviews: [],
};

// The closed twin — carries the one stage a live campaign cannot show.
const paidCreator = showcaseCast.live ?? 'c_sarah';
const PAID_RATE = 2600;
const showcaseClosed: CampaignSeed = {
  campaign: {
    id: SHOWCASE_CLOSED_ID, brandId: 'b_aesop', title: 'Second Light',
    pitch: 'The autumn run. Settled and closed out.',
    brief: 'One Reel plus two stories, shot late afternoon. Completed campaign — kept as a worked example of a settled deal end to end.',
    cover: upx(COVERS[6], 800, 600),
    budget: 6_000, spent: PAID_RATE, escrowHeld: 0,
    region: 'US/UK', category: 'Beauty',
    stage: 'closed', deliverablesText: '1 IG Reel', deliverableIds: [],
    deadline: dayAgo(20),
    createdAt: dayAgo(96),
    history: [
      { stage: 'draft',  at: dayAgo(96), by: 'u_hannah' },
      { stage: 'live',   at: dayAgo(92), by: 'u_hannah' },
      { stage: 'closed', at: dayAgo(18), by: 'u_hannah' },
    ],
    milestones: [],
    applications: ['app_show_paid'],
    offers: ['off_show_paid'],
  },
  progress: 'closed',
  applications: [{
    id: 'app_show_paid', campaignId: SHOWCASE_CLOSED_ID, creatorId: paidCreator,
    pitch: 'Late-afternoon light, one Reel plus two stories.',
    proposedRate: PAID_RATE, status: 'accepted',
    submittedAt: dayAgo(90), decidedAt: dayAgo(88),
  }],
  offers: [{
    id: 'off_show_paid', campaignId: SHOWCASE_CLOSED_ID, creatorId: paidCreator,
    rate: PAID_RATE, message: 'Accepting your pitch as proposed.',
    status: 'accepted', sentAt: dayAgo(88), respondedAt: dayAgo(88),
    rounds: [{ by: 'brand', at: +new Date(dayAgo(88)), rate: PAID_RATE, message: 'Accepting your pitch as proposed.' }],
    applicationId: 'app_show_paid', source: 'application',
  }],
  submissions: [{
    id: 'sub_show_paid', campaignId: SHOWCASE_CLOSED_ID, creatorId: paidCreator,
    round: 1,
    files: [{ name: 'Final.mp4', url: upx(COVERS[6], 400, 400) }],
    notes: '[slot:0] Final cut.',
    status: 'approved', submittedAt: dayAgo(40),
    feedback: [{ from: 'u_hannah', text: 'Approved — lovely work.', at: dayAgo(38) }],
    permalink: 'https://www.instagram.com/p/DShowcasePaid/',
  }],
  // The cleared payout `paid` requires. GROSS on the payout row with the two
  // deductions beside it, matching the convention the release path writes.
  transactions: [
    { id: 'tx_show_paid_rel', at: dayAgo(37), userId: 'u_hannah', kind: 'escrow_release', amount: -PAID_RATE, status: 'cleared', campaignId: SHOWCASE_CLOSED_ID, counterpartyUserId: showcaseUser(paidCreator), note: `Released · Second Light` },
    { id: 'tx_show_paid_pay', at: dayAgo(37), userId: showcaseUser(paidCreator), kind: 'payout', amount: PAID_RATE, status: 'cleared', campaignId: SHOWCASE_CLOSED_ID, counterpartyUserId: 'u_hannah', note: `Payout from Aesop · Second Light` },
    { id: 'tx_show_paid_fee', at: dayAgo(37), userId: showcaseUser(paidCreator), kind: 'fee', amount: -Math.round(PAID_RATE * 0.10), status: 'cleared', campaignId: SHOWCASE_CLOSED_ID, note: 'Platform fee (10%)' },
    { id: 'tx_show_paid_tax', at: dayAgo(37), userId: showcaseUser(paidCreator), kind: 'fee', amount: -Math.round(PAID_RATE * 0.05), status: 'cleared', campaignId: SHOWCASE_CLOSED_ID, note: 'Withholding tax (5%)' },
  ],
  threads: [],
  messages: [],
  reviews: [],
};

generatedCampaigns.push(showcaseLive, showcaseClosed);

// ---- `invited` — the one stage that must be authored, not derived --------
//
// A cold invite is a Collaboration with NO application, offer or submission
// behind it: the brand reached out, the creator hasn't answered. There is
// nothing for migrator P1c to derive it from, so these rows are seeded
// directly. (That migrator's idempotency guard used to be all-or-nothing,
// which made seeding even one of these produce a database with zero
// collaborations — it is now per-pair.)
//
// Two, so both sides of the demo have one: one on the showcase board that a
// brand sees waiting on the creator, and one addressed to Sarah so the
// creator's own board shows an invitation needing a reply.
const invitedAt = +new Date(dayAgo(3));
const seededInvitedCollabs: import('./types').Collaboration[] = [
  {
    // Sarah's. She has no application or offer on this campaign, which is
    // what makes the row survive: a pair with prior activity derives a
    // further-along stage, and `dedupeCollabRows` (correctly) keeps that one.
    // An earlier attempt put this on cmp_3, where she already had a pending
    // offer — the invite was silently replaced by the `confirmed` row.
    id: 'col_show_invited',
    campaignId: SHOWCASE_LIVE_ID,
    creatorId: 'c_sarah',
    brandId: 'b_aesop',
    stage: 'invited',
    createdAt: invitedAt,
    updatedAt: invitedAt,
    agreedRate: null,
    acceptedOfferId: null,
    contractId: null,
    cancelledAt: null,
    cancellationReason: null,
    history: [{ at: invitedAt, from: null, to: 'invited', actorUserId: 'u_hannah', reason: 'brand-invite' }],
  },
];


// ============ DEMO CAMPAIGNS (the ones the demo flow showcases) ============
const demoCampaigns: Campaign[] = [
  {
    id: 'cmp_1', brandId: 'b_aesop', title: 'Spring Renewal',
    pitch: 'A mindful skincare moment for the change of season.',
    brief: 'We are looking for 3–5 lifestyle creators to feature our new Spring Renewal kit through one Reel + 2 stories. Soft, natural light. Authentic morning routines preferred.',
    cover: upx(COVERS[0], 800, 600),
    budget: 8_000, spent: 0, escrowHeld: 5_400,
    region: 'US/UK', category: 'Beauty',
    // P1b: stage is now the campaign's lifecycle (4 values). The fact
    // that an offer has been accepted + content is in production is
    // visible via Offer.status / Submission.status / Collaboration.stage
    // (P1c) — not via Campaign.stage.
    stage: 'live', deliverablesText: '1 Reel + 2 stories', deliverableIds: [],
    deadline: futureDeadline(7),
    createdAt: dayAgo(28),
    history: [
      { stage: 'draft', at: dayAgo(28), by: 'u_hannah' },
      { stage: 'live', at: dayAgo(24), by: 'u_hannah' },
    ],
    milestones: [
      { id: 'm_1a', stage: 'offer', amount: 900, description: '50% on offer accept' },
      { id: 'm_1b', stage: 'posted', amount: 900, description: '50% on post live' },
    ],
    applications: ['app_1'], offers: ['off_1'],
  },
  {
    id: 'cmp_2', brandId: 'b_lecreuset', title: 'Slow Sundays',
    pitch: 'Long-form weekend cooking content with our new Dutch oven.',
    brief: 'Looking for 2 food creators (South Asian or Mediterranean cuisine) for a 6-minute YouTube cooking feature. Brand mention in title and description; 1 dedicated IG post; 3 stories.',
    cover: upx(COVERS[1], 800, 600),
    budget: 6_000, spent: 0, escrowHeld: 0,
    region: 'Global', category: 'Food',
    stage: 'live', deliverablesText: '1 YouTube + 1 IG post + 3 stories', deliverableIds: [],
    deadline: futureDeadline(14),
    createdAt: dayAgo(6),
    history: [
      { stage: 'draft', at: dayAgo(6), by: 'u_marcus' },
      { stage: 'live', at: dayAgo(4), by: 'u_marcus' },
    ],
    milestones: [
      { id: 'm_2a', stage: 'offer', amount: 1500, description: '50% on offer accept' },
      { id: 'm_2b', stage: 'posted', amount: 1500, description: '50% on post live' },
    ],
    applications: [], offers: [],
  },
  {
    id: 'cmp_3', brandId: 'b_aesop', title: 'Studio Notes',
    pitch: 'Quiet, considered home rituals — for our new home line.',
    brief: 'Design and lifestyle creators only. 1 IG post + 1 Reel showcasing the new Aesop home candle and room spray in their own space.',
    cover: upx(COVERS[2], 800, 600),
    budget: 5_000, spent: 0, escrowHeld: 0,
    region: 'EU/JP', category: 'Design',
    // P1b: stage='live' covers shortlist depth — see Application.status
    // for which creators have been shortlisted on this campaign.
    stage: 'live', deliverablesText: '1 IG post + 1 Reel', deliverableIds: [],
    deadline: futureDeadline(10),
    createdAt: dayAgo(12),
    history: [
      { stage: 'draft', at: dayAgo(12), by: 'u_hannah' },
      { stage: 'live', at: dayAgo(10), by: 'u_hannah' },
    ],
    milestones: [
      { id: 'm_3a', stage: 'offer', amount: 1250, description: '50% on offer accept' },
      { id: 'm_3b', stage: 'posted', amount: 1250, description: '50% on post live' },
    ],
    applications: ['app_2'], offers: [],
  },
  {
    id: 'cmp_4', brandId: 'b_lecreuset', title: 'Holiday Tables',
    pitch: 'Hosting season — 4 creators, 4 cuisines.',
    brief: 'Past campaign — included for reporting reference.',
    cover: upx(COVERS[3], 800, 600),
    budget: 12_000, spent: 12_000, escrowHeld: 0,
    region: 'US', category: 'Food',
    stage: 'closed', deliverablesText: '4 creator features', deliverableIds: [],
    deadline: '2025-12-20', postedAt: dayAgo(120),
    reach: 1_400_000, engagement: 6.2,
    createdAt: dayAgo(160),
    history: [
      { stage: 'draft', at: dayAgo(160), by: 'u_marcus' },
      { stage: 'live', at: dayAgo(150), by: 'u_marcus' },
      { stage: 'closed', at: dayAgo(90), by: 'u_marcus' },
    ],
    milestones: [],
    applications: [], offers: ['off_4'],
  },
  // Phase 59 — Aesop demo campaigns covering every lifecycle stage so
  // the Campaigns list + CampaignDetail can demo the wizard / pause-
  // resume / archive toggle flows without needing to fabricate state
  // mid-walkthrough.
  {
    id: 'cmp_aesop_draft', brandId: 'b_aesop', title: 'Quiet Objects 2026 — Q3 (draft)',
    pitch: 'Slow-living essentials for late summer.',
    brief: 'Open-tone editorial: 1 reel + 2 stories + 1 carousel post per creator. Highlight the seasonal hand-cream + the new tinted body lotion in soft natural light. Brand handle + #ad in caption; deliver in 9:16 + 1:1. Aesop pays out same-day on approval.',
    cover: upx(COVERS[6], 800, 600),
    budget: 8_000, spent: 0, escrowHeld: 0,
    region: 'EU/UK', category: 'Lifestyle',
    stage: 'draft', deliverablesText: '1 IG Reel + 2 IG Stories + 1 IG Post', deliverableIds: [],
    deadline: futureDeadline(60),
    createdAt: dayAgo(2),
    history: [{ stage: 'draft', at: dayAgo(2), by: 'u_hannah' }],
    milestones: [],
    applications: [], offers: [],
  },
  {
    id: 'cmp_aesop_paused', brandId: 'b_aesop', title: 'Reset Skincare — Spring',
    pitch: 'Skincare-first creators for the spring reset campaign.',
    brief: 'Paused mid-flight while we finalize the new hero SKU. Existing offers stay accepted; new applications hold. Resume once the hero photography lands (~2 weeks).',
    cover: upx(COVERS[7], 800, 600),
    budget: 12_000, spent: 2_800, escrowHeld: 3_000,
    region: 'US/UK', category: 'Beauty',
    stage: 'paused', deliverablesText: '1 IG Reel + 3 IG Stories', deliverableIds: [],
    deadline: futureDeadline(45),
    createdAt: dayAgo(28),
    history: [
      { stage: 'draft', at: dayAgo(28), by: 'u_hannah' },
      { stage: 'live', at: dayAgo(25), by: 'u_hannah' },
      { stage: 'paused', at: dayAgo(3), by: 'u_hannah' },
    ],
    milestones: [],
    applications: [], offers: [],
  },
  {
    id: 'cmp_aesop_archived', brandId: 'b_aesop', title: 'Hand-care kit · launch teaser',
    pitch: 'Soft-launch teaser for the hand-care kit (closed Q1).',
    brief: 'Completed and archived. Kept in the catalog as a reference brief for the next launch cycle.',
    cover: upx(COVERS[8], 800, 600),
    budget: 6_500, spent: 6_350, escrowHeld: 0,
    region: 'US', category: 'Beauty',
    stage: 'closed', deliverablesText: '1 IG Reel + 1 IG Post', deliverableIds: [],
    deadline: '2025-12-01', postedAt: dayAgo(120),
    reach: 480_000, engagement: 5.8,
    createdAt: dayAgo(160),
    history: [
      { stage: 'draft', at: dayAgo(160), by: 'u_hannah' },
      { stage: 'live', at: dayAgo(155), by: 'u_hannah' },
      { stage: 'closed', at: dayAgo(110), by: 'u_hannah' },
    ],
    milestones: [],
    applications: [], offers: [],
    archivedAt: new Date(Date.now() - 30 * 86400_000).toISOString(),
  },
];

const demoApps: Application[] = [
  { id: 'app_1', campaignId: 'cmp_1', creatorId: 'c_sarah', pitch: 'Soft morning light, sustainable tone — natural fit for my audience.', proposedRate: 1800, status: 'shortlisted', submittedAt: dayAgo(20), decidedAt: dayAgo(18) },
  { id: 'app_2', campaignId: 'cmp_3', creatorId: 'c_yuki',  pitch: 'Studio shots from Kyoto workshop, quiet palette.', proposedRate: 1400, status: 'shortlisted', submittedAt: dayAgo(5),  decidedAt: dayAgo(3) },
];
const demoOffers: Offer[] = [
  // P1b §1.7 — applicationId links the offer to the application that
  // triggered it; source records why the offer was sent.
  // P3 §2.1 — `rounds[]` carries the full negotiation transcript.
  {
    id: 'off_1', campaignId: 'cmp_1', creatorId: 'c_sarah',
    rate: 1800, message: 'Loved your pitch. Standard 50/50 escrow, post by Apr 30.',
    status: 'accepted', sentAt: dayAgo(15), respondedAt: dayAgo(14),
    applicationId: 'app_1', source: 'application',
    rounds: [
      { by: 'brand', at: +new Date(dayAgo(15)), rate: 1800, message: 'Loved your pitch. Standard 50/50 escrow, post by Apr 30.' },
    ],
  },
  // P1a: synthetic accepted offer for c_amir on cmp_4 — preserves the
  // relationship that previously lived only in `cmp_4.acceptedCreators`.
  // No prior application existed (cold-outreach pre-P1b model), so the
  // P1b backfill marks it source: 'cold-outreach'.
  {
    id: 'off_4', campaignId: 'cmp_4', creatorId: 'c_amir',
    rate: 3000, message: 'Long-form holiday hosting feature.',
    status: 'accepted', sentAt: dayAgo(140), respondedAt: dayAgo(135),
    applicationId: null, source: 'cold-outreach',
    rounds: [
      { by: 'brand', at: +new Date(dayAgo(140)), rate: 3000, message: 'Long-form holiday hosting feature.' },
    ],
  },
  // Phase 59 — demo offers for the negotiation flow. Pre-fix every
  // seeded offer was `accepted` or `expired` so Accept/Counter/Decline
  // had no live data to demo.
  //
  //  off_pending_1 — Aesop → Sarah on cmp_3 (Studio Notes), brand sent
  //  an offer, Sarah hasn't responded yet. Creator-side MyCollabs +
  //  StageActionBanner show Accept / Counter / Decline buttons.
  {
    id: 'off_pending_1', campaignId: 'cmp_3', creatorId: 'c_sarah',
    rate: 1650, message: 'We loved your Spring Renewal work — would love you on Studio Notes too. $1,650 flat for the 1 IG post + 1 Reel deliverable, post by the deadline.',
    status: 'pending', sentAt: dayAgo(1),
    applicationId: null, source: 'cold-outreach',
    rounds: [
      { by: 'brand', at: +new Date(dayAgo(1)), rate: 1650, message: 'We loved your Spring Renewal work — would love you on Studio Notes too. $1,650 flat for the 1 IG post + 1 Reel deliverable, post by the deadline.' },
    ],
  },
  //  off_countered_1 — Le Creuset → Sarah, Sarah countered up to $2,200,
  //  brand owes a response. Brand-side kanban shows Accept / Counter
  //  back / Decline buttons.
  {
    id: 'off_countered_1', campaignId: 'cmp_2', creatorId: 'c_sarah',
    rate: 1800, message: 'Hosting season feature — $1,800 for a Reel + 3 stories.',
    status: 'countered', sentAt: dayAgo(3), respondedAt: dayAgo(1),
    applicationId: null, source: 'cold-outreach',
    rounds: [
      { by: 'brand',   at: +new Date(dayAgo(3)), rate: 1800, message: 'Hosting season feature — $1,800 for a Reel + 3 stories.' },
      { by: 'creator', at: +new Date(dayAgo(1)), rate: 2200, message: 'Excited about Le Creuset! For the scope (Reel + 3 stories + a carousel), my standard is $2,200 — close to your offer. Open to chatting.' },
    ],
  },
  //  off_pending_2 — Aesop → Yuki on cmp_aesop_draft would be too
  //  meta. Use the existing cmp_3 (Studio Notes) to set up another
  //  pending offer waiting on Yuki — gives Hannah a kanban entry
  //  showing "Awaiting reply" in Negotiating, distinct from the
  //  cold-invite "Invitation sent" case.
  {
    id: 'off_pending_2', campaignId: 'cmp_3', creatorId: 'c_yuki',
    rate: 1400, message: 'Want you on Studio Notes — $1,400 for the same deliverable spec. Karachi / design backdrop would be perfect.',
    status: 'pending', sentAt: dayAgo(2),
    applicationId: 'app_2', source: 'application',
    rounds: [
      { by: 'brand', at: +new Date(dayAgo(2)), rate: 1400, message: 'Want you on Studio Notes — $1,400 for the same deliverable spec. Karachi / design backdrop would be perfect.' },
    ],
  },
  //  off_countered_2 — A generated brand counter-back to Sarah's pitch,
  //  demoing the "brand countered, creator owes response" branch where
  //  the creator-side banner shows the brand's counter with an Accept
  //  / Counter again / Decline triad.
  {
    id: 'off_countered_2', campaignId: 'cmp_g8', creatorId: 'c_sarah',
    rate: 1900, message: 'Morning Pages feature, $1,900 for the 1 Reel + 2 Stories spec.',
    status: 'countered', sentAt: dayAgo(4), respondedAt: dayAgo(1),
    applicationId: null, source: 'cold-outreach',
    rounds: [
      { by: 'brand',   at: +new Date(dayAgo(4)), rate: 1900, message: 'Morning Pages feature, $1,900 for the 1 Reel + 2 Stories spec.' },
      { by: 'creator', at: +new Date(dayAgo(3)), rate: 2400, message: 'Loved the brief! For the full Reel + Stories package my floor is $2,400 — happy to discuss.' },
      { by: 'brand',   at: +new Date(dayAgo(1)), rate: 2100, message: 'Let\'s meet in the middle — $2,100. Same scope, deadline stretched by a week if helpful.' },
    ],
  },
];
const demoSubs: Submission[] = [
  {
    id: 'sub_1', campaignId: 'cmp_1', creatorId: 'c_sarah',
    round: 2, status: 'in_review',
    submittedAt: dayAgo(2),
    files: [
      { name: 'Reel.mp4',  url: upx(COVERS[0], 400, 400) },
      { name: 'Still 01',  url: upx(COVERS[13], 400, 400) },
      { name: 'Still 02',  url: upx(COVERS[12], 400, 400) },
    ],
    notes: 'Round 2 — adjusted the candle position per feedback.',
    feedback: [
      { from: 'u_hannah', text: 'Looking great overall — one tiny note on the second still: can we shift the candle ~6 inches further from the window?', at: dayAgo(2) },
      { from: 'u_sarah',  text: 'Got it — re-shooting Still 02 tonight, will have v2 by tomorrow.', at: dayAgo(2) },
    ],
  },
];

// ============ THREADS / MESSAGES ============
const demoThreads: Thread[] = [
  // P1b §1.9 — collaborationId placeholders. P1c migrator 3 promotes
  // these to point at the matching Collaboration once that entity is
  // materialized. Until then they read as pre-collab DMs.
  { id: 't_1', participants: ['u_hannah', 'u_sarah'], campaignId: 'cmp_1', subject: 'Spring Renewal · Round 2 review', lastMessageAt: dayAgo(2), unreadFor: ['u_sarah'], collaborationId: null },
  { id: 't_2', participants: ['u_marcus', 'u_amir'],  campaignId: 'cmp_2', subject: 'Slow Sundays · interest check',   lastMessageAt: dayAgo(1), unreadFor: ['u_amir'],  collaborationId: null },
];
const demoMessages = [
  { id: 'msg_1', threadId: 't_1', fromUserId: 'u_hannah', text: 'Looking great overall — one tiny note on the second still: can we shift the candle ~6 inches further from the window?', at: dayAgo(2) },
  { id: 'msg_2', threadId: 't_1', fromUserId: 'u_sarah',  text: 'Got it — re-shooting Still 02 tonight, will have v2 by tomorrow.', at: dayAgo(2) },
  { id: 'msg_3', threadId: 't_2', fromUserId: 'u_marcus', text: 'Hi Amir — Slow Sundays brief is live. Would love to have you apply if it fits.', at: dayAgo(1) },
];

// Threads + messages + reviews now flow directly from genCampaign — pull them flat.
const generatedThreads: Thread[] = generatedCampaigns.flatMap((c) => c.threads);
const generatedMessages = generatedCampaigns.flatMap((c) => c.messages);
const generatedCampaignReviews = generatedCampaigns.flatMap((c) => c.reviews);

// ============ APPLY DERIVED STATE TO BRANDS / CREATORS ============
// Compute escrowHeld per brand from campaigns; compute pending/wallet for creators from offers + transactions
const brandEscrow: Record<string, number> = {};
const creatorPending: Record<string, number> = {};
const creatorWallet: Record<string, number> = {};

[...generatedCampaigns.map((c) => c.campaign), ...demoCampaigns].forEach((c) => {
  brandEscrow[c.brandId] = (brandEscrow[c.brandId] || 0) + c.escrowHeld;
});

generatedCampaigns.forEach(({ progress, offers }) => {
  offers.filter((o) => o.status === 'accepted').forEach((o) => {
    const c = allCreators.find((x) => x.id === o.creatorId);
    if (!c) return;
    // Use the seed-side internal progress (pre-P1b 8-stage) to decide
    // whether the offer money is still in escrow (pending) or released
    // (wallet). This mapping isn't visible from Campaign.stage anymore
    // because it was collapsed to 4 values in P1b.
    if (progress === 'production' || progress === 'offer') {
      creatorPending[c.id] = (creatorPending[c.id] || 0) + o.rate;
    } else if (progress === 'posted' || progress === 'reporting' || progress === 'closed') {
      creatorWallet[c.id] = (creatorWallet[c.id] || 0) + o.rate;
    }
  });
});

// Apply
allBrands.forEach((b) => { b.escrowHeld = brandEscrow[b.id] || b.escrowHeld; });
allCreators.forEach((c) => {
  if (creatorPending[c.id]) c.pendingBalance += creatorPending[c.id];
  if (creatorWallet[c.id]) {
    c.walletBalance += creatorWallet[c.id];
    c.lifetimeEarnings += creatorWallet[c.id];
  }
});

// ============ RETAINER CAMPAIGNS (5–7 long-running engagements) ============
// Promote a few existing production-stage campaigns to retainer kind.
// Accepted-creator IDs derived from offers — matches the post-P1a model.
const acceptedCreatorIdsForCampaign = (cs: { offers: Offer[] }): string[] =>
  cs.offers.filter((o) => o.status === 'accepted').map((o) => o.creatorId);

const retainerCandidates = generatedCampaigns
  .filter((cs) => cs.progress === 'production' && acceptedCreatorIdsForCampaign(cs).length > 0)
  .slice(0, 7);
retainerCandidates.forEach((cs) => {
  const c = cs.campaign;
  const monthlyRate = c.budget; // existing budget becomes monthly rate
  const termMonths = pick([6, 6, 12, 12, 12, 12]) as number;
  const cfg: RetainerConfig = {
    monthlyRate,
    termMonths,
    // P1d §1.5 — `deliverablesPerMonth` is a free-form display string;
    // the canonical structured shape lives in `db.deliverables`. Keep
    // sourcing this from the campaign's text for retainer template prose.
    deliverablesPerMonth: c.deliverablesText,
    startedAt: dayAgo(range(40, 90)),
    monthsCompleted: range(2, Math.max(2, termMonths - 2)),
  };
  c.kind = 'retainer';
  c.retainer = cfg;
  // Make the title clearer it's recurring
  c.title = `${c.title} · ${termMonths}mo retainer`;
  // Boost budget to reflect lifetime contract value
  c.budget = monthlyRate * termMonths;
  c.spent = monthlyRate * cfg.monthsCompleted;
  c.escrowHeld = monthlyRate; // current month
  // Leave a hint in the brief
  c.brief = `${c.brief}\n\nThis is a ${termMonths}-month retainer engagement: ${c.deliverablesText} per month at ${monthlyRate.toLocaleString()} USD/month. Renewable.`;
});

// Default kind on all other campaigns
generatedCampaigns.forEach((cs) => {
  if (!cs.campaign.kind) cs.campaign.kind = 'one_off';
});

// Mark a few campaigns as Editor's Picks (4 most recent live, prefer
// shortlist-depth ones for richer demo)
const liveCampaignsForFeature = generatedCampaigns
  .filter((cs) => cs.campaign.stage === 'live' && (cs.progress === 'shortlist' || cs.progress === 'live'))
  .slice(0, 4);
liveCampaignsForFeature.forEach((cs) => { cs.campaign.editorsPick = true; });

// Mark top creators as Editor's Picks. Includes the demo trio
// (Sarah, Yuki, Amir) plus top Flagship + Specialist by rating, so
// Discover's "Editor's pick" filter has ~18-20 candidates instead of 6.
DEMO_CREATORS.forEach((c) => { c.editorsPick = true; });
const flagshipPicks = generatedCreators
  .filter(({ creator }) => creator.tier === 'Flagship')
  .sort((a, b) => b.creator.rating - a.creator.rating)
  .slice(0, 10);
const specialistPicks = generatedCreators
  .filter(({ creator }) => creator.tier === 'Specialist')
  .sort((a, b) => b.creator.rating - a.creator.rating)
  .slice(0, 8);
[...flagshipPicks, ...specialistPicks].forEach(({ creator }) => { creator.editorsPick = true; });

// ============ ADVANCES (income advance against pending escrow) ============
//
// There were ZERO seeded advances, so a whole built feature — request an
// advance against pending escrow, 3% fee, auto-repaid out of the next
// approval — was invisible to anyone exploring the demo. The wallet showed
// the "Request advance" button and nothing had ever used it.
//
// Two rows: one ACTIVE against Sarah's pending balance (so her wallet shows
// the outstanding balance and the repayment mechanic), and one already
// REPAID (so the ledger shows what a completed cycle looks like).
const seededAdvances: import('./types').Advance[] = [
  {
    id: 'adv_seed_sarah',
    creatorId: 'c_sarah',
    requestedAt: dayAgo(11),
    amount: 1200,
    feePct: 0.03,
    feeAmount: 36,
    // 80% of pending is the cap the request modal enforces; this sits under it.
    collateralPending: 3400,
    status: 'active',
    repaidAmount: 0,
  },
  {
    id: 'adv_seed_amir',
    creatorId: 'c_amir',
    requestedAt: dayAgo(64),
    amount: 800,
    feePct: 0.03,
    feeAmount: 24,
    collateralPending: 2100,
    status: 'repaid',
    repaidAmount: 800,
  },
];

// ============ DISPUTES (a couple seeded for admin demo) ============
const seededDisputes: Dispute[] = [];
{
  // Pick a production-stage Aesop campaign for a "creator filed against brand" example
  const productionAesop = generatedCampaigns.find((cs) => cs.campaign.brandId === 'b_aesop' && cs.progress === 'production' && acceptedCreatorIdsForCampaign(cs).length > 0);
  if (productionAesop) {
    const cid = acceptedCreatorIdsForCampaign(productionAesop)[0];
    const creatorUserId = allCreators.find((c) => c.id === cid)?.userId;
    if (creatorUserId) {
      // P2 §1.4 — new dispute shape. `collaborationId` is left empty
      // here and populated by migrator 5 (which derives the FK from
      // `(campaignId, raisedByRole)` × the matching Collaboration). We
      // could pre-fill it now, but keeping it empty exercises the
      // migrator's backfill path on first hydrate.
      seededDisputes.push({
        id: 'disp_seed_1',
        collaborationId: '',
        campaignId: productionAesop.campaign.id,
        raisedByUserId: creatorUserId,
        raisedByRole: 'creator',
        category: 'quality', // brand_no_approval → quality (closest fit)
        description: 'Submitted Round 1 nine days ago, two follow-ups, no response. Production deadline passes tomorrow. Either approve or release escrow per the contract.',
        evidence: [],
        status: 'open',
        resolution: null,
        raisedAt: +new Date(dayAgo(3)),
        updatedAt: +new Date(dayAgo(3)),
        messages: [],
      });
    }
  }
  // Pick a closed campaign for a resolved dispute showing in audit
  const closedLC = generatedCampaigns.find((cs) => cs.campaign.brandId === 'b_lecreuset' && cs.campaign.stage === 'closed' && acceptedCreatorIdsForCampaign(cs).length > 0);
  if (closedLC) {
    const cid = acceptedCreatorIdsForCampaign(closedLC)[0];
    const creatorUserId = allCreators.find((c) => c.id === cid)?.userId;
    if (creatorUserId) {
      seededDisputes.push({
        id: 'disp_seed_2',
        collaborationId: '',
        campaignId: closedLC.campaign.id,
        raisedByUserId: 'u_marcus',
        raisedByRole: 'brand',
        category: 'content-takedown', // rights_violation → content-takedown
        description: 'Creator licensed the same content to a competing brand within the 90-day exclusivity window.',
        evidence: [],
        status: 'resolved-partial',
        resolution: {
          by: 'u_admin',
          at: +new Date(dayAgo(65)),
          note: 'Reviewed both sides. Creator received written brief noting competitor restriction; partial fault on platform for not surfacing more clearly. 50/50 split.',
          releaseAmount: 750,
          refundAmount: 750,
        },
        raisedAt: +new Date(dayAgo(72)),
        updatedAt: +new Date(dayAgo(65)),
        messages: [],
        // The creator counter-party for resolution-side display is
        // derived from the Collaboration; the migrator wires it on first
        // hydrate. Stash the creator user id on a sidecar prop so the
        // migrator can find the right collab without scanning by category.
      });
      // We need the migrator to know which creator was the counter-party
      // for `disp_seed_2` — store the resolved id alongside; the migrator
      // matches on `(campaignId, creatorUserId)` to find the collab.
      // (Avoiding a side-channel state field — pre-P2 the field was
      // `againstUserId`. The migrator looks at the dispute's userId
      // pair: `raisedByUserId` is brand → creator counter-party comes
      // from `db.collaborations.find(c => c.campaignId === disp.campaignId
      // && c.creatorId === <closedLC accepted creator>)`. The seed picks
      // the first accepted creator on the closed campaign, which is
      // exactly what `cid` above resolves to.)
      void creatorUserId;
    }
  }
}

// ============ REVIEWS (seed for the documented demo flow) ============
// Each demo creator (Sarah, Yuki, Amir) gets 3-5 reviews from past
// campaigns dating back 90-180 days so storefronts show a credible
// review history instead of a single rv_1 entry. Mirror brand-side
// reviews where the creator reviewed back. campaignId reuses the
// demo campaigns (cmp_1..cmp_4) — even if those are still 'live' in
// the seed, the review is dated to suggest a prior cycle.
const seededReviews: import('./types').Review[] = [
  // Holiday Tables (cmp_4) — Le Creuset ↔ Amir
  { id: 'rv_1', campaignId: 'cmp_4', fromUserId: 'u_marcus', reviewType: 'creator', targetId: 'c_amir', rating: 5, text: 'Amir delivered above and beyond. Reels were the highlight of the campaign — natural light, considered shot list. Would book again immediately.', at: dayAgo(85) },
  { id: 'rv_2', campaignId: 'cmp_4', fromUserId: 'u_amir',   reviewType: 'brand',   targetId: 'b_lecreuset', rating: 5, text: 'Marcus and the Le Creuset team were a dream. Clear brief, fast feedback, escrow released before noon the day after posting.', at: dayAgo(85) },

  // Sarah — 4 prior reviews
  { id: 'rv_s1', campaignId: 'cmp_1', fromUserId: 'u_hannah', reviewType: 'creator', targetId: 'c_sarah', rating: 5, text: 'Best collaboration we ran last quarter. Sarah\'s framing and editorial sensibility nailed the Spring Renewal brief on the first take.', at: dayAgo(95) },
  { id: 'rv_s2', campaignId: 'cmp_3', fromUserId: 'u_hannah', reviewType: 'creator', targetId: 'c_sarah', rating: 5, text: 'Sarah responded to feedback faster than my internal team. Two rounds, both shipped on time.', at: dayAgo(140) },
  { id: 'rv_s3', campaignId: 'cmp_2', fromUserId: 'u_marcus', reviewType: 'creator', targetId: 'c_sarah', rating: 4, text: 'Strong visual work. We pushed back twice on tonal direction; she received it gracefully and re-shot. Great communication throughout.', at: dayAgo(170) },
  { id: 'rv_s4', campaignId: 'cmp_1', fromUserId: 'u_sarah',  reviewType: 'brand',   targetId: 'b_aesop',     rating: 5, text: 'Aesop respects the craft. Brief was clear, no scope creep, payment cleared next business day.', at: dayAgo(95) },

  // Yuki — 3 prior reviews
  { id: 'rv_y1', campaignId: 'cmp_3', fromUserId: 'u_hannah', reviewType: 'creator', targetId: 'c_yuki', rating: 5, text: 'Yuki\'s Studio Notes work felt like a brand campaign we couldn\'t have produced internally. Already booking the next one.', at: dayAgo(110) },
  { id: 'rv_y2', campaignId: 'cmp_2', fromUserId: 'u_marcus', reviewType: 'creator', targetId: 'c_yuki', rating: 5, text: 'Beautiful daylight footage, on time, exactly the deliverables we briefed. Easiest 5 stars I\'ve ever given.', at: dayAgo(155) },
  { id: 'rv_y3', campaignId: 'cmp_3', fromUserId: 'u_yuki',   reviewType: 'brand',   targetId: 'b_aesop',     rating: 5, text: 'Editorial-grade brief, generous feedback, prompt payout. Aesop is the bar.', at: dayAgo(110) },

  // Amir — 3 prior reviews (in addition to rv_1/rv_2 above)
  { id: 'rv_a1', campaignId: 'cmp_2', fromUserId: 'u_marcus', reviewType: 'creator', targetId: 'c_amir', rating: 5, text: 'Second campaign with Amir. Reach numbers held up, audience overlap was exactly what we briefed.', at: dayAgo(125) },
  { id: 'rv_a2', campaignId: 'cmp_1', fromUserId: 'u_hannah', reviewType: 'creator', targetId: 'c_amir', rating: 4, text: 'Excellent food framing. Minor delay in Round 2 — flagged it, he fixed promptly. Would happily book again.', at: dayAgo(165) },
  { id: 'rv_a3', campaignId: 'cmp_2', fromUserId: 'u_amir',   reviewType: 'brand',   targetId: 'b_lecreuset', rating: 5, text: 'Le Creuset gave creative space without micromanaging. The mark of a brand that actually trusts the creator.', at: dayAgo(125) },
];

// ============ REFERRALS (creator network) ============
const seededReferrals: Referral[] = [];
{
  // Sarah recommends 3 creators across her network
  const sarahReferralTargets = generatedCreators.slice(0, 3).map((c) => c.creator.id);
  sarahReferralTargets.forEach((toId, i) => {
    const status: Referral['status'] = i === 0 ? 'bonus_paid' : i === 1 ? 'active' : 'invited';
    seededReferrals.push({
      id: `ref_seed_${i}`,
      fromCreatorId: 'c_sarah',
      toCreatorId: toId,
      noteToReferred: pick([
        'You\'d be perfect for the Aesop circuit — let me intro you.',
        'Le Creuset has been great to work with. Strong fit for your aesthetic.',
        'My contacts at Glossier are looking for creators in your space.',
      ]),
      recommendedBrandId: pick(['b_aesop', 'b_lecreuset']),
      createdAt: dayAgo(range(5, 90)),
      status,
      bonusEarned: status === 'bonus_paid' ? range(180, 450) : undefined,
      bonusPaidAt: status === 'bonus_paid' ? dayAgo(range(8, 60)) : undefined,
    });
  });

  // Amir recommends 1
  const amirRefTo = generatedCreators[5]?.creator.id;
  if (amirRefTo) {
    seededReferrals.push({
      id: 'ref_seed_amir',
      fromCreatorId: 'c_amir',
      toCreatorId: amirRefTo,
      noteToReferred: 'You make the kind of food content Le Creuset loves. Worth applying.',
      recommendedBrandId: 'b_lecreuset',
      createdAt: dayAgo(28),
      status: 'active',
    });
  }

  // 1 creator referred Sarah back (so she has incoming)
  const yukiRefSarah: Referral = {
    id: 'ref_seed_inbound',
    fromCreatorId: 'c_yuki',
    toCreatorId: 'c_sarah',
    noteToReferred: 'Aesop home line is briefing — your sustainability angle would land.',
    recommendedBrandId: 'b_aesop',
    createdAt: dayAgo(45),
    status: 'bonus_paid',
    bonusEarned: 320,
    bonusPaidAt: dayAgo(20),
  };
  seededReferrals.push(yukiRefSarah);
}

// ============ NOTIFICATIONS ============
// Seed: per-user activity over the past 14 days. The most recent are unread.
const notifications: import('./types').Notification[] = [
  // Hand-curated demo flow
  { id: 'n_1', userId: 'u_sarah',  text: 'Aesop · Hannah left feedback on Round 2', href: '/creator/inbox', at: dayAgo(2), read: false },
  { id: 'n_2', userId: 'u_hannah', text: 'Sarah submitted Round 2 of Spring Renewal', href: '/brand/today', at: dayAgo(2), read: false },
  { id: 'n_3', userId: 'u_amir',   text: 'New invite from Le Creuset — Slow Sundays', href: '/creator/discover', at: dayAgo(1), read: false },
];

// Auto-generate notifications across recent campaign activity for the demo accounts.
let nIdx = 100;

// P1b: branch on `progress` (seed-side internal driver) instead of
// `Campaign.stage` because the campaign-stage enum was collapsed.
// Hannah (Aesop) — dense notifications across all her campaigns.
generatedCampaigns
  .filter((cs) => cs.campaign.brandId === 'b_aesop')
  .forEach((cs) => {
    const c = cs.campaign;
    if (cs.progress === 'live' || cs.progress === 'shortlist') {
      notifications.push({ id: `n_${++nIdx}`, userId: 'u_hannah', text: `${cs.applications.length} application${cs.applications.length === 1 ? '' : 's'} on ${c.title}`, href: '/brand/campaigns', at: dayAgo(range(1, 14)), read: chance(0.5) });
    } else if (cs.progress === 'production') {
      notifications.push({ id: `n_${++nIdx}`, userId: 'u_hannah', text: `New draft submitted on ${c.title}`, href: '/brand/today', at: dayAgo(range(0, 6)), read: chance(0.3) });
    } else if (cs.progress === 'reporting') {
      notifications.push({ id: `n_${++nIdx}`, userId: 'u_hannah', text: `Performance report ready: ${c.title} reached ${(c.reach || 0).toLocaleString()}`, href: '/brand/analytics', at: dayAgo(range(2, 30)), read: true });
    } else if (cs.progress === 'closed' && cs.reviews.length > 0) {
      notifications.push({ id: `n_${++nIdx}`, userId: 'u_hannah', text: `New review on ${c.title}`, href: '/brand/profile', at: dayAgo(range(10, 80)), read: true });
    }
  });

// Marcus (Le Creuset) — same treatment.
generatedCampaigns
  .filter((cs) => cs.campaign.brandId === 'b_lecreuset')
  .forEach((cs) => {
    const c = cs.campaign;
    if (cs.progress === 'live' || cs.progress === 'shortlist') {
      notifications.push({ id: `n_${++nIdx}`, userId: 'u_marcus', text: `${cs.applications.length} application${cs.applications.length === 1 ? '' : 's'} on ${c.title}`, href: '/brand/campaigns', at: dayAgo(range(1, 14)), read: chance(0.5) });
    } else if (cs.progress === 'production') {
      notifications.push({ id: `n_${++nIdx}`, userId: 'u_marcus', text: `Draft to review on ${c.title}`, href: '/brand/today', at: dayAgo(range(0, 6)), read: chance(0.3) });
    }
  });

// Sarah — notifications across her many engagements.
generatedCampaigns
  .filter((cs) => acceptedCreatorIdsForCampaign(cs).includes('c_sarah'))
  .forEach((cs) => {
    const c = cs.campaign;
    if (cs.progress === 'closed') {
      notifications.push({ id: `n_${++nIdx}`, userId: 'u_sarah', text: `Payout cleared · ${c.title}`, href: '/creator/earnings', at: dayAgo(range(2, 100)), read: true });
    } else if (cs.progress === 'production') {
      notifications.push({ id: `n_${++nIdx}`, userId: 'u_sarah', text: `Brand left feedback on ${c.title}`, href: '/creator/content', at: dayAgo(range(0, 8)), read: chance(0.5) });
    } else if (cs.progress === 'offer') {
      notifications.push({ id: `n_${++nIdx}`, userId: 'u_sarah', text: `New offer on ${c.title}`, href: '/creator/campaigns', at: dayAgo(range(1, 6)), read: chance(0.3) });
    }
  });

// Sarah — application-status notifications for ones she didn't get
generatedCampaigns
  .flatMap((cs) => cs.applications.filter((a) => a.creatorId === 'c_sarah' && (a.status === 'shortlisted' || a.status === 'rejected')))
  .slice(0, 6)
  .forEach((app) => {
    const c = generatedCampaigns.find((cs) => cs.campaign.id === app.campaignId)?.campaign;
    if (!c) return;
    notifications.push({
      id: `n_${++nIdx}`, userId: 'u_sarah',
      text: `Your application for ${c.title} was ${app.status}`,
      href: '/creator/campaigns', at: dayAgo(range(1, 30)), read: chance(0.6),
    });
  });

// Amir
generatedCampaigns
  .filter((cs) => acceptedCreatorIdsForCampaign(cs).includes('c_amir'))
  .forEach((cs) => {
    const c = cs.campaign;
    if (cs.progress === 'closed') {
      notifications.push({ id: `n_${++nIdx}`, userId: 'u_amir', text: `Payout cleared · ${c.title}`, href: '/creator/earnings', at: dayAgo(range(2, 80)), read: true });
    }
  });

// ============ TOPUPS — multi-month history per active brand ============
// Each brand gets 3-7 top-ups spread over the year so wallet ledgers feel populated.
const brandTopups: Transaction[] = [];
let topupIdx = 0;
allBrands.forEach((b) => {
  const numTopups = b.id === 'b_aesop' ? 7 : b.id === 'b_lecreuset' ? 5 : range(3, 5);
  for (let i = 0; i < numTopups; i++) {
    const amount = b.id === 'b_aesop' ? range(15_000, 50_000) : b.id === 'b_lecreuset' ? range(10_000, 30_000) : range(3_000, 18_000);
    brandTopups.push({
      id: `tx_top_${topupIdx++}`,
      at: dayAgo(range(20, 380)),
      userId: b.userId,
      kind: 'topup',
      amount,
      status: 'cleared',
      note: pick(['Bank top-up · Wise', 'Bank top-up · ACH', 'Bank top-up · HBL', 'Wire transfer', 'Stripe top-up']),
    });
  }
});

// ============ PENDING ADMIN REVIEW (creator applications waiting for approval) ============
const PENDING_NAMES = ['Hira Akhtar', 'Rohan Mehta', 'Lin Chen', 'Sofia Reyes', 'Khalid Saleh'];
const pendingApplications: { user: User; creator: Creator }[] = PENDING_NAMES.map((name, i) => {
  const userId = `u_pend_${i}`;
  const creatorId = `c_pend_${i}`;
  const [city, country] = pick(CITIES);
  const cats = [...CATEGORIES_POOL].sort(() => rng() - 0.5).slice(0, 2);
  const platforms = genPlatforms('Rising');
  const reach = platforms.reduce((s, p) => s + p.followers, 0);
  return {
    user: {
      id: userId, email: name.toLowerCase().replace(/\s+/g, '.') + '@new.test',
      passwordHash: 'demo1234', role: 'creator',
      status: 'pending_admin_review',
      createdAt: dayAgo(range(1, 7)), creatorId,
    },
    creator: {
      id: creatorId, userId,
      name, handle: '@' + name.toLowerCase().split(/\s+/).join('.'),
      tagline: pick(TAGLINES_BY_CAT[cats[0]] || TAGLINES_BY_CAT.Lifestyle),
      bio: 'Just joined Alamut. Awaiting profile review.',
      city, country, languages: ['English'],
      categories: cats,
      portrait: upx(PORTRAITS[(i * 7) % PORTRAITS.length], 600, 750),
      work: [upx(COVERS[i % COVERS.length], 600, 600), upx(COVERS[(i + 3) % COVERS.length], 600, 600)],
      platforms,
      reach, engagement: +(platforms[0].engagement).toFixed(1),
      rating: 0, tier: 'Rising',
      responseHrs: 24,
      rateCard: { post: '$300–600', reel: '$500–900', story: '$100–250', longform: '—' },
      payout: { method: '', account: '', currency: 'USD' },
      walletBalance: 0, pendingBalance: 0, lifetimeEarnings: 0,
      // P6 §5.6 — `profileCompletion` is computed on read.
      verified: false,
      pressMentions: [], pastClients: [],
    },
  };
});

// Make sure at least 4 generated brands are explicitly unverified for the verify queue
generatedBrands.slice(0, 4).forEach((b) => { b.brand.verified = false; });

// ============ ASSEMBLE ============
const allUsers: User[] = [
  ...DEMO_USERS,
  ...generatedCreators.map((c) => c.user),
  ...generatedBrands.map((b) => b.user),
  ...pendingApplications.map((p) => p.user),
];
const allCampaigns: Campaign[] = [...demoCampaigns, ...generatedCampaigns.map((c) => c.campaign)];
const allApplications: Application[] = [...demoApps, ...generatedCampaigns.flatMap((c) => c.applications)];
const allOffers: Offer[] = [...demoOffers, ...generatedCampaigns.flatMap((c) => c.offers)];
const allSubmissions: Submission[] = [...demoSubs, ...generatedCampaigns.flatMap((c) => c.submissions)];
const allThreads: Thread[] = [...demoThreads, ...generatedThreads];
const allMessages = [...demoMessages, ...generatedMessages];

const allTransactions: Transaction[] = [
  ...brandTopups,
  ...generatedCampaigns.flatMap((c) => c.transactions),
  // Demo seeded txs
  { id: 'tx_d1', at: dayAgo(14), userId: 'u_hannah', kind: 'escrow_hold',   amount: -5_400, status: 'cleared', campaignId: 'cmp_1', note: 'Escrow · Spring Renewal' },
  { id: 'tx_d4', at: dayAgo(120), userId: 'u_marcus', kind: 'escrow_hold',  amount: -12_000, status: 'cleared', campaignId: 'cmp_4', note: 'Escrow · Holiday Tables' },
  { id: 'tx_d5', at: dayAgo(90),  userId: 'u_marcus', kind: 'escrow_release', amount: -3_000, status: 'cleared', campaignId: 'cmp_4', counterpartyUserId: 'u_amir', note: 'Payout to Amir Hussain · Holiday Tables' },
  { id: 'tx_d6', at: dayAgo(90),  userId: 'u_amir',   kind: 'payout',         amount:  3_000, status: 'cleared', campaignId: 'cmp_4', counterpartyUserId: 'u_marcus', note: 'Payout received · Holiday Tables' },
  { id: 'tx_d7', at: dayAgo(60),  userId: 'u_sarah',  kind: 'payout',         amount:  2_400, status: 'cleared', campaignId: 'cmp_4', note: 'Payout · prior campaign' },
];

// ============ LANDING-PAGE TESTIMONIALS (Phase 48) ============
// Each quote names a real seeded campaign so the rendering layer can pull
// the deal title + cleared amount alongside the speaker. shownTo controls
// audience: 'brand' = creator voice rendered as proof to visiting brands;
// 'creator' = brand-contact voice rendered as proof to visiting creators.
//
// Quotes are written for Alamut's positioning (no outreach, escrow-secured,
// receipts on profiles). Tone: short, direct, names a number or a verb.
const seededTestimonials: import('./types').Testimonial[] = [
  {
    id: 'tm_1',
    shownTo: 'brand',
    quote:
      "Three brand deals through Alamut in 90 days. Two of them were brands I'd been DM'ing for over a year with no reply.",
    authorName: 'Sarah Johnson',
    authorSubtitle: '@sarahstyle',
    authorPortrait: upx(PORTRAITS[0], 200, 200),
    campaignId: 'cmp_4',
  },
  {
    id: 'tm_2',
    shownTo: 'brand',
    quote:
      "I set my rate. Counter-offered the first one. They came back the same day. The whole thing felt like booking a venue, not begging for a meeting.",
    authorName: 'Amir Hussain',
    authorSubtitle: '@amircooks',
    authorPortrait: upx(PORTRAITS[1], 200, 200),
    campaignId: 'cmp_4',
  },
  {
    id: 'tm_3',
    shownTo: 'creator',
    quote:
      "Posted the brief on Tuesday. Six pitches in by Thursday. Picked one, work shipped Sunday. Outperformed our last agency campaign and cost a third of it.",
    authorName: 'Maya Tanaka',
    authorSubtitle: 'Marketing Lead, Le Creuset',
    authorPortrait: upx('https://images.unsplash.com/photo-1573496359142-b8d87734a5a2', 200, 200),
    campaignId: 'cmp_2',
  },
  // Phase 52b — expanded testimonials wall.
  // Tier 3.2 (Phase 53) — trimmed 12 → 8 to reduce information density
  // on the voices wall. Cuts: tm_4 (Anna/Aesop spreadsheets — overlaps
  // tm_9's agency-cost angle without a hard number), tm_7 (Marcus —
  // storefront-driven inbound covered elsewhere on the page), tm_8
  // (Lena — counter-offer mechanic already in tm_2), tm_12 (Hannah/
  // Aesop — Aesop already represented in the brand voices, and the
  // availability-windows angle is secondary). The 8 that remain each
  // ground a different mechanic: outbound-DM frustration vs platform
  // matching, set-rate-counter, hours-fast match, on-time-payout
  // streak (creator voices); end-to-end speed + cost-vs-agency arc,
  // hard dollar agency contrast, audience-fit vetting at scale, ROAS
  // attribution (brand voices).
  {
    id: 'tm_5',
    shownTo: 'brand',
    quote:
      "Applied to a brief at 9am Tuesday. Brand replied with the offer at 11. Locked the deal by lunch. Five years on Instagram and that's the fastest a brand has ever moved on me.",
    authorName: 'Yuki Tanaka',
    authorSubtitle: '@yuki.makes',
    authorPortrait: upx(PORTRAITS[2], 200, 200),
    campaignId: 'cmp_2',
  },
  {
    id: 'tm_6',
    shownTo: 'brand',
    quote:
      "Three campaigns through Alamut in 90 days. Three on-time payouts. The first time in five years that 'getting paid' hasn't been the most stressful part of the deal.",
    authorName: 'Priya Khan',
    authorSubtitle: '@priyamoves',
    authorPortrait: upx(PORTRAITS[3], 200, 200),
    campaignId: 'cmp_1',
  },
  {
    id: 'tm_9',
    shownTo: 'creator',
    quote:
      "We were paying our agency $18k a month for twelve posts. Alamut closed fourteen in the first month for under $9k. Same creator quality, none of the markup.",
    authorName: 'Daniel Rhee',
    authorSubtitle: 'Marketing Director, Hay',
    authorPortrait: upx('https://images.unsplash.com/photo-1556157382-97eda2d62296', 200, 200),
    campaignId: 'cmp_1',
  },
  {
    id: 'tm_10',
    shownTo: 'creator',
    quote:
      "We screened two hundred creators in thirty minutes. Audience overlap, past brands, language, region — already sorted on every application. Past us would have spent a week on that.",
    authorName: 'Sofia Martinez',
    authorSubtitle: 'Brand Manager, Glossier',
    authorPortrait: upx('https://images.unsplash.com/photo-1601412436009-d964bd02edbc', 200, 200),
    campaignId: 'cmp_3',
  },
  {
    id: 'tm_11',
    shownTo: 'creator',
    quote:
      "First campaign we could actually measure end-to-end. 6.8× ROAS, attribution down to the click. Our previous agency couldn't tell us if we were 2× or 12×.",
    authorName: 'James Holloway',
    authorSubtitle: 'Head of Growth, Le Labo',
    authorPortrait: upx('https://images.unsplash.com/photo-1568602471122-7832951cc4c5', 200, 200),
    campaignId: 'cmp_2',
  },
  // Phase-58 audit augmentation — add 7 more rows so the voices wall
  // feels substantial. Each quote names a different mechanic (negotiation
  // speed, audience verification, dispute resolution, instant payouts,
  // contract clarity, EOY tax docs, regional fit) so the rotation reads
  // varied across page loads.
  {
    id: 'tm_12',
    shownTo: 'brand',
    quote:
      "Set my floor rate, watched the first offer come in at 80% of it, countered, locked at my number. Took 36 minutes start to finish.",
    authorName: 'Léa Martin',
    authorSubtitle: '@lealifestyle',
    authorPortrait: upx('https://images.unsplash.com/photo-1531746020798-e6953c6e8e04', 200, 200),
    campaignId: 'cmp_1',
  },
  {
    id: 'tm_13',
    shownTo: 'brand',
    quote:
      "Brand tried to push scope after acceptance. Filed a dispute. Got a partial release within 48 hours. First platform where I didn't have to eat the loss.",
    authorName: 'Marcus Chen',
    authorSubtitle: '@marcuseats',
    authorPortrait: upx('https://images.unsplash.com/photo-1500648767791-00dcc994a43e', 200, 200),
    campaignId: 'cmp_4',
  },
  {
    id: 'tm_14',
    shownTo: 'brand',
    quote:
      "Withdraw to bank arrived in 14 hours after the brand approved. My last platform took six weeks and I had to chase three emails.",
    authorName: 'Ananya Rao',
    authorSubtitle: '@ananyatravel',
    authorPortrait: upx('https://images.unsplash.com/photo-1438761681033-6461ffad8d80', 200, 200),
    campaignId: 'cmp_2',
  },
  {
    id: 'tm_15',
    shownTo: 'creator',
    quote:
      "We're a small founder team — agencies wouldn't take our budget. Alamut got us 4 creators in our actual audience and 2 of them outperformed our paid social.",
    authorName: 'Elena Park',
    authorSubtitle: 'Co-founder, Notable',
    authorPortrait: upx('https://images.unsplash.com/photo-1580489944761-15a19d654956', 200, 200),
    campaignId: 'cmp_3',
  },
  {
    id: 'tm_16',
    shownTo: 'creator',
    quote:
      "Q1 tax statement was just sitting there in my wallet at the end of March. Every payout, every fee, every withholding line. Saved my accountant a week.",
    authorName: 'Diego Fernández',
    authorSubtitle: '@diegoshoots',
    authorPortrait: upx('https://images.unsplash.com/photo-1542909168-82c3e7fdca5c', 200, 200),
    campaignId: 'cmp_4',
  },
  {
    id: 'tm_17',
    shownTo: 'creator',
    quote:
      "Contract snapshot at acceptance is the killer feature. Brand tried to update the brief two weeks in — my signed scope didn't change. Slept fine that night.",
    authorName: 'Olivia Bennett',
    authorSubtitle: '@oliviabakes',
    authorPortrait: upx('https://images.unsplash.com/photo-1517841905240-472988babdf9', 200, 200),
    campaignId: 'cmp_1',
  },
  {
    id: 'tm_18',
    shownTo: 'brand',
    quote:
      "We needed Lahore + Karachi creators specifically. Filtered, shortlisted 8, offered 3, two accepted same day. No agency would have moved that fast on a regional brief.",
    authorName: 'Imran Sheikh',
    authorSubtitle: 'Brand Manager, National Foods',
    authorPortrait: upx('https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d', 200, 200),
    campaignId: 'cmp_3',
  },
];

// =====================================================================
// Demo-account pre-verification
// =====================================================================
//
// The demo world is a showcase: Sarah, Amir, Yuki, Aesop et al. exist so a
// visitor can see what a populated, working marketplace looks like. Leaving
// their metrics half-verified undercut that — Sarah's newsletter read
// "unverified", the 100+ generated network creators had verification decided
// by `chance()`, and no seeded creator had `kycVerifiedAt` at all, so every
// one of them failed the identity check on their own KYC page.
//
// Done as one normalization pass rather than editing ~20 scattered flags:
// it stays correct as the seed grows, and it's gated on the SAME demo
// predicates the rest of the app uses (`userId` without the `u_x_` real-user
// prefix), so it is structurally incapable of marking a real signup as
// verified. `demoData.test.ts` asserts that prefix invariant against this
// very seed.
//
// This does NOT contradict the honesty work: these accounts are labelled as
// demo wherever a real user can act on them. Verified demo data is set
// dressing, and it stays legible as such.

const DEMO_VERIFIED_AT = '2026-05-01T00:00:00.000Z';

function preVerifyDemoCreators(creators: Creator[]): Creator[] {
  return creators.map((c) => {
    if (!isDemoCreator(c)) return c;
    return {
      ...c,
      verified: true,
      kycVerifiedAt: c.kycVerifiedAt ?? DEMO_VERIFIED_AT,
      // Channel ownership confirmed on every listed platform — this is what
      // the matching scorer and the cold-start trust signals read.
      platforms: (c.platforms ?? []).map((pf) => ({ ...pf, verified: true })),
    };
  });
}

function preVerifyDemoBrands(brands: Brand[]): Brand[] {
  return brands.map((b) => (isDemoBrand(b) ? { ...b, verified: true } : b));
}

// =====================================================================
// Sample campaign performance
// =====================================================================
//
// The product has no platform integrations, so nothing measures reach,
// impressions or engagement. Previously `derivePerf` invented them at render
// time from follower counts and showed the result to everyone as fact.
//
// The demo still needs to show what a populated campaign looks like — that's
// the whole point of the seeded world — so the numbers live HERE, as authored
// data flagged `sample: true`, and the surfaces label them. A real brand's
// campaign has no row and shows an honest empty state instead.
//
// Authoring rather than deriving also makes the demo better: the shape is
// deliberate (a slow first week, a spike as the roster publishes, a long
// tail) instead of whatever `followers × 1.4` happened to produce, and it
// stays put when seed data changes.

/** Engagement per week, oldest first — a realistic publish-and-decay curve. */
function weeklyCurve(total: number, weeks: number): number[] {
  const shape = [0.06, 0.19, 0.21, 0.16, 0.13, 0.10, 0.08, 0.07];
  const w = shape.slice(0, weeks);
  const norm = w.reduce((s, n) => s + n, 0);
  return w.map((n) => Math.round((total * n) / norm));
}

/**
 * Build one authored performance row.
 *
 * `impressions` is the anchor and everything else is expressed against it,
 * so the ratios a reader computes (ER, CPM, CPE) land in believable ranges
 * rather than being asserted separately and disagreeing with each other.
 */
function samplePerf(params: {
  campaignId: string;
  impressions: number;
  /** Engagement rate as a percentage, e.g. 4.8. */
  erPct: number;
  /** Fraction of impressions that were unique accounts. */
  reachRatio: number;
  weeks: number;
  creatorIds: string[];
  /** Relative contribution per creator; normalized. Same length as ids. */
  weights: number[];
}): CampaignPerformance {
  const engagement = Math.round(params.impressions * (params.erPct / 100));
  const reach = Math.round(params.impressions * params.reachRatio);
  const wSum = params.weights.reduce((s, n) => s + n, 0) || 1;
  return {
    campaignId: params.campaignId,
    sample: true,
    impressions: params.impressions,
    reach,
    engagement,
    saves: Math.round(engagement * 0.14),
    shares: Math.round(engagement * 0.06),
    profileVisits: Math.round(reach * 0.041),
    weeklySeries: weeklyCurve(engagement, params.weeks),
    byCreator: params.creatorIds.map((creatorId, i) => {
      const share = params.weights[i] / wSum;
      return {
        creatorId,
        impressions: Math.round(params.impressions * share),
        engagement: Math.round(engagement * share),
      };
    }),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Performance rows for seeded campaigns that have live or paid creators.
 *
 * Derived from the seeded collaborations so the leaderboard names creators
 * who are genuinely on the campaign — the per-creator split is authored
 * (weights below), but WHO appears is real. The previous leaderboard ranked
 * creators by the ASCII codes of their database ids.
 */
function buildSamplePerformance(): CampaignPerformance[] {
  const rows: CampaignPerformance[] = [];
  // Deliberate variety so the demo shows a range, not one flat story:
  // a strong performer, a solid mid, and an efficient small campaign.
  const profiles = [
    { impressions: 1_840_000, erPct: 5.2, reachRatio: 0.62, weeks: 7 },
    { impressions: 920_000,   erPct: 4.1, reachRatio: 0.66, weeks: 6 },
    { impressions: 410_000,   erPct: 6.8, reachRatio: 0.71, weeks: 5 },
    { impressions: 2_600_000, erPct: 3.4, reachRatio: 0.58, weeks: 8 },
    { impressions: 615_000,   erPct: 4.9, reachRatio: 0.64, weeks: 6 },
  ];

  const eligible = allCampaigns.filter((c) => c.stage === 'live' || c.stage === 'closed');
  eligible.forEach((camp, i) => {
    // Creators with an accepted offer on this campaign — the roster that
    // would actually have published.
    const creatorIds = Array.from(new Set(
      allOffers
        .filter((o) => o.campaignId === camp.id && o.status === 'accepted')
        .map((o) => o.creatorId),
    ));
    if (creatorIds.length === 0) return;
    const p = profiles[i % profiles.length];
    // Descending weights: someone always outperforms, which is the
    // interesting thing a brand looks for.
    const weights = creatorIds.map((_, k) => 100 - k * 17);
    rows.push(samplePerf({ campaignId: camp.id, ...p, creatorIds, weights }));
  });
  return rows;
}

export const SEED: Database = {
  users: allUsers,
  creators: preVerifyDemoCreators([...allCreators, ...pendingApplications.map((p) => p.creator)]),
  brands: preVerifyDemoBrands(allBrands),
  campaigns: allCampaigns,
  applications: allApplications,
  offers: allOffers,
  submissions: allSubmissions,
  threads: allThreads,
  messages: allMessages,
  transactions: allTransactions,
  notifications,
  reviews: [...seededReviews, ...generatedCampaignReviews],
  disputes: seededDisputes,
  referrals: seededReferrals,
  advances: seededAdvances,
  testimonials: seededTestimonials,
  campaignPerformance: buildSamplePerformance(),
  // P1c §1.1 — Collaborations are materialized by migrator 3 from the
  // seeded apps/offers/submissions on first hydrate. Seeding the empty
  // array here means migrator 3's idempotent guard works correctly:
  // first-load runs the migrator (since `collaborations.length === 0`),
  // subsequent loads skip (since `collaborations.length > 0`).
  // Only the authored `invited` rows. Every other collaboration is DERIVED
  // from applications/offers/submissions by migrator P1c on first hydrate —
  // seeding those too would mean two sources of truth for the same pair.
  collaborations: seededInvitedCollabs,
  // P1d §1.5 — Same pattern as collaborations: migrator 4 walks every
  // campaign on first hydrate and parses its `deliverablesText` into N
  // structured Deliverable rows + writes the FK list back to the
  // campaign. Seeded empty here so the idempotent length-based guard
  // inside migrator 4 works correctly.
  deliverables: [],
  // P2 §1.3 — Contracts are materialized by migrator 5 from every
  // Collaboration whose stage indicates an accepted offer (>= 'confirmed').
  // Empty here so the idempotent length-based guard inside migrator 5
  // works correctly on first hydrate.
  contracts: [],
  // P4 §3.1 — time-based notification queue. Empty on fresh load —
  // mutations enqueue rows as they create future events; the scheduler
  // heartbeat emits them when their `triggerAt` passes.
  scheduledNotifications: [],
  // P6 §5.3 — brand-side soft outreach. Empty on fresh load; populated
  // by `v2SendOutreach` when the brand reaches out via Spark.
  outreach: [],
  // Phase 14 — team invites are brand-owner-created in the live app.
  teamInvites: [],
  // Phase 15 — Spark drafts are user-created at Save time; no seed.
  sparkDrafts: [],
};
