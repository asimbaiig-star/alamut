// tools.tsx — the interactive pieces of each page.
//
// The hero of each page is a builder: type into it and it becomes the thing
// the other side of the marketplace sees — a storefront for creators, a brief
// for brands. Its options come from the product's own lists (facts.ts →
// marketplaceOptions.ts), so it can't offer a format the product doesn't.
//
// Lower down, the payment tools run the product's money maths (estimate.ts →
// money.ts): type a rate and you see what the ledger would actually record.

import { useId, useState } from 'react';
import { brandEstimate, clampMoney, creatorEstimate, usd } from './estimate';
import { CREATOR_CATEGORIES, PLATFORM_FEE_LABEL, PLATFORM_FORMATS, WHT_LABEL } from './facts';

const toMoney = (raw: string) => clampMoney(Number(raw.replace(/[^\d]/g, '')) || 0);
const moneyText = (n: number) => (n === 0 ? '' : n.toLocaleString('en-US'));

function MoneyInput({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  const id = useId();
  return (
    <label className="lx-field" htmlFor={id}>
      <span>{label}</span>
      <div className="lx-money">
        <b aria-hidden="true">$</b>
        <input
          id={id}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          value={value === 0 ? '' : String(value)}
          placeholder="0"
          onChange={(e) => onChange(toMoney(e.target.value))}
          aria-describedby={`${id}-hint`}
        />
      </div>
      <span id={`${id}-hint`} hidden>Whole US dollars</span>
    </label>
  );
}

function Stepper({ label, value, min, max, onChange, unit, small }: {
  label: string; value: number; min: number; max: number; onChange: (n: number) => void; unit: string; small?: boolean;
}) {
  const id = useId();
  const controls = (
    <>
      <button type="button" onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min} aria-label={`Fewer ${unit}`}>−</button>
      <output aria-live="polite">{value}</output>
      <button type="button" onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max} aria-label={`More ${unit}`}>+</button>
    </>
  );
  if (small) {
    return (
      <div className="lx-stepper sm" role="group" aria-labelledby={id}>
        <span id={id} className="lx-sr">{label}</span>
        {controls}
      </div>
    );
  }
  return (
    <div className="lx-field" role="group" aria-labelledby={id}>
      <span id={id}>{label}</span>
      <div className="lx-stepper">{controls}</div>
    </div>
  );
}

// ── Creators' hero: the storefront a brand would see ─────────────────────

/** What the product would accept as a handle, near enough for a preview. */
export function toHandle(name: string): string {
  return name.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9._]/g, '').slice(0, 24);
}

function initials(name: string): string {
  return name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join('');
}

const PACKAGES = [
  { key: 'reel', label: 'Reel' },
  { key: 'post', label: 'Post' },
  { key: 'story', label: 'Story' },
] as const;
type PackageKey = (typeof PACKAGES)[number]['key'];

export function StorefrontBuilder() {
  const [name, setName] = useState('');
  const [handle, setHandle] = useState<string | null>(null);
  const [niche, setNiche] = useState('Beauty');
  const [rates, setRates] = useState<Record<PackageKey, number>>({ reel: 900, post: 600, story: 250 });
  // Until the visitor types a handle, it follows the name — as sign-up does.
  const shownHandle = handle ?? toHandle(name);
  const first = name.trim().split(/\s+/)[0];
  return (
    <div className="lx-tool lx-build" aria-label="Your storefront, as a brand sees it">
      <div className="lx-tool-head">
        <span className="lx-kicker">Your storefront</span>
        <span className="lx-example">Type to edit</span>
      </div>
      <div className="lx-sf">
        <div className="lx-sf-id">
          <span className="lx-sf-avatar" aria-hidden="true">{initials(name)}</span>
          <div className="lx-sf-who">
            <input
              className="lx-inline lx-inline-lg" aria-label="Your name" placeholder="Your name"
              value={name} maxLength={40} autoComplete="off" spellCheck={false}
              onChange={(e) => setName(e.target.value)}
            />
            <div className="lx-sf-meta">
              <span className="lx-inline-at">@<input
                className="lx-inline" aria-label="Your handle" placeholder="yourhandle"
                value={shownHandle} maxLength={24} autoComplete="off" spellCheck={false}
                onChange={(e) => setHandle(toHandle(e.target.value))}
              /></span>
              <select className="lx-inline lx-select" aria-label="Your niche" value={niche} onChange={(e) => setNiche(e.target.value)}>
                {CREATOR_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
        </div>
        <div className="lx-sf-pk">
          <span className="lx-sf-label">Packages</span>
          <div className="lx-sf-rates">
            {PACKAGES.map((p) => (
              <label key={p.key} className="lx-sf-rate">
                <span>{p.label}</span>
                <span className="lx-sf-price">
                  <b aria-hidden="true">$</b>
                  <input
                    type="text" inputMode="numeric" autoComplete="off" placeholder="0"
                    aria-label={`${p.label} rate, US dollars`}
                    value={moneyText(rates[p.key])}
                    onChange={(e) => setRates((r) => ({ ...r, [p.key]: toMoney(e.target.value) }))}
                  />
                </span>
                <small>you keep <b>{usd(creatorEstimate(rates[p.key], 1).net)}</b></small>
              </label>
            ))}
          </div>
        </div>
        <div className="lx-sf-foot">
          <span className="lx-chip-btn" aria-hidden="true">{first ? `Brief ${first}` : 'Send a brief'} <span className="lx-arrow">→</span></span>
          <span className="lx-sf-url">/c/{shownHandle || 'yourhandle'}</span>
        </div>
      </div>
      <p className="lx-tool-note">
        Brands see this page — rates included — before they brief you. “You keep” is after the {PLATFORM_FEE_LABEL} platform
        fee and {WHT_LABEL} withholding.
      </p>
    </div>
  );
}

// ── Brands' hero: the brief a creator would see ──────────────────────────

export function BriefBuilder() {
  const [title, setTitle] = useState('');
  const [platform, setPlatform] = useState('instagram');
  const [format, setFormat] = useState('reel');
  const [count, setCount] = useState(2);
  const [rate, setRate] = useState(1500);
  const rateId = useId();
  const p = PLATFORM_FORMATS.find((x) => x.value === platform) ?? PLATFORM_FORMATS[0]!;
  const f = p.formats.find((x) => x.value === format) ?? p.formats[0]!;
  return (
    <div className="lx-tool lx-build" aria-label="Your brief, as a creator sees it">
      <div className="lx-tool-head">
        <span className="lx-kicker">Your brief</span>
        <span className="lx-example">Type to edit</span>
      </div>
      <div className="lx-br">
        <span className="lx-pill">Open to apply</span>
        <input
          className="lx-inline lx-inline-lg" aria-label="Campaign name" placeholder="Name your campaign"
          value={title} maxLength={60} autoComplete="off"
          onChange={(e) => setTitle(e.target.value)}
        />
        <div className="lx-br-rows">
          <div className="lx-br-row" role="group" aria-label="Deliverables">
            <span className="lx-br-k">Deliverables</span>
            <div className="lx-br-v">
              <Stepper small label="How many" value={count} min={1} max={10} onChange={setCount} unit="deliverables" />
              <select
                className="lx-ctl" aria-label="Platform" value={platform}
                onChange={(e) => {
                  const next = PLATFORM_FORMATS.find((x) => x.value === e.target.value) ?? PLATFORM_FORMATS[0]!;
                  setPlatform(next.value);
                  setFormat(next.formats[0]!.value);
                }}
              >
                {PLATFORM_FORMATS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <select className="lx-ctl" aria-label="Format" value={f.value} onChange={(e) => setFormat(e.target.value)}>
                {p.formats.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>
          <div className="lx-br-row">
            <label className="lx-br-k" htmlFor={rateId}>Target rate</label>
            <div className="lx-br-v">
              <span className="lx-ctl lx-ctl-money">
                <b aria-hidden="true">$</b>
                <input
                  id={rateId} type="text" inputMode="numeric" autoComplete="off" placeholder="0"
                  value={moneyText(rate)} onChange={(e) => setRate(toMoney(e.target.value))}
                />
              </span>
              <span className="lx-br-unit">per creator</span>
            </div>
          </div>
        </div>
        <div className="lx-sf-foot">
          <span className="lx-chip-btn" aria-hidden="true">Apply with a pitch <span className="lx-arrow">→</span></span>
          <span className="lx-sf-url">{count} × {p.label} {f.label}</span>
        </div>
      </div>
      <p className="lx-tool-note">
        Creators see this, then apply with a pitch and the rate they want. You shortlist, accept, counter or pass.
      </p>
    </div>
  );
}

// ── Payment: what the ledger would record ────────────────────────────────

export function PayoutTool() {
  const [rate, setRate] = useState(1800);
  const [posts, setPosts] = useState(2);
  const e = creatorEstimate(rate, posts);
  return (
    <div className="lx-tool" aria-label="What you would receive">
      <div className="lx-tool-head">
        <span className="lx-kicker">What reaches you</span>
        <span className="lx-example">Try your own numbers</span>
      </div>
      <div className="lx-tool-inputs">
        <MoneyInput label="Your rate for the deal" value={rate} onChange={setRate} />
        <Stepper label="Posts" value={posts} min={1} max={10} onChange={setPosts} unit="posts" />
      </div>
      <div className="lx-tool-body">
        <ol className="lx-flow">
          <li><i className="lx-dot held" /><span>Brand accepts — held in escrow</span><b>{usd(e.held)}</b></li>
          {e.releases.map((amt, i) => (
            <li key={i}>
              <i className="lx-dot release" />
              <span>{e.releases.length > 1 ? `Post ${i + 1} is live and confirmed` : 'Your post is live and confirmed'} — released</span>
              <b>{usd(amt)}</b>
            </li>
          ))}
        </ol>
        <div className="lx-totals">
          <div><span>Platform fee ({PLATFORM_FEE_LABEL})</span><span>−{usd(e.fee)}</span></div>
          <div><span>Withholding ({WHT_LABEL})</span><span>−{usd(e.tax)}</span></div>
          <div className="net"><span>Reaches your wallet</span><b aria-live="polite">{usd(e.net)}</b></div>
        </div>
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
    <div className="lx-tool" aria-label="What a brief holds and releases">
      <div className="lx-tool-head">
        <span className="lx-kicker">What your brief holds</span>
        <span className="lx-example">Try your own numbers</span>
      </div>
      <div className="lx-tool-inputs three">
        <MoneyInput label="Rate per creator" value={rate} onChange={setRate} />
        <Stepper label="Creators" value={creators} min={1} max={50} onChange={setCreators} unit="creators" />
        <Stepper label="Posts each" value={posts} min={1} max={10} onChange={setPosts} unit="posts" />
      </div>
      <div className="lx-tool-body">
        <ol className="lx-flow">
          <li><i className="lx-dot held" /><span>Offers accepted — held in escrow</span><b>{usd(e.held)}</b></li>
          <li>
            <i className="lx-dot release" />
            <span>Released each time you confirm a post is live</span>
            <b>{uneven ? `${usd(perPost)}–${usd(Math.max(...e.perPost))}` : usd(perPost)}</b>
          </li>
        </ol>
        <div className="lx-totals">
          <div><span>Platform fee charged to you</span><span>{usd(e.brandFee)}</span></div>
          <div><span>Each creator receives, after fees</span><span>{usd(e.perCreatorNet)}</span></div>
          <div className="net"><span>You pay in total</span><b aria-live="polite">{usd(e.held)}</b></div>
        </div>
      </div>
    </div>
  );
}
