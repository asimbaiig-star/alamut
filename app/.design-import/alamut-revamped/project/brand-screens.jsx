// brand-screens.jsx — All brand-side screens

const { useState: bUseState, useMemo: bUseMemo, useEffect: bUseEffect, useRef: bUseRef } = React;
const { Icon, PLATFORM_META, fmtPKR, fmtPKRfull, fmtFollowers, Topbar, PlatformChip, ScoreBadge, StagePill } = window.AlamutComponents;

// ─── BRAND HOME ──────────────────────────────────────────────
function BrandHome({ onRoute }) {
  const D = window.ALAMUT_DATA;
  return (
    <>
      <Topbar
        title="Welcome back, Sara"
        crumb="Sapphire Fashion · Pro"
        actions={<button className="btn primary" onClick={() => onRoute("spark")}>{Icon.spark}<span>New plan with Spark</span></button>}
      />
      <div className="content">
        <div className="grid-4" style={{marginBottom: 24}}>
          <StatCard label="Wallet available" value={fmtPKR(D.WALLET.available)} sub="3 top-up methods" accent />
          <StatCard label="In escrow" value={fmtPKR(D.WALLET.reserved)} sub="across 4 campaigns" />
          <StatCard label="Active creators" value="14" sub="↑ 4 this month" />
          <StatCard label="Spend this month" value={fmtPKR(2_180_000)} sub="of Rs 30L budget" />
        </div>

        <div className="row" style={{justifyContent: "space-between", alignItems: "flex-end", marginBottom: 12}}>
          <div>
            <h2 className="section-title">Active campaigns</h2>
            <p className="section-sub">4 in flight · 2 awaiting your approval</p>
          </div>
          <button className="btn outline" onClick={() => onRoute("campaigns")}>View all {Icon.arrow}</button>
        </div>

        <div className="grid-2" style={{marginBottom: 32}}>
          {D.CAMPAIGNS.slice(0, 2).map(c => (
            <CampaignCard key={c.id} campaign={c} onClick={() => onRoute("campaign:" + c.id)} />
          ))}
        </div>

        <div className="grid-2">
          <div className="card card-pad-lg">
            <div className="eyebrow" style={{marginBottom: 8}}>Suggested for you</div>
            <h3 style={{fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 500, margin: "0 0 4px", letterSpacing: "-0.02em"}}>
              5 creators matched your <span style={{color: "var(--accent)"}}>Eid Edit</span> brief
            </h3>
            <p className="muted" style={{margin: "0 0 16px"}}>Based on your last 3 campaigns and ICP</p>
            <div style={{display: "flex", gap: 8, marginBottom: 16}}>
              {D.CREATORS.slice(0, 5).map(c => (
                <div key={c.id} className="avatar lg" style={{backgroundImage: `url(${c.avatar})`, border: "2px solid var(--paper)", marginLeft: -10}}></div>
              ))}
            </div>
            <button className="btn accent" onClick={() => onRoute("discover")}>See matches{Icon.arrow}</button>
          </div>

          <div className="card card-pad-lg" style={{background: "linear-gradient(135deg, var(--ink) 0%, #2A2620 100%)", color: "var(--paper)", borderColor: "transparent"}}>
            <div className="eyebrow" style={{marginBottom: 8, color: "var(--accent-2)"}}>✨ Spark AI</div>
            <h3 style={{fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 500, margin: "0 0 4px", letterSpacing: "-0.02em", color: "var(--paper)"}}>
              Plan your next campaign in a sentence
            </h3>
            <p style={{margin: "0 0 16px", color: "rgba(251, 247, 238, 0.7)"}}>"Find me 30 LinkedIn creators in HR for Rs 10L"</p>
            <button className="btn" style={{background: "var(--accent)", color: "var(--paper)"}} onClick={() => onRoute("spark")}>
              {Icon.spark}<span>Open Spark</span>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function StatCard({ label, value, sub, accent }) {
  return (
    <div className="card card-pad" style={accent ? {background: "linear-gradient(135deg, var(--accent-soft), var(--paper))", borderColor: "var(--accent-soft)"} : {}}>
      <div className="stat">
        <div className="stat-label">{label}</div>
        <div className="stat-value tabular">{value}</div>
        <div className="stat-sub">{sub}</div>
      </div>
    </div>
  );
}

function CampaignCard({ campaign, onClick }) {
  const pct = Math.round((campaign.spent / campaign.budget) * 100);
  return (
    <div className="card card-pad" onClick={onClick} style={{cursor: "pointer", transition: "transform 0.12s"}}>
      <div className="row" style={{justifyContent: "space-between", marginBottom: 6}}>
        <StagePill stage={campaign.status} />
        <span className="muted" style={{fontSize: 12}}>{campaign.brand}</span>
      </div>
      <h3 style={{fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 500, margin: "4px 0 12px", letterSpacing: "-0.02em"}}>{campaign.name}</h3>
      <div style={{height: 4, background: "var(--bg-2)", borderRadius: 2, overflow: "hidden", marginBottom: 8}}>
        <div style={{height: "100%", width: pct + "%", background: "var(--accent)"}}></div>
      </div>
      <div className="row" style={{justifyContent: "space-between", fontSize: 12.5}}>
        <span className="muted tabular">{fmtPKR(campaign.spent)} / {fmtPKR(campaign.budget)}</span>
        <span className="muted">{campaign.confirmed} creators · {campaign.live} live</span>
      </div>
    </div>
  );
}

// ─── DISCOVER ─────────────────────────────────────────────────
function Discover({ onRoute }) {
  const D = window.ALAMUT_DATA;
  const [filters, setFilters] = bUseState({
    platform: "all",
    follower: "all",
    category: "all",
    city: "all",
    price: "all",
  });
  const [query, setQuery] = bUseState("");
  const [sort, setSort] = bUseState("score");

  const results = bUseMemo(() => {
    let r = D.CREATORS.slice();
    if (query) {
      const q = query.toLowerCase();
      r = r.filter(c => c.name.toLowerCase().includes(q) || c.bio.toLowerCase().includes(q) || c.categories.some(cat => cat.toLowerCase().includes(q)));
    }
    if (filters.platform !== "all") r = r.filter(c => c.channels.some(ch => ch.platform === filters.platform));
    if (filters.city !== "all") r = r.filter(c => c.city === filters.city);
    if (filters.category !== "all") r = r.filter(c => c.categories.some(cat => cat.toLowerCase() === filters.category.toLowerCase()));
    if (filters.follower !== "all") {
      r = r.filter(c => {
        const max = Math.max(...c.channels.map(ch => ch.followers));
        if (filters.follower === "nano") return max < 10000;
        if (filters.follower === "micro") return max >= 10000 && max < 100000;
        if (filters.follower === "mid") return max >= 100000 && max < 500000;
        if (filters.follower === "macro") return max >= 500000;
        return true;
      });
    }
    if (sort === "score") r.sort((a, b) => b.score - a.score);
    if (sort === "followers") r.sort((a, b) => Math.max(...b.channels.map(ch => ch.followers)) - Math.max(...a.channels.map(ch => ch.followers)));
    if (sort === "price") r.sort((a, b) => a.rate - b.rate);
    return r;
  }, [filters, query, sort, D.CREATORS]);

  return (
    <>
      <Topbar
        title="Discover creators"
        crumb={`${D.CREATORS.length} creators in network`}
        actions={<button className="btn primary">{Icon.plus}<span>Save search</span></button>}
      />
      <div className="content">
        <div className="card" style={{padding: 16, marginBottom: 20}}>
          <div className="row" style={{gap: 8}}>
            <div className="input-search" style={{flex: 1}}>
              {Icon.search}
              <input
                placeholder="Search creators, niches, or describe your audience..."
                value={query}
                onChange={e => setQuery(e.target.value)}
              />
            </div>
            <button className="btn outline">{Icon.spark} Ask Spark instead</button>
          </div>
          <div className="row" style={{gap: 8, marginTop: 12, flexWrap: "wrap"}}>
            <FilterChip label="Platform" value={filters.platform} options={[
              ["all", "All platforms"], ["instagram", "Instagram"], ["tiktok", "TikTok"],
              ["youtube", "YouTube"], ["linkedin", "LinkedIn"], ["newsletter", "Newsletter"]
            ]} onChange={v => setFilters(f => ({...f, platform: v}))} />
            <FilterChip label="Followers" value={filters.follower} options={[
              ["all", "Any size"], ["nano", "Nano (<10K)"], ["micro", "Micro (10–100K)"],
              ["mid", "Mid (100–500K)"], ["macro", "Macro (500K+)"]
            ]} onChange={v => setFilters(f => ({...f, follower: v}))} />
            <FilterChip label="Category" value={filters.category} options={[
              ["all", "All categories"], ["fashion", "Fashion"], ["food", "Food"], ["travel", "Travel"],
              ["tech", "Tech"], ["fitness", "Fitness"], ["finance", "Finance"], ["b2b", "B2B"], ["parenting", "Parenting"]
            ]} onChange={v => setFilters(f => ({...f, category: v}))} />
            <FilterChip label="City" value={filters.city} options={[
              ["all", "All cities"], ["Karachi", "Karachi"], ["Lahore", "Lahore"], ["Islamabad", "Islamabad"]
            ]} onChange={v => setFilters(f => ({...f, city: v}))} />
            <span className="spacer" />
            <FilterChip label="Sort" value={sort} options={[
              ["score", "Alamut score"], ["followers", "Followers"], ["price", "Price (low → high)"]
            ]} onChange={setSort} />
          </div>
        </div>

        <div className="row" style={{justifyContent: "space-between", marginBottom: 12}}>
          <div className="muted">{results.length} creators · matching your filters</div>
          <div className="muted" style={{fontSize: 12}}>Showing strongest matches first</div>
        </div>

        <div className="grid-3">
          {results.map(c => (
            <CreatorCard key={c.id} creator={c} onClick={() => onRoute("creator:" + c.id)} />
          ))}
        </div>
        {results.length === 0 && (
          <div className="card card-pad-lg" style={{textAlign: "center"}}>
            <div className="muted">No creators match — try widening your filters.</div>
          </div>
        )}
      </div>
    </>
  );
}

function FilterChip({ label, value, options, onChange }) {
  const current = options.find(o => o[0] === value);
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="input"
      style={{
        width: "auto",
        padding: "5px 28px 5px 12px",
        borderRadius: "999px",
        background: "var(--bg)",
        appearance: "none",
        backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%236B6759\' stroke-width=\'2\'%3E%3Cpolyline points=\'6 9 12 15 18 9\'/%3E%3C/svg%3E")',
        backgroundRepeat: "no-repeat",
        backgroundPosition: "right 8px center",
        fontSize: 12.5,
        fontWeight: 500,
      }}
    >
      {options.map(([v, l]) => <option key={v} value={v}>{label}: {l}</option>)}
    </select>
  );
}

function CreatorCard({ creator, onClick }) {
  const topChannel = creator.channels.reduce((a, b) => a.followers > b.followers ? a : b);
  return (
    <div className="card" style={{cursor: "pointer", overflow: "hidden"}} onClick={onClick}>
      <div style={{height: 80, background: `url(${creator.cover}) center/cover`, position: "relative"}}>
        <div style={{position: "absolute", inset: 0, background: "linear-gradient(180deg, transparent, rgba(28,26,21,0.3))"}}></div>
      </div>
      <div style={{padding: "0 18px 18px", marginTop: -28, position: "relative"}}>
        <div className="row" style={{justifyContent: "space-between", alignItems: "flex-end"}}>
          <div className="avatar lg" style={{backgroundImage: `url(${creator.avatar})`, border: "3px solid var(--paper)"}}></div>
          <ScoreBadge score={creator.score} />
        </div>
        <div className="row" style={{marginTop: 10, gap: 6}}>
          <h3 style={{fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 500, margin: 0, letterSpacing: "-0.02em"}}>{creator.name}</h3>
          {creator.verified && <span style={{color: "var(--info)"}} title="Verified">{Icon.check}</span>}
        </div>
        <div className="muted" style={{fontSize: 12, marginBottom: 10}}>@{creator.handle} · {creator.city}</div>
        <p style={{fontSize: 13, lineHeight: 1.4, margin: "0 0 12px", color: "var(--ink-2)", textWrap: "pretty",
          display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden"}}>
          {creator.bio}
        </p>
        <div className="row" style={{gap: 4, flexWrap: "wrap", marginBottom: 12}}>
          {creator.categories.slice(0, 3).map(cat => (
            <span key={cat} className="pill" style={{fontSize: 10.5}}>{cat}</span>
          ))}
        </div>
        <div style={{borderTop: "1px solid var(--line)", paddingTop: 12}}>
          <div className="row" style={{justifyContent: "space-between", marginBottom: 4}}>
            <div className="row" style={{gap: 6}}>
              <span style={{color: PLATFORM_META[topChannel.platform].color, display: "flex"}}>{PLATFORM_META[topChannel.platform].icon}</span>
              <span style={{fontSize: 13, fontWeight: 550}} className="tabular">{fmtFollowers(topChannel.followers)}</span>
              <span className="muted" style={{fontSize: 12}}>· {topChannel.engagement}% ER</span>
            </div>
            <span style={{fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 500}} className="tabular">
              {fmtPKR(creator.rate)}
              <span style={{fontSize: 11, color: "var(--ink-3)", fontFamily: "var(--font-sans)", fontWeight: 400}}> /post</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── CAMPAIGNS LIST ───────────────────────────────────────────
function Campaigns({ onRoute }) {
  const D = window.ALAMUT_DATA;
  const [tab, setTab] = bUseState("all");
  const filtered = tab === "all" ? D.CAMPAIGNS : D.CAMPAIGNS.filter(c => c.status.toLowerCase() === tab);

  return (
    <>
      <Topbar
        title="Campaigns"
        crumb="Sapphire Fashion"
        actions={<button className="btn accent">{Icon.plus}<span>New campaign</span></button>}
      />
      <div className="content">
        <div className="row" style={{gap: 4, marginBottom: 16, borderBottom: "1px solid var(--line)"}}>
          {[
            ["all", "All", D.CAMPAIGNS.length],
            ["live", "Live", D.CAMPAIGNS.filter(c => c.status === "Live").length],
            ["active", "Active", D.CAMPAIGNS.filter(c => c.status === "Active").length],
            ["planned", "Planned", D.CAMPAIGNS.filter(c => c.status === "Planned").length],
            ["completed", "Completed", D.CAMPAIGNS.filter(c => c.status === "Completed").length],
          ].map(([id, label, count]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              style={{
                padding: "10px 14px",
                borderBottom: tab === id ? "2px solid var(--ink)" : "2px solid transparent",
                marginBottom: -1,
                fontWeight: tab === id ? 600 : 450,
                fontSize: 13.5,
                color: tab === id ? "var(--ink)" : "var(--ink-3)",
              }}
            >
              {label} <span style={{color: "var(--ink-4)", fontWeight: 400}}>({count})</span>
            </button>
          ))}
        </div>

        <div className="card" style={{overflow: "hidden"}}>
          <table className="tbl">
            <thead>
              <tr>
                <th>Campaign</th>
                <th>Status</th>
                <th>Creators</th>
                <th style={{textAlign: "right"}}>Budget</th>
                <th style={{textAlign: "right"}}>Spent</th>
                <th>Deadline</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => (
                <tr key={c.id} className="hover" onClick={() => onRoute("campaign:" + c.id)}>
                  <td>
                    <div style={{fontWeight: 550}}>{c.name}</div>
                    <div className="muted" style={{fontSize: 12}}>{c.brand} · {c.placement}</div>
                  </td>
                  <td><StagePill stage={c.status} /></td>
                  <td>
                    <div style={{display: "flex"}}>
                      {c.creators.slice(0, 4).map((cid, i) => {
                        const cr = D.CREATORS.find(x => x.id === cid);
                        return cr ? (
                          <div key={cid} className="avatar sm" style={{
                            backgroundImage: `url(${cr.avatar})`,
                            marginLeft: i === 0 ? 0 : -8,
                            border: "2px solid var(--paper)",
                          }}></div>
                        ) : null;
                      })}
                      {c.creators.length > 4 && (
                        <div className="avatar sm" style={{marginLeft: -8, border: "2px solid var(--paper)", background: "var(--bg-2)", fontSize: 10}}>
                          +{c.creators.length - 4}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="tabular" style={{textAlign: "right", fontWeight: 550}}>{fmtPKR(c.budget)}</td>
                  <td className="tabular" style={{textAlign: "right"}}>
                    {fmtPKR(c.spent)}
                    <div className="muted" style={{fontSize: 11}}>{Math.round((c.spent/c.budget)*100)}%</div>
                  </td>
                  <td className="muted" style={{fontSize: 12}}>{c.deadline}</td>
                  <td><span className="muted" style={{display: "flex"}}>{Icon.arrow}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

// ─── CAMPAIGN DETAIL ──────────────────────────────────────────
function CampaignDetail({ campaignId, onRoute }) {
  const D = window.ALAMUT_DATA;
  const c = D.CAMPAIGNS.find(x => x.id === campaignId) || D.CAMPAIGNS[0];

  return (
    <>
      <Topbar
        title={c.name}
        crumb={<span><a onClick={() => onRoute("campaigns")} style={{cursor: "pointer", color: "var(--ink-3)"}}>Campaigns</a> · {c.brand}</span>}
        actions={<>
          <button className="btn outline">Edit brief</button>
          <button className="btn primary">{Icon.plus}<span>Add creators</span></button>
        </>}
      />
      <div className="content">
        <div className="grid-4" style={{marginBottom: 20}}>
          <StatCard label="Budget" value={fmtPKR(c.budget)} sub={`${fmtPKR(c.spent)} spent`} />
          <StatCard label="Confirmed" value={c.confirmed.toString()} sub="creators in flight" />
          <StatCard label="Live posts" value={c.live.toString()} sub={`${c.submitted} submitted reports`} />
          <StatCard label="Paid out" value={fmtPKR(c.paid)} sub="net of fees & WHT" />
        </div>

        <div className="grid-2" style={{gridTemplateColumns: "1fr 320px", gap: 24, alignItems: "flex-start"}}>
          <div>
            <div className="card card-pad-lg" style={{marginBottom: 16}}>
              <div className="row" style={{justifyContent: "space-between", marginBottom: 16}}>
                <h3 style={{fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 500, margin: 0, letterSpacing: "-0.02em"}}>Creators</h3>
                <div className="row" style={{gap: 6}}>
                  <button className="btn sm outline">{Icon.filter} Filters</button>
                  <button className="btn sm primary">{Icon.plus} Add</button>
                </div>
              </div>
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Creator</th>
                    <th>Placement</th>
                    <th>Stage</th>
                    <th style={{textAlign: "right"}}>Price</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {c.creators.map(cid => {
                    const cr = D.CREATORS.find(x => x.id === cid);
                    if (!cr) return null;
                    const stages = ["Confirmed", "Live", "Submitted", "Negotiating"];
                    const stage = stages[cr.id.charCodeAt(0) % stages.length];
                    return (
                      <tr key={cid} className="hover" onClick={() => onRoute("creator:" + cid)}>
                        <td>
                          <div className="row">
                            <div className="avatar md" style={{backgroundImage: `url(${cr.avatar})`}}></div>
                            <div>
                              <div style={{fontWeight: 550}}>{cr.name}</div>
                              <div className="muted" style={{fontSize: 12}}>@{cr.handle}</div>
                            </div>
                          </div>
                        </td>
                        <td className="muted" style={{fontSize: 13}}>{c.placement}</td>
                        <td><StagePill stage={stage} /></td>
                        <td className="tabular" style={{textAlign: "right", fontWeight: 550}}>{fmtPKR(cr.rate)}</td>
                        <td><button className="icon-btn" onClick={e => e.stopPropagation()}>{Icon.more}</button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="card card-pad-lg">
              <h3 style={{fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 500, margin: "0 0 12px", letterSpacing: "-0.02em"}}>Brief</h3>
              <p style={{lineHeight: 1.6, color: "var(--ink-2)", margin: "0 0 16px"}}>{c.brief}</p>
              <div className="grid-2" style={{gap: 12}}>
                <div>
                  <div className="eyebrow" style={{marginBottom: 4}}>Placement</div>
                  <div style={{fontSize: 14}}>{c.placement}</div>
                </div>
                <div>
                  <div className="eyebrow" style={{marginBottom: 4}}>Deadline</div>
                  <div style={{fontSize: 14}}>{c.deadline}</div>
                </div>
              </div>
            </div>
          </div>

          <div>
            <div className="card card-pad" style={{marginBottom: 16}}>
              <div className="eyebrow" style={{marginBottom: 12}}>Budget breakdown</div>
              <BudgetBar label="Paid out" amount={c.paid} total={c.budget} color="var(--moss)" />
              <BudgetBar label="In escrow" amount={c.spent - c.paid} total={c.budget} color="var(--accent)" />
              <BudgetBar label="To allocate" amount={c.budget - c.spent} total={c.budget} color="var(--bg-2)" />
              <hr className="hr" />
              <div className="row" style={{justifyContent: "space-between", fontSize: 12}}>
                <span className="muted">Platform fee (avg)</span>
                <span className="tabular">{fmtPKR(Math.round(c.spent * 0.08))}</span>
              </div>
              <div className="row" style={{justifyContent: "space-between", fontSize: 12, marginTop: 4}}>
                <span className="muted">FBR WHT</span>
                <span className="tabular">{fmtPKR(Math.round(c.spent * 0.05))}</span>
              </div>
            </div>

            <div className="card card-pad">
              <div className="eyebrow" style={{marginBottom: 12}}>Activity</div>
              <div style={{display: "flex", flexDirection: "column", gap: 14}}>
                <Activity who="Hira Mansoor" what="submitted Reel for review" when="2h ago" />
                <Activity who="System" what={`released Rs 33,250 to Mahnoor`} when="Yesterday" />
                <Activity who="Bilal Ahmed" what="accepted the brief" when="2 days ago" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function BudgetBar({ label, amount, total, color }) {
  const pct = Math.max(2, (amount / total) * 100);
  return (
    <div style={{marginBottom: 10}}>
      <div className="row" style={{justifyContent: "space-between", fontSize: 12, marginBottom: 4}}>
        <span>{label}</span>
        <span className="tabular muted">{fmtPKR(amount)}</span>
      </div>
      <div style={{height: 6, background: "var(--bg-2)", borderRadius: 3, overflow: "hidden"}}>
        <div style={{height: "100%", width: pct + "%", background: color}}></div>
      </div>
    </div>
  );
}

function Activity({ who, what, when }) {
  return (
    <div style={{fontSize: 12.5, lineHeight: 1.5}}>
      <span style={{fontWeight: 550}}>{who}</span> <span className="muted">{what}</span>
      <div className="muted" style={{fontSize: 11, marginTop: 2}}>{when}</div>
    </div>
  );
}

window.AlamutBrandScreens = { BrandHome, Discover, Campaigns, CampaignDetail };
