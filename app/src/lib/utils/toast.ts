// Tiny pub/sub toast bus — no deps.
import { useEffect, useState } from 'react';

export interface ToastUndo {
  // Called if the user clicks Undo before the timeout. Should reverse whatever
  // operation the toast announced.
  onUndo: () => void | Promise<void>;
  label?: string; // defaults to "Undo"
}

export interface Toast {
  id: string;
  text: string;
  tone?: 'default' | 'good' | 'bad';
  // Optional undo handle — when set, the toast renders an Undo button and
  // doesn't auto-dismiss as fast (5s default vs 3.5s).
  undo?: ToastUndo;
}

let counter = 0;
const subscribers = new Set<(toasts: Toast[]) => void>();
let toasts: Toast[] = [];

function notify() {
  subscribers.forEach((s) => s(toasts));
}

export function pushToast(text: string, tone: Toast['tone'] = 'default', ms = 3500) {
  const t: Toast = { id: `t_${++counter}`, text, tone };
  toasts = [...toasts, t];
  notify();
  setTimeout(() => dismissToast(t.id), ms);
  return t.id;
}

// Toast with an Undo affordance — the user has `ms` to click Undo before
// the action is treated as final. `onUndo` runs synchronously on click,
// dismissing the toast immediately.
export function pushUndoToast(text: string, undo: ToastUndo, tone: Toast['tone'] = 'default', ms = 5000) {
  const t: Toast = { id: `t_${++counter}`, text, tone, undo };
  toasts = [...toasts, t];
  notify();
  setTimeout(() => dismissToast(t.id), ms);
  return t.id;
}

export function dismissToast(id: string) {
  toasts = toasts.filter((t) => t.id !== id);
  notify();
}

export async function invokeUndo(id: string) {
  const t = toasts.find((x) => x.id === id);
  if (!t?.undo) return;
  // Dismiss first so the UI feels instant — then run the reversal.
  dismissToast(id);
  try {
    await t.undo.onUndo();
  } catch (e) {
    // If the undo itself fails, surface a follow-up toast so the user knows.
    pushToast(e instanceof Error ? e.message : 'Undo failed', 'bad');
  }
}

export function useToasts(): Toast[] {
  const [list, setList] = useState<Toast[]>(toasts);
  useEffect(() => {
    subscribers.add(setList);
    return () => { subscribers.delete(setList); };
  }, []);
  return list;
}
