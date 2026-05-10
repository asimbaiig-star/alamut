// Alamut v3 — domain data: campaigns, brands, invites, messages, transactions

const V3_BRANDS = [
  { id: 'b01', name: 'Aesop', industry: 'Beauty', mark: 'Æ', tone: 'oklch(0.55 0.06 70)' },
  { id: 'b02', name: 'Tracksmith', industry: 'Sports', mark: 'T', tone: 'oklch(0.50 0.10 30)' },
  { id: 'b03', name: 'Le Creuset', industry: 'Home', mark: 'LC', tone: 'oklch(0.50 0.13 30)' },
  { id: 'b04', name: 'Hay', industry: 'Design', mark: 'H', tone: 'oklch(0.45 0.04 280)' },
  { id: 'b05', name: 'Everlane', industry: 'Apparel', mark: 'E', tone: 'oklch(0.30 0.01 0)' },
  { id: 'b06', name: 'Peak Design', industry: 'Tech / Gear', mark: 'PD', tone: 'oklch(0.45 0.06 250)' },
  { id: 'b07', name: 'Waitrose', industry: 'Grocery', mark: 'W', tone: 'oklch(0.45 0.10 150)' },
];

// Campaigns from Brand POV; same shape used by Creator views (filtered by participation).
const V3_CAMPAIGNS = [
  {
    id: 'cm01',
    title: 'Spring Renewal Edit',
    brandId: 'b01',
    stage: 'production',
    objective: 'Awareness for the new Hwyl candle line',
    budget: 28000, spent: 14400,
    deliverables: '1× Reel + 2× Stories per creator',
    deadline: 'May 24',
    progress: 62,
    invited: 8, accepted: 5, posted: 1,
    reach: 0, // forecast vs actual handled in detail
    forecastReach: 1_400_000,
    pitch: 'Quiet, considered moments with the new Hwyl range. Looking for taste-makers who treat product as ritual.',
    region: 'US, UK',
    appsCount: 14,
    cover: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=900&h=600&fit=crop',
    creators: ['c01', 'c03', 'c04', 'c06'],
  },
  {
    id: 'cm02',
    title: 'London Marathon Build-Up',
    brandId: 'b02',
    stage: 'shortlist',
    objective: 'Pre-race storytelling, runners ages 28–45',
    budget: 42000, spent: 0,
    deliverables: '1× YouTube long-form + 3× Reels',
    deadline: 'Apr 21',
    progress: 18,
    invited: 12, accepted: 0, posted: 0,
    forecastReach: 2_100_000,
    pitch: 'Real runners. Real training cycles. We want the sweat — not the sponsor copy.',
    region: 'UK, EU',
    appsCount: 22,
    cover: 'https://images.unsplash.com/photo-1552674605-db6ffd4facb5?w=900&h=600&fit=crop',
    creators: ['c05', 'c02'],
  },
  {
    id: 'cm03',
    title: 'Cookbook Launch — Weeknights',
    brandId: 'b03',
    stage: 'offer',
    objective: 'Drive pre-orders for Apr 12 launch',
    budget: 18500, spent: 0,
    deliverables: '1× Reel using Le Creuset cast iron',
    deadline: 'Apr 09',
    progress: 32,
    invited: 4, accepted: 1, posted: 0,
    forecastReach: 720_000,
    pitch: 'Cookbook cross-promo. Looking for food creators with strong styling, not just recipe accounts.',
    region: 'Worldwide',
    appsCount: 6,
    cover: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=900&h=600&fit=crop',
    creators: ['c03'],
  },
  {
    id: 'cm04',
    title: 'New Showroom — Copenhagen',
    brandId: 'b04',
    stage: 'live',
    objective: 'Local awareness for the May 03 opening',
    budget: 12000, spent: 0,
    deliverables: '1× event coverage + 2× behind-the-scenes',
    deadline: 'May 03',
    progress: 8,
    invited: 0, accepted: 0, posted: 0,
    forecastReach: 380_000,
    pitch: 'Northern-EU based design + interiors creators. Visit the new Sølvgade showroom on opening week.',
    region: 'EU',
    appsCount: 9,
    cover: 'https://images.unsplash.com/photo-1493663284031-b7e3aefcae8e?w=900&h=600&fit=crop',
    creators: [],
  },
  {
    id: 'cm05',
    title: 'Everyday Capsule SS25',
    brandId: 'b05',
    stage: 'reporting',
    objective: 'Post-launch performance + UGC',
    budget: 36000, spent: 32400,
    deliverables: '1× Reel + 1× Carousel',
    deadline: 'Mar 18',
    progress: 92,
    invited: 14, accepted: 9, posted: 9,
    forecastReach: 1_900_000,
    actualReach: 2_240_000,
    pitch: 'Closed: pulling reporting + final invoices. 9/9 deliverables landed.',
    region: 'US',
    appsCount: 28,
    cover: 'https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=900&h=600&fit=crop',
    creators: ['c01', 'c06'],
  },
  {
    id: 'cm06',
    title: 'Travel Essentials Q2',
    brandId: 'b06',
    stage: 'draft',
    objective: 'TBD',
    budget: 22000, spent: 0,
    deliverables: 'TBD',
    deadline: '—',
    progress: 0,
    invited: 0, accepted: 0, posted: 0,
    forecastReach: 0,
    pitch: 'Brief in progress.',
    region: 'TBD',
    appsCount: 0,
    cover: 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=900&h=600&fit=crop',
    creators: [],
  },
  {
    id: 'cm07',
    title: 'Easter Bake-Along',
    brandId: 'b07',
    stage: 'posted',
    objective: 'Recipe inspiration drive',
    budget: 9500, spent: 9500,
    deliverables: '1× Reel + 2× Stories',
    deadline: 'Mar 30',
    progress: 100,
    invited: 3, accepted: 3, posted: 3,
    forecastReach: 540_000,
    actualReach: 612_000,
    pitch: 'Easter recipe drop. Posted, awaiting performance pull-through.',
    region: 'UK',
    appsCount: 5,
    cover: 'https://images.unsplash.com/photo-1464454709131-ffd692591ee5?w=900&h=600&fit=crop',
    creators: ['c03'],
  },
];

// Creator inbox threads
const V3_THREADS_CREATOR = [
  { id: 't1', who: 'Aesop', sub: 'Spring Renewal Edit', last: 'Draft looks great — one tiny note on the second still…', time: '2h', unread: true,
    msgs: [
      { from: 'them', text: 'Hi Sarah! Sharing the brief now. Excited to have you on this one.', t: 'Mon 09:14' },
      { from: 'me', text: 'Got it, reviewing today. The mood is exactly what I had in mind for April content.', t: 'Mon 11:02' },
      { from: 'them', text: 'Draft looks great — one tiny note on the second still: can we shift the candle a bit further from the window?', t: '2h' },
    ] },
  { id: 't2', who: 'Le Creuset', sub: 'Cookbook Launch', last: 'Offer attached — let us know by Friday.', time: '1d', unread: true,
    msgs: [
      { from: 'them', text: 'Offer attached — let us know by Friday.', t: '1d' },
    ] },
  { id: 't3', who: 'Tracksmith', sub: 'Marathon Build-Up application', last: 'Thanks for the application — shortlist closes Apr 12.', time: '3d',
    msgs: [
      { from: 'me', text: 'Submitted my pitch + 3 reference reels.', t: '3d' },
      { from: 'them', text: 'Thanks for the application — shortlist closes Apr 12.', t: '3d' },
    ] },
  { id: 't4', who: 'Alamut · Concierge', sub: 'Profile verification', last: 'Verification approved — your badge is live.', time: '1w' },
];

const V3_THREADS_BRAND = [
  { id: 't1', who: 'Sarah Johnson', sub: 'Spring Renewal Edit', last: 'Drafts uploaded — let me know what you think.', time: '2h', unread: true },
  { id: 't2', who: 'Marcus Chen', sub: 'Marathon Build-Up application', last: 'Pitch attached + treatment doc.', time: '5h', unread: true },
  { id: 't3', who: 'Ayaan Patel', sub: 'Cookbook Launch', last: 'Confirmed for Apr 09 shoot.', time: '1d' },
  { id: 't4', who: 'Iris Vanderberg', sub: 'Spring Renewal Edit', last: 'Posted the carousel this morning.', time: '2d' },
  { id: 't5', who: 'Alamut · Concierge', sub: 'Wallet top-up confirmation', last: 'Top-up of $25,000 cleared.', time: '4d' },
];

// Creator invitations awaiting response
const V3_INVITES = [
  { id: 'iv1', brandId: 'b03', campaignId: 'cm03', fit: 96, note: 'Cookbook cross-promo. Strong food styling, recipe-developer voice — exactly the brand tone we want for the Apr 12 launch.', budget: '$2.4k', deadline: 'Apr 09' },
  { id: 'iv2', brandId: 'b07', campaignId: 'cm07', fit: 88, note: 'Easter Bake-Along — UK-based food creators, reach 200k+. Quick-turn (5 day), strong styling required.', budget: '$1.8k', deadline: 'Mar 27' },
];

// Creator transactions / payouts
const V3_TX_CREATOR = [
  { id: 'tx1', date: '2026-04-12', camp: 'Spring Renewal Edit',  brand: 'Aesop',     amt: 1800, status: 'pending',    type: 'milestone' },
  { id: 'tx2', date: '2026-04-04', camp: 'Easter Bake-Along',    brand: 'Waitrose',  amt: 1600, status: 'processing', type: 'invoice' },
  { id: 'tx3', date: '2026-03-28', camp: 'Everyday Capsule SS25',brand: 'Everlane',  amt: 2400, status: 'paid',       type: 'milestone' },
  { id: 'tx4', date: '2026-03-14', camp: 'Slow Home Series',     brand: 'Hay',       amt: 3200, status: 'paid',       type: 'milestone' },
  { id: 'tx5', date: '2026-02-22', camp: 'Cast Iron Heritage',   brand: 'Le Creuset',amt: 1500, status: 'paid',       type: 'invoice' },
];

// Brand wallet transactions
const V3_TX_BRAND = [
  { id: 'wt1', date: '2026-04-14', label: 'Top-up · Wire',         amt:  25000, dir: 'in' },
  { id: 'wt2', date: '2026-04-12', label: 'Escrow · Spring Renewal', amt: -14400, dir: 'out' },
  { id: 'wt3', date: '2026-04-09', label: 'Payout · Cookbook',      amt:  -2400, dir: 'out' },
  { id: 'wt4', date: '2026-03-30', label: 'Payout · Easter Bake-Along', amt: -4800, dir: 'out' },
  { id: 'wt5', date: '2026-03-18', label: 'Top-up · Card',          amt:  10000, dir: 'in' },
];

// Brand approvals queue (drafts pending review)
const V3_APPROVALS = [
  { id: 'ap1', creatorId: 'c01', campaignId: 'cm01', name: 'Reel — Take 2', img: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=400&h=400&fit=crop', due: 'Today', round: 2 },
  { id: 'ap2', creatorId: 'c03', campaignId: 'cm03', name: 'Reel — First draft', img: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=400&h=400&fit=crop', due: 'Tomorrow', round: 1 },
  { id: 'ap3', creatorId: 'c04', campaignId: 'cm01', name: 'Carousel — 4 stills', img: 'https://images.unsplash.com/photo-1524758631624-e2822e304c36?w=400&h=400&fit=crop', due: 'Apr 16', round: 1 },
  { id: 'ap4', creatorId: 'c06', campaignId: 'cm01', name: 'Story — set of 3', img: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?w=400&h=400&fit=crop', due: 'Apr 18', round: 1 },
];

// Recommended campaigns for Creator dashboard (filtered subset of live + open ones)
const V3_RECOMMENDED = ['cm04', 'cm03', 'cm02'];

Object.assign(window, {
  V3_BRANDS, V3_CAMPAIGNS,
  V3_THREADS_CREATOR, V3_THREADS_BRAND,
  V3_INVITES, V3_TX_CREATOR, V3_TX_BRAND, V3_APPROVALS, V3_RECOMMENDED,
});
