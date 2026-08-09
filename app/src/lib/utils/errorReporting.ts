// errorReporting.ts — capture what breaks in production (audit F: no
// observability).
//
// Before this, the app had none: a render crash showed the ErrorBoundary
// panel and logged to a console nobody was watching, and an unhandled
// promise rejection (the more common failure mode here — every `void
// (async () => …)` mirror write is one) vanished entirely. The first real
// user hitting a real bug was invisible.
//
// NO NEW DEPENDENCY ON PURPOSE. A hosted error service is the right
// long-term answer, but installing an SDK for an account that doesn't
// exist yet buys nothing. Instead this module does the part that has to
// live in the app either way — capture, structure, de-duplicate — and
// exposes two seams:
//
//   1. `window.__alamutErrors` — the last 25 errors, always available.
//      When a beta user reports "it broke", you can ask them to run
//      `copy(JSON.stringify(window.__alamutErrors))` in the console and
//      get real stacks instead of "it didn't work".
//   2. `VITE_ERROR_WEBHOOK` — when set, each error is POSTed as JSON.
//      Deliberately transport-agnostic: point it at a Supabase Edge
//      Function, a Slack incoming webhook, or any collector. Swapping in
//      Sentry later means adding its SDK inside `deliver()` and nothing
//      else changes.

export interface CapturedError {
  at: string;
  kind: 'render' | 'window-error' | 'unhandled-rejection';
  message: string;
  stack?: string;
  /** Where the user was when it happened — a stack alone rarely says. */
  route: string;
  componentStack?: string;
}

const BUFFER_LIMIT = 25;
const buffer: CapturedError[] = [];

/** Recent messages, to avoid spamming the webhook when a broken render
 *  loop throws the same error dozens of times per second. */
const recentlySeen = new Map<string, number>();
const DEDUPE_WINDOW_MS = 10_000;

const webhook = import.meta.env.VITE_ERROR_WEBHOOK as string | undefined;

function deliver(entry: CapturedError): void {
  if (!webhook) return;
  try {
    // `keepalive` so the request still goes out if the error is fatal and
    // the page is about to unload.
    void fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry),
      keepalive: true,
    }).catch(() => { /* reporting must never throw */ });
  } catch { /* ditto */ }
}

/** Record an error. Safe to call from anywhere; never throws. */
export function reportError(
  error: unknown,
  meta: { kind?: CapturedError['kind']; componentStack?: string } = {},
): void {
  try {
    const err = error instanceof Error ? error : new Error(String(error));
    const entry: CapturedError = {
      at: new Date().toISOString(),
      kind: meta.kind ?? 'window-error',
      message: err.message,
      stack: err.stack,
      route: typeof location !== 'undefined' ? location.pathname + location.search : '',
      ...(meta.componentStack ? { componentStack: meta.componentStack } : {}),
    };

    buffer.push(entry);
    if (buffer.length > BUFFER_LIMIT) buffer.shift();

    // eslint-disable-next-line no-console
    console.error(`[alamut:${entry.kind}]`, err.message, err);

    const now = Date.now();
    const key = `${entry.kind}:${entry.message}`;
    const last = recentlySeen.get(key);
    if (last && now - last < DEDUPE_WINDOW_MS) return;
    recentlySeen.set(key, now);
    deliver(entry);
  } catch { /* reporting must never break the app */ }
}

let installed = false;

/** Attach global handlers. Call once, as early as possible in boot. */
export function installErrorHandlers(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;

  window.addEventListener('error', (event) => {
    // Resource load failures (img/script 404s) also fire 'error' but have
    // no `error` object — those are noise here, and the vite:preloadError
    // handler in main.tsx already covers the chunk case.
    if (!event.error) return;
    reportError(event.error, { kind: 'window-error' });
  });

  window.addEventListener('unhandledrejection', (event) => {
    reportError(event.reason, { kind: 'unhandled-rejection' });
  });

  // Debug seam — see the module header.
  try {
    Object.defineProperty(window, '__alamutErrors', {
      get: () => buffer.slice(),
      configurable: true,
    });
  } catch { /* non-fatal */ }
}
