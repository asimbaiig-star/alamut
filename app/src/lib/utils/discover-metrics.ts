// Discover-page filter machinery + match scoring (Phase 9).
//
// Two surfaces share these helpers: brand → creator discovery, and
// creator → campaign discovery. Each side gets a typed filter bag, a
// pure `apply*` predicate, URL serialization, preset definitions, and
// a transparent match-score function used to rank "for you" rails.
//
// Match scoring is intentionally simple — category overlap, region
// match, tier compatibility, recency. The AI Match modal still exists
// for richer "concierge" matching with reasoning; this is the cheap
// always-on scoring used to populate the "Recommended" rail.

import { REF_DATE } from './campaign-metrics';
import { isCreatorAccepted } from '@/lib/api/relations';
import type {
  Brand, Campaign, Creator, CreatorTier, Database,
} from '@/lib/api/types';

// ============================================================
// Brand → Creator
// ============================================================

export interface CreatorFilters {
  tiers: Set<CreatorTier>;
  categories: Set<string>;
  regions: Set<string>;       // matches creator.country or creator.city
  verifiedOnly: boolean;
  availableOnly: boolean;
  savedOnly: boolean;
  minRating: number;          // 0..5
  search: string;
}

export function emptyCreatorFilters(): CreatorFilters {
  return {
    tiers: new Set<CreatorTier>(),
    categories: new Set<string>(),
    regions: new Set<string>(),
    verifiedOnly: false,
    availableOnly: false,
    savedOnly: false,
    minRating: 0,
    search: '',
  };
}

export function applyCreatorFilters(
  creators: Creator[],
  filters: CreatorFilters,
  saved: Set<string>,
): Creator[] {
  const q = filters.search.trim().toLowerCase();
  return creators.filter((c) => {
    if (filters.savedOnly && !saved.has(c.id)) return false;
    if (filters.tiers.size > 0 && !filters.tiers.has(c.tier)) return false;
    if (filters.categories.size > 0 && !c.categories.some((cat) => filters.categories.has(cat))) return false;
    if (filters.regions.size > 0 && !filters.regions.has(c.country) && !filters.regions.has(c.city)) return false;
    if (filters.verifiedOnly && !c.verified) return false;
    if (filters.availableOnly && c.availability && c.availability.status === 'booked') return false;
    if (filters.minRating > 0 && (c.rating || 0) < filters.minRating) return false;
    if (q) {
      const hay = [c.name, c.handle, c.tagline, c.city, c.country, ...c.categories, ...c.languages].join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

export function activeCreatorFilterCount(f: CreatorFilters): number {
  let n = 0;
  if (f.tiers.size > 0) n++;
  if (f.categories.size > 0) n++;
  if (f.regions.size > 0) n++;
  if (f.verifiedOnly) n++;
  if (f.availableOnly) n++;
  if (f.savedOnly) n++;
  if (f.minRating > 0) n++;
  return n;
}

export function creatorFiltersToParams(f: CreatorFilters): URLSearchParams {
  const p = new URLSearchParams();
  if (f.tiers.size > 0) p.set('tiers', [...f.tiers].join(','));
  if (f.categories.size > 0) p.set('cats', [...f.categories].join(','));
  if (f.regions.size > 0) p.set('regions', [...f.regions].join(','));
  if (f.verifiedOnly) p.set('verified', '1');
  if (f.availableOnly) p.set('available', '1');
  if (f.savedOnly) p.set('saved', '1');
  if (f.minRating > 0) p.set('rating', String(f.minRating));
  return p;
}

export function creatorFiltersFromParams(p: URLSearchParams): CreatorFilters {
  const f = emptyCreatorFilters();
  const t = p.get('tiers');
  if (t) t.split(',').forEach((x) => f.tiers.add(x as CreatorTier));
  const c = p.get('cats');
  if (c) c.split(',').forEach((x) => f.categories.add(x));
  const r = p.get('regions');
  if (r) r.split(',').forEach((x) => f.regions.add(x));
  if (p.get('verified') === '1') f.verifiedOnly = true;
  if (p.get('available') === '1') f.availableOnly = true;
  if (p.get('saved') === '1') f.savedOnly = true;
  const rt = Number(p.get('rating'));
  if (rt > 0) f.minRating = rt;
  return f;
}

// Sort options
export type CreatorSort = 'recommended' | 'reach' | 'engagement' | 'rating' | 'reply';

export function sortCreators(
  creators: Creator[],
  sort: CreatorSort,
  scoreFn?: (c: Creator) => number,
): Creator[] {
  const list = [...creators];
  if (sort === 'reach')      list.sort((a, b) => b.reach - a.reach);
  else if (sort === 'engagement') list.sort((a, b) => b.engagement - a.engagement);
  else if (sort === 'rating') list.sort((a, b) => (b.rating || 0) - (a.rating || 0));
  else if (sort === 'reply')  list.sort((a, b) => a.responseHrs - b.responseHrs);
  else if (scoreFn) list.sort((a, b) => scoreFn(b) - scoreFn(a));
  return list;
}

// Match score for a brand → creator. Returns { score, reasons[] } so
// the rail can show *why* this creator surfaced.
export interface MatchScore {
  score: number;     // 0..1
  reasons: string[];
}

export function creatorMatchForBrand(creator: Creator, brand: Brand, db: Database): MatchScore {
  const reasons: string[] = [];
  let score = 0;

  // Category overlap with brand's preferred categories or past campaigns
  const brandCats = new Set(brand.preferredCategories);
  db.campaigns
    .filter((c) => c.brandId === brand.id)
    .forEach((c) => brandCats.add(c.category));
  const catMatches = creator.categories.filter((c) => brandCats.has(c));
  if (catMatches.length > 0) {
    score += 0.35;
    reasons.push(`Matches ${catMatches[0]}`);
  }

  // Region overlap
  const brandRegs = new Set(brand.preferredRegions);
  if (brandRegs.has(creator.country) || brandRegs.has(creator.city)) {
    score += 0.2;
    reasons.push(`In ${creator.country}`);
  }

  // Tier — flagship and specialist score higher; rising tier discounted unless cat-match
  if (creator.tier === 'Flagship') score += 0.15;
  else if (creator.tier === 'Specialist') score += 0.10;
  else if (creator.tier === 'Rising' && catMatches.length > 0) score += 0.06;

  // Verified
  if (creator.verified) {
    score += 0.10;
    reasons.push('Verified');
  }

  // Rating
  if (creator.rating >= 4.6) {
    score += 0.10;
    reasons.push('★ ' + creator.rating.toFixed(1));
  } else if (creator.rating >= 4.2) {
    score += 0.06;
  }

  // Availability
  if (creator.availability?.status === 'open') {
    score += 0.05;
    reasons.push('Open for work');
  }

  // Already worked together — small penalty for novelty in the rail
  const worked = db.campaigns.some(
    (c) => c.brandId === brand.id && isCreatorAccepted(c.id, creator.id, db),
  );
  if (worked) {
    score -= 0.05;  // subtle nudge to surface fresh matches
  }

  return { score: Math.max(0, Math.min(1, score)), reasons: reasons.slice(0, 3) };
}

export function rankedCreatorsForBrand(brand: Brand, db: Database, limit = 6): { creator: Creator; match: MatchScore }[] {
  return db.creators
    .map((creator) => ({ creator, match: creatorMatchForBrand(creator, brand, db) }))
    .filter(({ match }) => match.score >= 0.25)
    .sort((a, b) => b.match.score - a.match.score)
    .slice(0, limit);
}

// ============================================================
// Creator → Campaign
// ============================================================

export interface CampaignDiscoverFilters {
  categories: Set<string>;
  regions: Set<string>;
  pricing: 'any' | 'fixed' | 'outcome' | 'retainer';
  /** "Closing soon" toggle — within 7 days. */
  closingSoon: boolean;
  /** Minimum budget (USD). */
  minBudget: number;
  hideApplied: boolean;
  search: string;
}

export function emptyCampaignDiscoverFilters(): CampaignDiscoverFilters {
  return {
    categories: new Set<string>(),
    regions: new Set<string>(),
    pricing: 'any',
    closingSoon: false,
    minBudget: 0,
    hideApplied: false,
    search: '',
  };
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function applyCampaignFilters(
  campaigns: Campaign[],
  brands: Brand[],
  filters: CampaignDiscoverFilters,
  myAppliedIds: Set<string>,
  ref: Date = REF_DATE,
): Campaign[] {
  const q = filters.search.trim().toLowerCase();
  return campaigns.filter((c) => {
    if (filters.hideApplied && myAppliedIds.has(c.id)) return false;
    if (filters.categories.size > 0 && !filters.categories.has(c.category)) return false;
    if (filters.regions.size > 0 && !filters.regions.has(c.region)) return false;
    if (filters.pricing === 'fixed' && c.pricingModel === 'outcome') return false;
    if (filters.pricing === 'outcome' && c.pricingModel !== 'outcome') return false;
    if (filters.pricing === 'retainer' && c.kind !== 'retainer') return false;
    if (filters.minBudget > 0 && c.budget < filters.minBudget) return false;
    if (filters.closingSoon) {
      const d = parseDeadlineSafe(c.deadline, ref);
      if (!d) return false;
      const daysLeft = Math.round((+d - +ref) / DAY_MS);
      if (daysLeft < 0 || daysLeft > 7) return false;
    }
    if (q) {
      const brand = brands.find((b) => b.id === c.brandId);
      const hay = [c.title, c.pitch, c.brief, c.category, brand?.name || ''].join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

function parseDeadlineSafe(deadline: string, ref: Date): Date | null {
  if (!deadline) return null;
  const lower = deadline.toLowerCase().trim();
  if (lower === 'today') return new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
  if (lower === 'tomorrow') {
    const d = new Date(ref); d.setDate(d.getDate() + 1); return d;
  }
  const m = lower.match(/^(\d+)\s*days?$/);
  if (m) { const d = new Date(ref); d.setDate(d.getDate() + Number(m[1])); return d; }
  const parsed = new Date(`${deadline} ${ref.getFullYear()}`);
  if (!isNaN(parsed.getTime())) return parsed;
  const parsed2 = new Date(deadline);
  if (!isNaN(parsed2.getTime())) return parsed2;
  return null;
}

export function activeCampaignDiscoverFilterCount(f: CampaignDiscoverFilters): number {
  let n = 0;
  if (f.categories.size > 0) n++;
  if (f.regions.size > 0) n++;
  if (f.pricing !== 'any') n++;
  if (f.closingSoon) n++;
  if (f.minBudget > 0) n++;
  if (f.hideApplied) n++;
  return n;
}

export function campaignDiscoverFiltersToParams(f: CampaignDiscoverFilters): URLSearchParams {
  const p = new URLSearchParams();
  if (f.categories.size > 0) p.set('cats', [...f.categories].join(','));
  if (f.regions.size > 0) p.set('regions', [...f.regions].join(','));
  if (f.pricing !== 'any') p.set('pricing', f.pricing);
  if (f.closingSoon) p.set('closing', '1');
  if (f.minBudget > 0) p.set('minBudget', String(f.minBudget));
  if (f.hideApplied) p.set('hideApplied', '1');
  return p;
}

export function campaignDiscoverFiltersFromParams(p: URLSearchParams): CampaignDiscoverFilters {
  const f = emptyCampaignDiscoverFilters();
  const c = p.get('cats');
  if (c) c.split(',').forEach((x) => f.categories.add(x));
  const r = p.get('regions');
  if (r) r.split(',').forEach((x) => f.regions.add(x));
  const pricing = p.get('pricing');
  if (pricing === 'fixed' || pricing === 'outcome' || pricing === 'retainer') f.pricing = pricing;
  if (p.get('closing') === '1') f.closingSoon = true;
  const m = Number(p.get('minBudget'));
  if (m > 0) f.minBudget = m;
  if (p.get('hideApplied') === '1') f.hideApplied = true;
  return f;
}

export type CampaignSort = 'recommended' | 'budget' | 'deadline' | 'recent' | 'applicants';

export function sortCampaigns(
  campaigns: Campaign[],
  sort: CampaignSort,
  scoreFn?: (c: Campaign) => number,
  ref: Date = REF_DATE,
): Campaign[] {
  const list = [...campaigns];
  if (sort === 'budget') list.sort((a, b) => b.budget - a.budget);
  else if (sort === 'deadline') {
    list.sort((a, b) => {
      const aD = parseDeadlineSafe(a.deadline, ref) || new Date(8640000000000000);
      const bD = parseDeadlineSafe(b.deadline, ref) || new Date(8640000000000000);
      return +aD - +bD;
    });
  } else if (sort === 'recent') {
    list.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  } else if (sort === 'applicants') {
    list.sort((a, b) => a.applications.length - b.applications.length); // less competition first
  } else if (scoreFn) {
    list.sort((a, b) => scoreFn(b) - scoreFn(a));
  }
  return list;
}

// Match score for creator → campaign
export function campaignMatchForCreator(campaign: Campaign, creator: Creator): MatchScore {
  const reasons: string[] = [];
  let score = 0;

  const myCats = new Set(creator.categories.map((c) => c.toLowerCase()));
  if (myCats.has(campaign.category.toLowerCase())) {
    score += 0.4;
    reasons.push(`Matches ${campaign.category}`);
  }

  if (campaign.region === creator.country || campaign.region === creator.city) {
    score += 0.2;
    reasons.push(`In ${campaign.region}`);
  }

  if (campaign.editorsPick) {
    score += 0.15;
    reasons.push("★ Editor's pick");
  }

  // Budget heuristic — bigger budgets get a small boost (more upside)
  if (campaign.budget >= 10000) score += 0.10;
  else if (campaign.budget >= 5000) score += 0.05;

  if (campaign.kind === 'retainer') {
    score += 0.05;
    reasons.push('Retainer');
  }

  // Recency — boost recent listings
  const daysOld = (+REF_DATE - +new Date(campaign.createdAt)) / DAY_MS;
  if (daysOld <= 3) {
    score += 0.10;
    reasons.push('Just posted');
  } else if (daysOld <= 7) {
    score += 0.05;
  }

  return { score: Math.max(0, Math.min(1, score)), reasons: reasons.slice(0, 3) };
}

export function rankedCampaignsForCreator(
  creator: Creator,
  campaigns: Campaign[],
  myAppliedIds: Set<string>,
  limit = 6,
): { campaign: Campaign; match: MatchScore }[] {
  return campaigns
    .filter((c) => c.stage === 'live' && !myAppliedIds.has(c.id))
    .map((campaign) => ({ campaign, match: campaignMatchForCreator(campaign, creator) }))
    .filter(({ match }) => match.score >= 0.25)
    .sort((a, b) => b.match.score - a.match.score)
    .slice(0, limit);
}

// ============================================================
// Helpers
// ============================================================

export function uniqueCategories(creators: Creator[]): string[] {
  const set = new Set<string>();
  creators.forEach((c) => c.categories.forEach((cat) => set.add(cat)));
  return [...set].sort();
}

export function uniqueRegions(creators: Creator[]): string[] {
  const set = new Set<string>();
  creators.forEach((c) => set.add(c.country));
  return [...set].sort();
}

export function uniqueCampaignCategories(campaigns: Campaign[]): string[] {
  const set = new Set<string>();
  campaigns.forEach((c) => set.add(c.category));
  return [...set].sort();
}

export function uniqueCampaignRegions(campaigns: Campaign[]): string[] {
  const set = new Set<string>();
  campaigns.forEach((c) => set.add(c.region));
  return [...set].sort();
}

// Parse-deadline helper exposed for callers that need it.
export { parseDeadlineSafe };
