// Workspace.tsx — v2 shell entry point
//
// Mounted at /v2 in the router. Owns the persona state (brand vs.
// creator) and the internal route state. The whole v2 system lives
// under one URL today; we can promote nested URLs later when the
// surface is ready to be promoted out of preview.

import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '@/styles/workspace-v2.css';
import '@/styles/workspace-v2-campaign-mgmt.css';
import '@/styles/workspace-v2-home.css';
import { Icon } from './lib';
import { useV2CurrentBrand, useV2CurrentCreator } from './v2Hooks';
import { useAuth } from '@/lib/auth/useAuth';
import { api } from '@/lib/api/client';
import { BrandHome } from './screens/BrandHome';
import { CreatorHome } from './screens/CreatorHome';
import { Discover } from './screens/Discover';
import { Inbox } from './screens/Inbox';
import { BrandWallet } from './screens/BrandWallet';
import { BrandProfile } from './screens/BrandProfile';
import { BrandAnalytics } from './screens/BrandAnalytics';
import { CreatorWallet } from './screens/CreatorWallet';
import { BrowseBriefs } from './screens/BrowseBriefs';
import { Storefront } from './screens/Storefront';
import { Campaigns } from './screens/Campaigns';
import { CampaignDetail } from './screens/CampaignDetail';
import { NewCampaignWizard } from './screens/NewCampaignWizard';
import { MyCollabs } from './screens/MyCollabs';
import { BriefDetail } from './screens/BriefDetail';
import { CollabDetail } from './screens/CollabDetail';
import { CreatorProfile } from './screens/CreatorProfile';
import { KycTax } from './screens/KycTax';
import { Analytics } from './screens/Analytics';
import { PublicStorefront } from './screens/PublicStorefront';
// `DealRoom` retired on §2.5 — `deal:<convId>` now opens Inbox with
// the matching thread + detailed side panel via `forceThreadId`.
import { CreatorOnboardingV2 } from './screens/CreatorOnboardingV2';
import { BrandOnboardingV2 } from './screens/BrandOnboardingV2';
import { Spark } from './screens/Spark';

type Persona = 'brand' | 'creator';

// Brand-side routes (per design's BRAND_ROUTES)
const BRAND_ROUTES = [
  { id: 'home', label: 'Home', icon: Icon.home },
  { id: 'spark', label: 'Spark', icon: Icon.spark, badge: 'AI' },
  { id: 'discover', label: 'Discover', icon: Icon.search },
  { id: 'campaigns', label: 'My campaigns', icon: Icon.campaign },
  { id: 'inbox', label: 'Inbox', icon: Icon.inbox, count: 3 },
  { id: 'brand-analytics', label: 'Analytics', icon: Icon.chart },
  { id: 'wallet', label: 'Wallet', icon: Icon.wallet },
  { id: 'brand-profile', label: 'Brand profile', icon: Icon.shield },
] as const;

// Creator-side routes (per design's CREATOR_ROUTES)
const CREATOR_ROUTES = [
  { id: 'creator-home', label: 'Home', icon: Icon.home },
  { id: 'storefront', label: 'My storefront', icon: Icon.store },
  { id: 'creator-collabs', label: 'My collaborations', icon: Icon.campaign },
  { id: 'creator-campaigns', label: 'Campaigns', icon: Icon.search },
  { id: 'creator-inbox', label: 'Inbox', icon: Icon.inbox, count: 2 },
  { id: 'analytics', label: 'Analytics', icon: Icon.chart },
  { id: 'creator-wallet', label: 'Wallet', icon: Icon.wallet },
  { id: 'kyc', label: 'KYC & Tax', icon: Icon.shield },
] as const;

const PERSONA_KEY = 'alamut.v2.persona';
const ROUTE_KEY = 'alamut.v2.route';

/**
 * Reject creator-only routes for a brand persona (and vice versa) so a
 * stale localStorage value from a previous user's session doesn't leak
 * into a fresh sign-in. Shared routes (`inbox`, `wallet`, `home`) and
 * drilldown prefixes (which are valid for whichever side initiated them)
 * fall through to the brand-vs-creator check on each side. Returns
 * `true` for routes that fit either persona; `false` blocks the
 * Workspace from booting into a mismatched dashboard. */
export function routeFitsPersona(route: string, persona: Persona): boolean {
  // Drilldown prefixes — valid for the persona that originated them.
  if (route.startsWith('creator:') || route.startsWith('campaign:') || route.startsWith('deal:')) {
    return persona === 'brand';
  }
  if (route.startsWith('collab:') || route.startsWith('brief:')) {
    return persona === 'creator';
  }
  // Public storefront preview is cross-persona.
  if (route.startsWith('public:')) return true;
  // Creator-only top-level routes.
  const CREATOR_ONLY = new Set([
    'creator-home', 'storefront', 'creator-collabs', 'creator-campaigns',
    'creator-inbox', 'analytics', 'creator-wallet', 'kyc',
    'onboarding-creator',
  ]);
  if (CREATOR_ONLY.has(route)) return persona === 'creator';
  // Brand-only top-level routes.
  const BRAND_ONLY = new Set([
    'home', 'spark', 'discover', 'campaigns', 'inbox', 'wallet',
    'campaign-new', 'onboarding-brand', 'brand-profile', 'brand-analytics',
  ]);
  if (BRAND_ONLY.has(route)) return persona === 'brand';
  // Unknown routes — let through; RouteOutlet falls back to BrandHome.
  return true;
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

  // Persist
  useEffect(() => {
    try { localStorage.setItem(PERSONA_KEY, persona); } catch { /* no-op */ }
  }, [persona]);
  useEffect(() => {
    try { localStorage.setItem(ROUTE_KEY, route); } catch { /* no-op */ }
  }, [route]);

  function go(next: string) {
    setRouteState(next);
    // Auto-flip persona based on route prefix
    if (
      next.startsWith('creator-') ||
      next === 'storefront' ||
      next === 'kyc' ||
      next === 'analytics' ||
      next === 'onboarding-creator' ||
      next.startsWith('collab:') ||
      next.startsWith('brief:')
    ) {
      // collab:/brief: are creator-side drilldowns; creator-collabs uses
      // the creator- prefix above.
      setPersonaState('creator');
    } else if (
      BRAND_ROUTES.some((r) => r.id === next) ||
      next === 'discover' ||
      next === 'campaigns' ||
      next === 'campaign-new' ||
      next === 'onboarding-brand' ||
      next.startsWith('creator:') ||
      next.startsWith('campaign:') ||
      next.startsWith('deal:')
    ) {
      // creator:, campaign:, deal: prefixes are brand-side drilldowns
      setPersonaState('brand');
    }
    // public: routes don't flip persona — they're a read-only preview
    // accessible from either side.
    window.scrollTo(0, 0);
  }

  // Onboarding wizards render full-bleed without the workspace shell.
  // They manage their own data-surface wrapper internally.
  if (route === 'onboarding-creator') return <CreatorOnboardingV2 onRoute={go} />;
  if (route === 'onboarding-brand') return <BrandOnboardingV2 onRoute={go} />;

  return (
    <div data-surface="v2">
      <div className="v2-shell">
        <Sidebar persona={persona} route={route} onRoute={go} />
        <main className="v2-main">
          <RouteOutlet route={route} onRoute={go} persona={persona} />
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
    return (
      <CampaignDetail
        campaignId={campaignId}
        onRoute={onRoute}
        initialTab={(params.get('tab') as never) ?? undefined}
        initialReviewCollabId={params.get('review') ?? undefined}
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
  if (route === 'spark') return <Spark onRoute={onRoute} />;
  if (route === 'discover') return <Discover onRoute={onRoute} />;
  if (route === 'campaign-new') return <NewCampaignWizard onRoute={onRoute} />;
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

  // Creator
  if (route === 'creator-home') return <CreatorHome onRoute={onRoute} />;
  if (route === 'storefront') return <Storefront onRoute={onRoute} />;
  if (route === 'creator-collabs') return <MyCollabs onRoute={onRoute} />;
  if (route === 'creator-campaigns') return <BrowseBriefs onRoute={onRoute} />;
  if (route === 'creator-inbox') return <Inbox onRoute={onRoute} persona="creator" />;
  if (route === 'analytics') return <Analytics onRoute={onRoute} />;
  if (route === 'creator-wallet') return <CreatorWallet onRoute={onRoute} />;
  if (route === 'kyc') return <KycTax onRoute={onRoute} />;

  return <BrandHome onRoute={onRoute} />;
}

// =====================================================================
// Sidebar
// =====================================================================
interface SidebarProps {
  persona: Persona;
  route: string;
  onRoute: (r: string) => void;
}
function Sidebar({ persona, route, onRoute }: SidebarProps) {
  const navigate = useNavigate();
  const routes = persona === 'brand' ? BRAND_ROUTES : CREATOR_ROUTES;
  const brand = useV2CurrentBrand();
  const creator = useV2CurrentCreator();
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
          avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(brand.name)}&backgroundColor=c5552b`,
        }
      : { name: 'Welcome', sub: 'Loading...', avatar: '' };

  const handleSignOut = async () => {
    try { await api.auth.signOut(); } catch { /* ignore */ }
    navigate('/');
  };

  return (
    <aside className="v2-sidebar">
      <button className="v2-brand" type="button" onClick={() => onRoute(persona === 'creator' ? 'creator-home' : 'home')}>
        <div className="v2-brand-mark" aria-hidden="true">
          <svg viewBox="0 0 32 32" width="20" height="20">
            <path d="M16 4 L28 26 L22 26 L16 14 L10 26 L4 26 Z" fill="var(--v2-paper)" />
            <circle cx="16" cy="22" r="2" fill="var(--v2-accent)" />
          </svg>
        </div>
        <div className="v2-brand-name">Alamut</div>
      </button>

      <nav className="v2-nav" aria-label="Primary">
        {routes.map((r) => (
          <button
            key={r.id}
            type="button"
            className={`v2-nav-item ${route === r.id ? 'is-active' : ''}`}
            onClick={() => onRoute(r.id)}
          >
            <span className="v2-nav-icon">{r.icon}</span>
            <span className="v2-nav-label">{r.label}</span>
            {'badge' in r && r.badge && <span className="v2-nav-badge">{r.badge}</span>}
            {'count' in r && r.count != null && <span className="v2-nav-count">{r.count}</span>}
          </button>
        ))}
      </nav>

      <div className="v2-sidebar-foot">
        <div
          className="v2-avatar v2-avatar-md"
          style={{ backgroundImage: `url(${me.avatar})` }}
          aria-hidden="true"
        />
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
