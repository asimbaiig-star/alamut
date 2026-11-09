// BrandHome.tsx — the brand's home (portal canvas, Round 2).
//
// One sheet, four things: the money held for creators, what needs you as a
// pile (a pitch open on top, to accept or pass in place), live campaigns
// with their spend, and the creators you've saved. Spark has its own place
// in the sidebar; it no longer takes the top of the home.
//
// The pile comes from needsYou.ts, which also feeds the sidebar badges.

import {
  useV2BrandShortlist, useV2BrandWallet, useV2Campaigns, useV2Creators,
  useV2CurrentBrand, v2ToggleSavedCreator,
} from '../v2Hooks';
import { v2AcceptPitch, v2RejectApplication } from '../v2CampaignActions';
import { useCapability } from '@/lib/permissions';
import { pushToast } from '@/lib/utils/toast';
import { Avatar } from '@/components/ui/Avatar';
import { fmtFollowers } from '../lib';
import type { V2Campaign, V2Creator } from '../data';
import { useBrandNeedsYou, type BrandNeed } from '../needsYou';
import {
  HomeHead, Letterhead, MoneyStrip, Pile, Terms, ago, dollars, greeting,
} from './homeParts';
import { brandAccent } from '../brandPalette';

interface Props {
  onRoute: (r: string) => void;
}

export function BrandHome({ onRoute }: Props) {
  const brand = useV2CurrentBrand();
  const wallet = useV2BrandWallet();
  const campaigns = useV2Campaigns();
  const creators = useV2Creators();
  const shortlist = useV2BrandShortlist();
  const needs = useBrandNeedsYou();

  const live = campaigns.filter((c) => c.status === 'Live');
  const n = needs.length;
  const summary = n === 0
    ? `Nothing needs you right now${live.length ? `, with ${live.length} campaign${live.length === 1 ? '' : 's'} live` : ''}.`
    : `${n === 1 ? 'One thing needs' : `${n} things need`} you${live.length ? ` across ${live.length} live campaign${live.length === 1 ? '' : 's'}` : ''}.`;

  const pile = needs.map((it) => {
    const camp = it.campaignId ? campaigns.find((c) => c.id === it.campaignId) : undefined;
    return {
      ...it,
      band: camp ? brandAccent(camp.name).bg : 'var(--v2-band-ink)',
      tag: it.campaignName,
    };
  });

  return (
    <div className="v2-hm">
      <div className="v2-hm-ground">
        <HomeHead
          title={`${greeting()}${brand ? `, ${brand.name}` : ''}.`}
          sub={summary}
          actions={
            <>
              <button type="button" className="v2-hm-btn" onClick={() => onRoute('discover')}>Discover creators</button>
              <button type="button" className="v2-hm-btn is-dark" onClick={() => onRoute('campaign-new')}>New campaign</button>
            </>
          }
        />
        <MoneyStrip
          label="Held for your creators"
          figure={wallet.reserved}
          rows={[
            { label: 'Available to spend', value: wallet.available },
            { label: 'Released this month', value: wallet.thisMonth.released },
          ]}
          action={
            <button type="button" className="v2-hm-btn" onClick={() => onRoute('wallet?action=topup')}>Top up</button>
          }
        />
      </div>

      <div className="v2-hm-cols">
        <section aria-labelledby="hm-needs">
          <h2 className="v2-hm-h2" id="hm-needs">Needs you {n > 0 && <span>{n}, most urgent on top</span>}</h2>
          {n === 0 ? (
            <div className="v2-hm-clear">
              <b>You’re all caught up.</b>
              <p>Pitches, counters and posts to confirm will land here first.</p>
              <button type="button" className="v2-hm-btn is-dark" onClick={() => onRoute('campaign-new')}>New campaign</button>
            </div>
          ) : (
            <Pile
              items={pile}
              label="Needs you"
              renderTop={(it) => (
                <BrandSheet
                  item={it}
                  creator={creators.find((c) => c.id === it.creatorId)}
                  saved={!!it.creatorId && shortlist.includes(it.creatorId)}
                  onRoute={onRoute}
                />
              )}
            />
          )}
        </section>

        <div className="v2-hm-right">
          <LiveCampaigns campaigns={live} onRoute={onRoute} />
          <Shortlist ids={shortlist} creators={creators} onRoute={onRoute} />
        </div>
      </div>
    </div>
  );
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
    const er = creator.channels.length
      ? creator.channels.reduce((s, ch) => s + ch.engagement, 0) / creator.channels.length
      : 0;
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

function Shortlist({ ids, creators, onRoute }: {
  ids: string[];
  creators: V2Creator[];
  onRoute: (r: string) => void;
}) {
  const saved = ids
    .map((id) => creators.find((c) => c.id === id))
    .filter((c): c is V2Creator => !!c);
  return (
    <section aria-labelledby="hm-saved">
      <h2 className="v2-hm-h2" id="hm-saved">
        Saved creators {saved.length > 0 && <span>{saved.length}</span>}
        <button type="button" className="v2-hm-more" onClick={() => onRoute('discover')}>Discover</button>
      </h2>
      {saved.length === 0 ? (
        <p className="v2-hm-empty">Save creators from Discover or a pitch, and they’ll wait for you here.</p>
      ) : (
        <div className="v2-hm-faces">
          {saved.slice(0, 8).map((c) => (
            <button key={c.id} type="button" onClick={() => onRoute(`creator:${c.id}`)} aria-label={c.name} title={c.name}>
              <Avatar src={c.avatar} name={c.name} size={52} />
            </button>
          ))}
          {saved.length > 8 && (
            <button type="button" className="v2-hm-faces-more" onClick={() => onRoute('discover')} aria-label={`${saved.length - 8} more saved creators`}>
              +{saved.length - 8}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
