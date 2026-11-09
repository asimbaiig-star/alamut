// dealConversation.tsx — a deal's conversation, inside the deal (Round 8, B).
//
// The deal page and Inbox each held half of a deal: to reply you left the
// deal, to act you left the conversation, and Inbox's side panel repeated
// the deal page. The thread now sits beside "Your move" on the deal page.
// Inbox stays, as the list of every conversation; this is the same thread
// (useV2Conversations, v2SendMessage), not a copy.

import { useEffect, useRef, useState } from 'react';
import { useV2Conversations, v2EnsureThreadFor, v2MarkThreadRead, v2SendMessage } from '../v2Hooks';
import { brandAccent } from '../brandPalette';
import { Avatar } from '@/components/ui/Avatar';

export function DealConversation({ campaignId, creatorId, persona, name, avatar, onRoute, title }: {
  campaignId: string;
  creatorId: string;
  /** Who is reading: their own messages sit on the right. */
  persona: 'creator' | 'brand';
  /** The other party. */
  name: string;
  avatar?: string;
  onRoute: (r: string) => void;
  /** A plain heading instead of the other party's face and name, where the
   *  page around it already shows them (the campaign's creator panel). */
  title?: string;
}) {
  const conv = useV2Conversations().find((c) => c.campaignId === campaignId && c.creatorId === creatorId);
  const [draft, setDraft] = useState('');
  const listRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<HTMLElement>(null);
  const [seen, setSeen] = useState(false);
  // threadToV2 tags the viewer's own messages 'brand' ("me"), whoever the
  // viewer is: a position, not a role.
  const mine = 'brand';

  // Reading it here counts as reading it, but only once it's on screen:
  // on a phone it mounts hidden behind the deal's Messages switch, and
  // marking it read there emptied the switch's unread count unseen.
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') { setSeen(true); return; }
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) setSeen(true);
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  useEffect(() => {
    if (seen && conv && conv.unread > 0) v2MarkThreadRead(conv.id);
  }, [seen, conv]);
  // Newest at the bottom, in view.
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [conv?.messages.length]);

  const send = () => {
    if (!conv || !draft.trim()) return;
    v2SendMessage(conv.id, draft.trim());
    setDraft('');
  };

  return (
    <section className="v2-dc" aria-label={`Conversation with ${name}`} ref={boxRef}>
      <header className="v2-dc-head">
        {title ? null : persona === 'creator'
          ? <span className="v2-dc-mark" style={{ background: brandAccent(name).bg }} aria-hidden="true">{name[0]?.toUpperCase()}</span>
          : <Avatar src={avatar} name={name} size={36} />}
        <div><b>{title ?? name}</b><small>{conv ? `${conv.messages.length} message${conv.messages.length === 1 ? '' : 's'}` : 'No messages yet'}</small></div>
        {conv && (
          <button type="button" className="v2-hm-more" onClick={() => onRoute(`deal:${conv.id}`)}>In Inbox</button>
        )}
      </header>
      {conv ? (
        <>
          <div className="v2-dc-msgs" ref={listRef}>
            {conv.messages.length === 0 && <p className="v2-dc-empty">No messages yet. Say hello, or ask about the brief.</p>}
            {conv.messages.map((m, i) => (
              <div key={i} className="v2-dc-msg" data-mine={m.from === mine || undefined}>
                {m.text && <p>{m.text}</p>}
                {m.attachments?.map((a, ai) => (
                  <a key={ai} href={a.url} target="_blank" rel="noopener noreferrer">{a.name}</a>
                ))}
                <small>{m.time}</small>
              </div>
            ))}
          </div>
          <form className="v2-dc-compose" onSubmit={(e) => { e.preventDefault(); send(); }}>
            <label className="v2-sr-only" htmlFor={`dc-${conv.id}`}>Message {name}</label>
            <textarea
              id={`dc-${conv.id}`}
              rows={1}
              value={draft}
              placeholder={`Message ${name}…`}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
            />
            <button type="submit" className="v2-hm-btn is-sm is-dark" disabled={!draft.trim()}>Send</button>
          </form>
        </>
      ) : (
        <div className="v2-dc-empty">
          <p style={{ margin: '0 0 10px' }}>No messages on this deal yet.</p>
          <button type="button" className="v2-hm-btn is-sm" onClick={() => v2EnsureThreadFor(campaignId, creatorId)}>
            Start the conversation
          </button>
        </div>
      )}
    </section>
  );
}
