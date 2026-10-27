// tools.tsx — the interactive pieces of each page, drawn as the portal's
// own screens so the visitor does the first thing the product does before
// signing up: pick a brief and price a pitch, pick a creator and a package,
// lay out a storefront, write a brief.
//
// Options come from the product's lists (facts.ts → marketplaceOptions.ts,
// brandPalette.ts) and money from its maths (estimate.ts → money.ts): type a
// rate and you see what the ledger would record. What a visitor builds can
// be kept for sign-up (landingDraft.ts), but only when they ask to.

import { useId, useRef, useState, type CSSProperties } from 'react';
import { Credits, PhotoImg } from './components';
import { brandEstimate, clampMoney, creatorEstimate, usd } from './estimate';
import {
  brandAccent, CREATOR_CATEGORIES, PLATFORM_FEE_LABEL, PLATFORM_FORMATS, SIGNUP_HREF, WHT_LABEL,
} from './facts';
import {
  BRIEFS, BRIEF_FILTERS, CREATORS, CREATOR_FILTERS, fromRate, PACKAGE_LABEL,
  type BriefListing, type CreatorChannel, type CreatorListing,
} from './listings';
import { PHOTOS } from './photos';
import { BRIEF_DRAFT_KEY, saveDraft, STOREFRONT_DRAFT_KEY } from '@/lib/landingDraft';

const toMoney = (raw: string) => clampMoney(Number(raw.replace(/[^\d]/g, '')) || 0);
const moneyText = (n: number) => (n === 0 ? '' : n.toLocaleString('en-US'));
const keep = (rate: number) => usd(creatorEstimate(rate, 1).net);

/** The visitor's own browser storage, when there is one to write. */
const browserStore = () => {
  try { return window.localStorage; } catch { return null; }
};

/** Where the list stacks above the card (phones, tablets), a pick would
 *  change a card the visitor can't see: bring it into view. */
function revealPicked(el: HTMLElement | null) {
  if (!el || typeof window.matchMedia !== 'function' || !window.matchMedia('(max-width: 999px)').matches) return;
  const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  requestAnimationFrame(() => el.scrollIntoView({ behavior: still ? 'auto' : 'smooth', block: 'start' }));
}

// The platform's colour for whatever names it ("2 × Instagram Reel", "TikTok"),
// as the portal colours channel badges.
const PLATFORM_COLOUR: Record<CreatorChannel['platform'], string> = {
  Instagram: 'var(--v2-platform-instagram)',
  TikTok: 'var(--v2-platform-tiktok)',
  YouTube: 'var(--v2-platform-youtube)',
};
function platStyle(text: string): CSSProperties | undefined {
  const p = (Object.keys(PLATFORM_COLOUR) as CreatorChannel['platform'][]).find((k) => text.includes(k));
  return p ? ({ '--plat': PLATFORM_COLOUR[p] } as CSSProperties) : undefined;
}

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

// ── Creators' first screen: Browse campaigns, working ───────────────────
// The list on the left is what Browse campaigns lists; the card on the
// right is the brief a creator opens, with the one thing they'd do there:
// name their rate and see what they keep.

/** The letterhead band of a campaign tile, as BrowseBriefs draws it. */
function Letterhead({ brief }: { brief: BriefListing }) {
  const band = brandAccent(brief.brand);
  return (
    <div className="lx-tile-band" style={{ background: band.bg, color: band.ink }}>
      <span className="lx-tile-initial" aria-hidden="true">{brief.title[0]}</span>
      <span className="lx-tile-brand">{brief.brand}</span>
      <span className="lx-pill lx-pill-band">Example</span>
      <span className="lx-tile-cat">{brief.category}</span>
    </div>
  );
}

export function BriefBrowser() {
  const [cat, setCat] = useState<(typeof BRIEF_FILTERS)[number]>('All');
  const [picked, setPicked] = useState(BRIEFS[0]!.title);
  // null: the visitor hasn't named a rate yet, so the pitch starts at the
  // brief's own target rate.
  const [rate, setRate] = useState<number | null>(null);
  const shown = BRIEFS.filter((b) => cat === 'All' || b.category === cat).slice(0, 4);
  const brief = shown.find((b) => b.title === picked) ?? shown[0]!;
  const myRate = rate ?? brief.perCreator;
  const detail = useRef<HTMLDivElement>(null);
  const pick = (title: string) => { setPicked(title); setRate(null); revealPicked(detail.current); };
  return (
    <div className="lx-browse">
      <div className="lx-browse-list">
        <div className="lx-browse-head">
          <h2 className="lx-board-title">Open briefs</h2>
          <span className="lx-pill lx-pill-dark">Examples</span>
        </div>
        <Chips label="Filter briefs by category" options={BRIEF_FILTERS} value={cat} onChange={(c) => { setCat(c); setRate(null); }} />
        <ul className="lx-picks" aria-label="Example open briefs">
          {shown.map((b) => (
            <li key={b.title}>
              <button type="button" className="lx-pick" aria-pressed={b === brief} onClick={() => pick(b.title)}>
                <span className="lx-pick-mark" aria-hidden="true" style={{ background: brandAccent(b.brand).bg }}>{b.title[0]}</span>
                <span className="lx-pick-text">
                  <span className="lx-pick-title">{b.title}</span>
                  <span className="lx-pick-sub">{b.deliverables.join(', ')}</span>
                </span>
                <span className="lx-money lx-pick-price">{usd(b.perCreator)}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
      <div className="lx-browse-detail" aria-live="polite" ref={detail}>
        <article key={brief.title} className="lx-card lx-tile lx-swap" aria-label={`Example brief: ${brief.title}`}>
          <Letterhead brief={brief} />
          <div className="lx-tile-body">
            <h3 className="lx-tile-title">{brief.title}</h3>
            <p className="lx-tile-blurb">{brief.blurb}</p>
          </div>
          <div className="lx-tile-cols">
            <div><span className="lx-label">Per creator</span><span className="lx-money lx-tile-price">{usd(brief.perCreator)}</span></div>
            <div><span className="lx-label">Deliverables</span><ul className="lx-tile-list">{brief.deliverables.map((d) => <li key={d} className="lx-plat" style={platStyle(d)}>{d}</li>)}</ul></div>
            <div><span className="lx-label">Deadline</span><span className="lx-money lx-tile-price">{brief.deadlineDays}<small> d</small></span></div>
          </div>
          <div className="lx-act">
            <MoneyInput label="Your rate for the deal" value={myRate} onChange={setRate} />
            <p className="lx-act-keep">
              You keep <b className="tnum">{usd(creatorEstimate(myRate, 1).net)}</b> after the {PLATFORM_FEE_LABEL} platform fee
              and {WHT_LABEL} withholding.
            </p>
            <a className="lx-btn accent" href={SIGNUP_HREF.creator} data-cta="hero-pitch">Join free to pitch</a>
          </div>
        </article>
      </div>
      <p className="lx-board-note">
        Example briefs, drawn as Browse campaigns shows them. In the app you search open briefs by brand, category or
        platform, filter by budget, and save the ones you want.
      </p>
    </div>
  );
}

// ── Brands' first screen: Discover, working ─────────────────────────────
// The list is Discover's; the card is the storefront a brand opens, with
// its packages, priced, and what booking one costs the brand.

function Channels({ c }: { c: CreatorListing }) {
  return (
    <div className="lx-ccard-channels">
      {c.channels.map((ch) => <span key={ch.platform} className="lx-plat" style={platStyle(ch.platform)}>{ch.platform} <b>{ch.followers}</b></span>)}
      <span className="lx-ccard-er">{c.engagement}% ER</span>
    </div>
  );
}

export function CreatorBrowser() {
  const [platform, setPlatform] = useState<(typeof CREATOR_FILTERS)[number]>('All');
  const [picked, setPicked] = useState(CREATORS[0]!.niche);
  const [pkg, setPkg] = useState<string | null>(null);
  const groupName = useId();
  const shown = CREATORS.filter((c) => platform === 'All' || c.channels.some((ch) => ch.platform === platform)).slice(0, 4);
  const c = shown.find((x) => x.niche === picked) ?? shown[0]!;
  const chosen = c.packages.find((p) => p.key === pkg) ?? c.packages[0]!;
  const e = brandEstimate(chosen.rate, 1, 1);
  const detail = useRef<HTMLDivElement>(null);
  const pick = (niche: string) => { setPicked(niche); setPkg(null); revealPicked(detail.current); };
  return (
    <div className="lx-browse">
      <div className="lx-browse-list">
        <div className="lx-browse-head">
          <h2 className="lx-board-title">Creators</h2>
          <span className="lx-pill lx-pill-dark">Examples</span>
        </div>
        <Chips label="Filter creators by platform" options={CREATOR_FILTERS} value={platform} onChange={(p) => { setPlatform(p); setPkg(null); }} />
        <ul className="lx-picks" aria-label="Example creator storefronts">
          {shown.map((x) => (
            <li key={x.niche}>
              <button type="button" className="lx-pick" aria-pressed={x === c} onClick={() => pick(x.niche)}>
                <span className="lx-pick-photo" aria-hidden="true"><PhotoImg photo={x.photo} width={88} ratio={1} sizes="44px" eager /></span>
                <span className="lx-pick-text">
                  <span className="lx-pick-title">{x.niche}</span>
                  <span className="lx-pick-sub">{x.channels.map((ch) => `${ch.platform} ${ch.followers}`).join(', ')}</span>
                </span>
                <span className="lx-pick-price"><span className="lx-pick-from">from</span> <span className="lx-money">{usd(fromRate(x))}</span></span>
              </button>
            </li>
          ))}
        </ul>
      </div>
      <div className="lx-browse-detail" aria-live="polite" ref={detail}>
        <article key={c.niche} className="lx-card lx-ccard lx-swap" aria-label={`Example storefront: ${c.niche}`}>
          <div className="lx-ccard-cover"><PhotoImg photo={c.photo} width={560} ratio={560 / 120} sizes="(min-width: 1000px) 560px, 100vw" eager /></div>
          <div className="lx-ccard-body">
            <span className="lx-ccard-avatar" aria-hidden="true">{c.niche[0]}</span>
            <div className="lx-ccard-id">
              <h3 className="lx-ccard-name">{c.niche}</h3>
              <span className="lx-pill">{c.category}</span>
              <span className="lx-pill accent">Example</span>
            </div>
            <Channels c={c} />
          </div>
          <fieldset className="lx-pkgs">
            <legend className="lx-label">Packages</legend>
            {c.packages.map((p) => (
              <label key={p.key} className="lx-pkg">
                <input type="radio" name={groupName} checked={p === chosen} onChange={() => setPkg(p.key)} />
                <span>{PACKAGE_LABEL[p.key]}</span>
                <b className="lx-money">{usd(p.rate)}</b>
              </label>
            ))}
          </fieldset>
          <div className="lx-act">
            <p className="lx-act-keep">
              You pay <b className="tnum">{usd(e.held)}</b>
              {e.brandFee === 0
                ? <>, with no fee on top. The {PLATFORM_FEE_LABEL} platform fee comes out of the creator’s payout.</>
                : <>, including a {usd(e.brandFee)} platform fee.</>}
            </p>
            <a className="lx-btn accent" href={SIGNUP_HREF.brand} data-cta="hero-brief">Join free to brief</a>
          </div>
        </article>
      </div>
      <p className="lx-board-note">
        Example storefronts, drawn as Discover shows them. In the app you filter creators by platform, category,
        followers, city and price. Follower counts are what creators enter. <Credits photos={CREATORS.map((x) => x.photo)} />
      </p>
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

// The storefront's own three packages, the ones onboarding asks a price for.
const SF_PACKAGES = (['reel', 'story', 'combo'] as const).map((key) => ({ key, label: PACKAGE_LABEL[key] }));
type SfKey = (typeof SF_PACKAGES)[number]['key'];
const WORK = [PHOTOS.makeupTable, PHOTOS.kitchenShoot, PHOTOS.phoneOnTripod];

/** The storefront builder's state, shared with the button that keeps it. */
export function useStorefront() {
  const [name, setName] = useState('');
  const [handle, setHandle] = useState<string | null>(null);
  const [niche, setNiche] = useState('Beauty');
  const [rates, setRates] = useState<Record<SfKey, number>>({ reel: 900, story: 450, combo: 1250 });
  // Until the visitor types a handle, it follows the name, as sign-up does.
  const shownHandle = handle ?? toHandle(name);
  const keepDraft = () => {
    const store = browserStore();
    if (store) saveDraft(store, STOREFRONT_DRAFT_KEY, { name: name.trim(), handle: shownHandle, niche, rates, savedAt: Date.now() });
  };
  return { name, setName, handle: shownHandle, setHandle, niche, setNiche, rates, setRates, keepDraft };
}
export type Storefront = ReturnType<typeof useStorefront>;

export function StorefrontJoin({ sf }: { sf: Storefront }) {
  return (
    <div className="lx-sf-join">
      <a className="lx-btn" href={SIGNUP_HREF.creator} data-cta="sf-join" onClick={sf.keepDraft}>Join free</a>
      <p className="lx-note">Your name, handle, niche and rates carry into setup.</p>
    </div>
  );
}

export function StorefrontBuilder({ sf }: { sf: Storefront }) {
  const first = sf.name.trim().split(/\s+/)[0];
  return (
    <div className="lx-card" aria-label="Your storefront, as a brand sees it">
      <div className="lx-sf-cover"><PhotoImg photo={PHOTOS.ringLight} width={720} ratio={720 / 132} sizes="(min-width: 1000px) 700px, 100vw" /></div>
      <div className="lx-sf-head">
        <span className="lx-sf-portrait" aria-hidden="true">{initials(sf.name) || '+'}</span>
        <input className="lx-sf-name" aria-label="Your name" placeholder="Your name" value={sf.name} maxLength={40}
          autoComplete="off" spellCheck={false} onChange={(e) => sf.setName(e.target.value)} />
        <div className="lx-sf-meta">
          <span>@<input aria-label="Your handle" placeholder="yourhandle" value={sf.handle} maxLength={24}
            autoComplete="off" spellCheck={false} onChange={(e) => sf.setHandle(toHandle(e.target.value))} /></span>
          <select aria-label="Your niche" value={sf.niche} onChange={(e) => sf.setNiche(e.target.value)}>
            {CREATOR_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <span className="lx-pill accent">{sf.niche}</span>
        </div>
        <span className="lx-preview-btn" aria-hidden="true">{first ? `Brief ${first} on Alamut` : 'Send a brief'}</span>
      </div>
      <div className="lx-sf-section">
        <span className="lx-label">Recent work</span>
        <div className="lx-sf-work">
          {WORK.map((p) => <figure key={p.id}><PhotoImg photo={p} width={240} ratio={1} sizes="200px" /></figure>)}
        </div>
      </div>
      <div className="lx-sf-section">
        <span className="lx-label">Packages</span>
        <div className="lx-rates">
          {SF_PACKAGES.map((p) => (
            <label key={p.key} className="lx-rate">
              <span className="lx-rate-name">{p.label}</span>
              <span className="lx-rate-price">
                <b aria-hidden="true">$</b>
                <input type="text" inputMode="numeric" autoComplete="off" placeholder="0" aria-label={`${p.label} rate, US dollars`}
                  value={moneyText(sf.rates[p.key])} onChange={(e) => sf.setRates((r) => ({ ...r, [p.key]: toMoney(e.target.value) }))} />
              </span>
              <span className="lx-rate-keep">you keep <b>{keep(sf.rates[p.key])}</b></span>
            </label>
          ))}
        </div>
      </div>
      <div className="lx-sf-section">
        <p className="lx-note">
          Your page’s address: <span className="tnum">/c/{sf.handle || 'yourhandle'}</span>. “You keep” is after
          the {PLATFORM_FEE_LABEL} platform fee and {WHT_LABEL} withholding. <Credits photos={[PHOTOS.ringLight, ...WORK]} />
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
  const keepDraft = () => {
    const store = browserStore();
    if (store) saveDraft(store, BRIEF_DRAFT_KEY, { title: title.trim(), platform: p.value, format: f.value, count, perCreator: rate, savedAt: Date.now() });
  };
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
      <div className="lx-act lx-act-flat">
        <a className="lx-btn accent" href={SIGNUP_HREF.brand} data-cta="brief-post" onClick={keepDraft}>Post this brief</a>
        <p className="lx-note">Free to post. Sign up and it’s waiting in New campaign, filled in.</p>
      </div>
    </div>
  );
}

// ── Payment: the portal's wallet cards, as calculators ──────────────────

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
    <div className="lx-wallet ink" aria-label="What a brief holds and releases">
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
