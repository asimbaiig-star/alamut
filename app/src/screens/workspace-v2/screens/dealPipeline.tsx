// dealPipeline.tsx — the creator's deals as money moving through stages
// (portal canvas, Round 6). One component for the Deals page, where each
// stage filters the list, and the creator home, where it links to Deals.
//
// It replaced two sets of tiles that only counted deals. A creator's
// question is "where is my money", so each stage shows what it is worth:
// offers and agreed deals as what the creator keeps after fees, pitches as
// what they asked for (nothing is agreed yet, so nothing is netted).

import type { Database } from '@/lib/api/types';
import type { V2Collab, V2CollabStage } from '../data';
import { splitAcrossSlots } from '@/lib/api/money';
import { dollars } from './homeParts';

export type StageGroup = 'offers' | 'pitched' | 'working' | 'releasing' | 'paid';

export const STAGE_GROUPS: {
  id: StageGroup;
  label: string;
  stages: V2CollabStage[];
  /** What the figure is, under it. */
  sub: string;
  tone?: 'hot' | 'done';
}[] = [
  { id: 'offers', label: 'Offers', stages: ['invited', 'negotiating'], sub: 'you’d keep', tone: 'hot' },
  { id: 'pitched', label: 'Pitched', stages: ['pitched'], sub: 'you asked for' },
  { id: 'working', label: 'Working', stages: ['confirmed', 'submitted'], sub: 'held, you keep' },
  { id: 'releasing', label: 'Releasing', stages: ['approved', 'live'], sub: 'as posts go live' },
  { id: 'paid', label: 'Paid', stages: ['paid'], sub: 'after fees', tone: 'done' },
];

/** What one deal is worth to the creator at its stage. */
export function dealWorth(c: V2Collab, db: Database): number {
  const slots = Math.max(1, c.deliverables.length);
  const net = (gross: number) => (gross > 0 ? splitAcrossSlots(gross, slots).net : 0);
  if (c.stage === 'pitched') {
    const app = db.applications
      .filter((a) => a.campaignId === c.campaignId && a.creatorId === c.creatorId)
      .sort((a, b) => +new Date(b.submittedAt) - +new Date(a.submittedAt))[0];
    return app?.proposedRate ?? 0;
  }
  if (c.stage === 'invited' || c.stage === 'negotiating') {
    // The rate on the table right now: the latest round of the open offer.
    const offer = db.offers
      .filter((o) => o.campaignId === c.campaignId && o.creatorId === c.creatorId
        && (o.status === 'pending' || o.status === 'countered'))
      .sort((a, b) => +new Date(b.sentAt) - +new Date(a.sentAt))[0];
    const rate = offer ? (offer.rounds?.[offer.rounds.length - 1]?.rate ?? offer.rate) : 0;
    return net(rate);
  }
  return net(c.price);
}

export function stageTotals(collabs: V2Collab[], db: Database) {
  return STAGE_GROUPS.map((g) => {
    const items = collabs.filter((c) => g.stages.includes(c.stage));
    return { ...g, count: items.length, amount: items.reduce((s, c) => s + dealWorth(c, db), 0) };
  });
}

/**
 * The strip itself. With `selected`/`onPick` each stage is a toggle that
 * filters a list; with `onOpen` each is a link to the Deals page.
 */
export function DealPipeline({ collabs, db, selected, onPick, onOpen, label = 'Your deals by stage', list }: {
  collabs: V2Collab[];
  db: Database;
  selected?: StageGroup | null;
  onPick?: (g: StageGroup | null) => void;
  onOpen?: (g: StageGroup) => void;
  label?: string;
  /** Stacked rows, for a narrow column (the home). */
  list?: boolean;
}) {
  const totals = stageTotals(collabs, db);
  return (
    <div className={list ? 'v2-pipe is-list' : 'v2-pipe'} role="group" aria-label={label}>
      {totals.map((t) => {
        const pressed = onPick ? selected === t.id : undefined;
        return (
          <button
            key={t.id}
            type="button"
            aria-pressed={pressed}
            data-tone={t.count > 0 ? t.tone : undefined}
            onClick={() => (onPick ? onPick(selected === t.id ? null : t.id) : onOpen?.(t.id))}
            aria-label={`${t.label}: ${t.count} deal${t.count === 1 ? '' : 's'}, ${dollars(t.amount)} ${t.sub}${onPick ? '' : '. Open your deals'}`}
          >
            <span>{t.label} <em>{t.count}</em></span>
            <b>{dollars(t.amount)}</b>
            <small>{t.sub}</small>
          </button>
        );
      })}
    </div>
  );
}
