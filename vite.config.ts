import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * Custom plugin that copies manifest.json to dist/ with .ts paths
 * rewritten to their compiled .js output paths.
 */
function chromeExtensionManifest(): Plugin {
  return {
    name: 'chrome-extension-manifest',
    enforce: 'post',
    generateBundle(_, bundle) {
      // Read the source manifest
      const manifest = JSON.parse(
        readFileSync(resolve(__dirname, 'manifest.json'), 'utf-8'),
      );

      // Build a map from input source paths to output file names
      const inputToOutput: Record<string, string> = {};
      for (const [fileName, chunk] of Object.entries(bundle)) {
        if (
          chunk.type === 'chunk' &&
          chunk.isEntry &&
          chunk.facadeModuleId
        ) {
          // Normalize: strip the project root to get relative source path
          const relativeSrc = chunk.facadeModuleId
            .replace(resolve(__dirname) + '/', '');
          inputToOutput[relativeSrc] = fileName;
        }
      }

      // Rewrite service_worker path
      const swSrc = manifest.background?.service_worker;
      if (swSrc && inputToOutput[swSrc]) {
        manifest.background.service_worker = inputToOutput[swSrc];
      }

      // Rewrite content_scripts js paths
      if (manifest.content_scripts) {
        for (const cs of manifest.content_scripts) {
          cs.js = cs.js.map((src: string) => inputToOutput[src] || src);
        }
      }

      // Rewrite side_panel default_path (HTML pages are emitted by Vite)
      // HTML entry points are emitted at their chunk name, e.g. "sidepanel.html"
      if (manifest.side_panel?.default_path) {
        const spSrc = manifest.side_panel.default_path;
        // Find the matching HTML asset in the bundle
        for (const fileName of Object.keys(bundle)) {
          if (fileName.endsWith('.html') && fileName.includes('sidepanel')) {
            manifest.side_panel.default_path = fileName;
            break;
          }
        }
      }

      // Emit the manifest to the output bundle
      this.emitFile({
        type: 'asset',
        fileName: 'manifest.json',
        source: JSON.stringify(manifest, null, 2),
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), chromeExtensionManifest()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'src/ui/popup/index.html'),
        sidepanel: resolve(__dirname, 'src/ui/sidepanel/index.html'),
        dashboard: resolve(__dirname, 'src/ui/dashboard/index.html'),
        learning: resolve(__dirname, 'src/ui/learning/index.html'),
        content: resolve(__dirname, 'src/content/index.ts'),
        'service-worker': resolve(__dirname, 'src/background/service-worker.ts'),
      },
      output: {
        // Keep entry chunk names predictable for manifest rewriting
        entryFileNames: (chunkInfo) => {
          if (chunkInfo.name === 'content') return 'content.js';
          if (chunkInfo.name === 'service-worker') return 'service-worker.js';
          return 'assets/[name]-[hash].js';
        },
      },
    },
  },
  test: {
    globals: true,
    environment: 'node',
  },
});
