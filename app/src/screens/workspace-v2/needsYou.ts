// needsYou.ts — what is waiting on the signed-in person, in one list per
// persona.
//
// The home's pile, the sidebar badges and the phone's tab badges all read
// from here, so they can't disagree about how much is waiting. Before this
// lived inside each home, and the sidebar's counts were literals.
//
// Every item is something the viewer has to DO. Events (an offer accepted,
// a payout cleared) belong in recent activity, not here.

import { perCreatorTarget } from './campaignTarget';
import { useMemo } from 'react';
import { useStore } from '@/lib/api/store';
import {
  useV2AllCampaigns, useV2BrandWallet, useV2Campaigns, useV2Creators,
  useV2CurrentCreator, useV2MyCollabs,
} from './v2Hooks';
import { collabsForCampaign, deliverableLabel, isActiveCollab } from './v2Adapters';
import { deliverableIdForSubmission, slotReleaseGross } from '@/lib/api/collabSync';
import type { Database, Submission } from '@/lib/api/types';
import { buildSteps as buildKycSteps } from './screens/KycTax';

// ---------------------------------------------------------------------
// Creator
// ---------------------------------------------------------------------

export type CreatorNeedKind = 'offer' | 'revision' | 'live' | 'upload' | 'kyc' | 'storefront';

export interface CreatorNeed {
  id: string;
  kind: CreatorNeedKind;
  /** One line, as the band and the top sheet's heading read it. */
  title: string;
  /** The supporting line under it. */
  sub: string;
  /** Where "open" goes: the deal, with the right modal, or the page. */
  route: string;
  /** The brand whose letterhead the item wears (deal items only). */
  brand?: string;
  campaignName?: string;
  collabId?: string;
  /** offer: the offer to accept in place, and its terms. */
  offerId?: string;
  rate?: number;
  /** offer: what the creator asked for, when they pitched. */
  asked?: number;
  /** How many deliverables the rate covers (sets the net split). */
  slots?: number;
  deliverable?: string;
  due?: string;
  note?: string;
}

/** Most urgent first: money on the table, then work the brand is waiting
 *  on, then what releases money, then set-up. */
const CREATOR_ORDER: Record<CreatorNeedKind, number> = {
  offer: 0, revision: 1, live: 2, upload: 3, kyc: 4, storefront: 5,
};

export function useCreatorNeedsYou(): CreatorNeed[] {
  const creator = useV2CurrentCreator();
  const allCampaigns = useV2AllCampaigns();
  const allMyCollabs = useV2MyCollabs();
  const db = useStore((s) => s.db);

  return useMemo(() => {
    // Active collabs only: a deal cancelled after confirmation must not ask
    // for a resubmission or a post.
    const myCollabs = allMyCollabs.filter(isActiveCollab);
    const items: CreatorNeed[] = [];
    const campaignOf = (id: string) => allCampaigns.find((x) => x.id === id);

    for (const c of myCollabs) {
      const camp = campaignOf(c.campaignId);

      // Offers and invitations waiting for the creator's answer. Same rule
      // CollabDetail uses: a pending offer, or a counter whose latest round
      // is the brand's.
      if (c.stage === 'invited' || c.stage === 'negotiating') {
        if (!camp) continue;
        const offer = db.offers
          .filter((o) => o.campaignId === c.campaignId && o.creatorId === c.creatorId)
          .filter((o) => o.status === 'pending'
            || (o.status === 'countered' && o.rounds[o.rounds.length - 1]?.by === 'brand'))
          .sort((a, b) => +new Date(b.sentAt) - +new Date(a.sentAt))[0];
        const app = db.applications
          .filter((a) => a.campaignId === c.campaignId && a.creatorId === c.creatorId)
          .sort((a, b) => +new Date(b.submittedAt) - +new Date(a.submittedAt))[0];
        // Negotiating with no offer on the creator's side of the table means
        // the creator countered and the brand owes the next move.
        if (c.stage === 'negotiating' && !offer) continue;
        const countered = offer?.status === 'countered';
        items.push({
          id: `offer_${c.id}`,
          kind: 'offer',
          title: offer
            ? countered ? `${camp.brand} countered back` : `${camp.brand} sent an offer`
            : `${camp.brand} invited you`,
          sub: offer ? `${camp.name} · reply to keep it open` : `${camp.name} · pitch your rate`,
          route: `collab:${c.id}`,
          brand: camp.brand,
          campaignName: camp.name,
          collabId: c.id,
          offerId: offer?.id,
          rate: offer?.rate ?? (c.price || undefined),
          asked: app?.proposedRate,
          slots: Math.max(1, c.deliverables.length),
          deliverable: camp.placement,
        });
        continue;
      }

      const rev = c.deliverables.find((d) => d.status === 'revision');
      if (rev) {
        // The brand's request, not the last word in the thread: the
        // feedback log holds both sides, and the creator's own "on it"
        // reply is often the latest entry.
        const sub = db.submissions.find((s) => s.id === rev.id);
        const asked = sub?.feedback
          ?.filter((f) => f.from !== creator?.userId && !f.text.startsWith('LIVE: '))
          .at(-1)?.text;
        items.push({
          id: `rev_${c.id}`,
          kind: 'revision',
          title: `Resubmit your ${rev.label}`,
          sub: `${camp?.brand ?? 'The brand'} asked for changes · due ${rev.due}`,
          route: `collab:${c.id}?action=upload`,
          brand: camp?.brand,
          campaignName: camp?.name,
          collabId: c.id,
          deliverable: rev.label,
          due: rev.due,
          note: asked,
          rate: c.price,
          slots: Math.max(1, c.deliverables.length),
        });
        continue;
      }

      // Approved, not yet posted: the creator posts it and pastes the link,
      // which hands the next step (confirm live, release) to the brand.
      const awaitingPost = db.submissions.some((s) =>
        s.campaignId === c.campaignId && s.creatorId === c.creatorId
        && s.status === 'approved' && !s.permalink);
      if (awaitingPost && camp) {
        items.push({
          id: `live_${c.id}`,
          kind: 'live',
          title: `Post it and mark it live for ${camp.brand}`,
          sub: `${camp.name} · approved, paste the live link to get paid`,
          route: `collab:${c.id}?action=mark-live`,
          brand: camp.brand,
          campaignName: camp.name,
          collabId: c.id,
          rate: c.price,
          slots: Math.max(1, c.deliverables.length),
        });
        continue;
      }

      // Escrow is reserved at `confirmed`, so uploads start there and no
      // earlier (a pitch is not a deal).
      if (c.stage === 'confirmed') {
        const pending = c.deliverables.find((d) => d.status === 'pending');
        if (pending) {
          items.push({
            id: `up_${c.id}`,
            kind: 'upload',
            title: `Submit your ${pending.label}`,
            sub: `${camp?.brand ?? 'Brand'} · due ${pending.due}`,
            route: `collab:${c.id}?action=upload`,
            brand: camp?.brand,
            campaignName: camp?.name,
            collabId: c.id,
            deliverable: pending.label,
            due: pending.due,
            rate: c.price,
            slots: Math.max(1, c.deliverables.length),
          });
        }
      }
    }

    // KYC, only while a step is actually open (the same step builder KycTax
    // renders, so the count matches that page).
    if (creator) {
      const hasPaid = allMyCollabs.some((c) => c.stage === 'paid');
      const open = buildKycSteps(creator, hasPaid)
        .filter((s) => s.status === 'action' || s.status === 'pending').length;
      if (open > 0) {
        items.push({
          id: 'kyc',
          kind: 'kyc',
          title: open === 1 ? 'One verification step left' : `${open} verification steps left`,
          sub: 'Needed before your first withdrawal · about 2 minutes',
          route: 'kyc?action=next-step',
        });
      }

      // A storefront brands can't judge and briefs can't match.
      const gaps: string[] = [];
      if ((creator.platforms ?? []).length === 0) gaps.push('a channel');
      if (!creator.bio?.trim()) gaps.push('a bio');
      if ((creator.categories ?? []).length === 0) gaps.push('a category');
      if (gaps.length > 0) {
        const list = gaps.length === 1
          ? gaps[0]
          : `${gaps.slice(0, -1).join(', ')} and ${gaps[gaps.length - 1]}`;
        items.push({
          id: 'storefront-gaps',
          kind: 'storefront',
          title: `Add ${list} to your storefront`,
          sub: 'Brands see this first, and briefs can’t be matched to you without it',
          route: 'storefront',
        });
      }
    }

    return items
      .map((it, i) => ({ it, i }))
      .sort((a, b) => CREATOR_ORDER[a.it.kind] - CREATOR_ORDER[b.it.kind] || a.i - b.i)
      .map(({ it }) => it);
  }, [allMyCollabs, allCampaigns, creator, db]);
}

// ---------------------------------------------------------------------
// Brand
// ---------------------------------------------------------------------

export type BrandNeedKind = 'verify' | 'counter' | 'review' | 'pitch' | 'topup';

export interface BrandNeed {
  id: string;
  kind: BrandNeedKind;
  title: string;
  sub: string;
  route: string;
  campaignId?: string;
  campaignName?: string;
  creatorId?: string;
  creatorName?: string;
  /** pitch: the application to accept or pass in place. */
  applicationId?: string;
  pitch?: string;
  rate?: number;
  /** pitch: the campaign's per-creator target. */
  target?: number;
  at?: string;
  /** verify: what confirming releases to the creator. */
  releases?: number;
}

/**
 * Posts a creator says are live that the brand hasn't confirmed: one per
 * post, latest round only (the rule computeSlotStatuses uses), each named
 * ("Reel", "Story 2") so two from one creator can be told apart. Every
 * approved submission used to count, and every row read "Confirm Sarah
 * Johnson's post is live". `releases` is what confirming moves out of
 * escrow, from slotReleaseGross, the sum the release itself uses.
 */
export interface PostToConfirm { sub: Submission; what: string; releases: number | null }

export function postsToConfirm(db: Database, campIds: Set<string>): PostToConfirm[] {
  const latest = new Map<string, Submission>();
  for (const s of db.submissions) {
    if (!campIds.has(s.campaignId)) continue;
    const key = `${s.campaignId}|${s.creatorId}|${deliverableIdForSubmission(s, db) ?? s.id}`;
    const seen = latest.get(key);
    if (!seen || s.round > seen.round) latest.set(key, s);
  }
  const out: PostToConfirm[] = [];
  for (const s of latest.values()) {
    if (s.status !== 'approved' || !s.permalink) continue;
    if (s.feedback?.some((f) => f.text?.startsWith('LIVE: '))) continue;
    const delId = deliverableIdForSubmission(s, db);
    const del = delId ? db.deliverables.find((d) => d.id === delId) : undefined;
    out.push({ sub: s, what: del ? deliverableLabel(del, db).split(' · ')[0] : 'post', releases: slotReleaseGross(s, db) });
  }
  return out;
}

export function useBrandNeedsYou(): BrandNeed[] {
  const campaigns = useV2Campaigns();
  const creators = useV2Creators();
  const wallet = useV2BrandWallet();
  const db = useStore((s) => s.db);

  return useMemo(() => {
    const items: BrandNeed[] = [];
    const campIds = new Set(campaigns.map((c) => c.id));
    const nameOf = (id: string) => creators.find((cr) => cr.id === id)?.name;
    const campOf = (id: string) => campaigns.find((c) => c.id === id);

    // 1. Posts the creator says are live: open the link, confirm, release.
    //    The creator is waiting on payment.
    for (const { sub: s, what, releases } of postsToConfirm(db, campIds)) {
      const camp = campOf(s.campaignId);
      const who = nameOf(s.creatorId);
      if (!camp || !who) continue;
      items.push({
        id: `verify_${s.id}`,
        kind: 'verify',
        title: `Confirm ${who}’s ${what} is live`,
        sub: `${camp.name} · open the link, then confirm to release payment`,
        route: `campaign:${camp.id}?action=verify-live&sub=${s.id}`,
        campaignId: camp.id,
        campaignName: camp.name,
        creatorId: s.creatorId,
        creatorName: who,
        releases: releases ?? undefined,
      });
    }

    // 2. Creators who countered: they're waiting on the brand.
    for (const o of db.offers) {
      if (!campIds.has(o.campaignId) || o.status !== 'countered') continue;
      if (o.rounds[o.rounds.length - 1]?.by !== 'creator') continue;
      const camp = campOf(o.campaignId);
      const who = nameOf(o.creatorId);
      if (!camp || !who) continue;
      items.push({
        id: `counter_${o.id}`,
        kind: 'counter',
        title: `${who} countered at $${o.rate.toLocaleString('en-US')}`,
        sub: `${camp.name} · accept, counter back or decline`,
        route: `campaign:${camp.id}?tab=pipeline`,
        campaignId: camp.id,
        campaignName: camp.name,
        creatorId: o.creatorId,
        creatorName: who,
        rate: o.rate,
        at: o.respondedAt,
      });
    }

    // 3. Content to review, then 4. pitches to answer.
    for (const camp of campaigns) {
      const target = perCreatorTarget(camp);
      for (const c of collabsForCampaign(camp.id, db)) {
        const who = nameOf(c.creatorId);
        if (!who) continue;
        const reviewing = c.deliverables.find((d) => d.status === 'in_review');
        if (reviewing) {
          items.push({
            id: `review_${c.id}`,
            kind: 'review',
            title: `${who} sent their ${reviewing.label.split(' · ')[0]} for review`,
            sub: `${camp.name} · approve it or ask for changes`,
            route: `campaign:${camp.id}?tab=content&review=${c.id}`,
            campaignId: camp.id,
            campaignName: camp.name,
            creatorId: c.creatorId,
            creatorName: who,
          });
        }
        // A closed campaign takes no more creators, so its open pitches
        // aren't waiting on anyone.
        if (c.stage === 'pitched' && camp.status !== 'Completed') {
          const app = db.applications
            .filter((a) => a.campaignId === camp.id && a.creatorId === c.creatorId && (a.status === 'submitted' || a.status === 'shortlisted'))
            .sort((a, b) => +new Date(b.submittedAt) - +new Date(a.submittedAt))[0];
          items.push({
            id: `pitch_${c.id}`,
            kind: 'pitch',
            title: app?.proposedRate
              ? `${who} pitched at $${app.proposedRate.toLocaleString('en-US')}`
              : `${who} sent a pitch`,
            sub: `${camp.name} · your target $${target.toLocaleString('en-US')}`,
            route: `campaign:${camp.id}?tab=pipeline`,
            campaignId: camp.id,
            campaignName: camp.name,
            creatorId: c.creatorId,
            creatorName: who,
            applicationId: app?.id,
            pitch: app?.pitch,
            rate: app?.proposedRate,
            target,
            at: app?.submittedAt,
          });
        }
      }
    }

    if (wallet.available < 5000) {
      items.push({
        id: 'topup',
        kind: 'topup',
        title: 'Top up to keep offers funded',
        sub: 'Accepting an offer holds its full amount, so keep enough on hand',
        route: 'wallet?action=topup',
      });
    }
    return items;
  }, [campaigns, creators, db, wallet.available]);
}

// ---------------------------------------------------------------------
// Counts for the nav
// ---------------------------------------------------------------------

/** Deal items waiting on a creator: what the Deals badge counts. */
export const isCreatorDealNeed = (n: CreatorNeed) => n.collabId != null;
/** Campaign items waiting on a brand: what the Campaigns badge counts. */
export const isBrandCampaignNeed = (n: BrandNeed) => n.campaignId != null;
