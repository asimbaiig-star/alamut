// BrandProfilePreview — live preview pane shown next to the Brand
// Profile editor. Renders what creators see when they look up the
// brand on Alamut: logo or initial, name, industry, HQ, the about
// blurb, preferred categories + regions, social handles. Updates
// reactively as the editor's draft state changes.

import { Pill } from '@/components/ui/Pill';
import { Avatar } from '@/components/ui/Avatar';
import { fmtCount } from '@/lib/utils/format';
import type { Brand, BrandSocial } from '@/lib/api/types';

interface Props {
  brand: Brand;
  draft: {
    name: string;
    industry: string;
    hq: string;
    website: string;
    about: string;
    cats: string[];
    regions: string[];
    socials: BrandSocial[];
  };
}

export function BrandProfilePreview({ brand, draft }: Props) {
  const truncatedAbout = draft.about.length > 220
    ? draft.about.slice(0, 220).trim() + '…'
    : draft.about;
  const topSocials = draft.socials.slice(0, 3);

  return (
    <aside className="airy-card storefront-preview" aria-label="Brand profile live preview">
      <div className="storefront-preview-head">
        <div className="airy-eyebrow">Live preview · what creators see</div>
        {brand.verified && (
          <span className="airy-meta" style={{ color: 'var(--good)' }}>✓ Verified</span>
        )}
      </div>

      <div className="storefront-preview-id">
        {/* P65 — render uploaded logoUrl when present, fall back to the
            curated logoMark glyph or the first letter of the name. */}
        <Avatar
          src={brand.logoUrl}
          name={draft.name || brand.name}
          initial={brand.logoMark}
          size={56}
          shape="rounded"
          serif
        />
        <div className="storefront-preview-id-text">
          <div className="airy-meta">{draft.industry || brand.industry || 'Brand'}</div>
          <div className="storefront-preview-name">{draft.name || brand.name}</div>
          <div className="storefront-preview-handle">
            {draft.hq || brand.hq}
            {draft.website && (
              <> · {draft.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}</>
            )}
          </div>
        </div>
      </div>

      {truncatedAbout && (
        <p className="storefront-preview-bio">{truncatedAbout}</p>
      )}

      {draft.cats.length > 0 && (
        <div className="storefront-preview-block">
          <div className="airy-meta storefront-preview-block-h">Looking for</div>
          <div className="storefront-preview-pills">
            {draft.cats.slice(0, 6).map((c) => <Pill key={c}>{c}</Pill>)}
          </div>
        </div>
      )}

      {draft.regions.length > 0 && (
        <div className="storefront-preview-block">
          <div className="airy-meta storefront-preview-block-h">Regions</div>
          <div className="storefront-preview-pills">
            {draft.regions.map((r) => <Pill key={r}>{r}</Pill>)}
          </div>
        </div>
      )}

      {topSocials.length > 0 && (
        <div className="storefront-preview-block">
          <div className="airy-meta storefront-preview-block-h">Social</div>
          <ul className="storefront-preview-platform-list">
            {topSocials.map((s) => (
              <li key={s.name + s.handle}>
                <span className="storefront-preview-platform-name">{s.name}</span>
                <span className="storefront-preview-platform-meta">
                  {s.handle} · {fmtCount(s.followers)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="storefront-preview-foot">
        <span className="airy-meta">{(draft.name || brand.name).toLowerCase().replace(/\s+/g, '-')}.alamut.co</span>
      </div>
    </aside>
  );
}
