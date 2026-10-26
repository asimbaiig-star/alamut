// motion.ts — sections rise as they scroll into view.
//
// Only content still below the fold at hydration is hidden, so nothing the
// visitor is already looking at disappears. Without script, in a background
// tab, or with reduced motion asked for, nothing is hidden at all. The hero's
// entrance is CSS, switched on before first paint by the inline script in
// each page's <head> (`lx-anim`).

export function mountReveals(): void {
  if (document.visibilityState !== 'visible') return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (!('IntersectionObserver' in window)) return;

  const els = Array.from(document.querySelectorAll<HTMLElement>('[data-reveal]'));
  const fold = window.innerHeight;
  for (const el of els) if (el.getBoundingClientRect().top < fold) el.classList.add('is-in');

  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      e.target.classList.add('is-in');
      io.unobserve(e.target);
    }
  }, { rootMargin: '0px 0px -64px 0px' });
  for (const el of els) if (!el.classList.contains('is-in')) io.observe(el);
  document.documentElement.classList.add('lx-js');
}
