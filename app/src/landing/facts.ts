// facts.ts — every number and rule the landing pages state, from the code
// that enforces it.
//
// The previous landing pages quoted "a flat 5%" fee against a PLATFORM_FEE of
// 0.10, a "4 day" payout average nobody measured, and payment "on approval"
// after payment had moved to live confirmation. Copy that restates a number
// drifts from it. So the landing never restates one: it imports it from here,
// and this file imports it from the product.
//
// Only modules with no imports of their own may appear below — the landing
// bundle must never pull in the store, the seed or Supabase.

export { PLATFORM_FEE, WHT, PLATFORM_FEE_LABEL, WHT_LABEL, splitAcrossSlots, slotGross } from '@/lib/api/money';
export { STALENESS } from '@/lib/api/staleness';
export { PLATFORM_FORMATS, CREATOR_CATEGORIES } from '@/lib/api/marketplaceOptions';
import { STALENESS } from '@/lib/api/staleness';

/** Unanswered applications close this many days after they're sent. */
export const APPLICATION_LAPSE_DAYS = STALENESS.applicationLapseDays;

/** Shown wherever money is mentioned. True until real payment rails exist. */
export const BETA_LINE = 'Public beta · payments are simulated';

/** The demo accounts SignIn.tsx already offers, reachable in one click. */
export const DEMO_HREF = {
  creator: '/signin?demo=creator',
  brand: '/signin?demo=brand',
} as const;

export const SIGNUP_HREF = {
  creator: '/signup?role=creator',
  brand: '/signup?role=brand',
} as const;

/** A real storefront rendered by the app, for "see one" links. */
export const SAMPLE_STOREFRONT_HREF = '/c/sarahstyle';

/** The localStorage key supabase-js persists the session under
 *  (src/lib/supabase.ts `storageKey`). Read directly so the landing can say
 *  "Open workspace" without loading supabase-js. */
export const SESSION_STORAGE_KEY = 'alamut.sb.auth';
