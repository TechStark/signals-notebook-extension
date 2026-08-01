import { getConfig, onConfigChanged, originToMatchPattern, type ExtensionConfig } from '@shared/config';
import type { RuntimeMessage } from '@shared/messaging';

const CONTENT_SCRIPT_ID = 'snb-content';

/**
 * (Re)registers the dynamic content script against the user-configured SNB
 * origin. Content scripts can't be scoped statically in manifest.json since
 * the target domain is only known at runtime (see docs/architecture.md).
 */
async function syncContentScriptRegistration(config: ExtensionConfig): Promise<void> {
  const existing = await chrome.scripting.getRegisteredContentScripts({ ids: [CONTENT_SCRIPT_ID] });
  if (existing.length > 0) {
    await chrome.scripting.unregisterContentScripts({ ids: [CONTENT_SCRIPT_ID] });
  }

  if (!config.snbOrigin) return;

  const matches = [originToMatchPattern(config.snbOrigin)];
  const granted = await chrome.permissions.contains({ origins: matches });
  if (!granted) return;

  await chrome.scripting.registerContentScripts([
    {
      id: CONTENT_SCRIPT_ID,
      matches,
      js: ['src/content/index.js'],
      runAt: 'document_idle',
    },
  ]);
}

chrome.runtime.onInstalled.addListener(async () => {
  await syncContentScriptRegistration(await getConfig());
});

onConfigChanged((config) => {
  void syncContentScriptRegistration(config);
});

chrome.runtime.onMessage.addListener((message: RuntimeMessage, _sender, sendResponse) => {
  if (message.type === 'GET_CONFIG') {
    void getConfig().then(sendResponse);
    return true;
  }

  if (message.type === 'REQUEST_HOST_PERMISSION') {
    void chrome.permissions.request({ origins: [originToMatchPattern(message.origin)] }).then(sendResponse);
    return true;
  }

  return false;
});
