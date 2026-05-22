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
import { parseNumberInput } from '@/lib/utils/format';
import {
  v2CounterOffer, v2CounterCounter, v2DeclineOffer, v2MarkContentLive,
  v2SendOffer, v2SetSubmissionPermalink,
} from '../v2CampaignActions';
import { v2InviteCreator } from '../v2CollabActions';
import {
  useV2Creators, useV2OfferTemplates,
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
  const [rate, setRate] = useState<number>(defaultRate);
  const [message, setMessage] = useState<string>(
    `Hi ${creator.name.split(' ')[0]} — we'd love to work with you. Offering $${defaultRate.toLocaleString()} for the brief — let me know if you'd like to discuss.`,
  );
  // Creator-side guardrails (s18) — show warnings, never block.
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
              <strong style={{ color: 'var(--v2-gold)' }}>✈ {creator.name.split(' ')[0]} is on vacation</strong> — they're not actively monitoring offers right now. You can still send; expect a delayed reply.
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
            <label className="v2-eyebrow" style={{ display: 'block', marginBottom: 6 }}>Rate (USD)</label>
            <div className="v2-onboarding-rate">
              <span className="v2-onboarding-rate-prefix">$</span>
              <input
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
            <strong>{fmtUSD(Math.round(rate * 0.85))}</strong> after platform fee + WHT.
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
              disabled={rate <= 0 || !message.trim() || !canSend}
              title={!canSend ? 'Admin or ops only' : undefined}
              onClick={() => {
                v2SendOffer(campaignId, creator.id, rate, message);
                onClose();
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
            <label className="v2-eyebrow" style={{ display: 'block', marginBottom: 6 }}>Your counter (USD)</label>
            <div className="v2-onboarding-rate">
              <span className="v2-onboarding-rate-prefix">$</span>
              <input
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
                Net to you after fees: <strong>{fmtUSD(Math.round(rate * 0.85))}</strong>
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
        </div>
        <footer className="v2-upload-modal-foot">
          <div className="v2-row" style={{ gap: 8 }}>
            <button
              className="v2-btn v2-btn-outline"
              type="button"
              style={{ flex: 1 }}
              onClick={() => {
                v2DeclineOffer(offerId, message || 'Pass for now.');
                onClose();
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
                if (side === 'brand') v2CounterCounter(offerId, rate, message);
                else v2CounterOffer(offerId, rate, message);
                onClose();
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
                v2MarkContentLive(submissionId);
                onClose();
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
  /** Creator IDs already engaged on this campaign (existing collab,
   *  offer, or application) — filtered out of the picker so the brand
   *  doesn't double-invite. */
  excludeCreatorIds: string[];
  campaignTitle: string;
  onClose: () => void;
}

export function InviteCreatorsModal({
  campaignId, excludeCreatorIds, campaignTitle, onClose,
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

  const candidates = useMemo(() => {
    const exclude = new Set(excludeCreatorIds);
    const q = query.trim().toLowerCase();
    return allCreators
      .filter((c) => !exclude.has(c.id))
      .filter((c) => {
        if (!q) return true;
        return (
          c.name.toLowerCase().includes(q) ||
          c.handle.toLowerCase().includes(q) ||
          (c.categories ?? []).some((cat) => cat.toLowerCase().includes(q))
        );
      })
      .slice(0, 50);
  }, [allCreators, excludeCreatorIds, query]);

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
    for (const creatorId of selected) {
      v2InviteCreator(campaignId, creatorId, message, session.userId);
    }
    setSending(false);
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
                : 'Every creator is already engaged on this campaign.'}
            </p>
          )}
          {candidates.map((c) => {
            const isOn = selected.has(c.id);
            return (
              <label
                key={c.id}
                className="v2-row"
                style={{
                  gap: 12,
                  padding: 10,
                  borderRadius: 10,
                  border: `1px solid ${isOn ? 'var(--v2-accent)' : 'var(--v2-border)'}`,
                  background: isOn ? 'var(--v2-accent-soft)' : 'transparent',
                  cursor: 'pointer',
                  alignItems: 'center',
                }}
              >
                <input
                  type="checkbox"
                  checked={isOn}
                  onChange={() => toggle(c.id)}
                  aria-label={`Select ${c.name}`}
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
  /** Net amount that releases when the brand confirms live. Shown so the
   *  creator sees what's at stake before pasting. */
  releaseAmount: number;
  onClose: () => void;
}

export function CreatorMarkLiveModal({
  submissionId, deliverableLabel, campaignName, brandName,
  initialPermalink, releaseAmount, onClose,
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
          <p style={{ fontSize: 13.5, lineHeight: 1.55, margin: '0 0 12px', color: 'var(--v2-ink-2)' }}>
            Post your approved content on the platform first, then paste the public URL here. {brandName} will verify it's
            live and confirm — that releases the final <strong>{fmtUSD(releaseAmount)}</strong> from escrow to your wallet.
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
              Unrecognized host — paste a link to Instagram, TikTok, YouTube, X, LinkedIn, Threads, Snapchat, Facebook, or Pinterest.
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
