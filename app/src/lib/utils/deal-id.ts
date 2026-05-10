// Deal-page identity helpers (Phase 24).
//
// A "deal" is the relationship between a brand and a creator on a single
// campaign. It's uniquely identified by the (campaignId, creatorId) pair.
// We expose this pair as a single URL slug for the deal page route at
// `/deal/:dealId`.
//
// Encoding choice: `${campaignId}--${creatorId}`. Chose `--` as the
// separator because:
//   1. Existing IDs use `_` internally (cmp_g0, cr_3) and never `--`,
//      so the split is unambiguous.
//   2. URL-safe — no encoding needed, no escaping rules to remember.
//   3. Visually distinct in the address bar — easy to eyeball whether
//      a URL points at a campaign, a deal, or something else.
//   4. Symmetric with composite keys we use elsewhere (e.g.
//      `${fromUserId}:${targetId}` in review dedup sets).
//
// The encode/decode pair is the ONLY place this format is hard-coded;
// all consumers go through these helpers, so if we ever change the
// separator (e.g. for SEO-friendly slugs) it's a one-line change.

/** Build a URL slug from a campaign + creator pair. */
export function encodeDealId(campaignId: string, creatorId: string): string {
  return `${campaignId}--${creatorId}`;
}

/** Parse a URL slug back into the campaign + creator IDs.
 *  Returns null when the slug is malformed (bad route param, etc.). */
export function decodeDealId(dealId: string | undefined): { campaignId: string; creatorId: string } | null {
  if (!dealId) return null;
  const idx = dealId.indexOf('--');
  if (idx <= 0 || idx >= dealId.length - 2) return null;
  return {
    campaignId: dealId.slice(0, idx),
    creatorId:  dealId.slice(idx + 2),
  };
}
