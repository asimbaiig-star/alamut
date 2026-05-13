export function fmtMoney(n: number, currency = 'USD'): string {
  if (Math.abs(n) >= 10_000) {
    const k = n / 1000;
    return `${n < 0 ? '-' : ''}$${Math.abs(k).toFixed(Math.abs(k) < 10 ? 1 : 0)}k`;
  }
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(n);
}

export function fmtMoneyFull(n: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(n);
}

export function fmtCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}k`;
  return n.toLocaleString();
}

const RTF = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
export function fmtRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return RTF.format(-m, 'minute');
  const h = Math.floor(m / 60);
  if (h < 24) return RTF.format(-h, 'hour');
  const d = Math.floor(h / 24);
  if (d < 30) return RTF.format(-d, 'day');
  const mo = Math.floor(d / 30);
  if (mo < 12) return RTF.format(-mo, 'month');
  return RTF.format(-Math.floor(mo / 12), 'year');
}

export function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function fmtDateShort(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}

export function initials(name: string): string {
  return name.split(/\s+/).slice(0, 2).map((n) => n[0]).join('').toUpperCase();
}

/**
 * Safe numeric coercion for `<input type="number">` onChange handlers.
 *
 * Pre-fix many sites used `parseInt(e.target.value || '0', 10)` or
 * `Number(e.target.value)` directly. Both produce `NaN` on partial-
 * scientific input ('1e'), which then propagates to wallet balances,
 * escrow amounts, and transactions. The downstream `Math.max`,
 * `+=`, and JSON serialization all silently accept NaN, so a brand
 * could end up with `walletBalance: NaN` after a single bad keystroke
 * — the wallet display then breaks entirely.
 *
 * This helper:
 *   - returns `min` (defaults to 0) for empty, NaN, or non-finite input
 *   - clamps to `[min, max]` when those are provided
 *   - rounds to integer when `integer` is true (default)
 *
 * Usage:
 *   onChange={(e) => setRate(parseNumberInput(e.target.value, { min: 0 }))}
 */
export function parseNumberInput(
  raw: string,
  opts: { min?: number; max?: number; integer?: boolean } = {},
): number {
  const { min = 0, max = Number.MAX_SAFE_INTEGER, integer = true } = opts;
  if (raw == null || raw === '') return min;
  const n = integer ? parseInt(raw, 10) : Number(raw);
  if (!Number.isFinite(n)) return min;
  if (n < min) return min;
  if (n > max) return max;
  return n;
}
