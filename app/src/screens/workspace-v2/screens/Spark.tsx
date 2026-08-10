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
  emptyContext, getCreator, processInput, setSparkPool, thinkingDelay,
  tryRemoteText, welcomeMessage,
  type SparkBlock, type SparkContext, type SparkMessage,
} from '../sparkEngine';
import {
  useV2AllCampaigns, useV2BrandShortlist, useV2Creators, useV2CurrentBrand,
  v2SyncSparkShortlist, v2SaveSparkDraft, v2DeleteSparkDraft,
} from '../v2Hooks';
import { pushToast } from '@/lib/utils/toast';
import { useStore } from '@/lib/api/store';
import type { SparkDraft } from '@/lib/api/types';

interface Props {
  onRoute: (r: string) => void;
  /** Optional prompt to send automatically on mount — used by the
   *  BrandHome SparkComposer so the prompt the brand typed there
   *  doesn't get lost when they hit Send. Wired via `spark?prompt=`
   *  in the router. Fires once per mount. */
  initialPrompt?: string;
}

const HISTORY_KEY = 'alamut.v2.spark.history';
const CONTEXT_KEY = 'alamut.v2.spark.context';

export function Spark({ onRoute, initialPrompt }: Props) {
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

  // Auto-save (Phase 15.1) — debounce 1500ms after the last
  // history/context change. Skips on initial mount + when the only
  // message is the welcome (no real user input yet) + when the
  // serialised state matches what was last persisted.
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [savedTick, setSavedTick] = useState(0);
  const autoSaveTimerRef = useRef<number | null>(null);
  const mountedRef = useRef(false);
  const lastSavedSignatureRef = useRef<string>('');

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

  // Auto-send the inbound prompt once on mount. The BrandHome composer
  // routes here with `?prompt=<encoded>`; without this effect the brand
  // typed something on Home, clicked Send, and arrived at an empty
  // Spark welcome screen with no recollection of what they wrote.
  const initialPromptHandledRef = useRef(false);
  useEffect(() => {
    if (initialPromptHandledRef.current) return;
    if (!initialPrompt || !initialPrompt.trim()) return;
    initialPromptHandledRef.current = true;
    // Defer one tick so handleSend is fully wired (it references state
    // setters defined just above it).
    setTimeout(() => handleSend(initialPrompt.trim()), 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPrompt]);

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
    // Phase 50 — race the scripted engine against the remote LLM proxy.
    // We always render scripted's reply at `delay`ms (preserves the demo
    // pacing + context-update logic that the scripted handlers do). If
    // the remote returns within that window, we substitute the text
    // body — non-text blocks (creator-cards, brief-draft) stay scripted.
    // Falls back to scripted on 503 / network / no env var.
    const remotePromise = tryRemoteText(trimmed, history, context);
    window.setTimeout(async () => {
      const { reply, newContext } = processInput(trimmed, context);
      const remoteText = await remotePromise;
      const finalReply: SparkMessage = remoteText
        ? {
            ...reply,
            blocks: reply.blocks.map((b) =>
              b.kind === 'text' ? { ...b, body: remoteText } : b,
            ),
          }
        : reply;
      setHistory((h) => [...h, finalReply]);
      setContext(newContext);
      setThinking(false);
    }, delay);
  }

  function handleReset() {
    setHistory([welcomeMessage()]);
    setContext(emptyContext());
    setActiveDraftId(null);
    // Reset the signature so a brand-new session can auto-save once the
    // user types their first message.
    lastSavedSignatureRef.current = '';
    setAutoSaveStatus('idle');
  }

  // Phase 15 — saved drafts state.
  const allDrafts = useStore((s) => s.db.sparkDrafts ?? []);
  const drafts = useMemo<SparkDraft[]>(
    () => brand
      ? [...allDrafts].filter((d) => d.brandId === brand.id)
          .sort((a, b) => +new Date(b.lastEditedAt) - +new Date(a.lastEditedAt))
      : [],
    [allDrafts, brand],
  );
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);

  function autoNameFromHistory(h: SparkMessage[]): string {
    const firstUser = h.find((m) => m.from === 'user');
    if (!firstUser) return 'Untitled draft';
    const text = firstUser.blocks
      .map((b) => (b.kind === 'text' ? b.body : ''))
      .filter(Boolean).join(' ').trim();
    if (!text) return 'Untitled draft';
    const words = text.split(/\s+/).slice(0, 5).join(' ');
    return words.length < text.length ? `${words}…` : words;
  }

  /** Shared save path used by both the manual button and auto-save.
   *  `showToast=true` is the manual surface — it shows the user-visible
   *  confirmation. The auto-save path runs silently and only updates
   *  the inline status pill. Returns the saved draft (or null when
   *  preconditions fail / nothing changed). */
  function runSave(showToast: boolean): SparkDraft | null {
    if (!brand) {
      if (showToast) pushToast('Sign in as a brand to save drafts');
      return null;
    }
    if (history.length < 2 || !history.some((m) => m.from === 'user')) {
      return null;
    }
    const signature = JSON.stringify({ h: history, c: context });
    if (!showToast && signature === lastSavedSignatureRef.current) {
      // No-op auto-save: nothing's changed since the last successful write.
      return null;
    }
    const currentId = activeDraftId;
    const name = currentId
      ? drafts.find((d) => d.id === currentId)?.name ?? autoNameFromHistory(history)
      : autoNameFromHistory(history);
    setAutoSaveStatus('saving');
    const saved = v2SaveSparkDraft({
      brandId: brand.id,
      draftId: currentId ?? undefined,
      name,
      history: history as unknown[],
      context: context as unknown as Record<string, unknown>,
    });
    if (saved) {
      if (!currentId) setActiveDraftId(saved.id);
      lastSavedSignatureRef.current = signature;
      setSavedTick((n) => n + 1);
      setAutoSaveStatus('saved');
      if (showToast) pushToast(`Draft saved · "${name}"`);
    } else {
      setAutoSaveStatus('idle');
      if (showToast) pushToast('Could not save draft');
    }
    return saved;
  }

  function handleSaveDraft() {
    // Cancel any pending auto-save — the explicit click takes precedence.
    if (autoSaveTimerRef.current !== null) {
      window.clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }
    runSave(true);
  }

  // Debounced auto-save. The same dep set as the localStorage persistence
  // effect — every history/context mutation reschedules a 1500ms timer.
  // Skips the very first render (the mount sets history → welcome) and
  // the welcome-only state (no real user input yet).
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }
    if (!brand) return;
    if (history.length < 2) return;
    if (!history.some((m) => m.from === 'user')) return;
    if (autoSaveTimerRef.current !== null) {
      window.clearTimeout(autoSaveTimerRef.current);
    }
    autoSaveTimerRef.current = window.setTimeout(() => {
      autoSaveTimerRef.current = null;
      runSave(false);
    }, 1500);
    return () => {
      if (autoSaveTimerRef.current !== null) {
        window.clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = null;
      }
    };
  // runSave intentionally excluded — captured at schedule time; including
  // it would re-fire on every render and never let the timer settle.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [history, context, brand?.id]);

  // Auto-revert the "Saved · just now" pill back to idle after 3s.
  useEffect(() => {
    if (autoSaveStatus !== 'saved') return;
    const t = window.setTimeout(() => setAutoSaveStatus('idle'), 3000);
    return () => window.clearTimeout(t);
  }, [autoSaveStatus, savedTick]);

  function handleLoadDraft(draft: SparkDraft) {
    setHistory((draft.history as SparkMessage[]) ?? []);
    setContext((draft.context as unknown as SparkContext) ?? emptyContext());
    setActiveDraftId(draft.id);
    // Seed the signature with the loaded state so the next auto-save
    // schedule doesn't fire a redundant write 1.5s after a load.
    lastSavedSignatureRef.current = JSON.stringify({
      h: (draft.history as SparkMessage[]) ?? [],
      c: (draft.context as unknown as SparkContext) ?? emptyContext(),
    });
    pushToast(`Loaded "${draft.name ?? 'Untitled draft'}"`);
  }

  function handleDeleteDraft(draft: SparkDraft) {
    if (!confirm(`Delete draft "${draft.name ?? 'Untitled draft'}"?`)) return;
    const removed = v2DeleteSparkDraft(draft.id);
    if (removed) {
      if (activeDraftId === draft.id) setActiveDraftId(null);
      pushToast('Draft deleted');
    }
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
            <SparkDraftsDropdown
              drafts={drafts}
              activeDraftId={activeDraftId}
              onLoad={handleLoadDraft}
              onDelete={handleDeleteDraft}
            />
            {autoSaveStatus !== 'idle' && (
              <span
                className="v2-muted"
                aria-live="polite"
                style={{ fontSize: 12, alignSelf: 'center' }}
              >
                {autoSaveStatus === 'saving' ? 'Saving…' : 'Saved · just now'}
              </span>
            )}
            <button
              className="v2-btn v2-btn-outline"
              type="button"
              onClick={handleSaveDraft}
              disabled={!brand || history.length < 2}
              title={!brand ? 'Sign in as brand to save' : history.length < 2 ? 'Start a conversation first' : activeDraftId ? 'Update saved draft' : 'Save current plan'}
            >
              {Icon.check}<span>{activeDraftId ? 'Update draft' : 'Save draft'}</span>
            </button>
            <button className="v2-btn v2-btn-outline" type="button" onClick={handleReset}>
              {Icon.plus}<span>New plan</span>
            </button>
            <button
              className="v2-btn v2-btn-primary"
              type="button"
              disabled={shortlistCreators.length === 0}
              // Pre-fix this discarded everything Spark built up
              // (shortlist, brief draft, projection, category/budget
              // context) and just navigated to /campaigns. Now we
              // serialize the relevant state into the NewCampaignWizard
              // initial-state query string so the brand lands on a
              // pre-seeded wizard ready to launch.
              onClick={() => {
                const latestBrief = [...history].reverse()
                  .flatMap((m) => m.blocks)
                  .find((b): b is Extract<SparkBlock, { kind: 'brief-draft' }> => b.kind === 'brief-draft');
                const name = context.category
                  ? `${context.category} campaign`
                  : latestBrief?.campaignName ?? 'Spark-planned campaign';
                // Default deadline = 30 days out (in a real launch the
                // brand will edit; we just need a non-empty value).
                const deadline = new Date(Date.now() + 30 * 86_400_000)
                  .toISOString().slice(0, 10);
                const params = new URLSearchParams({
                  name,
                  deadline,
                  invited: shortlistCreators.map((c) => c.id).join(','),
                });
                if (context.category) params.set('category', context.category);
                if (context.budget) params.set('budget', String(context.budget));
                if (latestBrief?.copy) params.set('brief', latestBrief.copy.slice(0, 600));
                // Set perCreator if the shortlist gives us a usable signal
                if (shortlistCreators.length > 0 && context.budget) {
                  params.set('perCreator', String(Math.round(context.budget / shortlistCreators.length)));
                }
                onRoute(`campaign-new?${params.toString()}`);
              }}
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
                {c.channels.slice(0, 2).map((ch, i) => {
                  const meta = PLATFORM_META[ch.platform];
                  return (
                    <div key={`${ch.platform}-${i}`} className="v2-row" style={{ gap: 6, fontSize: 11.5 }}>
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
    // Review rating, not a fit score — 'New' when they have no reviews
    // yet rather than a defaulted number (P-10).
    { label: 'Rating', values: creators.map((c) => c.score === null ? 'New' : c.score) },
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

/** Phase 15 — dropdown listing saved Spark drafts. Click → load.
 *  Each row has a × to delete. Empty-state hidden (parent hides the
 *  button when drafts.length === 0). */
function SparkDraftsDropdown({ drafts, activeDraftId, onLoad, onDelete }: {
  drafts: SparkDraft[];
  activeDraftId: string | null;
  onLoad: (d: SparkDraft) => void;
  onDelete: (d: SparkDraft) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  if (drafts.length === 0) return null;
  const active = drafts.find((d) => d.id === activeDraftId);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        className="v2-btn v2-btn-outline"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        title={active ? `Active: ${active.name ?? 'Untitled'}` : 'Open a saved draft'}
      >
        <span>{active ? active.name ?? 'Untitled' : 'Drafts'} · {drafts.length}</span>
        <span aria-hidden="true" style={{
          display: 'inline-block',
          width: 0, height: 0, marginLeft: 4,
          borderLeft: '4px solid transparent',
          borderRight: '4px solid transparent',
          borderTop: '4px solid currentColor',
          transform: open ? 'rotate(180deg)' : 'none',
          transition: 'transform 120ms ease',
        }} />
      </button>
      {open && (
        <div
          role="menu"
          style={{
            position: 'absolute',
            right: 0,
            top: 'calc(100% + 6px)',
            zIndex: 30,
            minWidth: 280,
            maxHeight: 360,
            overflowY: 'auto',
            background: 'var(--v2-paper)',
            border: '1px solid var(--v2-line)',
            borderRadius: 'var(--v2-r-md)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.10)',
            padding: 4,
          }}
        >
          {drafts.map((d) => {
            const isActive = d.id === activeDraftId;
            return (
              <div
                key={d.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 6px',
                  background: isActive ? 'var(--v2-accent-soft)' : 'transparent',
                  borderRadius: 6,
                }}
              >
                <button
                  type="button"
                  onClick={() => { onLoad(d); setOpen(false); }}
                  style={{
                    flex: 1,
                    textAlign: 'left',
                    background: 'transparent',
                    border: 'none',
                    fontFamily: 'inherit',
                    fontSize: 13,
                    padding: '4px 6px',
                    color: isActive ? 'var(--v2-accent)' : 'var(--v2-ink)',
                    fontWeight: isActive ? 600 : 500,
                    cursor: 'pointer',
                    minWidth: 0,
                  }}
                >
                  <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {d.name ?? 'Untitled draft'}
                  </div>
                  <div className="v2-muted" style={{ fontSize: 11, marginTop: 2 }}>
                    {new Date(d.lastEditedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                  </div>
                </button>
                <button
                  type="button"
                  aria-label="Delete draft"
                  onClick={(e) => { e.stopPropagation(); onDelete(d); }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--v2-ink-3)',
                    cursor: 'pointer',
                    padding: '4px 6px',
                    fontSize: 14,
                  }}
                  title="Delete"
                >×</button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
