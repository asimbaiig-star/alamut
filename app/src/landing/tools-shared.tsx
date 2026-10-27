// tools-shared.tsx — the inputs and helpers both pages' tools are built from.
//
// The page tools themselves live in tools-creators.tsx and tools-brands.tsx,
// so each page's bundle carries only its own (see hydrate.tsx).

import { useId, type ReactNode } from 'react';
import { clampMoney } from './estimate';
import { PLATFORM_GLYPH, type GlyphPlatform } from '@/lib/platformGlyphs';

export const toMoney = (raw: string) => clampMoney(Number(raw.replace(/[^\d]/g, '')) || 0);
export const moneyText = (n: number) => (n === 0 ? '' : n.toLocaleString('en-US'));

/** The visitor's own browser storage, when there is one to write. */
export const browserStore = () => {
  try { return window.localStorage; } catch { return null; }
};

/** Where the list stacks above the card (phones, tablets), a pick would
 *  change a card the visitor can't see: bring it into view. */
export function revealPicked(el: HTMLElement | null) {
  if (!el || typeof window.matchMedia !== 'function' || !window.matchMedia('(max-width: 999px)').matches) return;
  const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  requestAnimationFrame(() => el.scrollIntoView({ behavior: still ? 'auto' : 'smooth', block: 'start' }));
}

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

export function Chips<T extends string>({ label, options, value, onChange, mark }: {
  label: string; options: readonly T[]; value: T; onChange: (v: T) => void; mark?: (o: T) => ReactNode;
}) {
  return (
    <div className="lx-chips" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o} type="button" className="lx-chip" aria-pressed={o === value} onClick={() => onChange(o)}>{mark?.(o)}{o}</button>
      ))}
    </div>
  );
}

/** One ledger line: label, dotted leader, amount. */
export function WalletLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="lx-wallet-line">
      <span>{label}</span><span className="lx-leader" aria-hidden="true" /><b>{value}</b>
    </div>
  );
}
