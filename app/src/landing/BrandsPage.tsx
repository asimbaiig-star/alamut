// BrandsPage.tsx — `/for-brands`, the brand landing.
//
// The portal's front door for brands, in the portal's language. Leads with
// discovery both ways (the hero lets you price a creator's package), then
// writing a brief you can keep, then the workspace, then paying for live
// posts (escrow), then cost. One action throughout: Post a brief.
// Not "AI": the least real part of the product and the claim every
// competitor makes (LANDING-REVIEW.md §3).

import { AudienceSwitch, CtaRow, Faq, Footer, FounderNote, MarketStrip, Nav, NotYet, PrintFan, Promises, Reel, StickyCta } from './components';
import { BRAND_MARKET } from './market';
import { BRAND_SETUP, DEMO_HREF, SIGNUP_HREF } from './facts';
import { brandEstimate, usd } from './estimate';
import { BRAND_DEAL, LAPSE_LINE, PitchInbox } from './cards-brands';
import { DealStory } from './productCards';
import { BriefBuilder, CreatorBrowser, HoldTool } from './tools-brands';

const POST = { href: SIGNUP_HREF.brand, label: 'Post a brief' };
const DEMO = { href: DEMO_HREF.brand, label: 'or try the live demo, no sign-up' };

const SECTIONS = [{ href: '#to-brief', label: 'Briefs' }, { href: '#to-deals', label: 'Deals' }, { href: '#to-money', label: 'Money' }, { href: '#to-pricing', label: 'Pricing' }, { href: '#to-faq', label: 'Questions' }];

export function BrandsPage() {
  return (
    <div className="lx" data-surface="v2">
      <Nav audience="brands" sections={SECTIONS} />
      <main className="lx-brands">
        <section className="lx-hero lx-dark" aria-labelledby="hero-title">
          <div className="lx-wrap">
            <AudienceSwitch audience="brands" />
            <h1 className="lx-h1" id="hero-title"><span className="lx-line"><span>Find creators.</span></span> <span className="lx-line"><span>Run the deal here.</span></span></h1>
            <div className="lx-hero-grid">
              <div className="lx-hero-side">
                <p className="lx-lead">
                  Browse storefronts with published rates, or post a brief and let creators pitch you. Brief to
                  payout stays in one workspace.
                </p>
                <CtaRow primary={{ ...POST, id: 'hero-post' }} secondary={{ ...DEMO, id: 'hero-demo' }} />
                <Promises items={['Free to post', 'No subscription', 'No minimum spend']} />
              </div>
              <CreatorBrowser />
            </div>
          </div>
        </section>

        <MarketStrip title="Where creator marketing is going" figures={BRAND_MARKET} />

        <Reel />

        <i className="lx-anchor" id="to-brief" />
        <section className="lx-sheet lx-field-peach" id="pitches" data-sheet aria-labelledby="pitches-title">
          <div className="lx-wrap">
            <div className="lx-split">
              <h2 className="lx-h2" id="pitches-title">Post a brief, get pitched.</h2>
              <p className="lx-lead">
                Describe the deliverables and your target rate once. Creators who want the work pitch you with
                their own price.
              </p>
            </div>
            <div className="lx-pitch">
              <BriefBuilder />
              <div className="lx-pitch-side">
                <PitchInbox />
                <p className="lx-note">{LAPSE_LINE}</p>
              </div>
            </div>
          </div>
        </section>

        <i className="lx-anchor" id="to-deals" />
        <DealStory
          id="workspace"
          title="Every deal on one list."
          lead="Offers, review rounds, paid changes, disputes and payouts live on the deal, and whatever is waiting on you is in one place."
          before="In email and spreadsheets"
          screen={BRAND_DEAL}
          steps={[
            ['Rate cards arrive one creator at a time, as attachments.', 'Packages and prices are on every storefront. Filter by price before you reach out.'],
            ['Approvals and extra asks live in long email threads.', 'Review rounds and paid changes sit on the deal, and apply once the creator agrees.'],
            ['You pay an invoice before you know the post is up.', 'Money is held when you accept, and released only as you confirm each post is live.'],
            ['Who owes what lives in a spreadsheet someone updates.', 'Every figure in your wallet traces to a ledger row you can open.'],
            ['A deal belongs to whoever happened to send the first email.', 'Every deal has an owner, and only admin and finance roles can top up the wallet.'],
          ]}
        />

        <i className="lx-anchor" id="to-money" />
        <section className="lx-sheet lx-paid lx-dark" id="escrow" data-sheet aria-labelledby="escrow-title">
          <div className="lx-wrap">
            <h2 className="lx-h2 one-line" id="escrow-title">Pay for posts that go live.</h2>
            <HoldTool lead="The agreed rate is held in escrow when you accept an offer, and released as you confirm each post." />
            <p className="lx-after-note">
              <b>Tap a post to confirm it.</b> The creator links each post, you check it’s live, and only then is its share
              released. If a post is off-brief or never goes up, open a dispute: the escrow freezes until you agree on a split.
            </p>
          </div>
        </section>

        <i className="lx-anchor" id="to-pricing" />
        <section className="lx-sheet lx-field-sage" id="pricing" data-sheet aria-labelledby="pricing-title">
          <div className="lx-wrap lx-pricing">
            <div className="lx-pricing-main">
              <h2 className="lx-h2" id="pricing-title">Free to post.</h2>
              <p className="lx-money lx-fee-figure">{usd(brandEstimate(1000, 1, 1).brandFee)}</p>
            </div>
            <div className="lx-pricing-side">
              <p className="lx-fee-line">
                platform fee on top of the rates you agree. Money moves only when you accept an offer.
                No subscription, no retainer and no minimum spend.
              </p>
              <NotYet items={[
                'Click tracking and revenue attribution. You see spend, deliverables and posts, not sales.',
                'Audience data pulled from the platforms. Creator numbers are self-reported.',
                'Real money. Payments are simulated in the public beta.',
              ]} />
            </div>
          </div>
        </section>

        <i className="lx-anchor" id="to-faq" />
        <section className="lx-sheet lx-faq" id="faq" data-sheet aria-labelledby="faq-title">
          <div className="lx-wrap lx-faq-grid">
            <h2 className="lx-h2 md" id="faq-title">Questions</h2>
            <Faq items={[
              { q: 'Are creators’ numbers verified?', a: 'Not yet. Follower counts and engagement are what creators enter, so look at their work before you brief them. Pulling numbers straight from the platforms isn’t live yet.' },
              { q: 'What does “payments are simulated” mean?', a: 'Alamut is in public beta, so no real money moves yet. Your wallet, escrow and releases work the way they will later. The balances just aren’t real money.' },
              { q: 'What if a post is off-brief or never goes live?', a: 'Ask for revisions, or open a dispute. The escrow freezes and either side can propose a split. Nothing releases without your confirmation or a settlement you agree to.' },
              { q: 'What happens to the brief I write on this page?', a: 'If you post it from here, it’s waiting in New campaign when you sign up, filled in. Until then it stays in this browser and is sent nowhere.' },
              { q: 'Can my team work on the same deals?', a: 'Yes. Every deal has an owner, so it’s clear who answers the creator, and only admin and finance roles can top up the wallet.' },
              { q: 'Can I try it first?', a: <>Yes. The <a className="lx-link" href={DEMO_HREF.brand} data-cta="faq-demo">demo account</a> is a full brand workspace with creators to browse and sample campaigns, and needs no sign-up.</> },
            ]} />
          </div>
        </section>

        <FounderNote />

        <section className="lx-sheet lx-final lx-dark" aria-labelledby="final-title">
          <div className="lx-wrap">
            <h2 className="lx-h1 lx-final-title" id="final-title">Post your first brief.</h2>
            <div className="lx-final-row">
              <p className="lx-lead">It’s free, and money only moves when you accept an offer.</p>
              <CtaRow primary={{ ...POST, id: 'final-post' }} secondary={{ ...DEMO, id: 'final-demo' }} />
            </div>
            <p className="lx-next">Setup after you sign up: {BRAND_SETUP}.</p>
          </div>
          <PrintFan />
        </section>
      </main>
      <Footer audience="brands" />
      <StickyCta cta={{ ...POST, id: 'sticky-post' }} />
    </div>
  );
}
