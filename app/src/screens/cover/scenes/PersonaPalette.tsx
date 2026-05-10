// PersonaPalette (Phase 34) — wraps the cinematic landing in a div
// that carries the `data-persona` attribute. The palette CSS in
// `cinematic.css` cascades from this attribute, so every descendant
// referring to `var(--cn-bg)` / `var(--cn-accent)` etc. tracks the
// persona swap automatically.
//
// Persona state itself is owned by the existing `usePersona()` hook
// (which persists to localStorage), so visitors who toggle once
// don't have to re-pick on reload.

import type { ReactNode } from 'react';
import { usePersona } from '@/lib/utils/usePersona';

interface Props {
  children: ReactNode;
}

export function PersonaPalette({ children }: Props) {
  const [persona] = usePersona();
  return (
    <div className="cinematic" data-persona={persona}>
      {children}
    </div>
  );
}
