// StorefrontHero · v2 design sync (§5.1)
//
// Cover image hero with avatar overlap + identity block. Mirrors the
// design file's Storefront component (creator-screens.jsx): full-width
// cover at 200px height, 96px portrait overlapping the bottom-left, then
// a `.v2-block` carrying name + tagline + bio + pills + actions.
//
// CTAs are passed in via the `actions` slot — router/clipboard/print
// handlers belong to the wrapper, not the section.

import type { ReactNode } from 'react';
import type { Creator, Database } from '@/lib/api/types';
import { TrustBadge } from '@/components/ui/TrustBadge';
import { trustForCreator } from '@/lib/utils/trust';
import { Icon } from '@/screens/workspace-v2/lib';
import { Avatar } from '@/components/ui/Avatar';

interface Props {
  creator: Creator;
  db: Database;
  mode: 'preview' | 'public';
  actions?: ReactNode;
}

export function StorefrontHero({ creator, db, actions }: Props) {
  const trust = trustForCreator(db, creator);
  const user = db.users.find((u) => u.id === creator.userId);
  const estYear = new Date(user?.createdAt || Date.now()).getFullYear();
  const avail = creator.availability;
  // Use the canonical `cover` if present; otherwise fall back to the
  // portrait so creators without a cover still render a hero. The v2
  // adapter generates a deterministic Unsplash cover for missing ones,
  // so this fallback rarely fires in practice.
  const coverUrl = creator.cover || creator.portrait;

  return (
    <>
      {/* Cover image — full bleed, hero rectangle. */}
      <div
        className="v2-storefront-cover"
        style={{ backgroundImage: `url(${coverUrl})` }}
        aria-hidden="true"
      />

      {/* Portrait — overlaps the cover bottom-left. */}
      {/* Same fix as the storefront editor — this one renders on the
          PUBLIC page, so an empty portrait was a blank hole on what a
          brand sees when evaluating a new creator. */}
      <Avatar
        src={creator.portrait}
        name={creator.name}
        size={104}
        className="v2-storefront-portrait"
      />

      {/* Identity block — name, handle, tagline, bio, pills, CTAs. */}
      <div className="v2-block">
        <div className="v2-row" style={{ gap: 8, marginBottom: 4, flexWrap: 'wrap', alignItems: 'center' }}>
          <h1 className="v2-storefront-display">{creator.name}</h1>
          {creator.verified && (
            <span className="v2-pill v2-pill-moss" style={{ fontSize: 11 }}>
              {Icon.check} Verified
            </span>
          )}
          <TrustBadge snapshot={trust} size="md" />
        </div>
        <div className="v2-muted" style={{ fontSize: 14, marginBottom: 6 }}>
          {creator.handle.startsWith('@') ? creator.handle : `@${creator.handle}`}
          {' · '}{creator.city}, {creator.country}
          {' · '}Est. {estYear}
        </div>
        {creator.tagline && (
          <div
            style={{
              fontSize: 15,
              fontWeight: 500,
              color: 'var(--v2-ink-2)',
              marginBottom: 12,
              fontStyle: 'italic',
            }}
          >
            {creator.tagline}
          </div>
        )}
        <p style={{ fontSize: 16, lineHeight: 1.55, margin: '0 0 14px', color: 'var(--v2-ink-2)' }}>
          {creator.bio}
        </p>
        <div className="v2-row" style={{ gap: 6, flexWrap: 'wrap', marginBottom: actions ? 18 : 0 }}>
          {avail && (
            <span
              className={`v2-pill ${avail.status === 'open' ? 'v2-pill-moss' : avail.status === 'limited' ? 'v2-pill-draft' : 'v2-pill-live'}`}
              style={{ fontSize: 11 }}
            >
              {avail.status === 'open'
                ? 'Open for work'
                : avail.status === 'limited'
                  ? 'Limited capacity'
                  : 'Booked'}
            </span>
          )}
          {avail?.minRate !== undefined && (
            <span className="v2-pill" style={{ fontSize: 11 }}>
              From ${avail.minRate.toLocaleString()}
            </span>
          )}
          {creator.categories.slice(0, 4).map((c) => (
            <span key={c} className="v2-pill v2-pill-accent" style={{ fontSize: 11 }}>{c}</span>
          ))}
        </div>
        {actions && (
          <div className="v2-row" style={{ gap: 8, flexWrap: 'wrap' }}>
            {actions}
          </div>
        )}
      </div>
    </>
  );
}
