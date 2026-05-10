// Creator dashboard — the post-login view for a creator on the Alamut roster.
// Editorial layout: top stat strip, active campaigns, open invites, payouts, profile health.

const CREATOR_SELF = {
  name: 'Ayesha Khan',
  handle: 'ayeshakhanstudio',
  tagline: 'Karachi-based documentary filmmaker. I make food & family portraits.',
  city: 'Karachi, Pakistan',
  portrait: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=600&h=800&fit=crop',
  signedOn: 'Mar 2024',
  manager: { name: 'Zoya N.', role: 'Talent Manager', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&h=200&fit=crop' },
};

const ACTIVE = [
  {
    id: 'cp-001',
    brand: 'Habibi Coffee Roasters',
    campaign: 'Eid 2026 gift-box launch',
    deliverables: '1 Reel · 1 feed post · 3 stories',
    value: 1800,
    deadline: 'May 14',
    status: 'In production',
    statusPct: 65,
    cover: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=600&h=400&fit=crop',
  },
  {
    id: 'cp-002',
    brand: 'Generation Apparel',
    campaign: 'Heritage capsule — Lahore edit',
    deliverables: '2 Reels · 1 long-form video',
    value: 3400,
    deadline: 'Jun 01',
    status: 'Awaiting approval',
    statusPct: 90,
    cover: 'https://images.unsplash.com/photo-1558769132-cb1aea458c5e?w=600&h=400&fit=crop',
  },
  {
    id: 'cp-003',
    brand: 'Khaadi',
    campaign: 'Monsoon soft-launch',
    deliverables: '1 Reel · Newsletter feature',
    value: 2200,
    deadline: 'Jun 21',
    status: 'Contract signed',
    statusPct: 20,
    cover: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?w=600&h=400&fit=crop',
  },
];

const INVITES = [
  { id: 'inv-1', brand: 'Koel Cafe', fit: 92, deliverables: 'Reel + stories', value: '1,200–1,800', expires: '3 days', note: 'Their Karachi location — food & design focus. Aligns with your recent studio work.' },
  { id: 'inv-2', brand: 'Sapphire', fit: 78, deliverables: '2 feed posts', value: '1,500', expires: '5 days', note: 'Formalwear capsule. Shot list will be provided.' },
  { id: 'inv-3', brand: 'The Pantry Karachi', fit: 85, deliverables: 'Long-form YouTube', value: '2,400', expires: '1 week', note: 'Documentary-style piece — exactly your register.' },
];

const PAYOUTS = [
  { id: 'p-001', campaign: 'Café Aylanto — Ramadan iftar series', amount: 2800, status: 'Paid', date: 'Apr 12, 2026' },
  { id: 'p-002', campaign: 'Elan — Spring/Summer capsule', amount: 4200, status: 'Paid', date: 'Mar 28, 2026' },
  { id: 'p-003', campaign: 'Dawn Media — Long-form feature', amount: 1650, status: 'Processing', date: 'Apr 18, 2026' },
  { id: 'p-004', campaign: 'Habibi Coffee — Gift-box launch', amount: 1800, status: 'Pending', date: 'Due May 28' },
];

function DashStat({ k, v, hint, accent }) {
  return (
    <div className="d-stat">
      <div className="d-stat-k">{k}</div>
      <div className="d-stat-v" style={accent ? { color: 'var(--accent)' } : undefined}>{v}</div>
      {hint && <div className="d-stat-h">{hint}</div>}
    </div>
  );
}

function DashCampaignCard({ c }) {
  return (
    <article className="d-camp">
      <div className="d-camp-img">
        <img src={c.cover} alt="" />
        <div className="d-camp-img-tag">{c.status}</div>
      </div>
      <div className="d-camp-body">
        <div className="d-camp-meta">
          <span>{c.brand}</span>
          <Icon.dot />
          <span>Due {c.deadline}</span>
        </div>
        <h3 className="d-camp-title">{c.campaign}</h3>
        <div className="d-camp-delivs">{c.deliverables}</div>
        <div className="d-camp-progress">
          <div className="d-camp-progress-track">
            <div className="d-camp-progress-fill" style={{ width: c.statusPct + '%' }} />
          </div>
          <div className="d-camp-progress-val">{c.statusPct}%</div>
        </div>
        <div className="d-camp-foot">
          <div>
            <div className="d-camp-k">Your cut</div>
            <div className="d-camp-v">${c.value.toLocaleString()}</div>
          </div>
          <Btn variant="ghost" size="sm" icon={<Icon.arrow s={13} />}>Open</Btn>
        </div>
      </div>
    </article>
  );
}

function DashInviteRow({ inv }) {
  return (
    <div className="d-inv">
      <div className="d-inv-brand">
        <div className="d-inv-fit">
          <div className="d-inv-fit-num">{inv.fit}</div>
          <div className="d-inv-fit-k">fit</div>
        </div>
        <div>
          <div className="d-inv-name">{inv.brand}</div>
          <div className="d-inv-note">{inv.note}</div>
        </div>
      </div>
      <div className="d-inv-meta">
        <div>
          <div className="d-inv-k">Deliverables</div>
          <div className="d-inv-val">{inv.deliverables}</div>
        </div>
        <div>
          <div className="d-inv-k">Value</div>
          <div className="d-inv-val">${inv.value}</div>
        </div>
        <div>
          <div className="d-inv-k">Expires</div>
          <div className="d-inv-val">{inv.expires}</div>
        </div>
      </div>
      <div className="d-inv-actions">
        <Btn variant="solid" size="sm">Accept</Btn>
        <button className="d-inv-decline">Decline</button>
      </div>
    </div>
  );
}

function DashPayoutRow({ p }) {
  return (
    <tr>
      <td className="d-pay-camp">{p.campaign}</td>
      <td className="d-pay-amt">${p.amount.toLocaleString()}</td>
      <td>
        <span className={'d-pay-status d-pay-' + p.status.toLowerCase()}>{p.status}</span>
      </td>
      <td className="d-pay-date">{p.date}</td>
    </tr>
  );
}

function CreatorDashboard({ onHome, onRoster }) {
  const totalThisYear = PAYOUTS.filter((p) => p.status === 'Paid').reduce((s, p) => s + p.amount, 0);
  const upcoming = ACTIVE.reduce((s, c) => s + c.value, 0);

  return (
    <div className="d-screen">
      {/* Hero */}
      <section className="d-hero">
        <div className="d-hero-grid">
          <div className="d-hero-left">
            <Label num="STUDIO">Creator dashboard · Spring 2026</Label>
            <h1 className="d-hero-h">
              Good morning,<br/>
              <em>{CREATOR_SELF.name.split(' ')[0]}.</em>
            </h1>
            <p className="d-hero-lede">
              {ACTIVE.length} campaigns in flight, {INVITES.length} new invites on your desk.
              Here's the shape of your week.
            </p>
            <div className="d-hero-actions">
              <Btn variant="solid" icon={<Icon.arrow s={14} />}>Message Zoya</Btn>
              <Btn variant="ghost">Update your profile</Btn>
            </div>
          </div>
          <aside className="d-hero-right">
            <div className="d-hero-manager">
              <img src={CREATOR_SELF.manager.avatar} alt="" />
              <div>
                <div className="d-hero-manager-k">Your manager</div>
                <div className="d-hero-manager-n">{CREATOR_SELF.manager.name}</div>
                <div className="d-hero-manager-r">{CREATOR_SELF.manager.role}</div>
              </div>
            </div>
            <Rule />
            <div className="d-hero-facts">
              <div><span className="d-hero-fact-k">Signed</span><span className="d-hero-fact-v">{CREATOR_SELF.signedOn}</span></div>
              <div><span className="d-hero-fact-k">Roster tier</span><span className="d-hero-fact-v">Rising</span></div>
              <div><span className="d-hero-fact-k">City</span><span className="d-hero-fact-v">{CREATOR_SELF.city}</span></div>
            </div>
          </aside>
        </div>
      </section>

      {/* Stat strip */}
      <section className="d-strip">
        <DashStat k="Earned · 2026" v={`$${totalThisYear.toLocaleString()}`} hint="across 4 campaigns" />
        <DashStat k="Upcoming" v={`$${upcoming.toLocaleString()}`} hint="next 8 weeks" accent />
        <DashStat k="Response time" v="2.4h" hint="p50 across DMs" />
        <DashStat k="Acceptance rate" v="73%" hint="of last 15 invites" />
        <DashStat k="Rating" v="4.9/5" hint="from 12 brand reviews" />
      </section>

      {/* Active campaigns */}
      <section className="d-section">
        <div className="d-section-head">
          <Label num="01">Active campaigns</Label>
          <h2 className="d-h2">In flight, in your name.</h2>
        </div>
        <Rule />
        <div className="d-camp-grid">
          {ACTIVE.map((c) => <DashCampaignCard key={c.id} c={c} />)}
        </div>
      </section>

      {/* Invites */}
      <section className="d-section">
        <div className="d-section-head">
          <Label num="02">New invites</Label>
          <h2 className="d-h2">Three brands want <em>you</em>.</h2>
        </div>
        <Rule />
        <div className="d-inv-list">
          {INVITES.map((inv) => <DashInviteRow key={inv.id} inv={inv} />)}
        </div>
      </section>

      {/* Payouts */}
      <section className="d-section">
        <div className="d-section-head">
          <Label num="03">Payouts</Label>
          <h2 className="d-h2">Money in, money promised.</h2>
        </div>
        <Rule />
        <table className="d-pay-table">
          <thead>
            <tr>
              <th>Campaign</th>
              <th style={{ textAlign: 'right' }}>Amount</th>
              <th>Status</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {PAYOUTS.map((p) => <DashPayoutRow key={p.id} p={p} />)}
          </tbody>
        </table>
      </section>

      {/* Health */}
      <section className="d-section">
        <div className="d-section-head">
          <Label num="04">Profile health</Label>
          <h2 className="d-h2">Keep your page fresh.</h2>
        </div>
        <Rule />
        <div className="d-health-grid">
          <div className="d-health-card">
            <div className="d-health-k">Media kit</div>
            <div className="d-health-v">Updated 3 weeks ago</div>
            <Btn variant="ghost" size="sm" icon={<Icon.arrow s={13} />}>Refresh</Btn>
          </div>
          <div className="d-health-card d-health-warn">
            <div className="d-health-k">Work samples</div>
            <div className="d-health-v">2 of 6 slots empty</div>
            <Btn variant="solid" size="sm" icon={<Icon.plus s={13} />}>Add work</Btn>
          </div>
          <div className="d-health-card">
            <div className="d-health-k">Rate card</div>
            <div className="d-health-v">Last reviewed Feb 2026</div>
            <Btn variant="ghost" size="sm" icon={<Icon.arrow s={13} />}>Review</Btn>
          </div>
          <div className="d-health-card">
            <div className="d-health-k">Audience report</div>
            <div className="d-health-v">Auto-updated weekly</div>
            <Btn variant="ghost" size="sm" icon={<Icon.download />}>Download</Btn>
          </div>
        </div>
      </section>

      <footer className="d-foot">
        <Rule />
        <div className="d-foot-row">
          <div>
            <div className="d-foot-k">Need something</div>
            <div className="d-foot-v">Zoya is on WhatsApp · 10am–8pm PKT</div>
          </div>
          <Btn variant="ghost" icon={<Icon.mail />}>Message</Btn>
        </div>
      </footer>
    </div>
  );
}

Object.assign(window, { CreatorDashboard });
