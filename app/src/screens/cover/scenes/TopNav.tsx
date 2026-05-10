// TopNav · Phase 54 rebuild
//
// Always-visible "Sign in" link alongside the primary "Join free"
// CTA. Previous version conditionally hid Sign in behind auth state
// — user feedback flagged that as a missing affordance for the
// most-common visitor (logged-out, returning).
//
// Layout: logo left · section anchors center · Sign in + Join free
// right. On the brand-facing page, BrandLanding renders its own
// header (different anchors + persona-segment link), so this nav
// is only used by the creator landing.

import { Link } from 'react-router-dom';
import { Logo } from '@/components/ui/Logo';
import { useAuth } from '@/lib/auth/useAuth';

export function TopNav() {
  const { user, isCreator, isBrand } = useAuth();
  const continueHref = isCreator ? '/creator/today' : isBrand ? '/brand/today' : '/admin/home';

  return (
    <header className="cn-topnav lp-topnav-v2" aria-label="Primary">
      <Link to="/" className="lp-topnav-brand" aria-label="Alamut home">
        <Logo size={20} tag="ALAMUT" />
      </Link>
      <nav className="cn-topnav-links" aria-label="Sections">
        <a href="#why">Why creators</a>
        <a href="#how">How it works</a>
        <a href="#voices">Voices</a>
        <a href="#pricing">Pricing</a>
      </nav>
      <div className="cn-topnav-actions lp-topnav-actions-v2">
        {user ? (
          <Link to={continueHref} className="cn-topnav-cta">
            Continue <span aria-hidden="true">→</span>
          </Link>
        ) : (
          <>
            <Link to="/signin" className="lp-topnav-signin">
              Sign in
            </Link>
            <Link to="/signup?role=creator" className="cn-topnav-cta">
              Join free <span aria-hidden="true">→</span>
            </Link>
          </>
        )}
      </div>
    </header>
  );
}
