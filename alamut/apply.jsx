// Creator application flow — 4 steps for someone applying to join the Alamut roster.
// Steps: 01 You · 02 Work · 03 Rates · 04 Review → confirmation

function ApplyStepper({ step }) {
  const steps = ['You', 'Your work', 'Rates', 'Review'];
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

function ApplyStepYou({ form, setForm }) {
  return (
    <div className="b-step-body">
      <div className="b-section-head">
        <Label num="01">You</Label>
        <h2 className="b-h2">Let's start with the basics.</h2>
      </div>
      <Rule />
      <div className="b-grid">
        <TextField label="Full name" placeholder="e.g. Ayesha Khan"
          value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
        <TextField label="City, country" placeholder="e.g. Karachi, Pakistan"
          value={form.city} onChange={(v) => setForm({ ...form, city: v })} />
        <TextField label="Email" placeholder="hello@yourdomain.com"
          value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
        <TextField label="WhatsApp or phone" placeholder="+92 …"
          value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
        <TextField label="Tagline" multiline rows={2}
          placeholder="One line that says what you make, in your own voice."
          value={form.tagline} onChange={(v) => setForm({ ...form, tagline: v })} />
        <TextField label="About you" multiline rows={5}
          placeholder="Where you come from, what you're known for, why you do this work."
          value={form.bio} onChange={(v) => setForm({ ...form, bio: v })} />
        <ChipGroup label="Disciplines" multi
          options={['Fashion', 'Beauty', 'Food', 'Travel', 'Lifestyle', 'Music', 'Film', 'Tech', 'Wellness', 'Sustainability']}
          value={form.disciplines} onChange={(v) => setForm({ ...form, disciplines: v })} />
        <ChipGroup label="Languages you make in" multi
          options={['English', 'Urdu', 'Hindi', 'Punjabi', 'Arabic', 'French', 'Spanish']}
          value={form.languages} onChange={(v) => setForm({ ...form, languages: v })} />
      </div>
    </div>
  );
}

function ApplyStepWork({ form, setForm }) {
  const plats = ['Instagram', 'TikTok', 'YouTube', 'Substack', 'Podcast'];
  const toggle = (p) => {
    const arr = form.platforms || [];
    setForm({ ...form, platforms: arr.some((x) => x.name === p)
      ? arr.filter((x) => x.name !== p)
      : [...arr, { name: p, handle: '', followers: '' }] });
  };
  const update = (p, key, val) => {
    setForm({ ...form, platforms: (form.platforms || []).map((x) => x.name === p ? { ...x, [key]: val } : x) });
  };
  return (
    <div className="b-step-body">
      <div className="b-section-head">
        <Label num="02">Your work</Label>
        <h2 className="b-h2">Where do you publish?</h2>
      </div>
      <Rule />
      <div className="b-grid">
        <ChipGroup label="Platforms you're active on" multi
          options={plats}
          value={(form.platforms || []).map((p) => p.name)}
          onChange={() => {}} />
        <div style={{ gridColumn: 'span 2', marginTop: -16 }}>
          <div className="b-field-hint" style={{ marginBottom: 20 }}>Click a platform above to add it, then fill in your handle and follower count.</div>
          {plats.map((p) => (
            <button key={p} className={'b-chip' + ((form.platforms || []).some((x) => x.name === p) ? ' is-on' : '')}
              onClick={() => toggle(p)} style={{ marginRight: 8, marginBottom: 12 }}>
              {p}
            </button>
          ))}
        </div>
        {(form.platforms || []).length > 0 && (
          <div style={{ gridColumn: 'span 2' }}>
            <Rule />
            <table className="b-apply-platforms">
              <thead><tr><th>Platform</th><th>Handle</th><th>Followers</th></tr></thead>
              <tbody>
                {form.platforms.map((p) => (
                  <tr key={p.name}>
                    <td className="b-apply-plat-name">{p.name}</td>
                    <td><input type="text" placeholder="@yourhandle" value={p.handle} onChange={(e) => update(p.name, 'handle', e.target.value)} /></td>
                    <td><input type="text" placeholder="e.g. 120,000" value={p.followers} onChange={(e) => update(p.name, 'followers', e.target.value)} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <TextField label="Three links to your best work" multiline rows={4}
          placeholder={'https://…\nhttps://…\nhttps://…'}
          value={form.links} onChange={(v) => setForm({ ...form, links: v })} />
        <TextField label="Brands you've already worked with" multiline rows={3}
          placeholder="List any paid partnerships or collaborations — it's fine if this is empty."
          value={form.brandsDone} onChange={(v) => setForm({ ...form, brandsDone: v })} />
      </div>
    </div>
  );
}

function ApplyStepRates({ form, setForm }) {
  return (
    <div className="b-step-body">
      <div className="b-section-head">
        <Label num="03">Rates</Label>
        <h2 className="b-h2">What do you usually charge?</h2>
      </div>
      <Rule />
      <div className="b-field-hint" style={{ margin: '24px 0 0' }}>
        Be honest, not aspirational. We'll help you negotiate up from here. All figures in USD.
      </div>
      <div className="b-grid">
        <TextField label="Instagram feed post" placeholder="e.g. 400–800"
          value={form.rPost} onChange={(v) => setForm({ ...form, rPost: v })} />
        <TextField label="Reel / short video" placeholder="e.g. 600–1,200"
          value={form.rReel} onChange={(v) => setForm({ ...form, rReel: v })} />
        <TextField label="Story set (3–5 frames)" placeholder="e.g. 200–400"
          value={form.rStory} onChange={(v) => setForm({ ...form, rStory: v })} />
        <TextField label="Long-form YouTube video" placeholder="e.g. 1,500–3,000 (leave blank if N/A)"
          value={form.rYT} onChange={(v) => setForm({ ...form, rYT: v })} />
        <ChipGroup label="Typical turnaround"
          options={['Same week', '1–2 weeks', '2–4 weeks', 'Flexible']}
          value={form.turnaround} onChange={(v) => setForm({ ...form, turnaround: v })} />
        <ChipGroup label="Categories you won't work with" multi
          options={['Alcohol', 'Tobacco / vape', 'Crypto', 'Gambling', 'Fast fashion', 'Diet / weight-loss', 'Political', 'Adult content']}
          value={form.noWorkCats} onChange={(v) => setForm({ ...form, noWorkCats: v })} />
        <TextField label="Anything else we should know?" multiline rows={3}
          placeholder="Exclusivity windows, team you work with, creative constraints, etc."
          value={form.ratesNotes} onChange={(v) => setForm({ ...form, ratesNotes: v })} />
      </div>
    </div>
  );
}

function ApplyStepReview({ form }) {
  const plats = (form.platforms || []);
  const rows = [
    ['Disciplines', (form.disciplines || []).join(', ') || '—'],
    ['Languages', (form.languages || []).join(', ') || '—'],
    ['Platforms', plats.map((p) => `${p.name}${p.followers ? ` (${p.followers})` : ''}`).join(', ') || '—'],
    ['Feed post', form.rPost ? `$${form.rPost}` : '—'],
    ['Reel', form.rReel ? `$${form.rReel}` : '—'],
    ['Turnaround', form.turnaround || '—'],
    ['Won\u2019t work with', (form.noWorkCats || []).join(', ') || '—'],
  ];
  return (
    <div className="b-step-body">
      <div className="b-section-head">
        <Label num="04">Review</Label>
        <h2 className="b-h2">One last look.</h2>
      </div>
      <Rule />
      <div className="b-review">
        <div className="b-review-left">
          <Label>About</Label>
          <div style={{ marginTop: 20 }}>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.12em', color: 'var(--ink-40)', textTransform: 'uppercase' }}>Name</div>
            <div style={{ fontFamily: 'var(--serif)', fontSize: 32, fontWeight: 500, letterSpacing: '-0.02em', marginTop: 6 }}>{form.name || '—'}</div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '0.10em', color: 'var(--ink-60)', marginTop: 8, textTransform: 'uppercase' }}>
              {form.city || '—'}{form.email ? ` · ${form.email}` : ''}
            </div>
          </div>
          {form.tagline && <div className="b-review-notes"><div className="b-field-label">Tagline</div><p style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 20 }}>"{form.tagline}"</p></div>}
          {form.bio && <div className="b-review-notes"><div className="b-field-label">Bio</div><p>{form.bio}</p></div>}
        </div>
        <div className="b-review-right">
          <Label>Details</Label>
          <table className="b-review-table">
            <tbody>
              {rows.map(([k, v]) => <tr key={k}><th>{k}</th><td>{v}</td></tr>)}
            </tbody>
          </table>
          {form.links && <div className="b-review-notes"><div className="b-field-label">Work samples</div><p style={{ fontFamily: 'var(--mono)', fontSize: 13, lineHeight: 1.7 }}>{form.links}</p></div>}
        </div>
      </div>
    </div>
  );
}

function ApplyConfirm({ form, onHome, onDash }) {
  return (
    <div className="b-confirm">
      <Label num="APPLICATION SENT">You're in the queue</Label>
      <h1 className="b-confirm-h">
        Thanks, {(form.name || 'friend').split(' ')[0]}.<br/>
        <em>We read every application</em><br/>
        within 2 weeks.
      </h1>
      <p className="b-confirm-lede">
        Our team reviews applications on Tuesdays. If we think you're a fit, you'll hear from
        Zoya or Imran to set up a 30-minute call. Not hearing back isn't a rejection — sometimes
        it's a timing thing, and we'll come back to you when we have the right brand for you.
      </p>
      <div className="b-confirm-grid">
        <div>
          <div className="b-confirm-k">Ref.</div>
          <div className="b-confirm-v">APL-{Math.floor(Math.random() * 9000 + 1000)}</div>
        </div>
        <div>
          <div className="b-confirm-k">Reviewed by</div>
          <div className="b-confirm-v" style={{ fontSize: 20 }}>Zoya N.</div>
        </div>
        <div>
          <div className="b-confirm-k">Window</div>
          <div className="b-confirm-v" style={{ fontSize: 18 }}>≤ 14 days</div>
        </div>
        <div>
          <div className="b-confirm-k">Next step</div>
          <div className="b-confirm-v" style={{ fontSize: 18 }}>Intro call</div>
        </div>
      </div>
      <div className="b-confirm-actions">
        <Btn variant="solid" icon={<Icon.arrow s={14} />} onClick={onDash}>Preview your dashboard</Btn>
        <Btn variant="ghost" onClick={onHome}>Back to home</Btn>
      </div>
    </div>
  );
}

function ApplyScreen({ onHome, onDash }) {
  const [step, setStep] = React.useState(0);
  const [form, setForm] = React.useState({
    name: '', city: '', email: '', phone: '', tagline: '', bio: '',
    disciplines: [], languages: [], platforms: [], links: '', brandsDone: '',
    rPost: '', rReel: '', rStory: '', rYT: '', turnaround: '', noWorkCats: [], ratesNotes: '',
  });
  const [done, setDone] = React.useState(false);

  if (done) return <ApplyConfirm form={form} onHome={onHome} onDash={onDash} />;

  return (
    <div className="b-screen">
      <header className="b-screen-head">
        <div>
          <Label num="APPLY">Join the roster</Label>
          <h1 className="b-screen-title">
            Let's see if you're<br/><em>a fit.</em>
          </h1>
        </div>
        <ApplyStepper step={step} />
      </header>
      <Rule />

      {step === 0 && <ApplyStepYou form={form} setForm={setForm} />}
      {step === 1 && <ApplyStepWork form={form} setForm={setForm} />}
      {step === 2 && <ApplyStepRates form={form} setForm={setForm} />}
      {step === 3 && <ApplyStepReview form={form} />}

      <div className="b-foot">
        <button className="b-back" onClick={() => step === 0 ? onHome() : setStep(step - 1)}>
          <Icon.arrowLeft s={14} /> <span>{step === 0 ? 'Back to home' : 'Previous step'}</span>
        </button>
        {step < 3 ? (
          <Btn variant="solid" icon={<Icon.arrow s={14} />} onClick={() => setStep(step + 1)}>Continue</Btn>
        ) : (
          <Btn variant="solid" icon={<Icon.arrow s={14} />} onClick={() => setDone(true)}>Submit application</Btn>
        )}
      </div>
    </div>
  );
}

Object.assign(window, { ApplyScreen });
