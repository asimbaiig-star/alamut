-- Phase 9 — migrate the Outreach entity from local store → Postgres.
--
-- Outreach is the brand-side soft-contact pipeline. A brand sends a
-- message to a creator before committing to a real Offer; the creator
-- can reply (engages), decline, or the brand can archive. If the
-- conversation goes well, the brand later calls v2SendOffer with the
-- outreach id and the row is back-linked via resultingOfferId.
--
-- Mutations:
--   v2SendOutreach     · INSERT
--   v2RespondOutreach  · UPDATE status + responded_at (creator-side)
--   v2ArchiveOutreach  · UPDATE status + responded_at (either side)
--   v2SendOffer        · UPDATE resulting_offer_id + status (when an
--                        outreach upgrades to an offer)
--
-- No seed rows: the local seed ships outreach: [].

-- =====================================================================
-- 1. outreach table
-- =====================================================================
create table if not exists public.outreach (
  id text primary key,
  -- Optional. Brand may send before launching a campaign.
  -- on delete set null so deleting a campaign doesn't drop the lead.
  campaign_id text references public.campaigns(id) on delete set null,
  brand_id text not null,
  creator_id text not null,
  sent_by_user_id text not null,
  message text not null default '',
  status text not null default 'sent'
    check (status in ('sent','replied','declined','archived')),
  sent_at timestamptz not null,
  responded_at timestamptz,
  -- Optional sidecar FK to offers; populated when v2SendOffer is called
  -- with this outreach id. No RESTRICT on delete — offers can vanish
  -- (rare) without invalidating the outreach lead.
  resulting_offer_id text references public.offers(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists outreach_brand_id_idx on public.outreach (brand_id);
create index if not exists outreach_creator_id_idx on public.outreach (creator_id);
create index if not exists outreach_status_idx on public.outreach (status);
create index if not exists outreach_sent_at_desc_idx on public.outreach (sent_at desc);

drop trigger if exists outreach_touch on public.outreach;
create trigger outreach_touch
  before update on public.outreach
  for each row execute function public.touch_updated_at();

-- =====================================================================
-- 2. RLS
-- =====================================================================
-- SELECT: authenticated (outreach is a private brand↔creator lead;
--   not anon-readable like reviews).
-- INSERT/UPDATE: authenticated. Tighter per-party gating would need a
--   userId→email mapping the schema doesn't carry; same trade-off as
--   transactions/disputes.
alter table public.outreach enable row level security;

drop policy if exists "outreach_select_authenticated" on public.outreach;
create policy "outreach_select_authenticated" on public.outreach
  for select to authenticated using (true);

drop policy if exists "outreach_insert_authenticated" on public.outreach;
create policy "outreach_insert_authenticated" on public.outreach
  for insert to authenticated with check (true);

drop policy if exists "outreach_update_authenticated" on public.outreach;
create policy "outreach_update_authenticated" on public.outreach
  for update to authenticated using (true) with check (true);

-- =====================================================================
-- 3. Verification (uncomment to run)
-- =====================================================================
-- select 'rows' as t, count(*)::text as v from public.outreach
-- union all select 'policies', count(*)::text from pg_policies where tablename='outreach';
