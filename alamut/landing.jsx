// Landing page — split entry for brands and creators.
// Two clearly-differentiated paths, each with its own copy, proof, and CTA.
// Relies on window globals: Icon, Label, Rule, Btn, KPI, ROSTER, fmt, Placeholder

function LandingHero({ side, setSide, onEnterBrand, onEnterCreator }) {
  return (
    <section className="l-hero">
      <div className="l-hero-top">
        <Label num="01">Alamut Talent Management · Est. 2021</Label>
        <div className="l-hero-switch">
          <button className={side === 'brand' ? 'is-on' : ''} onClick={() => setSide('brand')}>I'm a brand</button>
          <button className={side === 'creator' ? 'is-on' : ''} onClick={() => setSide('creator')}>I'm a creator</button>
        </div>
      </div>

      <h1 className="l-hero-title">
        {side === 'brand' ? (
          <>The creator marketplace<br/>that <em>actually answers.</em></>
        ) : (
          <>Run your creator business<br/><em>like a business.</em></>
        )}
      </h1>

      <p className="l-hero-lede">
        {side === 'brand'
          ? 'Find, brief, book and pay creators across South Asia and the diaspora — in one room. Live channel stats, escrow payments, deal pipelines. You work with creators directly; we handle the operational layer.'
          : 'A storefront brands actually book from. An inbox sorted by deal stage. Invoices, escrow, and cross-border payouts handled. Apply to live campaigns or take inbound — you keep 95% of every deal.'}
      </p>

      <div className="l-hero-actions">
        {side === 'brand' ? (
          <>
            <Btn variant="solid" size="lg" icon={<Icon.arrow s={14} />} onClick={onEnterBrand}>Discover creators</Btn>
            <Btn variant="ghost" size="lg" onClick={onEnterBrand}>Try AI Match concierge →</Btn>
          </>
        ) : (
          <>
            <Btn variant="solid" size="lg" icon={<Icon.arrow s={14} />} onClick={onEnterCreator}>Build my storefront</Btn>
            <Btn variant="ghost" size="lg" onClick={onEnterCreator}>Browse live campaigns →</Btn>
          </>
        )}
      </div>

      <div className="l-hero-portraits">
        {ROSTER.slice(0, 6).map((c) => (
          <div className="l-hero-portrait" key={c.id}>
            <img src={c.portrait} alt={c.name} />
            <span>{c.name}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function LandingKpis({ side }) {
  const brand = [
    { k: 'Creators on the platform', v: '420', u: '+' },
    { k: 'Combined reach', v: '38', u: 'M' },
    { k: 'Avg. brief response', v: '38', u: 'h' },
    { k: 'Repeat-brand rate', v: '82', u: '%' },
  ];
  const creator = [
    { k: 'Share of campaign fee', v: '85', u: '%' },
    { k: 'Avg. payment time', v: '14', u: 'days' },
    { k: 'Briefs reviewed per month', v: '60', u: '+' },
    { k: 'Time saved per campaign', v: '11', u: 'hrs' },
  ];
  const rows = side === 'brand' ? brand : creator;
  return (
    <section className="l-kpis">
      {rows.map((r) => (
        <KPI key={r.k} label={r.k} value={r.v} unit={r.u} />
      ))}
    </section>
  );
}

function LandingHow({ side, onEnterBrand, onEnterCreator }) {
  const brandSteps = [
    { n: '01', t: 'Discover or get matched', d: 'Browse 420+ vetted creators with live channel stats, or describe your campaign and let our AI Match concierge surface the top 3 in seconds.' },
    { n: '02', t: 'Brief them on their storefront', d: 'Every creator has a storefront with packages, pricing, turnaround. You book directly — no agency middleman, no inflated rates.' },
    { n: '03', t: 'Pay into escrow', d: 'One wallet, many creators. Funds sit in escrow until content is live and approved. Cross-border payouts handled.' },
    { n: '04', t: 'Run it from your inbox', d: 'Every conversation, every brief, every approval — sorted by deal stage. No spreadsheets, no DMs, no chasing.' },
  ];
  const creatorSteps = [
    { n: '01', t: 'Build your storefront', d: 'A page brands actually book from. Block-based editor, packages with pricing, live channel stats pulled straight from the platform APIs.' },
    { n: '02', t: 'Take inbound or browse live campaigns', d: 'Brands find you, or you find them. Apply to live campaigns with one click — your storefront is the application.' },
    { n: '03', t: 'Manage every deal in one inbox', d: 'Conversations sorted by deal stage. Counter-propose, negotiate, accept — without losing track.' },
    { n: '04', t: 'Get paid, on time', d: '95% of every deal lands in your account within 14 days of going live. Escrow protects you. Cross-border? Handled.' },
  ];
  const steps = side === 'brand' ? brandSteps : creatorSteps;
  return (
    <section className="l-how">
      <div className="l-how-head">
        <Label num="02">How it works</Label>
        <h2 className="l-h2">
          {side === 'brand'
            ? 'From brief to live campaign in about two weeks.'
            : 'Management, the way it should work.'}
        </h2>
      </div>
      <Rule />
      <div className="l-how-grid">
        {steps.map((s) => (
          <div key={s.n} className="l-how-step">
            <div className="l-how-num">{s.n}</div>
            <h3 className="l-how-t">{s.t}</h3>
            <p className="l-how-d">{s.d}</p>
          </div>
        ))}
      </div>
      <div className="l-how-cta">
        {side === 'brand'
          ? <Btn variant="solid" icon={<Icon.arrow s={14} />} onClick={onEnterBrand}>See the creators</Btn>
          : <Btn variant="solid" icon={<Icon.arrow s={14} />} onClick={onEnterCreator}>Start your application</Btn>}
      </div>
    </section>
  );
}

function LandingPreview({ side, onOpenCreator }) {
  // Brand side: preview roster cards. Creator side: show the brands they'd be seen by.
  if (side === 'brand') {
    const picks = ROSTER.slice(0, 3);
    return (
      <section className="l-preview">
        <div className="l-preview-head">
          <Label num="03">A taste of the talent</Label>
          <h2 className="l-h2">Three you'd meet first.</h2>
        </div>
        <Rule />
        <div className="l-preview-grid">
          {picks.map((c, i) => (
            <button key={c.id} className="l-preview-card" onClick={() => onOpenCreator(c)}>
              <img src={c.portrait} alt={c.name} />
              <div className="l-preview-body">
                <div className="l-preview-meta">
                  <span>Nº {String(i + 1).padStart(2, '0')}</span>
                  <span>{c.categories[0]}</span>
                </div>
                <div className="l-preview-name">{c.name}</div>
                <div className="l-preview-sub">{c.tagline}</div>
              </div>
            </button>
          ))}
        </div>
      </section>
    );
  }
  const brands = ['Aesop', 'Everlane', 'Le Creuset', 'Peak Design', 'Leica', 'Muji', 'On Running', 'Hay', 'Vitra', 'Net-a-Porter'];
  return (
    <section className="l-preview">
      <div className="l-preview-head">
        <Label num="03">Brands that brief us</Label>
        <h2 className="l-h2">You'd be in good company.</h2>
      </div>
      <Rule />
      <div className="l-brand-grid">
        {brands.map((b) => <div key={b} className="l-brand-cell">{b}</div>)}
      </div>
    </section>
  );
}

function LandingQuote({ side }) {
  const q = side === 'brand'
    ? { quote: 'I used to spend two weeks chasing one creator. Now I send one email and a brief, and our manager comes back with three options and a shoot date.', who: 'Head of Brand, independent coffee roaster', where: 'Karachi' }
    : { quote: 'Before Alamut I was answering brand DMs at midnight and doing my own invoices. Now I just make the work and check the Friday payment email.', who: 'Cook, 480K followers', where: 'Lahore' };
  return (
    <section className="l-quote">
      <Label num="04">In their words</Label>
      <blockquote className="l-quote-text">
        "{q.quote}"
      </blockquote>
      <div className="l-quote-cite">— {q.who}, {q.where}</div>
    </section>
  );
}

function LandingFoot({ side, onEnterBrand, onEnterCreator }) {
  return (
    <section className="l-foot">
      <Rule />
      <div className="l-foot-grid">
        <div className="l-foot-block">
          <Label num="A">For brands</Label>
          <div className="l-foot-t">Ready to brief us on a campaign?</div>
          <Btn variant="ghost" icon={<Icon.arrow s={14} />} onClick={onEnterBrand}>Browse creators</Btn>
        </div>
        <div className="l-foot-block">
          <Label num="B">For creators</Label>
          <div className="l-foot-t">Think you'd fit the roster?</div>
          <Btn variant="ghost" icon={<Icon.arrow s={14} />} onClick={onEnterCreator}>Apply to join</Btn>
        </div>
      </div>
      <Rule />
      <div className="l-foot-meta">
        <span>Alamut Talent Management</span>
        <span>Karachi · Lahore · Dubai</span>
        <span>hello@alamut.co</span>
        <a href="Alamut Design System.html" style={{ color: 'var(--ink-60)', textDecoration: 'none' }} onMouseEnter={(e) => e.target.style.color = 'var(--ink)'} onMouseLeave={(e) => e.target.style.color = 'var(--ink-60)'}>Design System ↗</a>
      </div>
    </section>
  );
}

function LandingScreen({ onOpenRoster, onOpenCreator, onOpenApply }) {
  const [side, setSide] = React.useState(() => localStorage.getItem('alamut.side') || 'brand');
  React.useEffect(() => { localStorage.setItem('alamut.side', side); }, [side]);
  return (
    <div className={'a-landing a-landing-' + side}>
      <LandingHero side={side} setSide={setSide}
        onEnterBrand={onOpenRoster}
        onEnterCreator={onOpenApply} />
      <LandingKpis side={side} />
      <LandingHow side={side} onEnterBrand={onOpenRoster} onEnterCreator={onOpenApply} />
      <LandingPreview side={side} onOpenCreator={onOpenCreator} />
      <LandingQuote side={side} />
      <LandingFoot side={side} onEnterBrand={onOpenRoster} onEnterCreator={onOpenApply} />
    </div>
  );
}

Object.assign(window, { LandingScreen });
