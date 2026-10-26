# Landing page review — 2026-10-25

Both live pages: `/` (creators, `Cover.tsx`) and `/for-brands` (brands,
`BrandLanding.tsx`). Read in full as code, then visited signed out at
1440×900 and 375×812. Every "false" below was checked against the code that
would make it true; judgement calls are marked as such.

> `scenes/LandingV2.tsx` (1,408 lines) is **not rendered anywhere** — nothing
> imports it. Earlier honesty passes, including mine, edited it believing it
> was live. The claims they removed are still on the real pages.

## Verdict

The design is good — editorial typography, one accent colour, consistent
spacing, a clean mobile hero with the CTA above the fold. Polish is not what
stands between these pages and "the best".

**Credibility is.** Almost every proof point on both pages is invented, and
several feature claims describe things the product does not do. For a site an
investor will read and then test, that is the conversion problem: the first
claim they check that turns out false discounts every other one. The best
pages in this category win on specific, checkable truth — and Alamut has a
genuinely strong true story (escrow that actually holds the money) that the
invented material is crowding out.

---

## 1. Invented proof — the highest-risk items

| Where | What visitors see | What it actually is |
|---|---|---|
| both | **Press section** — "The creator-economy press is watching" / "The growth-team press is paying attention": ten pull-quotes with outlet names, bylines, sections, dates | Fictional publications. Disclosed only in a code comment, not on the page. The quotes also assert a 5% fee, 4-day payouts and traction ("brands are running three campaigns through Alamut where they'd run one with an agency") |
| `/for-brands` | **"Aesop · Reset Week."** case study — $9,000 budget, 7 applicants, 11 days, 741k reach | Generated from seed data, published under a real company's name |
| `/for-brands` | **"Brands posting briefs through Alamut"** + logo marquee | The first 14 brands *in the seed* (Aesop, Le Creuset…) — real companies shown as customers |
| `/` | **"Work with brands you admire — new campaigns posted weekly from global icons"** | Same seed brands |
| `/` | **"$176,882 paid to creators · 96+ brands hiring · 115+ verified creators"** | Sums and counts over the *seed store*. Postgres holds 3 brands and 5 creators |
| `/` | **"Recent closed deals… real creators, real brands, real cleared payouts… no stock thumbnails"** | Seed deals, illustrated with stock lifestyle photos |
| `/for-brands` | Product mock: **"4.2× campaign ROAS"** chip, "UTM-tracked" | No attribution exists; the FAQ on the same page says so |

The real-company items (Aesop case study, logo wall, "global icons") are the
most serious: they imply endorsement by companies that have none with Alamut.

## 2. Feature claims the code contradicts

| Claim | Page | Reality |
|---|---|---|
| "a flat **5%** fee" (×4 on `/`, ×3 on `/for-brands`, and in the press quotes) | both | `PLATFORM_FEE = 0.10` — **10%**, plus 5% withholding. `PLATFORM_FEE_LABEL` exists for copy and isn't used |
| "Approval credits your wallet straight away" / "Paid on approval" / "funds release on approval" | `/` | Money moves when the brand confirms the post **live** — the rule you set |
| "Escrow funds release on creator delivery — **no manual approval gate**" | `/for-brands` | The opposite: the brand's live check is the gate. Also contradicts the FAQ on the same page |
| "**AI** auto-accepts top-3 audience-fit creators" / "AI launches instantly" | `/for-brands` | `autoShortlist` marks category-overlap matches as *shortlisted*. Nothing auto-accepts or funds |
| "we score age/region **overlap with your existing customers**… bot signals" / "The model reads each creator's…" | `/for-brands` | No customer data, no bot detection, no model. Follower numbers are self-entered |
| "Audience fit 96/100" mock | `/for-brands` | No such score |
| "Auto-filtered applications… outside your filters never reach your inbox" | `/for-brands` | Doesn't exist — the landing page is the only file that mentions it |
| "A daily digest of spend and delivery" | `/for-brands` | Doesn't exist |
| "the rest auto-archive after 24 hours" | `/for-brands` | Unanswered applications lapse after **21 days** (`STALENESS.applicationLapseDays`), not 24 hours |
| "115+ **vetted** creators" | `/for-brands` | Applying is open; nothing vets |
| "Connect Instagram, TikTok… **we auto-pull metrics**" | `/` | No platform connection exists; metrics are typed in |
| "Median payout time on cleared deals: **4 days**" (×2) | `/` | Never measured |
| "most briefs receive their first qualified application inside the first hour" / "brands send their first offers within hours" / "nano creators close deals next to mega creators every week" | both | Never measured |
| "Year-end forms (1099) are issued automatically" | `/` | 1099 generation is a TODO in `types.ts` |
| "funded on your card or via wire" | `/for-brands` | Payments are simulated in the beta; no card or wire rail |

Already fixed today: the creator page's "every brand is verified before they
can post a brief" (`55c314a`).

## 3. Message

*Judgement, grounded in the above.*

**`/for-brands` leads with the weakest claim.** Title, H1 and a full section
are about AI ("AI-driven campaigns without compromise"). AI is the least real
part of the product — Spark is scripted, scoring is a category check — and it
is the claim every competitor makes. The true differentiators get one stat
line: escrow on every deal, pay only when a deal clears, briefs live
immediately, every figure traceable to a ledger row.

**`/` buries its best line.** "Your next brand partnership starts here" could
be any marketplace. The concrete promise — *the money is locked in escrow
before you start work* — is in the sub-copy and a pillar card. That is the
thing creators are actually afraid of (unpaid work, chasing invoices), and it
is true.

**Both pages over-explain.** 12 desktop screens on `/` (21 on a phone), 10 on
`/for-brands`. Two "editorial break" quote sections, a 2,000px deals gallery,
and a press section carry most of the length and most of the invented
material.

## 4. Conversion structure

| Finding | `/` | `/for-brands` |
|---|---|---|
| Screens of scroll with **no CTA** after the hero | ~8 (y=689 → pricing at y≈8,010) | ~6 (hero → pricing at y≈6,377) |
| "How it works" has a CTA | no — the natural moment to ask | n/a |
| Page height | 11,021px desktop · 17,184px mobile | 9,418px desktop |
| Mobile nav | "SIGN IN" and "JOIN FREE" each wrap to two lines at 375px | not checked |
| Investor/demo path | the one-click demo accounts live only on `/signin` | same |
| Free rate calculators at `/tools/*` | not linked from the page | — |
| Meta description | creator-specific | **identical to `/`** — not written for brands |

## 5. Performance and SEO

- A landing visitor downloads **~356 KB gzipped** before anything renders: the
  whole app (`index` 114 KB + `vendor` 164 KB + CSS 71 KB). The landing page
  itself is 6.5 KB of it.
- The landing page boots the full store — the 2 MB seed — and fires the
  Supabase hydration (20 API calls) for a visitor who hasn't signed up.
- No prerender: the HTML is empty until JS runs, and hero elements start at
  `opacity: 0` and animate in. Slow phones see a blank hero for longer, and
  crawlers see little.
- Four font families from two providers (Google + Fontshare); the H1 asks for
  **Inter, which is never loaded**, so the headline renders in the system font.
- All 6 content images on `/` are served at >2.5× their displayed size.
- No canonical URL.

## 6. What works — keep it

- Visual design: typography, colour, spacing, product mocks.
- The escrow story, wherever it's told accurately.
- The FAQ answers that are honest ("Can I attribute revenue? Not yet…") —
  that tone is the brand.
- Mobile hero: CTA above the fold, no horizontal overflow.
- Pricing sections are clear (once the number is right).

---

## Recommended order

**P0 — before anyone else reads it (truth).** Remove or plainly label every
item in §1; correct every claim in §2, using `PLATFORM_FEE_LABEL` for the fee.
Then extend CLASS 10 to `/for-brands` — the shared `marketing()` helper skips
it, which is how all of this survived two sweeps — and add patterns for
"UTM-tracked", unmeasured averages and real-brand proof.

**P1 — conversion.** Reposition `/for-brands` around escrow and control rather
than AI. Make escrow the `/` headline. Add CTAs after "How it works" and after
the gallery. Cut each page by roughly 40% — the length is mostly the invented
sections. Fix the mobile nav. Add a "Try the live demo" path for investors.
Link the rate calculators. Write a brand meta description.

**P2 — speed and reach.** Serve the landing pages without the app (no store,
seed or hydration), prerender them, size the images, load the hero font, cut
to one font provider, add a canonical.

### Proof without customers yet

The honest replacement for invented proof, in roughly descending strength:
the real product shown working (the demo accounts, a recorded walkthrough of
one deal from brief to escrow release); the mechanism made concrete (a live
fee-and-escrow calculator); "public beta" stated plainly with what is and
isn't live — which the FAQ already does well; and founder credibility. Real
quotes and logos replace these as they arrive, each one checked.
