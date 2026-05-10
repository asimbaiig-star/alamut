// CreatorHome.tsx — v2 creator-side home (redesigned per home-v2.jsx)
//
// Design philosophy: Money-first → action-second → growth-third.
// Layered: Earnings hero → Today list → Brief matches → Storefront
// pulse → Audience pulse → Goals + Tip of the day.
//
// Today list is derived from the live store: deliverables in_review,
// invitations awaiting response, KYC tasks pending. Brief matches pull
// open campaigns the creator hasn't already applied to.

import { useMemo } from 'react';
import { fmtUSD, fmtUSDfull, fmtFollowers, Icon, Topbar } from '../lib';
import {
  useV2AllCampaigns, useV2CreatorWallet, useV2CurrentCreator, useV2Creators,
  useV2MyCollabs,
} from '../v2Hooks';
import { creatorToV2 } from '../v2Adapters';
import { useStore } from '@/lib/api/store';
import type { V2Campaign, V2Creator } from '../data';
// P6 §5.6 — compute on read instead of reading the (now-removed)
// stored field.
import { computeProfileCompletion } from '@/lib/utils/profile-completion';

interface Props {
  onRoute: (r: string) => void;
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

export function CreatorHome({ onRoute }: Props) {
  const creator = useV2CurrentCreator();
  const allCreators = useV2Creators();
  const wallet = useV2CreatorWallet();
  const allCampaigns = useV2AllCampaigns();
  const myCollabs = useV2MyCollabs();
  const db = useStore((s) => s.db);

  const me = creator ? creatorToV2(creator) : allCreators[0];
  if (!me) {
    return (
      <>
        <Topbar title="Welcome" crumb="No creator profile linked" />
        <div className="v2-content">
          <p className="v2-muted">No creator profile resolved yet.</p>
        </div>
      </>
    );
  }

  // Today list — derive from real collab state
  const todoItems = useMemo(() => {
    type Item = { id: string; icon: string; urgent: boolean; title: string; sub: string; route: string };
    const items: Item[] = [];

    // 1. Deliverables in revision (highest priority).
    //    Direct-jump to upload modal on the relevant collab so the
    //    creator can resubmit in one click from the Today tile.
    for (const c of myCollabs) {
      const rev = c.deliverables.find((d) => d.status === 'revision');
      if (rev && items.length < 4) {
        const camp = allCampaigns.find((x) => x.id === c.campaignId);
        items.push({
          id: `rev_${c.id}`,
          icon: '✎',
          urgent: true,
          title: `Resubmit ${rev.label}`,
          sub: `${camp?.brand ?? 'Brand'} requested changes · due ${rev.due}`,
          route: `collab:${c.id}?action=upload`,
        });
      }
    }

    // 2. Pending deliverable uploads — same direct-jump to the upload
    //    modal so the Today tile is one click away from action.
    for (const c of myCollabs) {
      if (c.stage !== 'confirmed' && c.stage !== 'pitched') continue;
      const pending = c.deliverables.find((d) => d.status === 'pending');
      if (pending && items.length < 4) {
        const camp = allCampaigns.find((x) => x.id === c.campaignId);
        items.push({
          id: `pen_${c.id}`,
          icon: '↑',
          urgent: false,
          title: `Submit ${pending.label}`,
          sub: `${camp?.brand ?? 'Brand'} · ${fmtUSD(c.price)} in escrow · due ${pending.due}`,
          route: `collab:${c.id}?action=upload`,
        });
      }
    }

    // 3. Pending invitations / counters needing the creator's reply.
    //    'invited'    = brand cold-invited (no application).
    //    'negotiating' = there's an open offer (status='pending' OR
    //                    'countered' with brand's round latest — both mean
    //                    the creator has to act).
    //    Routes to CollabDetail where the StageActionBanner surfaces
    //    Accept / Counter / Decline.
    for (const c of myCollabs) {
      if (items.length >= 4) break;
      if (c.stage !== 'invited' && c.stage !== 'negotiating') continue;
      const camp = allCampaigns.find((x) => x.id === c.campaignId);
      if (!camp) continue;
      // Distinguish the three sub-cases for clearer copy.
      const offer = db.offers
        .filter((o) => o.campaignId === c.campaignId && o.creatorId === c.creatorId)
        .sort((a, b) => +new Date(b.sentAt) - +new Date(a.sentAt))[0];
      const lastRound = offer?.rounds[offer.rounds.length - 1];
      const isBrandCounter = offer?.status === 'countered' && lastRound?.by === 'brand';
      const title = isBrandCounter
        ? `${camp.brand} countered back`
        : c.stage === 'invited'
        ? `${camp.brand} invited you`
        : `${camp.brand} sent an offer`;
      const rate = c.price || offer?.rate || Math.round(camp.budget / Math.max(camp.creators.length || 4, 1));
      items.push({
        id: `inv_${c.id}`,
        icon: '✦',
        urgent: c.stage === 'negotiating',
        title,
        sub: `${camp.placement} · ${fmtUSD(rate)} · respond`,
        route: `collab:${c.id}`,
      });
    }

    // 4. Approved content waiting to be marked live. After the brand
    //    approves a submission, the creator has to actually post it on
    //    their platform and mark it live to release the second escrow
    //    milestone — easy to forget if it doesn't surface here.
    for (const c of myCollabs) {
      if (items.length >= 4) break;
      const approved = c.deliverables.find((d) => d.status === 'approved');
      if (!approved) continue;
      const camp = allCampaigns.find((x) => x.id === c.campaignId);
      if (!camp) continue;
      items.push({
        id: `live_${c.id}`,
        icon: '⤴',
        urgent: false,
        title: `Post ${approved.label} & mark live`,
        sub: `${camp.brand} approved · release final ${fmtUSD(Math.round(c.price * 0.5))} on go-live`,
        route: `collab:${c.id}?action=mark-live`,
      });
    }

    // 4. KYC if profile completion looks low (P6 §5.6 — compute on read)
    const completion = creator ? computeProfileCompletion(creator, db) : 100;
    if (creator && completion < 80 && items.length < 4) {
      items.push({
        id: 'kyc',
        icon: '✓',
        urgent: false,
        title: 'Complete KYC verification',
        sub: 'Unlock payouts above $1,000 · 2 minutes',
        route: 'kyc',
      });
    }

    return items;
  }, [myCollabs, allCampaigns, me.id, creator]);

  return (
    <>
      <Topbar
        title={`Hi ${me.name.split(' ')[0]}`}
        crumb={
          <span>
            {getGreeting()} from {me.city} ·{' '}
            <span style={{ color: 'var(--v2-moss)' }}>
              {fmtUSDfull(wallet.available)} ready to withdraw
            </span>
          </span>
        }
        actions={
          <button
            className="v2-btn v2-btn-primary"
            type="button"
            onClick={() => onRoute('storefront')}
          >
            {Icon.edit}<span>Edit storefront</span>
          </button>
        }
      />
      <div className="v2-content">
        {/* Money hero */}
        <EarningsHero wallet={wallet} onRoute={onRoute} />

        {/* Recent activity — cross-persona event feed sourced from
            db.notifications. Shows new offers, approvals, payouts,
            content-live confirmations as they happen. (s19) */}
        {(() => {
          const myUser = db.users.find((u) => u.creatorId === creator?.id);
          if (!myUser) return null;
          const items = db.notifications
            .filter((n) => n.userId === myUser.id)
            .sort((a, b) => +new Date(b.at) - +new Date(a.at))
            .slice(0, 5);
          if (items.length === 0) return null;
          return <CreatorRecentActivity items={items} onRoute={onRoute} />;
        })()}

        {/* Today + Brief matches */}
        <div className="v2-home-row" style={{ marginBottom: 32 }}>
          <TodayList items={todoItems} onRoute={onRoute} />
          <BriefMatches
            me={me}
            campaigns={allCampaigns}
            myCollabs={myCollabs}
            onRoute={onRoute}
          />
        </div>

        {/* Storefront pulse + Audience */}
        <div className="v2-home-row" style={{ marginBottom: 32 }}>
          <StorefrontPulse me={me} onRoute={onRoute} />
          <AudiencePulse me={me} onRoute={onRoute} />
        </div>

        {/* Goals + Tip */}
        <div className="v2-home-row" data-style="reverse">
          <CreatorGoals wallet={wallet} onRoute={onRoute} />
          <CreatorTip onRoute={onRoute} />
        </div>
      </div>
    </>
  );
}

// =====================================================================
// Earnings hero (gradient moss card)
// =====================================================================

function EarningsHero({ wallet, onRoute }: {
  wallet: ReturnType<typeof useV2CreatorWallet>;
  onRoute: (r: string) => void;
}) {
  // Simple sparkline points scaled to the "available" balance
  const sparkData = useMemo(() => {
    const peak = Math.max(wallet.available, 1500);
    return [0.4, 0.55, 0.72, 0.66, 0.85, 1.0].map((f) => Math.round(peak * f));
  }, [wallet.available]);
  const releasedToday = Math.round(wallet.available * 0.12);
  const releasesThisWeek = Math.round(wallet.available * 0.4);
  return (
    <div className="v2-card v2-home-earnings-hero">
      <div className="v2-home-earnings-glow" aria-hidden="true" />
      <div className="v2-home-earnings-grid">
        <div style={{ padding: 32 }}>
          <div className="v2-eyebrow" style={{ color: 'rgba(251,247,238,0.65)', marginBottom: 12 }}>
            This month
          </div>
          <div className="v2-row" style={{ alignItems: 'baseline', gap: 12, marginBottom: 8, flexWrap: 'wrap' }}>
            <div className="v2-tabular v2-home-earnings-amount">
              {fmtUSDfull(wallet.available)}
            </div>
            <div className="v2-home-earnings-delta">↑ 28% vs last month</div>
          </div>
          <p className="v2-home-earnings-sub">
            ready to withdraw · {fmtUSD(wallet.pending)} pending in escrow
          </p>
          <div className="v2-row" style={{ gap: 10, marginBottom: 20 }}>
            <button
              className="v2-btn v2-home-earnings-cta-primary"
              type="button"
              onClick={() => onRoute('creator-wallet')}
            >
              {Icon.send} Withdraw to bank
            </button>
            <button
              className="v2-btn v2-home-earnings-cta-secondary"
              type="button"
              onClick={() => onRoute('creator-wallet')}
            >
              View ledger
            </button>
          </div>
          <div className="v2-row v2-home-earnings-stats">
            <MiniStatLight label="Released today" value={fmtUSD(releasedToday)} sub={wallet.ledger[0]?.desc?.slice(0, 32) ?? '—'} />
            <MiniStatLight label="Releases this week" value={fmtUSD(releasesThisWeek)} sub={`${myDeliverableCount(wallet)} pending`} />
            <MiniStatLight label="Avg release time" value="< 48hr" sub="↑ from 5d last quarter" />
          </div>
        </div>
        <div className="v2-home-earnings-sparkline-pane">
          <div className="v2-eyebrow" style={{ color: 'rgba(251,247,238,0.65)', marginBottom: 14 }}>
            Last 6 months
          </div>
          <EarningsSparkline data={sparkData} />
          <div style={{ marginTop: 18, fontSize: 12.5, color: 'rgba(251,247,238,0.65)' }}>
            Lifetime: <strong style={{ color: 'white' }}>{fmtUSDfull(wallet.lifetime)}</strong> across collabs
          </div>
        </div>
      </div>
    </div>
  );
}

function myDeliverableCount(wallet: ReturnType<typeof useV2CreatorWallet>): string {
  const pendingCount = Math.max(0, Math.round(wallet.pending / 200));
  return `${pendingCount} deliverable${pendingCount === 1 ? '' : 's'} pending`;
}

function MiniStatLight({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="v2-home-mini-stat-light">
      <div className="v2-home-mini-stat-light-label">{label}</div>
      <div className="v2-home-mini-stat-light-value v2-tabular">{value}</div>
      <div className="v2-home-mini-stat-light-sub">{sub}</div>
    </div>
  );
}

function EarningsSparkline({ data }: { data: number[] }) {
  const max = Math.max(...data, 1);
  const w = 240;
  const h = 80;
  return (
    <svg viewBox={`0 0 ${w} ${h + 30}`} style={{ width: '100%', height: 100 }}>
      {data.map((v, i) => {
        const x = (i / Math.max(data.length - 1, 1)) * w;
        const y = h - (v / max) * (h - 10);
        const barH = h - y;
        const month = ['Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May'][i] ?? '';
        return (
          <g key={i}>
            <rect
              x={x - 14}
              y={y + 5}
              width="22"
              height={Math.max(barH - 5, 2)}
              fill={i === data.length - 1 ? 'var(--v2-accent)' : 'rgba(255,255,255,0.4)'}
              rx="3"
            />
            <text x={x} y={h + 18} textAnchor="middle" fill="rgba(255,255,255,0.55)" fontSize="10" fontWeight="500">
              {month}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// =====================================================================
// Recent activity (s19) — cross-persona feed for the creator.
// Mirrors the pattern in BrandHome: filter db.notifications by user id,
// render the latest 5, route to the linked campaign / deal.
// =====================================================================

interface CreatorActivityItem {
  id: string;
  text: string;
  at: string;
  href?: string;
  read?: boolean;
  meta?: { campaignId?: string; submissionId?: string; offerId?: string };
}

function CreatorRecentActivity({ items, onRoute }: {
  items: CreatorActivityItem[];
  onRoute: (r: string) => void;
}) {
  const fmtRel = (iso: string) => {
    const ms = Date.now() - +new Date(iso);
    const m = Math.floor(ms / 60_000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    if (d < 7) return `${d}d ago`;
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };
  return (
    <section className="v2-card v2-card-pad" style={{ marginBottom: 24 }}>
      <div className="v2-row" style={{ justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 12 }}>
        <div>
          <div className="v2-eyebrow">Recent activity</div>
          <p className="v2-muted" style={{ margin: '4px 0 0', fontSize: 12.5 }}>
            New offers, approvals, payouts, content going live — as it happens
          </p>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {items.map((n, i) => (
          <button
            key={n.id}
            type="button"
            style={{
              display: 'flex',
              padding: '12px 0',
              gap: 12,
              borderTop: i === 0 ? 'none' : '1px solid var(--v2-line)',
              background: 'transparent',
              border: i === 0 ? 'none' : undefined,
              textAlign: 'left',
              cursor: 'pointer',
              fontFamily: 'inherit',
              width: '100%',
              alignItems: 'center',
            }}
            onClick={() => {
              if (n.meta?.campaignId) onRoute(`brief:${n.meta.campaignId}`);
              else onRoute('creator-collabs');
            }}
          >
            <span
              style={{
                width: 8, height: 8, borderRadius: 50,
                background: n.read ? 'var(--v2-line)' : 'var(--v2-accent)',
                flexShrink: 0,
              }}
              aria-hidden="true"
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, color: 'var(--v2-ink-2)', lineHeight: 1.45 }}>
                {n.text}
              </div>
              <div className="v2-muted" style={{ fontSize: 11.5, marginTop: 2 }}>
                {fmtRel(n.at)}
              </div>
            </div>
            <span style={{ color: 'var(--v2-ink-3)', flexShrink: 0 }}>{Icon.arrow}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

// =====================================================================
// Today list
// =====================================================================

interface TodoItem {
  id: string;
  icon: string;
  urgent: boolean;
  title: string;
  sub: string;
  route: string;
}

function TodayList({ items, onRoute }: { items: TodoItem[]; onRoute: (r: string) => void }) {
  const urgent = items.filter((i) => i.urgent).length;
  return (
    <div className="v2-card v2-home-inbox">
      <header className="v2-home-inbox-head">
        <div>
          <div className="v2-eyebrow" style={{ color: 'var(--v2-accent)' }}>Today</div>
          <h3 style={{
            fontFamily: 'var(--v2-font-display)',
            fontSize: 18,
            fontWeight: 500,
            margin: '2px 0 0',
            letterSpacing: '-0.02em',
          }}>
            {items.length === 0
              ? 'Caught up — nothing pressing today'
              : `${items.length} thing${items.length === 1 ? '' : 's'} to take care of`}
          </h3>
        </div>
        {urgent > 0 && (
          <span className="v2-pill v2-pill-accent" style={{ fontSize: 11 }}>
            {urgent} urgent
          </span>
        )}
      </header>
      {items.length === 0 ? (
        <div className="v2-muted" style={{ padding: '32px 20px', textAlign: 'center', fontSize: 13 }}>
          You're all set. Browse new briefs to keep momentum.
        </div>
      ) : items.map((it) => (
        <button
          key={it.id}
          type="button"
          className="v2-home-today-row"
          onClick={() => onRoute(it.route)}
        >
          <div className={`v2-home-today-icon ${it.urgent ? 'is-urgent' : ''}`}>
            {it.icon}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 2 }}>{it.title}</div>
            <div className="v2-muted" style={{ fontSize: 12 }}>{it.sub}</div>
          </div>
          <span style={{ color: 'var(--v2-ink-3)' }}>{Icon.arrow}</span>
        </button>
      ))}
    </div>
  );
}

// =====================================================================
// Brief matches
// =====================================================================

function BriefMatches({ me, campaigns, myCollabs, onRoute }: {
  me: V2Creator;
  campaigns: V2Campaign[];
  myCollabs: ReturnType<typeof useV2MyCollabs>;
  onRoute: (r: string) => void;
}) {
  const open = useMemo(() => {
    const appliedIds = new Set(myCollabs.map((c) => c.campaignId));
    return campaigns
      .filter((c) => c.status !== 'Completed' && !appliedIds.has(c.id))
      .slice(0, 3)
      .map((c, i) => ({
        campaign: c,
        match: [94, 87, 72][i] ?? 70,
      }));
  }, [campaigns, myCollabs]);

  return (
    <div className="v2-card v2-home-inbox">
      <header className="v2-home-inbox-head">
        <div>
          <div className="v2-eyebrow">Briefs matching you</div>
          <h3 style={{
            fontFamily: 'var(--v2-font-display)',
            fontSize: 18,
            fontWeight: 500,
            margin: '2px 0 0',
            letterSpacing: '-0.02em',
          }}>
            {campaigns.filter((c) => c.status !== 'Completed').length} brand{campaigns.length === 1 ? '' : 's'} looking for your audience
          </h3>
        </div>
        <button
          className="v2-btn v2-btn-sm v2-btn-outline"
          type="button"
          onClick={() => onRoute('creator-campaigns')}
        >See all</button>
      </header>
      <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {open.length === 0 ? (
          <div className="v2-muted" style={{ padding: '20px 8px', fontSize: 13, textAlign: 'center' }}>
            No new briefs right now. We'll surface fresh matches when brands post.
          </div>
        ) : open.map(({ campaign, match }) => {
          void me; // me would feed into a real-match calculation
          const perCreator = Math.round(campaign.budget / Math.max(campaign.creators.length || 4, 1));
          return (
            <div key={campaign.id} className="v2-home-brief-match">
              <div className="v2-brand-mark-lg" style={{ width: 44, height: 44, fontSize: 18, borderRadius: 10 }}>
                {campaign.brand[0]?.toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="v2-row" style={{ gap: 6, alignItems: 'center' }}>
                  <span style={{ fontWeight: 600, fontSize: 13.5 }}>{campaign.brand}</span>
                  <span
                    className="v2-pill"
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      padding: '1px 6px',
                      background: match >= 85 ? 'var(--v2-moss-soft)' : 'var(--v2-bg-2)',
                      color: match >= 85 ? 'var(--v2-moss)' : 'var(--v2-ink-3)',
                    }}
                  >{match}% match</span>
                </div>
                <div className="v2-muted v2-home-brief-name">{campaign.name}</div>
                <div className="v2-row" style={{ gap: 8, marginTop: 4 }}>
                  <span className="v2-tabular" style={{ fontSize: 12, fontWeight: 600, color: 'var(--v2-moss)' }}>
                    {fmtUSD(perCreator)}
                  </span>
                  <span className="v2-muted" style={{ fontSize: 11 }}>
                    · Due {new Date(campaign.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                </div>
              </div>
              <button
                className="v2-btn v2-btn-sm v2-btn-primary"
                type="button"
                onClick={() => onRoute(`brief:${campaign.id}`)}
              >Apply</button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// =====================================================================
// Storefront pulse
// =====================================================================

function StorefrontPulse({ me, onRoute }: { me: V2Creator; onRoute: (r: string) => void }) {
  return (
    <div className="v2-card v2-card-pad-lg">
      <div className="v2-row" style={{ justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <div className="v2-eyebrow">Your storefront</div>
          <h3 style={{
            fontFamily: 'var(--v2-font-display)',
            fontSize: 20,
            fontWeight: 500,
            margin: '2px 0 0',
            letterSpacing: '-0.02em',
          }}>
            alamut.co/<span style={{ color: 'var(--v2-accent)' }}>@{me.handle}</span>
          </h3>
        </div>
        <button
          className="v2-btn v2-btn-sm v2-btn-outline"
          type="button"
          onClick={() => onRoute(`public:${me.handle}`)}
        >{Icon.external}</button>
      </div>
      <div className="v2-grid-3" style={{ gap: 12, marginBottom: 16 }}>
        <PulseStat n="2,140" l="views" sub="↑ 28% / 30d" />
        <PulseStat n="14" l="brand inquiries" sub="↑ 4 this week" />
        <PulseStat n={`${(me.score / 20).toFixed(1)}`} l="avg rating" sub="from 23 collabs" />
      </div>
      <div className="v2-home-storefront-viewers">
        <div className="v2-eyebrow" style={{ marginBottom: 6 }}>Recent brand viewers</div>
        <div className="v2-row" style={{ gap: 0, alignItems: 'center' }}>
          {['S', 'F', 'P', 'B'].map((l, i) => (
            <div
              key={i}
              className="v2-home-viewer-dot"
              style={{
                background: ['var(--v2-accent)', 'var(--v2-moss)', 'var(--v2-gold)', 'var(--v2-info)'][i],
                marginLeft: i === 0 ? 0 : -8,
              }}
            >{l}</div>
          ))}
          <span className="v2-muted" style={{ fontSize: 12, marginLeft: 12 }}>
            Sapphire, Foodpanda, PostEx, Bykea + 8 more
          </span>
        </div>
      </div>
      <div className="v2-home-storefront-suggestion">
        <div className="v2-eyebrow" style={{ color: 'var(--v2-accent)', marginBottom: 4 }}>
          <span style={{ marginRight: 4 }}>{Icon.spark}</span>Spark suggestion
        </div>
        <span style={{ color: 'var(--v2-ink-2)', fontSize: 13, lineHeight: 1.45 }}>
          Add a "case study" block — creators with case studies get 2.4× more inquiries.
        </span>
        <button
          className="v2-btn v2-btn-sm v2-btn-accent"
          type="button"
          style={{ marginLeft: 8 }}
          onClick={() => onRoute('storefront')}
        >Add now</button>
      </div>
    </div>
  );
}

function PulseStat({ n, l, sub }: { n: string; l: string; sub: string }) {
  return (
    <div>
      <div
        className="v2-tabular"
        style={{
          fontFamily: 'var(--v2-font-display)',
          fontSize: 28,
          fontWeight: 500,
          letterSpacing: '-0.02em',
          lineHeight: 1,
          marginBottom: 4,
        }}
      >{n}</div>
      <div style={{ fontSize: 12, fontWeight: 550, marginBottom: 1 }}>{l}</div>
      <div className="v2-muted" style={{ fontSize: 11 }}>{sub}</div>
    </div>
  );
}

// =====================================================================
// Audience pulse
// =====================================================================

function AudiencePulse({ me, onRoute }: { me: V2Creator; onRoute: (r: string) => void }) {
  const totalReach = me.channels.reduce((s, ch) => s + ch.followers, 0);
  const avgEr = (me.channels.reduce((s, ch) => s + ch.engagement, 0) / Math.max(me.channels.length, 1)).toFixed(1);
  const fakeWeekGrowth = Math.round(totalReach * 0.005);

  return (
    <div className="v2-card v2-card-pad-lg">
      <div className="v2-row" style={{ justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <div className="v2-eyebrow">Your audience</div>
          <h3 style={{
            fontFamily: 'var(--v2-font-display)',
            fontSize: 20,
            fontWeight: 500,
            margin: '2px 0 0',
            letterSpacing: '-0.02em',
          }}>
            {fmtFollowers(totalReach)} · ↑ {fakeWeekGrowth.toLocaleString()} this week
          </h3>
        </div>
        <button
          className="v2-btn v2-btn-sm v2-btn-outline"
          type="button"
          onClick={() => onRoute('analytics')}
        >Analytics</button>
      </div>
      <div style={{ marginBottom: 16 }}>
        <FollowerSparkline />
      </div>
      <div className="v2-row" style={{ gap: 16, marginBottom: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 180px', minWidth: 0 }}>
          <div className="v2-eyebrow" style={{ marginBottom: 6 }}>Top regions</div>
          <BarRow label="Karachi" pct={42} />
          <BarRow label="Lahore" pct={28} />
          <BarRow label="Islamabad" pct={14} />
        </div>
        <div style={{ flex: '1 1 180px', minWidth: 0 }}>
          <div className="v2-eyebrow" style={{ marginBottom: 6 }}>Last post</div>
          <div className="v2-tabular" style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em', marginBottom: 4 }}>
            {avgEr}%
          </div>
          <div className="v2-muted" style={{ fontSize: 12, marginBottom: 8 }}>
            ER · vs 4.2% niche avg
          </div>
          <div className="v2-home-best-time">
            🎯 Best time to post: tomorrow 9 PM
          </div>
        </div>
      </div>
    </div>
  );
}

function FollowerSparkline() {
  const data = [298, 305, 310, 318, 325, 334, 342];
  const min = Math.min(...data);
  const max = Math.max(...data);
  const w = 320;
  const h = 50;
  const path = data.map((v, i) => {
    const x = (i / Math.max(data.length - 1, 1)) * w;
    const y = h - ((v - min) / Math.max(max - min, 1)) * h;
    return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
  }).join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: 50 }}>
      <defs>
        <linearGradient id="v2-fg2" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--v2-moss)" stopOpacity="0.3" />
          <stop offset="100%" stopColor="var(--v2-moss)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${path} L ${w} ${h} L 0 ${h} Z`} fill="url(#v2-fg2)" />
      <path d={path} fill="none" stroke="var(--v2-moss)" strokeWidth="2.5" />
    </svg>
  );
}

function BarRow({ label, pct }: { label: string; pct: number }) {
  return (
    <div style={{ marginBottom: 6 }}>
      <div className="v2-row" style={{ justifyContent: 'space-between', marginBottom: 3 }}>
        <span style={{ fontSize: 12 }}>{label}</span>
        <span className="v2-tabular" style={{ fontSize: 11, color: 'var(--v2-ink-3)' }}>{pct}%</span>
      </div>
      <div className="v2-progress" style={{ height: 4 }}>
        <div className="v2-progress-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// =====================================================================
// Goals + Tip
// =====================================================================

function CreatorGoals({ wallet, onRoute }: {
  wallet: ReturnType<typeof useV2CreatorWallet>;
  onRoute: (r: string) => void;
}) {
  void onRoute;
  const target = 2500; // synthetic monthly target
  const earned = wallet.available + wallet.pending;
  const pct = Math.min(100, Math.round((earned / target) * 100));
  return (
    <div className="v2-card v2-card-pad-lg">
      <div className="v2-row" style={{ justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <div className="v2-eyebrow">This month's goals</div>
          <h3 style={{
            fontFamily: 'var(--v2-font-display)',
            fontSize: 20,
            fontWeight: 500,
            margin: '2px 0 0',
            letterSpacing: '-0.02em',
          }}>
            You're {pct}% to your monthly target 🎯
          </h3>
        </div>
        <span className="v2-pill v2-pill-moss" style={{ fontSize: 11 }}>Silver tier</span>
      </div>
      <div className="v2-home-goal-card">
        <div className="v2-row" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>Earnings goal</span>
          <span className="v2-tabular v2-muted" style={{ fontSize: 13 }}>
            {fmtUSD(earned)} / {fmtUSD(target)}
          </span>
        </div>
        <div className="v2-progress" style={{ marginBottom: 6, height: 6 }}>
          <div
            className="v2-progress-fill"
            style={{ width: `${pct}%`, background: 'var(--v2-moss)' }}
          />
        </div>
        <div className="v2-muted" style={{ fontSize: 11.5 }}>
          {fmtUSD(Math.max(0, target - earned))} to go · ~1 mid-tier collab
        </div>
      </div>
      <div className="v2-grid-3" style={{ gap: 8 }}>
        <Achievement icon="✦" label="3 collabs" sub="this month" done />
        <Achievement icon="↑" label="11% ER" sub="hit target" done />
        <Achievement icon="◆" label="Gold tier" sub={`${fmtUSD(Math.max(0, target - earned))} to unlock`} />
      </div>
      <div className="v2-home-streak">
        <strong>Streak: 4 weeks</strong>
        <span className="v2-muted">
          {' '}· Replied to all briefs within 24h. Keep it up to unlock Pro Replies.
        </span>
      </div>
    </div>
  );
}

function Achievement({ icon, label, sub, done }: { icon: string; label: string; sub: string; done?: boolean }) {
  return (
    <div className={`v2-home-achievement ${done ? 'is-done' : ''}`}>
      <div className="v2-home-achievement-icon" style={{ opacity: done ? 1 : 0.4 }}>{icon}</div>
      <div className="v2-home-achievement-label">{label}</div>
      <div className="v2-muted" style={{ fontSize: 10 }}>{sub}</div>
    </div>
  );
}

function CreatorTip({ onRoute }: { onRoute: (r: string) => void }) {
  return (
    <div className="v2-card v2-home-tip">
      <div className="v2-card-pad-lg">
        <div className="v2-eyebrow" style={{ color: 'var(--v2-accent)', marginBottom: 8 }}>
          Tip of the day
        </div>
        <h3 style={{
          fontFamily: 'var(--v2-font-display)',
          fontSize: 20,
          fontWeight: 500,
          margin: '0 0 12px',
          letterSpacing: '-0.02em',
          lineHeight: 1.2,
        }}>
          Brands pay 30% more for creators who reply within 6 hours.
        </h3>
        <p style={{ margin: '0 0 16px', fontSize: 13.5, color: 'var(--v2-ink-2)', lineHeight: 1.5 }}>
          Your average reply is 18hr. Set up Inbox notifications to push so urgent
          briefs reach you faster — it'll move you into the &lt;6h tier.
        </p>
        <div className="v2-row" style={{ gap: 8 }}>
          <button
            className="v2-btn v2-btn-primary v2-btn-sm"
            type="button"
            onClick={() => onRoute('creator-inbox')}
          >Set up alerts</button>
          <button className="v2-btn v2-btn-ghost v2-btn-sm" type="button">More tips</button>
        </div>
      </div>
      <div className="v2-home-tip-foot">
        <div
          className="v2-avatar v2-avatar-sm"
          style={{ backgroundImage: 'url(https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=200&q=80)' }}
          aria-hidden="true"
        />
        <div style={{ fontSize: 12, color: 'var(--v2-ink-3)' }}>
          From <strong style={{ color: 'var(--v2-ink)' }}>Areeba Khan</strong>'s playbook · top 1% creator
        </div>
      </div>
    </div>
  );
}
