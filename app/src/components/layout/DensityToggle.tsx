import { useEffect, useState } from 'react';

export function DensityToggle() {
  const [compact, setCompact] = useState(() => document.body.getAttribute('data-density') === 'compact');

  useEffect(() => {
    if (compact) {
      document.body.setAttribute('data-density', 'compact');
      localStorage.setItem('alamut.density', 'compact');
    } else {
      document.body.setAttribute('data-density', 'standard');
      localStorage.setItem('alamut.density', 'standard');
    }
  }, [compact]);

  return (
    <button
      onClick={() => setCompact((v) => !v)}
      title={compact ? 'Switch to standard density' : 'Switch to compact density'}
      aria-label={compact ? 'Standard density' : 'Compact density'}
      style={{
        minWidth: 44, minHeight: 44,
        display: 'grid', placeItems: 'center',
        borderRadius: 'var(--radius-sm)',
        color: 'var(--ink-80)',
        background: 'transparent',
      }}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
        {compact ? (
          // Standard view glyph: 3 wider rows
          <><path d="M3 6h18" /><path d="M3 12h18" /><path d="M3 18h18" /></>
        ) : (
          // Compact view glyph: 5 tighter rows
          <><path d="M3 5h18" /><path d="M3 9h18" /><path d="M3 13h18" /><path d="M3 17h18" /><path d="M3 21h18" /></>
        )}
      </svg>
    </button>
  );
}
