-- 030_collaborations_dedupe.sql
--
-- HOW TO RUN
-- ----------
-- Supabase dashboard → SQL Editor → New query. No CLI or connection string.
--
--   1. Run STEP 0 (below the header) FIRST. It is read-only and lists every
--      duplicated pair with the row that would survive. If it returns no
--      rows, there is nothing to merge — skip to STEP 3 alone (the unique
--      index) so the problem cannot come back.
--   2. Only if STEP 0 looks right, run everything from `begin;` onwards.
--
-- THIS ONE DELETES ROWS. 031 only rewrote a number; this removes duplicate
-- collaboration records after folding their content into the survivor. The
-- whole thing runs in one transaction with a self-check that rolls back if
-- any duplicate survives, so a failure leaves the table untouched — but a
-- SUCCESSFUL run cannot be undone. Take a snapshot first if you want a
-- rollback point (Database → Backups).
--
-- Expected output: the `do $$ ... $$` block prints nothing on success. To see
-- what changed, re-run STEP 0 afterwards — it should return zero rows.
--
-- A Collaboration is uniquely identified by (campaign_id, creator_id) — one
-- row per brand-campaign × creator pair. 006_collaborations.sql indexed those
-- columns separately but never enforced uniqueness across them, so the same
-- pair could exist twice under two different ids. It did: 3 pairs in the live
-- data, e.g. Sarah Johnson on cmp_1 held one row at 'confirmed' and its twin
-- at 'submitted'.
--
-- How they arose: the client materializes Collaboration rows locally with
-- generated ids, and store.ts's overlay merged remote rows BY ID. Same pair,
-- two ids → the remote row was appended rather than merged.
--
-- Why it mattered: ensureCollabState() finds by pair and updates only the
-- FIRST match, so the twin never advanced and the two disagreed about stage
-- permanently. Both then mirrored back here under separate ids.
--
-- This migration merges rather than deletes-and-hopes: each twin can hold
-- history the other lacks, so the surviving row absorbs everything first.
--
-- Idempotent: re-running is a no-op once no pair has more than one row.

-- ═════════════════════════════════════════════════════════════════════
-- STEP 0 — DRY RUN. Read-only. Run this on its own first.
--
-- Lists every row belonging to a duplicated pair, newest/furthest first,
-- flagging which one the merge would keep. `would_survive = false` rows are
-- the ones STEP 2 deletes, after STEP 1 has folded their history, escrow
-- freeze, and nullable fields into the survivor.
-- ═════════════════════════════════════════════════════════════════════
with ranked as (
  select
    id, campaign_id, creator_id, stage, updated_at,
    case stage
      when 'invited'     then 1
      when 'pitched'     then 2
      when 'negotiating' then 3
      when 'confirmed'   then 4
      when 'submitted'   then 5
      when 'approved'    then 6
      when 'live'        then 7
      when 'paid'        then 8
      else 0
    end as stage_rank
  from public.collaborations
),
dupes as (
  select campaign_id, creator_id
  from public.collaborations
  group by campaign_id, creator_id
  having count(*) > 1
)
select
  r.campaign_id,
  r.creator_id,
  r.id,
  r.stage,
  r.updated_at,
  row_number() over (
    partition by r.campaign_id, r.creator_id
    order by r.stage_rank desc, r.updated_at desc, r.id
  ) = 1 as would_survive
from ranked r
join dupes d
  on d.campaign_id = r.campaign_id and d.creator_id = r.creator_id
order by r.campaign_id, r.creator_id, would_survive desc, r.updated_at desc;


-- ═════════════════════════════════════════════════════════════════════
-- STEP 1 — THE MIGRATION. One transaction; rolls back on any problem.
--
-- REVISED after a pre-flight check found a contract row pointing at the
-- twin that gets deleted. `contracts.collaboration_id` and
-- `disputes.collaboration_id` are ON DELETE RESTRICT, so the delete below
-- would have aborted the whole migration with a raw FK error; and
-- `threads.collaboration_id` is ON DELETE SET NULL, which would have
-- quietly unlinked a deal room instead of failing loudly. Child rows are
-- now repointed onto the survivor first.
-- ═════════════════════════════════════════════════════════════════════

begin;

-- ---------------------------------------------------------------------
-- Step 1 — decide the survivor for every duplicated pair, once.
-- ---------------------------------------------------------------------
-- Winner = furthest pipeline stage. 'cancelled' is terminal and OUTSIDE the
-- pipeline ordering, so it ranks 0 and can never mask real progress — the
-- same rule as COLLAB_STAGE_ORDER in src/lib/api/collabSync.ts.
--
-- Built once into a temp table instead of re-deriving the same ranked/winners
-- CTE at each step, which is how the earlier draft was written. Two copies of
-- a ranking rule is exactly the drift this codebase keeps paying for.
create temporary table _dedupe_map on commit drop as
with ranked as (
  select
    id, campaign_id, creator_id, updated_at,
    case stage
      when 'invited'     then 1
      when 'pitched'     then 2
      when 'negotiating' then 3
      when 'confirmed'   then 4
      when 'submitted'   then 5
      when 'approved'    then 6
      when 'live'        then 7
      when 'paid'        then 8
      else 0
    end as stage_rank
  from public.collaborations
),
winners as (
  select distinct on (campaign_id, creator_id)
    id, campaign_id, creator_id
  from ranked
  order by campaign_id, creator_id, stage_rank desc, updated_at desc, id
)
select
  c.id        as loser_id,
  w.id        as winner_id,
  c.campaign_id,
  c.creator_id
from public.collaborations c
join winners w
  on w.campaign_id = c.campaign_id and w.creator_id = c.creator_id
where c.id <> w.id;

-- ---------------------------------------------------------------------
-- Step 2 — fold each loser's content into its survivor.
-- ---------------------------------------------------------------------
-- Scalar fields: earliest creation, latest update, and a set value beats a
-- null on everything nullable. bool_or keeps an escrow freeze — losing that
-- would un-freeze escrow on a disputed collaboration. `stage` is deliberately
-- excluded: the winner was chosen BY its stage, so it already holds the
-- furthest one.
with pairs as (
  select distinct campaign_id, creator_id from _dedupe_map
),
agg as (
  select
    campaign_id,
    creator_id,
    min(created_at)                                          as created_at,
    max(updated_at)                                          as updated_at,
    bool_or(escrow_frozen)                                   as escrow_frozen,
    max(agreed_rate)                                         as agreed_rate,
    max(accepted_offer_id)                                   as accepted_offer_id,
    max(contract_id)                                         as contract_id,
    min(cancelled_at)                                        as cancelled_at,
    max(cancellation_reason)                                 as cancellation_reason,
    (array_remove(array_agg(cancellation_request), null))[1]  as cancellation_request,
    max(version)                                             as version
  from public.collaborations
  where (campaign_id, creator_id) in (select campaign_id, creator_id from pairs)
  group by campaign_id, creator_id
),
-- History: union the transcripts, drop transitions recorded identically in
-- both rows, and re-sort chronologically.
hist as (
  select
    campaign_id,
    creator_id,
    coalesce(jsonb_agg(entry order by (entry->>'at')::numeric), '[]'::jsonb) as history
  from (
    select distinct
      c.campaign_id,
      c.creator_id,
      jsonb_array_elements(c.history) as entry
    from public.collaborations c
    where (c.campaign_id, c.creator_id) in (select campaign_id, creator_id from pairs)
  ) exploded
  group by campaign_id, creator_id
)
update public.collaborations t
set
  created_at           = a.created_at,
  updated_at           = a.updated_at,
  escrow_frozen        = a.escrow_frozen,
  agreed_rate          = a.agreed_rate,
  accepted_offer_id    = a.accepted_offer_id,
  contract_id          = a.contract_id,
  cancelled_at         = a.cancelled_at,
  cancellation_reason  = a.cancellation_reason,
  cancellation_request = a.cancellation_request,
  version              = a.version,
  history              = coalesce(h.history, t.history)
from _dedupe_map m
  join agg a
    on a.campaign_id = m.campaign_id and a.creator_id = m.creator_id
  left join hist h
    on h.campaign_id = m.campaign_id and h.creator_id = m.creator_id
where t.id = m.winner_id;

-- ---------------------------------------------------------------------
-- Step 3 — repoint every child row from the loser onto the survivor.
-- ---------------------------------------------------------------------
-- MUST come before the delete. Verified live before this ran: 1 contract
-- pointed at the twin and 0 at the survivor, so this moves it rather than
-- colliding. `contracts.collaboration_id` has no unique constraint, so even
-- a pair where both rows carried a contract repoints safely.
update public.contracts x
set collaboration_id = m.winner_id
from _dedupe_map m
where x.collaboration_id = m.loser_id;

update public.disputes x
set collaboration_id = m.winner_id
from _dedupe_map m
where x.collaboration_id = m.loser_id;

update public.threads x
set collaboration_id = m.winner_id
from _dedupe_map m
where x.collaboration_id = m.loser_id;

-- ---------------------------------------------------------------------
-- Step 4 — drop the now-redundant twins.
-- ---------------------------------------------------------------------
-- Safe only because Step 2 folded their content into the winner and Step 3
-- moved everything that referenced them.
delete from public.collaborations c
using _dedupe_map m
where c.id = m.loser_id;

-- ---------------------------------------------------------------------
-- Step 5 — enforce the invariant so this cannot recur.
-- ---------------------------------------------------------------------
-- The client writer (src/lib/data/collaborationsRepo.ts) updates the pair's
-- existing row before falling back to INSERT, so a client holding a different
-- id for the same pair updates rather than colliding with this index.
create unique index if not exists collaborations_campaign_creator_uidx
  on public.collaborations (campaign_id, creator_id);

-- ---------------------------------------------------------------------
-- Step 6 — self-check, and report.
-- ---------------------------------------------------------------------
-- Step 5 already fails the transaction if any duplicate survived (that is
-- what a unique index does), so the exception below exists purely to fail
-- with a message that says what went wrong. Everything is inside one
-- transaction: if anything is wrong, the table is untouched.
do $$
declare
  remaining integer;
  orphaned  integer;
begin
  select count(*) into remaining
  from (
    select 1
    from public.collaborations
    group by campaign_id, creator_id
    having count(*) > 1
  ) still_duplicated;

  if remaining > 0 then
    raise exception
      'collaborations dedupe incomplete: % pair(s) still duplicated — rolling back',
      remaining;
  end if;

  -- Nothing may reference a collaboration that no longer exists. The FKs
  -- enforce this themselves; checking again turns a silent assumption into
  -- a stated one.
  select count(*) into orphaned
  from public.contracts x
  where not exists (select 1 from public.collaborations c where c.id = x.collaboration_id);

  if orphaned > 0 then
    raise exception
      'dedupe left % contract(s) pointing at a deleted collaboration — rolling back',
      orphaned;
  end if;
end $$;

commit;
