// events.ts — landing conversion events (migration 040_landing_events).
//
// Two events: one view per page load, and one click per CTA, named by its
// `data-cta` id. Enough to answer "which page converts, and from which
// button" — the question the old pages were designed without.
//
// Sent straight to PostgREST with the publishable key, not through
// supabase-js, which would more than double the landing's JavaScript.
//
// Nothing is sent from a dev build or a local host, when Supabase isn't
// configured, or when the visitor has Do Not Track or Global Privacy
// Control on. No cookie, no storage: the visit id is made fresh each load,
// so it joins a view to its own clicks and to nothing else. The table
// refuses anything that isn't one of these shapes (see 040).

export type LandingPage = 'creators' | 'brands';

export interface LandingEvent {
  page: LandingPage;
  event: 'landing_view' | 'cta_click';
  cta: string | null;
  visit: string;
  viewport: 'mobile' | 'tablet' | 'desktop';
  referrer_host: string | null;
}

const LOCAL_HOST = /^(localhost|127\.0\.0\.1|\[::1\]|0\.0\.0\.0)$|\.(localhost|local|test)$/i;

export function eventsEnabled(o: {
  dev: boolean; host: string; url?: string; key?: string; dnt?: string | null; gpc?: boolean;
}): boolean {
  if (o.dev || LOCAL_HOST.test(o.host)) return false;
  if (!o.url || !o.key) return false;
  if (o.dnt === '1' || o.dnt === 'yes' || o.gpc === true) return false;
  return true;
}

export function viewportOf(width: number): LandingEvent['viewport'] {
  return width < 768 ? 'mobile' : width < 1024 ? 'tablet' : 'desktop';
}

/** The referring site's host and nothing else — a path or query can carry
 *  anything, an email included. Our own host isn't a referral. */
export function referrerHost(referrer: string, ownHost: string): string | null {
  try {
    const host = new URL(referrer).hostname.toLowerCase();
    return host && host !== ownHost.toLowerCase() && /^[a-z0-9.-]{1,253}$/.test(host) ? host : null;
  } catch {
    return null;
  }
}

/** 16 random base-36 characters (the table accepts 12–32 of [a-z0-9]). */
export function newVisitId(rand: (bytes: Uint8Array) => Uint8Array = (b) => crypto.getRandomValues(b)): string {
  return Array.from(rand(new Uint8Array(16)), (n) => (n % 36).toString(36)).join('');
}

export const CTA_ID = /^[a-z0-9-]{1,40}$/;

export function mountLandingEvents(page: LandingPage): void {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
  if (!eventsEnabled({
    dev: import.meta.env.DEV, host: window.location.hostname, url, key,
    dnt: nav.doNotTrack, gpc: nav.globalPrivacyControl,
  })) return;

  const base = {
    page,
    visit: newVisitId(),
    viewport: viewportOf(window.innerWidth),
    referrer_host: referrerHost(document.referrer, window.location.hostname),
  };
  const send = (row: LandingEvent) => {
    // keepalive: a CTA click navigates away at once, and the request must
    // outlive the page. Failures are dropped — counting never blocks a visitor.
    fetch(`${url}/rest/v1/landing_events`, {
      method: 'POST',
      keepalive: true,
      headers: { apikey: key!, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify(row),
    }).catch(() => {});
  };

  send({ ...base, event: 'landing_view', cta: null });
  document.addEventListener('click', (e) => {
    const el = e.target instanceof Element ? e.target.closest('[data-cta]') : null;
    const cta = el?.getAttribute('data-cta');
    if (cta && CTA_ID.test(cta)) send({ ...base, event: 'cta_click', cta });
  }, { capture: true });
}
