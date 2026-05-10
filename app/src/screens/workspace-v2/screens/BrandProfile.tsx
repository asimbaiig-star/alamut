// BrandProfile.tsx · v2 brand-side profile + settings
//
// What a brand admin sees when they want to configure how creators
// view them — logo letter, name, industry, headquarters, website,
// about copy, preferred categories + regions. Lives at route
// `brand-profile` and is reachable from the sidebar nav. Edits flow
// through `v2UpdateBrand` (gated on `campaign.update`), so finance
// + viewer team members see the form but can't save.
//
// This is the "brand-storefront equivalent" — the creator-side
// storefront editor and the brand-side profile editor are siblings
// in the surface taxonomy: both let one side configure how the other
// side perceives them.

import { useEffect, useState } from 'react';
import { Icon, Topbar } from '../lib';
import { useV2CurrentBrand } from '../v2Hooks';
import { v2UpdateBrand } from '../v2CampaignActions';
import { useCapability } from '@/lib/permissions';
import { pushToast } from '@/lib/utils/toast';

interface Props {
  onRoute: (r: string) => void;
}

const COMMON_CATEGORIES = [
  'Beauty', 'Fashion', 'Lifestyle', 'Wellness', 'Food',
  'Travel', 'Tech', 'Fitness', 'Finance', 'B2B',
  'Parenting', 'Sustainability', 'Design',
];

const COMMON_REGIONS = [
  'Global', 'North America', 'Europe', 'MENA', 'South Asia',
  'Southeast Asia', 'East Asia', 'Latin America', 'Africa',
];

export function BrandProfile({ onRoute }: Props) {
  const brand = useV2CurrentBrand();
  const canEdit = useCapability('campaign.update');

  // Local form state — edits stay in this component until Save fires
  // the mutation. `useEffect` re-syncs when the underlying brand
  // changes (e.g. another tab edited it) so the form stays accurate.
  const [name, setName] = useState(brand?.name ?? '');
  const [industry, setIndustry] = useState(brand?.industry ?? '');
  const [hq, setHq] = useState(brand?.hq ?? '');
  const [website, setWebsite] = useState(brand?.website ?? '');
  const [about, setAbout] = useState(brand?.about ?? '');
  const [logoMark, setLogoMark] = useState(brand?.logoMark ?? '');
  const [categories, setCategories] = useState<string[]>(brand?.preferredCategories ?? []);
  const [regions, setRegions] = useState<string[]>(brand?.preferredRegions ?? []);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!brand) return;
    setName(brand.name);
    setIndustry(brand.industry);
    setHq(brand.hq);
    setWebsite(brand.website);
    setAbout(brand.about);
    setLogoMark(brand.logoMark ?? '');
    setCategories(brand.preferredCategories ?? []);
    setRegions(brand.preferredRegions ?? []);
  }, [brand?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!brand) {
    return (
      <>
        <Topbar title="Brand profile" crumb="No brand profile" />
        <div className="v2-content"><p className="v2-muted">No brand linked to this session.</p></div>
      </>
    );
  }

  const dirty =
    name !== brand.name ||
    industry !== brand.industry ||
    hq !== brand.hq ||
    website !== brand.website ||
    about !== brand.about ||
    (logoMark || '') !== (brand.logoMark ?? '') ||
    !arraysEqual(categories, brand.preferredCategories ?? []) ||
    !arraysEqual(regions, brand.preferredRegions ?? []);

  const onSave = () => {
    if (!canEdit || !dirty) return;
    setBusy(true);
    try {
      v2UpdateBrand(brand.id, {
        name: name.trim() || brand.name,
        industry: industry.trim(),
        hq: hq.trim(),
        website: website.trim(),
        about: about.trim(),
        logoMark: (logoMark.trim() || undefined),
        preferredCategories: categories,
        preferredRegions: regions,
      });
      pushToast('Brand profile saved · creators will see the update', 'good');
    } catch (e) {
      pushToast(e instanceof Error ? e.message : 'Save failed', 'bad');
    } finally {
      setBusy(false);
    }
  };

  const onReset = () => {
    if (!brand) return;
    setName(brand.name);
    setIndustry(brand.industry);
    setHq(brand.hq);
    setWebsite(brand.website);
    setAbout(brand.about);
    setLogoMark(brand.logoMark ?? '');
    setCategories(brand.preferredCategories ?? []);
    setRegions(brand.preferredRegions ?? []);
  };

  const toggleCategory = (cat: string) => {
    setCategories((cs) => (cs.includes(cat) ? cs.filter((c) => c !== cat) : [...cs, cat]));
  };
  const toggleRegion = (reg: string) => {
    setRegions((rs) => (rs.includes(reg) ? rs.filter((r) => r !== reg) : [...rs, reg]));
  };

  // Logo letter — first character of the live form name (with a
  // logoMark override). Mirrors what creators see on Discover cards
  // and inside the brief.
  const logoChar = (logoMark.trim() || name || 'B').charAt(0).toUpperCase();

  return (
    <>
      <Topbar
        title="Brand profile"
        crumb="What creators see when they view your brand"
        actions={
          <>
            {dirty && (
              <button
                className="v2-btn v2-btn-ghost"
                type="button"
                onClick={onReset}
                disabled={busy}
              >
                Discard changes
              </button>
            )}
            <button
              className="v2-btn v2-btn-primary"
              type="button"
              onClick={onSave}
              disabled={!canEdit || !dirty || busy}
              title={!canEdit ? 'Saving requires admin or ops role' : undefined}
            >
              {Icon.check} {canEdit ? (busy ? 'Saving…' : 'Save changes') : 'Admin/ops only'}
            </button>
          </>
        }
      />
      <div className="v2-content" style={{ maxWidth: 900 }}>
        <div className="v2-row" style={{ gap: 24, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          {/* Form column */}
          <div style={{ flex: '2 1 480px', minWidth: 0 }}>
            <section className="v2-card v2-card-pad-lg" style={{ marginBottom: 16 }}>
              <h3 className="v2-section-title" style={{ marginBottom: 14 }}>Identity</h3>
              <Field label="Brand name">
                <input
                  className="v2-input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Aesop"
                />
              </Field>
              <Field label="Logo letter (optional override)" hint="Defaults to the first letter of your name. Override to use a different glyph (e.g. Æ for Aēsop).">
                <input
                  className="v2-input"
                  value={logoMark}
                  onChange={(e) => setLogoMark(e.target.value.slice(0, 2))}
                  placeholder="A"
                  maxLength={2}
                  style={{ maxWidth: 120 }}
                />
              </Field>
              <Field label="Industry">
                <input
                  className="v2-input"
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                  placeholder="Beauty / Personal care"
                />
              </Field>
              <Field label="Headquarters">
                <input
                  className="v2-input"
                  value={hq}
                  onChange={(e) => setHq(e.target.value)}
                  placeholder="Melbourne, AU"
                />
              </Field>
              <Field label="Website" hint="Public homepage. Shown on the brand profile creators see.">
                <input
                  className="v2-input"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  placeholder="aesop.com"
                />
              </Field>
            </section>

            <section className="v2-card v2-card-pad-lg" style={{ marginBottom: 16 }}>
              <h3 className="v2-section-title" style={{ marginBottom: 14 }}>About</h3>
              <p className="v2-muted" style={{ fontSize: 13, margin: '0 0 12px' }}>
                Short description shown on the brand profile and inside the brief
                detail view. Creators read this when deciding whether to apply.
              </p>
              <textarea
                className="v2-input"
                rows={4}
                value={about}
                onChange={(e) => setAbout(e.target.value)}
                placeholder="Aesop has carefully curated a range of skin, hair and body care formulations."
              />
              <div className="v2-muted" style={{ fontSize: 11, marginTop: 6 }}>
                {about.length} / 400 characters
              </div>
            </section>

            <section className="v2-card v2-card-pad-lg" style={{ marginBottom: 16 }}>
              <h3 className="v2-section-title" style={{ marginBottom: 4 }}>Preferred categories</h3>
              <p className="v2-muted" style={{ fontSize: 13, margin: '0 0 14px' }}>
                Drives Discover match-scoring + Spark recommendations.
                Creators with at least one matching category get a higher
                match score on your briefs.
              </p>
              <div className="v2-row" style={{ gap: 6, flexWrap: 'wrap' }}>
                {COMMON_CATEGORIES.map((cat) => {
                  const on = categories.includes(cat);
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => toggleCategory(cat)}
                      className={`v2-pill ${on ? 'v2-pill-accent' : ''}`}
                      style={{
                        cursor: 'pointer',
                        background: on ? 'var(--v2-accent)' : 'transparent',
                        color: on ? 'var(--v2-paper)' : 'var(--v2-ink-2)',
                        border: `1px solid ${on ? 'var(--v2-accent)' : 'var(--v2-line)'}`,
                        fontSize: 12,
                      }}
                    >
                      {on ? '✓ ' : ''}{cat}
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="v2-card v2-card-pad-lg">
              <h3 className="v2-section-title" style={{ marginBottom: 4 }}>Preferred regions</h3>
              <p className="v2-muted" style={{ fontSize: 13, margin: '0 0 14px' }}>
                Where your audience lives. Creators in these regions
                surface higher in your shortlist.
              </p>
              <div className="v2-row" style={{ gap: 6, flexWrap: 'wrap' }}>
                {COMMON_REGIONS.map((reg) => {
                  const on = regions.includes(reg);
                  return (
                    <button
                      key={reg}
                      type="button"
                      onClick={() => toggleRegion(reg)}
                      className="v2-pill"
                      style={{
                        cursor: 'pointer',
                        background: on ? 'var(--v2-moss)' : 'transparent',
                        color: on ? 'var(--v2-paper)' : 'var(--v2-ink-2)',
                        border: `1px solid ${on ? 'var(--v2-moss)' : 'var(--v2-line)'}`,
                        fontSize: 12,
                      }}
                    >
                      {on ? '✓ ' : ''}{reg}
                    </button>
                  );
                })}
              </div>
            </section>
          </div>

          {/* Live preview column — what creators see when they view
              this brand. Updates as the form changes so the brand can
              see their edits before hitting Save. */}
          <aside style={{ flex: '1 1 280px', position: 'sticky', top: 24 }}>
            <div className="v2-card v2-card-pad" style={{ marginBottom: 16 }}>
              <div className="v2-eyebrow" style={{ marginBottom: 10 }}>Creator-side preview</div>
              <div className="v2-row" style={{ gap: 12, marginBottom: 14 }}>
                <div
                  className="v2-brand-mark-lg"
                  style={{
                    width: 56,
                    height: 56,
                    fontSize: 28,
                    fontFamily: 'var(--v2-font-display)',
                    background: 'var(--v2-ink)',
                    color: 'var(--v2-paper)',
                    display: 'grid',
                    placeItems: 'center',
                    borderRadius: 'var(--v2-r-md)',
                    fontWeight: 500,
                    letterSpacing: '-0.02em',
                  }}
                  aria-hidden="true"
                >
                  {logoChar}
                </div>
                <div>
                  <div style={{
                    fontFamily: 'var(--v2-font-display)',
                    fontSize: 18,
                    fontWeight: 500,
                    letterSpacing: '-0.014em',
                  }}>
                    {name || 'Brand name'}
                  </div>
                  <div className="v2-muted" style={{ fontSize: 12 }}>
                    {industry || 'Industry'}
                  </div>
                </div>
              </div>
              <p style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--v2-ink-2)', margin: '0 0 12px' }}>
                {about || 'Your about copy will appear here.'}
              </p>
              <div className="v2-muted" style={{ fontSize: 12, marginBottom: 4 }}>
                {hq || 'Headquarters'}
              </div>
              {website && (
                <div className="v2-muted" style={{ fontSize: 12, fontFamily: 'var(--v2-font-mono)' }}>
                  {website}
                </div>
              )}
              {(categories.length > 0 || regions.length > 0) && (
                <div style={{ marginTop: 14, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {categories.slice(0, 4).map((c) => (
                    <span key={c} className="v2-pill v2-pill-accent" style={{ fontSize: 10 }}>{c}</span>
                  ))}
                  {regions.slice(0, 3).map((r) => (
                    <span key={r} className="v2-pill v2-pill-moss" style={{ fontSize: 10 }}>{r}</span>
                  ))}
                </div>
              )}
              <div style={{
                marginTop: 14,
                paddingTop: 14,
                borderTop: '1px solid var(--v2-line)',
                fontSize: 11,
                color: 'var(--v2-ink-3)',
              }}>
                Live updates as you edit · saved when you hit Save
              </div>
            </div>

            <div className="v2-card v2-card-pad">
              <div className="v2-eyebrow" style={{ marginBottom: 8 }}>Verification</div>
              <div className="v2-row" style={{ gap: 8, alignItems: 'center' }}>
                <span className={`v2-pill ${brand.verified ? 'v2-pill-moss' : 'v2-pill-draft'}`} style={{ fontSize: 11 }}>
                  {brand.verified ? '✓ Verified' : 'Unverified'}
                </span>
                {!brand.verified && (
                  <span className="v2-muted" style={{ fontSize: 11.5 }}>
                    Verify to unlock cold outreach
                  </span>
                )}
              </div>
              <div className="v2-muted" style={{ fontSize: 11.5, marginTop: 12, lineHeight: 1.5 }}>
                Verification is handled by the Alamut admin team. Submit a
                verification request from{' '}
                <button type="button" className="v2-link-btn" onClick={() => onRoute('inbox')}>
                  the support inbox
                </button>.
              </div>
            </div>
          </aside>
        </div>
      </div>
    </>
  );
}

function Field({
  label, hint, children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label className="v2-eyebrow" style={{ display: 'block', marginBottom: 6 }}>
        {label}
      </label>
      {children}
      {hint && (
        <div className="v2-muted" style={{ fontSize: 11, marginTop: 4, lineHeight: 1.45 }}>
          {hint}
        </div>
      )}
    </div>
  );
}

function arraysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sa = [...a].sort();
  const sb = [...b].sort();
  return sa.every((v, i) => v === sb[i]);
}
