// stageModel.test.ts — the collab stage model is single-source and complete.
//
// These pin the invariants that were silently violated before: the type
// declared 8 stages, the state machine produced 9, and each surface improvised
// its own handling of the one it didn't know about.

import { describe, it, expect } from 'vitest';
import { V2_STAGE_META, V2_PIPELINE_STAGES, isActiveCollab } from '../v2Adapters';
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
