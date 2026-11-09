-- 043_campaign_targets.sql — a campaign keeps the brand's per-creator target.
--
-- The wizard asks for a "Target price per creator". It had no column, so in
-- the live app it existed until the next reload, and every surface fell back
-- to estimating it as the budget split four ways ("about $750 a creator").
-- Creators see the target on every brief, so it goes in the public
-- projection (038) too.
--
-- The app works before and after this runs: until the column exists it
-- reads and writes without it (campaignsRepo.ts, isMissingColumn).
--
-- Safe to re-run.

alter table public.campaigns
  add column if not exists per_creator integer;

do $$ begin
  if not exists (select 1 from pg_constraint
                 where conrelid = 'public.campaigns'::regclass
                   and conname = 'campaigns_per_creator_nonnegative') then
    alter table public.campaigns
      add constraint campaigns_per_creator_nonnegative
      check (per_creator is null or per_creator >= 0);
  end if;
end $$;

-- The projection copies columns by name on every write (038's
-- jsonb_populate_record), so adding the column keeps it in sync from now on;
-- the update fills it for rows already there.
alter table public.campaigns_public
  add column if not exists per_creator integer;

update public.campaigns_public p
   set per_creator = c.per_creator
  from public.campaigns c
 where c.id = p.id
   and p.per_creator is distinct from c.per_creator;

-- Verification:
--   select table_name from information_schema.columns
--    where table_schema = 'public' and column_name = 'per_creator';   -- expect 2 rows
--   select count(*) from public.campaigns_public p join public.campaigns c using (id)
--    where p.per_creator is distinct from c.per_creator;              -- expect 0
