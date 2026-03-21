import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync, writeFileSync, renameSync, existsSync, rmSync } from 'fs';
import { resolve, join } from 'path';

/**
 * Flatten HTML outputs so e.g. dist/src/ui/popup/index.html → dist/popup.html.
 * Uses writeBundle (post-write) since Vite 8 / Rolldown doesn't support
 * direct bundle object mutation in generateBundle.
 */
function flattenHtml(): Plugin {
  return {
    name: 'flatten-html',
    enforce: 'post',
    writeBundle(options) {
      const outDir = options.dir!;
      const nestedDir = join(outDir, 'src', 'ui');
      if (!existsSync(nestedDir)) return;

      const { readdirSync } = require('fs') as typeof import('fs');
      for (const subDir of readdirSync(nestedDir)) {
        const htmlPath = join(nestedDir, subDir, 'index.html');
        if (!existsSync(htmlPath)) continue;

        let html = readFileSync(htmlPath, 'utf-8');
        // Fix asset paths: from nested location, Vite writes relative
        // paths like "../../../assets/foo.js" — rewrite to "assets/foo.js"
        html = html.replace(/(?:\.\.\/)+assets\//g, 'assets/');
        const flatPath = join(outDir, `${subDir}.html`);
        writeFileSync(flatPath, html);
      }

      // Remove the leftover nested src/ directory
      rmSync(join(outDir, 'src'), { recursive: true, force: true });
    },
  };
}

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
      // flattenHtml moves src/ui/popup/index.html → popup.html in writeBundle,
      // so use the flattened name directly.
      if (manifest.action?.default_popup) {
        manifest.action.default_popup = 'popup.html';
      }

      // Rewrite side_panel default_path
      if (manifest.side_panel?.default_path) {
        manifest.side_panel.default_path = 'sidepanel.html';
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
  base: '',
  plugins: [react(), flattenHtml(), chromeExtensionManifest()],
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
