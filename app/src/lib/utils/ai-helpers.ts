// AI-flavoured helpers (Phase 17).
//
// Mocked, transparent scoring — no real model in the loop. The whole
// point of these is to *show what AI assist looks like at the right
// moments* in the workflow:
//
//   - When a brand has 20+ applicants, "rank by fit" with reasoning.
//   - When sending an offer, suggest a rate band with rationale.
//   - When a thread has 8+ messages, summarize it as a TL;DR.
//
// Each helper returns a transparent breakdown of factors so the UI can
// show the "why" — no black-box scores.

import { stageLabel } from './labels';
import type {
  Application, Brand, Campaign, Creator, Database, Message, Offer, Thread,
} from '@/lib/api/types';
import { trustForCreator } from './trust';

// ============================================================
// AI Applicant Ranker — score creators against a brand's campaign
// ============================================================

export interface ApplicantScore {
  application: Application;
  creator: Creator;
  score: number;          // 0..100, integer
  reasons: string[];      // 2-4 short strings explaining the rank
  flags?: string[];       // optional concerns ("New on platform", "Low engagement")
}

/**
 * Score every Applied applicant on a campaign, sorted highest-fit first.
 * Mock factors: category overlap, region match, tier alignment, rating,
 * verification, on-time rate, engagement.
 */
export function rankApplicants(
  campaign: Campaign,
  applications: Application[],
  db: Database,
): ApplicantScore[] {
  const out: ApplicantScore[] = [];
  for (const app of applications) {
    if (app.status !== 'submitted') continue;
    const creator = db.creators.find((c) => c.id === app.creatorId);
    if (!creator) continue;
    const score = scoreApplicant(creator, campaign, app, db);
    out.push(score);
  }
  return out.sort((a, b) => b.score - a.score);
}

function scoreApplicant(
  creator: Creator,
  campaign: Campaign,
  app: Application,
  db: Database,
): ApplicantScore {
  const reasons: string[] = [];
  const flags: string[] = [];
  let score = 0;

  // 1) Category fit (40 pts max)
  const catNorm = campaign.category.toLowerCase();
  const matchedCats = creator.categories.filter((c) => c.toLowerCase() === catNorm || c.toLowerCase().includes(catNorm) || catNorm.includes(c.toLowerCase()));
  if (matchedCats.length > 0) {
    score += 40;
    reasons.push(`Matches ${matchedCats[0]} category`);
  } else if (creator.categories.length > 0) {
    score += 8;
    flags.push(`Different category (${creator.categories[0]})`);
  }

  // 2) Region (15 pts)
  if (campaign.region === creator.country || campaign.region === creator.city) {
    score += 15;
    reasons.push(`Based in ${creator.country}`);
  } else if (campaign.region === 'Global') {
    score += 10;
  }

  // 3) Tier alignment vs budget (12 pts max)
  const budget = campaign.budget;
  const tierFit = (() => {
    if (creator.tier === 'Flagship' && budget >= 8000) return 12;
    if (creator.tier === 'Specialist' && budget >= 2500 && budget < 12000) return 12;
    if (creator.tier === 'Rising' && budget < 4000) return 12;
    if (creator.tier === 'Flagship' && budget < 4000) return 4;
    if (creator.tier === 'Rising' && budget >= 8000) return 5;
    return 8;
  })();
  score += tierFit;
  if (tierFit === 12) reasons.push(`${creator.tier} tier matches budget`);

  // 4) Rating (12 pts max)
  if (creator.rating >= 4.6) {
    score += 12;
    reasons.push(`★ ${creator.rating.toFixed(1)} rating`);
  } else if (creator.rating >= 4.2) {
    score += 8;
  } else if (creator.rating > 0 && creator.rating < 3.8) {
    flags.push(`Low rating (${creator.rating.toFixed(1)})`);
  }

  // 5) Verified + trust (8 pts)
  if (creator.verified) {
    score += 6;
    reasons.push('Verified profile');
  }
  const trust = trustForCreator(db, creator);
  if (trust.tier === 'gold') score += 2;

  // 6) Engagement (8 pts max — quality over reach)
  if (creator.engagement >= 5) {
    score += 8;
    reasons.push(`${creator.engagement}% engagement`);
  } else if (creator.engagement >= 3) {
    score += 4;
  } else if (creator.engagement > 0 && creator.engagement < 1.5) {
    flags.push(`Low engagement (${creator.engagement}%)`);
  }

  // 7) Response time (5 pts)
  if (creator.responseHrs <= 4) {
    score += 5;
    reasons.push(`Replies in ${creator.responseHrs}h`);
  } else if (creator.responseHrs > 24) {
    flags.push(`Slow reply (${creator.responseHrs}h)`);
  }

  // 8) Availability check
  if (creator.availability?.status === 'booked') {
    score -= 10;
    flags.push('Currently booked');
  }

  // 9) Application proposed-rate sanity vs budget
  if (app.proposedRate && app.proposedRate > budget * 0.9) {
    flags.push(`Proposed ${formatMoney(app.proposedRate)} of ${formatMoney(budget)} budget`);
    score -= 5;
  } else if (app.proposedRate && app.proposedRate < budget * 0.15) {
    reasons.push('Sub-market proposed rate');
    score += 3;
  }

  // Clamp, dedupe
  return {
    application: app,
    creator,
    score: Math.max(0, Math.min(100, Math.round(score))),
    reasons: reasons.slice(0, 4),
    flags: flags.length > 0 ? flags.slice(0, 3) : undefined,
  };
}

// ============================================================
// AI Pricing Suggestion — recommend a rate for an offer
// ============================================================

export interface PricingSuggestion {
  /** Mid-point recommended rate. */
  recommended: number;
  /** Lower bound (creator might say no below this). */
  lower: number;
  /** Upper bound (you'd be overpaying above this). */
  upper: number;
  /** 2-3 short rationale lines. */
  reasons: string[];
  /** Confidence flag — 'high' when we have past data, 'low' for rough heuristic. */
  confidence: 'low' | 'medium' | 'high';
}

/**
 * Suggest a rate for an offer to a creator on a specific campaign.
 * Pulls signal from:
 *   - Creator's tier (anchor band)
 *   - Reach (scaled adjustment)
 *   - Past accepted-offer rates from this brand to similar-tier creators
 *   - Campaign budget headroom
 */
export function suggestRate(
  creator: Creator,
  campaign: Campaign,
  brand: Brand,
  db: Database,
): PricingSuggestion {
  const reasons: string[] = [];
  let confidence: PricingSuggestion['confidence'] = 'low';

  // Tier anchor band — rough industry heuristics
  const tierBand = (() => {
    if (creator.tier === 'Rising')     return { mid: 1200, span: 800 };
    if (creator.tier === 'Specialist') return { mid: 3500, span: 2000 };
    return { mid: 8000, span: 4500 }; // Flagship
  })();
  reasons.push(`${creator.tier} tier baseline`);

  // Reach scaling — every 100k reach above 50k adds 8% to mid; below 50k subtracts
  const reachFactor = Math.max(0.6, Math.min(1.6, 1 + (creator.reach - 50_000) / 1_000_000));
  let mid = tierBand.mid * reachFactor;
  if (creator.reach >= 200_000) reasons.push(`${formatCount(creator.reach)} reach`);

  // Past accepted-offer rates for this brand × similar-tier creators (HIGH confidence signal)
  const pastOffers = db.offers
    .filter((o) => o.status === 'accepted')
    .filter((o) => {
      const c = db.creators.find((cr) => cr.id === o.creatorId);
      const cmp = db.campaigns.find((cc) => cc.id === o.campaignId);
      return c && cmp && cmp.brandId === brand.id && c.tier === creator.tier;
    });
  if (pastOffers.length >= 2) {
    const avg = pastOffers.reduce((s, o) => s + o.rate, 0) / pastOffers.length;
    // Blend: 60% past-data, 40% tier baseline
    mid = avg * 0.6 + mid * 0.4;
    reasons.push(`Avg of ${pastOffers.length} past ${creator.tier} accepts`);
    confidence = 'high';
  } else if (pastOffers.length === 1) {
    confidence = 'medium';
  }

  // Budget cap — never recommend above 60% of remaining budget
  const remaining = campaign.budget - campaign.spent - campaign.escrowHeld;
  const cap = Math.max(remaining * 0.6, tierBand.mid * 0.6);
  if (mid > cap) {
    mid = cap;
    reasons.push('Capped by remaining budget');
  }

  // Round to nearest $50 for clean numbers
  const round = (n: number) => Math.max(100, Math.round(n / 50) * 50);
  const recommended = round(mid);
  const lower = round(mid - tierBand.span * 0.35);
  const upper = round(mid + tierBand.span * 0.35);

  return {
    recommended,
    lower,
    upper,
    reasons: reasons.slice(0, 3),
    confidence,
  };
}

// ============================================================
// AI Inbox TL;DR — summarize a long thread
// ============================================================

export interface ThreadSummary {
  /** 1-2 sentence summary of the conversation state. */
  summary: string;
  /** Key entities surfaced from the thread (campaign, amounts, dates). */
  highlights: { label: string; value: string }[];
  /** Recommended next action for the viewer. */
  nextAction?: string;
}

/**
 * Build a TL;DR of a thread. Mock NLP — pattern-matches for amounts,
 * stages, decisions, and the campaign state.
 */
export function summarizeThread(
  thread: Thread,
  messages: Message[],
  db: Database,
  forUserId: string,
): ThreadSummary {
  const cmp = thread.campaignId ? db.campaigns.find((c) => c.id === thread.campaignId) : null;
  const otherUserId = thread.participants.find((p) => p !== forUserId);
  const otherUser = otherUserId ? db.users.find((u) => u.id === otherUserId) : null;
  const otherName = otherUser?.creatorId
    ? db.creators.find((c) => c.id === otherUser.creatorId)?.name
    : otherUser?.brandId
      ? db.brands.find((b) => b.id === otherUser.brandId)?.name
      : otherUser?.email;

  // Collect signals from messages
  const allText = messages.map((m) => m.text).join(' ');
  const moneyMatches = [...allText.matchAll(/\$([0-9,]+(?:\.[0-9]+)?)/g)].map((m) => m[1]);
  const lastMsg = messages[messages.length - 1];
  const lastFromMe = lastMsg && lastMsg.fromUserId === forUserId;

  const highlights: ThreadSummary['highlights'] = [];
  if (cmp) {
    highlights.push({ label: 'Campaign', value: cmp.title });
    highlights.push({ label: 'Stage', value: stageLabel(cmp.stage) });
  }
  if (moneyMatches.length > 0) {
    highlights.push({ label: 'Amounts', value: '$' + moneyMatches.slice(0, 2).join(', $') });
  }
  if (lastMsg) {
    highlights.push({ label: 'Last reply', value: lastFromMe ? 'You' : (otherName || 'Them') });
  }
  highlights.push({ label: 'Messages', value: String(messages.length) });

  // Heuristic summary
  // P1b §1.2: campaign stage is now a 4-value lifecycle. Per-collab
  // progress (production / offer / shortlist / posted / reporting) lives
  // on Collaboration (P1c). Until P1c lands, the summary uses the
  // 4-value stage + flags pulled from offers/submissions for richness.
  const summary = (() => {
    if (!cmp) return `Conversation with ${otherName || 'someone'}. ${messages.length} messages exchanged.`;
    const parts = [`${otherName || 'They'} on "${cmp.title}"`];
    if (cmp.stage === 'closed') parts.push('— campaign closed.');
    else if (cmp.stage === 'paused') parts.push('— campaign paused.');
    else if (cmp.stage === 'live') parts.push('— campaign live.');
    else parts.push('— in draft.');
    if (lastFromMe) parts.push(' Awaiting their reply.');
    else parts.push(' Awaiting your reply.');
    return parts.join('');
  })();

  // Next-action heuristic
  const nextAction = (() => {
    if (!lastMsg) return undefined;
    if (lastFromMe) return undefined;  // ball is in their court
    const lastText = lastMsg.text.toLowerCase();
    if (lastText.includes('?')) return 'Answer their question';
    if (lastText.includes('thank') || lastText.includes('appreciate')) return undefined;  // polite, no specific action
    if (lastText.includes('approve') || lastText.includes('shortlist')) return 'Open the campaign to act';
    if (lastText.includes('counter') || lastText.includes('rate')) return 'Decide on the rate';
    return 'Reply to keep the deal moving';
  })();

  return { summary, highlights, nextAction };
}

// ============================================================
// Helpers
// ============================================================

function formatMoney(n: number): string {
  if (n >= 1000) return `$${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return `$${n}`;
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`;
  return String(n);
}

// Lint-bait re-exports
export type { Creator, Campaign, Brand, Application, Offer, Thread, Message };
