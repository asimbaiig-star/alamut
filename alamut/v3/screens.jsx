// Stub screens — placeholder layouts so the router never crashes; we'll flesh out one by one.

function PageHead({ num, label, title, lede, actions, children }) {
  return (
    <div className="v3-page-head">
      <div>
        <Label num={num}>{label}</Label>
        <h1 className="v3-page-h1">{title}</h1>
        {lede && <p className="v3-page-lede">{lede}</p>}
        {children}
      </div>
      {actions && <div className="v3-page-head-actions">{actions}</div>}
    </div>
  );
}

function StubPage({ num, label, title, lede }) {
  return (
    <div className="v3-page">
      <PageHead num={num} label={label} title={title} lede={lede} />
      <div className="v3-empty">
        <div className="v3-empty-h">Coming next</div>
        <div className="v3-empty-d">This screen is part of the redesign and will be filled in next pass.</div>
      </div>
    </div>
  );
}

// === Creator screens ===

function CreatorDiscover({ onNav }) {
  const live = V3_CAMPAIGNS.filter(c => ['live','shortlist'].includes(c.stage));
  return (
    <div className="v3-page">
      <PageHead num="C · 02" label="Discover" title={<>Live <em>campaigns</em>.</>} lede="Apply to briefs from vetted brands. Filter by category, region, or budget — only 100% of the budget reaches you." />
      <div className="v3-pipe-toolbar">
        <div className="v3-tabs">
          <button className="v3-tab is-on">All</button>
          <button className="v3-tab">Food</button>
          <button className="v3-tab">Fashion</button>
          <button className="v3-tab">Travel</button>
          <button className="v3-tab">Design</button>
        </div>
        <div className="v3-search"><Icon.search s={14} /><input placeholder="Search briefs, brands…" /></div>
      </div>
      <div className="v3-disc-grid">
        {live.concat(V3_CAMPAIGNS.filter(c => c.stage === 'offer')).map(c => {
          const brand = V3_BRANDS.find(b => b.id === c.brandId);
          return (
            <div key={c.id} className="v3-disc-card" onClick={() => onNav('creator-campaigns')}>
              <div className="v3-disc-h">
                <div>
                  <div className="v3-disc-brand">{brand?.name} · {brand?.industry}</div>
                  <div className="v3-disc-title">{c.title}</div>
                </div>
                <span className={'v3-stage v3-stage-' + c.stage}>{STAGE_LABEL[c.stage]}</span>
              </div>
              <div className="v3-disc-pitch">{c.pitch}</div>
              <div className="v3-disc-meta">
                <div><div className="v3-disc-k">Budget</div><div className="v3-disc-v">{$fmt(c.budget)}</div></div>
                <div><div className="v3-disc-k">Region</div><div className="v3-disc-v">{c.region}</div></div>
                <div><div className="v3-disc-k">Apply by</div><div className="v3-disc-v">{c.deadline}</div></div>
                <div><div className="v3-disc-k">Applicants</div><div className="v3-disc-v">{c.appsCount}</div></div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CampaignKanban({ campaigns, onSelect }) {
  const byStage = Object.fromEntries(STAGES.map(s => [s.id, []]));
  campaigns.forEach(c => { (byStage[c.stage] = byStage[c.stage] || []).push(c); });
  return (
    <div className="v3-kanban">
      {STAGES.map(s => (
        <div key={s.id} className="v3-kanban-col">
          <div className={'v3-kanban-col-h tone-' + s.tone}>
            <span className="v3-kanban-col-name">{s.label}</span>
            <span className="v3-kanban-col-count">{byStage[s.id].length}</span>
          </div>
          <div className="v3-kanban-cards">
            {byStage[s.id].map(c => {
              const brand = V3_BRANDS.find(b => b.id === c.brandId);
              return (
                <button key={c.id} className="v3-kcard" onClick={() => onSelect && onSelect(c)}>
                  <div className="v3-kcard-meta">
                    <span>{brand?.name}</span>
                    <span>{c.region}</span>
                  </div>
                  <div className="v3-kcard-title">{c.title}</div>
                  <div className="v3-kcard-foot">
                    <span className={'v3-kcard-due' + (c.deadline === 'Today' || c.deadline === 'Tomorrow' ? ' is-due' : '')}>Due {c.deadline}</span>
                    <span className="v3-kcard-amt">{$fmt(c.budget)}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function CreatorCampaigns({ onNav }) {
  const me = ROSTER[0];
  const myCamps = V3_CAMPAIGNS.filter(c => c.creators.includes(me.id) || c.stage === 'offer');
  const [tab, setTab] = React.useState('active');
  const filtered = tab === 'active' ? myCamps.filter(c => !['closed','reporting'].includes(c.stage))
                 : tab === 'closed' ? myCamps.filter(c => ['closed','reporting','posted'].includes(c.stage))
                 : myCamps;
  return (
    <div className="v3-page">
      <PageHead num="C · 03" label="My campaigns" title={<>Pipeline.</>} lede="Every campaign you're part of, plotted across the Alamut lifecycle." />
      <div className="v3-pipe-toolbar">
        <div className="v3-pipe-tabs">
          <button className={tab==='all'?'is-on':''} onClick={() => setTab('all')}>All ({myCamps.length})</button>
          <button className={tab==='active'?'is-on':''} onClick={() => setTab('active')}>Active</button>
          <button className={tab==='closed'?'is-on':''} onClick={() => setTab('closed')}>Closed / Posted</button>
        </div>
        <div className="v3-search"><Icon.search s={14} /><input placeholder="Find a campaign…" /></div>
      </div>
      <CampaignKanban campaigns={filtered} onSelect={() => onNav('creator-content')} />
    </div>
  );
}

function CreatorContent({ onNav }) {
  const camp = V3_CAMPAIGNS[0]; // Spring Renewal
  const brand = V3_BRANDS.find(b => b.id === camp.brandId);
  const steps = [
    { name: 'Invitation sent', detail: 'Brief shared by Aesop', time: 'Apr 02', state: 'done' },
    { name: 'Accepted', detail: 'Offer accepted at $1,800', time: 'Apr 03', state: 'done' },
    { name: 'Brief reviewed', detail: 'You confirmed scope and timeline', time: 'Apr 04', state: 'done' },
    { name: 'Draft 1 submitted', detail: 'Reel + 2 stills', time: 'Apr 09', state: 'done' },
    { name: 'Revision requested', detail: '1 note on second still — repositioned candle', time: 'Apr 10', state: 'current' },
    { name: 'Final approval', detail: 'Pending brand sign-off', time: '—', state: 'pending' },
    { name: 'Posted', detail: 'Goes live on your channels', time: '—', state: 'pending' },
    { name: 'Performance pulled', detail: 'Reach + engagement reported', time: '—', state: 'pending' },
    { name: 'Payout released', detail: '$1,800 — escrow → bank', time: '—', state: 'pending' },
  ];
  return (
    <div className="v3-page">
      <PageHead num="C · 04" label="Content" title={<><em>{camp.title}</em></>} lede={`${brand?.name} · Reel + 2 stories · Due ${camp.deadline}.`} />

      <div className="v3-card" style={{ marginBottom: 24 }}>
        <div className="v3-card-h"><span className="v3-card-title">Deliverables tracker</span></div>
        <div style={{ padding: '6px 22px 22px' }}>
          <div className="v3-tracker">
            {steps.map((s, i) => (
              <div key={i} className={'v3-track-row ' + (s.state === 'done' ? 'is-done' : s.state === 'current' ? 'is-current' : '')}>
                <div className="v3-track-bullet">{s.state === 'done' ? <Icon.check s={12} /> : i+1}</div>
                <div className="v3-track-name">{s.name}</div>
                <div className="v3-track-detail">{s.detail}</div>
                <div className="v3-track-time">{s.time}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="v3-card">
        <div className="v3-card-h">
          <span className="v3-card-title">Submissions · Round 2</span>
          <button className="v3-card-link">Upload new draft</button>
        </div>
        <div style={{ padding: 22 }}>
          <div className="v3-sub-block">
            <div className="v3-sub-h">
              <div>
                <div className="v3-sub-name">Reel — Take 2</div>
                <div className="v3-mono-time">Uploaded 2h ago · 0:34 · 1080×1920</div>
              </div>
              <span className="v3-stage v3-stage-production">In review</span>
            </div>
            <div className="v3-sub-files">
              <div className="v3-sub-file has-img" style={{ backgroundImage: `url(${camp.cover})` }}>Reel.mp4</div>
              <div className="v3-sub-file has-img" style={{ backgroundImage: 'url(https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=400&h=400&fit=crop)' }}>Still 01</div>
              <div className="v3-sub-file has-img" style={{ backgroundImage: 'url(https://images.unsplash.com/photo-1509631179647-0177331693ae?w=400&h=400&fit=crop)' }}>Still 02</div>
            </div>
            <div className="v3-revision">
              <div className="v3-rev-item">
                <div className="v3-rev-av">A</div>
                <div className="v3-rev-body">
                  <div className="v3-rev-meta"><span className="v3-rev-name">Aesop · Hannah</span><span className="v3-rev-time">Apr 10 · 2h ago</span></div>
                  <div className="v3-rev-text">Looking great overall — one tiny note on the second still: can we shift the candle ~6 inches further from the window? The harsh shadow is competing with the label. Everything else, ship it 🙌</div>
                </div>
              </div>
              <div className="v3-rev-item">
                <div className="v3-rev-av">S</div>
                <div className="v3-rev-body">
                  <div className="v3-rev-meta"><span className="v3-rev-name">You</span><span className="v3-rev-time">Apr 10 · 1h ago</span></div>
                  <div className="v3-rev-text">Got it — re-shooting Still 02 tonight, will have v2 by tomorrow am.</div>
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 12, borderTop: '1px solid var(--rule)' }}>
              <Btn variant="ghost" size="sm">Reply to feedback</Btn>
              <Btn variant="solid" size="sm" icon={<Icon.arrow s={12} />}>Upload v2</Btn>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ChatScreen({ threads, num, label, title, lede }) {
  const [active, setActive] = React.useState(threads[0].id);
  const t = threads.find(x => x.id === active) || threads[0];
  const msgs = t.msgs || [{ from: 'them', text: t.last, t: t.time }];
  return (
    <div className="v3-page">
      <PageHead num={num} label={label} title={title} lede={lede} />
      <div className="v3-inbox">
        <div className="v3-inbox-list">
          <div className="v3-inbox-search">
            <div className="v3-search" style={{ minWidth: 0, width: '100%' }}>
              <Icon.search s={14} /><input placeholder="Search conversations…" />
            </div>
          </div>
          <div className="v3-inbox-threads">
            {threads.map(th => (
              <button key={th.id} className={'v3-inbox-thread' + (th.id === active ? ' is-on' : '')} onClick={() => setActive(th.id)}>
                <div className="v3-inbox-av">{th.who.slice(0,1)}</div>
                <div style={{ minWidth: 0 }}>
                  <div className="v3-msg-row">
                    <span className="v3-msg-name">{th.who}</span>
                    <span className="v3-msg-time">{th.time}</span>
                  </div>
                  <div className="v3-msg-line"><strong style={{ color: 'var(--ink-80)', fontWeight: 500 }}>{th.sub}</strong> · {th.last}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
        <div className="v3-inbox-detail">
          <div className="v3-inbox-head">
            <div>
              <div className="v3-inbox-thread-h">{t.who}</div>
              <div className="v3-inbox-meta">{t.sub}</div>
            </div>
            <Btn variant="ghost" size="sm">View campaign →</Btn>
          </div>
          <div className="v3-inbox-body">
            {msgs.map((m, i) => (
              <div key={i} className={'v3-bubble' + (m.from === 'me' ? ' from-me' : '')}>
                <div>{m.text}</div>
                <div className="v3-bubble-time">{m.t}</div>
              </div>
            ))}
          </div>
          <div className="v3-inbox-compose">
            <textarea placeholder="Write a message…"></textarea>
            <Btn variant="solid" size="sm" icon={<Icon.arrow s={12} />}>Send</Btn>
          </div>
        </div>
      </div>
    </div>
  );
}

function CreatorInbox() {
  return <ChatScreen threads={V3_THREADS_CREATOR} num="C · 05" label="Inbox" title={<>Conversations.</>} lede="Every brand thread — keyed to a campaign, not just a DM." />;
}

function CreatorEarnings() {
  return (
    <div className="v3-page">
      <PageHead num="C · 06" label="Earnings" title={<>The <em>money</em> view.</>} lede="Escrow + invoice payouts in one ledger. Auto-reconciled with each campaign." actions={<Btn variant="ghost" icon={<Icon.download />}>Export CSV</Btn>} />

      <div className="v3-earn-hero">
        <div><div className="v3-earn-k">This month</div><div className="v3-earn-v">$4,200</div><div className="v3-earn-h">Apr · 2 cleared</div></div>
        <div><div className="v3-earn-k">Pending</div><div className="v3-earn-v">$3,400</div><div className="v3-earn-h">3 in escrow</div></div>
        <div><div className="v3-earn-k">YTD</div><div className="v3-earn-v">$18,200</div><div className="v3-earn-h">2026</div></div>
        <div><div className="v3-earn-k">Lifetime</div><div className="v3-earn-v">$47,800</div><div className="v3-earn-h">Since 2021</div></div>
      </div>

      <div className="v3-card">
        <div className="v3-card-h"><span className="v3-card-title">Transactions</span></div>
        <div style={{ padding: '0 22px 22px' }}>
          <table className="v3-earn-tx">
            <thead><tr><th>Date</th><th>Campaign</th><th>Type</th><th>Status</th><th>Amount</th></tr></thead>
            <tbody>
              {V3_TX_CREATOR.map(t => (
                <tr key={t.id}>
                  <td className="d-pay-date">{t.date}</td>
                  <td>
                    <div className="v3-earn-tx-camp">{t.camp}</div>
                    <div className="v3-earn-tx-brand">{t.brand}</div>
                  </td>
                  <td><span className="v3-num-pill">{t.type}</span></td>
                  <td><span className={`d-pay-status d-pay-${t.status}`}>{t.status}</span></td>
                  <td>${t.amt.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function CreatorAnalytics() {
  return (
    <div className="v3-page">
      <PageHead num="C · 07" label="Analytics" title={<>Performance.</>} lede="Your reach, engagement, and campaign completion across all channels — pulled fresh." />
      <div className="v3-perf" style={{ border: '1px solid var(--rule)', borderTop: '1px solid var(--ink)', marginBottom: 24 }}>
        <div><div className="v3-perf-k">Total reach · 30d</div><div className="v3-perf-v">1.4<span className="u">M</span></div><div className="v3-perf-d up">↑ 12%</div></div>
        <div><div className="v3-perf-k">Avg engagement</div><div className="v3-perf-v">5.2<span className="u">%</span></div><div className="v3-perf-d up">↑ 0.4 pts</div></div>
        <div><div className="v3-perf-k">Completion</div><div className="v3-perf-v">98<span className="u">%</span></div><div className="v3-perf-d">9 of 9</div></div>
        <div><div className="v3-perf-k">Avg response</div><div className="v3-perf-v">3<span className="u">h</span></div><div className="v3-perf-d up">↑ 1h</div></div>
      </div>
      <div className="v3-card">
        <div className="v3-card-h"><span className="v3-card-title">Reach by month</span></div>
        <div style={{ padding: 22 }}><ChartLine /></div>
      </div>
    </div>
  );
}

function CreatorProfileEdit() {
  return (
    <div className="v3-page">
      <PageHead num="C · 08" label="Profile" title={<>Public profile.</>} lede="What brands see when they shortlist you. Self-reported metrics flagged until verified by the Alamut team." actions={<Btn variant="ghost" icon={<Icon.arrow s={14} />}>Preview as brand</Btn>} />
      <CreatorOnboardingForm />
    </div>
  );
}

function CreatorOnboardingForm() {
  const sections = [
    { num: 'A · 01', title: 'Identity', d: 'Legal + public-facing names, location, languages.' },
    { num: 'A · 02', title: 'Audience & platforms', d: 'Connect channels — we pull metrics live where APIs exist; the rest is self-reported & flagged for admin verification.' },
    { num: 'A · 03', title: 'Categories & content style', d: 'What you create, in your own words.' },
    { num: 'A · 04', title: 'Portfolio', d: 'Up to 12 work samples — links or uploads.' },
    { num: 'A · 05', title: 'Rate card', d: 'Range per deliverable type. Keeps brands from low-balling.' },
    { num: 'A · 06', title: 'Verification', d: 'ID upload + tax / payout details (encrypted, not visible to brands).' },
  ];
  return (
    <div className="v3-onb-shell">
      <div className="v3-onb-toc">
        {sections.map((s, i) => (
          <button key={s.num} className={'v3-onb-toc-item' + (i < 5 ? ' is-done' : i === 5 ? ' is-on' : '')}>{s.title}</button>
        ))}
      </div>
      <div className="v3-onb-body">
        {sections.map(s => (
          <section className="v3-onb-section" key={s.num}>
            <div className="v3-onb-section-h">
              <div>
                <div className="v3-onb-section-num">{s.num}</div>
                <h2 className="v3-onb-section-t">{s.title}</h2>
                <p className="v3-onb-section-d">{s.d}</p>
              </div>
            </div>
            {s.title === 'Identity' && (
              <div className="b-grid">
                <div className="v3-uploader" style={{ gridColumn: 'span 2' }}>
                  <div className="v3-upload-frame"><img src={ROSTER[0].portrait} alt="" /></div>
                  <div className="v3-upload-help">Square image, min 800×800. JPG or PNG. Used on your public profile.</div>
                </div>
                <div className="b-field"><label className="b-field-label">Public name</label><input defaultValue="Sarah Johnson" /></div>
                <div className="b-field"><label className="b-field-label">Handle</label><input defaultValue="@sarahstyle" /></div>
                <div className="b-field"><label className="b-field-label">City</label><input defaultValue="New York" /></div>
                <div className="b-field"><label className="b-field-label">Country</label><input defaultValue="USA" /></div>
                <div className="b-field" style={{ gridColumn: 'span 2' }}><label className="b-field-label">Tagline</label><input defaultValue="Sustainable fashion & conscious living." /></div>
                <div className="b-field" style={{ gridColumn: 'span 2' }}><label className="b-field-label">Bio</label><textarea defaultValue="Editor-turned-creator building a community around quiet luxury, slow fashion, and things worth keeping." /></div>
              </div>
            )}
            {s.title === 'Audience & platforms' && (
              <table className="b-apply-platforms">
                <thead><tr><th>Platform</th><th>Handle</th><th>Followers</th><th>Engagement %</th><th>Status</th></tr></thead>
                <tbody>
                  {ROSTER[0].platforms.map(p => (
                    <tr key={p.name}>
                      <td className="b-apply-plat-name">{p.name}</td>
                      <td><input defaultValue={p.handle} /></td>
                      <td><input defaultValue={p.followers.toLocaleString()} /></td>
                      <td><input defaultValue={p.engagement} /></td>
                      <td><span className="d-pay-status d-pay-paid">Verified</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {s.title === 'Categories & content style' && (
              <div className="b-grid">
                <div className="b-chips-group">
                  <label className="b-field-label">Categories (select up to 3)</label>
                  <div className="b-chips">
                    {['Fashion','Lifestyle','Sustainability','Travel','Beauty','Food','Design','Wellness'].map(c => (
                      <button key={c} className={'b-chip' + (['Fashion','Lifestyle','Sustainability'].includes(c) ? ' is-on' : '')}>{c}</button>
                    ))}
                  </div>
                </div>
              </div>
            )}
            {s.title === 'Portfolio' && (
              <div className="v3-sub-files" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
                {ROSTER[0].work.map((w, i) => (
                  <div key={i} className="v3-sub-file has-img" style={{ backgroundImage: `url(${w})` }}>0{i+1}</div>
                ))}
              </div>
            )}
            {s.title === 'Rate card' && (
              <div className="b-grid">
                <div className="b-field"><label className="b-field-label">Post (USD)</label><input defaultValue="800–1,500" /></div>
                <div className="b-field"><label className="b-field-label">Reel (USD)</label><input defaultValue="1,000–2,000" /></div>
                <div className="b-field"><label className="b-field-label">Story (USD)</label><input defaultValue="300–600" /></div>
                <div className="b-field"><label className="b-field-label">Long-form / YouTube (USD)</label><input defaultValue="—" /></div>
              </div>
            )}
            {s.title === 'Verification' && (
              <div className="b-grid">
                <div className="b-field"><label className="b-field-label">Government ID</label><input placeholder="Upload (encrypted)" /></div>
                <div className="b-field"><label className="b-field-label">W-9 / equivalent tax form</label><input placeholder="Pending" /></div>
                <div className="b-field"><label className="b-field-label">Payout method</label><input defaultValue="ACH · Chase ••• 4421" /></div>
                <div className="b-field"><label className="b-field-label">Currency</label><input defaultValue="USD" /></div>
              </div>
            )}
          </section>
        ))}
        <div className="b-foot">
          <button className="b-back">Save draft</button>
          <Btn variant="solid" icon={<Icon.arrow s={14} />}>Submit for verification</Btn>
        </div>
      </div>
    </div>
  );
}

// === Brand screens ===

function BrandCampaigns({ onNav }) {
  const [tab, setTab] = React.useState('all');
  const filt = tab === 'all' ? V3_CAMPAIGNS
            : tab === 'active' ? V3_CAMPAIGNS.filter(c => !['draft','closed'].includes(c.stage))
            : V3_CAMPAIGNS.filter(c => c.stage === 'draft' || c.stage === 'closed');
  return (
    <div className="v3-page">
      <PageHead num="B · 02" label="Campaigns" title={<>Campaign <em>pipeline</em>.</>} lede="Every brief, plotted across the eight-stage Alamut lifecycle. Click any card to open the brief, brief the team, or release escrow." actions={<Btn variant="solid" icon={<Icon.plus s={14} />}>New campaign</Btn>} />
      <div className="v3-pipe-toolbar">
        <div className="v3-pipe-tabs">
          <button className={tab==='all'?'is-on':''} onClick={() => setTab('all')}>All ({V3_CAMPAIGNS.length})</button>
          <button className={tab==='active'?'is-on':''} onClick={() => setTab('active')}>Active</button>
          <button className={tab==='archive'?'is-on':''} onClick={() => setTab('archive')}>Drafts + Closed</button>
        </div>
        <div className="v3-search"><Icon.search s={14} /><input placeholder="Find a campaign…" /></div>
      </div>
      <CampaignKanban campaigns={filt} onSelect={() => onNav('brand-approvals')} />
    </div>
  );
}

function BrandDiscover({ onNav }) {
  const [picked, setPicked] = React.useState({});
  const togglePick = (id) => setPicked(p => ({ ...p, [id]: !p[id] }));
  const count = Object.values(picked).filter(Boolean).length;
  return (
    <div className="v3-page">
      <PageHead num="B · 03" label="Find creators" title={<>Roster.</>} lede="Search by category, region, platform, audience size, language, or engagement band — then shortlist." actions={<Btn variant="ghost" icon={<Icon.spark s={14} />}>AI Match</Btn>} />
      <div className="v3-pipe-toolbar">
        <div className="v3-tabs">
          <button className="v3-tab is-on">All</button>
          <button className="v3-tab">Verified</button>
          <button className="v3-tab">Flagship</button>
          <button className="v3-tab">Rising</button>
          <button className="v3-tab">Specialist</button>
        </div>
        <div className="v3-search"><Icon.search s={14} /><input placeholder="Name, category, region…" /></div>
      </div>
      {count > 0 && (
        <div className="v3-batch">
          <span className="v3-batch-count">{count} selected</span>
          <div className="v3-batch-actions">
            <Btn variant="ghost" size="sm">Save shortlist</Btn>
            <Btn variant="solid" size="sm" icon={<Icon.arrow s={12} />}>Invite to campaign</Btn>
          </div>
        </div>
      )}
      <div className="v3-disc-grid">
        {ROSTER.map(c => (
          <div key={c.id} className="v3-disc-card">
            <div className="v3-disc-h">
              <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                <img src={c.portrait} style={{ width: 56, height: 72, objectFit: 'cover' }} alt="" />
                <div>
                  <div className="v3-disc-brand">{c.handle.toUpperCase()} · {c.city}</div>
                  <div className="v3-disc-title" style={{ marginTop: 4 }}>{c.name}</div>
                </div>
              </div>
              <button className={'v3-inv-mini-btn' + (picked[c.id] ? ' solid' : '')} onClick={() => togglePick(c.id)}>{picked[c.id] ? '✓ Picked' : '+ Add'}</button>
            </div>
            <div className="v3-disc-pitch">{c.tagline}</div>
            <div className="v3-disc-meta">
              <div><div className="v3-disc-k">Reach</div><div className="v3-disc-v">{fmt(c.reach)}</div></div>
              <div><div className="v3-disc-k">Engagement</div><div className="v3-disc-v">{c.engagement}%</div></div>
              <div><div className="v3-disc-k">Rating</div><div className="v3-disc-v">{c.rating}</div></div>
              <div><div className="v3-disc-k">Tier</div><div className="v3-disc-v">{c.tier}</div></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function BrandApprovals({ onNav }) {
  return (
    <div className="v3-page">
      <PageHead num="B · 04" label="Approvals" title={<>Drafts to <em>review</em>.</>} lede="Approve, request revisions, or release escrow — every action is auto-logged for the campaign timeline." />
      <div className="v3-approvals">
        {V3_APPROVALS.map(a => {
          const creator = ROSTER.find(r => r.id === a.creatorId);
          const camp = V3_CAMPAIGNS.find(c => c.id === a.campaignId);
          return (
            <div key={a.id} className="v3-approval">
              <img className="v3-approval-img" src={a.img} alt="" />
              <div>
                <div className="v3-approval-name">{creator?.name} · {a.name}</div>
                <div className="v3-approval-camp">{camp?.title} · Round {a.round}</div>
                <div className="v3-approval-due">Due {a.due} · 2 stills + 1 reel</div>
              </div>
              <div className="v3-approval-actions">
                <button className="v3-inv-mini-btn">Request revision</button>
                <Btn variant="ghost" size="sm">Open</Btn>
                <Btn variant="solid" size="sm" icon={<Icon.check s={12} />}>Approve & pay</Btn>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BrandInbox() {
  return <ChatScreen threads={V3_THREADS_BRAND} num="B · 05" label="Inbox" title={<>Conversations.</>} lede="Threaded by creator and campaign. Auto-archived once a campaign closes." />;
}

function BrandWallet() {
  return (
    <div className="v3-page">
      <PageHead num="B · 06" label="Wallet" title={<><em>Wallet</em> & escrow.</>} lede="Top up once, fund campaigns from the same balance. Big campaigns sit in escrow; small ones release on invoice." actions={<Btn variant="solid" icon={<Icon.plus s={14} />}>Top up</Btn>} />

      <div className="v3-wallet-hero" style={{ marginBottom: 24 }}>
        <div>
          <div className="v3-wallet-balance-k">Available balance</div>
          <div className="v3-wallet-balance-v">$48,200<span className="u">USD</span></div>
          <div className="v3-mono-time">Across all campaigns · cleared funds</div>
          <div className="v3-wallet-actions">
            <Btn variant="ghost" size="sm">Top up</Btn>
            <Btn variant="ghost" size="sm">Withdraw</Btn>
            <Btn variant="ghost" size="sm">Auto-fund settings</Btn>
          </div>
        </div>
        <div className="v3-wallet-allocations">
          <div className="v3-mono-time" style={{ marginBottom: 8 }}>In escrow</div>
          {V3_CAMPAIGNS.filter(c => c.spent > 0 || c.stage === 'production').slice(0,4).map(c => (
            <div key={c.id} className="v3-wallet-alloc-row">
              <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-80)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{c.title}</span>
              <span style={{ fontFamily: 'var(--serif)', fontSize: 18, fontWeight: 500 }}>${(c.budget - c.spent).toLocaleString()}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="v3-card">
        <div className="v3-card-h"><span className="v3-card-title">Transactions</span><button className="v3-card-link">Export →</button></div>
        <div style={{ padding: '0 22px 22px' }}>
          <table className="v3-earn-tx">
            <thead><tr><th>Date</th><th>Description</th><th>Type</th><th>Amount</th></tr></thead>
            <tbody>
              {V3_TX_BRAND.map(t => (
                <tr key={t.id}>
                  <td className="d-pay-date">{t.date}</td>
                  <td><div className="v3-earn-tx-camp">{t.label}</div></td>
                  <td><span className="v3-num-pill">{t.dir === 'in' ? 'Top-up' : 'Outbound'}</span></td>
                  <td style={{ color: t.dir === 'in' ? 'oklch(0.45 0.10 150)' : 'var(--ink)' }}>
                    {t.dir === 'in' ? '+' : '-'}${Math.abs(t.amt).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function BrandAnalytics() {
  return (
    <div className="v3-page">
      <PageHead num="B · 07" label="Analytics" title={<>Performance across <em>all</em> campaigns.</>} lede="Reach, engagement, cost-per-creator, completion rate — pulled fresh from connected channels and admin-verified posts." />
      <div className="v3-perf" style={{ border: '1px solid var(--rule)', borderTop: '1px solid var(--ink)', marginBottom: 24 }}>
        <div><div className="v3-perf-k">Total reach</div><div className="v3-perf-v">3.4<span className="u">M</span></div><div className="v3-perf-d up">↑ 28%</div></div>
        <div><div className="v3-perf-k">Engagement</div><div className="v3-perf-v">187<span className="u">k</span></div><div className="v3-perf-d up">↑ 14%</div></div>
        <div><div className="v3-perf-k">CPC avg</div><div className="v3-perf-v">$2.4<span className="u">k</span></div><div className="v3-perf-d down">↑ 6%</div></div>
        <div><div className="v3-perf-k">Completion</div><div className="v3-perf-v">94<span className="u">%</span></div><div className="v3-perf-d">15 of 16</div></div>
      </div>
      <div className="v3-card">
        <div className="v3-card-h"><span className="v3-card-title">Aggregate reach · 90 days</span></div>
        <div style={{ padding: 22 }}><ChartLine /></div>
      </div>
    </div>
  );
}

function BrandProfile() {
  return (
    <div className="v3-page">
      <PageHead num="B · 08" label="Company" title={<>Company profile.</>} lede="What creators see when you invite them. Verified status unlocks higher application volume." />
      <div className="v3-onb-shell">
        <div className="v3-onb-toc">
          {['Company','Billing','Preferences','Team','Verification'].map((s, i) => (
            <button key={s} className={'v3-onb-toc-item' + (i < 4 ? ' is-done' : ' is-on')}>{s}</button>
          ))}
        </div>
        <div className="v3-onb-body">
          <section className="v3-onb-section">
            <div className="v3-onb-section-h">
              <div>
                <div className="v3-onb-section-num">A · 01</div>
                <h2 className="v3-onb-section-t">Company</h2>
                <p className="v3-onb-section-d">Public-facing details creators will see in invites and briefs.</p>
              </div>
            </div>
            <div className="b-grid">
              <div className="b-field"><label className="b-field-label">Company name</label><input defaultValue="Aesop" /></div>
              <div className="b-field"><label className="b-field-label">Industry</label><input defaultValue="Beauty / Personal care" /></div>
              <div className="b-field"><label className="b-field-label">HQ</label><input defaultValue="Melbourne, AU" /></div>
              <div className="b-field"><label className="b-field-label">Website</label><input defaultValue="aesop.com" /></div>
              <div className="b-field" style={{ gridColumn: 'span 2' }}><label className="b-field-label">About</label><textarea defaultValue="Aesop has carefully curated a range of skin, hair and body care formulations." /></div>
            </div>
          </section>
          <section className="v3-onb-section">
            <div className="v3-onb-section-h"><div><div className="v3-onb-section-num">A · 02</div><h2 className="v3-onb-section-t">Preferences</h2><p className="v3-onb-section-d">Used to seed AI Match defaults — you can override per-campaign.</p></div></div>
            <div className="b-grid">
              <div className="b-chips-group">
                <label className="b-field-label">Preferred creator categories</label>
                <div className="b-chips">{['Lifestyle','Beauty','Wellness','Design','Interiors','Fashion','Food'].map(c => (
                  <button key={c} className={'b-chip' + (['Lifestyle','Beauty','Wellness','Design'].includes(c) ? ' is-on' : '')}>{c}</button>
                ))}</div>
              </div>
              <div className="b-chips-group">
                <label className="b-field-label">Preferred regions</label>
                <div className="b-chips">{['US','UK','EU','APAC','LATAM'].map(c => (
                  <button key={c} className={'b-chip' + (['US','UK','EU'].includes(c) ? ' is-on' : '')}>{c}</button>
                ))}</div>
              </div>
            </div>
          </section>
          <div className="b-foot">
            <button className="b-back">Save draft</button>
            <Btn variant="solid" icon={<Icon.arrow s={14} />}>Save changes</Btn>
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, {
  CreatorDiscover, CreatorCampaigns, CreatorContent, CreatorInbox, CreatorEarnings, CreatorAnalytics, CreatorProfileEdit,
  BrandCampaigns, BrandDiscover, BrandApprovals, BrandInbox, BrandWallet, BrandAnalytics, BrandProfile,
  PageHead, StubPage, CampaignKanban, ChatScreen,
});
