// AnimatedHeroIllustration — animated variant of HeroIllustration for
// the /landing-preview surface (Phase 60 Tier-1 quick wins).
//
// Layered animations on top of the base illustration:
//   1. Two dashed connection lines draw on via pathLength 0 → 1 on mount.
//   2. Money chip counts up from $0 to the most-recent real cleared
//      payout amount, taken from the seed transaction ledger.
//   3. Creator avatar (bottom-left satellite) cycles through real seeded
//      creator portraits with a soft crossfade every ~4 seconds.
//   4. Brand mark (top-right satellite) crossfades through the real
//      brand `logoMark` initials paired to each rotating creator's
//      most-recent cleared deal — so visual identity tells a real
//      "this creator × this brand" story, not random pairings.
//   5. Four floating accent dots drift on a slow vertical loop.
//
// Honors prefers-reduced-motion: dashes appear instantly, count-up jumps
// straight to target, rotation pauses, dots stay still. Filter IDs are
// namespaced (`ahero-*`) so they don't collide with the original
// `HeroIllustration` if both ever render on the same page.

import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { useStore } from '@/lib/api/store';

interface AnimatedHeroIllustrationProps {
  className?: string;
}

interface CreatorBrandPair {
  portrait: string;
  brandMark: string;
  name: string;
  brandName: string;
}

export function AnimatedHeroIllustration({ className }: AnimatedHeroIllustrationProps) {
  const reduced = useReducedMotion();
  const db = useStore((s) => s.db);

  // Build the rotation pool from cleared payouts so each frame in the
  // crossfade reflects a real closed deal in the seed dataset. Falls
  // back to verified creators × verified brands if the seed has no
  // cleared payouts (defensive — shouldn't happen on a hydrated store).
  const pairs = useMemo<CreatorBrandPair[]>(() => {
    const out: CreatorBrandPair[] = [];
    const seen = new Set<string>();
    const payouts = db.transactions
      .filter(
        (t) =>
          t.kind === 'payout' &&
          t.status === 'cleared' &&
          t.amount > 0 &&
          t.campaignId,
      )
      .sort((a, b) => +new Date(b.at) - +new Date(a.at));
    for (const t of payouts) {
      const campaign = db.campaigns.find((c) => c.id === t.campaignId);
      const creator = db.creators.find((cr) => cr.userId === t.userId);
      const brand = campaign
        ? db.brands.find((b) => b.id === campaign.brandId)
        : undefined;
      if (!campaign || !creator || !brand || !creator.portrait) continue;
      const key = `${creator.id}:${brand.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        portrait: creator.portrait,
        brandMark: brand.logoMark || brand.name[0] || '·',
        name: creator.name,
        brandName: brand.name,
      });
      if (out.length >= 5) break;
    }
    if (out.length === 0) {
      const creators = db.creators
        .filter((c) => c.verified && c.portrait)
        .slice(0, 4);
      const brands = db.brands.filter((b) => b.verified).slice(0, 4);
      for (let i = 0; i < creators.length && i < brands.length; i++) {
        const cr = creators[i];
        const br = brands[i];
        if (!cr.portrait) continue;
        out.push({
          portrait: cr.portrait,
          brandMark: br.logoMark || br.name[0] || '·',
          name: cr.name,
          brandName: br.name,
        });
      }
    }
    return out;
  }, [db]);

  // Most-recent cleared payout amount — feeds the count-up money chip.
  // Falls back to a sensible $1,400 if the ledger is empty.
  const targetAmount = useMemo(() => {
    const t = db.transactions
      .filter(
        (tx) => tx.kind === 'payout' && tx.status === 'cleared' && tx.amount > 0,
      )
      .sort((a, b) => +new Date(b.at) - +new Date(a.at))[0];
    return t ? Math.round(t.amount) : 1400;
  }, [db.transactions]);

  // Rotation index — advances every 4s. Paused under prefers-reduced-motion
  // and when the pool has only one pair (no point swapping a single frame
  // with itself).
  const [activeIdx, setActiveIdx] = useState(0);
  useEffect(() => {
    if (reduced || pairs.length <= 1) return;
    const id = setInterval(() => {
      setActiveIdx((i) => (i + 1) % pairs.length);
    }, 4000);
    return () => clearInterval(id);
  }, [reduced, pairs.length]);

  // Count-up trigger — fires shortly after mount so the climb reads as
  // animation rather than a static initial value.
  const [countStart, setCountStart] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setCountStart(true), 600);
    return () => clearTimeout(t);
  }, []);
  const animatedAmount = useCountUp(targetAmount, 1800, countStart);

  const active = pairs[activeIdx] ?? null;
  const ariaLabel = active
    ? `${active.name} cleared a payout from ${active.brandName} on Alamut`
    : 'Creator and brand collaboration';

  return (
    <svg
      viewBox="0 0 600 540"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={ariaLabel}
      className={className}
    >
      <defs>
        <clipPath id="ahero-portrait-clip">
          <circle cx="130" cy="360" r="44" />
        </clipPath>
        <radialGradient id="ahero-halo" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="var(--cn-accent)" stopOpacity="0.32" />
          <stop offset="55%" stopColor="var(--cn-accent)" stopOpacity="0.10" />
          <stop offset="100%" stopColor="var(--cn-accent)" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="ahero-card" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="oklch(1 0 0)" />
          <stop offset="100%" stopColor="oklch(0.97 0.005 60)" />
        </linearGradient>
        <filter
          id="ahero-shadow"
          x="-20%"
          y="-20%"
          width="140%"
          height="140%"
        >
          <feDropShadow
            dx="0"
            dy="12"
            stdDeviation="14"
            floodColor="oklch(0.20 0.012 270)"
            floodOpacity="0.18"
          />
        </filter>
        <filter
          id="ahero-avatar-shadow"
          x="-30%"
          y="-30%"
          width="160%"
          height="160%"
        >
          <feDropShadow
            dx="0"
            dy="6"
            stdDeviation="8"
            floodColor="oklch(0.20 0.012 270)"
            floodOpacity="0.16"
          />
        </filter>
      </defs>

      {/* Halo */}
      <ellipse cx="300" cy="270" rx="280" ry="220" fill="url(#ahero-halo)" />

      {/* Connection lines — draw on via pathLength */}
      <motion.path
        d="M 130 360 Q 240 220 300 250"
        fill="none"
        stroke="var(--cn-rule-strong)"
        strokeWidth="1.5"
        strokeDasharray="3 5"
        opacity="0.55"
        initial={reduced ? false : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={
          reduced
            ? { duration: 0 }
            : { duration: 1.4, delay: 0.4, ease: [0.22, 0.36, 0.24, 1] }
        }
      />
      <motion.path
        d="M 470 180 Q 380 220 300 250"
        fill="none"
        stroke="var(--cn-rule-strong)"
        strokeWidth="1.5"
        strokeDasharray="3 5"
        opacity="0.55"
        initial={reduced ? false : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={
          reduced
            ? { duration: 0 }
            : { duration: 1.4, delay: 0.6, ease: [0.22, 0.36, 0.24, 1] }
        }
      />

      {/* Central deal card */}
      <g filter="url(#ahero-shadow)">
        <rect
          x="180"
          y="200"
          width="240"
          height="160"
          rx="18"
          fill="url(#ahero-card)"
          stroke="oklch(0.90 0.005 270)"
          strokeWidth="1"
        />
        <rect
          x="200"
          y="222"
          width="80"
          height="10"
          rx="5"
          fill="var(--cn-accent)"
          opacity="0.85"
        />
        <rect
          x="200"
          y="244"
          width="170"
          height="14"
          rx="4"
          fill="oklch(0.20 0.012 270)"
          opacity="0.85"
        />
        <rect
          x="200"
          y="266"
          width="130"
          height="10"
          rx="3"
          fill="oklch(0.50 0.008 270)"
          opacity="0.50"
        />
        {/* Money chip — counts up from 0 → real cleared amount */}
        <rect
          x="276"
          y="318"
          width="138"
          height="28"
          rx="14"
          fill="oklch(0.20 0.012 270)"
        />
        <text
          x="345"
          y="337"
          textAnchor="middle"
          fontFamily="var(--cn-mono)"
          fontSize="12"
          fill="oklch(1 0 0)"
          fontWeight="500"
        >
          +${animatedAmount.toLocaleString()}
        </text>
      </g>

      {/* Creator avatar — bottom-left satellite — rotates through real seed */}
      <g filter="url(#ahero-avatar-shadow)">
        <circle
          cx="130"
          cy="360"
          r="44"
          fill="oklch(1 0 0)"
          stroke="oklch(0.90 0.005 270)"
          strokeWidth="1.5"
        />
        <AnimatePresence initial={false}>
          {active && (
            <motion.image
              key={active.portrait}
              href={active.portrait}
              x="86"
              y="316"
              width="88"
              height="88"
              preserveAspectRatio="xMidYMid slice"
              clipPath="url(#ahero-portrait-clip)"
              initial={reduced ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={reduced ? undefined : { opacity: 0 }}
              transition={
                reduced ? { duration: 0 } : { duration: 1.0, ease: 'easeOut' }
              }
            />
          )}
        </AnimatePresence>
        {/* Ring on top of portrait for crisp edge */}
        <circle
          cx="130"
          cy="360"
          r="44"
          fill="none"
          stroke="oklch(0.90 0.005 270)"
          strokeWidth="1.5"
        />
      </g>

      {/* Brand mark — top-right satellite — rotates */}
      <g filter="url(#ahero-avatar-shadow)">
        <rect
          x="436"
          y="146"
          width="68"
          height="68"
          rx="14"
          fill="oklch(1 0 0)"
          stroke="oklch(0.90 0.005 270)"
          strokeWidth="1.5"
        />
        <AnimatePresence initial={false}>
          {active && (
            <motion.text
              key={active.brandMark + ':' + activeIdx}
              x="470"
              y="190"
              textAnchor="middle"
              fontFamily="var(--cn-serif)"
              fontSize="32"
              fontStyle="italic"
              fontWeight="400"
              fill="oklch(0.20 0.012 270)"
              initial={reduced ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={reduced ? undefined : { opacity: 0 }}
              transition={
                reduced ? { duration: 0 } : { duration: 1.0, ease: 'easeOut' }
              }
            >
              {active.brandMark}
            </motion.text>
          )}
        </AnimatePresence>
      </g>

      {/* New-deal "+" badge — top-right of central card */}
      <g filter="url(#ahero-avatar-shadow)">
        <circle cx="416" cy="208" r="20" fill="var(--cn-accent)" />
        <path
          d="M 408 208 h 16 M 416 200 v 16"
          stroke="oklch(1 0 0)"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      </g>

      {/* Floating accent dots — slow vertical drift loop */}
      <FloatingDot cx={84} cy={200} r={3} opacity={0.45} delay={0} reduced={reduced} />
      <FloatingDot cx={520} cy={380} r={2.5} opacity={0.45} delay={0.8} reduced={reduced} />
      <FloatingDot cx={430} cy={430} r={3.5} opacity={0.30} delay={1.6} reduced={reduced} />
      <FloatingDot cx={80} cy={100} r={2} opacity={0.30} delay={2.4} reduced={reduced} />
    </svg>
  );
}

interface FloatingDotProps {
  cx: number;
  cy: number;
  r: number;
  opacity: number;
  delay: number;
  reduced: boolean | null;
}

function FloatingDot({ cx, cy, r, opacity, delay, reduced }: FloatingDotProps) {
  if (reduced) {
    return (
      <circle cx={cx} cy={cy} r={r} fill="var(--cn-accent)" opacity={opacity} />
    );
  }
  return (
    <motion.circle
      cx={cx}
      r={r}
      fill="var(--cn-accent)"
      animate={{ cy: [cy, cy - 6, cy] }}
      transition={{
        duration: 4.5,
        delay,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
      style={{ opacity }}
    />
  );
}

// Animated number that counts up from 0 → target. Duplicated from
// LandingV2.tsx so this preview surface stays self-contained and doesn't
// reach across files. Honors prefers-reduced-motion by jumping to target.
function useCountUp(target: number, duration = 1600, start = false): number {
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
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(target * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, start, reduced]);
  return value;
}
