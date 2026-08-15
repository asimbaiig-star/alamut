// remoteRegistry.ts — which rows actually exist in Postgres.
//
// The marketplace ships with a large local seed. Most of it is mirrored to
// Supabase, but the *generated* campaigns (`cmp_g*`) and brands (`b_gb*`)
// live only in the browser — they exist to make the demo world feel
// populated. Postgres has never seen them.
//
// That matters because several mirrored tables carry a foreign key to
// `campaigns`. A collaboration or a transaction attached to a local-only
// campaign CANNOT be inserted: Postgres rejects it with
// `23503 … Key is not present in table "campaigns"`. The write was doomed
// before it left the browser.
//
// Those failures were already caught and silenced by each mirror's error
// handler — but silencing happens AFTER the round trip, so every sign-in
// still fired guaranteed-to-fail requests and painted the console red. Red
// console noise is not free: it is what hides the failures that do matter.
// (An earlier pass cut ~32 doomed writes per sign-in down to 2 by gating on
// row ownership; these are the remaining 2, and this closes them.)
//
// WHY NOT PATTERN-MATCH THE IDS
//
// A `campaignId.startsWith('cmp_g')` check would be shorter and wrong.
// `lib/utils/demoData.ts` already explains why seed ids are a bad
// discriminator — they come in several shapes and real ids are random
// base36 that could resemble any of them. And "is a demo campaign" is not
// the question being asked: `cmp_g4` belongs to `b_aesop`, a demo brand
// that IS in Postgres, so a demo-ness test would skip mirrors that should
// succeed. The only question that matters is whether Postgres has this
// campaign, so we record what hydration actually returned.
//
// FAIL-OPEN BY DESIGN
//
// Before hydration completes we don't know what's remote, so the guard
// permits the write — exactly the old behaviour. It only ever suppresses a
// write it has positive evidence will fail.

const remoteCampaignIds = new Set<string>();
let campaignsHydrated = false;

/** Called once by the boot hydration with the ids Supabase returned.
 *
 *  Refuses to arm on an EMPTY input, and the caller guards too. Two layers
 *  on purpose: `fetchAllCampaignsFromSupabase` swallows every error and
 *  returns `[]`, so an empty array cannot be distinguished from a failed
 *  fetch here. Arming on it would assert "Postgres has no campaigns" and
 *  silently suppress every money mirror for the session. A genuinely empty
 *  project loses nothing by staying un-armed — it just keeps the older,
 *  noisier behaviour where doomed writes fail loudly. */
export function recordRemoteCampaigns(ids: Iterable<string>): void {
  const incoming = [...ids];
  if (incoming.length === 0) return;
  for (const id of incoming) remoteCampaignIds.add(id);
  campaignsHydrated = true;
}

/**
 * True when a row referencing this campaign may be mirrored.
 *
 * Returns true when hydration hasn't run yet (nothing is known, so don't
 * suppress) and when the campaign is absent/undefined (the row isn't
 * campaign-scoped, so no FK applies).
 */
export function mayMirrorForCampaign(campaignId: string | null | undefined): boolean {
  if (!campaignId) return true;
  if (!campaignsHydrated) return true;
  return remoteCampaignIds.has(campaignId);
}

/** Test seam — resets the module between cases. */
export function __resetRemoteRegistry(): void {
  remoteCampaignIds.clear();
  campaignsHydrated = false;
}
