import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { GlobalSearch } from '@/components/search/GlobalSearch';
import { OnboardingTour } from './OnboardingTour';
import { OnboardingChecklist } from './OnboardingChecklist';
import { HotkeysHelp } from './HotkeysHelp';
import { GlobalHotkeys } from './GlobalHotkeys';
import { Icon } from '@/components/ui/Icon';
import { useStore } from '@/lib/api/store';
import { useAuth } from '@/lib/auth/useAuth';
import { runScheduledNotifications } from '@/lib/api/scheduler';

export function WorkspaceShell() {
  // If the persisted store hasn't rehydrated yet (fresh tab, very brief), show skeleton.
  const hasHydrated = useStore.persist.hasHydrated();
  const [navOpen, setNavOpen] = useState(false);
  const loc = useLocation();

  // Auto-close mobile nav when route changes
  useEffect(() => { setNavOpen(false); }, [loc.pathname]);

  // Lock body scroll while mobile nav is open
  useEffect(() => {
    if (!navOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [navOpen]);

  // Close on Escape
  useEffect(() => {
    if (!navOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setNavOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navOpen]);

  // Allow Sidebar's mobile close X to close the drawer via a global event
  useEffect(() => {
    const onClose = () => setNavOpen(false);
    window.addEventListener('alamut:nav-close', onClose);
    return () => window.removeEventListener('alamut:nav-close', onClose);
  }, []);

  // P4 §3.1 — scheduled-notification heartbeat. Runs once on mount
  // (catch up anything that should have fired while the tab was closed)
  // then every 60s while the workspace is open. Each tick walks the
  // queue, materializes any due Notification rows, and flips their
  // `emitted` flag so the next tick is a no-op for already-fired rows.
  // Cheap: queue size is bounded by N_collabs × N_deliverables × ~5
  // triggers each; sub-millisecond per scan in practice.
  useEffect(() => {
    if (!hasHydrated) return;
    runScheduledNotifications();
    const intervalId = window.setInterval(() => {
      runScheduledNotifications();
    }, 60_000);
    return () => window.clearInterval(intervalId);
  }, [hasHydrated]);

  // Cursor-aware halo — one delegated pointermove listener writes --mx/--my
  // CSS vars to whichever tile-bearing element the cursor is over. CSS
  // (`.kcard::after`, `.creator-card::before`, `.tile-interactive::after`)
  // reads those vars to render a soft accent halo following the cursor.
  // rAF-throttled so it runs at most once per frame.
  useEffect(() => {
    let rafId = 0;
    let lastEl: HTMLElement | null = null;
    // Phase 20 cleanup: include admin queue tiles so the cursor halo is
    // consistent across the app. Previously admin tiles got no halo while
    // peer tiles did.
    const TILE_SEL = '.kcard, .creator-card, .tile-interactive, .bento-tile, .admin-queue-tile';
    const onMove = (e: PointerEvent) => {
      if (rafId) return;
      rafId = requestAnimationFrame(() => {
        rafId = 0;
        const target = e.target as HTMLElement | null;
        const tile = target?.closest(TILE_SEL) as HTMLElement | null;
        if (tile !== lastEl) lastEl = tile;
        if (!tile) return;
        const r = tile.getBoundingClientRect();
        const mx = ((e.clientX - r.left) / r.width) * 100;
        const my = ((e.clientY - r.top) / r.height) * 100;
        tile.style.setProperty('--mx', `${mx}%`);
        tile.style.setProperty('--my', `${my}%`);
      });
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => {
      window.removeEventListener('pointermove', onMove);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, []);

  // Section identifier from the route, used by CSS to tint each workspace
  // area with a barely-there ambient hue. Subliminal wayfinding without
  // sacrificing editorial restraint.
  const section = (() => {
    const p = loc.pathname;
    if (p.includes('/home'))      return 'home';
    if (p.includes('/discover'))  return 'discover';
    if (p.includes('/campaigns')) return 'campaigns';
    if (p.includes('/content'))   return 'content';
    if (p.includes('/inbox'))     return 'inbox';
    if (p.includes('/earnings'))  return 'earnings';
    if (p.includes('/wallet'))    return 'wallet';
    if (p.includes('/analytics')) return 'analytics';
    if (p.includes('/profile'))   return 'profile';
    if (p.includes('/approvals')) return 'approvals';
    if (p.includes('/queue'))     return 'admin-queue';
    if (p.includes('/disputes'))  return 'admin-disputes';
    if (p.includes('/payouts'))   return 'admin-payouts';
    if (p.includes('/audit'))     return 'admin-audit';
    if (p.includes('/verify'))    return 'admin-verify';
    return 'default';
  })();

  return (
    <div className={['shell', navOpen ? 'is-nav-open' : ''].join(' ')} data-section={section}>
      {/* Phase 16 — Skip-to-content link. Visible only when focused via keyboard. */}
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <Sidebar />
      <main id="main-content" className="main" tabIndex={-1}>
        <ManagerActingBanner />
        <button
          className="mobile-nav-toggle"
          onClick={() => setNavOpen(true)}
          aria-label="Open navigation"
          aria-expanded={navOpen}
          aria-controls="primary-sidebar"
        >
          <Icon.layers s={18} />
        </button>
        {hasHydrated ? <Outlet /> : <PageSkeleton />}
      </main>
      {navOpen && (
        <div
          className="mobile-nav-backdrop"
          onClick={() => setNavOpen(false)}
          aria-hidden="true"
        />
      )}
      <GlobalSearch />
      <GlobalHotkeys />
      <OnboardingTour />
      <OnboardingChecklistGate />
      <HotkeysHelp />
    </div>
  );
}

// Phase 20 cleanup: OnboardingChecklist is creator-only but used to
// render in the tree for every role (its internal guard short-circuited
// later). Gate at the shell so admin/brand routes don't even mount it.
function OnboardingChecklistGate() {
  const { user, isCreator } = useAuth();
  if (!user || !isCreator) return null;
  return <OnboardingChecklist />;
}

function ManagerActingBanner() {
  const { user } = useAuth();
  const db = useStore((s) => s.db);
  if (!user?.managesCreatorIds || user.managesCreatorIds.length === 0) return null;
  // Resolve the creators this user manages
  const managed = db.creators.filter((c) => user.managesCreatorIds!.includes(c.id));
  if (managed.length === 0) return null;
  return (
    <div
      role="status"
      style={{
        position: 'sticky', top: 0, zIndex: 40,
        padding: '8px 24px',
        background: 'color-mix(in oklch, var(--accent) 14%, var(--paper))',
        borderBottom: '1px solid color-mix(in oklch, var(--accent) 30%, transparent)',
        fontSize: 12, fontFamily: 'var(--mono)', letterSpacing: '0.04em',
        color: 'var(--ink-80)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
      }}
    >
      <span>
        ◆ MANAGER MODE · You're acting on behalf of {managed.map((c) => c.name).join(', ')}
      </span>
      <span style={{ color: 'var(--ink-60)', fontSize: 11 }}>
        Every action is logged with your identity
      </span>
    </div>
  );
}

function PageSkeleton() {
  return (
    <div className="page page-loading" aria-busy="true" aria-label="Loading">
      {/* Branded loading state — Fraunces "A" mark draws in, paper-warm pulse
          background. Replaces the generic shimmer skeleton on cold rehydrate. */}
      <div className="brand-loader">
        <svg
          className="brand-loader-mark"
          width="56" height="56" viewBox="0 0 56 56"
          fill="none" stroke="currentColor" strokeWidth="2"
          strokeLinecap="round" strokeLinejoin="round"
          aria-hidden="true"
        >
          {/* Two strokes that together form a serif "A" cap. The dasharray
              animation draws each in sequence over ~900ms. */}
          <path d="M 12 46 L 28 10 L 44 46" className="brand-loader-stroke-a" />
          <path d="M 18 34 L 38 34" className="brand-loader-stroke-b" />
        </svg>
        <div className="brand-loader-tag">ALAMUT</div>
      </div>
    </div>
  );
}
