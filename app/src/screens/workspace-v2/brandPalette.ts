// brandPalette.ts — the letterhead colours of a campaign tile.
//
// Each brief in Browse campaigns gets a band in one of these, picked from the
// brand's name so a brand keeps its colour everywhere. The public landing
// draws its example tiles from the same list, so the two can't drift.
// No imports: the landing bundle may read this file.

export const BRAND_PALETTE: { bg: string; ink: string }[] = [
  { bg: '#2A3F6E', ink: '#FBF7EE' }, // navy
  { bg: '#5C2A1E', ink: '#FBF7EE' }, // cocoa
  { bg: '#1F3527', ink: '#FBF7EE' }, // moss
  { bg: '#7A2B22', ink: '#FBF7EE' }, // brick
  { bg: '#3E2F4A', ink: '#FBF7EE' }, // aubergine
  { bg: '#1C1A15', ink: '#FBF7EE' }, // ink
];

/** A stable band colour for a brand name. */
export function brandAccent(name: string): { bg: string; ink: string } {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return BRAND_PALETTE[Math.abs(h) % BRAND_PALETTE.length]!;
}
