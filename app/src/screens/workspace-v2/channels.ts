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

/** Mean engagement across channels, or 0 when there are none. */
export function avgEngagement(channels: readonly V2Channel[]): number {
  if (channels.length === 0) return 0;
  return channels.reduce((s, ch) => s + ch.engagement, 0) / channels.length;
}

/** The highest engagement on any channel, or 0 when there are none. */
export function bestEngagement(channels: readonly V2Channel[]): number {
  return channels.reduce((m, ch) => Math.max(m, ch.engagement), 0);
}
