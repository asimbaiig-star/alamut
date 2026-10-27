// Sign up — on the v2 surface, between the landing pages and the workspace,
// so it uses their tokens, mark and components (styles/auth-v2.css).
// Form logic unchanged: role tabs, conditional fields per role, validation,
// email confirmation, post-signup navigation.

import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api, ApiError } from '@/lib/api/client';
import { pushToast } from '@/lib/utils/toast';
import { BrandMarkSvg } from '@/screens/workspace-v2/BrandMark';
import { readBriefDraft, readStorefrontDraft } from '@/lib/landingDraft';
import { BRAND_SETUP, CREATOR_SETUP } from '@/landing/facts';
import '@/styles/auth-v2.css';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function SignUp() {
  const [params] = useSearchParams();
  const initialRole = (params.get('role') as 'creator' | 'brand') || 'creator';
  const [role, setRole] = useState<'creator' | 'brand'>(initialRole);

  // Finish-setup mode (`?finish=1&email=…`): the visitor already has a
  // confirmed Supabase account + live session but no Creator/Brand row.
  // Same form, but we skip auth sign-up and only write the profile.
  const finishMode = params.get('finish') === '1';
  // P-12 — in finish-setup mode we don't know which role the account
  // originally signed up as (these are accounts predating sign-up
  // metadata), so the tab defaulted to 'creator' and a recovering BRAND
  // was greeted with "Build a body of real work". Neutralise the hero
  // copy in that mode and make the role choice the explicit first step.
  const finishEmail = params.get('email') ?? '';

  // What the visitor built on the landing and chose to keep (landingDraft.ts):
  // a storefront brings its name along, and both are named back to them here
  // so they can see it wasn't lost on the way.
  const [kept] = useState(() => (finishMode ? null : {
    storefront: readStorefrontDraft(window.localStorage),
    brief: readBriefDraft(window.localStorage),
  }));
  const [name, setName] = useState(() => (initialRole === 'creator' ? kept?.storefront?.name : '') ?? '');
  const [email, setEmail] = useState(finishMode ? finishEmail : '');
  const [password, setPassword] = useState('');
  const [brandName, setBrandName] = useState('');
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
          industry: undefined, // asked once, in brand onboarding, from its list
          // City is asked once, in onboarding, beside the country given here.
          city: undefined,
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
        industry: undefined, // asked once, in brand onboarding, from its list
        city: undefined,
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
      <div data-surface="v2" className="auth-v2">
        <header className="auth-v2-nav">
          <Link to="/" aria-label="Alamut home" className="auth-v2-brand">
            <span className="auth-v2-mark"><BrandMarkSvg /></span><span>Alamut</span>
          </Link>
          <div className="auth-v2-nav-actions"><Link to="/signin" className="auth-v2-link">Sign in</Link></div>
        </header>
        <main className="auth-v2-main">
          <section className="auth-v2-card auth-v2-form-card" style={{ maxWidth: 520, margin: '0 auto' }} aria-labelledby="confirm-title">
            <span className="auth-v2-label">One more step</span>
            <h1 className="auth-v2-h2" id="confirm-title">Confirm your email.</h1>
            <p className="auth-v2-lede">
              We sent a confirmation link to <strong>{pendingEmail}</strong>. Open it to activate your
              account, then sign in.
            </p>
            <p className="auth-v2-muted">Can't find it? Check spam. The link opens Alamut and finishes setting up your profile.</p>
            {err && <div className="field-error" role="alert">{err}</div>}
            <div className="auth-v2-demo-grid">
              <button type="button" className="auth-v2-btn" style={{ width: 'auto' }} onClick={() => navigate('/signin')}>Go to sign in</button>
              <button
                type="button"
                className="auth-v2-btn line"
                disabled={busy || resent}
                aria-busy={busy || undefined}
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
                {resent ? 'Email resent' : busy ? 'Sending…' : 'Resend email'}
              </button>
            </div>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div data-surface="v2" className="auth-v2">
      <header className="auth-v2-nav">
        <Link to="/" aria-label="Alamut home" className="auth-v2-brand">
          <span className="auth-v2-mark"><BrandMarkSvg /></span><span>Alamut</span>
        </Link>
        <div className="auth-v2-nav-actions">
          <span className="auth-v2-muted">Returning?</span>
          <Link to="/signin" className="auth-v2-link">Sign in</Link>
        </div>
      </header>

      <main className="auth-v2-main">
        <div className="auth-v2-grid">
          <aside className={`auth-v2-side auth-v2-panel ${role === 'brand' || finishMode ? 'ink' : 'moss'}`}>
            <h1 className="auth-v2-h1">
              {finishMode
                // Role-neutral: we can't know which one this account meant,
                // so don't pitch them the wrong side (P-12).
                ? 'One step to finish your account.'
                : role === 'creator'
                ? 'Open your storefront.'
                : 'Post your first brief.'}
            </h1>
            <p className="auth-v2-lede">
              {finishMode
                ? 'Your sign-in is confirmed. Tell us whether you’re here as a creator or a brand, then a few details to set up your profile.'
                : role === 'creator'
                ? 'Pitch open briefs at your own rate, or let brands find your storefront. Offers, changes and payouts stay in one workspace.'
                : 'Browse storefronts with published rates, or post a brief and let creators pitch you. Brief to payout stays in one workspace.'}
            </p>
            <ul className="auth-v2-points">
              <li>Free to sign up. No card required.</li>
              {/* Mode-agnostic: the project may or may not have email
                  confirmation switched on, and signUp branches on whether
                  Supabase returns a session. Don't promise a confirmation
                  step the user may never see. */}
              <li>{role === 'brand'
                ? 'No fee on top of the rates you agree. Money moves only when you accept an offer.'
                : 'Alamut is paid only when you are. The fee comes off a payment, never before.'}</li>
              <li>Public beta. Payments are simulated, so no real money moves yet.</li>
            </ul>
            {role === 'creator' && kept?.storefront && (
              <div className="auth-v2-kept" role="status">
                <span className="auth-v2-label">Kept from the last page</span>
                <p>
                  Your storefront{kept.storefront.handle ? <>, <b>@{kept.storefront.handle}</b></> : null}: {kept.storefront.niche},
                  Instagram Reel at ${kept.storefront.rates.reel.toLocaleString('en-US')}. It fills in your setup after you sign up.
                </p>
              </div>
            )}
            {role === 'brand' && kept?.brief && (
              <div className="auth-v2-kept" role="status">
                <span className="auth-v2-label">Kept from the last page</span>
                <p>
                  Your brief{kept.brief.title ? <>, <b>{kept.brief.title}</b></> : null}: {kept.brief.count} deliverables at
                  ${kept.brief.perCreator.toLocaleString('en-US')} per creator. It’s waiting in New campaign after you sign up.
                </p>
              </div>
            )}
            {!finishMode && (
              <p className="auth-v2-next">After this: {role === 'brand' ? BRAND_SETUP : CREATOR_SETUP}.</p>
            )}
          </aside>

          <section className="auth-v2-card auth-v2-form-card" aria-labelledby="signup-title">
            <h2 className="auth-v2-h2" id="signup-title">{finishMode ? 'Finish setting up' : 'Create your account'}</h2>

            <div className="auth-v2-tabs" role="tablist" aria-label="Account type">
              <button type="button" role="tab" aria-selected={role === 'creator'} className={role === 'creator' ? 'is-on' : ''} onClick={() => setRole('creator')}>
                I&apos;m a creator
              </button>
              <button type="button" role="tab" aria-selected={role === 'brand'} className={role === 'brand' ? 'is-on' : ''} onClick={() => setRole('brand')}>
                I&apos;m a brand
              </button>
            </div>

            <form className="auth-v2-fields" onSubmit={submit} noValidate aria-describedby={err ? 'signup-error' : undefined}>
              {role === 'brand' ? (
                <>
                  <div className="field">
                    <label htmlFor="signup-brandName" className="field-label">Brand name</label>
                    <input id="signup-brandName" autoComplete="organization" value={brandName} onChange={(e) => setBrandName(e.target.value)} placeholder="Your brand" required />
                  </div>
                  <div className="field">
                    <label htmlFor="signup-name-brand" className="field-label">Your name</label>
                    <input id="signup-name-brand" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" required />
                  </div>
                </>
              ) : (
                <>
                  <div className="field">
                    <label htmlFor="signup-name-creator" className="field-label">Your name</label>
                    <input id="signup-name-creator" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" required />
                  </div>
                  <div className="field">
                    <label htmlFor="signup-country" className="field-label">Country</label>
                    <input id="signup-country" autoComplete="country-name" value={country} onChange={(e) => setCountry(e.target.value)} placeholder="Pakistan" />
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

              <button type="submit" className="auth-v2-btn" disabled={busy} aria-busy={busy || undefined}>
                {busy ? 'Working…' : finishMode ? 'Finish setup' : 'Create account'}
              </button>
            </form>

            <p className="auth-v2-foot">Already have an account? <Link to="/signin" className="auth-v2-link">Sign in</Link></p>
          </section>
        </div>
      </main>

      <footer className="auth-v2-page-foot">© 2026 Alamut</footer>
    </div>
  );
}
