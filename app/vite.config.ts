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
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) return 'vendor';
          return undefined;
        },
      },
    },
  },
});
