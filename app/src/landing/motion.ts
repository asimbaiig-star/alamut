// motion.ts — the movement CSS can't do on its own.
//
// Every effect here starts from a finished page: the prerendered HTML is the
// resting state, nothing waits on this file to be readable, and each effect
// is off under prefers-reduced-motion. The sheets and the deal story need
// room to work, so they run on wide screens only; phones keep the plain flow.

import { flushSync } from 'react-dom';

export const WIDE_MOTION = '(min-width: 1000px) and (prefers-reduced-motion: no-preference)';

/** Sections are sheets in a stack: each pins when its end reaches the bottom
 *  of the screen, and the next slides over it. `--stick` is how far above the
 *  top of the screen a sheet taller than the screen has to pin for that. */
export function mountSheets(): void {
  const wide = window.matchMedia(WIDE_MOTION);
  const sheets = [...document.querySelectorAll<HTMLElement>('[data-sheet]')];
  const fit = () => {
    document.documentElement.classList.toggle('lx-sheets', wide.matches);
    for (const s of sheets) s.style.setProperty('--stick', `${Math.min(0, window.innerHeight - s.offsetHeight)}px`);
  };
  fit();
  wide.addEventListener('change', fit);
  window.addEventListener('resize', fit, { passive: true });
  new ResizeObserver(fit).observe(document.body);
}

const stillPlease = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** The market's sentences ink in word by word as they rise up the screen:
 *  `--ink` runs from 0 as a line comes up from the bottom, and the CSS turns
 *  it into each word's opacity. Scroll-driven CSS can't do this here: inside a
 *  sticky sheet the browser stretches its timeline over the whole time the
 *  sheet stays pinned, so the words would barely move. */
export function mountInk(): void {
  const lines = [...document.querySelectorAll<HTMLElement>('.lx-market-list > li')];
  if (!lines.length || stillPlease()) return;
  let frame = 0;
  const read = () => {
    frame = 0;
    const h = window.innerHeight;
    for (const line of lines) {
      const ink = (h * 0.95 - line.getBoundingClientRect().top) / (h * 0.3);
      line.style.setProperty('--ink', Math.min(1.3, Math.max(0, ink)).toFixed(3));
    }
  };
  read();
  window.addEventListener('scroll', () => { frame ||= requestAnimationFrame(read); }, { passive: true });
}

/** What arrives as it comes on screen: section headings rise from behind a
 *  line, and pitches land one by one. Anything already on screen, or on a page
 *  without this file, simply stays as it is. */
export function mountArrivals(): void {
  if (stillPlease()) return;
  const waiting = [...document.querySelectorAll<HTMLElement>('.lx-h2, .lx-pitches')]
    .filter((el) => el.getBoundingClientRect().top > window.innerHeight * 0.8);
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      delete (e.target as HTMLElement).dataset.waiting;
      io.unobserve(e.target);
    }
  }, { rootMargin: '0px 0px -120px 0px' });
  for (const el of waiting) { el.dataset.waiting = ''; io.observe(el); }
}

/** The reel drifts by itself (CSS), and the scroll carries its two lines apart:
 *  `--shift` is how far, and `--lean` a slight slant while it's moving fast. */
export function mountReel(): void {
  const reel = document.querySelector<HTMLElement>('.lx-reel');
  if (!reel || stillPlease()) return;
  let frame = 0;
  let last = window.scrollY;
  const next = reel.nextElementSibling as HTMLElement;
  const read = () => {
    frame = 0;
    const y = window.scrollY;
    // Pinned sheets stay put underneath, so "on screen" isn't enough: once the
    // next sheet has covered it, the reel stops working.
    const away = reel.getBoundingClientRect().top > window.innerHeight + 200 || next.getBoundingClientRect().top < 0;
    reel.toggleAttribute('data-away', away);
    if (away) { last = y; return; }
    reel.style.setProperty('--shift', `${Math.round(y * 0.32)}px`);
    reel.style.setProperty('--lean', `${Math.max(-4, Math.min(4, (y - last) * -0.09)).toFixed(2)}deg`);
    last = y;
    window.clearTimeout(settle);
    settle = window.setTimeout(() => reel.style.setProperty('--lean', '0deg'), 120);
  };
  let settle = 0;
  read();
  window.addEventListener('scroll', () => { frame ||= requestAnimationFrame(read); }, { passive: true });
}

/** Keyboard focus is never left out of sight. Inside a pinned sheet the
 *  browser works out the wrong place to scroll to (it measures the sheet where
 *  it's pinned, not where it sits in the page), and a sheet that has slid up,
 *  or the phone's sticky button, can cover what took focus without the browser
 *  counting it as hidden. So when focus lands somewhere that isn't clear, the
 *  page goes, in one step, to where it is. */
export function mountFocusGuard(): void {
  const clear = (el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    if (r.top < 0 || r.bottom > window.innerHeight) return false;
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return !!hit && (el.contains(hit) || hit.contains(el));
  };
  // Where a sheet sits in the page, measured with its pinning switched off for
  // the read. Nothing is drawn in between, so nothing moves on screen.
  const naturalTop = (sheet: HTMLElement) => {
    sheet.style.position = 'static';
    const top = sheet.getBoundingClientRect().top + window.scrollY;
    sheet.style.position = '';
    return top;
  };
  const go = (y: number) => window.scrollTo({ top: Math.max(0, y), behavior: 'instant' });
  const settle = (el: HTMLElement, tries: number) => {
    if (!el.isConnected || clear(el)) return;
    const h = window.innerHeight;
    const r = el.getBoundingClientRect();
    const bar = document.querySelector('.lx-sticky');
    const sheet = el.closest<HTMLElement>('[data-sheet]');
    if (sheet && document.documentElement.classList.contains('lx-sheets')) {
      const top = naturalTop(sheet);
      const at = r.top - sheet.getBoundingClientRect().top;
      const tall = sheet.offsetHeight;
      const stick = Math.min(0, h - tall);
      // Near enough the sheet's top: show it unpinned, the element two-fifths
      // down. Further in: the moment the sheet pins, its foot on the screen's,
      // before the next one has slid over it.
      go(at <= h * 0.4 - stick ? top + at - h * 0.4 : top + tall - h);
    } else if (bar && r.bottom > bar.getBoundingClientRect().top && r.top < h) {
      window.scrollBy({ top: r.bottom - bar.getBoundingClientRect().top + 24, behavior: 'instant' });
    } else {
      window.scrollBy({ top: r.top - h * 0.4, behavior: 'instant' });
    }
    if (tries > 0) requestAnimationFrame(() => settle(el, tries - 1));
  };
  document.addEventListener('focusin', (e) => {
    const el = e.target as HTMLElement;
    if (el.closest?.('.lx')) requestAnimationFrame(() => settle(el, 1));
  });
}

type Transitioning = Document & { startViewTransition?: (update: () => void) => unknown };

/** Apply `change` as a move on screen: what shares a view-transition-name
 *  morphs from its old place to its new one, and the new ground floods out
 *  from `from`. Without View Transitions the change just applies, and the
 *  ground's own colour transition carries it. */
export function floodFrom(from: HTMLElement, change: () => void): void {
  const doc = document as Transitioning;
  if (!doc.startViewTransition || stillPlease()) { change(); return; }
  const r = from.getBoundingClientRect();
  const root = document.documentElement.style;
  root.setProperty('--fx', `${Math.round(r.left + r.width / 2)}px`);
  root.setProperty('--fy', `${Math.round(r.top + r.height / 2)}px`);
  doc.startViewTransition(() => flushSync(change));
}
