// remoteRegistry.test.ts — never send a write Postgres must reject.
//
// The observed failure: two `23503` FK violations on every sign-in, from
// collaborations attached to generated seed campaigns that live only in the
// browser. They were caught and silenced — but only after the round trip, so
// the console went red on a completely healthy boot, which is what hides the
// failures that do matter.

import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  recordRemoteCampaigns,
  mayMirrorForCampaign,
  __resetRemoteRegistry,
} from '../remoteRegistry';

describe('mayMirrorForCampaign', () => {
  beforeEach(() => __resetRemoteRegistry());

  it('fails OPEN before hydration — an unknown world suppresses nothing', () => {
    // Ordering hazard: a mutation can fire before the boot fetch resolves.
    // Guessing "not remote" there would silently drop real mirror writes,
    // which is strictly worse than the console noise being fixed.
    expect(mayMirrorForCampaign('cmp_1')).toBe(true);
    expect(mayMirrorForCampaign('cmp_g4')).toBe(true);
  });

  it('permits a campaign Postgres returned', () => {
    recordRemoteCampaigns(['cmp_1', 'cmp_2']);
    expect(mayMirrorForCampaign('cmp_1')).toBe(true);
  });

  it('suppresses a campaign Postgres does not have', () => {
    recordRemoteCampaigns(['cmp_1', 'cmp_2']);
    expect(mayMirrorForCampaign('cmp_g112')).toBe(false);
  });

  it('suppresses a local-only campaign owned by a REAL remote brand', () => {
    // The case that rules out `isDemoCampaign` as the predicate. `cmp_g4`
    // belongs to b_aesop — a demo brand that IS in Postgres — so a
    // demo-ness test would skip mirrors that should succeed while still
    // needing to skip this one. Presence is the only sound question.
    recordRemoteCampaigns(['cmp_1', 'cmp_aesop_draft']);
    expect(mayMirrorForCampaign('cmp_g4')).toBe(false);
    expect(mayMirrorForCampaign('cmp_aesop_draft')).toBe(true);
  });

  it('permits rows that are not campaign-scoped', () => {
    // Top-ups and withdrawals carry no campaign_id, so no FK applies.
    recordRemoteCampaigns(['cmp_1']);
    expect(mayMirrorForCampaign(null)).toBe(true);
    expect(mayMirrorForCampaign(undefined)).toBe(true);
    expect(mayMirrorForCampaign('')).toBe(true);
  });

  it('accumulates across calls and stays hydrated', () => {
    recordRemoteCampaigns(['cmp_1']);
    recordRemoteCampaigns(['cmp_2']);
    expect(mayMirrorForCampaign('cmp_1')).toBe(true);
    expect(mayMirrorForCampaign('cmp_2')).toBe(true);
    expect(mayMirrorForCampaign('cmp_3')).toBe(false);
  });

  it('an empty result must NOT be treated as authoritative', () => {
    // This test previously asserted the opposite, and asserting the
    // opposite is how the bug would have survived review: it pinned
    // "zero campaigns returned" as fact.
    //
    // `fetchAllCampaignsFromSupabase` swallows every error and returns `[]`,
    // so at this layer a failed fetch and an empty table are the same value.
    // Arming on it suppressed every payout, fee, and collaboration mirror
    // for the session — silently, before the try/catch. The caller in
    // store.ts now guards on `campaigns.length > 0`; this pins the reason
    // so nobody "simplifies" the guard away.
    recordRemoteCampaigns([]);
    expect(mayMirrorForCampaign('cmp_1')).toBe(true);
  });

  it('a later successful fetch still arms it after an empty one', () => {
    // The empty call must be inert, not poisoning — otherwise a transient
    // failure on boot would disable the guard permanently.
    recordRemoteCampaigns([]);
    recordRemoteCampaigns(['cmp_1']);
    expect(mayMirrorForCampaign('cmp_1')).toBe(true);
    expect(mayMirrorForCampaign('cmp_g4')).toBe(false);
  });
});

describe('both FK-bearing mirrors consult the guard', () => {
  const read = (p: string) => readFileSync(join(__dirname, '..', '..', 'api', p), 'utf8');

  it('the collaboration mirror gates on it', () => {
    expect(read('collabSync.ts')).toContain('mayMirrorForCampaign(collabSnapshot.campaignId)');
  });

  it('the transaction mirror filters on it', () => {
    // transactions.campaign_id is the same FK; a payout on a local-only
    // campaign is the same guaranteed 23503.
    expect(read('store.ts')).toContain('mayMirrorForCampaign(t.campaignId)');
  });

  it('hydration populates the registry, and only on a non-empty fetch', () => {
    const store = read('store.ts');
    expect(store).toContain('recordRemoteCampaigns(campaigns.map((c) => c.id))');
    // The guard, not just the call. Without it a transient fetch failure
    // silently stops mirroring money.
    expect(store).toContain('if (campaigns.length > 0) {');
  });
});
