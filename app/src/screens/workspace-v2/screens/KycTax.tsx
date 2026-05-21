// KycTax.tsx — v2 creator-side KYC + tax registration
//
// Step list with verification states. Each step is one of:
//   verified  → green pill, no action button
//   pending   → amber pill, "View status" button
//   action    → terracotta pill, primary CTA
//   locked    → ink-3 pill, disabled (waiting on prior step)
//
// Bottom block: auto-generated tax certificates that creators can
// download for filing season.

import { useEffect, useMemo, useState } from 'react';
import { Icon, Topbar } from '../lib';
import { pushToast } from '@/lib/utils/toast';
import { downloadCSV } from '@/lib/utils/csv';
import { useV2CurrentCreator } from '../v2Hooks';
import { useStore, tx } from '@/lib/api/store';
import { TaxFormModal } from './TaxFormModal';
import type { TaxFormRecord } from '@/lib/api/types';

interface Props {
  onRoute: (r: string) => void;
  /** When the route arrived with `?action=next-step` (CreatorHome's
   *  Today tile), scroll to + visually highlight the first incomplete
   *  step so the creator lands inside the next action instead of at
   *  the page header (which the sidebar already does). */
  initialAction?: 'next-step';
}

type StepStatus = 'verified' | 'pending' | 'action' | 'locked';

interface Step {
  id: string;
  title: string;
  description: string;
  detail?: string;
  status: StepStatus;
  completedAt?: string;
  cta?: string;
}

/** Build the step list from the actual creator state.
 *  - identity / address: gated by `creator.verified`
 *  - tax-form: pending until creator.payout has a country indicator
 *  - bank: action until creator.payout.account is set
 *  - agreement: locked until bank is set; verified once Creator has
 *    at least one paid collab (signal that the agreement was signed
 *    when the first offer was accepted)
 */
export function buildSteps(creator: {
  verified?: boolean;
  payout?: { account?: string; method?: string; currency?: string };
  city?: string;
  country?: string;
  taxForm?: TaxFormRecord;
} | null | undefined, hasPaidCollab: boolean): Step[] {
  const c = creator;
  const verified = !!c?.verified;
  const hasBank = !!(c?.payout?.account && c.payout.account.trim().length > 0);
  const hasTaxForm = !!c?.taxForm;
  const idStatus: StepStatus = verified ? 'verified' : 'action';
  const addrStatus: StepStatus = verified ? 'verified' : 'action';
  // Phase 50 — tax-form step flips to action (collect-now) when ID is
  // verified but no W-9/W-8BEN is on file. Once submitted → verified.
  const taxStatus: StepStatus = verified
    ? (hasTaxForm ? 'verified' : 'action')
    : 'locked';
  const bankStatus: StepStatus = verified ? (hasBank ? 'verified' : 'action') : 'locked';
  const agreementStatus: StepStatus = hasBank && hasPaidCollab ? 'verified' : hasBank ? 'action' : 'locked';

  return [
    {
      id: 'identity',
      title: 'Identity verification',
      description: 'Government-issued ID + selfie. Powered by Persona — typically clears in under 5 minutes.',
      detail: c?.country ? `${c.country} national ID` : undefined,
      status: idStatus,
      completedAt: idStatus === 'verified' ? 'Verified' : undefined,
      cta: idStatus === 'verified' ? undefined : 'Start verification',
    },
    {
      id: 'address',
      title: 'Address verification',
      description: 'Utility bill or bank statement showing your name and current address.',
      detail: c?.city ? `${c.city}${c.country ? `, ${c.country}` : ''}` : undefined,
      status: addrStatus,
      completedAt: addrStatus === 'verified' ? 'Verified' : undefined,
      cta: addrStatus === 'verified' ? undefined : 'Upload document',
    },
    {
      id: 'tax-form',
      title: 'Tax form (W-9 / W-8BEN)',
      description: 'W-9 for US persons; W-8BEN for everyone else. Required before your first payout clears.',
      detail: taxStatus === 'verified' && c?.taxForm
        ? `${c.taxForm.kind} on file · signed ${new Date(c.taxForm.signedAt).toLocaleDateString()}`
        : '',
      status: taxStatus,
      cta: taxStatus === 'action' ? 'Complete tax form'
        : taxStatus === 'verified' ? 'View / replace'
        : undefined,
    },
    {
      id: 'bank',
      title: 'Bank account',
      description: 'Where we deposit your earnings. Domestic bank or international wire.',
      detail: hasBank ? `${c?.payout?.method ?? 'Bank'} · ${c?.payout?.account}` : '',
      status: bankStatus,
      cta: bankStatus === 'verified' ? 'Update' : 'Add bank account',
    },
    {
      id: 'agreement',
      title: 'Creator agreement',
      description: 'Standard payment + content-rights agreement. One-time signature.',
      detail: agreementStatus === 'verified' ? 'Signed via first accepted offer' : '',
      status: agreementStatus,
      cta: agreementStatus === 'locked' ? 'Locked until bank verified'
        : agreementStatus === 'verified' ? undefined
        : 'Review agreement',
    },
  ];
}

export function KycTax({ onRoute, initialAction }: Props) {
  const me = useV2CurrentCreator();
  const db = useStore((s) => s.db);
  const [showBankModal, setShowBankModal] = useState(false);
  const [showTaxModal, setShowTaxModal] = useState(false);

  // Real creator state — used to compute step status + filter tax docs.
  const rawCreator = me ? db.creators.find((c) => c.id === me.id) : null;
  // "Has at least one paid collab" — used to mark Creator Agreement verified.
  const hasPaidCollab = rawCreator
    ? db.transactions.some(
        (t) => t.kind === 'payout' && t.status === 'cleared' && t.userId === rawCreator.userId,
      )
    : false;

  const STEPS = useMemo(
    () => buildSteps(rawCreator, hasPaidCollab),
    [rawCreator, hasPaidCollab],
  );
  const completed = STEPS.filter((s) => s.status === 'verified').length;
  const pct = Math.round((completed / STEPS.length) * 100);
  const nextActionStep = STEPS.find((s) => s.status === 'action');

  // Quarterly tax docs derived from the creator's payout transactions —
  // groups by year+quarter, sums declared amount per bucket.
  const taxDocs = useMemo(() => {
    if (!rawCreator) return [] as { id: string; name: string; date: string; amount: number; period: string }[];
    type Bucket = { year: number; q: number; sum: number; periodStart: Date };
    const buckets = new Map<string, Bucket>();
    for (const t of db.transactions) {
      if (t.userId !== rawCreator.userId) continue;
      if (t.kind !== 'payout' || t.status !== 'cleared') continue;
      const at = new Date(t.at);
      const q = Math.floor(at.getMonth() / 3) + 1;
      const year = at.getFullYear();
      const key = `${year}-Q${q}`;
      const existing = buckets.get(key);
      if (existing) existing.sum += Math.abs(t.amount);
      else buckets.set(key, { year, q, sum: Math.abs(t.amount), periodStart: new Date(year, (q - 1) * 3, 1) });
    }
    return Array.from(buckets.values())
      .sort((a, b) => (b.year - a.year) || (b.q - a.q))
      .map((b) => ({
        id: `tax-${b.year}-q${b.q}`,
        name: `${b.year} Q${b.q} earnings statement`,
        date: b.periodStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        amount: Math.round(b.sum),
        period: `${b.year}-Q${b.q}`,
      }));
  }, [db.transactions, rawCreator]);

  // CTA handlers — wire each step's button to a real flow instead of toasts.
  function handleStepCta(step: Step) {
    if (step.status === 'locked') return;
    switch (step.id) {
      case 'identity':
      case 'address': {
        // Mark creator verified — in production this'd be a Persona /
        // Onfido handoff. Demo path mocks the doc upload via toast +
        // ISO timestamp so the scheduler's 365-day kyc-expired
        // reminder fires correctly. Pre-fix `verified` flipped to true
        // without `kycVerifiedAt`, so the reminder logic at
        // v2ApproveContent:1058 never enqueued.
        if (!rawCreator) return;
        const nowIso = new Date().toISOString();
        tx((d) => {
          const idx = d.creators.findIndex((c) => c.id === rawCreator.id);
          if (idx !== -1) {
            d.creators[idx] = {
              ...d.creators[idx],
              verified: true,
              kycVerifiedAt: nowIso,
            };
          }
        });
        pushToast(step.id === 'identity'
          ? 'Identity verified — re-verification reminder in 365 days'
          : 'Address verified — re-verification reminder in 365 days');
        break;
      }
      case 'tax-form':
        setShowTaxModal(true);
        break;
      case 'bank':
        setShowBankModal(true);
        break;
      case 'agreement':
        // Mark creator's first collab as agreement-signed by toasting.
        pushToast('Creator agreement reviewed — sign on your first offer acceptance');
        break;
    }
  }

  // §needs-you-direct-jump — when CreatorHome's "Complete KYC" tile
  // deep-links here with `?action=next-step`, scroll to the first
  // incomplete step and add a temporary highlight ring. Without this
  // the deep-link is no different from clicking KYC & Tax in the
  // sidebar.
  useEffect(() => {
    if (initialAction !== 'next-step' || !nextActionStep) return;
    // Wait one tick so the article element is mounted, then scroll +
    // pulse-highlight via a CSS class we add and remove after 2s.
    const id = window.setTimeout(() => {
      const el = document.getElementById(`kyc-step-${nextActionStep.id}`);
      if (!el) return;
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('kyc-step-highlight');
      window.setTimeout(() => el.classList.remove('kyc-step-highlight'), 2200);
    }, 100);
    return () => window.clearTimeout(id);
  }, [initialAction, nextActionStep]);

  return (
    <>
      <Topbar
        title="KYC & Tax"
        crumb={`${completed} of ${STEPS.length} steps complete · ${pct}% verified`}
        actions={
          <button className="v2-btn v2-btn-outline" type="button" onClick={() => onRoute('creator-wallet')}>
            {Icon.wallet}<span>Back to wallet</span>
          </button>
        }
      />
      <div className="v2-content" style={{ maxWidth: 880 }}>
        {/* Progress card */}
        <div
          className="v2-card v2-card-pad"
          style={{
            marginBottom: 24,
            background: 'linear-gradient(135deg, var(--v2-accent-soft), var(--v2-paper))',
            borderColor: 'var(--v2-accent-soft)',
          }}
        >
          <div className="v2-row" style={{ justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 12, flexWrap: 'wrap', gap: 12 }}>
            <div>
              <div className="v2-eyebrow" style={{ marginBottom: 6 }}>Verification progress</div>
              <h2 style={{
                fontFamily: 'var(--v2-font-display)',
                fontSize: 28,
                fontWeight: 500,
                letterSpacing: '-0.025em',
                margin: 0,
                color: 'var(--v2-ink)',
              }}>
                {completed} of {STEPS.length} steps verified
              </h2>
              <p className="v2-muted" style={{ margin: '6px 0 0', fontSize: 13.5, maxWidth: 540 }}>
                Finish KYC to unlock instant withdrawals, international wire transfers, and brand payouts above $1,000.
              </p>
            </div>
            <div className="v2-tabular" style={{
              fontFamily: 'var(--v2-font-display)',
              fontSize: 36,
              fontWeight: 500,
              color: 'var(--v2-accent)',
              letterSpacing: '-0.025em',
            }}>
              {pct}%
            </div>
          </div>
          <div className="v2-progress">
            <div className="v2-progress-fill" style={{ width: `${pct}%` }} />
          </div>
        </div>

        {/* Steps */}
        <div className="v2-eyebrow" style={{ marginBottom: 12 }}>Steps</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 32 }}>
          {STEPS.map((step, i) => (
            <StepRow key={step.id} step={step} index={i + 1} onCta={handleStepCta} />
          ))}
        </div>

        {showBankModal && rawCreator && (
          <BankAccountModal
            onClose={() => setShowBankModal(false)}
            initial={rawCreator.payout}
            onSave={(payout) => {
              tx((d) => {
                const idx = d.creators.findIndex((c) => c.id === rawCreator.id);
                if (idx === -1) return;
                d.creators[idx] = { ...d.creators[idx], payout };
              });
              pushToast('Bank account saved');
              setShowBankModal(false);
            }}
          />
        )}

        {showTaxModal && (
          <TaxFormModal
            initial={rawCreator?.taxForm}
            onClose={() => setShowTaxModal(false)}
          />
        )}

        {/* Tax certificates */}
        <section className="v2-card v2-card-pad">
          <div className="v2-row" style={{ justifyContent: 'space-between', marginBottom: 14, alignItems: 'flex-end' }}>
            <div>
              <div className="v2-eyebrow">Auto-generated tax documents</div>
              <p className="v2-muted" style={{ margin: '4px 0 0', fontSize: 12.5 }}>
                We file these automatically every quarter. Download for your records or to submit to your accountant.
              </p>
            </div>
            <button
              className="v2-btn v2-btn-sm v2-btn-outline"
              type="button"
              onClick={() => {
                if (taxDocs.length === 0) {
                  pushToast('No quarterly statements yet — your first payout will generate one');
                  return;
                }
                downloadCSV(
                  `alamut-tax-archive-${new Date().getFullYear()}`,
                  taxDocs.map((d) => ({
                    period: d.period,
                    name: d.name,
                    date: d.date,
                    amount_usd: d.amount,
                  })),
                );
                pushToast(`Full archive exported · ${taxDocs.length} statements`);
              }}
            >
              {Icon.external} View all
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {taxDocs.length === 0 && (
              <p className="v2-muted" style={{ fontSize: 13, margin: 0 }}>
                No quarterly statements yet. Your first cleared payout will generate one.
              </p>
            )}
            {taxDocs.map((doc) => (
              <div key={doc.id} className="v2-row" style={{
                justifyContent: 'space-between',
                padding: '12px 14px',
                background: 'var(--v2-bg-1)',
                borderRadius: 10,
                gap: 12,
              }}>
                <div className="v2-row" style={{ gap: 12, alignItems: 'center', minWidth: 0 }}>
                  <div
                    className="v2-channel-icon"
                    aria-hidden="true"
                    style={{
                      background: 'var(--v2-moss)',
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      flexShrink: 0,
                    }}
                  >
                    {Icon.shield}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {doc.name}
                    </div>
                    <div className="v2-muted" style={{ fontSize: 11.5 }}>
                      {doc.date} · ${doc.amount.toLocaleString()} declared
                    </div>
                  </div>
                </div>
                <button
                  className="v2-btn v2-btn-sm v2-btn-outline"
                  type="button"
                  onClick={() => {
                    if (!rawCreator) return;
                    // Quarter-scoped payout rows.
                    const [yearStr, qStr] = doc.period.split('-Q');
                    const year = parseInt(yearStr, 10);
                    const q = parseInt(qStr, 10);
                    const quarterStart = +new Date(year, (q - 1) * 3, 1);
                    const quarterEnd = +new Date(year, q * 3, 1);
                    const rows = db.transactions
                      .filter((t) =>
                        t.userId === rawCreator.userId &&
                        t.kind === 'payout' &&
                        t.status === 'cleared' &&
                        +new Date(t.at) >= quarterStart &&
                        +new Date(t.at) < quarterEnd,
                      )
                      .map((t) => ({
                        date: new Date(t.at).toISOString().slice(0, 10),
                        description: t.note,
                        campaign_id: t.campaignId ?? '',
                        amount_usd: Math.abs(t.amount),
                      }));
                    downloadCSV(`alamut-${doc.period}-statement`, rows);
                    pushToast(`${doc.name} exported · ${rows.length} payouts`);
                  }}
                >
                  Download
                </button>
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}

function BankAccountModal({ onClose, initial, onSave }: {
  onClose: () => void;
  initial: { account?: string; method?: string; currency?: string };
  onSave: (p: { account: string; method: string; currency: string }) => void;
}) {
  const [account, setAccount] = useState(initial.account ?? '');
  const [method, setMethod] = useState(initial.method ?? 'ACH');
  const [currency, setCurrency] = useState(initial.currency ?? 'USD');
  const valid = account.trim().length >= 4;
  return (
    <div className="v2-modal-overlay" onClick={onClose}>
      <div className="v2-card v2-card-pad-lg v2-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 460 }}>
        <h2 style={{
          fontFamily: 'var(--v2-font-display)', fontSize: 22, fontWeight: 500,
          margin: '0 0 6px', letterSpacing: '-0.02em',
        }}>Add bank account</h2>
        <p className="v2-muted" style={{ margin: '0 0 16px', fontSize: 13 }}>
          Account details are encrypted at rest. We never share them with brands.
        </p>
        <label className="v2-eyebrow" style={{ display: 'block', marginBottom: 6 }}>Account number / IBAN</label>
        <input
          className="v2-input"
          value={account}
          onChange={(e) => setAccount(e.target.value)}
          placeholder="e.g. PK24SCBL1234567890123456"
          style={{ marginBottom: 12, fontFamily: 'inherit', width: '100%' }}
        />
        <div className="v2-row" style={{ gap: 8, marginBottom: 16 }}>
          <div style={{ flex: 1 }}>
            <label className="v2-eyebrow" style={{ display: 'block', marginBottom: 6 }}>Method</label>
            <select className="v2-input" value={method} onChange={(e) => setMethod(e.target.value)} style={{ width: '100%', fontFamily: 'inherit' }}>
              <option value="ACH">ACH</option>
              <option value="Wire">Wire</option>
              <option value="SEPA">SEPA</option>
              <option value="Local bank">Local bank</option>
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label className="v2-eyebrow" style={{ display: 'block', marginBottom: 6 }}>Currency</label>
            <select className="v2-input" value={currency} onChange={(e) => setCurrency(e.target.value)} style={{ width: '100%', fontFamily: 'inherit' }}>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="GBP">GBP</option>
              <option value="PKR">PKR</option>
            </select>
          </div>
        </div>
        <div className="v2-row" style={{ justifyContent: 'flex-end', gap: 8 }}>
          <button className="v2-btn v2-btn-ghost" type="button" onClick={onClose}>Cancel</button>
          <button
            className="v2-btn v2-btn-primary"
            type="button"
            disabled={!valid}
            onClick={() => onSave({ account: account.trim(), method, currency })}
          >
            Save bank
          </button>
        </div>
      </div>
    </div>
  );
}

function StepRow({ step, index, onCta }: { step: Step; index: number; onCta: (s: Step) => void }) {
  const statusMeta: Record<StepStatus, { pill: string; label: string }> = {
    verified: { pill: 'v2-pill-moss', label: 'Verified' },
    pending: { pill: 'v2-pill-draft', label: 'Pending' },
    action: { pill: 'v2-pill-live', label: 'Action needed' },
    locked: { pill: '', label: 'Locked' },
  };
  const meta = statusMeta[step.status];

  return (
    <article
      id={`kyc-step-${step.id}`}
      className="v2-card v2-card-pad"
      style={{
        opacity: step.status === 'locked' ? 0.55 : 1,
        borderColor: step.status === 'action' ? 'var(--v2-accent)' : undefined,
        transition: 'box-shadow 200ms ease, transform 200ms ease',
      }}
    >
      <div className="v2-row" style={{ gap: 16, alignItems: 'flex-start' }}>
        <div
          className="v2-tabular"
          style={{
            width: 36,
            height: 36,
            borderRadius: 999,
            background: step.status === 'verified' ? 'var(--v2-moss)' : 'var(--v2-bg-2)',
            color: step.status === 'verified' ? 'var(--v2-paper)' : 'var(--v2-ink-2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 600,
            fontSize: 14,
            flexShrink: 0,
          }}
        >
          {step.status === 'verified' ? Icon.check : index}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="v2-row" style={{ gap: 8, alignItems: 'center', marginBottom: 4, flexWrap: 'wrap' }}>
            <h3 style={{
              fontFamily: 'var(--v2-font-display)',
              fontSize: 18,
              fontWeight: 500,
              letterSpacing: '-0.014em',
              margin: 0,
              color: 'var(--v2-ink)',
            }}>{step.title}</h3>
            <span className={`v2-pill ${meta.pill}`} style={{ fontSize: 11 }}>
              {meta.label}
            </span>
          </div>
          <p className="v2-muted" style={{ margin: 0, fontSize: 13, lineHeight: 1.55, maxWidth: 560 }}>
            {step.description}
          </p>
          {step.detail && (
            <div style={{ marginTop: 8, fontSize: 12.5, color: 'var(--v2-ink-2)' }}>
              {step.detail}
            </div>
          )}
          {step.completedAt && (
            <div className="v2-muted" style={{ marginTop: 6, fontSize: 11.5 }}>
              {step.completedAt}
            </div>
          )}
        </div>

        {step.cta && (
          <button
            className={`v2-btn ${step.status === 'action' ? 'v2-btn-primary' : 'v2-btn-outline'} v2-btn-sm`}
            type="button"
            disabled={step.status === 'locked'}
            style={step.status === 'locked' ? { cursor: 'not-allowed' } : undefined}
            onClick={() => onCta(step)}
          >
            {step.cta}
          </button>
        )}
      </div>
    </article>
  );
}
