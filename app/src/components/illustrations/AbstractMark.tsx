// AbstractMark · §5.7 placeholder pass
//
// Renders one of N neutral monochrome geometric glyphs in `currentColor`.
// Used in `BrandWordmark` and `PressStrip` to stand in for real brand /
// publication identities while a dedicated illustration pass is pending.
//
// Why a code-side placeholder instead of leaving real brand names in:
//   - Real brand names rendered in our typography aren't legally
//     equivalent to using their logos, but the optics are bad enough
//     that an audit reviewer flagged it.
//   - This component removes the IP/optics question entirely. Each
//     glyph is a simple shape (no letterforms, no symbols associated
//     with any real brand) and the `aria-label` / `title` carry only
//     a generic "Brand mark" / "Publication mark" string.
//   - When design lands real illustrations, swap `<AbstractMark>` for
//     the new component at the same call sites — `BrandWordmark` and
//     the `PressStrip` row both already abstract the per-slot rendering
//     through this single component, so the swap is one-file.
//
// Variant selection:
//   - `variant?: number` — explicit index (0..VARIANTS-1, modulo'd).
//   - `seed?: string`    — deterministic hash → variant. Used by
//                          BrandWordmark so the same brand name always
//                          renders the same shape across surfaces.
//
// Sizing:
//   - SVG renders at `1em × 1em` by default so it tracks the parent's
//     font-size (matches how the previous text-based wordmarks sized
//     themselves). Override via `style={{ height: '...' }}` when needed.

import type { CSSProperties } from 'react';

interface Props {
  /** Explicit variant index. Wraps via modulo so any int is valid. */
  variant?: number;
  /** Deterministic variant from a string. Ignored if `variant` is set. */
  seed?: string;
  /** Inline CSS — typically used to override height for larger surfaces. */
  style?: CSSProperties;
  /** Joined onto the host span for layout-level styling. */
  className?: string;
  /** Accessible label. Defaults to "Brand mark" — pass a more specific
   *  label when the surface implies one (e.g., "Publication mark"). */
  label?: string;
}

// Lightweight non-cryptographic string → int hash (djb2 variant). Stable
// across renders + surfaces so the same seed always picks the same glyph.
function hashSeed(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

// Each glyph is rendered inside a 32×32 viewBox with `currentColor`
// stroke + fill so it inherits whatever ink the surrounding surface
// uses. Stroke width is ~2 — enough to read at small sizes without
// looking heavy. Designed to be visually distinct: no two share the
// same primitive composition (concentric vs. overlapping vs. linear).
const GLYPHS: Array<(strokeWidth: number) => JSX.Element> = [
  // 0 — concentric circles
  (sw) => (
    <>
      <circle cx="16" cy="16" r="11" fill="none" stroke="currentColor" strokeWidth={sw} />
      <circle cx="16" cy="16" r="4" fill="currentColor" />
    </>
  ),
  // 1 — overlapping squares
  (sw) => (
    <>
      <rect x="6"  y="6"  width="14" height="14" fill="none" stroke="currentColor" strokeWidth={sw} />
      <rect x="12" y="12" width="14" height="14" fill="none" stroke="currentColor" strokeWidth={sw} />
    </>
  ),
  // 2 — triangle inscribed in circle
  (sw) => (
    <>
      <circle cx="16" cy="16" r="12" fill="none" stroke="currentColor" strokeWidth={sw} />
      <path d="M16 7 L25 23 L7 23 Z" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinejoin="round" />
    </>
  ),
  // 3 — vertical bar + dot above (totem)
  (sw) => (
    <>
      <circle cx="16" cy="6"  r="2.5" fill="currentColor" />
      <line x1="16" y1="11" x2="16" y2="27" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" />
      <line x1="9"  y1="27" x2="23" y2="27" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" />
    </>
  ),
  // 4 — 3×3 dot grid
  (sw) => (
    <>
      {[0, 1, 2].flatMap((r) => [0, 1, 2].map((c) => (
        <circle key={`${r}-${c}`} cx={8 + c * 8} cy={8 + r * 8} r={1.6} fill="currentColor" />
      )))}
      {/* Use sw to avoid unused-arg lint; renders an invisible bg outline. */}
      <rect x="0" y="0" width="32" height="32" fill="none" stroke="transparent" strokeWidth={sw} />
    </>
  ),
  // 5 — three diagonal slashes
  (sw) => (
    <>
      <line x1="6"  y1="24" x2="14" y2="8"  stroke="currentColor" strokeWidth={sw} strokeLinecap="round" />
      <line x1="12" y1="24" x2="20" y2="8"  stroke="currentColor" strokeWidth={sw} strokeLinecap="round" />
      <line x1="18" y1="24" x2="26" y2="8"  stroke="currentColor" strokeWidth={sw} strokeLinecap="round" />
    </>
  ),
  // 6 — half-circle on a baseline (sunrise)
  (sw) => (
    <>
      <path d="M5 22 A 11 11 0 0 1 27 22" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" />
      <line x1="3" y1="22" x2="29" y2="22" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" />
    </>
  ),
  // 7 — square with triangle roof
  (sw) => (
    <>
      <rect x="9" y="14" width="14" height="12" fill="none" stroke="currentColor" strokeWidth={sw} />
      <path d="M7 14 L16 6 L25 14 Z" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinejoin="round" />
    </>
  ),
  // 8 — open ring with notch
  (sw) => (
    <>
      <path
        d="M16 5 A 11 11 0 1 1 8 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={sw}
        strokeLinecap="round"
      />
      <circle cx="8" cy="24" r="2.4" fill="currentColor" />
    </>
  ),
  // 9 — wave / sine
  (sw) => (
    <path
      d="M4 16 Q 10 8 16 16 T 28 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={sw}
      strokeLinecap="round"
    />
  ),
  // 10 — plus inside ring
  (sw) => (
    <>
      <circle cx="16" cy="16" r="11" fill="none" stroke="currentColor" strokeWidth={sw} />
      <line x1="16" y1="9"  x2="16" y2="23" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" />
      <line x1="9"  y1="16" x2="23" y2="16" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" />
    </>
  ),
  // 11 — concentric squares
  (sw) => (
    <>
      <rect x="4"  y="4"  width="24" height="24" fill="none" stroke="currentColor" strokeWidth={sw} />
      <rect x="11" y="11" width="10" height="10" fill="currentColor" />
    </>
  ),
];

export const ABSTRACT_MARK_VARIANT_COUNT = GLYPHS.length;

export function AbstractMark({ variant, seed, style, className, label }: Props) {
  const idx = (() => {
    if (typeof variant === 'number') {
      return ((variant % GLYPHS.length) + GLYPHS.length) % GLYPHS.length;
    }
    if (seed) return hashSeed(seed) % GLYPHS.length;
    return 0;
  })();
  const Glyph = GLYPHS[idx];
  const ariaLabel = label ?? 'Brand mark';

  return (
    <span
      className={['abstract-mark', className].filter(Boolean).join(' ')}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '1.6em',
        height: '1.6em',
        color: 'currentColor',
        ...style,
      }}
      role="img"
      aria-label={ariaLabel}
      title={ariaLabel}
    >
      <svg
        viewBox="0 0 32 32"
        width="100%"
        height="100%"
        fill="none"
        aria-hidden="true"
        focusable="false"
      >
        {Glyph(2)}
      </svg>
    </span>
  );
}
