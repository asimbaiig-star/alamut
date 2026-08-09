// Phase 14 — route-level lazy loading.
//
// Strategy: keep eagerly imported only the screens needed for first paint
// in each role's default landing flow:
//   - Cover (the public root) and the auth screens
//   - Today screens (the new role default landing — Phase 4)
//   - AdminHome (admin default — Phase 8)
// Everything else loads on demand. This shrinks the initial JS to a
// fraction of what it was while keeping the first-render path eager so
// users don't see a flash of "Loading…" the moment they sign in.

import { lazy, Suspense } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { WorkspaceShell } from './components/layout/WorkspaceShell';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { RedirectToV2 } from './screens/workspace-v2/RedirectToV2';
// Phase 32: Cover lazy-loaded so the motion-library vendor chunk
// (~60 KB gzip) doesn't ship with the initial bundle. Signed-in
// users hitting any /<role>/today route bypass this entirely.
import { SignUp } from './screens/auth/SignUp';
import { SignIn } from './screens/auth/SignIn';
import { AcceptInvite } from './screens/auth/AcceptInvite';

// Eager: admin home stays loaded eagerly for fast first-paint when an
// admin user signs in. Admin portal migration is deferred to Phase H.
import { AdminHome } from './screens/admin/Home';

// Lazy: everything else still in use (admin queue, public storefront, onboarding).
const PublicCreator = lazy(() =>
  import('./screens/storefront/PublicCreator').then((m) => ({ default: m.PublicCreator })));

// §5.2 — legacy airy onboarding wizards retired. The v2 wizards
// (`CreatorOnboardingV2`, `BrandOnboardingV2`) are canonical; old URLs
// redirect through `RedirectToV2` so existing bookmarks / outbound
// signup links still land on the right wizard.

// Phase 28: AdminQueue / AdminVerify / AdminDisputes merged into one
// AdminQueueUnified surface. The individual queue screens still
// export their components (used as embedded children) so the
// unified page can render the right one per ?type= tab.
const AdminQueueUnified = lazy(() =>
  import('./screens/admin/AdminQueueUnified').then((m) => ({ default: m.AdminQueueUnified })));
const AdminPayouts = lazy(() =>
  import('./screens/admin/Payouts').then((m) => ({ default: m.AdminPayouts })));
const AdminAudit = lazy(() =>
  import('./screens/admin/Audit').then((m) => ({ default: m.AdminAudit })));

// Phase 32 — public landing page lazy-loaded so the motion animation
// library (~60 KB gzip) ships only when someone actually hits /,
// not on every initial app load.
const Cover = lazy(() =>
  import('./screens/cover/Cover').then((m) => ({ default: m.Cover })));
// Phase 52b — brand-facing landing page (separate URL from creator
// landing for focused narrative, ROI-forward tone, comparison matrix).
const BrandLanding = lazy(() =>
  import('./screens/cover/BrandLanding').then((m) => ({ default: m.BrandLanding })));
// Phase 52d — engagement-rate / sponsorship-rate calculator tools.
// SEO-bait public pages that double as utility — a creator pastes
// their handle (or follower count + engagement %) and gets a fair
// rate range. Routes through `useParams` for the platform.
const RateCalculator = lazy(() =>
  import('./screens/tools/RateCalculator').then((m) => ({ default: m.RateCalculator })));
// Phase 52e — public Top Creators directory.
const CreatorsDirectory = lazy(() =>
  import('./screens/tools/CreatorsDirectory').then((m) => ({ default: m.CreatorsDirectory })));
// Phase A (launch-readiness) — Terms + Privacy. Real pages behind the
// signup agreement checkbox; also linked from the Cover footer.
const TermsPage = lazy(() =>
  import('./screens/legal/LegalPage').then((m) => ({ default: m.TermsPage })));
const PrivacyPage = lazy(() =>
  import('./screens/legal/LegalPage').then((m) => ({ default: m.PrivacyPage })));

// Phase 57 — workspace v2 (Pakistan-first revamp from the Claude Design
// handoff). Mounted as a parallel preview surface at /v2 so the
// existing portal stays intact during the migration. Owns its own
// shell — no WorkspaceShell wrapper, no auth gate (yet) so the
// design can be previewed without disrupting the real system.
const WorkspaceV2 = lazy(() =>
  import('./screens/workspace-v2/Workspace').then((m) => ({ default: m.WorkspaceV2 })));

// Tiny lazy fallback — a soft skeleton that fades in if the chunk takes
// >120ms. Keeps the workspace from flashing visibly when navigating fast.
function RouteFallback() {
  return (
    <div className="page page-loading" aria-busy="true" aria-label="Loading">
      <div className="route-skeleton" />
    </div>
  );
}

// Wrapper that attaches the Suspense boundary at the route element level
// so each lazy screen gets its own fallback (rather than one tree-wide).
function lazyRoute(El: React.ComponentType) {
  return (
    <Suspense fallback={<RouteFallback />}>
      <El />
    </Suspense>
  );
}

export const router = createBrowserRouter([
  { path: '/', element: lazyRoute(Cover) },
  // Phase 52b — brand-facing landing on its own URL.
  { path: '/for-brands', element: lazyRoute(BrandLanding) },
  // Phase 52d — calculator tools. Single component, platform passed
  // via path param so we get clean SEO URLs for each.
  { path: '/tools/:platform-calculator', element: lazyRoute(RateCalculator) },
  { path: '/tools/tiktok-calculator', element: lazyRoute(RateCalculator) },
  { path: '/tools/instagram-calculator', element: lazyRoute(RateCalculator) },
  { path: '/tools/youtube-calculator', element: lazyRoute(RateCalculator) },
  // Phase 52e — public Top Creators directory.
  { path: '/creators', element: lazyRoute(CreatorsDirectory) },
  { path: '/signup', element: <SignUp /> },
  { path: '/signin', element: <SignIn /> },
  { path: '/terms', element: lazyRoute(TermsPage) },
  { path: '/privacy', element: lazyRoute(PrivacyPage) },
  { path: '/accept-invite', element: <AcceptInvite /> },
  { path: '/c/:handle', element: lazyRoute(PublicCreator) },
  // Phase B+C — workspace v2. Owns its own shell + sidebar; no
  // WorkspaceShell wrapper. Phase C added auth gating: both brand and
  // creator roles can access (the sidebar persona toggle lets them
  // switch view modes). Admin gets bounced to /admin/home.
  {
    element: <ProtectedRoute allow={['brand', 'creator']} />,
    children: [
      { path: '/v2', element: lazyRoute(WorkspaceV2) },
      { path: '/v2/*', element: lazyRoute(WorkspaceV2) },
    ],
  },

  // §5.2 — onboarding wizard URLs redirect to the v2 wizards. The
  // legacy airy files have been deleted; new sign-ups already land on
  // /v2 with the right v2 internal route. ProtectedRoute keeps the
  // role gate in place so a creator can't redirect into the brand
  // wizard (they'd be bounced off /v2 anyway, but we fail-fast here).
  {
    element: <ProtectedRoute allow={['creator']} />,
    children: [
      { path: '/onboarding/creator', element: <RedirectToV2 to="onboarding-creator" /> },
    ],
  },
  {
    element: <ProtectedRoute allow={['brand']} />,
    children: [
      { path: '/onboarding/brand', element: <RedirectToV2 to="onboarding-brand" /> },
    ],
  },

  // Phase F · cutover. Old `/creator/*` and `/brand/*` URLs redirect
  // into `/v2`, each carrying the desired internal v2 route via
  // localStorage so WorkspaceV2 lands on the right tab. The old screen
  // modules were deleted in Phase G; keeping the redirects here so
  // legacy bookmarks / outbound links don't 404. ProtectedRoute stays
  // wrapped so wrong-role users still bounce before redirect.
  {
    element: <ProtectedRoute allow={['creator', 'brand']} />,
    children: [
      { path: '/creator', element: <RedirectToV2 to="creator-home" /> },
      { path: '/creator/today',         element: <RedirectToV2 to="creator-home" /> },
      { path: '/creator/home',          element: <RedirectToV2 to="creator-home" /> },
      { path: '/creator/discover',      element: <RedirectToV2 to="creator-campaigns" /> },
      { path: '/creator/campaigns',     element: <RedirectToV2 to="creator-campaigns" /> },
      { path: '/creator/campaigns/:id', element: <RedirectToV2 to="creator-campaigns" /> },
      { path: '/creator/content',       element: <RedirectToV2 to="storefront" /> },
      { path: '/creator/inbox',         element: <RedirectToV2 to="creator-inbox" /> },
      { path: '/creator/earnings',      element: <RedirectToV2 to="creator-wallet" /> },
      { path: '/creator/analytics',     element: <RedirectToV2 to="analytics" /> },
      { path: '/creator/profile',       element: <RedirectToV2 to="storefront" /> },

      { path: '/brand', element: <RedirectToV2 to="home" /> },
      { path: '/brand/today',         element: <RedirectToV2 to="home" /> },
      { path: '/brand/home',          element: <RedirectToV2 to="home" /> },
      { path: '/brand/campaigns',     element: <RedirectToV2 to="campaigns" /> },
      { path: '/brand/campaigns/:id', element: <RedirectToV2 to="campaigns" /> },
      { path: '/brand/discover',      element: <RedirectToV2 to="discover" /> },
      { path: '/brand/approvals',     element: <RedirectToV2 to="home" /> },
      { path: '/brand/inbox',         element: <RedirectToV2 to="inbox" /> },
      { path: '/brand/wallet',        element: <RedirectToV2 to="wallet" /> },
      { path: '/brand/analytics',     element: <RedirectToV2 to="home" /> },
      { path: '/brand/profile',       element: <RedirectToV2 to="home" /> },
    ],
  },

  {
    element: <ProtectedRoute allow={['admin']} />,
    children: [{
      element: <WorkspaceShell />,
      children: [
        { path: '/admin', element: <Navigate to="/admin/home" replace /> },
        { path: '/admin/home',      element: <AdminHome /> },
        // Phase 28: unified admin queue. Old paths redirect to the
        // unified page with the right ?type= tab.
        { path: '/admin/queue',     element: lazyRoute(AdminQueueUnified) },
        { path: '/admin/verify',    element: <Navigate to="/admin/queue?type=brands" replace /> },
        { path: '/admin/disputes',  element: <Navigate to="/admin/queue?type=disputes" replace /> },
        { path: '/admin/payouts',   element: lazyRoute(AdminPayouts) },
        { path: '/admin/audit',     element: lazyRoute(AdminAudit) },
      ],
    }],
  },

  // Phase F cutover · `/deal/:dealId` redirects to v2 then resolves
  // to the conversation id (`deal:<convId>` contract). Post §2.5
  // collapse, that route is handled by Inbox with `forceThreadId` +
  // `forcePanelMode='detailed'` — the standalone DealRoom surface is
  // gone but the URL contract is preserved indefinitely so old links
  // still work. RedirectToV2 looks up the matching brand×creator
  // thread on the campaign; falls back to the inbox if no thread.
  {
    element: <ProtectedRoute allow={['creator', 'brand']} />,
    children: [
      { path: '/deal/:dealId', element: <RedirectToV2 resolveDeal /> },
    ],
  },

  { path: '*', element: <Navigate to="/" replace /> },
]);
