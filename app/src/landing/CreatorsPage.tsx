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

import { AudienceSwitch, CtaRow, Faq, Footer, FounderNote, MarketStrip, Nav, NotYet, PrintFan, Promises, Reel, StickyCta } from './components';
import { CREATOR_MARKET } from './market';
import { CREATOR_SETUP, DEMO_HREF, PLATFORM_FEE_LABEL, SAMPLE_STOREFRONT_HREF, SIGNUP_HREF } from './facts';
import { CREATOR_DEAL } from './cards-creators';
import { DealStory } from './productCards';
import { BriefBrowser, PayoutTool, RateHelper, StorefrontBuilder, StorefrontJoin, useStorefront } from './tools-creators';

const JOIN = { href: SIGNUP_HREF.creator, label: 'Join free' };
const DEMO = { href: DEMO_HREF.creator, label: 'or try the live demo, no sign-up' };

const SECTIONS = [{ href: '#to-found', label: 'Storefront' }, { href: '#to-deals', label: 'Deals' }, { href: '#to-money', label: 'Money' }, { href: '#to-pricing', label: 'Pricing' }, { href: '#to-faq', label: 'Questions' }];

export function CreatorsPage() {
  const sf = useStorefront();
  return (
    <div className="lx" data-surface="v2">
      <Nav audience="creators" sections={SECTIONS} />
      <main className="lx-creators">
        <section className="lx-hero lx-dark" aria-labelledby="hero-title">
          <div className="lx-wrap">
            <AudienceSwitch audience="creators" />
            <h1 className="lx-h1" id="hero-title"><span className="lx-line"><span>Find brand deals.</span></span> <span className="lx-line"><span>Run them here.</span></span></h1>
            <div className="lx-hero-grid">
              <div className="lx-hero-side">
                <p className="lx-lead">
                  Pitch open briefs at your own rate, or let brands find your storefront. Offers, changes and
                  payouts stay in one workspace.
                </p>
                <CtaRow primary={{ ...JOIN, id: 'hero-signup' }} secondary={{ ...DEMO, id: 'hero-demo' }} />
                <Promises items={['Free to join', 'No follower minimum', 'No exclusivity']} />
              </div>
              <BriefBrowser />
            </div>
          </div>
        </section>

        <MarketStrip title="Where brand deals are going" figures={CREATOR_MARKET} />

        <Reel />

        <i className="lx-anchor" id="to-found" />
        <section className="lx-sheet lx-field-peach" id="found" data-sheet aria-labelledby="found-title">
          <div className="lx-wrap">
            <div className="lx-split">
              <h2 className="lx-h2" id="found-title">Let brands come to you.</h2>
              <p className="lx-lead">
                Your storefront is a public page with your work, channels and packages. Brands see your prices
                before they message you, and brief you from it. Try yours.
              </p>
            </div>
            <div className="lx-found-grid">
              <StorefrontBuilder sf={sf} />
              <div className="lx-found-side">
                <RateHelper sf={sf} />
                <StorefrontJoin sf={sf} />
                <a className="lx-link lx-cta-link" href={SAMPLE_STOREFRONT_HREF} data-cta="found-storefront">See a live storefront</a>
              </div>
            </div>
          </div>
        </section>

        <i className="lx-anchor" id="to-deals" />
        <DealStory
          id="workspace"
          title="Deals out of your DMs."
          lead="Offers, counters, paid changes and reviews stay on the deal, next to your inbox, calendar and wallet."
          before="In your DMs"
          screen={CREATOR_DEAL}
          steps={[
            ['Every brand asks your rate, and you start from zero each time.', 'Your packages and prices are on your storefront before the first message.'],
            ['What you agreed is somewhere far up the chat.', 'Every offer and counter stays on the deal, with the agreed one marked.'],
            ['“Could you add one more Story?” arrives after the price is set.', 'Extra deliverables are paid changes. Nothing applies until you accept it.'],
            ['You send an invoice, then you chase it.', 'The money is held when the brand accepts, and released as each post goes live.'],
            ['Good feedback disappears with the thread.', 'Brands review you when the deal is done, and you pin the best to your storefront.'],
          ]}
        />

        <i className="lx-anchor" id="to-money" />
        <section className="lx-sheet lx-paid lx-dark" id="paid" data-sheet aria-labelledby="paid-title">
          <div className="lx-wrap">
            <h2 className="lx-h2 one-line" id="paid-title">Money held before you start.</h2>
            <PayoutTool lead="The brand’s money is held in escrow from the day they accept, and released to you post by post." />
            <p className="lx-after-note">
              <b>Tap a post to mark it live.</b> If something goes wrong, open a dispute from the deal. The escrow freezes until you both agree on a split.
            </p>
          </div>
        </section>

        <i className="lx-anchor" id="to-pricing" />
        <section className="lx-sheet lx-field-sage" id="pricing" data-sheet aria-labelledby="pricing-title">
          <div className="lx-wrap lx-pricing">
            <div className="lx-pricing-main">
              <h2 className="lx-h2" id="pricing-title">Free to join.</h2>
              <p className="lx-money lx-fee-figure">{PLATFORM_FEE_LABEL}</p>
            </div>
            <div className="lx-pricing-side">
              <p className="lx-fee-line">
                of each payment, taken as it reaches you. Alamut is paid only when you are, and joining costs nothing.
                No subscription. Withdraw to your bank once you’ve finished the identity step and added your bank details.
              </p>
              <NotYet items={[
                'Pulling your follower numbers from Instagram or TikTok. Today they’re what you enter.',
                'Identity document checks. The identity step is self-completed during the beta.',
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
              { q: 'Do I need a big following?', a: 'No. There’s no follower minimum. Pitch the briefs that fit you.' },
              { q: 'Can I charge different brands different prices?', a: 'Yes. Your storefront shows your standard packages, and you can counter any offer a brand sends.' },
              { q: 'What does “payments are simulated” mean?', a: 'Alamut is in public beta, so no real money moves yet. Offers, escrow, releases and your wallet work the way they will later. The balances just aren’t real money.' },
              { q: 'What happens to the storefront I made on this page?', a: 'If you join from it, your name, handle, niche and rates fill in your setup. Until then they stay in this browser and are sent nowhere.' },
              { q: 'Do I have to take every deal through Alamut?', a: 'No. There’s no lock-in and no exclusivity. Take deals anywhere else too.' },
              { q: 'Can I try it first?', a: <>Yes. The <a className="lx-link" href={DEMO_HREF.creator} data-cta="faq-demo">demo account</a> is a full creator workspace with open briefs and sample deals, and needs no sign-up.</> },
            ]} />
          </div>
        </section>

        <FounderNote />

        <section className="lx-sheet lx-final lx-dark" aria-labelledby="final-title">
          <div className="lx-wrap">
            <h2 className="lx-h1 lx-final-title" id="final-title">Open your storefront.</h2>
            <div className="lx-final-row">
              <p className="lx-lead">Set your packages and pitch your first brief today. It’s free.</p>
              <CtaRow primary={{ ...JOIN, id: 'final-signup' }} secondary={{ ...DEMO, id: 'final-demo' }} />
            </div>
            <p className="lx-next">Setup after you join: {CREATOR_SETUP}.</p>
          </div>
          <PrintFan />
        </section>
      </main>
      <Footer audience="creators" />
      <StickyCta cta={{ ...JOIN, id: 'sticky-join' }} />
    </div>
  );
}
