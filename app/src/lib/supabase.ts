// Supabase client singleton.
//
// Phase 1 of the backend migration: we wire up real auth via Supabase
// while keeping all entity data (campaigns, offers, collabs, etc.) in
// the local Zustand store. Later phases will migrate tables one at a
// time; until then the rest of the app continues talking to
// `useStore`.
//
// Env vars exposed via Vite:
//   - VITE_SUPABASE_URL          — project URL
//   - VITE_SUPABASE_ANON_KEY     — publishable/anon key (safe in client)
//
// Both vars are *optional* on purpose — when they're not set, the
// helper `isSupabaseConfigured()` returns false and the existing
// signIn flow falls back to the seed-based fake auth. This keeps the
// developer-onboarding story unchanged: `npm install && npm run dev`
// still works without Supabase credentials.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

let _client: SupabaseClient | null = null;

/** True when both env vars are set — i.e. the app should attempt real
 *  Supabase calls. Callers should branch on this and fall back to
 *  local-only behaviour when false. */
export function isSupabaseConfigured(): boolean {
  return !!url && !!anonKey;
}

/** Lazy singleton Supabase client. Throws if env vars are missing —
 *  pair with `isSupabaseConfigured()` before calling. */
export function getSupabase(): SupabaseClient {
  if (_client) return _client;
  if (!url || !anonKey) {
    throw new Error(
      'Supabase env vars missing. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in app/.env.local',
    );
  }
  _client = createClient(url, anonKey, {
    auth: {
      // Persist session in localStorage under a dedicated key so it
      // doesn't collide with Zustand's `alamut.v1`.
      storageKey: 'alamut.sb.auth',
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
  return _client;
}
