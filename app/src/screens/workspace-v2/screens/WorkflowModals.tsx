// WorkflowModals.tsx — small focused modals for campaign workflow
//
// SendOfferModal · CounterOfferModal · MarkLiveModal
//
// Each takes a target (campaign+creator or submission), captures the
// minimal input needed to drive the corresponding mutation, and closes
// itself after the mutation runs. They share `.v2-modal-overlay` from
// the workflow stylesheet for a consistent feel.

import { useMemo, useState } from 'react';
import { fmtUSD, Icon } from '../lib';
import { netOf } from '@/lib/api/money';
import { activeDealCount, availabilityVerdict } from '@/lib/api/availability';
import { parseNumberInput } from '@/lib/utils/format';
import {
  v2CounterOffer, v2CounterCounter, v2DeclineOffer, v2MarkContentLive,
  v2SendOffer, v2SetSubmissionPermalink,
} from '../v2CampaignActions';
import { v2InviteCreator } from '../v2CollabActions';
import {
  useV2Creators, useV2CurrentBrand, useV2OfferTemplates,
  v2SaveOfferTemplate, v2DeleteOfferTemplate,
} from '../v2Hooks';
import { useStore } from '@/lib/api/store';
import { pushToast } from '@/lib/utils/toast';
import { useModalEscape } from '@/lib/utils/useModalEscape';
import type { V2Creator } from '../data';
// P7 — UI gating for brand-side actions. The mutations themselves
// throw via P5's `requireCapability`; this layer turns that into a
// disabled-button + tooltip so users see permissions exist.
import { useCapability } from '@/lib/permissions';

// =====================================================================
// SendOfferModal
// =====================================================================

interface SendOfferProps {
  campaignId: string;
  creator: V2Creator;
  defaultRate: number;
  onClose: () => void;
}

export function SendOfferModal({ campaignId, creator, defaultRate, onClose }: SendOfferProps) {
  useModalEscape(onClose);
  const db = useStore((s) => s.db);
  const [rate, setRate] = useState<number>(defaultRate);
  const [message, setMessage] = useState<string>(
    `Hi ${creator.name.split(' ')[0]} — we'd love to work with you. Offering $${defaultRate.toLocaleString()} for the brief — let me know if you'd like to discuss.`,
  );
  // Creator-side guardrails. This used to be three ad-hoc booleans that only
  // ever warned — including for `vacationMode`, which the creator set to mean
  // "don't send me work". The verdict is now the same function the mutation
  // enforces, so the button state and the thrown error cannot disagree about
  // whether a send is allowed or why.
  // C4 — the capacity count comes from the same helper the mutation uses,
  // so the disabled button and the thrown error cannot disagree.
  const verdict = availabilityVerdict(creator, {
    rate,
    activeDeals: activeDealCount(db, creator.id),
  });
  const onVacation = !!creator.availability?.vacationMode;
  const minRate = creator.availability?.minRate;
  const isBelowFloor = minRate !== undefined && rate > 0 && rate < minRate;
  const canSend = useCapability('offer.send');

  // Phase 50 — saved offer templates (per brand). Pick fills the form;
  // "Save as template" snapshots the current draft for next time.
  const templates = useV2OfferTemplates();
  const [showTemplateMenu, setShowTemplateMenu] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');

  function applyTemplate(id: string) {
    const tpl = templates.find((t) => t.id === id);
    if (!tpl) return;
    setRate(tpl.rate);
    setMessage(
      tpl.message.replace('{firstName}', creator.name.split(' ')[0]),
    );
    setShowTemplateMenu(false);
  }
  function commitNewTemplate() {
    const name = newTemplateName.trim();
    if (!name) return;
    const saved = v2SaveOfferTemplate({ name, rate, message });
    if (saved) pushToast(`Template "${name}" saved`, 'good');
    setSavingTemplate(false);
    setNewTemplateName('');
  }
  return (
    <div className="v2-modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className="v2-card v2-upload-modal"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 540 }}
      >
        <header className="v2-upload-modal-head">
          <div className="v2-row" style={{ gap: 12, alignItems: 'center' }}>
            <div
              className="v2-avatar v2-avatar-md"
              style={{ backgroundImage: `url(${creator.avatar})` }}
              aria-hidden="true"
            />
            <div>
              <h2 style={{
                fontFamily: 'var(--v2-font-display)',
                fontSize: 20, fontWeight: 500, margin: 0, letterSpacing: '-0.02em',
              }}>Send offer</h2>
              <div className="v2-muted" style={{ fontSize: 12.5 }}>
                {creator.name} · {creator.priceTier} tier · listed at {fmtUSD(creator.rate)}
              </div>
            </div>
          </div>
        </header>
        <div className="v2-upload-modal-body">
          {onVacation && (
            <div style={{
              marginBottom: 14,
              padding: '8px 10px',
              background: 'rgba(184, 144, 47, 0.08)',
              borderRadius: 6,
              border: '1px solid var(--v2-gold)',
              fontSize: 12,
              color: 'var(--v2-ink-2)',
              lineHeight: 1.45,
            }}>
              <strong style={{ color: 'var(--v2-gold)' }}>✈ {creator.name.split(' ')[0]} is away</strong> — they've turned off incoming briefs, so this can't be sent yet. The date they're back is on their profile.
            </div>
          )}
          {/* Any other standing instruction that blocks — today that means an
              auto-declined category. Same verdict the mutation enforces. */}
          {verdict.block && !onVacation && (
            <div style={{
              marginBottom: 14, padding: '8px 10px',
              background: 'rgba(184, 144, 47, 0.08)', borderRadius: 6,
              border: '1px solid var(--v2-gold)', fontSize: 12,
              color: 'var(--v2-ink-2)', lineHeight: 1.45,
            }}>
              {verdict.block}
            </div>
          )}
          {/* Phase 50 — Templates row */}
          <div style={{ marginBottom: 14, position: 'relative' }}>
            <div className="v2-row" style={{ justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <span className="v2-eyebrow">Templates</span>
              <div className="v2-row" style={{ gap: 6 }}>
                {templates.length > 0 && (
                  <button
                    type="button"
                    className="v2-btn v2-btn-sm v2-btn-ghost"
                    onClick={() => setShowTemplateMenu((v) => !v)}
                  >
                    {showTemplateMenu ? 'Close' : `Pick (${templates.length})`}
                  </button>
                )}
                <button
                  type="button"
                  className="v2-btn v2-btn-sm v2-btn-ghost"
                  onClick={() => setSavingTemplate((v) => !v)}
                  disabled={rate <= 0 || !message.trim()}
                  title={rate <= 0 || !message.trim() ? 'Fill rate + message first' : 'Save current draft as a reusable template'}
                >
                  {savingTemplate ? 'Cancel save' : 'Save as template'}
                </button>
              </div>
            </div>
            {savingTemplate && (
              <div className="v2-row" style={{ gap: 8, marginTop: 8 }}>
                <input
                  className="v2-input"
                  style={{ flex: 1 }}
                  placeholder='Template name (e.g. "Beauty starter · $1.5K")'
                  value={newTemplateName}
                  onChange={(e) => setNewTemplateName(e.target.value)}
                  autoFocus
                />
                <button
                  type="button"
                  className="v2-btn v2-btn-sm v2-btn-primary"
                  onClick={commitNewTemplate}
                  disabled={!newTemplateName.trim()}
                >
                  Save
                </button>
              </div>
            )}
            {showTemplateMenu && templates.length > 0 && (
              <div
                className="v2-card"
                style={{
                  position: 'absolute', right: 0, top: '100%', marginTop: 4,
                  zIndex: 10, minWidth: 280, maxHeight: 240, overflowY: 'auto',
                  padding: 4, boxShadow: '0 6px 24px rgba(0,0,0,0.12)',
                }}
              >
                {templates.map((t) => (
                  <div
                    key={t.id}
                    className="v2-row"
                    style={{ justifyContent: 'space-between', padding: '8px 10px', borderRadius: 4, gap: 8 }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--v2-bg-2)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = '')}
                  >
                    <button
                      type="button"
                      onClick={() => applyTemplate(t.id)}
                      style={{
                        flex: 1, textAlign: 'left', background: 'transparent',
                        border: 0, cursor: 'pointer', padding: 0,
                      }}
                    >
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{t.name}</div>
                      <div className="v2-muted" style={{ fontSize: 11.5 }}>
                        {fmtUSD(t.rate)} · {t.message.slice(0, 60)}{t.message.length > 60 ? '…' : ''}
                      </div>
                    </button>
                    <button
                      type="button"
                      className="v2-icon-btn"
                      onClick={() => { v2DeleteOfferTemplate(t.id); }}
                      style={{ width: 24, height: 24, fontSize: 13, color: 'var(--v2-ink-3)' }}
                      aria-label={`Delete template ${t.name}`}
                      title="Delete template"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div style={{ marginBottom: 18 }}>
            <label className="v2-eyebrow" htmlFor="v2-offer-rate" style={{ display: 'block', marginBottom: 6 }}>Rate (USD)</label>
            <div className="v2-onboarding-rate">
              <span className="v2-onboarding-rate-prefix">$</span>
              <input
                id="v2-offer-rate"
                type="number"
                value={rate}
                onChange={(e) => setRate(parseNumberInput(e.target.value, { min: 0 }))}
              />
            </div>
            {minRate !== undefined && (
              <div className="v2-muted" style={{ fontSize: 11.5, marginTop: 6 }}>
                Creator's listed floor: {fmtUSD(minRate)}
              </div>
            )}
            {rate <= 0 && (
              <div style={{
                marginTop: 8,
                padding: '8px 10px',
                background: 'rgba(206, 90, 70, 0.08)',
                borderRadius: 6,
                border: '1px solid var(--v2-accent)',
                fontSize: 12,
                color: 'var(--v2-accent)',
                lineHeight: 1.45,
              }}>
                Enter a positive rate to send the offer.
              </div>
            )}
            {isBelowFloor && (
              <div style={{
                marginTop: 8,
                padding: '8px 10px',
                background: 'rgba(184, 144, 47, 0.08)',
                borderRadius: 6,
                border: '1px solid var(--v2-gold)',
                fontSize: 12,
                color: 'var(--v2-ink-2)',
                lineHeight: 1.45,
              }}>
                <strong style={{ color: 'var(--v2-gold)' }}>Below {creator.name.split(' ')[0]}'s floor</strong> — they typically don't accept under {fmtUSD(minRate!)}. You can still send; expect a counter or pass.
              </div>
            )}
          </div>
          <div style={{ marginBottom: 8 }}>
            <label className="v2-eyebrow" style={{ display: 'block', marginBottom: 6 }}>Message</label>
            <textarea
              className="v2-input"
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </div>
          <div className="v2-muted" style={{ fontSize: 11.5 }}>
            Funds reserve to escrow only when {creator.name.split(' ')[0]} accepts. Their net is{' '}
            <strong>{fmtUSD(netOf(rate))}</strong> after platform fee + WHT.
          </div>
        </div>
        <footer className="v2-upload-modal-foot">
          <div className="v2-row" style={{ gap: 8 }}>
            <button className="v2-btn v2-btn-outline" type="button" style={{ flex: 1 }} onClick={onClose}>
              Cancel
            </button>
            <button
              className="v2-btn v2-btn-primary"
              type="button"
              style={{ flex: 2 }}
              disabled={rate <= 0 || !message.trim() || !canSend || !!verdict.block}
              title={!canSend ? 'Admin or ops only' : (verdict.block ?? undefined)}
              onClick={() => {
                try {
                  v2SendOffer(campaignId, creator.id, rate, message);
                  pushToast(`Offer sent to ${creator.name.split(' ')[0]} at ${fmtUSD(rate)}`, 'good');
                  onClose();
                } catch (err) {
                  pushToast(err instanceof Error ? err.message : 'Send-offer failed', 'bad');
                }
              }}
            >
              {Icon.send} {canSend ? `Send offer (${fmtUSD(rate)})` : 'Admin/ops only'}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

// =====================================================================
// CounterOfferModal — creator counters a brand's offer
// =====================================================================

interface CounterOfferProps {
  offerId: string;
  /** The party we're countering — for the header copy ("Brand offered…" /
   *  "Sarah countered with…"). Doesn't drive the mutation; that comes
   *  from `side` below. Optional because legacy call sites pass
   *  `brandName` instead — see backwards-compat in the body. */
  counterpartyName?: string;
  /** The latest round's rate — what the OTHER side proposed, which we
   *  are now responding to. Default counter starts ~10% above for
   *  creator-side and ~10% below for brand-side. */
  currentRate: number;
  /** Which side is firing the modal. Decides which mutation is called:
   *    creator → v2CounterOffer (counter the brand's most recent round)
   *    brand   → v2CounterCounter (counter the creator's counter)
   *  Both surface the same 3-control footer (Decline / Send counter).
   *  Pre-fix this modal only supported the creator path, which is why
   *  the brand had no way to respond to a counter from the kanban. */
  side?: 'creator' | 'brand';
  onClose: () => void;
}

/** Backwards-compat: older call sites pass `brandName` instead of
 *  `counterpartyName`. Accept either. */
export function CounterOfferModal(
  props: CounterOfferProps & { brandName?: string },
) {
  const {
    offerId, currentRate, onClose, side = 'creator',
    counterpartyName, brandName,
  } = props;
  useModalEscape(onClose);
  const otherName = counterpartyName ?? brandName ?? 'The other side';
  // A3 — what is being proposed besides the price. Optional, because most
  // counters really are just about the number.
  const [scope, setScope] = useState('');
  const [deliverBy, setDeliverBy] = useState('');

  // Default counter direction depends on side: creators counter UP
  // (~10% above the brand's last offer); brands counter DOWN
  // (~10% below the creator's counter).
  const defaultMultiplier = side === 'brand' ? 0.9 : 1.1;
  const [rate, setRate] = useState<number>(Math.round(currentRate * defaultMultiplier));
  const [message, setMessage] = useState<string>(
    side === 'brand'
      ? `Thanks for countering. Given our budget, can we meet at $${Math.round(currentRate * defaultMultiplier).toLocaleString()}?`
      : `Thanks for the offer! Given the scope, would $${Math.round(currentRate * defaultMultiplier).toLocaleString()} work? Happy to discuss.`,
  );

  return (
    <div className="v2-modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className="v2-card v2-upload-modal"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 540 }}
      >
        <header className="v2-upload-modal-head">
          <h2 style={{
            fontFamily: 'var(--v2-font-display)',
            fontSize: 20, fontWeight: 500, margin: 0, letterSpacing: '-0.02em',
          }}>Counter offer</h2>
          <div className="v2-muted" style={{ fontSize: 12.5 }}>
            {side === 'brand'
              ? <>{otherName} countered with <strong>{fmtUSD(currentRate)}</strong>. Counter back with your rate.</>
              : <>{otherName} offered <strong>{fmtUSD(currentRate)}</strong>. Counter with your rate.</>}
          </div>
        </header>
        <div className="v2-upload-modal-body">
          <div style={{ marginBottom: 18 }}>
            <label className="v2-eyebrow" htmlFor="v2-counter-rate" style={{ display: 'block', marginBottom: 6 }}>Your counter (USD)</label>
            <div className="v2-onboarding-rate">
              <span className="v2-onboarding-rate-prefix">$</span>
              <input
                id="v2-counter-rate"
                type="number"
                value={rate}
                onChange={(e) => setRate(parseNumberInput(e.target.value, { min: 0 }))}
              />
            </div>
            {(() => {
              // Delta-vs-current hint. Pre-fix the counter input showed
              // only the absolute number; a creator typing $1M on a $500
              // offer had no visual signal that the counter was extreme.
              // Now we show "+ N%" or "− N%" so both sides can sanity-
              // check before sending.
              const pct = currentRate > 0
                ? Math.round(((rate - currentRate) / currentRate) * 100)
                : 0;
              const extreme = currentRate > 0 && rate > currentRate * 10;
              const direction = pct > 0 ? `+${pct}%` : pct < 0 ? `${pct}%` : '0%';
              const color = extreme
                ? 'var(--v2-accent)'
                : Math.abs(pct) > 100
                  ? 'var(--v2-gold)'
                  : 'var(--v2-ink-3)';
              return (
                <div style={{ fontSize: 11.5, marginTop: 6, color }}>
                  <strong>{direction}</strong> vs {fmtUSD(currentRate)}{' '}
                  {extreme && '· over 10× — rejected on submit'}
                </div>
              );
            })()}
            {side === 'creator' && (
              <div className="v2-muted" style={{ fontSize: 11.5, marginTop: 4 }}>
                Net to you after fees: <strong>{fmtUSD(netOf(rate))}</strong>
              </div>
            )}
            {side === 'brand' && (
              <div className="v2-muted" style={{ fontSize: 11.5, marginTop: 4 }}>
                Escrow held on accept: <strong>{fmtUSD(rate)}</strong>
              </div>
            )}
          </div>
          <div>
            <label className="v2-eyebrow" style={{ display: 'block', marginBottom: 6 }}>Message</label>
            <textarea
              className="v2-input"
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </div>
          {/* A3 — scope and timing, alongside the price.
              Negotiation used to be rate-only, so a creator who thought the
              brief was two Reels rather than one countered higher and hoped
              the brand inferred why. The 10× sanity bound in v2CounterOffer
              even calls those "scope-correction counters" — the model
              admitting scope was being argued through a field that cannot
              say it. */}
          <div style={{ marginTop: 14, display: 'grid', gap: 10 }}>
            <div>
              <label className="v2-eyebrow" htmlFor="v2-counter-scope" style={{ display: 'block', marginBottom: 6 }}>
                Scope you're proposing (optional)
              </label>
              <input
                id="v2-counter-scope"
                className="v2-input"
                value={scope}
                onChange={(e) => setScope(e.target.value)}
                placeholder="e.g., 1 Reel + 2 Stories, one round of revisions"
                style={{ width: '100%' }}
              />
            </div>
            <div>
              <label className="v2-eyebrow" htmlFor="v2-counter-by" style={{ display: 'block', marginBottom: 6 }}>
                Deliver by (optional)
              </label>
              <input
                id="v2-counter-by"
                className="v2-input"
                type="date"
                value={deliverBy}
                onChange={(e) => setDeliverBy(e.target.value)}
                style={{ width: '100%' }}
              />
            </div>
            <div className="v2-muted" style={{ fontSize: 11.5 }}>
              Leave either blank to keep what was last proposed. Both are
              recorded on the negotiation transcript.
            </div>
          </div>
        </div>
        <footer className="v2-upload-modal-foot">
          <div className="v2-row" style={{ gap: 8 }}>
            <button
              className="v2-btn v2-btn-outline"
              type="button"
              style={{ flex: 1 }}
              onClick={() => {
                try {
                  v2DeclineOffer(offerId, message || 'Pass for now.');
                  pushToast('Offer declined — the brand was notified', 'good');
                  onClose();
                } catch (err) {
                  pushToast(err instanceof Error ? err.message : 'Decline failed', 'bad');
                }
              }}
            >
              Decline instead
            </button>
            <button
              className="v2-btn v2-btn-primary"
              type="button"
              style={{ flex: 2 }}
              disabled={rate <= 0 || (currentRate > 0 && rate > currentRate * 10)}
              onClick={() => {
                try {
                  const terms = { scope: scope.trim() || null, deliverBy: deliverBy || null };
                  if (side === 'brand') v2CounterCounter(offerId, rate, message, terms);
                  else v2CounterOffer(offerId, rate, message, terms);
                  pushToast(`Counter sent at ${fmtUSD(rate)}`, 'good');
                  onClose();
                } catch (err) {
                  pushToast(err instanceof Error ? err.message : 'Counter failed', 'bad');
                }
              }}
            >
              {Icon.send} Send counter ({fmtUSD(rate)})
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

// =====================================================================
// MarkLiveModal — brand pastes the live URL after content goes up
// =====================================================================

interface MarkLiveProps {
  submissionId: string;
  campaignName: string;
  onClose: () => void;
  /** Pre-fill from a creator-attached permalink. The creator-side
   *  CollabDetail editor (s18) lets creators paste the live URL on their
   *  own approved submissions; if they have, we surface it here so the
   *  brand doesn't retype. */
  initialPermalink?: string;
}

export function MarkLiveModal({ submissionId, campaignName, onClose, initialPermalink }: MarkLiveProps) {
  useModalEscape(onClose);
  // P3 §2.2 — creator-only Mark Live. The creator owns the URL field;
  // they paste it via the deliverable's inline editor (which calls
  // `v2SetSubmissionPermalink`). The brand sees the URL here and just
  // confirms it's right. If `initialPermalink` is empty, the brand
  // hasn't been given a URL yet and the action is gated.
  const hasPermalink = !!initialPermalink && initialPermalink.trim() !== '';
  // P5 — `content.markLive` is brand admin/ops only. Finance + viewer
  // members of the brand team see the modal but cannot confirm.
  const canMarkLive = useCapability('content.markLive');
  return (
    <div className="v2-modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className="v2-card v2-upload-modal"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 520 }}
      >
        <header className="v2-upload-modal-head">
          <h2 style={{
            fontFamily: 'var(--v2-font-display)',
            fontSize: 20, fontWeight: 500, margin: 0, letterSpacing: '-0.02em',
          }}>{hasPermalink ? 'Confirm content is live' : 'Awaiting live URL'}</h2>
          <div className="v2-muted" style={{ fontSize: 12.5 }}>
            {hasPermalink
              ? `Confirm the post is live at this URL — used for tracking on ${campaignName}.`
              : `${campaignName}: the creator hasn't pasted the live URL yet. Once they do, this becomes confirm-only.`}
          </div>
        </header>
        <div className="v2-upload-modal-body">
          <label className="v2-eyebrow" style={{ display: 'block', marginBottom: 6 }}>Live URL</label>
          {hasPermalink ? (
            <div
              className="v2-input"
              style={{
                background: 'var(--v2-paper)',
                cursor: 'default',
                userSelect: 'text',
                wordBreak: 'break-all',
              }}
            >
              {initialPermalink}
            </div>
          ) : (
            <div
              className="v2-input"
              style={{
                background: 'var(--v2-paper)',
                color: 'var(--v2-ink-2)',
                fontStyle: 'italic',
              }}
            >
              Awaiting URL from creator…
            </div>
          )}
          <div className="v2-muted" style={{ fontSize: 11.5, marginTop: 8 }}>
            {hasPermalink
              ? "We'll start tracking impressions, engagement, and CPM from this URL."
              : 'The creator pastes the URL via the deliverable inline editor on their side. You\'ll be notified when they do.'}
          </div>
        </div>
        <footer className="v2-upload-modal-foot">
          <div className="v2-row" style={{ gap: 8 }}>
            <button className="v2-btn v2-btn-outline" type="button" style={{ flex: 1 }} onClick={onClose}>
              {hasPermalink ? 'Cancel' : 'Close'}
            </button>
            <button
              className="v2-btn v2-btn-primary"
              type="button"
              style={{ flex: 2 }}
              disabled={!hasPermalink || !canMarkLive}
              title={!canMarkLive ? 'Confirming live requires admin or ops role' : undefined}
              onClick={() => {
                try {
                  v2MarkContentLive(submissionId);
                  // P67 — honest copy: the payout already released at
                  // approve-time; confirming live just starts tracking.
                  pushToast('Marked live — performance tracking starts now', 'good');
                  onClose();
                } catch (err) {
                  pushToast(err instanceof Error ? err.message : 'Mark-live failed', 'bad');
                }
              }}
            >
              {Icon.check} {!canMarkLive ? 'Admin/ops only' : (hasPermalink ? 'Confirm live' : 'Awaiting URL')}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

// =====================================================================
// InviteCreatorsModal — brand-side multi-select creator picker
// =====================================================================
//
// Replaces the old "Add creators" behaviour where the brand was kicked
// out to /discover. Now they pick creators in-place from a searchable
// multi-select and fire `v2InviteCreator` for each, which seeds a
// Collaboration in `invited` stage. The creator gets an inbox
// notification and can accept (auto-fires v2SendOffer) or pass.

interface InviteCreatorsProps {
  campaignId: string;
  /** Creator IDs already engaged on this campaign, mapped to WHY. Shown
   *  as disabled rows carrying the reason rather than omitted.
   *
   *  Pre-fix they were filtered out silently, which reads as a bug: on a
   *  seeded Aesop campaign Sarah Johnson is in flight on 25 of 28
   *  campaigns, so a brand searching for a creator they know exists found
   *  nothing and concluded the picker was broken. Hiding the row hid the
   *  explanation with it. */
  inFlightReasons: Record<string, string>;
  campaignTitle: string;
  onClose: () => void;
}

export function InviteCreatorsModal({
  campaignId, inFlightReasons, campaignTitle, onClose,
}: InviteCreatorsProps) {
  useModalEscape(onClose);
  const allCreators = useV2Creators();
  const session = useStore((s) => s.session);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState(
    `We'd love to have you on "${campaignTitle}". Take a look and let us know if it's a fit.`,
  );
  const [sending, setSending] = useState(false);
  const canInvite = useCapability('application.invite');

  const { candidates, matchTotal } = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matched = allCreators.filter((c) => {
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        c.handle.toLowerCase().includes(q) ||
        (c.categories ?? []).some((cat) => cat.toLowerCase().includes(q))
      );
    });
    // Natural order is kept deliberately. Sorting in-flight creators to the
    // bottom seemed tidier, but combined with the 50-row cap it pushed them
    // off the end — so the creator a brand was hunting for was invisible
    // AGAIN, just for a different reason. Their real position (named demo
    // creators first) is what makes them findable, and the disabled row
    // carries the explanation.
    return { candidates: matched.slice(0, 50), matchTotal: matched.length };
  }, [allCreators, inFlightReasons, query]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const onSend = () => {
    if (!session?.userId || selected.size === 0) return;
    setSending(true);
    let ok = 0;
    const failures: string[] = [];
    for (const creatorId of selected) {
      try {
        v2InviteCreator(campaignId, creatorId, message, session.userId);
        ok++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        if (!failures.includes(msg)) failures.push(msg);
      }
    }
    setSending(false);
    if (failures.length === 0) {
      pushToast(`Invited ${ok} creator${ok === 1 ? '' : 's'}`, 'good');
    } else {
      pushToast(`Invited ${ok}, ${selected.size - ok} failed: ${failures[0]}`, 'bad');
    }
    onClose();
  };

  const count = selected.size;

  return (
    <div className="v2-modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className="v2-card v2-upload-modal"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 640, maxHeight: '88vh', display: 'flex', flexDirection: 'column' }}
      >
        <header className="v2-upload-modal-head">
          <div>
            <h2 style={{
              fontFamily: 'var(--v2-font-display)',
              fontSize: 22, fontWeight: 500, margin: 0, letterSpacing: '-0.02em',
            }}>Invite creators</h2>
            <div className="v2-muted" style={{ fontSize: 13, marginTop: 4 }}>
              Pick creators to invite to <strong>{campaignTitle}</strong>. They'll
              get a notification and can accept or pass.
            </div>
          </div>
          <button type="button" className="v2-icon-btn" onClick={onClose} aria-label="Close">×</button>
        </header>

        <div style={{ padding: '14px 20px 0', flex: 'none' }}>
          <input
            className="v2-input"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, handle, or category…"
            style={{ width: '100%' }}
          />
        </div>

        <div style={{
          flex: '1 1 auto',
          overflowY: 'auto',
          padding: '12px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
        }}>
          {candidates.length === 0 && (
            <p className="v2-muted" style={{ fontSize: 13, padding: '20px 0', textAlign: 'center' }}>
              {query.trim()
                ? `No creators match "${query.trim()}".`
                : 'No creators in the network yet.'}
            </p>
          )}
          {matchTotal > candidates.length && (
            <p className="v2-muted" style={{ fontSize: 12, padding: '2px 0 6px' }}>
              Showing {candidates.length} of {matchTotal}
              {query.trim() ? ' matches' : ' creators'} — search by name, handle,
              or category to narrow it down.
            </p>
          )}
          {candidates.map((c) => {
            const isOn = selected.has(c.id);
            const inFlight = inFlightReasons[c.id];
            return (
              <label
                key={c.id}
                className="v2-row"
                title={inFlight ? `${c.name} — ${inFlight}` : undefined}
                style={{
                  gap: 12,
                  padding: 10,
                  borderRadius: 10,
                  border: `1px solid ${isOn ? 'var(--v2-accent)' : 'var(--v2-border)'}`,
                  background: isOn ? 'var(--v2-accent-soft)' : 'transparent',
                  cursor: inFlight ? 'not-allowed' : 'pointer',
                  opacity: inFlight ? 0.55 : 1,
                  alignItems: 'center',
                }}
              >
                <input
                  type="checkbox"
                  checked={isOn}
                  disabled={!!inFlight}
                  onChange={() => toggle(c.id)}
                  aria-label={inFlight ? `${c.name} — ${inFlight}` : `Select ${c.name}`}
                />
                <div
                  className="v2-avatar v2-avatar-sm"
                  style={{ backgroundImage: `url(${c.avatar})` }}
                  aria-hidden="true"
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 550, fontSize: 13.5 }}>{c.name}</div>
                  <div className="v2-muted" style={{ fontSize: 12 }}>
                    @{c.handle}
                    {c.categories?.length ? ` · ${c.categories.slice(0, 2).join(' · ')}` : ''}
                    {inFlight ? ` · ${inFlight}` : ''}
                  </div>
                </div>
                {c.rate > 0 && (
                  <div className="v2-tabular v2-muted" style={{ fontSize: 12 }}>
                    {fmtUSD(c.rate)}/post
                  </div>
                )}
              </label>
            );
          })}
        </div>

        <div style={{ padding: '12px 20px 0', flex: 'none' }}>
          <label className="v2-eyebrow" style={{ display: 'block', marginBottom: 6 }}>
            Invitation message
          </label>
          <textarea
            className="v2-input"
            rows={2}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="A short note to each invited creator…"
            style={{ width: '100%', resize: 'vertical' }}
          />
        </div>

        <footer className="v2-upload-modal-foot" style={{ flex: 'none' }}>
          <div className="v2-row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="v2-muted" style={{ fontSize: 12 }}>
              {count === 0 ? 'No creators selected' : `${count} selected`}
            </span>
            <div className="v2-row" style={{ gap: 8 }}>
              <button type="button" className="v2-btn v2-btn-outline" onClick={onClose}>
                Cancel
              </button>
              <button
                type="button"
                className="v2-btn v2-btn-primary"
                disabled={!canInvite || count === 0 || sending}
                title={!canInvite ? 'Admin/ops only' : undefined}
                onClick={onSend}
              >
                {Icon.plus} Invite {count > 0 ? count : ''} {count === 1 ? 'creator' : 'creators'}
              </button>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}

// =====================================================================
// CreatorMarkLiveModal — creator pastes the live post URL
// =====================================================================
//
// After the brand approves a submission, the creator posts on their
// platform (Instagram, TikTok, etc.) and comes back here to attach the
// public URL. Calls `v2SetSubmissionPermalink` which notifies the brand
// "ready to confirm." The brand then verifies the link is actually live
// and clicks Mark Live on their end, which flips status to live and
// releases the final escrow milestone.
//
// This modal is the deep-link target for the creator's "Post & mark
// live" home tile (route: `collab:<id>?action=mark-live`). It replaces
// the inline editor on CollabDetail when the user arrived via a tile,
// so they land directly in the action.

interface CreatorMarkLiveProps {
  submissionId: string;
  deliverableLabel: string;
  campaignName: string;
  brandName: string;
  initialPermalink?: string;
  onClose: () => void;
}

export function CreatorMarkLiveModal({
  submissionId, deliverableLabel, campaignName, brandName,
  initialPermalink, onClose,
}: CreatorMarkLiveProps) {
  useModalEscape(onClose);
  const [url, setUrl] = useState(initialPermalink ?? '');
  const [confirmed, setConfirmed] = useState(false);
  const canSetPermalink = useCapability('content.setPermalink');
  // Two-tier URL validation:
  //   1. `isValidUrl` — must parse as http(s) — catches typos and
  //      missing protocols.
  //   2. `isRecognizedPlatform` — host must match a known platform
  //      domain. Catches "google.com" or unrelated links the
  //      creator might paste by accident. Whitelist intentionally
  //      narrow; brand still verifies on their end.
  const urlCheck = useMemo(() => {
    const trimmed = url.trim();
    if (!trimmed) return { valid: false, recognized: false, platform: '' };
    let parsed: URL;
    try { parsed = new URL(trimmed); } catch { return { valid: false, recognized: false, platform: '' }; }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { valid: false, recognized: false, platform: '' };
    }
    const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
    // Allowlist mirrors the `Platform` type union in types.ts. Pre-fix
    // it included Threads/Snapchat/Facebook/Pinterest which aren't in
    // the union — a creator could paste a Snap URL here but the
    // storefront wouldn't render the channel because Platform.name
    // doesn't accept 'Snapchat'. Substack was missing in the other
    // direction: it's a valid Platform but the URL parser rejected it.
    const platformMap: { match: string[]; label: string }[] = [
      { match: ['instagram.com'], label: 'Instagram' },
      { match: ['tiktok.com', 'vm.tiktok.com'], label: 'TikTok' },
      { match: ['youtube.com', 'youtu.be', 'm.youtube.com'], label: 'YouTube' },
      { match: ['twitter.com', 'x.com'], label: 'X' },
      { match: ['linkedin.com'], label: 'LinkedIn' },
      { match: ['substack.com'], label: 'Substack' },
    ];
    const matched = platformMap.find((p) => p.match.some((d) => host === d || host.endsWith(`.${d}`)));
    return { valid: true, recognized: !!matched, platform: matched?.label ?? '' };
  }, [url]);
  const ready = canSetPermalink && urlCheck.valid && urlCheck.recognized && confirmed;

  const onSave = () => {
    if (!ready) return;
    v2SetSubmissionPermalink(submissionId, url.trim());
    onClose();
  };

  return (
    <div className="v2-modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className="v2-card v2-upload-modal"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 560 }}
      >
        <header className="v2-upload-modal-head">
          <div>
            <h2 style={{
              fontFamily: 'var(--v2-font-display)',
              fontSize: 22, fontWeight: 500, margin: 0, letterSpacing: '-0.02em',
            }}>Mark live</h2>
            <div className="v2-muted" style={{ fontSize: 13, marginTop: 4 }}>
              {deliverableLabel} · {campaignName} · {brandName}
            </div>
          </div>
          <button type="button" className="v2-icon-btn" onClick={onClose} aria-label="Close">×</button>
        </header>

        <div style={{ padding: '14px 20px 8px' }}>
          {/* P67 — honest copy: escrow released in full when the brand
              approved (it's already in the creator's wallet). Pre-fix
              this paragraph promised a "final 50%" release on confirm —
              a milestone schema that doesn't exist in the data layer. */}
          <p style={{ fontSize: 13.5, lineHeight: 1.55, margin: '0 0 12px', color: 'var(--v2-ink-2)' }}>
            Post your approved content on the platform first, then paste the public URL here. {brandName} will verify it's
            live and confirm — that completes this deliverable and starts performance tracking. Your payout already
            released to your wallet when the draft was approved.
          </p>

          <label className="v2-eyebrow" style={{ display: 'block', marginBottom: 6 }}>
            Public URL
          </label>
          <input
            className="v2-input"
            type="url"
            inputMode="url"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://www.instagram.com/p/…"
            style={{ width: '100%' }}
          />
          {url.trim() && !urlCheck.valid && (
            <div className="v2-muted" style={{
              fontSize: 12, marginTop: 6, color: 'var(--v2-gold)',
            }}>
              That doesn't look like a valid URL — paste the full link including https://
            </div>
          )}
          {url.trim() && urlCheck.valid && !urlCheck.recognized && (
            <div className="v2-muted" style={{
              fontSize: 12, marginTop: 6, color: 'var(--v2-gold)',
            }}>
              Unrecognized host — paste a link to Instagram, TikTok, YouTube, X, LinkedIn, or Substack.
            </div>
          )}
          {url.trim() && urlCheck.recognized && (
            <div className="v2-muted" style={{
              fontSize: 12, marginTop: 6, color: 'var(--v2-moss)',
            }}>
              {urlCheck.platform} link detected ✓
            </div>
          )}

          <label
            className="v2-row"
            style={{
              gap: 10,
              marginTop: 14,
              padding: 10,
              borderRadius: 8,
              border: '1px solid var(--v2-border)',
              cursor: 'pointer',
              alignItems: 'flex-start',
            }}
          >
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              style={{ marginTop: 3 }}
            />
            <div style={{ fontSize: 13, lineHeight: 1.45 }}>
              <strong>I confirm the post is live and publicly accessible.</strong>{' '}
              <span className="v2-muted">
                Removing or making it private after marking live can put the deal in dispute.
              </span>
            </div>
          </label>
        </div>

        <footer className="v2-upload-modal-foot">
          <div className="v2-row" style={{ justifyContent: 'flex-end', gap: 8 }}>
            <button type="button" className="v2-btn v2-btn-outline" onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className="v2-btn v2-btn-primary"
              disabled={!ready}
              title={!canSetPermalink ? 'You don\'t have permission to mark this live' : undefined}
              onClick={onSave}
            >
              {Icon.check} Submit for confirmation
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

// =====================================================================
// SendBriefModal — invite ONE creator, pick WHICH campaign
// =====================================================================
//
// The inverse of InviteCreatorsModal (one campaign, many creators).
// Entry points are the creator-centric surfaces — BrandHome's "For you"
// cards, Discover, CreatorProfile — where the brand has a creator in
// mind and no campaign context.
//
// It exists because "Send brief" was, on BrandHome, a byte-identical
// copy of the "View profile" handler next to it: two buttons, two
// labels, one behaviour. CreatorProfile's version was only marginally
// better — it opened the generic inbox with no thread and no creator.
// Neither sent anything.
//
// Only `live` campaigns are offered. A draft isn't visible to creators,
// so an invite into one produces a collab pointing at a brief the
// creator can't open; `Paused`/`Completed` shouldn't take new people at
// all. When the brand has no live campaign the modal says so and hands
// them the wizard with this creator pre-invited.

interface SendBriefProps {
  creator: V2Creator;
  onRoute: (r: string) => void;
  onClose: () => void;
}

export function SendBriefModal({ creator, onRoute, onClose }: SendBriefProps) {
  useModalEscape(onClose);
  const db = useStore((s) => s.db);
  const session = useStore((s) => s.session);
  const brand = useV2CurrentBrand();
  const canInvite = useCapability('application.invite');
  const [campaignId, setCampaignId] = useState('');
  const [message, setMessage] = useState('');
  const [edited, setEdited] = useState(false);
  const [sending, setSending] = useState(false);

  const { live, draftCount } = useMemo(() => {
    const mine = brand ? db.campaigns.filter((c) => c.brandId === brand.id) : [];
    return {
      live: mine
        .filter((c) => c.stage === 'live')
        .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? '')),
      draftCount: mine.filter((c) => c.stage === 'draft').length,
    };
  }, [db.campaigns, brand]);

  // Why this creator can't be invited to a given campaign, keyed by
  // campaign id. Same precedence as InviteCreatorsModal: an existing
  // collab beats an offer, which beats an application.
  const reasons = useMemo(() => {
    const out: Record<string, string> = {};
    for (const a of db.applications) {
      if (a.creatorId === creator.id) out[a.campaignId] = 'Already applied';
    }
    for (const o of db.offers) {
      if (o.creatorId !== creator.id) continue;
      out[o.campaignId] =
        o.status === 'accepted' ? 'Offer accepted'
        : o.status === 'declined' ? 'Declined your offer'
        : 'Offer already sent';
    }
    for (const c of db.collaborations) {
      if (c.creatorId === creator.id) out[c.campaignId] = 'Already on this campaign';
    }
    return out;
  }, [db.applications, db.offers, db.collaborations, creator.id]);

  const selected = live.find((c) => c.id === campaignId);
  const defaultMessage = selected
    ? `We'd love to have you on "${selected.title}". Take a look and let us know if it's a fit.`
    : '';
  const body = edited ? message : defaultMessage;
  const blocked = campaignId ? reasons[campaignId] : undefined;

  const onSend = () => {
    if (!session?.userId || !campaignId || blocked) return;
    setSending(true);
    try {
      v2InviteCreator(campaignId, creator.id, body, session.userId);
      pushToast(`Brief sent to ${creator.name.split(' ')[0]}`, 'good');
      onClose();
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Could not send the brief', 'bad');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="v2-modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className="v2-card v2-upload-modal"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 560, maxHeight: '88vh', display: 'flex', flexDirection: 'column' }}
      >
        <header className="v2-upload-modal-head">
          <div>
            <h2 style={{
              fontFamily: 'var(--v2-font-display)',
              fontSize: 22, fontWeight: 500, margin: 0, letterSpacing: '-0.02em',
            }}>Send a brief</h2>
            <div className="v2-muted" style={{ fontSize: 13, marginTop: 4 }}>
              Invite <strong>{creator.name}</strong> to one of your live campaigns.
              They'll get a notification and can accept or pass.
            </div>
          </div>
          <button type="button" className="v2-icon-btn" onClick={onClose} aria-label="Close">×</button>
        </header>

        <div style={{ flex: '1 1 auto', overflowY: 'auto', padding: '16px 20px' }}>
          {live.length === 0 ? (
            <div style={{ padding: '18px 0' }}>
              <p style={{ fontSize: 13.5, margin: '0 0 6px' }}>
                You don't have a live campaign to invite {creator.name.split(' ')[0]} to.
              </p>
              <p className="v2-muted" style={{ fontSize: 12.5, margin: '0 0 14px' }}>
                {draftCount > 0
                  ? `${draftCount} draft${draftCount === 1 ? '' : 's'} saved — launch one, or start a new brief with ${creator.name.split(' ')[0]} already invited.`
                  : `Create one and they'll be invited as soon as it launches.`}
              </p>
              <button
                className="v2-btn v2-btn-primary"
                type="button"
                onClick={() => { onClose(); onRoute(`campaign-new?invited=${creator.id}`); }}
              >
                {Icon.plus} New campaign
              </button>
            </div>
          ) : (
            <>
              <label
                className="v2-eyebrow"
                htmlFor="v2-send-brief-campaign"
                style={{ display: 'block', marginBottom: 6 }}
              >
                Campaign
              </label>
              <select
                id="v2-send-brief-campaign"
                className="v2-input"
                value={campaignId}
                onChange={(e) => setCampaignId(e.target.value)}
                style={{ width: '100%', marginBottom: 14 }}
              >
                <option value="">Choose a campaign…</option>
                {live.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}{reasons[c.id] ? ` — ${reasons[c.id]}` : ''}
                  </option>
                ))}
              </select>

              <label
                className="v2-eyebrow"
                htmlFor="v2-send-brief-message"
                style={{ display: 'block', marginBottom: 6 }}
              >
                Message
              </label>
              <textarea
                id="v2-send-brief-message"
                className="v2-input"
                rows={4}
                value={body}
                disabled={!campaignId}
                onChange={(e) => { setEdited(true); setMessage(e.target.value); }}
                placeholder="Pick a campaign first — the message fills in from its title."
                style={{ width: '100%', resize: 'vertical' }}
              />

              {blocked && (
                <p className="v2-muted" style={{ fontSize: 12.5, marginTop: 10 }}>
                  {creator.name.split(' ')[0]} is already in flight on this campaign — {blocked.toLowerCase()}.
                  Pick another, or open the campaign to carry on there.
                </p>
              )}
            </>
          )}
        </div>

        {live.length > 0 && (
          <footer className="v2-upload-modal-foot">
            <div className="v2-row" style={{ gap: 8, justifyContent: 'flex-end', width: '100%' }}>
              <button className="v2-btn v2-btn-outline" type="button" onClick={onClose}>Cancel</button>
              <button
                className="v2-btn v2-btn-primary"
                type="button"
                disabled={!canInvite || !campaignId || !!blocked || sending || !body.trim()}
                title={!canInvite ? 'Admin/ops only' : undefined}
                onClick={onSend}
              >
                {Icon.send} Send brief
              </button>
            </div>
          </footer>
        )}
      </div>
    </div>
  );
}
