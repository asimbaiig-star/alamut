# oauth-callback — per-platform setup

This Edge Function is the OAuth code-exchange endpoint. The client opens
a popup to each platform's authorize URL with `state` set to a base64-
encoded `{platform, creatorId, ownerEmail}`; the platform redirects
back here with `?code=...&state=...`; we exchange the code for tokens
and INSERT/UPSERT into `public.platform_tokens`.

## Common steps

1. Apply migration `024_platform_tokens.sql`.
2. Deploy the function: `supabase functions deploy oauth-callback`.
3. Your redirect URI is `https://<project>.supabase.co/functions/v1/oauth-callback`. **Register exactly this URL on every dev portal below.**
4. Set the supabase secrets per-platform (see below), then redeploy or restart the function.

## Instagram

1. https://developers.facebook.com → "Create app" → choose "Consumer" or "Business".
2. Add the "Instagram Basic Display" or "Instagram Graph API" product (Basic Display is fine for verification only; Graph requires app review).
3. Settings → Basic → copy **App ID** + **App Secret**.
4. Instagram Basic Display → Basic Display → "Add Instagram Testers" if app is in dev mode (or wait for App Review).
5. Add OAuth redirect URI from "Common steps" step 3.
6. `supabase secrets set INSTAGRAM_CLIENT_ID=... INSTAGRAM_CLIENT_SECRET=...`

Authorize URL the client opens:
```
https://api.instagram.com/oauth/authorize?client_id=<id>&redirect_uri=<uri>&scope=user_profile&response_type=code&state=<base64>
```

## TikTok

1. https://developers.tiktok.com → "Manage apps" → "Connect an app".
2. Add the "Login Kit" product.
3. Configure → copy **Client Key** + **Client Secret**.
4. Add OAuth redirect URI (use exact URL).
5. `supabase secrets set TIKTOK_CLIENT_KEY=... TIKTOK_CLIENT_SECRET=...`
6. The `client_id` URL param for TikTok is called `client_key` (gotcha).

Authorize URL:
```
https://www.tiktok.com/v2/auth/authorize?client_key=<key>&redirect_uri=<uri>&scope=user.info.basic&response_type=code&state=<base64>
```

## YouTube (Google)

1. https://console.cloud.google.com → "APIs & Services" → "Credentials" → "Create Credentials" → "OAuth client ID".
2. Application type: "Web application".
3. Enable the "YouTube Data API v3" library (Library tab).
4. Set redirect URI from "Common steps" step 3.
5. Copy **Client ID** + **Client Secret**.
6. `supabase secrets set YOUTUBE_CLIENT_ID=... YOUTUBE_CLIENT_SECRET=...`
7. The OAuth consent screen has to be configured; for dev use add yourself as a test user.

Authorize URL:
```
https://accounts.google.com/o/oauth2/v2/auth?client_id=<id>&redirect_uri=<uri>&response_type=code&scope=https://www.googleapis.com/auth/youtube.readonly&access_type=offline&state=<base64>
```

The `access_type=offline` is what gives you a refresh_token. Without
it, you only get a 1-hour access token.

## X (Twitter)

1. https://developer.x.com → "Projects & Apps" → create.
2. User authentication settings → enable OAuth 2.0 → "Public client" or "Confidential client" (confidential needed for the basic-auth style; public uses PKCE only).
3. Set redirect URI.
4. Copy **Client ID** (+ **Client Secret** if confidential).
5. `supabase secrets set X_CLIENT_ID=... X_CLIENT_SECRET=...`

X requires PKCE. The Edge Function's stub here uses
`X_CODE_VERIFIER_PLACEHOLDER` — that's a hack. Real impl needs the
client to generate a code_verifier, derive a code_challenge, send the
challenge with the authorize request, then ship the verifier through
to the callback (typically via the `state` blob or a server-side
session).

Authorize URL:
```
https://x.com/i/oauth2/authorize?response_type=code&client_id=<id>&redirect_uri=<uri>&scope=users.read%20tweet.read&state=<base64>&code_challenge=<challenge>&code_challenge_method=S256
```

## Substack (newsletter)

Substack has no public OAuth API as of 2026-05. Workaround options:

- **RSS feed verification**: creator pastes their feed URL; we add a temporary token to their profile and ask them to mention it in their next post or bio. Worker verifies the token appears in the feed within 24 hours.
- **DNS TXT record**: creator adds a TXT record `alamut-verify=<token>` to their custom domain. Cheap to verify but requires a real domain.

The Edge Function stubs `newsletter` to throw — implement one of the
above out-of-band.

## After all platforms are registered

The `v2VerifyChannel` mutation in `app/src/screens/workspace-v2/v2CreatorActions.ts`
currently just flips `verified: true` on the local Platform record. To
hook into real tokens, replace its body with a SELECT against
`public.creator_channel_verified` (defined in migration 024) — that
view returns `(creator_id, platform, verified-boolean)` based on
non-expired tokens, with no access to token contents.

## Token rotation

The schema has `expires_at` + `refresh_token`. A scheduled job (cron
or Edge Function on a timer) should:

1. Find rows where `expires_at < now() + interval '5 minutes'`.
2. POST refresh_token to the platform's refresh endpoint.
3. UPDATE access_token + expires_at.

Not implemented yet — the prototype's first connection works without
rotation up to the access-token expiry.
