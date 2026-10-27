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

export interface MarketFigure { figure: string; claim: string }

/** For creators: who brands hire, how small creators perform, where budgets go. */
export const CREATOR_MARKET: MarketFigure[] = [
  { figure: '54%', claim: 'of marketers work mainly with nano and micro creators, under 60K followers.' },
  { figure: '6.29%', claim: 'average engagement for creators with 2.5K to 25K followers, the highest of any size.' },
  { figure: '74%', claim: 'of marketers plan to increase their influencer budgets in 2026.' },
];

/** For brands: budgets, how creator content performs, what a creator costs. */
export const BRAND_MARKET: MarketFigure[] = [
  { figure: '74%', claim: 'of marketers plan to increase their influencer budgets in 2026.' },
  { figure: '69%', claim: 'of marketers say creator content performs better than brand-directed content.' },
  { figure: '$1.3K', claim: 'average spend per creator, per campaign, in 2025.' },
];
