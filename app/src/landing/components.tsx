// components.tsx — the landing's building blocks, in the portal's language.
//
// Everything here renders on the server at build time (entry-server.tsx) and
// hydrates in the browser. So: no window/localStorage at render, and anything
// that depends on the visitor (are they signed in?) happens in an effect.

import { useEffect, useState, type ReactNode } from 'react';
import { BETA_LINE, SESSION_STORAGE_KEY, SIGNUP_HREF } from './facts';
import { MARKET_SOURCE_LINE, type MarketFigure } from './market';
import { FOUNDER } from './founder';
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
  // The audience switch sits at the top of the hero, where a visitor on the
  // wrong page looks first. The nav repeats it on desktop, where the nav
  // stays on screen as you scroll.
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

/** One button per screen; the second way in (the demo) is a plain link. */
export function CtaRow({ primary, secondary }: { primary: Cta; secondary?: Cta }) {
  return (
    <div className="lx-cta-row">
      <a className="lx-btn" href={primary.href} data-cta={primary.id}>{primary.label}</a>
      {secondary && <a className="lx-link lx-cta-link" href={secondary.href} data-cta={secondary.id}>{secondary.label}</a>}
    </div>
  );
}

/** "For creators | For brands", as the portal's segmented tabs. */
export function AudienceSwitch({ audience }: { audience: Audience }) {
  const tabs = [
    { aud: 'creators' as const, href: '/', label: 'For creators' },
    { aud: 'brands' as const, href: '/for-brands', label: 'For brands' },
  ];
  return (
    <nav className="lx-aud" aria-label="Who this page is for">
      {tabs.map((t) => t.aud === audience
        ? <a key={t.aud} href={t.href} aria-current="page">{t.label}</a>
        : <a key={t.aud} href={t.href} data-cta="hero-audience">{t.label}</a>)}
    </nav>
  );
}

/** On a phone, the page's one action stays in reach once the hero's own
 *  button has scrolled away. It steps aside wherever the page already shows
 *  an action (an open card, the storefront's Join, the brief's Post, the
 *  closing call), so a screen never carries two.
 *  Rendered only after hydration, so a page without JavaScript is unchanged. */
const OWN_ACTIONS = '.lx-hero .lx-cta-row, .lx-browse-detail, .lx-sf-join, .lx-brief .lx-act, .lx-final';
export function StickyCta({ cta }: { cta: Cta }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const first = document.querySelector('.lx-hero .lx-cta-row');
    if (!first || typeof IntersectionObserver === 'undefined') return;
    const inView = new Set<Element>();
    let past = false;
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) inView.add(e.target); else inView.delete(e.target);
        if (e.target === first) past = !e.isIntersecting && e.boundingClientRect.top < 0;
      }
      setShow(past && inView.size === 0);
    });
    document.querySelectorAll(OWN_ACTIONS).forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
  if (!show) return null;
  return (
    <div className="lx-sticky">
      <a className="lx-btn" href={cta.href} data-cta={cta.id}>{cta.label}</a>
    </div>
  );
}

export function BetaLine({ prefix }: { prefix?: string }) {
  return <p className="lx-hero-small">{prefix ? `${prefix} ` : ''}{BETA_LINE}.</p>;
}

/** A credited photograph as an <img>, cropped to `ratio`. The credit sits in
 *  the nearest caption or note; this only draws the picture. */
export function PhotoImg({ photo, width, ratio, sizes, priority, eager }: {
  photo: PhotoData; width: number; ratio: number; sizes: string; priority?: boolean; eager?: boolean;
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
      loading={priority || eager ? 'eager' : 'lazy'}
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

/** Three figures about the market, always with the line that says whose
 *  they are: an industry survey's, never Alamut's (market.ts). */
export function MarketStrip({ title, figures }: { title: string; figures: MarketFigure[] }) {
  return (
    <section className="lx-market" aria-labelledby="market-title">
      <div className="lx-wrap">
        <h2 className="lx-market-title" id="market-title">{title}</h2>
        <ul className="lx-market-list">
          {figures.map((f) => (
            <li key={f.figure + f.claim}>
              <span className="lx-money lx-market-figure">{f.figure}</span>
              <span className="lx-market-claim">{f.claim}</span>
            </li>
          ))}
        </ul>
        <p className="lx-market-source">{MARKET_SOURCE_LINE}</p>
      </div>
    </section>
  );
}

/** The founder's note (founder.ts). Renders nothing until it's marked ready. */
export function FounderNote() {
  if (!FOUNDER.ready) return null;
  const initials = FOUNDER.name.split(/\s+/).filter((w) => /^\p{L}/u.test(w)).map((w) => w[0]).join('').slice(0, 2);
  return (
    <section className="lx-section lx-founder" aria-labelledby="founder-title">
      <div className="lx-wrap lx-founder-grid">
        <div className="lx-founder-who">
          {FOUNDER.photo
            ? <img className="lx-founder-photo" src={FOUNDER.photo} alt={FOUNDER.name} width={96} height={96} loading="lazy" decoding="async" />
            : <span className="lx-founder-photo" aria-hidden="true">{initials}</span>}
          <div><b>{FOUNDER.name}</b><span>{FOUNDER.role}, Alamut</span></div>
        </div>
        <div className="lx-founder-note">
          <h2 className="lx-h2" id="founder-title">{FOUNDER.title}</h2>
          {FOUNDER.paragraphs.map((p) => <p key={p}>{p}</p>)}
        </div>
      </div>
    </section>
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
