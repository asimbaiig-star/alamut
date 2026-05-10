// components.jsx — Shared building blocks: icons, sidebar, topbar, primitives

const { useState, useEffect, useRef, useMemo } = React;

// ─── ICONS (inline SVG, all 16px) ─────────────────────────────
const Icon = {
  search: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
  home: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
  compass: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>,
  campaign: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 11l18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 11-5.8-1.6"/></svg>,
  inbox: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11L2 12v6a2 2 0 002 2h16a2 2 0 002-2v-6l-3.45-6.89A2 2 0 0016.76 4H7.24a2 2 0 00-1.79 1.11z"/></svg>,
  wallet: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12V7H5a2 2 0 010-4h14v4"/><path d="M3 5v14a2 2 0 002 2h16v-5"/><path d="M18 12a2 2 0 000 4h4v-4z"/></svg>,
  spark: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L14.5 9.5 22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5z"/></svg>,
  store: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l1-5h16l1 5"/><path d="M5 9v11h14V9"/><path d="M9 22V12h6v10"/></svg>,
  chart: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
  settings: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>,
  bell: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>,
  plus: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  arrow: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>,
  filter: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>,
  check: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
  more: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>,
  edit: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  external: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>,
  send: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>,
  paperclip: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/></svg>,
  ig: <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.16c3.2 0 3.58.01 4.85.07 1.17.05 1.8.25 2.23.41.56.22.96.48 1.38.9s.68.82.9 1.38c.16.42.36 1.06.41 2.23.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.05 1.17-.25 1.8-.41 2.23-.22.56-.48.96-.9 1.38s-.82.68-1.38.9c-.42.16-1.06.36-2.23.41-1.27.06-1.65.07-4.85.07s-3.58-.01-4.85-.07c-1.17-.05-1.8-.25-2.23-.41-.56-.22-.96-.48-1.38-.9s-.68-.82-.9-1.38c-.16-.42-.36-1.06-.41-2.23-.06-1.27-.07-1.65-.07-4.85s.01-3.58.07-4.85c.05-1.17.25-1.8.41-2.23.22-.56.48-.96.9-1.38s.82-.68 1.38-.9c.42-.16 1.06-.36 2.23-.41C8.42 2.17 8.8 2.16 12 2.16M12 0C8.74 0 8.33.01 7.05.07 5.78.13 4.9.33 4.14.63a5.94 5.94 0 00-2.15 1.4A5.94 5.94 0 00.59 4.18C.29 4.94.09 5.82.03 7.09.01 8.33 0 8.74 0 12s.01 3.67.07 4.95c.06 1.27.26 2.15.56 2.91a5.94 5.94 0 001.4 2.15 5.94 5.94 0 002.15 1.4c.76.3 1.64.5 2.91.56C8.33 23.99 8.74 24 12 24s3.67-.01 4.95-.07c1.27-.06 2.15-.26 2.91-.56a5.94 5.94 0 002.15-1.4 5.94 5.94 0 001.4-2.15c.3-.76.5-1.64.56-2.91.06-1.28.07-1.69.07-4.95s-.01-3.67-.07-4.95c-.06-1.27-.26-2.15-.56-2.91a5.94 5.94 0 00-1.4-2.15 5.94 5.94 0 00-2.15-1.4c-.76-.3-1.64-.5-2.91-.56C15.67.01 15.26 0 12 0zm0 5.84A6.16 6.16 0 105.84 12 6.16 6.16 0 0012 5.84zm0 10.16A4 4 0 1116 12a4 4 0 01-4 4zm6.41-11.85a1.44 1.44 0 11-1.44-1.44 1.44 1.44 0 011.44 1.44z"/></svg>,
  tt: <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-5.2 1.74 2.89 2.89 0 012.31-4.64 2.93 2.93 0 01.88.13V9.4a6.84 6.84 0 00-1-.05A6.33 6.33 0 005.8 20.1a6.34 6.34 0 0010.86-4.43v-7a8.16 8.16 0 004.77 1.52v-3.4a4.85 4.85 0 01-1.84-.1z"/></svg>,
  yt: <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M23.5 6.2a3 3 0 00-2.1-2.1C19.6 3.6 12 3.6 12 3.6s-7.6 0-9.4.5A3 3 0 00.5 6.2 31.3 31.3 0 000 12a31.3 31.3 0 00.5 5.8 3 3 0 002.1 2.1c1.8.5 9.4.5 9.4.5s7.6 0 9.4-.5a3 3 0 002.1-2.1 31.3 31.3 0 00.5-5.8 31.3 31.3 0 00-.5-5.8zM9.6 15.6V8.4l6.3 3.6z"/></svg>,
  li: <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M20.45 20.45h-3.55v-5.57c0-1.33-.03-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.36V9h3.41v1.56h.05a3.74 3.74 0 013.36-1.85c3.6 0 4.27 2.37 4.27 5.45zM5.34 7.43a2.06 2.06 0 11.01-4.13 2.06 2.06 0 01-.01 4.13zM7.12 20.45H3.56V9h3.56zM22.22 0H1.77C.79 0 0 .77 0 1.72v20.56C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.72V1.72C24 .77 23.2 0 22.22 0z"/></svg>,
  x: <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>,
  newsletter: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>,
};

const PLATFORM_META = {
  instagram: { color: "#E4405F", name: "Instagram", icon: Icon.ig },
  tiktok: { color: "#000", name: "TikTok", icon: Icon.tt },
  youtube: { color: "#FF0000", name: "YouTube", icon: Icon.yt },
  linkedin: { color: "#0A66C2", name: "LinkedIn", icon: Icon.li },
  x: { color: "#000", name: "X", icon: Icon.x },
  newsletter: { color: "#5A3B47", name: "Newsletter", icon: Icon.newsletter },
};

// ─── Currency formatting ───────────────────────────────────────
function fmtPKR(n) {
  if (n == null) return "—";
  const abs = Math.abs(n);
  if (abs >= 10000000) return `Rs ${(n / 10000000).toFixed(1)}cr`;
  if (abs >= 100000) return `Rs ${(n / 100000).toFixed(1)}L`;
  if (abs >= 1000) return `Rs ${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}K`;
  return `Rs ${n.toLocaleString()}`;
}
function fmtPKRfull(n) {
  if (n == null) return "—";
  return `Rs ${n.toLocaleString()}`;
}
function fmtFollowers(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
  if (n >= 1000) return (n / 1000).toFixed(n >= 10000 ? 0 : 1) + "K";
  return n.toString();
}

// ─── Sidebar ───────────────────────────────────────────────────
function Sidebar({ view, route, onRoute }) {
  const brandNav = [
    { id: "home", label: "Home", icon: Icon.home },
    { id: "spark", label: "Spark AI", icon: Icon.spark },
    { id: "discover", label: "Discover creators", icon: Icon.compass },
    { id: "campaigns", label: "Campaigns", icon: Icon.campaign, badge: "3" },
    { id: "inbox", label: "Inbox", icon: Icon.inbox, badge: "3" },
    { id: "wallet", label: "Wallet", icon: Icon.wallet },
  ];
  const creatorNav = [
    { id: "creator-home", label: "Home", icon: Icon.home },
    { id: "storefront", label: "My storefront", icon: Icon.store },
    { id: "creator-inbox", label: "Inbox", icon: Icon.inbox, badge: "2" },
    { id: "creator-campaigns", label: "Browse campaigns", icon: Icon.compass },
    { id: "creator-wallet", label: "Wallet", icon: Icon.wallet },
    { id: "analytics", label: "Analytics", icon: Icon.chart },
    { id: "kyc", label: "KYC & Tax", icon: Icon.settings },
  ];
  const nav = view === "creator" ? creatorNav : brandNav;

  return (
    <aside className="sidebar">
      <div className="brand" onClick={() => onRoute("landing")} style={{cursor: "pointer"}}>
        <div className="brand-mark">A</div>
        <div className="brand-name">Alamut</div>
      </div>

      <div className="nav-section">
        {nav.map(item => (
          <button
            key={item.id}
            className={"nav-item" + (route === item.id ? " active" : "")}
            onClick={() => onRoute(item.id)}
          >
            <span style={{display: "grid", placeItems: "center", width: 16}}>{item.icon}</span>
            <span>{item.label}</span>
            {item.badge && <span className="nav-badge">{item.badge}</span>}
          </button>
        ))}
      </div>

      {view === "brand" ? (
        <div className="workspace-card">
          <div className="workspace-avatar">SF</div>
          <div className="workspace-info">
            <div className="ws-name">Sapphire Fashion</div>
            <div className="ws-plan">Pro plan</div>
          </div>
        </div>
      ) : (
        <div className="workspace-card">
          <div className="avatar md" style={{background: `url(${window.ALAMUT_DATA.CREATORS[0].avatar}) center/cover`}}></div>
          <div className="workspace-info">
            <div className="ws-name">Hira Mansoor</div>
            <div className="ws-plan">@hira.styles · Verified</div>
          </div>
        </div>
      )}
    </aside>
  );
}

// ─── Topbar ────────────────────────────────────────────────────
function Topbar({ title, crumb, actions, search }) {
  return (
    <div className="topbar">
      <div>
        {crumb && <div className="crumb">{crumb}</div>}
        <h1>{title}</h1>
      </div>
      {search && (
        <div className="input-search" style={{maxWidth: 320, flex: 1, marginLeft: 24}}>
          {Icon.search}
          <input placeholder={search} />
        </div>
      )}
      <div className="topbar-actions">
        {actions}
        <button className="icon-btn">{Icon.bell}</button>
      </div>
    </div>
  );
}

// ─── PlatformChip ──────────────────────────────────────────────
function PlatformChip({ platform, followers, engagement }) {
  const meta = PLATFORM_META[platform] || PLATFORM_META.instagram;
  return (
    <div className="channel-chip">
      <div className="ch-icon" style={{background: meta.color}}>{meta.icon}</div>
      <div style={{display: "flex", flexDirection: "column", lineHeight: 1.25}}>
        <div style={{fontWeight: 550, fontSize: 13}}>{fmtFollowers(followers)} <span className="muted">on {meta.name}</span></div>
        {engagement != null && <div style={{fontSize: 11.5, color: "var(--ink-3)"}}>{engagement}% engagement</div>}
      </div>
    </div>
  );
}

// ─── Score badge ───────────────────────────────────────────────
function ScoreBadge({ score }) {
  const color = score >= 90 ? "var(--moss)" : score >= 80 ? "var(--accent)" : "var(--ink-3)";
  return (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "2px 8px", borderRadius: "999px",
      background: "var(--bg-2)", color,
      fontSize: 12, fontWeight: 600,
      fontFamily: "var(--font-display)", letterSpacing: "-0.01em",
    }}>
      <span style={{fontSize: 9, opacity: 0.7}}>●</span>
      {score}
    </div>
  );
}

// ─── Stage pill ────────────────────────────────────────────────
function StagePill({ stage }) {
  const map = {
    "Live": "live",
    "Active": "moss",
    "Planned": "draft",
    "Completed": "moss",
    "Confirmed": "confirmed",
    "Negotiating": "draft",
    "Submitted": "accent",
  };
  return <span className={`pill ${map[stage] || ""}`}>{stage}</span>;
}

window.AlamutComponents = {
  Icon, PLATFORM_META, fmtPKR, fmtPKRfull, fmtFollowers,
  Sidebar, Topbar, PlatformChip, ScoreBadge, StagePill,
};
