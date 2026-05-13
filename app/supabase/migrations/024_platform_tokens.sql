-- Migration 024 — platform_tokens (OAuth scaffolding)
--
-- Currently ConnectPlatformModal flips a `verified: true` flag on the
-- Creator.platforms array with no actual OAuth handshake. This migration
-- adds the storage table that a real OAuth implementation would land
-- tokens into. The Edge Function at supabase/functions/oauth-callback/
-- is the code-exchange endpoint; see its README for per-platform setup.
--
-- This migration is INFRASTRUCTURE-ONLY: nothing reads from it yet.
-- v2VerifyChannel still flips the flag. The real wiring (replace flag
-- flip with "do we have a non-expired token for this creator+platform")
-- is left as a follow-up after the dev-portal apps are registered.
--
-- ---------------------------------------------------------------------
-- Security model
-- ---------------------------------------------------------------------
-- access_token + refresh_token are stored plaintext for the prototype.
-- A production cutover should encrypt at rest using pgsodium or a
-- column-level KMS — anyone with read access to the row currently
-- gets the token in clear. RLS still gates so only the owning creator
-- can SELECT. Acceptable for a demo, NOT acceptable for real usage.
--
-- The Edge Function writes via the service_role key (which bypasses
-- RLS) since it needs to write a row for the creator who just
-- completed the redirect flow. Service-role secret lives in the
-- function environment, never reaches the browser.

create table if not exists public.platform_tokens (
  id                   uuid primary key default gen_random_uuid(),
  creator_id           text not null references public.creators(id) on delete cascade,
  owner_email          text not null,
  platform             text not null
                         check (platform in ('instagram','tiktok','youtube','x','newsletter','linkedin')),
  external_account_id  text not null,
  access_token         text not null,
  refresh_token        text,
  expires_at           timestamptz,
  scope                text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),

  -- One token row per (creator, platform). Re-linking the same account
  -- overwrites in place; linking a different external_account_id for
  -- the same platform overwrites too (creators can only have one
  -- account per platform on Alamut today).
  unique (creator_id, platform)
);

create index if not exists platform_tokens_owner_email_idx
  on public.platform_tokens (owner_email);

create index if not exists platform_tokens_expires_at_idx
  on public.platform_tokens (expires_at)
  where expires_at is not null;

drop trigger if exists platform_tokens_touch_updated_at on public.platform_tokens;
create trigger platform_tokens_touch_updated_at
  before update on public.platform_tokens
  for each row execute function public.touch_updated_at();

alter table public.platform_tokens enable row level security;

-- SELECT: only the owning creator. Tokens are scoped per creator and
-- only readable by them — the brand never needs to see a creator's
-- raw token. (Brand-side "is this channel verified" queries can read
-- a derived view that exposes a boolean without the token.)
drop policy if exists platform_tokens_select_own on public.platform_tokens;
create policy platform_tokens_select_own
  on public.platform_tokens
  for select
  using (owner_email = auth.email());

-- INSERT: the Edge Function uses service_role to write. Regular
-- sessions cannot INSERT (preventing a forged "I'm verified on TikTok"
-- write from the browser). If you ever want a direct-from-client write
-- path, change this to `auth.email() = owner_email`.
drop policy if exists platform_tokens_insert_none on public.platform_tokens;
create policy platform_tokens_insert_none
  on public.platform_tokens
  for insert
  with check (false);

-- UPDATE: only the owning creator can update (e.g. to mark
-- access_token rotated, scope changed). Edge function uses service_role
-- which bypasses RLS for the actual token rotation.
drop policy if exists platform_tokens_update_own on public.platform_tokens;
create policy platform_tokens_update_own
  on public.platform_tokens
  for update
  using (owner_email = auth.email())
  with check (owner_email = auth.email());

-- DELETE: only the owning creator (disconnect-platform flow).
drop policy if exists platform_tokens_delete_own on public.platform_tokens;
create policy platform_tokens_delete_own
  on public.platform_tokens
  for delete
  using (owner_email = auth.email());

-- ---------------------------------------------------------------------
-- Public read view — "is this channel verified" without exposing tokens
-- ---------------------------------------------------------------------
-- Brands looking at a creator storefront need to know which channels
-- are actually verified (i.e. backed by a non-expired token). This
-- view exposes only the (creator_id, platform, verified-boolean) tuple
-- with no token contents.
create or replace view public.creator_channel_verified as
select
  creator_id,
  platform,
  (expires_at is null or expires_at > now()) as verified
from public.platform_tokens;

grant select on public.creator_channel_verified to anon, authenticated;

-- ---------------------------------------------------------------------
-- Verification
-- ---------------------------------------------------------------------
-- select 'platform_tokens_policies', count(*)::text from pg_policies where tablename='platform_tokens'
-- union all select 'creator_channel_verified', count(*)::text from pg_views where viewname='creator_channel_verified';
