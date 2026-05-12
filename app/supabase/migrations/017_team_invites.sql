-- Migration 017 — brand team invites
--
-- Lets a brand owner add teammates by inviting them by email. The
-- invitee receives a token-bearing URL (in the demo, the URL is shown
-- in a copy-able modal; real product would email it via SES / SendGrid).
-- Visiting the URL while signed in attaches the user to the brand
-- with the role the invite specified.
--
-- Status semantics:
--   - pending   · row exists, not accepted/revoked
--   - accepted  · acceptedAt + acceptedByUserId set
--   - revoked   · revokedAt set (no longer redeemable)
--
-- One token can only be redeemed once. A second visit hits the
-- already-accepted guard at the application layer.

-- =====================================================================
-- Helper — `is_brand_owner_of_brand(brand_id)`
-- =====================================================================
-- Migration 005 added is_brand_owner_of_campaign; we need the same shape
-- gated by brand_id directly. Defined FIRST so the RLS policies below
-- can reference it.
create or replace function public.is_brand_owner_of_brand(p_brand_id text)
returns boolean language sql stable security invoker as $$
  select exists (
    select 1 from public.brands b
    where b.id = p_brand_id and b.owner_email = auth.email()
  );
$$;

create table if not exists public.team_invites (
  id text primary key,
  brand_id text not null references public.brands(id) on delete cascade,
  invited_by_user_id text not null,
  invited_email text not null,
  role text not null check (role in ('admin','ops','finance','viewer')),
  token text not null unique,
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  accepted_by_user_id text,
  revoked_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists team_invites_brand_id_idx on public.team_invites (brand_id);
create index if not exists team_invites_invited_email_idx on public.team_invites (lower(invited_email));
create index if not exists team_invites_token_idx on public.team_invites (token);

drop trigger if exists team_invites_touch on public.team_invites;
create trigger team_invites_touch
  before update on public.team_invites
  for each row execute function public.touch_updated_at();

-- =====================================================================
-- RLS
-- =====================================================================
-- SELECT: authenticated users see invites where:
--   - they own the brand (brand_id in their owned brands), OR
--   - their email matches invited_email (so the invitee can read their
--     own pending invites without revealing other brands' invites).
-- INSERT: only the brand owner.
-- UPDATE: brand owner (revoke) OR matching-email invitee (accept).
alter table public.team_invites enable row level security;

drop policy if exists "team_invites_select" on public.team_invites;
create policy "team_invites_select" on public.team_invites
  for select to authenticated using (
    public.is_brand_owner_of_brand(brand_id)
    or lower(invited_email) = lower(auth.email())
  );

drop policy if exists "team_invites_insert" on public.team_invites;
create policy "team_invites_insert" on public.team_invites
  for insert to authenticated
  with check (public.is_brand_owner_of_brand(brand_id));

drop policy if exists "team_invites_update" on public.team_invites;
create policy "team_invites_update" on public.team_invites
  for update to authenticated
  using (
    public.is_brand_owner_of_brand(brand_id)
    or lower(invited_email) = lower(auth.email())
  )
  with check (
    public.is_brand_owner_of_brand(brand_id)
    or lower(invited_email) = lower(auth.email())
  );

-- Verification:
-- select column_name from information_schema.columns
--   where table_schema='public' and table_name='team_invites' order by ordinal_position;
-- select policyname, cmd from pg_policies
--   where schemaname='public' and tablename='team_invites';
