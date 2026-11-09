// Analytics.tsx — v2 creator-side analytics dashboard
//
// Reach over time · KPI strip · brand mix donut · audience demographics
// · per-channel performance · top-performing posts.
//
// Every number is derived from the live store. Reach trail is bucketed
// by collab activity; brand mix is from accepted-campaign categories;
// top posts are real submissions/payouts; KPIs sum the wallet ledger.
// "Window" filter (7d/30d/90d/1y) clamps payouts to that range.

import { useMemo, useState } from 'react';
import { fmtFollowers, fmtUSD, fmtUSDfull, Icon, PLATFORM_META, Topbar } from '../lib';
import {
  useV2Creators, useV2CurrentCreator, useV2MyCollabs, useV2AllCampaigns,
} from '../v2Hooks';
import { creatorToV2 } from '../v2Adapters';
import { splitAcrossSlots } from '@/lib/api/money';
import { useStore } from '@/lib/api/store';

interface Props {
  onRoute: (r: string) => void;
}

const RANGES = ['7d', '30d', '90d', '1y'] as const;
type Range = typeof RANGES[number];

const RANGE_DAYS: Record<Range, number> = { '7d': 7, '30d': 30, '90d': 90, '1y': 365 };
const RANGE_BUCKETS: Record<Range, number> = { '7d': 7, '30d': 30, '90d': 12, '1y': 12 };

const CATEGORY_COLOR_POOL = [
  'var(--v2-accent)',
  'var(--v2-moss)',
  'var(--v2-gold)',
  'var(--v2-plum)',
  'var(--v2-info)',
  'var(--v2-line-2)',
];

export function Analytics({ onRoute }: Props) {
  const [range, setRange] = useState<Range>('30d');
  const creator = useV2CurrentCreator();
  const allCreators = useV2Creators();
  const myCollabs = useV2MyCollabs();
  const allCampaigns = useV2AllCampaigns();
  const db = useStore((s) => s.db);

  const me = creator ? creatorToV2(creator, db) : allCreators[0];
  if (!me || !creator) {
    return (
      <>
        <Topbar title="Analytics" crumb="No creator profile" />
        <div className="v2-content"><p className="v2-muted">No creator linked.</p></div>
      </>
    );
  }

  const totalReach = me.channels.reduce((s, ch) => s + ch.followers, 0);
  // Weighted by followers. A plain average let a small newsletter's open
  // rate (42%) count as much as a 142K Instagram's 5.2%, and read 18.1%.
  const avgER = totalReach > 0
    ? (me.channels.reduce((s, ch) => s + ch.engagement * ch.followers, 0) / totalReach).toFixed(1)
    : '0.0';

  // ─── Earnings within the selected window ───
  const windowStart = Date.now() - RANGE_DAYS[range] * 86_400_000;
  const myUserId = creator.userId;

  const windowedTransactions = useMemo(
    () => db.transactions.filter(
      (t) =>
        t.userId === myUserId &&
        t.kind === 'payout' &&
        new Date(t.at).getTime() >= windowStart,
    ),
    [db.transactions, myUserId, windowStart],
  );
  const earningsInWindow = windowedTransactions.reduce((s, t) => s + Math.max(0, t.amount), 0);

  // ─── Close rate: applications → accepted offers ratio
  const myApps = db.applications.filter((a) => a.creatorId === creator.id);
  const myAccepted = db.offers.filter((o) => o.creatorId === creator.id && o.status === 'accepted');
  const closeRatePct = myApps.length > 0
    ? Math.round((myAccepted.length / myApps.length) * 100)
    : 0;

  // ─── Released to you over time: the ledger's inflows, bucketed.
  // This was "Reach over time": submission counts weighted 30/12/8 and
  // multiplied by the follower count "for realistic feel" — a chart of a
  // made-up quantity labelled as daily impressions. Nothing measures a
  // creator's reach per day; the ledger does record every release.
  const releasedTrail = useMemo(() => {
    const days = RANGE_DAYS[range];
    const bucketCount = RANGE_BUCKETS[range];
    const bucketSize = days / bucketCount;
    const now = Date.now();
    const buckets = new Array(bucketCount).fill(0) as number[];
    db.transactions
      .filter((t) => t.userId === myUserId && (t.kind === 'payout' || t.kind === 'escrow_release') && t.status === 'cleared' && t.amount > 0)
      .forEach((t) => {
        const ageDays = (now - new Date(t.at).getTime()) / 86_400_000;
        if (!(ageDays >= 0 && ageDays <= days)) return;
        const idx = Math.min(bucketCount - 1, Math.floor((days - ageDays) / bucketSize));
        buckets[idx] += t.amount;
      });
    return buckets;
  }, [db.transactions, myUserId, range]);
  const releasedTotal = releasedTrail.reduce((n, v) => n + v, 0);

  // ─── Brand mix donut: derive from real accepted collab categories
  const brandMix = useMemo(() => {
    const counts = new Map<string, number>();
    myCollabs.forEach((c) => {
      if (c.stage === 'paid' || c.stage === 'live' || c.stage === 'approved' || c.stage === 'submitted' || c.stage === 'confirmed') {
        const camp = allCampaigns.find((x) => x.id === c.campaignId);
        const rawCamp = db.campaigns.find((x) => x.id === c.campaignId);
        const cat = rawCamp?.category ?? 'Other';
        if (camp) counts.set(cat, (counts.get(cat) ?? 0) + 1);
      }
    });
    const total = Array.from(counts.values()).reduce((s, n) => s + n, 0);
    if (total === 0) {
      return [{ name: 'No data yet', value: 100, color: 'var(--v2-bg-2)' }];
    }
    const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
    return sorted.slice(0, 5).map(([name, n], i) => ({
      name,
      value: Math.round((n / total) * 100),
      color: CATEGORY_COLOR_POOL[i] ?? 'var(--v2-bg-2)',
    }));
  }, [myCollabs, allCampaigns, db.campaigns]);

  // The count the donut's centre reports — the same collabs its segments
  // are built from, so the middle and the ring can't disagree.
  const brandDealCount = useMemo(
    () => myCollabs.filter((c) =>
      ['paid', 'live', 'approved', 'submitted', 'confirmed'].includes(c.stage),
    ).length,
    [myCollabs],
  );

  // ─── Your recent posts, with what each one earned.
  // This was "Top performing posts" with a reach of followers × (0.4 +
  // round × 0.1) and the channel's average ER on every row, so every post
  // "performed" the same, and each was credited with the whole deal's net.
  // Nothing measures per-post reach here; the post's share of the deal is
  // real (money.ts, the same split the ledger uses).
  const recentPosts = useMemo(() => {
    return db.submissions
      .filter((s) => s.creatorId === creator.id && s.status === 'approved')
      .sort((a, b) => +new Date(b.submittedAt) - +new Date(a.submittedAt))
      .slice(0, 6)
      .map((s) => {
        const camp = db.campaigns.find((c) => c.id === s.campaignId);
        const offer = db.offers.find((o) => o.campaignId === s.campaignId && o.creatorId === creator.id && o.status === 'accepted');
        // One slot per post: "3 stories + 1 post" is four, as the ledger
        // splits it (deliverable rows carry a quantity).
        const slots = Math.max(1, db.deliverables.filter((d) => d.campaignId === s.campaignId).reduce((n, d) => n + Math.max(1, d.quantity || 1), 0));
        const share = offer ? splitAcrossSlots(offer.rate, slots).net : 0;
        const del = db.deliverables.find((d) => d.id === s.deliverableId);
        return {
          id: s.id,
          platform: (del?.platform ?? me.channels[0]?.platform ?? 'instagram') as keyof typeof PLATFORM_META,
          title: camp?.title ?? 'Untitled',
          what: del ? `${del.format}${del.quantity > 1 ? ` ×${del.quantity}` : ''}` : `round ${s.round}`,
          status: s.permalink && !s.postDownAt ? 'Live' : 'Approved',
          date: new Date(s.submittedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          share,
        };
      });
  }, [db.submissions, db.campaigns, db.offers, db.deliverables, creator.id, me.channels]);

  // P-3 — every delta on this screen used to be a hardcoded string
  // ("+8.2%", "+0.6pt", "+12pt"/"−4pt", "+18%"), so a creator with zero
  // reach, zero engagement and zero applications was shown confident
  // upward trends. There is no stored historical series to compare
  // against, so the honest answer is to show no delta at all rather than
  // invent one. When per-period history lands, compute them here.
  const earningsDelta: string | undefined = undefined;

  // Has this creator generated ANY of the data this screen reports on? If
  // not, show the same "unlocks once there's data" state brand Analytics
  // already uses, instead of a grid of zeros decorated with fake trends.
  const hasAnySignal =
    me.channels.length > 0 ||
    myApps.length > 0 ||
    db.transactions.some((t) => t.kind === 'payout' && t.userId === myUserId);

  // Nothing to report on yet. Brand Analytics already handles this case
  // properly ("Analytics unlock once content goes live"); this mirrors it
  // rather than rendering a grid of zeros. Range buttons are omitted too —
  // there's nothing for them to filter.
  if (!hasAnySignal) {
    return (
      <>
        <Topbar title="Analytics" crumb="Reach · engagement · audience · earnings" />
        <div className="v2-content">
          <div className="v2-card v2-card-pad" style={{ textAlign: 'center', padding: '48px 24px' }}>
            <div style={{ fontSize: 26, marginBottom: 10, color: 'var(--v2-ink-3)' }}>◐</div>
            <h3 style={{ fontFamily: 'var(--v2-font-display)', fontSize: 19, marginBottom: 8 }}>
              Analytics unlock once you have a channel and a collab
            </h3>
            <p className="v2-muted" style={{ fontSize: 13.5, lineHeight: 1.55, maxWidth: 460, margin: '0 auto 18px' }}>
              You'll see reach, engagement, audience breakdown and earnings here as
              you add channels to your storefront and complete collaborations.
            </p>
            <div className="v2-row" style={{ gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button className="v2-btn v2-btn-primary" type="button" onClick={() => onRoute('storefront')}>
                Add a channel
              </button>
              <button className="v2-btn v2-btn-ghost" type="button" onClick={() => onRoute('creator-campaigns')}>
                Browse briefs
              </button>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Topbar
        title="Analytics"
        crumb="Reach · engagement · audience · earnings"
        actions={
          <>
            <div className="v2-row" style={{ gap: 4, padding: 4, background: 'var(--v2-bg-1)', borderRadius: 10 }}>
              {RANGES.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRange(r)}
                  className={range === r ? 'v2-btn v2-btn-primary v2-btn-sm' : 'v2-btn v2-btn-ghost v2-btn-sm'}
                  style={{ minWidth: 44 }}
                >{r}</button>
              ))}
            </div>
            <button className="v2-btn v2-btn-outline" type="button" onClick={() => onRoute('storefront')}>
              {Icon.external}<span>View storefront</span>
            </button>
          </>
        }
      />
      <div className="v2-content">
        {/* KPI strip — derived from real data */}
        <div className="v2-row" style={{ gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
          <KpiTile
            label="Followers"
            value={fmtFollowers(totalReach)}
            sub={`across ${me.channels.length} channel${me.channels.length === 1 ? '' : 's'}`}
          />
          <KpiTile
            label="Engagement"
            value={`${avgER}%`}
            sub="weighted by followers"
          />
          <KpiTile
            label="Deal close rate"
            value={`${closeRatePct}%`}
            sub={`${myAccepted.length} of ${myApps.length} applications accepted`}
          />
          <KpiTile
            label={`Earnings (${range})`}
            value={fmtUSD(earningsInWindow)}
            sub={`${windowedTransactions.length} payout${windowedTransactions.length === 1 ? '' : 's'} in window`}
            delta={earningsDelta}
            positive={earningsInWindow > 0}
          />
        </div>

        {/* 2-col: reach chart + brand mix */}
        <div className="v2-row" style={{ gap: 20, alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap' }}>
          <section className="v2-card v2-card-pad" style={{ flex: '2 1 480px' }}>
            <div className="v2-row" style={{ justifyContent: 'space-between', marginBottom: 18, alignItems: 'flex-end' }}>
              <div>
                <div className="v2-eyebrow">Released to you</div>
                <p className="v2-muted" style={{ margin: '4px 0 0', fontSize: 12.5 }}>
                  Money released from your deals, last {range}: {fmtUSDfull(releasedTotal)}.
                </p>
              </div>
              <div className="v2-row" style={{ gap: 14, fontSize: 11.5 }}>
                <LegendDot color="var(--v2-accent)" label="Released" />
              </div>
            </div>
            {releasedTotal > 0 ? <BarChart values={releasedTrail} /> : (
              <div className="v2-muted" style={{ padding: '40px 0', textAlign: 'center', fontSize: 13 }}>
                Nothing released in this window. Each post’s share is released when the brand confirms it’s live.
              </div>
            )}
            <div className="v2-row" style={{ justifyContent: 'space-between', marginTop: 10, fontSize: 11.5, color: 'var(--v2-ink-3)' }}>
              <span>{range === '1y' ? '1 year ago' : `${RANGE_DAYS[range]} days ago`}</span>
              <span>{range === '1y' || range === '90d' ? 'Mid-window' : `${Math.round(RANGE_DAYS[range] / 2)} days ago`}</span>
              <span>Today</span>
            </div>
          </section>

          <section className="v2-card v2-card-pad" style={{ flex: '1 1 280px' }}>
            <div className="v2-eyebrow" style={{ marginBottom: 14 }}>Brand mix</div>
            <Donut segments={brandMix} centerCount={brandDealCount} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16 }}>
              {brandMix.map((c) => (
                <div key={c.name} className="v2-row" style={{ justifyContent: 'space-between', fontSize: 12.5 }}>
                  <span className="v2-row" style={{ gap: 8 }}>
                    <span style={{
                      display: 'inline-block',
                      width: 10,
                      height: 10,
                      borderRadius: 3,
                      background: c.color,
                    }} />
                    {c.name}
                  </span>
                  <span className="v2-tabular" style={{ fontWeight: 600 }}>{c.value}%</span>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Audience + per-channel */}
        <div className="v2-row" style={{ gap: 20, alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap' }}>
          <section className="v2-card v2-card-pad" style={{ flex: '1 1 320px' }}>
            <div className="v2-eyebrow" style={{ marginBottom: 14 }}>Audience demographics</div>
            {me.audience ? (
              <>
                <div className="v2-storefront-audience">
                  <AudienceBar label="Female" value={`${me.audience.female}%`} bar={me.audience.female} />
                  <AudienceBar label="Male" value={`${me.audience.male}%`} bar={me.audience.male} />
                  <AudienceBar label="25–34 age band" value={`${me.audience.age2534}%`} bar={me.audience.age2534} />
                  {me.audience.age1824 != null && (
                    <AudienceBar label="18–24 age band" value={`${me.audience.age1824}%`} bar={me.audience.age1824} />
                  )}
                </div>
                <div style={{ marginTop: 14, padding: '10px 12px', background: 'var(--v2-bg-1)', borderRadius: 10, fontSize: 12.5, color: 'var(--v2-ink-2)' }}>
                  {/* `topCity` is populated from `topCountries[0].country` —
                      a country, not a city. The label used to read "Top
                      region: {topCity}, Pakistan · 38% of all impressions",
                      appending a country to a country and an invented share
                      to both. */}
                  <strong>Top audience region:</strong> {me.audience.topCity}
                </div>
              </>
            ) : (
              <p className="v2-muted" style={{ fontSize: 13, margin: 0, lineHeight: 1.6 }}>
                Your channels don’t report audience demographics yet. Connect
                a platform account with analytics access and this fills in.
              </p>
            )}
          </section>

          <section className="v2-card v2-card-pad" style={{ flex: '2 1 480px' }}>
            <div className="v2-eyebrow" style={{ marginBottom: 14 }}>Per-channel performance</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {me.channels.map((ch, i) => {
                const meta = PLATFORM_META[ch.platform];
                return (
                  <div key={`${ch.platform}-${i}`} className="v2-row" style={{
                    padding: '12px 14px',
                    background: 'var(--v2-bg-1)',
                    borderRadius: 10,
                    gap: 14,
                  }}>
                    <div
                      className="v2-channel-icon"
                      style={{ background: meta.color, width: 36, height: 36, borderRadius: 10, flexShrink: 0 }}
                    >{meta.icon}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 600 }}>{meta.name}</div>
                      <div className="v2-muted" style={{ fontSize: 11.5 }}>{ch.handle}</div>
                    </div>
                    <ChannelStat label="Followers" value={fmtFollowers(ch.followers)} />
                    <ChannelStat label="Engagement" value={`${ch.engagement}%`} />
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        {/* Top posts */}
        <section className="v2-card v2-card-pad" style={{ marginBottom: 24 }}>
          <div className="v2-row" style={{ justifyContent: 'space-between', marginBottom: 14, alignItems: 'flex-end' }}>
            <div>
              <div className="v2-eyebrow">Your recent posts</div>
              <p className="v2-muted" style={{ margin: '4px 0 0', fontSize: 12.5 }}>
                Approved and live, newest first, with each post’s share of its deal after fees. Reach per post isn’t measured yet.
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {recentPosts.length === 0 ? (
              <div className="v2-muted" style={{ padding: 32, textAlign: 'center', fontSize: 13 }}>
                No approved content yet. Once your posts go live, they'll show up here.
              </div>
            ) : recentPosts.map((post, i) => {
              const meta = PLATFORM_META[post.platform] ?? PLATFORM_META.instagram;
              return (
                <div
                  key={post.id}
                  className="v2-row"
                  style={{
                    padding: '14px 0',
                    borderTop: i === 0 ? 'none' : '1px solid var(--v2-line)',
                    gap: 16,
                  }}
                >
                  <div
                    className="v2-channel-icon"
                    style={{ background: meta.color, width: 32, height: 32, borderRadius: 8, flexShrink: 0 }}
                  >{meta.icon}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 2 }}>{post.title}</div>
                    <div className="v2-muted" style={{ fontSize: 11.5 }}>
                      {meta.name} · {post.what} · {post.date}
                    </div>
                  </div>
                  <ChannelStat label="Status" value={post.status} />
                  <ChannelStat label="Your share" value={post.share > 0 ? fmtUSDfull(post.share) : '—'} />
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </>
  );
}

// =====================================================================
// Sub-components
// =====================================================================

function KpiTile({ label, value, sub, delta, positive }: {
  label: string;
  value: string;
  sub?: string;
  delta?: string;
  positive?: boolean;
}) {
  return (
    <div className="v2-card v2-card-pad" style={{ flex: '1 1 200px', minWidth: 180 }}>
      <div className="v2-stat-label">{label}</div>
      <div className="v2-row" style={{ alignItems: 'baseline', gap: 8, marginTop: 4 }}>
        <div className="v2-stat-value v2-tabular" style={{ fontSize: 26 }}>{value}</div>
        {delta && (
          <span style={{
            fontSize: 11.5,
            fontWeight: 600,
            color: positive ? 'var(--v2-moss)' : 'var(--v2-accent)',
          }}>
            {delta}
          </span>
        )}
      </div>
      {sub && <div className="v2-stat-sub">{sub}</div>}
    </div>
  );
}

function BarChart({ values }: { values: number[] }) {
  const max = Math.max(...values);
  return (
    <div style={{
      display: 'flex',
      alignItems: 'flex-end',
      gap: 3,
      height: 140,
      padding: '0 2px',
    }}>
      {values.map((v, i) => (
        <div
          key={i}
          style={{
            flex: 1,
            height: `${(v / max) * 100}%`,
            background: 'linear-gradient(180deg, var(--v2-accent) 0%, var(--v2-accent-soft) 100%)',
            borderRadius: '3px 3px 0 0',
            minHeight: 4,
            transition: 'opacity 200ms',
          }}
          title={`Day ${i + 1}: ${v}K reach`}
        />
      ))}
    </div>
  );
}

function Donut({ segments, centerCount }: {
  segments: { name: string; value: number; color: string }[];
  /** Real number of brand deals behind the chart. */
  centerCount: number;
}) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  const radius = 60;
  const stroke = 18;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div style={{ display: 'flex', justifyContent: 'center', position: 'relative', height: 160 }}>
      <svg width="160" height="160" viewBox="0 0 160 160" style={{ transform: 'rotate(-90deg)' }}>
        <circle
          cx="80"
          cy="80"
          r={radius}
          fill="none"
          stroke="var(--v2-bg-2)"
          strokeWidth={stroke}
        />
        {segments.map((seg, i) => {
          const length = (seg.value / total) * circumference;
          const dasharray = `${length} ${circumference - length}`;
          const dashoffset = -offset;
          offset += length;
          return (
            <circle
              key={i}
              cx="80"
              cy="80"
              r={radius}
              fill="none"
              stroke={seg.color}
              strokeWidth={stroke}
              strokeDasharray={dasharray}
              strokeDashoffset={dashoffset}
              strokeLinecap="butt"
            />
          );
        })}
      </svg>
      <div style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        textAlign: 'center',
      }}>
        <div className="v2-tabular" style={{
          fontFamily: 'var(--v2-font-display)',
          fontSize: 24,
          fontWeight: 500,
          letterSpacing: '-0.02em',
          color: 'var(--v2-ink)',
        }}>
          {/* Was the literal `14`, in the middle of a chart whose segments
              were correctly computed from real collaborations. The one
              number a reader takes away was the one that was typed in. */}
          {centerCount}
        </div>
        <div className="v2-muted" style={{ fontSize: 11 }}>
          {centerCount === 1 ? 'brand deal' : 'brand deals'}
        </div>
      </div>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="v2-row" style={{ gap: 6 }}>
      <span style={{
        display: 'inline-block',
        width: 8,
        height: 8,
        borderRadius: 999,
        background: color,
      }} />
      <span className="v2-muted">{label}</span>
    </span>
  );
}

function ChannelStat({ label, value, positive }: { label: string; value: string; positive?: boolean }) {
  return (
    <div style={{ textAlign: 'right', minWidth: 64 }}>
      <div className="v2-muted" style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
        {label}
      </div>
      <div
        className="v2-tabular"
        style={{
          fontSize: 13.5,
          fontWeight: 600,
          color: positive ? 'var(--v2-moss)' : 'var(--v2-ink)',
        }}
      >{value}</div>
    </div>
  );
}

function AudienceBar({ label, value, bar }: { label: string; value: string; bar: number }) {
  return (
    <div className="v2-storefront-audience-stat">
      <div className="v2-row" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
        <span className="v2-muted" style={{ fontSize: 12.5 }}>{label}</span>
        <span style={{ fontWeight: 600, fontSize: 13 }}>{value}</span>
      </div>
      <div className="v2-progress">
        <div className="v2-progress-fill" style={{ width: `${bar}%` }} />
      </div>
    </div>
  );
}
