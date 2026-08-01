import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { crx } from '@crxjs/vite-plugin';
import manifest from './manifest.config.js';
import { dynamicScripts } from './vite.plugins/dynamic-scripts.js';

export default defineConfig({
  plugins: [react(), crx({ manifest }), dynamicScripts()],
  resolve: {
    alias: {
      '@shared': fileURLToPath(new URL('./src/shared', import.meta.url)),
    },
  },
});
