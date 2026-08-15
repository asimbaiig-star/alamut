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

import { useEffect, useRef, useState } from 'react';
import { Icon, Topbar } from '../lib';
import { useV2CurrentBrand } from '../v2Hooks';
import { v2UpdateBrand } from '../v2CampaignActions';
import { useCapability } from '@/lib/permissions';
import { TeamAccessAside } from './TeamAccess';
import { pushToast } from '@/lib/utils/toast';
// Phase 2 — Supabase Storage uploads when configured. Falls back to
// inline base64 for the local-only dev setup.
import { isSupabaseConfigured } from '@/lib/supabase';
import { uploadBrandLogo, removeBrandLogo } from '@/lib/data/brandsRepo';

// Downscale + encode an uploaded image to a data URL. Demo app has no
// backend, so logos live inline in localStorage — 256×256 JPEG @ 0.85
// quality keeps a typical logo under 50 KB and well clear of the 5 MB
// localStorage budget.
async function downscaleToDataUrl(file: File, maxDim = 256): Promise<string> {
  const buf = await file.arrayBuffer();
  const blob = new Blob([buf], { type: file.type });
  const bitmap = await createImageBitmap(blob);
  // Preserve aspect ratio while fitting into a max×max box.
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');
  // Prefer JPEG (smaller) for photos; PNG if alpha matters (transparent
  // backgrounds common on logos). Decide via file type — PNG / WEBP →
  // PNG output; everything else → JPEG.
  const wantsAlpha = /png|webp|svg/i.test(file.type);
  if (!wantsAlpha) {
    // White paint behind to flatten transparency for JPEG.
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, w, h);
  }
  ctx.drawImage(bitmap, 0, 0, w, h);
  const mime = wantsAlpha ? 'image/png' : 'image/jpeg';
  return canvas.toDataURL(mime, 0.85);
}

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
  const [logoUrl, setLogoUrl] = useState<string | undefined>(brand?.logoUrl);
  const [logoUploading, setLogoUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
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
    setLogoUrl(brand.logoUrl);
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
    (logoUrl ?? '') !== (brand.logoUrl ?? '') ||
    !arraysEqual(categories, brand.preferredCategories ?? []) ||
    !arraysEqual(regions, brand.preferredRegions ?? []);

  const onSave = async () => {
    if (!canEdit || !dirty) return;
    setBusy(true);
    try {
      await v2UpdateBrand(brand.id, {
        name: name.trim() || brand.name,
        industry: industry.trim(),
        hq: hq.trim(),
        website: website.trim(),
        about: about.trim(),
        logoMark: (logoMark.trim() || undefined),
        logoUrl: logoUrl || undefined,
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
    setLogoUrl(brand.logoUrl);
    setCategories(brand.preferredCategories ?? []);
    setRegions(brand.preferredRegions ?? []);
  };

  // File-picker handler. Two paths depending on backend availability:
  //
  //   - Supabase configured: downscale, then upload as a real Blob to
  //     the `brand-logos` Storage bucket. The returned public URL is
  //     what we store on the brand row, so the logoUrl column ends up
  //     pointing at https://<project>.supabase.co/storage/v1/... not
  //     an inline data: URL. Vastly smaller payload everywhere.
  //
  //   - Supabase NOT configured (dev / no env vars): keep the original
  //     base64-in-localStorage behaviour so the app still works for
  //     contributors who haven't set up a Supabase project.
  //
  // In both paths the upload happens inline on file-pick so the user
  // sees the preview update immediately. The actual brand mutation
  // still fires on Save — this isolates the network spend (one
  // upload + one update) without polluting state otherwise.
  const onPickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-uploading the same file later
    if (!file) return;
    if (!/image\/(png|jpe?g|webp|gif|svg\+xml)/i.test(file.type)) {
      pushToast('Logo must be a PNG, JPEG, WEBP, GIF or SVG image', 'bad');
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      pushToast('Logo file is over 4 MB — pick a smaller one', 'bad');
      return;
    }
    setLogoUploading(true);
    try {
      if (isSupabaseConfigured() && brand) {
        // Downscale first so Storage doesn't have to host a 4 MB
        // original. Convert the resulting data URL back into a Blob
        // for the Storage upload (Supabase wants a Blob/File, not
        // a base64 string).
        const dataUrl = await downscaleToDataUrl(file);
        const blob = await (await fetch(dataUrl)).blob();
        const downscaled = new File([blob], file.name, { type: blob.type });
        const publicUrl = await uploadBrandLogo(brand.id, downscaled);
        setLogoUrl(publicUrl);
      } else {
        const dataUrl = await downscaleToDataUrl(file);
        setLogoUrl(dataUrl);
      }
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Could not upload that image', 'bad');
    } finally {
      setLogoUploading(false);
    }
  };

  const onRemoveLogo = () => {
    setLogoUrl(undefined);
    // Best-effort cleanup of the Storage object. Idempotent — if the
    // bucket has no matching file the API silently no-ops.
    if (isSupabaseConfigured() && brand) {
      void removeBrandLogo(brand.id);
    }
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
              <Field
                label="Logo"
                hint="PNG, JPEG, WEBP or SVG up to 4 MB. We downscale to 256×256 so the file stays small. If you don't upload anything, the letter fallback is used instead."
              >
                <div className="v2-row" style={{ gap: 14, alignItems: 'center' }}>
                  {/* Hidden native file input — triggered via the
                      labelled button so we can style it cleanly. */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
                    onChange={onPickFile}
                    style={{ display: 'none' }}
                    aria-label="Upload brand logo"
                  />
                  {/* Logo preview — image when set, letter fallback otherwise. */}
                  <div
                    style={{
                      width: 72,
                      height: 72,
                      borderRadius: 'var(--v2-r-md)',
                      background: logoUrl ? 'var(--v2-bg-1)' : 'var(--v2-ink)',
                      color: 'var(--v2-paper)',
                      display: 'grid',
                      placeItems: 'center',
                      fontFamily: 'var(--v2-font-display)',
                      fontWeight: 500,
                      fontSize: 32,
                      letterSpacing: '-0.02em',
                      border: '1px solid var(--v2-line)',
                      overflow: 'hidden',
                      flexShrink: 0,
                    }}
                    aria-hidden="true"
                  >
                    {logoUrl ? (
                      <img
                        src={logoUrl}
                        alt=""
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'contain',
                          background: 'var(--v2-paper)',
                        }}
                      />
                    ) : (
                      ((logoMark.trim() || name || 'B').charAt(0).toUpperCase())
                    )}
                  </div>
                  <div className="v2-row" style={{ gap: 8 }}>
                    <button
                      type="button"
                      className="v2-btn v2-btn-outline v2-btn-sm"
                      disabled={!canEdit || logoUploading}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      {Icon.plus}
                      {logoUploading ? 'Processing…' : logoUrl ? 'Replace logo' : 'Upload logo'}
                    </button>
                    {logoUrl && (
                      <button
                        type="button"
                        className="v2-btn v2-btn-ghost v2-btn-sm"
                        disabled={!canEdit}
                        onClick={onRemoveLogo}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              </Field>
              <Field label="Letter fallback" hint="Used when no logo image is uploaded. Defaults to the first letter of your name; override to use a different glyph (e.g. Æ for Aēsop).">
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
                    background: logoUrl ? 'var(--v2-paper)' : 'var(--v2-ink)',
                    color: 'var(--v2-paper)',
                    display: 'grid',
                    placeItems: 'center',
                    borderRadius: 'var(--v2-r-md)',
                    fontWeight: 500,
                    letterSpacing: '-0.02em',
                    border: logoUrl ? '1px solid var(--v2-line)' : 'none',
                    overflow: 'hidden',
                    flexShrink: 0,
                  }}
                  aria-hidden="true"
                >
                  {logoUrl ? (
                    <img
                      src={logoUrl}
                      alt=""
                      style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                    />
                  ) : (
                    logoChar
                  )}
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

            {/* Team access is brand-scoped but lived only inside a
                campaign's Settings tab, so a brand with no campaigns
                could not add a teammate at all — and the natural place
                to look for it, the brand profile, didn't have it. Same
                component, no second copy. */}
            <div style={{ marginTop: 16, display: 'flex' }}>
              <TeamAccessAside brandId={brand.id} />
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
