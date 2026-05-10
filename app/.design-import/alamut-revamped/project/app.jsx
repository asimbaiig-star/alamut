// app.jsx — Main app shell: routing, sidebar, brand/creator toggle, landing page

const { useState, useEffect, useMemo } = React;
const { Icon, fmtPKR } = window.AlamutComponents;

// ─── ROUTES ──────────────────────────────────────────────────
const BRAND_ROUTES = [
  { id: "home", label: "Home", icon: Icon.home },
  { id: "spark", label: "Spark", icon: Icon.spark, badge: "AI" },
  { id: "discover", label: "Discover", icon: Icon.search },
  { id: "campaigns", label: "Campaigns", icon: Icon.campaign },
  { id: "inbox", label: "Inbox", icon: Icon.inbox, count: 3 },
  { id: "wallet", label: "Wallet", icon: Icon.wallet },
];

const CREATOR_ROUTES = [
  { id: "creator-home", label: "Home", icon: Icon.home },
  { id: "storefront", label: "My storefront", icon: Icon.storefront },
  { id: "creator-campaigns", label: "Browse briefs", icon: Icon.campaign },
  { id: "creator-inbox", label: "Inbox", icon: Icon.inbox, count: 2 },
  { id: "analytics", label: "Analytics", icon: Icon.chart },
  { id: "creator-wallet", label: "Wallet", icon: Icon.wallet },
  { id: "kyc", label: "KYC & Tax", icon: Icon.shield },
];

// ─── APP ──────────────────────────────────────────────────────
function App() {
  const [route, setRoute] = useState("landing");
  const [persona, setPersona] = useState("brand"); // brand | creator

  function go(r) {
    if (r.startsWith("creator-") || r === "storefront" || r === "kyc" || r === "analytics") {
      setPersona("creator");
    } else if (BRAND_ROUTES.find(x => x.id === r) || r === "discover" || r === "campaigns" || r.startsWith("campaign:") || r === "creator:hira") {
      setPersona("brand");
    }
    setRoute(r);
    window.scrollTo(0, 0);
  }

  // Landing page — full-bleed, no shell
  if (route === "landing") {
    return <Landing onRoute={go} />;
  }

  // Spark — full-bleed (own sidebar)
  if (route === "spark") {
    return <window.AlamutSpark.Spark onRoute={go} />;
  }

  // Public storefront preview — minimal chrome
  if (route === "storefront-public") {
    return (
      <div style={{minHeight: "100vh"}}>
        <div style={{position: "sticky", top: 0, zIndex: 10, background: "var(--paper)", borderBottom: "1px solid var(--line)", padding: "10px 20px", display: "flex", alignItems: "center", gap: 12}}>
          <button className="btn ghost sm" onClick={() => go("storefront")}>← Back to editor</button>
          <span className="muted" style={{fontSize: 13}}>Public view · alamut.pk/@hira</span>
          <span className="spacer" />
          <span className="pill moss">Live</span>
        </div>
        <window.AlamutCreatorScreens.Storefront onRoute={go} creatorId="hira" />
      </div>
    );
  }

  return (
    <div className="app-shell">
      <Sidebar persona={persona} setPersona={setPersona} route={route} onRoute={go} />
      <main className="app-main">
        {renderRoute(route, go)}
      </main>
    </div>
  );
}

function renderRoute(route, go) {
  const B = window.AlamutBrandScreens;
  const BC = window.AlamutBrandComms;
  const C = window.AlamutCreatorScreens;

  if (route === "home") return <B.BrandHome onRoute={go} />;
  if (route === "discover") return <B.Discover onRoute={go} />;
  if (route === "campaigns") return <B.Campaigns onRoute={go} />;
  if (route.startsWith("campaign:")) return <B.CampaignDetail onRoute={go} campaignId={route.split(":")[1]} />;
  if (route.startsWith("creator:")) return <B.CreatorProfile onRoute={go} creatorId={route.split(":")[1]} />;
  if (route === "inbox") return <BC.Inbox onRoute={go} />;
  if (route === "wallet") return <BC.Wallet onRoute={go} />;
  if (route === "onboarding") return <B.Onboarding onRoute={go} />;

  if (route === "creator-home") return <C.CreatorHome onRoute={go} />;
  if (route === "storefront") return <C.Storefront onRoute={go} creatorId="hira" editing />;
  if (route === "creator-campaigns") return <C.CreatorCampaigns onRoute={go} />;
  if (route === "creator-inbox") return <BC.Inbox onRoute={go} />;
  if (route === "creator-wallet") return <C.CreatorWallet onRoute={go} />;
  if (route === "kyc") return <C.KYC onRoute={go} />;
  if (route === "analytics") return <C.Analytics onRoute={go} />;

  return <B.BrandHome onRoute={go} />;
}

// ─── SIDEBAR ──────────────────────────────────────────────────
function Sidebar({ persona, setPersona, route, onRoute }) {
  const routes = persona === "brand" ? BRAND_ROUTES : CREATOR_ROUTES;
  const me = persona === "brand"
    ? { name: "Sara Kazmi", sub: "Sapphire Fashion", avatar: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=200&q=80" }
    : { name: "Hira Mansoor", sub: "@hira.mansoor", avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&q=80" };

  return (
    <aside className="sidebar">
      <div style={{padding: "20px 18px 16px"}}>
        <button onClick={() => onRoute("landing")} className="row" style={{gap: 10, background: "none", border: "none", padding: 0, cursor: "pointer", marginBottom: 4}}>
          <div className="brand-mark" style={{width: 32, height: 32}}>
            <svg viewBox="0 0 32 32" width="32" height="32"><path d="M16 4 L28 26 L22 26 L16 14 L10 26 L4 26 Z" fill="var(--ink)" /><circle cx="16" cy="22" r="2" fill="var(--accent)" /></svg>
          </div>
          <div style={{fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 500, letterSpacing: "-0.02em"}}>Alamut</div>
        </button>
      </div>

      {/* Persona toggle */}
      <div style={{padding: "0 14px 14px"}}>
        <div style={{
          display: "grid", gridTemplateColumns: "1fr 1fr",
          gap: 0, padding: 3, background: "var(--bg-2)",
          borderRadius: "var(--r-md)", fontSize: 12,
        }}>
          <button
            onClick={() => { setPersona("brand"); onRoute("home"); }}
            style={{
              padding: "7px 4px",
              background: persona === "brand" ? "var(--paper)" : "transparent",
              boxShadow: persona === "brand" ? "var(--shadow-sm)" : "none",
              border: "none", borderRadius: 6, cursor: "pointer",
              fontWeight: 600, color: persona === "brand" ? "var(--ink)" : "var(--ink-3)",
            }}>Brand</button>
          <button
            onClick={() => { setPersona("creator"); onRoute("creator-home"); }}
            style={{
              padding: "7px 4px",
              background: persona === "creator" ? "var(--paper)" : "transparent",
              boxShadow: persona === "creator" ? "var(--shadow-sm)" : "none",
              border: "none", borderRadius: 6, cursor: "pointer",
              fontWeight: 600, color: persona === "creator" ? "var(--ink)" : "var(--ink-3)",
            }}>Creator</button>
        </div>
      </div>

      <nav style={{flex: 1, padding: "0 10px"}}>
        {routes.map(r => (
          <button
            key={r.id}
            className="nav-item"
            onClick={() => onRoute(r.id)}
            style={{
              background: route === r.id ? "var(--bg-2)" : "transparent",
              color: route === r.id ? "var(--ink)" : "var(--ink-2)",
              fontWeight: route === r.id ? 600 : 450,
            }}>
            <span style={{display: "flex", alignItems: "center", color: route === r.id ? "var(--accent)" : "var(--ink-3)"}}>{r.icon}</span>
            <span style={{flex: 1, textAlign: "left"}}>{r.label}</span>
            {r.badge && <span className="pill accent" style={{fontSize: 10, padding: "1px 6px"}}>{r.badge}</span>}
            {r.count && <span className="pill" style={{fontSize: 10, padding: "1px 6px", background: "var(--ink)", color: "var(--paper)"}}>{r.count}</span>}
          </button>
        ))}
      </nav>

      <div style={{padding: 14, borderTop: "1px solid var(--line)"}}>
        <div className="row" style={{gap: 10}}>
          <div className="avatar md" style={{backgroundImage: `url(${me.avatar})`}}></div>
          <div style={{flex: 1, minWidth: 0}}>
            <div style={{fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis"}}>{me.name}</div>
            <div className="muted" style={{fontSize: 11, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis"}}>{me.sub}</div>
          </div>
          <button className="icon-btn">{Icon.settings}</button>
        </div>
      </div>
    </aside>
  );
}

// ─── LANDING ──────────────────────────────────────────────────
function Landing({ onRoute }) {
  return (
    <div style={{background: "var(--paper)", minHeight: "100vh"}}>
      {/* Nav */}
      <header style={{
        padding: "20px 48px",
        position: "sticky", top: 0, zIndex: 20,
        background: "rgba(251,247,238,0.85)",
        backdropFilter: "blur(12px)",
        borderBottom: "1px solid var(--line)",
      }}>
        <div className="row" style={{maxWidth: 1280, margin: "0 auto"}}>
          <div className="row" style={{gap: 10}}>
            <div className="brand-mark">
              <svg viewBox="0 0 32 32" width="32" height="32"><path d="M16 4 L28 26 L22 26 L16 14 L10 26 L4 26 Z" fill="var(--ink)" /><circle cx="16" cy="22" r="2" fill="var(--accent)" /></svg>
            </div>
            <div style={{fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 500, letterSpacing: "-0.02em"}}>Alamut</div>
          </div>
          <span className="spacer" />
          <nav className="row" style={{gap: 28, fontSize: 14}}>
            <a href="#" style={{color: "var(--ink-2)"}}>For brands</a>
            <a href="#" style={{color: "var(--ink-2)"}}>For creators</a>
            <a href="#" style={{color: "var(--ink-2)"}}>Spark AI</a>
            <a href="#" style={{color: "var(--ink-2)"}}>Pricing</a>
          </nav>
          <span className="spacer" />
          <div className="row" style={{gap: 8}}>
            <button className="btn ghost sm" onClick={() => onRoute("creator-home")}>I'm a creator</button>
            <button className="btn primary sm" onClick={() => onRoute("home")}>Try as brand →</button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section style={{padding: "100px 48px 80px", textAlign: "center", position: "relative", overflow: "hidden"}}>
        <div style={{maxWidth: 980, margin: "0 auto", position: "relative", zIndex: 1}}>
          <div className="pill" style={{marginBottom: 24, background: "var(--accent-soft)", color: "var(--accent)", borderColor: "var(--accent-soft)"}}>
            ✨ Now serving 2,400+ Pakistani creators
          </div>
          <h1 style={{
            fontFamily: "var(--font-display)", fontSize: 96, fontWeight: 500,
            letterSpacing: "-0.045em", lineHeight: 0.98, margin: "0 0 24px",
          }}>
            Pakistan's creator<br/>economy, <em style={{fontStyle: "italic", color: "var(--accent)"}}>operationalized.</em>
          </h1>
          <p style={{fontSize: 22, lineHeight: 1.45, color: "var(--ink-2)", margin: "0 auto 36px", maxWidth: 720, textWrap: "pretty"}}>
            Alamut is the storefront, inbox, and wallet for Pakistani creators —
            and the discovery, escrow, and AI campaign planner for the brands that hire them.
            Settles in PKR via Raast, JazzCash, and Easypaisa.
          </p>
          <div className="row" style={{gap: 12, justifyContent: "center", marginBottom: 60}}>
            <button className="btn accent" style={{padding: "14px 24px", fontSize: 15}} onClick={() => onRoute("home")}>
              Start hiring creators →
            </button>
            <button className="btn outline" style={{padding: "14px 24px", fontSize: 15}} onClick={() => onRoute("creator-home")}>
              Build my storefront
            </button>
          </div>

          {/* Logo strip */}
          <div className="muted" style={{fontSize: 11, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 16}}>
            Trusted by Pakistan's modern brands
          </div>
          <div className="row" style={{gap: 40, justifyContent: "center", flexWrap: "wrap", opacity: 0.6}}>
            {["Daraz", "Foodpanda", "Sapphire", "Bykea", "PostEx", "Servis", "Cheetay"].map(b => (
              <div key={b} style={{fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 500, letterSpacing: "-0.02em"}}>{b}</div>
            ))}
          </div>
        </div>

        {/* Decorative gradient blob */}
        <div style={{
          position: "absolute", top: "30%", right: "10%",
          width: 400, height: 400, borderRadius: "50%",
          background: "radial-gradient(circle, var(--accent) 0%, transparent 70%)",
          opacity: 0.08, filter: "blur(40px)", pointerEvents: "none",
        }}></div>
        <div style={{
          position: "absolute", top: "20%", left: "5%",
          width: 300, height: 300, borderRadius: "50%",
          background: "radial-gradient(circle, var(--moss) 0%, transparent 70%)",
          opacity: 0.08, filter: "blur(40px)", pointerEvents: "none",
        }}></div>
      </section>

      {/* Product preview */}
      <section style={{padding: "0 48px 100px"}}>
        <div style={{maxWidth: 1180, margin: "0 auto"}}>
          <div className="card" style={{
            padding: 16, background: "var(--bg)",
            borderRadius: 24, boxShadow: "var(--shadow-lg)",
          }}>
            <div style={{
              borderRadius: 16, overflow: "hidden",
              background: "linear-gradient(135deg, var(--ink) 0%, #2A2620 100%)",
              padding: "60px 40px", color: "var(--paper)",
              minHeight: 380, display: "grid", placeItems: "center", textAlign: "center",
            }}>
              <div>
                <div style={{
                  fontSize: 56, marginBottom: 16,
                  background: "linear-gradient(135deg, var(--accent) 0%, var(--gold) 100%)",
                  width: 88, height: 88, borderRadius: 22, margin: "0 auto 24px",
                  display: "grid", placeItems: "center",
                }}>✨</div>
                <h2 style={{fontFamily: "var(--font-display)", fontSize: 40, fontWeight: 500, letterSpacing: "-0.02em", margin: "0 0 12px", color: "var(--paper)"}}>
                  "Find me 5 LinkedIn creators in HR for Rs 10L"
                </h2>
                <p style={{fontSize: 17, color: "rgba(251,247,238,0.7)", maxWidth: 520, margin: "0 auto 24px"}}>
                  Spark plans the campaign, drafts outreach, holds funds in escrow,
                  and releases on delivery. Type the brief — Alamut runs the rest.
                </p>
                <button className="btn accent" onClick={() => onRoute("spark")}>
                  Try Spark AI →
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Three pillars */}
      <section style={{padding: "80px 48px", background: "var(--bg-2)"}}>
        <div style={{maxWidth: 1180, margin: "0 auto"}}>
          <div className="eyebrow" style={{textAlign: "center", marginBottom: 12}}>The Alamut platform</div>
          <h2 style={{
            fontFamily: "var(--font-display)", fontSize: 56, fontWeight: 500,
            letterSpacing: "-0.03em", lineHeight: 1.05, textAlign: "center",
            margin: "0 auto 60px", maxWidth: 720, textWrap: "balance",
          }}>
            One platform. Both sides of the table.
          </h2>

          <div className="grid-3" style={{gap: 20}}>
            <Pillar
              icon="🛍️"
              title="Storefront"
              body="Creators get a public page that converts: bio, channels, audience demos, packages, past collabs. One link, every brief."
              cta="See a storefront"
              onClick={() => onRoute("storefront-public")}
            />
            <Pillar
              icon="✨"
              title="Spark AI"
              body="Brands plan in plain English. Spark drafts the creator list, projects engagement, edits with you, and sends outreach."
              cta="Open Spark"
              onClick={() => onRoute("spark")}
              featured
            />
            <Pillar
              icon="💸"
              title="Wallet & Escrow"
              body="Top up via Raast, JazzCash, or Easypaisa. Funds sit in escrow. WHT auto-deducted. Creators withdraw instantly."
              cta="See wallet"
              onClick={() => onRoute("wallet")}
            />
          </div>
        </div>
      </section>

      {/* For creators / for brands split */}
      <section style={{padding: "100px 48px"}}>
        <div style={{maxWidth: 1180, margin: "0 auto"}}>
          <div className="grid-2" style={{gap: 32}}>
            <SplitCard
              eyebrow="For creators"
              title="Stop chasing brands. Start getting briefs."
              points={[
                "Public storefront at alamut.pk/@you",
                "NADRA-verified profile = higher trust, higher rates",
                "Get paid in PKR — JazzCash, Easypaisa, Raast, or bank",
                "FBR-compliant. Tax certificate auto-generated.",
              ]}
              cta="Build my storefront"
              onClick={() => onRoute("creator-home")}
              theme="moss"
            />
            <SplitCard
              eyebrow="For brands"
              title="From brief to live post in 7 days, not 7 weeks."
              points={[
                "Search 2,400+ verified creators by city, audience, ER",
                "Spark AI drafts your shortlist in seconds",
                "Escrow protects both sides until deliverables ship",
                "Single PKR invoice. WHT handled. FBR-ready.",
              ]}
              cta="Try as brand"
              onClick={() => onRoute("home")}
              theme="ink"
            />
          </div>
        </div>
      </section>

      {/* Stats */}
      <section style={{padding: "80px 48px", background: "var(--ink)", color: "var(--paper)"}}>
        <div style={{maxWidth: 1180, margin: "0 auto"}}>
          <div className="grid-4" style={{gap: 32}}>
            <BigStat n="2,400+" l="Verified creators" />
            <BigStat n="Rs 18 cr" l="Paid out in 2025" />
            <BigStat n="48hr" l="Avg time to first reply" />
            <BigStat n="92%" l="Campaigns delivered on time" />
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{padding: "120px 48px"}}>
        <div style={{maxWidth: 880, margin: "0 auto", textAlign: "center"}}>
          <h2 style={{fontFamily: "var(--font-display)", fontSize: 72, fontWeight: 500, letterSpacing: "-0.035em", lineHeight: 1, margin: "0 0 20px", textWrap: "balance"}}>
            The infrastructure layer for Pakistan's creator economy.
          </h2>
          <p style={{fontSize: 19, color: "var(--ink-2)", margin: "0 auto 36px", maxWidth: 600}}>
            Whether you're shipping an Eid campaign or your first sponsored post — Alamut makes it native.
          </p>
          <div className="row" style={{gap: 12, justifyContent: "center"}}>
            <button className="btn accent" style={{padding: "14px 24px", fontSize: 15}} onClick={() => onRoute("home")}>
              Start as brand
            </button>
            <button className="btn outline" style={{padding: "14px 24px", fontSize: 15}} onClick={() => onRoute("creator-home")}>
              Start as creator
            </button>
          </div>
        </div>
      </section>

      <footer style={{padding: "40px 48px", borderTop: "1px solid var(--line)", background: "var(--bg)"}}>
        <div className="row" style={{maxWidth: 1180, margin: "0 auto"}}>
          <div style={{fontFamily: "var(--font-display)", fontWeight: 500, fontSize: 18, letterSpacing: "-0.02em"}}>Alamut</div>
          <span className="spacer" />
          <div className="muted" style={{fontSize: 13}}>© 2026 Alamut Technologies (Pvt) Ltd · Karachi · FBR Reg #4429871</div>
        </div>
      </footer>
    </div>
  );
}

function Pillar({ icon, title, body, cta, onClick, featured }) {
  return (
    <div className="card card-pad-lg" style={{
      cursor: "pointer", transition: "transform 0.15s, box-shadow 0.15s",
      ...(featured && {
        background: "linear-gradient(135deg, var(--accent-soft) 0%, var(--paper) 100%)",
        borderColor: "var(--accent-soft)",
      }),
    }}
      onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "var(--shadow-md)"; }}
      onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = ""; }}
      onClick={onClick}
    >
      <div style={{fontSize: 32, marginBottom: 16}}>{icon}</div>
      <h3 style={{fontFamily: "var(--font-display)", fontSize: 26, fontWeight: 500, margin: "0 0 8px", letterSpacing: "-0.02em"}}>{title}</h3>
      <p style={{margin: "0 0 20px", color: "var(--ink-2)", lineHeight: 1.55, fontSize: 14.5}}>{body}</p>
      <div style={{color: "var(--accent)", fontWeight: 600, fontSize: 14}}>{cta} →</div>
    </div>
  );
}

function SplitCard({ eyebrow, title, points, cta, onClick, theme }) {
  const isInk = theme === "ink";
  return (
    <div style={{
      padding: 40,
      borderRadius: "var(--r-lg)",
      background: isInk ? "var(--ink)" : "var(--moss-soft)",
      color: isInk ? "var(--paper)" : "var(--ink)",
      border: isInk ? "none" : "1px solid var(--line)",
    }}>
      <div className="eyebrow" style={{color: isInk ? "var(--accent-2)" : "var(--moss)", marginBottom: 14}}>{eyebrow}</div>
      <h3 style={{
        fontFamily: "var(--font-display)", fontSize: 36, fontWeight: 500,
        letterSpacing: "-0.025em", margin: "0 0 24px",
        color: isInk ? "var(--paper)" : "var(--ink)",
        textWrap: "balance", lineHeight: 1.1,
      }}>{title}</h3>
      <ul style={{listStyle: "none", padding: 0, margin: "0 0 28px", display: "flex", flexDirection: "column", gap: 10}}>
        {points.map(p => (
          <li key={p} className="row" style={{gap: 10, fontSize: 15, lineHeight: 1.4, color: isInk ? "rgba(251,247,238,0.85)" : "var(--ink-2)"}}>
            <span style={{color: isInk ? "var(--accent-2)" : "var(--moss)", flexShrink: 0, marginTop: 2}}>{Icon.check}</span>
            <span>{p}</span>
          </li>
        ))}
      </ul>
      <button
        className="btn"
        style={isInk
          ? {background: "var(--paper)", color: "var(--ink)"}
          : {background: "var(--moss)", color: "var(--paper)"}}
        onClick={onClick}
      >{cta} →</button>
    </div>
  );
}

function BigStat({ n, l }) {
  return (
    <div>
      <div style={{fontFamily: "var(--font-display)", fontSize: 56, fontWeight: 500, letterSpacing: "-0.03em", lineHeight: 1, marginBottom: 6}} className="tabular">
        {n}
      </div>
      <div style={{fontSize: 13, color: "rgba(251,247,238,0.65)", textTransform: "uppercase", letterSpacing: "0.08em"}}>{l}</div>
    </div>
  );
}

window.AlamutApp = { App };
