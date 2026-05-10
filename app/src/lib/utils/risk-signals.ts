// Risk signals for admin moderation (Phase 22).
//
// Surface concrete heuristics that warrant a closer look — re-used handles,
// recently-created accounts, sparse portfolios, low audience credibility,
// etc. Each signal carries severity + plain-language message so the admin
// can scan a row and decide where to dig. Real backend would compute these
// against a much wider signal set (IP fingerprinting, device match, KYC
// document scoring); this module mocks the shape with what's available
// in the store.

import type { Creator, Database, User } from '@/lib/api/types';
import { computeProfileCompletion } from './profile-completion';

export type RiskSeverity = 'low' | 'medium' | 'high';

export interface RiskSignal {
  /** Stable key — used as React `key` and for filtering. */
  kind:
    | 'duplicate_handle'
    | 'fresh_account'
    | 'sparse_profile'
    | 'no_work'
    | 'unverified_platforms'
    | 'low_audience_credibility'
    | 'high_suspicious_followers'
    | 'incomplete_payout';
  severity: RiskSeverity;
  /** Short label for the chip (4-12 chars). */
  label: string;
  /** Full sentence shown on hover or in the modal. */
  message: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Look at a creator + their user record + the rest of the DB; return signals. */
export function riskSignalsForCreator(
  creator: Creator,
  user: User,
  db: Database,
  /** Reference "now" — admins audit against REF_DATE in seed mode. */
  now: Date,
): RiskSignal[] {
  const out: RiskSignal[] = [];

  // ---- Duplicate handle: another creator (different id) using the same handle ----
  const normalize = (h: string) => h.toLowerCase().replace(/^@/, '').trim();
  const myHandle = normalize(creator.handle);
  const dupCount = db.creators.filter((c) => c.id !== creator.id && normalize(c.handle) === myHandle).length;
  if (dupCount > 0) {
    out.push({
      kind: 'duplicate_handle',
      severity: 'high',
      label: 'Dup handle',
      message: `Handle ${creator.handle} matches ${dupCount} existing creator${dupCount === 1 ? '' : 's'} on Alamut.`,
    });
  }

  // ---- Fresh account: < 7 days old ----
  const ageDays = Math.max(0, Math.round((+now - +new Date(user.createdAt)) / DAY_MS));
  if (ageDays < 7) {
    out.push({
      kind: 'fresh_account',
      severity: 'medium',
      label: 'New account',
      message: `Account created ${ageDays === 0 ? 'today' : `${ageDays}d ago`} — fresh signups need extra checks.`,
    });
  }

  // ---- Sparse profile: completion < 50% ----
  // P6 §5.6 — compute on read instead of reading the stored field.
  const completion = computeProfileCompletion(creator, db);
  if (completion < 50) {
    out.push({
      kind: 'sparse_profile',
      severity: 'medium',
      label: `${completion}% profile`,
      message: `Profile is only ${completion}% complete — missing fields make trust calls harder.`,
    });
  }

  // ---- No portfolio at all ----
  if (creator.work.length === 0) {
    out.push({
      kind: 'no_work',
      severity: 'high',
      label: 'No work',
      message: 'No portfolio samples uploaded — applicants without work are usually rejected.',
    });
  }

  // ---- All platforms self-reported (none verified) ----
  if (creator.platforms.length > 0 && creator.platforms.every((p) => !p.verified)) {
    out.push({
      kind: 'unverified_platforms',
      severity: 'medium',
      label: 'Unverified',
      message: `All ${creator.platforms.length} platform handle${creator.platforms.length === 1 ? '' : 's'} are self-reported — no OAuth verification.`,
    });
  }

  // ---- Low audience credibility (uses platform-level audience data) ----
  const platformsWithAudience = creator.platforms.filter((p) => p.audience);
  const credScores = platformsWithAudience
    .map((p) => p.audience!.audienceCredibilityScore)
    .filter((n) => typeof n === 'number');
  if (credScores.length > 0) {
    const minCred = Math.min(...credScores);
    if (minCred < 60) {
      out.push({
        kind: 'low_audience_credibility',
        severity: 'high',
        label: `Cred ${Math.round(minCred)}`,
        message: `Lowest audience credibility score is ${Math.round(minCred)}/100 — below the 60 threshold for organic engagement.`,
      });
    }
  }
  const susp = creator.platforms
    .map((p) => p.audience?.suspiciousFollowerPct)
    .filter((n): n is number => typeof n === 'number');
  if (susp.length > 0 && Math.max(...susp) > 25) {
    out.push({
      kind: 'high_suspicious_followers',
      severity: 'high',
      label: `Susp ${Math.round(Math.max(...susp))}%`,
      message: `One platform reports ${Math.round(Math.max(...susp))}% suspicious followers — typical clean accounts are <15%.`,
    });
  }

  // ---- Payout method unset ----
  // Phase 22 QA fix: explicit handling of empty string + the legacy '—'
  // sentinel; safer than relying on falsy short-circuit alone.
  const acct = creator.payout?.account?.trim() || '';
  if (acct === '' || acct === '—') {
    out.push({
      kind: 'incomplete_payout',
      severity: 'low',
      label: 'No payout',
      message: 'No payout destination configured — they can be approved, but can\'t actually withdraw earnings.',
    });
  }

  return out;
}

/** Pick the worst severity from a signal list (for row-level summary chip). */
export function worstSeverity(signals: RiskSignal[]): RiskSeverity | null {
  if (signals.length === 0) return null;
  if (signals.some((s) => s.severity === 'high')) return 'high';
  if (signals.some((s) => s.severity === 'medium')) return 'medium';
  return 'low';
}
