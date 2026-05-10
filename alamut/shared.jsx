// Shared atoms: Logo, Rule, Label, Stat, IconButton, and a minimal icon set.
// Uses inline SVG for icons so we don't pull in a framework icon lib.

const Icon = {
  search: (p={}) => <svg width={p.s||16} height={p.s||16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>,
  arrow: (p={}) => <svg width={p.s||16} height={p.s||16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M5 12h14M13 6l6 6-6 6"/></svg>,
  arrowLeft: (p={}) => <svg width={p.s||16} height={p.s||16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M19 12H5M11 6l-6 6 6 6"/></svg>,
  plus: (p={}) => <svg width={p.s||16} height={p.s||16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 5v14M5 12h14"/></svg>,
  check: (p={}) => <svg width={p.s||16} height={p.s||16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="m5 12 5 5L20 7"/></svg>,
  star: (p={}) => <svg width={p.s||14} height={p.s||14} viewBox="0 0 24 24" fill="currentColor"><path d="m12 2 3 7h7l-5.5 4.5L18.5 21 12 16.8 5.5 21l2-7.5L2 9h7z"/></svg>,
  grid: (p={}) => <svg width={p.s||16} height={p.s||16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="4" y="4" width="7" height="7"/><rect x="13" y="4" width="7" height="7"/><rect x="4" y="13" width="7" height="7"/><rect x="13" y="13" width="7" height="7"/></svg>,
  rows: (p={}) => <svg width={p.s||16} height={p.s||16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 6h16M4 12h16M4 18h16"/></svg>,
  dot: (p={}) => <span style={{ display: 'inline-block', width: 4, height: 4, borderRadius: '50%', background: 'currentColor', margin: '0 8px', verticalAlign: 'middle', opacity: 0.5 }} />,
  instagram: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="0.75" fill="currentColor"/></svg>,
  youtube: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="5" width="20" height="14" rx="3"/><path d="m10 9 5 3-5 3z" fill="currentColor"/></svg>,
  tiktok: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M14 4v10a3 3 0 1 1-3-3"/><path d="M14 4c0 2.5 2 4.5 5 4.5"/></svg>,
  mail: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="5" width="18" height="14"/><path d="m3 7 9 7 9-7"/></svg>,
  globe: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg>,
  download: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 4v12m-5-5 5 5 5-5M4 20h16"/></svg>,
  x: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="m6 6 12 12M18 6 6 18"/></svg>,
};

// Monospace section label with serial number.
function Label({ num, children, style }) {
  return (
    <div className="a-label" style={style}>
      {num && <span className="a-label-num">{num}</span>}
      <span>{children}</span>
    </div>
  );
}

// One-pixel rule as divider (editorial style)
function Rule({ style }) {
  return <div className="a-rule" style={style} />;
}

// Stat — big number + small tag (mono tag)
function Stat({ value, unit, tag, align = 'left' }) {
  return (
    <div className="a-stat" style={{ textAlign: align }}>
      <div className="a-stat-value">
        {value}<span className="a-stat-unit">{unit}</span>
      </div>
      <div className="a-stat-tag">{tag}</div>
    </div>
  );
}

// Pill (minimal, bordered, not rounded-full)
function Pill({ children, active, onClick, as = 'button' }) {
  const Tag = as;
  return (
    <Tag className={'a-pill' + (active ? ' is-active' : '')} onClick={onClick}>{children}</Tag>
  );
}

// Button
function Btn({ children, variant = 'solid', onClick, icon, size = 'md', type, style }) {
  return (
    <button
      type={type}
      onClick={onClick}
      className={`a-btn a-btn-${variant} a-btn-${size}`}
      style={style}
    >
      <span>{children}</span>
      {icon && <span className="a-btn-icon">{icon}</span>}
    </button>
  );
}

// Logo — wordmark, editorial
function Logo({ size = 22, tag = 'TALENT MANAGEMENT' }) {
  return (
    <div className="a-logo">
      <span className="a-logo-mark" style={{ fontSize: size * 1.1 }}>Alamut</span>
      <span className="a-logo-tag">{tag}</span>
    </div>
  );
}

// Number formatter: 485000 -> 485K, 1.24M
function fmt(n) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(n < 10_000_000 ? 2 : 1).replace(/\.0$/, '') + 'M';
  if (n >= 1_000) return Math.round(n / 100) / 10 + 'K';
  return String(n);
}

// Monospace number block (stacked KPI)
function KPI({ label, value, unit = '' }) {
  return (
    <div className="a-kpi">
      <div className="a-kpi-label">{label}</div>
      <div className="a-kpi-value">{value}<span className="a-kpi-unit">{unit}</span></div>
    </div>
  );
}

// Striped placeholder used for missing imagery (we use it for the landing hero side panel)
function Placeholder({ w = '100%', h = 240, label = 'image' }) {
  return (
    <div style={{
      width: w, height: h, position: 'relative',
      background: 'repeating-linear-gradient(135deg, rgba(0,0,0,0.04) 0 10px, rgba(0,0,0,0.06) 10px 11px)',
      border: '1px solid var(--rule)',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-start',
      padding: 10, color: 'var(--ink-60)', fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '0.04em',
    }}>
      <span>[ {label} ]</span>
    </div>
  );
}

Object.assign(window, { Icon, Label, Rule, Stat, Pill, Btn, Logo, KPI, Placeholder, fmt });
