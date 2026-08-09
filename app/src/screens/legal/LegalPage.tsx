// LegalPage.tsx — Terms of Service + Privacy Policy (Phase A · F17).
//
// Plain-language beta terms. Deliberately honest about what Alamut is
// right now: a public beta where payments are SIMULATED. No fake
// legalese, no promises the product doesn't keep — the copy here must
// stay in sync with what the app actually does. Contact address
// matches the Cover footer (hello@alamut.co).
//
// Both pages share one layout so they stay visually consistent with
// the airy auth surfaces.

import { Link } from 'react-router-dom';
import { useEffect } from 'react';
import { Logo } from '@/components/ui/Logo';
import { TileHalo } from '@/components/layout/TileHalo';

const LAST_UPDATED = '8 August 2026';
const CONTACT = 'hello@alamut.co';

function LegalShell({ title, children }: { title: string; children: React.ReactNode }) {
  useEffect(() => {
    document.title = `${title} · Alamut`;
    window.scrollTo(0, 0);
  }, [title]);
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
      <main className="airy-section" style={{ maxWidth: 720, margin: '0 auto', padding: 'var(--space-xl) var(--space-lg)' }}>
        <div className="airy-stack-lg">
          <div>
            <div className="airy-eyebrow">Alamut · Beta</div>
            <h1 className="airy-h-display">{title}</h1>
            <p className="airy-meta">Last updated: {LAST_UPDATED}</p>
          </div>
          <div className="airy-stack" style={{ lineHeight: 1.65 }}>
            {children}
          </div>
          <p className="airy-meta">
            Questions? Email <a href={`mailto:${CONTACT}`}>{CONTACT}</a>. See also{' '}
            <Link to="/terms">Terms of Service</Link> · <Link to="/privacy">Privacy Policy</Link>.
          </p>
        </div>
      </main>
    </div>
  );
}

export function TermsPage() {
  return (
    <LegalShell title="Terms of Service">
      <h2 className="airy-h-section">What Alamut is (and isn't) right now</h2>
      <p>
        Alamut is a marketplace where brands and creators plan collaborations:
        brands post briefs, creators apply and negotiate, content gets
        reviewed and approved, and the deal is tracked end to end. Alamut is
        currently in <strong>public beta</strong>.
      </p>
      <p>
        <strong>Payments on Alamut are simulated during the beta.</strong>{' '}
        Wallet balances, escrow, fees, and payouts are play-money mechanics
        that demonstrate how the product will work. No real money moves
        through Alamut, no payment card or bank account is charged or
        credited, and no balance shown in the product is a claim you can
        redeem. Do not treat any number in the app as real funds.
      </p>
      <p>
        Parts of the marketplace are populated with <strong>demo brands,
        creators, and campaigns</strong> so you can explore a working
        product. Demo participants won't respond to real outreach.
      </p>

      <h2 className="airy-h-section">Your account</h2>
      <p>
        You need an account to use the workspace. Keep your credentials to
        yourself and tell us if you think your account has been compromised.
        You must be old enough to form a contract where you live (and at
        least 16). During the beta we may reset, suspend, or remove accounts
        and data as we develop the product — we'll be thoughtful about it,
        but treat the beta as a living system, not permanent storage.
      </p>

      <h2 className="airy-h-section">Your content</h2>
      <p>
        Content you upload (portfolio work, drafts, submissions, messages)
        stays yours. You give Alamut permission to store and display it so
        the product can work — for example showing your storefront to
        brands. Don't upload content you don't have the right to share, and
        don't use Alamut for anything unlawful, deceptive, or abusive.
        Misrepresenting your audience metrics to brands is a breach of these
        terms.
      </p>

      <h2 className="airy-h-section">Deals between brands and creators</h2>
      <p>
        Alamut provides the workspace where deals are negotiated and
        tracked, but the collaboration itself is between the brand and the
        creator. During the beta — with payments simulated — any real-world
        exchange of money or product between you and a counterparty happens
        outside Alamut and is your own arrangement.
      </p>

      <h2 className="airy-h-section">No warranty · beta software</h2>
      <p>
        Alamut is provided as-is, without warranties of any kind. Things
        will occasionally break, change, or disappear while we build. To the
        extent the law allows, Alamut isn't liable for losses arising from
        use of the beta.
      </p>

      <h2 className="airy-h-section">Changes</h2>
      <p>
        We'll update these terms as the product grows — most importantly
        when real payments launch, which will come with substantially
        expanded terms. Material changes will be announced in the product.
        Continuing to use Alamut after a change means you accept the updated
        terms.
      </p>
    </LegalShell>
  );
}

export function PrivacyPage() {
  return (
    <LegalShell title="Privacy Policy">
      <h2 className="airy-h-section">What we collect</h2>
      <p>
        When you create an account we collect your email address, your
        password (handled by our authentication provider — we never see or
        store it in plain text), and the profile details you choose to enter:
        name, city, bio, social handles, follower and engagement figures,
        rates, portfolio content, and messages you send in the product.
      </p>
      <p>
        <strong>We do not collect payment card numbers or bank account
        details.</strong> Payments are simulated during the beta, so there is
        nothing to collect.
      </p>

      <h2 className="airy-h-section">Where it lives</h2>
      <p>
        Account and profile data is stored with{' '}
        <a href="https://supabase.com" target="_blank" rel="noreferrer">Supabase</a>{' '}
        (our database and authentication provider) on hosted cloud
        infrastructure. Some working data is also kept in your own browser's
        local storage so the app stays fast; clearing your browser data
        removes that local copy.
      </p>

      <h2 className="airy-h-section">How we use it</h2>
      <p>
        To run the product: showing your storefront to brands, matching
        briefs to creators, delivering messages and notifications, and
        sending account emails (confirmation, password reset). We use{' '}
        privacy-respecting page-view analytics (Vercel Analytics) to
        understand aggregate usage — no advertising trackers, no selling or
        renting your data to anyone.
      </p>

      <h2 className="airy-h-section">What's visible to others</h2>
      <p>
        Your creator storefront (name, handle, bio, rates, portfolio,
        reviews, and the audience figures you enter) is visible to signed-in
        brands, and — if you share your public link — to anyone with it.
        Messages are visible to the conversation's participants. Your email
        address is never shown publicly.
      </p>

      <h2 className="airy-h-section">Deletion & your choices</h2>
      <p>
        Email <a href="mailto:hello@alamut.co">hello@alamut.co</a> from your
        account address and we'll delete your account and associated data.
        During the beta some residual data may persist in backups for a
        limited period before rolling off.
      </p>

      <h2 className="airy-h-section">Changes</h2>
      <p>
        If our data practices change — especially when real payments launch,
        which will involve payment and identity providers — we'll update
        this policy and flag it in the product.
      </p>
    </LegalShell>
  );
}
