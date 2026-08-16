-- 036_deal_owner_and_capacity.sql
--
-- Two columns, two gaps.
--
--   collaborations.owner_user_id   WORKFLOW-GAPS D2
--   (creator capacity is stored inside the existing `creators.availability`
--    jsonb, so C4 needs no column — noted here so the absence is not read
--    as an oversight.)
--
-- WHY owner_user_id
--
-- A brand is a team, but a deal belonged to the brand as a WHOLE: every
-- notification went to whichever user held the brand_id. When that person
-- left, changed roles, or went on leave, the deal had no human attached and
-- simply stopped moving. The demo's own seeded dispute says it out loud —
-- "this sat with someone who has left".
--
-- NULL = the brand's primary user, which is every existing row, so behaviour
-- is unchanged until someone reassigns a deal. Read through
-- `dealOwnerUserId()`, never directly: that helper also drops a stale pointer
-- to someone no longer on the team, so a departed colleague cannot keep
-- receiving a live deal's notifications.
--
-- Deliberately NOT a foreign key to users: this is a soft pointer whose whole
-- job is to degrade to the fallback when it no longer resolves. An FK with
-- ON DELETE RESTRICT would block removing a teammate, and CASCADE would
-- delete the collaboration — both worse than falling back.
--
-- Safe and re-runnable: one nullable column, no backfill.

alter table public.collaborations
  add column if not exists owner_user_id text;

comment on column public.collaborations.owner_user_id is
  'Brand-team member responsible for this deal. NULL = the brand primary user. Soft pointer by design — resolved through dealOwnerUserId(), which falls back when it no longer matches an active team member.';

create index if not exists collaborations_owner_user_id_idx
  on public.collaborations (owner_user_id)
  where owner_user_id is not null;

-- Verification — expect one row: owner_user_id | text | YES
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'collaborations'
  and column_name = 'owner_user_id';
