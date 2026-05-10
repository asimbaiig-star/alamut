# Phase 52 — 1stCollab-inspired landing rebuild

A multi-session rebuild that replaces the dark cinematic landing with
a clean off-white surface, sans-serif display typography, stylized
SVG illustrations, route-split persona pages, and SEO utility tools.
The visual direction is informed by 1stCollab.com — calm, concrete,
modern — but every line of copy and every illustration is original
to Alamut.

**Out of scope:** business logic, data model, persona toggle behavior
on existing screens. Only the public landing pages + new tools
surfaces change.

---

## Visual direction (locked)

- **Background:** off-white canvas (`oklch(0.985 0.005 60)`-ish), not
  pure white — keeps the warmth Alamut already has but reads as
  bright and modern.
- **Display font:** Inter (already present in the system as a
  fallback). Replaces Fraunces on landing surfaces only — Fraunces
  stays inside the workspace for editorial moments (storefront
  headlines, testimonial pull-quotes).
- **Body font:** keep Switzer/Inter sans-serif stack.
- **3D effects:** layered soft shadows, subtle gradient lifts on
  cards, depth via stacking rather than skeuomorphism.
- **Illustrations:** custom inline SVG. Geometric, modern, accent-
  colored. No stock illustrations, no external assets.
- **Motion:** subtle scroll-reveals, hover lifts, count-ups, drift
  gradients. Same restraint as the Phase 49 motion polish.

---

## Architecture (route split)

| Route | Audience | Purpose |
|---|---|---|
| `/` | Creator-facing | Pitch + creator-side proof + how it works |
| `/for-brands` | Brand-facing | ROI pitch + case study + comparison + pricing |
| `/tools/tiktok-calculator` | SEO | TikTok engagement-rate / sponsorship-rate calculator |
| `/tools/instagram-calculator` | SEO | Same for IG |
| `/tools/youtube-calculator` | SEO | Same for YouTube |
| `/creators` | SEO + product | Public directory of creators with filters |

The persona toggle as a *single-page swap* goes away. It's replaced
by a quiet "For brands →" link in the creator hero (and reverse),
matching 1stCollab's segmentation-from-the-first-click pattern.

---

## Phase 52a — Foundation (this session)

1. **Light-landing tokens** — add `[data-surface="landing-light"]`
   token block to `tokens.css`. Off-white canvas, Inter display,
   3D shadow scale.
2. **Inline SVG illustration components** — new file
   `src/components/illustrations/` with 4–6 reusable stylized
   illustrations (hero exchange, vetted-shield, live-briefs-stack,
   escrow-lock, receipt-star, calendar-flow).
3. **Cover.tsx refactor** — flip the existing landing page to the
   light surface, swap Fraunces for Inter on the hero + section
   headings, drop the dark drift-gradient backdrop in favor of soft
   off-white surfaces with layered card shadows. Persona toggle
   stays for now (route split is Phase 52b).

Acceptance: hero looks like a 1stCollab-style light page; existing
copy preserved; light/dark theme toggle still works (light mode is
the new default on landing surfaces; dark mode flips to a deep-but-
not-pitch palette).

## Phase 52b — Route split + creator page rebuild (next session)

1. **Add `/for-brands` route** — protected as public; lazy-loaded.
2. **Strip persona toggle** from `/`; add quiet "I'm a brand →" link
   in the creator hero corner.
3. **Build `BrandLanding.tsx`** with the brand-side content (Section
   skeleton in 52c below).
4. **Update creator landing's content** to match 1stCollab's creator
   architecture more closely:
   - Real-creator card row directly under hero (3-4 cards: portrait
     + handle + follower count + lifetime earnings via Alamut)
   - Three value pillars (the WhyAlamut creator content, restyled)
   - **Testimonial wall** — expand `seededTestimonials` in `seed.ts`
     from 4 → 16 (8 per persona), each tied to a real campaign
   - Manager/agency callout band (cross-audience expansion)
   - Existing FAQ + Final CTA stay

## Phase 52c — Brand landing rebuild (own session)

Following 1stCollab's brand page architecture:

1. Hero — ROI/outcome-focused headline + dashboard mockup
   illustration (stylized, not screenshot).
2. **Outcomes section** — 4 hard metrics from the seed (e.g., 11d
   avg posted-to-paid, 4.2× median ROAS, $X cleared total, 110+
   verified creators).
3. **Anchor case study** — pick a real seed campaign (Khaadi ·
   Holiday Tables works), surface: total spend, total reach,
   attributed revenue, applicants, days to close, creator quote.
4. **4-feature pillar grid** — vetted creators, automated matching,
   escrow + payment, ROAS attribution.
5. **vs-Agencies comparison matrix** — 3 columns (Alamut · agency ·
   creator search tool), 6-8 rows (cost, time, control, vetting,
   payment, attribution).
6. **Pricing transparency** — "Free to post a brief. 5% of brief
   budget on cleared deals only. No retainer."
7. Final CTA + footer.

## Phase 52d — Calculator tools (own session)

Three sibling routes with shared layout:

- `/tools/tiktok-calculator` — input followers + engagement %, get
  estimated rate range. Methodology note (rate = followers × $0.01–
  0.03 with engagement multiplier).
- `/tools/instagram-calculator` — same pattern, IG-specific
  benchmarks.
- `/tools/youtube-calculator` — CPM-based, more weight on view
  count.

Each tool also displays "How we calculate this" + "Get your real
rate on Alamut" CTA. Pure SEO play — these pages bring organic
traffic from creators searching "instagram sponsorship calculator"
etc., and they convert by showing how Alamut's real cleared-deal
data beats their estimate.

## Phase 52e — Top Creators directory (own session)

Public, paginated directory at `/creators`:

- Header with category / platform / region filters
- Grid of creator cards (portrait, handle, tier, lifetime earnings,
  top platforms)
- Each card links to `/c/{handle}` (existing public storefront)
- Pagination footer
- SEO-optimized: meta tags per filter combo, sitemap entries,
  proper title/description tags

Built on the existing `db.creators` array — no new data needed.
Just a new public route with filtering + grid rendering.

## Phase 52f — Final QA + asset polish (own session)

- Mobile QA at 375 / 768 / 1280 / 1920
- Light + dark theme verification on every new page
- Lighthouse audit: target 95+ performance / a11y / SEO
- Final illustration polish — consistent stroke widths, color
  palette, weights
- Cross-page navigation audit — every CTA goes somewhere sensible

---

## Out-of-scope (deferred indefinitely)

- Glossary / blog stub (not requested)
- Video assets (would require external hosting + content production)
- Internationalization
- A/B testing infrastructure

---

## When you come back

Each Phase is a clean, scoped session. The foundation (52a) sets up
tokens + illustrations + light surface; everything after composes
from those building blocks. To pick up Phase 52b, look at the
`tokens.css` `[data-surface="landing-light"]` block and the
`src/components/illustrations/` folder — those are the foundation
for every subsequent landing surface.
