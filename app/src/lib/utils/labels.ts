// Centralized label + tone maps for every domain enum (Phase 20).
//
// Before this module: each screen redeclared its own `STATE_LABEL` / mapped
// `.replace('_', ' ')` inline / rendered raw lowercase enums to users. The
// audit found ~20 places across creator, brand, and admin screens where
// `production`, `escrow_release`, `in_review`, `bonus_paid`, etc. were
// leaking unedited into the UI — exactly the jargon-stripping the landing
// page was rewritten to avoid.
//
// This file is the single source of truth. Every screen reads from here so:
//   1. We can change "Posted" → "Live on channels" in one place
//   2. Translators have a flat key/value file instead of grepping
//   3. The Pill `tone` for a status is consistent across screens
//
// Helpers at the bottom let callers do `txLabel(t.kind)` /
// `txTone(t.kind)` etc. with a fallback for unknown values.
//
// IMPORTANT: when adding a new enum value, add it here FIRST — TS will
// then surface every consumer that needs to handle the new case.

import type {
  ApplicationStatus,
  CampaignKind,
  CampaignStage,
  CreatorTier,
  DisputeCategory,
  DisputeStatus,
  OfferStatus,
  PricingModel,
  ReferralStatus,
  SubmissionStatus,
  TrustTier,
  TxKind,
  TxStatus,
  UserStatus,
} from '@/lib/api/types';

/** Pill tone keys used across the platform.
 *  Must match the Tone type on `<Pill>` exactly so callers can pass these
 *  through unchanged: `<Pill tone={txTone(t.kind)}>`. */
export type Tone = 'neutral' | 'good' | 'warn' | 'bad' | 'info' | 'ink' | 'premium';

// ============================================================
// Campaign stage
// ============================================================

// P1b §1.2 — only 4 campaign-level stages now. Per-collab labels
// (Shortlisting / Offer / Production / Posted / Reporting) move to a
// CollabStage label map in P1c.
export const STAGE_LABEL: Record<CampaignStage, string> = {
  draft:  'Draft',
  live:   'Live',
  paused: 'Paused',
  closed: 'Closed',
};

export const STAGE_TONE: Record<CampaignStage, Tone> = {
  draft:  'neutral',  // pre-publish
  live:   'good',     // accepting applications + active work
  paused: 'warn',     // brand temporarily suspended
  closed: 'neutral',  // archived
};

export const stageLabel = (s: CampaignStage | string | undefined): string =>
  s && s in STAGE_LABEL ? STAGE_LABEL[s as CampaignStage] : titleCase(s || '—');

export const stageTone = (s: CampaignStage | string | undefined): Tone =>
  s && s in STAGE_TONE ? STAGE_TONE[s as CampaignStage] : 'neutral';

// ============================================================
// Application status
// ============================================================

export const APPLICATION_STATUS_LABEL: Record<ApplicationStatus, string> = {
  submitted:   'Submitted',
  shortlisted: 'Shortlisted',
  accepted:    'Accepted',
  rejected:    'Declined',
  withdrawn:   'Withdrawn',
};

export const APPLICATION_STATUS_TONE: Record<ApplicationStatus, Tone> = {
  submitted:   'info',
  shortlisted: 'good',
  accepted:    'good',
  rejected:    'bad',
  withdrawn:   'neutral',
};

export const applicationStatusLabel = (s: ApplicationStatus | string | undefined): string =>
  s && s in APPLICATION_STATUS_LABEL ? APPLICATION_STATUS_LABEL[s as ApplicationStatus] : titleCase(s || '—');

export const applicationStatusTone = (s: ApplicationStatus | string | undefined): Tone =>
  s && s in APPLICATION_STATUS_TONE ? APPLICATION_STATUS_TONE[s as ApplicationStatus] : 'neutral';

// ============================================================
// Offer status
// ============================================================

export const OFFER_STATUS_LABEL: Record<OfferStatus, string> = {
  pending:   'Awaiting response',
  accepted:  'Accepted',
  declined:  'Declined',
  withdrawn: 'Withdrawn',
  countered: 'Countered',
  // P3 §2.1 — counter cap exceeded (4th counter attempt rejected).
  expired:   'Expired',
};

export const OFFER_STATUS_TONE: Record<OfferStatus, Tone> = {
  pending:   'warn',
  accepted:  'good',
  declined:  'bad',
  withdrawn: 'neutral',
  countered: 'info',
  expired:   'neutral',
};

export const offerStatusLabel = (s: OfferStatus | string | undefined): string =>
  s && s in OFFER_STATUS_LABEL ? OFFER_STATUS_LABEL[s as OfferStatus] : titleCase(s || '—');

export const offerStatusTone = (s: OfferStatus | string | undefined): Tone =>
  s && s in OFFER_STATUS_TONE ? OFFER_STATUS_TONE[s as OfferStatus] : 'neutral';

// ============================================================
// Submission state (creator drafts under brand review)
// ============================================================

export const SUBMISSION_STATUS_LABEL: Record<SubmissionStatus, string> = {
  in_review: 'In review',
  revisions: 'Revisions requested',
  approved:  'Approved',
};

export const SUBMISSION_STATUS_TONE: Record<SubmissionStatus, Tone> = {
  in_review: 'info',  // passive: brand reviewing, no action needed
  revisions: 'warn',  // creator needs to act, but not a failure
  approved:  'good',
};

export const submissionStatusLabel = (s: SubmissionStatus | string | undefined): string =>
  s && s in SUBMISSION_STATUS_LABEL ? SUBMISSION_STATUS_LABEL[s as SubmissionStatus] : titleCase(s || '—');

export const submissionStatusTone = (s: SubmissionStatus | string | undefined): Tone =>
  s && s in SUBMISSION_STATUS_TONE ? SUBMISSION_STATUS_TONE[s as SubmissionStatus] : 'neutral';

// ============================================================
// Transaction kind + status
// ============================================================

export const TX_KIND_LABEL: Record<TxKind, string> = {
  topup:           'Top-up',
  escrow_hold:     'Escrow hold',
  escrow_release:  'Escrow release',
  payout:          'Payout',
  refund:          'Refund',
  fee:             'Platform fee',
  ad_spend:        'Ad spend',
  referral_bonus:  'Referral bonus',
};

/** Inflows are good/info tones, outflows are warn/neutral, fees are bad. */
export const TX_KIND_TONE: Record<TxKind, Tone> = {
  topup:           'good',
  escrow_hold:     'info',
  escrow_release:  'info',
  payout:          'good',
  refund:          'good',
  fee:             'warn',
  ad_spend:        'warn',
  referral_bonus:  'premium',
};

export const txLabel = (k: TxKind | string | undefined): string =>
  k && k in TX_KIND_LABEL ? TX_KIND_LABEL[k as TxKind] : titleCase(k || '—');

export const txTone = (k: TxKind | string | undefined): Tone =>
  k && k in TX_KIND_TONE ? TX_KIND_TONE[k as TxKind] : 'neutral';

export const TX_STATUS_LABEL: Record<TxStatus, string> = {
  cleared: 'Cleared',
  pending: 'Pending',
  failed:  'Failed',
};

export const TX_STATUS_TONE: Record<TxStatus, Tone> = {
  cleared: 'good',
  pending: 'warn',
  failed:  'bad',
};

export const txStatusLabel = (s: TxStatus | string | undefined): string =>
  s && s in TX_STATUS_LABEL ? TX_STATUS_LABEL[s as TxStatus] : titleCase(s || '—');

export const txStatusTone = (s: TxStatus | string | undefined): Tone =>
  s && s in TX_STATUS_TONE ? TX_STATUS_TONE[s as TxStatus] : 'neutral';

// ============================================================
// Disputes
// ============================================================

// P2 §1.4 — six-state dispute lifecycle. `in-review` is the admin-
// picked-up state between `open` and resolution; the three resolution
// variants split out the money path explicitly.
export const DISPUTE_STATUS_LABEL: Record<DisputeStatus, string> = {
  'open':              'Open',
  'in-review':         'In review',
  'resolved-refund':   'Resolved · refunded',
  'resolved-release':  'Resolved · released',
  'resolved-partial':  'Resolved · partial',
  'withdrawn':         'Withdrawn',
};

export const DISPUTE_STATUS_TONE: Record<DisputeStatus, Tone> = {
  'open':              'bad',
  'in-review':         'warn',
  'resolved-refund':   'info',
  'resolved-release':  'good',
  'resolved-partial':  'warn',
  'withdrawn':         'neutral',
};

export const disputeStatusLabel = (s: DisputeStatus | string | undefined): string =>
  s && s in DISPUTE_STATUS_LABEL ? DISPUTE_STATUS_LABEL[s as DisputeStatus] : titleCase(s || '—');

export const disputeStatusTone = (s: DisputeStatus | string | undefined): Tone =>
  s && s in DISPUTE_STATUS_TONE ? DISPUTE_STATUS_TONE[s as DisputeStatus] : 'neutral';

// P2 §1.4 — `category` replaces the pre-P2 `reason` enum. Keep the
// legacy name on the helper export for back-compat with one stray UI
// caller; the canonical name is `disputeCategoryLabel`.
export const DISPUTE_CATEGORY_LABEL: Record<DisputeCategory, string> = {
  'non-delivery':      'Non-delivery',
  'quality':           'Content quality',
  'scope-creep':       'Scope creep',
  'late-payment':      'Late payment',
  'content-takedown':  'Content takedown',
  'other':             'Other',
};

export const disputeCategoryLabel = (c: DisputeCategory | string | undefined): string =>
  c && c in DISPUTE_CATEGORY_LABEL ? DISPUTE_CATEGORY_LABEL[c as DisputeCategory] : titleCase(c || '—');

// ============================================================
// Tiers, campaign kind, pricing model, user status, referrals
// ============================================================

export const CREATOR_TIER_LABEL: Record<CreatorTier, string> = {
  Rising:     'Rising',
  Specialist: 'Specialist',
  Flagship:   'Flagship',
};

export const TRUST_TIER_LABEL: Record<TrustTier, string> = {
  bronze: 'Bronze',
  silver: 'Silver',
  gold:   'Gold',
};

export const TRUST_TIER_TONE: Record<TrustTier, Tone> = {
  bronze: 'warn',
  silver: 'info',
  gold:   'premium',
};

export const CAMPAIGN_KIND_LABEL: Record<CampaignKind, string> = {
  one_off:  'One-off',
  retainer: 'Retainer',
};

export const PRICING_MODEL_LABEL: Record<PricingModel, string> = {
  fixed:   'Fixed rate',
  outcome: 'Outcome-based',
};

export const USER_STATUS_LABEL: Record<UserStatus, string> = {
  pending_verification: 'Email unverified',
  active:               'Active',
  pending_admin_review: 'Awaiting admin review',
  suspended:            'Suspended',
};

export const USER_STATUS_TONE: Record<UserStatus, Tone> = {
  pending_verification: 'warn',
  active:               'good',
  pending_admin_review: 'info',
  suspended:            'bad',
};

export const userStatusLabel = (s: UserStatus | string | undefined): string =>
  s && s in USER_STATUS_LABEL ? USER_STATUS_LABEL[s as UserStatus] : titleCase(s || '—');

export const userStatusTone = (s: UserStatus | string | undefined): Tone =>
  s && s in USER_STATUS_TONE ? USER_STATUS_TONE[s as UserStatus] : 'neutral';

export const REFERRAL_STATUS_LABEL: Record<ReferralStatus, string> = {
  invited:    'Invited',
  active:     'Active',
  expired:    'Expired',
  bonus_paid: 'Bonus paid',
};

export const REFERRAL_STATUS_TONE: Record<ReferralStatus, Tone> = {
  invited:    'info',
  active:     'good',
  expired:    'neutral',
  bonus_paid: 'premium',
};

// ============================================================
// Deal state (Phase 24 — derived per-creator-per-campaign substate)
// ============================================================
//
// `DealState` lives in `deal-state.ts` as the canonical type. Mapping it
// here so any UI rendering a deal state goes through the same label/tone
// lookup as the rest of the platform's enums (Phase 20 invariant).
// We don't import the type directly to avoid a circular dependency
// between labels and deal-state (deal-action already imports labels for
// fmtMoneyFull); using a string literal mirror is fine.

type DealStateKey =
  | 'applied' | 'shortlisted'
  | 'offer-pending' | 'offer-countered' | 'declined' | 'withdrawn'
  | 'accepted-production' | 'in-review' | 'revisions-requested'
  | 'approved' | 'posted' | 'closed' | 'disputed';

export const DEAL_STATE_LABEL: Record<DealStateKey, string> = {
  'applied':              'Applied',
  'shortlisted':          'Shortlisted',
  'offer-pending':        'Pending offer',
  'offer-countered':      'Countered',
  'declined':             'Declined',
  'withdrawn':            'Withdrawn',
  'accepted-production':  'In production',
  'in-review':            'In review',
  'revisions-requested':  'Revisions requested',
  'approved':             'Approved',
  'posted':               'Posted',
  'closed':               'Closed',
  'disputed':             'Disputed',
};

export const DEAL_STATE_TONE: Record<DealStateKey, Tone> = {
  'applied':              'info',
  'shortlisted':          'good',
  'offer-pending':        'warn',
  'offer-countered':      'info',
  'declined':             'bad',
  'withdrawn':            'neutral',
  'accepted-production':  'info',
  'in-review':            'warn',
  'revisions-requested':  'warn',
  'approved':             'good',
  'posted':               'good',
  'closed':               'neutral',
  'disputed':             'bad',
};

export const dealStateLabel = (s: string | undefined): string =>
  s && s in DEAL_STATE_LABEL ? DEAL_STATE_LABEL[s as DealStateKey] : titleCase(s || '—');

export const dealStateTone = (s: string | undefined): Tone =>
  s && s in DEAL_STATE_TONE ? DEAL_STATE_TONE[s as DealStateKey] : 'neutral';

// ============================================================
// Helpers
// ============================================================

/** Last-resort fallback: turn `escrow_release` into `Escrow release`. */
function titleCase(s: string): string {
  if (!s) return '—';
  const spaced = s.replace(/_/g, ' ').replace(/-/g, ' ');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase();
}
