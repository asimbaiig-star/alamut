// spark.jsx — Spark AI conversational campaign planner

const { useState: spUseState, useEffect: spUseEffect, useRef: spUseRef, useMemo: spUseMemo } = React;
const { Icon, fmtPKR, fmtFollowers, Topbar, ScoreBadge, PLATFORM_META } = window.AlamutComponents;

// ─── Spark AI ─────────────────────────────────────────────────
function Spark({ onRoute }) {
  const D = window.ALAMUT_DATA;
  const [messages, setMessages] = spUseState([
    {
      role: "assistant",
      type: "text",
      content: "Hi Sara — I'm Spark. Tell me about the campaign you want to run, or pick a quick start below.",
      time: "now",
    },
  ]);
  const [input, setInput] = spUseState("");
  const [thinking, setThinking] = spUseState(false);
  const scrollRef = spUseRef();

  spUseEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, thinking]);

  function send(text) {
    const userText = (text || input).trim();
    if (!userText) return;
    setMessages(m => [...m, { role: "user", type: "text", content: userText, time: "now" }]);
    setInput("");
    setThinking(true);

    setTimeout(() => {
      setThinking(false);
      respond(userText);
    }, 1100);
  }

  function respond(userText) {
    const t = userText.toLowerCase();

    // Heuristic responses for prototype believability
    if (t.includes("hr") || t.includes("linkedin") || t.includes("b2b") || t.includes("newsletter") || t.includes("finance")) {
      const picks = D.CREATORS.filter(c =>
        c.channels.some(ch => ["linkedin", "newsletter"].includes(ch.platform)) ||
        c.categories.some(cat => ["B2B", "Finance", "HR Tech", "Newsletter"].includes(cat))
      );
      setMessages(m => [...m,
        { role: "assistant", type: "text", content: "Got it — Pakistani LinkedIn/B2B creators with HR-adjacent audiences. Pulling from the network…", time: "now" },
        { role: "assistant", type: "creator-table", creators: picks, budget: 1_000_000, placement: "LinkedIn Post + Newsletter Mention", time: "now" },
        { role: "assistant", type: "text", content: "Here's a draft plan. Total: Rs 9.4L for 4 confirmed posts. Want me to trim, swap anyone, or send outreach?", time: "now" },
      ]);
    } else if (t.includes("trim") || t.includes("reduce") || t.includes("smaller") || t.includes("less")) {
      const picks = D.CREATORS.filter(c =>
        c.channels.some(ch => ["linkedin", "newsletter"].includes(ch.platform))
      ).slice(0, 2);
      setMessages(m => [...m,
        { role: "assistant", type: "text", content: "Trimmed to fit. Removed Anum and Ahmer (lower audience overlap). Updated plan:", time: "now" },
        { role: "assistant", type: "creator-table", creators: picks, budget: 500_000, placement: "LinkedIn Post + Newsletter Mention", time: "now" },
      ]);
    } else if (t.includes("eid") || t.includes("fashion") || t.includes("style") || t.includes("lawn")) {
      const picks = D.CREATORS.filter(c =>
        c.categories.some(cat => ["Fashion", "Lifestyle", "Beauty"].includes(cat)) ||
        c.id === "mahnoor" || c.id === "anum"
      );
      setMessages(m => [...m,
        { role: "assistant", type: "text", content: "Searching fashion + lifestyle creators with female-skewing audiences in Karachi & Lahore…", time: "now" },
        { role: "assistant", type: "creator-table", creators: picks, budget: 1_500_000, placement: "Instagram Reel + Stories", time: "now" },
        { role: "assistant", type: "text", content: "Combined reach: 432K. Avg CPE Rs 18. Want to add another tier (mid-influencers) or send outreach?", time: "now" },
      ]);
    } else if (t.includes("send") || t.includes("outreach")) {
      setMessages(m => [...m,
        { role: "assistant", type: "outreach-preview", time: "now" },
      ]);
    } else if (t.includes("travel") || t.includes("youtube") || t.includes("video")) {
      const picks = D.CREATORS.filter(c => c.channels.some(ch => ch.platform === "youtube"));
      setMessages(m => [...m,
        { role: "assistant", type: "text", content: "Found YouTube travel creators. Zenith is by far the strongest fit, but here's a wider net:", time: "now" },
        { role: "assistant", type: "creator-table", creators: picks, budget: 3_000_000, placement: "YouTube Long-form (3 episodes)", time: "now" },
      ]);
    } else {
      setMessages(m => [...m,
        { role: "assistant", type: "text", content: "Tell me a bit more — what's the budget range, the platform you care about, and what audience you want to reach? Or try one of the quick starts below.", time: "now" },
      ]);
    }
  }

  const showWelcome = messages.length === 1;

  return (
    <div style={{height: "100vh", display: "grid", gridTemplateColumns: "260px 1fr", background: "var(--bg)"}}>
      {/* Sessions sidebar */}
      <div style={{borderRight: "1px solid var(--line)", background: "var(--paper)", padding: 16, overflowY: "auto"}}>
        <div className="row" style={{justifyContent: "space-between", marginBottom: 16}}>
          <div className="row" style={{gap: 8}}>
            <div style={{
              width: 28, height: 28, borderRadius: 8,
              background: "linear-gradient(135deg, var(--accent) 0%, var(--gold) 100%)",
              color: "white", display: "grid", placeItems: "center",
            }}>{Icon.spark}</div>
            <div style={{fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 500, letterSpacing: "-0.02em"}}>Spark</div>
          </div>
          <button className="btn sm primary" onClick={() => setMessages([{role:"assistant",type:"text",content:"What are we building?",time:"now"}])}>{Icon.plus}</button>
        </div>

        <div className="eyebrow" style={{marginBottom: 8}}>Today</div>
        {D.SPARK_HISTORY.map((s, i) => (
          <button key={s.id} className="nav-item" style={{
            background: i === 0 ? "var(--bg-2)" : "transparent",
            marginBottom: 2,
          }}>
            <span style={{fontSize: 12.5, fontWeight: 450}}>{s.title}</span>
          </button>
        ))}

        <button onClick={() => onRoute("home")} className="btn ghost sm" style={{marginTop: "auto", width: "100%", justifyContent: "flex-start"}}>
          ← Back to Alamut
        </button>
      </div>

      {/* Chat */}
      <div style={{display: "flex", flexDirection: "column", overflow: "hidden"}}>
        <div style={{padding: "14px 28px", borderBottom: "1px solid var(--line)", background: "var(--paper)",
          display: "flex", alignItems: "center", gap: 12}}>
          <div className="eyebrow">Campaign Planner</div>
          <span className="spacer" />
          <button className="btn sm outline">{Icon.external} Save plan as campaign</button>
        </div>

        <div ref={scrollRef} style={{flex: 1, overflowY: "auto", padding: showWelcome ? 0 : "32px 28px"}}>
          {showWelcome ? (
            <SparkWelcome onPick={send} />
          ) : (
            <div style={{maxWidth: 920, margin: "0 auto", display: "flex", flexDirection: "column", gap: 18}}>
              {messages.map((m, i) => <SparkMessage key={i} msg={m} onRoute={onRoute} />)}
              {thinking && <SparkThinking />}
            </div>
          )}
        </div>

        {/* Composer */}
        <div style={{padding: "16px 28px 24px", background: "var(--bg)"}}>
          <div style={{maxWidth: 920, margin: "0 auto"}}>
            <div className="card" style={{padding: 12, border: "1px solid var(--line-2)", borderRadius: "var(--r-lg)"}}>
              <div className="row" style={{gap: 8, alignItems: "flex-start"}}>
                <span style={{
                  width: 28, height: 28, borderRadius: 8,
                  background: "linear-gradient(135deg, var(--accent) 0%, var(--gold) 100%)",
                  color: "white", display: "grid", placeItems: "center", flexShrink: 0,
                }}>{Icon.spark}</span>
                <textarea
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                  placeholder="Describe your ideal campaign..."
                  rows="1"
                  style={{
                    flex: 1, border: "none", outline: "none", background: "transparent",
                    fontSize: 14.5, padding: "5px 0", resize: "none",
                    fontFamily: "inherit",
                  }}
                />
                <button className="btn primary sm" onClick={() => send()}>{Icon.send}</button>
              </div>
            </div>
            <div className="muted" style={{fontSize: 11, textAlign: "center", marginTop: 8}}>
              Spark uses Claude · Always confirms before sending outreach
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SparkWelcome({ onPick }) {
  const prompts = [
    {
      icon: "💼",
      title: "B2B newsletter sponsors",
      sub: "Find me 5 LinkedIn + Newsletter creators in HR for Rs 10L",
    },
    {
      icon: "👗",
      title: "Eid '26 fashion micro-influencers",
      sub: "20 fashion creators in Karachi/Lahore, female 18–34 audience, Rs 15L budget",
    },
    {
      icon: "🎬",
      title: "YouTube travel series",
      sub: "Travel creators for a 3-episode Northern Pakistan documentary",
    },
    {
      icon: "🍽️",
      title: "Karachi food scene",
      sub: "Food creators under 100K followers in Karachi for an Iftar campaign",
    },
  ];
  return (
    <div style={{padding: "60px 28px 28px", maxWidth: 920, margin: "0 auto"}}>
      <div style={{
        width: 72, height: 72, borderRadius: 18,
        background: "linear-gradient(135deg, var(--accent) 0%, var(--gold) 100%)",
        color: "white", display: "grid", placeItems: "center",
        margin: "0 auto 24px",
        fontSize: 32,
        boxShadow: "0 12px 40px rgba(197, 85, 43, 0.3)",
      }}>✨</div>
      <h1 style={{
        fontFamily: "var(--font-display)", fontSize: 44, fontWeight: 500,
        letterSpacing: "-0.03em", textAlign: "center", margin: "0 0 8px",
        lineHeight: 1.05,
      }}>
        Plan a campaign in a sentence.
      </h1>
      <p className="muted" style={{textAlign: "center", fontSize: 16, margin: "0 0 40px", maxWidth: 540, marginLeft: "auto", marginRight: "auto"}}>
        Tell Spark your audience, budget, and platform — it builds the creator list, projects engagement, and drafts the outreach.
      </p>

      <div className="grid-2" style={{gap: 12, maxWidth: 720, margin: "0 auto"}}>
        {prompts.map(p => (
          <button
            key={p.title}
            onClick={() => onPick(p.sub)}
            className="card card-pad"
            style={{textAlign: "left", cursor: "pointer", transition: "transform 0.12s, border-color 0.12s"}}
            onMouseEnter={e => e.currentTarget.style.borderColor = "var(--accent)"}
            onMouseLeave={e => e.currentTarget.style.borderColor = "var(--line)"}
          >
            <div style={{fontSize: 22, marginBottom: 6}}>{p.icon}</div>
            <div style={{fontWeight: 600, marginBottom: 2, fontSize: 14}}>{p.title}</div>
            <div className="muted" style={{fontSize: 12.5, lineHeight: 1.4}}>{p.sub}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

function SparkMessage({ msg, onRoute }) {
  if (msg.role === "user") {
    return (
      <div style={{alignSelf: "flex-end", maxWidth: "70%"}}>
        <div style={{
          padding: "12px 16px", background: "var(--ink)", color: "var(--paper)",
          borderRadius: "var(--r-lg)", borderBottomRightRadius: 6,
          fontSize: 14.5, lineHeight: 1.45,
        }}>{msg.content}</div>
      </div>
    );
  }

  if (msg.type === "creator-table") {
    return <CreatorTable creators={msg.creators} budget={msg.budget} placement={msg.placement} onRoute={onRoute} />;
  }

  if (msg.type === "outreach-preview") {
    return <OutreachPreview />;
  }

  return (
    <div style={{display: "flex", gap: 10, alignItems: "flex-start"}}>
      <span style={{
        width: 28, height: 28, borderRadius: 8,
        background: "linear-gradient(135deg, var(--accent) 0%, var(--gold) 100%)",
        color: "white", display: "grid", placeItems: "center", flexShrink: 0,
      }}>{Icon.spark}</span>
      <div style={{padding: "8px 0", fontSize: 14.5, lineHeight: 1.55, color: "var(--ink-2)", maxWidth: 720}}>
        {msg.content}
      </div>
    </div>
  );
}

function SparkThinking() {
  return (
    <div style={{display: "flex", gap: 10, alignItems: "center"}}>
      <span style={{
        width: 28, height: 28, borderRadius: 8,
        background: "linear-gradient(135deg, var(--accent) 0%, var(--gold) 100%)",
        color: "white", display: "grid", placeItems: "center",
      }}>{Icon.spark}</span>
      <div style={{display: "flex", gap: 4}}>
        <span className="thinking-dot"></span>
        <span className="thinking-dot" style={{animationDelay: "0.15s"}}></span>
        <span className="thinking-dot" style={{animationDelay: "0.3s"}}></span>
      </div>
      <style>{`
        .thinking-dot {
          width: 6px; height: 6px; border-radius: 50%;
          background: var(--ink-3);
          animation: thinking 1.2s ease-in-out infinite;
        }
        @keyframes thinking {
          0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
          40% { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}

function CreatorTable({ creators, budget, placement, onRoute }) {
  const D = window.ALAMUT_DATA;
  const [list, setList] = spUseState(creators);

  function remove(id) { setList(l => l.filter(c => c.id !== id)); }

  const totalReach = list.reduce((s, c) => s + Math.max(...c.channels.map(ch => ch.followers)), 0);
  const totalCost = list.reduce((s, c) => s + c.rate, 0);
  const projImpressions = Math.round(totalReach * 1.6);
  const projEngagements = Math.round(totalReach * 0.062);
  const cpm = totalCost / (projImpressions / 1000);

  return (
    <div className="card" style={{maxWidth: 920, marginLeft: 38, overflow: "hidden"}}>
      <div style={{padding: "14px 18px", borderBottom: "1px solid var(--line)", background: "var(--bg)"}}>
        <div className="row" style={{justifyContent: "space-between"}}>
          <div>
            <div className="row" style={{gap: 8, marginBottom: 2}}>
              <span className="eyebrow" style={{color: "var(--accent)"}}>✨ Spark proposal</span>
            </div>
            <div style={{fontWeight: 600, fontSize: 14}}>{placement}</div>
          </div>
          <div className="row" style={{gap: 14, fontSize: 12}}>
            <Stat2 label="Reach" value={fmtFollowers(totalReach)} />
            <Stat2 label="Proj. Impr." value={fmtFollowers(projImpressions)} />
            <Stat2 label="Engagement" value={fmtFollowers(projEngagements)} />
            <Stat2 label="CPM" value={`Rs ${Math.round(cpm)}`} />
            <Stat2 label="Total" value={fmtPKR(totalCost)} accent />
          </div>
        </div>
      </div>
      <table className="tbl">
        <thead>
          <tr>
            <th>Creator</th>
            <th>Audience</th>
            <th style={{textAlign: "right"}}>Followers</th>
            <th style={{textAlign: "right"}}>ER</th>
            <th style={{textAlign: "right"}}>Price</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {list.map(c => {
            const top = c.channels.reduce((a, b) => a.followers > b.followers ? a : b);
            return (
              <tr key={c.id}>
                <td>
                  <div className="row">
                    <div className="avatar sm" style={{backgroundImage: `url(${c.avatar})`}}></div>
                    <div>
                      <div style={{fontWeight: 550, fontSize: 13}}>{c.name}</div>
                      <div className="muted" style={{fontSize: 11}}>@{c.handle} · {c.city}</div>
                    </div>
                  </div>
                </td>
                <td style={{fontSize: 12}}>
                  <div>{c.audience.female}% F · {c.audience.age2534}% age 25–34</div>
                  <div className="muted">Top: {c.audience.topCity}</div>
                </td>
                <td className="tabular" style={{textAlign: "right"}}>{fmtFollowers(top.followers)}</td>
                <td className="tabular" style={{textAlign: "right"}}>{top.engagement}%</td>
                <td className="tabular" style={{textAlign: "right", fontWeight: 550}}>{fmtPKR(c.rate)}</td>
                <td>
                  <button className="icon-btn" onClick={() => remove(c.id)} title="Remove">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div style={{padding: 14, borderTop: "1px solid var(--line)", background: "var(--bg)"}}>
        <div className="row" style={{gap: 8}}>
          <button className="btn outline sm">{Icon.plus} Add creator</button>
          <button className="btn outline sm">Optimize for budget</button>
          <span className="spacer" />
          <button className="btn primary sm">Save plan</button>
          <button className="btn accent sm">Send outreach{Icon.arrow}</button>
        </div>
      </div>
    </div>
  );
}

function Stat2({ label, value, accent }) {
  return (
    <div style={{display: "flex", flexDirection: "column", lineHeight: 1.2}}>
      <span className="muted" style={{fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em"}}>{label}</span>
      <span style={{fontWeight: 600, fontSize: 13, color: accent ? "var(--accent)" : "var(--ink)"}} className="tabular">{value}</span>
    </div>
  );
}

function OutreachPreview() {
  const D = window.ALAMUT_DATA;
  const creators = D.CREATORS.filter(c => c.channels.some(ch => ["linkedin","newsletter"].includes(ch.platform))).slice(0,3);
  return (
    <div className="card" style={{maxWidth: 920, marginLeft: 38, overflow: "hidden"}}>
      <div style={{padding: "14px 18px", borderBottom: "1px solid var(--line)", background: "var(--bg)"}}>
        <div className="eyebrow" style={{color: "var(--accent)", marginBottom: 4}}>✨ Review outreach before sending</div>
        <div style={{fontSize: 14}}>I've drafted personalized messages. Review, edit, then send.</div>
      </div>
      <div style={{padding: 14}}>
        {creators.map((c, i) => (
          <div key={c.id} style={{
            padding: 14, marginBottom: 10,
            border: "1px solid var(--line)", borderRadius: "var(--r-md)",
            background: "var(--paper)",
          }}>
            <div className="row" style={{justifyContent: "space-between", marginBottom: 8}}>
              <div className="row">
                <div className="avatar sm" style={{backgroundImage: `url(${c.avatar})`}}></div>
                <div>
                  <div style={{fontWeight: 550, fontSize: 13}}>{c.name}</div>
                  <div className="muted" style={{fontSize: 11}}>Predicted reply: &lt;48h · ~{72 - i*8}%</div>
                </div>
              </div>
              <div className="row" style={{gap: 6}}>
                <button className="btn sm ghost">{Icon.edit}</button>
                <button className="btn sm ghost">Exclude</button>
              </div>
            </div>
            <p style={{fontSize: 13, lineHeight: 1.5, color: "var(--ink-2)", margin: 0,
              padding: 12, background: "var(--bg)", borderRadius: 8}}>
              Hi {c.name.split(" ")[0]}, your recent piece on {c.categories[0].toLowerCase()} was sharp.
              We're at PostEx, and we'd love to commission a sponsored thought-leadership post on logistics
              for D2C brands. PKR {Math.round(c.rate / 1000)}K, full creative control, brief attached.
              Open to chat?
            </p>
          </div>
        ))}
      </div>
      <div style={{padding: 14, borderTop: "1px solid var(--line)", background: "var(--bg)"}}>
        <div className="row" style={{gap: 8}}>
          <button className="btn outline sm">Edit template</button>
          <span className="spacer" />
          <button className="btn ghost sm">Cancel</button>
          <button className="btn accent sm">Send to {creators.length} creators</button>
        </div>
      </div>
    </div>
  );
}

window.AlamutSpark = { Spark };
