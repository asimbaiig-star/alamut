// hydrate.tsx — hydrates a prerendered landing page. Falls back to a client
// render when there is nothing to hydrate (the dev server doesn't prerender).
//
// Each page has its own entry (entry-creators.tsx, entry-brands.tsx), so a
// visitor downloads only the page they're on: the creator page's rate helper
// never reaches a brand, and the brand page's brief builder never a creator.

import { StrictMode, type ReactNode } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { mountLandingEvents, type LandingPage } from './events';
import './landing.css';

export function hydrate(page: LandingPage, el: ReactNode): void {
  const root = document.getElementById('lx-root')!;
  const tree = <StrictMode>{el}</StrictMode>;
  if (root.firstElementChild) hydrateRoot(root, tree);
  else createRoot(root).render(tree);
  mountLandingEvents(page);
}
