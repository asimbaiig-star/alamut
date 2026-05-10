import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth/useAuth';
import { api } from '@/lib/api/client';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { fmtMoneyFull, fmtDate } from '@/lib/utils/format';
import { pushToast } from '@/lib/utils/toast';
import { REF_DATE } from '@/lib/utils/campaign-metrics';
import { forecastOutcome, DEFAULT_ACCEPTED } from '@/lib/utils/outcome-forecast';
import { useStore } from '@/lib/api/store';
import {
  allTemplatesForBrand,
  saveBrandTemplate,
  deleteBrandTemplate,
  type CampaignTemplate,
} from '@/lib/utils/campaign-templates';
import type { Campaign, CampaignKind, ContentRights, OutcomePricing, PricingModel } from '@/lib/api/types';
import { AIBriefAssistantModal } from './AIBriefAssistantModal';

// Phase 21: helper to give the deadline picker a sensible default (REF + 14d)
// in YYYY-MM-DD form for the HTML5 date input.
function defaultDeadlineISO(): string {
  const d = new Date(+REF_DATE + 14 * 24 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
}

const CATEGORIES = ['Lifestyle', 'Beauty', 'Wellness', 'Design', 'Interiors', 'Fashion', 'Food', 'Travel', 'Sustainability', 'Tech'];
const REGIONS = ['Global', 'US', 'UK', 'EU', 'APAC', 'LATAM', 'MENA', 'US/UK', 'EU/JP'];

interface NewCampaignModalProps {
  open: boolean;
  onClose: () => void;
  onCreated?: (id: string) => void;
  cloneFrom?: Campaign;
}

export function NewCampaignModal({ open, onClose, onCreated, cloneFrom }: NewCampaignModalProps) {
  const { brand } = useAuth();
  const db = useStore((s) => s.db);
  const [step, setStep] = useState(1);
  const [title, setTitle] = useState('');
  const [pitch, setPitch] = useState('');
  const [brief, setBrief] = useState('');
  const [budget, setBudget] = useState(5000);
  const [category, setCategory] = useState('Lifestyle');
  const [region, setRegion] = useState('Global');
  const [deliverables, setDeliverables] = useState('1 Reel + 2 stories');
  const [deadline, setDeadline] = useState(defaultDeadlineISO());
  const [cover, setCover] = useState('https://images.unsplash.com/photo-1556228720-195a672e8a03?w=800&h=600&fit=crop');
  const [rights, setRights] = useState<ContentRights>({
    exclusivity: 'none', whitelistAds: false, repurpose: 'none', derivative: false, organicOnly: false,
  });
  const [kind, setKind] = useState<CampaignKind>('one_off');
  const [retainerTerm, setRetainerTerm] = useState(6);
  const [pricingModel, setPricingModel] = useState<PricingModel>('fixed');
  const [outcomePricing, setOutcomePricing] = useState<OutcomePricing>({
    baseFloor: 1500, perConversion: 8, capPerCreator: 6000,
  });
  const [aiOpen, setAiOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  // Per-field error state — keyed by input id. Set on blur, cleared on next change.
  const [errors, setErrors] = useState<Record<string, string>>({});
  // Phase 23: campaign templates — pick from platform/brand library to
  // pre-fill, or save the current draft as a brand-level template.
  const [templates, setTemplates] = useState<CampaignTemplate[]>(() => brand ? allTemplatesForBrand(brand.id) : []);
  const [saveTplOpen, setSaveTplOpen] = useState(false);
  const [saveTplName, setSaveTplName] = useState('');

  const refreshTemplates = () => {
    if (brand) setTemplates(allTemplatesForBrand(brand.id));
  };

  // Phase 23 QA fix: re-fetch templates whenever the brand identity flips
  // (lazy auth resolution would otherwise leave the picker stuck on []).
  useEffect(() => {
    if (brand) setTemplates(allTemplatesForBrand(brand.id));
  }, [brand?.id]);

  const applyTemplate = (t: CampaignTemplate) => {
    // Phase 23 QA fix: clear stale field errors when overwriting form state
    // (otherwise a "Title is required" error sticks around after the new
    // title is set).
    setErrors({});
    const d = t.data;
    if (d.title !== undefined) setTitle(d.title);
    if (d.pitch !== undefined) setPitch(d.pitch);
    if (d.brief !== undefined) setBrief(d.brief);
    if (d.budget !== undefined) setBudget(d.budget);
    if (d.category !== undefined) setCategory(d.category);
    if (d.region !== undefined) setRegion(d.region);
    if (d.deliverables !== undefined) setDeliverables(d.deliverables);
    if (d.cover !== undefined) setCover(d.cover);
    if (d.rights !== undefined) setRights(d.rights);
    if (d.kind !== undefined) setKind(d.kind);
    if (d.retainerTerm !== undefined) setRetainerTerm(d.retainerTerm);
    if (d.pricingModel !== undefined) setPricingModel(d.pricingModel);
    if (d.outcomePricing !== undefined) setOutcomePricing(d.outcomePricing);
    pushToast(`Applied "${t.name}" — adjust anything before publishing.`, 'good');
  };

  const onSaveTemplate = () => {
    if (!brand) return;
    const name = saveTplName.trim();
    if (!name) {
      pushToast('Give the template a name first', 'bad');
      return;
    }
    saveBrandTemplate(brand.id, {
      name,
      description: `${category} · ${kind === 'retainer' ? 'Retainer' : 'One-off'} · ${pricingModel === 'outcome' ? 'Outcome' : 'Fixed'}`,
      data: {
        title, pitch, brief, budget, category, region, deliverables, cover,
        rights, kind, retainerTerm,
        pricingModel,
        outcomePricing: pricingModel === 'outcome' ? outcomePricing : undefined,
      },
    });
    refreshTemplates();
    setSaveTplOpen(false);
    setSaveTplName('');
    pushToast(`Saved "${name}" — pick from the template list next time.`, 'good');
  };

  const onDeleteTemplate = (templateId: string) => {
    if (!brand) return;
    deleteBrandTemplate(brand.id, templateId);
    refreshTemplates();
  };

  const setFieldError = (key: string, msg: string | null) => {
    setErrors((prev) => {
      const next = { ...prev };
      if (msg) next[key] = msg;
      else delete next[key];
      return next;
    });
  };

  // Pre-fill from a cloned campaign whenever the source changes (and dialog opens).
  // Title stays as-is — modal header reads "Clone · {original}" so the user knows it's a fork.
  useEffect(() => {
    if (open && cloneFrom) {
      setStep(1);
      setTitle(cloneFrom.title);
      setPitch(cloneFrom.pitch);
      setBrief(cloneFrom.brief);
      setBudget(cloneFrom.budget);
      setCategory(cloneFrom.category);
      setRegion(cloneFrom.region);
      setDeliverables(cloneFrom.deliverablesText);
      setCover(cloneFrom.cover);
      // Phase 21: clone with a fresh future deadline rather than copying the
      // original (which would already be in the past for an old campaign).
      setDeadline(defaultDeadlineISO());
      if (cloneFrom.rights) setRights(cloneFrom.rights);
      setPricingModel(cloneFrom.pricingModel || 'fixed');
      if (cloneFrom.outcomePricing) setOutcomePricing(cloneFrom.outcomePricing);
    }
  }, [open, cloneFrom]);

  if (!brand) return null;

  const reset = () => {
    setStep(1); setTitle(''); setPitch(''); setBrief(''); setBudget(5000);
    setCategory('Lifestyle'); setRegion('Global');
    setDeliverables('1 Reel + 2 stories'); setDeadline(defaultDeadlineISO());
    // Phase 23 QA fix: also reset cover/rights/kind/retainer term so
    // closing mid-flow doesn't leak stale branch state into the next
    // campaign creation.
    setCover('https://images.unsplash.com/photo-1556228720-195a672e8a03?w=800&h=600&fit=crop');
    setRights({ exclusivity: 'none', whitelistAds: false, repurpose: 'none', derivative: false, organicOnly: false });
    setKind('one_off');
    setRetainerTerm(6);
    setPricingModel('fixed');
    setOutcomePricing({ baseFloor: 1500, perConversion: 8, capPerCreator: 6000 });
    setErrors({});
  };

  const handleClose = () => { reset(); onClose(); };

  const create = async (live: boolean) => {
    if (!title.trim()) {
      setFieldError('cmp-title', 'Title is required.');
      setStep(1);
      // Focus the title input so screen reader announces the error and keyboard users land there.
      requestAnimationFrame(() => document.getElementById('cmp-title')?.focus());
      return;
    }
    // Phase 21 QA fix: empty deadline ships through to Step 3 review showing
    // a dash; downstream renders end up with "Due " (empty). Validate before
    // submit and bounce the user back to Step 2 with focus on the picker.
    if (!deadline.trim()) {
      pushToast('Pick an apply-by date before publishing', 'bad');
      setStep(2);
      requestAnimationFrame(() => document.getElementById('cmp-deadline')?.focus());
      return;
    }
    setBusy(true);
    try {
      const cmp = await api.campaigns.create({
        brandId: brand.id,
        title: title.trim(),
        pitch: pitch.trim() || `${category} campaign — ${deliverables}.`,
        brief: brief.trim() || pitch.trim() || 'Brief to be added.',
        cover,
        budget: kind === 'retainer' ? budget * retainerTerm : budget,
        region, category,
        stage: live ? 'live' : 'draft',
        // P1d §1.5 — `deliverablesText` is the free-form display string;
        // `client.api.campaigns.create` materializes structured Deliverable
        // rows from this string via `materializeDeliverablesForCampaign`,
        // so `deliverableIds` is computed there and is excluded from the
        // create input shape (`Omit<Campaign, ... | 'deliverableIds'>`).
        deliverablesText: deliverables,
        deadline,
        rights,
        kind,
        retainer: kind === 'retainer' ? {
          monthlyRate: budget,
          termMonths: retainerTerm,
          deliverablesPerMonth: deliverables,
          monthsCompleted: 0,
        } : undefined,
        pricingModel,
        outcomePricing: pricingModel === 'outcome' ? outcomePricing : undefined,
      });
      pushToast(live ? `Campaign live: ${cmp.title}` : `Draft saved: ${cmp.title}`, 'good');
      onCreated?.(cmp.id);
      handleClose();
    } catch (e) {
      pushToast(e instanceof Error ? e.message : 'Could not create campaign', 'bad');
    } finally {
      setBusy(false);
    }
  };

  const stepTitles = ['Brief', 'Budget & deliverables', 'Content rights', 'Review & launch'];

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={cloneFrom ? `Clone · ${cloneFrom.title}` : 'New campaign'}
      width={680}
      footer={<>
        {step > 1 ? <Button variant="ghost" onClick={() => setStep(step - 1)}>Back</Button> : <Button variant="ghost" onClick={handleClose}>Cancel</Button>}
        {step < 4 ? (
          <Button onClick={() => setStep(step + 1)} iconRight={<Icon.arrow s={14} />} disabled={step === 1 && !title.trim()}>Next</Button>
        ) : (
          <>
            <Button variant="ghost" onClick={() => create(false)} loading={busy}>Save as draft</Button>
            <Button onClick={() => create(true)} loading={busy} icon={<Icon.check s={14} />}>Publish & go live</Button>
          </>
        )}
      </>}
    >
      <ol className="builder-steps" aria-label="Campaign creation progress">
        {stepTitles.map((t, i) => {
          const stepNum = i + 1;
          const state = step === stepNum ? 'on' : step > stepNum ? 'done' : 'pending';
          return (
            <li
              key={t}
              className={['builder-step', `is-${state}`].join(' ')}
              aria-current={state === 'on' ? 'step' : undefined}
            >
              <span className="builder-step-mark" aria-hidden="true">
                {state === 'done' ? <Icon.check s={12} /> : stepNum}
              </span>
              <span className="builder-step-label">
                <span className="mono-meta builder-step-num">Step {stepNum}</span>
                <span className="builder-step-name">{t}</span>
              </span>
            </li>
          );
        })}
      </ol>

      {step === 1 && (
        <div className="form-grid">
          {/* Phase 23: Template picker — pre-fill the form from a curated
              platform playbook OR a brand-saved template. Shows up only
              when not in clone mode (cloning already pre-fills). */}
          {!cloneFrom && templates.length > 0 && (
            <div className="field full">
              <div className="mono-meta mb-8">Start from a template (optional)</div>
              <div className="template-grid">
                {templates.map((t) => (
                  <div
                    key={t.id}
                    className={['template-card', `template-card-${t.source}`].join(' ')}
                  >
                    <button
                      type="button"
                      className="template-card-apply"
                      onClick={() => applyTemplate(t)}
                      title={t.description || `Apply ${t.name}`}
                    >
                      <div className="template-card-name">{t.name}</div>
                      {t.description && <div className="template-card-desc">{t.description}</div>}
                      <div className="template-card-meta">
                        <span className={`template-card-tag template-card-tag-${t.source}`}>
                          {t.source === 'platform' ? 'Platform' : 'Saved'}
                        </span>
                        {t.data.category && <span>{t.data.category}</span>}
                        {t.data.kind === 'retainer' && <span>Retainer</span>}
                        {t.data.pricingModel === 'outcome' && <span>Outcome</span>}
                      </div>
                    </button>
                    {t.source === 'brand' && (
                      <button
                        type="button"
                        className="template-card-x"
                        onClick={() => onDeleteTemplate(t.id)}
                        aria-label={`Delete saved template ${t.name}`}
                        title="Delete saved template"
                      >
                        <Icon.x s={12} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="field full">
            <div className="row-between mb-8">
              <label htmlFor="cmp-title" className="field-label" style={{ marginBottom: 0 }}>Campaign title</label>
              <Button variant="plain" size="sm" onClick={() => setAiOpen(true)} icon={<Icon.spark s={12} />}>
                AI brief assistant
              </Button>
            </div>
            <input
              id="cmp-title"
              value={title}
              onChange={(e) => { setTitle(e.target.value); if (errors['cmp-title']) setFieldError('cmp-title', null); }}
              onBlur={(e) => setFieldError('cmp-title', e.target.value.trim() ? null : 'Title is required.')}
              placeholder="e.g. Spring Renewal"
              autoFocus
              required
              aria-invalid={!!errors['cmp-title'] || undefined}
              aria-describedby={errors['cmp-title'] ? 'cmp-title-error' : undefined}
            />
            {errors['cmp-title'] && (
              <span id="cmp-title-error" className="field-error" role="alert">{errors['cmp-title']}</span>
            )}
          </div>
          <div className="field full">
            <label htmlFor="cmp-pitch" className="field-label">One-line pitch</label>
            <input id="cmp-pitch" value={pitch} onChange={(e) => setPitch(e.target.value)} placeholder="A mindful skincare moment for the change of season." />
          </div>
          <div className="field full">
            <label htmlFor="cmp-brief" className="field-label">Full brief</label>
            <textarea id="cmp-brief" rows={5} value={brief} onChange={(e) => setBrief(e.target.value)} placeholder="What you want, who it's for, the brand voice. Anything creators should know before applying." />
          </div>
          <div className="field full">
            <label htmlFor="cmp-cover" className="field-label">Cover image URL</label>
            <input id="cmp-cover" type="url" value={cover} onChange={(e) => setCover(e.target.value)} placeholder="https://…" aria-describedby="cmp-cover-help" />
            <span id="cmp-cover-help" className="field-help">Real upload arrives with file storage. For now, paste any image URL.</span>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="form-grid">
          <div className="field full">
            <label className="field-label">Engagement type</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" className={['tab', kind === 'one_off' ? 'is-on' : ''].join(' ')} onClick={() => setKind('one_off')}>One-off</button>
              <button type="button" className={['tab', kind === 'retainer' ? 'is-on' : ''].join(' ')} onClick={() => setKind('retainer')}>Recurring retainer</button>
            </div>
            <span className="field-help">{kind === 'retainer' ? 'A multi-month engagement with monthly billing. Recurring relationships earn higher creator commitment + better rates over time.' : 'A single deliverable run.'}</span>
          </div>

          {kind === 'retainer' && (
            <div className="field full">
              <label className="field-label">Term length</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {[3, 6, 12].map((n) => (
                  <button key={n} type="button" className={['tab', retainerTerm === n ? 'is-on' : ''].join(' ')} onClick={() => setRetainerTerm(n)}>{n} months</button>
                ))}
              </div>
              <span className="field-help">Total contract value: <strong>${(budget * retainerTerm).toLocaleString()}</strong> over {retainerTerm} months.</span>
            </div>
          )}

          {kind === 'one_off' && (
            <div className="field full">
              <label className="field-label">Pricing model</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" className={['tab', pricingModel === 'fixed' ? 'is-on' : ''].join(' ')} onClick={() => setPricingModel('fixed')}>Fixed rate</button>
                <button type="button" className={['tab', pricingModel === 'outcome' ? 'is-on' : ''].join(' ')} onClick={() => setPricingModel('outcome')}>Outcome-based</button>
              </div>
              <span className="field-help">
                {pricingModel === 'outcome'
                  ? 'Creator gets a base floor + a bonus per attributed conversion (capped). Higher upside for creators, lower risk for you. Requires UTM tracking.'
                  : 'Creator gets a flat rate per deliverable, regardless of campaign performance.'}
              </span>
            </div>
          )}

          <div className="field">
            <label htmlFor="cmp-budget" className="field-label">
              {kind === 'retainer' ? 'Monthly budget (USD)' : pricingModel === 'outcome' ? 'Total budget cap (USD)' : 'Budget (USD)'}
            </label>
            <input id="cmp-budget" type="number" min={500} step={500} inputMode="numeric" value={budget} onChange={(e) => setBudget(Number(e.target.value))} />
            <span className="field-help">
              {kind === 'retainer'
                ? `Escrow holds 1 month at a time; total contract ${(budget * retainerTerm).toLocaleString()}.`
                : pricingModel === 'outcome'
                  ? 'Maximum the campaign can spend across all creators (base floors + conversion bonuses).'
                  : '50% held in escrow on offer accept; 50% on post live.'}
            </span>
          </div>
          <div className="field">
            <label htmlFor="cmp-deadline" className="field-label">Apply by</label>
            <input
              id="cmp-deadline"
              type="date"
              value={deadline}
              // Phase 21 QA fix: min = today (REF_DATE), so users can't
              // pick a date already in the past.
              min={REF_DATE.toISOString().slice(0, 10)}
              onChange={(e) => setDeadline(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="cmp-category" className="field-label">Category</label>
            <select id="cmp-category" value={category} onChange={(e) => setCategory(e.target.value)} style={{ background: 'var(--surface)', border: '1px solid var(--rule)', borderRadius: 4, padding: '10px 12px' }}>
              {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="cmp-region" className="field-label">Region</label>
            <select id="cmp-region" value={region} onChange={(e) => setRegion(e.target.value)} style={{ background: 'var(--surface)', border: '1px solid var(--rule)', borderRadius: 4, padding: '10px 12px' }}>
              {REGIONS.map((r) => <option key={r}>{r}</option>)}
            </select>
          </div>
          <div className="field full">
            <label htmlFor="cmp-deliverables" className="field-label">Deliverables</label>
            <input id="cmp-deliverables" value={deliverables} onChange={(e) => setDeliverables(e.target.value)} placeholder="1 Reel + 2 stories" />
          </div>
          {pricingModel === 'outcome' && kind === 'one_off' && (
            <div className="field full">
              <div style={{ background: 'color-mix(in oklch, var(--accent) 6%, var(--paper-2))', padding: 14, borderRadius: 6 }}>
                <div className="mono-meta mb-12">Outcome pricing structure</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                  <div>
                    <label className="field-label" style={{ fontSize: 11 }}>Base floor / creator</label>
                    <input type="number" min={0} step={100} value={outcomePricing.baseFloor} onChange={(e) => setOutcomePricing({ ...outcomePricing, baseFloor: Number(e.target.value) })} />
                  </div>
                  <div>
                    <label className="field-label" style={{ fontSize: 11 }}>$ per conversion</label>
                    <input type="number" min={1} step={1} value={outcomePricing.perConversion} onChange={(e) => setOutcomePricing({ ...outcomePricing, perConversion: Number(e.target.value) })} />
                  </div>
                  <div>
                    <label className="field-label" style={{ fontSize: 11 }}>Cap / creator</label>
                    <input type="number" min={500} step={500} value={outcomePricing.capPerCreator} onChange={(e) => setOutcomePricing({ ...outcomePricing, capPerCreator: Number(e.target.value) })} />
                  </div>
                </div>
                <div style={{ fontSize: 12, color: 'var(--ink-60)', marginTop: 10, lineHeight: 1.5 }}>
                  Each accepted creator earns <strong>${outcomePricing.baseFloor.toLocaleString()}</strong> minimum,
                  plus <strong>${outcomePricing.perConversion}</strong> per attributed conversion,
                  capped at <strong>${outcomePricing.capPerCreator.toLocaleString()}</strong>.
                  Conversion bonuses release as UTM-tracked sales clear.
                </div>

                {/* Phase 23: outcome forecast — sample conversion data from
                    past outcome campaigns to project a payout range. */}
                {(() => {
                  const f = forecastOutcome(db, category, outcomePricing);
                  return (
                    <div className="outcome-forecast">
                      <div className="outcome-forecast-h">
                        <span>Projected payout</span>
                        <span className="mono-meta">
                          {f.matchedCategory ? `${category} · ` : 'all categories · '}
                          {f.sampleCount} samples
                        </span>
                      </div>
                      <div className="outcome-forecast-bands">
                        <div className="outcome-forecast-band">
                          <div className="outcome-forecast-band-label">Low (p25)</div>
                          <div className="outcome-forecast-band-v">${f.perCreator.low.toLocaleString()}</div>
                          <div className="outcome-forecast-band-sub">per creator</div>
                          <div className="outcome-forecast-band-total">~ ${f.totalEstimate.low.toLocaleString()} total · {DEFAULT_ACCEPTED} creators</div>
                        </div>
                        <div className="outcome-forecast-band is-mid">
                          <div className="outcome-forecast-band-label">Median</div>
                          <div className="outcome-forecast-band-v">${f.perCreator.mid.toLocaleString()}</div>
                          <div className="outcome-forecast-band-sub">per creator</div>
                          <div className="outcome-forecast-band-total">~ ${f.totalEstimate.mid.toLocaleString()} total · {DEFAULT_ACCEPTED} creators</div>
                        </div>
                        <div className="outcome-forecast-band">
                          <div className="outcome-forecast-band-label">High (p75)</div>
                          <div className="outcome-forecast-band-v">${f.perCreator.high.toLocaleString()}</div>
                          <div className="outcome-forecast-band-sub">per creator</div>
                          <div className="outcome-forecast-band-total">~ ${f.totalEstimate.high.toLocaleString()} total · {DEFAULT_ACCEPTED} creators</div>
                        </div>
                      </div>
                      <ul className="outcome-forecast-reasons">
                        {f.reasons.map((r, i) => <li key={i}>{r}</li>)}
                      </ul>
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

          <div className="field full">
            <div style={{ background: 'var(--paper-2)', padding: 14, borderRadius: 6, fontSize: 13 }}>
              <div className="mono-meta mb-8">Wallet check</div>
              <div>Available balance: <strong>{fmtMoneyFull(brand.walletBalance)}</strong></div>
              <div>Budget: <strong>{fmtMoneyFull(budget)}</strong></div>
              <div className="mt-8 text-ink-60" style={{ fontSize: 12 }}>You don't need to fund the full budget upfront — escrow holds 50% per offer accept.</div>
            </div>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="form-grid">
          <div className="field full">
            <label className="field-label">Exclusivity</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {(['none', '30d', '60d', '90d'] as const).map((v) => (
                <button key={v} type="button" className={['tab', rights.exclusivity === v ? 'is-on' : ''].join(' ')} onClick={() => setRights({ ...rights, exclusivity: v })}>
                  {v === 'none' ? 'No restriction' : `${v} no competitors`}
                </button>
              ))}
            </div>
            <span className="field-help">Creator can't take work from competing brands during this window. Wider exclusivity = higher rate.</span>
          </div>

          <div className="field full">
            <label className="field-label">Repurpose rights</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {(['none', '90d', '180d', '365d', 'perpetual'] as const).map((v) => (
                <button key={v} type="button" className={['tab', rights.repurpose === v ? 'is-on' : ''].join(' ')} onClick={() => setRights({ ...rights, repurpose: v })}>
                  {v === 'none' ? 'Organic only' : v === 'perpetual' ? 'Perpetual' : `Re-use for ${v}`}
                </button>
              ))}
            </div>
            <span className="field-help">How long the brand can re-use this content on its own channels (website, ads, email).</span>
          </div>

          <div className="field full">
            <label className="field-label">Additional rights</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 }}>
              <label style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 14, cursor: 'pointer' }}>
                <input type="checkbox" style={{ width: 16, height: 16 }} checked={rights.whitelistAds} onChange={(e) => setRights({ ...rights, whitelistAds: e.target.checked })} />
                <span>
                  <strong>Whitelisted ads</strong>
                  <span style={{ color: 'var(--ink-60)', fontWeight: 400 }}> — brand can run paid ads on the creator's handle (typically +30–60% of base rate)</span>
                </span>
              </label>
              <label style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 14, cursor: 'pointer' }}>
                <input type="checkbox" style={{ width: 16, height: 16 }} checked={rights.derivative} onChange={(e) => setRights({ ...rights, derivative: e.target.checked })} />
                <span>
                  <strong>Derivative content</strong>
                  <span style={{ color: 'var(--ink-60)', fontWeight: 400 }}> — brand can edit, cut, or remix the deliverables</span>
                </span>
              </label>
              <label style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 14, cursor: 'pointer' }}>
                <input type="checkbox" style={{ width: 16, height: 16 }} checked={rights.organicOnly} onChange={(e) => setRights({ ...rights, organicOnly: e.target.checked, whitelistAds: e.target.checked ? false : rights.whitelistAds })} />
                <span>
                  <strong>Organic only</strong>
                  <span style={{ color: 'var(--ink-60)', fontWeight: 400 }}> — content posts to creator's channel without any paid amplification</span>
                </span>
              </label>
            </div>
          </div>

          <div className="field full">
            <div style={{ background: 'var(--paper-2)', padding: 14, borderRadius: 6, fontSize: 13, color: 'var(--ink-80)' }}>
              <strong>Rate guidance:</strong> base rate is 1×; whitelisting adds ~40%; derivative adds ~15%; perpetual repurpose adds ~25%. The creator decides their final rate when responding.
            </div>
          </div>
        </div>
      )}

      {step === 4 && (
        <div>
          <div style={{ display: 'flex', gap: 18 }}>
            <img src={cover} alt="" style={{ width: 160, height: 120, objectFit: 'cover', borderRadius: 6 }} />
            <div style={{ flex: 1 }}>
              <div className="mono-meta">Title</div>
              <div style={{ fontFamily: 'var(--serif)', fontSize: 24, marginTop: 4, marginBottom: 14 }}>{title || 'Untitled'}</div>
              <div className="mono-meta">Pitch</div>
              <div style={{ fontSize: 14, marginTop: 4 }}>{pitch || <span className="text-ink-60">—</span>}</div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, margin: '24px 0', borderTop: '1px solid var(--rule)', borderBottom: '1px solid var(--rule)', padding: '14px 0' }}>
            <div><div className="mono-meta">Budget</div><div style={{ fontFamily: 'var(--serif)', fontSize: 18, marginTop: 4 }}>{fmtMoneyFull(budget)}</div></div>
            <div><div className="mono-meta">Category</div><div style={{ fontSize: 14, marginTop: 6 }}>{category}</div></div>
            <div><div className="mono-meta">Region</div><div style={{ fontSize: 14, marginTop: 6 }}>{region}</div></div>
            <div><div className="mono-meta">Apply by</div><div style={{ fontSize: 14, marginTop: 6 }}>{deadline ? fmtDate(deadline) : '—'}</div></div>
          </div>

          <div className="mono-meta">Deliverables</div>
          <div style={{ fontSize: 14, marginTop: 4, marginBottom: 14 }}>{deliverables}</div>

          {pricingModel === 'outcome' && (
            <>
              <div className="mono-meta">Pricing model</div>
              <div style={{ fontSize: 13, marginTop: 4, marginBottom: 14, color: 'var(--ink-80)', lineHeight: 1.5 }}>
                <strong>Outcome-based.</strong> Base ${outcomePricing.baseFloor.toLocaleString()} + ${outcomePricing.perConversion}/conversion, capped at ${outcomePricing.capPerCreator.toLocaleString()} per creator.
              </div>
            </>
          )}

          {brief && <>
            <div className="mono-meta">Brief</div>
            <div style={{ fontSize: 13, marginTop: 4, color: 'var(--ink-80)', lineHeight: 1.5 }}>{brief}</div>
          </>}

          <div style={{ background: 'var(--paper-2)', padding: 14, borderRadius: 6, fontSize: 13, marginTop: 18 }}>
            <strong>Publish</strong> goes live immediately — creators can apply. <strong>Save as draft</strong> keeps it private until you're ready.
          </div>

          {/* Phase 23: Save-as-template — once the brand has dialed in a
              brief shape they like, save it for re-use. */}
          <div className="row-between" style={{ marginTop: 16, padding: '14px 0', borderTop: '1px solid var(--rule)' }}>
            <div>
              <div className="mono-meta">Run this often?</div>
              <div style={{ fontSize: 12, color: 'var(--ink-60)', marginTop: 2 }}>
                Save the current shape as a brand template — you'll see it in the picker on Step 1 next time.
              </div>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => { setSaveTplName(title || `${category} ${kind === 'retainer' ? 'retainer' : 'one-off'}`); setSaveTplOpen(true); }}
              icon={<Icon.spark s={12} />}
            >
              Save as template
            </Button>
          </div>
        </div>
      )}

      <AIBriefAssistantModal
        open={aiOpen}
        onClose={() => setAiOpen(false)}
        onApply={(g) => {
          setTitle(g.title);
          setPitch(g.pitch);
          setBrief(g.brief);
          setBudget(g.budget);
          setCategory(g.category);
          setRegion(g.region);
          setDeliverables(g.deliverables);
        }}
      />

      {/* Phase 23: Save-as-template dialog */}
      <Modal
        open={saveTplOpen}
        onClose={() => { setSaveTplOpen(false); setSaveTplName(''); }}
        title="Save as template"
        width={460}
        footer={<>
          <Button variant="ghost" onClick={() => { setSaveTplOpen(false); setSaveTplName(''); }}>Cancel</Button>
          <Button onClick={onSaveTemplate} disabled={!saveTplName.trim()} icon={<Icon.check s={14} />}>Save template</Button>
        </>}
      >
        <p style={{ margin: '0 0 14px', fontSize: 14, color: 'var(--ink-80)', lineHeight: 1.55 }}>
          Bookmark the current campaign's shape (brief, deliverables, rights, pricing).
          Up to 20 saved per brand. Editable from the Step 1 picker.
        </p>
        <div className="field full">
          <label className="field-label">Template name</label>
          <input
            type="text"
            value={saveTplName}
            onChange={(e) => setSaveTplName(e.target.value)}
            placeholder="e.g. Q3 launch playbook"
            autoFocus
            onKeyDown={(e) => { if (e.key === 'Enter' && saveTplName.trim()) { e.preventDefault(); onSaveTemplate(); } }}
          />
        </div>
      </Modal>
    </Modal>
  );
}
