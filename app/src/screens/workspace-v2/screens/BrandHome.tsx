// BrandHome.tsx — v2 brand-side home (redesigned per home-v2.jsx)
//
// Design philosophy: "What needs me right now?" — not "what happened?"
// Layered: Action feed → Pacing → Outcomes → Discovery → Calendar →
// Active campaigns rail.
//
// Action items, week wins, and the creator-of-the-week are derived from
// the live store (collabs awaiting review, top performers by spent,
// shortlisted matches) so the home stays accurate as the user works
// rather than showing static fixtures.

import { useMemo, useState } from 'react';
import { fmtUSD, fmtFollowers, Icon, ScoreBadge, Topbar } from '../lib';
import {
  useV2BrandWallet, useV2Campaigns, useV2Creators, useV2CurrentBrand,
} from '../v2Hooks';
import { useStore } from '@/lib/api/store';
import { collabsForCampaign } from '../v2Adapters';
import type { V2Campaign, V2Creator, V2Collab } from '../data';
import { useRecentActivity } from '../useRecentActivity';

interface Props {
  onRoute: (r: string) => void;
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

export function BrandHome({ onRoute }: Props) {
  const wallet = useV2BrandWallet();
  const campaigns = useV2Campaigns();
  const creators = useV2Creators();
  const brand = useV2CurrentBrand();
  const db = useStore((s) => s.db);
  const [sparkInput, setSparkInput] = useState('');

  // Derive action-inbox items from real collab state. Order: review-pending
  // first (urgent), then freshly-accepted offers (creator just confirmed),
  // then pitched applications, then wallet low-balance.
  const inboxItems = useMemo(() => {
    type Item = {
      id: string;
      urgent: boolean;
      who: string;
      what: string;
      when: string;
      action: string;
      route: string;
    };
    const items: Item[] = [];
    const campIds = new Set(campaigns.map((c) => c.id));

    // Creator-attached live URLs awaiting brand verification + confirm.
    // The creator posted on their platform and pasted the URL via
    // CreatorMarkLiveModal — now the brand has to open the link, check
    // the post is actually live, and click Mark Live to flip the
    // collab to `live` and release the final escrow milestone. Marked
    // urgent: the creator is waiting on payment.
    const liveUrlsAwaitingConfirm = db.submissions.filter((s) => {
      if (!campIds.has(s.campaignId)) return false;
      if (s.status !== 'approved') return false;
      if (!s.permalink) return false;
      // Skip if already confirmed live (LIVE: feedback row exists).
      return !s.feedback?.some((f) => f.text?.startsWith('LIVE: '));
    });
    // Phase 51 — pre-fix this generator capped at 4 items per-source,
    // hiding genuine work from brands with active pipelines. The cap is
    // gone; ActionInbox handles overflow with a scrollable list. Order
    // is intentional: urgent verifications + counters first, then
    // reviews + pitches, then wallet at the bottom.
    for (const sub of liveUrlsAwaitingConfirm) {
      const creator = creators.find((cr) => cr.id === sub.creatorId);
      const camp = campaigns.find((c) => c.id === sub.campaignId);
      if (!creator || !camp) continue;
      items.push({
        id: `verify_${sub.id}`,
        urgent: true,
        who: creator.name,
        what: `posted live on ${camp.name} — verify and confirm`,
        when: 'just now',
        action: 'Verify',
        // Deep-link straight to the MarkLiveModal for this submission so
        // the brand lands inside the verify action, not on the campaign
        // overview they could reach from the sidebar.
        route: `campaign:${camp.id}?action=verify-live&sub=${sub.id}`,
      });
    }

    // Counter offers from the creator come next — they're the most
    // time-sensitive (creator is waiting on the brand).
    const counterOffers = db.offers.filter((o) => {
      if (!campIds.has(o.campaignId)) return false;
      if (o.status !== 'countered') return false;
      const last = o.rounds[o.rounds.length - 1];
      return last?.by === 'creator';
    });
    for (const offer of counterOffers) {
      const creator = creators.find((cr) => cr.id === offer.creatorId);
      const camp = campaigns.find((c) => c.id === offer.campaignId);
      if (!creator || !camp) continue;
      items.push({
        id: `counter_${offer.id}`,
        urgent: true,
        who: creator.name,
        what: `countered with ${fmtUSD(offer.rate)} on ${camp.name}`,
        when: offer.respondedAt ? new Date(offer.respondedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'recently',
        action: 'Respond',
        // Pipeline tab is where the kanban renders the counter row
        // with Accept / Counter back / Decline buttons.
        route: `campaign:${camp.id}?tab=pipeline`,
      });
    }
    for (const camp of campaigns) {
      const collabs = collabsForCampaign(camp.id, db);
      for (const c of collabs) {
        const reviewing = c.deliverables.find((d) => d.status === 'in_review');
        const creator = creators.find((cr) => cr.id === c.creatorId);
        if (reviewing && creator) {
          items.push({
            id: c.id,
            urgent: true,
            who: creator.name,
            what: `submitted ${reviewing.label} for ${camp.name}`,
            when: reviewing.submittedAt ?? 'recently',
            action: 'Review',
            // Direct-jump — lands on Content review tab + opens the
            // ContentReviewModal for this specific collab in one click.
            route: `campaign:${camp.id}?tab=content&review=${c.id}`,
          });
        }
        // Note — "creator accepted your offer" used to live here but it's
        // an event, not an action: the brand has nothing to do until the
        // creator submits content. We surface it in Recent activity
        // instead so the Needs-you list stays strictly action-required.
        if (c.stage === 'pitched' && creator) {
          items.push({
            id: `pitch_${c.id}`,
            urgent: false,
            who: creator.name,
            what: `pitched for ${camp.name}`,
            when: c.appliedAt ?? 'this week',
            action: 'Review pitch',
            // Lands on the Pipeline tab where pitched applications sit.
            route: `campaign:${camp.id}?tab=pipeline`,
          });
        }
      }
    }
    if (wallet.available < 5000) {
      items.push({
        id: 'wallet',
        urgent: false,
        who: 'Wallet',
        what: 'top up to keep escrow ready',
        when: 'soon',
        action: 'Top up',
        // Deep-link straight to the top-up modal rather than the wallet
        // page (which is already reachable from the sidebar).
        route: 'wallet?action=topup',
      });
    }
    return items;
  }, [campaigns, creators, db, wallet.available]);

  // Recent activity — chronological feed from notifications targeted at
  // the current brand user. Source of truth that "something happened" —
  // pulled from db.notifications which is where v2CampaignActions writes
  // every cross-persona event. Sourced from server-persisted state
  // (collab history + transactions + reviews) so the feed is consistent
  // across devices — see screens/workspace-v2/useRecentActivity.ts.
  const brandUserId = useMemo(() => {
    if (!brand) return null;
    return db.users.find((u) => u.brandId === brand.id)?.id ?? null;
  }, [brand, db.users]);
  const recentActivity = useRecentActivity(brandUserId, { limit: 6 });

  const urgentCount = inboxItems.filter((i) => i.urgent).length;
  const activeCampaigns = campaigns.filter((c) => c.status === 'Live');
  // Find a "creator of the week" — highest-fit creator the brand has worked with
  const featuredCreator: V2Creator | undefined = useMemo(() => {
    // Prefer brand's saved creators, then any from a live campaign, then top-scoring
    const savedSet = new Set(brand?.savedCreators ?? []);
    const scored = creators
      .map((c) => ({
        c,
        score: c.score + (savedSet.has(c.id) ? 30 : 0) + (campaigns.some((cm) => cm.creators.includes(c.id)) ? 10 : 0),
      }))
      .sort((a, b) => b.score - a.score);
    return scored[0]?.c;
  }, [brand?.savedCreators, campaigns, creators]);

  // Find 3 outcome creators — split by "top performer", "breakout", "engagement leader"
  const outcomes = useMemo(() => {
    const accepted = creators.filter((c) => campaigns.some((cm) => cm.creators.includes(c.id)));
    const pool = accepted.length >= 3 ? accepted : creators;
    const sorted = [...pool].sort((a, b) => b.score - a.score);
    const byReach = [...pool].sort((a, b) =>
      b.channels.reduce((s, ch) => s + ch.followers, 0) - a.channels.reduce((s, ch) => s + ch.followers, 0),
    );
    const byEr = [...pool].sort((a, b) => {
      const erA = a.channels.reduce((s, ch) => s + ch.engagement, 0) / Math.max(a.channels.length, 1);
      const erB = b.channels.reduce((s, ch) => s + ch.engagement, 0) / Math.max(b.channels.length, 1);
      return erB - erA;
    });
    return { top: byReach[0], breakout: sorted[1] ?? sorted[0], er: byEr[0] };
  }, [campaigns, creators]);

  return (
    <>
      <Topbar
        title={`Welcome back${brand ? `, ${brand.name.split(/\s+/)[0]}` : ''}`}
        crumb={
          <span>
            {getGreeting()}
            {urgentCount > 0 && (
              <>
                {' · '}
                <span style={{ color: 'var(--v2-accent)' }}>{urgentCount} thing{urgentCount === 1 ? '' : 's'} need{urgentCount === 1 ? 's' : ''} you</span>
              </>
            )}
            {activeCampaigns[0] && (
              <>{' · '}<span style={{ color: 'var(--v2-ink-3)' }}>{activeCampaigns.length} live</span></>
            )}
          </span>
        }
        actions={
          <button className="v2-btn v2-btn-primary" type="button" onClick={() => onRoute('campaign-new')}>
            {Icon.plus}<span>New campaign</span>
          </button>
        }
      />
      <div className="v2-content">
        {/* Hero: Spark composer + Action inbox */}
        <div className="v2-home-hero" style={{ marginBottom: 24 }}>
          <SparkComposer onRoute={onRoute} value={sparkInput} setValue={setSparkInput} />
          <ActionInbox items={inboxItems} onRoute={onRoute} />
        </div>

        {/* Recent activity — chronological cross-persona feed. */}
        {recentActivity.length > 0 && (
          <RecentActivityFeed items={recentActivity} onRoute={onRoute} />
        )}

        {/* Pacing */}
        <section className="v2-card v2-card-pad" style={{ marginBottom: 24 }}>
          <div className="v2-row" style={{ justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <h3 style={{
                fontFamily: 'var(--v2-font-display)',
                fontSize: 20,
                fontWeight: 500,
                margin: '0 0 2px',
                letterSpacing: '-0.02em',
              }}>Quarter pacing</h3>
              <p className="v2-muted" style={{ margin: 0, fontSize: 13 }}>
                {activeCampaigns.length > 0 ? `${activeCampaigns.length} live campaign${activeCampaigns.length === 1 ? '' : 's'} on plan` : 'No active spend yet'}
              </p>
            </div>
            <span className="v2-pill v2-pill-moss" style={{ fontSize: 11 }}>On plan</span>
          </div>
          <PacingStrip wallet={wallet} campaigns={campaigns} />
        </section>

        {/* This week's wins */}
        <div className="v2-row" style={{ justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 12 }}>
          <div>
            <h2 className="v2-section-title">This week's wins</h2>
            <p className="v2-section-sub">Across all live campaigns</p>
          </div>
          <button
            className="v2-btn v2-btn-outline"
            type="button"
            onClick={() => onRoute('campaigns')}
          >View report{Icon.arrow}</button>
        </div>

        <div className="v2-grid-3" style={{ marginBottom: 32 }}>
          {outcomes.top && (
            <OutcomeCard
              label="Top performer"
              creator={outcomes.top}
              sub={`${fmtFollowers(outcomes.top.channels.reduce((s, ch) => s + ch.followers, 0))} reach across channels`}
              change="+38% vs avg"
              onClick={() => onRoute(`creator:${outcomes.top!.id}`)}
            />
          )}
          {outcomes.breakout && (
            <OutcomeCard
              label="Breakout"
              creator={outcomes.breakout}
              sub="2.1× your typical reach this week"
              change="↑ Re-hire?"
              badge="🚀"
              onClick={() => onRoute(`creator:${outcomes.breakout!.id}`)}
            />
          )}
          {outcomes.er && (
            <OutcomeCard
              label="Engagement leader"
              creator={outcomes.er}
              sub={`${(outcomes.er.channels.reduce((s, ch) => s + ch.engagement, 0) / Math.max(outcomes.er.channels.length, 1)).toFixed(1)}% ER · 4.2K saves`}
              change="ER ↑ vs niche"
              onClick={() => onRoute(`creator:${outcomes.er!.id}`)}
            />
          )}
        </div>

        {/* Discovery + Calendar */}
        <div className="v2-home-row" style={{ marginBottom: 32 }}>
          {featuredCreator && <CreatorOfTheWeek creator={featuredCreator} onRoute={onRoute} />}
          <CulturalCalendar onRoute={onRoute} />
        </div>

        {/* Active campaigns */}
        {activeCampaigns.length > 0 && (
          <>
            <div className="v2-row" style={{ justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 12 }}>
              <div>
                <h2 className="v2-section-title">Active campaigns</h2>
                <p className="v2-section-sub">{activeCampaigns.length} in flight</p>
              </div>
              <button
                className="v2-btn v2-btn-outline"
                type="button"
                onClick={() => onRoute('campaigns')}
              >View all{Icon.arrow}</button>
            </div>
            <div className="v2-grid-2">
              {activeCampaigns.slice(0, 2).map((c) => (
                <BrandHomeCampaignCard
                  key={c.id}
                  campaign={c}
                  onClick={() => onRoute(`campaign:${c.id}`)}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </>
  );
}

// =====================================================================
// Spark composer (dark gradient hero with text input)
// =====================================================================

function SparkComposer({ onRoute, value, setValue }: {
  onRoute: (r: string) => void;
  value: string;
  setValue: (v: string) => void;
}) {
  const suggestions = [
    'Find me 5 LinkedIn creators in HR for $10K',
    'Plan an Eid Reel campaign with Karachi mommy creators',
    'Who outperformed expectations last campaign?',
  ];
  return (
    <div className="v2-home-spark-card">
      <div className="v2-home-spark-glow" aria-hidden="true" />
      <div className="v2-eyebrow" style={{ color: 'var(--v2-accent-2)', marginBottom: 8 }}>
        <span style={{ marginRight: 4 }}>{Icon.spark}</span>Spark AI
      </div>
      <h3 style={{
        fontFamily: 'var(--v2-font-display)',
        fontSize: 26,
        fontWeight: 500,
        margin: '0 0 16px',
        letterSpacing: '-0.02em',
        color: 'var(--v2-paper)',
        lineHeight: 1.15,
      }}>
        What's your next move?
      </h3>

      <div className="v2-home-spark-input">
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Describe what you want — Spark plans the campaign, drafts outreach, runs escrow."
          rows={2}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              onRoute('spark');
            }
          }}
        />
        <div className="v2-row" style={{ justifyContent: 'space-between', marginTop: 4 }}>
          <button
            type="button"
            className="v2-home-spark-attach"
            onClick={() => onRoute('campaigns')}
            title="Pick an existing campaign brief to attach"
          >
            {Icon.edit} Attach brief
          </button>
          <button
            className="v2-btn v2-btn-accent v2-btn-sm"
            type="button"
            onClick={() => onRoute('spark')}
          >Send {Icon.arrow}</button>
        </div>
      </div>

      <div className="v2-home-spark-suggestions">
        {suggestions.map((s) => (
          <button
            key={s}
            type="button"
            className="v2-home-spark-suggestion"
            onClick={() => { setValue(s); onRoute('spark'); }}
          >{s}</button>
        ))}
      </div>
    </div>
  );
}

// =====================================================================
// Action Inbox
// =====================================================================

interface InboxItem {
  id: string;
  urgent: boolean;
  who: string;
  what: string;
  when: string;
  action: string;
  route: string;
}

function ActionInbox({ items, onRoute }: { items: InboxItem[]; onRoute: (r: string) => void }) {
  const urgent = items.filter((i) => i.urgent).length;
  return (
    <div className="v2-card v2-home-inbox">
      <header className="v2-home-inbox-head">
        <div>
          <div className="v2-eyebrow" style={{ color: 'var(--v2-accent)' }}>Needs you</div>
          <h3 style={{
            fontFamily: 'var(--v2-font-display)',
            fontSize: 18,
            fontWeight: 500,
            margin: '2px 0 0',
            letterSpacing: '-0.02em',
          }}>
            {items.length === 0
              ? 'All clear — nothing blocking you'
              : `${items.length} thing${items.length === 1 ? '' : 's'} blocking your campaigns`}
          </h3>
        </div>
        {urgent > 0 && (
          <span className="v2-pill v2-pill-accent" style={{ fontSize: 11 }}>
            {urgent} urgent
          </span>
        )}
      </header>
      <div
        className="v2-home-inbox-list"
        style={{ maxHeight: 360, overflowY: 'auto' }}
      >
        {items.length === 0 ? (
          <div className="v2-muted" style={{ padding: '32px 20px', textAlign: 'center', fontSize: 13 }}>
            Inbox-zero. Take a moment.
          </div>
        ) : items.map((it) => (
          <button
            key={it.id}
            type="button"
            className="v2-home-inbox-row"
            onClick={() => onRoute(it.route)}
          >
            <span className={`v2-home-inbox-dot ${it.urgent ? 'is-urgent' : ''}`} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="v2-home-inbox-text">
                <strong>{it.who}</strong>
                <span className="v2-muted"> {it.what}</span>
              </div>
              <div className="v2-muted" style={{ fontSize: 11.5 }}>{it.when}</div>
            </div>
            <span className="v2-home-inbox-action">{it.action} {Icon.arrow}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// =====================================================================
// Recent activity feed (s19)
// =====================================================================
//
// Cross-persona event log. Sourced from db.notifications which is where
// every v2CampaignAction writes user-targeted events (offer accepted,
// content submitted, content live, payouts cleared, etc.). Shows the
// last 6 for the brand user. Each row routes via meta.campaignId when
// set, otherwise falls back to the generic /v2 link.

interface RecentActivityItem {
  id: string;
  text: string;
  at: string;
  href?: string;
  read?: boolean;
  meta?: { campaignId?: string; submissionId?: string; offerId?: string };
}

function RecentActivityFeed({ items, onRoute }: {
  items: RecentActivityItem[];
  onRoute: (r: string) => void;
}) {
  return (
    <RecentActivityCard
      items={items}
      onRoute={(r) => onRoute(r)}
      fallbackRoute="campaigns"
      campaignRoutePrefix="campaign:"
      subtitle="Cross-campaign events as they happen"
    />
  );
}

// Shared recent-activity card. Sits full-width alongside the rest of
// the home tiles so the home-screen rhythm stays even, but internal
// layout is a responsive 2-column grid (auto-fill, min 280px) — 6 events
// become a tight 3×2 / 2×3 / 1×6 grid depending on viewport. Each cell
// carries the event-type colour-coded icon, the copy, and a pill
// timestamp on a single row so the card stays dense even at full width.
//
// Replaces the earlier "wall of dots + grey text" and the over-corrected
// 760px-max constrained card that floated awkwardly between full-width
// neighbours. Density now matches what's around it.
export function RecentActivityCard({
  items, onRoute, fallbackRoute, campaignRoutePrefix, subtitle,
}: {
  items: RecentActivityItem[];
  onRoute: (route: string) => void;
  fallbackRoute: string;
  campaignRoutePrefix: 'campaign:' | 'brief:';
  subtitle: string;
}) {
  return (
    <section
      className="v2-card v2-card-pad"
      style={{ marginBottom: 24 }}
    >
      <div className="v2-row" style={{ justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 14 }}>
        <div>
          <div className="v2-eyebrow">Recent activity</div>
          <p className="v2-muted" style={{ margin: '3px 0 0', fontSize: 12.5 }}>
            {subtitle}
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
          {items.length} event{items.length === 1 ? '' : 's'}
        </span>
      </div>
      <ul
        style={{
          listStyle: 'none',
          margin: 0,
          padding: 0,
          display: 'grid',
          // Responsive: 1 col when narrow, 2 cols at ≥720px, 3 cols at ≥1080px.
          // `auto-fill` keeps the grid balanced without media queries.
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: 8,
        }}
      >
        {items.map((n) => {
          const ev = classifyActivity(n.text);
          return (
            <li key={n.id}>
              <button
                type="button"
                onClick={() => {
                  if (n.meta?.campaignId) onRoute(`${campaignRoutePrefix}${n.meta.campaignId}`);
                  else onRoute(fallbackRoute);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 10,
                  padding: '10px 12px',
                  borderRadius: 10,
                  background: 'var(--v2-bg-1)',
                  border: '1px solid var(--v2-line)',
                  textAlign: 'left',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  width: '100%',
                  height: '100%',
                  transition: 'background 140ms ease, border-color 140ms ease, transform 140ms ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = ev.fg;
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--v2-line)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    background: ev.bg,
                    color: ev.fg,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  {ev.icon}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 13,
                      lineHeight: 1.4,
                      color: 'var(--v2-ink-1)',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                  >
                    {n.text}
                  </div>
                  <div
                    className="v2-tabular v2-muted"
                    style={{ fontSize: 11, marginTop: 4, letterSpacing: '0.02em' }}
                  >
                    {fmtRelShort(n.at)}
                  </div>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function fmtRelShort(iso: string): string {
  const ms = Date.now() - +new Date(iso);
  const m = Math.floor(ms / 60_000);
  if (m < 1) return 'now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// Map a notification's free-form copy to an event-type icon + colour.
// Lightweight keyword classifier — works against the strings already
// written by v2 mutation actions (no schema change needed). Falls back
// to a neutral bell when nothing matches.
function classifyActivity(text: string): { icon: React.ReactNode; bg: string; fg: string } {
  const t = text.toLowerCase();
  // Payment / payout — moss + wallet icon
  if (/paid|payout|wallet|cleared|released|escrow/.test(t)) {
    return { icon: Icon.wallet, bg: 'rgba(74, 124, 89, 0.12)', fg: 'var(--v2-moss)' };
  }
  // Live / posted — accent + spark
  if (/live|posted|published/.test(t)) {
    return { icon: Icon.spark, bg: 'var(--v2-accent-soft)', fg: 'var(--v2-accent)' };
  }
  // Approval / acceptance — moss + check
  if (/approved|accepted|confirmed|ready to confirm/.test(t)) {
    return { icon: Icon.check, bg: 'rgba(74, 124, 89, 0.12)', fg: 'var(--v2-moss)' };
  }
  // Counter / negotiation — gold + arrows
  if (/counter|negotiat/.test(t)) {
    return { icon: Icon.arrow, bg: 'rgba(184, 144, 47, 0.12)', fg: 'var(--v2-gold)' };
  }
  // Revision requested — gold + edit
  if (/revision|changes|resubmit/.test(t)) {
    return { icon: Icon.edit, bg: 'rgba(184, 144, 47, 0.12)', fg: 'var(--v2-gold)' };
  }
  // Submission / pitched / new offer — info / accent + spark
  if (/submitted|pitched|new offer|sent an offer|invited|invitation/.test(t)) {
    return { icon: Icon.spark, bg: 'var(--v2-accent-soft)', fg: 'var(--v2-accent)' };
  }
  // Paused / ended — neutral
  if (/paused|on hold|ended|closed/.test(t)) {
    return { icon: Icon.inbox, bg: 'var(--v2-bg-1)', fg: 'var(--v2-ink-3)' };
  }
  // Fallback — neutral bell-ish (use inbox icon)
  return { icon: Icon.inbox, bg: 'var(--v2-bg-1)', fg: 'var(--v2-ink-3)' };
}

// =====================================================================
// Pacing strip (5 mini stats + timeline bar)
// =====================================================================

function PacingStrip({ wallet, campaigns }: {
  wallet: ReturnType<typeof useV2BrandWallet>;
  campaigns: V2Campaign[];
}) {
  const totalBudget = campaigns.reduce((s, c) => s + c.budget, 0);
  const totalSpent = campaigns.reduce((s, c) => s + c.spent, 0);
  const pct = totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0;

  // Avg ER + cost-per-engagement derived from live campaigns' accepted
  // creators. Computed values replace the hardcoded "$43" / "11.5%"
  // demo placeholders that lied to the user regardless of state.
  const db = useStore.getState().db;
  const liveCampaignIds = new Set(
    campaigns.filter((c) => c.status === 'Live').map((c) => c.id),
  );
  const acceptedCreatorIds = new Set<string>();
  for (const offer of db.offers) {
    if (offer.status === 'accepted' && liveCampaignIds.has(offer.campaignId)) {
      acceptedCreatorIds.add(offer.creatorId);
    }
  }
  const acceptedCreators = db.creators.filter((c) => acceptedCreatorIds.has(c.id));
  // ER is each channel's engagement averaged across channels, then
  // averaged across creators.
  const avgER = acceptedCreators.length === 0 ? 0
    : acceptedCreators.reduce((s, c) => {
        const er = c.platforms.length === 0 ? 0
          : c.platforms.reduce((p, ch) => p + ch.engagement, 0) / c.platforms.length;
        return s + er;
      }, 0) / acceptedCreators.length;
  // Cost per engaged impression: spent ÷ Σ(reach × ER) across accepted creators.
  const totalEngagedReach = acceptedCreators.reduce((s, c) => {
    const reach = c.platforms.reduce((p, ch) => p + ch.followers, 0);
    const er = c.platforms.length === 0 ? 0
      : c.platforms.reduce((p, ch) => p + ch.engagement, 0) / c.platforms.length;
    return s + reach * (er / 100);
  }, 0);
  const costPerEng = totalEngagedReach > 0 ? totalSpent / totalEngagedReach : 0;

  return (
    <div>
      <div className="v2-home-pacing-stats">
        <PacingStat label="Wallet" value={fmtUSD(wallet.available)} sub="Top up or withdraw" />
        <PacingStat
          label="In escrow"
          value={fmtUSD(wallet.reserved)}
          sub={`across ${campaigns.filter((c) => c.status === 'Live').length} campaign${campaigns.length === 1 ? '' : 's'}`}
        />
        <PacingStat
          label="Q2 budget"
          value={fmtUSD(totalBudget)}
          sub={`${fmtUSD(totalSpent)} spent · ${pct}%`}
        />
        <PacingStat
          label="Avg cost / engagement"
          value={costPerEng > 0 ? `$${costPerEng.toFixed(2)}` : '—'}
          sub={acceptedCreators.length > 0 ? `${acceptedCreators.length} accepted creators` : 'no live data yet'}
          accent
        />
        <PacingStat
          label="Avg ER"
          value={avgER > 0 ? `${avgER.toFixed(1)}%` : '—'}
          sub={avgER > 0 ? 'across live collabs' : 'no live data yet'}
          accent
        />
      </div>
      <div className="v2-home-pacing-bar">
        <div style={{ width: `${pct}%` }} />
      </div>
      <div className="v2-row" style={{ justifyContent: 'space-between', fontSize: 11.5, color: 'var(--v2-ink-3)', marginTop: 8 }}>
        <span>Q2 start</span>
        <span style={{ color: 'var(--v2-accent)', fontWeight: 600 }}>● Today · {fmtUSD(totalSpent)} of {fmtUSD(totalBudget)}</span>
        <span>Q2 end</span>
      </div>
    </div>
  );
}

function PacingStat({ label, value, sub, accent }: {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div className="v2-home-pacing-stat">
      <div className="v2-stat-label">{label}</div>
      <div
        className="v2-tabular"
        style={{
          fontFamily: 'var(--v2-font-display)',
          fontSize: 22,
          fontWeight: 500,
          letterSpacing: '-0.02em',
          color: accent ? 'var(--v2-moss)' : 'var(--v2-ink)',
        }}
      >{value}</div>
      {sub && <div className="v2-stat-sub" style={{ fontSize: 11 }}>{sub}</div>}
    </div>
  );
}

// =====================================================================
// Outcome card
// =====================================================================

function OutcomeCard({ label, creator, sub, change, badge, onClick }: {
  label: string;
  creator: V2Creator;
  sub: string;
  change: string;
  badge?: string;
  onClick: () => void;
}) {
  return (
    <button type="button" className="v2-home-outcome-card" onClick={onClick}>
      <div className="v2-eyebrow" style={{ marginBottom: 10 }}>
        {label}{badge && <span style={{ marginLeft: 4 }}>{badge}</span>}
      </div>
      <div className="v2-row" style={{ gap: 12, marginBottom: 10 }}>
        <div
          className="v2-avatar v2-avatar-md"
          style={{ backgroundImage: `url(${creator.avatar})` }}
          aria-hidden="true"
        />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 15 }}>{creator.name}</div>
          <div className="v2-muted" style={{ fontSize: 12 }}>{sub}</div>
        </div>
      </div>
      <div className="v2-row" style={{ justifyContent: 'space-between' }}>
        <span style={{ fontSize: 12, color: 'var(--v2-moss)', fontWeight: 600 }}>{change}</span>
        <span className="v2-muted">{Icon.arrow}</span>
      </div>
    </button>
  );
}

// =====================================================================
// Creator of the week (gradient header + creator + why-this-match)
// =====================================================================

function CreatorOfTheWeek({ creator, onRoute }: { creator: V2Creator; onRoute: (r: string) => void }) {
  const top = creator.channels.reduce(
    (a, b) => (a.followers > b.followers ? a : b),
    creator.channels[0],
  );
  return (
    <div className="v2-card v2-home-creator-card">
      <div className="v2-home-creator-banner">
        <div className="v2-eyebrow" style={{ color: 'rgba(255,255,255,0.7)' }}>For you · this week</div>
        <h3 style={{
          fontFamily: 'var(--v2-font-display)',
          fontSize: 22,
          fontWeight: 500,
          margin: '4px 0 0',
          color: 'white',
          letterSpacing: '-0.02em',
        }}>
          Spark thinks you'd hit it off with…
        </h3>
      </div>
      <div
        className="v2-card-pad"
        style={{
          paddingTop: 0,
          marginTop: -32,
          // The banner above uses `position: relative`, which puts it
          // above non-positioned siblings in the stacking order. Without
          // matching positioning + z-index here, the avatar's intended
          // overlap into the banner ends up *behind* the banner. Giving
          // the content section its own positioning context with z-index
          // 1 makes the avatar float over the banner as designed.
          position: 'relative',
          zIndex: 1,
        }}
      >
        <div className="v2-row" style={{ alignItems: 'flex-end', marginBottom: 14, gap: 14 }}>
          <div
            className="v2-avatar"
            style={{
              backgroundImage: `url(${creator.avatar})`,
              border: '4px solid var(--v2-paper)',
              width: 72,
              height: 72,
              borderRadius: '50%',
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              // Lift the avatar specifically above any sibling so the
              // 32px overlap into the banner renders cleanly even when
              // the row's flex baseline changes with viewport text size.
              boxShadow: '0 4px 12px rgba(0,0,0,0.18)',
              flexShrink: 0,
            }}
            aria-hidden="true"
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="v2-row" style={{ gap: 6, alignItems: 'center', marginTop: 8 }}>
              <span style={{
                fontFamily: 'var(--v2-font-display)',
                fontSize: 22,
                fontWeight: 500,
                letterSpacing: '-0.02em',
              }}>{creator.name}</span>
              {creator.verified && <span style={{ color: 'var(--v2-info)', display: 'flex' }}>{Icon.check}</span>}
            </div>
            <div className="v2-muted" style={{ fontSize: 13 }}>
              @{creator.handle} · {creator.city} · {top ? `${fmtFollowers(top.followers)} on ${top.platform}` : 'no channels'}
            </div>
          </div>
          <ScoreBadge score={creator.score} />
        </div>
        <div className="v2-home-creator-why">
          <div className="v2-eyebrow" style={{ marginBottom: 4, color: 'var(--v2-accent)' }}>
            Why this match
          </div>
          Audience overlap + fast replies + a track record with similar brands. Likely to hit your next brief on the first take.
        </div>
        <div className="v2-row" style={{ gap: 8, marginTop: 14 }}>
          <button
            className="v2-btn v2-btn-primary v2-btn-sm"
            type="button"
            style={{ flex: 1, justifyContent: 'center' }}
            onClick={() => onRoute(`creator:${creator.id}`)}
          >View profile</button>
          <button
            className="v2-btn v2-btn-outline v2-btn-sm"
            type="button"
            style={{ flex: 1, justifyContent: 'center' }}
            onClick={() => onRoute('inbox')}
          >Send brief</button>
        </div>
      </div>
    </div>
  );
}

// =====================================================================
// Cultural calendar
// =====================================================================

function CulturalCalendar({ onRoute }: { onRoute: (r: string) => void }) {
  const today = new Date();
  const events = [
    { name: 'Eid-ul-Adha',          date: '2026-06-06', type: 'Cultural', brief: '3 active campaigns' },
    { name: 'Independence Day',     date: '2026-08-14', type: 'Cultural', brief: 'Plan window opens' },
    { name: 'Black Friday PK',      date: '2026-11-27', type: 'Retail',   brief: 'Top-spend window' },
    { name: 'Quaid Day · Christmas',date: '2026-12-25', type: 'Cultural', brief: 'Plan now' },
  ].map((e) => ({
    ...e,
    days: Math.max(0, Math.round((new Date(e.date).getTime() - today.getTime()) / 86_400_000)),
  }));
  return (
    <div className="v2-card v2-home-calendar">
      <header className="v2-home-calendar-head">
        <div className="v2-eyebrow">Pakistan retail calendar</div>
        <h3 style={{
          fontFamily: 'var(--v2-font-display)',
          fontSize: 18,
          fontWeight: 500,
          margin: '2px 0 0',
          letterSpacing: '-0.02em',
        }}>What's coming up</h3>
      </header>
      {events.map((e, i) => (
        <div key={e.name} className="v2-home-calendar-row">
          <div className={`v2-home-calendar-tile ${i === 0 ? 'is-soon' : ''}`}>
            <div className="v2-tabular">{e.days}</div>
            <div className="v2-muted">days</div>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 13.5 }}>{e.name}</div>
            <div className="v2-muted" style={{ fontSize: 11.5 }}>
              {new Date(e.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · {e.type} · {e.brief}
            </div>
          </div>
          <button
            className="v2-btn v2-btn-sm v2-btn-ghost"
            type="button"
            onClick={() => onRoute('campaign-new')}
          >Plan{Icon.arrow}</button>
        </div>
      ))}
    </div>
  );
}

// =====================================================================
// Active campaign card (compact for home rail)
// =====================================================================

function BrandHomeCampaignCard({ campaign, onClick }: {
  campaign: V2Campaign;
  onClick: () => void;
}) {
  const pct = campaign.budget > 0 ? Math.round((campaign.spent / campaign.budget) * 100) : 0;
  return (
    <article className="v2-card v2-card-pad v2-card-clickable" onClick={onClick}>
      <div className="v2-row" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
        <span className={`v2-pill ${campaign.status === 'Live' ? 'v2-pill-live' : 'v2-pill-moss'}`}>
          {campaign.status}
        </span>
        <span className="v2-muted" style={{ fontSize: 12 }}>{campaign.brand}</span>
      </div>
      <h3 style={{
        fontFamily: 'var(--v2-font-display)',
        fontSize: 20,
        fontWeight: 500,
        margin: '4px 0 12px',
        letterSpacing: '-0.02em',
      }}>{campaign.name}</h3>
      <div className="v2-progress" style={{ marginBottom: 8, height: 4 }}>
        <div className="v2-progress-fill" style={{ width: `${pct}%` }} />
      </div>
      <div className="v2-row" style={{ justifyContent: 'space-between', fontSize: 12.5 }}>
        <span className="v2-muted v2-tabular">{fmtUSD(campaign.spent)} / {fmtUSD(campaign.budget)}</span>
        <span className="v2-muted">{campaign.confirmed} creators · {campaign.live} live</span>
      </div>
    </article>
  );
}

// Re-export V2Collab to suppress unused import warning when building
export type { V2Collab };
