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

      // Rewrite action.default_popup path
      if (manifest.action?.default_popup) {
        for (const fileName of Object.keys(bundle)) {
          if (fileName.endsWith('.html') && fileName.includes('popup')) {
            manifest.action.default_popup = fileName;
            break;
          }
        }
      }

      // Rewrite side_panel default_path (HTML pages are emitted by Vite)
      if (manifest.side_panel?.default_path) {
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

// Two-phase build controlled by BUILD_TARGET env var:
// 1. Main build (default): HTML pages + service worker (ESM format)
// 2. Content script build (BUILD_TARGET=content): IIFE, self-contained, no WebLLM
const isContentBuild = process.env.BUILD_TARGET === 'content';

export default defineConfig(isContentBuild ? {
  // --- Content script build (IIFE, self-contained) ---
  build: {
    outDir: 'dist',
    emptyOutDir: false, // Don't clear the main build output
    rollupOptions: {
      input: {
        content: resolve(__dirname, 'src/content/index.ts'),
      },
      output: {
        format: 'iife',
        entryFileNames: 'content.js',
        inlineDynamicImports: true,
      },
    },
  },
  test: {
    globals: true,
    environment: 'node',
  },
} : {
  // --- Main build (ESM - service worker, HTML pages, manifest) ---
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
        'service-worker': resolve(__dirname, 'src/background/service-worker.ts'),
      },
      output: {
        entryFileNames: (chunkInfo) => {
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
