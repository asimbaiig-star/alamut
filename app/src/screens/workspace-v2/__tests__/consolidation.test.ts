// consolidation.test.ts — one implementation per concept.
//
// The dominant defect across this whole audit was a canonical module with a
// drifted copy still wired to the UI. Behavioural tests can't catch that:
// both versions "work", they just disagree. So these are mostly structural —
// they assert the copies stay gone and the canonical module stays imported.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { V2_STAGE_META } from '../v2Adapters';
import { getLatestSubmissionFor } from '../v2CampaignActions';
import { useStore } from '@/lib/api/store';
import {
  buildDb, buildCampaign, buildCreator, buildBrand, buildSubmission,
} from '@/lib/utils/__tests__/fixtures';
import type { V2CollabStage } from '../data';

const SRC = join(__dirname, '..');
const read = (rel: string) => readFileSync(join(SRC, rel), 'utf8');

/** Source with comments stripped — a mention in a note explaining the
 *  removal is the opposite of a regression. */
function code(rel: string): string {
  return read(rel)
    .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

describe('fit scoring has exactly one implementation', () => {
  it('BriefDetail imports the canonical matcher', () => {
    expect(code('screens/BriefDetail.tsx')).toContain("from '../matching'");
  });

  it('BriefDetail no longer floors its own facets', () => {
    // The private scorer's floors (audience ≥ 40, niche ≥ 50, ER ≥ 20,
    // geo ≥ 40, history ≥ 50) meant `overall` could never fall below 40,
    // so a creator with no data at all read "40% · Stretch match".
    const src = code('screens/BriefDetail.tsx');
    expect(src).not.toContain('Math.max(40, Math.min(98');
    expect(src).not.toContain('const niche =');
  });

  it('BriefDetail no longer compares geography against the deliverables string', () => {
    // `campaign.placement` is "1 IG post + 1 Reel". matching.ts documents
    // this exact bug as fixed; the copy still had it.
    const src = code('screens/BriefDetail.tsx');
    expect(src).not.toMatch(/placement\.includes\(city\)/);
  });

  it('sparkEngine ranks with the matcher rather than the review rating', () => {
    const src = code('sparkEngine.ts');
    expect(src).toContain("from './matching'");
    // The old sort: `(b.score ?? -1) - (a.score ?? -1)` over V2Creator.score,
    // which is the review rating rescaled — not fit.
    expect(src).not.toMatch(/candidates\.sort\(\(a, b\) => \(b\.score/);
  });

  it('sparkEngine no longer claims a fit-score ranking in fixed copy', () => {
    const src = code('sparkEngine.ts');
    expect(src).not.toContain('I ranked by fit-score');
    expect(src).not.toContain('Sorted by fit-score (highest first).');
  });

  it('BrandHome asks the matcher for its "why this match" reasons', () => {
    const src = code('screens/BrandHome.tsx');
    expect(src).toContain('matchCreatorToBrand');
    expect(src).not.toContain('Audience overlap + fast replies');
  });
});

describe('one viewer resolver', () => {
  it('Inbox uses the exported getViewerUserId', () => {
    const src = code('screens/Inbox.tsx');
    expect(src).toContain('getViewerUserId(db,');
    // The local copy ignored session.userId and took the first user with a
    // matching role — correct only because Hannah and Sarah are first in
    // the seed array.
    expect(src).not.toMatch(/db\.users\.find\(\(u\) =>\s*\n?\s*persona === 'brand' \? u\.brandId : u\.creatorId/);
  });
});

describe('one stage model', () => {
  it('CollabDetail derives its timeline from V2_STAGE_META', () => {
    const src = code('screens/CollabDetail.tsx');
    expect(src).toContain('V2_STAGE_META');
    expect(src).not.toContain("const TIMELINE_ORDER");
  });

  it('every in-pipeline stage has a timeline position, including invited', () => {
    // `invited` was absent from the hand-written array, so indexOf returned
    // -1 and NO step rendered as done or active — on a creator's very first
    // view of a cold invite.
    const stages = (Object.keys(V2_STAGE_META) as V2CollabStage[])
      .filter((s) => V2_STAGE_META[s].inPipeline)
      .sort((a, b) => V2_STAGE_META[a].order - V2_STAGE_META[b].order);
    expect(stages).toContain('invited');
    expect(stages).toContain('live');
    for (const s of stages) expect(stages.indexOf(s)).toBeGreaterThanOrEqual(0);
  });
});

describe('one avatar renderer', () => {
  it.each([
    ['screens/Storefront.tsx', '../'],
    ['../../components/storefront/sections/StorefrontHero.tsx', '../'],
  ])('%s uses Avatar, not a raw background-image portrait', (rel) => {
    const src = code(rel);
    expect(src).not.toMatch(/backgroundImage: `url\(\$\{(creator\.)?portrait\}\)`/);
    expect(src).toContain('<Avatar');
  });
});

describe('getLatestSubmissionFor', () => {
  // `round` restarts at 1 per deliverable, so sorting by it across
  // deliverables could return a submission from a different slot — and the
  // kanban's "Mark as live" button targets whatever this returns.
  it('scopes to a deliverable when one is given', () => {
    useStore.getState().setDB(buildDb({
      creators: [buildCreator({ id: 'cr_1' })],
      brands: [buildBrand({ id: 'br_1' })],
      campaigns: [buildCampaign({ id: 'cmp_1', brandId: 'br_1' })],
      submissions: [
        buildSubmission({ id: 's_a3', campaignId: 'cmp_1', creatorId: 'cr_1', deliverableId: 'del_a', round: 3, submittedAt: '2026-01-01T00:00:00Z' }),
        buildSubmission({ id: 's_b1', campaignId: 'cmp_1', creatorId: 'cr_1', deliverableId: 'del_b', round: 1, submittedAt: '2026-06-01T00:00:00Z' }),
      ],
    }));
    // Unscoped: the newest wins, not the highest round.
    expect(getLatestSubmissionFor('cmp_1', 'cr_1')?.id).toBe('s_b1');
    // Scoped: only that deliverable's submissions are considered.
    expect(getLatestSubmissionFor('cmp_1', 'cr_1', 'del_a')?.id).toBe('s_a3');
    expect(getLatestSubmissionFor('cmp_1', 'cr_1', 'del_b')?.id).toBe('s_b1');
  });
});

describe('predicates are shared, not re-inlined', () => {
  it('Calendar has exactly one overdue rule', () => {
    const src = code('screens/Calendar.tsx');
    // `isOverdueEntry` is the rule. Any other bare `+e.date < +TODAY` is a
    // third copy — which is what made the Upcoming list flag approved work
    // as overdue while the header and grid did not.
    const inlineCopies = (src.match(/\+e\.date < \+TODAY/g) ?? []).length;
    expect(inlineCopies).toBeLessThanOrEqual(1); // the one inside isOverdueEntry
  });

  it('the Content-review badge counts deliverables, matching its grid', () => {
    const src = code('screens/CampaignDetail.tsx');
    expect(src).toContain('countDeliverablesInReview(activeCollabs)');
  });
});

describe('campaign writes are version-checked', () => {
  it.each([
    ['v2CampaignActions.ts', 'updateCampaignInSupabase(campaignId, patch, expectedVersion)'],
    ['v2Hooks.ts', 'camp.version)'],
  ])('%s passes expectedVersion', (file, needle) => {
    expect(code(file)).toContain(needle);
  });
});
