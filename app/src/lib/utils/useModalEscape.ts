// useModalEscape — install a global Escape-keydown handler that fires
// onClose. Phase 58 — pre-fix none of the v2 modals had an ESC handler,
// so the only way to dismiss was clicking outside or hitting the X.
// One-line install in any modal: `useModalEscape(onClose)`.
//
// Implementation notes:
// - Listener attaches/detaches on mount/unmount. Multiple open modals
//   each register their own handler; ESC dismisses all of them, which
//   is the expected stacked-modal behavior.
// - `keydown` (not keyup) to match form-input behavior — ESC inside a
//   textarea or input should still bubble up and close the modal.
// - Does nothing if `onClose` is undefined (caller can opt out per
//   mount with a conditional).

import { useEffect } from 'react';

export function useModalEscape(onClose: (() => void) | undefined): void {
  useEffect(() => {
    if (!onClose) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);
}
