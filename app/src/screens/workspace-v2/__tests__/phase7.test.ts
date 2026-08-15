// phase7.test.ts — the workflow completions, and the ledger convention.
//
// Two groups here:
//
//  1. THE LEDGER RECONCILES. The creator's payout row now carries the GROSS
//     the deal was worth, and the platform-fee / withholding rows are real
//     debits rather than annotations. The invariant that buys: every cleared
//     row a creator has sums to their wallet balance. Under the old
//     convention it summed short by exactly fee + tax, forever.
//
//  2. BUTTONS THAT CLAIM AN ACTION PERFORM IT. Static checks over the
//     surfaces where the audit found a control that navigated, toasted, or
//     duplicated its neighbour instead of doing what its label said.

import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { useStore } from '@/lib/api/store';
import { splitGross } from '@/lib/api/money';
import { aggregateAudienceForTest } from '../v2Adapters';

const SCREENS = join(__dirname, '..', 'screens');
const read = (rel: string) => readFileSync(join(SCREENS, rel), 'utf8');
/** Source with `//` and block comments removed — the fix notes in this repo
 *  quote the very strings the assertions ban. */
function code(rel: string): string {
  return read(rel)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((l) => l.replace(/^\s*\/\/.*$/, ''))
    .join('\n');
}

describe('creator ledger reconciles with the wallet', () => {
  beforeEach(() => {
    useStore.getState().setSession(null);
  });

  it('gross = net + fee + withholding, and the rows sum to the movement', () => {
    // The identity the convention rests on, checked against money.ts rather
    // than a copied constant.
    for (const gross of [10, 137, 1500, 4999]) {
      const { fee, tax, net } = splitGross(gross);
      expect(net + fee + tax).toBe(gross);
      // Rows written at release: +gross, -fee, -tax.
      expect(gross - fee - tax).toBe(net);
    }
  });

  it('a $10 deal still splits without rounding a deduction away', () => {
    // The rounding case that made the preview and the release disagree.
    const { fee, tax, net } = splitGross(10);
    expect(fee).toBe(1);
    expect(tax).toBe(1);
    expect(net).toBe(8);
  });
});

describe('audience demographics carry every bucket the data has', () => {
  it('projects 35-44, which two consumers depend on', () => {
    // `V2Audience.age3544` was never populated: Discover's "Gen X · 35–44"
    // filter could not match anyone, and BrandAnalytics drew 0% for the
    // band and swept its real share into the 45+ residual.
    const audience = aggregateAudienceForTest([
      {
        genderSplit: { female: 0.62, male: 0.36, other: 0.02 },
        ageBuckets: { '13-17': 0.02, '18-24': 0.28, '25-34': 0.41, '35-44': 0.18, '45-54': 0.08, '55+': 0.03 },
        topCountries: [{ country: 'Pakistan', pct: 0.7 }],
        growthRate30d: 0.04,
        suspiciousFollowerPct: 0.03,
        audienceCredibilityScore: 88,
      },
    ]);
    expect(audience).not.toBeNull();
    expect(audience!.age3544).toBe(18);
    expect(audience!.age2534).toBe(41);
    expect(audience!.female).toBe(62);
  });

  it('still returns null when no channel reports demographics', () => {
    expect(aggregateAudienceForTest([])).toBeNull();
  });
});

describe('controls do what their label says', () => {
  it('BrandHome "Send brief" is not a second "View profile"', () => {
    const src = code('BrandHome.tsx');
    // Pre-fix both buttons ran the identical `onRoute(\`creator:${...}\`)`.
    const profileRoutes = src.match(/onRoute\(`creator:\$\{creator\.id\}`\)/g) ?? [];
    expect(profileRoutes.length).toBe(1);
    expect(src).toContain('SendBriefModal');
  });

  it('Discover cards can shortlist and brief without opening the profile', () => {
    const src = code('Discover.tsx');
    expect(src).toContain('v2ToggleSavedCreator');
    expect(src).toContain('SendBriefModal');
  });

  it('SendBriefModal only offers campaigns a creator could actually see', () => {
    const src = code('WorkflowModals.tsx');
    const modal = src.slice(src.indexOf('export function SendBriefModal'));
    expect(modal).toContain("c.stage === 'live'");
    expect(modal).toContain('v2InviteCreator');
  });

  it('CollabDetail gates "Submit content" on an accepted offer', () => {
    const src = code('CollabDetail.tsx');
    expect(src).toContain('canSubmitContent');
    expect(src).toContain('disabled={!canSubmitContent || !nextSlot}');
  });

  it('the calendar "+N more" opens the day rather than only counting it', () => {
    const src = code('Calendar.tsx');
    expect(src).toContain('setExpandedDay(key)');
    expect(src).toContain('expandedDay === key ? dayEntries : dayEntries.slice(0, 3)');
  });

  it('BriefDetail refuses the pitch form on a brief that cannot accept it', () => {
    const src = code('BriefDetail.tsx');
    expect(src).toContain("campaign.status !== 'Live'");
  });

  it('team access is one component, reachable from the brand profile', () => {
    expect(code('BrandProfile.tsx')).toContain('TeamAccessAside');
    expect(code('CampaignDetail.tsx')).toContain("from './TeamAccess'");
    // And not re-declared in the screen it was lifted out of.
    expect(code('CampaignDetail.tsx')).not.toContain('function TeamAccessAside(');
  });
});

describe('money inputs are named for screen readers', () => {
  const cases: [string, string][] = [
    ['BrandWallet.tsx', 'v2-topup-amount'],
    ['CreatorWallet.tsx', 'v2-withdraw-amount'],
    ['CreatorWallet.tsx', 'v2-advance-amount'],
    ['WorkflowModals.tsx', 'v2-offer-rate'],
    ['WorkflowModals.tsx', 'v2-counter-rate'],
    ['BriefDetail.tsx', 'v2-pitch-price'],
    ['NewCampaignWizard.tsx', 'v2-campaign-budget'],
    // The second sweep. The first pass fixed the modals and missed every
    // money field that reached its label through a `Field` / `FormField`
    // wrapper — those wrappers render the label as a SIBLING, so all four
    // rate-card ranges, the rate floor, the onboarding rates and the brand's
    // monthly budget were still announced unnamed.
    ['Storefront.tsx', 'v2-rate-reel'],
    ['Storefront.tsx', 'v2-rate-story'],
    ['Storefront.tsx', 'v2-rate-post'],
    ['Storefront.tsx', 'v2-rate-longform'],
    ['Storefront.tsx', 'v2-min-rate'],
    ['CreatorOnboardingV2.tsx', 'v2-onb-reel-rate'],
    ['CreatorOnboardingV2.tsx', 'v2-onb-story-rate'],
    ['CreatorOnboardingV2.tsx', 'v2-onb-combo-rate'],
    ['BrandOnboardingV2.tsx', 'v2-onb-monthly-budget'],
  ];
  for (const [file, id] of cases) {
    it(`${file} associates its label with #${id}`, () => {
      const src = code(file);
      expect(src).toContain(`htmlFor="${id}"`);
      expect(src).toContain(`id="${id}"`);
    });
  }
});

describe('migrateP7 — historical payout rows are restored to gross', () => {
  // Rows written before the convention changed are net. They have to be
  // lifted, but lifting them twice would invent money — so the detection
  // must be exact and the migrator must be safe to re-run.
  type Tx = { id: string; at: string; userId: string; kind: string; amount: number; status: string; campaignId?: string; note?: string };
  const build = (rows: Tx[]) => ({ transactions: rows, migrationVersion: 9 });

  const netRelease = (): Tx[] => [
    { id: 'p1', at: 'T1', userId: 'u_c', kind: 'payout', amount: 510, status: 'cleared', campaignId: 'cmp_1' },
    { id: 'f1', at: 'T1', userId: 'u_c', kind: 'fee', amount: -60, status: 'cleared', campaignId: 'cmp_1', note: 'Platform fee (10%)' },
    { id: 'f2', at: 'T1', userId: 'u_c', kind: 'fee', amount: -30, status: 'cleared', campaignId: 'cmp_1', note: 'Withholding tax (5%)' },
  ];

  it('rewrites a net payout to its gross', async () => {
    const { runPendingMigrations } = await import('@/lib/api/migrations');
    const db = build(netRelease());
    runPendingMigrations(db as never);
    expect(db.transactions.find((t) => t.id === 'p1')!.amount).toBe(600);
  });

  it('is idempotent — a second pass leaves the gross alone', async () => {
    const { runPendingMigrations } = await import('@/lib/api/migrations');
    const db = build(netRelease());
    runPendingMigrations(db as never);
    db.migrationVersion = 9;
    runPendingMigrations(db as never);
    expect(db.transactions.find((t) => t.id === 'p1')!.amount).toBe(600);
  });

  it('leaves an advance repayment out of the split', async () => {
    const { runPendingMigrations } = await import('@/lib/api/migrations');
    const rows = netRelease();
    rows.push({ id: 'f3', at: 'T1', userId: 'u_c', kind: 'fee', amount: -300, status: 'cleared', campaignId: 'cmp_1', note: 'Income advance repayment' });
    const db = build(rows);
    runPendingMigrations(db as never);
    // Gross is still 600 — the repayment is a wallet debit, not a deduction
    // from the deal value, so it must not be folded back in.
    expect(db.transactions.find((t) => t.id === 'p1')!.amount).toBe(600);
    expect(db.transactions.find((t) => t.id === 'f3')!.amount).toBe(-300);
  });

  it('leaves a withdrawal alone', async () => {
    const { runPendingMigrations } = await import('@/lib/api/migrations');
    const db = build([
      { id: 'w1', at: 'T2', userId: 'u_c', kind: 'payout', amount: -500, status: 'cleared', note: 'Withdrawal to bank' },
    ]);
    runPendingMigrations(db as never);
    expect(db.transactions.find((t) => t.id === 'w1')!.amount).toBe(-500);
  });
});

describe('every upload entry point respects the offer gate', () => {
  // The first attempt gated only the topbar button. `deriveCollab`
  // synthesizes a pending slot for any collab past `invited`, so the
  // per-slot "Upload" buttons — the primary path — were still live at
  // `pitched` and `negotiating`, where v2SubmitContent throws. So was the
  // `?action=upload` deep link.
  const src = code('CollabDetail.tsx');

  it('the per-slot row takes the gate as a prop', () => {
    expect(src).toContain('canSubmit={canSubmitContent}');
    expect(src).toMatch(/function DeliverableRow\(\{ deliverable, canSubmit, onUpload \}/);
  });

  it('the pending-slot Upload button is behind it', () => {
    expect(src).toMatch(/deliverable\.status === 'pending' && \(\s*canSubmit \?/);
  });

  it('the resubmit button is behind it too', () => {
    expect(src).toContain("deliverable.status === 'revision' && canSubmit &&");
  });

  it('the ?action=upload deep link is behind it', () => {
    expect(src).toContain("initialAction === 'upload' && canSubmitContent");
  });

  it("CreatorHome's Today list doesn't offer upload before acceptance", () => {
    // Same defect, one surface over: the tile generator accepted `pitched`,
    // so a creator who had only applied got a "Submit <deliverable>" tile
    // deep-linking to the modal — under a sub-line claiming their proposed
    // rate was "in escrow". With the deep link now gated, leaving this in
    // would have downgraded the error to a tile that silently does nothing.
    const home = code('CreatorHome.tsx');
    expect(home).not.toContain("c.stage !== 'confirmed' && c.stage !== 'pitched'");
    expect(home).toContain("if (c.stage !== 'confirmed') continue;");
  });

  it('the gate is declared before the effect that reads it', () => {
    // This component early-returns twice before the block where the other
    // derived values live. A const read from an effect closure in a render
    // that bailed out early hits the temporal dead zone.
    const declIdx = src.indexOf('const canSubmitContent =');
    const effectIdx = src.indexOf("initialAction === 'upload' && canSubmitContent");
    expect(declIdx).toBeGreaterThan(-1);
    expect(declIdx).toBeLessThan(effectIdx);
    // And it tolerates a null collab, since it now runs before that check.
    expect(src).toContain('!!collab && [');
  });
});
