// IntersectionObserver-driven "is this element visible?" hook
// Used by landing-page section reveals to fade in once on scroll.
// Fires once and disconnects, so we don't pay an observer per render.

import { useEffect, useRef, useState } from 'react';

interface Options {
  /** 0..1 — how much of the element needs to be visible. Default 0.15. */
  threshold?: number;
  /** Margin around the root, like CSS shorthand. Default '0px 0px -10% 0px'
   *  (fires slightly before the element fully enters the viewport). */
  rootMargin?: string;
}

export function useInView<T extends HTMLElement = HTMLDivElement>(
  options: Options = {},
): { ref: React.RefObject<T>; inView: boolean } {
  const { threshold = 0.15, rootMargin = '0px 0px -10% 0px' } = options;
  const ref = useRef<T>(null) as React.RefObject<T>;
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Reduced-motion users: render visible immediately, no observer.
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setInView(true);
      return;
    }
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setInView(true);
            obs.disconnect();
          }
        });
      },
      { threshold, rootMargin },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold, rootMargin]);

  return { ref, inView };
}
