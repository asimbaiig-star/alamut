// Sign up — Phase 50 airy refactor.
// Form logic preserved (role tabs, conditional fields per role, validation,
// post-signup role-routed navigation). Visual shell uses airy primitives.

import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Logo } from '@/components/ui/Logo';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { TileHalo } from '@/components/layout/TileHalo';
import { api, ApiError } from '@/lib/api/client';
import { pushToast } from '@/lib/utils/toast';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function SignUp() {
  const [params] = useSearchParams();
  const initialRole = (params.get('role') as 'creator' | 'brand') || 'creator';
  const [role, setRole] = useState<'creator' | 'brand'>(initialRole);

  // Finish-setup mode (`?finish=1&email=…`): the visitor already has a
  // confirmed Supabase account + live session but no Creator/Brand row.
  // Same form, but we skip auth sign-up and only write the profile.
  const finishMode = params.get('finish') === '1';
  const finishEmail = params.get('email') ?? '';

  const [name, setName] = useState('');
  const [email, setEmail] = useState(finishMode ? finishEmail : '');
  const [password, setPassword] = useState('');
  const [brandName, setBrandName] = useState('');
  const [industry, setIndustry] = useState('');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [emailErr, setEmailErr] = useState<string | null>(null);
  const [passwordErr, setPasswordErr] = useState<string | null>(null);
  // Phase A · F10 — when the Supabase project has email confirmation
  // on, signUp returns `needs_confirmation` and NO session. We show a
  // check-your-email screen instead of pretending the account is live.
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [resent, setResent] = useState(false);

  const validateEmail = (v: string) => {
    if (!v.trim()) return 'Email is required.';
    if (!EMAIL_RE.test(v.trim())) return 'Enter a valid email address.';
    return null;
  };
  const validatePassword = (v: string) => {
    if (!v) return 'Password is required.';
    if (v.length < 6) return 'At least 6 characters.';
    return null;
  };

  const navigate = useNavigate();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      if (finishMode) {
        // Account + session already exist — just create the profile.
        const user = await api.auth.completeProfileSetup({
          role,
          name: role === 'brand' ? (brandName || name) : name,
          brandName: role === 'brand' ? brandName : undefined,
          industry: role === 'brand' ? industry : undefined,
          city: role === 'creator' ? city : undefined,
          country: role === 'creator' ? country : undefined,
        });
        pushToast(`Welcome, ${user.email}`, 'good');
        try {
          localStorage.setItem('alamut.v2.route', role === 'creator' ? 'onboarding-creator' : 'onboarding-brand');
        } catch { /* fall through to /v2 home */ }
        navigate('/v2');
        return;
      }
      const result = await api.auth.signUp({
        email, password, role,
        name: role === 'brand' ? (brandName || name) : name,
        brandName: role === 'brand' ? brandName : undefined,
        industry: role === 'brand' ? industry : undefined,
        city: role === 'creator' ? city : undefined,
        country: role === 'creator' ? country : undefined,
      });
      if (result.status === 'needs_confirmation') {
        setPendingEmail(result.email);
        return;
      }
      pushToast(`Welcome, ${result.user.email}`, 'good');
      // Phase F cutover · drop new signups into the v2 onboarding wizard
      // by setting the v2 route in localStorage before navigating to /v2.
      // The legacy `/onboarding/{role}` routes remain wired for any old
      // bookmarks / email links that haven't been updated yet.
      try {
        localStorage.setItem('alamut.v2.route', role === 'creator' ? 'onboarding-creator' : 'onboarding-brand');
      } catch { /* fall through to /v2 home */ }
      navigate('/v2');
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : 'Could not sign up.';
      setErr(msg);
    } finally {
      setBusy(false);
    }
  };

  // F10 — confirmation pending. Terminal state for this screen: the
  // account exists in auth but has no usable session yet, so the only
  // real actions are "go check your inbox" or "resend".
  if (pendingEmail) {
    return (
      <div data-surface="landing-light" className="lp-light-root auth-airy auth-landing-light">
        <TileHalo />
        <header className="airy-topnav auth-landing-topnav">
          <div className="airy-topnav-inner">
            <Link to="/" aria-label="Alamut home" className="airy-topnav-logo">
              <Logo size={20} tag="ALAMUT" />
            </Link>
            <div className="airy-topnav-actions">
              <Link to="/signin" className="lp-topnav-signin">Sign in</Link>
            </div>
          </div>
        </header>
        <main className="airy-section auth-airy-main">
          <div className="airy-card" style={{ maxWidth: 520, margin: '0 auto', padding: 'var(--space-xl)' }}>
            <div className="airy-stack">
              <div className="airy-eyebrow">One more step</div>
              <h1 className="airy-h-section">Confirm your email.</h1>
              <p className="airy-lede">
                We sent a confirmation link to <strong>{pendingEmail}</strong>.
                Open it to activate your account, then sign in.
              </p>
              <p className="airy-meta">
                Can't find it? Check spam. The link opens Alamut and finishes
                setting up your profile.
              </p>
              {err && <div className="field-error" role="alert">{err}</div>}
              <div style={{ display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap', alignItems: 'center' }}>
                <Button onClick={() => navigate('/signin')} iconRight={<Icon.arrow s={14} />}>
                  Go to sign in
                </Button>
                <Button
                  variant="ghost"
                  loading={busy}
                  disabled={resent}
                  onClick={async () => {
                    setBusy(true); setErr(null);
                    try {
                      await api.auth.resendConfirmation(pendingEmail);
                      setResent(true);
                      pushToast('Confirmation email resent', 'good');
                    } catch (e) {
                      setErr(e instanceof ApiError ? e.message : 'Could not resend the email.');
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  {resent ? 'Email resent' : 'Resend email'}
                </Button>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div data-surface="landing-light" className="lp-light-root auth-airy auth-landing-light">
      <TileHalo />

      <header className="airy-topnav auth-landing-topnav">
        <div className="airy-topnav-inner">
          <Link to="/" aria-label="Alamut home" className="airy-topnav-logo">
            <Logo size={20} tag="ALAMUT" />
          </Link>
          <div className="airy-topnav-actions">
            <span className="airy-meta">Returning?</span>
            <Link to="/signin" className="lp-topnav-signin">Sign in</Link>
          </div>
        </div>
      </header>

      <main className="airy-section auth-airy-main">
        <div className="auth-airy-grid">
          {/* Side narrative — pitch + bullets, calmer than the dense version. */}
          <aside className="auth-airy-side">
            <div className="airy-stack-lg">
              <div className="airy-eyebrow">
                {role === 'creator' ? 'For creators' : 'For brands'}
              </div>
              <h1 className="airy-h-display auth-airy-h">
                {role === 'creator'
                  ? <>Build a body of <em>real work</em>.</>
                  : <>Run campaigns end-to-end, <em>without</em> the markup.</>
                }
              </h1>
              <p className="airy-lede">
                {role === 'creator'
                  ? 'Apply to live briefs, manage drafts, and get paid through escrow — all from one console.'
                  : 'Brief, shortlist, approve, and pay creators globally from a single wallet.'
                }
              </p>
              <ul className="auth-airy-bullets">
                <li><span className="auth-airy-bullets-num">01</span><span>Free to sign up. No card required.</span></li>
                {/* Mode-agnostic: the project may or may not have email
                    confirmation switched on, and signUp branches on whether
                    Supabase returns a session. Don't promise a confirmation
                    step the user may never see. */}
                <li><span className="auth-airy-bullets-num">02</span><span>Your account works on any device — sign in from anywhere.</span></li>
                <li><span className="auth-airy-bullets-num">03</span><span>Beta: payments are simulated, so no real money moves yet.</span></li>
              </ul>
            </div>
          </aside>

          {/* Form card */}
          <section className="auth-airy-form">
            <div className="airy-card auth-airy-form-card">
              <div className="airy-stack">
                <div className="airy-eyebrow">Create account</div>
                <h2 className="airy-h-section">Sign up as a {role}.</h2>

                <div className="auth-airy-tab" role="tablist" aria-label="Account type">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={role === 'creator'}
                    className={role === 'creator' ? 'is-on' : ''}
                    onClick={() => setRole('creator')}
                  >
                    I&apos;m a creator
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={role === 'brand'}
                    className={role === 'brand' ? 'is-on' : ''}
                    onClick={() => setRole('brand')}
                  >
                    I&apos;m a brand
                  </button>
                </div>

                <form className="auth-airy-fields" onSubmit={submit} noValidate aria-describedby={err ? 'signup-error' : undefined}>
                  {role === 'brand' ? (
                    <>
                      <div className="field">
                        <label htmlFor="signup-brandName" className="field-label">Brand name</label>
                        <input id="signup-brandName" autoComplete="organization" value={brandName} onChange={(e) => setBrandName(e.target.value)} placeholder="Aesop" required />
                      </div>
                      <div className="field">
                        <label htmlFor="signup-name-brand" className="field-label">Your name</label>
                        <input id="signup-name-brand" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Hannah Lee" required />
                      </div>
                      <div className="field">
                        <label htmlFor="signup-industry" className="field-label">Industry</label>
                        <input id="signup-industry" value={industry} onChange={(e) => setIndustry(e.target.value)} placeholder="Beauty / Personal care" />
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="field">
                        <label htmlFor="signup-name-creator" className="field-label">Your name</label>
                        <input id="signup-name-creator" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Sarah Johnson" required />
                      </div>
                      <div className="form-grid">
                        <div className="field">
                          <label htmlFor="signup-city" className="field-label">City</label>
                          <input id="signup-city" autoComplete="address-level2" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Lahore" />
                        </div>
                        <div className="field">
                          <label htmlFor="signup-country" className="field-label">Country</label>
                          <input id="signup-country" autoComplete="country-name" value={country} onChange={(e) => setCountry(e.target.value)} placeholder="Pakistan" />
                        </div>
                      </div>
                    </>
                  )}

                  <div className="field">
                    <label htmlFor="signup-email" className="field-label">Email</label>
                    <input
                      id="signup-email"
                      type="email"
                      autoComplete="email"
                      inputMode="email"
                      value={email}
                      onChange={(e) => { setEmail(e.target.value); if (emailErr) setEmailErr(null); }}
                      onBlur={(e) => setEmailErr(validateEmail(e.target.value))}
                      placeholder="you@example.com"
                      required
                      readOnly={finishMode}
                      aria-invalid={!!emailErr || undefined}
                      aria-describedby={emailErr ? 'signup-email-error' : undefined}
                    />
                    {emailErr && <span id="signup-email-error" className="field-error" role="alert">{emailErr}</span>}
                  </div>

                  {/* Finish-setup mode already has a credential + session
                      — asking for a password again would be wrong. */}
                  {!finishMode && (
                    <div className="field">
                      <label htmlFor="signup-password" className="field-label">Password</label>
                      <input
                        id="signup-password"
                        type="password"
                        autoComplete="new-password"
                        value={password}
                        onChange={(e) => { setPassword(e.target.value); if (passwordErr) setPasswordErr(null); }}
                        onBlur={(e) => setPasswordErr(validatePassword(e.target.value))}
                        placeholder="At least 6 characters"
                        required
                        minLength={6}
                        aria-invalid={!!passwordErr || undefined}
                        aria-describedby={passwordErr ? 'signup-password-error' : 'signup-password-help'}
                      />
                      {passwordErr ? (
                        <span id="signup-password-error" className="field-error" role="alert">{passwordErr}</span>
                      ) : (
                        <span id="signup-password-help" className="field-help">At least 6 characters.</span>
                      )}
                    </div>
                  )}

                  {err && <div id="signup-error" className="field-error" role="alert">{err}</div>}

                  <Button type="submit" loading={busy} iconRight={<Icon.arrow s={14} />}>
                    {finishMode ? 'Finish setup' : 'Create account'}
                  </Button>
                </form>

                <hr className="airy-divider" style={{ margin: 'var(--space-md) 0' }} />

                <div className="auth-airy-foot">
                  <span className="airy-meta">Already have an account?</span>
                  <Link to="/signin" className="auth-airy-foot-link">Sign in →</Link>
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
