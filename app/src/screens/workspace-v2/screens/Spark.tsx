// Spark.tsx — v2 conversational campaign planner
//
// Phase E of the migration. The centerpiece feature. The user:
//   "scripted full working prototype, not routed to real LLM,
//    but should work with the entire workspace as intended"
//
// Architecture:
//   • Engine: processInput → SparkMessage (sparkEngine.ts)
//   • UI: chat thread on the left, shortlist canvas on the right,
//     composer at the bottom with suggestion chips.
//   • Rich blocks: creator-cards, comparison, projection, brief-draft,
//     shortlist-snapshot. Each block is its own component below.
//   • Persistence: localStorage history + context, restored on mount.
//
// Workspace integration: every block's primary action routes into
// the existing v2 workspace (Save → adds to shortlist context;
// Send brief → routes to Inbox; Open profile → creator:<id> drilldown).

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  fmtUSD, fmtFollowers, Icon, PLATFORM_META, ScoreBadge, Topbar,
} from '../lib';
import {
  emptyContext, getCreator, processInput, setSparkPool, thinkingDelay, welcomeMessage,
  type SparkBlock, type SparkContext, type SparkMessage,
} from '../sparkEngine';
import {
  useV2AllCampaigns, useV2BrandShortlist, useV2Creators, useV2CurrentBrand,
  v2SyncSparkShortlist,
} from '../v2Hooks';
import { pushToast } from '@/lib/utils/toast';

interface Props {
  onRoute: (r: string) => void;
}

const HISTORY_KEY = 'alamut.v2.spark.history';
const CONTEXT_KEY = 'alamut.v2.spark.context';

export function Spark({ onRoute }: Props) {
  const allCreators = useV2Creators();
  const allCampaigns = useV2AllCampaigns();
  const brand = useV2CurrentBrand();
  const brandShortlist = useV2BrandShortlist();

  // Push the live pool into the engine before any handler reads it.
  // Important: this also runs on every store change so when a real
  // brand mutation happens (e.g. someone saved a creator), Spark sees
  // the fresh data on its next response.
  setSparkPool({ creators: allCreators, campaigns: allCampaigns });

  const [history, setHistory] = useState<SparkMessage[]>(() => loadHistory());
  const [context, setContext] = useState<SparkContext>(() => loadContext(brand?.name));
  const [draft, setDraft] = useState('');
  const [thinking, setThinking] = useState(false);
  const threadRef = useRef<HTMLDivElement | null>(null);

  // Sync brand savedCreators → context.shortlist once on mount so Spark
  // starts pre-populated with whatever the brand has shortlisted in
  // Discover or saved historically.
  useEffect(() => {
    if (brandShortlist.length === 0) return;
    setContext((ctx) => ({
      ...ctx,
      shortlist: Array.from(new Set([...brandShortlist, ...ctx.shortlist])),
    }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When the brand record loads (or changes), seed context.brand from it
  useEffect(() => {
    if (brand?.name) {
      setContext((ctx) => (ctx.brand !== brand.name ? { ...ctx, brand: brand.name } : ctx));
    }
  }, [brand?.name]);

  // Persist to localStorage whenever they change
  useEffect(() => {
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(history)); } catch { /* ignore */ }
  }, [history]);
  useEffect(() => {
    try { localStorage.setItem(CONTEXT_KEY, JSON.stringify(context)); } catch { /* ignore */ }
  }, [context]);

  // Auto-scroll to bottom on new messages or thinking state
  useEffect(() => {
    if (!threadRef.current) return;
    threadRef.current.scrollTo({ top: threadRef.current.scrollHeight, behavior: 'smooth' });
  }, [history, thinking]);

  function handleSend(text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;
    const userMsg: SparkMessage = {
      id: `u_${Date.now()}`,
      from: 'user',
      blocks: [{ kind: 'text', body: trimmed }],
      ts: Date.now(),
    };
    setHistory((h) => [...h, userMsg]);
    setDraft('');
    setThinking(true);

    const delay = thinkingDelay();
    window.setTimeout(() => {
      const { reply, newContext } = processInput(trimmed, context);
      setHistory((h) => [...h, reply]);
      setContext(newContext);
      setThinking(false);
    }, delay);
  }

  function handleReset() {
    setHistory([welcomeMessage()]);
    setContext(emptyContext());
  }

  function saveCreators(creatorIds: string[]) {
    // Update local Spark context AND sync into brand.savedCreators so it
    // persists in the real store and shows up in Discover etc.
    setContext((ctx) => ({
      ...ctx,
      shortlist: Array.from(new Set([...ctx.shortlist, ...creatorIds])),
    }));
    v2SyncSparkShortlist(creatorIds);
  }

  // Initial empty state — drop in welcome on mount if history empty
  useEffect(() => {
    if (history.length === 0) setHistory([welcomeMessage()]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const shortlistCreators = useMemo(
    () => context.shortlist.map((id) => getCreator(id)).filter((x): x is NonNullable<typeof x> => !!x),
    [context.shortlist],
  );
  const shortlistTotal = shortlistCreators.reduce((s, c) => s + c.rate, 0);
  const shortlistReach = shortlistCreators.reduce(
    (s, c) => s + c.channels.reduce((a, ch) => a + ch.followers, 0),
    0,
  );
  const shortlistAvgER = shortlistCreators.length > 0
    ? (
        shortlistCreators.reduce(
          (s, c) => s + c.channels.reduce((a, ch) => a + ch.engagement, 0) / c.channels.length,
          0,
        ) / shortlistCreators.length
      ).toFixed(1)
    : '—';

  return (
    <>
      <Topbar
        title="Spark"
        crumb={
          context.category || context.region || context.budget
            ? `Planning · ${[context.category, context.region, context.budget ? `$${context.budget.toLocaleString()}` : null].filter(Boolean).join(' · ')}`
            : 'Conversational campaign planner · scripted prototype'
        }
        actions={
          <>
            <button className="v2-btn v2-btn-outline" type="button" onClick={handleReset}>
              {Icon.plus}<span>New plan</span>
            </button>
            <button
              className="v2-btn v2-btn-primary"
              type="button"
              disabled={shortlistCreators.length === 0}
              onClick={() => onRoute('campaigns')}
            >
              {Icon.check}<span>Lock in campaign</span>
            </button>
          </>
        }
      />
      <div className="v2-content v2-spark-content">
        <div className="v2-spark-grid">
          {/* Chat column */}
          <div className="v2-spark-chat">
            <div className="v2-spark-thread" ref={threadRef}>
              {history.map((m) => (
                <MessageRow
                  key={m.id}
                  message={m}
                  onSendSuggestion={handleSend}
                  onSave={saveCreators}
                  onRoute={onRoute}
                  shortlist={context.shortlist}
                />
              ))}
              {thinking && <ThinkingRow />}
            </div>

            <div className="v2-spark-composer">
              <div className="v2-spark-quick-chips">
                {(history[history.length - 1]?.suggestions ?? []).map((s) => (
                  <button
                    key={s}
                    type="button"
                    className="v2-spark-chip"
                    onClick={() => handleSend(s)}
                    disabled={thinking}
                  >
                    {s}
                  </button>
                ))}
              </div>
              <div className="v2-spark-input">
                <textarea
                  rows={1}
                  placeholder="Tell Spark what you want to plan..."
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend(draft);
                    }
                  }}
                  disabled={thinking}
                />
                <button
                  type="button"
                  className="v2-btn v2-btn-primary"
                  onClick={() => handleSend(draft)}
                  disabled={thinking || !draft.trim()}
                >
                  {Icon.send}<span>Send</span>
                </button>
              </div>
            </div>
          </div>

          {/* Shortlist canvas */}
          <aside className="v2-spark-canvas">
            <div className="v2-eyebrow" style={{ marginBottom: 10 }}>Shortlist</div>
            <div className="v2-card v2-card-pad">
              {shortlistCreators.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px 12px' }}>
                  <div style={{
                    width: 48,
                    height: 48,
                    borderRadius: 999,
                    background: 'var(--v2-accent-soft)',
                    color: 'var(--v2-accent)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 12px',
                  }}>{Icon.spark}</div>
                  <div style={{
                    fontFamily: 'var(--v2-font-display)',
                    fontSize: 16,
                    fontWeight: 500,
                    letterSpacing: '-0.014em',
                    color: 'var(--v2-ink)',
                    marginBottom: 4,
                  }}>
                    Empty shortlist
                  </div>
                  <p className="v2-muted" style={{ fontSize: 12.5, margin: 0, lineHeight: 1.5 }}>
                    Save creators here as Spark suggests them. Build up a campaign plan turn by turn.
                  </p>
                </div>
              ) : (
                <>
                  {/* Mini KPI strip */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: 12,
                    marginBottom: 16,
                    paddingBottom: 16,
                    borderBottom: '1px solid var(--v2-line)',
                  }}>
                    <CanvasKpi label="Saved" value={String(shortlistCreators.length)} />
                    <CanvasKpi label="Total cost" value={fmtUSD(shortlistTotal)} accent />
                    <CanvasKpi label="Combined reach" value={fmtFollowers(shortlistReach)} />
                    <CanvasKpi label="Avg ER" value={typeof shortlistAvgER === 'string' ? shortlistAvgER : `${shortlistAvgER}%`} />
                  </div>

                  {/* Shortlist creators */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {shortlistCreators.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        className="v2-spark-canvas-row"
                        onClick={() => onRoute(`creator:${c.id}`)}
                      >
                        <div
                          className="v2-avatar v2-avatar-sm"
                          style={{ backgroundImage: `url(${c.avatar})` }}
                          aria-hidden="true"
                        />
                        <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                          <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {c.name}
                          </div>
                          <div className="v2-muted" style={{ fontSize: 11.5 }}>
                            @{c.handle} · {fmtUSD(c.rate)}
                          </div>
                        </div>
                        <button
                          type="button"
                          className="v2-icon-btn"
                          aria-label="Remove from shortlist"
                          onClick={(e) => {
                            e.stopPropagation();
                            setContext((ctx) => ({ ...ctx, shortlist: ctx.shortlist.filter((id) => id !== c.id) }));
                          }}
                          style={{ width: 24, height: 24 }}
                        >
                          ×
                        </button>
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    className="v2-btn v2-btn-primary v2-btn-sm"
                    style={{ width: '100%', marginTop: 16, justifyContent: 'center' }}
                    onClick={() => handleSend('Project reach for shortlist')}
                  >
                    {Icon.chart} Project this plan
                  </button>
                </>
              )}
            </div>

            <p className="v2-muted" style={{ fontSize: 11.5, marginTop: 12, lineHeight: 1.5 }}>
              The shortlist persists across reloads. Use "Lock in campaign" in the topbar to commit it as a real campaign.
            </p>
          </aside>
        </div>
      </div>
    </>
  );
}

// =====================================================================
// Sub-components
// =====================================================================

function MessageRow({ message, onSendSuggestion, onSave, onRoute, shortlist }: {
  message: SparkMessage;
  onSendSuggestion: (s: string) => void;
  onSave: (creatorIds: string[]) => void;
  onRoute: (r: string) => void;
  shortlist: string[];
}) {
  const isUser = message.from === 'user';
  return (
    <div className={`v2-spark-row ${isUser ? 'is-user' : 'is-spark'}`}>
      {!isUser && (
        <div className="v2-spark-avatar" aria-hidden="true">
          {Icon.spark}
        </div>
      )}
      <div className="v2-spark-bubble-wrap">
        {message.blocks.map((block, i) => (
          <BlockRenderer
            key={i}
            block={block}
            isUser={isUser}
            onSave={onSave}
            onRoute={onRoute}
            shortlist={shortlist}
          />
        ))}
        {!isUser && message.suggestions && message.suggestions.length > 0 && (
          <div className="v2-spark-inline-chips">
            {message.suggestions.map((s) => (
              <button
                key={s}
                type="button"
                className="v2-spark-chip v2-spark-chip-inline"
                onClick={() => onSendSuggestion(s)}
              >{s}</button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ThinkingRow() {
  return (
    <div className="v2-spark-row is-spark">
      <div className="v2-spark-avatar" aria-hidden="true">
        {Icon.spark}
      </div>
      <div className="v2-spark-bubble-wrap">
        <div className="v2-spark-bubble v2-spark-thinking">
          <span /><span /><span />
        </div>
      </div>
    </div>
  );
}

function BlockRenderer({ block, isUser, onSave, onRoute, shortlist }: {
  block: SparkBlock;
  isUser: boolean;
  onSave: (creatorIds: string[]) => void;
  onRoute: (r: string) => void;
  shortlist: string[];
}) {
  if (block.kind === 'text') {
    return (
      <div className={`v2-spark-bubble ${isUser ? 'is-user' : 'is-spark'}`}>
        {block.body.split('\n').map((line, i) => <div key={i}>{line || ' '}</div>)}
      </div>
    );
  }
  if (block.kind === 'creator-cards') {
    return (
      <CreatorCardsBlock block={block} onSave={onSave} onRoute={onRoute} shortlist={shortlist} />
    );
  }
  if (block.kind === 'comparison') {
    return <ComparisonBlock block={block} onSave={onSave} onRoute={onRoute} />;
  }
  if (block.kind === 'projection') {
    return <ProjectionBlock block={block} />;
  }
  if (block.kind === 'brief-draft') {
    return <BriefDraftBlock block={block} onRoute={onRoute} />;
  }
  if (block.kind === 'shortlist-snapshot') {
    return <ShortlistSnapshotBlock block={block} onRoute={onRoute} />;
  }
  return null;
}

// ---------- creator-cards ----------

function CreatorCardsBlock({ block, onSave, onRoute, shortlist }: {
  block: Extract<SparkBlock, { kind: 'creator-cards' }>;
  onSave: (creatorIds: string[]) => void;
  onRoute: (r: string) => void;
  shortlist: string[];
}) {
  const creators = block.creatorIds.map((id) => getCreator(id)).filter((x): x is NonNullable<typeof x> => !!x);
  return (
    <div className="v2-spark-block v2-spark-block-creators">
      <div className="v2-row" style={{ justifyContent: 'space-between', marginBottom: 12, gap: 8 }}>
        <div className="v2-eyebrow">{creators.length} creator{creators.length === 1 ? '' : 's'}</div>
        <button
          type="button"
          className="v2-btn v2-btn-sm v2-btn-outline"
          onClick={() => onSave(block.creatorIds)}
        >
          {Icon.plus} Save all to shortlist
        </button>
      </div>
      <div className="v2-spark-creator-grid">
        {creators.map((c) => {
          const saved = shortlist.includes(c.id);
          return (
            <article key={c.id} className="v2-spark-creator-card">
              <button
                type="button"
                onClick={() => onRoute(`creator:${c.id}`)}
                className="v2-spark-creator-head"
              >
                <div
                  className="v2-avatar v2-avatar-md"
                  style={{ backgroundImage: `url(${c.avatar})` }}
                  aria-hidden="true"
                />
                <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                  <div className="v2-row" style={{ gap: 6, alignItems: 'center', marginBottom: 2 }}>
                    <span style={{ fontSize: 14, fontWeight: 600 }}>{c.name}</span>
                    {c.verified && <span className="v2-pill v2-pill-moss" style={{ fontSize: 10 }}>{Icon.check}</span>}
                  </div>
                  <div className="v2-muted" style={{ fontSize: 12 }}>
                    @{c.handle} · {c.city}
                  </div>
                </div>
                <ScoreBadge score={c.score} />
              </button>

              <div className="v2-row" style={{ gap: 8, padding: '0 12px 12px', flexWrap: 'wrap' }}>
                {c.channels.slice(0, 2).map((ch) => {
                  const meta = PLATFORM_META[ch.platform];
                  return (
                    <div key={ch.platform} className="v2-row" style={{ gap: 6, fontSize: 11.5 }}>
                      <span style={{ color: meta.color, display: 'flex' }}>{meta.icon}</span>
                      <span className="v2-muted">{fmtFollowers(ch.followers)}</span>
                    </div>
                  );
                })}
                <span className="v2-spacer" />
                <span className="v2-tabular" style={{ fontWeight: 600, fontSize: 12.5, color: 'var(--v2-accent)' }}>
                  {fmtUSD(c.rate)}
                </span>
              </div>

              <div style={{ display: 'flex', gap: 6, padding: '12px', borderTop: '1px solid var(--v2-line)', background: 'var(--v2-bg-1)' }}>
                <button
                  type="button"
                  className="v2-btn v2-btn-sm v2-btn-outline"
                  style={{ flex: 1, justifyContent: 'center' }}
                  onClick={() => onRoute(`creator:${c.id}`)}
                >
                  Profile
                </button>
                <button
                  type="button"
                  className={`v2-btn v2-btn-sm ${saved ? 'v2-btn-ghost' : 'v2-btn-primary'}`}
                  style={{ flex: 1, justifyContent: 'center' }}
                  onClick={() => onSave([c.id])}
                  disabled={saved}
                >
                  {saved ? `${Icon.check} Saved` : `${Icon.plus} Save`}
                </button>
              </div>
            </article>
          );
        })}
      </div>
      {block.rationale && (
        <div className="v2-spark-rationale">
          <span style={{ color: 'var(--v2-accent)', flexShrink: 0 }}>{Icon.spark}</span>
          <span>{block.rationale}</span>
        </div>
      )}
    </div>
  );
}

// ---------- comparison ----------

function ComparisonBlock({ block, onSave, onRoute }: {
  block: Extract<SparkBlock, { kind: 'comparison' }>;
  onSave: (creatorIds: string[]) => void;
  onRoute: (r: string) => void;
}) {
  const creators = block.creatorIds.map((id) => getCreator(id)).filter((x): x is NonNullable<typeof x> => !!x);
  const rows: { label: string; values: (string | number)[] }[] = [
    { label: 'Score', values: creators.map((c) => c.score) },
    { label: 'City', values: creators.map((c) => c.city) },
    { label: 'Categories', values: creators.map((c) => c.categories.slice(0, 2).join(' · ')) },
    { label: 'Followers', values: creators.map((c) => fmtFollowers(c.channels.reduce((s, ch) => s + ch.followers, 0))) },
    { label: 'Avg engagement', values: creators.map((c) => `${(c.channels.reduce((s, ch) => s + ch.engagement, 0) / c.channels.length).toFixed(1)}%`) },
    { label: 'Top audience', values: creators.map((c) => `${c.audience.female}%F · ${c.audience.male}%M · ${c.audience.topCity}`) },
    { label: 'Going rate', values: creators.map((c) => fmtUSD(c.rate)) },
    { label: 'Past brands', values: creators.map((c) => c.pastBrands.slice(0, 2).join(' · ')) },
  ];

  return (
    <div className="v2-spark-block v2-spark-block-compare">
      <table className="v2-spark-compare-table">
        <thead>
          <tr>
            <th />
            {creators.map((c) => (
              <th key={c.id}>
                <button
                  type="button"
                  className="v2-spark-compare-head"
                  onClick={() => onRoute(`creator:${c.id}`)}
                >
                  <div
                    className="v2-avatar v2-avatar-sm"
                    style={{ backgroundImage: `url(${c.avatar})` }}
                    aria-hidden="true"
                  />
                  <span>{c.name}</span>
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label}>
              <td className="v2-spark-compare-label">{row.label}</td>
              {row.values.map((v, i) => (
                <td key={i} className="v2-tabular">{v}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="v2-row" style={{ gap: 8, padding: 12, justifyContent: 'flex-end', borderTop: '1px solid var(--v2-line)', background: 'var(--v2-bg-1)' }}>
        <button
          type="button"
          className="v2-btn v2-btn-sm v2-btn-outline"
          onClick={() => onSave(block.creatorIds)}
        >
          {Icon.plus} Save all
        </button>
        <button
          type="button"
          className="v2-btn v2-btn-sm v2-btn-primary"
          onClick={() => onRoute(`creator:${creators[0].id}`)}
        >
          Pick {creators[0].name.split(' ')[0]}
        </button>
      </div>
    </div>
  );
}

// ---------- projection ----------

function ProjectionBlock({ block }: { block: Extract<SparkBlock, { kind: 'projection' }> }) {
  const creators = block.creatorIds.map((id) => getCreator(id)).filter((x): x is NonNullable<typeof x> => !!x);
  const cpm = block.budget > 0 && block.reach > 0 ? Math.round((block.budget / block.reach) * 1000) : 0;

  return (
    <div className="v2-spark-block v2-spark-block-projection">
      <div className="v2-spark-proj-row">
        <ProjStat label="Budget" value={fmtUSD(block.budget)} accent />
        <ProjStat label="Projected reach" value={fmtFollowers(block.reach)} sub="~85% delivery" />
        <ProjStat label="Avg engagement" value={`${block.engagement}%`} sub="weighted across creators" />
        <ProjStat label="Placements" value={String(block.placements)} sub={`across ${creators.length} creator${creators.length === 1 ? '' : 's'}`} />
        <ProjStat label="CPM" value={cpm > 0 ? `$${cpm}` : '—'} sub="cost per 1K" />
      </div>

      {/* Per-creator contribution bar */}
      <div className="v2-spark-proj-stack">
        {creators.map((c) => {
          const contribution = c.channels.reduce((s, ch) => s + ch.followers, 0);
          const pct = block.reach > 0 ? (contribution / (block.reach / 0.85)) * 100 : 0;
          return (
            <div key={c.id} className="v2-spark-proj-bar">
              <div className="v2-spark-proj-bar-label">
                <span>{c.name}</span>
                <span className="v2-tabular v2-muted">{fmtFollowers(contribution)}</span>
              </div>
              <div className="v2-progress" style={{ height: 6 }}>
                <div className="v2-progress-fill" style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ProjStat({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div>
      <div className="v2-stat-label" style={{ fontSize: 10.5 }}>{label}</div>
      <div
        className="v2-stat-value v2-tabular"
        style={{ fontSize: 20, color: accent ? 'var(--v2-accent)' : 'var(--v2-ink)' }}
      >{value}</div>
      {sub && <div className="v2-stat-sub" style={{ fontSize: 11 }}>{sub}</div>}
    </div>
  );
}

// ---------- brief-draft ----------

function BriefDraftBlock({ block, onRoute }: {
  block: Extract<SparkBlock, { kind: 'brief-draft' }>;
  onRoute: (r: string) => void;
}) {
  const creator = getCreator(block.creatorId);
  // Inline editing: keep the draft text in component state so the user
  // can tweak the AI-generated copy before sending. Wired to a real
  // textarea instead of the prior 'coming soon' toast.
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(block.copy);
  if (!creator) return null;
  return (
    <div className="v2-spark-block v2-spark-block-brief">
      <div className="v2-spark-brief-head">
        <div
          className="v2-avatar v2-avatar-md"
          style={{ backgroundImage: `url(${creator.avatar})` }}
          aria-hidden="true"
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="v2-eyebrow" style={{ marginBottom: 2 }}>Brief draft</div>
          <div style={{ fontSize: 14, fontWeight: 600 }}>To: {creator.name}</div>
          <div className="v2-muted" style={{ fontSize: 12 }}>
            From: {block.brand} · Rate: {fmtUSD(block.rate)}
          </div>
        </div>
      </div>
      {editing ? (
        <textarea
          className="v2-spark-brief-body"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={Math.min(20, Math.max(6, draft.split('\n').length))}
          style={{
            width: '100%',
            border: 'none',
            outline: 'none',
            resize: 'vertical',
            padding: 14,
            fontFamily: 'inherit',
            fontSize: 13.5,
            lineHeight: 1.5,
            background: 'var(--v2-paper)',
            color: 'var(--v2-ink)',
            minHeight: 120,
          }}
          aria-label="Brief draft text"
          autoFocus
        />
      ) : (
        <pre className="v2-spark-brief-body">{draft}</pre>
      )}
      <div className="v2-row" style={{ gap: 8, padding: 12, justifyContent: 'flex-end', borderTop: '1px solid var(--v2-line)', background: 'var(--v2-bg-1)' }}>
        {editing ? (
          <>
            <button
              type="button"
              className="v2-btn v2-btn-sm v2-btn-ghost"
              onClick={() => {
                setDraft(block.copy);
                setEditing(false);
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              className="v2-btn v2-btn-sm v2-btn-primary"
              onClick={() => {
                setEditing(false);
                pushToast('Draft updated · ready to send');
              }}
            >
              Save edits
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              className="v2-btn v2-btn-sm v2-btn-outline"
              onClick={() => setEditing(true)}
            >
              Edit copy
            </button>
            <button
              type="button"
              className="v2-btn v2-btn-sm v2-btn-primary"
              onClick={() => onRoute('inbox')}
            >
              {Icon.send} Send through Inbox
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ---------- shortlist-snapshot ----------

function ShortlistSnapshotBlock({ block, onRoute }: {
  block: Extract<SparkBlock, { kind: 'shortlist-snapshot' }>;
  onRoute: (r: string) => void;
}) {
  const creators = block.creatorIds.map((id) => getCreator(id)).filter((x): x is NonNullable<typeof x> => !!x);
  return (
    <div className="v2-spark-block v2-spark-block-snapshot">
      <div className="v2-eyebrow" style={{ marginBottom: 10 }}>
        Shortlist snapshot · {creators.length} creator{creators.length === 1 ? '' : 's'}
      </div>
      <div className="v2-spark-snapshot-stack">
        {creators.map((c) => (
          <button
            key={c.id}
            type="button"
            className="v2-spark-snapshot-row"
            onClick={() => onRoute(`creator:${c.id}`)}
          >
            <div
              className="v2-avatar v2-avatar-sm"
              style={{ backgroundImage: `url(${c.avatar})` }}
              aria-hidden="true"
            />
            <span style={{ fontSize: 13, fontWeight: 600 }}>{c.name}</span>
            <span className="v2-spacer" />
            <span className="v2-tabular v2-muted" style={{ fontSize: 12 }}>
              {fmtUSD(c.rate)}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------- canvas ----------

function CanvasKpi({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <div className="v2-stat-label" style={{ fontSize: 10.5 }}>{label}</div>
      <div
        className="v2-stat-value v2-tabular"
        style={{
          fontSize: 18,
          color: accent ? 'var(--v2-accent)' : 'var(--v2-ink)',
        }}
      >{value}</div>
    </div>
  );
}

// =====================================================================
// Persistence helpers
// =====================================================================

function loadHistory(): SparkMessage[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
    return [];
  } catch { return []; }
}

function loadContext(brandName?: string): SparkContext {
  const base = { ...emptyContext(), brand: brandName ?? emptyContext().brand };
  if (typeof window === 'undefined') return base;
  try {
    const raw = localStorage.getItem(CONTEXT_KEY);
    if (!raw) return base;
    const parsed = JSON.parse(raw);
    return { ...base, ...parsed };
  } catch { return base; }
}
