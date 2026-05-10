// Roster screen — talent discovery. Magazine-style grid, left filter rail, sticky topbar.
// Relies on window globals: ROSTER, CATEGORIES, PLATFORMS, TIERS, Icon, Label, Rule, Pill, Btn, Logo, fmt

function Topbar({ onOpenProfile, onNavigate, screen }) {
  // Passionfroot-style nav: For brands / For creators / live screens
  return (
    <header className="a-top">
      <div className="a-top-inner">
        <Logo />
        <nav className="a-top-nav">
          {[
            { id: 'landing', label: 'Home' },
            { id: 'roster', label: 'Discover creators' },
            { id: 'discover', label: 'Live campaigns' },
            { id: 'wallet', label: 'Wallet' },
          ].map((n) => (
            <button key={n.id} className={'a-top-link' + (screen === n.id ? ' is-active' : '')}
              onClick={() => onNavigate && onNavigate(n.id)}>
              {n.label}
            </button>
          ))}
        </nav>
        <div className="a-top-actions">
          <button className={'a-top-link' + (screen === 'storefront' ? ' is-active' : '')} onClick={() => onNavigate && onNavigate('storefront')}>My storefront</button>
          <button className={'a-top-link' + (screen === 'inbox' ? ' is-active' : '')} onClick={() => onNavigate && onNavigate('inbox')}>Inbox</button>
          <ShortlistTrigger />
          <Btn variant="solid" size="sm" icon={<Icon.arrow s={14} />} onClick={() => onNavigate && onNavigate('brief')}>Post a campaign</Btn>
        </div>
      </div>
      <Rule />
    </header>
  );
}

function RosterHeader({ count, query, setQuery, sort, setSort }) {
  return (
    <section className="a-roster-head">
      <div className="a-roster-head-top">
        <div>
          <Label num="01 / TALENT">Represented creators, Spring 2026</Label>
          <h1 className="a-display">
            Our creators are <em>storytellers,</em><br />
            cooks, designers, and filmmakers.
          </h1>
          <p className="a-lede">
            Alamut represents {ROSTER.length} creators across six disciplines.
            Each partnership is negotiated, contracted, and delivered by our team —
            brands work with one point of contact, creators keep 85% of campaign value.
          </p>
        </div>
        <aside className="a-roster-head-meta">
          <div>
            <div className="a-meta-k">Signed creators</div>
            <div className="a-meta-v">{ROSTER.length.toString().padStart(2, '0')}</div>
          </div>
          <div>
            <div className="a-meta-k">Combined reach</div>
            <div className="a-meta-v">3.6<span>M</span></div>
          </div>
          <div>
            <div className="a-meta-k">Avg. engagement</div>
            <div className="a-meta-v">6.9<span>%</span></div>
          </div>
          <div>
            <div className="a-meta-k">Campaigns ’25</div>
            <div className="a-meta-v">244</div>
          </div>
        </aside>
      </div>
      <Rule style={{ marginTop: 48 }} />
      <div className="a-roster-toolbar">
        <div className="a-search">
          <Icon.search s={15} />
          <input
            value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, discipline, or handle"
          />
          {query && <button className="a-search-x" onClick={() => setQuery('')}><Icon.x /></button>}
        </div>
        <div className="a-toolbar-right">
          <span className="a-toolbar-count">{count} showing</span>
          <div className="a-sort">
            <span>Sort</span>
            <select value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="featured">Featured</option>
              <option value="reach">Reach, high → low</option>
              <option value="engagement">Engagement, high → low</option>
              <option value="recent">Recently signed</option>
            </select>
          </div>
        </div>
      </div>
    </section>
  );
}

function Filters({ cat, setCat, plat, setPlat, tier, setTier, range, setRange }) {
  return (
    <aside className="a-filters">
      <div>
        <Label num="A">Discipline</Label>
        <div className="a-filter-list">
          {CATEGORIES.map((c) => (
            <button key={c} onClick={() => setCat(c)}
              className={'a-filter-row' + (cat === c ? ' is-active' : '')}>
              <span>{c}</span>
              <span className="a-filter-count">
                {c === 'All' ? ROSTER.length : ROSTER.filter((r) => r.categories.includes(c)).length}
              </span>
            </button>
          ))}
        </div>
      </div>
      <Rule />
      <div>
        <Label num="B">Primary platform</Label>
        <div className="a-filter-list">
          {PLATFORMS.map((p) => (
            <button key={p} onClick={() => setPlat(p)}
              className={'a-filter-row' + (plat === p ? ' is-active' : '')}>
              <span>{p}</span>
              <span className="a-filter-count">
                {p === 'All' ? ROSTER.length : ROSTER.filter((r) => r.primary === p).length}
              </span>
            </button>
          ))}
        </div>
      </div>
      <Rule />
      <div>
        <Label num="C">Tier</Label>
        <div className="a-filter-list">
          {TIERS.map((t) => (
            <button key={t} onClick={() => setTier(t)}
              className={'a-filter-row' + (tier === t ? ' is-active' : '')}>
              <span>{t}</span>
              <span className="a-filter-count">
                {t === 'All' ? ROSTER.length : ROSTER.filter((r) => r.tier === t).length}
              </span>
            </button>
          ))}
        </div>
      </div>
      <Rule />
      <div>
        <Label num="D">Reach (followers)</Label>
        <div className="a-range">
          <div className="a-range-track">
            <div className="a-range-fill" style={{ left: `${range[0]}%`, right: `${100 - range[1]}%` }} />
          </div>
          <div className="a-range-vals">
            <span>{range[0] < 5 ? '0' : range[0] < 50 ? '100K' : range[0] < 90 ? '500K' : '1M+'}</span>
            <span>—</span>
            <span>{range[1] > 95 ? '2M+' : range[1] > 70 ? '1M' : range[1] > 30 ? '500K' : '100K'}</span>
          </div>
          <div className="a-range-presets">
            <button onClick={() => setRange([0, 100])}>Any</button>
            <button onClick={() => setRange([0, 40])}>Micro</button>
            <button onClick={() => setRange([20, 80])}>Mid</button>
            <button onClick={() => setRange([60, 100])}>Macro</button>
          </div>
        </div>
      </div>
      <Rule />
      <button className="a-filters-reset" onClick={() => {
        setCat('All'); setPlat('All'); setTier('All'); setRange([0, 100]);
      }}>Reset filters</button>
    </aside>
  );
}

function CreatorCard({ c, onOpen, variant = 'magazine', index }) {
  // Magazine: big portrait, tall; name overlaid in type below image.
  // Tall layout with hover reveal of categories + rate.
  const platIcon = {
    Instagram: <Icon.instagram />, YouTube: <Icon.youtube />, TikTok: <Icon.tiktok />,
    Substack: <Icon.mail />, Podcast: <Icon.globe />,
  };
  if (variant === 'list') {
    return (
      <button className="a-row" onClick={() => onOpen(c)}>
        <div className="a-row-num">{String(index + 1).padStart(2, '0')}</div>
        <img src={c.portrait} alt="" className="a-row-img" />
        <div className="a-row-name">
          <div className="a-row-title">{c.name}</div>
          <div className="a-row-sub">{c.tagline}</div>
        </div>
        <div className="a-row-meta">
          <span>{c.categories.slice(0, 2).join(' · ')}</span>
        </div>
        <div className="a-row-loc">{c.city}</div>
        <div className="a-row-stat">{fmt(c.reach)}</div>
        <div className="a-row-stat">{c.engagement}%</div>
        <div className="a-row-tier"><span className={'a-tier a-tier-' + c.tier.toLowerCase()}>{c.tier}</span></div>
        <div className="a-row-go"><Icon.arrow s={14} /></div>
      </button>
    );
  }
  return (
    <article className="a-card" onClick={() => onOpen(c)}>
      <div className="a-card-img-wrap">
        <img src={c.portrait} alt={c.name} className="a-card-img" />
        <div className="a-card-img-overlay">
          <span className={'a-tier a-tier-' + c.tier.toLowerCase()}>{c.tier}</span>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <ShortlistButton id={c.id} />
            <span className="a-card-index">Nº {String(index + 1).padStart(2, '0')}</span>
          </div>
        </div>
      </div>
      <div className="a-card-body">
        <div className="a-card-head">
          <div>
            <h3 className="a-card-name">{c.name}</h3>
            <div className="a-card-handle">@{c.handle} <Icon.dot /> {c.city}</div>
          </div>
          <div className="a-card-platform" title={c.primary}>{platIcon[c.primary] || <Icon.globe />}</div>
        </div>
        <p className="a-card-tag">{c.tagline}</p>
        <div className="a-card-stats">
          <div>
            <div className="a-card-stat-v">{fmt(c.reach)}</div>
            <div className="a-card-stat-k">reach</div>
          </div>
          <div>
            <div className="a-card-stat-v">{c.engagement}%</div>
            <div className="a-card-stat-k">eng.</div>
          </div>
          <div>
            <div className="a-card-stat-v">{c.campaigns}</div>
            <div className="a-card-stat-k">campaigns</div>
          </div>
        </div>
        <div className="a-card-foot">
          <div className="a-card-cats">
            {c.categories.slice(0, 2).map((cat) => <span key={cat}>{cat}</span>)}
          </div>
          <span className="a-card-cta">View profile <Icon.arrow s={13} /></span>
        </div>
      </div>
    </article>
  );
}

function FeaturedBanner() {
  const f = ROSTER[1]; // Marcus
  return (
    <section className="a-feat">
      <div className="a-feat-img">
        <img src={f.portrait.replace('w=900&h=1200', 'w=1600&h=900')} alt="" />
      </div>
      <div className="a-feat-body">
        <Label num="SPOTLIGHT">Creator of the week</Label>
        <h2 className="a-feat-title">{f.name}</h2>
        <p className="a-feat-quote">
          “I was on 3 platforms and 14 group chats before Alamut.
          Now one person handles briefs, contracts, and payments.
          I just shoot.”
        </p>
        <div className="a-feat-meta">
          <span>{f.city}</span><Icon.dot />
          <span>{f.categories.join(', ')}</span><Icon.dot />
          <span>{fmt(f.reach)} reach</span>
        </div>
      </div>
    </section>
  );
}

function RosterScreen({ onOpenCreator }) {
  const [query, setQuery] = React.useState('');
  const [cat, setCat] = React.useState('All');
  const [plat, setPlat] = React.useState('All');
  const [tier, setTier] = React.useState('All');
  const [range, setRange] = React.useState([0, 100]);
  const [sort, setSort] = React.useState('featured');
  const [view, setView] = React.useState('grid'); // grid | list

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    let out = ROSTER.filter((r) => {
      if (cat !== 'All' && !r.categories.includes(cat)) return false;
      if (plat !== 'All' && r.primary !== plat) return false;
      if (tier !== 'All' && r.tier !== tier) return false;
      if (q && !(
        r.name.toLowerCase().includes(q) ||
        r.handle.toLowerCase().includes(q) ||
        r.categories.some((c) => c.toLowerCase().includes(q))
      )) return false;
      // range is 0..100 mapped to 100K..2M roughly
      const lo = range[0] / 100 * 2_000_000;
      const hi = range[1] / 100 * 2_000_000;
      if (r.reach < lo || r.reach > hi) return false;
      return true;
    });
    if (sort === 'reach') out = [...out].sort((a, b) => b.reach - a.reach);
    else if (sort === 'engagement') out = [...out].sort((a, b) => b.engagement - a.engagement);
    else if (sort === 'recent') out = [...out].sort((a, b) => Number(b.signed) - Number(a.signed));
    return out;
  }, [query, cat, plat, tier, range, sort]);

  return (
    <div className="a-roster">
      <RosterHeader count={filtered.length} query={query} setQuery={setQuery} sort={sort} setSort={setSort} />
      <FeaturedBanner />
      <Rule />
      <div className="a-roster-toolbar2">
        <Label num="02 / BROWSE">All creators · showing {filtered.length} of {ROSTER.length}</Label>
        <div className="a-view-toggle">
          <button className={view === 'grid' ? 'is-active' : ''} onClick={() => setView('grid')}><Icon.grid s={14} /> <span>Grid</span></button>
          <button className={view === 'list' ? 'is-active' : ''} onClick={() => setView('list')}><Icon.rows s={14} /> <span>List</span></button>
        </div>
      </div>
      <div className="a-roster-body">
        <Filters cat={cat} setCat={setCat} plat={plat} setPlat={setPlat} tier={tier} setTier={setTier} range={range} setRange={setRange} />
        <div className="a-roster-main">
          {view === 'grid' ? (
            <div className="a-grid">
              {filtered.map((c, i) => <CreatorCard key={c.id} c={c} index={i} onOpen={onOpenCreator} />)}
              {filtered.length === 0 && (
                <div className="a-empty">
                  <Label>No matches</Label>
                  <p>Nothing fits every filter. Try relaxing tier or platform.</p>
                </div>
              )}
            </div>
          ) : (
            <div className="a-list">
              <div className="a-list-head">
                <span></span><span></span><span>Name</span><span>Discipline</span><span>Location</span><span>Reach</span><span>Eng.</span><span>Tier</span><span></span>
              </div>
              {filtered.map((c, i) => <CreatorCard key={c.id} c={c} index={i} variant="list" onOpen={onOpenCreator} />)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { RosterScreen, Topbar });
