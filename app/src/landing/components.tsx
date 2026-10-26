// components.tsx — the landing's building blocks.
//
// Everything here renders on the server at build time (entry-server.tsx) and
// hydrates in the browser. So: no window/localStorage at render, and anything
// that depends on the visitor (are they signed in?) happens in an effect.

import { useEffect, useState, type ReactNode } from 'react';
import { SESSION_STORAGE_KEY, SIGNUP_HREF, BETA_LINE } from './facts';

export type Audience = 'creators' | 'brands';

export function Mark() {
  // The favicon's mark (index.html), so the tab and the page agree.
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="7" fill="oklch(0.52 0.13 40)" />
      <path d="M16 7.5 L23.5 24.5 H19.6 L16 15.6 L12.4 24.5 H8.5 Z" fill="#FBF7EE" />
    </svg>
  );
}

/** True once we know the visitor has a stored Supabase session. Reads the
 *  key supabase-js writes rather than loading supabase-js. */
function useSignedIn(): boolean {
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(SESSION_STORAGE_KEY);
      if (!raw) return;
      const s = JSON.parse(raw) as { refresh_token?: string; expires_at?: number } | null;
      setSignedIn(!!s && (!!s.refresh_token || (s.expires_at ?? 0) * 1000 > Date.now()));
    } catch {
      // Unreadable storage reads as signed out — the safe default.
    }
  }, []);
  return signedIn;
}

export function Nav({ audience }: { audience: Audience }) {
  const signedIn = useSignedIn();
  const other = audience === 'creators'
    ? { href: '/for-brands', label: 'For brands' }
    : { href: '/', label: 'For creators' };
  const cta = audience === 'creators'
    ? { href: SIGNUP_HREF.creator, label: 'Join free', id: 'nav-join' }
    : { href: SIGNUP_HREF.brand, label: 'Post a brief', id: 'nav-post' };
  return (
    <header className="lx-nav">
      <div className="lx-wrap lx-nav-inner">
        <a className="lx-brand" href="/" aria-label="Alamut home"><Mark />Alamut</a>
        <nav className="lx-nav-links" aria-label="Main">
          <a className="lx-nav-link lx-nav-aud" href={other.href} data-cta="nav-audience">{other.label}</a>
          {signedIn ? (
            <a className="lx-btn lx-btn-sm" href="/v2" data-cta="nav-workspace">Open workspace</a>
          ) : (
            <>
              <a className="lx-nav-link" href="/signin" data-cta="nav-signin">Sign in</a>
              <a className="lx-btn lx-btn-sm" href={cta.href} data-cta={cta.id}>{cta.label}</a>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}

export function Arrow() {
  return <span className="lx-arrow" aria-hidden="true">→</span>;
}

export interface Cta { href: string; label: string; id: string }

export function CtaRow({ primary, secondary, center = true }: { primary: Cta; secondary?: Cta; center?: boolean }) {
  return (
    <div className={center ? 'lx-cta-row' : 'lx-after'}>
      <a className="lx-btn" href={primary.href} data-cta={primary.id}>{primary.label}</a>
      {secondary && (
        <a className="lx-btn-quiet" href={secondary.href} data-cta={secondary.id}>
          {secondary.label} <Arrow />
        </a>
      )}
    </div>
  );
}

export function Beta() {
  return <p className="lx-beta">{BETA_LINE}</p>;
}

export function Section({ id, kicker, title, lead, center, children }: {
  id?: string; kicker: string; title: ReactNode; lead?: ReactNode; center?: boolean; children: ReactNode;
}) {
  return (
    <section className="lx-section" id={id} aria-labelledby={id ? `${id}-title` : undefined}>
      <div className="lx-wrap">
        <div className={`lx-section-head${center ? ' center' : ''}`}>
          <p className="lx-kicker">{kicker}</p>
          <h2 className="lx-h2" id={id ? `${id}-title` : undefined}>{title}</h2>
          {lead && <p className="lx-lead">{lead}</p>}
        </div>
        {children}
      </div>
    </section>
  );
}

export function Feature({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <div className="lx-feat">
      <div className="lx-feat-ico" aria-hidden="true">{icon}</div>
      <h3 className="lx-h3">{title}</h3>
      <p>{children}</p>
    </div>
  );
}

export function NotYet({ items }: { items: string[] }) {
  return (
    <div className="lx-notyet">
      <p className="lx-kicker">Not live yet</p>
      <ul>
        {items.map((t) => (
          <li key={t}><span className="lx-pill">Not yet</span><span>{t}</span></li>
        ))}
      </ul>
    </div>
  );
}

export function Faq({ items }: { items: { q: string; a: ReactNode }[] }) {
  return (
    <div className="lx-faq">
      {items.map((it) => (
        <details key={it.q}>
          <summary>{it.q}</summary>
          <p>{it.a}</p>
        </details>
      ))}
    </div>
  );
}

export function Footer({ audience }: { audience: Audience }) {
  return (
    <footer className="lx-foot">
      <div className="lx-wrap lx-foot-inner">
        <a className="lx-brand" href="/"><Mark />Alamut</a>
        <nav aria-label="Footer">
          <a href={audience === 'creators' ? '/for-brands' : '/'}>{audience === 'creators' ? 'For brands' : 'For creators'}</a>
          <a href="/tools/instagram-calculator">Rate calculators</a>
          <a href="/signin">Sign in</a>
          <a href="/terms">Terms</a>
          <a href="/privacy">Privacy</a>
        </nav>
        <span>{BETA_LINE}</span>
      </div>
    </footer>
  );
}

/* ── Icons — single-stroke, 24px grid, currentColor ───────────────────── */
const ico = (d: string) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);
export const Icons = {
  check: ico('M5 12.5l4.2 4.2L19 7'),
  lock: ico('M7 11V8a5 5 0 0110 0v3M5.5 11h13v9h-13z'),
  tag: ico('M3.5 12.2V4h8.2l8.8 8.8-8.2 8.2zM8 8.5h.01'),
  swap: ico('M7 7h12l-3-3M17 17H5l3 3'),
  eye: ico('M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12zM12 14.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z'),
  scale: ico('M12 4v16M5 20h14M5 8l-2.5 6h5zM19 8l-2.5 6h5zM5 8h14'),
  doc: ico('M7 3.5h7l4 4V20.5H7zM14 3.5v4h4M9.5 12h5M9.5 15.5h5'),
  users: ico('M9 11a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM2.5 20a6.5 6.5 0 0113 0M16 4.5a3.5 3.5 0 010 6.5M18.5 20a6.5 6.5 0 00-3-5.4'),
  clock: ico('M12 21a9 9 0 100-18 9 9 0 000 18zM12 7.5V12l3 2'),
  chat: ico('M4 5.5h16v10H9l-5 4z'),
  layers: ico('M12 3l9 5-9 5-9-5zM3 13l9 5 9-5'),
};
