import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth/useAuth';
import { useStore } from '@/lib/api/store';
import { api, select } from '@/lib/api/client';
import { Logo } from '../ui/Logo';
import { Icon } from '../ui/Icon';
import { CREATOR_NAV, BRAND_NAV, ADMIN_NAV, type NavItem } from './nav';
import { NotificationsBell } from './NotificationsBell';
import { ThemeToggle } from './ThemeToggle';
import { DensityToggle } from './DensityToggle';
import { initials } from '@/lib/utils/format';
import { pushToast } from '@/lib/utils/toast';
import { confirmAction } from '@/lib/utils/confirm';
import { brandTriage, brandTriageCount, creatorTriage, creatorTriageCount } from '@/lib/utils/triage-metrics';
import { adminQueueSummary, totalActionableCount } from '@/lib/utils/admin-metrics';

const groupLabel = { main: 'Overview', work: 'Work', me: 'Account' } as const;

export function Sidebar() {
  const { user, creator, brand, isCreator, isBrand, isAdmin } = useAuth();
  const db = useStore((s) => s.db);
  const loc = useLocation();
  const navigate = useNavigate();

  if (!user) return null;

  const nav = isAdmin ? ADMIN_NAV : isCreator ? CREATOR_NAV : BRAND_NAV;
  const groups = Array.from(new Set(nav.map((n) => n.group)));

  // Count of active production items needing the creator's attention — drafts to upload
  // or revisions to address. Only counted when the user is a creator.
  // P1b §1.2: 'production' stage no longer exists at the campaign level.
  // The signal "creator has work in progress on a live campaign" comes from
  // the latest submission's status, not from Campaign.stage.
  const productionCount = creator
    ? select.campaignsForCreator(db, creator.id).filter((c) => {
        if (c.stage !== 'live') return false;
        const subs = db.submissions.filter((s) => s.campaignId === c.id && s.creatorId === creator.id);
        const last = subs[subs.length - 1];
        // Counts as actionable if no submission yet OR last one needs revisions
        return !last || last.status === 'revisions';
      }).length
    : 0;

  // Today badge — count of actionable triage items (counter offers, drafts to
  // submit, drafts to review, revisions, disputes). Drives the sidebar badge
  // and gives users a single number for "what needs me right now."
  const todayCount = brand
    ? brandTriageCount(brandTriage(db, brand.id))
    : creator
      ? creatorTriageCount(creatorTriage(db, creator))
      : 0;

  // Admin console badge — total queue items needing attention.
  const adminQueueCount = isAdmin ? totalActionableCount(adminQueueSummary(db)) : 0;

  const badges: Record<string, number> = {
    inbox: select.threadsForUser(db, user.id).filter((t) => t.unreadFor.includes(user.id)).length,
    invites: 0,
    shortlist: brand ? brand.savedCreators.length : 0,
    // Phase 28: 'disputes' no longer in nav (collapsed into adminQueue).
    // Phase 29: 'approvals' no longer in nav (Today's actionable queue
    //          covers brand triage; submission-pending count still
    //          contributes to today's badge via the actionable count).
    production: productionCount,
    today: todayCount,
    adminQueue: adminQueueCount,
  };

  const switchRole = async (to: 'creator' | 'brand') => {
    // Allow free switching only for users that have both profiles. For mock,
    // we fake it: log out current, then auto sign in a seed user of the target role.
    if (to === user.role) return;
    const ok = await confirmAction({
      title: `Switch to ${to} view?`,
      message: `You'll be signed out and re-signed in as a demo ${to} account (${to === 'creator' ? 'sarah@alamut.test' : 'hannah@aesop.test'}).`,
      confirmLabel: `Switch to ${to}`,
    });
    if (!ok) return;
    await api.auth.signOut();
    const seedEmail = to === 'creator' ? 'sarah@alamut.test' : 'hannah@aesop.test';
    try {
      await api.auth.signIn(seedEmail, 'demo1234');
      pushToast(`Switched to ${to} workspace`, 'good');
      navigate(to === 'creator' ? '/creator/today' : '/brand/today');
    } catch {
      pushToast('Could not switch — try signing in manually', 'bad');
      navigate('/signin');
    }
  };

  const handleSignOut = async () => {
    await api.auth.signOut();
    pushToast('Signed out', 'default');
    navigate('/');
  };

  const tagText = isAdmin
    ? 'ADMIN'
    : isCreator
    ? `CREATOR · ${(creator?.handle || '@you').toUpperCase()}`
    : `BRAND · ${(brand?.name || '').toUpperCase()}`;

  const sessionImg = isCreator ? creator?.portrait : undefined;
  const sessionName = isCreator ? creator?.name : isBrand ? brand?.name : user.email;
  const sessionRole = isAdmin ? 'Admin' : isCreator ? (creator?.verified ? 'Verified creator' : 'Creator') : (brand?.verified ? 'Verified brand' : 'Brand');

  return (
    <aside className="side" id="primary-sidebar" aria-label="Primary navigation">
      <div className="side-logo" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6 }}>
        <Logo size={20} tag={tagText} />
        <div style={{ display: 'flex', gap: 4 }}>
          <NotificationsBell />
          <DensityToggle />
          <ThemeToggle />
          <button
            className="side-mobile-close"
            onClick={() => window.dispatchEvent(new Event('alamut:nav-close'))}
            aria-label="Close navigation"
            title="Close navigation"
          >
            <Icon.x s={16} />
          </button>
        </div>
      </div>

      {!isAdmin && (
        <div className="side-role-switch">
          <button className={isCreator ? 'is-on' : ''} onClick={() => switchRole('creator')}>Creator</button>
          <button className={isBrand ? 'is-on' : ''} onClick={() => switchRole('brand')}>Brand</button>
        </div>
      )}

      <button
        onClick={() => window.dispatchEvent(new Event('alamut:open-search'))}
        style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '8px 10px',
          border: '1px solid var(--rule)',
          borderRadius: 'var(--radius-sm)',
          background: 'var(--surface)',
          color: 'var(--ink-60)',
          fontSize: 13,
          width: '100%',
          textAlign: 'left',
        }}
      >
        <Icon.search s={14} />
        <span style={{ flex: 1 }}>Search…</span>
        <kbd style={{ fontFamily: 'var(--mono)', fontSize: 9, padding: '2px 6px', background: 'var(--paper-2)', border: '1px solid var(--rule)', borderRadius: 3 }}>⌘K</kbd>
      </button>

      {groups.map((g) => (
        <div className="side-section" key={g}>
          <div className="side-section-h">{groupLabel[g]}</div>
          <div className="side-nav">
            {nav.filter((n) => n.group === g).map((item) => (
              <NavLinkItem key={item.id} item={item} active={loc.pathname === item.href} badge={item.badgeKey ? badges[item.badgeKey] : undefined} />
            ))}
          </div>
        </div>
      ))}

      <div className="side-foot">
        <div className="side-foot-img">
          {sessionImg ? <img src={sessionImg} alt="" /> : <span>{initials(sessionName || 'You')}</span>}
        </div>
        <div style={{ minWidth: 0 }}>
          <div className="side-foot-name truncate">{sessionName}</div>
          <div className="side-foot-role">{sessionRole}</div>
        </div>
        <button className="side-foot-out" onClick={handleSignOut} aria-label="Sign out" title="Sign out">
          <Icon.out s={16} />
        </button>
      </div>
    </aside>
  );
}

function NavLinkItem({ item, active, badge }: { item: NavItem; active: boolean; badge?: number }) {
  const I = Icon[item.icon];
  return (
    // Phase 19 fix: `aria-current="page"` so screen-reader users know which
    // nav item is the current page. Without it, the visual `is-on` cue was
    // the only signal — invisible to assistive tech.
    <Link
      to={item.href}
      className={['side-nav-item', active ? 'is-on' : ''].filter(Boolean).join(' ')}
      aria-current={active ? 'page' : undefined}
    >
      <span className="side-nav-icon"><I s={16} /></span>
      <span className="side-nav-label">{item.label}</span>
      {badge ? <span className="side-nav-badge">{badge}</span> : null}
    </Link>
  );
}
