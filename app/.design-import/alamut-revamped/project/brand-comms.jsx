// brand-comms.jsx — Inbox, Wallet, Spark AI for brand-side

const { useState: cUseState, useMemo: cUseMemo, useEffect: cUseEffect, useRef: cUseRef } = React;
const { Icon, PLATFORM_META, fmtPKR, fmtPKRfull, fmtFollowers, Topbar, PlatformChip, ScoreBadge, StagePill } = window.AlamutComponents;

// ─── INBOX (3-pane) ───────────────────────────────────────────
function Inbox({ onRoute }) {
  const D = window.ALAMUT_DATA;
  const [activeId, setActiveId] = cUseState(D.CONVERSATIONS[0].id);
  const [draft, setDraft] = cUseState("");
  const conv = D.CONVERSATIONS.find(c => c.id === activeId);
  const creator = D.CREATORS.find(c => c.id === conv.creatorId);
  const campaign = D.CAMPAIGNS.find(c => c.id === conv.campaignId);
  const messagesRef = cUseRef();

  cUseEffect(() => {
    if (messagesRef.current) messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
  }, [activeId]);

  return (
    <>
      <Topbar title="Inbox" crumb="3 unread · 5 conversations" />
      <div className="content wide" style={{height: "calc(100vh - 56px)", padding: 0, display: "grid",
        gridTemplateColumns: "320px 1fr 340px", borderTop: "0"}}>

        {/* Left: conversation list */}
        <div style={{borderRight: "1px solid var(--line)", background: "var(--paper)", overflowY: "auto"}}>
          <div style={{padding: "14px 16px", borderBottom: "1px solid var(--line)"}}>
            <div className="input-search">
              {Icon.search}
              <input placeholder="Search conversations" />
            </div>
          </div>
          {D.CONVERSATIONS.map(c => {
            const cr = D.CREATORS.find(x => x.id === c.creatorId);
            const isActive = c.id === activeId;
            return (
              <div key={c.id}
                onClick={() => setActiveId(c.id)}
                style={{
                  padding: "14px 16px",
                  borderBottom: "1px solid var(--line)",
                  background: isActive ? "var(--bg)" : "transparent",
                  cursor: "pointer",
                  borderLeft: isActive ? "3px solid var(--accent)" : "3px solid transparent",
                }}>
                <div className="row" style={{gap: 10}}>
                  <div className="avatar md" style={{backgroundImage: `url(${cr.avatar})`}}></div>
                  <div style={{flex: 1, minWidth: 0}}>
                    <div className="row" style={{justifyContent: "space-between", marginBottom: 2}}>
                      <span style={{fontWeight: 600, fontSize: 13.5}}>{cr.name}</span>
                      <span className="muted" style={{fontSize: 11}}>{c.lastAt}</span>
                    </div>
                    <div className="muted" style={{fontSize: 12, marginBottom: 4,
                      whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis"}}>
                      {c.preview}
                    </div>
                    {c.unread > 0 && (
                      <span className="pill accent" style={{fontSize: 10, padding: "1px 6px"}}>
                        {c.unread} new
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Center: thread */}
        <div style={{display: "flex", flexDirection: "column", background: "var(--bg)"}}>
          <div style={{padding: "14px 24px", borderBottom: "1px solid var(--line)", background: "var(--paper)"}}>
            <div className="row">
              <div className="avatar md" style={{backgroundImage: `url(${creator.avatar})`}}></div>
              <div>
                <div className="row" style={{gap: 6}}>
                  <span style={{fontWeight: 600}}>{creator.name}</span>
                  {creator.verified && <span style={{color: "var(--info)", display: "flex"}}>{Icon.check}</span>}
                </div>
                <div className="muted" style={{fontSize: 12}}>@{creator.handle} · {creator.city}</div>
              </div>
              <span className="spacer" />
              <button className="btn sm outline">View storefront {Icon.external}</button>
              <button className="icon-btn">{Icon.more}</button>
            </div>
          </div>

          <div ref={messagesRef} style={{flex: 1, overflowY: "auto", padding: "24px"}}>
            {/* AI assistant suggestion */}
            <div style={{
              maxWidth: 720, margin: "0 auto 20px",
              padding: "10px 14px",
              background: "var(--accent-soft)",
              borderRadius: "var(--r-md)",
              borderLeft: "3px solid var(--accent)",
              fontSize: 12.5,
            }}>
              <span style={{fontWeight: 600, color: "var(--accent)"}}>✨ Spark suggests:</span>{" "}
              <span style={{color: "var(--ink-2)"}}>The brief lands well — confirm timing and lock it. Sara, want me to draft a reply?</span>
            </div>

            <div style={{display: "flex", flexDirection: "column", gap: 12, maxWidth: 720, margin: "0 auto"}}>
              {conv.messages.map((m, i) => (
                <div key={i} style={{
                  display: "flex",
                  flexDirection: m.from === "brand" ? "row-reverse" : "row",
                  alignItems: "flex-end", gap: 8,
                }}>
                  {m.from === "creator" && (
                    <div className="avatar sm" style={{backgroundImage: `url(${creator.avatar})`}}></div>
                  )}
                  <div style={{maxWidth: "70%"}}>
                    <div style={{
                      padding: "10px 14px",
                      borderRadius: "16px",
                      background: m.from === "brand" ? "var(--ink)" : "var(--paper)",
                      color: m.from === "brand" ? "var(--paper)" : "var(--ink)",
                      border: m.from === "brand" ? "none" : "1px solid var(--line)",
                      borderBottomRightRadius: m.from === "brand" ? 4 : 16,
                      borderBottomLeftRadius: m.from === "creator" ? 4 : 16,
                      fontSize: 14, lineHeight: 1.45,
                    }}>{m.text}</div>
                    <div className="muted" style={{
                      fontSize: 10.5, marginTop: 4,
                      textAlign: m.from === "brand" ? "right" : "left",
                    }}>{m.time}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Composer */}
          <div style={{padding: 16, borderTop: "1px solid var(--line)", background: "var(--paper)"}}>
            <div className="card" style={{padding: 8, border: "1px solid var(--line-2)"}}>
              <textarea
                value={draft}
                onChange={e => setDraft(e.target.value)}
                placeholder={`Reply to ${creator.name}...`}
                rows="2"
                style={{
                  width: "100%", border: "none", outline: "none",
                  resize: "none", padding: "8px 10px", background: "transparent",
                  fontSize: 14,
                }}
              />
              <div className="row" style={{justifyContent: "space-between", marginTop: 4}}>
                <div className="row" style={{gap: 4}}>
                  <button className="icon-btn">{Icon.paperclip}</button>
                  <button className="btn sm ghost">{Icon.spark} Draft with Spark</button>
                </div>
                <button className="btn primary sm" onClick={() => setDraft("")}>{Icon.send} Send</button>
              </div>
            </div>
          </div>
        </div>

        {/* Right: collab side panel */}
        <div style={{borderLeft: "1px solid var(--line)", background: "var(--paper)", overflowY: "auto", padding: 20}}>
          <div className="eyebrow" style={{marginBottom: 8}}>Collaboration</div>
          {campaign && (
            <>
              <h3 style={{fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 500, margin: "0 0 4px", letterSpacing: "-0.02em"}}>{campaign.name}</h3>
              <div className="muted" style={{fontSize: 12.5, marginBottom: 14}}>{campaign.brand}</div>

              <div style={{padding: "12px 14px", background: "var(--bg)", borderRadius: "var(--r-md)", marginBottom: 14}}>
                <div className="row" style={{justifyContent: "space-between", marginBottom: 4}}>
                  <span className="muted" style={{fontSize: 11.5}}>Stage</span>
                  <StagePill stage="Confirmed" />
                </div>
                <div className="row" style={{justifyContent: "space-between", marginTop: 8}}>
                  <span className="muted" style={{fontSize: 11.5}}>Agreed price</span>
                  <span style={{fontWeight: 600}} className="tabular">{fmtPKR(creator.rate)}</span>
                </div>
              </div>

              <div className="eyebrow" style={{marginBottom: 8}}>Deliverables</div>
              <div style={{display: "flex", flexDirection: "column", gap: 8, marginBottom: 20}}>
                <Deliverable label="Instagram Reel" status="In review" due="May 18" />
                <Deliverable label="Stories (×3)" status="Pending" due="May 19" />
              </div>

              <div className="eyebrow" style={{marginBottom: 8}}>Payment</div>
              <div className="card" style={{padding: 14, marginBottom: 16, background: "var(--bg)", borderColor: "var(--line)"}}>
                <div className="row" style={{justifyContent: "space-between", fontSize: 12.5, marginBottom: 4}}>
                  <span className="muted">Total</span>
                  <span className="tabular">{fmtPKR(creator.rate)}</span>
                </div>
                <div className="row" style={{justifyContent: "space-between", fontSize: 12.5, marginBottom: 4}}>
                  <span className="muted">In escrow</span>
                  <span className="tabular" style={{color: "var(--accent)"}}>{fmtPKR(creator.rate)}</span>
                </div>
                <div className="row" style={{justifyContent: "space-between", fontSize: 12.5}}>
                  <span className="muted">Released</span>
                  <span className="tabular">Rs 0</span>
                </div>
              </div>

              <button className="btn accent" style={{width: "100%"}}>Approve & release payment</button>
              <button className="btn ghost" style={{width: "100%", marginTop: 6}}>Request revision</button>
            </>
          )}
        </div>
      </div>
    </>
  );
}

function Deliverable({ label, status, due }) {
  const statusColor = status === "In review" ? "var(--accent)" : "var(--ink-3)";
  return (
    <div className="row" style={{
      padding: "10px 12px",
      border: "1px solid var(--line)",
      borderRadius: "var(--r-sm)",
      background: "var(--bg)",
      gap: 10,
    }}>
      <div style={{flex: 1}}>
        <div style={{fontWeight: 550, fontSize: 13}}>{label}</div>
        <div className="muted" style={{fontSize: 11}}>Due {due}</div>
      </div>
      <span style={{color: statusColor, fontSize: 11.5, fontWeight: 600}}>{status}</span>
    </div>
  );
}

// ─── WALLET ───────────────────────────────────────────────────
function Wallet({ onRoute }) {
  const D = window.ALAMUT_DATA;
  const W = D.WALLET;
  const [showTopup, setShowTopup] = cUseState(false);

  return (
    <>
      <Topbar
        title="Wallet"
        crumb="Sapphire Fashion · PKR account"
        actions={<>
          <button className="btn outline">Download statement</button>
          <button className="btn accent" onClick={() => setShowTopup(true)}>{Icon.plus} Top up</button>
        </>}
      />
      <div className="content">
        {/* Balance hero */}
        <div className="card card-pad-lg" style={{
          marginBottom: 24,
          background: "linear-gradient(135deg, var(--ink) 0%, #2A2620 60%, var(--accent) 200%)",
          color: "var(--paper)",
          border: "none",
          position: "relative",
          overflow: "hidden",
        }}>
          <div style={{
            position: "absolute", right: -50, top: -50, width: 280, height: 280,
            borderRadius: "50%",
            background: "radial-gradient(circle, var(--accent) 0%, transparent 60%)",
            opacity: 0.3,
          }}></div>
          <div className="eyebrow" style={{color: "rgba(251,247,238,0.6)", marginBottom: 12}}>Available balance</div>
          <div style={{
            fontFamily: "var(--font-display)",
            fontSize: 56, fontWeight: 500, letterSpacing: "-0.04em",
            lineHeight: 1, marginBottom: 16,
          }} className="tabular">
            {fmtPKRfull(W.available)}
          </div>
          <div className="row" style={{gap: 24, position: "relative", zIndex: 1}}>
            <div>
              <div style={{fontSize: 11, opacity: 0.7, marginBottom: 2, textTransform: "uppercase", letterSpacing: "0.08em"}}>In escrow</div>
              <div style={{fontSize: 18, fontWeight: 500}} className="tabular">{fmtPKR(W.reserved)}</div>
            </div>
            <div>
              <div style={{fontSize: 11, opacity: 0.7, marginBottom: 2, textTransform: "uppercase", letterSpacing: "0.08em"}}>In flight</div>
              <div style={{fontSize: 18, fontWeight: 500}} className="tabular">{fmtPKR(W.inFlight)}</div>
            </div>
            <span className="spacer" />
            <button className="btn" style={{background: "var(--paper)", color: "var(--ink)"}} onClick={() => setShowTopup(true)}>
              {Icon.plus} Top up wallet
            </button>
          </div>
        </div>

        <div className="grid-2" style={{gridTemplateColumns: "1fr 320px", gap: 24, alignItems: "flex-start"}}>
          <div className="card" style={{overflow: "hidden"}}>
            <div className="card-pad" style={{borderBottom: "1px solid var(--line)"}}>
              <div className="row" style={{justifyContent: "space-between"}}>
                <h3 style={{fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 500, margin: 0, letterSpacing: "-0.02em"}}>Recent activity</h3>
                <button className="btn sm ghost">{Icon.filter} All types</button>
              </div>
            </div>
            <table className="tbl">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Description</th>
                  <th>Status</th>
                  <th style={{textAlign: "right"}}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {W.ledger.map((l, i) => (
                  <tr key={i}>
                    <td className="muted" style={{fontSize: 12.5}}>{l.date}</td>
                    <td>
                      <div className="row" style={{gap: 8}}>
                        <span style={{
                          width: 4, height: 4, borderRadius: 2,
                          background: l.amount > 0 ? "var(--moss)" : l.type === "tax" ? "var(--gold)" : l.type === "fee" ? "var(--ink-3)" : "var(--accent)",
                        }}></span>
                        <span style={{fontSize: 13.5}}>{l.desc}</span>
                      </div>
                    </td>
                    <td><span className="muted" style={{fontSize: 12}}>{l.status}</span></td>
                    <td className="tabular" style={{
                      textAlign: "right", fontWeight: 550,
                      color: l.amount > 0 ? "var(--moss)" : "var(--ink)",
                    }}>
                      {l.amount > 0 ? "+" : ""}{fmtPKR(l.amount).replace("Rs ", "")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div>
            <div className="card card-pad" style={{marginBottom: 16}}>
              <div className="eyebrow" style={{marginBottom: 12}}>Top up methods</div>
              <PaymentMethod name="JazzCash" sub="0345 ••• 4291" color="#F7941D" />
              <PaymentMethod name="Easypaisa" sub="0312 ••• 8830" color="#00B14F" />
              <PaymentMethod name="Raast" sub="HBL ••• 5512" color="#1B3D88" />
              <PaymentMethod name="Stripe (USD)" sub="Card ending 4242" color="#635BFF" />
            </div>

            <div className="card card-pad">
              <div className="eyebrow" style={{marginBottom: 8}}>This month</div>
              <div className="row" style={{justifyContent: "space-between", marginBottom: 4, fontSize: 13}}>
                <span>Top-ups</span>
                <span className="tabular">{fmtPKR(2_300_000)}</span>
              </div>
              <div className="row" style={{justifyContent: "space-between", marginBottom: 4, fontSize: 13}}>
                <span>Released to creators</span>
                <span className="tabular">{fmtPKR(840_000)}</span>
              </div>
              <div className="row" style={{justifyContent: "space-between", marginBottom: 4, fontSize: 13}}>
                <span className="muted">Platform fees</span>
                <span className="tabular muted">{fmtPKR(89_000)}</span>
              </div>
              <div className="row" style={{justifyContent: "space-between", fontSize: 13}}>
                <span className="muted">FBR WHT collected</span>
                <span className="tabular muted">{fmtPKR(44_500)}</span>
              </div>
              <hr className="hr" />
              <button className="btn outline" style={{width: "100%"}}>Download tax report</button>
            </div>
          </div>
        </div>
      </div>

      {showTopup && <TopupModal onClose={() => setShowTopup(false)} />}
    </>
  );
}

function PaymentMethod({ name, sub, color }) {
  return (
    <div className="row" style={{padding: "8px 0", borderBottom: "1px solid var(--line)", gap: 10}}>
      <div style={{
        width: 32, height: 32, borderRadius: 8,
        background: color, color: "white",
        display: "grid", placeItems: "center",
        fontWeight: 700, fontSize: 11,
      }}>{name.slice(0, 2).toUpperCase()}</div>
      <div style={{flex: 1}}>
        <div style={{fontSize: 13, fontWeight: 550}}>{name}</div>
        <div className="muted" style={{fontSize: 11}}>{sub}</div>
      </div>
    </div>
  );
}

function TopupModal({ onClose }) {
  const [method, setMethod] = cUseState("jazzcash");
  const [amount, setAmount] = cUseState(500000);
  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(28,26,21,0.5)", zIndex: 100,
      display: "grid", placeItems: "center", padding: 24,
    }} onClick={onClose}>
      <div className="card card-pad-lg" style={{maxWidth: 480, width: "100%"}} onClick={e => e.stopPropagation()}>
        <h2 style={{fontFamily: "var(--font-display)", fontSize: 26, fontWeight: 500, margin: "0 0 16px", letterSpacing: "-0.02em"}}>Top up wallet</h2>

        <label className="eyebrow" style={{display: "block", marginBottom: 6}}>Amount</label>
        <div style={{position: "relative", marginBottom: 16}}>
          <span style={{position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "var(--ink-3)"}}>Rs</span>
          <input
            type="number"
            value={amount}
            onChange={e => setAmount(parseInt(e.target.value || 0))}
            className="input"
            style={{paddingLeft: 36, fontSize: 22, fontWeight: 500, padding: "14px 14px 14px 36px"}}
          />
        </div>
        <div className="row" style={{gap: 6, marginBottom: 20, flexWrap: "wrap"}}>
          {[100000, 500000, 1000000, 2500000].map(n => (
            <button key={n} className="btn sm outline" onClick={() => setAmount(n)}>+ {fmtPKR(n)}</button>
          ))}
        </div>

        <label className="eyebrow" style={{display: "block", marginBottom: 6}}>Pay with</label>
        <div className="col" style={{gap: 8, marginBottom: 20}}>
          {[
            ["jazzcash", "JazzCash Mobile Wallet", "Instant · 0% fee", "#F7941D"],
            ["easypaisa", "Easypaisa", "Instant · 0% fee", "#00B14F"],
            ["raast", "Raast (1LINK)", "Instant · 0% fee · QR or Request-to-Pay", "#1B3D88"],
            ["card", "Debit / Credit Card", "T+1 settlement · 1.5% fee", "#635BFF"],
          ].map(([id, label, sub, color]) => (
            <button
              key={id}
              onClick={() => setMethod(id)}
              className="row"
              style={{
                padding: "12px 14px",
                border: method === id ? "2px solid var(--ink)" : "1px solid var(--line)",
                borderRadius: "var(--r-md)",
                background: method === id ? "var(--bg)" : "var(--paper)",
                gap: 12, textAlign: "left", width: "100%",
              }}>
              <div style={{width: 28, height: 28, borderRadius: 7, background: color, color: "white",
                display: "grid", placeItems: "center", fontWeight: 700, fontSize: 10}}>
                {label.slice(0, 2).toUpperCase()}
              </div>
              <div style={{flex: 1}}>
                <div style={{fontWeight: 550, fontSize: 13.5}}>{label}</div>
                <div className="muted" style={{fontSize: 11.5}}>{sub}</div>
              </div>
              {method === id && <span style={{color: "var(--ink)"}}>{Icon.check}</span>}
            </button>
          ))}
        </div>

        <div className="row" style={{gap: 8}}>
          <button className="btn outline" style={{flex: 1}} onClick={onClose}>Cancel</button>
          <button className="btn accent" style={{flex: 2}} onClick={onClose}>
            Top up {fmtPKR(amount)}
          </button>
        </div>
        <div className="muted" style={{fontSize: 11, textAlign: "center", marginTop: 12}}>
          Funds settle to your wallet within seconds. Powered by 1LINK PSP partner.
        </div>
      </div>
    </div>
  );
}

window.AlamutBrandComms = { Inbox, Wallet };
