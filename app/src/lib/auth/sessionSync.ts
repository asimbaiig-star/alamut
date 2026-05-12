// sessionSync.ts — keep the local Zustand session in lockstep with
// Supabase's real auth.getSession().
//
// Without this, a stale localStorage entry from a previous test run
// makes the app act as if the user is still signed in. The user can
// click "Continue" on the landing page and land in someone else's
// workspace because useAuth only checks the local session — it never
// validates against the real auth.users session.
//
// What this module does:
//   1. On boot, read Supabase auth.getSession(). If there's no live
//      auth session but the local store thinks someone is signed in,
//      clear the local session.
//   2. Subscribe to supabase.auth.onAuthStateChange so the local
//      session reflects sign-in / sign-out / token-expiry as it
//      happens (cross-tab logout, expired refresh, etc.).
//
// Local-only mode: when Supabase isn't configured (no env vars), this
// module short-circuits — the local session remains source of truth
// for the demo-only flow.

import { useStore } from '@/lib/api/store';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';

let mounted = false;

export async function mountSessionSync(): Promise<void> {
  if (typeof window === 'undefined') return;
  if (mounted) return;
  if (!isSupabaseConfigured()) return;
  mounted = true;

  const sb = getSupabase();

  // 1. Boot-time reconciliation.
  try {
    const { data } = await sb.auth.getSession();
    const supaUser = data.session?.user ?? null;
    const localSession = useStore.getState().session;

    if (!supaUser && localSession) {
      // Local thinks we're signed in but Supabase says no — clear it.
      useStore.getState().setSession(null);
    } else if (supaUser && !localSession) {
      // Supabase has a session but local doesn't — resolve the local
      // user by email and set the session. Same resolution path as
      // sign-in: try local first, fall back to brands/creators owner.
      await resolveAndSetSession(supaUser.email);
    } else if (supaUser && localSession) {
      // Both have sessions — make sure they agree on email.
      const db = useStore.getState().db;
      const localUser = db.users.find((u) => u.id === localSession.userId);
      if (!localUser || localUser.email.toLowerCase() !== (supaUser.email ?? '').toLowerCase()) {
        // Mismatch — re-resolve from the Supabase email (authoritative).
        useStore.getState().setSession(null);
        await resolveAndSetSession(supaUser.email);
      }
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[sessionSync] boot reconcile failed:', err);
  }

  // 2. Reactive sync: listen for auth state changes.
  sb.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT' || !session) {
      useStore.getState().setSession(null);
      return;
    }
    if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
      const localSession = useStore.getState().session;
      const db = useStore.getState().db;
      const matchedLocal = db.users.find(
        (u) => u.email.toLowerCase() === (session.user.email ?? '').toLowerCase(),
      );
      // If the existing local session already matches, do nothing.
      if (matchedLocal && localSession?.userId === matchedLocal.id) return;
      // Otherwise resolve fresh.
      void resolveAndSetSession(session.user.email);
    }
  });
}

/** Look up the local User by email, falling back to a brands/creators
 *  owner_email lookup (synthesises a User row if needed — same pattern
 *  as the sign-in flow). Sets the local session on success. */
async function resolveAndSetSession(email: string | undefined): Promise<void> {
  if (!email) return;
  const cleanEmail = email.toLowerCase();
  const db = useStore.getState().db;

  // 1. Local first.
  const local = db.users.find((u) => u.email.toLowerCase() === cleanEmail);
  if (local) {
    useStore.getState().setSession({ userId: local.id, issuedAt: new Date().toISOString() });
    return;
  }

  // 2. Supabase fallback — query brands + creators owner_email.
  try {
    const sb = getSupabase();
    const [brandRes, creatorRes] = await Promise.all([
      sb.from('brands').select('id, name').eq('owner_email', cleanEmail).maybeSingle(),
      sb.from('creators').select('id, name').eq('owner_email', cleanEmail).maybeSingle(),
    ]);
    const brand = brandRes.data;
    const creator = creatorRes.data;
    if (!brand && !creator) return;

    // Same deterministic id helper as client.ts:deterministicUserId.
    const hash = cleanEmail.split('').reduce((h, c) => ((h * 33 + c.charCodeAt(0)) >>> 0), 5381).toString(36);
    const userId = `u_x_${hash}`;
    const now = new Date().toISOString();

    const synth = creator
      ? {
          id: userId, email: cleanEmail, passwordHash: '',
          role: 'creator' as const, status: 'active' as const,
          createdAt: now, creatorId: creator.id,
        }
      : {
          id: userId, email: cleanEmail, passwordHash: '',
          role: 'brand' as const, status: 'active' as const,
          createdAt: now, brandId: brand!.id,
        };

    useStore.setState((s) => {
      if (s.db.users.some((u) => u.id === userId)) return s;
      return { db: { ...s.db, users: [...s.db.users, synth] } };
    });
    useStore.getState().setSession({ userId, issuedAt: now });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[sessionSync] resolve failed:', err);
  }
}
