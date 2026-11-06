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

/** Pitches arrive one by one once the inbox is on screen. Until then the
 *  later ones wait; a page without this file shows them all. */
export function mountArrivals(): void {
  const inbox = document.querySelector<HTMLElement>('.lx-pitches');
  if (!inbox || stillPlease() || inbox.getBoundingClientRect().top < window.innerHeight * 0.8) return;
  inbox.dataset.waiting = '';
  const io = new IntersectionObserver(([e]) => {
    if (e!.isIntersecting) { delete inbox.dataset.waiting; io.disconnect(); }
  }, { rootMargin: '0px 0px -200px 0px' });
  io.observe(inbox);
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
