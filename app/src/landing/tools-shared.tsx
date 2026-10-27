// tools-shared.tsx — the inputs and helpers both pages' tools are built from.
//
// The page tools themselves live in tools-creators.tsx and tools-brands.tsx,
// so each page's bundle carries only its own (see hydrate.tsx).

import { useId, type CSSProperties } from 'react';
import { clampMoney } from './estimate';
import type { CreatorChannel } from './listings';

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

// The platform's colour for whatever names it ("2 × Instagram Reel", "TikTok"),
// as the portal colours channel badges.
const PLATFORM_COLOUR: Record<CreatorChannel['platform'], string> = {
  Instagram: 'var(--v2-platform-instagram)',
  TikTok: 'var(--v2-platform-tiktok)',
  YouTube: 'var(--v2-platform-youtube)',
};
export function platStyle(text: string): CSSProperties | undefined {
  const p = (Object.keys(PLATFORM_COLOUR) as CreatorChannel['platform'][]).find((k) => text.includes(k));
  return p ? ({ '--plat': PLATFORM_COLOUR[p] } as CSSProperties) : undefined;
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

export function Chips<T extends string>({ label, options, value, onChange }: {
  label: string; options: readonly T[]; value: T; onChange: (v: T) => void;
}) {
  return (
    <div className="lx-chips" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o} type="button" className="lx-chip" aria-pressed={o === value} onClick={() => onChange(o)}>{o}</button>
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
