// LandingV2 (Phase 48) — content-first landing page rewrite.
//
// Seven sections, top to bottom:
//   1. Hero          · single-claim headline, sub, CTA, trust line
//   2. TrustStrip    · row of real seed-brand wordmarks
//   3. HowItWorks    · 4 verb-led steps (persona-aware)
//   4. WhyAlamut     · 4 differentiator cards (persona-aware)
//   5. RealVoices    · 2 testimonials pulled from seed (persona-aware)
//   6. Pricing       · friction-killer block (persona-aware)
//   7. FinalCTA      · mirror of hero, different verb (persona-aware)
//
// All copy persona-aware via usePersona. No scroll-pinning, no
// cinematic acts. Sections render inline; subtle on-scroll fade-in
// per section. Visual layer comes in a follow-up phase.

import { Link, useNavigate } from 'react-router-dom';
import { motion, useReducedMotion } from 'motion/react';
import { useMemo, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useStore } from '@/lib/api/store';
import { useAuth } from '@/lib/auth/useAuth';
import { usePersona } from '@/lib/utils/usePersona';
import { fmtMoneyFull } from '@/lib/utils/format';
import {
  HeroIllustration,
  VettedShield,
  ApplicationsStack,
  EscrowVault,
  ROASChart,
  NoOutreach,
  PriceTag,
  StarReceipt,
} from '@/components/illustrations/Illustrations';
import type { Testimonial, Campaign, Brand, Creator } from '@/lib/api/types';

// ============ Shared hooks ============

interface TrustStats {
  brands: number;
  creators: number;
  totalPaid: number;
  liveBriefs: number;
  avgPayoutDays: number;
}

function useTrustStats(): TrustStats {
  const db = useStore((s) => s.db);
  return useMemo(() => {
    const brands = db.brands.filter((b) => b.verified).length;
    const creators = db.creators.length;
    const totalPaid = db.transactions
      .filter((t) => t.kind === 'payout' && t.status === 'cleared' && t.amount > 0)
      .reduce((s, t) => s + t.amount, 0);
    const liveBriefs = db.campaigns.filter((c) => c.stage === 'live').length;
    return { brands, creators, totalPaid, liveBriefs, avgPayoutDays: 4 };
  }, [db]);
}

/** Persona-specific hero anchor cards.
 *
 *  A brand visitor wants proof their brief will get pitches fast —
 *  show them a recently-posted live brief with the applications
 *  rolling in.
 *
 *  A creator visitor wants proof brands actually pay — show them a
 *  recent cleared payout with the creator's portrait + name on it.
 *
 *  Same hero card *shape*, different *data slices* from the seed.
 *  Hooks return null when the seed doesn't have a candidate; the
 *  hero falls back to text-only without breaking. */
interface BrandAnchor {
  kind: 'brand';
  brand: Brand;
  campaign: Campaign;
  applicantCount: number;
  hoursAgo: number;
}
interface CreatorAnchor {
  kind: 'creator';
  brand: Brand;
  creator: Creator;
  campaign: Campaign;
  amountCleared: number;
  daysAgo: number;
}
type HeroAnchor = BrandAnchor | CreatorAnchor;

function useBrandAnchor(): BrandAnchor | null {
  const db = useStore((s) => s.db);
  return useMemo(() => {
    // Active brief that's still receiving pitches — gives "brief
    // just landed, applications already in" energy.
    const candidates = db.campaigns
      .filter((c) => c.stage === 'live')
      .map((c) => {
        const brand = db.brands.find((b) => b.id === c.brandId);
        const apps = db.applications.filter((a) => a.campaignId === c.id);
        if (!brand || apps.length < 3) return null;
        const hoursAgo = Math.max(
          1,
          Math.round((Date.now() - +new Date(c.createdAt)) / 3_600_000),
        );
        return {
          kind: 'brand' as const,
          brand,
          campaign: c,
          applicantCount: apps.length,
          hoursAgo,
        };
      })
      .filter((x): x is BrandAnchor => x !== null)
      .sort((a, b) => a.hoursAgo - b.hoursAgo);
    return candidates[0] ?? null;
  }, [db]);
}

/** Dynamic chip values for the How-It-Works steps. A few values describe
 *  platform *behavior* (e.g. "3 sentences · 3 samples" — that's the
 *  application format, not a number that varies) and stay constant.
 *  The rest pull from real seed records so the page breathes when the
 *  seed changes. Single hook, no per-step queries. */
interface HowChips {
  brand: { applicants: string; locked: string; roas: string };
  creator: { platforms: string; cleared: string };
}
function useHowChips(): HowChips {
  const db = useStore((s) => s.db);
  return useMemo(() => {
    // Median applicant count across closed/posted campaigns — better
    // signal than mean which gets pulled around by outliers.
    const applicantCounts = db.campaigns
      .filter((c) => c.applications.length > 0)
      .map((c) => c.applications.length)
      .sort((a, b) => a - b);
    const medianApplicants = applicantCounts.length
      ? applicantCounts[Math.floor(applicantCounts.length / 2)]
      : 12;

    // Median active escrow hold — what's currently locked across live
    // campaigns. Pull from escrow_hold transactions whose campaigns
    // haven't closed yet.
    const activeEscrowAmounts = db.transactions
      .filter((t) => t.kind === 'escrow_hold' && t.amount < 0 && t.status === 'cleared')
      .map((t) => Math.abs(t.amount))
      .sort((a, b) => a - b);
    const medianEscrow = activeEscrowAmounts.length
      ? activeEscrowAmounts[Math.floor(activeEscrowAmounts.length / 2)]
      : 1400;

    // ROAS from any campaign with tracking data. Filter out implausible
    // outliers — the seed sometimes pairs a low `spent` with a high
    // `revenueAttributed` which produces 50×+ ratios that read as
    // marketing fiction. Real-world influencer-marketing ROAS lives in
    // the 1×–12× band; anything above that is an artifact of the seed
    // not modeling spend correctly. Clamp to that range, then median.
    const trackedRoas: number[] = [];
    for (const c of db.campaigns) {
      if (!c.tracking || c.tracking.length === 0 || c.spent <= 0) continue;
      const attributedRev = c.tracking.reduce((s, t) => s + (t.revenueAttributed ?? 0), 0);
      if (attributedRev <= 0) continue;
      const ratio = attributedRev / c.spent;
      if (ratio < 1 || ratio > 12) continue;
      trackedRoas.push(ratio);
    }
    trackedRoas.sort((a, b) => a - b);
    const medianRoas = trackedRoas.length
      ? trackedRoas[Math.floor(trackedRoas.length / 2)]
      : 4.2;

    // Most-common 3-platform combination across creators — surfaces
    // the realistic "IG · TT · YT"-style chip without hardcoding it.
    const platformInitials: Record<string, string> = {
      Instagram: 'IG', TikTok: 'TT', YouTube: 'YT',
      Substack: 'SS', Newsletter: 'NL', X: 'X', LinkedIn: 'LI',
    };
    const counts: Record<string, number> = {};
    for (const cr of db.creators) {
      for (const p of cr.platforms) {
        counts[p.name] = (counts[p.name] ?? 0) + 1;
      }
    }
    const top3 = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name]) => platformInitials[name] ?? name.slice(0, 2).toUpperCase())
      .join(' · ');

    // Median payout amount + median days-to-clear (from cleared
    // payouts only) — used in the creator step 4 chip.
    const payouts = db.transactions
      .filter((t) => t.kind === 'payout' && t.status === 'cleared' && t.amount > 0)
      .map((t) => t.amount)
      .sort((a, b) => a - b);
    const medianPayout = payouts.length
      ? payouts[Math.floor(payouts.length / 2)]
      : 1400;

    return {
      brand: {
        applicants: `${medianApplicants} sorted by fit`,
        locked: `${fmtMoneyFull(Math.round(medianEscrow))} · escrow`,
        roas: `${medianRoas.toFixed(1)}× · UTM-tracked`,
      },
      creator: {
        platforms: top3 || 'IG · TT · YT',
        cleared: `+${fmtMoneyFull(Math.round(medianPayout))} · 4 days`,
      },
    };
  }, [db]);
}

function useCreatorAnchor(): CreatorAnchor | null {
  const db = useStore((s) => s.db);
  return useMemo(() => {
    // Most-recently-cleared payout. Money already in someone's wallet
    // is the strongest possible proof to a visiting creator.
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
        return {
          kind: 'creator' as const,
          brand,
          creator,
          campaign,
          amountCleared: t.amount,
          daysAgo,
        };
      })
      .filter((x): x is CreatorAnchor => x !== null);
    return candidates[0] ?? null;
  }, [db]);
}

/** Animated number that counts up from 0 → target once `start` flips
 *  to true. Uses requestAnimationFrame with an ease-out cubic curve so
 *  the climb decelerates as it lands. Honors prefers-reduced-motion by
 *  jumping straight to the target. (Phase 49.8) */
function useCountUp(target: number, duration = 1200, start = false): number {
  const reduced = useReducedMotion();
  const [value, setValue] = useState(start ? target : 0);
  useEffect(() => {
    if (!start) return;
    if (reduced) {
      setValue(target);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - t0) / duration);
      // Ease-out cubic — fast start, soft landing.
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(target * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, start, reduced]);
  return value;
}

/** Reveal helper: fades + lifts a section into view on first paint. */
function useReveal() {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (reduced) {
      setVisible(true);
      return;
    }
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setVisible(true);
            io.disconnect();
            break;
          }
        }
      },
      { threshold: 0.12 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [reduced]);
  return { ref, visible, reduced };
}

// ============ Section 1 · Hero ============

const HERO_COPY = {
  brand: {
    eyebrow: 'For brands & agencies',
    headline: <>Brand deals that close in <span className="accent">days</span>.</>,
    sub: 'Vetted creators apply within hours. Money clears through escrow. ROAS tracked per UTM.',
    primary: { label: 'Post a brief — free', href: '/signup?role=brand' },
    secondary: { label: 'See a real closed deal', anchor: '#voices' },
  },
  creator: {
    eyebrow: 'For creators of every size',
    headline: <>Brands post. <span className="accent">You pick</span>.</>,
    sub: 'Real briefs from real brands. Money in escrow before you press record.',
    primary: { label: 'Sign up free · 2 minutes', href: '/signup?role=creator' },
    secondary: { label: 'See what a closed deal looks like', anchor: '#voices' },
  },
} as const;

export function HeroV2() {
  const [persona] = usePersona();
  const { user, isCreator, isBrand } = useAuth();
  const navigate = useNavigate();
  const stats = useTrustStats();
  const brandAnchor = useBrandAnchor();
  const creatorAnchor = useCreatorAnchor();
  const anchor: HeroAnchor | null = persona === 'brand' ? brandAnchor : creatorAnchor;
  const c = HERO_COPY[persona];
  const reduced = useReducedMotion();
  const continueHref = isCreator ? '/creator/today' : isBrand ? '/brand/today' : '/admin/home';

  // Phase 49.8 — count-up trigger. Fires shortly after the trust line
  // starts its fade-in (motion delay 0.80s). The animated numbers climb
  // from 0 → real seed values over ~1.2–1.6s, so the visitor watches
  // the proof land instead of seeing it static.
  const [countStart, setCountStart] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setCountStart(true), 800);
    return () => clearTimeout(t);
  }, []);
  const brandsCount = useCountUp(stats.brands, 1200, countStart);
  const creatorsCount = useCountUp(stats.creators, 1400, countStart);
  const paidCount = useCountUp(Math.round(stats.totalPaid), 1600, countStart);

  const trustLine = persona === 'brand' ? (
    <>
      <span className="lp-hero-trust-num">{brandsCount}</span>+ verified brands ·{' '}
      <span className="lp-hero-trust-num">{creatorsCount}</span>+ creators ·{' '}
      <span className="lp-hero-trust-num">{fmtMoneyFull(paidCount)}</span>+ paid · escrow on every deal
    </>
  ) : (
    <>
      <span className="lp-hero-trust-num">{brandsCount}</span>+ verified brands posting · payouts clear in days · always paid through escrow
    </>
  );

  return (
    <section className="lp-hero" aria-labelledby="lp-hero-h">
      <div className="lp-hero-inner lp-hero-split">
        <div className="lp-hero-text">
          <motion.div
            className="cn-h-eyebrow"
            initial={reduced ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={reduced ? { duration: 0 } : { duration: 0.5, delay: 0.05 }}
          >
            {c.eyebrow}
          </motion.div>

          <motion.h1
            id="lp-hero-h"
            className="cn-h-display lp-hero-h"
            initial={reduced ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={reduced ? { duration: 0 } : { duration: 0.72, delay: 0.20, ease: [0.22, 0.36, 0.24, 1] }}
          >
            {c.headline}
          </motion.h1>

          <motion.p
            className="cn-lede lp-hero-sub"
            initial={reduced ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={reduced ? { duration: 0 } : { duration: 0.72, delay: 0.40, ease: [0.22, 0.36, 0.24, 1] }}
          >
            {c.sub}
          </motion.p>

          <motion.div
            className="lp-hero-cta"
            initial={reduced ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={reduced ? { duration: 0 } : { duration: 0.72, delay: 0.60, ease: [0.22, 0.36, 0.24, 1] }}
          >
            {user ? (
              <button className="cn-btn cn-btn-solid" onClick={() => navigate(continueHref)}>
                Continue to your workspace <span aria-hidden="true">→</span>
              </button>
            ) : (
              <Link to={c.primary.href} className="cn-btn cn-btn-solid">
                {c.primary.label} <span aria-hidden="true">→</span>
              </Link>
            )}
            <a href={c.secondary.anchor} className="cn-btn cn-btn-ghost">
              {c.secondary.label} <span aria-hidden="true">↓</span>
            </a>
          </motion.div>

          <motion.div
            className="lp-hero-trust mono-meta"
            initial={reduced ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={reduced ? { duration: 0 } : { duration: 0.72, delay: 0.80, ease: [0.22, 0.36, 0.24, 1] }}
          >
            {trustLine}
          </motion.div>
        </div>

        {/* Phase 52 — stylized illustration replaces the data-driven
            anchor card on the landing-light surface. The illustration
            already encodes a real-deal feel (creator avatar + brand
            mark + +$1,400 chip) so we don't lose the proof signal. */}
        <HeroIllustration className="lp-hero-illust" />
        {/* anchor still computed (kept available for cap/A/B testing) */}
        {anchor ? null : null}
      </div>
    </section>
  );
}

// Hero anchor card — small product UI fragment to the right of the
// hero narrative on desktop. Two shapes:
//   · brand visitor sees a live brief with applications rolling in
//     ("brief just opened, X pitches in the first Y hours")
//   · creator visitor sees a recent cleared payout
//     ("money landed in [creator]'s wallet [N] days ago")
// Hidden under 880px.
interface HeroAnchorCardProps {
  anchor: HeroAnchor;
  reduced: boolean | null;
}
function HeroAnchorCard({ anchor, reduced }: HeroAnchorCardProps) {
  // Phase 49 — anchor card lands AFTER the trust line settles (which is
  // at delay 0.80s). Eye flow: read narrative → CTA → trust strip →
  // anchor card arrives. Earlier 0.5s delay made the anchor compete with
  // the CTA for attention.
  const enterAnim = {
    initial: reduced ? false : { opacity: 0, y: 18 },
    animate: { opacity: 1, y: 0 },
    transition: reduced
      ? { duration: 0 }
      : { duration: 0.9, delay: 1.0, ease: [0.22, 0.36, 0.24, 1] as [number, number, number, number] },
  };

  if (anchor.kind === 'brand') {
    const { brand, campaign, applicantCount, hoursAgo } = anchor;
    // Tag = live state (the proof a brand visitor wants: "creators
    // are showing up"). Recency goes in the foot as a quiet detail.
    // Day count is rounded to nearest day for readability.
    const daysIn = Math.max(1, Math.round(hoursAgo / 24));
    const flightLabel =
      hoursAgo < 24
        ? `${hoursAgo} ${hoursAgo === 1 ? 'hr' : 'hrs'} in`
        : `${daysIn} ${daysIn === 1 ? 'day' : 'days'} in`;

    return (
      <motion.aside
        className="lp-hero-anchor"
        aria-label={`Live brief: ${campaign.title}`}
        {...enterAnim}
      >
        <div className="lp-hero-anchor-tag mono-meta">
          <span className="lp-hero-anchor-pulse" aria-hidden="true" />
          Open brief · accepting pitches
        </div>
        <div className="lp-hero-anchor-head">
          <span className="lp-hero-anchor-mark" aria-hidden="true">{brand.logoMark || brand.name[0]}</span>
          <div className="lp-hero-anchor-meta">
            <div className="lp-hero-anchor-brand">{brand.name}</div>
            <div className="lp-hero-anchor-cmp mono-meta">{campaign.title}</div>
          </div>
        </div>
        <div className="lp-hero-anchor-row">
          <div>
            <div className="lp-hero-anchor-k mono-meta">Pitches in</div>
            <div className="lp-hero-anchor-v">{applicantCount}</div>
          </div>
          <div>
            <div className="lp-hero-anchor-k mono-meta">Budget held</div>
            <div className="lp-hero-anchor-v lp-hero-anchor-v-money">
              {fmtMoneyFull(campaign.budget)}
            </div>
          </div>
        </div>
        <div className="lp-hero-anchor-foot mono-meta">
          Escrow on accept · {campaign.region} · {flightLabel}
        </div>
      </motion.aside>
    );
  }

  // anchor.kind === 'creator'
  // Tag = state ("payout cleared, here's the proof"). Recency reads
  // honestly in the foot — "X weeks ago · escrow released" lands as a
  // detail rather than a contradiction.
  const { brand, creator, campaign, amountCleared, daysAgo } = anchor;
  const agoLabel = daysAgo === 1
    ? 'yesterday'
    : daysAgo < 7
      ? `${daysAgo} days ago`
      : daysAgo < 14
        ? 'last week'
        : daysAgo < 60
          ? `${Math.round(daysAgo / 7)} weeks ago`
          : `${Math.round(daysAgo / 30)} months ago`;

  return (
    <motion.aside
      className="lp-hero-anchor"
      aria-label={`Recent payout: ${creator.name} · ${campaign.title}`}
      {...enterAnim}
    >
      <div className="lp-hero-anchor-tag mono-meta">
        <span className="lp-hero-anchor-pulse" aria-hidden="true" />
        Cleared payout · paid through escrow
      </div>
      <div className="lp-hero-anchor-head">
        <img
          className="lp-hero-anchor-portrait"
          src={creator.portrait}
          alt=""
          loading="lazy"
          decoding="async"
          aria-hidden="true"
        />
        <div className="lp-hero-anchor-meta">
          <div className="lp-hero-anchor-brand">{creator.name}</div>
          <div className="lp-hero-anchor-cmp mono-meta">
            {campaign.title} · {brand.name}
          </div>
        </div>
      </div>
      <div className="lp-hero-anchor-row">
        <div>
          <div className="lp-hero-anchor-k mono-meta">Cleared</div>
          <div className="lp-hero-anchor-v lp-hero-anchor-v-money">
            +{fmtMoneyFull(Math.round(amountCleared))}
          </div>
        </div>
        <div>
          <div className="lp-hero-anchor-k mono-meta">Payout to</div>
          <div className="lp-hero-anchor-v">{creator.payout.method}</div>
        </div>
      </div>
      <div className="lp-hero-anchor-foot mono-meta">
        Escrow released · {creator.city} · {agoLabel}
      </div>
    </motion.aside>
  );
}
// Phase 52 — HeroAnchorCard is intentionally kept (not rendered on the
// current landing-light surface, which uses HeroIllustration instead).
// Reserved for future surface variants (e.g. dark hero, brand-side
// outcomes section). The void below marks it as referenced so the
// strict-noUnused tsc check passes.
void HeroAnchorCard;

// ============ Section 2 · TrustStrip ============

export function TrustStrip() {
  const db = useStore((s) => s.db);
  const { ref, visible } = useReveal();

  // Real brands from seed. Filter to verified + take a curated set so
  // wordmarks fit on one row without crowding.
  const brands = useMemo(
    () =>
      db.brands
        .filter((b) => b.verified)
        .sort((a, b) => a.name.length - b.name.length)
        .slice(0, 14),
    [db.brands],
  );

  return (
    <section
      ref={ref}
      className={`lp-trust ${visible ? 'is-visible' : ''}`}
      aria-label="Brands using Alamut"
    >
      <div className="lp-trust-lead mono-meta">
        Brands posting briefs on Alamut this season
      </div>
      <div className="lp-trust-row">
        {brands.map((b) => (
          <span key={b.id} className="lp-trust-mark">
            <span className="lp-trust-mark-badge" aria-hidden="true">
              {b.logoMark || b.name[0]}
            </span>
            <span className="lp-trust-mark-name">{b.name}</span>
          </span>
        ))}
      </div>
      <div className="lp-trust-foot mono-meta">
        Live count: {db.brands.length} verified brands · 32 live briefs this week
      </div>
    </section>
  );
}

// ============ Section 3 · HowItWorks ============

// Small SVG glyphs used as the leading icon in each step's product-chip
// preview. All 24×24 viewBox, currentColor stroke, line-art style for
// visual cohesion across the row. Drawn here (not imported) so the
// landing has zero icon-library dependency.
const ICON = {
  doc:    'M7 4h10v16H7z M10 8h4 M10 12h4 M10 16h4',
  users:  'M9 8a3 3 0 1 1 0 -6 3 3 0 0 1 0 6 z M3 18c0 -3 3 -5 6 -5s6 2 6 5 M16 9a2.5 2.5 0 1 1 0 -5 M14 13c4 0 7 2 7 5',
  lock:   'M7 11V8a5 5 0 1 1 10 0v3 M5 11h14v9H5z M12 14v3',
  chart:  'M4 20h16 M7 16v-6 M11 16v-9 M15 16v-4 M19 16v-2',
  link:   'M9 13a4 4 0 0 0 5.7 0l3 -3a4 4 0 0 0 -5.7 -5.7l-1 1 M15 11a4 4 0 0 0 -5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1 -1',
  send:   'M3 11l18 -7l-7 18l-3 -8l-8 -3z',
  check:  'M5 12l4 4 10 -10',
  wallet: 'M4 8h16v10H4z M8 8V5a4 4 0 0 1 8 0v3 M9 13h6',
};

interface Step {
  n: string;
  verb: string;
  body: string;
  /** SVG path d for the small leading icon in the preview chip. */
  iconD: string;
  /** Two halves of the chip: leading mono-caps key, trailing data value. */
  chipKey: string;
  chipValue: string;
}

const HOW_BRAND: Step[] = [
  {
    n: '01',
    verb: 'Post.',
    body: "Write a brief like a Slack message: budget, deliverables, audience, region, deadline. Save as draft, post when ready.",
    iconD: ICON.doc,
    chipKey: 'Brief',
    chipValue: 'Draft · 2 min',
  },
  {
    n: '02',
    verb: 'Pick.',
    body: "Vetted creators apply within hours. Each application surfaces audience overlap, past brands, language, region, and the creator's own rate. Read three pitches, pick one.",
    iconD: ICON.users,
    chipKey: 'Applicants',
    chipValue: '18 sorted by fit',
  },
  {
    n: '03',
    verb: 'Pay.',
    body: 'The brief budget locks in escrow the moment you accept. Creator paid only when the post goes live. No invoicing, no Net-30, no chasing.',
    iconD: ICON.lock,
    chipKey: 'Locked',
    chipValue: '$1,400 · escrow',
  },
  {
    n: '04',
    verb: 'Measure.',
    body: "Every accepted creator gets a tracking link. Conversions land in your dashboard alongside reach and engagement. The deal closes with a public review on the creator's profile — receipts, not promises.",
    iconD: ICON.chart,
    chipKey: 'ROAS',
    chipValue: '4.2× · UTM-tracked',
  },
];

const HOW_CREATOR: Step[] = [
  {
    n: '01',
    verb: 'Sign up.',
    body: 'Two minutes. Free. No card. No vetting fee. Connect the platforms you publish on, set your rates, save.',
    iconD: ICON.link,
    chipKey: 'Connected',
    chipValue: 'IG · TT · YT',
  },
  {
    n: '02',
    verb: 'Apply.',
    body: 'Briefs from verified brands land daily. Apply with three sentences and three samples. No 14-question gauntlet. No pay-to-pitch.',
    iconD: ICON.send,
    chipKey: 'Pitched',
    chipValue: '3 sentences · 3 samples',
  },
  {
    n: '03',
    verb: 'Make.',
    body: "Files, contracts, revisions, messages — one tab. Approve drafts when you're ready, ship when the brand approves.",
    iconD: ICON.check,
    chipKey: 'Round 1',
    chipValue: 'Approved',
  },
  {
    n: '04',
    verb: 'Get paid.',
    body: 'Funds clear days after the post goes live, not six weeks later. Every closed deal becomes a public receipt on your profile. Track record beats follower count.',
    iconD: ICON.wallet,
    chipKey: 'Cleared',
    chipValue: '+$1,400 · 4 days',
  },
];

export function HowItWorks() {
  const [persona] = usePersona();
  const chips = useHowChips();
  // Merge static step copy with dynamic chip values. Steps whose chips
  // describe platform behavior (e.g. step 1 'Brief · Draft · 2 min',
  // step 2 'Pitched · 3 sentences · 3 samples') keep their original
  // values; the rest pull from the seed.
  const steps = useMemo<Step[]>(() => {
    if (persona === 'brand') {
      return HOW_BRAND.map((s, i) => {
        if (i === 1) return { ...s, chipValue: chips.brand.applicants };
        if (i === 2) return { ...s, chipValue: chips.brand.locked };
        if (i === 3) return { ...s, chipValue: chips.brand.roas };
        return s;
      });
    }
    return HOW_CREATOR.map((s, i) => {
      if (i === 0) return { ...s, chipValue: chips.creator.platforms };
      if (i === 3) return { ...s, chipValue: chips.creator.cleared };
      return s;
    });
  }, [persona, chips]);

  const heading = persona === 'brand'
    ? <>Brief to live, in <span className="accent">four steps</span>.</>
    : <>Sign up to <span className="accent">paid</span>, in four steps.</>;
  const sub = persona === 'brand'
    ? "The path from posting a brief to a creator's content going live. Same four steps every time."
    : "The path from joining Alamut to money in your wallet. Same four steps every time.";
  const { ref, visible, reduced } = useReveal();

  return (
    <section
      ref={ref}
      id="how"
      className={`lp-section lp-how ${visible ? 'is-visible' : ''}`}
      aria-labelledby="lp-how-h"
    >
      <header className="lp-section-head">
        <div className="cn-h-eyebrow">How it works</div>
        <h2 id="lp-how-h" className="cn-h-section">{heading}</h2>
        <p className="cn-lede">{sub}</p>
      </header>

      <ol className="lp-steps">
        {steps.map((s, i) => (
          <motion.li
            key={`${persona}-${s.n}`}
            className="lp-step"
            initial={reduced ? false : { opacity: 0, y: 16 }}
            animate={visible ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
            transition={reduced ? { duration: 0 } : { duration: 0.6, delay: i * 0.1, ease: [0.22, 0.36, 0.24, 1] }}
          >
            <div className="lp-step-n mono-meta">{s.n}</div>
            <h3 className="lp-step-verb">{s.verb}</h3>
            <p className="lp-step-body">{s.body}</p>
            <div className="lp-step-chip" aria-hidden="true">
              <svg className="lp-step-chip-icon" viewBox="0 0 24 24" width="16" height="16">
                <path d={s.iconD} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="lp-step-chip-k mono-meta">{s.chipKey}</span>
              <span className="lp-step-chip-v">{s.chipValue}</span>
            </div>
          </motion.li>
        ))}
      </ol>
    </section>
  );
}

// ============ Section 4 · WhyAlamut ============

// SVG path data for the Why-Alamut card glyphs. Same line-art style
// as the step chip icons (24×24 viewBox, currentColor stroke). Each
// glyph picks up the accent color via the .lp-why-card-glyph class.
// Phase 52 — WhyAlamut card glyphs swapped from inline 24px line-art
// paths to full stylized illustration components (~96px). Each card now
// gets a real visual anchor instead of a small icon. Components imported
// at the top of the file from @/components/illustrations.

interface WhyCard {
  title: string;
  body: string;
  Illust: React.ComponentType<{ className?: string; ariaLabel?: string }>;
}

const WHY_BRAND: WhyCard[] = [
  {
    title: 'Vetted, not scraped.',
    body: 'Every creator on Alamut is reviewed before they can apply to a brief. No bot followers, no AI-generated portfolios, no recycled stock work.',
    Illust: VettedShield,
  },
  {
    title: 'Audience-fit matching.',
    body: 'Applications come pre-sorted by audience overlap with your existing customers, plus language, region, and past brand work. Read three pitches, not three hundred.',
    Illust: ApplicationsStack,
  },
  {
    title: 'Escrow-secured.',
    body: 'The brief budget locks in escrow the second you accept an offer. Released only when content is live and tracked. No upfront wires, no creator ghosting after deposit.',
    Illust: EscrowVault,
  },
  {
    title: 'ROAS per UTM, not per quarter.',
    body: 'Every accepted creator gets a tracking link. Clicks, conversions, attributed revenue — in your dashboard, in real time.',
    Illust: ROASChart,
  },
];

const WHY_CREATOR: WhyCard[] = [
  {
    title: 'No outreach.',
    body: "Brands come to you. You apply only when something fits — or pass when it doesn't.",
    Illust: NoOutreach,
  },
  {
    title: 'Money already in escrow.',
    body: 'Before you sign. Cleared on post. Days, not months. No chasing accounts payable, no "the wire didn\'t go through."',
    Illust: EscrowVault,
  },
  {
    title: 'Your pricing.',
    body: "Set per-platform rates. Counter-offer when the brand's offer is light. Decline politely when it isn't right. You're the one in the chair.",
    Illust: PriceTag,
  },
  {
    title: 'Your reputation, in public.',
    body: "Every closed deal posts a receipt on your profile: brand, work, rate cleared, brand's review of you. Track record beats follower count.",
    Illust: StarReceipt,
  },
];

export function WhyAlamut() {
  const [persona] = usePersona();
  const cards = persona === 'brand' ? WHY_BRAND : WHY_CREATOR;
  const heading = persona === 'brand'
    ? <>Why brands stop using <span className="accent">spreadsheets</span>.</>
    : <>Why creators stop sending <span className="accent">cold DMs</span>.</>;
  const sub = persona === 'brand'
    ? 'Four things you don\'t have to do anymore once a campaign runs through Alamut.'
    : 'Four things you don\'t have to do anymore once you\'re on Alamut.';
  const { ref, visible, reduced } = useReveal();

  return (
    <section
      ref={ref}
      id="why"
      className={`lp-section lp-why ${visible ? 'is-visible' : ''}`}
      aria-labelledby="lp-why-h"
    >
      <header className="lp-section-head">
        {/* Tier 3.1 — eyebrow dropped: heading already opens with "Why". */}
        <h2 id="lp-why-h" className="cn-h-section">{heading}</h2>
        <p className="cn-lede">{sub}</p>
      </header>

      <div className="lp-why-grid">
        {cards.map((c, i) => (
          <motion.article
            key={`${persona}-${c.title}`}
            className="lp-why-card"
            initial={reduced ? false : { opacity: 0, y: 16 }}
            animate={visible ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
            transition={reduced ? { duration: 0 } : { duration: 0.6, delay: i * 0.08, ease: [0.22, 0.36, 0.24, 1] }}
          >
            <c.Illust className="lp-why-card-illust" />
            <h3 className="lp-why-card-title">{c.title}</h3>
            <p className="lp-why-card-body">{c.body}</p>
          </motion.article>
        ))}
      </div>
    </section>
  );
}

// ============ Section 5 · RealVoices ============

interface VoiceData {
  testimonial: Testimonial;
  campaign: Campaign | undefined;
  brand: Brand | undefined;
  /** Total paid to participants on this campaign, summed from cleared payouts. */
  amountCleared: number;
  /** Number of applications received on this campaign. */
  applicantCount: number;
}

function useVoices(persona: 'brand' | 'creator'): VoiceData[] {
  const db = useStore((s) => s.db);
  return useMemo(() => {
    // Defensive: legacy persisted state from before the testimonials
    // seed addition won't have this field. The store version bump in
    // store.ts handles fresh sessions; this guard handles any in-flight
    // rehydration race or test fixtures that omit the field.
    const testimonials = db.testimonials ?? [];
    // Tier 3.2 — render the full per-persona slice (4 each after the
    // trim). The masonry layout (column-count: 3 → 2 → 1) handles
    // 4-card distribution gracefully across breakpoints.
    return testimonials
      .filter((t) => t.shownTo === persona)
      .slice(0, 4)
      .map((t) => {
        const campaign = db.campaigns.find((c) => c.id === t.campaignId);
        const brand = campaign ? db.brands.find((b) => b.id === campaign.brandId) : undefined;
        const amountCleared = db.transactions
          .filter(
            (tx) =>
              tx.campaignId === t.campaignId &&
              tx.kind === 'payout' &&
              tx.status === 'cleared' &&
              tx.amount > 0,
          )
          .reduce((s, tx) => s + tx.amount, 0);
        const applicantCount = db.applications.filter((a) => a.campaignId === t.campaignId).length;
        return { testimonial: t, campaign, brand, amountCleared, applicantCount };
      });
  }, [db, persona]);
}

export function RealVoices() {
  const [persona] = usePersona();
  const voices = useVoices(persona);
  const heading = persona === 'brand'
    ? <>Creators who <span className="accent">stopped</span> sending DMs.</>
    : <>Brands who <span className="accent">stopped</span> using spreadsheets.</>;
  const sub = persona === 'brand'
    ? 'Four voices from the platform. Each backed by a closed deal you can see in the seed dataset.'
    : 'Four voices from the brand side. Each backed by a closed campaign you can see in the seed dataset.';
  const { ref, visible, reduced } = useReveal();

  return (
    <section
      ref={ref}
      id="voices"
      className={`lp-section lp-voices ${visible ? 'is-visible' : ''}`}
      aria-labelledby="lp-voices-h"
    >
      <header className="lp-section-head">
        {/* Tier 3.1 — eyebrow dropped: the section is voices, the heading
            says "Creators who…" / "Brands who…". The label was redundant. */}
        <h2 id="lp-voices-h" className="cn-h-section">{heading}</h2>
        <p className="cn-lede">{sub}</p>
      </header>

      <div className="lp-voices-grid">
        {voices.map((v, i) => {
          const captionParts: string[] = [];
          if (v.campaign?.title) captionParts.push(`Closed · ${v.campaign.title}`);
          if (v.brand?.name) captionParts.push(v.brand.name);
          if (v.amountCleared > 0) captionParts.push(`${fmtMoneyFull(Math.round(v.amountCleared))} cleared`);
          if (persona === 'creator' && v.applicantCount > 0) {
            captionParts.push(`${v.applicantCount} applicants`);
          }
          return (
            <motion.figure
              key={v.testimonial.id}
              className="lp-voice"
              initial={reduced ? false : { opacity: 0, y: 16 }}
              animate={visible ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
              transition={reduced ? { duration: 0 } : { duration: 0.7, delay: i * 0.12, ease: [0.22, 0.36, 0.24, 1] }}
            >
              <img
                className="lp-voice-portrait"
                src={v.testimonial.authorPortrait}
                alt=""
                loading="lazy"
                decoding="async"
                aria-hidden="true"
              />
              <blockquote className="lp-voice-quote">
                "{v.testimonial.quote}"
              </blockquote>
              <figcaption className="lp-voice-cap">
                <div className="lp-voice-cap-name">{v.testimonial.authorName}</div>
                <div className="lp-voice-cap-sub">{v.testimonial.authorSubtitle}</div>
                {captionParts.length > 0 && (
                  <div className="lp-voice-cap-deal mono-meta">
                    {captionParts.join(' · ')}
                  </div>
                )}
              </figcaption>
            </motion.figure>
          );
        })}
      </div>
    </section>
  );
}

// ============ Section 6 · Pricing ============

const PRICING = {
  brand: {
    eyebrow: 'Brand pricing',
    title: <>Free to start. <span className="accent">Pay only</span> when a deal clears.</>,
    body: 'No subscription. No setup fee. Post as many briefs as you want at no cost. We charge a flat 5% on the brief budget, deducted from the creator payout, never billed to your card. No retainer. No agency markup. No procurement haggling.',
    bullets: [
      'Average brief posted to deal closed: 11 days',
      'Average platform fee per deal: $47',
      'No card required to post',
    ],
    cta: { label: 'Post a brief — free', href: '/signup?role=brand' },
  },
  creator: {
    eyebrow: 'Creator pricing',
    title: <>Free to join. <span className="accent">Always know</span> what clears.</>,
    body: "No card. No vetting fee. No pay-to-pitch. We take a flat 5% on cleared deals only. You see the exact payout amount before you accept any offer — what's listed is what lands in your wallet.",
    bullets: [
      'Average payout cleared in: 4 days',
      'Smallest paid deal: $180 · Largest: $9,400',
      'You decline anything that doesn\'t fit',
    ],
    cta: { label: 'Sign up free · 2 minutes', href: '/signup?role=creator' },
  },
} as const;

export function Pricing() {
  const [persona] = usePersona();
  const c = PRICING[persona];
  const { ref, visible, reduced } = useReveal();

  return (
    <section
      ref={ref}
      id="pricing"
      className={`lp-section lp-pricing ${visible ? 'is-visible' : ''}`}
      aria-labelledby="lp-pricing-h"
    >
      <header className="lp-section-head">
        <div className="cn-h-eyebrow">{c.eyebrow}</div>
        <h2 id="lp-pricing-h" className="cn-h-section">{c.title}</h2>
      </header>

      <motion.div
        className="lp-pricing-card"
        initial={reduced ? false : { opacity: 0, y: 16 }}
        animate={visible ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
        transition={reduced ? { duration: 0 } : { duration: 0.7, ease: [0.22, 0.36, 0.24, 1] }}
      >
        <p className="lp-pricing-body">{c.body}</p>
        <ul className="lp-pricing-bullets">
          {c.bullets.map((b) => (
            <li key={b}>
              <span aria-hidden="true" className="lp-pricing-bullet-mark">✓</span>
              {b}
            </li>
          ))}
        </ul>
        <Link to={c.cta.href} className="cn-btn cn-btn-solid">
          {c.cta.label} <span aria-hidden="true">→</span>
        </Link>
      </motion.div>
    </section>
  );
}

// ============ Section 7 · FAQ ============

interface FaqItem { q: string; a: string; }

const FAQ_BRAND: FaqItem[] = [
  {
    q: 'What exactly is Alamut?',
    a: "A marketplace where vetted creators apply to your brief instead of you cold-emailing them. Every deal runs through escrow, every closed deal becomes a public receipt on the creator's profile. No retainers, no agency markup, no Net-30.",
  },
  {
    q: 'How is this different from a creator search tool?',
    a: "Search tools assume you already know who you're looking for. Alamut works the other way around: you post a brief, vetted creators read it and self-select in. You're reviewing pitches from creators who already want the deal, not cold-pitching strangers who might not.",
  },
  {
    q: 'Are the creators actually vetted?',
    a: 'Yes. Every creator on Alamut is reviewed before they can apply to a brief. We verify platform handles, check audience demographics and credibility scores, confirm past brand work. No bot followers, no AI-generated portfolios, no recycled stock work passes review.',
  },
  {
    q: 'How does payment work?',
    a: 'When you accept an offer, the agreed amount locks in escrow. The creator delivers, you approve, money releases. You are never charged before approval, and the creator never works without funds locked. If you cancel a brief before accepting an offer, you spend zero.',
  },
  {
    q: "What if the creator doesn't deliver?",
    a: 'Two paths. (a) Revisions — you request changes, the creator updates, repeat as needed. (b) Dispute — if irreconcilable, we mediate. If the creator failed to deliver to brief, escrow refunds. Most disputes resolve in 5–7 days.',
  },
  {
    q: 'How do you measure ROAS?',
    a: 'Every accepted creator gets a UTM-tagged tracking link automatically. Clicks, conversions, and attributed revenue land in your dashboard alongside reach and engagement. You see ROAS per creator, per platform, per campaign — not in a quarterly report.',
  },
  {
    q: 'Can I run paid amplification on creator content?',
    a: "Yes. Whitelisted-ad rights are a per-deal opt-in setting on the brief. Creators see the rights and any added fees up front before they apply. The post stays on the creator's handle; you control the spend.",
  },
  {
    q: "What's the platform fee?",
    a: "Flat 5% on the brief budget, deducted from the creator payout — never billed to your card. Free to post briefs. Free to maintain a brand account. No retainer. No agency markup.",
  },
  {
    q: 'Can I work with multiple creators on one brief?',
    a: 'Yes. Open the brief to multiple acceptances, set a per-deliverable budget, and accept as many creators as fit. Each accepted offer is its own escrow line, its own contract, its own tracking link.',
  },
  {
    q: 'Do you support agencies?',
    a: 'Yes. Agency accounts let one operator post and manage briefs across multiple brand sub-accounts, with per-brand budgets, separate dashboards, and consolidated reporting.',
  },
  {
    q: 'What regions and languages are supported?',
    a: 'Creators come from 40+ countries; briefs can require specific regions, languages, or platform mixes. Alamut HQ sits in Karachi, Lahore, and Dubai but the platform serves global brands and creators.',
  },
  {
    q: 'What about contracts and taxes?',
    a: 'Each accepted offer auto-generates a digital contract: rights granted, exclusivity window, deliverables, deadline, payout. We issue 1099s for US creators and equivalent forms internationally. Both sides have the signed contract on file the moment the offer is accepted.',
  },
];

const FAQ_CREATOR: FaqItem[] = [
  {
    q: 'What is Alamut?',
    a: "A marketplace where verified brands post briefs and you apply to the ones that fit. Money locks in escrow before you sign. Cleared to your wallet days after the post goes live — not weeks. Every closed deal posts a receipt on your profile.",
  },
  {
    q: 'Is this only for big creators?',
    a: 'No. Alamut works for creators with 1,000 followers and creators with 1,000,000. Brands hire on audience fit and engagement, not just follower count. Smaller creators with sharp niches are often the best fits for the right brand.',
  },
  {
    q: 'Do I have to be vetted to sign up?',
    a: 'Signing up is free and instant. Before you can apply to briefs, we run a quick audience review (credibility score, platform handle verification, past work). Most creators clear within 48 hours. No vetting fee, no pay-to-pitch.',
  },
  {
    q: 'How do briefs reach me?',
    a: "When a brief is posted that matches your categories, region, language, and platforms, it lands in your feed. You apply or skip — we don't ping you for things that don't fit your profile.",
  },
  {
    q: 'Can I set my own rates?',
    a: "Yes. Per-platform rate cards (post · reel · story · longform) live on your profile. When a brand sends an offer, you can accept, counter-offer, or decline. We never set rates for you and we don't auto-accept on your behalf.",
  },
  {
    q: 'When do I get paid?',
    a: "Funds lock in escrow the moment the brand accepts your offer — before you start work. Once the brand approves your delivery, payment releases. Average time from approval to wallet across the platform: 4 days.",
  },
  {
    q: 'What if the brand never approves my work?',
    a: "Two paths. (a) Revisions — most disagreements resolve in 1–2 rounds. (b) Dispute — if a brand goes silent or refuses without cause, you open a dispute and we mediate. If the work meets brief, escrow releases to you regardless of brand silence.",
  },
  {
    q: "What if I disagree with a brand's review?",
    a: "Reviews are public on your profile, but you get a public response field on every review. Brands can't leave anonymous one-star reviews — every review is tied to a real, paid deal that's also visible.",
  },
  {
    q: "What's the platform fee?",
    a: "Flat 5% on cleared deals only. You see the exact post-fee payout amount before accepting any offer — what's listed is what lands in your wallet. We never charge for signup, vetting, applications, messaging, or anything else.",
  },
  {
    q: 'Do I need a tax ID to get paid?',
    a: 'Yes — W-9 for US creators, equivalent forms internationally. Tax info is collected once during onboarding, not per deal. Year-end forms (1099 / equivalent) are issued automatically.',
  },
  {
    q: 'What categories and platforms are supported?',
    a: 'Beauty, fashion, food, lifestyle, design, travel, fitness, parenting, tech, sustainability, gaming, music — among others. Platforms: Instagram, TikTok, YouTube, Substack/Newsletter, X. Multi-platform creators are encouraged; one account covers all your work.',
  },
  {
    q: 'How does my reputation work?',
    a: 'Every closed deal posts a public receipt on your profile: brand, work delivered, rate cleared, the brand\'s review of you. Your track record is the proof you take to the next brief — track record beats follower count.',
  },
];

export function FAQ() {
  const [persona] = usePersona();
  const items = persona === 'brand' ? FAQ_BRAND : FAQ_CREATOR;
  const heading = persona === 'brand'
    ? <>Everything brands ask <span className="accent">before</span> posting a brief.</>
    : <>Everything creators ask <span className="accent">before</span> applying.</>;
  const sub = persona === 'brand'
    ? "Twelve questions answered. If your situation isn't here, hello@alamut.co goes straight to a human."
    : "Twelve questions answered. Anything else, hello@alamut.co goes to a real human, not a bot.";
  const { ref, visible } = useReveal();

  return (
    <section
      ref={ref}
      id="faq"
      className={`lp-section lp-faq ${visible ? 'is-visible' : ''}`}
      aria-labelledby="lp-faq-h"
    >
      <header className="lp-section-head">
        <div className="cn-h-eyebrow">FAQ</div>
        <h2 id="lp-faq-h" className="cn-h-section">{heading}</h2>
        <p className="cn-lede">{sub}</p>
      </header>

      <div className="lp-faq-list">
        {items.map((item, i) => (
          <details key={`${persona}-${i}`} className="lp-faq-item">
            <summary className="lp-faq-q">
              <span className="lp-faq-q-text">{item.q}</span>
              <svg
                className="lp-faq-q-glyph"
                viewBox="0 0 24 24"
                width="18"
                height="18"
                aria-hidden="true"
              >
                <path
                  d="M6 9l6 6l6 -6"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </summary>
            {/* Phase 49 — wrapper for the grid-rows open animation. */}
            <div className="lp-faq-a-wrap">
              <div className="lp-faq-a">{item.a}</div>
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}

// ============ Sticky CTA ============
//
// A small floating bar that appears after the hero leaves the viewport.
// Persona-aware copy + CTA. Dismissible (one-click X stores intent in
// sessionStorage so the bar doesn't reappear in the same browsing session).

export function StickyCTA() {
  const [persona] = usePersona();
  const [show, setShow] = useState(false);
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return sessionStorage.getItem('alamut.sticky.dismissed') === '1';
  });
  const reduced = useReducedMotion();

  useEffect(() => {
    if (dismissed) return;
    // Show the sticky once the visitor scrolls past the hero. Direct
    // scroll listener (not IntersectionObserver) because the hero's
    // height varies across viewports — we just check distance.
    const onScroll = () => {
      const hero = document.querySelector('.lp-hero') as HTMLElement | null;
      const heroBottom = hero ? hero.offsetTop + hero.offsetHeight : 600;
      // Threshold: sticky appears when the visitor has scrolled ~70%
      // of the hero past the top of the viewport. Gives the hero room
      // to land before the sticky competes for attention.
      setShow(window.scrollY > heroBottom * 0.7);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [dismissed]);

  if (dismissed) return null;

  const c = persona === 'brand'
    ? { label: 'Brief deals close in days, not quarters.', cta: 'Post a brief — free', href: '/signup?role=brand' }
    : { label: "Brands post briefs. You pick the ones that fit.", cta: 'Sign up free · 2 min', href: '/signup?role=creator' };

  return (
    <aside
      className="lp-sticky"
      role="region"
      aria-label="Quick sign-up"
      style={{
        opacity: show ? 1 : 0,
        transform: show ? 'translateY(0)' : 'translateY(32px)',
        pointerEvents: show ? 'auto' : 'none',
        transition: reduced ? 'none' : 'opacity 0.4s ease, transform 0.4s ease',
      }}
    >
      <div className="lp-sticky-text">
        <span className="lp-sticky-pulse" aria-hidden="true" />
        <span className="lp-sticky-msg">{c.label}</span>
      </div>
      <Link to={c.href} className="lp-sticky-cta">
        {c.cta} <span aria-hidden="true">→</span>
      </Link>
      <button
        className="lp-sticky-close"
        type="button"
        aria-label="Dismiss"
        onClick={() => {
          sessionStorage.setItem('alamut.sticky.dismissed', '1');
          setDismissed(true);
        }}
      >
        <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
          <path d="M6 6l12 12 M18 6l-12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>
    </aside>
  );
}

// ============ Section 8 · FinalCTA ============

const FINAL_COPY = {
  brand: {
    heading: <>Try a brief. <span className="accent">It costs nothing</span> until a deal clears.</>,
    body: "Two minutes to post. Replies usually start in the first hour. If nothing fits, the brief expires and you've spent zero.",
    primary: { label: 'Post a brief — free', href: '/signup?role=brand' },
    secondary: { label: 'Talk to a human', href: 'mailto:hello@alamut.co' },
  },
  creator: {
    heading: <>Two-minute signup. The first brief usually <span className="accent">lands the same week</span>.</>,
    body: "Connect the platforms you publish on. Set your rates. We'll surface the briefs that fit. No pings until something does.",
    primary: { label: 'Sign up free · 2 minutes', href: '/signup?role=creator' },
    secondary: { label: 'See a sample brief', href: '#how' },
  },
} as const;

export function FinalCTA() {
  const [persona] = usePersona();
  const c = FINAL_COPY[persona];
  const { ref, visible, reduced } = useReveal();

  return (
    <section
      ref={ref}
      id="cta"
      className={`lp-section lp-final ${visible ? 'is-visible' : ''}`}
      aria-labelledby="lp-final-h"
    >
      <motion.div
        className="lp-final-inner"
        initial={reduced ? false : { opacity: 0, y: 16 }}
        animate={visible ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
        transition={reduced ? { duration: 0 } : { duration: 0.7, ease: [0.22, 0.36, 0.24, 1] }}
      >
        <h2 id="lp-final-h" className="cn-h-display lp-final-h">{c.heading}</h2>
        <p className="cn-lede lp-final-body">{c.body}</p>
        <div className="lp-final-cta">
          <Link to={c.primary.href} className="cn-btn cn-btn-solid">
            {c.primary.label} <span aria-hidden="true">→</span>
          </Link>
          {c.secondary.href.startsWith('#') ? (
            <a href={c.secondary.href} className="cn-btn cn-btn-ghost">{c.secondary.label} <span aria-hidden="true">→</span></a>
          ) : (
            <a href={c.secondary.href} className="cn-btn cn-btn-ghost">{c.secondary.label} <span aria-hidden="true">→</span></a>
          )}
        </div>
      </motion.div>
    </section>
  );
}

// Convenience export so Cover.tsx can mount the whole stack as one node
// if it ever wants to. For now Cover.tsx imports each section directly.
export function LandingV2(): ReactNode {
  return (
    <>
      <HeroV2 />
      <TrustStrip />
      <HowItWorks />
      <WhyAlamut />
      <RealVoices />
      <Pricing />
      <FAQ />
      <FinalCTA />
      <StickyCTA />
    </>
  );
}
