// Workspace.tsx — v2 shell entry point
//
// Mounted at /v2 in the router. Owns the persona state (brand vs.
// creator) and the internal route state. The whole v2 system lives
// under one URL today; we can promote nested URLs later when the
// surface is ready to be promoted out of preview.

import { useEffect, useRef, useState, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import '@/styles/workspace-v2.css';
import '@/styles/workspace-v2-campaign-mgmt.css';
import '@/styles/workspace-v2-home.css';
import { Icon } from './lib';
import {
  useV2CurrentBrand, useV2CurrentCreator, useV2Conversations,
  useV2ManagedCreators, v2SetActingForCreator,
} from './v2Hooks';
import { v2SweepStaleOffers } from './v2CampaignActions';
import { useAuth } from '@/lib/auth/useAuth';
import { useScheduledNotifications } from '@/lib/api/useScheduledNotifications';
import { api } from '@/lib/api/client';
import { Avatar } from '@/components/ui/Avatar';
// F6 — chunk split. All 24 screens used to be static imports, so the
// single Workspace chunk was ~571 KB (140 KB gzip) and every signin paid
// for CampaignDetail (3,096 lines) and both onboarding wizards even
// though most sessions never open them.
//
// EAGER: the two persona landing screens — they render immediately after
// signin, so lazy-loading them would only add a fetch to the critical
// path. Everything else is at least one click away and loads on demand
// behind the Suspense boundary in the outlet above.
import { BrandHome } from './screens/BrandHome';
import { CreatorHome } from './screens/CreatorHome';

// LAZY: one-click-away or once-per-account surfaces, biggest first.
const CampaignDetail = lazy(() => import('./screens/CampaignDetail').then((m) => ({ default: m.CampaignDetail })));
const Storefront = lazy(() => import('./screens/Storefront').then((m) => ({ default: m.Storefront })));
const CollabDetail = lazy(() => import('./screens/CollabDetail').then((m) => ({ default: m.CollabDetail })));
const BrowseBriefs = lazy(() => import('./screens/BrowseBriefs').then((m) => ({ default: m.BrowseBriefs })));
const Spark = lazy(() => import('./screens/Spark').then((m) => ({ default: m.Spark })));
const Discover = lazy(() => import('./screens/Discover').then((m) => ({ default: m.Discover })));
const Inbox = lazy(() => import('./screens/Inbox').then((m) => ({ default: m.Inbox })));
const Campaigns = lazy(() => import('./screens/Campaigns').then((m) => ({ default: m.Campaigns })));
const MyCollabs = lazy(() => import('./screens/MyCollabs').then((m) => ({ default: m.MyCollabs })));
const BriefDetail = lazy(() => import('./screens/BriefDetail').then((m) => ({ default: m.BriefDetail })));
const CreatorProfile = lazy(() => import('./screens/CreatorProfile').then((m) => ({ default: m.CreatorProfile })));
const PublicStorefront = lazy(() => import('./screens/PublicStorefront').then((m) => ({ default: m.PublicStorefront })));
const BrandWallet = lazy(() => import('./screens/BrandWallet').then((m) => ({ default: m.BrandWallet })));
const CreatorWallet = lazy(() => import('./screens/CreatorWallet').then((m) => ({ default: m.CreatorWallet })));
const BrandProfile = lazy(() => import('./screens/BrandProfile').then((m) => ({ default: m.BrandProfile })));
const BrandAnalytics = lazy(() => import('./screens/BrandAnalytics').then((m) => ({ default: m.BrandAnalytics })));
const Analytics = lazy(() => import('./screens/Analytics').then((m) => ({ default: m.Analytics })));
const Calendar = lazy(() => import('./screens/Calendar').then((m) => ({ default: m.Calendar })));
const KycTax = lazy(() => import('./screens/KycTax').then((m) => ({ default: m.KycTax })));
const NewCampaignWizard = lazy(() => import('./screens/NewCampaignWizard').then((m) => ({ default: m.NewCampaignWizard })));
// Run exactly once per account, yet shipped on every page load pre-split.
const CreatorOnboardingV2 = lazy(() => import('./screens/CreatorOnboardingV2').then((m) => ({ default: m.CreatorOnboardingV2 })));
const BrandOnboardingV2 = lazy(() => import('./screens/BrandOnboardingV2').then((m) => ({ default: m.BrandOnboardingV2 })));
// `DealRoom` retired on §2.5 — `deal:<convId>` now opens Inbox with
// the matching thread + detailed side panel via `forceThreadId`.

type Persona = 'brand' | 'creator';

// Brand-side routes (per design's BRAND_ROUTES). Note the inbox row has
// no `count` here — it's computed live in `Sidebar` from useV2Conversations
// so the badge tracks real unread state instead of a hardcoded literal.
const BRAND_ROUTES = [
  { id: 'home', label: 'Home', icon: Icon.home },
  { id: 'spark', label: 'Spark', icon: Icon.spark, badge: 'AI' },
  { id: 'discover', label: 'Discover creators', icon: Icon.search },
  { id: 'campaigns', label: 'My campaigns', icon: Icon.campaign },
  { id: 'inbox', label: 'Inbox', icon: Icon.inbox },
  { id: 'calendar', label: 'Calendar', icon: Icon.calendar },
  { id: 'brand-analytics', label: 'Analytics', icon: Icon.chart },
  { id: 'wallet', label: 'Wallet', icon: Icon.wallet },
  { id: 'brand-profile', label: 'Brand profile', icon: Icon.shield },
] as const;

// Creator-side routes (per design's CREATOR_ROUTES). Same live-count
// treatment for `creator-inbox` as above.
const CREATOR_ROUTES = [
  { id: 'creator-home', label: 'Home', icon: Icon.home },
  { id: 'storefront', label: 'My storefront', icon: Icon.store },
  { id: 'creator-collabs', label: 'My collaborations', icon: Icon.campaign },
  { id: 'creator-campaigns', label: 'Browse campaigns', icon: Icon.search },
  { id: 'creator-inbox', label: 'Inbox', icon: Icon.inbox },
  { id: 'creator-calendar', label: 'Calendar', icon: Icon.calendar },
  { id: 'analytics', label: 'Analytics', icon: Icon.chart },
  { id: 'creator-wallet', label: 'Wallet', icon: Icon.wallet },
  { id: 'kyc', label: 'KYC & Tax', icon: Icon.shield },
] as const;

const PERSONA_KEY = 'alamut.v2.persona';
const ROUTE_KEY = 'alamut.v2.route';

/**
 * Reject creator-only routes for a brand persona (and vice versa) so a
 * stale localStorage value from a previous user's session doesn't leak
 * into a fresh sign-in. Drilldown prefixes are SHARED — `deal:` opens
 * the same Inbox surface from either side, and a creator clicking a
 * notification linking to `campaign:` should not be teleported into
 * Hannah's brand workspace via the demo fallback in `getViewerUserId`.
 * Returns `true` for routes that fit either persona; `false` blocks the
 * Workspace from booting into a mismatched dashboard. */
/** Which persona a route belongs to. `shared` = either side may open it. */
export type RoutePersona = Persona | 'shared';

/** Creator-only top-level routes. */
export const CREATOR_ONLY_ROUTES: ReadonlySet<string> = new Set([
  'creator-home', 'storefront', 'creator-collabs', 'creator-campaigns',
  'creator-inbox', 'creator-calendar', 'analytics', 'creator-wallet', 'kyc',
  'onboarding-creator',
]);

/** Brand-only top-level routes. */
export const BRAND_ONLY_ROUTES: ReadonlySet<string> = new Set([
  'home', 'spark', 'discover', 'campaigns', 'inbox', 'calendar', 'wallet',
  'campaign-new', 'onboarding-brand', 'brand-profile', 'brand-analytics',
]);

/** Drilldown prefixes both personas may open. RouteOutlet renders the
 *  right component for the CURRENT persona, so these must never flip it —
 *  a creator opening a deal from her inbox must stay a creator. */
const SHARED_PREFIXES = ['creator:', 'campaign:', 'deal:', 'collab:', 'brief:', 'public:'];

/**
 * Strip a query string from a route.
 *
 * `RouteOutlet` parses routes with `startsWith` (`kyc?action=next-step`,
 * `wallet?action=topup`, `spark?prompt=…`), but the persona logic compared
 * with `===` against bare names — so any route carrying a query silently
 * matched nothing and skipped its persona handling entirely.
 */
export function routeBase(route: string): string {
  const q = route.indexOf('?');
  return q === -1 ? route : route.slice(0, q);
}

/**
 * The single classification both the guard and the navigator read.
 *
 * These lists used to exist twice — once as local Sets inside
 * `routeFitsPersona`, once as a different set of membership tests inside
 * `go()` — so a route could be blocked by one and flipped by the other.
 */
export function personaForRoute(route: string): RoutePersona {
  const base = routeBase(route);
  if (SHARED_PREFIXES.some((p) => base.startsWith(p))) return 'shared';
  if (CREATOR_ONLY_ROUTES.has(base)) return 'creator';
  if (BRAND_ONLY_ROUTES.has(base)) return 'brand';
  // Unknown routes — let through; RouteOutlet falls back to BrandHome.
  return 'shared';
}

/** Blocks the Workspace from booting into a mismatched dashboard. */
export function routeFitsPersona(route: string, persona: Persona): boolean {
  const owner = personaForRoute(route);
  return owner === 'shared' || owner === persona;
}

export function WorkspaceV2() {
  const { user, isCreator, isBrand } = useAuth();

  // Persona persists across reloads so the user lands back where they were.
  // The seed `personaForUser` resolves it from the auth session first
  // (so a brand user always boots into 'brand', creator into 'creator')
  // and only falls back to localStorage / 'brand' when there's no session.
  // Without this, a previous session's persona leaked across sign-ins —
  // e.g., signing in as Hannah (brand) after Sarah (creator) used the
  // workspace would render Sarah's dashboard because localStorage still
  // said 'creator' and `getViewerUserId` fell through to the demo creator.
  const personaForUser = (): Persona => {
    if (isBrand) return 'brand';
    if (isCreator) return 'creator';
    if (typeof window === 'undefined') return 'brand';
    try {
      return (localStorage.getItem(PERSONA_KEY) as Persona | null) ?? 'brand';
    } catch {
      return 'brand';
    }
  };
  const [persona, setPersonaState] = useState<Persona>(personaForUser);
  const [route, setRouteState] = useState<string>(() => {
    if (typeof window === 'undefined') return persona === 'creator' ? 'creator-home' : 'home';
    // URL `?tab=<route>` takes precedence over localStorage so deep-
    // links + browser back/forward both work. The URL is updated on
    // every `go()` (see effect below) so this initial-load read is
    // the only place we trust localStorage as a fallback.
    try {
      const urlTab = new URLSearchParams(window.location.search).get('tab');
      if (urlTab && routeFitsPersona(urlTab, persona)) return urlTab;
    } catch { /* no-op */ }
    let stored: string | null = null;
    try { stored = localStorage.getItem(ROUTE_KEY); } catch { /* no-op */ }
    // Reject a stored route that doesn't fit the persona — fixes the
    // cross-user leak where a stale `creator-home` from a previous
    // session would survive a sign-in as a brand and render the wrong
    // dashboard. `routeFitsPersona` is permissive: shared routes like
    // `inbox` / `wallet` / drilldown prefixes (`creator:`/`campaign:`/
    // `deal:`/`collab:`/`brief:`) are accepted for either persona so
    // legitimate deep-links still work.
    if (stored && routeFitsPersona(stored, persona)) return stored;
    return persona === 'creator' ? 'creator-home' : 'home';
  });

  // Sync persona + route to the auth identity whenever the session user
  // changes (sign-in, sign-out, or persona change in the same tab). The
  // route also resets to the persona's default home so a brand user
  // doesn't land on `creator-home` after sign-in. Subsequent in-app
  // route changes set persona via `go()` and are honored — this only
  // fires on identity change, tracked by a ref.
  // Scheduled-notification heartbeat. This shell is where brands and
  // creators actually live; the queue was only ever drained by
  // WorkspaceShell, which is admin-gated, so deadline reminders, overdue
  // follow-ups, stale-escrow nudges, review-window warnings and KYC-expiry
  // prompts were enqueued and never emitted for either persona.
  useScheduledNotifications();

  const lastSeenUserIdRef = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    const currentUserId = user?.id ?? null;
    if (lastSeenUserIdRef.current === currentUserId) return;
    const isFirstRun = lastSeenUserIdRef.current === undefined;
    lastSeenUserIdRef.current = currentUserId;
    if (isBrand && persona !== 'brand') {
      setPersonaState('brand');
      if (!isFirstRun) setRouteState('home');
    } else if (isCreator && persona !== 'creator') {
      setPersonaState('creator');
      if (!isFirstRun) setRouteState('creator-home');
    }
  }, [user?.id, isBrand, isCreator, persona]);

  // Stale-offer sweep on workspace mount — one-shot. Flips pending/
  // countered offers older than the TTL to 'expired' so the kanban
  // and inbox don't accumulate dead-deal clutter forever, and both
  // sides get a notification that the brand can re-engage fresh.
  // Idempotent; running once per page-load is fine.
  useEffect(() => {
    v2SweepStaleOffers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist
  useEffect(() => {
    try { localStorage.setItem(PERSONA_KEY, persona); } catch { /* no-op */ }
  }, [persona]);
  useEffect(() => {
    try { localStorage.setItem(ROUTE_KEY, route); } catch { /* no-op */ }
  }, [route]);

  // Browser history sync — push every route change into the URL so the
  // browser's back/forward buttons navigate between workspace tabs
  // instead of escaping all the way out to the landing page. The route
  // string becomes `?tab=<route>`; on popstate we read it back and
  // update the internal state. Initial mount also seeds from URL (see
  // useState initializer above).
  //
  // Suppression flag: when the URL changes BECAUSE we just popstate'd,
  // skip the push to avoid an infinite loop.
  const suppressNextPushRef = useRef(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (suppressNextPushRef.current) {
      suppressNextPushRef.current = false;
      return;
    }
    try {
      const params = new URLSearchParams(window.location.search);
      const current = params.get('tab');
      if (current === route) return; // already in sync
      params.set('tab', route);
      const url = `${window.location.pathname}?${params.toString()}`;
      window.history.pushState({ alamutTab: route }, '', url);
    } catch { /* no-op */ }
  }, [route]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    function onPopState() {
      try {
        const urlTab = new URLSearchParams(window.location.search).get('tab');
        if (!urlTab) return;
        suppressNextPushRef.current = true;
        setRouteState(urlTab);
      } catch { /* no-op */ }
    }
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  // Phase 54 — mobile drawer state. The sidebar is hidden at ≤880px
  // and replaced with a slide-in drawer triggered by a hamburger
  // button. Pre-fix mobile users had no way to navigate after sign-in
  // because the sidebar was display:none with no replacement nav.
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  function go(next: string) {
    setRouteState(next);
    // Always close the mobile drawer on any nav — otherwise tapping a
    // route inside the drawer would leave it open over the destination.
    setMobileNavOpen(false);
    // Auto-flip persona ONLY for explicit top-level nav clicks. Drilldown
    // routes (`deal:`, `campaign:`, `creator:`, `collab:`, `brief:`,
    // `public:`) preserve the current persona — a creator clicking
    // "Open deal room" from her inbox must not be teleported into the
    // demo brand workspace via `getViewerUserId`'s fallback. The route
    // handler (RouteOutlet) passes `persona` through to surfaces that
    // care (Inbox renders persona-aware bubbles + counterparty resolution).
    //
    // Derived from `personaForRoute` rather than a second hand-written list.
    // The old duplicate missed query-string routes entirely (`===` against
    // `kyc?action=…`), and could disagree with `routeFitsPersona` about who
    // owns a route.
    const owner = personaForRoute(next);
    if (owner !== 'shared') setPersonaState(owner);
    window.scrollTo(0, 0);
  }

  // Lock body scroll while the mobile drawer is open so the page
  // beneath doesn't scroll along with the drawer's nav list.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (mobileNavOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = prev; };
    }
  }, [mobileNavOpen]);

  // Onboarding wizards render full-bleed without the workspace shell.
  // They manage their own data-surface wrapper internally.
  if (route === 'onboarding-creator') return <CreatorOnboardingV2 onRoute={go} />;
  if (route === 'onboarding-brand') return <BrandOnboardingV2 onRoute={go} />;

  // Phase 58 — initial boot skeleton. Pre-fix the workspace mounted
  // immediately even when `useAuth()` was still resolving the session
  // — surfaces showed "—" / "Loading..." for a frame and then snapped
  // to real data. A short skeleton is friendlier to the eye.
  const isHydrating = user === undefined;
  if (isHydrating) {
    return (
      <div data-surface="v2">
        <div className="v2-shell">
          <aside className="v2-sidebar" aria-busy="true">
            <div className="v2-brand" style={{ pointerEvents: 'none' }}>
              <div className="v2-brand-mark"><svg viewBox="0 0 32 32" width="20" height="20"><path d="M16 4 L28 26 L22 26 L16 14 L10 26 L4 26 Z" fill="var(--v2-paper)" /><circle cx="16" cy="22" r="2" fill="var(--v2-accent)" /></svg></div>
              <div className="v2-brand-name">Alamut</div>
            </div>
            <nav className="v2-nav" aria-hidden="true">
              {[1,2,3,4,5,6,7].map((i) => (
                <div key={i} style={{
                  height: 32, margin: '4px 8px', borderRadius: 6,
                  background: 'var(--v2-bg-2)', opacity: 0.6,
                }} />
              ))}
            </nav>
          </aside>
          <main className="v2-main" aria-busy="true">
            <div style={{
              padding: '40px 32px',
              display: 'flex', flexDirection: 'column', gap: 24,
            }}>
              <div style={{ height: 32, width: 240, background: 'var(--v2-bg-2)', borderRadius: 6, opacity: 0.6 }} />
              <div style={{ height: 120, background: 'var(--v2-bg-2)', borderRadius: 12, opacity: 0.45 }} />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                {[1,2,3].map((i) => (
                  <div key={i} style={{ height: 100, background: 'var(--v2-bg-2)', borderRadius: 10, opacity: 0.4 }} />
                ))}
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div data-surface="v2">
      <div className="v2-shell">
        {/* Phase 54 — mobile-only hamburger. CSS hides this at >880px
            so desktop is unaffected. Position: fixed top-left so it
            floats above any page's topbar without per-screen rewires. */}
        <button
          type="button"
          className="v2-mobile-menu-btn"
          aria-label={mobileNavOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={mobileNavOpen}
          aria-controls="v2-sidebar"
          onClick={() => setMobileNavOpen((v) => !v)}
        >
          {mobileNavOpen ? (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          ) : (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          )}
        </button>

        {/* Backdrop — taps dismiss the drawer. Renders only when open. */}
        {mobileNavOpen && (
          <div
            className="v2-mobile-backdrop"
            aria-hidden="true"
            onClick={() => setMobileNavOpen(false)}
          />
        )}

        <Sidebar persona={persona} route={route} onRoute={go} isMobileOpen={mobileNavOpen} />
        <main className="v2-main">
          {/* F6 — the heavier screens below are lazy-loaded, so the outlet
              needs a Suspense boundary. Sidebar + chrome stay mounted, so
              a chunk fetch reads as the content area filling in rather
              than a full-page loading state. */}
          <Suspense fallback={<div className="v2-content" aria-busy="true" />}>
            <RouteOutlet route={route} onRoute={go} persona={persona} />
          </Suspense>
        </main>
      </div>
    </div>
  );
}

function RouteOutlet({ route, onRoute, persona }: { route: string; onRoute: (r: string) => void; persona: Persona }) {
  // Prefix routes (drilldowns)
  if (route.startsWith('creator:')) {
    const creatorId = route.slice('creator:'.length);
    return <CreatorProfile creatorId={creatorId} onRoute={onRoute} />;
  }
  if (route.startsWith('public:')) {
    const handle = route.slice('public:'.length);
    return <PublicStorefront handle={handle} onRoute={onRoute} />;
  }
  if (route.startsWith('deal:')) {
    // §2.5 collapse — `deal:<convId>` no longer routes to a separate
    // `DealRoom` surface. It opens Inbox with the matching thread
    // pre-selected and the right pane promoted to detailed mode. The
    // shared `CollabSidePanel` renders in both density modes; the
    // detailed mode adds a brief excerpt + per-stage hint.
    //
    // We keep the `deal:` prefix indefinitely so existing notification
    // hrefs and bookmarks still work — the brief calls this out as a
    // mitigation for the breaking-deep-link risk.
    const dealId = route.slice('deal:'.length);
    return (
      <Inbox
        onRoute={onRoute}
        persona={persona}
        forceThreadId={dealId}
        forcePanelMode="detailed"
      />
    );
  }
  if (route.startsWith('campaign:')) {
    // §needs-you-direct-jump — drilldown routes accept a query-string
    // suffix so home-tile clicks can land on a specific tab + modal.
    // Format: `campaign:<id>?tab=content&review=<collabId>`. Tabs are
    // a small fixed set (pipeline / brief / content / analytics /
    // settings); unknown values fall through to the default tab.
    const [campaignId, queryStr] = route.slice('campaign:'.length).split('?');
    const params = new URLSearchParams(queryStr ?? '');
    // `?action=verify-live&sub=<id>` from BrandHome's "verify and confirm
    // live" tile auto-pops MarkLiveModal for the given submission.
    const verifyLiveSub = params.get('action') === 'verify-live'
      ? (params.get('sub') ?? undefined)
      : undefined;
    return (
      <CampaignDetail
        campaignId={campaignId}
        onRoute={onRoute}
        initialTab={(params.get('tab') as never) ?? undefined}
        initialReviewCollabId={params.get('review') ?? undefined}
        initialVerifyLiveSubmissionId={verifyLiveSub}
      />
    );
  }
  if (route.startsWith('collab:')) {
    // `collab:<id>?action=upload` opens the upload modal on mount so
    // the creator can act in one click from "Today" tiles.
    const [collabId, queryStr] = route.slice('collab:'.length).split('?');
    const params = new URLSearchParams(queryStr ?? '');
    return (
      <CollabDetail
        collabId={collabId}
        onRoute={onRoute}
        initialAction={(params.get('action') as never) ?? undefined}
      />
    );
  }
  if (route.startsWith('brief:')) {
    const campaignId = route.slice('brief:'.length).split('?')[0];
    return <BriefDetail campaignId={campaignId} onRoute={onRoute} />;
  }

  // Brand
  if (route === 'home') return <BrandHome onRoute={onRoute} />;
  if (route === 'spark' || route.startsWith('spark?')) {
    // `spark?prompt=<encoded>` lets entry points (BrandHome composer,
    // future spark-suggestion deep links) pre-fill the Spark
    // conversation with what the user typed before navigating.
    const queryStr = route.includes('?') ? route.split('?')[1] : '';
    const params = new URLSearchParams(queryStr);
    const initialPrompt = params.get('prompt') ?? undefined;
    return <Spark onRoute={onRoute} initialPrompt={initialPrompt} />;
  }
  if (route === 'discover') return <Discover onRoute={onRoute} />;
  if (route === 'campaign-new' || route.startsWith('campaign-new?')) {
    // `campaign-new?name=Eid&deadline=2026-06-06&category=Cultural&brief=...`
    // lets entry points (CulturalCalendar Plan tiles, Spark Lock-in)
    // pre-seed the wizard with event/draft context.
    const queryStr = route.includes('?') ? route.split('?')[1] : '';
    const params = new URLSearchParams(queryStr);
    const invitedStr = params.get('invited') ?? '';
    // `campaign-new?draft=<campaignId>` reopens a saved draft. Without this
    // the "Save as draft" button had nowhere to send the brand back to.
    const draftId = params.get('draft') ?? undefined;
    return (
      <NewCampaignWizard
        key={draftId ?? 'new'}
        onRoute={onRoute}
        initialDraftId={draftId}
        initialName={params.get('name') ?? undefined}
        initialDeadline={params.get('deadline') ?? undefined}
        initialCategory={params.get('category') ?? undefined}
        initialBriefSeed={params.get('brief') ?? undefined}
        initialBudget={params.get('budget') ? Number(params.get('budget')) || undefined : undefined}
        initialPerCreator={params.get('perCreator') ? Number(params.get('perCreator')) || undefined : undefined}
        initialInvitedCreators={invitedStr ? invitedStr.split(',').filter(Boolean) : undefined}
      />
    );
  }
  if (route === 'campaigns') return <Campaigns onRoute={onRoute} />;
  if (route === 'inbox') return <Inbox onRoute={onRoute} persona="brand" />;
  if (route === 'wallet' || route.startsWith('wallet?')) {
    // Parse `wallet?action=topup` so the "Top up wallet" Needs-you tile
    // drops the brand directly into the top-up modal.
    const queryStr = route.includes('?') ? route.split('?')[1] : '';
    const params = new URLSearchParams(queryStr);
    return (
      <BrandWallet
        onRoute={onRoute}
        initialAction={(params.get('action') as never) ?? undefined}
      />
    );
  }
  if (route === 'brand-profile') return <BrandProfile onRoute={onRoute} />;
  if (route === 'brand-analytics') return <BrandAnalytics onRoute={onRoute} />;
  if (route === 'calendar') return <Calendar onRoute={onRoute} />;

  // Creator
  if (route === 'creator-home') return <CreatorHome onRoute={onRoute} />;
  if (route === 'storefront') return <Storefront onRoute={onRoute} />;
  if (route === 'creator-collabs') return <MyCollabs onRoute={onRoute} />;
  if (route === 'creator-campaigns' || route.startsWith('creator-campaigns?')) {
    // `creator-campaigns?filter=saved` pre-applies the saved-only
    // filter so the "Saved for later" home tile lands the creator
    // straight inside their bookmarks.
    const queryStr = route.includes('?') ? route.split('?')[1] : '';
    const params = new URLSearchParams(queryStr);
    return (
      <BrowseBriefs
        onRoute={onRoute}
        initialFilter={(params.get('filter') as never) ?? undefined}
        initialStatus={(params.get('status') as never) ?? undefined}
      />
    );
  }
  if (route === 'creator-inbox') return <Inbox onRoute={onRoute} persona="creator" />;
  if (route === 'creator-calendar') return <Calendar onRoute={onRoute} />;
  if (route === 'analytics') return <Analytics onRoute={onRoute} />;
  if (route === 'creator-wallet') return <CreatorWallet onRoute={onRoute} />;
  if (route === 'kyc' || route.startsWith('kyc?')) {
    // `kyc?action=next-step` scrolls to the next incomplete step.
    const queryStr = route.includes('?') ? route.split('?')[1] : '';
    const params = new URLSearchParams(queryStr);
    return (
      <KycTax
        onRoute={onRoute}
        initialAction={(params.get('action') as never) ?? undefined}
      />
    );
  }

  // Persona-aware fallback for unknown routes. Pre-fix this always
  // returned BrandHome, so a creator persona with a stale localStorage
  // route (e.g. left over from a previous tab on a different surface)
  // would boot into Hannah-shaped chrome that doesn't belong to them.
  // Now we return the persona's home so the fall-through is at least
  // coherent for whoever's logged in.
  return persona === 'creator'
    ? <CreatorHome onRoute={onRoute} />
    : <BrandHome onRoute={onRoute} />;
}

// =====================================================================
// Sidebar
// =====================================================================
interface SidebarProps {
  persona: Persona;
  route: string;
  onRoute: (r: string) => void;
  /** Phase 54 mobile drawer — when true, the sidebar slides in from
   *  the left edge on viewports ≤880px. Direct class on the sidebar
   *  (rather than a shell-level class with a descendant selector)
   *  avoids a cascade specificity issue where the open→closed
   *  transform reset wasn't winning reliably. */
  isMobileOpen: boolean;
}
function Sidebar({ persona, route, onRoute, isMobileOpen }: SidebarProps) {
  const navigate = useNavigate();
  const routes = persona === 'brand' ? BRAND_ROUTES : CREATOR_ROUTES;
  const brand = useV2CurrentBrand();
  const creator = useV2CurrentCreator();
  const managedCreators = useV2ManagedCreators();
  // Live unread badge on the Inbox nav row. Pre-fix the brand sidebar
  // always read "3" and the creator sidebar always read "2" because the
  // count came from a literal in BRAND_ROUTES/CREATOR_ROUTES. The Inbox
  // surface's own topbar crumb showed the real number — so the same
  // screen disagreed with itself. `useV2Conversations` already returns
  // per-conversation unread counts for the current viewer; we sum them.
  const conversations = useV2Conversations();
  const inboxUnread = conversations.reduce((sum, c) => sum + (c.unread ?? 0), 0);
  // The "viewer" identity in the sidebar foot reflects the active persona —
  // not necessarily the auth role. A brand user previewing the creator side
  // sees the creator's chrome; the actual auth identity is unchanged.
  const me = persona === 'creator' && creator
    ? {
        name: creator.name,
        // Creator.handle already includes the leading "@"; don't double it.
        sub: `${creator.handle.startsWith('@') ? '' : '@'}${creator.handle}${creator.verified ? ' · Verified' : ''}`,
        avatar: creator.portrait,
      }
    : brand
      ? {
          name: brand.name,
          sub: `${brand.industry}${brand.verified ? ' · Verified' : ''}`,
          // P65 — pre-fix this called dicebear.com (an external service)
          // for the brand sidebar avatar, even when the brand had uploaded
          // a real logo. Use the actual uploaded logoUrl if present; the
          // sidebar's Avatar render falls back to the brand's initial.
          avatar: brand.logoUrl ?? '',
        }
      : { name: 'Welcome', sub: 'Loading...', avatar: '' };

  const handleSignOut = async () => {
    try { await api.auth.signOut(); } catch { /* ignore */ }
    navigate('/');
  };

  return (
    <aside
      id="v2-sidebar"
      className={['v2-sidebar', isMobileOpen ? 'is-open' : ''].filter(Boolean).join(' ')}
    >
      <button className="v2-brand" type="button" aria-label="Alamut — go to your workspace" onClick={() => onRoute(persona === 'creator' ? 'creator-home' : 'home')}>
        <div className="v2-brand-mark" aria-hidden="true">
          <svg viewBox="0 0 32 32" width="20" height="20">
            <path d="M16 4 L28 26 L22 26 L16 14 L10 26 L4 26 Z" fill="var(--v2-paper)" />
            <circle cx="16" cy="22" r="2" fill="var(--v2-accent)" />
          </svg>
        </div>
        <div className="v2-brand-name">Alamut</div>
      </button>

      <nav className="v2-nav" aria-label="Primary">
        {routes.map((r) => {
          // Inbox count is the only live badge today — computed from
          // store state (see comment at the top of the component). If
          // future nav rows ever need badges, add them here.
          const liveCount = (r.id === 'inbox' || r.id === 'creator-inbox')
            ? (inboxUnread > 0 ? inboxUnread : undefined)
            : undefined;
          return (
            <button
              key={r.id}
              type="button"
              className={`v2-nav-item ${route === r.id ? 'is-active' : ''}`}
              onClick={() => onRoute(r.id)}
            >
              <span className="v2-nav-icon">{r.icon}</span>
              <span className="v2-nav-label">{r.label}</span>
              {'badge' in r && r.badge && <span className="v2-nav-badge">{r.badge}</span>}
              {liveCount != null && <span className="v2-nav-count">{liveCount}</span>}
            </button>
          );
        })}
      </nav>

      {/* Manager / agency switcher. Without it `useV2CurrentCreator` silently
          resolved to the FIRST managed creator, so an agency with two clients
          saw one client's earnings, deals and payouts under whichever name
          they thought they were viewing. Only renders when there is genuinely
          more than one, so an ordinary creator never sees it. */}
      {persona === 'creator' && managedCreators.length > 1 && (
        <div style={{ padding: '10px 14px', borderTop: '1px solid var(--v2-line)' }}>
          <label
            className="v2-eyebrow"
            htmlFor="v2-acting-for"
            style={{ display: 'block', marginBottom: 6, fontSize: 10 }}
          >
            Acting for
          </label>
          <select
            id="v2-acting-for"
            className="v2-input"
            style={{ width: '100%', fontSize: 12.5 }}
            value={creator?.id ?? ''}
            onChange={(e) => {
              if (v2SetActingForCreator(e.target.value)) {
                // Full reload: every creator-side hook resolves the acting
                // creator at read time, and a stale render showing one
                // client's money under another's name is the bug being fixed.
                window.location.reload();
              }
            }}
          >
            {managedCreators.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      )}

      <div className="v2-sidebar-foot">
        {/* P65 — Avatar handles missing/broken images by falling back
            to a colored initial circle. Pre-fix the brand sidebar avatar
            called dicebear.com on every render. */}
        <Avatar src={me.avatar} name={me.name} size={40} />
        <div className="v2-sidebar-foot-info">
          <div className="v2-sidebar-foot-name">{me.name}</div>
          <div className="v2-sidebar-foot-sub">{me.sub}</div>
        </div>
        <button
          className="v2-icon-btn"
          type="button"
          aria-label="Sign out"
          title="Sign out"
          onClick={handleSignOut}
        >
          {Icon.logout}
        </button>
      </div>
    </aside>
  );
}
