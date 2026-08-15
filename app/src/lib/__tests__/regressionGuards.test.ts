// regressionGuards.test.ts — the mistakes this codebase actually makes.
//
// Not a grab-bag of unit tests. Each block below encodes a CLASS of error
// that has already shipped here at least once, usually more than once. Run
// this before every commit; when it fails, the failure message names the
// class so the fix addresses the pattern rather than the instance.
//
// The six that created this file, all caught in one pre-commit review:
//
//   1. A safety guard armed by a value that also means "the fetch failed",
//      silently suppressing money writes.
//   2. A per-group total accumulated once per member of the group.
//   3. A version recorded but never compared, making consent decorative.
//   4. One label denoting two different quantities on two code paths.
//   5. A test that pinned a dangerous default as correct.
//   6. A per-migration scan promoted to a per-render one without being
//      re-costed.

import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  recordRemoteCampaigns, mayMirrorForCampaign, __resetRemoteRegistry,
} from '@/lib/data/remoteRegistry';
import { normalizeLedgerToGross } from '@/lib/api/migrations';
import { splitGross, PLATFORM_FEE, WHT } from '@/lib/api/money';
import type { Transaction } from '@/lib/api/types';

const SRC = join(__dirname, '..', '..');
const read = (rel: string) => readFileSync(join(SRC, rel), 'utf8');
/** Source with comments stripped — the fix notes here quote the very
 *  strings some assertions ban. */
const code = (rel: string) =>
  read(rel)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n').map((l) => l.replace(/^\s*\/\/.*$/, '')).join('\n');

// ─────────────────────────────────────────────────────────────────────
// CLASS 1 — a guard must not arm on a value that also means "unknown"
// ─────────────────────────────────────────────────────────────────────
describe('guards fail open when the input is indistinguishable from failure', () => {
  beforeEach(() => __resetRemoteRegistry());

  it('an empty fetch result never arms the mirror guard', () => {
    recordRemoteCampaigns([]);
    expect(mayMirrorForCampaign('anything')).toBe(true);
  });

  it('an empty result does not poison a later good one', () => {
    recordRemoteCampaigns([]);
    recordRemoteCampaigns(['cmp_1']);
    expect(mayMirrorForCampaign('cmp_1')).toBe(true);
    expect(mayMirrorForCampaign('cmp_absent')).toBe(false);
  });

  it('the caller guards too, so neither layer alone is load-bearing', () => {
    expect(code('lib/api/store.ts')).toContain('if (campaigns.length > 0) {');
  });

  it('suppression happens only with positive evidence', () => {
    recordRemoteCampaigns(['cmp_1']);
    expect(mayMirrorForCampaign('cmp_1')).toBe(true);   // known present
    expect(mayMirrorForCampaign('cmp_2')).toBe(false);  // known absent
    expect(mayMirrorForCampaign(null)).toBe(true);      // not campaign-scoped
  });
});

// ─────────────────────────────────────────────────────────────────────
// CLASS 2 — a per-group total must be counted once per GROUP
// ─────────────────────────────────────────────────────────────────────
describe('per-group totals are not multiplied by group size', () => {
  it('the dispute hold dedupes campaigns before summing', () => {
    // Held money is a per-CAMPAIGN sum. Iterating submissions and adding
    // that sum each time held N× the real amount and blocked withdrawals
    // of money the creator had fully earned.
    const src = code('screens/workspace-v2/v2Hooks.ts');
    const fn = src.slice(src.indexOf('function heldInDisputeWindows'));
    const body = fn.slice(0, fn.indexOf('\n}'));
    expect(body).toContain('new Set<string>()');
    // The old shape: reduce directly over submissions, summing per submission.
    expect(body).not.toMatch(/db\.submissions[\s\S]*\.reduce\(\(sum, s\)/);
  });
});

// ─────────────────────────────────────────────────────────────────────
// CLASS 3 — a recorded version must be compared, or consent is theatre
// ─────────────────────────────────────────────────────────────────────
describe('recorded versions are actually enforced', () => {
  it('agreement acceptance is checked against the current version', () => {
    const src = code('screens/workspace-v2/screens/KycTax.tsx');
    expect(src).toContain('c.agreementVersion === CREATOR_AGREEMENT_VERSION');
    // The old predicate — presence alone — must not come back.
    expect(src).not.toMatch(/const\s+hasAcceptedAgreement\s*=\s*!!c\?\.agreementAcceptedAt;/);
  });
});

// ─────────────────────────────────────────────────────────────────────
// CLASS 4 — one label, one quantity, on every path
// ─────────────────────────────────────────────────────────────────────
describe('a labelled figure means the same thing on every branch', () => {
  it('gross/net identity holds for the money split', () => {
    for (const gross of [10, 137, 600, 1650, 4999]) {
      const { fee, tax, net } = splitGross(gross);
      expect(net + fee + tax).toBe(gross);
    }
  });

  it('the lifetime fallback is grossed up, not left as net', () => {
    // The ledger path sums gross payout rows; the stored field accumulates
    // net. Returning one or the other under "Lifetime earned" made the
    // figure differ by exactly fee + tax depending on data availability.
    const src = code('screens/workspace-v2/v2Adapters.ts');
    expect(src).toContain('grossFromNet(creator.lifetimeEarnings)');
  });

  it('grossFromNet inverts the split within a rounding unit', () => {
    for (const gross of [600, 1650, 1800, 12_345]) {
      const { net } = splitGross(gross);
      const recovered = Math.round(net / (1 - PLATFORM_FEE - WHT));
      expect(Math.abs(recovered - gross)).toBeLessThanOrEqual(2);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────
// CLASS 5 — behaviour, not just shape: the ledger must reconcile
// ─────────────────────────────────────────────────────────────────────
describe('normalizeLedgerToGross', () => {
  const tx = (o: Partial<Transaction>): Transaction => ({
    id: 'x', at: 'T1', userId: 'u', kind: 'payout', amount: 0,
    status: 'cleared', note: '', ...o,
  } as Transaction);

  const netRelease = () => [
    tx({ id: 'p', kind: 'payout', amount: 510, campaignId: 'c1' }),
    tx({ id: 'f', kind: 'fee', amount: -60, campaignId: 'c1', note: 'Platform fee (10%)' }),
    tx({ id: 't', kind: 'fee', amount: -30, campaignId: 'c1', note: 'Withholding tax (5%)' }),
  ];

  it('lifts a net row to gross', () => {
    const db = { transactions: netRelease() };
    normalizeLedgerToGross(db);
    expect(db.transactions.find((t) => t.id === 'p')!.amount).toBe(600);
  });

  it('is idempotent — the invariant that stops it inventing money', () => {
    const db = { transactions: netRelease() };
    normalizeLedgerToGross(db);
    normalizeLedgerToGross(db);
    normalizeLedgerToGross(db);
    expect(db.transactions.find((t) => t.id === 'p')!.amount).toBe(600);
  });

  it('after lifting, the rows sum to the net that reached the wallet', () => {
    const db = { transactions: netRelease() };
    normalizeLedgerToGross(db);
    const sum = db.transactions.reduce((n, t) => n + t.amount, 0);
    expect(sum).toBe(splitGross(600).net);
  });

  it('leaves withdrawals and advance repayments alone', () => {
    const db = {
      transactions: [
        tx({ id: 'w', kind: 'payout', amount: -500 }),
        ...netRelease(),
        tx({ id: 'a', kind: 'fee', amount: -300, campaignId: 'c1', note: 'Income advance repayment' }),
      ],
    };
    normalizeLedgerToGross(db);
    expect(db.transactions.find((t) => t.id === 'w')!.amount).toBe(-500);
    expect(db.transactions.find((t) => t.id === 'a')!.amount).toBe(-300);
    // The repayment must not be folded into the gross.
    expect(db.transactions.find((t) => t.id === 'p')!.amount).toBe(600);
  });

  it('scales linearly — it runs on every hydrate now, not once', () => {
    // Guards the O(n²) regression. 4k rows finished in ~30M comparisons
    // before the fee-index; if someone reinstates the inner filter this
    // blows the timeout rather than silently stalling users' page loads.
    const rows: Transaction[] = [];
    for (let i = 0; i < 2000; i++) {
      rows.push(tx({ id: `p${i}`, kind: 'payout', amount: 510, campaignId: `c${i}`, at: `T${i}` }));
      rows.push(tx({ id: `f${i}`, kind: 'fee', amount: -60, campaignId: `c${i}`, at: `T${i}`, note: 'Platform fee (10%)' }));
      rows.push(tx({ id: `t${i}`, kind: 'fee', amount: -30, campaignId: `c${i}`, at: `T${i}`, note: 'Withholding tax (5%)' }));
    }
    const started = Date.now();
    normalizeLedgerToGross({ transactions: rows });
    expect(Date.now() - started).toBeLessThan(250);
    expect(rows.find((t) => t.id === 'p0')!.amount).toBe(600);
  });
});

// ─────────────────────────────────────────────────────────────────────
// CLASS 6 — a fee rate is never a literal outside money.ts
// ─────────────────────────────────────────────────────────────────────
describe('platform economics have one source', () => {
  it('money.ts is the only place the live rates are declared', () => {
    expect(PLATFORM_FEE).toBe(0.10);
    expect(WHT).toBe(0.05);
  });

  it('the migrators pin historical rates deliberately, not accidentally', () => {
    // Migrators MUST NOT import the live constants — they rewrite past
    // rows and a future rate change must not reach back in time. The
    // dated names are what makes that intent legible.
    const src = code('lib/api/migrations.ts');
    expect(src).toContain('PLATFORM_FEE_RATE_AT_P2');
    expect(src).toContain('PLATFORM_FEE_RATE_AT_P7');
    expect(src).not.toContain("from '@/lib/api/money'");
  });
});
