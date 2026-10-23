# Supabase health check — 2026-10-23

Read-only verification of project `iddpnsnlmfhnxyhbhyvx`. No rows were
written, updated or deleted. Every column probe was a `select=<col>&limit=0`,
which makes Postgres resolve the column at plan time without returning data;
a deliberate bad-column probe returned `42703`, so the passes are real and not
a uniformly-green endpoint.

> **Status, 2026-10-23:** §1 and §2 are **fixed and applied** —
> `app/supabase/migrations/037_read_authorization.sql`, verified against
> production and against a real Postgres (see "Verified after applying" at the
> end). CLASS 12 in `regressionGuards.test.ts` fails the build if any of it is
> undone. §3 (dead public views), §4 (`campaigns` columns) and §5 (edge
> functions) are still open.

## Verdict

The plumbing is healthy. The **read** authorization is not.

Connection, schema, auth, storage and write-protection are all working as
expected. But eight tables are readable by anyone on the internet, and five
more are readable by any signed-in user regardless of whether they are party
to the data. That includes every deal's money and every direct message.

---

## Working

| Check | Result |
|---|---|
| REST reachable, correct project | OK — live site bundle resolves to the same ref |
| Tables + views present | 20/20 reachable |
| Columns through migration 036 | 11/11 present (032, 033, 034, 035, 036 all applied) |
| Negative control (`no_such_column_xyz`) | `42703` as expected — probes are meaningful |
| Auth service | GoTrue v2.197.0 up; email provider on; anonymous sign-ins **off** |
| Storage buckets | 4/4 reachable (`brand-logos`, `campaign-assets`, `creator-portraits`, `message-attachments`) |
| Anonymous writes | Refused `401` on creators, brands, campaigns, collaborations, transactions |
| Local test suite | 978 passing, 60 files |

Optimistic-locking `version` columns are present. The live deployment hydrates
from this project (20 REST calls on a cold load).

---

## 1. CRITICAL — eight tables are world-readable

`for select using (true)` with **no role restriction**, so the `anon` role is
included. The publishable key ships in the public JS bundle by design, which
means any visitor can read these with one `curl`.

Verified live with the publishable key, exact counts via `Prefer: count=exact`:

| Table | Rows an anonymous caller can read | Policy | From |
|---|---|---|---|
| `contracts` | 2 | `contracts_select_all` | 008 |
| `offers` | 3 | `offers_select_all` | 003 |
| `applications` | 2 | `applications_select_all` | 003 |
| `collaborations` | 8 | `collaborations_select_all` | 006 |
| `submissions` | 6 | `submissions_select_all` | 007 |
| `deliverables` | 5 | `deliverables_select_all` | 007 |
| `reviews` | 0 — **latent**, open but empty | `reviews_select_all` | 010 |
| `campaigns` | 4 — intended public, wrong columns (see §4) | `campaigns_select_all` | 002 |

`reviews` passed a naive "did rows come back" test for the wrong reason: the
policy is open, the table is simply empty. It will start leaking the day a
review is written.

What actually comes back from `contracts`, unauthenticated:

```json
{"id":"ctr_z7sffz_tjj5q","brand_id":"b_aesop","creator_id":"c_sarah",
 "agreed_rate":1650,"platform_fee":165,"net_to_creator":1402,
 "withholding_tax":83,"status":"fulfilled"}
```

Every negotiated rate, platform fee, net-to-creator and withholding figure on
the platform. `offers` adds the pitch `message` and every counter-offer round;
`submissions` adds creator notes, feedback and permalinks.

### Why it happened

Migrations 005 and 019 are both named `tighten_rls`, and both tighten
**INSERT and UPDATE only** — 019's own header says the threat it closes is
that a user could *plant* a row. Migration 025 (`pii_lockdown`) is the only
one that tightened SELECT, and it covered exactly two tables, `creators` and
`brands`. The deal tables were never revisited. Nothing in the suite tests
read authorization, so nothing caught it.

---

## 2. HIGH — any signed-in user can read every other user's private data

These are scoped `to authenticated` but the predicate is still `using (true)`,
so the gate is "do you have an account", not "is this yours":

| Table | Policy | What any account can read |
|---|---|---|
| `messages` | `messages_select_authenticated` | every direct message between every brand and creator |
| `threads` | `threads_select_authenticated` | every conversation's existence and participants |
| `transactions` | `transactions_select_authenticated` | every wallet movement, fee and payout on the platform |
| `disputes` | `disputes_select_authenticated` | every dispute, including the settlement proposals |
| `outreach` | `outreach_select_authenticated` | every brand's prospecting list |

Signup is open, so the cost of entry is one email address.

**Evidence basis:** read from the policy definitions, which are unambiguous
(`for select to authenticated using (true)`, never replaced in any later
migration). I did not confirm with a live signed-in probe — that needs an auth
user, and I don't create or sign in to those.

---

## 3. MEDIUM — the public views return nothing, ever

`creators_public` and `brands_public` both return **0 rows** to an anonymous
caller. They are declared `with (security_invoker=on)`, which runs the view as
the *caller* and therefore applies the base table's RLS to them — and the base
policy is `creators_select_owner` / `brands_select_owner`, owner-only and
`to authenticated`. An anonymous visitor matches no owner, so the view can
never yield a row.

Migration 025 states the opposite intent in its own comments:

> Anonymous and authenticated non-owners can read it; the raw `creators` table
> is owner-only.

That is what it was meant to do. It isn't what it does. `security_invoker=on`
and an owner-only base policy cannot both hold.

Nobody noticed because the UI falls back to seed data: `/creators` on the live
site renders "115 MATCHES" of seeded creators while the view behind it returns
nothing. The public directory and storefronts are currently showing fabricated
profiles, not database rows.

---

## 4. MEDIUM — `campaigns` exposes the brand's internal spend

Keeping `campaigns` readable by anon is right for a public marketplace. The
column set is not. World-readable today:

`budget`, `spent`, `escrow_held`, `history`, `milestones`, `applications`,
`offers`, `auto_shortlist`, `editors_pick`

A public brief needs the title, pitch, brief, category, region, deadline and
budget. It does not need how much the brand has already spent, what is held in
escrow, the full stage history, or whether they are on an editorial list. The
fix is a `campaigns_public` view on the same pattern as the other two — once
§3 is sorted, because the same `security_invoker` trap applies.

---

## 5. Edge functions are not deployed

| Function | Status |
|---|---|
| `spark-chat` | `404` — known; needs `ANTHROPIC_API_KEY` in Supabase secrets, then deploy |
| `oauth-callback` | `404` — **not previously flagged**; platform OAuth cannot complete without it |

---

## Fixing this is low-risk — I checked

My first instinct was that the open policies were load-bearing, because every
repo reads unfiltered (`sb.from('contracts').select(COLUMNS)` with no `.eq()`)
and boot hydration runs for signed-out visitors too. That turns out not to
matter, for two reasons:

1. An unfiltered `select` under scoped RLS returns **the caller's rows** — the
   client-side filtering the app already does then operates on a smaller set.
   No query rewrite needed.
2. `overlay()` in `store.ts:401` opens with `if (remote.length === 0) return
   local;`. An anonymous visitor getting `[]` leaves the seed store untouched,
   so the public pages render exactly as they do now.

So the remediation is a policy change, not an app refactor.

### Remediation shape

The helpers already exist — migration 005 built `is_brand_owner_of_campaign`
and `is_creator_owner`, 019 added `is_participant_of_campaign`. The same
predicates already guarding INSERT and UPDATE on these tables just need to
guard SELECT:

```sql
-- one of these per deal table
drop policy if exists "contracts_select_all" on public.contracts;
create policy "contracts_select_participant" on public.contracts
  for select to authenticated
  using (
    public.is_brand_owner_of_campaign(campaign_id)
    or public.is_creator_owner(creator_id)
  );
```

For §2, the same treatment with the participant helper. For §3, drop
`security_invoker=on` so the view runs as its owner and the base RLS no longer
applies to the caller — the view's column list is what provides the safety.

Suggested order: §1 and §2 together (one migration, same pattern), then §3 and
§4 (the view fix and `campaigns_public`), then the functions.

---

## What migration 037 does

`app/supabase/migrations/037_read_authorization.sql` — 43 statements, parsed
clean by libpg_query (the real PostgreSQL grammar), not yet applied.

| Table | New predicate |
|---|---|
| `applications`, `offers`, `collaborations`, `contracts`, `submissions` | brand owner of the campaign, or the creator the row is about |
| `deliverables` | `is_participant_of_campaign` — 035's `creator_id` is nullable, so the per-creator test alone would hide the brief's deliverable list from the creator who has to deliver it |
| `reviews` | stays public (storefronts show them), but `hidden = false` — moderated rows were public too |
| `transactions` | the row's own wallet, the counterparty, **or** the campaign's brand owner |
| `threads` | `participants` overlaps the caller's own user_ids |
| `messages` | participant of the thread the message is in |
| `disputes` | participant of the campaign |
| `outreach` | the brand that sent it, or the creator it went to |
| `campaigns` | **untouched** — a marketplace needs anonymous brief reads; the column problem is §4 |

Four new helpers bridge `auth.email()` to the legacy app-level `user_id`s that
`transactions.user_id` and `threads.participants` actually hold — the same
identity the app itself compares (`t.userId === brand.userId`, v2Adapters.ts).

Three things worth knowing about it:

- **The `transactions` policy's third arm is not load-bearing.** An earlier
  draft of this doc and of 037's comments said the campaign-owner arm existed
  so the brand could read back the creator's payout row. Both halves were
  wrong: ledger rows go in through a plain `.insert()` with no read-back, and
  the payout row is already visible to the brand as its counterparty. The arm's
  only effect is that a brand can see the creator-side `fee` rows on its own
  campaign — platform fee and withholding tax, figures already on the contract
  it can read. Harmless, unneeded, kept rather than shipping a second
  migration for no change in what anyone can learn.
- **Predicate choice avoids policy recursion.** The 005/019 helpers are
  `security invoker`, so the base tables' RLS applies inside them — a policy
  on table T must never call a helper that reads T.
  `is_participant_of_campaign` reads `applications` and `offers`, so it guards
  `deliverables` and `disputes` but deliberately not those two.
- **005's helper comments are now wrong.** They claim the open
  `brands_select_all` / `creators_select_all` policies let their inner SELECTs
  see every row. 025 replaced both with owner-only policies. The helpers still
  return the right answer, because what they test for is the owner match — but
  don't trust that comment on the next read.

## The regression guard

CLASS 12 in `app/src/lib/__tests__/regressionGuards.test.ts`. It replays all
37 migrations in order — drops and recreates included, so a policy rewritten
three times is judged on the last one — and asserts:

- **(a)** no SELECT policy is `using (true)` without a role clause, except an
  explicit `PUBLIC_BY_INTENT` allowlist (currently just `campaigns`)
- **(b)** no SELECT policy is `to authenticated using (true)`
- **(c)** no policy routes through a helper that reads the table it guards,
  with a read-map of every helper — plus a test that the read-map is *true*,
  checked against each helper's actual body, so (c) can't go decorative
- the parse found something at all, and each table is gated on a real
  predicate, so deleting 037 fails loudly instead of silently reverting

Mutation-tested, because a guard that cannot fail is worse than none:

| Mutation | Result |
|---|---|
| delete 037 entirely | 4 of 6 fail |
| `contracts` back to world-readable | 2 fail |
| `messages` back to `to authenticated using (true)` | 2 fail |
| guard `applications` with the helper that reads applications | 2 fail |
| make `own_user_ids` stop reading `creators` (read-map now a lie) | 1 fail |

Baseline restored byte-identical afterwards. 984 tests pass, typecheck and
build clean.

## Verified after applying

Applied 2026-10-23. Three independent checks, because none of them alone
covers the signed-in path.

**1. Production, as an anonymous caller.** Exact counts via
`Prefer: count=exact` with the publishable key:

| Table | Before | After |
|---|---|---|
| `contracts` | 2 | 0 |
| `offers` | 3 | 0 |
| `applications` | 2 | 0 |
| `collaborations` | 8 | 0 |
| `submissions` | 6 | 0 |
| `deliverables` | 5 | 0 |
| `campaigns` | 4 | 4 — intended |

The query that returned every deal's money now returns `[]`. All four new
helpers exist (called over RPC with their real parameter names; a misspelled
name errors `PGRST202`, so the check discriminates). Anonymous writes still
`401`.

Note what this does **not** prove: the §2 policies are `to authenticated`, so
for an anonymous caller Postgres skips them on the role check and never
evaluates the predicate. Their `[]` shows they're closed, not that they don't
recurse.

**2. The shipped SQL, on real Postgres, with two tenants.** PostgreSQL 18.6
via PGlite. The seven helpers and twelve policies were extracted verbatim from
the migration files, not retyped. Two unrelated tenants, plus a signed-in
stranger with no profile, plus anonymous. 57 assertions, all passing:

- no policy errors for any caller — the recursion question, settled
- each brand and creator sees exactly its own rows in all 12 tables
- neither tenant sees anything of the other's
- the stranger and the anonymous caller see nothing except public reviews
- a deliverable with `creator_id = NULL` is visible to both parties — the
  reason that table is gated on participation
- a hidden review is visible to nobody

Mutation-tested, because a harness where RLS silently never applied would pass
everything:

| Mutation | Result |
|---|---|
| `contracts` back to `using (true)` | 6 assertions fail — cross-tenant and anonymous reads return |
| `deliverables` gated on `creator_id` instead of participation | 2 fail — both parties lose the brief's deliverables |
| `offers` gated on a helper that reads `offers` | Postgres aborts: `ERRORDATA_STACK_SIZE exceeded` |
| drop the campaign-owner arm from `transactions` | 1 fails — the brand loses the fee rows, and nothing else |

The last row is how the wrong claim about that arm surfaced: the first fixture
had no counterparty-less fee row, so removing the arm changed nothing and the
harness passed.

**3. Production's data shape, without signing in.** The harness proves the
semantics; it can't prove production's rows are shaped the way the fixture
assumed. Two equivalences close that:

- For the five deal tables the new SELECT predicate is **identical** to the
  UPDATE predicate live since 005/019. Every accept, counter, approve and
  mark-live in production has already passed exactly this check for these
  accounts — and those updates use `.select()`, which now evaluates the same
  expression, so the write path can't have regressed.
- Threads are created as `participants: [brand.userId, creator.userId]` and
  the inbox filters on `participants.includes(viewerUserId)`. The policy
  does the same thing in SQL on the same ids.

The admin console has no Supabase session path — `User.role === 'admin'` is
app-level and reads the local store — so 037 does not change what it shows.

**Not done:** a live signed-in click-through. It would mean entering a demo
account's password against production, which I don't do. Checks 2 and 3 cover
the same ground with stronger guarantees — a click-through can't test
cross-tenant isolation — but it is the one thing not observed directly.

## Applying it

Paste the migration into the SQL editor. It ends with two verification
queries: the first should return 12 rows, every `roles` `{authenticated}`
except `reviews_select_visible` (`{public}` by intent) and no `qual` the bare
word `true`; the second should return **zero** rows.

Then check signed-in, which is the part worth eyeballing: a brand sees its own
deals, a creator sees theirs, the wallet still shows ledger rows, and the
inbox still lists threads. Seeded rows whose `owner_email` matches nobody will
stop arriving from Postgres and fall back to the local seed store, which looks
identical in the UI — expected, not a regression.
