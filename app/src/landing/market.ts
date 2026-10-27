// market.ts — a few figures about the market, from a third-party survey.
//
// These are not Alamut's numbers and the page never presents them as such:
// every figure is shown beside MARKET_SOURCE_LINE, which says they come from
// an industry survey. The publisher is deliberately not named on the page.
//
// Source, for us (comments are stripped from the build, so none of this
// reaches a visitor): Aspire, "The State of Influencer Marketing 2026",
// Aspire platform data plus a survey of nearly 900 marketers and creators,
// learn.aspireiq.com/rs/982-DON-266/images/2026-State-of-Influencer-Marketing.pdf
// Each figure's page and source sentence are pinned in
// __tests__/market.sources.ts; the test fails if a figure here drifts.
//
// No percentages anywhere else on the landing: the fee guard still holds for
// every other file (regressionGuards, "states no fee or percentage").

export const MARKET_SOURCE_LINE = 'Figures from a 2026 industry survey of nearly 900 marketers and creators.';

/** A sentence with its figure inside it: before + figure + after. */
export interface MarketFigure { before: string; figure: string; after: string }

/** For creators: who brands hire, how small creators perform, where budgets go. */
export const CREATOR_MARKET: MarketFigure[] = [
  { before: '', figure: '54%', after: 'of marketers work mainly with creators under 60K followers.' },
  { before: 'Creators with 2.5K to 25K followers average', figure: '6.29%', after: 'engagement, the highest of any size.' },
  { before: 'And', figure: '74%', after: 'of marketers plan to increase their influencer budgets in 2026.' },
];

/** For brands: budgets, how creator content performs, what a creator costs. */
export const BRAND_MARKET: MarketFigure[] = [
  { before: '', figure: '74%', after: 'of marketers plan to increase their influencer budgets in 2026.' },
  { before: '', figure: '69%', after: 'of marketers say creator content performs better than brand-directed content.' },
  { before: 'Brands spent an average of', figure: '$1.3K', after: 'per creator, per campaign, in 2025.' },
];
