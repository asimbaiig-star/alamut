// home-v2.jsx — Reimagined Home tabs for both Brand and Creator personas

const { useState: hUseState, useMemo: hUseMemo, useEffect: hUseEffect } = React;
const { Icon, fmtPKR, fmtPKRfull, fmtFollowers, Topbar, StagePill, ScoreBadge } = window.AlamutComponents;

// ════════════════════════════════════════════════════════════════
// BRAND HOME v2
// Design philosophy: "What needs me right now?" not "what happened?"
// Layered: Action feed → Pacing → Outcomes → Discovery → What's next
// ════════════════════════════════════════════════════════════════
function BrandHomeV2({ onRoute }) {
  const D = window.ALAMUT_DATA;
  const [sparkInput, setSparkInput] = hUseState("");

  const inboxItems = [
    { id: "i1", type: "review", urgent: true, who: "Hira Mansoor", what: "submitted a Reel for Eid Edit", when: "2h ago", action: "Review", route: "campaign:c1" },
    { id: "i2", type: "message", urgent: false, who: "Bilal Ahmed", what: "asked about timeline for LinkedIn post", when: "5h ago", action: "Reply", route: "inbox" },
    { id: "i3", type: "approval", urgent: true, who: "Eid Edit", what: "needs approval — 4 creators waiting >24h", when: "yesterday", action: "Open campaign", route: "campaign:c1" },
    { id: "i4", type: "wallet", urgent: false, who: "Wallet", what: "top up before Eid Edit launches in 23 days", when: "soon", action: "Top up", route: "wallet" },
  ];

  return (
    <>
      <Topbar
        title="Welcome back, Sara"
        crumb={<span>{getGreeting()} · 4 things need you · <span style={{color: "var(--accent)"}}>Eid Edit launches in 23 days</span></span>}
        actions={<button className="btn primary" onClick={() => onRoute("campaign-new")}>{Icon.plus}<span>New campaign</span></button>}
      />
      <div className="content">
        {/* ── Hero: Spark composer + action stack ── */}
        <div className="grid-2" style={{gridTemplateColumns: "1.4fr 1fr", gap: 20, marginBottom: 24, alignItems: "stretch"}}>
          <SparkComposer onRoute={onRoute} value={sparkInput} setValue={setSparkInput} />
          <ActionInbox items={inboxItems} onRoute={onRoute} />
        </div>

        {/* ── Pacing strip ── */}
        <div className="card" style={{padding: 20, marginBottom: 24}}>
          <div className="row" style={{justifyContent: "space-between", marginBottom: 16}}>
            <div>
              <h3 style={{fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 500, margin: "0 0 2px", letterSpacing: "-0.02em"}}>
                Quarter pacing
              </h3>
              <p className="muted" style={{margin: 0, fontSize: 13}}>Q2 spend is on plan · 2 campaigns trending late</p>
            </div>
            <div className="row" style={{gap: 6}}>
              <span className="pill moss">On plan</span>
              <button className="btn sm ghost">{Icon.arrow}</button>
            </div>
          </div>
          <PacingStrip />
        </div>

        {/* ── Outcomes ── */}
        <div className="row" style={{justifyContent: "space-between", marginBottom: 12}}>
          <div>
            <h2 className="section-title">This week's wins</h2>
            <p className="section-sub">Across all live campaigns · vs. last week</p>
          </div>
          <button className="btn outline">View report{Icon.arrow}</button>
        </div>

        <div className="grid-3" style={{marginBottom: 32}}>
          <OutcomeCard
            label="Top performer"
            big="Bilal Ahmed"
            sub="LinkedIn post · 248K impressions"
            change="+38% vs avg"
            avatar="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&q=80"
            onClick={() => onRoute("creator:bilal")}
          />
          <OutcomeCard
            label="Breakout"
            big="Saadia Imam"
            sub="Reel hit 2.1x your typical reach"
            change="↑ Re-hire?"
            badge="🚀"
            avatar="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&q=80"
            onClick={() => onRoute("creator:saadia")}
          />
          <OutcomeCard
            label="Engagement leader"
            big="Hira Mansoor"
            sub="11.5% ER on Eid Reel · 4.2K saves"
            change="ER ↑ vs niche"
            avatar="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&q=80"
            onClick={() => onRoute("creator:hira")}
          />
        </div>

        {/* ── Discovery + Calendar ── */}
        <div className="grid-2" style={{gridTemplateColumns: "1.2fr 1fr", gap: 20, marginBottom: 32}}>
          <CreatorOfTheWeek onRoute={onRoute} />
          <CulturalCalendar onRoute={onRoute} />
        </div>

        {/* ── Active campaigns rail ── */}
        <div className="row" style={{justifyContent: "space-between", marginBottom: 12}}>
          <div>
            <h2 className="section-title">Active campaigns</h2>
            <p className="section-sub">{D.CAMPAIGNS.filter(c => c.status === "Active" || c.status === "Live" || c.status === "Recruiting").length} in flight</p>
          </div>
          <button className="btn outline" onClick={() => onRoute("campaigns")}>View all{Icon.arrow}</button>
        </div>
        <div className="grid-2">
          {D.CAMPAIGNS.slice(0, 2).map(c => (
            <BHCampaignCard key={c.id} campaign={c} onClick={() => onRoute("campaign:" + c.id)} />
          ))}
        </div>
      </div>
    </>
  );
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function SparkComposer({ onRoute, value, setValue }) {
  const suggestions = [
    "Find me 5 LinkedIn creators in HR for Rs 10L",
    "Plan an Eid Reel campaign with Karachi mommy creators",
    "Who outperformed expectations last campaign?",
  ];
  return (
    <div className="card" style={{
      padding: 24,
      background: "linear-gradient(135deg, var(--ink) 0%, #2A2620 100%)",
      color: "var(--paper)", borderColor: "transparent",
      position: "relative", overflow: "hidden",
    }}>
      <div style={{
        position: "absolute", top: -40, right: -40,
        width: 200, height: 200, borderRadius: "50%",
        background: "radial-gradient(circle, var(--accent) 0%, transparent 70%)",
        opacity: 0.25, filter: "blur(20px)", pointerEvents: "none",
      }}></div>

      <div className="eyebrow" style={{color: "var(--accent-2)", marginBottom: 8}}>✨ Spark AI</div>
      <h3 style={{fontFamily: "var(--font-display)", fontSize: 26, fontWeight: 500, margin: "0 0 16px", letterSpacing: "-0.02em", color: "var(--paper)", lineHeight: 1.15}}>
        What's your next move?
      </h3>

      <div style={{
        background: "rgba(251,247,238,0.06)",
        border: "1px solid rgba(251,247,238,0.15)",
        borderRadius: "var(--r-md)", padding: 12, marginBottom: 12,
      }}>
        <textarea
          value={value}
          onChange={e => setValue(e.target.value)}
          placeholder="Describe what you want — Spark plans the campaign, drafts outreach, runs escrow."
          rows={2}
          style={{
            width: "100%", background: "transparent", border: "none", outline: "none",
            color: "var(--paper)", fontFamily: "inherit", fontSize: 15, resize: "none",
          }}
        />
        <div className="row" style={{justifyContent: "space-between", marginTop: 4}}>
          <button style={{
            background: "transparent", color: "rgba(251,247,238,0.5)",
            border: "none", fontSize: 12, cursor: "pointer", padding: "4px 0",
          }}>📎 Attach brief</button>
          <button className="btn accent sm" onClick={() => onRoute("spark")}>
            Send →
          </button>
        </div>
      </div>

      <div style={{display: "flex", flexDirection: "column", gap: 6}}>
        {suggestions.map(s => (
          <button key={s} onClick={() => { setValue(s); onRoute("spark"); }} style={{
            background: "rgba(251,247,238,0.04)",
            border: "1px solid rgba(251,247,238,0.1)",
            borderRadius: 8, padding: "8px 12px",
            color: "rgba(251,247,238,0.85)",
            fontSize: 13, textAlign: "left", cursor: "pointer",
          }}>{s}</button>
        ))}
      </div>
    </div>
  );
}

function ActionInbox({ items, onRoute }) {
  return (
    <div className="card" style={{padding: 0, overflow: "hidden", display: "flex", flexDirection: "column"}}>
      <div className="row" style={{padding: "16px 20px", borderBottom: "1px solid var(--line)", justifyContent: "space-between"}}>
        <div>
          <div className="eyebrow" style={{color: "var(--accent)"}}>Needs you</div>
          <h3 style={{fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 500, margin: "2px 0 0", letterSpacing: "-0.02em"}}>
            {items.length} things blocking your campaigns
          </h3>
        </div>
        <span className="pill accent">{items.filter(x => x.urgent).length} urgent</span>
      </div>
      <div style={{flex: 1, overflowY: "auto"}}>
        {items.map(it => (
          <button key={it.id} onClick={() => onRoute(it.route)} className="row" style={{
            width: "100%", padding: "12px 20px", gap: 12,
            borderBottom: "1px solid var(--line)", background: "var(--paper)",
            cursor: "pointer", textAlign: "left",
          }}>
            <span style={{
              width: 8, height: 8, borderRadius: "50%",
              background: it.urgent ? "var(--accent)" : "var(--ink-3)",
              flexShrink: 0,
            }}></span>
            <div style={{flex: 1, minWidth: 0}}>
              <div style={{fontSize: 13.5, fontWeight: 550, marginBottom: 1}}>
                {it.who} <span style={{color: "var(--ink-3)", fontWeight: 450}}>{it.what}</span>
              </div>
              <div className="muted" style={{fontSize: 11.5}}>{it.when}</div>
            </div>
            <span className="btn sm ghost" style={{flexShrink: 0, fontSize: 12}}>{it.action} →</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function PacingStrip() {
  const months = [
    { m: "Apr", spent: 1.8, plan: 2.0, status: "complete" },
    { m: "May", spent: 2.2, plan: 2.5, status: "current" },
    { m: "Jun", spent: 0, plan: 3.0, status: "future" },
  ];
  return (
    <div>
      <div className="row" style={{gap: 16, marginBottom: 12}}>
        <Stat tiny label="Wallet" v={fmtPKR(window.ALAMUT_DATA.WALLET.available)} sub="3 top-up methods" />
        <Stat tiny label="In escrow" v={fmtPKR(window.ALAMUT_DATA.WALLET.reserved)} sub="across 4 campaigns" />
        <Stat tiny label="Q2 budget" v="Rs 75L" sub="Rs 40L spent · 53%" />
        <Stat tiny label="Avg cost / engagement" v="Rs 43" sub="↓ 12% vs Q1" accent />
        <Stat tiny label="Avg ER" v="11.5%" sub="vs 4.2% category" accent />
      </div>
      <div style={{
        height: 8, background: "var(--bg-2)", borderRadius: 4, overflow: "hidden",
        position: "relative", marginBottom: 8,
      }}>
        <div style={{height: "100%", width: "53%", background: "var(--accent)"}}></div>
      </div>
      <div className="row" style={{justifyContent: "space-between", fontSize: 11.5, color: "var(--ink-3)"}}>
        <span>Q2 start (Apr 1)</span>
        <span style={{color: "var(--accent)", fontWeight: 600}}>● Today · Rs 40L of 75L</span>
        <span>Q2 end (Jun 30)</span>
      </div>
    </div>
  );
}

function Stat({ tiny, label, v, sub, accent }) {
  return (
    <div style={{flex: 1, padding: tiny ? 0 : 12}}>
      <div className="stat-label" style={{marginBottom: 3}}>{label}</div>
      <div className="tabular" style={{fontFamily: "var(--font-display)", fontSize: tiny ? 22 : 28, fontWeight: 500, letterSpacing: "-0.02em", color: accent ? "var(--moss)" : "var(--ink)"}}>
        {v}
      </div>
      <div className="stat-sub">{sub}</div>
    </div>
  );
}

function OutcomeCard({ label, big, sub, change, badge, avatar, onClick }) {
  return (
    <div className="card card-pad" style={{cursor: "pointer", position: "relative"}} onClick={onClick}>
      <div className="eyebrow" style={{marginBottom: 10}}>{label} {badge && <span style={{marginLeft: 4}}>{badge}</span>}</div>
      <div className="row" style={{gap: 12, marginBottom: 10}}>
        <div className="avatar md" style={{backgroundImage: `url(${avatar})`}}></div>
        <div style={{minWidth: 0}}>
          <div style={{fontWeight: 600, fontSize: 15}}>{big}</div>
          <div className="muted" style={{fontSize: 12}}>{sub}</div>
        </div>
      </div>
      <div className="row" style={{justifyContent: "space-between"}}>
        <span style={{fontSize: 12, color: "var(--moss)", fontWeight: 600}}>{change}</span>
        <span className="muted">{Icon.arrow}</span>
      </div>
    </div>
  );
}

function CreatorOfTheWeek({ onRoute }) {
  const D = window.ALAMUT_DATA;
  const c = D.CREATORS[0];
  const top = c.channels.reduce((a, b) => a.followers > b.followers ? a : b);
  return (
    <div className="card" style={{padding: 0, overflow: "hidden"}}>
      <div style={{
        height: 120,
        background: `linear-gradient(135deg, var(--moss) 0%, var(--ink) 100%)`,
        position: "relative",
      }}>
        <div style={{
          position: "absolute", top: 16, left: 20,
          color: "white",
        }}>
          <div className="eyebrow" style={{color: "rgba(255,255,255,0.7)"}}>For you · this week</div>
          <h3 style={{fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 500, margin: "4px 0 0", color: "white", letterSpacing: "-0.02em"}}>
            Spark thinks you'd hit it off with...
          </h3>
        </div>
      </div>
      <div className="card-pad" style={{paddingTop: 0, marginTop: -32}}>
        <div className="row" style={{alignItems: "flex-end", marginBottom: 14}}>
          <div className="avatar lg" style={{
            backgroundImage: `url(${c.avatar})`,
            border: "4px solid var(--paper)", width: 72, height: 72,
          }}></div>
          <div style={{flex: 1}}>
            <div className="row" style={{gap: 6, marginTop: 8}}>
              <span style={{fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 500, letterSpacing: "-0.02em"}}>{c.name}</span>
              {c.verified && <span style={{color: "var(--info)", display: "flex"}}>{Icon.check}</span>}
            </div>
            <div className="muted" style={{fontSize: 13}}>@{c.handle} · {c.city} · {fmtFollowers(top.followers)} on {top.platform}</div>
          </div>
          <ScoreBadge score={c.score} />
        </div>

        <div style={{
          padding: 12, background: "var(--bg)",
          borderRadius: "var(--r-md)", fontSize: 13, marginBottom: 14,
          borderLeft: "3px solid var(--accent)",
        }}>
          <div className="eyebrow" style={{marginBottom: 4, color: "var(--accent)"}}>Why this match</div>
          Audience is 87% female 25–34 in Karachi/Lahore — exact overlap with your Eid '24 buyers. Replies in &lt;6h. Hasn't posted competitor content in 18 months.
        </div>

        <div className="row" style={{gap: 8}}>
          <button className="btn primary sm" style={{flex: 1}} onClick={() => onRoute("creator:" + c.id)}>View profile</button>
          <button className="btn outline sm" style={{flex: 1}} onClick={() => onRoute("inbox")}>Send brief</button>
        </div>
      </div>
    </div>
  );
}

function CulturalCalendar({ onRoute }) {
  const events = [
    { date: "Jun 6", days: 23, name: "Eid-ul-Adha", type: "Cultural", brief: "3 active campaigns" },
    { date: "Aug 14", days: 92, name: "Independence Day", type: "Cultural", brief: "Plan window opens" },
    { date: "Nov 27", days: 197, name: "Black Friday PK", type: "Retail", brief: "Top-spend window" },
    { date: "Dec 25", days: 225, name: "Quaid Day / Christmas", type: "Cultural", brief: "Plan now" },
  ];
  return (
    <div className="card" style={{padding: 0, overflow: "hidden"}}>
      <div style={{padding: "16px 20px", borderBottom: "1px solid var(--line)"}}>
        <div className="eyebrow">Pakistan retail calendar</div>
        <h3 style={{fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 500, margin: "2px 0 0", letterSpacing: "-0.02em"}}>
          What's coming up
        </h3>
      </div>
      {events.map((e, i) => (
        <div key={e.date} className="row" style={{
          padding: "12px 20px", gap: 12,
          borderBottom: i < events.length - 1 ? "1px solid var(--line)" : "none",
        }}>
          <div style={{
            minWidth: 60, padding: "6px 0", textAlign: "center",
            background: i === 0 ? "var(--accent-soft)" : "var(--bg)",
            borderRadius: 6,
          }}>
            <div className="tabular" style={{fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 600, color: i === 0 ? "var(--accent)" : "var(--ink)", lineHeight: 1}}>
              {e.days}
            </div>
            <div className="muted" style={{fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em"}}>days</div>
          </div>
          <div style={{flex: 1, minWidth: 0}}>
            <div style={{fontWeight: 600, fontSize: 13.5}}>{e.name}</div>
            <div className="muted" style={{fontSize: 11.5}}>{e.date} · {e.type} · {e.brief}</div>
          </div>
          <button className="btn sm ghost" onClick={() => onRoute("campaign-new")}>Plan{Icon.arrow}</button>
        </div>
      ))}
    </div>
  );
}

function BHCampaignCard({ campaign, onClick }) {
  const pct = Math.round((campaign.spent / campaign.budget) * 100);
  return (
    <div className="card card-pad" onClick={onClick} style={{cursor: "pointer"}}>
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

// ════════════════════════════════════════════════════════════════
// CREATOR HOME v2
// Design philosophy: Money-first, action-second, growth-third
// Layered: Earnings hero → Today list → Brief matches → Storefront pulse → Goals
// ════════════════════════════════════════════════════════════════
function CreatorHomeV2({ onRoute }) {
  const D = window.ALAMUT_DATA;
  const cw = D.CREATOR_WALLET;

  const todoItems = [
    { id: "t1", icon: "📹", urgent: true, title: "Submit Sapphire Reel", sub: "Due in 3 days · Rs 35,000 in escrow", route: "collab:x1" },
    { id: "t2", icon: "💬", urgent: false, title: "Reply to Foodpanda", sub: "Sent brief 2 days ago · 18hr avg response", route: "creator-inbox" },
    { id: "t3", icon: "✨", urgent: true, title: "PostEx invited you", sub: "LinkedIn post · Rs 145K · expires in 36h", route: "brief:c2" },
    { id: "t4", icon: "📊", urgent: false, title: "Tax certificate ready", sub: "FBR-compliant · download for Q2 filing", route: "kyc" },
  ];

  return (
    <>
      <Topbar
        title="Hi Hira 👋"
        crumb={<span>{getGreeting()} from Lahore · <span style={{color: "var(--moss)"}}>{fmtPKRfull(cw.available)} ready to withdraw</span></span>}
        actions={<button className="btn primary" onClick={() => onRoute("storefront")}>{Icon.edit} Edit storefront</button>}
      />
      <div className="content">
        {/* ── Money hero ── */}
        <EarningsHero cw={cw} onRoute={onRoute} />

        {/* ── Today list + Brief matches ── */}
        <div className="grid-2" style={{gridTemplateColumns: "1fr 1.2fr", gap: 20, marginBottom: 32}}>
          <TodayList items={todoItems} onRoute={onRoute} />
          <BriefMatches onRoute={onRoute} />
        </div>

        {/* ── Storefront pulse + Audience snapshot ── */}
        <div className="grid-2" style={{gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 32}}>
          <StorefrontPulse onRoute={onRoute} />
          <AudiencePulse onRoute={onRoute} />
        </div>

        {/* ── Goals + Tip of the day ── */}
        <div className="grid-2" style={{gridTemplateColumns: "1.4fr 1fr", gap: 20}}>
          <CreatorGoals onRoute={onRoute} />
          <CreatorTip onRoute={onRoute} />
        </div>
      </div>
    </>
  );
}

function EarningsHero({ cw, onRoute }) {
  return (
    <div className="card" style={{
      padding: 0, marginBottom: 24, overflow: "hidden",
      background: "linear-gradient(135deg, var(--moss) 0%, #1F3527 100%)",
      color: "var(--paper)", borderColor: "transparent",
      position: "relative",
    }}>
      <div style={{
        position: "absolute", top: -100, right: -100,
        width: 360, height: 360, borderRadius: "50%",
        background: "radial-gradient(circle, var(--accent) 0%, transparent 70%)",
        opacity: 0.12, filter: "blur(30px)", pointerEvents: "none",
      }}></div>

      <div className="grid-2" style={{gridTemplateColumns: "1.6fr 1fr", gap: 0, alignItems: "stretch"}}>
        <div style={{padding: 32}}>
          <div className="eyebrow" style={{color: "rgba(251,247,238,0.65)", marginBottom: 12}}>This month · May 2026</div>
          <div style={{display: "flex", alignItems: "baseline", gap: 12, marginBottom: 8, flexWrap: "wrap"}}>
            <div style={{fontFamily: "var(--font-display)", fontSize: 52, fontWeight: 500, letterSpacing: "-0.04em", lineHeight: 1, whiteSpace: "nowrap"}} className="tabular">
              {fmtPKRfull(cw.available)}
            </div>
            <div style={{
              padding: "3px 10px", background: "rgba(255,255,255,0.15)",
              borderRadius: "var(--r-pill)", fontSize: 12, fontWeight: 600,
            }}>↑ 28% vs Apr</div>
          </div>
          <p style={{margin: "0 0 24px", color: "rgba(251,247,238,0.75)", fontSize: 15}}>
            ready to withdraw · {fmtPKR(cw.pending)} pending in escrow
          </p>

          <div className="row" style={{gap: 10, marginBottom: 20}}>
            <button className="btn" style={{background: "var(--paper)", color: "var(--ink)"}} onClick={() => onRoute("creator-wallet")}>
              💸 Withdraw to JazzCash
            </button>
            <button className="btn" style={{background: "rgba(255,255,255,0.12)", color: "var(--paper)"}} onClick={() => onRoute("creator-wallet")}>
              View ledger
            </button>
          </div>

          <div className="row" style={{gap: 24, paddingTop: 20, borderTop: "1px solid rgba(255,255,255,0.15)"}}>
            <MiniStatLight label="Released today" v={`Rs ${(34_200).toLocaleString()}`} sub="from Saadia campaign" />
            <MiniStatLight label="Releases this week" v={`Rs ${(125_000).toLocaleString()}`} sub="3 deliverables pending" />
            <MiniStatLight label="Avg release time" v="< 48hr" sub="↑ from 5 days last quarter" />
          </div>
        </div>

        {/* Earnings sparkline */}
        <div style={{padding: 32, borderLeft: "1px solid rgba(255,255,255,0.12)"}}>
          <div className="eyebrow" style={{color: "rgba(251,247,238,0.65)", marginBottom: 14}}>Last 6 months</div>
          <EarningsSparkline />
          <div style={{marginTop: 18, fontSize: 12.5, color: "rgba(251,247,238,0.65)"}}>
            Lifetime: <span style={{color: "white", fontWeight: 600}}>Rs {(2_140_000).toLocaleString()}</span> across 47 collabs
          </div>
        </div>
      </div>
    </div>
  );
}

function MiniStatLight({ label, v, sub }) {
  return (
    <div>
      <div style={{fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", color: "rgba(251,247,238,0.55)", marginBottom: 3}}>{label}</div>
      <div style={{fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 500, letterSpacing: "-0.02em"}} className="tabular">{v}</div>
      <div style={{fontSize: 11, color: "rgba(251,247,238,0.6)", marginTop: 1}}>{sub}</div>
    </div>
  );
}

function EarningsSparkline() {
  const data = [85, 110, 145, 132, 178, 214]; // K PKR
  const max = Math.max(...data);
  const w = 240, h = 80;
  return (
    <svg viewBox={`0 0 ${w} ${h + 30}`} style={{width: "100%", height: 100}}>
      {data.map((v, i) => {
        const x = (i / (data.length - 1)) * w;
        const y = h - (v / max) * (h - 10);
        const barH = h - y;
        return (
          <g key={i}>
            <rect x={x - 14} y={y + 5} width="22" height={barH - 5}
              fill={i === data.length - 1 ? "var(--accent)" : "rgba(255,255,255,0.4)"}
              rx="3" />
            <text x={x} y={h + 18} textAnchor="middle" fill="rgba(255,255,255,0.55)" fontSize="10" fontWeight="500">
              {["Dec", "Jan", "Feb", "Mar", "Apr", "May"][i]}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function TodayList({ items, onRoute }) {
  return (
    <div className="card" style={{padding: 0, overflow: "hidden"}}>
      <div className="row" style={{padding: "16px 20px", borderBottom: "1px solid var(--line)", justifyContent: "space-between"}}>
        <div>
          <div className="eyebrow" style={{color: "var(--accent)"}}>Today</div>
          <h3 style={{fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 500, margin: "2px 0 0", letterSpacing: "-0.02em"}}>
            {items.length} things to take care of
          </h3>
        </div>
        <span className="pill accent">{items.filter(x => x.urgent).length} urgent</span>
      </div>
      {items.map(it => (
        <button key={it.id} onClick={() => onRoute(it.route)} className="row" style={{
          width: "100%", padding: "14px 20px", gap: 14,
          borderBottom: "1px solid var(--line)", background: "var(--paper)",
          cursor: "pointer", textAlign: "left",
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: 8,
            background: it.urgent ? "var(--accent-soft)" : "var(--bg)",
            display: "grid", placeItems: "center", flexShrink: 0,
            fontSize: 16,
          }}>{it.icon}</div>
          <div style={{flex: 1, minWidth: 0}}>
            <div style={{fontSize: 14, fontWeight: 600, marginBottom: 2}}>{it.title}</div>
            <div className="muted" style={{fontSize: 12}}>{it.sub}</div>
          </div>
          <span style={{color: "var(--ink-3)"}}>{Icon.arrow}</span>
        </button>
      ))}
    </div>
  );
}

function BriefMatches({ onRoute }) {
  const D = window.ALAMUT_DATA;
  const open = D.CAMPAIGNS.filter(c => c.status !== "Completed").slice(0, 3);
  return (
    <div className="card" style={{padding: 0, overflow: "hidden"}}>
      <div className="row" style={{padding: "16px 20px", borderBottom: "1px solid var(--line)", justifyContent: "space-between"}}>
        <div>
          <div className="eyebrow">Briefs matching you</div>
          <h3 style={{fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 500, margin: "2px 0 0", letterSpacing: "-0.02em"}}>
            12 brands looking for your audience
          </h3>
        </div>
        <button className="btn sm outline" onClick={() => onRoute("creator-campaigns")}>See all</button>
      </div>
      <div style={{padding: 12, display: "flex", flexDirection: "column", gap: 8}}>
        {open.map((c, i) => (
          <div key={c.id} className="row" style={{
            padding: 12, gap: 12,
            border: "1px solid var(--line)", borderRadius: "var(--r-md)",
          }}>
            <div style={{
              width: 44, height: 44, borderRadius: 10,
              background: "linear-gradient(135deg, var(--accent), var(--gold))",
              color: "white", display: "grid", placeItems: "center",
              fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 600, flexShrink: 0,
            }}>{c.brand[0]}</div>
            <div style={{flex: 1, minWidth: 0}}>
              <div className="row" style={{gap: 6}}>
                <span style={{fontWeight: 600, fontSize: 13.5}}>{c.brand}</span>
                <span style={{
                  fontSize: 10, fontWeight: 700, padding: "1px 6px",
                  borderRadius: "var(--r-pill)",
                  background: i === 0 ? "var(--moss-soft)" : "var(--bg-2)",
                  color: i === 0 ? "var(--moss)" : "var(--ink-3)",
                }}>{[94, 87, 72][i]}% match</span>
              </div>
              <div className="muted" style={{fontSize: 12, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis"}}>{c.name}</div>
              <div className="row" style={{gap: 8, marginTop: 4}}>
                <span style={{fontSize: 12, fontWeight: 600, color: "var(--moss)"}} className="tabular">
                  Rs {Math.round(c.budget / Math.max(c.creators.length, 4) / 1000)}K
                </span>
                <span className="muted" style={{fontSize: 11}}>· Due {c.deadline}</span>
              </div>
            </div>
            <button className="btn sm primary" onClick={() => onRoute("brief:" + c.id)}>Apply</button>
          </div>
        ))}
      </div>
    </div>
  );
}

function StorefrontPulse({ onRoute }) {
  return (
    <div className="card card-pad-lg">
      <div className="row" style={{justifyContent: "space-between", marginBottom: 16}}>
        <div>
          <div className="eyebrow">Your storefront</div>
          <h3 style={{fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 500, margin: "2px 0 0", letterSpacing: "-0.02em"}}>
            alamut.pk/<span style={{color: "var(--accent)"}}>@hira</span>
          </h3>
        </div>
        <button className="btn sm outline" onClick={() => onRoute("storefront-public")}>{Icon.external}</button>
      </div>

      <div className="grid-3" style={{gap: 12, marginBottom: 16}}>
        <MiniStat n="2,140" l="views" sub="↑ 28% / 30d" />
        <MiniStat n="14" l="brand inquiries" sub="↑ 4 this week" />
        <MiniStat n="4.8" l="avg rating" sub="from 23 collabs" />
      </div>

      <div style={{padding: 12, background: "var(--bg)", borderRadius: "var(--r-md)", marginBottom: 12}}>
        <div className="eyebrow" style={{marginBottom: 6}}>Recent brand viewers</div>
        <div className="row" style={{gap: -8}}>
          {["S", "F", "P", "B"].map((l, i) => (
            <div key={i} style={{
              width: 28, height: 28, borderRadius: "50%",
              background: ["var(--accent)", "var(--moss)", "var(--gold)", "var(--info)"][i],
              color: "white", display: "grid", placeItems: "center",
              fontSize: 11, fontWeight: 700,
              border: "2px solid var(--paper)",
              marginLeft: i === 0 ? 0 : -8,
            }}>{l}</div>
          ))}
          <span className="muted" style={{fontSize: 12, marginLeft: 8}}>Sapphire, Foodpanda, PostEx, Bykea + 8 more</span>
        </div>
      </div>

      <div style={{padding: 12, background: "var(--accent-soft)", borderRadius: "var(--r-md)", fontSize: 13}}>
        <div className="eyebrow" style={{color: "var(--accent)", marginBottom: 4}}>✨ Spark suggestion</div>
        Add a "case study" block — creators with case studies get 2.4x more inquiries.
        <button className="btn sm" style={{marginLeft: 8, background: "var(--accent)", color: "white"}} onClick={() => onRoute("storefront")}>Add now</button>
      </div>
    </div>
  );
}

function MiniStat({ n, l, sub }) {
  return (
    <div>
      <div style={{fontFamily: "var(--font-display)", fontSize: 28, fontWeight: 500, letterSpacing: "-0.02em", lineHeight: 1, marginBottom: 4}} className="tabular">{n}</div>
      <div style={{fontSize: 12, fontWeight: 550, marginBottom: 1}}>{l}</div>
      <div className="muted" style={{fontSize: 11}}>{sub}</div>
    </div>
  );
}

function AudiencePulse({ onRoute }) {
  return (
    <div className="card card-pad-lg">
      <div className="row" style={{justifyContent: "space-between", marginBottom: 16}}>
        <div>
          <div className="eyebrow">Your audience</div>
          <h3 style={{fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 500, margin: "2px 0 0", letterSpacing: "-0.02em"}}>
            342K · ↑ 1,840 this week
          </h3>
        </div>
        <button className="btn sm outline" onClick={() => onRoute("analytics")}>Analytics</button>
      </div>

      <div style={{marginBottom: 16}}>
        <FollowerSparkline />
      </div>

      <div className="row" style={{gap: 16, marginBottom: 12}}>
        <div style={{flex: 1}}>
          <div className="eyebrow" style={{marginBottom: 6}}>Top cities</div>
          <BarRow label="Karachi" pct={42} />
          <BarRow label="Lahore" pct={28} />
          <BarRow label="Islamabad" pct={14} />
        </div>
        <div style={{flex: 1}}>
          <div className="eyebrow" style={{marginBottom: 6}}>Last post (Reel)</div>
          <div className="tabular" style={{fontSize: 22, fontWeight: 600, letterSpacing: "-0.02em", marginBottom: 4}}>11.5%</div>
          <div className="muted" style={{fontSize: 12, marginBottom: 8}}>ER · vs 4.2% niche avg</div>
          <div style={{padding: "6px 10px", background: "var(--moss-soft)", borderRadius: 6, fontSize: 11.5, color: "var(--moss)", fontWeight: 600}}>
            🎯 Best time to post: tomorrow 9pm
          </div>
        </div>
      </div>
    </div>
  );
}

function FollowerSparkline() {
  const data = [298, 305, 310, 318, 325, 334, 342];
  const w = 320, h = 50;
  const path = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - 290) / 60) * h;
    return `${i === 0 ? "M" : "L"} ${x} ${y}`;
  }).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{width: "100%", height: 50}}>
      <defs>
        <linearGradient id="fg2" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--moss)" stopOpacity="0.3" />
          <stop offset="100%" stopColor="var(--moss)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={path + ` L ${w} ${h} L 0 ${h} Z`} fill="url(#fg2)" />
      <path d={path} fill="none" stroke="var(--moss)" strokeWidth="2.5" />
    </svg>
  );
}

function BarRow({ label, pct }) {
  return (
    <div style={{marginBottom: 6}}>
      <div className="row" style={{justifyContent: "space-between", marginBottom: 3}}>
        <span style={{fontSize: 12}}>{label}</span>
        <span style={{fontSize: 11, color: "var(--ink-3)"}} className="tabular">{pct}%</span>
      </div>
      <div style={{height: 4, background: "var(--bg-2)", borderRadius: 2, overflow: "hidden"}}>
        <div style={{height: "100%", width: pct + "%", background: "var(--accent)"}}></div>
      </div>
    </div>
  );
}

function CreatorGoals({ onRoute }) {
  return (
    <div className="card card-pad-lg">
      <div className="row" style={{justifyContent: "space-between", marginBottom: 16}}>
        <div>
          <div className="eyebrow">May goals</div>
          <h3 style={{fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 500, margin: "2px 0 0", letterSpacing: "-0.02em"}}>
            You're 86% to your monthly target 🎯
          </h3>
        </div>
        <span className="pill moss">Silver tier</span>
      </div>

      <div style={{padding: 14, background: "var(--bg)", borderRadius: "var(--r-md)", marginBottom: 14}}>
        <div className="row" style={{justifyContent: "space-between", marginBottom: 6}}>
          <span style={{fontSize: 13, fontWeight: 600}}>Earnings goal</span>
          <span className="tabular muted" style={{fontSize: 13}}>Rs 214K / 250K</span>
        </div>
        <div style={{height: 6, background: "var(--bg-2)", borderRadius: 3, overflow: "hidden", marginBottom: 6}}>
          <div style={{height: "100%", width: "86%", background: "var(--moss)"}}></div>
        </div>
        <div className="muted" style={{fontSize: 11.5}}>Rs 36K to go · ~1 mid-tier collab</div>
      </div>

      <div className="grid-3" style={{gap: 8}}>
        <Achievement icon="✨" label="3 collabs" sub="this month" done />
        <Achievement icon="📈" label="11% ER" sub="hit target" done />
        <Achievement icon="🚀" label="Gold tier" sub="Rs 36K to unlock" />
      </div>

      <div style={{padding: 12, background: "var(--moss-soft)", borderRadius: "var(--r-md)", marginTop: 14, fontSize: 13}}>
        <span style={{fontWeight: 600}}>Streak: 4 weeks</span>
        <span className="muted"> · Replied to all briefs within 24h. Keep it up to unlock Pro Replies.</span>
      </div>
    </div>
  );
}

function Achievement({ icon, label, sub, done }) {
  return (
    <div style={{
      padding: 10, textAlign: "center",
      border: "1px solid " + (done ? "var(--moss)" : "var(--line)"),
      borderRadius: "var(--r-md)",
      background: done ? "var(--moss-soft)" : "var(--paper)",
    }}>
      <div style={{fontSize: 18, marginBottom: 4, opacity: done ? 1 : 0.4}}>{icon}</div>
      <div style={{fontSize: 12, fontWeight: 600, color: done ? "var(--moss)" : "var(--ink-3)"}}>{label}</div>
      <div className="muted" style={{fontSize: 10}}>{sub}</div>
    </div>
  );
}

function CreatorTip({ onRoute }) {
  return (
    <div className="card" style={{
      padding: 0, overflow: "hidden",
      background: "linear-gradient(135deg, var(--paper) 0%, var(--accent-soft) 100%)",
    }}>
      <div className="card-pad-lg">
        <div className="eyebrow" style={{color: "var(--accent)", marginBottom: 8}}>Tip of the day</div>
        <h3 style={{fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 500, margin: "0 0 12px", letterSpacing: "-0.02em", lineHeight: 1.2}}>
          Brands pay 30% more for creators who reply within 6 hours.
        </h3>
        <p style={{margin: "0 0 16px", fontSize: 13.5, color: "var(--ink-2)", lineHeight: 1.5}}>
          Your average reply is 18hr. Set up Inbox notifications to JazzCash WhatsApp — it'll move you into the &lt;6h tier.
        </p>
        <div className="row" style={{gap: 8}}>
          <button className="btn primary sm" onClick={() => onRoute("creator-inbox")}>Set up alerts</button>
          <button className="btn ghost sm">More tips</button>
        </div>
      </div>

      <div style={{padding: "12px 24px", borderTop: "1px solid var(--line)", background: "rgba(255,255,255,0.5)"}}>
        <div className="row" style={{gap: 10}}>
          <div className="avatar sm" style={{backgroundImage: "url(https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=200&q=80)"}}></div>
          <div style={{fontSize: 12, color: "var(--ink-3)"}}>
            From <span style={{fontWeight: 600, color: "var(--ink)"}}>Areeba Khan</span>'s playbook · top 1% creator
          </div>
        </div>
      </div>
    </div>
  );
}

window.AlamutHomeV2 = { BrandHomeV2, CreatorHomeV2 };
