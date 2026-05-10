// Deal ranking for Today's flat queue (Phase 24).
//
// Today's redesigned screen sorts deals by "what's most urgent for me
// right now?" using each deal's computeDealAction(...) urgency score.
//
// We split the ranked output into TWO buckets the UI can render
// separately:
//   - `actionable`: deals where the role is blocked (or can do
//     something useful). Ranked by urgency descending.
//   - `passive`: deals where the OTHER side is blocked, OR the deal
//     has ended (closed/declined/withdrawn). These appear in a
//     subtler "Recent activity" section so they don't compete with
//     real work.
//
// The split is intentional: the wireframes (Phase 23 design pass) put
// passive items in a separate "Recent wins" tail so they're celebrated
// but don't dilute the main queue. This module produces both lists in
// one pass — callers don't need to filter twice.

import type { Role } from './deal-action';
import type { DealAction } from './deal-action';
import type { DealState } from './deal-state';

export interface RankableDeal<TPayload> {
  /** Anything caller wants to attach (Deal, ApplicationRow, etc.). */
  payload: TPayload;
  state: DealState;
  action: DealAction;
}

export interface RankedDeals<TPayload> {
  /** Ranked highest urgency first. The user's primary queue. */
  actionable: RankableDeal<TPayload>[];
  /** Other-side or terminal — surfaced as recent activity, not a queue. */
  passive: RankableDeal<TPayload>[];
}

export function rankDeals<T>(
  deals: RankableDeal<T>[],
  _role: Role,    // present for future role-specific bumps; unused today
): RankedDeals<T> {
  const actionable: RankableDeal<T>[] = [];
  const passive: RankableDeal<T>[] = [];

  for (const d of deals) {
    if (d.action.actor === 'me') {
      actionable.push(d);
    } else {
      passive.push(d);
    }
  }

  // Highest urgency floats up. Ties broken by the action's reason string
  // for stable ordering (deterministic — important for tests + UI).
  actionable.sort((a, b) => {
    const dy = b.action.urgency - a.action.urgency;
    if (dy !== 0) return dy;
    return (a.action.reason || '').localeCompare(b.action.reason || '');
  });

  // Passive uses the same logic but most won't matter — keeps a small
  // urgency signal so "creator just uploaded" shows above "deal closed
  // last week" in the activity tail.
  passive.sort((a, b) => b.action.urgency - a.action.urgency);

  return { actionable, passive };
}
