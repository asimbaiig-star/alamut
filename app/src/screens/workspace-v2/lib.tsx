// lib.tsx — Shared utilities for workspace-v2
//
// Bundles: icon library, USD + follower formatters, platform-meta map,
// PlatformChip / ScoreBadge / StagePill primitives. Mirrors the
// components.jsx in the Claude Design handoff but in TypeScript with
// proper React types.

import type { CSSProperties, ReactNode } from 'react';
import type { V2Channel, V2Campaign } from './data';
import { HomeHead } from './screens/homeParts';
import { PLATFORM_GLYPH } from '@/lib/platformGlyphs';
import { fmtFollowers } from '@/lib/followers';

// =====================================================================
// Icons (16px stroke icons, all currentColor)
// =====================================================================

const sw = (path: ReactNode) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{path}</svg>
);

export const Icon = {
  search:    sw(<><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></>),
  home:      sw(<><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></>),
  compass:   sw(<><circle cx="12" cy="12" r="10" /><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" /></>),
  campaign:  sw(<><path d="M3 11l18-5v12L3 14v-3z" /><path d="M11.6 16.8a3 3 0 11-5.8-1.6" /></>),
  inbox:     sw(<><polyline points="22 12 16 12 14 15 10 15 8 12 2 12" /><path d="M5.45 5.11L2 12v6a2 2 0 002 2h16a2 2 0 002-2v-6l-3.45-6.89A2 2 0 0016.76 4H7.24a2 2 0 00-1.79 1.11z" /></>),
  wallet:    sw(<><path d="M21 12V7H5a2 2 0 010-4h14v4" /><path d="M3 5v14a2 2 0 002 2h16v-5" /><path d="M18 12a2 2 0 000 4h4v-4z" /></>),
  spark:     sw(<path d="M12 2L14.5 9.5 22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5z" />),
  store:     sw(<><path d="M3 9l1-5h16l1 5" /><path d="M5 9v11h14V9" /><path d="M9 22V12h6v10" /></>),
  chart:     sw(<><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></>),
  shield:    sw(<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />),
  settings:  sw(<><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z" /></>),
  bell:      sw(<><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 01-3.46 0" /></>),
  calendar:  sw(<><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></>),
  plus:      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>,
  arrow:     sw(<><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></>),
  filter:    sw(<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />),
  check:     <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>,
  more:      sw(<><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /><circle cx="5" cy="12" r="1" /></>),
  edit:      sw(<><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" /></>),
  external:  sw(<><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></>),
  send:      sw(<><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></>),
  logout:    sw(<><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></>),
  ig: <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d={PLATFORM_GLYPH.instagram} /></svg>,
  tt: <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d={PLATFORM_GLYPH.tiktok} /></svg>,
  yt: <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d={PLATFORM_GLYPH.youtube} /></svg>,
  li: <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M20.45 20.45h-3.55v-5.57c0-1.33-.03-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.36V9h3.41v1.56h.05a3.74 3.74 0 013.36-1.85c3.6 0 4.27 2.37 4.27 5.45zM5.34 7.43a2.06 2.06 0 11.01-4.13 2.06 2.06 0 01-.01 4.13zM7.12 20.45H3.56V9h3.56zM22.22 0H1.77C.79 0 0 .77 0 1.72v20.56C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.72V1.72C24 .77 23.2 0 22.22 0z" /></svg>,
  x: <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>,
  newsletter: sw(<><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></>),
  // P66 — segmented control affordance icons.
  kanban:    sw(<><rect x="3" y="4" width="5" height="16" rx="1" /><rect x="10" y="4" width="5" height="10" rx="1" /><rect x="17" y="4" width="4" height="13" rx="1" /></>),
  list:      sw(<><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><circle cx="4" cy="6" r="1" /><circle cx="4" cy="12" r="1" /><circle cx="4" cy="18" r="1" /></>),
};

export const PLATFORM_META: Record<V2Channel['platform'], { color: string; name: string; icon: ReactNode }> = {
  instagram: { color: '#E4405F', name: 'Instagram', icon: Icon.ig },
  tiktok: { color: '#000', name: 'TikTok', icon: Icon.tt },
  youtube: { color: '#FF0000', name: 'YouTube', icon: Icon.yt },
  linkedin: { color: '#0A66C2', name: 'LinkedIn', icon: Icon.li },
  x: { color: '#000', name: 'X', icon: Icon.x },
  newsletter: { color: '#5A3B47', name: 'Newsletter', icon: Icon.newsletter },
};

// =====================================================================
// Formatters — USD (decision locked Phase A · 2026-05-07)
// =====================================================================
//
// USD with Western conventions (K / M, no crores / lakhs). The original
// Pakistan-first handoff used PKR (Rs 28.4L / Rs 2.4cr / etc.) — we
// migrated to USD in Phase A. Pakistan flavor remains in non-money
// content where it makes sense (JazzCash / Easypaisa as optional
// payment rails), but all numeric outputs are USD.

/** Compact USD: $1.5K, $185K, $2.4M */
export function fmtUSD(n: number | null | undefined): string {
  if (n == null) return '—';
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(abs % 1_000_000 === 0 ? 0 : 1)}M`;
  if (abs >= 1000) return `${sign}$${(abs / 1000).toFixed(abs % 1000 === 0 ? 0 : 1)}K`;
  return `${sign}$${abs.toLocaleString()}`;
}

/** Full USD: $1,500,000 */
export function fmtUSDfull(n: number | null | undefined): string {
  if (n == null) return '—';
  return `$${n.toLocaleString()}`;
}

/** Followers: 1.2M, 86K, 420 */
export { fmtFollowers };

// =====================================================================
// Sub-components
// =====================================================================

export function PlatformChip({ platform, followers, engagement }: {
  platform: V2Channel['platform'];
  followers: number;
  engagement?: number;
}) {
  const meta = PLATFORM_META[platform] ?? PLATFORM_META.instagram;
  return (
    <div className="v2-channel-chip">
      <div className="v2-channel-icon" style={{ background: meta.color }}>{meta.icon}</div>
      <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.25 }}>
        <div style={{ fontWeight: 550, fontSize: 13 }}>
          {fmtFollowers(followers)} <span className="v2-muted">on {meta.name}</span>
        </div>
        {engagement != null && (
          <div style={{ fontSize: 11.5, color: 'var(--v2-ink-3)' }}>
            {engagement}% engagement
          </div>
        )}
      </div>
    </div>
  );
}

/** The creator's review rating on a 0–100 scale. `null` means they have no
 *  reviews yet — say so rather than printing a number. Pre-fix the adapter
 *  defaulted an unrated creator to 4.5 stars, so a brand-new creator with
 *  zero reviews rendered a confident "90" here (P-10). */
export function ScoreBadge({ score }: { score: number | null }) {
  if (score === null) {
    return (
      <div className="v2-score" title="No reviews yet — this creator hasn't completed a collab on Alamut">
        <span className="v2-score-dot">○</span>
        New
      </div>
    );
  }
  const tier = score >= 90 ? 'good' : score >= 80 ? 'mid' : 'low';
  return (
    <div
      className={`v2-score ${tier === 'good' ? 'v2-score-good' : tier === 'mid' ? 'v2-score-mid' : ''}`}
      // Shown as the rating it is. "● 91" was a review average out of 5
      // scaled to 100, explained only in a tooltip.
      aria-label={`Average review ${(score / 20).toFixed(1)} out of 5`}
      title={`Average review rating: ${(score / 20).toFixed(1)} / 5`}
    >
      <span className="v2-score-dot" aria-hidden="true">★</span>
      {(score / 20).toFixed(1)}
    </div>
  );
}

export function StagePill({ stage }: { stage: V2Campaign['status'] | string }) {
  const map: Record<string, string> = {
    Live: 'v2-pill-live',
    Active: 'v2-pill-moss',
    Planned: 'v2-pill-draft',
    Completed: 'v2-pill-moss',
    Confirmed: 'v2-pill-confirmed',
    Negotiating: 'v2-pill-draft',
    Submitted: 'v2-pill-accent',
  };
  const cls = map[stage] ?? '';
  return <span className={`v2-pill ${cls}`}>{stage}</span>;
}

// =====================================================================
// Generic primitives used by screens
// =====================================================================

export function StatCard({
  label, value, sub, accent, style,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
  style?: CSSProperties;
}) {
  return (
    <div
      className="v2-card v2-card-pad"
      style={{
        ...(accent && {
          background: 'linear-gradient(135deg, var(--v2-accent-soft), var(--v2-paper))',
          borderColor: 'var(--v2-accent-soft)',
        }),
        ...style,
      }}
    >
      <div className="v2-stat">
        <div className="v2-stat-label">{label}</div>
        <div className="v2-stat-value">{value}</div>
        {sub && <div className="v2-stat-sub">{sub}</div>}
      </div>
    </div>
  );
}

/** Phase 58 — shared empty-state component for first-time-here surfaces.
 *  Pre-fix Campaigns / MyCollabs / wallet ledger / etc. either rendered
 *  bare empty tables or weak "no items" muted text for fresh accounts.
 *  This is the single place to render an opinionated empty-state card
 *  with an icon, headline, supporting copy, and a primary CTA that
 *  routes the user somewhere useful. */
export function EmptyState({
  icon, title, body, ctaLabel, onCta, secondary,
}: {
  icon?: ReactNode;
  title: string;
  body: string;
  ctaLabel?: string;
  onCta?: () => void;
  secondary?: ReactNode;
}) {
  return (
    <div
      className="v2-card v2-card-pad-lg"
      style={{
        textAlign: 'center',
        maxWidth: 540,
        margin: '40px auto',
      }}
    >
      {icon && (
        <div style={{
          fontSize: 28,
          marginBottom: 10,
          opacity: 0.45,
          color: 'var(--v2-ink-3)',
        }}>{icon}</div>
      )}
      <div style={{
        fontFamily: 'var(--v2-font-display)',
        fontSize: 22,
        fontWeight: 500,
        letterSpacing: '-0.014em',
        marginBottom: 6,
        color: 'var(--v2-ink)',
      }}>
        {title}
      </div>
      <div className="v2-muted" style={{
        fontSize: 14, lineHeight: 1.6, marginBottom: ctaLabel ? 18 : 0, maxWidth: 420, margin: '0 auto',
      }}>
        {body}
      </div>
      {ctaLabel && onCta && (
        <button
          type="button"
          className="v2-btn v2-btn-primary"
          onClick={onCta}
          style={{ marginTop: 18 }}
        >
          {ctaLabel}
        </button>
      )}
      {secondary && (
        <div style={{ marginTop: 12 }}>{secondary}</div>
      )}
    </div>
  );
}

export function CampaignCard({ campaign, onClick }: {
  campaign: V2Campaign;
  onClick?: () => void;
}) {
  const pct = Math.round((campaign.spent / campaign.budget) * 100);
  return (
    <div className="v2-card v2-card-pad v2-card-clickable" onClick={onClick}>
      <div className="v2-row" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
        <StagePill stage={campaign.status} />
        <span className="v2-muted" style={{ fontSize: 12 }}>{campaign.brand}</span>
      </div>
      <h3 style={{
        fontFamily: 'var(--v2-font-display)',
        fontSize: 20,
        fontWeight: 500,
        margin: '4px 0 12px',
        letterSpacing: '-0.02em',
        color: 'var(--v2-ink)',
      }}>{campaign.name}</h3>
      <div className="v2-progress" style={{ marginBottom: 8 }}>
        <div className="v2-progress-fill" style={{ width: `${pct}%` }} />
      </div>
      <div className="v2-row" style={{ justifyContent: 'space-between', fontSize: 12.5 }}>
        <span className="v2-muted v2-tabular">
          {fmtUSD(campaign.spent)} / {fmtUSD(campaign.budget)}
        </span>
        <span className="v2-muted">
          {campaign.confirmed} creators · {campaign.live} live
        </span>
      </div>
    </div>
  );
}

export function Topbar({
  title, crumb, sub, actions,
}: {
  title: string;
  /** A trail above the title ("Campaigns · Draft"), when it's a link. */
  crumb?: ReactNode;
  /** A line under the title. */
  sub?: ReactNode;
  actions?: ReactNode;
}) {
  // Round 7: the older screens' header, rebuilt as the portal's page head
  // (homeParts HomeHead) so every page has the same title, on the persona's
  // ground on a phone with the page as a sheet below. Plain-text "crumbs"
  // were always a description ("8 overdue · 28 due in next 7 days"), so they
  // read under the title now; a crumb that's a link stays above it.
  const isText = typeof crumb === 'string';
  return (
    <div className="v2-hm-ground v2-tb">
      <HomeHead
        title={title}
        crumb={isText ? undefined : crumb}
        sub={sub ?? (isText ? crumb : undefined)}
        actions={actions}
      />
    </div>
  );
}
