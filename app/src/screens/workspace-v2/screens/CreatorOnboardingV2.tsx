// CreatorOnboardingV2.tsx — v2 creator-side onboarding wizard
//
// Phase A.14 of the migration. Replaces the airy-surface
// CreatorOnboarding.tsx with a v2 reskin. Five steps:
//   1. Platform   — pick primary channel
//   2. Channel    — handle, follower count, engagement
//   3. Rates      — package prices
//   4. Payout     — bank/payment method
//   5. Publish    — set storefront live
//
// Layout: full-screen, no sidebar. Hero card + step indicator at the
// top, form fields below, sticky action bar at the bottom. Live
// preview tile on the right when there's room (≥ 1100px).

import { useMemo, useState } from 'react';
import { Icon, fmtUSD, fmtFollowers, PLATFORM_META } from '../lib';
import { useV2CurrentCreator } from '../v2Hooks';
import { v2UpdateCreatorIdentity, v2AddCreatorChannel } from '../v2CreatorActions';
import { pushToast } from '@/lib/utils/toast';
import { parseNumberInput, listAnd } from '@/lib/utils/format';
import { suggestRateBand } from '@/screens/tools/rateGuidance';

interface Props {
  onRoute: (r: string) => void;
}

type Platform = 'instagram' | 'tiktok' | 'youtube' | 'linkedin' | 'x' | 'newsletter';

interface State {
  platform: Platform | null;
  handle: string;
  followers: string;       // string for input, parse to number
  engagement: string;
  city: string;
  bio: string;
  category: string;
  reelRate: string;
  storyRate: string;
  comboRate: string;
  payoutMethod: 'bank' | 'jazzcash' | 'wire' | null;
  agreedTerms: boolean;
}

const STEPS = [
  { id: 'platform', label: 'Platform' },
  { id: 'channel',  label: 'Channel' },
  { id: 'rates',    label: 'Rates' },
  { id: 'payout',   label: 'Payout' },
  { id: 'publish',  label: 'Publish' },
] as const;

type StepId = typeof STEPS[number]['id'];

const PLATFORMS: { id: Platform; tagline: string }[] = [
  { id: 'instagram', tagline: 'Reels + Stories — the default for fashion + lifestyle.' },
  { id: 'tiktok',    tagline: 'Short-form video — best engagement for under-25s.' },
  { id: 'youtube',   tagline: 'Long-form review + tutorial creators earn most here.' },
  { id: 'linkedin',  tagline: 'B2B thought leadership · best paid niche.' },
  { id: 'x',         tagline: 'Real-time tech + culture conversation.' },
  { id: 'newsletter', tagline: 'Newsletter subscribers convert 4× better than social.' },
];

const CATEGORIES = ['Fashion', 'Beauty', 'Food', 'Tech', 'Travel', 'Fitness', 'Parenting', 'Finance', 'B2B'];

export function CreatorOnboardingV2({ onRoute }: Props) {
  const currentCreator = useV2CurrentCreator();
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState<StepId>('platform');
  const [s, setS] = useState<State>({
    // Pre-fill from any existing creator record so partial returns
    // don't blank everything out.
    platform: null,
    handle: currentCreator?.handle?.replace(/^@/, '') ?? '',
    followers: '',
    engagement: '',
    city: currentCreator?.city || 'Lahore',
    bio: currentCreator?.bio ?? '',
    category: currentCreator?.categories?.[0] ?? '',
    reelRate: currentCreator?.rateCard?.reel ?? '250',
    storyRate: currentCreator?.rateCard?.story ?? '180',
    comboRate: currentCreator?.rateCard?.post ?? '380',
    payoutMethod: null,
    agreedTerms: false,
  });

  // Persist all five steps' inputs onto the creator record before
  // routing into the workspace. Pre-fix the wizard discarded everything;
  // CreatorHome immediately reported ~0% profile completion + a fake
  // storefront preview because nothing landed in the store.
  async function persistAndRoute() {
    if (!currentCreator?.id) {
      onRoute('creator-home');
      return;
    }
    setSubmitting(true);
    try {
      // 1. Identity (handle / city / bio / category / rates / payout method)
      v2UpdateCreatorIdentity(currentCreator.id, {
        handle: s.handle,
        city: s.city,
        bio: s.bio,
        categories: s.category ? [s.category] : currentCreator.categories,
        rateCard: {
          reel: s.reelRate,
          story: s.storyRate,
          post: s.comboRate,
        },
        payout: s.payoutMethod ? { method: s.payoutMethod } : undefined,
      });
      // 2. Primary channel — only add if the creator picked a platform
      //    AND it isn't already configured. v2AddCreatorChannel is
      //    idempotent on (platform, handle) so re-runs won't duplicate.
      if (s.platform && s.handle.trim()) {
        const followersN = parseNumberInput(s.followers, { min: 0 });
        const engagementN = parseNumberInput(s.engagement, { min: 0, integer: false });
        // Map the wizard's lower-case platform key to the canonical
        // capitalized union the Platform type uses.
        const PLATFORM_NAME_MAP = {
          instagram: 'Instagram', tiktok: 'TikTok', youtube: 'YouTube',
          linkedin: 'LinkedIn', x: 'X', newsletter: 'Newsletter',
        } as const;
        v2AddCreatorChannel(currentCreator.id, {
          name: PLATFORM_NAME_MAP[s.platform],
          handle: s.handle.startsWith('@') ? s.handle : `@${s.handle}`,
          followers: followersN,
          engagement: engagementN,
          verified: false,
        });
      }
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Could not save your storefront');
      setSubmitting(false);
      return;
    }
    setSubmitting(false);
    onRoute('creator-home');
  }

  // T3.1 — the band shown on the rates step, derived from the platform,
  // follower count and engagement the creator entered on the previous step.
  // null when we have no benchmark for their platform, or before they've
  // filled in the numbers.
  const rateBand = useMemo(() => {
    if (!s.platform) return null;
    const followers = parseNumberInput(s.followers, { min: 0 });
    const eng = parseNumberInput(s.engagement, { min: 0, integer: false });
    return suggestRateBand(s.platform, followers, eng);
  }, [s.platform, s.followers, s.engagement]);

  const idx = STEPS.findIndex((x) => x.id === step);
  const next = () => idx < STEPS.length - 1 && setStep(STEPS[idx + 1].id);
  const back = () => idx > 0 && setStep(STEPS[idx - 1].id);
  const update = (patch: Partial<State>) => setS((prev) => ({ ...prev, ...patch }));

  // Step-specific validation.
  //
  // F13 — returns WHAT'S MISSING, not just a boolean. The Continue button
  // was disabled with no explanation, so a creator who skipped the bio
  // field (easy: it sits below the fold on the channel step) saw a dead
  // button and no reason why, and had no way to work out what to fix.
  const blockedReason: string | null = (() => {
    if (step === 'platform') {
      return s.platform ? null : 'Pick where you create to continue.';
    }
    if (step === 'channel') {
      const missing: string[] = [];
      if (!s.handle.trim())    missing.push('your handle');
      if (!s.followers.trim()) missing.push('follower count');
      if (!s.category)         missing.push('a category');
      if (!s.bio.trim())       missing.push('a short bio');
      return missing.length ? `Add ${listAnd(missing)} to continue.` : null;
    }
    if (step === 'rates') {
      const missing: string[] = [];
      if (!s.reelRate)  missing.push('Reel');
      if (!s.storyRate) missing.push('Stories');
      if (!s.comboRate) missing.push('the combo');
      return missing.length
        ? `Set a rate for ${listAnd(missing)} — brands use these to send offers.`
        : null;
    }
    if (step === 'payout') {
      return s.payoutMethod ? null : 'Choose how you\'d want to get paid.';
    }
    if (step === 'publish') {
      return s.agreedTerms ? null : 'Agree to the terms to publish your storefront.';
    }
    return 'Finish this step to continue.';
  })();
  const canProceed = blockedReason === null;

  return (
    <div data-surface="v2" className="v2-onboarding">
      <div className="v2-onboarding-shell">
        {/* Header */}
        <header className="v2-onboarding-header">
          <button className="v2-brand" type="button" aria-label="Alamut — go to your workspace" onClick={() => onRoute('creator-home')}>
            <div className="v2-brand-mark" aria-hidden="true">
              <svg viewBox="0 0 32 32" width="20" height="20">
                <path d="M16 4 L28 26 L22 26 L16 14 L10 26 L4 26 Z" fill="var(--v2-paper)" />
                <circle cx="16" cy="22" r="2" fill="var(--v2-accent)" />
              </svg>
            </div>
            <div className="v2-brand-name">Alamut</div>
          </button>
          <button
            className="v2-btn v2-btn-ghost v2-btn-sm"
            type="button"
            onClick={() => onRoute('creator-home')}
          >
            Skip for now
          </button>
        </header>

        {/* Step indicator */}
        <div className="v2-onboarding-steps" role="progressbar" aria-valuemin={1} aria-valuemax={STEPS.length} aria-valuenow={idx + 1}>
          {STEPS.map((stp, i) => {
            const state = i < idx ? 'done' : i === idx ? 'active' : 'pending';
            return (
              <div key={stp.id} className={`v2-onboarding-step is-${state}`}>
                <div className="v2-onboarding-step-num">
                  {i < idx ? Icon.check : i + 1}
                </div>
                <div className="v2-onboarding-step-label">{stp.label}</div>
              </div>
            );
          })}
        </div>

        {/* Content */}
        <div className="v2-onboarding-body">
          <main className="v2-onboarding-main">
            {step === 'platform' && (
              <Card title="Where do you create?" sub="Pick your primary platform. You can add more after onboarding.">
                <div className="v2-onboarding-platform-grid">
                  {PLATFORMS.map((p) => {
                    const meta = PLATFORM_META[p.id];
                    const selected = s.platform === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        className={`v2-onboarding-platform-card ${selected ? 'is-selected' : ''}`}
                        onClick={() => update({ platform: p.id })}
                        // F12 — the selected state was conveyed only by a
                        // CSS class and a check glyph, so assistive tech
                        // couldn't tell which platform was chosen.
                        aria-pressed={selected}
                        aria-label={`${meta.name} — ${p.tagline}`}
                      >
                        <div className="v2-channel-icon" style={{ background: meta.color, width: 36, height: 36, borderRadius: 10 }}>
                          {meta.icon}
                        </div>
                        <div style={{ flex: 1, textAlign: 'left', minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 2 }}>{meta.name}</div>
                          <div className="v2-muted" style={{ fontSize: 12, lineHeight: 1.45 }}>{p.tagline}</div>
                        </div>
                        {selected && <span className="v2-pill v2-pill-accent" style={{ fontSize: 10 }}>{Icon.check}</span>}
                      </button>
                    );
                  })}
                </div>
              </Card>
            )}

            {step === 'channel' && (
              <Card title="Your channel" sub="Tell brands who follows you and where you're based.">
                <Field label="Handle">
                  <div className="v2-onboarding-handle">
                    <span className="v2-onboarding-handle-prefix">@</span>
                    <input
                      type="text"
                      placeholder="hira.styles"
                      value={s.handle}
                      onChange={(e) => update({ handle: e.target.value.replace(/[^a-z0-9._]/gi, '').toLowerCase() })}
                    />
                  </div>
                </Field>
                <div className="v2-onboarding-row-2">
                  <Field label="Followers">
                    <input
                      type="number"
                      placeholder="18400"
                      value={s.followers}
                      onChange={(e) => update({ followers: e.target.value })}
                    />
                  </Field>
                  <Field label="Engagement %">
                    <input
                      type="number"
                      step="0.1"
                      placeholder="4.8"
                      value={s.engagement}
                      onChange={(e) => update({ engagement: e.target.value })}
                    />
                  </Field>
                </div>
                <Field label="City">
                  <select value={s.city} onChange={(e) => update({ city: e.target.value })}>
                    {['Lahore', 'Karachi', 'Islamabad', 'Rawalpindi', 'Faisalabad', 'Other'].map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Primary category">
                  <div className="v2-onboarding-cats">
                    {CATEGORIES.map((c) => (
                      <button
                        key={c}
                        type="button"
                        className={`v2-pill ${s.category === c ? 'v2-pill-accent' : ''}`}
                        style={{ cursor: 'pointer', border: '1px solid var(--v2-line)', background: s.category === c ? undefined : 'var(--v2-paper)' }}
                        onClick={() => update({ category: c })}
                      >{c}</button>
                    ))}
                  </div>
                </Field>
                <Field label="Bio" sub="One sentence brands will read first.">
                  <textarea
                    rows={3}
                    placeholder="Lifestyle & fashion stories from Lahore. Soft-launching small Pakistani brands since 2022."
                    value={s.bio}
                    onChange={(e) => update({ bio: e.target.value })}
                  />
                </Field>
              </Card>
            )}

            {step === 'rates' && (
              <Card title="Set your rates" sub="Brands use this to send offers without negotiating from scratch. You can change anytime.">
                {/* T3.1 — this step used to be three empty boxes with no
                    guidance whatsoever, so a creator with no idea what to
                    charge simply guessed. We already collected platform,
                    followers and engagement on the previous step, which is
                    exactly what the public rate calculator needs — so show
                    the same band here. `suggestRateBand` returns null for
                    platforms we have no benchmark for (LinkedIn / X /
                    Newsletter), in which case nothing is shown rather than
                    a made-up number. */}
                {rateBand && (
                  <div
                    style={{
                      background: 'var(--v2-bg-1)', border: '1px solid var(--v2-line)',
                      borderRadius: 10, padding: 14, marginBottom: 16,
                    }}
                  >
                    <div className="v2-eyebrow" style={{ marginBottom: 6 }}>
                      Typical range for your size on {rateBand.platform}
                    </div>
                    <div className="v2-row" style={{ gap: 10, alignItems: 'baseline', flexWrap: 'wrap' }}>
                      <strong style={{ fontSize: 20, fontFamily: 'var(--v2-font-display)' }}>
                        {fmtUSD(rateBand.low)} – {fmtUSD(rateBand.high)}
                      </strong>
                      <span className="v2-muted" style={{ fontSize: 12 }}>
                        per Reel · midpoint {fmtUSD(rateBand.median)}
                      </span>
                    </div>
                    <p className="v2-muted" style={{ fontSize: 12, lineHeight: 1.45, margin: '8px 0 0' }}>
                      A benchmark from your follower count and engagement — not a quote.
                      Brands negotiate, and your niche and deliverable move the number.
                      Pricing under the band costs you money; well over it costs you replies.
                    </p>
                    <button
                      type="button"
                      className="v2-btn v2-btn-ghost v2-btn-sm"
                      style={{ marginTop: 10 }}
                      onClick={() => update({
                        reelRate: String(rateBand.median),
                        storyRate: String(Math.round(rateBand.median * 0.45)),
                        comboRate: String(Math.round(rateBand.median * 1.5)),
                      })}
                    >
                      Use these as a starting point
                    </button>
                  </div>
                )}
                <Field label="Instagram Reel" sub="60–90s vertical · 1 round of revisions">
                  <RateInput value={s.reelRate} onChange={(v) => update({ reelRate: v })} />
                </Field>
                <Field label="Story bundle (×3)" sub="Most-booked starter package">
                  <RateInput value={s.storyRate} onChange={(v) => update({ storyRate: v })} />
                </Field>
                <Field label="Reel + Stories combo" sub="Premium package · highest LTV">
                  <RateInput value={s.comboRate} onChange={(v) => update({ comboRate: v })} />
                </Field>

                <div style={{
                  marginTop: 16,
                  padding: 14,
                  background: 'var(--v2-bg-1)',
                  borderRadius: 10,
                  fontSize: 12.5,
                  color: 'var(--v2-ink-2)',
                }}>
                  <strong>Heads up:</strong> Alamut takes 10% as platform fee. We auto-deduct 5% withholding tax for FBR. Net to you = rate − 15%.
                </div>
              </Card>
            )}

            {step === 'payout' && (
              <Card title="How would you want to get paid?" sub="Payments are simulated during the beta — this sets your preference for when real payouts launch.">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <PayoutMethod
                    id="bank"
                    name="Pakistani bank account"
                    detail="Domestic bank transfer"
                    icon={Icon.wallet}
                    selected={s.payoutMethod === 'bank'}
                    onSelect={() => update({ payoutMethod: 'bank' })}
                  />
                  <PayoutMethod
                    id="jazzcash"
                    name="JazzCash mobile wallet"
                    detail="Mobile wallet transfer"
                    icon={Icon.send}
                    selected={s.payoutMethod === 'jazzcash'}
                    onSelect={() => update({ payoutMethod: 'jazzcash' })}
                  />
                  <PayoutMethod
                    id="wire"
                    name="International wire"
                    detail="USD, for creators outside Pakistan"
                    icon={Icon.external}
                    selected={s.payoutMethod === 'wire'}
                    onSelect={() => update({ payoutMethod: 'wire' })}
                  />
                </div>

                <div style={{
                  marginTop: 16,
                  padding: 14,
                  background: 'var(--v2-bg-1)',
                  borderRadius: 10,
                  fontSize: 12.5,
                  color: 'var(--v2-ink-2)',
                }}>
                  We don't ask for account numbers during the beta, and no
                  real money moves — wallet balances and escrow are simulated
                  so you can see how the flow works. Settlement times and fees
                  will be confirmed here when real payouts go live.
                </div>
              </Card>
            )}

            {step === 'publish' && (
              <Card
                title="You're ready to go live"
                // F18 — this rendered the literal template text
                // "alamut.co/@{handle}" because the string was never
                // interpolated. Show the creator's real handle.
                sub={`Your storefront will be visible at alamut.co/@${s.handle.trim() || 'yourhandle'} once you publish. Brand teams can find and book you immediately.`}
              >
                <div style={{
                  background: 'linear-gradient(135deg, var(--v2-accent-soft), var(--v2-paper))',
                  borderRadius: 14,
                  padding: 20,
                  marginBottom: 18,
                }}>
                  <div className="v2-eyebrow" style={{ marginBottom: 8 }}>Publishing summary</div>
                  <ul style={{ margin: 0, padding: 0, listStyle: 'none', fontSize: 13, lineHeight: 1.7 }}>
                    <li><strong>@{s.handle || 'your-handle'}</strong> on {s.platform ? PLATFORM_META[s.platform].name : '—'} from {s.city}</li>
                    <li>{s.followers ? fmtFollowers(parseInt(s.followers, 10)) : '—'} followers · {s.engagement || '—'}% engagement</li>
                    <li>{s.category || 'category not set'}</li>
                    <li>Reel {fmtUSD(parseInt(s.reelRate, 10) || 0)} · Stories {fmtUSD(parseInt(s.storyRate, 10) || 0)} · Combo {fmtUSD(parseInt(s.comboRate, 10) || 0)}</li>
                    <li>Payouts via {s.payoutMethod ?? 'not selected'}</li>
                  </ul>
                </div>

                <label className="v2-onboarding-check">
                  <input
                    type="checkbox"
                    checked={s.agreedTerms}
                    onChange={(e) => update({ agreedTerms: e.target.checked })}
                  />
                  <span>
                    I agree to the Alamut <a href="/terms" target="_blank" rel="noreferrer">terms of service</a> and <a href="/privacy" target="_blank" rel="noreferrer">privacy policy</a>. I confirm the information above is accurate.
                  </span>
                </label>
              </Card>
            )}
          </main>

          {/* Live preview side panel */}
          <aside className="v2-onboarding-preview">
            <div className="v2-eyebrow" style={{ marginBottom: 10 }}>Live preview</div>
            <div className="v2-card v2-card-pad">
              <div style={{ marginBottom: 12 }}>
                <div className="v2-row" style={{ gap: 8, alignItems: 'center', marginBottom: 4 }}>
                  <div
                    className="v2-avatar v2-avatar-md"
                    style={{ backgroundImage: `url(https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=200&h=200&fit=crop)` }}
                    aria-hidden="true"
                  />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 13.5 }}>
                      @{s.handle || 'your-handle'}
                    </div>
                    <div className="v2-muted" style={{ fontSize: 11.5 }}>
                      {s.city}{s.platform && ` · ${PLATFORM_META[s.platform].name}`}
                    </div>
                  </div>
                </div>
                <p className="v2-muted" style={{ fontSize: 12.5, margin: 0, lineHeight: 1.5, minHeight: 36 }}>
                  {s.bio || 'Your bio will appear here. One sentence brands will read first.'}
                </p>
              </div>
              <div style={{ paddingTop: 12, borderTop: '1px solid var(--v2-line)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <PreviewRow label="Reel" value={fmtUSD(parseInt(s.reelRate, 10) || 0)} />
                <PreviewRow label="Stories ×3" value={fmtUSD(parseInt(s.storyRate, 10) || 0)} />
                <PreviewRow label="Reel + Stories combo" value={fmtUSD(parseInt(s.comboRate, 10) || 0)} />
              </div>
            </div>
            <p className="v2-muted" style={{ fontSize: 11.5, marginTop: 12, lineHeight: 1.5 }}>
              This is what brands see when they find you on Discover or visit your storefront link.
            </p>
          </aside>
        </div>

        {/* Sticky action bar */}
        <footer className="v2-onboarding-foot">
          <button
            className="v2-btn v2-btn-ghost"
            type="button"
            onClick={back}
            disabled={idx === 0}
          >
            {Icon.arrow} <span style={{ marginLeft: 6 }}>Back</span>
          </button>
          <span className="v2-muted" style={{ fontSize: 12, textAlign: 'center' }}>
            {blockedReason ? (
              <span style={{ color: 'var(--v2-accent)' }} role="status">{blockedReason}</span>
            ) : (
              <>Step {idx + 1} of {STEPS.length} · {STEPS[idx].label}</>
            )}
          </span>
          {step === 'publish' ? (
            <button
              className="v2-btn v2-btn-primary"
              type="button"
              disabled={!canProceed || submitting}
              onClick={persistAndRoute}
            >
              {Icon.check} {submitting ? 'Saving…' : 'Publish storefront'}
            </button>
          ) : (
            <button
              className="v2-btn v2-btn-primary"
              type="button"
              disabled={!canProceed}
              onClick={next}
            >
              <span>Continue</span> {Icon.arrow}
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}

// =====================================================================
// Sub-components (shared between Creator + Brand onboarding)
// =====================================================================

function Card({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <section className="v2-card v2-card-pad v2-onboarding-card">
      <h2 style={{
        fontFamily: 'var(--v2-font-display)',
        fontSize: 30,
        fontWeight: 500,
        letterSpacing: '-0.025em',
        margin: '0 0 6px',
        color: 'var(--v2-ink)',
      }}>
        {title}
      </h2>
      {sub && (
        <p className="v2-muted" style={{ margin: '0 0 24px', fontSize: 14, lineHeight: 1.55, maxWidth: 520 }}>
          {sub}
        </p>
      )}
      <div>{children}</div>
    </section>
  );
}

function Field({ label, sub, children }: { label: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="v2-onboarding-field">
      <label className="v2-onboarding-field-label">{label}</label>
      {sub && <div className="v2-muted v2-onboarding-field-sub">{sub}</div>}
      {children}
    </div>
  );
}

function RateInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="v2-onboarding-rate">
      <span className="v2-onboarding-rate-prefix">$</span>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="0"
      />
      <span className="v2-onboarding-rate-sub">USD per piece</span>
    </div>
  );
}

function PayoutMethod({ name, detail, icon, selected, onSelect }: {
  id: string;
  name: string;
  detail: string;
  icon: React.ReactNode;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`v2-onboarding-payout ${selected ? 'is-selected' : ''}`}
    >
      <div className="v2-channel-icon" style={{ background: 'var(--v2-moss)', width: 36, height: 36, borderRadius: 10 }}>
        {icon}
      </div>
      <div style={{ flex: 1, textAlign: 'left', minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 14 }}>{name}</div>
        <div className="v2-muted" style={{ fontSize: 12 }}>{detail}</div>
      </div>
      <div className={`v2-onboarding-radio ${selected ? 'is-on' : ''}`} aria-hidden="true">
        {selected && <span />}
      </div>
    </button>
  );
}

function PreviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="v2-row" style={{ justifyContent: 'space-between', fontSize: 12.5 }}>
      <span className="v2-muted">{label}</span>
      <span className="v2-tabular" style={{ fontWeight: 600 }}>{value}</span>
    </div>
  );
}
