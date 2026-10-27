// market.sources.ts — where each market figure on the landing comes from.
//
// Test-only: never imported by the landing, so none of it ships. Each entry
// is the figure as the page shows it, the report page, and the report's own
// words, short and verbatim (Aspire, "The State of Influencer Marketing 2026").

export const MARKET_SOURCES: { figure: string; page: number; says: string }[] = [
  { figure: '54%', page: 17, says: '54% of marketers today are working with nano- and micro-influencers.' },
  { figure: '6.29%', page: 17, says: 'Average engagement by follower count: 6.29% Nano 2.5K -25K followers' },
  { figure: '74%', page: 30, says: '74% of marketers plan to increase their investment in this channel in 2026.' },
  { figure: '69%', page: 41, says: '69% of marketers say influencer-generated content performs better than brand-directed content.' },
  { figure: '$1.3K', page: 36, says: '$1.3K spent per creator per campaign' },
];
