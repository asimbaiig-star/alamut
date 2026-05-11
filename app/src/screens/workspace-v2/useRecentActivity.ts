// useRecentActivity.ts — derive the home-screen "Recent activity" feed
// from server-persisted state (collab history, transactions, reviews)
// instead of from db.notifications.
//
// Why: db.notifications is per-device (intentionally not migrated to
// Postgres). Reading the activity feed from notifications meant
// Hannah-on-laptop and Hannah-on-phone saw different histories. The
// underlying workflow events though ARE in Postgres — every stage
// transition gets appended to Collaboration.history, every money move
// to db.transactions, every review goes into db.reviews. So we can
// reconstruct an equivalent activity log from those sources and get
// cross-device consistency for free.
//
// Event vocabulary kept compatible with classifyActivity() in
// BrandHome.tsx (the lowercase-keyword classifier that picks the
// icon + colour for each row). Phrasing uses "accepted", "submitted",
// "approved", "live", "payout", "review" so the regex matches.
//
// Actor filter: events caused by the viewer themselves are dropped —
// matches the legacy notification semantics where a mutation pushed
// notifications to the COUNTER party, not the actor.

import { useMemo } from 'react';
import { useDB } from '@/lib/api/store';

export interface RecentActivityItem {
  id: string;
  text: string;
  at: string;
  href?: string;
  read?: boolean;
  meta?: { campaignId?: string; submissionId?: string; offerId?: string; reviewId?: string };
}

export function useRecentActivity(
  userId: string | null | undefined,
  opts?: { limit?: number },
): RecentActivityItem[] {
  const db = useDB();
  return useMemo(() => {
    if (!userId) return [];
    const me = db.users.find((u) => u.id === userId);
    if (!me) return [];

    const myCreatorId = me.creatorId ?? null;
    const myBrandId = me.brandId ?? null;
    const isBrandUser = !!myBrandId;
    const isCreatorUser = !!myCreatorId;

    const events: RecentActivityItem[] = [];

    // ----- 1. Collaboration history — the canonical stage-transition log -----
    for (const c of db.collaborations) {
      const partOfBrand = isBrandUser && c.brandId === myBrandId;
      const partOfCreator = isCreatorUser && c.creatorId === myCreatorId;
      if (!partOfBrand && !partOfCreator) continue;

      const camp = db.campaigns.find((cm) => cm.id === c.campaignId);
      const campTitle = camp?.title ?? 'a campaign';
      const other = partOfBrand
        ? db.creators.find((cr) => cr.id === c.creatorId)?.name
        : db.brands.find((b) => b.id === c.brandId)?.name;
      const otherName = other ?? 'Counter party';

      for (const h of c.history) {
        if (h.actorUserId === me.id) continue; // skip self-caused events

        let text: string | null = null;
        switch (h.to) {
          case 'pitched':
            text = partOfBrand ? `${otherName} pitched for ${campTitle}` : null;
            break;
          case 'negotiating':
            text = partOfCreator ? `${otherName} sent you an offer on ${campTitle}` : null;
            break;
          case 'confirmed':
            text = `${otherName} accepted the offer on ${campTitle}`;
            break;
          case 'submitted':
            text = partOfBrand ? `${otherName} submitted content for ${campTitle}` : null;
            break;
          case 'approved':
            text = partOfCreator ? `Content approved on ${campTitle}` : null;
            break;
          case 'live':
            text = `Content live on ${campTitle}`;
            break;
          case 'paid':
            text = `Payout cleared on ${campTitle}`;
            break;
          case 'cancelled':
            text = `Collab cancelled on ${campTitle}`;
            break;
        }
        if (!text) continue;

        events.push({
          id: `col:${c.id}:${h.at}:${h.to}`,
          text,
          at: new Date(h.at).toISOString(),
          meta: { campaignId: c.campaignId },
        });
      }
    }

    // ----- 2. Standalone money events not already covered by collab history -----
    // Payouts, escrow releases, refunds are folded into stage transitions
    // above (live → paid, cancelled). Topups and referral bonuses are
    // wallet-level events that don't tie to a stage, so surface them here.
    for (const t of db.transactions) {
      if (t.userId !== me.id) continue;
      if (t.kind !== 'topup' && t.kind !== 'referral_bonus') continue;

      const amt = Math.abs(t.amount).toLocaleString();
      const text = t.kind === 'topup'
        ? `Wallet topped up · $${amt}`
        : `Referral bonus cleared · $${amt}`;

      events.push({
        id: `tx:${t.id}`,
        text,
        at: t.at,
        meta: t.campaignId ? { campaignId: t.campaignId } : undefined,
      });
    }

    // ----- 3. Reviews received -----
    for (const r of db.reviews) {
      if (r.hidden) continue;
      if (r.fromUserId === me.id) continue;
      const targetIsMe =
        (r.reviewType === 'creator' && r.targetId === myCreatorId) ||
        (r.reviewType === 'brand' && r.targetId === myBrandId);
      if (!targetIsMe) continue;

      const camp = db.campaigns.find((cm) => cm.id === r.campaignId);
      events.push({
        id: `rev:${r.id}`,
        text: `New ${r.rating}★ review on ${camp?.title ?? 'a campaign'}`,
        at: r.at,
        meta: { campaignId: r.campaignId, reviewId: r.id },
      });
    }

    return events
      .sort((a, b) => +new Date(b.at) - +new Date(a.at))
      .slice(0, opts?.limit ?? 6);
  }, [db, userId, opts?.limit]);
}
