// PublicChrome.tsx — the nav and footer of the app's public pages (legal,
// 404, the rate calculators, the creators directory), matching the landing
// pages: the portal's mark beside "Alamut" in Fraunces, the audience switch,
// Sign in and one button. Styles: styles/public-v2.css.

import { Link } from 'react-router-dom';
import { BrandMarkSvg } from '@/screens/workspace-v2/BrandMark';
import { useAuth } from '@/lib/auth/useAuth';
import '@/styles/public-v2.css';

/** The landing pages are prerendered outside the app, so they're plain links. */
export function PublicNav({ audience = 'creators' }: { audience?: 'creators' | 'brands' }) {
  const { user } = useAuth();
  const other = audience === 'creators' ? { href: '/for-brands', label: 'For brands' } : { href: '/', label: 'For creators' };
  const join = audience === 'creators'
    ? { to: '/signup?role=creator', label: 'Join free' }
    : { to: '/signup?role=brand', label: 'Post a brief' };
  return (
    <header className="pub-nav" data-surface="v2">
      <div className="pub-nav-inner">
        <a href="/" className="pub-brand" aria-label="Alamut home">
          <span className="pub-brand-mark" aria-hidden="true"><BrandMarkSvg /></span>
          <span className="pub-brand-name">Alamut</span>
        </a>
        <nav className="pub-nav-links" aria-label="Main">
          <a className="pub-nav-link pub-nav-aud" href={other.href}>{other.label}</a>
          {user ? (
            <Link to="/v2" className="pub-btn">Open workspace</Link>
          ) : (
            <>
              <Link to="/signin" className="pub-nav-link">Sign in</Link>
              <Link to={join.to} className="pub-btn">{join.label}</Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}

export function PublicFooter() {
  return (
    <footer className="pub-foot" data-surface="v2">
      <div className="pub-foot-inner">
        <a href="/" className="pub-brand" aria-label="Alamut home">
          <span className="pub-brand-mark" aria-hidden="true"><BrandMarkSvg /></span>
          <span className="pub-brand-name">Alamut</span>
        </a>
        <nav aria-label="Footer">
          <a href="/">For creators</a>
          <a href="/for-brands">For brands</a>
          <Link to="/creators">Browse creators</Link>
          <Link to="/tools/instagram-calculator">Rate calculators</Link>
          <Link to="/terms">Terms</Link>
          <Link to="/privacy">Privacy</Link>
        </nav>
        <p className="pub-foot-note">Public beta. Payments are simulated.</p>
      </div>
    </footer>
  );
}
