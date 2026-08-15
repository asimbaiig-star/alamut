// Trust score badge — Bronze / Silver / Gold tier pill with optional metric strip.
// Derived from completed campaigns + reviews + verification.
import { tierColor, tierLabel, type TrustSnapshot } from '@/lib/utils/trust';

interface TrustBadgeProps {
  snapshot: TrustSnapshot;
  size?: 'sm' | 'md';
  showMetrics?: boolean;
}

export function TrustBadge({ snapshot, size = 'sm', showMetrics = false }: TrustBadgeProps) {
  const c = tierColor(snapshot.tier);
  const px = size === 'sm' ? 8 : 10;
  const fz = size === 'sm' ? 11 : 13;

  // Gold tier earns the magic-border treatment — animated conic gradient ring
  // makes the highest-tier badge feel earned, premium, alive.
  const isGold = snapshot.tier === 'gold';
  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', gap: showMetrics ? 6 : 0 }}>
      <span
        className={isGold ? 'magic-border trust-badge-gold' : undefined}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: `${px - 4}px ${px}px`,
          background: c.bg, color: c.fg,
          fontSize: fz, fontFamily: 'var(--mono)',
          letterSpacing: '0.06em', textTransform: 'uppercase',
          borderRadius: 2,
          border: isGold ? 'none' : `1px solid color-mix(in oklch, ${c.fg} 18%, transparent)`,
          fontWeight: 500,
          width: 'fit-content',
        }}
        title={`${snapshot.completedCampaigns} completed · ${snapshot.avgRating} avg`}
      >
        <TrustGlyph tier={snapshot.tier} fg={c.fg} />
        {tierLabel(snapshot.tier)}
      </span>

      {showMetrics && (
        <div style={{ fontSize: 11, color: 'var(--ink-60)', fontFamily: 'var(--mono)', display: 'flex', flexWrap: 'wrap', gap: 12 }}>
          <span>{snapshot.completedCampaigns} done</span>
          {snapshot.avgRating > 0 && <span>· {snapshot.avgRating}★</span>}
          {snapshot.responseHrs > 0 && <span>· {snapshot.responseHrs}h reply</span>}
        </div>
      )}
    </div>
  );
}

function TrustGlyph({ tier, fg }: { tier: TrustSnapshot['tier']; fg: string }) {
  if (tier === 'gold') {
    return (
      <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke={fg} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2 15 9 22 9.5 17 14.5 18.5 22 12 18.5 5.5 22 7 14.5 2 9.5 9 9z" />
      </svg>
    );
  }
  if (tier === 'silver') {
    return (
      <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke={fg} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" />
        <path d="M8 12 11 15 16 9" />
      </svg>
    );
  }
  return (
    <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke={fg} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2 4 6v6c0 5 3.5 9 8 10 4.5-1 8-5 8-10V6Z" />
    </svg>
  );
}

// Detailed metrics card — used on the public storefront and on creator/brand profiles
export function TrustMetricsCard({ snapshot, role }: { snapshot: TrustSnapshot; role: 'creator' | 'brand' }) {
  const items: { label: string; value: string; meta?: string }[] = [
    { label: 'Completed', value: snapshot.completedCampaigns.toString(), meta: 'campaigns' },
    { label: 'Avg rating', value: snapshot.avgRating > 0 ? snapshot.avgRating.toFixed(1) : '—', meta: `${snapshot.reviewCount} review${snapshot.reviewCount === 1 ? '' : 's'}` },
  ];
  // "On-time delivery" and "Payout reliability" used to be listed here.
  // Neither was measured: both were arithmetic on the review-rating average
  // (`85 + avg * 3`, `88 + avg * 2`) that defaulted to 95% for an account
  // with no completed campaigns at all. Every remaining item reads a value
  // that is genuinely counted.
  if (role === 'creator') {
    if (snapshot.responseHrs > 0) {
      items.push({ label: 'Reply time', value: `${snapshot.responseHrs}`, meta: 'hours' });
    }
    if (snapshot.completedCampaigns > 0) {
      items.push({ label: 'Avg revisions', value: snapshot.avgRevisionRounds.toFixed(1), meta: 'rounds' });
    }
  }

  return (
    <div className="kpi-strip" style={{ borderTop: '1px solid var(--rule)' }}>
      {items.map((it) => (
        <div key={it.label}>
          <div className="kpi-k">{it.label}</div>
          <div className="kpi-v">{it.value}{it.meta?.startsWith('%') && <span className="u">%</span>}</div>
          <div className="kpi-d">{it.meta?.replace(/^%\s?/, '')}</div>
        </div>
      ))}
    </div>
  );
}
