import { useEffect } from 'react';
import { useConfirmState, resolveConfirm } from '@/lib/utils/confirm';
import { Modal } from './Modal';
import { Button } from './Button';

export function ConfirmHost() {
  const c = useConfirmState();

  // Enter to confirm, Esc to cancel.
  // Phase 20 a11y fix: only treat Enter as confirm when focus is NOT in a
  // text-entry control. Otherwise, a future confirm modal that grew an
  // input/textarea would have its Enter swallowed (Esc is fine globally —
  // it cancels everywhere unambiguously). Modal already binds Escape, so
  // we only really need Enter here.
  useEffect(() => {
    if (!c) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Enter') return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || (t as HTMLElement).isContentEditable)) return;
      e.preventDefault();
      resolveConfirm(true);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [c]);

  if (!c) return null;
  return (
    <Modal
      open
      onClose={() => resolveConfirm(false)}
      title={c.title}
      width={460}
      footer={<>
        <Button variant="ghost" onClick={() => resolveConfirm(false)}>{c.cancelLabel || 'Cancel'}</Button>
        <Button
          variant={c.danger ? 'danger' : 'solid'}
          onClick={() => resolveConfirm(true)}
        >{c.confirmLabel || 'Confirm'}</Button>
      </>}
    >
      {c.message ? (
        <p style={{ margin: 0, fontSize: 14, color: 'var(--ink-80)', lineHeight: 1.55 }}>{c.message}</p>
      ) : (
        <p style={{ margin: 0, fontSize: 14, color: 'var(--ink-80)' }}>Are you sure?</p>
      )}
    </Modal>
  );
}
