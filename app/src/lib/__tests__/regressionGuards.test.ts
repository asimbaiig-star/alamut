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
//
// Added since:
//
//   7. A field added to a persisted type, wired through the UI and the
//      mutations, and never added to the repository that saves it — so it
//      works perfectly in one browser and does not exist in any other.
//   8. A rule enforced in the mutation but not consulted by the UI that
//      fires it, so the user gets a dead button or a surprise toast instead
//      of the reason.

import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
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

// ─────────────────────────────────────────────────────────────────────
// CLASS 7 — every persisted field survives the round trip to Postgres
// ─────────────────────────────────────────────────────────────────────
//
// `settlementProposal` shipped complete: type, mutations, UI, tests. It
// worked in one browser and nowhere else, because the repository that
// writes collaborations to Supabase had never heard of it. A settlement
// is a handshake — the one person who had to see the proposal was the one
// person who structurally could not.
//
// Adding a field to a persisted interface has FIVE obligations, and
// TypeScript enforces none of them: the SQL column, the repo `Row` type,
// the SELECT list, the row→object mapper, and the object→row mapper. Miss
// any one and the field silently becomes browser-local.
//
// This derives the field list from the type itself, so a field added
// tomorrow is covered without anyone remembering to extend this test.

/** camelCase → snake_case, matching the column convention used throughout. */
function snake(s: string): string {
  return s.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
}

/** Field names declared on an exported interface in types.ts. */
function interfaceFields(name: string): string[] {
  const src = read('lib/api/types.ts');
  const start = src.indexOf(`export interface ${name} {`);
  expect(start, `interface ${name} not found in types.ts`).toBeGreaterThan(-1);
  const body = src.slice(start, src.indexOf('\n}', start));
  const out = new Set<string>();
  for (const line of body.split('\n').slice(1)) {
    // Only top-level declarations: exactly two spaces of indent. Skips
    // comments, and the inner keys of nested object literals.
    const m = /^ {2}(\w+)\??:/.exec(line);
    if (m) out.add(m[1]);
  }
  return [...out];
}

/** Every entity whose fields must survive a round trip to Postgres.
 *
 *  Table-driven on purpose. The first version of this guard checked only
 *  `Collaboration` — and so would NOT have caught `Dispute.proposal`, the
 *  very next field added, which is the identical bug one table over. A guard
 *  that only covers the instance that prompted it is barely a guard. */
const PERSISTED = [
  {
    entity: 'Collaboration',
    repo: 'lib/data/collaborationsRepo.ts',
    /** row → object, and object → row. Named per repo; both must map it. */
    fromRow: 'toCollab',
    toRow: 'toRowFields',
    /** A field present on the type but deliberately not a mapped column. */
    exempt: {
      createdAt: 'timestamptz default, never written by the client',
      updatedAt: 'timestamptz, set by trigger on write',
      version: 'optimistic lock — read for the guard, never in the write payload',
    } as Record<string, string>,
    /** Proves the parser matched something real. */
    sentinels: ['settlementProposal', 'cancellationRequest'],
  },
  {
    entity: 'Dispute',
    repo: 'lib/data/disputesRepo.ts',
    fromRow: 'toDispute',
    toRow: 'toInsertRow',
    exempt: {
      updatedAt: 'timestamptz, set by trigger on write',
      version: 'optimistic lock — read for the guard, never in the write payload',
    } as Record<string, string>,
    sentinels: ['proposal', 'resolution'],
  },
  {
    entity: 'Contract',
    repo: 'lib/data/contractsRepo.ts',
    fromRow: 'toContract',
    toRow: 'toInsertRow',
    exempt: {
      version: 'optimistic lock — read for the guard, never in the write payload',
    } as Record<string, string>,
    sentinels: ['rightsSnapshot', 'briefSnapshot'],
  },
  {
    entity: 'Deliverable',
    repo: 'lib/data/deliverablesRepo.ts',
    fromRow: 'toDeliverable',
    toRow: 'toInsertRow',
    exempt: {} as Record<string, string>,
    sentinels: ['creatorId', 'dueOffsetDays'],
  },
] as const;

describe.each(PERSISTED)(
  'a persisted field is persisted everywhere, or it is browser-local: $entity',
  ({ entity, repo: repoPath, fromRow, toRow, exempt, sentinels }) => {
    // Derived from the type, not hand-listed, so new fields are covered
    // without anyone remembering to extend this test.
    const fields = interfaceFields(entity);

    it('the interface is actually being read', () => {
      // Guards the parser: a regex that silently matched nothing would make
      // every assertion below vacuously pass.
      for (const s of sentinels) expect(fields).toContain(s);
      // Universal floor, not a per-entity count: the sentinels above already
      // prove the parser matched real declarations, and the smallest entity
      // here (Deliverable) has 9 fields. A hardcoded `> 10` was a threshold
      // fitted to Collaboration that failed the moment the table grew.
      expect(fields.length, `${entity}: parser matched suspiciously few fields`).toBeGreaterThan(5);
      // Nested keys of a SettlementTerms field must not leak in as fields.
      expect(fields).not.toContain('releaseToCreator');
    });

    it('every field reaches Postgres and comes back', () => {
      const repo = code(repoPath);
      // The three mappings, isolated so a failure names which one is missing.
      const columns = /const COLUMNS =([\s\S]*?);/.exec(repo)?.[1] ?? '';
      const toObj = new RegExp(`function ${fromRow}\\(([\\s\\S]*?)\\n}`).exec(repo)?.[1] ?? '';
      const toRowSrc = new RegExp(`function ${toRow}\\(([\\s\\S]*?)\\n}`).exec(repo)?.[1] ?? '';
      expect(columns, 'COLUMNS not found').not.toBe('');
      expect(toObj, `${fromRow} not found`).not.toBe('');
      expect(toRowSrc, `${toRow} not found`).not.toBe('');

      const missing: string[] = [];
      for (const f of fields) {
        if (f in exempt) continue;
        const col = snake(f);
        if (!columns.includes(col)) missing.push(`${f}: absent from the SELECT list`);
        if (!toObj.includes(col)) missing.push(`${f}: not read in ${fromRow} (hydrate drops it)`);
        if (!toRowSrc.includes(col)) missing.push(`${f}: not written in ${toRow} (save drops it)`);
      }
      expect(missing, missing.join('\n')).toEqual([]);
    });

    it('a column added to the repo has a migration that creates it', () => {
      // The other half: a mapping with no column behind it fails at runtime
      // with a PostgREST 42703, which the repo logs as a console.warn.
      const repo = code(repoPath);
      const columns = /const COLUMNS =([\s\S]*?);/.exec(repo)?.[1] ?? '';
      const declared = [...columns.matchAll(/\b([a-z][a-z0-9_]*)\b/g)].map((m) => m[1]);

      const dir = join(SRC, '..', 'supabase', 'migrations');
      const sql = readdirSync(dir)
        .filter((f) => f.endsWith('.sql'))
        .map((f) => readFileSync(join(dir, f), 'utf8'))
        // Strip `--` comments: a column named only in prose is not a column.
        // Migration 034's header discusses `settlement_proposal` at length.
        .map((f) => f.replace(/--[^\n]*/g, ''))
        .join('\n');

      // Whole-word, not substring. `includes('proposal')` was satisfied by
      // the `settlement_proposal` in migration 033, so deleting 034 entirely
      // left this test green — a guard with a hole exactly where the next
      // bug was. `_` is a word character, so \bproposal\b correctly does not
      // match inside settlement_proposal.
      const orphans = declared.filter((c) => !new RegExp(`\\b${c}\\b`).test(sql));
      expect(orphans, `selected but never created in SQL: ${orphans.join(', ')}`).toEqual([]);
    });
  },
);

describe('persistence round-trip, cross-cutting', () => {

  it('merging duplicate rows preserves every nullable, per its own contract', () => {
    // mergeCollabRows documents "a set value beats a null on every nullable
    // field". settlementProposal was omitted from that list, so deduping two
    // rows could drop a live proposal.
    const src = code('lib/api/collabSync.ts');
    const merge = /export function mergeCollabRows\(([\s\S]*?)\n}/.exec(src)?.[1] ?? '';
    expect(merge, 'mergeCollabRows not found').not.toBe('');
    for (const f of ['cancellationRequest', 'settlementProposal', 'contractId']) {
      expect(merge, `${f} not merged — a duplicate row can drop it`).toContain(f);
    }
  });
});


// ─────────────────────────────────────────────────────────────────────
// CLASS 8 — the UI asks the same question the mutation answers
// ─────────────────────────────────────────────────────────────────────
//
// `SendBriefModal` knew about per-campaign conflicts ("already applied",
// "offer already sent") but never consulted the creator's STANDING
// instructions. So a creator at capacity, on vacation, or auto-declining the
// category gave the brand a disabled button with no reason, then a toast from
// the mutation that did check. Found by clicking, after the same class had
// already been fixed twice: the topbar/DeliverableRow submit gate, and
// `SendOfferModal`'s three ad-hoc booleans.
//
// The rule is not "call this function" — it is that a guard which can refuse
// a user action must be reachable by the surface offering that action.

describe('a mutation guard the UI cannot see is a dead button', () => {
  const modalSrc = () => code('screens/workspace-v2/screens/WorkflowModals.tsx');

  it('every modal that sends work to a creator consults availability', () => {
    const src = modalSrc();
    // Both send-to-creator modals live in this file; both fire a mutation
    // that calls `availabilityBlock` and throws.
    const uses = src.match(/availabilityVerdict\(/g) ?? [];
    expect(uses.length, 'a send-to-creator modal is not checking availability')
      .toBeGreaterThanOrEqual(2);
  });

  it('and passes the live deal count, not just the creator', () => {
    // C4 blocks on a COUNT the verdict cannot derive on its own. Omitting it
    // silently disables only the capacity rule while the mutation still
    // enforces it — the worst version of this bug, because the other rules
    // keep working and hide it.
    const src = modalSrc();
    const calls = src.match(/availabilityVerdict\([\s\S]{0,220}?\)/g) ?? [];
    expect(calls.length).toBeGreaterThanOrEqual(2);
    for (const c of calls) {
      expect(c, `availabilityVerdict call omits activeDeals:\n${c}`).toContain('activeDeals');
    }
  });

  it('the mutations still enforce it themselves', () => {
    // The UI check is a courtesy; the mutation is the guarantee. If this
    // fails, the modal is the only thing standing between a creator and an
    // offer they said they did not want.
    expect(code('screens/workspace-v2/v2CampaignActions.ts')).toContain('availabilityBlock(');
    expect(code('screens/workspace-v2/v2CollabActions.ts')).toContain('availabilityBlock(');
  });
});

// ─────────────────────────────────────────────────────────────────────
// CLASS 9 — copy must describe what the code actually does
// ─────────────────────────────────────────────────────────────────────
//
// The KYC identity step read "Identity checks aren't automated yet — the
// Alamut team reviews these manually" while its CTA set `verified = true`
// instantly, client-side, with no document collected. Found by signing up as
// a genuinely new creator and pressing the button.
//
// Promising a human review and then self-approving on click is worse than
// either alone: the first person who presses it learns the rest of the page
// cannot be trusted either. Simulated is fine in a beta — this codebase
// simulates payments and says so. Simulated while claiming otherwise is the
// thing Phase 5 existed to remove, and it grew back in the one place a
// curious tester is most likely to click.
//
// The guard is narrow on purpose: it pins THIS contradiction rather than
// trying to police prose generally.

describe('a step that self-approves does not claim a human reviews it', () => {
  const kyc = () => read('screens/workspace-v2/screens/KycTax.tsx');

  it('the identity CTA still verifies synchronously', () => {
    // If this stops being true the rest of the block is moot — and the copy
    // should then be changed back to describe the real process.
    const src = code('screens/workspace-v2/screens/KycTax.tsx');
    expect(src).toMatch(/case 'identity':[\s\S]{0,600}?verified: true/);
  });

  it('so it does not promise a manual review', () => {
    // Comments are stripped: the ban is on user-visible copy, and the note
    // explaining the fix legitimately quotes the old wording.
    const src = code('screens/workspace-v2/screens/KycTax.tsx');
    expect(src).not.toMatch(/team reviews these manually/i);
    expect(src).not.toMatch(/aren.t automated yet/i);
  });

  it('and it says plainly that it is simulated', () => {
    expect(kyc()).toMatch(/Simulated in this beta/);
  });

  it('a step nobody verifies does not wear a "Verified" pill', () => {
    // bankStatus flips to 'verified' the moment an account number is typed:
    // no micro-deposit, no Plaid, no check of any kind. On a BANK row that
    // is the costliest version of the overclaim — a creator reads it as
    // "they confirmed this account can receive my payout".
    const src = code('screens/workspace-v2/screens/KycTax.tsx');
    expect(src).toMatch(/verifiedLabel: 'On file'/);
    // And the override has to actually reach the pill.
    expect(src).toMatch(/step\.verifiedLabel/);
  });

  it('the progress summary does not claim more than its own rows', () => {
    // "N of 5 steps verified" counted the bank row, whose pill reads "On
    // file" precisely because nobody verifies it. A summary that
    // contradicts the rows beneath it is the same overclaim one level up,
    // and it is the version a reader sees first.
    const src = code('screens/workspace-v2/screens/KycTax.tsx');
    expect(src).not.toMatch(/steps verified/);
    expect(src).toMatch(/steps complete/);
  });

  it('no third-party verification vendor is named in user-visible copy', () => {
    // The earlier version of this same defect claimed "Powered by Persona"
    // — borrowing a real company's credibility for work nobody does.
    //
    // Comment-stripped, like the assertion above: the code comments name
    // those vendors precisely to record that they are NOT integrated, and
    // banning the word outright would delete the explanation along with
    // the claim. (This test failed on its own first run for exactly that
    // reason.)
    for (const rel of [
      'screens/workspace-v2/screens/KycTax.tsx',
      'screens/workspace-v2/screens/CreatorWallet.tsx',
    ]) {
      expect(code(rel)).not.toMatch(/\bPersona\b|\bOnfido\b|\bJumio\b|\bStripe Identity\b/);
    }
  });
});


// ─────────────────────────────────────────────────────────────────────
// CLASS 10 — the landing page must not sell what the product deleted
// ─────────────────────────────────────────────────────────────────────
//
// The marketing surfaces were written before the honesty passes and never
// re-read afterwards. By the time Phase 5 finished deleting EMV and ROAS
// from the dashboard for being computed off invented impressions, the
// landing page was still promising "ROAS per UTM... clicks, conversions,
// attributed revenue — in your dashboard, in real time."
//
// That is the worst placement of an overclaim: it is the first thing a
// visitor reads and the last thing anyone re-reads. Four more sat beside it
// — reviewed-before-applying (nothing gates applying), audience overlap with
// your customers (no customer data exists), released when live and tracked
// (release is on approval; nothing is tracked), and PayPal payouts plus a
// "4 day average" that were invented whole.
//
// This pins the specific claims to the specific capabilities.

describe('marketing copy does not outrun the product', () => {
  const marketing = () =>
    ['screens/cover/scenes/LandingV2.tsx', 'screens/cover/Cover.tsx']
      .map((f) => code(f)).join('\n');

  it('does not promise attribution the dashboard does not do', () => {
    const src = marketing();
    expect(src).not.toMatch(/ROAS per UTM/i);
    expect(src).not.toMatch(/attributed revenue/i);
    expect(src).not.toMatch(/tracking link/i);
  });

  it('does not name a payout rail that does not exist', () => {
    // PayPal appeared in exactly one sentence and nowhere in the payout code.
    expect(marketing()).not.toMatch(/PayPal/i);
    expect(code('screens/workspace-v2/screens/KycTax.tsx')).not.toMatch(/PayPal/i);
  });

  it('does not quote an average nobody measured', () => {
    expect(marketing()).not.toMatch(/average \d+ days/i);
  });

  it('does not claim creators are screened before they can apply', () => {
    // v2ApplyToCampaign has no verification gate — a brand-new account can
    // apply the minute it signs up. If that changes, this test should be
    // updated deliberately, together with the copy.
    const apply = code('screens/workspace-v2/v2CampaignActions.ts');
    const fn = apply.slice(apply.indexOf('export function v2ApplyToCampaign'));
    expect(fn.slice(0, fn.indexOf('\n}'))).not.toMatch(/creator\.verified/);
    expect(marketing()).not.toMatch(/reviewed before they can apply/i);
  });

  it('the case study quotes no figure derived from a feature we lack', () => {
    // BrandLanding rendered a headline "5.2× ROAS" tile and pull-quote,
    // computed from seeded `tracking[].revenueAttributed`. A multiple is
    // the most quotable number on the page, which made it the most
    // damaging one to invent.
    const src = code('screens/cover/BrandLanding.tsx');
    expect(src).not.toMatch(/revenueAttributed/);
    expect(src).not.toMatch(/ROAS/);
  });

  it('NO FABRICATED QUOTE IS ATTRIBUTED TO A REAL COMPANY', () => {
    // The landing wall carried invented quotes from invented people at
    // Glossier, Hay, Le Labo, Le Creuset and National Foods, with stock
    // portraits and no label. That is not an overclaim — it is a
    // fabricated endorsement from companies that are not customers, and it
    // was live on a public page.
    const seed = code('lib/api/seed.ts');
    const block = seed.slice(seed.indexOf('shownTo:'));
    for (const real of ['Glossier', 'Le Labo', 'National Foods', ', Hay', 'Le Creuset']) {
      expect(block, `testimonial attributed to ${real}`).not.toContain(real);
    }
  });

  it('and the wall says plainly that the voices are illustrative', () => {
    expect(read('screens/cover/scenes/LandingV2.tsx')).toMatch(/Illustrative examples/);
    // "seed dataset" was the old admission — true, but in a register no
    // visitor reads as "these are made up".
    expect(code('screens/cover/scenes/LandingV2.tsx')).not.toMatch(/in the seed dataset/);
  });

  it('does not claim matching uses the brand\'s own customer data', () => {
    // matching.ts scores niche, engagement, geo, rate, history, category.
    expect(marketing()).not.toMatch(/overlap with your existing customers/i);
  });
});
