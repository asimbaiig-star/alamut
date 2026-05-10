// creator-screens.jsx — Public storefront, block builder, creator home, KYC, analytics, creator wallet

const { useState: crUseState, useMemo: crUseMemo, useEffect: crUseEffect } = React;
const { Icon, PLATFORM_META, fmtPKR, fmtPKRfull, fmtFollowers, Topbar, PlatformChip, ScoreBadge, StagePill } = window.AlamutComponents;

// ─── PUBLIC STOREFRONT ────────────────────────────────────────
function Storefront({ creatorId, onRoute, editing }) {
  const D = window.ALAMUT_DATA;
  const c = D.CREATORS.find(x => x.id === (creatorId || "hira")) || D.CREATORS[0];

  return (
    <div className="storefront-bg" style={{padding: editing ? 0 : "40px 20px 60px"}}>
      {editing && (
        <div style={{
          position: "sticky", top: 0, zIndex: 10,
          background: "var(--paper)", borderBottom: "1px solid var(--line)",
          padding: "12px 28px",
          display: "flex", alignItems: "center", gap: 12,
        }}>
          <div className="eyebrow">Editing storefront</div>
          <span className="muted" style={{fontSize: 12}}>alamut.pk/@{c.handle}</span>
          <span className="spacer" />
          <button className="btn outline sm" onClick={() => onRoute("storefront-public")}>Preview</button>
          <button className="btn primary sm">Publish changes</button>
        </div>
      )}

      <div className="storefront-page" style={{paddingTop: editing ? 32 : 0}}>
        {/* Header */}
        <div style={{
          height: 200, borderRadius: "var(--r-xl)",
          background: `url(${c.cover}) center/cover`,
          marginBottom: -56, position: "relative",
        }}>
          {editing && <BlockEditFab label="Edit cover" />}
        </div>
        <div style={{padding: "0 24px", marginBottom: 16}}>
          <div className="avatar xl" style={{
            backgroundImage: `url(${c.avatar})`,
            border: "6px solid var(--bg)",
            position: "relative",
          }}></div>
        </div>

        <div className="block" style={{position: "relative"}}>
          {editing && <BlockEditFab label="Edit profile" />}
          <div className="row" style={{gap: 8, marginBottom: 4}}>
            <h1 style={{fontFamily: "var(--font-display)", fontSize: 36, fontWeight: 500, margin: 0, letterSpacing: "-0.025em"}}>
              {c.name}
            </h1>
            {c.verified && (
              <span className="pill moss" style={{fontSize: 11}}>{Icon.check} Verified</span>
            )}
          </div>
          <div className="muted" style={{fontSize: 14, marginBottom: 14}}>@{c.handle} · {c.city}, Pakistan</div>
          <p style={{fontSize: 16, lineHeight: 1.55, margin: "0 0 16px", textWrap: "pretty"}}>{c.bio}</p>
          <div className="row" style={{gap: 6, flexWrap: "wrap"}}>
            {c.categories.map(cat => <span key={cat} className="pill">{cat}</span>)}
          </div>
        </div>

        {/* Channels */}
        <div className="block" style={{position: "relative"}}>
          {editing && <BlockEditFab label="Edit channels" />}
          <div className="eyebrow" style={{marginBottom: 12}}>Where I post</div>
          <div className="grid-2" style={{gap: 10}}>
            {c.channels.map(ch => <PlatformChip key={ch.platform} {...ch} />)}
          </div>
        </div>

        {/* Packages */}
        <div className="block" style={{position: "relative"}}>
          {editing && <BlockEditFab label="Edit packages" />}
          <div className="eyebrow" style={{marginBottom: 12}}>Work with me</div>
          <div style={{display: "flex", flexDirection: "column", gap: 10}}>
            <PackageCard
              type="Single"
              title="Sponsored Reel — Instagram"
              desc="1 Reel, 60s max, 1 round of edits. Brief required."
              price={c.rate}
            />
            <PackageCard
              type="Bundle"
              title="Story package (×3)"
              desc="3 Instagram Stories with swipe-up + product tags."
              price={Math.round(c.rate * 0.6)}
            />
            <PackageCard
              type="Multi"
              title="Cross-platform burst"
              desc="1 Reel + 3 Stories + 1 TikTok. 1 week exclusivity included."
              price={Math.round(c.rate * 2.4)}
              featured
            />
          </div>
        </div>

        {/* Audience */}
        <div className="block" style={{position: "relative"}}>
          {editing && <BlockEditFab label="Edit audience" />}
          <div className="eyebrow" style={{marginBottom: 12}}>About my audience</div>
          <div className="grid-3" style={{gap: 10}}>
            <AudienceStat label="Female" value={`${c.audience.female}%`} />
            <AudienceStat label="Age 25–34" value={`${c.audience.age2534}%`} />
            <AudienceStat label="Top city" value={c.audience.topCity} />
          </div>
        </div>

        {/* Past collabs */}
        <div className="block" style={{position: "relative"}}>
          {editing && <BlockEditFab label="Edit collabs" />}
          <div className="eyebrow" style={{marginBottom: 12}}>Past collaborations</div>
          <div className="row" style={{gap: 10, flexWrap: "wrap"}}>
            {c.pastBrands.map(b => (
              <div key={b} style={{
                padding: "10px 16px", border: "1px solid var(--line)",
                borderRadius: "var(--r-md)", fontWeight: 550, fontSize: 13,
                background: "var(--bg)",
              }}>{b}</div>
            ))}
          </div>
        </div>

        {!editing && (
          <div className="card card-pad-lg" style={{
            marginTop: 14, textAlign: "center",
            background: "linear-gradient(135deg, var(--ink) 0%, #2A2620 100%)",
            color: "var(--paper)", borderColor: "transparent",
          }}>
            <h3 style={{fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 500, margin: "0 0 6px", color: "var(--paper)", letterSpacing: "-0.02em"}}>
              Ready to collaborate?
            </h3>
            <p style={{margin: "0 0 16px", color: "rgba(251,247,238,0.75)"}}>I reply within 48 hours. Tell me about your brand and goals.</p>
            <button className="btn accent">Send a brief</button>
          </div>
        )}

        {editing && (
          <button className="btn outline" style={{width: "100%", marginTop: 14, padding: "16px"}}>
            {Icon.plus} Add a new block
          </button>
        )}
      </div>
    </div>
  );
}

function BlockEditFab({ label }) {
  return (
    <button className="btn sm" style={{
      position: "absolute", top: 12, right: 12, zIndex: 2,
      background: "var(--ink)", color: "var(--paper)",
      fontSize: 11, padding: "4px 10px",
    }}>{Icon.edit} {label}</button>
  );
}

function PackageCard({ type, title, desc, price, featured }) {
  return (
    <div style={{
      padding: 16,
      border: featured ? "2px solid var(--accent)" : "1px solid var(--line)",
      borderRadius: "var(--r-md)",
      background: featured ? "var(--accent-soft)" : "var(--bg)",
      position: "relative",
    }}>
      {featured && (
        <div style={{position: "absolute", top: -10, right: 12,
          background: "var(--accent)", color: "var(--paper)",
          padding: "2px 10px", borderRadius: "var(--r-pill)",
          fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em"}}>
          Best value
        </div>
      )}
      <div className="row" style={{justifyContent: "space-between", marginBottom: 4}}>
        <span className="eyebrow">{type}</span>
        <span style={{fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 500, letterSpacing: "-0.02em"}} className="tabular">
          {fmtPKR(price)}
        </span>
      </div>
      <div style={{fontWeight: 550, fontSize: 14.5, marginBottom: 4}}>{title}</div>
      <div className="muted" style={{fontSize: 13}}>{desc}</div>
    </div>
  );
}

function AudienceStat({ label, value }) {
  return (
    <div style={{padding: 14, background: "var(--bg)", borderRadius: "var(--r-md)", textAlign: "center"}}>
      <div style={{fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 500, letterSpacing: "-0.02em"}}>{value}</div>
      <div className="muted" style={{fontSize: 11.5, marginTop: 2}}>{label}</div>
    </div>
  );
}

// ─── CREATOR HOME ─────────────────────────────────────────────
function CreatorHome({ onRoute }) {
  const D = window.ALAMUT_DATA;
  const cw = D.CREATOR_WALLET;
  return (
    <>
      <Topbar
        title="Hi Hira 👋"
        crumb="Lifestyle creator · Lahore"
        actions={<button className="btn primary" onClick={() => onRoute("storefront")}>{Icon.edit} Edit storefront</button>}
      />
      <div className="content">
        <div className="grid-4" style={{marginBottom: 24}}>
          <StatCard2 label="Available" value={fmtPKR(cw.available)} sub="Ready to withdraw" accent />
          <StatCard2 label="Pending" value={fmtPKR(cw.pending)} sub="In escrow / review" />
          <StatCard2 label="Lifetime earnings" value={fmtPKR(cw.lifetime)} sub="Across 47 collabs" />
          <StatCard2 label="Storefront views" value="2,140" sub="Last 30 days · ↑ 28%" />
        </div>

        <div className="grid-2" style={{gridTemplateColumns: "1.4fr 1fr", gap: 24, alignItems: "flex-start"}}>
          <div className="card card-pad-lg">
            <div className="row" style={{justifyContent: "space-between", marginBottom: 16}}>
              <h2 style={{fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 500, margin: 0, letterSpacing: "-0.02em"}}>Active collaborations</h2>
              <button className="btn sm outline" onClick={() => onRoute("creator-inbox")}>View inbox{Icon.arrow}</button>
            </div>
            <div style={{display: "flex", flexDirection: "column", gap: 10}}>
              <CollabRow brand="Sapphire" placement="Instagram Reel + Stories" stage="Live" amount={35000} due="May 18" />
              <CollabRow brand="Foodpanda" placement="Iftar series (3 reels)" stage="Confirmed" amount={45000} due="May 22" />
              <CollabRow brand="Servis" placement="Story package" stage="Negotiating" amount={18000} due="—" />
            </div>
          </div>

          <div className="card card-pad-lg" style={{
            background: "linear-gradient(135deg, var(--ink) 0%, #2A2620 100%)",
            color: "var(--paper)", borderColor: "transparent",
          }}>
            <div className="eyebrow" style={{color: "var(--accent-2)", marginBottom: 8}}>Browse open campaigns</div>
            <h3 style={{fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 500, margin: "0 0 8px", color: "var(--paper)", letterSpacing: "-0.02em"}}>
              12 brands are looking for creators like you
            </h3>
            <p style={{margin: "0 0 16px", color: "rgba(251,247,238,0.7)"}}>Apply to live campaigns matching your audience and rate.</p>
            <button className="btn accent" onClick={() => onRoute("creator-campaigns")}>Browse campaigns{Icon.arrow}</button>
          </div>
        </div>
      </div>
    </>
  );
}

function StatCard2({ label, value, sub, accent }) {
  return (
    <div className="card card-pad" style={accent ? {background: "linear-gradient(135deg, var(--accent-soft), var(--paper))", borderColor: "var(--accent-soft)"} : {}}>
      <div className="stat-label">{label}</div>
      <div className="stat-value tabular">{value}</div>
      <div className="stat-sub">{sub}</div>
    </div>
  );
}

function CollabRow({ brand, placement, stage, amount, due }) {
  return (
    <div className="row" style={{padding: "12px 14px", border: "1px solid var(--line)", borderRadius: "var(--r-md)", gap: 12}}>
      <div style={{flex: 1}}>
        <div style={{fontWeight: 600, fontSize: 14}}>{brand}</div>
        <div className="muted" style={{fontSize: 12}}>{placement} · Due {due}</div>
      </div>
      <span className="tabular" style={{fontWeight: 550}}>{fmtPKR(amount)}</span>
      <StagePill stage={stage} />
    </div>
  );
}

// ─── BROWSE CAMPAIGNS (creator-side) ──────────────────────────
function CreatorCampaigns({ onRoute }) {
  const D = window.ALAMUT_DATA;
  const open = D.CAMPAIGNS.filter(c => c.status !== "Completed");
  return (
    <>
      <Topbar title="Browse campaigns" crumb="Open briefs matching your profile" />
      <div className="content">
        <div className="card" style={{padding: 14, marginBottom: 16}}>
          <div className="row" style={{gap: 8}}>
            <div className="input-search" style={{flex: 1}}>
              {Icon.search}
              <input placeholder="Search campaigns by brand or category..." />
            </div>
            <button className="btn outline">{Icon.filter} Match my niche</button>
          </div>
        </div>

        <div className="grid-2">
          {open.map(c => (
            <div key={c.id} className="card card-pad-lg" style={{cursor: "pointer"}}>
              <div className="row" style={{justifyContent: "space-between", marginBottom: 8}}>
                <span className="eyebrow">{c.brand}</span>
                <StagePill stage="Open" />
              </div>
              <h3 style={{fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 500, margin: "0 0 6px", letterSpacing: "-0.02em"}}>{c.name}</h3>
              <p style={{fontSize: 13.5, lineHeight: 1.5, color: "var(--ink-2)", margin: "0 0 14px",
                display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden"}}>{c.brief}</p>
              <div className="row" style={{gap: 10, flexWrap: "wrap", marginBottom: 14}}>
                <span className="pill">{c.placement}</span>
                <span className="pill moss">Budget {fmtPKR(Math.round(c.budget / Math.max(c.creators.length, 4)))} per creator</span>
              </div>
              <div className="row" style={{justifyContent: "space-between"}}>
                <span className="muted" style={{fontSize: 12}}>Deadline {c.deadline}</span>
                <button className="btn primary sm">Apply with pitch</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

// ─── CREATOR WALLET ───────────────────────────────────────────
function CreatorWallet({ onRoute }) {
  const D = window.ALAMUT_DATA;
  const cw = D.CREATOR_WALLET;
  const [showWithdraw, setShowWithdraw] = crUseState(false);

  return (
    <>
      <Topbar
        title="My wallet"
        crumb="Hira Mansoor · PKR account"
        actions={<button className="btn accent" onClick={() => setShowWithdraw(true)}>Withdraw to JazzCash</button>}
      />
      <div className="content">
        <div className="card card-pad-lg" style={{
          marginBottom: 24,
          background: "linear-gradient(135deg, var(--moss) 0%, #1F3527 100%)",
          color: "var(--paper)", borderColor: "transparent",
          position: "relative", overflow: "hidden",
        }}>
          <div className="eyebrow" style={{color: "rgba(251,247,238,0.6)", marginBottom: 10}}>Available to withdraw</div>
          <div style={{fontFamily: "var(--font-display)", fontSize: 56, fontWeight: 500, letterSpacing: "-0.04em", lineHeight: 1, marginBottom: 16}} className="tabular">
            {fmtPKRfull(cw.available)}
          </div>
          <div className="row" style={{gap: 24}}>
            <div>
              <div style={{fontSize: 11, opacity: 0.7, textTransform: "uppercase", letterSpacing: "0.08em"}}>Pending in escrow</div>
              <div style={{fontSize: 18, fontWeight: 500}} className="tabular">{fmtPKR(cw.pending)}</div>
            </div>
            <div>
              <div style={{fontSize: 11, opacity: 0.7, textTransform: "uppercase", letterSpacing: "0.08em"}}>Lifetime</div>
              <div style={{fontSize: 18, fontWeight: 500}} className="tabular">{fmtPKR(cw.lifetime)}</div>
            </div>
            <span className="spacer" />
            <button className="btn" style={{background: "var(--paper)", color: "var(--ink)"}} onClick={() => setShowWithdraw(true)}>
              Withdraw funds
            </button>
          </div>
        </div>

        <div className="grid-2" style={{gridTemplateColumns: "1fr 320px", gap: 24, alignItems: "flex-start"}}>
          <div className="card" style={{overflow: "hidden"}}>
            <div className="card-pad" style={{borderBottom: "1px solid var(--line)"}}>
              <h3 style={{fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 500, margin: 0, letterSpacing: "-0.02em"}}>Earnings history</h3>
            </div>
            <table className="tbl">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Source</th>
                  <th style={{textAlign: "right"}}>Gross</th>
                  <th style={{textAlign: "right"}}>Fees</th>
                  <th style={{textAlign: "right"}}>Net</th>
                </tr>
              </thead>
              <tbody>
                {cw.ledger.map((l, i) => (
                  <tr key={i}>
                    <td className="muted" style={{fontSize: 12.5}}>{l.date}</td>
                    <td style={{fontSize: 13.5}}>{l.desc}</td>
                    <td className="tabular muted" style={{textAlign: "right", fontSize: 12}}>{l.gross ? fmtPKR(l.gross) : "—"}</td>
                    <td className="tabular muted" style={{textAlign: "right", fontSize: 12}}>{l.fee ? fmtPKR(l.fee) : "—"}</td>
                    <td className="tabular" style={{textAlign: "right", fontWeight: 550, color: l.amount > 0 ? "var(--moss)" : "var(--ink)"}}>
                      {l.amount > 0 ? "+" : ""}{fmtPKR(l.amount).replace("Rs ", "")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div>
            <div className="card card-pad" style={{marginBottom: 16}}>
              <div className="eyebrow" style={{marginBottom: 12}}>Payout methods</div>
              <PaymentMethod2 name="JazzCash" sub="0345 ••• 4291 · Default" color="#F7941D" />
              <PaymentMethod2 name="Easypaisa" sub="0312 ••• 8830" color="#00B14F" />
              <PaymentMethod2 name="HBL Bank (Raast)" sub="••• 5512" color="#1B3D88" />
              <button className="btn ghost sm" style={{marginTop: 8}}>{Icon.plus} Add method</button>
            </div>

            <div className="card card-pad" style={{background: "var(--accent-soft)", borderColor: "var(--accent-soft)"}}>
              <div className="eyebrow" style={{color: "var(--accent)", marginBottom: 8}}>FBR Tax · 2025–26</div>
              <div style={{fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 500, letterSpacing: "-0.02em", lineHeight: 1.1}} className="tabular">
                {fmtPKR(147_000)}
              </div>
              <div className="muted" style={{fontSize: 12, marginBottom: 12}}>WHT auto-deducted this fiscal year</div>
              <button className="btn outline sm" style={{width: "100%"}} onClick={() => onRoute("kyc")}>
                Download tax certificate
              </button>
            </div>
          </div>
        </div>
      </div>

      {showWithdraw && <WithdrawModal onClose={() => setShowWithdraw(false)} balance={cw.available} />}
    </>
  );
}

function PaymentMethod2({ name, sub, color }) {
  return (
    <div className="row" style={{padding: "8px 0", borderBottom: "1px solid var(--line)", gap: 10}}>
      <div style={{width: 32, height: 32, borderRadius: 8, background: color, color: "white",
        display: "grid", placeItems: "center", fontWeight: 700, fontSize: 11}}>
        {name.slice(0, 2).toUpperCase()}
      </div>
      <div style={{flex: 1}}>
        <div style={{fontSize: 13, fontWeight: 550}}>{name}</div>
        <div className="muted" style={{fontSize: 11}}>{sub}</div>
      </div>
    </div>
  );
}

function WithdrawModal({ onClose, balance }) {
  const [amount, setAmount] = crUseState(balance);
  return (
    <div style={{position: "fixed", inset: 0, background: "rgba(28,26,21,0.5)", zIndex: 100, display: "grid", placeItems: "center", padding: 24}} onClick={onClose}>
      <div className="card card-pad-lg" style={{maxWidth: 440, width: "100%"}} onClick={e => e.stopPropagation()}>
        <h2 style={{fontFamily: "var(--font-display)", fontSize: 26, fontWeight: 500, margin: "0 0 4px", letterSpacing: "-0.02em"}}>Withdraw</h2>
        <p className="muted" style={{margin: "0 0 16px", fontSize: 13}}>Funds arrive instantly via Raast & JazzCash.</p>

        <label className="eyebrow" style={{display: "block", marginBottom: 6}}>Amount</label>
        <div style={{position: "relative", marginBottom: 8}}>
          <span style={{position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "var(--ink-3)"}}>Rs</span>
          <input type="number" value={amount} onChange={e => setAmount(parseInt(e.target.value || 0))}
            className="input" style={{paddingLeft: 36, fontSize: 22, fontWeight: 500, padding: "14px 14px 14px 36px"}} />
        </div>
        <div className="muted" style={{fontSize: 12, marginBottom: 16}}>Available: {fmtPKR(balance)}</div>

        <label className="eyebrow" style={{display: "block", marginBottom: 6}}>Send to</label>
        <button className="row" style={{padding: "12px 14px", border: "2px solid var(--ink)", borderRadius: "var(--r-md)", width: "100%", background: "var(--bg)", marginBottom: 16}}>
          <div style={{width: 28, height: 28, borderRadius: 7, background: "#F7941D", color: "white", display: "grid", placeItems: "center", fontWeight: 700, fontSize: 10}}>JC</div>
          <div style={{flex: 1, textAlign: "left"}}>
            <div style={{fontWeight: 550, fontSize: 13.5}}>JazzCash</div>
            <div className="muted" style={{fontSize: 11}}>0345 ••• 4291 · Instant</div>
          </div>
          <span>{Icon.check}</span>
        </button>

        <div className="row" style={{gap: 8}}>
          <button className="btn outline" style={{flex: 1}} onClick={onClose}>Cancel</button>
          <button className="btn accent" style={{flex: 2}} onClick={onClose}>Withdraw {fmtPKR(amount)}</button>
        </div>
      </div>
    </div>
  );
}

// ─── KYC + TAX ─────────────────────────────────────────────────
function KYC({ onRoute }) {
  const [step, setStep] = crUseState(2);
  return (
    <>
      <Topbar title="KYC & Tax" crumb="Verify your identity to unlock higher payouts" />
      <div className="content" style={{maxWidth: 800}}>
        <div className="card card-pad-lg" style={{marginBottom: 16}}>
          <div className="row" style={{justifyContent: "space-between", marginBottom: 4}}>
            <h2 style={{fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 500, margin: 0, letterSpacing: "-0.02em"}}>Verification status</h2>
            <span className="pill moss">Tier 2 · Verified</span>
          </div>
          <p className="muted" style={{margin: "0 0 20px", fontSize: 13.5}}>Verified via NADRA Verisys on May 1, 2026 · Re-verifies May 2027</p>
          <div className="grid-3" style={{gap: 12}}>
            <KycStep n={1} label="CNIC + phone" done />
            <KycStep n={2} label="NADRA Verisys" done />
            <KycStep n={3} label="Bank / wallet linked" done />
          </div>
        </div>

        <div className="card card-pad-lg" style={{marginBottom: 16}}>
          <div className="eyebrow" style={{marginBottom: 8}}>FBR · Fiscal Year 2025–26</div>
          <h2 style={{fontFamily: "var(--font-display)", fontSize: 28, fontWeight: 500, margin: "0 0 12px", letterSpacing: "-0.02em"}}>
            Tax certificate
          </h2>
          <p style={{margin: "0 0 16px", lineHeight: 1.5}}>
            Alamut auto-deducts the 5% withholding tax (Section 153 / SRO 545) on every payout.
            Your annual statement is filing-ready.
          </p>

          <div className="grid-3" style={{gap: 12, marginBottom: 16}}>
            <TaxStat label="Gross income" value={fmtPKR(2_940_000)} />
            <TaxStat label="WHT deducted" value={fmtPKR(147_000)} accent />
            <TaxStat label="Platform fees" value={fmtPKR(147_000)} />
          </div>

          <div className="row" style={{gap: 8}}>
            <button className="btn primary">Download FY26 certificate (PDF)</button>
            <button className="btn outline">Submit to FBR portal</button>
          </div>
        </div>

        <div className="card card-pad-lg">
          <div className="eyebrow" style={{marginBottom: 8}}>Documents on file</div>
          <DocumentRow label="CNIC (front + back)" status="Verified" />
          <DocumentRow label="Selfie liveness check" status="Verified" />
          <DocumentRow label="JazzCash mobile account" status="Linked" />
          <DocumentRow label="HBL bank (Raast)" status="Linked" />
          <DocumentRow label="NTN registration" status="Optional" />
        </div>
      </div>
    </>
  );
}

function KycStep({ n, label, done }) {
  return (
    <div style={{padding: 14, border: "1px solid var(--line)", borderRadius: "var(--r-md)", background: done ? "var(--moss-soft)" : "var(--bg)"}}>
      <div className="row" style={{gap: 8, marginBottom: 4}}>
        <div style={{width: 22, height: 22, borderRadius: "50%", background: done ? "var(--moss)" : "var(--bg-2)", color: "white", display: "grid", placeItems: "center", fontSize: 11, fontWeight: 700}}>
          {done ? "✓" : n}
        </div>
        <div style={{fontSize: 11.5, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600, color: done ? "var(--moss)" : "var(--ink-3)"}}>
          Step {n}
        </div>
      </div>
      <div style={{fontSize: 13.5, fontWeight: 550}}>{label}</div>
    </div>
  );
}

function TaxStat({ label, value, accent }) {
  return (
    <div style={{padding: 14, background: "var(--bg)", borderRadius: "var(--r-md)"}}>
      <div className="muted" style={{fontSize: 11.5, marginBottom: 4}}>{label}</div>
      <div style={{fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 500, letterSpacing: "-0.02em", color: accent ? "var(--accent)" : "var(--ink)"}} className="tabular">
        {value}
      </div>
    </div>
  );
}

function DocumentRow({ label, status }) {
  return (
    <div className="row" style={{padding: "10px 0", borderBottom: "1px solid var(--line)"}}>
      <span style={{flex: 1, fontSize: 13.5}}>{label}</span>
      <span className="pill moss" style={{fontSize: 11}}>{status}</span>
    </div>
  );
}

// ─── ANALYTICS ─────────────────────────────────────────────────
function Analytics({ onRoute }) {
  return (
    <>
      <Topbar title="Analytics" crumb="Last 90 days" />
      <div className="content">
        <div className="grid-4" style={{marginBottom: 24}}>
          <StatCard2 label="Total reach" value="1.2M" sub="Across 9 collabs" accent />
          <StatCard2 label="Avg engagement" value="6.4%" sub="↑ 0.8% vs prev" />
          <StatCard2 label="Storefront views" value="6,820" sub="From 14 brands" />
          <StatCard2 label="Booking rate" value="74%" sub="Inquiries → confirmed" />
        </div>

        <div className="card card-pad-lg" style={{marginBottom: 16}}>
          <div className="row" style={{justifyContent: "space-between", marginBottom: 16}}>
            <h2 style={{fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 500, margin: 0, letterSpacing: "-0.02em"}}>Earnings trend</h2>
            <select className="input" style={{width: "auto"}}>
              <option>Last 90 days</option>
              <option>Last 12 months</option>
            </select>
          </div>
          <SimpleChart />
        </div>

        <div className="grid-2">
          <div className="card card-pad-lg">
            <div className="eyebrow" style={{marginBottom: 12}}>Top performing posts</div>
            {[
              { brand: "Sapphire", placement: "Eid Reel", impr: "240K", er: 8.1 },
              { brand: "Foodpanda", placement: "Iftar series", impr: "180K", er: 7.4 },
              { brand: "Servis", placement: "Story package", impr: "92K", er: 5.9 },
            ].map((p, i) => (
              <div key={i} className="row" style={{padding: "12px 0", borderBottom: i < 2 ? "1px solid var(--line)" : "none"}}>
                <div style={{flex: 1}}>
                  <div style={{fontWeight: 600, fontSize: 13.5}}>{p.brand} · {p.placement}</div>
                  <div className="muted" style={{fontSize: 12}}>{p.impr} impressions</div>
                </div>
                <div style={{fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 500, color: "var(--moss)", letterSpacing: "-0.02em"}} className="tabular">
                  {p.er}%
                </div>
              </div>
            ))}
          </div>

          <div className="card card-pad-lg">
            <div className="eyebrow" style={{marginBottom: 12}}>Audience growth</div>
            <div style={{display: "flex", flexDirection: "column", gap: 14}}>
              {[
                { p: "instagram", followers: "18.4K", delta: "+12%" },
                { p: "tiktok", followers: "22.0K", delta: "+34%" },
              ].map(c => (
                <div key={c.p} className="row" style={{padding: "10px 14px", border: "1px solid var(--line)", borderRadius: "var(--r-md)"}}>
                  <div style={{width: 28, height: 28, borderRadius: 7, background: PLATFORM_META[c.p].color, color: "white", display: "grid", placeItems: "center"}}>
                    {PLATFORM_META[c.p].icon}
                  </div>
                  <div style={{flex: 1}}>
                    <div style={{fontWeight: 600}} className="tabular">{c.followers}</div>
                    <div className="muted" style={{fontSize: 11}}>{PLATFORM_META[c.p].name}</div>
                  </div>
                  <span className="pill moss" style={{fontSize: 11}}>{c.delta}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function SimpleChart() {
  const points = [12, 18, 14, 22, 28, 24, 32, 38, 30, 42, 48, 45];
  const max = Math.max(...points);
  const w = 600, h = 140;
  const path = points.map((v, i) => {
    const x = (i / (points.length - 1)) * w;
    const y = h - (v / max) * h;
    return `${i === 0 ? "M" : "L"} ${x} ${y}`;
  }).join(" ");
  const area = path + ` L ${w} ${h} L 0 ${h} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h + 20}`} style={{width: "100%", height: 160}}>
      <defs>
        <linearGradient id="cg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.25" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#cg)" />
      <path d={path} fill="none" stroke="var(--accent)" strokeWidth="2" />
      {points.map((v, i) => {
        const x = (i / (points.length - 1)) * w;
        const y = h - (v / max) * h;
        return <circle key={i} cx={x} cy={y} r="3" fill="var(--paper)" stroke="var(--accent)" strokeWidth="2" />;
      })}
    </svg>
  );
}

window.AlamutCreatorScreens = { Storefront, CreatorHome, CreatorCampaigns, CreatorWallet, KYC, Analytics };
