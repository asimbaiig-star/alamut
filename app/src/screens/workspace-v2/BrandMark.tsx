// BrandMark.tsx — the Alamut mark: an A on ink, with the terracotta dot.
//
// One drawing for every surface that shows the brand: the workspace sidebar,
// sign-in and sign-up, and the public landing pages. No imports, so the
// landing bundle may use it without reaching the app.

export function BrandMarkSvg({ size = 20 }: { size?: number }) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} aria-hidden="true">
      <path d="M16 4 L28 26 L22 26 L16 14 L10 26 L4 26 Z" fill="var(--v2-paper)" />
      <circle cx="16" cy="22" r="2" fill="var(--v2-accent)" />
    </svg>
  );
}
