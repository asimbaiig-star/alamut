// collabDedupe.test.ts — merging duplicate (campaign, creator) collab rows.
//
// Duplicates arise because store.ts's overlay merged remote rows by `id`, but a
// collaboration is logically keyed by (campaignId, creatorId). The local
// materialized row and the Supabase row for the same pair carry different ids,
// so the remote one was appended instead of merged — observed live as 3 pairs
// with twin rows disagreeing about stage.
//
// The harm is not cosmetic: ensureCollabState finds by pair and updates only
// the first match, so the other row never advances.

import { describe, it, expect } from 'vitest';
import { mergeCollabRows, dedupeCollabRows, COLLAB_STAGE_ORDER } from '../collabSync';
import { V2_STAGE_META } from '@/screens/workspace-v2/v2Adapters';
import type { Collaboration, CollabStage } from '../types';
import type { V2CollabStage } from '@/screens/workspace-v2/data';

const row = (over: Partial<Collaboration>): Collaboration => ({
  id: 'col_a', campaignId: 'cmp_1', creatorId: 'cr_1', brandId: 'br_1',
  stage: 'confirmed', createdAt: 100, updatedAt: 100, agreedRate: 500,
  acceptedOfferId: null, contractId: null, cancelledAt: null,
  cancellationReason: null, history: [],
  ...over,
} as Collaboration);

describe('mergeCollabRows', () => {
  it('keeps the furthest stage', () => {
    // The live case: a row at 'confirmed' and its twin at 'submitted'.
    const merged = mergeCollabRows(
      row({ id: 'col_local', stage: 'confirmed' }),
      row({ id: 'col_remote', stage: 'submitted' }),
    );
    expect(merged.stage).toBe('submitted');
  });

  it('never lets a terminal row mask real progress', () => {
    // 'cancelled' is outside the pipeline ordering; it must not win the max.
    const merged = mergeCollabRows(
      row({ stage: 'submitted' }),
      row({ stage: 'cancelled' as CollabStage }),
    );
    expect(merged.stage).toBe('submitted');
  });

  it('unions history and re-sorts chronologically', () => {
    const merged = mergeCollabRows(
      row({ history: [{ at: 1, from: null, to: 'pitched', actorUserId: 'u' }] }),
      row({ history: [{ at: 3, from: 'negotiating', to: 'confirmed', actorUserId: 'u' }] }),
    );
    expect(merged.history.map((h) => h.at)).toEqual([1, 3]);
  });

  it('does not duplicate a transition recorded in both rows', () => {
    const shared = { at: 5, from: 'pitched' as CollabStage, to: 'negotiating' as CollabStage, actorUserId: 'u' };
    const merged = mergeCollabRows(row({ history: [shared] }), row({ history: [shared] }));
    expect(merged.history).toHaveLength(1);
  });

  it('keeps the earliest creation and the latest update', () => {
    const merged = mergeCollabRows(
      row({ createdAt: 50, updatedAt: 60 }),
      row({ createdAt: 90, updatedAt: 200 }),
    );
    expect(merged.createdAt).toBe(50);
    expect(merged.updatedAt).toBe(200);
  });

  it('prefers a set value over a null on every nullable field', () => {
    // Whichever row carries the contract / cancellation detail, it survives —
    // this is why the fix merges rather than deleting a row outright.
    const merged = mergeCollabRows(
      row({ stage: 'submitted', contractId: null, acceptedOfferId: null }),
      row({ stage: 'confirmed', contractId: 'ct_1', acceptedOfferId: 'off_1' }),
    );
    expect(merged.contractId).toBe('ct_1');
    expect(merged.acceptedOfferId).toBe('off_1');
    // …without losing the furthest stage.
    expect(merged.stage).toBe('submitted');
  });

  it('carries an escrow freeze across the merge', () => {
    // Losing this would un-freeze escrow on a disputed collab.
    const merged = mergeCollabRows(
      row({ escrowFrozen: false }),
      row({ escrowFrozen: true }),
    );
    expect(merged.escrowFrozen).toBe(true);
  });
});

describe('dedupeCollabRows', () => {
  it('collapses duplicates for one pair and leaves others alone', () => {
    const out = dedupeCollabRows([
      row({ id: 'a', campaignId: 'cmp_1', creatorId: 'cr_1', stage: 'confirmed' }),
      row({ id: 'b', campaignId: 'cmp_2', creatorId: 'cr_1', stage: 'live' }),
      row({ id: 'c', campaignId: 'cmp_1', creatorId: 'cr_1', stage: 'submitted' }),
    ]);
    expect(out).toHaveLength(2);
    const pair1 = out.find((r) => r.campaignId === 'cmp_1')!;
    expect(pair1.stage).toBe('submitted');
  });

  it('is order-stable — the first occurrence keeps its position', () => {
    const out = dedupeCollabRows([
      row({ id: 'x', campaignId: 'cmp_9', creatorId: 'cr_9' }),
      row({ id: 'y', campaignId: 'cmp_1', creatorId: 'cr_1' }),
      row({ id: 'z', campaignId: 'cmp_1', creatorId: 'cr_1' }),
    ]);
    expect(out.map((r) => r.campaignId)).toEqual(['cmp_9', 'cmp_1']);
  });

  it('is idempotent', () => {
    const once = dedupeCollabRows([
      row({ id: 'a', stage: 'confirmed' }), row({ id: 'b', stage: 'submitted' }),
    ]);
    expect(dedupeCollabRows(once)).toEqual(once);
  });

  it('leaves an already-clean list untouched', () => {
    const clean = [row({ id: 'a', campaignId: 'c1', creatorId: 'r1' }), row({ id: 'b', campaignId: 'c2', creatorId: 'r2' })];
    expect(dedupeCollabRows(clean)).toEqual(clean);
  });
});

describe('stage ordering has one definition', () => {
  it('V2_STAGE_META.order agrees with COLLAB_STAGE_ORDER', () => {
    // The data layer owns the state machine; the UI metadata mirrors its
    // ordering. Duplicated orderings are exactly the drift that let the stage
    // model diverge in the first place, so this pins them together.
    const fromMeta = (Object.keys(V2_STAGE_META) as V2CollabStage[])
      .filter((s) => V2_STAGE_META[s].inPipeline)
      .sort((a, b) => V2_STAGE_META[a].order - V2_STAGE_META[b].order);
    expect(fromMeta).toEqual(COLLAB_STAGE_ORDER);
  });
});
