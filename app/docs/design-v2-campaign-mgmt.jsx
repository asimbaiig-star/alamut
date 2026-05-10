// campaign-mgmt.jsx — Campaign workflow: Wizard, Detail v2, Content Review, Creator Collabs
// Brand-side: NewCampaignWizard, CampaignDetailV2 (tabbed)
// Creator-side: BriefDetail, MyCollabs, CollabDetail

const { useState: cmUseState, useMemo: cmUseMemo, useEffect: cmUseEffect } = React;
const { Icon, fmtPKR, fmtPKRfull, fmtFollowers, Topbar, StagePill, ScoreBadge, PlatformChip } = window.AlamutComponents;

// ════════════════════════════════════════════════════════════════
// BRAND: NEW CAMPAIGN WIZARD (5 steps)
// ════════════════════════════════════════════════════════════════
function NewCampaignWizard({ onRoute }) {
  const D = window.ALAMUT_DATA;
  const [step, setStep] = cmUseState(0);
  const [draft, setDraft] = cmUseState({
    name: "",
    brand: "Sapphire Fashion",
    objective: "awareness",
    brief: "",
    placement: "instagram_reel",
    audienceCity: ["Karachi", "Lahore"],
    audienceGender: "any",
    audienceAge: ["25-34", "18-24"],
    categories: ["Fashion", "Lifestyle"],
    budget: 1500000,
    perCreator: 35000,
    deadline: "2026-06-30",
    invitedCreators: [],
  });

  const steps = ["Brief", "Audience", "Budget & timeline", "Invite creators", "Review & launch"];

  function update(patch) { setDraft(d => ({ ...d, ...patch })); }

  return (
    <>
      <Topbar
        title="New campaign"
        crumb={<span><a onClick={() => onRoute("campaigns")} style={{cursor:"pointer", color:"var(--ink-3)"}}>Campaigns</a> · Draft</span>}
        actions={<>
          <button className="btn ghost" onClick={() => onRoute("campaigns")}>Cancel</button>
          <button className="btn outline">Save as draft</button>
        </>}
      />
      <div className="content" style={{maxWidth: 1080}}>
        {/* Stepper */}
        <div className="card card-pad" style={{marginBottom: 24}}>
          <div style={{display: "grid", gridTemplateColumns: `repeat(${steps.length}, 1fr)`, gap: 0, position: "relative"}}>
            {steps.map((s, i) => (
              <button key={s} onClick={() => i <= step && setStep(i)} style={{
                background: "none", border: "none", padding: "4px 0",
                cursor: i <= step ? "pointer" : "default",
                textAlign: "left", borderTop: i === step ? "2px solid var(--accent)" : i < step ? "2px solid var(--moss)" : "2px solid var(--bg-2)",
                paddingTop: 12,
              }}>
                <div style={{display: "flex", alignItems: "center", gap: 8, marginBottom: 2}}>
                  <span style={{
                    width: 22, height: 22, borderRadius: "50%",
                    display: "grid", placeItems: "center",
                    fontSize: 11, fontWeight: 700,
                    background: i < step ? "var(--moss)" : i === step ? "var(--accent)" : "var(--bg-2)",
                    color: i <= step ? "white" : "var(--ink-3)",
                  }}>{i < step ? "✓" : i + 1}</span>
                  <span className="eyebrow" style={{color: i <= step ? "var(--ink)" : "var(--ink-3)"}}>{s}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="grid-2" style={{gridTemplateColumns: "1fr 320px", gap: 24, alignItems: "flex-start"}}>
          <div className="card card-pad-lg">
            {step === 0 && <StepBrief draft={draft} update={update} />}
            {step === 1 && <StepAudience draft={draft} update={update} />}
            {step === 2 && <StepBudget draft={draft} update={update} />}
            {step === 3 && <StepInvite draft={draft} update={update} />}
            {step === 4 && <StepReview draft={draft} />}

            <hr className="hr" style={{margin: "32px 0 20px"}} />
            <div className="row" style={{justifyContent: "space-between"}}>
              <button className="btn ghost" disabled={step === 0} onClick={() => setStep(s => s - 1)} style={{opacity: step === 0 ? 0.4 : 1}}>← Back</button>
              {step < steps.length - 1 ? (
                <button className="btn primary" onClick={() => setStep(s => s + 1)}>Continue →</button>
              ) : (
                <button className="btn accent" onClick={() => onRoute("campaign:c1")}>{Icon.spark} Launch campaign</button>
              )}
            </div>
          </div>

          <WizardSidebar draft={draft} step={step} />
        </div>
      </div>
    </>
  );
}

function StepBrief({ draft, update }) {
  return (
    <>
      <h2 style={{fontFamily: "var(--font-display)", fontSize: 28, fontWeight: 500, margin: "0 0 6px", letterSpacing: "-0.02em"}}>Tell us about the campaign</h2>
      <p className="muted" style={{margin: "0 0 24px"}}>The brief is what creators see when deciding whether to apply.</p>

      <Field label="Campaign name">
        <input className="input" value={draft.name} onChange={e => update({name: e.target.value})}
          placeholder="e.g. Eid Edit '26 — Sapphire" />
      </Field>

      <Field label="Objective">
        <div className="grid-3" style={{gap: 8}}>
          {[
            ["awareness", "Awareness", "Reach + impressions"],
            ["conversion", "Conversion", "Clicks, signups, sales"],
            ["affinity", "Brand affinity", "Sentiment, association"],
          ].map(([id, label, sub]) => (
            <button key={id} onClick={() => update({objective: id})}
              className="card card-pad" style={{
                textAlign: "left", cursor: "pointer",
                border: draft.objective === id ? "2px solid var(--ink)" : "1px solid var(--line)",
                background: draft.objective === id ? "var(--bg)" : "var(--paper)",
              }}>
              <div style={{fontWeight: 600, fontSize: 14, marginBottom: 2}}>{label}</div>
              <div className="muted" style={{fontSize: 12}}>{sub}</div>
            </button>
          ))}
        </div>
      </Field>

      <Field label="Brief & creative direction">
        <textarea className="input" rows="5" value={draft.brief} onChange={e => update({brief: e.target.value})}
          placeholder="What's the story? What's allowed and what's off-limits? Any reference creators?" />
      </Field>

      <Field label="Placement">
        <select className="input" value={draft.placement} onChange={e => update({placement: e.target.value})}>
          <option value="instagram_reel">Instagram Reel + Stories</option>
          <option value="tiktok">TikTok</option>
          <option value="youtube_long">YouTube Long-form</option>
          <option value="linkedin_post">LinkedIn Post + Newsletter</option>
          <option value="multi">Multi-platform burst</option>
        </select>
      </Field>
    </>
  );
}

function StepAudience({ draft, update }) {
  const cities = ["Karachi", "Lahore", "Islamabad", "Rawalpindi", "Faisalabad", "Multan", "Peshawar"];
  const cats = ["Fashion", "Lifestyle", "Beauty", "Food", "Travel", "Tech", "Finance", "Parenting", "Fitness", "B2B", "Newsletter"];
  const ages = ["18-24", "25-34", "35-44", "45+"];
  return (
    <>
      <h2 style={{fontFamily: "var(--font-display)", fontSize: 28, fontWeight: 500, margin: "0 0 6px", letterSpacing: "-0.02em"}}>Who should this reach?</h2>
      <p className="muted" style={{margin: "0 0 24px"}}>Spark uses these to filter creators by audience overlap.</p>

      <Field label="Cities (audience location)">
        <ChipMulti options={cities} selected={draft.audienceCity} onChange={v => update({audienceCity: v})} />
      </Field>

      <Field label="Gender skew">
        <Segmented options={[["any","Any"],["female","Female-leaning"],["male","Male-leaning"]]}
          value={draft.audienceGender} onChange={v => update({audienceGender: v})} />
      </Field>

      <Field label="Age groups">
        <ChipMulti options={ages} selected={draft.audienceAge} onChange={v => update({audienceAge: v})} />
      </Field>

      <Field label="Creator categories">
        <ChipMulti options={cats} selected={draft.categories} onChange={v => update({categories: v})} />
      </Field>
    </>
  );
}

function StepBudget({ draft, update }) {
  return (
    <>
      <h2 style={{fontFamily: "var(--font-display)", fontSize: 28, fontWeight: 500, margin: "0 0 6px", letterSpacing: "-0.02em"}}>Budget & timeline</h2>
      <p className="muted" style={{margin: "0 0 24px"}}>Funds reserve from your wallet on launch — released on delivery.</p>

      <Field label="Total budget (PKR)">
        <div style={{position: "relative"}}>
          <span style={{position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "var(--ink-3)"}}>Rs</span>
          <input className="input" type="number" value={draft.budget} onChange={e => update({budget: parseInt(e.target.value || 0)})}
            style={{paddingLeft: 36, fontSize: 22, fontWeight: 500, padding: "14px 14px 14px 36px"}} />
        </div>
        <div className="row" style={{gap: 6, marginTop: 8, flexWrap: "wrap"}}>
          {[500000, 1000000, 2000000, 5000000].map(n => (
            <button key={n} className="btn sm outline" onClick={() => update({budget: n})}>{fmtPKR(n)}</button>
          ))}
        </div>
      </Field>

      <Field label="Target price per creator">
        <input className="input" type="number" value={draft.perCreator} onChange={e => update({perCreator: parseInt(e.target.value || 0)})} />
        <div className="muted" style={{fontSize: 12, marginTop: 6}}>
          ≈ {Math.floor(draft.budget / Math.max(draft.perCreator, 1))} creators at this rate
        </div>
      </Field>

      <Field label="Deadline">
        <input className="input" type="date" value={draft.deadline} onChange={e => update({deadline: e.target.value})} />
      </Field>

      <div style={{marginTop: 24, padding: 14, background: "var(--bg)", borderRadius: "var(--r-md)"}}>
        <div className="eyebrow" style={{marginBottom: 8}}>Estimated breakdown</div>
        <Row k="Creator payouts (gross)" v={fmtPKR(Math.round(draft.budget * 0.87))} />
        <Row k="Platform fee (10%)" v={fmtPKR(Math.round(draft.budget * 0.087))} />
        <Row k="FBR WHT (5%)" v={fmtPKR(Math.round(draft.budget * 0.044))} />
        <hr className="hr" />
        <Row k="Total reserved from wallet" v={fmtPKR(draft.budget)} bold />
      </div>
    </>
  );
}

function StepInvite({ draft, update }) {
  const D = window.ALAMUT_DATA;
  const recommended = D.CREATORS.filter(c =>
    c.categories.some(cat => draft.categories.includes(cat))
  );

  function toggle(id) {
    const arr = draft.invitedCreators.includes(id)
      ? draft.invitedCreators.filter(x => x !== id)
      : [...draft.invitedCreators, id];
    update({invitedCreators: arr});
  }

  return (
    <>
      <h2 style={{fontFamily: "var(--font-display)", fontSize: 28, fontWeight: 500, margin: "0 0 6px", letterSpacing: "-0.02em"}}>Invite creators</h2>
      <p className="muted" style={{margin: "0 0 16px"}}>Spark surfaced these matches based on your audience criteria.</p>

      <div style={{padding: "10px 14px", background: "var(--accent-soft)", borderRadius: "var(--r-md)", fontSize: 13, marginBottom: 16}}>
        <span style={{color: "var(--accent)", fontWeight: 600}}>✨ Spark suggests:</span>{" "}
        Start with 6–8 creators across price tiers. We'll auto-shortlist new applicants as they apply.
      </div>

      <div style={{display: "flex", flexDirection: "column", gap: 8}}>
        {recommended.map(c => {
          const top = c.channels.reduce((a, b) => a.followers > b.followers ? a : b);
          const invited = draft.invitedCreators.includes(c.id);
          return (
            <button key={c.id} onClick={() => toggle(c.id)}
              className="row" style={{
                padding: 12, gap: 12,
                border: invited ? "2px solid var(--accent)" : "1px solid var(--line)",
                borderRadius: "var(--r-md)",
                background: invited ? "var(--accent-soft)" : "var(--paper)",
                cursor: "pointer", textAlign: "left", width: "100%",
              }}>
              <div className="avatar md" style={{backgroundImage: `url(${c.avatar})`}}></div>
              <div style={{flex: 1, minWidth: 0}}>
                <div className="row" style={{gap: 6}}>
                  <span style={{fontWeight: 600, fontSize: 14}}>{c.name}</span>
                  {c.verified && <span style={{color: "var(--info)", display: "flex"}}>{Icon.check}</span>}
                </div>
                <div className="muted" style={{fontSize: 12}}>
                  @{c.handle} · {c.city} · {fmtFollowers(top.followers)} on {top.platform} · {top.engagement}% ER
                </div>
              </div>
              <span className="tabular" style={{fontWeight: 550, fontSize: 14}}>{fmtPKR(c.rate)}</span>
              <span style={{
                width: 26, height: 26, borderRadius: "50%",
                background: invited ? "var(--accent)" : "var(--bg-2)",
                color: "white", display: "grid", placeItems: "center",
              }}>{invited ? "✓" : "+"}</span>
            </button>
          );
        })}
      </div>

      <button className="btn outline" style={{marginTop: 16, width: "100%"}}>
        {Icon.search} Browse all creators
      </button>
    </>
  );
}

function StepReview({ draft }) {
  const D = window.ALAMUT_DATA;
  const invited = draft.invitedCreators.map(id => D.CREATORS.find(c => c.id === id)).filter(Boolean);
  return (
    <>
      <h2 style={{fontFamily: "var(--font-display)", fontSize: 28, fontWeight: 500, margin: "0 0 6px", letterSpacing: "-0.02em"}}>Review & launch</h2>
      <p className="muted" style={{margin: "0 0 24px"}}>Funds reserve to escrow on launch. You can pause anytime.</p>

      <ReviewSection title="Brief">
        <ReviewKV k="Name" v={draft.name || "—"} />
        <ReviewKV k="Objective" v={draft.objective} />
        <ReviewKV k="Placement" v={draft.placement.replace(/_/g, " ")} />
        <ReviewKV k="Brief" v={draft.brief || "—"} />
      </ReviewSection>

      <ReviewSection title="Audience">
        <ReviewKV k="Cities" v={draft.audienceCity.join(", ") || "Any"} />
        <ReviewKV k="Gender" v={draft.audienceGender} />
        <ReviewKV k="Age" v={draft.audienceAge.join(", ")} />
        <ReviewKV k="Categories" v={draft.categories.join(", ")} />
      </ReviewSection>

      <ReviewSection title="Budget">
        <ReviewKV k="Total" v={fmtPKR(draft.budget)} />
        <ReviewKV k="Per creator" v={fmtPKR(draft.perCreator)} />
        <ReviewKV k="Deadline" v={draft.deadline} />
      </ReviewSection>

      <ReviewSection title={`Invited creators (${invited.length})`}>
        {invited.length === 0 && <div className="muted" style={{fontSize: 13}}>None invited yet — Spark will recommend more after launch.</div>}
        <div style={{display: "flex", flexDirection: "column", gap: 6}}>
          {invited.map(c => (
            <div key={c.id} className="row" style={{padding: "6px 0"}}>
              <div className="avatar sm" style={{backgroundImage: `url(${c.avatar})`}}></div>
              <span style={{flex: 1, fontSize: 13.5}}>{c.name}</span>
              <span className="tabular muted" style={{fontSize: 13}}>{fmtPKR(c.rate)}</span>
            </div>
          ))}
        </div>
      </ReviewSection>
    </>
  );
}

function WizardSidebar({ draft, step }) {
  const D = window.ALAMUT_DATA;
  const invitedCount = draft.invitedCreators.length;
  return (
    <div className="card card-pad" style={{position: "sticky", top: 80}}>
      <div className="eyebrow" style={{marginBottom: 12}}>Live preview</div>
      <div style={{fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 500, letterSpacing: "-0.02em", marginBottom: 4}}>
        {draft.name || "Untitled campaign"}
      </div>
      <div className="muted" style={{fontSize: 12, marginBottom: 16}}>{draft.brand}</div>

      <Row k="Objective" v={draft.objective} />
      <Row k="Placement" v={draft.placement.replace(/_/g, " ")} />
      <Row k="Cities" v={draft.audienceCity.length > 1 ? `${draft.audienceCity[0]} +${draft.audienceCity.length-1}` : draft.audienceCity[0] || "—"} />
      <Row k="Categories" v={draft.categories.length > 0 ? draft.categories.length + " selected" : "—"} />
      <hr className="hr" />
      <Row k="Budget" v={fmtPKR(draft.budget)} bold />
      <Row k="Per creator" v={fmtPKR(draft.perCreator)} />
      <Row k="Deadline" v={draft.deadline} />
      <hr className="hr" />
      <Row k="Invited" v={`${invitedCount} creators`} />
      <Row k="Wallet after launch" v={fmtPKR(D.WALLET.available - draft.budget)} />
    </div>
  );
}

// ── Wizard primitives ───────────────────────────────────────
function Field({ label, children }) {
  return (
    <div style={{marginBottom: 18}}>
      <label className="eyebrow" style={{display: "block", marginBottom: 6}}>{label}</label>
      {children}
    </div>
  );
}
function Row({ k, v, bold }) {
  return (
    <div className="row" style={{justifyContent: "space-between", padding: "5px 0", fontSize: 13}}>
      <span className="muted">{k}</span>
      <span className="tabular" style={{fontWeight: bold ? 600 : 450, color: bold ? "var(--ink)" : "var(--ink-2)", textAlign: "right"}}>{v}</span>
    </div>
  );
}
function ChipMulti({ options, selected, onChange }) {
  function toggle(o) {
    onChange(selected.includes(o) ? selected.filter(x => x !== o) : [...selected, o]);
  }
  return (
    <div style={{display: "flex", flexWrap: "wrap", gap: 6}}>
      {options.map(o => {
        const on = selected.includes(o);
        return (
          <button key={o} onClick={() => toggle(o)} className="pill" style={{
            cursor: "pointer", border: "1px solid",
            background: on ? "var(--ink)" : "var(--paper)",
            color: on ? "var(--paper)" : "var(--ink-2)",
            borderColor: on ? "var(--ink)" : "var(--line)",
          }}>{o}</button>
        );
      })}
    </div>
  );
}
function Segmented({ options, value, onChange }) {
  return (
    <div style={{display: "inline-flex", padding: 3, background: "var(--bg-2)", borderRadius: "var(--r-md)"}}>
      {options.map(([id, label]) => (
        <button key={id} onClick={() => onChange(id)} style={{
          padding: "7px 14px", border: "none", borderRadius: 6, cursor: "pointer",
          background: value === id ? "var(--paper)" : "transparent",
          boxShadow: value === id ? "var(--shadow-sm)" : "none",
          fontWeight: 600, fontSize: 13,
          color: value === id ? "var(--ink)" : "var(--ink-3)",
        }}>{label}</button>
      ))}
    </div>
  );
}
function ReviewSection({ title, children }) {
  return (
    <div style={{marginBottom: 20, padding: 16, background: "var(--bg)", borderRadius: "var(--r-md)"}}>
      <div className="eyebrow" style={{marginBottom: 10}}>{title}</div>
      {children}
    </div>
  );
}
function ReviewKV({ k, v }) {
  return (
    <div className="row" style={{justifyContent: "space-between", padding: "4px 0", fontSize: 13}}>
      <span className="muted" style={{flexShrink: 0, marginRight: 12}}>{k}</span>
      <span style={{textAlign: "right", textTransform: k === "Brief" ? "none" : "capitalize"}}>{v}</span>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// BRAND: CAMPAIGN DETAIL V2 (tabbed, with Pipeline, Content review, Performance)
// ════════════════════════════════════════════════════════════════
function CampaignDetailV2({ campaignId, onRoute }) {
  const D = window.ALAMUT_DATA;
  const c = D.CAMPAIGNS.find(x => x.id === campaignId) || D.CAMPAIGNS[0];
  const [tab, setTab] = cmUseState("pipeline");
  const [reviewing, setReviewing] = cmUseState(null); // collab being reviewed

  const collabs = D.COLLABS.filter(x => x.campaignId === c.id);
  const activity = D.CAMPAIGN_ACTIVITY[c.id] || [];
  const perf = D.CAMPAIGN_PERF[c.id];

  const tabs = [
    { id: "pipeline", label: "Pipeline", count: collabs.length },
    { id: "brief", label: "Brief" },
    { id: "content", label: "Content review", count: collabs.filter(x => x.deliverables.some(d => d.status === "in_review")).length },
    { id: "performance", label: "Performance" },
    { id: "settings", label: "Settings" },
  ];

  return (
    <>
      <Topbar
        title={c.name}
        crumb={<span><a onClick={() => onRoute("campaigns")} style={{cursor:"pointer", color:"var(--ink-3)"}}>Campaigns</a> · {c.brand} · <StagePill stage={c.status} /></span>}
        actions={<>
          <button className="btn outline">Pause campaign</button>
          <button className="btn primary">{Icon.plus} Add creators</button>
        </>}
      />
      <div className="content">
        {/* Hero stats */}
        <div className="grid-4" style={{marginBottom: 20}}>
          <StatCard3 label="Budget" value={fmtPKR(c.budget)} sub={`${fmtPKR(c.spent)} committed`} progress={c.spent / c.budget} />
          <StatCard3 label="Pipeline" value={collabs.length.toString()} sub={`${collabs.filter(x => x.stage === "confirmed" || x.stage === "submitted" || x.stage === "approved" || x.stage === "live" || x.stage === "paid").length} confirmed+`} />
          <StatCard3 label="Awaiting review" value={collabs.filter(x => x.deliverables.some(d => d.status === "in_review")).length.toString()} sub="content submissions" accent />
          <StatCard3 label="Days left" value={daysUntil(c.deadline).toString()} sub={`Deadline ${c.deadline}`} />
        </div>

        {/* Tabs */}
        <div className="row" style={{gap: 4, marginBottom: 20, borderBottom: "1px solid var(--line)"}}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              padding: "10px 14px", marginBottom: -1,
              borderBottom: tab === t.id ? "2px solid var(--ink)" : "2px solid transparent",
              fontWeight: tab === t.id ? 600 : 450, fontSize: 13.5,
              color: tab === t.id ? "var(--ink)" : "var(--ink-3)",
            }}>
              {t.label}
              {t.count > 0 && <span className="pill accent" style={{fontSize: 10, padding: "1px 6px", marginLeft: 6}}>{t.count}</span>}
            </button>
          ))}
        </div>

        {tab === "pipeline" && <PipelineKanban campaign={c} collabs={collabs} onReview={setReviewing} onRoute={onRoute} />}
        {tab === "brief" && <BriefView campaign={c} />}
        {tab === "content" && <ContentReviewTab collabs={collabs} onReview={setReviewing} />}
        {tab === "performance" && <PerformanceTab perf={perf} campaign={c} collabs={collabs} />}
        {tab === "settings" && <SettingsTab campaign={c} />}
      </div>

      {reviewing && <ContentReviewModal collab={reviewing} onClose={() => setReviewing(null)} />}
    </>
  );
}

function daysUntil(dateStr) {
  const target = new Date(dateStr);
  const now = new Date("2026-05-15");
  return Math.max(0, Math.round((target - now) / (1000 * 60 * 60 * 24)));
}

function StatCard3({ label, value, sub, progress, accent }) {
  return (
    <div className="card card-pad" style={accent ? {background: "var(--accent-soft)", borderColor: "var(--accent-soft)"} : {}}>
      <div className="stat-label">{label}</div>
      <div className="stat-value tabular">{value}</div>
      <div className="stat-sub">{sub}</div>
      {progress !== undefined && (
        <div style={{height: 4, background: "var(--bg-2)", borderRadius: 2, overflow: "hidden", marginTop: 10}}>
          <div style={{width: `${Math.min(100, progress * 100)}%`, height: "100%", background: "var(--accent)"}}></div>
        </div>
      )}
    </div>
  );
}

// ── Pipeline Kanban ─────────────────────────────────────────
function PipelineKanban({ campaign, collabs, onReview, onRoute }) {
  const D = window.ALAMUT_DATA;
  const stages = D.PIPELINE_STAGES;

  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: `repeat(${stages.length}, minmax(220px, 1fr))`,
      gap: 12, overflowX: "auto", paddingBottom: 12,
    }}>
      {stages.map(s => {
        const items = collabs.filter(x => x.stage === s.id);
        return (
          <div key={s.id} style={{minWidth: 220}}>
            <div className="row" style={{padding: "0 4px 10px", justifyContent: "space-between"}}>
              <div className="row" style={{gap: 6}}>
                <span style={{width: 8, height: 8, borderRadius: 2, background: s.color}}></span>
                <span style={{fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--ink-2)"}}>
                  {s.label}
                </span>
                <span className="muted" style={{fontSize: 12}}>{items.length}</span>
              </div>
              <button className="icon-btn" style={{width: 22, height: 22}}>{Icon.plus}</button>
            </div>
            <div style={{display: "flex", flexDirection: "column", gap: 8, minHeight: 100}}>
              {items.map(x => {
                const cr = D.CREATORS.find(c => c.id === x.creatorId);
                if (!cr) return null;
                const hasReview = x.deliverables.some(d => d.status === "in_review");
                return (
                  <div key={x.id} className="card" style={{
                    padding: 12, cursor: "pointer", borderColor: hasReview ? "var(--accent)" : "var(--line)",
                  }} onClick={() => hasReview ? onReview(x) : onRoute("creator:" + cr.id)}>
                    <div className="row" style={{marginBottom: 8}}>
                      <div className="avatar sm" style={{backgroundImage: `url(${cr.avatar})`}}></div>
                      <div style={{minWidth: 0, flex: 1}}>
                        <div style={{fontSize: 13, fontWeight: 550, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis"}}>
                          {cr.name}
                        </div>
                        <div className="muted" style={{fontSize: 11}}>{cr.city}</div>
                      </div>
                    </div>
                    {x.price > 0 && (
                      <div className="row" style={{justifyContent: "space-between", fontSize: 12}}>
                        <span className="muted">{x.deliverables.length} deliverable{x.deliverables.length !== 1 ? "s" : ""}</span>
                        <span className="tabular" style={{fontWeight: 550}}>{fmtPKR(x.price)}</span>
                      </div>
                    )}
                    {hasReview && (
                      <div style={{
                        marginTop: 8, padding: "4px 8px",
                        background: "var(--accent)", color: "var(--paper)",
                        borderRadius: 4, fontSize: 11, fontWeight: 600, textAlign: "center",
                      }}>Review pending</div>
                    )}
                  </div>
                );
              })}
              {items.length === 0 && (
                <div style={{
                  padding: 16, border: "1px dashed var(--line-2)",
                  borderRadius: "var(--r-md)", textAlign: "center",
                  color: "var(--ink-4)", fontSize: 12,
                }}>Empty</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Brief tab ────────────────────────────────────────────────
function BriefView({ campaign }) {
  return (
    <div className="grid-2" style={{gridTemplateColumns: "1fr 320px", gap: 24, alignItems: "flex-start"}}>
      <div className="card card-pad-lg">
        <div className="row" style={{justifyContent: "space-between", marginBottom: 16}}>
          <h3 style={{fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 500, margin: 0, letterSpacing: "-0.02em"}}>The brief</h3>
          <button className="btn sm outline">{Icon.edit} Edit</button>
        </div>
        <p style={{lineHeight: 1.65, color: "var(--ink-2)", margin: "0 0 24px", fontSize: 15}}>{campaign.brief}</p>

        <h4 style={{fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 500, margin: "20px 0 10px"}}>Brand-safe checklist</h4>
        <ul style={{listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8}}>
          {[
            "Show product clearly within first 3 seconds",
            "Use #SapphireEid26 in caption",
            "Tag @sapphirepk and disclose #ad",
            "No flashy hard-cuts; keep it daily-life",
            "Avoid competitor brand mentions",
          ].map(s => (
            <li key={s} className="row" style={{gap: 8, fontSize: 14}}>
              <span style={{color: "var(--moss)"}}>{Icon.check}</span>{s}
            </li>
          ))}
        </ul>

        <h4 style={{fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 500, margin: "24px 0 10px"}}>Reference creators</h4>
        <p className="muted" style={{margin: 0, fontSize: 13}}>Look at @hira.styles' last 5 reels for tone — candid, soft-lit, narrative-driven.</p>
      </div>

      <div className="card card-pad">
        <div className="eyebrow" style={{marginBottom: 12}}>Brief assets</div>
        {[
          { name: "Brand guidelines.pdf", size: "2.4 MB" },
          { name: "Product shot pack.zip", size: "18 MB" },
          { name: "Caption examples.docx", size: "84 KB" },
        ].map(f => (
          <div key={f.name} className="row" style={{padding: "8px 0", borderBottom: "1px solid var(--line)", gap: 10}}>
            <div style={{
              width: 32, height: 32, borderRadius: 6,
              background: "var(--bg-2)", display: "grid", placeItems: "center",
              fontSize: 11, fontWeight: 700, color: "var(--ink-3)",
            }}>PDF</div>
            <div style={{flex: 1, minWidth: 0}}>
              <div style={{fontSize: 13, fontWeight: 550, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis"}}>{f.name}</div>
              <div className="muted" style={{fontSize: 11}}>{f.size}</div>
            </div>
            <button className="icon-btn">{Icon.external}</button>
          </div>
        ))}
        <button className="btn sm outline" style={{width: "100%", marginTop: 10}}>{Icon.plus} Upload asset</button>
      </div>
    </div>
  );
}

// ── Content Review tab ─────────────────────────────────────
function ContentReviewTab({ collabs, onReview }) {
  const D = window.ALAMUT_DATA;
  const inReview = collabs.flatMap(x =>
    x.deliverables.filter(d => d.status === "in_review").map(d => ({ collab: x, deliverable: d }))
  );
  const approved = collabs.flatMap(x =>
    x.deliverables.filter(d => d.status === "approved" || d.status === "live").map(d => ({ collab: x, deliverable: d }))
  );

  return (
    <div>
      <h3 style={{fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 500, margin: "0 0 12px", letterSpacing: "-0.02em"}}>
        Awaiting your review
      </h3>
      {inReview.length === 0 && (
        <div className="card card-pad-lg" style={{textAlign: "center", color: "var(--ink-3)", marginBottom: 20}}>
          🎉 All caught up — no submissions awaiting review.
        </div>
      )}
      <div className="grid-3" style={{gap: 12, marginBottom: 32}}>
        {inReview.map(({ collab, deliverable }) => {
          const cr = D.CREATORS.find(c => c.id === collab.creatorId);
          return (
            <div key={deliverable.id} className="card" style={{cursor: "pointer", overflow: "hidden"}}
              onClick={() => onReview(collab)}>
              <div style={{
                aspectRatio: "9/12",
                background: deliverable.thumb ? `url(${deliverable.thumb}) center/cover` : "var(--bg-2)",
                position: "relative",
              }}>
                <div style={{
                  position: "absolute", top: 10, right: 10,
                  background: "var(--accent)", color: "var(--paper)",
                  padding: "3px 10px", borderRadius: "var(--r-pill)",
                  fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em",
                }}>Review</div>
                <div style={{
                  position: "absolute", bottom: 10, left: 10, right: 10,
                  display: "flex", alignItems: "center", gap: 8,
                  color: "white", textShadow: "0 1px 4px rgba(0,0,0,0.5)",
                }}>
                  <div className="avatar sm" style={{backgroundImage: `url(${cr.avatar})`, border: "2px solid white"}}></div>
                  <span style={{fontWeight: 600, fontSize: 13}}>{cr.name}</span>
                </div>
              </div>
              <div className="card-pad">
                <div style={{fontSize: 13, fontWeight: 600, marginBottom: 2}}>{deliverable.label}</div>
                <div className="muted" style={{fontSize: 11.5}}>Submitted {deliverable.submittedAt} · Due {deliverable.due}</div>
              </div>
            </div>
          );
        })}
      </div>

      <h3 style={{fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 500, margin: "0 0 12px", letterSpacing: "-0.02em"}}>
        Approved & live
      </h3>
      <div className="card" style={{overflow: "hidden"}}>
        <table className="tbl">
          <thead><tr><th>Creator</th><th>Deliverable</th><th>Status</th><th>Live link</th><th></th></tr></thead>
          <tbody>
            {approved.map(({ collab, deliverable }) => {
              const cr = D.CREATORS.find(c => c.id === collab.creatorId);
              return (
                <tr key={deliverable.id}>
                  <td>
                    <div className="row">
                      <div className="avatar sm" style={{backgroundImage: `url(${cr.avatar})`}}></div>
                      <span style={{fontWeight: 550}}>{cr.name}</span>
                    </div>
                  </td>
                  <td>{deliverable.label}</td>
                  <td><StagePill stage={deliverable.status === "live" ? "Live" : "Approved"} /></td>
                  <td className="muted" style={{fontSize: 12}}>
                    {deliverable.permalink ? <span style={{color: "var(--info)"}}>{deliverable.permalink} ↗</span> : "—"}
                  </td>
                  <td><button className="btn sm ghost">View</button></td>
                </tr>
              );
            })}
            {approved.length === 0 && (
              <tr><td colSpan="5" style={{textAlign: "center", color: "var(--ink-3)", padding: 32}}>No approved content yet</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Performance tab ─────────────────────────────────────────
function PerformanceTab({ perf, campaign, collabs }) {
  if (!perf) {
    return <div className="card card-pad-lg" style={{textAlign: "center", color: "var(--ink-3)"}}>
      Performance data unlocks once content goes live.
    </div>;
  }
  return (
    <div>
      <div className="grid-4" style={{marginBottom: 20}}>
        <StatCard3 label="Impressions" value={fmtFollowers(perf.impressions)} sub="across all posts" />
        <StatCard3 label="Engagement rate" value={`${perf.er}%`} sub="vs 4.2% category avg" accent />
        <StatCard3 label="CPM" value={`Rs ${perf.cpm.toLocaleString()}`} sub="per 1k impressions" />
        <StatCard3 label="CPE" value={`Rs ${perf.cpe}`} sub="per engagement" />
      </div>

      <div className="grid-2" style={{gridTemplateColumns: "1.4fr 1fr", gap: 20, alignItems: "flex-start"}}>
        <div className="card card-pad-lg">
          <h3 style={{fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 500, margin: "0 0 16px", letterSpacing: "-0.02em"}}>Engagement over time</h3>
          <PerfChart points={perf.weeklySeries} />
        </div>
        <div className="card card-pad-lg">
          <h3 style={{fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 500, margin: "0 0 16px", letterSpacing: "-0.02em"}}>Breakdown</h3>
          <Row k="Reach" v={fmtFollowers(perf.reach)} />
          <Row k="Engagement" v={fmtFollowers(perf.engagement)} />
          <Row k="Saves" v={perf.saves.toLocaleString()} />
          <Row k="Shares" v={perf.shares.toLocaleString()} />
          <Row k="Profile visits" v={perf.profileVisits.toLocaleString()} />
        </div>
      </div>
    </div>
  );
}

function PerfChart({ points }) {
  const max = Math.max(...points);
  const w = 480, h = 160;
  const path = points.map((v, i) => {
    const x = (i / (points.length - 1)) * w;
    const y = h - (v / max) * h;
    return `${i === 0 ? "M" : "L"} ${x} ${y}`;
  }).join(" ");
  const area = path + ` L ${w} ${h} L 0 ${h} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h + 20}`} style={{width: "100%", height: 180}}>
      <defs>
        <linearGradient id="pg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.3" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#pg)" />
      <path d={path} fill="none" stroke="var(--accent)" strokeWidth="2.5" />
      {points.map((v, i) => {
        const x = (i / (points.length - 1)) * w;
        const y = h - (v / max) * h;
        return <circle key={i} cx={x} cy={y} r="4" fill="var(--paper)" stroke="var(--accent)" strokeWidth="2.5" />;
      })}
    </svg>
  );
}

// ── Settings tab ────────────────────────────────────────────
function SettingsTab({ campaign }) {
  return (
    <div className="grid-2" style={{gridTemplateColumns: "1fr 320px", gap: 24, alignItems: "flex-start"}}>
      <div className="card card-pad-lg">
        <h3 style={{fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 500, margin: "0 0 16px", letterSpacing: "-0.02em"}}>Campaign settings</h3>
        <Field label="Campaign name"><input className="input" defaultValue={campaign.name} /></Field>
        <Field label="Visibility">
          <Segmented options={[["public","Public — listed in briefs"],["private","Private — invite only"]]} value="public" onChange={()=>{}} />
        </Field>
        <Field label="Auto-shortlist">
          <label className="row" style={{gap: 10, padding: 12, background: "var(--bg)", borderRadius: "var(--r-md)"}}>
            <input type="checkbox" defaultChecked />
            <div style={{flex: 1}}>
              <div style={{fontWeight: 550, fontSize: 14}}>Let Spark auto-shortlist applicants</div>
              <div className="muted" style={{fontSize: 12}}>Spark will move strong matches to "Pitched" automatically.</div>
            </div>
          </label>
        </Field>

        <hr className="hr" />
        <h4 style={{fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 500, margin: "0 0 12px", color: "var(--accent)"}}>Danger zone</h4>
        <button className="btn outline" style={{borderColor: "var(--accent)", color: "var(--accent)"}}>End campaign & refund unused funds</button>
      </div>

      <div className="card card-pad">
        <div className="eyebrow" style={{marginBottom: 10}}>Team access</div>
        <div className="row" style={{padding: "8px 0", borderBottom: "1px solid var(--line)", gap: 10}}>
          <div className="avatar sm" style={{backgroundImage: "url(https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=200&q=80)"}}></div>
          <div style={{flex: 1}}>
            <div style={{fontSize: 13, fontWeight: 550}}>Sara Kazmi</div>
            <div className="muted" style={{fontSize: 11}}>Owner</div>
          </div>
        </div>
        <div className="row" style={{padding: "8px 0", borderBottom: "1px solid var(--line)", gap: 10}}>
          <div className="avatar sm" style={{background: "var(--bg-2)"}}></div>
          <div style={{flex: 1}}>
            <div style={{fontSize: 13, fontWeight: 550}}>Asad Latif</div>
            <div className="muted" style={{fontSize: 11}}>Editor</div>
          </div>
        </div>
        <button className="btn sm outline" style={{width: "100%", marginTop: 10}}>{Icon.plus} Invite teammate</button>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// CONTENT REVIEW MODAL (brand reviews creator's submission)
// ════════════════════════════════════════════════════════════════
function ContentReviewModal({ collab, onClose }) {
  const D = window.ALAMUT_DATA;
  const cr = D.CREATORS.find(c => c.id === collab.creatorId);
  const deliverable = collab.deliverables.find(d => d.status === "in_review") || collab.deliverables[0];
  const [feedback, setFeedback] = cmUseState("");
  const [action, setAction] = cmUseState(null); // approve | revise

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(28,26,21,0.75)", zIndex: 100,
      display: "grid", placeItems: "center", padding: 24,
    }} onClick={onClose}>
      <div className="card" style={{
        maxWidth: 1100, width: "100%", maxHeight: "90vh",
        display: "grid", gridTemplateColumns: "1.2fr 1fr",
        overflow: "hidden", padding: 0,
      }} onClick={e => e.stopPropagation()}>
        {/* Left: media preview */}
        <div style={{
          background: "linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%)",
          display: "grid", placeItems: "center", position: "relative",
          minHeight: 500,
        }}>
          {deliverable.thumb ? (
            <div style={{
              width: "60%", aspectRatio: "9/16", borderRadius: 12,
              background: `url(${deliverable.thumb}) center/cover`,
              boxShadow: "0 20px 60px rgba(0,0,0,0.4)",
              position: "relative",
            }}>
              <button style={{
                position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
                width: 64, height: 64, borderRadius: "50%",
                background: "rgba(255,255,255,0.95)",
                border: "none", display: "grid", placeItems: "center",
                cursor: "pointer",
              }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="var(--ink)"><path d="M8 5v14l11-7z"/></svg>
              </button>
            </div>
          ) : (
            <div style={{color: "rgba(255,255,255,0.5)"}}>No preview available</div>
          )}
          <button onClick={onClose} className="icon-btn" style={{
            position: "absolute", top: 16, right: 16,
            background: "rgba(0,0,0,0.4)", color: "white", border: "none",
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        {/* Right: review panel */}
        <div style={{display: "flex", flexDirection: "column", maxHeight: "90vh", overflow: "hidden"}}>
          <div style={{padding: 24, borderBottom: "1px solid var(--line)"}}>
            <div className="row" style={{marginBottom: 12}}>
              <div className="avatar md" style={{backgroundImage: `url(${cr.avatar})`}}></div>
              <div>
                <div style={{fontWeight: 600}}>{cr.name}</div>
                <div className="muted" style={{fontSize: 12}}>@{cr.handle} · {cr.city}</div>
              </div>
            </div>
            <h2 style={{fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 500, margin: "0 0 4px", letterSpacing: "-0.02em"}}>
              {deliverable.label}
            </h2>
            <div className="muted" style={{fontSize: 13}}>Submitted {deliverable.submittedAt} · Due {deliverable.due}</div>
          </div>

          <div style={{flex: 1, overflowY: "auto", padding: 24}}>
            {deliverable.notes && (
              <div style={{padding: 14, background: "var(--bg)", borderRadius: "var(--r-md)", marginBottom: 20, fontSize: 13.5, lineHeight: 1.5}}>
                <div className="eyebrow" style={{marginBottom: 6}}>Creator notes</div>
                {deliverable.notes}
              </div>
            )}

            <div className="eyebrow" style={{marginBottom: 8}}>✨ Spark auto-check</div>
            <div style={{display: "flex", flexDirection: "column", gap: 6, marginBottom: 20}}>
              <CheckRow ok label="Product visible in first 3s" />
              <CheckRow ok label="#SapphireEid26 in caption" />
              <CheckRow ok label="@sapphirepk tagged" />
              <CheckRow ok label="#ad disclosure present" />
              <CheckRow warn label="Caption length: 48 words (rec. 60+)" />
            </div>

            <div className="eyebrow" style={{marginBottom: 8}}>Your feedback</div>
            <textarea
              className="input"
              rows="4"
              placeholder="Comments for the creator..."
              value={feedback}
              onChange={e => setFeedback(e.target.value)}
              style={{marginBottom: 12}}
            />
            <div className="row" style={{gap: 6, flexWrap: "wrap"}}>
              <button className="btn sm ghost" onClick={() => setFeedback("Love this! Lighting and styling are spot on.")}>+ Praise</button>
              <button className="btn sm ghost" onClick={() => setFeedback(f => f + "\nCan we make the product 1-2s longer in the opening?")}>+ Product visibility</button>
              <button className="btn sm ghost" onClick={() => setFeedback(f => f + "\nCould you adjust the caption to mention the lawn collection by name?")}>+ Caption</button>
            </div>
          </div>

          <div style={{padding: 20, borderTop: "1px solid var(--line)", background: "var(--bg)"}}>
            <div style={{padding: "10px 14px", background: "var(--paper)", borderRadius: "var(--r-md)", marginBottom: 12, fontSize: 12.5}}>
              <div className="row" style={{justifyContent: "space-between"}}>
                <span className="muted">Will release on approval</span>
                <span className="tabular" style={{fontWeight: 600}}>{fmtPKR(collab.price)}</span>
              </div>
              <div className="row" style={{justifyContent: "space-between"}}>
                <span className="muted">Net after fees & WHT</span>
                <span className="tabular" style={{color: "var(--moss)"}}>{fmtPKR(Math.round(collab.price * 0.85))}</span>
              </div>
            </div>
            <div className="row" style={{gap: 8}}>
              <button className="btn outline" style={{flex: 1}} onClick={() => setAction("revise")}>Request revision</button>
              <button className="btn accent" style={{flex: 2}} onClick={() => { onClose(); }}>Approve & release {fmtPKR(collab.price)}</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CheckRow({ ok, warn, label }) {
  const color = ok ? "var(--moss)" : warn ? "var(--gold)" : "var(--accent)";
  return (
    <div className="row" style={{gap: 8, fontSize: 13}}>
      <span style={{color, display: "flex", flexShrink: 0}}>
        {ok ? Icon.check : "⚠"}
      </span>
      <span>{label}</span>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// CREATOR: BRIEF DETAIL (apply to a campaign)
// ════════════════════════════════════════════════════════════════
function BriefDetail({ campaignId, onRoute }) {
  const D = window.ALAMUT_DATA;
  const c = D.CAMPAIGNS.find(x => x.id === campaignId) || D.CAMPAIGNS[0];
  const brief = D.BRIEFS.find(b => b.campaignId === c.id) || { matchScore: 80 };
  const [pitch, setPitch] = cmUseState("");
  const [price, setPrice] = cmUseState(35000);
  const [applied, setApplied] = cmUseState(false);

  return (
    <>
      <Topbar
        title={c.name}
        crumb={<span><a onClick={() => onRoute("creator-campaigns")} style={{cursor:"pointer", color:"var(--ink-3)"}}>Briefs</a> · {c.brand}</span>}
      />
      <div className="content" style={{maxWidth: 1080}}>
        <div className="grid-2" style={{gridTemplateColumns: "1fr 320px", gap: 24, alignItems: "flex-start"}}>
          <div>
            {/* Match banner */}
            <div className="card card-pad" style={{
              marginBottom: 16,
              background: "linear-gradient(90deg, var(--moss-soft) 0%, var(--paper) 100%)",
              borderColor: "var(--moss-soft)",
            }}>
              <div className="row">
                <div style={{
                  width: 48, height: 48, borderRadius: 10,
                  background: "var(--moss)", color: "white",
                  display: "grid", placeItems: "center",
                  fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 600,
                }} className="tabular">
                  {brief.matchScore}
                </div>
                <div style={{flex: 1}}>
                  <div style={{fontWeight: 600, fontSize: 14}}>Strong match for your audience</div>
                  <div className="muted" style={{fontSize: 12.5}}>
                    Your followers are {Math.round(brief.matchScore * 0.85)}% female, 25–34 in Karachi & Lahore — exactly what {c.brand} wants.
                  </div>
                </div>
              </div>
            </div>

            <div className="card card-pad-lg" style={{marginBottom: 16}}>
              <div className="row" style={{marginBottom: 16}}>
                <div style={{
                  width: 56, height: 56, borderRadius: 14,
                  background: "linear-gradient(135deg, var(--accent), var(--gold))",
                  color: "white", display: "grid", placeItems: "center",
                  fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 600,
                }}>{c.brand[0]}</div>
                <div>
                  <h2 style={{fontFamily: "var(--font-display)", fontSize: 26, fontWeight: 500, margin: 0, letterSpacing: "-0.02em"}}>
                    {c.name}
                  </h2>
                  <div className="muted" style={{fontSize: 13}}>{c.brand} · Posted Apr 28</div>
                </div>
              </div>

              <h3 style={{fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 500, margin: "20px 0 8px"}}>The brief</h3>
              <p style={{lineHeight: 1.6, color: "var(--ink-2)", margin: "0 0 20px"}}>{c.brief}</p>

              <h3 style={{fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 500, margin: "20px 0 8px"}}>What they want</h3>
              <ul style={{listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8}}>
                {[
                  `Placement: ${c.placement}`,
                  "Show product clearly within first 3 seconds",
                  "Use #SapphireEid26 in caption + tag @sapphirepk",
                  "Daily-life tone — no flashy hard cuts",
                  "Brief deliverable: 1 Reel + 3 Stories",
                ].map(p => (
                  <li key={p} className="row" style={{gap: 8, fontSize: 14}}>
                    <span style={{color: "var(--moss)"}}>{Icon.check}</span>{p}
                  </li>
                ))}
              </ul>
            </div>

            {!applied ? (
              <div className="card card-pad-lg">
                <h3 style={{fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 500, margin: "0 0 16px", letterSpacing: "-0.02em"}}>
                  Apply with a pitch
                </h3>
                <Field label="Your pitch (why you're a fit)">
                  <textarea className="input" rows="4" value={pitch} onChange={e => setPitch(e.target.value)}
                    placeholder="Tell Sapphire how you'd approach this — what angle, what makes you different." />
                </Field>
                <Field label="Your price (PKR)">
                  <div style={{position: "relative"}}>
                    <span style={{position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "var(--ink-3)"}}>Rs</span>
                    <input className="input" type="number" value={price} onChange={e => setPrice(parseInt(e.target.value || 0))}
                      style={{paddingLeft: 36, fontSize: 18, fontWeight: 500}} />
                  </div>
                  <div className="muted" style={{fontSize: 12, marginTop: 6}}>
                    Brand's range: Rs 25K–45K · Your usual rate: Rs 25K
                  </div>
                </Field>
                <button className="btn accent" style={{width: "100%"}} onClick={() => setApplied(true)}>Send application →</button>
              </div>
            ) : (
              <div className="card card-pad-lg" style={{textAlign: "center", background: "var(--moss-soft)", borderColor: "var(--moss-soft)"}}>
                <div style={{fontSize: 48, marginBottom: 12}}>🎉</div>
                <h3 style={{fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 500, margin: "0 0 6px", letterSpacing: "-0.02em"}}>
                  Application sent
                </h3>
                <p style={{margin: "0 0 16px", color: "var(--ink-2)"}}>
                  Sapphire usually replies within 48 hours. We'll notify you on Inbox.
                </p>
                <button className="btn primary" onClick={() => onRoute("creator-collabs")}>Go to my collaborations</button>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div>
            <div className="card card-pad" style={{marginBottom: 16}}>
              <div className="eyebrow" style={{marginBottom: 8}}>Compensation</div>
              <div style={{fontFamily: "var(--font-display)", fontSize: 28, fontWeight: 500, letterSpacing: "-0.02em"}} className="tabular">
                {fmtPKR(Math.round(c.budget / Math.max(c.creators.length, 4)))}
              </div>
              <div className="muted" style={{fontSize: 12, marginBottom: 14}}>per creator · paid via escrow</div>
              <Row k="Deadline" v={c.deadline} />
              <Row k="Placement" v={c.placement} />
              <Row k="Total budget" v={fmtPKR(c.budget)} />
            </div>

            <div className="card card-pad">
              <div className="eyebrow" style={{marginBottom: 12}}>About {c.brand}</div>
              <div className="row" style={{marginBottom: 12}}>
                <div style={{
                  width: 40, height: 40, borderRadius: 10,
                  background: "linear-gradient(135deg, var(--accent), var(--gold))",
                  color: "white", display: "grid", placeItems: "center",
                  fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 600,
                }}>{c.brand[0]}</div>
                <div>
                  <div style={{fontWeight: 600, fontSize: 14}}>{c.brand}</div>
                  <div className="muted" style={{fontSize: 11}}>Verified brand · 14 past campaigns</div>
                </div>
              </div>
              <Row k="Avg payout" v="< 48 hours" />
              <Row k="Approval rate" v="92%" />
              <Row k="Repeat hires" v="68%" />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ════════════════════════════════════════════════════════════════
// CREATOR: MY COLLABORATIONS (Kanban)
// ════════════════════════════════════════════════════════════════
function MyCollabs({ onRoute }) {
  const D = window.ALAMUT_DATA;
  // Get collabs for "hira" (current creator)
  const myCollabs = D.COLLABS.filter(x => x.creatorId === "hira" || x.creatorId === "mahnoor" || x.creatorId === "anum"); // simulate creator's collabs
  const stages = D.PIPELINE_STAGES;
  const [view, setView] = cmUseState("kanban");

  return (
    <>
      <Topbar
        title="My collaborations"
        crumb={`${myCollabs.length} active · ${myCollabs.filter(x => x.deliverables.some(d => d.status === "in_review")).length} pending review`}
        actions={
          <Segmented options={[["kanban","Kanban"],["list","List"]]} value={view} onChange={setView} />
        }
      />
      <div className="content">
        {view === "kanban" ? (
          <div style={{
            display: "grid",
            gridTemplateColumns: `repeat(${stages.length}, minmax(220px, 1fr))`,
            gap: 12, overflowX: "auto", paddingBottom: 12,
          }}>
            {stages.map(s => {
              const items = myCollabs.filter(x => x.stage === s.id);
              return (
                <div key={s.id} style={{minWidth: 220}}>
                  <div className="row" style={{padding: "0 4px 10px", justifyContent: "space-between"}}>
                    <div className="row" style={{gap: 6}}>
                      <span style={{width: 8, height: 8, borderRadius: 2, background: s.color}}></span>
                      <span style={{fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--ink-2)"}}>
                        {s.label}
                      </span>
                      <span className="muted" style={{fontSize: 12}}>{items.length}</span>
                    </div>
                  </div>
                  <div style={{display: "flex", flexDirection: "column", gap: 8, minHeight: 100}}>
                    {items.map(x => {
                      const camp = D.CAMPAIGNS.find(c => c.id === x.campaignId);
                      return (
                        <div key={x.id} className="card" style={{padding: 12, cursor: "pointer"}}
                          onClick={() => onRoute("collab:" + x.id)}>
                          <div style={{fontSize: 12.5, fontWeight: 600, marginBottom: 4}}>{camp.brand}</div>
                          <div className="muted" style={{fontSize: 11.5, marginBottom: 8, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis"}}>
                            {camp.name}
                          </div>
                          {x.price > 0 && (
                            <div className="row" style={{justifyContent: "space-between", fontSize: 12}}>
                              <span className="muted">Due {x.deadline}</span>
                              <span className="tabular" style={{fontWeight: 550}}>{fmtPKR(x.price)}</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {items.length === 0 && (
                      <div style={{padding: 16, border: "1px dashed var(--line-2)", borderRadius: "var(--r-md)", textAlign: "center", color: "var(--ink-4)", fontSize: 12}}>—</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="card" style={{overflow: "hidden"}}>
            <table className="tbl">
              <thead><tr><th>Brand</th><th>Campaign</th><th>Stage</th><th>Deliverables</th><th>Due</th><th style={{textAlign:"right"}}>Price</th><th></th></tr></thead>
              <tbody>
                {myCollabs.map(x => {
                  const camp = D.CAMPAIGNS.find(c => c.id === x.campaignId);
                  return (
                    <tr key={x.id} className="hover" onClick={() => onRoute("collab:" + x.id)}>
                      <td style={{fontWeight: 550}}>{camp.brand}</td>
                      <td>{camp.name}</td>
                      <td><StagePill stage={x.stage.charAt(0).toUpperCase() + x.stage.slice(1)} /></td>
                      <td>{x.deliverables.length}</td>
                      <td className="muted" style={{fontSize: 12}}>{x.deadline}</td>
                      <td className="tabular" style={{textAlign:"right", fontWeight: 550}}>{x.price > 0 ? fmtPKR(x.price) : "—"}</td>
                      <td>{Icon.arrow}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

// ════════════════════════════════════════════════════════════════
// CREATOR: COLLAB DETAIL (creator's view of a single collaboration)
// ════════════════════════════════════════════════════════════════
function CollabDetail({ collabId, onRoute }) {
  const D = window.ALAMUT_DATA;
  const x = D.COLLABS.find(c => c.id === collabId) || D.COLLABS[0];
  const camp = D.CAMPAIGNS.find(c => c.id === x.campaignId);
  const cr = D.CREATORS.find(c => c.id === x.creatorId);
  const [uploadOpen, setUploadOpen] = cmUseState(false);

  return (
    <>
      <Topbar
        title={camp.name}
        crumb={<span><a onClick={() => onRoute("creator-collabs")} style={{cursor:"pointer", color:"var(--ink-3)"}}>Collaborations</a> · {camp.brand}</span>}
        actions={<>
          <button className="btn outline" onClick={() => onRoute("creator-inbox")}>{Icon.inbox} Message brand</button>
          <button className="btn primary" onClick={() => setUploadOpen(true)}>{Icon.plus} Submit content</button>
        </>}
      />
      <div className="content">
        <div className="grid-2" style={{gridTemplateColumns: "1fr 320px", gap: 24, alignItems: "flex-start"}}>
          <div>
            {/* Status hero */}
            <div className="card card-pad-lg" style={{marginBottom: 16}}>
              <div className="row" style={{justifyContent: "space-between", marginBottom: 12}}>
                <div className="eyebrow">Current stage</div>
                <StagePill stage={x.stage.charAt(0).toUpperCase() + x.stage.slice(1)} />
              </div>
              <CollabTimeline stage={x.stage} />
            </div>

            {/* Deliverables */}
            <div className="card card-pad-lg" style={{marginBottom: 16}}>
              <h3 style={{fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 500, margin: "0 0 16px", letterSpacing: "-0.02em"}}>
                Deliverables
              </h3>
              <div style={{display: "flex", flexDirection: "column", gap: 10}}>
                {x.deliverables.map(d => (
                  <DeliverableRow key={d.id} d={d} onUpload={() => setUploadOpen(true)} />
                ))}
                {x.deliverables.length === 0 && (
                  <div className="muted" style={{fontSize: 13, padding: 24, textAlign: "center"}}>
                    No deliverables yet — they'll appear once the brief is confirmed.
                  </div>
                )}
              </div>
            </div>

            {/* Brief */}
            <div className="card card-pad-lg">
              <h3 style={{fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 500, margin: "0 0 12px", letterSpacing: "-0.02em"}}>The brief</h3>
              <p style={{lineHeight: 1.6, color: "var(--ink-2)", margin: "0 0 16px"}}>{camp.brief}</p>
              <button className="btn outline sm">{Icon.external} Download brief PDF</button>
            </div>
          </div>

          {/* Sidebar */}
          <div>
            <div className="card card-pad" style={{marginBottom: 16}}>
              <div className="eyebrow" style={{marginBottom: 8}}>Compensation</div>
              <div style={{fontFamily: "var(--font-display)", fontSize: 28, fontWeight: 500, letterSpacing: "-0.02em"}} className="tabular">
                {fmtPKR(x.price)}
              </div>
              <div className="muted" style={{fontSize: 12, marginBottom: 14}}>secured in escrow</div>
              <hr className="hr" />
              <Row k="Gross" v={fmtPKR(x.price)} />
              <Row k="Platform fee (5%)" v={`-${fmtPKR(Math.round(x.price * 0.05))}`} />
              <Row k="FBR WHT (5%)" v={`-${fmtPKR(Math.round(x.price * 0.05))}`} />
              <hr className="hr" />
              <Row k="You'll receive" v={fmtPKR(Math.round(x.price * 0.9))} bold />
              <div className="muted" style={{fontSize: 11, marginTop: 8}}>
                Released to your wallet on approval. Instant withdrawal to JazzCash.
              </div>
            </div>

            <div className="card card-pad">
              <div className="eyebrow" style={{marginBottom: 12}}>Brand contact</div>
              <div className="row" style={{marginBottom: 12}}>
                <div className="avatar md" style={{backgroundImage: "url(https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=200&q=80)"}}></div>
                <div>
                  <div style={{fontWeight: 600, fontSize: 13.5}}>Sara Kazmi</div>
                  <div className="muted" style={{fontSize: 11}}>{camp.brand} · Marketing Lead</div>
                </div>
              </div>
              <button className="btn outline sm" style={{width: "100%"}} onClick={() => onRoute("creator-inbox")}>
                {Icon.inbox} Open conversation
              </button>
            </div>
          </div>
        </div>
      </div>

      {uploadOpen && <ContentUploadModal collab={x} onClose={() => setUploadOpen(false)} />}
    </>
  );
}

function CollabTimeline({ stage }) {
  const order = ["pitched", "negotiating", "confirmed", "submitted", "approved", "paid"];
  const currentIdx = order.indexOf(stage === "live" ? "approved" : stage);
  return (
    <div style={{position: "relative", padding: "8px 0"}}>
      <div style={{display: "grid", gridTemplateColumns: `repeat(${order.length}, 1fr)`, gap: 0}}>
        {order.map((s, i) => {
          const done = i < currentIdx, active = i === currentIdx;
          return (
            <div key={s} style={{position: "relative", textAlign: "center"}}>
              {i > 0 && (
                <div style={{
                  position: "absolute", left: "-50%", right: "50%", top: 12, height: 2,
                  background: done || active ? "var(--moss)" : "var(--bg-2)",
                }}></div>
              )}
              <div style={{
                width: 26, height: 26, borderRadius: "50%", margin: "0 auto",
                background: done ? "var(--moss)" : active ? "var(--accent)" : "var(--bg-2)",
                color: done || active ? "white" : "var(--ink-3)",
                display: "grid", placeItems: "center",
                fontSize: 11, fontWeight: 700,
                position: "relative", zIndex: 1,
                boxShadow: active ? "0 0 0 4px var(--accent-soft)" : "none",
              }}>{done ? "✓" : i + 1}</div>
              <div style={{
                marginTop: 6, fontSize: 11, fontWeight: active ? 600 : 450,
                color: active ? "var(--ink)" : "var(--ink-3)",
                textTransform: "capitalize",
              }}>{s}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DeliverableRow({ d, onUpload }) {
  const statusColors = {
    pending: "var(--ink-3)",
    in_review: "var(--accent)",
    approved: "var(--moss)",
    live: "var(--moss)",
    revision: "var(--gold)",
  };
  const statusLabels = {
    pending: "Pending upload",
    in_review: "In review",
    approved: "Approved",
    live: "Live",
    revision: "Revision requested",
  };
  return (
    <div className="row" style={{padding: 14, border: "1px solid var(--line)", borderRadius: "var(--r-md)", gap: 12}}>
      {d.thumb ? (
        <div style={{
          width: 56, height: 72, borderRadius: 6,
          background: `url(${d.thumb}) center/cover`,
          flexShrink: 0,
        }}></div>
      ) : (
        <div style={{
          width: 56, height: 72, borderRadius: 6,
          background: "var(--bg-2)", display: "grid", placeItems: "center",
          color: "var(--ink-3)", fontSize: 22, flexShrink: 0,
        }}>📎</div>
      )}
      <div style={{flex: 1}}>
        <div style={{fontWeight: 600, fontSize: 14, marginBottom: 4}}>{d.label}</div>
        <div className="muted" style={{fontSize: 12}}>Due {d.due}</div>
        {d.submittedAt && <div className="muted" style={{fontSize: 11, marginTop: 2}}>Submitted {d.submittedAt}</div>}
      </div>
      <div style={{textAlign: "right"}}>
        <span style={{
          fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em",
          color: statusColors[d.status],
        }}>{statusLabels[d.status]}</span>
        <div style={{marginTop: 8}}>
          {d.status === "pending" && <button className="btn sm primary" onClick={onUpload}>Upload</button>}
          {d.status === "in_review" && <button className="btn sm ghost">View submission</button>}
          {d.status === "revision" && <button className="btn sm primary" onClick={onUpload}>Resubmit</button>}
          {(d.status === "approved" || d.status === "live") && <button className="btn sm ghost">{Icon.external}</button>}
        </div>
      </div>
    </div>
  );
}

// ── Content Upload Modal (creator submits a draft) ─────────
function ContentUploadModal({ collab, onClose }) {
  const D = window.ALAMUT_DATA;
  const camp = D.CAMPAIGNS.find(c => c.id === collab.campaignId);
  const [step, setStep] = cmUseState(0);
  const [caption, setCaption] = cmUseState("");
  const [file, setFile] = cmUseState(null);

  return (
    <div style={{position: "fixed", inset: 0, background: "rgba(28,26,21,0.5)", zIndex: 100, display: "grid", placeItems: "center", padding: 24}} onClick={onClose}>
      <div className="card" style={{maxWidth: 580, width: "100%", padding: 0, overflow: "hidden"}} onClick={e => e.stopPropagation()}>
        <div style={{padding: "20px 24px", borderBottom: "1px solid var(--line)"}}>
          <h2 style={{fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 500, margin: "0 0 4px", letterSpacing: "-0.02em"}}>
            Submit content for review
          </h2>
          <div className="muted" style={{fontSize: 13}}>{camp.brand} · {camp.name}</div>
        </div>

        <div style={{padding: 24}}>
          {step === 0 && (
            <>
              <div className="eyebrow" style={{marginBottom: 8}}>Upload your draft</div>
              <button onClick={() => setFile({ name: "eid_reel_draft_v2.mp4", size: "24 MB" })} style={{
                width: "100%", padding: 32,
                border: file ? "2px solid var(--moss)" : "2px dashed var(--line-2)",
                borderRadius: "var(--r-md)", background: file ? "var(--moss-soft)" : "var(--bg)",
                cursor: "pointer", textAlign: "center",
              }}>
                {file ? (
                  <>
                    <div style={{fontSize: 28, marginBottom: 8}}>✓</div>
                    <div style={{fontWeight: 600}}>{file.name}</div>
                    <div className="muted" style={{fontSize: 12}}>{file.size}</div>
                  </>
                ) : (
                  <>
                    <div style={{fontSize: 28, marginBottom: 8}}>📹</div>
                    <div style={{fontWeight: 600, marginBottom: 4}}>Drop file or click to upload</div>
                    <div className="muted" style={{fontSize: 12}}>MP4, MOV up to 200MB</div>
                  </>
                )}
              </button>

              <div className="eyebrow" style={{marginTop: 20, marginBottom: 8}}>Caption</div>
              <textarea className="input" rows="5" value={caption} onChange={e => setCaption(e.target.value)}
                placeholder="Eid is finally here ✨ Wearing the new Sapphire lawn... #SapphireEid26 #ad" />
              <div className="muted" style={{fontSize: 11, marginTop: 6}}>
                {caption.length} chars · Spark recommends 60–120 words for Reels
              </div>

              <div style={{marginTop: 20, padding: 14, background: "var(--accent-soft)", borderRadius: "var(--r-md)"}}>
                <div className="eyebrow" style={{color: "var(--accent)", marginBottom: 6}}>✨ Spark pre-flight checks</div>
                <div style={{display: "flex", flexDirection: "column", gap: 4, fontSize: 12.5}}>
                  <CheckRow ok label="Ratio detected: 9:16 (Reel-ready)" />
                  <CheckRow ok={caption.includes("#SapphireEid26")} warn={!caption.includes("#SapphireEid26")} label="#SapphireEid26 hashtag" />
                  <CheckRow ok={caption.includes("#ad")} warn={!caption.includes("#ad")} label="#ad disclosure (FTC + Pakistan PCA)" />
                </div>
              </div>
            </>
          )}

          {step === 1 && (
            <div style={{textAlign: "center", padding: "32px 0"}}>
              <div style={{fontSize: 56, marginBottom: 16}}>🚀</div>
              <h3 style={{fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 500, margin: "0 0 6px"}}>Submitted to {camp.brand}!</h3>
              <p style={{margin: 0, color: "var(--ink-2)"}}>You'll be notified when Sara reviews.<br/>Most brands respond within 24 hours.</p>
            </div>
          )}
        </div>

        <div style={{padding: 16, borderTop: "1px solid var(--line)", background: "var(--bg)"}}>
          {step === 0 ? (
            <div className="row" style={{gap: 8}}>
              <button className="btn outline" style={{flex: 1}} onClick={onClose}>Cancel</button>
              <button className="btn accent" style={{flex: 2}} disabled={!file} onClick={() => setStep(1)} style={{flex: 2, opacity: file ? 1 : 0.5}}>
                Submit for review
              </button>
            </div>
          ) : (
            <button className="btn primary" style={{width: "100%"}} onClick={onClose}>Got it</button>
          )}
        </div>
      </div>
    </div>
  );
}

window.AlamutCampaignMgmt = {
  NewCampaignWizard, CampaignDetailV2, ContentReviewModal,
  BriefDetail, MyCollabs, CollabDetail,
};
