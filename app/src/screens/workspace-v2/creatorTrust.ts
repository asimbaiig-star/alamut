// creatorTrust.ts — what a brand can judge a NEW creator on (T3.2).
//
// THE COLD-START PROBLEM
//
// Reviews only exist after a completed collab, so a creator who just joined
// has no track record. Discover used to paper over this by defaulting them
// to 4.5 stars → a confident "90" (fixed in T1.1, they now correctly read
// "New"). Honest — but it leaves a newcomer with nothing to offer a brand,
// and a brand with nothing to judge, so nobody takes the first chance and
// the marketplace can't bootstrap.
//
// THE APPROACH
//
// Score what is actually *checkable right now* — is their identity verified,
// is a channel verified, is the profile complete enough to brief against —
// and label it as exactly that. This is emphatically NOT a performance or
// quality score, and the UI must never imply it is. It answers a narrower,
// honest question: "has this person set themselves up to be hired, and have
// we confirmed who they are?"
//
// It's deliberately dual-purpose: the same list a brand reads as evidence is
// the checklist a creator reads as "what to do next", which is why each
// signal carries an actionable `todo`.

import type { Creator, Database } from '@/lib/api/types';

export interface TrustSignal {
  key: string;
  /** Shown to a brand as evidence. */
  label: string;
  /** Shown to the creator as the next action when unmet. */
  todo: string;
  met: boolean;
  /** Signals we've independently confirmed, vs. things the creator asserts.
   *  Worth distinguishing: self-reported facts are weaker evidence and the
   *  UI should be able to say so. */
  verifiedByUs: boolean;
}

export interface TrustProfile {
  signals: TrustSignal[];
  met: number;
  total: number;
  /** Of the met signals, how many did we actually verify ourselves. */
  verifiedCount: number;
  /** True once they have real completed work — at which point reviews and
   *  history are the better evidence and this matters much less. */
  hasTrackRecord: boolean;
}

export function computeTrustProfile(
  creator: Creator | null | undefined,
  db: Database,
): TrustProfile | null {
  if (!creator) return null;

  const completedCollabs = db.collaborations.filter(
    (c) => c.creatorId === creator.id && (c.stage === 'paid' || c.stage === 'live'),
  ).length;

  const channels = creator.platforms ?? [];
  const hasVerifiedChannel = channels.some((p) => p.verified);

  const signals: TrustSignal[] = [
    {
      key: 'identity',
      label: 'Identity verified',
      todo: 'Verify your identity in KYC & Tax',
      met: !!creator.verified || !!creator.kycVerifiedAt,
      verifiedByUs: true,
    },
    {
      key: 'channel-verified',
      label: 'Channel ownership confirmed',
      todo: 'Connect a platform to confirm you own the account',
      met: hasVerifiedChannel,
      verifiedByUs: true,
    },
    {
      key: 'channel',
      label: `${channels.length} channel${channels.length === 1 ? '' : 's'} listed`,
      todo: 'Add the platforms you publish on',
      met: channels.length > 0,
      // Follower/ER figures here are self-entered until platform OAuth
      // lands, so listing a channel is the creator's claim, not our check.
      verifiedByUs: false,
    },
    {
      key: 'brief-ready',
      label: 'Profile ready to brief against',
      todo: 'Add a bio and at least one category',
      met: !!creator.bio?.trim() && (creator.categories ?? []).length > 0,
      verifiedByUs: false,
    },
    {
      key: 'rates',
      label: 'Rates published',
      todo: 'Publish your rates so brands can send offers',
      met: !!(creator.rateCard?.post || creator.rateCard?.reel) ||
        (creator.rateCards ?? []).length > 0,
      verifiedByUs: false,
    },
    {
      key: 'portfolio',
      label: 'Portfolio samples',
      todo: 'Upload at least three samples of your work',
      met: (creator.work ?? []).length >= 3,
      verifiedByUs: false,
    },
    {
      key: 'track-record',
      label: completedCollabs > 0
        ? `${completedCollabs} completed collab${completedCollabs === 1 ? '' : 's'}`
        : 'Completed a collab on Alamut',
      todo: 'Complete your first collab to build a track record',
      met: completedCollabs > 0,
      verifiedByUs: true,
    },
  ];

  const metSignals = signals.filter((s) => s.met);
  return {
    signals,
    met: metSignals.length,
    total: signals.length,
    verifiedCount: metSignals.filter((s) => s.verifiedByUs).length,
    hasTrackRecord: completedCollabs > 0,
  };
}

/** One-line summary for a compact surface like a Discover card. Returns null
 *  when there's nothing worth saying (no signals met at all — better to show
 *  nothing than "0 of 7", which reads as a judgement on the person). */
export function trustSummary(profile: TrustProfile | null): string | null {
  if (!profile || profile.met === 0) return null;
  if (profile.hasTrackRecord) return null; // reviews/history tell it better
  const verified = profile.verifiedCount;
  return verified > 0
    ? `${profile.met}/${profile.total} profile checks · ${verified} verified by Alamut`
    : `${profile.met}/${profile.total} profile checks`;
}
