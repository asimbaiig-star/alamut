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
//   9. Copy describing a process the code does not perform.
//  10. Marketing selling a capability the product deleted.
//  11. A past-tense event asserted from a stage or a price rather than read
//      from the record of it happening.
//  12. A row readable by anyone who can reach the endpoint, because every
//      migration that set out to "tighten RLS" modelled a user PLANTING a
//      row and none of them modelled a user READING one.
//  13. A test suite that talked to production, because Vite loads
//      `.env.local` in test mode and nothing said otherwise.
//  14. Data fetched as one identity kept for the next: hydration ran once,
//      at page load, so a visitor who signed in kept the signed-out view.

import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import {
  recordRemoteCampaigns, mayMirrorForCampaign, __resetRemoteRegistry,
} from '@/lib/data/remoteRegistry';
import { normalizeLedgerToGross } from '@/lib/api/migrations';
import { splitGross, PLATFORM_FEE, WHT } from '@/lib/api/money';
import { isSupabaseConfigured } from '@/lib/supabase';
import { campaignIdsForRegistry } from '@/lib/data/campaignsRepo';
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
    // Since 039 the store merges two campaign reads. The arming decision is
    // one pure function, and the store may arm only through it.
    const src = code('lib/api/store.ts');
    expect(src).toContain('campaignIdsForRegistry(campaignsRead, publicCampaignsRead)');
    expect(src).toMatch(/if \(registryIds\) \{\s*const \{ recordRemoteCampaigns \}/);
    expect(src.match(/recordRemoteCampaigns\(/g), 'a second, unguarded arming call').toHaveLength(1);
  });

  it('the arming rule refuses every read that might have failed', () => {
    // A union of two reads reintroduces this class through a PARTIAL
    // failure: raw errors to [] while the projection succeeds, the registry
    // arms with published briefs only, and the brand's drafts — which only
    // the raw read carries — lose every write, silently.
    const ok = <T,>(rows: T[]) => ({ rows, status: 'ok' as const });
    const failed = { rows: [], status: 'failed' as const };
    const missing = { rows: [], status: 'missing' as const };
    const c = (id: string) => ({ id }) as never;
    expect(campaignIdsForRegistry(failed, ok([c('cmp_pub')])), 'raw failed').toBeNull();
    expect(campaignIdsForRegistry(ok([c('cmp_own')]), failed), 'projection failed').toBeNull();
    expect(campaignIdsForRegistry(ok([]), ok([])), 'both empty').toBeNull();
    expect(campaignIdsForRegistry(ok([c('cmp_all')]), missing), 'before 038').toEqual(['cmp_all']);
    expect(campaignIdsForRegistry(ok([c('cmp_draft')]), ok([c('cmp_pub')])), 'union')
      .toEqual(['cmp_draft', 'cmp_pub']);
    expect(campaignIdsForRegistry(ok([]), ok([c('cmp_pub')])), 'a creator with no deals yet')
      .toEqual(['cmp_pub']);
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
  // The public pages are src/landing, prerendered into index.html and
  // for-brands/index.html, whose <head> carries the share text a link
  // preview shows. Every check reads ALL of it: the old list of filenames
  // skipped the live /for-brands page entirely, and a list can't see a file
  // added after it was written.
  const landingFiles = (): string[] => {
    const out: string[] = [];
    const walk = (dir: string) => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, e.name);
        if (e.isDirectory()) { if (e.name !== '__tests__') walk(full); }
        else if (/\.(ts|tsx)$/.test(e.name)) out.push(full.slice(SRC.length + 1));
      }
    };
    walk(join(SRC, 'landing'));
    return out;
  };
  const shells = () => ['index.html', 'for-brands/index.html']
    .map((f) => readFileSync(join(SRC, '..', f), 'utf8').replace(/<!--[\s\S]*?-->/g, ''))
    .join('\n');
  const marketing = () => landingFiles().map(code).join('\n') + '\n' + shells();
  /** What the pages CLAIM. A capability that isn't live may be named in a
   *  page's "Coming next" list — saying so plainly is what that list is
   *  for — so its entries are cut before any claim check runs. */
  const claims = () => marketing().replace(/<NotYet items=\{\[[\s\S]*?\]\} \/>/g, '');

  it('reads both pages, and both still say what is not live', () => {
    const files = landingFiles();
    expect(files).toContain('landing/CreatorsPage.tsx');
    expect(files).toContain('landing/BrandsPage.tsx');
    for (const page of ['landing/CreatorsPage.tsx', 'landing/BrandsPage.tsx']) {
      expect(code(page), `${page} lost its "Coming next" list`).toMatch(/<NotYet items=\{\[/);
    }
    // The cut must actually cut — or every claim check below is checking a
    // string that still contains the honest list and proves nothing.
    expect(marketing()).toMatch(/Click tracking and revenue attribution/);
    expect(claims()).not.toMatch(/Click tracking and revenue attribution/);
  });

  it('says how beta payments work where someone commits, not on the pitch', () => {
    // The landing reads as the product. The disclosure lives where a person
    // signs up, sets up and handles money, so nobody does real work, or tops
    // up, expecting real money while payments are simulated. Taking it off
    // the landing is only fine while every one of these still says it.
    expect(marketing(), 'the landing talks about simulated payments').not.toMatch(/simulat/i);
    expect(code('screens/auth/SignUp.tsx'), 'sign-up stopped saying payments are simulated').toMatch(/Payments are simulated/);
    expect(code('screens/workspace-v2/screens/CreatorOnboardingV2.tsx'), 'creator onboarding stopped saying it').toMatch(/simulated/i);
    expect(code('screens/workspace-v2/screens/BrandOnboardingV2.tsx'), 'brand onboarding stopped saying it').toMatch(/simulated/i);
    expect(code('screens/workspace-v2/screens/KycTax.tsx'), 'the identity and payout step stopped saying it').toMatch(/Simulated in this beta/);
    expect(code('screens/legal/LegalPage.tsx'), 'the terms stopped saying it').toMatch(/Payments on Alamut are simulated/);
    // Both homes show money with Withdraw / Top up beside it; the strip they
    // share says how payments run, right there.
    expect(code('screens/workspace-v2/screens/homeParts.tsx'), 'the home money strip stopped saying it').toMatch(/payments run in test mode/);
    // Today (Round 8) shows money as a card with Withdraw / Top up; the card
    // carries the same line.
    expect(code('screens/workspace-v2/screens/todayParts.tsx'), 'the Today money card stopped saying it').toMatch(/payments run in test mode/);
    expect(code('screens/workspace-v2/screens/CreatorHome.tsx'), 'the creator Today dropped the money card').toMatch(/<MoneyCard/);
    expect(code('screens/workspace-v2/screens/BrandHome.tsx'), 'the brand Today dropped the money card').toMatch(/<MoneyCard/);
  });

  it('does not promise attribution the dashboard does not do', () => {
    expect(claims()).not.toMatch(/ROAS|\bUTM\b|attribut(ed|ion)|tracking link|conversions?\b/i);
  });

  it('does not name a payout rail that does not exist', () => {
    // PayPal appeared in exactly one sentence and nowhere in the payout code.
    expect(marketing()).not.toMatch(/PayPal/i);
    expect(code('screens/workspace-v2/screens/KycTax.tsx')).not.toMatch(/PayPal/i);
  });

  it('does not quote an average nobody measured', () => {
    expect(claims()).not.toMatch(/average \d+ (days|hours)|on average|\bavg\b/i);
  });

  it('does not claim creators are screened before they can apply', () => {
    // v2ApplyToCampaign has no verification gate — a brand-new account can
    // apply the minute it signs up. If that changes, this test should be
    // updated deliberately, together with the copy.
    const apply = code('screens/workspace-v2/v2CampaignActions.ts');
    const fn = apply.slice(apply.indexOf('export function v2ApplyToCampaign'));
    expect(fn.slice(0, fn.indexOf('\n}'))).not.toMatch(/creator\.verified/);
    expect(claims()).not.toMatch(/reviewed before they can apply|vetted|hand-?picked/i);
  });

  it('does not sell AI', () => {
    // Matching is a weighted score over self-reported fields and Spark is a
    // rules engine. "AI" was the least real claim on the old pages and the
    // one every competitor makes.
    expect(claims()).not.toMatch(/\bAI\b|A\.I\.|artificial intelligence|machine learning|\bSpark\b|smart match|auto-?match/i);
  });

  it('states no fee or percentage the code does not supply', () => {
    // "A flat 5%" sat on the old page against a PLATFORM_FEE of 0.10. Copy
    // that restates a number drifts from it, so the landing never writes
    // one: every percentage comes from facts.ts, which imports money.ts.
    // The one exception is market.ts, a third-party survey's figures, each
    // pinned to its source sentence by the test below.
    const copy = landingFiles().filter((f) => f !== 'landing/market.ts').map(code).join('\n') + shells();
    expect(copy).not.toMatch(/\d\s?%|\bper ?cent\b/i);
    expect(copy).toMatch(/PLATFORM_FEE_LABEL/);
  });

  it('the founder’s note goes live only once it’s written', () => {
    // founder.ts starts as a draft full of [placeholders] for the founder to
    // fill in. Shipping it half-written would put brackets on the page.
    const f = code('landing/founder.ts');
    const ready = /ready:\s*true/.test(f);
    expect(/ready:\s*(true|false)/.test(f), 'the ready flag stopped matching').toBe(true);
    if (ready) {
      expect(f, 'the founder’s note still has a [placeholder]').not.toMatch(/'[^']*\[[^\]']+\][^']*'/);
      const photo = /photo:\s*'([^']*)'/.exec(f)?.[1] ?? '';
      if (photo) expect(() => readFileSync(join(SRC, '..', 'public', photo)), `${photo} isn't in app/public`).not.toThrow();
    }
  });

  it('sign-up asks the country, onboarding asks the city, and neither asks twice', () => {
    const signUp = code('screens/auth/SignUp.tsx');
    expect(signUp, 'sign-up asks for a city again').not.toMatch(/signup-city|setCity\(/);
    expect(signUp, 'sign-up stopped asking for the country').toMatch(/id="signup-country"/);
    // Industry likewise: brand onboarding asks it, required, from its own
    // list, so a free-text answer at sign-up was asked twice and didn't match.
    expect(signUp, 'sign-up asks a brand’s industry again').not.toMatch(/signup-industry|setIndustry\(/);
    expect(code('screens/workspace-v2/screens/BrandOnboardingV2.tsx'), 'brand onboarding stopped asking the industry').toMatch(/if \(!s\.industry\)\s+missing\.push/);
    const onb = code('screens/workspace-v2/screens/CreatorOnboardingV2.tsx');
    expect(onb, 'onboarding presets a city nobody chose').not.toMatch(/city:[^,\n]*\|\|\s*'[A-Z][a-z]+'/);
    // The country field is behind askCountry, which is true only when the
    // creator record has no country yet.
    expect(onb).toMatch(/useState\(\(\) => !currentCreator\?\.country\?\.trim\(\)\)/);
    const countryFields = onb.match(/id="v2-onb-country"/g) ?? [];
    expect(countryFields.length).toBe(1);
    expect(onb.slice(onb.indexOf('{askCountry ? ('), onb.indexOf('id="v2-onb-country"')), 'the country field is asked unconditionally').toMatch(/\{askCountry \? \(/);
  });

  it('every market figure is the survey’s, credited, and never passed off as ours', () => {
    // The landing shows a few industry figures (market.ts). Each must be
    // found, as shown, in the source sentence recorded for it; the strip that
    // shows them must carry the line saying they come from a survey; and
    // only that strip may show them. The publisher is kept off the page.
    const market = code('landing/market.ts');
    const shown = [...market.matchAll(/figure: '([^']+)'/g)].map((m) => m[1]!);
    expect(shown.length, 'the figure pattern stopped matching').toBeGreaterThan(3);
    const sources = read('landing/__tests__/market.sources.ts');
    const recorded = [...sources.matchAll(/\{ figure: '([^']+)', page: (\d+), says: '([^']+)' \}/g)]
      .map((m) => ({ figure: m[1]!, page: Number(m[2]), says: m[3]! }));
    for (const f of new Set(shown)) {
      const src = recorded.find((r) => r.figure === f);
      expect(src, `market figure ${f} has no recorded source`).toBeDefined();
      expect(src!.says, `market figure ${f} isn't in its source sentence`).toContain(f);
      expect(src!.page).toBeGreaterThan(0);
    }
    const strip = code('landing/components.tsx');
    expect(strip, 'the market strip lost its source line').toMatch(/<p className="lx-market-source">\{MARKET_SOURCE_LINE\}<\/p>/);
    expect(market).toMatch(/MARKET_SOURCE_LINE = '[^']*survey[^']*'/);
    for (const f of landingFiles().filter((x) => !['landing/market.ts', 'landing/components.tsx'].includes(x))) {
      // Allowed: importing them, and handing them to the strip. Nothing else.
      const rest = code(f)
        .replace(/^import \{[^}]*\} from '\.\/market';$/gm, '')
        .replace(/<MarketStrip title="[^"]+" figures=\{(CREATOR|BRAND)_MARKET\} \/>/g, '');
      expect(rest, `${f} shows market figures outside the credited strip`).not.toMatch(/\b(CREATOR|BRAND)_MARKET\b|MarketFigure|['"]\.\/market['"]/);
    }
    expect(claims(), 'the survey publisher is named on the page').not.toMatch(/aspire/i);
  });

  it('names no seed brand, and no real company as a customer', () => {
    // The seed's brands used to be real companies (Aesop, Glossier, Le
    // Creuset…) that were not customers, and the old pages showed their
    // logos and an "Aesop" case study. The demo brands are invented now, but
    // they still aren't customers, so none of them may appear as one.
    const seed = code('lib/api/seed.ts');
    const names = [...seed.matchAll(/name:\s*'([^']+)',\s*industry:/g)].map((m) => m[1]!);
    expect(names.length, 'the seed brand pattern stopped matching — this check is blind').toBeGreaterThan(20);
    const src = claims();
    for (const n of names) {
      const re = new RegExp(`\\b${n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`);
      expect(src, `seed brand "${n}" on the landing`).not.toMatch(re);
    }
  });

  it('every promise in a hero is one its page keeps', () => {
    // The hero's checked promises stand alone above the fold. Each must also
    // be said where it's explained (pricing or the questions), so the hero
    // can't gain a promise the page never backs up.
    for (const page of ['landing/CreatorsPage.tsx', 'landing/BrandsPage.tsx']) {
      const src = code(page);
      const m = src.match(/<Promises items=\{\[([^\]]*)\]\} \/>/);
      expect(m, `${page} lost its hero promises`).toBeTruthy();
      const items = [...m![1]!.matchAll(/'([^']+)'/g)].map((x) => x[1]!);
      expect(items.length, page).toBeGreaterThan(0);
      const rest = src.replace(m![0], '').toLowerCase();
      for (const item of items) {
        expect(rest, `${page} promises "${item}" in the hero and nowhere else`).toContain(item.toLowerCase());
      }
    }
  });

  it('carries no social proof it does not have', () => {
    // No customers, quotes, press or volume figures until real ones exist.
    expect(claims()).not.toMatch(/trusted by|as seen in|featured in|loved by|testimonial|case study|\bpress\b/i);
    expect(claims()).not.toMatch(/\b\d[\d,.]*\s*k?\+?\s+(creators|brands|campaigns|deals|customers|users)\b/i);
  });

  it('does not put usage rights on the brief while briefs cannot carry them', () => {
    // The v2 brief wizard sets no rights, and BriefDetail shows creators
    // the same hardcoded clauses on every brief. Until a brand can set
    // rights on a brief, the landing must not say they're on it.
    if (briefCarriesRights()) return;
    expect(claims()).not.toMatch(
      /rights[^.'"]{0,40}\b(on|in) the brief|brief[^.'"]{0,30}\busage rights|rights (up front|attached)/i,
    );
  });

  it('the setup the landing describes is the setup onboarding has', () => {
    // "Setup after you join: …" under each closing call. A step added to or
    // dropped from onboarding must show up here, or the page undersells or
    // oversells the work ahead.
    const labels = (f: string) => {
      const steps = /const STEPS = \[([\s\S]*?)\] as const;/.exec(code(f))?.[1] ?? '';
      return [...steps.matchAll(/label: '([^']+)'/g)].map((m) => m[1]!.toLowerCase());
    };
    const facts = code('landing/facts.ts');
    for (const [name, f] of [
      ['CREATOR_SETUP', 'screens/workspace-v2/screens/CreatorOnboardingV2.tsx'],
      ['BRAND_SETUP', 'screens/workspace-v2/screens/BrandOnboardingV2.tsx'],
    ] as const) {
      const line = new RegExp(`${name} = '([^']+)'`).exec(facts)?.[1] ?? '';
      const steps = labels(f);
      expect(steps.length, `${f}: the STEPS pattern stopped matching`).toBeGreaterThan(1);
      const words = [...line.toLowerCase().matchAll(/[a-z]+/g)].map((m) => m[0]);
      const found = steps.map((st) => words.indexOf(st));
      expect(found.every((i) => i >= 0), `${name} misses a step of ${steps.join(', ')}`).toBe(true);
      expect(found, `${name} lists the steps out of order`).toEqual([...found].sort((x, y) => x - y));
      expect(words.filter((w) => !['your', 'and', 'then'].includes(w)), `${name} names a step onboarding doesn't have`).toEqual(steps);
    }
  });

  it('what the landing says carries into the app, does', () => {
    // The storefront builder and the brief builder say their contents carry
    // into setup. That is only true while sign-up, onboarding and the
    // campaign wizard read the draft (landingDraft.ts) and clear it once used.
    if (/carry into setup/.test(claims())) {
      expect(code('screens/auth/SignUp.tsx'), 'sign-up ignores the storefront draft').toMatch(/readStorefrontDraft\(/);
      const onb = code('screens/workspace-v2/screens/CreatorOnboardingV2.tsx');
      expect(onb, 'onboarding ignores the storefront draft').toMatch(/onboardingFromDraft\(\{[\s\S]*readStorefrontDraft\(/);
      expect(onb, 'onboarding never spends the draft').toMatch(/clearDraft\([^)]*STOREFRONT_DRAFT_KEY\)/);
    }
    if (/waiting in New campaign/.test(claims())) {
      const wiz = code('screens/workspace-v2/screens/NewCampaignWizard.tsx');
      expect(wiz, 'the wizard ignores the brief draft').toMatch(/wizardFromDraft\(readBriefDraft\(/);
      expect((wiz.match(/clearDraft\([^)]*BRIEF_DRAFT_KEY\)/g) ?? []).length, 'save and launch must both spend the draft').toBe(2);
    }
  });

  it('the landing bundle reaches nothing stateful', () => {
    // Fast by construction, and honest by construction: the store and seed
    // are where invented numbers live. Anything the landing imports from
    // the app may import only other app modules that follow the same rule,
    // never a package, so nothing stateful is reached however deep.
    const allowedBare = new Set(['react', 'react-dom', 'react-dom/client', 'react-dom/server']);
    // `import x from '…'`, `export … from '…'`, and a bare `import '…'` run for its side effects.
    const specs = (src: string) => [...src.matchAll(/^\s*(?:import|export)\s+(?:[^'";]*?\s+from\s+)?'([^']+)'/gm)].map((m) => m[1]!);
    const resolve = (from: string, spec: string) => {
      const rel = spec.startsWith('@/') ? spec.slice(2) : join(dirname(from), spec).replace(/\\/g, '/');
      return ['.ts', '.tsx'].map((x) => rel + x).find((x) => { try { read(x); return true; } catch { return false; } });
    };
    const pure = (file: string, via: string, depth: number) => {
      expect(depth, `${via} reaches too deep to check`).toBeLessThan(4);
      for (const spec of specs(read(file))) {
        expect(spec.startsWith('.') || spec.startsWith('@/'), `${via} → ${file} imports the package "${spec}"`).toBe(true);
        const target = resolve(file, spec);
        expect(target, `${file} imports ${spec}, which doesn't resolve`).toBeDefined();
        pure(target!, `${via} → ${file}`, depth + 1);
      }
    };
    for (const f of landingFiles()) {
      for (const spec of specs(read(f))) {
        if (spec.startsWith('./')) continue;
        if (spec.startsWith('@/')) {
          const target = resolve(f, spec);
          expect(target, `${f} imports ${spec}, which doesn't resolve`).toBeDefined();
          pure(target!, f, 0);
          continue;
        }
        expect(allowedBare.has(spec), `${f} imports the package "${spec}"`).toBe(true);
      }
    }
  });

  // ── In sync with the portal (2026-10-26) ─────────────────────────────
  // The landing is the portal's front door: two earlier landings each
  // invented their own look, and keeping them would have meant redesigning
  // the workspace to match. So the landing, sign-in and sign-up read the
  // workspace's own tokens, typefaces and mark, and define none of their own.

  it('the landing is drawn in the portal’s tokens, not its own', () => {
    const css = read('landing/landing.css').replace(/\/\*[\s\S]*?\*\//g, '').replace(/url\("data:[^"]*"\)/g, '');
    expect(css).toMatch(/@import '\.\.\/styles\/v2-tokens\.css';/);
    expect(css, 'a colour literal in landing.css').not.toMatch(/#[0-9a-fA-F]{3,8}\b|\b(rgba?|hsla?|oklch|oklab|lab|lch)\(/);
    for (const page of ['landing/CreatorsPage.tsx', 'landing/BrandsPage.tsx']) {
      expect(code(page), page).toMatch(/<div className="lx" data-surface="v2">/);
    }
  });

  it('the workspace reads the same token file, and only that one', () => {
    const ws = read('styles/workspace-v2.css');
    expect(ws).toMatch(/@import '\.\/v2-tokens\.css';/);
    expect(ws.replace(/\/\*[\s\S]*?\*\//g, ''), 'workspace-v2.css defines its own palette again')
      .not.toMatch(/--v2-(bg|paper|ink|accent|moss|line|font-display|font-sans|r-lg)\s*:/);
  });

  it('every v2 token the landing and the letterheads read is defined once, in the token file', () => {
    // A misspelt var() fails silently: the colour simply isn't painted. And a
    // letterhead written as a hex would let the portal's bands and the
    // landing's drift apart again.
    const defined = new Set([...read('styles/v2-tokens.css').matchAll(/(--v2-[\w-]+)\s*:/g)].map((m) => m[1]!));
    // Every landing source file, not a list: a list can't see a file added after it.
    for (const f of ['landing/landing.css', 'styles/auth-v2.css', 'screens/workspace-v2/brandPalette.ts', ...landingFiles()]) {
      for (const [, name] of read(f).matchAll(/var\((--v2-[\w-]+)/g)) {
        expect(defined.has(name!), `${f} reads ${name}, which v2-tokens.css doesn't define`).toBe(true);
      }
    }
    expect(code('screens/workspace-v2/brandPalette.ts'), 'a letterhead colour written as a literal').not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });

  it('the landing loads only typefaces the portal loads', () => {
    const families = (html: string) => [...html.matchAll(/family=([A-Za-z+]+)/g)].map((m) => m[1]!.replace(/\+/g, ' '));
    const app = new Set(families(readFileSync(join(SRC, '..', 'app.html'), 'utf8')));
    for (const shell of ['index.html', 'for-brands/index.html']) {
      const f = families(readFileSync(join(SRC, '..', shell), 'utf8'));
      expect(f.length, shell).toBeGreaterThan(0);
      for (const fam of f) expect(app.has(fam), `${shell} loads ${fam}, which the app doesn't`).toBe(true);
    }
  });

  it('the landing draws platforms with the portal’s glyphs, from one copy', () => {
    // The portal's channel badges and the landing's platform marks read the
    // same paths (lib/platformGlyphs.ts), so neither can drift into a look-alike.
    const lib = code('screens/workspace-v2/lib.tsx');
    for (const k of ['instagram', 'tiktok', 'youtube']) {
      expect(lib, `lib.tsx no longer draws ${k} from platformGlyphs.ts`).toContain(`PLATFORM_GLYPH.${k}`);
    }
    expect(code('landing/tools-shared.tsx')).toMatch(/PLATFORM_GLYPH\[p\]/);
    const starts = ['M12 2.16c3.2', 'M19.59 6.69', 'M23.5 6.2'];
    const walk = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory() ? (e.name === '__tests__' ? [] : walk(join(dir, e.name))) : /\.(ts|tsx)$/.test(e.name) ? [join(dir, e.name)] : []);
    const holders = walk(SRC).filter((f) => starts.some((p) => readFileSync(f, 'utf8').includes(p)));
    expect(holders.map((f) => f.slice(SRC.length + 1))).toEqual(['lib/platformGlyphs.ts']);
  });

  it('the landing’s photos are on our own host, at every width it asks for', () => {
    // They came from images.unsplash.com, and the day that host was
    // unreachable the pages lost their pictures and never finished loading.
    const photos = code('landing/photos.ts');
    const files = [...photos.matchAll(/file: '(\w+)'/g)].map((m) => m[1]!);
    const widths = /PHOTO_WIDTHS = \[([\d, ]+)\]/.exec(photos)![1]!.split(',').map((w) => w.trim());
    expect(files.length).toBeGreaterThan(10);
    for (const f of files) for (const w of widths) {
      expect(() => readFileSync(join(SRC, '..', 'public', 'photos', `${f}-${w}.webp`)), `public/photos/${f}-${w}.webp is missing`).not.toThrow();
    }
    expect(marketing(), 'the landing loads a picture from another host').not.toMatch(/images\.unsplash\.com|plus\.unsplash\.com/);
  });

  it('the public pages around the landing sit on the v2 surface too', () => {
    // Terms, Privacy, 404, the rate calculators and the directory are one
    // click from the landing. They were the old site: a nav whose anchors
    // (#why, #how, #voices, #pricing) pointed into a page that no longer has
    // them, monospace labels, italic display type.
    for (const f of ['screens/legal/LegalPage.tsx', 'screens/legal/NotFound.tsx', 'screens/tools/RateCalculator.tsx', 'screens/tools/CreatorsDirectory.tsx']) {
      expect(code(f), `${f} left the v2 surface`).toMatch(/data-surface="v2" className="pub-v2/);
      expect(code(f), `${f} is back on the old surface`).not.toMatch(/landing-light|PersonaPalette/);
    }
    expect(code('screens/cover/scenes/TopNav.tsx'), 'the old nav, with its dead anchors, is back').not.toMatch(/href="#(why|how|voices|pricing)"/);
    expect(code('screens/public/PublicChrome.tsx')).toMatch(/BrandMarkSvg/);
  });

  it('each landing shares its own preview image, and the image exists', () => {
    for (const [shell, img] of [['index.html', 'og-creators.jpg'], ['for-brands/index.html', 'og-brands.jpg']] as const) {
      const html = readFileSync(join(SRC, '..', shell), 'utf8');
      expect(html, `${shell} shares another page's image`).toContain(`property="og:image" content="https://alamut-six.vercel.app/${img}"`);
      expect(html).toContain(`name="twitter:image" content="https://alamut-six.vercel.app/${img}"`);
      expect(() => readFileSync(join(SRC, '..', 'public', img)), `public/${img} is missing`).not.toThrow();
    }
  });

  it('the public directory doesn’t show a demo account’s seed earnings as real', () => {
    const dir = code('screens/tools/CreatorsDirectory.tsx');
    expect(dir).toMatch(/isDemoCreator\(c\) && <span className="dir-card-demo">Demo<\/span>/);
    expect(dir, 'demo earnings are shown as money earned on Alamut').toMatch(/!isDemoCreator\(c\) && c\.lifetimeEarnings > 0/);
  });

  it('sign-in and sign-up sit on the v2 surface, and every surface draws one mark', () => {
    for (const f of ['screens/auth/SignIn.tsx', 'screens/auth/SignUp.tsx']) {
      expect(code(f), f).toMatch(/data-surface="v2"/);
      expect(code(f), f).toMatch(/import '@\/styles\/auth-v2\.css';/);
      expect(code(f), `${f} still uses the old airy shell`).not.toMatch(/data-surface="landing-light"/);
    }
    const markPath = 'M16 4 L28 26 L22 26 L16 14 L10 26 L4 26 Z';
    for (const f of ['screens/workspace-v2/Workspace.tsx', 'landing/components.tsx', 'screens/auth/SignIn.tsx', 'screens/auth/SignUp.tsx']) {
      expect(code(f), f).toMatch(/BrandMarkSvg/);
      expect(code(f), `${f} draws its own copy of the mark`).not.toContain(markPath);
    }
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

  it('does not claim matching uses the brand\'s own customer data', () => {
    // matching.ts scores niche, engagement, geo, rate, history, category.
    expect(claims()).not.toMatch(/overlap with your (existing )?customers/i);
  });

  // ── Verification claims (found 2026-10-25) ────────────────────────────
  // The fix for "reviewed before applying" replaced it with "identity and
  // channel ownership are confirmed before a creator can be paid" — written
  // in the overclaim sweep itself, and false three ways: the KYC identity
  // step marks a creator verified on click, nothing can confirm a channel
  // (oauth-callback undeployed, no screen calls it), and releasing escrow
  // checks neither. Beside it, "every brand is verified before they can post
  // a brief" — nothing gates posting, and nothing verifies a brand.
  //
  // These are refused only WHILE the capability is missing. Each check names
  // the code that would make the claim true; ship that, and the claim is
  // allowed again without touching this file.

  const allMarketing = claims;
  const appSource = () => {
    const out: string[] = [];
    const walk = (dir: string) => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, e.name);
        if (e.isDirectory()) { if (e.name !== '__tests__' && e.name !== '__bench__') walk(full); }
        else if (/\.(ts|tsx)$/.test(e.name)) out.push(code(full.slice(SRC.length + 1)));
      }
    };
    walk(SRC);
    return out.join('\n');
  };
  const screensSource = () => {
    const out: string[] = [];
    const walk = (dir: string) => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, e.name);
        if (e.isDirectory()) { if (e.name !== '__tests__') walk(full); }
        else if (/\.tsx?$/.test(e.name)) out.push(code(full.slice(SRC.length + 1)));
      }
    };
    walk(join(SRC, 'screens'));
    return out.join('\n');
  };

  /** A screen can actually confirm a creator owns a channel. A CALL, not the
   *  definition: v2VerifyChannel is defined under src/screens, and matching
   *  `v2VerifyChannel(` alone made this true and every check below vacuous —
   *  caught by the probe test at the end of this block. */
  const channelOwnershipCheckable = () =>
    /from '@\/lib\/oauth\/connectPlatform'/.test(screensSource())
    || /(?<!function )\bv2VerifyChannel\(/.test(screensSource());
  /** A brand can set usage rights when it writes a brief. */
  function briefCarriesRights() {
    return /\brights\b/.test(code('screens/workspace-v2/screens/NewCampaignWizard.tsx'));
  }
  /** An identity-document provider is integrated, not just mentioned. */
  const idDocumentCheckExists = () => /withpersona\.com|onfido\.com|sumsub\.com|veriff\.com/i.test(appSource());
  /** Posting a campaign is refused for an unverified brand. */
  const brandVerificationGatesPosting = () => {
    const wizard = code('screens/workspace-v2/screens/NewCampaignWizard.tsx');
    const client = code('lib/api/client.ts');
    const create = /async function createCampaign\([\s\S]*?\n}/.exec(client)?.[0] ?? '';
    return /brand\??\.verified/.test(wizard + create);
  };

  it('does not claim channel ownership is confirmed while nothing can confirm it', () => {
    if (channelOwnershipCheckable()) return;
    expect(allMarketing()).not.toMatch(
      /channel[- ]ownership[^.'"]{0,60}\b(is|are)\s+(confirmed|verified)|(confirm(ed|s)?|verif(y|ied|ies))[^.'"]{0,40}channel[- ]ownership/i,
    );
  });

  it('does not claim identity is confirmed while the identity step checks nothing', () => {
    if (idDocumentCheckExists()) return;
    expect(allMarketing()).not.toMatch(
      /identit(y|ies)[^.'"]{0,40}\b(is|are)\s+(confirmed|verified)|(confirmed|verified)[^.'"]{0,20}\bidentit|\bidentity verified/i,
    );
  });

  it('does not claim brands are verified before they can post', () => {
    if (brandVerificationGatesPosting()) return;
    expect(allMarketing()).not.toMatch(/every brand[^.'"]{0,40}\bverified|\bbrands?\s+(are|is)\s+verified/i);
  });

  it('the trust panel credits Alamut only with what Alamut records', () => {
    // Discover shows brands "N verified by Alamut". A self-service step must
    // never be counted there, and a signal nothing can satisfy must not exist.
    const trust = code('screens/workspace-v2/creatorTrust.ts');
    const signal = (key: string) => {
      const at = trust.indexOf(`key: '${key}'`);
      return at < 0 ? null : trust.slice(at, trust.indexOf('verifiedByUs', at) + 30);
    };
    if (!idDocumentCheckExists()) {
      expect(signal('identity'), 'identity signal missing').not.toBeNull();
      expect(signal('identity')!, 'the self-clicked identity step is counted as verified by Alamut')
        .toMatch(/verifiedByUs:\s*false/);
    }
    if (!channelOwnershipCheckable()) {
      expect(signal('channel-verified'), 'a channel-ownership signal no creator can meet').toBeNull();
    }
  });

  it('the capability probes see the code as it is today', () => {
    // If a probe is wrong, every check above is decorative. Pin today's facts.
    expect(channelOwnershipCheckable(), 'a screen now confirms channel ownership — great; re-check the copy').toBe(false);
    expect(idDocumentCheckExists(), 'an ID provider is integrated — re-check the copy').toBe(false);
    expect(brandVerificationGatesPosting(), 'posting is gated on brand verification — re-check the copy').toBe(false);
    expect(briefCarriesRights(), 'the brief wizard now sets usage rights — the landing may say so').toBe(false);
    // And the KYC identity step really does self-verify — the premise of all three.
    expect(code('screens/workspace-v2/screens/KycTax.tsx')).toMatch(/verified:\s*true/);
  });
});

// ─────────────────────────────────────────────────────────────────────
// CLASS 10, continued — the app must not show what nobody wrote
// ─────────────────────────────────────────────────────────────────────
//
// Checking the landing's claims against the product found the same defect
// inside the product, on the screens a visitor reaches next.
//
// BriefDetail, the page a creator reads before pitching, showed every brief
// the same "Must do" list, the same "Don't" list and "Spark flagged 3
// clauses": a 2-week beauty exclusivity, 30-day paid-ad usage, and
// "non-compliance voids escrow release". All literal strings. No brand wrote
// them, the brief wizard has no field for them, and Spark produced none of
// them, so a creator would pitch against terms that did not exist. The
// sign-in page labelled the demo brand "Aesop", a real company that is not
// a customer. /creators called its list "vetted" and said every creator "has
// been reviewed before they could apply". That is the claim CLASS 10 took off
// the landing, and it was still live one link away.

describe('the app shows only terms and claims someone actually made', () => {
  const brief = () => code('screens/workspace-v2/screens/BriefDetail.tsx');

  it('BriefDetail carries none of the clauses it used to invent', () => {
    // The brand's own campaign page showed the same list as "Brand-safe
    // checklist"; it goes under the same rule.
    const src = brief() + code('screens/workspace-v2/screens/CampaignDetail.tsx');
    for (const s of [
      /Must do/i, /Spark flagged/i, /clauses? to review/i, /first 3 seconds/i,
      /campaign hashtag/i, /AI-generated voiceover/i, /competing brands in the same/i,
      /exclusivity window/i, /voids escrow/i, /#ad disclosure/i,
    ]) {
      expect(src, `BriefDetail hardcodes a brief term again: ${s}`).not.toMatch(s);
    }
  });

  it('and has no place to put a new one', () => {
    // The banned list above only catches the old wording. These catch the
    // SHAPE: a list of string literals handed to a component as brief terms,
    // or a clause typed straight into a prop.
    const src = brief();
    expect(src, 'a hardcoded list of brief items').not.toMatch(/=\{\[\s*['"`]/);
    expect(src, 'a hardcoded clause').not.toMatch(/\bdetail="/);
    // A duration ("2-week", "30 days") may appear only as the label for a
    // `ContentRights` window, which is rendered from the campaign's own
    // rights. Anywhere else, it is a term nobody set.
    const outsideLabels = src.replace(/Record<ContentRights\[[^\]]+\], string> = \{[\s\S]*?\n\};/g, '');
    expect(outsideLabels, 'a duration hardcoded outside the rights labels')
      .not.toMatch(/\d+[- ]?(day|week|month)s?\b/i);
  });

  it('rights appear only when the campaign carries them', () => {
    // The v2 wizard never sets `Campaign.rights`, so for a real brief the
    // honest rendering is "none set", not a plausible default.
    const src = brief();
    expect(src).toMatch(/rawCampaign\?\.rights\s*\?/);
    expect(src).toMatch(/rights=\{rawCampaign\.rights\}/);
  });

  it('shows the brief the brand wrote, not the first 200 characters of it', () => {
    // Launch saves `pitch` as `brief.slice(0, 200)`, and the v2 adapter's
    // `brief` was `pitch || brief`, so every long brief was cut off
    // mid-word. This guard used to pin that order (and BriefDetail worked
    // around it); the adapter now puts the full brief first, everywhere.
    expect(code('screens/workspace-v2/v2Adapters.ts')).toMatch(/brief:\s*c\.brief \|\| c\.pitch/);
    expect(brief()).toMatch(/rawCampaign\?\.brief/);
  });

  it('the sign-in demo buttons name no seed brand', () => {
    // The demo brands (invented since the portal revamp; real companies
    // before it) must not label a button on a public page, where they read
    // as customers.
    const seed = code('lib/api/seed.ts');
    const names = [...seed.matchAll(/name:\s*'([^']+)',\s*industry:/g)].map((m) => m[1]!);
    expect(names.length, 'the seed brand pattern stopped matching, so this check is blind').toBeGreaterThan(20);

    const signin = code('screens/auth/SignIn.tsx');
    const at = signin.indexOf('const DEMO_ACCOUNTS');
    const labels = [...signin.slice(at, signin.indexOf('};', at)).matchAll(/label:\s*'([^']*)'/g)]
      .map((m) => m[1]!);
    expect(labels.length, 'DEMO_ACCOUNTS labels not found, so this check is blind').toBeGreaterThanOrEqual(2);
    // Labels, plus the buttons themselves, in case text is ever typed into
    // the JSX instead of read from DEMO_ACCOUNTS. Emails are left out: the
    // demo account's address is a fixed Supabase login, not a label.
    const grid = signin.slice(signin.indexOf('auth-airy-demo-grid'));
    const shown = labels.join('\n') + '\n' + grid.slice(0, grid.indexOf('</div>'));
    for (const n of names) {
      const re = new RegExp(`(?<!\\w)${n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?!\\w)`, 'i');
      expect(shown, `seed brand "${n}" on a sign-in demo button`).not.toMatch(re);
    }
  });

  it('no public screen claims creators are vetted', () => {
    // Nothing vets a creator: applying has no gate (see CLASS 10) and
    // `verified` is a KYC step the creator completes with one click.
    //
    // screens/cover and components/illustrations are the pre-revamp landing
    // (the illustrations are imported only from there). landing-revamp
    // deletes both and replaces them with src/landing, whose own CLASS 10
    // check bans these words. Once they are gone this exclusion matches
    // nothing.
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, e.name);
        const rel = full.slice(SRC.length + 1);
        if (e.isDirectory()) {
          if (e.name !== '__tests__' && rel !== 'screens/cover' && rel !== 'components/illustrations') walk(full);
        } else if (/\.tsx?$/.test(e.name)) files.push(rel);
      }
    };
    walk(join(SRC, 'screens'));
    walk(join(SRC, 'components'));
    expect(files, 'the walk no longer reaches /creators').toContain('screens/tools/CreatorsDirectory.tsx');
    for (const f of files) {
      expect(code(f), `${f} claims creators are vetted`)
        .not.toMatch(/\bvetted\b|hand-?picked|verified creators|reviewed before they (can|could) apply/i);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────
// CLASS 11 — "X happened" must be read from the record of X happening
// ─────────────────────────────────────────────────────────────────────
//
// Asim spotted two panels on one screen contradicting each other: the stage
// header said `Invited` while the Activity feed said "You accepted the
// offer · 6d ago" and "Aesop funded escrow · $3.6K · 5d ago".
//
// Both feed lines were fabricated. "accepted the offer" was pushed
// UNCONDITIONALLY for every collab at every stage, the escrow line was
// gated on `collab.price > 0` — true on an invited collab whose only price
// is the rate the brand suggested — and every timestamp was a hardcoded
// string ('6d ago', '5d ago'). The card's header claimed "last 7 days" over
// a window nothing filtered on.
//
// The same root cause sat in the payout river: `{ label: 'Escrow funded',
// done: collab.price > 0 }`, showing a creator money locked up that nobody
// had moved, dated to their application.
//
// `useRecentActivity` had been doing this correctly all along, off real
// `h.at` / `t.at` timestamps — so this is the house pattern again: a
// correct implementation exists and a drifted copy is the one on screen.
//
// The rule: a past-tense claim, and above all a MONEY claim, is read from
// the row that records it. Stages and prices say what is true now, not what
// happened.

describe('past-tense claims come from records, not from stages', () => {
  const collabDetail = () => code('screens/workspace-v2/screens/CollabDetail.tsx');

  it('the activity feed carries no hardcoded relative timestamps', () => {
    // '6d ago' and friends were literals. Real events know when they were.
    expect(collabDetail()).not.toMatch(/'\d+d ago'/);
    expect(collabDetail()).not.toMatch(/when: 'today'/);
  });

  it('and claims an acceptance only from an accepted offer', () => {
    // The property, not the string. Banning "accepted the offer" outright
    // failed on the correct implementation — this assertion did exactly
    // that on its first run — because the honest version still says those
    // words; it just says them inside a check for a real accepted offer
    // with a real respondedAt.
    const src = collabDetail();
    const idx = src.indexOf("what: 'accepted the offer'");
    expect(idx, 'the acceptance line vanished — check the feed still reports it').toBeGreaterThan(-1);
    const preceding = src.slice(Math.max(0, idx - 400), idx);
    expect(preceding, 'acceptance is not gated on an accepted offer')
      .toMatch(/status === 'accepted'/);
    expect(preceding, 'acceptance is not gated on a real respondedAt')
      .toMatch(/respondedAt/);
  });

  it('escrow is never reported funded from a price alone', () => {
    // `done: collab.price > 0` on an "Escrow funded" milestone, and
    // `if (collab.price > 0)` before an escrow feed line, were the two
    // instances. A price is an intention; escrow_hold is the event.
    const src = collabDetail();
    expect(src).not.toMatch(/done: collab\.price > 0/);
    expect(src).not.toMatch(/if \(collab\.price > 0\)[\s\S]{0,200}funded escrow/);
  });

  it('the feed reads the ledger and the collab history', () => {
    const src = collabDetail();
    expect(src).toMatch(/kind === 'escrow_hold'/);
    expect(src).toMatch(/row\?\.history/);
    // And renders real times through the shared formatter.
    expect(src).toMatch(/relativeTime\(/);
  });

  it('does not claim a time window it never filters on', () => {
    expect(collabDetail()).not.toMatch(/last 7 days/);
  });

  it('the honest implementation it should have reused is still honest', () => {
    // useRecentActivity was right all along; if it ever starts inventing
    // times, the pattern this class exists to protect is gone.
    const src = code('screens/workspace-v2/useRecentActivity.ts');
    expect(src).not.toMatch(/'\d+d ago'/);
    expect(src).toMatch(/\bat:\s*(new Date\()?[a-z]/i);
  });
});


// ─────────────────────────────────────────────────────────────────────
// CLASS 12 — a row is readable by the people it is about, not by anyone
// who can reach the endpoint
//
// Found 2026-10-23 by pointing the publishable key at production. Eight
// tables answered an anonymous curl with real rows — every deal's
// agreed_rate, platform_fee, net_to_creator and withholding_tax among
// them — and five more answered any signed-in account with every other
// account's direct messages, ledger rows and disputes.
//
// The cause is a shape, not a typo. Three migrations named `tighten_rls`
// (005, 019, 027) all tightened INSERT and WITH CHECK, because the threat
// being modelled each time was a user PLANTING a row. 025 was the only
// SELECT lockdown and it covered `creators` and `brands` alone. Read
// authorization was never the subject of a migration, and no test had an
// opinion about it, so thirteen tables kept the `using (true)` they were
// born with for thirty-one migrations.
//
// Two distinct failures, so two guards:
//
//   (a) `using (true)` with no role clause — the `anon` role is included,
//       and the publishable key is public by design. World-readable.
//   (b) `to authenticated using (true)` — the gate is "do you have an
//       account", not "is this row yours". Signup is open.
//
// A third guard protects the fix itself. The 005/019 helpers are
// `security invoker`, so a policy on table T that calls a helper reading
// T recurses. `is_participant_of_campaign` reads `applications` and
// `offers`; using it to guard either is the mistake waiting to be made
// the next time someone adds a deal table.

describe('read authorization is scoped to the parties, not to the audience', () => {
  const MIGRATIONS = join(SRC, '..', 'supabase', 'migrations');

  /** Intentionally world-readable, each for a stated product reason.
   *  Adding to this list should take an argument, which is the point of
   *  it being a list. */
  const PUBLIC_BY_INTENT = new Set([
    // Projections (038), each a deliberately reduced column set kept in sync
    // by trigger. The raw tables behind them are owner- or party-only.
    'public.creators_public',  // public profiles and the creator directory
    'public.brands_public',    // brand headers on briefs, Discover
    'public.campaigns_public', // the marketplace — published campaigns only
    // Not here: `public.campaigns`. It was public until 039, which left
    // `spent` (on a one-creator campaign, that creator's fee) on the open web.
  ]);

  type Policy = { table: string; name: string; roles: string; pred: string; file: string };

  /** Replay the migrations in order and return the SELECT policies left
   *  standing — the same thing Postgres ends up with, which is the only
   *  state worth asserting on. A policy dropped and recreated three
   *  times should be judged on the last one. */
  function finalSelectPolicies(): Policy[] {
    const live = new Map<string, Policy>();
    const files = readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort();
    for (const file of files) {
      const sql = readFileSync(join(MIGRATIONS, file), 'utf8')
        // Function bodies are full of `select ... ;` and would be parsed as
        // policy text. Drop them before anything else.
        .replace(/\$\$[\s\S]*?\$\$/g, '$$BODY$$')
        .replace(/--[^\n]*/g, '');

      for (const m of sql.matchAll(
        /drop\s+policy\s+(?:if\s+exists\s+)?"?([\w ]+?)"?\s+on\s+(public\.\w+)\s*;/gi,
      )) {
        live.delete(`${m[2]}|${m[1]}`);
      }
      for (const m of sql.matchAll(
        /create\s+policy\s+"?([\w ]+?)"?\s+on\s+(public\.\w+)\s+for\s+select\b([\s\S]*?);/gi,
      )) {
        const [, name, table, body] = m;
        const flat = body.replace(/\s+/g, ' ').trim();
        const roleMatch = /\bto\s+([\w, ]+?)\s+(?:using|with)\b/i.exec(flat);
        const predMatch = /\busing\s*\(([\s\S]*)\)\s*$/i.exec(flat);
        live.set(`${table}|${name}`, {
          table,
          name,
          roles: roleMatch ? roleMatch[1].trim() : 'PUBLIC',
          pred: (predMatch ? predMatch[1] : flat).replace(/\s+/g, ' ').trim(),
          file,
        });
      }
    }
    return [...live.values()];
  }

  const isBareTrue = (pred: string) => /^\(*\s*true\s*\)*$/i.test(pred);

  it('parses the migrations at all — the guard is worthless if it finds nothing', () => {
    // Every assertion below is a filter over this list. An empty list, or a
    // list missing the tables this class is about, passes everything.
    const policies = finalSelectPolicies();
    expect(policies.length).toBeGreaterThan(10);
    const tables = new Set(policies.map((p) => p.table));
    for (const t of [
      'public.contracts', 'public.offers', 'public.applications',
      'public.collaborations', 'public.submissions', 'public.deliverables',
      'public.reviews', 'public.transactions', 'public.messages',
      'public.threads', 'public.disputes', 'public.outreach',
    ]) {
      expect(tables, `no SELECT policy parsed for ${t}`).toContain(t);
    }
  });

  it('(a) nothing is world-readable except by declared intent', () => {
    // The publishable key is in the public bundle. A SELECT policy with no
    // role clause includes `anon`, so `using (true)` means "the internet".
    const open = finalSelectPolicies()
      .filter((p) => p.roles === 'PUBLIC' && isBareTrue(p.pred))
      .filter((p) => !PUBLIC_BY_INTENT.has(p.table));
    expect(
      open.map((p) => `${p.table}.${p.name} (${p.file})`),
      'world-readable with the publishable key — scope it, or add it to PUBLIC_BY_INTENT with a reason',
    ).toEqual([]);
  });

  it('(b) an account is not a relationship', () => {
    // `to authenticated using (true)` was how every DM and every ledger row
    // on the platform became readable by anyone who could sign up.
    const shared = finalSelectPolicies()
      .filter((p) => /authenticated/.test(p.roles) && isBareTrue(p.pred));
    expect(
      shared.map((p) => `${p.table}.${p.name} (${p.file})`),
      'readable by every signed-in user — gate on the relationship, not on having an account',
    ).toEqual([]);
  });

  /** What each RLS helper touches: the tables its own body reads, and the
   *  other helpers it calls. Recursion travels through calls, so (c) walks
   *  the closure rather than this one level — `is_thread_participant` reads
   *  `threads` directly but also `brands`/`creators` through own_user_ids(),
   *  and a one-level map would miss a policy on either. */
  const HELPERS: Record<string, { tables: string[]; calls: string[] }> = {
    own_user_ids:               { tables: ['public.brands', 'public.creators'], calls: [] },
    is_own_user_id:             { tables: [], calls: ['own_user_ids'] },
    is_brand_owner:             { tables: ['public.brands'], calls: [] },
    is_brand_owner_of_campaign: { tables: ['public.brands', 'public.campaigns'], calls: [] },
    is_creator_owner:           { tables: ['public.creators'], calls: [] },
    is_participant_of_campaign: {
      tables: [
        'public.campaigns', 'public.brands',
        'public.applications', 'public.offers', 'public.creators',
      ],
      calls: [],
    },
    is_thread_participant:      { tables: ['public.threads'], calls: ['own_user_ids'] },
    // 039. SECURITY DEFINER, so RLS does not apply inside it and recursion
    // cannot pass through it — listed anyway so (c) and the completeness
    // check below see everything a policy can reach.
    is_campaign_participant:    { tables: ['public.applications', 'public.offers', 'public.creators'], calls: [] },
  };

  /** Every table a helper can reach, following calls. */
  function reach(helper: string, seen = new Set<string>()): Set<string> {
    const out = new Set<string>();
    if (seen.has(helper)) return out;
    seen.add(helper);
    const h = HELPERS[helper];
    if (!h) return out;
    for (const t of h.tables) out.add(t);
    for (const c of h.calls) for (const t of reach(c, seen)) out.add(t);
    return out;
  }

  /** Last definition wins, same as Postgres. */
  function helperBody(helper: string, sql: string): string | null {
    const defs = [...sql.matchAll(
      new RegExp(
        `create\\s+or\\s+replace\\s+function\\s+(?:public|private)\\.${helper}[\\s\\S]*?\\$\\$([\\s\\S]*?)\\$\\$`,
        'gi',
      ),
    )];
    return defs.length ? defs[defs.length - 1][1] : null;
  }

  const allSql = () =>
    readdirSync(MIGRATIONS)
      .filter((f) => f.endsWith('.sql')).sort()
      .map((f) => readFileSync(join(MIGRATIONS, f), 'utf8'))
      .join('\n');

  it('(c) a policy never routes through a helper that reads its own table', () => {
    // The 005/019 helpers are `security invoker`, so the base tables' RLS
    // applies inside them. `is_participant_of_campaign` reads applications
    // and offers; guarding either with it recurses at query time, which
    // surfaces as "infinite recursion detected in policy" — or, worse, as a
    // silently empty result on a nullable path.
    const bad: string[] = [];
    for (const p of finalSelectPolicies()) {
      for (const helper of Object.keys(HELPERS)) {
        if (!new RegExp(`\\b${helper}\\b`).test(p.pred)) continue;
        if (reach(helper).has(p.table)) {
          bad.push(
            `${p.table}.${p.name} calls ${helper}(), which reaches ${p.table}`,
          );
        }
      }
    }
    expect(bad, bad.join('\n')).toEqual([]);
  });

  it('the helper map is complete, or (c) is decorative', () => {
    // (c) is only as good as HELPERS. Two directions, both needed:
    // everything declared must really be read, and everything read must be
    // declared — an under-declared helper is exactly how a recursive policy
    // would slip past (c) while the suite stayed green.
    const sql = allSql();
    for (const [helper, { tables, calls }] of Object.entries(HELPERS)) {
      const body = helperBody(helper, sql);
      expect(body, `${helper} has no definition in any migration`).not.toBeNull();

      for (const t of tables) {
        expect(body!, `HELPERS says ${helper} reads ${t}; its body does not`)
          .toContain(t);
      }
      for (const c of calls) {
        expect(body!, `HELPERS says ${helper} calls ${c}(); its body does not`)
          .toContain(c);
      }

      // The other direction: nothing in the body is undeclared.
      const referenced = new Set(
        [...body!.matchAll(/\bpublic\.(\w+)/g)].map((m) => m[1]),
      );
      const declared = new Set([
        ...tables.map((t) => t.replace('public.', '')),
        ...calls,
      ]);
      const undeclared = [...referenced].filter((r) => !declared.has(r));
      expect(
        undeclared,
        `${helper}() references public.${undeclared.join(', public.')} — add it to HELPERS, or (c) cannot see through it`,
      ).toEqual([]);
    }
  });

  it('the tables this class is about are gated on a real predicate', () => {
    // Belt and braces: the two guards above are absence-of-badness. This one
    // asserts the presence of the fix, so deleting 037 fails loudly rather
    // than returning the tables to their original state unnoticed.
    const byTable = new Map(finalSelectPolicies().map((p) => [p.table, p]));
    const EXPECTED: Record<string, RegExp> = {
      'public.applications':   /is_brand_owner_of_campaign|is_creator_owner/,
      'public.offers':         /is_brand_owner_of_campaign|is_creator_owner/,
      'public.collaborations': /is_brand_owner_of_campaign|is_creator_owner/,
      'public.contracts':      /is_brand_owner_of_campaign|is_creator_owner/,
      'public.submissions':    /is_brand_owner_of_campaign|is_creator_owner/,
      'public.deliverables':   /is_participant_of_campaign/,
      'public.reviews':        /hidden/,
      'public.transactions':   /is_own_user_id|is_brand_owner_of_campaign/,
      'public.threads':        /own_user_ids/,
      'public.messages':       /is_thread_participant/,
      'public.disputes':       /is_participant_of_campaign/,
      'public.outreach':       /is_brand_owner|is_creator_owner/,
      'public.campaigns':      /is_campaign_participant/,
    };
    for (const [table, pattern] of Object.entries(EXPECTED)) {
      const p = byTable.get(table);
      expect(p, `no SELECT policy for ${table}`).toBeDefined();
      expect(p!.pred, `${table} predicate does not gate on ${pattern}`).toMatch(pattern);
    }
  });

  // ── The public projections (038) ──────────────────────────────────────
  // A live projection makes every column in it world-readable. 025's views
  // were dead, so their columns were private by accident; these were each
  // re-justified. A column added to a projection must be added here too.

  /** Columns of the latest `create table … public.<t> as select … from`. */
  function projectionColumns(t: string): string[] {
    const defs = [...allSql().replace(/--[^\n]*/g, '').matchAll(
      new RegExp(`create\\s+table\\s+(?:if\\s+not\\s+exists\\s+)?public\\.${t}\\s+as\\s+select([\\s\\S]*?)\\bfrom\\b`, 'gi'),
    )];
    expect(defs.length, `no projection definition for ${t}`).toBeGreaterThan(0);
    return defs[defs.length - 1][1].split(',').map((c) => c.trim()).filter(Boolean);
  }

  const NEVER_PUBLIC: Record<string, string[]> = {
    creators_public: ['owner_email', 'payout', 'wallet_balance', 'pending_balance',
      'lifetime_earnings', 'tax_form', 'agreement_accepted_at', 'agreement_version', 'saved_briefs'],
    brands_public: ['owner_email', 'wallet_balance', 'escrow_held', 'saved_creators'],
    campaigns_public: ['spent', 'escrow_held', 'history', 'milestones', 'auto_shortlist'],
  };

  it('no projection carries a column that must stay private', () => {
    for (const [t, deny] of Object.entries(NEVER_PUBLIC)) {
      const cols = projectionColumns(t);
      expect(cols.length, `${t} parsed to nothing`).toBeGreaterThan(5);
      expect(cols.filter((c) => deny.includes(c)), `${t} exposes`).toEqual([]);
    }
  });

  it('the app reads only columns its projection actually has', () => {
    // One extra column and PostgREST answers 42703; the repo logs a warning
    // and returns [], and every visitor silently gets seed data instead.
    const repoCols = (rel: string, name: string) => {
      const m = new RegExp(`const ${name}\\s*=([\\s\\S]*?);`).exec(code(rel));
      expect(m, `${name} not found in ${rel}`).not.toBeNull();
      return [...m![1].matchAll(/'([^']*)'/g)].map((x) => x[1]).join('')
        .split(',').map((c) => c.trim()).filter(Boolean);
    };
    for (const [rel, t] of [
      ['lib/data/creatorsRepo.ts', 'creators_public'],
      ['lib/data/brandsRepo.ts', 'brands_public'],
      ['lib/data/campaignsRepo.ts', 'campaigns_public'],
    ] as const) {
      const have = new Set(projectionColumns(t));
      const missing = repoCols(rel, 'PUBLIC_COLUMNS').filter((c) => !have.has(c));
      expect(missing, `${rel} selects columns ${t} does not have`).toEqual([]);
    }
  });

  it('a projection is written by its trigger, never by a policy', () => {
    // No write policy means a creator cannot set `verified = true` on their
    // public row directly, whatever their raw row says.
    const live = new Map<string, string>();
    for (const file of readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort()) {
      const sql = readFileSync(join(MIGRATIONS, file), 'utf8')
        .replace(/\$\$[\s\S]*?\$\$/g, '$$BODY$$').replace(/--[^\n]*/g, '');
      for (const m of sql.matchAll(/drop\s+policy\s+(?:if\s+exists\s+)?"?([\w ]+?)"?\s+on\s+(public\.\w+)\s*;/gi)) {
        live.delete(`${m[2]}|${m[1]}`);
      }
      for (const m of sql.matchAll(/create\s+policy\s+"?([\w ]+?)"?\s+on\s+(public\.\w+)\s+for\s+(\w+)/gi)) {
        live.set(`${m[2]}|${m[1]}`, m[3].toLowerCase());
      }
    }
    const writes = [...live.entries()]
      .filter(([k, cmd]) => /_public\|/.test(k) && cmd !== 'select')
      .map(([k, cmd]) => `${k} (${cmd})`);
    expect(writes).toEqual([]);
  });

  it('the sync function cannot be called from the API', () => {
    const sql = allSql();
    const def = /create\s+or\s+replace\s+function\s+private\.sync_projection\(\)([\s\S]*?)as\s+\$\$/i.exec(sql);
    expect(def, 'sync_projection must live in the unexposed `private` schema').not.toBeNull();
    expect(def![1]).toMatch(/security\s+definer/i);
    expect(def![1]).toMatch(/set\s+search_path\s*=\s*''/i);
    expect(sql).toMatch(/revoke\s+all\s+on\s+function\s+private\.sync_projection\(\)\s+from\s+public,\s*anon,\s*authenticated/i);
  });

  it('every entry on the public allowlist is actually public', () => {
    // An allowlist only ever grows unless something checks it. A stale entry
    // is a pre-approved exemption waiting for the next open policy.
    const open = new Set(finalSelectPolicies()
      .filter((p) => p.roles === 'PUBLIC' && isBareTrue(p.pred)).map((p) => p.table));
    expect([...PUBLIC_BY_INTENT].filter((t) => !open.has(t))).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────
// CLASS 13 — the suite never reaches a real database
//
// Found 2026-10-23, by accident: a mocked test got the real client through
// one dynamic import and came back with someone else's identity. Vite loads
// `.env.local` in test mode, so `isSupabaseConfigured()` had been true in
// every test since the file existed — each jsdom test hydrated the store from
// production on import. All of it anonymous (no test signs in; RLS refuses
// every anon write), so nothing was mutated. One sign-in test away from it
// not being.

describe('tests are hermetic', () => {
  it('Supabase is unconfigured in every test', () => {
    expect(
      isSupabaseConfigured(),
      'a test can reach the real project — pin VITE_SUPABASE_* empty in vitest.config.ts',
    ).toBe(false);
  });

  it('and the config says so on purpose, not by luck of the environment', () => {
    const cfg = readFileSync(join(SRC, '..', 'vitest.config.ts'), 'utf8');
    expect(cfg).toMatch(/VITE_SUPABASE_URL:\s*''/);
    expect(cfg).toMatch(/VITE_SUPABASE_ANON_KEY:\s*''/);
  });
});

// ─────────────────────────────────────────────────────────────────────
// CLASS 14 — a fetch made as one identity is not kept for another
//
// Since 037 every table answers according to who is asking, so the local
// store is one identity's snapshot. Hydration ran once, at page load —
// verified live: after the demo sign-in Sarah's own contract was absent and
// her home showed the seed balance ($33,143) instead of her real $4,200
// until a refresh. sessionSync.test.ts holds the behaviour; this holds the
// shape, so the call cannot drift back behind the early return that hid it.

describe('signing in re-fetches as the person who signed in', () => {
  it('hydration is a callable function, not a one-shot at module load', () => {
    expect(code('lib/api/store.ts')).toMatch(/export async function hydrateFromSupabase\(/);
  });

  it('sessionSync re-hydrates on SIGNED_IN before its early return', () => {
    const src = code('lib/auth/sessionSync.ts');
    const call = src.indexOf('hydrateFromSupabase()');
    const early = src.indexOf('if (matchedLocal && localSession?.userId === matchedLocal.id) return;');
    expect(call, 'sessionSync never re-hydrates').toBeGreaterThan(-1);
    expect(early, 'early-return anchor moved — re-check this guard').toBeGreaterThan(-1);
    expect(call, 'the re-fetch sits behind the early return every demo sign-in takes').toBeLessThan(early);
  });

  it('a superseded run cannot write the store', () => {
    const src = code('lib/api/store.ts');
    const body = src.slice(src.indexOf('async function runHydration('));
    // Every write a run makes is preceded by a staleness check.
    const writes = [...body.matchAll(/useStore\.setState\(/g)].length;
    const checks = [...body.matchAll(/isCurrent\(\)/g)].length;
    expect(writes).toBeGreaterThan(0);
    expect(checks, 'a hydration write is not gated on isCurrent()').toBeGreaterThanOrEqual(writes);
  });
});
