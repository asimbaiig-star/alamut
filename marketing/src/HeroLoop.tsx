// HeroLoop — 8-second hero animation rendered to mp4 + webm for the
// /landing-preview-video surface in the app.
//
// Visual identity mirrors `AnimatedHeroIllustration.tsx` in the app so
// the video drops in as a 1:1 replacement of the SVG illustration. The
// loop runs an A→B→A pair swap so it can play `autoplay loop` on the
// landing without a visible jump between iterations.
//
//   0–2s   Sarah Johnson × Aesop · $1,400 cleared (stable)
//   2–4s   Crossfade portrait + brand mark + money chip → Yuki × Hay
//   4–6s   Yuki Tanaka × Hay · $2,200 cleared (stable)
//   6–8s   Crossfade back to Sarah × Aesop · $1,400 (so frame 240 = 0)
//
// Continuous-loop accents: halo radial gradient breathes, the four
// floating accent dots drift on out-of-phase sine waves. The dashed
// connection lines stay fully drawn (the looped video has no first-paint
// "draw on" beat — that animation only makes sense once).
//
// Portrait sources: two real seed portraits downloaded into
// `marketing/public/`. `staticFile()` resolves them at render time so
// the render is deterministic and doesn't depend on Unsplash being up.

import {
  AbsoluteFill,
  Easing,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';

const PAIR_A = {
  portrait: staticFile('sarah.jpg'),
  brandMark: 'A',
  amount: 1400,
} as const;

const PAIR_B = {
  portrait: staticFile('yuki.jpg'),
  brandMark: 'H',
  amount: 2200,
} as const;

const EASE = Easing.bezier(0.22, 0.36, 0.24, 1);

export const HeroLoop: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames, fps } = useVideoConfig();

  // Pair A (Sarah × Aesop) opacity timeline — full at the loop boundary,
  // zero in the middle. interpolate handles the multi-stop ramp.
  const opacityA = interpolate(
    frame,
    [0, 60, 120, 180, 240],
    [1, 1, 0, 0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE },
  );

  // Pair B (Yuki × Hay) — opposite phase.
  const opacityB = interpolate(
    frame,
    [0, 60, 120, 180, 240],
    [0, 0, 1, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE },
  );

  // Money chip — interpolates between the two real cleared amounts.
  const amount = interpolate(
    frame,
    [0, 60, 120, 180, 240],
    [PAIR_A.amount, PAIR_A.amount, PAIR_B.amount, PAIR_B.amount, PAIR_A.amount],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE },
  );

  // Halo breath — 0.32 → 0.40 → 0.32 over a 6-second cycle (180 frames),
  // independent of pair swap so the canvas always feels alive.
  const haloOpacity =
    0.32 + Math.sin(((frame % 180) / 180) * Math.PI * 2) * 0.04;

  // Per-dot drift offset. Each dot gets a different phase via the delay
  // argument so they don't move in lockstep.
  const driftY = (delaySeconds: number) => {
    const cycle = 4.5 * fps; // 4.5-second sine loop
    const t = ((frame + delaySeconds * fps) % cycle) / cycle;
    return Math.sin(t * Math.PI * 2) * 6;
  };

  return (
    <AbsoluteFill
      style={{
        // Match the landing-light hero gradient backing so the video
        // blends with `.creator-hero-v2` without needing alpha. The
        // hero CSS is roughly `linear-gradient(180deg, accent@7%, bg)`;
        // sampling the midpoint where the illust sits ≈ #fbf6ef.
        backgroundColor: '#fbf6ef',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <svg
        viewBox="0 0 600 540"
        width={600}
        height={540}
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <clipPath id="portrait-clip">
            <circle cx="130" cy="360" r="44" />
          </clipPath>
          <radialGradient id="halo" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#c66236" stopOpacity={haloOpacity.toFixed(3)} />
            <stop offset="55%" stopColor="#c66236" stopOpacity={(haloOpacity * 0.31).toFixed(3)} />
            <stop offset="100%" stopColor="#c66236" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="card" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="100%" stopColor="#f9f7f4" />
          </linearGradient>
          <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow
              dx="0"
              dy="12"
              stdDeviation="14"
              floodColor="#2a2a35"
              floodOpacity="0.18"
            />
          </filter>
          <filter id="avatar-shadow" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow
              dx="0"
              dy="6"
              stdDeviation="8"
              floodColor="#2a2a35"
              floodOpacity="0.16"
            />
          </filter>
        </defs>

        {/* Halo */}
        <ellipse cx="300" cy="270" rx="280" ry="220" fill="url(#halo)" />

        {/* Connection lines — fully drawn (loop has no first-paint moment) */}
        <path
          d="M 130 360 Q 240 220 300 250"
          fill="none"
          stroke="#7a7480"
          strokeWidth="1.5"
          strokeDasharray="3 5"
          opacity="0.55"
        />
        <path
          d="M 470 180 Q 380 220 300 250"
          fill="none"
          stroke="#7a7480"
          strokeWidth="1.5"
          strokeDasharray="3 5"
          opacity="0.55"
        />

        {/* Central deal card with animated money chip */}
        <g filter="url(#shadow)">
          <rect
            x="180"
            y="200"
            width="240"
            height="160"
            rx="18"
            fill="url(#card)"
            stroke="#e1ddd8"
            strokeWidth="1"
          />
          <rect
            x="200"
            y="222"
            width="80"
            height="10"
            rx="5"
            fill="#c66236"
            opacity="0.85"
          />
          <rect
            x="200"
            y="244"
            width="170"
            height="14"
            rx="4"
            fill="#2a2a35"
            opacity="0.85"
          />
          <rect
            x="200"
            y="266"
            width="130"
            height="10"
            rx="3"
            fill="#7a7480"
            opacity="0.50"
          />
          <rect x="276" y="318" width="138" height="28" rx="14" fill="#2a2a35" />
          <text
            x="345"
            y="337"
            textAnchor="middle"
            fontFamily="ui-monospace, Menlo, Consolas, monospace"
            fontSize="12"
            fill="#ffffff"
            fontWeight="500"
          >
            +${Math.round(amount).toLocaleString()}
          </text>
        </g>

        {/* Creator avatar — both portraits rendered; opacity controlled */}
        <g filter="url(#avatar-shadow)">
          <circle
            cx="130"
            cy="360"
            r="44"
            fill="#ffffff"
            stroke="#e1ddd8"
            strokeWidth="1.5"
          />
          <image
            href={PAIR_A.portrait}
            x="86"
            y="316"
            width="88"
            height="88"
            preserveAspectRatio="xMidYMid slice"
            clipPath="url(#portrait-clip)"
            opacity={opacityA}
          />
          <image
            href={PAIR_B.portrait}
            x="86"
            y="316"
            width="88"
            height="88"
            preserveAspectRatio="xMidYMid slice"
            clipPath="url(#portrait-clip)"
            opacity={opacityB}
          />
          <circle
            cx="130"
            cy="360"
            r="44"
            fill="none"
            stroke="#e1ddd8"
            strokeWidth="1.5"
          />
        </g>

        {/* Brand mark — two text elements, opacity controlled */}
        <g filter="url(#avatar-shadow)">
          <rect
            x="436"
            y="146"
            width="68"
            height="68"
            rx="14"
            fill="#ffffff"
            stroke="#e1ddd8"
            strokeWidth="1.5"
          />
          <text
            x="470"
            y="190"
            textAnchor="middle"
            fontFamily="Georgia, 'Times New Roman', serif"
            fontSize="32"
            fontStyle="italic"
            fontWeight="400"
            fill="#2a2a35"
            opacity={opacityA}
          >
            {PAIR_A.brandMark}
          </text>
          <text
            x="470"
            y="190"
            textAnchor="middle"
            fontFamily="Georgia, 'Times New Roman', serif"
            fontSize="32"
            fontStyle="italic"
            fontWeight="400"
            fill="#2a2a35"
            opacity={opacityB}
          >
            {PAIR_B.brandMark}
          </text>
        </g>

        {/* New-deal "+" badge */}
        <g filter="url(#avatar-shadow)">
          <circle cx="416" cy="208" r="20" fill="#c66236" />
          <path
            d="M 408 208 h 16 M 416 200 v 16"
            stroke="#ffffff"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </g>

        {/* Floating accent dots — drift on out-of-phase sine waves */}
        <circle cx="84"  cy={200 + driftY(0)}   r="3"   fill="#c66236" opacity="0.45" />
        <circle cx="520" cy={380 + driftY(0.8)} r="2.5" fill="#c66236" opacity="0.45" />
        <circle cx="430" cy={430 + driftY(1.6)} r="3.5" fill="#c66236" opacity="0.30" />
        <circle cx="80"  cy={100 + driftY(2.4)} r="2"   fill="#c66236" opacity="0.30" />
      </svg>

      {/* useVideoConfig.durationInFrames consumed so TS doesn't flag it. */}
      <div style={{ display: 'none' }}>{durationInFrames}</div>
    </AbsoluteFill>
  );
};
