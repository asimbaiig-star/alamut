// Editorial line-art illustrations for empty states — paper-warm, hand-drawn feel,
// no copyrighted material, all original strokes. Pass a `kind` to pick the scene.
// Designed to render at ~140px square with stroke="currentColor" so they pick up
// the surrounding ink color and look at home in any tinted section.

interface EmptyArtProps {
  kind: 'inbox' | 'campaigns' | 'approvals' | 'portfolio' | 'team' | 'discover' | 'wallet' | 'general';
  size?: number;
}

export function EmptyArt({ kind, size = 140 }: EmptyArtProps) {
  const common = {
    width: size, height: size,
    viewBox: '0 0 200 200',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: '1.4',
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };

  switch (kind) {
    case 'inbox':
      // Open envelope flap with a small bird's-wing flourish above
      return (
        <svg {...common} className="empty-art">
          <path d="M40 80 L100 50 L160 80 V160 H40 Z" />
          <path d="M40 80 L100 120 L160 80" />
          <path d="M75 125 L40 160" />
          <path d="M125 125 L160 160" />
          <path d="M85 35 q 15 -12 30 0" opacity="0.5" />
          <path d="M70 28 q 30 -22 60 0" opacity="0.3" />
        </svg>
      );

    case 'campaigns':
      // Stack of brief documents with a paperclip
      return (
        <svg {...common} className="empty-art">
          <rect x="55" y="50" width="90" height="115" rx="3" />
          <rect x="50" y="55" width="90" height="115" rx="3" opacity="0.45" />
          <line x1="70" y1="85" x2="120" y2="85" />
          <line x1="70" y1="100" x2="130" y2="100" />
          <line x1="70" y1="115" x2="115" y2="115" />
          <path d="M125 35 a 10 10 0 0 1 10 10 v 28 a 10 10 0 0 1 -20 0 v -25" />
        </svg>
      );

    case 'approvals':
      // Magnifier over a photograph — "drafts to review"
      return (
        <svg {...common} className="empty-art">
          <rect x="35" y="55" width="100" height="80" rx="3" />
          <circle cx="60" cy="80" r="6" />
          <path d="M35 120 L70 90 L95 110 L130 75 L135 100" />
          <circle cx="135" cy="135" r="22" />
          <line x1="151" y1="151" x2="170" y2="170" />
        </svg>
      );

    case 'portfolio':
      // Portrait frame with a flower stem
      return (
        <svg {...common} className="empty-art">
          <rect x="55" y="35" width="90" height="115" rx="2" />
          <circle cx="100" cy="80" r="14" />
          <path d="M70 130 q 30 -22 60 0" />
          <path d="M40 175 q 30 -10 60 0 q 30 -10 60 0" opacity="0.5" />
          <circle cx="170" cy="40" r="3" />
          <path d="M170 43 v 22" />
        </svg>
      );

    case 'team':
      // Two circles holding hands abstractly
      return (
        <svg {...common} className="empty-art">
          <circle cx="70" cy="80" r="22" />
          <circle cx="130" cy="80" r="22" />
          <path d="M50 165 q 20 -40 50 -40 q 30 0 50 40" />
          <path d="M85 105 q 15 18 30 0" />
        </svg>
      );

    case 'discover':
      // Compass rose — for "no creators match"
      return (
        <svg {...common} className="empty-art">
          <circle cx="100" cy="100" r="60" />
          <path d="M100 50 L110 95 L150 100 L110 105 L100 150 L90 105 L50 100 L90 95 Z" />
          <circle cx="100" cy="100" r="3" />
        </svg>
      );

    case 'wallet':
      // Wallet outline with a bill peeking out
      return (
        <svg {...common} className="empty-art">
          <rect x="35" y="65" width="130" height="80" rx="6" />
          <rect x="35" y="55" width="100" height="20" rx="3" />
          <circle cx="140" cy="105" r="6" />
          <line x1="50" y1="125" x2="80" y2="125" opacity="0.5" />
          <path d="M75 30 q 20 8 0 18 q -20 -10 0 -18" opacity="0.4" />
        </svg>
      );

    default:
      // Folded paper — the universal "blank" — for general empty states
      return (
        <svg {...common} className="empty-art">
          <path d="M50 30 H130 L160 60 V170 H50 Z" />
          <path d="M130 30 V60 H160" />
          <line x1="65" y1="90" x2="140" y2="90" opacity="0.5" />
          <line x1="65" y1="110" x2="125" y2="110" opacity="0.5" />
          <line x1="65" y1="130" x2="135" y2="130" opacity="0.5" />
        </svg>
      );
  }
}
