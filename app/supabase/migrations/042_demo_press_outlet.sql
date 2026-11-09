-- 042_demo_press_outlet.sql
--
-- Follow-up to 041. 041 left names that are also ordinary words alone, so
-- no sentence got rewritten by accident; "Dawn" (a real newspaper, as the
-- outlet of a press article nobody wrote) was one of them. This renames it
-- only where it is a press outlet, on the one demo creator who has it,
-- matching the app's sample data ("The Sunday Table").
--
-- Safe to run more than once: the second run finds nothing to change.

update public.creators
set press_mentions = (
  select coalesce(jsonb_agg(
    case when e->>'source' = 'Dawn' then jsonb_set(e, '{source}', '"The Sunday Table"') else e end
    order by i), '[]'::jsonb)
  from jsonb_array_elements(press_mentions) with ordinality as t(e, i)
)
where id = 'c_amir'
  and press_mentions @> '[{"source": "Dawn"}]';

-- Check: the source should read "The Sunday Table".
select id, press_mentions from public.creators where id = 'c_amir';
