// CreatorHome.tsx — the creator's home (portal canvas, Round 2).
//
// One sheet: the greeting, the money (one figure, a short ledger and the
// test-mode line beside Withdraw), then what needs you as a pile of
// letterheads with the most urgent one open to answer in place. On the
// right: deals in motion by stage, and the open briefs that fit best.
//
// Everything is derived from the store. The pile comes from needsYou.ts,
// which also feeds the sidebar badges, so the two always agree.

import { perCreatorTarget } from '../campaignTarget';
import { useMemo } from 'react';
import {
  useV2AllCampaigns, useV2CreatorWallet, useV2CurrentCreator, useV2MyCollabs,
} from '../v2Hooks';
import { useStore } from '@/lib/api/store';
import { matchCreatorToCampaign } from '../matching';
import { v2AcceptOffer } from '../v2CampaignActions';
import { splitAcrossSlots } from '@/lib/api/money';
import { pushToast } from '@/lib/utils/toast';
import type { V2Campaign, V2Collab, V2CollabStage } from '../data';
import { useCreatorNeedsYou, type CreatorNeed } from '../needsYou';
import {
  HomeHead, Letterhead, MoneyStrip, Pile, Terms, bandFor, dollars, greeting,
} from './homeParts';
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
  const n = needs.length;
  const summary = n === 0
    ? 'Nothing needs you right now.'
    : `${n === 1 ? 'One thing needs' : `${n} things need`} you, the most urgent on top.`;

  const pile = needs.map((it) => ({
    ...it,
    band: bandFor(it.brand),
    tag: it.due ? `Due ${it.due}` : it.kind === 'offer' && it.rate ? dollars(it.rate) : undefined,
  }));

  return (
    <div className="v2-hm">
      <div className="v2-hm-ground">
        <HomeHead
          title={`${greeting()}, ${first}.`}
          sub={summary}
          actions={
            <>
              <button type="button" className="v2-hm-btn" onClick={() => onRoute('storefront')}>Your storefront</button>
              <button type="button" className="v2-hm-btn is-dark" onClick={() => onRoute('creator-campaigns')}>Find briefs</button>
            </>
          }
        />
        <MoneyStrip
          label="Ready to withdraw"
          figure={wallet.available}
          tone="moss"
          rows={[
            { label: 'Held in escrow for your deals', value: wallet.pending },
            { label: 'Earned so far, before fees', value: wallet.lifetime },
          ]}
          action={
            <button
              type="button"
              className="v2-hm-btn is-fill"
              onClick={() => onRoute('creator-wallet?action=withdraw')}
              disabled={wallet.available <= 0}
            >Withdraw</button>
          }
        />
      </div>

      <div className="v2-hm-cols">
        <section aria-labelledby="hm-needs">
          <h2 className="v2-hm-h2" id="hm-needs">Needs you {n > 0 && <span>{n}</span>}</h2>
          {n === 0 ? (
            <div className="v2-hm-clear">
              <b>You’re all caught up.</b>
              <p>New offers, changes and payouts will land here first.</p>
              <button type="button" className="v2-hm-btn is-dark" onClick={() => onRoute('creator-campaigns')}>Find briefs</button>
            </div>
          ) : (
            <Pile
              items={pile}
              label="Needs you"
              renderTop={(it) => <CreatorSheet item={it} onRoute={onRoute} />}
            />
          )}
        </section>

        <div className="v2-hm-right">
          <DealsInMotion collabs={myCollabs} onRoute={onRoute} />
          <BriefsThatFit creatorId={creator.id} campaigns={campaigns} collabs={myCollabs} onRoute={onRoute} />
        </div>
      </div>
    </div>
  );
}

// =====================================================================
// The open sheet: each kind of item, answerable from here.
// =====================================================================

function CreatorSheet({ item, onRoute }: { item: CreatorNeed; onRoute: (r: string) => void }) {
  const open = (route: string) => () => onRoute(route);
  const keep = item.rate ? splitAcrossSlots(item.rate, item.slots ?? 1).net : 0;

  if (item.kind === 'offer') {
    const accept = () => {
      if (!item.offerId) return;
      try {
        v2AcceptOffer(item.offerId);
        pushToast(`Offer accepted. ${item.brand} has been told.`, 'good');
      } catch (err) {
        pushToast(err instanceof Error ? err.message : 'Couldn’t accept the offer', 'bad');
      }
    };
    return (
      <>
        <Letterhead brand={item.brand ?? 'Brand'} kind={item.offerId ? 'offer' : 'invitation'} />
        <div className="v2-hm-body">
          <h3>{item.campaignName}</h3>
          <p>
            {item.offerId
              ? `${item.title}${item.deliverable ? ` for ${item.deliverable}` : ''}. Accept it here, or counter with your price.`
              : `They’d like you on this brief${item.deliverable ? ` (${item.deliverable})` : ''}. Open it to pitch your rate.`}
          </p>
          {item.offerId && item.rate ? (
            <Terms
              cells={[
                { label: 'They offer', value: item.rate },
                ...(item.asked ? [{ label: 'You asked', value: item.asked }] : []),
                { label: 'You’d keep', value: keep, tone: 'moss' as const },
              ]}
            />
          ) : null}
          <div className="v2-hm-acts">
            {item.offerId && item.rate ? (
              <>
                <button type="button" className="v2-hm-btn is-dark" onClick={accept}>Accept {dollars(item.rate)}</button>
                <button type="button" className="v2-hm-btn" onClick={open(`${item.route}?action=counter`)}>Counter</button>
                <button type="button" className="v2-hm-btn" onClick={open(item.route)}>Open the deal</button>
              </>
            ) : (
              <button type="button" className="v2-hm-btn is-dark" onClick={open(item.route)}>Open the invitation</button>
            )}
          </div>
        </div>
      </>
    );
  }

  if (item.kind === 'revision' || item.kind === 'upload' || item.kind === 'live') {
    const verb = item.kind === 'revision' ? 'changes asked' : item.kind === 'upload' ? 'to submit' : 'approved';
    return (
      <>
        <Letterhead brand={item.brand ?? 'Brand'} kind={verb} />
        <div className="v2-hm-body">
          <h3>{item.title}</h3>
          {item.kind === 'revision' && item.note
            ? <p className="v2-hm-quote">{item.note}</p>
            : <p>{item.kind === 'live'
                ? 'Post it on your channel, then paste the link here. The brand confirms it and your payment for this post is released.'
                : item.sub}</p>}
          {item.rate ? (
            <Terms
              cells={[
                { label: 'Deal', value: item.rate },
                { label: 'You keep in all', value: keep, tone: 'moss' as const },
              ]}
            />
          ) : null}
          <div className="v2-hm-acts">
            <button type="button" className="v2-hm-btn is-dark" onClick={open(item.route)}>
              {item.kind === 'revision' ? `Resubmit your ${item.deliverable ?? 'content'}`
                : item.kind === 'upload' ? `Upload your ${item.deliverable ?? 'content'}`
                : 'Paste the live link'}
            </button>
            {item.collabId && (
              <button type="button" className="v2-hm-btn" onClick={open(`collab:${item.collabId}`)}>Open the deal</button>
            )}
          </div>
        </div>
      </>
    );
  }

  // Account housekeeping: verification, storefront gaps.
  return (
    <>
      <Letterhead brand="Alamut" kind={item.kind === 'kyc' ? 'verification' : 'storefront'} />
      <div className="v2-hm-body">
        <h3>{item.title}</h3>
        <p>{item.sub}</p>
        <div className="v2-hm-acts">
          <button type="button" className="v2-hm-btn is-dark" onClick={open(item.route)}>
            {item.kind === 'kyc' ? 'Finish verification' : 'Edit your storefront'}
          </button>
        </div>
      </div>
    </>
  );
}

// =====================================================================
// Deals in motion: every deal, counted by where it stands.
// =====================================================================

const MOTION: { label: string; stages: V2CollabStage[]; tone?: 'hot' | 'done' }[] = [
  { label: 'Offers', stages: ['invited', 'negotiating'], tone: 'hot' },
  { label: 'Pitched', stages: ['pitched'] },
  { label: 'Working', stages: ['confirmed', 'submitted'] },
  { label: 'Releasing', stages: ['approved', 'live'] },
  { label: 'Paid', stages: ['paid'], tone: 'done' },
];

function DealsInMotion({ collabs, onRoute }: { collabs: V2Collab[]; onRoute: (r: string) => void }) {
  const total = collabs.filter((c) => c.stage !== 'cancelled').length;
  return (
    <section aria-labelledby="hm-motion">
      <h2 className="v2-hm-h2" id="hm-motion">Deals in motion {total > 0 && <span>{total}</span>}</h2>
      <div className="v2-hm-track">
        {MOTION.map((m) => {
          const n = collabs.filter((c) => m.stages.includes(c.stage)).length;
          return (
            <button
              key={m.label}
              type="button"
              data-tone={n > 0 ? m.tone : undefined}
              onClick={() => onRoute('creator-collabs')}
              aria-label={`${n} ${m.label.toLowerCase()}, open your deals`}
            >
              <b>{n}</b>
              <span>{m.label}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
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
