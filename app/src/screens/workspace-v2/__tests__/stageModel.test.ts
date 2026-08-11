// stageModel.test.ts — the collab stage model is single-source and complete.
//
// These pin the invariants that were silently violated before: the type
// declared 8 stages, the state machine produced 9, and each surface improvised
// its own handling of the one it didn't know about.

import { describe, it, expect } from 'vitest';
import {
  V2_STAGE_META, V2_PIPELINE_STAGES, V2_BOARD_PHASES,
  isActiveCollab, furthestPipelineStage,
} from '../v2Adapters';
import { buildDb } from '@/lib/utils/__tests__/fixtures';
import type { V2CollabStage } from '../data';

// Every member of the union, written out. If a stage is added to
// V2CollabStage, this list must be updated too — and the first test below
// then fails loudly rather than the new stage falling through the UI.
const ALL_STAGES: V2CollabStage[] = [
  'invited', 'pitched', 'negotiating', 'confirmed',
  'submitted', 'approved', 'live', 'paid', 'cancelled',
];

describe('stage metadata is complete', () => {
  it('has an entry for every stage, and no extras', () => {
    expect(Object.keys(V2_STAGE_META).sort()).toEqual([...ALL_STAGES].sort());
  });

  it('gives every stage a non-empty label and colour', () => {
    for (const s of ALL_STAGES) {
      expect(V2_STAGE_META[s].label.length).toBeGreaterThan(0);
      expect(V2_STAGE_META[s].color.length).toBeGreaterThan(0);
    }
  });

  it('assigns every stage to exactly one creator-side group', () => {
    for (const s of ALL_STAGES) {
      expect(['pre-acceptance', 'post-acceptance', 'closed'])
        .toContain(V2_STAGE_META[s].activeGroup);
    }
  });
});

describe('pipeline columns are derived, not hand-listed', () => {
  it('contains every in-pipeline stage and nothing else', () => {
    const expected = ALL_STAGES.filter((s) => V2_STAGE_META[s].inPipeline);
    expect(V2_PIPELINE_STAGES.map((s) => s.id).sort()).toEqual([...expected].sort());
  });

  it('never includes a terminal stage — cancelled is not a column', () => {
    expect(V2_PIPELINE_STAGES.map((s) => s.id)).not.toContain('cancelled');
  });

  it('is ordered by the declared order field', () => {
    const orders = V2_PIPELINE_STAGES.map((s) => V2_STAGE_META[s.id].order);
    expect(orders).toEqual([...orders].sort((a, b) => a - b));
  });

  it('carries the label and colour straight from the metadata', () => {
    for (const col of V2_PIPELINE_STAGES) {
      expect(col.label).toBe(V2_STAGE_META[col.id].label);
      expect(col.color).toBe(V2_STAGE_META[col.id].color);
    }
  });
});

describe('isActiveCollab — the count that used to disagree with the board', () => {
  it('counts exactly the stages that have a column', () => {
    // This is the property that makes the Pipeline badge match the sum of the
    // column counts. Pre-fix the badge used collabs.length, which included
    // cancelled collabs that matched no column.
    for (const stage of ALL_STAGES) {
      const hasColumn = V2_PIPELINE_STAGES.some((c) => c.id === stage);
      expect(isActiveCollab({ stage })).toBe(hasColumn);
    }
  });

  it('excludes cancelled', () => {
    expect(isActiveCollab({ stage: 'cancelled' })).toBe(false);
  });

  it('a mixed roster splits so the parts sum to the whole', () => {
    const roster: { stage: V2CollabStage }[] = [
      { stage: 'pitched' }, { stage: 'confirmed' }, { stage: 'live' },
      { stage: 'cancelled' }, { stage: 'cancelled' },
    ];
    const active = roster.filter(isActiveCollab);
    const closed = roster.filter((c) => !isActiveCollab(c));
    expect(active).toHaveLength(3);
    expect(closed).toHaveLength(2);
    expect(active.length + closed.length).toBe(roster.length);
  });
});

describe('the state machine and the UI model agree', () => {
  it('cancelled is a real union member, not a cast', () => {
    // collabSync.computeCollabStage returns 'cancelled' when every
    // application and offer is declined/withdrawn. Before this it was forced
    // into V2CollabStage with `as`, which is why nothing caught the drift.
    const stage: V2CollabStage = 'cancelled';
    expect(V2_STAGE_META[stage]).toBeDefined();
    expect(V2_STAGE_META[stage].inPipeline).toBe(false);
  });

  it('gives terminal stages an outcome note to show the user', () => {
    for (const s of ALL_STAGES) {
      if (V2_STAGE_META[s].inPipeline) continue;
      // A terminal stage must be able to explain itself — the whole failure
      // mode was records disappearing with no explanation.
      expect(V2_STAGE_META[s].outcomeNote?.length ?? 0).toBeGreaterThan(0);
    }
  });
});

// =====================================================================
// Board phases (column grouping)
// =====================================================================

describe('board phases', () => {
  it('cover every in-pipeline stage exactly once', () => {
    const fromPhases = V2_BOARD_PHASES.flatMap((p) => p.stages);
    const inPipeline = ALL_STAGES.filter((s) => V2_STAGE_META[s].inPipeline);
    expect([...fromPhases].sort()).toEqual([...inPipeline].sort());
    expect(new Set(fromPhases).size).toBe(fromPhases.length);
  });

  it('never place a terminal stage on the board', () => {
    expect(V2_BOARD_PHASES.flatMap((p) => p.stages)).not.toContain('cancelled');
  });

  it('put the two parallel entry paths in the SAME phase', () => {
    // The whole point of grouping: `invited` and `pitched` are alternative
    // entries, not sequential steps, so they must sit under one header.
    const sourcing = V2_BOARD_PHASES.find((p) => p.id === 'sourcing')!;
    expect(sourcing.stages).toContain('invited');
    expect(sourcing.stages).toContain('pitched');
  });

  it('put the convergence point at the start of the next phase', () => {
    // Both entry paths converge at `negotiating`, so it opens Booking.
    const booking = V2_BOARD_PHASES.find((p) => p.id === 'booking')!;
    expect(booking.stages[0]).toBe('negotiating');
  });

  it('span exactly the 8 board columns in order', () => {
    const spans = V2_BOARD_PHASES.reduce((n, p) => n + p.stages.length, 0);
    expect(spans).toBe(V2_PIPELINE_STAGES.length);
    const flat = V2_BOARD_PHASES.flatMap((p) => p.stages);
    expect(flat).toEqual(V2_PIPELINE_STAGES.map((c) => c.id));
  });
});

// =====================================================================
// furthestPipelineStage — the funnel's honesty depends on this
// =====================================================================

describe('furthestPipelineStage', () => {
  const mkDb = (history: { from: string | null; to: string }[], stage: string) => ({
    ...buildDb(),
    collaborations: [{
      id: 'col_1', campaignId: 'cmp_1', creatorId: 'cr_1', brandId: 'br_1',
      stage, createdAt: 1, updatedAt: 1, agreedRate: 100, acceptedOfferId: null,
      contractId: null, cancelledAt: null, cancellationReason: null,
      history: history.map((h) => ({ ...h, at: 1, actorUserId: 'u_1' })),
    }],
  } as unknown as Parameters<typeof furthestPipelineStage>[2]);

  it('credits a cancelled collab for how far it actually got', () => {
    // The load-bearing case: cancelled says nothing about reach, and a collab
    // can be cancelled AFTER being booked. Counting by current stage would
    // report this pair as never having booked.
    const db = mkDb(
      [{ from: null, to: 'pitched' }, { from: 'pitched', to: 'negotiating' },
       { from: 'negotiating', to: 'confirmed' }, { from: 'confirmed', to: 'cancelled' }],
      'cancelled',
    );
    expect(furthestPipelineStage('cmp_1', 'cr_1', db)).toBe('confirmed');
  });

  it('ignores the terminal stage when picking the max', () => {
    // cancelled has order 99; it must never win the max comparison.
    const db = mkDb([{ from: null, to: 'pitched' }, { from: 'pitched', to: 'cancelled' }], 'cancelled');
    expect(furthestPipelineStage('cmp_1', 'cr_1', db)).toBe('pitched');
  });

  it('returns null when the pair never reached any pipeline stage', () => {
    const db = mkDb([], 'cancelled');
    // No history and a terminal current stage — nothing to credit.
    expect(furthestPipelineStage('cmp_1', 'cr_1', db)).toBeNull();
  });
});

describe('funnel step ordering is monotonic by construction', () => {
  it('each later step can only be a subset of the earlier one', () => {
    // The funnel counts "reached at least stage X", so a later step must never
    // exceed an earlier one. A funnel that goes UP is nonsense, and it would
    // be an easy regression if someone swapped a comparison.
    const ranks = ['negotiating', 'confirmed', 'submitted', 'live', 'paid']
      .map((s) => V2_STAGE_META[s as V2CollabStage].order);
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));

    // And a worked example over a roster of reach values.
    const reach = [1, 3, 4, 5, 8, 8];
    const atLeast = (o: number) => reach.filter((r) => r >= o).length;
    const counts = ranks.map(atLeast);
    for (let i = 1; i < counts.length; i++) {
      expect(counts[i]).toBeLessThanOrEqual(counts[i - 1]);
    }
  });
});

describe('furthestPipelineStage tolerates duplicate collab rows', () => {
  it('merges history across every row for the pair', () => {
    // The seeded world really does contain duplicate (campaign, creator)
    // Collaboration rows — 3 pairs, e.g. a seeded 'confirmed' row alongside a
    // migrator-materialized 'submitted' row for the same pair. A `.find()`
    // would read whichever came first and understate the funnel.
    const db = {
      ...buildDb(),
      collaborations: [
        { id: 'col_seed', campaignId: 'cmp_1', creatorId: 'cr_1', brandId: 'br_1',
          stage: 'confirmed', createdAt: 1, updatedAt: 1, agreedRate: 100,
          acceptedOfferId: null, contractId: null, cancelledAt: null,
          cancellationReason: null,
          history: [{ from: null, to: 'confirmed', at: 1, actorUserId: 'u_1' }] },
        { id: 'col_dup', campaignId: 'cmp_1', creatorId: 'cr_1', brandId: 'br_1',
          stage: 'submitted', createdAt: 2, updatedAt: 2, agreedRate: 100,
          acceptedOfferId: null, contractId: null, cancelledAt: null,
          cancellationReason: null,
          history: [{ from: 'confirmed', to: 'submitted', at: 2, actorUserId: 'u_1' }] },
      ],
    } as unknown as Parameters<typeof furthestPipelineStage>[2];
    // Must pick the furthest across BOTH rows, not the first row's stage.
    expect(furthestPipelineStage('cmp_1', 'cr_1', db)).toBe('submitted');
  });
});
