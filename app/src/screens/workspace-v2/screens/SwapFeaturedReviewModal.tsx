// SwapFeaturedReviewModal — §3.3
//
// Featured-review pins are capped at PIN_LIMIT (4). Pre-§3.3 the Pin
// button just went disabled at the cap with a tooltip — clearer-but-
// still-frustrating because the creator had to manually unpin one,
// scroll back, and re-click Pin on the new review.
//
// This modal collapses that into one decision: when the creator
// clicks Pin on the 5th review, this opens with the 4 currently-
// pinned reviews shown + a Confirm button. The creator picks which
// pin to drop; Confirm runs `v2UnpinReview(old)` and `v2PinReview(new)`
// in sequence — both are tx() mutations, so each is atomic and the
// store reflects the final state. (Sequential rather than one tx
// because the helpers are exported individually; the visible result
// is the same.)

import { useState } from 'react';
import { Icon } from '../lib';
import { v2PinReview, v2UnpinReview } from '../v2CreatorActions';
import { pushToast } from '@/lib/utils/toast';
import { useStore } from '@/lib/api/store';
import type { Creator, Review } from '@/lib/api/types';

interface Props {
  /** The creator whose pins we're managing. */
  creator: Creator;
  /** The review the user is trying to pin (the 5th one). */
  incomingReview: Review;
  /** Cancel — closes without changing anything. */
  onClose: () => void;
}

export function SwapFeaturedReviewModal({ creator, incomingReview, onClose }: Props) {
  const db = useStore((s) => s.db);
  const featuredIds = creator.featuredReviewIds ?? [];
  // Resolve pinned reviews in pin order so the visible list mirrors
  // the storefront ordering exactly. Filter out any orphans (a pin
  // pointing at a review that's been deleted) so the picker only
  // shows real swap targets.
  const pinned: Review[] = featuredIds
    .map((id) => db.reviews.find((r) => r.id === id))
    .filter((r): r is Review => Boolean(r));

  const [toUnpin, setToUnpin] = useState<string>(pinned[0]?.id ?? '');
  const [busy, setBusy] = useState(false);

  const incomingBrand = (() => {
    const u = db.users.find((x) => x.id === incomingReview.fromUserId);
    return u?.brandId ? db.brands.find((b) => b.id === u.brandId)?.name : undefined;
  })();
  const incomingCampaign = db.campaigns.find((c) => c.id === incomingReview.campaignId)?.title;

  const confirm = async () => {
    if (!toUnpin) {
      pushToast('Pick a pin to swap out', 'bad');
      return;
    }
    setBusy(true);
    try {
      v2UnpinReview(creator.id, toUnpin);
      v2PinReview(creator.id, incomingReview.id);
      pushToast('Pinned · swapped one out', 'good');
      onClose();
    } catch (e) {
      pushToast(e instanceof Error ? e.message : 'Swap failed', 'bad');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="v2-modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="swap-pin-title">
      <div
        className="v2-card v2-card-pad-lg v2-modal"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 560 }}
      >
        <h2
          id="swap-pin-title"
          style={{
            fontFamily: 'var(--v2-font-display)',
            fontSize: 24,
            fontWeight: 500,
            margin: '0 0 6px',
            letterSpacing: '-0.02em',
            color: 'var(--v2-ink)',
          }}
        >
          You've already pinned 4 reviews
        </h2>
        <p className="v2-muted" style={{ margin: '0 0 16px', fontSize: 13.5, lineHeight: 1.55 }}>
          Your storefront shows up to 4 pinned reviews. Pick one to swap out
          for the new one.
        </p>

        {/* Incoming review preview — what the creator is trying to pin */}
        <div
          style={{
            padding: 12,
            background: 'var(--v2-accent-soft)',
            border: '1px solid var(--v2-accent)',
            borderRadius: 10,
            marginBottom: 18,
          }}
        >
          <div className="v2-eyebrow" style={{ marginBottom: 6, color: 'var(--v2-accent)' }}>
            Pinning this review
          </div>
          <div style={{ fontSize: 13.5, lineHeight: 1.55, color: 'var(--v2-ink)', marginBottom: 6 }}>
            "{incomingReview.text}"
          </div>
          <div className="v2-muted" style={{ fontSize: 11.5 }}>
            {incomingBrand ?? 'Brand'} · {incomingCampaign ?? 'Campaign'} · ★ {incomingReview.rating.toFixed(1)}
          </div>
        </div>

        <div className="v2-eyebrow" style={{ marginBottom: 8 }}>
          Which currently-pinned review should I unpin?
        </div>
        <div role="radiogroup" aria-label="Currently pinned reviews" style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 18 }}>
          {pinned.map((r, i) => {
            const u = db.users.find((x) => x.id === r.fromUserId);
            const brand = u?.brandId ? db.brands.find((b) => b.id === u.brandId)?.name : undefined;
            const cmp = db.campaigns.find((c) => c.id === r.campaignId)?.title;
            const isOn = toUnpin === r.id;
            return (
              <label
                key={r.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '20px 1fr',
                  gap: 12,
                  padding: 12,
                  border: `1px solid ${isOn ? 'var(--v2-ink)' : 'var(--v2-line)'}`,
                  background: isOn ? 'var(--v2-bg-2)' : 'var(--v2-paper)',
                  borderRadius: 10,
                  cursor: 'pointer',
                }}
              >
                <input
                  type="radio"
                  name="swap-pin-target"
                  value={r.id}
                  checked={isOn}
                  onChange={() => setToUnpin(r.id)}
                  style={{ width: 18, height: 18 }}
                  aria-label={`Unpin ${brand ?? 'Brand'} · ${cmp ?? 'Campaign'}`}
                />
                <div style={{ minWidth: 0 }}>
                  <div className="v2-row" style={{ gap: 6, alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontSize: 12.5, fontWeight: 600 }}>
                      {brand ?? 'Brand'}
                    </span>
                    <span className="v2-muted" style={{ fontSize: 11 }}>· {cmp ?? 'Campaign'}</span>
                    <span
                      className="v2-pill v2-pill-accent"
                      style={{ fontSize: 10, marginLeft: 'auto' }}
                    >
                      Currently #{i + 1}
                    </span>
                  </div>
                  <div style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--v2-ink-2)' }}>
                    "{r.text}"
                  </div>
                  <div className="v2-muted" style={{ fontSize: 11, marginTop: 4 }}>
                    ★ {r.rating.toFixed(1)} · {new Date(r.at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                  </div>
                </div>
              </label>
            );
          })}
        </div>

        <div className="v2-row" style={{ justifyContent: 'flex-end', gap: 8 }}>
          <button className="v2-btn v2-btn-ghost" type="button" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button
            className="v2-btn v2-btn-primary"
            type="button"
            onClick={confirm}
            disabled={!toUnpin || busy}
          >
            {Icon.check} {busy ? 'Swapping…' : 'Swap pins'}
          </button>
        </div>
      </div>
    </div>
  );
}
