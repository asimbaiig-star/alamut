// CreatorHome.tsx — the creator's Today (portal canvas, Round 8, B).
//
// Every need is a row you can act on where it stands: accept an offer,
// resubmit, paste the live link. The most urgent is open first, with its
// terms; unread messages on a deal sit beside its row. Then what's due this
// week, from the same deadlines as the calendar. Money is a small card on
// the right, with the briefs that fit best. (It was a pile: one need open,
// three clipped bands, the rest behind "See all"; and the balance in 96px
// type above the tasks it's checked far less often than.)
//
// The list comes from needsYou.ts, which also feeds the menu's badges.

import { perCreatorTarget } from '../campaignTarget';
import { useMemo } from 'react';
import {
  useV2AllCampaigns, useV2Conversations, useV2CreatorWallet, useV2CurrentCreator, useV2MyCollabs,
} from '../v2Hooks';
import { useStore } from '@/lib/api/store';
import { matchCreatorToCampaign } from '../matching';
import { v2AcceptOffer } from '../v2CampaignActions';
import { splitAcrossSlots } from '@/lib/api/money';
import { pushToast } from '@/lib/utils/toast';
import type { V2Campaign, V2Collab } from '../data';
import { useCreatorNeedsYou, type CreatorNeed } from '../needsYou';
import { HomeHead, bandFor, dollars, greeting } from './homeParts';
import { TaskList, TaskTerms, DueSoon, MoneyCard, type TaskItem, type DueItem } from './todayParts';
import { TODAY, daysBetween, parseDue } from '../dueDates';
import { stageTotals } from './dealPipeline';
import { brandAccent } from '../brandPalette';

interface Props {
  onRoute: (r: string) => void;
}

export function CreatorHome({ onRoute }: Props) {
  const creator = useV2CurrentCreator();
  const wallet = useV2CreatorWallet();
  const campaigns = useV2AllCampaigns();
  const myCollabs = useV2MyCollabs();
  const needs = useCreatorNeedsYou();
  const conversations = useV2Conversations();
  const db = useStore((st) => st.db);

  if (!creator) {
    return (
      <div className="v2-hm">
        <div className="v2-hm-ground">
          <HomeHead title="Welcome" sub="We couldn’t find a creator profile on this account yet." />
        </div>
      </div>
    );
  }

  const first = creator.name.split(/\s+/)[0] ?? creator.name;
  const live = myCollabs.filter((c) => c.stage !== 'cancelled');
  const totals = stageTotals(live, db);
  const onWay = totals.filter((t) => t.id === 'working' || t.id === 'releasing').reduce((n, t) => n + t.amount, 0);
  const n = needs.length;
  const summary = n === 0
    ? `Nothing needs you right now.${onWay > 0 ? ` ${dollars(onWay)} is on its way to you.` : ''}`
    : `${n} need${n === 1 ? 's' : ''} you, the most urgent first.${onWay > 0 ? ` ${dollars(onWay)} is on its way to you.` : ''}`;

  // Unread messages on the deal a need belongs to.
  const unreadFor = (need: CreatorNeed) => {
    const collab = need.collabId ? live.find((c) => c.id === need.collabId) : undefined;
    if (!collab) return 0;
    return conversations.filter((c) => c.campaignId === collab.campaignId && c.creatorId === collab.creatorId)
      .reduce((s, c) => s + c.unread, 0);
  };
  const tasks = needs.map((need) => creatorTask(need, unreadFor(need), onRoute));
  const due = dueThisWeek(live, campaigns);

  return (
    <div className="v2-hm v2-td">
      <div className="v2-hm-ground">
        <HomeHead
          title={`${greeting()}, ${first}.`}
          sub={summary}
          actions={<button type="button" className="v2-hm-btn is-dark" onClick={() => onRoute('creator-campaigns')}>Find briefs</button>}
        />
      </div>

      <div className="v2-hm-cols">
        <div className="v2-td-main">
          <section aria-labelledby="hm-needs">
            <h2 className="v2-hm-h2" id="hm-needs">Needs you {n > 0 && <span>{n}</span>}</h2>
            {n === 0 ? (
              <div className="v2-hm-clear">
                <b>You’re all caught up.</b>
                <p>New offers, changes and payouts will land here first.</p>
                <button type="button" className="v2-hm-btn is-dark" onClick={() => onRoute('creator-campaigns')}>Find briefs</button>
              </div>
            ) : (
              <TaskList items={tasks} label="Needs you" onRoute={onRoute} />
            )}
          </section>
          <DueSoon
            items={due}
            onRoute={onRoute}
            calendarRoute="creator-calendar"
            empty="Nothing due in the next seven days."
          />
        </div>

        <div className="v2-hm-right">
          <MoneyCard
            title="Money"
            rows={[
              { label: 'Ready to withdraw', value: wallet.available, strong: true },
              { label: 'Held for your deals', value: wallet.pending },
            ]}
            action={
              <button
                type="button"
                className="v2-hm-btn is-sm"
                onClick={() => onRoute('creator-wallet?action=withdraw')}
                disabled={wallet.available <= 0}
              >Withdraw</button>
            }
          />
          <BriefsThatFit creatorId={creator.id} campaigns={campaigns} collabs={myCollabs} onRoute={onRoute} />
        </div>
      </div>
    </div>
  );
}

// =====================================================================
// A need, as a row with its own buttons.
// =====================================================================

function creatorTask(item: CreatorNeed, unread: number, onRoute: (r: string) => void): TaskItem {
  const brand = item.brand ?? 'Alamut';
  const base = {
    id: item.id,
    stripe: item.brand ? bandFor(item.brand) : 'var(--v2-band-ink)',
    mark: brand[0]?.toUpperCase() ?? 'A',
    route: item.collabId ? `collab:${item.collabId}` : item.route,
    unread,
  };
  const keep = item.rate ? splitAcrossSlots(item.rate, item.slots ?? 1).net : 0;
  const due = item.due ? ` · due ${item.due}` : '';

  if (item.kind === 'offer' && item.offerId && item.rate) {
    const accept = () => {
      try {
        v2AcceptOffer(item.offerId!);
        pushToast(`Offer accepted. ${brand} has been told, and the full amount is held for you.`, 'good');
      } catch (err) {
        pushToast(err instanceof Error ? err.message : 'Couldn’t accept the offer', 'bad');
      }
    };
    return {
      ...base,
      title: `${brand} offered ${dollars(item.rate)} for ${item.campaignName ?? 'a deal'}`,
      sub: `${item.deliverable ?? 'Deal'}${due}`,
      actions: (
        <>
          <button type="button" className="v2-hm-btn is-sm" onClick={() => onRoute(`${item.route}?action=counter`)}>Counter</button>
          <button type="button" className="v2-hm-btn is-sm is-dark" onClick={accept}>Accept {dollars(item.rate)}</button>
        </>
      ),
      detail: (
        <TaskTerms cells={[
          { label: 'They offer', value: dollars(item.rate) },
          ...(item.asked ? [{ label: 'You asked', value: dollars(item.asked) }] : []),
          { label: 'You’d keep', value: dollars(keep), tone: 'moss' as const },
        ]} />
      ),
    };
  }
  if (item.kind === 'offer') {
    return {
      ...base,
      title: `${brand} invited you to ${item.campaignName ?? 'a brief'}`,
      sub: `Pitch your rate${item.deliverable ? ` for ${item.deliverable}` : ''}${due}`,
      actions: <button type="button" className="v2-hm-btn is-sm is-dark" onClick={() => onRoute(item.route)}>Pitch</button>,
    };
  }
  if (item.kind === 'revision') {
    return {
      ...base,
      title: `${brand} asked for changes`,
      sub: `${item.campaignName ?? ''}${item.deliverable ? ` · ${item.deliverable}` : ''}${due}`,
      actions: <button type="button" className="v2-hm-btn is-sm is-dark" onClick={() => onRoute(item.route)}>Resubmit</button>,
      detail: item.note ? <p className="v2-td-quote">{item.note}</p> : undefined,
    };
  }
  if (item.kind === 'upload') {
    return {
      ...base,
      title: `Submit your ${item.deliverable ?? 'content'}`,
      sub: `${item.campaignName ?? ''} · ${brand}${due}`,
      actions: <button type="button" className="v2-hm-btn is-sm is-dark" onClick={() => onRoute(item.route)}>Upload</button>,
    };
  }
  if (item.kind === 'live') {
    return {
      ...base,
      title: `Post ${item.campaignName ?? 'it'}`,
      sub: `${brand} approved it · paste the live link and that post’s share is released${keep ? ` (you keep ${dollars(keep)} in all)` : ''}`,
      actions: <button type="button" className="v2-hm-btn is-sm" onClick={() => onRoute(item.route)}>Paste link</button>,
    };
  }
  return {
    ...base,
    title: item.title,
    sub: item.sub,
    actions: (
      <button type="button" className="v2-hm-btn is-sm is-dark" onClick={() => onRoute(item.route)}>
        {item.kind === 'kyc' ? 'Finish verification' : 'Edit your storefront'}
      </button>
    ),
  };
}

// =====================================================================
// Due this week: overdue first, then the next seven days.
// =====================================================================

function dueThisWeek(collabs: V2Collab[], campaigns: V2Campaign[]): DueItem[] {
  const out: DueItem[] = [];
  for (const c of collabs) {
    if (c.stage === 'paid' || c.stage === 'cancelled' || c.stage === 'pitched' || c.stage === 'invited') continue;
    const camp = campaigns.find((x) => x.id === c.campaignId);
    for (const d of c.deliverables) {
      if (d.status === 'live' || d.status === 'approved') continue;
      const date = parseDue(d);
      if (!date) continue;
      const days = daysBetween(TODAY, date);
      if (days > 6) continue;
      out.push({
        id: `${c.id}-${d.id}`,
        date,
        what: d.label,
        sub: `${camp?.name ?? 'Deal'} · ${camp?.brand ?? ''}`,
        late: days < 0,
        route: `collab:${c.id}${d.status === 'pending' || d.status === 'revision' ? '?action=upload' : ''}`,
        action: d.status === 'in_review' ? 'Open' : d.status === 'revision' ? 'Resubmit' : 'Upload',
      });
    }
  }
  out.sort((x, y) => +x.date - +y.date);
  return out.slice(0, 5);
}

// =====================================================================
// Briefs that fit: the three open briefs the matcher ranks highest.
// =====================================================================

function BriefsThatFit({ creatorId, campaigns, collabs, onRoute }: {
  creatorId: string;
  campaigns: V2Campaign[];
  collabs: V2Collab[];
  onRoute: (r: string) => void;
}) {
  const db = useStore((s) => s.db);
  const top = useMemo(() => {
    const taken = new Set(collabs.map((c) => c.campaignId));
    const me = db.creators.find((c) => c.id === creatorId) ?? null;
    const scored = campaigns
      .filter((c) => c.status === 'Live' && !taken.has(c.id))
      .map((c) => {
        const perCreator = perCreatorTarget(c);
        const raw = db.campaigns.find((x) => x.id === c.id);
        return { c, perCreator, score: matchCreatorToCampaign(me, raw, db, perCreator).score };
      });
    // Rank by fit when the profile can be scored; otherwise newest first,
    // rather than inventing a ranking.
    const rankable = scored.some((s) => s.score !== null);
    scored.sort((a, b) => rankable
      ? (b.score ?? -1) - (a.score ?? -1)
      : +new Date(b.c.createdAt) - +new Date(a.c.createdAt));
    return scored.slice(0, 3);
  }, [campaigns, collabs, creatorId, db]);

  return (
    <section aria-labelledby="hm-briefs">
      <h2 className="v2-hm-h2" id="hm-briefs">
        Briefs that fit you
        <button type="button" className="v2-hm-more" onClick={() => onRoute('creator-campaigns')}>See all</button>
      </h2>
      {top.length === 0 ? (
        <p className="v2-hm-empty">No open briefs right now. New ones show up here as brands post them.</p>
      ) : top.map(({ c, perCreator }) => (
        <button key={c.id} type="button" className="v2-hm-row" onClick={() => onRoute(`brief:${c.id}`)}>
          <i style={{ background: brandAccent(c.brand).bg }} aria-hidden="true">
            {c.brandLogoUrl ? <img src={c.brandLogoUrl} alt="" /> : c.brand[0]?.toUpperCase()}
          </i>
          <b>{c.name}</b>
          <span className="v2-hm-p">{dollars(perCreator)}<span>per creator</span></span>
          <small>
            {c.brand} · {c.placement}
            {/* F19: a seeded brand won't answer a pitch, so say so. */}
            {c.brandIsDemo ? ' · sample brief' : ''}
          </small>
        </button>
      ))}
    </section>
  );
}
