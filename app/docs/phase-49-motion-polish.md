# Phase 49 — Motion polish pass (planned)

Eight tightly-scoped fixes to consolidate the landing page's motion
system. None are urgent; all are diminishing-returns polish that takes
a competent landing page to a *poised* one.

The page itself is already shippable — the cinematic hero entrance,
section reveals, sticky CTA, and accordion all work and respect
`prefers-reduced-motion`. This pass is about cohesion, not features.

When picking this up, do all eight in order — they reinforce each
other. Order is biggest-impact-first, but #1 and #2 establish tokens
the rest of the pass references.

---

## 1. Establish motion tokens

**Where:** `app/src/styles/cinematic.css`, near the top of the file
(near the `--cn-*` palette tokens, before any landing-page rules).

**Why:** Currently using six different durations (0.3 / 0.4 / 0.5 / 0.6
/ 0.7 / 0.85 / 0.9) and three different easings. No system. Other
fixes will reference these.

**Add:**

```css
:root {
  /* Motion tokens — three canonical durations + two canonical easings.
     Every transition / motion delay should pull from these. */
  --motion-fast:    140ms;   /* hover, button state, accordion chevron */
  --motion-medium:  420ms;   /* section reveals, card lifts, sticky fade */
  --motion-slow:    720ms;   /* hero entrance choreography only */

  --ease-out:    cubic-bezier(0.22, 0.36, 0.24, 1);  /* entrance / arrival */
  --ease-state:  cubic-bezier(0.4, 0, 0.2, 1);       /* hover / state change */
}
```

Then sweep: replace all `0.3s` / `0.4s` / `0.6s` / `0.7s` etc. with
`var(--motion-fast)` / `var(--motion-medium)` / `var(--motion-slow)`,
and replace `cubic-bezier(0.22, 0.36, 0.24, 1)` literals with
`var(--ease-out)`. Same for inline motion props in `LandingV2.tsx`
(use the duration constants).

**Effort:** Small (~20 min, mostly find-and-replace with verification).

---

## 2. `scroll-behavior: smooth` for anchor navigation

**Where:** `app/src/styles/cinematic.css`, root-level rule.

**Why:** Clicking nav links (`#how`, `#voices`, `#pricing`, `#faq`)
currently jumps the page instantly. Trivial fix, high felt impact.

**Add:**

```css
html {
  scroll-behavior: smooth;
}
@media (prefers-reduced-motion: reduce) {
  html { scroll-behavior: auto; }
}
```

**Effort:** Trivial.

---

## 3. Card hover lift

**Where:** `app/src/styles/cinematic.css`, in the existing
`.lp-why-card`, `.lp-voice`, `.lp-pricing-card` rules.

**Why:** All three cards sit static. Standard polish: subtle 2px lift
+ shadow shift on hover. Already-existing visual cue absent.

**Add to each card rule:**

```css
.lp-why-card,
.lp-voice,
.lp-pricing-card {
  transition: transform var(--motion-fast) var(--ease-state),
              border-color var(--motion-fast) var(--ease-state),
              box-shadow var(--motion-fast) var(--ease-state);
}
.lp-why-card:hover,
.lp-voice:hover,
.lp-pricing-card:hover {
  transform: translateY(-2px);
  border-color: color-mix(in oklab, var(--cn-rule) 60%, var(--cn-accent) 40%);
  box-shadow:
    0 1px 0 0 color-mix(in oklab, var(--cn-ink) 6%, transparent) inset,
    0 32px 64px -32px rgba(0, 0, 0, 0.6),
    0 12px 24px -12px rgba(0, 0, 0, 0.5);
}
```

**Effort:** Small.

---

## 4. Button `:active` scale-down

**Where:** `app/src/styles/cinematic.css`, in the existing
`.cn-btn-solid` and `.cn-btn-ghost` rules.

**Why:** Buttons have hover but no press feedback. Tactile cue absent.

**Add:**

```css
.cn-btn-solid:active,
.cn-btn-ghost:active,
.cn-topnav-cta:active,
.lp-sticky-cta:active {
  transform: scale(0.97);
  transition-duration: 80ms;
}
```

**Effort:** Trivial.

---

## 5. FAQ accordion open animation

**Where:** `app/src/styles/cinematic.css`, in the existing `.lp-faq-*`
rules.

**Why:** Native `<details>` toggle is instant — feels jarring after
the rest of the page's measured motion. Use the CSS grid trick
(animate `grid-template-rows: 0fr → 1fr`) which works without JS and
respects `<details>` semantics.

**Replace** the current `.lp-faq-a` rule and surrounding structure
with this pattern:

```css
.lp-faq-item .lp-faq-a-wrap {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows var(--motion-medium) var(--ease-out);
}
.lp-faq-item[open] .lp-faq-a-wrap {
  grid-template-rows: 1fr;
}
.lp-faq-a {
  overflow: hidden;
  /* existing typography rules stay */
}
```

**JSX change** (in `LandingV2.tsx`):

```tsx
<details ...>
  <summary ...>...</summary>
  <div className="lp-faq-a-wrap">
    <div className="lp-faq-a">{item.a}</div>
  </div>
</details>
```

**Note:** Browser support for animating `grid-template-rows` is
modern-only (Chrome 117+, Safari 17+, Firefox 121+). Below those
versions falls back to instant — same as today, no regression.

**Effort:** Small.

---

## 6. Even out the hero stagger cadence

**Where:** `app/src/screens/cover/scenes/LandingV2.tsx`, the `HeroV2`
component's six `motion.*` blocks.

**Why:** Current delays are `0.05 / 0.15 / 0.35 / 0.55 / 0.85`. Gaps
of `0.10 / 0.20 / 0.20 / 0.30` — uneven. Should be a steady rhythm.

**Change to:**

```tsx
// eyebrow:    delay 0.05s
// headline:   delay 0.20s
// sub:        delay 0.40s
// CTA:        delay 0.60s
// trust line: delay 0.80s
// (anchor card moves to #7 below)
```

Linear `0.20s` cadence between items. The eye reads at a steady tempo.

**Effort:** Trivial.

---

## 7. Hero anchor card lands AFTER the trust line

**Where:** `app/src/screens/cover/scenes/LandingV2.tsx`, the
`HeroAnchorCard` component's motion `transition` prop.

**Why:** Currently fires at `delay: 0.5s`, same time as the CTA row.
Two competing focal points firing together. Anchor card should land
after the visitor has read the narrative, not during.

**Change:**

```tsx
transition={
  reduced
    ? { duration: 0 }
    : { duration: 0.9, delay: 1.0, ease: [0.22, 0.36, 0.24, 1] }
}
```

(Use `var(--motion-slow)` constants if you've done #1 first.)

**Effort:** Trivial.

---

## 8. Trust line number count-up

**Where:** `app/src/screens/cover/scenes/LandingV2.tsx`, the
`HeroV2`'s trust-line block.

**Why:** "60+ verified brands · 110+ creators · $X paid" appears
statically. Counting up adds proof-of-life without bloat. Most
marketplace landing pages do this — feels missing here.

**Implementation:** Small custom `useCountUp(target, duration)` hook
using `requestAnimationFrame`. ~30 lines. Renders the integer climbing
from 0 → target over ~1.2s once the trust line enters viewport (use
the existing `useReveal()` to gate it).

```tsx
function useCountUp(target: number, duration = 1200, start = false): number {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!start) return;
    let raf = 0;
    const t0 = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / duration);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(target * eased));
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, start]);
  return value;
}
```

Then wire the trust line counts to it. Skip count-up if reduced motion
(just render the target value).

**Effort:** Medium (~30 min including the hook + wire-up + reduced-motion
guard).

---

## Acceptance criteria

When this pass is done, the page should:

- [ ] Have exactly three duration tokens and two easing tokens defined and used everywhere
- [ ] Smooth-scroll on nav anchor clicks (instant under reduced-motion)
- [ ] Why / Voices / Pricing cards lift 2px with accent border on hover
- [ ] All buttons scale to 0.97 on `:active`
- [ ] FAQ items open/close with a 420ms grid-row transition (instant fallback on old browsers)
- [ ] Hero stagger reads at a steady 0.20s cadence
- [ ] Hero anchor card lands at 1.0s, after the trust line settles
- [ ] Trust line numbers count up once the line enters viewport (skipped under reduced motion)

Build should still come in under 220 KB / 67 KB gzip — none of these
changes touch JS bundle except #8 which is ~30 lines.

---

## Things deliberately not in this pass

- **Scroll-driven atmosphere shifts** (hue rotation as page scrolls) — over-engineered for the editorial-but-restrained tone we landed on.
- **Step-card scroll-progress active state** — would require a scroll-position-tracking hook and visual diverges from the rest of the page's motion language. Marginal gain.
- **rAF-throttling the sticky CTA scroll listener** — premature optimization at current page weight.
- **Magnetic / cursor-aware effects on CTAs** — gimmicky for this content tone.
- **Page-leave / route-transition animations** — not needed for a single landing page.

---

## When you come back

You don't need to re-load any context. Each section above is
self-contained — file, what to change, why, expected effort. Start
with #1 and #2 (the tokens), then sweep through 3–8 in order.

The full motion review that produced this plan is in chat history
(Phase 48 thread). The TL;DR on the *current* state of motion:

- Hero entrance: cinematic, 5-step stagger
- Each section: IntersectionObserver fade-up via `useReveal()`
- FAQ: native `<details>`, no animation
- Sticky CTA: 0.4s fade-up, dismissible
- Reduced-motion: `useReducedMotion()` + `@media (prefers-reduced-motion)` block
- All transforms GPU-accelerated, no layout-thrashing animations
