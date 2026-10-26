// entry-server.tsx — prerender. scripts/prerender.mjs calls render() at build
// time and writes the HTML into dist/index.html and dist/for-brands/index.html,
// so the hero is in the page before any JavaScript runs.

import { renderToString } from 'react-dom/server';
import { CreatorsPage } from './CreatorsPage';
import { BrandsPage } from './BrandsPage';

export type LandingPage = 'creators' | 'brands';

export function render(page: LandingPage): string {
  return renderToString(page === 'brands' ? <BrandsPage /> : <CreatorsPage />);
}
