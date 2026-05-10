// Studio — messaging + payments + settings. Unified surface, three tabs.

const THREADS = [
  {
    id: 't1', who: 'Alia @ Khaadi', role: 'Brand', campaign: 'Monsoon soft-launch',
    last: 'The cut with the rain sequence — we love it. Approved to go live Thursday.',
    when: '32m', unread: 2, avatar: 'K',
  },
  {
    id: 't2', who: 'Zara — your manager', role: 'Alamut', campaign: '—',
    last: 'Daraz wants to extend into Q4. I\u2019m holding until you\u2019ve had a breather from the shoot.',
    when: '2h', unread: 0, avatar: 'Z',
  },
  {
    id: 't3', who: 'Habibi Coffee Roasters', role: 'Brand', campaign: 'Eid 2026 gift box',
    last: 'Final invoice received. Sending payment tomorrow via Alamut.',
    when: '1d', unread: 0, avatar: 'H',
  },
  {
    id: 't4', who: 'Generation Apparel', role: 'Brand', campaign: 'Heritage capsule',
    last: 'Shoot week confirmed — 18–22 July. Location pack attached.',
    when: '2d', unread: 1, avatar: 'G',
  },
];

const MESSAGES = [
  { id: 1, from: 'them', text: 'Hi Ayaan — caught the rain sequence cut earlier. Gorgeous.', when: '10:02 AM' },
  { id: 2, from: 'them', text: 'Brief question — can we tighten the opening by about 4 seconds? Social team wants a harder hook.', when: '10:03 AM' },
  { id: 3, from: 'me', text: 'Sure. I\u2019ll send a v2 by end of day. The 4 seconds come from the establishing shot?', when: '10:18 AM' },
  { id: 4, from: 'them', text: 'Exactly. Thank you 🙏', when: '10:21 AM' },
  { id: 5, from: 'them', text: 'The cut with the rain sequence — we love it. Approved to go live Thursday.', when: '11:30 AM' },
];

const PAYMENTS = [
  { id: 'PAY-0214', campaign: 'Monsoon soft-launch', brand: 'Khaadi', amount: 3200, status: 'Scheduled', date: 'Jul 06, 2026', currency: 'USD' },
  { id: 'PAY-0213', campaign: 'Heritage capsule', brand: 'Generation Apparel', amount: 5600, status: 'In escrow', date: 'Aug 10, 2026', currency: 'USD' },
  { id: 'PAY-0198', campaign: 'Eid gift box', brand: 'Habibi Coffee', amount: 1800, status: 'Paid', date: 'May 16, 2026', currency: 'USD' },
  { id: 'PAY-0176', campaign: 'Breakfast Table', brand: 'Tapal Tea', amount: 9400, status: 'Paid', date: 'Jul 11, 2025', currency: 'USD' },
  { id: 'PAY-0155', campaign: 'Home & Living 90', brand: 'Daraz', amount: 12800, status: 'Paid', date: 'Dec 20, 2025', currency: 'USD' },
];

function MessagingTab() {
  const [active, setActive] = React.useState(THREADS[0].id);
  const thread = THREADS.find((t) => t.id === active);
  const [draft, setDraft] = React.useState('');
  return (
    <div className="st-msg">
      <aside className="st-msg-list">
        <div className="st-msg-list-head">
          <Label>Inbox · {THREADS.length}</Label>
        </div>
        {THREADS.map((t) => (
          <button key={t.id} onClick={() => setActive(t.id)}
            className={'st-thread' + (active === t.id ? ' is-active' : '')}>
            <div className="st-thread-av">{t.avatar}</div>
            <div className="st-thread-body">
              <div className="st-thread-head">
                <span className="st-thread-who">{t.who}</span>
                <span className="st-thread-when">{t.when}</span>
              </div>
              <div className="st-thread-sub">
                <span>{t.role}</span>{t.campaign !== '—' && <><Icon.dot />{t.campaign}</>}
              </div>
              <div className="st-thread-last">{t.last}</div>
            </div>
            {t.unread > 0 && <span className="st-thread-unread">{t.unread}</span>}
          </button>
        ))}
      </aside>
      <section className="st-msg-pane">
        <header className="st-msg-pane-head">
          <div>
            <div className="st-msg-pane-who">{thread.who}</div>
            <div className="st-msg-pane-sub">{thread.role} · {thread.campaign}</div>
          </div>
          <div className="st-msg-pane-actions">
            <Btn variant="ghost" size="sm">View campaign</Btn>
          </div>
        </header>
        <Rule style={{ margin: 0 }} />
        <div className="st-msg-scroll">
          {MESSAGES.map((m) => (
            <div key={m.id} className={'st-bubble st-bubble-' + m.from}>
              <div className="st-bubble-text">{m.text}</div>
              <div className="st-bubble-when">{m.when}</div>
            </div>
          ))}
        </div>
        <div className="st-msg-compose">
          <textarea placeholder="Write a reply. Zara (your manager) can see this thread."
            value={draft} onChange={(e) => setDraft(e.target.value)} />
          <Btn variant="solid" size="sm" icon={<Icon.arrow s={14} />}>Send</Btn>
        </div>
      </section>
    </div>
  );
}

function PaymentsTab() {
  const total = PAYMENTS.reduce((a, b) => a + b.amount, 0);
  const scheduled = PAYMENTS.filter((p) => p.status === 'Scheduled' || p.status === 'In escrow').reduce((a, b) => a + b.amount, 0);
  const paid = PAYMENTS.filter((p) => p.status === 'Paid').reduce((a, b) => a + b.amount, 0);
  return (
    <div className="st-pay">
      <div className="st-pay-kpis">
        <KPI label="Lifetime earnings" value={'$' + (total / 1000).toFixed(1)} unit="K" />
        <KPI label="In escrow / scheduled" value={'$' + (scheduled / 1000).toFixed(1)} unit="K" />
        <KPI label="Paid out" value={'$' + (paid / 1000).toFixed(1)} unit="K" />
        <KPI label="Your take-home rate" value="85" unit="%" />
      </div>
      <div className="st-pay-table-wrap">
        <table className="st-pay-table">
          <thead>
            <tr>
              <th>Ref</th><th>Campaign</th><th>Brand</th>
              <th>Status</th><th>Date</th><th style={{ textAlign: 'right' }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {PAYMENTS.map((p) => (
              <tr key={p.id}>
                <td>{p.id}</td>
                <td className="st-pay-campaign">{p.campaign}</td>
                <td>{p.brand}</td>
                <td><span className={'st-pay-status st-pay-' + p.status.toLowerCase().replace(/\s+/g, '-')}>{p.status}</span></td>
                <td>{p.date}</td>
                <td className="st-pay-amt">${p.amount.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="st-pay-notes">
        <Label num="NOTES">How payments work</Label>
        <ul>
          <li>Brands fund Alamut escrow before a campaign goes live — you're already covered.</li>
          <li>Payment is released 14 days after final content is posted.</li>
          <li>Alamut fee is 15% of campaign value. Payment processor fees (≈1.5%) are paid by Alamut, not you.</li>
          <li>International payouts settle to PKR within 2 business days. USD and AED accounts supported.</li>
        </ul>
      </div>
    </div>
  );
}

function SettingsTab() {
  const [notif, setNotif] = React.useState({ briefs: true, payments: true, press: false, manager: true });
  const [pay, setPay] = React.useState('bank');
  return (
    <div className="st-set">
      <div className="st-set-section">
        <div className="st-set-head">
          <Label num="A">Profile</Label>
          <p>How you appear to brands.</p>
        </div>
        <div className="st-set-body">
          <div className="b-field">
            <label className="b-field-label">Display name</label>
            <input defaultValue="Ayaan Patel" />
          </div>
          <div className="b-field">
            <label className="b-field-label">Handle</label>
            <input defaultValue="@ayaankitchen" />
          </div>
          <div className="b-field" style={{ gridColumn: 'span 2' }}>
            <label className="b-field-label">One-line bio</label>
            <input defaultValue="Modern South Asian cooking, at home." />
          </div>
          <div className="b-field" style={{ gridColumn: 'span 2' }}>
            <label className="b-field-label">Public bio</label>
            <textarea rows={4} defaultValue="Self-taught cook and recipe developer. Cookbook with Bloomsbury due 2026." />
          </div>
        </div>
      </div>
      <Rule />
      <div className="st-set-section">
        <div className="st-set-head">
          <Label num="B">Notifications</Label>
          <p>What lands in your inbox — Zara filters the rest.</p>
        </div>
        <div className="st-set-toggles">
          {[
            ['briefs', 'New briefs', 'When a brand invites you to a campaign.'],
            ['payments', 'Payments', 'Escrow holds, scheduled payouts, and deposits.'],
            ['press', 'Press mentions', 'When Alamut\u2019s team spots you in an article.'],
            ['manager', 'Manager updates', 'Zara\u2019s weekly note and ad-hoc messages.'],
          ].map(([k, t, d]) => (
            <label key={k} className="st-toggle">
              <input type="checkbox" checked={notif[k]} onChange={(e) => setNotif({ ...notif, [k]: e.target.checked })} />
              <div>
                <div className="st-toggle-t">{t}</div>
                <div className="st-toggle-d">{d}</div>
              </div>
              <div className={'st-toggle-sw' + (notif[k] ? ' is-on' : '')}><span /></div>
            </label>
          ))}
        </div>
      </div>
      <Rule />
      <div className="st-set-section">
        <div className="st-set-head">
          <Label num="C">Payout method</Label>
          <p>Where the 85% lands.</p>
        </div>
        <div className="st-set-payout">
          {[
            ['bank', 'Local bank', 'PKR settlement · 2 business days'],
            ['wise', 'Wise', 'Multi-currency · 1 business day'],
            ['usd', 'USD wire', 'SWIFT · 3–5 business days'],
          ].map(([k, t, d]) => (
            <label key={k} className={'st-payout' + (pay === k ? ' is-on' : '')}>
              <input type="radio" name="payout" checked={pay === k} onChange={() => setPay(k)} />
              <div>
                <div className="st-payout-t">{t}</div>
                <div className="st-payout-d">{d}</div>
              </div>
              {pay === k && <Icon.check s={16} />}
            </label>
          ))}
        </div>
      </div>
      <Rule />
      <div className="st-set-section">
        <div className="st-set-head">
          <Label num="D">Manager</Label>
          <p>Your point of contact at Alamut.</p>
        </div>
        <div className="st-set-manager">
          <div className="st-set-manager-av">Z</div>
          <div>
            <div className="st-set-manager-n">Zara Ahsan</div>
            <div className="st-set-manager-r">Senior creator manager, Food &amp; Lifestyle</div>
            <div className="st-set-manager-c">zara@alamut.co · +92 21 3456 7890</div>
          </div>
          <Btn variant="ghost" size="sm">Request a change</Btn>
        </div>
      </div>
    </div>
  );
}

function StudioScreen() {
  const [tab, setTab] = React.useState(() => localStorage.getItem('alamut.studio-tab') || 'msg');
  React.useEffect(() => { localStorage.setItem('alamut.studio-tab', tab); }, [tab]);
  return (
    <div className="a-studio">
      <section className="st-head">
        <Label num="STUDIO">Signed in as Ayaan Patel</Label>
        <h1 className="a-display" style={{ marginTop: 28 }}>
          Your <em>studio.</em>
        </h1>
        <p className="a-lede">Messaging, payments, and settings — one place for everything that isn't making the work.</p>
        <nav className="st-tabs">
          {[['msg', 'Messages'], ['pay', 'Payments'], ['set', 'Settings']].map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)} className={tab === k ? 'is-on' : ''}>{l}</button>
          ))}
        </nav>
      </section>
      <Rule style={{ maxWidth: 1440, margin: '0 auto 48px', padding: '0 48px' }} />
      <section className="st-body">
        {tab === 'msg' && <MessagingTab />}
        {tab === 'pay' && <PaymentsTab />}
        {tab === 'set' && <SettingsTab />}
      </section>
    </div>
  );
}

Object.assign(window, { StudioScreen });
