// brandPalette.ts — the letterhead colours of a campaign tile.
//
// Each brief in Browse campaigns gets a band in one of these, picked from the
// brand's name so a brand keeps its colour everywhere. The public landing
// draws its example tiles from the same list, so the two can't drift.
// No imports: the landing bundle may read this file.

// The colours themselves are tokens (styles/v2-tokens.css), so a band and
// the landing's colour fields are the same paint.
export const BRAND_PALETTE: { bg: string; ink: string }[] = [
  { bg: 'var(--v2-band-navy)', ink: 'var(--v2-paper)' },
  { bg: 'var(--v2-band-cocoa)', ink: 'var(--v2-paper)' },
  { bg: 'var(--v2-band-moss)', ink: 'var(--v2-paper)' },
  { bg: 'var(--v2-band-brick)', ink: 'var(--v2-paper)' },
  { bg: 'var(--v2-band-aubergine)', ink: 'var(--v2-paper)' },
  { bg: 'var(--v2-band-ink)', ink: 'var(--v2-paper)' },
];

/** A stable band colour for a brand name. */
export function brandAccent(name: string): { bg: string; ink: string } {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return BRAND_PALETTE[Math.abs(h) % BRAND_PALETTE.length]!;
}
