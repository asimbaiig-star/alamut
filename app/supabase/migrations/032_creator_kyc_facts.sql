-- 032_creator_kyc_facts.sql
--
-- HOW TO RUN
-- ----------
-- Supabase dashboard → SQL Editor → New query → paste → Run.
-- Additive and idempotent: it only adds nullable columns, touches no existing
-- data, and re-running does nothing. There is no dry run because there is
-- nothing to preview — no row is read or changed.
--
--
-- WHY
-- ---
-- Three KYC facts live on `Creator` in the app but have no column here:
--
--   agreement_accepted_at  — when the creator accepted the Creator Agreement
--   agreement_version      — which version they accepted
--   tax_form               — the submitted W-9 / W-8BEN record
--
-- `creatorsRepo` therefore never sent them, and the hydration overlay in
-- store.ts builds each creator by spreading the REMOTE row — so any field
-- Postgres doesn't carry was silently dropped on every page load. A creator
-- could accept the agreement, reload, and be asked to accept it again. The
-- same was already true of a submitted tax form, which is the older half of
-- this bug.
--
-- The client now preserves these values locally across a hydrate, so nothing
-- is lost today. But localStorage is a cache, not a record: clearing it, or
-- signing in on another device, still loses them. An agreement acceptance is
-- exactly the kind of fact that should outlive a browser profile.
--
--
-- AFTER YOU RUN THIS
-- ------------------
-- Tell Claude, and the columns get added to `creatorsRepo`'s COLUMNS list so
-- the values actually round-trip. That step is deliberately NOT bundled here:
-- PostgREST errors on a SELECT naming a column that doesn't exist, so
-- widening the repo before this migration is applied would break hydration
-- for everyone. Order matters — database first, then client.

alter table public.creators
  add column if not exists agreement_accepted_at timestamptz,
  add column if not exists agreement_version     text,
  -- Mirrors `TaxFormRecord` in src/lib/api/types.ts. JSONB rather than
  -- separate columns because the shape differs by form type (W-9 vs
  -- W-8BEN) and is read as a unit.
  add column if not exists tax_form              jsonb;

comment on column public.creators.agreement_accepted_at is
  'When the creator accepted the Creator Agreement (src/lib/legal/creatorAgreement.ts). Null = not accepted.';
comment on column public.creators.agreement_version is
  'Version string accepted, e.g. "1.0". A newer CREATOR_AGREEMENT_VERSION prompts re-acceptance rather than binding them to terms they never saw.';
comment on column public.creators.tax_form is
  'Submitted W-9 / W-8BEN record. Shape: TaxFormRecord in src/lib/api/types.ts.';

-- The public view (migration 025) deliberately excludes PII. These three are
-- PII-adjacent — a tax form certainly is — so they stay OUT of
-- `creators_public` and are readable only through the owner-gated raw table.
-- Nothing to do here; noted so the omission reads as intentional.

select
  count(*) filter (where agreement_accepted_at is not null) as already_accepted,
  count(*) filter (where tax_form is not null)              as already_have_tax_form,
  count(*)                                                  as total_creators
from public.creators;
