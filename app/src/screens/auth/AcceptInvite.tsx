// AcceptInvite.tsx — landing page for /accept-invite?token=<token>
//
// Phase 14. Brand owners share a token-bearing URL with teammates;
// teammates open it and either:
//   - already signed in with the matching email → Accept button
//     attaches them to the brand with the invite's role
//   - signed in with a DIFFERENT email → see error + sign-out + retry
//   - not signed in → CTAs to /signin and /signup with email pre-filled
//
// Idempotent — re-visiting an already-accepted invite shows "Already
// on the team" rather than erroring.

import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/lib/auth/useAuth';
import { useStore } from '@/lib/api/store';
import { v2AcceptTeamInvite } from '@/screens/workspace-v2/v2Hooks';
import { fetchInviteByToken } from '@/lib/data/teamInvitesRepo';
import { isSupabaseConfigured } from '@/lib/supabase';
import type { TeamInvite } from '@/lib/api/types';
import { pushToast } from '@/lib/utils/toast';

export function AcceptInvite() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') ?? '';
  const { user } = useAuth();
  const db = useStore((s) => s.db);
  const [invite, setInvite] = useState<TeamInvite | null | 'loading' | 'not-found'>('loading');
  const [accepting, setAccepting] = useState(false);

  // Resolve the invite — local store first (post-hydration peers see
  // newly-created invites via the existing overlay), then Supabase
  // fallback when there's no local row (cross-device scenario: brand
  // sent the invite on a different device than the invitee).
  useEffect(() => {
    if (!token) { setInvite('not-found'); return; }
    const local = (db.teamInvites ?? []).find((i) => i.token === token);
    if (local) { setInvite(local); return; }
    if (!isSupabaseConfigured()) { setInvite('not-found'); return; }
    void fetchInviteByToken(token).then((remote) => {
      setInvite(remote ?? 'not-found');
    });
  }, [token, db.teamInvites]);

  const brand = useMemo(() => {
    if (!invite || invite === 'loading' || invite === 'not-found') return null;
    return db.brands.find((b) => b.id === invite.brandId);
  }, [invite, db.brands]);

  if (invite === 'loading') {
    return <Layout><p>Looking up your invite…</p></Layout>;
  }
  if (invite === 'not-found' || invite === null) {
    return <Layout>
      <h1>Invite not found</h1>
      <p>This link may have expired, been revoked, or never existed.</p>
      <Link to="/" className="v2-btn v2-btn-outline" style={{ marginTop: 12 }}>Back to home</Link>
    </Layout>;
  }
  // From here, invite is a real TeamInvite (TS narrowing aside; we asserted above).
  const inv: TeamInvite = invite;

  if (inv.revokedAt) {
    return <Layout>
      <h1>Invite revoked</h1>
      <p>The brand owner revoked this invite. Ask them to send a new one.</p>
      <Link to="/" className="v2-btn v2-btn-outline" style={{ marginTop: 12 }}>Back to home</Link>
    </Layout>;
  }

  if (inv.acceptedAt && user && inv.acceptedByUserId === user.id) {
    return <Layout>
      <h1>You're on the team</h1>
      <p>This invite was already accepted. Heading to your workspace…</p>
      <button
        className="v2-btn v2-btn-primary"
        type="button"
        onClick={() => navigate('/v2')}
        style={{ marginTop: 12 }}
      >Open workspace</button>
    </Layout>;
  }

  // Signed-out flow.
  if (!user) {
    return <Layout>
      <h1>You've been invited to {brand?.name ?? 'a brand workspace'}</h1>
      <p style={{ marginBottom: 8 }}>
        Invitation for <strong>{inv.invitedEmail}</strong> · role: <strong>{inv.role}</strong>
      </p>
      <p className="v2-muted" style={{ fontSize: 13, marginBottom: 16 }}>
        Sign in (or create an account) with that email to join.
      </p>
      <div style={{ display: 'flex', gap: 8 }}>
        <Link
          to={`/signin?email=${encodeURIComponent(inv.invitedEmail)}&next=${encodeURIComponent('/accept-invite?token=' + token)}`}
          className="v2-btn v2-btn-primary"
        >Sign in</Link>
        <Link
          to={`/signup?role=brand&email=${encodeURIComponent(inv.invitedEmail)}&next=${encodeURIComponent('/accept-invite?token=' + token)}`}
          className="v2-btn v2-btn-outline"
        >Create account</Link>
      </div>
    </Layout>;
  }

  // Wrong account.
  if (user.email.toLowerCase() !== inv.invitedEmail.toLowerCase()) {
    return <Layout>
      <h1>Wrong account</h1>
      <p>This invite is for <strong>{inv.invitedEmail}</strong>, but you're signed in as <strong>{user.email}</strong>.</p>
      <p className="v2-muted" style={{ fontSize: 13, marginTop: 8 }}>
        Sign out, then sign in with the invited email.
      </p>
    </Layout>;
  }

  // Right account, not yet accepted.
  return <Layout>
    <h1>Join {brand?.name ?? 'the team'}</h1>
    <p style={{ marginBottom: 8 }}>
      You've been invited as <strong>{inv.role}</strong>.
    </p>
    <p className="v2-muted" style={{ fontSize: 13, marginBottom: 16 }}>
      Accepting attaches your account to {brand?.name ?? 'this brand'}'s workspace.
    </p>
    <button
      className="v2-btn v2-btn-primary"
      type="button"
      disabled={accepting}
      onClick={() => {
        setAccepting(true);
        const result = v2AcceptTeamInvite(token);
        if (result.ok) {
          pushToast(`Welcome to ${brand?.name ?? 'the team'}`);
          setTimeout(() => navigate('/v2'), 400);
        } else {
          pushToast(result.reason === 'wrong-account' ? 'Wrong account — sign out and use the invited email'
            : result.reason === 'revoked' ? 'This invite was revoked'
            : result.reason === 'sign-in-required' ? 'Sign in to accept'
            : 'Could not accept invite');
          setAccepting(false);
        }
      }}
    >
      {accepting ? 'Joining…' : 'Accept invite'}
    </button>
  </Layout>;
}

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
      background: 'var(--v2-bg, #FBF7EE)',
      fontFamily: 'var(--v2-font-body, "Inter", system-ui, sans-serif)',
    }}>
      <div style={{
        maxWidth: 480,
        width: '100%',
        background: 'var(--v2-paper, white)',
        border: '1px solid var(--v2-line, #E5DDD0)',
        borderRadius: 16,
        padding: 32,
        boxShadow: '0 10px 30px rgba(0, 0, 0, 0.06)',
      }}>
        {children}
      </div>
    </div>
  );
}

export default AcceptInvite;
