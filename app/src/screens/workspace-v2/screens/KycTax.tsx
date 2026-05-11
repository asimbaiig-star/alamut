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

import { useEffect } from 'react';
import { Icon, Topbar } from '../lib';
import { pushToast } from '@/lib/utils/toast';

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

const STEPS: Step[] = [
  {
    id: 'identity',
    title: 'Identity verification',
    description: 'Government-issued ID + selfie. Powered by Persona — typically clears in under 5 minutes.',
    detail: 'CNIC · Pakistani national ID',
    status: 'verified',
    completedAt: 'Verified Apr 12, 2026',
  },
  {
    id: 'address',
    title: 'Address verification',
    description: 'Utility bill or bank statement showing your name and current address.',
    detail: 'Lahore, Punjab',
    status: 'verified',
    completedAt: 'Verified Apr 12, 2026',
  },
  {
    id: 'tax-form',
    title: 'Tax form (W-equivalent)',
    description: 'Pakistan FBR registration. We auto-generate filing receipts for every brand payment.',
    detail: 'Filer status: pending FBR confirmation',
    status: 'pending',
    cta: 'View status',
  },
  {
    id: 'bank',
    title: 'Bank account',
    description: 'Where we deposit your earnings. Domestic Pakistani bank or international wire.',
    detail: '',
    status: 'action',
    cta: 'Add bank account',
  },
  {
    id: 'agreement',
    title: 'Creator agreement',
    description: 'Standard payment + content-rights agreement. One-time signature.',
    detail: '',
    status: 'locked',
    cta: 'Locked until bank verified',
  },
];

const TAX_DOCS = [
  { id: 'tx1', name: '2026 Q1 earnings statement', date: 'Apr 1, 2026', size: '124 KB', amount: 4200 },
  { id: 'tx2', name: '2025 Annual filing receipt', date: 'Jan 15, 2026', size: '212 KB', amount: 18600 },
  { id: 'tx3', name: '2025 Withholding tax certificate', date: 'Jan 15, 2026', size: '88 KB', amount: 930 },
];

export function KycTax({ onRoute, initialAction }: Props) {
  const completed = STEPS.filter((s) => s.status === 'verified').length;
  const pct = Math.round((completed / STEPS.length) * 100);
  const nextActionStep = STEPS.find((s) => s.status === 'action');

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
            <StepRow key={step.id} step={step} index={i + 1} />
          ))}
        </div>

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
              onClick={() => pushToast('Full archive coming soon — every quarter is listed below for the current year', 'default')}
            >
              {Icon.external} View all
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {TAX_DOCS.map((doc) => (
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
                      {doc.date} · {doc.size} · ${doc.amount.toLocaleString()} declared
                    </div>
                  </div>
                </div>
                <button
                  className="v2-btn v2-btn-sm v2-btn-outline"
                  type="button"
                  onClick={() => pushToast(`${doc.name} — PDF export coming soon`, 'default')}
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

function StepRow({ step, index }: { step: Step; index: number }) {
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
            onClick={() => {
              if (step.status === 'locked') return;
              pushToast(`${step.title} — flow coming soon`, 'default');
            }}
          >
            {step.cta}
          </button>
        )}
      </div>
    </article>
  );
}
