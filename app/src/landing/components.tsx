// components.tsx — the landing's building blocks.
//
// Everything here renders on the server at build time (entry-server.tsx) and
// hydrates in the browser. So: no window/localStorage at render, and anything
// that depends on the visitor (are they signed in?) happens in an effect.

import { useEffect, useState, type ReactNode } from 'react';
import { SESSION_STORAGE_KEY, SIGNUP_HREF, BETA_LINE } from './facts';
import { photoUrl, type Photo as PhotoData } from './photos';

export type Audience = 'creators' | 'brands';

export function Mark() {
  // The favicon's mark (index.html), so the tab and the page agree.
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="7" fill="#d42a22" />
      <path d="M16 7.5 L23.5 24.5 H19.6 L16 15.6 L12.4 24.5 H8.5 Z" fill="#fff" />
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
      // Unreadable storage reads as signed out, the safe default.
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

export function CtaRow({ primary, secondary }: { primary: Cta; secondary?: Cta }) {
  return (
    <div className="lx-cta-row">
      <a className="lx-btn" href={primary.href} data-cta={primary.id}>{primary.label} <Arrow /></a>
      {secondary && (
        <a className="lx-btn-quiet" href={secondary.href} data-cta={secondary.id}>{secondary.label}</a>
      )}
    </div>
  );
}

/** Which side of the marketplace this page is for, and the way to the other. */
export function AudienceSwitch({ audience }: { audience: Audience }) {
  return (
    <nav className="lx-switch" aria-label="Choose your side">
      {audience === 'creators'
        ? <><span aria-current="page">For creators</span><a href="/for-brands" data-cta="hero-audience">For brands</a></>
        : <><a href="/" data-cta="hero-audience">For creators</a><span aria-current="page">For brands</span></>}
    </nav>
  );
}

const WIDTHS = [480, 720, 960, 1280, 1600];

/** A credited photograph, cropped to `ratio`. The hero one loads first. */
export function Photo({ photo, ratio, sizes, priority, className }: {
  photo: PhotoData; ratio: number; sizes: string; priority?: boolean; className?: string;
}) {
  // React 18 passes a lowercase attribute through but has no typed prop for it.
  const fetchPriority = priority ? ({ fetchpriority: 'high' } as Record<string, string>) : {};
  return (
    <figure className={className ? `lx-photo ${className}` : 'lx-photo'}>
      <div className="lx-photo-frame" style={{ ['--ar' as string]: String(ratio) }}>
        <img
          src={photoUrl(photo.id, 1280, ratio)}
          srcSet={WIDTHS.map((w) => `${photoUrl(photo.id, w, ratio)} ${w}w`).join(', ')}
          sizes={sizes}
          width={1280}
          height={Math.round(1280 / ratio)}
          alt={photo.alt}
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          {...fetchPriority}
        />
      </div>
      <figcaption>
        {photo.caption} Photo by <a href={photo.page} rel="noopener">{photo.by}</a> on Unsplash.
      </figcaption>
    </figure>
  );
}

export function NotYet({ items }: { items: string[] }) {
  return (
    <aside className="lx-notyet" aria-labelledby="notyet-title">
      <h3 className="lx-h3" id="notyet-title">Not live yet</h3>
      <ul>{items.map((t) => <li key={t}>{t}</li>)}</ul>
    </aside>
  );
}

/** Questions with every answer open. A visitor shouldn't have to click to
 *  read what the page already knows. */
export function Faq({ items }: { items: { q: string; a: ReactNode }[] }) {
  return (
    <div className="lx-qa">
      {items.map((it) => (
        <div key={it.q}>
          <h3 className="lx-h3">{it.q}</h3>
          <p>{it.a}</p>
        </div>
      ))}
    </div>
  );
}

export function Footer({ audience }: { audience: Audience }) {
  return (
    <footer className="lx-foot">
      <div className="lx-wrap">
        <div className="lx-foot-top">
          <span>{BETA_LINE}</span>
          <nav aria-label="Footer">
            <a href={audience === 'creators' ? '/for-brands' : '/'}>{audience === 'creators' ? 'For brands' : 'For creators'}</a>
            <a href="/tools/instagram-calculator">Rate calculators</a>
            <a href="/signin">Sign in</a>
            <a href="/terms">Terms</a>
            <a href="/privacy">Privacy</a>
          </nav>
        </div>
        <p className="lx-wordmark" aria-hidden="true">Alamut</p>
      </div>
    </footer>
  );
}
