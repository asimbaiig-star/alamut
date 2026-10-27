// tools-brands.tsx — the brand page's interactive pieces, drawn as the
// portal's own screens: Discover with a package priced in place, the brief
// builder (kept for the campaign wizard when posted), and the wallet card.

import { useId, useRef, useState } from 'react';
import { Credits, PhotoImg } from './components';
import { brandEstimate, usd } from './estimate';
import { PLATFORM_FEE_LABEL, PLATFORM_FORMATS, SIGNUP_HREF } from './facts';
import { PACKAGE_LABEL } from './listings';
import { CREATORS, CREATOR_FILTERS, fromRate, type CreatorListing } from './listings-creators';
import { browserStore, Chips, MoneyInput, PlatMark, revealPicked, Stepper, WalletLine } from './tools-shared';
import { BRIEF_DRAFT_KEY, saveDraft } from '@/lib/landingDraft';

// ── Brands' first screen: Discover, working ─────────────────────────────
// The list is Discover's; the card is the storefront a brand opens, with
// its packages, priced, and what booking one costs the brand.

function Channels({ c }: { c: CreatorListing }) {
  return (
    <div className="lx-ccard-channels">
      {c.channels.map((ch) => <span key={ch.platform} className="lx-plat"><PlatMark of={ch.platform} />{ch.platform} <b>{ch.followers}</b></span>)}
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
        <Chips label="Filter creators by platform" options={CREATOR_FILTERS} value={platform} onChange={(p) => { setPlatform(p); setPkg(null); }}
          mark={(o) => <PlatMark of={o} />} />
        <ul className="lx-picks" aria-label="Example creator storefronts">
          {shown.map((x) => (
            <li key={x.niche}>
              <button type="button" className="lx-pick" aria-pressed={x === c} onClick={() => pick(x.niche)}>
                <span className="lx-pick-photo" aria-hidden="true"><PhotoImg photo={x.photo} width={88} ratio={1} sizes="44px" eager /></span>
                <span className="lx-pick-text">
                  <span className="lx-pick-title">{x.niche}</span>
                  <span className="lx-pick-sub">
                    {x.channels.map((ch) => (
                      <span key={ch.platform} className="lx-pick-ch"><PlatMark of={ch.platform} /><span className="lx-sr">{ch.platform} </span>{ch.followers}</span>
                    ))}
                  </span>
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
            <div className="lx-act-split">
              <div className="lx-act-figure lx-act-figure-solo">
                <span className="lx-label">You pay</span>
                <span className="lx-money" aria-live="polite">{usd(e.held)}</span>
              </div>
              <a className="lx-btn accent" href={SIGNUP_HREF.brand} data-cta="hero-brief">Join free to brief</a>
            </div>
            <p className="lx-act-keep">
              {e.brandFee === 0
                ? <>No fee on top. The {PLATFORM_FEE_LABEL} platform fee comes out of the creator’s payout.</>
                : <>Including a {usd(e.brandFee)} platform fee.</>}
            </p>
          </div>
        </article>
      </div>
      <p className="lx-board-note">
        These are examples, shown the way the app shows storefronts. Follower counts are what creators
        enter. <Credits photos={CREATORS.map((x) => x.photo)} />
      </p>
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
        <div><span>Creators will see</span><b className="lx-plat"><PlatMark of={p.value} />{count} × {p.label} {f.label}</b></div>
      </div>
      <div className="lx-act lx-act-flat">
        <a className="lx-btn accent" href={SIGNUP_HREF.brand} data-cta="brief-post" onClick={keepDraft}>Post this brief</a>
        <p className="lx-note">Free to post. You’ll sign up first, then it opens in New campaign, filled in.</p>
      </div>
    </div>
  );
}

// ── Payment: the portal's ink wallet card, as a calculator ──────────────

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
