import { useEffect, useState } from 'react';

export function ThemeToggle() {
  const [dark, setDark] = useState(() => document.body.getAttribute('data-theme') === 'dark');

  useEffect(() => {
    if (dark) {
      document.body.setAttribute('data-theme', 'dark');
      localStorage.setItem('alamut.theme', 'dark');
    } else {
      document.body.removeAttribute('data-theme');
      localStorage.removeItem('alamut.theme');
    }
  }, [dark]);

  return (
    <button
      onClick={() => setDark((v) => !v)}
      title={dark ? 'Switch to light' : 'Switch to dark'}
      aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
      style={{
        minWidth: 44, minHeight: 44,
        display: 'grid', placeItems: 'center',
        borderRadius: 'var(--radius-sm)',
        color: 'var(--ink-80)',
        background: 'transparent',
      }}
    >
      {dark ? (
        // Sun
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
        </svg>
      ) : (
        // Moon
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      )}
    </button>
  );
}
