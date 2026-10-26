// CreatorsPage.tsx — `/`, the creator landing.
//
// Every sentence here is checkable against the code (LANDING-REVIEW.md lists
// what the previous page claimed and wasn't). Figures come from facts.ts;
// anything not live yet is said plainly in the "Not live yet" block rather
// than implied.
//
// Order is the creator's order of questions: will brands find me, do I keep
// control, will I get paid, what does it cost. Escrow is the answer to the
// third, not the headline.

import { Beta, CtaRow, Faq, Feature, Footer, Icons, Nav, NotYet, Section } from './components';
import { DEMO_HREF, PLATFORM_FEE_LABEL, SIGNUP_HREF, WHT_LABEL } from './facts';
import { WaysIn } from './productCards';
import { PayoutTool, StorefrontBuilder } from './tools';

const PRIMARY = { href: SIGNUP_HREF.creator, label: 'Create your storefront — free' };
const DEMO = { href: DEMO_HREF.creator, label: 'Try the live demo' };

export function CreatorsPage() {
  return (
    <div className="lx">
      <Nav audience="creators" />
      <main>
        <section className="lx-hero" aria-labelledby="hero-title">
          <div className="lx-wrap lx-hero-grid">
            <div className="lx-hero-copy">
              <p className="lx-kicker">For creators <span aria-hidden="true">·</span> <a href="/for-brands" data-cta="hero-audience">For brands</a></p>
              <h1 className="lx-h1" id="hero-title">Get booked by brands — at your rates.</h1>
              <p className="lx-lead">
                Build a storefront with your work, channels and packages. Apply to briefs, or let brands
                find your page and send you an offer.
              </p>
              <CtaRow primary={{ ...PRIMARY, id: 'hero-signup' }} secondary={{ ...DEMO, id: 'hero-demo' }} />
              <Beta />
            </div>
            <StorefrontBuilder />
          </div>
        </section>

        <Section id="booked" kicker="Getting booked" title="Two ways in. Both start with your rate.">
          <WaysIn />
          <CtaRow center={false} primary={{ ...PRIMARY, id: 'booked-signup' }} secondary={{ ...DEMO, id: 'booked-demo' }} />
        </Section>

        <Section id="control" kicker="Your terms" title="Your rates. Your terms. Your call.">
          <div className="lx-grid">
            <Feature icon={Icons.tag} title="Rates you set">
              Packages per platform — Reels, posts, stories, long-form. Brands see them before they make an offer.
            </Feature>
            <Feature icon={Icons.swap} title="Counter anything">
              Accept, counter or decline every offer. Each round is kept, so nobody argues about what was agreed.
            </Feature>
            <Feature icon={Icons.layers} title="Changes need your yes">
              Adding a deliverable or extending usage after the deal is a paid change you accept or decline.
            </Feature>
            <Feature icon={Icons.chat} title="Reviews you can feature">
              Brands review you after a deal. Pin the best ones to your storefront.
            </Feature>
          </div>
        </Section>

        <section className="lx-section" id="paid" aria-labelledby="paid-title">
          <div className="lx-wrap lx-split">
            <div className="lx-section-head" style={{ marginBottom: 0 }}>
              <p className="lx-kicker">Getting paid</p>
              <h2 className="lx-h2" id="paid-title">The money is held before you start.</h2>
              <ol className="lx-list">
                <li><span className="lx-step-n">01</span><span>When a brand accepts, the full amount is held in escrow.</span></li>
                <li><span className="lx-step-n">02</span><span>Each post’s share is released when it’s live and the brand confirms it.</span></li>
                <li><span className="lx-step-n">03</span><span>If something goes wrong, open a dispute: the escrow freezes and either side can propose a split.</span></li>
              </ol>
            </div>
            <PayoutTool />
          </div>
        </section>

        <section className="lx-section" aria-labelledby="pricing-title">
          <div className="lx-wrap lx-price">
            <div className="lx-section-head" style={{ marginBottom: 0 }}>
              <p className="lx-kicker">Pricing</p>
              <h2 className="lx-price-big" id="pricing-title">Free</h2>
              <p className="lx-lead">to join, to build your storefront and to apply to briefs.</p>
            </div>
            <ul className="lx-list">
              <li>{Icons.check}<span>When you’re paid, a {PLATFORM_FEE_LABEL} platform fee and {WHT_LABEL} withholding come out of each payout — each as its own line.</span></li>
              <li>{Icons.check}<span>Withdraw to your bank once you’ve completed the identity step and added your bank details.</span></li>
              <li>{Icons.check}<span>Money tied to an open dispute stays in escrow until it’s settled.</span></li>
              <li>{Icons.check}<span>No subscription and no lock-in — take deals anywhere else too.</span></li>
            </ul>
          </div>
        </section>

        <section className="lx-section" aria-labelledby="faq-title">
          <div className="lx-wrap lx-two">
            <div className="lx-section-head" style={{ marginBottom: 0 }}>
              <p className="lx-kicker">Questions</p>
              <h2 className="lx-h2" id="faq-title">The honest answers.</h2>
              <NotYet items={[
                'Pulling your follower numbers from Instagram or TikTok — today they’re what you enter.',
                'Identity document checks — the identity step is self-completed during the beta.',
                'Real money — payments are simulated in the public beta.',
              ]} />
            </div>
            <Faq items={[
              { q: 'What does it cost?', a: `Nothing to join or apply. When a deal pays out, a ${PLATFORM_FEE_LABEL} platform fee and ${WHT_LABEL} withholding come out of each payment, shown as separate lines in your wallet.` },
              { q: 'How do brands find me?', a: 'Two ways: you apply to their briefs, or they find your storefront — a public page with your work, channels and packages — and brief you or send an offer from it.' },
              { q: 'Do I need a big following?', a: 'No. There’s no follower minimum — you apply to the briefs that fit you.' },
              { q: 'When do I get paid?', a: 'Post by post. The full amount is held in escrow when the brand accepts; each post’s share is released when it’s live and the brand confirms it.' },
              { q: 'What if the brand never confirms?', a: 'Open a dispute. The escrow freezes, either side can propose how to split it, and nothing moves until you both agree.' },
              { q: 'Is this live?', a: 'It’s a public beta. The whole flow works end to end; payments are simulated until real payment rails are connected.' },
            ]} />
          </div>
        </section>

        <section className="lx-section lx-final" aria-labelledby="final-title">
          <div className="lx-wrap">
            <h2 className="lx-h2" id="final-title">Set your rates. Get booked.</h2>
            <p className="lx-lead">Make your storefront, add your packages and apply to your first brief.</p>
            <CtaRow primary={{ ...PRIMARY, id: 'final-signup' }} secondary={{ ...DEMO, id: 'final-demo' }} />
          </div>
        </section>
      </main>
      <Footer audience="creators" />
    </div>
  );
}
