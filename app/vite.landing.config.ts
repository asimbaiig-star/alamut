// vite.landing.config.ts — the two public landing pages, built apart from the
// app.
//
// Separate on purpose. The app's config puts every dependency in one
// `vendor` chunk (see vite.config.ts for the production crash that forced
// it). In a shared build the landing would inherit that 547 KB chunk —
// supabase-js, motion, the router, zustand — to render two static pages.
// Here it bundles only Preact and its own code.
//
//   client:  vite build -c vite.landing.config.ts
//   server:  vite build -c vite.landing.config.ts --ssr src/landing/entry-server.tsx
// then scripts/prerender.mjs writes the rendered HTML into dist/.

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig(({ isSsrBuild }) => ({
  plugins: [react()],
  resolve: {
    // The landing runs on Preact: same components, a tenth of the runtime.
    // Only this build: the app, and the tests, stay on React.
    alias: [
      { find: '@', replacement: path.resolve(__dirname, './src') },
      { find: 'react/jsx-runtime', replacement: 'preact/jsx-runtime' },
      { find: 'react/jsx-dev-runtime', replacement: 'preact/jsx-runtime' },
      { find: 'react-dom/client', replacement: 'preact/compat/client' },
      { find: 'react-dom/server', replacement: 'preact/compat/server' },
      { find: 'react-dom', replacement: 'preact/compat' },
      { find: 'react', replacement: 'preact/compat' },
    ],
  },
  publicDir: false,
  build: isSsrBuild
    ? { outDir: 'dist-ssr', emptyOutDir: true, copyPublicDir: false }
    : {
        outDir: 'dist',
        emptyOutDir: false, // the app build already wrote app.html + assets here
        copyPublicDir: false,
        rollupOptions: {
          input: {
            creators: path.resolve(__dirname, 'index.html'),
            brands: path.resolve(__dirname, 'for-brands/index.html'),
          },
          output: {
            entryFileNames: 'assets/lx-[name]-[hash].js',
            chunkFileNames: 'assets/lx-[name]-[hash].js',
            assetFileNames: 'assets/lx-[name]-[hash][extname]',
          },
        },
      },
}));
