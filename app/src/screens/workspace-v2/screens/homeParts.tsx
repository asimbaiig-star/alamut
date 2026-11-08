// homeParts.tsx — the pieces both homes are built from (portal canvas,
// Round 2): the greeting, the money strip, and the pile of letterheads
// whose top sheet is open to act on in place.

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { NotificationsBell } from '@/components/layout/NotificationsBell';
import { brandAccent } from '../brandPalette';

export function greeting(now = new Date()): string {
  const h = now.getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

/** "$33,143": whole dollars, as the money strip and the terms grid show
 *  them. (fmtUSD abbreviates to "$33.1K", which is right for tiles, not
 *  for the one figure the home is about.) */
export const dollars = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;

/** The letterhead colour an item wears: its brand's band, or ink for the
 *  account's own housekeeping (verification, storefront, wallet). */
export const bandFor = (brand?: string) => (brand ? brandAccent(brand).bg : 'var(--v2-band-ink)');

export function HomeHead({ title, sub, actions }: {
  title: string;
  sub?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="v2-hm-head">
      <div>
        <h1 className="v2-hm-hello">{title}</h1>
        {sub && <p className="v2-hm-sub">{sub}</p>}
      </div>
      <div className="v2-hm-head-actions">
        {actions}
        <NotificationsBell />
      </div>
    </header>
  );
}

export function MoneyStrip({ label, figure, tone, rows, action }: {
  label: string;
  figure: number;
  tone?: 'moss';
  rows: { label: string; value: number }[];
  action: ReactNode;
}) {
  return (
    <section className="v2-hm-money" aria-label="Money">
      <div>
        <span className="v2-hm-lab">{label}</span>
        <div className="v2-hm-big" data-tone={tone}>{dollars(figure)}</div>
      </div>
      <div className="v2-hm-ledger">
        {rows.map((r) => (
          <div className="v2-hm-lrow" key={r.label}>
            <span>{r.label}</span>
            <b>{dollars(r.value)}</b>
          </div>
        ))}
        <div className="v2-hm-lfoot">
          {/* Where money moves, it says how money moves in this beta. */}
          <span className="v2-hm-test"><i aria-hidden="true" />Beta: payments run in test mode</span>
          {action}
        </div>
      </div>
    </section>
  );
}

export interface PileItem {
  id: string;
  title: string;
  sub?: string;
  /** Short tag on the band's right ("Releases $900", "Due Nov 22"). */
  tag?: string;
  band: string;
}

/**
 * What needs you, as a pile: the open sheet in front, up to three more
 * letterheads peeking above it (nearest first), and the rest as a list on
 * request. Choosing any of them brings it to the top.
 */
export function Pile<T extends PileItem>({ items, renderTop, label }: {
  items: T[];
  renderTop: (item: T) => ReactNode;
  label: string;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const topRef = useRef<HTMLElement>(null);
  const moved = useRef(false);
  const open = items.find((i) => i.id === openId) ?? items[0];
  const others = items.filter((i) => i !== open);
  // Furthest back first, so the band nearest the open sheet is the next one.
  const behind = others.slice(0, 3).reverse();
  const rest = others.slice(3);

  // After choosing a band or a row, move focus to the sheet it opened, so a
  // keyboard user lands on what they picked rather than on a button that
  // just moved.
  useEffect(() => {
    if (!moved.current) return;
    moved.current = false;
    topRef.current?.focus({ preventScroll: true });
    topRef.current?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
  }, [openId]);

  const choose = (id: string) => {
    moved.current = true;
    setOpenId(id);
  };

  if (!open) return null;
  return (
    <div className="v2-hm-pile">
      {behind.length > 0 && (
        <ul className="v2-hm-bands" aria-label={`More in ${label}`}>
          {behind.map((it) => (
            <li key={it.id}>
              <button type="button" className="v2-hm-band" style={{ background: it.band }} onClick={() => choose(it.id)}>
                <span>{it.title}</span>
                {it.tag && <small>{it.tag}</small>}
              </button>
            </li>
          ))}
        </ul>
      )}
      <article className="v2-hm-top" ref={topRef} tabIndex={-1} aria-label={open.title}>
        {renderTop(open)}
      </article>
      {rest.length > 0 && (
        showAll ? (
          <ul className="v2-hm-rest" aria-label={`The rest of ${label}`}>
            {rest.map((it) => (
              <li key={it.id}>
                <button type="button" onClick={() => choose(it.id)}>
                  <i style={{ background: it.band }} aria-hidden="true" />
                  <span>{it.title}</span>
                  {it.sub && <small>{it.sub}</small>}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <button type="button" className="v2-hm-btn is-sm" style={{ marginTop: 16 }} onClick={() => setShowAll(true)}>
            See all {items.length}
          </button>
        )
      )}
    </div>
  );
}

/** The open sheet's letterhead row: brand tile, name and what it is. */
export function Letterhead({ brand, logo, kind, aside }: {
  brand: string;
  logo?: string;
  kind: string;
  aside?: ReactNode;
}) {
  return (
    <div className="v2-hm-lh">
      <i style={{ background: bandFor(brand) }} aria-hidden="true">
        {logo ? <img src={logo} alt="" /> : brand[0]?.toUpperCase()}
      </i>
      <span>{brand} · {kind}</span>
      {aside && <em>{aside}</em>}
    </div>
  );
}

export function Terms({ cells }: { cells: { label: string; value: number; tone?: 'moss' }[] }) {
  return (
    <div className="v2-hm-terms">
      {cells.map((c) => (
        <div key={c.label}>
          <span>{c.label}</span>
          <b data-tone={c.tone}>{dollars(c.value)}</b>
        </div>
      ))}
    </div>
  );
}

/** "today", "yesterday", "3 days ago": for when a pitch or offer arrived. */
export function ago(iso: string | undefined, now = Date.now()): string | undefined {
  if (!iso) return undefined;
  const t = +new Date(iso);
  if (!Number.isFinite(t)) return undefined;
  const days = Math.floor((now - t) / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days} days ago`;
  return new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
