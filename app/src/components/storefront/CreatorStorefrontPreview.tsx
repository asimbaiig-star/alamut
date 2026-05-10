// CreatorStorefrontPreview — live preview pane shown next to the
// Creator Profile editor. Renders a calmer, airy-mode card that
// updates reactively as the form's draft state changes. Doesn't
// touch the store — receives all editable fields as props so the
// editor's local useState slices flow straight through.
//
// This is intentionally a *summary* preview, not the full storefront
// (the full storefront lives at /c/:handle). It shows the fields a
// creator is most likely editing right now: portrait, name, handle,
// tagline, bio, top 2 platforms, sample rate card. Click-through to
// the full storefront via the "Open full storefront ↗" link.

import { Link } from 'react-router-dom';
import { fmtCount } from '@/lib/utils/format';
import { Pill } from '@/components/ui/Pill';
import type { Creator, RateCardEntry } from '@/lib/api/types';

interface Props {
  /** The base creator record (for fields we don't edit in the form: rating, tier, work, etc.) */
  creator: Creator;
  /** Live draft fields from the editor's local form state. */
  draft: {
    name: string;
    handle: string;
    tagline: string;
    bio: string;
    city: string;
    country: string;
    cats: string[];
    rateCards: RateCardEntry[];
    /** Simple rate card fallback when no per-platform rows exist. */
    simpleRates: { post: string; reel: string; story: string; longform: string };
  };
}

export function CreatorStorefrontPreview({ creator, draft }: Props) {
  const handleClean = (draft.handle || creator.handle).replace(/^@/, '');
  const storefrontHref = `/c/${handleClean}`;
  const truncatedBio = draft.bio.length > 220 ? draft.bio.slice(0, 220).trim() + '…' : draft.bio;
  const topPlatforms = creator.platforms.slice(0, 2);
  const sampleRates = draft.rateCards.length > 0
    ? draft.rateCards.slice(0, 3)
    : null;

  return (
    <aside className="airy-card storefront-preview" aria-label="Storefront live preview">
      <div className="storefront-preview-head">
        <div className="airy-eyebrow">Live preview · what brands see</div>
        <Link
          to={storefrontHref}
          target="_blank"
          rel="noreferrer"
          className="storefront-preview-link"
        >
          Open full storefront ↗
        </Link>
      </div>

      <div className="storefront-preview-id">
        <img
          src={creator.portrait}
          alt=""
          className="storefront-preview-portrait"
          aria-hidden="true"
        />
        <div className="storefront-preview-id-text">
          <div className="airy-meta">{creator.tier}</div>
          <div className="storefront-preview-name">{draft.name || creator.name}</div>
          <div className="storefront-preview-handle">
            {(draft.handle || creator.handle).startsWith('@') ? draft.handle || creator.handle : `@${draft.handle || creator.handle}`}
            {(draft.city || draft.country) && (
              <> · {draft.city}{draft.city && draft.country ? ', ' : ''}{draft.country}</>
            )}
          </div>
        </div>
      </div>

      {draft.tagline && (
        <div className="storefront-preview-tagline">{draft.tagline}</div>
      )}

      {truncatedBio && (
        <p className="storefront-preview-bio">{truncatedBio}</p>
      )}

      {draft.cats.length > 0 && (
        <div className="storefront-preview-pills">
          {draft.cats.slice(0, 4).map((c) => <Pill key={c}>{c}</Pill>)}
        </div>
      )}

      {topPlatforms.length > 0 && (
        <div className="storefront-preview-block">
          <div className="airy-meta storefront-preview-block-h">Channels</div>
          <ul className="storefront-preview-platform-list">
            {topPlatforms.map((p) => (
              <li key={p.name}>
                <span className="storefront-preview-platform-name">{p.name}</span>
                <span className="storefront-preview-platform-meta">
                  {fmtCount(p.followers)} · {p.engagement}% eng
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="storefront-preview-block">
        <div className="airy-meta storefront-preview-block-h">Rate card</div>
        {sampleRates ? (
          <ul className="storefront-preview-rate-list">
            {sampleRates.map((r) => (
              <li key={r.id}>
                <span className="storefront-preview-rate-fmt">
                  {r.platform === 'All platforms' ? '' : `${r.platform} · `}
                  {r.format === 'longform' ? 'Long-form' : r.format[0].toUpperCase() + r.format.slice(1)}
                </span>
                <span className="storefront-preview-rate-amount">{r.rate || '—'}</span>
              </li>
            ))}
            {draft.rateCards.length > 3 && (
              <li className="storefront-preview-rate-more">
                +{draft.rateCards.length - 3} more on full storefront
              </li>
            )}
          </ul>
        ) : (
          <ul className="storefront-preview-rate-list">
            <li>
              <span className="storefront-preview-rate-fmt">Post</span>
              <span className="storefront-preview-rate-amount">{draft.simpleRates.post || '—'}</span>
            </li>
            <li>
              <span className="storefront-preview-rate-fmt">Reel</span>
              <span className="storefront-preview-rate-amount">{draft.simpleRates.reel || '—'}</span>
            </li>
            <li>
              <span className="storefront-preview-rate-fmt">Story</span>
              <span className="storefront-preview-rate-amount">{draft.simpleRates.story || '—'}</span>
            </li>
            <li>
              <span className="storefront-preview-rate-fmt">Long-form</span>
              <span className="storefront-preview-rate-amount">{draft.simpleRates.longform || '—'}</span>
            </li>
          </ul>
        )}
      </div>

      <div className="storefront-preview-foot">
        <span className="airy-meta">
          alamut.co/c/{handleClean}
        </span>
      </div>
    </aside>
  );
}
