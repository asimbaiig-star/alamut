// sections/index.ts — barrel for the 8 shared storefront sections.
// PublicCreator (`/c/:handle`) and the workspace public preview
// (`public:<handle>`) both render these, so the two surfaces cannot
// drift on layout, ordering, or filtering. Per the §5.1 mandate.

export { StorefrontHero } from './StorefrontHero';
export { StorefrontVacationBanner } from './StorefrontVacationBanner';
export { StorefrontPackages } from './StorefrontPackages';
export { StorefrontWork } from './StorefrontWork';
export { StorefrontReviews } from './StorefrontReviews';
export { StorefrontPress } from './StorefrontPress';
export { StorefrontAudience } from './StorefrontAudience';
export { StorefrontChannels } from './StorefrontChannels';
