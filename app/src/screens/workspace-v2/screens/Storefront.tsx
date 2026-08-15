// Storefront.tsx — v2 creator-side storefront editor
//
// Block-based public-page editor. Each block has an Edit toggle that
// flips it into form mode; Save commits via tx() through
// `v2CreatorActions`, and changes propagate to every surface that
// reads the live store (Discover, Home, Analytics, BrandHome outcome
// cards, kanban avatars, BriefDetail rate hint, etc.).
//
// Edit-mode contract per block:
//   - Edit pencil flips the block into form mode (per-block local state)
//   - Cancel reverts; Save fires the relevant mutation
//   - The read-only view re-renders from the live store after save

import { useEffect, useState } from 'react';
import { fmtUSD, fmtFollowers, Icon, PLATFORM_META, Topbar } from '../lib';
import {
  useV2AllCampaigns, useV2Creators, useV2CurrentCreator,
} from '../v2Hooks';
import { creatorToV2 } from '../v2Adapters';
import {
  v2UpdateCreatorIdentity, v2AddCreatorChannel, v2UpdateCreatorChannel,
  v2RemoveCreatorChannel, v2UpdateLegacyRateCard, v2AddPastBrand,
  v2RemovePastBrand, v2UpdateAvailability,
  v2AddWorkSample, v2RemoveWorkSample,
  v2AddPressMention, v2UpdatePressMention, v2RemovePressMention,
  v2PinReview, v2UnpinReview,
  COVER_PICKER_OPTIONS, AVATAR_PICKER_OPTIONS, WORK_PICKER_OPTIONS,
  ALL_PLATFORMS, ALL_CATEGORIES, COMMON_PRESS_OUTLETS,
} from '../v2CreatorActions';
import { useStore } from '@/lib/api/store';
import { Avatar } from '@/components/ui/Avatar';
import { pushToast } from '@/lib/utils/toast';
import { SwapFeaturedReviewModal } from './SwapFeaturedReviewModal';
import type { Creator, Platform, Availability, Review } from '@/lib/api/types';

interface Props {
  onRoute: (r: string) => void;
}

type EditableBlock =
  | 'identity'
  | 'channels'
  | 'packages'
  | 'work'
  | 'brands'
  | 'press'
  | 'reviews'
  | 'audience'
  | 'availability'
  | null;

export function Storefront({ onRoute }: Props) {
  const creator = useV2CurrentCreator();
  const allCreators = useV2Creators();
  const allCampaigns = useV2AllCampaigns();
  const db = useStore((s) => s.db);
  const [editing, setEditing] = useState<EditableBlock>(null);

  if (!creator) {
    return (
      <>
        <Topbar title="My storefront" crumb="No creator profile yet" />
        <div className="v2-content"><p className="v2-muted">No creator linked to this session.</p></div>
      </>
    );
  }
  const me = creatorToV2(creator, db);
  // Past collabs — campaigns where this creator is in acceptedCreators and stage=closed
  const pastCollabs = allCampaigns.filter(
    (c) => c.creators.includes(me.id) && c.status === 'Completed',
  );
  // Suppress unused-var warning (allCreators still useful for fallback)
  void allCreators;

  return (
    <>
      <Topbar
        title="My storefront"
        // Pre-fix this crumb appended a hardcoded "last updated 3 days
        // ago" suffix that stayed identical across every edit. Until we
        // track a real `Creator.updatedAt` field (would require bumping
        // it across ~10 mutation sites in v2CreatorActions), drop the
        // false suffix rather than show stale information.
        crumb={`alamut.co/@${me.handle}`}
        actions={
          <>
            <button
              className="v2-btn v2-btn-outline"
              type="button"
              onClick={() => onRoute(`public:${me.handle}`)}
            >
              {Icon.external}<span>View public</span>
            </button>
            <button
              className="v2-btn v2-btn-primary"
              type="button"
              onClick={() => onRoute('creator-home')}
            >
              <span>Done</span>
            </button>
          </>
        }
      />
      <div className="v2-content" style={{ maxWidth: 980 }}>
        {/* Cover + identity */}
        <IdentityBlock
          creator={creator}
          v2={me}
          editing={editing === 'identity'}
          onEdit={() => setEditing('identity')}
          onClose={() => setEditing(null)}
        />

        {/* Channels */}
        <ChannelsBlock
          creator={creator}
          editing={editing === 'channels'}
          onEdit={() => setEditing('channels')}
          onClose={() => setEditing(null)}
        />

        {/* Packages / rate card */}
        <PackagesBlock
          creator={creator}
          v2={me}
          editing={editing === 'packages'}
          onEdit={() => setEditing('packages')}
          onClose={() => setEditing(null)}
        />

        {/* Work portfolio — gallery of past work images */}
        <WorkBlock
          creator={creator}
          editing={editing === 'work'}
          onEdit={() => setEditing('work')}
          onClose={() => setEditing(null)}
        />

        {/* Past brands */}
        <BrandsBlock
          creator={creator}
          pastCollabs={pastCollabs}
          editing={editing === 'brands'}
          onEdit={() => setEditing('brands')}
          onClose={() => setEditing(null)}
        />

        {/* Press mentions */}
        <PressBlock
          creator={creator}
          editing={editing === 'press'}
          onEdit={() => setEditing('press')}
          onClose={() => setEditing(null)}
        />

        {/* Featured reviews — pin testimonials to the public storefront */}
        <ReviewsBlock
          creator={creator}
          editing={editing === 'reviews'}
          onEdit={() => setEditing('reviews')}
          onClose={() => setEditing(null)}
        />

        {/* Availability */}
        <AvailabilityBlock
          creator={creator}
          editing={editing === 'availability'}
          onEdit={() => setEditing('availability')}
          onClose={() => setEditing(null)}
        />

        {/* Audience snapshot — read-only. Honest framing: this is
            derived from the platforms you've added; refresh by
            re-verifying each channel. Pre-fix the tip didn't
            disclose the absence of an edit affordance. */}
        <Block
          label="Audience snapshot"
          tip="Aggregated from your connected channels. Update a channel's verified status to refresh — direct editing isn't supported (the data is meant to mirror your platform analytics, not be hand-tuned)."
        >
          {/* The tip above says this comes from connected channels, so when
              none report demographics the section has to say so. It used to
              render a fixed 60/40 · Lahore breakdown instead — permanently,
              for every real creator, since nothing outside the seed ever
              writes `Platform.audience`. */}
          {me.audience ? (
            <div className="v2-storefront-audience">
              <AudienceStat label="Female" value={`${me.audience.female}%`} bar={me.audience.female} />
              <AudienceStat label="Male" value={`${me.audience.male}%`} bar={me.audience.male} />
              <AudienceStat label="25–34 age band" value={`${me.audience.age2534}%`} bar={me.audience.age2534} />
              <AudienceStat label="Top city" value={me.audience.topCity} />
            </div>
          ) : (
            <p className="v2-muted" style={{ fontSize: 13, margin: 0, lineHeight: 1.6 }}>
              None of your channels report audience demographics yet. Brands
              see this section only once that data is available — until then
              your reach, engagement and past work do the work.
            </p>
          )}
        </Block>
      </div>
    </>
  );
}

// =====================================================================
// Block wrapper — shared chrome (head with eyebrow + tip + edit toggle)
// =====================================================================

function Block({
  label, tip, action, children,
}: {
  label: string;
  tip?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="v2-card v2-storefront-block">
      <div className="v2-storefront-block-head">
        <div>
          <div className="v2-eyebrow">{label}</div>
          {tip && <p className="v2-muted v2-storefront-block-tip">{tip}</p>}
        </div>
        <div className="v2-row" style={{ gap: 6 }}>{action}</div>
      </div>
      <div className="v2-storefront-block-body">{children}</div>
    </section>
  );
}

function EditButton({ onClick, label = 'Edit' }: { onClick: () => void; label?: string }) {
  return (
    <button className="v2-btn v2-btn-sm v2-btn-outline" type="button" onClick={onClick}>
      {Icon.edit} {label}
    </button>
  );
}

// =====================================================================
// IdentityBlock — name, handle, bio, city, categories, cover, avatar
// =====================================================================

function IdentityBlock({ creator, v2, editing, onEdit, onClose }: {
  creator: NonNullable<ReturnType<typeof useV2CurrentCreator>>;
  v2: ReturnType<typeof creatorToV2>;
  editing: boolean;
  onEdit: () => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(creator.name);
  const [handle, setHandle] = useState(creator.handle.replace(/^@/, ''));
  const [bio, setBio] = useState(creator.bio);
  const [city, setCity] = useState(creator.city);
  const [country, setCountry] = useState(creator.country);
  const [categories, setCategories] = useState<string[]>(creator.categories);
  const [portrait, setPortrait] = useState(creator.portrait);
  const [cover, setCover] = useState(creator.cover ?? v2.cover);

  // Reset local form whenever we re-enter edit mode (so cancel reverts)
  useEffect(() => {
    if (editing) {
      setName(creator.name);
      setHandle(creator.handle.replace(/^@/, ''));
      setBio(creator.bio);
      setCity(creator.city);
      setCountry(creator.country);
      setCategories(creator.categories);
      setPortrait(creator.portrait);
      setCover(creator.cover ?? v2.cover);
    }
  }, [editing, creator, v2.cover]);

  const toggleCategory = (cat: string) => {
    setCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat],
    );
  };

  return (
    <Block
      label="Cover & identity"
      tip="Brand teams see this first. Use a real photo, not a graphic."
      action={!editing ? <EditButton onClick={onEdit} /> : null}
    >
      <div
        className="v2-storefront-cover"
        style={{ backgroundImage: `url(${cover})` }}
      />
      <div className="v2-storefront-identity">
        {/* `Avatar`, not a raw background-image. New creators are seeded
            with `portrait: ''`, so `url()` resolved to nothing and the CSS
            has no background-color fallback — the avatar rendered as an
            invisible hole. `Avatar` exists precisely for this (its own
            comment records fixing ~25 such sites) and falls back to
            initials; it also sets role="img" so the accessible name is
            actually announced. */}
        <Avatar
          src={portrait}
          name={creator.name}
          size={96}
          className="v2-storefront-avatar"
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          {!editing ? (
            <>
              <div className="v2-row" style={{ gap: 8, alignItems: 'center', marginBottom: 4, flexWrap: 'wrap' }}>
                <h2 style={{
                  fontFamily: 'var(--v2-font-display)',
                  fontSize: 28,
                  fontWeight: 500,
                  letterSpacing: '-0.025em',
                  margin: 0,
                  color: 'var(--v2-ink)',
                }}>
                  {creator.name}
                </h2>
                {creator.verified && (
                  <span className="v2-pill v2-pill-moss" style={{ fontSize: 11 }}>
                    {Icon.check} Verified
                  </span>
                )}
              </div>
              <div className="v2-muted" style={{ fontSize: 13.5, marginBottom: 10 }}>
                @{v2.handle} · {creator.city}{creator.country ? `, ${creator.country}` : ''}
              </div>
              <p style={{ margin: 0, color: 'var(--v2-ink-2)', fontSize: 14, lineHeight: 1.55, maxWidth: 600 }}>
                {creator.bio || 'No bio yet — add one so brands know what you create.'}
              </p>
              <div style={{ display: 'flex', gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
                {creator.categories.map((cat) => (
                  <span key={cat} className="v2-pill v2-pill-accent">{cat}</span>
                ))}
              </div>
            </>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <FormField label="Display name">
                <input className="v2-input" value={name} onChange={(e) => setName(e.target.value)} />
              </FormField>

              <FormField label="Handle">
                <div className="v2-onboarding-handle">
                  <span className="v2-onboarding-handle-prefix">@</span>
                  <input
                    type="text"
                    value={handle}
                    onChange={(e) => setHandle(e.target.value.replace(/[^a-z0-9._]/gi, '').toLowerCase())}
                  />
                </div>
              </FormField>

              <FormField label="Bio · 1–2 sentences brands read first">
                <textarea
                  className="v2-input"
                  rows={3}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Who you are, what you make, why a brand should book you."
                />
              </FormField>

              <div className="v2-row" style={{ gap: 12 }}>
                <FormField label="City" style={{ flex: 1 }}>
                  <input className="v2-input" value={city} onChange={(e) => setCity(e.target.value)} />
                </FormField>
                <FormField label="Country" style={{ flex: 1 }}>
                  <input className="v2-input" value={country} onChange={(e) => setCountry(e.target.value)} />
                </FormField>
              </div>

              <FormField label="Categories">
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {ALL_CATEGORIES.map((cat) => {
                    const on = categories.includes(cat);
                    return (
                      <button
                        key={cat}
                        type="button"
                        className="v2-pill"
                        style={{
                          cursor: 'pointer',
                          border: '1px solid',
                          background: on ? 'var(--v2-accent)' : 'var(--v2-paper)',
                          color: on ? 'var(--v2-paper)' : 'var(--v2-ink-2)',
                          borderColor: on ? 'var(--v2-accent)' : 'var(--v2-line)',
                        }}
                        onClick={() => toggleCategory(cat)}
                      >{cat}</button>
                    );
                  })}
                </div>
              </FormField>

              <FormField label="Avatar">
                <div className="v2-row" style={{ gap: 8, flexWrap: 'wrap' }}>
                  {AVATAR_PICKER_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      className="v2-storefront-avatar-pick"
                      onClick={() => setPortrait(opt.url)}
                      style={{
                        backgroundImage: `url(${opt.url})`,
                        borderColor: portrait === opt.url ? 'var(--v2-accent)' : 'var(--v2-line)',
                        borderWidth: portrait === opt.url ? 3 : 1,
                      }}
                      aria-label="Pick this avatar"
                    />
                  ))}
                </div>
              </FormField>

              <FormField label="Cover banner">
                <div className="v2-row" style={{ gap: 8, flexWrap: 'wrap' }}>
                  {COVER_PICKER_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      className="v2-storefront-cover-pick"
                      onClick={() => setCover(opt.url)}
                      style={{
                        backgroundImage: `url(${opt.url})`,
                        borderColor: cover === opt.url ? 'var(--v2-accent)' : 'var(--v2-line)',
                        borderWidth: cover === opt.url ? 3 : 1,
                      }}
                      aria-label={opt.label}
                      title={opt.label}
                    />
                  ))}
                </div>
              </FormField>

              <div className="v2-row" style={{ gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
                <button className="v2-btn v2-btn-outline v2-btn-sm" type="button" onClick={onClose}>
                  Cancel
                </button>
                <button
                  className="v2-btn v2-btn-primary v2-btn-sm"
                  type="button"
                  onClick={() => {
                    const result = v2UpdateCreatorIdentity(creator.id, {
                      name, handle, bio, city, country, categories, portrait, cover,
                    });
                    if (result) {
                      pushToast('Storefront identity updated', 'good');
                      onClose();
                    } else {
                      pushToast('Update failed — refresh and try again', 'bad');
                    }
                  }}
                >
                  {Icon.check} Save changes
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </Block>
  );
}

// =====================================================================
// ChannelsBlock — add / edit / remove platform handles
// =====================================================================

function ChannelsBlock({ creator, editing, onEdit, onClose }: {
  creator: NonNullable<ReturnType<typeof useV2CurrentCreator>>;
  editing: boolean;
  onEdit: () => void;
  onClose: () => void;
}) {
  const [adding, setAdding] = useState(false);

  return (
    <Block
      label="Channels"
      // P-5 — this used to claim brands "cross-check follower + engagement
      // numbers against your linked profile", implying verification that
      // doesn't exist: these figures are self-entered and nothing checks
      // them. Say what's actually true, and why keeping them honest still
      // matters to the creator.
      tip="Add each platform you publish on. These figures are self-reported for now — brands see them as you enter them, so keep them accurate: a mismatch with your public profile is the fastest way to lose a deal."
      action={
        <>
          {editing && (
            <button
              className="v2-btn v2-btn-sm v2-btn-outline"
              type="button"
              onClick={() => setAdding(true)}
            >
              {Icon.plus} Add channel
            </button>
          )}
          <button
            className={`v2-btn v2-btn-sm ${editing ? 'v2-btn-primary' : 'v2-btn-outline'}`}
            type="button"
            onClick={() => {
              if (editing) onClose();
              else onEdit();
              setAdding(false);
            }}
          >
            {editing ? 'Done' : (<>{Icon.edit} Edit</>)}
          </button>
        </>
      }
    >
      <div className="v2-storefront-channels">
        {creator.platforms.map((ch, i) => (
          <ChannelRow
            key={`${ch.name}-${i}`}
            channel={ch}
            editing={editing}
            onSave={(changes) => v2UpdateCreatorChannel(creator.id, i, changes)}
            onRemove={() => v2RemoveCreatorChannel(creator.id, i)}
          />
        ))}
        {creator.platforms.length === 0 && !adding && (
          <div className="v2-muted" style={{ padding: 24, textAlign: 'center', fontSize: 13 }}>
            No channels yet. Add Instagram, TikTok, or any platform you create on.
          </div>
        )}
        {editing && adding && (
          <ChannelEditor
            initial={null}
            onSave={(channel) => {
              v2AddCreatorChannel(creator.id, channel);
              setAdding(false);
            }}
            onCancel={() => setAdding(false)}
          />
        )}
      </div>
    </Block>
  );
}

function ChannelRow({ channel, editing, onSave, onRemove }: {
  channel: Platform;
  editing: boolean;
  onSave: (changes: Partial<Platform>) => void;
  onRemove: () => void;
}) {
  const [open, setOpen] = useState(false);
  const meta = PLATFORM_META[channel.name.toLowerCase() as keyof typeof PLATFORM_META] ?? PLATFORM_META.instagram;

  if (open && editing) {
    return (
      <ChannelEditor
        initial={channel}
        onSave={(c) => { onSave(c); setOpen(false); }}
        onCancel={() => setOpen(false)}
      />
    );
  }

  return (
    <div className="v2-storefront-channel">
      <div
        className="v2-channel-icon"
        style={{ background: meta.color, width: 40, height: 40, borderRadius: 10 }}
      >{meta.icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600 }}>{channel.name}</div>
        <div className="v2-muted" style={{ fontSize: 12.5 }}>{channel.handle}</div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontFamily: 'var(--v2-font-display)', fontSize: 18, fontWeight: 500, letterSpacing: '-0.014em' }}>
          {fmtFollowers(channel.followers)}
        </div>
        <div className="v2-muted" style={{ fontSize: 11.5 }}>{channel.engagement}% ER</div>
      </div>
      {editing && (
        <div className="v2-row" style={{ gap: 4 }}>
          <button className="v2-btn v2-btn-sm v2-btn-ghost" type="button" onClick={() => setOpen(true)}>
            {Icon.edit}
          </button>
          <button
            className="v2-btn v2-btn-sm v2-btn-ghost"
            type="button"
            onClick={() => {
              if (window.confirm(`Remove ${channel.name}?`)) onRemove();
            }}
            aria-label="Remove"
            style={{ color: 'var(--v2-accent)' }}
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}

function ChannelEditor({ initial, onSave, onCancel }: {
  initial: Platform | null;
  onSave: (channel: Platform) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState<Platform['name']>(initial?.name ?? 'Instagram');
  const [handle, setHandle] = useState(initial?.handle ?? '');
  const [followers, setFollowers] = useState(initial?.followers ?? 0);
  const [engagement, setEngagement] = useState(initial?.engagement ?? 0);
  const valid = handle.trim().length > 0 && followers > 0;

  return (
    <div className="v2-card v2-card-pad" style={{ background: 'var(--v2-bg-1)' }}>
      <div className="v2-eyebrow" style={{ marginBottom: 10 }}>
        {initial ? `Edit ${initial.name}` : 'Add a new channel'}
      </div>
      <div className="v2-row" style={{ gap: 10, flexWrap: 'wrap' }}>
        <FormField label="Platform" style={{ flex: '1 1 140px', minWidth: 140 }}>
          <select
            className="v2-input"
            value={name}
            onChange={(e) => setName(e.target.value as Platform['name'])}
          >
            {ALL_PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </FormField>
        <FormField label="Handle" style={{ flex: '2 1 200px', minWidth: 0 }}>
          <input
            className="v2-input"
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
            placeholder={name === 'Newsletter' ? 'Newsletter name' : '@handle'}
          />
        </FormField>
      </div>
      <div className="v2-row" style={{ gap: 10, flexWrap: 'wrap', marginTop: 10 }}>
        <FormField label="Followers" style={{ flex: '1 1 140px' }}>
          <input
            className="v2-input"
            type="number"
            value={followers}
            onChange={(e) => setFollowers(parseInt(e.target.value || '0', 10))}
          />
        </FormField>
        <FormField label="Engagement %" style={{ flex: '1 1 140px' }}>
          <input
            className="v2-input"
            type="number"
            step="0.1"
            value={engagement}
            onChange={(e) => setEngagement(parseFloat(e.target.value || '0'))}
          />
        </FormField>
      </div>
      <div className="v2-row" style={{ gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
        <button className="v2-btn v2-btn-outline v2-btn-sm" type="button" onClick={onCancel}>
          Cancel
        </button>
        <button
          className="v2-btn v2-btn-primary v2-btn-sm"
          type="button"
          disabled={!valid}
          onClick={() => onSave({
            name, handle, followers, engagement, verified: initial?.verified ?? false,
          })}
        >
          {Icon.check} {initial ? 'Save' : 'Add channel'}
        </button>
      </div>
    </div>
  );
}

// =====================================================================
// PackagesBlock — edit Reel / Story / Post / Long-form rates
// =====================================================================

function PackagesBlock({ creator, v2, editing, onEdit, onClose }: {
  creator: NonNullable<ReturnType<typeof useV2CurrentCreator>>;
  v2: ReturnType<typeof creatorToV2>;
  editing: boolean;
  onEdit: () => void;
  onClose: () => void;
}) {
  const [reel, setReel] = useState(creator.rateCard.reel);
  const [story, setStory] = useState(creator.rateCard.story);
  const [post, setPost] = useState(creator.rateCard.post);
  const [longform, setLongform] = useState(creator.rateCard.longform);

  useEffect(() => {
    if (editing) {
      setReel(creator.rateCard.reel);
      setStory(creator.rateCard.story);
      setPost(creator.rateCard.post);
      setLongform(creator.rateCard.longform);
    }
  }, [editing, creator]);

  // Nothing in the rate card = nothing the creator has actually priced.
  // Pre-fix the four cards below rendered anyway, filled from `v2.priceMin`
  // / `v2.rate` / `v2.priceMax` — which, with no rate card to parse, fall
  // back to a flat tier default ($350 for a Rising creator). So a creator
  // who had never entered a price saw four packages quoting prices they'd
  // never set, and so did every brand looking at them.
  const hasRateCard = [
    creator.rateCard.reel, creator.rateCard.story,
    creator.rateCard.post, creator.rateCard.longform,
  ].some((r) => (r ?? '').trim().length > 0);

  return (
    <Block
      label="Packages & rates"
      tip="What you sell, at what price. Brand teams see this when they send offers."
      action={!editing ? <EditButton onClick={onEdit} /> : null}
    >
      {!editing && !hasRateCard ? (
        <div style={{ padding: '18px 0' }}>
          <p style={{ fontSize: 13.5, margin: '0 0 6px' }}>
            You haven't published any rates yet.
          </p>
          <p className="v2-muted" style={{ fontSize: 12.5, margin: '0 0 14px', lineHeight: 1.5 }}>
            Brands use these to decide whether to send you an offer — a range is
            enough, and you can still negotiate per deal.
          </p>
          <button className="v2-btn v2-btn-primary v2-btn-sm" type="button" onClick={onEdit}>
            {Icon.plus} Set your rates
          </button>
        </div>
      ) : !editing ? (
        <div className="v2-storefront-packages">
          <PackageCard
            title="Instagram Reel"
            sub="60–90s vertical · 1 round of revisions"
            price={v2.priceMin}
            rateText={creator.rateCard.reel}
            turnaround="3–5 days"
            recommended
          />
          <PackageCard
            title="Story bundle (×3)"
            sub="3 stories with link sticker · same-day shoot"
            price={Math.round(v2.priceMin * 0.8)}
            rateText={creator.rateCard.story}
            turnaround="2 days"
          />
          <PackageCard
            title="Reel + Stories combo"
            sub="1 Reel + 3 Stories · most popular"
            price={v2.rate}
            rateText={undefined}
            turnaround="5 days"
            popular
          />
          <PackageCard
            title="Long-form review"
            sub="3-min YouTube short · scripted"
            price={v2.priceMax}
            rateText={creator.rateCard.longform}
            turnaround="7–10 days"
          />
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <FormField label="Instagram Reel · price range" htmlFor="v2-rate-reel">
            <input id="v2-rate-reel" className="v2-input" value={reel} onChange={(e) => setReel(e.target.value)} placeholder="$300–500" />
          </FormField>
          <FormField label="Story bundle · price range" htmlFor="v2-rate-story">
            <input id="v2-rate-story" className="v2-input" value={story} onChange={(e) => setStory(e.target.value)} placeholder="$150–250" />
          </FormField>
          <FormField label="Static post · price range" htmlFor="v2-rate-post">
            <input id="v2-rate-post" className="v2-input" value={post} onChange={(e) => setPost(e.target.value)} placeholder="$200–400" />
          </FormField>
          <FormField label="Long-form video · price range" htmlFor="v2-rate-longform">
            <input id="v2-rate-longform" className="v2-input" value={longform} onChange={(e) => setLongform(e.target.value)} placeholder="$800–1,500" />
          </FormField>
          <div className="v2-muted" style={{ fontSize: 12 }}>
            Brand teams see these on your storefront. Free-form ranges work — e.g. "$300–500".
          </div>
          <div className="v2-row" style={{ gap: 8, justifyContent: 'flex-end' }}>
            <button className="v2-btn v2-btn-outline v2-btn-sm" type="button" onClick={onClose}>
              Cancel
            </button>
            <button
              className="v2-btn v2-btn-primary v2-btn-sm"
              type="button"
              onClick={() => {
                const result = v2UpdateLegacyRateCard(creator.id, { reel, story, post, longform });
                if (result) {
                  pushToast('Rate card updated', 'good');
                  onClose();
                } else {
                  pushToast('Rate update failed — refresh and try again', 'bad');
                }
              }}
            >
              {Icon.check} Save rates
            </button>
          </div>
        </div>
      )}
    </Block>
  );
}

function PackageCard({ title, sub, price, rateText, turnaround, recommended, popular }: {
  title: string;
  sub: string;
  price: number;
  rateText?: string;
  turnaround: string;
  recommended?: boolean;
  popular?: boolean;
}) {
  return (
    <div
      className="v2-storefront-package"
      style={recommended ? { borderColor: 'var(--v2-accent)' } : popular ? { background: 'var(--v2-accent-soft)' } : undefined}
    >
      <div className="v2-row" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
        <div style={{ fontSize: 14, fontWeight: 600 }}>{title}</div>
        {recommended && <span className="v2-pill v2-pill-accent" style={{ fontSize: 10 }}>Default</span>}
        {popular && <span className="v2-pill v2-pill-accent" style={{ fontSize: 10 }}>Most booked</span>}
      </div>
      <div className="v2-muted" style={{ fontSize: 12.5, marginBottom: 12, lineHeight: 1.45 }}>{sub}</div>
      <div className="v2-row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
        <div>
          <div style={{
            fontFamily: 'var(--v2-font-display)',
            fontSize: 22,
            fontWeight: 500,
            letterSpacing: '-0.022em',
            color: 'var(--v2-accent)',
          }}>
            {rateText || fmtUSD(price)}
          </div>
          <div className="v2-muted" style={{ fontSize: 11 }}>per piece</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className="v2-muted" style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
            Turnaround
          </div>
          <div style={{ fontSize: 13, fontWeight: 500 }}>{turnaround}</div>
        </div>
      </div>
    </div>
  );
}

// =====================================================================
// BrandsBlock — past clients (logo wall)
// =====================================================================

function BrandsBlock({ creator, pastCollabs, editing, onEdit, onClose }: {
  creator: NonNullable<ReturnType<typeof useV2CurrentCreator>>;
  pastCollabs: ReturnType<typeof useV2AllCampaigns>;
  editing: boolean;
  onEdit: () => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState('');

  return (
    <Block
      label="Past collaborations"
      tip="Logo wall + recent projects. Past work is the strongest signal of fit."
      action={
        <>
          <button
            className={`v2-btn v2-btn-sm ${editing ? 'v2-btn-primary' : 'v2-btn-outline'}`}
            type="button"
            onClick={editing ? onClose : onEdit}
          >
            {editing ? 'Done' : (<>{Icon.edit} Edit</>)}
          </button>
        </>
      }
    >
      <div className="v2-storefront-collabs">
        {creator.pastClients.map((b) => (
          <div key={b} className="v2-storefront-brand-mark" style={{ position: 'relative' }}>
            {b}
            {editing && (
              <button
                type="button"
                onClick={() => v2RemovePastBrand(creator.id, b)}
                aria-label={`Remove ${b}`}
                style={{
                  position: 'absolute',
                  top: -8, right: -8,
                  width: 18, height: 18, borderRadius: '50%',
                  background: 'var(--v2-accent)',
                  color: 'var(--v2-paper)',
                  border: 'none',
                  fontSize: 11, lineHeight: 1,
                  cursor: 'pointer',
                }}
              >×</button>
            )}
          </div>
        ))}
        {creator.pastClients.length === 0 && !editing && (
          <div className="v2-muted" style={{ fontSize: 13 }}>
            No past collaborations yet. Add brands you've worked with.
          </div>
        )}
      </div>
      {editing && (
        <div className="v2-row" style={{ gap: 8, marginTop: 12 }}>
          <input
            className="v2-input"
            placeholder="Brand name (e.g., Sapphire)"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && draft.trim()) {
                v2AddPastBrand(creator.id, draft);
                setDraft('');
              }
            }}
            style={{ flex: 1 }}
          />
          <button
            className="v2-btn v2-btn-primary v2-btn-sm"
            type="button"
            disabled={!draft.trim()}
            onClick={() => {
              v2AddPastBrand(creator.id, draft);
              setDraft('');
            }}
          >
            {Icon.plus} Add
          </button>
        </div>
      )}
      {pastCollabs.length > 0 && (
        <div className="v2-storefront-projects" style={{ marginTop: 16 }}>
          {pastCollabs.slice(0, 3).map((c) => (
            <div key={c.id} className="v2-storefront-project">
              <div className="v2-eyebrow" style={{ marginBottom: 4 }}>{c.brand}</div>
              <div style={{ fontFamily: 'var(--v2-font-display)', fontSize: 15, fontWeight: 500, letterSpacing: '-0.014em' }}>
                {c.name}
              </div>
              <div className="v2-muted" style={{ fontSize: 12, marginTop: 4 }}>
                {c.placement} · {fmtUSD(c.paid)} cleared
              </div>
            </div>
          ))}
        </div>
      )}
    </Block>
  );
}

// =====================================================================
// AvailabilityBlock — open / limited / booked
// =====================================================================

function AvailabilityBlock({ creator, editing, onEdit, onClose }: {
  creator: NonNullable<ReturnType<typeof useV2CurrentCreator>>;
  editing: boolean;
  onEdit: () => void;
  onClose: () => void;
}) {
  const initial: Availability = creator.availability ?? { status: 'open', note: '' };
  const [status, setStatus] = useState<Availability['status']>(initial.status);
  const [untilDate, setUntilDate] = useState(initial.untilDate ?? '');
  const [note, setNote] = useState(initial.note ?? '');
  const [vacationMode, setVacationMode] = useState<boolean>(initial.vacationMode ?? false);
  const [minRate, setMinRate] = useState<string>(
    initial.minRate !== undefined ? String(initial.minRate) : '',
  );
  const [autoDecline, setAutoDecline] = useState<string[]>(initial.autoDeclineCategories ?? []);

  useEffect(() => {
    if (editing) {
      setStatus(initial.status);
      setUntilDate(initial.untilDate ?? '');
      setNote(initial.note ?? '');
      setVacationMode(initial.vacationMode ?? false);
      setMinRate(initial.minRate !== undefined ? String(initial.minRate) : '');
      setAutoDecline(initial.autoDeclineCategories ?? []);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);

  const toggleAutoDecline = (cat: string) => {
    setAutoDecline((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat],
    );
  };

  const statusMeta: Record<Availability['status'], { label: string; color: string; tone: string }> = {
    open:    { label: 'Open',    color: 'var(--v2-moss)',    tone: 'v2-pill-moss' },
    limited: { label: 'Limited', color: 'var(--v2-gold)',    tone: 'v2-pill-draft' },
    booked:  { label: 'Booked',  color: 'var(--v2-accent)',  tone: 'v2-pill-live' },
  };

  return (
    <Block
      label="Availability & guardrails"
      tip="Status, vacation mode, minimum rate, and topics you don't take. Brands see all of this on your storefront and offer flow."
      action={!editing ? <EditButton onClick={onEdit} /> : null}
    >
      {!editing ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="v2-row" style={{ gap: 14, alignItems: 'center' }}>
            <span className={`v2-pill ${statusMeta[initial.status].tone}`} style={{ fontSize: 12 }}>
              {statusMeta[initial.status].label}
            </span>
            {initial.vacationMode && (
              <span className="v2-pill" style={{
                fontSize: 12,
                background: 'var(--v2-accent-soft)',
                color: 'var(--v2-accent)',
                border: '1px solid var(--v2-accent)',
              }}>
                ✈ Vacation mode
              </span>
            )}
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--v2-ink-2)' }}>
                {initial.note || (initial.status === 'open' ? 'Accepting new collabs.' : initial.status === 'limited' ? 'Selectively taking new work.' : 'Fully booked — not accepting.')}
              </div>
              {initial.untilDate && (
                <div className="v2-muted" style={{ fontSize: 11.5, marginTop: 2 }}>
                  Until {new Date(initial.untilDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </div>
              )}
            </div>
          </div>
          <div className="v2-row" style={{ gap: 12, fontSize: 12, color: 'var(--v2-ink-2)' }}>
            <span>
              <span className="v2-muted" style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, marginRight: 6 }}>
                Min rate
              </span>
              {initial.minRate !== undefined ? fmtUSD(initial.minRate) : '—'}
            </span>
            <span>
              <span className="v2-muted" style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, marginRight: 6 }}>
                Auto-decline
              </span>
              {(initial.autoDeclineCategories?.length ?? 0) > 0
                ? (initial.autoDeclineCategories ?? []).join(' · ')
                : '—'}
            </span>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <FormField label="Status">
            <div className="v2-segmented" style={{ width: '100%' }}>
              {(['open', 'limited', 'booked'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  className={`v2-segmented-btn ${status === s ? 'is-on' : ''}`}
                  onClick={() => setStatus(s)}
                  style={{ flex: 1 }}
                >
                  {statusMeta[s].label}
                </button>
              ))}
            </div>
          </FormField>

          {status !== 'open' && (
            <FormField label="Available again on">
              <input
                className="v2-input"
                type="date"
                value={untilDate}
                onChange={(e) => setUntilDate(e.target.value)}
              />
            </FormField>
          )}

          {/* Vacation mode toggle — distinct from `booked` because it
              means "I'm not even monitoring", not "fully scheduled". */}
          <FormField label="Vacation mode">
            <label
              className="v2-row"
              style={{
                gap: 12,
                padding: 12,
                background: vacationMode ? 'var(--v2-accent-soft)' : 'var(--v2-bg-1)',
                borderRadius: 10,
                border: `1px solid ${vacationMode ? 'var(--v2-accent)' : 'var(--v2-line)'}`,
                cursor: 'pointer',
                alignItems: 'flex-start',
              }}
            >
              <input
                type="checkbox"
                checked={vacationMode}
                onChange={(e) => setVacationMode(e.target.checked)}
                style={{ marginTop: 3, accentColor: 'var(--v2-accent)' }}
              />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 4 }}>
                  ✈ I'm on vacation
                </div>
                <div className="v2-muted" style={{ fontSize: 12, lineHeight: 1.45 }}>
                  Surfaces a clear "out of office" banner on your public storefront. Briefs and offers warn the brand that you're not actively monitoring — they can still apply, but with eyes open.
                </div>
              </div>
            </label>
          </FormField>

          {/* Minimum-rate floor */}
          <FormField label="Minimum acceptable rate (USD, optional)" htmlFor="v2-min-rate">
            <div className="v2-onboarding-rate">
              <span className="v2-onboarding-rate-prefix">$</span>
              <input
                id="v2-min-rate"
                type="number"
                min={0}
                step={50}
                value={minRate}
                onChange={(e) => setMinRate(e.target.value)}
                placeholder="e.g., 500"
              />
              <span className="v2-onboarding-rate-sub">floor</span>
            </div>
            <div className="v2-muted" style={{ fontSize: 11.5, marginTop: 6 }}>
              Brands sending offers below this see a warning. Your storefront also surfaces it as "From ${minRate || '—'}". Leave blank to disable.
            </div>
          </FormField>

          {/* Auto-decline categories */}
          <FormField label="Auto-decline these categories (optional)">
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {ALL_CATEGORIES.map((cat) => {
                const on = autoDecline.includes(cat);
                return (
                  <button
                    key={cat}
                    type="button"
                    className="v2-pill"
                    style={{
                      cursor: 'pointer',
                      border: '1px solid',
                      background: on ? 'var(--v2-accent)' : 'var(--v2-paper)',
                      color: on ? 'var(--v2-paper)' : 'var(--v2-ink-2)',
                      borderColor: on ? 'var(--v2-accent)' : 'var(--v2-line)',
                    }}
                    onClick={() => toggleAutoDecline(cat)}
                  >{cat}</button>
                );
              })}
            </div>
            <div className="v2-muted" style={{ fontSize: 11.5, marginTop: 6 }}>
              Briefs in these categories surface a "doesn't match your filters" warning. You can still apply if you want — this is advisory, not a hard block.
            </div>
          </FormField>

          <FormField label="Note for brands (optional)">
            <textarea
              className="v2-input"
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g., 'Back from break Aug 15. Email me before then for early bookings.'"
            />
          </FormField>

          <div className="v2-row" style={{ gap: 8, justifyContent: 'flex-end' }}>
            <button className="v2-btn v2-btn-outline v2-btn-sm" type="button" onClick={onClose}>
              Cancel
            </button>
            <button
              className="v2-btn v2-btn-primary v2-btn-sm"
              type="button"
              onClick={() => {
                const minRateNum = minRate.trim() === '' ? undefined : Math.max(0, parseInt(minRate, 10) || 0);
                v2UpdateAvailability(creator.id, {
                  status,
                  untilDate: untilDate || undefined,
                  note: note.trim() || undefined,
                  vacationMode: vacationMode || undefined,
                  minRate: minRateNum,
                  autoDeclineCategories: autoDecline.length > 0 ? autoDecline : undefined,
                });
                onClose();
              }}
            >
              {Icon.check} Save
            </button>
          </div>
        </div>
      )}
    </Block>
  );
}

// =====================================================================
// WorkBlock — gallery of past work (image URLs, creator.work[])
// =====================================================================
//
// Read mode: 3–4 column grid of square tiles. Edit mode: same grid with
// a × badge per tile, a curated picker pool below, and a paste-URL
// shortcut for arbitrary images. Each add/remove is atomic — no Save
// button. The public storefront's "Recent work" grid (PublicCreator.tsx)
// renders from the same array, so saves cascade immediately.

function WorkBlock({ creator, editing, onEdit, onClose }: {
  creator: NonNullable<ReturnType<typeof useV2CurrentCreator>>;
  editing: boolean;
  onEdit: () => void;
  onClose: () => void;
}) {
  const [pasteUrl, setPasteUrl] = useState('');
  const work = creator.work;

  return (
    <Block
      label="Work portfolio"
      tip="Visual proof — recent shoots, frames from past Reels, signature stills. Brands scan this before they read your bio."
      action={
        <button
          className={`v2-btn v2-btn-sm ${editing ? 'v2-btn-primary' : 'v2-btn-outline'}`}
          type="button"
          onClick={editing ? onClose : onEdit}
        >
          {editing ? 'Done' : (<>{Icon.edit} Edit</>)}
        </button>
      }
    >
      {work.length === 0 && !editing ? (
        <div className="v2-muted" style={{ fontSize: 13, padding: 16 }}>
          No work samples yet. Click <strong>Edit</strong> to add a few stills.
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
            gap: 10,
          }}
        >
          {work.map((url, i) => (
            <div
              key={`${url}-${i}`}
              style={{
                position: 'relative',
                paddingBottom: '100%',
                borderRadius: 10,
                overflow: 'hidden',
                background: `url(${url}) center/cover, var(--v2-bg-1)`,
                border: '1px solid var(--v2-line)',
              }}
            >
              {editing && (
                <button
                  type="button"
                  onClick={() => v2RemoveWorkSample(creator.id, i)}
                  aria-label={`Remove work sample ${i + 1}`}
                  style={{
                    position: 'absolute',
                    top: 6, right: 6,
                    width: 22, height: 22, borderRadius: '50%',
                    background: 'var(--v2-accent)',
                    color: 'var(--v2-paper)',
                    border: '2px solid var(--v2-paper)',
                    fontSize: 12, lineHeight: 1,
                    cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >×</button>
              )}
            </div>
          ))}
        </div>
      )}

      {editing && (
        <div style={{ marginTop: 16 }}>
          <div className="v2-eyebrow" style={{ marginBottom: 8 }}>Add from curated set</div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))',
              gap: 8,
            }}
          >
            {WORK_PICKER_OPTIONS.map((opt) => {
              const already = work.includes(opt.url);
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => { if (!already) v2AddWorkSample(creator.id, opt.url); }}
                  disabled={already}
                  aria-label={opt.label}
                  title={already ? 'Already in your portfolio' : opt.label}
                  style={{
                    paddingBottom: '100%',
                    borderRadius: 8,
                    border: `2px solid ${already ? 'var(--v2-moss)' : 'var(--v2-line)'}`,
                    background: `url(${opt.url}) center/cover, var(--v2-bg-1)`,
                    cursor: already ? 'default' : 'pointer',
                    opacity: already ? 0.4 : 1,
                    position: 'relative',
                  }}
                />
              );
            })}
          </div>
          <div className="v2-row" style={{ gap: 8, marginTop: 12 }}>
            <input
              className="v2-input"
              placeholder="…or paste an image URL"
              value={pasteUrl}
              onChange={(e) => setPasteUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && pasteUrl.trim()) {
                  v2AddWorkSample(creator.id, pasteUrl);
                  setPasteUrl('');
                }
              }}
              style={{ flex: 1 }}
            />
            <button
              className="v2-btn v2-btn-primary v2-btn-sm"
              type="button"
              disabled={!pasteUrl.trim()}
              onClick={() => {
                v2AddWorkSample(creator.id, pasteUrl);
                setPasteUrl('');
              }}
            >
              {Icon.plus} Add
            </button>
          </div>
        </div>
      )}
    </Block>
  );
}

// =====================================================================
// PressBlock — press mentions (creator.pressMentions[])
// =====================================================================
//
// Each entry is { source, title, year }. Read mode shows a tidy list;
// edit mode lets the creator add / inline-edit / remove each row, plus
// quick-pick chips for common outlets so they don't have to retype
// "Vogue" / "Forbes" / "Dawn".

function PressBlock({ creator, editing, onEdit, onClose }: {
  creator: NonNullable<ReturnType<typeof useV2CurrentCreator>>;
  editing: boolean;
  onEdit: () => void;
  onClose: () => void;
}) {
  const [draftSource, setDraftSource] = useState('');
  const [draftTitle, setDraftTitle] = useState('');
  const [draftYear, setDraftYear] = useState<number>(new Date().getFullYear());

  const submitDraft = () => {
    if (!draftSource.trim() || !draftTitle.trim()) return;
    v2AddPressMention(creator.id, {
      source: draftSource,
      title: draftTitle,
      year: draftYear,
    });
    setDraftSource('');
    setDraftTitle('');
  };

  return (
    <Block
      label="Press & mentions"
      tip="Outlets that have written about you. Builds editorial credibility — brands skim this fast."
      action={
        <button
          className={`v2-btn v2-btn-sm ${editing ? 'v2-btn-primary' : 'v2-btn-outline'}`}
          type="button"
          onClick={editing ? onClose : onEdit}
        >
          {editing ? 'Done' : (<>{Icon.edit} Edit</>)}
        </button>
      }
    >
      {creator.pressMentions.length === 0 && !editing && (
        <div className="v2-muted" style={{ fontSize: 13, padding: 16 }}>
          No press mentions yet. Click <strong>Edit</strong> to add the first.
        </div>
      )}

      {creator.pressMentions.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {creator.pressMentions.map((m, i) => (
            <PressRow
              key={`${m.source}-${m.title}-${i}`}
              creatorId={creator.id}
              index={i}
              mention={m}
              editing={editing}
              isLast={i === creator.pressMentions.length - 1}
            />
          ))}
        </div>
      )}

      {editing && (
        <div style={{
          marginTop: 16,
          padding: 12,
          background: 'var(--v2-bg-1)',
          borderRadius: 10,
        }}>
          <div className="v2-eyebrow" style={{ marginBottom: 8 }}>Add a mention</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
            {COMMON_PRESS_OUTLETS.map((outlet) => (
              <button
                key={outlet}
                type="button"
                className="v2-pill"
                style={{
                  cursor: 'pointer',
                  border: '1px solid',
                  background: draftSource === outlet ? 'var(--v2-accent)' : 'var(--v2-paper)',
                  color: draftSource === outlet ? 'var(--v2-paper)' : 'var(--v2-ink-2)',
                  borderColor: draftSource === outlet ? 'var(--v2-accent)' : 'var(--v2-line)',
                }}
                onClick={() => setDraftSource(outlet)}
              >{outlet}</button>
            ))}
          </div>
          <div className="v2-row" style={{ gap: 10, flexWrap: 'wrap' }}>
            <FormField label="Outlet" style={{ flex: '1 1 160px', minWidth: 0 }}>
              <input
                className="v2-input"
                value={draftSource}
                onChange={(e) => setDraftSource(e.target.value)}
                placeholder="e.g., Vogue, Dawn, TechCrunch"
              />
            </FormField>
            <FormField label="Article title" style={{ flex: '2 1 240px', minWidth: 0 }}>
              <input
                className="v2-input"
                value={draftTitle}
                onChange={(e) => setDraftTitle(e.target.value)}
                placeholder="e.g., '10 creators redefining lifestyle in 2026'"
                onKeyDown={(e) => { if (e.key === 'Enter') submitDraft(); }}
              />
            </FormField>
            <FormField label="Year" style={{ flex: '0 0 100px' }}>
              <input
                className="v2-input"
                type="number"
                min={2000}
                max={new Date().getFullYear() + 1}
                value={draftYear}
                onChange={(e) => setDraftYear(parseInt(e.target.value || '0', 10))}
              />
            </FormField>
          </div>
          <div className="v2-row" style={{ gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
            <button
              className="v2-btn v2-btn-primary v2-btn-sm"
              type="button"
              disabled={!draftSource.trim() || !draftTitle.trim()}
              onClick={submitDraft}
            >
              {Icon.plus} Add mention
            </button>
          </div>
        </div>
      )}
    </Block>
  );
}

function PressRow({ creatorId, index, mention, editing, isLast }: {
  creatorId: string;
  index: number;
  mention: { source: string; title: string; year: number };
  editing: boolean;
  isLast: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [source, setSource] = useState(mention.source);
  const [title, setTitle] = useState(mention.title);
  const [year, setYear] = useState<number>(mention.year);

  useEffect(() => {
    if (open) {
      setSource(mention.source);
      setTitle(mention.title);
      setYear(mention.year);
    }
  }, [open, mention]);

  if (open && editing) {
    return (
      <div
        style={{
          padding: 12,
          background: 'var(--v2-bg-1)',
          borderRadius: 10,
          marginBottom: isLast ? 0 : 8,
        }}
      >
        <div className="v2-row" style={{ gap: 10, flexWrap: 'wrap' }}>
          <FormField label="Outlet" style={{ flex: '1 1 160px', minWidth: 0 }}>
            <input className="v2-input" value={source} onChange={(e) => setSource(e.target.value)} />
          </FormField>
          <FormField label="Article title" style={{ flex: '2 1 240px', minWidth: 0 }}>
            <input className="v2-input" value={title} onChange={(e) => setTitle(e.target.value)} />
          </FormField>
          <FormField label="Year" style={{ flex: '0 0 100px' }}>
            <input
              className="v2-input"
              type="number"
              min={2000}
              max={new Date().getFullYear() + 1}
              value={year}
              onChange={(e) => setYear(parseInt(e.target.value || '0', 10))}
            />
          </FormField>
        </div>
        <div className="v2-row" style={{ gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
          <button className="v2-btn v2-btn-outline v2-btn-sm" type="button" onClick={() => setOpen(false)}>
            Cancel
          </button>
          <button
            className="v2-btn v2-btn-primary v2-btn-sm"
            type="button"
            onClick={() => {
              v2UpdatePressMention(creatorId, index, { source, title, year });
              setOpen(false);
            }}
          >
            {Icon.check} Save
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="v2-row"
      style={{
        padding: '12px 0',
        gap: 14,
        borderBottom: isLast ? 'none' : '1px solid var(--v2-line)',
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="v2-eyebrow" style={{ marginBottom: 2 }}>{mention.source}</div>
        <div style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--v2-ink)', lineHeight: 1.45 }}>
          {mention.title}
        </div>
      </div>
      <div className="v2-muted" style={{ fontSize: 12.5, fontFamily: 'var(--v2-font-display)' }}>
        {mention.year}
      </div>
      {editing && (
        <div className="v2-row" style={{ gap: 4 }}>
          <button
            className="v2-btn v2-btn-sm v2-btn-ghost"
            type="button"
            onClick={() => setOpen(true)}
            aria-label={`Edit ${mention.source} mention`}
          >
            {Icon.edit}
          </button>
          <button
            className="v2-btn v2-btn-sm v2-btn-ghost"
            type="button"
            onClick={() => {
              if (window.confirm(`Remove "${mention.title}" from ${mention.source}?`)) {
                v2RemovePressMention(creatorId, index);
              }
            }}
            aria-label={`Remove ${mention.source} mention`}
            style={{ color: 'var(--v2-accent)' }}
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}

// =====================================================================
// ReviewsBlock — pin/unpin brand reviews to the public storefront
// =====================================================================
//
// Brands can leave reviews on closed campaigns. By default the public
// storefront shows the most-recent four; this block lets the creator
// pin specific reviews so they always appear first (in pin order). Up
// to 4 pins; the rest fill chronologically.

function ReviewsBlock({ creator, editing, onEdit, onClose }: {
  creator: NonNullable<ReturnType<typeof useV2CurrentCreator>>;
  editing: boolean;
  onEdit: () => void;
  onClose: () => void;
}) {
  const db = useStore((s) => s.db);
  // P4 §3.2 — admin-hidden reviews are filtered out of the storefront
  // editor too. They stay in `db.reviews` for audit; the creator just
  // can't pin/feature what's been moderated out.
  const reviewsForMe: Review[] = db.reviews
    .filter((r) => r.reviewType === 'creator' && r.targetId === creator.id && !r.hidden)
    .sort((a, b) => +new Date(b.at) - +new Date(a.at));
  const featuredIds = creator.featuredReviewIds ?? [];
  const PIN_LIMIT = 4;
  // §3.3 — when at the cap, clicking Pin on a 5th review opens a swap
  // modal where the creator picks which existing pin to drop. State
  // holds the incoming review id; cleared on close or confirm.
  const [swapping, setSwapping] = useState<Review | null>(null);

  return (
    <Block
      label="Featured reviews"
      tip="Brand reviews surface in date order by default. Pin up to 4 to show first on your public storefront."
      action={
        <button
          className={`v2-btn v2-btn-sm ${editing ? 'v2-btn-primary' : 'v2-btn-outline'}`}
          type="button"
          onClick={editing ? onClose : onEdit}
        >
          {editing ? 'Done' : (<>{Icon.edit} Edit</>)}
        </button>
      }
    >
      {reviewsForMe.length === 0 ? (
        <div className="v2-muted" style={{ fontSize: 13, padding: 16 }}>
          No reviews yet. Once brands close campaigns with you, their reviews surface here for pinning.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {!editing && (
            <div className="v2-muted" style={{ fontSize: 12.5 }}>
              {featuredIds.length === 0
                ? `${reviewsForMe.length} review${reviewsForMe.length === 1 ? '' : 's'} · showing the latest 4 by date`
                : `${featuredIds.length} pinned · ${reviewsForMe.length - featuredIds.length} more shown by date`}
            </div>
          )}
          {reviewsForMe.map((r) => {
            const isPinned = featuredIds.includes(r.id);
            const pinIndex = featuredIds.indexOf(r.id);
            const pinFull = featuredIds.length >= PIN_LIMIT && !isPinned;
            const fromUser = db.users.find((u) => u.id === r.fromUserId);
            const brand = fromUser?.brandId ? db.brands.find((b) => b.id === fromUser.brandId) : null;
            const cmp = db.campaigns.find((c) => c.id === r.campaignId);
            return (
              <div
                key={r.id}
                style={{
                  padding: 12,
                  background: isPinned ? 'var(--v2-accent-soft)' : 'var(--v2-bg-1)',
                  border: isPinned ? '1px solid var(--v2-accent)' : '1px solid var(--v2-line)',
                  borderRadius: 10,
                  position: 'relative',
                }}
              >
                <div className="v2-row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="v2-row" style={{ gap: 8, alignItems: 'center', marginBottom: 4 }}>
                      <span style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: 'var(--v2-ink)',
                      }}>{brand?.name ?? 'Brand'}</span>
                      <span className="v2-muted" style={{ fontSize: 11.5 }}>
                        · {cmp?.title ?? 'Campaign'}
                      </span>
                      {isPinned && (
                        <span className="v2-pill v2-pill-accent" style={{ fontSize: 10 }}>
                          Pinned · #{pinIndex + 1}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 13.5, lineHeight: 1.55, color: 'var(--v2-ink-2)' }}>
                      "{r.text}"
                    </div>
                    <div className="v2-muted" style={{ fontSize: 11, marginTop: 6, fontFamily: 'var(--v2-font-display)' }}>
                      ★ {r.rating.toFixed(1)} · {new Date(r.at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                    </div>
                  </div>
                  {editing && (
                    <button
                      type="button"
                      className={`v2-btn v2-btn-sm ${isPinned ? 'v2-btn-primary' : 'v2-btn-outline'}`}
                      title={pinFull ? `You're at ${PIN_LIMIT} pins — pick which to swap out.` : undefined}
                      onClick={() => {
                        if (isPinned) v2UnpinReview(creator.id, r.id);
                        else if (pinFull) setSwapping(r);
                        else v2PinReview(creator.id, r.id);
                      }}
                    >
                      {isPinned ? 'Unpin' : (pinFull ? 'Swap pin' : 'Pin')}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {swapping && (
        <SwapFeaturedReviewModal
          creator={creator as Creator}
          incomingReview={swapping}
          onClose={() => setSwapping(null)}
        />
      )}
    </Block>
  );
}

// =====================================================================
// Shared form-field wrapper
// =====================================================================

function FormField({ label, htmlFor, children, style }: {
  label: string;
  /** id of the control this labels. Without it the <label> is a sibling with
   *  no association and the field is announced unnamed. */
  htmlFor?: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div style={style}>
      <label className="v2-eyebrow" htmlFor={htmlFor} style={{ display: 'block', marginBottom: 6 }}>{label}</label>
      {children}
    </div>
  );
}

function AudienceStat({ label, value, bar }: { label: string; value: string; bar?: number }) {
  return (
    <div className="v2-storefront-audience-stat">
      <div className="v2-row" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
        <span className="v2-muted" style={{ fontSize: 12.5 }}>{label}</span>
        <span style={{ fontWeight: 600, fontSize: 13 }}>{value}</span>
      </div>
      {bar != null && (
        <div className="v2-progress">
          <div className="v2-progress-fill" style={{ width: `${bar}%` }} />
        </div>
      )}
    </div>
  );
}
