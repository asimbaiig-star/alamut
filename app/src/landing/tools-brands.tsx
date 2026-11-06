// tools-brands.tsx — the brand page's interactive pieces, drawn as the
// portal's own screens: storefronts with a package priced in place, the brief
// builder (kept for the campaign wizard when posted), and the money a brief
// holds.

import { useEffect, useId, useState, type CSSProperties } from 'react';
import { Credits, PhotoImg, photoSrcSet } from './components';
import { brandEstimate, usd } from './estimate';
import { PLATFORM_FEE_LABEL, PLATFORM_FORMATS, SIGNUP_HREF } from './facts';
import { PACKAGE_LABEL } from './listings';
import { CREATORS, fromRate, type CreatorListing } from './listings-creators';
import { browserStore, EscrowBar, MoneyInput, PlatMark, Roll, Stack, Stepper, useArrived } from './tools-shared';
import { BRIEF_DRAFT_KEY, saveDraft } from '@/lib/landingDraft';

// ── Brands' first screen: storefronts, working ──────────────────────────
// The pile is Discover; the sheet on top is the storefront a brand opens,
// with its packages, priced, and what booking one costs the brand.

const SHEET_COVER = { width: 410, ratio: 410 / 128, sizes: '(min-width: 1000px) 410px, 100vw' };

function Channels({ c }: { c: CreatorListing }) {
  return (
    <div className="lx-ccard-channels">
      {c.channels.map((ch) => <span key={ch.platform} className="lx-plat"><PlatMark of={ch.platform} />{ch.platform} <b>{ch.followers}</b></span>)}
      <span className="lx-ccard-er">{c.engagement}% ER</span>
    </div>
  );
}

function StorefrontSheet({ c, pkg, setPkg }: { c: CreatorListing; pkg: string | null; setPkg: (k: string) => void }) {
  const groupName = useId();
  const chosen = c.packages.find((p) => p.key === pkg) ?? c.packages[0]!;
  const e = brandEstimate(chosen.rate, 1, 1);
  return (
    <article className="lx-card lx-paper is-photo" aria-label={`Example storefront: ${c.niche}`}>
      <div className="lx-paper-cover"><PhotoImg photo={c.photo} {...SHEET_COVER} priority /></div>
      <div className="lx-paper-head">
        <div className="lx-paper-line">
          <h2 className="lx-paper-title">{c.niche}</h2>
          <span className="lx-lh-note">{c.category}</span>
          <span className="lx-lh-note">Example</span>
        </div>
        <Channels c={c} />
      </div>
      <fieldset className="lx-pkgs">
        <legend className="lx-sr">Packages</legend>
        {c.packages.map((p) => (
          <label key={p.key} className="lx-pkg">
            <input type="radio" name={groupName} checked={p === chosen} onChange={() => setPkg(p.key)} />
            <span>{PACKAGE_LABEL[p.key]}</span>
            <b className="lx-money">{usd(p.rate)}</b>
          </label>
        ))}
      </fieldset>
      <div className="lx-act">
        <div className="lx-act-row">
          <div className="lx-act-figure">
            <span>You pay</span>
            <Roll className="lx-money" value={usd(e.held)} />
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
  );
}

export function CreatorBrowser() {
  const [pkg, setPkg] = useState<string | null>(null);
  // The covers of the sheets still in the pile, fetched once the page has
  // settled, so the first one picked opens with its picture.
  useEffect(() => {
    const t = window.setTimeout(() => {
      for (const c of CREATORS.slice(1)) {
        const img = new Image();
        img.sizes = SHEET_COVER.sizes;
        img.srcset = photoSrcSet(c.photo, SHEET_COVER.width, SHEET_COVER.ratio);
      }
    }, 2500);
    return () => window.clearTimeout(t);
  }, []);
  return (
    <div className="lx-pile">
      <Stack
        tall
        label="Example creator storefronts"
        items={CREATORS}
        ground={(c) => c.ground}
        onPick={() => setPkg(null)}
        band={(c) => (
          <>
            <span className="lx-band-photo" aria-hidden="true"><PhotoImg photo={c.photo} width={88} ratio={1} sizes="44px" eager /></span>
            <span className="lx-band-who">
              <span className="lx-band-name">{c.niche}</span>
              <span className="lx-band-sub">
                {c.channels.map((ch) => <span key={ch.platform} className="lx-band-ch"><PlatMark of={ch.platform} /><span className="lx-sr">{ch.platform} </span>{ch.followers}</span>)}
              </span>
            </span>
            <span className="lx-band-from">from</span>
            <b className="lx-money">{usd(fromRate(c))}</b>
          </>
        )}
        show={(c) => <StorefrontSheet c={c} pkg={pkg} setPkg={setPkg} />}
      />
      <p className="lx-board-note">
        These are examples, shown the way the app shows storefronts. Follower counts are what creators enter.
        {' '}<Credits photos={CREATORS.map((c) => c.photo)} />
        {' '}<a className="lx-link" href="/creators" data-cta="hero-directory">Browse the live directory</a>
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

// ── Payment: what a brief holds, and what it releases ───────────────────

export function HoldTool({ lead }: { lead: string }) {
  const [rate, setRate] = useState(1500);
  const [creators, setCreators] = useState(3);
  const [posts, setPosts] = useState(2);
  const [live, setLive] = useState(1);
  const [figure, arrived] = useArrived<HTMLDivElement>();
  const e = brandEstimate(rate, creators, posts);
  // What each round of posts releases, across every creator on the brief.
  const rounds = e.perPost.map((amt) => amt * creators);
  const shown = Math.min(live, posts);
  const total = usd(e.held);
  return (
    <div className="lx-escrow" aria-label="What a brief holds and releases">
      <div className="lx-escrow-top">
        <div className="lx-escrow-figure" ref={figure}>
          <span>You pay in total</span>
          <span style={{ '--n': total.length } as CSSProperties}><Roll className="lx-giant" value={total} atZero={!arrived} /></span>
        </div>
        <div className="lx-escrow-side">
          <p className="lx-lead">{lead}</p>
          <div className="lx-escrow-inputs">
            <MoneyInput className="lx-escrow-field" label="Rate per creator" value={rate} onChange={setRate} />
            <div className="lx-escrow-field"><span>Creators</span><Stepper label="Creators" value={creators} min={1} max={50} onChange={setCreators} unit="creators" /></div>
            <div className="lx-escrow-field"><span>Posts each</span><Stepper label="Posts each" value={posts} min={1} max={10} onChange={setPosts} unit="posts" /></div>
          </div>
        </div>
      </div>
      <EscrowBar amounts={rounds} live={shown} onChange={setLive} doneLabel="confirmed, released" />
      <dl className="lx-ledger">
        <div><dt>Held as offers are accepted</dt><dd>{usd(e.held)}</dd></div>
        <div><dt>Released so far</dt><dd>{usd(rounds.slice(0, shown).reduce((a, b) => a + b, 0))}</dd></div>
        <div><dt>Platform fee charged to you</dt><dd>{usd(e.brandFee)}</dd></div>
        <div><dt>Each creator receives, after fees</dt><dd>{usd(e.perCreatorNet)}</dd></div>
      </dl>
    </div>
  );
}
