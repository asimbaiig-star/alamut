// cards-creators.tsx — the creator page's workspace screen: one deal, from a
// price on the storefront to the review (see productCards.tsx). One row per
// step of the story on the page.

import { Stamp } from './components';
import { usd } from './estimate';
import { BRIEFS } from './listings-briefs';
import type { WorkspaceScreen } from './productCards';
import { PlatMark } from './tools-shared';

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

export const CREATOR_DEAL: WorkspaceScreen = {
  nav: ['Home', 'My storefront', 'My collaborations', 'Browse campaigns', 'Inbox', 'Calendar', 'Wallet'],
  active: 'My collaborations',
  crumb: `My collaborations · ${BRIEFS[0]!.brand}`,
  title: 'Skincare launch',
  rows: [
    <div className="lx-row" key="storefront">
      <span className="lx-row-who">On your storefront</span>
      <span className="lx-row-what lx-plat"><PlatMark of="Instagram" />Instagram Reel</span>
      <span className="lx-money lx-row-amt">{usd(900)}</span>
    </div>,
    <div className="lx-row" key="agreed">
      <span className="lx-row-who">The brand offered {usd(1500)}. You countered at your Reel rate <span className="lx-pill moss lx-no-stamp">Agreed</span></span>
      <span className="lx-row-what">2 × Reel at {usd(900)}</span>
      <span className="lx-money lx-row-amt">{usd(1800)}</span>
      <Stamp>Agreed</Stamp>
    </div>,
    <div className="lx-row" key="change">
      <span className="lx-row-who">The brand proposed a paid change</span>
      <span className="lx-row-what">Add 1 Story</span>
      <span className="lx-money lx-row-amt accent">+{usd(250)}</span>
      <div className="lx-row-actions">
        <span className="lx-mini-btn dark lx-if-open">Accept</span><span className="lx-mini-btn lx-if-open">Decline</span>
        <span className="lx-sr lx-if-done">Accepted</span>
      </div>
      <Stamp tone="accent">Accepted</Stamp>
    </div>,
    <div className="lx-row" key="held">
      <span className="lx-row-who">Held since the brand accepted</span>
      <span className="lx-row-what">Released as each post goes live</span>
      <span className="lx-money lx-row-amt">{usd(2050)}</span>
    </div>,
    <div className="lx-row" key="review">
      <span className="lx-row-who">After the deal</span>
      <span className="lx-row-what"><Stars count={5} /> Review pinned to your storefront</span>
      <Stamp>Pinned</Stamp>
    </div>,
  ],
};
