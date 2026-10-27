// CreatorsPage.tsx — `/`, the creator landing.
//
// The portal's front door, in the portal's language (v2 tokens, Fraunces and
// Inter Tight, its tiles, storefront and wallet card). Every sentence is
// checkable against the code; figures come from facts.ts; what isn't live
// yet is said in the "Not live yet" list.
//
// The argument, in order: here are briefs you can pitch at your own price
// (and the hero lets you price one), brands can find you (and you can build
// the page they'd see, then keep it), the deal runs in one place, the money
// is held before you work, and what it costs. One action throughout: Join free.

import { AudienceSwitch, BetaLine, CtaRow, Faq, Footer, FounderNote, MarketStrip, Nav, NotYet, StickyCta } from './components';
import { CREATOR_MARKET } from './market';
import { DEMO_HREF, PLATFORM_FEE_LABEL, SAMPLE_STOREFRONT_HREF, SIGNUP_HREF, WHT_LABEL } from './facts';
import { Compare, CreatorDealWindow } from './productCards';
import { BriefBrowser, CreatorReceipt, PayoutTool, RateHelper, StorefrontBuilder, StorefrontJoin, useStorefront } from './tools-creators';
import { CREATOR_SETUP } from './facts';

const JOIN = { href: SIGNUP_HREF.creator, label: 'Join free' };
const DEMO = { href: DEMO_HREF.creator, label: 'or try the live demo, no sign-up' };

export function CreatorsPage() {
  const sf = useStorefront();
  return (
    <div className="lx" data-surface="v2">
      <Nav audience="creators" />
      <main>
        <section className="lx-hero" aria-labelledby="hero-title">
          <div className="lx-wrap">
            <div className="lx-panel lx-dark moss">
              <AudienceSwitch audience="creators" />
              <div className="lx-hero-top">
                <h1 className="lx-h1" id="hero-title"><span>Find brand deals.</span> <span>Run them here.</span></h1>
                <div className="lx-hero-side">
                  <p className="lx-lead">
                    Pitch open briefs at your own rate, or let brands find your storefront. Offers, changes and
                    payouts stay in one workspace.
                  </p>
                  <CtaRow primary={{ ...JOIN, id: 'hero-signup' }} secondary={{ ...DEMO, id: 'hero-demo' }} />
                  <BetaLine prefix="Free, with no follower minimum." />
                </div>
              </div>
              <BriefBrowser />
            </div>
          </div>
        </section>

        <MarketStrip title="Where brand deals are going" figures={CREATOR_MARKET} />

        <section className="lx-section lx-field-peach" id="found" aria-labelledby="found-title">
          <div className="lx-wrap lx-found">
            <div className="lx-head">
              <h2 className="lx-h2" id="found-title">Let brands come to you.</h2>
              <p className="lx-lead">
                Your storefront is a public page with your work, channels and packages. Brands see your prices
                before they message you, and brief you from it. Try yours.
              </p>
              <RateHelper sf={sf} />
              <StorefrontJoin sf={sf} />
              <a className="lx-link lx-cta-link" href={SAMPLE_STOREFRONT_HREF} data-cta="found-storefront">See a live storefront</a>
            </div>
            <StorefrontBuilder sf={sf} />
          </div>
        </section>

        <section className="lx-section lx-band lx-dark" id="workspace" aria-labelledby="workspace-title">
          <div className="lx-wrap">
            <div className="lx-head">
              <h2 className="lx-h2" id="workspace-title">Deals out of your DMs.</h2>
              <p className="lx-lead">
                Offers, counters, paid changes and reviews stay on the deal, next to your inbox, calendar and wallet.
              </p>
            </div>
            <CreatorDealWindow />
            <Compare caption="Brand deals in your DMs, and on Alamut" before="In your DMs" rows={[
              ['Every brand asks your rate, and you start from zero each time.', 'Your packages and prices are on your storefront before the first message.'],
              ['What you agreed is somewhere far up the chat.', 'Every offer and counter stays on the deal, with the agreed one marked.'],
              ['“Could you add one more Story?” arrives after the price is set.', 'Extra deliverables are paid changes. Nothing applies until you accept it.'],
              ['You send an invoice, then you chase it.', 'The money is held when the brand accepts, and released as each post goes live.'],
              ['Good feedback disappears with the thread.', 'Brands review you when the deal is done, and you pin the best to your storefront.'],
            ]} />
          </div>
        </section>

        <section className="lx-section" id="paid" aria-labelledby="paid-title">
          <div className="lx-wrap">
            <div className="lx-head">
              <h2 className="lx-h2" id="paid-title">Money held before you start.</h2>
              <p className="lx-lead">The brand’s money is held in escrow from the day they accept, and released to you post by post.</p>
            </div>
            <PayoutTool />
            <p className="lx-after-note">
              <b>If something goes wrong</b>, open a dispute from the deal. The escrow freezes until you both agree on a split.
            </p>
          </div>
        </section>

        <section className="lx-section lx-field-sage" id="pricing" aria-labelledby="pricing-title">
          <div className="lx-wrap lx-pricing">
            <div className="lx-pricing-main">
              <h2 className="lx-h2" id="pricing-title">Free to join.</h2>
              <p className="lx-lead">Alamut is paid only when you are. The fee comes off a payment as it reaches you, never before.</p>
              <CreatorReceipt rate={1000} />
            </div>
            <div className="lx-pricing-side">
              <ul className="lx-terms">
                <li>When a deal pays out, a {PLATFORM_FEE_LABEL} platform fee and {WHT_LABEL} withholding come off each payment, each as its own line in your wallet.</li>
                <li>Withdraw to your bank once you’ve completed the identity step and added your bank details.</li>
                <li>Money tied to an open dispute stays in escrow until it’s settled.</li>
                <li>No subscription and no lock-in. Take deals anywhere else too.</li>
              </ul>
              <NotYet items={[
                'Pulling your follower numbers from Instagram or TikTok. Today they’re what you enter.',
                'Identity document checks. The identity step is self-completed during the beta.',
                'Real money. Payments are simulated in the public beta.',
              ]} />
            </div>
          </div>
        </section>

        <section className="lx-section" id="faq" aria-labelledby="faq-title">
          <div className="lx-wrap">
            <div className="lx-head"><h2 className="lx-h2" id="faq-title">Questions</h2></div>
            <Faq items={[
              { q: 'How do I find brand deals?', a: 'Browse open briefs in the app. Search by brand, category or platform, filter by budget, save the ones you like, and apply with a pitch and your own rate.' },
              { q: 'How do brands find me?', a: 'Through your storefront, a public page with your work, channels and packages. Brands browse creators by platform, category, followers, city and price, and can brief you from your page.' },
              { q: 'What does it cost?', a: `Nothing to join or apply. When a deal pays out, a ${PLATFORM_FEE_LABEL} platform fee and ${WHT_LABEL} withholding come off each payment, shown as separate lines in your wallet.` },
              { q: 'Do I need a big following?', a: 'No. There’s no follower minimum. You apply to the briefs that fit you.' },
              { q: 'When do I get paid?', a: 'Post by post. The full amount is held in escrow when the brand accepts, and each post’s share is released when it’s live and the brand confirms it.' },
              { q: 'What happens to the storefront I made on this page?', a: 'If you join from it, your name, handle, niche and rates fill in your setup. Until then they stay in this browser and are sent nowhere.' },
              { q: 'Do I have to take every deal through Alamut?', a: 'No. There’s no lock-in and no exclusivity. Take deals anywhere else too.' },
              { q: 'Can I try it first?', a: <>Yes. The <a className="lx-link" href={DEMO_HREF.creator} data-cta="faq-demo">demo account</a> is a full creator workspace with open briefs and sample deals, and needs no sign-up.</> },
            ]} />
          </div>
        </section>

        <FounderNote />

        <section className="lx-final lx-dark" aria-labelledby="final-title">
          <div className="lx-wrap lx-final-grid">
            <h2 className="lx-h2" id="final-title">Open your storefront.</h2>
            <div className="lx-hero-side">
              <p className="lx-lead">Set your packages and pitch your first brief today. It’s free.</p>
              <CtaRow primary={{ ...JOIN, id: 'final-signup' }} secondary={{ ...DEMO, id: 'final-demo' }} />
              <p className="lx-next">Setup after you join: {CREATOR_SETUP}.</p>
            </div>
          </div>
        </section>
      </main>
      <Footer audience="creators" />
      <StickyCta cta={{ ...JOIN, id: 'sticky-join' }} />
    </div>
  );
}
