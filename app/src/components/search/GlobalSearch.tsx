// Global search — ⌘K / Ctrl+K opens. Indexes campaigns, creators, brands, threads, notifications.
// Plus a top-level "Actions" group for quick navigation + commands (Notion / Linear pattern).
// Keyboard nav: ↑↓ to navigate, Enter to open, Esc to close.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '@/lib/api/store';
import { useAuth } from '@/lib/auth/useAuth';
import { api } from '@/lib/api/client';
import { Icon, type IconName } from '@/components/ui/Icon';
import { initials } from '@/lib/utils/format';
import { pushToast } from '@/lib/utils/toast';
import { stageLabel } from '@/lib/utils/labels';

type GroupName = 'Actions' | 'Campaigns' | 'Creators' | 'Brands' | 'Threads' | 'Notifications';

interface SearchHit {
  id: string;
  group: GroupName;
  title: string;
  subtitle: string;
  href?: string;        // navigate target — present for index hits
  onAction?: () => void; // imperative action (toggle theme, sign out, etc.)
  icon: IconName;
  thumb?: string;
  // Optional shortcut hint (e.g. "⌘N") rendered on the right.
  shortcut?: string;
}

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const db = useStore((s) => s.db);
  const { user, isCreator, isBrand, isAdmin, creator } = useAuth();
  const navigate = useNavigate();

  // Quick-action library — imperative commands the user can invoke from the
  // palette without leaving the keyboard. Role-aware so creators don't see
  // brand-only actions and vice versa.
  const actions = useMemo<SearchHit[]>(() => {
    if (!user) return [];
    const list: SearchHit[] = [];

    if (isBrand) {
      list.push(
        { id: 'a_newcmp',  group: 'Actions', title: 'New campaign',          subtitle: 'Open the brief builder', icon: 'plus',     href: '/brand/campaigns?new=1', shortcut: '⌘N' },
        { id: 'a_topup',   group: 'Actions', title: 'Top up wallet',         subtitle: 'Add funds for escrow',   icon: 'wallet',   href: '/brand/wallet?topup=1' },
        { id: 'a_find',    group: 'Actions', title: 'Find creators',         subtitle: 'Browse the roster',      icon: 'users',    href: '/brand/discover' },
        { id: 'a_appr',    group: 'Actions', title: 'Review drafts',         subtitle: 'Pending approvals',      icon: 'check',    href: '/brand/today' },
        { id: 'a_inbox',   group: 'Actions', title: 'Open inbox',            subtitle: 'Brand conversations',    icon: 'inbox',    href: '/brand/inbox' },
        { id: 'a_bprof',   group: 'Actions', title: 'Edit company profile',  subtitle: 'Logo, about, socials',   icon: 'building', href: '/brand/profile' },
      );
    }

    if (isCreator) {
      list.push(
        { id: 'a_browse',  group: 'Actions', title: 'Browse live campaigns', subtitle: 'Discover briefs to apply to', icon: 'compass',   href: '/creator/discover' },
        { id: 'a_mycmp',   group: 'Actions', title: 'My campaigns',          subtitle: 'Offers + production',         icon: 'layers',    href: '/creator/campaigns' },
        { id: 'a_content', group: 'Actions', title: 'Drafts & uploads',      subtitle: 'Active production',           icon: 'film',      href: '/creator/content' },
        { id: 'a_earn',    group: 'Actions', title: 'Earnings + withdraw',   subtitle: 'Cleared, pending, ledger',    icon: 'wallet',    href: '/creator/earnings' },
        { id: 'a_inboxc',  group: 'Actions', title: 'Open inbox',            subtitle: 'Brand conversations',         icon: 'inbox',     href: '/creator/inbox' },
        { id: 'a_cprof',   group: 'Actions', title: 'Edit profile',          subtitle: 'Identity, audience, rates',   icon: 'user',      href: '/creator/profile' },
      );
      // Storefront action only available once the creator has a handle set —
      // ternary-and-push pattern would shove `false` into the list. Use an
      // explicit guard instead so the array stays clean.
      if (creator?.handle) {
        const handle = creator.handle.replace('@', '');
        list.push({
          id: 'a_storefront',
          group: 'Actions',
          title: 'View public storefront',
          subtitle: `alamut.co/c/${handle}`,
          icon: 'out',
          onAction: () => window.open(`/c/${handle}`, '_blank', 'noopener'),
        });
      }
    }

    if (isAdmin) {
      list.push(
        { id: 'a_queue',    group: 'Actions', title: 'Admin queue · creators', subtitle: 'Pending creators',  icon: 'inbox',     href: '/admin/queue' },
        { id: 'a_brands',   group: 'Actions', title: 'Admin queue · brands',   subtitle: 'Verify brands',     icon: 'check',     href: '/admin/queue?type=brands' },
        { id: 'a_disputes', group: 'Actions', title: 'Admin queue · disputes', subtitle: 'Resolve escrow',    icon: 'briefcase', href: '/admin/queue?type=disputes' },
        { id: 'a_audit',    group: 'Actions', title: 'Audit log',              subtitle: 'Every transition',  icon: 'chart',     href: '/admin/audit' },
      );
    }

    // Universal actions — available to every signed-in user.
    list.push(
      {
        id: 'a_theme', group: 'Actions',
        title: 'Toggle theme',
        subtitle: document.body.getAttribute('data-theme') === 'dark' ? 'Switch to light' : 'Switch to dark',
        icon: 'spark',
        onAction: () => {
          const dark = document.body.getAttribute('data-theme') === 'dark';
          if (dark) {
            document.body.removeAttribute('data-theme');
            localStorage.removeItem('alamut.theme');
          } else {
            document.body.setAttribute('data-theme', 'dark');
            localStorage.setItem('alamut.theme', 'dark');
          }
          pushToast(dark ? 'Light theme' : 'Dark theme', 'good');
        },
      },
      {
        id: 'a_density', group: 'Actions',
        title: 'Toggle density',
        subtitle: document.body.getAttribute('data-density') === 'compact' ? 'Standard view' : 'Compact view',
        icon: 'layers',
        onAction: () => {
          const compact = document.body.getAttribute('data-density') === 'compact';
          document.body.setAttribute('data-density', compact ? 'standard' : 'compact');
          localStorage.setItem('alamut.density', compact ? 'standard' : 'compact');
          pushToast(compact ? 'Standard density' : 'Compact density', 'good');
        },
      },
      {
        id: 'a_signout', group: 'Actions',
        title: 'Sign out',
        subtitle: 'End this session',
        icon: 'out',
        onAction: async () => {
          await api.auth.signOut();
          pushToast('Signed out', 'default');
          navigate('/');
        },
      },
    );

    return list;
    // creator.handle changes mean we should rebuild — others are stable.
  }, [user, isBrand, isCreator, isAdmin, creator?.handle, navigate]);

  // Open with ⌘K / Ctrl+K, OR via the `alamut:open-search` custom event
  // (Phase 20 cleanup: replaces the previous pattern where the sidebar
  // synthesized a fake KeyboardEvent — fragile and broke if the listener
  // ever changed its check).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === 'Escape' && open) {
        setOpen(false);
      }
    };
    const onOpenEvent = () => setOpen(true);
    window.addEventListener('keydown', onKey);
    window.addEventListener('alamut:open-search', onOpenEvent);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('alamut:open-search', onOpenEvent);
    };
  }, [open]);

  // Focus on open
  useEffect(() => {
    if (open) {
      setQ(''); setActiveIdx(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  const hits: SearchHit[] = useMemo(() => {
    if (!user) return [];
    const query = q.trim().toLowerCase();

    // Empty state — surface all role-relevant quick actions, no index hits.
    if (!query) return actions;

    // Action matches first — they're typically what the user wants when they
    // type a verb like "new", "withdraw", "sign out", "theme".
    const matchedActions = actions.filter((a) => {
      return [a.title, a.subtitle].join(' ').toLowerCase().includes(query);
    });
    const out: SearchHit[] = [...matchedActions];

    // Campaigns
    db.campaigns.forEach((c) => {
      const brand = db.brands.find((b) => b.id === c.brandId);
      const hay = [c.title, c.pitch, c.brief, c.category, c.region, brand?.name || ''].join(' ').toLowerCase();
      if (hay.includes(query)) {
        const href = isBrand
          ? '/brand/campaigns'
          : isCreator
          ? '/creator/campaigns'
          : '/admin/audit';
        out.push({
          id: `cmp_${c.id}`,
          group: 'Campaigns',
          title: c.title,
          subtitle: `${brand?.name || 'Brand'} · ${stageLabel(c.stage)} · ${c.region}`,
          href,
          icon: 'briefcase',
          thumb: c.cover,
        });
      }
    });

    // Creators
    db.creators.forEach((cr) => {
      const hay = [cr.name, cr.handle, cr.tagline, cr.city, cr.country, ...cr.categories].join(' ').toLowerCase();
      if (hay.includes(query)) {
        out.push({
          id: `cr_${cr.id}`,
          group: 'Creators',
          title: cr.name,
          subtitle: `${cr.handle} · ${cr.tier} · ${cr.city}`,
          href: isBrand ? '/brand/discover' : '/creator/profile',
          icon: 'user',
          thumb: cr.portrait,
        });
      }
    });

    // Brands
    db.brands.forEach((b) => {
      const hay = [b.name, b.industry, b.hq, b.website, b.about].join(' ').toLowerCase();
      if (hay.includes(query)) {
        out.push({
          id: `b_${b.id}`,
          group: 'Brands',
          title: b.name,
          subtitle: `${b.industry} · ${b.hq}`,
          href: isBrand ? '/brand/profile' : '/creator/discover',
          icon: 'building',
        });
      }
    });

    // Threads
    db.threads.filter((t) => t.participants.includes(user.id)).forEach((t) => {
      const cmp = t.campaignId ? db.campaigns.find((c) => c.id === t.campaignId) : null;
      const otherIds = t.participants.filter((p) => p !== user.id);
      const otherNames = otherIds.map((id) => {
        const u = db.users.find((x) => x.id === id);
        if (u?.creatorId) return db.creators.find((c) => c.id === u.creatorId)?.name || u.email;
        if (u?.brandId)   return db.brands.find((b) => b.id === u.brandId)?.name || u.email;
        return u?.email || 'User';
      }).join(', ');
      const hay = [t.subject, otherNames, cmp?.title || ''].join(' ').toLowerCase();
      if (hay.includes(query)) {
        out.push({
          id: `t_${t.id}`,
          group: 'Threads',
          title: otherNames,
          subtitle: t.subject + (cmp ? ` · ${cmp.title}` : ''),
          href: isBrand ? '/brand/inbox' : '/creator/inbox',
          icon: 'inbox',
        });
      }
    });

    // Notifications
    db.notifications.filter((n) => n.userId === user.id).forEach((n) => {
      if (n.text.toLowerCase().includes(query)) {
        out.push({
          id: `n_${n.id}`,
          group: 'Notifications',
          title: n.text,
          subtitle: new Date(n.at).toLocaleString(),
          href: n.href || '#',
          icon: 'bell',
        });
      }
    });

    return out.slice(0, 30);
  }, [q, db, user, isBrand, isCreator, actions]);

  // Group hits
  const groups = useMemo(() => {
    const map: Record<string, SearchHit[]> = {};
    hits.forEach((h) => { (map[h.group] = map[h.group] || []).push(h); });
    return Object.entries(map);
  }, [hits]);

  const flat = hits;

  // Reset active index when results change
  useEffect(() => { setActiveIdx(0); }, [q, hits.length]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx((i) => Math.min(flat.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const h = flat[activeIdx];
      if (!h) return;
      runHit(h);
    }
  };

  // Unified click handler — dispatches to onAction (imperative command, may be
  // async like Sign out), otherwise navigates to the href, then closes the
  // palette. We close immediately for snappy UX and let the promise resolve
  // in the background; if it throws, the toast bus surfaces the error.
  const runHit = (h: SearchHit) => {
    if (h.onAction) {
      // Capture promise so we can swallow rejections without breaking the UI.
      Promise.resolve(h.onAction()).catch((err) => {
        // Don't blow up the palette; show the failure as a toast in the host.
        console.error('Command palette action failed:', err);
      });
      setOpen(false);
      return;
    }
    if (h.href && h.href !== '#') {
      navigate(h.href);
      setOpen(false);
    }
  };

  if (!open) return null;
  return (
    <div className="cmdk-back" onClick={() => setOpen(false)}>
      <div className="cmdk" onClick={(e) => e.stopPropagation()}>
        <div className="cmdk-input-row">
          <Icon.search s={16} />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search or run a command…"
          />
          <kbd className="cmdk-kbd">esc</kbd>
        </div>
        <div className="cmdk-results">
          {flat.length === 0 && q ? (
            <div className="cmdk-empty">No matches for "{q}"</div>
          ) : flat.length === 0 ? (
            <div className="cmdk-empty">Start typing to search.</div>
          ) : (
            groups.map(([group, items]) => (
              <div key={group}>
                <div className="cmdk-group">{group}</div>
                {items.map((h) => {
                  const idxInFlat = flat.indexOf(h);
                  const isActive = idxInFlat === activeIdx;
                  // Action items use their own icon glyph; index hits show a thumb or initials.
                  const isAction = h.group === 'Actions';
                  const IconC = h.icon && Icon[h.icon] ? Icon[h.icon] : Icon.arrow;
                  return (
                    <button
                      key={h.id}
                      className={['cmdk-item', isActive ? 'is-on' : '', isAction ? 'is-action' : ''].join(' ')}
                      onMouseEnter={() => setActiveIdx(idxInFlat)}
                      onClick={() => runHit(h)}
                    >
                      <div className="cmdk-item-icon">
                        {isAction
                          ? <IconC s={14} />
                          : h.thumb
                            ? <img src={h.thumb} alt="" />
                            : <span>{initials(h.title)}</span>}
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div className="cmdk-item-title">{h.title}</div>
                        <div className="cmdk-item-sub">{h.subtitle}</div>
                      </div>
                      {h.shortcut
                        ? <kbd className="cmdk-kbd">{h.shortcut}</kbd>
                        : <Icon.arrow s={14} />}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
        <div className="cmdk-foot">
          <span><kbd className="cmdk-kbd">↑↓</kbd> navigate</span>
          <span><kbd className="cmdk-kbd">↵</kbd> open</span>
          <span><kbd className="cmdk-kbd">esc</kbd> close</span>
        </div>
      </div>
    </div>
  );
}
