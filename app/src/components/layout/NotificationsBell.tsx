// Notifications bell — Phase 15 rework.
//
// Pop-out is now a tile-pattern card with: All / Unread filter chips,
// time-grouped sections (Today / Yesterday / Earlier), kind-tinted dots
// per row (offer/draft/payout/review), and inline quick actions for
// pending offers + in-review submissions.

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useStore } from '@/lib/api/store';
import { useAuth } from '@/lib/auth/useAuth';
import { api, select } from '@/lib/api/client';
import { Icon } from '@/components/ui/Icon';
import { fmtRelative } from '@/lib/utils/format';
import { pushToast } from '@/lib/utils/toast';
import { fireConfetti } from '@/lib/utils/confetti';
import type { Notification } from '@/lib/api/types';

type NotifKind = 'offer' | 'draft' | 'application' | 'review' | 'collaboration' | 'payout' | 'campaign' | 'team' | 'other';

// Classify a notification by its meta + text — drives the chromatic dot
// + a 1-line "kind" eyebrow above the body.
//
// P7 — added 'collaboration' kind for notifications that anchor on
// `Collaboration` (P1c) but don't carry a more specific FK. Cancel-
// collab requests, mutual-cancel agreements, dispute-resolved
// notifications all set `meta.collaborationId` only. The classifier
// matches on that AFTER the more-specific FKs (offer/sub/app/review)
// so a notification that carries both still classifies as the more
// actionable kind.
function classify(n: Notification): NotifKind {
  if (n.meta?.offerId) return 'offer';
  if (n.meta?.submissionId) return 'draft';
  if (n.meta?.applicationId) return 'application';
  if (n.meta?.reviewId) return 'review';
  if (n.meta?.collaborationId) return 'collaboration';
  const t = (n.text || '').toLowerCase();
  if (t.includes('payout') || t.includes('escrow') || t.includes('paid')) return 'payout';
  if (t.includes('campaign') || t.includes('moved to')) return 'campaign';
  if (t.includes('team') || t.includes('invited') || t.includes('manages')) return 'team';
  return 'other';
}

const KIND_LABEL: Record<NotifKind, string> = {
  offer: 'Offer',
  draft: 'Draft',
  application: 'Application',
  review: 'Review',
  collaboration: 'Collab',
  payout: 'Payout',
  campaign: 'Campaign',
  team: 'Team',
  other: 'Update',
};

// Group key by relative bucket
function groupKeyOf(at: string, refMs: number): 'today' | 'yesterday' | 'week' | 'older' {
  const d = +new Date(at);
  const oneDay = 24 * 60 * 60 * 1000;
  const diff = refMs - d;
  if (diff < oneDay) return 'today';
  if (diff < 2 * oneDay) return 'yesterday';
  if (diff < 7 * oneDay) return 'week';
  return 'older';
}

const GROUP_LABEL = {
  today: 'Today',
  yesterday: 'Yesterday',
  week: 'Earlier this week',
  older: 'Older',
};

export function NotificationsBell() {
  const { user } = useAuth();
  const db = useStore((s) => s.db);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const navigate = useNavigate();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  const allNotifs = user ? select.notificationsForUser(db, user.id) : [];
  const unreadCount = allNotifs.filter((n) => !n.read).length;
  const notifs = filter === 'unread' ? allNotifs.filter((n) => !n.read) : allNotifs;

  // Group + cap (display first 30 in any case)
  const grouped = useMemo(() => {
    const refMs = Date.now();
    const buckets: Record<'today' | 'yesterday' | 'week' | 'older', Notification[]> = {
      today: [], yesterday: [], week: [], older: [],
    };
    for (const n of notifs.slice(0, 30)) {
      buckets[groupKeyOf(n.at, refMs)].push(n);
    }
    return buckets;
  }, [notifs]);

  // Recompute popup position when opened or window resized
  useEffect(() => {
    if (!open) return;
    const compute = () => {
      const r = buttonRef.current?.getBoundingClientRect();
      if (!r) return;
      const popupWidth = 360;
      const wantLeft = r.right + 8;
      const fitsRight = wantLeft + popupWidth + 16 < window.innerWidth;
      setPos(fitsRight
        ? { top: r.top, left: wantLeft }
        : { top: r.bottom + 8, left: Math.max(8, Math.min(window.innerWidth - popupWidth - 8, r.left)) }
      );
    };
    compute();
    window.addEventListener('resize', compute);
    return () => window.removeEventListener('resize', compute);
  }, [open]);

  // Outside-click close
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      const t = e.target as Node;
      if (buttonRef.current?.contains(t)) return;
      if (popupRef.current?.contains(t)) return;
      setOpen(false);
    };
    window.addEventListener('mousedown', onClick);
    return () => window.removeEventListener('mousedown', onClick);
  }, [open]);

  // Escape closes
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  if (!user) return null;

  // Build a deep-link from the notification's href + meta. The href is the page
  // and meta carries the entity ids — we tack on the right query so the destination
  // opens the right entity directly. Pure resolver.
  //
  // Two route systems are in play:
  //  - Legacy `/approvals`, `/campaigns/<id>`, etc. — uses `?cid=`, `?sid=`
  //    query params + `#reviews` hash.
  //  - Workspace-v2 (`/v2`) — the entire workspace lives on one URL with
  //    `?tab=<route>` selecting the surface. Notification creators across
  //    v2*Actions set `href: '/v2'` (plain) and rely on this resolver to
  //    construct the right `?tab=<route>` based on `meta` + the recipient's
  //    persona. Pre-fix every v2 notification landed the user on the
  //    workspace root + their last-stored route — never on the surface the
  //    notification was about.
  const resolveHref = (n: Notification): string | undefined => {
    if (!n.href) return undefined;
    const meta = n.meta;
    if (!meta) return n.href;
    const url = new URL(n.href, window.location.origin);

    // ---- v2 route resolution ---------------------------------------------
    // If the href points to the v2 workspace, build the right `?tab=` deep-
    // link from `meta`. The recipient is the user reading the bell, so we
    // can use the current viewer's persona to pick between the brand-side
    // and creator-side surfaces (same collab; different cockpit).
    if (url.pathname === '/v2' || url.pathname.startsWith('/v2/')) {
      // Look up the recipient (= the viewer) to determine persona. Users
      // table is denormalized: creatorId set → creator, brandId set → brand.
      const recipient = db.users.find((u) => u.id === n.userId);
      const isCreator = !!recipient?.creatorId;

      // Resolve to a {campaignId, collabId} pair we can route from. Try
      // each FK in priority order — most specific first.
      let campaignId: string | undefined;
      let collabId: string | undefined;
      let submissionId: string | undefined;

      if (meta.collaborationId) {
        const co = db.collaborations.find((c) => c.id === meta.collaborationId);
        if (co) { collabId = co.id; campaignId = co.campaignId; }
      }
      if (meta.offerId && !collabId) {
        const off = db.offers.find((o) => o.id === meta.offerId);
        if (off) {
          campaignId = off.campaignId;
          const co = db.collaborations.find((c) => c.campaignId === off.campaignId && c.creatorId === off.creatorId);
          if (co) collabId = co.id;
        }
      }
      if (meta.submissionId && !collabId) {
        const sub = db.submissions.find((s) => s.id === meta.submissionId);
        if (sub) {
          campaignId = sub.campaignId;
          submissionId = sub.id;
          const co = db.collaborations.find((c) => c.campaignId === sub.campaignId && c.creatorId === sub.creatorId);
          if (co) collabId = co.id;
        }
      }
      if (meta.applicationId && !campaignId) {
        const app = db.applications.find((a) => a.id === meta.applicationId);
        if (app) {
          campaignId = app.campaignId;
          const co = db.collaborations.find((c) => c.campaignId === app.campaignId && c.creatorId === app.creatorId);
          if (co) collabId = co.id;
        }
      }
      if (meta.reviewId && !campaignId) {
        const rev = db.reviews?.find((r) => r.id === meta.reviewId);
        if (rev) {
          campaignId = rev.campaignId;
        }
      }
      if (!campaignId && meta.campaignId) {
        campaignId = meta.campaignId;
        // Try to resolve a collab for this viewer on the campaign so creators
        // land on their own collab detail (not the brand-side campaign view).
        if (isCreator && recipient?.creatorId) {
          const co = db.collaborations.find(
            (c) => c.campaignId === meta.campaignId && c.creatorId === recipient.creatorId,
          );
          if (co) collabId = co.id;
        }
      }

      // Pick the right surface based on persona:
      //  - creator viewer with a collab → CollabDetail (their action cockpit)
      //  - creator viewer with a brief but no collab → BriefDetail
      //  - brand viewer with a campaign + submission → review modal deep-link
      //  - brand viewer with a campaign → CampaignDetail (pipeline default)
      //  - no campaign resolved → fall back to plain /v2
      let tab: string | undefined;
      if (isCreator) {
        if (collabId) tab = `collab:${collabId}`;
        else if (campaignId) tab = `brief:${campaignId}`;
      } else {
        if (campaignId && submissionId && collabId) {
          // Brand-side review deep-link — pops ContentReviewModal on the
          // Content tab. Matches the convention used by BrandHome's
          // ActionInbox so the bell + the home triage land on the same UI.
          tab = `campaign:${campaignId}?tab=content&review=${collabId}`;
        } else if (campaignId) {
          tab = `campaign:${campaignId}`;
        }
      }

      if (tab) {
        url.searchParams.set('tab', tab);
        return url.pathname + '?' + url.searchParams.toString();
      }
      // No tab resolvable — fall through to the legacy `?cid=` path so
      // the URL at least carries the campaign id.
    }

    // ---- Legacy route resolution -----------------------------------------
    // Most notifications carry a campaignId — sync the campaign drawer's `?cid` param.
    if (meta.campaignId) url.searchParams.set('cid', meta.campaignId);
    if (meta.submissionId && url.pathname.includes('/approvals')) {
      url.searchParams.set('sid', meta.submissionId);
    }
    if (meta.applicationId && !url.searchParams.has('cid')) {
      const app = db.applications.find((a) => a.id === meta.applicationId);
      if (app) url.searchParams.set('cid', app.campaignId);
    }
    if (meta.reviewId) {
      url.hash = '#reviews';
    }
    return url.pathname + (url.search || '') + (url.hash || '');
  };

  // Migration 023 — fire-and-forget mirror of the read-state flip so
  // a second device's bell badge clears too. Best-effort; local store
  // is canonical for the immediate UI.
  const mirrorReadFlip = (ids: string[]) => {
    if (ids.length === 0 || typeof window === 'undefined') return;
    void (async () => {
      try {
        const { isSupabaseConfigured } = await import('@/lib/supabase');
        if (!isSupabaseConfigured()) return;
        const { markNotificationsReadInSupabase } = await import('@/lib/data/notificationsRepo');
        await markNotificationsReadInSupabase(ids);
      } catch {
        /* ignore */
      }
    })();
  };

  const onItem = (n: Notification) => {
    useStore.getState().setDB((d) => ({
      ...d,
      notifications: d.notifications.map((x) => x.id === n.id ? { ...x, read: true } : x),
    }));
    mirrorReadFlip([n.id]);
    const href = resolveHref(n);
    if (href) navigate(href);
    setOpen(false);
  };

  const ackOne = (id: string) => {
    useStore.getState().setDB((d) => ({
      ...d,
      notifications: d.notifications.map((x) => x.id === id ? { ...x, read: true } : x),
    }));
    mirrorReadFlip([id]);
  };

  const markAll = async () => {
    await api.notifications.markAllRead();
  };

  return (
    <>
      <button
        ref={buttonRef}
        onClick={() => setOpen((o) => !o)}
        className={['notif-bell', open ? 'is-open' : '', unreadCount > 0 ? 'has-unread' : ''].join(' ')}
        aria-label={`Notifications${unreadCount > 0 ? ` · ${unreadCount} unread` : ''}`}
        aria-expanded={open}
        aria-haspopup="menu"
        title="Notifications"
      >
        <Icon.bell s={16} />
        {unreadCount > 0 && (
          <span className="notif-bell-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
        )}
      </button>

      {open && pos && createPortal(
        <div
          ref={popupRef}
          className="notif-popup"
          style={{ top: pos.top, left: pos.left }}
          role="menu"
        >
          <div className="notif-popup-h">
            <div className="notif-popup-h-row">
              <span className="mono-meta">Notifications</span>
              {unreadCount > 0 && (
                <button onClick={markAll} className="notif-popup-mark">Mark all read</button>
              )}
            </div>
            <div className="notif-popup-filters">
              <button
                className={['notif-filter-chip', filter === 'all' ? 'is-on' : ''].join(' ')}
                onClick={() => setFilter('all')}
              >All <span className="notif-filter-count">{allNotifs.length}</span></button>
              <button
                className={['notif-filter-chip', filter === 'unread' ? 'is-on' : ''].join(' ')}
                onClick={() => setFilter('unread')}
                disabled={unreadCount === 0}
              >Unread {unreadCount > 0 && <span className="notif-filter-count is-accent">{unreadCount}</span>}</button>
            </div>
          </div>

          {notifs.length === 0 ? (
            <div className="notif-empty">
              <div className="notif-empty-h">{filter === 'unread' ? 'Inbox zero' : 'All quiet'}</div>
              <div>{filter === 'unread' ? 'Nothing unread.' : 'No notifications yet.'}</div>
            </div>
          ) : (
            <div className="notif-list">
              {(['today', 'yesterday', 'week', 'older'] as const).map((bucket) => {
                const list = grouped[bucket];
                if (list.length === 0) return null;
                return (
                  <div key={bucket} className="notif-group">
                    <div className="notif-group-h mono-meta">{GROUP_LABEL[bucket]}</div>
                    {list.map((n) => (
                      <NotifRow
                        key={n.id}
                        n={n}
                        kind={classify(n)}
                        onClick={() => onItem(n)}
                        onAck={() => ackOne(n.id)}
                        onClose={() => setOpen(false)}
                      />
                    ))}
                  </div>
                );
              })}
            </div>
          )}
        </div>,
        document.body
      )}
    </>
  );
}

interface NotifRowProps {
  n: Notification;
  kind: NotifKind;
  onClick: () => void;
  onAck: () => void;
  onClose: () => void;
}

function NotifRow({ n, kind, onClick, onAck, onClose }: NotifRowProps) {
  const db = useStore((s) => s.db);
  const offer = n.meta?.offerId ? db.offers.find((o) => o.id === n.meta!.offerId) : null;
  const sub   = n.meta?.submissionId ? db.submissions.find((s) => s.id === n.meta!.submissionId) : null;
  const showOfferActions = !!offer && offer.status === 'pending';
  const showApproveAction = !!sub && sub.status === 'in_review';

  const ackAndClose = () => {
    onAck();
    onClose();
  };

  const acceptOffer = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!offer) return;
    try {
      await api.offers.respond(offer.id, 'accept');
      fireConfetti();
      pushToast('Offer accepted · escrow held', 'good');
      ackAndClose();
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Action failed', 'bad');
    }
  };
  const declineOffer = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!offer) return;
    try {
      await api.offers.respond(offer.id, 'decline');
      pushToast('Offer declined', 'default');
      ackAndClose();
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Action failed', 'bad');
    }
  };
  const approveDraft = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!sub) return;
    try {
      await api.submissions.decide(sub.id, 'approved');
      pushToast('Approved · escrow released', 'good');
      ackAndClose();
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Action failed', 'bad');
    }
  };

  return (
    <button
      onClick={onClick}
      className={['notif-row', n.read ? 'is-read' : 'is-unread', `kind-${kind}`].join(' ')}
      role="menuitem"
    >
      <span className="notif-row-dot" aria-hidden="true">{KIND_LABEL[kind][0]}</span>
      <div className="notif-row-body">
        <div className="notif-row-kind mono-meta">{KIND_LABEL[kind]}</div>
        <div className="notif-row-text">{n.text}</div>
        <div className="notif-row-time mono-meta">{fmtRelative(n.at)}</div>
        {(showOfferActions || showApproveAction) && (
          <div className="notif-row-actions">
            {showOfferActions && (
              <>
                <button type="button" onClick={declineOffer} className="notif-quick-action" data-variant="ghost">Decline</button>
                <button type="button" onClick={acceptOffer} className="notif-quick-action" data-variant="solid">Accept</button>
              </>
            )}
            {showApproveAction && (
              <button type="button" onClick={approveDraft} className="notif-quick-action" data-variant="solid">Approve</button>
            )}
          </div>
        )}
      </div>
    </button>
  );
}
