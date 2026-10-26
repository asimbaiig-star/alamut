import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import type { IncomingMessage } from 'node:http';

// The two landing pages are separate prerendered HTML files (built by
// vite.landing.config.ts); everything else is the SPA in app.html. Vercel
// routes that way via vercel.json — this mirrors it for `npm run dev` and
// `vite preview`, so local behaviour matches production:
//   /              → index.html           (creators landing)
//   /for-brands    → for-brands/index.html (brands landing)
//   any other page → app.html             (the SPA)
function landingRoutes(): Plugin {
  const route = (req: IncomingMessage) => {
    if (req.method !== 'GET' || !(req.headers.accept ?? '').includes('text/html')) return;
    const [pathname, query] = (req.url ?? '/').split('?');
    const qs = query ? `?${query}` : '';
    if (pathname === '/' || pathname === '/index.html') return;
    if (pathname === '/for-brands' || pathname === '/for-brands/') {
      req.url = `/for-brands/index.html${qs}`;
      return;
    }
    if (/\.[a-z0-9]+$/i.test(pathname) || /^\/(@|src\/|node_modules\/|assets\/)/.test(pathname)) return;
    req.url = `/app.html${qs}`;
  };
  return {
    name: 'alamut-landing-routes',
    configureServer(server) { server.middlewares.use((req, _res, next) => { route(req); next(); }); },
    configurePreviewServer(server) { server.middlewares.use((req, _res, next) => { route(req); next(); }); },
  };
}

export default defineConfig({
  plugins: [react(), landingRoutes()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    open: true,
  },
  build: {
    // All third-party deps go into a single `vendor` chunk. We previously
    // split React / Router / state into their own chunks for cache
    // granularity, but that caused a production-only crash:
    //   "Cannot read properties of undefined (reading 'createContext')"
    // …emitted by libraries (e.g. `motion`) that call React.createContext
    // at module-init time. With React in a sibling chunk, Rollup's
    // generated import for React was being evaluated lazily / undefined
    // by the time motion's init ran. Keeping React next to anything that
    // needs it at init time prevents that ordering bug. Route-level
    // chunks (Workspace.tsx, Wallet.tsx, etc.) are still split via the
    // dynamic `import(...)` calls in router.tsx so the initial payload
    // stays small.
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      // The SPA's shell. The landing pages are built separately, with their
      // own chunking, so they never pull in this vendor chunk.
      input: { app: path.resolve(__dirname, 'app.html') },
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) return 'vendor';
          return undefined;
        },
      },
    },
  },
});
