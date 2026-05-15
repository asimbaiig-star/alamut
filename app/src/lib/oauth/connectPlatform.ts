// connectPlatform.ts — client-side OAuth popup helper
//
// Counterpart to the `oauth-callback` Edge Function. The flow:
//   1. Caller (ConnectPlatformModal) invokes `connectPlatform(...)`.
//   2. We open a popup window pointed at the platform's authorize URL.
//      `state` carries a base64-encoded {platform, creatorId, ownerEmail}
//      so the callback knows whose token row to write.
//   3. The popup completes (user grants permission, platform redirects
//      to the Edge Function, function exchanges code for tokens and
//      stores them, then posts a success message back to opener).
//   4. We listen for `postMessage` on `window` with `type ===
//      'alamut-oauth'` and resolve / reject the returned Promise.
//
// SECURITY NOTE: This file is currently scaffolding. The actual
// authorize URLs reference env vars that aren't wired in (VITE_*).
// Wire them through Vite, register apps on each dev portal, deploy
// the Edge Function — then this becomes a real OAuth flow.
//
// Until then, ConnectPlatformModal should keep falling back to the
// mock `v2VerifyChannel` path.

export type OAuthPlatform = 'instagram' | 'tiktok' | 'youtube' | 'x';

interface ConnectArgs {
  platform: OAuthPlatform;
  creatorId: string;
  ownerEmail: string;
}

interface AuthEndpoint {
  url: string;
  scope: string;
  extra?: Record<string, string>;
}

/** Per-platform authorize endpoint. Filled-in stubs — the actual
 *  client_id values come from import.meta.env at call time. */
function endpointFor(platform: OAuthPlatform, clientId: string): AuthEndpoint {
  switch (platform) {
    case 'instagram':
      return {
        url: 'https://api.instagram.com/oauth/authorize',
        scope: 'user_profile',
      };
    case 'tiktok':
      return {
        url: 'https://www.tiktok.com/v2/auth/authorize',
        scope: 'user.info.basic',
        // TikTok uses client_key not client_id in URL params.
        extra: { client_key: clientId },
      };
    case 'youtube':
      return {
        url: 'https://accounts.google.com/o/oauth2/v2/auth',
        scope: 'https://www.googleapis.com/auth/youtube.readonly',
        extra: { access_type: 'offline', include_granted_scopes: 'true' },
      };
    case 'x':
      return {
        url: 'https://x.com/i/oauth2/authorize',
        scope: 'users.read tweet.read',
        // Real impl needs PKCE — generate code_verifier here, store
        // it, derive code_challenge, and round-trip the verifier
        // through the callback. Stubbed for the scaffold.
      };
  }
}

function clientIdFor(platform: OAuthPlatform): string | undefined {
  const env = (key: string) =>
    (import.meta as unknown as { env?: Record<string, string> }).env?.[key];
  switch (platform) {
    case 'instagram': return env('VITE_INSTAGRAM_CLIENT_ID');
    case 'tiktok':    return env('VITE_TIKTOK_CLIENT_KEY');
    case 'youtube':   return env('VITE_YOUTUBE_CLIENT_ID');
    case 'x':         return env('VITE_X_CLIENT_ID');
  }
}

function callbackUri(): string {
  const env = (key: string) =>
    (import.meta as unknown as { env?: Record<string, string> }).env?.[key];
  const base = env('VITE_SUPABASE_URL') ?? '';
  return `${base}/functions/v1/oauth-callback`;
}

export class OAuthNotConfiguredError extends Error {
  constructor(platform: OAuthPlatform) {
    super(`OAuth client id is not configured for ${platform}. Set VITE_${platform.toUpperCase()}_CLIENT_ID and register the app on the platform's dev portal.`);
    this.name = 'OAuthNotConfiguredError';
  }
}

/**
 * Open the OAuth popup and resolve when the callback Edge Function
 * posts a success message. Rejects with OAuthNotConfiguredError if
 * the platform's client id isn't set in env, or with a plain Error
 * on user denial / network failure / popup close.
 *
 * The caller is expected to be a click handler — popups opened
 * outside a user gesture are blocked by every browser.
 */
export function connectPlatform(args: ConnectArgs): Promise<{ ok: true; platform: OAuthPlatform }> {
  return new Promise((resolve, reject) => {
    const clientId = clientIdFor(args.platform);
    if (!clientId) {
      reject(new OAuthNotConfiguredError(args.platform));
      return;
    }

    const ep = endpointFor(args.platform, clientId);
    const state = btoa(JSON.stringify({
      platform: args.platform,
      creatorId: args.creatorId,
      ownerEmail: args.ownerEmail,
      nonce: Math.random().toString(36).slice(2),
    }));

    const params = new URLSearchParams({
      ...(ep.extra ?? { client_id: clientId }),
      redirect_uri: callbackUri(),
      response_type: 'code',
      scope: ep.scope,
      state,
    });

    const popup = window.open(
      `${ep.url}?${params.toString()}`,
      'alamut-oauth',
      'width=600,height=700',
    );
    if (!popup) {
      reject(new Error('Popup blocked. Allow popups for this site to connect a platform.'));
      return;
    }

    // Phase 52 (security) — derive the expected origin of the OAuth
    // callback (the Supabase Edge Function URL) and reject any
    // postMessage from anywhere else. Pre-fix the handler accepted
    // `data.type === 'alamut-oauth'` from any origin — an attacker
    // could open the popup themselves, postMessage the parent with
    // `{ type: 'alamut-oauth', ok: true, platform: '...' }` and forge
    // a successful connect.
    let expectedOrigin: string | null = null;
    try {
      expectedOrigin = new URL(callbackUri()).origin;
    } catch {
      reject(new Error('OAuth callback URL is not a valid URL.'));
      return;
    }

    const onMessage = (e: MessageEvent) => {
      // Origin must match the Edge Function's host. Anything else is
      // either an unrelated browser message or a forgery attempt.
      if (e.origin !== expectedOrigin) return;
      const data = e.data;
      if (!data || data.type !== 'alamut-oauth') return;
      // Source check belt-and-suspenders — only trust messages coming
      // from the popup we opened, not arbitrary windows that happen to
      // share the origin (e.g. another tab).
      if (e.source !== popup) return;
      window.removeEventListener('message', onMessage);
      if (popupCheckTimer) window.clearInterval(popupCheckTimer);
      if (data.ok) {
        resolve({ ok: true, platform: data.platform });
      } else {
        reject(new Error(data.error ?? 'OAuth failed'));
      }
    };

    window.addEventListener('message', onMessage);

    // Detect user closing the popup without granting.
    const popupCheckTimer = window.setInterval(() => {
      if (popup.closed) {
        window.clearInterval(popupCheckTimer);
        window.removeEventListener('message', onMessage);
        reject(new Error('Popup closed before authorization completed.'));
      }
    }, 500);
  });
}
