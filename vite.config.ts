import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { crx } from '@crxjs/vite-plugin';
import manifest from './manifest.config';
import { dynamicScripts } from './vite.plugins/dynamic-scripts';

export default defineConfig({
  plugins: [crx({ manifest }), dynamicScripts()],
  resolve: {
    alias: {
      '@shared': fileURLToPath(new URL('./src/shared', import.meta.url)),
    },
  },
});
