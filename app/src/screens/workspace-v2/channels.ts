// channels.ts — summaries of a creator's channels, safe when there are none.
//
// Creators enter their channels themselves, and a new account can have none.
// Once 038 made the public creator projection return real rows, Discover
// started rendering such accounts, and `channels.reduce(…, channels[0])`
// handed back `undefined`: every brand's Discover crashed on
// `topChannel.engagement`. Averages divided by `channels.length` showed NaN.
// Anything that summarises channels goes through here instead.

import type { V2Channel } from './data';

/** The channel with the most followers, or null when there are none. */
export function topChannel(channels: readonly V2Channel[]): V2Channel | null {
  if (channels.length === 0) return null;
  return channels.reduce((a, b) => (a.followers > b.followers ? a : b));
}

/** Engagement across channels, weighted by followers, or 0 when there are
 *  none. "Engagement" meant three things: a plain mean here (a newsletter's
 *  42% open rate counted as much as a 142K Instagram's 5.2%: 18.1%), the
 *  best single channel on Discover (42%), and a weighted mean on analytics
 *  (7.2%). It means this one everywhere now. */
export function avgEngagement(channels: readonly Pick<V2Channel, 'engagement' | 'followers'>[]): number {
  if (channels.length === 0) return 0;
  const followers = channels.reduce((s, ch) => s + ch.followers, 0);
  if (followers <= 0) return channels.reduce((s, ch) => s + ch.engagement, 0) / channels.length;
  return channels.reduce((s, ch) => s + ch.engagement * ch.followers, 0) / followers;
}

/** The highest engagement on any channel, or 0 when there are none. */
export function bestEngagement(channels: readonly V2Channel[]): number {
  return channels.reduce((m, ch) => Math.max(m, ch.engagement), 0);
}
