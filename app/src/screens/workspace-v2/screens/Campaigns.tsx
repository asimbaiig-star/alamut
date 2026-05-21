// Campaigns.tsx — v2 brand-side campaigns pipeline
//
// Stage-grouped list of every campaign the brand has run. Live and
// Active stages get expanded rows with progress bars; Planned and
// Completed get tighter compact rows. "+ New campaign" CTA in the
// topbar. Each row drills into the campaign detail.
//
// Stage filter — clicking a stage chip in the toolbar narrows the
// list to that stage. "All stages" shows everything grouped. The
// chip-row de-clutters the page when a brand has dozens of past
// campaigns and only wants to see what's live or paused right now.

import { useMemo, useState } from 'react';
import { fmtUSD, Icon, Topbar } from '../lib';
import { type V2Campaign } from '../data';
import { useV2Campaigns, useV2Creators } from '../v2Hooks';

interface Props {
  onRoute: (r: string) => void;
}

// P1b §1.2 — 4-stage campaign lifecycle. Per-collab progress (shortlist /
// offer / production / posted / reporting) lives on Collaboration (P1c)
// and surfaces on the campaign-detail Pipeline tab kanban — not here.
const STAGES: { key: V2Campaign['status']; label: string; tip?: string }[] = [
  { key: 'Live',      label: 'Live',      tip: 'Accepting applications · creators delivering' },
  { key: 'Paused',    label: 'Paused',    tip: 'Brand temporarily suspended; resume to continue' },
  { key: 'Planned',   label: 'Draft',     tip: 'Drafted, not yet published' },
  { key: 'Completed', label: 'Closed',    tip: 'Ended; archived' },
];

type StageFilter = 'all' | V2Campaign['status'];

export function Campaigns({ onRoute }: Props) {
  const campaigns = useV2Campaigns();
  const creators = useV2Creators();
  const [filter, setFilter] = useState<StageFilter>('all');

  const grouped = useMemo(() => {
    const m: Record<V2Campaign['status'], V2Campaign[]> = {
      Live: [], Paused: [], Planned: [], Completed: [],
    };
    // Sort newest-first by createdAt so freshly-created campaigns appear
    // at the top of each status bucket rather than the bottom.
    const sorted = campaigns.slice().sort(
      (a, b) => +new Date(b.createdAt) - +new Date(a.createdAt),
    );
    for (const c of sorted) m[c.status].push(c);
    return m;
  }, [campaigns]);

  const totalBudget = campaigns.reduce((s, c) => s + c.budget, 0);
  const totalSpent = campaigns.reduce((s, c) => s + c.spent, 0);
  // Pre-fix the "Active creators" summary stat was the literal string
  // "14 across 4 campaigns" on every load — same number regardless of
  // the brand's actual roster. Derive it: unique creators currently
  // engaged on Live or Paused campaigns (campaigns that still need
  // attention), and the count of campaigns those creators are on.
  const activeCampaigns = campaigns.filter(
    (c) => c.status === 'Live' || c.status === 'Paused',
  );
  const activeCreatorIds = new Set<string>();
  for (const c of activeCampaigns) for (const id of c.creators) activeCreatorIds.add(id);
  const activeCreatorCount = activeCreatorIds.size;
  const activeCampaignCount = activeCampaigns.length;

  // The stages we actually render. When `filter === 'all'`, render
  // every stage that has at least one campaign; otherwise narrow to
  // the selected stage so the page de-clutters.
  const visibleStages = STAGES.filter((s) =>
    (filter === 'all' || filter === s.key) && grouped[s.key].length > 0,
  );

  return (
    <>
      <Topbar
        title="My campaigns"
        crumb={`${campaigns.length} total · ${grouped.Live.length} live · ${grouped.Paused.length} paused`}
        actions={
          <button className="v2-btn v2-btn-primary" type="button" onClick={() => onRoute('campaign-new')}>
            {Icon.plus}<span>New campaign</span>
          </button>
        }
      />
      <div className="v2-content">
        {/* Top summary band */}
        <div className="v2-card v2-card-pad" style={{ marginBottom: 16 }}>
          <div className="v2-row" style={{ gap: 32, flexWrap: 'wrap' }}>
            <SummaryStat label="Total budget" value={fmtUSD(totalBudget)} />
            <SummaryStat label="Spent" value={fmtUSD(totalSpent)} sub={totalBudget > 0 ? `${Math.round((totalSpent / totalBudget) * 100)}% deployed` : '—'} />
            <SummaryStat
              label="Active creators"
              value={String(activeCreatorCount)}
              sub={
                activeCampaignCount === 0
                  ? 'no live or paused campaigns'
                  : `across ${activeCampaignCount} ${activeCampaignCount === 1 ? 'campaign' : 'campaigns'}`
              }
            />
            <span className="v2-spacer" />
            <button
              className="v2-btn v2-btn-outline v2-btn-sm"
              type="button"
              onClick={() => onRoute('wallet')}
            >
              View ledger {Icon.arrow}
            </button>
          </div>
        </div>

        {/* Stage filter chips — toggle the visible group. Counts come
            from the live grouped set so the chips always reflect what's
            in the table below. */}
        <div className="v2-row" style={{ gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
          <FilterChip
            label="All stages"
            count={campaigns.length}
            active={filter === 'all'}
            onClick={() => setFilter('all')}
          />
          {STAGES.map((s) => (
            <FilterChip
              key={s.key}
              label={s.label}
              count={grouped[s.key].length}
              active={filter === s.key}
              onClick={() => setFilter(s.key)}
            />
          ))}
        </div>

        {visibleStages.length === 0 && (
          <div className="v2-card v2-card-pad-lg" style={{ textAlign: 'center', color: 'var(--v2-ink-3)' }}>
            No campaigns in this stage. {filter !== 'all' && (
              <button
                type="button"
                className="v2-link-btn"
                onClick={() => setFilter('all')}
                style={{ marginLeft: 4 }}
              >
                Show all stages
              </button>
            )}
          </div>
        )}

        {/* Stage-grouped sections */}
        {visibleStages.map((stage) => {
          const items = grouped[stage.key];
          if (items.length === 0) return null;
          const isCompact = stage.key === 'Planned' || stage.key === 'Completed';
          return (
            <section key={stage.key} style={{ marginBottom: 32 }}>
              <div
                className="v2-row"
                style={{ justifyContent: 'space-between', marginBottom: 12, alignItems: 'flex-end' }}
              >
                <div>
                  <h2 className="v2-section-title" style={{ fontSize: 22, marginBottom: 4 }}>
                    {stage.label}
                  </h2>
                  {stage.tip && <p className="v2-section-sub" style={{ fontSize: 12.5 }}>{stage.tip}</p>}
                </div>
                <span className="v2-muted" style={{ fontSize: 12 }}>
                  {items.length} {items.length === 1 ? 'campaign' : 'campaigns'}
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {items.map((c) => (
                  isCompact
                    ? <CompactRow key={c.id} campaign={c} onClick={() => onRoute(`campaign:${c.id}`)} />
                    : <ExpandedRow key={c.id} campaign={c} creators={creators} onClick={() => onRoute(`campaign:${c.id}`)} />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}

function SummaryStat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <div className="v2-stat-label">{label}</div>
      <div className="v2-stat-value v2-tabular">{value}</div>
      {sub && <div className="v2-stat-sub">{sub}</div>}
    </div>
  );
}

function ExpandedRow({ campaign, creators, onClick }: {
  campaign: V2Campaign;
  creators: ReturnType<typeof useV2Creators>;
  onClick: () => void;
}) {
  const pct = campaign.budget > 0 ? Math.round((campaign.spent / campaign.budget) * 100) : 0;
  const creatorAvatars = campaign.creators
    .map((id) => creators.find((c) => c.id === id))
    .filter(Boolean)
    .slice(0, 5);
  const daysLeft = Math.max(
    0,
    Math.ceil((+new Date(campaign.deadline) - Date.now()) / 86_400_000),
  );

  return (
    <article className="v2-card v2-card-pad v2-card-clickable" onClick={onClick}>
      <div className="v2-row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
        <span className={`v2-pill ${campaign.status === 'Live' ? 'v2-pill-live' : 'v2-pill-moss'}`}>
          {campaign.status}
        </span>
        <span className="v2-muted" style={{ fontSize: 12 }}>{campaign.brand}</span>
      </div>
      <h3 style={{
        fontFamily: 'var(--v2-font-display)',
        fontSize: 22,
        fontWeight: 500,
        letterSpacing: '-0.022em',
        margin: '4px 0 6px',
        color: 'var(--v2-ink)',
      }}>{campaign.name}</h3>
      <p className="v2-muted" style={{ fontSize: 13, lineHeight: 1.5, margin: '0 0 16px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
        {campaign.brief}
      </p>

      <div className="v2-progress" style={{ marginBottom: 10 }}>
        <div className="v2-progress-fill" style={{ width: `${pct}%` }} />
      </div>

      <div className="v2-row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div className="v2-row" style={{ gap: 14, fontSize: 12.5 }}>
          <Meta label="Spent" value={`${fmtUSD(campaign.spent)} / ${fmtUSD(campaign.budget)}`} />
          <Meta label="Confirmed" value={`${campaign.confirmed} creators`} />
          <Meta label="Live" value={`${campaign.live} placements`} />
          <Meta label="Deadline" value={daysLeft > 0 ? `${daysLeft}d` : 'Past due'} accent={daysLeft <= 7} />
        </div>
        <div className="v2-row" style={{ gap: 4 }}>
          <div className="v2-avatar-stack">
            {creatorAvatars.map((cr, i) => cr && (
              <div
                key={i}
                className="v2-avatar v2-avatar-sm"
                style={{
                  backgroundImage: `url(${cr.avatar})`,
                  border: '2px solid var(--v2-paper)',
                  marginLeft: i === 0 ? 0 : -8,
                  width: 28, height: 28,
                }}
                aria-label={cr.name}
              />
            ))}
            {campaign.creators.length > creatorAvatars.length && (
              <div
                className="v2-avatar v2-avatar-sm"
                style={{
                  marginLeft: -8,
                  background: 'var(--v2-bg-2)',
                  border: '2px solid var(--v2-paper)',
                  width: 28, height: 28,
                  fontSize: 11,
                  fontWeight: 600,
                  color: 'var(--v2-ink-3)',
                }}
              >+{campaign.creators.length - creatorAvatars.length}</div>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

function CompactRow({ campaign, onClick }: { campaign: V2Campaign; onClick: () => void }) {
  return (
    <button
      type="button"
      className="v2-card v2-card-clickable"
      onClick={onClick}
      style={{
        padding: '14px 18px',
        display: 'grid',
        gridTemplateColumns: 'auto 1fr auto auto',
        gap: 16,
        alignItems: 'center',
        background: 'var(--v2-paper)',
        textAlign: 'left',
        fontFamily: 'inherit',
        color: 'var(--v2-ink)',
      }}
    >
      <span className={`v2-pill ${campaign.status === 'Planned' ? 'v2-pill-draft' : 'v2-pill-moss'}`}>
        {campaign.status}
      </span>
      <div style={{ minWidth: 0 }}>
        <div style={{
          fontFamily: 'var(--v2-font-display)',
          fontSize: 16,
          fontWeight: 500,
          letterSpacing: '-0.014em',
          color: 'var(--v2-ink)',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>{campaign.name}</div>
        <div className="v2-muted" style={{ fontSize: 11.5 }}>
          {campaign.brand} · {campaign.placement}
        </div>
      </div>
      <div className="v2-muted v2-tabular" style={{ fontSize: 12.5 }}>
        {fmtUSD(campaign.budget)}
      </div>
      <span style={{ color: 'var(--v2-ink-3)', display: 'flex' }}>{Icon.arrow}</span>
    </button>
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
        style={{ fontSize: 13, fontWeight: accent ? 600 : 500 }}
      >{value}</div>
    </div>
  );
}

function FilterChip({
  label, count, active, onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="v2-pill"
      style={{
        cursor: 'pointer',
        fontSize: 12.5,
        fontWeight: active ? 600 : 500,
        background: active ? 'var(--v2-ink)' : 'transparent',
        color: active ? 'var(--v2-paper)' : 'var(--v2-ink-2)',
        border: `1px solid ${active ? 'var(--v2-ink)' : 'var(--v2-line)'}`,
        padding: '6px 12px',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
      }}
    >
      {label}
      <span
        style={{
          padding: '0 6px',
          borderRadius: 999,
          background: active ? 'rgba(255,255,255,0.15)' : 'var(--v2-bg-2)',
          color: active ? 'var(--v2-paper)' : 'var(--v2-ink-3)',
          fontSize: 10.5,
          fontWeight: 700,
        }}
      >
        {count}
      </span>
    </button>
  );
}
