// tools-shared.tsx — the inputs and pieces both pages' tools are built from.
//
// The page tools themselves live in tools-creators.tsx and tools-brands.tsx,
// so each page's bundle carries only its own (see hydrate.tsx).

import { useEffect, useId, useRef, useState, type CSSProperties, type PointerEvent as PointerEv, type ReactNode } from 'react';
import { CheckMark, Stamp } from './components';
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

/** `arrived` is false from the moment the page knows `ref` is below the screen
 *  until it scrolls into view, so what depends on it can happen as it's seen,
 *  and `settled` follows a beat later. Both are true when nothing can tell, so
 *  a page without JavaScript shows the finished state. */
export function useArrived<T extends Element>() {
  const ref = useRef<T>(null);
  const [arrived, setArrived] = useState(true);
  const [settled, setSettled] = useState(true);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (el.getBoundingClientRect().top < window.innerHeight * 0.8) return;
    setArrived(false);
    setSettled(false);
    let beat = 0;
    const io = new IntersectionObserver(([e]) => {
      if (!e!.isIntersecting) return;
      setArrived(true);
      beat = window.setTimeout(() => setSettled(true), 750);
      io.disconnect();
    }, { rootMargin: '0px 0px -160px 0px' });
    io.observe(el);
    return () => { io.disconnect(); window.clearTimeout(beat); };
  }, []);
  return [ref, arrived, settled] as const;
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
  const drag = useRef<{ x: number; y: number; on: boolean } | null>(null);
  const pick = (i: number, el: HTMLElement) => {
    floodFrom(el, () => {
      setPicked(i);
      onPick?.();
      (el.closest('main') as HTMLElement | null)?.style.setProperty('--ground', ground(items[i]!));
    });
    // The band just clicked is gone: focus moves with it, to the sheet it became.
    slot.current?.focus({ preventScroll: true });
  };
  const paper = () => slot.current?.style;
  // On a touch screen the open sheet can be flicked away for the next one.
  const swipe = {
    onPointerDown: (e: PointerEv<HTMLDivElement>) => {
      if (e.pointerType !== 'touch' || (e.target as Element).closest('input, a, button, label')) return;
      drag.current = { x: e.clientX, y: e.clientY, on: false };
    },
    onPointerMove: (e: PointerEv<HTMLDivElement>) => {
      const d = drag.current;
      if (!d) return;
      const dx = e.clientX - d.x;
      if (!d.on && Math.abs(dx) < 12) return;
      d.on = true;
      paper()?.setProperty('--swipe', `${dx}px`);
    },
    onPointerUp: (e: PointerEv<HTMLDivElement>) => {
      const d = drag.current;
      drag.current = null;
      if (!d?.on) return;
      paper()?.removeProperty('--swipe');
      const dx = e.clientX - d.x;
      if (Math.abs(dx) > 70) pick((picked + (dx < 0 ? 1 : items.length - 1)) % items.length, e.currentTarget);
    },
    onPointerCancel: () => { drag.current = null; paper()?.removeProperty('--swipe'); },
  };
  // With a mouse the sheet leans toward the pointer, a few degrees, like paper
  // held at the corner.
  const tilt = {
    onPointerMove: (e: PointerEv<HTMLDivElement>) => {
      if (e.pointerType !== 'mouse') return;
      const r = e.currentTarget.getBoundingClientRect();
      paper()?.setProperty('--ry', `${(((e.clientX - r.left) / r.width) - 0.5) * 5}deg`);
      paper()?.setProperty('--rx', `${(0.5 - ((e.clientY - r.top) / r.height)) * 4}deg`);
    },
    onPointerLeave: () => { paper()?.removeProperty('--rx'); paper()?.removeProperty('--ry'); },
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
      <div className="lx-slot" ref={slot} tabIndex={-1} style={named(picked)}
        onPointerDown={swipe.onPointerDown} onPointerUp={swipe.onPointerUp} onPointerCancel={swipe.onPointerCancel}
        onPointerMove={(e) => { swipe.onPointerMove(e); tilt.onPointerMove(e); }} onPointerLeave={tilt.onPointerLeave}>
        {show(items[picked]!)}
      </div>
    </div>
  );
}

/** The paper slips that fly when a post is released: each one's direction. */
const SLIPS = [205, 235, 262, 290, 318, 340, 15, 40];

/** Set a price by dragging, as well as by typing: on a phone it's a thumb
 *  instead of a keyboard, and the figures roll as it moves. */
export function RateRuler({ value, onChange, label, min = 100, max = 5000 }: {
  value: number; onChange: (n: number) => void; label: string; min?: number; max?: number;
}) {
  const at = Math.min(max, Math.max(min, value));
  return (
    <div className="lx-ruler">
      <input type="range" min={min} max={max} step={50} value={at} aria-label={label}
        style={{ '--at': String((at - min) / (max - min)) } as CSSProperties}
        onInput={(e) => onChange(Number(e.currentTarget.value))} onChange={(e) => onChange(Number(e.currentTarget.value))} />
    </div>
  );
}

/** The money a deal holds, one segment a post: held until the post is marked
 *  live, then released. Posts go live in order, so a tap sets how many have. */
export function EscrowBar({ amounts, live, onChange, doneLabel }: {
  amounts: number[]; live: number; onChange: (n: number) => void; doneLabel: string;
}) {
  // Which post was just released, and a count so each release plays afresh.
  const [burst, setBurst] = useState<{ at: number; n: number } | null>(null);
  return (
    <ol className="lx-bar" style={{ '--n': amounts.length } as CSSProperties} aria-label="Posts in this deal">
      {amounts.map((amt, i) => {
        const done = i < live;
        const name = amounts.length > 1 ? `Post ${i + 1}` : 'Post';
        return (
          <li key={i}>
            <button type="button" className="lx-seg" aria-pressed={done} onClick={() => {
              const next = i + 1 === live ? i : i + 1;
              if (next > live) setBurst((b) => ({ at: i, n: (b?.n ?? 0) + 1 }));
              onChange(next);
            }}>
              <span className="lx-seg-text"><b>{name}</b><span>{done ? doneLabel : 'held in escrow'}</span></span>
              {done && <Stamp tone="accent">Released</Stamp>}
              <span className="lx-money lx-seg-amt">{usd(amt)}</span>
              {done && <CheckMark />}
            </button>
            {burst?.at === i && done && (
              <span key={burst.n} className="lx-burst" aria-hidden="true">{SLIPS.map((s) => <i key={s} style={{ '--a': `${s}deg` } as CSSProperties} />)}</span>
            )}
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
