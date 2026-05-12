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

import { useEffect, useMemo, useState } from 'react';
import { fmtUSD, fmtFollowers, Icon, Topbar } from '../lib';
import {
  type V2Conversation,
  type V2Creator,
  type V2Campaign,
} from '../data';
import {
  useV2Conversations, useV2Creators, useV2AllCampaigns,
  v2MarkThreadRead, v2SendMessage,
} from '../v2Hooks';
import { deriveCollab, V2_PIPELINE_STAGES } from '../v2Adapters';
import { useStore } from '@/lib/api/store';
import { pushToast } from '@/lib/utils/toast';
import { CollabSidePanel } from '@/components/inbox/CollabSidePanel';

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

  const active = conversations.find((c) => c.id === activeId) ?? conversations[0];

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

  function handleSend() {
    if (!draft.trim() || !active) return;
    v2SendMessage(active.id, draft);
    setDraft('');
  }

  return (
    <>
      <Topbar
        title="Inbox"
        crumb={`${conversations.length} conversations · ${totalUnread} unread`}
        actions={
          <button className="v2-btn v2-btn-outline" type="button">
            {Icon.filter} Filter
          </button>
        }
      />
      <div className="v2-inbox">
        <ConversationList
          conversations={conversations}
          activeId={activeId}
          onSelect={setActiveId}
          creators={creators}
          campaigns={campaigns}
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
          />
        ) : (
          <div className="v2-inbox-empty v2-inbox-thread">
            <div className="v2-eyebrow">No conversation selected</div>
            <p className="v2-muted">Pick a conversation on the left to view the thread.</p>
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
  conversations, activeId, onSelect, creators, campaigns,
}: {
  conversations: V2Conversation[];
  activeId: string;
  onSelect: (id: string) => void;
  creators: V2Creator[];
  campaigns: V2Campaign[];
}) {
  return (
    <aside className="v2-inbox-list" aria-label="Conversations">
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
          <input placeholder="Search by name or campaign…" />
        </div>
      </header>
      <div role="list">
        {conversations.map((c) => {
          const creator = creators.find((cr) => cr.id === c.creatorId);
          const campaign = campaigns.find((cmp) => cmp.id === c.campaignId);
          if (!creator) return null;
          return (
            <button
              key={c.id}
              type="button"
              role="listitem"
              className={`v2-inbox-row ${c.id === activeId ? 'is-active' : ''}`}
              onClick={() => onSelect(c.id)}
            >
              <div
                className="v2-avatar v2-avatar-md"
                style={{ backgroundImage: `url(${creator.avatar})` }}
                aria-hidden="true"
              />
              <div style={{ minWidth: 0 }}>
                <div className="v2-inbox-row-name">{creator.name}</div>
                <div className="v2-inbox-row-preview">{c.preview}</div>
                {campaign && (
                  <div className="v2-muted" style={{ fontSize: 11, marginTop: 4 }}>
                    {campaign.brand} · {campaign.name}
                  </div>
                )}
              </div>
              <div className="v2-inbox-row-meta">
                <span className="v2-inbox-row-time">{c.lastAt}</span>
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
}: {
  conversation: V2Conversation;
  counterparty: V2Creator;
  persona: 'brand' | 'creator';
  draft: string;
  setDraft: (v: string) => void;
  onRoute: (r: string) => void;
  onSend: () => void;
}) {
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
  const stageMeta = collab ? V2_PIPELINE_STAGES.find((s) => s.id === collab.stage) : null;

  return (
    <section className="v2-inbox-thread" aria-label="Message thread">
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
        <button
          className="v2-btn v2-btn-outline v2-btn-sm"
          type="button"
          onClick={() => onRoute(`creator:${counterparty.id}`)}
        >
          View profile
        </button>
        <button
          className="v2-btn v2-btn-primary v2-btn-sm"
          type="button"
          onClick={() => onRoute(`deal:${conversation.id}`)}
        >
          Open deal room
        </button>
        <button
          className="v2-icon-btn"
          type="button"
          aria-label="More options"
          onClick={() => pushToast('Mute / archive / report — menu coming soon', 'default')}
        >
          {Icon.more}
        </button>
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
              style={isYou ? {} : { /* counterparty styling already applied */ }}
            >
              <div>{m.text}</div>
              <div className="v2-inbox-msg-time">{m.time}</div>
            </div>
          );
        })}
      </div>

      <div className="v2-inbox-composer">
        <button
          className="v2-icon-btn"
          type="button"
          aria-label="Attach file"
          onClick={() => pushToast('Drag-and-drop attachments coming soon — for now, paste a Drive / Dropbox link', 'default')}
        >
          {Icon.edit}
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
          disabled={!draft.trim()}
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
    if (stage === 'invited')      return 'Brand invited you · accept or counter';
    if (stage === 'negotiating')  return 'Offer received · accept or counter';
    if (stage === 'confirmed')    return 'Time to upload your draft';
    if (stage === 'submitted')    return 'Awaiting brand review';
    if (stage === 'approved')     return 'Approved · awaiting publishing';
    if (stage === 'live')         return 'Live · funds released soon';
    if (stage === 'paid')         return 'Paid · all done';
  }
  return '';
}
