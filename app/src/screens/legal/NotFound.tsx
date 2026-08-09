// NotFound.tsx — real 404 surface (audit F33).
//
// The router's catch-all used to be `<Navigate to="/" replace />`, so a
// typo'd URL, a dead outbound link, or a renamed route silently landed on
// the marketing homepage. The visitor had no idea the page they asked for
// didn't exist, and we lost the signal entirely.
//
// Deliberately offers both exits, since a 404 can be reached by either
// audience: browse creators (public) or sign in (returning user).

import { Link } from 'react-router-dom';
import { useEffect } from 'react';
import { Logo } from '@/components/ui/Logo';
import { TileHalo } from '@/components/layout/TileHalo';

export function NotFound() {
  useEffect(() => {
    document.title = 'Page not found · Alamut';
  }, []);

  return (
    <div data-surface="landing-light" className="lp-light-root auth-airy auth-landing-light">
      <TileHalo />
      <header className="airy-topnav auth-landing-topnav">
        <div className="airy-topnav-inner">
          <Link to="/" aria-label="Alamut home" className="airy-topnav-logo">
            <Logo size={20} tag="ALAMUT" />
          </Link>
          <div className="airy-topnav-actions">
            <Link to="/signin" className="lp-topnav-signin">Sign in</Link>
          </div>
        </div>
      </header>

      <main className="airy-section auth-airy-main">
        <div style={{ maxWidth: 560, margin: '0 auto', textAlign: 'center' }}>
          <div className="airy-stack">
            <div className="airy-eyebrow">404</div>
            <h1 className="airy-h-display">This page doesn't exist.</h1>
            <p className="airy-lede">
              The link may be out of date, or the address might have a typo.
            </p>
            <div
              style={{
                display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap',
                justifyContent: 'center', marginTop: 'var(--space-md)',
              }}
            >
              <Link to="/" className="btn btn-solid">Go to the homepage</Link>
              <Link to="/creators" className="btn btn-ghost">Browse creators</Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
