// BrandOnboardingV2.tsx — v2 brand-side onboarding wizard
//
// Phase A.14 of the migration. Replaces the airy-surface
// BrandOnboarding.tsx with a v2 reskin. Three steps:
//   1. Company     — name, industry, HQ, website, about
//   2. Preferences — categories of interest, regions, creator tier
//   3. Launch      — post first brief or skip into Spark
//
// Shares wizard chrome (header / step indicator / footer) with
// CreatorOnboardingV2 via shared CSS classes. The form fields are
// brand-specific.

import { useState } from 'react';
import { Icon } from '../lib';
import { listAnd } from '@/lib/utils/format';
import { useV2CurrentBrand } from '../v2Hooks';
import { v2UpdateBrand } from '../v2CampaignActions';
import { pushToast } from '@/lib/utils/toast';

interface Props {
  onRoute: (r: string) => void;
}

interface State {
  companyName: string;
  industry: string;
  hq: string;
  website: string;
  about: string;
  categories: string[];
  regions: string[];
  creatorTier: '$' | '$$' | '$$$' | '$$$$' | null;
  monthlyBudget: string;
  firstBriefMode: 'brief' | 'spark' | 'later' | null;
}

const STEPS = [
  { id: 'company', label: 'Company' },
  { id: 'preferences', label: 'Preferences' },
  { id: 'launch', label: 'Launch' },
] as const;

type StepId = typeof STEPS[number]['id'];

const INDUSTRIES = ['Fashion / Apparel', 'Beauty / Skincare', 'Food / Beverage', 'Tech / SaaS', 'Fintech / Banking', 'Healthcare', 'Retail / E-commerce', 'B2B services', 'Media / Entertainment', 'Other'];

const CATEGORIES = ['Fashion', 'Beauty', 'Food', 'Tech', 'Travel', 'Fitness', 'Parenting', 'Finance', 'B2B', 'Lifestyle'];

const REGIONS = ['Lahore', 'Karachi', 'Islamabad', 'Pakistan-wide', 'GCC region', 'International English'];

const TIERS: { id: NonNullable<State['creatorTier']>; label: string; range: string; sub: string }[] = [
  { id: '$',    label: 'Nano',  range: '$80–$300',     sub: 'Best engagement, niche audiences. Multi-creator burst plays.' },
  { id: '$$',   label: 'Micro', range: '$200–$800',    sub: 'Sweet spot for most fashion + lifestyle campaigns.' },
  { id: '$$$',  label: 'Mid',   range: '$800–$2,500',  sub: 'Established voices · LinkedIn / longer YouTube pieces.' },
  { id: '$$$$', label: 'Macro', range: '$2,500+',      sub: 'Reach plays · large-budget hero campaigns.' },
];

export function BrandOnboardingV2({ onRoute }: Props) {
  const currentBrand = useV2CurrentBrand();
  const [step, setStep] = useState<StepId>('company');
  const [submitting, setSubmitting] = useState(false);
  const [s, setS] = useState<State>({
    // Pre-fill from any existing brand record (re-entering the wizard
    // after a partial fill should not blank everything out).
    companyName: currentBrand?.name ?? '',
    industry: currentBrand?.industry ?? '',
    hq: currentBrand?.hq || 'Lahore',
    website: currentBrand?.website ?? '',
    about: currentBrand?.about ?? '',
    categories: currentBrand?.preferredCategories ?? [],
    regions: currentBrand?.preferredRegions ?? [],
    creatorTier: null,
    monthlyBudget: '5000',
    firstBriefMode: null,
  });

  const idx = STEPS.findIndex((x) => x.id === step);
  const next = () => idx < STEPS.length - 1 && setStep(STEPS[idx + 1].id);
  const back = () => idx > 0 && setStep(STEPS[idx - 1].id);
  const update = (patch: Partial<State>) => setS((prev) => ({ ...prev, ...patch }));

  // Persist the wizard's mappable fields onto the current brand
  // record before routing into the workspace. Pre-fix the wizard
  // discarded everything — fresh signups landed in /v2 with empty
  // brand rows and had to re-enter every field via Brand Profile.
  // Phase 58 added `preferredCreatorTier` + `monthlyBudgetBand` to
  // the Brand schema so the wizard no longer drops them on submit;
  // Discover + Spark consume them as matching hints when ranking.
  async function persistAndRoute() {
    if (!currentBrand?.id) {
      // No brand on this session — nothing to persist against.
      // Skip the write and route as before so the wizard isn't a dead
      // end during local-only / unauth preview.
      routeAfterFinish();
      return;
    }
    setSubmitting(true);
    try {
      await v2UpdateBrand(currentBrand.id, {
        name: s.companyName.trim(),
        industry: s.industry,
        hq: s.hq,
        website: s.website.trim(),
        about: s.about.trim(),
        preferredCategories: s.categories,
        preferredRegions: s.regions,
        // Matching hints — captured in earlier steps, persisted now so
        // Discover/Spark can rank by them. `any` is a valid tier value
        // when the brand explicitly opts not to constrain.
        ...(s.creatorTier ? { preferredCreatorTier: s.creatorTier } : {}),
        ...(s.monthlyBudget ? { monthlyBudgetBand: s.monthlyBudget } : {}),
      });
    } catch (err) {
      // F24 — never trap the user on the last wizard step. Pre-fix a
      // failed save (e.g. the brand row not yet in Postgres, so the
      // `.single()` read 406'd) returned early and left "Get started"
      // doing nothing at all, with no way forward but "Skip for now".
      // The wizard's answers are already in local state, so warn and
      // continue into the workspace — the profile can be completed
      // from Brand profile.
      pushToast(
        err instanceof Error
          ? `Saved locally — couldn't sync your brand profile: ${err.message}`
          : 'Saved locally — couldn\'t sync your brand profile',
        'bad',
      );
    }
    setSubmitting(false);
    routeAfterFinish();
  }

  function routeAfterFinish() {
    if (s.firstBriefMode === 'spark') onRoute('spark');
    else if (s.firstBriefMode === 'brief') onRoute('campaigns');
    else onRoute('discover');
  }

  const toggleArr = <T extends string>(arr: T[], v: T): T[] =>
    arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];

  // F13 — see CreatorOnboardingV2: report what's missing rather than just
  // disabling Continue. The brand "About" field is the usual casualty.
  const blockedReason: string | null = (() => {
    if (step === 'company') {
      const missing: string[] = [];
      if (!s.companyName.trim()) missing.push('your company name');
      if (!s.industry)           missing.push('an industry');
      if (!s.about.trim())       missing.push('a short description');
      return missing.length ? `Add ${listAnd(missing)} to continue.` : null;
    }
    if (step === 'preferences') {
      const missing: string[] = [];
      if (s.categories.length === 0) missing.push('at least one category');
      if (s.regions.length === 0)    missing.push('a region');
      if (!s.creatorTier)            missing.push('a creator tier');
      return missing.length ? `Pick ${listAnd(missing)} to continue.` : null;
    }
    if (step === 'launch') {
      return s.firstBriefMode ? null : 'Choose how you want to start.';
    }
    return 'Finish this step to continue.';
  })();

  const canProceed = (() => {
    if (step === 'company')     return s.companyName.trim() && s.industry && s.about.trim();
    if (step === 'preferences') return s.categories.length > 0 && s.regions.length > 0 && !!s.creatorTier;
    if (step === 'launch')      return !!s.firstBriefMode;
    return false;
  })();

  return (
    <div data-surface="v2" className="v2-onboarding">
      <div className="v2-onboarding-shell">
        {/* Header */}
        <header className="v2-onboarding-header">
          <button className="v2-brand" type="button" aria-label="Alamut — go to your workspace" onClick={() => onRoute('home')}>
            <div className="v2-brand-mark" aria-hidden="true">
              <svg viewBox="0 0 32 32" width="20" height="20">
                <path d="M16 4 L28 26 L22 26 L16 14 L10 26 L4 26 Z" fill="var(--v2-paper)" />
                <circle cx="16" cy="22" r="2" fill="var(--v2-accent)" />
              </svg>
            </div>
            <div className="v2-brand-name">Alamut</div>
          </button>
          <button className="v2-btn v2-btn-ghost v2-btn-sm" type="button" onClick={() => onRoute('home')}>
            Skip for now
          </button>
        </header>

        {/* Step indicator */}
        <div className="v2-onboarding-steps" role="progressbar" aria-valuemin={1} aria-valuemax={STEPS.length} aria-valuenow={idx + 1}>
          {STEPS.map((stp, i) => {
            const state = i < idx ? 'done' : i === idx ? 'active' : 'pending';
            return (
              <div key={stp.id} className={`v2-onboarding-step is-${state}`}>
                <div className="v2-onboarding-step-num">{i < idx ? Icon.check : i + 1}</div>
                <div className="v2-onboarding-step-label">{stp.label}</div>
              </div>
            );
          })}
        </div>

        {/* Content */}
        <div className="v2-onboarding-body">
          <main className="v2-onboarding-main">
            {step === 'company' && (
              <section className="v2-card v2-card-pad v2-onboarding-card">
                <h2 className="v2-onboarding-h2">Tell us about your company</h2>
                <p className="v2-onboarding-sub">
                  Creators see this on every brief you send out. Keep it short — what you sell, who you sell to.
                </p>

                <div className="v2-onboarding-field">
                  <label className="v2-onboarding-field-label">Company name</label>
                  <input
                    type="text"
                    placeholder="Sapphire Fashion"
                    value={s.companyName}
                    onChange={(e) => update({ companyName: e.target.value })}
                  />
                </div>

                <div className="v2-onboarding-row-2">
                  <div className="v2-onboarding-field">
                    <label className="v2-onboarding-field-label">Industry</label>
                    <select value={s.industry} onChange={(e) => update({ industry: e.target.value })}>
                      <option value="">Select industry...</option>
                      {INDUSTRIES.map((i) => <option key={i} value={i}>{i}</option>)}
                    </select>
                  </div>
                  <div className="v2-onboarding-field">
                    <label className="v2-onboarding-field-label">HQ city</label>
                    <select value={s.hq} onChange={(e) => update({ hq: e.target.value })}>
                      {['Lahore', 'Karachi', 'Islamabad', 'Dubai', 'London', 'New York', 'Other'].map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="v2-onboarding-field">
                  <label className="v2-onboarding-field-label">Website</label>
                  <input
                    type="url"
                    placeholder="https://sapphireshop.com"
                    value={s.website}
                    onChange={(e) => update({ website: e.target.value })}
                  />
                </div>

                <div className="v2-onboarding-field">
                  <label className="v2-onboarding-field-label">About your brand</label>
                  <div className="v2-muted v2-onboarding-field-sub">
                    1–2 sentences. Plain English, no marketing copy.
                  </div>
                  <textarea
                    rows={4}
                    placeholder="Pakistani luxury lawn for everyday wear. Modern silhouettes, hand-block prints, fair pricing for women 25–40."
                    value={s.about}
                    onChange={(e) => update({ about: e.target.value })}
                  />
                </div>
              </section>
            )}

            {step === 'preferences' && (
              <section className="v2-card v2-card-pad v2-onboarding-card">
                <h2 className="v2-onboarding-h2">What kind of creators are you looking for?</h2>
                <p className="v2-onboarding-sub">
                  Spark uses these to draft creator shortlists. You can tweak any time — these are starting defaults.
                </p>

                <div className="v2-onboarding-field">
                  <label className="v2-onboarding-field-label">Categories of interest</label>
                  <div className="v2-muted v2-onboarding-field-sub">Pick all that fit. Most brands pick 2–4.</div>
                  <div className="v2-onboarding-cats">
                    {CATEGORIES.map((c) => {
                      const on = s.categories.includes(c);
                      return (
                        <button
                          key={c}
                          type="button"
                          className={`v2-pill ${on ? 'v2-pill-accent' : ''}`}
                          style={{
                            cursor: 'pointer',
                            border: '1px solid var(--v2-line)',
                            background: on ? undefined : 'var(--v2-paper)',
                          }}
                          onClick={() => update({ categories: toggleArr(s.categories, c) })}
                        >{c}</button>
                      );
                    })}
                  </div>
                </div>

                <div className="v2-onboarding-field">
                  <label className="v2-onboarding-field-label">Regions you target</label>
                  <div className="v2-onboarding-cats">
                    {REGIONS.map((r) => {
                      const on = s.regions.includes(r);
                      return (
                        <button
                          key={r}
                          type="button"
                          className={`v2-pill ${on ? 'v2-pill-accent' : ''}`}
                          style={{
                            cursor: 'pointer',
                            border: '1px solid var(--v2-line)',
                            background: on ? undefined : 'var(--v2-paper)',
                          }}
                          onClick={() => update({ regions: toggleArr(s.regions, r) })}
                        >{r}</button>
                      );
                    })}
                  </div>
                </div>

                <div className="v2-onboarding-field">
                  <label className="v2-onboarding-field-label">Creator tier</label>
                  <div className="v2-muted v2-onboarding-field-sub">
                    Pick the budget tier that matches the campaigns you'll typically run.
                  </div>
                  <div className="v2-onboarding-tier-grid">
                    {TIERS.map((t) => {
                      const on = s.creatorTier === t.id;
                      return (
                        <button
                          key={t.id}
                          type="button"
                          className={`v2-onboarding-tier ${on ? 'is-selected' : ''}`}
                          onClick={() => update({ creatorTier: t.id })}
                        >
                          <div className="v2-row" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
                            <span style={{ fontWeight: 600, fontSize: 14 }}>{t.label}</span>
                            <span className="v2-muted v2-tabular" style={{ fontSize: 12 }}>{t.range}</span>
                          </div>
                          <div className="v2-muted" style={{ fontSize: 12, lineHeight: 1.45 }}>{t.sub}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="v2-onboarding-field">
                  <label className="v2-onboarding-field-label">Typical monthly budget</label>
                  <div className="v2-onboarding-rate">
                    <span className="v2-onboarding-rate-prefix">$</span>
                    <input
                      type="number"
                      value={s.monthlyBudget}
                      onChange={(e) => update({ monthlyBudget: e.target.value })}
                      placeholder="5000"
                    />
                    <span className="v2-onboarding-rate-sub">USD / month</span>
                  </div>
                </div>
              </section>
            )}

            {step === 'launch' && (
              <section className="v2-card v2-card-pad v2-onboarding-card">
                <h2 className="v2-onboarding-h2">How do you want to start?</h2>
                <p className="v2-onboarding-sub">
                  Most brands run their first campaign in week one. You can pick the path that fits your team's pace.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <LaunchOption
                    icon={Icon.spark}
                    accent
                    title="Plan a campaign with Spark"
                    detail="Tell Spark what you need in plain English; it drafts a shortlist of 5–10 creators with projected reach + budget."
                    selected={s.firstBriefMode === 'spark'}
                    onSelect={() => update({ firstBriefMode: 'spark' })}
                  />
                  <LaunchOption
                    icon={Icon.campaign}
                    title="Post a brief manually"
                    detail="Write a brief yourself; creators apply. Best when you already know who you want."
                    selected={s.firstBriefMode === 'brief'}
                    onSelect={() => update({ firstBriefMode: 'brief' })}
                  />
                  <LaunchOption
                    icon={Icon.compass}
                    title="Just look around first"
                    detail="Drop me into Discover so I can browse the creator network. I'll launch when I'm ready."
                    selected={s.firstBriefMode === 'later'}
                    onSelect={() => update({ firstBriefMode: 'later' })}
                  />
                </div>

                <div style={{
                  marginTop: 18,
                  padding: 14,
                  background: 'var(--v2-bg-1)',
                  borderRadius: 10,
                  fontSize: 12.5,
                  color: 'var(--v2-ink-2)',
                }}>
                  <strong>Heads up:</strong> Payments are simulated during the
                  beta — no card, no real funding required. Your wallet and
                  escrow balances are play money so you can run a campaign
                  end to end and see exactly how the money would move.
                </div>
              </section>
            )}
          </main>

          {/* Side: company preview */}
          <aside className="v2-onboarding-preview">
            <div className="v2-eyebrow" style={{ marginBottom: 10 }}>Brand profile preview</div>
            <div className="v2-card v2-card-pad">
              <div className="v2-row" style={{ gap: 12, alignItems: 'center', marginBottom: 12 }}>
                <div
                  aria-hidden="true"
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 10,
                    background: 'var(--v2-accent-soft)',
                    color: 'var(--v2-accent)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: 'var(--v2-font-display)',
                    fontWeight: 600,
                    fontSize: 18,
                  }}
                >
                  {(s.companyName || 'A')[0].toUpperCase()}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>
                    {s.companyName || 'Your company'}
                  </div>
                  <div className="v2-muted" style={{ fontSize: 11.5 }}>
                    {s.industry || 'Industry'} · {s.hq}
                  </div>
                </div>
              </div>
              <p className="v2-muted" style={{ fontSize: 12.5, margin: 0, lineHeight: 1.5, minHeight: 36 }}>
                {s.about || 'Your brand description will appear here.'}
              </p>
              {s.categories.length > 0 && (
                <div style={{ marginTop: 12, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {s.categories.slice(0, 4).map((c) => (
                    <span key={c} className="v2-pill v2-pill-accent" style={{ fontSize: 10 }}>{c}</span>
                  ))}
                  {s.categories.length > 4 && (
                    <span className="v2-pill" style={{ fontSize: 10, background: 'var(--v2-bg-2)' }}>+{s.categories.length - 4}</span>
                  )}
                </div>
              )}
            </div>
            <p className="v2-muted" style={{ fontSize: 11.5, marginTop: 12, lineHeight: 1.5 }}>
              Creators see this when you reach out. Keep it specific — generic descriptions reduce response rates.
            </p>
          </aside>
        </div>

        {/* Sticky action bar */}
        <footer className="v2-onboarding-foot">
          <button className="v2-btn v2-btn-ghost" type="button" onClick={back} disabled={idx === 0}>
            {Icon.arrow}<span style={{ marginLeft: 6 }}>Back</span>
          </button>
          <span className="v2-muted" style={{ fontSize: 12, textAlign: 'center' }}>
            {blockedReason ? (
              <span style={{ color: 'var(--v2-accent)' }} role="status">{blockedReason}</span>
            ) : (
              <>Step {idx + 1} of {STEPS.length} · {STEPS[idx].label}</>
            )}
          </span>
          {step === 'launch' ? (
            <button
              className="v2-btn v2-btn-primary"
              type="button"
              disabled={!canProceed || submitting}
              onClick={persistAndRoute}
            >
              {Icon.check} {submitting ? 'Saving…' : 'Get started'}
            </button>
          ) : (
            <button className="v2-btn v2-btn-primary" type="button" disabled={!canProceed} onClick={next}>
              <span>Continue</span> {Icon.arrow}
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}

function LaunchOption({ icon, title, detail, selected, accent, onSelect }: {
  icon: React.ReactNode;
  title: string;
  detail: string;
  selected: boolean;
  accent?: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`v2-onboarding-payout ${selected ? 'is-selected' : ''}`}
      style={accent && !selected ? { borderColor: 'var(--v2-accent-soft)' } : undefined}
    >
      <div
        className="v2-channel-icon"
        style={{
          background: accent ? 'var(--v2-accent)' : 'var(--v2-moss)',
          width: 36,
          height: 36,
          borderRadius: 10,
        }}
      >
        {icon}
      </div>
      <div style={{ flex: 1, textAlign: 'left', minWidth: 0 }}>
        <div className="v2-row" style={{ gap: 8, alignItems: 'center', marginBottom: 2 }}>
          <span style={{ fontWeight: 600, fontSize: 14 }}>{title}</span>
          {accent && <span className="v2-pill v2-pill-accent" style={{ fontSize: 10 }}>Recommended</span>}
        </div>
        <div className="v2-muted" style={{ fontSize: 12, lineHeight: 1.45 }}>{detail}</div>
      </div>
      <div className={`v2-onboarding-radio ${selected ? 'is-on' : ''}`} aria-hidden="true">
        {selected && <span />}
      </div>
    </button>
  );
}
