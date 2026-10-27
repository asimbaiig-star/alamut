// tools-creators.tsx — the creator page's interactive pieces, drawn as the
// portal's own screens: Browse campaigns with a pitch priced in place, the
// rate calculator, the storefront a brand would see, and the wallet card.
//
// Options come from the product's lists (facts.ts → marketplaceOptions.ts,
// brandPalette.ts) and money from its maths (estimate.ts → money.ts). What a
// visitor builds is kept for sign-up only when they ask (landingDraft.ts).

import { useEffect, useId, useRef, useState } from 'react';
import { Credits, PhotoImg } from './components';
import { creatorEstimate, usd } from './estimate';
import { brandAccent, CREATOR_CATEGORIES, PLATFORM_FEE_LABEL, SIGNUP_HREF, WHT_LABEL } from './facts';
import { PACKAGE_LABEL } from './listings';
import { BRIEFS, BRIEF_FILTERS, type BriefListing } from './listings-briefs';
import { PHOTOS } from './photos';
import { browserStore, Chips, MoneyInput, moneyText, PlatMark, platformIn, revealPicked, Stepper, toMoney, WalletLine } from './tools-shared';
import { fmtFollowers } from '@/lib/followers';
import { saveDraft, STOREFRONT_DRAFT_KEY } from '@/lib/landingDraft';
import { startingRates, suggestRateBand } from '@/screens/tools/rateGuidance';

const keep = (rate: number) => usd(creatorEstimate(rate, 1).net);

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
                  <span className="lx-pick-sub">
                    {[...new Set(b.deliverables.map(platformIn))].map((p) => p && <PlatMark key={p} of={p} />)}
                    <span className="lx-pick-clip">{b.deliverables.join(', ')}</span>
                  </span>
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
            <div><span className="lx-label">Deliverables</span><ul className="lx-tile-list">{brief.deliverables.map((d) => <li key={d} className="lx-plat"><PlatMark of={d} />{d}</li>)}</ul></div>
            <div><span className="lx-label">Deadline</span><span className="lx-money lx-tile-price">{brief.deadlineDays}<small> d</small></span></div>
          </div>
          <div className="lx-act">
            <div className="lx-act-row">
              <MoneyInput label="Your rate for the deal" value={myRate} onChange={setRate} />
              <div className="lx-act-figure">
                <span className="lx-label">You keep</span>
                <span className="lx-money" aria-live="polite">{usd(creatorEstimate(myRate, 1).net)}</span>
              </div>
            </div>
            <p className="lx-act-keep">After the {PLATFORM_FEE_LABEL} platform fee and {WHT_LABEL} withholding, taken only when the brand pays.</p>
            <a className="lx-btn accent" href={SIGNUP_HREF.creator} data-cta="hero-pitch">Join free to pitch</a>
          </div>
        </article>
      </div>
      <p className="lx-board-note">
        These are examples, shown the way the app shows open briefs.
      </p>
    </div>
  );
}

// ── Creators: what to charge (the public rate calculator's maths) ──────

/** Where the helper starts, and so where the storefront's prices start: the
 *  two agree when the page loads instead of contradicting each other. */
const HELPER_START = { followers: 50_000, engagement: 4 };
export const STOREFRONT_START = startingRates(suggestRateBand('instagram', HELPER_START.followers, HELPER_START.engagement)!);
// The same band onboarding shows on its rates step, from rateGuidance.ts:
// a benchmark from followers and engagement, labelled as one, and the same
// "starting point" prices onboarding would set.

export function RateHelper({ sf }: { sf: Storefront }) {
  const { followers, setFollowers, engagement, setEngagement } = sf;
  const fId = useId();
  const eId = useId();
  const band = suggestRateBand('instagram', followers, engagementOf(engagement));
  const start = band ? startingRates(band) : null;
  return (
    <div className="lx-card lx-rh" aria-label="What to charge on Instagram">
      <h3 className="lx-h3">What should you charge?</h3>
      <div className="lx-rh-inputs">
        <label className="lx-field-label" htmlFor={fId}>
          <span>Instagram followers</span>
          <input id={fId} className="lx-rh-input tnum" type="text" inputMode="numeric" autoComplete="off"
            value={moneyText(followers)} onChange={(ev) => setFollowers(Math.min(50_000_000, Number(ev.target.value.replace(/[^\d]/g, '')) || 0))} />
        </label>
        <label className="lx-field-label" htmlFor={eId}>
          <span>Engagement rate</span>
          <span className="lx-rh-pct">
            <input id={eId} className="lx-rh-input tnum" type="text" inputMode="decimal" autoComplete="off"
              value={engagement} onChange={(ev) => setEngagement(ev.target.value.replace(/[^\d.]/g, '').slice(0, 5))} />
            <b aria-hidden="true">%</b>
          </span>
        </label>
      </div>
      {band && start ? (
        <>
          <p className="lx-rh-band" aria-live="polite">
            <span className="lx-rh-label">Typical for a Reel</span>
            <span className="lx-money">{usd(band.low)}–{usd(band.high)}</span>
          </p>
          <p className="lx-rh-sets">
            Starting prices from the midpoint: Reel {usd(start.reel)}, Story bundle {usd(start.story)},
            Reel + Stories combo {usd(start.combo)}.
          </p>
          <button type="button" className="lx-btn lx-btn-sm" onClick={() => sf.setRates(start)}>
            Use these prices
          </button>
        </>
      ) : (
        <p className="lx-note">Add your follower count to see a typical range.</p>
      )}
      <p className="lx-note">
        A benchmark from followers and engagement, not a quote. On TikTok or YouTube? Use
        the <a className="lx-link" href="/tools/tiktok-calculator">TikTok</a> or <a className="lx-link" href="/tools/youtube-calculator">YouTube</a> calculator.
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

const engagementOf = (typed: string) => Math.min(100, Number(typed) || 0);

/** The storefront builder's state, shared with the rate helper (whose
 *  Instagram numbers are the storefront's channel) and the button that
 *  keeps it. */
export function useStorefront() {
  const [followers, setFollowers] = useState(HELPER_START.followers);
  // Kept as typed, so "3." on the way to "3.5" survives the next render.
  const [engagement, setEngagement] = useState(String(HELPER_START.engagement));
  const [name, setName] = useState('');
  const [handle, setHandle] = useState<string | null>(null);
  const [niche, setNiche] = useState('Beauty');
  const [rates, setRates] = useState<Record<SfKey, number>>(STOREFRONT_START);
  // Until the visitor types a handle, it follows the name, as sign-up does.
  const shownHandle = handle ?? toHandle(name);
  const keepDraft = () => {
    const store = browserStore();
    if (store) saveDraft(store, STOREFRONT_DRAFT_KEY, { name: name.trim(), handle: shownHandle, niche, rates, savedAt: Date.now() });
  };
  return { name, setName, handle: shownHandle, setHandle, niche, setNiche, rates, setRates, followers, setFollowers, engagement, setEngagement, keepDraft };
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
  // The page's real address. Known only in the browser, so the prerendered
  // page shows the path and the domain arrives after hydration.
  const [host, setHost] = useState('');
  useEffect(() => { setHost(window.location.host); }, []);
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
        <span className="lx-label">Channels</span>
        <div className="lx-sf-channel">
          <PlatMark of="instagram" size="lg" />
          <div className="lx-sf-ch-id"><b>Instagram</b><span>@{sf.handle || 'yourhandle'}</span></div>
          <div className="lx-sf-ch-num">
            <span className="lx-money">{fmtFollowers(sf.followers)}</span>
            <span>{engagementOf(sf.engagement)}% ER</span>
          </div>
        </div>
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
          Your page’s address: <span className="tnum lx-sf-url">{host}/c/{sf.handle || 'yourhandle'}</span>.
          {' '}<Credits photos={[PHOTOS.ringLight, ...WORK]} />
        </p>
      </div>
    </div>
  );
}

// ── Payment: the portal's moss wallet card, as a calculator ─────────────

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
