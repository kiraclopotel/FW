// FeelingWise - Vite build configuration
// Uses CRXJS plugin for Chrome extension development
// TODO: Install and configure @crxjs/vite-plugin

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        popup: 'src/ui/popup/index.html',
        sidepanel: 'src/ui/sidepanel/index.html',
        dashboard: 'src/ui/dashboard/index.html',
        learning: 'src/ui/learning/index.html',
        content: 'src/content/index.ts',
        background: 'src/background/service-worker.ts',
      },
    },
  },
});
