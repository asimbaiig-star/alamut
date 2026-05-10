// Saved searches — generic primitive (Phase 22).
//
// Persists named filter+query combos to localStorage so creators / brands
// / admins can re-run "Beauty in EU, $3k+, fixed-rate" with one click.
// The shape is generic over the filter type, with a schema version field
// for forward compatibility (when we add new filter dimensions later, old
// saved searches drop the unknown keys via spread merge instead of
// silently breaking).
//
// Storage key per scope is `alamut:saved-searches:<scope>`. Scope is
// arbitrary — we use it to namespace creator-discover from brand-discover
// from admin-audit etc.

import { useCallback, useEffect, useState } from 'react';

const SCHEMA_VERSION = 1;

export interface SavedSearch<F> {
  id: string;
  name: string;
  filters: F;
  search?: string;
  createdAt: string;
}

interface StoredShape<F> {
  version: number;
  searches: SavedSearch<F>[];
}

function readFromStorage<F>(scope: string): SavedSearch<F>[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(`alamut:saved-searches:${scope}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as StoredShape<F>;
    if (parsed.version !== SCHEMA_VERSION) {
      // Phase 23: surface the mismatch so future migrations don't silently
      // drop saved data. Accept the saved entries for now; if their inner
      // shape diverges from the current filter type, callers will need a
      // versioned migration.
      console.warn(
        `[alamut] saved-searches schema mismatch on "${scope}" ` +
        `(stored v${parsed.version}, expected v${SCHEMA_VERSION}). ` +
        `Reading anyway — add a migration if the shape changes.`,
      );
    }
    return parsed.searches ?? [];
  } catch {
    return [];
  }
}

function writeToStorage<F>(scope: string, searches: SavedSearch<F>[]): void {
  if (typeof localStorage === 'undefined') return;
  try {
    const payload: StoredShape<F> = { version: SCHEMA_VERSION, searches };
    localStorage.setItem(`alamut:saved-searches:${scope}`, JSON.stringify(payload));
  } catch {
    // Quota or private mode — ignore.
  }
}

export function useSavedSearches<F>(scope: string) {
  const [searches, setSearches] = useState<SavedSearch<F>[]>(() => readFromStorage<F>(scope));

  // Listen for storage events — keeps multiple tabs in sync (cousin of Phase 22 presence).
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === `alamut:saved-searches:${scope}`) {
        setSearches(readFromStorage<F>(scope));
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [scope]);

  const add = useCallback((name: string, filters: F, search?: string) => {
    const entry: SavedSearch<F> = {
      id: `s_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: name.trim() || 'Untitled search',
      filters,
      search,
      createdAt: new Date().toISOString(),
    };
    setSearches((prev) => {
      const next = [entry, ...prev].slice(0, 12); // cap at 12 saved
      writeToStorage<F>(scope, next);
      return next;
    });
    return entry;
  }, [scope]);

  const remove = useCallback((id: string) => {
    setSearches((prev) => {
      const next = prev.filter((s) => s.id !== id);
      writeToStorage<F>(scope, next);
      return next;
    });
  }, [scope]);

  const clear = useCallback(() => {
    setSearches([]);
    writeToStorage<F>(scope, []);
  }, [scope]);

  return { searches, add, remove, clear };
}
