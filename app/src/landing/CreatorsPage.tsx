// CreatorsPage.tsx — `/`, the creator landing.
//
// Every sentence here is checkable against the code (LANDING-REVIEW.md lists
// what the previous page claimed and wasn't). Figures come from facts.ts;
// anything not live yet is said plainly in the "Not live yet" list rather
// than implied.
//
// The order follows a creator's questions: will brands find me, do I keep
// control, will I get paid, what does it cost. Escrow answers the third.

import { AudienceSwitch, CtaRow, Faq, Footer, Nav, NotYet, Photo } from './components';
import { BETA_LINE, DEMO_HREF, PLATFORM_FEE_LABEL, SIGNUP_HREF, WHT_LABEL } from './facts';
import { PHOTOS } from './photos';
import { OfferThread, WaysIn } from './productCards';
import { PayoutTool, StorefrontBuilder } from './tools';

const PRIMARY = { href: SIGNUP_HREF.creator, label: 'Create your storefront' };
const DEMO = { href: DEMO_HREF.creator, label: 'Try the live demo' };

export function CreatorsPage() {
  return (
    <div className="lx">
      <Nav audience="creators" />
      <main>
        <section className="lx-hero" aria-labelledby="hero-title">
          <div className="lx-wrap">
            <h1 className="lx-h1" id="hero-title">Get booked at your rates.</h1>
            <div className="lx-stage">
              <div className="lx-stage-copy">
                <AudienceSwitch audience="creators" />
                <p className="lx-lead">
                  Put your work, channels and prices on one page. Brands brief you from it, and you can
                  pitch their briefs too.
                </p>
                <CtaRow primary={{ ...PRIMARY, id: 'hero-signup' }} secondary={{ ...DEMO, id: 'hero-demo' }} />
                <p className="lx-small">Free to join, with no follower minimum. {BETA_LINE}.</p>
              </div>
              <div className="lx-stage-photo">
                <Photo photo={PHOTOS.phoneOnTripod} ratio={4 / 5} sizes="(min-width: 980px) 40vw, 100vw" priority reveal={false} />
              </div>
              <div className="lx-stage-card"><StorefrontBuilder /></div>
            </div>
          </div>
        </section>

        <section className="lx-section lx-field-bg" id="booked" aria-labelledby="booked-title">
          <div className="lx-wrap">
            <div className="lx-head" data-reveal="">
              <h2 className="lx-h2" id="booked-title">Two ways to get booked.</h2>
            </div>
            <WaysIn />
            <div className="lx-after">
              <CtaRow primary={{ ...PRIMARY, id: 'booked-signup' }} secondary={{ ...DEMO, id: 'booked-demo' }} />
            </div>
          </div>
        </section>

        <section className="lx-section" id="terms" aria-labelledby="terms-title">
          <div className="lx-wrap">
            <div className="lx-head" data-reveal="">
              <h2 className="lx-h2" id="terms-title">You set the terms.</h2>
              <p className="lx-lead">One deal, from the first offer to the review.</p>
            </div>
            <OfferThread />
          </div>
        </section>

        <section className="lx-section lx-night" id="paid" aria-labelledby="paid-title">
          <div className="lx-wrap lx-pay">
            <div className="lx-pay-copy">
              <h2 className="lx-h2" id="paid-title" data-reveal="">Money held before you start.</h2>
              <Photo photo={PHOTOS.kitchenShoot} ratio={3 / 2} sizes="(min-width: 980px) 50vw, 100vw" />
              <div className="lx-steps">
                <div data-reveal=""><h3>When the brand accepts</h3><p>The full amount is held in escrow before you start work.</p></div>
                <div data-reveal=""><h3>When your post goes live</h3><p>The brand confirms it, and that post’s share is released to your wallet.</p></div>
                <div data-reveal=""><h3>If something goes wrong</h3><p>Open a dispute. The escrow freezes until you both agree on a split.</p></div>
              </div>
            </div>
            <div className="lx-pay-statement" data-reveal=""><PayoutTool /></div>
          </div>
        </section>

        <section className="lx-section" id="pricing" aria-labelledby="pricing-title">
          <div className="lx-wrap lx-pricing">
            <div data-reveal="">
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
            <div className="lx-head" data-reveal="">
              <h2 className="lx-h2" id="faq-title">Questions</h2>
            </div>
            <Faq items={[
              { q: 'What does it cost?', a: `Nothing to join or apply. When a deal pays out, a ${PLATFORM_FEE_LABEL} platform fee and ${WHT_LABEL} withholding come off each payment, shown as separate lines in your wallet.` },
              { q: 'How do brands find me?', a: 'Two ways. You pitch their briefs, or they find your storefront, a public page with your work, channels and packages, and brief you from it.' },
              { q: 'Do I need a big following?', a: 'No. There’s no follower minimum. You apply to the briefs that fit you.' },
              { q: 'When do I get paid?', a: 'Post by post. The full amount is held in escrow when the brand accepts, and each post’s share is released when it’s live and the brand confirms it.' },
              { q: 'What if the brand never confirms?', a: 'Open a dispute. The escrow freezes, either side can propose how to split it, and nothing moves until you both agree.' },
              { q: 'Can I try it first?', a: <>Yes. The <a className="lx-link" href={DEMO_HREF.creator} data-cta="faq-demo">demo account</a> is a full creator workspace with sample deals. Payments are simulated during the public beta.</> },
            ]} />
          </div>
        </section>

        <section className="lx-final" aria-labelledby="final-title">
          <div className="lx-wrap lx-final-grid">
            <h2 className="lx-h2" id="final-title" data-reveal="">Open your storefront.</h2>
            <div className="lx-final-copy">
              <p className="lx-lead">Add your packages and pitch your first brief today. It’s free.</p>
              <CtaRow primary={{ ...PRIMARY, id: 'final-signup' }} secondary={{ ...DEMO, id: 'final-demo' }} />
            </div>
          </div>
        </section>
      </main>
      <Footer audience="creators" />
    </div>
  );
}
