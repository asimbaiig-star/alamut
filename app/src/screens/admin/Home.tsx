// Admin Home / Console (Phase 8) — /admin/home
//
// Single-pane overview for the platform admin role. Replaces the previous
// /admin → /admin/queue redirect with a dedicated console showing all five
// queues at a glance, recent platform-wide activity, escrow snapshot,
// release sparkline, and quick links into each queue's screen.
//
// Mirrors the Phase-7 dashboard model (KPI strip → 2-col rows of tiles)
// but flipped to admin priorities: pending counts, SLA breaches,
// money-in-flight rather than portfolio-style narrative.

import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '@/lib/api/store';
import { PageHead } from '@/components/layout/PageHead';
import { Pill } from '@/components/ui/Pill';
import { Icon } from '@/components/ui/Icon';
import { Sparkline } from '@/components/charts/Sparkline';
import { ActivityFeed } from '@/components/dashboard/ActivityFeed';
import { fmtMoney, fmtMoneyFull, fmtRelative } from '@/lib/utils/format';
import {
  adminQueueSummary, adminActivity, escrowByStage, platformSeries,
  totalActionableCount,
} from '@/lib/utils/admin-metrics';
import { disputeCategoryLabel, stageLabel } from '@/lib/utils/labels';
import { QUEUE_HUE } from '@/lib/utils/queue-hues';
import type { ActivityEvent } from '@/lib/utils/dashboard-metrics';

// Map AdminEvent (admin-metrics) into the generic ActivityEvent shape
// the existing ActivityFeed component already understands.
function toActivityEvent(
  e: ReturnType<typeof adminActivity>[number],
): ActivityEvent {
  const kind: ActivityEvent['kind'] =
    e.kind === 'creator_decision'   ? 'app_decision' :
    e.kind === 'brand_verified'     ? 'app_decision' :
    e.kind === 'dispute_resolved'   ? 'submission_decision' :
    e.kind === 'campaign_milestone' ? 'stage' :
    e.kind === 'payout'             ? 'payout' :
    'application';
  return {
    id: e.id, at: e.at, kind,
    text: e.text, detail: e.detail, amount: e.amount, href: e.href,
  };
}

// Phase 20 cleanup: QUEUE_HUE is now imported from a shared module so the
// admin Home and OnboardingTour share the same palette.

export function AdminHome() {
  const db = useStore((s) => s.db);

  const summary = useMemo(() => adminQueueSummary(db), [db]);
  const total = totalActionableCount(summary);
  const activity = useMemo(() => adminActivity(db, 14).map(toActivityEvent), [db]);
  const stageEscrow = useMemo(() => escrowByStage(db), [db]);

  // Releases over last 30 days for the platform-wide sparkline
  const releaseSeries = useMemo(
    () => platformSeries(db, (t) => t.kind === 'escrow_release' || t.kind === 'payout', undefined, 30),
    [db],
  );
  const releaseValues = releaseSeries.map((p) => p.total);
  const releaseTotal = releaseValues.reduce((a, b) => a + b, 0);

  return (
    <div className="page home-page admin-home">
      <PageHead
        num="A · 00"
        label="Console"
        title={total === 0 ? <>All queues <em>clear</em>.</> : <>{total} {total === 1 ? 'item' : 'items'} need <em>review</em>.</>}
        lede={total === 0
          ? 'No creator applications pending, no brands awaiting verification, no open disputes. The platform is healthy.'
          : 'Approve creators, verify brands, resolve disputes. Each row jumps to the canonical screen — or open a queue tile to triage in place.'}
      />

      {/* ---- KPI strip ---- */}
      <div className="kpi-strip mb-24">
        <div>
          <div className="kpi-k">Creator queue</div>
          <div className="kpi-v" style={{ color: summary.creatorApplications.slaBreached ? 'var(--bad)' : 'var(--ink)' }}>
            {summary.creatorApplications.count}
          </div>
          <div className="kpi-d">
            {summary.creatorApplications.oldestPendingDays !== undefined
              ? `Oldest ${summary.creatorApplications.oldestPendingDays}d`
              : 'No backlog'}
          </div>
        </div>
        <div>
          <div className="kpi-k">Brand verifications</div>
          <div className="kpi-v" style={{ color: summary.brandVerifications.slaBreached ? 'var(--bad)' : 'var(--ink)' }}>
            {summary.brandVerifications.count}
          </div>
          <div className="kpi-d">
            {summary.brandVerifications.oldestPendingDays !== undefined
              ? `Oldest ${summary.brandVerifications.oldestPendingDays}d`
              : 'No backlog'}
          </div>
        </div>
        <div>
          <div className="kpi-k">Open disputes</div>
          <div className="kpi-v" style={{ color: summary.openDisputes.count > 0 ? 'var(--bad)' : 'var(--ink)' }}>
            {summary.openDisputes.count}
          </div>
          <div className="kpi-d">
            {summary.openDisputes.oldestPendingDays !== undefined
              ? `Oldest ${summary.openDisputes.oldestPendingDays}d`
              : 'None'}
          </div>
        </div>
        <div>
          <div className="kpi-k">Escrow held</div>
          <div className="kpi-v">{fmtMoneyFull(summary.escrowInFlight.total)}</div>
          <div className="kpi-d">{summary.escrowInFlight.count} campaigns</div>
        </div>
      </div>

      {/* ---- Queue tiles (4 cards in a 2x2) ---- */}
      <div className="home-row admin-queues">
        <QueueTile
          to="/admin/queue"
          hue={QUEUE_HUE.creators}
          name="Creator applications"
          count={summary.creatorApplications.count}
          oldest={summary.creatorApplications.oldestPendingDays}
          slaBreached={summary.creatorApplications.slaBreached}
          recentResolved={summary.creatorApplications.recentResolved}
          recentNoun="approved"
          icon={<Icon.users s={16} />}
        />
        <QueueTile
          to="/admin/queue?type=brands"
          hue={QUEUE_HUE.brands}
          name="Brand verifications"
          count={summary.brandVerifications.count}
          oldest={summary.brandVerifications.oldestPendingDays}
          slaBreached={summary.brandVerifications.slaBreached}
          recentResolved={summary.brandVerifications.recentResolved}
          recentNoun="verified"
          icon={<Icon.building s={16} />}
        />
        <QueueTile
          to="/admin/queue?type=disputes"
          hue={QUEUE_HUE.disputes}
          name="Open disputes"
          count={summary.openDisputes.count}
          oldest={summary.openDisputes.oldestPendingDays}
          slaBreached={summary.openDisputes.slaBreached}
          recentResolved={summary.openDisputes.recentResolved}
          recentNoun="resolved"
          icon={<Icon.briefcase s={16} />}
        />
        <QueueTile
          to="/admin/payouts"
          hue={QUEUE_HUE.escrow}
          name="Escrow & payouts"
          count={summary.escrowInFlight.count}
          countOverride={fmtMoney(summary.escrowInFlight.total)}
          subtitle="held"
          slaBreached={false}
          recentResolved={undefined}
          icon={<Icon.wallet s={16} />}
        />
      </div>

      {/* ---- Releases sparkline + activity feed ---- */}
      <div className="home-row home-row-2col">
        <section className="home-tile tile">
          <div className="home-tile-h">
            <div>
              <div className="mono-meta">Money released · last 30 days</div>
              <div className="home-spend-amount" style={{ marginTop: 6 }}>
                {fmtMoney(releaseTotal)}
              </div>
              <div className="mono-meta">Escrow releases + payouts cleared</div>
            </div>
            <Link to="/admin/payouts" className="card-link">Payouts →</Link>
          </div>
          <div className="home-spend-chart">
            <Sparkline values={releaseValues} height={88} ariaLabel="Platform releases last 30 days" />
          </div>

          {stageEscrow.length > 0 && (
            <div className="admin-escrow-bar">
              <div className="mono-meta mb-8">Escrow currently held by stage</div>
              <ul className="admin-escrow-stages">
                {stageEscrow.map((s) => (
                  <li key={s.stage} className={['admin-escrow-stage', `stage-${s.stage}`].join(' ')}>
                    <span className="admin-escrow-stage-dot" />
                    <span className="admin-escrow-stage-name">{stageLabel(s.stage)}</span>
                    <span className="admin-escrow-stage-count">{s.count}</span>
                    <span className="admin-escrow-stage-total">{fmtMoney(s.total)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <section className="home-tile tile">
          <div className="home-tile-h">
            <div>
              <div className="mono-meta">Platform activity</div>
              <h2 className="home-tile-title">What's <em>moved</em>.</h2>
            </div>
            <Link to="/admin/audit" className="card-link">Full audit →</Link>
          </div>
          <ActivityFeed
            events={activity}
            emptyHint="Quiet platform. Approvals, verifications, dispute resolutions, and large payouts will surface here."
          />
        </section>
      </div>

      {/* ---- Most-pressing items shortlist (top of each non-empty queue) ---- */}
      {(summary.creatorApplications.count > 0 || summary.brandVerifications.count > 0 || summary.openDisputes.count > 0) && (
        <section className="home-tile tile">
          <div className="home-tile-h">
            <div>
              <div className="mono-meta">Up next</div>
              <h2 className="home-tile-title">Oldest pending across <em>all queues</em>.</h2>
            </div>
          </div>
          <UpNextList db={db} />
        </section>
      )}
    </div>
  );
}

// ============ Queue tile ============

function QueueTile(props: {
  to: string;
  hue: string;
  name: string;
  count: number;
  countOverride?: string;
  subtitle?: string;
  oldest?: number;
  slaBreached: boolean;
  recentResolved: number | undefined;
  recentNoun?: string;
  icon: React.ReactNode;
}) {
  const empty = props.count === 0;
  return (
    <Link to={props.to} className={['admin-queue-tile', 'tile', empty ? 'is-empty' : '', props.slaBreached ? 'is-breached' : ''].join(' ')} style={{ ['--queue-hue' as string]: props.hue }}>
      <div className="admin-queue-tile-h">
        <span className="admin-queue-tile-icon" aria-hidden="true">{props.icon}</span>
        <span className="admin-queue-tile-name">{props.name}</span>
        {props.slaBreached && <Pill tone="bad">SLA</Pill>}
      </div>
      <div className="admin-queue-tile-body">
        <div className="admin-queue-tile-count">
          {props.countOverride ?? props.count}
        </div>
        <div className="admin-queue-tile-meta">
          {empty
            ? '✓ Clear'
            : props.subtitle
              ? props.subtitle
              : props.oldest !== undefined
                ? `Oldest ${props.oldest}d`
                : 'pending'}
        </div>
      </div>
      {props.recentResolved !== undefined && props.recentResolved > 0 && (
        <div className="admin-queue-tile-foot mono-meta">
          {props.recentResolved} {props.recentNoun} this week
        </div>
      )}
      <span className="admin-queue-tile-arrow" aria-hidden="true"><Icon.arrow s={14} /></span>
    </Link>
  );
}

// ============ "Up next" merged shortlist ============

interface UpNextItem {
  at: string;
  href: string;
  label: string;
  detail: string;
  queueName: string;
  hue: string;
  daysOld: number;
}

function UpNextList({ db }: { db: ReturnType<typeof useStore.getState>['db'] }) {
  const items: UpNextItem[] = [];
  const REF = new Date('2026-04-27');
  const DAY = 24 * 60 * 60 * 1000;

  db.users
    .filter((u) => u.status === 'pending_admin_review' && u.creatorId)
    .forEach((u) => {
      const c = db.creators.find((x) => x.id === u.creatorId);
      items.push({
        at: u.createdAt,
        href: '/admin/queue',
        label: `${c?.name || 'Creator'} application`,
        detail: c ? `${c.handle} · ${c.tier} · ${c.city}` : u.email,
        queueName: 'Creator',
        hue: QUEUE_HUE.creators,
        daysOld: Math.max(0, Math.round((+REF - +new Date(u.createdAt)) / DAY)),
      });
    });

  db.brands
    .filter((b) => !b.verified)
    .forEach((b) => {
      const u = db.users.find((x) => x.id === b.userId);
      items.push({
        at: u?.createdAt || new Date().toISOString(),
        href: '/admin/queue?type=brands',
        label: `${b.name} verification`,
        detail: `${b.industry || 'Brand'} · ${b.hq || '—'}`,
        queueName: 'Brand',
        hue: QUEUE_HUE.brands,
        daysOld: u ? Math.max(0, Math.round((+REF - +new Date(u.createdAt)) / DAY)) : 0,
      });
    });

  db.disputes
    .filter((d) => d.status === 'open' || d.status === 'in-review')
    .forEach((d) => {
      const c = db.campaigns.find((x) => x.id === d.campaignId);
      items.push({
        // P2 §1.4 — `raisedAt` is now ms; the queue widget below sorts by
        // `+new Date(at)` so we can pass an ISO string for compat.
        at: new Date(d.raisedAt).toISOString(),
        href: '/admin/queue?type=disputes',
        label: `Dispute · ${c?.title || 'campaign'}`,
        detail: disputeCategoryLabel(d.category),
        queueName: 'Dispute',
        hue: QUEUE_HUE.disputes,
        daysOld: Math.max(0, Math.round((+REF - d.raisedAt) / DAY)),
      });
    });

  items.sort((a, b) => +new Date(a.at) - +new Date(b.at));

  if (items.length === 0) return null;

  return (
    <ol className="admin-upnext">
      {items.slice(0, 8).map((item, i) => (
        <li key={i} className="admin-upnext-row">
          <Link to={item.href} className="admin-upnext-link" style={{ ['--queue-hue' as string]: item.hue }}>
            <span className="admin-upnext-dot" aria-hidden="true" />
            <span className="admin-upnext-queue mono-meta">{item.queueName}</span>
            <span className="admin-upnext-label">{item.label}</span>
            <span className="admin-upnext-detail mono-meta">{item.detail}</span>
            <span className={['admin-upnext-age mono-meta', item.daysOld >= 3 ? 'is-old' : ''].join(' ')}>
              {item.daysOld}d ago
            </span>
            <span className="admin-upnext-time mono-meta">{fmtRelative(item.at)}</span>
          </Link>
        </li>
      ))}
    </ol>
  );
}
