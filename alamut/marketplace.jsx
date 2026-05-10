// Passionfroot-style marketplace surfaces for Alamut.
// All screens use existing window globals: Icon, Label, Rule, Pill, Btn, Logo, fmt, KPI
// Fresh data lives at bottom of file.

// =====================================================================
// 1. DISCOVER  — live brand campaigns, creators apply (inverse of Brief)
// =====================================================================
function DiscoverScreen({ onOpenCampaign }) {
  const [filter, setFilter] = React.useState('all');
  const filtered = filter === 'all' ? OPEN_CAMPAIGNS : OPEN_CAMPAIGNS.filter(c => c.discipline === filter);
  const disciplines = ['all', ...Array.from(new Set(OPEN_CAMPAIGNS.map(c => c.discipline)))];

  return (
    <div className="a-roster" style={{ paddingBottom: 120 }}>
      <section className="a-roster-head">
        <div className="a-roster-head-top">
          <div>
            <Label num="DISCOVER">Live campaigns, open to applications</Label>
            <h1 className="a-display">
              Brands looking for <em>creators</em><br />— right now.
            </h1>
            <p className="a-lede">
              Browse open campaigns from brands across South Asia and the diaspora.
              Apply with your storefront in one click. Brands review every application within 72 hours,
              and you keep 95% of the deal value.
            </p>
          </div>
          <aside className="a-roster-head-meta">
            <div><div className="a-meta-k">Live now</div><div className="a-meta-v">{OPEN_CAMPAIGNS.length}</div></div>
            <div><div className="a-meta-k">Combined budget</div><div className="a-meta-v">12.4<span>L</span></div></div>
            <div><div className="a-meta-k">Avg. response</div><div className="a-meta-v">38<span>h</span></div></div>
            <div><div className="a-meta-k">Acceptance rate</div><div className="a-meta-v">31<span>%</span></div></div>
          </aside>
        </div>
        <Rule style={{ marginTop: 48 }} />
        <div className="a-roster-toolbar">
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {disciplines.map(d => (
              <Pill key={d} active={filter === d} onClick={() => setFilter(d)}>{d === 'all' ? 'All' : d}</Pill>
            ))}
          </div>
          <div className="a-toolbar-right">
            <span className="a-toolbar-count">{filtered.length} showing</span>
          </div>
        </div>
      </section>

      <section className="a-wrap" style={{ marginTop: 32 }}>
        <div className="dc-list">
          {filtered.map((c, i) => (
            <button key={c.id} className="dc-card" onClick={() => onOpenCampaign && onOpenCampaign(c)}>
              <div className="dc-card-num">Nº {String(i + 1).padStart(2, '0')}</div>
              <div className="dc-card-body">
                <div className="dc-card-meta">
                  <span className="dc-card-brand">{c.brand}</span>
                  <span>·</span>
                  <span>{c.discipline}</span>
                  <span>·</span>
                  <span>{c.location}</span>
                </div>
                <h3 className="dc-card-title">{c.title}</h3>
                <p className="dc-card-pitch">{c.pitch}</p>
                <div className="dc-card-tags">
                  {c.deliverables.map(d => <span key={d} className="a-pill a-pill-muted">{d}</span>)}
                </div>
              </div>
              <div className="dc-card-stats">
                <div className="dc-stat">
                  <div className="dc-stat-v">₨ {c.budget}</div>
                  <div className="dc-stat-k">Budget per creator</div>
                </div>
                <div className="dc-stat">
                  <div className="dc-stat-v">{c.applicants}</div>
                  <div className="dc-stat-k">Applied so far</div>
                </div>
                <div className="dc-stat">
                  <div className="dc-stat-v">{c.daysLeft}<span style={{fontSize:14, color:'var(--ink-60)'}}>d</span></div>
                  <div className="dc-stat-k">Closes in</div>
                </div>
              </div>
              <div className="dc-card-cta">Apply <Icon.arrow s={14} /></div>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

function CampaignDetailDiscover({ campaign, onBack }) {
  const [applied, setApplied] = React.useState(false);
  const [pitch, setPitch] = React.useState('');
  return (
    <div className="a-wrap" style={{ paddingTop: 48, paddingBottom: 120, maxWidth: 1080 }}>
      <button className="a-top-link" onClick={onBack} style={{ marginBottom: 24 }}>
        <Icon.arrowLeft s={12} /> All live campaigns
      </button>
      <Label num={`OPEN · CLOSES IN ${campaign.daysLeft} DAYS`}>{campaign.brand} · {campaign.location}</Label>
      <h1 className="a-display" style={{ marginTop: 24 }}>{campaign.title}</h1>
      <p className="a-lede" style={{ marginTop: 24 }}>{campaign.pitch}</p>

      <Rule style={{ marginTop: 48 }} />

      <div className="dc-detail-grid">
        <div>
          <Label>The brief</Label>
          <h3 style={{ fontFamily: 'var(--serif)', fontSize: 24, fontWeight: 500, letterSpacing: '-0.02em', marginTop: 12 }}>{campaign.brief.heading}</h3>
          <p style={{ color: 'var(--ink-80)', marginTop: 16, lineHeight: 1.6 }}>{campaign.brief.body}</p>

          <Label style={{ marginTop: 40 }}>What we'll deliver</Label>
          <ul className="dc-checklist">
            {campaign.brief.deliverables.map(d => <li key={d}><Icon.check s={14} /> {d}</li>)}
          </ul>

          <Label style={{ marginTop: 40 }}>Looking for</Label>
          <ul className="dc-checklist">
            {campaign.brief.looking.map(d => <li key={d}><Icon.check s={14} /> {d}</li>)}
          </ul>

          <Label style={{ marginTop: 40 }}>Don't apply if</Label>
          <ul className="dc-checklist dc-checklist-no">
            {campaign.brief.avoid.map(d => <li key={d}><Icon.x /> {d}</li>)}
          </ul>
        </div>

        <aside className="dc-apply-side">
          <div style={{ position: 'sticky', top: 96 }}>
            {!applied ? (
              <>
                <div className="dc-apply-card">
                  <div className="dc-apply-row"><span>Budget</span><strong>₨ {campaign.budget}</strong></div>
                  <div className="dc-apply-row"><span>Deliverables</span><strong>{campaign.deliverables.join(', ')}</strong></div>
                  <div className="dc-apply-row"><span>Timeline</span><strong>{campaign.brief.timeline}</strong></div>
                  <div className="dc-apply-row"><span>Applied so far</span><strong>{campaign.applicants}</strong></div>
                  <Rule style={{ margin: '16px 0' }} />
                  <Label>Pitch yourself</Label>
                  <textarea
                    className="dc-textarea"
                    placeholder="One paragraph: why you, why this brand, what you'd actually make. The brand sees your storefront automatically."
                    value={pitch} onChange={(e) => setPitch(e.target.value)}
                  />
                  <Btn variant="solid" size="md" style={{ width: '100%', marginTop: 12 }}
                    onClick={() => setApplied(true)} icon={<Icon.arrow s={14} />}>
                    Apply with my storefront
                  </Btn>
                  <p style={{ fontSize: 12, color: 'var(--ink-60)', marginTop: 12, lineHeight: 1.5 }}>
                    Brands see your storefront, channels, and last-30-day stats. No CV, no portfolio PDF.
                  </p>
                </div>
              </>
            ) : (
              <div className="dc-apply-card dc-applied">
                <Icon.check s={24} />
                <h3>You're in.</h3>
                <p>{campaign.brand} has 47 hours to respond. We'll ping you on email + inbox the moment they do.</p>
                <Btn variant="outline" size="sm" onClick={onBack} icon={<Icon.arrow s={12} />}>Back to live campaigns</Btn>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

// =====================================================================
// 2. STOREFRONT EDITOR  — block-based page builder
// =====================================================================
function StorefrontEditor({ onBack }) {
  const [blocks, setBlocks] = React.useState(() => DEFAULT_BLOCKS);
  const [selected, setSelected] = React.useState(null);
  const [device, setDevice] = React.useState('desktop');

  const update = (id, patch) => setBlocks(blocks.map(b => b.id === id ? { ...b, ...patch } : b));
  const addBlock = (kind) => {
    const id = 'b' + Math.random().toString(36).slice(2, 8);
    const map = {
      text: { id, kind: 'text', heading: 'Section heading', body: 'Tell brands a bit about this section.' },
      packages: { id, kind: 'packages', items: [{ title: 'New package', price: 1000, desc: 'What you deliver.' }] },
      gallery: { id, kind: 'gallery', images: 4 },
      stats: { id, kind: 'stats' },
      faq: { id, kind: 'faq', items: [{ q: 'How do you work?', a: 'I review every brief personally.' }] },
    };
    setBlocks([...blocks, map[kind]]);
  };
  const remove = (id) => setBlocks(blocks.filter(b => b.id !== id));
  const move = (id, dir) => {
    const i = blocks.findIndex(b => b.id === id);
    const j = i + dir;
    if (j < 0 || j >= blocks.length) return;
    const next = blocks.slice();
    [next[i], next[j]] = [next[j], next[i]];
    setBlocks(next);
  };

  return (
    <div className="se">
      <header className="se-bar">
        <div className="se-bar-left">
          <button className="a-top-link" onClick={onBack}><Icon.arrowLeft s={12} /> Exit editor</button>
          <Rule style={{ width: 1, height: 16, margin: 0 }} />
          <span className="se-title">Storefront editor <em>· alamut.co/ayaankitchen</em></span>
        </div>
        <div className="se-bar-right">
          <div className="se-device">
            <button className={device === 'desktop' ? 'is-on' : ''} onClick={() => setDevice('desktop')}>Desktop</button>
            <button className={device === 'mobile' ? 'is-on' : ''} onClick={() => setDevice('mobile')}>Mobile</button>
          </div>
          <Btn variant="ghost" size="sm">Preview</Btn>
          <Btn variant="solid" size="sm">Publish changes</Btn>
        </div>
      </header>

      <div className="se-body">
        <aside className="se-rail">
          <Label>Page blocks</Label>
          <div className="se-blocks">
            {blocks.map((b, i) => (
              <div key={b.id}
                className={'se-block-row' + (selected === b.id ? ' is-on' : '')}
                onClick={() => setSelected(b.id)}>
                <span className="se-block-n">{String(i + 1).padStart(2, '0')}</span>
                <span className="se-block-kind">{b.kind}</span>
                <span className="se-block-actions">
                  <button onClick={(e) => { e.stopPropagation(); move(b.id, -1); }}>↑</button>
                  <button onClick={(e) => { e.stopPropagation(); move(b.id, 1); }}>↓</button>
                  <button onClick={(e) => { e.stopPropagation(); remove(b.id); }}><Icon.x /></button>
                </span>
              </div>
            ))}
          </div>
          <Label style={{ marginTop: 32 }}>Add block</Label>
          <div className="se-add">
            {[
              { k: 'text', l: 'Text section' },
              { k: 'packages', l: 'Packages' },
              { k: 'gallery', l: 'Gallery' },
              { k: 'stats', l: 'Channel stats' },
              { k: 'faq', l: 'FAQ' },
            ].map(b => (
              <button key={b.k} className="se-add-btn" onClick={() => addBlock(b.k)}>
                <Icon.plus s={12} /> {b.l}
              </button>
            ))}
          </div>
        </aside>

        <main className={'se-canvas se-canvas-' + device}>
          <div className="se-frame">
            <div className="se-page">
              <header className="se-page-head">
                <div className="se-avatar" style={{ backgroundImage: `url(${EDITOR_CREATOR.portrait})` }} />
                <div>
                  <div className="se-page-handle">alamut.co/{EDITOR_CREATOR.handle}</div>
                  <h1 className="se-page-name">{EDITOR_CREATOR.name}</h1>
                  <p className="se-page-tag">{EDITOR_CREATOR.tagline}</p>
                </div>
              </header>
              {blocks.map(b => <BlockRender key={b.id} block={b} selected={selected === b.id} onSelect={() => setSelected(b.id)} />)}
            </div>
          </div>
        </main>

        <aside className="se-inspector">
          {selected ? (
            <Inspector block={blocks.find(b => b.id === selected)} update={(patch) => update(selected, patch)} />
          ) : (
            <div className="se-empty">
              <Label>Inspector</Label>
              <p>Select a block on the left to edit its content.</p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function BlockRender({ block, selected, onSelect }) {
  const cls = 'se-blk' + (selected ? ' is-on' : '');
  if (block.kind === 'text') return (
    <section className={cls} onClick={onSelect}>
      <h2 className="se-blk-h">{block.heading}</h2>
      <p className="se-blk-body">{block.body}</p>
    </section>
  );
  if (block.kind === 'packages') return (
    <section className={cls} onClick={onSelect}>
      <Label>Book a collaboration</Label>
      <div className="se-packs">
        {block.items.map((p, i) => (
          <div key={i} className="se-pack">
            <div>
              <div className="se-pack-t">{p.title}</div>
              <div className="se-pack-d">{p.desc}</div>
            </div>
            <div className="se-pack-p">${p.price.toLocaleString()}</div>
          </div>
        ))}
      </div>
    </section>
  );
  if (block.kind === 'gallery') return (
    <section className={cls} onClick={onSelect}>
      <Label>Recent work</Label>
      <div className="se-gal" style={{ gridTemplateColumns: `repeat(${Math.min(block.images, 4)}, 1fr)` }}>
        {Array.from({length: block.images}).map((_, i) => <div key={i} className="se-gal-cell" />)}
      </div>
    </section>
  );
  if (block.kind === 'stats') return (
    <section className={cls} onClick={onSelect}>
      <Label>Channels · live</Label>
      <div className="se-stats">
        {EDITOR_CREATOR.channels.map(c => (
          <div key={c.kind} className="se-stat">
            <div className="se-stat-v">{c.followers}</div>
            <div className="se-stat-k">{c.name}</div>
          </div>
        ))}
      </div>
    </section>
  );
  if (block.kind === 'faq') return (
    <section className={cls} onClick={onSelect}>
      <Label>Questions, answered</Label>
      {block.items.map((q, i) => (
        <div key={i} className="se-faq">
          <div className="se-faq-q">{q.q}</div>
          <div className="se-faq-a">{q.a}</div>
        </div>
      ))}
    </section>
  );
  return null;
}

function Inspector({ block, update }) {
  if (!block) return null;
  return (
    <div className="se-inspect">
      <Label>Editing · {block.kind}</Label>
      {block.kind === 'text' && (
        <>
          <div className="se-field">
            <label>Heading</label>
            <input value={block.heading} onChange={(e) => update({ heading: e.target.value })} />
          </div>
          <div className="se-field">
            <label>Body</label>
            <textarea value={block.body} onChange={(e) => update({ body: e.target.value })} rows={6} />
          </div>
        </>
      )}
      {block.kind === 'packages' && (
        <>
          {block.items.map((p, i) => (
            <div key={i} className="se-pack-edit">
              <div className="se-field">
                <label>Title</label>
                <input value={p.title} onChange={(e) => {
                  const items = block.items.slice();
                  items[i] = { ...items[i], title: e.target.value };
                  update({ items });
                }} />
              </div>
              <div className="se-field">
                <label>Price (USD)</label>
                <input type="number" value={p.price} onChange={(e) => {
                  const items = block.items.slice();
                  items[i] = { ...items[i], price: +e.target.value };
                  update({ items });
                }} />
              </div>
              <div className="se-field">
                <label>Description</label>
                <textarea value={p.desc} rows={3} onChange={(e) => {
                  const items = block.items.slice();
                  items[i] = { ...items[i], desc: e.target.value };
                  update({ items });
                }} />
              </div>
            </div>
          ))}
          <Btn variant="outline" size="sm" icon={<Icon.plus s={12} />} onClick={() => {
            update({ items: [...block.items, { title: 'New package', price: 1000, desc: 'What you deliver.' }] });
          }}>Add package</Btn>
        </>
      )}
      {block.kind === 'gallery' && (
        <div className="se-field">
          <label>Number of images: {block.images}</label>
          <input type="range" min="2" max="8" value={block.images} onChange={(e) => update({ images: +e.target.value })} />
        </div>
      )}
      {block.kind === 'stats' && (
        <p style={{ fontSize: 13, color: 'var(--ink-60)', lineHeight: 1.5 }}>
          Live stats are pulled directly from your connected channels.
          Manage connections in <strong>Settings → Live Stats</strong>.
        </p>
      )}
      {block.kind === 'faq' && (
        <>
          {block.items.map((q, i) => (
            <div key={i} className="se-pack-edit">
              <div className="se-field">
                <label>Question</label>
                <input value={q.q} onChange={(e) => {
                  const items = block.items.slice();
                  items[i] = { ...items[i], q: e.target.value };
                  update({ items });
                }} />
              </div>
              <div className="se-field">
                <label>Answer</label>
                <textarea value={q.a} rows={3} onChange={(e) => {
                  const items = block.items.slice();
                  items[i] = { ...items[i], a: e.target.value };
                  update({ items });
                }} />
              </div>
            </div>
          ))}
          <Btn variant="outline" size="sm" icon={<Icon.plus s={12} />} onClick={() => {
            update({ items: [...block.items, { q: 'New question?', a: 'Answer.' }] });
          }}>Add question</Btn>
        </>
      )}
    </div>
  );
}

// =====================================================================
// 3. INBOX / CRM  — unified deal pipeline + chat
// =====================================================================
function InboxScreen() {
  const [active, setActive] = React.useState(INBOX_THREADS[0].id);
  const [stage, setStage] = React.useState('all');

  const filtered = stage === 'all' ? INBOX_THREADS : INBOX_THREADS.filter(t => t.stage === stage);
  const thread = INBOX_THREADS.find(t => t.id === active) || INBOX_THREADS[0];

  const stages = ['all', 'new', 'negotiating', 'booked', 'in-production', 'closed'];
  const counts = stages.reduce((acc, s) => {
    acc[s] = s === 'all' ? INBOX_THREADS.length : INBOX_THREADS.filter(t => t.stage === s).length;
    return acc;
  }, {});

  return (
    <div className="ix">
      <header className="ix-head a-wrap">
        <div>
          <Label>Inbox · deal pipeline</Label>
          <h1 className="a-display" style={{ fontSize: 56, marginTop: 12 }}>
            Your <em>conversations,</em><br />in one room.
          </h1>
          <p className="a-lede" style={{ marginTop: 16 }}>
            Every brand, every brief, every booking — sorted by where the deal actually is.
          </p>
        </div>
      </header>

      <div className="ix-pipe a-wrap">
        {stages.map(s => (
          <button key={s} className={'ix-stage' + (stage === s ? ' is-on' : '')} onClick={() => setStage(s)}>
            <span className="ix-stage-n">{counts[s] || 0}</span>
            <span className="ix-stage-l">{s.replace('-', ' ')}</span>
          </button>
        ))}
      </div>

      <div className="ix-grid a-wrap">
        <aside className="ix-list">
          {filtered.map(t => (
            <button key={t.id} className={'ix-thread' + (active === t.id ? ' is-on' : '')} onClick={() => setActive(t.id)}>
              <div className="ix-thread-av" style={{ backgroundImage: `url(${t.avatar})` }} />
              <div className="ix-thread-body">
                <div className="ix-thread-row">
                  <span className="ix-thread-brand">{t.brand}</span>
                  <span className="ix-thread-when">{t.when}</span>
                </div>
                <div className="ix-thread-snip">{t.preview}</div>
                <div className="ix-thread-tags">
                  <span className={`ix-tag ix-tag-${t.stage}`}>{t.stage}</span>
                  {t.amount && <span className="ix-tag-amt">${t.amount.toLocaleString()}</span>}
                </div>
              </div>
              {t.unread > 0 && <span className="ix-thread-dot">{t.unread}</span>}
            </button>
          ))}
        </aside>

        <section className="ix-pane">
          <header className="ix-pane-head">
            <div>
              <h3>{thread.brand}</h3>
              <p>{thread.contact} · {thread.email}</p>
            </div>
            <div className="ix-pane-actions">
              <Btn variant="ghost" size="sm">Counter-propose</Btn>
              <Btn variant="solid" size="sm">Accept brief</Btn>
            </div>
          </header>

          <div className="ix-deal">
            <div className="ix-deal-row">
              <Label>Deal</Label>
              <strong>{thread.deal.title}</strong>
            </div>
            <div className="ix-deal-row">
              <Label>Value</Label>
              <strong>${thread.deal.value.toLocaleString()}</strong>
            </div>
            <div className="ix-deal-row">
              <Label>Posts on</Label>
              <strong>{thread.deal.runDate}</strong>
            </div>
            <div className="ix-deal-row">
              <Label>Stage</Label>
              <strong>{thread.stage.replace('-', ' ')}</strong>
            </div>
          </div>

          <div className="ix-msgs">
            {thread.messages.map((m, i) => (
              <div key={i} className={'ix-msg ix-msg-' + m.from}>
                <div className="ix-msg-bubble">{m.text}</div>
                <div className="ix-msg-when">{m.when}</div>
              </div>
            ))}
          </div>

          <footer className="ix-compose">
            <textarea placeholder={`Reply to ${thread.contact}…`} rows={2} />
            <div className="ix-compose-bar">
              <span style={{fontSize: 11, color: 'var(--ink-60)', fontFamily: 'var(--mono)', letterSpacing: '0.06em'}}>
                ENTER to send · SHIFT+ENTER for new line
              </span>
              <Btn variant="solid" size="sm" icon={<Icon.arrow s={12} />}>Send reply</Btn>
            </div>
          </footer>
        </section>
      </div>
    </div>
  );
}

// =====================================================================
// 4. WALLET & PAYMENTS  — escrow, invoices, payouts
// =====================================================================
function WalletScreen() {
  const [tab, setTab] = React.useState('escrow');
  return (
    <div className="wl">
      <header className="wl-head a-wrap">
        <Label>Wallet · brand</Label>
        <h1 className="a-display" style={{ fontSize: 56, marginTop: 12 }}>
          One vendor.<br /><em>Many creators.</em>
        </h1>
        <p className="a-lede" style={{ marginTop: 16, maxWidth: '60ch' }}>
          Top up once. Pay creators across borders without the FX gymnastics.
          Funds sit in escrow until content goes live; you only release on approval.
        </p>
      </header>

      <section className="wl-bal a-wrap">
        <div className="wl-bal-card wl-bal-main">
          <div className="wl-bal-k">Available balance</div>
          <div className="wl-bal-v">$48,200<span>.50</span></div>
          <div className="wl-bal-meta">USD · ready to spend on bookings</div>
          <div className="wl-bal-actions">
            <Btn variant="solid" size="sm" icon={<Icon.plus s={12} />}>Top up</Btn>
            <Btn variant="outline" size="sm">Download statement</Btn>
          </div>
        </div>
        <div className="wl-bal-side">
          <div className="wl-bal-stat"><div className="wl-bal-stat-k">In escrow</div><div className="wl-bal-stat-v">$24,800</div><div className="wl-bal-stat-sub">7 active bookings</div></div>
          <div className="wl-bal-stat"><div className="wl-bal-stat-k">Released this month</div><div className="wl-bal-stat-v">$36,140</div><div className="wl-bal-stat-sub">12 creators paid</div></div>
          <div className="wl-bal-stat"><div className="wl-bal-stat-k">Pending invoices</div><div className="wl-bal-stat-v">$4,300</div><div className="wl-bal-stat-sub">2 awaiting approval</div></div>
        </div>
      </section>

      <div className="wl-tabs a-wrap">
        {['escrow', 'transactions', 'invoices', 'payout-methods'].map(t => (
          <button key={t} className={'wl-tab' + (tab === t ? ' is-on' : '')} onClick={() => setTab(t)}>
            {t.replace('-', ' ')}
          </button>
        ))}
      </div>

      <section className="a-wrap" style={{ marginTop: 24, paddingBottom: 120 }}>
        {tab === 'escrow' && (
          <table className="wl-table">
            <thead>
              <tr><th>Creator</th><th>Booking</th><th>Posts on</th><th>Held</th><th>Releases</th><th>Action</th></tr>
            </thead>
            <tbody>
              {ESCROW_ROWS.map((r, i) => (
                <tr key={i}>
                  <td><strong>{r.creator}</strong></td>
                  <td>{r.booking}</td>
                  <td>{r.posts}</td>
                  <td>${r.held.toLocaleString()}</td>
                  <td><span className={'wl-pill wl-pill-' + r.statusKey}>{r.status}</span></td>
                  <td>{r.statusKey === 'review' ? <Btn variant="outline" size="sm">Review &amp; release</Btn> : <button className="a-top-link" style={{padding: 0}}>View</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {tab === 'transactions' && (
          <table className="wl-table">
            <thead>
              <tr><th>Date</th><th>Description</th><th>Method</th><th>Direction</th><th style={{textAlign: 'right'}}>Amount</th></tr>
            </thead>
            <tbody>
              {TRANSACTIONS.map((r, i) => (
                <tr key={i}>
                  <td>{r.date}</td>
                  <td><strong>{r.desc}</strong></td>
                  <td>{r.method}</td>
                  <td><span className={'wl-pill wl-pill-' + (r.dir === 'in' ? 'paid' : 'review')}>{r.dir === 'in' ? 'Credit' : 'Debit'}</span></td>
                  <td style={{textAlign: 'right', fontFamily: 'var(--serif)', fontWeight: 500}}>{r.dir === 'in' ? '+' : '−'} ${r.amt.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {tab === 'invoices' && (
          <table className="wl-table">
            <thead>
              <tr><th>Invoice</th><th>From</th><th>Issued</th><th>Due</th><th style={{textAlign: 'right'}}>Amount</th><th>Status</th></tr>
            </thead>
            <tbody>
              {INVOICES.map((r, i) => (
                <tr key={i}>
                  <td><strong>{r.id}</strong></td>
                  <td>{r.from}</td>
                  <td>{r.issued}</td>
                  <td>{r.due}</td>
                  <td style={{textAlign: 'right', fontFamily: 'var(--serif)', fontWeight: 500}}>${r.amt.toLocaleString()}</td>
                  <td><span className={'wl-pill wl-pill-' + r.statusKey}>{r.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {tab === 'payout-methods' && (
          <div className="wl-payouts">
            {PAYOUT_METHODS.map((m, i) => (
              <div key={i} className={'wl-payout' + (m.primary ? ' is-primary' : '')}>
                <div className="wl-payout-ic">{m.kind}</div>
                <div className="wl-payout-body">
                  <div className="wl-payout-t">{m.label}</div>
                  <div className="wl-payout-d">{m.detail}</div>
                </div>
                {m.primary && <span className="wl-pill wl-pill-paid">Primary</span>}
                <button className="a-top-link" style={{padding: 0}}>Manage</button>
              </div>
            ))}
            <button className="wl-payout-add"><Icon.plus s={14} /> Add payout method</button>
          </div>
        )}
      </section>
    </div>
  );
}

// =====================================================================
// 5. AI MATCH ASSISTANT  ("Zest"-style → here: "Zara")
// =====================================================================
function AIMatchScreen({ onClose }) {
  const [step, setStep] = React.useState(0);
  const [q, setQ] = React.useState('');
  const [thinking, setThinking] = React.useState(false);
  const [matches, setMatches] = React.useState([]);

  const submit = () => {
    setThinking(true);
    setStep(1);
    setTimeout(() => {
      setMatches(AI_MATCHES);
      setThinking(false);
      setStep(2);
    }, 1400);
  };

  return (
    <div className="ai">
      <div className="ai-stage">
        <div className="ai-tag">
          <span className="ai-tag-dot" /> Concierge · powered by your roster data
        </div>
        <h1 className="ai-h">Tell us about your<br /><em>campaign.</em></h1>

        {step === 0 && (
          <div className="ai-input-card">
            <textarea
              className="ai-input"
              placeholder="e.g. Soft-launching a halal skincare line in Lahore. Need 3–5 lifestyle creators who can do honest, no-discount-code reviews. Budget around $2,500 per creator. Want diaspora reach too."
              value={q} onChange={(e) => setQ(e.target.value)}
              autoFocus
            />
            <div className="ai-prompts">
              <Label>Or try one of these</Label>
              <div className="ai-prompts-list">
                {AI_PROMPTS.map((p, i) => (
                  <button key={i} className="ai-prompt" onClick={() => setQ(p)}>{p}</button>
                ))}
              </div>
            </div>
            <Btn variant="solid" size="md" icon={<Icon.arrow s={14} />} onClick={submit} style={{ alignSelf: 'flex-start' }}>
              Find matches
            </Btn>
          </div>
        )}

        {step === 1 && (
          <div className="ai-thinking">
            <div className="ai-thinking-dots"><span /><span /><span /></div>
            <p>Reading {ROSTER ? ROSTER.length : 12} storefronts, last-90-day stats, past campaign performance, audience overlap…</p>
          </div>
        )}

        {step === 2 && (
          <div className="ai-results">
            <Label>Top 3 matches · ranked by fit</Label>
            <div className="ai-matches">
              {matches.map((m, i) => (
                <div key={i} className="ai-match">
                  <div className="ai-match-rank">{String(i + 1).padStart(2, '0')}</div>
                  <div className="ai-match-portrait" style={{ backgroundImage: `url(${m.portrait})` }} />
                  <div className="ai-match-body">
                    <div className="ai-match-name">{m.name}</div>
                    <div className="ai-match-meta">{m.handle} · {m.city}</div>
                    <p className="ai-match-why">"{m.why}"</p>
                    <div className="ai-match-tags">
                      {m.tags.map(t => <span key={t} className="a-pill a-pill-muted">{t}</span>)}
                    </div>
                  </div>
                  <div className="ai-match-score">
                    <div className="ai-match-score-v">{m.score}</div>
                    <div className="ai-match-score-l">match</div>
                    <div className="ai-match-score-bar">
                      <div className="ai-match-score-fill" style={{ width: m.score + '%' }} />
                    </div>
                  </div>
                  <Btn variant="outline" size="sm" icon={<Icon.arrow s={12} />}>Add to shortlist</Btn>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
              <Btn variant="ghost" size="sm" onClick={() => { setStep(0); setMatches([]); }}>Refine prompt</Btn>
              <Btn variant="solid" size="sm" icon={<Icon.arrow s={14} />}>Add all 3 to shortlist</Btn>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// =====================================================================
// 6. LIVE STATS CONNECTION  — OAuth-style flow
// =====================================================================
function LiveStatsScreen({ onBack }) {
  const [connections, setConnections] = React.useState(() => INITIAL_CONNECTIONS.map(c => ({ ...c })));
  const [connecting, setConnecting] = React.useState(null);

  const startConnect = (kind) => {
    setConnecting(kind);
    setTimeout(() => {
      setConnections(connections.map(c => c.kind === kind ? { ...c, connected: true, last: 'just now', followers: c.placeholderFollowers, eng: c.placeholderEng } : c));
      setConnecting(null);
    }, 1800);
  };

  const disconnect = (kind) => setConnections(connections.map(c => c.kind === kind ? { ...c, connected: false } : c));

  return (
    <div className="ls">
      <header className="ls-head a-wrap">
        <button className="a-top-link" onClick={onBack} style={{ marginBottom: 24 }}>
          <Icon.arrowLeft s={12} /> My storefront
        </button>
        <Label>Live stats · connections</Label>
        <h1 className="a-display" style={{ fontSize: 56, marginTop: 12 }}>
          Numbers brands<br /><em>can actually trust.</em>
        </h1>
        <p className="a-lede" style={{ marginTop: 16, maxWidth: '60ch' }}>
          Connect your channels. We pull follower counts and engagement straight from each platform's API,
          updated daily. No screenshots, no inflated numbers, no embarrassing audits.
        </p>
      </header>

      <section className="a-wrap" style={{ paddingBottom: 120 }}>
        <div className="ls-cards">
          {connections.map(c => (
            <div key={c.kind} className={'ls-card' + (c.connected ? ' is-on' : '')}>
              <div className="ls-card-head">
                <div className="ls-card-ic">{c.ic}</div>
                <div className="ls-card-hb">
                  <div className="ls-card-n">{c.name}</div>
                  <div className="ls-card-h">{c.handle}</div>
                </div>
                {c.connected && <span className="ls-pill"><span className="ls-pill-dot" /> Connected</span>}
              </div>

              {c.connected ? (
                <>
                  <div className="ls-stats">
                    <div><div className="ls-stat-v">{c.followers}</div><div className="ls-stat-k">Followers</div></div>
                    <div><div className="ls-stat-v">{c.eng}</div><div className="ls-stat-k">Engagement</div></div>
                    <div><div className="ls-stat-v">{c.last}</div><div className="ls-stat-k">Synced</div></div>
                  </div>
                  <div className="ls-actions">
                    <button className="a-top-link" onClick={() => disconnect(c.kind)}>Disconnect</button>
                    <button className="a-top-link">Refresh now</button>
                  </div>
                </>
              ) : (
                <>
                  <p className="ls-card-d">{c.desc}</p>
                  <Btn variant={connecting === c.kind ? 'ghost' : 'outline'} size="sm"
                    onClick={() => startConnect(c.kind)}
                    icon={<Icon.arrow s={12} />}>
                    {connecting === c.kind ? 'Authorizing…' : 'Connect ' + c.name}
                  </Btn>
                </>
              )}
            </div>
          ))}
        </div>

        <div className="ls-trust">
          <Label>How it works</Label>
          <div className="ls-trust-grid">
            <div className="ls-trust-step">
              <div className="ls-trust-n">01</div>
              <div className="ls-trust-t">Read-only access</div>
              <div className="ls-trust-d">We only request public profile data and aggregate stats. We can't post, DM, or read your messages.</div>
            </div>
            <div className="ls-trust-step">
              <div className="ls-trust-n">02</div>
              <div className="ls-trust-t">Synced daily</div>
              <div className="ls-trust-d">Stats refresh every 24 hours. Brands always see numbers from the last sync, with the timestamp visible.</div>
            </div>
            <div className="ls-trust-step">
              <div className="ls-trust-n">03</div>
              <div className="ls-trust-t">Disconnect anytime</div>
              <div className="ls-trust-d">Revoke access from your platform settings or here. Your storefront falls back to manual numbers.</div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

// =====================================================================
// DATA
// =====================================================================
const OPEN_CAMPAIGNS = [
  {
    id: 'oc1', brand: 'Habibi Coffee Roasters', discipline: 'Food', location: 'Karachi',
    title: 'Eid 2026 — gift box launch', budget: '180–250K', applicants: 47, daysLeft: 9,
    pitch: 'Soft-launching our first Eid gift box. Looking for warm, documentary-style storytelling. We want creators who actually drink coffee, not influencers chasing free product.',
    deliverables: ['1 Reel', '3 Stories', '1 Newsletter mention'],
    brief: {
      heading: 'A campaign about giving, not selling.',
      body: 'Our gift box is the smallest, most carefully-edited thing we\'ve ever made — three single-origin pours, a handmade kettle, and a letter. We want one Reel that captures the act of giving it to someone, plus organic Story coverage of the unboxing. No discount codes. No "swipe up". Trust the work.',
      deliverables: ['1 Instagram Reel, 30–60s, scripted with you', '3 organic Stories on launch day', 'One mention in your weekly newsletter (we don\'t need control over the copy)', 'You retain full ownership of all assets'],
      looking: ['Karachi or Lahore based', 'Minimum 25K engaged followers on IG', 'A track record of food, lifestyle, or interiors content', 'Comfort with documentary-style storytelling'],
      avoid: ['Discount-code-driven content', 'Heavy filters or stylized food photography', '#ad-stacked grids'],
      timeline: 'Apply by Apr 14 · Posts during Eid week (Jun 5–12)',
    },
  },
  {
    id: 'oc2', brand: 'Khaadi', discipline: 'Fashion', location: 'Lahore',
    title: 'Summer Edit — ten silhouettes, ten cities', budget: '350–500K', applicants: 128, daysLeft: 4,
    pitch: 'Ten creators, ten cities, ten silhouettes. We\'re building a regional editorial across Pakistan and the diaspora — Karachi, Lahore, Dubai, London, Toronto, NYC.',
    deliverables: ['1 Reel', '1 IG carousel', '1 YouTube short'],
    brief: {
      heading: 'Editorial scale, indie soul.',
      body: 'For our SS26 drop we want to skip the studio shoot. Instead: ten creators, in ten cities, each shooting one silhouette in their own neighborhood, in their own light. We\'ll commission a director to stitch the films together but the creator owns the edit.',
      deliverables: ['One 30s Reel + one IG carousel (4–8 frames)', 'One YouTube short (15–60s)', 'Behind-the-scenes Stories the day of shoot', 'A 200-word essay for our journal (paid additional ₨ 25K)'],
      looking: ['Strong personal aesthetic, not a "Khaadi look"', 'Comfort working independently with a remote director', 'IG primary; YT secondary', 'Diaspora cities encouraged'],
      avoid: ['Outfit-dump content', 'Audio borrowed from trends', 'Studio backgrounds — outdoor or in-home only'],
      timeline: 'Apply by Apr 11 · Shoot week of Apr 28 · Live May 12',
    },
  },
  {
    id: 'oc3', brand: 'Tapal Tea', discipline: 'Food', location: 'Pan-Pakistan',
    title: 'Chai with strangers — 4-part series', budget: '800K total', applicants: 24, daysLeft: 16,
    pitch: 'A 4-part long-form YouTube series where you make chai for someone you\'ve never met. We provide the tea, the format, and the budget. You bring the people.',
    deliverables: ['4× YouTube videos (8–12 min)'],
    brief: {
      heading: 'Old format, real people, no script.',
      body: 'We\'re commissioning one creator to do a full 4-part series. Each episode: you set up a small chai cart somewhere public — a market, a beach, a train platform — and serve chai to strangers, in exchange for a story. We\'ll provide production support but you own the shape of it.',
      deliverables: ['4 long-form YouTube videos, 8–12 min each, posted weekly', 'Cross-posts to your IG (your call on format)', 'You retain full IP. We use clips for our own channels with credit + additional ₨ 50K per clip.'],
      looking: ['Long-form YouTube as primary channel', 'Track record of unscripted documentary work', 'Comfortable on camera with strangers', 'Karachi-based (production support is here)'],
      avoid: ['Anyone who needs a script', 'Anyone who hasn\'t shipped long-form before', 'Anyone whose audience skews under 18'],
      timeline: 'Apply by Apr 24 · Shoot May–Jun · Live Jul–Aug, weekly',
    },
  },
  {
    id: 'oc4', brand: 'Generation', discipline: 'Fashion', location: 'Karachi',
    title: 'Daily wear, on the people who wear it daily', budget: '120–180K', applicants: 89, daysLeft: 6,
    pitch: 'No creators in studios. We want creators who already wear our clothes, talking honestly about what works and what doesn\'t — five-piece carousel, no Reels.',
    deliverables: ['1 IG carousel'],
    brief: {
      heading: 'Honest, not branded.',
      body: 'A simple ask: a carousel showing five Generation pieces in your real wardrobe, with notes on what you actually wear them with. Yes you can include criticism. Yes we will publish it.',
      deliverables: ['One IG carousel, 5–8 frames', 'Captions written by you', 'Final approval rests with you, not us'],
      looking: ['Already a Generation customer', 'Karachi or Islamabad based', 'Strong written voice in captions'],
      avoid: ['Anyone who needs to be sent product they don\'t own'],
      timeline: 'Apply by Apr 13 · Live by Apr 30',
    },
  },
  {
    id: 'oc5', brand: 'Sapphire', discipline: 'Fashion', location: 'Lahore',
    title: 'Bridal for the bride who said no to bridal', budget: '400–600K', applicants: 62, daysLeft: 11,
    pitch: 'Bridalwear, but for women who don\'t see themselves in traditional bridal campaigns. Older brides, second weddings, courthouse brides, queer brides.',
    deliverables: ['1 Reel', '1 carousel', '1 long-form caption essay'],
    brief: {
      heading: 'A campaign that knows who it isn\'t for.',
      body: 'We\'ve been doing bridal the same way for ten years. We\'d like to do it differently. Looking for one creator to lead a single editorial moment — your wedding, real or staged — that says something the catalog cannot.',
      deliverables: ['One Reel (60s)', 'One carousel (6–10 frames)', 'One long-form caption (300+ words)', 'You appear in the campaign or you direct it. Both work.'],
      looking: ['Has written about identity, family, or marriage before', 'Audience skews 28+', 'Lahore or remote OK'],
      avoid: ['Traditional bridal influencers', 'Paid promotion-heavy grids'],
      timeline: 'Apply by Apr 19 · Live mid-May',
    },
  },
];

const DEFAULT_BLOCKS = [
  { id: 'b1', kind: 'stats' },
  { id: 'b2', kind: 'text', heading: 'How I work', body: 'I review every brief personally. If it\'s a fit I send back a rough outline within 48 hours. I don\'t do discount codes, generic captions, or anything I wouldn\'t actually cook for friends.' },
  { id: 'b3', kind: 'packages', items: [
    { title: 'Instagram Reel', price: 1800, desc: 'Dedicated 30–60s recipe Reel. Includes caption + Stories re-share.' },
    { title: 'YouTube Integration', price: 4200, desc: '60–90s mid-roll integration in a full recipe video.' },
    { title: 'Newsletter Feature', price: 900, desc: 'Dedicated section in the weekly newsletter.' },
  ]},
  { id: 'b4', kind: 'gallery', images: 4 },
  { id: 'b5', kind: 'faq', items: [
    { q: 'Do you do giveaways or discount codes?', a: 'No. They erode my audience\'s trust over time and the data shows they don\'t convert as well as honest reviews anyway.' },
    { q: 'How fast do you turn around?', a: 'First draft within the agreed turnaround. One round of revisions included; subsequent rounds at $200 each (we rarely need them).' },
    { q: 'Can I see your audience demographics?', a: 'Yes — once a brief is exchanged I share full Insights screenshots. I don\'t put them on the storefront because they\'d need updating weekly.' },
  ]},
];

const EDITOR_CREATOR = {
  name: 'Ayaan Patel',
  handle: 'ayaankitchen',
  tagline: 'Modern South Asian cooking, at home. Self-taught, slow-paced, never in a rush.',
  portrait: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600&h=600&fit=crop',
  channels: [
    { kind: 'IG', name: 'Instagram', followers: '142K' },
    { kind: 'YT', name: 'YouTube', followers: '38.2K' },
    { kind: 'NL', name: 'Newsletter', followers: '18.4K' },
    { kind: 'TT', name: 'TikTok', followers: '96K' },
  ],
};

const INBOX_THREADS = [
  {
    id: 't1', brand: 'Habibi Coffee Roasters', contact: 'Amna Shah', email: 'amna@habibi.co',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&h=200&fit=crop',
    when: '14m', preview: 'Brief looks great. One question — could you do a second variant of the Reel for B-roll?', stage: 'negotiating', amount: 1800, unread: 2,
    deal: { title: 'Eid gift-box Reel', value: 1800, runDate: 'Jun 8' },
    messages: [
      { from: 'them', text: 'Hi Ayaan! Loved your last few posts. We\'re launching a small Eid gift box and would love a Reel from you.', when: 'Yesterday' },
      { from: 'me', text: 'Thanks Amna! I had a look at the box on your site — beautiful. I think a Reel could work but I\'d want to skip the sponsored format and do it more like a handover scene. I\'ll send a rough outline tomorrow.', when: 'Yesterday' },
      { from: 'them', text: 'That sounds exactly right.', when: 'Yesterday' },
      { from: 'me', text: 'Outline attached. Pricing as on storefront — $1,800 + 5% platform fee. Posts during Eid week.', when: '14h' },
      { from: 'them', text: 'Brief looks great. One question — could you do a second variant of the Reel for B-roll?', when: '14m' },
    ],
  },
  {
    id: 't2', brand: 'Khaadi', contact: 'Sara Iqbal', email: 'sara.iqbal@khaadi.com',
    avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&h=200&fit=crop',
    when: '2h', preview: 'Counter-proposing — would you do all four pieces for ₨ 350K?', stage: 'negotiating', amount: 3500, unread: 1,
    deal: { title: 'SS26 Editorial × 4 silhouettes', value: 3500, runDate: 'May 12' },
    messages: [
      { from: 'them', text: 'Counter-proposing — would you do all four pieces for ₨ 350K?', when: '2h' },
    ],
  },
  {
    id: 't3', brand: 'Foodpanda', contact: 'Hasan Mir', email: 'hasan@foodpanda.pk',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&h=200&fit=crop',
    when: 'Yesterday', preview: 'Confirmed for Mar 28. Going to comms tonight.', stage: 'booked', amount: 2400, unread: 0,
    deal: { title: 'Ramadan delivery campaign', value: 2400, runDate: 'Mar 28' },
    messages: [{ from: 'them', text: 'Confirmed for Mar 28. Going to comms tonight.', when: 'Yesterday' }],
  },
  {
    id: 't4', brand: 'Tapal Tea', contact: 'Anum Khan', email: 'anum@tapal.com',
    avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=200&h=200&fit=crop',
    when: '3d', preview: 'Hi Ayaan, would love to work together on our chai-with-strangers series.', stage: 'new', amount: 0, unread: 1,
    deal: { title: '4-part chai series — initial outreach', value: 0, runDate: 'TBD' },
    messages: [{ from: 'them', text: 'Hi Ayaan, would love to work together on our chai-with-strangers series. We saw your application on Discover.', when: '3d' }],
  },
  {
    id: 't5', brand: 'Aesop', contact: 'Mara Lin', email: 'mara@aesop.com',
    avatar: 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=200&h=200&fit=crop',
    when: '1w', preview: 'Final cut received and approved. Posting tomorrow.', stage: 'in-production', amount: 6200, unread: 0,
    deal: { title: 'Sunscreen integration · YouTube', value: 6200, runDate: 'Apr 4' },
    messages: [{ from: 'them', text: 'Final cut received and approved. Posting tomorrow.', when: '1w' }],
  },
  {
    id: 't6', brand: 'Generation', contact: 'Zoya Ahmed', email: 'zoya@generation.com.pk',
    avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=200&h=200&fit=crop',
    when: '2w', preview: 'Thanks Ayaan — payment cleared. See you next season.', stage: 'closed', amount: 1400, unread: 0,
    deal: { title: 'Daily wear carousel', value: 1400, runDate: 'Mar 18 (live)' },
    messages: [{ from: 'them', text: 'Thanks Ayaan — payment cleared. See you next season.', when: '2w' }],
  },
];

const ESCROW_ROWS = [
  { creator: 'Ayaan Patel', booking: 'Eid gift-box Reel', posts: 'Jun 8', held: 1800, status: 'In escrow', statusKey: 'escrow' },
  { creator: 'Sarah Khan', booking: 'SS26 silhouette × IG', posts: 'May 12', held: 3500, status: 'Awaiting brief', statusKey: 'review' },
  { creator: 'Marcus Chen', booking: 'Travel YouTube long-form', posts: 'May 26', held: 6200, status: 'In production', statusKey: 'escrow' },
  { creator: 'Ananya Iyer', booking: 'Beauty carousel × 3', posts: 'Apr 18 (live)', held: 2100, status: 'Ready to release', statusKey: 'review' },
  { creator: 'Saif Ali', booking: 'Architecture essay', posts: 'Apr 22 (live)', held: 1200, status: 'Released', statusKey: 'paid' },
];

const TRANSACTIONS = [
  { date: 'Mar 28', desc: 'Wallet top-up', method: 'Bank transfer · USD', dir: 'in', amt: 50000 },
  { date: 'Mar 26', desc: 'Booking · Sarah Khan · SS26', method: 'Escrow', dir: 'out', amt: 3500 },
  { date: 'Mar 22', desc: 'Released · Foodpanda Ramadan', method: 'Payout · Ayaan Patel', dir: 'out', amt: 2400 },
  { date: 'Mar 18', desc: 'Released · Generation daily wear', method: 'Payout · 6 creators', dir: 'out', amt: 8400 },
  { date: 'Mar 14', desc: 'Wallet top-up', method: 'Card · Visa •• 4242', dir: 'in', amt: 25000 },
  { date: 'Mar 09', desc: 'Refund · cancelled booking', method: 'Wallet credit', dir: 'in', amt: 1800 },
];

const INVOICES = [
  { id: 'INV-2026-041', from: 'Ayaan Patel', issued: 'Mar 28', due: 'Apr 27', amt: 1800, status: 'Awaiting approval', statusKey: 'review' },
  { id: 'INV-2026-038', from: 'Sarah Khan', issued: 'Mar 26', due: 'Apr 25', amt: 3500, status: 'Approved · scheduled', statusKey: 'escrow' },
  { id: 'INV-2026-031', from: 'Marcus Chen', issued: 'Mar 18', due: 'Apr 17', amt: 6200, status: 'Paid', statusKey: 'paid' },
  { id: 'INV-2026-029', from: 'Generation Pak', issued: 'Mar 14', due: 'Mar 28', amt: 8400, status: 'Paid', statusKey: 'paid' },
];

const PAYOUT_METHODS = [
  { kind: 'BANK', label: 'HBL Business · ••4892', detail: 'Karachi, PKR · Default for PK creators', primary: true },
  { kind: 'WISE', label: 'Wise multi-currency', detail: 'USD, GBP, EUR · Cross-border payouts' },
  { kind: 'STRIPE', label: 'Stripe Connect', detail: 'Fast payouts · 1.5% fee' },
];

const AI_PROMPTS = [
  'Soft-launching a halal skincare line in Lahore. 3–5 creators, $2,500 each.',
  'YouTube long-form for a documentary about Karachi street food. One creator, big idea.',
  'Bridalwear, queer brides, lower-cost segment. Need diaspora reach.',
];

const AI_MATCHES = [
  {
    name: 'Ananya Iyer', handle: '@ananya.iyer', city: 'Mumbai',
    portrait: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&h=400&fit=crop',
    why: 'Honest reviews, audience overlap with skincare buyers in Karachi diaspora, repeat brand bookings (Aesop, Tata Harper). 11.4% engagement, way above category mean.',
    score: 94, tags: ['Beauty', 'Skincare', 'Diaspora-strong'],
  },
  {
    name: 'Hira Suleri', handle: '@hira.suleri', city: 'Lahore',
    portrait: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=400&fit=crop',
    why: 'Lahore-based, halal-conscious editorial voice, posts that read like essays. Past performance with Khaadi suggests a strong fit for narrative-driven launches.',
    score: 91, tags: ['Lifestyle', 'Editorial', 'Lahore'],
  },
  {
    name: 'Zoya Ahmed', handle: '@zoyaa.studio', city: 'Karachi',
    portrait: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400&h=400&fit=crop',
    why: 'Beauty-adjacent (interiors-leaning), but her audience overlap with the brief\'s ICP is 67% — highest of any creator in the roster.',
    score: 87, tags: ['Beauty', 'Interiors', 'High overlap'],
  },
];

const INITIAL_CONNECTIONS = [
  { kind: 'IG', ic: '◎', name: 'Instagram', handle: '@ayaankitchen', desc: 'Pulls follower count, engagement rate, last-30-day reach. Refreshes daily.', connected: true, last: '2 hours ago', followers: '142K', eng: '6.8%', placeholderFollowers: '142K', placeholderEng: '6.8%' },
  { kind: 'YT', ic: '▶', name: 'YouTube', handle: 'Ayaan Patel', desc: 'Subscribers, average view count, watch time. Refreshes daily.', connected: true, last: '2 hours ago', followers: '38.2K', eng: '11.4%', placeholderFollowers: '38.2K', placeholderEng: '11.4%' },
  { kind: 'TT', ic: '♫', name: 'TikTok', handle: '@ayaankitchen', desc: 'Followers, average plays, engagement. Pull is read-only.', connected: false, placeholderFollowers: '96K', placeholderEng: '8.1%' },
  { kind: 'NL', ic: '✉', name: 'Newsletter (Substack)', handle: 'Table of Two', desc: 'Subscribers, open rate, click-through. Auth via API key.', connected: true, last: 'yesterday', followers: '18.4K', eng: '62% open', placeholderFollowers: '18.4K', placeholderEng: '62% open' },
  { kind: 'X', ic: '𝕏', name: 'X (Twitter)', handle: '@ayaanpatel', desc: 'Followers, impressions, engagement. v2 API access.', connected: false, placeholderFollowers: '24K', placeholderEng: '3.2%' },
  { kind: 'LI', ic: 'in', name: 'LinkedIn', handle: 'Ayaan Patel', desc: 'Connections, post impressions. For B2B briefs.', connected: false, placeholderFollowers: '8.6K', placeholderEng: '4.1%' },
];

Object.assign(window, {
  DiscoverScreen, CampaignDetailDiscover,
  StorefrontEditor,
  InboxScreen,
  WalletScreen,
  AIMatchScreen,
  LiveStatsScreen,
  OPEN_CAMPAIGNS,
});
