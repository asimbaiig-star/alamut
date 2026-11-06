// tools-shared.tsx — the inputs and pieces both pages' tools are built from.
//
// The page tools themselves live in tools-creators.tsx and tools-brands.tsx,
// so each page's bundle carries only its own (see hydrate.tsx).

import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { CheckMark } from './components';
import { clampMoney, usd } from './estimate';
import { floodFrom } from './motion';
import { PLATFORM_GLYPH, type GlyphPlatform } from '@/lib/platformGlyphs';

export const toMoney = (raw: string) => clampMoney(Number(raw.replace(/[^\d]/g, '')) || 0);
export const moneyText = (n: number) => (n === 0 ? '' : n.toLocaleString('en-US'));

/** The visitor's own browser storage, when there is one to write. */
export const browserStore = () => {
  try { return window.localStorage; } catch { return null; }
};

/** The platform a label names ("2 × Instagram Reel", "TikTok"), if any. */
export function platformIn(text: string): GlyphPlatform | null {
  const t = text.toLowerCase();
  return (Object.keys(PLATFORM_GLYPH) as GlyphPlatform[]).find((k) => t.includes(k)) ?? null;
}

/** That platform's mark, as the portal draws channel badges: the glyph on a
 *  tile in the platform's colour. Decorative; the label beside it names it. */
export function PlatMark({ of, size }: { of: string; size?: 'lg' }) {
  const p = platformIn(of);
  if (!p) return null;
  return (
    <span className={`lx-pmark ${p}${size ? ` ${size}` : ''}`} aria-hidden="true">
      <svg viewBox="0 0 24 24" focusable="false"><path d={PLATFORM_GLYPH[p]} /></svg>
    </span>
  );
}

/** A figure on odometer columns: change it and each digit rolls to its place.
 *  The digits are drawn by CSS from `--d`, so the page's text stays the plain
 *  figure, for a screen reader and for copying. `atZero` holds the columns at
 *  zero, ready to roll up to the figure. */
export function Roll({ value, className = '', atZero }: { value: string; className?: string; atZero?: boolean }) {
  const chars = [...value];
  return (
    <span className={`lx-roll ${className}`}>
      <span className="lx-sr">{value}</span>
      <span className="lx-roll-cols" aria-hidden="true">
        {chars.map((c, i) => (/\d/.test(c)
          ? <span key={chars.length - i} className="lx-d" data-c={c} style={{ '--d': atZero ? 0 : c } as CSSProperties} />
          : <span key={chars.length - i} className="lx-c" data-c={c} />))}
      </span>
    </span>
  );
}

/** False from the moment the page knows `ref` is below the screen until it
 *  scrolls into view, so what depends on it can arrive as it's seen. True
 *  when nothing can tell, so a page without JavaScript shows the figure. */
export function useArrived<T extends Element>() {
  const ref = useRef<T>(null);
  const [arrived, setArrived] = useState(true);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (el.getBoundingClientRect().top < window.innerHeight * 0.8) return;
    setArrived(false);
    const io = new IntersectionObserver(([e]) => {
      if (e!.isIntersecting) { setArrived(true); io.disconnect(); }
    }, { rootMargin: '0px 0px -160px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return [ref, arrived] as const;
}

/** A pile of sheets: each waiting item shows its letterhead band, and the one
 *  picked lies open on top. Picking one morphs its band into the open sheet,
 *  and its colour floods the page's ground. `show` draws the open sheet. */
export function Stack<T>({ label, items, ground, band, show, tall, onPick }: {
  label: string; items: readonly T[]; ground: (it: T) => string; band: (it: T) => ReactNode;
  show: (it: T) => ReactNode; tall?: boolean; onPick?: () => void;
}) {
  const [picked, setPicked] = useState(0);
  const slot = useRef<HTMLDivElement>(null);
  const pick = (i: number, el: HTMLElement) => {
    floodFrom(el, () => {
      setPicked(i);
      onPick?.();
      (el.closest('main') as HTMLElement | null)?.style.setProperty('--ground', ground(items[i]!));
    });
    // The band just clicked is gone: focus moves with it, to the sheet it became.
    slot.current?.focus({ preventScroll: true });
  };
  // Named so a band and the sheet it becomes are one element to the browser.
  const named = (i: number) => ({ viewTransitionName: `lx-s${i}` }) as CSSProperties;
  return (
    <div className={tall ? 'lx-stack tall' : 'lx-stack'}>
      <ul className="lx-bands" aria-label={label}>
        {items.map((it, i) => i !== picked && (
          <li key={i} style={{ '--i': i } as CSSProperties}>
            <button type="button" className="lx-band" style={{ ...named(i), background: ground(it) }} onClick={(e) => pick(i, e.currentTarget)}>
              {band(it)}
            </button>
          </li>
        ))}
      </ul>
      <div className="lx-slot" ref={slot} tabIndex={-1} style={named(picked)}>{show(items[picked]!)}</div>
    </div>
  );
}

/** The money a deal holds, one segment a post: held until the post is marked
 *  live, then released. Posts go live in order, so a tap sets how many have. */
export function EscrowBar({ amounts, live, onChange, doneLabel }: {
  amounts: number[]; live: number; onChange: (n: number) => void; doneLabel: string;
}) {
  return (
    <ol className="lx-bar" style={{ '--n': amounts.length } as CSSProperties} aria-label="Posts in this deal">
      {amounts.map((amt, i) => {
        const done = i < live;
        const name = amounts.length > 1 ? `Post ${i + 1}` : 'Post';
        return (
          <li key={i}>
            <button type="button" className="lx-seg" aria-pressed={done} onClick={() => onChange(i + 1 === live ? i : i + 1)}>
              <span className="lx-seg-text"><b>{name}</b><span>{done ? doneLabel : 'held in escrow'}</span></span>
              <span className="lx-money lx-seg-amt">{usd(amt)}</span>
              {done && <CheckMark />}
            </button>
          </li>
        );
      })}
    </ol>
  );
}

export function MoneyInput({ label, value, onChange, className = 'lx-field-label' }: {
  label: string; value: number; onChange: (n: number) => void; className?: string;
}) {
  const id = useId();
  return (
    <label className={className} htmlFor={id}>
      <span>{label}</span>
      <span className="lx-money-input">
        <b aria-hidden="true">$</b>
        <input id={id} type="text" inputMode="numeric" autoComplete="off" placeholder="0"
          value={moneyText(value)} onChange={(e) => onChange(toMoney(e.target.value))} />
      </span>
    </label>
  );
}

export function Stepper({ label, value, min, max, onChange, unit }: {
  label: string; value: number; min: number; max: number; onChange: (n: number) => void; unit: string;
}) {
  const id = useId();
  return (
    <div className="lx-stepper" role="group" aria-labelledby={id}>
      <span id={id} className="lx-sr">{label}</span>
      <button type="button" onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min} aria-label={`Fewer ${unit}`}>−</button>
      <output aria-live="polite">{value}</output>
      <button type="button" onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max} aria-label={`More ${unit}`}>+</button>
    </div>
  );
}
