// marketplaceOptions.ts — the option lists a brief and a storefront are
// built from.
//
// Shared by the product (NewCampaignWizard, CreatorOnboardingV2) and the
// public landing's builders, so the landing can only offer a platform, a
// format or a category the product does. Pure data: the landing bundle must
// not reach the store, seed or Supabase through this file.

/** Platform → supported formats. Labels are display strings that
 *  `parseDeliverableSlotsFreeForm` + `inferPlatformLocal/inferFormatLocal`
 *  can round-trip into structured Deliverable rows on launch. */
export const PLATFORM_FORMATS: Array<{
  value: string;
  label: string;
  formats: Array<{ value: string; label: string }>;
}> = [
  { value: 'instagram', label: 'Instagram', formats: [
    { value: 'reel', label: 'Reel' },
    { value: 'story', label: 'Story' },
    { value: 'carousel', label: 'Carousel' },
    { value: 'post', label: 'Static post' },
  ]},
  { value: 'tiktok', label: 'TikTok', formats: [
    { value: 'video', label: 'Video' },
    { value: 'live', label: 'Live' },
  ]},
  { value: 'youtube', label: 'YouTube', formats: [
    { value: 'longform', label: 'Long-form' },
    { value: 'short', label: 'Short' },
    { value: 'live', label: 'Live' },
  ]},
  { value: 'linkedin', label: 'LinkedIn', formats: [
    { value: 'post', label: 'Post' },
    { value: 'article', label: 'Article' },
    { value: 'newsletter', label: 'Newsletter' },
  ]},
  { value: 'x', label: 'X', formats: [
    { value: 'post', label: 'Post' },
    { value: 'thread', label: 'Thread' },
  ]},
  { value: 'substack', label: 'Substack', formats: [
    { value: 'newsletter', label: 'Newsletter' },
  ]},
];

/** The categories a creator picks from during onboarding. */
export const CREATOR_CATEGORIES = ['Fashion', 'Beauty', 'Food', 'Tech', 'Travel', 'Fitness', 'Parenting', 'Finance', 'B2B'];
