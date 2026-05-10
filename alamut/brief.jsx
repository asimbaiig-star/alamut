// Brief flow — 3-step form for briefing the shortlisted creators.
// Steps: 01 Campaign · 02 Deliverables · 03 Review → confirmation

function BriefStepper({ step }) {
  const steps = ['Campaign', 'Deliverables', 'Review'];
  return (
    <div className="b-stepper">
      {steps.map((s, i) => (
        <div key={s} className={'b-step' + (i === step ? ' is-active' : '') + (i < step ? ' is-done' : '')}>
          <span className="b-step-n">{String(i + 1).padStart(2, '0')}</span>
          <span className="b-step-t">{s}</span>
        </div>
      ))}
    </div>
  );
}

function TextField({ label, placeholder, value, onChange, multiline, rows = 4, hint }) {
  return (
    <label className="b-field">
      <div className="b-field-label">{label}</div>
      {multiline ? (
        <textarea rows={rows} value={value || ''} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
      ) : (
        <input type="text" value={value || ''} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
      )}
      {hint && <div className="b-field-hint">{hint}</div>}
    </label>
  );
}

function ChipGroup({ label, options, value, onChange, multi = false }) {
  const toggle = (v) => {
    if (multi) {
      const arr = Array.isArray(value) ? value : [];
      onChange(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
    } else onChange(v);
  };
  const isOn = (v) => multi ? (Array.isArray(value) && value.includes(v)) : value === v;
  return (
    <div className="b-chips-group">
      <div className="b-field-label">{label}</div>
      <div className="b-chips">
        {options.map((o) => (
          <button key={o} className={'b-chip' + (isOn(o) ? ' is-on' : '')} onClick={() => toggle(o)}>{o}</button>
        ))}
      </div>
    </div>
  );
}

function StepCampaign({ form, setForm }) {
  return (
    <div className="b-step-body">
      <div className="b-section-head">
        <Label num="01">Campaign</Label>
        <h2 className="b-h2">Tell us what you're launching.</h2>
      </div>
      <Rule />
      <div className="b-grid">
        <TextField label="Brand name" placeholder="e.g. Habibi Coffee Roasters"
          value={form.brand} onChange={(v) => setForm({ ...form, brand: v })} />
        <TextField label="Campaign title" placeholder="e.g. Eid 2026 gift box launch"
          value={form.title} onChange={(v) => setForm({ ...form, title: v })} />
        <TextField label="What are we promoting?" multiline rows={4}
          placeholder="Product, service, moment — and what makes it different."
          value={form.product} onChange={(v) => setForm({ ...form, product: v })} />
        <TextField label="Who is it for?" multiline rows={3}
          placeholder="The audience and market (e.g. young professionals in Karachi and Dubai)."
          value={form.audience} onChange={(v) => setForm({ ...form, audience: v })} />
        <ChipGroup label="Campaign goal"
          options={['Awareness', 'Engagement', 'Product launch', 'Sales / promo code', 'Event coverage']}
          value={form.goal} onChange={(v) => setForm({ ...form, goal: v })} />
        <ChipGroup label="Tone" multi
          options={['Editorial', 'Warm', 'Playful', 'Bold', 'Quiet', 'Aspirational']}
          value={form.tone} onChange={(v) => setForm({ ...form, tone: v })} />
      </div>
    </div>
  );
}

function StepDeliverables({ form, setForm }) {
  return (
    <div className="b-step-body">
      <div className="b-section-head">
        <Label num="02">Deliverables</Label>
        <h2 className="b-h2">What do you need, by when, and for how much.</h2>
      </div>
      <Rule />
      <div className="b-grid">
        <ChipGroup label="Content formats" multi
          options={['Feed post', 'Reel / short video', 'Story set', 'Long video', 'Newsletter feature']}
          value={form.formats} onChange={(v) => setForm({ ...form, formats: v })} />
        <ChipGroup label="Platforms" multi
          options={['Instagram', 'TikTok', 'YouTube', 'Substack', 'Podcast']}
          value={form.platforms} onChange={(v) => setForm({ ...form, platforms: v })} />
        <TextField label="Launch window" placeholder="e.g. May 15 – June 1, 2026"
          value={form.window} onChange={(v) => setForm({ ...form, window: v })} />
        <TextField label="Total budget (USD)" placeholder="e.g. 12,000"
          value={form.budget} onChange={(v) => setForm({ ...form, budget: v })}
          hint="Alamut splits this across the shortlisted creators; we'll come back with a proposed allocation." />
        <TextField label="Usage rights" multiline rows={3}
          placeholder="Organic only / paid boost / whitelist / exclusivity window"
          value={form.rights} onChange={(v) => setForm({ ...form, rights: v })} />
        <TextField label="Anything else we should know?" multiline rows={3}
          placeholder="Competitor exclusivity, must-mentions, legal copy, shipping logistics, etc."
          value={form.notes} onChange={(v) => setForm({ ...form, notes: v })} />
      </div>
    </div>
  );
}

function StepReview({ form, picks }) {
  const rows = [
    ['Brand', form.brand || '—'],
    ['Campaign', form.title || '—'],
    ['Goal', form.goal || '—'],
    ['Tone', (form.tone || []).join(', ') || '—'],
    ['Formats', (form.formats || []).join(', ') || '—'],
    ['Platforms', (form.platforms || []).join(', ') || '—'],
    ['Window', form.window || '—'],
    ['Budget', form.budget ? `$${form.budget}` : '—'],
  ];
  return (
    <div className="b-step-body">
      <div className="b-section-head">
        <Label num="03">Review</Label>
        <h2 className="b-h2">Ready to send to the Alamut team?</h2>
      </div>
      <Rule />
      <div className="b-review">
        <div className="b-review-left">
          <Label>Shortlisted creators</Label>
          <div className="b-review-picks">
            {picks.map((c, i) => (
              <div key={c.id} className="b-review-pick">
                <img src={c.portrait} alt="" />
                <div>
                  <div className="b-review-pick-num">Nº {String(i + 1).padStart(2, '0')}</div>
                  <div className="b-review-pick-name">{c.name}</div>
                  <div className="b-review-pick-meta">{c.categories[0]} · {fmt(c.reach)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="b-review-right">
          <Label>Brief summary</Label>
          <table className="b-review-table">
            <tbody>
              {rows.map(([k, v]) => (
                <tr key={k}><th>{k}</th><td>{v}</td></tr>
              ))}
            </tbody>
          </table>
          {form.product && <div className="b-review-notes"><div className="b-field-label">Product</div><p>{form.product}</p></div>}
          {form.audience && <div className="b-review-notes"><div className="b-field-label">Audience</div><p>{form.audience}</p></div>}
          {form.notes && <div className="b-review-notes"><div className="b-field-label">Notes</div><p>{form.notes}</p></div>}
        </div>
      </div>
    </div>
  );
}

function BriefConfirm({ form, picks, onReset, onHome }) {
  return (
    <div className="b-confirm">
      <Label num="SUBMITTED">Brief received, {(form.brand || 'there').split(' ')[0]}</Label>
      <h1 className="b-confirm-h">
        Thanks. Expect a reply from<br/>
        <em>Zoya, your Alamut manager,</em><br/>
        within <em>24 hours.</em>
      </h1>
      <p className="b-confirm-lede">
        We'll come back with a proposal deck: suggested creators, rates, content plan,
        and a timeline against your launch window. Nothing is final until you approve it.
      </p>
      <div className="b-confirm-grid">
        <div>
          <div className="b-confirm-k">Ref.</div>
          <div className="b-confirm-v">ALM-{Math.floor(Math.random() * 9000 + 1000)}</div>
        </div>
        <div>
          <div className="b-confirm-k">Creators</div>
          <div className="b-confirm-v">{picks.length}</div>
        </div>
        <div>
          <div className="b-confirm-k">Budget</div>
          <div className="b-confirm-v">{form.budget ? `$${form.budget}` : '—'}</div>
        </div>
        <div>
          <div className="b-confirm-k">Window</div>
          <div className="b-confirm-v" style={{ fontSize: 16 }}>{form.window || '—'}</div>
        </div>
      </div>
      <div className="b-confirm-actions">
        <Btn variant="solid" icon={<Icon.arrow s={14} />} onClick={onHome}>Back to home</Btn>
        <Btn variant="ghost" onClick={onReset}>Start another brief</Btn>
      </div>
    </div>
  );
}

function BriefScreen({ onHome, onOpenRoster }) {
  const { ids, clear } = useShortlist();
  const picks = ids.map((id) => ROSTER.find((r) => r.id === id)).filter(Boolean);
  const [step, setStep] = React.useState(0);
  const [form, setForm] = React.useState({
    brand: '', title: '', product: '', audience: '', goal: '', tone: [],
    formats: [], platforms: [], window: '', budget: '', rights: '', notes: '',
  });
  const [done, setDone] = React.useState(false);

  if (picks.length === 0 && !done) {
    return (
      <div className="a-empty-screen">
        <Label num="BRIEF">No creators shortlisted</Label>
        <h1 className="a-display" style={{ marginTop: 24 }}>
          Add a few creators to your shortlist<br/>
          <em>before briefing.</em>
        </h1>
        <div style={{ marginTop: 32 }}>
          <Btn variant="solid" icon={<Icon.arrow s={14} />} onClick={onOpenRoster}>Browse creators</Btn>
        </div>
      </div>
    );
  }

  if (done) {
    return <BriefConfirm form={form} picks={picks} onReset={() => {
      setForm({ brand: '', title: '', product: '', audience: '', goal: '', tone: [], formats: [], platforms: [], window: '', budget: '', rights: '', notes: '' });
      setStep(0); setDone(false); clear();
    }} onHome={onHome} />;
  }

  return (
    <div className="b-screen">
      <header className="b-screen-head">
        <div>
          <Label num="BRIEF">New campaign brief</Label>
          <h1 className="b-screen-title">
            Brief <em>{picks.length}</em> creator{picks.length === 1 ? '' : 's'}
          </h1>
        </div>
        <BriefStepper step={step} />
      </header>
      <Rule />

      {step === 0 && <StepCampaign form={form} setForm={setForm} />}
      {step === 1 && <StepDeliverables form={form} setForm={setForm} />}
      {step === 2 && <StepReview form={form} picks={picks} />}

      <div className="b-foot">
        <button className="b-back" onClick={() => step === 0 ? onOpenRoster() : setStep(step - 1)}>
          <Icon.arrowLeft s={14} /> <span>{step === 0 ? 'Back to browsing' : 'Previous step'}</span>
        </button>
        {step < 2 ? (
          <Btn variant="solid" icon={<Icon.arrow s={14} />} onClick={() => setStep(step + 1)}>Continue</Btn>
        ) : (
          <Btn variant="solid" icon={<Icon.arrow s={14} />} onClick={() => setDone(true)}>Send brief</Btn>
        )}
      </div>
    </div>
  );
}

Object.assign(window, { BriefScreen });
