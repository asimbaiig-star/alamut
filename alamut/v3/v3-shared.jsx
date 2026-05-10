// Alamut v3 — extra icons + small helpers (additive to shared.jsx)

const Ico = {
  home: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="m3 11 9-8 9 8"/><path d="M5 10v10h14V10"/></svg>,
  compass: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="9"/><path d="m15 9-2 5-5 2 2-5z" fill="currentColor"/></svg>,
  layers: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="m12 3 9 5-9 5-9-5z"/><path d="m3 13 9 5 9-5"/></svg>,
  inbox: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 13V5h18v8M3 13l3-3h12l3 3M3 13v6h18v-6"/></svg>,
  wallet: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="6" width="18" height="14"/><path d="M3 10h18M16 15h2"/></svg>,
  chart: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 20V4M4 20h16M8 16V10m4 6V6m4 10v-8"/></svg>,
  user: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4.5 5-6 8-6s6.5 1.5 8 6"/></svg>,
  film: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="4" width="18" height="16"/><path d="M3 10h18M3 14h18M7 4v16M17 4v16"/></svg>,
  check: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="m5 12 5 5L20 7"/></svg>,
  spark: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8"/></svg>,
  briefcase: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="7" width="18" height="13"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 13h18"/></svg>,
  tools: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M14 6a4 4 0 0 1 4 4l3 3-3 3-3-3a4 4 0 0 1-4-4l-4 4-3-3 4-4a4 4 0 0 1 6-0z"/></svg>,
};

// Stage definitions
const STAGES = [
  { id: 'draft', label: 'Draft', tone: 'draft' },
  { id: 'live', label: 'Live', tone: 'live' },
  { id: 'shortlist', label: 'Shortlisting', tone: 'shortlist' },
  { id: 'offer', label: 'Offer', tone: 'offer' },
  { id: 'production', label: 'Production', tone: 'production' },
  { id: 'posted', label: 'Posted', tone: 'posted' },
  { id: 'reporting', label: 'Reporting', tone: 'reporting' },
  { id: 'closed', label: 'Closed', tone: 'closed' },
];
const STAGE_LABEL = Object.fromEntries(STAGES.map(s => [s.id, s.label]));

// USD formatter
function $fmt(n) {
  if (n >= 1000) return '$' + (n / 1000).toFixed(n % 1000 === 0 ? 0 : 1) + 'k';
  return '$' + n;
}

// Sidebar nav data
const CREATOR_NAV = [
  { id: 'creator-home',      label: 'Dashboard',     icon: 'home',       group: 'main' },
  { id: 'creator-discover',  label: 'Discover',      icon: 'compass',    group: 'main' },
  { id: 'creator-campaigns', label: 'My campaigns',  icon: 'layers',     group: 'work' },
  { id: 'creator-content',   label: 'Content',       icon: 'film',       group: 'work' },
  { id: 'creator-inbox',     label: 'Inbox',         icon: 'inbox',      group: 'work', badge: 3 },
  { id: 'creator-earnings',  label: 'Earnings',      icon: 'wallet',     group: 'work' },
  { id: 'creator-analytics', label: 'Analytics',     icon: 'chart',      group: 'me' },
  { id: 'creator-profile',   label: 'My profile',    icon: 'user',       group: 'me' },
];

const BRAND_NAV = [
  { id: 'brand-home',        label: 'Dashboard',     icon: 'home',       group: 'main' },
  { id: 'brand-campaigns',   label: 'Campaigns',     icon: 'layers',     group: 'work' },
  { id: 'brand-discover',    label: 'Find creators', icon: 'compass',    group: 'work' },
  { id: 'brand-approvals',   label: 'Approvals',     icon: 'check',      group: 'work', badge: 4 },
  { id: 'brand-inbox',       label: 'Inbox',         icon: 'inbox',      group: 'work', badge: 2 },
  { id: 'brand-wallet',      label: 'Wallet',        icon: 'wallet',     group: 'me' },
  { id: 'brand-analytics',   label: 'Analytics',     icon: 'chart',      group: 'me' },
  { id: 'brand-profile',     label: 'Company',       icon: 'briefcase',  group: 'me' },
];

Object.assign(window, { Ico, STAGES, STAGE_LABEL, $fmt, CREATOR_NAV, BRAND_NAV });
