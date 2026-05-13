// supabase/functions/oauth-callback/index.ts
//
// OAuth code-exchange Edge Function. Deno runtime (Supabase Edge).
//
// Why this exists as an Edge Function instead of client-side: every
// platform requires a `client_secret` in the code-exchange step, and a
// secret in the browser is not a secret. So the redirect URI points
// here, this function does the secret-using POST to the platform's
// token endpoint, then stores the resulting tokens in the
// `platform_tokens` table using the service_role key (which bypasses
// RLS — necessary because RLS blocks INSERT from any non-service role).
//
// Per-platform setup is in README.md (next to this file). Tl;dr:
//   1. Register an app on each platform's dev portal
//   2. Set the redirect URI to <your-project>.supabase.co/functions/v1/oauth-callback
//   3. Add CLIENT_ID + CLIENT_SECRET as Edge Function secrets:
//      `supabase secrets set INSTAGRAM_CLIENT_ID=... INSTAGRAM_CLIENT_SECRET=...`
//   4. Deploy: `supabase functions deploy oauth-callback`
//
// Flow:
//   1. Client opens popup → platform's authorize URL with state param
//   2. User grants → platform redirects back to this function with code
//   3. We POST {code, client_id, client_secret} to platform's token endpoint
//   4. We INSERT/UPSERT into platform_tokens
//   5. Return an HTML page that postMessage's success to opener window
//
// All four real platforms (Instagram / TikTok / YouTube / X) and one
// stub (newsletter) are sketched. The exact endpoints + token-response
// shape will need verification against each dev portal's current docs.

// deno-lint-ignore-file no-explicit-any
// @ts-ignore — Deno runtime, not Node.
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

type Platform = 'instagram' | 'tiktok' | 'youtube' | 'x' | 'newsletter';

interface TokenExchangeResult {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;        // seconds
  scope?: string;
  external_account_id: string; // platform's user/channel id
}

interface PlatformConfig {
  tokenUrl: string;
  exchange: (code: string, redirectUri: string) => Promise<TokenExchangeResult>;
}

// =====================================================================
// Per-platform code exchanges
// =====================================================================
// Each function fetches the platform's token endpoint with the right
// body shape. The exact param names + token response keys differ per
// platform — these are based on current public docs at the time of
// writing. Verify against each platform's developer portal before
// going live; OAuth specs drift.

// @ts-ignore
const env = (k: string) => Deno.env.get(k) ?? '';

const PLATFORMS: Record<Platform, PlatformConfig> = {
  instagram: {
    tokenUrl: 'https://api.instagram.com/oauth/access_token',
    exchange: async (code, redirectUri) => {
      const body = new URLSearchParams({
        client_id: env('INSTAGRAM_CLIENT_ID'),
        client_secret: env('INSTAGRAM_CLIENT_SECRET'),
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
        code,
      });
      const res = await fetch('https://api.instagram.com/oauth/access_token', {
        method: 'POST',
        body,
      });
      if (!res.ok) throw new Error(`instagram token exchange ${res.status}: ${await res.text()}`);
      const data = await res.json();
      return {
        access_token: data.access_token,
        external_account_id: String(data.user_id),
        scope: data.scope,
      };
    },
  },

  tiktok: {
    tokenUrl: 'https://open.tiktokapis.com/v2/oauth/token/',
    exchange: async (code, redirectUri) => {
      const body = new URLSearchParams({
        client_key: env('TIKTOK_CLIENT_KEY'),
        client_secret: env('TIKTOK_CLIENT_SECRET'),
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
        code,
      });
      const res = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      });
      if (!res.ok) throw new Error(`tiktok token exchange ${res.status}: ${await res.text()}`);
      const data = await res.json();
      return {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_in: data.expires_in,
        scope: data.scope,
        external_account_id: data.open_id,
      };
    },
  },

  youtube: {
    tokenUrl: 'https://oauth2.googleapis.com/token',
    exchange: async (code, redirectUri) => {
      const body = new URLSearchParams({
        client_id: env('YOUTUBE_CLIENT_ID'),
        client_secret: env('YOUTUBE_CLIENT_SECRET'),
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
        code,
      });
      const res = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      });
      if (!res.ok) throw new Error(`youtube token exchange ${res.status}: ${await res.text()}`);
      const data = await res.json();
      // YouTube requires a second call to identify the channel — see
      // https://developers.google.com/youtube/v3/docs/channels/list
      const channelRes = await fetch(
        'https://www.googleapis.com/youtube/v3/channels?part=id&mine=true',
        { headers: { Authorization: `Bearer ${data.access_token}` } },
      );
      const channelData = await channelRes.json();
      const externalAccountId = channelData.items?.[0]?.id ?? 'unknown';
      return {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_in: data.expires_in,
        scope: data.scope,
        external_account_id: externalAccountId,
      };
    },
  },

  x: {
    tokenUrl: 'https://api.x.com/2/oauth2/token',
    exchange: async (code, redirectUri) => {
      const body = new URLSearchParams({
        client_id: env('X_CLIENT_ID'),
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
        code,
        // X uses PKCE — the code_verifier should come back via state.
        // Stubbed here; the client helper needs to round-trip it.
        code_verifier: env('X_CODE_VERIFIER_PLACEHOLDER'),
      });
      const basic = btoa(`${env('X_CLIENT_ID')}:${env('X_CLIENT_SECRET')}`);
      const res = await fetch('https://api.x.com/2/oauth2/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${basic}`,
        },
        body,
      });
      if (!res.ok) throw new Error(`x token exchange ${res.status}: ${await res.text()}`);
      const data = await res.json();
      return {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_in: data.expires_in,
        scope: data.scope,
        external_account_id: 'pending-userinfo-call',
      };
    },
  },

  // Newsletter / Substack — Substack does not currently have a public
  // OAuth API. Workaround: ask the creator to paste their RSS feed URL
  // and we verify ownership via a DNS TXT record or a temporary token
  // in the feed bio. Stub for now.
  newsletter: {
    tokenUrl: '',
    exchange: async () => {
      throw new Error('newsletter platform has no OAuth flow — use manual verification');
    },
  },
};

// =====================================================================
// Handler
// =====================================================================

serve(async (req: Request) => {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const stateRaw = url.searchParams.get('state');
  const errorParam = url.searchParams.get('error');

  if (errorParam) {
    return htmlResponse(failureScript(`Authorization denied: ${errorParam}`));
  }
  if (!code || !stateRaw) {
    return htmlResponse(failureScript('Missing code or state parameter.'));
  }

  // The client embeds {platform, creatorId, ownerEmail, nonce} in `state`
  // (signed or just encoded) so the callback knows who's connecting what.
  let state: { platform: Platform; creatorId: string; ownerEmail: string };
  try {
    state = JSON.parse(atob(stateRaw));
  } catch {
    return htmlResponse(failureScript('Invalid state parameter.'));
  }

  const cfg = PLATFORMS[state.platform];
  if (!cfg) {
    return htmlResponse(failureScript(`Unsupported platform: ${state.platform}`));
  }

  try {
    const redirectUri = `${url.origin}${url.pathname}`;
    const tokens = await cfg.exchange(code, redirectUri);
    const expiresAt = tokens.expires_in
      ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
      : null;

    const sb = createClient(
      env('SUPABASE_URL'),
      env('SUPABASE_SERVICE_ROLE_KEY'),
      { auth: { persistSession: false } },
    );

    const { error } = await sb
      .from('platform_tokens')
      .upsert(
        {
          creator_id: state.creatorId,
          owner_email: state.ownerEmail,
          platform: state.platform,
          external_account_id: tokens.external_account_id,
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token ?? null,
          expires_at: expiresAt,
          scope: tokens.scope ?? null,
        },
        { onConflict: 'creator_id,platform' },
      );
    if (error) throw error;

    return htmlResponse(successScript(state.platform));
  } catch (err) {
    return htmlResponse(failureScript(err instanceof Error ? err.message : String(err)));
  }
});

// =====================================================================
// Response helpers
// =====================================================================

function htmlResponse(body: string) {
  return new Response(body, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

function successScript(platform: string) {
  return `<!doctype html><html><head><title>Connected</title></head><body>
<script>
  window.opener?.postMessage({ type: 'alamut-oauth', ok: true, platform: ${JSON.stringify(platform)} }, '*');
  window.close();
</script>
<p>Connected. You can close this window.</p>
</body></html>`;
}

function failureScript(message: string) {
  return `<!doctype html><html><head><title>OAuth failed</title></head><body>
<script>
  window.opener?.postMessage({ type: 'alamut-oauth', ok: false, error: ${JSON.stringify(message)} }, '*');
</script>
<p>OAuth failed: ${escapeHtml(message)}. You can close this window.</p>
</body></html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
