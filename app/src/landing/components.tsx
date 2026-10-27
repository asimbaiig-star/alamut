// components.tsx — the landing's building blocks, in the portal's language.
//
// Everything here renders on the server at build time (entry-server.tsx) and
// hydrates in the browser. So: no window/localStorage at render, and anything
// that depends on the visitor (are they signed in?) happens in an effect.

import { useEffect, useState, type ReactNode } from 'react';
import { BETA_LINE, SESSION_STORAGE_KEY, SIGNUP_HREF } from './facts';
import { photoUrl, type Photo as PhotoData } from './photos';
import { BrandMarkSvg } from '@/screens/workspace-v2/BrandMark';

export type Audience = 'creators' | 'brands';

/** The portal sidebar's mark (BrandMark.tsx, the same drawing) on its ink
 *  square, beside the name in Fraunces (workspace-v2.css `.v2-brand`). */
export function Brand() {
  return (
    <span className="lx-brand">
      <span className="lx-brand-mark" aria-hidden="true"><BrandMarkSvg /></span>
      <span className="lx-brand-name">Alamut</span>
    </span>
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
        <a href="/" aria-label="Alamut home"><Brand /></a>
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

export interface Cta { href: string; label: string; id: string }

export function CtaRow({ primary, secondary }: { primary: Cta; secondary?: Cta }) {
  return (
    <div className="lx-cta-row">
      <a className="lx-btn" href={primary.href} data-cta={primary.id}>{primary.label}</a>
      {secondary && <a className="lx-btn lx-btn-line" href={secondary.href} data-cta={secondary.id}>{secondary.label}</a>}
    </div>
  );
}

export function BetaLine({ prefix }: { prefix?: string }) {
  return <p className="lx-hero-small">{prefix ? `${prefix} ` : ''}{BETA_LINE}.</p>;
}

/** A credited photograph as an <img>, cropped to `ratio`. The credit sits in
 *  the nearest caption or note; this only draws the picture. */
export function PhotoImg({ photo, width, ratio, sizes, priority }: {
  photo: PhotoData; width: number; ratio: number; sizes: string; priority?: boolean;
}) {
  // React 18 passes a lowercase attribute through but has no typed prop for it.
  const fetchPriority = priority ? ({ fetchpriority: 'high' } as Record<string, string>) : {};
  return (
    <img
      className="lx-photo-grade"
      src={photoUrl(photo.id, width, ratio)}
      srcSet={[1, 2].map((d) => `${photoUrl(photo.id, width * d, ratio)} ${d}x`).join(', ')}
      sizes={sizes}
      width={width}
      height={Math.round(width / ratio)}
      alt={photo.alt}
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
      {...fetchPriority}
    />
  );
}

/** "Photos: A, B and C on Unsplash." for the pictures in one block. */
export function Credits({ photos }: { photos: PhotoData[] }) {
  const names = [...new Set(photos.map((p) => p.by))];
  const list = names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : names[0];
  return <>Photos by {list} on Unsplash.</>;
}

export function NotYet({ items }: { items: string[] }) {
  return (
    <aside className="lx-notyet" aria-labelledby="notyet-title">
      <h3 className="lx-h3" id="notyet-title">Not live yet</h3>
      <ul>{items.map((t) => <li key={t}>{t}</li>)}</ul>
    </aside>
  );
}

/** Questions with every answer open: a visitor shouldn't have to click to
 *  read what the page already knows. */
export function Faq({ items }: { items: { q: string; a: ReactNode }[] }) {
  return (
    <div className="lx-qa">
      {items.map((it) => (
        <div key={it.q}>
          <h3>{it.q}</h3>
          <p>{it.a}</p>
        </div>
      ))}
    </div>
  );
}

export function Footer({ audience }: { audience: Audience }) {
  return (
    <footer className="lx-foot">
      <div className="lx-wrap lx-foot-inner">
        <a href="/" aria-label="Alamut home"><Brand /></a>
        <nav aria-label="Footer">
          <a href={audience === 'creators' ? '/for-brands' : '/'}>{audience === 'creators' ? 'For brands' : 'For creators'}</a>
          <a href="/creators">Browse creators</a>
          <a href="/tools/instagram-calculator">Rate calculators</a>
          <a href="/signin">Sign in</a>
          <a href="/terms">Terms</a>
          <a href="/privacy">Privacy</a>
        </nav>
        <p className="lx-foot-note">{BETA_LINE}. Photographs on this page are from Unsplash and show the kind of work, not Alamut users.</p>
      </div>
    </footer>
  );
}
