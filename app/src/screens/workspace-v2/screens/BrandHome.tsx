// BrandHome.tsx — the brand's Today (portal canvas, Round 8, B).
//
// Every need is a row you can act on where it stands: a campaign's pitches
// gathered into one "compare" row, a counter to answer, content to review,
// a post to confirm. The most urgent is open first; unread messages on a
// creator's deal sit beside its row. Then what creators owe this week.
// Money is a small card on the right with the live campaigns. (It was a
// pile showing one need at a time, with the held balance in 96px type.)
//
// The list comes from needsYou.ts, which also feeds the menu's badges.

import { useMemo } from 'react';
import {
  useV2BrandWallet, useV2Campaigns, useV2Conversations, useV2Creators,
  useV2CurrentBrand, v2ToggleSavedCreator,
} from '../v2Hooks';
import { useStore } from '@/lib/api/store';
import type { Database } from '@/lib/api/types';
import { collabsForCampaign } from '../v2Adapters';
import { TaskList, DueSoon, MoneyCard, type TaskItem, type DueItem } from './todayParts';
import { TODAY, daysBetween, parseDue } from '../dueDates';
import { v2AcceptPitch, v2RejectApplication } from '../v2CampaignActions';
import { useCapability } from '@/lib/permissions';
import { pushToast } from '@/lib/utils/toast';
import { Avatar } from '@/components/ui/Avatar';
import { fmtFollowers } from '../lib';
import type { V2Campaign, V2Creator } from '../data';
import { useBrandNeedsYou, type BrandNeed } from '../needsYou';
import {
  HomeHead, Letterhead, Terms, ago, dollars, greeting,
} from './homeParts';
import { brandAccent } from '../brandPalette';
import { perCreatorTarget } from '../campaignTarget';
import { avgEngagement } from '../channels';

/** A pile entry: one need, or a campaign's pitches gathered into one. */
type PileEntry = BrandNeed & { band: string; tag?: string; group?: BrandNeed[] };

interface Props {
  onRoute: (r: string) => void;
}

export function BrandHome({ onRoute }: Props) {
  const brand = useV2CurrentBrand();
  const wallet = useV2BrandWallet();
  const campaigns = useV2Campaigns();
  const creators = useV2Creators();
  const needs = useBrandNeedsYou();
  const conversations = useV2Conversations();
  const db = useStore((st) => st.db);
  const canDecide = useCapability('application.decide');

  const live = campaigns.filter((c) => c.status === 'Live');

  // A campaign's pitches are one decision (which of them), so they gather
  // into one sheet that opens the comparison table. Before, 42 of 49 items
  // on a busy home were single pitches, burying the counters and posts.
  const pitchCount = new Map<string, number>();
  for (const it of needs) if (it.kind === 'pitch' && it.campaignId) pitchCount.set(it.campaignId, (pitchCount.get(it.campaignId) ?? 0) + 1);
  const pile: PileEntry[] = [];
  const groupAt = new Map<string, number>();
  for (const it of needs) {
    const camp = it.campaignId ? campaigns.find((c) => c.id === it.campaignId) : undefined;
    const band = camp ? brandAccent(camp.name).bg : 'var(--v2-band-ink)';
    const count = it.kind === 'pitch' && it.campaignId ? pitchCount.get(it.campaignId) ?? 0 : 0;
    if (count >= 2 && it.campaignId) {
      const at = groupAt.get(it.campaignId);
      if (at !== undefined) { pile[at].group!.push(it); continue; }
      groupAt.set(it.campaignId, pile.length);
      pile.push({
        ...it,
        id: `pitches_${it.campaignId}`,
        title: `${count} pitches on ${it.campaignName ?? 'a campaign'}`,
        sub: 'Compare them side by side',
        route: `campaign:${it.campaignId}?tab=pipeline`,
        band,
        tag: `${count} to compare`,
        group: [it],
      });
      continue;
    }
    pile.push({ ...it, band, tag: it.campaignName });
  }

  const pitches = needs.filter((it) => it.kind === 'pitch').length;
  const others = needs.length - pitches;
  const summary = needs.length === 0
    ? `Nothing needs you right now${live.length ? `, with ${live.length} campaign${live.length === 1 ? '' : 's'} live` : ''}.`
    : [
        others > 0 ? `${others === 1 ? 'One thing needs' : `${others} things need`} you` : null,
        pitches > 0 ? `${pitches} pitch${pitches === 1 ? ' is' : 'es are'} waiting on ${pitchCount.size} campaign${pitchCount.size === 1 ? '' : 's'}` : null,
      ].filter(Boolean).join(', and ') + '.';
  const n = pile.length;

  const tasks = pile.map((it) => brandTask(it, {
    creators, campaigns, onRoute, canDecide,
    unread: it.creatorId && it.campaignId
      ? conversations.filter((c) => c.campaignId === it.campaignId && c.creatorId === it.creatorId).reduce((n, c) => n + c.unread, 0)
      : 0,
  }));
  // Every live campaign's collabs: only when campaigns or the store change.
  // (`live` is a new array each render, so it's derived inside.)
  const due = useMemo(() => brandDue(campaigns.filter((c) => c.status === 'Live'), db), [campaigns, db]);

  return (
    <div className="v2-hm v2-td">
      <div className="v2-hm-ground">
        <HomeHead
          title={`${greeting()}${brand ? `, ${brand.name}` : ''}.`}
          sub={summary}
          actions={
            <>
              <button type="button" className="v2-hm-btn" onClick={() => onRoute('discover')}>Find creators</button>
              <button type="button" className="v2-hm-btn is-dark" onClick={() => onRoute('campaign-new')}>New campaign</button>
            </>
          }
        />
      </div>

      <div className="v2-hm-cols">
        <div className="v2-td-main">
          <section aria-labelledby="hm-needs">
            <h2 className="v2-hm-h2" id="hm-needs">Needs you {n > 0 && <span>{n}</span>}</h2>
            {n === 0 ? (
              <div className="v2-hm-clear">
                <b>You’re all caught up.</b>
                <p>Pitches, counters and posts to confirm will land here first.</p>
                <button type="button" className="v2-hm-btn is-dark" onClick={() => onRoute('campaign-new')}>New campaign</button>
              </div>
            ) : (
              <TaskList items={tasks} label="Needs you" onRoute={onRoute} />
            )}
          </section>
          <DueSoon
            items={due}
            onRoute={onRoute}
            calendarRoute="calendar"
            empty="No creator content due in the next seven days."
          />
        </div>

        <div className="v2-hm-right">
          <MoneyCard
            title="Money"
            rows={[
              { label: 'Held for your creators', value: wallet.reserved, strong: true },
              { label: 'Available to spend', value: wallet.available },
              { label: 'Released this month', value: wallet.thisMonth.released },
            ]}
            action={<button type="button" className="v2-hm-btn is-sm" onClick={() => onRoute('wallet?action=topup')}>Top up</button>}
          />
          <LiveCampaigns campaigns={live} onRoute={onRoute} />
        </div>
      </div>
    </div>
  );
}

// =====================================================================
// A need (or a campaign's gathered pitches), as a row with its buttons.
// =====================================================================

function brandTask(it: PileEntry, ctx: {
  creators: V2Creator[];
  campaigns: V2Campaign[];
  onRoute: (r: string) => void;
  canDecide: boolean;
  unread: number;
}): TaskItem {
  const { onRoute } = ctx;
  const creator = it.creatorId ? ctx.creators.find((c) => c.id === it.creatorId) : undefined;
  const base = {
    id: it.id,
    stripe: it.band,
    mark: creator?.avatar || (it.campaignName ?? 'A')[0]!.toUpperCase(),
    route: it.route,
    unread: ctx.unread,
  };
  const locked = ctx.canDecide ? undefined : 'Admin or ops only';

  if (it.group) {
    const camp = ctx.campaigns.find((c) => c.id === it.campaignId);
    const target = camp ? perCreatorTarget(camp) : it.target ?? 0;
    const asks = it.group.map((g) => g.rate ?? 0).filter((r) => r > 0);
    return {
      ...base,
      mark: (it.campaignName ?? 'C')[0]!.toUpperCase(),
      title: `${it.group.length} pitches on ${it.campaignName ?? 'a campaign'}`,
      sub: asks.length
        ? `Asks from ${dollars(Math.min(...asks))} to ${dollars(Math.max(...asks))} · your target ${dollars(target)}`
        : 'Compare them side by side',
      actions: <button type="button" className="v2-hm-btn is-sm is-dark" onClick={() => onRoute(it.route)}>Compare {it.group.length}</button>,
      detail: (
        <ul className="v2-td-faces" aria-label="Who pitched">
          {it.group.slice(0, 6).map((g) => {
            const c = ctx.creators.find((x) => x.id === g.creatorId);
            return (
              <li key={g.id}>
                <Avatar src={c?.avatar} name={g.creatorName ?? 'Creator'} size={36} />
                <span>{g.creatorName?.split(' ')[0]}</span>
                {g.rate ? <b>{dollars(g.rate)}</b> : null}
              </li>
            );
          })}
        </ul>
      ),
    };
  }
  if (it.kind === 'pitch') {
    const accept = () => {
      if (!it.applicationId) return;
      try { v2AcceptPitch(it.applicationId); pushToast(`Accepted ${it.creatorName ? `${it.creatorName.split(' ')[0]}’s` : 'the'} pitch. It's held from your wallet.`, 'good'); }
      catch (err) { pushToast(err instanceof Error ? err.message : 'Could not accept the pitch', 'bad'); }
    };
    const pass = () => {
      if (!it.applicationId) return;
      try { v2RejectApplication(it.applicationId); pushToast(`Passed on ${it.creatorName ? `${it.creatorName.split(' ')[0]}’s` : 'the'} pitch`, 'good'); }
      catch (err) { pushToast(err instanceof Error ? err.message : 'Could not pass on the pitch', 'bad'); }
    };
    return {
      ...base,
      title: it.title,
      sub: it.sub,
      actions: (
        <>
          {it.applicationId && <button type="button" className="v2-hm-btn is-sm" onClick={pass} disabled={!ctx.canDecide} title={locked}>Pass</button>}
          {it.applicationId && it.rate
            ? <button type="button" className="v2-hm-btn is-sm is-dark" onClick={accept} disabled={!ctx.canDecide} title={locked}>Accept {dollars(it.rate)}</button>
            : <button type="button" className="v2-hm-btn is-sm is-dark" onClick={() => onRoute(it.route)}>Open</button>}
        </>
      ),
      detail: it.pitch ? <p className="v2-td-quote">{it.pitch}</p> : undefined,
    };
  }
  const cta: Record<string, string> = { verify: 'Check the post', counter: 'Answer', review: 'Review', topup: 'Top up' };
  return {
    ...base,
    title: it.title,
    // What confirming moves, so the brand knows what the click does. A slot
    // already paid on an earlier round releases nothing and says nothing.
    sub: it.kind === 'verify' && it.releases
      ? `${it.campaignName ?? ''} · confirming releases ${dollars(it.releases)} to ${it.creatorName?.split(' ')[0] ?? 'them'}`
      : it.sub,
    actions: <button type="button" className="v2-hm-btn is-sm is-dark" onClick={() => onRoute(it.route)}>{cta[it.kind] ?? 'Open'}</button>,
  };
}

// What creators owe this week, overdue first.
function brandDue(campaigns: V2Campaign[], db: Database): DueItem[] {
  const out: DueItem[] = [];
  for (const camp of campaigns) {
    for (const c of collabsForCampaign(camp.id, db)) {
      if (!['confirmed', 'submitted', 'approved', 'live'].includes(c.stage)) continue;
      const who = db.creators.find((x) => x.id === c.creatorId)?.name ?? 'Creator';
      for (const d of c.deliverables) {
        if (d.status === 'live' || d.status === 'approved') continue;
        const date = parseDue(d);
        if (!date) continue;
        const days = daysBetween(TODAY, date);
        if (days > 6) continue;
        out.push({
          id: `${c.id}-${d.id}`,
          date,
          what: `${who} · ${d.label}`,
          sub: camp.name,
          late: days < 0,
          route: d.status === 'in_review' ? `campaign:${camp.id}?tab=content` : `campaign:${camp.id}?tab=pipeline`,
          action: d.status === 'in_review' ? 'Review' : 'Open',
        });
      }
    }
  }
  out.sort((x, y) => +x.date - +y.date);
  return out;
}

// =====================================================================
// The open sheet
// =====================================================================

export function BrandSheet({ item, creator, saved, onRoute }: {
  item: BrandNeed;
  creator?: V2Creator;
  saved: boolean;
  onRoute: (r: string) => void;
}) {
  const canDecide = useCapability('application.decide');
  const open = (route: string) => () => onRoute(route);
  const first = item.creatorName?.split(/\s+/)[0] ?? 'the creator';

  if (item.kind === 'pitch' && creator) {
    const reach = creator.channels.reduce((s, ch) => s + ch.followers, 0);
    const er = avgEngagement(creator.channels);
    const accept = () => {
      if (!item.applicationId) return;
      try {
        v2AcceptPitch(item.applicationId);
        pushToast(`Accepted ${first}’s pitch at ${dollars(item.rate ?? 0)}. The money is now held for them.`, 'good');
      } catch (err) {
        pushToast(err instanceof Error ? err.message : 'Couldn’t accept the pitch', 'bad');
      }
    };
    const pass = () => {
      if (!item.applicationId) return;
      try {
        v2RejectApplication(item.applicationId);
        pushToast(`Passed on ${first}’s pitch.`, 'good');
      } catch (err) {
        pushToast(err instanceof Error ? err.message : 'Couldn’t pass on the pitch', 'bad');
      }
    };
    const locked = !canDecide ? 'Only admins and ops on your team can decide pitches' : undefined;
    return (
      <>
        <div className="v2-hm-who">
          <Avatar src={creator.avatar} name={creator.name} size={56} />
          <b>{creator.name}</b>
          <em>
            Pitched {ago(item.at) ?? 'recently'}
            <br />
            <button type="button" className="v2-hm-link" onClick={open(`creator:${creator.id}`)}>View storefront</button>
          </em>
          <small>
            {reach > 0 ? `${fmtFollowers(reach)} followers` : 'No channels linked yet'}
            {er > 0 ? ` · ${er.toFixed(1)}% engagement` : ''}
            {item.campaignName ? ` · for ${item.campaignName}` : ''}
          </small>
        </div>
        <div className="v2-hm-body">
          {item.pitch && <p className="v2-hm-quote">{item.pitch}</p>}
          <Terms
            cells={[
              ...(item.target ? [{ label: 'Your target', value: item.target }] : []),
              ...(item.rate ? [{ label: 'Their rate', value: item.rate }] : []),
              // The fee is taken on the creator's side of the ledger.
              { label: 'Platform fee to you', value: 0 },
            ]}
          />
          <div className="v2-hm-acts">
            {item.applicationId && item.rate ? (
              <button type="button" className="v2-hm-btn is-dark" onClick={accept} disabled={!canDecide} title={locked}>
                Accept {dollars(item.rate)}
              </button>
            ) : null}
            <button type="button" className="v2-hm-btn" onClick={open(item.route)}>Counter</button>
            <button
              type="button"
              className="v2-hm-btn"
              aria-pressed={saved}
              onClick={() => item.creatorId && v2ToggleSavedCreator(item.creatorId)}
            >{saved ? 'Saved' : 'Save creator'}</button>
            {item.applicationId && (
              <button type="button" className="v2-hm-btn" onClick={pass} disabled={!canDecide} title={locked}>Pass</button>
            )}
          </div>
        </div>
      </>
    );
  }

  const kindLabel: Record<BrandNeed['kind'], string> = {
    verify: 'post to confirm',
    counter: 'counter',
    review: 'content to review',
    pitch: 'pitch',
    topup: 'wallet',
  };
  const cta: Record<BrandNeed['kind'], string> = {
    verify: 'Check the post',
    counter: 'Answer the counter',
    review: 'Review it',
    pitch: 'Open the pitch',
    topup: 'Top up',
  };
  return (
    <>
      <Letterhead brand={item.campaignName ?? 'Wallet'} kind={kindLabel[item.kind]} aside={ago(item.at)} />
      <div className="v2-hm-body">
        <h3>{item.title}</h3>
        <p>{item.sub}</p>
        {item.kind === 'counter' && item.rate ? (
          <Terms cells={[{ label: 'Their counter', value: item.rate }, { label: 'Platform fee to you', value: 0 }]} />
        ) : null}
        <div className="v2-hm-acts">
          <button type="button" className="v2-hm-btn is-dark" onClick={open(item.route)}>{cta[item.kind]}</button>
          {item.creatorId && (
            <button type="button" className="v2-hm-btn" onClick={open(`creator:${item.creatorId}`)}>View storefront</button>
          )}
        </div>
      </div>
    </>
  );
}

// =====================================================================
// Right column
// =====================================================================

function LiveCampaigns({ campaigns, onRoute }: { campaigns: V2Campaign[]; onRoute: (r: string) => void }) {
  return (
    <section aria-labelledby="hm-live">
      <h2 className="v2-hm-h2" id="hm-live">
        Live campaigns {campaigns.length > 0 && <span>{campaigns.length}</span>}
        <button type="button" className="v2-hm-more" onClick={() => onRoute('campaigns')}>All campaigns</button>
      </h2>
      {campaigns.length === 0 ? (
        <p className="v2-hm-empty">No campaigns live. Post a brief and creators can start pitching.</p>
      ) : campaigns.slice(0, 4).map((c) => {
        const pct = c.budget > 0 ? Math.min(100, Math.round((c.spent / c.budget) * 100)) : 0;
        const people = c.creators.length;
        return (
          <button key={c.id} type="button" className="v2-hm-row" onClick={() => onRoute(`campaign:${c.id}`)}>
            <i style={{ background: brandAccent(c.name).bg }} aria-hidden="true">{c.name[0]?.toUpperCase()}</i>
            <b>{c.name}</b>
            <span className="v2-hm-p" style={{ color: 'var(--v2-ink)' }}>
              {dollars(c.spent)}<span>of {dollars(c.budget)}</span>
            </span>
            <small>
              {people === 0 ? 'Taking pitches' : `${people} creator${people === 1 ? '' : 's'}`}
              {c.live > 0 ? ` · ${c.live} post${c.live === 1 ? '' : 's'} live` : ''}
            </small>
            <span className="v2-hm-bar" role="presentation"><i style={{ width: `${pct}%` }} /></span>
          </button>
        );
      })}
    </section>
  );
}
