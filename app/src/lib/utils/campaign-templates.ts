// Campaign templates (Phase 23).
//
// Two tiers:
//   1. Curated PLATFORM templates — bundled with the app, opinionated
//      starter playbooks ("Spring product launch", "Brand-awareness reel
//      series", "Outcome-based affiliate"). Used as a starting point;
//      brand can edit any field after applying.
//   2. Saved BRAND templates — persisted to localStorage per brand id,
//      created via "Save as template" in the campaign creation flow.
//
// Storage key: `alamut:templates:<brandId>`. Schema versioned for forward-
// compat. Cap at 20 saved per brand.

import type { CampaignKind, ContentRights, OutcomePricing, PricingModel } from '@/lib/api/types';

export interface CampaignTemplate {
  id: string;
  name: string;
  /** "platform" templates ship with the app; "brand" templates are user-saved. */
  source: 'platform' | 'brand';
  /** Optional one-line description shown in the picker. */
  description?: string;
  /** The template's content — same shape as NewCampaignModal's stateful inputs. */
  data: {
    title?: string;
    pitch?: string;
    brief?: string;
    budget?: number;
    category?: string;
    region?: string;
    deliverables?: string;
    cover?: string;
    rights?: ContentRights;
    kind?: CampaignKind;
    retainerTerm?: number;
    pricingModel?: PricingModel;
    outcomePricing?: OutcomePricing;
  };
  createdAt?: string;
}

// ============================================================
// Curated platform templates — keep modest in number, opinionated.
// ============================================================

export const PLATFORM_TEMPLATES: CampaignTemplate[] = [
  {
    id: 'pl-spring-launch',
    name: 'Spring product launch',
    source: 'platform',
    description: '4-week reel push around a new SKU. Perpetual repurpose rights, $12k median budget.',
    data: {
      title: '',
      pitch: 'New product launch — looking for editorial creators who can frame the drop in their voice, with a clear hook and on-brand restraint.',
      brief: `LAUNCH BRIEF\n\nWhat we're shipping: <product>\nWho it's for: <audience>\nWhat we want from you:\n  · 1 Reel (60-90s) showing the product in real use\n  · 2 supporting Stories with the swipe-up\n\nMust-haves:\n  · Natural lighting, no overproduced sets\n  · Voiceover or on-camera narration\n  · "Available now" CTA in the last 5 seconds\n\nAvoid:\n  · Direct-comparison footage with competitors\n  · Trendsong audio that'll date the post in a month`,
      budget: 12000,
      category: 'Lifestyle',
      region: 'US/UK',
      deliverables: '1 Reel + 2 stories',
      cover: 'https://images.unsplash.com/photo-1556228453-efd6c1ff04f6?w=800&h=600&fit=crop',
      rights: { exclusivity: '30d', whitelistAds: true, repurpose: 'perpetual', derivative: false, organicOnly: false },
      kind: 'one_off',
      pricingModel: 'fixed',
    },
  },
  {
    id: 'pl-awareness-reels',
    name: 'Brand-awareness reel series',
    source: 'platform',
    description: '3-month retainer. Two creators × 4 reels/month. Best for category presence.',
    data: {
      title: '',
      pitch: 'Ongoing brand-awareness work — building a steady drumbeat of editorial reels in your voice, not one-off "campaigns" that fade.',
      brief: `RETAINER BRIEF\n\nThe goal: keep the brand in the conversation, not a single launch spike.\n\nMonthly cadence:\n  · 4 Reels (mix of solo + collaborative w/ guests)\n  · 4 supporting Stories\n  · 1 carousel on the blog or feed\n\nWe'll send you a quarterly mood board + topic backlog. You choose what resonates.\n\nVoice notes:\n  · Editorial, never hard-selly\n  · Can drop the brand name once per Reel — never twice`,
      budget: 8000,
      category: 'Design',
      region: 'EU',
      deliverables: '4 Reels + 4 stories per month',
      cover: 'https://images.unsplash.com/photo-1481487196290-c152efe083f5?w=800&h=600&fit=crop',
      rights: { exclusivity: '90d', whitelistAds: false, repurpose: '180d', derivative: false, organicOnly: true },
      kind: 'retainer',
      retainerTerm: 3,
      pricingModel: 'fixed',
    },
  },
  {
    id: 'pl-outcome-affiliate',
    name: 'Outcome-based affiliate',
    source: 'platform',
    description: 'Pay per attributed conversion + a small floor. UTM-tracked. Best for measurable products.',
    data: {
      title: '',
      pitch: 'Performance partnership — small guaranteed floor + payout per attributed conversion. We share the upside.',
      brief: `OUTCOME BRIEF\n\nHow this works:\n  · Each accepted creator gets a tracking URL\n  · Floor pays out on accept (your work is always paid)\n  · Bonus pays per attributed conversion, capped\n\nThe creative is yours — we'll share product samples + 3 brand-voice rules + a list of "do not say." Otherwise, run it.\n\nReporting: monthly UTM rollup with conversion attribution.`,
      budget: 25000,
      category: 'Beauty',
      region: 'US',
      deliverables: '2 Reels + tracking link',
      cover: 'https://images.unsplash.com/photo-1522338242992-e1a54906a8da?w=800&h=600&fit=crop',
      rights: { exclusivity: 'none', whitelistAds: true, repurpose: '90d', derivative: true, organicOnly: false },
      kind: 'one_off',
      pricingModel: 'outcome',
      outcomePricing: { baseFloor: 1500, perConversion: 12, capPerCreator: 8000 },
    },
  },
];

// ============================================================
// Brand-saved templates (localStorage)
// ============================================================

const SCHEMA_VERSION = 1;
const MAX_SAVED = 20;

interface StoredShape {
  version: number;
  templates: CampaignTemplate[];
}

function storageKey(brandId: string): string {
  return `alamut:templates:${brandId}`;
}

export function loadBrandTemplates(brandId: string): CampaignTemplate[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(storageKey(brandId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as StoredShape;
    if (parsed.version !== SCHEMA_VERSION) {
      // Future migrations live here.
      console.warn(`[alamut] templates schema mismatch (got v${parsed.version}, expected v${SCHEMA_VERSION}); ignoring saved set`);
      return [];
    }
    return parsed.templates ?? [];
  } catch {
    return [];
  }
}

export function saveBrandTemplate(brandId: string, template: Omit<CampaignTemplate, 'id' | 'source' | 'createdAt'>): CampaignTemplate {
  const list = loadBrandTemplates(brandId);
  const entry: CampaignTemplate = {
    ...template,
    id: `bt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    source: 'brand',
    createdAt: new Date().toISOString(),
  };
  const next = [entry, ...list].slice(0, MAX_SAVED);
  try {
    const payload: StoredShape = { version: SCHEMA_VERSION, templates: next };
    localStorage.setItem(storageKey(brandId), JSON.stringify(payload));
  } catch {
    // Quota / private mode — return the unsaved entry; caller can warn.
  }
  return entry;
}

export function deleteBrandTemplate(brandId: string, templateId: string): void {
  const list = loadBrandTemplates(brandId);
  const next = list.filter((t) => t.id !== templateId);
  try {
    const payload: StoredShape = { version: SCHEMA_VERSION, templates: next };
    localStorage.setItem(storageKey(brandId), JSON.stringify(payload));
  } catch { /* ignore */ }
}

/** Combined platform + brand templates, brand-first so user's saved show on top. */
export function allTemplatesForBrand(brandId: string): CampaignTemplate[] {
  return [...loadBrandTemplates(brandId), ...PLATFORM_TEMPLATES];
}
