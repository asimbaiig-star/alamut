// BrandsPage.tsx — `/for-brands`, the brand landing.
//
// Leads with discovery, both ways: find creators, get pitched. Not "AI",
// the least real part of the product and the claim every competitor makes
// (LANDING-REVIEW.md §3). Then running the deal, then paying for live
// posts (escrow), then cost.

import { AudienceSwitch, CtaRow, Faq, Footer, Nav, NotYet, Photo } from './components';
import { BETA_LINE, DEMO_HREF, PLATFORM_FEE_LABEL, SIGNUP_HREF } from './facts';
import { PHOTOS } from './photos';
import { DealStages, LAPSE_LINE, PitchInbox } from './productCards';
import { BriefBuilder, CreatorBoard, HoldTool } from './tools';

const PRIMARY = { href: SIGNUP_HREF.brand, label: 'Post a brief, free' };
const DEMO = { href: DEMO_HREF.brand, label: 'Browse creators in the demo' };
const HALF = '(min-width: 760px) 50vw, 100vw';

export function BrandsPage() {
  return (
    <div className="lx">
      <div className="lx-top"><Nav audience="brands" /></div>
      <main>
        <section className="lx-hero lx-top" aria-labelledby="hero-title">
          <div className="lx-wrap">
            <h1 className="lx-h1" id="hero-title"><span>Find creators.</span> <span>Get pitched.</span></h1>
            <div className="lx-hero-body">
              <div className="lx-hero-side">
                <AudienceSwitch audience="brands" />
                <p className="lx-lead">
                  Browse storefronts with published rates, or post a brief and let creators pitch you. Then run the
                  whole deal here.
                </p>
                <CtaRow primary={{ ...PRIMARY, id: 'hero-post' }} secondary={{ ...DEMO, id: 'hero-demo' }} />
                <p className="lx-small">No subscription or minimum spend. {BETA_LINE}.</p>
                <Photo photo={PHOTOS.boxHandover} ratio={9 / 16} sizes="(min-width: 1024px) 260px, 0px" priority className="lx-reel" />
              </div>
              <CreatorBoard />
            </div>
          </div>
        </section>

        <section className="lx-section" id="pitches" aria-labelledby="pitches-title">
          <div className="lx-wrap lx-pitched">
            <div className="lx-pitched-col">
              <h2 className="lx-h2" id="pitches-title">Write the brief once.</h2>
              <p className="lx-lead">
                Describe the campaign once. Creators who want the work pitch you with their own rate, and you
                choose who to hire.
              </p>
              <BriefBuilder />
            </div>
            <div className="lx-pitched-col">
              <PitchInbox />
              <p className="lx-note">{LAPSE_LINE}</p>
            </div>
          </div>
        </section>

        <section className="lx-section lx-field-bg" id="deal" aria-labelledby="deal-title">
          <div className="lx-wrap">
            <div className="lx-head">
              <h2 className="lx-h2" id="deal-title">Run every deal in one place.</h2>
              <p className="lx-lead">From brief to posted, every offer, revision and payment stays on the deal.</p>
            </div>
            <div className="lx-photos-2">
              <Photo photo={PHOTOS.productSet} ratio={3 / 2} sizes={HALF} />
              <Photo photo={PHOTOS.editTimeline} ratio={3 / 2} sizes={HALF} />
            </div>
            <DealStages />
            <div className="lx-extras">
              <div><h3 className="lx-h3">Teams and deal owners</h3><p>Give every deal an owner. Only admin and finance roles can top up the wallet.</p></div>
              <div><h3 className="lx-h3">Changes as amendments</h3><p>Need another deliverable or longer usage? Propose a paid change. It applies once the creator agrees.</p></div>
              <div><h3 className="lx-h3">Disputes inside the deal</h3><p>Freeze the escrow, propose a split and settle it where the work happened.</p></div>
            </div>
            <div className="lx-after">
              <CtaRow primary={{ ...PRIMARY, id: 'deal-post' }} secondary={{ ...DEMO, id: 'deal-demo' }} />
            </div>
          </div>
        </section>

        <section className="lx-section lx-night" id="escrow" aria-labelledby="escrow-title">
          <div className="lx-wrap lx-pay">
            <div className="lx-pay-copy">
              <h2 className="lx-h2" id="escrow-title">Pay for posts that go live.</h2>
              <div className="lx-steps">
                <div><h3>When you accept an offer</h3><p>The agreed rate is held in escrow.</p></div>
                <div><h3>When the post is up</h3><p>The creator links it, and you check that it’s live.</p></div>
                <div><h3>When you confirm it</h3><p>That post’s share is released. The {PLATFORM_FEE_LABEL} fee comes out of the creator’s side, not yours.</p></div>
              </div>
            </div>
            <div className="lx-pay-statement"><HoldTool /></div>
          </div>
        </section>

        <section className="lx-section" id="pricing" aria-labelledby="pricing-title">
          <div className="lx-wrap lx-pricing">
            <div>
              <h2 className="lx-h2" id="pricing-title">Free to post.</h2>
              <p className="lx-lead">
                You pay the rates you agree. The {PLATFORM_FEE_LABEL} platform fee comes out of the creator’s payout,
                not on top of your rate.
              </p>
              <ul className="lx-terms">
                <li>Money is held only once you accept an offer, and released as you confirm live posts.</li>
                <li>Every figure in your wallet traces to a ledger row you can open.</li>
                <li>No subscription, no retainer and no minimum spend.</li>
              </ul>
            </div>
            <NotYet items={[
              'Click tracking and revenue attribution. You see spend, deliverables and posts, not sales.',
              'Audience data pulled from the platforms. Creator numbers are self-reported.',
              'Real money. Payments are simulated in the public beta.',
            ]} />
          </div>
        </section>

        <section className="lx-section lx-field-bg" id="faq" aria-labelledby="faq-title">
          <div className="lx-wrap">
            <div className="lx-head">
              <h2 className="lx-h2" id="faq-title">Questions</h2>
            </div>
            <Faq items={[
              { q: 'How do I find creators?', a: 'Browse storefronts in the app and filter by platform, category, followers, city and price. Each storefront shows the creator’s work, channels and packages.' },
              { q: 'Or do creators come to me?', a: 'Both. Post a brief and creators pitch you with their own rate. Shortlist, accept, counter or pass.' },
              { q: 'What does it cost?', a: 'Posting is free. You pay the rates you agree with creators, and the platform fee is deducted on the creator’s side.' },
              { q: 'When does money leave my wallet?', a: 'When you accept an offer, the agreed rate moves into escrow. It reaches the creator post by post, as you confirm each one is live.' },
              { q: 'What if a post is off-brief or never goes live?', a: 'Ask for revisions, or open a dispute. The escrow freezes and either side can propose a split. Nothing releases without your confirmation or a settlement you agree to.' },
              { q: 'Can I try it first?', a: <>Yes. The <a className="lx-link" href={DEMO_HREF.brand} data-cta="faq-demo">demo account</a> is a full brand workspace with creators to browse and sample campaigns. Payments are simulated during the public beta.</> },
            ]} />
          </div>
        </section>

        <section className="lx-final" aria-labelledby="final-title">
          <div className="lx-wrap lx-final-grid">
            <h2 className="lx-h2" id="final-title">Find your first creator.</h2>
            <div className="lx-final-copy">
              <p className="lx-lead">Post a brief or browse storefronts. It’s free, and money only moves when you accept an offer.</p>
              <CtaRow primary={{ ...PRIMARY, id: 'final-post' }} secondary={{ ...DEMO, id: 'final-demo' }} />
            </div>
          </div>
        </section>
      </main>
      <Footer audience="brands" />
    </div>
  );
}
