// creatorAgreement.ts — the Creator Agreement, as data.
//
// WHY THIS FILE EXISTS
//
// The KYC checklist has always had a "Creator agreement" step whose CTA read
// "Review agreement". There was no agreement. A repo-wide search turned up no
// text, no modal, no route — the button fired a toast and the step flipped to
// "Signed via first accepted offer" as a side effect of an unrelated event.
// So the app claimed a creator had signed something that did not exist.
//
// The document lives here rather than inside the modal so there is exactly
// one copy of the words. A second surface (a public /creator-agreement route,
// a PDF export, an email) renders THIS, or it drifts — which is the failure
// mode this codebase has hit repeatedly.
//
// ── ON THE CONTENT ───────────────────────────────────────────────────────
// Written in the same register as `screens/legal/LegalPage.tsx`: plain
// language, and honest that beta payments are simulated. Every number here is
// imported from `lib/api/money.ts` rather than typed as a literal, so the
// agreement cannot promise a 10% fee while the release path takes something
// else. That has happened before in this codebase and it is the specific
// reason the constants are interpolated.
//
// NOT LEGAL ADVICE. This is a plain-language draft describing what the
// software actually does today. It has not been reviewed by a lawyer, and it
// should be before any real money moves through the platform.

import { PLATFORM_FEE, WHT } from '@/lib/api/money';

/** Bump when the wording changes materially. Acceptance records this, so a
 *  creator who accepted v1 can be asked to re-accept v2 rather than being
 *  silently held to terms they never saw. */
export const CREATOR_AGREEMENT_VERSION = '1.0';

export const CREATOR_AGREEMENT_LAST_UPDATED = '14 August 2026';

export const CREATOR_AGREEMENT_CONTACT = 'hello@alamut.co';

const pct = (n: number) => `${Math.round(n * 100)}%`;

export interface AgreementSection {
  heading: string;
  /** Each string is one paragraph. */
  body: string[];
}

export const CREATOR_AGREEMENT: AgreementSection[] = [
  {
    heading: 'What this covers',
    body: [
      'This agreement is between you (the creator) and Alamut. It covers how you take on paid work through the platform, how you get paid for it, and what rights a brand gets in the content you deliver.',
      'It applies to every collaboration you accept on Alamut. Each individual deal also has its own brief — the deliverables, the rate, and the deadline are agreed per deal, and those specifics always take precedence over the general terms here.',
    ],
  },
  {
    heading: 'Beta: payments are simulated',
    body: [
      'Alamut is in public beta. Wallet balances, escrow, fees, and payouts are simulated mechanics — no real money moves through the platform today, and a balance shown in your wallet is not a debt Alamut owes you.',
      'If you and a brand agree to transact for real money, you do that directly between yourselves, and this agreement does not govern that payment. We will tell you clearly, in advance, before any real payments are enabled — and you will be asked to accept an updated version of this agreement at that point.',
    ],
  },
  {
    heading: 'How a deal is formed',
    body: [
      'A deal starts when a brand sends you an offer and you accept it, or when you pitch and the brand accepts. Accepting an offer is what commits you — not applying, and not being invited.',
      'When you accept, the agreed amount is reserved in escrow against the brand’s wallet. Escrow is held per deal, at the moment of acceptance; a brand launching a campaign does not reserve anything by itself.',
      'You can decline any offer, for any reason, without giving one. You can also set a minimum rate and mark yourself unavailable, and brands will see both.',
    ],
  },
  {
    heading: 'Delivery and revisions',
    body: [
      'You submit content against the deliverables named in the brief. The brand reviews each deliverable and can approve it or request changes.',
      'Revisions are limited to what the brief specifies. If a brand asks for work materially beyond the agreed brief, that is a new deal at a new rate, and you are free to treat it as such.',
      'Once a deliverable is approved and you have posted it, you mark it live and add the public link. That link is how the brand verifies delivery.',
    ],
  },
  {
    heading: 'What you get paid, and what is deducted',
    body: [
      `Your agreed rate is the gross value of the deal. Two deductions come out of it: an Alamut platform fee of ${pct(PLATFORM_FEE)}, and withholding tax of ${pct(WHT)}.`,
      `On a $1,000 deal that means a $${Math.round(1000 * PLATFORM_FEE)} platform fee and $${Math.round(1000 * WHT)} withheld, leaving $${1000 - Math.round(1000 * PLATFORM_FEE) - Math.round(1000 * WHT)} in your wallet. Your ledger shows all three lines, so the figures always add up to your balance.`,
      'Funds are released to your wallet when the brand approves your content, not when you submit it. Multi-deliverable deals release proportionally, as each part is approved.',
      'Withholding is remitted on your behalf where we are required to do so. You remain responsible for your own income taxes, and the quarterly statements on your KYC page are provided for that purpose.',
    ],
  },
  {
    heading: 'Withdrawals',
    body: [
      'You can withdraw a cleared balance to a bank account once your identity is verified and an account is on file. Withdrawals carry no Alamut fee.',
      'Money inside an open dispute window is not withdrawable, and neither is anything covered by an open dispute. That is money that could still be reclaimed, and it is held rather than paid out and clawed back.',
    ],
  },
  {
    heading: 'Content rights',
    body: [
      'You own your content. You keep the copyright in everything you create, and you keep the right to show it in your own portfolio and storefront.',
      'By delivering content for an accepted deal, you grant the brand a licence to use that content for the purposes, channels, and duration named in the brief. If the brief does not name a duration, the licence lasts twelve months from the date the content goes live, on the channels the brief specifies.',
      'The brand does not get exclusivity unless the brief says so and you accepted it. A brand may not resell your content, sublicense it to another brand, or use it in paid advertising unless the brief provided for that.',
      'You are responsible for having the rights to what you deliver — including music, footage, and any other person appearing in it.',
    ],
  },
  {
    heading: 'Disclosure',
    body: [
      'Paid partnerships must be disclosed. You are required to label sponsored content clearly and in line with the advertising rules that apply where your audience is, regardless of whether the brief mentions it.',
      'A brand cannot ask you to conceal that a post is paid, and you should decline any brief that does.',
    ],
  },
  {
    heading: 'If something goes wrong',
    body: [
      'A brand can raise a dispute on a deliverable within the dispute window after approval. While a dispute is open, the funds involved are frozen — neither released nor refunded — until it is resolved.',
      'Disputes are reviewed by the Alamut team. We can release the funds to you, refund the brand, or split them. We will tell you what was decided and why.',
      'Either side can propose cancelling a deal before delivery. Cancellation needs both sides to agree, and escrow returns to the brand unless you have already delivered work covered by it.',
    ],
  },
  {
    heading: 'Your account',
    body: [
      'You must be old enough to enter a contract where you live, and the channels you connect must be yours.',
      'Do not misrepresent your audience. Buying followers or engagement, or misreporting your numbers to win a deal, is grounds for removal from the platform.',
      'You can close your account at any time. Deals already in flight still need to be completed or cancelled by agreement, and your ledger is retained for record-keeping.',
    ],
  },
  {
    heading: 'Changes to this agreement',
    body: [
      `We may update this agreement. If a change is material, you will be asked to accept the new version before you take on further work — we record which version you accepted (this is version ${CREATOR_AGREEMENT_VERSION}) rather than applying new terms retroactively.`,
      `Questions about any of this: ${CREATOR_AGREEMENT_CONTACT}.`,
    ],
  },
];

/** Plain-text rendering — for a copy-to-clipboard action, an email, or a
 *  future export. Keeps the one-copy rule intact. */
export function creatorAgreementAsText(): string {
  const header = [
    'ALAMUT CREATOR AGREEMENT',
    `Version ${CREATOR_AGREEMENT_VERSION} · Last updated ${CREATOR_AGREEMENT_LAST_UPDATED}`,
    '',
  ];
  const body = CREATOR_AGREEMENT.flatMap((s) => [
    s.heading.toUpperCase(),
    ...s.body,
    '',
  ]);
  return [...header, ...body].join('\n');
}
