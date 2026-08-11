// Inbox.tsx — v2 shared 3-pane messaging
//
// Mirrors the Claude Design handoff (Inbox in brand-comms.jsx):
// conversations list (left) · message thread (middle) · collaboration
// side panel (right) showing campaign info, milestones, payment status.
//
// Same component used by both personas — the only difference is which
// avatar is rendered as "you" (the v2-inbox-msg-from-brand variant
// becomes "from-creator" when persona="creator", swapping bubble
// alignment + theme).
//
// §2.5 collapse — the standalone `DealRoom` surface used to live at
// `deal:<convId>` and showed the same collab as one of these
// conversations, but in a different layout. The two drifted. Now the
// `deal:<convId>` route resolves through `Workspace.tsx` to render
// this component with `forceThreadId={convId}` + `forcePanelMode='detailed'`,
// auto-selecting the conversation and promoting the right pane to
// the rich detailed view via `CollabSidePanel`. No separate surface
// to drift against.

import { useEffect, useMemo, useRef, useState } from 'react';
import { fmtUSD, fmtFollowers, Icon, Topbar } from '../lib';
import {
  type V2Conversation,
  type V2Creator,
  type V2Campaign,
} from '../data';
import {
  useV2Conversations, useV2Creators, useV2AllCampaigns,
  v2MarkThreadRead, v2SendMessage,
  v2MuteThread, v2ArchiveThread, v2ReportThread, v2SnoozeThread,
} from '../v2Hooks';
import { deriveCollab, V2_STAGE_META } from '../v2Adapters';
import { useStore } from '@/lib/api/store';
import { pushToast } from '@/lib/utils/toast';
import { CollabSidePanel } from '@/components/inbox/CollabSidePanel';
import { Avatar } from '@/components/ui/Avatar';

interface Props {
  onRoute: (r: string) => void;
  persona: 'brand' | 'creator';
  /** When set (e.g. from `deal:<convId>` routing in Workspace.tsx),
   *  pre-selects the matching conversation on mount instead of the
   *  most recent. */
  forceThreadId?: string;
  /** Side panel density. Defaults to 'compact' (inbox default). The
   *  `deal:<convId>` route entry-point sets this to 'detailed' so the
   *  brief excerpt + per-stage hint expand. */
  forcePanelMode?: 'compact' | 'detailed';
}

export function Inbox({ onRoute, persona, forceThreadId, forcePanelMode }: Props) {
  const conversations = useV2Conversations();
  const creators = useV2Creators();
  const campaigns = useV2AllCampaigns();
  const db = useStore((s) => s.db);
  const [activeId, setActiveId] = useState<string>(forceThreadId ?? conversations[0]?.id ?? '');
  const [draft, setDraft] = useState('');
  // Mobile-only — drives the conversation-list slide-in drawer at <760px.
  const [mobileListOpen, setMobileListOpen] = useState(false);

  // If the conversation list refreshes (e.g. after a tx) keep activeId valid.
  useEffect(() => {
    if (conversations.length === 0) {
      if (activeId !== '') setActiveId('');
      return;
    }
    if (!conversations.find((c) => c.id === activeId)) {
      setActiveId(conversations[0].id);
    }
  }, [conversations, activeId]);

  // Honor `forceThreadId` whenever it changes (e.g., the user clicks a
  // notification linking to `deal:<otherConvId>` while already on inbox).
  // Falls back gracefully if the forced id doesn't resolve.
  useEffect(() => {
    if (forceThreadId && conversations.some((c) => c.id === forceThreadId)) {
      setActiveId(forceThreadId);
    }
  }, [forceThreadId, conversations]);

  // Mark active thread as read on selection.
  useEffect(() => {
    if (activeId) v2MarkThreadRead(activeId);
  }, [activeId]);

  // Filter: 'all' (hides archived) / 'unread' (subset of all) /
  // 'archived' (the inverse — only shows archived). Archived threads
  // bounce back to 'all' when the other party messages (v2SendMessage
  // un-archives for non-sender participants).
  const [filter, setFilter] = useState<'all' | 'unread' | 'archived'>('all');
  const sessionUid = useStore((s) => s.session?.userId) ?? null;
  const filteredConversations = useMemo(() => {
    if (filter === 'archived') return conversations.filter((c) => c.isArchivedForViewer);
    const visible = conversations.filter((c) => !c.isArchivedForViewer);
    // Phase 58 — hide snoozed threads from the default + unread views.
    // Snooze is per-viewer; we look up the raw Thread row to read the
    // current viewer's wake-up timestamp. User can re-show via the
    // thread's More menu (Unsnooze).
    const nowMs = Date.now();
    const notSnoozed = sessionUid
      ? visible.filter((c) => {
          const t = db.threads.find((x) => x.id === c.id);
          const wake = t?.snoozedFor?.[sessionUid] ?? 0;
          return wake <= nowMs;
        })
      : visible;
    if (filter === 'unread') return notSnoozed.filter((c) => c.unread > 0);
    return notSnoozed;
  }, [conversations, filter, db.threads, sessionUid]);

  const active = filteredConversations.find((c) => c.id === activeId) ?? filteredConversations[0] ?? conversations[0];

  // Counterparty resolution depends on viewer persona:
  //   - brand viewer  → counterparty is the creator (active.creatorId)
  //   - creator viewer → counterparty is the brand (active.brandId);
  //                       we synthesize a V2Creator-shaped object from
  //                       the brand so downstream components (Thread,
  //                       ConversationList, CollabSidePanel) keep
  //                       working without a parallel V2Brand type.
  const counterparty = useMemo<V2Creator | undefined>(
    () => {
      if (!active) return undefined;
      if (persona === 'brand') {
        return creators.find((c) => c.id === active.creatorId);
      }
      // creator persona — find the brand on the other side.
      const brand = db.brands.find((b) => b.id === active.brandId);
      if (!brand) return undefined;
      // Synthesize a V2Creator-shaped object. Only fields that the
      // inbox UI actually reads are populated meaningfully; the rest
      // get neutral defaults.
      return {
        id: brand.id,
        handle: '@' + brand.name.toLowerCase().replace(/\s+/g, ''),
        name: brand.name,
        tagline: brand.industry,
        avatar: brand.logoUrl ?? brand.logoMark ?? '',
        cover: '',
        city: brand.hq,
        country: '',
        bio: brand.about,
        categories: brand.preferredCategories ?? [],
        score: 0,
        priceTier: '$$',
        priceMin: 0,
        priceMax: 0,
        verified: brand.verified,
        channels: [],
        audience: { female: 0, male: 0, age2534: 0, topCity: brand.hq },
        rate: 0,
        pastBrands: [],
      } as V2Creator;
    },
    [creators, active, persona, db.brands],
  );
  const campaign = useMemo<V2Campaign | undefined>(
    () => campaigns.find((c) => c.id === active?.campaignId),
    [campaigns, active],
  );
  // Resolve the collab once — both the thread context band and the
  // side panel read the same value, so they cannot disagree on stage.
  const collab = useMemo(
    () => (active?.campaignId && counterparty ? deriveCollab(active.campaignId, counterparty.id, db) : null),
    [active, counterparty, db],
  );
  const panelMode: 'compact' | 'detailed' = forcePanelMode ?? 'compact';

  const totalUnread = conversations.reduce((s, c) => s + c.unread, 0);

  // Pending attachments — accumulate as the user picks files, ship them
  // with the next send. Each entry carries the resolved MessageAttachment
  // (post-upload) so the message goes through with both text + files.
  const [pendingAttachments, setPendingAttachments] = useState<
    import('@/lib/api/types').MessageAttachment[]
  >([]);
  const [attachUploading, setAttachUploading] = useState(false);

  async function handleAttachFiles(files: FileList | null) {
    if (!files || files.length === 0 || !active) return;
    setAttachUploading(true);
    try {
      const { uploadMessageAttachment } = await import('@/lib/data/messagesRepo');
      const uploaded: import('@/lib/api/types').MessageAttachment[] = [];
      for (const file of Array.from(files)) {
        // Cap at 8 attachments per message to match common chat limits.
        if (pendingAttachments.length + uploaded.length >= 8) break;
        const att = await uploadMessageAttachment(active.id, file);
        uploaded.push(att);
      }
      setPendingAttachments((curr) => [...curr, ...uploaded]);
      pushToast(`${uploaded.length} file${uploaded.length === 1 ? '' : 's'} attached`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      pushToast(`Attachment failed · ${msg.slice(0, 60)}`);
    } finally {
      setAttachUploading(false);
    }
  }

  function handleSend() {
    if (!active) return;
    if (!draft.trim() && pendingAttachments.length === 0) return;
    v2SendMessage(active.id, draft, pendingAttachments.length > 0 ? pendingAttachments : undefined);
    setDraft('');
    setPendingAttachments([]);
  }

  return (
    <>
      <Topbar
        title="Inbox"
        crumb={`${conversations.length} conversations · ${totalUnread} unread`}
        actions={
          <select
            className="v2-select"
            value={filter}
            onChange={(e) => setFilter(e.target.value as 'all' | 'unread' | 'archived')}
            aria-label="Filter conversations"
            style={{
              fontFamily: 'inherit', fontSize: 13,
              padding: '6px 12px', borderRadius: 'var(--v2-r-pill)',
              border: `1px solid ${filter === 'all' ? 'var(--v2-line)' : 'var(--v2-accent)'}`,
              background: filter === 'all' ? 'var(--v2-paper)' : 'var(--v2-accent-soft)',
              color: filter === 'all' ? 'var(--v2-ink-2)' : 'var(--v2-accent)',
              fontWeight: filter === 'all' ? 500 : 600,
            }}
          >
            <option value="all">All conversations</option>
            <option value="unread">Unread only</option>
            <option value="archived">Archived</option>
          </select>
        }
      />
      {/* Mobile-only floating toggle to open the conversation list.
          Pre-fix the list was `display: none` at <760px, leaving the
          creator stuck on the current thread with no way to pick a
          different one. CSS hides this on desktop. */}
      <button
        type="button"
        className="v2-inbox-mobile-toggle"
        aria-label={mobileListOpen ? 'Close conversations' : 'Open conversations'}
        aria-expanded={mobileListOpen}
        onClick={() => setMobileListOpen((v) => !v)}
      >
        {mobileListOpen ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        )}
      </button>
      {mobileListOpen && (
        <div
          className="v2-inbox-mobile-backdrop"
          aria-hidden="true"
          onClick={() => setMobileListOpen(false)}
        />
      )}
      <div className="v2-inbox">
        <ConversationList
          conversations={filteredConversations}
          activeId={activeId}
          onSelect={(id) => { setActiveId(id); setMobileListOpen(false); }}
          creators={creators}
          campaigns={campaigns}
          persona={persona}
          brands={db.brands}
          mobileOpen={mobileListOpen}
        />
        {active && counterparty ? (
          <Thread
            conversation={active}
            counterparty={counterparty}
            persona={persona}
            draft={draft}
            setDraft={setDraft}
            onRoute={onRoute}
            onSend={handleSend}
            pendingAttachments={pendingAttachments}
            onPickFiles={handleAttachFiles}
            onRemoveAttachment={(idx) =>
              setPendingAttachments((curr) => curr.filter((_, i) => i !== idx))
            }
            attachUploading={attachUploading}
            panelMode={panelMode}
          />
        ) : (
          <div className="v2-inbox-empty v2-inbox-thread">
            {/* P-9 — with an empty list this used to say "Pick a conversation
                on the left", instructing an action the user can't take
                because there's nothing there. Distinguish "nothing yet" from
                "nothing selected". */}
            {conversations.length === 0 ? (
              <>
                <div className="v2-eyebrow">No messages yet</div>
                <p className="v2-muted">
                  When you apply to a brief or a brand reaches out, the conversation
                  shows up here.
                </p>
              </>
            ) : (
              <>
                <div className="v2-eyebrow">No conversation selected</div>
                <p className="v2-muted">Pick a conversation on the left to view the thread.</p>
              </>
            )}
          </div>
        )}
        {active && campaign && counterparty && (
          <CollabSidePanel
            campaign={campaign}
            counterparty={counterparty}
            collab={collab}
            persona={persona}
            mode={panelMode}
            onRoute={onRoute}
          />
        )}
      </div>
    </>
  );
}

// =====================================================================
// Conversation list (left pane)
// =====================================================================
function ConversationList({
  conversations, activeId, onSelect, creators, campaigns, persona, brands, mobileOpen,
}: {
  conversations: V2Conversation[];
  activeId: string;
  onSelect: (id: string) => void;
  creators: V2Creator[];
  campaigns: V2Campaign[];
  persona: 'brand' | 'creator';
  brands: import('@/lib/api/types').Brand[];
  /** Mobile drawer state — applies `is-mobile-open` class at <760px
   *  so the off-canvas list slides into view. CSS hides this prop's
   *  effect on desktop. */
  mobileOpen?: boolean;
}) {
  // Pre-fix the search input was decorative; we wired it to filter by
  // counterparty/campaign. Phase 58 extends it to ALSO scan message
  // body text so the user can find a quote inside any thread — closes
  // the "I can see we discussed it but can't find the message" gap.
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const db = useStore((s) => s.db);
  // Build a per-thread "messages contain query?" map once per query.
  // Avoids scanning all messages × all conversations on each render.
  const threadsMatchingBody = useMemo(() => {
    if (!q) return new Set<string>();
    const set = new Set<string>();
    for (const m of db.messages) {
      if (!set.has(m.threadId) && m.text.toLowerCase().includes(q)) {
        set.add(m.threadId);
      }
    }
    return set;
  }, [db.messages, q]);
  const visible = !q ? conversations : conversations.filter((c) => {
    const campaign = campaigns.find((cmp) => cmp.id === c.campaignId);
    const counterpartyName = persona === 'brand'
      ? (creators.find((cr) => cr.id === c.creatorId)?.name ?? '')
      : (brands.find((b) => b.id === c.brandId)?.name ?? '');
    const counterpartyHandle = persona === 'brand'
      ? (creators.find((cr) => cr.id === c.creatorId)?.handle ?? '')
      : '';
    const campaignName = campaign?.name ?? '';
    return (
      counterpartyName.toLowerCase().includes(q) ||
      counterpartyHandle.toLowerCase().includes(q) ||
      campaignName.toLowerCase().includes(q) ||
      threadsMatchingBody.has(c.id)
    );
  });

  return (
    <aside
      className={['v2-inbox-list', mobileOpen ? 'is-mobile-open' : ''].filter(Boolean).join(' ')}
      aria-label="Conversations"
    >
      <header className="v2-inbox-list-head">
        <h3 style={{
          margin: 0,
          fontFamily: 'var(--v2-font-display)',
          fontSize: 18,
          fontWeight: 500,
          letterSpacing: '-0.014em',
          color: 'var(--v2-ink)',
        }}>Messages</h3>
        <div className="v2-input-search v2-inbox-list-search">
          {Icon.search}
          <input
            placeholder="Search by name or campaign…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search conversations"
          />
        </div>
      </header>
      {visible.length === 0 && q && (
        <p className="v2-muted" style={{ padding: '14px 16px', fontSize: 13, margin: 0 }}>
          No conversations match "{query.trim()}".
        </p>
      )}
      <div role="list">
        {visible.map((c) => {
          // Row label is the COUNTERPARTY, not "always the creator". For
          // a brand viewer the counterparty is the creator on the thread;
          // for a creator viewer the counterparty is the brand. Without
          // this, Sarah (creator) saw "Sarah" as the row title on every
          // thread because every thread has her as the creator participant.
          const campaign = campaigns.find((cmp) => cmp.id === c.campaignId);
          let cpName: string;
          let cpAvatar: string;
          if (persona === 'brand') {
            const creator = creators.find((cr) => cr.id === c.creatorId);
            if (!creator) return null;
            cpName = creator.name;
            cpAvatar = creator.avatar;
          } else {
            const brand = brands.find((b) => b.id === c.brandId);
            if (!brand) return null;
            cpName = brand.name;
            cpAvatar = brand.logoUrl ?? brand.logoMark ?? '';
          }
          return (
            <button
              key={c.id}
              type="button"
              role="listitem"
              className={`v2-inbox-row ${c.id === activeId ? 'is-active' : ''}`}
              onClick={() => onSelect(c.id)}
            >
              {/* P65 — Avatar handles both image (creator.portrait /
                  brand.logoUrl) and initial-fallback. Pre-fix the inbox
                  set `backgroundImage: url(${brand.logoMark})` which is
                  invalid CSS (a bare letter isn't a URL), so any brand
                  without an uploaded logoUrl rendered an empty circle. */}
              <Avatar src={cpAvatar} name={cpName} size={40} />
              <div style={{ minWidth: 0 }}>
                <div className="v2-inbox-row-name">{cpName}</div>
                <div className="v2-inbox-row-preview">{c.preview}</div>
                {campaign && (
                  <div className="v2-muted" style={{ fontSize: 11, marginTop: 4 }}>
                    {campaign.brand} · {campaign.name}
                  </div>
                )}
              </div>
              <div className="v2-inbox-row-meta">
                <span className="v2-inbox-row-time">{c.lastAt}</span>
                {c.isMutedForViewer && (
                  <span
                    title="Muted"
                    aria-label="Muted"
                    style={{
                      fontSize: 11,
                      color: 'var(--v2-ink-3)',
                      lineHeight: 1,
                    }}
                  >
                    🔕
                  </span>
                )}
                {c.unread > 0 && <span className="v2-inbox-unread">{c.unread}</span>}
              </div>
            </button>
          );
        })}
      </div>
    </aside>
  );
}

// =====================================================================
// Message thread (middle pane)
// =====================================================================
function Thread({
  conversation, counterparty, persona, draft, setDraft, onRoute, onSend,
  pendingAttachments, onPickFiles, onRemoveAttachment, attachUploading, panelMode,
}: {
  conversation: V2Conversation;
  counterparty: V2Creator;
  persona: 'brand' | 'creator';
  draft: string;
  setDraft: (v: string) => void;
  onRoute: (r: string) => void;
  onSend: () => void;
  pendingAttachments: import('@/lib/api/types').MessageAttachment[];
  onPickFiles: (files: FileList | null) => void;
  onRemoveAttachment: (idx: number) => void;
  attachUploading: boolean;
  /** When 'detailed' the right pane is already expanded — the
   *  "Detail view" button hides itself to avoid being a no-op. */
  panelMode: 'compact' | 'detailed';
}) {
  // Ref the hidden file input so the visible button can dispatch a click.
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  // Bubble alignment: when you (the viewer) are the brand, "brand" messages
  // are yours (right-aligned dark); when you're the creator, "creator"
  // messages are yours (right-aligned dark) and "brand" messages are
  // counterparty (left-aligned light).
  const youAreFrom = persona === 'brand' ? 'brand' : 'creator';

  // Resolve the collab for this conversation so we can show stage context
  const db = useStore((s) => s.db);
  const collab = conversation.campaignId
    ? deriveCollab(conversation.campaignId, counterparty.id, db)
    : null;
  // V2_STAGE_META covers every stage by construction; the old
  // V2_PIPELINE_STAGES.find() returned undefined for terminal stages, so a
  // cancelled collab's thread lost its stage pill.
  const stageMeta = collab ? V2_STAGE_META[collab.stage] : null;

  // Phase 11 — More menu state + viewer-aware mute/archive flags.
  const [moreOpen, setMoreOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!moreOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (!moreRef.current?.contains(e.target as Node)) setMoreOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [moreOpen]);
  // Read viewer's flags off the raw thread (V2Conversation doesn't carry these).
  const rawThread = db.threads.find((t) => t.id === conversation.id);
  const viewerUserId = (() => {
    // Same resolution path the outer Inbox uses; duplicated to keep
    // this component self-contained.
    const me = db.users.find((u) =>
      persona === 'brand' ? u.brandId : u.creatorId,
    );
    return me?.id ?? '';
  })();
  const isMuted = (rawThread?.mutedFor ?? []).includes(viewerUserId);
  const isArchived = (rawThread?.archivedFor ?? []).includes(viewerUserId);
  const snoozeUntil = rawThread?.snoozedFor?.[viewerUserId] ?? 0;
  const isSnoozed = snoozeUntil > Date.now();

  return (
    <section className="v2-inbox-thread" aria-label="Message thread">
      {reportOpen && (
        <ReportThreadModal
          onClose={() => setReportOpen(false)}
          onSubmit={(reason) => {
            const ok = v2ReportThread(conversation.id, reason);
            if (ok) {
              pushToast('Reported — admin will review');
              setReportOpen(false);
            } else {
              pushToast('Add a short reason and try again');
            }
          }}
        />
      )}
      <header className="v2-inbox-thread-head">
        <div
          className="v2-avatar v2-avatar-md"
          style={{ backgroundImage: `url(${counterparty.avatar})` }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="v2-inbox-thread-head-name">{counterparty.name}</div>
          <div className="v2-inbox-thread-head-sub">
            @{counterparty.handle} · {fmtFollowers(counterparty.channels.reduce((s, ch) => s + ch.followers, 0))} reach
          </div>
        </div>
        {persona === 'brand' ? (
          <button
            className="v2-btn v2-btn-outline v2-btn-sm"
            type="button"
            onClick={() => onRoute(`creator:${counterparty.id}`)}
          >
            View profile
          </button>
        ) : conversation.campaignId ? (
          // Creator viewer — no brand-profile surface exists in v2, so
          // route to the brief where brand context is displayed instead.
          // (Synthesized `counterparty.id` here is a brand id; routing
          // `creator:<brandId>` would 404.)
          <button
            className="v2-btn v2-btn-outline v2-btn-sm"
            type="button"
            onClick={() => onRoute(`brief:${conversation.campaignId}`)}
          >
            View brief
          </button>
        ) : null}
        {/* Pre-fix this said "Open deal room" and clicking from inside
            the inbox routed to `deal:<convId>` — which Workspace.tsx
            resolved straight back to the SAME Inbox with the detail
            panel expanded. The label promised navigation; the behavior
            was just expand-the-right-pane. Now hidden when the panel
            is already detailed (so the button is never a no-op) and
            relabeled to match its actual effect. */}
        {panelMode !== 'detailed' && (
          <button
            className="v2-btn v2-btn-primary v2-btn-sm"
            type="button"
            onClick={() => onRoute(`deal:${conversation.id}`)}
          >
            Detail view
          </button>
        )}
        <div ref={moreRef} style={{ position: 'relative' }}>
          <button
            className="v2-icon-btn"
            type="button"
            aria-label="More options"
            aria-haspopup="menu"
            aria-expanded={moreOpen}
            onClick={() => setMoreOpen((v) => !v)}
          >
            {Icon.more}
          </button>
          {moreOpen && (
            <div
              role="menu"
              style={{
                position: 'absolute',
                right: 0,
                top: 'calc(100% + 6px)',
                zIndex: 30,
                minWidth: 180,
                background: 'var(--v2-paper)',
                border: '1px solid var(--v2-line)',
                borderRadius: 'var(--v2-r-md)',
                boxShadow: '0 8px 24px rgba(0,0,0,0.10)',
                padding: 4,
              }}
            >
              <MoreMenuItem
                label={isMuted ? 'Unmute conversation' : 'Mute conversation'}
                onClick={() => {
                  v2MuteThread(conversation.id);
                  pushToast(isMuted ? 'Conversation unmuted' : 'Conversation muted');
                  setMoreOpen(false);
                }}
              />
              <MoreMenuItem
                label={isArchived ? 'Unarchive' : 'Archive'}
                onClick={() => {
                  v2ArchiveThread(conversation.id);
                  pushToast(isArchived ? 'Conversation restored' : 'Conversation archived');
                  setMoreOpen(false);
                }}
              />
              {/* Phase 58 — snooze for N hours. Persists per-user on
                  thread.snoozedFor. Default inbox filter hides snoozed
                  threads until the wake-up time passes. New messages
                  from the counterparty would clear the snooze on the
                  recipient's side (real-time-side patch — for now,
                  manually unsnoozing brings it back). */}
              <MoreMenuItem
                label="Snooze · 1 hour"
                onClick={() => {
                  v2SnoozeThread(conversation.id, 60 * 60 * 1000);
                  pushToast('Snoozed for 1 hour');
                  setMoreOpen(false);
                }}
              />
              <MoreMenuItem
                label="Snooze · until tomorrow"
                onClick={() => {
                  // Next 9am local time.
                  const t = new Date();
                  t.setDate(t.getDate() + 1);
                  t.setHours(9, 0, 0, 0);
                  v2SnoozeThread(conversation.id, t.getTime() - Date.now());
                  pushToast('Snoozed until tomorrow 9am');
                  setMoreOpen(false);
                }}
              />
              {isSnoozed && (
                <MoreMenuItem
                  label="Unsnooze"
                  onClick={() => {
                    v2SnoozeThread(conversation.id, 0);
                    pushToast('Snooze cleared');
                    setMoreOpen(false);
                  }}
                />
              )}
              <hr style={{ border: 0, borderTop: '1px solid var(--v2-line)', margin: '4px 0' }} />
              <MoreMenuItem
                label="Report conversation…"
                danger
                onClick={() => {
                  setMoreOpen(false);
                  setReportOpen(true);
                }}
              />
            </div>
          )}
        </div>
      </header>

      {/* Workflow context band — shows the current collab stage so you
          can see at a glance what the deal is doing right now. */}
      {collab && stageMeta && (
        <div className="v2-inbox-context-band">
          <div className="v2-row" style={{ gap: 10, alignItems: 'center', minWidth: 0, flex: 1 }}>
            <span
              className="v2-kanban-dot"
              style={{ background: stageMeta.color, width: 10, height: 10, borderRadius: 50 }}
            />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--v2-ink-3)' }}>
                Stage · {stageMeta.label}
              </div>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--v2-ink-2)' }}>
                {contextHint(collab.stage, persona)}
                {collab.price > 0 && (
                  <span className="v2-muted" style={{ marginLeft: 8 }}>
                    · {fmtUSD(collab.price)}
                  </span>
                )}
              </div>
            </div>
          </div>
          <button
            className="v2-btn v2-btn-outline v2-btn-sm"
            type="button"
            onClick={() => onRoute(persona === 'brand'
              ? `campaign:${conversation.campaignId}`
              : `collab:${collab.id}`)}
          >
            {persona === 'brand' ? 'Open campaign' : 'Open collab'} {Icon.arrow}
          </button>
        </div>
      )}

      <div className="v2-inbox-msgs">
        {conversation.messages.map((m, i) => {
          const isYou = m.from === youAreFrom;
          return (
            <div
              key={i}
              className={`v2-inbox-msg ${isYou ? 'v2-inbox-msg-from-brand' : 'v2-inbox-msg-from-creator'}`}
            >
              {m.text && <div>{m.text}</div>}
              {m.attachments && m.attachments.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: m.text ? 6 : 0 }}>
                  {m.attachments.map((att, ai) => (
                    <a
                      key={ai}
                      href={att.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '5px 8px',
                        fontSize: 12,
                        borderRadius: 6,
                        background: 'rgba(0,0,0,0.06)',
                        color: 'inherit',
                        textDecoration: 'none',
                        maxWidth: 240,
                      }}
                      title={att.name}
                    >
                      📎 <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{att.name}</span>
                    </a>
                  ))}
                </div>
              )}
              <div className="v2-inbox-msg-time">{m.time}</div>
            </div>
          );
        })}
      </div>

      {/* Pending attachments preview — shows above the composer between
          file pick and send. Each chip has its own × to remove. */}
      {pendingAttachments.length > 0 && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 6,
            padding: '8px 14px 0',
            borderTop: '1px solid var(--v2-line)',
          }}
        >
          {pendingAttachments.map((att, idx) => (
            <span
              key={idx}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 6px 4px 10px',
                fontSize: 12,
                background: 'var(--v2-accent-soft)',
                color: 'var(--v2-accent)',
                borderRadius: 999,
                maxWidth: 220,
              }}
            >
              📎 <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{att.name}</span>
              <button
                type="button"
                aria-label={`Remove ${att.name}`}
                onClick={() => onRemoveAttachment(idx)}
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--v2-accent)',
                  cursor: 'pointer',
                  padding: 0,
                  width: 18,
                  height: 18,
                  fontSize: 13,
                  lineHeight: 1,
                }}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="v2-inbox-composer">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          style={{ display: 'none' }}
          onChange={(e) => {
            onPickFiles(e.target.files);
            // Reset so the same file can be re-picked if removed.
            e.target.value = '';
          }}
          aria-hidden="true"
        />
        <button
          className="v2-icon-btn"
          type="button"
          aria-label="Attach file"
          onClick={() => fileInputRef.current?.click()}
          disabled={attachUploading}
          title={attachUploading ? 'Uploading…' : 'Attach file'}
        >
          {attachUploading ? '…' : '📎'}
        </button>
        <textarea
          placeholder={`Message ${counterparty.name.split(' ')[0]}…`}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              onSend();
            }
          }}
          rows={1}
        />
        <button
          className="v2-btn v2-btn-primary"
          type="button"
          disabled={!draft.trim() && pendingAttachments.length === 0}
          onClick={onSend}
        >
          {Icon.send}<span>Send</span>
        </button>
      </div>
    </section>
  );
}

// === Side panel + Row removed on §2.5 collapse ===
// The inline `SidePanel` and `Row` helpers used to live here.
// Both are now in `@/components/inbox/CollabSidePanel.tsx` so the
// `deal:<convId>` entry-point and the inbox default render render
// the SAME component. Drift is structurally impossible.

/** One-line hint for the inbox context band, by stage × persona. */
function contextHint(stage: string, persona: 'brand' | 'creator'): string {
  if (persona === 'brand') {
    if (stage === 'pitched')      return 'Awaiting your decision · review pitch';
    if (stage === 'invited')      return 'Awaiting creator response';
    if (stage === 'negotiating')  return 'Offer on the table';
    if (stage === 'confirmed')    return 'Awaiting upload';
    if (stage === 'submitted')    return 'Review the draft';
    if (stage === 'approved')     return 'Mark live when posted';
    if (stage === 'live')         return 'Live · tracking';
    if (stage === 'paid')         return 'Closed · paid out';
  } else {
    if (stage === 'pitched')      return 'Awaiting brand response';
    // `invited` covers two sub-cases: brand sent an offer-bearing invite
    // (creator can accept/counter), and brand sent a cold invite with no
    // rate yet (creator can only message back). Both paths route through
    // CollabDetail where the banner picks the right CTAs — the hint stays
    // generic to fit both.
    if (stage === 'invited')      return 'Brand invited you · respond';
    if (stage === 'negotiating')  return 'Offer received · accept or counter';
    if (stage === 'confirmed')    return 'Time to upload your draft';
    if (stage === 'submitted')    return 'Awaiting brand review';
    if (stage === 'approved')     return 'Approved · awaiting publishing';
    if (stage === 'live')         return 'Live · funds released soon';
    if (stage === 'paid')         return 'Paid · all done';
  }
  return '';
}

/** Small modal for reporting a thread. The viewer types a short reason;
 *  v2ReportThread stamps reportedAt/by/reason on the thread + pushes a
 *  notification to every admin so it shows up in the admin queue. */
function ReportThreadModal({ onClose, onSubmit }: {
  onClose: () => void;
  onSubmit: (reason: string) => void;
}) {
  const [reason, setReason] = useState('');
  const valid = reason.trim().length >= 6;
  return (
    <div
      className="v2-modal-overlay"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="v2-card v2-card-pad-lg v2-modal"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 460 }}
      >
        <h2 style={{
          fontFamily: 'var(--v2-font-display)', fontSize: 22, fontWeight: 500,
          margin: '0 0 6px', letterSpacing: '-0.02em',
        }}>Report this conversation</h2>
        <p className="v2-muted" style={{ margin: '0 0 14px', fontSize: 13 }}>
          Send a short note to the moderation team. They'll review the thread
          and decide if action is needed.
        </p>
        <label className="v2-eyebrow" style={{ display: 'block', marginBottom: 6 }}>Reason</label>
        <textarea
          className="v2-input"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="What's going wrong here? (≥6 characters)"
          rows={4}
          style={{ width: '100%', fontFamily: 'inherit', fontSize: 13.5, padding: 10, marginBottom: 14 }}
        />
        <div className="v2-row" style={{ justifyContent: 'flex-end', gap: 8 }}>
          <button className="v2-btn v2-btn-ghost" type="button" onClick={onClose}>Cancel</button>
          <button
            className="v2-btn v2-btn-primary"
            type="button"
            disabled={!valid}
            onClick={() => onSubmit(reason.trim())}
          >
            Send report
          </button>
        </div>
      </div>
    </div>
  );
}

/** Single-line dropdown menu item used by the thread More menu. */
function MoreMenuItem({ label, onClick, danger }: {
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      style={{
        display: 'block',
        width: '100%',
        textAlign: 'left',
        padding: '8px 10px',
        background: 'transparent',
        border: 'none',
        borderRadius: 6,
        color: danger ? 'var(--v2-accent)' : 'var(--v2-ink)',
        fontSize: 13,
        fontWeight: 500,
        cursor: 'pointer',
        fontFamily: 'inherit',
      }}
      onMouseEnter={(e) => e.currentTarget.style.background = 'var(--v2-bg-1)'}
      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
    >
      {label}
    </button>
  );
}
