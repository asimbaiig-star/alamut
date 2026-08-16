-- 035_amendments.sql
--
-- Post-acceptance changes to a deal (WORKFLOW-GAPS E2 + E3).
--
-- Three columns, one feature:
--
--   collaborations.amendments   the proposed/agreed/declined changes
--   contracts.rights_snapshot   what the creator actually signed
--   deliverables.creator_id     a slot owed by ONE creator, not the campaign
--
-- WHY EACH ONE
--
-- `amendments` is jsonb on the collaboration rather than its own table, and
-- that is deliberate: an amendment is always fetched with its deal, never
-- queried across deals, and it belongs to exactly one. The same reasoning
-- already put `disputes.messages`, `disputes.evidence` and
-- `collaborations.history` in jsonb. A table would buy queryability nothing
-- needs and cost a fresh set of RLS policies to get right.
--
-- `rights_snapshot` closes a real bug that predates amendments. Contracts
-- snapshot the deliverables and the brief text so a brand editing the
-- campaign afterwards cannot rewrite what a creator signed — but rights,
-- the term with the longest tail, were never snapshotted. Editing
-- `campaigns.rights` retroactively changed the licence on every past deal.
-- It is also the base an E2 extension widens from: you cannot extend a
-- window that was never recorded.
--
-- `deliverables.creator_id` is what makes a per-creator scope addition
-- possible at all. Deliverables were uniformly campaign-wide, and every
-- consumer filtered on campaign_id alone. Adding one creator's extra Story
-- as a plain campaign row would have put an unfilled slot on EVERY creator's
-- collab — and because stage is derived from slot completion, it would have
-- dragged all of them backwards out of `approved` and `paid`.
--
--   NULL  = campaign-wide, owed by everyone. Every existing row, so current
--           behaviour is unchanged.
--   set   = owed by that creator alone.
--
-- Safe and re-runnable: three nullable/defaulted columns, no backfill, no
-- data rewritten.

alter table public.collaborations
  add column if not exists amendments jsonb not null default '[]'::jsonb;

alter table public.contracts
  add column if not exists rights_snapshot jsonb;

alter table public.deliverables
  add column if not exists creator_id text;

comment on column public.collaborations.amendments is
  'Post-acceptance changes: [{id, kind, proposedBy, proposedAt, amount, note, status, ...}]. Append-only — declined and withdrawn entries stay on the record.';
comment on column public.contracts.rights_snapshot is
  'ContentRights as agreed at acceptance. NULL on contracts predating this column; callers fall back to the campaign.';
comment on column public.deliverables.creator_id is
  'NULL = campaign-wide (owed by every creator). Set = owed by that creator alone, added by an agreed scope amendment.';

-- Only creator-scoped rows need looking up by creator; the partial index
-- keeps it off the overwhelmingly common NULL case.
create index if not exists deliverables_creator_id_idx
  on public.deliverables (creator_id)
  where creator_id is not null;

-- Verification — expect three rows:
--   collaborations | amendments      | jsonb | NO
--   contracts      | rights_snapshot | jsonb | YES
--   deliverables   | creator_id      | text  | YES
select table_name, column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public'
  and (   (table_name = 'collaborations' and column_name = 'amendments')
       or (table_name = 'contracts'      and column_name = 'rights_snapshot')
       or (table_name = 'deliverables'   and column_name = 'creator_id'))
order by table_name;
