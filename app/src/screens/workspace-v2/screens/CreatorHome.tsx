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
import { matchCreatorToCampaign } from '../matching';
import { useStore } from '@/lib/api/store';
import type { V2Campaign, V2Creator } from '../data';
import { RecentActivityCard } from './BrandHome';
import { useRecentActivity } from '../useRecentActivity';
import { buildSteps as buildKycSteps } from './KycTax';
// P6 §5.6 — compute on read instead of reading the (now-removed)
// stored field.

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

  // Recent activity items — derived from server state, see useRecentActivity.
  const myUserId = useMemo(
    () => db.users.find((u) => u.creatorId === creator?.id)?.id ?? null,
    [db.users, creator?.id],
  );
  const recentActivityItems = useRecentActivity(myUserId, { limit: 5 });

  // Today list — derive from real collab state
  const todoItems = useMemo(() => {
    type Item = { id: string; icon: string; urgent: boolean; title: string; sub: string; route: string };
    const items: Item[] = [];

    // 1. Deliverables in revision (highest priority).
    //    Direct-jump to upload modal on the relevant collab so the
    //    creator can resubmit in one click from the Today tile.
    // Phase 51 — pre-fix this generator capped at 4 items per-source,
    // hiding genuine work from creators with active pipelines. Cap
    // removed; TodayList renders all items in a scrollable container.
    for (const c of myCollabs) {
      const rev = c.deliverables.find((d) => d.status === 'revision');
      if (rev) {
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
      if (pending) {
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

    // 4. Approved content waiting to be posted live. After the brand
    //    approves (which already released the payout to the wallet —
    //    P67 honest-copy fix), the creator has to actually post on
    //    their platform AND paste the public URL back here — that
    //    triggers the brand's verify-and-confirm flow. Deep-link to
    //    `?action=mark-live` pops CollabDetail's CreatorMarkLiveModal.
    //    Only surface this for submissions that are approved AND have
    //    no permalink yet; once the creator pastes a URL the brand owns
    //    the next action (verify + confirm live).
    for (const c of myCollabs) {
      const hasApprovedAwaitingPost = db.submissions.some((s) =>
        s.campaignId === c.campaignId &&
        s.creatorId === c.creatorId &&
        s.status === 'approved' &&
        !s.permalink,
      );
      if (!hasApprovedAwaitingPost) continue;
      const camp = allCampaigns.find((x) => x.id === c.campaignId);
      if (!camp) continue;
      items.push({
        id: `live_${c.id}`,
        icon: '⤴',
        urgent: false,
        title: `Post & mark live`,
        sub: `${camp.brand} approved · post it and paste the live URL to wrap up`,
        route: `collab:${c.id}?action=mark-live`,
      });
    }

    // 5. KYC if profile completion is incomplete. Deep-links to KycTax
    //    with `?action=next-step` which scrolls to + pulse-highlights
    //    the first incomplete step — distinct from the sidebar entry
    //    that just opens the page header.
    //
    // Pre-fix the tile rendered unconditionally as long as a creator
    // record existed — so a fully-verified creator still saw a stale
    // "Complete KYC verification" prompt on home. Now we ask the same
    // step builder KycTax uses, count remaining non-verified non-locked
    // steps, and only show the tile when there's actually work to do.
    if (creator) {
      const hasPaidCollab = myCollabs.some((c) => c.stage === 'paid');
      const steps = buildKycSteps(creator, hasPaidCollab);
      const pendingSteps = steps.filter((s) => s.status === 'action' || s.status === 'pending').length;
      if (pendingSteps > 0) {
        items.push({
          id: 'kyc',
          icon: '✓',
          urgent: false,
          title: pendingSteps === 1
            ? 'One KYC step left to unlock payouts'
            : `${pendingSteps} KYC steps left to unlock payouts`,
          sub: 'Unlock payouts above $1,000 · 2 minutes',
          route: 'kyc?action=next-step',
        });
      }
    }

    // 6. P-8 — storefront materially incomplete. Onboarding can be
    //    abandoned (or skipped outright) with nothing pulling the creator
    //    back, which leaves a storefront that can't win work: brands see no
    //    bio and no proof of audience, and fit can't even be scored without
    //    a category and a channel (see matching.ts). Surfaced here because
    //    Today is the list creators actually act on.
    if (creator) {
      const gaps: string[] = [];
      if ((creator.platforms ?? []).length === 0) gaps.push('a channel');
      if (!creator.bio?.trim()) gaps.push('a bio');
      if ((creator.categories ?? []).length === 0) gaps.push('a category');
      if (gaps.length > 0) {
        const list = gaps.length === 1
          ? gaps[0]
          : `${gaps.slice(0, -1).join(', ')} and ${gaps[gaps.length - 1]}`;
        items.push({
          id: 'storefront-gaps',
          icon: '◗',
          // Urgent when there's no channel at all — without one the
          // storefront has no proof of audience and briefs can't be matched.
          urgent: (creator.platforms ?? []).length === 0,
          title: `Add ${list} to your storefront`,
          sub: 'Brands see this first — and briefs can’t be matched to you without it',
          route: 'storefront',
        });
      }
    }

    return items;
  }, [myCollabs, allCampaigns, me.id, creator, db]);

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
        <EarningsHero wallet={wallet} myCollabs={myCollabs} onRoute={onRoute} />

        {/* Recent activity — cross-persona event feed derived from
            server-persisted state (collab history + transactions +
            reviews) via useRecentActivity. Cross-device consistent.
            Shows new offers, approvals, payouts, content-live
            confirmations as they happen. (s19) */}
        {recentActivityItems.length > 0 && (
          <CreatorRecentActivity items={recentActivityItems} onRoute={onRoute} />
        )}


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

        {/* Saved for later — only rendered when the creator has bookmarked
            at least one brief from the Browse campaigns CampaignTile. */}
        <SavedForLater
          me={me}
          campaigns={allCampaigns}
          onRoute={onRoute}
        />

        {/* Storefront pulse + Audience */}
        <div className="v2-home-row" style={{ marginBottom: 32 }}>
          <StorefrontPulse me={me} onRoute={onRoute} />
          <AudiencePulse me={me} onRoute={onRoute} />
        </div>

        {/* Goals + Tip */}
        <div className="v2-home-row" data-style="reverse">
          <CreatorGoals wallet={wallet} me={me} myCollabs={myCollabs} onRoute={onRoute} />
          <CreatorTip me={me} onRoute={onRoute} />
        </div>
      </div>
    </>
  );
}

// =====================================================================
// Earnings hero (gradient moss card)
// =====================================================================

function EarningsHero({ wallet, myCollabs, onRoute }: {
  wallet: ReturnType<typeof useV2CreatorWallet>;
  myCollabs: ReturnType<typeof useV2MyCollabs>;
  onRoute: (r: string) => void;
}) {
  const db = useStore((s) => s.db);
  const session = useStore((s) => s.session);

  // Derive month-over-month earnings + recent activity from the
  // transactions ledger instead of the prior `wallet.available * %`
  // placeholders. All values reflect real db state.
  const stats = useMemo(() => {
    const me = session ? db.users.find((u) => u.id === session.userId) : null;
    const myUserId = me?.id;
    const now = new Date();
    const thisMonthStart = +new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = +new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const weekStart = Date.now() - 7 * 24 * 3600_000;
    const todayStart = +new Date(now.getFullYear(), now.getMonth(), now.getDate());

    let thisMonth = 0, lastMonth = 0, week = 0, today = 0;
    const payoutLags: number[] = []; // ms between submitted_at and payout
    const monthly = new Array(6).fill(0); // 6-month sparkline

    for (const t of db.transactions) {
      if (t.kind !== 'payout' || t.status !== 'cleared') continue;
      if (myUserId && t.userId !== myUserId) continue;
      const at = +new Date(t.at);
      const amt = Math.abs(t.amount);
      if (at >= thisMonthStart) thisMonth += amt;
      if (at >= lastMonthStart && at < thisMonthStart) lastMonth += amt;
      if (at >= weekStart) week += amt;
      if (at >= todayStart) today += amt;
      // Monthly bucket — 0 = 5 months ago, 5 = current month.
      const ageMonths = (now.getFullYear() - new Date(t.at).getFullYear()) * 12
        + (now.getMonth() - new Date(t.at).getMonth());
      if (ageMonths >= 0 && ageMonths < 6) monthly[5 - ageMonths] += amt;
      // Payout lag — find the matching submission's submittedAt for this campaign/user.
      const sub = db.submissions.find((s) =>
        s.campaignId === t.campaignId &&
        s.status === 'approved' &&
        db.creators.find((c) => c.id === s.creatorId)?.userId === t.userId,
      );
      if (sub) payoutLags.push(at - +new Date(sub.submittedAt));
    }

    const delta = lastMonth > 0 ? Math.round(((thisMonth - lastMonth) / lastMonth) * 100) : null;
    const avgLagMs = payoutLags.length > 0
      ? payoutLags.reduce((s, x) => s + x, 0) / payoutLags.length
      : 0;
    const avgLagHours = Math.round(avgLagMs / 3600_000);

    // Month labels — rolling 6, ending on current month.
    const months = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      return d.toLocaleString('en-US', { month: 'short' });
    });

    return {
      thisMonthDelta: delta,
      releasedToday: today,
      releasesThisWeek: week,
      avgLagHours,
      sparkData: monthly,
      monthLabels: months,
    };
  }, [db, session]);

  // Sparkline points — the creator's REAL monthly payout totals, always.
  //
  // F20 (round 2). This used to fabricate a curve when there was no payout
  // history: `Math.max(wallet.available, 1500)` scaled by a hardcoded
  // rising ramp `[0.4, 0.55, 0.72, 0.66, 0.85, 1.0]`. On a brand-new $0
  // account that drew a confident $600 → $1,500 climb immediately above
  // the words "Lifetime: $0" — inventing six months of earnings for
  // someone who had never been paid.
  //
  // The Phase C fix added an honest empty state inside EarningsSparkline,
  // but it never fired: this fallback meant the component never received
  // zeros. Passing the real series through is what actually fixes it.
  const sparkData = stats.sparkData;

  const deltaCopy = stats.thisMonthDelta === null
    ? 'no prior data yet'
    : stats.thisMonthDelta >= 0
      ? `↑ ${stats.thisMonthDelta}% vs last month`
      : `↓ ${Math.abs(stats.thisMonthDelta)}% vs last month`;
  const lagCopy = stats.avgLagHours === 0
    ? '—'
    : stats.avgLagHours < 48
      ? `< 48hr`
      : `${Math.round(stats.avgLagHours / 24)}d`;
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
            <div className="v2-home-earnings-delta">{deltaCopy}</div>
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
            <MiniStatLight label="Released today" value={fmtUSD(stats.releasedToday)} sub={wallet.ledger[0]?.desc?.slice(0, 32) ?? '—'} />
            <MiniStatLight label="Releases this week" value={fmtUSD(stats.releasesThisWeek)} sub={myDeliverableCount(myCollabs)} />
            <MiniStatLight label="Avg release time" value={lagCopy} sub={stats.avgLagHours > 0 ? 'submission → payout' : 'no payouts yet'} />
          </div>
        </div>
        <div className="v2-home-earnings-sparkline-pane">
          <div className="v2-eyebrow" style={{ color: 'rgba(251,247,238,0.65)', marginBottom: 14 }}>
            Last 6 months
          </div>
          <EarningsSparkline data={sparkData} monthLabels={stats.monthLabels} />
          <div style={{ marginTop: 18, fontSize: 12.5, color: 'rgba(251,247,238,0.65)' }}>
            Lifetime: <strong style={{ color: 'white' }}>{fmtUSDfull(wallet.lifetime)}</strong> across collabs
          </div>
        </div>
      </div>
    </div>
  );
}

/** Real count of "pending" deliverables across the creator's active
 *  collabs. Pre-fix this was `Math.round(wallet.pending / 200)` — a
 *  random division of the pending wallet balance that had nothing to
 *  do with actual deliverables. The MyCollabs surface showed the
 *  truth (3 in-flight slots); this stat said 17 because $3,400 / 200.
 *  Now both surfaces agree. Pending here means: needs action by the
 *  creator (pending) OR feedback addressed (revision); in_review is
 *  excluded since it's on the brand's side, not the creator's. */
function myDeliverableCount(myCollabs: ReturnType<typeof useV2MyCollabs>): string {
  const n = myCollabs.reduce(
    (s, c) => s + c.deliverables.filter((d) => d.status === 'pending' || d.status === 'revision').length,
    0,
  );
  return `${n} deliverable${n === 1 ? '' : 's'} pending`;
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

function EarningsSparkline({ data, monthLabels }: { data: number[]; monthLabels: string[] }) {
  const max = Math.max(...data, 1);
  const w = 240;
  const h = 80;
  // F20 — a brand-new creator has six $0 months, but the bar height floor
  // (`Math.max(barH - 5, 2)`) still drew a visible stub for each one, so
  // the chart implied six months of earnings history on a $0 account. Say
  // there's nothing yet instead of drawing a lie.
  if (!data.some((v) => v > 0)) {
    return (
      <div
        style={{
          height: 100, display: 'flex', alignItems: 'center', justifyContent: 'center',
          textAlign: 'center', fontSize: 12.5, color: 'rgba(251,247,238,0.55)',
          border: '1px dashed rgba(251,247,238,0.18)', borderRadius: 10, padding: '0 16px',
        }}
      >
        No earnings yet — your first payout will show up here.
      </div>
    );
  }
  return (
    <svg viewBox={`0 0 ${w} ${h + 30}`} style={{ width: '100%', height: 100 }}>
      {data.map((v, i) => {
        const x = (i / Math.max(data.length - 1, 1)) * w;
        const y = h - (v / max) * (h - 10);
        const barH = h - y;
        const month = monthLabels[i] ?? '';
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
  return (
    <RecentActivityCard
      items={items}
      onRoute={onRoute}
      fallbackRoute="creator-collabs"
      campaignRoutePrefix="brief:"
      subtitle="New offers, approvals, payouts, content going live — as it happens"
    />
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
      ) : (
        <div style={{ maxHeight: 360, overflowY: 'auto' }}>
          {items.map((it) => (
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
      )}
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
  const db = useStore((s) => s.db);
  const open = useMemo(() => {
    // Pre-fix the match score was positional — the top open brief was
    // always 94%, the second 87%, the third 72%, regardless of fit.
    // Now we compute the real per-(creator, campaign) score via
    // computeMatchScore (lifted from BriefDetail), rank by it, and
    // surface the top 3 matches.
    // Now shares the single scorer in ../matching. `match` is null when
    // the creator's profile has too little signal to judge fit — in that
    // case we fall back to recency rather than fabricating a ranking, and
    // the tile shows what to add instead of a made-up percentage.
    const appliedIds = new Set(myCollabs.map((c) => c.campaignId));
    const rawMe = db.creators.find((c) => c.id === me.id) ?? null;
    const scored = campaigns
      .filter((c) => c.status !== 'Completed' && !appliedIds.has(c.id))
      .map((c) => {
        const raw = db.campaigns.find((x) => x.id === c.id);
        const perCreator = Math.round(c.budget / Math.max(c.creators.length, 4));
        const { score, insufficient } = matchCreatorToCampaign(rawMe, raw, db, perCreator);
        return { campaign: c, match: score, insufficient };
      });
    const rankable = scored.some((s) => s.match !== null);
    return (rankable
      ? scored.sort((a, b) => (b.match ?? -1) - (a.match ?? -1))
      : scored.sort((a, b) => +new Date(b.campaign.createdAt) - +new Date(a.campaign.createdAt))
    ).slice(0, 3);
  }, [campaigns, myCollabs, me, db]);

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
            {(() => {
              // Pluralize off the filtered (open-brief) count, not the
              // total campaigns count — pre-fix 1 open + 5 total read
              // "1 brands looking for your audience".
              //
              // Same overclaim class as Discover's "115 of 115 match"
              // (P-10): "looking for YOUR audience" asserted that every
              // open brief targets this specific creator, which nothing
              // establishes — especially for a creator with no categories
              // or channels. State the count, not a claim about fit.
              const n = campaigns.filter((c) => c.status !== 'Completed').length;
              return `${n} open brief${n === 1 ? '' : 's'} on Alamut right now`;
            })()}
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
        ) : open.map(({ campaign, match, insufficient }) => {
          const perCreator = Math.round(campaign.budget / Math.max(campaign.creators.length || 4, 1));
          return (
            <div key={campaign.id} className="v2-home-brief-match">
              <div className="v2-brand-mark-lg" style={{ width: 44, height: 44, fontSize: 18, borderRadius: 10 }}>
                {campaign.brand[0]?.toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="v2-row" style={{ gap: 6, alignItems: 'center' }}>
                  <span style={{ fontWeight: 600, fontSize: 13.5 }}>{campaign.brand}</span>
                  {/* F19 — flag seeded brands here too; this tile is where
                      most creators meet their first brief. */}
                  {campaign.brandIsDemo && (
                    <span
                      className="v2-pill"
                      style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px' }}
                      title="Sample content — this brand is part of the Alamut demo and won't respond to applications."
                    >Demo</span>
                  )}
                  <span
                    className="v2-pill"
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      padding: '1px 6px',
                      background: match !== null && match >= 85 ? 'var(--v2-moss-soft)' : 'var(--v2-bg-2)',
                      color: match !== null && match >= 85 ? 'var(--v2-moss)' : 'var(--v2-ink-3)',
                    }}
                    // `match === null` means there isn't enough profile
                    // signal to score honestly; the hint names the fix.
                    title={match === null ? insufficient : undefined}
                  >{match === null ? 'fit unknown' : `${match}% match`}</span>
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
  // Read raw Creator from the store for storefront-pulse fields that
  // the V2 adapter doesn't carry (storefrontViewsLast30d,
  // brandInquiriesThisWeek, recentBrandViewerNames). Pre-fix these were
  // hardcoded literals ("2,140 views ↑28% / 30d", "14 brand inquiries
  // ↑4", "S/F/P/B" letter dots + "Sapphire, Foodpanda, PostEx, Bykea
  // + 8 more") that lied identically for every creator. Now per-creator
  // seeded values render, so Sarah's demo numbers stay healthy while
  // generated creators get tier-scaled signals.
  const db = useStore((s) => s.db);
  const rawMe = db.creators.find((c) => c.id === me.id);
  const views = rawMe?.storefrontViewsLast30d ?? 0;
  const viewsDelta = rawMe?.storefrontViewsDeltaPct ?? 0;
  const inquiries = rawMe?.brandInquiriesThisWeek ?? 0;
  const inquiriesDelta = rawMe?.brandInquiriesDelta ?? 0;
  const viewerNames = rawMe?.recentBrandViewerNames ?? [];
  const viewerTotal = rawMe?.recentBrandViewerCount ?? viewerNames.length;
  const dotPalette = ['var(--v2-accent)', 'var(--v2-moss)', 'var(--v2-gold)', 'var(--v2-info)'];
  const dotInitials = viewerNames.slice(0, 4).map((n) => n.charAt(0).toUpperCase());
  const viewerLabel = viewerNames.length === 0
    ? 'No recent viewers — share your storefront to attract brands.'
    : viewerNames.length <= 4
      ? viewerNames.join(', ')
      : `${viewerNames.slice(0, 4).join(', ')} + ${viewerTotal - 4} more`;

  // Real review count from db.reviews so the "from N collabs" sub-line
  // matches reality.
  const reviewCount = db.reviews?.filter(
    (r) => r.reviewType === 'creator' && r.targetId === me.id,
  ).length ?? 0;

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
        <PulseStat
          n={views.toLocaleString()}
          l="views"
          sub={viewsDelta === 0 ? '— vs last 30d' : `${viewsDelta > 0 ? '↑' : '↓'} ${Math.abs(viewsDelta)}% / 30d`}
        />
        <PulseStat
          n={inquiries.toString()}
          l="brand inquiries"
          sub={inquiriesDelta === 0 ? 'same as last week' : `${inquiriesDelta > 0 ? '↑' : '↓'} ${Math.abs(inquiriesDelta)} this week`}
        />
        <PulseStat
          n={me.score === null ? '—' : `${(me.score / 20).toFixed(1)}`}
          l="avg rating"
          sub={reviewCount > 0 ? `from ${reviewCount} collab${reviewCount === 1 ? '' : 's'}` : 'no reviews yet'}
        />
      </div>
      <div className="v2-home-storefront-viewers">
        <div className="v2-eyebrow" style={{ marginBottom: 6 }}>Recent brand viewers</div>
        <div className="v2-row" style={{ gap: 0, alignItems: 'center' }}>
          {dotInitials.map((l, i) => (
            <div
              key={i}
              className="v2-home-viewer-dot"
              style={{
                background: dotPalette[i % dotPalette.length],
                marginLeft: i === 0 ? 0 : -8,
              }}
            >{l}</div>
          ))}
          <span className="v2-muted" style={{ fontSize: 12, marginLeft: dotInitials.length > 0 ? 12 : 0 }}>
            {viewerLabel}
          </span>
        </div>
      </div>
      {/* Spark "Add a case study block" suggestion removed: it routed to
          the Storefront page, where no case-study block exists. Either
          a feature to build separately or a tip to delete — we picked
          delete so the affordance doesn't promise something it can't
          deliver. */}
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

  // Read raw creator from store so we can use the per-platform audience
  // demographics (V2Creator strips them). Pre-fix this section showed
  // Karachi/Lahore/Islamabad + a fixed [298, 305, ..., 342] sparkline +
  // "Best time to post: tomorrow 9 PM" for every creator regardless of
  // where their audience actually lives.
  const db = useStore((s) => s.db);
  const rawMe = db.creators.find((c) => c.id === me.id);
  // Pick the primary platform (highest follower count) for audience data
  const primary = rawMe?.platforms.slice().sort((a, b) => b.followers - a.followers)[0];
  const audience = primary?.audience;
  // Real weekly growth: convert 30d growth rate to a weekly delta.
  const weekGrowthPct = audience?.growthRate30d != null ? audience.growthRate30d / 4 : 0;
  const weekGrowth = Math.max(0, Math.round(totalReach * (weekGrowthPct / 100)));
  // Top regions: convert percentages 0–1 to display percentages.
  const topRegions = (audience?.topCountries ?? []).slice(0, 3);

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
            {fmtFollowers(totalReach)}
            {weekGrowth > 0 && (
              <> · <span style={{ color: 'var(--v2-moss)' }}>↑ {weekGrowth.toLocaleString()} this week</span></>
            )}
          </h3>
        </div>
        <button
          className="v2-btn v2-btn-sm v2-btn-outline"
          type="button"
          onClick={() => onRoute('analytics')}
        >Analytics</button>
      </div>
      <div style={{ marginBottom: 16 }}>
        <FollowerSparkline reach={totalReach} growthRate30d={audience?.growthRate30d ?? 0} />
      </div>
      <div className="v2-row" style={{ gap: 16, marginBottom: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 180px', minWidth: 0 }}>
          <div className="v2-eyebrow" style={{ marginBottom: 6 }}>Top regions</div>
          {topRegions.length > 0 ? (
            topRegions.map((r) => (
              <BarRow key={r.country} label={r.country} pct={Math.round(r.pct * 100)} />
            ))
          ) : (
            <div className="v2-muted" style={{ fontSize: 12 }}>
              No region data on file yet.
            </div>
          )}
        </div>
        <div style={{ flex: '1 1 180px', minWidth: 0 }}>
          <div className="v2-eyebrow" style={{ marginBottom: 6 }}>Avg engagement</div>
          <div className="v2-tabular" style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em', marginBottom: 4 }}>
            {avgEr}%
          </div>
          <div className="v2-muted" style={{ fontSize: 12, marginBottom: 8 }}>
            across {me.channels.length} channel{me.channels.length === 1 ? '' : 's'}
          </div>
          {audience?.audienceCredibilityScore != null && (
            <div className="v2-home-best-time">
              ✓ Audience credibility: {audience.audienceCredibilityScore}/100
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Plot a 7-week follower sparkline by working backwards from current
 *  reach + 30-day growth rate. Pre-fix this was a fixed `[298…342]`
 *  array — every creator saw the same line. Now each creator's line
 *  reflects their actual reach scale + growth direction. */
function FollowerSparkline({ reach, growthRate30d }: { reach: number; growthRate30d: number }) {
  // Reconstruct what reach was 6 weeks ago to render the trailing line
  const monthlyGrowth = (growthRate30d || 0) / 100;
  const weeklyGrowth = monthlyGrowth / 4;
  const data: number[] = [];
  for (let i = 6; i >= 0; i--) {
    data.push(Math.round(reach * Math.pow(1 + weeklyGrowth, -i)));
  }
  // Original visual proportions are preserved for the existing CSS;
  // only the values are now per-creator-anchored.
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

function CreatorGoals({ wallet, me, myCollabs, onRoute }: {
  wallet: ReturnType<typeof useV2CreatorWallet>;
  me: V2Creator;
  myCollabs: ReturnType<typeof useV2MyCollabs>;
  onRoute: (r: string) => void;
}) {
  const target = 2500; // synthetic monthly target
  const earned = wallet.available + wallet.pending;
  const pct = Math.min(100, Math.round((earned / target) * 100));
  // Pre-fix two of the three Achievement tiles always showed "✓ done"
  // with hardcoded labels ("3 collabs / this month", "11% ER / hit
  // target"). They now derive:
  //  - Collabs this month: count of `myCollabs` whose Collaboration row
  //    has a `paid` or `live`-stage history entry in the current month
  //    (signal that the deal actually shipped, not just exists). We
  //    approximate using the latest history entry timestamp.
  //  - ER hit target: avg engagement across the creator's channels
  //    crossed the 8% "industry-respectable" mark. Pure store data.
  // myCollabs is V2Collab — no direct timestamp on the V2 shape. Fall
  // back to a presence check (deals currently in flight or shipped this
  // period). Good enough until we have settled-at timestamps; the tile
  // copy reflects "this month" loosely as a result.
  const collabsThisMonth = myCollabs.filter(
    (c) => c.stage === 'paid' || c.stage === 'live',
  ).length;
  const collabTarget = 3;
  const collabsTileDone = collabsThisMonth >= collabTarget;
  const avgEr = me.channels.length === 0 ? 0
    : me.channels.reduce((s, ch) => s + ch.engagement, 0) / me.channels.length;
  const erTarget = 8;
  const erTileDone = avgEr >= erTarget;

  // Tier derived from lifetime earnings — replaces the static "Silver
  // tier" pill that ignored actual progression.
  const tier = wallet.lifetime >= 15_000 ? 'Platinum tier'
    : wallet.lifetime >= 5_000 ? 'Gold tier'
    : wallet.lifetime >= 1_000 ? 'Silver tier'
    : 'Bronze tier';
  // Next tier threshold for the "X to unlock" subline.
  const nextThreshold = wallet.lifetime >= 15_000 ? null
    : wallet.lifetime >= 5_000 ? 15_000
    : wallet.lifetime >= 1_000 ? 5_000
    : 1_000;
  const nextTierLabel = wallet.lifetime >= 15_000 ? null
    : wallet.lifetime >= 5_000 ? 'Platinum'
    : wallet.lifetime >= 1_000 ? 'Gold'
    : 'Silver';
  const toUnlock = nextThreshold ? Math.max(0, nextThreshold - wallet.lifetime) : 0;
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
        <button
          type="button"
          className="v2-pill v2-pill-moss"
          onClick={() => onRoute('wallet')}
          style={{ fontSize: 11, border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
          title="View your earnings + tier progress"
        >
          {tier}
        </button>
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
        <Achievement
          icon="✦"
          label={`${collabsThisMonth} collab${collabsThisMonth === 1 ? '' : 's'}`}
          sub={collabsTileDone ? `≥ ${collabTarget} this month` : `${collabTarget - collabsThisMonth} to hit target`}
          done={collabsTileDone}
        />
        <Achievement
          icon="↑"
          label={`${avgEr.toFixed(1)}% ER`}
          sub={erTileDone ? `≥ ${erTarget}% target` : `${(erTarget - avgEr).toFixed(1)}pt to target`}
          done={erTileDone}
        />
        <Achievement
          icon="◆"
          label={nextTierLabel ? `${nextTierLabel} tier` : 'Top tier'}
          sub={nextTierLabel ? `${fmtUSD(toUnlock)} lifetime to unlock` : 'reached'}
          done={!nextTierLabel}
        />
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

// Tip rotation — pre-fix CreatorTip showed one hardcoded copy
// ("Brands pay 30% more for creators who reply within 6 hours")
// attributed to a fixed Areeba Khan portrait + "Your average reply is
// 18hr" stat that wasn't actually computed. Now we rotate from a
// curated list of platform-grounded tips keyed by creator id so each
// creator sees a stable but distinct tip across reloads. Attribution
// dropped — we frame these as platform-side guidance rather than
// pretending a specific creator gave them.
const CREATOR_TIPS: { headline: string; body: string; ctaLabel: string; ctaRoute: string }[] = [
  {
    headline: 'Brands pay more for fast replies.',
    body: 'Reply to inbound briefs within the same business day. Faster reply times correlate strongly with higher accepted-offer rates across the marketplace.',
    ctaLabel: 'Open inbox',
    ctaRoute: 'creator-inbox',
  },
  {
    headline: 'A complete storefront wins more pitches.',
    body: 'Storefronts with a rate card, 6+ work samples, and at least one review get noticeably more brand inquiries. Audit yours in a couple of minutes.',
    ctaLabel: 'Edit storefront',
    ctaRoute: 'storefront',
  },
  {
    headline: 'Reviews from past brands are your moat.',
    body: 'When a campaign wraps, leave the brand a review and prompt them for one too. Reviews appear at the top of your public storefront and lift conversion.',
    ctaLabel: 'View collaborations',
    ctaRoute: 'creator-collabs',
  },
  {
    headline: 'Pin a niche to win in Discover.',
    body: 'Brand searches in Discover filter by category and city. Two well-chosen categories outperform a generic list — pick the ones that match your strongest work.',
    ctaLabel: 'Update storefront',
    ctaRoute: 'storefront',
  },
  {
    headline: 'Saved briefs are 4× more likely to convert.',
    body: 'When you spot a brief that fits, save it even if you can\'t apply right away. Saved-then-applied pitches close at a higher rate than cold ones.',
    ctaLabel: 'Browse campaigns',
    ctaRoute: 'creator-campaigns',
  },
];

function hashStringToIdx(s: string, mod: number): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h % mod;
}

function CreatorTip({ me, onRoute }: { me: V2Creator; onRoute: (r: string) => void }) {
  const tip = CREATOR_TIPS[hashStringToIdx(me.id, CREATOR_TIPS.length)];
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
          {tip.headline}
        </h3>
        <p style={{ margin: '0 0 16px', fontSize: 13.5, color: 'var(--v2-ink-2)', lineHeight: 1.5 }}>
          {tip.body}
        </p>
        <div className="v2-row" style={{ gap: 8 }}>
          <button
            className="v2-btn v2-btn-primary v2-btn-sm"
            type="button"
            onClick={() => onRoute(tip.ctaRoute)}
          >{tip.ctaLabel}</button>
        </div>
      </div>
      <div className="v2-home-tip-foot">
        <div style={{ fontSize: 12, color: 'var(--v2-ink-3)' }}>
          Tips rotate from <strong style={{ color: 'var(--v2-ink)' }}>Alamut's creator playbook</strong> — grounded in marketplace-wide deal data.
        </div>
      </div>
    </div>
  );
}

// =====================================================================
// Saved for later — bookmarks tile
// =====================================================================
//
// Surfaces the creator's `savedBriefs[]` collection on Home so saved
// campaigns get re-encountered. Renders up to 4 compact rows; when
// there are more, a "View all N saved →" footer link deep-links to
// `creator-campaigns?filter=saved` (the Browse campaigns surface
// pre-filtered to saved-only). Hidden entirely when the list is empty.

const SAVED_TILE_LIMIT = 4;

// Same deterministic brand palette as the editorial CampaignTile so the
// mini-thumbs match the bigger surfaces visually.
const _SAVED_BRAND_PALETTE: { bg: string; ink: string }[] = [
  { bg: '#2A3F6E', ink: '#FBF7EE' },
  { bg: '#5C2A1E', ink: '#FBF7EE' },
  { bg: '#1F3527', ink: '#FBF7EE' },
  { bg: '#7A2B22', ink: '#FBF7EE' },
  { bg: '#3E2F4A', ink: '#FBF7EE' },
  { bg: '#1C1A15', ink: '#FBF7EE' },
];
function _savedBrandColour(name: string): { bg: string; ink: string } {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return _SAVED_BRAND_PALETTE[Math.abs(h) % _SAVED_BRAND_PALETTE.length];
}

function SavedForLater({ me, campaigns, onRoute }: {
  me: V2Creator;
  campaigns: V2Campaign[];
  onRoute: (r: string) => void;
}) {
  const db = useStore((s) => s.db);
  const meRaw = db.creators.find((c) => c.id === me.id);
  const savedIds = meRaw?.savedBriefs ?? [];

  // Resolve to actual campaigns (filtering out any saved IDs that were
  // closed/deleted) and preserve save order — most-recently-saved last.
  const savedCampaigns = useMemo(
    () => savedIds
      .map((id) => campaigns.find((c) => c.id === id))
      .filter((c): c is V2Campaign => !!c && c.status !== 'Completed'),
    [savedIds, campaigns],
  );

  if (savedCampaigns.length === 0) return null;
  const visible = savedCampaigns.slice(0, SAVED_TILE_LIMIT);
  const remaining = savedCampaigns.length - visible.length;

  return (
    <section
      className="v2-card v2-card-pad"
      style={{ marginBottom: 32 }}
    >
      <div
        className="v2-row"
        style={{ justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 14 }}
      >
        <div>
          <div className="v2-eyebrow">Saved for later</div>
          <p className="v2-muted" style={{ margin: '3px 0 0', fontSize: 12.5 }}>
            Briefs you bookmarked while browsing — come back when you have a window.
          </p>
        </div>
        <span
          className="v2-tabular v2-muted"
          style={{
            fontSize: 11,
            background: 'var(--v2-bg-1)',
            padding: '3px 9px',
            borderRadius: 99,
            whiteSpace: 'nowrap',
          }}
        >
          {savedCampaigns.length} saved
        </span>
      </div>

      <ul
        style={{
          listStyle: 'none',
          margin: 0,
          padding: 0,
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: 8,
        }}
      >
        {visible.map((c) => {
          const accent = _savedBrandColour(c.brand);
          const perCreator = Math.round(c.budget / Math.max(c.creators.length, 4));
          const daysLeft = Math.max(
            0,
            Math.ceil((+new Date(c.deadline) - Date.now()) / 86_400_000),
          );
          return (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => onRoute(`brief:${c.id}`)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 12px',
                  borderRadius: 10,
                  background: 'var(--v2-bg-1)',
                  border: '1px solid var(--v2-line)',
                  textAlign: 'left',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  width: '100%',
                  transition: 'border-color 140ms ease, transform 140ms ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--v2-accent)';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--v2-line)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                {/* Brand mark — uploaded logo when set, brand-coloured
                    initial otherwise. Same precedence rule as the
                    CampaignTile so brand uploads propagate everywhere. */}
                <span
                  aria-hidden="true"
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    background: c.brandLogoUrl ? 'var(--v2-paper)' : accent.bg,
                    color: accent.ink,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: 'var(--v2-font-display)',
                    fontWeight: 600,
                    fontSize: 16,
                    flexShrink: 0,
                    overflow: 'hidden',
                    border: c.brandLogoUrl ? '1px solid var(--v2-line)' : 'none',
                  }}
                >
                  {c.brandLogoUrl ? (
                    <img
                      src={c.brandLogoUrl}
                      alt=""
                      style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                    />
                  ) : (
                    c.brand[0]
                  )}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 13.5,
                      fontWeight: 550,
                      color: 'var(--v2-ink)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {c.name}
                  </div>
                  <div
                    className="v2-muted"
                    style={{ fontSize: 11.5, marginTop: 2 }}
                  >
                    {c.brand} · {fmtUSD(perCreator)}/creator · {daysLeft > 0 ? `${daysLeft}d left` : 'Ended'}
                  </div>
                </div>
                <span aria-hidden="true" style={{ color: 'var(--v2-ink-3)', flexShrink: 0 }}>
                  {Icon.arrow}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {remaining > 0 && (
        <div
          style={{
            marginTop: 12,
            paddingTop: 12,
            borderTop: '1px solid var(--v2-line)',
            textAlign: 'right',
          }}
        >
          <button
            type="button"
            className="v2-btn v2-btn-outline v2-btn-sm"
            onClick={() => onRoute('creator-campaigns?filter=saved')}
          >
            View all {savedCampaigns.length} saved {Icon.arrow}
          </button>
        </div>
      )}
    </section>
  );
}
