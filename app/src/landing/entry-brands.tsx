// entry-brands.tsx — `/for-brands`, hydrated (see hydrate.tsx).
import { BrandsPage } from './BrandsPage';
import { hydrate } from './hydrate';

hydrate('brands', <BrandsPage />);
