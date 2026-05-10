// Stylized SVG illustrations for the Phase 52 landing rebuild.
//
// Design rules:
//   - Geometric, modern, accent-colored. No literal product mockups.
//   - Inline SVG only — zero external assets, zero dependencies.
//   - Theme-aware: uses currentColor + CSS vars (--cn-accent, --cn-ink)
//     so light/dark themes flip automatically.
//   - 3D feel via gradient stops + soft drop-shadow filters, not
//     skeuomorphic textures.
//
// Each illustration is a self-contained component sized to a
// reasonable default but resizable via CSS (`width`/`height` on parent).
// The viewBox is square unless the composition demands otherwise.

import type { CSSProperties } from 'react';

interface IllProps {
  className?: string;
  style?: CSSProperties;
  ariaLabel?: string;
}

// =====================================================================
// Hero · creator × brand connection
// =====================================================================
// A central rounded card (the deal) sitting on top of a soft accent halo.
// Two satellite avatars (creator + brand) connected to the central card
// by quiet lines. A small "+" badge floats top-right, suggesting
// new-deal energy. Gradient lift on the central card creates the 3D
// raised-paper feel.
export function HeroIllustration({ className, style, ariaLabel = 'Creator and brand collaboration' }: IllProps) {
  return (
    <svg
      viewBox="0 0 600 540"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={ariaLabel}
      className={className}
      style={style}
    >
      <defs>
        {/* Halo radial */}
        <radialGradient id="hero-halo" cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor="var(--cn-accent)" stopOpacity="0.32" />
          <stop offset="55%"  stopColor="var(--cn-accent)" stopOpacity="0.10" />
          <stop offset="100%" stopColor="var(--cn-accent)" stopOpacity="0" />
        </radialGradient>
        {/* Central card lift */}
        <linearGradient id="hero-card" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%"   stopColor="oklch(1 0 0)" />
          <stop offset="100%" stopColor="oklch(0.97 0.005 60)" />
        </linearGradient>
        {/* Drop shadow */}
        <filter id="hero-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="12" stdDeviation="14" floodColor="oklch(0.20 0.012 270)" floodOpacity="0.18" />
        </filter>
        {/* Avatar lift */}
        <filter id="hero-avatar-shadow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="6" stdDeviation="8" floodColor="oklch(0.20 0.012 270)" floodOpacity="0.16" />
        </filter>
      </defs>

      {/* Halo */}
      <ellipse cx="300" cy="270" rx="280" ry="220" fill="url(#hero-halo)" />

      {/* Connection lines — drawn before cards so cards sit on top */}
      <path
        d="M 130 360 Q 240 220 300 250"
        fill="none"
        stroke="var(--cn-rule-strong)"
        strokeWidth="1.5"
        strokeDasharray="3 5"
        opacity="0.55"
      />
      <path
        d="M 470 180 Q 380 220 300 250"
        fill="none"
        stroke="var(--cn-rule-strong)"
        strokeWidth="1.5"
        strokeDasharray="3 5"
        opacity="0.55"
      />

      {/* Central deal card */}
      <g filter="url(#hero-shadow)">
        <rect x="180" y="200" width="240" height="160" rx="18" fill="url(#hero-card)" stroke="oklch(0.90 0.005 270)" strokeWidth="1" />
        {/* Deal-card content lines */}
        <rect x="200" y="222" width="80" height="10" rx="5" fill="var(--cn-accent)" opacity="0.85" />
        <rect x="200" y="244" width="170" height="14" rx="4" fill="oklch(0.20 0.012 270)" opacity="0.85" />
        <rect x="200" y="266" width="130" height="10" rx="3" fill="oklch(0.50 0.008 270)" opacity="0.50" />
        {/* Money chip bottom-right */}
        <rect x="290" y="318" width="110" height="28" rx="14" fill="oklch(0.20 0.012 270)" />
        <text x="345" y="337" textAnchor="middle" fontFamily="var(--cn-mono)" fontSize="12" fill="oklch(1 0 0)" fontWeight="500">+$1,400</text>
      </g>

      {/* Creator avatar — bottom-left satellite */}
      <g filter="url(#hero-avatar-shadow)">
        <circle cx="130" cy="360" r="44" fill="oklch(1 0 0)" stroke="oklch(0.90 0.005 270)" strokeWidth="1.5" />
        <circle cx="130" cy="346" r="14" fill="var(--cn-accent)" opacity="0.85" />
        <path d="M 102 392 a 28 28 0 0 1 56 0 z" fill="var(--cn-accent)" opacity="0.85" />
      </g>

      {/* Brand mark — top-right satellite */}
      <g filter="url(#hero-avatar-shadow)">
        <rect x="436" y="146" width="68" height="68" rx="14" fill="oklch(1 0 0)" stroke="oklch(0.90 0.005 270)" strokeWidth="1.5" />
        <text x="470" y="190" textAnchor="middle" fontFamily="var(--cn-serif)" fontSize="32" fontStyle="italic" fontWeight="400" fill="oklch(0.20 0.012 270)">M</text>
      </g>

      {/* New-deal "+" badge — top-right of central card */}
      <g filter="url(#hero-avatar-shadow)">
        <circle cx="416" cy="208" r="20" fill="var(--cn-accent)" />
        <path d="M 408 208 h 16 M 416 200 v 16" stroke="oklch(1 0 0)" strokeWidth="2.5" strokeLinecap="round" />
      </g>

      {/* Tiny floating dots for atmosphere */}
      <circle cx="84"  cy="200" r="3"   fill="var(--cn-accent)" opacity="0.45" />
      <circle cx="520" cy="380" r="2.5" fill="var(--cn-accent)" opacity="0.45" />
      <circle cx="430" cy="430" r="3.5" fill="var(--cn-accent)" opacity="0.30" />
      <circle cx="80"  cy="100" r="2"   fill="var(--cn-accent)" opacity="0.30" />
    </svg>
  );
}

// =====================================================================
// Vetted shield — used in WhyAlamut card "Vetted, not scraped."
// =====================================================================
export function VettedShield({ className, style, ariaLabel = 'Verified creators only' }: IllProps) {
  return (
    <svg
      viewBox="0 0 96 96"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={ariaLabel}
      className={className}
      style={style}
    >
      <defs>
        <linearGradient id="shield-grad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%"   stopColor="var(--cn-accent)" stopOpacity="0.95" />
          <stop offset="100%" stopColor="var(--cn-accent)" stopOpacity="0.65" />
        </linearGradient>
        <filter id="shield-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="4" stdDeviation="6" floodColor="oklch(0.20 0.012 270)" floodOpacity="0.20" />
        </filter>
      </defs>
      <g filter="url(#shield-shadow)">
        <path
          d="M 48 8 L 80 22 L 80 50 C 80 66 66 80 48 88 C 30 80 16 66 16 50 L 16 22 Z"
          fill="url(#shield-grad)"
        />
        <path d="M 32 50 l 12 12 l 22 -24" fill="none" stroke="oklch(1 0 0)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  );
}

// =====================================================================
// Escrow vault — used in WhyAlamut card "Escrow-secured."
// =====================================================================
export function EscrowVault({ className, style, ariaLabel = 'Escrow-secured payments' }: IllProps) {
  return (
    <svg
      viewBox="0 0 96 96"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={ariaLabel}
      className={className}
      style={style}
    >
      <defs>
        <linearGradient id="vault-grad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%"   stopColor="oklch(0.20 0.012 270)" />
          <stop offset="100%" stopColor="oklch(0.30 0.014 270)" />
        </linearGradient>
        <filter id="vault-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="4" stdDeviation="6" floodColor="oklch(0.20 0.012 270)" floodOpacity="0.18" />
        </filter>
      </defs>
      <g filter="url(#vault-shadow)">
        {/* Vault body */}
        <rect x="14" y="32" width="68" height="50" rx="6" fill="url(#vault-grad)" />
        {/* Lock shackle */}
        <path d="M 32 32 v -8 a 16 16 0 0 1 32 0 v 8" fill="none" stroke="url(#vault-grad)" strokeWidth="6" strokeLinecap="round" />
        {/* Coin slot */}
        <circle cx="48" cy="56" r="9" fill="var(--cn-accent)" />
        <text x="48" y="60" textAnchor="middle" fontFamily="var(--cn-mono)" fontSize="13" fontWeight="700" fill="oklch(1 0 0)">$</text>
        {/* Indicator dot */}
        <circle cx="48" cy="74" r="2" fill="var(--cn-accent)" opacity="0.8" />
      </g>
    </svg>
  );
}

// =====================================================================
// Applications stack — used in WhyAlamut "Audience-fit matching."
// =====================================================================
export function ApplicationsStack({ className, style, ariaLabel = 'Vetted applications sorted by fit' }: IllProps) {
  return (
    <svg
      viewBox="0 0 96 96"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={ariaLabel}
      className={className}
      style={style}
    >
      <defs>
        <filter id="stack-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="3" stdDeviation="4" floodColor="oklch(0.20 0.012 270)" floodOpacity="0.16" />
        </filter>
      </defs>
      <g filter="url(#stack-shadow)">
        {/* Bottom card */}
        <rect x="12" y="44" width="64" height="20" rx="4" fill="oklch(1 0 0)" stroke="oklch(0.86 0.005 270)" strokeWidth="1" />
        {/* Middle card */}
        <rect x="14" y="32" width="68" height="20" rx="4" fill="oklch(1 0 0)" stroke="oklch(0.86 0.005 270)" strokeWidth="1" />
        {/* Top card (highlighted — match) */}
        <rect x="16" y="20" width="72" height="22" rx="5" fill="oklch(1 0 0)" stroke="var(--cn-accent)" strokeWidth="2" />
        <circle cx="28" cy="31" r="6" fill="var(--cn-accent)" />
        <rect x="40" y="26" width="36" height="3" rx="1.5" fill="oklch(0.20 0.012 270)" opacity="0.85" />
        <rect x="40" y="32" width="22" height="3" rx="1.5" fill="oklch(0.50 0.008 270)" opacity="0.55" />
        {/* Match-percentage badge */}
        <rect x="70" y="56" width="22" height="14" rx="7" fill="var(--cn-accent)" />
        <text x="81" y="66" textAnchor="middle" fontFamily="var(--cn-mono)" fontSize="9" fontWeight="700" fill="oklch(1 0 0)">94%</text>
      </g>
    </svg>
  );
}

// =====================================================================
// ROAS chart — used in WhyAlamut "ROAS per UTM."
// =====================================================================
export function ROASChart({ className, style, ariaLabel = 'ROAS tracked per UTM' }: IllProps) {
  return (
    <svg
      viewBox="0 0 96 96"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={ariaLabel}
      className={className}
      style={style}
    >
      <defs>
        <linearGradient id="bar-grad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%"   stopColor="var(--cn-accent)" stopOpacity="0.95" />
          <stop offset="100%" stopColor="var(--cn-accent)" stopOpacity="0.55" />
        </linearGradient>
        <filter id="chart-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="3" stdDeviation="4" floodColor="oklch(0.20 0.012 270)" floodOpacity="0.14" />
        </filter>
      </defs>
      <g filter="url(#chart-shadow)">
        {/* Axis */}
        <line x1="14" y1="78" x2="86" y2="78" stroke="oklch(0.74 0.008 270)" strokeWidth="1.5" strokeLinecap="round" />
        {/* Bars — ascending, last one tallest in accent */}
        <rect x="22" y="58" width="10" height="20" rx="2" fill="oklch(0.74 0.008 270)" opacity="0.45" />
        <rect x="38" y="48" width="10" height="30" rx="2" fill="oklch(0.74 0.008 270)" opacity="0.55" />
        <rect x="54" y="34" width="10" height="44" rx="2" fill="oklch(0.74 0.008 270)" opacity="0.65" />
        <rect x="70" y="14" width="10" height="64" rx="2" fill="url(#bar-grad)" />
        {/* Trend line */}
        <path d="M 27 64 L 43 56 L 59 42 L 75 22" fill="none" stroke="var(--cn-accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {/* Endpoint dot */}
        <circle cx="75" cy="22" r="3.5" fill="var(--cn-accent)" />
        <circle cx="75" cy="22" r="6" fill="none" stroke="var(--cn-accent)" strokeWidth="1" opacity="0.4" />
      </g>
    </svg>
  );
}

// =====================================================================
// No outreach (creator-side) — strikethrough envelope/inbox
// =====================================================================
export function NoOutreach({ className, style, ariaLabel = 'No cold outreach' }: IllProps) {
  return (
    <svg
      viewBox="0 0 96 96"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={ariaLabel}
      className={className}
      style={style}
    >
      <defs>
        <filter id="inbox-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="3" stdDeviation="4" floodColor="oklch(0.20 0.012 270)" floodOpacity="0.16" />
        </filter>
      </defs>
      <g filter="url(#inbox-shadow)">
        <rect x="14" y="22" width="68" height="48" rx="6" fill="oklch(1 0 0)" stroke="oklch(0.74 0.008 270)" strokeWidth="1.5" />
        <path d="M 14 28 L 48 50 L 82 28" fill="none" stroke="oklch(0.50 0.008 270)" strokeWidth="1.5" />
        {/* Strikethrough */}
        <line x1="20" y1="74" x2="76" y2="22" stroke="var(--cn-accent)" strokeWidth="3.5" strokeLinecap="round" />
      </g>
    </svg>
  );
}

// =====================================================================
// Star receipt — creator-side reputation
// =====================================================================
export function StarReceipt({ className, style, ariaLabel = 'Public receipts on every deal' }: IllProps) {
  return (
    <svg
      viewBox="0 0 96 96"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={ariaLabel}
      className={className}
      style={style}
    >
      <defs>
        <filter id="receipt-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="3" stdDeviation="4" floodColor="oklch(0.20 0.012 270)" floodOpacity="0.16" />
        </filter>
      </defs>
      <g filter="url(#receipt-shadow)">
        {/* Receipt paper with zigzag bottom */}
        <path
          d="M 20 16 H 76 V 78 L 70 74 L 64 78 L 58 74 L 52 78 L 46 74 L 40 78 L 34 74 L 28 78 L 22 74 V 16 Z M 20 16 Z"
          fill="oklch(1 0 0)" stroke="oklch(0.74 0.008 270)" strokeWidth="1.5"
        />
        <rect x="28" y="26" width="40" height="3" rx="1.5" fill="oklch(0.20 0.012 270)" opacity="0.85" />
        <rect x="28" y="34" width="28" height="3" rx="1.5" fill="oklch(0.50 0.008 270)" opacity="0.65" />
        <rect x="28" y="42" width="34" height="3" rx="1.5" fill="oklch(0.50 0.008 270)" opacity="0.50" />
        {/* Star top-right */}
        <path
          d="M 70 12 l 4 8 l 9 1 l -6.5 6 l 1.5 9 l -8 -4 l -8 4 l 1.5 -9 l -6.5 -6 l 9 -1 z"
          fill="var(--cn-accent)" stroke="var(--cn-accent)" strokeWidth="1" strokeLinejoin="round"
          transform="translate(-2, 0)"
        />
      </g>
    </svg>
  );
}

// =====================================================================
// Tag — creator-side "your pricing"
// =====================================================================
export function PriceTag({ className, style, ariaLabel = 'You set your rates' }: IllProps) {
  return (
    <svg
      viewBox="0 0 96 96"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={ariaLabel}
      className={className}
      style={style}
    >
      <defs>
        <linearGradient id="tag-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%"   stopColor="var(--cn-accent)" stopOpacity="0.95" />
          <stop offset="100%" stopColor="var(--cn-accent)" stopOpacity="0.65" />
        </linearGradient>
        <filter id="tag-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="3" stdDeviation="5" floodColor="oklch(0.20 0.012 270)" floodOpacity="0.18" />
        </filter>
      </defs>
      <g filter="url(#tag-shadow)">
        <path
          d="M 16 48 L 48 16 L 84 16 L 84 52 L 52 84 Z"
          fill="url(#tag-grad)"
        />
        <circle cx="68" cy="32" r="6" fill="oklch(1 0 0)" />
        <text x="48" y="64" textAnchor="middle" fontFamily="var(--cn-mono)" fontSize="14" fontWeight="700" fill="oklch(1 0 0)" transform="rotate(-45 48 64)">$</text>
      </g>
    </svg>
  );
}

// =====================================================================
// Phase 54 · Brand-side hero — Campaign Command Center
// =====================================================================
// A large composition: central "brief" card with brand mark, surrounded
// by 5 creator-avatar circles arranged in an orbit, with AI-matching
// lines pulsing between them. Numeric badges show match scores.
export function BrandHeroComposition({ className, style, ariaLabel = 'Campaign command center' }: IllProps) {
  // Avatar positions on a 600x540 canvas around a central card.
  const orbits = [
    { x: 120, y: 110, r: 32, score: 94 },
    { x: 480, y: 90,  r: 28, score: 88 },
    { x: 90,  y: 360, r: 28, score: 91 },
    { x: 510, y: 380, r: 32, score: 96 },
    { x: 300, y: 470, r: 26, score: 82 },
  ];
  return (
    <svg
      viewBox="0 0 600 540"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={ariaLabel}
      className={className}
      style={style}
    >
      <defs>
        <radialGradient id="bh-halo" cx="50%" cy="50%" r="55%">
          <stop offset="0%"   stopColor="var(--cn-accent)" stopOpacity="0.30" />
          <stop offset="60%"  stopColor="var(--cn-accent)" stopOpacity="0.08" />
          <stop offset="100%" stopColor="var(--cn-accent)" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="bh-card" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%"   stopColor="oklch(1 0 0)" />
          <stop offset="100%" stopColor="oklch(0.96 0.005 60)" />
        </linearGradient>
        <linearGradient id="bh-avatar" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%"   stopColor="oklch(0.86 0.06 35)" />
          <stop offset="100%" stopColor="oklch(0.72 0.10 35)" />
        </linearGradient>
        <filter id="bh-shadow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="14" stdDeviation="16" floodColor="oklch(0.20 0.012 270)" floodOpacity="0.18" />
        </filter>
        <filter id="bh-avatar-shadow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="6" stdDeviation="8" floodColor="oklch(0.20 0.012 270)" floodOpacity="0.18" />
        </filter>
        <filter id="bh-pulse" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="0.6" />
        </filter>
      </defs>

      {/* Halo */}
      <circle cx="300" cy="270" r="280" fill="url(#bh-halo)" />

      {/* Match-line connections from each avatar to the central card */}
      <g filter="url(#bh-pulse)" opacity="0.35">
        {orbits.map((o, i) => (
          <line
            key={`l-${i}`}
            x1={o.x} y1={o.y} x2="300" y2="270"
            stroke="var(--cn-accent)"
            strokeWidth="1.4"
            strokeDasharray="4 6"
          />
        ))}
      </g>

      {/* Central brief card */}
      <g filter="url(#bh-shadow)">
        <rect x="180" y="175" width="240" height="190" rx="20" fill="url(#bh-card)" stroke="oklch(0.92 0.006 60)" strokeWidth="1" />
        {/* Brief header */}
        <rect x="200" y="195" width="40" height="40" rx="10" fill="var(--cn-accent)" opacity="0.9" />
        <text x="222" y="222" textAnchor="middle" fontFamily="var(--cn-sans)" fontSize="20" fontWeight="700" fill="oklch(1 0 0)">A</text>
        <rect x="252" y="200" width="120" height="10" rx="3" fill="oklch(0.88 0.005 270)" />
        <rect x="252" y="220" width="80" height="8" rx="2" fill="oklch(0.92 0.005 270)" />
        {/* Brief body lines */}
        <rect x="200" y="262" width="200" height="6" rx="2" fill="oklch(0.92 0.005 270)" />
        <rect x="200" y="278" width="170" height="6" rx="2" fill="oklch(0.92 0.005 270)" />
        <rect x="200" y="294" width="150" height="6" rx="2" fill="oklch(0.94 0.005 270)" />
        {/* Match badge */}
        <rect x="200" y="320" width="200" height="34" rx="10" fill="oklch(0.96 0.04 145)" />
        <circle cx="216" cy="337" r="6" fill="oklch(0.55 0.18 145)" />
        <text x="232" y="342" fontFamily="var(--cn-mono)" fontSize="12" fontWeight="700" fill="oklch(0.30 0.10 145)" letterSpacing="0.06em">5 MATCHED · IN 2H</text>
      </g>

      {/* Orbiting creator avatars with score badges */}
      {orbits.map((o, i) => (
        <g key={`a-${i}`} filter="url(#bh-avatar-shadow)">
          <circle cx={o.x} cy={o.y} r={o.r} fill="url(#bh-avatar)" />
          <circle cx={o.x} cy={o.y} r={o.r - 5} fill="oklch(1 0 0)" opacity="0.18" />
          {/* Score chip */}
          <g>
            <rect x={o.x + o.r - 14} y={o.y + o.r - 10} width="36" height="20" rx="10" fill="oklch(1 0 0)" stroke="var(--cn-accent)" strokeWidth="1.2" />
            <text x={o.x + o.r + 4} y={o.y + o.r + 4} textAnchor="middle" fontFamily="var(--cn-mono)" fontSize="11" fontWeight="700" fill="var(--cn-accent)">{o.score}</text>
          </g>
        </g>
      ))}

      {/* Floating "+brief" pill top-left */}
      <g filter="url(#bh-shadow)">
        <rect x="32" y="32" width="120" height="36" rx="18" fill="oklch(1 0 0)" />
        <circle cx="50" cy="50" r="6" fill="var(--cn-accent)" />
        <text x="64" y="55" fontFamily="var(--cn-mono)" fontSize="12" fontWeight="600" fill="oklch(0.35 0.012 270)" letterSpacing="0.04em">NEW BRIEF</text>
      </g>
    </svg>
  );
}

// =====================================================================
// Phase 54 · Creator-side hero — Storefront with platform pulses
// =====================================================================
// A central storefront-card showing a creator profile mock; platform
// glyphs (IG, TikTok, YT, X, Substack) arrayed around it; money +
// messages floating in.
export function CreatorHeroComposition({ className, style, ariaLabel = 'Creator storefront connecting to brands' }: IllProps) {
  return (
    <svg
      viewBox="0 0 600 540"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={ariaLabel}
      className={className}
      style={style}
    >
      <defs>
        <radialGradient id="ch-halo" cx="50%" cy="55%" r="55%">
          <stop offset="0%"   stopColor="var(--cn-accent)" stopOpacity="0.32" />
          <stop offset="55%"  stopColor="var(--cn-accent)" stopOpacity="0.10" />
          <stop offset="100%" stopColor="var(--cn-accent)" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="ch-card" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%"   stopColor="oklch(1 0 0)" />
          <stop offset="100%" stopColor="oklch(0.96 0.005 60)" />
        </linearGradient>
        <linearGradient id="ch-portrait" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%"   stopColor="oklch(0.84 0.08 35)" />
          <stop offset="100%" stopColor="oklch(0.66 0.12 35)" />
        </linearGradient>
        <linearGradient id="ch-money" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%"   stopColor="oklch(0.78 0.14 145)" />
          <stop offset="100%" stopColor="oklch(0.60 0.16 145)" />
        </linearGradient>
        <filter id="ch-shadow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="14" stdDeviation="16" floodColor="oklch(0.20 0.012 270)" floodOpacity="0.18" />
        </filter>
        <filter id="ch-glyph-shadow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="4" stdDeviation="6" floodColor="oklch(0.20 0.012 270)" floodOpacity="0.15" />
        </filter>
      </defs>

      <circle cx="300" cy="290" r="280" fill="url(#ch-halo)" />

      {/* Central storefront card */}
      <g filter="url(#ch-shadow)">
        <rect x="180" y="160" width="240" height="270" rx="22" fill="url(#ch-card)" stroke="oklch(0.92 0.006 60)" strokeWidth="1" />
        {/* Cover band */}
        <rect x="180" y="160" width="240" height="60" rx="22" fill="var(--cn-accent)" opacity="0.18" />
        <rect x="180" y="200" width="240" height="20" fill="var(--cn-accent)" opacity="0.06" />
        {/* Portrait circle */}
        <circle cx="240" cy="226" r="34" fill="url(#ch-portrait)" stroke="oklch(1 0 0)" strokeWidth="4" />
        {/* Name + handle */}
        <rect x="284" y="222" width="116" height="10" rx="3" fill="oklch(0.30 0.012 270)" />
        <rect x="284" y="240" width="76" height="7" rx="2" fill="oklch(0.78 0.005 270)" />
        {/* Bio lines */}
        <rect x="200" y="278" width="200" height="6" rx="2" fill="oklch(0.92 0.005 270)" />
        <rect x="200" y="294" width="160" height="6" rx="2" fill="oklch(0.92 0.005 270)" />
        {/* Stats row */}
        <g>
          <rect x="200" y="316" width="64" height="48" rx="10" fill="oklch(0.97 0.005 60)" />
          <text x="232" y="338" textAnchor="middle" fontFamily="var(--cn-sans)" fontSize="14" fontWeight="700" fill="oklch(0.20 0.012 270)">68k</text>
          <text x="232" y="354" textAnchor="middle" fontFamily="var(--cn-mono)" fontSize="9" fontWeight="600" fill="oklch(0.46 0.005 270)" letterSpacing="0.08em">REACH</text>
          <rect x="268" y="316" width="64" height="48" rx="10" fill="oklch(0.97 0.005 60)" />
          <text x="300" y="338" textAnchor="middle" fontFamily="var(--cn-sans)" fontSize="14" fontWeight="700" fill="oklch(0.20 0.012 270)">4.2%</text>
          <text x="300" y="354" textAnchor="middle" fontFamily="var(--cn-mono)" fontSize="9" fontWeight="600" fill="oklch(0.46 0.005 270)" letterSpacing="0.08em">ENG</text>
          <rect x="336" y="316" width="64" height="48" rx="10" fill="oklch(0.97 0.005 60)" />
          <text x="368" y="338" textAnchor="middle" fontFamily="var(--cn-sans)" fontSize="14" fontWeight="700" fill="var(--cn-accent)">$8.4k</text>
          <text x="368" y="354" textAnchor="middle" fontFamily="var(--cn-mono)" fontSize="9" fontWeight="600" fill="oklch(0.46 0.005 270)" letterSpacing="0.08em">EARNED</text>
        </g>
        {/* CTA bar */}
        <rect x="200" y="380" width="200" height="34" rx="10" fill="var(--cn-accent)" />
        <text x="300" y="402" textAnchor="middle" fontFamily="var(--cn-sans)" fontSize="13" fontWeight="700" fill="oklch(1 0 0)">Send a brief →</text>
      </g>

      {/* Platform glyphs around the card */}
      {/* Instagram */}
      <g filter="url(#ch-glyph-shadow)" transform="translate(78 134)">
        <rect x="0" y="0" width="56" height="56" rx="14" fill="oklch(1 0 0)" />
        <rect x="11" y="11" width="34" height="34" rx="9" fill="none" stroke="var(--cn-accent)" strokeWidth="2.5" />
        <circle cx="28" cy="28" r="7" fill="none" stroke="var(--cn-accent)" strokeWidth="2.5" />
        <circle cx="38" cy="18" r="2.2" fill="var(--cn-accent)" />
      </g>
      {/* TikTok */}
      <g filter="url(#ch-glyph-shadow)" transform="translate(465 132)">
        <rect x="0" y="0" width="56" height="56" rx="14" fill="oklch(1 0 0)" />
        <path d="M 32 14 L 32 36 a 8 8 0 1 1 -8 -8" fill="none" stroke="var(--cn-accent)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M 32 14 c 0 6 4 10 10 10" fill="none" stroke="var(--cn-accent)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </g>
      {/* YouTube */}
      <g filter="url(#ch-glyph-shadow)" transform="translate(60 376)">
        <rect x="0" y="0" width="56" height="56" rx="14" fill="oklch(1 0 0)" />
        <rect x="10" y="18" width="36" height="22" rx="6" fill="none" stroke="var(--cn-accent)" strokeWidth="2.5" />
        <path d="M 24 24 L 36 29 L 24 34 Z" fill="var(--cn-accent)" />
      </g>
      {/* Substack */}
      <g filter="url(#ch-glyph-shadow)" transform="translate(484 388)">
        <rect x="0" y="0" width="56" height="56" rx="14" fill="oklch(1 0 0)" />
        <rect x="14" y="14" width="28" height="3.5" rx="1" fill="var(--cn-accent)" />
        <rect x="14" y="22" width="28" height="3.5" rx="1" fill="var(--cn-accent)" />
        <path d="M 14 30 L 14 42 L 28 35 L 42 42 L 42 30 Z" fill="var(--cn-accent)" />
      </g>
      {/* X / Twitter */}
      <g filter="url(#ch-glyph-shadow)" transform="translate(272 80)">
        <rect x="0" y="0" width="56" height="56" rx="14" fill="oklch(1 0 0)" />
        <path d="M 16 16 L 40 40 M 40 16 L 16 40" stroke="var(--cn-accent)" strokeWidth="3" strokeLinecap="round" />
      </g>

      {/* Floating earnings pill */}
      <g filter="url(#ch-shadow)" transform="translate(20 248)">
        <rect x="0" y="0" width="116" height="44" rx="14" fill="url(#ch-money)" />
        <text x="14" y="20" fontFamily="var(--cn-mono)" fontSize="9" fontWeight="700" fill="oklch(1 0 0)" opacity="0.85" letterSpacing="0.08em">CLEARED</text>
        <text x="14" y="36" fontFamily="var(--cn-sans)" fontSize="16" fontWeight="800" fill="oklch(1 0 0)">+$2,400</text>
      </g>
      {/* Message badge */}
      <g filter="url(#ch-shadow)" transform="translate(456 250)">
        <rect x="0" y="0" width="124" height="44" rx="14" fill="oklch(1 0 0)" />
        <circle cx="20" cy="22" r="8" fill="var(--cn-accent)" />
        <text x="32" y="20" fontFamily="var(--cn-mono)" fontSize="9" fontWeight="700" fill="oklch(0.46 0.005 270)" letterSpacing="0.08em">3 NEW</text>
        <text x="32" y="34" fontFamily="var(--cn-sans)" fontSize="13" fontWeight="700" fill="oklch(0.20 0.012 270)">brand offers</text>
      </g>
    </svg>
  );
}

// =====================================================================
// Phase 54 · AI Engine illustration — audience matching
// =====================================================================
export function AIEngineGraphic({ className, style, ariaLabel = 'AI matching engine' }: IllProps) {
  return (
    <svg viewBox="0 0 480 360" xmlns="http://www.w3.org/2000/svg" role="img" aria-label={ariaLabel} className={className} style={style}>
      <defs>
        <linearGradient id="aie-card" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="oklch(1 0 0)" />
          <stop offset="100%" stopColor="oklch(0.96 0.005 60)" />
        </linearGradient>
        <linearGradient id="aie-bar" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="var(--cn-accent)" stopOpacity="0.92" />
          <stop offset="100%" stopColor="var(--cn-accent)" stopOpacity="0.40" />
        </linearGradient>
        <filter id="aie-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="10" stdDeviation="12" floodColor="oklch(0.20 0.012 270)" floodOpacity="0.16" />
        </filter>
      </defs>

      {/* Audience demographic chart card */}
      <g filter="url(#aie-shadow)">
        <rect x="36" y="48" width="220" height="264" rx="18" fill="url(#aie-card)" stroke="oklch(0.92 0.006 60)" strokeWidth="1" />
        <text x="56" y="78" fontFamily="var(--cn-mono)" fontSize="10" fontWeight="700" fill="oklch(0.46 0.005 270)" letterSpacing="0.10em">AUDIENCE FIT · 94%</text>
        <text x="56" y="106" fontFamily="var(--cn-sans)" fontSize="22" fontWeight="800" fill="oklch(0.20 0.012 270)">@sarahstyle</text>
        {/* Bars */}
        <g>
          <text x="56" y="140" fontFamily="var(--cn-mono)" fontSize="10" fontWeight="600" fill="oklch(0.46 0.005 270)">F · 25-34</text>
          <rect x="120" y="132" width="116" height="10" rx="3" fill="oklch(0.94 0.005 270)" />
          <rect x="120" y="132" width="98" height="10" rx="3" fill="url(#aie-bar)" />

          <text x="56" y="164" fontFamily="var(--cn-mono)" fontSize="10" fontWeight="600" fill="oklch(0.46 0.005 270)">F · 18-24</text>
          <rect x="120" y="156" width="116" height="10" rx="3" fill="oklch(0.94 0.005 270)" />
          <rect x="120" y="156" width="62" height="10" rx="3" fill="url(#aie-bar)" />

          <text x="56" y="188" fontFamily="var(--cn-mono)" fontSize="10" fontWeight="600" fill="oklch(0.46 0.005 270)">M · 25-34</text>
          <rect x="120" y="180" width="116" height="10" rx="3" fill="oklch(0.94 0.005 270)" />
          <rect x="120" y="180" width="40" height="10" rx="3" fill="url(#aie-bar)" />
        </g>
        {/* Affinity tags */}
        <g>
          <rect x="56" y="218" width="68" height="22" rx="6" fill="oklch(0.97 0.04 35)" />
          <text x="90" y="232" textAnchor="middle" fontFamily="var(--cn-mono)" fontSize="10" fontWeight="700" fill="var(--cn-accent)">BEAUTY</text>
          <rect x="130" y="218" width="68" height="22" rx="6" fill="oklch(0.97 0.04 35)" />
          <text x="164" y="232" textAnchor="middle" fontFamily="var(--cn-mono)" fontSize="10" fontWeight="700" fill="var(--cn-accent)">WELLNESS</text>
        </g>
        {/* Score gauge */}
        <g transform="translate(56 256)">
          <rect x="0" y="0" width="180" height="40" rx="10" fill="oklch(0.97 0.005 60)" />
          <text x="14" y="20" fontFamily="var(--cn-mono)" fontSize="9" fontWeight="700" fill="oklch(0.46 0.005 270)" letterSpacing="0.08em">BRAND AFFINITY</text>
          <text x="14" y="34" fontFamily="var(--cn-sans)" fontSize="14" fontWeight="800" fill="oklch(0.30 0.10 145)">96 / 100</text>
        </g>
      </g>

      {/* Match arrows */}
      <g opacity="0.5">
        <path d="M 270 180 L 332 140" stroke="var(--cn-accent)" strokeWidth="1.5" strokeDasharray="3 4" />
        <path d="M 270 180 L 332 180" stroke="var(--cn-accent)" strokeWidth="1.5" strokeDasharray="3 4" />
        <path d="M 270 180 L 332 220" stroke="var(--cn-accent)" strokeWidth="1.5" strokeDasharray="3 4" />
      </g>

      {/* Brand criteria pillars */}
      <g filter="url(#aie-shadow)">
        <rect x="332" y="120" width="120" height="42" rx="10" fill="oklch(1 0 0)" />
        <circle cx="354" cy="141" r="6" fill="var(--cn-accent)" />
        <text x="368" y="138" fontFamily="var(--cn-mono)" fontSize="9" fontWeight="700" fill="oklch(0.46 0.005 270)" letterSpacing="0.08em">DEMO</text>
        <text x="368" y="154" fontFamily="var(--cn-sans)" fontSize="12" fontWeight="700" fill="oklch(0.20 0.012 270)">F · 22-38</text>
      </g>
      <g filter="url(#aie-shadow)">
        <rect x="332" y="170" width="120" height="42" rx="10" fill="oklch(1 0 0)" />
        <circle cx="354" cy="191" r="6" fill="var(--cn-accent)" />
        <text x="368" y="188" fontFamily="var(--cn-mono)" fontSize="9" fontWeight="700" fill="oklch(0.46 0.005 270)" letterSpacing="0.08em">CATEGORY</text>
        <text x="368" y="204" fontFamily="var(--cn-sans)" fontSize="12" fontWeight="700" fill="oklch(0.20 0.012 270)">Beauty</text>
      </g>
      <g filter="url(#aie-shadow)">
        <rect x="332" y="220" width="120" height="42" rx="10" fill="oklch(1 0 0)" />
        <circle cx="354" cy="241" r="6" fill="var(--cn-accent)" />
        <text x="368" y="238" fontFamily="var(--cn-mono)" fontSize="9" fontWeight="700" fill="oklch(0.46 0.005 270)" letterSpacing="0.08em">REGION</text>
        <text x="368" y="254" fontFamily="var(--cn-sans)" fontSize="12" fontWeight="700" fill="oklch(0.20 0.012 270)">EU + UK</text>
      </g>
    </svg>
  );
}

// =====================================================================
// Phase 54 · Control vs Automation — toggle illustration
// =====================================================================
export function ControlAutoToggle({ className, style, ariaLabel = 'Manual or automated workflow' }: IllProps) {
  return (
    <svg viewBox="0 0 480 240" xmlns="http://www.w3.org/2000/svg" role="img" aria-label={ariaLabel} className={className} style={style}>
      <defs>
        <linearGradient id="ct-card" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="oklch(1 0 0)" />
          <stop offset="100%" stopColor="oklch(0.96 0.005 60)" />
        </linearGradient>
        <filter id="ct-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="10" stdDeviation="12" floodColor="oklch(0.20 0.012 270)" floodOpacity="0.14" />
        </filter>
      </defs>
      {/* Manual card */}
      <g filter="url(#ct-shadow)">
        <rect x="32" y="40" width="180" height="160" rx="18" fill="url(#ct-card)" stroke="oklch(0.92 0.006 60)" />
        <text x="52" y="68" fontFamily="var(--cn-mono)" fontSize="10" fontWeight="700" fill="oklch(0.46 0.005 270)" letterSpacing="0.10em">HANDS-ON</text>
        <text x="52" y="98" fontFamily="var(--cn-sans)" fontSize="22" fontWeight="800" fill="oklch(0.20 0.012 270)">Review every</text>
        <text x="52" y="124" fontFamily="var(--cn-sans)" fontSize="22" fontWeight="800" fill="oklch(0.20 0.012 270)">application</text>
        {/* Three review rows */}
        <g>
          <circle cx="60" cy="150" r="7" fill="var(--cn-accent)" />
          <rect x="74" y="146" width="120" height="8" rx="3" fill="oklch(0.92 0.005 270)" />
          <circle cx="60" cy="170" r="7" fill="oklch(0.86 0.005 270)" />
          <rect x="74" y="166" width="100" height="8" rx="3" fill="oklch(0.94 0.005 270)" />
          <circle cx="60" cy="190" r="7" fill="oklch(0.86 0.005 270)" />
          <rect x="74" y="186" width="80" height="8" rx="3" fill="oklch(0.94 0.005 270)" />
        </g>
      </g>
      {/* Auto card */}
      <g filter="url(#ct-shadow)">
        <rect x="268" y="40" width="180" height="160" rx="18" fill="url(#ct-card)" stroke="oklch(0.92 0.006 60)" />
        <text x="288" y="68" fontFamily="var(--cn-mono)" fontSize="10" fontWeight="700" fill="oklch(0.46 0.005 270)" letterSpacing="0.10em">AUTO MODE</text>
        <text x="288" y="98" fontFamily="var(--cn-sans)" fontSize="22" fontWeight="800" fill="oklch(0.20 0.012 270)">AI launches</text>
        <text x="288" y="124" fontFamily="var(--cn-sans)" fontSize="22" fontWeight="800" fill="var(--cn-accent)">instantly.</text>
        {/* Auto pulse rings */}
        <g transform="translate(358 170)">
          <circle r="20" fill="none" stroke="var(--cn-accent)" strokeWidth="1.4" opacity="0.3" />
          <circle r="14" fill="none" stroke="var(--cn-accent)" strokeWidth="1.6" opacity="0.6" />
          <circle r="8"  fill="var(--cn-accent)" />
        </g>
      </g>
      {/* Toggle in middle */}
      <g filter="url(#ct-shadow)" transform="translate(212 96)">
        <rect x="0" y="0" width="56" height="32" rx="16" fill="oklch(1 0 0)" stroke="var(--cn-rule-strong)" />
        <circle cx="40" cy="16" r="11" fill="var(--cn-accent)" />
      </g>
    </svg>
  );
}

// =====================================================================
// Phase 54 · Pillar pictograms (creator side: Safety, EverySize, Reliable, Multi-platform)
// =====================================================================
export function SafetyShield({ className, style, ariaLabel = 'Account safety' }: IllProps) {
  return (
    <svg viewBox="0 0 96 96" xmlns="http://www.w3.org/2000/svg" role="img" aria-label={ariaLabel} className={className} style={style}>
      <defs>
        <linearGradient id="sa-grad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="var(--cn-accent)" stopOpacity="0.92" />
          <stop offset="100%" stopColor="var(--cn-accent)" stopOpacity="0.65" />
        </linearGradient>
        <filter id="sa-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="3" stdDeviation="5" floodColor="oklch(0.20 0.012 270)" floodOpacity="0.20" />
        </filter>
      </defs>
      <g filter="url(#sa-shadow)">
        <path d="M 48 12 L 78 22 L 78 50 C 78 66 64 80 48 86 C 32 80 18 66 18 50 L 18 22 Z" fill="url(#sa-grad)" />
        <path d="M 36 50 L 44 58 L 62 40" fill="none" stroke="oklch(1 0 0)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  );
}

export function EverySize({ className, style, ariaLabel = 'Every follower count' }: IllProps) {
  return (
    <svg viewBox="0 0 96 96" xmlns="http://www.w3.org/2000/svg" role="img" aria-label={ariaLabel} className={className} style={style}>
      <defs>
        <linearGradient id="es-grad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="var(--cn-accent)" stopOpacity="0.92" />
          <stop offset="100%" stopColor="var(--cn-accent)" stopOpacity="0.55" />
        </linearGradient>
        <filter id="es-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="3" stdDeviation="5" floodColor="oklch(0.20 0.012 270)" floodOpacity="0.18" />
        </filter>
      </defs>
      <g filter="url(#es-shadow)">
        <circle cx="22" cy="64" r="14" fill="url(#es-grad)" />
        <circle cx="48" cy="48" r="20" fill="url(#es-grad)" />
        <circle cx="76" cy="32" r="12" fill="url(#es-grad)" />
        <circle cx="22" cy="64" r="6" fill="oklch(1 0 0)" opacity="0.5" />
        <circle cx="48" cy="48" r="9" fill="oklch(1 0 0)" opacity="0.5" />
        <circle cx="76" cy="32" r="5" fill="oklch(1 0 0)" opacity="0.5" />
      </g>
    </svg>
  );
}

export function ReliablePay({ className, style, ariaLabel = 'Reliable payments' }: IllProps) {
  return (
    <svg viewBox="0 0 96 96" xmlns="http://www.w3.org/2000/svg" role="img" aria-label={ariaLabel} className={className} style={style}>
      <defs>
        <linearGradient id="rp-grad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="var(--cn-accent)" stopOpacity="0.92" />
          <stop offset="100%" stopColor="var(--cn-accent)" stopOpacity="0.55" />
        </linearGradient>
        <filter id="rp-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="3" stdDeviation="5" floodColor="oklch(0.20 0.012 270)" floodOpacity="0.18" />
        </filter>
      </defs>
      <g filter="url(#rp-shadow)">
        <rect x="14" y="22" width="68" height="52" rx="10" fill="url(#rp-grad)" />
        <rect x="14" y="32" width="68" height="10" fill="oklch(1 0 0)" opacity="0.18" />
        <circle cx="68" cy="56" r="10" fill="oklch(1 0 0)" />
        <text x="68" y="61" textAnchor="middle" fontFamily="var(--cn-sans)" fontSize="14" fontWeight="800" fill="var(--cn-accent)">$</text>
        <rect x="22" y="50" width="20" height="3" rx="1" fill="oklch(1 0 0)" opacity="0.6" />
        <rect x="22" y="58" width="14" height="3" rx="1" fill="oklch(1 0 0)" opacity="0.4" />
      </g>
    </svg>
  );
}

export function MultiPlatform({ className, style, ariaLabel = 'Multi-platform support' }: IllProps) {
  return (
    <svg viewBox="0 0 96 96" xmlns="http://www.w3.org/2000/svg" role="img" aria-label={ariaLabel} className={className} style={style}>
      <defs>
        <linearGradient id="mp-grad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="var(--cn-accent)" stopOpacity="0.92" />
          <stop offset="100%" stopColor="var(--cn-accent)" stopOpacity="0.55" />
        </linearGradient>
        <filter id="mp-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="3" stdDeviation="5" floodColor="oklch(0.20 0.012 270)" floodOpacity="0.18" />
        </filter>
      </defs>
      <g filter="url(#mp-shadow)">
        <rect x="10" y="10" width="34" height="34" rx="9" fill="url(#mp-grad)" />
        <rect x="52" y="10" width="34" height="34" rx="9" fill="url(#mp-grad)" opacity="0.7" />
        <rect x="10" y="52" width="34" height="34" rx="9" fill="url(#mp-grad)" opacity="0.7" />
        <rect x="52" y="52" width="34" height="34" rx="9" fill="url(#mp-grad)" />
        <circle cx="27" cy="27" r="6" fill="oklch(1 0 0)" />
        <path d="M 65 18 L 65 36 a 5 5 0 1 1 -5 -5" fill="none" stroke="oklch(1 0 0)" strokeWidth="2.4" strokeLinecap="round" />
        <path d="M 19 60 L 35 60 L 35 78 L 19 78 Z M 23 64 L 31 69 L 23 74 Z" fill="oklch(1 0 0)" />
        <text x="69" y="76" textAnchor="middle" fontFamily="var(--cn-sans)" fontSize="20" fontWeight="800" fill="oklch(1 0 0)">+</text>
      </g>
    </svg>
  );
}

// =====================================================================
// Phase 54 · Speed metric pictograms (10x, 2x, 20h)
// =====================================================================
export function FastLaunch({ className, style, ariaLabel = 'Fast launch' }: IllProps) {
  return (
    <svg viewBox="0 0 96 96" xmlns="http://www.w3.org/2000/svg" role="img" aria-label={ariaLabel} className={className} style={style}>
      <defs>
        <linearGradient id="fl-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="var(--cn-accent)" stopOpacity="0.92" />
          <stop offset="100%" stopColor="var(--cn-accent)" stopOpacity="0.55" />
        </linearGradient>
      </defs>
      <path d="M 48 8 L 64 40 L 56 40 L 60 56 L 32 56 L 36 40 L 28 40 Z" fill="url(#fl-grad)" />
      <circle cx="48" cy="74" r="8" fill="var(--cn-accent)" opacity="0.85" />
      <circle cx="48" cy="74" r="12" fill="none" stroke="var(--cn-accent)" strokeWidth="1.2" opacity="0.4" />
    </svg>
  );
}

export function SmartFilter({ className, style, ariaLabel = 'Smart filter' }: IllProps) {
  return (
    <svg viewBox="0 0 96 96" xmlns="http://www.w3.org/2000/svg" role="img" aria-label={ariaLabel} className={className} style={style}>
      <defs>
        <linearGradient id="sf-grad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="var(--cn-accent)" stopOpacity="0.92" />
          <stop offset="100%" stopColor="var(--cn-accent)" stopOpacity="0.55" />
        </linearGradient>
      </defs>
      <path d="M 16 22 L 80 22 L 56 50 L 56 76 L 40 84 L 40 50 Z" fill="url(#sf-grad)" />
      <circle cx="68" cy="34" r="5" fill="oklch(1 0 0)" />
    </svg>
  );
}

export function TimeSaved({ className, style, ariaLabel = 'Time saved' }: IllProps) {
  return (
    <svg viewBox="0 0 96 96" xmlns="http://www.w3.org/2000/svg" role="img" aria-label={ariaLabel} className={className} style={style}>
      <defs>
        <linearGradient id="ts-grad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="var(--cn-accent)" stopOpacity="0.92" />
          <stop offset="100%" stopColor="var(--cn-accent)" stopOpacity="0.55" />
        </linearGradient>
      </defs>
      <circle cx="48" cy="50" r="34" fill="url(#ts-grad)" />
      <circle cx="48" cy="50" r="26" fill="oklch(1 0 0)" />
      <path d="M 48 30 L 48 50 L 64 56" fill="none" stroke="var(--cn-accent)" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="48" cy="50" r="3" fill="var(--cn-accent)" />
    </svg>
  );
}

