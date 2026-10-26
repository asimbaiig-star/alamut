// BrandsPage.tsx — `/for-brands`, the brand landing.
//
// Leads with what a brand comes for — creators who want the work, at a price
// on the table — rather than "AI", the least real part of the product and the
// claim every competitor makes (LANDING-REVIEW.md §3). Then the workflow,
// then how payment works, then cost.

import { Beta, CtaRow, Faq, Feature, Footer, Icons, Nav, NotYet, Section } from './components';
import { DEMO_HREF, PLATFORM_FEE_LABEL, SIGNUP_HREF } from './facts';
import { LAPSE_LINE, PitchInbox } from './productCards';
import { BriefBuilder, HoldTool } from './tools';

const PRIMARY = { href: SIGNUP_HREF.brand, label: 'Post a brief — free' };
const DEMO = { href: DEMO_HREF.brand, label: 'Try the live demo' };

export function BrandsPage() {
  return (
    <div className="lx">
      <Nav audience="brands" />
      <main>
        <section className="lx-hero" aria-labelledby="hero-title">
          <div className="lx-wrap lx-hero-grid">
            <div className="lx-hero-copy">
              <p className="lx-kicker">For brands <span aria-hidden="true">·</span> <a href="/" data-cta="hero-audience">For creators</a></p>
              <h1 className="lx-h1" id="hero-title">Post a brief. Get pitches from creators who want it.</h1>
              <p className="lx-lead">
                Describe the campaign once — deliverables, timing, target rate. Creators apply with a pitch
                and their own rate, and you pick who to work with.
              </p>
              <CtaRow primary={{ ...PRIMARY, id: 'hero-post' }} secondary={{ ...DEMO, id: 'hero-demo' }} />
              <Beta />
            </div>
            <BriefBuilder />
          </div>
        </section>

        <section className="lx-section" id="pitches" aria-labelledby="pitches-title">
          <div className="lx-wrap lx-split">
            <div className="lx-section-head" style={{ marginBottom: 0 }}>
              <p className="lx-kicker">Briefs and pitches</p>
              <h2 className="lx-h2" id="pitches-title">Every pitch arrives with a price.</h2>
              <ul className="lx-list">
                <li>{Icons.check}<span>Each pitch carries the creator’s proposed rate. Accept it as is, counter, or pass.</span></li>
                <li>{Icons.check}<span>Shortlist the ones you like and decide when you’re ready.</span></li>
                <li>{Icons.check}<span>Or go to them: browse creators, check the packages on their storefront, and send an offer directly.</span></li>
              </ul>
              <p className="lx-body">{LAPSE_LINE}</p>
            </div>
            <PitchInbox />
          </div>
        </section>

        <Section id="deal" kicker="One place" title="Brief, negotiate, review and pay in one place.">
          <div className="lx-grid three">
            <Feature icon={Icons.doc} title="Briefs creators can quote">
              Deliverables per platform, timing and a target rate on one page, so pitches answer the real scope.
            </Feature>
            <Feature icon={Icons.swap} title="Offers and counters">
              Send offers, take counters, keep every round. Nothing is agreed until both sides accept.
            </Feature>
            <Feature icon={Icons.layers} title="Review rounds">
              Ask for revisions on each submission before you sign it off.
            </Feature>
            <Feature icon={Icons.eye} title="Changes as amendments">
              Need another deliverable or longer usage? Propose a paid change — it applies once the creator agrees.
            </Feature>
            <Feature icon={Icons.scale} title="Disputes without email chains">
              Freeze the escrow, propose a split, settle it inside the deal.
            </Feature>
            <Feature icon={Icons.users} title="Teams and deal owners">
              Give every deal an owner. Only admin and finance roles can top up the wallet.
            </Feature>
          </div>
          <CtaRow center={false} primary={{ ...PRIMARY, id: 'deal-post' }} secondary={{ ...DEMO, id: 'deal-demo' }} />
        </Section>

        <section className="lx-section" id="escrow" aria-labelledby="escrow-title">
          <div className="lx-wrap lx-split">
            <div className="lx-section-head" style={{ marginBottom: 0 }}>
              <p className="lx-kicker">Paying creators</p>
              <h2 className="lx-h2" id="escrow-title">Pay for posts that actually go live.</h2>
              <ol className="lx-list">
                <li><span className="lx-step-n">01</span><span>Accept an offer and the agreed rate is held in escrow.</span></li>
                <li><span className="lx-step-n">02</span><span>The creator posts and links it; you check that it’s live.</span></li>
                <li><span className="lx-step-n">03</span><span>Confirming releases that post’s share. The {PLATFORM_FEE_LABEL} fee comes out of the creator’s side, not yours.</span></li>
              </ol>
              <p className="lx-body">Every figure in your wallet traces to a ledger row you can open.</p>
            </div>
            <HoldTool />
          </div>
        </section>

        <section className="lx-section" aria-labelledby="pricing-title">
          <div className="lx-wrap lx-price">
            <div className="lx-section-head" style={{ marginBottom: 0 }}>
              <p className="lx-kicker">Pricing</p>
              <h2 className="lx-price-big" id="pricing-title">Free</h2>
              <p className="lx-lead">to post a brief and review every pitch.</p>
            </div>
            <ul className="lx-list">
              <li>{Icons.check}<span>You pay the rates you agree. The {PLATFORM_FEE_LABEL} platform fee comes out of the creator’s payout, not on top of your rate.</span></li>
              <li>{Icons.check}<span>Money is held only once you accept an offer, and released only as you confirm live posts.</span></li>
              <li>{Icons.check}<span>No subscription, no retainer, no minimum spend.</span></li>
            </ul>
          </div>
        </section>

        <section className="lx-section" aria-labelledby="faq-title">
          <div className="lx-wrap lx-two">
            <div className="lx-section-head" style={{ marginBottom: 0 }}>
              <p className="lx-kicker">Questions</p>
              <h2 className="lx-h2" id="faq-title">The honest answers.</h2>
              <NotYet items={[
                'Click tracking and revenue attribution — you see spend, deliverables and posts, not sales.',
                'Audience data pulled from the platforms — creator numbers are self-reported.',
                'Real money — payments are simulated in the public beta.',
              ]} />
            </div>
            <Faq items={[
              { q: 'What does it cost?', a: 'Posting is free. You pay the rates you agree with creators; the platform fee is deducted on the creator’s side.' },
              { q: 'Do creators find me, or do I find them?', a: 'Both. Post a brief and creators pitch you, or browse creators and send an offer directly.' },
              { q: 'Can I negotiate?', a: 'Yes. Counter any pitch or counter-offer; every round is kept on the deal, and nothing is agreed until both sides accept.' },
              { q: 'When does money leave my wallet?', a: 'When you accept an offer, the agreed rate moves into escrow. It reaches the creator post by post, as you confirm each one is live.' },
              { q: 'What if a post is off-brief or never goes live?', a: 'Ask for revisions, or open a dispute: the escrow freezes and either side can propose a split. Nothing releases without your confirmation or a settlement you agree to.' },
              { q: 'Is this live?', a: 'It’s a public beta. The whole flow works end to end; payments are simulated until real payment rails are connected.' },
            ]} />
          </div>
        </section>

        <section className="lx-section lx-final" aria-labelledby="final-title">
          <div className="lx-wrap">
            <h2 className="lx-h2" id="final-title">Post your first brief free.</h2>
            <p className="lx-lead">Pitches come to you. Money only moves when you accept an offer.</p>
            <CtaRow primary={{ ...PRIMARY, id: 'final-post' }} secondary={{ ...DEMO, id: 'final-demo' }} />
          </div>
        </section>
      </main>
      <Footer audience="brands" />
    </div>
  );
}
