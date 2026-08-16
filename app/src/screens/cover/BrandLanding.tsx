// BrandLanding · Phase 54 rebuild
//
// Driven by the brand-side PRD (Upfluence-inspired). Distinct USP
// architecture: SPEED + AI MATCHING + ZERO GUESSWORK + CONTROL/AUTO.
// No shared persona-aware components; every section is brand-specific.
//
// Sections (in order):
//   1. BrandHero — "AI-driven campaigns without compromise"
//   2. BrandTrustBar — real seed brand wordmarks (logo cloud)
//   3. BrandSpeed — 10× / 2× / 20h+ with pictograms
//   4. BrandAIEngine — "Beyond follower count" + audience-fit illustration
//   5. BrandControl — "Hands-on or hands-off" toggle illustration
//   6. BrandCaseStudy — anchor case with real seed numbers (ROAS-clamped)
//   7. BrandLogoMarquee — auto-scroll wordmarks (visual interest)
//   8. BrandPricing — flat 5%, no retainer
//   9. BrandFAQ — 8 brand-buying-objection questions
//  10. BrandFinalCTA — closing prompt
//
// All visuals are inline SVG components from @/components/illustrations.
// All numbers (case study, outcomes) come from real seeded data.

import { Link } from 'react-router-dom';
import { useEffect, useMemo } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { useStore } from '@/lib/api/store';
import { getAcceptedCreators } from '@/lib/api/relations';
import { useAuth } from '@/lib/auth/useAuth';
import { fmtMoneyFull, fmtCount } from '@/lib/utils/format';
import { Logo } from '@/components/ui/Logo';
import { Pill } from '@/components/ui/Pill';
import {
  AIEngineGraphic,
  ControlAutoToggle,
  FastLaunch,
  SmartFilter,
  TimeSaved,
} from '@/components/illustrations/Illustrations';
import { BrandProductMock } from '@/components/illustrations/ProductMocks';
import { BrandWordmark } from '@/components/illustrations/BrandWordmarks';
import { PressStrip } from '@/components/illustrations/PressStrip';
import { PersonaPalette } from './scenes/PersonaPalette';
import type { Campaign, Brand, Creator } from '@/lib/api/types';

import '@/styles/cinematic.css';

// =====================================================================
// Hooks · live metrics + a case study from the seed
// =====================================================================

interface CaseStudyData {
  campaign: Campaign;
  brand: Brand;
  creator: Creator;
  totalPaid: number;
  applicantCount: number;
  daysToClose: number;
  reach: number;
  deliverableCount: number;
}

function useCaseStudy(): CaseStudyData | null {
  const db = useStore((s) => s.db);
  return useMemo(() => {
    // Pick on things we actually hold: a finished campaign, real
    // acceptances, enough applicants to be worth showing. The old filter
    // also clamped candidates by a ROAS ratio derived from
    // `tracking[].revenueAttributed` — choosing which case study to show
    // by a number the product cannot produce.
    const candidates = db.campaigns
      .filter((c) => {
        // "Ready for case study" = closed, or live and far enough along
        // that money has moved.
        if (c.stage !== 'closed' && c.stage !== 'live') return false;
        if (getAcceptedCreators(c.id, db).length === 0) return false;
        if (c.applications.length < 5) return false;
        // Money actually moved — the one financial condition that means
        // something without attribution data.
        if (c.spent <= 0) return false;
        return true;
      })
      .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));

    for (const cmp of candidates) {
      const brand = db.brands.find((b) => b.id === cmp.brandId);
      const creatorId = getAcceptedCreators(cmp.id, db)[0];
      const creator = db.creators.find((c) => c.id === creatorId);
      if (!brand || !creator) continue;

      const payouts = db.transactions.filter(
        (t) => t.campaignId === cmp.id
          && t.kind === 'payout'
          && t.status === 'cleared'
          && t.amount > 0,
      );
      if (payouts.length === 0) continue;
      const totalPaid = payouts.reduce((s, t) => s + t.amount, 0);

      const applicantCount = db.applications.filter((a) => a.campaignId === cmp.id).length;

      const firstPayout = payouts.sort((a, b) => +new Date(a.at) - +new Date(b.at))[0];
      const daysToClose = Math.max(
        1,
        Math.round((+new Date(firstPayout.at) - +new Date(cmp.createdAt)) / 86_400_000),
      );

      const reach = cmp.reach ?? creator.reach;
      // `tracking[].revenueAttributed` is seeded data for a feature that
      // does not exist, so nothing derived from it can appear on a page
      // that presents itself as a case study.
      const deliverableCount = db.deliverables.filter((d) => d.campaignId === cmp.id).length;

      return { campaign: cmp, brand, creator, totalPaid, applicantCount, daysToClose, reach, deliverableCount };
    }
    return null;
  }, [db]);
}

// =====================================================================
// Top-level page
// =====================================================================

export function BrandLanding() {
  const reduced = useReducedMotion();
  const { user, isCreator, isBrand } = useAuth();
  const continueHref = isCreator ? '/creator/today' : isBrand ? '/brand/today' : '/admin/home';

  // Force persona=brand on this URL so the underlying app palette /
  // CSS-cascade reflects the right tone for this page.
  useEffect(() => {
    try { localStorage.setItem('alamut.persona', 'brand'); } catch { /* no-op */ }
  }, []);

  // SEO meta — different from the creator-side default.
  useEffect(() => {
    const prevTitle = document.title;
    document.title = 'For brands · Alamut · AI-driven creator campaigns';
    return () => { document.title = prevTitle; };
  }, []);

  return (
    <PersonaPalette>
      <div data-surface="landing-light" className="lp-light-root brand-landing">
        <header className="brand-landing-topnav">
          <div className="brand-landing-topnav-inner">
            <Link to="/" aria-label="Alamut home" className="airy-topnav-logo">
              <Logo size={20} tag="ALAMUT" />
            </Link>
            <nav className="cn-topnav-links" aria-label="Sections">
              <a href="#speed">Speed</a>
              <a href="#ai">AI matching</a>
              <a href="#case">Case study</a>
              <a href="#pricing">Pricing</a>
            </nav>
            <div className="cn-topnav-actions lp-topnav-actions-v2">
              <Link to="/" className="lp-topnav-segment">
                I&apos;m a creator <span aria-hidden="true">→</span>
              </Link>
              {user ? (
                <Link to={continueHref} className="cn-topnav-cta">
                  Continue <span aria-hidden="true">→</span>
                </Link>
              ) : (
                <>
                  <Link to="/signin" className="lp-topnav-signin">
                    Sign in
                  </Link>
                  <Link to="/signup?role=brand" className="cn-topnav-cta">
                    Get started <span aria-hidden="true">→</span>
                  </Link>
                </>
              )}
            </div>
          </div>
        </header>

        <BrandHero reduced={reduced} />
        <BrandTrustBar />
        <BrandSpeed reduced={reduced} />
        <BrandAIEngine reduced={reduced} />
        <BrandEditorialBreak />
        <BrandControl reduced={reduced} />
        <BrandCaseStudy />
        <PressStrip audience="brand" />
        <BrandLogoMarquee />
        <BrandPricing />
        <BrandFAQ />
        <BrandFinalCTA />

        <footer className="cn-footer">
          <div className="cn-footer-cols">
            <div className="cn-footer-col cn-footer-col-brand">
              <div className="cn-footer-logo">ALAMUT</div>
              <div className="cn-footer-tag">
                The brand-creator marketplace where AI matches qualified creators in hours, money clears through escrow, and every campaign leaves a public receipt.
              </div>
              <div className="cn-footer-cities">
                <span>Karachi</span><span>Lahore</span><span>Dubai</span>
              </div>
            </div>
            <div className="cn-footer-col">
              <div className="cn-footer-col-h">For brands</div>
              <ul className="cn-footer-links">
                <li><a href="#speed">Speed & scale</a></li>
                <li><a href="#ai">AI matching</a></li>
                <li><a href="#case">Case study</a></li>
                <li><Link to="/signup?role=brand">Post a brief</Link></li>
              </ul>
            </div>
            <div className="cn-footer-col">
              <div className="cn-footer-col-h">Tools</div>
              <ul className="cn-footer-links">
                <li><Link to="/creators">Top Creators</Link></li>
                <li><Link to="/tools/instagram-calculator">Instagram calculator</Link></li>
                <li><Link to="/tools/tiktok-calculator">TikTok calculator</Link></li>
                <li><Link to="/tools/youtube-calculator">YouTube calculator</Link></li>
              </ul>
            </div>
            <div className="cn-footer-col">
              <div className="cn-footer-col-h">Account</div>
              <ul className="cn-footer-links">
                <li><a href="mailto:hello@alamut.co">hello@alamut.co</a></li>
                <li><Link to="/">For creators</Link></li>
                <li><Link to="/signin">Sign in</Link></li>
              </ul>
            </div>
          </div>
          <div className="cn-footer-bottom">
            <span>© 2026 Alamut</span>
            <span className="cn-footer-bottom-meta">Always paid · always through escrow</span>
          </div>
        </footer>
      </div>
    </PersonaPalette>
  );
}

// =====================================================================
// Section 1 · Hero
// =====================================================================

function BrandHero({ reduced }: { reduced: boolean | null }) {
  const db = useStore((s) => s.db);
  const verifiedCreators = useMemo(
    () => db.creators.filter((c) => c.verified).length,
    [db.creators],
  );

  return (
    <section className="lp-hero brand-landing-hero brand-hero-v2">
      <div className="brand-hero-v2-inner">
        <div className="brand-hero-v2-text">
          <motion.div
            className="cn-h-eyebrow"
            initial={reduced ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={reduced ? { duration: 0 } : { duration: 0.5, delay: 0.05 }}
          >
            For brands & growth teams
          </motion.div>
          <motion.h1
            className="cn-h-display brand-hero-v2-h"
            initial={reduced ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={reduced ? { duration: 0 } : { duration: 0.72, delay: 0.20, ease: [0.22, 0.36, 0.24, 1] }}
          >
            AI-driven campaigns <span className="accent">without compromise</span>.
          </motion.h1>
          <motion.p
            className="cn-lede brand-hero-v2-sub"
            initial={reduced ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={reduced ? { duration: 0 } : { duration: 0.72, delay: 0.40, ease: [0.22, 0.36, 0.24, 1] }}
          >
            {fmtCount(verifiedCreators)}+ vetted creators. AI-powered matching. Zero guesswork. The fastest path from brief to campaign live — usually in a single afternoon.
          </motion.p>
          <motion.div
            className="brand-hero-v2-cta"
            initial={reduced ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={reduced ? { duration: 0 } : { duration: 0.72, delay: 0.60, ease: [0.22, 0.36, 0.24, 1] }}
          >
            <Link to="/signup?role=brand" className="cn-btn cn-btn-solid">
              Get started — free <span aria-hidden="true">→</span>
            </Link>
            <a href="#case" className="cn-btn cn-btn-ghost">
              See a case study <span aria-hidden="true">↓</span>
            </a>
          </motion.div>
          <motion.div
            className="brand-hero-v2-trust mono-meta"
            initial={reduced ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={reduced ? { duration: 0 } : { duration: 0.72, delay: 0.80 }}
          >
            $0 upfront · 5% on cleared deals · escrow on every campaign
          </motion.div>
        </div>
        <motion.div
          className="brand-hero-v2-illust-wrap"
          initial={reduced ? false : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reduced ? { duration: 0 } : { duration: 0.9, delay: 0.30, ease: [0.22, 0.36, 0.24, 1] }}
        >
          <BrandProductMock className="brand-hero-v2-illust" />
        </motion.div>
      </div>
    </section>
  );
}

// =====================================================================
// Section 2 · Trust bar — real seed brand names
// =====================================================================

function BrandTrustBar() {
  const db = useStore((s) => s.db);
  // Real recognizable wordmarks from seed; show 8.
  const featured = useMemo(
    () => ['Aesop', 'Le Creuset', 'Muji', 'Patagonia', 'Khaadi', 'Kinfolk', 'Glossier', 'Hay']
      .map((name) => db.brands.find((b) => b.name === name))
      .filter(Boolean) as Brand[],
    [db.brands],
  );

  return (
    <section className="brand-trust-v2">
      <div className="brand-trust-v2-inner">
        <div className="cn-h-eyebrow brand-trust-v2-eyebrow">Brands posting briefs through Alamut</div>
        <div className="brand-trust-v2-row">
          {featured.map((b) => (
            <BrandWordmark key={b.id} name={b.name} className="brand-trust-v2-mark" />
          ))}
        </div>
      </div>
    </section>
  );
}

// =====================================================================
// Section 3 · Speed & Scale
// =====================================================================

function BrandSpeed({ reduced }: { reduced: boolean | null }) {
  const stats = [
    { Icon: FastLaunch,  big: '10×', label: 'Scale faster',     body: 'Run more campaigns in the same week with the AI sourcing the shortlist for you.' },
    { Icon: SmartFilter, big: '2×',  label: 'Work smarter',     body: 'Audience-fit applications surface first; the rest auto-archive after 24 hours.' },
    { Icon: TimeSaved,   big: '20h+', label: 'Saved per week',   body: 'No DM threads, no spreadsheet syncs, no agency status calls. One tab does it all.' },
  ];
  return (
    <section id="speed" className="brand-speed-v2" aria-labelledby="brand-speed-h">
      <div className="brand-speed-v2-inner">
        <header className="brand-section-head-v2">
          <div className="cn-h-eyebrow">Speed & scale</div>
          <h2 id="brand-speed-h" className="cn-h-section">
            Campaigns that launch in <span className="accent">hours, not weeks</span>.
          </h2>
          <p className="cn-lede">
            From idea to execution in a single afternoon. One-click creator applications, real-time approvals, escrow on every accepted offer — your campaign is live before most teams finish their kickoff call.
          </p>
        </header>
        <div className="brand-speed-v2-grid">
          {stats.map((s, i) => (
            <motion.article
              key={s.label}
              className="brand-speed-v2-card"
              initial={reduced ? false : { opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.4 }}
              transition={reduced ? { duration: 0 } : { duration: 0.6, delay: i * 0.10, ease: [0.22, 0.36, 0.24, 1] }}
            >
              <s.Icon className="brand-speed-v2-icon" />
              <div className="brand-speed-v2-big">{s.big}</div>
              <div className="brand-speed-v2-label">{s.label}</div>
              <p className="brand-speed-v2-body">{s.body}</p>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}

// =====================================================================
// Section 4 · AI Engine
// =====================================================================

function BrandAIEngine({ reduced }: { reduced: boolean | null }) {
  const features = [
    {
      title: 'Audience demographics & engagement quality',
      body: 'Beyond follower count — we score age/region overlap with your existing customers, then weight engagement against bot signals.',
    },
    {
      title: 'Brand affinity & content patterns',
      body: 'The model reads each creator\'s last 60 posts for category, tone, and prior brand work — surfaces creators whose feed already speaks your language.',
    },
    {
      title: 'Auto-filtered applications',
      body: 'Set your hard filters once (region, language, follower band, vertical). Applications outside them never reach your inbox.',
    },
  ];
  return (
    <section id="ai" className="brand-ai-v2" aria-labelledby="brand-ai-h">
      <div className="brand-ai-v2-inner">
        <div className="brand-ai-v2-text">
          <div className="cn-h-eyebrow">AI matching</div>
          <h2 id="brand-ai-h" className="cn-h-section">
            Beyond <em>follower count</em>.
          </h2>
          <p className="cn-lede">
            Integrated AI that makes building your campaign seamless. Every application is pre-scored before it lands in your inbox.
          </p>
          <ul className="brand-ai-v2-features">
            {features.map((f, i) => (
              <motion.li
                key={f.title}
                initial={reduced ? false : { opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.4 }}
                transition={reduced ? { duration: 0 } : { duration: 0.5, delay: i * 0.08, ease: [0.22, 0.36, 0.24, 1] }}
              >
                <div className="brand-ai-v2-feat-bullet" aria-hidden="true">●</div>
                <div>
                  <div className="brand-ai-v2-feat-h">{f.title}</div>
                  <p className="brand-ai-v2-feat-body">{f.body}</p>
                </div>
              </motion.li>
            ))}
          </ul>
        </div>
        <motion.div
          className="brand-ai-v2-illust-wrap"
          initial={reduced ? false : { opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={reduced ? { duration: 0 } : { duration: 0.8, ease: [0.22, 0.36, 0.24, 1] }}
        >
          <AIEngineGraphic className="brand-ai-v2-illust" />
        </motion.div>
      </div>
    </section>
  );
}

// =====================================================================
// Section 4.5 · Editorial break — magazine-style pull quote
// =====================================================================
// Breaks the grid-of-cards rhythm with a full-bleed dark navy band,
// asymmetric layout, oversized serif italic quote, real brand voice
// pulled from the seed testimonials. The interruption is the point.

function BrandEditorialBreak() {
  const db = useStore((s) => s.db);
  const reduced = useReducedMotion();
  // The testimonial's campaignId may or may not have cleared payouts in
  // the seed (the testimonial fixtures reference real campaigns but not
  // necessarily ones with transactions). Decouple the aside metric: we
  // compute the largest cleared single deal across the whole platform
  // and feature THAT deal's brand + amount, regardless of which campaign
  // the testimonial speaker happens to mention. The quote is the
  // narrative; the metric is the platform-level proof.
  const voice = useMemo(() => {
    const t = (db.testimonials ?? []).find((x) => x.shownTo === 'creator');
    if (!t) return null;
    // Group cleared payouts by campaign, find the largest.
    const byCampaign = new Map<string, number>();
    for (const tx of db.transactions) {
      if (tx.kind !== 'payout' || tx.status !== 'cleared' || tx.amount <= 0) continue;
      if (!tx.campaignId) continue;
      byCampaign.set(tx.campaignId, (byCampaign.get(tx.campaignId) ?? 0) + tx.amount);
    }
    let topCampaignId: string | null = null;
    let topAmount = 0;
    for (const [cid, amt] of byCampaign) {
      if (amt > topAmount) { topAmount = amt; topCampaignId = cid; }
    }
    const topCampaign = topCampaignId ? db.campaigns.find((c) => c.id === topCampaignId) : null;
    const brand = topCampaign ? db.brands.find((b) => b.id === topCampaign.brandId) : undefined;
    return { t, brand, cleared: topAmount };
  }, [db]);

  if (!voice) return null;
  const { t, brand, cleared } = voice;

  return (
    <section className="brand-editorial" aria-label="Customer voice">
      <div className="brand-editorial-grain" aria-hidden="true" />
      <div className="brand-editorial-inner">
        <motion.figure
          className="brand-editorial-figure"
          initial={reduced ? false : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={reduced ? { duration: 0 } : { duration: 0.9, ease: [0.22, 0.36, 0.24, 1] }}
        >
          <div className="brand-editorial-mark-eyebrow">A growth-team voice</div>
          <blockquote className="brand-editorial-quote">
            <span className="brand-editorial-quote-mark" aria-hidden="true">&ldquo;</span>
            {t.quote}
          </blockquote>
          <figcaption className="brand-editorial-caption">
            {t.authorPortrait && (
              <img className="brand-editorial-portrait" src={t.authorPortrait} alt="" loading="lazy" decoding="async" />
            )}
            <div className="brand-editorial-attrib">
              <div className="brand-editorial-name">{t.authorName}</div>
              <div className="brand-editorial-sub">{t.authorSubtitle}</div>
            </div>
          </figcaption>
        </motion.figure>

        <motion.aside
          className="brand-editorial-aside"
          initial={reduced ? false : { opacity: 0, x: 20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={reduced ? { duration: 0 } : { duration: 0.9, delay: 0.10, ease: [0.22, 0.36, 0.24, 1] }}
        >
          <div className="brand-editorial-aside-eyebrow">Closed deal</div>
          {brand && (
            <div className="brand-editorial-aside-brand">
              <BrandWordmark name={brand.name} />
            </div>
          )}
          <div className="brand-editorial-aside-amount">{fmtMoneyFull(Math.round(cleared))}</div>
          <div className="brand-editorial-aside-meta">cleared via escrow</div>
        </motion.aside>
      </div>
    </section>
  );
}

// =====================================================================
// Section 5 · Control vs Automation
// =====================================================================

function BrandControl({ reduced }: { reduced: boolean | null }) {
  const modes = [
    {
      eyebrow: 'Hands-on mode',
      title: 'Set the filters · review every applicant.',
      bullets: [
        'You write the brief and pick the audience targets.',
        'Every application lands ranked, you approve or reject one by one.',
        'Counter-offer, negotiate, brief — all inside the same tab.',
      ],
    },
    {
      eyebrow: 'Auto mode',
      title: 'AI launches your campaign · you watch it run.',
      bullets: [
        'Brand criteria + brief → AI auto-accepts top-3 audience-fit creators.',
        'Escrow funds release on creator delivery — no manual approval gate.',
        'A daily digest of spend and delivery; you only step in if a flag fires.',
      ],
    },
  ];
  return (
    <section className="brand-control-v2" aria-labelledby="brand-control-h">
      <div className="brand-control-v2-inner">
        <header className="brand-section-head-v2">
          <div className="cn-h-eyebrow">Workflow</div>
          <h2 id="brand-control-h" className="cn-h-section">
            <em>Hands-on</em> or <span className="accent">fully automated</span>. You pick.
          </h2>
          <p className="cn-lede">
            Whether you&apos;re a hands-on strategist or a team-of-one needing to scale, the platform flexes around your headcount, not the other way around.
          </p>
        </header>

        <motion.div
          className="brand-control-v2-illust-wrap"
          initial={reduced ? false : { opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={reduced ? { duration: 0 } : { duration: 0.8, ease: [0.22, 0.36, 0.24, 1] }}
        >
          <ControlAutoToggle className="brand-control-v2-illust" />
        </motion.div>

        <div className="brand-control-v2-grid">
          {modes.map((m, i) => (
            <motion.article
              key={m.eyebrow}
              className="brand-control-v2-card"
              initial={reduced ? false : { opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={reduced ? { duration: 0 } : { duration: 0.6, delay: i * 0.10, ease: [0.22, 0.36, 0.24, 1] }}
            >
              <div className="cn-h-eyebrow brand-control-v2-card-eyebrow">{m.eyebrow}</div>
              <h3 className="brand-control-v2-card-h">{m.title}</h3>
              <ul className="brand-control-v2-card-list">
                {m.bullets.map((b) => <li key={b}>{b}</li>)}
              </ul>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}

// =====================================================================
// Section 6 · Case Study
// =====================================================================

function BrandCaseStudy() {
  const cs = useCaseStudy();
  if (!cs) {
    return (
      <section id="case" className="lp-section" aria-labelledby="brand-case-h">
        <header className="lp-section-head">
          <div className="cn-h-eyebrow">Case study</div>
          <h2 id="brand-case-h" className="cn-h-section">A real closed campaign · coming soon.</h2>
          <p className="cn-lede">As more campaigns close on the platform, we&apos;ll feature one here.</p>
        </header>
      </section>
    );
  }

  const { campaign, brand, totalPaid, applicantCount, daysToClose, reach, deliverableCount } = cs;

  return (
    <section id="case" className="brand-landing-case" aria-labelledby="brand-case-h">
      <div className="brand-landing-case-inner">
        <header className="brand-landing-section-head">
          <div className="cn-h-eyebrow">Case study</div>
          <h2 id="brand-case-h" className="cn-h-section">
            <em>{brand.name}</em> · {campaign.title}.
          </h2>
          <p className="cn-lede">
            How a {brand.industry?.split('/')[0].trim() || 'brand'} ran a {campaign.region}-focused campaign through Alamut — from brief to approved, paid deliverables, in {daysToClose} days.
          </p>
        </header>

        <div className="brand-landing-case-grid">
          <div className="brand-landing-case-stats">
            <div className="brand-landing-case-stat">
              <div className="brand-landing-case-stat-k mono-meta">Brief budget</div>
              <div className="brand-landing-case-stat-v">{fmtMoneyFull(campaign.budget)}</div>
            </div>
            <div className="brand-landing-case-stat">
              <div className="brand-landing-case-stat-k mono-meta">Applicants</div>
              <div className="brand-landing-case-stat-v">{applicantCount}</div>
            </div>
            <div className="brand-landing-case-stat">
              <div className="brand-landing-case-stat-k mono-meta">Days to close</div>
              <div className="brand-landing-case-stat-v">{daysToClose}</div>
            </div>
            <div className="brand-landing-case-stat">
              <div className="brand-landing-case-stat-k mono-meta">Total cleared</div>
              <div className="brand-landing-case-stat-v">{fmtMoneyFull(Math.round(totalPaid))}</div>
            </div>
            <div className="brand-landing-case-stat">
              <div className="brand-landing-case-stat-k mono-meta">Reach</div>
              <div className="brand-landing-case-stat-v">{fmtCount(reach)}</div>
            </div>
            {/* The ROAS tile that sat here was computed from
                `cmp.tracking[].revenueAttributed` — seeded numbers for a
                feature the product does not have. A headline multiple is
                the single most quotable figure on this page, so it was
                also the most damaging one to invent. Cost per deliverable
                divides two things we actually hold. */}
            <div className="brand-landing-case-stat">
              <div className="brand-landing-case-stat-k mono-meta">Cost per deliverable</div>
              <div className="brand-landing-case-stat-v">
                {deliverableCount > 0
                  ? fmtMoneyFull(Math.round(totalPaid / deliverableCount))
                  : <span className="brand-landing-case-stat-na">—</span>}
              </div>
            </div>
          </div>

          <aside className="brand-landing-case-narrative">
            <Pill tone="good">{campaign.stage === 'closed' ? 'Closed' : campaign.stage}</Pill>
            <p>
              <strong>{brand.name}</strong> posted a {campaign.region} brief for {campaign.category.toLowerCase()} creators. {applicantCount} applications came in, scored on niche fit, engagement, region and rate.
            </p>
            <p>
              Brief budget locked in escrow on the first accepted offer. {fmtMoneyFull(Math.round(totalPaid))} cleared to creators after the work was approved, each release itemised with the platform fee and withholding as their own rows.
            </p>
            <p className="brand-landing-case-narrative-pull">
              {fmtMoneyFull(Math.round(totalPaid))} cleared across {deliverableCount || 'the'} approved {deliverableCount === 1 ? 'deliverable' : 'deliverables'} in {daysToClose} days, on a {fmtMoneyFull(campaign.budget)} brief — without an agency in the loop.
            </p>
          </aside>
        </div>
      </div>
    </section>
  );
}

// =====================================================================
// Section 7 · Logo marquee — visual variety + brand authority
// =====================================================================

function BrandLogoMarquee() {
  const db = useStore((s) => s.db);
  const names = useMemo(
    () => db.brands.slice(0, 14).map((b) => b.name),
    [db.brands],
  );
  // Duplicate the list so the marquee can loop seamlessly via CSS keyframes.
  const looped = [...names, ...names];
  return (
    <section className="brand-marquee-v2" aria-label="Brand logo cloud">
      <div className="brand-marquee-v2-eyebrow cn-h-eyebrow">Trusted by category leaders</div>
      <div className="brand-marquee-v2-track" aria-hidden="true">
        {looped.map((name, i) => (
          <BrandWordmark key={`${name}-${i}`} name={name} className="brand-marquee-v2-mark" />
        ))}
      </div>
    </section>
  );
}

// =====================================================================
// Section 8 · Pricing
// =====================================================================

function BrandPricing() {
  return (
    <section id="pricing" className="lp-section brand-landing-pricing" aria-labelledby="brand-pricing-h">
      <header className="lp-section-head">
        <div className="cn-h-eyebrow">Pricing</div>
        <h2 id="brand-pricing-h" className="cn-h-section">
          Free to start. <span className="accent">Pay only</span> when a deal clears.
        </h2>
        <p className="cn-lede">
          No subscription. No setup fee. No retainer. We charge a flat 5% on the brief budget — deducted from the creator payout, never billed to your card.
        </p>
      </header>
      <div className="brand-landing-pricing-card lp-pricing-card">
        <div className="brand-landing-pricing-points">
          <div>
            <div className="brand-landing-pricing-v">$0</div>
            <div className="brand-landing-pricing-k mono-meta">To post a brief</div>
            <div className="brand-landing-pricing-d">Free forever. Post as many as you want.</div>
          </div>
          <div>
            <div className="brand-landing-pricing-v">5%</div>
            <div className="brand-landing-pricing-k mono-meta">On cleared deals</div>
            <div className="brand-landing-pricing-d">Deducted from creator payout, never your card.</div>
          </div>
          <div>
            <div className="brand-landing-pricing-v">0</div>
            <div className="brand-landing-pricing-k mono-meta">Retainer</div>
            <div className="brand-landing-pricing-d">No annual contract, no minimum spend.</div>
          </div>
        </div>
        <Link to="/signup?role=brand" className="cn-btn cn-btn-solid">
          Get started — free <span aria-hidden="true">→</span>
        </Link>
      </div>
    </section>
  );
}

// =====================================================================
// Section 9 · FAQ
// =====================================================================

const BRAND_FAQ: Array<{ q: string; a: string }> = [
  {
    q: 'How fast does a brief actually go live?',
    a: 'A brief is live the moment you post it. AI-matched creators see it within seconds — most briefs receive their first qualified application inside the first hour. There is no editorial review queue, no AM hand-off, and no scheduled drop window.',
  },
  {
    q: "What's the cost if no one applies, or if I don't accept anyone?",
    a: 'Zero. The 5% platform fee only applies to cleared deals. If a brief expires unfilled, or you decline every applicant, you pay nothing. There is no minimum spend, no setup fee, no monthly retainer.',
  },
  {
    q: 'How does this compare to a Net-30 / Net-60 agency invoice?',
    a: "It's the inverse. Brief budget locks in escrow the moment you accept an offer — funded on your card or via wire before the creator starts work. Agencies invoice you 30–60 days after delivery; we hold your funds 0 days after acceptance and only release on approval.",
  },
  {
    q: 'Are creators exclusive to Alamut?',
    a: "No. Creators on Alamut are independent professionals — they accept work from agencies, direct outreach, and other platforms. We don't lock them in, and we don't lock you in either. Per-brief contracting means you can run one campaign or one hundred without a master agreement.",
  },
  {
    q: 'Can I attribute revenue to a creator?',
    a: 'Not yet. Spend, deliverables, reach and engagement are in the dashboard and every figure traces to a row you can open, but there is no click tracking or revenue attribution today — so we would rather say so than show you a number we invented. Attribution is the next thing we are building.',
  },
  {
    q: 'What if a creator goes silent or delivers off-brief?',
    a: 'Escrow funds release on approval, not on time-elapsed. If a creator misses a deadline or delivers off-brief, you can request revisions or open a dispute — funds stay locked until you and the creator agree, or our mediation team rules. We have not had a brand lose escrow funds to creator non-delivery.',
  },
  {
    q: 'Can I run multiple campaigns or work with creators long-term?',
    a: 'Yes. Multi-campaign management is the default — one dashboard tracks every brief, every offer, every cleared deal. Long-term relationships are encouraged: re-book a creator with one click and the contracting / escrow flow re-runs automatically. No re-onboarding, no re-vetting.',
  },
  {
    q: 'Do you support whitelisting, paid amplification, and usage rights?',
    a: 'All three are configurable per brief. Usage rights (organic, paid, whitelisting) are surfaced as fields on the brief form — creators see them before they apply, so the rate they quote already reflects the rights you need. No back-and-forth contract redlines.',
  },
];

function BrandFAQ() {
  return (
    <section id="faq" className="lp-section lp-faq" aria-labelledby="brand-faq-h">
      <header className="lp-section-head">
        <div className="cn-h-eyebrow">FAQ</div>
        <h2 id="brand-faq-h" className="cn-h-section">
          Everything brands ask <span className="accent">before</span> posting a brief.
        </h2>
        <p className="cn-lede">
          Eight questions answered. If your situation isn&apos;t here, hello@alamut.co goes straight to a human.
        </p>
      </header>
      <div className="lp-faq-list">
        {BRAND_FAQ.map((item, i) => (
          <details key={i} className="lp-faq-item">
            <summary className="lp-faq-q">
              <span className="lp-faq-q-text">{item.q}</span>
              <svg className="lp-faq-q-glyph" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                <path d="M6 9l6 6l6 -6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </summary>
            <div className="lp-faq-a-wrap">
              <div className="lp-faq-a">{item.a}</div>
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}

// =====================================================================
// Section 10 · Final CTA
// =====================================================================

function BrandFinalCTA() {
  const db = useStore((s) => s.db);
  const stats = useMemo(() => {
    const totalPaid = db.transactions
      .filter((t) => t.kind === 'payout' && t.status === 'cleared' && t.amount > 0)
      .reduce((s, t) => s + t.amount, 0);
    const verifiedCreators = db.creators.filter((c) => c.verified).length;
    return { totalPaid, verifiedCreators };
  }, [db]);

  return (
    <section className="lp-section lp-final brand-landing-final" aria-labelledby="brand-final-h">
      <div className="lp-final-inner">
        <h2 id="brand-final-h" className="cn-h-display lp-final-h">
          Try a brief. <span className="accent">It costs nothing</span> until a deal clears.
        </h2>
        <p className="cn-lede lp-final-body">
          Two minutes to post. Replies usually start within the first hour. If nothing fits, the brief expires and you&apos;ve spent zero.
        </p>
        <div className="lp-final-cta">
          <Link to="/signup?role=brand" className="cn-btn cn-btn-solid">
            Get started — free <span aria-hidden="true">→</span>
          </Link>
          <a href="mailto:hello@alamut.co" className="cn-btn cn-btn-ghost">
            Talk to a human <span aria-hidden="true">→</span>
          </a>
        </div>

        {/* Phase 56f · Closing trust-stat band — fills the previously-
            empty lower portion of the section with real seed numbers
            that reinforce the value props one final time before the
            footer. Three live stats, hairline rules between, mono
            tabular numerals. */}
        <div className="brand-final-stats" aria-label="Marketplace stats">
          <div className="brand-final-stat">
            <div className="brand-final-stat-v">{fmtMoneyFull(Math.round(stats.totalPaid))}</div>
            <div className="brand-final-stat-l mono-meta">Paid to creators · cleared via escrow</div>
          </div>
          <div className="brand-final-stat">
            <div className="brand-final-stat-v">{stats.verifiedCreators}+</div>
            <div className="brand-final-stat-l mono-meta">Vetted creators · ready to work</div>
          </div>
          <div className="brand-final-stat">
            <div className="brand-final-stat-v">5<span className="brand-final-stat-u">%</span></div>
            <div className="brand-final-stat-l mono-meta">Flat fee · only on cleared deals</div>
          </div>
          <div className="brand-final-stat">
            <div className="brand-final-stat-v">$0</div>
            <div className="brand-final-stat-l mono-meta">To post · forever</div>
          </div>
        </div>
      </div>
    </section>
  );
}
