// Avatar — single canonical render for creator/brand identity tiles.
//
// Why this exists (P65): pre-fix the codebase had ~25 ad-hoc avatar
// renders. Some used `<img>`, some used CSS `backgroundImage`, some
// rendered a letter inside a div, and a handful tried to do
// `backgroundImage: url(${brand.logoMark || brand.name[0]})` which is
// invalid CSS — a bare letter like "A" is not a URL — so the avatar
// was just empty for any brand without an uploaded logoUrl. Result:
// the user saw an actual portrait/logo in some places and a letter
// (or nothing) in others for the same identity.
//
// One rule, everywhere:
//   1. If `src` is a non-empty URL that loads, show the image.
//   2. Otherwise (no src, or load failed), show a colored circle with
//      the first initial(s) of `name` in white text. Color is a stable
//      hash of `name` so the same identity always gets the same tint.
//
// Sizing: pass `size` in px. Shape is circle by default; pass
// `shape="rounded"` for the rounded-square brand-mark look (used in
// hero anchor cards and brand-list rows).

import { useMemo, useState, type CSSProperties } from 'react';

interface AvatarProps {
  /** Image URL to try first (creator.portrait or brand.logoUrl). */
  src?: string | null;
  /** Display name — used to derive the initial fallback + a11y. */
  name: string;
  /** Pixel size (width = height). Default 40. */
  size?: number;
  /** Circle (default) or rounded-square. */
  shape?: 'circle' | 'rounded';
  /** Optional extra className for the outer wrapper. */
  className?: string;
  /** Optional inline style for the outer wrapper. */
  style?: CSSProperties;
  /** When true, the image fallback uses a serif italic glyph (for brand
   *  marks — matches the visual identity in the hero anchor card). */
  serif?: boolean;
  /** Override the initial fallback (e.g. brand.logoMark when it's a
   *  curated single-letter glyph rather than the first letter of name). */
  initial?: string;
  /** Optional aria-label override; otherwise uses `name`. */
  ariaLabel?: string;
}

// Curated palette of soft-on-dark backgrounds. The Avatar picks one
// deterministically based on `name` so the same identity always renders
// the same color across sessions. These work on both light and dark
// surfaces because of the white text overlay.
const PALETTE = [
  '#c66236', // terracotta accent
  '#7a8b6a', // moss
  '#8a6d3b', // gold
  '#5b6e7a', // slate
  '#a35f7c', // rose
  '#6a7aa3', // cornflower
  '#8b6a8b', // mauve
  '#7a8b7a', // sage
];

function hashName(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = ((h << 5) - h + name.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function deriveInitial(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return '·';
  // Multi-word → first letter of first two words. Single word → first
  // letter only. Strips `@` from handles like @sarahstyle.
  const stripped = trimmed.replace(/^@/, '');
  const parts = stripped.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return stripped[0].toUpperCase();
}

export function Avatar({
  src,
  name,
  size = 40,
  shape = 'circle',
  className,
  style,
  serif = false,
  initial,
  ariaLabel,
}: AvatarProps) {
  const [imgFailed, setImgFailed] = useState(false);
  const showImage = !!src && src.trim().length > 0 && !imgFailed;
  // Some legacy call sites pass a bare letter like "A" as the src
  // (because they used to stuff brand.logoMark into a backgroundImage).
  // Guard against that — anything shorter than 4 chars or that doesn't
  // look like a URL fragment is a letter, not an image.
  const looksLikeUrl = !!src && (
    src.startsWith('http') ||
    src.startsWith('data:') ||
    src.startsWith('/') ||
    src.startsWith('blob:')
  );
  const renderImage = showImage && looksLikeUrl;

  const bgColor = useMemo(() => {
    return PALETTE[hashName(name) % PALETTE.length];
  }, [name]);

  const radius = shape === 'circle' ? '50%' : `${Math.max(4, Math.round(size * 0.18))}px`;
  // Initial-text size scales with the avatar — about 38% of the diameter
  // for single-letter, slightly smaller for two-letter so it doesn't
  // overflow. Mirrors what hand-tuned sites were doing manually.
  const display = initial ?? deriveInitial(name);
  const fontSize = display.length >= 2
    ? Math.round(size * 0.34)
    : Math.round(size * 0.42);

  return (
    <div
      className={className}
      role="img"
      aria-label={ariaLabel ?? name}
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        background: renderImage ? 'transparent' : bgColor,
        position: 'relative',
        overflow: 'hidden',
        flexShrink: 0,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#fff',
        fontFamily: serif ? "var(--cn-serif, Georgia, 'Times New Roman', serif)" : 'inherit',
        fontStyle: serif ? 'italic' : 'normal',
        fontWeight: serif ? 400 : 600,
        fontSize,
        letterSpacing: serif ? '-0.02em' : '0.02em',
        userSelect: 'none',
        ...style,
      }}
    >
      {renderImage && (
        <img
          src={src!}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => setImgFailed(true)}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: 'block',
          }}
        />
      )}
      {!renderImage && <span aria-hidden="true">{display}</span>}
    </div>
  );
}
