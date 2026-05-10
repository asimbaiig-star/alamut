import { useEffect, useRef, type ReactNode } from 'react';
import { Icon } from './Icon';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  width?: number;
  // When true, clicking the backdrop or pressing Escape won't dismiss the modal — use for
  // flows where dismissal needs an explicit choice (e.g., onboarding tour).
  blockBackdropDismiss?: boolean;
  // Phase 20 a11y fix: optional CSS selector for the element that should
  // receive focus when the modal opens. Without it, the auto-focus logic
  // picks the first focusable, which on tab-button-led modals (dispute
  // resolution, etc.) lands on a tab and Space/Enter accidentally changes
  // the tab selection.
  initialFocusSelector?: string;
}

// Selectors for focusable elements — used by the focus trap + initial-focus logic.
const FOCUSABLE_SELECTORS = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export function Modal({ open, onClose, title, children, footer, width, blockBackdropDismiss, initialFocusSelector }: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  // Phase 17.5 QA — remember which element opened the modal so we can return
  // focus to it on close. Without this, keyboard users lose their place.
  const openerRef = useRef<HTMLElement | null>(null);
  // Phase 20 a11y fix — track whether the mousedown that opened a click
  // started on the backdrop. Stops a drag-from-dialog gesture (user drags
  // a selection that ends on the backdrop) from misfiring as a dismiss.
  const downOnBackdropRef = useRef(false);

  useEffect(() => {
    if (!open) return;

    // Phase 20 QA fix: reset backdrop-down tracker on every open so a
    // previous true value can't carry over. (Otherwise the next drag-out
    // gesture from a re-opened dialog would dismiss.)
    downOnBackdropRef.current = false;

    // Snapshot the currently-focused element (the trigger that opened us).
    openerRef.current = (document.activeElement as HTMLElement) || null;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !blockBackdropDismiss) {
        e.preventDefault();
        onClose();
        return;
      }
      // Phase 17.5 QA — focus trap. Tab / Shift+Tab cycle within the dialog.
      if (e.key === 'Tab' && dialogRef.current) {
        const focusables = Array.from(
          dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS),
        ).filter((el) => el.offsetParent !== null);  // skip hidden
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const active = document.activeElement as HTMLElement;
        if (e.shiftKey && active === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';

    // Auto-focus the dialog's most-useful focusable after layout.
    // Phase 20 a11y fix: prefer textareas/inputs over buttons. Without this,
    // modals that lead with tab buttons (e.g. dispute resolution decision
    // tabs) auto-focus the tab and Space/Enter accidentally changes the
    // active tab. Caller can override entirely via `initialFocusSelector`.
    // requestAnimationFrame ensures the DOM is mounted before we look.
    const raf = requestAnimationFrame(() => {
      if (!dialogRef.current) return;
      // 1) Honor explicit caller hint
      if (initialFocusSelector) {
        const explicit = dialogRef.current.querySelector<HTMLElement>(initialFocusSelector);
        if (explicit) { explicit.focus(); return; }
      }
      const focusables = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS));
      const closeBtn = dialogRef.current.querySelector('.modal-h .icon-btn-ghost');
      const visible = focusables.filter((el) => el !== closeBtn);
      // 2) Prefer the first input / textarea / select (most useful target)
      const inputLike = visible.find((el) => /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
      if (inputLike) { inputLike.focus(); return; }
      // 3) Fall through to first non-close focusable
      (visible[0] || focusables[0])?.focus();
    });

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      // Return focus to the original opener so keyboard users land back where they were.
      // Wrap in setTimeout(0) so it runs after React unmounts the modal.
      const opener = openerRef.current;
      if (opener && document.body.contains(opener)) {
        setTimeout(() => opener.focus({ preventScroll: true }), 0);
      }
    };
  }, [open, onClose, blockBackdropDismiss]);

  if (!open) return null;
  return (
    // Phase 20 a11y fix: only dismiss if BOTH mousedown and mouseup
    // happened on the backdrop. A drag that started inside the dialog
    // and ended on the backdrop (e.g. text selection running long) used
    // to misfire as a dismiss.
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        downOnBackdropRef.current = e.target === e.currentTarget;
      }}
      onClick={(e) => {
        const wasDownOnBackdrop = downOnBackdropRef.current;
        // Always reset so the next gesture starts clean, even if we don't dismiss.
        downOnBackdropRef.current = false;
        if (blockBackdropDismiss) return;
        if (e.target !== e.currentTarget) return;     // click bubbled from inside
        if (!wasDownOnBackdrop) return;                // drag started in dialog
        onClose();
      }}
    >
      <div
        ref={dialogRef}
        className="modal"
        style={width ? { maxWidth: width } : undefined}
        // Phase 20 QA fix: explicitly clear the backdrop-down tracker when
        // the press starts inside the dialog, so even after stopPropagation
        // the state is consistent (drag-out won't dismiss).
        onMouseDown={(e) => { downOnBackdropRef.current = false; e.stopPropagation(); }}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'modal-title' : undefined}
      >
        <div className="modal-h">
          <div className="modal-title" id="modal-title">{title}</div>
          {!blockBackdropDismiss && (
            <button onClick={onClose} aria-label="Close" className="icon-btn-ghost"><Icon.x /></button>
          )}
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}
