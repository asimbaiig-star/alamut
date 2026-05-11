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
import type {
  V2Creator, V2Campaign, V2Conversation, V2Channel, V2Audience,
  V2WalletLedgerEntry, V2Collab, V2CollabStage, V2Deliverable, V2PipelineStage,
} from './data';

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

function aggregateAudience(platforms: Platform[]): V2Audience {
  const withAudience = platforms.filter((p) => p.audience);
  if (withAudience.length === 0) {
    // Reasonable defaults when no demo data
    return { female: 60, male: 40, age2534: 40, age1824: 25, topCity: 'Lahore' };
  }
  const avg = (key: (a: NonNullable<Platform['audience']>) => number) =>
    Math.round(withAudience.reduce((s, p) => s + key(p.audience!), 0) / withAudience.length);
  // genderSplit values are 0..1, so we multiply
  const female = Math.round(avg((a) => a.genderSplit.female) * 100);
  const male   = Math.round(avg((a) => a.genderSplit.male)   * 100);
  const age2534 = Math.round(avg((a) => a.ageBuckets['25-34']) * 100);
  const age1824 = Math.round(avg((a) => a.ageBuckets['18-24']) * 100);
  // top country pick
  const top = withAudience[0].audience!.topCountries[0];
  return {
    female,
    male,
    age2534,
    age1824,
    topCity: top?.country ?? 'Lahore',
  };
}

export function creatorToV2(c: Creator): V2Creator {
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
    score: Math.round((c.rating ?? 4.5) * 20),
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
  // Live placements = approved submissions for this campaign
  const liveCount = db.submissions.filter(
    (s) => s.campaignId === c.id && s.status === 'approved',
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
    brandLogoUrl: brand?.logoUrl,
    escrowHeld: c.escrowHeld,
  };
}

// =====================================================================
// Thread + Messages → V2Conversation
// =====================================================================

function relativeTime(iso: string): string {
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
  // Resolve creator/brand from participants
  const otherUserId = t.participants.find((p) => p !== viewerUserId);
  if (!otherUserId) return null;
  const otherUser = db.users.find((u) => u.id === otherUserId);
  const creatorId = otherUser?.creatorId ?? db.creators.find((c) => c.userId === otherUserId)?.id;
  if (!creatorId) return null;

  const messages = db.messages
    .filter((m) => m.threadId === t.id)
    .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

  // Map fromUserId → 'brand' | 'creator' (relative to viewer)
  const v2Messages = messages.map((m) => ({
    from: m.fromUserId === viewerUserId ? 'brand' : 'creator',
    text: m.text,
    time: new Date(m.at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }),
  })) as V2Conversation['messages'];

  const last = messages[messages.length - 1];
  return {
    id: t.id,
    creatorId,
    campaignId: t.campaignId ?? '',
    unread: t.unreadFor.includes(viewerUserId) ? 1 : 0,
    lastAt: last ? relativeTime(last.at) : 'no messages',
    preview: last?.text ?? '',
    messages: v2Messages,
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
  const ledger = db.transactions
    .filter((t) => t.userId === brand.userId)
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, 10)
    .map((t) => transactionToV2(t, db));
  // In-flight = pending escrow holds in the last 30 days
  const inFlight = db.transactions
    .filter((t) => t.userId === brand.userId && t.kind === 'escrow_hold' && t.status === 'pending')
    .reduce((s, t) => s + Math.abs(t.amount), 0);
  return {
    available: brand.walletBalance,
    reserved: brand.escrowHeld,
    inFlight,
    currency: 'USD' as const,
    ledger,
  };
}

export function creatorWalletV2(creator: Creator, db: Database) {
  const myUserId = creator.userId;
  const ledger = db.transactions
    .filter((t) => t.userId === myUserId)
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, 10)
    .map((t) => {
      const entry = transactionToV2(t, db);
      // Add gross/fee breakdown for payouts
      if (t.kind === 'escrow_release' || t.kind === 'payout') {
        const gross = Math.abs(t.amount) > 0 ? Math.round(Math.abs(t.amount) / 0.85) : 0;
        const fee = -(gross - Math.abs(t.amount));
        return { ...entry, gross, fee };
      }
      return entry;
    });
  return {
    available: creator.walletBalance,
    pending: creator.pendingBalance,
    lifetime: creator.lifetimeEarnings,
    currency: 'USD' as const,
    ledger,
  };
}

// =====================================================================
// Pipeline stages (single source of truth for the 8-stage Kanban board)
// =====================================================================
//
// Each stage carries a human label and a color token for the column
// header dot. Order is significant — its the left-to-right kanban order.

export const V2_PIPELINE_STAGES: V2PipelineStage[] = [
  { id: 'invited',     label: 'Invited',     color: 'var(--v2-ink-3)' },
  { id: 'pitched',     label: 'Pitched',     color: 'var(--v2-info)' },
  { id: 'negotiating', label: 'Negotiating', color: 'var(--v2-gold)' },
  { id: 'confirmed',   label: 'Confirmed',   color: 'var(--v2-accent)' },
  { id: 'submitted',   label: 'Submitted',   color: '#8B5CF6' },
  { id: 'approved',    label: 'Approved',    color: 'var(--v2-moss)' },
  { id: 'live',        label: 'Live',        color: 'var(--v2-moss)' },
  { id: 'paid',        label: 'Paid',        color: 'var(--v2-ink)' },
];

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
  hasPayout: boolean,
  label: string,
  deliverableId: string,
): V2Deliverable {
  // Map submission status → deliverable status. If we already see a payout
  // for this submission's campaign × creator, treat it as `live` (it's
  // out in the world and the creator was paid).
  const baseStatus: V2Deliverable['status'] =
    s.status === 'in_review' ? 'in_review' :
    s.status === 'revisions' ? 'revision' :
    s.status === 'approved' && hasPayout ? 'live' :
    s.status === 'approved' ? 'approved' : 'pending';
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
    status: baseStatus,
    due: fmtDateShort(s.submittedAt),
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
  const sameKind = db.deliverables.filter(
    (x) => x.campaignId === d.campaignId && x.platform === d.platform && x.format === d.format,
  );
  const fmt = d.format.charAt(0).toUpperCase() + d.format.slice(1);
  const plat = d.platform === 'x' ? 'X' : (d.platform.charAt(0).toUpperCase() + d.platform.slice(1));
  if (sameKind.length === 1) return `${fmt} · ${plat}`;
  // Position is 1-based for human display; sort by index so labels are stable.
  const ordered = [...sameKind].sort((a, b) => a.index - b.index);
  const pos = ordered.findIndex((x) => x.id === d.id) + 1;
  return `${fmt} ${pos} · ${plat}`;
}

/**
 * Look up the Deliverable a submission belongs to. Post-P1d this is a
 * direct FK read; the `[slot:N]` notes-prefix fallback handles any rows
 * that snuck in mid-migration without `deliverableId` set.
 */
function deliverableForSubmission(
  s: Submission,
  db: Database,
): Deliverable | undefined {
  if (s.deliverableId) {
    const direct = db.deliverables.find((d) => d.id === s.deliverableId);
    if (direct) return direct;
  }
  // Transition fallback — should be unreachable post-migrator-4.
  const m = s.notes?.match(/^\[slot:(\d+)\]/);
  const slotIdx = m ? parseInt(m[1], 10) : 0;
  return db.deliverables.find(
    (d) => d.campaignId === s.campaignId && d.index === slotIdx,
  );
}

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

  // Find any payout transaction for this creator that references this campaign
  const creatorRecord = db.creators.find((c) => c.id === creatorId);
  const hasPayout = creatorRecord
    ? db.transactions.some(
        (t) =>
          (t.kind === 'escrow_release' || t.kind === 'payout') &&
          t.campaignId === campaignId &&
          (t.userId === creatorRecord.userId || t.counterpartyUserId === creatorRecord.userId),
      )
    : false;

  // No relationship at all
  if (apps.length === 0 && offers.length === 0 && subs.length === 0 && !accepted && !shortlisted) {
    return null;
  }

  // Stage derivation — most-progressed signal wins
  let stage: V2CollabStage = 'invited';
  let appliedAt: string | undefined;
  let pitch: string | undefined;
  let price = 0;

  // Pitched/negotiating signal
  const latestApp = apps.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime())[0];
  if (latestApp) {
    appliedAt = fmtDateShort(latestApp.submittedAt);
    pitch = latestApp.pitch;
    if (latestApp.status === 'submitted' || latestApp.status === 'shortlisted') stage = 'pitched';
  }

  const latestOffer = offers.sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime())[0];
  if (latestOffer) {
    price = latestOffer.rate;
    if (latestOffer.status === 'pending' || latestOffer.status === 'countered') stage = 'negotiating';
    if (latestOffer.status === 'accepted') stage = 'confirmed';
  } else if (latestApp?.proposedRate) {
    price = latestApp.proposedRate;
  }

  if (accepted && stage === 'invited') stage = 'confirmed';

  // ─── Multi-deliverable tracking (P1d) ──────────────────────────
  // Iterate the campaign's structured Deliverable rows. For each one,
  // group the (campaignId, creatorId) submissions by `deliverableId`
  // and pick the latest. Pre-P1d this iterated parsed slots from the
  // free-form `deliverables` string + matched submissions via the
  // `[slot:N]` notes prefix; both are now stored fields.
  const campDeliverables = db.deliverables
    .filter((d) => d.campaignId === campaignId)
    .sort((a, b) => a.index - b.index);
  const deliverables: V2Deliverable[] = [];

  // Group submissions by deliverableId — fall back to the legacy
  // [slot:N] match for any row that hasn't been migrated yet.
  const subsByDel = new Map<string, Submission[]>();
  for (const s of subs) {
    const matching = deliverableForSubmission(s, db);
    if (!matching) continue;
    const list = subsByDel.get(matching.id) ?? [];
    list.push(s);
    subsByDel.set(matching.id, list);
  }

  for (const del of campDeliverables) {
    const label = deliverableLabel(del, db);
    const delSubs = (subsByDel.get(del.id) ?? [])
      .sort((a, b) => b.round - a.round);
    const latest = delSubs[0];
    if (latest) {
      deliverables.push(deliverableFromSubmission(latest, hasPayout, label, del.id));
    } else if (accepted || stage !== 'invited') {
      deliverables.push({
        id: `synth__${campaignId}__${creatorId}__${del.index}`,
        deliverableId: del.id,
        label,
        status: 'pending',
        due: fmtDateShort(camp.deadline),
      });
    }
  }

  // ─── Stage rollup ──────────────────────────────────────────────
  // Roll up per-slot statuses into a single collab stage. Order matters:
  // any in_review/revision wins over approved (something for brand to do).
  //
  // BUG FIX: pre-fix the rollup auto-flipped to 'live' as soon as
  // `hasPayout` (the escrow release on approve) — which made the
  // kanban skip past 'approved' the instant the brand approved.
  // Correct flow:
  //
  //   submitted → approved (brand approved, payout cleared, content
  //                          NOT yet on platform)
  //             → live      (creator marked live with permalink — only
  //                          set by `v2MarkContentLive`, which flips
  //                          submission.status to 'live')
  //             → paid      (terminal, set when campaign is closed)
  //
  // The `hasPayout` signal is now ignored by the live-vs-approved
  // decision; payout timing is independent of post-publication.
  const slotStatuses = deliverables.map((d) => d.status);
  const allFilled = slotStatuses.length === campDeliverables.length && slotStatuses.length > 0;
  const anyInReviewOrRevision = slotStatuses.some((s) => s === 'in_review' || s === 'revision');
  const allApproved = allFilled && slotStatuses.every((s) => s === 'approved' || s === 'live');
  const allLive = allFilled && slotStatuses.every((s) => s === 'live');

  if (anyInReviewOrRevision) stage = 'submitted';
  else if (allLive) stage = 'live';
  else if (allApproved) stage = 'approved';

  // Paid — terminal — when a payout went out and the campaign is closed
  if (hasPayout && camp.stage === 'closed') stage = 'paid';

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
  // Union of every creator that has any signal on this campaign. The
  // acceptedCreators/shortlist sets are derived from offers + applications
  // so listing them explicitly would be double-work — the application + offer
  // walks below already cover both stages.
  const ids = new Set<string>();
  db.applications.filter((a) => a.campaignId === campaignId).forEach((a) => ids.add(a.creatorId));
  db.offers.filter((o) => o.campaignId === campaignId).forEach((o) => ids.add(o.creatorId));
  db.submissions.filter((s) => s.campaignId === campaignId).forEach((s) => ids.add(s.creatorId));
  return Array.from(ids)
    .map((id) => deriveCollab(campaignId, id, db))
    .filter((c): c is V2Collab => c !== null);
}

/** All collabs for one creator (creator-side My collaborations). */
export function collabsForCreator(creatorId: string, db: Database): V2Collab[] {
  const campaignIds = new Set<string>();
  // applications + offers + submissions cover every accepted-or-shortlisted
  // creator on every campaign — no need to also walk the duplicate fields.
  db.applications.filter((a) => a.creatorId === creatorId).forEach((a) => campaignIds.add(a.campaignId));
  db.offers.filter((o) => o.creatorId === creatorId).forEach((o) => campaignIds.add(o.campaignId));
  db.submissions.filter((s) => s.creatorId === creatorId).forEach((s) => campaignIds.add(s.campaignId));
  return Array.from(campaignIds)
    .map((id) => deriveCollab(id, creatorId, db))
    .filter((c): c is V2Collab => c !== null);
}
