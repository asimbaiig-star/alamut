import { useToasts, dismissToast, invokeUndo } from '@/lib/utils/toast';
import { Icon } from './Icon';

export function ToastHost() {
  const toasts = useToasts();
  if (!toasts.length) return null;
  return (
    <div
      className="toast-host"
      role="region"
      aria-label="Notifications"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className="toast"
          // 'bad' is assertive (interrupts SR); good/default is polite.
          role={t.tone === 'bad' ? 'alert' : 'status'}
          aria-live={t.tone === 'bad' ? 'assertive' : 'polite'}
          aria-atomic="true"
          // Phase 20 cleanup: read from the design tokens instead of
          // hardcoded OKLCH so the tone follows theme + accent changes.
          // Mix the tone color with --ink for a darker, readable variant
          // — the toast surface is glass-on-paper and needs strong contrast.
          style={
            t.tone === 'good'
              ? { background: 'color-mix(in oklab, var(--good) 80%, var(--ink) 20%)' }
              : t.tone === 'bad'
                ? { background: 'color-mix(in oklab, var(--bad) 80%, var(--ink) 20%)' }
                : undefined
          }
        >
          <span>{t.text}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
            {t.undo && (
              <button
                onClick={() => invokeUndo(t.id)}
                className="toast-undo"
              >{t.undo.label || 'Undo'}</button>
            )}
            <button
              onClick={() => dismissToast(t.id)}
              aria-label="Dismiss"
              className="toast-dismiss"
            ><Icon.x s={12} /></button>
          </div>
        </div>
      ))}
    </div>
  );
}
