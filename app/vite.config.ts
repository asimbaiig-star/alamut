import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
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
    // Phase 14 — split vendor libs into their own chunks so the initial
    // app payload caches separately from React/Router and the lazy-loaded
    // route chunks can stay small.
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('react-dom') || id.includes('react/')) return 'vendor-react';
          if (id.includes('react-router')) return 'vendor-router';
          if (id.includes('zustand')) return 'vendor-state';
          // Anything else from node_modules → general vendor bucket
          return 'vendor';
        },
      },
    },
  },
});
