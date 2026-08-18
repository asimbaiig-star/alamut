# Where Alamut needs a real API — assessed against public-apis (1,682 entries)

Method: parsed all 1,682 rows from `public-apis/public-apis`, keyword-scanned
every row against Alamut's known gaps, and read in full the ~200 entries in
the eleven categories that could plausibly serve them (Social, Auth, Data
Validation, Phone, Email, Currency Exchange, Text Analysis, Tracking,
Anti-Malware, Documents, Cloud Storage).

The gaps below are not speculative. Each is something this codebase currently
fakes, omits, or does by hand — most of them were found and labelled during
the honesty passes.

---

## The headline

**The list covers Alamut's peripheral needs well and none of its
load-bearing ones.**

| Need | Entries in 1,682 that serve it |
|---|---|
| Payouts to creators | **0** |
| Identity / KYC verification | **1**, and it is India-specific (API Setu) |
| Click attribution | **0** usable |
| oEmbed / post verification | **0** |

Those four are exactly the things that would most change the product. They
are commercial integrations — Stripe Connect, Wise, Payoneer, Persona,
Onfido, Sumsub — with contracts, compliance review and per-transaction
pricing. A directory of free public APIs was never going to contain them,
and that is worth knowing before spending time looking.

What the list DOES contain is genuinely useful for six real gaps.

---

## Tier 1 — adopt these; they close a real gap cheaply

### 1. Currency — the product is USD-only and its creators are not

`money.ts` deals in whole USD. Seeded creators are in Lahore, Berlin, Tokyo.
A creator paid "$1,275" has no idea what lands in their bank.

- **Frankfurter** — no API key, no rate limit, ECB rates, time series.
- **Currency-api** — no key, 150+ currencies.
- **exchangerate.host** — no key, FX + crypto.

Start with Frankfurter: keyless means no secret to manage and no signup.
Display-only conversion first (show the creator their local equivalent);
never settle in a converted figure without a locked rate.

### 2. Transactional email — every notification is in-app only

`db.notifications` is the whole notification system. A creator who is not
logged in never learns their pitch lapsed, an offer arrived, or a dispute
was settled. The scheduler already computes exactly these events.

- **SendGrid** / **Sendinblue** / **Mailtrap** — transactional send.
- **Mailtrap** additionally has a sandbox, which matters because the seed
  contains hundreds of fake addresses that must never receive real mail.

### 3. Email validation at signup

Signup accepts any string with an `@`. Disposable addresses on a marketplace
that moves money are a problem worth pre-empting.

- **Disify** — no key, detects disposable/temporary.
- **MailCheck.ai** — no key, purpose-built for signup blocking.
- **Kickbox** — no key listed, deliverability verification.

### 4. Permalink safety + liveness — `v2MarkContentLive` is entirely manual

The brand pastes eyes on a URL and clicks a button. Nothing checks the link
resolves, belongs to the creator's handle, or is not hostile. WORKFLOW-GAPS
**E1** (nothing re-verifies a permalink; a creator can post, get paid, and
delete an hour later) is still open, and `Submission.postDownAt` exists with
no automated writer.

- **URLScan.io** — resolves and screenshots a URL; would confirm a post
  exists and capture proof at verification time.
- **Google Safe Browsing** — flags hostile links before a brand opens one.
- **VirusTotal** / **Web of Trust** — URL reputation.

This does not replace the brand's judgement. It replaces the brand's blind
trust that the string is a real, live, safe post.

### 5. Brand safety — the filter that was deleted for having no backing

Discover's "Brand-safe" filter was removed because nothing implemented it.
These would let it come back as a real thing:

- **Perspective** (Google) — toxicity scoring on creator bios/captions.
- **PurgoMalum** — no key, profanity screen.
- **Tisane** — abusive-content detection.

### 6. E-signature and documents

The Creator Agreement is a checkbox with a version number
(`agreementVersion`, enforced — regressionGuards CLASS 3). The tax form
step collects W-9/W-8BEN intent and produces no document.

- **PandaDoc** — DocGen + eSignatures; covers both the agreement and the
  tax forms.
- **iLovePDF** / **CraftMyPDF** — earnings statements and invoices, which
  the wallet currently offers as CSV only.

---

## Tier 2 — the one that would change the product most, with a caveat

### Social platform data — reach, engagement, audience, ownership

This is the biggest hole in Alamut. `aggregateAudience` returns `null` for
every real creator because `Platform.audience` is only ever populated on
seeded demo rows. The storefront says "needs connected channels" and there
is no way to connect one. Matching scores what it can and honestly reports
`score: null` when it cannot. Channel ownership is claimed, never verified.

The list contains the official platform APIs — **Instagram**, **TikTok**,
**LinkedIn**, **Twitter/X**, **Facebook**, **Twitch**, **Pinterest**,
**Reddit**, **Bluesky**. All OAuth. Connecting these solves reach,
engagement, audience demographics, ownership verification AND post
verification in one move, because an OAuth-connected account proves the
handle is theirs and exposes their own post data.

**The caveat:** these are not "free public APIs" in the way the rest of the
list is. Instagram and TikTok require a Meta/TikTok developer account, app
review, a business verification, and a privacy policy — weeks, not an
afternoon. Budget for that rather than discovering it mid-integration.

**Aggregators worth pricing against doing it yourself:**

- **Ayrshare** — "post, get analytics, and manage multiple users", which is
  precisely the multi-creator shape Alamut needs.
- **PostLake** — "one API to publish, schedule, and read analytics across
  every major social network".
- **Publora** — ten networks from one endpoint.

One integration instead of six, at the cost of a dependency and a per-seat
fee. For a beta proving the loop, that trade is probably right.

---

## Tier 3 — not in this list; plan for a vendor

| Need | Current state | What it actually takes |
|---|---|---|
| Creator payouts | Simulated; wallet is a number | Stripe Connect, Wise, Payoneer |
| Brand funding | `api.wallet.topUp` credits a number | Stripe / a PSP |
| Identity & KYC | Simulated, and now labelled as such | Persona, Onfido, Sumsub |
| Bank verification | "On file", unverified | Plaid, or micro-deposits via the PSP |
| Click attribution | Absent; removed from marketing copy | Branch, AppsFlyer, or first-party UTM + your own store |

The last row is worth a note: attribution does not strictly need a vendor.
A first-party redirect service writing click rows to Postgres would give an
honest click count, and **Bitly** / **Rebrandly** / **RedirHub** in the
URL Shorteners category offer hosted link analytics if speed matters more
than owning the data.

---

## Recommended order

1. **Frankfurter** — an afternoon, removes a real confusion for non-US creators.
2. **SendGrid or Mailtrap** — the scheduler already knows what to send.
3. **URLScan.io on mark-live** — turns the brand's blind confirmation into a
   checked one, and gives E1 a way to detect takedowns.
4. **Start the Instagram/TikTok developer applications now** — the calendar
   is the constraint, not the code.
5. Everything else after the demo.
