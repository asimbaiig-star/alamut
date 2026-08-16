// NewCampaignWizard.tsx — v2 brand-side new-campaign 5-step wizard
//
// Mirrors the design's `NewCampaignWizard`: stepper across the top, main
// step content on the left, sticky live-preview sidebar on the right.
// Steps: Brief → Audience → Budget & timeline → Invite creators → Review.

import { useMemo, useState } from 'react';
import { fmtUSD, Icon, Topbar } from '../lib';
import { useV2BrandWallet, useV2Creators, useV2CurrentBrand } from '../v2Hooks';
import { v2LaunchCampaign, v2SaveCampaignDraft } from '../v2CampaignActions';
import type { LaunchCampaignInput } from '../v2CampaignActions';
import { pushToast } from '@/lib/utils/toast';
import { useStore } from '@/lib/api/store';
import { parseNumberInput } from '@/lib/utils/format';

interface Props {
  onRoute: (r: string) => void;
  /** Pre-seed values for the wizard. Lets entry points (Cultural
   *  Calendar "Plan" CTAs, Spark "Lock in campaign", etc.) drop the
   *  brand into a partially-filled draft instead of a blank one. Each
   *  field is optional — un-set fields fall through to the defaults. */
  initialName?: string;
  initialDeadline?: string;
  initialCategory?: string;
  initialBriefSeed?: string;
  initialInvitedCreators?: string[];
  initialBudget?: number;
  initialPerCreator?: number;
  /** Resume a saved draft: `campaign-new?draft=<campaignId>`. Repeat saves
   *  then update that campaign in place instead of creating another. */
  initialDraftId?: string;
}

interface Placement {
  /** Platform key (e.g. 'instagram', 'linkedin') — must match
   *  `inferPlatformLocal`'s heuristics in lib/api/deliverables.ts so
   *  the parser can round-trip the serialized string. */
  platform: string;
  /** Format key within the platform (e.g. 'reel', 'story', 'article'). */
  format: string;
  count: number;
}

interface Draft {
  name: string;
  objective: 'awareness' | 'conversion' | 'affinity';
  brief: string;
  /** Multi-platform / multi-format placement list. The brand can mix any
   *  number of platform×format×count rows; serializePlacements() flattens
   *  to the free-form string the launch action consumes. */
  placements: Placement[];
  audienceCity: string[];
  audienceGender: 'any' | 'female' | 'male';
  audienceAge: string[];
  categories: string[];
  budget: number;
  perCreator: number;
  deadline: string;
  invitedCreators: string[];
}

// Platform → list of supported formats. Labels are display strings that
// `parseDeliverableSlotsFreeForm` + `inferPlatformLocal/inferFormatLocal`
// can round-trip into structured Deliverable rows on launch.
const PLATFORM_FORMATS: Array<{
  value: string;
  label: string;
  formats: Array<{ value: string; label: string }>;
}> = [
  { value: 'instagram', label: 'Instagram', formats: [
    { value: 'reel', label: 'Reel' },
    { value: 'story', label: 'Story' },
    { value: 'carousel', label: 'Carousel' },
    { value: 'post', label: 'Static post' },
  ]},
  { value: 'tiktok', label: 'TikTok', formats: [
    { value: 'video', label: 'Video' },
    { value: 'live', label: 'Live' },
  ]},
  { value: 'youtube', label: 'YouTube', formats: [
    { value: 'longform', label: 'Long-form' },
    { value: 'short', label: 'Short' },
    { value: 'live', label: 'Live' },
  ]},
  { value: 'linkedin', label: 'LinkedIn', formats: [
    { value: 'post', label: 'Post' },
    { value: 'article', label: 'Article' },
    { value: 'newsletter', label: 'Newsletter' },
  ]},
  { value: 'x', label: 'X', formats: [
    { value: 'post', label: 'Post' },
    { value: 'thread', label: 'Thread' },
  ]},
  { value: 'substack', label: 'Substack', formats: [
    { value: 'newsletter', label: 'Newsletter' },
  ]},
];

function platformLabel(value: string): string {
  return PLATFORM_FORMATS.find((p) => p.value === value)?.label ?? value;
}
function formatLabel(platform: string, format: string): string {
  const p = PLATFORM_FORMATS.find((x) => x.value === platform);
  return p?.formats.find((f) => f.value === format)?.label ?? format;
}

/** Serialize placements to the free-form string `v2LaunchCampaign` expects.
 *  Format: "{count} {Platform} {Format} + {count} {Platform} {Format} + …"
 *  Example: "1 Instagram Reel + 3 Instagram Stories + 1 LinkedIn Article".
 *  The parser in lib/api/deliverables.ts pluralizes count-aware. */
function serializePlacements(placements: Placement[]): string {
  // No `'1 Instagram Post'` fallback. An empty list used to be silently
  // replaced with a deliverable the brand never asked for, materialized
  // into a real Deliverable row that creators could submit against.
  // Launch is now gated on having at least one placement (see `canLaunch`),
  // so this can only be reached with a non-empty list.
  return placements
    .map((p) => `${p.count} ${platformLabel(p.platform)} ${formatLabel(p.platform, p.format)}`)
    .join(' + ');
}

/** 30 days out, as `YYYY-MM-DD` for the date input. */
function defaultDeadline(): string {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toISOString().slice(0, 10);
}

/** Compact summary for the preview/review rows. */
function summarizePlacements(placements: Placement[]): string {
  if (placements.length === 0) return '—';
  return placements
    .map((p) => `${p.count}× ${platformLabel(p.platform)} ${formatLabel(p.platform, p.format)}`)
    .join(' · ');
}

const STEPS = [
  { id: 'brief',    label: 'Brief' },
  { id: 'audience', label: 'Audience' },
  { id: 'budget',   label: 'Budget & timeline' },
  { id: 'invite',   label: 'Invite creators' },
  { id: 'review',   label: 'Review & launch' },
] as const;

export function NewCampaignWizard({
  onRoute, initialName, initialDeadline, initialCategory, initialBriefSeed,
  initialInvitedCreators, initialBudget, initialPerCreator, initialDraftId,
}: Props) {
  const brand = useV2CurrentBrand();
  const wallet = useV2BrandWallet();
  const allCreators = useV2Creators();
  const [step, setStep] = useState(0);
  // Reopening a saved draft: seed every field from the stored campaign so
  // the brand returns to exactly what they authored, not a blank wizard
  // with a familiar title.
  const savedDraft = useStore((s) =>
    initialDraftId ? s.db.campaigns.find((c) => c.id === initialDraftId && c.stage === 'draft') : undefined,
  );
  const [draft, setDraft] = useState<Draft>(savedDraft ? {
    name: savedDraft.title,
    objective: (savedDraft.objective as Draft['objective']) ?? 'awareness',
    brief: savedDraft.brief,
    placements: savedDraft.placements?.length
      ? savedDraft.placements
      : [{ platform: 'instagram', format: 'reel', count: 1 }],
    audienceCity: savedDraft.region ? savedDraft.region.split(',').map((s) => s.trim()).filter(Boolean) : [],
    audienceGender: (savedDraft.audienceGender as Draft['audienceGender']) ?? 'any',
    audienceAge: savedDraft.audienceAge ?? [],
    categories: savedDraft.categories?.length ? savedDraft.categories : [savedDraft.category],
    budget: savedDraft.budget,
    perCreator: initialPerCreator ?? 350,
    deadline: savedDraft.deadline,
    invitedCreators: [],
  } : {
    name: initialName ?? '',
    objective: 'awareness',
    brief: initialBriefSeed ?? '',
    placements: [
      { platform: 'instagram', format: 'reel', count: 1 },
      { platform: 'instagram', format: 'story', count: 2 },
    ],
    audienceCity: ['Karachi', 'Lahore'],
    audienceGender: 'any',
    audienceAge: ['25-34', '18-24'],
    categories: initialCategory
      ? [initialCategory, ...(brand?.preferredCategories?.slice(0, 1) ?? [])]
      : (brand?.preferredCategories?.slice(0, 2) ?? ['Fashion', 'Lifestyle']),
    budget: initialBudget ?? 15000,
    perCreator: initialPerCreator ?? 350,
    // Was hardcoded '2026-06-30', which quietly went stale — a fresh wizard
    // opened with a deadline already in the past. Default to 30 days out.
    deadline: initialDeadline ?? defaultDeadline(),
    invitedCreators: initialInvitedCreators ?? [],
  });

  const update = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));

  // Id of the persisted draft, once saved. Repeat saves update it in place
  // rather than scattering copies through the campaign list.
  const [draftId, setDraftId] = useState<string | undefined>(initialDraftId);
  // Guards double-submit: `tx()` is a synchronous state setter with no
  // idempotency key, so a double-click minted two campaigns plus duplicate
  // offers and "invited you" notifications to every invited creator before
  // the first navigation unmounted the wizard.
  const [submitting, setSubmitting] = useState(false);

  const asInput = (): LaunchCampaignInput => ({
    ...draft,
    placement: serializePlacements(draft.placements),
    placements: draft.placements,
  });

  // Launch validation. Only name + brief were checked before, so a campaign
  // could go live with no placements (fabricating one), a $0 or absurd
  // budget, or a deadline already in the past.
  const deadlineMs = draft.deadline ? +new Date(`${draft.deadline}T23:59:59`) : NaN;
  const launchBlockers: string[] = [];
  if (!draft.name.trim()) launchBlockers.push('Add a campaign name');
  if (!draft.brief.trim()) launchBlockers.push('Write a brief');
  if (draft.placements.length === 0) launchBlockers.push('Add at least one placement');
  if (!(draft.budget > 0)) launchBlockers.push('Set a budget above $0');
  if (!(draft.perCreator > 0)) launchBlockers.push('Set a per-creator rate above $0');
  if (!Number.isFinite(deadlineMs)) launchBlockers.push('Pick a deadline');
  else if (deadlineMs < Date.now()) launchBlockers.push('Deadline is in the past');
  const canLaunch = launchBlockers.length === 0;

  return (
    <>
      <Topbar
        title="New campaign"
        crumb={
          <span>
            <button
              type="button"
              className="v2-link-btn"
              onClick={() => onRoute('campaigns')}
            >Campaigns</button>
            {' · Draft'}
          </span>
        }
        actions={
          <>
            <button
              className="v2-btn v2-btn-ghost"
              type="button"
              onClick={() => {
                // Confirm before discarding authored work. Cancel used to
                // navigate away silently, and with "Save as draft" writing
                // nothing there was no way to keep a partial brief at all.
                const hasContent = draft.name.trim() !== '' || draft.brief.trim() !== '';
                if (hasContent && !window.confirm('Discard this campaign? Your brief won’t be saved.')) return;
                onRoute('campaigns');
              }}
            >Cancel</button>
            <button
              className="v2-btn v2-btn-outline"
              type="button"
              onClick={() => {
                // Actually writes now. This was a toast reading "Draft saved
                // · pick it up from Campaigns" plus a navigation, with no
                // persistence anywhere — the brief was gone, and the message
                // named a place to find it.
                try {
                  const saved = v2SaveCampaignDraft(asInput(), draftId);
                  setDraftId(saved.id);
                  pushToast(`Draft saved · "${saved.title}" is in Campaigns`, 'good');
                  onRoute('campaigns');
                } catch (err) {
                  pushToast(err instanceof Error ? err.message : 'Could not save draft', 'bad');
                }
              }}
            >Save as draft</button>
          </>
        }
      />
      <div className="v2-content" style={{ maxWidth: 1080 }}>
        {/* Stepper */}
        <div className="v2-card v2-card-pad" style={{ marginBottom: 24 }}>
          <div className="v2-wizard-stepper" style={{ gridTemplateColumns: `repeat(${STEPS.length}, 1fr)` }}>
            {STEPS.map((s, i) => (
              <button
                key={s.id}
                type="button"
                className={`v2-wizard-step ${i === step ? 'is-current' : ''} ${i < step ? 'is-done' : ''}`}
                onClick={() => i <= step && setStep(i)}
                disabled={i > step}
              >
                <div className="v2-row" style={{ gap: 8, alignItems: 'center' }}>
                  <span className="v2-wizard-step-num">{i < step ? Icon.check : i + 1}</span>
                  <span className="v2-eyebrow">{s.label}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="v2-row" style={{ gap: 24, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div className="v2-card v2-card-pad-lg" style={{ flex: '2 1 480px', minWidth: 0 }}>
            {step === 0 && <StepBrief draft={draft} update={update} />}
            {step === 1 && <StepAudience draft={draft} update={update} />}
            {step === 2 && <StepBudget draft={draft} update={update} />}
            {step === 3 && <StepInvite draft={draft} update={update} creators={allCreators} onRoute={onRoute} />}
            {step === 4 && <StepReview draft={draft} creators={allCreators} />}

            <hr style={{ border: 0, borderTop: '1px solid var(--v2-line)', margin: '32px 0 20px' }} />
            {/* Say WHY launch is unavailable. A disabled button with no
                reason is its own dead end — the brand can't tell whether
                they've missed a field or the app is broken. */}
            {step === STEPS.length - 1 && launchBlockers.length > 0 && (
              <div
                className="v2-card v2-card-pad"
                style={{ marginBottom: 16, borderColor: 'var(--v2-gold)' }}
              >
                <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 6 }}>
                  Before you can launch
                </div>
                <ul className="v2-muted" style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, lineHeight: 1.7 }}>
                  {launchBlockers.map((b) => <li key={b}>{b}</li>)}
                </ul>
              </div>
            )}
            <div className="v2-row" style={{ justifyContent: 'space-between' }}>
              <button
                className="v2-btn v2-btn-ghost"
                type="button"
                disabled={step === 0}
                onClick={() => setStep((s) => s - 1)}
                style={{ opacity: step === 0 ? 0.4 : 1 }}
              >
                {Icon.arrow}<span style={{ marginLeft: 6 }}>Back</span>
              </button>
              {step < STEPS.length - 1 ? (
                <button
                  className="v2-btn v2-btn-primary"
                  type="button"
                  onClick={() => setStep((s) => s + 1)}
                >
                  Continue {Icon.arrow}
                </button>
              ) : (
                <button
                  className="v2-btn v2-btn-primary"
                  type="button"
                  onClick={() => {
                    if (submitting) return;
                    setSubmitting(true);
                    try {
                      const camp = v2LaunchCampaign(asInput());
                      pushToast(`Launched "${camp.title}" — live and accepting applications`, 'good');
                      onRoute(`campaign:${camp.id}`);
                    } catch (err) {
                      pushToast(err instanceof Error ? err.message : 'Launch failed — check your draft', 'bad');
                      setSubmitting(false);
                    }
                  }}
                  disabled={!canLaunch || submitting}
                  title={canLaunch ? undefined : launchBlockers.join(' · ')}
                >
                  {Icon.spark}<span>{submitting ? 'Launching…' : 'Launch campaign'}</span>
                </button>
              )}
            </div>
          </div>

          <WizardSidebar draft={draft} brandName={brand?.name} walletAvailable={wallet.available} />
        </div>
      </div>
    </>
  );
}

// =====================================================================
// Step 1 · Brief
// =====================================================================

function StepBrief({ draft, update }: { draft: Draft; update: (p: Partial<Draft>) => void }) {
  return (
    <>
      <H2>Tell us about the campaign</H2>
      <Sub>The brief is what creators see when deciding whether to apply.</Sub>

      <Field label="Campaign name">
        <input
          className="v2-input"
          value={draft.name}
          onChange={(e) => update({ name: e.target.value })}
          placeholder="e.g. Eid Edit '26 — Sapphire"
        />
      </Field>

      <Field label="Objective">
        <div className="v2-grid-3" style={{ gap: 8 }}>
          {[
            ['awareness', 'Awareness', 'Reach + impressions'],
            ['conversion', 'Conversion', 'Clicks, signups, sales'],
            ['affinity', 'Brand affinity', 'Sentiment, association'],
          ].map(([id, label, sub]) => (
            <button
              key={id}
              type="button"
              // Selection was communicated by colour alone — `is-on` flips
              // the fill and nothing else. Nothing in the accessibility
              // tree distinguished the chosen option from the other two.
              aria-pressed={draft.objective === id}
              className={`v2-objective-card ${draft.objective === id ? 'is-on' : ''}`}
              onClick={() => update({ objective: id as Draft['objective'] })}
            >
              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 2 }}>{label}</div>
              <div className="v2-muted" style={{ fontSize: 12 }}>{sub}</div>
            </button>
          ))}
        </div>
      </Field>

      <Field label="Brief & creative direction">
        <textarea
          className="v2-input"
          rows={5}
          value={draft.brief}
          onChange={(e) => update({ brief: e.target.value })}
          placeholder="What's the story? What's allowed and what's off-limits? Any reference creators?"
        />
      </Field>

      <Field label="Placements">
        <PlacementsEditor
          placements={draft.placements}
          onChange={(placements) => update({ placements })}
        />
      </Field>
    </>
  );
}

// =====================================================================
// PlacementsEditor — multi-platform / multi-format picker
// =====================================================================
//
// Each row picks {platform, format, count}. The brand can stack as many
// rows as they want — e.g. "1 Instagram Reel + 3 Instagram Stories +
// 1 LinkedIn Article". Format options filter to the chosen platform.

function PlacementsEditor({
  placements, onChange,
}: {
  placements: Placement[];
  onChange: (next: Placement[]) => void;
}) {
  const setRow = (i: number, patch: Partial<Placement>) => {
    onChange(placements.map((p, idx) => idx === i ? { ...p, ...patch } : p));
  };
  const removeRow = (i: number) => {
    onChange(placements.filter((_, idx) => idx !== i));
  };
  const addRow = () => {
    onChange([...placements, { platform: 'instagram', format: 'post', count: 1 }]);
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {placements.length === 0 && (
        <p className="v2-muted" style={{ fontSize: 13, margin: 0 }}>
          No placements yet — add at least one so creators know what to deliver.
        </p>
      )}
      {placements.map((p, i) => {
        const platformDef = PLATFORM_FORMATS.find((x) => x.value === p.platform);
        const formats = platformDef?.formats ?? [];
        return (
          <div
            key={i}
            className="v2-row"
            style={{
              gap: 8,
              padding: 10,
              borderRadius: 10,
              border: '1px solid var(--v2-border)',
              alignItems: 'center',
            }}
          >
            <input
              className="v2-input"
              type="number"
              min={1}
              max={10}
              value={p.count}
              onChange={(e) => setRow(i, { count: parseNumberInput(e.target.value, { min: 1, max: 10 }) })}
              style={{ width: 64 }}
              aria-label="Count"
            />
            <span className="v2-muted" style={{ fontSize: 13 }}>×</span>
            <select
              className="v2-input"
              value={p.platform}
              onChange={(e) => {
                const nextPlatform = e.target.value;
                const nextFormats = PLATFORM_FORMATS.find((x) => x.value === nextPlatform)?.formats ?? [];
                // Reset format if current format isn't supported on the new platform.
                const nextFormat = nextFormats.some((f) => f.value === p.format)
                  ? p.format
                  : nextFormats[0]?.value ?? 'post';
                setRow(i, { platform: nextPlatform, format: nextFormat });
              }}
              style={{ flex: '1 1 140px' }}
              aria-label="Platform"
            >
              {PLATFORM_FORMATS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <select
              className="v2-input"
              value={p.format}
              onChange={(e) => setRow(i, { format: e.target.value })}
              style={{ flex: '1 1 140px' }}
              aria-label="Format"
            >
              {formats.map((f) => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </select>
            <button
              type="button"
              className="v2-icon-btn"
              onClick={() => removeRow(i)}
              aria-label="Remove placement"
              title="Remove"
              style={{ flex: 'none' }}
            >×</button>
          </div>
        );
      })}
      <button
        type="button"
        className="v2-btn v2-btn-outline v2-btn-sm"
        onClick={addRow}
        style={{ alignSelf: 'flex-start' }}
      >
        {Icon.plus} Add placement
      </button>
    </div>
  );
}

// =====================================================================
// Step 2 · Audience
// =====================================================================

function StepAudience({ draft, update }: { draft: Draft; update: (p: Partial<Draft>) => void }) {
  const cities = ['Karachi', 'Lahore', 'Islamabad', 'Rawalpindi', 'Faisalabad', 'Multan', 'Peshawar'];
  const cats = ['Fashion', 'Lifestyle', 'Beauty', 'Food', 'Travel', 'Tech', 'Finance', 'Parenting', 'Fitness', 'B2B', 'Newsletter'];
  const ages = ['18-24', '25-34', '35-44', '45+'];
  return (
    <>
      <H2>Who should this reach?</H2>
      {/* Was: "Spark uses these to filter creators by audience overlap."
          Spark reads none of these. `audienceCity` becomes the brief's
          region, which the fit score's geo facet does use; gender and age
          are recorded on the brief for creators to read and filter nothing.
          Telling a brand a field drives matching when it does not is how
          they end up blaming the matching for their own inputs. */}
      <Sub>Cities set the brief’s region, which fit scoring uses. Age and gender are shown to creators on the brief — they don’t filter who sees it.</Sub>

      <Field label="Cities (audience location)">
        <ChipMulti options={cities} selected={draft.audienceCity} onChange={(v) => update({ audienceCity: v })} />
      </Field>

      <Field label="Gender skew">
        <div className="v2-segmented">
          {(['any', 'female', 'male'] as const).map((g) => (
            <button
              key={g}
              type="button"
              aria-pressed={draft.audienceGender === g}
              className={`v2-segmented-btn ${draft.audienceGender === g ? 'is-on' : ''}`}
              onClick={() => update({ audienceGender: g })}
            >
              {g === 'any' ? 'Any' : g === 'female' ? 'Female-leaning' : 'Male-leaning'}
            </button>
          ))}
        </div>
      </Field>

      <Field label="Age groups">
        <ChipMulti options={ages} selected={draft.audienceAge} onChange={(v) => update({ audienceAge: v })} />
      </Field>

      <Field label="Creator categories">
        <ChipMulti options={cats} selected={draft.categories} onChange={(v) => update({ categories: v })} />
      </Field>
    </>
  );
}

// =====================================================================
// Step 3 · Budget & timeline
// =====================================================================

function StepBudget({ draft, update }: { draft: Draft; update: (p: Partial<Draft>) => void }) {
  return (
    <>
      <H2>Budget & timeline</H2>
      {/* Launch reserves nothing: `v2LaunchCampaign` sets escrowHeld: 0 and
          never touches the wallet. Escrow is held per creator, when an offer
          is accepted (`v2AcceptOffer`). Saying otherwise let a brand launch
          several campaigns believing the budget was committed while the full
          balance stayed spendable. */}
      <Sub>Budget is a plan, not a hold — escrow is reserved per creator when they accept.</Sub>

      <Field label="Total budget (USD)" htmlFor="v2-campaign-budget">
        <div className="v2-onboarding-rate">
          <span className="v2-onboarding-rate-prefix">$</span>
          <input
            id="v2-campaign-budget"
            type="number"
            value={draft.budget}
            onChange={(e) => update({ budget: parseNumberInput(e.target.value, { min: 0 }) })}
          />
        </div>
        <div className="v2-row" style={{ gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
          {[5000, 10000, 20000, 50000].map((n) => (
            <button
              key={n}
              type="button"
              className="v2-btn v2-btn-sm v2-btn-outline"
              onClick={() => update({ budget: n })}
            >{fmtUSD(n)}</button>
          ))}
        </div>
      </Field>

      <Field label="Target price per creator" htmlFor="v2-campaign-per-creator">
        <div className="v2-onboarding-rate">
          <span className="v2-onboarding-rate-prefix">$</span>
          <input
            id="v2-campaign-per-creator"
            type="number"
            value={draft.perCreator}
            onChange={(e) => update({ perCreator: parseNumberInput(e.target.value, { min: 0 }) })}
          />
        </div>
        <div className="v2-muted" style={{ fontSize: 12, marginTop: 6 }}>
          ≈ {Math.floor(draft.budget / Math.max(draft.perCreator, 1))} creators at this rate
        </div>
      </Field>

      <Field label="Deadline">
        <input
          className="v2-input"
          type="date"
          value={draft.deadline}
          onChange={(e) => update({ deadline: e.target.value })}
        />
      </Field>

      <div style={{
        marginTop: 24,
        padding: 14,
        background: 'var(--v2-bg-1)',
        borderRadius: 'var(--v2-r-md)',
      }}>
        <div className="v2-eyebrow" style={{ marginBottom: 8 }}>Estimated breakdown</div>
        <KvRow k="Creator payouts (gross)" v={fmtUSD(Math.round(draft.budget * 0.87))} />
        <KvRow k="Platform fee (10%)" v={fmtUSD(Math.round(draft.budget * 0.087))} />
        <KvRow k="Withholding (5%)" v={fmtUSD(Math.round(draft.budget * 0.044))} />
        <hr style={{ border: 0, borderTop: '1px solid var(--v2-line)', margin: '8px 0' }} />
        <KvRow k="Total reserved from wallet" v={fmtUSD(draft.budget)} bold />
      </div>
    </>
  );
}

// =====================================================================
// Step 4 · Invite creators
// =====================================================================

function StepInvite({ draft, update, creators, onRoute }: {
  draft: Draft;
  update: (p: Partial<Draft>) => void;
  creators: ReturnType<typeof useV2Creators>;
  onRoute: (r: string) => void;
}) {
  const recommended = useMemo(() => {
    return creators
      .filter((c) => c.categories.some((cat) => draft.categories.includes(cat)))
      .slice(0, 12);
  }, [creators, draft.categories]);

  function toggle(id: string) {
    const next = draft.invitedCreators.includes(id)
      ? draft.invitedCreators.filter((x) => x !== id)
      : [...draft.invitedCreators, id];
    update({ invitedCreators: next });
  }

  return (
    <>
      <H2>Invite creators</H2>
      <Sub>Spark surfaced these matches based on your audience criteria.</Sub>

      <div className="v2-spark-rationale" style={{ marginBottom: 16 }}>
        <span style={{ color: 'var(--v2-accent)', flexShrink: 0 }}>{Icon.spark}</span>
        <span><strong>Spark suggests:</strong> Start with 6–8 creators across price tiers. We'll auto-shortlist new applicants as they apply.</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {recommended.map((c) => {
          const top = c.channels.reduce((a, b) => (a.followers > b.followers ? a : b), c.channels[0]);
          const invited = draft.invitedCreators.includes(c.id);
          return (
            <button
              key={c.id}
              type="button"
              aria-pressed={invited}
              className={`v2-invite-row ${invited ? 'is-on' : ''}`}
              onClick={() => toggle(c.id)}
            >
              <div
                className="v2-avatar v2-avatar-md"
                style={{ backgroundImage: `url(${c.avatar})` }}
                aria-hidden="true"
              />
              <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                <div className="v2-row" style={{ gap: 6, alignItems: 'center' }}>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{c.name}</span>
                  {c.verified && <span style={{ color: 'var(--v2-info)', display: 'flex' }}>{Icon.check}</span>}
                </div>
                <div className="v2-muted" style={{ fontSize: 12 }}>
                  @{c.handle} · {c.city} · {top ? `${(top.followers / 1000).toFixed(0)}K on ${top.platform}` : 'no channels'}
                </div>
              </div>
              <span className="v2-tabular" style={{ fontWeight: 550, fontSize: 14 }}>{fmtUSD(c.rate)}</span>
              <span className={`v2-invite-toggle ${invited ? 'is-on' : ''}`}>
                {invited ? Icon.check : Icon.plus}
              </span>
            </button>
          );
        })}
      </div>

      <button
        className="v2-btn v2-btn-outline"
        type="button"
        style={{ marginTop: 16, width: '100%' }}
        onClick={() => onRoute('discover')}
      >
        {Icon.search} Browse all creators
      </button>
    </>
  );
}

// =====================================================================
// Step 5 · Review
// =====================================================================

function StepReview({ draft, creators }: {
  draft: Draft;
  creators: ReturnType<typeof useV2Creators>;
}) {
  const invited = draft.invitedCreators
    .map((id) => creators.find((c) => c.id === id))
    .filter((x): x is NonNullable<typeof x> => !!x);

  return (
    <>
      <H2>Review & launch</H2>
      <Sub>Nothing leaves your wallet at launch — escrow is held as each creator accepts. You can pause anytime.</Sub>

      <ReviewSection title="Brief">
        <KvRow k="Name" v={draft.name || '—'} />
        <KvRow k="Objective" v={draft.objective} />
        <KvRow k="Placements" v={summarizePlacements(draft.placements)} />
        <KvRow k="Brief" v={draft.brief || '—'} wrap />
      </ReviewSection>

      <ReviewSection title="Audience">
        <KvRow k="Cities" v={draft.audienceCity.join(', ') || 'Any'} />
        <KvRow k="Gender" v={draft.audienceGender} />
        <KvRow k="Age" v={draft.audienceAge.join(', ')} />
        <KvRow k="Categories" v={draft.categories.join(', ')} />
      </ReviewSection>

      <ReviewSection title="Budget">
        <KvRow k="Total" v={fmtUSD(draft.budget)} />
        <KvRow k="Per creator" v={fmtUSD(draft.perCreator)} />
        <KvRow k="Deadline" v={draft.deadline} />
      </ReviewSection>

      <ReviewSection title={`Invited creators (${invited.length})`}>
        {invited.length === 0 && (
          <div className="v2-muted" style={{ fontSize: 13 }}>
            None invited yet — Spark will recommend more after launch.
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {invited.map((c) => (
            <div key={c.id} className="v2-row" style={{ padding: '6px 0', gap: 10 }}>
              <div
                className="v2-avatar v2-avatar-sm"
                style={{ backgroundImage: `url(${c.avatar})` }}
                aria-hidden="true"
              />
              <span style={{ flex: 1, fontSize: 13.5 }}>{c.name}</span>
              <span className="v2-tabular v2-muted" style={{ fontSize: 13 }}>{fmtUSD(c.rate)}</span>
            </div>
          ))}
        </div>
      </ReviewSection>
    </>
  );
}

// =====================================================================
// Sidebar (live preview)
// =====================================================================

function WizardSidebar({ draft, brandName, walletAvailable }: {
  draft: Draft;
  brandName?: string;
  walletAvailable: number;
}) {
  return (
    <aside className="v2-card v2-card-pad" style={{ flex: '1 1 280px', position: 'sticky', top: 80 }}>
      <div className="v2-eyebrow" style={{ marginBottom: 12 }}>Live preview</div>
      <div style={{
        fontFamily: 'var(--v2-font-display)',
        fontSize: 22,
        fontWeight: 500,
        letterSpacing: '-0.02em',
        marginBottom: 4,
      }}>
        {draft.name || 'Untitled campaign'}
      </div>
      <div className="v2-muted" style={{ fontSize: 12, marginBottom: 16 }}>
        {brandName ?? 'Your brand'}
      </div>
      <KvRow k="Objective" v={draft.objective} />
      <KvRow k="Placements" v={summarizePlacements(draft.placements)} />
      <KvRow
        k="Cities"
        v={draft.audienceCity.length > 1
          ? `${draft.audienceCity[0]} +${draft.audienceCity.length - 1}`
          : draft.audienceCity[0] || '—'}
      />
      <KvRow k="Categories" v={draft.categories.length > 0 ? `${draft.categories.length} selected` : '—'} />
      <hr style={{ border: 0, borderTop: '1px solid var(--v2-line)', margin: '12px 0' }} />
      <KvRow k="Budget" v={fmtUSD(draft.budget)} bold />
      <KvRow k="Per creator" v={fmtUSD(draft.perCreator)} />
      <KvRow k="Deadline" v={draft.deadline} />
      <hr style={{ border: 0, borderTop: '1px solid var(--v2-line)', margin: '12px 0' }} />
      <KvRow k="Invited" v={`${draft.invitedCreators.length} creators`} />
      {/* Was "Wallet after launch", computing `available - budget` — a
          figure for an event that never happens. Launch moves no money, so
          the honest number is simply what's in the wallet now. */}
      <KvRow k="Wallet available" v={fmtUSD(walletAvailable)} />
      {draft.budget > walletAvailable && (
        <div className="v2-muted" style={{ fontSize: 11, marginTop: 6, lineHeight: 1.4 }}>
          Budget exceeds your balance. You can still launch — escrow is only
          held as creators accept — but top up before confirming offers.
        </div>
      )}
    </aside>
  );
}

// =====================================================================
// Primitives
// =====================================================================

function H2({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={{
      fontFamily: 'var(--v2-font-display)',
      fontSize: 28,
      fontWeight: 500,
      margin: '0 0 6px',
      letterSpacing: '-0.02em',
    }}>{children}</h2>
  );
}
function Sub({ children }: { children: React.ReactNode }) {
  return <p className="v2-muted" style={{ margin: '0 0 24px' }}>{children}</p>;
}
function Field({ label, htmlFor, children }: {
  label: string;
  /** id of the control this labels. Without it the <label> is a sibling
   *  with no association, and the field is announced unnamed. */
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 18 }}>
      <label className="v2-eyebrow" htmlFor={htmlFor} style={{ display: 'block', marginBottom: 6 }}>{label}</label>
      {children}
    </div>
  );
}
function KvRow({ k, v, bold, wrap }: { k: string; v: string; bold?: boolean; wrap?: boolean }) {
  return (
    <div className="v2-row" style={{ justifyContent: 'space-between', padding: '5px 0', fontSize: 13, alignItems: 'flex-start', gap: 12 }}>
      <span className="v2-muted" style={{ flexShrink: 0 }}>{k}</span>
      <span
        className={!wrap ? 'v2-tabular' : ''}
        style={{
          fontWeight: bold ? 600 : 500,
          color: bold ? 'var(--v2-ink)' : 'var(--v2-ink-2)',
          textAlign: 'right',
          maxWidth: wrap ? '70%' : undefined,
        }}
      >{v}</span>
    </div>
  );
}
function ChipMulti({ options, selected, onChange }: {
  options: string[];
  selected: string[];
  onChange: (v: string[]) => void;
}) {
  const toggle = (o: string) =>
    onChange(selected.includes(o) ? selected.filter((x) => x !== o) : [...selected, o]);
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {options.map((o) => {
        const on = selected.includes(o);
        return (
          <button
            key={o}
            type="button"
            aria-pressed={on}
            className="v2-pill"
            style={{
              cursor: 'pointer',
              border: '1px solid',
              background: on ? 'var(--v2-ink)' : 'var(--v2-paper)',
              color: on ? 'var(--v2-paper)' : 'var(--v2-ink-2)',
              borderColor: on ? 'var(--v2-ink)' : 'var(--v2-line)',
            }}
            onClick={() => toggle(o)}
          >{o}</button>
        );
      })}
    </div>
  );
}
function ReviewSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 20, padding: 16, background: 'var(--v2-bg-1)', borderRadius: 'var(--v2-r-md)' }}>
      <div className="v2-eyebrow" style={{ marginBottom: 10 }}>{title}</div>
      {children}
    </div>
  );
}
