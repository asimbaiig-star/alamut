// Creator Dashboard — 7 widgets per requirements
function CreatorDashboard({ user, onNav }) {
  const me = user || ROSTER[0];
  const activeCamps = V3_CAMPAIGNS.filter(c => ['production','offer','posted'].includes(c.stage) && c.creators.includes(me.id)).slice(0,3);
  const recCamps = V3_RECOMMENDED.map(id => V3_CAMPAIGNS.find(c => c.id === id)).filter(Boolean);
  const earnings = { month: 4200, pending: 3400, lifetime: 47800 };

  return (
    <div className="v3-page">
      <div className="v3-page-head">
        <div>
          <Label num="C · 01">Dashboard</Label>
          <h1 className="v3-page-h1">Welcome back, <em>{me.name.split(' ')[0]}</em>.</h1>
          <p className="v3-page-lede">Two campaigns active, one draft due Friday, and a fresh invite from Le Creuset waiting for your call.</p>
        </div>
        <div className="v3-page-head-actions">
          <Btn variant="ghost" onClick={() => onNav('creator-discover')} icon={<Icon.arrow s={14} />}>Browse campaigns</Btn>
        </div>
      </div>

      {/* Earnings strip */}
      <div className="v3-card" style={{ marginBottom: 24 }}>
        <div className="v3-card-h">
          <span className="v3-card-title">Earnings</span>
          <button className="v3-card-link" onClick={() => onNav('creator-earnings')}>View all →</button>
        </div>
        <div className="v3-earn">
          <div>
            <div className="v3-earn-k">This month</div>
            <div className="v3-earn-v">${earnings.month.toLocaleString()}</div>
            <div className="v3-earn-h">Apr · 2 milestones cleared</div>
          </div>
          <div>
            <div className="v3-earn-k">Pending</div>
            <div className="v3-earn-v">${earnings.pending.toLocaleString()}</div>
            <div className="v3-earn-h">3 milestones in review</div>
          </div>
          <div>
            <div className="v3-earn-k">Lifetime</div>
            <div className="v3-earn-v">${earnings.lifetime.toLocaleString()}</div>
            <div className="v3-earn-h">Since Aug 2021</div>
          </div>
        </div>
      </div>

      <div className="v3-dash-grid">
        <div className="v3-dash-col">
          {/* Active campaigns */}
          <div className="v3-card">
            <div className="v3-card-h">
              <span className="v3-card-title">Active campaigns · next deliverables</span>
              <button className="v3-card-link" onClick={() => onNav('creator-campaigns')}>All →</button>
            </div>
            <div className="v3-row-list">
              {(activeCamps.length ? activeCamps : V3_CAMPAIGNS.slice(0,3)).map(c => {
                const brand = V3_BRANDS.find(b => b.id === c.brandId);
                return (
                  <button key={c.id} className="v3-camp-row" onClick={() => onNav('creator-campaigns')}>
                    <img className="v3-camp-row-img" src={c.cover} alt="" />
                    <div>
                      <div className="v3-camp-row-title">{c.title}</div>
                      <div className="v3-camp-row-meta">{brand?.name} · {c.deliverables}</div>
                    </div>
                    <div className="v3-camp-row-right">
                      <div className="v3-camp-row-due">Due {c.deadline}</div>
                      <div className="v3-camp-row-stage">{STAGE_LABEL[c.stage]}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Invites */}
          <div className="v3-card">
            <div className="v3-card-h">
              <span className="v3-card-title">New invites</span>
              <button className="v3-card-link">{V3_INVITES.length} pending</button>
            </div>
            <div className="v3-row-list">
              {V3_INVITES.map(iv => {
                const brand = V3_BRANDS.find(b => b.id === iv.brandId);
                return (
                  <div key={iv.id} className="v3-inv-mini">
                    <div className="v3-inv-mini-fit">{iv.fit}</div>
                    <div>
                      <div className="v3-inv-mini-name">{brand?.name}</div>
                      <div className="v3-inv-mini-meta">{iv.budget} · Reply by {iv.deadline}</div>
                    </div>
                    <div className="v3-inv-mini-actions">
                      <button className="v3-inv-mini-btn">Decline</button>
                      <button className="v3-inv-mini-btn solid">Accept</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Recommended */}
          <div className="v3-card">
            <div className="v3-card-h">
              <span className="v3-card-title">Recommended for you</span>
              <button className="v3-card-link" onClick={() => onNav('creator-discover')}>Discover →</button>
            </div>
            <div className="v3-rec-list">
              {recCamps.map(c => {
                const brand = V3_BRANDS.find(b => b.id === c.brandId);
                return (
                  <button key={c.id} className="v3-rec" onClick={() => onNav('creator-discover')}>
                    <div className="v3-rec-logo" style={{ color: brand?.tone }}>{brand?.mark}</div>
                    <div>
                      <div className="v3-rec-title">{c.title}</div>
                      <div className="v3-rec-meta">{brand?.name} · {c.region} · Apply by {c.deadline}</div>
                    </div>
                    <div>
                      <div className="v3-rec-budget">{$fmt(c.budget)}</div>
                      <div className="v3-rec-fit">96% match</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="v3-dash-col">
          {/* Profile completion */}
          <div className="v3-card">
            <div className="v3-card-h">
              <span className="v3-card-title">Profile · Verification</span>
              <button className="v3-card-link" onClick={() => onNav('creator-profile')}>Edit →</button>
            </div>
            <div className="v3-completion">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <div className="v3-completion-pct">82%</div>
                <div className="v3-mono-time">5 of 6 sections done</div>
              </div>
              <div className="v3-completion-bar"><div className="v3-completion-bar-fill" style={{ width: '82%' }} /></div>
              <div className="v3-completion-row done"><span>Identity verified</span><span>✓</span></div>
              <div className="v3-completion-row done"><span>Audience metrics</span><span>✓</span></div>
              <div className="v3-completion-row done"><span>Rate card</span><span>✓</span></div>
              <div className="v3-completion-row done"><span>Portfolio · 4 pieces</span><span>✓</span></div>
              <div className="v3-completion-row done"><span>Bank details</span><span>✓</span></div>
              <div className="v3-completion-row"><span>Tax forms</span><span>Pending</span></div>
            </div>
          </div>

          {/* Inbox preview */}
          <div className="v3-card">
            <div className="v3-card-h">
              <span className="v3-card-title">Inbox</span>
              <button className="v3-card-link" onClick={() => onNav('creator-inbox')}>Open →</button>
            </div>
            <div className="v3-row-list">
              {V3_THREADS_CREATOR.slice(0,4).map(t => (
                <button key={t.id} className="v3-msg" onClick={() => onNav('creator-inbox')}>
                  <div className="v3-msg-av">{t.who.slice(0,1)}</div>
                  <div style={{ minWidth: 0 }}>
                    <div className="v3-msg-row">
                      <span className="v3-msg-name">{t.who}</span>
                      <span className="v3-msg-time">{t.time}</span>
                    </div>
                    <div className="v3-msg-line">{t.last}</div>
                  </div>
                  {t.unread && <div className="v3-msg-dot" />}
                </button>
              ))}
            </div>
          </div>

          {/* Performance snapshot */}
          <div className="v3-card">
            <div className="v3-card-h">
              <span className="v3-card-title">Performance · Last 30 days</span>
              <button className="v3-card-link" onClick={() => onNav('creator-analytics')}>Details →</button>
            </div>
            <div className="v3-perf">
              <div><div className="v3-perf-k">Reach</div><div className="v3-perf-v">1.4<span className="u">M</span></div><div className="v3-perf-d up">↑ 12% vs prev</div></div>
              <div><div className="v3-perf-k">Engagement</div><div className="v3-perf-v">5.2<span className="u">%</span></div><div className="v3-perf-d up">↑ 0.4 pts</div></div>
              <div><div className="v3-perf-k">Completion</div><div className="v3-perf-v">98<span className="u">%</span></div><div className="v3-perf-d">9 of 9 on time</div></div>
              <div><div className="v3-perf-k">Avg response</div><div className="v3-perf-v">3<span className="u">h</span></div><div className="v3-perf-d up">↑ 1h faster</div></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { CreatorDashboard });
