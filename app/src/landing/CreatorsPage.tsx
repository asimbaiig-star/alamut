// CreatorsPage.tsx — `/`, the creator landing.
//
// Every sentence here is checkable against the code (LANDING-REVIEW.md lists
// what the previous page claimed and wasn't). Figures come from facts.ts;
// anything not live yet is said plainly in the "Not live yet" list rather
// than implied.
//
// The page leads with discovery, both ways: find campaigns, get found. Then
// running the deal, then getting paid (escrow), then cost.

import { AudienceSwitch, CtaRow, Faq, Footer, Nav, NotYet, Photo } from './components';
import { BETA_LINE, DEMO_HREF, PLATFORM_FEE_LABEL, SAMPLE_STOREFRONT_HREF, SIGNUP_HREF, WHT_LABEL } from './facts';
import { PHOTOS } from './photos';
import { OfferThread } from './productCards';
import { BriefBoard, PayoutTool, StorefrontBuilder } from './tools';

const PRIMARY = { href: SIGNUP_HREF.creator, label: 'Create your storefront' };
const DEMO = { href: DEMO_HREF.creator, label: 'Browse briefs in the demo' };

export function CreatorsPage() {
  return (
    <div className="lx">
      <div className="lx-top"><Nav audience="creators" /></div>
      <main>
        <section className="lx-hero lx-top" aria-labelledby="hero-title">
          <div className="lx-wrap">
            <h1 className="lx-h1" id="hero-title"><span>Find campaigns.</span> <span>Get found by brands.</span></h1>
            <div className="lx-hero-body">
              <div className="lx-hero-side">
                <AudienceSwitch audience="creators" />
                <p className="lx-lead">
                  The marketplace for brand deals, and the place you run them. Browse open briefs, or let brands
                  find your storefront.
                </p>
                <CtaRow primary={{ ...PRIMARY, id: 'hero-signup' }} secondary={{ ...DEMO, id: 'hero-demo' }} />
                <p className="lx-small">Free to join, with no follower minimum. {BETA_LINE}.</p>
                <Photo photo={PHOTOS.phoneOnTripod} ratio={9 / 16} sizes="(min-width: 1024px) 260px, 0px" priority className="lx-reel" />
              </div>
              <BriefBoard />
            </div>
          </div>
        </section>

        <section className="lx-section" id="found" aria-labelledby="found-title">
          <div className="lx-wrap">
            <div className="lx-head">
              <h2 className="lx-h2" id="found-title">One page brands can brief you from.</h2>
            </div>
            <div className="lx-found">
              <div className="lx-found-copy">
                <p className="lx-lead">
                  Your storefront puts your work, channels and packages on one public page. Brands see your prices
                  before they reach out, and can brief you or send an offer from it.
                </p>
                <a className="lx-link" href={SAMPLE_STOREFRONT_HREF} data-cta="found-storefront">See a live storefront</a>
              </div>
              <div className="lx-found-stage">
                <Photo photo={PHOTOS.ringLight} ratio={4 / 5} sizes="(min-width: 1024px) 40vw, 100vw" />
                <div className="lx-found-card"><StorefrontBuilder /></div>
              </div>
            </div>
          </div>
        </section>

        <section className="lx-section lx-field-bg" id="terms" aria-labelledby="terms-title">
          <div className="lx-wrap">
            <div className="lx-head">
              <h2 className="lx-h2" id="terms-title">Run every deal in one place.</h2>
              <p className="lx-lead">From the first offer to the review, every round, change and payment stays on the deal.</p>
            </div>
            <OfferThread />
            <div className="lx-after">
              <CtaRow primary={{ ...PRIMARY, id: 'terms-signup' }} secondary={{ ...DEMO, id: 'terms-demo' }} />
            </div>
          </div>
        </section>

        <section className="lx-section lx-night" id="paid" aria-labelledby="paid-title">
          <div className="lx-wrap lx-pay">
            <div className="lx-pay-copy">
              <h2 className="lx-h2" id="paid-title">Money held before you start.</h2>
              <Photo photo={PHOTOS.kitchenShoot} ratio={3 / 2} sizes="(min-width: 980px) 50vw, 100vw" />
              <div className="lx-steps">
                <div><h3>When the brand accepts</h3><p>The full amount is held in escrow before you start work.</p></div>
                <div><h3>When your post goes live</h3><p>The brand confirms it, and that post’s share is released to your wallet.</p></div>
                <div><h3>If something goes wrong</h3><p>Open a dispute. The escrow freezes until you both agree on a split.</p></div>
              </div>
            </div>
            <div className="lx-pay-statement"><PayoutTool /></div>
          </div>
        </section>

        <section className="lx-section" id="pricing" aria-labelledby="pricing-title">
          <div className="lx-wrap lx-pricing">
            <div>
              <h2 className="lx-h2" id="pricing-title">Free to join.</h2>
              <p className="lx-lead">
                When a deal pays out, a {PLATFORM_FEE_LABEL} platform fee and {WHT_LABEL} withholding come off each
                payment. Each one shows as its own line in your wallet.
              </p>
              <ul className="lx-terms">
                <li>Withdraw to your bank once you’ve completed the identity step and added your bank details.</li>
                <li>Money tied to an open dispute stays in escrow until it’s settled.</li>
                <li>No subscription and no lock-in. Take deals anywhere else too.</li>
              </ul>
            </div>
            <NotYet items={[
              'Pulling your follower numbers from Instagram or TikTok. Today they’re what you enter.',
              'Identity document checks. The identity step is self-completed during the beta.',
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
              { q: 'How do I find campaigns?', a: 'Browse open briefs in the app. Search by brand, category or platform, filter by budget, save the ones you like, and apply with a pitch and your own rate.' },
              { q: 'How do brands find me?', a: 'Through your storefront, a public page with your work, channels and packages. Brands browse creators by platform, category, followers, city and price, and can brief you from your page.' },
              { q: 'What does it cost?', a: `Nothing to join or apply. When a deal pays out, a ${PLATFORM_FEE_LABEL} platform fee and ${WHT_LABEL} withholding come off each payment, shown as separate lines in your wallet.` },
              { q: 'Do I need a big following?', a: 'No. There’s no follower minimum. You apply to the briefs that fit you.' },
              { q: 'When do I get paid?', a: 'Post by post. The full amount is held in escrow when the brand accepts, and each post’s share is released when it’s live and the brand confirms it.' },
              { q: 'Can I try it first?', a: <>Yes. The <a className="lx-link" href={DEMO_HREF.creator} data-cta="faq-demo">demo account</a> is a full creator workspace with open briefs and sample deals. Payments are simulated during the public beta.</> },
            ]} />
          </div>
        </section>

        <section className="lx-final" aria-labelledby="final-title">
          <div className="lx-wrap lx-final-grid">
            <h2 className="lx-h2" id="final-title">Find your first campaign.</h2>
            <div className="lx-final-copy">
              <p className="lx-lead">Make your storefront, then browse open briefs. It’s free.</p>
              <CtaRow primary={{ ...PRIMARY, id: 'final-signup' }} secondary={{ ...DEMO, id: 'final-demo' }} />
            </div>
          </div>
        </section>
      </main>
      <Footer audience="creators" />
    </div>
  );
}
