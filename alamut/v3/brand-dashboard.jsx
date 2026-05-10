// Brand Dashboard — 7 widgets

function BrandDashboard({ onNav }) {
  const activeCamps = V3_CAMPAIGNS.filter(c => !['draft','closed'].includes(c.stage));
  const totalSpend = V3_CAMPAIGNS.reduce((a,c) => a + (c.spent || 0), 0);
  const totalBudget = V3_CAMPAIGNS.reduce((a,c) => a + (c.budget || 0), 0);
  const liveSpend = activeCamps.reduce((a,c) => a + (c.spent||0), 0);

  return (
    <div className="v3-page">
      <div className="v3-page-head">
        <div>
          <Label num="B · 01">Brand console</Label>
          <h1 className="v3-page-h1">Aesop · <em>April</em></h1>
          <p className="v3-page-lede">Three campaigns active. 4 drafts in approvals queue. $14.4k released this month against a planned $28k.</p>
        </div>
        <div className="v3-page-head-actions">
          <Btn variant="ghost" onClick={() => onNav('brand-discover')} icon={<Icon.search s={14} />}>Find creators</Btn>
          <Btn variant="solid" onClick={() => onNav('brand-campaigns')} icon={<Icon.plus s={14} />}>New campaign</Btn>
        </div>
      </div>

      {/* Spend strip */}
      <div className="v3-card" style={{ marginBottom: 24 }}>
        <div className="v3-card-h">
          <span className="v3-card-title">Spend · April</span>
          <button className="v3-card-link" onClick={() => onNav('brand-wallet')}>Wallet →</button>
        </div>
        <div className="v3-earn">
          <div>
            <div className="v3-earn-k">Released</div>
            <div className="v3-earn-v">${liveSpend.toLocaleString()}</div>
            <div className="v3-earn-h">Across 3 campaigns</div>
          </div>
          <div>
            <div className="v3-earn-k">In escrow</div>
            <div className="v3-earn-v">$32,400</div>
            <div className="v3-earn-h">8 milestones holding</div>
          </div>
          <div>
            <div className="v3-earn-k">Budget remaining</div>
            <div className="v3-earn-v">${(totalBudget - totalSpend).toLocaleString()}</div>
            <div className="v3-earn-h">of ${totalBudget.toLocaleString()} planned</div>
          </div>
        </div>
      </div>

      <div className="v3-dash-grid">
        <div className="v3-dash-col">
          {/* Active campaigns */}
          <div className="v3-card">
            <div className="v3-card-h">
              <span className="v3-card-title">Active campaigns</span>
              <button className="v3-card-link" onClick={() => onNav('brand-campaigns')}>All →</button>
            </div>
            <div className="v3-row-list">
              {activeCamps.slice(0,4).map(c => (
                <button key={c.id} className="v3-camp-row" onClick={() => onNav('brand-campaigns')}>
                  <img className="v3-camp-row-img" src={c.cover} alt="" />
                  <div>
                    <div className="v3-camp-row-title">{c.title}</div>
                    <div className="v3-camp-row-meta">{c.invited} invited · {c.accepted} accepted · {c.posted} posted</div>
                  </div>
                  <div className="v3-camp-row-right">
                    <div className="v3-camp-row-due">{c.progress}% complete</div>
                    <div className="v3-camp-row-stage">{STAGE_LABEL[c.stage]}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Approvals */}
          <div className="v3-card">
            <div className="v3-card-h">
              <span className="v3-card-title">Pending approvals</span>
              <button className="v3-card-link" onClick={() => onNav('brand-approvals')}>{V3_APPROVALS.length} drafts →</button>
            </div>
            <div className="v3-row-list">
              {V3_APPROVALS.slice(0,3).map(a => {
                const creator = ROSTER.find(r => r.id === a.creatorId);
                const camp = V3_CAMPAIGNS.find(c => c.id === a.campaignId);
                return (
                  <button key={a.id} className="v3-camp-row" onClick={() => onNav('brand-approvals')}>
                    <img className="v3-camp-row-img" src={a.img} alt="" />
                    <div>
                      <div className="v3-camp-row-title">{creator?.name} — {a.name}</div>
                      <div className="v3-camp-row-meta">{camp?.title} · Round {a.round}</div>
                    </div>
                    <div className="v3-camp-row-right">
                      <div className="v3-camp-row-due">Due {a.due}</div>
                      <div className="v3-camp-row-stage">Review</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Top creators */}
          <div className="v3-card">
            <div className="v3-card-h">
              <span className="v3-card-title">Top performing creators</span>
              <button className="v3-card-link" onClick={() => onNav('brand-analytics')}>Analytics →</button>
            </div>
            <div className="v3-row-list">
              {[ROSTER[0], ROSTER[2], ROSTER[5]].map((c, i) => (
                <button key={c.id} className="v3-camp-row" onClick={() => onNav('brand-discover')}>
                  <img className="v3-camp-row-img" src={c.portrait} alt="" />
                  <div>
                    <div className="v3-camp-row-title">{c.name}</div>
                    <div className="v3-camp-row-meta">{c.categories[0]} · ER {c.engagement}%</div>
                  </div>
                  <div className="v3-camp-row-right">
                    <div className="v3-camp-row-due">{fmt(c.reach)} reach</div>
                    <div className="v3-camp-row-stage">{['+38%','+24%','+19%'][i]}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="v3-dash-col">
          {/* Aggregate reach mini-chart */}
          <div className="v3-card">
            <div className="v3-card-h">
              <span className="v3-card-title">Aggregate reach · Last 30d</span>
              <button className="v3-card-link" onClick={() => onNav('brand-analytics')}>Details →</button>
            </div>
            <div className="v3-card-body">
              <div className="v3-perf" style={{ marginBottom: 18 }}>
                <div><div className="v3-perf-k">Reach</div><div className="v3-perf-v">3.4<span className="u">M</span></div><div className="v3-perf-d up">↑ 28%</div></div>
                <div><div className="v3-perf-k">Engagement</div><div className="v3-perf-v">187<span className="u">k</span></div><div className="v3-perf-d up">↑ 14%</div></div>
              </div>
              <ChartLine />
              <div className="v3-chart-legend">
                <div style={{ color: 'var(--accent)' }}><span className="v3-chart-legend-d" /> This period</div>
                <div style={{ color: 'var(--ink-40)' }}><span className="v3-chart-legend-d" /> Previous</div>
              </div>
            </div>
          </div>

          {/* Recent activity */}
          <div className="v3-card">
            <div className="v3-card-h">
              <span className="v3-card-title">Recent activity</span>
            </div>
            <div className="v3-row-list">
              {[
                { who: 'Sarah Johnson', what: 'Uploaded Reel — Take 2', when: '2h', tag: 'Spring Renewal' },
                { who: 'Marcus Chen', what: 'Applied to campaign', when: '5h', tag: 'Marathon Build-Up' },
                { who: 'Ayaan Patel', what: 'Accepted offer', when: '1d', tag: 'Cookbook Launch' },
                { who: 'Iris Vanderberg', what: 'Posted final content', when: '2d', tag: 'Spring Renewal' },
              ].map((a, i) => (
                <div key={i} className="v3-msg">
                  <div className="v3-msg-av">{a.who.slice(0,1)}</div>
                  <div style={{ minWidth: 0 }}>
                    <div className="v3-msg-row">
                      <span className="v3-msg-name">{a.who}</span>
                      <span className="v3-msg-time">{a.when}</span>
                    </div>
                    <div className="v3-msg-line">{a.what} · {a.tag}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick actions */}
          <div className="v3-card">
            <div className="v3-card-h"><span className="v3-card-title">Quick actions</span></div>
            <div style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <Btn variant="solid" onClick={() => onNav('brand-campaigns')} icon={<Icon.plus s={14} />}>New campaign</Btn>
              <Btn variant="ghost" onClick={() => onNav('brand-discover')} icon={<Icon.search s={14} />}>Browse creator roster</Btn>
              <Btn variant="ghost" onClick={() => onNav('brand-wallet')} icon={<Icon.arrow s={14} />}>Top up wallet</Btn>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ChartLine() {
  // Simple inline SVG sparkline-ish
  const pts = [40, 36, 48, 42, 55, 50, 64, 58, 70, 65, 78, 72, 84];
  const prev = [50, 52, 48, 46, 52, 50, 54, 56, 58, 60, 64, 62, 66];
  const max = 100;
  const w = 600, h = 160, pad = 8;
  const toPath = (arr) => arr.map((v, i) => {
    const x = pad + (i / (arr.length - 1)) * (w - pad * 2);
    const y = h - pad - (v / max) * (h - pad * 2);
    return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(' ');
  return (
    <div className="v3-chart">
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
        <path d={toPath(prev)} fill="none" stroke="var(--ink-40)" strokeWidth="1" strokeDasharray="3 3" />
        <path d={toPath(pts)} fill="none" stroke="var(--accent)" strokeWidth="1.6" />
      </svg>
    </div>
  );
}

Object.assign(window, { BrandDashboard, ChartLine });
