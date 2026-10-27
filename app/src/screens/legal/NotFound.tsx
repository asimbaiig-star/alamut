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
import { PublicFooter, PublicNav } from '@/screens/public/PublicChrome';

export function NotFound() {
  useEffect(() => {
    document.title = 'Page not found · Alamut';
  }, []);

  return (
    <div data-surface="v2" className="pub-v2">
      <PublicNav />
      <main className="pub-main">
        <p className="pub-meta">Error 404</p>
        <h1 className="pub-h1">This page doesn’t exist.</h1>
        <p className="pub-lede">The link may be out of date, or the address might have a typo.</p>
        <div className="pub-actions">
          <a href="/" className="pub-btn">Go to the homepage</a>
          <Link to="/creators" className="pub-btn line">Browse creators</Link>
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
