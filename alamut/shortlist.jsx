// Shortlist context + hook. Brand-side: creators you're interested in briefing.
// Persists to localStorage. Exposed as window.useShortlist + window.ShortlistProvider.

const ShortlistCtx = React.createContext(null);

function ShortlistProvider({ children }) {
  const [ids, setIds] = React.useState(() => {
    try { return JSON.parse(localStorage.getItem('alamut.shortlist') || '[]'); } catch { return []; }
  });
  const [drawerOpen, setDrawerOpen] = React.useState(false);

  React.useEffect(() => {
    localStorage.setItem('alamut.shortlist', JSON.stringify(ids));
  }, [ids]);

  const add = (id) => setIds((xs) => xs.includes(id) ? xs : [...xs, id]);
  const remove = (id) => setIds((xs) => xs.filter((x) => x !== id));
  const toggle = (id) => setIds((xs) => xs.includes(id) ? xs.filter((x) => x !== id) : [...xs, id]);
  const clear = () => setIds([]);
  const has = (id) => ids.includes(id);

  const value = { ids, add, remove, toggle, clear, has, drawerOpen, setDrawerOpen };
  return <ShortlistCtx.Provider value={value}>{children}</ShortlistCtx.Provider>;
}

function useShortlist() {
  const ctx = React.useContext(ShortlistCtx);
  if (!ctx) throw new Error('useShortlist must be used inside ShortlistProvider');
  return ctx;
}

// Save-button atom (used on cards + profile)
function ShortlistButton({ id, variant = 'icon' }) {
  const { has, toggle } = useShortlist();
  const saved = has(id);
  if (variant === 'icon') {
    return (
      <button
        className={'a-save-icon' + (saved ? ' is-saved' : '')}
        aria-label={saved ? 'Remove from shortlist' : 'Save to shortlist'}
        onClick={(e) => { e.stopPropagation(); toggle(id); }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill={saved ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.5">
          <path d="M6 3h12v18l-6-4-6 4V3z"/>
        </svg>
      </button>
    );
  }
  return (
    <button className={'a-save-text' + (saved ? ' is-saved' : '')} onClick={() => toggle(id)}>
      {saved ? '— Saved to shortlist' : '+ Save to shortlist'}
    </button>
  );
}

// Shortlist count badge — used in the topbar
function ShortlistTrigger() {
  const { ids, setDrawerOpen } = useShortlist();
  return (
    <button className="a-shortlist-trigger" onClick={() => setDrawerOpen(true)}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M6 3h12v18l-6-4-6 4V3z"/>
      </svg>
      <span>Shortlist</span>
      {ids.length > 0 && <span className="a-shortlist-count">{ids.length}</span>}
    </button>
  );
}

// Drawer
function ShortlistDrawer({ onOpenBrief, onOpenCreator }) {
  const { ids, drawerOpen, setDrawerOpen, remove, clear } = useShortlist();
  const picks = ids.map((id) => ROSTER.find((r) => r.id === id)).filter(Boolean);

  if (!drawerOpen) return null;
  return (
    <div className="a-drawer-root">
      <div className="a-drawer-scrim" onClick={() => setDrawerOpen(false)} />
      <aside className="a-drawer" role="dialog" aria-label="Shortlist">
        <header className="a-drawer-head">
          <div>
            <Label num="SHORTLIST">Your picks</Label>
            <div className="a-drawer-title">{picks.length} {picks.length === 1 ? 'creator' : 'creators'} saved</div>
          </div>
          <button className="a-drawer-close" onClick={() => setDrawerOpen(false)}><Icon.x /></button>
        </header>
        <Rule style={{ margin: 0 }} />

        {picks.length === 0 ? (
          <div className="a-drawer-empty">
            <Label>Empty shortlist</Label>
            <p>Save creators as you browse. We'll use this list when you open a brief.</p>
          </div>
        ) : (
          <div className="a-drawer-list">
            {picks.map((c, i) => (
              <div key={c.id} className="a-drawer-row">
                <img src={c.portrait} alt="" />
                <div className="a-drawer-row-body">
                  <div className="a-drawer-row-num">{String(i + 1).padStart(2, '0')}</div>
                  <button className="a-drawer-row-name" onClick={() => { setDrawerOpen(false); onOpenCreator(c); }}>{c.name}</button>
                  <div className="a-drawer-row-meta">{c.categories[0]} · {fmt(c.reach)} · {c.city}</div>
                </div>
                <button className="a-drawer-row-x" onClick={() => remove(c.id)} aria-label="Remove"><Icon.x /></button>
              </div>
            ))}
          </div>
        )}

        <footer className="a-drawer-foot">
          <Rule style={{ margin: 0 }} />
          <div className="a-drawer-actions">
            <button className="a-drawer-clear" onClick={clear} disabled={picks.length === 0}>Clear all</button>
            <Btn
              variant="solid"
              icon={<Icon.arrow s={14} />}
              onClick={() => { if (picks.length > 0) { setDrawerOpen(false); onOpenBrief(); } }}
              style={{ opacity: picks.length === 0 ? 0.4 : 1, pointerEvents: picks.length === 0 ? 'none' : 'auto' }}
            >
              Brief these creators
            </Btn>
          </div>
        </footer>
      </aside>
    </div>
  );
}

Object.assign(window, { ShortlistProvider, useShortlist, ShortlistButton, ShortlistTrigger, ShortlistDrawer });
