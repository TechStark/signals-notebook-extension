import { defineManifest } from '@crxjs/vite-plugin';
import pkg from './package.json';

export default defineManifest({
  manifest_version: 3,
  name: 'Signals Notebook Extension',
  description: pkg.description,
  version: pkg.version,
  icons: {
    16: 'public/icons/icon16.png',
    48: 'public/icons/icon48.png',
    128: 'public/icons/icon128.png',
  },
  action: {
    default_popup: 'src/popup/index.html',
  },
  options_page: 'src/options/index.html',
  background: {
    service_worker: 'src/background/index.ts',
    type: 'module',
  },
  // No `content_scripts` entry: the target SNB domain is user-configured
  // at runtime, so content scripts are registered dynamically via
  // chrome.scripting.registerContentScripts() from the background worker.
  permissions: ['scripting', 'storage', 'activeTab'],
  optional_host_permissions: ['https://*/*'],
});
