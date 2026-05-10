// Per-region tax-estimate heuristics (Phase 22).
//
// `monthly.taxEstimate` was a flat 25% — too generous for UK self-employed
// (40% higher band), wildly too high for Pakistan creators (effective ~5-15%).
// This module supplies a simple country → effective rate lookup, with the
// blanket 25% as the fallback. Real creators should plug their accountant's
// number; the UI shows a selector so they can pick the correct band.

export interface TaxBand {
  rate: number;       // 0..1 effective tax rate
  label: string;      // e.g. "UK · self-employed (~30%)"
  note?: string;      // sub-line clarifying the band
}

// Phase 22 QA fix: removed the "custom" pseudo-band — it had no UI to set
// a rate so was functionally identical to "default". If a creator needs an
// odd rate, they pick the closest named band; a real backend would wire
// this to the user's accountant input.
export const TAX_BANDS: Record<string, TaxBand> = {
  default:   { rate: 0.25, label: 'Default · 25%', note: 'Conservative blanket rate.' },
  pk_low:    { rate: 0.10, label: 'PK · low band (~10%)', note: 'Pakistan freelancer up to PKR 6m/yr.' },
  pk_mid:    { rate: 0.20, label: 'PK · mid band (~20%)', note: 'Pakistan freelancer >PKR 6m/yr.' },
  in_low:    { rate: 0.18, label: 'IN · presumptive (~18%)', note: 'India 44ADA presumptive freelancer.' },
  uk_basic:  { rate: 0.28, label: 'UK · basic + NI (~28%)', note: 'UK self-employed up to £50k.' },
  uk_higher: { rate: 0.42, label: 'UK · higher + NI (~42%)', note: 'UK self-employed £50k–125k.' },
  us_22:     { rate: 0.30, label: 'US · 22% federal + SE (~30%)', note: 'US sole-prop $44k–95k income.' },
  us_24:     { rate: 0.34, label: 'US · 24% federal + SE (~34%)', note: 'US sole-prop $95k–182k income.' },
  eu_avg:    { rate: 0.30, label: 'EU · average (~30%)', note: 'Heuristic mid-range across EU member states.' },
  ae:        { rate: 0.00, label: 'UAE · 0% personal income', note: 'No personal income tax (corporate excluded).' },
};

/** Pick a sensible default band from a country code/name. Best-effort —
 *  Phase 22 QA: expanded sniffer to cover common alt-spellings (Britain,
 *  England, America, Holland, Ireland) and a wider EU list. */
export function defaultBandKey(country: string | undefined): string {
  if (!country) return 'default';
  const c = country.toLowerCase();
  if (c.includes('pakistan')) return 'pk_low';
  if (c.includes('india'))    return 'in_low';
  if (
    c.includes('united kingdom') || c === 'uk' || c === 'gb' ||
    c.includes('britain')        || c.includes('england') ||
    c.includes('scotland')       || c.includes('wales')
  ) return 'uk_basic';
  if (
    c.includes('united states') || c === 'us' || c === 'usa' ||
    c.includes('america')
  ) return 'us_22';
  if (c.includes('uae') || c.includes('emirates') || c.includes('dubai') || c.includes('abu dhabi')) return 'ae';
  if (
    c.includes('germany') || c.includes('france') || c.includes('spain') ||
    c.includes('italy')   || c.includes('netherl') || c.includes('holland') ||
    c.includes('sweden')  || c.includes('poland')  || c.includes('greece')  ||
    c.includes('belgium') || c.includes('portugal') || c.includes('ireland') ||
    c === 'eire'          || c.includes('austria') || c.includes('denmark') ||
    c.includes('finland') || c.includes('czech')
  ) return 'eu_avg';
  return 'default';
}
