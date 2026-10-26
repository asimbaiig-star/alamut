// entry-client.tsx — hydrates the prerendered landing. Falls back to a client
// render when there is nothing to hydrate (the dev server doesn't prerender).

import { StrictMode } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { CreatorsPage } from './CreatorsPage';
import { BrandsPage } from './BrandsPage';
import { mountLandingEvents } from './events';
import { mountReveals } from './motion';
import './landing.css';

const root = document.getElementById('lx-root')!;
const page = root.dataset.page === 'brands' ? 'brands' : 'creators';
const tree = <StrictMode>{page === 'brands' ? <BrandsPage /> : <CreatorsPage />}</StrictMode>;

if (root.firstElementChild) hydrateRoot(root, tree);
else createRoot(root).render(tree);

mountLandingEvents(page);
mountReveals();
