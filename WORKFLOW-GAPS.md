# Workflow gaps — walking both sides as real people

Written by acting out a realistic creator and a realistic brand across the full
deal lifecycle, then checking each moment against the code. Every claim below
was verified in source; where something is inferred rather than confirmed it
says so.

The starting observation — that a brand-sent offer and a creator-sent pitch
follow different workflows — is correct, and it turns out to be the largest
structural gap in the product. It is section A.

**What already works**, so we don't re-solve it: the stage machine
(`computeCollabStage`) is a single source of truth with a real `cancelled`
terminal; negotiation is capped (`MAX_OFFER_ROUNDS`); revisions are capped at 3
with an error naming the alternatives; ending a campaign auto-cancels in-flight
collabs, refunds their escrow, and refuses to touch escrow frozen by a dispute;
the creator's proposed rate does pre-fill the brand's offer modal.

---

## A. The two entry paths are not symmetric

A deal can start two ways, and they converge at `negotiating`. But the paths
cost different numbers of actions, and the creator-initiated one is worse.

**A1 — A brand cannot accept a pitch. `ApplicationStatus` has no `accepted`.**
It is `'submitted' | 'shortlisted' | 'rejected' | 'withdrawn'`. So when Yuki
pitches at $1,800 and the brand thinks "yes, exactly that", the brand's only
move is to send a *new* offer, which Yuki must then accept. Two extra round
trips to agree on something both sides already agreed on.

Real behaviour this breaks: a creator who pitches at the campaign's advertised
rate is saying "I accept your posted terms." The product treats that as an
opening bid rather than an acceptance.

*Severity: high. It is the most common creator-initiated path in a marketplace.*

**A2 — The creator never sees their own ask next to the brand's offer.**
`Application.proposedRate` pre-fills the brand's modal, but nothing on
CollabDetail or StageActionBanner shows the creator what they asked for versus
what came back. Pitch at $2,000, receive $1,200, and the UI presents $1,200 as
a neutral fact. The brand can also silently offer below the ask with no
indication to either side that a gap exists.

*Severity: high — it is a fairness/transparency problem in the money path.*

**A3 — A pitch carries only a rate and free text.** No proposed timeline, no
proposed deliverable variation ("I'd do 2 Reels instead of 1 Reel + 3
Stories"), no availability window. Real creators counter on scope as often as
on price, and there is nowhere to put it except the pitch paragraph, where
nothing structured can read it.

*Severity: medium.*

**A4 — `invited` and `pitched` are documented as mutually exclusive entry
paths, but nothing prevents both.** A brand can cold-invite a creator who has
already applied. `computeCollabStage` resolves it (offers outrank
applications), so it isn't corrupting — but the creator sees an invitation to
something they already pitched for, with no acknowledgement of their pitch.

*Severity: low-medium.*

---

## B. Nothing expires, so nothing resolves — SHIPPED

`lib/api/staleness.ts` owns every age threshold in one table, so the banner,
the kanban card, the scheduler and the tests cannot disagree about what
"stale" means — the same failure mode that produced five copies of the fee
rate before `money.ts` existed.

**The stance, Asim's calls, deliberately conservative for a beta with
simulated payments:**

- **B3 — unreviewed work does NOT auto-approve.** Escrow never moves without
  a human. Both sides are told instead: the brand sees "Waiting 9 days on your
  review" on the card, the creator sees that their payout is held and that it
  isn't their fault. Rejected: auto-release after 14 days — it resolves the
  deadlock but pays a creator because a brand was slow, which is a stance to
  take when payments are real, not before. A test asserts the module cannot
  reference `walletBalance`, `escrowHeld` or `pendingBalance` at all.
- **B1 — offers do NOT hard-expire.** A stale offer is labelled ("Sent 10 days
  ago — check it still stands") and stays acceptable. No deal is lost to a
  clock. A test asserts no expiry mechanism exists, so adding one later has to
  be a deliberate decision rather than a drive-by.
- **B2 — a silent pitch lapses after 21 days.** The ONLY automatic state
  change in the product, and it is safe to automate precisely because it moves
  no money. The creator is warned 3 days out and told why when it fires. Only
  `submitted` pitches lapse: `shortlisted` means the brand engaged, and
  cancelling a live conversation would be worse than the silence.
- **B5 — an ignored cancellation request is chased, not resolved.** Cancelling
  returns escrow, so a human agrees to it.
- **B4 — a missed deadline** surfaces as an age on the card rather than
  triggering anything.

The sweep runs on the existing 60s heartbeat inside `runScheduledNotifications`
— one clock, not two.

### The original findings

## B. Nothing expires, so nothing resolves

Every state in this product is entered by someone doing something. There is no
path out of a state by the passage of time. The scheduler exists and fires
notifications (`enqueueDeadline24h`, `enqueueDeadlineOverdue`,
`enqueueEscrowStale`, `enqueueReviewWindowClosing`), but every one of them only
*notifies* — none changes state.

**B1 — Offers never expire.** `Offer` has no `expiresAt`. A brand sends
$1,500, the creator ignores it, and six months later can still accept it — at a
price and a brief that no longer reflect anything. Escrow isn't reserved until
acceptance, so the brand may not even have the funds by then.

*Severity: high. Real marketplaces expire offers in days.*

**B2 — Applications never expire, and brands have no response SLA.** A creator
pitches and waits. Forever, silently. Nothing tells them the brand has gone
quiet, and nothing tells the brand they have a pitch rotting.

*Severity: high — it is the single biggest cause of creators abandoning a
marketplace.*

**B3 — A brand can sit on a submitted deliverable indefinitely.** The creator
has delivered; escrow is held; the money is neither released nor returned.
`enqueueReviewWindowClosing` sends a nudge and that is the whole remedy. There
is no auto-approve, no escalation, no "unreviewed for 14 days" resolution.

*Severity: high. This is the creator's money held hostage by inaction.*

**B4 — A missed deadline has no remedy.** `enqueueDeadlineOverdue` notifies.
The brand's only real recourse is to open a dispute or cancel — both heavy,
adversarial moves for what is often "they're two days late."

*Severity: medium.*

**B5 — A cancellation request can be ignored forever.** Cancellation is mutual
(`v2RequestCollabCancel` / `v2AgreeCollabCancel`). If the other side never
responds, the deal is frozen indefinitely with escrow held.

*Severity: medium-high.*

---

## C. Availability is declared but never enforced — SHIPPED

`lib/api/availability.ts` returns one verdict that both the mutation guard and
the UI read, so a disabled button and a thrown error cannot disagree about
whether a send is allowed or why.

**Two of the three now enforce; one advises, deliberately:**

- **C1 `autoDeclineCategories` BLOCKS.** `v2SendOffer` and `v2InviteCreator`
  both throw, and the offer modal disables its send button with the reason. A
  standing "never send me this" is an instruction, not a preference to weigh.
  Matching is case-insensitive — 'gambling' vs 'Gambling' must not be the
  difference between protected and not.
- **C2 `vacationMode` BLOCKS**, offering the return date so the brand can come
  back. The old modal copy said "You can still send; expect a delayed reply",
  which is now false and was replaced.
- **C3 `minRate` still WARNS** — and the type comment now says *advisory by
  design* rather than implying enforcement. A floor is a negotiating position;
  blocking below it would kill legitimate opening offers that get countered
  up, and the creator can always decline.
- `status: 'booked'` warns for the same reason: booked now is not uninterested
  next month.

Enforcement lives at the MUTATION, not in a screen, so it holds for every
caller rather than for whichever surface remembered to check.

**A real bug surfaced while testing this:** `new Date('2026-09-01')` parses as
UTC midnight, so `toLocaleDateString` rendered a creator's return date as
"Aug 31" anywhere west of UTC — an off-by-one on "when am I back". Dates are
now built from their parts.

**C4 (capacity limits) remains unbuilt** and is still a feature rather than a
gap: nothing prevents a creator holding twenty simultaneous confirmed deals.

### The original findings

## C. Availability is declared but never enforced

`Creator.availability` carries `vacationMode`, `minRate`, and
`autoDeclineCategories`. All three are advisory only — surfaces show warnings,
and `v2SendOffer` enforces none of them.

**C1 — `autoDeclineCategories` never auto-declines anything.** The field name
states a behaviour the code does not implement. A creator who excludes
"Gambling" still receives gambling offers.

**C2 — `vacationMode` doesn't stop offers.** A creator on holiday gets offers
that expire (see B1: they don't) or go stale while they're away.

**C3 — `minRate` is a warning to the brand, not a floor.** Below-floor offers
still arrive.

**C4 — No capacity concept at all.** Nothing prevents a creator holding twenty
simultaneous `confirmed` deals with overlapping deadlines. No "accepting work
until X", no per-month cap.

*Severity: medium collectively — but C1 is a correctness bug, not a gap: the
field lies about what it does.*

---

## D. Representation and teams — SHIPPED (D1), and D3 was NOT a bug

**D1 — the manager switcher.** `useV2CurrentCreator` returned
`managesCreatorIds[0]` unconditionally, so an agency with two clients could
only ever reach the first — and every earnings figure, deal and payout on
screen belonged to that creator regardless of who the manager meant to view.
A missing switcher is a gap you can see; showing one client's money under
another client's name is a correctness bug you cannot.

The selection is persisted like the persona toggle, and **re-validated on
every read** against `managesCreatorIds`. That is deliberate: localStorage is
user-writable and this value decides whose financial data renders, which makes
it an authorization boundary rather than a UI preference. `v2SetActingForCreator`
refuses an id the user doesn't represent.

The sidebar shows the switcher only when there is more than one client, so an
ordinary creator never sees it. A talent manager (`nadia@talent.test`,
representing Amir and Yuki) is now in the seed — without one, the manager path
was entirely unexercised, which is a large part of how the `[0]` bug survived.

**D3 — role deadlock: NOT A BUG.** I flagged this as "worth testing" and it
was right to be tentative. `teamRole` is only ever SET (on invite acceptance);
there is no removal path and no role-change path anywhere in the product, so
the last admin cannot be removed because nobody can be removed. Also worth
recording for whenever removal ships: `ops` already holds `content.approve`,
`content.revise` and `content.markLive`, so losing the admin would not by
itself block content approval — only a brand left with finance/viewer users
alone would deadlock.

**D2 — deal reassignment inside a brand team: NOT BUILT.** Offers and
approvals record an actor, but there is no owner concept, no handoff, and no
"deals I am responsible for" view. That is a feature rather than a gap and
wants its own design.

### Known limitation, deliberately left

The manager demo account is NOT on the sign-in quick-pick: `nadia@talent.test`
has no Supabase Auth user, so the button returned `invalid_credentials`. A
demo button that fails is worse than no button on a screen an investor may
open. Create that auth user (password `demo1234`) and the two-line change is
recorded in `SignIn.tsx` where it goes.

### The original findings

## D. Representation and teams

**D1 — A manager with multiple creators can only ever act for the first one.**
`useV2CurrentCreator` returns `managesCreatorIds[0]`. The data model supports
agencies; the workflow supports exactly one client. No creator switcher exists.

*Severity: medium — but it silently misattributes work if a manager has two
clients, which makes it worse than a missing feature.*

**D2 — No deal reassignment inside a brand team.** Offers and approvals record
an actor, but there is no concept of an owner, no handoff when someone leaves,
and no view of "deals I am responsible for."

**D3 — Role deadlock is possible.** Ops cannot pay; finance cannot manage
campaigns. If a brand's only admin is removed, in-flight deals may have no one
able to approve content or release escrow. Not verified end-to-end — worth
testing.

---

## E + F — PARTIALLY SHIPPED, and honest about the rest

**F2 — the missing middle option, SHIPPED.** `SubmissionStatus` gained
`rejected` and `v2RejectSubmission` exists. The revision cap already told the
brand to "Approve, reject, or open a dispute instead" and `reject` did not
exist, so after three rounds their real choices were to approve work they
didn't want or escalate — adversarial, for what is often just "this isn't
right and we're done trying".

It **moves no money**, deliberately: escrow stays held. A one-sided refund on
the brand's say-so is precisely what disputes exist to arbitrate, and the
creator has done work. It demands a reason, because they deserve to know why.

**E1 — permalink re-verification, SHIPPED as the honest version.** Automatic
re-verification is NOT buildable here: there is no crawler, and the browser
cannot fetch instagram.com to check. Claiming to verify would be the same
class of lie as the analytics that used to be invented at render time. So a
human reports it — `v2ReportPostDown` — the deliverable stops claiming to be
live, and the creator is asked to restore it.

Writing it surfaced a design flaw worth recording: `submissionIsLive` INFERRED
liveness from `permalink` being present, which made "the post is down"
unrepresentable — clearing the link lost the record of what was posted, and
keeping it meant the deliverable still read as live. Liveness is now a
recorded fact (`postDownAt`), so both can be true at once.

**NOT BUILT, and each for a reason:**

- ~~**F1 (partial settlement)**~~ — **SHIPPED.** Both parties must agree
  (Asim's call). `v2ProposeSettlement` / `v2AgreeSettlement` /
  `v2DeclineSettlement`, mirroring the cancellation handshake so there is one
  mental model for "we need to agree", not two.

  The proposer **cannot accept their own proposal** — without that check a
  settlement is a unilateral escrow withdrawal wearing a handshake's clothes.
  Either side may propose, including a creator offering to hand money back.

  Only `releaseToCreator` is stored; the refund is whatever is left, so the
  two numbers cannot drift apart. The release pays through the same ledger
  convention as any approval — gross payout row, fee and withholding doing
  real work — because it IS payment for work done, not a special case.
  Re-clamped at agreement time in case escrow moved since the proposal.

  Refuses while a dispute has frozen escrow: a split under dispute is the
  arbitrator's call, not the parties'.

  **Browser-verified 2026-08-15, which found a real defect.** Production
  serves the right build and the propose form is correct (prefills half,
  `max` clamped to escrow, note required). Exercised the full handshake
  locally rather than on production, to avoid leaving a pending settlement
  on the shared demo accounts: propose as the brand → Sarah sees
  "SETTLEMENT PROPOSED" with **Agree to this split** / **Decline** → agree →
  escrow_release −1288, payout +1288, refund +858. 1288 + 858 = 2146, exactly
  what was held, and the creator's rows sum to 1095 = net of 1288.

  The defect: **`settlement_proposal` had no Supabase column.** Every other
  part shipped — type, mutations, UI, tests — and the field was dropped on
  every mirror. A settlement is a handshake, so the one party who must see
  the proposal was the one party who structurally never could. Fixed by
  migration `033` (Asim to run) plus the four repo mappings, and
  `mergeCollabRows` now preserves it per its own documented "set beats null"
  rule. Generalised into regressionGuards CLASS 7.

  19 tests, weighted toward the invariants rather than the happy path. The one
  that matters most asserts **conservation**: `refunded + net + fee + tax`
  equals exactly what was held — this codebase has already minted phantom
  dollars once, in the cancellation path, by crediting a full rate while
  debiting a clamped one.
- ~~**F3 (partial-fault disputes)**~~ — **SHIPPED.** `v2ProposeDisputeSplit` /
  `v2AgreeDisputeSplit` / `v2DeclineDisputeSplit` / `v2WithdrawDisputeSplit`,
  the same handshake as F1: propose, the OTHER side agrees or declines. What
  differs is only what agreement DOES — here it resolves the dispute.

  The money path is **extracted, not duplicated**: `applyDisputeResolution`
  now backs both the admin ruling and the parties' agreement, so the two
  cannot drift. That mattered more than the feature — five money operations
  in this codebase once had a correct version and a copy still wired up.

  Agreement records the outcome truthfully at the extremes: all-to-creator is
  `resolved-release`, all-back is `resolved-refund`, and only a genuine split
  is `resolved-partial`. A full refund withdraws the offer so the collab can
  reach `cancelled` instead of parking as a zombie.

  **Two holes, not one.** Alongside the missing proposal, `v2AddDisputeMessage`,
  `v2WithdrawDispute` and `getOpenDisputeForCollab` were implemented, tested
  and called from NO screen: a party could file a dispute, watch escrow
  freeze, and find nothing on the page acknowledging it. `DisputePanel` is
  that missing surface.

  **And the brand had no dispute surface at all.** `CollabDetail` is
  creator-only by design — it refuses a brand outright — and `CampaignDetail`
  never mentioned disputes. So the settlement the brand had to agree to was
  visible only to the creator who proposed it: the F1 bug exactly, one
  feature later. Found by clicking through as the brand; no test would have
  caught it. The panel now renders on both sides.

  Browser-verified end to end with Supabase switched off so production could
  not be touched: file as creator → panel appears and the "raise" link
  disappears → propose 1350 of 1800 → proposer sees "waiting" + Withdraw and
  is NOT offered Agree → sign in as brand → sees it, agrees → escrow_release
  −1350, payout +1350, refund +450, fee −135, tax −68. Creator's rows sum to
  1147, and 1147 + 135 + 68 + 450 = 1800 — exactly what was held.
- **E2 / E3 (usage-rights extension, post-delivery amendments).** Both are
  revenue-expansion features and both need commercial decisions first.

### The original findings

## E. Content lifecycle after "live"

**E1 — Nothing re-verifies a permalink.** A creator can post, get paid, and
delete the content an hour later. The deal stays `live`/`paid` forever.

**E2 — No usage-rights extension.** The Creator Agreement grants a licence for
the brief's duration (defaulting to 12 months). When a brand wants to keep
running the asset, there is no mechanism to extend, pay for it, or record it.

**E3 — No post-delivery amendment.** Every term is fixed at acceptance. Real
deals routinely add "one more Story" for an agreed bump; here that requires a
whole second campaign.

*Severity: E1 medium (it is the integrity of the whole "live" state), E2/E3
lower but they are the revenue-expansion path.*

---

## F. Partial and messy outcomes

**F1 — Settlement is all-or-nothing per deliverable.** A creator delivers 3 of
4 slots and then goes silent. The brand can approve the 3 (releasing their
share) but the fourth sits forever — no partial close, no "settle and end."

**F2 — After 3 revision rounds the deal needs an explicit resolution.** The cap
throws with a good message ("Approve, reject, or open a dispute instead") — but
*reject* has no obvious surface, so in practice the brand's options are approve
work they dislike or escalate to a dispute. Nothing in between.

**F3 — A dispute has no partial-fault path in the UI.** `v2ResolveDispute`
supports a split release, but nothing on the creator or brand side proposes or
negotiates a split — it is admin-only. *(Shipped — see above.)*

---

---

## SHIPPED — entry paths + the four ball-in-court gaps

**A1 — a brand can now accept a pitch.** `ApplicationStatus` gained `accepted`,
and `v2AcceptPitch(applicationId, rateOverride?)` forms the deal in one step at
the creator's asking price. Mechanically this is offer-and-acceptance with the
roles the right way round: the pitch IS the offer, so the brand is the
accepting party. `v2AcceptOffer` gained a `requiredCapability` parameter rather
than being copied — the escrow, balances, notifications and collab sync are
identical, and duplicating 205 lines is the exact mistake this codebase keeps
paying for.

Deliberately NOT atomic: it sends the offer and then accepts it. If the accept
fails (brand short on funds, campaign paused) the offer survives as a normal
pending offer — it degrades to the old behaviour rather than to a broken state.
Verified live: a capability failure left stage, status and balances untouched.

**A2 — the creator sees their ask beside the offer.** Pitch $2,000, receive
$1,200, and the banner now says so explicitly, in either direction.

**The four ball-in-court gaps** are closed via `screens/workspace-v2/nextAction.ts`
— a `Record<V2CollabStage, …>` resolver returning `{ owner, intent, label,
waitingLabel }`. Adding a stage is a compile error until its owner and CTA are
defined, the same guarantee `V2_STAGE_META` gives for stage metadata.
- Gap 1: `approved` now offers **Add live link** — the banner told creators to
  paste the URL and offered only "Message brand".
- Gap 2: the brand kanban card can no longer render blank; `submitted` with a
  slot in revision now reads "Changes requested · awaiting the creator".
- Gap 3: `live` now tells the brand that ending the campaign is what settles
  the deal.
- Gap 4: a bare invite is still owned by the creator, with a real label.

Tests: `nextAction.test.ts` (11) asserts every stage has an owner and that
neither party ever sees an empty string; `acceptPitch.test.ts` (9) covers the
deal formation, escrow, and the refusals. **737 passing.**

Verified in the running app: `app_g0_0` went `submitted → accepted`, the collab
`pitched → confirmed`, one accepted offer at 2737 linked to the pitch, escrow
reserved and pending balance credited net.

**Still open from section A:** A3 (structured scope/timeline counter-proposals)
is a data-model addition rather than a gap — deferred deliberately.

## Suggested sequencing

Grouped by what they share, not by severity alone.

**1 — Close the entry-path asymmetry (A1, A2, A4).** Add `accepted` to
`ApplicationStatus` and a brand-side "Accept pitch" that creates the accepted
offer in one step at the proposed rate. Show the creator their ask beside the
offer wherever an offer is displayed. This is the change the original
observation asks for, and it is mostly additive.

**2 — Give time a role (B1, B2, B3, B5).** An `expiresAt` on `Offer`, a
brand-response SLA on applications, and a review-window resolution for
unreviewed submissions. The scheduler already runs and already has the trigger
points — today they only notify. This is the biggest behavioural change and
should be its own phase.

**3 — Make availability real (C1, C2, C3).** Enforce in `v2SendOffer` what the
fields already claim. Small, and C1 is arguably a bug fix.

**4 — Representation (D1, D3).** A creator switcher for managers, and a test
proving a brand cannot end up with no one able to approve.

**5 — Lifecycle after live (E1, F1, F2).** Permalink re-verification, partial
settlement, and a middle option between "approve" and "dispute."

**Deliberately not proposed:** capacity limits (C4), usage extension (E2),
amendments (E3). All real, none blocking a beta, and each is a feature rather
than a gap.
