// Today — single deal row (Phase 26).
//
// One row = one deal needing action. Replaces the bucketed Today
// sections from Phase 4 with a verb-led card that links to /deal/:id.
// Layout per the design pass:
//
//   [icon]  VERB-LED TITLE
//           Counterparty · Campaign · why-now reason
//                                                  [Open deal →]
//
// Visual treatment varies by urgency band:
//   - 🔥 critical (offer about to expire, dispute, hard deadline today)
//   - ⚠️  high (self-blocked > 24h, SLA at risk)
//   - 📄 medium (self-blocked, recent)
//   - 💬 low (other-blocked / passive — used in the recent-activity tail)

import { Link } from 'react-router-dom';
import { Pill } from '@/components/ui/Pill';
import { Icon } from '@/components/ui/Icon';
import { fmtMoneyFull } from '@/lib/utils/format';
import { dealStateLabel, dealStateTone } from '@/lib/utils/labels';
import type { Deal } from '@/lib/api/use-deal';
import type { Role } from '@/lib/utils/deal-action';

interface Props {
  deal: Deal;
  role: Role;
}

/** Urgency icon based on the action's score band. */
function urgencyIcon(urgency: number): string {
  if (urgency >= 800) return '🔥';
  if (urgency >= 400) return '⚠️';
  if (urgency >= 100) return '📄';
  return '💬';
}

/** Title-line verb. The deal's `action.verb` already has $ baked in
 *  ("Approve $1,500"); we use it as-is when present, otherwise fall
 *  back to the state's friendly label. */
function rowVerb(deal: Deal, role: Role): string {
  if (deal.action.verb) return deal.action.verb;
  // Passive states: lead with the counterparty's status.
  if (deal.state === 'in-review' && role === 'creator') return 'Brand reviewing your work';
  if (deal.state === 'accepted-production' && role === 'brand') return 'Creator producing the work';
  return dealStateLabel(deal.state);
}

/** Subtitle: who's on the other side · campaign · reason. */
function rowSubtitle(deal: Deal, role: Role): string {
  const other = role === 'creator' ? deal.brand.name : deal.creator.name;
  const parts = [other, deal.campaign.title];
  if (deal.action.reason) parts.push(deal.action.reason);
  return parts.join(' · ');
}

export function TodayDealRow({ deal, role }: Props) {
  const icon = urgencyIcon(deal.action.urgency);
  const verb = rowVerb(deal, role);
  const subtitle = rowSubtitle(deal, role);

  // Money halo — when there's a release-amount or escrow at stake,
  // surface it on the right rail of the row (small, monochrome).
  const moneyHalo = deal.escrowHeld > 0
    ? fmtMoneyFull(deal.escrowHeld)
    : deal.acceptedOffer
      ? fmtMoneyFull(deal.acceptedOffer.rate)
      : deal.offer
        ? fmtMoneyFull(deal.offer.rate)
        : null;

  return (
    <Link to={`/deal/${deal.id}`} className="today-row">
      <div className="today-row-icon" aria-hidden="true">{icon}</div>
      <div className="today-row-body">
        <div className="today-row-verb">{verb}</div>
        <div className="today-row-sub">{subtitle}</div>
      </div>
      <div className="today-row-meta">
        {moneyHalo && <span className="today-row-money mono-meta">{moneyHalo}</span>}
        <Pill tone={dealStateTone(deal.state)}>{dealStateLabel(deal.state)}</Pill>
      </div>
      <div className="today-row-cta">
        <Icon.arrow s={14} />
      </div>
    </Link>
  );
}
