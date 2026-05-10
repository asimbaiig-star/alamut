// Campaign-roster deal row (Phase 27).
//
// Within a single campaign's roster, each row represents one creator's
// progression through the campaign lifecycle. Visually creator-centric
// (portrait + name lead), where Today's row was verb-led.
//
// Layout:
//
//   [portrait]  Sarah Chen — Approve $1,500
//               Round 2 · uploaded 4h ago                  [pill] →
//
// Optional inline action button right of the name (e.g. "Send offer"
// on shortlisted rows). The whole row is a Link to /deal/:id; the
// inline button stops propagation and dispatches its own handler.

import { Link } from 'react-router-dom';
import { Pill } from '@/components/ui/Pill';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { fmtMoneyFull } from '@/lib/utils/format';
import { dealStateLabel, dealStateTone } from '@/lib/utils/labels';
import type { Deal } from '@/lib/api/use-deal';

interface Props {
  deal: Deal;
  /** Optional inline action — renders a small button right of the name.
   *  Used for the "Send offer" shortcut on shortlisted rows; stops
   *  propagation so the row's link doesn't fire too. */
  inlineAction?: {
    label: string;
    onClick: () => void;
    icon?: React.ReactNode;
  };
}

export function RosterRow({ deal, inlineAction }: Props) {
  const moneyHalo = deal.escrowHeld > 0
    ? fmtMoneyFull(deal.escrowHeld)
    : deal.acceptedOffer
      ? fmtMoneyFull(deal.acceptedOffer.rate)
      : deal.offer
        ? fmtMoneyFull(deal.offer.rate)
        : null;

  // Verb takes the action.verb when present (already includes $);
  // otherwise we fall back to the state label.
  const verb = deal.action.verb || dealStateLabel(deal.state);

  // Subtitle: action.reason ("Round 2 · uploaded 4h ago") if any,
  // otherwise creator handle and tier.
  const subtitle = deal.action.reason
    ? deal.action.reason
    : `${deal.creator.handle} · ${deal.creator.tier}`;

  return (
    <Link to={`/deal/${deal.id}`} className="roster-row">
      <img
        className="roster-row-portrait"
        src={deal.creator.portrait}
        alt=""
        loading="lazy"
      />
      <div className="roster-row-body">
        <div className="roster-row-name-line">
          <span className="roster-row-name">{deal.creator.name}</span>
          {verb && <span className="roster-row-sep" aria-hidden="true">—</span>}
          <span className="roster-row-verb">{verb}</span>
          {inlineAction && (
            <Button
              size="sm"
              variant="ghost"
              icon={inlineAction.icon}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                inlineAction.onClick();
              }}
            >
              {inlineAction.label}
            </Button>
          )}
        </div>
        <div className="roster-row-sub">{subtitle}</div>
      </div>
      <div className="roster-row-meta">
        {moneyHalo && <span className="roster-row-money mono-meta">{moneyHalo}</span>}
        <Pill tone={dealStateTone(deal.state)}>{dealStateLabel(deal.state)}</Pill>
      </div>
      <div className="roster-row-cta" aria-hidden="true">
        <Icon.arrow s={14} />
      </div>
    </Link>
  );
}
