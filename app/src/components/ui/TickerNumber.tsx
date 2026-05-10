// Animated number ticker — counts from 0 → target the first time it enters view.
// Uses IntersectionObserver so we don't animate for off-screen content.
// Honors prefers-reduced-motion (renders static value).
import { useEffect, useRef, useState } from 'react';

interface TickerNumberProps {
  value: number;
  // How long to animate to the target (ms). Default 900ms.
  duration?: number;
  // Optional formatter — receives the in-flight number, returns the displayed string.
  // Default: rounds to integer + adds thousand separators.
  format?: (n: number) => string;
  // Render the suffix outside the animated text (e.g. "%" or "K").
  suffix?: string;
  // For sub-1000 values, decimals matter (e.g. ratings: 4.7).
  decimals?: number;
}

export function TickerNumber({ value, duration = 900, format, suffix, decimals = 0 }: TickerNumberProps) {
  const [display, setDisplay] = useState(value);
  const ref = useRef<HTMLSpanElement>(null);
  const fired = useRef(false);

  useEffect(() => {
    // Reduced motion users see the final value immediately.
    if (typeof window === 'undefined') return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setDisplay(value);
      return;
    }
    if (!ref.current) return;

    const animate = () => {
      if (fired.current) return;
      fired.current = true;
      const start = performance.now();
      const from = 0;
      const to = value;
      const tick = (now: number) => {
        const t = Math.min(1, (now - start) / duration);
        // ease-out-cubic — feels weighted, lands cleanly
        const eased = 1 - Math.pow(1 - t, 3);
        setDisplay(from + (to - from) * eased);
        if (t < 1) requestAnimationFrame(tick);
        else setDisplay(to);
      };
      requestAnimationFrame(tick);
    };

    // Trigger when ~30% of the element is on-screen.
    const obs = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) animate(); });
    }, { threshold: 0.3 });
    obs.observe(ref.current);
    return () => obs.disconnect();
    // value/duration changes only matter at first mount; we keep the observer's
    // animate-once semantic to avoid replaying every time the parent re-renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const formatted = format
    ? format(display)
    : decimals > 0
      ? display.toFixed(decimals)
      : Math.round(display).toLocaleString();

  return (
    <span ref={ref}>
      {formatted}{suffix && <span className="u">{suffix}</span>}
    </span>
  );
}
