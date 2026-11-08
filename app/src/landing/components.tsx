// components.tsx — the landing's building blocks, in the portal's language.
//
// Everything here renders on the server at build time (entry-server.tsx) and
// hydrates in the browser. So: no window/localStorage at render, and anything
// that depends on the visitor (are they signed in?) happens in an effect.

import { Fragment, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { BETA_LINE, SESSION_STORAGE_KEY, SIGNUP_HREF } from './facts';
import { MARKET_SOURCE_LINE, type MarketFigure } from './market';
import { FOUNDER } from './founder';
import { PHOTO_WIDTHS, PHOTOS, photoSrc, photoSrcSet, type Photo as PhotoData } from './photos';
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

export interface PageLink { href: string; label: string }

/** Where you are on a long page: the sections, with a pill that slides to the
 *  one on screen. Only on desktop, where the nav stays with you. */
function SectionNav({ links }: { links: PageLink[] }) {
  const [on, setOn] = useState(-1);
  const [pill, setPill] = useState<CSSProperties>({ opacity: 0 });
  const bar = useRef<HTMLElement>(null);
  useEffect(() => {
    const marks = links.map((l) => document.querySelector(l.href));
    let frame = 0;
    const read = () => {
      frame = 0;
      let at = -1;
      marks.forEach((m, i) => { if (m && m.getBoundingClientRect().top < window.innerHeight * 0.45) at = i; });
      setOn(at);
    };
    const onScroll = () => { frame ||= requestAnimationFrame(read); };
    read();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => { cancelAnimationFrame(frame); window.removeEventListener('scroll', onScroll); };
  }, [links]);
  useEffect(() => {
    const a = bar.current?.querySelectorAll('a')[on] as HTMLElement | undefined;
    setPill(a ? { opacity: 1, width: `${a.offsetWidth}px`, transform: `translateX(${a.offsetLeft}px)` } : { opacity: 0 });
  }, [on]);
  return (
    <nav className="lx-secnav" aria-label="On this page" ref={bar}>
      <span className="lx-secnav-pill" style={pill} aria-hidden="true" />
      {links.map((l, i) => <a key={l.href} href={l.href} aria-current={i === on ? 'true' : undefined} data-cta={`nav-${l.href.slice(4)}`}>{l.label}</a>)}
    </nav>
  );
}

export function Nav({ audience, sections }: { audience: Audience; sections: PageLink[] }) {
  const signedIn = useSignedIn();
  const cta = audience === 'creators'
    ? { href: SIGNUP_HREF.creator, label: 'Join free', id: 'nav-join' }
    : { href: SIGNUP_HREF.brand, label: 'Post a brief', id: 'nav-post' };
  // A sheet of paper floating over whatever ground is under it, so it reads
  // the same on every colour. The audience switch rides in it on desktop,
  // where the nav stays on screen; a phone has it at the top of the hero.
  return (
    <header className="lx-nav">
      <div className="lx-wrap">
        <div className="lx-nav-inner">
        <a href="/" aria-label="Alamut home"><Brand /></a>
        <AudienceTabs audience={audience} cta="nav-audience" className="lx-seg" />
        <SectionNav links={sections} />
        <nav className="lx-nav-links" aria-label="Main">
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
function AudienceTabs({ audience, cta, className }: { audience: Audience; cta: string; className: string }) {
  const tabs = [
    { aud: 'creators' as const, href: '/', label: 'For creators' },
    { aud: 'brands' as const, href: '/for-brands', label: 'For brands' },
  ];
  return (
    <nav className={className} aria-label="Who this page is for">
      {tabs.map((t) => t.aud === audience
        ? <a key={t.aud} href={t.href} aria-current="page">{t.label}</a>
        : <a key={t.aud} href={t.href} data-cta={cta}>{t.label}</a>)}
    </nav>
  );
}

/** The same tabs at the top of a phone's hero, where a visitor on the wrong
 *  page looks first. */
export function AudienceSwitch({ audience }: { audience: Audience }) {
  return <AudienceTabs audience={audience} cta="hero-audience" className="lx-aud" />;
}

/** On a phone, the page's one action stays in reach once the hero's own
 *  button has scrolled away. It steps aside wherever the page already shows
 *  an action (an open card, the storefront's Join, the brief's Post, the
 *  closing call), so a screen never carries two.
 *  Rendered only after hydration, so a page without JavaScript is unchanged. */
const OWN_ACTIONS = '.lx-hero .lx-cta-row, .lx-slot, .lx-sf-join, .lx-brief .lx-act, .lx-final';
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

/** A done thing, checked: the hero's promises and what the workspace does. */
export function CheckMark() {
  return <svg className="lx-check" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M4 8.4 6.7 11 12 5.4" /></svg>;
}

/** The hero's promises, each one the pricing section and the FAQ keep. */
export function Promises({ items }: { items: string[] }) {
  return (
    <div className="lx-promises">
      <ul>
        {items.map((t) => (
          <li key={t}><CheckMark />{t}</li>
        ))}
      </ul>
    </div>
  );
}

/** A credited photograph as an <img>, in a `width` × `width / ratio` box that
 *  crops it. The credit sits in the nearest caption or note; this only draws
 *  the picture. */
export function PhotoImg({ photo, width, ratio, sizes, priority, eager, decorative }: {
  photo: PhotoData; width: number; ratio: number; sizes: string; priority?: boolean; eager?: boolean; decorative?: boolean;
}) {
  // React 18 passes a lowercase attribute through but has no typed prop for it.
  const fetchPriority = priority ? ({ fetchpriority: 'high' } as Record<string, string>) : {};
  return (
    <img
      className="lx-photo-grade"
      src={photoSrc(photo, PHOTO_WIDTHS.find((w) => w >= width) ?? 1600)}
      srcSet={photoSrcSet(photo)}
      sizes={sizes}
      width={width}
      height={Math.round(width / ratio)}
      alt={decorative ? '' : photo.alt}
      loading={priority || eager ? 'eager' : 'lazy'}
      decoding="async"
      {...fetchPriority}
      style={photo.focus ? { objectPosition: `${photo.focus[0]}% ${photo.focus[1]}%` } : undefined}
    />
  );
}

/** "Photos: A, B and C on Unsplash." for the pictures in one block. */
export function Credits({ photos }: { photos: PhotoData[] }) {
  const names = [...new Set(photos.map((p) => p.by))];
  const list = names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : names[0];
  return <>Photos by {list} on Unsplash.</>;
}

/** One sentence, word by word, so it can ink in as it's read: `--p` is how
 *  far through the sentence a word sits. */
function Sentence({ f }: { f: MarketFigure }) {
  const words = [...f.before.split(' ').filter(Boolean), f.figure, ...f.after.split(' ')];
  return (
    <>
      {words.map((w, i) => {
        const style = { '--p': (i / words.length).toFixed(3) } as CSSProperties;
        return (
          <Fragment key={i}>
            {w === f.figure ? <b className="lx-market-figure lx-w" style={style}>{w}</b> : <span className="lx-w" style={style}>{w}</span>}{' '}
          </Fragment>
        );
      })}
    </>
  );
}

/** Three figures about the market, always with the line that says whose
 *  they are: an industry survey's, never Alamut's (market.ts). */
export function MarketStrip({ title, figures }: { title: string; figures: MarketFigure[] }) {
  return (
    <section className="lx-market lx-dark" aria-labelledby="market-title">
      <div className="lx-wrap">
        <h2 className="lx-market-title" id="market-title">{title}</h2>
        <ul className="lx-market-list">
          {figures.map((f) => <li key={f.figure + f.after}><Sentence f={f} /></li>)}
        </ul>
        <p className="lx-market-source">{MARKET_SOURCE_LINE}</p>
      </div>
    </section>
  );
}

/** A rubber stamp, slammed on paper when a step is done. Decoration: the same
 *  word is always in the text beside it. */
export function Stamp({ children, tone }: { children: string; tone?: 'accent' }) {
  return <span className={tone ? `lx-stamp ${tone}` : 'lx-stamp'} aria-hidden="true">{children}</span>;
}

/** The niches, set huge with the work itself between the words, drifting in
 *  opposite directions and carried along by the scroll. Each line runs twice
 *  so the drift never reaches an end; the copy is hidden from screen readers. */
const REEL: [string, PhotoData][][] = [
  [['Beauty', PHOTOS.makeupTutorial], ['Food', PHOTOS.foodTutorial], ['Fitness', PHOTOS.dumbbells], ['Fashion', PHOTOS.pinkBlue]],
  [['Tech', PHOTOS.cameraRed], ['Travel', PHOTOS.sunsetGimbal], ['Parenting', PHOTOS.canalSelfie], ['Finance', PHOTOS.podcastMic]],
];
function ReelRun({ line, hidden }: { line: [string, PhotoData][]; hidden?: boolean }) {
  return (
    <ul className="lx-reel-run" aria-hidden={hidden || undefined}>
      {line.map(([name, photo]) => (
        <li key={name}>
          <span>{name}</span>
          <i><PhotoImg photo={photo} width={300} ratio={300 / 134} sizes="300px" decorative /></i>
        </li>
      ))}
    </ul>
  );
}
export function Reel() {
  // Anything that moves on its own for this long needs a way to stop it.
  const [paused, setPaused] = useState(false);
  return (
    <section className="lx-reel lx-dark" data-sheet data-paused={paused || undefined} aria-label="Some of the niches on Alamut">
      {REEL.map((line, i) => (
        <div className="lx-reel-line" key={i}>
          <div className="lx-reel-track"><ReelRun line={line} /><ReelRun line={line} hidden /></div>
        </div>
      ))}
      <div className="lx-wrap lx-reel-foot">
        <p className="lx-reel-cap">
          Some of the niches on Alamut. Photographs show the kind of work, not Alamut users. <Credits photos={REEL.flat().map(([, p]) => p)} />
        </p>
        <button type="button" className="lx-reel-btn" aria-pressed={paused} onClick={() => setPaused((p) => !p)}>{paused ? 'Play' : 'Pause'}</button>
      </div>
    </section>
  );
}

/** The close: the pile comes back as prints, fanned along the bottom edge. */
const FAN: [PhotoData, number][] = [[PHOTOS.makeupTutorial, -13], [PHOTOS.foodTutorial, -7], [PHOTOS.cameraRed, -3], [PHOTOS.pinkBlue, 3], [PHOTOS.sunsetGimbal, 7], [PHOTOS.dumbbells, 13]];
export function PrintFan() {
  return (
    <div className="lx-fan" aria-hidden="true">
      {FAN.map(([photo, turn], i) => (
        <figure key={photo.id} style={{ '--turn': `${turn}deg`, '--i': String(i) } as CSSProperties}>
          <PhotoImg photo={photo} width={270} ratio={270 / 230} sizes="270px" decorative />
        </figure>
      ))}
    </div>
  );
}

/** The founder's note (founder.ts). Renders nothing until it's marked ready. */
export function FounderNote() {
  if (!FOUNDER.ready) return null;
  const initials = FOUNDER.name.split(/\s+/).filter((w) => /^\p{L}/u.test(w)).map((w) => w[0]).join('').slice(0, 2);
  return (
    <section className="lx-sheet lx-founder" data-sheet aria-labelledby="founder-title">
      <div className="lx-wrap lx-founder-grid">
        <div className="lx-founder-who">
          {FOUNDER.photo
            ? <img className="lx-founder-photo" src={FOUNDER.photo} alt={FOUNDER.name} width={96} height={96} loading="lazy" decoding="async" />
            : <span className="lx-founder-photo" aria-hidden="true">{initials}</span>}
          <div><b>{FOUNDER.name}</b><span>{FOUNDER.role}, Alamut</span></div>
        </div>
        <div className="lx-founder-note">
          <h2 className="lx-h2 sm" id="founder-title">{FOUNDER.title}</h2>
          {FOUNDER.paragraphs.map((p) => <p key={p}>{p}</p>)}
        </div>
      </div>
    </section>
  );
}

/** What isn't built yet, said as what's next: the honest list of what the
 *  product doesn't do today. */
export function NotYet({ items }: { items: string[] }) {
  return (
    <aside className="lx-notyet" aria-labelledby="notyet-title">
      <div className="lx-notyet-head">
        <h3 className="lx-h3" id="notyet-title">Coming next</h3>
        <span className="lx-pill lx-pill-beta">Public beta</span>
      </div>
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
        <div key={it.q} className="lx-qa-row">
          <h3>{it.q}</h3>
          <p>{it.a}</p>
        </div>
      ))}
    </div>
  );
}

export function Footer({ audience }: { audience: Audience }) {
  return (
    <footer className="lx-foot lx-dark">
      <div className="lx-wrap lx-foot-inner">
        <p className="lx-foot-note">{BETA_LINE}. Photographs on this page are from Unsplash and show the kind of work, not Alamut users.</p>
        <nav aria-label="Footer">
          <a href={audience === 'creators' ? '/for-brands' : '/'}>{audience === 'creators' ? 'For brands' : 'For creators'}</a>
          <a href="/creators">Browse creators</a>
          <a href="/tools/instagram-calculator">Rate calculators</a>
          <a href="/signin">Sign in</a>
          <a href="/terms">Terms</a>
          <a href="/privacy">Privacy</a>
        </nav>
      </div>
    </footer>
  );
}
