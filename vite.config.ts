import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { crx } from '@crxjs/vite-plugin';
import manifest from './manifest.config';

export default defineConfig({
  plugins: [crx({ manifest })],
  resolve: {
    alias: {
      '@shared': fileURLToPath(new URL('./src/shared', import.meta.url)),
    },
  },
  build: {
    rollupOptions: {
      input: {
        // Registered dynamically at runtime (see src/background/index.ts),
        // not declared in manifest.content_scripts, so they need to be
        // added as explicit build inputs with stable output paths.
        content: fileURLToPath(new URL('./src/content/index.ts', import.meta.url)),
        injected: fileURLToPath(new URL('./src/injected/index.ts', import.meta.url)),
      },
      output: {
        entryFileNames: (chunkInfo) =>
          chunkInfo.name === 'content' || chunkInfo.name === 'injected' ? 'src/[name]/index.js' : 'assets/[name]-[hash].js',
      },
    },
  },
});
