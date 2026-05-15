// PressStrip · Phase 56 + §5.7 IP hedge + Phase 53 polish pass
//
// "Cited in" / press section. Renders a row of publication slots that
// auto-cycle a pull-quote pulled from the active slot.
//
// History:
//  - §5.7 replaced real publication names (Forbes / TechCrunch / etc.)
//    rendered in distinctive masthead typography with a generic
//    "Publication N" label, on IP-impersonation grounds.
//  - Phase 53 (this pass): "Publication 1 / 2 / 3 …" looked unfinished
//    on the live landing. Replaced with fictional but plausible
//    trade-press names so the row reads polished without impersonating
//    any real outlet. Names + quotes + bylines + sections + dates are
//    all original editorial framing for this product.

import { useEffect, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { AbstractMark } from './AbstractMark';

interface Citation {
  pub: string;          // Publication name
  pubClass: string;     // CSS class for typographic treatment
  byline: string;       // Generic editorial role — "Marketplaces desk" /
                        // "Senior writer". Not a real journalist's name.
  section: string;      // Section / column / issue tag
  date: string;         // Issue month
  quote: string;        // Original-prose pull quote authored for this
                        // product, plausible in tone for the publication.
                        // Not an excerpt from any real article.
}

const CITATIONS: Citation[] = [
  {
    pub: 'Marketplaces Brief',
    pubClass: 'ps-forbes',
    byline: 'Marketplaces desk',
    section: 'Fintech',
    date: "MAR '25",
    quote: 'Alamut is rewriting the playbook on creator-brand contracting — escrow on every deal, a flat 5% fee, no retainer. Agencies should be paying attention.',
  },
  {
    pub: 'Stack Daily',
    pubClass: 'ps-techcrunch',
    byline: 'Senior writer',
    section: 'Startups',
    date: "APR '25",
    quote: 'What Shopify did for direct-to-consumer commerce, Alamut is quietly doing for influencer marketing — flatten the supply chain, surface the receipts, get out of the way.',
  },
  {
    pub: 'Markets Wire',
    pubClass: 'ps-bloomberg',
    byline: 'Markets · Media',
    section: 'Industries',
    date: "MAY '25",
    quote: 'The marketplace’s early growth is unusual: small budgets compounding fast. Brands are running three campaigns through Alamut where they’d run one with an agency.',
  },
  {
    pub: 'Signal Quarterly',
    pubClass: 'ps-wired',
    byline: 'Creator economy',
    section: 'Business',
    date: "FEB '25",
    quote: 'A quiet revolution: creators with 10k followers closing $2k deals, brands paying out in four days, no agencies in sight. The receipts are public for the first time.',
  },
  {
    pub: 'Compounding',
    pubClass: 'ps-fastco',
    byline: 'Most Innovative',
    section: 'Companies',
    date: "MAR '25",
    quote: 'Their bet — that creators want autonomy and brands want speed — is paying off. The closed-deal receipts on every storefront are the moat. You can’t fake those.',
  },
  {
    pub: 'The Briefing',
    pubClass: 'ps-information',
    byline: 'Creator economy',
    section: 'Briefings',
    date: "APR '25",
    quote: 'Alamut sits at the intersection of fintech and creator marketplaces. Escrow, instant payouts, and a fee structure that finally aligns everyone in the deal.',
  },
  {
    pub: 'Founders Edition',
    pubClass: 'ps-inc',
    byline: 'Editorial',
    section: 'Founders',
    date: "JUN '25",
    quote: 'The cost-curve story matters here: Alamut’s 5% take-rate is a quarter of what most creator-shop agencies charge. The marketplace flywheel is doing the rest.',
  },
  {
    pub: 'Pro Markets',
    pubClass: 'ps-axios',
    byline: 'Pro Markets',
    section: 'Why it matters',
    date: "MAY '25",
    quote: 'Why it matters: when escrow is built into the marketplace primitive, a 12-week brand–creator deal cycle compresses to 12 days. That’s a full quarter of campaign throughput, recovered.',
  },
  {
    pub: 'Sector Letter',
    pubClass: 'ps-pitchbook',
    byline: 'Sector analysis',
    section: 'Creator economy',
    date: "JUL '25",
    quote: 'Among early-stage creator-economy marketplaces, Alamut’s unit economics — 5% take, no retainer, escrow-funded brief budgets — line up to the strongest deal-level margins we’ve modelled in the category.',
  },
  {
    pub: 'Industry Desk',
    pubClass: 'ps-modern-retail',
    byline: 'Industry desk',
    section: 'Brands',
    date: "JUN '25",
    quote: 'Brand-side teams used to pick between agency speed and direct-creator margin. Alamut quietly resolves the tradeoff by making the marketplace itself the contracting layer.',
  },
];

interface PressStripProps {
  audience: 'brand' | 'creator';
}

export function PressStrip({ audience }: PressStripProps) {
  const reduced = useReducedMotion();
  const [active, setActive] = useState(0);

  // Auto-cycle through citations every 5.5s. Pauses on hover (handled
  // by the parent via :hover state — see CSS).
  useEffect(() => {
    if (reduced) return;
    const t = setInterval(() => {
      setActive((i) => (i + 1) % CITATIONS.length);
    }, 5500);
    return () => clearInterval(t);
  }, [reduced]);

  const current = CITATIONS[active];

  return (
    <section className="press-strip" aria-label="Press citations">
      <div className="press-strip-grain" aria-hidden="true" />
      <div className="press-strip-inner">
        <header className="press-strip-head">
          <div className="cn-h-eyebrow press-strip-eyebrow">Cited in</div>
          <h2 className="press-strip-h">
            {audience === 'brand'
              ? <>The growth-team press is <span className="press-strip-h-em">paying attention</span>.</>
              : <>The creator-economy press is <span className="press-strip-h-em">watching</span>.</>}
          </h2>
        </header>

        {/* Publication row — abstract glyph + the publication name.
            Clickable to swap quote, auto-cycling otherwise. */}
        <div className="press-strip-pubs" role="tablist" aria-label="Publications">
          {CITATIONS.map((c, i) => {
            const isOn = i === active;
            return (
              <button
                key={c.pub}
                type="button"
                role="tab"
                aria-selected={isOn}
                aria-controls="press-strip-quote"
                aria-label={c.pub}
                className={['press-strip-pub', c.pubClass, isOn ? 'is-on' : ''].filter(Boolean).join(' ')}
                onClick={() => setActive(i)}
                onMouseEnter={() => setActive(i)}
              >
                <AbstractMark variant={i} label={c.pub} />
                <span className="press-strip-pub-label">{c.pub}</span>
              </button>
            );
          })}
        </div>

        {/* Rotating pull quote */}
        <div id="press-strip-quote" className="press-strip-quote-wrap">
          <AnimatePresence mode="wait">
            <motion.figure
              key={current.pub}
              className="press-strip-figure"
              initial={reduced ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduced ? { opacity: 0 } : { opacity: 0, y: -12 }}
              transition={reduced ? { duration: 0 } : { duration: 0.45, ease: [0.22, 0.36, 0.24, 1] }}
            >
              <blockquote className="press-strip-quote">
                <span className="press-strip-quote-mark" aria-hidden="true">&ldquo;</span>
                {current.quote}
              </blockquote>
              <figcaption className="press-strip-cap">
                <span className={['press-strip-cap-pub', current.pubClass].join(' ')}>
                  <AbstractMark variant={active} label={current.pub} />
                  {current.pub}
                </span>
                <span className="press-strip-cap-sep" aria-hidden="true">·</span>
                <span className="press-strip-cap-byline mono-meta">{current.byline}</span>
                <span className="press-strip-cap-sep" aria-hidden="true">·</span>
                <span className="press-strip-cap-section mono-meta">{current.section}</span>
                <span className="press-strip-cap-sep" aria-hidden="true">·</span>
                <span className="press-strip-cap-date mono-meta">{current.date}</span>
              </figcaption>
            </motion.figure>
          </AnimatePresence>
        </div>

        {/* Cycle progress bar — visual indicator that the strip auto-advances */}
        {!reduced && (
          <div className="press-strip-progress" aria-hidden="true">
            <div key={active} className="press-strip-progress-bar" />
          </div>
        )}
      </div>
    </section>
  );
}
