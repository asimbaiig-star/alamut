// Shell — sidebar nav + cover splash + role switcher

function V3Sidebar({ role, setRole, screen, onNavigate, sessionUser }) {
  const nav = role === 'creator' ? CREATOR_NAV : BRAND_NAV;
  const groups = [...new Set(nav.map(n => n.group))];
  const groupLabel = { main: 'Overview', work: 'Work', me: role === 'creator' ? 'Me' : 'Account' };
  return (
    <aside className="v3-side">
      <div className="v3-side-logo">
        <Logo size={20} tag={role === 'creator' ? 'CREATOR · ' + (sessionUser?.handle || '@you').toUpperCase() : 'BRAND · ' + (sessionUser?.brand || 'AESOP').toUpperCase()} />
      </div>

      <div className="v3-role-switch">
        <button className={role === 'creator' ? 'is-on' : ''} onClick={() => setRole('creator')}>Creator</button>
        <button className={role === 'brand' ? 'is-on' : ''} onClick={() => setRole('brand')}>Brand</button>
      </div>

      {groups.map(g => (
        <div className="v3-nav-section" key={g}>
          <div className="v3-nav-section-h">{groupLabel[g]}</div>
          <div className="v3-nav">
            {nav.filter(n => n.group === g).map(n => {
              const I = Ico[n.icon];
              return (
                <button
                  key={n.id}
                  className={'v3-nav-item' + (screen === n.id ? ' is-on' : '')}
                  onClick={() => onNavigate(n.id)}
                >
                  <span className="v3-nav-icon">{I && <I />}</span>
                  <span className="v3-nav-label">{n.label}</span>
                  {n.badge && <span className="v3-nav-badge">{n.badge}</span>}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      <div className="v3-side-foot">
        <div className="v3-side-foot-img">
          {role === 'creator' && sessionUser?.portrait ?
            <img src={sessionUser.portrait} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} /> :
            <span>{(sessionUser?.name || 'You').slice(0,1)}</span>}
        </div>
        <div>
          <div className="v3-side-foot-name">{sessionUser?.name || (role === 'creator' ? 'Sarah Johnson' : 'Aesop')}</div>
          <div className="v3-side-foot-role">{role === 'creator' ? 'Verified creator' : 'Verified brand'}</div>
        </div>
      </div>
    </aside>
  );
}

function V3Cover({ onPickRole }) {
  return (
    <div className="v3-cover">
      <div className="v3-cover-side" onClick={() => onPickRole('creator')}>
        <div>
          <Logo size={18} tag="ALAMUT" />
          <Label num="01" style={{ marginTop: 40 }}>For creators</Label>
          <h1 className="v3-cover-h" style={{ marginTop: 24 }}>
            Build a body of <em>real work</em>, not a follower count.
          </h1>
          <ul className="v3-cover-bullets">
            <li><span className="v3-cover-bullets-num">A · 01</span><span>Apply to live campaigns from vetted brands.</span></li>
            <li><span className="v3-cover-bullets-num">A · 02</span><span>Track deliverables, drafts, and revisions in one place.</span></li>
            <li><span className="v3-cover-bullets-num">A · 03</span><span>Get paid on time, every time — escrow + invoices.</span></li>
            <li><span className="v3-cover-bullets-num">A · 04</span><span>A profile that reads like a portfolio, not a media kit.</span></li>
          </ul>
        </div>
        <div className="v3-cover-foot">
          <div className="v3-cover-small">Sign in or create an account</div>
          <span className="v3-cover-cta">Continue as creator <Icon.arrow s={16} /></span>
        </div>
      </div>

      <div className="v3-cover-side is-brand" onClick={() => onPickRole('brand')}>
        <div>
          <Logo size={18} tag="ALAMUT" />
          <Label num="02" style={{ marginTop: 40 }}>For brands</Label>
          <h1 className="v3-cover-h" style={{ marginTop: 24 }}>
            Run campaigns end-to-end, <em>without</em> the agency markup.
          </h1>
          <ul className="v3-cover-bullets">
            <li><span className="v3-cover-bullets-num">B · 01</span><span>Brief, invite, shortlist — all from one console.</span></li>
            <li><span className="v3-cover-bullets-num">B · 02</span><span>AI-assisted matching with reasoning, not black-box.</span></li>
            <li><span className="v3-cover-bullets-num">B · 03</span><span>Approve drafts and release payouts in two clicks.</span></li>
            <li><span className="v3-cover-bullets-num">B · 04</span><span>Performance reporting baked in.</span></li>
          </ul>
        </div>
        <div className="v3-cover-foot">
          <div className="v3-cover-small">Sign in or create an account</div>
          <span className="v3-cover-cta">Continue as brand <Icon.arrow s={16} /></span>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { V3Sidebar, V3Cover });
