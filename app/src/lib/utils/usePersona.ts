// Persona state for the landing page (Phase 18 origin · Phase 34 fix).
//
// The whole landing pivots around whether the visitor is a creator or a
// brand. We persist the choice to localStorage so a returning visitor
// keeps their persona across visits, AND mirror it to a `?p=` URL
// param so links shared from social default to the right slant.
//
// Phase 34 fix: previously each `usePersona()` call had its own
// `useState`, so a toggle in one component didn't propagate to other
// consumers in the same tab. The cinematic landing has multiple
// hook callers (the toggle, the palette wrapper, individual acts)
// that all need to see the same value. Converted to a module-level
// store + `useSyncExternalStore` so every hook call shares one
// source of truth.

import { useSyncExternalStore } from 'react';

export type Persona = 'creator' | 'brand';

const KEY = 'alamut.landingPersona';

function readInitial(): Persona {
  if (typeof window === 'undefined') return 'creator';
  // URL takes precedence so shared links override stored preference.
  const url = new URL(window.location.href);
  const fromUrl = url.searchParams.get('p');
  if (fromUrl === 'creator' || fromUrl === 'brand') return fromUrl;
  // Otherwise fall back to localStorage / default to creator (the harder
  // audience to land — easier copy, lower bar to entry).
  try {
    const stored = localStorage.getItem(KEY);
    if (stored === 'creator' || stored === 'brand') return stored;
  } catch { /* private mode etc. */ }
  return 'creator';
}

// ---- Module-level singleton store ----
// All `usePersona()` callers share this state. Subscribers are notified
// on every change.

let current: Persona = readInitial();
const listeners = new Set<() => void>();

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

function getSnapshot(): Persona {
  return current;
}

// SSR snapshot — not exercised in this prototype but required by
// useSyncExternalStore's signature for hydration safety.
function getServerSnapshot(): Persona {
  return 'creator';
}

function setPersona(next: Persona) {
  if (next === current) return;
  current = next;
  try { localStorage.setItem(KEY, next); } catch { /* ignore */ }
  if (typeof window !== 'undefined') {
    const url = new URL(window.location.href);
    url.searchParams.set('p', next);
    window.history.replaceState({}, '', url.toString());
  }
  // Notify every subscriber so all useSyncExternalStore consumers
  // re-render with the new value.
  listeners.forEach((cb) => cb());
}

// Listen for cross-tab changes via storage events.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key !== KEY) return;
    if (e.newValue === 'creator' || e.newValue === 'brand') {
      if (e.newValue !== current) {
        current = e.newValue;
        listeners.forEach((cb) => cb());
      }
    }
  });
  // And in-tab popstate (browser back/forward — URL ?p= changes).
  window.addEventListener('popstate', () => {
    const url = new URL(window.location.href);
    const fromUrl = url.searchParams.get('p');
    if ((fromUrl === 'creator' || fromUrl === 'brand') && fromUrl !== current) {
      current = fromUrl;
      listeners.forEach((cb) => cb());
    }
  });
}

export function usePersona(): [Persona, (next: Persona) => void] {
  const persona = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return [persona, setPersona];
}
