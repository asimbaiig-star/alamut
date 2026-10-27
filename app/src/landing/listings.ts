// listings.ts — the example listings on each page's first screen.
//
// Examples, and labelled as such on the page: no brand, no creator and no
// figure here is a real account. They take the shape of what each side
// browses in the portal: campaign tiles in Browse campaigns, creator cards
// in Discover. Categories, platforms and formats come from the product's own
// lists (tested), and brands are described, never named.
//
// The listings themselves are split by page (listings-briefs.ts for creators,
// listings-creators.ts for brands), so neither page downloads the other's.

/** The packages a storefront sells, named as Storefront.tsx and creator
 *  onboarding name them. */
export const PACKAGE_LABEL = {
  reel: 'Instagram Reel',
  story: 'Story bundle (×3)',
  combo: 'Reel + Stories combo',
  longform: 'Long-form review',
} as const;
export type PackageKey = keyof typeof PACKAGE_LABEL;
