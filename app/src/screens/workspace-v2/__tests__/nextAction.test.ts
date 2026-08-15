// nextAction.test.ts — every stage has an owner and a move.
//
// The property under test is the one that was missing: at any point in a
// live collaboration, exactly one party can act to advance it, both parties
// can see who that is, and no stage renders as silence.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { nextAction, nextActionFor } from '../nextAction';
import { COLLAB_STAGE_ORDER } from '@/lib/api/collabSync';
import type { V2CollabStage } from '../data';

const ALL_STAGES: V2CollabStage[] = [...COLLAB_STAGE_ORDER, 'cancelled'] as V2CollabStage[];

describe('every stage resolves', () => {
  it('covers the whole union with no blanks', () => {
    for (const stage of ALL_STAGES) {
      const a = nextAction(stage);
      expect(a.label.trim().length, `${stage} label`).toBeGreaterThan(0);
      expect(a.waitingLabel.trim().length, `${stage} waitingLabel`).toBeGreaterThan(0);
      expect(['brand', 'creator', 'nobody']).toContain(a.owner);
    }
  });

  it('gives the non-actor a waiting line, never emptiness', () => {
    // Gap 2 was a brand card that rendered NOTHING. "Not your turn" is
    // information; its absence is what made the brand unable to tell whether
    // they were the blocker.
    for (const stage of ALL_STAGES) {
      for (const viewer of ['brand', 'creator'] as const) {
        const { text } = nextActionFor(stage, viewer);
        expect(text.trim().length, `${stage}/${viewer}`).toBeGreaterThan(0);
      }
    }
  });

  it('assigns an owner to every non-terminal stage', () => {
    const terminal: V2CollabStage[] = ['paid', 'cancelled'];
    for (const stage of ALL_STAGES) {
      if (terminal.includes(stage)) continue;
      const owner = nextAction(stage, { campaignClosed: false }).owner;
      expect(owner, `${stage} must be someone's move`).not.toBe('nobody');
    }
  });
});

describe('the four gaps that prompted this', () => {
  it('gap 1 — approved is the CREATOR’s move until the link is up', () => {
    expect(nextAction('approved', { allSlotsHavePermalink: false })).toMatchObject({
      owner: 'creator', intent: 'add-live-link',
    });
    // ...then it flips to the brand to verify.
    expect(nextAction('approved', { allSlotsHavePermalink: true })).toMatchObject({
      owner: 'brand', intent: 'confirm-live',
    });
  });

  it('gap 2 — submitted with a slot in revision is the creator’s move', () => {
    expect(nextAction('submitted', { hasSlotInReview: false, hasSlotInRevision: true }))
      .toMatchObject({ owner: 'creator', intent: 'resubmit-content' });
    expect(nextAction('submitted', { hasSlotInReview: true }))
      .toMatchObject({ owner: 'brand', intent: 'review-submission' });
  });

  it('gap 3 — live is the brand’s move: close the campaign to settle', () => {
    // Both sides read `live` as finished, but `paid` needs the campaign
    // closed. Nothing said so, and deals sat there indefinitely.
    expect(nextAction('live', { campaignClosed: false })).toMatchObject({
      owner: 'brand', intent: 'close-campaign',
    });
    expect(nextAction('live', { campaignClosed: true }).owner).toBe('nobody');
  });

  it('gap 4 — a bare invite is still the creator’s move', () => {
    expect(nextAction('invited', { hasOffer: false }).owner).toBe('creator');
    expect(nextAction('invited', { hasOffer: true }).intent).toBe('accept-or-counter-offer');
  });
});

describe('negotiation alternates on ball position, not on stage', () => {
  it('is the creator’s move when an offer awaits them', () => {
    expect(nextAction('negotiating', { offerAwaitingCreator: true }).owner).toBe('creator');
  });
  it('is the brand’s move after the creator counters', () => {
    expect(nextAction('negotiating', { offerAwaitingCreator: false }).owner).toBe('brand');
  });
});

describe('the surfaces consume it', () => {
  const src = (p: string) =>
    readFileSync(join(__dirname, '..', p), 'utf8');

  it('the brand kanban card falls back to it instead of rendering blank', () => {
    const card = src('screens/CampaignDetail.tsx');
    expect(card).toContain('if (!stageAction) {');
    expect(card).toContain('nextAction(collab.stage');
  });

  it('the creator’s approved banner offers the action it describes', () => {
    const banner = src('screens/StageActionBanner.tsx');
    expect(banner).toContain('Add live link');
    expect(banner).toContain('onAddLiveLink');
  });
});
