// landingDraft.ts — what a visitor built on the landing, carried into setup.
//
// The landing lets a creator lay out a storefront and a brand write a brief
// before signing up. When they choose to keep it (the "Claim" and "Post this
// brief" buttons, never on typing alone), the draft is kept in this browser's
// localStorage and read back by sign-up, creator onboarding and the campaign
// wizard, which prefill from it and then clear it. Nothing leaves the device.
//
// localStorage is anyone's to write, so every read is validated field by
// field and an old or malformed draft reads as no draft.
// No imports: the landing bundle reads this file.

export const STOREFRONT_DRAFT_KEY = 'alamut.landing.storefront';
export const BRIEF_DRAFT_KEY = 'alamut.landing.brief';
/** A draft older than this is ignored and removed. */
export const DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface StorefrontDraft {
  name: string;
  handle: string;
  niche: string;
  /** The three packages onboarding and the storefront use, in US dollars. */
  rates: { reel: number; story: number; combo: number };
  savedAt: number;
}

export interface BriefDraft {
  title: string;
  platform: string;
  format: string;
  count: number;
  perCreator: number;
  savedAt: number;
}

type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

const text = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const whole = (v: unknown, max: number) =>
  typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.min(Math.round(v), max) : null;
const key = (v: unknown) => (typeof v === 'string' && /^[a-z0-9_-]{1,24}$/.test(v) ? v : '');

function readJson(store: Store, k: string, now: number): Record<string, unknown> | null {
  let raw: string | null;
  try { raw = store.getItem(k); } catch { return null; }
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as unknown;
    const at = v && typeof v === 'object' ? (v as { savedAt?: unknown }).savedAt : undefined;
    if (typeof at !== 'number' || !(now - at >= 0 && now - at <= DRAFT_TTL_MS)) throw new Error('stale');
    return v as Record<string, unknown>;
  } catch {
    clearDraft(store, k);
    return null;
  }
}

export function readStorefrontDraft(store: Store, now = Date.now()): StorefrontDraft | null {
  const v = readJson(store, STOREFRONT_DRAFT_KEY, now);
  if (!v) return null;
  const r = (v.rates ?? {}) as Record<string, unknown>;
  const rates = { reel: whole(r.reel, 1_000_000), story: whole(r.story, 1_000_000), combo: whole(r.combo, 1_000_000) };
  if (rates.reel === null || rates.story === null || rates.combo === null) return null;
  const handle = text(v.handle, 24).toLowerCase().replace(/[^a-z0-9._]/g, '');
  return { name: text(v.name, 40), handle, niche: text(v.niche, 40), rates: rates as StorefrontDraft['rates'], savedAt: v.savedAt as number };
}

export function readBriefDraft(store: Store, now = Date.now()): BriefDraft | null {
  const v = readJson(store, BRIEF_DRAFT_KEY, now);
  if (!v) return null;
  const count = whole(v.count, 10);
  const perCreator = whole(v.perCreator, 1_000_000);
  const platform = key(v.platform);
  const format = key(v.format);
  if (!count || perCreator === null || !platform || !format) return null;
  return { title: text(v.title, 60), platform, format, count, perCreator, savedAt: v.savedAt as number };
}

export function saveDraft(store: Store, k: typeof STOREFRONT_DRAFT_KEY | typeof BRIEF_DRAFT_KEY, draft: StorefrontDraft | BriefDraft): void {
  // A full or blocked storage only means nothing carries over.
  try { store.setItem(k, JSON.stringify(draft)); } catch { /* nothing to carry */ }
}

export function clearDraft(store: Store, k: string): void {
  try { store.removeItem(k); } catch { /* already gone or unreachable */ }
}

// ── Where a draft lands ────────────────────────────────────────────────

/** Creator onboarding's handle, niche and package rates. A claimed draft
 *  fills what the creator hasn't set: its handle wins over the one sign-up
 *  derives from the name, and a rate replaces only the placeholder sign-up
 *  writes ('—'), never a price the creator chose. */
export function onboardingFromDraft(
  own: { handle?: string; category?: string; reel?: string; story?: string; post?: string },
  draft: StorefrontDraft | null,
  o: { categories: readonly string[]; fallback: { reel: string; story: string; post: string } },
): { handle: string; category: string; reelRate: string; storyRate: string; comboRate: string } {
  const unset = (v: string | undefined) => !v || v === '—';
  const rate = (mine: string | undefined, drafted: number | undefined, fallback: string) =>
    drafted && unset(mine) ? String(drafted) : mine ?? fallback;
  return {
    handle: draft?.handle || (own.handle?.replace(/^@/, '') ?? ''),
    category: own.category ?? (draft && o.categories.includes(draft.niche) ? draft.niche : ''),
    reelRate: rate(own.reel, draft?.rates.reel, o.fallback.reel),
    storyRate: rate(own.story, draft?.rates.story, o.fallback.story),
    comboRate: rate(own.post, draft?.rates.combo, o.fallback.post),
  };
}

/** The campaign wizard's name, placement and rate from a posted draft, or
 *  null when the draft names a platform or format the wizard doesn't offer. */
export function wizardFromDraft(
  draft: BriefDraft | null,
  platforms: readonly { value: string; formats: readonly { value: string }[] }[],
): { name: string; placements: { platform: string; format: string; count: number }[]; perCreator: number } | null {
  if (!draft) return null;
  const known = platforms.find((p) => p.value === draft.platform)?.formats.some((f) => f.value === draft.format);
  if (!known) return null;
  return {
    name: draft.title,
    placements: [{ platform: draft.platform, format: draft.format, count: draft.count }],
    perCreator: draft.perCreator,
  };
}
