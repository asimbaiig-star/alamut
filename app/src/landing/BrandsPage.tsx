// BrandsPage.tsx — `/for-brands`, the brand landing.
//
// The portal's front door for brands, in the portal's language. Leads with
// discovery both ways (the hero lets you price a creator's package), then
// writing a brief you can keep, then the workspace, then paying for live
// posts (escrow), then cost. One action throughout: Post a brief.
// Not "AI": the least real part of the product and the claim every
// competitor makes (LANDING-REVIEW.md §3).

import { AudienceSwitch, BetaLine, CtaRow, Faq, Footer, MarketStrip, Nav, NotYet, StickyCta } from './components';
import { BRAND_MARKET } from './market';
import { DEMO_HREF, PLATFORM_FEE_LABEL, SIGNUP_HREF } from './facts';
import { BrandNeedsWindow, Compare, LAPSE_LINE, PitchInbox } from './productCards';
import { BrandReceipt, BriefBuilder, CreatorBrowser, HoldTool } from './tools-brands';
import { BRAND_SETUP } from './facts';

const POST = { href: SIGNUP_HREF.brand, label: 'Post a brief' };
const DEMO = { href: DEMO_HREF.brand, label: 'or try the live demo, no sign-up' };

export function BrandsPage() {
  return (
    <div className="lx" data-surface="v2">
      <Nav audience="brands" />
      <main>
        <section className="lx-hero" aria-labelledby="hero-title">
          <div className="lx-wrap">
            <div className="lx-panel lx-dark ink">
              <AudienceSwitch audience="brands" />
              <div className="lx-hero-top">
                <h1 className="lx-h1" id="hero-title"><span>Find creators.</span> <span>Run the deal here.</span></h1>
                <div className="lx-hero-side">
                  <p className="lx-lead">
                    Browse storefronts with published rates, or post a brief and let creators pitch you. Brief to
                    payout stays in one workspace.
                  </p>
                  <CtaRow primary={{ ...POST, id: 'hero-post' }} secondary={{ ...DEMO, id: 'hero-demo' }} />
                  <BetaLine prefix="Free to post, with no subscription or minimum spend." />
                </div>
              </div>
              <CreatorBrowser />
            </div>
          </div>
        </section>

        <MarketStrip title="Where creator marketing is going" figures={BRAND_MARKET} />

        <section className="lx-section lx-field-peach" id="pitches" aria-labelledby="pitches-title">
          <div className="lx-wrap">
            <div className="lx-head">
              <h2 className="lx-h2" id="pitches-title">Post a brief, get pitched.</h2>
              <p className="lx-lead">
                Describe the deliverables and your target rate once. Creators who want the work pitch you with
                their own price.
              </p>
            </div>
            <div className="lx-pitch">
              <BriefBuilder />
              <div className="lx-hero-side">
                <PitchInbox />
                <p className="lx-note">{LAPSE_LINE}</p>
              </div>
            </div>
          </div>
        </section>

        <section className="lx-section lx-band lx-dark" id="workspace" aria-labelledby="workspace-title">
          <div className="lx-wrap">
            <div className="lx-head">
              <h2 className="lx-h2" id="workspace-title">Every deal on one list.</h2>
              <p className="lx-lead">
                Offers, review rounds, paid changes, disputes and payouts live on the deal, and whatever is
                waiting on you is in one place.
              </p>
            </div>
            <BrandNeedsWindow />
            <Compare caption="Creator deals in email and spreadsheets, and on Alamut" before="In email and spreadsheets" rows={[
              ['Rate cards arrive one creator at a time, as attachments.', 'Packages and prices are on every storefront. Filter by price before you reach out.'],
              ['Approvals and extra asks live in long email threads.', 'Review rounds and paid changes sit on the deal, and apply once the creator agrees.'],
              ['You pay an invoice before you know the post is up.', 'Money is held when you accept, and released only as you confirm each post is live.'],
              ['Who owes what lives in a spreadsheet someone updates.', 'Every figure in your wallet traces to a ledger row you can open.'],
              ['A deal belongs to whoever happened to send the first email.', 'Every deal has an owner, and only admin and finance roles can top up the wallet.'],
            ]} />
          </div>
        </section>

        <section className="lx-section" id="escrow" aria-labelledby="escrow-title">
          <div className="lx-wrap">
            <div className="lx-head">
              <h2 className="lx-h2" id="escrow-title">Pay for posts that go live.</h2>
              <p className="lx-lead">The agreed rate is held in escrow when you accept an offer, and released as you confirm each post.</p>
            </div>
            <HoldTool />
            <p className="lx-after-note">
              <b>The creator links each post</b>, you check it’s live, and only then is its share released. If a post is
              off-brief or never goes up, open a dispute: the escrow freezes until you agree on a split.
            </p>
          </div>
        </section>

        <section className="lx-section lx-field-sage" id="pricing" aria-labelledby="pricing-title">
          <div className="lx-wrap lx-pricing">
            <div className="lx-pricing-main">
              <h2 className="lx-h2" id="pricing-title">Free to post.</h2>
              <p className="lx-lead">You pay the rates you agree, and nothing on top. Money moves only when you accept an offer.</p>
              <BrandReceipt rate={1500} />
            </div>
            <div className="lx-pricing-side">
              <ul className="lx-terms">
                <li>You pay the rates you agree. The {PLATFORM_FEE_LABEL} platform fee comes out of the creator’s payout, not on top of your rate.</li>
                <li>Money is held only once you accept an offer, and released as you confirm live posts.</li>
                <li>Every figure in your wallet traces to a ledger row you can open.</li>
                <li>No subscription, no retainer and no minimum spend.</li>
              </ul>
              <NotYet items={[
                'Click tracking and revenue attribution. You see spend, deliverables and posts, not sales.',
                'Audience data pulled from the platforms. Creator numbers are self-reported.',
                'Real money. Payments are simulated in the public beta.',
              ]} />
            </div>
          </div>
        </section>

        <section className="lx-section" id="faq" aria-labelledby="faq-title">
          <div className="lx-wrap">
            <div className="lx-head"><h2 className="lx-h2" id="faq-title">Questions</h2></div>
            <Faq items={[
              { q: 'How do I find creators?', a: 'Browse storefronts in the app and filter by platform, category, followers, city and price. Each storefront shows the creator’s work, channels and packages.' },
              { q: 'Or do creators come to me?', a: 'Both. Post a brief and creators pitch you with their own rate. Shortlist, accept, counter or pass.' },
              { q: 'What does it cost?', a: 'Posting is free. You pay the rates you agree with creators, and the platform fee is deducted on the creator’s side.' },
              { q: 'When does money leave my wallet?', a: 'When you accept an offer, the agreed rate moves into escrow. It reaches the creator post by post, as you confirm each one is live.' },
              { q: 'What if a post is off-brief or never goes live?', a: 'Ask for revisions, or open a dispute. The escrow freezes and either side can propose a split. Nothing releases without your confirmation or a settlement you agree to.' },
              { q: 'What happens to the brief I write on this page?', a: 'If you post it from here, it’s waiting in New campaign when you sign up, filled in. Until then it stays in this browser and is sent nowhere.' },
              { q: 'Can my team work on the same deals?', a: 'Yes. Every deal has an owner, so it’s clear who answers the creator, and only admin and finance roles can top up the wallet.' },
              { q: 'Can I try it first?', a: <>Yes. The <a className="lx-link" href={DEMO_HREF.brand} data-cta="faq-demo">demo account</a> is a full brand workspace with creators to browse and sample campaigns, and needs no sign-up.</> },
            ]} />
          </div>
        </section>

        <section className="lx-final lx-dark" aria-labelledby="final-title">
          <div className="lx-wrap lx-final-grid">
            <h2 className="lx-h2" id="final-title">Post your first brief.</h2>
            <div className="lx-hero-side">
              <p className="lx-lead">It’s free, and money only moves when you accept an offer.</p>
              <CtaRow primary={{ ...POST, id: 'final-post' }} secondary={{ ...DEMO, id: 'final-demo' }} />
              <p className="lx-next">Setup after you sign up: {BRAND_SETUP}.</p>
            </div>
          </div>
        </section>
      </main>
      <Footer audience="brands" />
      <StickyCta cta={{ ...POST, id: 'sticky-post' }} />
    </div>
  );
}
