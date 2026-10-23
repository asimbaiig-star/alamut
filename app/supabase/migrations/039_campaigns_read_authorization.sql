-- 039_campaigns_read_authorization.sql
--
-- The raw `campaigns` table stops being world-readable (SUPABASE-AUDIT.md §4).
--
-- RUN ONLY AFTER the app version that reads `campaigns_public` is deployed.
-- The previous version reads every campaign from this table. Under the policy
-- below it would see only its own, and — worse than missing briefs — it arms
-- the write registry (remoteRegistry.ts) from that list, so a creator's
-- application to a brief they are not yet on would be dropped before it ever
-- reached Postgres, silently. 038 must also be applied: this script checks
-- and refuses otherwise.
--
-- WHO SEES THE FULL ROW
--
--   * the brand that owns the campaign — drafts included
--   * a creator with an application or an offer on it
--
-- Everyone else, signed in or not, reads `campaigns_public` (038): published
-- campaigns only, without spent, escrow_held, history, milestones and
-- auto_shortlist.
--
-- Participants keep the full row because creator-side flows compute with it:
-- dispute settlements and amendments move money against `escrow_held`, and
-- a zero there would write wrong ledger rows. The residual is known: a
-- creator on a multi-creator campaign can still see the campaign's aggregate
-- escrow and spend. That is a long way short of today, where anyone can.
--
-- WHY THE PARTICIPANT CHECK IS SECURITY DEFINER
--
-- The obvious predicates recurse. `is_participant_of_campaign` reads
-- `campaigns` itself. An inline `exists (select 1 from applications ...)`
-- recurses one step later: 037's applications policy calls
-- is_brand_owner_of_campaign, which reads `campaigns`, whose policy reads
-- applications again. So the participant check reads applications and offers
-- as the function owner — no RLS inside, nothing to recurse into — and lives
-- in `private`, which the API does not expose, so it cannot be called over
-- RPC. The caller needs USAGE on the schema and EXECUTE on this one function
-- because a policy expression runs as the caller; nothing else in `private`
-- is executable.
--
-- Re-runnable.

do $$ begin
  if to_regclass('public.campaigns_public') is null then
    raise exception '039 needs 038 first — public.campaigns_public does not exist. Nothing was changed.';
  end if;
end $$;

create or replace function private.is_campaign_participant(p_campaign_id text)
returns boolean language sql stable security definer
set search_path = '' as $$
  select exists (
    select 1
    from public.applications a
    join public.creators cr on cr.id = a.creator_id
    where a.campaign_id = p_campaign_id
      and cr.owner_email is not null
      and cr.owner_email = (select auth.email())
  )
  or exists (
    select 1
    from public.offers o
    join public.creators cr on cr.id = o.creator_id
    where o.campaign_id = p_campaign_id
      and cr.owner_email is not null
      and cr.owner_email = (select auth.email())
  );
$$;

revoke all on function private.is_campaign_participant(text) from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.is_campaign_participant(text) to authenticated;

drop policy if exists "campaigns_select_all" on public.campaigns;
drop policy if exists "campaigns_select_party" on public.campaigns;
create policy "campaigns_select_party" on public.campaigns
  for select to authenticated
  using (
    exists (
      select 1 from public.brands b
      where b.id = campaigns.brand_id
        and b.owner_email is not null
        and b.owner_email = (select auth.email())
    )
    or private.is_campaign_participant(id)
  );

-- =====================================================================
-- Verification
-- =====================================================================
-- Expect exactly one SELECT policy on campaigns, `campaigns_select_party`,
-- roles {authenticated}. The `campaigns_select_all` row must be gone.
select policyname, roles::text as roles, qual
from pg_policies
where schemaname = 'public' and tablename = 'campaigns' and cmd = 'SELECT';
