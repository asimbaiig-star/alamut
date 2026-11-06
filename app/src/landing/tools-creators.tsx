// tools-creators.tsx — the creator page's interactive pieces, drawn as the
// portal's own screens: open briefs on their letterheads with a pitch priced
// in place, the rate calculator, the storefront a brand would see, and the
// money a deal holds.
//
// Options come from the product's lists (facts.ts → marketplaceOptions.ts,
// brandPalette.ts) and money from its maths (estimate.ts → money.ts). What a
// visitor builds is kept for sign-up only when they ask (landingDraft.ts).

import { useEffect, useId, useState, type CSSProperties } from 'react';
import { Credits, PhotoImg } from './components';
import { creatorEstimate, usd } from './estimate';
import { brandAccent, CREATOR_CATEGORIES, PLATFORM_FEE_LABEL, SIGNUP_HREF, WHT_LABEL } from './facts';
import { PACKAGE_LABEL } from './listings';
import { BRIEFS, type BriefListing } from './listings-briefs';
import { PHOTOS } from './photos';
import { browserStore, EscrowBar, MoneyInput, moneyText, PlatMark, Roll, Stack, Stepper, toMoney, useArrived } from './tools-shared';
import { fmtFollowers } from '@/lib/followers';
import { saveDraft, STOREFRONT_DRAFT_KEY } from '@/lib/landingDraft';
import { startingRates, suggestRateBand } from '@/screens/tools/rateGuidance';

const keep = (rate: number) => usd(creatorEstimate(rate, 1).net);

// ── Creators' first screen: open briefs, working ────────────────────────
// The pile is Browse campaigns; the sheet on top is the brief a creator
// opens, with the one thing they'd do there: name their rate and see what
// they keep.

function BriefSheet({ brief, rate, setRate }: { brief: BriefListing; rate: number | null; setRate: (n: number) => void }) {
  const myRate = rate ?? brief.perCreator;
  return (
    <article className="lx-card lx-paper" aria-label={`Example brief: ${brief.title}`} style={{ '--lh': brandAccent(brief.brand).bg } as CSSProperties}>
      <div className="lx-lh">
        <span className="lx-lh-mark" aria-hidden="true">{brief.title[0]}</span>
        <span className="lx-lh-brand">{brief.brand}</span>
        <span className="lx-lh-note">{brief.category}</span>
        <span className="lx-lh-note">Example</span>
      </div>
      <div className="lx-paper-head">
        <h2 className="lx-paper-title">{brief.title}</h2>
        <p className="lx-paper-blurb">{brief.blurb}</p>
      </div>
      <ul className="lx-paper-meta">
        {brief.deliverables.map((d) => <li key={d} className="lx-plat"><PlatMark of={d} />{d}</li>)}
        <li>Due in {brief.deadlineDays} days</li>
      </ul>
      <div className="lx-act">
        <div className="lx-act-row">
          <MoneyInput label="Your rate for the deal" value={myRate} onChange={setRate} />
          <div className="lx-act-figure">
            <span>You keep</span>
            <Roll className="lx-money" value={usd(creatorEstimate(myRate, 1).net)} />
          </div>
        </div>
        <p className="lx-act-keep">After the {PLATFORM_FEE_LABEL} platform fee and {WHT_LABEL} withholding, taken only when the brand pays.</p>
        <a className="lx-btn accent" href={SIGNUP_HREF.creator} data-cta="hero-pitch">Join free to pitch</a>
      </div>
    </article>
  );
}

export function BriefBrowser() {
  // null: the visitor hasn't named a rate yet, so the pitch starts at the
  // brief's own target rate.
  const [rate, setRate] = useState<number | null>(null);
  return (
    <div className="lx-pile">
      <Stack
        label="Example open briefs"
        items={BRIEFS}
        ground={(b) => brandAccent(b.brand).bg}
        onPick={() => setRate(null)}
        band={(b) => (
          <>
            <PlatMark of={b.deliverables[0]!} />
            <span className="lx-band-name">{b.title}</span>
            <b className="lx-money">{usd(b.perCreator)}</b>
          </>
        )}
        show={(b) => <BriefSheet brief={b} rate={rate} setRate={setRate} />}
      />
      <p className="lx-board-note">These are examples, shown the way the app shows open briefs.</p>
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
    <div className="lx-card lx-rh" role="group" aria-label="What to charge on Instagram">
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
          <button type="button" className="lx-btn lx-btn-sm" onClick={() => sf.takeRates(start)}>
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
  // Counts each time the rate helper's prices are taken, so the packages can
  // show the prices landing.
  const [taken, setTaken] = useState(0);
  const takeRates = (next: Record<SfKey, number>) => { setRates(next); setTaken((n) => n + 1); };
  // Until the visitor types a handle, it follows the name, as sign-up does.
  const shownHandle = handle ?? toHandle(name);
  const keepDraft = () => {
    const store = browserStore();
    if (store) saveDraft(store, STOREFRONT_DRAFT_KEY, { name: name.trim(), handle: shownHandle, niche, rates, savedAt: Date.now() });
  };
  return { name, setName, handle: shownHandle, setHandle, niche, setNiche, rates, setRates, takeRates, taken, followers, setFollowers, engagement, setEngagement, keepDraft };
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
    <div className="lx-card lx-sf" role="group" aria-label="Your storefront, as a brand sees it">
      <div className="lx-sf-cover">
        <PhotoImg photo={PHOTOS.ringLight} width={880} ratio={880 / 268} sizes="(min-width: 1000px) 900px, 100vw" />
        <span className="lx-sf-url tnum">{host}/c/{sf.handle || 'yourhandle'}</span>
      </div>
      <div className="lx-sf-head">
        <span className="lx-sf-portrait" aria-hidden="true">{initials(sf.name) || '+'}</span>
        <input className="lx-sf-name" aria-label="Your name" placeholder="Your name" value={sf.name} maxLength={40}
          autoComplete="off" spellCheck={false} onChange={(e) => sf.setName(e.target.value)} />
        <span className="lx-preview-btn" aria-hidden="true">{first ? `Brief ${first} on Alamut` : 'Send a brief'}</span>
        <div className="lx-sf-meta">
          <span>@<input aria-label="Your handle" placeholder="yourhandle" value={sf.handle} maxLength={24}
            autoComplete="off" spellCheck={false} onChange={(e) => sf.setHandle(toHandle(e.target.value))} /></span>
          <select aria-label="Your niche" value={sf.niche} onChange={(e) => sf.setNiche(e.target.value)}>
            {CREATOR_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
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
        <span className="lx-label">Packages</span>
        <div className="lx-rates" key={sf.taken} data-taken={sf.taken > 0 || undefined}>
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
        <span className="lx-label">Recent work</span>
        <div className="lx-sf-work">
          {WORK.map((p) => <figure key={p.id}><PhotoImg photo={p} width={280} ratio={1} sizes="(min-width: 1000px) 280px, 30vw" /></figure>)}
        </div>
        <p className="lx-note"><Credits photos={[PHOTOS.ringLight, ...WORK]} /></p>
      </div>
    </div>
  );
}

// ── Payment: what a deal holds, and what reaches the wallet ─────────────

export function PayoutTool({ lead }: { lead: string }) {
  const [rate, setRate] = useState(1800);
  const [posts, setPosts] = useState(2);
  const [live, setLive] = useState(1);
  const [figure, arrived, settled] = useArrived<HTMLDivElement>();
  const e = creatorEstimate(rate, posts);
  // Everything sits held as the section arrives, then the first post releases.
  const shown = settled ? Math.min(live, posts) : 0;
  const net = usd(e.net);
  return (
    <div className="lx-escrow" role="group" aria-label="What you would receive">
      <div className="lx-escrow-top">
        <div className="lx-escrow-figure" ref={figure}>
          <span>Reaches your wallet</span>
          <span style={{ '--n': net.length } as CSSProperties}><Roll className="lx-giant" value={net} atZero={!arrived} /></span>
        </div>
        <div className="lx-escrow-side">
          <p className="lx-lead">{lead}</p>
          <div className="lx-escrow-inputs">
            <MoneyInput className="lx-escrow-field" label="Your rate for the deal" value={rate} onChange={setRate} />
            <div className="lx-escrow-field"><span>Posts</span><Stepper label="Posts" value={posts} min={1} max={10} onChange={setPosts} unit="posts" /></div>
          </div>
        </div>
      </div>
      <EscrowBar amounts={e.releases} live={shown} onChange={setLive} doneLabel="live, released" />
      <dl className="lx-ledger">
        <div><dt>Held when the brand accepts</dt><dd>{usd(e.held)}</dd></div>
        <div><dt>Released so far</dt><dd>{usd(e.releases.slice(0, shown).reduce((a, b) => a + b, 0))}</dd></div>
        <div><dt>Platform fee ({PLATFORM_FEE_LABEL})</dt><dd>−{usd(e.fee)}</dd></div>
        <div><dt>Withholding ({WHT_LABEL})</dt><dd>−{usd(e.tax)}</dd></div>
      </dl>
    </div>
  );
}
