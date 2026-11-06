// Sign in — on the v2 surface, between the landing pages and the workspace,
// so it uses their tokens, mark and components (styles/auth-v2.css).
// Form logic unchanged: password and magic-link modes, demo accounts and
// `?demo=`, validation, post-auth navigation.

import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api, ApiError } from '@/lib/api/client';
import { pushToast } from '@/lib/utils/toast';
import { SUPABASE_STORAGE_KEY } from '@/lib/supabase';
import { BrandMarkSvg } from '@/screens/workspace-v2/BrandMark';
import { PasswordInput } from './PasswordInput';
import '@/styles/auth-v2.css';

// Demo quick-pick visibility. ON by default so the public beta is walkable
// without a signup; set VITE_HIDE_DEMO_LOGINS=true to hide it (Vercel env
// var, no code change or redeploy of source needed).
const DEMO_LOGINS_ENABLED = import.meta.env.VITE_HIDE_DEMO_LOGINS !== 'true';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Email on the session supabase-js persisted, or null. Read from storage
 *  rather than the store: on a cold load the store's session is restored
 *  asynchronously, and `?demo=` has to decide on the first render. */
function storedSessionEmail(): string | null {
  try {
    const raw = window.localStorage.getItem(SUPABASE_STORAGE_KEY);
    const s = raw ? (JSON.parse(raw) as { user?: { email?: string } } | null) : null;
    return s?.user?.email?.toLowerCase() ?? null;
  } catch {
    return null;
  }
}

export function SignIn() {
  const [mode, setMode] = useState<'password' | 'magic'>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailErr, setEmailErr] = useState<string | null>(null);
  const [passwordErr, setPasswordErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [magicToken, setMagicToken] = useState<string | null>(null);
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const demoRequested = useRef(false);
  // app.html paints the page this ground before the app loads, so there's no
  // flash on the way in. From here on the page paints its own.
  useEffect(() => { document.documentElement.style.removeProperty('background'); }, []);
  const [signedInElsewhere, setSignedInElsewhere] = useState(false);

  const validateEmail = (v: string) => {
    if (!v.trim()) return 'Email is required.';
    if (!EMAIL_RE.test(v.trim())) return 'Enter a valid email address.';
    return null;
  };

  const goAfterAuth = (role: string) => {
    // F27 — drop the previous session's stored workspace route.
    //
    // `alamut.v2.route` persists the last screen so a reload resumes where
    // you were, but it isn't scoped to a user. Signing in as a brand on a
    // browser that last held a creator's `collab:<id>` route restored that
    // deep link — and `routeFitsPersona` waves drilldown prefixes through
    // for both personas — landing the brand on a full-page "You don't have
    // access to this collaboration" with no way out. A fresh sign-in should
    // start at the persona's home anyway.
    try { localStorage.removeItem('alamut.v2.route'); } catch { /* private mode */ }
    // Phase F cutover · brand and creator land on the v2 workspace.
    // Admin still goes to the legacy admin portal (Phase H pending).
    if (role === 'admin') navigate('/admin/home');
    else navigate('/v2');
  };

  const submitPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    // F2 — validate before calling the API. Submitting an empty form used
    // to reach Supabase and surface its raw copy ("missing email or
    // phone"), which reads like an internal error to a user who simply
    // hasn't typed anything yet.
    const eErr = validateEmail(email);
    const pErr = password ? null : 'Password is required.';
    setEmailErr(eErr);
    setPasswordErr(pErr);
    if (eErr || pErr) {
      setErr(null);
      return;
    }
    await doSignIn(email, password);
  };

  // Sign in with explicit credentials. The demo buttons below call this
  // directly rather than filling the form and re-submitting — a setState
  // followed by a submit in the same tick would still read the OLD email
  // and password, so a "one-click" button built that way signs in as
  // whoever was typed before.
  const doSignIn = async (em: string, pw: string) => {
    setBusy(true); setErr(null);
    try {
      const u = await api.auth.signIn(em, pw);
      pushToast(`Welcome back`, 'good');
      goAfterAuth(u.role);
    } catch (e) {
      // Authenticated but no profile to resolve (and nothing to rebuild
      // one from) — send them to the finish-setup form rather than
      // leaving them stuck on the sign-in screen. The session is still
      // live, so the profile write there will succeed.
      if (e instanceof ApiError && e.code === 'profile_setup_required') {
        navigate(`/signup?finish=1&email=${encodeURIComponent(em.trim().toLowerCase())}`);
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

  // Deliberately NOT 'admin' — A3 removed the admin quick-pick and it stays
  // removed. These two are creator + brand demo personas only.
  const DEMO_ACCOUNTS = {
    creator: { email: 'sarah@alamut.test', label: 'Sarah — creator' },
    brand: { email: 'hannah@aesop.test', label: 'Aesop — brand' },
    // NOTE — a third demo account, `nadia@talent.test` (talent manager for
    // Amir and Yuki), exists in the SEED but is deliberately not offered
    // here: it has no Supabase Auth user, so the button returned
    // `invalid_credentials`. A demo button that fails is worse than no
    // button. Create that auth user (password demo1234) and add:
    //   manager: { email: 'nadia@talent.test', label: 'Nadia — talent manager' },
    // plus a matching button below, to make the "acting for" switcher
    // reachable from the sign-in screen.
  } as const;

  const useDemoAccount = async (which: keyof typeof DEMO_ACCOUNTS) => {
    const em = DEMO_ACCOUNTS[which].email;
    const pw = 'demo1234';
    // Mirror into the form so the fields reflect what's being used (and the
    // visitor can see the credentials), then sign in with the explicit
    // values rather than the not-yet-committed state.
    setEmail(em);
    setPassword(pw);
    setMode('password');
    // F3 — clear any stale failure so the form doesn't look broken.
    setErr(null);
    setEmailErr(null);
    setPasswordErr(null);
    await doSignIn(em, pw);
  };

  // `/signin?demo=creator|brand` — the landing's "Try the live demo" — signs
  // straight in, as if the button below had been pressed. Once: StrictMode
  // runs effects twice, and a second sign-in would race the first.
  //
  // Never over someone's own session. Already in that demo account → just
  // go to it; signed in as anyone else → stay here and say so, rather than
  // silently swapping their account for a shared one.
  useEffect(() => {
    const which = params.get('demo');
    if (!DEMO_LOGINS_ENABLED || demoRequested.current) return;
    if (which !== 'creator' && which !== 'brand') return;
    demoRequested.current = true;
    const current = storedSessionEmail();
    if (current === DEMO_ACCOUNTS[which].email) { navigate('/v2'); return; }
    if (current) { setSignedInElsewhere(true); return; }
    void useDemoAccount(which);
  }, [params]); // once per ?demo= load — the ref above guards re-runs

  return (
    <div data-surface="v2" className="auth-v2 is-plain">
      <header className="auth-v2-nav">
        <Link to="/" aria-label="Alamut home" className="auth-v2-brand">
          <span className="auth-v2-mark"><BrandMarkSvg /></span><span>Alamut</span>
        </Link>
        <div className="auth-v2-nav-actions">
          <span className="auth-v2-muted">New here?</span>
          <Link to="/signup" className="auth-v2-link">Create account</Link>
        </div>
      </header>

      <main className="auth-v2-main">
        <div className="auth-v2-grid">
          <aside className="auth-v2-side">
            <h1 className="auth-v2-h1"><span className="auth-v2-line"><span>Welcome</span></span> <span className="auth-v2-line"><span>back.</span></span></h1>
            <p className="auth-v2-lede">Pick up your briefs, deals and wallet where you left them.</p>

            {/* Demo quick-pick. B4 originally gated this to local dev,
                because on a public URL it hands any visitor the seeded
                accounts — whose state is SHARED, so one visitor's edits
                are the next visitor's starting point.

                That's now a deliberate product decision: the whole point
                of the public beta is that people can walk the product
                without signing up. Kept switchable without a code change
                — set VITE_HIDE_DEMO_LOGINS=true in Vercel to hide it. */}
            {DEMO_LOGINS_ENABLED && (
              <div className="auth-v2-card auth-v2-demo">
                <span className="auth-v2-label">Explore the demo</span>
                {signedInElsewhere && (
                  <p className="auth-v2-muted" role="status">
                    You're already signed in. Pick a demo account to switch to it,
                    or <Link to="/v2" className="auth-v2-link">open your workspace</Link>.
                  </p>
                )}
                <div className="auth-v2-demo-grid">
                  <button className="auth-v2-btn line" type="button" disabled={busy} onClick={() => useDemoAccount('creator')}>
                    {DEMO_ACCOUNTS.creator.label}
                  </button>
                  <button className="auth-v2-btn line" type="button" disabled={busy} onClick={() => useDemoAccount('brand')}>
                    {DEMO_ACCOUNTS.brand.label}
                  </button>
                </div>
                <p className="auth-v2-muted">
                  One click signs you in to a full demo account. Its sample data is shared by everyone
                  exploring, so change anything you like.
                </p>
              </div>
            )}
          </aside>

          <div className="auth-v2-pile">
          <section className="auth-v2-card auth-v2-form-card" aria-labelledby="signin-title">
            <h2 className="auth-v2-h2" id="signin-title">Sign in</h2>

            <div className="auth-v2-tabs" role="tablist" aria-label="Sign-in method">
              <button type="button" role="tab" aria-selected={mode === 'password'} className={mode === 'password' ? 'is-on' : ''} onClick={() => setMode('password')}>
                Password
              </button>
              <button type="button" role="tab" aria-selected={mode === 'magic'} className={mode === 'magic' ? 'is-on' : ''} onClick={() => setMode('magic')}>
                Magic link
              </button>
            </div>

            {mode === 'password' ? (
              <form className="auth-v2-fields" onSubmit={submitPassword} noValidate aria-describedby={err ? 'signin-error' : undefined}>
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
                    onChange={(e) => { setEmail(e.target.value); if (emailErr) setEmailErr(null); if (err) setErr(null); }}
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
                  <PasswordInput
                    id="signin-password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); if (passwordErr) setPasswordErr(null); if (err) setErr(null); }}
                    required
                    aria-invalid={!!passwordErr || !!err || undefined}
                    aria-describedby={passwordErr ? 'signin-password-error' : undefined}
                  />
                  {passwordErr && <span id="signin-password-error" className="field-error" role="alert">{passwordErr}</span>}
                </div>
                {err && <div id="signin-error" className="field-error" role="alert">{err}</div>}
                <button type="submit" className="auth-v2-btn accent" disabled={busy} aria-busy={busy || undefined}>
                  {busy ? 'Signing in…' : 'Sign in'}
                </button>
              </form>
            ) : (
              <form className="auth-v2-fields" onSubmit={sendMagic} noValidate aria-describedby={err ? 'magic-error' : undefined}>
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
                    onChange={(e) => { setEmail(e.target.value); if (emailErr) setEmailErr(null); if (err) setErr(null); }}
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
                  <button type="submit" className="auth-v2-btn" disabled={busy} aria-busy={busy || undefined}>
                    {busy ? 'Sending…' : 'Send magic link'}
                  </button>
                ) : (
                  <div className="auth-v2-card auth-v2-magic">
                    <span className="auth-v2-label">Magic link issued</span>
                    <p className="auth-v2-muted">In the beta this link isn't emailed. Use it below to finish signing in.</p>
                    <code>{magicToken}</code>
                    <button type="button" className="auth-v2-btn" onClick={verifyMagic} disabled={busy} aria-busy={busy || undefined}>
                      {busy ? 'Verifying…' : 'Verify and sign in'}
                    </button>
                  </div>
                )}
              </form>
            )}

            <p className="auth-v2-foot">New to Alamut? <Link to="/signup" className="auth-v2-link">Create account</Link></p>
          </section>
          </div>
        </div>
      </main>

      <footer className="auth-v2-page-foot">© 2026 Alamut</footer>
    </div>
  );
}
