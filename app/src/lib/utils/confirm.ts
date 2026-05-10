// Promise-based confirm bus. Mount <ConfirmHost /> once at the app root,
// then call `await confirmAction({ title, message, confirmLabel, danger })` anywhere.
import { useEffect, useState } from 'react';

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

interface PendingConfirm extends ConfirmOptions {
  id: number;
}

let counter = 0;
let resolveCurrent: ((v: boolean) => void) | null = null;
let current: PendingConfirm | null = null;
const subscribers = new Set<(c: PendingConfirm | null) => void>();

function notify() { subscribers.forEach((s) => s(current)); }

export function confirmAction(opts: ConfirmOptions): Promise<boolean> {
  // If a previous confirm is open, auto-resolve it as false.
  if (resolveCurrent) resolveCurrent(false);
  return new Promise((resolve) => {
    resolveCurrent = resolve;
    current = { id: ++counter, ...opts };
    notify();
  });
}

export function resolveConfirm(result: boolean) {
  resolveCurrent?.(result);
  resolveCurrent = null;
  current = null;
  notify();
}

export function useConfirmState(): PendingConfirm | null {
  const [c, setC] = useState<PendingConfirm | null>(current);
  useEffect(() => {
    subscribers.add(setC);
    return () => { subscribers.delete(setC); };
  }, []);
  return c;
}
