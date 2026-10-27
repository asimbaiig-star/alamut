// tools.tsx — the interactive pieces of each page, drawn as the portal's
// own screens so the visitor meets the product before signing up.
//
// Options come from the product's lists (facts.ts → marketplaceOptions.ts,
// brandPalette.ts) and money from its maths (estimate.ts → money.ts): type a
// rate and you see what the ledger would record.

import { useId, useState } from 'react';
import { Credits, PhotoImg } from './components';
import { brandEstimate, clampMoney, creatorEstimate, usd } from './estimate';
import { brandAccent, CREATOR_CATEGORIES, PLATFORM_FEE_LABEL, PLATFORM_FORMATS, WHT_LABEL } from './facts';
import { BRIEFS, BRIEF_FILTERS, CREATORS, CREATOR_FILTERS, type BriefListing } from './listings';
import { PHOTOS } from './photos';

const toMoney = (raw: string) => clampMoney(Number(raw.replace(/[^\d]/g, '')) || 0);
const moneyText = (n: number) => (n === 0 ? '' : n.toLocaleString('en-US'));
const keep = (rate: number) => usd(creatorEstimate(rate, 1).net);

function MoneyInput({ label, value, onChange, className = 'lx-field-label' }: {
  label: string; value: number; onChange: (n: number) => void; className?: string;
}) {
  const id = useId();
  return (
    <label className={className} htmlFor={id}>
      <span>{label}</span>
      <span className="lx-money-input">
        <b aria-hidden="true">$</b>
        <input id={id} type="text" inputMode="numeric" autoComplete="off" placeholder="0"
          value={moneyText(value)} onChange={(e) => onChange(toMoney(e.target.value))} />
      </span>
    </label>
  );
}

function Stepper({ label, value, min, max, onChange, unit }: {
  label: string; value: number; min: number; max: number; onChange: (n: number) => void; unit: string;
}) {
  const id = useId();
  return (
    <div className="lx-stepper" role="group" aria-labelledby={id}>
      <span id={id} className="lx-sr">{label}</span>
      <button type="button" onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min} aria-label={`Fewer ${unit}`}>−</button>
      <output aria-live="polite">{value}</output>
      <button type="button" onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max} aria-label={`More ${unit}`}>+</button>
    </div>
  );
}

function Chips<T extends string>({ label, options, value, onChange }: {
  label: string; options: readonly T[]; value: T; onChange: (v: T) => void;
}) {
  return (
    <div className="lx-chips" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o} type="button" className="lx-chip" aria-pressed={o === value} onClick={() => onChange(o)}>{o}</button>
      ))}
    </div>
  );
}

// ── Creators' first screen: open briefs, as Browse campaigns shows them ──

function CampaignTile({ brief }: { brief: BriefListing }) {
  const band = brandAccent(brief.brand);
  return (
    <article className="lx-card lx-tile">
      <div className="lx-tile-band" style={{ background: band.bg, color: band.ink }}>
        <span className="lx-tile-initial" aria-hidden="true">{brief.title[0]}</span>
        <span className="lx-tile-brand">{brief.brand}</span>
        <span className="lx-tile-cat">{brief.category}</span>
      </div>
      <div className="lx-tile-body">
        <h3 className="lx-tile-title">{brief.title}</h3>
        <p className="lx-tile-blurb">{brief.blurb}</p>
      </div>
      <div className="lx-tile-cols">
        <div><span className="lx-label">Per creator</span><span className="lx-money lx-tile-price">{usd(brief.perCreator)}</span></div>
        <div><span className="lx-label">Deliverables</span><ul className="lx-tile-list">{brief.deliverables.map((d) => <li key={d}>{d}</li>)}</ul></div>
        <div><span className="lx-label">Deadline</span><span className="lx-money lx-tile-price">{brief.deadlineDays}<small> d</small></span></div>
      </div>
      <div className="lx-tile-foot"><span>Example brief</span><span className="lx-pill">Open to pitches</span></div>
    </article>
  );
}

export function BriefBoard() {
  const [cat, setCat] = useState<(typeof BRIEF_FILTERS)[number]>('All');
  const shown = BRIEFS.filter((b) => cat === 'All' || b.category === cat).slice(0, 3);
  return (
    <div className="lx-board" aria-label="Example open briefs">
      <div className="lx-board-head">
        <h2 className="lx-board-title">Open briefs</h2>
        <Chips label="Filter briefs by category" options={BRIEF_FILTERS} value={cat} onChange={setCat} />
      </div>
      <div className="lx-board-grid" aria-live="polite">
        {shown.map((b) => <CampaignTile key={b.title} brief={b} />)}
      </div>
      <p className="lx-board-note">
        Example briefs, drawn as the app shows them. In the app you search open briefs by brand, category or platform,
        filter by budget, and save the ones you want.
      </p>
    </div>
  );
}

// ── Brands' first screen: creator storefronts, as Discover shows them ───

export function CreatorBoard() {
  const [platform, setPlatform] = useState<(typeof CREATOR_FILTERS)[number]>('All');
  const shown = CREATORS.filter((c) => platform === 'All' || c.channels.some((ch) => ch.platform === platform)).slice(0, 3);
  return (
    <div className="lx-board" aria-label="Example creator storefronts">
      <div className="lx-board-head">
        <h2 className="lx-board-title">Creators</h2>
        <Chips label="Filter creators by platform" options={CREATOR_FILTERS} value={platform} onChange={setPlatform} />
      </div>
      <div className="lx-board-grid" aria-live="polite">
        {shown.map((c) => (
          <article key={c.niche} className="lx-card lx-ccard">
            <div className="lx-ccard-cover"><PhotoImg photo={c.photo} width={400} ratio={400 / 96} sizes="(min-width: 1100px) 380px, (min-width: 760px) 50vw, 100vw" /></div>
            <div className="lx-ccard-body">
              <span className="lx-ccard-avatar" aria-hidden="true">{c.niche[0]}</span>
              <h3 className="lx-ccard-name">{c.niche}</h3>
              <div className="lx-ccard-channels">
                {c.channels.map((ch) => <span key={ch.platform}>{ch.platform} <b>{ch.followers}</b></span>)}
                <span className="lx-ccard-er">{c.engagement}% ER</span>
              </div>
              <span className="lx-pill">{c.category}</span>
            </div>
            <div className="lx-ccard-foot">
              <span className="lx-note">Example storefront</span>
              <span><span className="lx-label">From </span><span className="lx-money lx-ccard-from">{usd(c.from)}</span></span>
            </div>
          </article>
        ))}
      </div>
      <p className="lx-board-note">
        Example storefronts, drawn as the app shows them. In the app you filter creators by platform, category,
        followers, city and price. Follower counts are what creators enter. <Credits photos={CREATORS.map((c) => c.photo)} />
      </p>
    </div>
  );
}

// ── Creators: pitch a brief (BriefDetail's apply form) ──────────────────

export function ApplyPreview() {
  const brief = BRIEFS[0]!;
  const [pitch, setPitch] = useState('Two Reels built around my morning routine, filmed at home in natural light.');
  const [rate, setRate] = useState(1600);
  const pitchId = useId();
  return (
    <div className="lx-pitch">
      <article className="lx-card lx-pane" aria-label="Example brief">
        <span className="lx-label">{brief.brand} · {brief.category}</span>
        <h3 className="lx-pane-title">{brief.title}</h3>
        <p className="lx-body">{brief.blurb}</p>
        <div className="lx-kv">
          <div><span>Deliverables</span><b>{brief.deliverables.join(', ')}</b></div>
          <div><span>Target rate</span><b>{usd(brief.perCreator)} per creator</b></div>
          <div><span>Deadline</span><b>{brief.deadlineDays} days</b></div>
        </div>
        <span className="lx-note">Example brief</span>
      </article>
      <form className="lx-card lx-pane" aria-label="Apply with a pitch" onSubmit={(e) => e.preventDefault()}>
        <h3 className="lx-h3">Apply with a pitch</h3>
        <label className="lx-field-label" htmlFor={pitchId}>
          <span>Your pitch</span>
          <textarea id={pitchId} className="lx-textarea" value={pitch} maxLength={400} onChange={(e) => setPitch(e.target.value)} />
        </label>
        <MoneyInput label="Your rate for the deal" value={rate} onChange={setRate} />
        <p className="lx-note">
          You keep <b className="tnum">{usd(creatorEstimate(rate, 1).net)}</b> after the {PLATFORM_FEE_LABEL} platform fee and {WHT_LABEL} withholding.
        </p>
        <span className="lx-preview-btn" aria-hidden="true">Send application</span>
      </form>
    </div>
  );
}

// ── Creators: the storefront brands see ─────────────────────────────────

/** What the product would accept as a handle, near enough for a preview. */
export function toHandle(name: string): string {
  return name.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9._]/g, '').slice(0, 24);
}

function initials(name: string): string {
  return name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join('');
}

const PACKAGES = [
  { key: 'reel', label: 'Instagram Reel' },
  { key: 'post', label: 'Feed post' },
  { key: 'story', label: 'Story' },
] as const;
type PackageKey = (typeof PACKAGES)[number]['key'];
const WORK = [PHOTOS.makeupTable, PHOTOS.kitchenShoot, PHOTOS.phoneOnTripod];

export function StorefrontBuilder() {
  const [name, setName] = useState('');
  const [handle, setHandle] = useState<string | null>(null);
  const [niche, setNiche] = useState('Beauty');
  const [rates, setRates] = useState<Record<PackageKey, number>>({ reel: 900, post: 600, story: 250 });
  // Until the visitor types a handle, it follows the name, as sign-up does.
  const shownHandle = handle ?? toHandle(name);
  const first = name.trim().split(/\s+/)[0];
  return (
    <div className="lx-card" aria-label="Your storefront, as a brand sees it">
      <div className="lx-sf-cover"><PhotoImg photo={PHOTOS.ringLight} width={720} ratio={720 / 132} sizes="(min-width: 1000px) 700px, 100vw" /></div>
      <div className="lx-sf-head">
        <span className="lx-sf-portrait" aria-hidden="true">{initials(name) || '+'}</span>
        <input className="lx-sf-name" aria-label="Your name" placeholder="Your name" value={name} maxLength={40}
          autoComplete="off" spellCheck={false} onChange={(e) => setName(e.target.value)} />
        <div className="lx-sf-meta">
          <span>@<input aria-label="Your handle" placeholder="yourhandle" value={shownHandle} maxLength={24}
            autoComplete="off" spellCheck={false} onChange={(e) => setHandle(toHandle(e.target.value))} /></span>
          <select aria-label="Your niche" value={niche} onChange={(e) => setNiche(e.target.value)}>
            {CREATOR_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <span className="lx-pill accent">{niche}</span>
        </div>
        <span className="lx-preview-btn" aria-hidden="true">{first ? `Brief ${first} on Alamut` : 'Send a brief'} →</span>
      </div>
      <div className="lx-sf-section">
        <span className="lx-label">Recent work</span>
        <div className="lx-sf-work">
          {WORK.map((p) => <figure key={p.id}><PhotoImg photo={p} width={240} ratio={1} sizes="200px" /></figure>)}
        </div>
      </div>
      <div className="lx-sf-section">
        <span className="lx-label">Packages and rates</span>
        <div className="lx-rates">
          {PACKAGES.map((p) => (
            <label key={p.key} className="lx-rate">
              <span className="lx-rate-name">{p.label}</span>
              <span className="lx-rate-price">
                <b aria-hidden="true">$</b>
                <input type="text" inputMode="numeric" autoComplete="off" placeholder="0" aria-label={`${p.label} rate, US dollars`}
                  value={moneyText(rates[p.key])} onChange={(e) => setRates((r) => ({ ...r, [p.key]: toMoney(e.target.value) }))} />
              </span>
              <span className="lx-rate-keep">you keep <b>{keep(rates[p.key])}</b></span>
            </label>
          ))}
        </div>
      </div>
      <div className="lx-sf-section">
        <p className="lx-note">
          <span className="tnum">/c/{shownHandle || 'yourhandle'}</span> · “You keep” is after the {PLATFORM_FEE_LABEL} platform
          fee and {WHT_LABEL} withholding. <Credits photos={[PHOTOS.ringLight, ...WORK]} />
        </p>
      </div>
    </div>
  );
}

// ── Brands: write the brief (NewCampaignWizard's fields) ────────────────

export function BriefBuilder() {
  const [title, setTitle] = useState('');
  const [platform, setPlatform] = useState('instagram');
  const [format, setFormat] = useState('reel');
  const [count, setCount] = useState(2);
  const [rate, setRate] = useState(1500);
  const p = PLATFORM_FORMATS.find((x) => x.value === platform) ?? PLATFORM_FORMATS[0]!;
  const f = p.formats.find((x) => x.value === format) ?? p.formats[0]!;
  return (
    <div className="lx-card lx-brief" aria-label="Your brief, as a creator sees it">
      <span className="lx-label">New brief</span>
      <input className="lx-brief-title" aria-label="Campaign name" placeholder="Name your campaign" value={title} maxLength={60}
        autoComplete="off" onChange={(e) => setTitle(e.target.value)} />
      <div className="lx-field-label" role="group" aria-label="Deliverables">
        <span>Deliverables</span>
        <div className="lx-controls">
          <Stepper label="How many" value={count} min={1} max={10} onChange={setCount} unit="deliverables" />
          <select className="lx-select" aria-label="Platform" value={platform}
            onChange={(e) => {
              const next = PLATFORM_FORMATS.find((x) => x.value === e.target.value) ?? PLATFORM_FORMATS[0]!;
              setPlatform(next.value);
              setFormat(next.formats[0]!.value);
            }}>
            {PLATFORM_FORMATS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <select className="lx-select" aria-label="Format" value={f.value} onChange={(e) => setFormat(e.target.value)}>
            {p.formats.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </div>
      <MoneyInput label="Target rate per creator" value={rate} onChange={setRate} />
      <div className="lx-kv">
        <div><span>Creators will see</span><b>{count} × {p.label} {f.label}</b></div>
      </div>
      <span className="lx-preview-btn" aria-hidden="true">Publish brief</span>
    </div>
  );
}

// ── Payment: the portal's moss wallet card, as a calculator ─────────────

function WalletLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="lx-wallet-line">
      <span>{label}</span><span className="lx-leader" aria-hidden="true" /><b>{value}</b>
    </div>
  );
}

export function PayoutTool() {
  const [rate, setRate] = useState(1800);
  const [posts, setPosts] = useState(2);
  const e = creatorEstimate(rate, posts);
  return (
    <div className="lx-wallet" aria-label="What you would receive">
      <div className="lx-wallet-main">
        <span className="lx-label">Reaches your wallet</span>
        <div><span className="lx-money lx-wallet-big" aria-live="polite">{usd(e.net)}</span></div>
        <p className="lx-wallet-sub">from a {usd(e.held)} deal over {posts} {posts === 1 ? 'post' : 'posts'}, held in escrow from the day the brand accepts.</p>
        <div className="lx-wallet-inputs">
          <MoneyInput className="lx-wallet-field" label="Your rate for the deal" value={rate} onChange={setRate} />
          <div className="lx-wallet-field"><span>Posts</span><Stepper label="Posts" value={posts} min={1} max={10} onChange={setPosts} unit="posts" /></div>
        </div>
      </div>
      <div className="lx-wallet-side">
        <span className="lx-label">Ledger</span>
        <WalletLine label="Held when the brand accepts" value={usd(e.held)} />
        {e.releases.map((amt, i) => (
          <WalletLine key={i} label={e.releases.length > 1 ? `Post ${i + 1} live, released` : 'Post live, released'} value={usd(amt)} />
        ))}
        <WalletLine label={`Platform fee (${PLATFORM_FEE_LABEL})`} value={`−${usd(e.fee)}`} />
        <WalletLine label={`Withholding (${WHT_LABEL})`} value={`−${usd(e.tax)}`} />
      </div>
    </div>
  );
}

export function HoldTool() {
  const [rate, setRate] = useState(1500);
  const [creators, setCreators] = useState(3);
  const [posts, setPosts] = useState(1);
  const e = brandEstimate(rate, creators, posts);
  const perPost = e.perPost[0] ?? 0;
  const uneven = e.perPost.some((p) => p !== perPost);
  return (
    <div className="lx-wallet" aria-label="What a brief holds and releases">
      <div className="lx-wallet-main">
        <span className="lx-label">You pay in total</span>
        <div><span className="lx-money lx-wallet-big" aria-live="polite">{usd(e.held)}</span></div>
        <p className="lx-wallet-sub">held in escrow as offers are accepted, and released post by post as you confirm each one is live.</p>
        <div className="lx-wallet-inputs">
          <MoneyInput className="lx-wallet-field" label="Rate per creator" value={rate} onChange={setRate} />
          <div className="lx-wallet-field"><span>Creators</span><Stepper label="Creators" value={creators} min={1} max={50} onChange={setCreators} unit="creators" /></div>
          <div className="lx-wallet-field"><span>Posts each</span><Stepper label="Posts each" value={posts} min={1} max={10} onChange={setPosts} unit="posts" /></div>
        </div>
      </div>
      <div className="lx-wallet-side">
        <span className="lx-label">Ledger</span>
        <WalletLine label="Held as offers are accepted" value={usd(e.held)} />
        <WalletLine label="Released per confirmed post" value={uneven ? `${usd(perPost)}–${usd(Math.max(...e.perPost))}` : usd(perPost)} />
        <WalletLine label="Platform fee charged to you" value={usd(e.brandFee)} />
        <WalletLine label="Each creator receives, after fees" value={usd(e.perCreatorNet)} />
      </div>
    </div>
  );
}
