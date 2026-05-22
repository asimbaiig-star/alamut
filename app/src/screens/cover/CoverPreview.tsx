// CoverPreview · /landing-preview surface (Phase 60)
//
// A duplicate of `Cover.tsx` that previews three Tier-1 hero quick wins
// without touching the production creator landing at `/`. Every section
// below the hero is rendered identically to `Cover.tsx`. Only the hero
// is modified:
//
//   1. The static `CreatorStorefrontMock` SVG is swapped for the new
//      `AnimatedHeroIllustration`, which animates the connection
//      lines, money chip, avatar portrait, brand mark, and floating
//      accent dots.
//   2. A `HeroAnchorCard`-style "Cleared payout" tile renders directly
//      under the illustration, pulling a real most-recent cleared
//      payout from the seed (creator portrait + name + brand +
//      campaign + amount + city + days-ago).
//   3. The avatar + brand mark inside the illustration cycle through
//      real seeded creator × brand pairs every ~4 seconds, so the
//      hero quietly demonstrates the marketplace breadth.
//
// The original `Cover.tsx` is untouched — both routes can run side-by-
// side, making it trivial to A/B the new hero before promoting it.
//
// Section order below the hero matches `Cover.tsx` 1:1:
//   1. CreatorTrustBar
//   2. CreatorPillars
//   3. CreatorEditorialBreak
//   4. CreatorShowcaseGallery
//   5. CreatorHowItWorks
//   6. CreatorBrandAuthority
//   7. PressStrip
//   8. CreatorVoices
//   9. CreatorPricing
//  10. CreatorFAQ
//  11. CreatorFinalCTA

import { Link } from 'react-router-dom';
import { useEffect, useMemo } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Logo } from '@/components/ui/Logo';
import { useStore } from '@/lib/api/store';
import { useAuth } from '@/lib/auth/useAuth';
import { fmtMoneyFull } from '@/lib/utils/format';
import {
  SafetyShield,
  EverySize,
  ReliablePay,
  MultiPlatform,
} from '@/components/illustrations/Illustrations';
import { BrandWordmark } from '@/components/illustrations/BrandWordmarks';
import { CuratedShowcase } from '@/components/illustrations/CuratedShowcase';
import { PressStrip } from '@/components/illustrations/PressStrip';
import { PersonaPalette } from './scenes/PersonaPalette';
import { AnimatedHeroIllustration } from './scenes/AnimatedHeroIllustration';
import type { Brand, Campaign, Creator, Testimonial } from '@/lib/api/types';

import '@/styles/cinematic.css';

// =====================================================================
// Top-level page
// =====================================================================

export function CoverPreview() {
  const reduced = useReducedMotion();
  const { user, isCreator, isBrand } = useAuth();
  const continueHref = isCreator ? '/creator/today' : isBrand ? '/brand/today' : '/admin/home';

  useEffect(() => {
    try { localStorage.setItem('alamut.persona', 'creator'); } catch { /* no-op */ }
  }, []);

  useEffect(() => {
    const prevTitle = document.title;
    document.title = 'Alamut · Landing preview · Hero quick wins';
    return () => { document.title = prevTitle; };
  }, []);

  return (
    <PersonaPalette>
      <div data-surface="landing-light" className="lp-light-root creator-landing">
        <CreatorTopNav user={user} continueHref={continueHref} />
        <PreviewBadge />

        <CreatorHero reduced={reduced} />
        <CreatorTrustBar />
        <CreatorPillars reduced={reduced} />
        <CreatorEditorialBreak />
        <CreatorShowcaseGallery />
        <CreatorHowItWorks reduced={reduced} />
        <CreatorBrandAuthority />
        <PressStrip audience="creator" />
        <CreatorVoices />
        <CreatorPricing />
        <CreatorFAQ />
        <CreatorFinalCTA />

        <footer className="cn-footer">
          <div className="cn-footer-cols">
            <div className="cn-footer-col cn-footer-col-brand">
              <div className="cn-footer-logo">ALAMUT</div>
              <div className="cn-footer-tag">
                The brand-creator marketplace where you set the rates, get paid through escrow, and build a public track record with every closed deal.
              </div>
              <div className="cn-footer-cities">
                <span>Karachi</span><span>Lahore</span><span>Dubai</span>
              </div>
            </div>
            <div className="cn-footer-col">
              <div className="cn-footer-col-h">For creators</div>
              <ul className="cn-footer-links">
                <li><a href="#why">Why creators</a></li>
                <li><a href="#how">How it works</a></li>
                <li><a href="#voices">Voices</a></li>
                <li><a href="#pricing">Pricing</a></li>
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
                <li><Link to="/for-brands">For brands</Link></li>
                <li><Link to="/signin">Sign in</Link></li>
              </ul>
            </div>
          </div>
          <div className="cn-footer-bottom">
            <span>© 2026 Alamut</span>
            <span className="cn-footer-bottom-meta">Always paid · always through escrow · preview build</span>
          </div>
        </footer>
      </div>
    </PersonaPalette>
  );
}

// =====================================================================
// Preview banner — makes it obvious this surface is the A/B duplicate.
// =====================================================================

function PreviewBadge() {
  return (
    <div
      role="note"
      aria-label="Preview surface"
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 60,
        display: 'flex',
        justifyContent: 'center',
        padding: '8px 16px',
        background: 'oklch(0.20 0.012 270)',
        color: 'oklch(1 0 0)',
        fontFamily: 'var(--cn-mono)',
        fontSize: 11,
        letterSpacing: '0.10em',
        textTransform: 'uppercase',
        gap: 14,
      }}
    >
      <span style={{ opacity: 0.7 }}>Preview · hero quick wins</span>
      <Link
        to="/"
        style={{ color: 'inherit', textDecoration: 'underline', opacity: 0.85 }}
      >
        ← Back to production landing
      </Link>
    </div>
  );
}

// =====================================================================
// Section 0 · Top nav
// =====================================================================

function CreatorTopNav({ user, continueHref }: { user: ReturnType<typeof useAuth>['user']; continueHref: string }) {
  return (
    <header className="cn-topnav lp-topnav-v2" aria-label="Primary">
      <Link to="/" className="lp-topnav-brand" aria-label="Alamut home">
        <Logo size={20} tag="ALAMUT" />
      </Link>
      <nav className="cn-topnav-links" aria-label="Sections">
        <a href="#why">Why creators</a>
        <a href="#how">How it works</a>
        <a href="#voices">Voices</a>
        <a href="#pricing">Pricing</a>
      </nav>
      <div className="cn-topnav-actions lp-topnav-actions-v2">
        <Link to="/for-brands" className="lp-topnav-segment">
          I&apos;m a brand <span aria-hidden="true">→</span>
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
            <Link to="/signup?role=creator" className="cn-topnav-cta">
              Join free <span aria-hidden="true">→</span>
            </Link>
          </>
        )}
      </div>
    </header>
  );
}

// =====================================================================
// Section 1 · Hero — modified for /landing-preview
// =====================================================================
//
// Layout note: the existing CSS rule
//   .creator-hero-v2-inner { grid-template-columns: 1.05fr 1fr; }
// already places text on the left, illust on the right. We keep that
// structure and stack the AnimatedHeroIllustration + HeroAnchorCard in
// the right column with inline flex-column styles so we don't have to
// edit landing.css (which serves the production hero).

function CreatorHero({ reduced }: { reduced: boolean | null }) {
  const db = useStore((s) => s.db);
  const anchor = useCreatorAnchor();
  const verifiedBrands = useMemo(
    () => db.brands.filter((b) => b.verified !== false).length,
    [db.brands],
  );
  const totalPaid = useMemo(
    () => db.transactions
      .filter((t) => t.kind === 'payout' && t.status === 'cleared' && t.amount > 0)
      .reduce((s, t) => s + t.amount, 0),
    [db.transactions],
  );

  return (
    <section className="lp-hero creator-hero-v2">
      <div className="creator-hero-v2-inner">
        <div className="creator-hero-v2-text">
          <motion.div
            className="cn-h-eyebrow"
            initial={reduced ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={reduced ? { duration: 0 } : { duration: 0.5, delay: 0.05 }}
          >
            For creators of every size
          </motion.div>
          <motion.h1
            className="cn-h-display creator-hero-v2-h"
            initial={reduced ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={reduced ? { duration: 0 } : { duration: 0.72, delay: 0.20, ease: [0.22, 0.36, 0.24, 1] }}
          >
            Your next <span className="accent">brand partnership</span> starts here.
          </motion.h1>
          <motion.p
            className="cn-lede creator-hero-v2-sub"
            initial={reduced ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={reduced ? { duration: 0 } : { duration: 0.72, delay: 0.40, ease: [0.22, 0.36, 0.24, 1] }}
          >
            Stop waiting to be discovered. Join a transparent space where you set the rates, get paid in escrow, and build a public track record with every closed deal.
          </motion.p>
          <motion.div
            className="creator-hero-v2-cta"
            initial={reduced ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={reduced ? { duration: 0 } : { duration: 0.72, delay: 0.60, ease: [0.22, 0.36, 0.24, 1] }}
          >
            <Link to="/signup?role=creator" className="cn-btn cn-btn-solid">
              Join free · 2 minutes <span aria-hidden="true">→</span>
            </Link>
            <Link to="/creators" className="cn-btn cn-btn-ghost">
              See a creator storefront <span aria-hidden="true">→</span>
            </Link>
          </motion.div>
          <motion.div
            className="creator-hero-v2-trust"
            initial={reduced ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={reduced ? { duration: 0 } : { duration: 0.72, delay: 0.80 }}
          >
            <span className="creator-hero-v2-trust-stat">
              <strong>{fmtMoneyFull(Math.round(totalPaid))}</strong>
              <span>paid to creators</span>
            </span>
            <span className="creator-hero-v2-trust-sep" aria-hidden="true">·</span>
            <span className="creator-hero-v2-trust-stat">
              <strong>{verifiedBrands}+</strong>
              <span>brands hiring</span>
            </span>
            <span className="creator-hero-v2-trust-sep" aria-hidden="true">·</span>
            <span className="creator-hero-v2-trust-stat">
              <strong>$0</strong>
              <span>to join</span>
            </span>
          </motion.div>
        </div>
        <motion.div
          className="creator-hero-v2-illust-wrap"
          style={{ flexDirection: 'column', gap: 20 }}
          initial={reduced ? false : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reduced ? { duration: 0 } : { duration: 0.9, delay: 0.30, ease: [0.22, 0.36, 0.24, 1] }}
        >
          <AnimatedHeroIllustration className="creator-hero-v2-illust" />
          {anchor && <HeroAnchorCard anchor={anchor} reduced={reduced} />}
        </motion.div>
      </div>
    </section>
  );
}

// =====================================================================
// Hero anchor card — duplicated inline so we never reach into LandingV2
// =====================================================================
// Pulls the most-recent cleared payout from the seed (creator × brand ×
// campaign × amount × city × days-ago) and renders it as a small product
// UI tile directly under the illustration. Mirrors the shape of the
// HeroAnchorCard reserved in LandingV2.tsx but kept self-contained here.

interface CreatorAnchor {
  brand: Brand;
  creator: Creator;
  campaign: Campaign;
  amountCleared: number;
  daysAgo: number;
}

function useCreatorAnchor(): CreatorAnchor | null {
  const db = useStore((s) => s.db);
  return useMemo(() => {
    const candidates = db.transactions
      .filter(
        (t) =>
          t.kind === 'payout' &&
          t.status === 'cleared' &&
          t.amount > 0 &&
          t.campaignId,
      )
      .sort((a, b) => +new Date(b.at) - +new Date(a.at))
      .map((t) => {
        const campaign = db.campaigns.find((c) => c.id === t.campaignId);
        const creator = db.creators.find((cr) => cr.userId === t.userId);
        const brand = campaign ? db.brands.find((b) => b.id === campaign.brandId) : undefined;
        if (!campaign || !creator || !brand) return null;
        const daysAgo = Math.max(
          1,
          Math.round((Date.now() - +new Date(t.at)) / 86_400_000),
        );
        return { brand, creator, campaign, amountCleared: t.amount, daysAgo };
      })
      .filter((x): x is CreatorAnchor => x !== null);
    return candidates[0] ?? null;
  }, [db]);
}

function HeroAnchorCard({ anchor, reduced }: { anchor: CreatorAnchor; reduced: boolean | null }) {
  const { brand, creator, campaign, amountCleared, daysAgo } = anchor;
  const agoLabel =
    daysAgo === 1
      ? 'yesterday'
      : daysAgo < 7
        ? `${daysAgo} days ago`
        : daysAgo < 14
          ? 'last week'
          : daysAgo < 60
            ? `${Math.round(daysAgo / 7)} weeks ago`
            : `${Math.round(daysAgo / 30)} months ago`;

  // Card-level reveal lands a beat after the trust line settles (delay
  // 0.80s on the trust strip) so the eye flow reads narrative → CTA →
  // trust → anchor.
  const enterAnim = {
    initial: reduced ? false : { opacity: 0, y: 18 },
    animate: { opacity: 1, y: 0 },
    transition: reduced
      ? { duration: 0 }
      : { duration: 0.9, delay: 1.0, ease: [0.22, 0.36, 0.24, 1] as [number, number, number, number] },
  };

  return (
    <motion.aside
      aria-label={`Recent payout: ${creator.name} · ${campaign.title}`}
      {...enterAnim}
      style={{
        width: '100%',
        maxWidth: 480,
        padding: '14px 16px',
        background: 'oklch(1 0 0)',
        border: '1px solid oklch(0.90 0.005 270)',
        borderRadius: 14,
        boxShadow: '0 16px 30px -16px oklch(0.20 0.012 270 / 0.16)',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      <div
        className="mono-meta"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          fontSize: 11,
          letterSpacing: '0.10em',
          textTransform: 'uppercase',
          color: 'var(--cn-ink-quiet)',
        }}
      >
        <span
          aria-hidden="true"
          style={{
            width: 8,
            height: 8,
            borderRadius: 4,
            background: 'var(--cn-accent)',
            boxShadow: '0 0 0 4px oklch(from var(--cn-accent) l c h / 0.18)',
          }}
        />
        Cleared payout · paid through escrow
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {creator.portrait && (
          <img
            src={creator.portrait}
            alt=""
            loading="lazy"
            decoding="async"
            aria-hidden="true"
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              objectFit: 'cover',
              border: '1px solid oklch(0.90 0.005 270)',
              flex: '0 0 auto',
            }}
          />
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--cn-ink)' }}>
            {creator.name}
          </div>
          <div
            className="mono-meta"
            style={{
              fontSize: 12,
              color: 'var(--cn-ink-quiet)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {campaign.title} · {brand.name}
          </div>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <div
            className="mono-meta"
            style={{ fontSize: 10, letterSpacing: '0.10em', textTransform: 'uppercase', color: 'var(--cn-ink-quiet)' }}
          >
            Cleared
          </div>
          <div style={{ fontFamily: 'var(--cn-mono)', fontWeight: 600, color: 'var(--cn-accent)', fontSize: 18 }}>
            +{fmtMoneyFull(Math.round(amountCleared))}
          </div>
        </div>
        <div>
          <div
            className="mono-meta"
            style={{ fontSize: 10, letterSpacing: '0.10em', textTransform: 'uppercase', color: 'var(--cn-ink-quiet)' }}
          >
            Payout to
          </div>
          <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--cn-ink)' }}>
            {creator.payout?.method ?? 'Bank'}
          </div>
        </div>
      </div>
      <div
        className="mono-meta"
        style={{
          fontSize: 11,
          color: 'var(--cn-ink-quiet)',
          letterSpacing: '0.04em',
          paddingTop: 4,
          borderTop: '1px dashed oklch(0.90 0.005 270)',
        }}
      >
        Escrow released · {creator.city} · {agoLabel}
      </div>
    </motion.aside>
  );
}

// =====================================================================
// Section 2 · Trust bar — creator portrait wall
// =====================================================================

function CreatorTrustBar() {
  const db = useStore((s) => s.db);
  const portraits = useMemo(
    () => db.creators
      .filter((c) => c.verified && c.portrait)
      .slice(0, 12),
    [db.creators],
  );
  return (
    <section className="creator-trust-v2" aria-label="Verified creators on Alamut">
      <div className="creator-trust-v2-inner">
        <div className="creator-trust-v2-portraits">
          {portraits.map((c) => (
            <img
              key={c.id}
              className="creator-trust-v2-portrait"
              src={c.portrait}
              alt=""
              loading="lazy"
              decoding="async"
            />
          ))}
        </div>
        <div className="creator-trust-v2-meta">
          <div className="cn-h-eyebrow">{db.creators.filter((c) => c.verified).length}+ verified creators</div>
          <p className="creator-trust-v2-tag">From nano (5k followers) to mega (1M+) — engagement matters here, not just follower count.</p>
        </div>
      </div>
    </section>
  );
}

// =====================================================================
// Section 3 · Pillars — Why creators choose us
// =====================================================================

function CreatorPillars({ reduced }: { reduced: boolean | null }) {
  const pillars = [
    {
      Illust: SafetyShield,
      title: 'Safety first.',
      body: 'No shady DMs, no fake-brand affiliate scams, no "send me a free product first" requests. Every brand on Alamut is verified before they can post a brief, and your account stays under your control.',
    },
    {
      Illust: EverySize,
      title: 'Opportunities for every size.',
      body: 'Brands here pay for engagement and craft, not just follower count. Nano creators (5–25k) close deals next to mega creators (1M+) every week. Brief-to-creator matching is audience-fit-first, follower-count-second.',
    },
    {
      Illust: ReliablePay,
      title: 'Reliable payments.',
      body: 'Stop chasing invoices. Brand budgets lock in escrow the moment they accept your offer — you start work knowing the money is already there. Median payout time on cleared deals: 4 days.',
    },
    {
      Illust: MultiPlatform,
      title: 'Multi-platform support.',
      body: 'Showcase content across Instagram, TikTok, YouTube, Substack, and X — one storefront, all your work. Brands brief by platform, your rate cards adapt per surface.',
    },
  ];
  return (
    <section id="why" className="creator-pillars-v2" aria-labelledby="creator-pillars-h">
      <div className="creator-pillars-v2-inner">
        <header className="creator-section-head-v2">
          <div className="cn-h-eyebrow">Why creators choose Alamut</div>
          <h2 id="creator-pillars-h" className="cn-h-section">
            Your content. Your audience. <span className="accent">Your value.</span>
          </h2>
          <p className="cn-lede">
            Built for creators who are tired of being left on read. Direct access to a verified brand database — no manager, no cold outreach, no guesswork about whether you&apos;ll get paid.
          </p>
        </header>
        <div className="creator-pillars-v2-grid">
          {pillars.map((p, i) => (
            <motion.article
              key={p.title}
              className="creator-pillars-v2-card"
              initial={reduced ? false : { opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={reduced ? { duration: 0 } : { duration: 0.6, delay: i * 0.08, ease: [0.22, 0.36, 0.24, 1] }}
            >
              <p.Illust className="creator-pillars-v2-icon" />
              <h3 className="creator-pillars-v2-title">{p.title}</h3>
              <p className="creator-pillars-v2-body">{p.body}</p>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}

// =====================================================================
// Section 3.5 · Editorial break — creator pull quote
// =====================================================================

function CreatorEditorialBreak() {
  const db = useStore((s) => s.db);
  const reduced = useReducedMotion();
  const voice = useMemo(() => {
    const t = (db.testimonials ?? []).find((x) => x.shownTo === 'brand');
    if (!t) return null;
    const byCampaign = new Map<string, number>();
    for (const tx of db.transactions) {
      if (tx.kind !== 'payout' || tx.status !== 'cleared' || tx.amount <= 0) continue;
      if (!tx.campaignId) continue;
      byCampaign.set(tx.campaignId, (byCampaign.get(tx.campaignId) ?? 0) + tx.amount);
    }
    let topAmount = 0;
    for (const amt of byCampaign.values()) {
      if (amt > topAmount) topAmount = amt;
    }
    return { t, cleared: topAmount };
  }, [db]);

  if (!voice) return null;
  const { t, cleared } = voice;

  return (
    <section className="creator-editorial" aria-label="Creator voice">
      <div className="creator-editorial-grain" aria-hidden="true" />
      <div className="creator-editorial-inner">
        <motion.figure
          className="creator-editorial-figure"
          initial={reduced ? false : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={reduced ? { duration: 0 } : { duration: 0.9, ease: [0.22, 0.36, 0.24, 1] }}
        >
          <div className="creator-editorial-eyebrow">A creator voice</div>
          <blockquote className="creator-editorial-quote">
            <span className="creator-editorial-quote-mark" aria-hidden="true">&ldquo;</span>
            {t.quote}
          </blockquote>
          <figcaption className="creator-editorial-caption">
            {t.authorPortrait && (
              <img className="creator-editorial-portrait" src={t.authorPortrait} alt="" loading="lazy" decoding="async" />
            )}
            <div className="creator-editorial-attrib">
              <div className="creator-editorial-name">{t.authorName}</div>
              <div className="creator-editorial-sub">{t.authorSubtitle}</div>
            </div>
          </figcaption>
        </motion.figure>

        <motion.aside
          className="creator-editorial-aside"
          initial={reduced ? false : { opacity: 0, x: 20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={reduced ? { duration: 0 } : { duration: 0.9, delay: 0.10, ease: [0.22, 0.36, 0.24, 1] }}
        >
          <div className="creator-editorial-aside-eyebrow">Cleared this deal</div>
          <div className="creator-editorial-aside-amount">{fmtMoneyFull(Math.round(cleared))}</div>
          <div className="creator-editorial-aside-meta">via escrow · 4-day average</div>
        </motion.aside>
      </div>
    </section>
  );
}

// =====================================================================
// Section 3.7 · Recent placements — marketplace deal grid
// =====================================================================

function CreatorShowcaseGallery() {
  return (
    <section className="creator-showcase-section" aria-labelledby="creator-showcase-h">
      <header className="creator-showcase-head">
        <div className="cn-h-eyebrow">Recent placements</div>
        <h2 id="creator-showcase-h" className="cn-h-section">
          Recent closed deals across <span className="accent">the marketplace</span>.
        </h2>
        <p className="cn-lede">
          Real creators, real brands, real cleared payouts. Each tile carries the brand, the brief, days-to-clear, and headcount. Every placement is a record from a closed campaign on the platform — no stock thumbnails.
        </p>
      </header>
      <CuratedShowcase variant="full" count={16} className="creator-showcase-gallery" />
    </section>
  );
}

// =====================================================================
// Section 4 · How it works
// =====================================================================

function CreatorHowItWorks({ reduced }: { reduced: boolean | null }) {
  const steps = [
    {
      n: '1',
      title: 'Sign up free.',
      body: 'Create your storefront in two minutes. Connect Instagram, TikTok, YouTube, Substack, X — we auto-pull metrics so you don\'t have to type them.',
    },
    {
      n: '2',
      title: 'Apply or get discovered.',
      body: 'Browse the brief marketplace and one-click apply, or get matched automatically when a brand\'s filters match your profile. Brands send first offers within hours.',
    },
    {
      n: '3',
      title: 'Seamless collaboration.',
      body: 'Chat, approve, deliver — all in one tab. Brand-approved files lock the deal; revisions track per round so you never argue over scope creep.',
    },
    {
      n: '4',
      title: 'Fast, secure payouts.',
      body: 'The brand\'s budget was already in escrow before you started. Approval triggers payout — average 4 days from approval to your wallet, withdrawable to bank or PayPal.',
    },
  ];
  return (
    <section id="how" className="creator-how-v2" aria-labelledby="creator-how-h">
      <div className="creator-how-v2-inner">
        <header className="creator-section-head-v2">
          <div className="cn-h-eyebrow">How it works</div>
          <h2 id="creator-how-h" className="cn-h-section">
            From sign-up to <span className="accent">money in your wallet</span>, in four steps.
          </h2>
          <p className="cn-lede">
            Same path every time. No agency middleman, no "we&apos;ll be in touch", no waiting six weeks for a Net-60 invoice to clear.
          </p>
        </header>
        <ol className="creator-how-v2-steps">
          {steps.map((s, i) => (
            <motion.li
              key={s.n}
              className="creator-how-v2-step"
              initial={reduced ? false : { opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={reduced ? { duration: 0 } : { duration: 0.6, delay: i * 0.10, ease: [0.22, 0.36, 0.24, 1] }}
            >
              <div className="creator-how-v2-step-num" aria-hidden="true">{s.n}</div>
              <h3 className="creator-how-v2-step-title">{s.title}</h3>
              <p className="creator-how-v2-step-body">{s.body}</p>
            </motion.li>
          ))}
        </ol>
      </div>
    </section>
  );
}

// =====================================================================
// Section 5 · Brand authority — logo marquee
// =====================================================================

function CreatorBrandAuthority() {
  const db = useStore((s) => s.db);
  const names = useMemo(() => db.brands.slice(0, 14).map((b) => b.name), [db.brands]);
  const looped = [...names, ...names];
  return (
    <section className="creator-brands-v2" aria-label="Brands on Alamut">
      <header className="creator-section-head-v2 creator-brands-v2-head">
        <div className="cn-h-eyebrow">Work with brands you admire</div>
        <h2 className="cn-h-section">
          New campaigns posted weekly from <span className="accent">global icons</span>.
        </h2>
      </header>
      <div className="creator-brands-v2-track" aria-hidden="true">
        {looped.map((name, i) => (
          <BrandWordmark key={`${name}-${i}`} name={name} className="creator-brands-v2-mark" />
        ))}
      </div>
    </section>
  );
}

// =====================================================================
// Section 6 · Voices — testimonial wall (creator-shown)
// =====================================================================

interface VoiceData {
  testimonial: Testimonial;
  campaign: Campaign | undefined;
  brand: Brand | undefined;
  amountCleared: number;
  applicantCount: number;
}

function useCreatorVoices(): VoiceData[] {
  const db = useStore((s) => s.db);
  return useMemo(() => {
    const testimonials = db.testimonials ?? [];
    return testimonials
      .filter((t) => t.shownTo === 'creator')
      .slice(0, 4)
      .map((t) => {
        const campaign = db.campaigns.find((c) => c.id === t.campaignId);
        const brand = campaign ? db.brands.find((b) => b.id === campaign.brandId) : undefined;
        const amountCleared = db.transactions
          .filter((tx) => tx.campaignId === t.campaignId && tx.kind === 'payout' && tx.status === 'cleared' && tx.amount > 0)
          .reduce((s, tx) => s + tx.amount, 0);
        const applicantCount = db.applications.filter((a) => a.campaignId === t.campaignId).length;
        return { testimonial: t, campaign, brand, amountCleared, applicantCount };
      });
  }, [db]);
}

function CreatorVoices() {
  const voices = useCreatorVoices();
  return (
    <section id="voices" className="creator-voices-v2" aria-labelledby="creator-voices-h">
      <div className="creator-voices-v2-inner">
        <header className="creator-section-head-v2">
          <div className="cn-h-eyebrow">Who&apos;s hiring on Alamut</div>
          <h2 id="creator-voices-h" className="cn-h-section">
            The kind of <span className="accent">brand teams</span> sending you offers.
          </h2>
          <p className="cn-lede">
            If they&apos;re posting briefs here, you should be applying. Four growth-team voices from brands actively closing deals with creators on the platform — every quote is tied to a real campaign in the seed dataset, no actor reads.
          </p>
        </header>
        <div className="creator-voices-v2-grid">
          {voices.map((v) => {
            const captionParts: string[] = [];
            if (v.campaign?.title) captionParts.push(v.campaign.title);
            if (v.amountCleared > 0) captionParts.push(`${fmtMoneyFull(Math.round(v.amountCleared))} cleared`);
            if (v.applicantCount > 0) captionParts.push(`${v.applicantCount} applicants`);
            return (
              <figure key={v.testimonial.id} className="creator-voices-v2-card">
                <blockquote className="creator-voices-v2-quote">
                  &ldquo;{v.testimonial.quote}&rdquo;
                </blockquote>
                <figcaption className="creator-voices-v2-cap">
                  {v.testimonial.authorPortrait && (
                    <img
                      className="creator-voices-v2-portrait"
                      src={v.testimonial.authorPortrait}
                      alt=""
                      loading="lazy"
                      decoding="async"
                    />
                  )}
                  <div>
                    <div className="creator-voices-v2-name">{v.testimonial.authorName}</div>
                    <div className="creator-voices-v2-sub mono-meta">{v.testimonial.authorSubtitle}</div>
                    {captionParts.length > 0 && (
                      <div className="creator-voices-v2-deal mono-meta">{captionParts.join(' · ')}</div>
                    )}
                  </div>
                </figcaption>
              </figure>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// =====================================================================
// Section 7 · Pricing
// =====================================================================

function CreatorPricing() {
  return (
    <section id="pricing" className="lp-section creator-pricing-v2" aria-labelledby="creator-pricing-h">
      <header className="lp-section-head">
        <div className="cn-h-eyebrow">Creator pricing</div>
        <h2 id="creator-pricing-h" className="cn-h-section">
          Free to join. <span className="accent">Free to apply.</span> 5% only when you get paid.
        </h2>
        <p className="cn-lede">
          No subscription. No setup fee. No "pro tier". The 5% fee comes off the deal payout — what you see on every offer is what lands in your wallet, after fees.
        </p>
      </header>
      <div className="lp-pricing-card creator-pricing-v2-card">
        <div className="creator-pricing-v2-points">
          <div>
            <div className="brand-landing-pricing-v">$0</div>
            <div className="brand-landing-pricing-k mono-meta">To join</div>
            <div className="brand-landing-pricing-d">Forever. Plus free use of every tool we ship.</div>
          </div>
          <div>
            <div className="brand-landing-pricing-v">$0</div>
            <div className="brand-landing-pricing-k mono-meta">To apply</div>
            <div className="brand-landing-pricing-d">Apply to every brief that fits your audience.</div>
          </div>
          <div>
            <div className="brand-landing-pricing-v">5%</div>
            <div className="brand-landing-pricing-k mono-meta">On cleared deals</div>
            <div className="brand-landing-pricing-d">Deducted from payout. You see post-fee amount upfront.</div>
          </div>
        </div>
        <Link to="/signup?role=creator" className="cn-btn cn-btn-solid">
          Join free · 2 minutes <span aria-hidden="true">→</span>
        </Link>
      </div>
    </section>
  );
}

// =====================================================================
// Section 8 · FAQ
// =====================================================================

const CREATOR_FAQ: Array<{ q: string; a: string }> = [
  {
    q: 'Do I need a minimum follower count to join?',
    a: 'No. Alamut is built for every size. Nano creators (5–25k engaged followers) close deals next to mega creators every week. Brands here pay for audience-fit and content quality, not just follower volume.',
  },
  {
    q: 'When do I actually get paid?',
    a: "Funds lock in escrow the moment a brand accepts your offer — before you start work. Once they approve your delivery, payment releases. Average time from approval to your wallet across the platform: 4 days.",
  },
  {
    q: 'What if a brand never approves my work?',
    a: "Two paths. (1) Revisions — most disagreements resolve in 1-2 rounds. (2) Dispute — if a brand goes silent or refuses without cause, you open a dispute and we mediate. If the work meets brief, escrow releases to you regardless of brand silence.",
  },
  {
    q: 'Can I set my own rates?',
    a: "Yes. Per-platform rate cards (post · reel · story · longform) live on your storefront. When a brand sends an offer, you can accept, counter-offer, or decline. We never set rates for you and we don't auto-accept on your behalf.",
  },
  {
    q: 'How is this different from a talent agency?',
    a: 'No exclusivity, no 15–25% management fee, no "we keep the contacts when you leave". You own your brand relationships. Alamut takes a flat 5% on cleared deals only — agencies typically take 15–25% of every deal plus a retainer.',
  },
  {
    q: "What's the platform fee?",
    a: 'Flat 5% on cleared deals only. You see the exact post-fee payout amount before accepting any offer — what is listed is what lands in your wallet. We never charge for signup, applications, vetting, messaging, or the calculator tools.',
  },
  {
    q: 'Do I need a tax ID to get paid?',
    a: 'Yes — W-9 for US creators, equivalent forms internationally. Tax info is collected once during onboarding, not per deal. Year-end forms (1099 / equivalent) are issued automatically.',
  },
  {
    q: 'How does my reputation work?',
    a: 'Every closed deal posts a public receipt on your storefront: brand, work delivered, rate cleared, the brand\'s review of you. Your track record is the proof you take to the next brief — and it goes with you forever, not locked in a manager\'s spreadsheet.',
  },
];

function CreatorFAQ() {
  return (
    <section id="faq" className="lp-section lp-faq" aria-labelledby="creator-faq-h">
      <header className="lp-section-head">
        <div className="cn-h-eyebrow">FAQ</div>
        <h2 id="creator-faq-h" className="cn-h-section">
          Everything creators ask <span className="accent">before</span> applying.
        </h2>
        <p className="cn-lede">
          Eight questions answered. Anything else, hello@alamut.co goes to a real human, not a bot.
        </p>
      </header>
      <div className="lp-faq-list">
        {CREATOR_FAQ.map((item, i) => (
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
// Section 9 · Final CTA
// =====================================================================

function CreatorFinalCTA() {
  return (
    <section className="lp-section lp-final creator-final-v2" aria-labelledby="creator-final-h">
      <div className="lp-final-inner">
        <h2 id="creator-final-h" className="cn-h-display lp-final-h">
          Turn your audience <span className="accent">into income</span>.
        </h2>
        <p className="cn-lede lp-final-body">
          Two minutes to set up. Free forever. Brands send their first offers within hours of you going live.
        </p>
        <div className="lp-final-cta">
          <Link to="/signup?role=creator" className="cn-btn cn-btn-solid">
            Join free · 2 minutes <span aria-hidden="true">→</span>
          </Link>
          <Link to="/creators" className="cn-btn cn-btn-ghost">
            Browse storefronts <span aria-hidden="true">→</span>
          </Link>
        </div>
      </div>
    </section>
  );
}
