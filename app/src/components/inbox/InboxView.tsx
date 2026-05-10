// Shared two-pane inbox used by both creator and brand workspaces.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '@/lib/api/store';
import { useAuth } from '@/lib/auth/useAuth';
import { api, select } from '@/lib/api/client';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { initials, fmtRelative, fmtDate } from '@/lib/utils/format';
import { useDebouncedValue } from '@/lib/utils/useDebouncedValue';
import { EmptyArt } from '@/components/ui/EmptyArt';
import { pushToast } from '@/lib/utils/toast';
import { summarizeThread } from '@/lib/utils/ai-helpers';
import { useHotkeys, registerHotkeyDocs } from '@/lib/utils/useHotkeys';
import { stageLabel } from '@/lib/utils/labels';

interface InboxViewProps {
  scope: 'creator' | 'brand';
}

const TEMPLATES_BY_SCOPE: Record<'creator' | 'brand', { label: string; text: string }[]> = {
  creator: [
    { label: 'Confirm receipt',     text: 'Got it — reviewing now and will follow up by end of day.' },
    { label: 'Ask for examples',    text: 'Could you share 1-2 references for the visual direction you have in mind? Want to make sure I land on-brand.' },
    { label: 'Push deadline',       text: 'Quick check — would a 48h extension be OK on the next round? Want to give it the time it deserves.' },
    { label: 'Submit for review',   text: 'Round uploaded to Content. Let me know what you think — happy to iterate.' },
    { label: 'Confirm details',     text: 'Confirmed: deliverable, deadline, and rate are all good on my end. Looking forward to it.' },
  ],
  brand: [
    { label: 'Welcome aboard',      text: 'Welcome to the campaign! Brief is in the drawer. Let me know if anything is unclear before you start.' },
    { label: 'Approve draft',       text: 'Looks great — approving now. Escrow will release on post.' },
    { label: 'Request revision',    text: 'Loved most of it — one small note: would you mind tightening the framing on shot 2? Then we ship.' },
    { label: 'Push timing',         text: 'Quick FYI — we\'d like to push the post live to Friday morning to align with our launch window. Workable?' },
    { label: 'Wrap-up + thanks',    text: 'Closing this campaign out — thanks for the great work. Will leave a review shortly. Hope to work together again.' },
  ],
};

export function InboxView({ scope }: InboxViewProps) {
  const { user } = useAuth();
  const db = useStore((s) => s.db);
  const navigate = useNavigate();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [attachments, setAttachments] = useState<{ name: string; url: string }[]>([]);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showAttachPicker, setShowAttachPicker] = useState(false);
  const [busy, setBusy] = useState(false);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);

  const STOCK_ATTACH = [
    { name: 'Mood board.pdf', url: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=400&h=400&fit=crop&auto=format' },
    { name: 'Reference 01.jpg', url: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=400&h=400&fit=crop&auto=format' },
    { name: 'Reference 02.jpg', url: 'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?w=400&h=400&fit=crop&auto=format' },
    { name: 'Brief v2.pdf',   url: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=400&h=400&fit=crop&auto=format' },
    { name: 'Schedule.csv',   url: 'https://images.unsplash.com/photo-1509631179647-0177331693ae?w=400&h=400&fit=crop&auto=format' },
  ];

  const templates = TEMPLATES_BY_SCOPE[scope];

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 220);
  const [filter, setFilter] = useState<'all' | 'unread' | 'campaigns'>('all');

  const allThreads = useMemo(() => {
    if (!user) return [];
    return select.threadsForUser(db, user.id);
  }, [db, user]);

  const unreadCount = useMemo(
    () => user ? allThreads.filter((t) => t.unreadFor.includes(user.id)).length : 0,
    [allThreads, user],
  );
  const campaignCount = useMemo(
    () => allThreads.filter((t) => !!t.campaignId).length,
    [allThreads],
  );

  const threads = useMemo(() => {
    let list = allThreads;
    if (filter === 'unread') list = list.filter((t) => user && t.unreadFor.includes(user.id));
    else if (filter === 'campaigns') list = list.filter((t) => !!t.campaignId);
    if (!debouncedSearch.trim()) return list;
    const q = debouncedSearch.trim().toLowerCase();
    return list.filter((t) => {
      const otherIds = t.participants.filter((p) => p !== user?.id);
      const otherNames = otherIds.map((id) => {
        const u = db.users.find((x) => x.id === id);
        if (u?.creatorId) return db.creators.find((c) => c.id === u.creatorId)?.name || u.email;
        if (u?.brandId)   return db.brands.find((b) => b.id === u.brandId)?.name || u.email;
        return u?.email || '';
      }).join(' ');
      const cmp = t.campaignId ? db.campaigns.find((c) => c.id === t.campaignId) : null;
      const lastMsg = select.messagesInThread(db, t.id).slice(-1)[0]?.text || '';
      return [t.subject, otherNames, cmp?.title || '', lastMsg].join(' ').toLowerCase().includes(q);
    });
  }, [allThreads, debouncedSearch, db, user, filter]);

  // Auto-pick first thread once loaded
  useEffect(() => {
    if (!activeId && threads.length) setActiveId(threads[0].id);
  }, [threads, activeId]);

  // Mark active thread as read
  useEffect(() => {
    if (activeId) api.messages.markRead(activeId);
  }, [activeId]);

  // Phase 20: keyboard navigation for inbox throughput.
  // j/k move active thread, m marks all visible as read, r focuses
  // composer, / focuses search. Disabled while typing in inputs.
  const threadIds = threads.map((t) => t.id);
  useHotkeys({
    j: () => {
      if (threadIds.length === 0) return;
      const i = activeId ? threadIds.indexOf(activeId) : -1;
      const next = threadIds[Math.min(i + 1, threadIds.length - 1)];
      if (next) setActiveId(next);
    },
    k: () => {
      if (threadIds.length === 0) return;
      const i = activeId ? threadIds.indexOf(activeId) : 0;
      const next = threadIds[Math.max(i - 1, 0)];
      if (next) setActiveId(next);
    },
    m: () => {
      if (!user) return;
      const unread = threads.filter((t) => t.unreadFor.includes(user.id));
      if (unread.length === 0) return;
      Promise.all(unread.map((t) => api.messages.markRead(t.id))).then(() => {
        pushToast(`Marked ${unread.length} thread${unread.length === 1 ? '' : 's'} as read`, 'good');
      });
    },
    r: () => composerRef.current?.focus(),
  });
  useEffect(() => registerHotkeyDocs(
    { keys: 'j', label: 'Next thread',         group: 'Inbox' },
    { keys: 'k', label: 'Previous thread',     group: 'Inbox' },
    { keys: 'm', label: 'Mark all as read',    group: 'Inbox' },
    { keys: 'r', label: 'Focus composer',      group: 'Inbox' },
  ), []);

  if (!user) return null;
  const active = threads.find((t) => t.id === activeId);
  const messages = active ? select.messagesInThread(db, active.id) : [];

  const otherUserName = (threadOther?: string) => {
    if (!threadOther) return 'User';
    const u = db.users.find((x) => x.id === threadOther);
    if (!u) return 'User';
    if (u.creatorId) return db.creators.find((c) => c.id === u.creatorId)?.name || u.email;
    if (u.brandId)   return db.brands.find((b) => b.id === u.brandId)?.name || u.email;
    return u.email;
  };

  const otherUserPortrait = (threadOther?: string) => {
    if (!threadOther) return undefined;
    const u = db.users.find((x) => x.id === threadOther);
    if (u?.creatorId) return db.creators.find((c) => c.id === u.creatorId)?.portrait;
    return undefined;
  };

  const send = async () => {
    if (busy) return; // double-send guard
    if (!active || (!draft.trim() && attachments.length === 0)) return;
    setBusy(true);
    try {
      await api.messages.send({
        threadId: active.id,
        text: draft.trim(),
        attachments: attachments.length ? attachments : undefined,
      });
      setDraft('');
      setAttachments([]);
      composerRef.current?.focus();
    } catch (e) {
      pushToast(e instanceof Error ? e.message : 'Send failed', 'bad');
    } finally {
      setBusy(false);
    }
  };

  const onComposeKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Cmd/Ctrl+Enter sends. Plain Enter and Shift+Enter both insert a newline (textarea default)
    // — matches the convention in Slack, ChatGPT, Claude, etc.
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      void send();
    }
  };

  const activeOtherId = active?.participants.find((p) => p !== user.id);
  const activeCmp = active?.campaignId ? db.campaigns.find((c) => c.id === active.campaignId) : undefined;

  // Phase 17 — AI thread TL;DR. Only computed for long threads (8+ messages).
  // Memoized via useMemo would be cleaner but inboxView is small; cheap to recompute.
  const summary = active && messages.length >= 8 ? summarizeThread(active, messages, db, user.id) : null;
  const [tldrCollapsed, setTldrCollapsed] = useState(false);

  return (
    <div className="inbox">
      <div className="inbox-list">
        <div className="inbox-search">
          <div className="search">
            <Icon.search s={14} />
            <input
              placeholder={`Search ${scope === 'creator' ? 'brand' : 'creator'} threads…`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="inbox-filters">
            <button
              className={['inbox-filter-chip', filter === 'all' ? 'is-on' : ''].join(' ')}
              onClick={() => setFilter('all')}
            >All <span className="inbox-filter-count">{allThreads.length}</span></button>
            <button
              className={['inbox-filter-chip', filter === 'unread' ? 'is-on' : ''].join(' ')}
              onClick={() => setFilter('unread')}
              disabled={unreadCount === 0}
            >Unread {unreadCount > 0 && <span className="inbox-filter-count is-accent">{unreadCount}</span>}</button>
            <button
              className={['inbox-filter-chip', filter === 'campaigns' ? 'is-on' : ''].join(' ')}
              onClick={() => setFilter('campaigns')}
            >On a campaign <span className="inbox-filter-count">{campaignCount}</span></button>
          </div>
        </div>
        <div className="inbox-threads">
          {threads.length === 0 ? (
            <div className="empty" style={{ margin: 22 }}>
              <EmptyArt kind="inbox" size={120} />
              <div className="empty-h">
                {filter === 'unread' ? 'Inbox zero' : filter === 'campaigns' ? 'No campaign threads' : 'No conversations yet'}
              </div>
              <div style={{ marginBottom: 14, fontSize: 13 }}>
                {filter === 'unread'
                  ? 'Nothing unread. Take a breather.'
                  : scope === 'creator'
                    ? 'Threads start when a brand sends an offer or you message a brand directly from a campaign.'
                    : 'Threads start when you send an offer or message a creator directly from their profile.'}
              </div>
              {filter !== 'unread' && (
                <Button variant="ghost" size="sm" onClick={() => navigate(scope === 'creator' ? '/creator/discover' : '/brand/discover')} iconRight={<Icon.arrow s={12} />}>
                  {scope === 'creator' ? 'Browse live campaigns' : 'Find creators'}
                </Button>
              )}
            </div>
          ) : (
            threads.map((t) => {
              const other = t.participants.find((p) => p !== user.id);
              const name = otherUserName(other);
              const portrait = otherUserPortrait(other);
              const lastMsg = select.messagesInThread(db, t.id).slice(-1)[0];
              const cmp = t.campaignId ? db.campaigns.find((c) => c.id === t.campaignId) : undefined;
              const isUnread = t.unreadFor.includes(user.id);
              return (
                <button
                  key={t.id}
                  className={['inbox-thread', t.id === activeId ? 'is-on' : '', isUnread ? 'is-unread' : ''].join(' ')}
                  onClick={() => setActiveId(t.id)}
                >
                  <div className="inbox-thread-av">
                    {portrait ? <img src={portrait} alt="" /> : <span>{initials(name)}</span>}
                    {isUnread && <span className="inbox-thread-unread-dot" aria-hidden="true" />}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div className="inbox-thread-row">
                      <span className="inbox-thread-name truncate">{name}</span>
                      <span className="inbox-thread-time">{fmtRelative(t.lastMessageAt)}</span>
                    </div>
                    {cmp && (
                      <div className={['inbox-thread-cmp', `stage-${cmp.stage}`].join(' ')}>
                        <span className="inbox-thread-cmp-dot" />
                        <span className="inbox-thread-cmp-title">{cmp.title}</span>
                      </div>
                    )}
                    <div className="inbox-thread-line">
                      {lastMsg?.attachments?.length ? <span className="inbox-thread-attach">📎 </span> : null}
                      {lastMsg?.fromUserId === user.id ? <span className="inbox-thread-you">You: </span> : null}
                      {lastMsg?.text || t.subject}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      <div className="inbox-pane">
        {!active ? (
          <div className="empty" style={{ margin: 'auto' }}>
            <div className="empty-h">Pick a thread</div>
            <div>Select a conversation from the left to read it.</div>
          </div>
        ) : (
          <>
            <div className="inbox-pane-h">
              <div className="inbox-pane-h-id">
                {(() => {
                  const portrait = otherUserPortrait(activeOtherId);
                  const name = otherUserName(activeOtherId);
                  return portrait
                    ? <img className="inbox-pane-portrait" src={portrait} alt="" />
                    : <div className="inbox-pane-portrait inbox-pane-portrait-fallback">{initials(name)}</div>;
                })()}
                <div>
                  <div className="inbox-pane-title">{otherUserName(activeOtherId)}</div>
                  <div className="inbox-pane-meta">
                    {activeCmp
                      ? <>
                          <span className={['inbox-pane-cmp-dot', `stage-${activeCmp.stage}`].join(' ')} />
                          {activeCmp.title} · {stageLabel(activeCmp.stage)}
                        </>
                      : active.subject}
                  </div>
                </div>
              </div>
              {activeCmp && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate(scope === 'creator' ? `/creator/campaigns/${activeCmp.id}` : `/brand/campaigns/${activeCmp.id}`)}
                  iconRight={<Icon.arrow s={12} />}
                >
                  Open campaign
                </Button>
              )}
            </div>

            {summary && (
              <div className={['inbox-tldr', tldrCollapsed ? 'is-collapsed' : ''].join(' ')}>
                <div className="inbox-tldr-h">
                  <span className="inbox-tldr-icon"><Icon.spark s={12} /></span>
                  <span className="mono-meta">AI summary · {messages.length} messages</span>
                  <button
                    className="inbox-tldr-toggle"
                    onClick={() => setTldrCollapsed((v) => !v)}
                    aria-expanded={!tldrCollapsed}
                    aria-label={tldrCollapsed ? 'Expand summary' : 'Collapse summary'}
                  >{tldrCollapsed ? '▾' : '▴'}</button>
                </div>
                {!tldrCollapsed && (
                  <>
                    <div className="inbox-tldr-summary">{summary.summary}</div>
                    <div className="inbox-tldr-highlights">
                      {summary.highlights.map((h, i) => (
                        <span key={i} className="inbox-tldr-chip">
                          <span className="inbox-tldr-chip-k">{h.label}</span>
                          <span className="inbox-tldr-chip-v">{h.value}</span>
                        </span>
                      ))}
                    </div>
                    {summary.nextAction && (
                      <div className="inbox-tldr-next">
                        <span className="mono-meta">Next:</span> {summary.nextAction}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            <div className="inbox-body">
              {messages.length === 0 ? (
                <div className="text-ink-60" style={{ textAlign: 'center', padding: 32 }}>No messages yet — say hello.</div>
              ) : (
                messages.map((m) => (
                  <div key={m.id} className={['bubble', m.fromUserId === user.id ? 'from-me' : ''].join(' ')}>
                    {m.text && <div>{m.text}</div>}
                    {m.attachments && m.attachments.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: m.text ? 8 : 0 }}>
                        {m.attachments.map((a, i) => (
                          <a key={i} href={a.url} target="_blank" rel="noreferrer" style={{
                            display: 'flex', alignItems: 'center', gap: 8,
                            padding: '6px 10px',
                            background: m.fromUserId === user.id ? 'color-mix(in oklab, var(--paper) 18%, transparent)' : 'var(--paper-2)',
                            borderRadius: 4, fontSize: 12, textDecoration: 'none',
                            color: m.fromUserId === user.id ? 'var(--paper)' : 'var(--ink)',
                          }}>
                            <Icon.link s={12} /> {a.name}
                          </a>
                        ))}
                      </div>
                    )}
                    <div className="bubble-time">{fmtDate(m.at)}</div>
                  </div>
                ))
              )}
            </div>

            {/* Attachments preview row */}
            {attachments.length > 0 && (
              <div style={{ borderTop: '1px solid var(--rule)', padding: '10px 18px', display: 'flex', gap: 8, flexWrap: 'wrap', background: 'var(--paper-2)' }}>
                {attachments.map((a, i) => (
                  <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 10px', background: 'var(--surface)', border: '1px solid var(--rule)', borderRadius: 4, fontSize: 12 }}>
                    <Icon.link s={12} /> {a.name}
                    <button onClick={() => setAttachments((arr) => arr.filter((_, j) => j !== i))} style={{ marginLeft: 4 }}><Icon.x s={10} /></button>
                  </span>
                ))}
              </div>
            )}

            {/* Templates picker */}
            {showTemplates && (
              <div style={{ borderTop: '1px solid var(--rule)', padding: '10px 18px', background: 'var(--paper-2)' }}>
                <div className="mono-meta mb-8">Saved replies</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {templates.map((t) => (
                    <button key={t.label} onClick={() => { setDraft(t.text); setShowTemplates(false); composerRef.current?.focus(); }} className="tab" style={{ textTransform: 'none', letterSpacing: '0.02em', fontSize: 11 }}>{t.label}</button>
                  ))}
                </div>
              </div>
            )}

            {/* Attach picker */}
            {showAttachPicker && (
              <div style={{ borderTop: '1px solid var(--rule)', padding: '10px 18px', background: 'var(--paper-2)' }}>
                <div className="mono-meta mb-8">Pick file (demo · stock)</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {STOCK_ATTACH.map((s) => (
                    <button key={s.name} onClick={() => { setAttachments((arr) => arr.find((a) => a.name === s.name) ? arr : [...arr, s]); setShowAttachPicker(false); }} className="tab" style={{ textTransform: 'none', letterSpacing: '0.02em', fontSize: 11 }}>+ {s.name}</button>
                  ))}
                </div>
              </div>
            )}

            <div className="inbox-compose">
              <textarea
                ref={composerRef}
                placeholder={`Write a message to ${otherUserName(activeOtherId)}… (⌘/Ctrl + Enter to send)`}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={onComposeKey}
              />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
                <div className="inbox-compose-tools">
                  <button
                    onClick={() => { setShowTemplates((v) => !v); setShowAttachPicker(false); }}
                    title="Saved replies"
                    className={showTemplates ? 'is-on' : ''}
                  ><Icon.spark s={16} /></button>
                  <button
                    onClick={() => { setShowAttachPicker((v) => !v); setShowTemplates(false); }}
                    title="Attach file"
                    className={showAttachPicker ? 'is-on' : ''}
                  ><Icon.link s={16} /></button>
                </div>
                <Button onClick={send} loading={busy} disabled={!draft.trim() && attachments.length === 0} iconRight={<Icon.arrow s={12} />}>Send</Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
