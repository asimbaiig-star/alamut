-- 030_collaborations_dedupe.sql
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

begin;

-- ---------------------------------------------------------------------
-- Step 1 — fold every duplicate group into its surviving row.
-- ---------------------------------------------------------------------
-- Winner = furthest pipeline stage. 'cancelled' is terminal and OUTSIDE the
-- pipeline ordering, so it ranks 0 and can never mask real progress — the
-- same rule as COLLAB_STAGE_ORDER in src/lib/api/collabSync.ts.
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
),
-- Only pairs that are actually duplicated. Without this the UPDATE would
-- rewrite every row in the table with aggregates of itself — a no-op in value
-- but a needless write across thousands of rows, and it removes any doubt
-- that a healthy pair could be altered.
dupes as (
  select campaign_id, creator_id
  from public.collaborations
  group by campaign_id, creator_id
  having count(*) > 1
),
-- Scalar fields: earliest creation, latest update, and a set value beats a
-- null on everything nullable. bool_or keeps an escrow freeze — losing that
-- would un-freeze escrow on a disputed collaboration.
agg as (
  select
    campaign_id,
    creator_id,
    min(created_at)                                            as created_at,
    max(updated_at)                                            as updated_at,
    bool_or(escrow_frozen)                                     as escrow_frozen,
    max(agreed_rate)                                           as agreed_rate,
    max(accepted_offer_id)                                     as accepted_offer_id,
    max(contract_id)                                           as contract_id,
    min(cancelled_at)                                          as cancelled_at,
    max(cancellation_reason)                                   as cancellation_reason,
    (array_remove(array_agg(cancellation_request), null))[1]    as cancellation_request,
    max(version)                                               as version
  from public.collaborations
  where (campaign_id, creator_id) in (select campaign_id, creator_id from dupes)
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
    where (c.campaign_id, c.creator_id) in (select campaign_id, creator_id from dupes)
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
from winners w
  join agg a
    on a.campaign_id = w.campaign_id and a.creator_id = w.creator_id
  left join hist h
    on h.campaign_id = w.campaign_id and h.creator_id = w.creator_id
where t.id = w.id;

-- ---------------------------------------------------------------------
-- Step 2 — drop the now-redundant twins.
-- ---------------------------------------------------------------------
-- Safe only because Step 1 already folded their content into the winner.
-- `stage` is deliberately excluded from the update above: the winner was
-- chosen BY its stage, so it already holds the furthest one.
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
delete from public.collaborations c
using winners w
where c.campaign_id = w.campaign_id
  and c.creator_id  = w.creator_id
  and c.id         <> w.id;

-- ---------------------------------------------------------------------
-- Step 3 — enforce the invariant so this cannot recur.
-- ---------------------------------------------------------------------
-- The client writer (src/lib/data/collaborationsRepo.ts) updates the pair's
-- existing row before falling back to INSERT, so a client holding a different
-- id for the same pair updates rather than colliding with this index.
create unique index if not exists collaborations_campaign_creator_uidx
  on public.collaborations (campaign_id, creator_id);

-- ---------------------------------------------------------------------
-- Step 4 — self-check.
-- ---------------------------------------------------------------------
-- Step 3 already fails the transaction if any duplicate survived (that is
-- what a unique index does), so this exists purely to fail with a message
-- that says what went wrong instead of a raw constraint violation. Every
-- statement here is inside one transaction: if anything is wrong, the whole
-- migration rolls back and the table is untouched.
do $$
declare
  remaining integer;
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
end $$;

commit;
