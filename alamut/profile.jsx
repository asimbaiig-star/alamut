// Creator Profile screen — editorial magazine layout.
// Relies on window globals: Icon, Label, Rule, Btn, Logo, KPI, fmt, ROSTER

function ProfileHero({ c, onBack }) {
  return (
    <section className="p-hero">
      <button className="p-back" onClick={onBack}>
        <Icon.arrowLeft s={14} /> <span>All creators</span>
      </button>
      <div className="p-hero-grid">
        <div className="p-hero-img">
          <img src={c.portrait.replace('w=900&h=1200', 'w=1200&h=1600')} alt={c.name} />
          <div className="p-hero-img-meta">
            <span>Nº {c.id.toUpperCase()}</span>
            <span>{c.city}, {c.country}</span>
          </div>
        </div>
        <div className="p-hero-text">
          <Label num={`PROFILE / ${c.id.toUpperCase()}`}>Represented by Alamut since {c.signed}</Label>
          <h1 className="p-name">{c.name}</h1>
          <div className="p-handle">@{c.handle} <Icon.dot /> {c.categories.join(' · ')}</div>
          <p className="p-tagline">{c.tagline}</p>
          <p className="p-bio">{c.bio}</p>
          <div className="p-hero-actions">
            <Btn variant="solid" icon={<Icon.arrow s={14} />}>Invite to campaign</Btn>
            <Btn variant="ghost" icon={<Icon.mail />}>Request media kit</Btn>
            <div style={{ marginLeft: 4 }}><ShortlistButton id={c.id} variant="text" /></div>
          </div>
          <div className="p-hero-kpis">
            <KPI label="Total reach" value={fmt(c.reach)} />
            <KPI label="Avg. engagement" value={c.engagement} unit="%" />
            <KPI label="Campaigns" value={c.campaigns} />
            <KPI label="Response" value={`<${c.responseHrs}`} unit="h" />
            <KPI label="Rating" value={c.rating} unit="/5" />
          </div>
        </div>
      </div>
    </section>
  );
}

function ProfilePlatforms({ c }) {
  return (
    <section className="p-section">
      <div className="p-section-head">
        <Label num="01">Platforms</Label>
        <h2 className="p-h2">Where {c.name.split(' ')[0]} publishes</h2>
      </div>
      <Rule />
      <div className="p-platforms">
        {c.platforms.map((p) => (
          <div className="p-platform" key={p.name}>
            <div className="p-platform-name">{p.name}</div>
            <div className="p-platform-handle">{p.handle}</div>
            <div className="p-platform-stats">
              <div><span>{fmt(p.followers)}</span><em>followers</em></div>
              <div><span>{p.engagement}%</span><em>engagement</em></div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function ProfileWork({ c }) {
  const [i, setI] = React.useState(0);
  return (
    <section className="p-section">
      <div className="p-section-head">
        <Label num="02">Selected work</Label>
        <h2 className="p-h2">A portfolio of recent campaigns and editorial</h2>
      </div>
      <Rule />
      <div className="p-work">
        <div className="p-work-main">
          <img src={c.work[i]} alt="" />
          <div className="p-work-capt">
            <span>Plate {String(i + 1).padStart(2, '0')} / {c.work.length}</span>
            <span>{c.primary} · {c.categories[0]}</span>
          </div>
        </div>
        <div className="p-work-thumbs">
          {c.work.map((w, idx) => (
            <button key={idx} className={'p-work-thumb' + (i === idx ? ' is-active' : '')}
              onClick={() => setI(idx)}>
              <img src={w} alt="" />
              <span>{String(idx + 1).padStart(2, '0')}</span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

function ProfileRateCard({ c }) {
  return (
    <section className="p-section">
      <div className="p-section-head">
        <Label num="03">Rate card</Label>
        <h2 className="p-h2">Pricing, negotiable through Alamut</h2>
      </div>
      <Rule />
      <div className="p-rate">
        <table className="p-rate-table">
          <thead>
            <tr>
              <th>Format</th>
              <th>Deliverable</th>
              <th style={{ textAlign: 'right' }}>Range (USD)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>01</td>
              <td>In-feed post, main platform</td>
              <td>${c.rateCard.post}</td>
            </tr>
            <tr>
              <td>02</td>
              <td>Reel / short-form video</td>
              <td>${c.rateCard.reel}</td>
            </tr>
            <tr>
              <td>03</td>
              <td>Story set (3 frames)</td>
              <td>${c.rateCard.story}</td>
            </tr>
            <tr>
              <td>04</td>
              <td>Integrated package (quarterly)</td>
              <td>on request</td>
            </tr>
          </tbody>
        </table>
        <aside className="p-rate-side">
          <Label>Terms</Label>
          <ul>
            <li>6-week exclusivity window, category-specific.</li>
            <li>First round of edits included; additional rounds at 15%.</li>
            <li>Usage rights sold separately in 3/6/12-month increments.</li>
            <li>Payment in 14 days via Alamut escrow.</li>
          </ul>
          <Btn variant="ghost" icon={<Icon.download />} size="sm">Full rate card (PDF)</Btn>
        </aside>
      </div>
    </section>
  );
}

function ProfileClients({ c }) {
  return (
    <section className="p-section">
      <div className="p-section-head">
        <Label num="04">Past partners</Label>
        <h2 className="p-h2">Brands {c.name.split(' ')[0]} has worked with</h2>
      </div>
      <Rule />
      <div className="p-clients">
        {c.clients.map((b) => (
          <div key={b} className="p-client">{b}</div>
        ))}
      </div>
      {c.press.length > 0 && (
        <>
          <div className="p-section-head" style={{ marginTop: 64 }}>
            <Label num="05">Press</Label>
            <h2 className="p-h2">Mentions and features</h2>
          </div>
          <Rule />
          <ul className="p-press">
            {c.press.map((p, i) => (
              <li key={i}>
                <span className="p-press-num">{String(i + 1).padStart(2, '0')}</span>
                <span className="p-press-pub">{p.pub}</span>
                <span className="p-press-title"><em>{p.title}</em></span>
                <span className="p-press-year">{p.year}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

function ProfileFoot({ c, onBack }) {
  // Adjacent creators in roster
  const idx = ROSTER.findIndex((r) => r.id === c.id);
  const prev = ROSTER[(idx - 1 + ROSTER.length) % ROSTER.length];
  const next = ROSTER[(idx + 1) % ROSTER.length];
  return (
    <section className="p-foot">
      <Rule />
      <div className="p-foot-grid">
        <button className="p-foot-nav" onClick={() => onBack(prev)}>
          <Label><Icon.arrowLeft s={12} /> Previous</Label>
          <div className="p-foot-name">{prev.name}</div>
          <div className="p-foot-sub">{prev.categories[0]} · {prev.city}</div>
        </button>
        <button className="p-foot-nav is-next" onClick={() => onBack(next)}>
          <Label style={{ justifyContent: 'flex-end' }}>Next <Icon.arrow s={12} /></Label>
          <div className="p-foot-name">{next.name}</div>
          <div className="p-foot-sub">{next.categories[0]} · {next.city}</div>
        </button>
      </div>
    </section>
  );
}

function ProfileScreen({ creator, onBack, onOpenCreator }) {
  React.useEffect(() => { window.scrollTo(0, 0); }, [creator?.id]);
  if (!creator) return null;
  return (
    <div className="a-profile">
      <ProfileHero c={creator} onBack={() => onBack(null)} />
      <ProfilePlatforms c={creator} />
      <ProfileWork c={creator} />
      <ProfileRateCard c={creator} />
      <ProfileClients c={creator} />
      <ProfileFoot c={creator} onBack={(nextC) => onOpenCreator(nextC)} />
    </div>
  );
}

Object.assign(window, { ProfileScreen });
