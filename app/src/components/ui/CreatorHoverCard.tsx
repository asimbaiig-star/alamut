// Hover-anywhere preview for a creator. Wraps any trigger element.
// On hover/focus shows a portal-positioned card with portrait + tier + reach + a
// "Open profile" CTA. Dismisses on mouseout/blur with a small delay so users can
// move into the card itself.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from '@/lib/api/store';
import { Pill } from './Pill';
import { TrustBadge } from './TrustBadge';
import { trustForCreator } from '@/lib/utils/trust';
import { fmtCount } from '@/lib/utils/format';

interface CreatorHoverCardProps {
  creatorId: string;
  children: ReactNode;
  // Optional href the card's "Open profile" link routes to; defaults to /c/handle
  hrefOverride?: string;
}

const HOVER_OPEN_DELAY = 260;
const HOVER_CLOSE_DELAY = 140;

export function CreatorHoverCard({ creatorId, children, hrefOverride }: CreatorHoverCardProps) {
  const db = useStore((s) => s.db);
  const triggerRef = useRef<HTMLSpanElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const openTimer = useRef<number | null>(null);
  const closeTimer = useRef<number | null>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  const creator = db.creators.find((c) => c.id === creatorId);

  const computePos = () => {
    const r = triggerRef.current?.getBoundingClientRect();
    if (!r) return;
    const cardW = 320;
    const cardH = 220;
    let left = r.left;
    let top = r.bottom + 8;
    // Right-edge clamp
    if (left + cardW + 16 > window.innerWidth) left = window.innerWidth - cardW - 16;
    // Below-fold flip — open above the trigger
    if (top + cardH > window.innerHeight - 16) top = r.top - cardH - 8;
    setPos({ top, left });
  };

  useEffect(() => {
    if (!open) return;
    computePos();
    const onScroll = () => computePos();
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [open]);

  // Cleanup timers on unmount.
  useEffect(() => () => {
    if (openTimer.current) window.clearTimeout(openTimer.current);
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
  }, []);

  if (!creator) return <>{children}</>;

  const scheduleOpen = () => {
    if (closeTimer.current) { window.clearTimeout(closeTimer.current); closeTimer.current = null; }
    openTimer.current = window.setTimeout(() => setOpen(true), HOVER_OPEN_DELAY);
  };
  const scheduleClose = () => {
    if (openTimer.current) { window.clearTimeout(openTimer.current); openTimer.current = null; }
    closeTimer.current = window.setTimeout(() => setOpen(false), HOVER_CLOSE_DELAY);
  };

  const trust = trustForCreator(db, creator);
  const handle = creator.handle.replace('@', '');
  const href = hrefOverride || `/c/${handle}`;

  return (
    <>
      <span
        ref={triggerRef}
        onMouseEnter={scheduleOpen}
        onMouseLeave={scheduleClose}
        onFocus={scheduleOpen}
        onBlur={scheduleClose}
        style={{ display: 'inline-flex' }}
      >
        {children}
      </span>
      {open && pos && createPortal(
        <div
          ref={cardRef}
          className="creator-hover-card"
          style={{ top: pos.top, left: pos.left }}
          onMouseEnter={() => { if (closeTimer.current) { window.clearTimeout(closeTimer.current); closeTimer.current = null; } }}
          onMouseLeave={scheduleClose}
          role="tooltip"
        >
          <div style={{ display: 'flex', gap: 12 }}>
            <img src={creator.portrait} alt="" style={{ width: 64, height: 80, objectFit: 'cover', borderRadius: 4, flexShrink: 0 }} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div className="mono-meta" style={{ fontSize: 9 }}>{creator.handle} · {creator.city}</div>
              <div style={{ fontFamily: 'var(--serif)', fontSize: 18, lineHeight: 1.15, marginTop: 2 }}>{creator.name}</div>
              <div style={{ fontSize: 12, color: 'var(--ink-80)', marginTop: 4, lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden' }}>
                {creator.tagline}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
            <TrustBadge snapshot={trust} />
            <Pill>{creator.tier}</Pill>
            {creator.verified && <Pill tone="good">✓</Pill>}
          </div>
          <div className="kpi-strip" style={{ marginTop: 10, borderRadius: 4, borderTop: '1px solid var(--rule)', borderLeft: 0, borderRight: 0, borderBottom: 0 }}>
            <div style={{ padding: '8px 6px', borderRight: '1px solid var(--rule)' }}>
              <div className="kpi-k" style={{ fontSize: 9, marginBottom: 2 }}>Reach</div>
              <div style={{ fontFamily: 'var(--serif)', fontSize: 16, fontWeight: 500 }}>{fmtCount(creator.reach)}</div>
            </div>
            <div style={{ padding: '8px 6px', borderRight: '1px solid var(--rule)' }}>
              <div className="kpi-k" style={{ fontSize: 9, marginBottom: 2 }}>Eng</div>
              <div style={{ fontFamily: 'var(--serif)', fontSize: 16, fontWeight: 500 }}>{creator.engagement}<span style={{ fontSize: 11 }}>%</span></div>
            </div>
            <div style={{ padding: '8px 6px' }}>
              <div className="kpi-k" style={{ fontSize: 9, marginBottom: 2 }}>★</div>
              <div style={{ fontFamily: 'var(--serif)', fontSize: 16, fontWeight: 500 }}>{creator.rating || '—'}</div>
            </div>
          </div>
          <a href={href} target="_blank" rel="noreferrer" className="creator-hover-card-cta">
            Open storefront →
          </a>
        </div>,
        document.body
      )}
    </>
  );
}
