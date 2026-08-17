// v2Adapters.ts — pure mapping functions from existing domain types
// (Creator, Campaign, Thread, Transaction, ...) to V2 shapes.
//
// Phase B of the migration. The v2 surfaces consume V2Creator,
// V2Campaign, V2Conversation, etc. — the older shapes designed for the
// Pakistani-first prototype. The live store uses richer Creator /
// Campaign / Thread types. This file maps between them so the v2
// components can stay pure and just consume hooks.
//
// Mapping conventions:
//   - Cover images: derived deterministically from creator id since the
//     existing Creator type has no cover field
//   - Score: derived from rating × 20 (0–5 → 0–100)
//   - Tier: from rate band ($, $$, $$$, $$$$)
//   - Status: Campaign.stage → V2 Live/Active/Planned/Completed
//   - Channels: Platform[] mapped to v2 platform-id casing

import type {
  Creator, Campaign, Thread, Transaction, Brand, Database, Platform,
  Submission, Deliverable,
} from '@/lib/api/types';
import { getAcceptedCreators, isCreatorAccepted, isCreatorShortlisted } from '@/lib/api/relations';
// P67 — stage + per-slot statuses come from the SAME functions that
// write Collaboration.stage (ensureCollabState path). Pre-P67 this
// module carried its own parallel derivation, which drifted from the
// stored stage in three documented ways (payout-coerced live, latest-
// sub-only rollup, missing cleared-status check on payouts).
import { computeCollabStage, computeSlotStatuses } from '@/lib/api/collabSync';
import { isDemoBrand, isDemoCreator } from '@/lib/utils/demoData';
import type {
  V2Creator, V2Campaign, V2Conversation, V2Channel, V2Audience,
  V2WalletLedgerEntry, V2Collab, V2CollabStage, V2Deliverable, V2PipelineStage,
} from './data';
import { PLATFORM_FEE, WHT } from '@/lib/api/money';

// =====================================================================
// Cover image fallback
// =====================================================================

const COVER_POOL = [
  'photo-1490481651871-ab68de25d43d', // sunny portrait
  'photo-1497366216548-37526070297c', // workspace
  'photo-1606117331085-5760e3b58520', // mountain
  'photo-1565299624946-b28f40a0ae38', // food
  'photo-1518770660439-4636190af475', // tech
  'photo-1503454537195-1dcabb73ffb9', // family
  'photo-1571019613454-1cb2f99b2d8b', // fitness
  'photo-1554224155-6726b3ff858f',    // finance
  'photo-1556228720-195a672e8a03',    // skincare
  'photo-1556909114-f6e7ad7d3136',    // food bowl
];
function coverFor(id: string): string {
  // Deterministic hash from the id so cover stays stable across reloads.
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  const choice = COVER_POOL[h % COVER_POOL.length];
  return `https://images.unsplash.com/${choice}?w=1200&h=400&fit=crop`;
}

// =====================================================================
// Platform name mapping
// =====================================================================

const PLATFORM_TO_V2: Record<Platform['name'], V2Channel['platform']> = {
  Instagram: 'instagram',
  YouTube:   'youtube',
  TikTok:    'tiktok',
  Newsletter:'newsletter',
  X:         'x',
  LinkedIn:  'linkedin',
  Substack:  'newsletter',
};

function platformToV2Channel(p: Platform): V2Channel {
  return {
    platform: PLATFORM_TO_V2[p.name] ?? 'instagram',
    handle: p.handle,
    followers: p.followers,
    engagement: p.engagement,
  };
}

// =====================================================================
// Creator → V2Creator
// =====================================================================

function priceTier(rate: number): V2Creator['priceTier'] {
  if (rate < 300) return '$';
  if (rate < 800) return '$$';
  if (rate < 2500) return '$$$';
  return '$$$$';
}

/** Parse a free-form rate string like "$800–1,500" into a numeric pair. */
function parseRateBand(s?: string): { min: number; max: number } | null {
  if (!s) return null;
  const nums = s.match(/\$?\s*(\d+(?:,\d{3})*(?:\.\d+)?)/g);
  if (!nums || nums.length === 0) return null;
  const cleaned = nums.map((n) => parseFloat(n.replace(/[$,\s]/g, '')));
  if (cleaned.length === 1) return { min: cleaned[0], max: cleaned[0] };
  return { min: Math.min(...cleaned), max: Math.max(...cleaned) };
}

/** Pick a representative rate for "Reel + Stories combo" pricing. */
function defaultRate(c: Creator): number {
  // Try the per-platform rateCards first
  for (const entry of c.rateCards ?? []) {
    if (entry.format === 'reel' || entry.format === 'bundle') {
      const band = parseRateBand(entry.rate);
      if (band) return Math.round((band.min + band.max) / 2);
    }
  }
  // Fall back to legacy single rate card — reel preferred
  const fallback = parseRateBand(c.rateCard?.reel) ?? parseRateBand(c.rateCard?.post);
  if (fallback) return Math.round((fallback.min + fallback.max) / 2);
  // Tier-based defaults if rate cards are missing
  return c.tier === 'Flagship' ? 4500 : c.tier === 'Specialist' ? 1200 : 350;
}

/**
 * Aggregate audience demographics, or `null` when there are none.
 *
 * This used to return `{ female: 60, male: 40, age2534: 40, age1824: 25,
 * topCity: 'Lahore' }` — commented "reasonable defaults when no demo data".
 * `Platform.audience` is only ever populated on seeded demo platforms;
 * nothing in `v2CreatorActions` writes it, so a real creator can never fill
 * it in. That made the placeholder permanent, not transitional: every real
 * signup's public storefront showed the same invented demographics, drawn as
 * labelled progress bars under a tip reading "Aggregated from your connected
 * channels".
 *
 * Returning null pushes the decision to the surfaces, which now say the data
 * needs connected channels instead of inventing a stand-in.
 */
export function aggregateAudienceForTest(
  audiences: NonNullable<Platform['audience']>[],
): V2Audience | null {
  return aggregateAudience(audiences.map((audience) => ({ audience }) as Platform));
}

function aggregateAudience(platforms: Platform[]): V2Audience | null {
  const withAudience = platforms.filter((p) => p.audience);
  if (withAudience.length === 0) return null;
  // Mean WITHOUT rounding. `avg` used to round to an integer before the
  // caller multiplied by 100 — and every one of these fields is a 0..1
  // fraction, so 0.78 became 1 and then 100%, while 0.18 became 0 and then
  // 0%. Every seeded creator's storefront showed a 100% / 0% gender split
  // and a 0%-or-100% age band. Round once, at the end.
  const mean = (key: (a: NonNullable<Platform['audience']>) => number) =>
    withAudience.reduce((s, p) => s + key(p.audience!), 0) / withAudience.length;
  const pct = (key: (a: NonNullable<Platform['audience']>) => number) =>
    Math.round(mean(key) * 100);

  const top = withAudience[0].audience!.topCountries[0];
  return {
    female:  pct((a) => a.genderSplit.female),
    male:    pct((a) => a.genderSplit.male),
    age2534: pct((a) => a.ageBuckets['25-34']),
    age1824: pct((a) => a.ageBuckets['18-24']),
    // `ageBuckets['35-44']` was read by nobody: this projection stopped at
    // 25-34, so `V2Audience.age3544` was permanently undefined even though
    // the underlying bucket is populated. Two consumers depended on it —
    // Discover's "Gen X · 35–44" filter, which could therefore never match
    // a single creator, and BrandAnalytics, which drew a 0% bar for 35–44
    // and swept the entire real 35–44 share into its 45+ residual.
    age3544: pct((a) => a.ageBuckets['35-44']),
    // Named `topCity` but populated from the top COUNTRY. Renaming the field
    // touches every consumer, so surfaces label it "region"; noted here so
    // the mismatch isn't mistaken for a data error.
    topCity: top?.country ?? '',
  };
}

export function creatorToV2(c: Creator, db?: Pick<Database, 'reviews'>): V2Creator {
  // Average of this creator's visible reviews, or null when there are none.
  // Pass `db` wherever a score is displayed; without it the projection can't
  // know the rating and reports null rather than falling back to the stale
  // stored field.
  const visibleReviews = (db?.reviews ?? []).filter(
    (r) => r.reviewType === 'creator' && r.targetId === c.id && !r.hidden,
  );
  const liveRating = visibleReviews.length > 0
    ? visibleReviews.reduce((s, r) => s + r.rating, 0) / visibleReviews.length
    : null;
  const channels = c.platforms.map(platformToV2Channel);
  const rate = defaultRate(c);
  const ratesAll = (c.rateCards ?? []).map((r) => parseRateBand(r.rate)).filter(Boolean) as { min: number; max: number }[];
  const allMins = ratesAll.map((r) => r.min);
  const allMaxs = ratesAll.map((r) => r.max);
  return {
    id: c.id,
    handle: c.handle.replace(/^@/, ''),
    name: c.name,
    tagline: c.tagline,
    avatar: c.portrait,
    // Prefer the creator's own uploaded/picked cover when set; otherwise
    // fall back to a deterministic Unsplash URL keyed off their id.
    cover: c.cover ?? coverFor(c.id),
    city: c.city,
    country: c.country,
    bio: c.bio,
    // Pass through the FULL list — consumers (Discover card, Storefront
    // editor) slice as needed. Capping here silently dropped entries
    // beyond the first N from the public storefront and other surfaces
    // (s19 fix — public storefront was missing categories 4+ and brands 5+).
    categories: c.categories,
    isDemo: isDemoCreator(c),
    responseHrs: c.responseHrs,
    // P-10 — this is the creator's REVIEW RATING rescaled to 0–100, and
    // nothing more. It was previously surfaced in Discover as an "Alamut
    // score" and used as the default sort for hiring decisions, which made
    // a review average look like a fit score. Worse, the `?? 4.5` default
    // handed a creator with **no reviews at all** a flattering 90.
    //
    // Now: no reviews ⇒ null, so callers must say "no reviews yet" instead
    // of inventing a number. Actual fit lives in ./matching.ts.
    // Computed LIVE from `db.reviews`, not read from the stored
    // `Creator.rating` field.
    //
    // That field is assigned in exactly one place — the dead legacy
    // `leaveReview` in client.ts, which has no callers. The live path
    // (`v2LeaveReview`) writes a Review row and never touches it. So the
    // badge was frozen at its seeded value forever, while `trustForCreator`
    // computed the average live from the same reviews: one creator, two
    // different ratings, on two screens of the same product.
    score: liveRating !== null ? Math.round(liveRating * 20) : null,
    priceTier: priceTier(rate),
    priceMin: allMins.length > 0 ? Math.min(...allMins) : Math.round(rate * 0.5),
    priceMax: allMaxs.length > 0 ? Math.max(...allMaxs) : Math.round(rate * 1.8),
    verified: c.verified,
    channels,
    audience: aggregateAudience(c.platforms),
    rate,
    pastBrands: c.pastClients ?? [],
    work: c.work,
    pressMentions: c.pressMentions,
    featuredReviewIds: c.featuredReviewIds,
    availability: c.availability,
  };
}

// =====================================================================
// Campaign → V2Campaign
// =====================================================================

// P1b §1.2 — 4-stage campaign lifecycle. The V2Campaign.status field
// kept its old 4-value enum (Live/Active/Planned/Completed) for existing
// UI consumers; map the new CampaignStage onto it. 'Active' (which the
// pre-P1b model used for shortlist/offer/production) is no longer
// reachable from a Campaign — when needed it'll be derived from the
// presence of in-flight Collaborations (P1c).
const STAGE_TO_V2_STATUS: Record<Campaign['stage'], V2Campaign['status']> = {
  draft:  'Planned',
  live:   'Live',
  paused: 'Paused',
  closed: 'Completed',
};

export function campaignToV2(c: Campaign, db: Database): V2Campaign {
  const brand = db.brands.find((b) => b.id === c.brandId);
  // Live placements = collabs at stage 'live' or 'paid'. Pre-fix this
  // was `submissions where status='approved'`, which overcounted:
  // submissions stay at `approved` even after mark-live (deliverable
  // status promotes to 'live', not the submission status). So the
  // home card said "1 live" while the kanban Live column was empty
  // for an approved-but-not-yet-marked-live collab. Counting raw
  // Collaboration.stage matches the kanban exactly.
  const liveCount = db.collaborations.filter(
    (col) => col.campaignId === c.id && (col.stage === 'live' || col.stage === 'paid'),
  ).length;
  return {
    id: c.id,
    name: c.title,
    brand: brand?.name ?? 'Unknown',
    status: STAGE_TO_V2_STATUS[c.stage],
    budget: c.budget,
    spent: c.spent,
    confirmed: getAcceptedCreators(c.id, db).length,
    live: liveCount,
    submitted: db.submissions.filter((s) => s.campaignId === c.id).length,
    paid: c.spent,  // simplification; spent ≈ paid out
    creators: getAcceptedCreators(c.id, db),
    placement: c.deliverablesText,
    deadline: c.deadline,
    brief: c.pitch || c.brief,
    category: c.category,
    createdAt: c.createdAt,
    brandVerified: brand?.verified ?? false,
    // F19 — is this a seeded demo brand nobody real owns? Surfaces let
    // creators know a brief won't get a reply before they spend effort
    // applying to it.
    brandIsDemo: isDemoBrand(brand),
    brandLogoUrl: brand?.logoUrl,
    escrowHeld: c.escrowHeld,
    assets: c.assets,
  };
}

// =====================================================================
// Thread + Messages → V2Conversation
// =====================================================================

export function relativeTime(iso: string): string {
  const t = new Date(iso).getTime();
  const now = Date.now();
  const m = Math.floor((now - t) / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function threadToV2(t: Thread, db: Database, viewerUserId: string): V2Conversation | null {
  // Resolve the creator participant + brand participant — independent
  // of who's viewing. A thread always has one of each (the brand owner
  // + the creator). When the viewer is the brand, the counterparty is
  // the creator; when the viewer is the creator, the counterparty is
  // the brand. The Inbox picks the right side at render time.
  let creatorId: string | undefined;
  let brandId: string | undefined;
  for (const userId of t.participants) {
    const u = db.users.find((x) => x.id === userId);
    if (!u) continue;
    if (u.creatorId) creatorId = u.creatorId;
    else if (u.brandId) brandId = u.brandId;
  }
  // Final fallback for creatorId: if no user row maps the participant to
  // a creatorId directly, try the creator table (older threads may have
  // user_id pointers that don't match).
  if (!creatorId) {
    for (const userId of t.participants) {
      const c = db.creators.find((cr) => cr.userId === userId);
      if (c) { creatorId = c.id; break; }
    }
  }
  if (!creatorId) return null; // pre-Phase-1c threads with no creator side; skip

  const messages = db.messages
    .filter((m) => m.threadId === t.id)
    .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

  // Map fromUserId → 'brand' | 'creator' position relative to viewer.
  // The label is a UI convention ("from me" vs "from the other side")
  // not a role — 'brand' = viewer-side, 'creator' = counter-side.
  const v2Messages = messages.map((m) => ({
    from: m.fromUserId === viewerUserId ? 'brand' : 'creator',
    text: m.text,
    time: new Date(m.at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }),
    attachments: m.attachments,
  })) as V2Conversation['messages'];

  const last = messages[messages.length - 1];
  return {
    id: t.id,
    creatorId,
    brandId: brandId ?? '',
    campaignId: t.campaignId ?? '',
    unread: t.unreadFor.includes(viewerUserId) ? 1 : 0,
    lastAt: last ? relativeTime(last.at) : 'no messages',
    preview: last?.text ?? '',
    messages: v2Messages,
    isMutedForViewer: (t.mutedFor ?? []).includes(viewerUserId),
    isArchivedForViewer: (t.archivedFor ?? []).includes(viewerUserId),
  };
}

// =====================================================================
// Transactions → wallet ledger entries
// =====================================================================

const TX_KIND_LABEL: Record<Transaction['kind'], string> = {
  topup:           'Wallet top-up',
  escrow_hold:     'Reserved in escrow',
  escrow_release:  'Released from escrow',
  payout:          'Payout to creator',
  refund:          'Refunded',
  fee:             'Platform fee',
  ad_spend:        'Ad spend',
  referral_bonus:  'Referral bonus',
};

const TX_KIND_TO_V2: Record<Transaction['kind'], V2WalletLedgerEntry['type']> = {
  topup:           'topup',
  escrow_hold:     'reserve',
  escrow_release:  'release',
  payout:          'release',
  refund:          'topup',
  fee:             'fee',
  ad_spend:        'fee',
  referral_bonus:  'topup',
};

export function transactionToV2(tx: Transaction, db: Database): V2WalletLedgerEntry {
  let desc = tx.note || TX_KIND_LABEL[tx.kind];
  // Enrich with counterparty when meaningful
  if (tx.counterpartyUserId) {
    const cp = db.users.find((u) => u.id === tx.counterpartyUserId);
    const cpName =
      (cp?.creatorId && db.creators.find((c) => c.id === cp.creatorId)?.name) ||
      (cp?.brandId && db.brands.find((b) => b.id === cp.brandId)?.name) ||
      null;
    if (cpName && !desc.includes(cpName)) desc = `${desc} — ${cpName}`;
  }
  const statusMap: Record<Transaction['status'], string> = {
    cleared: tx.kind === 'escrow_hold' ? 'In escrow' : 'Settled',
    pending: 'Pending',
    failed:  'Failed',
  };
  return {
    date: new Date(tx.at).toLocaleString('en-US', { month: 'short', day: 'numeric' }),
    desc,
    amount: tx.amount,
    type: TX_KIND_TO_V2[tx.kind],
    status: statusMap[tx.status],
  };
}

// =====================================================================
// Wallet roll-ups
// =====================================================================

export function brandWalletV2(brand: Brand, db: Database) {
  const mineAll = db.transactions.filter((t) => t.userId === brand.userId);
  const sorted = mineAll
    .slice()
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .map((t) => transactionToV2(t, db));
  // `ledger` is the DISPLAY slice. `ledgerAll` is every row.
  //
  // Both "Download statement" and "Download tax report" used to export from
  // the 10-row display slice — and reported `${ledger.length} rows` in the
  // success toast, so an account with more history handed its accountant a
  // statement that silently stopped after ten transactions. Anything that
  // exports, totals, or reconciles must read `ledgerAll`.
  const ledgerAll = sorted;
  const ledger = sorted.slice(0, 10);
  // In-flight = pending escrow holds in the last 30 days
  const inFlight = db.transactions
    .filter((t) => t.userId === brand.userId && t.kind === 'escrow_hold' && t.status === 'pending')
    .reduce((s, t) => s + Math.abs(t.amount), 0);
  // This-month totals — summed across the FULL transaction history (not
  // the 10-entry ledger slice above) so the BrandWallet sidebar "This
  // month" panel can show real numbers instead of the hardcoded
  // $23k / $8.4k / $890 / $445 it previously displayed. Cleared-only;
  // pending escrow doesn't count toward spend until release.
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime();
  const inMonth = mineAll.filter((t) => {
    const at = new Date(t.at).getTime();
    return at >= monthStart && at < monthEnd && t.status === 'cleared';
  });
  const thisMonth = {
    topups:      inMonth.filter((t) => t.kind === 'topup').reduce((s, t) => s + Math.abs(t.amount), 0),
    released:    inMonth.filter((t) => t.kind === 'escrow_release' || t.kind === 'payout').reduce((s, t) => s + Math.abs(t.amount), 0),
    fees:        inMonth.filter((t) => t.kind === 'fee').reduce((s, t) => s + Math.abs(t.amount), 0),
    adSpend:     inMonth.filter((t) => t.kind === 'ad_spend').reduce((s, t) => s + Math.abs(t.amount), 0),
  };
  return {
    available: brand.walletBalance,
    reserved: brand.escrowHeld,
    inFlight,
    currency: 'USD' as const,
    ledger,
    ledgerAll,
    thisMonth,
  };
}

/** Invert `splitGross` for a stored net figure.
 *
 *  Only for the wallet's lifetime fallback, where all we have is an
 *  accumulated net. Not exact for a single deal (fee and tax are rounded
 *  independently, so several gross values can map to one net) but correct
 *  in aggregate, which is what a lifetime total is. Anything needing
 *  per-deal precision must read the ledger rows instead. */
function grossFromNet(net: number): number {
  if (net <= 0) return 0;
  return Math.round(net / (1 - PLATFORM_FEE - WHT));
}

export function creatorWalletV2(creator: Creator, db: Database) {
  const myUserId = creator.userId;
  const mineAll = db.transactions.filter((t) => t.userId === myUserId);
  const ledger = mineAll
    .slice()
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, 10)
    // No gross/fee reconstruction. This used to compute
    // `gross = round(|amount| / 0.85)` for every payout-kind row, which was
    // wrong twice over: it caught WITHDRAWALS too (also `kind: 'payout'`,
    // negative), inventing a $88 "fee" on a $500 withdrawal in the same
    // screen whose modal says "No fee on withdrawals"; and even for real
    // payouts it guessed, because fee and tax are rounded independently at
    // release time. The actual fee and withholding are already their own
    // ledger rows — read those instead of inferring them.
    .map((t) => transactionToV2(t, db));
  // Lifetime earnings: compute from the actual ledger (sum of cleared
  // payouts) rather than reading `creator.lifetimeEarnings`. Pre-fix
  // the stored field was a seeded random number divorced from the
  // seeded transactions — wallet hero stat could disagree with the
  // ledger total below it (e.g. lifetime "$47,800" but the ledger sums
  // to $12k). The stored field is still updated on payout for
  // backward compatibility but we trust the ledger as the source of
  // truth on read. Fall back to the stored field when there are
  // genuinely no ledger entries (fresh accounts).
  const ledgerLifetime = mineAll
    .filter((t) => (t.kind === 'payout' || t.kind === 'escrow_release') && t.status === 'cleared' && t.amount > 0)
    .reduce((s, t) => s + t.amount, 0);
  // Both paths must denote the SAME quantity. The ledger sums gross payout
  // rows; `creator.lifetimeEarnings` accumulates net, so the fallback used
  // to return a figure 15% smaller under an identical "Lifetime earned"
  // label — and under a tooltip that calls it gross. Gross it up so the
  // label is true whichever branch runs.
  const lifetime = ledgerLifetime > 0
    ? ledgerLifetime
    : grossFromNet(creator.lifetimeEarnings);
  return {
    available: creator.walletBalance,
    pending: creator.pendingBalance,
    lifetime,
    currency: 'USD' as const,
    ledger,
  };
}

// =====================================================================
// Stage metadata — THE single source of truth for every collab stage
// =====================================================================
//
// Typed as `Record<V2CollabStage, …>` on purpose. That makes adding a stage
// to the union a COMPILE ERROR here until its metadata exists, which is the
// whole point: before this, stage knowledge was scattered across a
// hand-written array, two hardcoded arrays in MyCollabs, and several
// `.find()` lookups that returned undefined for anything unlisted. The
// `cancelled` stage existed in the state machine for a long time without
// existing in the type, and nothing failed — it just fell through five
// surfaces differently. Do not replace this Record with a plain array.
//
// `order` is the left-to-right kanban position. `inPipeline: false` marks a
// terminal stage that is never a board column.
// `activeGroup` partitions the creator-side board (MyCollabs) so that
// partition is derived from here too, rather than re-listed by hand.

export const V2_STAGE_META: Record<V2CollabStage, {
  label: string;
  color: string;
  order: number;
  /** false = terminal; never rendered as a kanban column. */
  inPipeline: boolean;
  /** Creator-side grouping. 'closed' = out of the running, shown but inert. */
  activeGroup: 'pre-acceptance' | 'post-acceptance' | 'closed';
  /** Board phase. Grouping the columns under these stops the left-to-right
   *  board implying `invited → pitched` is a progression: they are parallel
   *  entry paths (brand-initiated vs creator-initiated) that converge at
   *  `negotiating`, and sitting side by side under one "Sourcing" header
   *  reads as siblings rather than sequence. */
  phase: 'sourcing' | 'booking' | 'production' | 'closed';
  /** Shown to whoever is looking at a terminal collab so the outcome is
   *  explicit instead of the record just disappearing. */
  outcomeNote?: string;
}> = {
  invited:     { label: 'Invited',     color: 'var(--v2-ink-3)', order: 1, inPipeline: true,  activeGroup: 'pre-acceptance', phase: 'sourcing' },
  pitched:     { label: 'Pitched',     color: 'var(--v2-info)',  order: 2, inPipeline: true,  activeGroup: 'pre-acceptance', phase: 'sourcing' },
  negotiating: { label: 'Negotiating', color: 'var(--v2-gold)',  order: 3, inPipeline: true,  activeGroup: 'pre-acceptance', phase: 'booking' },
  confirmed:   { label: 'Confirmed',   color: 'var(--v2-accent)', order: 4, inPipeline: true, activeGroup: 'post-acceptance', phase: 'booking' },
  submitted:   { label: 'Submitted',   color: '#8B5CF6',         order: 5, inPipeline: true,  activeGroup: 'post-acceptance', phase: 'production' },
  approved:    { label: 'Approved',    color: 'var(--v2-moss)',  order: 6, inPipeline: true,  activeGroup: 'post-acceptance', phase: 'production' },
  live:        { label: 'Live',        color: 'var(--v2-moss)',  order: 7, inPipeline: true,  activeGroup: 'post-acceptance', phase: 'production' },
  paid:        { label: 'Paid',        color: 'var(--v2-ink)',   order: 8, inPipeline: true,  activeGroup: 'post-acceptance', phase: 'production' },
  cancelled:   {
    label: 'Not proceeding',
    color: 'var(--v2-ink-4)',
    order: 99,
    inPipeline: false,
    activeGroup: 'closed',
    phase: 'closed',
    outcomeNote: 'Every offer and application here was declined or withdrawn, so this collaboration isn\'t going ahead.',
  },
};

/** Kanban columns, DERIVED from the metadata so the board and the stage model
 *  cannot drift apart. Order is the left-to-right column order. */
export const V2_PIPELINE_STAGES: V2PipelineStage[] =
  (Object.keys(V2_STAGE_META) as V2CollabStage[])
    .filter((s) => V2_STAGE_META[s].inPipeline)
    .sort((a, b) => V2_STAGE_META[a].order - V2_STAGE_META[b].order)
    .map((s) => ({ id: s, label: V2_STAGE_META[s].label, color: V2_STAGE_META[s].color }));

/** Board phases in left-to-right order, with the stages under each. Derived
 *  from V2_STAGE_META so a stage can never be missing from the board. */
type BoardPhaseId = 'sourcing' | 'booking' | 'production';

export const V2_BOARD_PHASES: {
  id: BoardPhaseId;
  label: string;
  hint: string;
  stages: V2CollabStage[];
}[] = ([
  {
    id: 'sourcing',
    label: 'Sourcing',
    // Stated explicitly because the column order alone implies a sequence.
    hint: 'Two ways in — you invited them, or they pitched you. Neither leads to the other.',
    stages: [],
  },
  { id: 'booking',    label: 'Booking',    hint: 'Terms on the table, then locked in.', stages: [] },
  { id: 'production', label: 'Production', hint: 'Content in, approved, live, paid.',   stages: [] },
] as { id: BoardPhaseId; label: string; hint: string; stages: V2CollabStage[] }[]).map((p) => ({
  ...p,
  stages: (Object.keys(V2_STAGE_META) as V2CollabStage[])
    .filter((s) => V2_STAGE_META[s].phase === p.id)
    .sort((a, b) => V2_STAGE_META[a].order - V2_STAGE_META[b].order),
}));

/** The furthest IN-PIPELINE stage this pair ever reached.
 *
 *  A conversion funnel can't read the current stage alone: `cancelled` is
 *  terminal and carries no information about how far the pair actually got,
 *  and a collab can be cancelled AFTER being booked (see
 *  `Collaboration.cancellationRequest`, "populated when either party requests
 *  cancellation post-confirmation"). Counting a cancelled collab as never
 *  having booked would understate conversion; counting it by its order-99
 *  stage would overstate everything.
 *
 *  `history` is the audit trail of every transition, so the max in-pipeline
 *  stage across it — plus the current stage — is the honest answer. Falls back
 *  to the current stage when history is empty (seeded rows, pre-migrator data).
 */
export function furthestPipelineStage(
  campaignId: string,
  creatorId: string,
  db: Database,
): V2CollabStage | null {
  // `filter`, not `find`: the store can hold MORE THAN ONE Collaboration row
  // for the same (campaign, creator) pair. Verified in the live seeded world —
  // 3 pairs are duplicated, e.g. Sarah on cmp_1 has a seeded row at
  // 'confirmed' and a migrator-materialized row at 'submitted'. A `.find()`
  // would read whichever happens to be first and could understate how far the
  // pair actually got. Merging every matching row's history is correct whether
  // or not the duplication is ever cleaned up.
  const rows = db.collaborations.filter(
    (c) => c.campaignId === campaignId && c.creatorId === creatorId,
  );
  const derived = deriveCollab(campaignId, creatorId, db);
  const seen: V2CollabStage[] = [];
  if (derived) seen.push(derived.stage);
  for (const row of rows) {
    if ((row.stage as string) in V2_STAGE_META) seen.push(row.stage as V2CollabStage);
    for (const h of row.history ?? []) {
      if (h.to && (h.to as string) in V2_STAGE_META) seen.push(h.to as V2CollabStage);
      if (h.from && (h.from as string) in V2_STAGE_META) seen.push(h.from as V2CollabStage);
    }
  }
  const inPipeline = seen.filter((st) => V2_STAGE_META[st].inPipeline);
  if (inPipeline.length === 0) return null;
  return inPipeline.reduce((best, st) =>
    V2_STAGE_META[st].order > V2_STAGE_META[best].order ? st : best,
  );
}

/** True when the collab is still somewhere in the pipeline. Use this for any
 *  "how many creators" count so badges, totals and column sums agree — a
 *  cancelled collab used to be counted as active while being invisible on the
 *  board, so the Pipeline badge disagreed with the columns beneath it. */
export function isActiveCollab(c: { stage: V2CollabStage }): boolean {
  return V2_STAGE_META[c.stage].inPipeline;
}

// =====================================================================
// Collab derivation — combine Application / Offer / Submission / payout
// state into a single V2Collab keyed by (campaignId, creatorId).
// =====================================================================

function fmtDateShort(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function deliverableFromSubmission(
  s: Submission,
  /** Slot status from `computeSlotStatuses` — the SAME status that
   *  drives the stored Collaboration.stage. P67: pre-fix this fn
   *  recomputed status locally and coerced approved→live whenever any
   *  payout tx existed for the pair. Escrow releases at approve-time
   *  in this model, so that payout signal was ALWAYS present post-
   *  approve — the kanban skipped the Approved column the instant the
   *  brand approved, exactly the bug the stage-rollup comment claimed
   *  was fixed. Live now requires the post-publication signal
   *  (permalink or LIVE: feedback), nothing else. */
  status: V2Deliverable['status'],
  label: string,
  deliverableId: string,
  /** The campaign deadline string ("May 18"). Used as the deliverable's
   *  due date when the row's own `dueOffsetDays` is null (the common
   *  case). Pre-fix this fn used `submittedAt` as `due` which made the
   *  Calendar plot every submitted deliverable on the day it was sent
   *  to review, not on its actual deadline — the whole Calendar
   *  surface ("overdue", "next 7 days") was lying as a result. */
  campaignDeadline: string,
  /** Same date, unformatted — see V2Deliverable.dueAt. */
  campaignDeadlineIso: string,
): V2Deliverable {
  // The latest brand feedback note (for revision display)
  const lastFeedback = s.feedback?.[s.feedback.length - 1]?.text;
  // Pull the live URL from the dedicated field; fall back to scanning the
  // feedback log for the legacy "LIVE: <url>" entries that pre-s18 data
  // still carries. Either way the creator + brand UI surface the same value.
  const permalink = s.permalink
    ?? s.feedback?.find((f) => f.text.startsWith('LIVE: '))?.text.replace(/^LIVE:\s*/, '');
  return {
    id: s.id,
    deliverableId,
    label,
    status,
    due: campaignDeadline,
    dueAt: campaignDeadlineIso,
    submittedAt: fmtDateShort(s.submittedAt),
    thumb: s.files[0]?.url,
    // Strip the `[slot:N]` prefix from notes when displaying — the prefix
    // is stripped at migration time too, but legacy data may still carry it.
    notes: lastFeedback && s.status === 'revisions'
      ? lastFeedback
      : (s.notes?.replace(/^\[slot:\d+\]\s*/, '') ?? undefined),
    permalink,
  };
}

// =====================================================================
// Deliverable adapters (P1d) — render Deliverable rows + match submissions
// =====================================================================
//
// Pre-P1d this section had a free-form parser (`parseDeliverableSlots`)
// that re-expanded `Campaign.deliverables` into N slot rows on every
// render. The string is now stored as `Campaign.deliverablesText` for
// display only; the structured rows live in `db.deliverables` and are
// materialized once by migrator 4 (or by `materializeDeliverablesForCampaign`
// at create-time for net-new campaigns). Helpers below build the V2-side
// labels + match submissions to deliverables for the adapter.

/**
 * P1d §1.5 — display label for a structured Deliverable row.
 *
 * Mirrors what the legacy `parseDeliverableSlots` produced from a
 * free-form "1 Reel + 3 Stories" string: when there's one of a
 * (platform, format) pair on the campaign we say "Reel · Instagram";
 * when there are several we suffix with the position ("Story 2 · Instagram").
 * That keeps card copy stable across the migration.
 */
export function deliverableLabel(d: Deliverable, db: Database): string {
  // E3 — count only the rows that share this one's audience. A creator's
  // amendment slot must not renumber "Story" into "Story 1 / Story 2" on
  // every other creator's card, and a campaign-wide row must not be
  // renumbered by someone else's private addition.
  const sameKind = db.deliverables.filter(
    (x) => x.campaignId === d.campaignId && x.platform === d.platform && x.format === d.format
      && (x.creatorId ?? null) === (d.creatorId ?? null),
  );
  const fmt = d.format.charAt(0).toUpperCase() + d.format.slice(1);
  const plat = d.platform === 'x' ? 'X' : (d.platform.charAt(0).toUpperCase() + d.platform.slice(1));
  if (sameKind.length === 1) return `${fmt} · ${plat}`;
  // Position is 1-based for human display; sort by index so labels are stable.
  const ordered = [...sameKind].sort((a, b) => a.index - b.index);
  const pos = ordered.findIndex((x) => x.id === d.id) + 1;
  return `${fmt} ${pos} · ${plat}`;
}

// (P67 — the old private `deliverableForSubmission` matcher moved into
// collabSync.ts so the stored-stage computation and this projection
// group submissions with the SAME rule. See `computeSlotStatuses`.)

/**
 * Derive a V2Collab from the live store for one creator-on-one-campaign.
 * Returns null if the creator has no relationship (no app, no offer, not
 * shortlisted, not in acceptedCreators, no submission).
 */
export function deriveCollab(campaignId: string, creatorId: string, db: Database): V2Collab | null {
  const camp = db.campaigns.find((c) => c.id === campaignId);
  if (!camp) return null;

  const apps = db.applications.filter((a) => a.campaignId === campaignId && a.creatorId === creatorId);
  const offers = db.offers.filter((o) => o.campaignId === campaignId && o.creatorId === creatorId);
  const subs = db.submissions.filter((s) => s.campaignId === campaignId && s.creatorId === creatorId);
  const accepted = isCreatorAccepted(campaignId, creatorId, db);
  const shortlisted = isCreatorShortlisted(campaignId, creatorId, db);
  // Cold-invite path: brand reached out via InviteCreatorsModal which
  // writes only a Collaboration row (no application, no offer). Pre-fix
  // this row was ignored — `deriveCollab` returned null and the creator
  // was invisible to both kanbans. We accept the Collaboration as a
  // valid signal AND use its stage as the baseline below if no offer or
  // application exists to override.
  const collabRow = db.collaborations.find(
    (c) => c.campaignId === campaignId && c.creatorId === creatorId,
  );

  // No relationship at all. `collabRow` covers the cold-invite case —
  // including it here lets `invited`-stage Collaboration rows with no
  // application/offer/submission survive the early return.
  if (apps.length === 0 && offers.length === 0 && subs.length === 0 && !accepted && !shortlisted && !collabRow) {
    return null;
  }

  // ─── Stage — single source of truth (P67) ──────────────────────
  // `computeCollabStage` is the SAME function `ensureCollabState` uses
  // to persist Collaboration.stage, so this projection and the stored
  // row cannot drift. (Pre-P67 this module re-derived the stage with
  // its own rules and the two disagreed on multi-deliverable mid-states,
  // payout-without-permalink, and pending-payout edge cases.)
  // 'cancelled' flows through via the same typed escape as before —
  // V2CollabStage has no 'cancelled' member; kanban callers filter it.
  let stage = computeCollabStage(campaignId, creatorId, db) as V2CollabStage;

  let appliedAt: string | undefined;
  let pitch: string | undefined;
  let price = 0;

  const latestApp = apps.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime())[0];
  if (latestApp) {
    appliedAt = fmtDateShort(latestApp.submittedAt);
    pitch = latestApp.pitch;
  }

  const latestOffer = offers.sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime())[0];
  if (latestOffer) {
    price = latestOffer.rate;
  } else if (latestApp?.proposedRate) {
    price = latestApp.proposedRate;
  }

  // ─── Multi-deliverable tracking (P1d, slot statuses shared P67) ──
  // Per-slot statuses come from `computeSlotStatuses` — the same
  // grouping + status rules that drive the stored stage above. This
  // module only adds the display dressing (label, thumb, notes,
  // permalink) and the synthetic pending rows for unfilled slots.
  const slots = computeSlotStatuses(campaignId, creatorId, db);
  const deliverables: V2Deliverable[] = [];
  for (const slot of slots) {
    const label = deliverableLabel(slot.deliverable, db);
    if (slot.latestSubmission) {
      deliverables.push(deliverableFromSubmission(
        slot.latestSubmission, slot.status, label, slot.deliverable.id,
        fmtDateShort(camp.deadline), camp.deadline,
      ));
    } else if (accepted || (stage !== 'invited' && (stage as string) !== 'cancelled')) {
      // Synthetic pending row so accepted/engaged collabs show every
      // slot. Skipped for cold invites (nothing committed yet) and
      // cancelled rows (dead deal — no pending work to show).
      deliverables.push({
        id: `synth__${campaignId}__${creatorId}__${slot.deliverable.index}`,
        deliverableId: slot.deliverable.id,
        label,
        status: 'pending',
        due: fmtDateShort(camp.deadline),
        dueAt: camp.deadline,
      });
    }
  }

  // Terminal-state override: trust the stored Collaboration row when its
  // stage is terminal ('paid' or 'cancelled'). The signal-based derivation
  // doesn't always reach 'paid' for seeded demo data (it requires
  // camp.stage === 'closed' AND a live-status submission AND payout) —
  // but a seeded Collaboration row with stage='paid' explicitly represents
  // a closed deal. Without this override, paid demo collabs render as
  // 'approved' or 'live' and the Paid kanban column stays empty in walks.
  // The CollabHistory entries on the row are the canonical audit trail;
  // the per-signal derivation is just a best-effort projection.
  if (collabRow?.stage === 'paid') {
    stage = 'paid';
  } else if (collabRow?.stage === 'cancelled') {
    // No cast needed any more — 'cancelled' is a real member of
    // V2CollabStage. The old `as V2CollabStage` here was the mechanism that
    // let the type and the state machine disagree in the first place.
    stage = 'cancelled';
  }

  // Use a double-underscore separator so the regex parser can split
  // back unambiguously even when campaign or creator ids contain a
  // single underscore (e.g. `cmp_g110`, `c_sarah`).
  return {
    id: `collab__${campaignId}__${creatorId}`,
    campaignId,
    creatorId,
    stage,
    price,
    deadline: fmtDateShort(camp.deadline),
    appliedAt,
    pitch,
    deliverables,
  };
}

/** All collabs for one campaign (every brand-side kanban row). */
export function collabsForCampaign(campaignId: string, db: Database): V2Collab[] {
  const camp = db.campaigns.find((c) => c.id === campaignId);
  if (!camp) return [];
  // Union of every creator that has ANY signal on this campaign — we
  // walk every entity that can ground a kanban row:
  //   - applications (creator pitched into a public brief)
  //   - offers (brand sent terms)
  //   - submissions (creator uploaded content)
  //   - collaborations (cold-invite path — brand reached out before any
  //     of the above existed; Collaboration is the only row that gets
  //     written. Pre-fix this walk omitted it, so cold-invited creators
  //     were INVISIBLE on the brand kanban AND on their own MyCollabs.)
  const ids = new Set<string>();
  db.applications.filter((a) => a.campaignId === campaignId).forEach((a) => ids.add(a.creatorId));
  db.offers.filter((o) => o.campaignId === campaignId).forEach((o) => ids.add(o.creatorId));
  db.submissions.filter((s) => s.campaignId === campaignId).forEach((s) => ids.add(s.creatorId));
  db.collaborations.filter((c) => c.campaignId === campaignId).forEach((c) => ids.add(c.creatorId));
  return Array.from(ids)
    .map((id) => deriveCollab(campaignId, id, db))
    .filter((c): c is V2Collab => c !== null);
  // Cancelled rows are RETURNED, not filtered. They previously were dropped
  // here because there was no column for them — a workaround whose comment
  // claimed "cancelled history is still accessible through the CollabDetail
  // surface". It wasn't: that surface looked stage metadata up with a
  // `.find()` that returned undefined for cancelled and rendered "Campaign
  // data unavailable". So declining a whole column made those creators
  // untraceable everywhere.
  //
  // Callers now split on `isActiveCollab`: the kanban renders the active
  // ones, and CampaignDetail's "Not proceeding" group renders the rest.
}

// `computeMatchScore` was removed in the product audit. It was one of two
// disagreeing scorers (the same creator saw 48% here and 71% in
// BrowseBriefs), it read `audience.age2534` which only seeded creators
// have, and its `geo` facet compared the creator's city against
// `campaign.placement` — the deliverables text, not a location. Fit now
// lives in ./matching.ts as a single implementation.

/** All collabs for one creator (creator-side My collaborations). */
export function collabsForCreator(creatorId: string, db: Database): V2Collab[] {
  const campaignIds = new Set<string>();
  // See `collabsForCampaign` above — `db.collaborations` is the only
  // row written on the cold-invite path; omitting it here made cold-
  // invites invisible on the creator's MyCollabs tracker.
  db.applications.filter((a) => a.creatorId === creatorId).forEach((a) => campaignIds.add(a.campaignId));
  db.offers.filter((o) => o.creatorId === creatorId).forEach((o) => campaignIds.add(o.campaignId));
  db.submissions.filter((s) => s.creatorId === creatorId).forEach((s) => campaignIds.add(s.campaignId));
  db.collaborations.filter((c) => c.creatorId === creatorId).forEach((c) => campaignIds.add(c.campaignId));
  return Array.from(campaignIds)
    .map((id) => deriveCollab(id, creatorId, db))
    .filter((c): c is V2Collab => c !== null);
  // Same as `collabsForCampaign`: cancelled collabs are returned. Hiding them
  // meant a creator whose pitch was declined saw the record disappear from
  // My Collaborations with no way to tell whether the brand passed or the app
  // lost their application. MyCollabs now groups them under "Closed".
}
