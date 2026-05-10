// deliverables.ts — runtime helpers for the structured Deliverable model.
//
// P1d §1.5/§1.6 — Campaign.deliverableIds points at structured Deliverable
// rows in db.deliverables. New campaigns (created via v2LaunchCampaign or
// the legacy NewCampaignModal) need to materialize those rows from the
// brand's free-form placement string at create-time, so submissions can
// attach via Submission.deliverableId without waiting for the next
// hydration pass.
//
// This module mirrors the parser + inference logic baked into
// migrator 4 (`migrations.ts:_legacyParseDeliverableSlots` +
// `inferPlatform` / `inferFormat`). The two stay in lockstep — when the
// rules change, both update. The migrator's copy is the bootstrap path;
// this is the runtime path.

import type {
  Database, Deliverable, DeliverablePlatform, DeliverableFormat,
} from './types';

export interface DeliverableSlotParse {
  index: number;
  label: string;
  type: string;
}

/** Parse a free-form deliverables string ("1 Reel + 3 Stories") into N
 *  per-deliverable slots. Mirror of migrator 4's `_legacyParseDeliverableSlots`. */
export function parseDeliverableSlotsFreeForm(
  s: string | undefined,
): DeliverableSlotParse[] {
  if (!s) return [{ index: 0, label: 'Deliverable', type: 'deliverable' }];
  const slots: DeliverableSlotParse[] = [];
  const segments = s.split(/\s*\+\s*|\s+and\s+/i);
  for (const raw of segments) {
    const seg = raw.trim();
    if (!seg) continue;

    // Same patterns as the original parser: "3 Stories", "Stories ×3",
    // "Stories x 3", "(3 episodes)".
    let count = 1;
    let label = seg;
    const leading = seg.match(/^(\d+)\s+(.+)$/);
    const trailing = seg.match(/^(.+?)\s*[×x]\s*(\d+)$/i);
    const parens = seg.match(/^(.+?)\s*\(\s*(\d+)\s+([a-z]+)s?\s*\)$/i);
    if (leading) { count = parseInt(leading[1], 10); label = leading[2].trim(); }
    else if (trailing) { count = parseInt(trailing[2], 10); label = trailing[1].trim(); }
    else if (parens) { count = parseInt(parens[2], 10); label = parens[1].trim() + ' ' + parens[3]; }

    count = Math.min(Math.max(count, 1), 10);

    const type = label.toLowerCase().split(/\s+/).slice(-1)[0] || 'deliverable';
    for (let i = 0; i < count; i++) {
      slots.push({
        index: slots.length,
        label: count > 1 ? `${label} ${i + 1}` : label,
        type,
      });
    }
  }
  if (slots.length === 0) {
    slots.push({ index: 0, label: 'Deliverable', type: 'deliverable' });
  }
  return slots;
}

/** Infer the platform from a slot label. Same heuristics as migrator 4. */
export function inferPlatformLocal(label: string): DeliverablePlatform {
  const l = label.toLowerCase();
  if (l.includes('tiktok') || l.includes('tik tok')) return 'tiktok';
  if (l.includes('youtube') || l.includes('yt ') || l.includes(' yt')) return 'youtube';
  if (l.includes('linkedin')) return 'linkedin';
  if (l.includes('newsletter') || l.includes('substack')) return 'newsletter';
  if (l.includes('podcast') || l.includes('episode')) return 'podcast';
  if (l.includes('twitter') || l.includes('thread') || l.startsWith('x ') || l === 'x') return 'x';
  if (l.includes('reel') || l.includes('story') || l.includes('insta') || l.includes('ig ')) return 'instagram';
  return 'instagram';
}

/** Infer the format from a slot label + last-token type. Same heuristics as migrator 4. */
export function inferFormatLocal(label: string, type: string): DeliverableFormat {
  const t = type.toLowerCase();
  const l = label.toLowerCase();
  if (t.includes('reel') || l.includes('reel')) return 'reel';
  if (t.includes('story') || l.includes('story') || l.includes('stories')) return 'story';
  if (t.includes('long') || l.includes('long')) return 'longform';
  if (t.includes('short') || l.includes('youtube short') || l.includes('yt short')) return 'short';
  if (t.includes('episode') || l.includes('episode')) return 'episode';
  if (t.includes('thread') || l.includes('thread')) return 'thread';
  if (t.includes('carousel') || l.includes('carousel')) return 'carousel';
  if (t.includes('live') || l.includes('live')) return 'live';
  return 'post';
}

/** Materialize Deliverable rows from a free-form placement string for a
 *  newly created campaign. Pushes rows into `db.deliverables` and returns
 *  the FK array to set on `Campaign.deliverableIds`. Use inside a `tx()`
 *  block right after the campaign is pushed. */
export function materializeDeliverablesForCampaign(
  campaignId: string,
  placementText: string,
  db: Database,
): string[] {
  const slots = parseDeliverableSlotsFreeForm(placementText);
  const ids: string[] = [];
  for (const slot of slots) {
    const id = `del_${campaignId}_${slot.index}`;
    if (db.deliverables.some((d) => d.id === id)) {
      ids.push(id);
      continue;
    }
    db.deliverables.push({
      id,
      campaignId,
      index: slot.index,
      platform: inferPlatformLocal(slot.label),
      format: inferFormatLocal(slot.label, slot.type),
      quantity: 1,
      dueOffsetDays: null,
      specs: null,
    } as Deliverable);
    ids.push(id);
  }
  return ids;
}
