import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { crx } from '@crxjs/vite-plugin';
import manifest from './manifest.config.ts';
import { dynamicScripts } from './vite.plugins/dynamic-scripts.ts';
import { contentDevReload } from './vite.plugins/content-dev-reload.ts';

const { plugin: contentDevReloadPlugin, notifyContentChanged } = contentDevReload();

export default defineConfig({
  plugins: [
    react(),
    crx({ manifest }),
    dynamicScripts({ onRebuild: notifyContentChanged }),
    contentDevReloadPlugin,
  ],
  resolve: {
    alias: {
      '@shared': fileURLToPath(new URL('./src/shared', import.meta.url)),
    },
  },
});
