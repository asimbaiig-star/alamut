import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { installErrorHandlers } from './lib/utils/errorReporting';

import './styles/tokens.css';
import './styles/base.css';
import './styles/components.css';
import './styles/layout.css';
import './styles/landing.css';
import './styles/screens.css';
import './styles/responsive.css';
import './styles/print.css';

// Capture unhandled errors + promise rejections before anything else
// runs, so a failure during boot is still recorded. See
// lib/utils/errorReporting.ts for the two reporting seams.
installErrorHandlers();

// Stale-chunk recovery — when Vercel deploys new build hashes while a
// user has an old tab open, code-split imports start 404ing ("Unable
// to preload CSS for /assets/X-<old-hash>.css"). Vite emits a
// `vite:preloadError` for exactly this case. Auto-reload once so the
// user picks up the fresh index.js with the correct chunk hashes.
//
// Reload-loop guard: stash a marker on sessionStorage with the failing
// chunk url. If the same url fails again after reload, the issue isn't
// stale chunks — it's a genuine 404. Fall through and let the error
// surface so we don't ping-pong infinitely.
if (typeof window !== 'undefined') {
  window.addEventListener('vite:preloadError', (event) => {
    const failingUrl =
      (event as Event & { payload?: { url?: string } }).payload?.url ?? 'unknown';
    const marker = 'alamut.preload-reload';
    const lastFailed = sessionStorage.getItem(marker);
    if (lastFailed === failingUrl) {
      // Already reloaded once for this exact url — let the error
      // bubble so the user sees something rather than a silent loop.
      // eslint-disable-next-line no-console
      console.error('[preloadError] still failing after reload:', failingUrl);
      return;
    }
    sessionStorage.setItem(marker, failingUrl);
    event.preventDefault();
    window.location.reload();
  });
}

// Sync the local session with Supabase auth at boot + on every auth
// state change. Without this, a stale localStorage entry from a prior
// test run lets the app act as if someone is signed in indefinitely.
void (async () => {
  try {
    const { mountSessionSync } = await import('./lib/auth/sessionSync');
    await mountSessionSync();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[main] sessionSync skipped:', err);
  }
})();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
