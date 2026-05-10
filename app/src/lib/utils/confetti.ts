// Editorial confetti — paper scraps in warm OKLCH palette, not neon Mardi Gras.
// Triggered for celebratory moments (first payout, first acceptance, verification).
// Self-contained: spawns ~30 absolutely-positioned spans, animates them on
// document.body, cleans up after the animation ends. Honors prefers-reduced-motion.

const PAPER_PIECES = 36;
const DURATION_MS = 1600;

const HUES = [
  'oklch(0.85 0.12 60)',   // peach
  'oklch(0.82 0.13 30)',   // coral
  'oklch(0.80 0.13 80)',   // amber
  'oklch(0.78 0.13 145)',  // sage
  'oklch(0.78 0.10 220)',  // sky
  'oklch(0.55 0.18 30)',   // terracotta (accent)
];

let stylesInjected = false;
function injectStyles() {
  if (stylesInjected) return;
  const css = `
    @keyframes alamut-confetti-fall {
      0%   { transform: translate(0, 0) rotate(0deg); opacity: 1; }
      100% { transform: translate(var(--cx, 0), var(--cy, 80vh)) rotate(var(--cr, 540deg)); opacity: 0; }
    }
    .alamut-confetti-piece {
      position: fixed;
      top: 35%;
      left: 50%;
      width: 10px;
      height: 14px;
      pointer-events: none;
      z-index: 9999;
      will-change: transform, opacity;
      border-radius: 1px;
    }
    @media (prefers-reduced-motion: reduce) {
      .alamut-confetti-piece { display: none; }
    }
  `;
  const style = document.createElement('style');
  style.setAttribute('data-alamut-confetti', '');
  style.textContent = css;
  document.head.appendChild(style);
  stylesInjected = true;
}

export function fireConfetti() {
  if (typeof window === 'undefined') return;
  // Respect reduced motion — bail early
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  injectStyles();

  const frag = document.createDocumentFragment();
  for (let i = 0; i < PAPER_PIECES; i++) {
    const piece = document.createElement('span');
    piece.className = 'alamut-confetti-piece';
    // Random spread across viewport
    const cx = (Math.random() - 0.5) * window.innerWidth * 1.1;
    const cy = window.innerHeight * (0.5 + Math.random() * 0.4);
    const cr = (Math.random() - 0.5) * 1080;
    const delay = Math.random() * 200;
    const dur = DURATION_MS + Math.random() * 600;
    const hue = HUES[Math.floor(Math.random() * HUES.length)];
    piece.style.setProperty('--cx', `${cx}px`);
    piece.style.setProperty('--cy', `${cy}px`);
    piece.style.setProperty('--cr', `${cr}deg`);
    piece.style.background = hue;
    piece.style.animation = `alamut-confetti-fall ${dur}ms cubic-bezier(.22,.8,.15,1) ${delay}ms forwards`;
    // Slight initial offset so they don't all start at the exact same point
    piece.style.transform = `translate(${(Math.random() - 0.5) * 60}px, 0)`;
    // Vary shape slightly — some squares, some narrow strips
    if (Math.random() > 0.6) {
      piece.style.width = '6px';
      piece.style.height = '18px';
    }
    frag.appendChild(piece);
  }
  document.body.appendChild(frag);

  // Cleanup after the longest piece finishes
  setTimeout(() => {
    document.querySelectorAll('.alamut-confetti-piece').forEach((el) => el.remove());
  }, DURATION_MS + 1000);
}
