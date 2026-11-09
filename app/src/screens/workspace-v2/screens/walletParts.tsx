// walletParts.tsx — the movements list both wallets share (portal canvas,
// Round 4): a row of type chips, one line per movement, ten at a time.

import { useState } from 'react';
import type { V2WalletLedgerEntry } from '../data';
import { dollars } from './homeParts';

export interface LedgerFilter {
  id: string;
  label: string;
  test: (e: V2WalletLedgerEntry) => boolean;
}

const PAGE = 10;

/** A signed whole-dollar amount: +$1,275 / −$4,000. */
export const signed = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${dollars(Math.abs(n))}`;

const TONE: Record<string, 'moss' | 'gold' | 'muted' | undefined> = {
  Settled: 'moss', Paid: 'moss', Cleared: 'moss', 'In escrow': 'gold', Pending: 'gold', Failed: 'muted',
};

export function LedgerList({ entries, filters, emptyTitle, emptyBody, label }: {
  entries: V2WalletLedgerEntry[];
  filters: LedgerFilter[];
  emptyTitle: string;
  emptyBody: string;
  label: string;
}) {
  const [filter, setFilter] = useState('all');
  const [shown, setShown] = useState(PAGE);
  const all: LedgerFilter = { id: 'all', label: 'All', test: () => true };
  const chips = [all, ...filters].filter((f) => f.id === 'all' || f.id === filter || entries.some(f.test));
  const active = chips.find((f) => f.id === filter) ?? all;
  const list = entries.filter(active.test);

  if (entries.length === 0) {
    return (
      <div className="v2-ls-empty">
        <b>{emptyTitle}</b>
        <p>{emptyBody}</p>
      </div>
    );
  }

  return (
    <div>
      <div className="v2-ls-bar is-scroll" role="group" aria-label={`Filter ${label}`} style={{ marginBottom: 14 }}>
        {chips.map((f) => (
          <button key={f.id} type="button" className="v2-ls-chip" aria-pressed={active.id === f.id} onClick={() => { setFilter(f.id); setShown(PAGE); }}>
            {f.label} <b>{entries.filter(f.test).length}</b>
          </button>
        ))}
      </div>
      <div className="v2-ls-table" style={{ ['--cols' as string]: '76px minmax(0,1.6fr) 112px 120px' }}>
        <div className="v2-ls-head"><span>Date</span><span>What</span><span>Status</span><span className="r">Amount</span></div>
        {list.slice(0, shown).map((e, i) => {
          // "Payout · Reset Week — Oakmoss": what, then who.
          const [what, who] = e.desc.split(' — ');
          return (
            <div className="v2-ls-row" key={`${e.date}-${i}`}>
              <span className="v2-ls-hide-sm">{e.date}</span>
              <div className="v2-ls-main" style={{ gridColumn: 'auto' }}>
                <b>{what}</b>
                {who && <small>{who}</small>}
              </div>
              <span className="v2-ls-pill v2-ls-hide-sm" data-tone={TONE[e.status]}>{e.status}</span>
              <span className="v2-wl-amt" data-in={e.amount > 0 || undefined}>{signed(e.amount)}</span>
              <span className="v2-ls-sm-sub">{e.date} · {e.status}</span>
            </div>
          );
        })}
      </div>
      <div className="v2-ls-foot">
        <span>Showing <b>{Math.min(shown, list.length)}</b> of {list.length}</span>
        {list.length > shown && (
          <button type="button" className="v2-hm-btn" onClick={() => setShown((n) => n + 20)}>Show {Math.min(20, list.length - shown)} more</button>
        )}
      </div>
    </div>
  );
}
