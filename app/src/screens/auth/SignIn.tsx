// Sign in — Phase 50 airy refactor.
// All form logic preserved (password / magic-link modes, demo-account
// fillers, validation, post-auth role-routed navigation). Visual shell
// swapped from `.auth-shell` legacy to airy primitives + a thin
// `.auth-airy-*` page-specific layer.

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Logo } from '@/components/ui/Logo';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { TileHalo } from '@/components/layout/TileHalo';
import { api, ApiError } from '@/lib/api/client';
import { pushToast } from '@/lib/utils/toast';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function SignIn() {
  const [mode, setMode] = useState<'password' | 'magic'>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailErr, setEmailErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [magicToken, setMagicToken] = useState<string | null>(null);
  const navigate = useNavigate();

  const validateEmail = (v: string) => {
    if (!v.trim()) return 'Email is required.';
    if (!EMAIL_RE.test(v.trim())) return 'Enter a valid email address.';
    return null;
  };

  const goAfterAuth = (role: string) => {
    // Phase F cutover · brand and creator land on the v2 workspace.
    // Admin still goes to the legacy admin portal (Phase H pending).
    if (role === 'admin') navigate('/admin/home');
    else navigate('/v2');
  };

  const submitPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      const u = await api.auth.signIn(email, password);
      pushToast(`Welcome back`, 'good');
      goAfterAuth(u.role);
    } catch (e) {
      // Authenticated but no profile to resolve (and nothing to rebuild
      // one from) — send them to the finish-setup form rather than
      // leaving them stuck on the sign-in screen. The session is still
      // live, so the profile write there will succeed.
      if (e instanceof ApiError && e.code === 'profile_setup_required') {
        navigate(`/signup?finish=1&email=${encodeURIComponent(email.trim().toLowerCase())}`);
        return;
      }
      setErr(e instanceof ApiError ? e.message : 'Sign in failed.');
    } finally {
      setBusy(false);
    }
  };

  const sendMagic = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      const r = await api.auth.requestMagicLink(email);
      setMagicToken(r.token);
      pushToast('Magic link issued (demo mode — click to verify below)', 'good');
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Could not send link.');
    } finally {
      setBusy(false);
    }
  };

  const verifyMagic = async () => {
    if (!magicToken) return;
    setBusy(true); setErr(null);
    try {
      const u = await api.auth.verifyMagicLink(email, magicToken);
      pushToast('Signed in via magic link', 'good');
      goAfterAuth(u.role);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Verify failed.');
    } finally {
      setBusy(false);
    }
  };

  const fillDemo = (which: 'creator' | 'brand' | 'admin') => {
    setEmail(which === 'creator' ? 'sarah@alamut.test' : which === 'brand' ? 'hannah@aesop.test' : 'admin@alamut.test');
    setPassword('demo1234');
    setMode('password');
  };

  return (
    <div data-surface="landing-light" className="lp-light-root auth-airy auth-landing-light">
      <TileHalo />

      <header className="airy-topnav auth-landing-topnav">
        <div className="airy-topnav-inner">
          <Link to="/" aria-label="Alamut home" className="airy-topnav-logo">
            <Logo size={20} tag="ALAMUT" />
          </Link>
          <div className="airy-topnav-actions">
            <span className="airy-meta">New here?</span>
            <Link to="/signup" className="lp-topnav-signin">Create account</Link>
          </div>
        </div>
      </header>

      <main className="airy-section auth-airy-main">
        <div className="auth-airy-grid">
          {/* Side narrative — calmer welcome copy + demo-account quick picks. */}
          <aside className="auth-airy-side">
            <div className="airy-stack-lg">
              <div className="airy-eyebrow">Sign in</div>
              <h1 className="airy-h-display auth-airy-h">
                Welcome <em>back</em>.
              </h1>
              <p className="airy-lede">
                Pick up wherever you left off.
              </p>

              {/* Local dev only. On the public deployment these buttons
                  would hand any visitor the seeded demo accounts — which
                  hold real-looking escrow figures and shared demo state
                  that a stranger could mutate for everyone. */}
              {import.meta.env.DEV && (
                <div className="airy-card auth-airy-demo-card">
                  <div className="airy-eyebrow" style={{ marginBottom: 'var(--space-sm)' }}>
                    Demo accounts · one click · dev only
                  </div>
                  <div className="auth-airy-demo-grid">
                    <button className="btn btn-sm btn-ghost" type="button" onClick={() => fillDemo('creator')}>Creator</button>
                    <button className="btn btn-sm btn-ghost" type="button" onClick={() => fillDemo('brand')}>Brand</button>
                  </div>
                  <p className="airy-meta auth-airy-demo-help">
                    Pre-filled with seed credentials. Click <strong>Sign in</strong> after.
                  </p>
                </div>
              )}
            </div>
          </aside>

          {/* Form card */}
          <section className="auth-airy-form">
            <div className="airy-card auth-airy-form-card">
              <div className="airy-stack">
                <div className="airy-eyebrow">Method</div>
                <h2 className="airy-h-section">
                  {mode === 'password' ? 'Use your password.' : 'Get a magic link.'}
                </h2>

                <div className="auth-airy-tab" role="tablist" aria-label="Sign-in method">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={mode === 'password'}
                    className={mode === 'password' ? 'is-on' : ''}
                    onClick={() => setMode('password')}
                  >
                    Password
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={mode === 'magic'}
                    className={mode === 'magic' ? 'is-on' : ''}
                    onClick={() => setMode('magic')}
                  >
                    Magic link
                  </button>
                </div>

                {mode === 'password' ? (
                  <form className="auth-airy-fields" onSubmit={submitPassword} noValidate aria-describedby={err ? 'signin-error' : undefined}>
                    <div className="field">
                      <label htmlFor="signin-email" className="field-label">Email</label>
                      <input
                        id="signin-email"
                        type="email"
                        autoComplete="email"
                        inputMode="email"
                        autoCapitalize="none"
                        autoCorrect="off"
                        spellCheck={false}
                        value={email}
                        onChange={(e) => { setEmail(e.target.value); if (emailErr) setEmailErr(null); }}
                        onBlur={(e) => setEmailErr(validateEmail(e.target.value))}
                        placeholder="you@example.com"
                        required
                        aria-invalid={!!emailErr || !!err || undefined}
                        aria-describedby={emailErr ? 'signin-email-error' : undefined}
                      />
                      {emailErr && <span id="signin-email-error" className="field-error" role="alert">{emailErr}</span>}
                    </div>
                    <div className="field">
                      <label htmlFor="signin-password" className="field-label">Password</label>
                      <input
                        id="signin-password"
                        type="password"
                        autoComplete="current-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        aria-invalid={!!err || undefined}
                      />
                    </div>
                    {err && <div id="signin-error" className="field-error" role="alert">{err}</div>}
                    <Button type="submit" loading={busy} iconRight={<Icon.arrow s={14} />}>Sign in</Button>
                  </form>
                ) : (
                  <form className="auth-airy-fields" onSubmit={sendMagic} noValidate aria-describedby={err ? 'magic-error' : undefined}>
                    <div className="field">
                      <label htmlFor="magic-email" className="field-label">Email</label>
                      <input
                        id="magic-email"
                        type="email"
                        autoComplete="email"
                        inputMode="email"
                        autoCapitalize="none"
                        autoCorrect="off"
                        spellCheck={false}
                        value={email}
                        onChange={(e) => { setEmail(e.target.value); if (emailErr) setEmailErr(null); }}
                        onBlur={(e) => setEmailErr(validateEmail(e.target.value))}
                        placeholder="you@example.com"
                        required
                        aria-invalid={!!emailErr || !!err || undefined}
                        aria-describedby={emailErr ? 'magic-email-error' : undefined}
                      />
                      {emailErr && <span id="magic-email-error" className="field-error" role="alert">{emailErr}</span>}
                    </div>
                    {err && <div id="magic-error" className="field-error" role="alert">{err}</div>}
                    {!magicToken ? (
                      <Button type="submit" loading={busy} icon={<Icon.mail s={14} />}>Send magic link</Button>
                    ) : (
                      <div className="airy-card auth-airy-magic-card">
                        <div className="airy-eyebrow">Magic link issued</div>
                        <p className="airy-lede" style={{ fontSize: 13 }}>
                          Real backend would email this. In demo mode, click below to verify.
                        </p>
                        <code className="auth-airy-magic-token">
                          {magicToken}
                        </code>
                        <Button onClick={verifyMagic} loading={busy} iconRight={<Icon.arrow s={14} />}>
                          Verify and sign in
                        </Button>
                      </div>
                    )}
                  </form>
                )}

                <hr className="airy-divider" style={{ margin: 'var(--space-md) 0' }} />

                <div className="auth-airy-foot">
                  <span className="airy-meta">New to Alamut?</span>
                  <Link to="/signup" className="auth-airy-foot-link">Create account →</Link>
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>

      <footer className="auth-airy-page-foot">
        <span className="airy-meta">© 2026 Alamut</span>
      </footer>
    </div>
  );
}
