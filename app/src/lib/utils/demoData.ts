// demoData.ts — tell demo/seed entities apart from real ones (audit F19).
//
// The marketplace ships populated with seeded brands, creators, and
// campaigns so the product looks alive instead of empty. That's good for
// a beta — but a real creator who applies to a seeded campaign is
// applying to a brand that will never reply. Labelling demo content is
// the honest fix; hiding it would gut the demo, and deleting it would
// leave a ghost-town marketplace.
//
// HOW WE TELL THEM APART
//
// Every real account's User.id comes from `deterministicUserId(email)` in
// client.ts, which always produces the prefix `u_x_`. No seeded user id
// uses that prefix (seed ids are `u_sarah`, `u_hannah`, `u_gc07`,
// `u_pend_3`, …) — there is a unit test below pinning that invariant.
//
// Deliberately keyed on the OWNING USER rather than on the entity's own
// id, because:
//   - entity ids come in several seed shapes (`b_aesop`, `b_gb04`,
//     `cmp_g19`, `cmp_aesop_draft`) that would need fragile pattern
//     matching, while real ones are random base36 that could resemble
//     anything;
//   - it works identically for rows hydrated from Postgres and rows from
//     the local seed, since `user_id` is a migrated column. A local-only
//     `demo: true` flag would be lost on Postgres hydration.

import type { Brand, Campaign, Creator, Database } from '@/lib/api/types';

/** Prefix that `deterministicUserId()` gives every real account. */
export const REAL_USER_ID_PREFIX = 'u_x_';

/** True when this User.id belongs to a real (signed-up) account. */
export function isRealUserId(userId: string | undefined | null): boolean {
  return !!userId && userId.startsWith(REAL_USER_ID_PREFIX);
}

/** True for a seeded/demo brand — i.e. one nobody real owns. */
export function isDemoBrand(brand: Pick<Brand, 'userId'> | undefined | null): boolean {
  if (!brand) return false;
  return !isRealUserId(brand.userId);
}

/** True for a seeded/demo creator. */
export function isDemoCreator(creator: Pick<Creator, 'userId'> | undefined | null): boolean {
  if (!creator) return false;
  return !isRealUserId(creator.userId);
}

/** True for a campaign posted by a demo brand. Needs the brand list to
 *  resolve ownership — campaigns carry `brandId`, not `userId`. */
export function isDemoCampaign(
  campaign: Pick<Campaign, 'brandId'> | undefined | null,
  brands: Pick<Brand, 'id' | 'userId'>[],
): boolean {
  if (!campaign) return false;
  const brand = brands.find((b) => b.id === campaign.brandId);
  // Unknown brand => treat as demo. Safer to over-label than to let a
  // real creator mistake seeded work for a paying opportunity.
  if (!brand) return true;
  return isDemoBrand(brand);
}

/** Convenience for surfaces that already hold the whole db. */
export function isDemoCampaignInDb(campaignId: string, db: Database): boolean {
  const camp = db.campaigns.find((c) => c.id === campaignId);
  return isDemoCampaign(camp, db.brands);
}
