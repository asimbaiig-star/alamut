// v2OutreachActions.ts — P6 §5.3 brand-side soft contact mutations.
//
// Pre-P6 the Spark `send` intent fired `v2SendOffer` with a
// placeholder rate, which created a real Offer the creator could
// only accept/decline/counter. That broke the soft-contact flow:
// the brand wasn't ready to commit to a rate, just to start a
// conversation.
//
// P6 introduces `Outreach` as a first-class entity. The brand sends
// a message; the creator can reply (engage), decline (not interested),
// or it can be archived. If the conversation goes well, the brand
// later sends a real Offer (`v2SendOffer`) referencing the outreach.
//
// Mutations:
//   v2SendOutreach({ campaignId?, creatorId, message, sentByUserId })
//   v2RespondOutreach(outreachId, decision: 'replied' | 'declined')
//   v2ArchiveOutreach(outreachId)
//
// Capability gates (P5 §4.1):
//   v2SendOutreach    → application.invite (brand-side admin/ops)
//   v2RespondOutreach → application.invite (creator)
//   v2ArchiveOutreach → application.invite (brand-side, can also be
//                       creator dismissing it from their inbox)

import { tx } from '@/lib/api/store';
import type { Outreach, OutreachStatus } from '@/lib/api/types';
import { requireCapability, getActorUserId } from '@/lib/permissions';
// Phase 9 — Supabase mirror.
import { isSupabaseConfigured } from '@/lib/supabase';

function newId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

/** Fire-and-forget mirror for a new Outreach INSERT. Silenced on FK
 *  (campaign tied to generated rows) + RLS. */
function mirrorOutreachInsertToSupabase(o: Outreach): void {
  if (!isSupabaseConfigured()) return;
  void (async () => {
    try {
      const { insertOutreachInSupabase } = await import('@/lib/data/outreachRepo');
      await insertOutreachInSupabase(o);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/foreign key|violates|row-level security|no rows|0 rows|not found/i.test(msg)) return;
      // eslint-disable-next-line no-console
      console.warn('[outreach insert mirror] failed:', msg);
    }
  })();
}

/** Fire-and-forget mirror for an Outreach UPDATE. */
function mirrorOutreachUpdateToSupabase(
  outreachId: string,
  patch: Parameters<typeof import('@/lib/data/outreachRepo').updateOutreachInSupabase>[1],
): void {
  if (!isSupabaseConfigured()) return;
  void (async () => {
    try {
      const { updateOutreachInSupabase } = await import('@/lib/data/outreachRepo');
      await updateOutreachInSupabase(outreachId, patch);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/row-level security|no rows|0 rows|not found/i.test(msg)) return;
      // eslint-disable-next-line no-console
      console.warn('[outreach update mirror] failed:', msg);
    }
  })();
}

/**
 * Brand sends an Outreach to a creator. Optional campaign tie —
 * Spark `send` typically picks a campaign, but a brand exploring
 * pre-launch can send without one.
 *
 * Notifies the creator with the message preview so the bell shows
 * the actual hook line, not just a generic "you have an outreach".
 */
export function v2SendOutreach(input: {
  campaignId: string | null;
  creatorId: string;
  message: string;
  sentByUserId: string;
}): Outreach | null {
  const result = tx((db) => {
    requireCapability(getActorUserId(), 'application.invite', db);

    const creator = db.creators.find((c) => c.id === input.creatorId);
    if (!creator) return null;
    const sender = db.users.find((u) => u.id === input.sentByUserId);
    if (!sender || !sender.brandId) return null;

    const outreach: Outreach = {
      id: newId('out'),
      campaignId: input.campaignId,
      brandId: sender.brandId,
      creatorId: input.creatorId,
      sentByUserId: input.sentByUserId,
      message: input.message,
      status: 'sent',
      sentAt: nowIso(),
    };
    db.outreach.push(outreach);

    // Notify the creator. Outreach goes through the same `bell` surface
    // as offers/applications/etc., distinguished by the `meta.campaignId`
    // (when set) and the lead-in copy.
    const creatorUser = db.users.find((u) => u.id === creator.userId);
    const brand = db.brands.find((b) => b.id === sender.brandId);
    if (creatorUser && brand) {
      const preview = input.message ? ` — "${input.message.slice(0, 80)}${input.message.length > 80 ? '…' : ''}"` : '';
      const campTitle = input.campaignId
        ? db.campaigns.find((c) => c.id === input.campaignId)?.title
        : null;
      const subject = campTitle ? `${campTitle}: ` : '';
      db.notifications.push({
        id: newId('n'),
        userId: creatorUser.id,
        text: `${subject}reach-out from ${brand.name}${preview}`,
        href: '/v2',
        at: nowIso(),
        read: false,
        meta: input.campaignId ? { campaignId: input.campaignId } : undefined,
      });
    }

    return outreach;
  });
  if (result) mirrorOutreachInsertToSupabase(result);
  return result;
}

/**
 * Creator responds to an Outreach: either engages (`replied` —
 * "let's talk") or declines (`declined` — not interested). On reply,
 * the brand should follow up with a real `v2SendOffer`; on decline,
 * the outreach is terminal.
 */
export function v2RespondOutreach(
  outreachId: string,
  decision: Extract<OutreachStatus, 'replied' | 'declined'>,
): Outreach | null {
  const result = tx((db) => {
    requireCapability(getActorUserId(), 'application.invite', db);

    const idx = db.outreach.findIndex((o) => o.id === outreachId);
    if (idx === -1) return null;
    const o = db.outreach[idx];
    if (o.status !== 'sent') return o; // only `sent` outreach can be responded to

    db.outreach[idx] = { ...o, status: decision, respondedAt: nowIso() };

    // Notify the brand sender + the campaign owner if different.
    const sender = db.users.find((u) => u.id === o.sentByUserId);
    const creator = db.creators.find((c) => c.id === o.creatorId);
    if (sender && creator) {
      const verbCopy = decision === 'replied' ? 'wants to talk' : 'isn\'t interested right now';
      db.notifications.push({
        id: newId('n'),
        userId: sender.id,
        text: `${creator.name} ${verbCopy}`,
        href: '/v2',
        at: nowIso(),
        read: false,
        meta: o.campaignId ? { campaignId: o.campaignId } : undefined,
      });
    }

    return db.outreach[idx];
  });
  if (result && (result.status === 'replied' || result.status === 'declined')) {
    mirrorOutreachUpdateToSupabase(outreachId, {
      status: result.status,
      respondedAt: result.respondedAt ?? null,
    });
  }
  return result;
}

/**
 * Either side archives a stale outreach. Doesn't notify — archiving
 * is a tidy-up action, not a conversational one. Idempotent on
 * already-archived rows.
 */
export function v2ArchiveOutreach(outreachId: string): Outreach {
  const result = tx((db) => {
    requireCapability(getActorUserId(), 'application.invite', db);

    const idx = db.outreach.findIndex((o) => o.id === outreachId);
    if (idx === -1) throw new Error("Couldn't find that outreach record — refresh and try again.");
    if (db.outreach[idx].status === 'archived') return db.outreach[idx]; // idempotent
    db.outreach[idx] = { ...db.outreach[idx], status: 'archived', respondedAt: nowIso() };
    return db.outreach[idx];
  });
  if (result.status === 'archived') {
    mirrorOutreachUpdateToSupabase(outreachId, {
      status: 'archived',
      respondedAt: result.respondedAt ?? null,
    });
  }
  return result;
}
