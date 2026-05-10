// Cursor-aware halo wiring for public surfaces (Cover, PublicCreator, Auth).
// The workspace shell (WorkspaceShell.tsx) installs the same listener for
// authenticated pages; public pages don't go through that shell, so they
// drop this <TileHalo /> at their root to get the same effect.
//
// One delegated pointermove listener writes --mx/--my CSS vars to whichever
// tile-bearing element is under the cursor. CSS rules on those tile classes
// read the vars to render a soft accent halo following the cursor. rAF-throttled.

import { useEffect } from 'react';

const TILE_SEL = [
  '.tile-interactive',
  '.bento-tile',
  '.land-live-card',
  '.land-feat-card',
  '.land-quote-card',
  '.pcr-tile',
  '.auth-tile',
].join(', ');

export function TileHalo() {
  useEffect(() => {
    let rafId = 0;
    let lastEl: HTMLElement | null = null;
    const onMove = (e: PointerEvent) => {
      if (rafId) return;
      rafId = requestAnimationFrame(() => {
        rafId = 0;
        const target = e.target as HTMLElement | null;
        const tile = target?.closest(TILE_SEL) as HTMLElement | null;
        if (tile !== lastEl) lastEl = tile;
        if (!tile) return;
        const r = tile.getBoundingClientRect();
        const mx = ((e.clientX - r.left) / r.width) * 100;
        const my = ((e.clientY - r.top) / r.height) * 100;
        tile.style.setProperty('--mx', `${mx}%`);
        tile.style.setProperty('--my', `${my}%`);
      });
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => {
      window.removeEventListener('pointermove', onMove);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, []);
  return null;
}
