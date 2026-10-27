// cards-creators.tsx — the creator page's workspace screen: one deal from
// offer to review (see productCards.tsx).

import { usd } from './estimate';
import { BRIEFS } from './listings-briefs';
import { Window } from './productCards';
import { PlatMark } from './tools-shared';

const CREATOR_NAV = ['Home', 'My storefront', 'My collaborations', 'Browse campaigns', 'Inbox', 'Calendar', 'Wallet'];

/** A review's stars, drawn, as the portal draws ratings. */
function Stars({ count }: { count: number }) {
  return (
    <span className="lx-stars" role="img" aria-label={`${count} out of 5 stars`}>
      {Array.from({ length: 5 }, (_, i) => (
        <svg key={i} viewBox="0 0 20 20" width="15" height="15" aria-hidden="true" className={i < count ? 'on' : undefined}>
          <path d="M10 1.6l2.6 5.3 5.8.8-4.2 4.1 1 5.8L10 14.9l-5.2 2.7 1-5.8L1.6 7.7l5.8-.8z" />
        </svg>
      ))}
    </span>
  );
}

/** Creators: one deal from offer to review. */
export function CreatorDealWindow() {
  return (
    <Window nav={CREATOR_NAV} active="My collaborations" crumb={`My collaborations · ${BRIEFS[0]!.brand}`} title="Skincare launch">
      <div className="lx-card">
        <div className="lx-row">
          <span className="lx-row-who">The brand offered</span>
          <span className="lx-row-what lx-plat"><PlatMark of="Instagram" />2 × Instagram Reel</span>
          <span className="lx-money lx-row-amt struck">{usd(1500)}</span>
        </div>
      </div>
      <div className="lx-card">
        <div className="lx-row">
          <span className="lx-row-who">You countered at your Reel rate · <span className="lx-pill moss">Agreed</span></span>
          <span className="lx-row-what">2 × Reel at {usd(900)}</span>
          <span className="lx-money lx-row-amt">{usd(1800)}</span>
        </div>
      </div>
      <div className="lx-card">
        <div className="lx-row">
          <span className="lx-row-who">The brand proposed a paid change</span>
          <span className="lx-row-what">Add 1 Story</span>
          <span className="lx-money lx-row-amt accent">+{usd(250)}</span>
          <div className="lx-row-actions"><span className="lx-mini-btn dark">Accept</span><span className="lx-mini-btn">Decline</span></div>
        </div>
      </div>
      <div className="lx-card">
        <div className="lx-row">
          <span className="lx-row-who">After the deal</span>
          <span className="lx-row-what"><Stars count={5} /> Review pinned to your storefront</span>
        </div>
      </div>
    </Window>
  );
}
