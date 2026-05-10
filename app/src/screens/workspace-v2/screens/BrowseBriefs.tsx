// BrowseBriefs.tsx — v2 creator-side brief marketplace
//
// The creator counterpart to brand Discover: live campaigns the
// creator can apply to. Card grid + simple filters (status, category,
// fit-for-me toggle).

import { useMemo, useState } from 'react';
import { fmtUSD, Icon, Topbar } from '../lib';
import { type V2Campaign } from '../data';
import { useV2AllCampaigns, useV2CurrentCreator } from '../v2Hooks';
import { pushToast } from '@/lib/utils/toast';

interface Props {
  onRoute: (r: string) => void;
}

export function BrowseBriefs({ onRoute }: Props) {
  // P1b §1.2: 'Active' was dropped (it conflated per-collab progress with
  // campaign-level state). 'Live' is the only "currently accepting" filter.
  const [status, setStatus] = useState<'all' | 'Live' | 'Planned'>('all');
  const [fitOnly, setFitOnly] = useState(false);
  const me = useV2CurrentCreator();
  const allCampaigns = useV2AllCampaigns();

  const briefs = useMemo(() => {
    let r = allCampaigns.slice();
    if (status !== 'all') r = r.filter((c) => c.status === status);
    if (fitOnly && me) {
      // "Fit for me" = creator is in the roster OR shortlisted.
      r = r.filter((c) => c.creators.includes(me.id));
    }
    // Hide Completed by default since they're not actionable
    r = r.filter((c) => c.status !== 'Completed');
    // Newest-first so freshly-posted briefs surface at the top.
    r.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
    return r;
  }, [allCampaigns, status, fitOnly, me]);

  const liveCount = allCampaigns.filter((c) => c.status === 'Live').length;

  return (
    <>
      <Topbar
        title="Campaigns"
        crumb={`${liveCount} live · matching your audience`}
        actions={
          <button
            className="v2-btn v2-btn-outline"
            type="button"
            onClick={() => pushToast('Saved searches coming soon — pin filters with the Fit-for-me toggle for now', 'default')}
          >
            {Icon.filter} Saved searches
          </button>
        }
      />
      <div className="v2-content">
        {/* Filter bar */}
        <div className="v2-card" style={{ padding: 16, marginBottom: 20 }}>
          <div className="v2-row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <FilterPill
              label="All briefs"
              active={status === 'all'}
              onClick={() => setStatus('all')}
            />
            <FilterPill
              label="Live"
              active={status === 'Live'}
              onClick={() => setStatus('Live')}
              dot="var(--v2-accent)"
            />
            <FilterPill
              label="Coming soon"
              active={status === 'Planned'}
              onClick={() => setStatus('Planned')}
              dot="var(--v2-ink-3)"
            />
            <span className="v2-spacer" />
            <label
              className="v2-row"
              style={{
                gap: 8,
                fontSize: 13,
                padding: '6px 12px',
                background: fitOnly ? 'var(--v2-accent-soft)' : 'var(--v2-bg-2)',
                border: `1px solid ${fitOnly ? 'var(--v2-accent)' : 'var(--v2-line)'}`,
                color: fitOnly ? 'var(--v2-accent)' : 'var(--v2-ink-2)',
                borderRadius: 'var(--v2-r-pill)',
                cursor: 'pointer',
                fontWeight: 500,
                transition: 'all 0.12s',
              }}
            >
              <input
                type="checkbox"
                checked={fitOnly}
                onChange={(e) => setFitOnly(e.target.checked)}
                style={{ margin: 0 }}
              />
              <span>Fit for me</span>
            </label>
          </div>
        </div>

        <div className="v2-row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
          <div className="v2-muted">
            {briefs.length} {briefs.length === 1 ? 'campaign' : 'campaigns'} · ranked by fit
          </div>
        </div>

        {briefs.length > 0 ? (
          <div className="v2-grid-2">
            {briefs.map((c) => (
              <BriefCard
                key={c.id}
                campaign={c}
                isInRoster={!!me && c.creators.includes(me.id)}
                onApply={() => onRoute(`brief:${c.id}`)}
              />
            ))}
          </div>
        ) : (
          <div className="v2-card v2-card-pad-lg" style={{ textAlign: 'center' }}>
            <div className="v2-muted">No campaigns match — try widening filters.</div>
          </div>
        )}
      </div>
    </>
  );
}

function FilterPill({ label, active, onClick, dot }: {
  label: string;
  active: boolean;
  onClick: () => void;
  dot?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '6px 12px',
        background: active ? 'var(--v2-ink)' : 'var(--v2-paper)',
        color: active ? 'var(--v2-paper)' : 'var(--v2-ink-2)',
        border: `1px solid ${active ? 'var(--v2-ink)' : 'var(--v2-line)'}`,
        borderRadius: 'var(--v2-r-pill)',
        fontSize: 13,
        fontWeight: 500,
        cursor: 'pointer',
        fontFamily: 'inherit',
        transition: 'all 0.12s',
      }}
    >
      {dot && (
        <span style={{
          width: 6, height: 6, borderRadius: '50%',
          background: dot,
        }} />
      )}
      {label}
    </button>
  );
}

function BriefCard({ campaign, isInRoster, onApply }: {
  campaign: V2Campaign;
  isInRoster: boolean;
  onApply: () => void;
}) {
  const daysLeft = Math.max(
    0,
    Math.ceil((+new Date(campaign.deadline) - Date.now()) / 86_400_000),
  );

  return (
    <article className="v2-card v2-card-pad">
      <div className="v2-row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
        <span
          className={`v2-pill ${campaign.status === 'Live' ? 'v2-pill-live' : 'v2-pill-draft'}`}
        >
          {campaign.status}
        </span>
        <span className="v2-muted" style={{ fontSize: 12 }}>{campaign.brand}</span>
      </div>

      <h3 style={{
        fontFamily: 'var(--v2-font-display)',
        fontSize: 22,
        fontWeight: 500,
        letterSpacing: '-0.022em',
        margin: '4px 0 8px',
        color: 'var(--v2-ink)',
      }}>
        {campaign.name}
      </h3>

      <p className="v2-muted" style={{
        fontSize: 13.5,
        lineHeight: 1.5,
        margin: '0 0 14px',
        display: '-webkit-box',
        WebkitLineClamp: 2,
        WebkitBoxOrient: 'vertical',
        overflow: 'hidden',
      }}>
        {campaign.brief}
      </p>

      <div className="v2-row" style={{ gap: 14, fontSize: 12.5, marginBottom: 14, flexWrap: 'wrap' }}>
        <Meta label="Placement" value={campaign.placement} />
        <Meta label="Deadline" value={daysLeft > 0 ? `${daysLeft}d left` : 'Ended'} />
        <Meta label="Budget" value={fmtUSD(campaign.budget)} accent />
      </div>

      {isInRoster ? (
        <div className="v2-row" style={{ justifyContent: 'space-between', paddingTop: 14, borderTop: '1px solid var(--v2-line)' }}>
          <span className="v2-pill v2-pill-confirmed">
            ✓ You're on this brief
          </span>
          <button className="v2-btn v2-btn-primary v2-btn-sm" type="button" onClick={onApply}>
            Open thread {Icon.arrow}
          </button>
        </div>
      ) : (
        <div className="v2-row" style={{ justifyContent: 'space-between', paddingTop: 14, borderTop: '1px solid var(--v2-line)' }}>
          <button className="v2-btn v2-btn-ghost v2-btn-sm" type="button" onClick={onApply}>
            View brief
          </button>
          <button className="v2-btn v2-btn-accent v2-btn-sm" type="button" onClick={onApply}>
            Apply {Icon.arrow}
          </button>
        </div>
      )}
    </article>
  );
}

function Meta({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <div
        className="v2-muted"
        style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}
      >{label}</div>
      <div
        className={`v2-tabular ${accent ? 'v2-accent-text' : ''}`}
        style={{ fontSize: 13.5, fontWeight: accent ? 600 : 500 }}
      >{value}</div>
    </div>
  );
}
