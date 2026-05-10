import type { IconName } from '../ui/Icon';

export interface NavItem {
  id: string;
  label: string;
  href: string;
  icon: IconName;
  group: 'main' | 'work' | 'me';
  // Phase 28: 'disputes' removed (collapsed into 'adminQueue').
  // Phase 29: 'approvals' removed (Today's actionable queue covers this).
  badgeKey?: 'inbox' | 'invites' | 'shortlist' | 'production' | 'today' | 'adminQueue'; // computed at render time
}

// Phase 29: Today is the new home for both creator and brand. Removed:
//   creator: 'home' → /creator/today
//   brand:   'home', 'approvals' → /brand/today (Today queue covers triage)
export const CREATOR_NAV: NavItem[] = [
  { id: 'today',     label: 'Today',         href: '/creator/today',     icon: 'spark',     group: 'main', badgeKey: 'today' },
  { id: 'discover',  label: 'Discover',      href: '/creator/discover',  icon: 'compass',   group: 'main' },
  { id: 'campaigns', label: 'My campaigns',  href: '/creator/campaigns', icon: 'layers',    group: 'work' },
  { id: 'content',   label: 'Content',       href: '/creator/content',   icon: 'film',      group: 'work', badgeKey: 'production' },
  { id: 'inbox',     label: 'Inbox',         href: '/creator/inbox',     icon: 'inbox',     group: 'work', badgeKey: 'inbox' },
  { id: 'earnings',  label: 'Earnings',      href: '/creator/earnings',  icon: 'wallet',    group: 'work' },
  { id: 'analytics', label: 'Analytics',     href: '/creator/analytics', icon: 'chart',     group: 'work' },
  { id: 'profile',   label: 'Profile',       href: '/creator/profile',   icon: 'user',      group: 'me' },
];

export const BRAND_NAV: NavItem[] = [
  { id: 'today',      label: 'Today',        href: '/brand/today',      icon: 'spark',     group: 'main', badgeKey: 'today' },
  { id: 'campaigns',  label: 'Campaigns',    href: '/brand/campaigns',  icon: 'briefcase', group: 'main' },
  { id: 'discover',   label: 'Find creators', href: '/brand/discover',  icon: 'users',     group: 'work', badgeKey: 'shortlist' },
  { id: 'inbox',      label: 'Inbox',        href: '/brand/inbox',      icon: 'inbox',     group: 'work', badgeKey: 'inbox' },
  { id: 'wallet',     label: 'Wallet',       href: '/brand/wallet',     icon: 'wallet',    group: 'work' },
  { id: 'analytics',  label: 'Analytics',    href: '/brand/analytics',  icon: 'chart',     group: 'work' },
  { id: 'profile',    label: 'Company',      href: '/brand/profile',    icon: 'building',  group: 'me' },
];

// Phase 28: collapsed application queue / verify / disputes into one
// /admin/queue tabbed surface. The single Queue entry now carries the
// combined badge count.
export const ADMIN_NAV: NavItem[] = [
  { id: 'home',      label: 'Console',     href: '/admin/home',     icon: 'spark',     group: 'main', badgeKey: 'adminQueue' },
  { id: 'queue',     label: 'Queue',       href: '/admin/queue',    icon: 'inbox',     group: 'main', badgeKey: 'adminQueue' },
  { id: 'payouts',   label: 'Payouts',     href: '/admin/payouts',  icon: 'wallet',    group: 'work' },
  { id: 'audit',     label: 'Audit log',   href: '/admin/audit',    icon: 'chart',     group: 'work' },
];
