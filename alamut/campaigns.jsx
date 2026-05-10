// Campaigns — directory + detail. Shared surface: brand & public case-study view.

function CampaignStatusDot({ status }) {
  const color = {
    'Live': 'var(--accent)',
    'In production': 'oklch(0.55 0.10 200)',
    'Open for applications': 'oklch(0.58 0.11 120)',
    'Completed': 'var(--ink-40)',
  }[status] || 'var(--ink-40)';
  return <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: color, marginRight: 8, verticalAlign: 'middle' }} />;
}

function CampaignsScreen({ onOpenCampaign, onOpenBrief }) {
  const [discipline, setDiscipline] = React.useState('All');
  const [status, setStatus] = React.useState('All');

  const filtered = CAMPAIGNS.filter((c) => {
    if (discipline !== 'All' && c.discipline !== discipline) return false;
    if (status !== 'All' && c.status !== status) return false;
    return true;
  });

  const live = CAMPAIGNS.filter((c) => c.status === 'Live').length;
  const open = CAMPAIGNS.filter((c) => c.status === 'Open for applications').length;

  return (
    <div className="c-dir">
      <section className="c-dir-head">
        <Label num="CAMPAIGNS">Shared surface, Spring 2026</Label>
        <h1 className="a-display">
          Campaigns we've run,<br />
          and campaigns <em>we're running now.</em>
        </h1>
        <p className="a-lede">
          Every campaign on Alamut is managed end-to-end by one of our producers.
          Brands brief, creators apply or are invited, we handle the paperwork in between.
        </p>
        <div className="c-dir-meta">
          <div><span>{CAMPAIGNS.length}</span><em>total campaigns</em></div>
          <div><span>{live}</span><em>live now</em></div>
          <div><span>{open}</span><em>open to creators</em></div>
          <div><span>$108K</span><em>paid to creators '25</em></div>
        </div>
      </section>

      <Rule style={{ maxWidth: 1440, margin: '48px auto', padding: '0 48px' }} />

      <section className="c-dir-toolbar">
        <div className="c-dir-filters">
          <div className="c-dir-filter-group">
            <span>Discipline</span>
            {CAMPAIGN_DISCIPLINES.map((d) => (
              <button key={d} onClick={() => setDiscipline(d)}
                className={discipline === d ? 'is-on' : ''}>{d}</button>
            ))}
          </div>
          <div className="c-dir-filter-group">
            <span>Status</span>
            {CAMPAIGN_STATUSES.map((s) => (
              <button key={s} onClick={() => setStatus(s)}
                className={status === s ? 'is-on' : ''}>{s}</button>
            ))}
          </div>
        </div>
        <Btn variant="solid" size="sm" icon={<Icon.arrow s={14} />} onClick={onOpenBrief}>Open a campaign</Btn>
      </section>

      <section className="c-dir-grid">
        {filtered.map((c, i) => (
          <button key={c.id} className="c-dir-card" onClick={() => onOpenCampaign(c)}>
            <div className="c-dir-card-img">
              <img src={c.cover} alt="" />
              <div className="c-dir-card-badge"><CampaignStatusDot status={c.status} />{c.status}</div>
            </div>
            <div className="c-dir-card-body">
              <div className="c-dir-card-meta">
                <span>Nº {String(i + 1).padStart(2, '0')}</span>
                <span>{c.discipline} · {c.city}</span>
              </div>
              <h3 className="c-dir-card-title">{c.title}</h3>
              <div className="c-dir-card-brand">for {c.brand}</div>
              <div className="c-dir-card-foot">
                <span>{c.window}</span>
                <span>{c.creators.length || '—'} creators</span>
              </div>
            </div>
          </button>
        ))}
        {filtered.length === 0 && (
          <div className="a-empty" style={{ gridColumn: '1 / -1' }}>
            <Label>No campaigns match those filters</Label>
          </div>
        )}
      </section>
    </div>
  );
}

function CampaignDetail({ campaign, onBack, onOpenCreator }) {
  React.useEffect(() => { window.scrollTo(0, 0); }, [campaign?.id]);
  if (!campaign) return null;
  const creators = campaign.creators.map((id) => ROSTER.find((r) => r.id === id)).filter(Boolean);

  return (
    <div className="c-det">
      <button className="p-back" onClick={onBack} style={{ maxWidth: 1440, margin: '0 auto', padding: '48px 48px 0', display: 'block' }}>
        <Icon.arrowLeft s={14} /> <span>All campaigns</span>
      </button>

      <section className="c-det-hero">
        <div className="c-det-hero-img">
          <img src={campaign.cover} alt="" />
        </div>
        <div className="c-det-hero-body">
          <Label num={campaign.id.toUpperCase()}>
            <CampaignStatusDot status={campaign.status} />{campaign.status} · {campaign.year}
          </Label>
          <h1 className="c-det-title">{campaign.title}</h1>
          <div className="c-det-brand">for <strong>{campaign.brand}</strong> · {campaign.discipline} · {campaign.city}</div>
          <p className="c-det-brief">{campaign.brief}</p>
          <div className="c-det-key">
            <KPI label="Budget" value={campaign.budget} />
            <KPI label="Window" value={campaign.window.split(',')[0]} />
            <KPI label="Deliverables" value={campaign.deliverables.length} />
            <KPI label="Creators" value={campaign.creators.length || '—'} />
          </div>
        </div>
      </section>

      <section className="p-section">
        <div className="p-section-head">
          <Label num="01">Timeline</Label>
          <h2 className="p-h2">Where the campaign is right now</h2>
        </div>
        <Rule />
        <div className="c-det-timeline">
          {campaign.milestones.map((m, i) => (
            <div key={i} className={'c-det-milestone' + (m.done ? ' is-done' : '') + (m.current ? ' is-current' : '')}>
              <div className="c-det-milestone-dot" />
              <div className="c-det-milestone-date">{m.d}</div>
              <div className="c-det-milestone-label">{m.t}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="p-section">
        <div className="p-section-head">
          <Label num="02">Deliverables</Label>
          <h2 className="p-h2">What the creators are making</h2>
        </div>
        <Rule />
        <ul className="c-det-deliv">
          {campaign.deliverables.map((d, i) => (
            <li key={i}>
              <span className="c-det-deliv-num">{String(i + 1).padStart(2, '0')}</span>
              <span className="c-det-deliv-t">{d}</span>
            </li>
          ))}
        </ul>
      </section>

      {creators.length > 0 && (
        <section className="p-section">
          <div className="p-section-head">
            <Label num="03">Creators</Label>
            <h2 className="p-h2">On this campaign</h2>
          </div>
          <Rule />
          <div className="c-det-creators">
            {creators.map((c) => (
              <button key={c.id} className="c-det-creator" onClick={() => onOpenCreator(c)}>
                <img src={c.portrait} alt="" />
                <div>
                  <div className="c-det-creator-name">{c.name}</div>
                  <div className="c-det-creator-sub">{c.categories[0]} · {fmt(c.reach)} reach</div>
                </div>
                <Icon.arrow s={14} />
              </button>
            ))}
          </div>
        </section>
      )}

      {campaign.results.length > 0 && (
        <section className="p-section">
          <div className="p-section-head">
            <Label num="04">Results</Label>
            <h2 className="p-h2">What the numbers looked like</h2>
          </div>
          <Rule />
          <div className="c-det-results">
            {campaign.results.map((r) => (
              <div key={r.k} className="c-det-result">
                <div className="c-det-result-v">{r.v}</div>
                <div className="c-det-result-k">{r.k}</div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

Object.assign(window, { CampaignsScreen, CampaignDetail });
