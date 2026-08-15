// creatorAgreement.test.ts — the agreement must describe THIS product.
//
// The step it belongs to shipped with a "Review agreement" CTA and no
// document behind it, and marked itself signed off the back of an unrelated
// payout. Two things have to stay true now: the words exist, and the numbers
// in them come from the same constants the release path uses.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  CREATOR_AGREEMENT,
  CREATOR_AGREEMENT_VERSION,
  creatorAgreementAsText,
} from '../creatorAgreement';
import { PLATFORM_FEE, WHT } from '@/lib/api/money';
import { buildSteps } from '@/screens/workspace-v2/screens/KycTax';

describe('the document', () => {
  it('has content in every section', () => {
    expect(CREATOR_AGREEMENT.length).toBeGreaterThan(5);
    for (const s of CREATOR_AGREEMENT) {
      expect(s.heading.trim().length).toBeGreaterThan(0);
      expect(s.body.length).toBeGreaterThan(0);
      for (const p of s.body) expect(p.trim().length).toBeGreaterThan(20);
    }
  });

  it('quotes the REAL platform fee and withholding', () => {
    // Interpolated from money.ts, never typed as a literal — an agreement
    // promising 10% while the release path takes something else is the
    // exact class of drift this codebase keeps producing.
    const text = creatorAgreementAsText();
    expect(text).toContain(`${Math.round(PLATFORM_FEE * 100)}%`);
    expect(text).toContain(`${Math.round(WHT * 100)}%`);
  });

  it('states that beta payments are simulated', () => {
    // Matches screens/legal/LegalPage.tsx. A creator must not accept terms
    // implying the wallet holds real money they can claim.
    expect(creatorAgreementAsText().toLowerCase()).toContain('simulated');
  });

  it('does not contain a fee figure the code cannot back', () => {
    // Guards against someone hand-editing a number into the prose later.
    const percentages = new Set(
      (creatorAgreementAsText().match(/\b\d{1,2}%/g) ?? []).map((m) => m),
    );
    const allowed = new Set([
      `${Math.round(PLATFORM_FEE * 100)}%`,
      `${Math.round(WHT * 100)}%`,
    ]);
    for (const p of percentages) expect(allowed.has(p)).toBe(true);
  });

  it('carries a version, and the source interpolates it', () => {
    expect(CREATOR_AGREEMENT_VERSION).toMatch(/^\d+\.\d+$/);
    expect(creatorAgreementAsText()).toContain(CREATOR_AGREEMENT_VERSION);
  });
});

describe('the KYC step reflects a real signature', () => {
  const withBank = { verified: true, payout: { account: '1234567890' } };

  it('is "action" until the creator has actually accepted', () => {
    // Pre-fix this read `hasBank && hasPaidCollab`, so a payout — an event
    // with nothing to do with consent — marked it signed.
    const step = buildSteps({ ...withBank }, true).find((s) => s.id === 'agreement')!;
    expect(step.status).toBe('action');
    expect(step.cta).toBe('Review agreement');
  });

  it('is "verified" once accepted, even with no paid collab', () => {
    const step = buildSteps(
      { ...withBank, agreementAcceptedAt: '2026-08-14T00:00:00Z', agreementVersion: '1.0' },
      false,
    ).find((s) => s.id === 'agreement')!;
    expect(step.status).toBe('verified');
    expect(step.detail).toContain('2026');
    expect(step.detail).toContain('v1.0');
  });

  it('stays locked without a bank account, accepted or not', () => {
    const step = buildSteps(
      { verified: true, agreementAcceptedAt: '2026-08-14T00:00:00Z' },
      true,
    ).find((s) => s.id === 'agreement')!;
    expect(step.status).toBe('locked');
  });

  it('acceptance survives a Supabase hydrate', () => {
    // The overlay builds each creator by spreading the REMOTE row, so a
    // field Postgres has no column for is dropped on every page load —
    // accept the agreement, reload, be asked again. Until migration 032 is
    // applied AND creatorsRepo widened, these two lines are the only thing
    // keeping the acceptance alive.
    const store = readFileSync(
      join(__dirname, '..', '..', 'api', 'store.ts'), 'utf8',
    );
    const preserved = store.match(/agreementAcceptedAt: \w+\.agreementAcceptedAt \?\? \w+\.agreementAcceptedAt/g) ?? [];
    // Both overlay sites: the bulk hydrate and the owner-PII pass.
    expect(preserved.length).toBe(2);
    expect(store).toContain('taxForm:');
  });

  it('acceptance is written through the one creator mirror, not a raw tx', () => {
    // The modal first called `tx()` directly: local state updated, Postgres
    // never told. Routing it through v2CreatorActions means it uses the same
    // `mirrorCreatorToSupabase` as every other creator write.
    const kyc = readFileSync(
      join(__dirname, '..', '..', '..', 'screens', 'workspace-v2', 'screens', 'KycTax.tsx'), 'utf8',
    );
    expect(kyc).toContain('v2AcceptCreatorAgreement(CREATOR_AGREEMENT_VERSION)');

    const actions = readFileSync(
      join(__dirname, '..', '..', '..', 'screens', 'workspace-v2', 'v2CreatorActions.ts'), 'utf8',
    );
    expect(actions).toContain('export function v2AcceptCreatorAgreement');
    // And the mirror body must carry the fields, or the write drops them
    // silently — which is exactly how `taxForm` was being lost.
    expect(actions).toContain('agreementAcceptedAt: creator.agreementAcceptedAt');
    expect(actions).toContain('taxForm: creator.taxForm');
  });

  it('the repo selects and writes the migration-032 columns', () => {
    const repo = readFileSync(
      join(__dirname, '..', '..', 'data', 'creatorsRepo.ts'), 'utf8',
    );
    expect(repo).toContain('agreement_accepted_at, agreement_version, tax_form');
    expect(repo).toContain('out.agreement_accepted_at = patch.agreementAcceptedAt');
    // PII stays out of the public view — `creators_public` has no such
    // columns, so selecting them there would fail outright.
    const publicCols = repo.slice(repo.indexOf('const PUBLIC_COLUMNS'), repo.indexOf('function toCreator'));
    expect(publicCols).not.toContain('tax_form');
    expect(publicCols).not.toContain('agreement_accepted_at');
  });

  it('never claims a signature came from an offer', () => {
    const src = readFileSync(
      join(__dirname, '..', '..', '..', 'screens', 'workspace-v2', 'screens', 'KycTax.tsx'),
      'utf8',
    ).split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
    expect(src).not.toContain('Signed via first accepted offer');
  });
});
