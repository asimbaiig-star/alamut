# Phase 50 — Design system refresh: airy + dense surface modes

A coordinated UI/UX refactor across the entire product. Function stays
identical; only the visual shell changes. Goal: bring Passionfroot's
*layout philosophy* (generous whitespace, calm cards, no clutter, big
serif headlines) into Alamut for marketing-adjacent and read-share
surfaces, while keeping operational dashboards dense.

**Out of scope:** business logic, data model, routes, copy.
**In scope:** tokens, primitives, layout density, type rhythm, padding,
margins, surface treatments per screen.

---

## Audit of current state

### Design system already in place
- `tokens.css` — comprehensive light + dark themes, 5 accent variants,
  gem-tone semantic palette (good/warn/bad/info/premium), tile elevation
  tokens, atmospheric backdrop tokens, type stack (Fraunces / Switzer /
  JetBrains Mono).
- `components.css` (~1860 lines) — button, card, tile, tile-interactive
  with cursor-aware halo, persona switch, etc.
- `layout.css` — `.shell` workspace grid, sticky sidebar, role switch.
- `landing.css` (~3700 lines) — older landing styling (`.land-*`),
  still used by PublicCreator and possibly other surfaces.
- `cinematic.css` (~3160 lines) — Phase 48 landing rebuild (`.lp-*`).
- `screens.css` (~7980 lines) — per-screen styling for all dashboards.

### What works today
- Light + dark theme toggle via `body[data-theme]`.
- Accent variants via `body[data-accent]`.
- Tile elevation system gives consistent surface treatment.
- Atmospheric backdrop creates ambient warmth on every surface.
- Components are reused across screens via class names.

### What's inconsistent
- Spacing values are picked ad-hoc per screen (no rhythm tokens).
- Some screens (PublicCreator) use `.land-*` legacy classes; others
  use `.cn-*` (cinematic) or `.tile`/`.card` (component).
- No formal "surface mode" — every screen invents its own density.
- The Passionfroot-style airy aesthetic doesn't exist yet anywhere.

---

## Strategy: two surface modes, shared tokens

### Surface mode A — `airy`

Big breathing room. One thing per fold. Serif headlines at display
sizes. Single-column or two-pane (form + preview) layouts. Soft
shadows. Generous card padding. Editorial pacing.

**Apply to:**
- `/c/:handle` — public storefront
- `/auth/signin` + `/auth/signup`
- `/onboarding/*` — new wizard (Phase 52)
- `/settings/*` — preferences, payouts, notifications
- Public brand profile (mirror of storefront)
- Storefront / profile editors (Creator Profile, Brand Profile) — two-pane
- Brief creation flow / NewCampaignModal

### Surface mode B — `dense`

Tight grids. Multiple things per fold. Sans-serif headings at
section sizes. Multi-column tables and grids. Clear hierarchy through
borders rather than space.

**Apply to (or keep as-is):**
- `/creator/today` + `/brand/today` — dashboards
- `/creator/discover` + `/brand/discover` — listing grids
- `/brand/campaigns` — campaign list
- `/creator/campaigns` — campaign feed
- `/inbox` — message lists
- `/wallet` + `/earnings` — transaction tables
- `/admin/*` — operations queues

### Surface mode C — `hybrid`

Airy header (story / state / at-a-glance), dense body (operational
tabs).

**Apply to:**
- `/brand/campaigns/:id` — campaign detail
- `/deal/:id` — deal page

---

## Token additions

Append to `tokens.css` after the existing `:root` block. Define on
`body` scoped by `[data-surface]` attribute so screens can opt in.

```css
/* === Surface-mode tokens === */
/* The default :root defines DENSE values (current state preserved).
   Apply data-surface="airy" on a section/page wrapper to switch
   modes without changing colors or fonts. */

:root {
  /* Density tokens — dense (default, matches current dashboards) */
  --space-xs: 8px;
  --space-sm: 12px;
  --space-md: 16px;
  --space-lg: 24px;
  --space-xl: 32px;
  --space-2xl: 48px;
  --space-3xl: 64px;

  --max-w-text: 64ch;
  --max-w-content: 1280px;
  --max-w-narrow: 720px;

  --section-py: 32px;
  --section-px: 24px;

  --card-pad: 18px;
  --card-radius: var(--radius-md);

  --type-display: clamp(32px, 4vw, 56px);
  --type-section: clamp(22px, 2vw, 32px);
  --type-body: 14px;
  --type-meta: 11px;
  --line-tight: 1.1;
  --line-body: 1.55;
}

[data-surface="airy"] {
  /* Airy tokens — generous whitespace, larger type, single-column
     pacing. Same colors / fonts as dense; only spacing + scale change. */
  --space-xs: 12px;
  --space-sm: 16px;
  --space-md: 24px;
  --space-lg: 40px;
  --space-xl: 64px;
  --space-2xl: 96px;
  --space-3xl: 128px;

  --max-w-text: 56ch;
  --max-w-content: 1100px;
  --max-w-narrow: 640px;

  --section-py: clamp(72px, 9vw, 128px);
  --section-px: clamp(22px, 4vw, 48px);

  --card-pad: clamp(28px, 3vw, 44px);
  --card-radius: var(--radius-lg);

  --type-display: clamp(40px, 6vw, 88px);
  --type-section: clamp(28px, 3.4vw, 48px);
  --type-body: clamp(15px, 1.05vw, 17px);
  --type-meta: 11px;
  --line-tight: 1.05;
  --line-body: 1.65;
}
```

These tokens cascade naturally — child elements inherit the surface
mode unless they're inside a `[data-surface="dense"]` override. So a
page can be `[data-surface="airy"]` overall but contain a dense table
section inside if needed (the hybrid case).

---

## Airy primitives (utility classes)

Add to `components.css` as a new section. These are layout-only —
they read from the surface tokens.

```css
/* === Airy surface primitives === */
/* Use these inside [data-surface="airy"] containers. They pick up the
   surface tokens automatically. */

.airy-page {
  /* Page wrapper — sets the surface mode + applies the airy backdrop */
  background: var(--bg-canvas);
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.airy-section {
  /* Vertical section with airy padding rhythm */
  width: 100%;
  max-width: var(--max-w-content);
  margin: 0 auto;
  padding: var(--section-py) var(--section-px);
}

.airy-narrow {
  /* Narrower variant for content-heavy reading surfaces (auth, settings) */
  max-width: var(--max-w-narrow);
}

.airy-card {
  /* Card with airy padding, rounded radius, soft shadow */
  background: var(--tile-surface);
  border: 1px solid var(--tile-border);
  border-radius: var(--card-radius);
  padding: var(--card-pad);
  box-shadow: var(--tile-shadow);
}

.airy-card-interactive {
  /* Card with hover lift — pulls from existing tile-interactive pattern */
  transition: transform 140ms cubic-bezier(0.4, 0, 0.2, 1),
              box-shadow 140ms cubic-bezier(0.4, 0, 0.2, 1),
              border-color 140ms cubic-bezier(0.4, 0, 0.2, 1);
}
.airy-card-interactive:hover {
  transform: translateY(-2px);
  box-shadow: var(--tile-shadow-hover);
  border-color: color-mix(in oklab, var(--accent) 40%, var(--tile-border));
}

.airy-h-display {
  /* Editorial display headline — Fraunces italic at display size */
  font-family: var(--serif);
  font-style: italic;
  font-weight: 300;
  font-size: var(--type-display);
  line-height: var(--line-tight);
  letter-spacing: -0.022em;
  color: var(--ink);
  margin: 0;
  text-wrap: balance;
}

.airy-h-section {
  font-family: var(--serif);
  font-style: italic;
  font-weight: 300;
  font-size: var(--type-section);
  line-height: var(--line-tight);
  letter-spacing: -0.018em;
  color: var(--ink);
  margin: 0;
  text-wrap: balance;
}

.airy-eyebrow {
  /* Mono-caps small label above headlines */
  font-family: var(--mono);
  font-size: var(--type-meta);
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--ink-60);
  margin: 0 0 var(--space-sm);
}

.airy-lede {
  /* Sans-serif body lede paragraph */
  font-family: var(--sans);
  font-size: var(--type-body);
  line-height: var(--line-body);
  color: var(--ink-80);
  max-width: var(--max-w-text);
  margin: 0;
}

.airy-split {
  /* Two-pane layout — form left, preview right (storefront editor) */
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.1fr);
  gap: var(--space-xl);
  align-items: start;
}
@media (max-width: 880px) {
  .airy-split { grid-template-columns: 1fr; }
}

.airy-stack {
  /* Vertical stack with airy gap */
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.airy-divider {
  /* Hairline divider between airy sections */
  height: 1px;
  background: var(--rule);
  border: none;
  margin: var(--space-xl) 0;
}
```

---

## Screen-by-screen rollout

Order matters — start with reference implementation, then propagate.

### Wave 1 — Reference + low-risk surfaces

1. **`PublicCreator` (`/c/:handle`)** — full refactor to airy. This
   becomes the reference implementation and is the screen brands see
   when a creator shares their link. Highest external visibility.

2. **`SignIn` + `SignUp`** — small files (~200 lines each), low risk,
   first impression after landing. Match airy pattern.

### Wave 2 — Wizard surfaces

3. **Onboarding wizard** (new) — Phase 52 will build this. Will be
   built directly on airy primitives.

4. **`NewCampaignModal`** (brand) — wizard-style brief creation. Airy
   pacing makes the form feel calmer.

### Wave 3 — Editor surfaces

5. **Creator `Profile.tsx`** — refactor to airy `airy-split` two-pane:
   form left, live storefront preview right. Mirrors Passionfroot's
   editor screenshot. The most valuable single-screen upgrade after
   PublicCreator.

6. **Brand `Profile.tsx`** — same pattern.

7. **Settings pages** — airy single-column, calm operational layouts.

### Wave 4 — Hybrid surfaces

8. **Brand `CampaignDetail`** — airy header (campaign at-a-glance),
   dense tabs below (applications, files, transactions).

9. **`/deal/:id`** (both sides) — same hybrid pattern.

### Wave 5 — Public brand profile (Phase 51 add-on)

10. **Public brand profile** (`/b/:handle`) — mirror of PublicCreator.
    Brands can share their profile too. Currently doesn't exist as a
    public surface; would require a small route addition.

### Surfaces that stay dense (no work)

- `/creator/today`, `/brand/today` — dashboards
- `/creator/discover`, `/brand/discover` — listing grids
- `/brand/campaigns`, `/creator/campaigns` — campaign list
- `/inbox` (both)
- `/wallet`, `/earnings` — transaction tables
- `/admin/*`

These already work as dense; refactoring them to airy would hurt
information density without functional benefit.

---

## Light/dark verification checklist

After refactoring each screen, verify both modes:

- [ ] Light mode renders with cream-warm canvas, dark ink, soft shadows
- [ ] Dark mode renders with deep neutral canvas, off-white ink, lifted tiles
- [ ] Theme toggle (existing) flips both surface modes correctly
- [ ] Accent color (existing) reads well on both light and dark
- [ ] Text contrast meets WCAG AA in both modes (4.5:1 for body)

The existing tokens already define both light + dark for every color.
The airy refactor doesn't change colors — it only changes spacing /
type / layout. So light/dark works automatically once the surface
mode tokens are in place.

---

## Acceptance criteria

When the full refactor is done, the product should:

- [ ] Have `data-surface` attribute set on every page (airy or dense)
- [ ] Render the storefront (`PublicCreator`) with Passionfroot-level
      whitespace and calm typography
- [ ] Have airy auth + onboarding so first-time creators feel welcomed
      not rushed
- [ ] Have a two-pane creator/brand profile editor with live preview
- [ ] Keep dashboards / data tables at current density (no airy bloat)
- [ ] Pass light/dark theme toggle on every refactored screen
- [ ] Maintain all current functionality — no business logic changes

---

## Things deliberately NOT in scope

- **Color palette change** — current tokens are kept. No "let's do a
  color exploration" detour.
- **Font swap** — Fraunces + Switzer + JetBrains Mono stay.
- **Component logic changes** — no Button API change, no Card prop
  additions. Just CSS.
- **Animation overhaul** — Phase 49 motion polish handles that
  separately.
- **Mobile-first rewrite** — existing responsive breakpoints stay.
- **Replacing dense screens** — Today / Discover / Inbox / Wallet /
  Admin keep their current density.

---

## Order of operations (this session and beyond)

**This session:**
1. Add surface-mode tokens to `tokens.css`
2. Build airy primitive utility classes in `components.css`
3. Refactor `PublicCreator` to airy as reference implementation
4. Stop with a clear status report

**Next sessions (per Wave above):**
5. Refactor SignIn / SignUp
6. Refactor profile editors with two-pane preview
7. Refactor settings
8. Hybrid for campaign detail / deal pages
9. Build onboarding wizard on airy primitives (this is also Phase 52)

Each subsequent wave is one focused session. Token system + primitives
are shared, so each refactor is mostly mechanical.

---

## When you come back

The plan is self-contained. Token additions and primitive utility
classes are codified above — apply them verbatim. PublicCreator's
reference implementation (after this session) shows the pattern. To
refactor any other screen:

1. Wrap it with `data-surface="airy"` (or `dense`)
2. Replace ad-hoc spacing with `var(--space-*)` tokens
3. Replace ad-hoc cards with `.airy-card`
4. Replace ad-hoc headings with `.airy-h-*`
5. Verify light + dark in dev
6. Mark the screen done in this doc
